import React, { useState, useMemo, useEffect } from 'react'
import './assess.css'
import { showToast } from './lib/toast.js'
import { formatMoney } from './lib/utils.js'
import { submitPublicAssessment, uploadPublicLeadFile, notifyPublicLead } from './lib/api.js'
import { compressImage, isImageFile, MAX_FILES } from './lib/leadImage.js'
import AssessChat from './AssessChat.jsx'
import { parseLeadParams, LEAD_SOURCES, leadTicketNo, buildLeadNote } from './lib/leadSource.js'
import { brokerLink } from './lib/brokers.js'
import { formSnapshotOf } from './lib/valuationWorkflow.js'
import { POSTER_CONTACT } from './lib/posterDesignSystem.js'
import {
  ASSESSMENT_TYPES, PROPERTY_TYPES, PROPERTY_SUBTYPES, PROVINCES,
  ROAD_TYPE_OPTIONS, ROAD_WIDTH_OPTIONS, FRONTAGE_OPTIONS, ZONE_OPTIONS, SOIL_OPTIONS,
  FLOOD_LEVELS, TITLE_TYPES, RISK_FACTORS,
  EMPTY_DEED, computeValuation,
} from './lib/valuationOptions.js'

// หน้าประเมินออนไลน์สาธารณะ — หน้าตาอยู่ใน assess.css (โทเค็น --as-* คู่สว่าง/มืด) ไม่ใช้อีโมจิเป็นไอคอน
const STEPS = ['ข้อมูลผู้ติดต่อ', 'ประเภททรัพย์', 'ที่ตั้งและเอกสารสิทธิ์', 'ทำเล', 'เอกสารและความเสี่ยง', 'วงเงินที่ต้องการ']

const INITIAL_FORM = {
  contactName: '', contactPhone: '', contactLine: '',
  assessmentType: 'ขายฝาก', propertyType: 'ที่ดิน', propertySubtype: 'ที่ดินเปล่า (โฉนด)',
  deeds: [EMPTY_DEED()],
  province: 'กรุงเทพมหานคร', district: '', subdistrict: '',
  roadType: '', roadWidth: '', landFrontage: '',
  zoneColor: '', soilCondition: '',
  risks: { hardAccess: false, irregularShape: false, encumbrance: false, dispute: false, noUtilities: false, nuisance: false },
  floodLevel: 'ไม่มีประวัติน้ำท่วม',
  titleType: 'โฉนด (Chanote) ปลอดภาระ',
  ltvRate: 50,
  requestedLoan: '', compPrice: '', mapLink: '', note: '',
  website: '', // honeypot — บอทมักกรอกฟิลด์นี้ คนจริงมองไม่เห็น
}

const Field = ({ label, hint, children }) => (
  <div className="as-field">
    <label className="as-label">{label}{hint && <small>{hint}</small>}</label>
    {children}
  </div>
)
const Inp = (props) => <input {...props} className="as-input" />
const Sel = ({ children, ...props }) => <select {...props} className="as-input">{children}</select>
const Choice = ({ on, onClick, children }) => (
  <button type="button" className="as-choice" aria-pressed={on} onClick={onClick}>{children}</button>
)

function areaText(deeds) {
  const sum = deeds.reduce((acc, d) => ({ rai: acc.rai + (+d.areaRai || 0), ngan: acc.ngan + (+d.areaNgan || 0), sqw: acc.sqw + (+d.areaSqw || 0) }), { rai: 0, ngan: 0, sqw: 0 })
  if (!sum.rai && !sum.ngan && !sum.sqw) return ''
  return `${sum.rai}-${sum.ngan}-${sum.sqw} ไร่${deeds.length > 1 ? ` (${deeds.length} แปลง)` : ''}`
}

function Shell({ children }) {
  const phoneHref = `tel:${POSTER_CONTACT.phone.replace(/\D/g, '')}`
  return (
    <div className="as-page">
      <header className="as-top">
        <div className="as-top-in">
          <img className="as-logo as-logo-light" src="/logo-lockup-navy.png" alt="AssetX Estate" />
          <img className="as-logo as-logo-dark" src="/logo-lockup-white.png" alt="AssetX Estate" />
          <div className="as-contact">
            <a href={phoneHref}><span>โทร</span>{POSTER_CONTACT.phone}</a>
            <a data-kind="line" href={`https://line.me/R/ti/p/~${POSTER_CONTACT.line}`} target="_blank" rel="noreferrer"><span>LINE</span>{POSTER_CONTACT.line}</a>
          </div>
        </div>
      </header>
      {children}
      <footer className="as-foot">
        ข้อมูลที่ส่งใช้เพื่อประเมินทรัพย์และติดต่อกลับเท่านั้น · <a href="/privacy.html">นโยบายความเป็นส่วนตัว</a>
      </footer>
    </div>
  )
}

// นายหน้าที่เคยส่งงานจากเครื่องนี้ไม่ต้องกรอกชื่อ เบอร์ LINE ซ้ำ (เก็บในเบราว์เซอร์ของเขาเอง ไม่ได้ดึงจากเซิร์ฟเวอร์)
const BROKER_MEMORY_KEY = 'assetx_assess_broker'
function rememberedBroker() {
  try {
    const saved = JSON.parse(localStorage.getItem(BROKER_MEMORY_KEY) || 'null')
    if (!saved || typeof saved !== 'object') return {}
    return { contactName: String(saved.name || '').slice(0, 120), contactPhone: String(saved.phone || '').slice(0, 30), contactLine: String(saved.line || '').slice(0, 60) }
  } catch { return {} }
}
function rememberBroker(form) {
  try { localStorage.setItem(BROKER_MEMORY_KEY, JSON.stringify({ name: form.contactName, phone: form.contactPhone, line: form.contactLine })) } catch { /* ไม่จำก็ยังส่งได้ */ }
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); showToast('คัดลอกลิงก์แล้ว') } catch { showToast('คัดลอกไม่สำเร็จ กรุณากดค้างที่ลิงก์แล้วคัดลอกเอง') }
}

export default function AssessPage() {
  const [step, setStep] = useState(1)
  // ที่มาของผู้ส่ง: ลิงก์นายหน้า ?ref=รหัส ล็อกเป็นนายหน้า · ลิงก์ช่องทาง ?src= หรือไม่มี ให้เลือกเองในขั้นแรก
  const lead = useMemo(() => parseLeadParams(window.location.search), [])
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM, leadSource: lead.leadSource, leadRef: lead.leadRef, ...(lead.leadSource === 'broker' ? rememberedBroker() : {}) }))
  // รหัสในทะเบียนนายหน้าของผู้ส่ง (ได้หลังส่งสำเร็จ) → ลิงก์ส่วนตัวสำหรับส่งทรัพย์ครั้งต่อไป
  const [brokerCode, setBrokerCode] = useState('')
  const isBroker = form.leadSource === 'broker'
  // รายชื่ออำเภอ/ตำบลทั้งประเทศ (ราว 215 KB) โหลดแยกหลังเปิดหน้า ไม่ถ่วงการโหลดครั้งแรก
  const [geo, setGeo] = useState(null)
  useEffect(() => {
    let cancelled = false
    import('./lib/thaiGeo.json').then(m => { if (!cancelled) setGeo(m.default) }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  useEffect(() => { document.title = 'ประเมินทรัพย์สินออนไลน์ | AssetX Estate' }, [])
  const districtNames = useMemo(() => Object.keys(geo?.[form.province] || {}), [geo, form.province])
  const subdistrictNames = geo?.[form.province]?.[form.district] || []
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [ticketNo, setTicketNo] = useState('')
  // รูปแนบ (เอกสารสิทธิ์/รูปทรัพย์): ย่อในเบราว์เซอร์ก่อน แล้วส่งทีละรูปหลังบันทึกฟอร์ม → เก็บในที่เก็บแบบปิด
  const [photos, setPhotos] = useState([])
  const [photoBusy, setPhotoBusy] = useState(false)
  const [sendNote, setSendNote] = useState('')
  const [photoFailed, setPhotoFailed] = useState(0)

  const addPhotos = async (kind, fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setPhotoBusy(true)
    let room = MAX_FILES - photos.length
    let skipped = 0
    const added = []
    for (const file of files) {
      if (room <= 0) { skipped += 1; continue }
      if (!isImageFile(file)) { skipped += 1; continue }
      try {
        const image = await compressImage(file)
        added.push({ id: `${Date.now()}-${added.length}-${Math.random().toString(36).slice(2, 8)}`, kind, ...image })
        room -= 1
      } catch { skipped += 1 }
    }
    setPhotos(prev => [...prev, ...added].slice(0, MAX_FILES))
    setPhotoBusy(false)
    if (skipped) showToast(`เพิ่มไม่ได้ ${skipped} ไฟล์ (รับเฉพาะรูปภาพ ไม่เกิน ${MAX_FILES} รูป)`)
  }
  const removePhoto = (id) => setPhotos(prev => {
    const gone = prev.find(p => p.id === id)
    if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl)
    return prev.filter(p => p.id !== id)
  })

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
  const updateDeed = (idx, key, val) => setForm(prev => ({ ...prev, deeds: prev.deeds.map((d, i) => i === idx ? { ...d, [key]: val } : d) }))
  const addDeed = () => setForm(prev => ({ ...prev, deeds: [...prev.deeds, EMPTY_DEED()] }))
  const removeDeed = (idx) => setForm(prev => ({ ...prev, deeds: prev.deeds.filter((_, i) => i !== idx) }))

  const calc = useMemo(() => computeValuation(form), [form])
  const subtypes = PROPERTY_SUBTYPES[form.propertyType] || ['อื่นๆ']
  const hasMarketEstimate = !!form.compPrice

  // ข้อความบอกว่ายังขาดอะไร (ว่าง = ไปต่อได้) — ปุ่มที่กดไม่ได้ต้องบอกเหตุผลเสมอ
  const missing = () => {
    if (step === 1 && !(form.contactName.trim() && form.contactPhone.trim())) return 'กรอกชื่อและเบอร์โทรศัพท์ก่อน'
    // เลขโฉนด + จังหวัด + อำเภอ คือสามอย่างที่ทีมงานใช้ค้นแปลงในระบบกรมที่ดิน — นายหน้าต้องพิมพ์เอง ไม่อ่านจากรูป (รูปโฉนดเก่าอ่านเลขผิดได้)
    if (step === 3 && !form.district.trim()) return 'เลือกอำเภอ/เขตก่อน'
    if (step === 3 && isBroker && !form.deeds.every(d => String(d.titleDeedNo || '').trim())) return 'กรอกเลขโฉนดของทุกแปลงก่อน'
    if (step === 3 && !form.deeds.every(d => d.areaRai || d.areaNgan || d.areaSqw)) return 'กรอกเนื้อที่โดยประมาณของทุกแปลงก่อน'
    if (step === STEPS.length && !form.requestedLoan) return 'กรอกจำนวนเงินที่ต้องการก่อน'
    return ''
  }
  const need = missing()
  const goto = (n) => { setStep(n); window.scrollTo({ top: 0 }) }

  const handleSubmit = async () => {
    if (form.website) { setSubmitted(true); return } // honeypot โดนกรอก — เงียบๆ ไม่บันทึกจริง
    setSubmitting(true)
    try {
      const saved = await submitPublicAssessment({
        ...form,
        ...calc,
        projectName: `${form.contactName} — ${form.deeds[0]?.titleDeedNo || 'ไม่มีเลขโฉนด'}`,
        customerName: form.contactName,
        locationNote: buildLeadNote({ mapLink: form.mapLink, note: form.note }),
        // ช่องที่ไม่มีคอลัมน์ของตัวเอง (ประเภทเอกสารสิทธิ์ น้ำท่วม ความเสี่ยง) ส่งไปด้วย ให้ทีมงานเปิดประเมินต่อได้ครบ
        formSnapshot: formSnapshotOf({ ...form, locationNote: buildLeadNote({ mapLink: form.mapLink, note: form.note }) }),
      })
      // ส่งรูปทีละรูป: รูปที่ส่งไม่ผ่านไม่ทำให้รายการหาย แจ้งผู้ส่งให้ส่งทาง LINE แทน
      let failed = 0
      for (let i = 0; i < photos.length; i++) {
        setSendNote(`กำลังส่งรูป ${i + 1} จาก ${photos.length}…`)
        try { await uploadPublicLeadFile(saved.rowIndex, { kind: photos[i].kind, base64: photos[i].base64 }) } catch { failed += 1 }
      }
      setPhotoFailed(failed)
      const notice = await notifyPublicLead(saved.rowIndex)
      if (form.leadSource === 'broker') {
        setBrokerCode(notice?.brokerCode || '')
        rememberBroker(form)
      }
      setTicketNo(leadTicketNo(saved?.rowIndex))
      setSubmitted(true)
      window.scrollTo({ top: 0 })
    } catch (e) {
      showToast('ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่: ' + e.message)
    } finally {
      setSubmitting(false)
      setSendNote('')
    }
  }

  // นายหน้าส่งทรัพย์ต่อได้เลยโดยไม่ต้องกรอกข้อมูลตัวเองซ้ำ
  const startNext = () => {
    setForm(prev => ({ ...INITIAL_FORM, deeds: [EMPTY_DEED()], leadSource: prev.leadSource, leadRef: prev.leadRef, contactName: prev.contactName, contactPhone: prev.contactPhone, contactLine: prev.contactLine }))
    photos.forEach(p => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
    setPhotos([])
    setPhotoFailed(0)
    setTicketNo('')
    setSubmitted(false)
    goto(2)
  }

  if (submitted) {
    return (
      <Shell>
        <main className="as-main">
          <div className="as-card as-done">
            <div className="as-done-mark" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </div>
            <h1>ได้รับข้อมูลแล้ว</h1>
            <p>
              ขอบคุณครับคุณ{form.contactName}{' '}
              {isBroker
                ? `ทีมงานจะแจ้งผลประเมินเบื้องต้นทางเบอร์ ${form.contactPhone} ภายในวันทำการ`
                : `ทีมงานจะติดต่อกลับทางเบอร์ ${form.contactPhone} ภายใน 24 ชั่วโมง`}
            </p>
            {ticketNo && (
              <div className="as-ticket">
                <small>เลขรับเรื่อง</small>
                <strong>{ticketNo}</strong>
                <small>แจ้งเลขนี้เมื่อสอบถามความคืบหน้า</small>
              </div>
            )}
            {photoFailed > 0 && (
              <p className="as-warn">รูป {photoFailed} รูปส่งไม่สำเร็จ กรุณาส่งทาง LINE {POSTER_CONTACT.line} พร้อมแจ้งเลขรับเรื่อง</p>
            )}
            {isBroker && brokerCode && (
              <div className="as-mylink">
                <small>ลิงก์ส่งทรัพย์ของคุณ (รหัส {brokerCode})</small>
                <code>{brokerLink(window.location.origin, brokerCode)}</code>
                <button type="button" className="as-btn as-btn-ghost" onClick={() => copyText(brokerLink(window.location.origin, brokerCode))}>คัดลอกลิงก์</button>
                <small>เก็บลิงก์นี้ไว้ใช้ส่งทรัพย์ครั้งต่อไป ทีมงานจะรู้ทันทีว่างานมาจากคุณ</small>
              </div>
            )}
            {isBroker && <button type="button" className="as-btn as-btn-ghost" onClick={startNext}>ส่งทรัพย์รายการถัดไป</button>}
          </div>
        </main>
      </Shell>
    )
  }

  const place = [form.subdistrict, form.district, form.province].filter(Boolean).join(' · ')
  const summary = [
    ['ผู้ส่ง', [form.contactName.trim(), isBroker ? 'นายหน้า' : ''].filter(Boolean).join(' · ')],
    ['ธุรกรรม', form.assessmentType],
    ['ทรัพย์', form.propertySubtype],
    ['ที่ตั้ง', step >= 3 ? place : ''],
    ['เนื้อที่', areaText(form.deeds)],
    ['วงเงินที่ขอ', form.requestedLoan ? `${formatMoney(Math.round(+form.requestedLoan))} บาท` : ''],
    ['รูปแนบ', photos.length ? `${photos.length} รูป` : ''],
  ]

  return (
    <Shell>
      <div className="as-hero">
        <div className="as-hero-in">
          <div className="as-intro">
            <div className="as-eyebrow">{isBroker ? 'สำหรับนายหน้า' : 'ประเมินทรัพย์สินออนไลน์'}</div>
            <h1 className="as-h1">{isBroker ? 'ส่งทรัพย์ให้ AssetX ประเมิน' : 'ขอประเมินทรัพย์เพื่อขายฝากหรือจำนอง'}</h1>
            <p className="as-lead">
              {isBroker
                ? 'กรอกข้อมูลทรัพย์ของลูกค้า 6 ขั้น ทีมงานแจ้งผลประเมินเบื้องต้นกลับภายในวันทำการ'
                : 'กรอกข้อมูลเบื้องต้น 6 ขั้น ทีมงานจะติดต่อกลับพร้อมผลประเมินภายใน 24 ชั่วโมง'}
            </p>
          </div>
        </div>
      </div>
      <main className="as-main" data-lift="true">

        <div className="as-grid">
          <section className="as-card as-form" aria-labelledby="as-step-title">
            <div className="as-step-head">
              <h2 className="as-step-title" id="as-step-title">{STEPS[step - 1]}</h2>
              <span className="as-step-count">ขั้นที่ {step} จาก {STEPS.length}</span>
            </div>
            <div className="as-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step}>
              {STEPS.map((s, i) => <i key={s} data-on={i < step} />)}
            </div>

            {/* honeypot — ซ่อนจากคนจริงด้วย CSS ไม่ใช่ display:none (บอทบางตัวข้าม display:none) */}
            <input className="as-trap" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={e => update('website', e.target.value)} />

            {step === 1 && (
              <>
                {!lead.locked && (
                  <Field label="คุณคือ">
                    <div className="as-choices" data-cols="2">
                      {Object.entries(LEAD_SOURCES).reverse().map(([key, meta]) => (
                        <Choice key={key} on={form.leadSource === key} onClick={() => update('leadSource', key)}>{meta.label}</Choice>
                      ))}
                    </div>
                  </Field>
                )}
                <Field label={isBroker ? 'ชื่อ-นามสกุลนายหน้า' : 'ชื่อ-นามสกุล'}>
                  <Inp value={form.contactName} autoComplete="name" onChange={e => update('contactName', e.target.value)} />
                </Field>
                <div className="as-row2">
                  <Field label="เบอร์โทรศัพท์">
                    <Inp type="tel" inputMode="tel" autoComplete="tel" value={form.contactPhone} onChange={e => update('contactPhone', e.target.value)} placeholder="08X-XXX-XXXX" />
                  </Field>
                  <Field label="LINE ID" hint="ไม่บังคับ">
                    <Inp value={form.contactLine} onChange={e => update('contactLine', e.target.value)} />
                  </Field>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <Field label="ธุรกรรมที่ต้องการ">
                  <div className="as-choices">
                    {ASSESSMENT_TYPES.filter(t => ['ขายฝาก', 'จำนอง', 'อื่นๆ'].includes(t.value)).map(t => (
                      <Choice key={t.value} on={form.assessmentType === t.value} onClick={() => update('assessmentType', t.value)}>{t.value}</Choice>
                    ))}
                  </div>
                </Field>
                <Field label="ประเภททรัพย์สิน">
                  <div className="as-choices">
                    {PROPERTY_TYPES.map(t => (
                      <Choice key={t.value} on={form.propertyType === t.value} onClick={() => setForm(prev => ({ ...prev, propertyType: t.value, propertySubtype: (PROPERTY_SUBTYPES[t.value] || ['อื่นๆ'])[0] }))}>{t.value}</Choice>
                    ))}
                  </div>
                </Field>
                <Field label="ประเภทย่อย">
                  <Sel value={form.propertySubtype} onChange={e => update('propertySubtype', e.target.value)}>
                    {subtypes.map(s => <option key={s}>{s}</option>)}
                  </Sel>
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                {/* เลือกตามลำดับ จังหวัด → อำเภอ/เขต → ตำบล/แขวง · โหลดรายชื่อไม่ได้ = กลับเป็นช่องพิมพ์เอง */}
                <div className="as-row3">
                  <Field label="จังหวัด">
                    <Sel value={form.province} onChange={e => setForm(prev => ({ ...prev, province: e.target.value, district: '', subdistrict: '' }))}>
                      {PROVINCES.map(p => <option key={p}>{p}</option>)}
                    </Sel>
                  </Field>
                  <Field label="อำเภอ/เขต">
                    {districtNames.length ? (
                      <Sel value={form.district} onChange={e => setForm(prev => ({ ...prev, district: e.target.value, subdistrict: '' }))}>
                        <option value="">เลือกอำเภอ/เขต</option>
                        {districtNames.map(d => <option key={d}>{d}</option>)}
                      </Sel>
                    ) : (
                      <Inp value={form.district} onChange={e => update('district', e.target.value)} />
                    )}
                  </Field>
                  <Field label="ตำบล/แขวง">
                    {districtNames.length ? (
                      <Sel value={form.subdistrict} disabled={!form.district} onChange={e => update('subdistrict', e.target.value)}>
                        <option value="">{form.district ? 'เลือกตำบล/แขวง' : 'เลือกอำเภอ/เขตก่อน'}</option>
                        {subdistrictNames.map(t => <option key={t}>{t}</option>)}
                      </Sel>
                    ) : (
                      <Inp value={form.subdistrict} onChange={e => update('subdistrict', e.target.value)} />
                    )}
                  </Field>
                </div>

                <div className="as-section">
                  <span>เอกสารสิทธิ์ {form.deeds.length} แปลง</span>
                  <button type="button" className="as-link" onClick={addDeed}>+ เพิ่มแปลง</button>
                </div>
                <p className="as-hint" style={{ marginTop: 0 }}>{isBroker ? 'กรอกเลขโฉนดตามตัวเลขบนเอกสารจริงทุกแปลง ทีมงานใช้เลขโฉนด จังหวัด และอำเภอค้นข้อมูลแปลง รูปถ่ายโฉนดอย่างเดียวอาจอ่านเลขผิดได้' : 'ถ้าไม่ทราบเลขโฉนด กรอกเฉพาะเนื้อที่โดยประมาณได้ ทีมงานจะตรวจสอบอีกครั้ง'}</p>
                {form.deeds.map((deed, idx) => (
                  <div key={deed.id} className="as-parcel">
                    <div className="as-parcel-head">
                      <span>แปลงที่ {idx + 1}</span>
                      {form.deeds.length > 1 && <button type="button" className="as-link" data-tone="danger" onClick={() => removeDeed(idx)}>ลบแปลงนี้</button>}
                    </div>
                    <Field label="เลขโฉนด" hint={isBroker ? 'จำเป็น · พิมพ์ตามเอกสารจริง' : 'ถ้าทราบ'}>
                      <Inp value={deed.titleDeedNo} inputMode="numeric" onChange={e => updateDeed(idx, 'titleDeedNo', e.target.value)} />
                    </Field>
                    <div className="as-row3" data-keep="true">
                      <Field label="ไร่">
                        <Inp type="number" min="0" inputMode="numeric" value={deed.areaRai} onChange={e => updateDeed(idx, 'areaRai', +e.target.value)} />
                      </Field>
                      <Field label="งาน">
                        <Inp type="number" min="0" max="3" inputMode="numeric" value={deed.areaNgan} onChange={e => updateDeed(idx, 'areaNgan', +e.target.value)} />
                      </Field>
                      <Field label="ตารางวา">
                        <Inp type="number" min="0" inputMode="decimal" value={deed.areaSqw} onChange={e => updateDeed(idx, 'areaSqw', +e.target.value)} />
                      </Field>
                    </div>
                  </div>
                ))}
              </>
            )}

            {step === 4 && (
              <>
                <p className="as-hint">เลือกเท่าที่ทราบ ไม่ต้องแม่นยำทุกข้อ ทีมงานจะตรวจสอบจริงอีกครั้ง</p>
                <div className="as-row2">
                  <Field label="ลักษณะถนนหน้าทรัพย์">
                    <Sel value={form.roadType} onChange={e => update('roadType', e.target.value)}>
                      <option value="">ไม่ระบุ</option>
                      {ROAD_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                    </Sel>
                  </Field>
                  <Field label="ความกว้างถนน">
                    <Sel value={form.roadWidth} onChange={e => update('roadWidth', e.target.value)}>
                      <option value="">ไม่ระบุ</option>
                      {ROAD_WIDTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                    </Sel>
                  </Field>
                  <Field label="หน้ากว้างที่ดิน">
                    <Sel value={form.landFrontage} onChange={e => update('landFrontage', e.target.value)}>
                      <option value="">ไม่ระบุ</option>
                      {FRONTAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                    </Sel>
                  </Field>
                  <Field label="ผังเมือง" hint="ถ้าทราบ">
                    <Sel value={form.zoneColor} onChange={e => update('zoneColor', e.target.value)}>
                      <option value="">ไม่ทราบ</option>
                      {ZONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                    </Sel>
                  </Field>
                </div>
                <Field label="สภาพดินและพื้นที่">
                  <Sel value={form.soilCondition} onChange={e => update('soilCondition', e.target.value)}>
                    <option value="">ไม่ระบุ</option>
                    {SOIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                  </Sel>
                </Field>
              </>
            )}

            {step === 5 && (
              <>
                <div className="as-row2">
                  <Field label="ประเภทเอกสารสิทธิ์">
                    <Sel value={form.titleType} onChange={e => update('titleType', e.target.value)}>
                      {TITLE_TYPES.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                    </Sel>
                  </Field>
                  <Field label="ประวัติน้ำท่วม">
                    <Sel value={form.floodLevel} onChange={e => update('floodLevel', e.target.value)}>
                      {FLOOD_LEVELS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                    </Sel>
                  </Field>
                </div>
                <Field label="ลักษณะอื่นของทรัพย์" hint="เลือกได้หลายข้อ ไม่มีให้ข้ามได้">
                  {RISK_FACTORS.map(rf => (
                    <label key={rf.key} className="as-check" data-on={!!form.risks[rf.key]}>
                      <input type="checkbox" checked={!!form.risks[rf.key]} onChange={e => update('risks', { ...form.risks, [rf.key]: e.target.checked })} />
                      <span>{rf.label}</span>
                    </label>
                  ))}
                </Field>
              </>
            )}

            {step === 6 && (
              <>
                <div className="as-row2">
                  <Field label="จำนวนเงินที่ต้องการ (บาท)">
                    <Inp type="number" min="0" inputMode="numeric" value={form.requestedLoan} onChange={e => update('requestedLoan', e.target.value)} placeholder="เช่น 1000000" />
                  </Field>
                  <Field label="ราคาตลาดต่อตารางวา" hint="ถ้าทราบ">
                    <Inp type="number" min="0" inputMode="numeric" value={form.compPrice} onChange={e => update('compPrice', e.target.value)} placeholder="เช่น 25000" />
                  </Field>
                </div>
                <Field label="ลิงก์ Google Maps ของทรัพย์" hint="ถ้ามี">
                  <Inp type="url" inputMode="url" value={form.mapLink} maxLength={300} onChange={e => update('mapLink', e.target.value)} placeholder="วางลิงก์หมุดที่ตั้ง" />
                </Field>
                <Field label="รายละเอียดเพิ่มเติม" hint="ถ้ามี">
                  <textarea className="as-input" value={form.note} maxLength={1000} rows={3} onChange={e => update('note', e.target.value)} placeholder={isBroker ? 'เช่น ภาระเดิมที่ต้องไถ่ถอน ระยะเวลาที่ลูกค้าต้องการ ความเร่งด่วน' : 'เช่น ภาระเดิมที่มีอยู่ ระยะเวลาที่ต้องการ'} />
                </Field>
                <div className="as-section">
                  <span>รูปประกอบ <small className="as-opt">ถ้ามี · ไม่เกิน {MAX_FILES} รูป</small></span>
                </div>
                <p className="as-hint" style={{ marginTop: 0 }}>รูปเอกสารสิทธิ์และรูปทรัพย์ช่วยให้ประเมินได้เร็วขึ้น รูปจะถูกเก็บแบบปิด เปิดดูได้เฉพาะทีมงาน</p>
                <div className="as-photo-pick">
                  {[['deed', 'เพิ่มรูปเอกสารสิทธิ์'], ['property', 'เพิ่มรูปทรัพย์']].map(([kind, text]) => (
                    <label key={kind} className="as-btn as-btn-ghost as-file" data-off={photoBusy || photos.length >= MAX_FILES}>
                      {text}
                      <input type="file" accept="image/*" multiple disabled={photoBusy || photos.length >= MAX_FILES} onChange={e => { addPhotos(kind, e.target.files); e.target.value = '' }} />
                    </label>
                  ))}
                  {photoBusy && <span className="as-need" style={{ margin: 0 }}>กำลังเตรียมรูป…</span>}
                </div>
                {photos.length > 0 && (
                  <ul className="as-photos">
                    {photos.map(p => (
                      <li key={p.id}>
                        <img src={p.previewUrl} alt={p.kind === 'deed' ? 'รูปเอกสารสิทธิ์' : 'รูปทรัพย์'} />
                        <span>{p.kind === 'deed' ? 'เอกสารสิทธิ์' : 'รูปทรัพย์'}</span>
                        <button type="button" className="as-link" data-tone="danger" onClick={() => removePhoto(p.id)}>ลบ</button>
                      </li>
                    ))}
                  </ul>
                )}
                {hasMarketEstimate && (
                  <div className="as-estimate">
                    <div className="as-estimate-label">วงเงินโดยประมาณจากข้อมูลที่กรอก (ยังไม่ใช่ผลประเมินจริง)</div>
                    <div className="as-estimate-value">{formatMoney(Math.round(calc.recommendedLoan))} บาท</div>
                    <p className="as-estimate-note">คิดจากมูลค่าตลาด {formatMoney(Math.round(calc.marketValue))} บาท ที่ LTV {calc.cappedLtv}%</p>
                  </div>
                )}
              </>
            )}

            <div className="as-actions">
              {step > 1 && <button type="button" className="as-btn as-btn-ghost" onClick={() => goto(step - 1)}>ย้อนกลับ</button>}
              {step < STEPS.length ? (
                <button type="button" className="as-btn as-btn-primary" disabled={!!need} onClick={() => goto(step + 1)}>ถัดไป</button>
              ) : (
                <button type="button" className="as-btn as-btn-primary" disabled={submitting || photoBusy || !!need} onClick={handleSubmit}>
                  {submitting ? (sendNote || 'กำลังส่งข้อมูล…') : 'ส่งข้อมูลให้ทีมงาน'}
                </button>
              )}
            </div>
            {need && <div className="as-need">{need}</div>}
          </section>

          <aside className="as-side">
            <div className="as-card as-side-card">
              <h2 className="as-side-title">สรุปรายการ</h2>
              <dl className="as-summary">
                {summary.map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd data-empty={!v}>{v || 'ยังไม่ระบุ'}</dd></div>
                ))}
              </dl>
              {isBroker && form.leadRef && <div className="as-ref">รหัสผู้แนะนำ <b>{form.leadRef}</b></div>}
            </div>
            <div className="as-card as-side-card">
              <h2 className="as-side-title">หลังส่งข้อมูล</h2>
              <ol className="as-steps">
                <li><span><b>ได้เลขรับเรื่องทันที</b>ใช้อ้างอิงเมื่อสอบถามความคืบหน้า</span></li>
                <li><span><b>ทีมงานประเมินเบื้องต้น</b>{isBroker ? 'แจ้งผลกลับภายในวันทำการ' : 'ติดต่อกลับภายใน 24 ชั่วโมง'}</span></li>
                <li><span><b>นัดดูทรัพย์และทำสัญญา</b>จดทะเบียนที่สำนักงานที่ดิน แจ้งค่าใช้จ่ายรวมก่อนวันนัด</span></li>
              </ol>
            </div>
          </aside>
        </div>
      </main>

      <AssessChat phone={POSTER_CONTACT.phone} />
    </Shell>
  )
}

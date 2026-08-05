import React, { useState, useMemo } from 'react'
import { showToast } from './lib/toast.js'
import { BRAND as BASE_BRAND } from './lib/config.js'
import { formatMoney } from './lib/utils.js'
import { submitPublicAssessment } from './lib/api.js'
import ChatPanel from './ChatPanel.jsx'
import {
  ASSESSMENT_TYPES, PROPERTY_TYPES, PROPERTY_SUBTYPES, PROVINCES,
  ROAD_TYPE_OPTIONS, ROAD_WIDTH_OPTIONS, FRONTAGE_OPTIONS, ZONE_OPTIONS, SOIL_OPTIONS,
  FLOOD_LEVELS, TITLE_TYPES, RISK_FACTORS,
  EMPTY_DEED, computeValuation,
} from './lib/valuationOptions.js'

const BRAND = { ...BASE_BRAND, bgCard: '#0D1B2E', textMut: '#475569' }

const STEPS = ['ติดต่อกลับ', 'ประเภททรัพย์', 'ที่ตั้ง & โฉนด', 'ปัจจัยทำเล', 'ความเสี่ยง', 'วงเงินที่ต้องการ']

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
  requestedLoan: '', compPrice: '',
  website: '', // honeypot — บอทมักกรอกฟิลด์นี้ คนจริงมองไม่เห็น
}

const card = { background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: 18 }
const label = { fontSize: 12, color: BRAND.textSec, marginBottom: 6, display: 'block' }
const inputBase = { width: '100%', background: '#050B18', border: `1px solid ${BRAND.border}`, borderRadius: 8, color: BRAND.textPri, fontSize: 14, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }
const Inp = (props) => <input {...props} style={{ ...inputBase, ...props.style }} />
const Sel = ({ children, ...props }) => <select {...props} style={{ ...inputBase, ...props.style }}>{children}</select>

export default function AssessPage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
  const updateDeed = (idx, key, val) => setForm(prev => ({ ...prev, deeds: prev.deeds.map((d, i) => i === idx ? { ...d, [key]: val } : d) }))
  const addDeed = () => setForm(prev => ({ ...prev, deeds: [...prev.deeds, EMPTY_DEED()] }))
  const removeDeed = (idx) => setForm(prev => ({ ...prev, deeds: prev.deeds.filter((_, i) => i !== idx) }))

  const calc = useMemo(() => computeValuation(form), [form])
  const subtypes = PROPERTY_SUBTYPES[form.propertyType] || ['อื่นๆ']
  const hasMarketEstimate = !!form.compPrice

  const canNext = () => {
    if (step === 1) return form.contactName.trim() && form.contactPhone.trim()
    if (step === 3) return form.deeds.every(d => d.areaRai || d.areaNgan || d.areaSqw)
    return true
  }

  const handleSubmit = async () => {
    if (form.website) { setSubmitted(true); return } // honeypot โดนกรอก — เงียบๆ ไม่บันทึกจริง
    setSubmitting(true)
    try {
      await submitPublicAssessment({
        ...form,
        ...calc,
        projectName: `${form.contactName} — ${form.deeds[0]?.titleDeedNo || 'ไม่มีเลขโฉนด'}`,
        customerName: form.contactName,
      })
      setSubmitted(true)
    } catch (e) {
      showToast('ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: BRAND.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ ...card, maxWidth: 440, width: '100%', textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: BRAND.textPri, marginBottom: 8 }}>ส่งข้อมูลสำเร็จ</div>
          <div style={{ fontSize: 14, color: BRAND.textSec, lineHeight: 1.7 }}>
            ขอบคุณครับคุณ{form.contactName} ทีมงานได้รับข้อมูลของคุณแล้ว<br />
            จะติดต่อกลับผ่านเบอร์ {form.contactPhone} ภายใน 24 ชั่วโมง
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BRAND.bg }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.textPri }}>📋 ประเมินทรัพย์สินออนไลน์</div>
          <div style={{ fontSize: 13, color: BRAND.textSec, marginTop: 4 }}>กรอกข้อมูลเบื้องต้น ทีมงานผู้เชี่ยวชาญจะติดต่อกลับพร้อมผลประเมินจริง</div>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 24, flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => {
            const num = i + 1
            const active = step === num
            const done = step > num
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: active ? BRAND.gold : done ? BRAND.teal : BRAND.bgCard,
                  color: active || done ? '#000' : BRAND.textMut,
                  border: `1px solid ${active ? BRAND.gold : done ? BRAND.teal : BRAND.border}`,
                }}>{done ? '✓' : num}</div>
                {i < STEPS.length - 1 && <div style={{ width: 14, height: 1, background: BRAND.border }} />}
              </div>
            )
          })}
        </div>

        {/* honeypot — ซ่อนจากคนจริงด้วย CSS ไม่ใช่ display:none (บอทบางตัวข้าม display:none) */}
        <input
          type="text" tabIndex={-1} autoComplete="off" value={form.website}
          onChange={e => update('website', e.target.value)}
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {step === 1 && (
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.gold, marginBottom: 14 }}>👤 ข้อมูลติดต่อกลับ</div>
              <label style={label}>ชื่อ-นามสกุล *</label>
              <Inp value={form.contactName} onChange={e => update('contactName', e.target.value)} placeholder="เช่น สมชาย ใจดี" style={{ marginBottom: 12 }} />
              <label style={label}>เบอร์โทรศัพท์ *</label>
              <Inp value={form.contactPhone} onChange={e => update('contactPhone', e.target.value)} placeholder="08X-XXX-XXXX" style={{ marginBottom: 12 }} />
              <label style={label}>LINE ID (ไม่บังคับ)</label>
              <Inp value={form.contactLine} onChange={e => update('contactLine', e.target.value)} placeholder="LINE ID ของคุณ" />
            </div>
          )}

          {step === 2 && (
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.gold, marginBottom: 14 }}>⚡ ประเภทที่ต้องการ</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
                {ASSESSMENT_TYPES.filter(t => ['ขายฝาก', 'จำนอง', 'อื่นๆ'].includes(t.value)).map(t => (
                  <button key={t.value} onClick={() => update('assessmentType', t.value)} style={{ padding: '12px 8px', borderRadius: 10, border: `1px solid ${form.assessmentType === t.value ? BRAND.gold : BRAND.border}`, background: form.assessmentType === t.value ? 'rgba(245,158,11,0.12)' : '#050B18', color: BRAND.textPri, cursor: 'pointer', textAlign: 'center', fontSize: 12 }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{t.icon}</div>
                    <div style={{ fontWeight: 600 }}>{t.value}</div>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.gold, marginBottom: 14 }}>🏗️ ประเภททรัพย์สิน</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                {PROPERTY_TYPES.map(t => (
                  <button key={t.value} onClick={() => { update('propertyType', t.value); update('propertySubtype', (PROPERTY_SUBTYPES[t.value] || ['อื่นๆ'])[0]) }} style={{ padding: '10px 6px', borderRadius: 10, border: `1px solid ${form.propertyType === t.value ? BRAND.teal : BRAND.border}`, background: form.propertyType === t.value ? 'rgba(45,212,191,0.1)' : '#050B18', color: BRAND.textPri, cursor: 'pointer', textAlign: 'center', fontSize: 11 }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                    <div style={{ fontWeight: 600 }}>{t.value}</div>
                  </button>
                ))}
              </div>
              <label style={label}>ประเภทย่อย</label>
              <Sel value={form.propertySubtype} onChange={e => update('propertySubtype', e.target.value)}>
                {subtypes.map(s => <option key={s}>{s}</option>)}
              </Sel>
            </div>
          )}

          {step === 3 && (
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.gold, marginBottom: 14 }}>📍 ที่ตั้งทรัพย์</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={label}>จังหวัด</label>
                  <Sel value={form.province} onChange={e => update('province', e.target.value)}>
                    {PROVINCES.map(p => <option key={p}>{p}</option>)}
                  </Sel>
                </div>
                <div>
                  <label style={label}>อำเภอ/เขต</label>
                  <Inp value={form.district} onChange={e => update('district', e.target.value)} placeholder="อำเภอ/เขต" />
                </div>
                <div>
                  <label style={label}>ตำบล/แขวง</label>
                  <Inp value={form.subdistrict} onChange={e => update('subdistrict', e.target.value)} placeholder="ตำบล/แขวง" />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.gold }}>📄 ข้อมูลโฉนด ({form.deeds.length} แปลง)</div>
                <button onClick={addDeed} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, border: `1px solid ${BRAND.teal}`, background: 'rgba(45,212,191,0.08)', color: BRAND.teal, cursor: 'pointer', fontWeight: 600 }}>+ เพิ่มแปลง</button>
              </div>
              <div style={{ fontSize: 11, color: BRAND.textMut, marginBottom: 12 }}>ถ้าไม่ทราบเลขโฉนด/ระวางแน่ชัด กรอกแค่เนื้อที่โดยประมาณก็ได้ ทีมงานจะตรวจสอบให้อีกครั้ง</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {form.deeds.map((deed, idx) => (
                  <div key={deed.id} style={{ padding: 12, borderRadius: 10, border: `1px solid ${BRAND.border}`, background: '#050B18' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: BRAND.textSec }}>แปลงที่ {idx + 1}</span>
                      {form.deeds.length > 1 && (
                        <button onClick={() => removeDeed(idx)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#F87171', cursor: 'pointer' }}>✕ ลบ</button>
                      )}
                    </div>
                    <label style={label}>เลขโฉนด (ถ้าทราบ)</label>
                    <Inp value={deed.titleDeedNo} onChange={e => updateDeed(idx, 'titleDeedNo', e.target.value)} placeholder="เช่น 12345" style={{ marginBottom: 10 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={label}>ไร่</label>
                        <Inp type="number" min="0" value={deed.areaRai} onChange={e => updateDeed(idx, 'areaRai', +e.target.value)} />
                      </div>
                      <div>
                        <label style={label}>งาน</label>
                        <Inp type="number" min="0" max="3" value={deed.areaNgan} onChange={e => updateDeed(idx, 'areaNgan', +e.target.value)} />
                      </div>
                      <div>
                        <label style={label}>ตร.ว.</label>
                        <Inp type="number" min="0" value={deed.areaSqw} onChange={e => updateDeed(idx, 'areaSqw', +e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.gold, marginBottom: 4 }}>🛣️ ปัจจัยทำเล</div>
              <div style={{ fontSize: 11, color: BRAND.textMut, marginBottom: 14 }}>เลือกตามความเข้าใจของคุณ — ไม่ต้องแม่นยำ 100% ทีมงานจะตรวจสอบจริงอีกครั้ง</div>
              <label style={label}>ลักษณะถนนหน้าทรัพย์</label>
              <Sel value={form.roadType} onChange={e => update('roadType', e.target.value)} style={{ marginBottom: 12 }}>
                <option value="">— เลือก —</option>
                {ROAD_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
              </Sel>
              <label style={label}>ความกว้างถนน</label>
              <Sel value={form.roadWidth} onChange={e => update('roadWidth', e.target.value)} style={{ marginBottom: 12 }}>
                <option value="">— เลือก —</option>
                {ROAD_WIDTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
              </Sel>
              <label style={label}>หน้ากว้างที่ดิน</label>
              <Sel value={form.landFrontage} onChange={e => update('landFrontage', e.target.value)} style={{ marginBottom: 12 }}>
                <option value="">— เลือก —</option>
                {FRONTAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
              </Sel>
              <label style={label}>ผังเมือง (ถ้าทราบ)</label>
              <Sel value={form.zoneColor} onChange={e => update('zoneColor', e.target.value)} style={{ marginBottom: 12 }}>
                <option value="">— ไม่ทราบ —</option>
                {ZONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
              </Sel>
              <label style={label}>สภาพดิน/พื้นที่</label>
              <Sel value={form.soilCondition} onChange={e => update('soilCondition', e.target.value)}>
                <option value="">— เลือก —</option>
                {SOIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
              </Sel>
            </div>
          )}

          {step === 5 && (
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.gold, marginBottom: 14 }}>⚠️ ความเสี่ยง</div>
              <label style={label}>ประวัติน้ำท่วม</label>
              <Sel value={form.floodLevel} onChange={e => update('floodLevel', e.target.value)} style={{ marginBottom: 12 }}>
                {FLOOD_LEVELS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
              </Sel>
              <label style={label}>ประเภทเอกสารสิทธิ์</label>
              <Sel value={form.titleType} onChange={e => update('titleType', e.target.value)} style={{ marginBottom: 14 }}>
                {TITLE_TYPES.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
              </Sel>
              <label style={{ ...label, marginBottom: 10 }}>ลักษณะอื่นๆ ที่มี (เลือกได้หลายข้อ)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {RISK_FACTORS.map(rf => (
                  <label key={rf.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${form.risks[rf.key] ? 'rgba(239,68,68,0.4)' : BRAND.border}`, background: form.risks[rf.key] ? 'rgba(239,68,68,0.08)' : '#050B18' }}>
                    <input type="checkbox" checked={!!form.risks[rf.key]} onChange={e => update('risks', { ...form.risks, [rf.key]: e.target.checked })} />
                    <span style={{ fontSize: 13, color: BRAND.textPri }}>{rf.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.gold, marginBottom: 14 }}>💰 วงเงินที่ต้องการ</div>
              <label style={label}>จำนวนเงินที่ต้องการ (บาท) *</label>
              <Inp type="number" min="0" value={form.requestedLoan} onChange={e => update('requestedLoan', e.target.value)} placeholder="เช่น 1000000" style={{ marginBottom: 12 }} />
              <label style={label}>ราคาตลาดที่ทราบมา ต่อ ตร.ว. (ถ้ามี — ไม่บังคับ)</label>
              <Inp type="number" min="0" value={form.compPrice} onChange={e => update('compPrice', e.target.value)} placeholder="เช่น 25000" />

              <div style={{ marginTop: 18, padding: 16, borderRadius: 10, background: 'rgba(45,212,191,0.06)', border: `1px solid rgba(45,212,191,0.2)` }}>
                {hasMarketEstimate ? (
                  <>
                    <div style={{ fontSize: 12, color: BRAND.textSec, marginBottom: 6 }}>ประเมินเบื้องต้น (ยังไม่ใช่ตัวเลขจริง)</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.teal, marginBottom: 4 }}>{formatMoney(Math.round(calc.recommendedLoan))} ฿</div>
                    <div style={{ fontSize: 11, color: BRAND.textMut }}>วงเงินแนะนำโดยประมาณ จากมูลค่าตลาด {formatMoney(Math.round(calc.marketValue))} ฿ · LTV {calc.cappedLtv}%</div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: BRAND.textSec, textAlign: 'center' }}>ทีมงานจะประเมินอย่างละเอียดและติดต่อกลับภายใน 24 ชั่วโมง</div>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 10 }}>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${BRAND.border}`, background: 'transparent', color: BRAND.textSec, fontSize: 14, cursor: 'pointer' }}>← ย้อนกลับ</button>
            )}
            {step < STEPS.length ? (
              <button onClick={() => canNext() && setStep(s => s + 1)} disabled={!canNext()} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: canNext() ? BRAND.gold : 'rgba(245,158,11,0.3)', color: '#000', fontWeight: 700, fontSize: 14, cursor: canNext() ? 'pointer' : 'not-allowed' }}>ถัดไป →</button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting || !form.requestedLoan} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: submitting ? 'rgba(45,212,191,0.3)' : 'linear-gradient(135deg,#2DD4BF,#0E7490)', color: '#000', fontWeight: 700, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? '⏳ กำลังส่งข้อมูล...' : '✅ ส่งข้อมูลให้ทีมงาน'}
              </button>
            )}
          </div>
        </div>
      </div>

      <ChatPanel
        apiEndpoint="/api/assess-chat"
        title="ที่ปรึกษา AssetX"
        subtitle="ถามได้ทุกเรื่องจำนอง/ขายฝาก"
        emptyStateText="มีคำถามเกี่ยวกับจำนอง/ขายฝากไหม ถามได้เลยครับ"
        quickQuestions={[
          'จำนองกับขายฝากต่างกันยังไง?',
          'ถ้าไถ่คืนไม่ทันจะเกิดอะไรขึ้น?',
          'ต้องเตรียมเอกสารอะไรบ้าง?',
          'ใช้เวลานานแค่ไหนกว่าจะได้เงิน?',
        ]}
      />
    </div>
  )
}

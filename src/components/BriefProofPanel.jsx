// แผง "สร้างจากข้อมูลจริง" ใน Studio ของ /marketing: บรีฟ + บันทึกหน้างาน + แหล่งข้อมูล + ข้ออ้าง (Proof Card)
// และกล่องผลด่านตรวจบนการ์ดร่าง (GateResult) — เฟส P0 · 23 พ.ย. 2569
// ข้อมูลอยู่ในตารางแยก (ผ่าน /api/marketing-proof) ไม่ฝังในเวิร์กสเปซ · เวิร์กสเปซเก็บแค่เลขบรีฟ
// ตรรกะล้วนอยู่ใน src/lib/marketingProof.js — ไฟล์นี้มีแต่หน้าจอและการเรียก API
import React, { useEffect, useState } from 'react'
import {
  BRIEF_MODES, CLAIM_CATEGORIES, CLAIM_STATUS, CLAIM_TYPES, LOCATION_LEVELS, PERMISSIONS, PRICE_KINDS, SOURCE_KINDS,
  briefMissing, canComposeFromBrief, composeProofDraft, normalizeBrief, verifyProblems,
} from '../lib/marketingProof.js'
import { GATE_SECTIONS } from '../lib/marketingReviewGate.js'
import { getBriefWriteJob, getWriteJob, loadBriefProof, requestWrite, reviewClaim, saveBrief, saveClaim, saveSource, writeJobStatus } from '../lib/marketingProofApi.js'
import { assetxAssetTypes } from '../lib/assetxMarketingModel.js'
import './BriefProofPanel.css'

const EMPTY_BRIEF = {
  brand_id: 'assetx_estate', series_id: '',
  mode: 'field', topic: '', audience_problem: '', unique_insight: '', intended_takeaway: '', cta: '', asset_type: '',
  public_location_level: 'none', public_location: '', reference_url: '',
  field: { survey_date: '', features: '', observations: '', unknowns: '', price_kind: '', customer_question: '', lesson: '' },
}
const EMPTY_SOURCE = { kind: 'official', title: '', source_url: '', source_date: '', checked_at: '', permission_status: '' }
const EMPTY_CLAIM = { claim_text: '', claim_type: 'NEEDS-CHECK', category: 'general' }
const joinLines = (value) => (Array.isArray(value) ? value.join('\n') : String(value || ''))

// แถวบรีฟจากเซิร์ฟเวอร์ → ค่าในฟอร์ม (รายการเป็นข้อความหลายบรรทัด)
function toForm(brief) {
  if (!brief) return EMPTY_BRIEF
  const field = brief.field || {}
  return {
    ...EMPTY_BRIEF, ...brief,
    field: { ...EMPTY_BRIEF.field, ...field, survey_date: field.survey_date || '', observations: joinLines(field.observations), unknowns: joinLines(field.unknowns) },
  }
}

const options = (map) => Object.entries(map).map(([value, label]) => <option key={value} value={value}>{typeof label === 'string' ? label : label.label}</option>)

// brands = โปรไฟล์แบรนด์ที่ใช้จริง · series = ซีรีส์ที่เลือกได้ · seriesContext(id) = { name, thesis, previous } ส่งให้ AI เป็นบริบท
export default function BriefProofPanel({ briefId, topicHint = '', reviewer = '', onReviewerChange, onBriefId, onCompose, onBackToDraft, notify, brands = [], series = [], seriesContext = () => null }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_BRIEF, topic: topicHint }))
  const [meta, setMeta] = useState(null) // { id, version } ของบรีฟที่บันทึกแล้ว
  const [sources, setSources] = useState([])
  const [claims, setClaims] = useState([])
  const [links, setLinks] = useState([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState(null) // { text, retry? }
  const [dirty, setDirty] = useState(false)
  const [newSource, setNewSource] = useState(EMPTY_SOURCE)
  const [newClaim, setNewClaim] = useState(EMPTY_CLAIM)
  const [checked, setChecked] = useState(false)
  // งานให้ AI เขียนจากโน้ต { job, worker } (คิวบนคอมสำนักงาน) · tick ให้ตัวนับเวลาบนหน้าจอเดิน
  const [write, setWrite] = useState(null)
  const [writeNote, setWriteNote] = useState('')
  const [, setTick] = useState(0)
  // ส่วนแหล่งข้อมูล/ข้ออ้างพับไว้ก่อน (ใช้เมื่อโพสต์จะอ้างตัวเลข ราคา หรือข้อกฎหมาย) · มีข้อมูลอยู่แล้ว = เปิดให้เลย
  const [proofOpen, setProofOpen] = useState(false)
  useEffect(() => { if (sources.length || claims.length) setProofOpen(true) }, [sources.length, claims.length])

  const applyProof = (data) => {
    setForm(toForm(data.brief))
    setMeta(data.brief ? { id: data.brief.id, version: data.brief.version, contentId: data.brief.content_id || null, contentNo: data.brief.content_no || null } : null)
    setSources(data.sources || [])
    setClaims(data.claims || [])
    setLinks(data.links || [])
    setDirty(false)
  }

  const load = async (id) => {
    setBusy('load')
    setError(null)
    try {
      const data = await loadBriefProof(id)
      if (!data.brief) {
        // บรีฟที่จำไว้ไม่มีแล้ว → เริ่มใบใหม่
        onBriefId?.(null)
        setMeta(null)
      } else applyProof(data)
    } catch (err) {
      setError({ text: err.message, retry: () => load(id) })
    } finally {
      setBusy('')
    }
  }

  useEffect(() => {
    if (briefId && Number(briefId) !== Number(meta?.id)) load(briefId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefId])

  // เปิดบรีฟที่เคยสั่ง AI เขียนไว้ → ตามงานที่ยังไม่จบ หรือแสดงร่างที่เขียนไว้แล้ว (ไม่ต้องสั่งใหม่)
  useEffect(() => {
    if (!meta?.id) { setWrite(null); return undefined }
    let cancelled = false
    getBriefWriteJob(meta.id).then((data) => { if (!cancelled && data.job) setWrite(data) }).catch(() => {})
    return () => { cancelled = true }
  }, [meta?.id])

  // งานยังไม่จบ → ถามสถานะทุก 5 วินาที (หยุดเองเมื่อจบหรือปิดแผง)
  const writeActive = ['queued', 'running'].includes(write?.job?.status)
  useEffect(() => {
    if (!writeActive) return undefined
    const jobId = write.job.id
    const timer = window.setInterval(() => {
      setTick((n) => n + 1)
      getWriteJob(jobId).then((data) => { if (data.job) setWrite(data) }).catch(() => {})
    }, 5000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writeActive, write?.job?.id])

  // เรียก API หนึ่งครั้ง: จัดสถานะกำลังทำ ข้อผิดพลาด และกรณีถูกแก้จากอีกแท็บ (โหลดฉบับล่าสุดได้ ข้อความที่พิมพ์ยังอยู่)
  const run = async (key, task) => {
    setBusy(key)
    setError(null)
    try {
      return await task()
    } catch (err) {
      setError({ text: err.message, ...(err.conflict && meta?.id ? { retry: () => load(meta.id), retryLabel: 'โหลดฉบับล่าสุด' } : {}) })
      return null
    } finally {
      setBusy('')
    }
  }

  const setField = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setDirty(true) }
  const setNote = (key, value) => { setForm((current) => ({ ...current, field: { ...current.field, [key]: value } })); setDirty(true) }

  const save = async () => {
    const result = normalizeBrief(form)
    if (!result.ok) { setError({ text: result.errors.join(' · ') }); return null }
    const data = await run('brief', () => saveBrief(form, { id: meta?.id || null, version: meta?.version || null, createdBy: reviewer }))
    if (!data) return null
    setMeta({ id: data.brief.id, version: data.brief.version, contentId: data.brief.content_id || null, contentNo: data.brief.content_no || null })
    setForm(toForm(data.brief))
    setDirty(false)
    if (!meta?.id) onBriefId?.(data.brief.id)
    notify?.('บันทึกบรีฟแล้ว')
    return data.brief
  }

  const addSource = async () => {
    const { permission_status: permission, ...rest } = newSource
    const data = await run('source', () => saveSource({ ...rest, ...(permission ? { permission_status: permission } : {}) }, { briefId: meta.id }))
    if (!data) return
    setSources((list) => [...list, data.source])
    setNewSource(EMPTY_SOURCE)
  }

  const patchSource = async (source, patch) => {
    const data = await run(`source-${source.id}`, () => saveSource({ ...source, note: source.metadata?.note || '', ...patch }, { id: source.id, version: source.version }))
    if (data) setSources((list) => list.map((item) => (item.id === source.id ? data.source : item)))
  }

  const addClaim = async () => {
    const data = await run('claim', () => saveClaim(newClaim, { briefId: meta.id, sourceIds: [] }))
    if (!data) return
    setClaims((list) => [...list, data.claim])
    setNewClaim(EMPTY_CLAIM)
  }

  const replaceClaim = (data) => {
    setClaims((list) => list.map((item) => (item.id === data.claim.id ? data.claim : item)))
    if (data.links) setLinks((list) => [...list.filter((link) => Number(link.claim_id) !== Number(data.claim.id)), ...data.links])
  }
  const patchClaim = async (claim, patch, sourceIds = null) => {
    const data = await run(`claim-${claim.id}`, () => saveClaim({ ...claim, ...patch }, { id: claim.id, version: claim.version, sourceIds }))
    if (data) replaceClaim(data)
  }
  const setClaimStatus = async (claim, status) => {
    if (status === 'verified' && !String(reviewer).trim()) { setError({ text: 'ใส่ชื่อผู้ตรวจด้านล่างก่อนยืนยันข้ออ้าง' }); return }
    const data = await run(`claim-${claim.id}`, () => reviewClaim({ id: claim.id, version: claim.version, status, reviewer }))
    if (data) replaceClaim(data)
  }
  const sourceIdsOf = (claim) => links.filter((link) => Number(link.claim_id) === Number(claim.id)).map((link) => Number(link.source_id))
  const toggleSource = (claim, sourceId) => {
    const current = sourceIdsOf(claim)
    patchClaim(claim, {}, current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId])
  }

  const normalized = normalizeBrief(form).value
  const proof = { brief: { ...normalized, id: meta?.id }, claims, sources, links }
  const missing = briefMissing(normalized, claims, sources)
  const composable = canComposeFromBrief(normalized, claims)

  const compose = async () => {
    let brief = meta?.id && !dirty ? { ...normalized, id: meta.id } : await save()
    if (!brief) return
    brief = { ...normalizeBrief(brief).value, id: brief.id }
    // ไม่ได้กรอกคำชวนทำ = ใช้คำชวนทำตั้งต้นของแบรนด์ที่เลือก
    const composed = composeProofDraft({ brief: { ...brief, cta: brief.cta || activeBrand?.cta || '' }, claims, sources, links })
    onCompose?.({ ...composed, brand_id: brief.brand_id, series_id: brief.series_id }, { brief, claims, sources, links })
  }

  const activeBrand = brands.find((brand) => brand.id === form.brand_id) || brands[0] || null

  const askAiToWrite = async () => {
    const brief = meta?.id && !dirty ? { id: meta.id } : await save()
    if (!brief) return
    const data = await run('write', () => requestWrite(brief.id, writeNote, form.series_id ? seriesContext(form.series_id) : null))
    if (data) setWrite(data)
  }

  const pickAiDraft = (draft) => {
    const brief = { ...normalizeBrief(form).value, id: meta.id }
    onCompose?.({
      headline: draft.headline, caption: draft.caption, cta: draft.cta, claim_ids_used: draft.claim_ids_used || [],
      missing_evidence: write?.job?.result?.missing_evidence || [], basis: 'ai', knowledge: draft.knowledge || [],
      hooks: draft.hooks || [], brand_id: brief.brand_id, series_id: brief.series_id,
      ai: { kind: draft.kind, label: draft.kind_label, provider: write?.job?.result?.provider || null },
    }, { brief, claims, sources, links })
  }

  const writeStatus = writeJobStatus(write?.job, write?.worker)
  const aiDrafts = write?.job?.status === 'done' ? (write.job.result?.drafts || []) : []
  const aiStale = aiDrafts.length > 0 && (dirty || Number(write.job.result?.brief_version) !== Number(meta?.version))

  const aiCount = aiDrafts.length
  useEffect(() => {
    if (aiCount) window.setTimeout(() => document.querySelector('.bp-ai')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
  }, [aiCount, write?.job?.id])

  const saving = Boolean(busy)
  // บรีฟที่ผูกกับร่างในแท็บ ร่าง แล้ว: แก้หลักฐานได้ แต่ไม่ร่างซ้ำเป็นคอนเทนต์ชิ้นใหม่ (บรีฟหนึ่งใบต่อคอนเทนต์หนึ่งชิ้น)
  const attached = Boolean(meta?.contentId)
  return (
    <section className="bp-panel" aria-label="สร้างจากข้อมูลจริง">
      <header className="bp-head">
        <div>
          <strong>สร้างจากข้อมูลจริง</strong>
          <span>บรีฟ · แหล่งข้อมูล · ข้ออ้างที่ตรวจได้ — กรอกเท่าที่มี ไม่ต้องครบทุกช่อง</span>
        </div>
        {meta?.id && <span className="bp-tag">บรีฟ {meta.id}{attached ? ` · ผูกกับร่าง${meta.contentNo ? ` #${meta.contentNo}` : ''}` : ''}{dirty ? ' · ยังไม่บันทึก' : ''}</span>}
      </header>

      <div className="bp-modes" role="radiogroup" aria-label="วิธีเริ่ม">
        {Object.entries(BRIEF_MODES).filter(([value]) => value !== 'topic').map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={form.mode === value} className={form.mode === value ? 'active' : ''} onClick={() => setField('mode', value)}>{label}</button>
        ))}
      </div>

      {busy === 'load' && <p className="bp-note" role="status">กำลังโหลดบรีฟ…</p>}
      {error && (
        <p className="bp-error" role="alert">
          {error.text}
          {error.retry && <button type="button" onClick={error.retry}>{error.retryLabel || 'ลองใหม่'}</button>}
        </p>
      )}

      <div className="bp-grid">
        {brands.length > 1 && (
          <label>แบรนด์
            <select value={form.brand_id} onChange={(event) => setField('brand_id', event.target.value)}>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          </label>
        )}
        {series.length > 0 && (
          <label>ซีรีส์ (ไม่บังคับ)
            <select value={form.series_id} onChange={(event) => setField('series_id', event.target.value)}>
              <option value="">ไม่อยู่ในซีรีส์</option>
              {series.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}
        {activeBrand && brands.length > 1 && <p className="bp-note wide">{activeBrand.short}: {activeBrand.voice} · คำชวนทำตั้งต้น: {activeBrand.cta}</p>}
        <label className="wide">หัวข้อ
          <input value={form.topic} maxLength={200} onChange={(event) => setField('topic', event.target.value)} placeholder="เช่น ที่ดินติดถนนใหญ่เหมือนกัน ทำไมมูลค่าต่างกัน" />
        </label>
        {form.mode === 'link' && (
          <label className="wide">ลิงก์อ้างอิง
            <input value={form.reference_url} inputMode="url" onChange={(event) => setField('reference_url', event.target.value)} placeholder="https://…" />
          </label>
        )}
        <label>ปัญหาของคนอ่านที่โพสต์นี้ตอบ
          <textarea rows={2} value={form.audience_problem} onChange={(event) => setField('audience_problem', event.target.value)} />
        </label>
        <label>ข้อสังเกตเฉพาะของเรา (ถ้ามี)
          <textarea rows={2} value={form.unique_insight} onChange={(event) => setField('unique_insight', event.target.value)} placeholder="สิ่งที่เราเห็นจากงานจริง ซึ่งบทความทั่วไปไม่ได้พูด" />
        </label>
        <label>สิ่งที่คนอ่านทำต่อได้
          <textarea rows={2} value={form.intended_takeaway} onChange={(event) => setField('intended_takeaway', event.target.value)} />
        </label>
        <label>คำชวนทำ (ข้อเดียว)
          <input value={form.cta} maxLength={200} onChange={(event) => setField('cta', event.target.value)} placeholder="เช่น เก็บเช็กลิสต์นี้ไว้ใช้สำรวจที่ดินของตัวเอง" />
        </label>
      </div>

      {form.mode === 'field' && (
        <fieldset className="bp-fieldset">
          <legend>บันทึกหน้างาน</legend>
          <p className="bp-note">ห้ามใส่ชื่อ เบอร์โทร เลขเอกสารสิทธิ์ หรือพิกัดของลูกค้า · ระบุพื้นที่เท่าที่อนุญาตให้เผยแพร่</p>
          <div className="bp-grid">
            <label>ประเภททรัพย์
              <select value={form.asset_type} onChange={(event) => setField('asset_type', event.target.value)}>
                <option value="">ไม่ระบุ</option>
                {assetxAssetTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <label>วันที่สำรวจ
              <input type="date" value={form.field.survey_date} onChange={(event) => setNote('survey_date', event.target.value)} />
            </label>
            <label>ระดับพื้นที่ที่เผยแพร่ได้
              <select value={form.public_location_level} onChange={(event) => setField('public_location_level', event.target.value)}>{options(LOCATION_LEVELS)}</select>
            </label>
            {form.public_location_level !== 'none' && (
              <label>พื้นที่ (ตามระดับที่เลือก)
                <input value={form.public_location} maxLength={120} onChange={(event) => setField('public_location', event.target.value)} />
              </label>
            )}
            <label className="wide">ลักษณะทรัพย์ (หน้าแปลง ทางเข้าออก ถนน สภาพพื้นที่)
              <textarea rows={2} value={form.field.features} onChange={(event) => setNote('features', event.target.value)} />
            </label>
            <label>ข้อสังเกตจริงจากหน้างาน (บรรทัดละข้อ)
              <textarea rows={4} value={form.field.observations} onChange={(event) => setNote('observations', event.target.value)} />
            </label>
            <label>สิ่งที่ยังไม่ทราบ / ยังสรุปไม่ได้ (บรรทัดละข้อ)
              <textarea rows={4} value={form.field.unknowns} onChange={(event) => setNote('unknowns', event.target.value)} />
            </label>
            <label>ชนิดของข้อมูลราคาที่มี
              <select value={form.field.price_kind} onChange={(event) => setNote('price_kind', event.target.value)}>
                <option value="">ไม่มีข้อมูลราคา</option>
                {options(PRICE_KINDS)}
              </select>
            </label>
            <label>คำถามที่เจ้าของทรัพย์ถาม (ไม่ระบุตัวตน)
              <input value={form.field.customer_question} maxLength={300} onChange={(event) => setNote('customer_question', event.target.value)} />
            </label>
            <label className="wide">บทเรียนหนึ่งประโยค
              <input value={form.field.lesson} maxLength={300} onChange={(event) => setNote('lesson', event.target.value)} />
            </label>
          </div>
        </fieldset>
      )}

      <div className="bp-actions">
        <button type="button" className="mx-secondary" disabled={saving} onClick={save}>{busy === 'brief' ? 'กำลังบันทึก…' : 'บันทึกร่าง'}</button>
        {!meta?.id && <span className="bp-note">บันทึกบรีฟก่อน แล้วจึงเพิ่มแหล่งข้อมูลและข้ออ้างได้</span>}
      </div>

      {meta?.id && !proofOpen && (
        <div className="bp-switch">
          <button type="button" className="mx-secondary" aria-expanded={false} onClick={() => setProofOpen(true)}>เพิ่มแหล่งข้อมูลและข้ออ้าง</button>
          <span>ใช้เมื่อโพสต์จะอ้างตัวเลข ราคา หรือข้อกฎหมาย · ถ้าเล่าแค่สิ่งที่เห็นหน้างาน ข้ามได้</span>
        </div>
      )}
      {meta?.id && proofOpen && (
        <>
          <fieldset className="bp-fieldset">
            <legend>แหล่งข้อมูล ({sources.length})</legend>
            {sources.map((source) => (
              <div className="bp-row" key={source.id}>
                <div className="bp-row-main">
                  <strong>{source.title}</strong>
                  <span>{SOURCE_KINDS[source.kind]}{source.source_url ? <> · <a href={source.source_url} target="_blank" rel="noreferrer noopener">เปิดแหล่ง</a></> : ''}{source.checked_at ? ` · ตรวจ ${source.checked_at}` : ' · ยังไม่ใส่วันที่ตรวจ'}</span>
                </div>
                <label className="bp-inline">วันที่ตรวจ
                  <input type="date" value={source.checked_at || ''} disabled={saving} onChange={(event) => patchSource(source, { checked_at: event.target.value })} />
                </label>
                <label className="bp-inline">สิทธิเผยแพร่
                  <select value={source.permission_status} disabled={saving} onChange={(event) => patchSource(source, { permission_status: event.target.value })}>{options(PERMISSIONS)}</select>
                </label>
              </div>
            ))}
            <div className="bp-add">
              <select aria-label="ชนิดแหล่งข้อมูล" value={newSource.kind} onChange={(event) => setNewSource({ ...newSource, kind: event.target.value })}>{options(SOURCE_KINDS)}</select>
              <input aria-label="ชื่อแหล่งข้อมูล" placeholder="ชื่อแหล่ง เช่น ประกาศกรมที่ดิน เรื่อง…" value={newSource.title} onChange={(event) => setNewSource({ ...newSource, title: event.target.value })} />
              <input aria-label="ลิงก์แหล่งข้อมูล" placeholder="ลิงก์ (ถ้ามี)" inputMode="url" value={newSource.source_url} onChange={(event) => setNewSource({ ...newSource, source_url: event.target.value })} />
              <label className="bp-inline">วันที่ตรวจ
                <input type="date" value={newSource.checked_at} onChange={(event) => setNewSource({ ...newSource, checked_at: event.target.value })} />
              </label>
              <button type="button" className="mx-secondary" disabled={saving || !newSource.title.trim()} onClick={addSource}>{busy === 'source' ? 'กำลังเพิ่ม…' : 'เพิ่มแหล่งข้อมูล'}</button>
            </div>
          </fieldset>

          <fieldset className="bp-fieldset">
            <legend>ข้ออ้างสำคัญของโพสต์ ({claims.length})</legend>
            <p className="bp-note">ข้ออ้างที่จะใช้ในโพสต์ต้องยืนยันพร้อมแหล่งที่มา · ข้อที่ยังไม่ยืนยันให้เลือก ไม่ใช้ในโพสต์ ระบบจะไม่เขียนลงร่าง</p>
            {claims.map((claim, index) => {
              const mine = sourceIdsOf(claim)
              const problems = claim.status === 'verified' ? [] : verifyProblems(claim, sources.filter((source) => mine.includes(Number(source.id))))
              const rowBusy = busy === `claim-${claim.id}`
              return (
                <div className={`bp-claim ${claim.status}`} key={claim.id}>
                  <div className="bp-claim-head">
                    <strong>ข้ออ้าง {index + 1}</strong>
                    <span className={`bp-status ${claim.status}`}>{CLAIM_STATUS[claim.status]}{claim.reviewer && claim.status === 'verified' ? ` · ${claim.reviewer}` : ''}</span>
                  </div>
                  <p className="bp-claim-text">{claim.claim_text}</p>
                  <div className="bp-grid tight">
                    <label>ประเภทหลักฐาน
                      <select value={claim.claim_type} disabled={saving} onChange={(event) => patchClaim(claim, { claim_type: event.target.value })}>{options(CLAIM_TYPES)}</select>
                    </label>
                    <label>หมวด
                      <select value={claim.category} disabled={saving} onChange={(event) => patchClaim(claim, { category: event.target.value })}>{options(CLAIM_CATEGORIES)}</select>
                    </label>
                    {CLAIM_TYPES[claim.claim_type]?.needsPermission && (
                      <label>สิทธิเผยแพร่ข้อมูลนี้
                        <select value={claim.permission_status} disabled={saving} onChange={(event) => patchClaim(claim, { permission_status: event.target.value })}>{options(PERMISSIONS)}</select>
                      </label>
                    )}
                    <label>ข้อจำกัดของข้อมูล
                      <input defaultValue={claim.limitation} key={`l-${claim.version}`} disabled={saving} onBlur={(event) => { if (event.target.value !== claim.limitation) patchClaim(claim, { limitation: event.target.value }) }} />
                    </label>
                    <label className="wide">ถ้อยคำที่ใช้เผยแพร่ได้ (เว้นว่าง = ใช้ข้อความข้ออ้าง)
                      <input defaultValue={claim.publishable_wording} key={`w-${claim.version}`} disabled={saving} onBlur={(event) => { if (event.target.value !== claim.publishable_wording) patchClaim(claim, { publishable_wording: event.target.value }) }} />
                    </label>
                  </div>
                  {sources.length > 0 && (
                    <div className="bp-checks" role="group" aria-label={`แหล่งข้อมูลของข้ออ้าง ${index + 1}`}>
                      <span>แหล่งที่รองรับ:</span>
                      {sources.map((source) => (
                        <label key={source.id}><input type="checkbox" checked={mine.includes(Number(source.id))} disabled={saving} onChange={() => toggleSource(claim, Number(source.id))} />{source.title}</label>
                      ))}
                    </div>
                  )}
                  {problems.length > 0 && claim.status !== 'rejected' && <p className="bp-note">ก่อนยืนยันต้อง: {problems.join(' · ')}</p>}
                  <div className="bp-actions">
                    <label className="bp-check"><input type="checkbox" checked={claim.use_in_post !== false} disabled={saving || claim.status === 'rejected'} onChange={(event) => patchClaim(claim, { use_in_post: event.target.checked })} />ใช้ในโพสต์</label>
                    <button type="button" className="mx-mini-button" disabled={saving || claim.status === 'verified'} onClick={() => setClaimStatus(claim, 'verified')}>{rowBusy ? 'กำลังบันทึก…' : 'ยืนยันแล้ว'}</button>
                    <button type="button" className="mx-mini-button" disabled={saving || claim.status === 'needs_check'} onClick={() => setClaimStatus(claim, 'needs_check')}>ต้องตรวจ</button>
                    <button type="button" className="mx-mini-button" disabled={saving || claim.status === 'rejected'} onClick={() => setClaimStatus(claim, 'rejected')}>ไม่ใช้ข้อนี้</button>
                  </div>
                </div>
              )
            })}
            <div className="bp-add">
              <textarea aria-label="ข้อความของข้ออ้าง" rows={2} placeholder="ข้ออ้างหนึ่งข้อ เช่น ราคาเสนอขายของแปลงใกล้เคียงอยู่ในระดับใกล้กัน" value={newClaim.claim_text} onChange={(event) => setNewClaim({ ...newClaim, claim_text: event.target.value })} />
              <select aria-label="ประเภทหลักฐาน" value={newClaim.claim_type} onChange={(event) => setNewClaim({ ...newClaim, claim_type: event.target.value })}>{options(CLAIM_TYPES)}</select>
              <select aria-label="หมวดของข้ออ้าง" value={newClaim.category} onChange={(event) => setNewClaim({ ...newClaim, category: event.target.value })}>{options(CLAIM_CATEGORIES)}</select>
              <button type="button" className="mx-secondary" disabled={saving || !newClaim.claim_text.trim()} onClick={addClaim}>{busy === 'claim' ? 'กำลังเพิ่ม…' : 'เพิ่มข้ออ้าง'}</button>
            </div>
          </fieldset>

          <label className="bp-reviewer">ชื่อผู้ตรวจ (ใช้บันทึกว่าใครยืนยันข้ออ้าง)
            <input value={reviewer} maxLength={80} onChange={(event) => onReviewerChange?.(event.target.value)} />
          </label>
        </>
      )}

      {checked && (
        <div className="bp-missing" role="status">
          <strong>{missing.length ? 'ข้อมูลที่ยังขาด' : 'ข้อมูลครบสำหรับร่างโพสต์'}</strong>
          {missing.map((item) => <span key={item}>{item}</span>)}
          {!composable && <span>ยังไม่มีข้อสังเกตหน้างาน ข้อสังเกตเฉพาะ หรือข้ออ้างที่ยืนยันแล้ว — ถ้าเป็นความรู้ทั่วไป ใช้ช่องพิมพ์หัวข้อด้านล่าง (โหมดสร้างเร็ว) ได้เลย</span>}
        </div>
      )}
      <div className="bp-actions end">
        <button type="button" className="mx-secondary" onClick={() => setChecked(true)}>ตรวจข้อมูล</button>
        {attached
          ? <button type="button" className="mx-primary" onClick={() => onBackToDraft?.()}>กลับไปที่ร่าง</button>
          : (
            <>
              <button type="button" className="mx-secondary" disabled={saving || !composable} title={composable ? 'ระบบเรียงข้อความที่กรอกเป็นโพสต์ตรง ๆ ไม่ใช้ AI' : 'ต้องมีข้อสังเกตหน้างาน ข้อสังเกตเฉพาะ หรือข้ออ้างที่ยืนยันแล้วอย่างน้อยหนึ่งอย่าง'} onClick={compose}>เรียงร่างเอง (ไม่ใช้ AI)</button>
              <button type="button" className="mx-primary" disabled={saving || !form.topic.trim() || writeActive} title={form.topic.trim() ? 'AI บนคอมสำนักงานเขียนให้ 3 มุมจากโน้ตนี้และคลังความรู้ของเรา ราว 1 นาที · ยิ่งจดข้อสังเกตมาก โพสต์ยิ่งเป็นของเราเอง' : 'ใส่หัวข้อก่อน'} onClick={askAiToWrite}>{writeActive ? 'AI กำลังเขียน…' : aiDrafts.length ? 'ให้ AI เขียนใหม่อีกรอบ' : 'ให้ AI เขียนจากโน้ตนี้'}</button>
            </>
          )}
      </div>
      {!attached && (
        <label className="bp-ai-note">คำขอถึง AI (ไม่บังคับ)
          <input value={writeNote} maxLength={200} disabled={writeActive} placeholder="เช่น เขียนสั้น ๆ · เน้นคนที่กำลังจะขายฝาก" onChange={(event) => setWriteNote(event.target.value)} />
        </label>
      )}
      {writeStatus && (
        <p className={`bp-ai-status ${writeStatus.tone}`} role="status">
          {writeStatus.text}
          {write?.job?.status === 'failed' && !attached && <button type="button" disabled={saving} onClick={askAiToWrite}>ลองอีกครั้ง</button>}
        </p>
      )}
      {aiDrafts.length > 0 && !attached && (
        <div className="bp-ai" aria-label="ร่างที่ AI เขียนจากโน้ต">
          <strong>AI เขียนให้ {aiDrafts.length} มุม — เลือกมุมที่ชอบ</strong>
          <span className="bp-note">ทุกมุมใช้เฉพาะข้อมูลในโน้ตและผ่านด่านตรวจตัวเลขแล้ว แต่ระบบตรวจการตีความเกินโน้ตไม่ได้ทั้งหมด อ่านเทียบกับโน้ตก่อนใช้{aiStale ? ' · โน้ตถูกแก้หลังร่างชุดนี้ กด ให้ AI เขียนใหม่อีกรอบ ถ้าต้องการให้ตรงกับโน้ตล่าสุด' : ''}</span>
          {aiDrafts.map((draft) => (
            <article className="bp-ai-card" key={draft.kind}>
              <div className="bp-claim-head">
                <strong>{draft.kind_label} · {draft.label}</strong>
                <span className="bp-tag">{draft.caption.length} ตัวอักษร</span>
              </div>
              {draft.knowledge?.length > 0 && <span className="bp-note">อิงคลังความรู้: {[...new Set(draft.knowledge.map((item) => item.cite))].join(' · ')}{draft.knowledge.some((item) => item.secondary) ? ' · มีข้อจากแหล่งรอง ยืนยันก่อนโพสต์' : ''}</span>}
              <p className="bp-ai-headline">{draft.headline}</p>
              <p className="bp-ai-caption">{draft.caption}</p>
              {draft.reader_learns && <span className="bp-note">คนอ่านได้: {draft.reader_learns}</span>}
              {draft.visual && <span className="bp-note">แนวภาพ: {draft.visual}</span>}
              {draft.missing_evidence?.length > 0 && <span className="bp-note">หลักฐานที่ถ้าหามาได้ มุมนี้จะแข็งขึ้น: {draft.missing_evidence.join(' · ')}</span>}
              {draft.hooks?.length > 1 && <span className="bp-note">มีประโยคเปิดทางเลือกอีก {draft.hooks.length - 1} แบบ (สลับได้หลังกด ใช้ร่างนี้)</span>}
              <div className="bp-actions end">
                <button type="button" className="mx-primary" onClick={() => pickAiDraft(draft)}>ใช้ร่างนี้</button>
              </div>
            </article>
          ))}
          {(write.job.result?.skipped || []).map((item) => <span className="bp-note" key={item.kind}>AI ไม่ได้เขียนมุม {item.kind_label}: {item.reason}</span>)}
        </div>
      )}
      <p className="bp-note">{attached
        ? 'บรีฟนี้ผูกกับร่างในแท็บ ร่าง แล้ว — แก้แหล่งข้อมูลและข้ออ้างที่นี่ แล้วกลับไปกด ตรวจหลักฐาน บนการ์ด (ข้อความโพสต์แก้ที่การ์ด)'
        : 'AI เขียนจากโน้ต ข้ออ้างที่ยืนยันแล้ว และคลังความรู้ของเราเท่านั้น ร่างที่มีตัวเลขหรือข้ออ้างนอกเหนือจากนี้ถูกคัดออกก่อนถึงหน้านี้ · ทุกร่างยังต้องให้คนอ่านและอนุมัติ'}</p>
    </section>
  )
}

// คะแนนสามอย่างแยกกัน + ด่าน 6 ข้อ + ประโยคสำเร็จรูป (src/lib/marketingOriginality.js) — ข้อมูลประกอบการตรวจ ไม่บล็อก ไม่ใช่คำทำนายยอด
function ScoreSummary({ assessment }) {
  if (!assessment) return null
  const passed = assessment.gates.filter((gate) => gate.ok).length
  return (
    <details className="bp-scores">
      <summary>
        <span>ต้นฉบับ <strong>{assessment.originality}</strong>/100</span>
        <span>บรรณาธิการ <strong>{assessment.editorial}</strong>/100</span>
        <span>โครงสร้าง <strong>{assessment.structural}</strong>/100</span>
        <span>ด่าน 6 ข้อ ผ่าน {passed}</span>
      </summary>
      <span className="bp-gate-mode">เกณฑ์ภายในสำหรับช่วยตรวจ ไม่ใช่คำทำนายยอดเข้าถึง · คะแนนสูงไม่ลบล้างตัวบล็อก · โพสต์ความรู้ทั่วไปได้คะแนนต้นฉบับต่ำเป็นปกติ{assessment.ready_for_final_review ? ' · คะแนนถึงเกณฑ์ พร้อมให้คนตรวจขั้นสุดท้าย' : ''}</span>
      <div className="bp-gate-section">
        <em>ด่าน 6 ข้อ</em>
        {assessment.gates.map((gate) => <span key={gate.key}><b className={gate.ok ? 'ok' : 'todo'}>{gate.ok ? 'ใช่' : 'ต้องปรับ'}</b> {gate.label} — {gate.why}</span>)}
      </div>
      {assessment.advice.length > 0 && (
        <div className="bp-gate-section">
          <em>ถ้าจะปรับ เริ่มจากข้อนี้</em>
          {assessment.advice.map((tip) => <span key={tip}>{tip}</span>)}
        </div>
      )}
      {assessment.sameness.length > 0 && (
        <div className="bp-gate-section">
          <em>ประโยคสำเร็จรูปและความซ้ำ</em>
          {assessment.sameness.map((item) => <span key={item.code}>{item.message}</span>)}
        </div>
      )}
      {assessment.brand && (
        <div className="bp-gate-section">
          <em>น้ำเสียงของแบรนด์ {assessment.brand.name}</em>
          {assessment.brand.warnings.length ? assessment.brand.warnings.map((item) => <span key={item}>{item}</span>) : <span>ไม่พบถ้อยคำที่ผิดน้ำเสียงของแบรนด์นี้</span>}
        </div>
      )}
      <div className="bp-gate-section">
        <em>ที่มาของคะแนนต้นฉบับ</em>
        {assessment.originality_parts.map((part) => <span key={part.key}>{part.label} {part.score}/{part.max}</span>)}
      </div>
      <div className="bp-gate-section">
        <em>ที่มาของคะแนนบรรณาธิการ</em>
        {assessment.editorial_parts.map((part) => <span key={part.key}>{part.label} {part.score}/{part.max}</span>)}
      </div>
    </details>
  )
}

// ผลด่านตรวจบนการ์ดร่าง: ตัวบล็อกแยกหมวด + ข้ออ้าง → แหล่งที่มา · สถานะความถูกต้องแยกจากคะแนนโครงสร้าง
export function GateResult({ result }) {
  if (!result) return null
  if (result.loading) return <div className="bp-gate" role="status">กำลังตรวจหลักฐานและเกณฑ์…</div>
  if (result.error) return <div className="bp-gate blocked" role="alert">{result.error}</div>
  const { gate, proof } = result
  if (!gate) return null
  const sourceTitle = (id) => (proof?.sources || []).find((source) => Number(source.id) === Number(id))?.title || `แหล่ง ${id}`
  return (
    <div className={`bp-gate ${gate.blocked ? 'blocked' : 'clear'}`} role="status" onClick={(event) => event.stopPropagation()}>
      <strong>{gate.blocked ? 'ติดเกณฑ์ ต้องแก้ก่อนอนุมัติ' : 'ไม่พบตัวบล็อก · พร้อมให้คนตรวจและอนุมัติ'}</strong>
      <span className="bp-gate-mode">{gate.mode === 'proof' ? `มีบรีฟและข้ออ้าง ${proof?.claims?.length || 0} ข้อ · ใช้ในโพสต์ ${gate.claim_ids_used.length} ข้อ` : 'ไม่มีบรีฟ: ถือเป็นความรู้ทั่วไป ผู้ตรวจต้องตรวจข้อเท็จจริงเอง'}</span>
      {GATE_SECTIONS.map((section) => (gate[section.key]?.length ? (
        <div className={`bp-gate-section ${section.blocking ? 'blocking' : ''}`} key={section.key}>
          <em>{section.label}</em>
          {gate[section.key].map((item) => <span key={item}>{item}</span>)}
        </div>
      ) : null))}
      {proof?.claims?.length > 0 && (
        <div className="bp-gate-section">
          <em>ข้ออ้าง → แหล่งที่มา</em>
          {proof.claims.map((claim, index) => {
            const info = (gate.per_claim || []).find((item) => Number(item.id) === Number(claim.id))
            return (
              <span key={claim.id}>
                {index + 1}. {claim.claim_text} — {CLAIM_TYPES[claim.claim_type]?.label} · {CLAIM_STATUS[claim.status]}
                {claim.use_in_post === false ? ' · ไม่ใช้ในโพสต์' : ''}
                {info?.sources?.length ? ` · ${info.sources.map(sourceTitle).join(', ')}` : ' · ไม่มีแหล่ง'}
              </span>
            )
          })}
        </div>
      )}
      <ScoreSummary assessment={result.assessment} />
      {result.review && <span className="bp-gate-mode">อนุมัติล่าสุดโดย {result.review.reviewer} · {new Date(result.review.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</span>}
    </div>
  )
}

// แผง "สำรวจราคาตลาด" ในหน้าประเมิน ขั้นที่ 2 (เจ้าของขอ 18 พ.ย. 2569)
// กดปุ่ม → งานเข้าคิว market_survey_jobs → คอมสำนักงานให้ Codex ค้นและเปิดหน้าประกาศรายแปลง → ตารางให้เจ้าของเลือกรายการที่ใช้
// ระบบไม่ตั้งราคาตลาดเอง: ราคาเข้าฟอร์มเมื่อเจ้าของกด "ใช้ราคากลางนี้" เท่านั้น · ราคาทั้งหมดเป็นราคาตั้งขาย
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createMarketSurvey, getMarketSurvey, cancelMarketSurvey } from '../lib/api.js'
import { ASSET_BASIS_LABEL, buildSurveyRequest, defaultSelection, dropOutOfArea, selectionBasis, summarizeSurvey, surveyRequestProblem, surveySnapshot } from '../lib/marketSurvey.js'
import './MarketSurveyPanel.css'

const baht = (n) => Math.round(Number(n) || 0).toLocaleString('th-TH')
const DISCOUNT_KEY = 'assetx_survey_discount_pct'
const POLL_MS = 6000

export default function MarketSurveyPanel({ form, update, calc, valuationId = null }) {
  const request = useMemo(() => buildSurveyRequest(form, { totalSqw: calc?.totalSqw, govPricePerSqw: calc?.weightedGovPrice }),
    [form.province, form.district, form.subdistrict, form.propertyType, form.propertySubtype, form.roadType, calc?.totalSqw, calc?.weightedGovPrice])
  const problem = surveyRequestProblem(request)
  const [job, setJob] = useState(null)
  const [worker, setWorker] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)   // null = ยังไม่ได้ตั้งต้นจากผล
  const [showRejected, setShowRejected] = useState(false)
  const [discount, setDiscount] = useState(() => { try { return localStorage.getItem(DISCOUNT_KEY) || '0' } catch { return '0' } })
  const jobId = form.marketSurveyJobId || null
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  // โหลดงานที่ผูกกับฟอร์มนี้ (หรืองานล่าสุดของรายการประเมินเดิม) แล้วถามสถานะซ้ำจนจบ
  useEffect(() => {
    let timer = null
    let stopped = false
    const load = async () => {
      try {
        const data = await getMarketSurvey(jobId ? { id: jobId } : valuationId ? { valuationId } : {})
        if (stopped || !alive.current) return
        setWorker(data.worker || null)
        if (data.job) {
          setJob(data.job)
          if (!jobId) update('marketSurveyJobId', data.job.id)
          if (['queued', 'running'].includes(data.job.status)) timer = setTimeout(load, POLL_MS)
        }
      } catch (err) { if (!stopped && alive.current) setError(err.message) }
    }
    load()
    return () => { stopped = true; clearTimeout(timer) }
  }, [jobId, valuationId])

  // ตัดประกาศนอกเขตของทรัพย์ซ้ำที่หน้าเว็บด้วย (ผลที่สำรวจก่อนมีกติกานี้ยังมีรายการนอกเขตปนอยู่) · ใช้เขตตามคำขอของงานนั้น
  const { listings, rejected } = useMemo(
    () => job?.status === 'done' ? dropOutOfArea({ listings: job.result?.listings || [], rejected: job.result?.rejected || [] }, job.request || request) : { listings: [], rejected: [] },
    [job?.id, job?.status, job?.result])
  // ตั้งต้นรายการที่เลือก: ที่เคยกดใช้ไว้ (งานเดียวกัน) > กลุ่มประเภทเดียวกับทรัพย์ที่ราคาไม่สุดโต่ง
  useEffect(() => {
    if (job?.status !== 'done') return
    const saved = form.marketSurvey?.jobId === job.id ? (form.marketSurvey.comps || []).map((c) => c.url) : null
    setSelected(saved || defaultSelection(listings, request.basis))
  }, [job?.id, job?.status])

  // รายการที่ระบบติ๊กให้ตั้งต้น — แสดงบอกเจ้าของ และใช้กับปุ่มคืนค่าเมื่อแก้ติ๊กไปแล้วจำไม่ได้
  const group = useMemo(() => selectionBasis(listings, request.basis), [listings, request.basis])
  // ทรัพย์มีสิ่งปลูกสร้างแต่เลือกเฉพาะประกาศที่ดินเปล่า → ราคาที่ได้คือราคาที่ดิน ต้องบอกให้ชัด
  const landOnly = request.basis === 'building' && (selected || []).length > 0 && listings.filter((l) => (selected || []).includes(l.url)).every((l) => l.basis === 'land')
  const suggested = useMemo(() => defaultSelection(listings, request.basis), [listings, request.basis])
  const sameAsSuggested = !!selected && selected.length === suggested.length && suggested.every((u) => selected.includes(u))
  const summary = useMemo(() => summarizeSurvey(listings, selected || [], { discountPct: discount, totalSqw: calc?.totalSqw }), [listings, selected, discount, calc?.totalSqw])
  const applied = form.marketSurvey?.jobId === job?.id && Number(form.compPrice) === summary?.mid

  const start = async () => {
    setBusy(true); setError('')
    try {
      const data = await createMarketSurvey({ valuationId, request })
      setJob(data.job); setWorker(data.worker || null); setSelected(null)
      update('marketSurveyJobId', data.job.id)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const cancel = async () => {
    setBusy(true); setError('')
    try { const data = await cancelMarketSurvey(job.id); setJob(data.job) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const toggle = (url) => setSelected((prev) => (prev || []).includes(url) ? prev.filter((u) => u !== url) : [...(prev || []), url])
  const changeDiscount = (value) => { setDiscount(value); try { localStorage.setItem(DISCOUNT_KEY, value) } catch { /* ไม่จำก็ยังใช้ได้ */ } }
  const apply = () => {
    update('compPrice', summary.mid)
    update('compSource', `ประกาศขาย ${summary.count} รายการ สำรวจ ${new Date(job.finished_at || Date.now()).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}${summary.discountPct ? ` หักต่อรอง ${summary.discountPct}%` : ''}`)
    update('marketSurvey', surveySnapshot({ jobId: job.id, surveyedAt: job.finished_at, listings, selectedUrls: selected, summary }))
  }

  const active = job && ['queued', 'running'].includes(job.status)
  const workerNote = !worker ? '' : !worker.online ? 'คอมสำนักงานยังไม่ได้เปิดตัวรับงาน งานจะรอในคิวจนกว่าจะเปิด'
    : !worker.survey ? 'ตัวรับงานบนคอมสำนักงานเป็นรุ่นเก่า ต้องปิดแล้วเปิดใหม่ก่อนจึงจะรับงานสำรวจได้' : ''

  return (
    <section className="ms" aria-label="สำรวจราคาตลาด">
      <div className="ms-head">
        <div>
          <h3 className="ms-title">สำรวจราคาตลาดจากประกาศขาย</h3>
          <p className="ms-note">AI ค้นประกาศขายในย่านเดียวกันจากหลายเว็บ นับเฉพาะประกาศรายแปลงที่เปิดหน้าได้และเห็นราคากับเนื้อที่ ใช้เวลาราว 3–10 นาที</p>
        </div>
        {!active && <button type="button" className="ms-btn" data-kind="primary" disabled={busy || !!problem} onClick={start}>{job?.status === 'done' ? 'สำรวจใหม่' : 'สำรวจราคาตลาด'}</button>}
        {job?.status === 'queued' && <button type="button" className="ms-btn" disabled={busy} onClick={cancel}>ยกเลิก</button>}
      </div>

      {problem && <p className="ms-note" data-tone="warn">{problem}</p>}
      {error && <p className="ms-note" data-tone="error" role="alert">{error}</p>}
      {active && <p className="ms-note" data-tone="warn" role="status">{job.status === 'queued' ? 'รอคิว' : 'กำลังสำรวจ'} · ทำขั้นอื่นของฟอร์มต่อได้ ผลจะขึ้นที่นี่เอง{workerNote ? ` · ${workerNote}` : ''}</p>}
      {job?.status === 'failed' && <p className="ms-note" data-tone="error" role="status">สำรวจไม่สำเร็จ: {job.error || 'ไม่ทราบสาเหตุ'}</p>}

      {job?.status === 'done' && (
        <>
          <p className="ms-note" role="status">พบ {listings.length} ประกาศ · ตัดออก {rejected.length} · กดชื่อประกาศเพื่อเปิดหน้าจริงตรวจก่อนใช้ ราคาทั้งหมดเป็นราคาตั้งขาย ไม่ใช่ราคาซื้อขายจริง</p>
          <p className="ms-note" role="status">
            ระบบติ๊กตั้งต้นให้ {suggested.length} ประกาศ ({group === 'all' ? 'ทุกประเภท' : `กลุ่ม${ASSET_BASIS_LABEL[group] || group}`}ที่ราคาไม่สุดโต่ง มีป้าย "ระบบเลือก") · ติ๊กเพิ่มหรือเอาออกเองได้
            {!sameAsSuggested && <> · <button type="button" className="ms-link" onClick={() => setSelected(suggested)}>คืนค่าที่ระบบเลือก</button></>}
          </p>
          <div className="ms-table-wrap">
            <table className="ms-table">
              <thead><tr><th scope="col">ใช้</th><th scope="col">ประกาศ</th><th scope="col">ประเภท</th><th scope="col" className="ms-num">ราคา (บาท)</th><th scope="col" className="ms-num">ตร.ว.</th><th scope="col" className="ms-num">บาท/ตร.ว.</th></tr></thead>
              <tbody>
                {[...listings].sort((a, b) => a.price_per_sqw - b.price_per_sqw).map((l) => (
                  <tr key={l.url} data-on={(selected || []).includes(l.url)}>
                    <td><input type="checkbox" aria-label={`ใช้ประกาศ ${l.title}`} checked={(selected || []).includes(l.url)} onChange={() => toggle(l.url)} /></td>
                    <td>
                      <a href={l.url} target="_blank" rel="noopener noreferrer">{l.title || l.url}</a>
                      <small>{[l.site, l.location, l.road, l.building, l.posted && `ลง ${l.posted}`].filter(Boolean).join(' · ')}</small>
                    </td>
                    <td>{ASSET_BASIS_LABEL[l.basis] || l.basis}{suggested.includes(l.url) && <span className="ms-tag">ระบบเลือก</span>}</td>
                    <td className="ms-num">{baht(l.price)}</td>
                    <td className="ms-num">{l.area_sqw}</td>
                    <td className="ms-num"><b>{baht(l.price_per_sqw)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ms-sum">
            <label className="ms-field"><span>หักส่วนลดต่อรองจากราคาตั้งขาย (%)</span><input type="number" min="0" max="60" step="1" inputMode="decimal" value={discount} onChange={(e) => changeDiscount(e.target.value)} /></label>
            {summary ? (
              <div className="ms-range" role="status">
                <div><small>ต่ำ</small><b>{baht(summary.low)}</b></div>
                <div data-mid="true"><small>กลาง</small><b>{baht(summary.mid)}</b></div>
                <div><small>สูง</small><b>{baht(summary.high)}</b></div>
                <p>บาท/ตร.ว. จาก {summary.count} ประกาศ{summary.discountPct ? ` หลังหัก ${summary.discountPct}%` : ''} · ความมั่นใจ{summary.confidence} · ทั้งแปลงราว {baht(summary.totalLow)}–{baht(summary.totalHigh)} บาท</p>
              </div>
            ) : <p className="ms-note" data-tone="warn">เลือกอย่างน้อยหนึ่งประกาศเพื่อดูช่วงราคา</p>}
          </div>
          {landOnly && <p className="ms-note" data-tone="warn">ราคานี้เป็นราคาที่ดินอย่างเดียว ยังไม่รวมค่าสิ่งปลูกสร้างของทรัพย์ ต้องบวกแยก</p>}
          {summary?.mixed &&<p className="ms-note" data-tone="warn">รายการที่เลือกมีทั้งที่ดินเปล่าและที่ดินพร้อมสิ่งปลูกสร้าง ราคาต่อตารางวาของกลุ่มหลังรวมค่าสิ่งปลูกสร้างแล้ว ควรเลือกกลุ่มเดียว</p>}
          <div className="ms-actions">
            <button type="button" className="ms-btn" data-kind="primary" disabled={!summary} onClick={apply}>{applied ? 'ใช้ราคากลางนี้แล้ว' : 'ใช้ราคากลางนี้เป็นราคาตลาด'}</button>
            {rejected.length > 0 && <button type="button" className="ms-btn" aria-expanded={showRejected} onClick={() => setShowRejected((v) => !v)}>รายการที่ตัดออก ({rejected.length})</button>}
          </div>
          {showRejected && (
            <ul className="ms-rejected">
              {rejected.map((r, i) => <li key={i}>{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}</a> : 'ไม่มีลิงก์'} — {r.reason}</li>)}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

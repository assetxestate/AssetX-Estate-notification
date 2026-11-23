// ผลวัดต่อคอนเทนต์ต่อช่องทาง + นำเข้า CSV + การทดลอง + บทเรียน ในหน้า เครื่องมือ → ตัวเลข ของ /marketing — เฟส P2 · 23 พ.ย. 2569
// ต่อจากส่วนบันทึกลีดเดิมของหน้า (ไม่แทนที่) · ตรรกะล้วนอยู่ใน src/lib/marketingPerformance.js
// ไม่มีข้อมูล ≠ ศูนย์: ช่องว่างแสดงว่า "ไม่มีข้อมูล" · ยังไม่ได้เชื่อม Insights ของแพลตฟอร์มใด จึงกรอกเองหรือนำเข้า CSV
import React, { useMemo, useState } from 'react'
import {
  DECISIONS, METRIC_FIELDS, METRIC_GROUPS, METRIC_LABELS, PLATFORMS, SOURCE_METHODS, WINDOWS,
  compareToPeers, derived, experimentReadout, learningSummary, normalizeExperiment, normalizeSnapshot, parsePerformanceCsv, summarize, upsertSnapshots,
} from '../lib/marketingPerformance.js'

const EMPTY = { content_no: '', platform: 'facebook', window: '7d', paid_or_organic: 'organic', note: '', ...Object.fromEntries(METRIC_FIELDS.map((field) => [field, ''])) }
const EMPTY_EXP = { hypothesis: '', primary_metric: 'shares', platform: 'facebook', window: '7d', a: '', b: '', labelA: '', labelB: '', confounders: '' }
const show = (value) => (value === null || value === undefined ? 'ไม่มีข้อมูล' : Number(value).toLocaleString('th-TH'))
const percent = (value) => (value === null ? 'ไม่มีข้อมูล' : `${(value * 100).toFixed(1)}%`)
const CSV_SAMPLE = 'content_no,platform,window,reach,shares,saves,comments,leads,qualified_leads\n12,facebook,7d,1200,30,12,4,2,1'

export default function PerformancePanel({ posts = [], performance = [], experiments = [], onSavePerformance, onSaveExperiments, notify }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState(null)
  const [filter, setFilter] = useState({ platform: '', window: '' })
  const [exp, setExp] = useState(EMPTY_EXP)
  const [expError, setExpError] = useState('')

  const numbered = useMemo(() => posts.filter((post) => post.contentNo).sort((a, b) => b.contentNo - a.contentNo), [posts])
  const knownNos = useMemo(() => new Set(numbered.map((post) => post.contentNo)), [numbered])
  const titleOf = (no) => numbered.find((post) => post.contentNo === no)?.title || ''
  const shown = performance.filter((item) => (!filter.platform || item.platform === filter.platform) && (!filter.window || item.window === filter.window))
  const summary = summarize(shown)
  const learning = learningSummary(performance, experiments)

  const addManual = () => {
    const result = normalizeSnapshot({ ...form, source_method: 'manual' })
    const errors = [...result.errors]
    if (result.ok && !knownNos.has(result.value.content_no)) errors.push(`ไม่พบคอนเทนต์ #${result.value.content_no}`)
    if (errors.length) { setError(errors.join(' · ')); return }
    const merged = upsertSnapshots(performance, [result.value])
    onSavePerformance?.(merged.list)
    setError('')
    setForm({ ...EMPTY, platform: form.platform, window: form.window })
    notify?.(merged.updated ? `แทนที่ผลเดิมของ #${result.value.content_no} (${PLATFORMS[result.value.platform]} · ${WINDOWS[result.value.window]})` : `บันทึกผลของ #${result.value.content_no} แล้ว`)
  }
  const readCsv = () => setPreview(parsePerformanceCsv(csv, { knownNos }))
  const importCsv = () => {
    if (!preview?.valid?.length) return
    const merged = upsertSnapshots(performance, preview.valid)
    onSavePerformance?.(merged.list)
    notify?.(`นำเข้าแล้ว: ใหม่ ${merged.added} · แทนที่ของเดิม ${merged.updated}`)
    setCsv('')
    setPreview(null)
  }
  const loadFile = async (file) => { if (file) { setCsv(await file.text()); setPreview(null) } }

  const addExperiment = () => {
    const result = normalizeExperiment({ hypothesis: exp.hypothesis, primary_metric: exp.primary_metric, platform: exp.platform, window: exp.window, confounders: exp.confounders, variants: [{ label: exp.labelA, content_nos: exp.a }, { label: exp.labelB, content_nos: exp.b }] })
    if (!result.ok) { setExpError(result.errors.join(' · ')); return }
    onSaveExperiments?.([result.value, ...experiments])
    setExp(EMPTY_EXP)
    setExpError('')
    notify?.('ตั้งการทดลองแล้ว · ผลจะอ่านได้เมื่อแต่ละแบบมีโพสต์ที่บันทึกผลครบ')
  }
  const decide = (id, decision) => onSaveExperiments?.(experiments.map((item) => (item.id === id ? { ...item, decision, decided_at: new Date().toISOString() } : item)))

  return (
    <div className="bp-perf">
      <h2 className="mx-section-title">ผลของแต่ละคอนเทนต์ แยกตามช่องทาง</h2>
      <p className="bp-note">ยังไม่ได้เชื่อมตัวเลขจากแพลตฟอร์มโดยตรง จึงกรอกเองหรือนำเข้า CSV · ช่องที่ไม่มีข้อมูลให้เว้นว่าง ระบบจะไม่นับเป็นศูนย์ · คอนเทนต์เดียวกันคนละช่องทางเป็นคนละบันทึก</p>

      <div className="bp-actions">
        <label className="bp-inline">ช่องทาง
          <select value={filter.platform} onChange={(event) => setFilter({ ...filter, platform: event.target.value })}>
            <option value="">ทุกช่องทาง</option>
            {Object.entries(PLATFORMS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="bp-inline">ช่วงวัด
          <select value={filter.window} onChange={(event) => setFilter({ ...filter, window: event.target.value })}>
            <option value="">ทุกช่วง</option>
            {Object.entries(WINDOWS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <span className="bp-note">{shown.length} บันทึก</span>
      </div>
      <div className="bp-series-grid">
        {summary.groups.map((group) => (
          <article className="bp-series-card" key={group.key}>
            <div className="bp-claim-head"><strong>{group.label}</strong></div>
            <p className="bp-note">{group.note}</p>
            {group.metrics.map((metric) => <p key={metric.field}>{metric.label}: <b>{show(metric.value)}</b>{metric.records ? <span className="bp-note"> · จาก {metric.records} บันทึก</span> : null}</p>)}
          </article>
        ))}
      </div>

      <fieldset className="bp-fieldset bp-series-add">
        <legend>บันทึกผลด้วยตนเอง</legend>
        <div className="bp-grid">
          <label>คอนเทนต์
            <select value={form.content_no} onChange={(event) => setForm({ ...form, content_no: event.target.value })}>
              <option value="">เลือกคอนเทนต์</option>
              {numbered.map((post) => <option key={post.id} value={post.contentNo}>#{post.contentNo} {String(post.title || '').slice(0, 50)}</option>)}
            </select>
          </label>
          <label>ช่องทาง
            <select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}>{Object.entries(PLATFORMS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          <label>ช่วงวัด
            <select value={form.window} onChange={(event) => setForm({ ...form, window: event.target.value })}>{Object.entries(WINDOWS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          <label>ที่มาของยอด
            <select value={form.paid_or_organic} onChange={(event) => setForm({ ...form, paid_or_organic: event.target.value })}><option value="organic">ไม่ได้ยิงโฆษณา</option><option value="paid">ยิงโฆษณา</option></select>
          </label>
        </div>
        {METRIC_GROUPS.map((group) => (
          <div className="bp-perf-inputs" key={group.key} role="group" aria-label={group.label}>
            <strong>{group.label}</strong>
            {group.fields.map((field) => (
              <label key={field}>{METRIC_LABELS[field]}
                <input type="text" inputMode="decimal" value={form[field]} placeholder="ไม่มีข้อมูล" onChange={(event) => setForm({ ...form, [field]: event.target.value })} />
              </label>
            ))}
          </div>
        ))}
        {error && <p className="bp-error" role="alert">{error}</p>}
        <div className="bp-actions"><button type="button" className="mx-primary" onClick={addManual}>บันทึกผล</button><span className="bp-note">บันทึกซ้ำคอนเทนต์ ช่องทาง และช่วงวัดเดิม = แทนที่ของเดิม</span></div>
      </fieldset>

      <fieldset className="bp-fieldset bp-series-add">
        <legend>นำเข้าจาก CSV</legend>
        <p className="bp-note">หัวตารางที่ต้องมี: content_no และ platform · หัวอื่นที่รู้จัก: window, {METRIC_FIELDS.join(', ')} (ใช้ชื่อไทยได้ เช่น เข้าถึง แชร์ บันทึก)</p>
        <div className="bp-actions">
          <input type="file" accept=".csv,text/csv,text/plain" aria-label="เลือกไฟล์ CSV" onChange={(event) => { loadFile(event.target.files?.[0]); event.target.value = '' }} />
          <button type="button" className="mx-mini-button" onClick={() => { setCsv(CSV_SAMPLE); setPreview(null) }}>ใส่ตัวอย่างรูปแบบ</button>
        </div>
        <textarea aria-label="ข้อมูล CSV" rows={4} value={csv} placeholder={CSV_SAMPLE} onChange={(event) => { setCsv(event.target.value); setPreview(null) }} />
        <div className="bp-actions"><button type="button" className="mx-secondary" disabled={!csv.trim()} onClick={readCsv}>ตรวจไฟล์ก่อนบันทึก</button></div>
        {preview && (
          <div className="bp-missing" role="status">
            <strong>{preview.error || `ใช้ได้ ${preview.valid.length} แถว จาก ${preview.rows.length} แถว`}</strong>
            {preview.unknownHeaders.length > 0 && <span>คอลัมน์ที่ไม่รู้จัก (จะไม่ถูกนำเข้า): {preview.unknownHeaders.join(', ')}</span>}
            {preview.rows.map((row) => (
              <span key={row.line}>บรรทัด {row.line}: {row.value ? `#${row.value.content_no} · ${PLATFORMS[row.value.platform]} · ${WINDOWS[row.value.window]} · ${METRIC_FIELDS.filter((field) => row.value.metrics[field] !== null).map((field) => `${METRIC_LABELS[field]} ${show(row.value.metrics[field])}`).join(' · ')}` : `ไม่นำเข้า — ${row.errors.join(' · ')}`}</span>
            ))}
            {preview.valid.length > 0 && <div className="bp-actions"><button type="button" className="mx-primary" onClick={importCsv}>นำเข้า {preview.valid.length} แถว</button></div>}
          </div>
        )}
      </fieldset>

      <h2 className="mx-section-title">บันทึกผลทั้งหมด</h2>
      {shown.length === 0 && <div className="mx-empty">ยังไม่มีบันทึกผล — ไม่มีข้อมูล ไม่ได้แปลว่าผลเป็นศูนย์</div>}
      <div className="mx-list">
        {shown.map((item) => {
          const rates = derived(item)
          const peer = compareToPeers(item, performance, 'reach')
          return (
            <article className="mx-row-card" key={item.key}>
              <div>
                <strong>#{item.content_no} {titleOf(item.content_no)}</strong>
                <span>{PLATFORMS[item.platform]} · {WINDOWS[item.window]} · {SOURCE_METHODS[item.source_method]}{item.paid_or_organic === 'paid' ? ' · ยิงโฆษณา' : ''} · เก็บ {new Date(item.collected_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })}</span>
                <span>{METRIC_FIELDS.filter((field) => item.metrics[field] !== null).map((field) => `${METRIC_LABELS[field]} ${show(item.metrics[field])}`).join(' · ')}</span>
                <span>แชร์ต่อการเข้าถึง {percent(rates.share_rate)} · บันทึกต่อการเข้าถึง {percent(rates.save_rate)} · เข้าถึงเทียบกลุ่ม: {peer.text}</span>
              </div>
              <button type="button" className="mx-mini-button danger" onClick={() => onSavePerformance?.(performance.filter((row) => row.key !== item.key))}>ลบ</button>
            </article>
          )
        })}
      </div>

      <h2 className="mx-section-title">การทดลอง</h2>
      <fieldset className="bp-fieldset bp-series-add">
        <legend>ตั้งการทดลองก่อนโพสต์</legend>
        <div className="bp-grid">
          <label className="wide">สมมติฐาน
            <input value={exp.hypothesis} maxLength={300} placeholder="เช่น เปิดด้วยข้อสังเกตหน้างานได้แชร์มากกว่าเปิดด้วยขั้นตอน" onChange={(event) => setExp({ ...exp, hypothesis: event.target.value })} />
          </label>
          <label>ตัววัดหลัก
            <select value={exp.primary_metric} onChange={(event) => setExp({ ...exp, primary_metric: event.target.value })}>{METRIC_FIELDS.map((field) => <option key={field} value={field}>{METRIC_LABELS[field]}</option>)}</select>
          </label>
          <label>ช่วงวัด
            <select value={exp.window} onChange={(event) => setExp({ ...exp, window: event.target.value })}>{Object.entries(WINDOWS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          <label>แบบ A: ชื่อ<input value={exp.labelA} maxLength={60} placeholder="เช่น ภาพหน้างานจริง" onChange={(event) => setExp({ ...exp, labelA: event.target.value })} /></label>
          <label>แบบ A: เลขคอนเทนต์ (คั่นด้วยจุลภาค)<input value={exp.a} inputMode="numeric" placeholder="12, 13, 14" onChange={(event) => setExp({ ...exp, a: event.target.value })} /></label>
          <label>แบบ B: ชื่อ<input value={exp.labelB} maxLength={60} placeholder="เช่น เสียงพากย์กับตัวหนังสือ" onChange={(event) => setExp({ ...exp, labelB: event.target.value })} /></label>
          <label>แบบ B: เลขคอนเทนต์<input value={exp.b} inputMode="numeric" placeholder="15, 16, 17" onChange={(event) => setExp({ ...exp, b: event.target.value })} /></label>
          <label className="wide">ปัจจัยอื่นที่อาจทำให้ผลต่าง (ไม่บังคับ)
            <input value={exp.confounders} maxLength={300} placeholder="เช่น โพสต์คนละวัน คนละเวลา" onChange={(event) => setExp({ ...exp, confounders: event.target.value })} />
          </label>
        </div>
        {expError && <p className="bp-error" role="alert">{expError}</p>}
        <div className="bp-actions"><button type="button" className="mx-secondary" onClick={addExperiment}>ตั้งการทดลอง</button></div>
      </fieldset>
      {experiments.map((item) => {
        const readout = experimentReadout(item, performance)
        return (
          <article className="bp-series-card bp-perf-exp" key={item.id}>
            <div className="bp-claim-head"><strong>{item.hypothesis}</strong><span className="bp-tag">{item.decision ? `ตัดสินใจ: ${DECISIONS[item.decision]}` : readout.status === 'insufficient_data' ? 'ข้อมูลไม่พอ' : 'มีทิศทางเบื้องต้น'}</span></div>
            <p>{readout.summary}</p>
            {readout.variants.map((variant) => <p className="bp-note" key={variant.label}>{variant.label}: คอนเทนต์ {variant.content_nos.map((no) => `#${no}`).join(' ')} · มีข้อมูล {variant.with_data} ชิ้น · ค่ากลาง {show(variant.median)}</p>)}
            {readout.warnings.map((warning) => <p className="bp-pack-warn" key={warning}>{warning}</p>)}
            <div className="bp-actions">
              <span className="bp-note">การตัดสินใจของเรา:</span>
              {Object.entries(DECISIONS).map(([value, label]) => <button key={value} type="button" className="mx-mini-button" aria-pressed={item.decision === value} disabled={readout.status === 'insufficient_data' && !['insufficient_data', 'retire'].includes(value)} onClick={() => decide(item.id, value)}>{label}</button>)}
            </div>
          </article>
        )
      })}

      <h2 className="mx-section-title">บทเรียนจากตัวเลขที่บันทึก</h2>
      <div className="bp-missing" role="status">
        <strong>{learning.status === 'insufficient_data' ? 'ข้อมูลไม่พอ' : 'ข้อสังเกต (ไม่ใช่ข้อสรุปเรื่องสาเหตุ)'}</strong>
        {learning.worked.map((line) => <span key={line}>ไปได้ดี: {line}</span>)}
        {learning.failed.map((line) => <span key={line}>ต่ำกว่ากลุ่ม: {line}</span>)}
        {learning.unknown.map((line) => <span key={line}>ยังไม่รู้: {line}</span>)}
        {learning.next.map((line) => <span key={line}>ทำต่อ: {line}</span>)}
        {learning.caution && <span className="bp-note">{learning.caution}</span>}
      </div>
    </div>
  )
}

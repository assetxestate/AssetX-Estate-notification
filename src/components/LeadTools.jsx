import React, { useEffect, useMemo, useState } from 'react'
import './LeadTools.css'
import { showToast } from '../lib/toast.js'
import { getLeadFiles, markLeadReplied, markInvestorSent } from '../lib/api.js'
import { POSTER_CONTACT } from '../lib/posterDesignSystem.js'
import { REPLY_RESULTS, REPLY_NEEDS, buildBrokerReply, leadTicketNo, replyHours } from '../lib/leadSource.js'
import { buildInvestorSummary, investorDefaults, waitingHours, isAssessed } from '../lib/valuationWorkflow.js'

// เครื่องมือบนการ์ดรายการประเมินในหน้านายทุน (แท็บ Lead จากเว็บ และ รอตัดสินใจ)
// เส้นทาง: รับทรัพย์ → ประเมินละเอียด (ฟอร์มเต็ม บันทึกกลับรายการเดิม) → สรุปส่งนายทุน → รอผล
// ทุกข้อความเจ้าของคัดลอกไปส่งเอง ระบบไม่ส่งถึงผู้ส่งหรือนายทุน · รูปแนบและข้อความตอบผู้ส่งมีเฉพาะ lead จากหน้า /assess
export default function LeadTools({ row, onAssess, onReplied, onSent }) {
  const isLead = !!row.leadSource
  const [panel, setPanel] = useState('')
  const [files, setFiles] = useState(null)
  const [filesError, setFilesError] = useState('')
  const [reply, setReply] = useState({ result: row.leadReplyResult || 'interested', amount: '', needs: [], note: '' })
  // ช่องของสรุปส่งนายทุน: ค่าตั้งต้นจากรายการประเมิน + ที่เจ้าของเคยกรอกไว้ในเครื่องนี้ (เงื่อนไข สิ่งปลูกสร้าง)
  const inputsKey = `assetx_investor_inputs_${row._rowIndex}`
  const [inv, setInv] = useState(() => {
    let saved = {}
    try { saved = JSON.parse(localStorage.getItem(inputsKey) || '{}') || {} } catch { /* ใช้ค่าตั้งต้น */ }
    return { ...investorDefaults(row), ...saved }
  })
  // ข้อความที่จะส่ง: ร่างจากช่องด้านบน แล้วเจ้าของแก้ต่อได้ (edited = แก้เองแล้ว ไม่ร่างทับ) · เคยส่งแล้ว = เริ่มจากข้อความที่ส่งล่าสุด
  const [draft, setDraft] = useState(row.investorSummary || '')
  const [edited, setEdited] = useState(!!row.investorSummary)
  const setField = (key, value) => setInv(prev => {
    const next = { ...prev, [key]: value }
    try { localStorage.setItem(inputsKey, JSON.stringify(next)) } catch { /* ไม่จำก็ยังใช้งานได้ */ }
    return next
  })
  const [saving, setSaving] = useState(false)

  const lead = useMemo(() => ({
    ticketNo: leadTicketNo(row._rowIndex),
    name: row.contactName,
    assessmentType: row['ประเภทการประเมิน'],
    propertySubtype: row['ประเภทย่อย'],
    subdistrict: row['ตำบล/แขวง'], district: row['อำเภอ/เขต'], province: row['จังหวัด'],
    totalSqw: row.totalSqw,
    requestedLoan: row['วงเงินที่ลูกค้าขอ'],
  }), [row])
  const replyText = useMemo(() => buildBrokerReply(lead, reply, POSTER_CONTACT), [lead, reply])
  const generated = useMemo(() => buildInvestorSummary(row, inv), [row, inv])
  useEffect(() => { if (!edited) setDraft(generated) }, [generated, edited])
  const summaryText = draft

  const waited = replyHours(row.createdAt, row.leadRepliedAt || new Date().toISOString())
  const waitInvestor = waitingHours(row.investorSentAt)
  const notes = [
    isLead && (row.leadRepliedAt
      ? { done: true, text: `ตอบผู้ส่งแล้ว: ${REPLY_RESULTS[row.leadReplyResult]?.short || 'ไม่ระบุผล'}${waited != null ? ` · ใช้เวลา ${waited} ชม.` : ''}` }
      : { done: false, text: `ยังไม่ได้ตอบผู้ส่ง${waited != null ? ` · เข้ามาแล้ว ${waited} ชม.` : ''}` }),
    row.investorSentAt
      ? { done: true, text: `ส่งสรุปให้นายทุนแล้ว${waitInvestor != null ? ` · รอผลมา ${waitInvestor} ชม.` : ''}` }
      : { done: false, text: 'ยังไม่ได้ส่งสรุปให้นายทุน' },
    { done: isAssessed(row), text: isAssessed(row) ? 'ประเมินละเอียดแล้ว' : 'ยังไม่ได้ประเมินละเอียด' },
  ].filter(Boolean)

  const loadFiles = async () => {
    if (!isLead) { setFiles([]); return }
    setFiles(null)
    setFilesError('')
    try { setFiles(await getLeadFiles(row._rowIndex)) } catch (e) { setFilesError(e.message) }
  }

  const toggle = (name) => {
    const next = panel === name ? '' : name
    setPanel(next)
    if (next === 'files') loadFiles()
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('คัดลอกข้อความแล้ว', 'success')
    } catch {
      showToast('คัดลอกอัตโนมัติไม่ได้ ให้ลากเลือกข้อความในกรอบแล้วคัดลอกเอง')
    }
  }

  const needSql = (file) => `ยังเก็บไม่ได้: ต้องรันไฟล์ ${file} ใน Supabase ก่อน`

  const markReplied = async () => {
    setSaving(true)
    try {
      const repliedAt = await markLeadReplied(row._rowIndex, reply.result)
      onReplied?.(repliedAt, reply.result)
      showToast('บันทึกเวลาที่ตอบแล้ว', 'success')
    } catch (e) {
      const missing = /lead_repl/.test(`${e.message || ''} ${e.details || ''}`)
      showToast(missing ? needSql('supabase_lead_files_reply.sql') : 'บันทึกไม่สำเร็จ: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const markSent = async () => {
    setSaving(true)
    try {
      const result = await markInvestorSent(row._rowIndex, summaryText)
      if (result.dropped.length) showToast(`ย้ายไปแท็บรอตัดสินใจแล้ว แต่เวลาที่ส่ง${needSql('supabase_valuation_workflow.sql').replace('ยังเก็บไม่ได้', 'ยังเก็บไม่ได้')}`)
      else showToast('บันทึกว่าส่งนายทุนแล้ว รายการย้ายไปแท็บรอตัดสินใจ', 'success')
      onSent?.(result.sentAt, summaryText)
    } catch (e) {
      showToast('บันทึกไม่สำเร็จ: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const setNeed = (key, on) => setReply(prev => ({ ...prev, needs: on ? [...new Set([...prev.needs, key])] : prev.needs.filter(k => k !== key) }))

  return (
    <div className="lt">
      <ul className="lt-steps">
        {notes.map(n => <li key={n.text} data-done={n.done}>{n.text}</li>)}
      </ul>
      <div className="lt-bar">
        <button type="button" className="lt-tab" data-kind="go" onClick={() => onAssess?.(row._rowIndex)}>ประเมินละเอียด</button>
        {isLead && <button type="button" className="lt-tab" aria-expanded={panel === 'files'} onClick={() => toggle('files')}>รูปแนบ</button>}
        {isLead && <button type="button" className="lt-tab" aria-expanded={panel === 'reply'} onClick={() => toggle('reply')}>ข้อความตอบผู้ส่ง</button>}
        <button type="button" className="lt-tab" aria-expanded={panel === 'investor'} onClick={() => toggle('investor')}>สรุปส่งนายทุน</button>
        {row.underwritingMemo && <button type="button" className="lt-tab" aria-expanded={panel === 'memo'} onClick={() => toggle('memo')}>ผลวิเคราะห์ AI</button>}
      </div>

      {panel === 'files' && (
        <div className="lt-panel">
          {filesError ? <p className="lt-note" data-tone="error">{filesError}</p>
            : files === null ? <p className="lt-note">กำลังเปิดรูปแนบ…</p>
              : files.length === 0 ? <p className="lt-note">รายการนี้ไม่มีรูปแนบ</p>
                : (
                  <>
                    <ul className="lt-files">
                      {files.map(f => (
                        <li key={f.name}>
                          <a href={f.url} target="_blank" rel="noreferrer">
                            <img src={f.url} alt={f.label} loading="lazy" />
                            <span>{f.label}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                    <p className="lt-note">ลิงก์รูปใช้ได้ 10 นาที ปิดแล้วเปิดใหม่ได้ กดที่รูปเพื่อดูขนาดเต็ม</p>
                  </>
                )}
        </div>
      )}

      {panel === 'reply' && (
        <div className="lt-panel">
          <div className="lt-choices" role="radiogroup" aria-label="ผลประเมินเบื้องต้น">
            {Object.entries(REPLY_RESULTS).map(([key, meta]) => (
              <button key={key} type="button" role="radio" aria-checked={reply.result === key} className="lt-choice" onClick={() => setReply(prev => ({ ...prev, result: key }))}>{meta.label}</button>
            ))}
          </div>
          {reply.result === 'interested' && (
            <label className="lt-field">
              <span>วงเงินเบื้องต้น (บาท) <small>ไม่ใส่ก็ได้</small></span>
              <input type="number" min="0" inputMode="numeric" value={reply.amount} onChange={e => setReply(prev => ({ ...prev, amount: e.target.value }))} />
            </label>
          )}
          {reply.result === 'need-info' && (
            <div className="lt-needs">
              {REPLY_NEEDS.map(n => (
                <label key={n.key}><input type="checkbox" checked={reply.needs.includes(n.key)} onChange={e => setNeed(n.key, e.target.checked)} /> {n.label}</label>
              ))}
            </div>
          )}
          <label className="lt-field">
            <span>ข้อความเพิ่มเติม <small>ไม่ใส่ก็ได้</small></span>
            <textarea rows={2} maxLength={600} value={reply.note} onChange={e => setReply(prev => ({ ...prev, note: e.target.value }))} />
          </label>
          <pre className="lt-preview">{replyText}</pre>
          <div className="lt-actions">
            <button type="button" className="lt-btn" data-kind="primary" onClick={() => copy(replyText)}>คัดลอกข้อความ</button>
            <button type="button" className="lt-btn" disabled={saving} onClick={markReplied}>{saving ? 'กำลังบันทึก…' : 'บันทึกว่าตอบแล้ว'}</button>
          </div>
          <p className="lt-note">ระบบไม่ส่งข้อความให้เอง คัดลอกไปส่งทาง LINE หรือโทรแจ้ง แล้วกดบันทึกว่าตอบแล้ว</p>
        </div>
      )}

      {panel === 'investor' && (
        <div className="lt-panel">
          {!isAssessed(row) && <p className="lt-note" data-tone="warn">รายการนี้ยังไม่ได้ประเมินละเอียด ตัวเลขในสรุปมาจากข้อมูลที่ผู้ส่งกรอกเอง ควรกด "ประเมินละเอียด" ก่อนส่งนายทุน</p>}
          <div className="lt-grid">
            <label className="lt-field"><span>ถึง <small>ชื่อนายทุน ไม่ใส่ก็ได้</small></span><input type="text" value={inv.to} onChange={e => setField('to', e.target.value)} /></label>
            <label className="lt-field"><span>หัวเรื่อง</span><input type="text" value={inv.title} onChange={e => setField('title', e.target.value)} /></label>
          </div>
          <div className="lt-grid" data-cols="4">
            <label className="lt-field"><span>วงเงินที่ขอ (บาท)</span><input type="number" min="0" step="any" inputMode="decimal" value={inv.amount} onChange={e => setField('amount', e.target.value)} /></label>
            <label className="lt-field"><span>ดอกเบี้ย (% ต่อเดือน)</span><input type="number" min="0" step="any" inputMode="decimal" value={inv.ratePct} onChange={e => setField('ratePct', e.target.value)} /></label>
            <label className="lt-field"><span>หักล่วงหน้า (เดือน)</span><input type="number" min="0" step="any" inputMode="decimal" value={inv.advanceMonths} onChange={e => setField('advanceMonths', e.target.value)} /></label>
            <label className="lt-field"><span>ปากถุง (%)</span><input type="number" min="0" step="any" inputMode="decimal" value={inv.feePct} onChange={e => setField('feePct', e.target.value)} /></label>
          </div>
          <div className="lt-grid" data-cols="4">
            <label className="lt-field"><span>อายุสัญญา <small>เช่น 1 ปี</small></span><input type="text" value={inv.term} onChange={e => setField('term', e.target.value)} /></label>
            <label className="lt-field"><span>ราคาตลาดรวม (บาท)</span><input type="number" min="0" step="any" inputMode="decimal" value={inv.marketValue} onChange={e => setField('marketValue', e.target.value)} /></label>
            <label className="lt-field"><span>ราคาบังคับขาย (บาท)</span><input type="number" min="0" step="any" inputMode="decimal" value={inv.fsv} onChange={e => setField('fsv', e.target.value)} /></label>
            <label className="lt-field"><span>วงเงินทางเลือก <small>% ของราคาราชการ</small></span><input type="number" min="0" step="any" inputMode="decimal" value={inv.altPct} onChange={e => setField('altPct', e.target.value)} /></label>
          </div>
          <div className="lt-grid">
            <label className="lt-field"><span>สิ่งปลูกสร้าง <small>ไม่มีให้เว้นว่าง</small></span><textarea rows={2} maxLength={800} value={inv.building} onChange={e => setField('building', e.target.value)} /></label>
            <label className="lt-field"><span>ราคาราชการของสิ่งปลูกสร้าง (บาท) <small>หลังหักค่าเสื่อม</small></span><input type="number" min="0" step="any" inputMode="decimal" value={inv.buildingGovValue} onChange={e => setField('buildingGovValue', e.target.value)} /></label>
          </div>
          <label className="lt-field">
            <span>ข้อความที่จะส่ง <small>{edited ? 'แก้เองแล้ว ช่องด้านบนจะไม่ร่างทับ' : 'ร่างจากช่องด้านบน พิมพ์แก้ต่อได้'}</small></span>
            <textarea className="lt-draft" rows={18} value={draft} onChange={e => { setDraft(e.target.value); setEdited(true) }} />
          </label>
          <div className="lt-actions">
            <button type="button" className="lt-btn" data-kind="primary" onClick={() => copy(summaryText)}>คัดลอกสรุป</button>
            <button type="button" className="lt-btn" disabled={saving || !summaryText.trim()} onClick={markSent}>{saving ? 'กำลังบันทึก…' : row.investorSentAt ? 'บันทึกว่าส่งอีกครั้ง' : 'บันทึกว่าส่งนายทุนแล้ว'}</button>
            {edited && <button type="button" className="lt-btn" onClick={() => { setEdited(false); setDraft(generated) }}>ร่างใหม่จากช่องด้านบน</button>}
          </div>
          <p className="lt-note">สรุปไม่มีชื่อ เบอร์ หรือ LINE ของลูกค้าและนายหน้า ระบบไม่ส่งให้เอง คัดลอกไปส่งนายทุน แล้วกดบันทึก รายการจะย้ายไปแท็บ "รอตัดสินใจ" พร้อมเก็บข้อความที่ส่งไว้</p>
        </div>
      )}

      {panel === 'memo' && (
        <div className="lt-panel">
          <pre className="lt-preview">{row.underwritingMemo}</pre>
          <div className="lt-actions">
            <button type="button" className="lt-btn" onClick={() => copy(row.underwritingMemo)}>คัดลอกผลวิเคราะห์</button>
          </div>
          <p className="lt-note">ผลวิเคราะห์ภายในจาก AI ใช้ประกอบการตัดสินใจ ไม่ใช่รายงานประเมินรับรอง</p>
        </div>
      )}
    </div>
  )
}

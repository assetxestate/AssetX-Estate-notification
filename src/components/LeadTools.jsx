import React, { useMemo, useState } from 'react'
import './LeadTools.css'
import { showToast } from '../lib/toast.js'
import { getLeadFiles, markLeadReplied } from '../lib/api.js'
import { POSTER_CONTACT } from '../lib/posterDesignSystem.js'
import { REPLY_RESULTS, REPLY_NEEDS, buildBrokerReply, leadTicketNo, replyHours } from '../lib/leadSource.js'

// เครื่องมือบนการ์ด lead จากหน้า /assess: ดูรูปแนบ (ลิงก์ชั่วคราวหลังล็อกอิน) และสร้างข้อความตอบผลเบื้องต้น
// เจ้าของคัดลอกข้อความไปส่งเอง ระบบไม่ส่งข้อความถึงผู้ส่ง · "บันทึกว่าตอบแล้ว" เก็บเวลาไว้วัดว่าตอบภายในวันหรือไม่
export default function LeadTools({ row, onReplied }) {
  const [panel, setPanel] = useState('')
  const [files, setFiles] = useState(null)
  const [filesError, setFilesError] = useState('')
  const [reply, setReply] = useState({ result: row.leadReplyResult || 'interested', amount: '', needs: [], note: '' })
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
  const text = useMemo(() => buildBrokerReply(lead, reply, POSTER_CONTACT), [lead, reply])

  const waited = replyHours(row.createdAt, row.leadRepliedAt || new Date().toISOString())
  const status = row.leadRepliedAt
    ? `ตอบแล้ว: ${REPLY_RESULTS[row.leadReplyResult]?.short || 'ไม่ระบุผล'}${waited != null ? ` · ใช้เวลา ${waited} ชม.` : ''}`
    : `ยังไม่ได้ตอบ${waited != null ? ` · เข้ามาแล้ว ${waited} ชม.` : ''}`

  const toggle = async (name) => {
    const next = panel === name ? '' : name
    setPanel(next)
    if (next !== 'files') return
    setFiles(null)
    setFilesError('')
    try { setFiles(await getLeadFiles(row._rowIndex)) } catch (e) { setFilesError(e.message) }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('คัดลอกข้อความแล้ว')
    } catch {
      showToast('คัดลอกอัตโนมัติไม่ได้ ให้ลากเลือกข้อความในกรอบแล้วคัดลอกเอง')
    }
  }

  const markReplied = async () => {
    setSaving(true)
    try {
      const repliedAt = await markLeadReplied(row._rowIndex, reply.result)
      onReplied?.(repliedAt, reply.result)
      showToast('บันทึกเวลาที่ตอบแล้ว')
    } catch (e) {
      const missing = /lead_repl/.test(`${e.message || ''} ${e.details || ''}`)
      showToast(missing ? 'ยังบันทึกไม่ได้: ต้องรันไฟล์ supabase_lead_files_reply.sql ใน Supabase ก่อน' : 'บันทึกไม่สำเร็จ: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const setNeed = (key, on) => setReply(prev => ({ ...prev, needs: on ? [...new Set([...prev.needs, key])] : prev.needs.filter(k => k !== key) }))

  return (
    <div className="lt">
      <div className="lt-bar">
        <span className="lt-status" data-done={!!row.leadRepliedAt}>{status}</span>
        <button type="button" className="lt-tab" aria-expanded={panel === 'files'} onClick={() => toggle('files')}>รูปแนบ</button>
        <button type="button" className="lt-tab" aria-expanded={panel === 'reply'} onClick={() => toggle('reply')}>ข้อความตอบผล</button>
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
          <pre className="lt-preview">{text}</pre>
          <div className="lt-actions">
            <button type="button" className="lt-btn" data-kind="primary" onClick={copy}>คัดลอกข้อความ</button>
            <button type="button" className="lt-btn" disabled={saving} onClick={markReplied}>{saving ? 'กำลังบันทึก…' : 'บันทึกว่าตอบแล้ว'}</button>
          </div>
          <p className="lt-note">ระบบไม่ส่งข้อความให้เอง คัดลอกไปส่งทาง LINE หรือโทรแจ้ง แล้วกดบันทึกว่าตอบแล้ว</p>
        </div>
      )}
    </div>
  )
}

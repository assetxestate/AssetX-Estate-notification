import React, { useMemo, useState } from 'react'
import './BrokerRegistry.css'
import { showToast } from '../lib/toast.js'
import { brokerAction } from '../lib/api.js'
import { BROKER_STATUS, brokerLink, brokerStats, phoneKey, recruitLink } from '../lib/brokers.js'

// ทะเบียนนายหน้า (หน้านายทุน → แท็บ นายหน้า)
// ตัวตนของนายหน้า = เบอร์โทรที่เขากรอกในหน้า /assess · ลิงก์เป็นแค่ทางเข้า ใช้ลิงก์เดียวกันหลายคนได้
// จำนวนงานนับจากรายการ lead (rows) · brokers = แถวจากตาราง brokers (null = ยังโหลดไม่ได้/ยังไม่ได้รัน SQL)
const dateText = (iso) => {
  const d = new Date(iso)
  return iso && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'
}

async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); showToast(done) } catch { showToast('คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกเอง') }
}

export default function BrokerRegistry({ rows, brokers, error, missingTable, onChanged }) {
  const origin = window.location.origin
  const [channel, setChannel] = useState('fb')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name: '', phone: '', line: '', code: '', note: '' })
  const [editing, setEditing] = useState(null) // { id, name, line, note }
  const [merging, setMerging] = useState(null) // { id, into }

  const list = brokers || []
  const stats = useMemo(() => brokerStats(list, rows), [list, rows])
  const mergedOf = useMemo(() => {
    const map = new Map()
    for (const b of list) if (b.merged_into != null) map.set(Number(b.merged_into), [...(map.get(Number(b.merged_into)) || []), b])
    return map
  }, [list])

  const run = async (action, payload, done) => {
    setBusy(true)
    try {
      const result = await brokerAction(action, payload)
      if (done) showToast(typeof done === 'function' ? done(result) : done)
      await onChanged()
      return result
    } catch (e) {
      showToast(e.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const submitNew = async (event) => {
    event.preventDefault()
    if (!phoneKey(draft.phone)) { showToast('เบอร์โทรไม่ถูกต้อง (ต้องเป็นเบอร์ไทย 9–10 หลัก)'); return }
    const result = await run('create', draft, 'เพิ่มนายหน้าแล้ว')
    if (result) { setDraft({ name: '', phone: '', line: '', code: '', note: '' }); setAdding(false) }
  }

  const recruit = recruitLink(origin, channel)

  return (
    <div className="br">
      <section className="br-box">
        <h3>ลิงก์สำหรับโพสต์หานายหน้า</h3>
        <p className="br-note">ใช้ลิงก์เดียวกันได้ทุกคน ระบบแยกนายหน้าแต่ละคนจากเบอร์โทรที่เขากรอก และเพิ่มคนใหม่เข้าทะเบียนให้เอง</p>
        <label className="br-field">
          <span>ช่องทางที่จะโพสต์ (ไว้ดูว่านายหน้ามาจากโพสต์ไหน)</span>
          <input value={channel} maxLength={40} onChange={e => setChannel(e.target.value)} placeholder="เช่น fb, fb-group, line" />
        </label>
        <code className="br-link">{recruit}</code>
        <div className="br-actions">
          <button type="button" className="br-btn" data-kind="primary" onClick={() => copy(recruit, 'คัดลอกลิงก์แล้ว')}>คัดลอกลิงก์</button>
        </div>
      </section>

      {missingTable && (
        <p className="br-alert">ยังไม่ได้ติดตั้งทะเบียนนายหน้า: รันไฟล์ supabase_brokers.sql ใน Supabase หนึ่งครั้ง ระหว่างนี้รายชื่อด้านล่างสรุปจากเบอร์โทรในรายการที่ส่งเข้ามา ยังแก้ไขหรือออกลิงก์ส่วนตัวไม่ได้</p>
      )}
      {error && !missingTable && <p className="br-alert">{error}</p>}

      {!missingTable && !error && (
        <div className="br-actions">
          <button type="button" className="br-btn" aria-expanded={adding} onClick={() => setAdding(v => !v)}>เพิ่มนายหน้าเอง</button>
          {stats.unregistered.length > 0 && (
            <button type="button" className="br-btn" disabled={busy} onClick={() => run('sync', {}, r => `เพิ่มเข้าทะเบียน ${r.added} คน`)}>
              เพิ่มคนที่เคยส่งงานเข้าทะเบียน ({stats.unregistered.length})
            </button>
          )}
        </div>
      )}

      {adding && (
        <form className="br-box br-form" onSubmit={submitNew}>
          <label className="br-field"><span>ชื่อ</span><input required value={draft.name} maxLength={120} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
          <label className="br-field"><span>เบอร์โทร</span><input required inputMode="tel" value={draft.phone} maxLength={30} onChange={e => setDraft({ ...draft, phone: e.target.value })} /></label>
          <label className="br-field"><span>LINE ID</span><input value={draft.line} maxLength={60} onChange={e => setDraft({ ...draft, line: e.target.value })} /></label>
          <label className="br-field"><span>รหัสในลิงก์ (เว้นว่าง = ระบบออกให้)</span><input value={draft.code} maxLength={40} onChange={e => setDraft({ ...draft, code: e.target.value })} /></label>
          <label className="br-field br-wide"><span>บันทึก</span><input value={draft.note} maxLength={500} onChange={e => setDraft({ ...draft, note: e.target.value })} /></label>
          <div className="br-actions br-wide"><button type="submit" className="br-btn" data-kind="primary" disabled={busy}>บันทึก</button></div>
        </form>
      )}

      {stats.registered.length === 0 && stats.unregistered.length === 0 && (
        <p className="br-empty">ยังไม่มีนายหน้าในทะเบียน คนแรกจะถูกเพิ่มเองเมื่อมีนายหน้าส่งทรัพย์ผ่านลิงก์</p>
      )}

      <ul className="br-list">
        {stats.registered.map(({ broker, count, cancelled, lastAt, tickets, phones }) => {
          const link = brokerLink(origin, broker.code)
          const extra = mergedOf.get(Number(broker.id)) || []
          const isEditing = editing?.id === broker.id
          const isMerging = merging?.id === broker.id
          const others = stats.registered.filter(s => s.broker.id !== broker.id)
          return (
            <li key={broker.id} className="br-card" data-status={broker.status}>
              <div className="br-head">
                <strong>{broker.name || 'ไม่ระบุชื่อ'}</strong>
                <span className="br-code">{broker.code}</span>
                <span className="br-tag" data-status={broker.status}>{BROKER_STATUS[broker.status]?.label || broker.status}</span>
              </div>
              <div className="br-meta">
                <span>โทร {broker.phone || phones[0] || '—'}</span>
                {broker.line_id && <span>LINE {broker.line_id}</span>}
                <span>ส่งมา {count} ทรัพย์{cancelled > 0 ? ` (ยกเลิกอีก ${cancelled})` : ''}</span>
                <span>ล่าสุด {dateText(lastAt)}</span>
              </div>
              {tickets.length > 0 && <div className="br-tickets">{tickets.slice(0, 12).join(' · ')}{tickets.length > 12 ? ' …' : ''}</div>}
              {extra.length > 0 && (
                <div className="br-merged">
                  เบอร์สำรอง: {extra.map(m => (
                    <span key={m.id}>{m.phone || m.phone_key} <button type="button" className="br-linkbtn" disabled={busy} onClick={() => run('unmerge', { id: m.id }, 'แยกรายชื่อแล้ว')}>แยกออก</button></span>
                  ))}
                </div>
              )}
              {broker.note && !isEditing && <p className="br-note">{broker.note}</p>}
              {BROKER_STATUS[broker.status]?.hint && <p className="br-note" data-tone="warn">{BROKER_STATUS[broker.status].hint}</p>}

              <div className="br-actions">
                <button type="button" className="br-btn" onClick={() => copy(link, `คัดลอกลิงก์ของ ${broker.name || broker.code} แล้ว`)}>คัดลอกลิงก์ส่วนตัว</button>
                {broker.status !== 'active' && <button type="button" className="br-btn" disabled={busy} onClick={() => run('update', { id: broker.id, status: 'active' }, 'บันทึกแล้ว')}>คุยแล้ว รับงานได้</button>}
                {broker.status !== 'paused' && <button type="button" className="br-btn" disabled={busy} onClick={() => run('update', { id: broker.id, status: 'paused' }, 'พักรายชื่อนี้แล้ว')}>พักไว้</button>}
                <button type="button" className="br-btn" aria-expanded={isEditing} onClick={() => setEditing(isEditing ? null : { id: broker.id, name: broker.name, line: broker.line_id, note: broker.note })}>แก้ไข</button>
                {others.length > 0 && <button type="button" className="br-btn" aria-expanded={isMerging} onClick={() => setMerging(isMerging ? null : { id: broker.id, into: '' })}>รวมกับรายชื่ออื่น</button>}
              </div>

              {isEditing && (
                <form className="br-form" onSubmit={async (event) => { event.preventDefault(); if (await run('update', editing, 'บันทึกแล้ว')) setEditing(null) }}>
                  <label className="br-field"><span>ชื่อ</span><input required value={editing.name} maxLength={120} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
                  <label className="br-field"><span>LINE ID</span><input value={editing.line} maxLength={60} onChange={e => setEditing({ ...editing, line: e.target.value })} /></label>
                  <label className="br-field br-wide"><span>บันทึก</span><input value={editing.note} maxLength={500} onChange={e => setEditing({ ...editing, note: e.target.value })} /></label>
                  <div className="br-actions br-wide"><button type="submit" className="br-btn" data-kind="primary" disabled={busy}>บันทึก</button></div>
                </form>
              )}

              {isMerging && (
                <div className="br-form">
                  <label className="br-field br-wide">
                    <span>รายชื่อนี้เป็นคนเดียวกับ (เบอร์ของรายชื่อนี้จะกลายเป็นเบอร์สำรอง งานที่ส่งมานับรวมกัน)</span>
                    <select value={merging.into} onChange={e => setMerging({ ...merging, into: e.target.value })}>
                      <option value="">เลือกรายชื่อ</option>
                      {others.map(s => <option key={s.broker.id} value={s.broker.id}>{s.broker.name || 'ไม่ระบุชื่อ'} · {s.broker.code} · {s.broker.phone}</option>)}
                    </select>
                  </label>
                  <div className="br-actions br-wide">
                    <button type="button" className="br-btn" data-kind="primary" disabled={busy || !merging.into} onClick={async () => { if (await run('merge', { id: broker.id, into: Number(merging.into) }, 'รวมรายชื่อแล้ว')) setMerging(null) }}>รวมรายชื่อ</button>
                  </div>
                </div>
              )}
            </li>
          )
        })}

        {stats.unregistered.map((entry) => (
          <li key={entry.phone} className="br-card" data-status="loose">
            <div className="br-head">
              <strong>{entry.name || 'ไม่ระบุชื่อ'}</strong>
              <span className="br-tag" data-status="new">ยังไม่อยู่ในทะเบียน</span>
            </div>
            <div className="br-meta">
              <span>โทร {entry.phone}</span>
              <span>ส่งมา {entry.count} ทรัพย์{entry.cancelled > 0 ? ` (ยกเลิกอีก ${entry.cancelled})` : ''}</span>
              <span>ล่าสุด {dateText(entry.lastAt)}</span>
            </div>
            {entry.tickets.length > 0 && <div className="br-tickets">{entry.tickets.slice(0, 12).join(' · ')}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}

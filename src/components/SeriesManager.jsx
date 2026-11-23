// หน้าจัดการซีรีส์ประจำ (เครื่องมือ → ซีรีส์) ของ /marketing — เฟส P1 · 23 พ.ย. 2569
// แสดงซีรีส์ตั้งต้น 7 ชุด + ของเจ้าของ: เรื่องที่เล่า หลักฐานที่ต้องมี จำนวนตอน ตอนล่าสุด และรายการตอน · เพิ่ม/พักซีรีส์ของตัวเองได้
// ตรรกะล้วนอยู่ใน src/lib/marketingSeries.js
import React, { useState } from 'react'
import { normalizeCustomSeries, seriesOverview } from '../lib/marketingSeries.js'

const STATUS = { draft: 'รอตรวจ', pending: 'รอตรวจ', needs_edit: 'รอตรวจ', approved: 'อนุมัติแล้ว', scheduled: 'ตั้งเวลาแล้ว', posted: 'โพสต์แล้ว', archived: 'พักไว้' }
const thaiDate = (value) => (value ? new Date(value).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }) : '')

export default function SeriesManager({ posts = [], customSeries = [], onAddSeries, onToggleSeries, onOpenPost }) {
  const [form, setForm] = useState({ name: '', thesis: '', evidence: '' })
  const [error, setError] = useState('')
  const rows = seriesOverview(posts, customSeries)

  const add = () => {
    const result = normalizeCustomSeries(form, rows)
    if (!result.ok) { setError(result.errors.join(' · ')); return }
    onAddSeries?.(result.value)
    setForm({ name: '', thesis: '', evidence: '' })
    setError('')
  }

  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">ซีรีส์</div>
          <h1>ซีรีส์ประจำของเพจ</h1>
          <p>ซีรีส์คือเรื่องที่เล่าต่อเนื่องเป็นตอน ให้คนจำได้ว่าเพจนี้เล่าเรื่องแบบนี้ · เลือกซีรีส์ให้ร่างได้ที่การ์ดในแท็บ ร่าง · ตอนใหม่ต้องมีมุมหรือข้อมูลใหม่</p>
        </div>
      </div>
      <div className="bp-series-grid">
        {rows.map((series) => (
          <article className={`bp-series-card ${series.paused ? 'paused' : ''}`} key={series.id}>
            <div className="bp-claim-head">
              <strong>{series.name}</strong>
              <span className="bp-tag">{series.total ? `${series.total} ตอน · โพสต์แล้ว ${series.posted}` : 'ยังไม่มีตอน'}{series.paused ? ' · พักไว้' : ''}</span>
            </div>
            <p>{series.thesis}</p>
            {series.evidence && <p className="bp-note">หลักฐานที่ควรมี: {series.evidence}</p>}
            {series.lastPostedAt && <p className="bp-note">โพสต์ล่าสุด {thaiDate(series.lastPostedAt)}</p>}
            {series.episodes.length > 0 && (
              <ol className="bp-series-episodes">
                {series.episodes.map((post) => (
                  <li key={post.id} value={post.episodeNo}>
                    <button type="button" onClick={() => onOpenPost?.(post)}>{post.contentNo ? `#${post.contentNo} ` : ''}{post.title || 'ไม่มีพาดหัว'}</button>
                    <span>{STATUS[post.status] || post.status}</span>
                  </li>
                ))}
              </ol>
            )}
            {series.custom && <button type="button" className="mx-mini-button" onClick={() => onToggleSeries?.(series.id)}>{series.paused ? 'เปิดใช้อีกครั้ง' : 'พักซีรีส์นี้'}</button>}
          </article>
        ))}
      </div>
      <fieldset className="bp-fieldset bp-series-add">
        <legend>เพิ่มซีรีส์ของเราเอง</legend>
        <div className="bp-grid">
          <label>ชื่อซีรีส์
            <input value={form.name} maxLength={60} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>หลักฐานที่ควรมีทุกตอน (ไม่บังคับ)
            <input value={form.evidence} maxLength={240} onChange={(event) => setForm({ ...form, evidence: event.target.value })} />
          </label>
          <label className="wide">ซีรีส์นี้เล่าเรื่องอะไร
            <textarea rows={2} value={form.thesis} maxLength={240} onChange={(event) => setForm({ ...form, thesis: event.target.value })} />
          </label>
        </div>
        {error && <p className="bp-error" role="alert">{error}</p>}
        <div className="bp-actions"><button type="button" className="mx-secondary" onClick={add}>เพิ่มซีรีส์</button></div>
      </fieldset>
    </section>
  )
}

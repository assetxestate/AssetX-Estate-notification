// คลิปที่ตัดต่อเสร็จของคอนเทนต์หนึ่งชิ้น: แนบไฟล์ ดูคลิป และส่งขึ้นเพจ Facebook เป็น Reel (เจ้าของขอ 24 พ.ย. 2569)
// ข้อมูลอยู่ที่ post.clip ของโพสต์ (ตำแหน่งไฟล์เท่านั้น ไฟล์อยู่ใน bucket ปิด) · ตรรกะล้วน src/lib/marketingClip.js · API /api/marketing-clip
// แทนที่คลิปหลังส่งแล้วได้ (เช่น พบจุดต้องแก้ในคลิปที่โพสต์ไป): Reel เดิมถูกเก็บเป็นประวัติ และหน้าจอบอกให้ไปลบที่ Facebook — ระบบลบให้ไม่ได้
// การเผยแพร่เป็นสาธารณะและถอนคืนจากหน้านี้ไม่ได้ จึงต้องกดยืนยันทุกครั้ง (ขั้นยืนยันอยู่ในหน้า ไม่ใช้ window.confirm:
//   เบราว์เซอร์ฝังในแอป Claude ปิดกล่องแบบนั้นเองทันที ปุ่มจึงกดแล้วเงียบ — เจอจริงตอนส่ง Reel แรก 24 พ.ย. 2569) · ส่งได้ครั้งเดียวต่อคลิป (กันโพสต์ซ้ำ)
import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { CLIP_MIME, REEL_DESCRIPTION_MAX, checkClipFile, checkReelDescription, clipRecord, formatBytes, replaceClip } from '../lib/marketingClip.js'

const REEL_STATE = { uploaded: 'ส่งไฟล์ให้ Facebook แล้ว ยังไม่เผยแพร่', processing: 'Facebook กำลังประมวลผล', published: 'เผยแพร่บนเพจแล้ว', scheduled: 'ตั้งเวลาไว้บน Facebook', draft: 'เป็นฉบับร่างบน Facebook', error: 'Facebook ประมวลผลไม่สำเร็จ' }

async function api(url, body) {
  const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง')
  return data
}

// อ่านความยาวและขนาดภาพจากไฟล์ด้วยตัวเล่นวิดีโอของเบราว์เซอร์ (อ่านไม่ได้ = null ไม่บล็อก)
function readVideoMeta(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const finish = (meta) => { URL.revokeObjectURL(url); resolve(meta) }
    video.preload = 'metadata'
    video.onloadedmetadata = () => finish({ duration: video.duration, width: video.videoWidth, height: video.videoHeight })
    video.onerror = () => finish(null)
    setTimeout(() => finish(null), 8000)
    video.src = url
  })
}

export default function ClipPanel({ post, loading = false, onSaveClip }) {
  const clip = post?.clip || null
  const reel = clip?.reel || null
  const fileInput = useRef(null)
  const [status, setStatus] = useState(null) // { ready, facebook }
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState([])
  const [viewUrl, setViewUrl] = useState('')
  const [description, setDescription] = useState('')
  const [aiGenerated, setAiGenerated] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [replacing, setReplacing] = useState(false)

  useEffect(() => {
    let alive = true
    api('/api/marketing-clip?status=1').then((data) => { if (alive) setStatus(data) }).catch(() => { if (alive) setStatus({ ready: false, facebook: false }) })
    return () => { alive = false }
  }, [])
  useEffect(() => { setViewUrl(''); setError(''); setWarnings([]); setBusy(''); setConfirming(false); setReplacing(false); setDescription(post?.clip?.reel?.description || post?.clip?.previous?.at(-1)?.description || post?.caption || '') }, [post?.id])

  if (!post) return null
  const locked = loading || Boolean(busy)
  const save = (next, message) => onSaveClip?.(post, next, message)
  const text = checkReelDescription(description)

  const upload = async (file) => {
    if (!file) return
    setError(''); setWarnings([]); setReplacing(false)
    try {
      setBusy('กำลังตรวจไฟล์')
      const meta = await readVideoMeta(file)
      const check = checkClipFile({ type: file.type, size: file.size }, meta)
      if (!check.ok) { setError(check.problems.join(' · ')); return }
      setWarnings(check.warnings)
      setBusy(`กำลังอัปโหลด ${formatBytes(file.size)} — อย่าปิดหน้านี้`)
      const ticket = await api('/api/marketing-clip', { action: 'upload-url', contentNo: post.contentNo, bytes: file.size, type: file.type })
      const sent = await supabase.storage.from(ticket.bucket).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: CLIP_MIME })
      if (sent.error) throw new Error('อัปโหลดคลิปไม่สำเร็จ ลองใหม่อีกครั้ง')
      // อ่านกลับจากที่เก็บก่อนผูกกับโพสต์: ขนาดต้องตรงกับไฟล์ต้นทาง
      setBusy('กำลังตรวจไฟล์ในที่เก็บ')
      const stored = await api(`/api/marketing-clip?path=${encodeURIComponent(ticket.path)}`)
      if (stored.bytes && stored.bytes !== file.size) throw new Error('ไฟล์ในที่เก็บมีขนาดไม่ตรงกับต้นทาง ลองอัปโหลดใหม่')
      save(replaceClip(clip, clipRecord({ path: ticket.path, bytes: file.size, name: file.name, ...(meta || {}) })), clip ? 'เปลี่ยนคลิปของคอนเทนต์นี้แล้ว' : 'แนบคลิปกับคอนเทนต์นี้แล้ว')
      setViewUrl(stored.url)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const view = async () => {
    setError('')
    try { setBusy('กำลังเปิดคลิป'); setViewUrl((await api(`/api/marketing-clip?path=${encodeURIComponent(clip.path)}`)).url) } catch (err) { setError(err.message) } finally { setBusy('') }
  }

  const sendReel = async () => {
    if (!text.ok) return
    setConfirming(false)
    setError('')
    let videoId = reel?.videoId || ''
    try {
      if (!videoId) {
        setBusy('กำลังส่งไฟล์ให้ Facebook')
        videoId = (await api('/api/marketing-clip', { action: 'reel-upload', path: clip.path })).videoId
        // บันทึกรหัสทันที: ถ้าขั้นเผยแพร่ล้ม กดอีกครั้งจะไม่ส่งไฟล์ซ้ำ
        save({ ...clip, reel: { videoId, state: 'uploaded', description: text.description, aiGenerated, sentAt: new Date().toISOString() } }, '')
      }
      setBusy('กำลังเผยแพร่')
      await api('/api/marketing-clip', { action: 'reel-publish', videoId, description: text.description, aiGenerated, confirmed: true })
      save({ ...clip, reel: { videoId, state: 'processing', description: text.description, aiGenerated, sentAt: new Date().toISOString() } }, 'ส่ง Reel ให้ Facebook แล้ว กำลังประมวลผล กดตรวจสถานะในอีกสักครู่')
    } catch (err) {
      setError(err.message)
    } finally { setBusy('') }
  }

  const check = async () => {
    setError('')
    try {
      setBusy('กำลังตรวจสถานะกับ Facebook')
      const now = await api(`/api/marketing-clip?reel=${encodeURIComponent(reel.videoId)}`)
      save({ ...clip, reel: { ...reel, state: now.state, permalink: now.permalink || reel.permalink || null, checkedAt: new Date().toISOString() } }, now.message)
    } catch (err) { setError(err.message) } finally { setBusy('') }
  }

  const sent = reel && reel.state !== 'uploaded'
  return (
    <div className="bp-series-card bp-clip">
      <div className="bp-claim-head"><strong>คลิปที่ตัดต่อเสร็จ</strong>{clip && <span className="bp-tag">{reel ? REEL_STATE[reel.state] || reel.state : 'ยังไม่ได้ส่ง Facebook'}</span>}</div>
      {status && !status.ready && <p className="bp-pack-warn">ที่เก็บคลิปยังไม่พร้อมใช้ ลองโหลดหน้านี้ใหม่</p>}
      {!clip && <p>แนบไฟล์คลิปที่ตัดต่อเสร็จแล้ว (.mp4 แนวตั้ง 9:16) เพื่อเก็บไว้กับคอนเทนต์นี้ และส่งขึ้นเพจเป็น Reel ได้จากหน้านี้</p>}
      {clip && <p>{clip.name || 'คลิป'} · {[formatBytes(clip.bytes), clip.duration ? `${clip.duration} วินาที` : '', clip.width && clip.height ? `${clip.width}x${clip.height}` : ''].filter(Boolean).join(' · ')} · แนบเมื่อ {new Date(clip.uploadedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
      <input ref={fileInput} type="file" accept="video/mp4" hidden onChange={(event) => upload(event.target.files?.[0])} />
      <div className="bp-actions">
        {!sent && <button type="button" className={clip ? 'mx-secondary' : 'mx-primary'} disabled={locked || !status?.ready} onClick={() => fileInput.current?.click()}>{clip ? 'เปลี่ยนไฟล์คลิป' : 'เลือกไฟล์คลิป'}</button>}
        {clip && !viewUrl && <button type="button" className="mx-secondary" disabled={locked} onClick={view}>ดูคลิป</button>}
        {sent && !replacing && <button type="button" className="mx-secondary" disabled={locked || !status?.ready} onClick={() => setReplacing(true)}>แทนที่ด้วยคลิปใหม่</button>}
        {busy && <span className="bp-note" role="status">{busy}…</span>}
      </div>
      {replacing && (
        <div className="bp-ai-status warn" role="alertdialog" aria-label="ยืนยันการแทนที่คลิป">
          <span>Reel ของคลิปเดิมยังอยู่บน Facebook ระบบลบให้ไม่ได้ ลบที่ Facebook ก่อนเผยแพร่คลิปใหม่ ไม่อย่างนั้นเพจจะมีคลิปซ้ำ</span>
          <button type="button" disabled={locked} onClick={() => fileInput.current?.click()}>เลือกไฟล์คลิปใหม่</button>
          <button type="button" disabled={locked} onClick={() => setReplacing(false)}>ยกเลิก</button>
        </div>
      )}
      {(clip?.previous || []).length > 0 && (
        <p className="bp-pack-warn">Reel ของคลิปก่อนหน้า (ลบที่ Facebook ถ้ายังไม่ได้ลบ): {clip.previous.map((item, index) => (item.permalink ? <a key={item.videoId || index} href={item.permalink} target="_blank" rel="noreferrer noopener"> เปิด Reel เดิม{clip.previous.length > 1 ? ` ${index + 1}` : ''}</a> : <span key={item.videoId || index}> รหัส {item.videoId}</span>))}</p>
      )}
      {warnings.map((item) => <p className="bp-pack-warn" key={item}>{item}</p>)}
      {error && <p className="bp-error" role="alert">{error}</p>}
      {viewUrl && <video className="bp-clip-player" src={viewUrl} controls playsInline preload="metadata" />}

      {clip && (
        <div className="bp-gate-section">
          <em>ส่งขึ้นเพจ Facebook เป็น Reel</em>
          {status && !status.facebook && <span className="bp-pack-warn">ยังไม่ได้ตั้งค่าการเชื่อมต่อ Facebook ของระบบ</span>}
          {!sent && (
            <>
              <label>ข้อความใต้คลิป
                <textarea rows={6} maxLength={REEL_DESCRIPTION_MAX} value={description} disabled={locked || confirming} onChange={(event) => setDescription(event.target.value)} />
              </label>
              <span className="bp-note">ตั้งต้นจากแคปชั่นของโพสต์ · ข้อความที่แก้ที่นี่ผ่านด่านคำของแบรนด์ก่อนส่ง แต่ไม่ผ่านขั้นตรวจหลักฐานและอนุมัติของโพสต์ ให้ตรงกับข้อความที่อนุมัติแล้ว</span>
              {!text.ok && description.trim() && text.notes.map((item) => <span className="bp-pack-warn" key={item}>{item}</span>)}
              <label className="bp-check"><input type="checkbox" checked={aiGenerated} disabled={locked} onChange={(event) => setAiGenerated(event.target.checked)} />คลิปนี้มีภาพหรือเสียงที่สร้างด้วย AI (แจ้ง Facebook ให้ติดป้ายตามนโยบาย)</label>
              {!confirming && (
                <div className="bp-actions">
                  <button type="button" className="mx-primary" disabled={locked || !text.ok || !status?.facebook} onClick={() => setConfirming(true)}>{reel?.state === 'uploaded' ? 'เผยแพร่ Reel (ส่งไฟล์แล้ว)' : 'เผยแพร่เป็น Reel บนเพจ'}</button>
                  <span className="bp-note">เผยแพร่ทันที เป็นสาธารณะ · ยังตั้งเวลาจากหน้านี้ไม่ได้</span>
                </div>
              )}
              {confirming && (
                <div className="bp-ai-status warn" role="alertdialog" aria-label="ยืนยันการเผยแพร่">
                  <span>คลิปนี้จะขึ้นเพจ Facebook เป็น Reel ทันที ทุกคนเห็นได้ และลบได้จาก Facebook เท่านั้น</span>
                  <button type="button" disabled={locked} onClick={sendReel}>ยืนยัน เผยแพร่เลย</button>
                  <button type="button" disabled={locked} onClick={() => setConfirming(false)}>ยกเลิก</button>
                </div>
              )}
            </>
          )}
          {sent && (
            <>
              <span>{REEL_STATE[reel.state] || reel.state} · ส่งเมื่อ {new Date(reel.sentAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}{reel.checkedAt ? ` · ตรวจล่าสุด ${new Date(reel.checkedAt).toLocaleTimeString('th-TH', { timeStyle: 'short' })}` : ''}</span>
              <div className="bp-actions">
                <button type="button" className="mx-secondary" disabled={locked} onClick={check}>ตรวจสถานะกับ Facebook</button>
                {reel.permalink && <a className="mx-mini-button" href={reel.permalink} target="_blank" rel="noreferrer noopener">เปิด Reel บน Facebook</a>}
              </div>
              <span className="bp-note">ส่งได้ครั้งเดียวต่อคลิปเพื่อกันโพสต์ซ้ำ · ลบหรือแก้ข้อความของ Reel ทำที่ Facebook · จะเปลี่ยนตัวคลิปให้กด แทนที่ด้วยคลิปใหม่</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

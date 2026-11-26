// คลิปที่ตัดต่อเสร็จของคอนเทนต์หนึ่งชิ้น: แนบไฟล์ ดูคลิป และส่งขึ้นเพจ Facebook เป็น Reel (เจ้าของขอ 24 พ.ย. 2569)
// ข้อมูลอยู่ที่ post.clip ของโพสต์ (ตำแหน่งไฟล์เท่านั้น ไฟล์อยู่ใน bucket ปิด) · ตรรกะล้วน src/lib/marketingClip.js · API /api/marketing-clip
// แทนที่คลิปหลังส่งแล้วได้ (เช่น พบจุดต้องแก้ในคลิปที่โพสต์ไป): Reel เดิมถูกเก็บเป็นประวัติ และหน้าจอบอกให้ไปลบที่ Facebook — ระบบลบให้ไม่ได้
// การเผยแพร่เป็นสาธารณะและถอนคืนจากหน้านี้ไม่ได้ จึงต้องกดยืนยันทุกครั้ง (ขั้นยืนยันอยู่ในหน้า ไม่ใช้ window.confirm:
//   เบราว์เซอร์ฝังในแอป Claude ปิดกล่องแบบนั้นเองทันที ปุ่มจึงกดแล้วเงียบ — เจอจริงตอนส่ง Reel แรก 24 พ.ย. 2569) · ส่งได้ครั้งเดียวต่อคลิป (กันโพสต์ซ้ำ)
// เมื่อระบบตรวจหลักฐานเปิด (status.approval): Reel ต้องผ่านตรวจหลักฐานและมีบันทึกการอนุมัติของคนก่อนเผยแพร่ (26 พ.ย. 2569)
//   การอนุมัติผูกกับข้อความใต้คลิป + ไฟล์คลิป + ข้ออ้างของโพสต์ · เซิร์ฟเวอร์ตรวจซ้ำตอนส่งไฟล์และตอนเผยแพร่ · clip.reelApproval เป็นแค่บันทึกย่อให้หน้าจอ
// ตั้งเวลา (26 พ.ย. 2569): ใส่วันและเวลา = ตั้งเวลาบน Facebook แทนการเผยแพร่ทันที (ล่วงหน้า 15 นาทีถึง 28 วัน) · ยกเลิกหรือเปลี่ยนเวลาทำที่ Facebook
//   เวลาไม่อยู่ในแฮชการอนุมัติ · เพดาน 30 Reel ต่อ 24 ชั่วโมงของ API นับจากรายการในเวิร์กสเปซ (posts) ถึงเพดาน = ปุ่มปิด
import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { CLIP_MIME, REEL_DESCRIPTION_MAX, REEL_SCHEDULE_MAX_MS, REEL_SCHEDULE_MIN_MS, checkClipFile, checkReelDescription, clipRecord, formatBytes, localInputToIso, parseReelSchedule, reelApprovalMatches, reelGatePayload, reelQuota, replaceClip } from '../lib/marketingClip.js'
import { approveContent, checkGate, storeReviewer, storedReviewer } from '../lib/marketingProofApi.js'
import { GateResult } from './BriefProofPanel.jsx'

const REEL_STATE = { uploaded: 'ส่งไฟล์ให้ Facebook แล้ว ยังไม่เผยแพร่', processing: 'Facebook กำลังประมวลผล', published: 'เผยแพร่บนเพจแล้ว', scheduled: 'ตั้งเวลาไว้บน Facebook', draft: 'เป็นฉบับร่างบน Facebook', error: 'Facebook ประมวลผลไม่สำเร็จ' }

const thaiWhen = (value) => new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
// ค่าของช่อง datetime-local ตามเวลาเครื่อง
const localInput = (ms) => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16) }

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

export default function ClipPanel({ post, posts = [], loading = false, onSaveClip }) {
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
  const [gateResult, setGateResult] = useState(null) // { loading | error | gate, proof }
  const [reviewer, setReviewer] = useState(storedReviewer)
  const [watched, setWatched] = useState(false)
  const [scheduleInput, setScheduleInput] = useState('') // ค่าของช่อง datetime-local · ว่าง = เผยแพร่ทันที

  useEffect(() => {
    let alive = true
    api('/api/marketing-clip?status=1').then((data) => { if (alive) setStatus(data) }).catch(() => { if (alive) setStatus({ ready: false, facebook: false }) })
    return () => { alive = false }
  }, [])
  // ข้อความหรือไฟล์เปลี่ยน = ผลตรวจและคำยืนยันเดิมใช้ไม่ได้
  useEffect(() => { setGateResult(null); setWatched(false); setConfirming(false) }, [description, post?.clip?.path])
  useEffect(() => { setConfirming(false) }, [scheduleInput])
  useEffect(() => { setViewUrl(''); setError(''); setWarnings([]); setBusy(''); setConfirming(false); setReplacing(false); setScheduleInput(''); setDescription(post?.clip?.reel?.description || post?.clip?.previous?.at(-1)?.description || post?.caption || '') }, [post?.id])

  if (!post) return null
  const locked = loading || Boolean(busy)
  const save = (next, message) => onSaveClip?.(post, next, message)
  const text = checkReelDescription(description)
  // ต้องมีบันทึกการอนุมัติไหม (ธงตรวจหลักฐานเปิด) · อนุมัติแล้ว = ฉบับที่อนุมัติตรงกับข้อความและไฟล์ตอนนี้
  const needsApproval = Boolean(status?.approval)
  const approved = needsApproval && reelApprovalMatches(clip, description)
  const payload = () => reelGatePayload(post, { description: text.description, clipPath: clip.path })
  // เวลาที่ตั้ง (ว่าง = ทันที) และจำนวน Reel ที่ส่งผ่านระบบรอบเวลานั้น
  const schedule = parseReelSchedule(localInputToIso(scheduleInput))
  const quota = reelQuota(posts, schedule.ok && schedule.at ? schedule.at : Date.now())

  const checkEvidence = async () => {
    setError('')
    setGateResult({ loading: true })
    try {
      const data = await checkGate(payload(), post.briefId || null)
      setGateResult({ gate: data.gate, proof: data.proof })
    } catch (err) { setGateResult({ error: err.message }) }
  }

  const approveReel = async () => {
    const name = reviewer.trim()
    if (!name || !watched || !text.ok) return
    setError('')
    const approvedText = text.description
    const approvedPath = clip.path
    try {
      setBusy('กำลังบันทึกการอนุมัติ')
      const data = await approveContent(payload(), { reviewer: name, briefId: post.briefId || null, watched: true })
      storeReviewer(name)
      setGateResult((current) => ({ gate: data.gate, proof: current?.proof || null }))
      save({ ...clip, reelApproval: { reviewId: data.review.id, reviewer: data.review.reviewer, at: data.review.created_at, path: approvedPath, description: approvedText } }, 'อนุมัติ Reel นี้แล้ว · เผยแพร่ได้')
    } catch (err) {
      if (err.gate) setGateResult({ gate: err.gate, proof: err.proof || null })
      setError(err.message)
    } finally { setBusy('') }
  }

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
    // ตรวจเวลาซ้ำตอนกดยืนยัน: หน้าอาจเปิดค้างจนเวลาที่ตั้งใกล้เกินไป
    const when = parseReelSchedule(localInputToIso(scheduleInput))
    if (!text.ok || (needsApproval && !approved) || quota.full) return
    if (!when.ok) { setConfirming(false); setError(when.note); return }
    setConfirming(false)
    setError('')
    let videoId = reel?.videoId || ''
    try {
      if (!videoId) {
        setBusy('กำลังส่งไฟล์ให้ Facebook')
        videoId = (await api('/api/marketing-clip', { action: 'reel-upload', path: clip.path, ...(needsApproval ? { post: payload() } : {}) })).videoId
        // บันทึกรหัสทันที: ถ้าขั้นเผยแพร่ล้ม กดอีกครั้งจะไม่ส่งไฟล์ซ้ำ
        save({ ...clip, reel: { videoId, state: 'uploaded', description: text.description, aiGenerated, sentAt: new Date().toISOString() } }, '')
      }
      setBusy(when.at ? 'กำลังตั้งเวลา' : 'กำลังเผยแพร่')
      const result = await api('/api/marketing-clip', { action: 'reel-publish', videoId, description: text.description, aiGenerated, confirmed: true, ...(when.at ? { scheduledAt: when.iso } : {}), ...(needsApproval ? { post: payload() } : {}) })
      const base = { videoId, description: text.description, aiGenerated, sentAt: new Date().toISOString() }
      if (when.at) save({ ...clip, reel: { ...base, state: 'scheduled', scheduledAt: result.scheduledAt || when.iso } }, `ตั้งเวลา Reel บน Facebook แล้ว · จะเผยแพร่ ${thaiWhen(when.at)}`)
      else save({ ...clip, reel: { ...base, state: 'processing' } }, 'ส่ง Reel ให้ Facebook แล้ว กำลังประมวลผล กดตรวจสถานะในอีกสักครู่')
    } catch (err) {
      setError(err.message)
    } finally { setBusy('') }
  }

  const check = async () => {
    setError('')
    try {
      setBusy('กำลังตรวจสถานะกับ Facebook')
      const now = await api(`/api/marketing-clip?reel=${encodeURIComponent(reel.videoId)}`)
      save({ ...clip, reel: { ...reel, state: now.state, scheduledAt: now.scheduledAt || reel.scheduledAt || null, permalink: now.permalink || reel.permalink || null, checkedAt: new Date().toISOString() } }, now.message)
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
              {needsApproval
                ? <span className="bp-note">ตั้งต้นจากแคปชั่นของโพสต์ · ข้อความนี้และไฟล์คลิปต้องผ่านการตรวจหลักฐานและอนุมัติก่อนเผยแพร่ แก้ข้อความหรือเปลี่ยนคลิปหลังอนุมัติต้องอนุมัติใหม่</span>
                : <span className="bp-note">ตั้งต้นจากแคปชั่นของโพสต์ · ข้อความที่แก้ที่นี่ผ่านด่านคำของแบรนด์ก่อนส่ง แต่ไม่ผ่านขั้นตรวจหลักฐานและอนุมัติของโพสต์ ให้ตรงกับข้อความที่อนุมัติแล้ว</span>}
              {!text.ok && description.trim() && text.notes.map((item) => <span className="bp-pack-warn" key={item}>{item}</span>)}
              <label className="bp-check"><input type="checkbox" checked={aiGenerated} disabled={locked} onChange={(event) => setAiGenerated(event.target.checked)} />คลิปนี้มีภาพหรือเสียงที่สร้างด้วย AI (แจ้ง Facebook ให้ติดป้ายตามนโยบาย)</label>
              {needsApproval && !approved && (
                <>
                  <div className="bp-actions">
                    <button type="button" className="mx-secondary" disabled={locked || !text.ok || gateResult?.loading} onClick={checkEvidence}>ตรวจหลักฐาน</button>
                    <span className="bp-note">ระบบตรวจได้เฉพาะข้อความใต้คลิป เสียงและตัวหนังสือในคลิปผู้ตรวจต้องดูเอง</span>
                  </div>
                  <GateResult result={gateResult} />
                  {gateResult?.gate && !gateResult.gate.blocked && (
                    <>
                      <label>ชื่อผู้ตรวจ
                        <input type="text" maxLength={80} value={reviewer} disabled={locked} onChange={(event) => setReviewer(event.target.value)} />
                      </label>
                      <label className="bp-check"><input type="checkbox" checked={watched} disabled={locked} onChange={(event) => setWatched(event.target.checked)} />ดูคลิปนี้จนจบแล้ว: คำพูดและตัวหนังสือในคลิปไม่ขัดกับข้อความที่ตรวจ และไม่มีรูปเอกสารสิทธิ์จริงหรือข้อมูลลูกค้า</label>
                      <div className="bp-actions">
                        <button type="button" className="mx-primary" disabled={locked || !reviewer.trim() || !watched} onClick={approveReel}>อนุมัติ Reel นี้</button>
                      </div>
                    </>
                  )}
                </>
              )}
              {approved && <span className="bp-note" role="status">อนุมัติแล้วโดย {clip.reelApproval.reviewer} เมื่อ {new Date(clip.reelApproval.at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} · ระบบตรวจบันทึกนี้ซ้ำตอนส่ง</span>}
              <label>ตั้งเวลาเผยแพร่ (เว้นว่าง = เผยแพร่ทันที)
                <input type="datetime-local" value={scheduleInput} disabled={locked || confirming} min={localInput(Date.now() + REEL_SCHEDULE_MIN_MS)} max={localInput(Date.now() + REEL_SCHEDULE_MAX_MS)} onChange={(event) => setScheduleInput(event.target.value)} />
              </label>
              {!schedule.ok && <span className="bp-pack-warn">{schedule.note}</span>}
              {schedule.ok && schedule.at && <span className="bp-note">Facebook จะเผยแพร่เอง {thaiWhen(schedule.at)} · ยกเลิกหรือเปลี่ยนเวลาหลังตั้งแล้วทำที่ Facebook</span>}
              {quota.full
                ? <span className="bp-pack-warn">ส่ง Reel ผ่านระบบครบ {quota.limit} ชิ้นในรอบ 24 ชั่วโมงของเวลานี้แล้ว (เพดานของ Facebook) เลือกเวลาอื่นหรือรอ</span>
                : quota.used > 0 && <span className="bp-note">Reel ที่ส่งผ่านระบบในรอบ 24 ชั่วโมงของเวลานี้: {quota.used} จาก {quota.limit} ชิ้น</span>}
              {!confirming && (
                <div className="bp-actions">
                  <button type="button" className="mx-primary" disabled={locked || !text.ok || !status?.facebook || !schedule.ok || quota.full || (needsApproval && !approved)} onClick={() => setConfirming(true)}>{schedule.at ? 'ตั้งเวลา Reel บนเพจ' : reel?.state === 'uploaded' ? 'เผยแพร่ Reel (ส่งไฟล์แล้ว)' : 'เผยแพร่เป็น Reel บนเพจ'}</button>
                  <span className="bp-note">{schedule.at ? 'ถึงเวลาแล้วเป็นสาธารณะ' : 'เผยแพร่ทันที เป็นสาธารณะ'}</span>
                </div>
              )}
              {confirming && (
                <div className="bp-ai-status warn" role="alertdialog" aria-label="ยืนยันการเผยแพร่">
                  <span>{schedule.at ? `คลิปนี้จะขึ้นเพจ Facebook เป็น Reel เมื่อ ${thaiWhen(schedule.at)} ทุกคนเห็นได้ ยกเลิกหรือลบได้จาก Facebook เท่านั้น` : 'คลิปนี้จะขึ้นเพจ Facebook เป็น Reel ทันที ทุกคนเห็นได้ และลบได้จาก Facebook เท่านั้น'}</span>
                  <button type="button" disabled={locked} onClick={sendReel}>{schedule.at ? 'ยืนยัน ตั้งเวลาเลย' : 'ยืนยัน เผยแพร่เลย'}</button>
                  <button type="button" disabled={locked} onClick={() => setConfirming(false)}>ยกเลิก</button>
                </div>
              )}
            </>
          )}
          {sent && (
            <>
              <span>{REEL_STATE[reel.state] || reel.state}{reel.state === 'scheduled' && reel.scheduledAt ? ` · จะเผยแพร่ ${thaiWhen(reel.scheduledAt)}` : ''} · ส่งเมื่อ {new Date(reel.sentAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}{reel.checkedAt ? ` · ตรวจล่าสุด ${new Date(reel.checkedAt).toLocaleTimeString('th-TH', { timeStyle: 'short' })}` : ''}</span>
              <div className="bp-actions">
                <button type="button" className="mx-secondary" disabled={locked} onClick={check}>ตรวจสถานะกับ Facebook</button>
                {reel.permalink && <a className="mx-mini-button" href={reel.permalink} target="_blank" rel="noreferrer noopener">เปิด Reel บน Facebook</a>}
              </div>
              <span className="bp-note">ส่งได้ครั้งเดียวต่อคลิปเพื่อกันโพสต์ซ้ำ · ลบ แก้ข้อความ ยกเลิกหรือเปลี่ยนเวลาที่ตั้งไว้ของ Reel ทำที่ Facebook · จะเปลี่ยนตัวคลิปให้กด แทนที่ด้วยคลิปใหม่</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

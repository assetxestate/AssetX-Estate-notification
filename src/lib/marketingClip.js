// คลิปวิดีโอของคอนเทนต์ในหน้า /marketing (เจ้าของขอ 24 พ.ย. 2569: แนบคลิปกับโพสต์ และส่งขึ้นเพจเป็น Reel จากในแอป) — ตรรกะล้วน
// ไฟล์คลิปอยู่ใน bucket ปิด marketing-clips · ในเวิร์กสเปซเก็บแค่ตำแหน่งไฟล์ที่ post.clip (ไม่ฝังไฟล์ ไม่อยู่ในแฮชการอนุมัติ)
// คลิปใหญ่เกินเพดานคำขอของเซิร์ฟเวอร์ (4.5 MB) จึงอัปโหลดจากเบราว์เซอร์ตรงเข้าที่เก็บไฟล์ด้วยลิงก์อัปโหลดแบบเซ็นชื่อ
// ฝั่งเซิร์ฟเวอร์: server/marketing-clip.js
import { checkText, formatWarnings } from './marketing-model/rules.js'
import { stripEmoji } from './captionEmoji.js'

// เพดานไฟล์ของที่เก็บไฟล์ในโปรเจกต์นี้คือ 50 MB (สร้าง bucket ที่ 100 MB ถูกปฏิเสธ — ลองจริง 24 พ.ย. 2569)
export const CLIP_MAX_BYTES = 50 * 1024 * 1024
export const CLIP_MIME = 'video/mp4'
// ข้อกำหนดของ Reels (เอกสาร Meta · อ่าน 24 พ.ย. 2569): แนวตั้ง 9:16 · 3–90 วินาที · อย่างน้อย 540x960
export const REEL_MIN_SEC = 3
export const REEL_MAX_SEC = 90
export const REEL_MIN_WIDTH = 540
export const REEL_MIN_HEIGHT = 960
export const REEL_DESCRIPTION_MAX = 2200

const CLIP_PATH = /^clips\/c\d{1,6}-\d{13}\.mp4$/
export const isClipPath = (value) => typeof value === 'string' && CLIP_PATH.test(value)
export const clipPathFor = (contentNo, now = Date.now()) => {
  const no = Number(contentNo)
  if (!Number.isInteger(no) || no < 1 || no > 999999) return ''
  return `clips/c${no}-${String(Math.floor(now)).padStart(13, '0')}.mp4`
}
export const clipContentNo = (path) => (isClipPath(path) ? Number(path.match(/^clips\/c(\d+)-/)[1]) : null)

// ตรวจไฟล์ก่อนอัปโหลด — meta = { duration, width, height } จากตัวเล่นวิดีโอของเบราว์เซอร์ (ไม่มี = ตรวจได้แค่ชนิดและขนาด)
export function checkClipFile({ type, size } = {}, meta = null) {
  const problems = []
  const warnings = []
  if (String(type || '').toLowerCase() !== CLIP_MIME) problems.push('ต้องเป็นไฟล์ .mp4')
  if (!Number.isFinite(size) || size <= 0) problems.push('ไฟล์ว่างหรืออ่านขนาดไม่ได้')
  else if (size > CLIP_MAX_BYTES) problems.push(`ไฟล์ใหญ่เกิน ${Math.round(CLIP_MAX_BYTES / 1024 / 1024)} MB`)
  if (meta) {
    const { duration, width, height } = meta
    if (Number.isFinite(duration) && (duration < REEL_MIN_SEC || duration > REEL_MAX_SEC)) warnings.push(`ยาว ${duration.toFixed(1)} วินาที — Reels รับ ${REEL_MIN_SEC}–${REEL_MAX_SEC} วินาที`)
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      if (width < REEL_MIN_WIDTH || height < REEL_MIN_HEIGHT) warnings.push(`ขนาด ${width}x${height} — Reels ต้องการอย่างน้อย ${REEL_MIN_WIDTH}x${REEL_MIN_HEIGHT}`)
      if (Math.abs(width / height - 9 / 16) > 0.02) warnings.push(`สัดส่วน ${width}x${height} ไม่ใช่แนวตั้ง 9:16`)
    }
  }
  return { ok: problems.length === 0, problems, warnings }
}

// ข้อความใต้ Reel: ผ่านด่านคำของแบรนด์ชุดเดียวกับแคปชั่น (คำเกินจริง อัตรา ความเร็วอนุมัติ ฯลฯ) — ตรวจจากข้อความที่ถอดอีโมจิแล้ว
export function checkReelDescription(text) {
  const description = String(text ?? '').replace(/\r\n/g, '\n').trim()
  if (!description) return { ok: false, description, notes: ['ยังไม่มีข้อความใต้คลิป'] }
  if (description.length > REEL_DESCRIPTION_MAX) return { ok: false, description, notes: [`ข้อความยาวเกิน ${REEL_DESCRIPTION_MAX} ตัวอักษร`] }
  const findings = checkText(stripEmoji(description), 'ข้อความใต้คลิป')
  const blocking = findings.filter((item) => ['block', 'warn'].includes(item.severity))
  return { ok: blocking.length === 0, description, notes: formatWarnings(blocking) }
}

const phase = (value) => String(value?.status || '').toLowerCase()
const done = (value) => ['complete', 'completed'].includes(phase(value))

// ย่อสถานะวิดีโอจาก Graph API (GET /{video-id}?fields=status) เป็นสถานะเดียวที่หน้าจอแสดง
// state: published · scheduled · draft · processing · error
export function summarizeReelStatus(status = {}) {
  const publishing = status.publishing_phase || {}
  const failed = [status.uploading_phase, status.processing_phase, publishing].find((item) => phase(item) === 'error')
  const videoStatus = String(status.video_status || '').toLowerCase()
  if (failed || ['error', 'upload_failed', 'expired'].includes(videoStatus)) {
    const detail = failed?.error?.message || failed?.errors?.[0]?.message || ''
    return { state: 'error', message: `Facebook ประมวลผลคลิปไม่สำเร็จ${detail ? `: ${String(detail).slice(0, 200)}` : ''}` }
  }
  const publishStatus = String(publishing.publish_status || '').toLowerCase()
  if (done(publishing) && publishStatus === 'published') return { state: 'published', message: 'เผยแพร่บนเพจแล้ว' }
  if (publishStatus === 'scheduled') return { state: 'scheduled', message: 'ตั้งเวลาไว้บน Facebook' }
  if (done(publishing) && publishStatus === 'draft') return { state: 'draft', message: 'เป็นฉบับร่างบน Facebook ยังไม่เผยแพร่' }
  return { state: 'processing', message: 'Facebook กำลังประมวลผลคลิป ยังไม่ขึ้นหน้าเพจ' }
}

// รายการคลิปที่เก็บใน post.clip — เก็บเฉพาะช่องที่รู้จัก
export function clipRecord({ path, bytes, name, duration, width, height, uploadedAt } = {}) {
  if (!isClipPath(path)) return null
  const num = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null)
  return {
    path,
    bytes: num(bytes),
    name: String(name || '').replace(/[\r\n]/g, ' ').slice(0, 120),
    duration: num(duration) ? Math.round(Number(duration) * 10) / 10 : null,
    width: num(width),
    height: num(height),
    uploadedAt: uploadedAt || new Date().toISOString(),
    reel: null,
  }
}

// แทนที่คลิปเดิมด้วยคลิปใหม่: Reel ที่ส่งไปแล้วของคลิปเดิมถูกเก็บเป็นประวัติ (previous · ล่าสุดอยู่ท้าย · เก็บ 5 รายการ)
// ระบบลบ Reel บน Facebook ให้ไม่ได้ ประวัตินี้จึงเป็นที่เดียวที่บอกว่ามี Reel เก่าค้างอยู่ให้คนไปลบ
export const PREVIOUS_MAX = 5
export function replaceClip(oldClip, record) {
  if (!record) return null
  const history = Array.isArray(oldClip?.previous) ? oldClip.previous.filter((item) => item && isClipPath(item.path)) : []
  const reel = oldClip?.reel
  const sent = reel?.videoId && reel.state !== 'uploaded'
  const entry = sent ? [{ path: oldClip.path, name: String(oldClip.name || '').slice(0, 120), videoId: String(reel.videoId), permalink: reel.permalink || null, sentAt: reel.sentAt || null, scheduledAt: reel.scheduledAt || null, state: reel.state || null, description: String(reel.description || '').slice(0, REEL_DESCRIPTION_MAX) }] : []
  const previous = [...history, ...entry].slice(-PREVIOUS_MAX)
  return previous.length ? { ...record, previous } : record
}

// ── การอนุมัติ Reel (ต่อเข้ากับขั้นตรวจหลักฐานของโพสต์ · 26 พ.ย. 2569) ──
// Reel มีบันทึกการอนุมัติของตัวเอง แยกจากโพสต์ (รหัส "<id ของโพสต์>#reel") เพราะข้อความใต้คลิปและไฟล์คลิปไม่ใช่ของชุดเดียวกับโพสต์
// แฮชผูก: ข้อความใต้คลิป + ตำแหน่งไฟล์คลิป (ชื่อไฟล์มีเวลา ไม่ถูกเขียนทับ) + บรีฟและข้ออ้างของโพสต์ — แก้ข้อใดข้อหนึ่ง = ต้องอนุมัติใหม่
// ชุดนี้ต้องเป็นชุดเดียวกันทั้งตอนตรวจ อนุมัติ ส่งไฟล์ และเผยแพร่ (เซิร์ฟเวอร์เทียบแฮชจากชุดนี้)
export const REEL_KIND = 'reel'
const cleanDescription = (value) => String(value ?? '').replace(/\r\n/g, '\n').trim()
export const reelReviewId = (contentId) => `${String(contentId ?? '')}#reel`
export function reelGatePayload(post = {}, { description = '', clipPath = '' } = {}) {
  return {
    id: String(post.id ?? ''),
    kind: REEL_KIND,
    contentNo: post.contentNo || null,
    title: post.title || post.headline || '',
    caption: cleanDescription(description),
    videoScript: '',
    topic: post.topic || '',
    channel: 'facebook',
    mediaAssetId: String(clipPath || ''),
    draftSource: post.draftSource || undefined,
  }
}
// บันทึกย่อของการอนุมัติที่เก็บกับคลิป (ให้หน้าจอรู้ว่าอนุมัติฉบับไหนไว้ — ตัวตัดสินจริงคือบันทึกบนเซิร์ฟเวอร์)
export const reelApprovalMatches = (clip, description) => {
  const approval = clip?.reelApproval
  return Boolean(approval?.reviewId && approval.path === clip.path && approval.description === cleanDescription(description))
}

// ── ตั้งเวลา Reel และเพดานจำนวนต่อวัน (26 พ.ย. 2569 · เอกสาร Reels Publishing ของ Meta อ่านวันเดียวกัน) ──
// ตั้งเวลา: video_state=SCHEDULED + scheduled_publish_time (วินาที Unix) · เอกสารกำหนด "มากกว่า 10 นาที และภายใน 29 วัน"
// เผื่อขอบไว้ทั้งสองด้าน: อย่างน้อย 15 นาที (การส่งไฟล์และตรวจบันทึกใช้เวลา) และไม่เกิน 28 วัน
export const REEL_SCHEDULE_MIN_MS = 15 * 60 * 1000
export const REEL_SCHEDULE_MAX_MS = 28 * 24 * 60 * 60 * 1000
// รับเฉพาะเวลาที่ระบุเขตเวลาครบ (หน้าจอส่ง toISOString) — เวลาที่ไม่มีเขตเวลาจะถูกเซิร์ฟเวอร์ตีความเป็น UTC ผิดไป 7 ชั่วโมง
const ZONED_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/
// คืน { ok, at, unix, iso, note } · ค่าว่าง = ไม่ตั้งเวลา (ok และ at เป็น null)
export function parseReelSchedule(value, now = Date.now()) {
  const raw = String(value ?? '').trim()
  if (!raw) return { ok: true, at: null, unix: null, iso: null, note: '' }
  const at = ZONED_TIME.test(raw) ? Date.parse(raw) : NaN
  if (!Number.isFinite(at)) return { ok: false, at: null, unix: null, iso: null, note: 'วันและเวลาที่ตั้งไม่ถูกต้อง' }
  if (at < now + REEL_SCHEDULE_MIN_MS) return { ok: false, at, unix: null, iso: null, note: 'ตั้งเวลาล่วงหน้าอย่างน้อย 15 นาที' }
  if (at > now + REEL_SCHEDULE_MAX_MS) return { ok: false, at, unix: null, iso: null, note: 'ตั้งเวลาล่วงหน้าได้ไม่เกิน 28 วัน' }
  return { ok: true, at, unix: Math.floor(at / 1000), iso: new Date(at).toISOString(), note: '' }
}
// ค่าของช่อง datetime-local (เวลาเครื่อง ไม่มีเขตเวลา) → ISO ที่มีเขตเวลา · อ่านไม่ได้คืนค่าเดิมให้ตัวตรวจปฏิเสธ
export function localInputToIso(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const at = new Date(raw).getTime()
  return Number.isFinite(at) ? new Date(at).toISOString() : raw
}

// เพดานของ Reels API: 30 รายการที่เผยแพร่ผ่าน API ใน 24 ชั่วโมงแบบเลื่อน (เอกสารไม่บอกว่า Reel ที่ตั้งเวลานับตอนไหน)
// เซิร์ฟเวอร์ไม่เก็บสถานะ จึงนับจากรายการในเวิร์กสเปซ: Reel ทุกชิ้นที่ส่งผ่านระบบนี้ (รวมของคลิปที่ถูกแทนที่) ที่เวลาเผยแพร่
// (เวลาที่ตั้ง หรือเวลาที่ส่ง) อยู่ห่างจากเวลาที่จะเผยแพร่ไม่ถึง 24 ชั่วโมง ทั้งก่อนและหลัง — นับเกินได้ ไม่นับขาด
// Reel ที่โพสต์เองบน Facebook ไม่อยู่ในเพดานนี้และระบบไม่เห็น · ตัวตัดสินสุดท้ายคือ Facebook
export const REEL_DAILY_LIMIT = 30
const DAY_MS = 24 * 60 * 60 * 1000
const reelTime = (item) => { const at = Date.parse(item?.scheduledAt || item?.sentAt || ''); return Number.isFinite(at) ? at : null }
export function reelPublishTimes(posts = []) {
  const times = []
  for (const post of Array.isArray(posts) ? posts : []) {
    const clip = post?.clip
    if (!clip) continue
    if (clip.reel?.videoId && clip.reel.state !== 'uploaded') times.push(reelTime(clip.reel))
    for (const item of Array.isArray(clip.previous) ? clip.previous : []) if (item?.videoId) times.push(reelTime(item))
  }
  return times.filter((at) => at !== null)
}
export function reelQuota(posts = [], at = Date.now()) {
  const used = reelPublishTimes(posts).filter((time) => Math.abs(time - at) < DAY_MS).length
  return { used, limit: REEL_DAILY_LIMIT, left: Math.max(0, REEL_DAILY_LIMIT - used), full: used >= REEL_DAILY_LIMIT }
}

export const formatBytes = (bytes) => (Number.isFinite(bytes) && bytes > 0 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '')

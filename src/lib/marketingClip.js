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

export const formatBytes = (bytes) => (Number.isFinite(bytes) && bytes > 0 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '')

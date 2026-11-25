// server/accounting-inbox.js — กล่องรับเอกสารบัญชีของเจ้าของ (สลิป ใบเสร็จ เอกสารสแกน) จากเทเลแกรมและ LINE
//
// ทางเดิน (เจ้าของขอ 25 พ.ย. 2569: ส่งรูปเข้าแชตแล้วให้ระบบเก็บเอง ไม่ต้องเปิดคอมค้างไว้):
//   เทเลแกรม: รูป/ไฟล์ (jpg · png · pdf) ที่ส่งเข้าห้องบอท AssetX และไม่ใช่ "รูปตัวอย่าง" โปสเตอร์
//   LINE: รูป/ไฟล์ที่ส่งต่อเข้าบัญชีทางการ จากผู้ใช้ที่อยู่ใน ACCOUNTING_LINE_USER_ID เท่านั้น
//     → เก็บใน bucket ปิด accounting-inbox ใต้ new/ (คำบรรยายเก็บเป็นไฟล์ .json คู่กัน)
//     → คอมของเจ้าของดึงลงโฟลเดอร์ "กล่องรับเอกสาร" เมื่อเปิดเครื่อง (scripts/accounting-inbox.mjs) แล้วย้ายเป็น fetched/
//
// ไม่มีตาราง ไม่ต้องรัน SQL: คิว = รายชื่อไฟล์ใน bucket (แบบเดียวกับ lead-reviews)
// ห้ามเก็บรูปจากผู้ใช้ LINE คนอื่น: ลูกค้าส่งสลิปเข้าบัญชีทางการเดียวกัน · ไม่พิมพ์คำบรรยาย/ชื่อไฟล์ลง log
// ชื่อไฟล์มีรหัสของไฟล์ต้นทาง → ส่งซ้ำไม่เกิดไฟล์ซ้ำ · ไม่ลบไฟล์ (ย้ายโฟลเดอร์แทน)
import fs from 'node:fs/promises'
import path from 'node:path'

export const INBOX_BUCKET = 'accounting-inbox'
export const INBOX_MAX_BYTES = 20 * 1024 * 1024
const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' }
const MIME_BY_EXT = { jpg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' }

const idList = (value) => String(value || '').split(',').map((s) => s.trim()).filter(Boolean)
const safeId = (value) => String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80)

// ชื่อไฟล์ในคิว: <เวลา UTC>_<ช่องทาง>_<รหัสไฟล์ต้นทาง>.<นามสกุล> — เรียงตามเวลาได้จากชื่อ
export function objectName({ source, uid, ext, at = new Date() }) {
  const stamp = new Date(at).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  return `${stamp}_${safeId(source)}_${safeId(uid)}.${ext}`
}

// ไฟล์จากข้อความเทเลแกรม: รูป (ขนาดใหญ่สุด) หรือเอกสาร jpg/png/pdf · อื่น ๆ = null
export function pickTelegramFile(message) {
  const photos = Array.isArray(message?.photo) ? message.photo.filter((p) => p?.file_id) : []
  if (photos.length) {
    const best = photos.reduce((a, b) => ((b.width || 0) * (b.height || 0) > (a.width || 0) * (a.height || 0) ? b : a))
    return { file_id: best.file_id, uid: best.file_unique_id || best.file_id, mime: 'image/jpeg', ext: 'jpg', size: best.file_size || null }
  }
  const doc = message?.document
  const ext = doc?.file_id ? EXT_BY_MIME[String(doc.mime_type || '').toLowerCase()] : null
  if (!ext) return null
  return { file_id: doc.file_id, uid: doc.file_unique_id || doc.file_id, mime: MIME_BY_EXT[ext], ext, size: doc.file_size || null }
}

// ผู้ส่งที่รับไฟล์บัญชีทางเทเลแกรม: ไม่ตั้ง ACCOUNTING_TELEGRAM_USER_ID = ทุกคนในห้องที่บอทอนุญาตอยู่แล้ว
export function telegramSenderAllowed(message, env = process.env) {
  const allowed = idList(env.ACCOUNTING_TELEGRAM_USER_ID)
  return !allowed.length || allowed.includes(String(message?.from?.id ?? ''))
}

export const lineSenderAllowed = (userId, env = process.env) => idList(env.ACCOUNTING_LINE_USER_ID).includes(String(userId || ''))

let bucketReady = false
async function ensureBucket(db) {
  if (bucketReady) return
  const { error } = await db.storage.createBucket(INBOX_BUCKET, {
    public: false,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf', 'application/json'],
    fileSizeLimit: INBOX_MAX_BYTES + 1024,
  })
  if (error && !/exist/i.test(String(error.message || ''))) throw error
  bucketReady = true
}

// เก็บไฟล์หนึ่งชิ้นเข้าคิว · คืน { stored, duplicate, name }
export async function storeInboxFile(db, { source, uid, mime, ext, bytes, caption = '', sender = '', at }) {
  if (!bytes?.length) throw new Error('ไฟล์ว่าง')
  if (bytes.length > INBOX_MAX_BYTES) throw new Error('ไฟล์ใหญ่เกิน 20 MB')
  await ensureBucket(db)
  const bucket = db.storage.from(INBOX_BUCKET)
  // ส่งซ้ำ = รหัสไฟล์ต้นทางเดิม → ตรวจจากรายชื่อไฟล์ทั้งสองโฟลเดอร์ก่อน
  const tail = `_${safeId(source)}_${safeId(uid)}.${ext}`
  for (const folder of ['new', 'fetched']) {
    const seen = await bucket.list(folder, { search: tail.slice(1), limit: 5 })
    if (seen?.error) throw seen.error
    if ((seen.data || []).some((f) => f.name.endsWith(tail))) return { stored: false, duplicate: true, name: null }
  }
  const name = objectName({ source, uid, ext, at })
  const up = await bucket.upload(`new/${name}`, bytes, { contentType: mime, upsert: false })
  if (up?.error) throw up.error
  const meta = { source, sender: String(sender || ''), caption: String(caption || '').slice(0, 500), mime, bytes: bytes.length, received_at: new Date(at || Date.now()).toISOString() }
  const side = await bucket.upload(`new/${name}.json`, Buffer.from(JSON.stringify(meta)), { contentType: 'application/json', upsert: true })
  if (side?.error) throw side.error
  return { stored: true, duplicate: false, name }
}

export function ackText({ stored, duplicate, via = 'เทเลแกรม' }) {
  if (duplicate) return '📒 ไฟล์นี้เคยรับไว้แล้ว ไม่เก็บซ้ำ'
  return stored
    ? `📒 รับเอกสารบัญชีแล้ว 1 ไฟล์ (ทาง${via})\nจะถูกจัดเข้าโฟลเดอร์ของเดือนเมื่อคอมสำนักงานเปิดครั้งถัดไป`
    : '📒 ยังเก็บไฟล์นี้ไม่ได้ ลองส่งใหม่อีกครั้ง'
}

// webhook เทเลแกรม: คืน null = ไม่ใช่ไฟล์ที่รับ (ให้ผู้ช่วยตอบตามเดิม)
// telegram = { getFile(fileId) → { file_path }, download(filePath) → Buffer, send(chatId, text) }
export async function handleAccountingTelegramMessage({ message, db, telegram, env = process.env }) {
  const file = pickTelegramFile(message)
  if (!file || !telegramSenderAllowed(message, env)) return null
  const chatId = message?.chat?.id == null ? '' : String(message.chat.id)
  if (!db) {
    await telegram.send(chatId, '📒 ยังเก็บเอกสารบัญชีไม่ได้ — เซิร์ฟเวอร์ไม่มี SUPABASE_SERVICE_ROLE_KEY')
    return { handled: true, stored: 0 }
  }
  if (file.size && file.size > INBOX_MAX_BYTES) {
    await telegram.send(chatId, '📒 ไฟล์ใหญ่เกิน 20 MB รับทางเทเลแกรมไม่ได้')
    return { handled: true, stored: 0 }
  }
  const info = await telegram.getFile(file.file_id)
  if (!info?.file_path) throw new Error('Telegram ไม่คืน file_path')
  const bytes = await telegram.download(info.file_path)
  const result = await storeInboxFile(db, {
    source: 'telegram', uid: file.uid, mime: file.mime, ext: file.ext, bytes,
    caption: message?.caption || '', sender: message?.from?.id ?? '',
    at: message?.date ? message.date * 1000 : Date.now(),
  })
  await telegram.send(chatId, ackText(result))
  return { handled: true, stored: result.stored ? 1 : 0, duplicate: result.duplicate }
}

// webhook LINE: เก็บเฉพาะรูป/ไฟล์จากผู้ใช้ที่อนุญาต · คืนจำนวนที่เก็บได้ · ไม่ใช้ replyToken (ปล่อยให้ระบบเดิมใช้)
// line = { content(messageId) → { bytes, mime } } · notify(text) = แจ้งกลับเจ้าของทางเทเลแกรม
export async function handleAccountingLineEvents({ events, db, line, notify = async () => {}, env = process.env }) {
  let stored = 0
  let duplicates = 0
  for (const event of Array.isArray(events) ? events : []) {
    const userId = event?.source?.userId
    const msg = event?.message
    if (event?.type !== 'message' || !msg) continue
    // ให้เจ้าของดูรหัส LINE ของตัวเองได้: พิมพ์ assetx-id เข้าบัญชีทางการ → รหัสไปขึ้นที่ห้องบอทเทเลแกรม
    if (msg.type === 'text' && /^assetx-id$/i.test(String(msg.text || '').trim()) && userId) {
      await notify(`📒 รหัส LINE ของผู้ที่พิมพ์ assetx-id:\n${userId}\nใส่ค่านี้ใน ACCOUNTING_LINE_USER_ID บน Vercel เพื่อให้รับเอกสารบัญชีจากบัญชีนี้`)
      continue
    }
    if (!['image', 'file'].includes(msg.type) || !lineSenderAllowed(userId, env) || !db) continue
    try {
      const { bytes, mime } = await line.content(msg.id)
      const ext = EXT_BY_MIME[String(mime || '').split(';')[0].trim().toLowerCase()]
      if (!ext) continue
      const result = await storeInboxFile(db, {
        source: 'line', uid: msg.id, mime: MIME_BY_EXT[ext], ext, bytes,
        caption: msg.fileName || '', sender: userId, at: event.timestamp || Date.now(),
      })
      if (result.stored) stored++
      if (result.duplicate) duplicates++
    } catch (error) {
      await notify(`📒 เก็บไฟล์จาก LINE ไม่สำเร็จ 1 ไฟล์ — ${String(error?.message || error).slice(0, 120)}`).catch(() => {})
    }
  }
  if (stored) await notify(`📒 รับเอกสารบัญชีจาก LINE แล้ว ${stored} ไฟล์\nจะถูกจัดเข้าโฟลเดอร์ของเดือนเมื่อคอมสำนักงานเปิดครั้งถัดไป`).catch(() => {})
  return { stored, duplicates }
}

// ชื่อไฟล์บนเครื่อง: วันเวลาไทย + ช่องทาง + ลำดับ (อ่านง่ายกว่ารหัสไฟล์ต้นทาง)
export function localName(objectFile, index = 0) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z_([a-z]+)_.*\.([a-z0-9]+)$/i.exec(objectFile)
  if (!m) return objectFile
  const local = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + 7, +m[5], +m[6]))
  const p = (n) => String(n).padStart(2, '0')
  const day = `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}`
  return `${day}_${p(local.getUTCHours())}${p(local.getUTCMinutes())}${p(local.getUTCSeconds())}_${m[7]}_${String(index + 1).padStart(2, '0')}.${m[8]}`
}

// คอมของเจ้าของ: ดึงไฟล์ใน new/ ลงโฟลเดอร์กล่องรับเอกสาร แล้วย้ายเป็น fetched/ · คืนรายการที่ดึงได้
export async function pullInbox(db, { inboxDir, log = () => {}, limit = 100 } = {}) {
  if (!inboxDir) throw new Error('pullInbox ต้องระบุ inboxDir')
  const bucket = db.storage.from(INBOX_BUCKET)
  const listed = await bucket.list('new', { limit: limit * 2, sortBy: { column: 'name', order: 'asc' } })
  if (listed?.error) {
    if (/not found|does not exist/i.test(String(listed.error.message || ''))) return []
    throw listed.error
  }
  const files = (listed.data || []).map((f) => f.name).filter((n) => !n.endsWith('.json')).slice(0, limit)
  if (!files.length) return []
  await fs.mkdir(inboxDir, { recursive: true })
  const pulled = []
  for (const [index, name] of files.entries()) {
    try {
      const dl = await bucket.download(`new/${name}`)
      if (dl?.error) throw dl.error
      const bytes = Buffer.from(await dl.data.arrayBuffer())
      let meta = {}
      const side = await bucket.download(`new/${name}.json`)
      if (!side?.error) meta = JSON.parse(Buffer.from(await side.data.arrayBuffer()).toString('utf8'))
      let local = localName(name, index)
      // กันชื่อชนกับไฟล์ที่ดึงไว้ก่อนหน้า
      for (let n = 1; ; n++) {
        try { await fs.access(path.join(inboxDir, local)); local = localName(name, index + n) } catch { break }
      }
      await fs.writeFile(path.join(inboxDir, local), bytes)
      await fs.appendFile(path.join(inboxDir, 'notes.jsonl'), `${JSON.stringify({ file: local, source: meta.source || '', caption: meta.caption || '', received_at: meta.received_at || '' })}\n`)
      const moved = await bucket.move(`new/${name}`, `fetched/${name}`)
      if (moved?.error) throw moved.error
      await bucket.move(`new/${name}.json`, `fetched/${name}.json`).catch(() => {})
      pulled.push({ file: local, source: meta.source || '', caption: meta.caption || '' })
    } catch (error) {
      log(`เอกสารบัญชี: ดึงไม่สำเร็จ 1 ไฟล์ — ${String(error?.message || error).slice(0, 200)}`)
    }
  }
  if (pulled.length) log(`รับเอกสารบัญชี ${pulled.length} ไฟล์ → ${inboxDir}`)
  return pulled
}

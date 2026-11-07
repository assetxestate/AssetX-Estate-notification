// server/poster-refs.js — คลังภาพอ้างอิงโปสเตอร์ที่เจ้าของส่งเข้าบอทเทเลแกรม
//
// ทางเดิน: เจ้าของส่งรูป (หรือไฟล์ jpg/png) เข้าห้องบอท AssetX พร้อมคำว่า "รูปตัวอย่าง" (+หมายเหตุสั้น ๆ ว่าชอบตรงไหน)
//   → api/telegram-webhook.js เรียก handlePosterRefMessage: ดาวน์โหลดไฟล์จาก Telegram → อัปโหลดขึ้น bucket marketing-images
//     ใต้ poster-refs/ → แถวใหม่ในตาราง poster_refs (status = new)
//   → scripts/image-worker.mjs บนคอมสำนักงานเรียก syncPosterRefs ทุก ๆ ไม่กี่สิบวินาที: ดึงไฟล์ลง .local/poster-refs/inbox/
//     พร้อมจดหมายเหตุใน notes.jsonl แล้วตั้ง status = fetched
//
// อัลบั้ม (ส่งหลายรูปพร้อมกัน): Telegram ส่งรูปละข้อความ มี media_group_id เดียวกัน และคำบรรยายติดมากับรูปเดียว
//   รูปที่มาก่อนคำบรรยาย → เก็บเป็น unclaimed (ยังไม่อัปโหลด) · เมื่อรูปที่มีคำว่า "รูปตัวอย่าง" มาถึง → ยกทั้งกลุ่มเป็น new และอัปโหลดให้
//   รูปที่มาหลังคำบรรยาย → เห็นว่ากลุ่มนี้เป็นรูปตัวอย่างแล้ว → new ทันที
// รูปเดี่ยวที่ไม่มีคำนำ → ไม่ใช่ธุระของโมดูลนี้ (คืน null ให้ผู้ช่วยตอบตามเดิม)
// ไม่มี DELETE โดยตั้งใจ · ไม่พิมพ์ชื่อไฟล์/หมายเหตุลง log ของ Vercel เกินจำเป็น · หมายเหตุผ่านตัวลบข้อมูลบุคคลก่อนเก็บ
import fs from 'node:fs/promises'
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { IMAGE_BUCKET } from './marketing-image-jobs.js'
import { scrub } from './research/pii.js'

export const REF_TABLE = 'poster_refs'
export const REF_STORAGE_PREFIX = 'poster-refs'
// คำนำที่ทำให้รูปถูกเก็บเป็นภาพอ้างอิง (ไทย/อังกฤษ)
export const REF_TRIGGER_RE = /รูปตัวอย่าง|ภาพตัวอย่าง|ตัวอย่างโปสเตอร์|โปสเตอร์ตัวอย่าง|poster\s*ref(?:erence)?s?/i
const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png' }

export const isRefCaption = (caption) => REF_TRIGGER_RE.test(String(caption || ''))

// หมายเหตุของเจ้าของ = คำบรรยายที่ตัดคำนำออก ผ่านตัวลบข้อมูลบุคคล ไม่เกิน 200 ตัวอักษร
export function refNote(caption) {
  return scrub(String(caption || '').replace(REF_TRIGGER_RE, ' ')).replace(/\s+/g, ' ').trim().slice(0, 200)
}

// เลือกไฟล์ภาพจากข้อความเทเลแกรม: photo เลือกขนาดใหญ่สุด · document รับเฉพาะ jpeg/png · อื่น ๆ = null
export function pickImage(message) {
  const photos = Array.isArray(message?.photo) ? message.photo.filter((p) => p?.file_id) : []
  if (photos.length) {
    const best = photos.reduce((a, b) => ((b.width || 0) * (b.height || 0) > (a.width || 0) * (a.height || 0) ? b : a))
    return { kind: 'photo', file_id: best.file_id, file_unique_id: best.file_unique_id || best.file_id, width: best.width || null, height: best.height || null, mime: 'image/jpeg', ext: 'jpg' }
  }
  const doc = message?.document
  const ext = doc?.file_id ? IMAGE_EXT[String(doc.mime_type || '').toLowerCase()] : null
  if (ext) return { kind: 'document', file_id: doc.file_id, file_unique_id: doc.file_unique_id || doc.file_id, width: null, height: null, mime: ext === 'png' ? 'image/png' : 'image/jpeg', ext }
  return null
}

export const storagePathFor = (image) => `${REF_STORAGE_PREFIX}/${image.file_unique_id}.${image.ext}`

// ชื่อไฟล์ในเครื่อง: วันที่รับ-เลขแถว-หมายเหตุย่อ.นามสกุล (คงอักษรไทย/ละติน/ตัวเลข ที่เหลือเป็นขีด)
export function slugNote(note, max = 40) {
  return String(note || '').replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '')
}

export function localFileName(row) {
  const ext = String(row.storage_path || '').split('.').pop() || 'jpg'
  const day = String(row.created_at || '').slice(0, 10).replace(/-/g, '') || 'undated'
  const slug = slugNote(row.note)
  return `${day}-${row.id}${slug ? `-${slug}` : ''}.${ext}`
}

export function replyText(stored, note) {
  const lines = [`📎 รับรูปตัวอย่างแล้ว ${stored} ภาพ${note ? ` · หมายเหตุ: ${note}` : ''}`]
  lines.push('จะไปอยู่ในโฟลเดอร์ .local/poster-refs/inbox บนคอมสำนักงานภายในประมาณ 1 นาที ถ้าตัวรับงานเปิดอยู่')
  lines.push('ส่งเป็นอัลบั้มหลายรูปได้ ใส่คำว่า "รูปตัวอย่าง" ในคำบรรยายรูปใดรูปหนึ่งก็พอ')
  return lines.join('\n')
}

async function fetchAndUpload(db, telegram, image) {
  const info = await telegram.getFile(image.file_id)
  if (!info?.file_path) throw new Error('Telegram ไม่คืน file_path')
  const bytes = await telegram.download(info.file_path)
  const objectPath = storagePathFor(image)
  const upload = await db.storage.from(IMAGE_BUCKET).upload(objectPath, bytes, { contentType: image.mime, upsert: true })
  if (upload?.error) throw upload.error
  return { objectPath, bytes: bytes?.length ?? bytes?.byteLength ?? null }
}

// webhook: คืน null = ไม่ใช่รูปตัวอย่าง (ให้ผู้ช่วยตอบตามเดิม) · มิฉะนั้น { handled, status, stored }
// telegram = { getFile(fileId) → { file_path }, download(filePath) → Buffer, send(chatId, text) }
export async function handlePosterRefMessage({ message, db, telegram, log = () => {} }) {
  const image = pickImage(message)
  if (!image) return null
  const chatId = message?.chat?.id == null ? '' : String(message.chat.id)
  const caption = String(message?.caption || '')
  const trigger = isRefCaption(caption)
  const group = message?.media_group_id ? String(message.media_group_id) : null

  if (!trigger && !group) return null
  if (!db) {
    if (trigger) await telegram.send(chatId, 'ยังเก็บรูปตัวอย่างไม่ได้ — เซิร์ฟเวอร์ไม่มี SUPABASE_SERVICE_ROLE_KEY')
    return { handled: trigger, status: 'skipped', stored: 0 }
  }

  let groupClaimed = false
  if (!trigger && group) {
    const seen = await db.from(REF_TABLE).select('id').eq('media_group_id', group).in('status', ['new', 'fetched']).limit(1)
    if (seen.error) throw seen.error
    groupClaimed = Boolean(seen.data?.length)
  }
  const status = trigger || groupClaimed ? 'new' : 'unclaimed'
  const note = trigger ? refNote(caption) : ''
  const base = {
    source: 'telegram',
    chat_id: chatId,
    message_id: message.message_id ?? null,
    media_group_id: group,
    file_id: image.file_id,
    file_unique_id: image.file_unique_id,
    mime: image.mime,
    width: image.width,
    height: image.height,
    caption: scrub(caption).slice(0, 500),
    note,
  }

  let stored = 0
  if (status === 'new') {
    const { objectPath, bytes } = await fetchAndUpload(db, telegram, image)
    const saved = await db.from(REF_TABLE).upsert({ ...base, status: 'new', storage_path: objectPath, bytes }, { onConflict: 'file_unique_id' })
    if (saved.error) throw saved.error
    stored = 1
    if (trigger && group) {
      // รูปในอัลบั้มเดียวกันที่มาถึงก่อนคำบรรยาย → อัปโหลดและยกเป็น new พร้อมหมายเหตุเดียวกัน
      const pending = await db.from(REF_TABLE).select('id,file_id,file_unique_id,mime').eq('media_group_id', group).eq('status', 'unclaimed')
      if (pending.error) throw pending.error
      for (const row of pending.data || []) {
        try {
          const sibling = { file_id: row.file_id, file_unique_id: row.file_unique_id, mime: row.mime || 'image/jpeg', ext: IMAGE_EXT[row.mime] || 'jpg' }
          const up = await fetchAndUpload(db, telegram, sibling)
          const promoted = await db.from(REF_TABLE).update({ status: 'new', storage_path: up.objectPath, bytes: up.bytes, note }).eq('id', row.id)
          if (promoted.error) throw promoted.error
          stored++
        } catch (err) {
          log(`poster ref ${row.id}: promote failed — ${err.message}`)
        }
      }
    }
  } else {
    const saved = await db.from(REF_TABLE).upsert({ ...base, status: 'unclaimed' }, { onConflict: 'file_unique_id' })
    if (saved.error) throw saved.error
  }

  if (trigger) await telegram.send(chatId, replyText(stored, note))
  return { handled: true, status, stored }
}

// เลือกภาพอ้างอิงสไตล์ให้โพสต์: โฟลเดอร์หมวดตามโครง (.local/poster-refs/<layout>/) ก่อน ไม่มีก็ไฟล์ในโฟลเดอร์หลัก (ยกเว้นโลโก้) · เรียงชื่อ · ไม่เกิน max
export function pickStyleRefs(rootDir, layout = 'steps', max = 3) {
  const isImage = (f) => /\.(jpe?g|png|webp)$/i.test(f) && !/^1-logo/i.test(f)
  for (const dir of [path.join(rootDir, String(layout || 'steps')), rootDir]) {
    if (!existsSync(dir)) continue
    const files = readdirSync(dir).filter((f) => isImage(f) && statSync(path.join(dir, f)).isFile()).sort()
    if (files.length) return files.slice(0, max).map((f) => path.join(dir, f))
  }
  return []
}

// คอมสำนักงาน: ดึงแถว new ลงโฟลเดอร์ inbox แล้วตั้ง fetched · คืนจำนวนที่ดึงได้
export async function syncPosterRefs(db, { inboxDir, log = () => {}, limit = 20 } = {}) {
  if (!inboxDir) throw new Error('syncPosterRefs ต้องระบุ inboxDir')
  const { data, error } = await db.from(REF_TABLE).select('id,storage_path,note,mime,created_at').eq('status', 'new').order('created_at', { ascending: true }).limit(limit)
  if (error) throw error
  if (!data?.length) return 0
  await fs.mkdir(inboxDir, { recursive: true })
  let fetched = 0
  for (const row of data) {
    try {
      if (!row.storage_path) throw new Error('ไม่มี storage_path')
      const dl = await db.storage.from(IMAGE_BUCKET).download(row.storage_path)
      if (dl?.error) throw dl.error
      const bytes = Buffer.from(await dl.data.arrayBuffer())
      const name = localFileName(row)
      await fs.writeFile(path.join(inboxDir, name), bytes)
      await fs.appendFile(path.join(inboxDir, 'notes.jsonl'), `${JSON.stringify({ id: row.id, file: name, note: row.note || '', received_at: row.created_at })}\n`)
      const done = await db.from(REF_TABLE).update({ status: 'fetched', local_name: name, fetched_at: new Date().toISOString() }).eq('id', row.id)
      if (done.error) throw done.error
      fetched++
    } catch (err) {
      log(`รูปตัวอย่าง ${row.id}: ดึงไม่สำเร็จ — ${String(err?.message || err).slice(0, 200)}`)
    }
  }
  if (fetched) log(`รับรูปตัวอย่างจากเทเลแกรม ${fetched} ภาพ → ${inboxDir}`)
  return fetched
}

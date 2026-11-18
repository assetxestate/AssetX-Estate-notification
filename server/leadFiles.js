// รูปแนบของ lead จากหน้า /assess (รูปเอกสารสิทธิ์ · รูปทรัพย์) — เก็บใน bucket ปิด `lead-files`
// รูปโฉนดมีข้อมูลส่วนบุคคล: ห้ามใช้ที่ฝากรูปสาธารณะ · เปิดดูได้เฉพาะผู้ล็อกอิน ผ่านลิงก์ชั่วคราว
// ไม่มีคอลัมน์ในฐานข้อมูล: ไฟล์ของ lead อยู่ในโฟลเดอร์ <เลข lead>/ ชื่อไฟล์ขึ้นต้นด้วยชนิด (deed- / property-)
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '../api/_auth.js'

export const LEAD_BUCKET = 'lead-files'
export const LEAD_FILE_LIMIT = 3 * 1024 * 1024 // ต่อรูป หลังย่อฝั่งหน้าเว็บ (คำขอของ Vercel รับได้ 4.5 MB รวม base64)
export const LEAD_FILE_MAX = 8 // ต่อ lead
export const LEAD_FRESH_MS = 20 * 60 * 1000 // หน้าเว็บส่งรูปทันทีหลังบันทึกฟอร์ม เลยช่วงนี้ไม่รับเพิ่ม
export const LEAD_KINDS = { deed: 'เอกสารสิทธิ์', property: 'รูปทรัพย์' }
const SIGNED_SECONDS = 10 * 60

export function decodeLeadImage(file) {
  const kind = Object.hasOwn(LEAD_KINDS, file?.kind) ? file.kind : null
  if (!kind || typeof file.base64 !== 'string' || !file.base64 || file.base64.length > Math.ceil(LEAD_FILE_LIMIT / 3) * 4 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.base64)) {
    throw new Error('ไฟล์รูปไม่ถูกต้อง')
  }
  const bytes = Buffer.from(file.base64, 'base64')
  // ตรวจชนิดจากเนื้อไฟล์ ไม่เชื่อชนิดที่หน้าเว็บบอก
  const type = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? ['image/jpeg', 'jpg']
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? ['image/png', 'png']
      : bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP' ? ['image/webp', 'webp']
        : null
  if (!type || bytes.length > LEAD_FILE_LIMIT) throw new Error('รองรับเฉพาะรูป JPG PNG หรือ WEBP ขนาดไม่เกิน 3 MB')
  return { bytes, kind, type: type[0], extension: type[1] }
}

export function leadIdOf(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : 0
}

export const kindOfFile = (name) => (String(name).startsWith('deed-') ? 'deed' : 'property')

export function serviceDb(env = process.env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
}

export async function listLeadFiles(db, id) {
  const { data, error } = await db.storage.from(LEAD_BUCKET).list(String(id), { limit: 100, sortBy: { column: 'created_at', order: 'asc' } })
  if (error) throw error
  return (data || []).filter((f) => f?.name && f.id)
}

// lead ที่ยังรับรูป/แจ้งเตือนได้: เป็น lead จากเว็บและเพิ่งสร้าง — กันคนนอกยิงเลขสุ่มเข้ามา
export async function freshLead(db, id, { now = Date.now(), within = LEAD_FRESH_MS } = {}) {
  const { data: row, error } = await db.from('valuations').select('*').eq('id', id).maybeSingle()
  if (error || !row || row.status !== 'Lead จากเว็บ') return null
  const age = now - new Date(row.created_at).getTime()
  return age >= 0 && age <= within ? row : null
}

// เรียกจากหน้า /assess (สาธารณะ) ผ่าน api/assess-chat.js โหมด lead-upload — รับทีละรูป
export async function uploadLeadFile({ id: rawId, file, db = serviceDb(), now = Date.now() }) {
  const id = leadIdOf(rawId)
  if (!id || !db) return { ok: false, error: 'ส่งรูปไม่ได้ในขณะนี้' }
  let image
  try { image = decodeLeadImage(file) } catch (error) { return { ok: false, error: error.message } }
  if (!(await freshLead(db, id, { now }))) return { ok: false, error: 'หมดเวลาส่งรูปของรายการนี้' }
  const existing = await listLeadFiles(db, id)
  if (existing.length >= LEAD_FILE_MAX) return { ok: false, error: `แนบได้ไม่เกิน ${LEAD_FILE_MAX} รูป` }
  const path = `${id}/${image.kind}-${randomUUID()}.${image.extension}`
  const { error } = await db.storage.from(LEAD_BUCKET).upload(path, image.bytes, { contentType: image.type, upsert: false })
  if (error) return { ok: false, error: 'บันทึกรูปไม่สำเร็จ' }
  return { ok: true, count: existing.length + 1 }
}

// ผู้ล็อกอินเท่านั้น: GET /api/lead-files?id=<เลข lead> → รายการรูปพร้อมลิงก์ชั่วคราว 10 นาที
export function createLeadFilesHandler({ authorized = verifySession, database = serviceDb } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (!authorized(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })
    const db = database()
    if (!db) return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่าฐานข้อมูลฝั่งเซิร์ฟเวอร์' })
    try {
      const id = leadIdOf(new URL(req.url, 'http://localhost').searchParams.get('id'))
      if (!id) return res.status(400).json({ error: 'กรุณาระบุรายการ' })
      const files = await listLeadFiles(db, id)
      if (!files.length) return res.status(200).json({ files: [] })
      const paths = files.map((f) => `${id}/${f.name}`)
      const signed = await db.storage.from(LEAD_BUCKET).createSignedUrls(paths, SIGNED_SECONDS)
      if (signed.error) throw signed.error
      return res.status(200).json({
        files: files.map((f, i) => ({ name: f.name, kind: kindOfFile(f.name), label: LEAD_KINDS[kindOfFile(f.name)], url: signed.data?.[i]?.signedUrl || '' })).filter((f) => f.url),
      })
    } catch (error) {
      console.error('lead-files failed:', error.message)
      return res.status(500).json({ error: 'เปิดรูปแนบไม่สำเร็จ' })
    }
  }
}

export default createLeadFilesHandler()

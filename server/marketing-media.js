// ที่เก็บรูปของหน้า /marketing (bucket ปิด marketing-media) — API หลังล็อกอิน (เจ้าของสั่ง 23 พ.ย. 2569: ย้ายรูปออกจากก้อนเวิร์กสเปซ)
// ตรรกะฝั่งหน้าเว็บ: src/lib/marketingMedia.js · ไม่มีตารางใหม่ ไม่ต้องรัน SQL (bucket สร้างเองครั้งแรก)
//
// GET  /api/marketing-media?status=1     → { ready }                 พร้อมเก็บรูปหรือไม่ (ปิดด้วย MARKETING_MEDIA_STORAGE=off)
// GET  /api/marketing-media?path=<path>  → { dataUrl, bytes }        อ่านรูปกลับ (หน้าเว็บใช้ทั้งตอนเปิดหน้า และตอนตรวจหลังอัปโหลด)
// POST { action: "upload", id, dataUrl } → { path, bytes, sha256 }   เก็บรูปหนึ่งไฟล์
//
// ชื่อไฟล์มีแฮชของเนื้อรูป: รูปเดิมอัปซ้ำได้ชื่อเดิม รูปใหม่ได้ชื่อใหม่ — ไม่มีการเขียนทับไฟล์
//   (ที่เก็บไฟล์แคชไฟล์ที่ถูกเขียนทับได้ถึง 1 ชั่วโมง อ่านแล้วได้ของเก่า — เจอจริง 20 พ.ย. 2569)
// ไม่มีการลบไฟล์: ลบรูปในหน้าเว็บ = เอาออกจากเวิร์กสเปซ ไฟล์ยังอยู่ (กู้ได้ · ค่อยเก็บกวาดทีหลังถ้าจำเป็น)
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '../api/_auth.js'
import { parseImageDataUrl } from './marketing-facebook.js'
import { MEDIA_MAX_BYTES, isStoragePath } from '../src/lib/marketingMedia.js'

export const MEDIA_BUCKET = 'marketing-media'
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export const mediaStorageOn = (env = process.env) => !/^(0|off|false|no)$/i.test(String(env.MARKETING_MEDIA_STORAGE || '').trim())

function defaultDatabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
}

let bucketReady = false
async function ensureBucket(db) {
  if (bucketReady) return true
  const { error } = await db.storage.createBucket(MEDIA_BUCKET, { public: false, allowedMimeTypes: Object.keys(EXT), fileSizeLimit: MEDIA_MAX_BYTES + 1024 })
  bucketReady = !error || /exist/i.test(String(error.message || ''))
  return bucketReady
}

const safeId = (value) => String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) || 'asset'

export function createMediaHandler({ authorized = verifySession, database = defaultDatabase, enabled = mediaStorageOn, ensure = ensureBucket } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (!authorized(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' })
    const db = database()
    try {
      const on = Boolean(enabled()) && Boolean(db)
      if (req.method === 'GET' && req.query?.status) return res.status(200).json({ ready: on && await ensure(db) })
      if (!on) return res.status(503).json({ error: 'ที่เก็บรูปยังไม่เปิดใช้' })
      if (!(await ensure(db))) return res.status(503).json({ error: 'ที่เก็บรูปยังไม่พร้อม ลองใหม่อีกครั้ง' })

      if (req.method === 'GET') {
        const path = String(req.query?.path || '')
        if (!isStoragePath(path)) return res.status(400).json({ error: 'ตำแหน่งรูปไม่ถูกต้อง' })
        const { data, error } = await db.storage.from(MEDIA_BUCKET).download(path)
        if (error || !data) return res.status(404).json({ error: 'ไม่พบรูปนี้ในที่เก็บ' })
        const buffer = Buffer.from(await data.arrayBuffer())
        const mime = MIME[path.split('.').pop()] || 'image/jpeg'
        return res.status(200).json({ dataUrl: `data:${mime};base64,${buffer.toString('base64')}`, bytes: buffer.length })
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {}
      if (body.action !== 'upload') return res.status(400).json({ error: 'ไม่รู้จักคำสั่งนี้' })
      let image
      try { image = parseImageDataUrl(body.dataUrl) } catch (error) { return res.status(400).json({ error: error.message }) }
      if (image.buffer.length > MEDIA_MAX_BYTES) return res.status(413).json({ error: 'รูปใหญ่เกินกว่าจะเก็บแยกได้' })
      const sha256 = crypto.createHash('sha256').update(image.buffer).digest('hex')
      const path = `workspace/${safeId(body.id)}-${sha256.slice(0, 16)}.${EXT[image.mimeType] || 'jpg'}`
      const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, image.buffer, { contentType: image.mimeType, upsert: false })
      // มีไฟล์ชื่อนี้อยู่แล้ว = รูปเดิม (ชื่อมีแฮชของเนื้อรูป) ถือว่าสำเร็จ
      if (error && !/exist|duplicate/i.test(String(error.message || '')) && String(error.statusCode || error.status || '') !== '409') throw error
      return res.status(200).json({ path, bytes: image.buffer.length, sha256 })
    } catch (error) {
      console.error('marketing media failed:', error?.statusCode || error?.code || error?.name || 'error')
      return res.status(500).json({ error: 'เก็บหรืออ่านรูปไม่สำเร็จ ลองใหม่อีกครั้ง' })
    }
  }
}

export default createMediaHandler()

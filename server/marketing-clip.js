// คลิปวิดีโอของคอนเทนต์ในหน้า /marketing: ที่เก็บไฟล์ + ส่งขึ้นเพจ Facebook เป็น Reel (เจ้าของขอ 24 พ.ย. 2569) — API หลังล็อกอิน
// ตรรกะล้วน: src/lib/marketingClip.js · bucket ปิด marketing-clips (สร้างเองครั้งแรก ไม่มีตารางใหม่ ไม่ต้องรัน SQL)
//
// GET  /api/marketing-clip?status=1            → { ready, facebook, approval }  ที่เก็บไฟล์พร้อมไหม · ตั้งค่า Facebook แล้วไหม · ต้องมีบันทึกการอนุมัติไหม
// GET  /api/marketing-clip?path=<path>         → { url, bytes }            ลิงก์ดูคลิปชั่วคราว (1 ชั่วโมง)
// GET  /api/marketing-clip?reel=<video id>     → { state, message, permalink }  สถานะ Reel บน Facebook (อ่านอย่างเดียว)
// POST { action: "upload-url", contentNo, bytes, type }  → { path, token }  ลิงก์อัปโหลดแบบเซ็นชื่อ เบราว์เซอร์ส่งไฟล์ตรงเข้าที่เก็บ
//      (คลิปใหญ่เกินเพดานคำขอของเซิร์ฟเวอร์ 4.5 MB จึงไม่ส่งผ่านฟังก์ชันนี้)
// POST { action: "reel-upload", path, post? }             → { videoId }     เปิดรายการ Reel แล้วให้ Facebook ดึงไฟล์จากลิงก์ชั่วคราว
// POST { action: "reel-publish", videoId, description, aiGenerated, post? } → { videoId }  เผยแพร่ (ข้อความผ่านด่านคำของแบรนด์ก่อน)
//      post = ชุดจาก reelGatePayload (src/lib/marketingClip.js) — บังคับเมื่อธง MARKETING_PROOF_CARDS เปิด: ทั้งสองคำสั่งตรวจบันทึกการอนุมัติของ Reel
//      (ผู้ตรวจ · แฮชของข้อความใต้คลิป + ไฟล์คลิป + ข้ออ้าง) และตรวจด่านหลักฐานซ้ำ ณ เวลาส่ง · ไม่ผ่าน = 422 ไม่เรียก Facebook
//
// ชื่อไฟล์มีเวลา ไม่เขียนทับ ไม่ลบ · ไฟล์ที่ส่งให้ Facebook ต้องเป็นคลิปการตลาดเท่านั้น (ห้ามรูปโฉนดหรือข้อมูลลูกค้า — กติกาเดิมของโปรเจกต์)
// ข้อจำกัดที่รู้: ด่านอ่านได้แค่ข้อความใต้คลิป ไม่ได้อ่านเสียงหรือตัวหนังสือในคลิป (ผู้ตรวจยืนยันว่าดูคลิปแล้วตอนอนุมัติ) · รหัสวิดีโอของ Facebook
//   ผูกกับไฟล์ที่อนุมัติด้วยคำสั่ง reel-upload ที่ตรวจตำแหน่งไฟล์ — เซิร์ฟเวอร์ไม่เก็บสถานะ จึงไม่ได้เทียบรหัสวิดีโอกับไฟล์ซ้ำตอนเผยแพร่
//   ธงปิด = ด่านเดิม (ด่านคำ + คนกดยืนยัน)
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '../api/_auth.js'
import { addProofParam, configStatus, facebookConfig, graphHeaders, graphRequest, graphUrl } from './marketing-facebook.js'
import { assertApprovedForPublish, proofDatabase, proofFlagOn } from './marketing-proof.js'
import { CLIP_MAX_BYTES, CLIP_MIME, REEL_KIND, checkClipFile, checkReelDescription, clipPathFor, isClipPath, summarizeReelStatus } from '../src/lib/marketingClip.js'

export const CLIP_BUCKET = 'marketing-clips'
const VIEW_TTL_SEC = 60 * 60
const FETCH_TTL_SEC = 2 * 60 * 60 // ลิงก์ที่ให้ Facebook ดึงไฟล์ ต้องอยู่นานพอให้ดึงเสร็จ

export const clipStorageOn = (env = process.env) => !/^(0|off|false|no)$/i.test(String(env.MARKETING_CLIP_STORAGE || '').trim())

function defaultDatabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
}

let bucketReady = false
async function ensureBucket(db) {
  if (bucketReady) return true
  const { error } = await db.storage.createBucket(CLIP_BUCKET, { public: false, allowedMimeTypes: [CLIP_MIME], fileSizeLimit: CLIP_MAX_BYTES })
  bucketReady = !error || /exist/i.test(String(error.message || ''))
  return bucketReady
}

async function clipInfo(db, path) {
  const [folder, name] = path.split('/')
  const { data, error } = await db.storage.from(CLIP_BUCKET).list(folder, { search: name, limit: 5 })
  if (error) throw error
  const found = (data || []).find((item) => item.name === name)
  return found ? { bytes: Number(found.metadata?.size) || null } : null
}

async function signedUrl(db, path, seconds) {
  const { data, error } = await db.storage.from(CLIP_BUCKET).createSignedUrl(path, seconds)
  if (error || !data?.signedUrl) throw error || new Error('no signed url')
  return data.signedUrl
}

const cleanVideoId = (value) => { const id = String(value ?? '').trim(); return /^\d{5,30}$/.test(id) ? id : '' }

// ขั้นที่ 1–2 ของ Reels API: เปิดรายการ แล้วให้ Facebook ดึงไฟล์จากลิงก์ (header file_url) — ไฟล์ไม่ผ่านเซิร์ฟเวอร์ของเรา
export async function uploadReelFromUrl(fileUrl, fetchImpl = fetch, config = facebookConfig()) {
  const status = configStatus(config)
  if (!status.ready) throw new Error(`ยังไม่ได้ตั้งค่า ${status.missing.join(', ')}`)
  const start = addProofParam(new URLSearchParams({ upload_phase: 'start' }), config)
  const started = await graphRequest(graphUrl(config, `${config.pageId}/video_reels`), {
    method: 'POST', headers: graphHeaders(config, { 'Content-Type': 'application/x-www-form-urlencoded' }), body: start,
  }, fetchImpl, config)
  const videoId = cleanVideoId(started.video_id)
  if (!videoId) throw new Error('Facebook ไม่ได้ส่งรหัสวิดีโอกลับมา')
  const uploaded = await graphRequest(`https://rupload.facebook.com/video-upload/${config.graphVersion}/${videoId}`, {
    method: 'POST', headers: { Authorization: `OAuth ${config.accessToken}`, file_url: fileUrl },
  }, fetchImpl, config)
  if (uploaded.success !== true) throw new Error('Facebook ไม่ยืนยันว่ารับไฟล์คลิปแล้ว')
  return { videoId }
}

// ขั้นที่ 3: เผยแพร่ — เนื้อหาบนเพจเป็นสาธารณะ ผู้เรียกต้องผ่านด่านคำและคนยืนยันมาก่อน
export async function publishReel({ videoId, description, aiGenerated = false }, fetchImpl = fetch, config = facebookConfig()) {
  const status = configStatus(config)
  if (!status.ready) throw new Error(`ยังไม่ได้ตั้งค่า ${status.missing.join(', ')}`)
  const id = cleanVideoId(videoId)
  if (!id) throw new Error('รหัสวิดีโอไม่ถูกต้อง')
  const params = addProofParam(new URLSearchParams({ upload_phase: 'finish', video_id: id, video_state: 'PUBLISHED', description }), config)
  if (aiGenerated) params.set('is_ai_generated', 'true')
  const result = await graphRequest(graphUrl(config, `${config.pageId}/video_reels`), {
    method: 'POST', headers: graphHeaders(config, { 'Content-Type': 'application/x-www-form-urlencoded' }), body: params,
  }, fetchImpl, config)
  if (result.success !== true) throw new Error('Facebook ไม่ยืนยันการเผยแพร่')
  return { videoId: id }
}

export async function checkReel(videoId, fetchImpl = fetch, config = facebookConfig()) {
  const status = configStatus(config)
  if (!status.ready) throw new Error(`ยังไม่ได้ตั้งค่า ${status.missing.join(', ')}`)
  const id = cleanVideoId(videoId)
  if (!id) throw new Error('รหัสวิดีโอไม่ถูกต้อง')
  const params = addProofParam(new URLSearchParams({ fields: 'status,permalink_url' }), config)
  const data = await graphRequest(`${graphUrl(config, id)}?${params}`, { method: 'GET', headers: graphHeaders(config) }, fetchImpl, config)
  const link = String(data.permalink_url || '')
  return { videoId: id, ...summarizeReelStatus(data.status || {}), permalink: link ? (link.startsWith('http') ? link : `https://www.facebook.com${link}`) : null }
}

// ตัวตรวจบันทึกการอนุมัติ (ธงเปิด) หรือ null (ธงปิด = ด่านเดิม)
const defaultApproval = () => (proofFlagOn() ? (post) => assertApprovedForPublish(proofDatabase(), post) : null)

// คืนข้อความที่ต้องแจ้งเมื่อ Reel ยังส่งไม่ได้ · null = ผ่าน
async function approvalProblem(guard, post, { path = null, description = null } = {}) {
  if (!guard) return null
  if (!post || typeof post !== 'object' || post.kind !== REEL_KIND) return 'Reel นี้ยังไม่ผ่านการตรวจหลักฐานและอนุมัติ — โหลดหน้านี้ใหม่แล้วกดตรวจและอนุมัติก่อน'
  if (path !== null && post.mediaAssetId !== path) return 'ไฟล์คลิปไม่ตรงกับฉบับที่อนุมัติ — ตรวจและอนุมัติ Reel ใหม่ก่อนส่ง'
  if (description !== null && String(post.caption ?? '').replace(/\r\n/g, '\n').trim() !== description) return 'ข้อความใต้คลิปไม่ตรงกับฉบับที่อนุมัติ — ตรวจและอนุมัติ Reel ใหม่ก่อนส่ง'
  try { await guard(post); return null } catch (error) { return String(error?.message || 'ตรวจบันทึกการอนุมัติไม่สำเร็จ ลองใหม่อีกครั้ง') }
}

export function createClipHandler({ authorized = verifySession, database = defaultDatabase, enabled = clipStorageOn, ensure = ensureBucket, fetchImpl = fetch, config = facebookConfig, now = Date.now, approval = defaultApproval } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (!authorized(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' })
    const db = database()
    const fb = config()
    try {
      const on = Boolean(enabled()) && Boolean(db)
      const guard = approval()
      if (req.method === 'GET' && req.query?.status) return res.status(200).json({ ready: on && await ensure(db), facebook: configStatus(fb).ready, approval: Boolean(guard) })
      if (req.method === 'GET' && req.query?.reel) return res.status(200).json(await checkReel(req.query.reel, fetchImpl, fb))
      if (!on) return res.status(503).json({ error: 'ที่เก็บคลิปยังไม่เปิดใช้' })
      if (!(await ensure(db))) return res.status(503).json({ error: 'ที่เก็บคลิปยังไม่พร้อม ลองใหม่อีกครั้ง' })

      if (req.method === 'GET') {
        const path = String(req.query?.path || '')
        if (!isClipPath(path)) return res.status(400).json({ error: 'ตำแหน่งคลิปไม่ถูกต้อง' })
        const info = await clipInfo(db, path)
        if (!info) return res.status(404).json({ error: 'ไม่พบคลิปนี้ในที่เก็บ' })
        return res.status(200).json({ url: await signedUrl(db, path, VIEW_TTL_SEC), bytes: info.bytes })
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {}
      if (body.action === 'upload-url') {
        const check = checkClipFile({ type: body.type, size: Number(body.bytes) })
        if (!check.ok) return res.status(400).json({ error: check.problems.join(' · ') })
        const path = clipPathFor(body.contentNo, now())
        if (!path) return res.status(400).json({ error: 'เลขคอนเทนต์ไม่ถูกต้อง' })
        const { data, error } = await db.storage.from(CLIP_BUCKET).createSignedUploadUrl(path)
        if (error || !data?.token) throw error || new Error('no upload token')
        return res.status(200).json({ bucket: CLIP_BUCKET, path, token: data.token })
      }
      if (body.action === 'reel-upload') {
        const path = String(body.path || '')
        if (!isClipPath(path)) return res.status(400).json({ error: 'ตำแหน่งคลิปไม่ถูกต้อง' })
        if (!(await clipInfo(db, path))) return res.status(404).json({ error: 'ไม่พบคลิปนี้ในที่เก็บ อัปโหลดใหม่ก่อน' })
        // ไฟล์จะออกไปถึง Facebook ตั้งแต่ขั้นนี้ จึงตรวจการอนุมัติก่อนส่งไฟล์ ไม่รอถึงขั้นเผยแพร่
        const problem = await approvalProblem(guard, body.post, { path })
        if (problem) return res.status(422).json({ error: problem })
        return res.status(200).json(await uploadReelFromUrl(await signedUrl(db, path, FETCH_TTL_SEC), fetchImpl, fb))
      }
      if (body.action === 'reel-publish') {
        const text = checkReelDescription(body.description)
        if (!text.ok) return res.status(400).json({ error: `ข้อความใต้คลิปยังไม่ผ่านการตรวจ: ${text.notes.join(' · ')}` })
        if (body.confirmed !== true) return res.status(400).json({ error: 'ต้องยืนยันก่อนเผยแพร่' })
        const problem = await approvalProblem(guard, body.post, { description: text.description })
        if (problem) return res.status(422).json({ error: problem })
        return res.status(200).json(await publishReel({ videoId: body.videoId, description: text.description, aiGenerated: body.aiGenerated === true }, fetchImpl, fb))
      }
      return res.status(400).json({ error: 'ไม่รู้จักคำสั่งนี้' })
    } catch (error) {
      // ข้อความจาก Facebook ผ่าน facebookError มาแล้ว (ตัดโทเคนออก) ส่งให้หน้าจอได้ · ความผิดพลาดอื่นไม่ส่งรายละเอียด
      const message = String(error?.message || '')
      const fromFacebook = /Facebook|โทเคน|Token|META_/.test(message)
      console.error('marketing clip failed:', error?.statusCode || error?.code || error?.fbCode || error?.name || 'error')
      return res.status(fromFacebook ? 502 : 500).json({ error: fromFacebook ? message : 'ทำรายการคลิปไม่สำเร็จ ลองใหม่อีกครั้ง' })
    }
  }
}

export default createClipHandler()

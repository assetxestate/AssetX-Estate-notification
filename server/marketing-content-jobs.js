// คิว "คิดคอนเทนต์ใหม่ด้วย AI" — API ฝั่งเซิร์ฟเวอร์ของปุ่ม "✨ คิดคอนเทนต์ใหม่ (AI)" บนการ์ดไอเดียและการ์ดร่างในหน้า /marketing (เจ้าของขอ 9 พ.ย. 2569)
// ตาราง: supabase_marketing_content_jobs.sql · ตัวรับงาน: scripts/image-worker.mjs บนคอมสำนักงาน (Codex ที่ล็อกอิน ChatGPT Plus · server/research/fresh.js)
//
// GET  /api/marketing-content-jobs                 → { worker }
// GET  /api/marketing-content-jobs?id=N            → { job, worker }
// GET  /api/marketing-content-jobs?recent=1        → { jobs, worker }   งานใน 24 ชม. — เปิดหน้าใหม่แล้วตามงานที่ยังไม่จบ / ใช้ผลที่ยังไม่ได้ใช้
// POST { action: "create", idea_id, post_key?, content_no?, note?, avoid_headline?, avoid_caption? } → { job, reused, worker }
//      post_key = ร่างในแท็บ ร่าง ที่สั่ง (ส่งข้อความร่างนั้นมาให้ AI เลี่ยง) · ไม่มี = สั่งจากการ์ดไอเดีย
// POST { action: "apply", id }                     → { job }   หน้าเว็บจองว่าจะสร้างร่างใหม่จากผลนี้ (ได้ครั้งเดียว — เปิดสองแท็บก็ไม่สร้างซ้ำ)
// POST { action: "cancel", id }                    → { job }   ยกเลิกได้เฉพาะงานที่ยังไม่มีใครหยิบ
//
// ข้อความทุกช่องผ่านตัวลบข้อมูลบุคคลก่อนเก็บ · ไม่มีการลบแถว (ยกเลิก = cancelled)
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '../api/_auth.js'
import { scrub, scrubPostText } from './research/pii.js'

export const CONTENT_WORKER_ID = 'office-pc'
export const MAX_ACTIVE_CONTENT_JOBS = 3
export const CONTENT_WORKER_ONLINE_MS = 90 * 1000
const JOB_COLUMNS = 'id,status,idea_id,post_key,content_no,result,error,applied_at,created_at,claimed_at,finished_at'
const ACTIVE = ['queued', 'running']
const RECENT_MS = 24 * 60 * 60 * 1000
const NOTE_MAX = 200
const CAPTION_MAX = 2400

function defaultDatabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
}

const oneLine = (value, max) => scrub(String(value ?? '')).replace(/\s+/g, ' ').trim().slice(0, max)
// ร่างเดิมที่ส่งมาให้ AI เลี่ยง = โพสต์ของเราเอง → ชุดกฎข้อความโพสต์ (ชุดเต็มลบคำว่า คุณ… ที่โพสต์ใช้เรียกคนอ่านทั้งหมด) · คำขอที่เจ้าของพิมพ์เองใช้ชุดเต็ม
const postLine = (value, max) => scrubPostText(String(value ?? '')).replace(/\s+/g, ' ').trim().slice(0, max)
const multiLine = (value, max) => scrubPostText(String(value ?? '')).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)

// สถานะตัวรับงาน: แถวเดียวกับคิวสร้างภาพ · content = ตัวรับงานรุ่นที่รับงานคิดคอนเทนต์ได้ (รุ่นเก่ายังเปิดอยู่ = งานจะค้างในคิว หน้าเว็บบอกให้เปิดใหม่)
export function contentWorkerStatus(row, now = Date.now()) {
  const lastSeen = row?.last_seen_at ? Date.parse(row.last_seen_at) : NaN
  return {
    online: Number.isFinite(lastSeen) && now - lastSeen <= CONTENT_WORKER_ONLINE_MS,
    content: Boolean(row?.info?.content_jobs),
    last_seen_at: row?.last_seen_at || null,
  }
}

async function readWorker(db, now) {
  const { data, error } = await db.from('marketing_image_worker').select('id,last_seen_at,info').eq('id', CONTENT_WORKER_ID).maybeSingle()
  if (error) throw error
  return contentWorkerStatus(data, now)
}

function cleanPostKey(value) {
  const key = String(value ?? '').trim()
  return /^[\w:.-]{1,80}$/.test(key) ? key : ''
}

const positiveInt = (value) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

export function createContentJobsHandler({ authorized = verifySession, database = defaultDatabase, now = () => Date.now() } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (!authorized(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' })
    const db = database()
    if (!db) return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่าฐานข้อมูลฝั่งเซิร์ฟเวอร์' })
    const at = now()
    try {
      if (req.method === 'GET') {
        const url = new URL(req.url || '/', 'http://assetx.local')
        const worker = await readWorker(db, at)
        if (url.searchParams.has('id')) {
          const id = positiveInt(url.searchParams.get('id'))
          if (!id) return res.status(400).json({ error: 'รหัสงานไม่ถูกต้อง' })
          const { data, error } = await db.from('marketing_content_jobs').select(JOB_COLUMNS).eq('id', id).maybeSingle()
          if (error) throw error
          if (!data) return res.status(404).json({ error: 'ไม่พบงานนี้' })
          return res.status(200).json({ job: data, worker })
        }
        if (url.searchParams.get('recent') === '1') {
          const { data, error } = await db.from('marketing_content_jobs').select(JOB_COLUMNS)
            .gte('created_at', new Date(at - RECENT_MS).toISOString()).order('created_at', { ascending: false }).limit(20)
          if (error) throw error
          return res.status(200).json({ jobs: data || [], worker })
        }
        return res.status(200).json({ worker })
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {}

      if (body.action === 'create') {
        const ideaId = positiveInt(body.idea_id)
        if (!ideaId) return res.status(400).json({ error: 'รหัสไอเดียไม่ถูกต้อง' })
        const postKey = body.post_key === undefined || body.post_key === null || body.post_key === '' ? null : cleanPostKey(body.post_key)
        if (postKey === '') return res.status(400).json({ error: 'รหัสร่างไม่ถูกต้อง' })

        const idea = await db.from('marketing_ideas').select('id,status').eq('id', ideaId).maybeSingle()
        if (idea.error) throw idea.error
        if (!idea.data || !['new', 'picked'].includes(idea.data.status)) return res.status(404).json({ error: 'ไอเดียนี้ถูกทิ้งหรือหมดอายุไปแล้ว คิดคอนเทนต์ใหม่ไม่ได้' })

        // กดซ้ำขณะงานของไอเดียเดิมยังไม่จบ = ตามงานเดิม (ไม่เปลืองโควตา ChatGPT · ไม่ได้มุมใหม่สองมุมพร้อมกัน)
        const existing = await db.from('marketing_content_jobs').select(JOB_COLUMNS).eq('idea_id', ideaId).in('status', ACTIVE)
          .order('created_at', { ascending: false }).limit(1)
        if (existing.error) throw existing.error
        if (existing.data?.[0]) return res.status(200).json({ job: existing.data[0], reused: true, worker: await readWorker(db, at) })

        const active = await db.from('marketing_content_jobs').select('id', { count: 'exact', head: true }).in('status', ACTIVE)
        if (active.error) throw active.error
        if ((active.count || 0) >= MAX_ACTIVE_CONTENT_JOBS) {
          return res.status(429).json({ error: `มีงานคิดคอนเทนต์ใหม่รอคิวอยู่ ${active.count} งานแล้ว รอให้เสร็จก่อนแล้วค่อยสั่งเพิ่ม` })
        }

        const note = oneLine(body.note, NOTE_MAX)
        const caption = postKey ? multiLine(body.avoid_caption, CAPTION_MAX) : ''
        const request = {
          ...(note ? { note } : {}),
          avoid: caption ? [{ headline: postLine(body.avoid_headline, 120), caption }] : [],
        }
        const row = {
          status: 'queued',
          idea_id: ideaId,
          post_key: postKey,
          content_no: positiveInt(body.content_no),
          request,
        }
        const { data, error } = await db.from('marketing_content_jobs').insert(row).select(JOB_COLUMNS).maybeSingle()
        if (error) throw error
        return res.status(200).json({ job: data, reused: false, worker: await readWorker(db, at) })
      }

      if (body.action === 'apply') {
        const id = positiveInt(body.id)
        if (!id) return res.status(400).json({ error: 'รหัสงานไม่ถูกต้อง' })
        const { data, error } = await db.from('marketing_content_jobs')
          .update({ applied_at: new Date(at).toISOString() })
          .eq('id', id).eq('status', 'done').is('applied_at', null).select(JOB_COLUMNS).maybeSingle()
        if (error) throw error
        if (!data) return res.status(409).json({ error: 'ผลของงานนี้ถูกใช้ไปแล้ว หรืองานยังไม่เสร็จ' })
        return res.status(200).json({ job: data })
      }

      if (body.action === 'cancel') {
        const id = positiveInt(body.id)
        if (!id) return res.status(400).json({ error: 'รหัสงานไม่ถูกต้อง' })
        const { data, error } = await db.from('marketing_content_jobs')
          .update({ status: 'cancelled', finished_at: new Date(at).toISOString() })
          .eq('id', id).eq('status', 'queued').select(JOB_COLUMNS).maybeSingle()
        if (error) throw error
        if (!data) return res.status(409).json({ error: 'ยกเลิกไม่ได้ คอมสำนักงานเริ่มคิดงานนี้ไปแล้ว หรืองานจบไปแล้ว' })
        return res.status(200).json({ job: data })
      }

      return res.status(400).json({ error: 'ไม่รู้จักคำสั่งนี้' })
    } catch (error) {
      const missing = ['42P01', 'PGRST205'].includes(error?.code)
      if (!missing) console.error('marketing-content-jobs api error:', error?.message || error)
      return res.status(missing ? 503 : 500).json({
        error: missing
          ? 'ยังไม่ได้ติดตั้งคิวคิดคอนเทนต์ใหม่ — รัน supabase_marketing_content_jobs.sql ใน Supabase ก่อน'
          : 'อ่านหรือบันทึกงานคิดคอนเทนต์ใหม่ไม่สำเร็จ กรุณาลองใหม่',
      })
    }
  }
}

export default createContentJobsHandler()

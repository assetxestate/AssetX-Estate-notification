// คิวสร้างภาพโพสต์ผ่าน ChatGPT บนคอมสำนักงาน — API ฝั่งเซิร์ฟเวอร์ของหน้าต่าง "ออกแบบภาพโพสต์"
// ตาราง/bucket: supabase_marketing_image_jobs.sql · ตัวรับงาน: scripts/image-worker.mjs (รันบนคอมที่ล็อกอิน Codex ด้วย ChatGPT Plus)
//
// GET  /api/marketing-image-jobs                         → { worker }                สถานะตัวรับงานบนคอม
// GET  /api/marketing-image-jobs?id=N[&image=1]          → { job, worker, image? }   image = data URL เมื่อ done และขอ image=1
// GET  /api/marketing-image-jobs?post_key=K[&image=1]    → { job|null, worker, image? } งานล่าสุดของโพสต์ใน 24 ชม. (เปิดหน้าต่างใหม่แล้วตามงานต่อ)
// POST { action: "create", post_key, content_no, title, caption, size } → { job, reused }   size = คีย์ใน src/lib/posterSizes.js
// POST { action: "cancel", id }                          → { job }                   ยกเลิกได้เฉพาะงานที่ยังไม่มีใครหยิบ
//
// ข้อความโพสต์ผ่านตัวลบข้อมูลบุคคลก่อนเก็บและก่อนส่งให้ Codex · ไม่มีการลบแถว (ยกเลิก = cancelled)
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '../api/_auth.js'
import { scrub } from './research/pii.js'
import { POSTER_SIZES, DEFAULT_POSTER_SIZE, cropPlan } from '../src/lib/posterSizes.js'

export const IMAGE_BUCKET = 'marketing-images'
export const WORKER_ID = 'office-pc'
const JOB_COLUMNS = 'id,status,post_key,content_no,title,size,aspect,image_path,error,created_at,claimed_at,finished_at'
const ACTIVE = ['queued', 'running']
export const MAX_ACTIVE_JOBS = 3
export const WORKER_ONLINE_MS = 90 * 1000
const RECENT_MS = 24 * 60 * 60 * 1000
const CAPTION_LIMIT = 1500

const ASSETX_PALETTE = 'Palette from the logo: midnight navy #08213f and cyan/teal #42c7d8 as the primary colors, deep violet #4b2a82 for depth and shadows, a small coral-orange #f26b4f accent, clean white. Avoid metallic gold bars, dominant red, green loan-ad themes and generic high-saturation finance-ad colors.'

function defaultDatabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
}

const oneLine = (value) => scrub(String(value ?? '')).replace(/\s+/g, ' ').trim()
// คงขึ้นบรรทัดไว้ให้ Codex อ่านโครงโพสต์ได้ แต่บีบช่องว่างและบรรทัดว่างซ้อน
const multiLine = (value) => scrub(String(value ?? ''))
  .replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

const SHAPES = { portrait: 'vertical (portrait)', square: 'square', landscape: 'horizontal (landscape)' }

// คำสั่งภาพจากเนื้อหาโพสต์: Codex (โมเดลภาษา) อ่านเนื้อหาแล้วเลือกฉากกับข้อความประกอบเอง ก่อนเรียกเครื่องมือสร้างภาพ
export function buildPosterJobPrompt({ title = '', caption = '', size = DEFAULT_POSTER_SIZE } = {}) {
  const headline = oneLine(title).slice(0, 120) || 'รับจำนอง · ขายฝาก'
  const body = multiLine(caption).slice(0, CAPTION_LIMIT)
  const plan = cropPlan(size)
  const ratio = `${plan.width}:${plan.height}`
  return [
    `Design ONE finished ${SHAPES[plan.aspect]} Thai social-media poster for AssetX Estate, a Thai real-estate consultancy for ขายฝาก (sale with right of redemption) and จำนอง (mortgage). It will be posted as a ${plan.platform} image (${plan.width}x${plan.height} px).`,
    plan.edges
      ? `SAFE AREA (strict): the ${plan.sourceWidth}x${plan.sourceHeight} image will be center-cropped to ${ratio}, cutting ${plan.cutPx} px off the ${plan.edges} edges. Keep the headline, every badge, the CTA band and the logo at least ${plan.safePx} px away from the ${plan.edges} edges. Those outer ${plan.safePx} px strips must contain background scenery only.`
      : 'SAFE AREA: keep all text and the logo at least 5% away from every edge.',
    'The attached image is the official AssetX logo. Place it small at the bottom. Do not redraw or alter it.',
    '',
    'HEADLINE (render exactly, large and bold in the top third; you may break it into two lines but must not change, add or drop any Thai character):',
    headline,
    '',
    body
      ? ['POST CONTENT (context only, do not paste it whole). Read it, then add at most 3 short supporting badges, each 2 to 5 Thai words copied from this text. Each badge must read as a complete idea on its own: do not start a badge with a connecting word such as และ, หรือ, แต่ or ที่, and do not split one phrase across badges.', '"""', body, '"""'].join('\n')
      : 'SUPPORTING BADGES (render exactly): ประเมินเบื้องต้น | ปรึกษาฟรี | ดูแลเอกสาร',
    '',
    'BOTTOM CTA BAND (render exactly): ติดต่อ AssetX Estate',
    '',
    'VISUAL: one hero scene that clearly matches the topic of this post (for example contract and document review for legal or checklist topics, an open land plot with boundary markers for land topics, a modern Thai house for housing topics, a calm consultation desk for advice topics). Photorealistic advertising composite, polished graphic design, clear hierarchy, high contrast, readable on a phone.',
    ASSETX_PALETTE,
    '',
    'RULES:',
    '- Thai text must be spelled exactly. Use fewer words rather than risk a misspelled word.',
    '- Do not add punctuation that is not in the given text: no trailing periods, no extra quotation marks.',
    '- Do not add phone numbers, LINE IDs, URLs, deed numbers, addresses, people\'s names, prices, interest rates or percentages unless they appear in the HEADLINE.',
    '- No Garuda, national emblem, government seals or official logos. Draw any land title deed as a plain generic document without emblems or numbers.',
    '- No other company names, logos or watermarks.',
    '- No promises of guaranteed approval, instant cash or guaranteed returns.',
  ].join('\n')
}

export function workerStatus(row, now = Date.now()) {
  const lastSeen = row?.last_seen_at ? Date.parse(row.last_seen_at) : NaN
  return {
    online: Number.isFinite(lastSeen) && now - lastSeen <= WORKER_ONLINE_MS,
    last_seen_at: row?.last_seen_at || null,
  }
}

async function readWorker(db, now) {
  const { data, error } = await db.from('marketing_image_worker').select('id,last_seen_at').eq('id', WORKER_ID).maybeSingle()
  if (error) throw error
  return workerStatus(data, now)
}

async function readImage(db, job) {
  if (job?.status !== 'done' || !job.image_path) return null
  const { data, error } = await db.storage.from(IMAGE_BUCKET).download(job.image_path)
  if (error || !data) throw error || new Error('ไม่พบไฟล์ภาพ')
  const bytes = Buffer.from(await data.arrayBuffer())
  const mime = /\.png$/i.test(job.image_path) ? 'image/png' : 'image/jpeg'
  return `data:${mime};base64,${bytes.toString('base64')}`
}

function cleanPostKey(value) {
  const key = String(value ?? '').trim()
  return /^[\w:.-]{1,80}$/.test(key) ? key : ''
}

export function createImageJobsHandler({ authorized = verifySession, database = defaultDatabase, now = () => Date.now() } = {}) {
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
        const wantImage = url.searchParams.get('image') === '1'
        const worker = await readWorker(db, at)
        let job = null
        if (url.searchParams.has('id')) {
          const id = Number(url.searchParams.get('id'))
          if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'รหัสงานไม่ถูกต้อง' })
          const { data, error } = await db.from('marketing_image_jobs').select(JOB_COLUMNS).eq('id', id).maybeSingle()
          if (error) throw error
          if (!data) return res.status(404).json({ error: 'ไม่พบงานสร้างภาพนี้' })
          job = data
        } else if (url.searchParams.has('post_key')) {
          const postKey = cleanPostKey(url.searchParams.get('post_key'))
          if (!postKey) return res.status(400).json({ error: 'รหัสโพสต์ไม่ถูกต้อง' })
          const { data, error } = await db.from('marketing_image_jobs').select(JOB_COLUMNS)
            .eq('post_key', postKey).gte('created_at', new Date(at - RECENT_MS).toISOString())
            .order('created_at', { ascending: false }).limit(1)
          if (error) throw error
          job = data?.[0] || null
        } else {
          return res.status(200).json({ worker })
        }
        const image = wantImage ? await readImage(db, job) : null
        return res.status(200).json({ job, worker, ...(image ? { image } : {}) })
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {}

      if (body.action === 'create') {
        const postKey = cleanPostKey(body.post_key)
        if (!postKey) return res.status(400).json({ error: 'รหัสโพสต์ไม่ถูกต้อง' })
        const title = oneLine(body.title).slice(0, 300)
        const caption = multiLine(body.caption)
        if (!title && !caption) return res.status(400).json({ error: 'โพสต์นี้ยังไม่มีหัวข้อหรือเนื้อหาให้ใช้สร้างภาพ' })
        const size = Object.hasOwn(POSTER_SIZES, body.size || '') ? body.size : DEFAULT_POSTER_SIZE

        // กดซ้ำขณะงานของโพสต์เดิมยังไม่เสร็จ = ตามงานเดิม ไม่เปลืองโควตา ChatGPT
        const existing = await db.from('marketing_image_jobs').select(JOB_COLUMNS).eq('post_key', postKey).in('status', ACTIVE)
          .order('created_at', { ascending: false }).limit(1)
        if (existing.error) throw existing.error
        if (existing.data?.[0]) return res.status(200).json({ job: existing.data[0], reused: true, worker: await readWorker(db, at) })

        const active = await db.from('marketing_image_jobs').select('id', { count: 'exact', head: true }).in('status', ACTIVE)
        if (active.error) throw active.error
        if ((active.count || 0) >= MAX_ACTIVE_JOBS) {
          return res.status(429).json({ error: `มีงานสร้างภาพรอคิวอยู่ ${active.count} งานแล้ว รอให้เสร็จก่อนแล้วค่อยสั่งเพิ่ม` })
        }

        const contentNo = Number(body.content_no)
        const row = {
          status: 'queued',
          post_key: postKey,
          content_no: Number.isInteger(contentNo) && contentNo > 0 ? contentNo : null,
          title: title || null,
          prompt: buildPosterJobPrompt({ title, caption, size }),
          size,
          aspect: POSTER_SIZES[size].aspect,
        }
        const { data, error } = await db.from('marketing_image_jobs').insert(row).select(JOB_COLUMNS).maybeSingle()
        if (error) throw error
        return res.status(200).json({ job: data, reused: false, worker: await readWorker(db, at) })
      }

      if (body.action === 'cancel') {
        const id = Number(body.id)
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'รหัสงานไม่ถูกต้อง' })
        const { data, error } = await db.from('marketing_image_jobs')
          .update({ status: 'cancelled', finished_at: new Date(at).toISOString() })
          .eq('id', id).eq('status', 'queued').select(JOB_COLUMNS).maybeSingle()
        if (error) throw error
        if (!data) return res.status(409).json({ error: 'ยกเลิกไม่ได้ คอมสำนักงานเริ่มสร้างภาพนี้ไปแล้ว หรืองานจบไปแล้ว' })
        return res.status(200).json({ job: data })
      }

      return res.status(400).json({ error: 'ไม่รู้จักคำสั่งนี้' })
    } catch (error) {
      const missing = ['42P01', 'PGRST205'].includes(error?.code)
      if (!missing) console.error('marketing-image-jobs api error:', error?.message || error)
      return res.status(missing ? 503 : 500).json({
        error: missing
          ? 'ยังไม่ได้ติดตั้งคิวสร้างภาพ — รัน supabase_marketing_image_jobs.sql ใน Supabase ก่อน'
          : 'อ่านหรือบันทึกงานสร้างภาพไม่สำเร็จ กรุณาลองใหม่',
      })
    }
  }
}

export default createImageJobsHandler()

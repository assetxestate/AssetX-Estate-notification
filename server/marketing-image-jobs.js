// คิวสร้างภาพโพสต์ผ่าน ChatGPT บนคอมสำนักงาน — API ฝั่งเซิร์ฟเวอร์ของหน้าต่าง "ออกแบบภาพโพสต์"
// ตาราง/bucket: supabase_marketing_image_jobs.sql · ตัวรับงาน: scripts/image-worker.mjs (รันบนคอมที่ล็อกอิน Codex ด้วย ChatGPT Plus)
//
// GET  /api/marketing-image-jobs                         → { worker }                สถานะตัวรับงานบนคอม
// GET  /api/marketing-image-jobs?id=N[&image=1]          → { job, worker, image? }   image = data URL เมื่อ done และขอ image=1
// GET  /api/marketing-image-jobs?post_key=K[&image=1]    → { job|null, worker, image? } งานล่าสุดของโพสต์ใน 24 ชม. (เปิดหน้าต่างใหม่แล้วตามงานต่อ)
// POST { action: "create", post_key, content_no, title, caption, size, mode } → { job, reused }   size = คีย์ใน src/lib/posterSizes.js · mode = free (ค่าเริ่มต้น ตั้งแต่ 8 พ.ย. 2569) | ref | premium (9 พ.ย. 2569)
// POST { action: "cancel", id }                          → { job }                   ยกเลิกได้เฉพาะงานที่ยังไม่มีใครหยิบ
//
// ข้อความโพสต์ผ่านตัวลบข้อมูลบุคคลก่อนเก็บและก่อนส่งให้ Codex · ไม่มีการลบแถว (ยกเลิก = cancelled)
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '../api/_auth.js'
import { scrub } from './research/pii.js'
import { POSTER_SIZES, DEFAULT_POSTER_SIZE, cropPlan } from '../src/lib/posterSizes.js'
import { POSTER_DESIGN_SYSTEM, POSTER_TEXT_RULES, pickPosterLayout, posterLayoutInstruction, pickHeadlineKeyword } from '../src/lib/posterDesignSystem.js'
import { posterBriefFor } from '../src/lib/posterBrief.js'
import { buildCompactPosterPrompt } from '../src/lib/posterV4.js'
import { posterSeed } from '../src/lib/posterVariants.js'
import { buildFreePosterPrompt } from '../src/lib/posterFree.js'
import { buildPremiumJobPrompt } from '../src/lib/posterPremium.js'
import { stripEmoji } from '../src/lib/captionEmoji.js'

export const IMAGE_BUCKET = 'marketing-images'
export const WORKER_ID = 'office-pc'
const JOB_COLUMNS = 'id,status,post_key,content_no,title,size,aspect,image_path,error,created_at,claimed_at,finished_at'
const ACTIVE = ['queued', 'running']
export const MAX_ACTIVE_JOBS = 3
export const WORKER_ONLINE_MS = 90 * 1000
const RECENT_MS = 24 * 60 * 60 * 1000
const CAPTION_LIMIT = 1500


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

// แผนที่แถวบนแคนวาส (พิกเซล) สำหรับขนาดที่ต้องครอปบน-ล่าง — โมเดลทำตามโซนที่บอกเป็น % ของ "โปสเตอร์สุดท้าย" ไม่ตรงเมื่อเนื้อหาแน่น
// (7 พ.ย. 2569: พาดหัวและปุ่มโดนตัดหลังครอป 2 จาก 3 ภาพ) จึงบอกเป็นพิกเซลของแคนวาสตรง ๆ ตาม VERTICAL BUDGET ของระบบออกแบบ
export function canvasMap(plan) {
  if (!/top/.test(String(plan.edges || ''))) return ''
  // เผื่อระยะ ~30% ของส่วนที่ตัด: โมเดลวางเลยเส้นล่างราว 40 px แม้บอกพิกเซลตรง ๆ (ครอปจริง 7 พ.ย. 2569 ปุ่มติดต่อโดนตัดครึ่ง) — โซนทั้งหมดจึงหดเข้าด้านในอีกนิด
  const slack = Math.round(plan.cutPx * 0.3)
  const top = plan.cutPx + slack
  const usable = plan.sourceHeight - 2 * top
  const y = (pct) => Math.round(top + usable * pct / 100)
  // แถบทึบบน-ล่าง: คำว่า "พื้นหลังเท่านั้น" โมเดลยังเอาแถบติดต่อไปวาง (5 ภาพ ผ่าน 1) — "แถบน้ำเงินทึบที่จะถูกตัดทิ้ง" เป็นภาพที่ชัดกว่า และถ้าแถบล่างไหลเข้าไปก็ถูกตัดเป็นสีเดียวกันโดยไม่เสียอะไร
  return `LETTERBOX BARS AND CANVAS MAP (${plan.sourceWidth}x${plan.sourceHeight} px, y measured from the top edge): paint y 0-${top} and y ${y(100)}-${plan.sourceHeight} as solid flat navy #08213f bars with NOTHING on them - no text, no pill, no logo, no photo (these bars are cut off before posting). The poster lives only between the bars: logo chip and headline block y ${y(5)}-${y(22)} · ribbon y ${y(22)}-${y(27)} · hero zone y ${y(3)}-${y(27)} on the right 36% of the width · main card y ${y(29)}-${y(72)} · action panel y ${y(74)}-${y(85)} · callout y ${y(86)}-${y(90)} · bottom band y ${y(90)}-${y(100)} sitting directly on top of the lower bar, with its CTA pill vertically centred in that band (so the pill is at least ${slack + Math.round(usable * 0.02)} px above y=${y(100)}). Shrink the text, never the bars or the margins, if the content does not fit.`
}

// คำสั่งภาพจากเนื้อหาโพสต์: Codex (โมเดลภาษา) อ่านเนื้อหาแล้วเลือกฉาก + สร้างการ์ดเนื้อหาตามโครงโพสต์ ก่อนเรียกเครื่องมือสร้างภาพ
// v2 (7 พ.ย. 2569): ใช้ระบบออกแบบโปสเตอร์ร่วม (src/lib/posterDesignSystem.js) — การ์ดเนื้อหาเป็นหัวใจของภาพ แทน "ป้าย 3 ป้าย" แบบเดิมที่ภาพออกมาโล่งและเหมือนกันทุกโพสต์
// seed = ชุดสไตล์ (src/lib/posterVariants.js posterSeed จากเลขโพสต์ + ลำดับงานของโพสต์) · ไม่ส่ง = ชุดแรก (หน้าตา v4 เดิม)
// mode = 'free' → โหมดอิสระ (src/lib/posterFree.js): Codex เป็นอาร์ตไดเรกเตอร์ ออกแบบเองจากหัวข้อ ข้อความจากโพสต์ และบรีฟมู้ดแอนด์โทน (เจ้าของ 7 พ.ย. 2569 ดึก)
// ค่าเริ่มต้นของ API create = โหมดอิสระ (เจ้าของ 8 พ.ย. 2569: "ให้โหมดอิสระเป็นค่าเริ่มต้นแทนตามเรฟ") · ตัวสร้างคำสั่งข้างล่างยังตั้งต้นที่ ref เพื่อให้เรียกตรงได้แบบเดิม
// mode = 'premium' → โหมดพรีเมียม (src/lib/posterPremium.js · เจ้าของ 9 พ.ย. 2569 "อยากให้ระบบทำได้แบบที่ Codex ทำ เป็นอีกสไตล์"):
//   งานในคิวเก็บแค่ "คำขอ" (หัวข้อ + โพสต์) — ตัวรับงานให้ AI วางบรีฟ 6 ส่วน + ข้อความบนภาพ แล้วประกอบคำสั่งภาพเองบนคอมสำนักงาน
export const POSTER_MODES = ['ref', 'free', 'premium']
export const DEFAULT_POSTER_MODE = 'free'
export function buildPosterJobPrompt({ title = '', caption = '', size = DEFAULT_POSTER_SIZE, seed = null, mode = 'ref' } = {}) {
  // อีโมจิในแคปชั่น (src/lib/captionEmoji.js · 10 พ.ย. 2569) ไม่ขึ้นโปสเตอร์: ทุกโหมดห้ามไอคอนแบบอีโมจิ และข้อความบนภาพต้องตรงกับโพสต์ส่วนที่เป็นตัวหนังสือ
  const headline = oneLine(stripEmoji(title)).slice(0, 120) || 'รับจำนอง · ขายฝาก'
  const body = multiLine(stripEmoji(caption)).slice(0, CAPTION_LIMIT)
  if (mode === 'free') return buildFreePosterPrompt({ title: headline, caption: body, size, seed })
  if (mode === 'premium') return buildPremiumJobPrompt({ title: headline, caption: body, size, seed })
  // v4 "ตามเรฟ" (7 พ.ย. 2569 ค่ำ): โพสต์ที่มีเนื้อหาใช้คำสั่งแบบบีบสั้นตามสคีมาของสกิล Codex + ภาพแนบที่ตัวรับงานเติม (ดู src/lib/posterV4.js)
  // ไม่มีเนื้อหา (ป้าย 3 ป้าย) ยังใช้คำสั่ง v3.2 แบบเดิม
  if (body) return buildCompactPosterPrompt({ title: headline, caption: body, size, layout: pickPosterLayout(body), seed })
  return buildLegacyPosterJobPrompt({ title, caption, size })
}

// คำสั่ง v3.2 แบบเดิม (ระบบออกแบบ + บรีฟรายโพสต์ + แถบน้ำเงิน) — ใช้กับโพสต์ไม่มีเนื้อหา และเป็นรูปแบบที่ชั้นบรีฟ AI ของตัวรับงาน (server/poster-brief-ai.js) อ่าน
export function buildLegacyPosterJobPrompt({ title = '', caption = '', size = DEFAULT_POSTER_SIZE } = {}) {
  const headline = oneLine(title).slice(0, 120) || 'รับจำนอง · ขายฝาก'
  const body = multiLine(caption).slice(0, CAPTION_LIMIT)
  const plan = cropPlan(size)
  const ratio = `${plan.width}:${plan.height}`
  const layout = body ? pickPosterLayout(body) : 'explain'
  const keyword = pickHeadlineKeyword(headline)
  return [
    `Design ONE finished ${SHAPES[plan.aspect]} Thai social-media poster for AssetX Estate, a Thai real-estate consultancy for ขายฝาก (sale with right of redemption) and จำนอง (mortgage). It will be posted as a ${plan.platform} image (${plan.width}x${plan.height} px).`,
    plan.edges
      ? `SAFE AREA (strict): the ${plan.sourceWidth}x${plan.sourceHeight} image will be center-cropped to ${ratio}, cutting ${plan.cutPx} px off the ${plan.edges} edges. Keep the headline, the content card, the logo and all text at least ${plan.safePx} px away from the ${plan.edges} edges; the outer ${plan.cutPx} px strips contain background scenery only. The bottom band is the one exception: its lower edge sits exactly ${plan.cutPx} px above the bottom edge (on the crop line) so the cropped poster ends with the band, with the band's text at least ${plan.safePx} px from the bottom edge.`
      : 'SAFE AREA: keep all text and the logo at least 5% away from every edge.',
    ...(plan.edges && canvasMap(plan) ? [canvasMap(plan)] : []),
    'The attached image is the official AssetX logo mark. Place it exactly as the LOGO rule of the design system says (small, top corner, white chip, no text beside it). Do not redraw or alter it.',
    '',
    POSTER_DESIGN_SYSTEM,
    '',
    'HEADLINE (render exactly, large and bold in the top zone; you may break it into two lines but must not change, add or drop any Thai character):',
    headline,
    ...(keyword ? [`KEY WORD to highlight in the cyan-to-coral gradient (this whole word only, every other headline letter stays white): ${keyword}`] : []),
    '',
    body
      ? [
          'POST CONTENT (context: read it, then build the sub-line and the content card from it; do not paste it whole):',
          '"""', body, '"""',
          '',
          `CONTENT CARD (layout: ${layout}): ${posterLayoutInstruction(layout)} Every row on the card must be copied exactly from the post text (no new words, no paraphrase), must read as a complete idea on its own and must not start with a connecting word such as และ, หรือ, แต่ or ที่. If a row cannot be copied safely, use fewer rows.`,
          'CARD TITLE (navy pill): 2-4 Thai words copied from the post that name the topic of the rows.',
          'BENEFIT RIBBON: one complete phrase copied from the post (4 to 10 Thai words) that tells the reader what they get or why this matters to them. If none fits, leave the ribbon out.',
          'ACTION PANEL (below the main card): a title of 1-4 Thai words copied from the post that introduces the actions (e.g. its "ก่อนเซ็น" lead-in; none if the post has none), then 2 or 3 items, each ONE complete clause of 5-12 Thai words copied from the post that tells the reader what to do next or what to check (split the post\'s instruction sentence into its clauses if needed).',
          'CALLOUT CHIP (optional, below the action panel): one sentence of at most 12 Thai words copied from the post - a key reminder that is not already on the card or the action panel; leave it out if there is none.',
          'BOTTOM-BAND CHIPS: 2 or 3 two-word labels copied from the post, or nothing.',
          'READABILITY TEST: after composing, check that the headline, ribbon, card rows and action items alone tell the whole story of the post (topic, key facts, what to do); if a row is only a fragment, replace it with the full clause from the post.',
          '',
          // บรีฟครีเอทีฟรายโพสต์ (ก๊อปปี้เด็ค + อาร์ตไดเรกชัน) — ฐานแบบกำหนดกฎ ตัวรับงานบนคอมสำนักงานให้ AI ในเครื่องเขียนละเอียดกว่าแล้วแทนบล็อกนี้ได้ (ตรวจคำต่อคำก่อน)
          posterBriefFor({ title: headline, caption: body, layout }).brief,
        ].join('\n')
      : 'SUPPORTING BADGES (render exactly): ประเมินเบื้องต้น | ปรึกษาฟรี | ดูแลเอกสาร',
    '',
    'BOTTOM CTA BAND (render exactly): ติดต่อ AssetX Estate',
    '',
    `HERO ZONE CONTENT: ${layout === 'warning' ? 'a plain document being inspected, no person' : 'a small photoreal cluster matching this post, or a head-and-shoulders advisor if the post is about advice'} (document and pen for contract, cost or legal topics; land plot with pegs for land topics; modern house for housing topics; coin stacks for money topics; consultation desk for advice topics) - inside the hero zone only, never reducing the content area. Photorealistic advertising composite, polished graphic design, clear hierarchy, high contrast, readable on a phone.`,
    '',
    'RULES:',
    ...POSTER_TEXT_RULES.map((rule) => `- ${rule}`),
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
        // ชุดสไตล์: งานที่ N ของโพสต์เดิม (รวมงานที่เสร็จ/ล้ม/ยกเลิก) ได้ seed ใหม่ → กด "สร้างโปสเตอร์ใหม่" ได้หน้าตาใหม่ (เจ้าของ 7 พ.ย. 2569: ภาพคล้ายกันทุกโพสต์)
        const prior = await db.from('marketing_image_jobs').select('id', { count: 'exact', head: true }).eq('post_key', postKey)
        if (prior.error) throw prior.error
        const seed = posterSeed({ contentNo: Number.isInteger(contentNo) && contentNo > 0 ? contentNo : null, postKey, jobIndex: prior.count || 0 })
        const mode = POSTER_MODES.includes(body.mode) ? body.mode : DEFAULT_POSTER_MODE
        const row = {
          status: 'queued',
          post_key: postKey,
          content_no: Number.isInteger(contentNo) && contentNo > 0 ? contentNo : null,
          title: title || null,
          prompt: buildPosterJobPrompt({ title, caption, size, seed, mode }),
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

// Content Brief + Proof Card + บันทึกการอนุมัติ ของหน้า /marketing — API หลังล็อกอิน (เฟส P0 · 23 พ.ย. 2569)
// ตาราง: supabase_marketing_proof.sql (service role เท่านั้น) · ตรรกะล้วน: src/lib/marketingProof.js + src/lib/marketingReviewGate.js
// ธงเปิดใช้: MARKETING_PROOF_CARDS=1 (ปิดเป็นค่าเริ่มต้น — ปิดอยู่ = หน้า /marketing และด่านโพสต์ทำงานแบบเดิมทุกอย่าง)
//
// GET  /api/marketing-proof?flags=1            → { flags: { proofCards }, ready }      ready = ตารางพร้อม
// GET  /api/marketing-proof?brief=<id>         → { brief, claims, sources, links }
// GET  /api/marketing-proof?content=<postId>   → เหมือนกัน (หาโดยคอนเทนต์) · ไม่มีบรีฟ = { brief: null } + review ล่าสุด
// POST { action: "save-brief", brief, id?, version? }                → { brief }
// POST { action: "save-source", briefId, source, id?, version? }     → { source }
// POST { action: "save-claim", briefId, claim, sourceIds?, id?, version? } → { claim, links }
// POST { action: "review-claim", id, version, status, reviewer }     → { claim }
// POST { action: "attach-content", briefId, contentId, contentNo? }  → { brief }
// POST { action: "gate", post, briefId? }                            → { gate }       ตรวจอย่างเดียว ไม่บันทึก
// POST { action: "approve", post, reviewer, reason? }                → { review, gate } ติดตัวบล็อก = 422 ไม่บันทึกเป็นอนุมัติ
// POST { action: "write-request", briefId, note? }                   → { job, reused, worker }   ให้ AI บนคอมสำนักงานเขียนจากโน้ต (server/briefWriter.js)
// GET  /api/marketing-proof?job=<id> | ?briefJob=<briefId>           → { job, worker }           สถานะ/ผลของงานเขียน (briefJob = งานล่าสุดของบรีฟ)
//
// version: ทุกการแก้ต้องส่ง version ที่อ่านมา ไม่ตรง = 409 (มีคนแก้ไปก่อนจากอีกแท็บ/เครื่อง) — ไม่เขียนทับเงียบ ๆ
// ห้าม log ข้อความบรีฟ/ข้ออ้าง (อาจมีรายละเอียดหน้างาน) · log ได้เฉพาะรหัสข้อผิดพลาด
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '../api/_auth.js'
import { CLAIM_STATUS, canComposeFromBrief, normalizeBrief, normalizeClaim, normalizeSource, verifyProblems } from '../src/lib/marketingProof.js'
import { scrub } from './research/pii.js'
import { approvalBasis, buildReviewGate, gateBlockerText } from '../src/lib/marketingReviewGate.js'

const SQL_FILE = 'supabase_marketing_proof.sql'
const MISSING_TABLE = new Set(['42P01', 'PGRST205'])
const MAX_CAPTION = 20000
// คิว "ให้ AI เขียนจากโน้ต" (supabase_marketing_brief_jobs.sql) — ตัวรับงานเดียวกับคิวภาพบนคอมสำนักงาน
const JOBS_TABLE = 'marketing_brief_jobs'
const JOBS_SQL = 'supabase_marketing_brief_jobs.sql'
const JOB_COLUMNS = 'id,status,brief_id,result,error,created_at,claimed_at,finished_at'
const MAX_ACTIVE_JOBS = 3
const WORKER_ONLINE_MS = 90 * 1000
const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const positiveInt = (value) => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null }

export const proofFlagOn = (env = process.env) => /^(1|true|on|yes)$/i.test(String(env.MARKETING_PROOF_CARDS || '').trim())

export const proofDatabase = () => defaultDatabase()

function defaultDatabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
}

class ApiError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra }
}
const unwrap = ({ data, error }) => { if (error) throw error; return data }

// แถวบรีฟ ↔ รูปที่หน้าเว็บใช้ (ช่องหลักเป็นคอลัมน์ ที่เหลืออยู่ใน input)
function briefOut(row) {
  if (!row) return null
  return { ...(row.input || {}), id: row.id, version: row.version, content_id: row.content_id, content_no: row.content_no, brand_id: row.brand_id, topic: row.topic, audience: row.audience, objective: row.objective, created_by: row.created_by, created_at: row.created_at, updated_at: row.updated_at }
}
function briefColumns(value) {
  const { topic, audience, objective, brand_id: brandId, ...input } = value
  return { topic, audience, objective, brand_id: brandId, input }
}

export async function loadProof(db, { briefId = null, contentId = null } = {}) {
  let query = db.from('marketing_content_briefs').select('*')
  if (briefId) query = query.eq('id', briefId)
  else if (contentId) query = query.eq('content_id', String(contentId))
  else return null
  const row = unwrap(await query.maybeSingle())
  if (!row) return null
  const claims = unwrap(await db.from('marketing_proof_claims').select('*').eq('brief_id', row.id).order('id', { ascending: true })) || []
  const sources = unwrap(await db.from('marketing_evidence_sources').select('*').eq('brief_id', row.id).order('id', { ascending: true })) || []
  const links = claims.length
    ? unwrap(await db.from('marketing_claim_sources').select('*').in('claim_id', claims.map((claim) => claim.id))) || []
    : []
  return { brief: briefOut(row), claims, sources, links }
}

async function latestReview(db, contentId) {
  const rows = unwrap(await db.from('marketing_content_reviews').select('*').eq('content_id', String(contentId)).order('id', { ascending: false }).limit(1)) || []
  return rows[0] || null
}

// สถานะตัวรับงานบนคอมสำนักงาน · writer = รุ่นที่รับงานเขียนจากโน้ตได้ (รุ่นเก่ายังเปิดอยู่ = งานค้างในคิว หน้าเว็บบอกให้เปิดใหม่)
async function readWorker(db, now) {
  const { data, error } = await db.from('marketing_image_worker').select('id,last_seen_at,info').eq('id', 'office-pc').maybeSingle()
  if (error) return { online: false, writer: false, last_seen_at: null }
  const lastSeen = data?.last_seen_at ? Date.parse(data.last_seen_at) : NaN
  return { online: Number.isFinite(lastSeen) && now - lastSeen <= WORKER_ONLINE_MS, writer: Boolean(data?.info?.brief_writer), last_seen_at: data?.last_seen_at || null }
}

// ตารางคิวยังไม่ถูกสร้าง → ข้อความเฉพาะ (ส่วนอื่นของ Proof Card ยังใช้ได้)
const jobsQuery = async (query) => {
  const out = await query
  if (out.error && MISSING_TABLE.has(out.error.code)) throw new ApiError(503, `ยังไม่ได้ติดตั้งคิวให้ AI เขียนจากโน้ต (รัน ${JOBS_SQL} ใน Supabase ครั้งเดียว)`, { missingJobsTable: true })
  if (out.error) throw out.error
  return out
}

const hashOf = (post, proof) => crypto.createHash('sha256').update(approvalBasis(post, proof)).digest('hex')

// ส่วนของโพสต์ที่ด่านใช้ — รับเฉพาะช่องที่รู้จัก (ไม่เชื่อ reviewStatus/สถานะที่เบราว์เซอร์ส่งมา)
function postOf(input = {}) {
  const post = {
    id: text(input.id, 80),
    contentNo: positiveInt(input.contentNo),
    title: String(input.title ?? input.headline ?? '').slice(0, 300),
    caption: String(input.caption ?? ''),
    videoScript: String(input.videoScript ?? '').slice(0, MAX_CAPTION),
    topic: String(input.topic ?? '').slice(0, 300),
    channel: text(input.channel, 40),
    mediaAssetId: text(input.mediaAssetId, 120),
    draftSource: ['ai', 'brief'].includes(input.draftSource) ? input.draftSource : undefined,
  }
  if (post.caption.length > MAX_CAPTION) throw new ApiError(400, 'ข้อความโพสต์ยาวเกินไป')
  return post
}

// ด่านก่อนส่งออกจริง (เรียกจาก server/marketing-facebook.js เมื่อธงเปิด): ต้องมีบันทึกอนุมัติของคนที่ตรงกับเนื้อหาฉบับนี้
// และตรวจซ้ำ ณ เวลาส่ง (หลักฐานอาจหมดอายุหรือถูกถอนสิทธิหลังอนุมัติ) · ผิดเงื่อนไข = โยนข้อความไทย
export async function assertApprovedForPublish(db, rawPost, { now = Date.now() } = {}) {
  if (!db) throw new Error('ยังไม่ได้ตั้งค่าฐานข้อมูลฝั่งเซิร์ฟเวอร์ จึงตรวจบันทึกการอนุมัติไม่ได้')
  const post = postOf(rawPost)
  if (!post.id) throw new Error('ไม่พบรหัสคอนเทนต์ จึงตรวจบันทึกการอนุมัติไม่ได้')
  let review
  let proof
  try {
    review = await latestReview(db, post.id)
    proof = await loadProof(db, { contentId: post.id })
  } catch (error) {
    if (MISSING_TABLE.has(error?.code)) throw new Error('ยังไม่ได้สร้างตารางหลักฐานของระบบการตลาด จึงยังส่งโพสต์ไม่ได้')
    throw new Error('ตรวจบันทึกการอนุมัติไม่สำเร็จ ลองใหม่อีกครั้ง')
  }
  if (!review || review.decision !== 'approved') throw new Error('ยังไม่มีบันทึกการอนุมัติของคนสำหรับคอนเทนต์นี้ — กลับไปแท็บ ร่าง แล้วกดอนุมัติ')
  if (review.content_hash !== hashOf(post, proof)) throw new Error('ข้อความ ภาพ หรือหลักฐานเปลี่ยนหลังอนุมัติ — กลับไปแท็บ ร่าง ตรวจและอนุมัติใหม่ก่อนส่ง')
  const gate = buildReviewGate(post, proof, { now })
  if (gate.blocked) throw new Error(['ส่งไม่ได้ เพราะยังติดเกณฑ์:', ...gateBlockerText(gate)].join('\n'))
  return { review, gate }
}

async function versionedUpdate(db, table, id, version, patch) {
  const current = positiveInt(version)
  if (!current) throw new ApiError(400, 'ไม่พบเลขเวอร์ชันของรายการที่จะแก้ โหลดข้อมูลใหม่แล้วลองอีกครั้ง')
  const row = unwrap(await db.from(table).update({ ...patch, version: current + 1 }).eq('id', id).eq('version', current).select('*').maybeSingle())
  if (!row) throw new ApiError(409, 'รายการนี้ถูกแก้จากอีกแท็บหรืออีกเครื่องไปแล้ว — โหลดข้อมูลล่าสุดก่อนแก้ต่อ (ข้อความที่พิมพ์ยังอยู่ในหน้านี้)', { conflict: true })
  return row
}

async function claimWithSources(db, claimId) {
  const claim = unwrap(await db.from('marketing_proof_claims').select('*').eq('id', claimId).maybeSingle())
  if (!claim) throw new ApiError(404, 'ไม่พบข้ออ้างนี้')
  const links = unwrap(await db.from('marketing_claim_sources').select('*').eq('claim_id', claimId)) || []
  const sources = links.length
    ? unwrap(await db.from('marketing_evidence_sources').select('*').in('id', links.map((link) => link.source_id))) || []
    : []
  return { claim, links, sources }
}

const VERIFY_FIELDS = ['claim_text', 'claim_type', 'publishable_wording', 'permission_status', 'expires_at', 'category']

async function actions(db, body, now) {
  const fail = (result) => { throw new ApiError(400, result.errors.join(' · ')) }

  if (body.action === 'save-brief') {
    const result = normalizeBrief(body.brief || {})
    if (!result.ok) fail(result)
    const columns = briefColumns(result.value)
    const id = positiveInt(body.id)
    if (id) return { brief: briefOut(await versionedUpdate(db, 'marketing_content_briefs', id, body.version, columns)) }
    const row = unwrap(await db.from('marketing_content_briefs').insert({ ...columns, created_by: text(body.createdBy, 80) }).select('*').maybeSingle())
    return { brief: briefOut(row) }
  }

  if (body.action === 'save-source') {
    const result = normalizeSource(body.source || {})
    if (!result.ok) fail(result)
    const { note, ...columns } = result.value
    const fields = { ...columns, metadata: { note } }
    const id = positiveInt(body.id)
    if (id) return { source: await versionedUpdate(db, 'marketing_evidence_sources', id, body.version, fields) }
    const briefId = positiveInt(body.briefId)
    if (!briefId) throw new ApiError(400, 'บันทึกบรีฟก่อนเพิ่มแหล่งข้อมูล')
    return { source: unwrap(await db.from('marketing_evidence_sources').insert({ ...fields, brief_id: briefId }).select('*').maybeSingle()) }
  }

  if (body.action === 'save-claim') {
    const result = normalizeClaim(body.claim || {})
    if (!result.ok) fail(result)
    const id = positiveInt(body.id)
    const sourceIds = Array.isArray(body.sourceIds) ? [...new Set(body.sourceIds.map(positiveInt).filter(Boolean))] : null
    let claim
    if (id) {
      const before = await claimWithSources(db, id)
      const oldIds = before.links.map((link) => Number(link.source_id)).sort((a, b) => a - b)
      const linksChanged = sourceIds !== null && JSON.stringify(oldIds) !== JSON.stringify([...sourceIds].sort((a, b) => a - b))
      const changed = linksChanged || VERIFY_FIELDS.some((key) => String(before.claim[key] ?? '') !== String(result.value[key] ?? ''))
      // ข้ออ้างที่ยืนยันแล้ว ถ้าเนื้อความ ประเภท สิทธิ หรือแหล่งเปลี่ยน ต้องยืนยันใหม่
      const patch = { ...result.value, ...(before.claim.status === 'verified' && changed ? { status: 'needs_check', reviewer: '', reviewed_at: null } : {}) }
      claim = await versionedUpdate(db, 'marketing_proof_claims', id, body.version, patch)
    } else {
      const briefId = positiveInt(body.briefId)
      if (!briefId) throw new ApiError(400, 'บันทึกบรีฟก่อนเพิ่มข้ออ้าง')
      claim = unwrap(await db.from('marketing_proof_claims').insert({ ...result.value, brief_id: briefId, status: result.value.claim_type === 'NEEDS-CHECK' ? 'needs_check' : 'draft' }).select('*').maybeSingle())
    }
    if (sourceIds !== null) {
      // แหล่งต้องเป็นของบรีฟเดียวกัน (กันผูกข้ามบรีฟด้วยการเรียก API ตรง)
      const owned = sourceIds.length
        ? (unwrap(await db.from('marketing_evidence_sources').select('id,brief_id').in('id', sourceIds)) || []).filter((source) => Number(source.brief_id) === Number(claim.brief_id)).map((source) => Number(source.id))
        : []
      unwrap(await db.from('marketing_claim_sources').delete().eq('claim_id', claim.id))
      if (owned.length) unwrap(await db.from('marketing_claim_sources').insert(owned.map((sourceId) => ({ claim_id: claim.id, source_id: sourceId }))))
    }
    const links = unwrap(await db.from('marketing_claim_sources').select('*').eq('claim_id', claim.id)) || []
    return { claim, links }
  }

  if (body.action === 'review-claim') {
    const id = positiveInt(body.id)
    if (!id) throw new ApiError(400, 'ไม่พบข้ออ้างที่จะตรวจ')
    if (!Object.hasOwn(CLAIM_STATUS, body.status)) throw new ApiError(400, 'สถานะของข้ออ้างไม่ถูกต้อง')
    const reviewer = text(body.reviewer, 80)
    const patch = { status: body.status }
    if (body.status === 'verified') {
      if (!reviewer) throw new ApiError(400, 'ใส่ชื่อผู้ตรวจก่อนยืนยันข้ออ้าง')
      const { claim, sources } = await claimWithSources(db, id)
      const problems = verifyProblems(claim, sources)
      if (problems.length) throw new ApiError(422, `ยังยืนยันไม่ได้: ${problems.join(' · ')}`)
      Object.assign(patch, { reviewer, reviewed_at: new Date(now).toISOString() })
    } else if (body.status === 'rejected') {
      Object.assign(patch, { reviewer, reviewed_at: new Date(now).toISOString(), use_in_post: false })
    }
    return { claim: await versionedUpdate(db, 'marketing_proof_claims', id, body.version, patch) }
  }

  if (body.action === 'attach-content') {
    const briefId = positiveInt(body.briefId)
    const contentId = text(body.contentId, 80)
    if (!briefId || !contentId) throw new ApiError(400, 'ไม่พบบรีฟหรือคอนเทนต์ที่จะผูก')
    const brief = unwrap(await db.from('marketing_content_briefs').select('*').eq('id', briefId).maybeSingle())
    if (!brief) throw new ApiError(404, 'ไม่พบบรีฟนี้')
    if (brief.content_id && brief.content_id !== contentId) throw new ApiError(409, 'บรีฟนี้ผูกกับคอนเทนต์ชิ้นอื่นแล้ว')
    if (brief.content_id === contentId) return { brief: briefOut(brief) }
    const taken = unwrap(await db.from('marketing_content_briefs').select('id').eq('content_id', contentId).maybeSingle())
    if (taken) throw new ApiError(409, 'คอนเทนต์นี้มีบรีฟผูกอยู่แล้ว')
    return { brief: briefOut(await versionedUpdate(db, 'marketing_content_briefs', briefId, brief.version, { content_id: contentId, content_no: positiveInt(body.contentNo) })) }
  }

  if (body.action === 'write-request') {
    const briefId = positiveInt(body.briefId)
    if (!briefId) throw new ApiError(400, 'บันทึกบรีฟก่อนให้ AI เขียน')
    const proof = await loadProof(db, { briefId })
    if (!proof?.brief) throw new ApiError(404, 'ไม่พบบรีฟนี้')
    if (!canComposeFromBrief(proof.brief, proof.claims)) throw new ApiError(400, 'ยังไม่มีข้อมูลให้ AI เขียน — ใส่ข้อสังเกตหน้างาน ข้อสังเกตเฉพาะ หรือยืนยันข้ออ้างอย่างน้อยหนึ่งอย่าง แล้วบันทึกร่าง')
    // กดซ้ำขณะงานของบรีฟเดิมยังไม่จบ = ตามงานเดิม (ไม่เปลืองโควตา ไม่ได้ผลสองชุด)
    const existing = await jobsQuery(db.from(JOBS_TABLE).select(JOB_COLUMNS).eq('brief_id', briefId).in('status', ['queued', 'running']).order('id', { ascending: false }).limit(1))
    if (existing.data?.[0]) return { job: existing.data[0], reused: true, worker: await readWorker(db, now) }
    const active = await jobsQuery(db.from(JOBS_TABLE).select('id').in('status', ['queued', 'running']))
    if ((active.data?.length || 0) >= MAX_ACTIVE_JOBS) throw new ApiError(429, `มีงานให้ AI เขียนรอคิวอยู่ ${active.data.length} งานแล้ว รอให้เสร็จก่อนแล้วค่อยสั่งเพิ่ม`)
    const note = scrub(String(body.note ?? '')).replace(/\s+/g, ' ').trim().slice(0, 200)
    const created = await jobsQuery(db.from(JOBS_TABLE).insert({ status: 'queued', brief_id: briefId, request: note ? { note } : {} }).select(JOB_COLUMNS).maybeSingle())
    return { job: created.data, reused: false, worker: await readWorker(db, now) }
  }

  if (body.action === 'gate' || body.action === 'approve') {
    const post = postOf(body.post || {})
    const briefId = positiveInt(body.briefId)
    // คอนเทนต์ที่ผูกบรีฟแล้วใช้บรีฟนั้นเสมอ (ไม่เชื่อ briefId จากเบราว์เซอร์) · ยังไม่ผูก = ใช้ briefId ที่ร่างนี้ถูกสร้างมา
    const bound = post.id ? await loadProof(db, { contentId: post.id }) : null
    let proof = bound || (briefId ? await loadProof(db, { briefId }) : null)
    const gate = buildReviewGate(post, proof, { now })
    if (body.action === 'gate') return { gate, proof }
    if (!post.id) throw new ApiError(400, 'ไม่พบรหัสคอนเทนต์ที่จะอนุมัติ')
    if (proof && !bound) {
      // อนุมัติครั้งแรกของร่างที่มาจากบรีฟ: ผูกบรีฟกับคอนเทนต์ก่อน ด่านส่งออกจึงหาหลักฐานเจอจากรหัสคอนเทนต์
      if (proof.brief.content_id) throw new ApiError(409, 'บรีฟนี้ผูกกับคอนเทนต์ชิ้นอื่นแล้ว')
      const row = await versionedUpdate(db, 'marketing_content_briefs', proof.brief.id, proof.brief.version, { content_id: post.id, content_no: post.contentNo })
      proof = { ...proof, brief: briefOut(row) }
    }
    const reviewer = text(body.reviewer, 80)
    if (!reviewer) throw new ApiError(400, 'ใส่ชื่อผู้ตรวจก่อนอนุมัติ')
    if (gate.blocked) throw new ApiError(422, 'ยังอนุมัติไม่ได้ เพราะติดเกณฑ์ที่ต้องแก้ก่อน', { gate, proof })
    const review = unwrap(await db.from('marketing_content_reviews').insert({
      content_id: post.id, content_no: post.contentNo, brief_id: proof?.brief?.id || null, content_hash: hashOf(post, proof),
      decision: 'approved', blockers: [], warnings: gate.editorial_warnings, claim_ids: gate.claim_ids_used,
      reviewer, reason: text(body.reason, 500),
    }).select('*').maybeSingle())
    return { review: { id: review.id, reviewer: review.reviewer, created_at: review.created_at, content_hash: review.content_hash }, gate }
  }

  throw new ApiError(400, 'ไม่รู้จักคำสั่งนี้')
}

export function createProofHandler({ authorized = verifySession, database = defaultDatabase, flag = proofFlagOn, clock = Date.now } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (!authorized(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' })
    const enabled = Boolean(flag())
    const db = database()
    try {
      if (req.method === 'GET' && req.query?.flags) {
        let ready = false
        if (enabled && db) {
          const probe = await db.from('marketing_content_reviews').select('id').limit(1)
          ready = !probe.error
        }
        return res.status(200).json({ flags: { proofCards: enabled }, ready })
      }
      // ธงปิด = ไม่มีฟีเจอร์นี้ (หน้าเว็บไม่เรียก · เรียกตรงก็ไม่ได้อะไร)
      if (!enabled) return res.status(404).json({ error: 'ฟีเจอร์นี้ยังไม่เปิดใช้' })
      if (!db) return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่าฐานข้อมูลฝั่งเซิร์ฟเวอร์' })

      if (req.method === 'GET' && (req.query?.job || req.query?.briefJob)) {
        const jobId = positiveInt(req.query.job)
        const ofBrief = positiveInt(req.query.briefJob)
        if (!jobId && !ofBrief) return res.status(400).json({ error: 'รหัสงานไม่ถูกต้อง' })
        const base = db.from(JOBS_TABLE).select(JOB_COLUMNS)
        const found = await jobsQuery(jobId ? base.eq('id', jobId).limit(1) : base.eq('brief_id', ofBrief).order('id', { ascending: false }).limit(1))
        return res.status(200).json({ job: found.data?.[0] || null, worker: await readWorker(db, clock()) })
      }
      if (req.method === 'GET') {
        const briefId = positiveInt(req.query?.brief)
        const contentId = text(req.query?.content, 80)
        if (!briefId && !contentId) return res.status(400).json({ error: 'ระบุบรีฟหรือคอนเทนต์ที่จะเปิด' })
        const proof = await loadProof(db, { briefId, contentId })
        const review = contentId ? await latestReview(db, contentId) : null
        return res.status(200).json({
          ...(proof || { brief: null, claims: [], sources: [], links: [] }),
          review: review ? { id: review.id, decision: review.decision, reviewer: review.reviewer, created_at: review.created_at } : null,
        })
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      return res.status(200).json(await actions(db, body, clock()))
    } catch (error) {
      if (error instanceof ApiError) return res.status(error.status).json({ error: error.message, ...error.extra })
      if (MISSING_TABLE.has(error?.code)) return res.status(503).json({ missingTable: true, error: `ยังไม่ได้สร้างตารางหลักฐานของระบบการตลาด (รัน ${SQL_FILE} ใน Supabase ครั้งเดียว)` })
      if (error?.code === '23505') return res.status(409).json({ error: 'รายการนี้ถูกบันทึกจากอีกแท็บไปแล้ว — โหลดข้อมูลล่าสุดก่อนแก้ต่อ', conflict: true })
      console.error('marketing proof failed:', error?.code || error?.name || 'error')
      return res.status(500).json({ error: 'บันทึกข้อมูลหลักฐานไม่สำเร็จ ลองใหม่อีกครั้ง' })
    }
  }
}

export default createProofHandler()

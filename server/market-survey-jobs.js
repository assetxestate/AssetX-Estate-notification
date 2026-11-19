// คิว "สำรวจราคาตลาด" — API ของปุ่มในหน้าประเมิน ขั้นที่ 2 (เจ้าของขอ 18 พ.ย. 2569)
// ตาราง: supabase_market_survey_jobs.sql · ตัวรับงาน: scripts/image-worker.mjs บนคอมสำนักงาน (server/market-survey-worker.js)
//
// GET  /api/market-survey                     → { worker }
// GET  /api/market-survey?id=N                → { job, worker }
// GET  /api/market-survey?valuation_id=N      → { job, worker }   งานล่าสุดของรายการประเมินนั้น (เปิดหน้าใหม่แล้วเห็นผลเดิม)
// POST { action: "create", valuation_id?, request } → { job, reused, worker }
// POST { action: "cancel", id }               → { job }   ยกเลิกได้เฉพาะงานที่ยังไม่มีใครหยิบ
//
// request ถูกสร้างใหม่ฝั่งเซิร์ฟเวอร์จากช่องที่อนุญาตเท่านั้น (ทำเลระดับแขวง/เขต ประเภท เนื้อที่) — ไม่รับเลขโฉนด พิกัด ชื่อ เบอร์
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '../api/_auth.js'
import { buildSurveyRequest, surveyRequestProblem } from '../src/lib/marketSurvey.js'

export const SURVEY_WORKER_ID = 'office-pc'
export const SURVEY_WORKER_ONLINE_MS = 90 * 1000
export const MAX_ACTIVE_SURVEY_JOBS = 2
const JOB_COLUMNS = 'id,status,valuation_id,request,result,error,created_at,claimed_at,finished_at'
const ACTIVE = ['queued', 'running']

function defaultDatabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
}

// สถานะตัวรับงาน: แถวเดียวกับคิวสร้างภาพ · survey = ตัวรับงานรุ่นที่รับงานสำรวจราคาได้
export function surveyWorkerStatus(row, now = Date.now()) {
  const lastSeen = row?.last_seen_at ? Date.parse(row.last_seen_at) : NaN
  return { online: Number.isFinite(lastSeen) && now - lastSeen <= SURVEY_WORKER_ONLINE_MS, survey: Boolean(row?.info?.market_survey), last_seen_at: row?.last_seen_at || null }
}

async function readWorker(db, now) {
  const { data, error } = await db.from('marketing_image_worker').select('id,last_seen_at,info').eq('id', SURVEY_WORKER_ID).maybeSingle()
  if (error) throw error
  return surveyWorkerStatus(data, now)
}

const positiveInt = (value) => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null }

export function createMarketSurveyHandler({ authorized = verifySession, database = defaultDatabase, now = () => Date.now() } = {}) {
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
        const id = positiveInt(url.searchParams.get('id'))
        const valuationId = positiveInt(url.searchParams.get('valuation_id'))
        if (url.searchParams.has('id') && !id) return res.status(400).json({ error: 'รหัสงานไม่ถูกต้อง' })
        if (id || valuationId) {
          let query = db.from('market_survey_jobs').select(JOB_COLUMNS)
          query = id ? query.eq('id', id) : query.eq('valuation_id', valuationId).neq('status', 'cancelled').order('created_at', { ascending: false })
          const { data, error } = await query.limit(1)
          if (error) throw error
          if (id && !data?.[0]) return res.status(404).json({ error: 'ไม่พบงานนี้' })
          return res.status(200).json({ job: data?.[0] || null, worker })
        }
        return res.status(200).json({ worker })
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {}

      if (body.action === 'create') {
        const input = body.request && typeof body.request === 'object' ? body.request : {}
        // สร้างใหม่จากช่องที่อนุญาตเท่านั้น: ช่องอื่นที่ส่งมา (เลขโฉนด ชื่อ เบอร์) ไม่ถูกเก็บและไม่ถึง AI
        const request = buildSurveyRequest({ province: input.province, district: input.district, subdistrict: input.subdistrict, propertySubtype: input.property, roadType: input.road }, { totalSqw: input.total_sqw, govPricePerSqw: input.gov_price_per_sqw })
        const problem = surveyRequestProblem(request)
        if (problem) return res.status(400).json({ error: problem })
        const valuationId = positiveInt(body.valuation_id)

        // กดซ้ำขณะงานของรายการเดิมยังไม่จบ = ตามงานเดิม (ไม่เปลืองโควตา ChatGPT)
        if (valuationId) {
          const existing = await db.from('market_survey_jobs').select(JOB_COLUMNS).eq('valuation_id', valuationId).in('status', ACTIVE).order('created_at', { ascending: false }).limit(1)
          if (existing.error) throw existing.error
          if (existing.data?.[0]) return res.status(200).json({ job: existing.data[0], reused: true, worker: await readWorker(db, at) })
        }
        const active = await db.from('market_survey_jobs').select('id', { count: 'exact', head: true }).in('status', ACTIVE)
        if (active.error) throw active.error
        if ((active.count || 0) >= MAX_ACTIVE_SURVEY_JOBS) return res.status(429).json({ error: `มีงานสำรวจราคารอคิวอยู่ ${active.count} งานแล้ว รอให้เสร็จก่อนแล้วค่อยสั่งเพิ่ม` })

        const { data, error } = await db.from('market_survey_jobs').insert({ status: 'queued', valuation_id: valuationId, request }).select(JOB_COLUMNS).maybeSingle()
        if (error) throw error
        return res.status(200).json({ job: data, reused: false, worker: await readWorker(db, at) })
      }

      if (body.action === 'cancel') {
        const id = positiveInt(body.id)
        if (!id) return res.status(400).json({ error: 'รหัสงานไม่ถูกต้อง' })
        const { data, error } = await db.from('market_survey_jobs').update({ status: 'cancelled', finished_at: new Date(at).toISOString() })
          .eq('id', id).eq('status', 'queued').select(JOB_COLUMNS).maybeSingle()
        if (error) throw error
        if (!data) return res.status(409).json({ error: 'ยกเลิกไม่ได้ คอมสำนักงานเริ่มสำรวจงานนี้ไปแล้ว หรืองานจบไปแล้ว' })
        return res.status(200).json({ job: data })
      }

      return res.status(400).json({ error: 'ไม่รู้จักคำสั่งนี้' })
    } catch (error) {
      const missing = ['42P01', 'PGRST205'].includes(error?.code)
      if (!missing) console.error('market-survey api error:', error?.message || error)
      return res.status(missing ? 503 : 500).json({
        error: missing ? 'ยังไม่ได้ติดตั้งคิวสำรวจราคาตลาด — รัน supabase_market_survey_jobs.sql ใน Supabase ก่อน' : 'อ่านหรือบันทึกงานสำรวจราคาไม่สำเร็จ กรุณาลองใหม่',
      })
    }
  }
}

export default createMarketSurveyHandler()

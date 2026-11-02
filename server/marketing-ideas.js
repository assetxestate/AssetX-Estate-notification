// คิวไอเดียรีเสิร์ช — API ฝั่งเซิร์ฟเวอร์ของหน้า /marketing (ไอเดียวันนี้)
// ให้เฉพาะคนที่ล็อกอินแอป (session cookie) · เบราว์เซอร์ไม่แตะตาราง marketing_ideas ตรง
// GET  /api/marketing-ideas?status=new&per_subtype=3&limit=30   → { ideas } วนรอบต่อ subtype ไม่ให้ท็อปเป็นประเภทเดียวกันหมด
// POST /api/marketing-ideas { action: "pick", id, chosen_angle }  → status picked (คนเลือกมุม → ระบบสร้างร่าง)
// POST /api/marketing-ideas { action: "dismiss", id, reason }     → status dismissed + เหตุผล (ใช้ปรับเกณฑ์)
// POST /api/marketing-ideas { action: "manual", title, url, note } → ไอเดียที่คนวางเอง (source manual · คะแนน 6)
// POST /api/marketing-ideas { action: "lead", ... }               → บันทึกลีดแบบไม่มีข้อมูลบุคคล (วงวัดผล "โพสต์ไหนได้ลีด")
// ไม่มีการลบ: ไอเดียหมดอายุ/ทิ้งเปลี่ยนสถานะเท่านั้น (กุญแจกันซ้ำต้องอยู่)
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '../api/_auth.js'
import { scrub } from './research/pii.js'
import { normalizeUrl } from './research/classify.js'

const STATUSES = ['new', 'picked', 'dismissed', 'expired']
const LEAD_CHANNELS = ['messenger', 'line', 'phone', 'web_form', 'walk_in', 'other']
const LEAD_SERVICES = ['ขายฝาก', 'จำนอง', 'ฝากขาย', 'หาซื้อ', 'อื่น']
const LEAD_BANDS = ['<500k', '500k-1m', '1-3m', '3-10m', '>10m']
const AUDIENCES = ['A', 'B', 'C', 'D']

function defaultDatabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
}

// วนรอบต่อ subtype: เรียงกลุ่มตามคะแนนสูงสุดของกลุ่ม แล้วหยิบทีละ 1 จากแต่ละกลุ่ม ไม่เกิน perSubtype ต่อกลุ่ม
export function roundRobinBySubtype(rows, { perSubtype = 3, limit = 30 } = {}) {
  const groups = new Map()
  for (const row of rows.slice().sort((a, b) => Number(b.score) - Number(a.score))) {
    const key = row.subtype || 'market'
    if (!groups.has(key)) groups.set(key, [])
    if (groups.get(key).length < perSubtype) groups.get(key).push(row)
  }
  const order = [...groups.values()].sort((a, b) => Number(b[0].score) - Number(a[0].score))
  const out = []
  for (let round = 0; out.length < limit; round += 1) {
    let added = false
    for (const group of order) {
      if (group[round]) { out.push(group[round]); added = true }
      if (out.length >= limit) break
    }
    if (!added) break
  }
  return out
}

function manualKey({ url, title }) {
  if (url) return `manual:${normalizeUrl(url)}`.slice(0, 500)
  return `manual:${String(title).toLowerCase().replace(/\s+/g, ' ').trim()}`.slice(0, 180)
}

function pick(obj, allowed) {
  const out = {}
  for (const key of allowed) if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') out[key] = obj[key]
  return out
}

export function createIdeasHandler({ authorized = verifySession, database = defaultDatabase } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (!authorized(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' })
    const db = database()
    if (!db) return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่าฐานข้อมูลฝั่งเซิร์ฟเวอร์' })
    try {
      if (req.method === 'GET') {
        const url = new URL(req.url || '/', 'http://assetx.local')
        const status = url.searchParams.get('status') || 'new'
        if (!STATUSES.includes(status)) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' })
        const perSubtype = Math.min(10, Math.max(1, Number(url.searchParams.get('per_subtype')) || 3))
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 30))
        const { data, error } = await db.from('marketing_ideas')
          .select('id,status,source,source_label,subtype,title,summary,url,angles,chosen_angle,score,audience,event_date,created_at')
          .eq('status', status).order('score', { ascending: false }).order('created_at', { ascending: false }).limit(200)
        if (error) throw error
        return res.status(200).json({ ideas: roundRobinBySubtype(data || [], { perSubtype, limit }), total: (data || []).length })
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const id = Number(body.id)

      if (body.action === 'pick' || body.action === 'dismiss') {
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'รหัสไอเดียไม่ถูกต้อง' })
        const patch = body.action === 'pick'
          ? { status: 'picked', chosen_angle: typeof body.chosen_angle === 'string' ? scrub(body.chosen_angle).slice(0, 60) : null }
          : { status: 'dismissed', dismiss_reason: scrub(String(body.reason || '')).slice(0, 300) || 'ไม่ระบุเหตุผล' }
        const { data, error } = await db.from('marketing_ideas').update(patch).eq('id', id).in('status', ['new', 'picked']).select('id,status').maybeSingle()
        if (error) throw error
        if (!data) return res.status(404).json({ error: 'ไม่พบไอเดียนี้ หรือสถานะเปลี่ยนไปแล้ว' })
        return res.status(200).json({ idea: data })
      }

      if (body.action === 'manual') {
        const title = scrub(String(body.title || '')).replace(/\s+/g, ' ').trim().slice(0, 300)
        const link = typeof body.url === 'string' && /^https?:\/\//i.test(body.url.trim()) ? body.url.trim() : null
        if (!title && !link) return res.status(400).json({ error: 'กรุณาใส่หัวข้อหรือลิงก์' })
        const row = {
          status: 'new', source: 'manual', source_label: 'วางเอง', subtype: 'market',
          title: title || link, summary: body.note ? scrub(String(body.note)).slice(0, 2000) : null, url: link,
          score: 6, external_key: manualKey({ url: link, title: title || link }), related_sku: null,
        }
        const { data, error } = await db.from('marketing_ideas').upsert(row, { onConflict: 'external_key', ignoreDuplicates: true }).select('id,title').maybeSingle()
        if (error) throw error
        if (!data) return res.status(409).json({ error: 'ไอเดียนี้มีอยู่แล้ว' })
        return res.status(200).json({ idea: data })
      }

      if (body.action === 'lead') {
        const lead = pick(body, ['channel', 'content_id', 'ref_code', 'heard_from', 'audience', 'service', 'property_type', 'service_area', 'amount_band', 'qualified', 'closed'])
        if (!LEAD_CHANNELS.includes(lead.channel)) return res.status(400).json({ error: 'ช่องทางลีดไม่ถูกต้อง' })
        if (lead.audience && !AUDIENCES.includes(lead.audience)) return res.status(400).json({ error: 'กลุ่มเป้าหมายไม่ถูกต้อง' })
        if (lead.service && !LEAD_SERVICES.includes(lead.service)) return res.status(400).json({ error: 'บริการไม่ถูกต้อง' })
        if (lead.amount_band && !LEAD_BANDS.includes(lead.amount_band)) return res.status(400).json({ error: 'ช่วงวงเงินไม่ถูกต้อง' })
        for (const field of ['heard_from', 'ref_code', 'property_type', 'service_area']) if (lead[field]) lead[field] = scrub(String(lead[field])).slice(0, 200)
        if (lead.content_id !== undefined) lead.content_id = Number(lead.content_id) || null
        const { data, error } = await db.from('leads').insert(lead).select('id,received_at').maybeSingle()
        if (error) throw error
        return res.status(200).json({ lead: data })
      }

      return res.status(400).json({ error: 'ไม่รู้จักคำสั่งนี้' })
    } catch (error) {
      const missing = ['42P01', 'PGRST205'].includes(error?.code)
      if (!missing) console.error('marketing-ideas api error:', error?.message || error)
      return res.status(missing ? 503 : 500).json({
        error: missing ? 'ยังไม่ได้ติดตั้งตารางคิวไอเดีย — รัน supabase_marketing_ideas.sql ใน Supabase ก่อน' : 'อ่านหรือบันทึกไอเดียไม่สำเร็จ กรุณาลองใหม่',
      })
    }
  }
}

export default createIdeasHandler()

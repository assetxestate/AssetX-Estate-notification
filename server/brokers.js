// ทะเบียนนายหน้า — API หลังล็อกอิน + ตัวลงทะเบียนอัตโนมัติเมื่อมี lead ใหม่จากหน้า /assess (เจ้าของขอ 19 พ.ย. 2569)
// ตาราง: supabase_brokers.sql (service role เท่านั้น ไม่มี DELETE — รวมรายชื่อใช้ merged_into) · ตรรกะล้วน: src/lib/brokers.js
//
// GET  /api/brokers                                   → { brokers }
// POST { action: "create", name, phone, line?, note?, code? } → { broker }
// POST { action: "update", id, name?, line?, note?, status? } → { broker }
// POST { action: "merge", id, into }                  → { broker }   รายชื่อ id กลายเป็นเบอร์สำรองของ into
// POST { action: "unmerge", id }                      → { broker }
// POST { action: "sync" }                             → { brokers, added }   เพิ่มคนที่เคยส่งงานแต่ยังไม่อยู่ในทะเบียน
//
// เบอร์โทรและชื่อเป็นข้อมูลส่วนบุคคล: ห้าม log · ข้อความเทเลแกรมใช้รหัสนายหน้าเท่านั้น
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '../api/_auth.js'
import { cleanRef } from '../src/lib/leadSource.js'
import { BROKER_STATUS, brokerCodeOf, brokerIndex, brokerOfLead, codeKey, findDuplicateLeads, leadFacts, phoneKey, CANCELLED_STATUS } from '../src/lib/brokers.js'

const LEAD_COLUMNS = 'id,created_at,status,lead_source,lead_ref,contact_name,contact_phone,contact_line,title_deed_no,deeds,province,district,subdistrict,total_sqw'
const LEAD_SCAN_LIMIT = 1000
const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const positiveInt = (value) => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null }

function defaultDatabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
}

async function allBrokers(db) {
  const { data, error } = await db.from('brokers').select('*').order('id', { ascending: true })
  if (error) throw error
  return data || []
}

async function recentLeads(db) {
  const { data, error } = await db.from('valuations').select(LEAD_COLUMNS).order('id', { ascending: false }).limit(LEAD_SCAN_LIMIT)
  if (error) throw error
  return data || []
}

// เพิ่มแถวใหม่แล้วออกรหัสจากเลขแถว (N001 …) เมื่อไม่ได้กำหนดรหัสเอง
async function insertBroker(db, fields) {
  const { data, error } = await db.from('brokers').insert(fields).select('*').maybeSingle()
  if (error) throw error
  if (data.code) return data
  const coded = await db.from('brokers').update({ code: brokerCodeOf(data.id) }).eq('id', data.id).select('*').maybeSingle()
  if (coded.error) throw coded.error
  return coded.data
}

// เรียกตอนแจ้งเตือน lead ใหม่ (api/assess-chat.js): ลงทะเบียนนายหน้าจากเบอร์ที่กรอก และตรวจทรัพย์ซ้ำ
// คืน { broker: { code, isNew, priorCount, mismatch, unidentified } | null, duplicates: [...] }
// ตาราง brokers ยังไม่ถูกสร้าง = broker เป็น null (การแจ้งเตือนและการตรวจทรัพย์ซ้ำยังทำงาน)
export async function registerLeadBroker(db, row) {
  const leads = await recentLeads(db).catch(() => [])
  const duplicates = findDuplicateLeads(row, leads)
  const facts = leadFacts(row)
  if (!facts.isBroker) return { broker: null, duplicates }
  if (!facts.phone) return { broker: { unidentified: true }, duplicates }
  try {
    let brokers = await allBrokers(db)
    let index = brokerIndex(brokers)
    let sender = index.byPhone.get(facts.phone)
    const isNew = !sender
    if (!sender) {
      try {
        sender = await insertBroker(db, { name: text(row.contact_name, 120), phone: text(row.contact_phone, 30), phone_key: facts.phone, line_id: text(row.contact_line, 60), status: 'new', first_lead_id: facts.id || null })
      } catch (error) {
        // สองรายการจากเบอร์เดียวกันเข้ามาพร้อมกัน: อีกคำขอสร้างไปแล้ว อ่านใหม่
        if (error?.code !== '23505') throw error
        brokers = await allBrokers(db)
        sender = brokerIndex(brokers).byPhone.get(facts.phone)
        if (!sender) throw error
      }
      brokers = [...brokers.filter((b) => b.id !== sender.id), sender]
      index = brokerIndex(brokers)
    }
    const mine = new Set(brokers.filter((b) => b.phone_key && Number(index.final(b).id) === Number(sender.id)).map((b) => b.phone_key))
    const priorCount = leads.filter((l) => { const f = leadFacts(l); return f.isBroker && f.id !== facts.id && f.status !== CANCELLED_STATUS && mine.has(f.phone) }).length
    return { broker: { code: sender.code || brokerCodeOf(sender.id), isNew: isNew || (sender.status === 'new' && priorCount === 0), priorCount, mismatch: Boolean(brokerOfLead(row, index)?.mismatch), unidentified: false }, duplicates }
  } catch (error) {
    if (!['42P01', 'PGRST205'].includes(error?.code)) console.error('broker register failed:', error?.message || error)
    return { broker: null, duplicates }
  }
}

export function createBrokersHandler({ authorized = verifySession, database = defaultDatabase } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (!authorized(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' })
    const db = database()
    if (!db) return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่าฐานข้อมูลฝั่งเซิร์ฟเวอร์' })
    try {
      if (req.method === 'GET') return res.status(200).json({ brokers: await allBrokers(db) })

      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const brokers = await allBrokers(db)
      const index = brokerIndex(brokers)

      if (body.action === 'create') {
        const key = phoneKey(body.phone)
        const name = text(body.name, 120)
        if (!name) return res.status(400).json({ error: 'กรอกชื่อนายหน้า' })
        if (!key) return res.status(400).json({ error: 'เบอร์โทรไม่ถูกต้อง (ต้องเป็นเบอร์ไทย 9–10 หลัก)' })
        const owner = index.byPhone.get(key)
        if (owner) return res.status(409).json({ error: `เบอร์นี้อยู่ในทะเบียนแล้ว (รหัส ${owner.code})` })
        const code = cleanRef(body.code)
        if (code && index.byCode.has(codeKey(code))) return res.status(409).json({ error: `รหัส ${code} มีคนใช้แล้ว` })
        const broker = await insertBroker(db, { name, phone: text(body.phone, 30), phone_key: key, line_id: text(body.line, 60), note: text(body.note, 500), status: 'active', ...(code ? { code } : {}) })
        return res.status(200).json({ broker })
      }

      if (body.action === 'sync') {
        const seen = new Set(index.byPhone.keys())
        const added = []
        for (const lead of [...await recentLeads(db)].reverse()) {
          const facts = leadFacts(lead)
          if (!facts.isBroker || !facts.phone || facts.status === CANCELLED_STATUS || seen.has(facts.phone)) continue
          seen.add(facts.phone)
          added.push(await insertBroker(db, { name: text(lead.contact_name, 120), phone: text(lead.contact_phone, 30), phone_key: facts.phone, line_id: text(lead.contact_line, 60), status: 'new', first_lead_id: facts.id }))
        }
        return res.status(200).json({ brokers: await allBrokers(db), added: added.length })
      }

      const id = positiveInt(body.id)
      const current = id ? index.byId.get(id) : null
      if (!current) return res.status(404).json({ error: 'ไม่พบนายหน้ารายนี้' })
      const save = async (patch) => {
        const { data, error } = await db.from('brokers').update(patch).eq('id', id).select('*').maybeSingle()
        if (error) throw error
        return res.status(200).json({ broker: data })
      }

      if (body.action === 'update') {
        const patch = {}
        if (body.name !== undefined) { patch.name = text(body.name, 120); if (!patch.name) return res.status(400).json({ error: 'กรอกชื่อนายหน้า' }) }
        if (body.line !== undefined) patch.line_id = text(body.line, 60)
        if (body.note !== undefined) patch.note = text(body.note, 500)
        if (body.status !== undefined) { if (!Object.hasOwn(BROKER_STATUS, body.status)) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' }); patch.status = body.status }
        if (!Object.keys(patch).length) return res.status(400).json({ error: 'ไม่มีข้อมูลที่จะแก้' })
        return save(patch)
      }

      if (body.action === 'merge') {
        const into = positiveInt(body.into)
        const target = into ? index.byId.get(into) : null
        if (!target) return res.status(404).json({ error: 'ไม่พบรายชื่อปลายทาง' })
        const finalTarget = index.final(target)
        if (Number(finalTarget.id) === id) return res.status(400).json({ error: 'รวมรายชื่อเข้ากับตัวเองไม่ได้' })
        return save({ merged_into: Number(finalTarget.id) })
      }

      if (body.action === 'unmerge') return save({ merged_into: null })

      return res.status(400).json({ error: 'ไม่รู้จักคำสั่งนี้' })
    } catch (error) {
      const missing = ['42P01', 'PGRST205'].includes(error?.code)
      if (!missing) console.error('brokers api error:', error?.message || error)
      return res.status(missing ? 503 : 500).json({
        missingTable: missing || undefined,
        error: missing ? 'ยังไม่ได้ติดตั้งทะเบียนนายหน้า — รัน supabase_brokers.sql ใน Supabase ก่อน' : 'อ่านหรือบันทึกทะเบียนนายหน้าไม่สำเร็จ กรุณาลองใหม่',
      })
    }
  }
}

export default createBrokersHandler()

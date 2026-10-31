// ไดอารี่งาน — API ฝั่งเซิร์ฟเวอร์ของหน้า /diary
// ให้เฉพาะคนที่ล็อกอินแอป AssetX (session cookie) · เบราว์เซอร์ไม่แตะตาราง diary_* ตรง
// GET  /api/diary                    → { days: [...], commands: [...] }
// POST /api/diary { action: "command", text }                       → เพิ่มคำสั่งถึง Claude (status new)
// POST /api/diary { action: "pending", date, pid, version, patch }  → ติ๊กจบ / เลือกทาง ในข้อค้างของวันนั้น (optimistic version)
// ไม่มีการลบ: ประวัติคำสั่งและบันทึกรายวันเก็บไว้เสมอ
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '../api/_auth.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_COMMAND = 2000
const MAX_CHOICE = 100
const MAX_NOTE = 500

function defaultDatabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
}

function fail(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

// แก้ข้อค้าง 1 ข้อใน pending[] ของวัน — รับเฉพาะฟิลด์ที่เจ้าของเปลี่ยนจากหน้าเว็บได้
// done:boolean → done/done_at · choice:string (+choice_note) → choice/choice_note/choice_at และตั้ง acted=false ให้ Claude ทำใหม่
export function applyPendingPatch(pending, pid, patch, now = new Date().toISOString()) {
  if (!Array.isArray(pending)) throw fail(404, 'วันนี้ไม่มีรายการค้าง')
  if (typeof pid !== 'string' || !pid || pid.length > 100) throw fail(400, 'รหัสรายการค้างไม่ถูกต้อง')
  const index = pending.findIndex((item) => item && item.id === pid)
  if (index < 0) throw fail(404, 'ไม่พบรายการค้างนี้')
  if (!patch || typeof patch !== 'object') throw fail(400, 'ไม่มีข้อมูลที่จะแก้')

  const item = { ...pending[index] }
  let touched = false
  if (typeof patch.done === 'boolean') {
    item.done = patch.done
    item.done_at = patch.done ? now : null
    touched = true
  }
  if (typeof patch.choice === 'string' && patch.choice.trim()) {
    const choice = patch.choice.trim()
    if (choice.length > MAX_CHOICE) throw fail(400, 'ตัวเลือกยาวเกินไป')
    const options = Array.isArray(item.options) ? item.options.map((o) => o && o.id) : []
    if (choice !== 'other' && !options.includes(choice)) throw fail(400, 'ไม่มีตัวเลือกนี้ในข้อค้าง')
    const note = typeof patch.choice_note === 'string' ? patch.choice_note.trim() : ''
    if (note.length > MAX_NOTE) throw fail(400, 'ข้อความทางเลือกยาวเกินไป')
    if (choice === 'other' && !note) throw fail(400, 'กรุณาพิมพ์ทางที่ต้องการ')
    item.choice = choice
    item.choice_note = note || null
    item.choice_at = now
    item.acted = false
    touched = true
  }
  if (!touched) throw fail(400, 'ไม่มีข้อมูลที่จะแก้')

  const next = pending.slice()
  next[index] = item
  return next
}

function newCommandId(now = Date.now()) {
  return `c-${now}-${Math.random().toString(36).slice(2, 8)}`
}

function dayRow(row) {
  return { ...(row.payload || {}), date: row.date, version: row.version }
}

export function createDiaryHandler({ authorized = verifySession, database = defaultDatabase } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (!authorized(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' })
    const db = database()
    if (!db) return res.status(503).json({ error: 'ระบบไดอารี่ยังไม่ได้ตั้งค่าฐานข้อมูลฝั่งเซิร์ฟเวอร์' })
    try {
      if (req.method === 'GET') {
        const [days, commands] = await Promise.all([
          db.from('diary_days').select('date,payload,version,updated_at').order('date', { ascending: false }),
          db.from('diary_commands').select('*').order('created_at', { ascending: false }).limit(100),
        ])
        if (days.error) throw days.error
        if (commands.error) throw commands.error
        return res.status(200).json({ days: (days.data || []).map(dayRow), commands: commands.data || [] })
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {}
      if (body.action === 'command') {
        const text = typeof body.text === 'string' ? body.text.trim() : ''
        if (!text) return res.status(400).json({ error: 'กรุณาพิมพ์คำสั่ง' })
        if (text.length > MAX_COMMAND) return res.status(400).json({ error: `คำสั่งยาวเกิน ${MAX_COMMAND} ตัวอักษร` })
        const { data, error } = await db.from('diary_commands').insert({ id: newCommandId(), text, status: 'new' }).select().maybeSingle()
        if (error) throw error
        if (!data) return res.status(500).json({ error: 'บันทึกคำสั่งไม่สำเร็จ กรุณาลองใหม่' })
        return res.status(200).json({ command: data })
      }

      if (body.action === 'pending') {
        const { date, pid, version, patch } = body
        if (typeof date !== 'string' || !DATE_RE.test(date)) return res.status(400).json({ error: 'วันที่ไม่ถูกต้อง' })
        if (!Number.isInteger(version) || version < 1) return res.status(400).json({ error: 'เวอร์ชันไม่ถูกต้อง' })
        const prior = await db.from('diary_days').select('date,payload,version').eq('date', date).maybeSingle()
        if (prior.error) throw prior.error
        if (!prior.data) return res.status(404).json({ error: 'ไม่พบบันทึกของวันนี้' })
        if (prior.data.version !== version) return res.status(409).json({ error: 'บันทึกเปลี่ยนแปลงแล้ว กำลังโหลดใหม่', day: dayRow(prior.data) })
        let pending
        try {
          pending = applyPendingPatch(prior.data.payload?.pending, pid, patch)
        } catch (error) {
          if (!error.status) throw error
          return res.status(error.status).json({ error: error.message })
        }
        const payload = { ...prior.data.payload, pending }
        const { data, error } = await db
          .from('diary_days')
          .update({ payload, version: version + 1, updated_at: new Date().toISOString() })
          .eq('date', date)
          .eq('version', version)
          .select('date,payload,version')
          .maybeSingle()
        if (error) throw error
        if (!data) return res.status(409).json({ error: 'บันทึกเปลี่ยนแปลงแล้ว กำลังโหลดใหม่' })
        return res.status(200).json({ day: dayRow(data) })
      }

      return res.status(400).json({ error: 'ไม่รู้จักคำสั่งนี้' })
    } catch (error) {
      const missing = ['42P01', 'PGRST205'].includes(error?.code)
      if (!missing) console.error('diary api error:', error?.message || error)
      return res.status(missing ? 503 : 500).json({
        error: missing ? 'ยังไม่ได้ติดตั้งตารางไดอารี่ — รัน supabase_diary.sql ใน Supabase ก่อน' : 'อ่านหรือบันทึกไดอารี่ไม่สำเร็จ กรุณาลองใหม่',
      })
    }
  }
}

export default createDiaryHandler()

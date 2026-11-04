// ชำระเพิ่ม / ยกเว้นส่วนที่ขาด ของงวดดอกเบี้ย (สัญญาหลักและวงเงินเพิ่ม) — ตาราง payment_additions แบบเพิ่มอย่างเดียว
// เข้าถึงผ่านเซิร์ฟเวอร์เท่านั้น (ตรวจ session ของแอป · ใช้ service role) เบราว์เซอร์ไม่มีสิทธิ์ตรงต่อตารางนี้
// GET   ?customerId=…  → รายการของลูกค้ารายเดียว (รวมที่ยกเลิกแล้ว ไว้แสดงประวัติ) · ไม่ระบุ → ทุกรายการ (หน้าหลักใช้คิดสถานะงวด)
// POST  { customerId, topupId?, installment, kind, paidAt, amount, note?, slipUrl?, slipId? } → เพิ่มรายการ
// PATCH { id, customerId, voidReason } → ยกเลิกรายการ (ตั้ง voided_at · ไม่ลบจริง ตามกติกาห้ามลบประวัติการชำระ)
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '../api/_auth.js'
import { installmentBalance, additionFromRow } from '../src/lib/installmentBalance.js'
import { ADVANCE_DEDUCTION_SLIP_ID } from '../src/lib/advanceDeduction.js'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_AMOUNT = 100000000
const COLUMNS = 'id,customer_id,topup_id,installment,kind,paid_at,amount,slip_url,slip_id,note,created_at,voided_at,void_reason'
const PAGE = 1000 // PostgREST ตัดผลที่ 1,000 แถวโดยไม่บอก → อ่านทีละหน้าจนหมด

export const toClientAddition = additionFromRow

// อ่านรายการชำระเพิ่มทั้งหมด (หรือเฉพาะลูกค้า) ทีละหน้า เรียงตามเวลาที่บันทึก · ใช้ทั้ง GET ของ API งานเตือนรายวัน และผู้ช่วยเทเลแกรม
// คืน { data, error } แบบเดียวกับ supabase-js · columns ส่งเองได้ (งานเตือนไม่ต้องใช้หมายเหตุ)
export async function fetchAllAdditionRows(db, { customerId = '', columns = COLUMNS } = {}) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    let query = db.from('payment_additions').select(columns)
    if (customerId) query = query.eq('customer_id', customerId)
    const { data, error } = await query.order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < PAGE) return { data: rows, error: null }
  }
}

const isRealDate = (value) => {
  if (!ISO_DATE.test(String(value || ''))) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// ตรวจและจัดรูปข้อมูลที่ส่งมา · โยน Error ข้อความไทยเมื่อไม่ถูกต้อง
// now ฉีดได้ในเทสต์ · วันที่ชำระล่วงหน้าเกินพรุ่งนี้ไม่รับ (กันพิมพ์ปีผิด)
export function validateAddition(body, now = new Date()) {
  const input = body && typeof body === 'object' ? body : {}
  // รหัสที่หน้าเว็บสร้างตอนเปิดหน้าต่าง: ส่งซ้ำ (กดซ้ำ/ลองใหม่หลังเน็ตหลุด) จะชนรหัสเดิม ไม่เกิดรายการซ้ำ
  const id = input.id ? String(input.id) : null
  if (id && !UUID.test(id)) throw new Error('รหัสรายการไม่ถูกต้อง')
  const customerId = input.customerId
  if (typeof customerId !== 'string' || !customerId || customerId.length > 200) throw new Error('กรุณาระบุลูกค้า')
  const topupId = input.topupId ? String(input.topupId) : null
  if (topupId && !UUID.test(topupId)) throw new Error('รหัสวงเงินเพิ่มไม่ถูกต้อง')
  const installment = Number(input.installment)
  if (!Number.isInteger(installment) || installment < 1 || installment > 600) throw new Error('งวดไม่ถูกต้อง')
  const kind = input.kind === 'waiver' ? 'waiver' : input.kind === 'payment' || input.kind === undefined ? 'payment' : null
  if (!kind) throw new Error('ประเภทรายการไม่ถูกต้อง')
  const paidAt = String(input.paidAt || '')
  if (!isRealDate(paidAt)) throw new Error('วันที่ชำระไม่ถูกต้อง')
  const tomorrow = new Date(now.getTime() + 36 * 3600 * 1000).toISOString().slice(0, 10)
  if (paidAt > tomorrow) throw new Error('วันที่ชำระอยู่ในอนาคต กรุณาตรวจวันที่')
  // เงินเป็นตัวเลขทศนิยมไม่เกิน 2 ตำแหน่ง — ไม่ปัดเอง (1.005 คูณ 100 แล้วปัดได้ 100 ไม่ใช่ 101 เพราะทศนิยมลอย)
  const amountText = typeof input.amount === 'number' ? String(input.amount) : String(input.amount ?? '').trim().replace(/,/g, '')
  if (/^\d+\.\d{3,}$/.test(amountText)) throw new Error('จำนวนเงินมีทศนิยมได้ไม่เกิน 2 ตำแหน่ง')
  const amount = /^\d+(\.\d{1,2})?$/.test(amountText) ? Number(amountText) : NaN
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('จำนวนเงินต้องมากกว่า 0')
  if (amount > MAX_AMOUNT) throw new Error('จำนวนเงินสูงเกินไป กรุณาตรวจตัวเลข')
  const note = String(input.note || '').trim()
  if (note.length > 500) throw new Error('หมายเหตุยาวเกิน 500 ตัวอักษร')
  if (kind === 'waiver' && note.length < 3) throw new Error('การยกเว้นส่วนที่ขาดต้องระบุเหตุผล')
  const slipUrl = String(input.slipUrl || '').trim()
  if (slipUrl && (!/^https:\/\//i.test(slipUrl) || slipUrl.length > 500)) throw new Error('ลิงก์สลิปไม่ถูกต้อง')
  const slipId = String(input.slipId || '').trim().slice(0, 200)
  // รหัสนี้แปลว่า "หักดอกล่วงหน้าวันทำสัญญา" ใช้กับบันทึกครั้งแรกเท่านั้น (ตัวคิดยอดถือว่างวดนั้นจบทันที)
  if (slipId === ADVANCE_DEDUCTION_SLIP_ID) throw new Error('รายการชำระเพิ่มใช้รหัสหักดอกล่วงหน้าไม่ได้')
  return { id, customerId, topupId, installment, kind, paidAt, amount, note, slipUrl, slipId }
}

const defaultDatabase = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
}

const fail = (status, error, code = '') => Object.assign(new Error(error), { status, code })

// ยอดของงวดตอนนี้จากฐานข้อมูล (ยอดที่ต้องจ่าย · บันทึกแรก · รายการเพิ่มที่มีอยู่) — ใช้ตัดสินก่อนเพิ่มรายการ
async function loadInstallment(db, { customerId, topupId, installment }) {
  const customer = await db.from('customers').select('id,amount,is_cancelled').eq('id', customerId).maybeSingle()
  if (customer.error) throw customer.error
  if (!customer.data) throw fail(404, 'ไม่พบลูกค้า')
  if (customer.data.is_cancelled) throw fail(409, 'สัญญานี้ถูกยกเลิกแล้ว บันทึกการชำระเพิ่มไม่ได้')
  let due
  let record
  if (topupId) {
    const topup = await db.from('contract_topups').select('id,customer_id,interest_amount,payments').eq('id', topupId).maybeSingle()
    if (topup.error) throw topup.error
    if (!topup.data || topup.data.customer_id !== customerId) throw fail(404, 'ไม่พบวงเงินเพิ่มของลูกค้ารายนี้')
    const schedule = Array.isArray(topup.data.payments) ? topup.data.payments : []
    if (!schedule.some((p) => Number(p?.installment) === installment)) throw fail(404, `ไม่พบงวดที่ ${installment} ของวงเงินเพิ่มนี้`)
    due = topup.data.interest_amount
    record = await db.from('topup_payment_records').select('amount_paid,slip_id').eq('topup_id', topupId).eq('installment', installment).maybeSingle()
  } else {
    const scheduled = await db.from('payments').select('installment').eq('customer_id', customerId).eq('installment', installment).maybeSingle()
    if (scheduled.error) throw scheduled.error
    if (!scheduled.data) throw fail(404, `ไม่พบงวดที่ ${installment} ของสัญญานี้`)
    due = customer.data.amount
    record = await db.from('payment_records').select('amount_paid,slip_id').eq('customer_id', customerId).eq('installment', installment).maybeSingle()
  }
  if (record.error) throw record.error
  if (!record.data) throw fail(409, 'งวดนี้ยังไม่มีบันทึกการชำระครั้งแรก — ใช้ปุ่มบันทึกการชำระของงวดก่อน')
  let additions = db.from('payment_additions').select(`${COLUMNS},seq`).eq('customer_id', customerId).eq('installment', installment)
  additions = topupId ? additions.eq('topup_id', topupId) : additions.is('topup_id', null)
  const existing = await additions
  if (existing.error) throw existing.error
  const balance = installmentBalance({
    due,
    record: { amountPaid: record.data.amount_paid, slipId: record.data.slip_id },
    additions: (existing.data || []).map(toClientAddition),
  })
  // ลำดับถัดไปของงวดนี้ (นับรวมรายการที่ยกเลิก) — ฐานข้อมูลบังคับไม่ซ้ำ คำขอที่อ่านยอดชุดเดียวกันแล้วบันทึกพร้อมกันจึงผ่านได้รายการเดียว
  const nextSeq = (existing.data || []).reduce((max, row) => Math.max(max, Number(row.seq) || 0), 0) + 1
  return { balance, nextSeq }
}

// 23505 = ชนข้อห้ามซ้ำ: รหัสรายการเดิม (ส่งซ้ำ) หรือลำดับของงวด (มีอีกคำขอบันทึกงวดเดียวกันไปก่อน)
function duplicateFailure(error) {
  const text = `${error?.message || ''} ${error?.details || ''}`
  return /payment_additions_pkey|\(id\)/.test(text)
    ? fail(409, 'รายการนี้บันทึกไว้แล้ว', 'duplicate')
    : fail(409, 'มีรายการของงวดนี้บันทึกเข้ามาพร้อมกัน — โหลดหน้าใหม่แล้วตรวจยอดอีกครั้ง', 'conflict')
}

export function createPaymentAdditionsHandler({ authorized = verifySession, database = defaultDatabase, now = () => new Date() } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (!authorized(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })
    if (!['GET', 'POST', 'PATCH'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' })
    const db = database()
    // code แยกสองกรณี: not_configured = เซิร์ฟเวอร์ไม่มีกุญแจ (อาจมีรายการอยู่แต่อ่านไม่ได้) · table_missing = ยังไม่ได้สร้างตาราง (ยังไม่มีรายการแน่นอน)
    if (!db) return res.status(503).json({ error: 'ระบบชำระเพิ่มยังไม่ได้ตั้งค่าฐานข้อมูลฝั่งเซิร์ฟเวอร์', code: 'not_configured' })
    try {
      if (req.method === 'GET') {
        const url = new URL(req.url || '/', 'http://localhost')
        const { data, error } = await fetchAllAdditionRows(db, { customerId: url.searchParams.get('customerId') || '' })
        if (error) throw error
        return res.status(200).json({ additions: data.map(toClientAddition) })
      }
      const body = req.body || {}
      if (req.method === 'PATCH') {
        const reason = String(body.voidReason || '').trim()
        if (!UUID.test(String(body.id || ''))) return res.status(400).json({ error: 'รหัสรายการไม่ถูกต้อง' })
        if (typeof body.customerId !== 'string' || !body.customerId) return res.status(400).json({ error: 'กรุณาระบุลูกค้า' })
        if (reason.length < 3 || reason.length > 300) return res.status(400).json({ error: 'กรุณาระบุเหตุผลที่ยกเลิก (3–300 ตัวอักษร)' })
        const { data, error } = await db.from('payment_additions')
          .update({ voided_at: now().toISOString(), void_reason: reason })
          .eq('id', body.id).eq('customer_id', body.customerId).is('voided_at', null)
          .select(COLUMNS).maybeSingle()
        if (error) throw error
        if (!data) return res.status(409).json({ error: 'รายการนี้ถูกยกเลิกไปแล้ว หรือไม่พบรายการ กรุณาโหลดใหม่' })
        return res.status(200).json({ addition: toClientAddition(data) })
      }
      let input
      try { input = validateAddition(body, now()) } catch (error) { return res.status(400).json({ error: error.message }) }
      // ส่งซ้ำด้วยรหัสเดิม (ลองใหม่หลังเน็ตหลุด): มีแถวนี้แล้ว = ตอบรายการเดิม ก่อนตรวจยอด (ไม่งั้นครั้งที่สองจะได้ "งวดนี้ชำระครบแล้ว" ทั้งที่บันทึกสำเร็จ)
      // ข้อมูลต่างจากที่บันทึกไว้ = แจ้งยอดที่บันทึกไว้ ให้ยกเลิกแล้วบันทึกใหม่ (ไม่แก้ทับเงียบ ๆ)
      if (input.id) {
        const prior = await db.from('payment_additions').select(COLUMNS).eq('id', input.id).maybeSingle()
        if (prior.error) throw prior.error
        if (prior.data) {
          const row = prior.data
          // ตรงกันทุกช่องที่บันทึก (รวมวันที่ สลิป หมายเหตุ) และยังไม่ถูกยกเลิก = ส่งซ้ำของรายการเดิมจริง
          const same = !row.voided_at && row.customer_id === input.customerId && (row.topup_id || null) === input.topupId
            && Number(row.installment) === input.installment && row.kind === input.kind
            && Math.round(Number(row.amount) * 100) === Math.round(input.amount * 100)
            && String(row.paid_at || '') === input.paidAt && String(row.slip_url || '') === input.slipUrl
            && String(row.slip_id || '') === input.slipId && String(row.note || '') === input.note
          if (same) return res.status(200).json({ addition: toClientAddition(row), replayed: true })
          return res.status(409).json({
            error: row.voided_at
              ? 'รหัสรายการนี้ถูกใช้กับรายการที่ยกเลิกไปแล้ว — ปิดหน้าต่างแล้วเปิดใหม่เพื่อบันทึก'
              : `รายการนี้บันทึกไปแล้ว (ยอด ${Number(row.amount).toLocaleString('th-TH')} บาท วันที่ ${row.paid_at}) — ถ้าข้อมูลผิด ให้ยกเลิกรายการนั้นแล้วบันทึกใหม่`,
            code: 'id_conflict',
          })
        }
      }
      const { balance, nextSeq } = await loadInstallment(db, input)
      if (balance.state !== 'partial') return res.status(409).json({ error: 'งวดนี้ชำระครบแล้ว ไม่มียอดค้างให้บันทึกเพิ่ม', code: 'settled' })
      if (input.kind === 'waiver' && input.amount > balance.outstanding) {
        return res.status(400).json({ error: `ยกเว้นได้ไม่เกินยอดที่ขาด ${balance.outstanding.toLocaleString('th-TH')} บาท` })
      }
      const row = {
        customer_id: input.customerId,
        topup_id: input.topupId,
        installment: input.installment,
        seq: nextSeq,
        kind: input.kind,
        paid_at: input.paidAt,
        amount: input.amount,
        slip_url: input.slipUrl,
        slip_id: input.slipId,
        note: input.note,
      }
      if (input.id) row.id = input.id
      const { data, error } = await db.from('payment_additions').insert(row).select(COLUMNS).single()
      if (error) {
        if (error.code === '23505') throw duplicateFailure(error)
        // ฐานข้อมูลตรวจซ้ำตอนบันทึก (trigger): บันทึกครั้งแรกของงวดถูกลบไประหว่างนั้น
        if (error.code === '23503') throw fail(409, 'งวดนี้ไม่มีบันทึกการชำระครั้งแรกแล้ว — โหลดหน้าใหม่แล้วตรวจอีกครั้ง', 'no_first_record')
        throw error
      }
      return res.status(200).json({ addition: toClientAddition(data) })
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}) })
      const missing = ['42P01', 'PGRST205'].includes(error.code)
      return res.status(missing ? 503 : 500).json(missing
        ? { error: 'ยังไม่ได้ติดตั้งตารางชำระเพิ่ม (รัน supabase_payment_additions.sql)', code: 'table_missing' }
        : { error: 'อ่านหรือบันทึกการชำระเพิ่มไม่สำเร็จ กรุณาลองใหม่' })
    }
  }
}

export default createPaymentAdditionsHandler()

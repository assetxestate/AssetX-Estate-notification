// ยอดของงวดดอกเบี้ย (สัญญาหลักหรือวงเงินเพิ่ม) เมื่อลูกค้าจ่ายไม่ครบแล้วมาจ่ายส่วนที่เหลือทีหลัง
// บันทึกแรกของงวดอยู่ที่ payment_records / topup_payment_records (งวดละ 1 รายการตามเดิม)
// รายการถัดไปอยู่ที่ payment_additions แบบเพิ่มอย่างเดียว:
//   kind 'payment' = เงินที่รับจริง · 'waiver' = ยกเว้นส่วนที่ขาด (ปิดยอดค้าง แต่ไม่นับเป็นเงินรับ)
//   ยกเลิกรายการ = มี voidedAt (ไม่ลบจริง) → ไม่นับในยอด
// คิดเป็นสตางค์ (จำนวนเต็ม) ทุกครั้ง ทศนิยมลอยจึงไม่ทำให้เหลือยอดค้าง 0.0000001 บาท
import { isAdvanceDeductionRecord } from './advanceDeduction.js'

const satang = (value) => Math.round((Number(value) || 0) * 100)
const baht = (value) => value / 100

// คีย์เดียวกันทุกที่: งวดสัญญาหลักใช้ topupId ว่าง
export function installmentKey(customerId, topupId, installment) {
  return `${customerId}|${topupId || ''}|${Number(installment)}`
}

// จัดกลุ่มรายการชำระเพิ่มตามงวด เรียงตามวันที่ชำระแล้วตามเวลาที่บันทึก (รวมรายการที่ยกเลิก ไว้แสดงประวัติ)
export function indexAdditions(additions) {
  const index = new Map()
  for (const item of Array.isArray(additions) ? additions : []) {
    if (!item || !item.customerId || !Number.isInteger(Number(item.installment))) continue
    const key = installmentKey(item.customerId, item.topupId, item.installment)
    if (!index.has(key)) index.set(key, [])
    index.get(key).push(item)
  }
  for (const list of index.values()) {
    list.sort((a, b) => String(a.paidAt || '').localeCompare(String(b.paidAt || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
  }
  return index
}

export function additionsFor(index, customerId, topupId, installment) {
  return index?.get?.(installmentKey(customerId, topupId, installment)) || []
}

// แถวจากตาราง payment_additions (snake_case) → รูปที่ตัวคิดยอดและหน้าเว็บใช้ (camelCase)
// ใช้ร่วมกันทั้ง /api/payment-additions งานเตือนรายวัน และผู้ช่วยเทเลแกรม — ลืมแปลง = indexAdditions ทิ้งแถวเงียบ ๆ
export function additionFromRow(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    topupId: row.topup_id || null,
    installment: Number(row.installment),
    kind: row.kind === 'waiver' ? 'waiver' : 'payment',
    paidAt: row.paid_at || '',
    amount: Number(row.amount) || 0,
    slipUrl: row.slip_url || '',
    slipId: row.slip_id || '',
    note: row.note || '',
    createdAt: row.created_at || '',
    voidedAt: row.voided_at || null,
    voidReason: row.void_reason || '',
  }
}

// state: 'unpaid' ยังไม่มีการชำระ · 'partial' ชำระไม่ครบ · 'paid' ครบแล้ว
// งวดที่ไม่รู้ยอด (due ≤ 0) หรือเป็นงวดหักดอกล่วงหน้าวันทำสัญญา = มีรายการแล้วถือว่าครบ (พฤติกรรมเดิม)
// additionsKnown = false (ยังโหลดรายการชำระเพิ่มไม่ได้): งวดที่ดูเหมือนขาดยังสรุปไม่ได้ เพราะลูกค้าอาจจ่ายเพิ่มไปแล้ว
//   → ถือว่าจบไว้ก่อน (state 'paid' + unverified) ไม่ทวง ไม่นับค้าง — แบบเดียวกับงานเตือนตอนเช้า (remindPartial: false)
export function installmentBalance({ due, record = null, additions = [], additionsKnown = true }) {
  const active = (Array.isArray(additions) ? additions : []).filter((item) => item && !item.voidedAt)
  const payments = active.filter((item) => item.kind !== 'waiver')
  const waivers = active.filter((item) => item.kind === 'waiver')
  const firstSat = record ? satang(record.amountPaid ?? record.amount) : 0
  const paidSat = firstSat + payments.reduce((sum, item) => sum + satang(item.amount), 0)
  const waivedSat = waivers.reduce((sum, item) => sum + satang(item.amount), 0)
  const dueSat = satang(due)
  const hasAny = Boolean(record) || active.length > 0
  let state = 'unpaid'
  if (hasAny) {
    if (!(dueSat > 0) || isAdvanceDeductionRecord(record) || paidSat + waivedSat >= dueSat) state = 'paid'
    else state = 'partial'
  }
  const unverified = state === 'partial' && !additionsKnown
  if (unverified) state = 'paid'
  return {
    state,
    unverified,
    due: baht(dueSat),
    paid: baht(paidSat),
    waived: baht(waivedSat),
    outstanding: state === 'partial' ? baht(dueSat - paidSat - waivedSat) : 0,
    // เกินยอด = เงินที่รับจริงเกินยอดงวด (ยอดที่ยกเว้นไม่ใช่เงิน ไม่นับ)
    extra: dueSat > 0 && paidSat > dueSat ? baht(paidSat - dueSat) : 0,
    paymentCount: (record ? 1 : 0) + payments.length,
  }
}

// งวดนี้จบแล้วหรือยัง (ใช้แทน "มีบันทึก = จ่ายแล้ว" ทุกที่ที่ตัดสินว่าจะเตือน/นับค้าง)
export function isInstallmentSettled(args) {
  return installmentBalance(args).state === 'paid'
}

// เงินที่รับจริงของงวด แยกตามวันที่ชำระ (บันทึกแรก + ชำระเพิ่มที่ไม่ใช่การยกเว้นและยังไม่ยกเลิก)
// ใช้รวมยอดรับรายเดือน: เงินส่วนที่ขาดที่มาจ่ายเดือนถัดไปจะไปอยู่ในเดือนที่จ่ายจริง
export function receivedEntries({ record = null, additions = [] }) {
  const entries = []
  if (record && !isAdvanceDeductionRecord(record)) {
    const amount = Number(record.amountPaid ?? record.amount) || 0
    if (amount > 0) entries.push({ paidAt: record.paidDate || record.paidAt || '', amount, source: 'record' })
  }
  for (const item of Array.isArray(additions) ? additions : []) {
    if (!item || item.voidedAt || item.kind === 'waiver') continue
    const amount = Number(item.amount) || 0
    if (amount > 0) entries.push({ paidAt: item.paidAt || '', amount, source: 'addition', id: item.id })
  }
  return entries
}

// วันที่วันนี้ตามเวลาไทย (YYYY-MM-DD) — toISOString ให้วันของ UTC ทำให้ก่อน 07:00 ได้วันของเมื่อวาน
export function bangkokToday(now = new Date()) {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
}

// เงินที่รับจริงจากรายการชำระเพิ่ม (ไม่นับการยกเว้นและรายการที่ยกเลิก) — ใช้รวมยอดที่ลูกค้าจ่ายแล้วทั้งสัญญา
export function sumReceivedAdditions(additions) {
  return (Array.isArray(additions) ? additions : [])
    .filter((item) => item && !item.voidedAt && item.kind !== 'waiver')
    .reduce((sum, item) => sum + satang(item.amount), 0) / 100
}

// ยอดที่ยกเว้นให้ลูกค้า (ไม่นับรายการที่ยกเลิก) — ไม่ใช่เงินรับจริง แต่ปิดดอกเบี้ยส่วนนั้นแล้ว (ใช้คิดยอดปิดรีไฟแนนซ์ ไม่ใช้ในยอดรับ)
export function sumWaivedAdditions(additions) {
  return (Array.isArray(additions) ? additions : [])
    .filter((item) => item && !item.voidedAt && item.kind === 'waiver')
    .reduce((sum, item) => sum + satang(item.amount), 0) / 100
}

const money = (value) => Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })

// ข้อความสั้นสำหรับแสดงบนแถวงวด
export function balanceSummary(balance) {
  if (!balance || balance.state === 'unpaid') return ''
  if (balance.state === 'partial') return `ชำระแล้ว ${money(balance.paid)}${balance.waived > 0 ? ` · ยกเว้น ${money(balance.waived)}` : ''} / ${money(balance.due)} บาท · ขาด ${money(balance.outstanding)} บาท`
  const parts = [`ชำระครบ ${money(balance.paid)} บาท`]
  if (balance.paymentCount > 1) parts.push(`${balance.paymentCount} ครั้ง`)
  if (balance.waived > 0) parts.push(`ยกเว้น ${money(balance.waived)} บาท`)
  return parts.join(' · ')
}

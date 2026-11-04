// วางแผนข้อความเตือนชำระรายวัน (api/daily-notify.js) แยกเป็นฟังก์ชันบริสุทธิ์เพื่อทดสอบได้
// งวดที่จ่ายครบแล้วข้าม · งวดที่จ่ายไม่ครบยังเตือนตามวันนัด (date_str ที่อาจถูกเลื่อนเป็นวันนัดชำระส่วนที่ขาด)
// พร้อมผลคิดยอด (balance) ให้ข้อความใช้ "ยอดที่ยังขาด" แทนยอดเต็ม
import { installmentBalance, indexAdditions, additionsFor } from './installmentBalance.js'

// จำนวนวันจากวันนี้ (เที่ยงคืนตามเวลาเครื่อง) ถึงวันที่ใน YYYY-MM-DD · ติดลบ = เลยกำหนด
export function diffDays(dateStr, today) {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.round((d - today) / 86400000)
}

// ตัวคิดยอดของงวด: บันทึกเป็นแถวจาก Supabase ตรง ๆ (snake_case) · additions เป็นรูปของ /api/payment-additions (camelCase)
function balanceLookup({ paymentRecords = [], topupRecords = [], additions = [] }) {
  const index = indexAdditions(additions)
  const mainRecords = new Map(paymentRecords.map((r) => [`${r.customer_id}|${r.installment}`, r]))
  const topupRecordMap = new Map(topupRecords.map((r) => [`${r.topup_id}|${r.installment}`, r]))
  const asRecord = (row) => (row ? { amountPaid: row.amount_paid, slipId: row.slip_id } : null)
  return {
    main: (customer, installment) => installmentBalance({
      due: customer.amount,
      record: asRecord(mainRecords.get(`${customer.id}|${installment}`)),
      additions: additionsFor(index, customer.id, null, installment),
    }),
    topup: (customer, topup, installment) => installmentBalance({
      due: topup.interest_amount,
      record: asRecord(topupRecordMap.get(`${topup.id}|${installment}`)),
      additions: additionsFor(index, customer.id, topup.id, installment),
    }),
  }
}

// canNotify(customer) = มีปลายทางส่งได้ไหม (ตัดสินที่ daily-notify ตามโหมดส่ง)
// remindPartial = false → งวดที่จ่ายไม่ครบถือว่าจบ (พฤติกรรมเดิม) ใช้เมื่ออ่านรายการชำระเพิ่มไม่ได้ กันทวงเงินที่ลูกค้าอาจจ่ายเพิ่มไปแล้ว
// กลุ่มละลูกค้า+วันที่: mains = งวดสัญญาหลัก (มีได้หลายงวด เมื่อเลื่อนส่วนที่ขาดไปวันเดียวกับงวดถัดไป) · extras = งวดวงเงินเพิ่ม
export function planPaymentReminders({
  customers = [], payments = [], paymentRecords = [], topups = [], topupRecords = [], additions = [],
  closedIds = new Set(), today, canNotify = () => true, offsets = [0, 7], remindPartial = true,
}) {
  const balanceOf = balanceLookup({ paymentRecords, topupRecords, additions })
  const customerById = new Map(customers.map((c) => [c.id, c]))
  const settled = (balance) => balance.state === 'paid' || (!remindPartial && balance.state === 'partial')
  const groups = new Map()
  let skipped = 0
  const groupFor = (customer, dateStr, diff) => {
    const key = `${customer.id}|${dateStr}`
    if (!groups.has(key)) groups.set(key, { customer, dateStr, diff, mains: [], extras: [] })
    return groups.get(key)
  }

  for (const p of payments) {
    const c = customerById.get(p.customer_id)
    if (!c || closedIds.has(c.id)) { skipped++; continue }
    const balance = balanceOf.main(c, p.installment)
    if (settled(balance)) { skipped++; continue }
    if (!canNotify(c)) { skipped++; continue }
    const diff = diffDays(p.date_str, today)
    if (offsets.includes(diff)) groupFor(c, p.date_str, diff).mains.push({ installment: p.installment, balance })
  }

  for (const topup of topups) {
    const c = customerById.get(topup.customer_id)
    if (!c || closedIds.has(c.id)) { skipped++; continue }
    if (!canNotify(c)) { skipped++; continue }
    for (const payment of Array.isArray(topup.payments) ? topup.payments : []) {
      const balance = balanceOf.topup(c, topup, payment.installment)
      if (settled(balance)) { skipped++; continue }
      const diff = diffDays(payment.dateStr, today)
      if (offsets.includes(diff)) groupFor(c, payment.dateStr, diff).extras.push({ topup, installment: payment.installment, balance })
    }
  }

  for (const group of groups.values()) group.mains.sort((a, b) => a.installment - b.installment)
  return { groups: [...groups.values()], skipped }
}

// งวดที่รับเงินมาแล้วบางส่วน ยังขาดอีก ของสัญญาที่ยังเปิดอยู่ (สัญญาหลัก + วงเงินเพิ่ม) — ให้ผู้ช่วยเทเลแกรมตอบ "ใครยังจ่ายไม่ครบ"
// ส่งแค่ตัวเลขกับวันที่ ไม่ส่งหมายเหตุ/เหตุผลยกเลิก (อาจมีข้อมูลส่วนตัว) · เรียงตามวันนัด
export function listShortInstallments({
  customers = [], payments = [], paymentRecords = [], topups = [], topupRecords = [], additions = [], closedIds = new Set(),
}) {
  const balanceOf = balanceLookup({ paymentRecords, topupRecords, additions })
  const customerById = new Map(customers.map((c) => [c.id, c]))
  const out = []
  const push = (customer, topup, installment, dateStr, postponedFrom, balance) => {
    if (balance.state !== 'partial') return
    out.push({
      customerId: customer.id,
      topupId: topup?.id || null,
      installment: Number(installment),
      dateStr: dateStr || '',
      postponedFrom: postponedFrom || null,
      due: balance.due,
      paid: balance.paid,
      waived: balance.waived,
      outstanding: balance.outstanding,
    })
  }
  for (const p of payments) {
    const c = customerById.get(p.customer_id)
    if (!c || closedIds.has(c.id)) continue
    push(c, null, p.installment, p.date_str, p.postponed_from, balanceOf.main(c, p.installment))
  }
  for (const topup of topups) {
    const c = customerById.get(topup.customer_id)
    if (!c || closedIds.has(c.id)) continue
    for (const payment of Array.isArray(topup.payments) ? topup.payments : []) {
      push(c, topup, payment.installment, payment.dateStr, payment.postponedFrom, balanceOf.topup(c, topup, payment.installment))
    }
  }
  return out.sort((a, b) => a.dateStr.localeCompare(b.dateStr))
}

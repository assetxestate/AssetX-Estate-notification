// แยกรายรับดอกเบี้ยตาม "เจ้าของเงินทุน" ของสัญญา สำหรับหน้า Dashboard
// - สัญญาของบริษัท  = incomeType 'company' (บริษัทปล่อยเงินเอง ดอกเบี้ยเข้าบัญชีบริษัท)
// - สัญญาของนายทุน = ค่าอื่นทั้งหมด: 'commission' (มี Advance 2%) · 'interest' (รับดอกเบี้ยแทน ไม่มี Advance) · ไม่ระบุ
//   ('interest' ไม่ใช่เงินบริษัท — เจ้าของยืนยัน 17 พ.ย. 2569 ว่าสัญญาของบริษัทเองคือสัญญาที่ตั้งค่า 'company' เท่านั้น)
// กติกาการนับเงินที่รับแล้วเหมือนการ์ด "ดอกเบี้ยที่ชำระแล้ว" ทุกข้อ: นับ amountPaid ของสลิป ไม่นับงวดหักล่วงหน้า
// และนับเงินชำระเพิ่มของสัญญาหลัก (ไม่นับวงเงินเพิ่ม การยกเว้น และรายการที่ยกเลิก)
import { isAdvanceDeductionRecord } from './advanceDeduction.js'
import { principalWithTopups, toMonthlyAmount } from './topupTotals.js'

export const FUNDING_COMPANY = 'company'
export const FUNDING_INVESTOR = 'investor'

export function fundingOf(customer) {
  return customer?.incomeType === 'company' ? FUNDING_COMPANY : FUNDING_INVESTOR
}

const emptyGroup = () => ({
  activeCount: 0,      // จำนวนสัญญาที่ยังมีผล
  principal: 0,        // วงเงินที่ปล่อย (รวมวงเงินเพิ่ม) ของสัญญาที่ยังมีผล
  monthly: 0,          // ดอกเบี้ยที่ควรได้ต่อเดือน ของสัญญาที่ยังมีผล
  collected: 0,        // ดอกเบี้ยที่รับแล้วตามสลิป + ชำระเพิ่ม (ทุกสัญญา รวมที่ปิดแล้ว)
  collectedCount: 0,   // จำนวนงวดที่มีสลิป
  upfront: 0,          // ดอกเบี้ย/ค่าตอบแทนที่หักล่วงหน้าวันทำสัญญา
})

export function splitInterestByFunding({ customers = [], paymentRecords = {}, paymentAdditions = [], upfrontCases = [] } = {}) {
  const groups = { [FUNDING_COMPANY]: emptyGroup(), [FUNDING_INVESTOR]: emptyGroup() }
  const fundingById = new Map(customers.map((c) => [String(c.id), fundingOf(c)]))
  // สลิปของลูกค้าที่หาไม่เจอในรายชื่อ (ไม่ควรเกิด) นับเป็นฝั่งนายทุนตามค่าเริ่มต้นของระบบ
  const groupOfId = (id) => groups[fundingById.get(String(id)) || FUNDING_INVESTOR]

  for (const c of customers) {
    if (c.isClosed || c.isVoided || c.isHiddenDraft) continue
    const g = groups[fundingOf(c)]
    g.activeCount += 1
    g.principal += principalWithTopups(c)
    g.monthly += toMonthlyAmount(c.amount, c.freq) + (c.topupMonthlyInterest || 0)
  }

  for (const [cid, records] of Object.entries(paymentRecords || {})) {
    for (const rec of Object.values(records || {})) {
      if (!(rec?.amountPaid > 0) || isAdvanceDeductionRecord(rec)) continue
      const g = groupOfId(cid)
      g.collected += rec.amountPaid
      g.collectedCount += 1
    }
  }

  for (const a of paymentAdditions || []) {
    if (a.topupId || a.voidedAt || a.kind === 'waiver' || !(a.amount > 0)) continue
    groupOfId(a.customerId).collected += a.amount
  }

  for (const u of upfrontCases || []) {
    groupOfId(u.id).upfront += Number(u.total) || 0
  }

  return groups
}

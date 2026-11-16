// อัตราดอกเบี้ย (%) ที่คิดกับลูกค้าจริง — ใช้แสดงผลเท่านั้น ไม่ใช้คำนวณยอดชำระ
// ระบบไม่ได้เก็บ % ไว้ เก็บแค่ "ดอกเบี้ย/งวด (บาท)" กับ "เงินต้น" จึงคิดย้อนจากสองค่านี้ตามรอบชำระ
// แปลงรอบชำระเป็นรายเดือนด้วย toMonthlyAmount (กฎเดียวกับ Dashboard · รายงาน PDF · เครื่องคิดย้ายทุน)
// "ราย 2 สัปดาห์" นับเป็น 2 งวดต่อเดือน (24 งวด/ปี) — ตรวจกับข้อมูลจริง 16 พ.ย. 2569: สัญญาที่มีผลมีปีละ 24 งวด ห่าง 12–16 วัน
// ถ้าวันหน้ามีสัญญาที่เก็บทุก 14 วันจริง (26 งวด/ปี) อัตราต่อปีที่แสดงจะต่ำกว่าจริงราว 8%
import { toMonthlyAmount } from './topupTotals.js'

// คืน { monthly, annual } เป็น % (ยังไม่ปัด) · ข้อมูลไม่พอ (ไม่มีเงินต้นหรือดอกเบี้ย) คืน null
export function interestRateOf(amount, freq, principal) {
  const ต้น = Number(principal) || 0
  const ดอกต่อเดือน = toMonthlyAmount(amount, freq)
  if (ต้น <= 0 || ดอกต่อเดือน <= 0) return null
  const monthly = ดอกต่อเดือน / ต้น * 100
  return { monthly, annual: monthly * 12 }
}

// อัตราของวงเงินเพิ่ม (คิดเฉพาะส่วนที่เพิ่ม: ดอกเบี้ยวงเงินเพิ่ม ÷ ยอดที่เพิ่ม)
// หลายก้อน = ดอกต่อเดือนรวม ÷ ยอดเพิ่มรวม (ถ่วงตามยอด) · mixed = แต่ละก้อนคิดไม่เท่ากัน (หน้าเว็บเขียน "เฉลี่ย")
export function topupInterestRate(topups) {
  const list = (Array.isArray(topups) ? topups : []).filter((t) => (Number(t?.topupAmount) || 0) > 0)
  const ยอดเพิ่มรวม = list.reduce((s, t) => s + Number(t.topupAmount), 0)
  const ดอกต่อเดือนรวม = list.reduce((s, t) => s + toMonthlyAmount(t?.interestAmount, t?.freq), 0)
  if (ยอดเพิ่มรวม <= 0 || ดอกต่อเดือนรวม <= 0) return null
  const each = new Set(list.map((t) => interestRateOf(t.interestAmount, t.freq, t.topupAmount)).filter(Boolean).map((r) => formatRatePct(r.monthly)))
  const monthly = ดอกต่อเดือนรวม / ยอดเพิ่มรวม * 100
  return { monthly, annual: monthly * 12, mixed: each.size > 1 }
}

// ปัด 2 ตำแหน่งแล้วตัดศูนย์ท้าย: 15 → "15" · 1.25 → "1.25" · 14.4 → "14.4" · 0.6667 → "0.67"
export function formatRatePct(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return ''
  return String(Math.round(v * 100) / 100)
}

// "1.25% ต่อเดือน · 15% ต่อปี" · ไม่มีอัตรา = ''
export function rateText(rate) {
  if (!rate) return ''
  return `${formatRatePct(rate.monthly)}% ต่อเดือน · ${formatRatePct(rate.annual)}% ต่อปี`
}

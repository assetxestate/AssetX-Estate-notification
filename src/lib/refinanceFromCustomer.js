// เติมฟอร์ม "รีไฟแนนซ์ย้ายทุน" จากข้อมูลที่ระบบมีอยู่แล้ว (สัญญาลูกค้า / ผลประเมิน) — ผู้ใช้แก้ทับได้ทุกช่อง
// ใช้กับลูกค้าปัจจุบันเพื่อหาแนวทางทุนใหม่; ลูกค้าใหม่ยังกรอกเองได้เหมือนเดิม
import { toMonthlyAmount } from './topupTotals.js'
import { isAdvanceDeductionRecord } from './advanceDeduction.js'
import { calculateOldPayoffEstimate } from './refinanceCalculator.js'
import { formatThai } from './utils.js'

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const money = (n) => round2(n).toLocaleString('en-US')
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const day10 = (s) => String(s || '').slice(0, 10)

// 1 งวดเท่ากับกี่เดือน ตามรอบชำระ (สูตรย้ายทุนคิดหักล่วงหน้าเป็น "เดือน") — รองรับทุกค่าที่หน้า InvestorPage ให้เลือก
export function monthsPerPeriod(freq) {
  const f = String(freq || '')
  if (f.includes('ปี')) return 12
  if (f.includes('2 สัปดาห์') || f.includes('สองสัปดาห์') || f.includes('2 ครั้ง')) return 0.5
  if (f.includes('สัปดาห์')) return 12 / 52
  if (f.includes('วัน')) return 1 / 30
  return 1
}

// ถอยวันที่ไป n รอบชำระ (ใช้อนุมานวันทำสัญญาจากงวดแรกเมื่อไม่มีวันหักล่วงหน้า)
function shiftPeriods(iso, n, freq) {
  const [y, m, d] = day10(iso).split('-').map(Number)
  const f = String(freq || '')
  if (f.includes('2 สัปดาห์') || f.includes('สองสัปดาห์')) return isoDate(new Date(y, m - 1, d + 14 * n))
  if (f.includes('2 ครั้ง')) return isoDate(new Date(y, m - 1, d + 15 * n))
  if (f.includes('สัปดาห์')) return isoDate(new Date(y, m - 1, d + 7 * n))
  if (f.includes('วัน')) return isoDate(new Date(y, m - 1, d + 30 * n))
  const months = f.includes('ปี') ? 12 * n : n
  const t = new Date(y, m - 1 + months, 1)
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
  t.setDate(Math.min(d, last))
  return isoDate(t)
}

export function customerRefinanceLabel(c) {
  const name = String(c?.name || '').trim()
  const label = String(c?.fullLabel || '').replace(/^(ขายฝาก|จำนอง)\s*/, '').trim()
  return [c?.type, name, label && label !== name ? `· ${label}` : ''].filter(Boolean).join(' ')
}

// หักล่วงหน้าของวงเงินเพิ่มไม่มีช่องเก็บ มีแต่ในหมายเหตุ เช่น "หักล่วงหน้า 3 เดือน 25,200 บาท" → ดึงจำนวนเดือนแบบ best-effort
export function parseAdvanceMonthsFromNote(note) {
  const m = String(note || '').match(/หักล่วงหน้า\s*(\d+)\s*(เดือน|งวด)/)
  return m ? Number(m[1]) : 0
}

// ประมาณยอดปิดของวงเงินเพิ่มแต่ละรายการถึงวันย้ายทุน ด้วยสูตรเดียวกับทุนเดิม แต่เริ่มนับจากวันทำวงเงินเพิ่มของมันเอง
// (ถ้ารวมเป็นเงินต้นเดียวกับสัญญาหลัก ดอกเบี้ยของวงเงินเพิ่มจะถูกคิดย้อนไปถึงวันทำสัญญาหลัก ซึ่งเกินจริง)
export function estimateTopupPayoffs(topups, transferDate) {
  return (Array.isArray(topups) ? topups : []).map((t) => {
    const principal = Number(t?.topupAmount) || 0
    const monthly = toMonthlyAmount(t?.interestAmount, t?.freq)
    const annualRate = principal > 0 ? round2(monthly * 12 / principal * 100) : 0
    const startDate = day10(t?.topupDate || t?.topupStartDate)
    const advanceMonths = parseAdvanceMonthsFromNote(t?.note)
    const paid = round2(Object.values(t?.records || {}).reduce((s, r) => s + (Number(r?.amountPaid) || 0), 0))
    const endDate = day10(t?.topupEndDate) >= transferDate ? day10(t.topupEndDate) : transferDate
    const estimate = startDate && startDate < transferDate
      ? calculateOldPayoffEstimate({ principal, annualRate, startDate, transferDate, endDate, advanceMonths, advancePaidAmount: '', paymentMode: 'amount', otherPaid: paid })
      : { ready: false }
    return { principal, monthly, annualRate, startDate, advanceMonths, paid, estimate, payoff: estimate.ready ? round2(estimate.payoff) : principal }
  })
}

// customer = รายการจาก App (enriched): principal, amount, freq, contractEndDate, deeds[], payments[{record}], topups[{records}], disbursement
export function buildRefinanceFormFromCustomer(customer, { today = new Date() } = {}) {
  const c = customer || {}
  const principal = Number(c.principal) || 0
  const monthly = toMonthlyAmount(c.amount, c.freq)
  const annualRate = principal > 0 ? round2(monthly * 12 / principal * 100) : 0
  const payments = Array.isArray(c.payments) ? c.payments : []
  const deductions = payments.filter((p) => p?.record && isAdvanceDeductionRecord(p.record))
  const realMain = payments.filter((p) => p?.record && !isAdvanceDeductionRecord(p.record))
  const d = c.disbursement || {}
  const transferDate = isoDate(today)
  const notes = []

  // หักล่วงหน้าวันทำสัญญา: จากงวดที่ติดธงในตารางชำระ (รายเดือน/2 สัปดาห์) หรือจากข้อมูลเบิกจ่าย (รายปี — เก็บเป็นเดือนอยู่แล้ว)
  let advanceMonths = 0
  let advancePaidAmount = 0
  if (deductions.length) {
    advanceMonths = Math.round(deductions.length * monthsPerPeriod(c.freq))
    advancePaidAmount = round2(deductions.reduce((s, p) => s + (Number(p.record.amountPaid) || 0), 0))
    notes.push(`หักล่วงหน้า ${deductions.length} งวด = ${money(advancePaidAmount)} บาท (จากงวดที่ติดธงหักล่วงหน้าในตารางชำระ)`)
  } else if (d.advanceTreatment === 'before_schedule' && Number(d.advanceMonths) > 0) {
    advanceMonths = Number(d.advanceMonths)
    advancePaidAmount = round2(d.advanceTotal)
    notes.push(`หักล่วงหน้า ${advanceMonths} เดือน = ${money(advancePaidAmount)} บาท (จากข้อมูลเบิกจ่าย)`)
  } else {
    notes.push('ไม่พบข้อมูลหักล่วงหน้า — ใส่ 0 ไว้ ตรวจกับสัญญาจริง')
  }

  // วันทำสัญญา: ระบบไม่มีช่องนี้ จึงใช้วันหักล่วงหน้า หรือถอยจากงวดแรก 1 รอบ
  const deductionDates = deductions.map((p) => day10(p.record.paidDate || p.record.paidAt)).filter(Boolean).sort()
  let startDate = ''
  if (deductionDates[0]) {
    startDate = deductionDates[0]
    notes.push(`วันทำสัญญา ${formatThai(startDate)} ใช้วันหักล่วงหน้า — ตรวจกับสัญญาจริง`)
  } else if (d.advanceDeductedAt) {
    startDate = day10(d.advanceDeductedAt)
    notes.push(`วันทำสัญญา ${formatThai(startDate)} ใช้วันหักล่วงหน้าในข้อมูลเบิกจ่าย — ตรวจกับสัญญาจริง`)
  } else if (payments[0]?.dateStr) {
    startDate = shiftPeriods(payments[0].postponedFrom || payments[0].dateStr, -1, c.freq)
    notes.push(`วันทำสัญญา ${formatThai(startDate)} อนุมานจากงวดแรกย้อน 1 รอบ — ตรวจกับสัญญาจริง`)
  }

  // รับชำระแล้วเฉพาะสัญญาหลัก (วงเงินเพิ่มคิดแยกด้านล่าง)
  const otherPaid = round2(realMain.reduce((s, p) => s + (Number(p.record.amountPaid) || 0), 0))
  if (otherPaid > 0) notes.push(`รับชำระดอกเบี้ยสัญญาหลักแล้ว ${money(otherPaid)} บาท (${realMain.length} งวด) ไม่รวมหักล่วงหน้า`)

  const form = {
    principal: String(principal),
    annualRate: String(annualRate),
    startDate,
    endDate: day10(c.contractEndDate),
    transferDate,
    advanceMonths: String(advanceMonths),
    advancePaidAmount: advancePaidAmount > 0 ? String(advancePaidAmount) : '',
    paymentMode: 'amount',
    otherPaid: String(otherPaid),
    deedCount: String(Array.isArray(c.deeds) && c.deeds.length ? c.deeds.length : 1),
    oldRegisteredValue: String(principal),
  }

  // วงเงินเพิ่ม: ยอดปิดแต่ละรายการ (เงินต้น + ดอกเบี้ยค้างถึงวันย้ายทุน − หักล่วงหน้า − ที่รับแล้ว) ใส่ไว้ที่ "ค่าใช้จ่ายอื่นที่ต้องใช้ทุนนี้จ่าย"
  const topupPayoffs = estimateTopupPayoffs(c.topups, transferDate)
  if (topupPayoffs.length) {
    form.otherCosts = String(round2(topupPayoffs.reduce((s, t) => s + t.payoff, 0)))
    for (const t of topupPayoffs) {
      const basis = t.estimate.ready
        ? `ดอกเบี้ยค้างถึงวันย้ายทุน ${money(t.estimate.accrued)} − หักล่วงหน้า ${t.advanceMonths} เดือน ${money(t.estimate.advanceCredit)} − รับแล้ว ${money(t.paid)}`
        : 'ประมาณดอกเบี้ยไม่ได้ (ไม่มีวันทำวงเงินเพิ่ม) ใส่เฉพาะเงินต้น'
      notes.push(`วงเงินเพิ่ม ${money(t.principal)} บาท @ ${money(t.monthly)}/เดือน (${t.annualRate}% ต่อปี) ${t.startDate ? `ตั้งแต่ ${formatThai(t.startDate)} ` : ''}→ ยอดปิดประมาณ ${money(t.payoff)} บาท (${basis}) ใส่ไว้ที่ "ค่าใช้จ่ายอื่นที่ต้องใช้ทุนนี้จ่าย"${t.advanceMonths ? ' · หักล่วงหน้าอ่านจากหมายเหตุวงเงินเพิ่ม' : ''}`)
    }
  }
  if (c.type === 'จำนอง') notes.push('สัญญานี้เป็นจำนอง: ค่าใช้จ่ายด้านล่างคิดแบบขายฝาก (ค่าจดไถ่ ขายฝากใหม่ 2% ภาษีธุรกิจเฉพาะ) ใช้เป็นประมาณการเท่านั้น')
  return { form, payoffMode: 'calculated', notes, topupPayoffs }
}

// ผลประเมินที่เลือกบนหน้าภาษี → ฐานราคาประเมินของฟอร์มย้ายทุน
// ใช้โหมด "ราคาต่อตารางวา × เนื้อที่" เฉพาะเมื่อเนื้อที่แปลงหลักเท่ากับเนื้อที่รวม (แปลงเดียว) ไม่งั้นใช้ยอดรวม = ราคา × ตร.ว.รวม ให้ตรงกับแท็บอื่น
export function buildRefinanceFormFromValuation(valuation) {
  if (!valuation) return null
  const perWa = Number(valuation.landPricePerWa) || 0
  const rai = Number(valuation.areaRai) || 0
  const ngan = Number(valuation.areaNgan) || 0
  const wa = Number(valuation.areaWa) || 0
  const totalWa = Number(valuation.totalWa) || 0
  const deedWa = rai * 400 + ngan * 100 + wa
  const singleDeed = Number.isInteger(rai) && Number.isInteger(ngan) && deedWa > 0 && (totalWa === 0 || Math.abs(totalWa - deedWa) < 0.01)
  if (perWa > 0 && singleDeed) {
    return { assessmentMode: 'area', landPricePerWa: String(perWa), areaRai: String(rai), areaNgan: String(ngan), areaWa: String(round2(wa)) }
  }
  if (perWa > 0 && totalWa > 0) return { assessmentMode: 'manual', assessedValue: String(round2(perWa * totalWa)) }
  if (Number(valuation.assessedValue) > 0) return { assessmentMode: 'manual', assessedValue: String(round2(valuation.assessedValue)) }
  return null
}

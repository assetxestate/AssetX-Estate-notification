// ทดสอบการเติมฟอร์มย้ายทุนจากสัญญาลูกค้า/ผลประเมิน: node --test src/lib/refinanceFromCustomer.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRefinanceFormFromCustomer, buildRefinanceFormFromValuation, customerRefinanceLabel, monthsPerPeriod, parseAdvanceMonthsFromNote, estimateTopupPayoffs } from './refinanceFromCustomer.js'
import { ADVANCE_DEDUCTION_SLIP_ID } from './advanceDeduction.js'

const today = new Date(2026, 9, 29)
const deduction = (paidDate, amountPaid) => ({ paidDate, amountPaid, slipId: ADVANCE_DEDUCTION_SLIP_ID, note: 'ชำระล่วงหน้า' })
const paid = (paidDate, amountPaid) => ({ paidDate, amountPaid, slipId: 'abc', note: 'สลิป' })

// จำลองสิทธิชัย: จำนอง 2M 24,000/เดือน ทำ 30 มี.ค. 69 หักล่วงหน้า 3 งวด จ่ายจริง 3 งวด
// + วงเงินเพิ่ม 700k 8,400/เดือน ทำ 29 พ.ค. 69 หักล่วงหน้า 3 เดือน (ในหมายเหตุ) รับแล้ว 1 งวด
const sitthichai = () => ({
  id: 'CID1', name: 'สิทธิชัย', fullLabel: 'ที่ดินเปล่าติดถนนเลี่ยงเมืองชะอำ', type: 'จำนอง',
  principal: 2_000_000, amount: 24_000, freq: 'รายเดือน', contractEndDate: '2027-03-30',
  deeds: [{ no: '96753' }],
  topupPrincipal: 700_000, topupMonthlyInterest: 8_400,
  topups: [{ topupAmount: 700_000, interestAmount: 8_400, freq: 'รายเดือน', topupDate: '2026-05-29', topupStartDate: '2026-09-30', topupEndDate: '2027-03-30', note: 'หักล่วงหน้า 3 เดือน 25,200 บาท (3 × 8,400) ยืนยัน 28 ต.ค. 69', records: { 1: paid('2026-10-09', 8_400) } }],
  payments: [
    { installment: 1, dateStr: '2026-04-30', record: deduction('2026-03-30', 24_000) },
    { installment: 2, dateStr: '2026-05-30', record: deduction('2026-03-30', 24_000) },
    { installment: 3, dateStr: '2026-06-30', record: deduction('2026-03-30', 24_000) },
    { installment: 4, dateStr: '2026-07-30', record: paid('2026-05-29', 24_000) },
    { installment: 5, dateStr: '2026-08-30', record: paid('2026-05-29', 24_000) },
    { installment: 6, dateStr: '2026-09-30', record: paid('2026-05-29', 24_000) },
    { installment: 7, dateStr: '2026-11-06', postponedFrom: '2026-10-30', record: null },
  ],
  disbursement: { advanceMonths: 0, advanceTreatment: null },
})

test('สัญญาหลักเติมเฉพาะทุนเดิม วงเงินเพิ่มคิดแยกเป็นยอดปิดใน otherCosts', () => {
  const { form, payoffMode, notes, topupPayoffs } = buildRefinanceFormFromCustomer(sitthichai(), { today })
  assert.equal(payoffMode, 'calculated')
  assert.equal(form.principal, '2000000')
  assert.equal(form.annualRate, '14.4')
  assert.equal(form.startDate, '2026-03-30')
  assert.equal(form.endDate, '2027-03-30')
  assert.equal(form.transferDate, '2026-10-29')
  assert.equal(form.advanceMonths, '3')
  assert.equal(form.advancePaidAmount, '72000')
  assert.equal(form.paymentMode, 'amount')
  assert.equal(form.otherPaid, '72000') // เฉพาะงวดจริงของสัญญาหลัก ไม่รวมหักล่วงหน้า ไม่รวมวงเงินเพิ่ม
  assert.equal(form.deedCount, '1')
  assert.equal(form.oldRegisteredValue, '2000000')
  // วงเงินเพิ่ม: 29 พ.ค. → 29 ต.ค. = 5 เดือน × 8,400 = 42,000 − หักล่วงหน้า 25,200 − รับแล้ว 8,400 = 8,400 ค้าง → ปิด 708,400
  assert.equal(topupPayoffs.length, 1)
  assert.equal(topupPayoffs[0].advanceMonths, 3)
  assert.equal(topupPayoffs[0].estimate.ready, true)
  assert.equal(topupPayoffs[0].estimate.accrued, 42000)
  assert.equal(topupPayoffs[0].payoff, 708400)
  assert.equal(form.otherCosts, '708400')
  assert.ok(notes.some((n) => n.includes('จำนอง')), 'ต้องเตือนว่าสูตรคิดแบบขายฝาก')
  assert.ok(notes.some((n) => n.includes('708,400')))
})

test('สัญญารายปีใช้หักล่วงหน้าจากข้อมูลเบิกจ่าย และอนุมานวันทำสัญญาจากวันหัก', () => {
  const { form, notes } = buildRefinanceFormFromCustomer({
    type: 'จำนอง', name: 'กนกพร', principal: 1_500_000, amount: 120_000, freq: 'ปีละครั้ง', contractEndDate: '2026-11-17',
    deeds: [{}, {}], payments: [{ installment: 1, dateStr: '2026-11-17', record: null }],
    disbursement: { advanceMonths: 3, advanceTotal: 30_000, advanceTreatment: 'before_schedule', advanceDeductedAt: '2025-11-17' },
  }, { today })
  assert.equal(form.annualRate, '8')
  assert.equal(form.advanceMonths, '3')
  assert.equal(form.advancePaidAmount, '30000')
  assert.equal(form.startDate, '2025-11-17')
  assert.equal(form.otherPaid, '0')
  assert.equal(form.deedCount, '2')
  assert.equal(form.otherCosts, undefined) // ไม่มีวงเงินเพิ่ม → ไม่แตะช่องค่าใช้จ่ายอื่น
  assert.ok(notes.some((n) => n.includes('ข้อมูลเบิกจ่าย')))
})

test('ไม่มีข้อมูลหักล่วงหน้า → ถอยจากงวดแรก 1 รอบ (ใช้วันเดิมก่อนเลื่อน)', () => {
  const { form } = buildRefinanceFormFromCustomer({
    type: 'ขายฝาก', name: 'ใหม่', principal: 1_000_000, amount: 12_500, freq: 'รายเดือน', contractEndDate: '2027-02-25',
    payments: [{ installment: 1, dateStr: '2026-04-10', postponedFrom: '2026-03-25', record: null }],
  }, { today })
  assert.equal(form.startDate, '2026-02-25')
  assert.equal(form.advanceMonths, '0')
  assert.equal(form.advancePaidAmount, '')
  assert.equal(form.deedCount, '1')
  assert.equal(form.annualRate, '15')
})

test('รอบชำระพิเศษ: ราย 2 สัปดาห์ 6 งวด = 3 เดือน, 2 ครั้ง/เดือน และรายสัปดาห์', () => {
  const recs = Array.from({ length: 6 }, (_, i) => ({ installment: i + 1, dateStr: '2026-02-03', record: deduction('2026-01-19', 50_000) }))
  const { form } = buildRefinanceFormFromCustomer({ type: 'ขายฝาก', name: 'บังอร', principal: 8_000_000, amount: 50_000, freq: 'ทุก 2 สัปดาห์', payments: recs }, { today })
  assert.equal(form.advanceMonths, '3')
  assert.equal(form.advancePaidAmount, '300000')
  assert.equal(form.annualRate, '15') // 50,000 × 2 × 12 / 8M
  assert.equal(monthsPerPeriod('ทุก 2 สัปดาห์'), 0.5)
  assert.equal(monthsPerPeriod('2 ครั้ง/เดือน'), 0.5)
  assert.equal(monthsPerPeriod('รายสัปดาห์'), 12 / 52)
  assert.equal(monthsPerPeriod('ปีละครั้ง'), 12)
  const twice = buildRefinanceFormFromCustomer({ type: 'ขายฝาก', name: 'x', principal: 1_200_000, amount: 7_500, freq: '2 ครั้ง/เดือน', payments: [{ installment: 1, dateStr: '2026-02-15', record: null }] }, { today })
  assert.equal(twice.form.annualRate, '15') // 7,500 × 2 × 12 / 1.2M
  assert.equal(twice.form.startDate, '2026-01-31')
})

test('อ่านเดือนหักล่วงหน้าจากหมายเหตุวงเงินเพิ่ม และประมาณยอดปิดเมื่อไม่มีวันทำวงเงินเพิ่ม', () => {
  assert.equal(parseAdvanceMonthsFromNote('หักล่วงหน้า 3 เดือน 25,200 บาท'), 3)
  assert.equal(parseAdvanceMonthsFromNote('หักล่วงหน้า 2 งวด'), 2)
  assert.equal(parseAdvanceMonthsFromNote('ไม่มี'), 0)
  const [t] = estimateTopupPayoffs([{ topupAmount: 500_000, interestAmount: 6_250, freq: 'รายเดือน', records: {} }], '2026-10-29')
  assert.equal(t.estimate.ready, false)
  assert.equal(t.payoff, 500_000)
})

test('ผลประเมิน → โหมดพื้นที่เฉพาะแปลงเดียว, หลายแปลงใช้ยอดรวม = ราคา × ตร.ว.รวม (ตรงกับแท็บโอน)', () => {
  assert.deepEqual(buildRefinanceFormFromValuation({ landPricePerWa: 4100, areaRai: 5, areaNgan: 1, areaWa: 43.2, totalWa: 2143.2 }),
    { assessmentMode: 'area', landPricePerWa: '4100', areaRai: '5', areaNgan: '1', areaWa: '43.2' })
  assert.deepEqual(buildRefinanceFormFromValuation({ landPricePerWa: 4100, areaRai: 5, areaNgan: 1, areaWa: 43.2, totalWa: 4286.4 }),
    { assessmentMode: 'manual', assessedValue: '17574240' })
  assert.deepEqual(buildRefinanceFormFromValuation({ landPricePerWa: 0, areaRai: 0, areaNgan: 0, areaWa: 0, totalWa: 0, assessedValue: 1_234_567.891 }),
    { assessmentMode: 'manual', assessedValue: '1234567.89' })
  assert.equal(buildRefinanceFormFromValuation({ assessedValue: 0 }), null)
  assert.equal(buildRefinanceFormFromValuation(null), null)
})

test('ป้ายชื่อลูกค้าในตัวเลือก', () => {
  assert.equal(customerRefinanceLabel({ type: 'ขายฝาก', name: 'คุณบังอร', fullLabel: 'ขายฝาก คุณบังอร (บางใหญ่ นนทบุรี)' }), 'ขายฝาก คุณบังอร · คุณบังอร (บางใหญ่ นนทบุรี)')
  assert.equal(customerRefinanceLabel({ type: 'จำนอง', name: 'สิทธิชัย', fullLabel: 'สิทธิชัย' }), 'จำนอง สิทธิชัย')
})

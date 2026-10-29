import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAdvanceDeduction, getRecordedUpfrontDeductions, getUpfrontDeductionEntries } from './advanceDeduction.js'

test('advance deduction is separate from the remaining schedule', () => {
  const deduction = buildAdvanceDeduction(2, 12500)
  const remainingSchedule = Array.from({ length: 10 }, () => 12500)
  assert.deepEqual(deduction, {
    advanceMonths: 2,
    advanceTotal: 25000,
    advanceTreatment: 'before_schedule',
    advanceDeductedAt: null,
  })
  assert.equal(remainingSchedule.reduce((sum, amount) => sum + amount, 0), 125000)
  assert.equal(1000000 + remainingSchedule.reduce((sum, amount) => sum + amount, 0), 1125000)
})

test('zero advance clears its metadata and invalid counts fail', () => {
  assert.deepEqual(buildAdvanceDeduction(0, 12500, '2026-02-25'), {
    advanceMonths: 0,
    advanceTotal: 0,
    advanceTreatment: null,
    advanceDeductedAt: null,
  })
  assert.throws(() => buildAdvanceDeduction(2.5, 12500), RangeError)
  assert.throws(() => buildAdvanceDeduction(-1, 12500), RangeError)
})

test('dashboard counts only confirmed, non-voided upfront deductions', () => {
  const confirmed = { id: 'sarita', disbursement: buildAdvanceDeduction(2, 12500) }
  const closed = { id: 'closed', isClosed: true, disbursement: buildAdvanceDeduction(1, 5000) }
  const unverified = { id: 'unverified', disbursement: { ...buildAdvanceDeduction(1, 5000), advanceTreatment: null } }
  const voided = { id: 'voided', isVoided: true, disbursement: buildAdvanceDeduction(1, 5000) }
  const draft = { id: 'draft', isHiddenDraft: true, disbursement: buildAdvanceDeduction(1, 5000) }
  const cases = getRecordedUpfrontDeductions([confirmed, closed, unverified, voided, draft])
  assert.deepEqual(cases.map(c => c.id), ['sarita', 'closed'])
  assert.equal(cases.reduce((sum, c) => sum + c.disbursement.advanceTotal, 0), 30000)
})

test('upfront entries appear before, but not inside, the remaining schedule', () => {
  const deduction = buildAdvanceDeduction(2, 12500)
  assert.deepEqual(getUpfrontDeductionEntries(deduction), [
    { index: 1, amount: 12500, deductedAt: null },
    { index: 2, amount: 12500, deductedAt: null },
  ])
  assert.equal(getUpfrontDeductionEntries({ ...deduction, advanceTreatment: null }).length, 0)
  assert.equal(getUpfrontDeductionEntries(buildAdvanceDeduction(0, 12500)).length, 0)
})

test('advance-deduction records are flagged by slip_id, not by the note text', async () => {
  const { isAdvanceDeductionRecord, getAdvanceDeductionRecordCases, ADVANCE_DEDUCTION_SLIP_ID } = await import('./advanceDeduction.js')
  assert.equal(isAdvanceDeductionRecord({ slipId: ADVANCE_DEDUCTION_SLIP_ID, note: 'ชำระล่วงหน้า' }), true)
  // ชำระงวดล่วงหน้าด้วยเงินจริง (note เดียวกัน มีสลิป) ต้องไม่ถูกนับเป็นหักล่วงหน้า
  assert.equal(isAdvanceDeductionRecord({ slipId: 'ccdK5BQ2', slipUrl: 'https://x/slip.jpg', note: 'ชำระล่วงหน้าพร้อมงวด 4' }), false)
  assert.equal(isAdvanceDeductionRecord({ slipId: '', note: 'ชำระล่วงหน้า' }), false)
  assert.equal(isAdvanceDeductionRecord(null), false)

  const customers = [
    { id: 7, name: 'ชลากร', isClosed: false },
    { id: 4, name: 'บังอร', isClosed: true },
    { id: 9, name: 'ยกเลิก', isVoided: true },
    { id: 'CID1', name: 'ไม่มีหักล่วงหน้า' },
  ]
  const paymentRecords = {
    7: {
      1: { slipId: ADVANCE_DEDUCTION_SLIP_ID, paidAt: '2026-03-06', amountPaid: 25000, note: 'ชำระล่วงหน้า' },
      2: { slipId: ADVANCE_DEDUCTION_SLIP_ID, paidAt: '2026-03-06', amountPaid: 25000, note: 'ชำระล่วงหน้า' },
      3: { slipId: 'abc', paidAt: '2026-07-07', amountPaid: 25000, note: 'สลิปจริง' },
    },
    4: { 2: { slipId: ADVANCE_DEDUCTION_SLIP_ID, paidAt: '2026-01-19', amountPaid: 50000 }, 1: { slipId: ADVANCE_DEDUCTION_SLIP_ID, paidAt: '2026-01-19', amountPaid: 50000 } },
    9: { 1: { slipId: ADVANCE_DEDUCTION_SLIP_ID, paidAt: '2026-01-01', amountPaid: 1 } },
    CID1: { 1: { slipId: 'zzz', paidAt: '2026-05-05', amountPaid: 1000 } },
  }
  const cases = getAdvanceDeductionRecordCases(customers, paymentRecords)
  assert.deepEqual(cases.map((c) => c.id), [7, 4])
  assert.deepEqual(cases[0], { id: 7, name: 'ชลากร', isClosed: false, source: 'records', periods: 2, installments: [1, 2], total: 50000, deductedAt: '2026-03-06' })
  assert.equal(cases[1].isClosed, true)
  assert.equal(cases[1].total, 100000)
})

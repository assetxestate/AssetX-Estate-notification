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

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { refinanceFieldErrors } from './refinanceFieldErrors.js'

const form = { oldRegisteredValue: '1000000', oldWithholding: '0', newWithholding: '0', deedCount: '1', taxMode: 'sbt', newAdvanceMonths: '0', newAnnualRate: '', assessmentMode: 'manual', assessedValue: '1000000', oldPayoff: '1000000' }
test('highlights required fields but allows zero taxes and optional blank rate', () => {
  assert.deepEqual(refinanceFieldErrors(form, 'manual'), {})
  const errors = refinanceFieldErrors({ ...form, oldWithholding: '', newWithholding: '', taxMode: '', newAdvanceMonths: '2' }, 'manual')
  for (const key of ['oldWithholding', 'newWithholding', 'taxMode', 'newAnnualRate']) assert.ok(errors[key])
  assert.equal(errors.principal, undefined)
})
test('validates area and dates only in active modes', () => {
  const errors = refinanceFieldErrors({ ...form, assessmentMode: 'area', landPricePerWa: '1000', areaRai: '0', areaNgan: '0', areaWa: '0', buildingAssessedValue: '', principal: '1000000', annualRate: '15', advanceMonths: '2', advancePaidAmount: '', paymentMode: 'installments', paidInstallments: '1.5', partialPaid: '0', startDate: '2026-02-25', endDate: '2027-02-25', transferDate: '2027-03-25' }, 'calculated')
  for (const key of ['areaWa', 'buildingAssessedValue', 'paidInstallments', 'transferDate']) assert.ok(errors[key])
  assert.equal(errors.advancePaidAmount, undefined)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateRefinanceWithholding } from './refinanceWithholding.js'
import { calculateRefinanceFunding } from './refinanceCalculator.js'

const form = {
  oldWithholdingMode: 'individual', newWithholdingMode: 'individual_same_day',
  startDate: '2026-02-25', endDate: '2027-02-25', transferDate: '2026-11-25',
  oldWithholding: '99999', newWithholding: '99999',
}
test('same-year individual redemption and same-day resale use one year, not annual PIT exemption', () => {
  const result = calculateRefinanceWithholding(form, 1000000)
  assert.equal(result.old.tax, 4000)
  assert.equal(result.new.tax, 4000)
  assert.equal(result.old.detail.expenseRate, 0.92)
  assert.equal(result.old.years, 1)
})
test('old investor calendar holding years differ from same-day new seller years', () => {
  const result = calculateRefinanceWithholding({ ...form, transferDate: '2027-01-25' }, 1000000)
  assert.equal(result.old.years, 2)
  assert.equal(result.old.tax, 8000)
  assert.equal(result.new.years, 1)
  assert.equal(result.new.tax, 4000)
})
test('missing assessment, invalid dates and expired contracts block auto WHT', () => {
  assert.equal(calculateRefinanceWithholding(form, '').old.ready, false)
  for (const override of [{ startDate: '' }, { transferDate: '2026-02-30' }, { transferDate: '2027-03-01' }, { transferDate: '2026-01-01' }, { endDate: '' }]) {
    const result = calculateRefinanceWithholding({ ...form, ...override }, 1000000)
    assert.equal(result.old.ready, false)
    assert.equal(result.new.ready, false)
  }
})
test('manual values including zero remain independent of automatic calculations', () => {
  const result = calculateRefinanceWithholding({ ...form, startDate: '', oldWithholdingMode: 'manual', newWithholdingMode: 'manual', oldWithholding: '0', newWithholding: '3000' }, '')
  assert.equal(result.old.tax, 0)
  assert.equal(result.new.tax, 3000)
  assert.equal(calculateRefinanceWithholding({ ...form, oldWithholdingMode: 'manual', oldWithholding: '' }, 1000000).old.ready, false)
})
test('both computed taxes are financed once without reducing target client cash', () => {
  const tax = calculateRefinanceWithholding(form, 1000000)
  const input = { oldPayoff: 1087500, assessedValue: 1000000, oldRegisteredValue: 1087500, deedCount: 1, taxMode: 'sbt', newAnnualRate: 15, newAdvanceMonths: 2, customerCash: 100000 }
  const withTax = calculateRefinanceFunding({ ...input, oldWithholding: tax.old.tax, newWithholding: tax.new.tax })
  const noTax = calculateRefinanceFunding({ ...input, oldWithholding: 0, newWithholding: 0 })
  assert.equal(withTax.ready, true)
  assert.equal(withTax.fixedCosts - noTax.fixedCosts, 8000)
  assert.ok(withTax.netCustomerCash >= 100000)
  assert.ok(withTax.gross > noTax.gross)
})

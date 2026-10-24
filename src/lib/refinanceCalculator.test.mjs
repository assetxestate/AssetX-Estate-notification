import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateOldPayoffEstimate, calculateRefinanceFunding, calculateOfficialAssessment } from './refinanceCalculator.js'

test('official land area assessment includes buildings once', () => {
  const result = calculateOfficialAssessment({ landPricePerWa: 1550, areaRai: 2, areaNgan: 3, areaWa: 89.6, buildingAssessedValue: 100000 })
  assert.equal(result.ready, true)
  assert.equal(result.totalWa, 1189.6)
  assert.equal(result.landValue, 1843880)
  assert.equal(result.total, 1943880)
})

test('assessment rejects missing, negative and fractional major area units', () => {
  const input = { landPricePerWa: 1000, areaRai: 0, areaNgan: 0, areaWa: 100, buildingAssessedValue: 0 }
  assert.equal(calculateOfficialAssessment(input).total, 100000)
  for (const override of [{ buildingAssessedValue: '' }, { landPricePerWa: -1 }, { areaWa: 0 }, { areaRai: 0.5 }, { areaWa: 'bad' }]) {
    assert.equal(calculateOfficialAssessment({ ...input, ...override }).ready, false)
  }
})

const base = {
  oldPayoff: 1087500, assessedValue: 1000000, oldRegisteredValue: 1087500,
  deedCount: 1, oldWithholding: 0, newWithholding: 0, taxMode: 'sbt',
  upfrontRate: 0, fixedDeduction: 0, otherCosts: 0, customerCash: 0,
}

test('grosses up SBT against the resulting funding amount', () => {
  const result = calculateRefinanceFunding(base)
  assert.equal(result.ready, true)
  assert.equal(result.oldFee, 50)
  assert.equal(result.oldStamp, 5438)
  assert.equal(result.newFee, 20000)
  assert.equal(result.gross, 1150971)
  assert.ok(result.available >= result.fixedCosts)
  assert.ok(calculateRefinanceFunding({ ...base, otherCosts: 1000 }).gross > result.gross)
})

test('grosses up stamp and advance deductions without double charging SBT', () => {
  const result = calculateRefinanceFunding({ ...base, taxMode: 'stamp', newAnnualRate: 15, newAdvanceMonths: 2 })
  assert.equal(result.gross, 1147412)
  assert.equal(result.newTax, Math.ceil(result.gross / 200))
  assert.equal(result.newAdvanceWithheld, Math.round(result.gross * 0.025 * 100) / 100)
  assert.equal(result.monthlyNewReturn, Math.round(result.gross * 0.0125 * 100) / 100)
  assert.ok(result.available >= result.fixedCosts)
})

test('requires tax decision and both withholding amounts before showing a total', () => {
  const result = calculateRefinanceFunding({ ...base, taxMode: '', newWithholding: '' })
  assert.equal(result.ready, false)
  assert.ok(result.errors.some(error => error.includes('ภาษีธุรกิจเฉพาะ')))
  assert.ok(result.errors.some(error => error.includes('ภาษีหัก ณ ที่จ่ายตอนขายฝากใหม่')))
})

test('rejects invalid fees, assessment and withholding rates', () => {
  assert.equal(calculateRefinanceFunding({ ...base, assessedValue: 0 }).ready, false)
  assert.equal(calculateRefinanceFunding({ ...base, otherCosts: -1 }).ready, false)
  assert.equal(calculateRefinanceFunding({ ...base, upfrontRate: 95 }).ready, false)
  assert.equal(calculateRefinanceFunding({ ...base, newAdvanceMonths: 2, newAnnualRate: '' }).ready, false)
})

test('uses assessed value when it exceeds new funding and includes verified fixed costs', () => {
  const result = calculateRefinanceFunding({
    ...base, assessedValue: 2000000, oldRegisteredValue: 900000,
    taxMode: 'stamp', oldWithholding: 6000, newWithholding: 8000,
    fixedDeduction: 2000, customerCash: 50000,
  })
  assert.equal(result.ready, true)
  assert.equal(result.oldStamp, 10000)
  assert.equal(result.newFee, 40000)
  assert.equal(result.newTax, 10000)
  assert.ok(result.available >= result.fixedCosts)
  assert.ok(result.extraCosts > result.customerCash)
})

const payoffInput = {
  principal: 1000000, annualRate: 15, startDate: '2026-02-25',
  endDate: '2027-02-25', transferDate: '2026-11-25',
  advanceMonths: 2, advancePaidAmount: '', otherPaid: 0,
}

test('sample installment scenarios credit advance separately and ignore stale manual amount', () => {
  for (const [paidInstallments, payoff] of [[0, 1087500], [3, 1050000], [5, 1025000], [7, 1000000]]) {
    const result = calculateOldPayoffEstimate({ ...payoffInput, paymentMode: 'installments', paidInstallments, partialPaid: 0, otherPaid: 999999 })
    assert.equal(result.ready, true)
    assert.equal(result.payoff, payoff)
    assert.equal(result.advanceCredit, 25000)
    assert.equal(result.otherPaid, paidInstallments * 12500)
  }
})

test('partial payments and manual mode do not double count installments', () => {
  const input = { ...payoffInput, paymentMode: 'installments', paidInstallments: 3, partialPaid: 5000 }
  assert.equal(calculateOldPayoffEstimate(input).payoff, 1045000)
  assert.equal(calculateOldPayoffEstimate({ ...input, paymentMode: 'amount', otherPaid: 10000 }).payoff, 1077500)
  for (const paidInstallments of [-1, 1.5, '', 'bad']) {
    assert.equal(calculateOldPayoffEstimate({ ...input, paidInstallments }).ready, false)
  }
  assert.equal(calculateOldPayoffEstimate({ ...input, partialPaid: -1 }).ready, false)
  assert.equal(calculateOldPayoffEstimate({ ...input, paidInstallments: 8 }).ready, false)
})

test('funding leaves target cash after every deduction and is minimal to one baht', () => {
  for (const taxMode of ['sbt', 'stamp']) {
    for (const customerCash of [0, 50000, 100000]) {
      const input = { ...base, taxMode, customerCash, newAnnualRate: 15, newAdvanceMonths: 2, upfrontRate: 2, fixedDeduction: 3000, otherCosts: 1500, oldWithholding: 2000, newWithholding: 4000 }
      const result = calculateRefinanceFunding(input)
      assert.equal(result.ready, true)
      assert.ok(result.netCustomerCash >= customerCash)
      assert.ok(Math.abs(result.gross - result.oldPayoff - result.totalExpenses - result.netCustomerCash) < 0.01)
      assert.ok(Math.abs(result.netCustomerCash - customerCash - result.surplus) < 0.01)
      const lowerGross = result.gross - 1
      const round = value => Math.round((value + Number.EPSILON) * 100) / 100
      const taxBase = Math.max(input.assessedValue, lowerGross)
      const tax = taxMode === 'sbt' ? round(taxBase * 0.033) : Math.ceil(taxBase / 200)
      const available = round(lowerGross - tax - round(lowerGross * 0.025) - round(lowerGross * 0.02))
      assert.ok(available < result.fixedCosts)
    }
  }
})

test('credits prepaid months once when estimating early payoff', () => {
  const result = calculateOldPayoffEstimate(payoffInput)
  assert.equal(result.ready, true)
  assert.equal(result.fullMonths, 9)
  assert.equal(result.monthlyAmount, 12500)
  assert.equal(result.accrued, 112500)
  assert.equal(result.advanceCredit, 25000)
  assert.equal(result.payoff, 1087500)
})

test('uses actual advance amount and extra payments when provided', () => {
  const result = calculateOldPayoffEstimate({ ...payoffInput, advancePaidAmount: 20000, otherPaid: 10000 })
  assert.equal(result.payoff, 1082500)
})

test('prorates an incomplete month and blocks contradictory dates or overpayment', () => {
  const partial = calculateOldPayoffEstimate({ ...payoffInput, transferDate: '2026-11-10' })
  assert.equal(partial.ready, true)
  assert.equal(partial.fullMonths, 8)
  assert.ok(partial.elapsedDays > 0)
  assert.ok(partial.accrued < 112500)
  assert.equal(calculateOldPayoffEstimate({ ...payoffInput, transferDate: '2027-03-01' }).ready, false)
  assert.equal(calculateOldPayoffEstimate({ ...payoffInput, otherPaid: 200000 }).ready, false)
})

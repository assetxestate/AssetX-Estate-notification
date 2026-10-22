export function buildAdvanceDeduction(months, amountPerInstallment, deductedAt = null) {
  const count = Number(months)
  const amount = Number(amountPerInstallment)
  if (!Number.isInteger(count) || count < 0 || count > 24) {
    throw new RangeError('Advance months must be an integer from 0 to 24')
  }
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError('Installment amount must be nonnegative')
  }
  return {
    advanceMonths: count,
    advanceTotal: Math.round(count * amount * 100) / 100,
    advanceTreatment: count > 0 ? 'before_schedule' : null,
    advanceDeductedAt: count > 0 ? deductedAt || null : null,
  }
}

export function getRecordedUpfrontDeductions(customers) {
  return customers.filter(customer => {
    const months = Number(customer.disbursement?.advanceMonths)
    const total = Number(customer.disbursement?.advanceTotal)
    return !customer.isVoided && !customer.isHiddenDraft
      && customer.disbursement?.advanceTreatment === 'before_schedule'
      && Number.isInteger(months) && months > 0 && Number.isFinite(total) && total > 0
  })
}

export function getUpfrontDeductionEntries(disbursement) {
  const months = Number(disbursement?.advanceMonths)
  const total = Number(disbursement?.advanceTotal)
  if (disbursement?.advanceTreatment !== 'before_schedule'
    || !Number.isInteger(months) || months < 1 || months > 24
    || !Number.isFinite(total) || total <= 0) return []

  const totalCents = Math.round(total * 100)
  const centsPerMonth = Math.floor(totalCents / months)
  return Array.from({ length: months }, (_, index) => ({
    index: index + 1,
    amount: (centsPerMonth + (index === months - 1 ? totalCents - centsPerMonth * months : 0)) / 100,
    deductedAt: disbursement.advanceDeductedAt || null,
  }))
}

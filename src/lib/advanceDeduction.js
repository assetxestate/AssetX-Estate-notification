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

// ── หักล่วงหน้าที่บันทึกเป็นงวดในตารางชำระ ──
// สัญญารายเดือน/ราย 2 สัปดาห์บันทึกงวดล่วงหน้าเป็น payment_records จริง (งวดที่ 1..k, แบบของสิทธิชัย) แต่ไม่มีเงินโอน
// จึงติดธงไว้ที่ slip_id — ใช้ note ไม่ได้ เพราะ "ชำระล่วงหน้า" เป็นค่าเริ่มต้นของการชำระงวดล่วงหน้าด้วยเงินจริงด้วย
export const ADVANCE_DEDUCTION_SLIP_ID = 'ADVANCE_DEDUCTION'

export function isAdvanceDeductionRecord(record) {
  return record?.slipId === ADVANCE_DEDUCTION_SLIP_ID
}

// รวมบันทึกที่ติดธงเป็นเคสต่อลูกค้า รูปเดียวกับเคสจาก disbursement เพื่อแสดงรวมกันบน Dashboard
export function getAdvanceDeductionRecordCases(customers, paymentRecords) {
  return (customers || []).flatMap((customer) => {
    if (customer.isVoided || customer.isHiddenDraft) return []
    const records = paymentRecords?.[customer.id] || paymentRecords?.[String(customer.id)] || {}
    const entries = Object.entries(records).filter(([, record]) => isAdvanceDeductionRecord(record))
    if (!entries.length) return []
    const dates = entries.map(([, record]) => record.paidAt || record.paidDate || '').filter(Boolean).sort()
    return [{
      id: customer.id,
      name: customer.name,
      isClosed: Boolean(customer.isClosed),
      source: 'records',
      periods: entries.length,
      installments: entries.map(([installment]) => Number(installment)).sort((a, b) => a - b),
      total: entries.reduce((sum, [, record]) => sum + (Number(record.amountPaid) || 0), 0),
      deductedAt: dates[0] || null,
    }]
  })
}

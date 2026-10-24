export function refinanceFieldErrors(form, payoffMode) {
  const errors = {}
  const numeric = (key, required = true, positive = false, integer = false) => {
    const value = form[key]
    if (value === '' || value == null) {
      if (required) errors[key] = 'กรุณากรอกข้อมูลช่องนี้'
    } else if (!Number.isFinite(Number(value)) || Number(value) < 0 || (positive && Number(value) === 0)) {
      errors[key] = positive ? 'ต้องเป็นตัวเลขมากกว่า 0' : 'ต้องเป็นตัวเลขไม่ติดลบ'
    } else if (integer && !Number.isInteger(Number(value))) errors[key] = 'ต้องเป็นจำนวนเต็ม'
  }
  numeric('oldRegisteredValue', true, true)
  numeric('oldWithholding')
  numeric('newWithholding')
  numeric('deedCount', true, true, true)
  for (const key of ['upfrontRate', 'fixedDeduction', 'otherCosts', 'customerCash']) numeric(key, false)
  numeric('newAdvanceMonths', false, false, true)
  numeric('newAnnualRate', Number(form.newAdvanceMonths) > 0)
  if (!['sbt', 'stamp'].includes(form.taxMode)) errors.taxMode = 'กรุณาเลือกประเภทภาษี'
  if (Number(form.upfrontRate || 0) + Number(form.newAnnualRate || 0) / 12 * Number(form.newAdvanceMonths || 0) >= 95) {
    for (const key of ['upfrontRate', 'newAnnualRate', 'newAdvanceMonths']) errors[key] = 'ยอดหักรวมต้องต่ำกว่า 95% ของวงเงิน'
  }
  if (form.assessmentMode === 'area') {
    numeric('landPricePerWa', true, true)
    numeric('areaRai', true, false, true)
    numeric('areaNgan', true, false, true)
    numeric('areaWa')
    numeric('buildingAssessedValue')
    if (['areaRai', 'areaNgan', 'areaWa'].every(key => !errors[key]) && Number(form.areaRai) * 400 + Number(form.areaNgan) * 100 + Number(form.areaWa) === 0) errors.areaWa = 'เนื้อที่รวมต้องมากกว่า 0'
  } else numeric('assessedValue', true, true)
  if (payoffMode === 'manual') numeric('oldPayoff', true, true)
  else {
    numeric('principal', true, true)
    numeric('annualRate')
    numeric('advanceMonths', true, false, true)
    numeric('advancePaidAmount', false)
    if (form.paymentMode === 'installments') {
      numeric('paidInstallments', true, false, true)
      numeric('partialPaid')
    } else numeric('otherPaid')
    for (const key of ['startDate', 'endDate', 'transferDate']) {
      const value = form[key]
      const date = new Date(`${value}T00:00:00Z`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) errors[key] = 'กรุณาระบุวันที่ให้ถูกต้อง'
    }
    if (!errors.startDate && !errors.transferDate && form.transferDate <= form.startDate) errors.transferDate = 'วันย้ายทุนต้องหลังวันทำสัญญา'
    if (!errors.endDate && !errors.startDate && form.endDate <= form.startDate) errors.endDate = 'วันครบกำหนดต้องหลังวันทำสัญญา'
    if (!errors.endDate && !errors.transferDate && form.transferDate > form.endDate) errors.transferDate = 'วันย้ายทุนต้องไม่เกินวันครบกำหนด'
  }
  return errors
}

const amount = value => Number(value)
const validAmount = value => value !== '' && value !== null && value !== undefined && Number.isFinite(amount(value)) && amount(value) >= 0
const round = value => Math.round((value + Number.EPSILON) * 100) / 100

export function calculateOfficialAssessment(input = {}) {
  const errors = []
  for (const key of ['landPricePerWa', 'areaRai', 'areaNgan', 'areaWa', 'buildingAssessedValue']) {
    if (!validAmount(input[key])) errors.push('กรอกราคาประเมินและเนื้อที่ให้ครบ เป็นตัวเลขไม่ติดลบ (ไม่มีสิ่งปลูกสร้างให้ใส่ 0)')
  }
  if (!Number.isInteger(amount(input.areaRai)) || !Number.isInteger(amount(input.areaNgan))) errors.push('ไร่และงานต้องเป็นจำนวนเต็ม ใช้ตารางวาสำหรับเศษเนื้อที่')
  const totalWa = amount(input.areaRai) * 400 + amount(input.areaNgan) * 100 + amount(input.areaWa)
  if (!(totalWa > 0) || !(amount(input.landPricePerWa) > 0)) errors.push('เนื้อที่รวมและราคาประเมินต่อตารางวาต้องมากกว่า 0')
  const landValue = round(totalWa * amount(input.landPricePerWa))
  const total = round(landValue + amount(input.buildingAssessedValue))
  if (!Number.isFinite(total)) errors.push('ยอดประเมินเกินช่วงที่คำนวณได้')
  return errors.length ? { ready: false, errors: [...new Set(errors)] } : { ready: true, errors: [], totalWa, landValue, total }
}

function dateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
}

function monthAnniversary(start, months) {
  const year = start.getUTCFullYear()
  const month = start.getUTCMonth() + months
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay)))
}

export function calculateOldPayoffEstimate(input = {}) {
  if (input.paymentMode === 'installments') {
    if (!validAmount(input.paidInstallments) || !Number.isInteger(amount(input.paidInstallments)) || !validAmount(input.partialPaid)) {
      return { ready: false, errors: ['จำนวนงวดที่จ่ายต้องเป็นจำนวนเต็มไม่ติดลบ และยอดจ่ายบางส่วนต้องไม่ติดลบ'], warnings: [] }
    }
    input = { ...input, otherPaid: round(round(amount(input.principal) * amount(input.annualRate) / 1200) * amount(input.paidInstallments) + amount(input.partialPaid)) }
  }
  const errors = []
  for (const [key, label] of [['principal', 'เงินต้นทุนเดิม'], ['annualRate', 'อัตราผลตอบแทนต่อปี'], ['advanceMonths', 'จำนวนเดือนที่หักล่วงหน้า'], ['otherPaid', 'เงินที่รับชำระเพิ่ม']]) {
    if (!validAmount(input[key])) errors.push(`ระบุ${label} (ใส่ 0 หากไม่มี)`)
  }
  const start = dateOnly(input.startDate)
  const transfer = dateOnly(input.transferDate)
  const end = dateOnly(input.endDate)
  if (!start || !transfer || !end) errors.push('ระบุวันที่ทำสัญญา วันย้ายทุน และวันครบกำหนดตามสัญญาให้ถูกต้อง')
  if (start && transfer && end && !(start < transfer && transfer <= end)) errors.push('วันย้ายทุนต้องอยู่หลังวันทำสัญญาและไม่เกินวันครบกำหนด')
  if (amount(input.principal) <= 0) errors.push('เงินต้นทุนเดิมต้องมากกว่า 0')
  if (!Number.isInteger(amount(input.advanceMonths)) || amount(input.advanceMonths) < 0) errors.push('เดือนที่หักล่วงหน้าต้องเป็นจำนวนเต็มไม่ติดลบ')
  if (input.advancePaidAmount !== '' && input.advancePaidAmount != null && !validAmount(input.advancePaidAmount)) errors.push('ยอดหักล่วงหน้าจริงต้องไม่ติดลบ')
  if (errors.length) return { ready: false, errors, warnings: [] }

  let fullMonths = 0
  while (monthAnniversary(start, fullMonths + 1) <= transfer) fullMonths += 1
  const periodStart = monthAnniversary(start, fullMonths)
  const periodEnd = monthAnniversary(start, fullMonths + 1)
  const elapsedDays = (transfer - periodStart) / 86400000
  const periodDays = (periodEnd - periodStart) / 86400000
  const elapsedMonths = fullMonths + elapsedDays / periodDays
  const monthlyAmount = round(amount(input.principal) * amount(input.annualRate) / 100 / 12)
  const accrued = round(amount(input.principal) * amount(input.annualRate) / 100 / 12 * elapsedMonths)
  const advanceCredit = input.advancePaidAmount === '' || input.advancePaidAmount == null
    ? round(monthlyAmount * amount(input.advanceMonths))
    : round(amount(input.advancePaidAmount))
  const otherPaid = round(amount(input.otherPaid))
  const remainingReturn = round(accrued - advanceCredit - otherPaid)
  if (remainingReturn < 0) return { ready: false, errors: ['ยอดที่รับแล้วสูงกว่าผลตอบแทนถึงวันย้ายทุน ต้องตรวจสัญญาและวิธีนำเงินส่วนเกินไปหักเงินต้น'], warnings: [] }
  const warnings = ['ยอดนี้เป็นประมาณการตามรายเดือน ไม่ใช่สินไถ่ตามสัญญาที่รับรองแล้ว และไม่รวมค่าเสียโอกาสที่ตกลงอย่างถูกต้อง']
  if (amount(input.annualRate) > 15) warnings.push('อัตราเกิน 15% ต่อปี ต้องตรวจข้อจำกัดกฎหมายขายฝากก่อนใช้ยอดนี้')
  return { ready: true, errors: [], warnings, fullMonths, elapsedDays, periodDays, elapsedMonths: round(elapsedMonths), monthlyAmount, accrued, advanceCredit, otherPaid, remainingReturn, payoff: round(amount(input.principal) + remainingReturn) }
}

export function calculateRefinanceFunding(input = {}) {
  const errors = []
  const required = [
    ['oldPayoff', 'ยอดสินไถ่ที่ทุนเดิมยืนยัน'],
    ['assessedValue', 'ราคาประเมินรวม'],
    ['oldRegisteredValue', 'ทุนทรัพย์ที่แจ้งไถ่'],
    ['oldWithholding', 'ภาษีหัก ณ ที่จ่ายตอนไถ่ที่ต้องนำมารวม'],
    ['newWithholding', 'ภาษีหัก ณ ที่จ่ายตอนขายฝากใหม่ที่ต้องนำมารวม'],
  ]
  for (const [key, label] of required) {
    if (!validAmount(input[key])) errors.push(`ระบุ${label} (ใส่ 0 หากตรวจแล้วว่าไม่ต้องนำมารวม)`)
  }
  if (input.taxMode !== 'sbt' && input.taxMode !== 'stamp') errors.push('ยืนยันว่าขายฝากใหม่เสียภาษีธุรกิจเฉพาะหรืออากรแสตมป์')
  const optional = ['deedCount', 'upfrontRate', 'newAnnualRate', 'newAdvanceMonths', 'fixedDeduction', 'otherCosts', 'customerCash']
  for (const key of optional) {
    if (input[key] !== '' && input[key] !== undefined && !validAmount(input[key])) errors.push('จำนวนเงินและอัตราต้องไม่ติดลบ')
  }
  const deeds = amount(input.deedCount ?? 1)
  if (!Number.isInteger(deeds) || deeds < 1) errors.push('จำนวนแปลงต้องเป็นจำนวนเต็มอย่างน้อย 1')
  const newAdvanceMonths = amount(input.newAdvanceMonths || 0)
  if (!Number.isInteger(newAdvanceMonths) || newAdvanceMonths < 0) errors.push('เดือนที่ทุนใหม่หักล่วงหน้าต้องเป็นจำนวนเต็มไม่ติดลบ')
  if (newAdvanceMonths > 0 && !validAmount(input.newAnnualRate)) errors.push('ระบุอัตราผลตอบแทนทุนใหม่เมื่อหักล่วงหน้า')
  const advanceRate = amount(input.newAnnualRate || 0) / 12 * newAdvanceMonths
  const upfrontRate = amount(input.upfrontRate || 0)
  if (advanceRate + upfrontRate >= 95) errors.push('เงินหักรวมจากทุนใหม่ต้องต่ำกว่า 95%')
  if (amount(input.oldPayoff) <= 0 || amount(input.assessedValue) <= 0 || amount(input.oldRegisteredValue) <= 0) errors.push('ยอดสินไถ่ ราคาประเมิน และทุนทรัพย์ที่แจ้งไถ่ต้องมากกว่า 0')
  if (errors.length) return { errors, warnings: [], ready: false }

  const oldFee = 50 * deeds
  const oldStamp = Math.ceil(Math.max(amount(input.assessedValue), amount(input.oldRegisteredValue)) / 200)
  const newFee = round(amount(input.assessedValue) * 0.02)
  const fixedCosts = round(amount(input.oldPayoff) + oldFee + oldStamp + newFee + amount(input.oldWithholding) + amount(input.newWithholding) + amount(input.fixedDeduction || 0) + amount(input.otherCosts || 0) + amount(input.customerCash || 0))

  const atGross = gross => {
    const base = Math.max(amount(input.assessedValue), gross)
    const newTax = input.taxMode === 'sbt' ? round(base * 0.033) : Math.ceil(base / 200)
    const newAdvanceWithheld = round(gross * advanceRate / 100)
    const otherWithheld = round(gross * upfrontRate / 100)
    const withheld = round(newAdvanceWithheld + otherWithheld)
    return { newTax, newAdvanceWithheld, otherWithheld, withheld, available: round(gross - newTax - withheld) }
  }

  let low = 0
  let high = Math.max(1, Math.ceil(fixedCosts * 2))
  while (atGross(high).available < fixedCosts && high < 1e12) high *= 2
  if (high >= 1e12) return { errors: ['วงเงินสูงเกินช่วงที่เครื่องคำนวณรองรับ'], warnings: [], ready: false }
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (atGross(middle).available >= fixedCosts) high = middle
    else low = middle
  }
  const gross = high
  const { newTax, newAdvanceWithheld, otherWithheld, withheld, available } = atGross(gross)
  const extraCosts = round(gross - amount(input.oldPayoff) - amount(input.customerCash || 0))
  const totalExpenses = round(fixedCosts - amount(input.oldPayoff) - amount(input.customerCash || 0) + newTax + withheld)
  const netCustomerCash = round(gross - amount(input.oldPayoff) - totalExpenses)
  const warnings = [
      'กรณีนี้สมมติให้ราคาขายฝากใหม่เท่ากับวงเงินทุนใหม่ และให้ทุนใหม่ครอบคลุมค่าใช้จ่ายทุกรายการที่กรอก',
      'ภาษีหัก ณ ที่จ่ายต้องคำนวณแยกจากข้อเท็จจริงและยืนยันกับสำนักงานที่ดินก่อนทำรายการ',
  ]
  if (amount(input.newAnnualRate || 0) > 15) warnings.push('อัตราผลตอบแทนทุนใหม่เกิน 15% ต่อปี ต้องตรวจข้อจำกัดกฎหมายขายฝากก่อนใช้ข้อเสนอนี้')
  return {
    errors: [], ready: true, warnings,
    oldFee, oldStamp, newFee, newTax, newAdvanceWithheld, otherWithheld, withheld, fixedCosts, gross,
    monthlyNewReturn: round(gross * amount(input.newAnnualRate || 0) / 100 / 12),
    oldPayoff: amount(input.oldPayoff), customerCash: amount(input.customerCash || 0),
    extraCosts, totalExpenses, netCustomerCash, available, surplus: round(available - fixedCosts),
  }
}

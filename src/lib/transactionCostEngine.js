export const PROPERTY_WHT_BRACKETS = [
  { max: 300000, rate: 0.05 },
  { max: 500000, rate: 0.10 },
  { max: 750000, rate: 0.15 },
  { max: 1000000, rate: 0.20 },
  { max: 2000000, rate: 0.25 },
  { max: 5000000, rate: 0.30 },
  { max: Infinity, rate: 0.35 },
]

export const STANDARD_EXPENSE_RATES = {
  1: 0.92, 2: 0.84, 3: 0.77, 4: 0.71,
  5: 0.65, 6: 0.60, 7: 0.55, 8: 0.50,
}

export const LAND_TAX_BRACKETS = {
  agriculture: [
    { max: 75000000, rate: 0.0001 }, { max: 100000000, rate: 0.0003 },
    { max: 500000000, rate: 0.0005 }, { max: 1000000000, rate: 0.0007 },
    { max: Infinity, rate: 0.001 },
  ],
  primary_land_building: [
    { max: 25000000, rate: 0.0003 }, { max: 50000000, rate: 0.0005 },
    { max: Infinity, rate: 0.001 },
  ],
  primary_building_only: [
    { max: 40000000, rate: 0.0002 }, { max: 65000000, rate: 0.0003 },
    { max: 90000000, rate: 0.0005 }, { max: Infinity, rate: 0.001 },
  ],
  residence_other: [
    { max: 50000000, rate: 0.0002 }, { max: 75000000, rate: 0.0003 },
    { max: 100000000, rate: 0.0005 }, { max: Infinity, rate: 0.001 },
  ],
  commercial: [
    { max: 50000000, rate: 0.003 }, { max: 200000000, rate: 0.004 },
    { max: 1000000000, rate: 0.005 }, { max: 5000000000, rate: 0.006 },
    { max: Infinity, rate: 0.007 },
  ],
}

export const RENTAL_EXPENSE_RATES = {
  building: 0.30,
  agricultural_land: 0.20,
  other_land: 0.15,
  other_property: 0.10,
}

const ANNUAL_PIT_BRACKETS = [
  { max: 150000, rate: 0 }, { max: 300000, rate: 0.05 },
  { max: 500000, rate: 0.10 }, { max: 750000, rate: 0.15 },
  { max: 1000000, rate: 0.20 }, { max: 2000000, rate: 0.25 },
  { max: 5000000, rate: 0.30 }, { max: Infinity, rate: 0.35 },
]

const money = value => Math.max(0, Number(String(value ?? '').replace(/,/g, '')) || 0)
const clampYears = value => Math.min(10, Math.max(1, Math.floor(Number(value) || 1)))
const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100

function progressiveTax(value, brackets, rateAdjustment = 0, rateCap = Infinity) {
  const taxable = money(value)
  let tax = 0
  let lower = 0
  for (const bracket of brackets) {
    if (taxable <= lower) break
    const rate = Math.min(bracket.rate + rateAdjustment, rateCap)
    tax += (Math.min(taxable, bracket.max) - lower) * rate
    lower = bracket.max
  }
  return round(tax)
}

export function calendarOwnershipYears(startDate, endDate = new Date().toISOString().slice(0, 10)) {
  if (!startDate || !endDate) return 1
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 1
  return clampYears(end.getFullYear() - start.getFullYear() + 1)
}

export function heldMoreThanFiveYears(startDate, endDate) {
  if (!startDate || !endDate) return null
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
  const fifthAnniversary = new Date(start)
  fifthAnniversary.setFullYear(fifthAnniversary.getFullYear() + 5)
  return end > fifthAnniversary
}

export function progressivePropertyTax(income) {
  const taxableIncome = money(income)
  let tax = 0
  let lower = 0
  for (const bracket of PROPERTY_WHT_BRACKETS) {
    if (taxableIncome <= lower) break
    tax += (Math.min(taxableIncome, bracket.max) - lower) * bracket.rate
    lower = bracket.max
  }
  return round(tax)
}

export function calculateLandBuildingTax(input = {}) {
  const assessedValue = money(input.assessedValue)
  const ownerType = input.ownerType || 'individual'
  const useType = input.useType || 'residence'
  const isPrimaryResidence = Boolean(input.isPrimaryResidence) && ownerType === 'individual'
  const residenceOwnership = input.residenceOwnership || 'land_building'

  let exemption = 0
  let bracketKey = useType
  if (useType === 'agriculture') {
    exemption = ownerType === 'individual' ? 50000000 : 0
    bracketKey = 'agriculture'
  } else if (useType === 'residence') {
    if (isPrimaryResidence && residenceOwnership === 'land_building') {
      exemption = 50000000
      bracketKey = 'primary_land_building'
    } else if (isPrimaryResidence && residenceOwnership === 'building_only') {
      exemption = 10000000
      bracketKey = 'primary_building_only'
    } else {
      bracketKey = 'residence_other'
    }
  } else {
    bracketKey = 'commercial'
  }

  const taxableValue = Math.max(0, assessedValue - exemption)
  const vacantYears = Math.max(0, Math.floor(Number(input.vacantYears) || 0))
  const vacantSurchargeRate = useType === 'vacant' ? Math.floor(vacantYears / 3) * 0.003 : 0
  const taxBeforeRelief = progressiveTax(taxableValue, LAND_TAX_BRACKETS[bracketKey], vacantSurchargeRate, 0.03)
  const reliefRate = Math.min(100, Math.max(0, Number(input.reliefRate) || 0)) / 100
  const reliefAmount = taxBeforeRelief * reliefRate
  const tax = taxBeforeRelief - reliefAmount
  const warnings = []
  if (!assessedValue) warnings.push('ต้องใช้มูลค่าประเมินที่องค์กรปกครองส่วนท้องถิ่นประกาศสำหรับปีภาษีนั้น')
  if (input.mixedUse) warnings.push('ทรัพย์ใช้ประโยชน์หลายประเภทต้องแยกมูลค่าหรือสัดส่วนพื้นที่แล้วคำนวณแต่ละส่วน')
  if (isPrimaryResidence) warnings.push('สิทธิบ้านหลังหลักต้องมีชื่อเจ้าของอยู่ในทะเบียนบ้าน ณ วันที่ 1 มกราคมของปีภาษี')
  if (reliefRate) warnings.push('มีการใช้ส่วนลดภาษีตามที่ผู้ใช้กรอก ต้องตรวจประกาศที่ใช้กับปีและพื้นที่นั้น')
  return {
    assessedValue,
    exemption: round(exemption),
    taxableValue: round(taxableValue),
    vacantSurchargeRate,
    taxBeforeRelief,
    reliefRate,
    reliefAmount: round(reliefAmount),
    tax: round(tax),
    total: round(tax),
    warnings,
  }
}

export function calculateRentalIncomeTax(input = {}) {
  const taxpayerType = input.taxpayerType || 'individual'
  const annualRent = money(input.monthlyRent) * Math.max(0, Number(input.months) || 0) + money(input.premium)
  const serviceRevenue = money(input.serviceRevenue)
  const withholdingCredit = money(input.withholdingCredit)
  const vat = input.vatRegistered ? serviceRevenue * 0.07 : 0
  const warnings = ['ค่าเช่าอสังหาริมทรัพย์ได้รับยกเว้น VAT แต่ค่าบริการที่แยกจากค่าเช่าอาจอยู่ในบังคับ VAT']
  if (!input.vatRegistered && serviceRevenue > 1800000) warnings.push('รายได้ค่าบริการเกิน 1.8 ล้านบาท ต้องตรวจหน้าที่จดทะเบียน VAT')

  if (taxpayerType === 'company') {
    const netProfit = money(input.netProfit)
    const corporateRateInput = input.corporateRate === '' || input.corporateRate == null ? 20 : Number(input.corporateRate)
    const corporateRate = Math.min(100, Math.max(0, Number.isFinite(corporateRateInput) ? corporateRateInput : 20)) / 100
    const incomeTax = netProfit * corporateRate
    warnings.push('นิติบุคคลต้องคำนวณจากกำไรสุทธิทางภาษีทั้งกิจการ ระบบใช้กำไรและอัตราที่ผู้ใช้ระบุ')
    return {
      annualRent: round(annualRent), serviceRevenue: round(serviceRevenue), serviceExpense: 0, netServiceIncome: 0, expense: 0,
      netRentalIncome: round(netProfit), taxableIncome: round(netProfit), methodOneTax: round(incomeTax),
      minimumTax: 0, incomeTax: round(incomeTax), withholdingCredit: round(withholdingCredit),
      vat: round(vat), taxDue: round(Math.max(0, incomeTax - withholdingCredit) + vat),
      total: round(Math.max(0, incomeTax - withholdingCredit) + vat), warnings,
    }
  }

  const expenseRate = RENTAL_EXPENSE_RATES[input.propertyType] ?? RENTAL_EXPENSE_RATES.building
  const expense = input.expenseMethod === 'actual' ? Math.min(annualRent, money(input.actualExpense)) : annualRent * expenseRate
  const netRentalIncome = Math.max(0, annualRent - expense)
  const serviceExpense = Math.min(serviceRevenue, money(input.serviceExpense))
  const netServiceIncome = Math.max(0, serviceRevenue - serviceExpense)
  const otherNetIncome = money(input.otherNetIncome)
  const allowances = money(input.allowances)
  const taxableIncome = Math.max(0, netRentalIncome + netServiceIncome + otherNetIncome - allowances)
  const methodOneTax = progressiveTax(taxableIncome, ANNUAL_PIT_BRACKETS)
  const assessableNonSalary = annualRent + serviceRevenue + money(input.otherAssessableNonSalary)
  const rawMinimumTax = assessableNonSalary >= 120000 ? assessableNonSalary * 0.005 : 0
  const minimumTax = rawMinimumTax > 5000 ? rawMinimumTax : 0
  const incomeTax = Math.max(methodOneTax, minimumTax)
  if (input.expenseMethod === 'actual') warnings.push('ค่าใช้จ่ายตามจริงต้องเกี่ยวข้องกับรายได้และมีหลักฐานพร้อมตรวจสอบ')
  if (otherNetIncome || input.otherAssessableNonSalary) warnings.push('ต้องรวมรายได้และเครดิตภาษีทุกประเภทของผู้เสียภาษีก่อนยื่นแบบจริง')
  return {
    annualRent: round(annualRent), serviceRevenue: round(serviceRevenue), serviceExpense: round(serviceExpense), netServiceIncome: round(netServiceIncome), expenseRate,
    expense: round(expense), netRentalIncome: round(netRentalIncome), taxableIncome: round(taxableIncome),
    methodOneTax, minimumTax: round(minimumTax), incomeTax: round(incomeTax),
    withholdingCredit: round(withholdingCredit), vat: round(vat),
    taxDue: round(Math.max(0, incomeTax - withholdingCredit) + vat),
    total: round(Math.max(0, incomeTax - withholdingCredit) + vat), warnings,
  }
}

export function calculateIndividualWht({ assessedValue, ownershipYears, acquisitionType = 'other', outsideLocalAuthority = false }) {
  const assessed = money(assessedValue)
  const years = clampYears(ownershipYears)
  const inheritedOrGifted = acquisitionType === 'inheritance' || acquisitionType === 'gift'
  const expenseRate = inheritedOrGifted ? 0.50 : STANDARD_EXPENSE_RATES[Math.min(years, 8)]
  const locationExemption = inheritedOrGifted && outsideLocalAuthority ? Math.min(assessed, 200000 * years) : 0
  const incomeAfterLocationExemption = Math.max(0, assessed - locationExemption)
  const netIncome = incomeAfterLocationExemption * (1 - expenseRate)
  const annualIncome = netIncome / years
  const annualTax = progressivePropertyTax(annualIncome)
  const uncappedTax = annualTax * years
  const cap = assessed * 0.20
  return {
    assessed,
    years,
    expenseRate,
    locationExemption: round(locationExemption),
    netIncome: round(netIncome),
    annualIncome: round(annualIncome),
    annualTax: round(annualTax),
    cap: round(cap),
    tax: round(Math.min(uncappedTax, cap)),
    capped: uncappedTax > cap,
  }
}

function automaticSbtDecision(input) {
  if (input.transactionType === 'redemption') return { taxable: false, reason: 'ไถ่ถอนจากขายฝากได้รับยกเว้นภาษีธุรกิจเฉพาะ' }
  if (input.sellerType === 'company') return { taxable: true, reason: 'ผู้โอนเป็นนิติบุคคล' }
  if (input.acquisitionType === 'inheritance') return { taxable: false, reason: 'ทรัพย์ได้มาโดยมรดก' }
  if (input.giftToLegitimateChild) return { taxable: false, reason: 'ให้โดยไม่มีค่าตอบแทนแก่บุตรชอบด้วยกฎหมาย' }
  if (input.isResidence && Number(input.houseRegistrationMonths) >= 12) return { taxable: false, reason: 'เป็นบ้านหรืออาคารอยู่อาศัยและมีชื่อในทะเบียนบ้านรวมไม่น้อยกว่า 1 ปี' }
  const heldOverFiveYears = heldMoreThanFiveYears(input.acquisitionDate, input.registrationDate)
  if (heldOverFiveYears === true) return { taxable: false, reason: 'ถือครองเกิน 5 ปีตามวันที่ได้มาและวันที่จดทะเบียน' }
  if (heldOverFiveYears === null && Number(input.ownershipYears) > 5) return { taxable: false, reason: 'ถือครองเกิน 5 ปีตามข้อมูลที่ผู้ใช้ระบุ (ต้องยืนยันวันที่จริง)' }
  return { taxable: true, reason: 'อยู่ในเกณฑ์ขายอสังหาริมทรัพย์เป็นทางค้าหรือหากำไร' }
}

export function calculateTransfer(input = {}) {
  const contractPrice = money(input.contractPrice)
  const assessedValue = money(input.assessedValue)
  const mortgageDebt = money(input.mortgageDebt)
  const declaredRevenue = contractPrice + mortgageDebt
  const taxBase = Math.max(declaredRevenue, assessedValue)
  const feeRate = money(input.transferFeeRate || 2) / 100
  const deedCount = Math.max(1, Math.floor(Number(input.deedCount) || 1))
  const transferFee = input.transactionType === 'redemption' ? 50 * deedCount : assessedValue * feeRate
  const ownershipYears = clampYears(input.ownershipYears)

  let whtDetail
  let withholdingTax
  if (input.sellerType === 'company' && input.transactionType === 'redemption') {
    withholdingTax = 0
    whtDetail = { tax: 0, basis: taxBase, companyRate: 0 }
  } else if (input.sellerType === 'company') {
    withholdingTax = taxBase * 0.01
    whtDetail = { tax: round(withholdingTax), basis: taxBase, companyRate: 0.01 }
  } else {
    whtDetail = calculateIndividualWht({
      assessedValue,
      ownershipYears,
      acquisitionType: input.acquisitionType,
      outsideLocalAuthority: input.outsideLocalAuthority,
    })
    withholdingTax = whtDetail.tax
  }

  let sbtDecision = automaticSbtDecision({ ...input, ownershipYears })
  if (input.transactionType !== 'redemption' && input.sbtMode === 'taxable') sbtDecision = { taxable: true, reason: 'ผู้ใช้กำหนดให้เสีย SBT หลังตรวจข้อเท็จจริง' }
  if (input.transactionType !== 'redemption' && input.sbtMode === 'exempt') sbtDecision = { taxable: false, reason: 'ผู้ใช้ยืนยันสิทธิยกเว้น SBT หลังตรวจข้อเท็จจริง' }
  const specificBusinessTax = sbtDecision.taxable ? taxBase * 0.033 : 0
  const stampDuty = sbtDecision.taxable ? 0 : Math.ceil(taxBase / 200)
  const otherFees = money(input.otherFees)
  const total = transferFee + withholdingTax + specificBusinessTax + stampDuty + otherFees

  const warnings = []
  if (!assessedValue) warnings.push('ต้องระบุราคาประเมินทุนทรัพย์ ณ วันที่จดทะเบียน')
  if (!contractPrice && input.transactionType !== 'gift') warnings.push('ต้องระบุราคาตามสัญญาหรือสินไถ่')
  if (input.transactionType !== 'redemption' && input.sbtMode !== 'auto') warnings.push('มีการ override สถานะ SBT ต้องแนบหลักฐานและเหตุผลผู้ตรวจ')
  if (input.transactionType === 'redemption') warnings.push('ค่าไถ่ถอนและฐานอากรต้องให้สำนักงานที่ดินยืนยันจากสัญญาจริง')
  if (input.transactionType === 'exchange') warnings.push('การแลกเปลี่ยนต้องคำนวณแยกสำหรับผู้โอนแต่ละฝ่ายตามราคาประเมินของทรัพย์ที่ตนโอน')
  if (input.coOwnership) warnings.push('กรณีกรรมสิทธิ์รวมต้องแยกสัดส่วนและเงื่อนไขภาษีของผู้โอนแต่ละราย')
  if (input.sellerType !== 'company' && !input.acquisitionDate && Number(input.ownershipYears) > 5) warnings.push('สิทธิยกเว้น SBT จากการถือครองใช้จำนวนปีที่กรอกแทนวันที่จริง ต้องตรวจวันได้มาและวันจดทะเบียน')
  if (Number(input.houseRegistrationMonths) >= 12 && !input.isResidence) warnings.push('สิทธิทะเบียนบ้านใช้กับบ้านหรืออาคารที่เป็นที่อยู่อาศัย ไม่ใช้กับที่ดินเปล่า')

  return {
    transactionType: input.transactionType || 'sale',
    contractPrice,
    assessedValue,
    mortgageDebt,
    deedCount,
    taxBase: round(taxBase),
    transferFee: round(transferFee),
    withholdingTax: round(withholdingTax),
    whtDetail,
    specificBusinessTax: round(specificBusinessTax),
    stampDuty: round(stampDuty),
    otherFees: round(otherFees),
    total: round(total),
    sbtTaxable: sbtDecision.taxable,
    sbtReason: sbtDecision.reason,
    warnings,
    bases: {
      transferFee: 'ราคาประเมินทุนทรัพย์',
      withholdingTax: input.sellerType === 'company' && input.transactionType === 'redemption' ? 'ยกเว้นสำหรับนิติบุคคลผู้รับซื้อฝาก' : input.sellerType === 'company' ? 'ราคาสูงกว่าระหว่างรายรับกับราคาประเมิน' : 'ราคาประเมินทุนทรัพย์',
      sbtOrStamp: 'ราคาสูงกว่าระหว่างรายรับรวมภาระจำนองกับราคาประเมิน',
    },
  }
}

export function calculateMortgage({ mortgageAmount, loanAmount, deedCount = 1, otherFees = 0, discharge = false } = {}) {
  const mortgage = money(mortgageAmount)
  const loan = money(loanAmount) || mortgage
  const deeds = Math.max(1, Math.floor(Number(deedCount) || 1))
  if (discharge) {
    const registrationFee = 50 * deeds
    return { registrationFee, stampDuty: 0, otherFees: money(otherFees), total: registrationFee + money(otherFees), warnings: [] }
  }
  const registrationFee = Math.min(mortgage * 0.01, 200000)
  const stampDuty = Math.min(Math.ceil(loan / 2000), 10000)
  return {
    registrationFee: round(registrationFee),
    stampDuty: round(stampDuty),
    otherFees: round(money(otherFees)),
    total: round(registrationFee + stampDuty + money(otherFees)),
    warnings: mortgage ? [] : ['ต้องระบุวงเงินจำนอง'],
  }
}

export function calculateLease({ monthlyRent, months, premium = 0, payerType = 'individual', ownerType = 'individual', otherFees = 0 } = {}) {
  const rent = money(monthlyRent)
  const termMonths = Math.max(1, Math.floor(Number(months) || 1))
  const totalConsideration = rent * termMonths + money(premium)
  const registrationFee = totalConsideration * 0.01
  const stampDuty = Math.ceil(totalConsideration / 1000)
  const withholdingTax = payerType === 'company' ? totalConsideration * 0.05 : 0
  const warnings = []
  if (termMonths > 36) warnings.push('สัญญาเช่าเกิน 3 ปีต้องจดทะเบียนจึงมีผลเกิน 3 ปี')
  if (ownerType === 'company') warnings.push('ตรวจ VAT และภาษีนิติบุคคลเพิ่มเติมตามลักษณะกิจการ')
  return {
    totalConsideration: round(totalConsideration),
    registrationFee: round(registrationFee),
    stampDuty: round(stampDuty),
    withholdingTax: round(withholdingTax),
    otherFees: round(money(otherFees)),
    total: round(registrationFee + stampDuty + withholdingTax + money(otherFees)),
    warnings,
  }
}

export function calculateGiftInheritance({ mode = 'inheritance', assessedValue, relationship = 'lineal', otherFees = 0 } = {}) {
  const assessed = money(assessedValue)
  const preferredRelationship = relationship === 'lineal' || relationship === 'spouse'
  const transferFeeRate = preferredRelationship ? 0.005 : 0.02
  const transferFee = assessed * transferFeeRate
  let inheritanceOrGiftTax = 0
  if (mode === 'inheritance') {
    if (relationship === 'lineal') inheritanceOrGiftTax = Math.max(0, assessed - 100000000) * 0.05
    if (relationship === 'other') inheritanceOrGiftTax = Math.max(0, assessed - 100000000) * 0.10
  } else {
    const allowance = relationship === 'other' ? 10000000 : 20000000
    inheritanceOrGiftTax = Math.max(0, assessed - allowance) * 0.05
  }
  const warnings = [
    'ภาษีมรดก/การรับให้ต้องรวมมูลค่าที่ได้รับตลอดปีและทรัพย์ประเภทอื่นของผู้รับก่อนสรุปยอดจริง',
    'ตรวจความสัมพันธ์ตามกฎหมายและฐานะบุตรชอบด้วยกฎหมายจากเอกสารจริง',
  ]
  return {
    assessedValue: assessed,
    transferFeeRate,
    transferFee: round(transferFee),
    inheritanceOrGiftTax: round(inheritanceOrGiftTax),
    otherFees: round(money(otherFees)),
    total: round(transferFee + inheritanceOrGiftTax + money(otherFees)),
    warnings,
  }
}

export function calculatePropertyRight({ consideration, hasConsideration = true, deedCount = 1, otherFees = 0 } = {}) {
  const amount = money(consideration)
  const deeds = Math.max(1, Math.floor(Number(deedCount) || 1))
  const registrationFee = hasConsideration ? amount * 0.01 : 50 * deeds
  const stampDuty = hasConsideration ? amount * 0.005 : 0
  return {
    registrationFee: round(registrationFee),
    stampDuty: round(stampDuty),
    otherFees: round(money(otherFees)),
    total: round(registrationFee + stampDuty + money(otherFees)),
    warnings: ['ประเภททรัพยสิทธิและฐานค่าตอบแทนต้องให้สำนักงานที่ดินยืนยันก่อนจดทะเบียน'],
  }
}

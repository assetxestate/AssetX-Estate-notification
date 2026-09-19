import assert from 'node:assert/strict'
import {
  calendarOwnershipYears,
  calculateGiftInheritance,
  calculateIndividualWht,
  calculateLandBuildingTax,
  calculateMortgage,
  calculateRentalIncomeTax,
  calculateTransfer,
  heldMoreThanFiveYears,
  progressivePropertyTax,
} from './transactionCostEngine.js'

assert.equal(calendarOwnershipYears('2024-12-31', '2025-01-01'), 2)
assert.equal(calendarOwnershipYears('2010-01-01', '2026-01-01'), 10)
assert.equal(heldMoreThanFiveYears('2020-01-01', '2025-01-01'), false)
assert.equal(heldMoreThanFiveYears('2020-01-01', '2025-01-02'), true)
assert.equal(progressivePropertyTax(300000), 15000)
assert.equal(progressivePropertyTax(500000), 35000)

const inherited = calculateIndividualWht({ assessedValue: 9950000, ownershipYears: 10, acquisitionType: 'inheritance' })
assert.equal(inherited.expenseRate, 0.5)
assert.equal(inherited.tax, 347500)

const purchased = calculateIndividualWht({ assessedValue: 1000000, ownershipYears: 1, acquisitionType: 'other' })
assert.equal(purchased.expenseRate, 0.92)
assert.equal(purchased.tax, 4000)

const exemptSale = calculateTransfer({ transactionType: 'sale', sellerType: 'individual', acquisitionType: 'other', assessedValue: 2000000, contractPrice: 2500000, ownershipYears: 6 })
assert.equal(exemptSale.sbtTaxable, false)
assert.equal(exemptSale.stampDuty, 12500)

const residenceSale = calculateTransfer({ transactionType: 'sale', sellerType: 'individual', acquisitionType: 'other', assessedValue: 2000000, contractPrice: 2500000, acquisitionDate: '2025-01-01', registrationDate: '2026-09-18', isResidence: true, houseRegistrationMonths: 12 })
assert.equal(residenceSale.sbtTaxable, false)

const vacantLandSale = calculateTransfer({ transactionType: 'sale', sellerType: 'individual', acquisitionType: 'other', assessedValue: 2000000, contractPrice: 2500000, acquisitionDate: '2025-01-01', registrationDate: '2026-09-18', houseRegistrationMonths: 12 })
assert.equal(vacantLandSale.sbtTaxable, true)

const companySale = calculateTransfer({ transactionType: 'sale', sellerType: 'company', assessedValue: 2000000, contractPrice: 2500000, ownershipYears: 1 })
assert.equal(companySale.withholdingTax, 25000)
assert.equal(companySale.specificBusinessTax, 82500)

const companyRedemption = calculateTransfer({ transactionType: 'redemption', sellerType: 'company', assessedValue: 2000000, contractPrice: 2500000, deedCount: 2 })
assert.equal(companyRedemption.transferFee, 100)
assert.equal(companyRedemption.withholdingTax, 0)
assert.equal(companyRedemption.specificBusinessTax, 0)

assert.equal(calculateMortgage({ mortgageAmount: 30000000 }).registrationFee, 200000)
assert.equal(calculateMortgage({ mortgageAmount: 30000000 }).stampDuty, 10000)
assert.equal(calculateGiftInheritance({ mode: 'inheritance', assessedValue: 120000000, relationship: 'lineal' }).inheritanceOrGiftTax, 1000000)
assert.equal(calculateGiftInheritance({ mode: 'gift', assessedValue: 25000000, relationship: 'spouse' }).inheritanceOrGiftTax, 250000)

const agriculturalTax = calculateLandBuildingTax({ assessedValue: 60000000, ownerType: 'individual', useType: 'agriculture' })
assert.equal(agriculturalTax.exemption, 50000000)
assert.equal(agriculturalTax.tax, 1000)

const primaryResidenceTax = calculateLandBuildingTax({ assessedValue: 60000000, ownerType: 'individual', useType: 'residence', isPrimaryResidence: true, residenceOwnership: 'land_building' })
assert.equal(primaryResidenceTax.tax, 3000)

const commercialTax = calculateLandBuildingTax({ assessedValue: 100000000, ownerType: 'company', useType: 'commercial' })
assert.equal(commercialTax.tax, 350000)

const vacantTax = calculateLandBuildingTax({ assessedValue: 100000000, useType: 'vacant', vacantYears: 3 })
assert.equal(vacantTax.tax, 650000)

const rentalTax = calculateRentalIncomeTax({ taxpayerType: 'individual', propertyType: 'building', monthlyRent: 30000, months: 12, allowances: 60000 })
assert.equal(rentalTax.expense, 108000)
assert.equal(rentalTax.incomeTax, 2100)

const rentalWithService = calculateRentalIncomeTax({ taxpayerType: 'individual', propertyType: 'building', monthlyRent: 100000, months: 12, allowances: 60000, serviceRevenue: 100000, vatRegistered: true })
assert.equal(rentalWithService.minimumTax, 6500)
assert.equal(rentalWithService.vat, 7000)

console.log('transactionCostEngine: all tests passed')

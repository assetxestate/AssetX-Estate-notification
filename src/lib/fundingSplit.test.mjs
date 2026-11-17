import test from 'node:test'
import assert from 'node:assert/strict'
import { splitInterestByFunding, fundingOf, FUNDING_COMPANY, FUNDING_INVESTOR } from './fundingSplit.js'
import { ADVANCE_DEDUCTION_SLIP_ID } from './advanceDeduction.js'

const customers = [
  { id: 1, incomeType: 'company', principal: 3500000, amount: 280000, freq: 'ปีละครั้ง' },
  { id: 2, incomeType: 'company', principal: 1500000, amount: 120000, freq: 'ปีละครั้ง' },
  { id: 3, incomeType: 'commission', principal: 1000000, amount: 20000, freq: 'รายเดือน' },
  { id: 4, incomeType: 'interest', principal: 500000, amount: 10000, freq: 'รายเดือน' }, // รับดอกเบี้ยแทน (ไม่มี Advance) = เงินนายทุน
  { id: 5, incomeType: 'commission', principal: 900000, amount: 18000, freq: 'รายเดือน', isClosed: true },
  { id: 6, incomeType: 'company', principal: 700000, amount: 5000, freq: 'รายเดือน', isHiddenDraft: true },
]

test('เฉพาะประเภท company เป็นสัญญาของบริษัท ที่เหลือเป็นของนายทุน', () => {
  assert.equal(fundingOf({ incomeType: 'company' }), FUNDING_COMPANY)
  assert.equal(fundingOf({ incomeType: 'interest' }), FUNDING_INVESTOR)
  assert.equal(fundingOf({ incomeType: 'commission' }), FUNDING_INVESTOR)
  assert.equal(fundingOf({}), FUNDING_INVESTOR)
})

test('ยอดต่อเดือนและวงเงินนับเฉพาะสัญญาที่ยังมีผล แยกตามเจ้าของเงินทุน', () => {
  const g = splitInterestByFunding({ customers })
  assert.equal(g.company.activeCount, 2)
  assert.equal(g.company.principal, 5000000)
  assert.equal(Math.round(g.company.monthly), Math.round(400000 / 12))
  assert.equal(g.investor.activeCount, 2)
  assert.equal(g.investor.principal, 1500000)
  assert.equal(g.investor.monthly, 30000)
})

test('เงินที่รับแล้วนับสลิปและชำระเพิ่ม ไม่นับหักล่วงหน้า วงเงินเพิ่ม การยกเว้น และรายการที่ยกเลิก', () => {
  const paymentRecords = {
    2: { 1: { amountPaid: 120000 } },
    3: { 1: { amountPaid: 20000 }, 2: { amountPaid: 15000 }, 3: { amountPaid: 0 }, 4: { amountPaid: 20000, slipId: ADVANCE_DEDUCTION_SLIP_ID } },
    5: { 1: { amountPaid: 18000 } }, // สัญญาที่ปิดแล้วยังนับเงินที่เคยรับ
    99: { 1: { amountPaid: 7000 } }, // ไม่พบลูกค้า = ฝั่งนายทุน
  }
  const paymentAdditions = [
    { customerId: 3, installment: 2, amount: 5000 },
    { customerId: 3, installment: 2, amount: 900, voidedAt: '2026-11-01' },
    { customerId: 3, installment: 2, amount: 800, kind: 'waiver' },
    { customerId: 1, installment: 1, amount: 700, topupId: 'T1' },
  ]
  const g = splitInterestByFunding({ customers, paymentRecords, paymentAdditions })
  assert.equal(g.company.collected, 120000)
  assert.equal(g.company.collectedCount, 1)
  assert.equal(g.investor.collected, 20000 + 15000 + 18000 + 7000 + 5000)
  assert.equal(g.investor.collectedCount, 4)
})

test('ยอดหักล่วงหน้าแยกตามสัญญา และผลรวมสองฝั่งเท่ากับยอดรวมทั้งหมด', () => {
  const upfrontCases = [{ id: 1, total: 70000 }, { id: 2, total: 30000 }, { id: 3, total: 40000 }]
  const paymentRecords = { 1: { 1: { amountPaid: 280000 } }, 3: { 1: { amountPaid: 20000 } } }
  const g = splitInterestByFunding({ customers, paymentRecords, upfrontCases })
  assert.equal(g.company.upfront, 100000)
  assert.equal(g.investor.upfront, 40000)
  assert.equal(g.company.collected + g.investor.collected, 300000)
})

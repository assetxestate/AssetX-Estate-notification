import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRefinanceFormFromCustomer, estimateTopupPayoffs } from './refinanceFromCustomer.js'
import { sumReceivedAdditions } from './installmentBalance.js'

const addition = (amount, extra = {}) => ({ id: `a${amount}`, kind: 'payment', amount, paidAt: '2026-11-15', ...extra })

test('รวมเงินชำระเพิ่ม: ไม่นับการยกเว้นและรายการที่ยกเลิก', () => {
  assert.equal(sumReceivedAdditions([addition(2500), addition(100, { kind: 'waiver' }), addition(50, { voidedAt: 'x' })]), 2500)
  assert.equal(sumReceivedAdditions(undefined), 0)
})

test('ยอดรับชำระสัญญาหลักสำหรับย้ายทุน นับเงินที่มาจ่ายเพิ่มของงวดที่เคยจ่ายไม่ครบ', () => {
  const customer = {
    principal: 2000000, amount: 20000, freq: 'รายเดือน', contractEndDate: '2027-03-30',
    payments: [
      { installment: 1, dateStr: '2026-10-30', record: { amountPaid: 20000, paidDate: '2026-10-30' }, additions: [] },
      { installment: 2, dateStr: '2026-11-30', record: { amountPaid: 16000, paidDate: '2026-11-30' }, additions: [addition(4000), addition(999, { voidedAt: 'x' })] },
    ],
    topups: [],
  }
  const { form } = buildRefinanceFormFromCustomer(customer, { today: new Date('2026-12-05T12:00:00') })
  assert.equal(form.otherPaid, '40000')
})

test('ยอดปิดวงเงินเพิ่มนับบันทึกแรกและเงินที่จ่ายเพิ่ม (6,500 + 2,500 = 9,000)', () => {
  const topup = {
    topupAmount: 500000, interestAmount: 9000, freq: 'รายเดือน', topupDate: '2026-05-29', topupStartDate: '2026-09-30', topupEndDate: '2027-03-30', note: '',
    records: { 1: { amountPaid: 9000 }, 2: { amountPaid: 6500 } },
    additions: [addition(2500, { topupId: 't1', installment: 2 })],
  }
  const [result] = estimateTopupPayoffs([topup], '2026-12-01')
  assert.equal(result.paid, 18000)
})

test('ยกเว้นไปแล้วแต่ลูกค้าจ่ายครบเองทีหลัง (แก้บันทึกแรกเป็นยอดเต็ม): ไม่หักยอดยกเว้นซ้ำ', () => {
  const waiver = (amount, extra = {}) => addition(amount, { id: `w${amount}`, kind: 'waiver', ...extra })
  const customer = {
    principal: 2000000, amount: 20000, freq: 'รายเดือน', contractEndDate: '2027-03-30',
    payments: [
      { installment: 1, dateStr: '2026-10-30', record: { amountPaid: 20000, paidDate: '2026-10-30' }, additions: [] },
      { installment: 2, dateStr: '2026-11-30', record: { amountPaid: 20000, paidDate: '2026-11-30' }, additions: [waiver(4000)] },
    ],
    topups: [{
      topupAmount: 500000, interestAmount: 9000, freq: 'รายเดือน', topupDate: '2026-05-29', topupStartDate: '2026-09-30', topupEndDate: '2027-03-30', note: '',
      records: { 1: { amountPaid: 9000 }, 2: { amountPaid: 9000 } },
      additions: [waiver(2500, { topupId: 't1', installment: 2 })],
    }],
  }
  const { form, notes, topupPayoffs } = buildRefinanceFormFromCustomer(customer, { today: new Date('2026-12-05T12:00:00') })
  assert.equal(form.otherPaid, '40000')
  assert.ok(!notes.some((n) => n.includes('ยกเว้นให้ลูกค้าแล้ว')))
  assert.equal(topupPayoffs[0].waived, 0)
})

test('หน้าหลักยังโหลดรายการชำระเพิ่มไม่ได้: ยอดปิดย้ายทุนมีหมายเหตุเตือน', () => {
  const customer = {
    principal: 2000000, amount: 20000, freq: 'รายเดือน', contractEndDate: '2027-03-30', additionsVerified: false,
    payments: [{ installment: 1, dateStr: '2026-10-30', record: { amountPaid: 16000, paidDate: '2026-10-30' }, additions: [] }],
    topups: [],
  }
  const { notes } = buildRefinanceFormFromCustomer(customer, { today: new Date('2026-12-05T12:00:00') })
  assert.ok(notes[0].includes('ยังโหลดรายการชำระเพิ่มไม่ได้'))
  const ok = buildRefinanceFormFromCustomer({ ...customer, additionsVerified: true }, { today: new Date('2026-12-05T12:00:00') })
  assert.ok(!ok.notes.some((n) => n.includes('ยังโหลดรายการชำระเพิ่มไม่ได้')))
})

test('ยอดปิดย้ายทุนไม่คิดส่วนที่ยกเว้นให้ลูกค้าซ้ำ: รวมในช่องรับชำระแล้วพร้อมหมายเหตุ (สัญญาหลักและวงเงินเพิ่ม)', () => {
  const waiver = (amount, extra = {}) => addition(amount, { id: `w${amount}`, kind: 'waiver', ...extra })
  const customer = {
    principal: 2000000, amount: 20000, freq: 'รายเดือน', contractEndDate: '2027-03-30',
    payments: [
      { installment: 1, dateStr: '2026-10-30', record: { amountPaid: 20000, paidDate: '2026-10-30' }, additions: [] },
      { installment: 2, dateStr: '2026-11-30', record: { amountPaid: 16000, paidDate: '2026-11-30' }, additions: [waiver(4000), waiver(500, { voidedAt: 'x' })] },
    ],
    topups: [],
  }
  const { form, notes } = buildRefinanceFormFromCustomer(customer, { today: new Date('2026-12-05T12:00:00') })
  assert.equal(form.otherPaid, '40000')
  assert.ok(notes.some((n) => n.includes('ยกเว้นให้ลูกค้าแล้ว 4,000')))
  const topup = {
    topupAmount: 500000, interestAmount: 9000, freq: 'รายเดือน', topupDate: '2026-05-29', topupStartDate: '2026-09-30', topupEndDate: '2027-03-30', note: '',
    records: { 1: { amountPaid: 9000 }, 2: { amountPaid: 6500 } },
  }
  const [waived] = estimateTopupPayoffs([{ ...topup, additions: [waiver(2500, { topupId: 't1', installment: 2 })] }], '2026-12-01')
  const [paidCash] = estimateTopupPayoffs([{ ...topup, additions: [addition(2500, { topupId: 't1', installment: 2 })] }], '2026-12-01')
  assert.equal(waived.paid, 15500)
  assert.equal(waived.waived, 2500)
  assert.equal(waived.payoff, paidCash.payoff, 'ยกเว้นแล้วไม่ต้องเก็บ = ยอดปิดเท่ากับกรณีที่ลูกค้าจ่ายส่วนนั้นแล้ว')
})

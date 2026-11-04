import test from 'node:test'
import assert from 'node:assert/strict'
import { unpaidTopupsOnDate, paymentTotal, amountDue, sameDayGroup, groupTotal, messageTypeFor } from './combinedPayment.js'
import { msgPayment, msgTopupPayment, msgCombinedPayment, msgPaymentGroup } from './messages.js'
import { installmentBalance } from './installmentBalance.js'

const dateStr = '2026-11-15'
const customer = { name: 'ทดสอบ', type: 'จำนอง', amount: 20000 }
const topup = { id: 't1', topupAmount: 500000, interestAmount: 9000, payments: [{ installment: 2, dateStr }], records: { 2: { amountPaid: 6500 } } }
const balanceOf = (t, payment) => installmentBalance({ due: t.interestAmount, record: t.records?.[payment.installment] })

test('งวดวงเงินเพิ่มที่จ่ายไม่ครบยังนับว่าค้าง เมื่อส่งตัวคิดยอดมา (แบบเดิม: มีบันทึก = ครบ)', () => {
  const entries = unpaidTopupsOnDate([topup], dateStr, balanceOf)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].balance.outstanding, 2500)
  assert.equal(unpaidTopupsOnDate([topup], dateStr).length, 0)
  assert.equal(paymentTotal(0, entries), 2500)
  assert.equal(amountDue(9000, { state: 'unpaid' }), 9000)
  assert.equal(amountDue(9000, null), 9000)
})

test('ข้อความ LINE ของงวดที่จ่ายไม่ครบบอกยอดที่ยังขาดและยอดที่จ่ายแล้ว', () => {
  const p = { installment: 2, dateStr, diff: 0, balance: balanceOf(topup, topup.payments[0]) }
  const msg = msgTopupPayment(customer, topup, p, 'due')
  assert.match(msg, /ยอดชำระ: 2,500 บาท/)
  assert.match(msg, /ชำระแล้ว: 6,500 บาท จากยอด 9,000 บาท/)
  const full = msgTopupPayment(customer, { ...topup, records: {} }, { installment: 2, dateStr, diff: 0 }, 'due')
  assert.match(full, /ยอดชำระ: 9,000 บาท/)
  assert.doesNotMatch(full, /ชำระแล้ว:/)
})

test('ข้อความรวมสัญญาหลัก + วงเงินเพิ่ม ใช้ยอดที่ยังขาดของทั้งสองรายการ', () => {
  const main = { installment: 7, dateStr, diff: 0, balance: installmentBalance({ due: 20000, record: { amountPaid: 16000 } }) }
  const entries = unpaidTopupsOnDate([topup], dateStr, balanceOf)
  const msg = msgCombinedPayment(customer, main, entries, 'due')
  assert.match(msg, /สัญญาหลัก งวดที่ 7: 4,000 บาท \(ส่วนที่ยังขาด\)/)
  assert.match(msg, /งวดที่ 2: 2,500 บาท \(ส่วนที่ยังขาด\)/)
  assert.match(msg, /รวมยอดที่ต้องชำระ\n𝟔,𝟓𝟎𝟎 บาท/)
  const single = msgPayment(customer, main, 'early')
  assert.match(single, /ยอดชำระ: 4,000 บาท/)
  assert.match(single, /ชำระแล้ว: 16,000 บาท จากยอด 20,000 บาท/)
})

test('ข้อความเตือนล่วงหน้าของสัญญาหลักบอกจำนวนวันจริง (เดิมเขียน 7 วันเสมอ แม้เหลือ 4 วัน)', () => {
  const msg = msgPayment(customer, { installment: 8, dateStr, diff: 4 }, 'early')
  assert.match(msg, /แจ้งเตือนล่วงหน้า 4 วัน/)
  assert.match(msg, /ในอีก 4 วันข้างหน้า/)
  assert.match(msgPayment(customer, { installment: 8, dateStr }, 'early'), /แจ้งเตือนล่วงหน้า 7 วัน/)
})

const topupBalance = (t, pay) => installmentBalance({ due: t.interestAmount, record: t.records?.[pay.installment] })

test('สองงวดสัญญาหลักครบวันเดียวกัน (เลื่อนส่วนที่ขาดมาชนงวดถัดไป) + วงเงินเพิ่ม: ข้อความเดียว ยอดไม่ซ้ำ ตรงกับงานเตือนตอนเช้า', () => {
  const date = '2026-11-30'
  const payments = [
    { installment: 6, dateStr: '2026-10-30', diff: -24, status: 'paid', balance: installmentBalance({ due: 20000, record: { amountPaid: 20000 } }) },
    { installment: 8, dateStr: date, diff: 7, status: 'soon', balance: installmentBalance({ due: 20000 }) },
    { installment: 7, dateStr: date, diff: 7, status: 'soon', balance: installmentBalance({ due: 20000, record: { amountPaid: 16000 } }) },
  ]
  const topup = { id: 't1', topupAmount: 500000, interestAmount: 9000, payments: [{ installment: 3, dateStr: date }], records: {} }
  const group = sameDayGroup(payments, date, 7, [topup], topupBalance)
  assert.deepEqual(group.mains.map((p) => p.installment), [7, 8])
  assert.equal(group.extras.length, 1)
  assert.equal(groupTotal(customer.amount, group), 4000 + 20000 + 9000)
  const msg = msgPaymentGroup(customer, group, messageTypeFor(7))
  assert.match(msg, /ครบกำหนดชำระดอกจำนองงวดที่ 7, 8 ในอีก 7 วันข้างหน้า/)
  assert.match(msg, /สัญญาหลัก งวดที่ 7: 4,000 บาท \(ส่วนที่ยังขาด\)/)
  assert.match(msg, /สัญญาหลัก งวดที่ 8: 20,000 บาท/)
  assert.equal((msg.match(/วงเงินเพิ่ม 500,000 บาท งวดที่ 3/g) || []).length, 1)
  assert.match(msg, /รวมยอดที่ต้องชำระ\n𝟑𝟑,𝟎𝟎𝟎 บาท/)
})

test('มีแต่วงเงินเพิ่มสองงวดครบวันเดียวกัน: ข้อความเดียวมีครบทั้งสองงวด', () => {
  const date = '2026-12-20'
  const topup = { id: 't1', topupAmount: 500000, interestAmount: 9000, payments: [{ installment: 3, dateStr: date }, { installment: 4, dateStr: date }], records: { 3: { amountPaid: 6500 } } }
  const group = sameDayGroup([], date, 0, [topup], topupBalance)
  const msg = msgPaymentGroup(customer, group, 'due')
  assert.match(msg, /วันนี้ครบกำหนดชำระดอกเบี้ยวงเงินเพิ่ม/)
  assert.match(msg, /งวดที่ 3: 2,500 บาท \(ส่วนที่ยังขาด\)/)
  assert.match(msg, /งวดที่ 4: 9,000 บาท/)
  assert.match(msg, /รวมยอดที่ต้องชำระ\n𝟏𝟏,𝟓𝟎𝟎 บาท/)
})

test('กลุ่มที่มีรายการเดียวใช้ข้อความเดี่ยวแบบเดิม · เลยกำหนดใช้ข้อความเกินกำหนด · กลุ่มว่างไม่มีข้อความ', () => {
  const p = { installment: 5, dateStr: '2026-11-01', diff: -3, status: 'past', balance: installmentBalance({ due: 20000 }) }
  const overdue = msgPaymentGroup(customer, sameDayGroup([p], p.dateStr, -3, [], topupBalance), messageTypeFor(-3))
  assert.match(overdue, /แจ้งเตือนเกินกำหนดชำระ/)
  assert.match(overdue, /งวดที่ 5 เกินกำหนดชำระ 3 วัน/)
  const single = { ...p, diff: 2, status: 'soon' }
  assert.equal(msgPaymentGroup(customer, sameDayGroup([single], p.dateStr, 2, [], topupBalance), 'early'), msgPayment(customer, single, 'early'))
  const topup = { id: 't1', topupAmount: 500000, interestAmount: 9000, payments: [{ installment: 2, dateStr }], records: { 2: { amountPaid: 6500 } } }
  const onlyTopup = msgPaymentGroup(customer, sameDayGroup([], dateStr, 0, [topup], topupBalance), 'due')
  assert.equal(onlyTopup, msgTopupPayment(customer, topup, { installment: 2, dateStr, diff: 0, balance: topupBalance(topup, topup.payments[0]) }, 'due'))
  assert.equal(msgPaymentGroup(customer, { mains: [], extras: [], diff: 0 }, 'due'), '')
})

test('งวดที่ขาดและมีการยกเว้นบางส่วน: ข้อความบอกยอดที่ยกเว้น ตัวเลขรวมกันลงตัว', () => {
  const c = { name: 'ทดสอบ', type: 'จำนอง', amount: 9000 }
  const balance = installmentBalance({ due: 9000, record: { amountPaid: 6000 }, additions: [{ id: 'w', kind: 'waiver', amount: 2000, paidAt: '2026-11-10' }] })
  const msg = msgPayment(c, { installment: 2, dateStr, diff: 0, balance }, 'due')
  assert.match(msg, /ยอดชำระ: 1,000 บาท/)
  assert.match(msg, /ชำระแล้ว: 6,000 บาท · ยกเว้น 2,000 บาท จากยอด 9,000 บาท/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  toMonthlyAmount,
  sumTopupPrincipal,
  sumTopupMonthlyInterest,
  principalWithTopups,
  groupTopupsByCustomer,
} from './topupTotals.js'

test('toMonthlyAmount แปลงตามรอบชำระ', () => {
  assert.equal(toMonthlyAmount(12000, 'รายเดือน'), 12000)
  assert.equal(toMonthlyAmount(120000, 'ปีละครั้ง'), 10000)
  assert.equal(toMonthlyAmount(65625, 'ราย 2 สัปดาห์'), 131250)
  assert.equal(toMonthlyAmount(100, 'รายวัน'), 3000)
  assert.equal(toMonthlyAmount(undefined, ''), 0)
})

test('sumTopupPrincipal รวมเฉพาะ topupAmount และทนค่าว่าง', () => {
  assert.equal(sumTopupPrincipal([{ topupAmount: 700000 }, { topupAmount: '300000' }, {}]), 1000000)
  assert.equal(sumTopupPrincipal(undefined), 0)
})

test('sumTopupMonthlyInterest แปลงดอกเบี้ยวงเงินเพิ่มเป็นรายเดือน', () => {
  assert.equal(sumTopupMonthlyInterest([{ interestAmount: 8400, freq: 'รายเดือน' }, { interestAmount: 12000, freq: 'ปีละครั้ง' }]), 9400)
})

test('principalWithTopups = เงินต้น + วงเงินเพิ่ม', () => {
  assert.equal(principalWithTopups({ principal: 2000000, topupPrincipal: 700000 }), 2700000)
  assert.equal(principalWithTopups({ principal: 2000000 }), 2000000)
  assert.equal(principalWithTopups(null), 0)
})

test('groupTopupsByCustomer จัดกลุ่มตามรหัสลูกค้า', () => {
  const grouped = groupTopupsByCustomer([
    { customerId: 'A', topupAmount: 1 },
    { customerId: 'B', topupAmount: 2 },
    { customerId: 'A', topupAmount: 3 },
    { topupAmount: 4 },
  ])
  assert.deepEqual(Object.keys(grouped).sort(), ['A', 'B'])
  assert.equal(grouped.A.length, 2)
  assert.equal(sumTopupPrincipal(grouped.A), 4)
})

test('toMonthlyAmount รองรับรอบชำระทุกแบบที่หน้าเว็บให้เลือก', () => {
  assert.equal(toMonthlyAmount(7500, '2 ครั้ง/เดือน'), 15000)
  assert.equal(toMonthlyAmount(50000, 'ทุก 2 สัปดาห์'), 100000)
  assert.equal(toMonthlyAmount(1200, 'รายสัปดาห์'), 5200)
  assert.equal(toMonthlyAmount(120000, 'ปีละครั้ง'), 10000)
  assert.equal(toMonthlyAmount(100, 'รายวัน'), 3000)
  assert.equal(toMonthlyAmount(24000, 'รายเดือน'), 24000)
})

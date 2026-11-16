import test from 'node:test'
import assert from 'node:assert/strict'
import { interestRateOf, topupInterestRate, formatRatePct, rateText } from './interestRate.js'

// ตัวเลขทั้งหมดเป็นตัวเลขสมมติ (รีโปสาธารณะ — ห้ามใช้ยอดของลูกค้าจริง)

test('รายเดือน: 10,000 ต่อเดือน บนเงินต้น 800,000 = 1.25% ต่อเดือน · 15% ต่อปี', () => {
  assert.equal(rateText(interestRateOf(10_000, 'รายเดือน', 800_000)), '1.25% ต่อเดือน · 15% ต่อปี')
  assert.equal(rateText(interestRateOf(36_000, 'รายเดือน', 3_000_000)), '1.2% ต่อเดือน · 14.4% ต่อปี')
})

test('ปีละครั้ง: ต่อปีตรงตัว ต่อเดือนเป็นค่าเฉลี่ย (ไม่ปัดก่อนคูณ 12)', () => {
  assert.equal(rateText(interestRateOf(160_000, 'ปีละครั้ง', 2_000_000)), '0.67% ต่อเดือน · 8% ต่อปี')
  assert.equal(rateText(interestRateOf(96_000, 'รายปี', 1_200_000)), '0.67% ต่อเดือน · 8% ต่อปี')
})

test('ราย 2 สัปดาห์ ใช้กฎแปลงเดียวกับ Dashboard (×2 ต่อเดือน)', () => {
  assert.equal(rateText(interestRateOf(25_000, 'ราย 2 สัปดาห์', 4_000_000)), '1.25% ต่อเดือน · 15% ต่อปี')
})

test('ข้อมูลไม่พอคืน null และข้อความว่าง ไม่ขึ้น NaN/Infinity', () => {
  assert.equal(interestRateOf(10_000, 'รายเดือน', 0), null)
  assert.equal(interestRateOf(0, 'รายเดือน', 800_000), null)
  assert.equal(interestRateOf(undefined, undefined, undefined), null)
  assert.equal(interestRateOf('10000', 'รายเดือน', '800000').monthly, 1.25) // ค่าจากฟอร์มเป็นสตริง
  assert.equal(rateText(null), '')
})

test('formatRatePct ปัด 2 ตำแหน่งแล้วตัดศูนย์ท้าย', () => {
  assert.equal(formatRatePct(15), '15')
  assert.equal(formatRatePct(14.4), '14.4')
  assert.equal(formatRatePct(1.2), '1.2')
  assert.equal(formatRatePct(2 / 3), '0.67')
  assert.equal(formatRatePct(NaN), '')
})

test('วงเงินเพิ่ม: คิดเฉพาะส่วนที่เพิ่ม · หลายก้อนถ่วงตามยอด · บอกว่าคิดไม่เท่ากัน', () => {
  const one = topupInterestRate([{ topupAmount: 500_000, interestAmount: 6_000, freq: 'เดือน' }])
  assert.equal(rateText(one), '1.2% ต่อเดือน · 14.4% ต่อปี')
  assert.equal(one.mixed, false)

  const same = topupInterestRate([
    { topupAmount: 400_000, interestAmount: 5_000, freq: 'รายเดือน' },
    { topupAmount: 200_000, interestAmount: 2_500, freq: 'รายเดือน' },
  ])
  assert.equal(rateText(same), '1.25% ต่อเดือน · 15% ต่อปี')
  assert.equal(same.mixed, false)

  const mixed = topupInterestRate([
    { topupAmount: 600_000, interestAmount: 7_200, freq: 'รายเดือน' }, // 1.2%
    { topupAmount: 400_000, interestAmount: 6_000, freq: 'รายเดือน' }, // 1.5%
  ])
  assert.equal(rateText(mixed), '1.32% ต่อเดือน · 15.84% ต่อปี') // 13,200 ÷ 1,000,000
  assert.equal(mixed.mixed, true)

  assert.equal(topupInterestRate([]), null)
  assert.equal(topupInterestRate(undefined), null)
  assert.equal(topupInterestRate([{ topupAmount: 0, interestAmount: 100 }]), null)
})

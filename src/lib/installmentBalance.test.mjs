import test from 'node:test'
import assert from 'node:assert/strict'
import {
  installmentKey, indexAdditions, additionsFor, installmentBalance, isInstallmentSettled, receivedEntries, balanceSummary, bangkokToday, sumWaivedAdditions,
} from './installmentBalance.js'

test('วันนี้ตามเวลาไทย: 20:00 UTC ของวันที่ 14 = วันที่ 15 ที่ไทย', () => {
  assert.equal(bangkokToday(new Date('2026-11-14T20:00:00Z')), '2026-11-15')
  assert.equal(bangkokToday(new Date('2026-11-15T10:00:00Z')), '2026-11-15')
})
import { ADVANCE_DEDUCTION_SLIP_ID } from './advanceDeduction.js'

const TOPUP = 'aaaaaaaa-0000-4000-8000-000000000001'
const pay = (amount, extra = {}) => ({ customerId: 'CID1', topupId: null, installment: 7, kind: 'payment', amount, paidAt: '2026-11-15', ...extra })

test('ยังไม่มีการชำระ = unpaid และไม่มียอดค้างให้แสดง', () => {
  const b = installmentBalance({ due: 9000 })
  assert.equal(b.state, 'unpaid')
  assert.equal(b.outstanding, 0)
  assert.equal(balanceSummary(b), '')
})

test('จ่ายครบในครั้งเดียว = paid', () => {
  const b = installmentBalance({ due: 20000, record: { amountPaid: 20000, paidDate: '2026-11-04' } })
  assert.equal(b.state, 'paid')
  assert.equal(b.paid, 20000)
  assert.equal(b.paymentCount, 1)
})

test('วงเงินเพิ่มงวด 2 ต้องจ่าย 9,000 จ่ายมา 6,500 = ชำระไม่ครบ ขาด 2,500', () => {
  const b = installmentBalance({ due: 9000, record: { amountPaid: 6500, paidDate: '2026-11-04' } })
  assert.equal(b.state, 'partial')
  assert.equal(b.outstanding, 2500)
  assert.equal(isInstallmentSettled({ due: 9000, record: { amountPaid: 6500 } }), false)
  assert.equal(balanceSummary(b), 'ชำระแล้ว 6,500 / 9,000 บาท · ขาด 2,500 บาท')
})

test('จ่ายส่วนที่ขาดเพิ่มทีหลัง = ครบ และนับ 2 ครั้ง', () => {
  const b = installmentBalance({ due: 9000, record: { amountPaid: 6500 }, additions: [pay(2500, { topupId: TOPUP, installment: 2 })] })
  assert.equal(b.state, 'paid')
  assert.equal(b.paid, 9000)
  assert.equal(b.paymentCount, 2)
  assert.equal(balanceSummary(b), 'ชำระครบ 9,000 บาท · 2 ครั้ง')
})

test('รายการที่ยกเลิกแล้วไม่นับ งวดกลับเป็นค้าง', () => {
  const b = installmentBalance({ due: 9000, record: { amountPaid: 6500 }, additions: [pay(2500, { voidedAt: '2026-11-16T03:00:00Z' })] })
  assert.equal(b.state, 'partial')
  assert.equal(b.outstanding, 2500)
  assert.equal(b.paymentCount, 1)
})

test('ยกเว้นส่วนที่ขาดปิดยอดค้าง แต่ไม่นับเป็นเงินที่รับ', () => {
  const additions = [pay(2500, { kind: 'waiver' })]
  const b = installmentBalance({ due: 9000, record: { amountPaid: 6500 }, additions })
  assert.equal(b.state, 'paid')
  assert.equal(b.paid, 6500)
  assert.equal(b.waived, 2500)
  assert.deepEqual(receivedEntries({ record: { amountPaid: 6500, paidDate: '2026-11-04' }, additions }).map((e) => e.amount), [6500])
  assert.equal(balanceSummary(b), 'ชำระครบ 6,500 บาท · ยกเว้น 2,500 บาท')
})

test('จ่ายเกิน = ครบ และบอกส่วนเกิน', () => {
  const b = installmentBalance({ due: 9000, record: { amountPaid: 6500 }, additions: [pay(3000)] })
  assert.equal(b.state, 'paid')
  assert.equal(b.extra, 500)
})

test('งวดหักดอกล่วงหน้าวันทำสัญญา ถือว่าครบเสมอ (ไม่มีเงินโอน)', () => {
  const b = installmentBalance({ due: 20000, record: { amountPaid: 1000, slipId: ADVANCE_DEDUCTION_SLIP_ID } })
  assert.equal(b.state, 'paid')
  assert.deepEqual(receivedEntries({ record: { amountPaid: 1000, slipId: ADVANCE_DEDUCTION_SLIP_ID } }), [])
})

test('ไม่รู้ยอดของงวด (0 หรือว่าง) = มีบันทึกถือว่าครบแบบเดิม', () => {
  assert.equal(installmentBalance({ due: 0, record: { amountPaid: 500 } }).state, 'paid')
  assert.equal(installmentBalance({ due: undefined, record: { amountPaid: 500 } }).state, 'paid')
  assert.equal(installmentBalance({ due: null }).state, 'unpaid')
})

test('ทศนิยมคิดเป็นสตางค์ ไม่เหลือเศษลอย', () => {
  const b = installmentBalance({ due: 0.3, record: { amountPaid: 0.1 }, additions: [pay(0.2)] })
  assert.equal(b.state, 'paid')
  assert.equal(b.outstanding, 0)
  const c = installmentBalance({ due: 9000.5, record: { amountPaid: '6500.25' } })
  assert.equal(c.state, 'partial')
  assert.equal(c.outstanding, 2500.25)
})

test('จัดกลุ่มตามงวด แยกสัญญาหลักกับวงเงินเพิ่ม และเรียงตามวันที่ชำระ', () => {
  const index = indexAdditions([
    pay(100, { paidAt: '2026-11-20', createdAt: '2026-11-20T01:00:00Z' }),
    pay(200, { paidAt: '2026-11-15', createdAt: '2026-11-15T01:00:00Z' }),
    pay(300, { topupId: TOPUP }),
    null,
    { customerId: '', installment: 7, amount: 1 },
  ])
  assert.deepEqual(additionsFor(index, 'CID1', null, 7).map((a) => a.amount), [200, 100])
  assert.deepEqual(additionsFor(index, 'CID1', TOPUP, 7).map((a) => a.amount), [300])
  assert.deepEqual(additionsFor(index, 'CID1', null, 8), [])
  assert.equal(installmentKey('CID1', null, '7'), installmentKey('CID1', '', 7))
})

test('เงินรับตามวันที่จ่ายจริง: ส่วนที่ขาดไปอยู่ในวันที่จ่ายเพิ่ม', () => {
  const entries = receivedEntries({
    record: { amountPaid: 6500, paidDate: '2026-11-04' },
    additions: [pay(2500, { paidAt: '2026-12-01', id: 'a1' }), pay(50, { voidedAt: 'x' })],
  })
  assert.deepEqual(entries.map((e) => [e.paidAt, e.amount]), [['2026-11-04', 6500], ['2026-12-01', 2500]])
})

test('เกินยอดนับเฉพาะเงินที่รับจริง ไม่นับยอดที่ยกเว้น', () => {
  // ยกเว้นส่วนที่ขาดไปแล้ว ต่อมาแก้บันทึกแรกเป็นยอดเต็ม → ครบ แต่ไม่มีใครจ่ายเกิน
  const b = installmentBalance({ due: 9000, record: { amountPaid: 9000 }, additions: [{ id: 'w', kind: 'waiver', amount: 2500, paidAt: '2026-11-10' }] })
  assert.equal(b.state, 'paid')
  assert.equal(b.waived, 2500)
  assert.equal(b.extra, 0)
  assert.equal(installmentBalance({ due: 9000, record: { amountPaid: 9500 } }).extra, 500)
})

test('ยังโหลดรายการชำระเพิ่มไม่ได้: งวดที่ดูเหมือนขาดถือว่าจบไว้ก่อน (ไม่ทวง ไม่นับค้าง) และติดป้ายว่ายังตรวจไม่ได้', () => {
  const b = installmentBalance({ due: 9000, record: { amountPaid: 6500 }, additionsKnown: false })
  assert.equal(b.state, 'paid')
  assert.equal(b.unverified, true)
  assert.equal(b.outstanding, 0)
  assert.equal(installmentBalance({ due: 9000, record: { amountPaid: 9000 }, additionsKnown: false }).unverified, false)
  assert.equal(installmentBalance({ due: 9000, additionsKnown: false }).state, 'unpaid')
  assert.equal(installmentBalance({ due: 9000, record: { amountPaid: 6500 } }).unverified, false)
})

test('รวมยอดที่ยกเว้น ไม่นับรายการที่ยกเลิกและเงินที่รับจริง · สรุปงวดที่ขาดบอกยอดที่ยกเว้น', () => {
  assert.equal(sumWaivedAdditions([{ kind: 'waiver', amount: 100.5 }, { kind: 'waiver', amount: 50, voidedAt: 'x' }, { kind: 'payment', amount: 999 }]), 100.5)
  assert.equal(sumWaivedAdditions(undefined), 0)
  const b = installmentBalance({ due: 9000, record: { amountPaid: 6000 }, additions: [{ id: 'w', kind: 'waiver', amount: 2000, paidAt: '2026-11-10' }] })
  assert.match(balanceSummary(b), /ชำระแล้ว 6,000 · ยกเว้น 2,000 \/ 9,000 บาท · ขาด 1,000 บาท/)
})

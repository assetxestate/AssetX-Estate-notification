import test from 'node:test'
import assert from 'node:assert/strict'
import { planPaymentReminders, listShortInstallments, diffDays } from './paymentReminderPlan.js'
import { additionFromRow } from './installmentBalance.js'

const TOPUP = 'aaaaaaaa-0000-4000-8000-000000000001'
const day = (s) => { const d = new Date(`${s}T09:00:00`); d.setHours(0, 0, 0, 0); return d }
// ตัวอย่างสมมติ: สัญญาหลักงวด 7 จ่ายครบแล้ว · วงเงินเพิ่มงวด 2 จ่าย 6,500 จาก 9,000 แล้วเลื่อนนัดส่วนที่ขาดไปวันเดียวกับสัญญาหลักงวด 8
const base = {
  customers: [{ id: 'CID1', amount: 20000 }, { id: 'CLOSED', amount: 5000 }],
  payments: [
    { customer_id: 'CID1', installment: 7, date_str: '2026-11-06' },
    { customer_id: 'CID1', installment: 8, date_str: '2026-11-15' },
    { customer_id: 'CLOSED', installment: 1, date_str: '2026-11-15' },
  ],
  paymentRecords: [{ customer_id: 'CID1', installment: 7, amount_paid: 20000, slip_id: '' }],
  topups: [{ id: TOPUP, customer_id: 'CID1', topup_amount: 500000, interest_amount: 9000, payments: [{ installment: 2, dateStr: '2026-11-15', postponedFrom: '2026-11-06' }, { installment: 3, dateStr: '2026-11-30' }] }],
  topupRecords: [{ topup_id: TOPUP, installment: 2, amount_paid: 6500, slip_id: '' }],
  closedIds: new Set(['CLOSED']),
}

test('เตือนล่วงหน้า 7 วัน: งวดที่จ่ายไม่ครบยังเตือนด้วยยอดที่ยังขาด รวมกับงวดสัญญาหลักวันเดียวกัน', () => {
  const { groups } = planPaymentReminders({ ...base, today: day('2026-11-08') })
  assert.equal(groups.length, 1)
  const [g] = groups
  assert.equal(g.dateStr, '2026-11-15')
  assert.equal(g.diff, 7)
  assert.equal(g.mains.length, 1)
  assert.equal(g.mains[0].installment, 8)
  assert.equal(g.mains[0].balance.state, 'unpaid')
  assert.equal(g.extras.length, 1)
  assert.equal(g.extras[0].installment, 2)
  assert.equal(g.extras[0].balance.state, 'partial')
  assert.equal(g.extras[0].balance.outstanding, 2500)
})

test('วันนัด: ส่งในวันนั้น (diff 0) · งวดที่จ่ายครบแล้วไม่ถูกเตือน', () => {
  const { groups } = planPaymentReminders({ ...base, today: day('2026-11-15') })
  assert.equal(groups.length, 1)
  assert.equal(groups[0].diff, 0)
  assert.ok(!groups.some((g) => g.mains.some((m) => m.installment === 7)))
})

test('จ่ายส่วนที่ขาดแล้ว = ไม่เตือนวงเงินเพิ่มงวดนั้นอีก · รายการที่ยกเลิกแล้วกลับมาเตือน', () => {
  const paid = [{ customerId: 'CID1', topupId: TOPUP, installment: 2, kind: 'payment', amount: 2500, paidAt: '2026-11-10' }]
  const after = planPaymentReminders({ ...base, additions: paid, today: day('2026-11-15') })
  assert.equal(after.groups[0].extras.length, 0)
  const voided = planPaymentReminders({ ...base, additions: [{ ...paid[0], voidedAt: '2026-11-11T00:00:00Z' }], today: day('2026-11-15') })
  assert.equal(voided.groups[0].extras[0].balance.outstanding, 2500)
})

test('ยกเว้นส่วนที่ขาด = งวดจบ ไม่เตือน', () => {
  const waived = [{ customerId: 'CID1', topupId: TOPUP, installment: 2, kind: 'waiver', amount: 2500, paidAt: '2026-11-10', note: 'ส่วนลด' }]
  const { groups } = planPaymentReminders({ ...base, additions: waived, today: day('2026-11-15') })
  assert.equal(groups[0].extras.length, 0)
})

test('สัญญาที่ปิดแล้ว และลูกค้าที่ไม่มีปลายทางส่ง ข้ามทั้งหมด', () => {
  const none = planPaymentReminders({ ...base, today: day('2026-11-15'), canNotify: () => false })
  assert.equal(none.groups.length, 0)
  const withClosed = planPaymentReminders({ ...base, today: day('2026-11-15') })
  assert.ok(!withClosed.groups.some((g) => g.customer.id === 'CLOSED'))
})

test('อ่านรายการชำระเพิ่มไม่ได้ (remindPartial: false): ไม่ทวงงวดที่จ่ายไม่ครบ แต่งวดที่ยังไม่จ่ายเตือนตามเดิม', () => {
  const { groups } = planPaymentReminders({ ...base, today: day('2026-11-15'), remindPartial: false })
  assert.equal(groups.length, 1)
  assert.equal(groups[0].mains[0].installment, 8)
  assert.equal(groups[0].extras.length, 0)
})

test('เลื่อนส่วนที่ขาดของสัญญาหลักไปวันเดียวกับงวดถัดไป: เตือนครบทั้งสองงวด ไม่ทับกัน', () => {
  const input = {
    ...base,
    payments: [
      { customer_id: 'CID1', installment: 7, date_str: '2026-11-30' }, // ส่วนที่ขาดของงวด 7 นัดมาวันเดียวกับงวด 8
      { customer_id: 'CID1', installment: 8, date_str: '2026-11-30' },
    ],
    paymentRecords: [{ customer_id: 'CID1', installment: 7, amount_paid: 16000, slip_id: '' }],
    topups: [],
  }
  const { groups } = planPaymentReminders({ ...input, today: day('2026-11-23') })
  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].mains.map((m) => [m.installment, m.balance.state, m.balance.outstanding]), [[7, 'partial', 4000], [8, 'unpaid', 0]])
})

test('รายการงวดที่ยังจ่ายไม่ครบ (ผู้ช่วยเทเลแกรม): เห็นยอดขาดของวงเงินเพิ่ม · จ่ายครบแล้วหายไป · สัญญาปิดไม่นับ', () => {
  const short = listShortInstallments(base)
  assert.deepEqual(short, [{ customerId: 'CID1', topupId: TOPUP, installment: 2, dateStr: '2026-11-15', postponedFrom: '2026-11-06', due: 9000, paid: 6500, waived: 0, outstanding: 2500 }])
  const row = { id: 'a1', customer_id: 'CID1', topup_id: TOPUP, installment: 2, kind: 'payment', amount: '2500.00', paid_at: '2026-11-15', voided_at: null }
  assert.deepEqual(listShortInstallments({ ...base, additions: [additionFromRow(row)] }), [])
  assert.equal(listShortInstallments({ ...base, closedIds: new Set(['CID1']) }).length, 0)
})

test('นับวันจากเที่ยงคืนของวันนี้', () => {
  assert.equal(diffDays('2026-11-15', day('2026-11-08')), 7)
  assert.equal(diffDays('2026-11-06', day('2026-11-08')), -2)
})

// ทดสอบการเลื่อนนัดงวดของวงเงินเพิ่ม: node --test src/lib/topupSchedule.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { postponeTopupInstallment, nearestDue } from './topupSchedule.js'

const schedule = () => [
  { installment: 1, dateStr: '2026-09-30' },
  { installment: 2, dateStr: '2026-10-30' },
  { installment: 3, dateStr: '2026-11-30' },
]

test('เลื่อนงวดแล้วเก็บวันเดิมไว้ ไม่แตะงวดอื่น และไม่แก้อาร์เรย์เดิม', () => {
  const before = schedule()
  const snapshot = JSON.stringify(before)
  const after = postponeTopupInstallment(before, 2, '2026-11-05', 'ลูกค้าขอเลื่อน 6 วัน')
  assert.deepEqual(after[1], { installment: 2, dateStr: '2026-11-05', postponedFrom: '2026-10-30', postponeNote: 'ลูกค้าขอเลื่อน 6 วัน' })
  assert.deepEqual(after[0], before[0])
  assert.deepEqual(after[2], before[2])
  assert.equal(JSON.stringify(before), snapshot)
  assert.notEqual(after, before)
})

test('เลื่อนซ้ำยังอ้างวันนัดต้นฉบับ และบันทึกเหตุผลล่าสุด', () => {
  const once = postponeTopupInstallment(schedule(), 2, '2026-11-05', 'ครั้งแรก')
  const twice = postponeTopupInstallment(once, 2, '2026-11-12')
  assert.equal(twice[1].dateStr, '2026-11-12')
  assert.equal(twice[1].postponedFrom, '2026-10-30')
  assert.equal(twice[1].postponeNote, '')
})

test('เทียบเลขงวดแบบตัวเลข ("2" กับ 2 ถือเป็นงวดเดียวกัน)', () => {
  const after = postponeTopupInstallment([{ installment: '2', dateStr: '2026-10-30' }], 2, '2026-11-01')
  assert.equal(after[0].dateStr, '2026-11-01')
  assert.equal(after[0].postponedFrom, '2026-10-30')
})

test('เลื่อนงวดข้ามงวดถัดไปได้ ลำดับในอาร์เรย์คงเดิม จึงต้องเลือกงวดถัดไปด้วย nearestDue ไม่ใช่ตำแหน่งแรก', () => {
  // งวด 2 ถูกเลื่อนไปหลังงวด 3 — วันนี้ 25 พ.ย.: งวด 3 (อีก 5 วัน) ต้องถูกเลือกก่อนงวด 2 (อีก 15 วัน)
  const after = postponeTopupInstallment(schedule(), 2, '2026-12-10')
  assert.deepEqual(after.map((p) => p.installment), [1, 2, 3])
  const unpaid = [
    { ...after[1], diff: 15 },
    { ...after[2], diff: 5 },
  ]
  assert.equal(nearestDue(unpaid).installment, 3)
  assert.equal(nearestDue(unpaid.slice(0, 1)).installment, 2)
  assert.equal(nearestDue([]), null)
  assert.equal(nearestDue(null), null)
  // เกินกำหนด (diff ติดลบ) ถือว่าใกล้กว่างวดในอนาคต; วันเดียวกันให้งวดที่มาก่อนในรายการ
  assert.equal(nearestDue([{ installment: 4, diff: 3 }, { installment: 5, diff: -2 }]).installment, 5)
  assert.equal(nearestDue([{ installment: 2, diff: 0 }, { installment: 3, diff: 0 }]).installment, 2)
})

test('งวดไม่พบ วันที่ผิดรูปแบบ หรือตารางไม่ใช่อาร์เรย์ → โยน error ไม่เขียนทับข้อมูล', () => {
  assert.throws(() => postponeTopupInstallment(schedule(), 9, '2026-11-01'), /ไม่พบงวดที่ 9/)
  assert.throws(() => postponeTopupInstallment(schedule(), 2, '1/11/2026'), /YYYY-MM-DD/)
  assert.throws(() => postponeTopupInstallment(schedule(), 2, ''), /YYYY-MM-DD/)
  assert.throws(() => postponeTopupInstallment(null, 1, '2026-11-01'), /ไม่พบงวดที่ 1/)
})

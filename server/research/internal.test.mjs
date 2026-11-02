import test from 'node:test'
import assert from 'node:assert/strict'
import { leadSignals } from './internal.js'

const now = new Date('2026-11-05T09:00:00Z')
const lead = (daysAgo, extra = {}) => ({ received_at: new Date(now.getTime() - daysAgo * 86400000).toISOString(), channel: 'line', ...extra })

test('ไม่มีลีด = ไม่มีสัญญาณ · ไม่พังกับค่าแปลก', () => {
  assert.deepEqual(leadSignals([], now), [])
  assert.deepEqual(leadSignals(null, now), [])
  assert.deepEqual(leadSignals([{ received_at: 'ไม่ใช่วันที่' }], now), [])
})

test('lead_surge: สัปดาห์นี้ ≥ 3 และ ≥ 2× median 8 สัปดาห์ · กุญแจรายสัปดาห์', () => {
  const leads = [
    ...[0, 1, 2, 3].map((d) => lead(d, { audience: 'A', service_area: 'ชลบุรี', service: 'ขายฝาก' })),
    lead(10, { audience: 'A', service_area: 'ชลบุรี', service: 'ขายฝาก' }),
    lead(20, { audience: 'A', service_area: 'ชลบุรี', service: 'จำนอง' }),
    lead(1, { audience: 'B', service_area: 'ระยอง', service: 'หาซื้อ' }),
  ]
  const signals = leadSignals(leads, now)
  const surge = signals.find((s) => s.external_key.startsWith('crm:lead_surge:'))
  assert.ok(surge)
  assert.equal(surge.external_key, 'crm:lead_surge:A:ชลบุรี:2026-W45')
  assert.deepEqual(surge.audience, ['A'])
  assert.equal(surge.service_area, 'ชลบุรี')
  assert.doesNotMatch(surge.title + surge.summary, /\d+ ลีด/, 'ไม่ใส่ตัวเลขลีดจริงในข้อความ')
  const top = signals.find((s) => s.external_key.startsWith('crm:top_question:'))
  assert.equal(top.external_key, 'crm:top_question:ขายฝาก:2026-W45')
})

test('ลีดน้อย (2 ลีด) ไม่นับ surge · top_question ต้อง ≥ 2', () => {
  const leads = [lead(0, { audience: 'C', service: 'ฝากขาย' }), lead(1, { audience: 'C', service: 'ฝากขาย' })]
  const signals = leadSignals(leads, now)
  assert.equal(signals.some((s) => s.external_key.startsWith('crm:lead_surge:')), false)
  assert.equal(signals.filter((s) => s.external_key.startsWith('crm:top_question:')).length, 1)
  assert.deepEqual(leadSignals([lead(0, { service: 'จำนอง' })], now), [])
})

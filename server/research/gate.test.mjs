import test from 'node:test'
import assert from 'node:assert/strict'
import { checkContentGate, findRates } from './gate.js'

const codes = (text, brand) => checkContentGate(text, brand).reasons.map((r) => r.code)

test('ด่านดอกเบี้ย: เพดาน 15% ต่อปี (ต่อเดือน × 12)', () => {
  assert.equal(checkContentGate('ดอกเบี้ย 1.25% ต่อเดือน จดทะเบียนที่สำนักงานที่ดิน').ok, true)
  assert.deepEqual(codes('ดอกเบี้ย 1.5%/เดือน'), ['rate_over_cap'])
  assert.equal(checkContentGate('ร้อยละ 15 ต่อปี').ok, true)
  assert.deepEqual(codes('ผลตอบแทน 18% ต่อปี'), ['rate_over_cap'])
  assert.deepEqual(codes('ให้ผลตอบแทน 2 % / month'), ['rate_over_cap'])
})

test('findRates แปลงหน่วยถูก', () => {
  assert.deepEqual(findRates('1.25% ต่อเดือน และ ร้อยละ 12 ต่อปี').map((r) => r.annual), [15, 12])
  assert.deepEqual(findRates('ค่าจดจำนอง 0.01%'), [])
})

test('คำต้องห้ามจาก brand_facts และค่าเริ่มต้น', () => {
  assert.ok(codes('อนุมัติทุกเคส ไม่ดูเครดิต 100%').includes('forbidden_phrase'))
  assert.ok(codes('ที่นี่ รับประกันกำไร', { forbidden_phrases: ['รับประกันกำไร'] }).includes('forbidden_phrase'))
  assert.equal(checkContentGate('พิจารณาเป็นรายกรณีจากเอกสารสิทธิ์และทำเล', { forbidden_phrases: ['อนุมัติทุกเคส'] }).ok, true)
})

test('อ้าง ธปท. ใกล้คำอนุญาต/กำกับ/รับรอง = บล็อก · พูดถึง ธปท. ในฐานะข่าวได้', () => {
  assert.ok(codes('บริษัทได้รับอนุญาตจาก ธปท. แล้ว').includes('bot_license_claim'))
  assert.ok(codes('กำกับดูแลโดยแบงก์ชาติ').includes('bot_license_claim'))
  assert.equal(checkContentGate('ธปท. แถลงผลประชุม กนง. คงดอกเบี้ยนโยบาย').ok, true)
})

test('0.01% ใกล้จำนอง/ขายฝาก โดยไม่มี "พร้อมโอน" = บล็อก', () => {
  assert.ok(codes('ขายฝากวันนี้ ค่าจดจำนองแค่ 0.01%').includes('fee_measure_misapplied'))
  assert.equal(checkContentGate('ค่าจดจำนอง 0.01% เฉพาะกรณีจดจำนองพร้อมการโอน ตามมาตรการรัฐ').ok, true)
  assert.equal(checkContentGate('ค่าโอนลดเหลือ 0.01% ถึง 30 มิ.ย. 2570').ok, true)
})

test('กฎ BLOCK ของแอปเดิมยังทำงานผ่านด่านนี้', () => {
  const result = checkContentGate('อนุมัติ 100% ได้เงินแน่นอน')
  assert.equal(result.ok, false)
  assert.ok(result.reasons.some((r) => r.code.startsWith('rules:')))
})

test('ข้อความว่างผ่าน', () => {
  assert.equal(checkContentGate('').ok, true)
  assert.equal(checkContentGate(null).ok, true)
})

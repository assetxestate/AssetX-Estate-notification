import test from 'node:test'
import assert from 'node:assert/strict'
import { scrubPersonalData, scrub, hasPersonalData } from './pii.js'

// ชุดนี้คือสัญญาของตัวลบข้อมูลบุคคล (จากสเปกโปรไฟล์อสังหาฯ ข้อ 6) — แก้ regex แล้วต้องยังผ่านทั้งหมด
test('ข้อความธุรกิจที่ต้องไม่ถูกลบ', () => {
  for (const safe of ['นายหน้า', 'คุณภาพ', 'นางฟ้า', 'ดอกเบี้ย 1.25% ต่อเดือน', 'ราคาประเมินรอบ 2570-2573', 'ค่าจดจำนอง 0.01%', 'ขายฝาก 1,500,000 บาท', 'ปี 2569']) {
    assert.equal(scrub(safe), safe, safe)
    assert.equal(hasPersonalData(safe), false, safe)
  }
})

test('ข้อมูลบุคคลที่ต้องถูกลบ', () => {
  const cases = [
    ['โทร 081-234-5678', 'phone'],
    ['02 123 4567', 'phone'],
    ['สนใจทัก 0812345678 ได้เลย', 'phone'],
    ['Line: @abc123', 'line_id'],
    ['ไลน์ไอดี abc_99', 'line_id'],
    ['LINE ID: shop.99', 'line_id'],
    ['โฉนดเลขที่ 12345', 'deed_no'],
    ['น.ส.3ก 4455', 'deed_no'],
    ['ติดต่อ คุณ สมชาย', 'titled_name'],
    ['นาย สมชาย ใจดี ขายที่ดิน', 'titled_name'],
    ['a.b@x.co.th', 'email'],
    ['คดีหมายเลขดำที่ ผบ.123/2569', 'case_no'],
  ]
  for (const [text, kind] of cases) {
    const result = scrubPersonalData(text)
    assert.ok(result.text.includes('[ลบ]'), `${text} → ${result.text}`)
    assert.ok(result.hits.some((h) => h.kind === kind), `${text} ควรเจอ ${kind} แต่ได้ ${JSON.stringify(result.hits)}`)
  }
})

test('ลบแล้วไม่เหลือเศษ และคำรอบข้างยังอยู่', () => {
  const { text } = scrubPersonalData('รับจำนองที่ดิน โทร 089-111-2222 ไลน์ @landloan99 อีเมล sale@land.co.th ดอกเบี้ย 1.25% ต่อเดือน')
  // คำว่า "ไลน์" ถูกกลืนไปกับ ID ตามกฎ (กฎ LINE จับทั้งวลี) — ยอมรับได้ เพราะเป้าหมายคือไม่ให้ ID หลุด
  assert.equal(text, 'รับจำนองที่ดิน โทร [ลบ] [ลบ] อีเมล [ลบ] ดอกเบี้ย 1.25% ต่อเดือน')
  assert.doesNotMatch(text, /@/)
})

test('ข้อจำกัดที่รู้: ชื่อติดคำนำหน้าไม่เว้นวรรคจับไม่ได้ (ต้องทิ้งฟิลด์ผู้เขียนตั้งแต่ตอนอ่านฟีด)', () => {
  assert.equal(scrub('คุณสมชาย'), 'คุณสมชาย')
})

test('ค่าว่าง/ไม่ใช่สตริงไม่พัง', () => {
  assert.equal(scrub(null), '')
  assert.equal(scrub(undefined), '')
  assert.equal(scrub(12345), '12345')
})

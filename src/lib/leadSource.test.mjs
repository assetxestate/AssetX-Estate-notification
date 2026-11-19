import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanRef, parseLeadParams, leadSourceLabel, leadNotifyText, normalizeLeadSource, leadTicketNo, buildLeadNote } from './leadSource.js'

test('ลิงก์นายหน้า ?ref= ล็อกบทบาทเป็นนายหน้า', () => {
  assert.deepEqual(parseLeadParams('?ref=somchai-01'), { leadSource: 'broker', leadRef: 'somchai-01', locked: true })
  assert.deepEqual(parseLeadParams('?ref=' + encodeURIComponent('คุณเอ')), { leadSource: 'broker', leadRef: 'คุณเอ', locked: true })
})

test('ลิงก์ช่องทาง ?src= ไม่ล็อกบทบาท · ไม่มีอะไรเลย = เจ้าของทรัพย์', () => {
  assert.deepEqual(parseLeadParams('?src=tiktok'), { leadSource: 'owner', leadRef: 'tiktok', locked: false })
  assert.deepEqual(parseLeadParams(''), { leadSource: 'owner', leadRef: '', locked: false })
  assert.deepEqual(parseLeadParams(undefined), { leadSource: 'owner', leadRef: '', locked: false })
})

test('ref มาก่อน src เมื่อมีทั้งคู่', () => {
  assert.equal(parseLeadParams('?src=fb&ref=a1').leadRef, 'a1')
})

test('cleanRef ตัดอักขระอันตรายและจำกัดความยาว', () => {
  assert.equal(cleanRef('<script>alert(1)</script>'), 'scriptalert1script')
  assert.equal(cleanRef('  a   b  '), 'a b')
  assert.equal(cleanRef('x'.repeat(100)).length, 40)
  assert.equal(cleanRef(null), '')
  assert.equal(cleanRef('line1\nline2'), 'line1line2') // ขึ้นบรรทัดใหม่ถูกตัดทิ้ง
})

test('ป้ายบนการ์ด lead', () => {
  assert.equal(leadSourceLabel('broker', 'a1'), '🤝 นายหน้า · a1')
  assert.equal(leadSourceLabel('owner', ''), '🏠 เจ้าของทรัพย์')
  assert.equal(leadSourceLabel('', ''), '')
  assert.equal(normalizeLeadSource('อะไรก็ได้'), 'owner')
})

test('ข้อความเตือน Telegram ไม่มีชื่อ เบอร์ หรือ LINE ของผู้ส่ง', () => {
  const text = leadNotifyText({
    lead_source: 'broker', lead_ref: 'a1', assessment_type: 'ขายฝาก', property_subtype: 'บ้านเดี่ยว',
    province: 'กรุงเทพมหานคร', district: 'บางเขน', requested_loan: 2500000,
    contact_name: 'ชื่อทดสอบ', contact_phone: '0800000000', contact_line: 'lineid',
  })
  assert.match(text, /นายหน้า \(ลิงก์ a1\)/)
  assert.match(text, /ขายฝาก · บ้านเดี่ยว/)
  assert.match(text, /บางเขน · กรุงเทพมหานคร/)
  assert.match(text, /2,500,000/)
  assert.match(text, /ภายในวัน/)
  assert.match(text, /แอป → นายทุน → Lead จากเว็บ/) // ต้องตรงกับชื่อเมนูจริงในแอป
  assert.doesNotMatch(text, /ชื่อทดสอบ|0800000000|lineid/)
})

test('เลขรับเรื่องและหมายเหตุจากฟอร์ม', () => {
  assert.equal(leadTicketNo(19), 'AX-00019')
  assert.equal(leadTicketNo(123456), 'AX-123456')
  assert.equal(leadTicketNo(undefined), '')
  assert.equal(leadTicketNo('abc'), '')
  assert.equal(buildLeadNote({ mapLink: ' https://maps.app.goo.gl/x ', note: ' ภาระเดิม ' }), 'แผนที่: https://maps.app.goo.gl/x\nภาระเดิม')
  assert.equal(buildLeadNote({ note: 'อย่างเดียว' }), 'อย่างเดียว')
  assert.equal(buildLeadNote({}), '')
  assert.equal(buildLeadNote({ note: 'ก'.repeat(2000) }).length, 1000)
  assert.match(leadNotifyText({ id: 19 }), /เลขรับเรื่อง AX-00019/)
  assert.doesNotMatch(leadNotifyText({ id: 19, location_note: 'ข้อความลับ' }), /ข้อความลับ/)
})

test('ข้อความเตือนของ lead ทั่วไปและข้อมูลว่าง', () => {
  const text = leadNotifyText({})
  assert.match(text, /หน้าประเมินออนไลน์/)
  assert.match(text, /ยังไม่ระบุวงเงิน/)
  assert.match(leadNotifyText({ lead_ref: 'tiktok' }), /ช่องทาง tiktok/)
})

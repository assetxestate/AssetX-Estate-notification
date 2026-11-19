import test from 'node:test'
import assert from 'node:assert/strict'
import { phoneKey, brokerCodeOf, brokerLink, recruitLink, brokerIndex, brokerOfLead, brokerStats, findDuplicateLeads, duplicateLines, brokerNotifyLines, leadFacts } from './brokers.js'
import { parseLeadParams, leadNotifyText } from './leadSource.js'

// ข้อมูลสมมติทั้งหมด (เบอร์ ชื่อ เลขโฉนด ไม่ใช่ของจริง)
const brokers = [
  { id: 1, code: 'N001', name: 'นายหน้า หนึ่ง', phone: '080-000-0001', phone_key: '0800000001', status: 'active', merged_into: null },
  { id: 2, code: 'N002', name: 'นายหน้า สอง', phone: '0800000002', phone_key: '0800000002', status: 'new', merged_into: null },
  { id: 3, code: 'N003', name: 'นายหน้า หนึ่ง (เบอร์สอง)', phone: '0800000003', phone_key: '0800000003', status: 'new', merged_into: 1 },
]
const lead = (id, over = {}) => ({ id, created_at: `2026-11-${String(10 + id).padStart(2, '0')}T03:00:00Z`, status: 'Lead จากเว็บ', lead_source: 'broker', lead_ref: '', contact_name: 'ผู้ส่ง', contact_phone: '0800000001', province: 'กรุงเทพมหานคร', district: 'จอมทอง', subdistrict: 'จอมทอง', total_sqw: 100, deeds: [], ...over })

test('phoneKey: รวมรูปแบบเบอร์ไทยเป็นรูปเดียว เบอร์ไม่ครบคืนค่าว่าง', () => {
  assert.equal(phoneKey('080-000-0001'), '0800000001')
  assert.equal(phoneKey('+66 80 000 0001'), '0800000001')
  assert.equal(phoneKey('66800000001'), '0800000001')
  assert.equal(phoneKey('02 123 4567'), '021234567')
  assert.equal(phoneKey('12345'), '')
  assert.equal(phoneKey(''), '')
  assert.equal(phoneKey(null), '')
})

test('รหัสและลิงก์: รหัสจากเลขแถว ลิงก์ส่วนตัว และลิงก์สาธารณะสำหรับโพสต์หานายหน้า', () => {
  assert.equal(brokerCodeOf(7), 'N007')
  assert.equal(brokerCodeOf(1234), 'N1234')
  assert.equal(brokerCodeOf(0), '')
  assert.equal(brokerLink('https://example.com/', 'N007'), 'https://example.com/assess?ref=N007')
  assert.equal(brokerLink('https://example.com', '<script>'), 'https://example.com/assess?ref=script')
  assert.equal(recruitLink('https://example.com', 'fb'), 'https://example.com/assess?role=broker&src=fb')
  assert.equal(recruitLink('https://example.com', ''), 'https://example.com/assess?role=broker')
})

test('ลิงก์สาธารณะ ?role=broker ตั้งบทบาทนายหน้าโดยไม่ล็อก และเก็บช่องทางไว้', () => {
  assert.deepEqual(parseLeadParams('?role=broker&src=fb'), { leadSource: 'broker', leadRef: 'fb', locked: false })
  assert.deepEqual(parseLeadParams('?ref=N001&role=broker'), { leadSource: 'broker', leadRef: 'N001', locked: true })
  assert.deepEqual(parseLeadParams('?role=admin&src=fb'), { leadSource: 'owner', leadRef: 'fb', locked: false })
})

test('ตัวตนมาจากเบอร์โทร: หลายคนใช้ลิงก์เดียวกันก็แยกได้ และเบอร์สำรองรวมเข้าคนเดิม', () => {
  const index = brokerIndex(brokers)
  // สองคนเข้ามาทางลิงก์สาธารณะเดียวกัน
  assert.equal(brokerOfLead(lead(1, { lead_ref: 'fb', contact_phone: '080 000 0001' }), index).sender.id, 1)
  assert.equal(brokerOfLead(lead(2, { lead_ref: 'fb', contact_phone: '0800000002' }), index).sender.id, 2)
  // เบอร์ที่ถูกรวมรายชื่อ → คนปลายทาง
  assert.equal(brokerOfLead(lead(3, { contact_phone: '0800000003' }), index).sender.id, 1)
  // เบอร์ที่ยังไม่อยู่ในทะเบียน / เบอร์ไม่ครบ
  assert.equal(brokerOfLead(lead(4, { contact_phone: '0811111111' }), index).unregistered, true)
  assert.equal(brokerOfLead(lead(5, { contact_phone: '123' }), index).unidentified, true)
  // เจ้าของทรัพย์ไม่ใช่นายหน้า
  assert.equal(brokerOfLead(lead(6, { lead_source: 'owner' }), index), null)
})

test('ลิงก์ส่วนตัวถูกส่งต่อ: รหัสของคนหนึ่ง เบอร์ของอีกคน → เตือน และยึดเบอร์', () => {
  const index = brokerIndex(brokers)
  const forwarded = brokerOfLead(lead(1, { lead_ref: 'n001', contact_phone: '0800000002' }), index)
  assert.equal(forwarded.mismatch, true)
  assert.equal(forwarded.sender.id, 2)
  assert.equal(forwarded.linkOwner.id, 1)
  assert.equal(brokerOfLead(lead(2, { lead_ref: 'N001', contact_phone: '0800000001' }), index).mismatch, false)
  // ใช้ลิงก์ของตัวเองด้วยเบอร์สำรองที่รวมรายชื่อแล้ว ไม่ถือว่าผิดคน
  assert.equal(brokerOfLead(lead(3, { lead_ref: 'N001', contact_phone: '0800000003' }), index).mismatch, false)
  // รหัสที่ไม่มีในทะเบียน (ป้ายช่องทาง) ไม่เตือน
  assert.equal(brokerOfLead(lead(4, { lead_ref: 'fb-group' }), index).mismatch, false)
})

test('brokerStats: นับงานต่อคนจาก lead จริง ไม่นับรายการยกเลิก และแยกคนที่ยังไม่อยู่ในทะเบียน', () => {
  const rows = [
    lead(1), lead(2, { contact_phone: '0800000003' }), lead(3, { status: 'ยกเลิก' }),
    lead(4, { contact_phone: '0800000002' }),
    lead(5, { contact_phone: '0822222222', contact_name: 'คนใหม่' }),
    lead(6, { lead_source: 'owner', contact_phone: '0833333333' }),
  ]
  const stats = brokerStats(brokers, rows)
  const one = stats.registered.find((s) => s.broker.id === 1)
  assert.equal(one.count, 2)
  assert.equal(one.cancelled, 1)
  assert.deepEqual(one.tickets, ['AX-00001', 'AX-00002'])
  assert.deepEqual(one.phones.sort(), ['0800000001', '0800000003'])
  assert.equal(stats.registered.find((s) => s.broker.id === 2).count, 1)
  assert.equal(stats.registered.some((s) => s.broker.id === 3), false)
  assert.equal(stats.unregistered.length, 1)
  assert.equal(stats.unregistered[0].phone, '0822222222')
  assert.equal(stats.unregistered[0].name, 'คนใหม่')
  // ทำงานกับแถวรูปที่หน้าเว็บใช้ด้วย
  const webRows = [{ _rowIndex: 9, leadSource: 'broker', contactPhone: '080-000-0002', 'สถานะ': 'Lead จากเว็บ', createdAt: '2026-11-19T00:00:00Z' }]
  assert.equal(brokerStats(brokers, webRows).registered.find((s) => s.broker.id === 2).count, 1)
})

test('ทรัพย์ซ้ำ: เลขโฉนดตรงกันในจังหวัดเดียวกัน = ซ้ำ บอกได้ว่าใครส่งก่อน', () => {
  const first = lead(1, { deeds: [{ titleDeedNo: '11111' }], contact_phone: '0800000001' })
  const second = lead(2, { title_deed_no: 'น.11111', contact_phone: '0800000002' })
  const otherProvince = lead(3, { deeds: [{ titleDeedNo: '11111' }], province: 'นนทบุรี' })
  const otherDistrict = lead(4, { deeds: [{ titleDeedNo: '11111' }], district: 'บางแค' })
  const cancelled = lead(5, { deeds: [{ titleDeedNo: '11111' }], status: 'ยกเลิก' })
  const rows = [first, second, otherProvince, otherDistrict, cancelled]

  const forSecond = findDuplicateLeads(second, rows)
  assert.deepEqual(forSecond.map((d) => [d.ticketNo, d.certainty, d.earlier, d.sameSender]), [['AX-00001', 'same', true, false]])
  const forFirst = findDuplicateLeads(first, rows)
  assert.deepEqual(forFirst.map((d) => [d.ticketNo, d.earlier]), [['AX-00002', false]])
  assert.match(duplicateLines(second, forSecond)[0], /^ทรัพย์ซ้ำกับ AX-00001 \(ส่งเข้ามาก่อน 1 วัน · ผู้ส่งคนละคน\)$/)
  assert.match(duplicateLines(first, forFirst)[0], /^ทรัพย์ซ้ำกับ AX-00002 \(ส่งเข้ามาทีหลัง 1 วัน · ผู้ส่งคนละคน\)$/)
})

test('ทรัพย์ซ้ำ: ไม่มีเลขโฉนดให้เทียบ ใช้ตำบลและเนื้อที่ = "อาจซ้ำ" · มีเลขโฉนดคนละเลขไม่ถือว่าซ้ำ', () => {
  const a = lead(1, { total_sqw: 236 })
  const b = lead(2, { total_sqw: 236, contact_phone: '0800000001' })
  const differentSize = lead(3, { total_sqw: 240 })
  const differentDeeds = [lead(4, { total_sqw: 500, deeds: [{ titleDeedNo: '222' }] }), lead(5, { total_sqw: 500, deeds: [{ titleDeedNo: '333' }] })]
  const found = findDuplicateLeads(b, [a, b, differentSize])
  assert.deepEqual(found.map((d) => [d.ticketNo, d.certainty, d.sameSender]), [['AX-00001', 'possible', true]])
  assert.match(duplicateLines(b, found)[0], /^อาจซ้ำกับ AX-00001 .*ผู้ส่งคนเดียวกัน/)
  assert.deepEqual(findDuplicateLeads(differentDeeds[1], differentDeeds), [])
  assert.deepEqual(findDuplicateLeads(lead(6, { total_sqw: 0, subdistrict: '' }), [a, b]), [])
})

test('ข้อความเทเลแกรม: บอกว่านายหน้าใหม่หรือเดิมด้วยรหัส ไม่มีชื่อ เบอร์ หรือเลขโฉนด', () => {
  assert.deepEqual(brokerNotifyLines(null), [])
  assert.match(brokerNotifyLines({ code: 'N004', isNew: true, priorCount: 0 })[0], /นายหน้าใหม่ \(รหัส N004\)/)
  assert.match(brokerNotifyLines({ code: 'N001', isNew: false, priorCount: 3 })[0], /นายหน้าเดิม รหัส N001 · ส่งมาแล้ว 3 ทรัพย์/)
  assert.equal(brokerNotifyLines({ code: 'N001', isNew: false, priorCount: 3, mismatch: true }).length, 2)
  assert.match(brokerNotifyLines({ unidentified: true })[0], /ระบุตัวตนไม่ได้/)

  const row = lead(2, { title_deed_no: '11111', contact_name: 'ชื่อ นามสกุล', contact_phone: '0800000002', lead_ref: 'fb' })
  const dups = findDuplicateLeads(row, [lead(1, { title_deed_no: '11111' }), row])
  const text = leadNotifyText(row, { extra: [...brokerNotifyLines({ code: 'N002', isNew: true, priorCount: 0 }), ...duplicateLines(row, dups)] })
  assert.match(text, /นายหน้าใหม่ \(รหัส N002\)/)
  assert.match(text, /ทรัพย์ซ้ำกับ AX-00001/)
  assert.doesNotMatch(text, /0800000002|ชื่อ นามสกุล|11111/)
})

test('leadFacts: อ่านเลขโฉนดจากทุกช่อง และตัดคำนำหน้าของชื่อเขต', () => {
  const facts = leadFacts({ _rowIndex: 3, 'เลขโฉนด': '123, 456', deeds: [{ titleDeedNo: '456' }, { titleDeedNo: '789' }], 'อำเภอ/เขต': 'เขตจอมทอง', 'จังหวัด': 'กรุงเทพมหานคร' })
  assert.deepEqual(facts.deedNos, ['123', '456', '789'])
  assert.equal(facts.district, 'จอมทอง')
  assert.equal(facts.id, 3)
})

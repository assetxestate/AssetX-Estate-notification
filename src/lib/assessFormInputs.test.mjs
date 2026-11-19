// ช่องของหน้า /assess ที่เจ้าของขอแก้ 19 พ.ย. 2569: ช่องเนื้อที่บนมือถือ · ประเภทเอกสารสิทธิ์ครบทุกประเภท · เลขเอกสารในข้อความเทเลแกรม
import test from 'node:test'
import assert from 'node:assert/strict'
import { DEED_TYPES, areaInput, deedTypeKeyFor, effectiveTitleType, isVacantLandSubtype, vacantLandSubtypeFor } from './deedTypes.js'
import { PROPERTY_SUBTYPES, BASE_FSV_RATE, SUBTYPE_CODE, computeValuation } from './valuationOptions.js'
import { leadNotifyText } from './leadSource.js'

test('areaInput: ลบได้หมด ไม่มีศูนย์ค้างนำหน้า รับเฉพาะตัวเลข', () => {
  assert.equal(areaInput(''), '')
  assert.equal(areaInput('0'), '0')
  assert.equal(areaInput('02'), '2')
  assert.equal(areaInput('066'), '66')
  assert.equal(areaInput('1a2 3'), '123')
  assert.equal(areaInput('12.5'), '125')
  assert.equal(areaInput('12.5', { decimal: true }), '12.5')
  assert.equal(areaInput('012.50.7', { decimal: true }), '12.507')
  assert.equal(areaInput('0.5', { decimal: true }), '0.5')
  assert.equal(areaInput(null), '')
})

test('ที่ดินเปล่า: ประเภทย่อยตามประเภทเอกสาร และทุกค่าที่ได้มีในตัวเลือก อัตรา และรหัส', () => {
  assert.equal(vacantLandSubtypeFor('chanote'), 'ที่ดินเปล่า (โฉนด)')
  assert.equal(vacantLandSubtypeFor('ns3k'), 'ที่ดินเปล่า (น.ส.3)')
  assert.equal(vacantLandSubtypeFor('sk1'), 'ที่ดินเปล่า (ส.ค.1)')
  assert.equal(vacantLandSubtypeFor('spk401'), 'ที่ดินเปล่า (เอกสารสิทธิ์อื่น)')
  for (const type of DEED_TYPES) {
    const subtype = vacantLandSubtypeFor(type.key)
    assert.ok(PROPERTY_SUBTYPES['ที่ดิน'].includes(subtype), subtype)
    assert.ok(BASE_FSV_RATE[subtype] > 0, subtype)
    assert.ok(SUBTYPE_CODE[subtype], subtype)
    assert.equal(isVacantLandSubtype(subtype), true)
  }
  assert.equal(isVacantLandSubtype('ที่ดินพร้อมสิ่งปลูกสร้าง'), false)
  assert.equal(isVacantLandSubtype('บ้านเดี่ยว'), false)
})

test('ฟอร์ม /assess: เอกสารที่เลือกรายแปลงเป็นตัวกำหนดคะแนน และเนื้อที่ที่พิมพ์เป็นข้อความคำนวณได้', () => {
  const form = { assessmentType: 'ขายฝาก', propertyType: 'ที่ดิน', propertySubtype: 'ที่ดินเปล่า (โฉนด)', titleType: 'โฉนด (Chanote) ปลอดภาระ', deeds: [{ docType: 'ns3', areaRai: '2', areaNgan: '3', areaSqw: '66' }] }
  assert.equal(deedTypeKeyFor(form.deeds[0], form), 'ns3')
  assert.equal(effectiveTitleType(form), 'น.ส.3 (NS3)')
  assert.equal(effectiveTitleType({ ...form, deeds: [{}], titleEncumbrance: 'mortgaged' }), 'โฉนด มีจำนองอยู่ชั้นเดียว')
  const deeds = form.deeds.map((d) => ({ ...d, areaRai: +d.areaRai || 0, areaNgan: +d.areaNgan || 0, areaSqw: +d.areaSqw || 0, govPrice: 0 }))
  assert.equal(computeValuation({ ...form, deeds, risks: {} }).totalSqw, 2 * 400 + 3 * 100 + 66)
})

test('ข้อความเทเลแกรม: เอกสารที่ไม่ใช่โฉนดบอกประเภทกำกับ', () => {
  const base = { id: 30, lead_source: 'broker', province: 'กรุงเทพมหานคร', district: 'ดอนเมือง' }
  assert.match(leadNotifyText({ ...base, deeds: [{ titleDeedNo: '111', docType: 'chanote' }, { titleDeedNo: '222' }] }), /\nเลขโฉนด 111, 222\n/)
  assert.match(leadNotifyText({ ...base, deeds: [{ titleDeedNo: '111', docType: 'chanote' }, { titleDeedNo: '333', docType: 'ns3k' }] }), /\nเลขเอกสารสิทธิ์ 111, 333 \(น\.ส\.3 ก\)\n/)
  assert.match(leadNotifyText({ ...base, deeds: [{ titleDeedNo: '', docType: 'spk401' }] }), /\nยังไม่ระบุเลขเอกสารสิทธิ์ \(ส\.ป\.ก\. 4-01\)\n/)
})

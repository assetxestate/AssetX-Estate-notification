import test from 'node:test'
import assert from 'node:assert/strict'
import { parseLandsMapsText, landsMapsConflicts } from './landsmapsPaste.js'

// ข้อความตัวอย่างตามรูปแบบกล่องผลลัพธ์ของ LandsMaps — ตัวเลขสมมติ ไม่ใช่แปลงของลูกค้า
const SAMPLE = `เลขโฉนดที่ดิน
12345
หน้าสำรวจ
678
เลขที่ดิน
90
ระวาง
5036 II 5814-16 (1000)
ตำบล
จอมทอง
อำเภอ
จอมทอง
จังหวัด
กรุงเทพมหานคร
เนื้อที่
0 ไร่ 2 งาน 36.0 ตารางวา
ราคาประเมินที่ดิน
(กรมธนารักษ์)
30,000 บาทต่อตารางวา หรือตรวจสอบข้อมูลผ่านทาง เว็บไซต์กรมธนารักษ์ หรือติดต่อสำนักงานที่ดิน
ค่าพิกัดแปลง
13.70000000,100.47000000`

test('อ่านกล่องผลลัพธ์ LandsMaps ครบทุกช่อง', () => {
  const { fields, found } = parseLandsMapsText(SAMPLE)
  assert.deepEqual(fields, {
    titleDeedNo: '12345', surveyPage: '678', landNo: '90', mapSheet: '5036 II 5814-16 (1000)',
    subdistrict: 'จอมทอง', district: 'จอมทอง', province: 'กรุงเทพมหานคร',
    areaRai: 0, areaNgan: 2, areaSqw: 36, govPrice: 30000, lat: 13.7, lng: 100.47,
  })
  assert.equal(found.length, 10)
})

test('บรรทัดแบบ CRLF · หัวข้อกับค่าบรรทัดเดียวกัน · เนื้อที่แบบ 1-2-50.5', () => {
  const { fields } = parseLandsMapsText('เลขโฉนดที่ดิน: 555\r\nเลขที่ดิน\t12\r\nเนื้อที่\r\n1-2-50.5 ไร่\r\nตำบล\r\nตำบลหนองแก\r\nค่าพิกัดแปลง\r\n12.5|99.95\r\n')
  assert.equal(fields.titleDeedNo, '555')
  assert.equal(fields.landNo, '12')
  assert.deepEqual([fields.areaRai, fields.areaNgan, fields.areaSqw], [1, 2, 50.5])
  assert.equal(fields.subdistrict, 'หนองแก')
  assert.deepEqual([fields.lat, fields.lng], [12.5, 99.95])
})

test('ค่าที่อ่านไม่ได้ไม่ถูกกรอก: ไม่มีราคา · พิกัดนอกประเทศไทย · ข้อความอื่น', () => {
  const noPrice = parseLandsMapsText('เลขโฉนดที่ดิน\n1\nราคาประเมินที่ดิน\n(กรมธนารักษ์)\nไม่พบข้อมูล กรุณาติดต่อสำนักงานที่ดิน\nค่าพิกัดแปลง\n100.47,13.69')
  assert.deepEqual(noPrice.fields, { titleDeedNo: '1' })
  assert.deepEqual(noPrice.found, ['titleDeedNo'])
  // หัวข้อที่ไม่มีค่าตามมา (หัวข้อถัดไปมาทันที) ต้องไม่เอาหัวข้อถัดไปมาเป็นค่า
  assert.deepEqual(parseLandsMapsText('หน้าสำรวจ\nเลขที่ดิน\n7').fields, { landNo: '7' })
  assert.deepEqual(parseLandsMapsText('สวัสดีครับ ขอส่งทรัพย์').found, [])
  assert.deepEqual(parseLandsMapsText(null).found, [])
})

test('เตือนเมื่อเลขที่วางไม่ตรงกับที่กรอกไว้', () => {
  const { fields } = parseLandsMapsText(SAMPLE)
  assert.deepEqual(landsMapsConflicts(fields, { titleDeedNo: '12345', landNo: '' }), [])
  assert.deepEqual(landsMapsConflicts(fields, { titleDeedNo: '99999 ' }), [{ key: 'titleDeedNo', from: '99999', to: '12345' }])
})

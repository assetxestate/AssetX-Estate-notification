// ราคาประเมินสิ่งปลูกสร้างตามบัญชีกรมธนารักษ์: ตารางค่าเสื่อมต้องตรงกับตารางราชการ และราคามาจากไฟล์ข้อมูลของจังหวัดนั้น
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { BUILDING_CLASSES, depreciationPct, defaultBuildingClass, buildingTypes, buildingUnitPrice, computeBuilding, computeBuildings, buildingSummaryText, isSiteWork } from './buildingCost.js'
import { buildPhotoReviewPrompt, normalizePhotoReview, photoReviewText } from './photoReview.js'

const data = JSON.parse(fs.readFileSync(new URL('./treasuryBuildingCosts.json', import.meta.url), 'utf8'))

test('ค่าเสื่อมตรงกับตารางของคณะกรรมการกำหนดราคาประเมินทุนทรัพย์', () => {
  // จุดที่คู่มือยกเป็นตัวอย่าง: ตึก 15 ปี = 20 · ตึก 20 ปี = 30 · ครึ่งตึกครึ่งไม้ 10 ปี = 30 · ไม้ 18 ปี = 86
  assert.equal(depreciationPct('masonry', 15), 20)
  assert.equal(depreciationPct('masonry', 20), 30)
  assert.equal(depreciationPct('half', 10), 30)
  assert.equal(depreciationPct('wood', 18), 86)
  // ทั้งตาราง
  const masonry = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74]
  masonry.forEach((pct, i) => assert.equal(depreciationPct('masonry', i + 1), pct, `ตึก ปีที่ ${i + 1}`))
  const half = [2, 4, 6, 8, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 55, 60, 65, 70, 75, 80]
  half.forEach((pct, i) => assert.equal(depreciationPct('half', i + 1), pct, `ครึ่งตึกครึ่งไม้ ปีที่ ${i + 1}`))
  const wood = [3, 6, 9, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 72, 79, 86]
  wood.forEach((pct, i) => assert.equal(depreciationPct('wood', i + 1), pct, `ไม้ ปีที่ ${i + 1}`))
  // เพดานตลอดอายุการใช้งาน
  assert.equal(depreciationPct('masonry', 43), 76)
  assert.equal(depreciationPct('masonry', 90), 76)
  assert.equal(depreciationPct('half', 22), 85)
  assert.equal(depreciationPct('wood', 19), 93)
  // เศษของปีนับเป็นหนึ่งปี · ค่าที่ไม่ใช่อายุ = ไม่หัก
  assert.equal(depreciationPct('masonry', 10.2), 12)
  assert.equal(depreciationPct('masonry', 0), 0)
  assert.equal(depreciationPct('masonry', 'abc'), 0)
  assert.equal(depreciationPct('unknown', 15), 20)
})

test('ไฟล์ข้อมูล: 77 จังหวัด ทุกจังหวัดมีราคาครบทุกประเภท', () => {
  assert.equal(Object.keys(data.provinces).length, 77)
  assert.ok(data.types.length >= 60)
  for (const [name, prices] of Object.entries(data.provinces)) {
    assert.equal(prices.length, data.types.length, name)
    assert.ok(prices.every((p) => p > 0), name)
  }
  assert.ok(data.provinces['กรุงเทพมหานคร'])
  const types = buildingTypes(data)
  assert.equal(types.find((t) => t.id === '106').cls, 'half')
  assert.equal(types.find((t) => t.id === '101').cls, 'wood')
  assert.equal(types.find((t) => t.id === '105').cls, 'masonry')
  assert.equal(defaultBuildingClass('ห้องแถวครึ่งตึกครึ่งไม้สองชั้น'), 'half')
  assert.equal(isSiteWork('608'), true)
  assert.equal(isSiteWork('506/1'), false)
})

test('ราคาต่อหน่วยตามจังหวัด และมูลค่าหลังหักค่าเสื่อม', () => {
  const index = data.types.findIndex(([id]) => id === '105')
  assert.equal(buildingUnitPrice(data, 'สงขลา', '105'), data.provinces['สงขลา'][index])
  assert.equal(buildingUnitPrice(data, 'จังหวัดสงขลา', '105'), data.provinces['สงขลา'][index])
  assert.notEqual(buildingUnitPrice(data, 'สงขลา', '105'), buildingUnitPrice(data, 'กรุงเทพมหานคร', '105'))
  assert.equal(buildingUnitPrice(data, 'ไม่มีจังหวัดนี้', '105'), 0)
  assert.equal(buildingUnitPrice(data, 'สงขลา', '999'), 0)

  const unit = buildingUnitPrice(data, 'กรุงเทพมหานคร', '105')
  const one = computeBuilding({ typeId: '105', area: '100', age: '15' }, data, 'กรุงเทพมหานคร')
  assert.deepEqual([one.unit, one.newCost, one.depPct, one.value, one.missing], [unit, unit * 100, 20, Math.round(unit * 100 * 0.8), []])
  // เจ้าของเปลี่ยนชนิดโครงสร้างได้ · พื้นที่มีจุลภาค
  assert.equal(computeBuilding({ typeId: '105', area: '1,200.5', age: 10, cls: 'wood' }, data, 'กรุงเทพมหานคร').depPct, 40)
  assert.equal(computeBuilding({ typeId: '105', area: '1,200.5', age: 10 }, data, 'กรุงเทพมหานคร').area, 1200.5)
  // ข้อมูลไม่ครบ = ไม่มียอด และบอกว่าขาดอะไร
  assert.deepEqual(computeBuilding({ typeId: '105', area: '', age: '' }, data, 'กรุงเทพมหานคร').missing, ['พื้นที่', 'อายุ'])
  assert.deepEqual(computeBuilding({}, data, 'กรุงเทพมหานคร').missing, ['ประเภท', 'พื้นที่', 'อายุ'])
  assert.deepEqual(computeBuilding({ typeId: '105', area: 100, age: 5 }, data, '').missing, ['ราคาของจังหวัดนี้'])
  assert.equal(computeBuilding({ typeId: '105', area: '', age: 5 }, data, 'กรุงเทพมหานคร').value, 0)

  const all = computeBuildings([{ typeId: '105', area: 100, age: 15 }, { typeId: '504', area: 30, age: 8 }, { typeId: '106', area: '', age: '' }], data, 'กรุงเทพมหานคร')
  assert.equal(all.total, all.rows[0].value + all.rows[1].value)
  assert.equal(all.complete, false)
  assert.equal(computeBuildings([], data, 'กรุงเทพมหานคร').complete, false)
  const text = buildingSummaryText([{ typeId: '105', area: 100, age: 15 }, { typeId: '106', area: '', age: '' }], data, 'กรุงเทพมหานคร')
  assert.equal(text, `บ้านพักอาศัยตึกสองชั้น 100 ตร.ม. อายุ 15 ปี (${BUILDING_CLASSES.masonry} หักค่าเสื่อม 20%) ≈ ${Math.round(unit * 80).toLocaleString('en-US')} บาท`)
})

test('AI อ่านรูป: เสนอได้แค่ประเภทที่มีในบัญชี ไม่มีพื้นที่ อายุ หรือราคา', () => {
  const types = buildingTypes(data)
  const prompt = buildPhotoReviewPrompt([], 2, { buildingTypes: types })
  assert.ok(prompt.includes('  - 106: บ้านพักอาศัยครึ่งตึกครึ่งไม้สองชั้น'))
  assert.match(prompt, /ห้ามประมาณพื้นที่เป็นตารางเมตร ห้ามบอกอายุเป็นตัวเลข และห้ามบอกราคา/)
  assert.ok(!buildPhotoReviewPrompt([], 2).includes('buildings'))
  const answer = {
    summary: 'มีอาคารไม้ผสมปูนสองชั้นที่ต้องตรวจสภาพ',
    buildings: [
      { type_id: '106', what: 'บ้านหลังหลัก', cls: 'half', storeys: 2, condition: 'หลังคาเสื่อม', evidence: 'ชั้นล่างก่ออิฐ ชั้นบนผนังไม้', photos: [1, 5], confidence: 'medium' },
      { type_id: '999', what: 'ไม่มีรหัสนี้', cls: 'masonry', storeys: 1, evidence: 'x', photos: [1], confidence: 'high' },
      { type_id: '504', what: 'โรงจอดรถ', cls: 'steel', storeys: 'หนึ่ง', evidence: 'เสาเหล็กรับหลังคา', photos: [2], confidence: 'high' },
      { type_id: '105', what: 'บ้านอีกหลัง', cls: 'masonry', storeys: 2, evidence: 'น่าจะมีมูลค่าราว 2 ล้านบาท', photos: [2], confidence: 'high' },
    ],
  }
  const review = normalizePhotoReview(answer, { imageCount: 2, buildingTypeIds: types.map((t) => t.id) })
  assert.deepEqual(review.buildings.map((b) => [b.typeId, b.cls, b.storeys]), [['106', 'half', 2], ['504', '', 0]])
  assert.deepEqual(review.buildings[0].photos, [1])
  assert.match(photoReviewText(review), /บ้านหลังหลัก: ประเภท 106 · โครงสร้างครึ่งตึกครึ่งไม้ · 2 ชั้น · หลังคาเสื่อม — ชั้นล่างก่ออิฐ ชั้นบนผนังไม้ \(รูปทรัพย์ที่ 1\)/)
  // ไม่ส่งรายการรหัส = ไม่รับ buildings เลย
  assert.deepEqual(normalizePhotoReview(answer, { imageCount: 2 }).buildings, [])
})

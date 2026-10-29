// ทดสอบราคาประเมินราชการรายโฉนด: node --test src/lib/deedAssessment.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { deedAreaWa, deedAssessment, customerAssessment, findValuationPriceForDeed } from './deedAssessment.js'

test('แปลงเนื้อที่ ไร่-งาน-วา เป็นตารางวา', () => {
  assert.equal(deedAreaWa({ area: '5-2-0 ไร่' }), 2200)
  assert.equal(deedAreaWa({ area: '0-0-60.2 ไร่' }), 60.2)
  assert.equal(deedAreaWa({ area: '2-1-40.9 ไร่' }), 940.9)
  assert.equal(deedAreaWa({ areaRai: 0, areaNgan: 3, areaSqw: 37 }), 337)
  assert.equal(deedAreaWa({ area: '' }), 0)
  assert.equal(deedAreaWa(null), 0)
})

test('ราคาประเมินต่อแปลงและรวมทั้งลูกค้า', () => {
  const d = deedAssessment({ area: '5-2-0 ไร่', govPrice: 2200, buildingValue: 150000 })
  assert.deepEqual({ wa: d.wa, landValue: d.landValue, total: d.total, priced: d.priced }, { wa: 2200, landValue: 4840000, total: 4990000, priced: true })
  const partial = customerAssessment([{ area: '0-1-75.4 ไร่', govPrice: 9000 }, { area: '0-1-34 ไร่' }, { area: '0-3-85.6 ไร่', govPrice: 9000 }])
  assert.equal(partial.count, 3)
  assert.equal(partial.pricedCount, 2)
  assert.equal(partial.complete, false)
  assert.equal(partial.totalWa, 695) // 175.4 + 134 + 385.6 — รวมทุกแปลงไม่ว่ามีราคาหรือไม่
  assert.equal(partial.landValue, (175.4 + 385.6) * 9000)
  const full = customerAssessment([{ area: '0-0-60 ไร่', govPrice: 12000, buildingValue: 300000 }])
  assert.equal(full.complete, true)
  assert.equal(full.total, 1020000)
  assert.equal(customerAssessment([]).complete, false)
  assert.equal(customerAssessment(null).count, 0)
})

test('ค้นราคาจากผลประเมินในระบบด้วยเลขโฉนด (ทั้งจาก deeds ย่อยและคอลัมน์หลัก)', () => {
  const rows = [
    { 'เลขโฉนด': '96753', 'ราคาประเมินรัฐ (บ./ตร.ว.)': 2200, 'วันที่ประเมิน': '2026-03-30', 'รหัส/ชื่อทรัพย์': 'ที่ดินติดถนนเลี่ยงเมืองชะอำ', deeds: [] },
    { 'เลขโฉนด': '20453', 'ราคาประเมินรัฐ (บ./ตร.ว.)': 36000, 'วันที่ประเมิน': '2026-05-04', deeds: [{ titleDeedNo: '20454', govPrice: 36000 }] },
    { 'เลขโฉนด': '133153', 'ราคาประเมินรัฐ (บ./ตร.ว.)': 0, deeds: [{ titleDeedNo: '133153', govPrice: 0 }] },
  ]
  assert.deepEqual(findValuationPriceForDeed({ no: '96753' }, rows), { govPrice: 2200, date: '2026-03-30', source: 'ที่ดินติดถนนเลี่ยงเมืองชะอำ' })
  assert.equal(findValuationPriceForDeed({ no: '20454' }, rows).govPrice, 36000)
  assert.equal(findValuationPriceForDeed({ no: '133153' }, rows), null) // ราคา 0 ไม่ถือว่ามี
  assert.equal(findValuationPriceForDeed({ no: '' }, rows), null)
  assert.equal(findValuationPriceForDeed({ no: '1' }, null), null)
})

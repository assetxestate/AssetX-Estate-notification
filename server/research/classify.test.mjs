import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifySubtype, scoreText, freshnessBonus, titleDropped, sourceDropped, pantipScore, youtubeScore,
  normalizeUrl, eventKey, isoWeek, DEFAULT_SCORING,
} from './classify.js'

test('subtype: ตัวแรกที่ตรงชนะ · ไม่ตรงอะไรเลยเป็น market', () => {
  assert.equal(classifySubtype('แก๊งปลอมโฉนดหลอกขายฝาก'), 'scam')
  assert.equal(classifySubtype('ราชกิจจาฯ ประกาศกฎกระทรวงค่าธรรมเนียมโอน'), 'law')
  assert.equal(classifySubtype('กรมธนารักษ์เลื่อนประกาศราคาประเมินรอบใหม่'), 'valuation')
  assert.equal(classifySubtype('ครม. ต่ออายุลดค่าโอน-จดจำนอง 0.01%'), 'fee_measure')
  assert.equal(classifySubtype('กนง. คงดอกเบี้ยนโยบาย'), 'rate')
  assert.equal(classifySubtype('ทรัพย์ขายทอดตลาดพุ่ง'), 'auction_npa')
  assert.equal(classifySubtype('ธอส. ปล่อยสินเชื่อบ้านดอกเบี้ยคงที่'), 'credit_market')
  assert.equal(classifySubtype('ราคาที่ดินชลบุรีขยับ'), 'market')
})

test('คะแนน: w × min(คำต่างกัน, 2) และ topic gate', () => {
  const scoring = { ...DEFAULT_SCORING, weights: { ...DEFAULT_SCORING.weights, area: { w: 1.5, words: ['ชลบุรี'] } } }
  const good = scoreText('รับจำนอง ขายฝาก ที่ดิน ชลบุรี ดอกเบี้ยถูก', scoring)
  assert.equal(good.gated, true)
  // transaction 2 คำ (จำนอง ขายฝาก) = 4.0 · asset 1 คำ = 1.0 · area 1 คำ = 1.5
  assert.equal(good.score, 6.5)
  const painOnly = scoreText('หนี้บัตรเครดิต ติดบูโร ทำยังไงดี', scoring)
  assert.equal(painOnly.gated, false)
  assert.equal(painOnly.score, 3.0)
  const three = scoreText('ขายฝาก จำนอง ไถ่ถอน', scoring)
  assert.equal(three.score, 4.0, 'เกิน 2 คำในกลุ่มเดียวไม่ได้คะแนนเพิ่ม')
})

test('ความสดและตัวกรอง', () => {
  const now = new Date('2026-11-02T09:00:00Z')
  assert.equal(freshnessBonus('2026-11-02T01:00:00Z', now), 2.0)
  assert.equal(freshnessBonus('2026-10-31T09:00:00Z', now), 1.5)
  assert.equal(freshnessBonus('2026-10-28T09:00:00Z', now), 0.8)
  assert.equal(freshnessBonus('2026-10-10T09:00:00Z', now), -1.0)
  assert.equal(freshnessBonus(null, now), 0)
  assert.equal(freshnessBonus('2026-11-02T01:00:00Z', now, { factor: 0.5 }), 1.0)
  assert.equal(titleDropped('ขายฝากทองคำ ดอกเบี้ยถูก'), true)
  assert.equal(titleDropped('ขายฝากที่ดิน'), false)
  assert.equal(sourceDropped('Vietnam.vn'), true)
  assert.equal(sourceDropped('ฐานเศรษฐกิจ'), false)
})

test('คะแนน Pantip มีเพดาน ~5.5 · YouTube ~7.5 (คลิปไวรัลไม่กินท็อป)', () => {
  assert.equal(pantipScore(0, 0), 2.5)
  assert.ok(pantipScore(10_000_000, 100_000) <= 5.5)
  const now = new Date('2026-11-02T09:00:00Z')
  const viral = youtubeScore(50_000_000, '2026-11-01T09:00:00Z', now)
  assert.ok(viral <= 7.6, String(viral))
  assert.ok(youtubeScore(500, '2026-10-20T09:00:00Z', now) < viral)
})

test('normalizeUrl ตัด utm/fbclid/fragment และ www', () => {
  assert.equal(normalizeUrl('https://www.prachachat.net/real-estate/news-1?utm_source=fb&fbclid=abc#top'), 'https://prachachat.net/real-estate/news-1')
  assert.equal(normalizeUrl('https://pantip.com/topic/123?page=2'), 'https://pantip.com/topic/123?page=2')
  assert.equal(normalizeUrl('ไม่ใช่ url'), 'ไม่ใช่ url')
})

test('eventKey รวมข่าวเหตุการณ์เดียวกันจากหลายสำนัก', () => {
  const now = new Date('2026-10-28T12:00:00Z')
  const a = eventKey({ subtype: 'rate', publishedAt: '2026-10-28T03:00:00Z', title: 'กนง. คงดอกเบี้ย', policyHits: ['ดอกเบี้ยนโยบาย', 'กนง.'] }, now)
  const b = eventKey({ subtype: 'rate', publishedAt: '2026-10-28T09:00:00Z', title: 'มติ กนง. 5/2569', policyHits: ['กนง.', 'ดอกเบี้ยนโยบาย'] }, now)
  assert.equal(a, b)
  assert.equal(a, 'rate:2026-10-28', 'subtype นโยบายใช้แค่วัน')
  // มาตรการเดียว แต่สำนักหนึ่งพาดหัว LTV อีกสำนักพาดหัวค่าโอน → ต้องเป็นเหตุการณ์เดียว
  const f1 = eventKey({ subtype: 'fee_measure', publishedAt: '2026-10-29', title: 'x', policyHits: ['LTV'] }, now)
  const f2 = eventKey({ subtype: 'fee_measure', publishedAt: '2026-10-29', title: 'y', policyHits: ['ค่าโอน', 'จดจำนอง'] }, now)
  assert.equal(f1, f2)
  const c = eventKey({ subtype: 'market', publishedAt: '2026-10-28', title: 'บ้านมือสอง ชลบุรี ล้นตลาด และ ราคาตก' }, now)
  assert.equal(c, 'market:2026-10-28:บ้านมือสอง+ชลบุรี+ล้นตลาด+ราคาตก')
  const d = eventKey({ subtype: 'credit_market', publishedAt: '2026-10-28', title: 'ธอส. ออกสินเชื่อ', policyHits: ['ภาษีที่ดิน'] }, now)
  assert.equal(d, 'credit_market:2026-10-28:ภาษีที่ดิน')
})

test('sourceDropped ตัดสำนักอักษรจีน/ญี่ปุ่น/เกาหลีด้วย', () => {
  assert.equal(sourceDropped('재경일보'), true)
  assert.equal(sourceDropped('日本経済新聞'), true)
  assert.equal(sourceDropped('Bangkok Post'), false)
})

test('isoWeek', () => {
  assert.equal(isoWeek(new Date('2026-11-02T00:00:00Z')), '2026-W45')
  assert.equal(isoWeek(new Date('2027-01-01T00:00:00Z')), '2026-W53')
})

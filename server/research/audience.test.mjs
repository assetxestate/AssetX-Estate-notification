// กลุ่มคนอ่านของเพจ (audience.js) — เจ้าของเลือก 9 พ.ย. 2569: เจ้าของทรัพย์ที่ต้องการเงิน (A) อย่างเดียว · โพสต์ละกลุ่มเดียว
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pageAudience, targetAudience, fitsPageAudience, pageServices, businessLine, readerRuleLines, lenderViewHit } from './audience.js'
import { parseDraft, generateDrafts } from './drafts.js'

const brand = JSON.parse(readFileSync(new URL('../../research/brand_facts.json', import.meta.url), 'utf8'))

test('แบรนด์จริง: เพจพูดกับกลุ่ม A อย่างเดียว · บริการที่โพสต์พูดถึง = ขายฝาก/จำนอง (ไม่มีฝากขาย/หาซื้อ)', () => {
  assert.deepEqual(pageAudience(brand), ['A'])
  assert.deepEqual(pageServices(brand), ['ขายฝาก', 'จำนอง', 'ประเมินราคาเบื้องต้น'])
  assert.equal(businessLine(brand), 'ธุรกิจขายฝาก/จำนองในไทย')
})

test('pageAudience / targetAudience / fitsPageAudience: กลุ่มเดียวเสมอ · ไม่ระบุ = A · ป้ายกลุ่มอื่นล้วนไม่เข้าเพจ', () => {
  assert.deepEqual(pageAudience({}), ['A'])
  assert.deepEqual(pageAudience({ page_audience: [] }), ['A'])
  assert.deepEqual(pageAudience({ page_audience: ['A', 'C'] }), ['A', 'C'])
  assert.equal(targetAudience({ audience: ['B', 'A'] }, brand), 'A')
  assert.equal(targetAudience({ audience: null }, brand), 'A')
  assert.equal(targetAudience({ audience: ['C', 'D'] }, brand), 'A', 'ป้ายไม่มีกลุ่มของเพจ = กลุ่มแรกของเพจ')
  assert.equal(targetAudience({ audience: ['C', 'A'] }, { page_audience: ['A', 'C'] }), 'C', 'เพจหลายกลุ่ม: ยึดกลุ่มแรกของไอเดียที่เพจพูดด้วย')
  assert.equal(fitsPageAudience(null, brand), true, 'ไม่ติดป้าย = เรื่องทั่วไป')
  assert.equal(fitsPageAudience([], brand), true)
  assert.equal(fitsPageAudience(['A', 'D'], brand), true)
  assert.equal(fitsPageAudience(['B', 'C', 'D'], brand), false)
  assert.equal(fitsPageAudience(['C', 'D'], { page_audience: ['A', 'C'] }), true)
  assert.equal(pageServices({ services: ['ขายฝาก', 'ฝากขาย'] }).length, 2, 'ไม่ระบุ page_services = ทุกบริการ')
  assert.match(businessLine({ page_audience: ['A', 'C'] }), /นายหน้า/)
  assert.match(readerRuleLines('A').join('\n'), /ห้ามเขียนจากมุมคนปล่อยเงิน/)
  assert.match(readerRuleLines('B').join('\n'), /คนเดียวตลอดโพสต์/)
})

test('lenderViewHit: จับวลีมุมคนปล่อยเงินจากร่างจริง #27 · ไม่จับคำเตือนภัยฝั่งเจ้าของทรัพย์ · กลุ่มอื่นไม่ตรวจ', () => {
  assert.equal(lenderViewHit('หากผู้ขายฝากเป็นบุคคลธรรมดา ต้องพิจารณากฎหมายคุ้มครอง', 'A'), 'หากผู้ขายฝากเป็น')
  assert.equal(lenderViewHit('3. ราคาที่รองรับทำเล: เทียบราคาที่ใช้เจรจา', 'A'), 'ราคาที่รองรับ')
  assert.equal(lenderViewHit('ตั้งวงเงินตาม LTV ที่ปลอดภัย', 'A'), 'LTV')
  assert.equal(lenderViewHit('ก่อนรับซื้อฝากต้องตรวจสอบผู้ขายฝากให้ดี', 'A'), 'ตรวจสอบผู้ขายฝาก')
  assert.equal(lenderViewHit('ถ้าผู้จำนองมีหนี้หลายทาง ความเสี่ยงสูง', 'A'), 'ถ้าผู้จำนองมี')
  // ฝั่งเจ้าของทรัพย์: เตือนภัยนายทุน/ปล่อยกู้นอกระบบ · สิทธิ์ของผู้ขายฝาก · หน้าที่ของผู้รับซื้อฝาก → ไม่จับ
  for (const ok of [
    'ถ้านายทุนไม่ยอมไปจดทะเบียนที่สำนักงานที่ดิน ให้หยุดก่อน',
    'ระวังคนปล่อยกู้นอกระบบที่ขอโฉนดไปเก็บ',
    'ผู้ขายฝากมีสิทธิไถ่คืนภายในกำหนดเวลาในสัญญา',
    'ผู้รับซื้อฝากต้องแจ้งเตือนก่อนครบกำหนดไถ่ตามที่กฎหมายกำหนด',
    'ถ้าที่ดินของคุณติดจำนองธนาคารอยู่ ให้แจ้งยอดหนี้เดิมให้ครบตั้งแต่แรก',
    'นักลงทุนที่ดีจะให้คุณอ่านสัญญาก่อนเซ็น',
  ]) assert.equal(lenderViewHit(ok, 'A'), '', ok)
  assert.equal(lenderViewHit('หากผู้ขายฝากเป็นบุคคลธรรมดา', 'B'), '', 'โพสต์ของกลุ่มอื่นไม่ตรวจ')
  assert.equal(lenderViewHit('หากผู้ขายฝากเป็นบุคคลธรรมดา', undefined), '')
})

const body = (lead) => [
  lead,
  'ประเด็นแรก ตรวจเอกสารสิทธิ์และภาระผูกพันกับสำนักงานที่ดินก่อนตกลงอะไรทั้งสิ้น เพราะเงื่อนไขที่คุยกันทางแชตไม่ผูกพันเท่าสิ่งที่จดทะเบียน',
  'ประเด็นที่สอง แยกค่าใช้จ่ายรวมออกเป็นรายการ ค่าธรรมเนียม ภาษี และค่าบริการ แล้วขอสรุปเป็นลายลักษณ์อักษร',
  'ประเด็นที่สาม สิทธิไถ่ถอนและกำหนดเวลาต้องอยู่ในสัญญา ไม่ใช่คำพูด',
  'ข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี',
  'ทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้ ปิดข้อมูลส่วนบุคคลได้',
].join('\n\n')

test('parseDraft: โพสต์ของกลุ่ม A ที่เขียนจากมุมคนปล่อยเงิน → ไม่ผ่าน พร้อมเหตุผล · ร่างเดียวกันของกลุ่มอื่นไม่ติดด่านนี้', () => {
  const lender = { headline: 'ขายฝากลดความเสี่ยง', caption: body('ขายฝากที่ดินต้องตรวจอะไร หากผู้ขายฝากเป็นบุคคลธรรมดา ต้องดูกฎหมายคุ้มครองด้วย') }
  const bad = parseDraft(lender, { brand, audience: ['A'] })
  assert.equal(bad.ok, false)
  assert.match(bad.error, /มุมคนปล่อยเงิน \("หากผู้ขายฝากเป็น"\)[\s\S]*เจ้าของทรัพย์ที่ต้องการเงิน/)
  const other = parseDraft(lender, { brand, audience: ['B'] })
  assert.doesNotMatch(String(other.error || ''), /มุมคนปล่อยเงิน/)
  const owner = parseDraft({ headline: 'ขายฝากลดความเสี่ยง', caption: body('ขายฝากที่ดินของคุณต้องตรวจอะไรก่อนเซ็น เพื่อไม่เสียสิทธิไถ่คืน') }, { brand, audience: ['A'] })
  assert.equal(owner.ok, true, owner.error)
})

test('generateDrafts: ร่างบันทึกกลุ่มคนอ่าน (audience = A) · ร่างมุมคนปล่อยเงินถูกส่งกลับให้เขียนใหม่พร้อมเหตุผล', async () => {
  const prompts = []
  let calls = 0
  const ask = async ({ prompt }) => {
    prompts.push(prompt)
    calls += 1
    if (calls === 1) return { ok: true, provider: 'codex', data: { headline: 'ราคาที่รองรับ', caption: body('ราคาที่รองรับทำเลคือสิ่งแรกที่ต้องดูก่อนรับซื้อฝาก') } }
    return { ok: true, provider: 'codex', data: { headline: 'ก่อนเซ็นขายฝาก', caption: body('ก่อนเซ็นขายฝากที่ดินของคุณ มีสามเรื่องที่ต้องเห็นเป็นตัวหนังสือ') } }
  }
  const saved = []
  const idea = { id: 33, source: 'social', source_label: 'Facebook · เพจหนึ่ง', subtype: 'social_fb', title: 'ขายฝากคืออะไร', summary: '“ขายฝากคืออะไร ข้อดีข้อเสีย ในคลิปนี้มีคำตอบ ต้องรู้ก่อนตัดสินใจ”', audience: null, angles: [{ label: 'วิธีป้องกันความเสี่ยง', brief: 'b' }] }
  const result = await generateDrafts({ ideas: [idea], brand, ask, onSave: async (id, angles) => saved.push(angles), sleep: async () => {}, delayMs: 0, now: () => new Date('2026-11-09T10:00:00Z') })
  assert.equal(calls, 2)
  assert.match(prompts[1], /เขียนจากมุมคนปล่อยเงิน \("ราคาที่รองรับ"\)/)
  assert.deepEqual(result.done, [{ id: 33, drafts: 1 }])
  assert.equal(saved.at(-1)[0].draft.audience, 'A')
  assert.match(prompts[0], /คนอ่านของโพสต์นี้ \(กลุ่มเดียว[^\n]*\):\n- A:/)
})

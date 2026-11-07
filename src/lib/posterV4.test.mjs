import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCompactPosterPrompt, canvasMapV4, clausesOf, describeInputImages, extractPosterCopyV4, fillImagePlaceholders, pickBandChips, splitChecklist, verbatimMissesV4 } from './posterV4.js'
import { cropPlan } from './posterSizes.js'

const POST4 = {
  title: 'ขายฝาก เช็กเงื่อนไขก่อนตัดสินใจ',
  caption: [
    'สินไถ่และค่าใช้จ่าย ควรถามให้ชัดก่อนทำสัญญา',
    '',
    'ก่อนทำขายฝากหรือเตรียมไถ่ถอน ควรตรวจสัญญาจริงและวางแผนค่าใช้จ่ายให้ชัดเจน',
    '',
    '1. ตรวจวันครบกำหนดและเงื่อนไขการไถ่ถอนในสัญญา',
    'เริ่มจากทำตารางวันที่สำคัญและรายการที่ต้องตรวจจากสัญญา เก็บสำเนาเอกสารไว้เทียบกับข้อมูลที่ได้รับทางแชต หากวันที่หรือเงื่อนไขไม่ตรงกัน ควรถามให้ชัดก่อนลงนาม ไม่ควรรอให้ใกล้ครบกำหนดจึงเริ่มวางแผน',
    '',
    '2. ตรวจยอดสินไถ่และค่าใช้จ่ายพร้อมเอกสารประกอบ',
    'แยกจำนวนเงินที่ได้รับจริง ยอดสินไถ่ และค่าใช้จ่ายแต่ละรายการออกจากกัน พร้อมระบุว่าใครเป็นผู้รับผิดชอบและใช้เอกสารใดยืนยัน อย่าพิจารณาเฉพาะวงเงินที่เสนอ เพราะเงินที่ต้องเตรียมในแต่ละช่วงอาจต่างกัน หากมีตัวเลขหลายชุด ให้ขอสรุปเป็นลายลักษณ์อักษร',
    '',
    '3. สอบถามขั้นตอนและเอกสารที่ต้องใช้กับสำนักงานที่ดินหรือผู้เชี่ยวชาญ',
    'เตรียมข้อมูลทรัพย์ สำเนาสัญญาที่มี และรายการคำถามไปตรวจสอบกับผู้เชี่ยวชาญหรือสำนักงานที่ดิน ก่อนส่งเอกสารทางออนไลน์ควรปิดข้อมูลส่วนบุคคลที่ไม่จำเป็น และสอบถามว่าต้องใช้เอกสารใดเพิ่มเติมในกรณีของตน อย่าอาศัยรายการเอกสารของคนอื่นเป็นข้อสรุปว่าครบแล้ว',
    '',
    'ก่อนคุยกับผู้ให้บริการ: จดสิ่งที่รู้แล้ว สิ่งที่ยังไม่ชัด และหลักฐานที่ต้องขอเพิ่ม จะช่วยให้ถามได้ตรงจุดและเปรียบเทียบข้อมูลได้ง่ายขึ้น',
    '',
    'ข้อมูลนี้เป็นความรู้ทั่วไป ต้องตรวจเอกสารและข้อเท็จจริงของแต่ละกรณีก่อนตัดสินใจ',
    '',
    'สอบถามข้อมูลเบื้องต้นกับ บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด ทางแชตได้',
  ].join('\n'),
}

test('clausesOf / splitChecklist / pickBandChips: ตัดประโยคย่อยตามคำขึ้นต้น · แตกเช็กลิสต์ · ชิปจากคำนามในโพสต์', () => {
  const clauses = clausesOf('เริ่มจากทำตาราง หากวันที่ไม่ตรงกัน ควรถามให้ชัด ไม่ควรรอให้ใกล้ครบกำหนด หากมีตัวเลขหลายชุด ให้ขอสรุปเป็นลายลักษณ์อักษร')
  assert.deepEqual(clauses, ['เริ่มจากทำตาราง', 'หากวันที่ไม่ตรงกัน', 'ควรถามให้ชัด', 'ไม่ควรรอให้ใกล้ครบกำหนด', 'หากมีตัวเลขหลายชุด ให้ขอสรุปเป็นลายลักษณ์อักษร'])
  assert.deepEqual(splitChecklist('จดสิ่งที่รู้แล้ว สิ่งที่ยังไม่ชัด และหลักฐานที่ต้องขอเพิ่ม'), ['จดสิ่งที่รู้แล้ว', 'สิ่งที่ยังไม่ชัด', 'หลักฐานที่ต้องขอเพิ่ม'])
  assert.deepEqual(splitChecklist('ขอสรุปค่าใช้จ่ายเป็นลายลักษณ์อักษร'), ['ขอสรุปค่าใช้จ่ายเป็นลายลักษณ์อักษร'])
  assert.deepEqual(pickBandChips(POST4.caption, { rowTitles: ['ตรวจวันครบกำหนดและเงื่อนไขการไถ่ถอนในสัญญา', 'ตรวจยอดสินไถ่และค่าใช้จ่ายพร้อมเอกสารประกอบ', 'สอบถามขั้นตอนและเอกสารที่ต้องใช้กับสำนักงานที่ดินหรือผู้เชี่ยวชาญ'] }), ['วันครบกำหนด', 'เอกสารประกอบ', 'สำนักงานที่ดิน'], 'หัวข้อแถวละ 1 คำ (ยาวสุด) · สินไถ่ ถูกครอบด้วย ยอดสินไถ่')
  assert.deepEqual(pickBandChips('ค่าใช้จ่ายและสัญญา', { max: 3 }), ['ค่าใช้จ่าย', 'สัญญา'], 'ไม่มีหัวข้อแถว = เติมตามความยาว')
})

test('extractPosterCopyV4 (โพสต์ #4): ริบบิ้นเต็มประโยคแรก · การ์ดคู่ · แถบเตือน · กล่องคำพูด · ชิป 3 · ติดต่อ · ทุกสตริงมาจากโพสต์', () => {
  const copy = extractPosterCopyV4(POST4)
  assert.equal(copy.keyWord, 'ขายฝาก')
  assert.equal(copy.ribbon, 'สินไถ่และค่าใช้จ่าย ควรถามให้ชัดก่อนทำสัญญา')
  assert.equal(copy.cardTitle, 'รายการที่ต้องตรวจ')
  assert.equal(copy.rows.length, 3)
  assert.deepEqual(copy.rows.map((r) => r.icon), ['calendar', 'coins', 'map pin'])
  assert.equal(copy.leftTitle, 'ก่อนคุยกับผู้ให้บริการ')
  assert.deepEqual(copy.leftItems, ['จดสิ่งที่รู้แล้ว', 'สิ่งที่ยังไม่ชัด', 'หลักฐานที่ต้องขอเพิ่ม'])
  assert.equal(copy.rightTitle, 'ก่อนลงนาม')
  assert.deepEqual(copy.rightItems, ['อย่าพิจารณาเฉพาะวงเงินที่เสนอ', 'อย่าอาศัยรายการเอกสารของคนอื่นเป็นข้อสรุปว่าครบแล้ว', 'ไม่ควรรอให้ใกล้ครบกำหนดจึงเริ่มวางแผน'])
  assert.equal(copy.strip, 'ก่อนส่งเอกสารทางออนไลน์ควรปิดข้อมูลส่วนบุคคลที่ไม่จำเป็น')
  assert.equal(copy.bubble, 'หากมีตัวเลขหลายชุด ให้ขอสรุปเป็นลายลักษณ์อักษร')
  assert.deepEqual(copy.bandChips, ['วันครบกำหนด', 'เอกสารประกอบ', 'สำนักงานที่ดิน'])
  assert.deepEqual(copy.contact, { phone: '096-986-8888', line: 'assetxestate', cta: 'ติดต่อ AssetX Estate' })
  assert.deepEqual(verbatimMissesV4(copy, POST4), [])
})

test('โพสต์สั้นไม่มีข้อห้าม: การ์ดคู่ย่อเป็นแผงเช็กลิสต์กว้าง ไม่มีกล่องคำพูด ไม่แต่งคำ', () => {
  const short = { title: 'ข้อควรรู้ก่อนซื้อที่ดินเปล่า', caption: 'ก่อนตัดสินใจซื้อ ควรตรวจข้อมูลให้ครบก่อน\n\n1. ตรวจเอกสารสิทธิ์และภาระผูกพันกับหน่วยงานที่เกี่ยวข้อง\n\n2. ตรวจทำเล สภาพจริง สิทธิทางเข้าออก และข้อจำกัดการใช้ประโยชน์\n\n3. เปรียบเทียบราคาและรวมค่าใช้จ่ายก่อนตัดสินใจ\n\nอย่าดูเฉพาะภาพสวยหรือราคาที่เสนอ ต้องตรวจเอกสารและข้อเท็จจริงของแต่ละกรณีก่อนตัดสินใจ' }
  const copy = extractPosterCopyV4(short)
  assert.equal(copy.rows.length, 3)
  assert.ok(copy.rightItems.length <= 1, 'ข้อห้ามข้อเดียว = ไม่พอทำการ์ดคู่')
  assert.deepEqual(verbatimMissesV4(copy, short), [])
  const prompt = buildCompactPosterPrompt({ ...short, size: 'feed-4x5', layout: 'steps' })
  assert.match(prompt, /Wide checklist panel|Warning chip|Main card/)
  assert.doesNotMatch(prompt, /Right card of the pair/)
})

test('buildCompactPosterPrompt (ฟีด 4:5): PASS-THROUGH · แถบดำ 166/1370 · ที่ว่างสำหรับภาพแนบ · ติดต่อบริษัท · โครงอ่านได้ด้วยเครื่อง', () => {
  const prompt = buildCompactPosterPrompt({ ...POST4, size: 'feed-4x5', layout: 'steps' })
  assert.match(prompt, /^PASS-THROUGH RULE: call image_gen/)
  assert.match(prompt, /y 0-186 and y 1350-1536 are two solid flat BLACK #000000 bars/, 'แถบดำ = ส่วนที่ตัด 128 + เผื่อ 45%')
  assert.match(prompt, /speech bubble \(if any\) entirely inside y 209-419/)
  assert.match(prompt, /bottom band y 1199-1350[^\n]*ending above y 1309/)
  assert.match(prompt, /card layout: steps/)
  assert.match(prompt, /Input images: \{\{INPUT_IMAGES\}\}/)
  assert.match(prompt, /Presenter \(mandatory, the focal point\): \{\{PRESENTER\}\}/)
  assert.match(prompt, /key word "ขายฝาก" in sunshine yellow/)
  assert.match(prompt, /Ribbon[^\n]*"สินไถ่และค่าใช้จ่าย ควรถามให้ชัดก่อนทำสัญญา"/)
  assert.match(prompt, /row 1 \(calendar icon\): "ตรวจวันครบกำหนดและเงื่อนไขการไถ่ถอนในสัญญา" \/ "เริ่มจากทำตารางวันที่สำคัญและรายการที่ต้องตรวจจากสัญญา"/)
  assert.match(prompt, /Left card of the pair[^\n]*"ก่อนคุยกับผู้ให้บริการ"[^\n]*"จดสิ่งที่รู้แล้ว" \/ "สิ่งที่ยังไม่ชัด" \/ "หลักฐานที่ต้องขอเพิ่ม"/)
  assert.match(prompt, /Right card of the pair[^\n]*"ก่อนลงนาม"/)
  assert.match(prompt, /"โทร 096-986-8888"[^\n]*"LINE: assetxestate"[^\n]*calendar "วันครบกำหนด"[^\n]*"สำนักงานที่ดิน"/)
  assert.match(prompt, /any phone number or LINE id other than the two given above/)
  assert.match(prompt, /\nLAYOUT: steps$/)
  assert.doesNotMatch(prompt, /CREATIVE BRIEF|LETTERBOX BARS/)
  // ขนาดที่ไม่ครอปบน-ล่าง: บอกโซนเป็น % · Story 9:16 มีแถบดำซ้าย-ขวา
  assert.match(canvasMapV4(cropPlan('square-1x1')), /zones as % of the height[^\n]*bottom band 87%-100%/)
  assert.match(canvasMapV4(cropPlan('story-9x16')), /left \d+ px and right \d+ px of the canvas are solid flat BLACK/)
})

test('describeInputImages / fillImagePlaceholders: นับลำดับภาพตามที่แนบจริง · ไม่มีรูปผู้แนะนำ = ชายทั่วไป', () => {
  assert.match(describeInputImages({ logo: true, presenter: true, refs: 3 }), /^Image 1 = the official AssetX Estate logo[^]*Image 2 = IDENTITY REFERENCE[^]*Images 3, 4 and 5 = STYLE REFERENCES/)
  assert.match(describeInputImages({ logo: true, presenter: false, refs: 1 }), /Image 1 = the official[^]*Image 2 = STYLE REFERENCES/)
  assert.match(describeInputImages({ logo: false, presenter: false, refs: 0 }), /none attached/)
  const filled = fillImagePlaceholders('Input images: {{INPUT_IMAGES}}\nPresenter (mandatory, the focal point): {{PRESENTER}}', { logo: true, presenter: false, refs: 2 })
  assert.doesNotMatch(filled, /\{\{/)
  assert.match(filled, /generic Thai man advisor/)
  assert.match(fillImagePlaceholders('{{PRESENTER}}', { presenter: true }), /the man from the identity reference image/)
})

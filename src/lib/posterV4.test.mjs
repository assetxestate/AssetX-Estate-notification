import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCompactPosterPrompt, canvasMapV4, clausesOf, describeInputImages, extractPosterCopyV4, fillImagePlaceholders, pickBandChips, splitChecklist, verbatimMissesV4, zoneLabels, ZONE_LABELS } from './posterV4.js'
import { cropPlan } from './posterSizes.js'
import { pickPosterVariant, posterSeed, parseVariantLine, sceneTopic, COMPOSITIONS, PALETTES } from './posterVariants.js'

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
  assert.deepEqual(copy.bandChips, [], 'ชิปแถบล่างเลิกใช้ (เจ้าของ 11 พ.ย. 2569: ดูแล้วไม่รู้ว่าหมายถึงอะไร)')
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
  // แถบล่าง = เบอร์/LINE + บริการของบริษัท (เจ้าของสั่ง 11 พ.ย. 2569 แทนชิปคำนามจากโพสต์)
  assert.match(prompt, /- Bottom band[^\n]*"โทร 096-986-8888"[^\n]*"LINE: assetxestate"; right 3 small white chips[^\n]*"รับขายฝาก"[^\n]*"รับจำนอง"[^\n]*"ประเมินมูลค่า"\. The digits/)
  assert.doesNotMatch(prompt, /"วันครบกำหนด", |"เอกสารประกอบ"|map pin "สำนักงานที่ดิน"/)
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
  assert.match(describeInputImages({ logo: true, presenter: true, refs: 2, refsMode: 'finish' }), /STYLE REFERENCES for finish only[^]*NOT their composition/)
})

test('ชุดสไตล์: seed=null คือชุดแรกทุกมิติ (หน้าตา v4 เดิม) · seed ต่างกันได้ชุดต่างกัน · posterSeed กำหนดได้และเปลี่ยนตามลำดับงาน · ฉากตามหัวข้อ', () => {
  const base = pickPosterVariant({ layout: 'steps', seed: null, text: POST4.caption })
  assert.equal(base.id, 'presenter-right/sun-coral/extrude-3d/point/sparkle-arrow/white-pill/photo-composite/desk-1')
  const seeds = Array.from({ length: 8 }, (_, i) => posterSeed({ contentNo: 20, jobIndex: i }))
  const ids = new Set(seeds.map((seed) => pickPosterVariant({ layout: 'steps', seed, text: POST4.caption }).id))
  assert.ok(ids.size >= 7, `8 งานของโพสต์เดียวกันควรได้ชุดต่างกันเกือบทั้งหมด (ได้ ${ids.size})`)
  assert.ok(new Set([...ids].map((id) => id.split('/')[0])).size >= 3, 'ควรหมุนการจัดวางหลายแบบ')
  assert.ok(new Set([...ids].map((id) => id.split('/')[1])).size >= 3, 'ควรหมุนชุดสีหลายชุด')
  assert.notEqual(seeds[0], seeds[1])
  assert.notEqual(posterSeed({ contentNo: 20, jobIndex: 0 }), posterSeed({ contentNo: 4, jobIndex: 0 }))
  assert.equal(posterSeed({ contentNo: 20, jobIndex: 0 }), seeds[0], 'กำหนดได้ ไม่สุ่ม')
  assert.ok(posterSeed({ postKey: 'draft-abc' }) >= 0, 'ไม่มีเลขโพสต์ใช้ hash ของ post_key')
  for (const layout of ['steps', 'checklist', 'qa', 'compare', 'warning', 'explain']) assert.ok(Object.keys(COMPOSITIONS).includes(pickPosterVariant({ layout, seed: 5 }).compositionId), layout)
  assert.equal(sceneTopic(POST4.caption), 'office', 'สำนักงานที่ดิน/ไถ่ถอน → ฉากสำนักงาน ("งาน" ในคำว่าสำนักงานไม่ใช่ไร่-งาน)')
  assert.equal(sceneTopic('ข้อควรรู้ก่อนซื้อที่ดินเปล่า 2 ไร่'), 'land')
  assert.equal(sceneTopic('เอาคอนโดไปจำนอง'), 'condo')
  assert.equal(pickPosterVariant({ layout: 'steps', seed: 9, text: POST4.caption }).scene.topic, 'office')
  assert.deepEqual(parseVariantLine('x\nVARIANT: seed=77 set=a/b refs=finish\nLAYOUT: qa'), { seed: 77, set: 'a/b', refsMode: 'finish' })
  assert.deepEqual(parseVariantLine('no line'), { seed: 0, set: '', refsMode: 'layout' })
})

test('buildCompactPosterPrompt กับชุดสไตล์: แถบดำ/แถบล่างคงที่ทุกการจัดวาง · โซนตามการจัดวาง · สีตามชุด · VARIANT ก่อน LAYOUT · โลโก้ย้ายมุมเมื่อผู้แนะนำอยู่ซ้าย', () => {
  const withComposition = (compositionId, seed = 11) => ({ ...pickPosterVariant({ layout: 'steps', seed, text: POST4.caption }), compositionId, composition: COMPOSITIONS[compositionId] })
  for (const compositionId of Object.keys(COMPOSITIONS)) {
    const prompt = buildCompactPosterPrompt({ ...POST4, size: 'feed-4x5', layout: 'steps', variant: withComposition(compositionId) })
    assert.match(prompt, /^PASS-THROUGH RULE/, compositionId)
    assert.match(prompt, /y 0-186 and y 1350-1536 are two solid flat BLACK #000000 bars/, compositionId)
    assert.match(prompt, /bottom band y 1199-1350 sitting directly on the black bar[^\n]*ending above y 1309/, compositionId)
    assert.match(prompt, /"โทร 096-986-8888"[^\n]*"LINE: assetxestate"/, compositionId)
    assert.match(prompt, /\nVARIANT: seed=11 set=\S+ refs=(layout|finish)\nLAYOUT: steps$/, compositionId)
    assert.doesNotMatch(prompt, /\{a1\}|\{a2\}|\{rest\}|undefined/, compositionId)
    assert.match(buildCompactPosterPrompt({ ...POST4, size: 'square-1x1', layout: 'steps', variant: withComposition(compositionId) }), /bottom band 87%-100% on the bottom edge/, compositionId)
  }
  const hero = buildCompactPosterPrompt({ ...POST4, size: 'feed-4x5', layout: 'steps', variant: withComposition('hero-scene') })
  assert.match(hero, /scene strip y \d+-\d+ full width/)
  assert.match(hero, /refs=finish/)
  assert.match(hero, /shown sharp inside the scene strip/)
  const left = buildCompactPosterPrompt({ ...POST4, size: 'feed-4x5', layout: 'steps', variant: withComposition('presenter-left') })
  assert.match(left, /logo chip top-right/)
  assert.match(left, /presenter cutout on the left 40%/)
  assert.match(fillImagePlaceholders(left, { logo: true, presenter: true, refs: 2, refsMode: 'layout' }), /white rounded chip in the top-right corner/)
  const steps = buildCompactPosterPrompt({ ...POST4, size: 'feed-4x5', layout: 'steps', variant: withComposition('numbered-steps') })
  assert.match(steps, /Steps card[^\n]*vertical dotted cyan line/)
  assert.match(steps, /row 1 \(number 1, small calendar icon after the title\): "ตรวจวันครบกำหนดและเงื่อนไขการไถ่ถอนในสัญญา"/)
  const lightSeed = Array.from({ length: 80 }, (_, i) => i).find((s) => pickPosterVariant({ layout: 'steps', seed: s }).paletteId === 'light-sun-coral')
  assert.ok(lightSeed !== undefined, 'ต้องมี seed ที่ได้ชุดพื้นสว่าง')
  const light = buildCompactPosterPrompt({ ...POST4, size: 'feed-4x5', layout: 'steps', seed: lightSeed })
  assert.match(light, /off-white #eef6fb background/)
  assert.match(light, /the rest of the headline [^\n]*solid navy/)
  assert.match(light, new RegExp(`VARIANT: seed=${lightSeed} `))
  const tangerine = { ...pickPosterVariant({ layout: 'steps', seed: 11 }), paletteId: 'tangerine-magenta', palette: PALETTES['tangerine-magenta'] }
  const orange = buildCompactPosterPrompt({ ...POST4, size: 'feed-4x5', layout: 'steps', variant: tangerine })
  assert.match(orange, /Left card of the pair \(tangerine orange header pill/)
  assert.match(orange, /Right card of the pair \(hot magenta header pill[^\n]*hot magenta exclamation circle/)
  // seed=null = คำสั่งเดิมทุกบรรทัดที่เทสต์ก่อนหน้าตรวจ (ผู้แนะนำขวา เหลือง/ชมพู นูน 3D)
  assert.match(buildCompactPosterPrompt({ ...POST4, size: 'feed-4x5', layout: 'steps' }), /VARIANT: seed=default set=presenter-right\/sun-coral\/extrude-3d\/point\/sparkle-arrow\/white-pill\/photo-composite\/desk-1 refs=layout/)
})

// เจอจริง #27 (9 พ.ย. 2569): โพสต์มีรายการตรวจ 4 ข้อ + บรรทัดสรุป 1 บรรทัด ไม่มีคู่ "ควรทำ/ควรหลีกเลี่ยง" แต่แผนที่แคนวาสยังจอง "two side-by-side cards"
// และคำสั่งบอก "what to do and what to avoid" → โมเดลแต่งการ์ดคู่ 8 ข้อเอง (ไม่อยู่ในโพสต์) · ต้องเปลี่ยนโซนนั้นเป็นแผงเดียว/ของที่ไม่มีตัวอักษร
const POST27 = {
  title: 'ขายฝากอย่างไรให้ลดความเสี่ยง',
  caption: [
    'ขายฝากที่ดินต้องตรวจเอกสารตรงไหน เพื่อลดความเสี่ยงต่อทรัพย์และสิทธิไถ่คืน',
    'เช็ก 4 จุดนี้ เพื่อแยกสิ่งที่เขียนไว้กับสิ่งที่ต้องตรวจให้ตรงกัน',
    '',
    '1. การใช้ทรัพย์จริง: ตรวจว่าขณะขายฝากใช้ที่ดินเพื่อเกษตรกรรมหรืออยู่อาศัยหรือไม่ หากผู้ขายฝากเป็นบุคคลธรรมดา ต้องพิจารณากฎหมายคุ้มครองการขายฝากที่เกี่ยวข้องด้วย',
    '',
    '2. กรรมสิทธิ์และภาระติดพัน: เปิดสารบัญจดทะเบียนด้านหลังเอกสารสิทธิ์ แล้วตรวจซ้ำที่สำนักงานที่ดินว่ามีจำนอง ขายฝาก หรือภาระจำยอมหรือไม่',
    '',
    '3. ราคาที่รองรับทำเล: เทียบราคาที่ใช้เจรจากับข้อมูลราคาซื้อขายจริงในทำเลเดียวกัน ไม่ยึดเพียงประกาศขายหรือราคาประเมินราชการ',
    '',
    '4. ข้อความและยอดค่าใช้จ่าย: ตรวจร่างสัญญาและสรุปค่าใช้จ่ายรวมเป็นลายลักษณ์อักษรให้เห็นว่าใครจ่ายรายการใด พร้อมตรวจสิทธิไถ่ถอนและกำหนดเวลาให้ชัด หากข้อความไม่ตรงกัน อาจเข้าใจภาระที่ต้องรับผิดชอบคลาดเคลื่อน',
    '',
    'ข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี ไม่ใช่คำแนะนำเฉพาะราย',
    '',
    'ส่งข้อมูลทรัพย์ในชลบุรีพร้อมรูปเอกสารสิทธิ์ทางแชต AssetX Estate โดยปิดข้อมูลส่วนบุคคลก่อน เพื่อให้ทีมประเมินเบื้องต้น',
  ].join('\n'),
}

test('โซนที่โพสต์ไม่มีข้อความ (#27): ไม่จองการ์ดคู่ · ไม่สั่ง "what to do and what to avoid" · ห้ามเติมการ์ด/ข้อความเอง', () => {
  const copy = extractPosterCopyV4(POST27)
  assert.ok(!(copy.leftItems.length >= 2 && copy.rightItems.length >= 2), 'โพสต์นี้ไม่มีคู่ควรทำ/ควรหลีกเลี่ยง')
  for (const layout of ['steps', 'checklist', 'warning']) {
    for (const seed of [null, 195810, 7, 42]) {
      const prompt = buildCompactPosterPrompt({ ...POST27, size: 'feed-4x5', layout, seed })
      const map = prompt.split('\n').find((l) => l.startsWith('Canvas map'))
      assert.doesNotMatch(map, /two side-by-side cards/, `${layout}/${seed}`)
      assert.match(map, copy.leftItems.length ? /one wide checklist panel/ : /photo band of the backdrop scene \(no text/)
      assert.doesNotMatch(prompt, /what to do and what to avoid/)
      assert.doesNotMatch(prompt, /Left card of the pair|Right card of the pair/)
      assert.match(prompt, /never add cards, lists, header pills or text that are not in the Text section/)
      assert.doesNotMatch(prompt, /the pair and the strip keep the zones/)
    }
  }
})

test('zoneLabels / canvasMapV4: บล็อกที่ไม่มีข้อความ = ของที่ไม่มีตัวอักษร · ค่าเดิมคงที่เมื่อมีครบ', () => {
  const plan = cropPlan('feed-4x5')
  const full = canvasMapV4(plan, null)
  assert.match(full, /two side-by-side cards[\s\S]*one wide callout strip/)
  assert.match(full, /brush ribbon/)
  const bare = canvasMapV4(plan, null, zoneLabels({ pair: false, panel: false, strip: false, ribbon: false }))
  assert.doesNotMatch(bare, /two side-by-side cards|one wide callout strip|brush ribbon y/)
  assert.match(bare, /photo band of the backdrop scene \(no text, no cards, no icons\)/)
  assert.match(bare, /thin cyan divider line \(no text\)/)
  assert.match(bare, /thin cyan brush-stroke accent \(no text\)/)
  assert.equal(zoneLabels().pair, ZONE_LABELS.pair)
  // ชุดที่มีคู่ครบ (โพสต์ #4 เดิม) ยังได้การ์ดคู่และคำสั่ง what to do/avoid ตามเดิม
  const withPair = buildCompactPosterPrompt({ ...POST4, size: 'feed-4x5', layout: 'steps' })
  assert.match(withPair, /two side-by-side cards/)
  assert.match(withPair, /what to do and what to avoid/)
})

// โพสต์แบบถาม-ตอบ (เคส #37 11 พ.ย. 2569): การ์ดหลักว่าง → โมเดลแต่งคำตอบเอง · คำถาม+คำตอบปนเป็นเช็กลิสต์ · แถบเตือนซ้ำคำตอบ · ป้ายหัวการ์ดว่าง
const QA_POST = {
  title: 'ติดภาระเดิม เริ่มคุยก่อนได้',
  caption: [
    'โฉนดติดจำนองหรือขายฝากเดิม ต้องปิดภาระก่อนคุยเรื่องเงินหมุนธุรกิจจริงไหม',
    '',
    '❓ ถาม: ต้องไปปิดของเดิมให้เรียบร้อยก่อนหรือเปล่า',
    '💡 ตอบ: เริ่มคุยเพื่อประเมินแนวทางก่อนได้ โดยแจ้งภาระเดิมให้ครบ ยังสรุปไม่ได้ว่าจะดำเนินการต่อได้หรือไม่ เพราะต้องดูเอกสารสิทธิ์และเงื่อนไขสัญญาเดิมของคุณ',
    '',
    '❓ ถาม: ต้องบอกเรื่องของเดิมแค่ไหน',
    '💡 ตอบ: แจ้งว่าติดจำนองหรือขายฝาก ยอดที่ต้องชำระ และกำหนดตามสัญญา พร้อมเปิดเผยภาระอื่นที่มี',
    '',
    'ถาม: ถ้ายังขายฝากอยู่ ต้องดูตรงไหนก่อน',
    '',
    'ตอบ: ตรวจสิทธิไถ่ถอนและกำหนดเวลาในสัญญาเดิมให้ชัด',
    '',
    '📌 ข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี',
    '',
    '👉 ทักแชต AssetX Estate พร้อมแจ้งภาระเดิมของทรัพย์',
    '',
    '#AssetXEstate #จำนอง',
  ].join('\n'),
}

test('โพสต์ถาม-ตอบ: คำถาม = หัวข้อแถว · คำตอบ = รายละเอียด (คำตอบขึ้นย่อหน้าใหม่ก็ได้) · ไม่มีเช็กลิสต์/แถบเตือนซ้ำ · ทุกสตริงมาจากโพสต์', () => {
  const copy = extractPosterCopyV4(QA_POST)
  assert.deepEqual(copy.rows.map((r) => r.title), ['ต้องไปปิดของเดิมให้เรียบร้อยก่อนหรือเปล่า', 'ต้องบอกเรื่องของเดิมแค่ไหน', 'ถ้ายังขายฝากอยู่ ต้องดูตรงไหนก่อน'])
  assert.ok(copy.rows.every((r) => r.qa && r.detail), 'ทุกแถวมีคำตอบ')
  assert.match(copy.rows[0].detail, /^เริ่มคุยเพื่อประเมินแนวทางก่อนได้/)
  assert.equal(copy.rows[2].detail, 'ตรวจสิทธิไถ่ถอนและกำหนดเวลาในสัญญาเดิมให้ชัด')
  assert.deepEqual(copy.leftItems, [])
  const all = [copy.ribbon, copy.strip, copy.bubble, ...copy.leftItems, ...copy.rightItems].filter(Boolean)
  assert.ok(all.every((s) => !/ถาม|ตอบ/.test(s)), 'ไม่มีคำว่า ถาม:/ตอบ: หลุดไปบล็อกอื่น')
  assert.ok(all.every((s) => !copy.rows.some((r) => r.detail && (s.includes(r.detail) || r.detail.includes(s)))), 'ไม่ซ้ำคำตอบในแถว')
  assert.deepEqual(verbatimMissesV4(copy, QA_POST), [])
})

test('คำสั่งภาพถาม-ตอบ: แถวคำถาม-คำตอบ · การ์ดไม่มีหัวข้อ = ไม่มีป้าย · บล็อกที่ไม่มีข้อความ = ภาพ/เส้น · แถบล่างไม่มีชิป', () => {
  const prompt = buildCompactPosterPrompt({ ...QA_POST, size: 'feed-4x5', layout: 'qa', seed: 22010 })
  assert.match(prompt, /3 question-and-answer rows, each with a pale-cyan question-mark icon circle/)
  assert.match(prompt, /row 1 \(question-mark icon\): "ต้องไปปิดของเดิมให้เรียบร้อยก่อนหรือเปล่า" \/ "เริ่มคุยเพื่อประเมินแนวทางก่อนได้/)
  assert.match(prompt, /no header pill and no title, only a cyan magnifier circle at its top-left\)/)
  assert.doesNotMatch(prompt, /with no title text|Wide checklist panel|Wide callout strip/)
  assert.match(prompt, /a full-width sharp photo band of the backdrop scene \(no text, no cards, no icons\)/)
  assert.match(prompt, /a card gets a header pill only when the Text section gives it a title/)
  assert.match(prompt, /right 3 small white chips, each a navy line icon above a short label: [^\n]*"รับขายฝาก", [^\n]*"รับจำนอง", [^\n]*"ประเมินมูลค่า"/)
  assert.doesNotMatch(prompt, /"สำนักงานที่ดิน"|"เอกสารสิทธิ์"|"ค่าใช้จ่าย"/, 'ไม่มีชิปคำนามจากโพสต์')
  // บริการเป็นข้อความบริษัท (แบบเดียวกับเบอร์/LINE) — ไม่ต้องมีในโพสต์ ไม่เข้าด่านคำต่อคำ
  const copy = extractPosterCopyV4(QA_POST)
  assert.deepEqual(copy.services.map((s) => s.label), ['รับขายฝาก', 'รับจำนอง', 'ประเมินมูลค่า'])
  assert.deepEqual(verbatimMissesV4(copy, QA_POST), [])
})

test('โพสต์ไม่มีข้อเลขหรือถาม-ตอบ: โซนการ์ดหลักเป็นแถบภาพ ไม่ใช่การ์ดว่างให้โมเดลแต่งข้อความ', () => {
  const plain = { title: 'ก่อนขายฝาก อ่านสัญญาให้ครบ', caption: 'ก่อนขายฝาก ควรอ่านสัญญาให้ครบทุกข้อ และถามเงื่อนไขที่ไม่เข้าใจก่อนลงนาม' }
  assert.equal(extractPosterCopyV4(plain).rows.length, 0)
  const prompt = buildCompactPosterPrompt({ ...plain, size: 'feed-4x5', layout: 'steps', seed: 3 })
  assert.doesNotMatch(prompt, / main card y \d+-\d+/)
  assert.match(prompt, /a full-width sharp photo band of the backdrop scene \(no text, no cards, no icons\) y \d+-\d+/)
  assert.equal(zoneLabels({ main: false }).main, zoneLabels({ pair: false }).pair)
  assert.equal(ZONE_LABELS.main, 'main card')
})

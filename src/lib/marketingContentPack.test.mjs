import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCarousel, buildContentPack, buildReelStoryboard, draftImagePrompt, isPackStale, packBasis, parseCaption, storyboardText } from './marketingContentPack.js'

// ข้อมูลสมมติทั้งหมด
const caption = [
  'ติดถนนใหญ่ไม่ได้แปลว่าเข้าออกได้เหมือนกันทุกแปลงครับ',
  '',
  'จากที่ไปดูหน้างาน หน้าแปลงติดทางคู่ขนาน ต้องอ้อมเข้า และไม่มีจุดกลับรถใกล้แปลง ส่วนแปลงข้างเคียงเข้าได้จากถนนหลักโดยตรง',
  '',
  'ราคาเสนอขายของแปลงใกล้เคียงอยู่ในระดับใกล้กัน แต่ผู้ประเมินมองสองแปลงนี้ต่างกันเพราะเส้นทางที่รถใช้จริง',
  '',
  'ลองเช็ก 3 เรื่องนี้',
  '1️⃣ รถเข้าจากถนนหลักได้โดยตรงไหม',
  '2️⃣ มีจุดกลับรถใกล้แปลงไหม',
  '3. เอกสารระบุสิทธิทางเข้าออกไว้อย่างไร',
  '',
  'สิทธิทางเข้าออกตามเอกสารยังต้องตรวจก่อนสรุป',
  '',
  'ที่มา: ประกาศขายออนไลน์ (ข้อมูล ณ วันที่ 20 พ.ย. 2569)',
  '',
  '👉 ไปยืนหน้าแปลงแล้วดูว่ารถเข้าออกจริงได้ทางไหน',
  '',
  '#AssetXEstate #ขายฝาก',
].join('\n')
const post = { title: 'ติดถนนใหญ่เหมือนกัน ทำไมมูลค่าต่างกัน', caption }
const claims = [{ id: 3, status: 'verified', claim_text: 'ราคาเสนอขายของแปลงใกล้เคียงอยู่ในระดับใกล้กัน', publishable_wording: '' }, { id: 4, status: 'needs_check', claim_text: 'ไม่มีจุดกลับรถใกล้แปลง' }]

test('แยกแคปชั่นตามหน้าที่: เปิด เนื้อหา ข้อในรายการ ข้อจำกัด ที่มา ชวนทำ · อีโมจิและแฮชแท็กไม่ติดมา', () => {
  const parts = parseCaption(caption)
  assert.equal(parts.hook, 'ติดถนนใหญ่ไม่ได้แปลว่าเข้าออกได้เหมือนกันทุกแปลงครับ')
  assert.deepEqual(parts.beats.map((beat) => beat.kind), ['paragraph', 'paragraph', 'paragraph', 'point', 'point', 'point'])
  assert.equal(parts.beats[3].text, 'รถเข้าจากถนนหลักได้โดยตรงไหม')
  assert.equal(parts.caveat, 'สิทธิทางเข้าออกตามเอกสารยังต้องตรวจก่อนสรุป')
  assert.match(parts.sources, /^ประกาศขายออนไลน์/)
  assert.equal(parts.cta, 'ไปยืนหน้าแปลงแล้วดูว่ารถเข้าออกจริงได้ทางไหน')
  assert.doesNotMatch(JSON.stringify(parts), /#AssetX|1️⃣|👉/)
})

test('AC-08: Reel 40 วินาที — เวลาต่อเนื่องไม่มีช่องว่าง มีภาพ คำบรรยาย ตัวหนังสือบนจอ ฉากข้อจำกัด และฉากชวนทำ', () => {
  const reel = buildReelStoryboard(post, { durationSec: 40, claims })
  assert.equal(reel.ok, true)
  assert.equal(reel.duration, 40)
  assert.equal(reel.scenes[0].start_sec, 0)
  assert.equal(reel.scenes.at(-1).end_sec, 40)
  reel.scenes.forEach((scene, index) => {
    if (index) assert.equal(scene.start_sec, reel.scenes[index - 1].end_sec, `ฉาก ${scene.no} ต้องเริ่มต่อจากฉากก่อน`)
    assert.ok(scene.end_sec > scene.start_sec)
    assert.ok(Number.isInteger(scene.start_sec) && Number.isInteger(scene.end_sec))
    for (const key of ['shot', 'narration', 'overlay']) assert.ok(scene[key] && scene[key].length >= 4, `ฉาก ${scene.no} ต้องมี ${key}`)
    assert.ok(scene.overlay.length <= 46, `ตัวหนังสือบนจอของฉาก ${scene.no} ต้องสั้น`)
  })
  assert.deepEqual([reel.scenes[0].role, reel.scenes.at(-2).role, reel.scenes.at(-1).role], ['hook', 'caveat', 'cta'])
  // ไม่ใช่แคปชั่นหั่น 4 ท่อน: มีฉากมากกว่า 4 และมีรายการของที่ต้องเตรียม
  assert.ok(reel.scenes.length >= 6)
  assert.ok(reel.prep.footage.length >= 1 && reel.prep.graphics.length >= 1)
  assert.match(reel.scenes.at(-2).narration, /ยังต้องตรวจ/)
  assert.match(reel.scenes.at(-1).narration, /ไปยืนหน้าแปลง/)
})

test('ฉากอ้างได้เฉพาะข้ออ้างที่ยืนยันแล้วและอยู่ในข้อความของฉากนั้น · ภาพหน้างานต้องมีสิทธิใช้ ไม่ใช้ภาพ AI แทน', () => {
  const reel = buildReelStoryboard(post, { durationSec: 60, claims })
  const all = reel.scenes.flatMap((scene) => scene.proof_source_ids)
  assert.deepEqual([...new Set(all)], [3])
  const priceScene = reel.scenes.find((scene) => scene.proof_source_ids.includes(3))
  assert.match(priceScene.narration, /ราคาเสนอขาย/)
  const field = reel.scenes.find((scene) => scene.need === 'footage')
  assert.match(field.shot, /ภาพจริงจากหน้างาน/)
  assert.match(field.shot, /มีสิทธิใช้/)
  assert.match(field.shot, /ภาพจำลอง/)
  assert.doesNotMatch(reel.scenes.map((scene) => scene.shot).join(' '), /ภาพโฉนดจริง|ภาพทรัพย์ของลูกค้า$/)
})

test('คำบรรยายมาจากข้อความของร่างเท่านั้น (ยกเว้นข้อความมาตรฐานของฉากข้อจำกัด/ชวนทำเมื่อร่างไม่มี)', () => {
  const reel = buildReelStoryboard(post, { durationSec: 60, claims })
  const source = caption.replace(/\s+/g, '')
  for (const scene of reel.scenes) {
    const text = scene.narration.replace(/…$/, '').replace(/\s+/g, '')
    assert.ok(source.includes(text), `คำบรรยายฉาก ${scene.no} ต้องอยู่ในร่าง: ${scene.narration}`)
  }
  const bare = buildReelStoryboard({ title: 'ขายฝากกับจำนองต่างกันอย่างไร', caption: 'ขายฝากกับจำนองต่างกันตรงกรรมสิทธิ์\n\nขายฝากกรรมสิทธิ์โอนไปตั้งแต่วันจดทะเบียน ส่วนจำนองกรรมสิทธิ์ยังอยู่กับเจ้าของ' })
  assert.equal(bare.ok, true)
  assert.equal(bare.scenes.at(-1).end_sec, 40)
  assert.ok(bare.warnings.some((item) => /ไม่มีฉากที่ต้องใช้ภาพหน้างาน/.test(item)))
  assert.ok(bare.warnings.some((item) => /ไม่มีประโยคข้อจำกัด/.test(item)))
})

test('ความยาว: จำกัด 30–60 วินาที · เวลาน้อยเนื้อหาเยอะ = ตัดส่วนท้ายพร้อมบอก · ร่างว่างสร้างไม่ได้', () => {
  assert.equal(buildReelStoryboard(post, { durationSec: 10 }).duration, 30)
  assert.equal(buildReelStoryboard(post, { durationSec: 300 }).duration, 60)
  const short = buildReelStoryboard(post, { durationSec: 30 })
  assert.equal(short.scenes.at(-1).end_sec, 30)
  assert.ok(short.warnings.some((item) => /ไม่พอเวลา 30 วินาที/.test(item)))
  assert.equal(buildReelStoryboard({ title: '', caption: '' }).ok, false)
  for (const d of [30, 37, 45, 60]) {
    const reel = buildReelStoryboard(post, { durationSec: d })
    assert.equal(reel.scenes.reduce((sum, scene) => sum + (scene.end_sec - scene.start_sec), 0), d)
  }
})

test('Carousel: ปก + หน้าเนื้อหา 5–7 หน้า + หน้าชวนทำ · เนื้อหาไม่พอไม่เติมหน้าเปล่า', () => {
  const carousel = buildCarousel(post, { claims })
  assert.equal(carousel.ok, true)
  assert.equal(carousel.slides[0].role, 'cover')
  assert.equal(carousel.slides.at(-1).role, 'cta')
  const content = carousel.slides.slice(1, -1)
  assert.ok(content.length >= 5 && content.length <= 7, `หน้าเนื้อหา ${content.length}`)
  assert.ok(content.some((slide) => slide.role === 'caveat'))
  assert.ok(content.some((slide) => /^ที่มา:/.test(slide.source_note)))
  assert.deepEqual(carousel.slides.map((slide) => slide.no), carousel.slides.map((_, index) => index + 1))
  const thin = buildCarousel({ title: 'หัวข้อ', caption: 'เปิดเรื่อง\n\nย่อหน้าเดียวของเนื้อหา' })
  assert.equal(thin.slides.length, 3)
  assert.ok(thin.warnings.some((item) => /น้อยกว่า 5 หน้า/.test(item)))
})

test('บรีฟภาพมาจากข้อความของร่าง และกันภาพที่ดูเป็นหลักฐาน', () => {
  const prompt = draftImagePrompt(post)
  assert.match(prompt, /ติดถนนใหญ่เหมือนกัน ทำไมมูลค่าต่างกัน/)
  assert.match(prompt, /not evidence/)
  assert.match(prompt, /Do not depict a specific real property, a real land title deed/)
})

test('แก้พาดหัวหรือแคปชั่นแล้วชุดเดิมล้าสมัย · ใส่หรือเอาอีโมจิออกไม่นับเป็นการแก้', () => {
  const { pack } = buildContentPack(post, { claims, now: new Date('2026-11-23T05:00:00Z') })
  const saved = { ...post, contentPack: pack }
  assert.equal(isPackStale(saved), false)
  assert.equal(isPackStale({ ...saved, caption: caption.replace('1️⃣', '1.').replace('👉 ', '') }), false)
  assert.equal(isPackStale({ ...saved, caption: `${caption}\n\nเพิ่มประโยคใหม่` }), true)
  assert.equal(isPackStale({ ...saved, title: 'พาดหัวใหม่' }), true)
  assert.equal(isPackStale(post), false)
  assert.equal(packBasis(post), packBasis({ ...post }))
  assert.match(storyboardText(pack.reel), /Storyboard 40 วินาที/)
  assert.match(storyboardText(pack.reel), /ภาพที่ต้องถ่าย\/หา:/)
})

test('splits a long paragraph into several scenes instead of one very long scene', () => {
  const two = { title: 'ติดถนนใหญ่เหมือนกัน ทำไมมูลค่าต่างกัน', caption: 'ที่ดินสองแปลงติดถนนใหญ่เส้นเดียวกัน แต่การเข้าออกจริงอาจต่างกันมาก\n\nจากที่ไปดูหน้างาน หน้าแปลงติดทางคู่ขนาน ต้องอ้อมเข้า และไม่มีจุดกลับรถใกล้แปลง รถที่มาจากอีกฝั่งจึงเข้าถึงได้ยากกว่าที่เห็นในแผนที่ ส่วนแปลงข้างเคียงเข้าได้จากถนนหลักโดยตรง ผู้ประเมินจึงมองสองแปลงนี้ต่างกัน\n\nเรื่องนี้ยังต้องตรวจก่อนเทียบกับแปลงอื่น' }
  const reel = buildReelStoryboard(two, { durationSec: 40 })
  const middle = reel.scenes.filter((scene) => ['explain', 'point'].includes(scene.role))
  assert.ok(middle.length >= 3, `middle scenes ${middle.length}`)
  assert.ok(middle.every((scene) => scene.end_sec - scene.start_sec <= 14), middle.map((scene) => scene.end_sec - scene.start_sec).join(','))
  assert.equal(reel.scenes.at(-1).end_sec, 40)
  const source = two.caption.replace(/\s+/g, '')
  for (const scene of middle) assert.ok(source.includes(scene.narration.replace(/…$/, '').replace(/\s+/g, '')))
})

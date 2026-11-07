import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFreePosterPrompt, describeFreeImages, fillFreeImages, freeDirection, freePoolStrings, freeTextPool, parseFreeModeLine, technicalFrame, FREE_DIRECTIONS, PLACEHOLDER_FREE_IMAGES } from './posterFree.js'
import { cropPlan } from './posterSizes.js'

const POST = {
  title: 'ขายฝาก เช็กเงื่อนไขก่อนตัดสินใจ',
  caption: [
    'ก่อนทำขายฝากหรือเตรียมไถ่ถอน ควรตรวจสัญญาจริงและวางแผนค่าใช้จ่ายให้ชัดเจน',
    '',
    '1. ตรวจวันครบกำหนดและเงื่อนไขการไถ่ถอนในสัญญา',
    'เริ่มจากทำตารางวันที่สำคัญและรายการที่ต้องตรวจจากสัญญา หากวันที่หรือเงื่อนไขไม่ตรงกัน ควรถามให้ชัดก่อนลงนาม ไม่ควรรอให้ใกล้ครบกำหนดจึงเริ่มวางแผน',
    '',
    '2. ตรวจยอดสินไถ่และค่าใช้จ่ายพร้อมเอกสารประกอบ',
    'แยกจำนวนเงินที่ได้รับจริง ยอดสินไถ่ และค่าใช้จ่ายแต่ละรายการออกจากกัน อย่าพิจารณาเฉพาะวงเงินที่เสนอ หากมีตัวเลขหลายชุด ให้ขอสรุปเป็นลายลักษณ์อักษร',
    '',
    '3. สอบถามขั้นตอนและเอกสารที่ต้องใช้กับสำนักงานที่ดินหรือผู้เชี่ยวชาญ',
    'เตรียมข้อมูลทรัพย์ สำเนาสัญญาที่มี และรายการคำถาม ก่อนส่งเอกสารทางออนไลน์ควรปิดข้อมูลส่วนบุคคลที่ไม่จำเป็น อย่าอาศัยรายการเอกสารของคนอื่นเป็นข้อสรุปว่าครบแล้ว',
    '',
    'ก่อนคุยกับผู้ให้บริการ: จดสิ่งที่รู้แล้ว สิ่งที่ยังไม่ชัด และหลักฐานที่ต้องขอเพิ่ม',
  ].join('\n'),
}

const squash = (s) => String(s).replace(/\s+/g, '')

test('โหมดอิสระ: บอก Codex ให้ออกแบบเอง (ไม่มี PASS-THROUGH ไม่มีแผนที่โซน ไม่มีกล่องคำพูด) · แถบดำกันครอปยังอยู่ · ติดต่อบริษัท · ที่ว่างภาพแนบ', () => {
  const prompt = buildFreePosterPrompt({ ...POST, size: 'feed-4x5', seed: 3 })
  assert.match(prompt, /^DESIGNER MODE: you are the art director/)
  assert.doesNotMatch(prompt, /PASS-THROUGH|Canvas map|Zones:|speech bubble|LAYOUT:/)
  assert.match(prompt, /y 0-186 and y 1350-1536 are two solid flat BLACK #000000 bars/, 'ตัวรับงานตัดแถบเมื่อเห็นคำนี้')
  assert.match(prompt, /"โทร 096-986-8888" and "LINE: assetxestate"/)
  assert.match(prompt, /Input images: \{\{FREE_IMAGES\}\}/)
  assert.match(prompt, /Brand brief \(guidance, not a template\)[^\n]*navy #08213f, cyan #42c7d8/)
  assert.match(prompt, new RegExp(`Optional starting direction for this run[^\\n]*${FREE_DIRECTIONS[3].text.slice(0, 20)}`))
  assert.match(prompt, /\nMODE: free seed=3 direction=split-screen$/)
  assert.doesNotMatch(prompt, /หากมีตัวเลขหลายชุด/, 'ไม่ใส่ประโยคกล่องคำพูด')
  assert.ok(prompt.length < 6000, `คำสั่งไม่ควรยาวเกิน (ได้ ${prompt.length})`)
})

test('คลังข้อความ: ทุกสตริงคัดจากโพสต์คำต่อคำ · มีหัวข้อ ข้อหลัก สิ่งที่ควรทำ สิ่งที่ควรเลี่ยง', () => {
  const pool = freeTextPool(POST)
  assert.equal(pool.headline, POST.title)
  assert.equal(pool.keyWord, 'ขายฝาก')
  assert.equal(pool.points.length, 3)
  assert.ok(pool.doItems.length >= 2)
  assert.ok(pool.avoidItems.length >= 2)
  const source = squash(`${POST.title}\n${POST.caption}`)
  for (const s of freePoolStrings(pool)) assert.ok(source.includes(squash(s)), `ไม่ได้มาจากโพสต์: ${s}`)
  const prompt = buildFreePosterPrompt({ ...POST, size: 'feed-4x5', seed: 1 })
  for (const s of freePoolStrings(pool)) assert.ok(prompt.includes(`"${s}"`), `คำสั่งขาดสตริง: ${s}`)
})

test('ขนาดอื่น · ทิศเริ่มต้นหมุนตาม seed · ไม่มี seed = เลือกเอง · โพสต์มีแต่หัวข้อยังสร้างได้', () => {
  assert.match(technicalFrame(cropPlan('story-9x16')), /left \d+ px and right \d+ px[^\n]*BLACK #000000 bars/)
  assert.match(technicalFrame(cropPlan('square-1x1')), /at least 4% away from every edge/)
  assert.doesNotMatch(technicalFrame(cropPlan('square-1x1')), /BLACK/)
  const ids = new Set(Array.from({ length: FREE_DIRECTIONS.length }, (_, i) => freeDirection(i).id))
  assert.equal(ids.size, FREE_DIRECTIONS.length)
  assert.equal(freeDirection(null), null)
  assert.match(buildFreePosterPrompt({ ...POST, size: 'feed-4x5' }), /Choose the concept freely\.[^]*MODE: free seed=none direction=none/)
  const bare = buildFreePosterPrompt({ title: 'ขายฝากต่างจากจำนองอย่างไร', caption: '', size: 'square-1x1', seed: 2 })
  assert.match(bare, /Headline \(required[^\n]*"ขายฝากต่างจากจำนองอย่างไร"/)
  assert.doesNotMatch(bare, /Key points/)
})

test('ภาพแนบโหมดอิสระ: โลโก้ + รูปเจ้าของ (ใช้หรือไม่ก็ได้) · ไม่มีเรฟ · อ่านบรรทัด MODE กลับได้', () => {
  assert.match(describeFreeImages({ logo: true, presenter: true }), /^Image 1 = the official AssetX Estate logo[^]*Image 2 = IDENTITY REFERENCE \(optional to use\)/)
  assert.doesNotMatch(describeFreeImages({ logo: true, presenter: true }), /STYLE REFERENCE/)
  assert.match(describeFreeImages({ logo: false, presenter: false }), /none attached/)
  const filled = fillFreeImages(`a\nInput images: ${PLACEHOLDER_FREE_IMAGES}\nb`, { logo: true, presenter: false })
  assert.doesNotMatch(filled, /\{\{/)
  assert.deepEqual(parseFreeModeLine('x\nMODE: free seed=42 direction=giant-type'), { seed: 42, direction: 'giant-type' })
  assert.equal(parseFreeModeLine('LAYOUT: steps'), null)
})

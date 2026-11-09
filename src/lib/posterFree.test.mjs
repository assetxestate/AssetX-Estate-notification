import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFreePosterPrompt, describeFreeImages, fillFreeImages, footerContactLines, footerShare, freeDirection, freePoolStrings, freeTextPool, parseFreeModeLine, technicalFrame, FREE_DIRECTIONS, PLACEHOLDER_FREE_IMAGES } from './posterFree.js'
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
  // เจ้าของ 8 พ.ย.: โลโก้/เบอร์/LINE ย้ายไปแถบท้ายที่ตัวรับงานวางเอง — Codex ต้องเว้นแถบล่างและห้ามวาดเอง
  assert.doesNotMatch(prompt, /096-986-8888|assetxestate/, 'ไม่ให้ Codex วาดเบอร์/LINE เอง')
  assert.match(prompt, /Brand footer \(fixed[^\n]*bottom 14% of the design area[^\n]*fade starting 26% from the bottom[^\n]*Do NOT draw any logo, brand mark, company name, phone number, LINE id/)
  assert.match(prompt, /Hard rules:[^\n]*no logo or brand mark of any kind/)
  assert.match(prompt, /Input images: \{\{FREE_IMAGES\}\}/)
  assert.match(prompt, /Brand brief \(guidance, not a template\)/)
  assert.match(prompt, /\nColours: the logo's navy #08213f and cyan #42c7d8 lead/)
  assert.match(prompt, new RegExp(`Optional starting direction for this run[^\\n]*${FREE_DIRECTIONS[3].text.slice(0, 20)}`))
  assert.match(prompt, /\nMODE: free seed=3 direction=split-screen presenter=optional footer=brand$/)
  assert.match(prompt, /Visual style \(required[^\n]*photoreal and realistic, never cartoon/, 'เจ้าของ 8 พ.ย.: สมจริง ไม่ใช่การ์ตูน')
  assert.match(prompt, /Identity: premium and luxurious/)
  assert.match(prompt, /Avoid:[^\n]*cartoon or comic style, flat vector illustration, hand-drawn doodles/)
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
  assert.match(buildFreePosterPrompt({ ...POST, size: 'feed-4x5' }), /Choose the concept freely\.[^]*MODE: free seed=none direction=none presenter=optional footer=brand$/)
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
  assert.deepEqual(parseFreeModeLine('x\nMODE: free seed=42 direction=giant-type'), { seed: 42, direction: 'giant-type', presenter: 'optional', footer: 'none' }, 'งานเก่าไม่มี presenter=/footer= = Codex เลือกเอง · Codex วาดโลโก้/เบอร์เอง')
  assert.deepEqual(parseFreeModeLine('x\nMODE: free seed=6 direction=advisor-office presenter=use footer=brand'), { seed: 6, direction: 'advisor-office', presenter: 'use', footer: 'brand' })
  assert.equal(parseFreeModeLine('LAYOUT: steps'), null)
})

test('ทิศแนวหรูสมจริง (เจ้าของ 8 พ.ย.): ไม่มีทิศการ์ตูน · 3 ใน 10 ทิศบังคับรูปเจ้าของ · ไม่มีรูป = ไม่ใส่คน', () => {
  for (const d of FREE_DIRECTIONS) assert.doesNotMatch(d.text, /cartoon|sketch|doodle|clay|collage|sticker|illustrat|hand-drawn|marker/i, `ทิศการ์ตูน: ${d.id}`)
  const uses = FREE_DIRECTIONS.filter((d) => d.presenter === 'use')
  assert.equal(uses.length, 3)
  for (const d of uses) assert.match(d.text, /advisor from the attached photo/)
  const useSeed = FREE_DIRECTIONS.findIndex((d) => d.presenter === 'use')
  assert.match(buildFreePosterPrompt({ ...POST, size: 'feed-4x5', seed: useSeed }), new RegExp(`direction=${uses[0].id} presenter=use footer=brand$`))
  const required = describeFreeImages({ logo: true, presenter: true, usePresenter: true })
  assert.match(required, /Image 2 = THE ADVISOR \(required in this design\)/)
  assert.match(required, /never another clear face/)
  assert.match(describeFreeImages({ logo: true, presenter: false, usePresenter: true }), /No advisor photo is attached: leave people out/)
  assert.match(describeFreeImages({ logo: true, presenter: true, usePresenter: false }), /optional to use/)
})

test('แถบท้ายแบรนด์ (เจ้าของ 8 พ.ย.): ไม่แนบโลโก้ให้ Codex · รูปเจ้าของเป็นภาพที่ 1 · สัดส่วนแถบตรงสูตรเดียวกับสคริปต์ · ข้อความติดต่อจากค่าคงที่', () => {
  const withPresenter = describeFreeImages({ presenter: true, usePresenter: true, footer: true })
  assert.match(withPresenter, /^Image 1 = THE ADVISOR \(required in this design\)/)
  assert.doesNotMatch(withPresenter, /logo/i)
  assert.match(describeFreeImages({ presenter: true, footer: true }), /^Image 1 = IDENTITY REFERENCE \(optional to use\)/)
  assert.equal(describeFreeImages({ presenter: false, footer: true }), 'none attached.')
  assert.match(describeFreeImages({ presenter: false, usePresenter: true, footer: true }), /leave people out/)
  // feed 4:5 (1080x1350): F = min(178.2, 189) → แถบ 14% · ม่าน 26% · square: F = min(178.2, 151.2) → 14% · ม่าน 27%
  assert.deepEqual(footerShare(cropPlan('feed-4x5')), { band: 14, fade: 26 })
  assert.deepEqual(footerShare(cropPlan('square-1x1')), { band: 14, fade: 27 })
  assert.ok(footerShare(cropPlan('story-9x16')).band < 14, 'สตอรี่สูง แถบกินพื้นที่น้อยกว่า')
  assert.deepEqual(footerContactLines(), ['โทร 096-986-8888', 'LINE: assetxestate'])
})

// ── บล็อกเบอร์/LINE สำเร็จรูป (9 พ.ย. 2569 เจ้าของขอให้พรีเมียม เป็นทางการ ใช้สัญลักษณ์ LINE ของจริง) ──
test('แถบท้าย: บล็อกติดต่อสำเร็จรูปมีครบ 2 แบบ · ข้อความมาจาก POSTER_CONTACT · ไอคอน LINE เป็นไฟล์ทางการไม่ถูกแก้ · สคริปต์แถบท้ายรับภาพบล็อก', async () => {
  const { readFileSync, existsSync } = await import('node:fs')
  const { createHash } = await import('node:crypto')
  const { contactBlockHtml, CONTACT_BLOCK_FILES } = await import('../../scripts/make-contact-block.mjs')
  const { POSTER_CONTACT } = await import('./posterDesignSystem.js')
  const pngSize = (file) => { const b = readFileSync(file); assert.equal(b.toString('hex', 0, 8), '89504e470d0a1a0a', `${file} ไม่ใช่ PNG`); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } }
  for (const file of Object.values(CONTACT_BLOCK_FILES)) assert.ok(existsSync(file), `ไม่พบ ${file} — รัน node scripts/make-contact-block.mjs`)
  const stacked = pngSize(CONTACT_BLOCK_FILES.stacked)
  const inline = pngSize(CONTACT_BLOCK_FILES.inline)
  assert.ok(stacked.w / stacked.h > 1.8 && stacked.w / stacked.h < 3.2, `สองแถว ${stacked.w}x${stacked.h}`)
  assert.ok(inline.w / inline.h > 7, `แถวเดียว ${inline.w}x${inline.h}`)
  assert.ok(stacked.h >= 500, 'ทำภาพ ×3 ไว้ย่อ — ต้องสูงพอให้ตัวอักษรคม')
  const html = contactBlockHtml()
  assert.ok(html.includes(POSTER_CONTACT.phone) && html.includes(`>${POSTER_CONTACT.line}<`), 'เบอร์/LINE มาจาก POSTER_CONTACT เท่านั้น')
  assert.doesNotMatch(html, /โทร\s|LINE:/, 'ไม่มีคำนำหน้า เพราะไอคอนบอกแล้ว')
  // Brand icon ทางการจาก line.me/en/logo (LINE_Brand_icon.zip, 9 พ.ย. 2569) — กติกา LINE ห้ามแก้ไฟล์ · LINE เปลี่ยนไอคอน = ดาวน์โหลดใหม่แล้วแก้ค่านี้
  const sha = createHash('sha256').update(readFileSync(new URL('../../scripts/assets/icons/line-brand-icon.png', import.meta.url))).digest('hex')
  assert.equal(sha, '5e93437eb5ec0dcdece92d1562fcd435d1d521cca5c013d2d9e15b544a1d8a39')
  const ps = readFileSync(new URL('../../scripts/poster-footer.ps1', import.meta.url), 'utf8')
  assert.match(ps, /\[string\]\$Contact = ''/)
  assert.match(ps, /\[string\]\$ContactInline = ''/)
  assert.equal(ps.charCodeAt(0), 0xFEFF, 'ไฟล์ .ps1 ต้องมี BOM ไม่งั้น PowerShell 5.1 อ่านภาษาไทยในสคริปต์เพี้ยน')
})

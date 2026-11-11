import test from 'node:test'
import assert from 'node:assert/strict'
import { appendedFooterHeight, buildPremiumImagePrompt, buildPremiumJobPrompt, ctaLines, disclaimerLines, parsePremiumRequest, premiumCopyStrings, premiumFrame, premiumFrameLine, premiumRefIndex, pickPremiumLayout, pickPremiumStyleRef, premiumHasMiddle, premiumLayout, premiumRecentNote, CONTENT_LAYOUT, DEED_NOTE, DEED_STAMP, HYPOTHETICAL_NOTE, PREMIUM_LAYOUTS, PREMIUM_CTA_SUB, PREMIUM_DISCLAIMER, PREMIUM_REQUEST_HEADER } from './posterPremium.js'
import { POSTER_SIZES } from './posterSizes.js'

// ความสูงแถบที่ poster-footer.ps1 -Append -Ratio ต่อใต้ภาพ — เขียนสูตรซ้ำจากสคริปต์ตรง ๆ ไว้เทียบกับ appendedFooterHeight
const appendedFooter = (w, h, ratio) => {
  const standard = Math.round(Math.min(w * 0.165, (h * 0.14) / 0.86))
  return Math.max(Math.round(w / ratio) - h, Math.ceil(standard * 0.46))
}

// แผนแบบที่ Codex เขียนให้ภาพต้นแบบ "เงินสุทธิ" (9 พ.ย. 2569) — ใช้เป็นตัวอย่างแผนที่ผ่านการตรวจแล้ว
const PLAN = {
  brief: {
    audience: 'Thai land and home owners considering a sale with right of redemption or a mortgage for usable capital.',
    goal: 'The viewer understands that the offered amount and the money actually available may differ, and asks for a written breakdown before deciding.',
    visual: 'Emphasise the net-money phrase in deep teal; a smaller contextual line sets the offered amount.',
    emotion: 'Calm, careful and on the owner\'s side.',
    hero: 'a sophisticated wooden table with an anonymous document folder, a calculator and a pen, a contemporary Thai house and a green plot seen through the window behind.',
  },
  keyMessage: 'ดูเงินสุทธิที่ใช้ได้จริง ก่อนตัดสินใจ',
  eyebrow: 'ก่อนขายฝากหรือจำนอง',
  headlineSmall: 'วงเงินที่เสนอ',
  headline: ['อาจไม่ใช่เงินสุทธิ', 'ที่ใช้ได้จริง'],
  headlineAccent: 'เงินสุทธิ',
  subheading: 'ขอสรุปยอดรับ–ยอดหัก ก่อนตัดสินใจ',
  middle: { type: 'equation', title: 'แยกตัวเลขให้ชัด', items: ['ยอดเงินตามข้อตกลง', 'หักรายการที่จ่ายจากยอดนี้', 'เงินสุทธิที่ได้รับ'], note: 'หากมีค่าใช้จ่ายจ่ายแยก ต้องเผื่องบเพิ่มด้วย' },
  points: [
    { title: 'มีรายการหักอะไรบ้าง?', body: 'แยกหนี้เดิม ภาษี ค่าธรรมเนียม และค่าบริการ' },
    { title: 'ใครจ่าย และจ่ายเมื่อไร?', body: 'ขอรายการและยอดเป็นลายลักษณ์อักษร' },
    { title: 'เงินที่เหลือพอกับแผนหรือไม่?', body: 'ตรวจทั้งเงินใช้วันนี้ และภาระที่ต้องชำระภายหลัง' },
  ],
  highlights: [{ text: 'รายการหัก', color: 'violet' }, { text: 'จ่ายเมื่อไร', color: 'coral' }],
  cta: 'คุยเรื่องเงินสุทธิที่ต้องการใช้',
}

test('คำขอในคิว: เก็บหัวข้อ + โพสต์ + seed + ขนาด แล้วอ่านกลับได้ครบ (ไม่ใช่คำสั่งภาพ)', () => {
  const caption = 'บรรทัดแรก\n\n1. ข้อแรก\nรายละเอียด: ขอเป็นลายลักษณ์อักษร'
  const req = buildPremiumJobPrompt({ title: 'วงเงินที่เสนอ  อาจไม่ใช่เงินสุทธิ', caption, size: 'square-1x1', seed: 7 })
  assert.ok(req.startsWith(PREMIUM_REQUEST_HEADER))
  assert.match(req, /^MODE: premium seed=7 size=square-1x1$/m)
  assert.doesNotMatch(req, /BLACK #000000|image_gen|PASS-THROUGH/, 'คำสั่งภาพประกอบบนคอมสำนักงาน ไม่อยู่ในคิว')
  assert.deepEqual(parsePremiumRequest(req), { seed: 7, size: 'square-1x1', title: 'วงเงินที่เสนอ อาจไม่ใช่เงินสุทธิ', caption })
  assert.deepEqual(parsePremiumRequest(buildPremiumJobPrompt({ title: 'ก', caption: '', size: 'ไม่มีขนาดนี้' })), { seed: null, size: 'feed-4x5', title: 'ก', caption: '' })
  assert.equal(parsePremiumRequest('DESIGNER MODE: ...\nMODE: premium seed=1'), null, 'ต้องขึ้นต้นด้วยหัวคำขอ')
  assert.equal(parsePremiumRequest(''), null)
})

test('กรอบงาน: สั่งสัดส่วนมาตรฐานที่เตี้ยกว่าโพสต์ (aspect auto) แล้วต่อแถบท้ายใต้ภาพ → ได้สัดส่วนแพลตฟอร์มพอดีทุกขนาด ไม่ครอปเนื้อหา', () => {
  const feed = premiumFrame('feed-4x5')
  // งาน 24–25 (9 พ.ย.): สั่งขนาดเอง (aspect auto) โมเดลให้ยาวกว่าที่สั่ง → ฟีดใช้จัตุรัสที่ปลั๊กอินบังคับได้แน่นอน แถบท้าย 20%
  assert.deepEqual([feed.aspect, feed.width, feed.height, feed.label, feed.targetRatio, feed.footerPct], ['square', 1024, 1024, 'square 1:1', 0.8, 20])
  assert.deepEqual([premiumFrame('story-9x16').aspect, premiumFrame('story-9x16').label], ['portrait', 'portrait 2:3'])
  assert.deepEqual([premiumFrame('square-1x1').aspect, premiumFrame('square-1x1').label], ['auto', 'landscape 7:6'])
  for (const size of Object.keys(POSTER_SIZES)) {
    const f = premiumFrame(size)
    assert.equal(appendedFooterHeight(f.width, f.height, f.targetRatio), appendedFooter(f.width, f.height, f.targetRatio))
    const finalRatio = f.width / (f.height + appendedFooter(f.width, f.height, f.targetRatio))
    assert.ok(Math.abs(finalRatio - f.targetRatio) < 0.002, `${size}: ${finalRatio}`)
  }
  // โมเดลให้ขนาดอื่น: 1:1 → แถบสูงขึ้นพอดี · 6:7 จริงของงาน 24 (1159x1358) → พอดี
  assert.ok(Math.abs(1254 / (1254 + appendedFooter(1254, 1254, 0.8)) - 0.8) < 0.001)
  assert.ok(Math.abs(1159 / (1358 + appendedFooter(1159, 1358, 0.8)) - 0.8) < 0.001)
  assert.deepEqual(premiumFrame('ไม่มีขนาดนี้'), feed)
})

test('บรรทัดกรอบงาน: ขนาดพิกเซล + สัดส่วนมาตรฐาน · เต็มขอบ ไม่มีแถบ · ระยะขอบตัวหนังสือ', () => {
  const feedLine = premiumFrameLine(premiumFrame('feed-4x5'))
  assert.equal(feedLine, 'Canvas (fixed, keep it word for word in your image_gen prompt): render the image at 1024x1024 px (square 1:1). The whole canvas is the design, full bleed, with no border, frame or bars; keep every text at least 56 px from every edge.')
  assert.match(premiumFrameLine(premiumFrame('square-1x1')), /1344x1152 px \(landscape 7:6\)/)
})

test('คำสั่งภาพ: PASS-THROUGH · รูปผู้แนะนำ + เรฟสไตล์ · บรีฟ 6 ส่วน · ข้อความคำต่อคำ · สีเน้น · แถบท้ายต่อใต้ภาพ · ไม่ให้วาดโลโก้/เบอร์', () => {
  const prompt = buildPremiumImagePrompt({ plan: PLAN, size: 'feed-4x5', seed: 4, refName: 'approved-1-sale-deed-check.png', presenter: true })
  assert.match(prompt, /^PASS-THROUGH RULE: call image_gen with everything below this line/)
  assert.match(prompt, /\n\nGenerate ONE finished premium Thai Facebook educational poster for AssetX Estate/)
  // เจ้าของ 10 พ.ย. 2569: รูปเจ้าของเป็นภาพที่ 1 (ผู้แนะนำในภาพหลัก) · เรฟสไตล์เป็นภาพที่ 2 และห้ามลอกป้ายบนภาพถ่าย/คนในเรฟ
  assert.match(prompt, /\nImage 1 = THE ADVISOR \(required\): the photographic hero features this man as the AssetX Estate advisor[^\n]*same face, hairstyle, skin tone and white dress shirt[^\n]*clip-on microphone/)
  assert.match(prompt, /\nImage 2 is the approved visual style only[^\n]*Do NOT copy its text \(including the small caption on its photo\), its content, its people, its exact grid or its logo corner/)
  assert.match(prompt, /photographic hero featuring the advisor from Image 1: a sophisticated wooden table[^\n]*never shown as the customer, receiving cash or celebrating\. He is the only clear face/)
  assert.doesNotMatch(prompt, /ภาพประกอบ|Hero label|anonymous Thai adult/, 'เจ้าของสั่งเอาป้าย "ภาพประกอบ" ออกจากภาพ')
  assert.match(prompt, /the photo carries no caption, label or tag/)
  assert.match(prompt, /any caption, tag or label on the photograph/)
  assert.match(prompt, /\nCanvas \(fixed[^\n]*1024x1024 px \(square 1:1\)/)
  // งาน 22 (9 พ.ย.): สั่งให้เว้นแถบล่างแล้ว Codex ไม่เว้น → แถบท้ายต่อใต้ภาพ ไม่ขอให้โมเดลเว้นที่อีก
  assert.doesNotMatch(prompt, /Reserved brand footer|plain flat navy/)
  assert.match(prompt, /Brand footer \(fixed\): the design ends with the navy CTA band touching the bottom edge[^\n]*directly below that band \(it becomes the bottom 20% of the final 1080x1350 post\)[^\n]*do NOT draw any logo, X mark, emblem, phone number, LINE id or QR code anywhere/)
  assert.match(prompt, /The top 35-40% of the design area is the photographic hero/)
  for (const n of [1, 2, 3, 4, 5, 6]) assert.match(prompt, new RegExp(`\\n${n} (Target Audience|Communication Goal|Visual Psychology|Key Message|Emotional Design|Call to Action):`))
  assert.match(prompt, /4 Key Message: “ดูเงินสุทธิที่ใช้ได้จริง ก่อนตัดสินใจ”\./)
  assert.match(prompt, /then the middle process strip, then the 3 numbered points, then one navy CTA footer/)
  for (const s of premiumCopyStrings(PLAN)) assert.ok(prompt.includes(`“${s}”`), `ข้อความบนภาพต้องอยู่ในเครื่องหมายคำพูดครบ: ${s}`)
  assert.match(prompt, /Dominant headline, two lines: “อาจไม่ใช่เงินสุทธิ” \/ “ที่ใช้ได้จริง”/)
  assert.match(prompt, /Colour “เงินสุทธิ” deep teal #087F93/)
  assert.match(prompt, /minus sign between the first two blocks and an equals sign before the last/)
  assert.match(prompt, /3 numbered points[^\n]*01 02 03 numbers/)
  assert.match(prompt, /\n01 “มีรายการหักอะไรบ้าง\?” \/ body “แยกหนี้เดิม ภาษี ค่าธรรมเนียม และค่าบริการ”/)
  assert.match(prompt, /Selectively colour “รายการหัก” violet #654697 and “จ่ายเมื่อไร” dark coral #B74434/)
  assert.ok(prompt.includes(`disclaimer just above the CTA band: “${PREMIUM_DISCLAIMER[0]}” / “${PREMIUM_DISCLAIMER[1]}”`))
  assert.ok(prompt.includes(`Navy CTA band at the very bottom of the design area, full width, white text with tiny cyan accents: “คุยเรื่องเงินสุทธิที่ต้องการใช้” / “${PREMIUM_CTA_SUB}”`))
  assert.doesNotMatch(prompt, /096-986-8888|assetxestate/, 'เบอร์/LINE จริงอยู่ในแถบท้ายที่ตัวรับงานต่อ')
  assert.match(prompt, /\nMODE: premium seed=4 ref=approved-1-sale-deed-check\.png presenter=use layout=classic canvas=1024x1024 footer=append$/)
})

test('คำสั่งภาพ: ไม่มีไฟล์รูปเจ้าของ → ไม่มีหน้าคนในภาพหลัก · เรฟเป็นภาพที่ 1 · รูปเจ้าของอย่างเดียวไม่มีบรรทัดเรฟ', () => {
  const noPresenter = buildPremiumImagePrompt({ plan: PLAN, size: 'feed-4x5', seed: 4, refName: 'approved-1-sale-deed-check.png' })
  assert.match(noPresenter, /\nImage 1 is the approved visual style only/)
  assert.doesNotMatch(noPresenter, /THE ADVISOR|Image 2/)
  assert.match(noPresenter, /photographic hero: a sophisticated wooden table[^\n]*No advisor photo is attached, so show no clear face/)
  assert.match(noPresenter, /presenter=none layout=classic canvas=1024x1024/)
  const onlyPresenter = buildPremiumImagePrompt({ plan: PLAN, size: 'feed-4x5', seed: 4, presenter: true })
  assert.match(onlyPresenter, /\nImage 1 = THE ADVISOR/)
  assert.doesNotMatch(onlyPresenter, /approved visual style|No reference image is attached/)
})

test('คำสั่งภาพ: ไม่มีแถบกลาง/เรฟ/คำเน้น → ไม่มีบรรทัดที่ว่าง · ลำดับสายตาไม่พูดถึงแถบกลาง', () => {
  const plan = { ...PLAN, eyebrow: '', headlineSmall: '', headlineAccent: 'ไม่มีในหัวเรื่อง', subheading: '', middle: { type: 'none', items: [] }, highlights: [], cta: 'ส่งข้อมูลทรัพย์คุยกับ AssetX Estate' }
  const prompt = buildPremiumImagePrompt({ plan, size: 'square-1x1', seed: null })
  assert.match(prompt, /No reference image is attached/)
  assert.doesNotMatch(prompt, /Small eyebrow|Headline contextual line|Subheading:|Middle process|connected clean blocks|Selectively colour/)
  assert.match(prompt, /Headline in navy #092B43\./, 'คำเน้นที่ไม่อยู่ในหัวเรื่องถูกทิ้ง')
  assert.match(prompt, /then the 3 numbered points, then one navy CTA footer/)
  assert.match(prompt, /white text with tiny cyan accents: “ส่งข้อมูลทรัพย์คุยกับ AssetX Estate”\n/, 'CTA ที่มีชื่อแบรนด์แล้วไม่เติมบรรทัดสอง')
  assert.match(prompt, /MODE: premium seed=none ref=none presenter=none layout=classic canvas=1344x1152 footer=append$/)
})

test('Story 9:16 และภาพลิงก์: บรรทัดกรอบงานและสัดส่วนแถบท้ายตามขนาด', () => {
  const story = buildPremiumImagePrompt({ plan: PLAN, size: 'story-9x16', seed: 1 })
  assert.match(story, /1024x1536 px \(portrait 2:3\)/)
  assert.match(story, /bottom 16% of the final 1080x1920 post/)
  assert.match(buildPremiumImagePrompt({ plan: PLAN, size: 'link-191x1', seed: 1 }), /bottom 18% of the final 1200x628 post[^]*canvas=1568x672 footer=append$/)
})

test('ข้อความกำกับ: เคสสมมุติได้บรรทัดเพิ่ม · CTA · เลือกเรฟตาม seed', () => {
  assert.deepEqual(disclaimerLines({ title: 'ก', caption: 'เคสสมมุติ: เจ้าของกิจการ' }), [HYPOTHETICAL_NOTE, ...PREMIUM_DISCLAIMER])
  assert.deepEqual(disclaimerLines({ title: 'กรณีสมมติ', caption: '' })[0], HYPOTHETICAL_NOTE)
  assert.deepEqual(disclaimerLines({ title: 'ขายฝาก', caption: 'ทั่วไป' }), PREMIUM_DISCLAIMER)
  assert.deepEqual(ctaLines('คุยกับทีม'), ['คุยกับทีม', PREMIUM_CTA_SUB])
  assert.deepEqual(ctaLines('ทักแชต AssetX Estate'), ['ทักแชต AssetX Estate'])
  assert.equal(premiumRefIndex(4, 3), 1)
  assert.equal(premiumRefIndex(null, 3), 0)
  assert.equal(premiumRefIndex(2, 0), -1)
})

test('โครงภาพหมุนเวียน (เจ้าของ 11 พ.ย. 2569 #37 ภาพพรีเมียมโครงซ้ำ): 5 โครง · เลี่ยงโครงล่าสุด · มีแถบกลางไม่ใช้ steps', () => {
  assert.deepEqual(PREMIUM_LAYOUTS.map((l) => l.id), ['classic', 'split', 'cards', 'overlay', 'steps'])
  for (let seed = 0; seed < 40; seed++) {
    assert.notEqual(pickPremiumLayout(seed, { recent: ['classic', 'classic'] }).id, 'classic', 'งานเก่าเป็น classic หมด → งานถัดไปต้องต่าง')
    assert.ok(!['split', 'cards'].includes(pickPremiumLayout(seed, { recent: ['split', 'cards'] }).id))
    assert.notEqual(pickPremiumLayout(seed, { hasMiddle: true }).id, 'steps')
  }
  assert.equal(new Set(Array.from({ length: 10 }, (_, s) => pickPremiumLayout(s).id)).size, 5, 'seed ต่างกันได้ครบทุกโครง')
  assert.ok(pickPremiumLayout(3, { recent: PREMIUM_LAYOUTS.map((l) => l.id) }).id, 'ใช้ครบทุกโครงแล้วยังเลือกได้')
  assert.equal(pickPremiumLayout(null).id, 'classic')
  assert.equal(premiumLayout('ไม่มีโครงนี้').id, 'classic')
  assert.equal(premiumHasMiddle(PLAN), true)
  assert.equal(premiumHasMiddle({ ...PLAN, middle: { type: 'none', items: [] } }), false)
})

test('คำสั่งภาพตามโครง: การจัดวางเปลี่ยน · ข้อความคำต่อคำ แถบ CTA ชิดล่าง รูปผู้แนะนำ และกติกาแบรนด์คงเดิมทุกโครง', () => {
  const opts = { plan: PLAN, size: 'feed-4x5', seed: 4, refName: 'approved-1-sale-deed-check.png', presenter: true }
  const base = buildPremiumImagePrompt(opts)
  for (const layout of PREMIUM_LAYOUTS) {
    const prompt = buildPremiumImagePrompt({ ...opts, layout: layout.id })
    assert.match(prompt, new RegExp(`layout=${layout.id} canvas=1024x1024 footer=append$`))
    assert.match(prompt, /^PASS-THROUGH RULE/)
    assert.match(prompt, /Navy CTA band at the very bottom of the design area, full width/)
    assert.match(prompt, /do NOT draw any logo, X mark, emblem, phone number, LINE id or QR code anywhere/)
    assert.match(prompt, /featuring the advisor from Image 1: /)
    for (const s of premiumCopyStrings(PLAN)) assert.ok(prompt.includes(`“${s}”`), `${layout.id}: ${s}`)
    if (layout.id === 'classic') { assert.equal(prompt, base, 'classic = คำสั่งเดิมทุกตัวอักษร'); continue }
    assert.doesNotMatch(prompt, /The top 35-40% of the design area|vertically arranged with elegant/)
    assert.match(prompt, /Follow the LAYOUT described below, not the reference's arrangement\./)
  }
  const split = buildPremiumImagePrompt({ ...opts, layout: 'split' })
  assert.match(split, /The right 52-56% of the design area, from the top edge down to the CTA band, is one tall photographic panel featuring the advisor/)
  assert.match(split, /vertical checklist in the left column, each with a small teal circle check mark/)
  assert.match(split, /Eye flows from the headline to the checklist beside the tall photo, then the middle process strip, then one navy CTA footer\./)
  const dark = buildPremiumImagePrompt({ ...opts, layout: 'overlay' })
  assert.match(dark, /Colour “เงินสุทธิ” light cyan #7FD8E8; the rest of the headline warm white #FFF8EE\. Not the whole poster in cyan\./)
  assert.match(dark, /“รายการหัก” soft violet #B9A3E3 and “จ่ายเมื่อไร” warm coral #F2A68F/)
  assert.match(dark, /do not copy its warm-white information area/)
  assert.match(dark, /disclaimer just above the CTA band, warm white over the dark photo/)
  assert.doesNotMatch(dark, /Colour only 10-20% of the typography: primary text navy/)
  const steps = buildPremiumImagePrompt({ plan: { ...PLAN, middle: { type: 'none', items: [] } }, size: 'feed-4x5', seed: 4, layout: 'steps' })
  assert.match(steps, /one horizontal step path/)
  assert.match(steps, /then the 3 steps from left to right, then one navy CTA footer/)
  assert.match(steps, /The top 40-45% of the design area is the photographic hero: /)
})

// ---------------------------------------------------------------- สกิล assetx-estate-visuals ฉบับ 11 พ.ย. 2569: จัดวางอิสระตามเนื้อหา + โฉนดสมจริง
// แผนแบบภาพที่เจ้าของยืนยัน (approved-deed-front-back.png · โฉนดหน้า-หลังในแฟ้มบนพื้นน้ำเงินเข้ม)
const DEED_PLAN = {
  brief: {
    audience: 'Thai land owners preparing documents before talking about a sale with right of redemption or a mortgage.',
    goal: 'The viewer checks both sides of the title deed before a conversation.',
    visual: 'The open folder with both deed pages is the anchor; the headline sits above it.',
    emotion: 'Calm, careful and organised.',
    hero: 'an open navy leather folder on a dark desk holding the front page and the registration page of a Thai title deed, soft window light, a pen beside it.',
  },
  keyMessage: 'ดูโฉนดให้ครบทั้งหน้า-หลัง',
  eyebrow: 'เตรียมเอกสารก่อนคุยเรื่องทรัพย์',
  headlineSmall: '',
  headline: ['ดูโฉนดให้ครบ', 'ทั้งหน้า-หลัง'],
  headlineAccent: 'ทั้งหน้า-หลัง',
  subheading: 'ข้อมูลคนละส่วน ต้องอ่านประกอบกัน',
  middle: { type: 'none', title: '', items: [], note: '' },
  callout: { title: 'อย่าดูเพียงชื่อเจ้าของด้านหน้า', body: 'อ่านรายการจดทะเบียน และตรวจข้อมูลปัจจุบันกับสำนักงานที่ดิน' },
  points: [
    { title: 'ด้านหน้า', body: 'ตำแหน่งที่ดิน • เนื้อที่ • รูปแปลง' },
    { title: 'ด้านหลัง', body: 'สารบัญจดทะเบียน ตรวจรายการโอนและภาระผูกพัน' },
  ],
  numbered: false,
  highlights: [{ text: 'ด้านหลัง', color: 'violet' }],
  cta: 'เตรียมภาพหน้า-หลัง แล้วคุยกับ AssetX Estate ทางแชต',
  theme: 'dark',
  advisor: false,
  deed: true,
  composition: 'A document-led layout: the open folder with the deed front and back pages fills the middle at a slight angle, the headline is centred above it, short labels for each side sit under each page, and the callout with a violet rule sits below. The CTA is a rounded pill at the lower left.',
  variation: 'Recent posters led with a person and a top photo band; this one has no person, a dark theme and the documents as the hero.',
}

test('โครงตามเนื้อหา: เรฟเป็นสไตล์อย่างเดียว · Creative Composition + Variation · CTA ไม่บังคับเป็นแถบล่าง · แถบแบรนด์ยังต่อใต้ภาพ', () => {
  const plan = { ...PLAN, theme: 'light', advisor: true, deed: false, numbered: true, callout: { title: '', body: '' }, composition: 'An equation-led layout: the three money blocks run large across the middle, the headline above on warm white, a small advisor photo beside the checklist on the right. The CTA is a rounded pill under the checklist.', variation: 'Recent posters used a top photo hero; this one leads with the equation.' }
  const prompt = buildPremiumImagePrompt({ plan, size: 'feed-4x5', seed: 4, refName: 'approved-1-sale-deed-check.png', presenter: true, layout: 'content' })
  assert.match(prompt, /^PASS-THROUGH RULE/)
  assert.match(prompt, /\nImage 1 = THE ADVISOR \(required\)/)
  // ข้อความบังคับจากสกิล composition-freedom.md เวลาแนบภาพต้นแบบ
  assert.ok(prompt.includes('\nImage 2: Style reference only: preserve photographic quality, restrained palette and brand character; create a new content-led composition. Do not copy the reference layout, object arrangement, headline position, panel grid or footer.'))
  assert.match(prompt, /\n\nCreative Composition \(chosen from this post's content, not from a template\): An equation-led layout/)
  assert.match(prompt, /\nVariation from Recent Work: Recent posters used a top photo hero[^\n]*Do not fall back to the pattern our recent posters repeated \(headline top left/)
  assert.match(prompt, /Premium photorealistic|premium photorealistic real-estate editorial advertising; content-led photographic composition/)
  assert.doesNotMatch(prompt, /The top 35-40%|Navy CTA band at the very bottom|the design ends with the navy CTA band/, 'ไม่มีตำแหน่งตายตัว')
  assert.match(prompt, /One CTA, the single clear action, placed as Creative Composition describes \(a rounded pill, a side box or a calm text line; not necessarily a band across the bottom\): “คุยเรื่องเงินสุทธิที่ต้องการใช้” \/ “ทางแชต AssetX Estate”/)
  assert.match(prompt, /Brand footer \(fixed\): after rendering we attach our own slim navy brand strip[^\n]*bottom 20% of the final 1080x1350 post[^\n]*do NOT draw any logo, X mark, emblem, phone number, LINE id or QR code anywhere/)
  for (const n of [1, 2, 3, 4, 5, 6]) assert.match(prompt, new RegExp(`\\n${n} (Target Audience|Communication Goal|Visual Psychology|Key Message|Emotional Design|Call to Action):`))
  for (const s of premiumCopyStrings(plan)) assert.ok(prompt.includes(`“${s}”`), s)
  assert.match(prompt, /3 information groups, arranged as Creative Composition describes, numbered 01 02 03 in reading order/)
  assert.match(prompt, /Colour “เงินสุทธิ” deep teal #087F93; the rest of the headline navy #092B43\./)
  assert.match(prompt, /Colour only 10-20% of the typography: primary text navy/)
  assert.match(prompt, /Documents stay anonymous: no deeds with seals/)
  assert.match(prompt, /Avoid: [^\n]*Garuda, seals, stamps, government or company emblems/)
  assert.match(prompt, /\nMODE: premium seed=4 ref=approved-1-sale-deed-check\.png presenter=use layout=content theme=light deed=no canvas=1024x1024 footer=append$/)
  // แผนไม่มี composition → โครงเดิม (classic) ทุกตัวอักษร
  assert.equal(buildPremiumImagePrompt({ plan: PLAN, size: 'feed-4x5', seed: 4, refName: 'approved-1-sale-deed-check.png', presenter: true, layout: 'content' }), buildPremiumImagePrompt({ plan: PLAN, size: 'feed-4x5', seed: 4, refName: 'approved-1-sale-deed-check.png', presenter: true }))
  assert.equal(premiumLayout('content'), CONTENT_LAYOUT)
})

test('โครงตามเนื้อหา + โฉนด + พื้นเข้ม + ไม่มีคน: ลำดับภาพแนบ · แบบโฉนดจริง · ตรา "ตัวอย่าง" · ข้อความกำกับเอกสาร · ห้ามข้อมูลบุคคล', () => {
  const prompt = buildPremiumImagePrompt({ plan: DEED_PLAN, size: 'feed-4x5', seed: 2, refName: 'approved-4-dark-deed-front-back.png', presenter: true, layout: 'content', deedLayoutRef: 'official-deed-layout-reference.png' })
  // AI เลือกไม่มีคน → ไม่แนบ/ไม่พูดถึงรูปเจ้าของ แม้มีไฟล์ (ตัวรับงานไม่แนบด้วย)
  assert.doesNotMatch(prompt, /THE ADVISOR|advisor from Image/)
  assert.match(prompt, /No person is needed: places, property, documents and objects carry the story, so show no clear face/)
  assert.match(prompt, /\nImage 1: Style reference only/)
  assert.match(prompt, /\nImage 2 = DEED LAYOUT REFERENCE \(official format, from an educational infographic\)[^\n]*red Garuda at the top centre, the header โฉนดที่ดิน[^\n]*สารบัญจดทะเบียน registration table on the back\. Use only the document itself; ignore the orange infographic/)
  assert.doesNotMatch(prompt, /DEED REALISM REFERENCE/, 'เรฟสไตล์เป็นภาพโฉนดที่เจ้าของยืนยันอยู่แล้ว')
  assert.match(prompt, /Every title deed is a realistic Thai land title deed \(โฉนดที่ดิน\)[^\n]*never one invented page that merges the map and the registration list\. All fields are blank or covered by neat solid bars: no names, ID numbers, deed numbers, signatures/)
  assert.ok(prompt.includes(`On every deed page: the red stamp “${DEED_STAMP}”`))
  assert.ok(prompt.includes(`Small readable disclaimer near the CTA, its first line next to the documents: “${DEED_NOTE}” / “${PREMIUM_DISCLAIMER[0]}”`))
  assert.match(prompt, /Avoid: [^\n]*any seal, stamp or signature beyond the printed form of the reference deed and the ตัวอย่าง stamp[^\n]*\(the ตัวอย่าง stamp on the deed is required\)/)
  assert.doesNotMatch(prompt, /Garuda, seals, stamps, government or company emblems|no deeds with seals/)
  // พื้นเข้ม: สีอ่อนบนพื้นน้ำเงิน ไม่ใช้ม่วงเข้ม
  assert.match(prompt, /deep navy base \(#061C2E to #092B43\) with warm-white text/)
  assert.match(prompt, /Colour “ทั้งหน้า-หลัง” light cyan #7FD8E8 \(a subtle cyan-to-soft-violet gradient is fine\); the rest of the headline warm white #FFF8EE\./)
  assert.match(prompt, /never dark violet text on dark navy/)
  assert.match(prompt, /“ด้านหลัง” soft violet #B9A3E3/)
  // กล่องเน้น + ข้อไม่มีเลข
  assert.match(prompt, /\nKey callout[^\n]*title “อย่าดูเพียงชื่อเจ้าของด้านหน้า” \/ line “อ่านรายการจดทะเบียน และตรวจข้อมูลปัจจุบันกับสำนักงานที่ดิน”/)
  assert.match(prompt, /2 information groups, arranged as Creative Composition describes, no big numbers/)
  assert.match(prompt, /\n- “ด้านหน้า” \/ body “ตำแหน่งที่ดิน • เนื้อที่ • รูปแปลง”/)
  for (const s of premiumCopyStrings(DEED_PLAN)) assert.ok(prompt.includes(`“${s}”`), s)
  assert.match(prompt, /\nMODE: premium seed=2 ref=approved-4-dark-deed-front-back\.png presenter=none layout=content theme=dark deed=yes canvas=1024x1024 footer=append$/)
  // เรฟสไตล์พื้นสว่าง + โฉนด → แนบภาพโฉนดที่เจ้าของยืนยันเป็นเรฟความสมจริงเพิ่ม (ภาพที่ 3)
  const light = buildPremiumImagePrompt({ plan: { ...DEED_PLAN, theme: 'light', advisor: true, brief: { ...DEED_PLAN.brief, hero: 'the advisor pointing at the registration page of a title deed in an open folder.' } }, size: 'feed-4x5', seed: 2, refName: 'approved-1-sale-deed-check.png', presenter: true, layout: 'content', deedLayoutRef: 'official-deed-layout-reference.png', deedRealismRef: 'approved-deed-front-back.png' })
  assert.match(light, /\nImage 1 = THE ADVISOR[^\n]*\nImage 2: Style reference only[^\n]*\nImage 3 = DEED LAYOUT REFERENCE[^\n]*\nImage 4 = DEED REALISM REFERENCE \(approved by the owner\)[^\n]*how clearly “ตัวอย่าง” is stamped/)
  assert.match(light, /presenter=use layout=content theme=light deed=yes/)
  // ข้อความกำกับมีบรรทัดเอกสารอยู่แล้ว → ไม่ซ้ำ
  const once = buildPremiumImagePrompt({ plan: DEED_PLAN, size: 'feed-4x5', seed: 2, layout: 'content', disclaimer: [DEED_NOTE] })
  assert.ok(once.includes(`disclaimer near the CTA, its first line next to the documents: “${DEED_NOTE}”\n`))
  assert.match(once, /No reference image is attached/)
})

test('เรฟสไตล์ตามโทน + สรุปงานล่าสุดให้ AI เลี่ยงโครงซ้ำ', () => {
  const files = ['p/approved-1-sale-deed-check.png', 'p/approved-2-business-cashflow.png', 'p/approved-3-net-proceeds.png', 'p/approved-4-dark-deed-front-back.png']
  assert.equal(pickPremiumStyleRef(files, { seed: 3, theme: 'dark' }), 'p/approved-4-dark-deed-front-back.png')
  for (let seed = 0; seed < 6; seed++) assert.doesNotMatch(pickPremiumStyleRef(files, { seed, theme: 'light' }), /dark/)
  assert.equal(pickPremiumStyleRef(files.slice(0, 3), { seed: 1, theme: 'dark' }), 'p/approved-2-business-cashflow.png', 'ไม่มีต้นแบบพื้นเข้ม → ใช้ที่มี')
  assert.equal(pickPremiumStyleRef([], { seed: 1 }), null)
  // ไฟล์งานเก่า (ไม่มี layout) = classic · งานโครงตามเนื้อหาใช้ composition ของมันเอง
  assert.equal(premiumRecentNote({ presenter: true }), `light · advisor photo · ${PREMIUM_LAYOUTS[0].summary}`)
  assert.equal(premiumRecentNote({ presenter: true, layout: 'overlay' }), `dark · advisor photo · ${premiumLayout('overlay').summary}`)
  assert.equal(premiumRecentNote({ presenter: false, layout: 'content', plan: DEED_PLAN }), `dark · no person · title deed · ${DEED_PLAN.composition.slice(0, 257)}...`)
  assert.equal(premiumRecentNote({ presenter: true, layout: 'content', plan: { theme: 'light', composition: 'A split comparison with two calm columns.' } }), 'light · advisor photo · A split comparison with two calm columns.')
  const long = premiumRecentNote({ layout: 'content', plan: { theme: 'light', composition: 'x'.repeat(400) } })
  assert.ok(long.endsWith('...') && long.length < 300)
  for (const l of PREMIUM_LAYOUTS) assert.ok(l.summary && !/[฀-๿]/.test(l.summary), `${l.id} ต้องมีสรุปภาษาอังกฤษ`)
})

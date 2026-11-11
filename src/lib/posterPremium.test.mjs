import test from 'node:test'
import assert from 'node:assert/strict'
import { appendedFooterHeight, buildPremiumImagePrompt, buildPremiumJobPrompt, ctaLines, disclaimerLines, parsePremiumRequest, premiumCopyStrings, premiumFrame, premiumFrameLine, premiumRefIndex, pickPremiumLayout, premiumHasMiddle, premiumLayout, HYPOTHETICAL_NOTE, PREMIUM_LAYOUTS, PREMIUM_CTA_SUB, PREMIUM_DISCLAIMER, PREMIUM_REQUEST_HEADER } from './posterPremium.js'
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

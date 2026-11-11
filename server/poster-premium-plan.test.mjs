import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPremiumPlanPrompt, planPremiumPoster, validatePremiumPlan, PREMIUM_LIMITS } from './poster-premium-plan.js'
import { buildPosterJobPrompt } from './marketing-image-jobs.js'
import { parsePremiumRequest } from '../src/lib/posterPremium.js'

const POST = {
  title: 'วงเงินที่เสนอ กับเงินสุทธิที่ได้รับ ต่างกันตรงไหน',
  caption: [
    'ก่อนพิจารณาขายฝากหรือจำนอง ลองถามให้ชัดว่าหลังจัดการรายการต่าง ๆ แล้ว จะเหลือเงินสำหรับแผนของเราเท่าไร',
    'เช็ก 3 เรื่องนี้ก่อนตัดสินใจ',
    '1. มีรายการหักอะไรบ้าง ขอแยกยอดหนี้เดิม ภาษี ค่าธรรมเนียม และค่าบริการ',
    '2. ใครจ่าย และจ่ายเมื่อไร ขอสรุปเป็นลายลักษณ์อักษร',
    '3. เงินที่เหลือเพียงพอกับแผนหรือไม่ วางแผนภาระที่ต้องชำระในอนาคตด้วย',
  ].join('\n'),
}

// คำตอบดิบแบบที่ AI ส่งกลับ (คีย์ snake_case ตามสคีมาในคำสั่ง)
const RAW = {
  key_message: 'ดูเงินสุทธิที่ใช้ได้จริง ก่อนตัดสินใจ',
  eyebrow: 'ก่อนขายฝากหรือจำนอง',
  headline_small: 'วงเงินที่เสนอ',
  headline: ['อาจไม่ใช่เงินสุทธิ', 'ที่ใช้ได้จริง'],
  headline_accent: 'เงินสุทธิ',
  subheading: 'ขอสรุปยอดรับ–ยอดหัก ก่อนตัดสินใจ',
  middle: { type: 'equation', title: 'แยกตัวเลขให้ชัด', items: ['ยอดเงินตามข้อตกลง', 'หักรายการที่จ่ายจากยอดนี้', 'เงินสุทธิที่ได้รับ'], note: '' },
  points: [
    { title: 'มีรายการหักอะไรบ้าง?', body: 'แยกหนี้เดิม ภาษี ค่าธรรมเนียม และค่าบริการ' },
    { title: 'ใครจ่าย และจ่ายเมื่อไร?', body: 'ขอรายการและยอดเป็นลายลักษณ์อักษร' },
    { title: 'เงินที่เหลือพอกับแผนหรือไม่?', body: 'ตรวจทั้งเงินใช้วันนี้ และภาระที่ต้องชำระภายหลัง' },
  ],
  highlights: [{ text: 'รายการหัก', color: 'violet' }, { text: 'จ่ายเมื่อไร', color: 'coral' }, { text: 'ไม่มีบนภาพ', color: 'violet' }],
  cta: 'คุยเรื่องเงินสุทธิที่ต้องการใช้',
  // สกิล 11 พ.ย. 2569: โครงตามเนื้อหา
  theme: 'light',
  advisor: true,
  deed: false,
  numbered: true,
  callout: { title: '', body: '' },
  composition: 'An equation-led layout: the three money blocks run large across the middle as the visual anchor, the headline sits above them on warm white, and a small photo of the advisor reviewing a statement sits beside the checklist on the right. The CTA is a rounded pill under the checklist.',
  variation: 'Recent posters used a top photo hero; this one leads with the equation and keeps the photo small.',
  brief: {
    audience: 'Thai land owners, the ลูกค้าเงินด่วน type, considering a sale with right of redemption, plain words.',
    goal: 'The viewer asks for a written breakdown before deciding.',
    visual: 'Make “อาจไม่ใช่เงินสุทธิ” the dominant line.',
    emotion: 'Calm and careful.',
    hero: 'the advisor at a walnut desk explaining an anonymous folder beside a calculator and a pen, a Thai house seen through the window.',
  },
}

const clone = (v) => JSON.parse(JSON.stringify(v))

test('คำสั่งวางแผน: คนอ่านกลุ่ม A · ห้ามแต่งตัวเลข/คำเกินจริง · สคีมา JSON · โพสต์อยู่ท้าย · ส่งปัญหากลับไปแก้', () => {
  const { system, prompt } = buildPremiumPlanPrompt({ ...POST })
  assert.match(system, /AssetX Estate[^\n]*ตอบเป็น JSON อย่างเดียว/)
  assert.match(prompt, /คนอ่านคือเจ้าของที่ดิน บ้าน หรือห้องชุดที่ต้องการเงิน/)
  assert.match(prompt, /ตัวเลขใช้ได้เฉพาะตัวที่มีในโพสต์/)
  assert.match(prompt, /ห้ามคำว่า ฟรี อนุมัติไว\/แน่นอน ได้เงินทันที/)
  assert.match(prompt, /"middle":\{"type":"flow"/)
  assert.match(prompt, new RegExp(`บรรทัดละ ≤ ${PREMIUM_LIMITS.headlineLine} ตัว`))
  assert.ok(prompt.trimEnd().endsWith(`${POST.caption}\n"""`))
  assert.doesNotMatch(prompt, /\n\n\n/)
  assert.doesNotMatch(prompt, /ร่างก่อนหน้ามีปัญหา/)
  assert.match(buildPremiumPlanPrompt({ ...POST, feedback: ['ตัวเลข 5 ไม่มีในโพสต์'] }).prompt, /ร่างก่อนหน้ามีปัญหา[^\n]*\n- ตัวเลข 5 ไม่มีในโพสต์/)
})

test('คำสั่งวางแผน (สกิล 11 พ.ย. 2569): เลือกโครงจากเนื้อหา · งานล่าสุดให้เลี่ยง · โทน/คน/โฉนด/กล่องเน้น · ไม่ต้องวางโลโก้', () => {
  const { prompt } = buildPremiumPlanPrompt({ ...POST, recent: ['light · advisor photo · headline top left, photo hero across the top third', 'dark · no person · title deed · open folder'] })
  assert.match(prompt, /จัดวางอิสระตามเนื้อหา/)
  assert.match(prompt, /ชุดที่ภาพของเราซ้ำมาตลอด ห้ามเป็นค่าเริ่มต้น: หัวเรื่องซ้ายบน/)
  assert.match(prompt, /เปลี่ยนอย่างน้อย 2 ด้าน[^\n]*\n {2}1\) light · advisor photo · headline top left[^\n]*\n {2}2\) dark · no person · title deed/)
  assert.match(prompt, /- advisor: true เมื่อ[^\n]*ไม่ต้องมีคนทุกโพสต์/)
  assert.match(prompt, /- deed: true เมื่อภาพควรแสดงโฉนดที่ดิน/)
  assert.match(prompt, /- composition: ภาษาอังกฤษ 2–4 ประโยค/)
  assert.match(prompt, /ไม่ต้องวางหรือพูดถึงโลโก้ เบอร์ LINE/)
  assert.match(prompt, /"callout":\{"title":"","body":""\}[^\n]*"theme":"light","advisor":false,"deed":false,"composition":"","variation":""/)
  assert.match(buildPremiumPlanPrompt({ ...POST }).prompt, /ไม่มีประวัติงานล่าสุดให้เทียบ/)
})

test('ตรวจแผน: ชุดที่ดีผ่าน · ทิ้งคำเน้นที่ไม่อยู่บนภาพ · ตัดไทยในบรีฟที่ไม่ใช่ข้อความบนภาพ', () => {
  const { plan, hard, soft } = validatePremiumPlan(clone(RAW), POST)
  assert.deepEqual(hard, [])
  assert.deepEqual(soft, [])
  assert.deepEqual(plan.headline, ['อาจไม่ใช่เงินสุทธิ', 'ที่ใช้ได้จริง'])
  assert.equal(plan.middle.type, 'equation')
  assert.deepEqual(plan.highlights, [{ text: 'รายการหัก', color: 'violet' }, { text: 'จ่ายเมื่อไร', color: 'coral' }])
  assert.doesNotMatch(plan.brief.audience, /ลูกค้าเงินด่วน/, 'คำไทยที่ไม่ได้อยู่บนภาพไม่ให้หลุดเข้าคำสั่งภาพ')
  assert.match(plan.brief.audience, /^Thai land owners, the type, considering/)
  assert.match(plan.brief.visual, /“อาจไม่ใช่เงินสุทธิ”/, 'คำไทยที่เป็นข้อความบนภาพอ้างได้')
  assert.equal(plan.keyMessage, RAW.key_message)
  assert.equal(plan.composition, RAW.composition)
  assert.equal(plan.variation, RAW.variation)
  assert.deepEqual([plan.theme, plan.advisor, plan.deed, plan.numbered], ['light', true, false, true])
})

test('ตรวจแผน (สกิล 11 พ.ย. 2569): โครง · โทน · คน · โฉนด · กล่องเน้น · ข้อเดียวกลายเป็นกล่องเน้น', () => {
  // โครง: ตัดประโยคที่สั่งวางโลโก้/เบอร์/LINE (แถบแบรนด์ต่อใต้ภาพเอง) แต่คำว่า line ธรรมดาอยู่ได้ · ไทยที่ไม่ใช่ข้อความบนภาพถูกตัด
  const brand = clone(RAW)
  brand.composition = 'A calm question-led layout with a thin vertical line beside the headline. Put the logo in a white corner panel. Add the LINE id under the CTA. The answer panel balances the photo on the right side ของเรา.'
  const b = validatePremiumPlan(brand, POST).plan
  assert.equal(b.composition, 'A calm question-led layout with a thin vertical line beside the headline. The answer panel balances the photo on the right side .')
  // ไม่มี/สั้นเกิน → ปัญหาเบา และไม่มี composition (ตัวรับงานใช้โครงหมุนเวียนแทน)
  const none = clone(RAW)
  none.composition = 'Left text.'
  const n = validatePremiumPlan(none, POST)
  assert.equal(n.plan.composition, '')
  assert.match(n.soft.join(' '), /ไม่มี composition/)
  // โทน · คนไม่บอก = มีผู้แนะนำ (พฤติกรรมเดิม)
  const old = clone(RAW)
  delete old.advisor
  old.theme = 'neon'
  assert.deepEqual([validatePremiumPlan(old, POST).plan.advisor, validatePremiumPlan(old, POST).plan.theme], [true, 'light'])
  const dark = { ...clone(RAW), theme: 'dark' }
  assert.equal(validatePremiumPlan(dark, POST).plan.theme, 'dark')
  // ไม่มีคน: ภาพหลักสำรองไม่มีคน · บรีฟที่ยังมี the advisor = ปัญหาเบา
  const objects = { ...clone(RAW), advisor: 'false', composition: 'An equation-led layout: the three money blocks run large across the middle, the headline sits above them on warm white and a calculator still life sits beside the checklist.' }
  delete objects.brief.hero
  const o = validatePremiumPlan(objects, POST)
  assert.equal(o.plan.advisor, false)
  assert.doesNotMatch(o.plan.brief.hero, /advisor/)
  assert.deepEqual(o.soft, [])
  const mixed = { ...clone(RAW), advisor: false }
  const m = validatePremiumPlan(mixed, POST).soft.join(' ')
  assert.match(m, /advisor เป็น false แต่ brief\.hero มี "the advisor"/)
  assert.match(m, /advisor เป็น false แต่ composition มี "the advisor"/)
  // โฉนด: AI บอกตรง ๆ = ยึดตามนั้น · ไม่บอก = ดูว่าภาพหลักพูดถึง deed ไหม
  assert.equal(validatePremiumPlan({ ...clone(RAW), deed: true }, POST).plan.deed, true)
  const deedHero = clone(RAW)
  delete deedHero.deed
  deedHero.brief.hero = 'the advisor beside an open leather folder holding the front and back of a title deed, deep navy desk.'
  assert.equal(validatePremiumPlan(deedHero, POST).plan.deed, true)
  // ลองจริง #17 (11 พ.ย.): "with no official seals, title deeds, cash" + deed:false → ต้องไม่ใช่โฉนด
  const negated = clone(RAW)
  negated.brief.hero = 'an overhead still life of two open folders on a navy desk, with no official seals, title deeds, cash or faces.'
  assert.equal(validatePremiumPlan(negated, POST).plan.deed, false)
  // ยาวเกิน → ตัดที่จบประโยค ไม่ขาดกลางคำ
  const longHero = clone(RAW)
  longHero.brief.hero = `the advisor explaining a folder at a walnut desk. ${'Soft daylight falls across warm ivory surfaces and navy furnishings. '.repeat(9)}No readable documents.`
  const cut = validatePremiumPlan(longHero, POST).plan.brief.hero
  assert.ok(cut.length <= 560 && cut.endsWith('furnishings.'), cut.slice(-40))
  // กล่องเน้น: ข้อหลักข้อเดียว → กล่องเน้น · ไม่มีข้อหลักแต่มีกล่องเน้น = ผ่าน · มีข้อเดียวพร้อมกล่องเน้น = ปัญหาหนัก
  const single = { ...clone(RAW), points: [{ title: 'อย่าดูแค่หน้าโฉนด', body: 'อ่านรายการจดทะเบียนด้านหลังด้วย' }] }
  const s = validatePremiumPlan(single, POST)
  assert.deepEqual(s.plan.points, [])
  assert.deepEqual(s.plan.callout, { title: 'อย่าดูแค่หน้าโฉนด', body: 'อ่านรายการจดทะเบียนด้านหลังด้วย' })
  assert.doesNotMatch(s.hard.join(' '), /ข้อหลัก/)
  const both = { ...clone(RAW), callout: { title: 'จุดสำคัญ', body: '' }, points: [{ title: 'ข้อเดียว', body: '' }] }
  assert.match(validatePremiumPlan(both, POST).hard.join(' '), /ข้อหลักต้องมีอย่างน้อย 2 ข้อ \(หรือไม่มีข้อหลักเลยแล้วใช้กล่องเน้น callout\)/)
  // คำเน้นจากกล่องเน้นได้
  const hl = { ...clone(RAW), callout: { title: 'ตรวจรายการจดทะเบียน', body: '' }, highlights: [{ text: 'รายการจดทะเบียน', color: 'violet' }] }
  assert.deepEqual(validatePremiumPlan(hl, POST).plan.highlights, [{ text: 'รายการจดทะเบียน', color: 'violet' }])
})

test('ตรวจแผน: ภาพหลักต้องมีผู้แนะนำ (รูปเจ้าของ · 10 พ.ย. 2569) — บรีฟไม่พูดถึง = ปัญหาเบาให้แก้ · ไม่มีบรีฟ = ใช้ค่าเริ่มต้นที่มีผู้แนะนำ', () => {
  const noAdvisor = clone(RAW)
  noAdvisor.brief.hero = 'a Thai business owner calculating at a cafe table.'
  const checked = validatePremiumPlan(noAdvisor, POST)
  assert.deepEqual(checked.hard, [])
  assert.match(checked.soft.join(' '), /brief\.hero ต้องมี "the advisor"/)
  const noBrief = clone(RAW)
  delete noBrief.brief
  const fallback = validatePremiumPlan(noBrief, POST)
  assert.match(fallback.plan.brief.hero, /^the advisor seated/)
  assert.deepEqual(fallback.soft, [])
  assert.match(buildPremiumPlanPrompt({ ...POST }).prompt, /brief\.hero:[^\n]*"the advisor" เป็นคนเดียวที่เห็นหน้า[^\n]*ห้ามให้เขาเป็นลูกค้า/)
})

test('ตรวจแผน: ปัญหาหนัก — ตัวเลขแต่ง · เบอร์ · คำเกินจริง · อังกฤษ · มุมคนปล่อยเงิน · ชื่อคน · ขาดหัวเรื่อง/CTA/ข้อหลัก', () => {
  const bad = clone(RAW)
  bad.points[0].body = 'หักค่าธรรมเนียม 5% จากยอด' // 5 ไม่มีในโพสต์ (1–3 มีเป็นเลขข้อ)
  bad.points[1].body = 'โทร 081-234-5678 ได้เลย'
  bad.points[2].title = 'อนุมัติไวใน 1 วัน'
  bad.subheading = 'Net money first'
  bad.middle.note = 'หากผู้ขายฝากเป็นบุคคลธรรมดา ต้องระวัง'
  bad.eyebrow = 'คุยกับนายสมชาย ใจดี'
  const { hard } = validatePremiumPlan(bad, POST)
  const all = hard.join('\n')
  assert.match(all, /ตัวเลข 5 ไม่มีในโพสต์/)
  assert.match(all, /ห้ามช่องทางติดต่อ/)
  assert.match(all, /คำโฆษณาเกินจริง "อนุมัติไว"/)
  assert.match(all, /ใช้ภาษาไทยบนภาพ/)
  assert.match(all, /มุมคนปล่อยเงิน "หากผู้ขายฝากเป็น"/)
  assert.match(all, /มีข้อมูลบุคคล/)
  const okNumber = clone(RAW)
  okNumber.middle.title = 'เช็ก 3 เรื่องนี้ก่อนตัดสินใจ'
  assert.deepEqual(validatePremiumPlan(okNumber, POST).hard, [], 'ตัวเลขที่มีในโพสต์ใช้ได้')
  const empty = validatePremiumPlan({ points: [] }, POST)
  assert.match(empty.hard.join('\n'), /ไม่มีหัวเรื่อง/)
  assert.match(empty.hard.join('\n'), /ข้อหลักต้องมีอย่างน้อย 2 ข้อ/)
  assert.match(empty.hard.join('\n'), /ไม่มี CTA/)
  assert.equal(validatePremiumPlan(null, POST).plan.headline.length, 0)
})

test('ตรวจแผน: ปัญหาเบา — ยาวเกิน · ข้อหลักเกินเมื่อมีแถบกลาง (ตัดให้) · สมการไม่ครบ 3 กล่องเปลี่ยนเป็นลำดับขั้น · หัวเรื่องเป็นสตริง', () => {
  const long = clone(RAW)
  long.headline = 'อาจไม่ใช่เงินสุทธิที่ใช้ได้จริงสำหรับแผนของคุณทั้งหมด\nบรรทัดสอง'
  long.points.push({ title: 'ข้อสี่', body: 'รายละเอียด' })
  long.middle = { type: 'equation', title: 'แยกตัวเลข', items: ['ยอดเงิน', 'เงินสุทธิ'] }
  const { plan, hard, soft } = validatePremiumPlan(long, POST)
  assert.deepEqual(hard, [])
  assert.deepEqual(plan.headline, ['อาจไม่ใช่เงินสุทธิที่ใช้ได้จริงสำหรับแผนของคุณทั้งหมด', 'บรรทัดสอง'])
  assert.equal(plan.middle.type, 'flow')
  assert.equal(plan.points.length, 3)
  const all = soft.join('\n')
  assert.match(all, /headline บรรทัด 1 ยาว \d+ ตัว เกิน 24/)
  assert.match(all, /ข้อหลักมี 4 ข้อ เกิน 3/)
  assert.match(all, /สมการแถบกลางต้องมี 3 กล่องพอดี/)
  const noMiddle = clone(RAW)
  noMiddle.middle = { type: 'none' }
  noMiddle.points.push({ title: 'ข้อสี่', body: 'รายละเอียด' })
  assert.equal(validatePremiumPlan(noMiddle, POST).plan.points.length, 4, 'ไม่มีแถบกลาง ได้ 4 ข้อ')
})

test('วางแผนด้วย AI: ปัญหาหนักส่งกลับไปแก้ · ผ่านรอบสอง', async () => {
  const prompts = []
  const replies = [
    { ok: true, provider: 'codex', data: { ...clone(RAW), cta: 'ปรึกษาฟรีวันนี้' } },
    { ok: true, provider: 'codex', data: clone(RAW) },
  ]
  const ask = async ({ prompt }) => { prompts.push(prompt); return replies.shift() }
  const result = await planPremiumPoster({ ...POST, recent: ['light · advisor photo · classic'], ask })
  assert.match(prompts[0], /\n {2}1\) light · advisor photo · classic/, 'งานล่าสุดส่งถึง AI ทุกรอบ')
  assert.equal(result.ok, true)
  assert.equal(result.attempts, 2)
  assert.equal(result.provider, 'codex')
  assert.deepEqual(result.warnings, [])
  assert.match(prompts[1], /ร่างก่อนหน้ามีปัญหา[^]*คำโฆษณาเกินจริง "ฟรี"/)
})

test('วางแผนด้วย AI: เหลือแค่ปัญหาเบาหลังครบรอบ → ใช้ชุดที่ดีที่สุดพร้อมคำเตือน · หนักทุกรอบ → ล้มพร้อมเหตุผล · AI ไม่ตอบ → ล้ม', async () => {
  const longCta = { ...clone(RAW), cta: 'คุยเรื่องเงินสุทธิที่ต้องการใช้กับทีมของเราได้ทุกวันทำการเลย' }
  const soft = await planPremiumPoster({ ...POST, ask: async () => ({ ok: true, provider: 'codex', data: clone(longCta) }), attempts: 2 })
  assert.equal(soft.ok, true)
  assert.match(soft.warnings.join(' '), /cta ยาว/)
  const hard = await planPremiumPoster({ ...POST, ask: async () => ({ ok: true, provider: 'codex', data: { ...clone(RAW), cta: 'การันตีอนุมัติ' } }), attempts: 2 })
  assert.equal(hard.ok, false)
  assert.match(hard.error, /ข้อความโปสเตอร์ไม่ผ่านการตรวจ: [^]*การันตี/)
  const down = await planPremiumPoster({ ...POST, ask: async () => ({ ok: false, error: 'codex: timeout' }), attempts: 2 })
  assert.deepEqual(down, { ok: false, error: 'codex: timeout' })
  assert.equal((await planPremiumPoster({ ...POST })).ok, false)
})

test('API: mode=premium เก็บคำขอ (ผ่านตัวลบข้อมูลบุคคล) ที่ตัวรับงานอ่านกลับได้', () => {
  const prompt = buildPosterJobPrompt({ title: POST.title, caption: `${POST.caption}\nติดต่อคุณสมชาย 081-234-5678`, size: 'feed-4x5', seed: 9, mode: 'premium' })
  const req = parsePremiumRequest(prompt)
  assert.equal(req.seed, 9)
  assert.equal(req.size, 'feed-4x5')
  assert.equal(req.title, POST.title)
  assert.doesNotMatch(req.caption, /081-234-5678/)
  assert.match(req.caption, /มีรายการหักอะไรบ้าง/)
})

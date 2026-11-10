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
  const empty = validatePremiumPlan({ points: [{ title: 'ข้อเดียว' }] }, POST)
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
  const result = await planPremiumPoster({ ...POST, ask })
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

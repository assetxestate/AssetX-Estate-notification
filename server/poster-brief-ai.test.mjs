// เทสต์ตัวรวมบรีฟ AI (ไม่เรียก Ollama — ป้อนคำตอบจำลอง) · รัน: node --test server/poster-brief-ai.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseJobPrompt, mergeAiBrief, replaceBriefInPrompt, buildBriefAiPrompt } from './poster-brief-ai.js'
import { buildPosterJobPrompt } from './marketing-image-jobs.js'
import { extractPosterCopy, buildCreativeBrief } from '../src/lib/posterBrief.js'

const title = 'ขายฝาก เช็กเงื่อนไขก่อนตัดสินใจ'
const caption = `สินไถ่และค่าใช้จ่าย ควรถามให้ชัดก่อนทำสัญญา

1. ตรวจวันครบกำหนดและเงื่อนไขการไถ่ถอนในสัญญา
เริ่มจากทำตารางวันที่สำคัญและรายการที่ต้องตรวจจากสัญญา ไม่ควรรอให้ใกล้ครบกำหนดจึงเริ่มวางแผน

2. ตรวจยอดสินไถ่และค่าใช้จ่ายพร้อมเอกสารประกอบ
แยกจำนวนเงินที่ได้รับจริง ยอดสินไถ่ และค่าใช้จ่ายแต่ละรายการออกจากกัน อย่าพิจารณาเฉพาะวงเงินที่เสนอ

3. สอบถามขั้นตอนและเอกสารที่ต้องใช้กับสำนักงานที่ดินหรือผู้เชี่ยวชาญ
เตรียมข้อมูลทรัพย์ สำเนาสัญญาที่มี และรายการคำถามไปตรวจสอบ

ก่อนคุยกับผู้ให้บริการ: จดสิ่งที่รู้แล้ว สิ่งที่ยังไม่ชัด และหลักฐานที่ต้องขอเพิ่ม

สอบถามข้อมูลเบื้องต้นกับ บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด ทางแชตได้`

test('parseJobPrompt: ดึงหัวข้อ/เนื้อโพสต์/โครงการ์ดกลับจากคำสั่งภาพของเซิร์ฟเวอร์', () => {
  const prompt = buildPosterJobPrompt({ title, caption, size: 'feed-4x5' })
  const parsed = parseJobPrompt(prompt)
  assert.equal(parsed.title, title)
  assert.equal(parsed.layout, 'steps')
  assert.match(parsed.caption, /^สินไถ่และค่าใช้จ่าย/)
  assert.match(parsed.caption, /ทางแชตได้$/)
  assert.match(buildBriefAiPrompt({ title, caption, layout: 'steps', base: extractPosterCopy({ title, caption }) }).system, /คัดลอกต่อเนื่องคำต่อคำ/)
})

test('mergeAiBrief: รับเฉพาะช่องที่คัดจากโพสต์คำต่อคำ · ตัดกลางรายการไม่รับ · ข้อควรทำซ้ำแถวถูกตัด · อาร์ตไดเรกชันกว้าง ๆ/มีปฏิทินถูกทิ้ง · ช่องอังกฤษที่มีไทยถูกทิ้ง', () => {
  const base = extractPosterCopy({ title, caption })
  const data = {
    big_idea: 'Check the dates, the redemption sum and every cost in the real contract before signing.',
    ribbon: 'สินไถ่และค่าใช้จ่าย ควรถามให้ชัด',
    card_title: 'รายการที่ต้องตรวจ',
    rows: [
      { title: 'ตรวจวันครบกำหนดและเงื่อนไขการไถ่ถอนในสัญญา', detail: 'เริ่มจากทำตารางวันที่สำคัญและรายการที่ต้องตรวจจากสัญญา', icon: 'calendar' },
      { title: 'ตรวจยอดสินไถ่และค่าใช้จ่ายพร้อมเอกสารประกอบ', detail: 'แยกจำนวนเงินที่ได้รับจริง ยอดสินไถ่', icon: 'coins' },
      { title: 'สอบถามขั้นตอนและเอกสารที่ต้องใช้', detail: 'เตรียมข้อมูลทรัพย์ สำเนาสัญญาที่มี และรายการคำถามไปตรวจสอบ', icon: 'map pin' },
    ],
    action_title: 'ก่อนคุยกับผู้ให้บริการ',
    action_items: ['จดสิ่งที่รู้แล้ว สิ่งที่ยังไม่ชัด และหลักฐานที่ต้องขอเพิ่ม', 'เตรียมข้อมูลทรัพย์ สำเนาสัญญาที่มี และรายการคำถามไปตรวจสอบ'],
    callout: 'อย่าพิจารณาเฉพาะวงเงินที่เสนอ',
    band_chips: ['วันครบกำหนด', 'ยอดสินไถ่'],
    background: 'A blurred image of a desk with a calendar and documents in the background.',
    props: 'a navy clipboard with a plain contract tilted 8 degrees, a matte navy pen across it, soft window light from the top-left, shallow depth of field',
    mood: 'calm, orderly, careful; warm oak and daylight',
    summary_test: 'this is about ขายฝาก - check the due date, the sum and every cost before signing',
  }
  const { copy, extras, replaced } = mergeAiBrief(data, base, { title, caption })
  assert.equal(copy.ribbon, 'สินไถ่และค่าใช้จ่าย ควรถามให้ชัด')
  assert.equal(copy.cardTitle, 'รายการที่ต้องตรวจ')
  assert.equal(copy.callout, 'อย่าพิจารณาเฉพาะวงเงินที่เสนอ')
  assert.deepEqual(copy.bandChips, ['วันครบกำหนด', 'ยอดสินไถ่'])
  assert.ok(!replaced.includes('rows'), 'แถว 2 ตัดกลางรายการ ("…ยอดสินไถ่" แล้วโพสต์ต่อด้วย และ…) = ใช้แถวแบบกำหนดกฎทั้งชุด')
  assert.equal(copy.rows[1].detail, base.rows[1].detail)
  assert.deepEqual(copy.actionItems, ['จดสิ่งที่รู้แล้ว สิ่งที่ยังไม่ชัด และหลักฐานที่ต้องขอเพิ่ม'], 'ข้อที่ซ้ำรายละเอียดแถว 3 ถูกตัด')
  assert.equal(extras.background, '', 'พื้นหลังกว้าง ๆ และมีปฏิทิน = ทิ้ง')
  assert.match(extras.props, /navy clipboard/)
  assert.match(extras.bigIdea, /^Check the dates/)
  assert.match(extras.summaryTest, /ขายฝาก/, 'ชื่อบริการในช่องอังกฤษยอมรับได้')
  // แต่งคำเอง / ภาษาไทยในช่องอังกฤษ → ทิ้ง
  const bad = mergeAiBrief({ ribbon: 'วลีที่แต่งขึ้นใหม่เอง', big_idea: 'ควรตรวจสัญญา before signing', mood: 'สงบ' }, base, { title, caption })
  assert.equal(bad.copy.ribbon, base.ribbon)
  assert.equal(bad.extras.bigIdea, '')
  assert.equal(bad.extras.mood, '')
  assert.deepEqual(bad.replaced, [])
})

test('replaceBriefInPrompt: แทนบล็อก CREATIVE BRIEF เดิมทั้งก้อน คงส่วนหลัง (BOTTOM CTA BAND…) ไว้', () => {
  const prompt = buildPosterJobPrompt({ title, caption, size: 'feed-4x5' })
  const copy = extractPosterCopy({ title, caption })
  const brief = buildCreativeBrief(copy, { title, caption, layout: 'steps', source: 'AI-assisted test', extras: { bigIdea: 'Test idea' } })
  const out = replaceBriefInPrompt(prompt, brief)
  assert.equal((out.match(/CREATIVE BRIEF for this post/g) || []).length, 1)
  assert.match(out, /\(AI-assisted test;/)
  assert.doesNotMatch(out, /\(rule-based;/)
  assert.match(out, /- Big idea \(for the designer, never printed\): Test idea/)
  assert.match(out, /\n\nBOTTOM CTA BAND \(render exactly\): ติดต่อ AssetX Estate/)
  assert.match(out, /RULES:\n- Thai text must be spelled exactly/)
})

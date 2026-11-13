import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { offerTopics, offerSummary, offerIdeaRow, planOfferIdeas } from './offers.js'
import { buildDraftPrompt, hasResearchFacts, splitFactsNotes, draftFormatFor } from './drafts.js'
import { channelOfIdea } from '../../src/lib/ideaChannels.js'

const config = JSON.parse(fs.readFileSync(new URL('../../research/offer_topics.json', import.meta.url), 'utf8'))
const brand = JSON.parse(fs.readFileSync(new URL('../../research/brand_facts.json', import.meta.url), 'utf8'))
const now = new Date('2026-11-13T09:00:00Z')

test('offer_topics.json: ทุกหัวข้อครบ · มุมแรกเป็นประกาศบริการ · ไม่มีเรต ตัวเลขเงิน เบอร์ หรือคำต้องห้าม', () => {
  const topics = offerTopics(config)
  assert.ok(topics.length >= 4)
  const allowedTypes = ['ที่ดิน', 'บ้านเดี่ยว', 'ทาวน์โฮม', 'ตึกแถว', 'คอนโด', 'อื่น']
  for (const t of topics) {
    assert.ok(allowedTypes.includes(t.property_type), `${t.key}: property_type ต้องตรงกับ CHECK ของตาราง`)
    assert.match(t.angles[0].label, /^ประกาศบริการ/, `${t.key}: มุมแรกต้องเป็นประกาศบริการ`)
    const text = JSON.stringify(t)
    assert.doesNotMatch(text, /\d+(\.\d+)?\s*%|ต่อเดือน|บาท|0\d{1,2}-?\d{3}-?\d{4}|line\.me|@\w/i, `${t.key}: ห้ามเรต/เงิน/เบอร์/LINE`)
    for (const phrase of brand.forbidden_phrases) assert.ok(!text.includes(phrase), `${t.key}: มีคำต้องห้าม "${phrase}"`)
  }
})

test('offerIdeaRow: แถวตรงตาราง · ข้อเท็จจริงขึ้นต้น 📌 · หมายเหตุ "ห้าม…" ไม่ปนข้อเท็จจริง · ชิปบริการของเรา', () => {
  const topic = offerTopics(config)[0]
  const row = offerIdeaRow(topic, brand, { now })
  assert.equal(row.source, 'internal')
  assert.equal(row.subtype, 'offer')
  assert.deepEqual(row.audience, ['A'])
  assert.match(row.external_key, /^offer:khaifak-condo:2026-W46$/)
  assert.equal(channelOfIdea(row), 'offer')
  assert.ok(hasResearchFacts(row), 'ร่างได้เพราะมีข้อเท็จจริง (ความจริงของแบรนด์)')
  const { facts, notes } = splitFactsNotes(row.summary, { source: row.source })
  assert.ok(facts.some((f) => /อ\.ช\.2/.test(f)))
  assert.ok(facts.some((f) => /กรุงเทพฯ และปริมณฑล/.test(f)))
  assert.ok(facts.some((f) => /สิทธิไถ่คืน/.test(f)), 'นิยามขายฝากที่ถูกอยู่ในข้อเท็จจริง')
  assert.ok(facts.every((f) => !/^ห้าม/.test(f)))
  assert.equal(notes.length, 2)
  assert.doesNotMatch(row.summary, /มิตรเมือง|#64|1%/, 'ไม่มีชื่อ/ข้อเสนอของเพจต้นแบบ')
})

test('ร่างโพสต์: มุมประกาศบริการได้โครง offer + กติกาของประเภท · มุมที่สองได้โครงตามชื่อ', () => {
  const topic = offerTopics(config)[0]
  const row = { id: 900, ...offerIdeaRow(topic, brand, { now }) }
  const first = buildDraftPrompt({ idea: row, angle: row.angles[0], brand })
  assert.equal(first.format, 'offer')
  assert.match(first.prompt, /รูปแบบโพสต์: ประกาศบริการ/)
  assert.match(first.prompt, /กติกาของประเภทนี้: ประกาศบริการของเราเอง/)
  assert.match(first.prompt, /ห้ามระบุดอกเบี้ย วงเงิน/, 'หมายเหตุถึงผู้เขียนไปถึงตัวเขียน')
  const second = buildDraftPrompt({ idea: row, angle: row.angles[1], brand })
  assert.equal(second.format, draftFormatFor(row.angles[1], { subtype: 'offer' }))
  assert.notEqual(second.format, 'offer')
})

test('planOfferIdeas: เติมเมื่อคิวว่างและถึงรอบ · หมุนหัวข้อที่เก่าที่สุด · --add เลือกเอง', () => {
  const day = (d) => new Date(now.getTime() - d * 86400000).toISOString()
  assert.equal(planOfferIdeas(config, [], { now }).length, 1, 'ยังไม่เคยมี = เติม 1 หัวข้อ')
  assert.equal(planOfferIdeas(config, [], { now })[0].key, 'khaifak-condo')
  const pending = [{ external_key: 'offer:khaifak-condo:2026-W45', status: 'new', created_at: day(10) }]
  assert.equal(planOfferIdeas(config, pending, { now }).length, 0, 'ยังมีหัวข้อค้างในคิว')
  const recent = [{ external_key: 'offer:khaifak-condo:2026-W46', status: 'picked', created_at: day(2) }]
  assert.equal(planOfferIdeas(config, recent, { now }).length, 0, 'ยังไม่ครบ cadence_days')
  const old = [
    { external_key: 'offer:khaifak-condo:2026-W44', status: 'picked', created_at: day(20) },
    { external_key: 'offer:khaifak-house:2026-W45', status: 'dismissed', created_at: day(9) },
  ]
  assert.equal(planOfferIdeas(config, old, { now })[0].key, 'khaifak-land', 'หัวข้อที่ยังไม่เคยสร้างมาก่อน')
  assert.deepEqual(planOfferIdeas(config, pending, { now, keys: ['khaifak-house', 'khaifak-land'] }).map((t) => t.key), ['khaifak-house', 'khaifak-land'])
  assert.equal(planOfferIdeas(config, pending, { now, force: true }).length, 1, '--force ข้ามรอบเวลา')
})

test('offerSummary: พื้นที่ไม่เขียนว่า "เฉพาะ" · ขั้นตอนตามลำดับของแบรนด์', () => {
  const summary = offerSummary(offerTopics(config)[1], brand)
  assert.doesNotMatch(summary, /เฉพาะ(กรุงเทพ|พื้นที่)/)
  assert.ok(summary.indexOf('ส่งข้อมูลทรัพย์') < summary.indexOf('จดทะเบียนที่สำนักงานที่ดินและรับเงิน'))
})

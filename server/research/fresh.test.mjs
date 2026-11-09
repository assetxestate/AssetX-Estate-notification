// เทสต์ "คิดคอนเทนต์ใหม่ด้วย AI" (server/research/fresh.js) — ไม่เรียก AI จริง
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildFreshAnglesPrompt, pickFreshAngle, avoidAnglesFrom, cleanFreshNote, generateFreshContent, FRESH_AVOID_MAX } from './fresh.js'
import { draftableIdea } from './drafts.js'

const brand = JSON.parse(readFileSync(new URL('../../research/brand_facts.json', import.meta.url), 'utf8'))
const NOW = () => new Date('2026-11-09T12:00:00Z')

const body = (lead) => [
  lead,
  'ประเด็นแรก ตรวจเอกสารสิทธิ์และภาระผูกพันกับสำนักงานที่ดินก่อนตกลงอะไรทั้งสิ้น เพราะเงื่อนไขที่คุยกันทางแชตไม่ผูกพันเท่าสิ่งที่จดทะเบียน',
  'ประเด็นที่สอง แยกค่าใช้จ่ายรวมออกเป็นรายการ ค่าธรรมเนียม ภาษี และค่าบริการ แล้วขอสรุปเป็นลายลักษณ์อักษร',
  'ประเด็นที่สาม สิทธิไถ่ถอนและกำหนดเวลาต้องอยู่ในสัญญา ไม่ใช่คำพูด',
  'ข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี',
  'ทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้ ปิดข้อมูลส่วนบุคคลได้',
].join('\n\n')

const otherBody = (lead) => [
  lead,
  'ก่อนนัดโอนที่สำนักงานที่ดิน ให้ถามกำหนดวันไถ่คืนเป็นวันที่ชัดเจน แล้วจดลงปฏิทินของตัวเองทันที',
  'ถ้าจะไถ่คืนก่อนครบกำหนด ให้ถามล่วงหน้าว่าต้องแจ้งอีกฝ่ายกี่วัน และต้องเตรียมเอกสารอะไรไปที่สำนักงานที่ดิน',
  'ถ้าครบกำหนดแล้วอีกฝ่ายไม่มารับเงิน กฎหมายให้นำเงินไปวางที่สำนักงานวางทรัพย์ได้ ควรเก็บหลักฐานการติดต่อไว้ทุกครั้ง',
  'ข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี',
  'ทักแชต AssetX Estate ถามขั้นตอนไถ่คืนก่อนตัดสินใจได้',
].join('\n\n')

const idea = (extra = {}) => ({
  id: 33,
  status: 'new',
  source: 'manual',
  source_label: 'วางเอง',
  subtype: 'law',
  title: 'ขายฝากอย่างไรให้ลดความเสี่ยง',
  summary: 'เจ้าของที่ดินถามว่าก่อนเซ็นขายฝากต้องตรวจอะไรบ้าง',
  audience: null,
  angles: [
    { label: 'วิธีป้องกันความเสี่ยง', brief: 'เช็กลิสต์สามข้อที่เจ้าของที่ดินต้องตรวจก่อนเซ็นขายฝาก', draft: { headline: 'ก่อนเซ็นขายฝาก', caption: body('ก่อนเซ็นขายฝากที่ดินของคุณ มีสามเรื่องที่ต้องเห็นเป็นตัวหนังสือ'), format: 'checklist' } },
    { label: 'ถามตอบสิทธิไถ่คืน', brief: 'ตอบคำถามที่เจ้าของทรัพย์ถามบ่อยเรื่องสิทธิไถ่คืน' },
  ],
  ...extra,
})

test('cleanFreshNote: บรรทัดเดียว ตัดข้อมูลบุคคล ไม่เกิน 200 ตัวอักษร', () => {
  const note = cleanFreshNote('  ภาษาเป็นกันเองขึ้น\nโทร 081-234-5678  ')
  assert.doesNotMatch(note, /081/)
  assert.doesNotMatch(note, /\n/)
  assert.match(note, /^ภาษาเป็นกันเองขึ้น/)
  assert.equal(cleanFreshNote('ก'.repeat(500)).length, 200)
  assert.equal(cleanFreshNote(null), '')
})

test('buildFreshAnglesPrompt: บอกมุมที่มีแล้ว (ห้ามซ้ำ) + คำขอของเจ้าของ · คนอ่านยังเป็นเจ้าของทรัพย์กลุ่มเดียว', () => {
  const { system, prompt } = buildFreshAnglesPrompt({ idea: idea(), brand, existing: idea().angles, note: 'สั้นลง โทร 0812345678' })
  assert.match(prompt, /มุมเล่าที่ทีมมีแล้ว[^\n]*ห้ามเสนอซ้ำ/)
  assert.match(prompt, /1\. วิธีป้องกันความเสี่ยง — เช็กลิสต์สามข้อ/)
  assert.match(prompt, /2\. ถามตอบสิทธิไถ่คืน/)
  assert.match(prompt, /คำขอเพิ่มเติมจากเจ้าของเพจ[^\n]*: สั้นลง/)
  assert.doesNotMatch(prompt, /0812345678/)
  assert.match(prompt, /เสนอ 3 มุมเล่าใหม่ทั้งหมด/)
  assert.match(system, /ห้ามเขียนจากมุมคนปล่อยเงิน/)
  const plain = buildFreshAnglesPrompt({ idea: idea({ angles: [] }), brand, existing: [] })
  assert.doesNotMatch(plain.prompt, /มุมเล่าที่ทีมมีแล้ว|คำขอเพิ่มเติม/)
})

test('pickFreshAngle: ชื่อซ้ำ (ไม่สนช่องว่าง) หรือ brief คล้ายมุมเดิม = ไม่นับเป็นมุมใหม่ · เลือกมุมแรกที่ใหม่จริง', () => {
  const existing = idea().angles
  const picked = pickFreshAngle([
    { label: 'วิธีป้องกัน ความเสี่ยง', brief: 'อะไรก็ได้' },
    { label: 'เช็กลิสต์ก่อนเซ็น', brief: 'เช็กลิสต์สามข้อที่เจ้าของที่ดินต้องตรวจก่อนเซ็นขายฝาก' },
    { label: 'เคสสมมุติไถ่คืนไม่ทัน', brief: 'เล่าเคสสมมุติเจ้าของบ้านที่เกือบไถ่คืนไม่ทัน แล้วบอกสิ่งที่ควรทำล่วงหน้า' },
  ], existing)
  assert.equal(picked.label, 'เคสสมมุติไถ่คืนไม่ทัน')
  assert.equal(pickFreshAngle([{ label: 'ถามตอบสิทธิไถ่คืน', brief: 'x y z' }], existing), null)
  assert.equal(pickFreshAngle([], existing), null)
})

test('avoidAnglesFrom: ร่างที่เจ้าของไม่ชอบ → มุมหลอกที่มีร่าง (ไม่เกิน 3) · ข้อมูลบุคคลถูกตัด · ไม่มีข้อความ = ข้าม', () => {
  const out = avoidAnglesFrom([{ headline: 'h', caption: 'โทร 081-234-5678 นะ' }, { caption: '' }, null, ...Array(5).fill({ caption: 'x' })])
  assert.equal(out.length, FRESH_AVOID_MAX)
  assert.doesNotMatch(out[0].draft.caption, /081/)
  assert.equal(out[0].brief, '')
  assert.deepEqual(avoidAnglesFrom(undefined), [])
})

test('draftableIdea: มีข้อเท็จจริง/วางเอง · เตือนภัย · ไม่มีอะไรเลย = ไม่ร่าง (กันการแต่งเรื่อง)', () => {
  assert.equal(draftableIdea({ source: 'manual', summary: 'x' }).ok, true)
  assert.equal(draftableIdea({ source: 'news', summary: '📌 ข้อเท็จจริง' }).basis, 'research')
  assert.equal(draftableIdea({ source: 'news', subtype: 'scam', summary: '' }).basis, 'scam')
  const no = draftableIdea({ source: 'youtube', subtype: 'market', summary: '⚠️ ยังไม่ได้ถอดคำบรรยาย' })
  assert.equal(no.ok, false)
  assert.match(no.reason, /ไม่มีข้อเท็จจริง/)
})

test('generateFreshContent: มุมซ้ำถูกข้าม → ได้มุมใหม่ + ร่างเต็มที่ผ่านด่าน · คำสั่งร่างเลี่ยงร่างเดิมทุกชิ้นและพาคำขอของเจ้าของไปด้วย', async () => {
  const calls = []
  const ask = async ({ system, prompt }) => {
    calls.push({ system, prompt })
    if (calls.length === 1) {
      return { ok: true, provider: 'codex', data: [
        { label: 'วิธีป้องกันความเสี่ยง', brief: 'ซ้ำของเดิม' },
        { label: 'ไถ่คืนให้ทันกำหนด', brief: 'เล่าขั้นตอนไถ่คืนทีละขั้น ให้เจ้าของทรัพย์วางแผนวันไถ่คืนได้ไม่พลาด' },
        { label: 'ถามตอบค่าใช้จ่าย', brief: 'ตอบว่าค่าใช้จ่ายตอนขายฝากมีอะไรบ้าง' },
      ] }
    }
    return { ok: true, provider: 'codex', data: { headline: 'ไถ่คืนให้ทันกำหนด', caption: otherBody('ขายฝากที่ดินไปแล้ว อยากไถ่คืนให้ทัน ต้องวางแผนอะไรตั้งแต่วันเซ็น') } }
  }
  const out = await generateFreshContent({
    idea: idea(), brand, ask, now: NOW, sleep: async () => {},
    note: 'ภาษาเป็นกันเองขึ้น',
    avoid: [{ headline: 'ร่างที่ไม่ชอบ', caption: 'ขายฝากแล้วเสียที่ดิน เพราะไม่อ่านสัญญาให้ดี\n\nเนื้อหาเดิม' }],
  })
  assert.equal(out.ok, true, out.error)
  assert.equal(calls.length, 2)
  assert.equal(out.angle.label, 'ไถ่คืนให้ทันกำหนด')
  assert.equal(out.angle.draft.audience, 'A')
  assert.match(out.angle.draft.caption, /ไถ่คืนให้ทัน/)
  assert.deepEqual(out.angle.fresh, { at: '2026-11-09T12:00:00.000Z', note: 'ภาษาเป็นกันเองขึ้น' })
  const draftPrompt = calls[1].prompt
  assert.match(draftPrompt, /มุมเล่าที่ต้องใช้: ไถ่คืนให้ทันกำหนด/)
  assert.match(draftPrompt, /ห้ามเปิดด้วยประโยคแนวนี้[\s\S]*ก่อนเซ็นขายฝากที่ดินของคุณ[\s\S]*ขายฝากแล้วเสียที่ดิน/, 'เลี่ยงทั้งร่างของมุมเดิมและร่างที่เจ้าของไม่ชอบ')
  assert.match(draftPrompt, /คำขอเพิ่มเติมจากเจ้าของเพจสำหรับโพสต์นี้[^\n]*: ภาษาเป็นกันเองขึ้น/)
})

test('generateFreshContent: ไอเดียที่ไม่มีข้อเท็จจริง = ไม่เรียก AI · ร่างไม่ผ่านด่านครบ 3 ครั้ง = ล้มพร้อมเหตุผล · มุมซ้ำทั้งสองรอบ = ล้ม', async () => {
  let called = 0
  const noFacts = await generateFreshContent({ idea: idea({ source: 'youtube', subtype: 'market', summary: '⚠️ ยังไม่ได้ถอด' }), brand, ask: async () => { called += 1; return { ok: false } } })
  assert.equal(noFacts.ok, false)
  assert.equal(called, 0)

  let draftCalls = 0
  const badDraft = await generateFreshContent({
    idea: idea(), brand, now: NOW, sleep: async () => {},
    ask: async ({ prompt }) => {
      if (/เสนอ 3 มุมเล่าใหม่/.test(prompt)) return { ok: true, provider: 'codex', data: [{ label: 'มุมใหม่จริง', brief: 'เล่าเรื่องที่ไม่เหมือนเดิมเลยสักนิด เกี่ยวกับการเตรียมเอกสาร' }, { label: 'อีกมุม', brief: 'อีกเรื่อง' }] }
      draftCalls += 1
      return { ok: true, provider: 'codex', data: { headline: 'สั้น', caption: 'สั้นเกินไป' } }
    },
  })
  assert.equal(badDraft.ok, false)
  assert.equal(draftCalls, 3, 'ลองร่าง 3 ครั้งก่อนยอมแพ้')
  assert.match(badDraft.error, /ไม่ผ่านด่านตรวจ/)

  const dup = await generateFreshContent({
    idea: idea(), brand, now: NOW, sleep: async () => {},
    ask: async () => ({ ok: true, provider: 'codex', data: [{ label: 'วิธีป้องกันความเสี่ยง', brief: 'a' }, { label: 'ถามตอบสิทธิไถ่คืน', brief: 'b' }] }),
  })
  assert.equal(dup.ok, false)
  assert.match(dup.error, /ซ้ำกับมุมเดิม/)
})

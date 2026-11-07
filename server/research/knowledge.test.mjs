import test from 'node:test'
import assert from 'node:assert/strict'
import { loadKnowledgeBase, matchKnowledge, knowledgeFactLines, knowledgeSourceLabels, knowledgeForIdea, knowledgeForAngle, KB_MIN_MATCHES } from './knowledge.js'
import { buildDraftPrompt, generateDrafts } from './drafts.js'

const kb = loadKnowledgeBase()
const brand = { brand: 'AssetX Estate', services: ['ขายฝาก', 'จำนอง'], must_say: ['ดอกเบี้ยไม่เกิน 15% ต่อปี'], forbidden_phrases: ['อนุมัติทุกเคส'] }
const longBody = (lead) => `${lead}\n\n1. วันครบกำหนดไถ่อยู่ในสัญญา ก่อนถึงวันนั้นไม่น้อยกว่า 3 เดือน ผู้ซื้อฝากต้องส่งหนังสือแจ้งทางไปรษณีย์ลงทะเบียนตอบรับ พร้อมสำเนาสัญญา\n\n2. ถ้าไม่ได้รับหนังสือแจ้งตามเวลา ผู้ขายฝากยังไถ่ได้อีก 6 เดือนนับจากวันครบกำหนดตามสัญญา\n\n3. ถ้าติดต่อผู้ซื้อฝากไม่ได้ ไถ่ได้ด้วยการวางทรัพย์ที่สำนักงานที่ดินที่จดทะเบียน\n\nข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี\n\nส่งสำเนาสัญญาขายฝากมาทางแชต ทีม AssetX Estate ช่วยดูวันครบกำหนดให้`

test('คลังความรู้: โหลดได้ ทุกข้อมีที่มา/ref/ระดับความมั่นใจ · มีทั้ง official และ secondary · ไม่มีเบอร์/ข้อมูลบริษัท', () => {
  assert.ok(kb.entries.length >= 30, `ควรมีอย่างน้อย 30 ข้อ (มี ${kb.entries.length})`)
  for (const e of kb.entries) {
    assert.ok(e.ref, `${e.id} ไม่มี ref`)
    assert.ok(kb.sources[e.source], `${e.id} อ้างแหล่งที่ไม่มี`)
    assert.ok(['official', 'secondary'].includes(e.confidence))
    assert.doesNotMatch(e.fact, /0\d{1,2}-?\d{3}-?\d{4}|LINE|AssetX/, `${e.id} มีเบอร์/แบรนด์`)
  }
  assert.ok(kb.entries.some((e) => e.confidence === 'official' && e.source === 'act2562'))
  assert.ok(kb.entries.some((e) => e.confidence === 'secondary'))
  const ids = kb.entries.map((e) => e.id)
  assert.equal(new Set(ids).size, ids.length, 'id ซ้ำ')
})

test('matchKnowledge: จับคู่จากหัวข้อ+มุมเล่า · หัวข้อนับสองเท่า · ไม่เกี่ยว = ว่าง', () => {
  const sale = matchKnowledge({ title: 'ขายฝาก เช็กเงื่อนไขก่อนตัดสินใจ', angle: { label: 'ค่าใช้จ่ายและสินไถ่', brief: 'วันครบกำหนด แจ้งเตือน ไถ่ถอน' } }, { kb })
  assert.ok(sale.length >= KB_MIN_MATCHES)
  assert.ok(sale.some((e) => e.id === 'act-sinthai-cap'), 'เพดานสินไถ่ 15% ต้องติดมา')
  assert.ok(sale.some((e) => e.id === 'act-notice'), 'การแจ้งเตือนก่อนครบกำหนดต้องติดมา')
  const mortgage = matchKnowledge({ title: 'จำนองบ้าน ผิดนัดแล้วโดนยึดทันทีไหม', angle: { label: 'บังคับจำนอง' } }, { kb })
  assert.equal(mortgage[0].id, 'mortgage-enforce', 'หัวข้อตรงกับการบังคับจำนองต้องขึ้นก่อน')
  assert.deepEqual(matchKnowledge({ title: 'เมนูอาหารเช้า', angle: { label: 'สูตร' } }, { kb }), [])
  assert.ok(matchKnowledge({ title: 'ขายฝาก' }, { kb, max: 3 }).length <= 3)
})

test('บรรทัดสำหรับ prompt: มีที่มาทุกข้อ · ข้อ secondary ติดป้าย [ยืนยันตัวเลข] · รายชื่อแหล่งไม่ซ้ำ', () => {
  const entries = matchKnowledge({ title: 'ค่าใช้จ่ายวันจดทะเบียนขายฝาก มีอะไรบ้าง', angle: { label: 'ค่าธรรมเนียม ภาษี อากรแสตมป์' } }, { kb })
  const lines = knowledgeFactLines(entries, kb)
  assert.ok(lines.every((l) => /\(ที่มา: /.test(l)))
  assert.ok(lines.some((l) => /\[ยืนยันตัวเลข\]$/.test(l)), 'ค่าธรรมเนียม 2% เป็นแหล่งรอง')
  assert.ok(lines.some((l) => /กรมที่ดิน หัวข้อภาษี/.test(l) && !/\[ยืนยันตัวเลข\]/.test(l)), 'ภาษีจากหน้ากรมที่ดินเป็น official')
  const labels = knowledgeSourceLabels(entries, kb)
  assert.equal(new Set(labels).size, labels.length)
})

test('buildDraftPrompt: ไอเดียไม่มีข้อเท็จจริง + คลังความรู้ → ส่งข้อเท็จจริงจากคลังแทนบรรทัด "มีแค่หัวข้อ" · มีข้อเท็จจริงอยู่แล้ว → แนบคลังเป็นส่วนเสริม', () => {
  const idea = { id: 1, title: 'ขายฝาก สิทธิไถ่ถอน ใครแจ้งเตือน', summary: '⚠️ ยังไม่ได้ถอดคำบรรยาย', source: 'youtube', subtype: 'knowledge', angles: [] }
  const entries = matchKnowledge({ title: idea.title, angle: { label: 'ไถ่ถอน', brief: 'แจ้งเตือนก่อนครบกำหนด' } }, { kb })
  const { prompt, system } = buildDraftPrompt({ idea, angle: { label: 'ไถ่ถอน', brief: 'แจ้งเตือนก่อนครบกำหนด' }, brand: {}, knowledge: entries, kb })
  assert.match(prompt, /ข้อเท็จจริงที่มี \(จากคลังความรู้ AssetX/)
  assert.match(prompt, /ไปรษณีย์ลงทะเบียนตอบรับ/)
  assert.doesNotMatch(prompt, /มีแค่หัวข้อ/)
  assert.match(system, /คลังความรู้/)
  const withFacts = { ...idea, summary: '📌 ข้อเท็จจริง: กรมที่ดินแนะนำให้ตรวจสัญญาก่อนลงนาม', source: 'news', source_label: 'กรมที่ดิน' }
  const p2 = buildDraftPrompt({ idea: withFacts, angle: { label: 'ไถ่ถอน' }, brand: {}, knowledge: entries, kb }).prompt
  assert.match(p2, /ข้อเท็จจริงที่มี \(ใช้ได้เฉพาะเท่านี้/)
  assert.match(p2, /ความรู้เสริมจากคลัง AssetX/)
  const none = buildDraftPrompt({ idea, angle: { label: 'ไถ่ถอน' }, brand: {} }).prompt
  assert.match(none, /มีแค่หัวข้อ/)
})

test('knowledgeForIdea: ตัดสินจากหัวข้อ+ข้อเท็จจริง ไม่ดูมุมเล่า · คำทั่วไป "ขายฝาก/จำนอง" ในมุมอย่างเดียวไม่ทำให้ข่าวนอกเรื่องผ่าน · knowledgeForAngle ใช้มุมช่วยเลือก ไม่ถึงเกณฑ์ใช้ชุดทั้งไอเดีย', () => {
  const award = { title: 'งานประกาศรางวัลนายหน้าอสังหาฯ ประจำปี', summary: '⚠️ ดึงเนื้อข่าวไม่ได้', angles: [{ label: 'ขายฝากกับนายหน้า', brief: 'บริการขายฝาก จำนอง ของเรา' }] }
  assert.ok(knowledgeForIdea(award, { kb }).length < KB_MIN_MATCHES, 'ข่าวรางวัลนายหน้าไม่ควรได้ร่างกฎหมายขายฝาก')
  const idea = { title: 'ใกล้วันไถ่ถอนขายฝาก แต่ติดต่อผู้ซื้อฝากไม่ได้', summary: '⚠️ ยังไม่ได้ถอดคำบรรยาย', angles: [{ label: 'เตรียมตัวก่อนวันไถ่ถอน', brief: 'วางทรัพย์ แจ้งเตือน ครบกำหนด' }, { label: 'มุมอารมณ์', brief: 'เล่าความรู้สึก' }] }
  const whole = knowledgeForIdea(idea, { kb })
  assert.ok(whole.length >= KB_MIN_MATCHES)
  assert.ok(whole.some((e) => e.id === 'act-deposit'))
  const vague = knowledgeForAngle(idea, idea.angles[1], { kb })
  assert.deepEqual(vague.map((e) => e.id), whole.slice(0, 6).map((e) => e.id), 'มุมที่ไม่มีคำตรงคลัง → ได้ชุดของทั้งไอเดีย')
  const sharp = knowledgeForAngle(idea, idea.angles[0], { kb })
  assert.ok(sharp.some((e) => e.id === 'act-notice'))
})

test('generateDrafts + kb: ไอเดียไม่มีข้อเท็จจริงได้ข้อจากคลังใน prompt · ร่างบันทึก facts_source=knowledge และรายชื่อแหล่ง · ไอเดียมีข้อเท็จจริง = research', async () => {
  const prompts = []
  const ask = async ({ prompt }) => { prompts.push(prompt); return { ok: true, provider: 'codex', data: { headline: 'ก่อนวันไถ่ถอน ต้องรู้อะไร', caption: longBody('ใกล้วันครบกำหนดไถ่ แต่ยังไม่มีหนังสือจากผู้ซื้อฝาก ทำอย่างไรต่อ') } } }
  const idea = { id: 40, source: 'ad_library', subtype: 'competitor', title: 'ขายฝาก ไถ่ถอน วันครบกำหนด', summary: 'ข้อความแอด: รับซื้อฝากทุกทำเล [เรต]', angles: [{ label: 'สิทธิก่อนครบกำหนด', brief: 'แจ้งเตือน วางทรัพย์' }] }
  const result = await generateDrafts({ ideas: [idea], brand, ask, onSave: async () => {}, sleep: async () => {}, delayMs: 0, kb })
  assert.deepEqual(result.done, [{ id: 40, drafts: 1 }], JSON.stringify(result.failed))
  assert.match(prompts[0], /ข้อเท็จจริงที่มี \(จากคลังความรู้ AssetX/)
  assert.match(prompts[0], /พ\.ร\.บ\.คุ้มครองประชาชนในการทำสัญญาขายฝาก/)
  const saved = []
  await generateDrafts({ ideas: [idea], brand, ask, onSave: async (_id, angles) => saved.push(angles[0].draft), sleep: async () => {}, delayMs: 0, kb })
  assert.equal(saved[0].facts_source, 'knowledge')
  assert.ok(saved[0].knowledge.ids.includes('act-notice'))
  assert.ok(saved[0].knowledge.sources.some((s) => /พ\.ร\.บ\./.test(s)))
  const facts = { ...idea, id: 41, source: 'news', subtype: 'market', summary: '📌 กรมที่ดินเตือนให้ตรวจวันครบกำหนดในสัญญา' }
  const saved2 = []
  await generateDrafts({ ideas: [facts], brand, ask, onSave: async (_id, angles) => saved2.push(angles[0].draft), sleep: async () => {}, delayMs: 0, kb })
  assert.equal(saved2[0].facts_source, 'research')
  assert.match(prompts.at(-1), /ความรู้เสริมจากคลัง AssetX/)
  const noKb = []
  await generateDrafts({ ideas: [idea], brand, ask, onSave: async (_id, angles) => noKb.push(angles[0].draft), sleep: async () => {}, delayMs: 0 })
  assert.equal(noKb[0].facts_source, 'none')
  assert.equal(noKb[0].knowledge, undefined)
})

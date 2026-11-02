import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildAnglesPrompt, parseAngles, creditPolicy, noteFor, generateAngles, SUBTYPE_NOTES } from './angles.js'
import { extractJson } from './llm.js'

const brand = JSON.parse(readFileSync(new URL('../../research/brand_facts.json', import.meta.url), 'utf8'))
const sources = JSON.parse(readFileSync(new URL('../../research/idea_sources.json', import.meta.url), 'utf8'))

test('ทุก subtype ในคอนฟิกมีกติกามุมเล่าไม่ว่าง', () => {
  for (const subtype of Object.keys(sources.subtypes).filter((k) => !k.startsWith('_'))) {
    assert.ok(noteFor(subtype, 'news').length > 20, subtype)
  }
  assert.equal(noteFor('ไม่มี', 'news'), SUBTYPE_NOTES.market)
  assert.notEqual(noteFor(undefined, 'social'), SUBTYPE_NOTES.market)
})

test('นโยบายเครดิต: news/official/auction อ้าง · community/youtube/social/competitor ไม่อ้าง', () => {
  assert.equal(creditPolicy({ source: 'news', subtype: 'market' }, brand), 'cite')
  assert.equal(creditPolicy({ source: 'official', subtype: 'rate' }, brand), 'cite')
  assert.equal(creditPolicy({ source: 'community', subtype: 'community_q' }, brand), 'no_cite')
  assert.equal(creditPolicy({ source: 'youtube', subtype: 'competitor' }, brand), 'no_cite')
  assert.equal(creditPolicy({ source: 'news', subtype: 'competitor' }, brand), 'no_cite', 'subtype competitor ชนะ source')
})

test('prompt: ล้าง PII · เก็บชื่อสำนักเมื่อต้องอ้าง · ล้างชื่อเพจเมื่อห้ามอ้าง · มีความจริงของแบรนด์และคำต้องห้าม', () => {
  const cite = buildAnglesPrompt({ idea: { source: 'news', source_label: 'ฐานเศรษฐกิจ', subtype: 'fee_measure', title: 'ครม.ต่ออายุลดค่าโอน โทร 081-234-5678', summary: 'มีผลถึง 30 มิ.ย. 2570', audience: ['C', 'D'], event_date: '2027-06-30' }, brand })
  assert.match(cite.prompt, /ที่มา: ฐานเศรษฐกิจ/)
  assert.doesNotMatch(cite.prompt, /081-234/)
  assert.match(cite.prompt, /\[ลบ\]/)
  assert.match(cite.prompt, /- C:/)
  assert.doesNotMatch(cite.prompt, /- A:/)
  assert.match(cite.prompt, /2027-06-30/)
  assert.match(cite.system, /อนุมัติทุกเคส/)
  assert.match(cite.system, /ชลบุรี/)
  assert.match(cite.system, /15% ต่อปี/)
  assert.equal(cite.policy, 'cite')

  const noCite = buildAnglesPrompt({ idea: { source: 'community', source_label: 'Pantip ชายคา', subtype: 'community_q', title: 'กู้ไม่ผ่าน มีโฉนด ทำยังไง' }, brand })
  assert.doesNotMatch(noCite.prompt, /Pantip/)
  assert.match(noCite.prompt, /ห้ามอ้างชื่อเพจ/)
  assert.match(noCite.prompt, /มีแค่หัวข้อ — ห้ามเดารายละเอียด/)
  assert.match(noCite.prompt, /- A:[\s\S]*- D:/)
})

test('parseAngles: รับ array หรือ {angles} · ตัด label 22 ตัว · ล้าง PII · ต้องได้ ≥ 2', () => {
  const ok = parseAngles([{ label: 'เช็กลิสต์ก่อนเซ็น ยาวเกินยี่สิบสองตัวอักษรแน่นอน', brief: 'โพสต์เช็กลิสต์ 5 ข้อ' }, { label: 'ถามตอบ', brief: 'Q&A ติดต่อ 081-111-2222' }, { label: 'ถามตอบ', brief: 'ซ้ำ' }, { label: 'เตือนภัย', brief: 'x' }])
  assert.equal(ok.length, 3)
  assert.equal(ok[0].label.length, 22)
  assert.match(ok[1].brief, /\[ลบ\]/)
  assert.equal(parseAngles({ angles: [{ label: 'a', brief: 'b' }, { label: 'c', brief: 'd' }] }).length, 2)
  assert.equal(parseAngles([{ label: 'a', brief: 'b' }]), null)
  assert.equal(parseAngles('ข้อความ'), null)
  assert.deepEqual(extractJson('```json\n[{"label":"x","brief":"y"},{"label":"z","brief":"w"}]\n```').length, 2)
  assert.deepEqual(extractJson('นี่คือคำตอบ: {"angles":[]} จบ'), { angles: [] })
  assert.equal(extractJson('ไม่มี json'), null)
})

test('generateAngles: ลองใหม่ 1 ครั้ง · บันทึกทีละแถว · หยุดเมื่อไม่มีผู้ให้บริการ', async () => {
  let calls = 0
  const ask = async () => {
    calls += 1
    if (calls === 1) return { ok: true, provider: 'hermes', data: [{ label: 'เดียว', brief: 'x' }] }
    return { ok: true, provider: 'hermes', data: [{ label: 'ก', brief: '1' }, { label: 'ข', brief: '2' }, { label: 'ค', brief: '3' }] }
  }
  const saved = []
  const result = await generateAngles({ ideas: [{ id: 1, source: 'news', subtype: 'market', title: 't' }], brand, ask, onSave: async (id, angles) => saved.push([id, angles.length]), sleep: async () => {}, delayMs: 0 })
  assert.equal(calls, 2)
  assert.deepEqual(saved, [[1, 3]])
  assert.equal(result.done.length, 1)

  const none = await generateAngles({ ideas: [{ id: 1 }, { id: 2 }], brand, ask: async () => ({ ok: false, error: 'ไม่มีผู้ให้บริการ AI' }), sleep: async () => {}, delayMs: 0 })
  assert.equal(none.failed.length, 1, 'หยุดหลังตัวแรก ไม่วนต่อ')
})

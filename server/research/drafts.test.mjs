import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildDraftPrompt, parseDraft, generateDrafts, draftFormatFor, pickDraftFormat, usedPoints, hasResearchFacts, needsDraft, cleanTitleForPrompt, ensureClosing, tidyHeadline, splitInlineList, thaiDates, validCta, defaultCta, splitFactsNotes, socialCaption, DRAFT_MIN_CHARS } from './drafts.js'

const brand = JSON.parse(readFileSync(new URL('../../research/brand_facts.json', import.meta.url), 'utf8'))

const longBody = (lead) => [
  lead,
  'ประเด็นแรก ตรวจเอกสารสิทธิ์และภาระผูกพันกับสำนักงานที่ดินก่อนตกลงอะไรทั้งสิ้น เพราะเงื่อนไขที่คุยกันทางแชตไม่ผูกพันเท่าสิ่งที่จดทะเบียน',
  'ประเด็นที่สอง แยกค่าใช้จ่ายรวมออกเป็นรายการ ค่าธรรมเนียม ภาษี และค่าบริการ แล้วขอสรุปเป็นลายลักษณ์อักษร',
  'ประเด็นที่สาม สิทธิไถ่ถอนและกำหนดเวลาต้องอยู่ในสัญญา ไม่ใช่คำพูด',
  'ข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี',
  'ทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้ ปิดข้อมูลส่วนบุคคลได้',
].join('\n\n')

test('draftFormatFor: เลือกโครงจากชื่อ/คำอธิบายมุม · news ต้องมีข้อเท็จจริงไม่งั้นถอยเป็น explain', () => {
  assert.equal(draftFormatFor({ label: 'เช็กลิสต์ก่อนเซ็น', brief: 'x' }), 'checklist')
  assert.equal(draftFormatFor({ label: 'คำถามที่พบบ่อย', brief: 'รวบรวมคำถาม' }), 'qa')
  assert.equal(draftFormatFor({ label: 'เคสสมมุติ ธปท.', brief: 'เล่าเคสสมมุติ' }), 'case')
  assert.equal(draftFormatFor({ label: 'เตือนภัย', brief: 'มิจฉาชีพหลอกเซ็น' }), 'warning')
  assert.equal(draftFormatFor({ label: 'ประเมินความเสี่ยง', brief: 'ให้ความรู้เรื่องความเสี่ยงในการจำนองคอนโด พร้อมวิธีลดความเสี่ยง' }), 'explain', '"ความเสี่ยง" อย่างเดียวไม่ใช่เรื่องโกง ห้ามเข้าโครงเตือนภัย')
  assert.equal(draftFormatFor({ label: 'ข้อมูลใหม่ ธปท.', brief: 'อธิบายประกาศ' }, { hasFacts: true }), 'news')
  assert.equal(draftFormatFor({ label: 'ข้อมูลใหม่ ธปท.', brief: 'อธิบายประกาศ' }, { hasFacts: false }), 'explain')
  assert.equal(draftFormatFor({ label: 'วงเงินจำนองคอนโด', brief: 'อธิบายปัจจัย' }), 'explain')
})

test('hasResearchFacts / needsDraft / cleanTitleForPrompt', () => {
  assert.equal(hasResearchFacts({ summary: '⚠️ ยังไม่รู้เนื้อหาจริงของคลิป' }), false)
  assert.equal(hasResearchFacts({ summary: '' }), false)
  assert.equal(hasResearchFacts({ summary: '📌 กระทบกลุ่ม B · มีผล 1 พ.ย.' }), true)
  assert.equal(needsDraft({ angles: null }), false)
  assert.equal(needsDraft({ angles: [{ label: 'a', brief: 'b' }] }), true)
  assert.equal(needsDraft({ angles: [{ label: 'a', brief: 'b', draft: { caption: 'x' } }] }), false)
  assert.equal(cleanTitleForPrompt({ title: 'ฮาโลวีน Land For Loan ใครสวยสุด #จำนอง #ขายฝาก', source_label: 'Land for Loan' }, 'no_cite'), 'ฮาโลวีน ใครสวยสุด')
  assert.equal(cleanTitleForPrompt({ title: 'ครม.ต่ออายุลดค่าโอน', source_label: 'ฐานเศรษฐกิจ' }, 'cite'), 'ครม.ต่ออายุลดค่าโอน')
})

test('buildDraftPrompt: ข้อเท็จจริง+ที่มาเมื่อต้องอ้าง · ความจริงแบรนด์+คำต้องห้าม+กติกา compliance · โครงตามมุม · ห้ามเปิดซ้ำ · hint อยู่ท้ายสุด', () => {
  const idea = { source: 'official', source_label: 'ธนาคารแห่งประเทศไทย', subtype: 'law', title: 'ประกาศ ธปท. 57/2569 มีผล โทร 081-234-5678', summary: '📌 กระทบกลุ่ม B ที่ใช้เงินสดซื้อแคชเชียร์เช็ค', audience: ['B', 'A'], event_date: '2026-11-01' }
  const { system, prompt, policy, format } = buildDraftPrompt({ idea, angle: { label: 'ข้อมูลใหม่ ธปท.', brief: 'อธิบายประกาศ สำหรับกลุ่ม B' }, brand, avoidOpenings: ['เงินสดก้อนโต ธนาคารถามที่มาได้'], hint: 'ห้ามใส่ตัวเลข' })
  assert.equal(policy, 'cite')
  assert.equal(format, 'news')
  assert.match(prompt, /ที่มา: ธนาคารแห่งประเทศไทย/)
  assert.match(prompt, /ข้อเท็จจริงที่มี \(ใช้ได้เฉพาะเท่านี้\):\n- กระทบกลุ่ม B/)
  assert.doesNotMatch(prompt, /081-234/)
  assert.match(prompt, /- B:[\s\S]*- A:/)
  assert.doesNotMatch(prompt, /- C:/)
  assert.match(prompt, /2026-11-01/)
  assert.match(prompt, /รูปแบบโพสต์: อัปเดตพร้อมที่มา/)
  assert.match(prompt, /ห้ามเปิดด้วยประโยคแนวนี้[\s\S]*1\. เงินสดก้อนโต/)
  assert.ok(prompt.trimEnd().endsWith('สำคัญที่สุด: ห้ามใส่ตัวเลข'))
  assert.match(system, /ชลบุรี/)
  assert.match(system, /อนุมัติทุกเคส/)
  assert.match(system, /ข้อห้ามเด็ดขาด/)
  assert.match(system, /จดทะเบียนที่สำนักงานที่ดิน/)
  assert.match(system, /"needs_check"/)
})

test('parseDraft: เครื่องหมายคำพูดหลังป้าย ถาม:/ตอบ: ถูกลบ', () => {
  const caption = ['ถาม:"ขายฝากคืออะไร?', 'ตอบ:"ขายฝากคือการขายที่จดทะเบียนโอนกรรมสิทธิ์ทันที โดยผู้ขายฝากมีสิทธิไถ่คืนภายในกำหนดเวลาในสัญญา', '', 'ถาม: “ต้องเตรียมเอกสารอะไรบ้าง?', 'ตอบ: โฉนด บัตรประชาชน ทะเบียนบ้าน และตรวจภาระติดพันที่สำนักงานที่ดินก่อนทุกครั้ง', '', 'ข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี', '', 'ทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้ ปิดข้อมูลส่วนบุคคลได้'].join('\n')
  const r = parseDraft({ headline: 'ขายฝาก ถามตอบ', caption, cta: 'ทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้ ปิดข้อมูลส่วนบุคคลได้', hashtags: [], needs_check: [] }, { policy: 'no_cite', brand, subtype: 'social_fb', facts: '' })
  assert.equal(r.ok, true, r.error)
  assert.match(r.draft.caption, /^ถาม: ขายฝากคืออะไร\?$/m)
  assert.match(r.draft.caption, /^ตอบ: ขายฝากคือการขาย/m)
  assert.match(r.draft.caption, /^ถาม: ต้องเตรียมเอกสารอะไรบ้าง\?$/m)
  assert.doesNotMatch(r.draft.caption, /[:：]\s*["“”]/)
})

test('parseDraft: นิยามขายฝากผิด (ครอบครองชั่วคราว/ยังเป็นเจ้าของ/ไม่โอนกรรมสิทธิ์) ถูกปัด · ประโยคที่ปฏิเสธนิยามผิดผ่าน', () => {
  const base = { headline: 'ขายฝาก คืออะไร', cta: 'ส่งรูปเอกสารสิทธิ์มาทางแชต ทีม AssetX Estate ช่วยประเมินเบื้องต้นให้', hashtags: [], needs_check: [] }
  const opts = { policy: 'no_cite', brand, subtype: 'social_fb', facts: '' }
  for (const bad of ['ขายฝากคือการให้สิทธิ์การครอบครองทรัพย์สินชั่วคราวเพื่อรับเงิน', 'ทำขายฝากแล้วเจ้าของยังเป็นเจ้าของทรัพย์เหมือนเดิม', 'ขายฝากไม่โอนกรรมสิทธิ์ให้ใคร']) {
    const r = parseDraft({ ...base, caption: longBody(bad + ' เรื่องนี้ต้องดูสัญญาและเอกสารของแต่ละกรณีให้ดีก่อนตัดสินใจ') }, opts)
    assert.equal(r.ok, false, bad)
    assert.match(r.error, /นิยามขายฝากผิด/)
  }
  const good = parseDraft({ ...base, caption: longBody('ขายฝากไม่ใช่การให้ครอบครองชั่วคราว แต่เป็นการขายที่จดทะเบียนโอนกรรมสิทธิ์ทันที โดยผู้ขายฝากมีสิทธิไถ่คืนภายในกำหนดเวลาในสัญญา') }, opts)
  assert.equal(good.ok, true, good.error)
})

test('tidyHeadline: คำถามลงท้าย (ไหน/ไหม/บ้าง) ไม่ใช่เศษคำแม้ไม่อยู่ในแคปชั่น · "แค่" ค้างท้ายถูกตัด', () => {
  const caption = 'การทำธุรกรรมขายฝากมีค่าใช้จ่ายที่จำเป็นหลายอย่าง เช่น ค่าธรรมเนียมการจดทะเบียน ภาษี และอากรแสตมป์'
  assert.equal(tidyHeadline('ค่าใช้จ่ายขายฝาก จำเป็นแค่ไหน', caption.split('\n')[0], caption), 'ค่าใช้จ่ายขายฝาก จำเป็นแค่ไหน')
  assert.equal(tidyHeadline('ค่าใช้จ่ายขายฝาก จำเป็นแค่', caption.split('\n')[0], caption), 'ค่าใช้จ่ายขายฝาก จำเป็น')
  assert.equal(tidyHeadline('ขายฝากต้องเตรียมเอกสารอะไรบ้าง', 'เอกสารที่ต้องเตรียม', 'โฉนด บัตรประชาชน ทะเบียนบ้าน'), 'ขายฝากต้องเตรียมเอกสารอะไรบ้าง')
})

test('ไอเดียจากตัวเฝ้าเพจ Facebook (source social): ข้อความโพสต์ในเครื่องหมายคำพูดคือข้อเท็จจริง · ตัวเลขยอดไม่ส่งให้ AI · คำใบ้กลุ่มเพจเป็นหมายเหตุ · ไม่ใช้โครงอัปเดตพร้อมที่มา · ชื่อเรื่องตัดส่วน "แรงกว่าปกติ"', () => {
  const summary = '❤️ 50 · 💬 4 · ↗️ 2 · โพสต์ปกติของเพจ ≈ 25 เอ็นเกจ · เห็นครั้งแรก 3 พ.ย. 2026\n“ขายฝากที่ดินต้องเตรียมเอกสารอะไรบ้าง โฉนด บัตรประชาชน ทะเบียนบ้าน และใบปลอดภาระ มาดูกันว่าแต่ละอย่างใช้ทำอะไร”\nกลุ่มเพจ: คู่แข่งขายฝาก/จำนอง — ถอดว่าเขาเล่นมุม/ข้อเสนออะไรแล้วคนตอบรับ แล้วทำมุมของเราที่ต่างออกไปด้วยบริการจริงของเรา · เรต/ผลตอบแทนของเขาเป็นโฆษณา ไม่ใช่ข้อเท็จจริง · ห้ามเอ่ยชื่อ ห้ามลอกข้อความ/ภาพ\n(ตัวเฝ้าเพจ Facebook · บัญชีสำรอง อ่านอย่างเดียว · เทียบเอ็นเกจกับโพสต์อื่นของเพจ · ตัวเลขของเขาห้ามลงโพสต์เรา)'
  const idea = { source: 'social', source_label: 'Facebook · Cashpital รับจำนอง รับขายฝาก', subtype: 'social_fb', title: 'รูปแรงกว่าปกติของเพจ 2.0 เท่า — ขายฝากที่ดินต้องเตรียมเอกสารอะไรบ้าง', summary, audience: ['A'] }
  assert.equal(hasResearchFacts(idea), true)
  assert.equal(hasResearchFacts({ ...idea, summary: '❤️ 50 · เห็นครั้งแรก 3 พ.ย. 2026\nกลุ่มเพจ: สื่อ' }), false, 'ไม่มีข้อความโพสต์ = ไม่มีข้อเท็จจริง')
  assert.equal(hasResearchFacts({ ...idea, summary: '❤️ 50\n“สั้นไป”\nกลุ่มเพจ: สื่อ' }), false, 'ข้อความสั้นกว่า 40 ตัวอักษรไม่นับ')
  assert.equal(hasResearchFacts({ ...idea, summary: `❤️ 50\n“${'ยาวพอแต่เครื่องหมายปิดหายเพราะ summary ถูกตัดที่ 2000 ตัวอักษร '.repeat(2)}` }), true, 'เครื่องหมายปิดหาย (summary ถูกตัด) ยังอ่านได้')
  // “” ในบรรทัดหัวข้อ และ ” กลางข้อความโพสต์ ต้องไม่ทำให้ข้อเท็จจริงขาด (ผู้ตรวจ 7 พ.ย. 2569: แถวเก่าใน marketing_ideas ยังเป็นแบบนี้)
  assert.equal(socialCaption('❤️ 50 · หัวข้อ: “ขายฝาก” คืออะไร\n“โพสต์เน้นคำว่า ”ขายฝาก” กับ ”จำนอง” ว่าต่างกันตรงไหน และต้องเตรียมเอกสารอะไรบ้าง”\nกลุ่มเพจ: สื่อ'), 'โพสต์เน้นคำว่า ”ขายฝาก” กับ ”จำนอง” ว่าต่างกันตรงไหน และต้องเตรียมเอกสารอะไรบ้าง')
  assert.equal(socialCaption('ไม่ขึ้นบรรทัดใหม่ “ข้อความสั้น ๆ ในบรรทัดเดียวกัน” ท้าย'), 'ข้อความสั้น ๆ ในบรรทัดเดียวกัน', 'รูปเดิมยังเป็นทางสำรอง')
  const split = splitFactsNotes(summary, { source: 'social' })
  assert.deepEqual(split.facts, ['ขายฝากที่ดินต้องเตรียมเอกสารอะไรบ้าง โฉนด บัตรประชาชน ทะเบียนบ้าน และใบปลอดภาระ มาดูกันว่าแต่ละอย่างใช้ทำอะไร'])
  assert.ok(split.notes.some((n) => /กลุ่มเพจ: คู่แข่ง/.test(n)), 'คำใบ้กลุ่มเพจเป็นหมายเหตุ')
  assert.ok(split.notes.every((n) => !/❤️|💬|≈ \d|เห็นครั้งแรก/.test(n)), 'บรรทัดตัวเลขยอดของเพจไม่ไปถึง AI')
  assert.equal(cleanTitleForPrompt(idea, 'no_cite'), 'ขายฝากที่ดินต้องเตรียมเอกสารอะไรบ้าง')
  const { prompt, policy, format } = buildDraftPrompt({ idea, angle: { label: 'อัปเดตข้อมูลใหม่', brief: 'เล่าประกาศ' }, brand })
  assert.equal(policy, 'no_cite')
  assert.notEqual(format, 'news', 'แหล่งที่ห้ามอ้างไม่ใช้โครงอัปเดตพร้อมที่มา แม้มุมจะชื่ออัปเดต')
  assert.match(prompt, /ข้อเท็จจริงที่มี[^\n]*ข้อความโพสต์ของเพจอื่น/)
  assert.match(prompt, /- ขายฝากที่ดินต้องเตรียมเอกสารอะไรบ้าง/)
  assert.match(prompt, /หมายเหตุถึงผู้เขียน[^\n]*กลุ่มเพจ: คู่แข่ง/)
  assert.doesNotMatch(prompt, /❤️ 50|≈ 25 เอ็นเกจ/)
  assert.doesNotMatch(prompt, /Cashpital/)
  assert.doesNotMatch(prompt, /แรงกว่าปกติ/)
  // แหล่งที่อ้างได้ยังใช้โครงอัปเดตพร้อมที่มาได้เหมือนเดิม
  assert.equal(buildDraftPrompt({ idea: { source: 'official', source_label: 'ธนาคารแห่งประเทศไทย', subtype: 'rate', title: 'มติ กนง.', summary: '📌 มีมติคงอัตราดอกเบี้ยนโยบาย' }, angle: { label: 'อัปเดตข้อมูลใหม่', brief: 'เล่าประกาศ' }, brand }).format, 'news')
})

test('parseDraft: ชื่อเพจจากป้าย "Facebook · <ชื่อเพจ>" หลุดลงร่าง → แทนด้วย "เพจหนึ่ง" และตัดออกจากพาดหัว', () => {
  const caption = longBody('เพจ Cashpital รับจำนอง รับขายฝาก โพสต์เรื่องเอกสารที่ต้องเตรียมก่อนทำสัญญา ซึ่งต้องดูเอกสารจริงของแต่ละกรณี')
  const r = parseDraft({ headline: 'เอกสาร Cashpital รับจำนอง รับขายฝาก ก่อนเซ็น', caption, cta: 'ทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้ ปิดข้อมูลส่วนบุคคลได้', hashtags: [], needs_check: [] }, { policy: 'no_cite', sourceLabel: 'Facebook · Cashpital รับจำนอง รับขายฝาก', brand, subtype: 'social_fb', facts: '' })
  assert.equal(r.ok, true, r.error)
  assert.doesNotMatch(r.draft.caption, /Cashpital/)
  assert.match(r.draft.caption, /เพจ เพจหนึ่ง โพสต์เรื่อง/)
  assert.doesNotMatch(r.draft.headline, /Cashpital/)
  // คำละตินของชื่อเพจหลุดมาเดี่ยว ๆ (ไม่มีส่วนไทย) ก็ต้องถูกลบ · คำละตินทั่วไปอย่าง Facebook/AssetX ไม่โดน
  const r2 = parseDraft({ headline: 'Cashpital บอกอะไร', caption: longBody('โพสต์ของ Cashpital พูดถึงเอกสารก่อนทำสัญญา ซึ่งต้องดูเอกสารจริงของแต่ละกรณี'), cta: 'ทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้ ปิดข้อมูลส่วนบุคคลได้', hashtags: [], needs_check: [] }, { policy: 'no_cite', sourceLabel: 'Facebook · Cashpital รับจำนอง รับขายฝาก', brand, subtype: 'social_fb', facts: '' })
  assert.equal(r2.ok, true, r2.error)
  assert.doesNotMatch(`${r2.draft.headline}\n${r2.draft.caption}`, /Cashpital/)
  assert.match(r2.draft.caption, /AssetX Estate/)
})

test('parseDraft (no_cite): ชื่อแบรนด์ไทยของเพจเป็นคำเดี่ยว → ปัดตกเมื่อแอด/โพสต์เอ่ยชื่อตัวเอง · ไม่อยู่ในข้อเท็จจริง = ไม่ปัด · คำบริการ/จังหวัดในชื่อเพจไม่นับ · เรตของคู่แข่งเฉพาะ subtype แอด/เพจ · 15% (เพดานกฎหมาย) ไม่นับ', () => {
  const cta = 'ทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้ ปิดข้อมูลส่วนบุคคลได้'
  const base = { headline: 'ขายฝากกับจำนอง ต่างกันตรงไหน', cta, hashtags: [], needs_check: [] }
  const label = 'Meta Ad Library · ทุนที่ดิน รับจำนอง ขายฝาก พัทยา'
  const facts = 'แอดคู่แข่งรันนาน 67 วัน — ทุนที่ดิน อธิบาย\n“ทุนที่ดิน อธิบาย: ขายฝากโอนกรรมสิทธิ์ทันที ดอกเบี้ย 1.25% ต่อเดือน เพดานตามกฎหมาย 15% ต่อปี”'
  const leak = parseDraft({ ...base, headline: 'ทุนที่ดิน สอนอะไร', caption: longBody('เพจ ทุนที่ดิน อธิบายว่าขายฝากโอนกรรมสิทธิ์ทันที ซึ่งต้องดูเอกสารจริงของแต่ละกรณี') }, { policy: 'no_cite', sourceLabel: label, brand, subtype: 'ad_library', facts })
  assert.equal(leak.ok, false)
  assert.match(leak.error, /เอ่ยชื่อเพจต้นทาง.*ทุนที่ดิน/)
  const coincidence = parseDraft({ ...base, caption: longBody('ทุนที่ดินของครอบครัวควรดูเอกสารก่อน ซึ่งต้องดูเอกสารจริงของแต่ละกรณี') }, { policy: 'no_cite', sourceLabel: label, brand, subtype: 'ad_library', facts: '“โพสต์ที่ไม่เอ่ยชื่อตัวเอง”' })
  assert.equal(coincidence.ok, true, coincidence.error)
  const generic = parseDraft({ ...base, caption: longBody('รับจำนองหรือขายฝากที่พัทยา ต้องดูเอกสารจริงของแต่ละกรณี รีไฟแนนซ์ก็เช่นกัน') }, { policy: 'no_cite', sourceLabel: 'Meta Ad Library · รับจำนอง ขายฝาก ปิดบัญชี รีไฟแนนซ์ พัทยา', brand, subtype: 'ad_library', facts: '“รับจำนอง ขายฝาก รีไฟแนนซ์ พัทยา บริการครบ”' })
  assert.equal(generic.ok, true, generic.error)
  assert.match(generic.draft.caption, /รับจำนองหรือขายฝากที่พัทยา/)
  const rate = parseDraft({ ...base, caption: longBody('บางแอดโฆษณาดอกเบี้ย 1.25 % ต่อเดือน ซึ่งต้องดูสัญญาจริงของแต่ละกรณี') }, { policy: 'no_cite', sourceLabel: label, brand, subtype: 'ad_library', facts })
  assert.equal(rate.ok, false)
  assert.match(rate.error, /ตัวเลข %.*คู่แข่ง.*1\.25%/)
  const cap = parseDraft({ ...base, caption: longBody('กฎหมายกำหนดเพดานดอกเบี้ย 15% ต่อปี ซึ่งต้องดูสัญญาจริงของแต่ละกรณี') }, { policy: 'no_cite', sourceLabel: label, brand, subtype: 'ad_library', facts })
  assert.equal(cap.ok, true, cap.error)
  const youtube = parseDraft({ ...base, caption: longBody('ค่าธรรมเนียมจดจำนอง 1% ของวงเงิน ซึ่งต้องดูประกาศจริงของแต่ละกรณี') }, { policy: 'no_cite', sourceLabel: 'ช่องความรู้', brand, subtype: 'legal', facts: '📌 ค่าธรรมเนียมจดจำนอง 1% ของวงเงิน' })
  assert.equal(youtube.ok, true, youtube.error)
  const placeholder = parseDraft({ ...base, caption: longBody('บางแอดโฆษณาดอกเบี้ย [เรต] ต่อเดือน ซึ่งต้องดูสัญญาจริงของแต่ละกรณี') }, { policy: 'no_cite', sourceLabel: label, brand, subtype: 'ad_library', facts })
  assert.match(placeholder.error, /\[เรต\]/)
})

test('buildDraftPrompt: ไอเดียที่มีแค่หัวข้อ (⚠️) → โหมดความรู้ทั่วไป ไม่มีชื่อช่อง ไม่มีแฮชแท็กจากชื่อคลิป', () => {
  const idea = { source: 'youtube', source_label: 'Antonio Attorney', subtype: 'market', title: 'เอาคอนโดไปจำนองกู้เงิน ทำไมได้วงเงินน้อยกว่าที่คิด? #จำนองคอนโด', summary: '⚠️ ยังไม่รู้เนื้อหาจริงของคลิป · ช่องประเภท expert · ยอดดูตอนเก็บ 811', audience: ['B', 'C', 'D'] }
  const { prompt, policy, format } = buildDraftPrompt({ idea, angle: { label: 'ข่าววงเงินจำนองคอนโด', brief: 'อธิบายปัจจัยที่ส่งผลต่อวงเงิน' }, brand })
  assert.equal(policy, 'no_cite')
  assert.equal(format, 'explain', 'คำว่า "ข่าว" ในมุมแต่ไม่มีข้อเท็จจริง ต้องไม่ใช้โครงอัปเดต')
  assert.match(prompt, /มีแค่หัวข้อ/)
  assert.doesNotMatch(prompt, /Antonio/)
  assert.doesNotMatch(prompt, /#จำนองคอนโด/)
  assert.doesNotMatch(prompt, /ยอดดูตอนเก็บ/, 'summary ⚠️ ไม่ถูกส่งเป็นข้อเท็จจริง')
  assert.match(prompt, /ห้ามอ้างชื่อเพจ/)
})

test('parseDraft: ตัดแฮชแท็ก/ลิงก์ · ล้าง PII · เติม AssetXEstate · เติมที่มาเมื่อต้องอ้าง · เก็บคำเตือน · รับ {draft:{…}}', () => {
  const raw = { headline: 'เงินสด 5 ล้าน ธนาคารถามที่มาได้', caption: `${longBody('ตั้งแต่ 1 พ.ย. ธนาคารอาจถามที่มาของเงินสด ติดต่อ 081-234-5678 #ขายฝาก')} ดูที่ https://example.com/x`, cta: 'ทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้ ปิดข้อมูลส่วนบุคคลได้', hashtags: ['#ขายฝาก', 'ขายฝาก', 'จำนอง', 'ค่าโอน', 'เงินสด', 'ธปท', 'เกิน'], needs_check: ['ตัวบทประกาศฉบับจริง', ' วันที่มีผล ', ''] }
  const res = parseDraft({ draft: raw }, { policy: 'cite', sourceLabel: 'ธนาคารแห่งประเทศไทย' })
  assert.equal(res.ok, true, res.error)
  const { draft } = res
  assert.doesNotMatch(draft.caption, /#ขายฝาก|https?:\/\//)
  assert.match(draft.caption, /\[ลบ\]/)
  assert.match(draft.caption, /\n\nที่มา: ธนาคารแห่งประเทศไทย$/)
  assert.deepEqual(draft.hashtags, ['AssetXEstate', 'เงินสด'], 'แฮชแท็กที่ไม่อยู่ในโพสต์ (ขายฝาก จำนอง ค่าโอน ธปท) ถูกตัด')
  assert.deepEqual(draft.needs_check, ['ตัวบทประกาศฉบับจริง', 'วันที่มีผล'])
  assert.equal(draft.headline, 'เงินสด 5 ล้าน ธนาคารถามที่มาได้')
  assert.deepEqual(draft.warnings, [])
})

test('parseDraft: no_cite ลบชื่อแหล่งออกจากข้อความ · สั้นเกินไม่ผ่าน · คำต้องห้าม block ไม่ผ่าน · warn เก็บไว้ · headline ว่างใช้บรรทัดแรก', () => {
  const noCite = parseDraft({ headline: 'คลิป Antonio Attorney สอนอะไร', caption: longBody('จากคลิปของ Antonio Attorney วงเงินจำนองคอนโดขึ้นกับหลายปัจจัย') }, { policy: 'no_cite', sourceLabel: 'Antonio Attorney' })
  assert.equal(noCite.ok, true)
  assert.doesNotMatch(noCite.draft.caption, /Antonio/)
  assert.doesNotMatch(noCite.draft.headline, /Antonio/)
  assert.doesNotMatch(noCite.draft.caption, /ที่มา:/)

  assert.equal(parseDraft({ caption: 'สั้น' }).ok, false)
  assert.equal(parseDraft(['ไม่ใช่ object']).ok, false)

  const blocked = parseDraft({ headline: 'x', caption: longBody('เราอนุมัติทุกเคส ไม่ดูเครดิต') })
  assert.equal(blocked.ok, false)
  assert.match(blocked.error, /คำต้องห้าม/)
  assert.ok(blocked.blocking.includes('guaranteed_approval'))

  const warned = parseDraft({ headline: 'เพดานดอกเบี้ย เข้าใจผิดบ่อย', caption: longBody('ดอกเบี้ย 3% ต่อเดือนคือเพดานที่หลายคนเข้าใจผิด'), cta: 'ทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้' })
  assert.equal(warned.ok, true, warned.error)
  assert.equal(warned.draft.warnings.length, 1)
  assert.match(warned.draft.warnings[0], /อัตราดอกเบี้ย/)
  const fallback = parseDraft({ headline: '', caption: longBody('ขายฝากคืออะไร ต่างจากจำนองตรงไหน'), cta: 'ทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้' })
  assert.equal(fallback.draft.headline, 'ขายฝากคืออะไร', 'พาดหัวว่าง → ตัดจากบรรทัดแรกที่ขอบวลี ไม่ผ่ากลางคำ')
  assert.ok(longBody('x').length >= DRAFT_MIN_CHARS)
})

test('parseDraft: ซ่อมของที่โมเดลเล็กทำบ่อย — \\n ตัวอักษรดิบ · markdown · พาดหัวที่ตัดบรรทัดแรกมาครึ่งประโยค · needs_check ที่ลอกตัวอย่างมา', () => {
  const raw = { headline: 'ขายคอนโดติดหนี้ ปิดหนี้และมีเง', caption: 'ขายคอนโดติดหนี้ ปิดหนี้และมีเงินเหลือ ทำได้อย่างไร\\n\\n1. **ประเมินราคา**: ส่งข้อมูลทรัพย์ให้ประเมินเบื้องต้นก่อน เพื่อรู้ว่าขายแล้วพอปิดหนี้ไหม\\n\\n## ค่าใช้จ่าย\\nแยกค่าธรรมเนียม ภาษี และค่าบริการออกเป็นรายการ แล้วขอสรุปเป็นลายลักษณ์อักษรก่อนตกลง\\n\\nข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี\\n\\nทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้ ปิดข้อมูลส่วนบุคคลได้', needs_check: ['วันที่มีผล', 'ตัวบทประกาศ', 'ค่าธรรมเนียมจริงของกรมที่ดิน'] }
  const res = parseDraft(raw)
  assert.equal(res.ok, true, res.error)
  assert.doesNotMatch(res.draft.caption, /\\n|\*\*|^## /m)
  assert.match(res.draft.caption, /ทำได้อย่างไร\n\n1\. ประเมินราคา: /)
  assert.match(res.draft.caption, /\n\nค่าใช้จ่าย\nแยกค่าธรรมเนียม/)
  assert.equal(res.draft.headline, 'ขายคอนโดติดหนี้', 'พาดหัวที่เป็นหัวของบรรทัดแรกที่ยาวกว่า = โมเดลตัดครึ่งประโยค → ตัดใหม่ที่ขอบวลี')
  assert.deepEqual(res.draft.needs_check, ['ค่าธรรมเนียมจริงของกรมที่ดิน'], 'โพสต์ไม่มีประกาศ/ตัวเลข → ตัด "วันที่มีผล/ตัวบทประกาศ" ที่ลอกตัวอย่างมา')

  const kept = parseDraft({ headline: 'เงินสด 5 ล้าน ธนาคารถามที่มาได้', caption: longBody('ประกาศ ธปท. มีผล 1 พ.ย. 2569 ธนาคารอาจถามที่มาของเงินสด'), needs_check: ['วันที่มีผล'] })
  assert.deepEqual(kept.draft.needs_check, ['วันที่มีผล'])
  assert.equal(kept.draft.headline, 'เงินสด 5 ล้าน ธนาคารถามที่มาได้', 'พาดหัวที่ไม่ใช่หัวของบรรทัดแรก ไม่ถูกแตะ')
})

test('parseDraft: ลอก ** ที่ไม่มีคู่และเครื่องหมายคำพูดเกินท้ายบรรทัด · needs_check ที่เป็นหัวข้อในโพสต์อยู่แล้วถูกตัด', () => {
  const res = parseDraft({ headline: 'x', caption: longBody('**ข้อที่ 4 คือข้อที่คนมักข้าม เพราะคิดว่าเอกสารไม่สำคัญ"'), needs_check: ['ประเด็นแรก', 'ค่าธรรมเนียมจริงของกรมที่ดิน'] })
  assert.equal(res.ok, true, res.error)
  assert.match(res.draft.caption, /^ข้อที่ 4 คือข้อที่คนมักข้าม เพราะคิดว่าเอกสารไม่สำคัญ\n/)
  assert.doesNotMatch(res.draft.caption, /\*\*|"/)
  assert.deepEqual(res.draft.needs_check, ['ค่าธรรมเนียมจริงของกรมที่ดิน'], '"ประเด็นแรก" อยู่ในโพสต์ตรง ๆ → ไม่ใช่สิ่งที่ต้องยืนยัน')
})

test('parseDraft: คัดลอกความจริงของแบรนด์/ชื่อหัวข้อโครงมาวางทั้งบรรทัด = ไม่ผ่าน (ให้ลองใหม่)', () => {
  assert.match(parseDraft({ headline: 'x', caption: longBody(`เคสสมมุติ หนึ่งราย\n\n${brand.must_say.join(' · ')}`) }, { brand }).error, /ต้องพูดเสมอ/)
  assert.match(parseDraft({ headline: 'x', caption: longBody('ขั้นตอน: ส่งข้อมูล → ประเมิน → นัดดูทรัพย์ → จดทะเบียน') }).error, /ลูกศร/)
  const labelled = parseDraft({ headline: 'x', caption: longBody('เคสสมมุติ\n\nสถานการณ์: ติดหนี้คอนโด\n\nจุดที่เกือบพลาด: คิดว่าต้องขายขาดทุน\n\nบทเรียน: ประเมินก่อนตัดสินใจ') })
  assert.equal(labelled.ok, true, 'ป้ายหัวข้อจากคำแนะนำโครงถูกลอกทิ้ง ไม่ใช่ปัดตก (โมเดลดื้อแม้ย้ำแล้ว)')
  assert.match(labelled.draft.caption, /เคสสมมุติ\n\nติดหนี้คอนโด\n\nคิดว่าต้องขายขาดทุน\n\nประเมินก่อนตัดสินใจ/)
  assert.match(parseDraft({ headline: 'x', caption: longBody('ขั้นตอนจริง: ส่งข้อมูลทรัพย์และเอกสารสิทธิ์') }).error, /ขั้นตอนจริง/)
  assert.equal(parseDraft({ headline: 'x', caption: longBody('สองขั้น: ส่งข้อมูล → ประเมิน แล้วค่อยนัด') }).ok, true, 'ลูกศรน้อยกว่า 3 ไม่นับ')
  assert.match(parseDraft({ headline: 'x', caption: longBody(`สำหรับ${brand.audiences.A.split(' — ')[0]} ควรเตรียมเอกสาร`) }, { brand }).error, /คำอธิบายกลุ่มเป้าหมาย/)
})

test('parseDraft: เรื่องดอกเบี้ยที่ข้อเท็จจริงบอกแค่ "มีการประชุม" ห้ามสรุปทิศทางเอง · ถ้าข้อเท็จจริงบอกมติแล้วเขียนได้', () => {
  const facts = 'ธปท.: แถลงข่าวผลการประชุม กนง.\nแถลงข่าวผลการประชุม กนง. · อ่านมติและเหตุผลจากลิงก์ก่อนเขียน'
  const claim = parseDraft({ headline: 'x', caption: longBody('การปรับอัตราดอกเบี้ยครั้งนี้มีผลต่อผู้ที่ต้องการเงินทุน') }, { subtype: 'rate', facts })
  assert.match(claim.error, /สรุปทิศทางดอกเบี้ย/)
  const hedged = parseDraft({ headline: 'x', caption: longBody('ไม่ว่าผลประชุมจะปรับขึ้นหรือลดดอกเบี้ย เจ้าของทรัพย์ควรเตรียมเอกสารไว้ก่อน ติดตามมติได้จาก ธปท.') }, { subtype: 'rate', facts })
  assert.equal(hedged.ok, true, hedged.error)
  const withFacts = parseDraft({ headline: 'x', caption: longBody('กนง. มีมติคงอัตราดอกเบี้ยนโยบาย ผู้ที่กำลังจะจำนองควรรู้ว่าต้นทุนเงินยังไม่เปลี่ยน') }, { subtype: 'rate', facts: '📌 กนง. มีมติคงอัตราดอกเบี้ยนโยบาย' })
  assert.equal(withFacts.ok, true, withFacts.error)
  assert.equal(parseDraft({ headline: 'x', caption: longBody('ได้ปรับดอกเบี้ยแล้ว') }, { subtype: 'scam', facts }).ok, true, 'ใช้เฉพาะเรื่องดอกเบี้ย/สินเชื่อ')
})

test('parseDraft: ตัวลบข้อมูลบุคคลชุดโพสต์ไม่กิน "คุณ" กลางประโยค แต่ยังลบเบอร์โทรและชื่อหลัง นาย/นาง', () => {
  const res = parseDraft({ headline: 'x', caption: longBody('รู้สิทธิไถ่ถอนของคุณ\n\nข้อมูลนี้เป็นความรู้ทั่วไป โทร 081-234-5678 ติดต่อ นาย สมชาย ใจดี') })
  assert.equal(res.ok, true, res.error)
  assert.match(res.draft.caption, /สิทธิไถ่ถอนของคุณ\n\nข้อมูลนี้เป็นความรู้ทั่วไป/)
  assert.doesNotMatch(res.draft.caption, /081-234|สมชาย/)
})

test('ensureClosing: เติมบรรทัดกำกับและ CTA ที่โมเดลลืมใส่ในแคปชั่น · บรรทัด "ที่มา:" ต้องอยู่ท้ายสุด', () => {
  const cta = 'ทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้'
  assert.equal(ensureClosing('เนื้อหา', cta), 'เนื้อหา\n\nข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี\n\n' + cta)
  assert.equal(ensureClosing('เนื้อหา\n\nที่มา: ธปท.', cta), 'เนื้อหา\n\nข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี\n\n' + cta + '\n\nที่มา: ธปท.')
  const complete = `เนื้อหา ขึ้นกับแต่ละกรณี\n\n${cta} ปิดข้อมูลส่วนบุคคลได้`
  assert.equal(ensureClosing(complete, cta), complete, 'มีครบแล้วไม่เติมซ้ำ')
  const viaParse = parseDraft({ headline: 'x', caption: 'ก่อนขายคอนโดติดหนี้ มี 4 ข้อต้องเช็ก\n\n1. ประเมินราคาทรัพย์ให้ตรงตลาด ถ้าข้ามข้อนี้อาจขายไม่ออก\n\n2. ตรวจสิทธิ์การขายและภาระที่ติดอยู่กับห้อง ถ้าข้ามอาจมีปัญหาตอนโอน\n\n3. จัดเตรียมเอกสารสิทธิ์และข้อมูลที่จำเป็นให้ครบก่อนนัด\n\n4. คำนวณค่าใช้จ่ายรวมทั้งหมด ค่าธรรมเนียม ค่าโอน ค่าบริการ ถ้าข้ามอาจต้องจ่ายมากกว่าที่คิด\n\nข้อ 4 คือข้อที่คนมักข้าม เพราะมองแต่ยอดขาย', cta })
  assert.ok(viaParse.draft.caption.endsWith(cta))
  assert.match(viaParse.draft.caption, /ความรู้ทั่วไป/)
})

test('tidyHeadline: เศษคำท้ายที่โมเดลตัดกลางคำถูกตัดทิ้งพร้อมคำเชื่อมที่ค้าง · พาดหัวดี ๆ ยาว 31 ตัวไม่ถูกแตะ', () => {
  const ctx = 'หลายคนมีคอนโดติดหนี้และต้องการขายเพื่อปิดหนี้ แต่ยังคงเหลือเงินอยู่ ธนาคารอาจถามที่มาของเงินและขอเอกสารได้ ก่อนตัดสินใจควรเช็กเงื่อนไข'
  assert.equal(tidyHeadline('ขายคอนโดติดหนี้ ปิดหนี้และเหล', 'หลายคนมีคอนโดติดหนี้', ctx), 'ขายคอนโดติดหนี้ ปิดหนี้')
  assert.equal(tidyHeadline('ขายคอนโดติดหนี้ ปิดหนี้และมีเง', 'หลายคน', ctx), 'ขายคอนโดติดหนี้ ปิดหนี้')
  assert.equal(tidyHeadline('วงเงินจำนองคอนโดทำไมน้อยกว่าท', 'วงเงิน', ctx), 'วงเงินจำนองคอนโดทำไมน้อย')
  const ctx2 = 'ดอกเบี้ยคงที่ส่งผลต่อตลาดอสังหาริมทรัพย์และตลาดอสังหาฯ ก่อนซื้อทรัพย์ควรตรวจสอบความเสี่ยง'
  assert.equal(tidyHeadline('ดอกเบี้ยคงที่ ส่งผลตลาดอสัง', 'x', ctx2), 'ดอกเบี้ยคงที่ ส่งผลตลาด', 'เศษ "อสัง" ที่เนื้อหามี "อสังหา" ยาวกว่า → ตัด')
  assert.equal(tidyHeadline('ตรวจสอบความเสี่ยงก่อนซื้อทรัพย', 'x', ctx2), 'ตรวจสอบความเสี่ยงก่อนซื้อ', 'เศษ "ทรัพย" (5 ตัว) ที่เนื้อหามี "ทรัพย์" → ตัด')
  assert.equal(tidyHeadline('เช็กข้อมูลก่อนซื้อคอนโดพระราม 4', 'x', ctx2), 'เช็กข้อมูลก่อนซื้อคอนโดพระราม 4', 'จบด้วยตัวเลข ไม่ใช่เศษคำไทย → คงไว้')
  assert.equal(tidyHeadline('ลงทุนคอนโดพระราม 4 ยัง', 'x', ctx2), 'ลงทุนคอนโดพระราม 4', 'คำช่วยค้างท้ายถูกตัดแม้พาดหัวสั้น')
  assert.equal(tidyHeadline('ซื้อคอนโดพระราม 4 ต้อง', 'x', ''), 'ซื้อคอนโดพระราม 4', 'ไม่ต้องมีบริบทก็ตัดคำค้างได้')
  assert.equal(tidyHeadline('เงินสด 5 ล้าน ธนาคารถามที่มาได้', 'x', ctx), 'เงินสด 5 ล้าน ธนาคารถามที่มาได้', 'คำท้าย "ได้" พบในเนื้อหา → ไม่ใช่เศษคำ')
  assert.equal(tidyHeadline('ขายฝาก เช็กเงื่อนไขก่อนตัดสินใจ', 'x', ctx), 'ขายฝาก เช็กเงื่อนไขก่อนตัดสินใจ')
  assert.equal(tidyHeadline('ขายฝาก เช็กเงื่อนไขก่อนตัดสินใจ', 'x', ''), 'ขายฝาก เช็กเงื่อนไขก่อนตัดสินใจ', 'ไม่มีบริบทให้เทียบ → ไม่แตะ')
  assert.equal(tidyHeadline('เช็กลิสต์ขายคอนโดติดหนี้', 'x', ctx), 'เช็กลิสต์ขายคอนโดติดหนี้', 'สั้นกว่า 25 ไม่แตะ')
})

test('pickDraftFormat / usedPoints: 3 มุมของเรื่องเดียวกันต้องได้โครงต่างกัน และประเด็นที่ใช้แล้วถูกดึงจากหัวข้อเลข', () => {
  const explainAngle = { label: 'ความเสี่ยงในตลาดคอนโด', brief: 'ให้ความรู้' }
  assert.equal(pickDraftFormat(explainAngle), 'explain')
  assert.equal(pickDraftFormat(explainAngle, { usedFormats: ['explain'] }), 'checklist')
  assert.equal(pickDraftFormat(explainAngle, { usedFormats: ['explain', 'checklist'] }), 'qa')
  assert.equal(pickDraftFormat({ label: 'เช็กลิสต์', brief: 'x' }, { usedFormats: ['explain'] }), 'checklist', 'โครงตามมุมยังว่าง → ใช้ตามมุม')
  assert.equal(pickDraftFormat({ label: 'ข้อมูลใหม่ ธปท.', brief: 'ประกาศ' }, { hasFacts: true, usedFormats: ['news'] }), 'explain')
  assert.deepEqual(usedPoints(['ก่อนซื้อ ดู 3 ข้อ\n\n1. ทำเล: ทำเลดีขายง่าย\n\n2. **ราคา** - ดูราคาจริง\n\n3) สภาพตลาด\nรายละเอียด', '1. ทำเล: ซ้ำ\n2. เอกสารสิทธิ์ครบถ้วน ตรวจสอบว่า']), ['ทำเล', 'ราคา', 'สภาพตลาด', 'เอกสารสิทธิ์ครบถ้วน ตรวจสอบว่า'])
})

test('generateDrafts: มุมที่ 2 ซ้ำกับมุมแรกเกินเกณฑ์ → ลองใหม่พร้อมบอกประเด็นห้ามใช้ · prompt มุมถัดไปมี "ห้ามใช้ซ้ำ" และโครงต่างจากมุมแรก', async () => {
  const same = (lead) => `${lead}\n\n1. ทำเล: ทำเลสำคัญต่อการขายและเช่าคอนโด หากซื้อในทำเลที่มีความต้องการสูง โอกาสขายได้ราคาดี\n\n2. ราคา: ควรศึกษาราคาตลาดและราคาขายจริงของคอนโดในทำเลเดียวกัน ไม่ควรซื้อเกินราคามาตรฐาน\n\n3. สภาพตลาด: ศึกษาแนวโน้มของตลาดคอนโดในพื้นที่ รวมถึงการพัฒนาโครงการใหม่ที่อาจกระทบราคา\n\nข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี\n\nทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้`
  const prompts = []
  let calls = 0
  const ask = async ({ prompt }) => {
    prompts.push(prompt)
    calls += 1
    if (calls === 2) return { ok: true, provider: 'ollama', data: { headline: 'หัวสอง', caption: same('ซื้อคอนโดมือสองตอนนี้ดีไหม ต้องดูความเสี่ยง') } }
    if (calls === 3) return { ok: true, provider: 'ollama', data: { headline: 'หัวสาม', caption: longBody('ถาม: ซื้อแล้วขายไม่ออกจะทำอย่างไร\nตอบ: ก่อนซื้อให้ดูสภาพคล่องของโครงการจากประกาศขายที่ค้างนาน') } }
    return { ok: true, provider: 'ollama', data: { headline: 'หัวแรก', caption: same('ซื้อคอนโดตอนนี้ดีไหม ต้องพิจารณาความเสี่ยง') } }
  }
  const idea = { id: 3, source: 'youtube', subtype: 'market', title: 'ซื้อคอนโดตอนนี้ดีไหม', summary: '⚠️ ยังไม่รู้เนื้อหาจริงของคลิป', angles: [{ label: 'ความเสี่ยงในตลาดคอนโด', brief: 'ให้ความรู้' }, { label: 'วิธีประเมินความเสี่ยง', brief: 'แนะนำวิธี' }] }
  const result = await generateDrafts({ ideas: [idea], brand, ask, onSave: async () => {}, sleep: async () => {}, delayMs: 0 })
  assert.equal(calls, 3, 'มุม 2 ครั้งแรกซ้ำ → ลองใหม่อีกครั้ง')
  assert.deepEqual(result.done, [{ id: 3, drafts: 2 }])
  assert.match(prompts[1], /ห้ามใช้ซ้ำ[^\n]*ทำเล · ราคา · สภาพตลาด/)
  assert.match(prompts[1], /รูปแบบโพสต์: เช็กลิสต์/, 'มุมแรกใช้ให้ความรู้แล้ว → มุมสองได้โครงเช็กลิสต์')
  assert.match(prompts[2], /ร่างก่อนหน้าซ้ำกับมุมอื่น/)
})

test('generateDrafts: บันทึกล้มครั้งแรกแล้วสำเร็จ = ไม่นับล้ม · ล้มสองครั้ง = รายงาน "บันทึกไม่สำเร็จ"', async () => {
  const ask = async () => ({ ok: true, provider: 'ollama', data: { headline: 'หัว', caption: longBody('เปิดเรื่อง') } })
  let saves = 0
  const flaky = async () => { saves += 1; if (saves === 1) throw new Error('สะดุด') }
  const ok = await generateDrafts({ ideas: [{ id: 5, source: 'news', subtype: 'market', title: 't', summary: '📌 x', angles: [{ label: 'ให้ความรู้', brief: 'b' }] }], brand, ask, onSave: flaky, sleep: async () => {}, delayMs: 0 })
  assert.equal(saves, 2)
  assert.equal(ok.failed.length, 0)
  assert.deepEqual(ok.done, [{ id: 5, drafts: 1 }])

  const dead = await generateDrafts({ ideas: [{ id: 6, source: 'news', subtype: 'market', title: 't', summary: '📌 x', angles: [{ label: 'ให้ความรู้', brief: 'b' }] }], brand, ask, onSave: async () => { throw new Error('ฐานข้อมูลล่ม') }, sleep: async () => {}, delayMs: 0 })
  assert.equal(dead.failed.length, 1)
  assert.match(dead.failed[0].error, /บันทึกไม่สำเร็จ: ฐานข้อมูลล่ม/)
})

test('hasResearchFacts: นับเฉพาะ 📌 (ถอดจากต้นทาง/ปฏิทิน) หรือ manual · ข้อความกำกับภายในอย่าง "อ่านมติจากลิงก์" ไม่นับ', () => {
  assert.equal(hasResearchFacts({ summary: 'แถลงข่าวผลการประชุม กนง. · อ่านมติและเหตุผลจากลิงก์ก่อนเขียน' }), false)
  assert.equal(hasResearchFacts({ summary: '📌 กนง. มีมติคงอัตราดอกเบี้ยนโยบาย' }), true)
  assert.equal(hasResearchFacts({ summary: 'เจ้าของวางเอง: มาตรการลดค่าโอน', source: 'manual' }), true)
  assert.equal(hasResearchFacts({ summary: '⚠️ ดึงเนื้อหาจากลิงก์ไม่ได้ (HTTP 403)' }), false)
})

test('parseDraft: สิ่งที่ผู้ตรวจอิสระจับได้ — สรรพนามแบรนด์ · แบรนด์เป็นพระเอก · ประโยคเปิดใบปลิว · ประโยคแม่แบบซ้ำ · พาดหัวสัญญาผล · แฮชแท็กนอกโพสต์', () => {
  assert.match(parseDraft({ headline: 'x', caption: longBody('คุณผู้ใช้บริการมีคอนโดติดหนี้') }).error, /สรรพนาม/)
  assert.match(parseDraft({ headline: 'x', caption: longBody('ทีมงานของเราได้ให้คำแนะนำที่ทำให้เจ้าของห้องปิดหนี้ได้') }).error, /พระเอก|รับประกันผลโดยอ้อม/)
  assert.match(parseDraft({ headline: 'x', caption: longBody('วันนี้จะมาแนะนำวิธีขายคอนโด') }).error, /ใบปลิว/)
  assert.match(parseDraft({ headline: 'x', caption: `ก่อนขาย มี 4 ข้อ\n\n1. เอกสาร: เตรียมให้ครบ\nถ้าข้ามข้อนี้ อาจทำให้ขายไม่ได้ เนื่องจากเอกสารไม่ครบ\n\n2. ราคา: ดูราคาจริง\nถ้าข้ามข้อนี้ อาจทำให้ขายไม่ได้ เนื่องจากราคาสูง\n\n3. หนี้: ขอยอดปิดบัญชี\nถ้าข้ามข้อนี้ อาจทำให้ขายไม่ได้ เนื่องจากหนี้สูง\n\n${longBody('')}` }).error, /ประโยคแม่แบบซ้ำ 3 ครั้ง/)
  const qa = parseDraft({ headline: 'x', caption: `ถาม: ขายฝากคืออะไร\nตอบ: การขายที่มีสิทธิไถ่คืน จดทะเบียนที่สำนักงานที่ดิน\n\nถาม: ไถ่คืนได้ถึงเมื่อไหร่\nตอบ: ตามกำหนดในสัญญา ขยายได้ตามกฎหมาย\n\nถาม: ค่าใช้จ่ายรวมมีอะไร\nตอบ: ค่าธรรมเนียม ภาษี และค่าบริการ ขอสรุปเป็นลายลักษณ์อักษร\n\n${longBody('')}` })
  assert.equal(qa.ok, true, `ถาม:/ตอบ: ซ้ำได้ ไม่ใช่ประโยคแม่แบบ — ${qa.error}`)
  assert.match(parseDraft({ headline: 'ขายคอนโดติดหนี้ ปิดหนี้เหลือเงิน', caption: longBody('เรื่องขายคอนโดที่ติดหนี้ธนาคาร') }).error, /พาดหัวสัญญาผลลัพธ์/)
  const warned = parseDraft({ headline: 'ขายคอนโดติดหนี้ ต้องรู้อะไร', caption: longBody('ขายแล้วปิดหนี้หมดและมีเงินเหลือแน่นอน') })
  assert.equal(warned.ok, true, warned.error)
  assert.ok(warned.draft.warnings.some((w) => /ไม่มีเงื่อนไขกำกับ/.test(w)), JSON.stringify(warned.draft.warnings))
  const conditional = parseDraft({ headline: 'ขายคอนโดติดหนี้ ต้องรู้อะไร', caption: longBody('ถ้าราคาขายสูงกว่ายอดปิดบัญชีบวกค่าใช้จ่ายวันโอน จึงจะมีเงินเหลือ') })
  assert.ok(!conditional.draft.warnings.some((w) => /ไม่มีเงื่อนไขกำกับ/.test(w)))
})

test('parseDraft: โครงเคสสมมุติต้องมี "ไม่ใช่ลูกค้าจริง" (เติมให้ถ้าขาด) · โพสต์คอนโดที่เรียก "โฉนด" ติดคำเตือน', () => {
  const kase = parseDraft({ headline: 'x', caption: longBody('เคสสมมุติ: เจ้าของห้องติดหนี้ธนาคาร') }, { format: 'case' })
  assert.equal(kase.ok, true, kase.error)
  assert.match(kase.draft.caption, /เคสสมมุติเพื่ออธิบายหลักการ ไม่ใช่ลูกค้าจริง/)
  const condo = parseDraft({ headline: 'x', caption: longBody('ก่อนขายคอนโด เตรียมโฉนดและสัญญากู้') }, { facts: 'ขายคอนโดติดหนี้' })
  assert.ok(condo.draft.warnings.some((w) => /อ\.ช\.2/.test(w)), JSON.stringify(condo.draft.warnings))
})

test('parseDraft: คำปลอบ/สัญญาผลตอบแทนที่ผิดจริงถูกปัด · ชื่อบริษัทจากต้นทางที่ห้ามอ้างหลุดลงโพสต์ถูกปัด · แหล่งที่อ้างได้ไม่ปัด', () => {
  assert.match(parseDraft({ headline: 'x', caption: longBody('ขายฝากเป็นทางเลือกที่ได้เงินเร็ว โดยไม่ต้องกังวลเรื่องการยึดทรัพย์') }).error, /คำปลอบ/)
  assert.match(parseDraft({ headline: 'x', caption: longBody('ทีมพร้อมช่วยประเมินให้คุณได้รับผลตอบแทนที่ดีที่สุด') }).error, /คำปลอบ|รับประกันผล/)
  const facts = 'อสังหาฯ ยุคใหม่ SENA เปิด 5 ทางเลือก\n📌 บมจ.เสนาดีเวลลอปเม้นท์ (SENA) ปรับยุทธศาสตร์ · ติด MRT คลองเตย · โครงการ coco parc'
  assert.match(parseDraft({ headline: 'x', caption: longBody('ผู้พัฒนาอย่าง SENA เปิดทางเลือกใหม่ให้คนอยากมีบ้าน') }, { policy: 'no_cite', facts }).error, /เอ่ยชื่อบริษัท[^"]*"SENA"/)
  assert.match(parseDraft({ headline: 'x', caption: longBody('ห้องในโครงการ Coco Parc ติดรถไฟฟ้า') }, { policy: 'no_cite', facts }).error, /Coco Parc|coco parc/i)
  assert.equal(parseDraft({ headline: 'x', caption: longBody('คอนโดติด MRT เดินทางสะดวก ผู้พัฒนารายหนึ่งเปิดทางเลือกใหม่') }, { policy: 'no_cite', facts }).ok, true, 'MRT เป็นคำทั่วไป ไม่ใช่ชื่อบริษัท')
  assert.equal(parseDraft({ headline: 'x', caption: longBody('SENA เปิดทางเลือกใหม่ตามรายงานข่าว') }, { policy: 'cite', facts, sourceLabel: 'ฐานเศรษฐกิจ' }).ok, true, 'ข่าวที่อ้างได้ เอ่ยชื่อบริษัทในข่าวได้')
  const warned = parseDraft({ headline: 'x', caption: longBody('ลงทุนคอนโดทำเลนี้มักให้ผลตอบแทนที่ดี') })
  assert.ok(warned.ok && warned.draft.warnings.some((w) => /ไม่มีเงื่อนไขกำกับ/.test(w)), 'ผลตอบแทนที่ดีแบบไม่มีเงื่อนไข = เตือน ไม่ปัด')
})

test('ผู้ตรวจรอบสอง: วันที่ ค.ศ. → พ.ศ. · CTA ที่ไม่ใช่การชวนทำถูกแทนด้วย CTA ตามกลุ่ม · พาดหัว % ไม่ระบุนโยบาย/คำ "ดอกเบี้ยคงที่" ถูกปัด · เหตุการณ์อนาคตเขียนเป็นเกิดแล้วถูกปัด · ที่มาหน่วยงานถูกเติม', () => {
  assert.equal(thaiDates('ประชุม 28/10/2026 และรายงาน 2026-11-11 (ค.ศ.) ดอกเบี้ย 1.00 ต่อปี'), 'ประชุม 28 ต.ค. 2569 และรายงาน 11 พ.ย. 2569 ดอกเบี้ย 1.00 ต่อปี')
  assert.equal(validCta('4. ต้องติดตามความเสี่ยงเงินเฟ้อจากราคาน้ำมัน: ปัจจัยภายนอกเหล่านี้มีผลต่อค่าใช้จ่าย'), false)
  assert.equal(validCta('ทักแชต AssetX Estate สอบถามข้อมูลเพิ่มเติมเกี่ยวกับอัตราดอกเบี้ยและผลกระทบต่อธุรกิจของคุณ'), false, 'ไม่เกี่ยวกับบริการ')
  assert.equal(validCta('ส่งรูปเอกสารสิทธิ์มาทางแชต ทีม AssetX Estate ช่วยประเมินเบื้องต้นให้'), true)
  assert.equal(validCta('ทักแชต AssetX Estate เพื่อขอคำปรึกษาเกี่ยวกับการวางแผนการเงินและวิเคราะห์ความเสี่ยงในตลาดอสังหาริมทรัพย์'), false, 'บริการที่เราไม่มี')
  assert.equal(validCta('ปรึกษาสำนักงานที่ดินหรือทนายความเพื่อสอบถามรายละเอียดเพิ่มเติม'), false, 'ส่งไปที่อื่นโดยไม่มีแบรนด์')
  const stray = parseDraft({ headline: 'x', caption: `สรุปผลการประชุมมีดังนี้:\n\n- เศรษฐกิจไทยได้รับแรงส่งจากเทคโนโลยี\ng- สินเชื่อธุรกิจขนาดใหญ่ขยายตัว ขณะที่สินเชื่อรายย่อยหดตัว\n- ต้องติดตามคุณภาพสินเชื่อ\n\n${longBody('')}` })
  assert.match(stray.draft.caption, /เทคโนโลยี\n- สินเชื่อธุรกิจ/)
  assert.equal(defaultCta(brand, ['B', 'A']), brand.cta_examples.B)
  const replaced = parseDraft({ headline: 'กนง. คงดอกเบี้ยนโยบาย', caption: `${longBody('กนง. มีมติคงอัตราดอกเบี้ยนโยบายเมื่อ 28/10/2026')}\n\nปรึกษาสำนักงานที่ดิน/ทนายสำหรับเคสจริง`, cta: 'ปรึกษาสำนักงานที่ดิน/ทนายสำหรับเคสจริง' }, { brand, audience: ['A'], subtype: 'rate', facts: '📌 กนง. มีมติคงอัตราดอกเบี้ยนโยบาย' })
  assert.equal(replaced.ok, true, replaced.error)
  assert.equal(replaced.draft.cta, brand.cta_examples.A)
  assert.doesNotMatch(replaced.draft.caption, /ปรึกษาสำนักงานที่ดิน\/ทนายสำหรับเคสจริง/)
  assert.match(replaced.draft.caption, /28 ต\.ค\. 2569/)
  assert.ok(replaced.draft.warnings.some((w) => /CTA/.test(w)))
  assert.match(parseDraft({ headline: 'ดอกเบี้ยคงที่ 1%', caption: longBody('กนง. คงอัตราดอกเบี้ยนโยบาย') }, { subtype: 'rate', facts: '📌 กนง. มีมติคงอัตราดอกเบี้ยนโยบายที่ร้อยละ 1.00' }).error, /ตัวเลข %|ดอกเบี้ยคงที่/)
  assert.equal(parseDraft({ headline: 'กนง. คงดอกเบี้ยนโยบาย 1%', caption: longBody('กนง. คงอัตราดอกเบี้ยนโยบาย') }, { subtype: 'rate', facts: '📌 กนง. มีมติคงอัตราดอกเบี้ยนโยบาย' }).ok, true, 'มีคำว่านโยบาย → ผ่าน')
  assert.match(parseDraft({ headline: 'ธปท. 57/2569 มีผลแล้ว', caption: longBody('ประกาศ ธปท. 57/2569 มีผลแล้ว ธนาคารอาจถามที่มาของเงิน') }, { eventDate: '2026-11-11', today: '2026-11-06' }).error, /ยังไม่เกิด/)
  assert.equal(parseDraft({ headline: 'ธปท. 57/2569 มีผลแล้ว', caption: longBody('ประกาศ ธปท. 57/2569 มีผลแล้ว ธนาคารอาจถามที่มาของเงิน') }, { eventDate: '2026-11-01', today: '2026-11-06' }).ok, true, 'ถึงวันแล้ว เขียนว่ามีผลแล้วได้')
  const cal = parseDraft({ headline: 'เงินสด 5 ล้าน ธนาคารถามที่มาได้', caption: longBody('ธนาคารอาจถามที่มาของเงินสดตั้งแต่ 5 ล้านบาท'), cta: brand.cta_examples.B }, { policy: 'cite', sourceLabel: 'ปฏิทินเหตุการณ์', facts: 'ประกาศ ธปท. 57/2569 มีผล\n📌 กระทบผู้ใช้เงินสด' })
  assert.match(cal.draft.caption, /\n\nที่มา: ธนาคารแห่งประเทศไทย$/, 'เลนปฏิทิน: อ้างหน่วยงานจากชื่อเรื่องแทนป้ายภายใน')
  assert.deepEqual(splitFactsNotes('📌 กระทบกลุ่ม B ที่ใช้เงินสด · เล่าแบบทั่วไป อ้าง ธปท. · ตรวจตัวประกาศก่อนโพสต์\nวันที่ 2026-11-01 (ค.ศ.) · แหล่ง: ปฏิทินในระบบ ต้องยืนยันกับหน่วยงานก่อนโพสต์'), { facts: ['กระทบกลุ่ม B ที่ใช้เงินสด', 'วันที่ 2026-11-01 (ค.ศ.)'], notes: ['เล่าแบบทั่วไป อ้าง ธปท.', 'ตรวจตัวประกาศก่อนโพสต์', 'แหล่ง: ปฏิทินในระบบ ต้องยืนยันกับหน่วยงานก่อนโพสต์'] })
  const { prompt } = buildDraftPrompt({ idea: { source: 'official', source_label: 'ปฏิทินเหตุการณ์', subtype: 'law', title: 'ประกาศ ธปท.', summary: '📌 กระทบผู้ใช้เงินสด · ตรวจตัวประกาศก่อนโพสต์\nวันที่ 2026-11-01 (ค.ศ.)' }, angle: { label: 'ให้ความรู้', brief: 'b' }, brand })
  assert.match(prompt, /- กระทบผู้ใช้เงินสด\n- วันที่ 1 พ\.ย\. 2569/)
  assert.match(prompt, /หมายเหตุถึงผู้เขียน[^\n]*ตรวจตัวประกาศก่อนโพสต์/)
})

test('splitInlineList: ข้อ 1. 2. 3. ที่อยู่บรรทัดเดียวถูกแยกเป็นย่อหน้า · บรรทัดที่มีเลขข้อเดียวหรือตัวเลขในประโยคไม่แตะ', () => {
  assert.equal(splitInlineList('1. รายงาน: วันที่ 11 ออก 2. ผล: ภาพรวม 3. นักลงทุน: เตรียมตัว'), '1. รายงาน: วันที่ 11 ออก\n\n2. ผล: ภาพรวม\n\n3. นักลงทุน: เตรียมตัว')
  assert.equal(splitInlineList('1. ข้อเดียว มีตัวเลข 5 ล้านบาท และ 28/10'), '1. ข้อเดียว มีตัวเลข 5 ล้านบาท และ 28/10')
  assert.equal(splitInlineList('ดอกเบี้ย 1.00 ต่อปี และ 2.5 เท่า'), 'ดอกเบี้ย 1.00 ต่อปี และ 2.5 เท่า', 'ทศนิยมไม่ใช่เลขข้อ')
  const res = parseDraft({ headline: 'x', caption: `1. รายงานการประชุม: ธปท. จะเผยแพร่รายงาน กนง. เผยเหตุผลมติที่สำคัญ 2. ผลต่อเศรษฐกิจ: รายงานช่วยให้เห็นภาพรวมของเศรษฐกิจและทิศทางนโยบาย 3. ข้อมูลสำหรับนักลงทุน: เตรียมรับมือกับนโยบายที่เปลี่ยน ตรวจความเสี่ยงในพอร์ตของตนเอง\n\n${longBody('')}` })
  assert.equal(res.ok, true, res.error)
  assert.match(res.draft.caption, /มติที่สำคัญ\n\n2\. ผลต่อเศรษฐกิจ/)
})

test('generateDrafts: พาดหัวซ้ำกับมุมอื่นของเรื่องเดียวกัน → ลองใหม่พร้อมบอกให้ตั้งพาดหัวตามมุม', async () => {
  let calls = 0
  const prompts = []
  const ask = async ({ prompt }) => {
    prompts.push(prompt)
    calls += 1
    if (calls === 1) return { ok: true, provider: 'ollama', data: { headline: 'ธปท. 57/2569 เรื่องเงินสด', caption: longBody('เคสสมมุติ: เจ้าของทรัพย์เตรียมเอกสารที่มาของเงิน') } }
    return { ok: true, provider: 'ollama', data: { headline: 'เคสสมมุติ เงินสด 5 ล้าน', caption: longBody('เคสสมมุติ: เจ้าของทรัพย์เตรียมเอกสารที่มาของเงิน') } }
  }
  const idea = { id: 4, source: 'official', source_label: 'ปฏิทินเหตุการณ์', subtype: 'law', title: 'ประกาศ ธปท. 57/2569 มีผล', summary: '📌 ธุรกรรมเงินสด ≥ 5 ล้านบาท ธนาคารอาจถามที่มาของเงิน', angles: [
    { label: 'เช็กลิสต์', brief: 'x', draft: { headline: 'ธปท. 57/2569 เรื่องเงินสด', caption: 'ก่อนทำธุรกรรม มี 4 ข้อต้องเช็ก\n\n1. ที่มาของเงิน: เตรียมเอกสาร\n\n2. เอกสารสิทธิ์: ตรวจให้ครบ', format: 'checklist' } },
    { label: 'เคสสมมุติ ธปท.', brief: 'เล่าเคส' },
  ] }
  const result = await generateDrafts({ ideas: [idea], brand, ask, onSave: async () => {}, sleep: async () => {}, delayMs: 0, duplicateLimit: 1 })
  assert.equal(calls, 2)
  assert.match(prompts[1], /พาดหัวก่อนหน้าซ้ำกับมุมอื่น/)
  assert.deepEqual(result.done, [{ id: 4, drafts: 1 }])
})

test('buildDraftPrompt: ความจริงของแบรนด์ชุดใหม่เข้า prompt — ขั้นตอนแยกบริการ · ความรู้โดเมน · ตัวอย่าง CTA ต่อกลุ่ม · พาดหัวพี่น้องห้ามซ้ำ', () => {
  const { system, prompt } = buildDraftPrompt({ idea: { source: 'news', source_label: 'ฐานเศรษฐกิจ', subtype: 'market', title: 't', summary: '📌 x', audience: ['C'] }, angle: { label: 'ให้ความรู้', brief: 'b' }, brand, avoidHeadlines: ['ขายคอนโดติดหนี้'] })
  assert.match(system, /ฝากขาย: ส่งข้อมูลทรัพย์/)
  assert.match(system, /อ\.ช\.2/)
  assert.match(system, /ตัวอย่างต่อกลุ่มผู้อ่าน[\s\S]*D: "/)
  assert.match(system, /ห้ามอยู่ในพาดหัว/)
  assert.match(prompt, /พาดหัวที่โพสต์อื่นของเรื่องนี้ใช้แล้ว[^\n]*ขายคอนโดติดหนี้/)
  assert.match(prompt, /พูดกับกลุ่ม C เป็นหลัก/)
  const community = buildDraftPrompt({ idea: { source: 'community', source_label: 'Pantip', subtype: 'community_q', title: 'ขอคำแนะนำซื้อคอนโด', summary: '📌 สนใจซื้อคอนโดโครงการหนึ่ง · งบ 10 ล้านบาท' }, angle: { label: 'ให้ความรู้', brief: 'b' }, brand })
  assert.match(community.prompt, /สถานการณ์ของผู้ตั้งกระทู้คนหนึ่ง[^\n]*ห้ามใส่ชื่อโครงการ ตัวเลขงบ/)
  assert.doesNotMatch(community.prompt, /Pantip/, 'ชุมชน = ห้ามอ้างชื่อแหล่ง')
})

test('generateDrafts: ข้ามมุมที่มีร่างแล้ว · ลองใหม่ 1 ครั้งเมื่อติดคำต้องห้าม · บันทึกทีละมุม · ส่งประโยคเปิดเดิมเป็นข้อห้าม · หยุดเมื่อไม่มีผู้ให้บริการ', async () => {
  const prompts = []
  let calls = 0
  const ask = async ({ prompt }) => {
    prompts.push(prompt)
    calls += 1
    if (calls === 1) return { ok: true, provider: 'ollama', data: { headline: 'h', caption: longBody('อนุมัติทุกเคส ไม่ต้องตรวจ') } }
    return { ok: true, provider: 'ollama', data: { headline: `หัว ${calls}`, caption: longBody(`ประโยคเปิดของร่างที่ ${calls} ต่างกันทุกครั้ง`), hashtags: ['ขายฝาก'] } }
  }
  const saved = []
  const idea = { id: 7, source: 'news', source_label: 'ฐานเศรษฐกิจ', subtype: 'market', title: 't', summary: '📌 ข้อเท็จจริง', angles: [
    { label: 'มีแล้ว', brief: 'x', draft: { caption: 'เปิดเก่า\nเนื้อเก่า', headline: 'เก่า' } },
    { label: 'เช็กลิสต์', brief: 'y' },
    { label: 'ถามตอบ', brief: 'z' },
  ] }
  // duplicateLimit: 1 = ปิดด่านซ้ำในเทสต์นี้ (ข้อความทดลองใช้เนื้อเดียวกันทุกมุม) — ด่านซ้ำมีเทสต์ของตัวเองด้านล่าง
  const result = await generateDrafts({ ideas: [idea], brand, ask, onSave: async (id, angles) => saved.push([id, angles.filter((a) => a.draft).length]), sleep: async () => {}, delayMs: 0, now: () => new Date('2026-11-06T10:00:00Z'), duplicateLimit: 1 })
  assert.equal(calls, 3, 'มุม 2 ลอง 2 ครั้ง + มุม 3 ครั้งเดียว')
  assert.deepEqual(saved, [[7, 2], [7, 3]])
  assert.deepEqual(result.done, [{ id: 7, drafts: 2 }])
  assert.equal(result.failed.length, 0)
  assert.match(prompts[1], /คำตอบก่อนหน้าใช้ไม่ได้/)
  assert.match(prompts[0], /ห้ามเปิดด้วยประโยคแนวนี้[\s\S]*เปิดเก่า/)
  assert.match(prompts[2], /ประโยคเปิดของร่างที่ 2/, 'มุม 3 ต้องเห็นประโยคเปิดของมุม 2 ที่เพิ่งได้')
  assert.match(prompts[1], /รูปแบบโพสต์: เช็กลิสต์/)
  assert.match(prompts[2], /รูปแบบโพสต์: ถามตอบ/)
  assert.equal(idea.angles[1].draft, undefined, 'ไม่แก้ object ต้นฉบับ')

  const none = await generateDrafts({ ideas: [{ id: 1, angles: [{ label: 'a', brief: 'b' }] }, { id: 2, angles: [{ label: 'c', brief: 'd' }] }], brand, ask: async () => ({ ok: false, error: 'ไม่มีผู้ให้บริการ AI' }), sleep: async () => {}, delayMs: 0 })
  assert.equal(none.stopped, true)
  assert.equal(none.failed.length, 1, 'หยุดหลังตัวแรก ไม่วนต่อ')
})

test('parseDraft: รหัสกลุ่ม A–D และป้ายภายในหลุดลงโพสต์ = ไม่ผ่าน · ป้าย "ปฏิทินเหตุการณ์" ไม่ถูกเติมเป็นที่มา และบรรทัดที่มาแบบนั้นถูกตัด', () => {
  assert.match(parseDraft({ headline: 'x', caption: longBody('กระทบกลุ่ม B นักลงทุนรับซื้อฝากที่ใช้เงินสด') }).error, /รหัสกลุ่ม/)
  assert.equal(parseDraft({ headline: 'x', caption: longBody('ทรัพย์กลุ่ม Bangkok ไม่ใช่รหัส') }).ok, true, 'ตัวอักษรต่อท้ายไม่นับเป็นรหัสกลุ่ม')
  assert.match(parseDraft({ headline: 'x', caption: longBody('ตามปฏิทินในระบบของเรา ประกาศมีผลแล้ว') }).error, /ภายใน/)

  const calendar = parseDraft({ headline: 'ธปท. 57/2569 มีผล', caption: `${longBody('ประกาศ ธปท. 57/2569 มีผลแล้ว')}\n\nที่มา: ปฏิทินเหตุการณ์` }, { policy: 'cite', sourceLabel: 'ปฏิทินเหตุการณ์' })
  assert.equal(calendar.ok, true, calendar.error)
  assert.doesNotMatch(calendar.draft.caption, /ปฏิทิน/)
  assert.doesNotMatch(calendar.draft.caption, /ที่มา:/)
})

test('buildDraftPrompt: ไอเดียจากเลนปฏิทิน (source_label ภายใน) → สั่งอ้างหน่วยงานที่ออกประกาศ ไม่ใช่ปฏิทิน', () => {
  const { system, prompt, policy } = buildDraftPrompt({ idea: { source: 'official', source_label: 'ปฏิทินเหตุการณ์', subtype: 'law', title: 'ประกาศ ธปท. 57/2569 มีผล', summary: '📌 กระทบนักลงทุนที่ใช้เงินสด' }, angle: { label: 'ข้อมูลใหม่ ธปท.', brief: 'อธิบาย' }, brand })
  assert.equal(policy, 'cite')
  assert.match(prompt, /อ้างหน่วยงานที่ออกประกาศ/)
  assert.doesNotMatch(prompt, /ต้องคงชื่อแหล่งนี้/)
  assert.match(system, /รหัสกลุ่มเป้าหมาย[\s\S]*ห้ามหลุดลงโพสต์/)
  assert.match(system, /ปฏิทินเหตุการณ์[\s\S]*ห้ามหลุดลงโพสต์/)
})

test('generateDrafts: ผู้ให้บริการตอบไม่ใช่ JSON → ลองใหม่พร้อมย้ำรูปแบบ ไม่หยุดทั้งรอบ', async () => {
  let calls = 0
  const prompts = []
  const ask = async ({ prompt }) => {
    prompts.push(prompt)
    calls += 1
    if (calls === 1) return { ok: false, error: 'ollama: ตอบไม่ใช่ JSON' }
    return { ok: true, provider: 'ollama', data: { headline: 'หัว', caption: longBody('เปิดเรื่องแบบใหม่') } }
  }
  const result = await generateDrafts({ ideas: [{ id: 3, source: 'news', subtype: 'market', title: 't', summary: '📌 x', angles: [{ label: 'ให้ความรู้', brief: 'b' }] }], brand, ask, onSave: async () => {}, sleep: async () => {}, delayMs: 0 })
  assert.equal(calls, 2)
  assert.match(prompts[1], /ไม่ใช่ JSON ที่อ่านได้/)
  assert.deepEqual(result.done, [{ id: 3, drafts: 1 }])
  assert.equal(result.stopped, false)
})

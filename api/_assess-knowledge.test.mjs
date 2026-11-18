import test from 'node:test'
import assert from 'node:assert/strict'
import { chatKnowledge, selectFacts, buildAssessSystemPrompt, looksBroken, fallbackAnswer } from './_assess-knowledge.js'
import { isOllamaChatEnabled, askOllamaChat } from './_ollama.js'

test('คลังที่แชตใช้ได้ไม่มีข้อค่าธรรมเนียม ภาษี หรือเพดานดอกเบี้ย', () => {
  const ids = chatKnowledge().map((e) => e.id)
  assert.ok(ids.length > 30)
  assert.ok(ids.includes('sale-def') && ids.includes('act-not-redeemed'))
  assert.ok(!ids.some((id) => /^(fee-|tax-|interest-cap|sale-sinthai-cap|act-sinthai-cap)/.test(id)))
})

test('เลือกข้อพื้นฐานเสมอ และเพิ่มข้อที่ตรงคำถาม ไม่เกิน 12 ข้อ', () => {
  const base = selectFacts([{ role: 'user', content: 'สวัสดี' }]).map((e) => e.id)
  assert.ok(['sale-def', 'mortgage-def', 'act-not-redeemed'].every((id) => base.includes(id)))
  const spouse = selectFacts([{ role: 'user', content: 'ที่ดินเป็นสินสมรส คู่สมรสต้องเซ็นไหม' }]).map((e) => e.id)
  assert.ok(spouse.includes('deed-spouse'))
  assert.ok(spouse.length <= 12)
})

test('คำสั่งระบบมีข้อเท็จจริง เบอร์บริษัท และข้อห้ามเรื่องตัวเลข', () => {
  const prompt = buildAssessSystemPrompt({ messages: [{ role: 'user', content: 'ไถ่ไม่ทัน' }], today: 'วันนี้', phone: '096-986-8888' })
  assert.match(prompt, /ไม่ใช้สิทธิไถ่ภายในเวลาที่กำหนด/)
  assert.match(prompt, /096-986-8888/)
  assert.match(prompt, /ห้ามบอกอัตราดอกเบี้ย/)
  assert.match(prompt, /ห้ามใช้อีโมจิ/)
})

test('ด่านตรวจคำตอบ: ภาษาอื่นหลุด คำมั่ว และคำตอบว่าง ไม่ผ่าน', () => {
  assert.equal(looksBroken('ควรเตรียมเอกสารดังนี้ 1. สำเนาบัตรประชาชน 2. 产权证书和土地证的复印件'), true)
  assert.equal(looksBroken('ควรเตรียม 1. บัตรประชาชน 2. aaips แสดงรายได้'), true)
  assert.equal(looksBroken(''), true)
  assert.equal(looksBroken('ok'), true)
  assert.equal(looksBroken('ต้องเตรียมบัตรประชาชน ทะเบียนบ้าน และโฉนดตัวจริง โทร 096-986-8888 ครับ'), false)
  assert.equal(looksBroken('ติดต่อ AssetX Estate ทาง LINE หรือส่งลิงก์ Google Maps ได้ครับ ค่า LTV ทีมงานจะแจ้ง'), false)
})

test('ข้อความสำรองมีเบอร์โทรและไม่มีรายละเอียดระบบ', () => {
  assert.match(fallbackAnswer('096-986-8888'), /096-986-8888/)
  assert.doesNotMatch(fallbackAnswer('1'), /error|Gemini|Ollama/i)
})

test('Ollama เปิดเฉพาะเมื่อเลือกเอง และคืนคำตอบทั้งก้อน', async () => {
  assert.equal(isOllamaChatEnabled({ OLLAMA_MODEL: 'm' }), false)
  assert.equal(isOllamaChatEnabled({ ASSESS_CHAT_PROVIDER: 'ollama' }), false)
  assert.equal(isOllamaChatEnabled({ ASSESS_CHAT_PROVIDER: 'Ollama', OLLAMA_MODEL: 'm' }), true)
  let sent
  const fetchImpl = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return { ok: true, json: async () => ({ message: { content: ' คำตอบ ' } }) } }
  const text = await askOllamaChat({ messages: [{ role: 'user', content: 'ถาม' }], systemPrompt: 'กฎ', env: { OLLAMA_MODEL: 'm', OLLAMA_URL: 'http://x:1/api/chat' }, fetchImpl })
  assert.equal(text, 'คำตอบ')
  assert.equal(sent.url, 'http://x:1/api/chat')
  assert.equal(sent.body.messages[0].role, 'system')
  assert.equal(sent.body.stream, false)
  await assert.rejects(askOllamaChat({ messages: [{ role: 'user', content: 'ถาม' }], systemPrompt: '', env: { OLLAMA_MODEL: 'm' }, fetchImpl: async () => ({ ok: false, status: 500 }) }))
})

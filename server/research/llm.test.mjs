import test from 'node:test'
import assert from 'node:assert/strict'
import { createAsk, ollamaConfigured, ollamaEndpoint, isUnreachableError, NO_PROVIDER_MESSAGE } from './llm.js'

const ANGLES = '[{"label":"ก","brief":"1"},{"label":"ข","brief":"2"},{"label":"ค","brief":"3"}]'
const okJson = (content) => ({ ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content } }] }) })

test('ลำดับผู้ให้บริการ Hermes → Ollama → Gemini · Ollama เปิดด้วย OLLAMA_MODEL เท่านั้น · ไม่มีเลย = ok:false พร้อมคำแนะนำ', async () => {
  assert.deepEqual(createAsk({ env: { HERMES_AGENT_URL: 'http://h/x', OLLAMA_MODEL: 'qwen2.5:14b', GEMINI_API_KEY: 'k' } }).providers, ['hermes', 'ollama', 'gemini'])
  assert.deepEqual(createAsk({ env: { OLLAMA_MODEL: 'qwen2.5:14b' } }).providers, ['ollama'])
  assert.deepEqual(createAsk({ env: { OLLAMA_URL: 'http://localhost:11434' } }).providers, [], 'URL อย่างเดียวไม่พอ ต้องบอกรุ่น')
  assert.deepEqual(createAsk({ env: { HERMES_AGENT_URL: 'cli', GEMINI_API_KEY: 'your_gemini_api_key_here' } }).providers, [])
  assert.equal(ollamaConfigured({ OLLAMA_MODEL: '  ' }), false)
  const none = await createAsk({ env: {} })({ system: 's', prompt: 'p' })
  assert.equal(none.ok, false)
  assert.equal(none.error, NO_PROVIDER_MESSAGE)
  assert.match(none.error, /ไม่มีผู้ให้บริการ/)
  assert.match(none.error, /OLLAMA_MODEL/)
})

test('ollamaEndpoint: โฮสต์เปล่า · มี / ท้าย · /v1 · เส้นทางเต็ม · ค่าเริ่มต้น localhost:11434', () => {
  assert.equal(ollamaEndpoint({}), 'http://localhost:11434/v1/chat/completions')
  assert.equal(ollamaEndpoint({ OLLAMA_URL: 'http://192.168.1.5:11434/' }), 'http://192.168.1.5:11434/v1/chat/completions')
  assert.equal(ollamaEndpoint({ OLLAMA_URL: 'http://x/v1' }), 'http://x/v1/chat/completions')
  assert.equal(ollamaEndpoint({ OLLAMA_URL: 'http://x/v1/chat/completions' }), 'http://x/v1/chat/completions')
})

test('Ollama: ยิง OpenAI-compatible ด้วยรุ่นจาก env · ไม่สตรีม · system+user · ไม่มี Authorization', async () => {
  const calls = []
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return okJson(ANGLES) }
  const result = await createAsk({ env: { OLLAMA_MODEL: 'qwen2.5:7b' }, fetchImpl })({ system: 'ระบบ', prompt: 'คำถาม' })
  assert.equal(result.ok, true)
  assert.equal(result.provider, 'ollama')
  assert.equal(result.data.length, 3)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'http://localhost:11434/v1/chat/completions')
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.model, 'qwen2.5:7b')
  assert.equal(body.stream, false)
  assert.deepEqual(body.messages.map((m) => m.role), ['system', 'user'])
  assert.equal(body.messages[0].content, 'ระบบ')
  assert.equal(body.messages[1].content, 'คำถาม')
  assert.equal(calls[0].init.headers.Authorization, undefined)
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json')
})

test('Hermes ติดต่อไม่ได้ (fetch failed) → ตกมา Ollama · ครั้งถัดไปข้าม Hermes เลย · ask ตัวใหม่ลอง Hermes อีก', async () => {
  const hits = { hermes: 0, ollama: 0 }
  const fetchImpl = async (url) => {
    if (url.startsWith('http://old-pc')) { hits.hermes += 1; throw new TypeError('fetch failed') }
    hits.ollama += 1
    return okJson(ANGLES)
  }
  const env = { HERMES_AGENT_URL: 'http://old-pc:8642/v1/chat/completions', OLLAMA_MODEL: 'qwen2.5:14b' }
  const logs = []
  const ask = createAsk({ env, fetchImpl, log: (m) => logs.push(m) })
  assert.equal((await ask({ system: 's', prompt: 'p' })).provider, 'ollama')
  assert.equal((await ask({ system: 's', prompt: 'p' })).provider, 'ollama')
  assert.deepEqual(hits, { hermes: 1, ollama: 2 })
  assert.ok(logs.some((l) => /hermes ติดต่อไม่ได้/.test(l)), logs.join('\n'))
  assert.deepEqual([...ask.unreachable], ['hermes'])
  assert.equal((await createAsk({ env, fetchImpl })({ system: 's', prompt: 'p' })).provider, 'ollama')
  assert.equal(hits.hermes, 2)
})

test('ทุกตัวติดต่อไม่ได้ → ครั้งแรกบอกสาเหตุ · ครั้งถัดไปบอก "ไม่มีผู้ให้บริการ" ให้ generateAngles หยุดวน', async () => {
  const fetchImpl = async () => { throw new TypeError('fetch failed') }
  const ask = createAsk({ env: { OLLAMA_MODEL: 'qwen2.5:14b' }, fetchImpl })
  const first = await ask({ system: 's', prompt: 'p' })
  assert.equal(first.ok, false)
  assert.match(first.error, /^ollama: fetch failed$/)
  const second = await ask({ system: 's', prompt: 'p' })
  assert.equal(second.ok, false)
  assert.match(second.error, /ไม่มีผู้ให้บริการ AI ที่ติดต่อได้/)
})

test('ตอบไม่ใช่ JSON / HTTP 500 → ไม่นับว่าติดต่อไม่ได้ ครั้งหน้าลองใหม่ได้', async () => {
  let n = 0
  const fetchImpl = async () => {
    n += 1
    if (n === 1) return okJson('ขอโทษค่ะ ไม่เข้าใจคำถาม')
    if (n === 2) return { ok: false, status: 500, text: async () => 'boom' }
    return okJson(ANGLES)
  }
  const ask = createAsk({ env: { OLLAMA_MODEL: 'm' }, fetchImpl })
  const a = await ask({ system: 's', prompt: 'p' })
  assert.equal(a.ok, false)
  assert.match(a.error, /ollama: ตอบไม่ใช่ JSON/)
  const b = await ask({ system: 's', prompt: 'p' })
  assert.equal(b.ok, false)
  assert.match(b.error, /Ollama 500: boom/)
  const c = await ask({ system: 's', prompt: 'p' })
  assert.equal(c.ok, true)
  assert.equal(ask.unreachable.size, 0)
})

test('หมดเวลา (OLLAMA_TIMEOUT_MS) → ข้อความบอกเวลาที่รอ และนับว่าติดต่อไม่ได้', async () => {
  const fetchImpl = (url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })))
  })
  const ask = createAsk({ env: { OLLAMA_MODEL: 'm', OLLAMA_TIMEOUT_MS: '20' }, fetchImpl })
  const r = await ask({ system: 's', prompt: 'p' })
  assert.equal(r.ok, false)
  assert.match(r.error, /ollama: Ollama หมดเวลา 20 ms/)
  assert.deepEqual([...ask.unreachable], ['ollama'])
  assert.equal(isUnreachableError('Hermes 502: bad gateway'), false)
  assert.equal(isUnreachableError('connect ECONNREFUSED 192.168.1.123:8642'), true)
})

test('Hermes แบบ generic + ตอบเป็น SSE ยังอ่านได้ และส่ง Bearer เมื่อมี HERMES_AGENT_API_KEY', async () => {
  const calls = []
  const sse = ['data: {"choices":[{"message":{"content":"[{\\"label\\":\\"ก\\",\\"brief\\":\\"1\\"},"}}]}', 'data: {"choices":[{"message":{"content":"{\\"label\\":\\"ข\\",\\"brief\\":\\"2\\"}]"}}]}', 'data: [DONE]', ''].join('\n')
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, text: async () => sse } }
  const env = { HERMES_AGENT_URL: 'http://h/chat', HERMES_AGENT_FORMAT: 'generic', HERMES_AGENT_API_KEY: 'secret' }
  const result = await createAsk({ env, fetchImpl })({ system: 's', prompt: 'p' })
  assert.equal(result.ok, true)
  assert.equal(result.provider, 'hermes')
  assert.equal(result.data.length, 2)
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.input, 'p')
  assert.equal(body.system, 's')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret')
})

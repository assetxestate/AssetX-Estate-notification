// ตัวเรียก AI สำหรับงานรีเสิร์ช (เขียนมุมเล่า) — ลำดับผู้ให้บริการ:
//   1. Hermes (HERMES_AGENT_URL · OpenAI-compatible chat completions · ไม่สตรีม)  ← เจ้าของอยากให้ Hermes เป็นคนคิด
//   2. Ollama ในเครื่อง (OLLAMA_MODEL · OLLAMA_URL ค่าเริ่มต้น http://localhost:11434 · ยิง /v1/chat/completions แบบ OpenAI)
//   3. Gemini (GEMINI_API_KEY · ถ้ามี) ด้วย GEMINI_RESEARCH_MODELS หรือ gemini-flash-latest,gemini-flash-lite-latest
//   4. ไม่มีผู้ให้บริการ → คืน ok:false (ไอเดียค้าง angles=null ไว้ รอบหน้าลองใหม่)
// ผู้ให้บริการที่ "ติดต่อไม่ได้" (fetch failed · ปฏิเสธการเชื่อมต่อ · หมดเวลา) ถูกข้ามตลอดรอบที่เหลือของ ask ตัวนั้น
// — ไม่ให้ Hermes ที่ปิดอยู่กินเวลา timeout ซ้ำทุกไอเดีย · ask ตัวใหม่ (รอบถัดไป) ลองใหม่ทุกตัว
// AI ได้แค่ "เล่า" — ตัวเลข/การคัดกรองทำในโค้ดก่อนแล้ว · ข้อความที่ส่งเข้าต้องผ่านตัวลบข้อมูลบุคคลมาแล้ว (angles.js)

const DEFAULT_GEMINI_MODELS = 'gemini-flash-latest,gemini-flash-lite-latest'
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
// รุ่น 14b บนเครื่องนี้ (3 พ.ย. 2569): โหลดครั้งแรก ~70 วิ + เขียน ~45 วิ/ไอเดีย → รอได้ถึง 4 นาที
const DEFAULT_OLLAMA_TIMEOUT_MS = 240000
export const NO_PROVIDER_MESSAGE = 'ไม่มีผู้ให้บริการ AI (ตั้ง HERMES_AGENT_URL, OLLAMA_MODEL หรือ GEMINI_API_KEY)'

export function stripFences(text) {
  return String(text ?? '').replace(/```(?:json)?/gi, '').trim()
}

// ดึง JSON ก้อนแรกออกจากคำตอบที่อาจมีคำพูดนำ/ตาม
export function extractJson(text) {
  const s = stripFences(text)
  try { return JSON.parse(s) } catch { /* ลองตัดส่วนเกิน */ }
  const starts = [s.indexOf('['), s.indexOf('{')].filter((i) => i >= 0)
  if (!starts.length) return null
  const start = Math.min(...starts)
  const open = s[start]
  const close = open === '[' ? ']' : '}'
  const end = s.lastIndexOf(close)
  if (end <= start) return null
  try { return JSON.parse(s.slice(start, end + 1)) } catch { return null }
}

export function hermesConfigured(env = process.env) {
  const url = String(env.HERMES_AGENT_URL || '').trim()
  const transport = String(env.HERMES_AGENT_TRANSPORT || '').trim().toLowerCase()
  return Boolean(url && url !== 'cli' && transport !== 'cli')
}

// เปิดด้วย OLLAMA_MODEL เท่านั้น (ชื่อรุ่นต้องชัด) · OLLAMA_URL แค่ย้ายโฮสต์
export function ollamaConfigured(env = process.env) {
  return Boolean(String(env.OLLAMA_MODEL || '').trim())
}

// รับได้ทั้ง http://host:11434 · …/v1 · …/v1/chat/completions
export function ollamaEndpoint(env = process.env) {
  const base = String(env.OLLAMA_URL || DEFAULT_OLLAMA_URL).trim().replace(/\/+$/, '')
  if (/\/chat\/completions$/.test(base)) return base
  if (/\/v1$/.test(base)) return `${base}/chat/completions`
  return `${base}/v1/chat/completions`
}

export function geminiConfigured(env = process.env) {
  const key = String(env.GEMINI_API_KEY || '').trim()
  return Boolean(key && key !== 'your_gemini_api_key_here')
}

export function extractChatText(payload) {
  if (!payload) return ''
  if (typeof payload === 'string') return payload
  return String(
    payload.choices?.[0]?.message?.content
    || payload.choices?.[0]?.text
    || payload.output_text
    || payload.text
    || payload.content
    || payload.message?.content
    || '',
  )
}

// ข้อผิดพลาดระดับ "ติดต่อไม่ได้" — ต่างจากตอบผิดรูป/HTTP 4xx-5xx ที่ควรลองใหม่ครั้งหน้า
export function isUnreachableError(message) {
  return /fetch failed|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|ENOTFOUND|หมดเวลา/i.test(String(message || ''))
}

// POST chat แบบ OpenAI-compatible แล้วคืนข้อความคำตอบ (ใช้ร่วม Hermes และ Ollama)
async function postChat({ label, url, body, headers = {}, fetchImpl, timeoutMs }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: controller.signal })
    const raw = await response.text()
    if (!response.ok) throw new Error(`${label} ${response.status}: ${raw.slice(0, 200)}`)
    let parsed
    try { parsed = JSON.parse(raw) } catch { parsed = raw }
    // บางตัวตอบเป็น SSE แม้ขอ stream:false
    if (typeof parsed === 'string' && parsed.includes('data: ')) {
      parsed = parsed.split(/\r?\n/).filter((l) => l.startsWith('data: ')).map((l) => l.slice(6).trim()).filter((d) => d && d !== '[DONE]')
        .map((d) => { try { return extractChatText(JSON.parse(d)) } catch { return d } }).join('')
    }
    return extractChatText(parsed)
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`${label} หมดเวลา ${timeoutMs} ms`)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function askHermes({ system, prompt, env, fetchImpl, timeoutMs }) {
  const url = String(env.HERMES_AGENT_URL).trim()
  const format = String(env.HERMES_AGENT_FORMAT || 'openai').toLowerCase()
  const body = format === 'generic'
    ? { source: 'assetx-estate-research', mode: 'marketing-research', stream: false, system, messages: [{ role: 'user', content: prompt }], input: prompt }
    : { model: env.HERMES_AGENT_MODEL || 'hermes', stream: false, temperature: 0.4, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], metadata: { source: 'assetx-estate-research', mode: 'marketing-research' } }
  const headers = {}
  if (env.HERMES_AGENT_API_KEY) headers.Authorization = `Bearer ${env.HERMES_AGENT_API_KEY}`
  return postChat({ label: 'Hermes', url, body, headers, fetchImpl, timeoutMs })
}

async function askOllama({ system, prompt, env, fetchImpl }) {
  const body = { model: String(env.OLLAMA_MODEL).trim(), stream: false, temperature: 0.4, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }
  const timeoutMs = Number(env.OLLAMA_TIMEOUT_MS || DEFAULT_OLLAMA_TIMEOUT_MS)
  return postChat({ label: 'Ollama', url: ollamaEndpoint(env), body, fetchImpl, timeoutMs })
}

async function askGemini({ system, prompt, env }) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const client = new GoogleGenerativeAI(env.GEMINI_API_KEY)
  const models = String(env.GEMINI_RESEARCH_MODELS || DEFAULT_GEMINI_MODELS).split(',').map((m) => m.trim()).filter(Boolean)
  const errors = []
  for (const name of models) {
    try {
      const model = client.getGenerativeModel({ model: name, systemInstruction: system, generationConfig: { temperature: 0.4 } })
      const result = await model.generateContent(prompt)
      return result.response.text()
    } catch (error) {
      errors.push(`${name}: ${error?.message || error}`)
    }
  }
  throw new Error(`Gemini failed: ${errors.join(' | ')}`)
}

// คืน { ok, data, text, provider, error } · ไม่ throw
export function createAsk({ env = process.env, fetchImpl = globalThis.fetch, timeoutMs = Number(env.HERMES_AGENT_TIMEOUT_MS || 90000), log = () => {} } = {}) {
  const providers = []
  if (hermesConfigured(env)) providers.push('hermes')
  if (ollamaConfigured(env)) providers.push('ollama')
  if (geminiConfigured(env)) providers.push('gemini')
  const unreachable = new Set()

  const callers = {
    hermes: ({ system, prompt }) => askHermes({ system, prompt, env, fetchImpl, timeoutMs }),
    ollama: ({ system, prompt }) => askOllama({ system, prompt, env, fetchImpl }),
    gemini: ({ system, prompt }) => askGemini({ system, prompt, env }),
  }

  async function askJson({ system, prompt }) {
    const errors = []
    for (const provider of providers) {
      if (unreachable.has(provider)) continue
      try {
        const text = await callers[provider]({ system, prompt })
        const data = extractJson(text)
        if (data == null) {
          errors.push(`${provider}: ตอบไม่ใช่ JSON`)
          log(`[llm] ${provider} ตอบไม่ใช่ JSON: ${String(text).slice(0, 120)}`)
          continue
        }
        return { ok: true, data, text, provider, error: null }
      } catch (error) {
        const message = error?.message || String(error)
        errors.push(`${provider}: ${message}`)
        if (isUnreachableError(message)) {
          unreachable.add(provider)
          log(`[llm] ${provider} ติดต่อไม่ได้ (${message}) — ข้ามตลอดรอบนี้`)
        } else {
          log(`[llm] ${provider} ล้ม: ${message}`)
        }
      }
    }
    let error = errors.join(' | ')
    if (!error) {
      error = providers.length && providers.every((p) => unreachable.has(p))
        ? `ไม่มีผู้ให้บริการ AI ที่ติดต่อได้ (${providers.join(', ')} ติดต่อไม่ได้ในรอบนี้)`
        : NO_PROVIDER_MESSAGE
    }
    return { ok: false, data: null, text: '', provider: null, error }
  }

  askJson.providers = providers
  askJson.unreachable = unreachable
  return askJson
}

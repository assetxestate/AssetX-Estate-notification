// ตัวเรียก AI สำหรับงานรีเสิร์ช (เขียนมุมเล่า) — ลำดับผู้ให้บริการ:
//   1. Hermes (HERMES_AGENT_URL · OpenAI-compatible chat completions · ไม่สตรีม)  ← เจ้าของอยากให้ Hermes เป็นคนคิด
//   2. Gemini (GEMINI_API_KEY · ถ้ามี) ด้วย GEMINI_RESEARCH_MODELS หรือ gemini-flash-latest,gemini-flash-lite-latest
//   3. ไม่มีผู้ให้บริการ → คืน ok:false (ไอเดียค้าง angles=null ไว้ รอบหน้าลองใหม่)
// AI ได้แค่ "เล่า" — ตัวเลข/การคัดกรองทำในโค้ดก่อนแล้ว · ข้อความที่ส่งเข้าต้องผ่านตัวลบข้อมูลบุคคลมาแล้ว (angles.js)

const DEFAULT_GEMINI_MODELS = 'gemini-flash-latest,gemini-flash-lite-latest'

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

async function askHermes({ system, prompt, env, fetchImpl, timeoutMs }) {
  const url = String(env.HERMES_AGENT_URL).trim()
  const format = String(env.HERMES_AGENT_FORMAT || 'openai').toLowerCase()
  const body = format === 'generic'
    ? { source: 'assetx-estate-research', mode: 'marketing-research', stream: false, system, messages: [{ role: 'user', content: prompt }], input: prompt }
    : { model: env.HERMES_AGENT_MODEL || 'hermes', stream: false, temperature: 0.4, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], metadata: { source: 'assetx-estate-research', mode: 'marketing-research' } }
  const headers = { 'Content-Type': 'application/json' }
  if (env.HERMES_AGENT_API_KEY) headers.Authorization = `Bearer ${env.HERMES_AGENT_API_KEY}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal })
    const raw = await response.text()
    if (!response.ok) throw new Error(`Hermes ${response.status}: ${raw.slice(0, 200)}`)
    let parsed
    try { parsed = JSON.parse(raw) } catch { parsed = raw }
    // บางตัวตอบเป็น SSE แม้ขอ stream:false
    if (typeof parsed === 'string' && parsed.includes('data: ')) {
      parsed = parsed.split(/\r?\n/).filter((l) => l.startsWith('data: ')).map((l) => l.slice(6).trim()).filter((d) => d && d !== '[DONE]')
        .map((d) => { try { return extractChatText(JSON.parse(d)) } catch { return d } }).join('')
    }
    return extractChatText(parsed)
  } finally {
    clearTimeout(timer)
  }
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
  if (geminiConfigured(env)) providers.push('gemini')

  async function askJson({ system, prompt }) {
    const errors = []
    for (const provider of providers) {
      try {
        const text = provider === 'hermes'
          ? await askHermes({ system, prompt, env, fetchImpl, timeoutMs })
          : await askGemini({ system, prompt, env })
        const data = extractJson(text)
        if (data == null) {
          errors.push(`${provider}: ตอบไม่ใช่ JSON`)
          log(`[llm] ${provider} ตอบไม่ใช่ JSON: ${String(text).slice(0, 120)}`)
          continue
        }
        return { ok: true, data, text, provider, error: null }
      } catch (error) {
        errors.push(`${provider}: ${error?.message || error}`)
        log(`[llm] ${provider} ล้ม: ${error?.message || error}`)
      }
    }
    return { ok: false, data: null, text: '', provider: null, error: errors.join(' | ') || 'ไม่มีผู้ให้บริการ AI (ตั้ง HERMES_AGENT_URL หรือ GEMINI_API_KEY)' }
  }

  askJson.providers = providers
  return askJson
}

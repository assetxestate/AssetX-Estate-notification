// แชตผ่าน Ollama (โมเดลที่รันบนเครื่องของเราเอง ไม่มีค่าใช้จ่ายต่อข้อความ ข้อความไม่ออกนอกเครื่อง)
// เปิดใช้เฉพาะเมื่อเลือกเองด้วย ASSESS_CHAT_PROVIDER=ollama — OLLAMA_MODEL ที่ระบบรีเสิร์ชใช้อยู่ไม่เปิดแชตเอง
// เซิร์ฟเวอร์ที่รันโค้ดนี้ต้องเข้าถึง OLLAMA_URL ได้ (เครื่องสำนักงาน = localhost · บน Vercel ต้องมีช่องทางเข้าเครื่องนั้น)

const DEFAULT_URL = 'http://localhost:11434'
const TOTAL_TIMEOUT_MS = 90000

export function isOllamaChatEnabled(env = process.env) {
  return String(env.ASSESS_CHAT_PROVIDER || '').trim().toLowerCase() === 'ollama' && Boolean(ollamaModel(env))
}

function ollamaModel(env = process.env) {
  return String(env.OLLAMA_CHAT_MODEL || env.OLLAMA_MODEL || '').trim()
}

function ollamaBase(env = process.env) {
  return String(env.OLLAMA_URL || DEFAULT_URL).trim().replace(/\/+$/, '').replace(/\/(v1\/chat\/completions|v1|api\/chat)$/, '')
}

// คืนคำตอบทั้งก้อน (ไม่สตรีมถึงผู้ใช้) เพื่อให้ผู้เรียกตรวจคำตอบก่อนแสดง — โมเดลในเครื่องเคยมีภาษาอื่นหลุดและคำมั่ว
// ต่อไม่ติด หมดเวลา หรือไม่มีคำตอบ = โยน error ให้ผู้เรียกสลับไปผู้ให้บริการสำรอง
export async function askOllamaChat({ messages, systemPrompt, env = process.env, fetchImpl = fetch }) {
  if (!Array.isArray(messages) || messages.length === 0) throw new Error('ข้อความไม่ถูกต้อง')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS)
  try {
    const response = await fetchImpl(`${ollamaBase(env)}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: ollamaModel(env),
        stream: false,
        keep_alive: '30m',
        options: { temperature: 0.2, num_ctx: Number(env.OLLAMA_CHAT_NUM_CTX) || 8192, num_predict: 500 },
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 4000) })),
        ],
      }),
    })
    if (!response.ok) throw new Error(`Ollama ${response.status}`)
    const data = await response.json()
    if (data.error) throw new Error(`Ollama: ${data.error}`)
    const text = String(data.message?.content || '').trim()
    if (!text) throw new Error('Ollama ไม่ส่งคำตอบ')
    return text
  } finally {
    clearTimeout(timer)
  }
}

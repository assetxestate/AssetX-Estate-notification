// ตัวเรียก AI สำหรับงานรีเสิร์ช (เขียนมุมเล่า/ร่างโพสต์) — ลำดับผู้ให้บริการ:
//   0. Codex CLI ที่ล็อกอิน ChatGPT Plus บนคอมสำนักงาน (CODEX_WRITER=1 · รัน `codex exec` แบบ read-only ส่ง prompt ทาง stdin อ่านคำตอบจากไฟล์)
//      ← เจ้าของเปลี่ยนมาใช้ 7 พ.ย. 2569 ค่ำ หลังเห็นร่างจาก Ollama 14b "ไม่ตรงและเนื้อหาไม่มี" · ทดสอบ: GPT-6 ตอบ JSON ไทยใน 8 วิ · ใช้โควตา Codex ของแพ็กเกจ
//   1. Hermes (HERMES_AGENT_URL · OpenAI-compatible chat completions · ไม่สตรีม)
//   2. Ollama ในเครื่อง (OLLAMA_MODEL · OLLAMA_URL ค่าเริ่มต้น http://localhost:11434 · ยิง /api/chat)
//   3. Gemini (GEMINI_API_KEY · ถ้ามี) ด้วย GEMINI_RESEARCH_MODELS หรือ gemini-flash-latest,gemini-flash-lite-latest
//   4. ไม่มีผู้ให้บริการ → คืน ok:false (ไอเดียค้าง angles=null ไว้ รอบหน้าลองใหม่)
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
// ผู้ให้บริการที่ "ติดต่อไม่ได้" (fetch failed · ปฏิเสธการเชื่อมต่อ · หมดเวลา) ถูกข้ามตลอดรอบที่เหลือของ ask ตัวนั้น
// — ไม่ให้ Hermes ที่ปิดอยู่กินเวลา timeout ซ้ำทุกไอเดีย · ask ตัวใหม่ (รอบถัดไป) ลองใหม่ทุกตัว
// AI ได้แค่ "เล่า" — ตัวเลข/การคัดกรองทำในโค้ดก่อนแล้ว · ข้อความที่ส่งเข้าต้องผ่านตัวลบข้อมูลบุคคลมาแล้ว (angles.js)

const DEFAULT_GEMINI_MODELS = 'gemini-flash-latest,gemini-flash-lite-latest'
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
// รุ่น 14b บนเครื่องนี้ (3 พ.ย. 2569): โหลดครั้งแรก ~70 วิ + เขียน ~45 วิ/ไอเดีย → รอได้ถึง 4 นาที
const DEFAULT_OLLAMA_TIMEOUT_MS = 240000
export const NO_PROVIDER_MESSAGE = 'ไม่มีผู้ให้บริการ AI (ตั้ง CODEX_WRITER=1, HERMES_AGENT_URL, OLLAMA_MODEL หรือ GEMINI_API_KEY)'
const DEFAULT_CODEX_TIMEOUT_MS = 180000

// Codex เปิดด้วย CODEX_WRITER=1 (ต้องมี codex ที่ล็อกอินแล้วบนเครื่องนั้น — Vercel ไม่มี)
export function codexConfigured(env = process.env) {
  return /^(1|true|yes)$/i.test(String(env.CODEX_WRITER || '').trim())
}

// หาไบนารี: CODEX_BIN → codex.js ของ @openai/codex ที่ติดตั้ง global (รันผ่าน node เพื่อเลี่ยงปัญหา spawn .cmd บน Windows) → codex บน PATH
export function codexLauncher(env = process.env) {
  const candidates = [String(env.CODEX_BIN || '').trim(), path.join(String(env.APPDATA || ''), 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js')].filter(Boolean)
  for (const c of candidates) {
    if (!existsSync(c)) continue
    return /\.js$/i.test(c) ? { file: process.execPath, args: [c], display: c } : { file: c, args: [], display: c }
  }
  return { file: 'codex', args: [], display: 'codex (PATH)' }
}

// รัน codex exec หนึ่งครั้ง: system + prompt ทาง stdin · คำตอบสุดท้ายจากไฟล์ (--output-last-message) · read-only ไม่แตะรีโป · หมดเวลา = ฆ่าทั้งต้นไม้ process
export async function askCodex({ system, prompt, env = process.env, timeoutMs = Number(env.CODEX_WRITER_TIMEOUT_MS || DEFAULT_CODEX_TIMEOUT_MS) }) {
  const launcher = codexLauncher(env)
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'assetx-codex-'))
  const lastFile = path.join(workDir, 'last.txt')
  const text = `${system}\n\n${prompt}\n\nตอบเป็น JSON ล้วนตามโครงที่กำหนดข้างต้น ไม่มีข้อความอื่น ไม่มี code fence ห้ามรันคำสั่ง ห้ามเขียนไฟล์ ห้ามถามกลับ`
  const model = String(env.CODEX_WRITER_MODEL || '').trim()
  const args = [...launcher.args, 'exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never', '--output-last-message', lastFile, '--cd', workDir, ...(model ? ['-m', model] : []), '-']
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(launcher.file, args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true })
      let stderr = ''
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
        else child.kill('SIGKILL')
      }, timeoutMs)
      child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000) })
      child.on('error', (err) => { clearTimeout(timer); reject(new Error(`Codex เริ่มไม่ได้ (${launcher.display}): ${err.message}`)) })
      child.on('close', (code) => {
        clearTimeout(timer)
        if (timedOut) return reject(new Error(`Codex หมดเวลา ${timeoutMs} ms`))
        if (code !== 0) return reject(new Error(`Codex exit ${code}: ${stderr.trim().split(/\r?\n/).slice(-3).join(' ').slice(0, 300)}`))
        resolve()
      })
      child.stdin.on('error', () => {})
      child.stdin.end(text)
    })
    const out = await readFile(lastFile, 'utf8').catch(() => '')
    if (!out.trim()) throw new Error('Codex ไม่ได้ตอบข้อความ')
    return out
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

export function stripFences(text) {
  return String(text ?? '').replace(/```(?:json)?/gi, '').trim()
}

// โมเดลเล็ก (qwen 14b) ชอบใส่ "ขึ้นบรรทัดใหม่จริง" ในสตริง JSON แทน \n → JSON.parse ล้ม (เจอจริง 6 พ.ย. 2569 ตอนร่างโพสต์ยาว)
// ซ่อมเฉพาะอักขระควบคุมที่อยู่ "ในสตริง" — นอกสตริงไม่แตะ
export function repairJsonText(text) {
  let out = ''
  let inString = false
  let escaped = false
  for (const ch of String(text)) {
    if (inString) {
      if (escaped) { out += ch; escaped = false; continue }
      if (ch === '\\') { out += ch; escaped = true; continue }
      if (ch === '"') { out += ch; inString = false; continue }
      if (ch === '\n') { out += '\\n'; continue }
      if (ch === '\r') continue
      if (ch === '\t') { out += '\\t'; continue }
      out += ch
      continue
    }
    if (ch === '"') inString = true
    out += ch
  }
  return out
}

function parseJsonLoose(s) {
  try { return JSON.parse(s) } catch { /* ลองซ่อมขึ้นบรรทัดในสตริง */ }
  try { return JSON.parse(repairJsonText(s)) } catch { return null }
}

// ดึง JSON ก้อนแรกออกจากคำตอบที่อาจมีคำพูดนำ/ตาม
export function extractJson(text) {
  const s = stripFences(text)
  const whole = parseJsonLoose(s)
  if (whole !== null) return whole
  const starts = [s.indexOf('['), s.indexOf('{')].filter((i) => i >= 0)
  if (!starts.length) return null
  const start = Math.min(...starts)
  const open = s[start]
  const close = open === '[' ? ']' : '}'
  const end = s.lastIndexOf(close)
  if (end <= start) return null
  return parseJsonLoose(s.slice(start, end + 1))
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
  // Codex: ไม่ได้ล็อกอิน / หาไบนารีไม่เจอ = ข้ามตลอดรอบ ไม่เสียเวลาทุกไอเดีย
  return /fetch failed|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|ENOTFOUND|หมดเวลา|Not authenticated|codex login|เริ่มไม่ได้|ENOENT/i.test(String(message || ''))
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

// ยิง /api/chat (API ของ Ollama เอง) แทน /v1/chat/completions — ทางเข้าแบบ OpenAI ไม่รับ options.num_ctx เซิร์ฟเวอร์จึงใช้ค่าเริ่มต้น 4096
// แล้ว "ตัดหัว" prompt ร่างโพสต์ (~8,000 โทเค็น) เหลือ 2,050: system prompt ที่มีกติกาแบรนด์/ความรู้โดเมนหายทั้งก้อน แคปชั่นออกมา 0–80 ตัวอักษร (9 จาก 14 มุมล้ม 7 พ.ย. 2569)
// วัดจริง: num_ctx 8192 → prompt_eval_count 8,153 แคปชั่น 836 ตัวอักษรผ่านด่าน ใช้เวลาเท่าเดิม (~3 นาที) · ตั้ง OLLAMA_NUM_CTX ใน .env.local ถ้าเครื่องแรงกว่า/อ่อนกว่า
export const DEFAULT_OLLAMA_NUM_CTX = 12288
export function ollamaNativeEndpoint(env = process.env) {
  const base = String(env.OLLAMA_URL || DEFAULT_OLLAMA_URL).trim().replace(/\/+$/, '').replace(/\/(v1\/chat\/completions|v1|api\/chat)$/, '')
  return `${base}/api/chat`
}
async function askOllama({ system, prompt, env, fetchImpl }) {
  const numCtx = Number(env.OLLAMA_NUM_CTX || DEFAULT_OLLAMA_NUM_CTX)
  // format:'json' = ให้ Ollama บังคับคำตอบเป็น JSON (ทุกผู้เรียกของ createAsk อ่าน JSON อยู่แล้ว)
  const body = { model: String(env.OLLAMA_MODEL).trim(), stream: false, format: 'json', options: { temperature: 0.4, num_ctx: numCtx }, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }
  const timeoutMs = Number(env.OLLAMA_TIMEOUT_MS || DEFAULT_OLLAMA_TIMEOUT_MS)
  return postChat({ label: 'Ollama', url: ollamaNativeEndpoint(env), body, fetchImpl, timeoutMs })
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
export function createAsk({ env = process.env, fetchImpl = globalThis.fetch, timeoutMs = Number(env.HERMES_AGENT_TIMEOUT_MS || 90000), log = () => {}, codexRunner = null } = {}) {
  const providers = []
  if (codexConfigured(env)) providers.push('codex')
  if (hermesConfigured(env)) providers.push('hermes')
  if (ollamaConfigured(env)) providers.push('ollama')
  if (geminiConfigured(env)) providers.push('gemini')
  const unreachable = new Set()

  const callers = {
    // codexRunner = ตัวแทนสำหรับเทสต์ (ไม่เรียก codex จริง)
    codex: ({ system, prompt }) => (codexRunner ? codexRunner({ system, prompt }) : askCodex({ system, prompt, env })),
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

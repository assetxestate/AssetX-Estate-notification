import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function runHermesCli(prompt, env) {
  const tmpPath = path.join(os.tmpdir(), `assetx-hermes-underwrite-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`)
  await fs.writeFile(tmpPath, prompt, 'utf8')

  try {
    const hermesBin = env.HERMES_CLI_PATH || 'hermes'
    const args = [
      'chat',
      '--query-file',
      tmpPath,
      '--oneshot',
      '--ignore-rules',
      '--in',
      process.cwd(),
      '--source',
      'tool',
      '--run-budget',
      String(env.HERMES_AGENT_RUN_BUDGET_SECONDS || 120),
      '--max-turns',
      String(env.HERMES_AGENT_MAX_TURNS || 2),
    ]
    if (env.HERMES_AGENT_PROVIDER) args.push('--provider', env.HERMES_AGENT_PROVIDER)
    if (env.HERMES_AGENT_MODEL) args.push('--model', env.HERMES_AGENT_MODEL)

    let stdout = ''
    let stderr = ''
    try {
      const result = await execFileAsync(hermesBin, args, {
        cwd: process.cwd(),
        env: { ...process.env, ...env },
        timeout: Number(env.HERMES_CLI_TIMEOUT_MS || env.HERMES_AGENT_TIMEOUT_MS || 90000),
        maxBuffer: 1024 * 1024 * 8,
        windowsHide: true,
      })
      stdout = result.stdout
      stderr = result.stderr
    } catch (err) {
      const details = [
        err.message,
        err.stdout ? `stdout:\n${String(err.stdout).slice(-2000)}` : '',
        err.stderr ? `stderr:\n${String(err.stderr).slice(-2000)}` : '',
      ].filter(Boolean).join('\n\n')
      throw new Error(details)
    }

    const text = String(stdout || '').trim()
    if (text) return text
    throw new Error(String(stderr || 'Hermes CLI did not return output').trim())
  } finally {
    await fs.rm(tmpPath, { force: true }).catch(() => {})
  }
}

async function runGeminiUnderwriting(prompt, systemPrompt, env) {
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('Hermes failed and GEMINI_API_KEY is not configured for fallback')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const fallbackModels = 'gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-pro-preview'
  const models = `${env.GEMINI_UNDERWRITE_MODELS || env.GEMINI_UNDERWRITE_MODEL || ''},${fallbackModels}`
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name, index, list) => list.indexOf(name) === index)
  const errors = []

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      })
      const result = await model.generateContent(prompt)
      const text = result.response.text()
      return `${text}\n\nหมายเหตุระบบ: สร้างด้วย Gemini fallback รุ่น ${modelName}`
    } catch (err) {
      errors.push(`${modelName}: ${err.message}`)
    }
  }

  throw new Error(`Hermes failed and all Gemini fallback models failed:\n${errors.join('\n')}`)
}

function dolGet(urlStr, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr)
    const req = https.request({ hostname: u.hostname, path: u.pathname + (u.search || ''), method: 'GET', headers }, (res) => {
      const setCookies = res.headers['set-cookie'] || []
      const cookies = setCookies.map(c => c.split(';')[0]).join('; ')
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => resolve({ status: res.statusCode, body, cookies }))
    })
    req.on('error', reject)
    req.end()
  })
}

let _dolTokenCache = null
let _dolTokenExpiry = 0

async function autoGetDolToken() {
  if (_dolTokenCache && Date.now() < _dolTokenExpiry) return _dolTokenCache
  try {
    const r = await dolGet('https://landsmaps.dol.go.th/getkey', {
      'Accept': '*/*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    })
    if (r.status === 200 || r.status === 304) {
      const json = JSON.parse(Buffer.from(r.body.trim(), 'base64').toString('utf8'))
      const token = json.defaultAccessToken
      if (token) {
        _dolTokenCache = token
        _dolTokenExpiry = Date.now() + 20 * 60 * 1000
        return token
      }
    }
  } catch (e) {
    console.log('[DOL] auto-token error:', e.message)
  }
  return null
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'gemini-api-dev',
        configureServer(server) {
          server.middlewares.use('/api/login', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method Not Allowed' }))
              return
            }

            let body = ''
            req.on('data', chunk => body += chunk)
            req.on('end', () => {
              try {
                const { username, password } = JSON.parse(body || '{}')
                const ok = String(username ?? '') === String(env.APP_USERNAME ?? '') &&
                  String(password ?? '') === String(env.APP_PASSWORD ?? '')

                res.setHeader('Content-Type', 'application/json')
                if (!env.APP_USERNAME || !env.APP_PASSWORD) {
                  res.statusCode = 500
                  res.end(JSON.stringify({ error: 'ยังไม่ได้ตั้งค่า APP_USERNAME / APP_PASSWORD' }))
                  return
                }

                if (!ok) {
                  res.statusCode = 401
                  res.end(JSON.stringify({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }))
                  return
                }

                res.statusCode = 200
                res.end(JSON.stringify({ ok: true }))
              } catch (e) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'ข้อมูลล็อกอินไม่ถูกต้อง' }))
              }
            })
          })

          server.middlewares.use('/api/underwrite-valuation', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method Not Allowed' }))
              return
            }

            let body = ''
            req.on('data', chunk => body += chunk)
            req.on('end', async () => {
              try {
                const context = JSON.parse(body || '{}')
                const transport = (env.HERMES_AGENT_TRANSPORT || '').toLowerCase()
                const useCli = transport === 'cli' || env.HERMES_AGENT_URL === 'cli'
                const systemPrompt = `คุณคือ underwriting memo generator ของ AssetX Estate

กฎสำคัญ:
- ใช้ข้อมูล JSON ที่ส่งมาใน prompt นี้เท่านั้น ไม่ต้องเรียก tool ไม่ต้องอ่านไฟล์ ไม่ต้องค้นเว็บ
- ตอบภาษาไทยล้วน ยกเว้นคำย่อ MV, QSV, FSV, NRV, LTV, DD
- เลือก final decision เพียง 1 ค่า: ACCEPT, ACCEPT WITH CONDITIONS, RENEGOTIATE AMOUNT / TERMS, หรือ DECLINE
- แยก MV / QSV / FSV / NRV
- แสดง liquidity score, stress test, Safe / Recommended / Maximum exposure
- ระบุ legal/DD risks และ conditions precedent
- ถ้าข้อมูลไม่ครบ ให้ระบุว่าไม่ทราบ / ต้องตรวจสอบ และลด confidence
- ผลลัพธ์เป็น preliminary internal underwriting memo ไม่ใช่รายงานประเมินรับรองหรือคำแนะนำกฎหมาย`
                const userPrompt = `จัดทำ underwriting memo จากข้อมูล AssetX นี้

${JSON.stringify(context, null, 2)}`
                if (!useCli && !env.HERMES_AGENT_URL) {
                  const output = await runGeminiUnderwriting(userPrompt, systemPrompt, env)
                  res.statusCode = 200
                  res.setHeader('Content-Type', 'text/event-stream')
                  res.setHeader('Cache-Control', 'no-cache')
                  res.setHeader('Connection', 'keep-alive')
                  res.write(`data: ${JSON.stringify({ text: `${output}\n\nหมายเหตุระบบ: ใช้ Gemini fallback เพราะยังไม่ได้ตั้งค่า HERMES_AGENT_URL` })}\n\n`)
                  res.write('data: [DONE]\n\n')
                  res.end()
                  return
                }

                if (useCli) {
                  res.statusCode = 200
                  res.setHeader('Content-Type', 'text/event-stream')
                  res.setHeader('Cache-Control', 'no-cache')
                  res.setHeader('Connection', 'keep-alive')

                  let output = ''
                  try {
                    output = await runHermesCli(`${systemPrompt}\n\n${userPrompt}`, env)
                  } catch (cliError) {
                    output = await runGeminiUnderwriting(
                      `${userPrompt}\n\nหมายเหตุระบบ: Hermes CLI ไม่ตอบภายในเวลาที่กำหนด จึงใช้ Gemini fallback เพื่อไม่ให้ workflow สะดุด`,
                      systemPrompt,
                      env
                    )
                    output += `\n\nหมายเหตุระบบ: ใช้ Gemini fallback เพราะ Hermes CLI ล้ม/timeout: ${cliError.message.split('\n')[0]}`
                  }
                  res.write(`data: ${JSON.stringify({ text: output })}\n\n`)
                  res.write('data: [DONE]\n\n')
                  res.end()
                  return
                }

                const format = (env.HERMES_AGENT_FORMAT || 'openai').toLowerCase()
                const hermesBody = format === 'generic'
                  ? {
                      source: 'assetx-estate',
                      mode: 'assetx-underwriting',
                      stream: true,
                      system: systemPrompt,
                      messages: [{ role: 'user', content: userPrompt }],
                      context,
                      input: userPrompt,
                    }
                  : {
                      model: env.HERMES_AGENT_MODEL || 'hermes',
                      stream: true,
                      messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                      ],
                      metadata: { source: 'assetx-estate', mode: 'assetx-underwriting' },
                      assetx_context: context,
                    }

                try {
                  const headers = { 'Content-Type': 'application/json' }
                  if (env.HERMES_AGENT_API_KEY) headers.Authorization = `Bearer ${env.HERMES_AGENT_API_KEY}`

                  const upstream = await fetch(env.HERMES_AGENT_URL, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(hermesBody),
                  })

                  if (!upstream.ok) {
                    const text = await upstream.text().catch(() => '')
                    throw new Error(`Hermes agent ${upstream.status}: ${text || upstream.statusText}`)
                  }

                  res.statusCode = 200
                  res.setHeader('Content-Type', 'text/event-stream')
                  res.setHeader('Cache-Control', 'no-cache')
                  res.setHeader('Connection', 'keep-alive')

                  const contentType = upstream.headers.get('content-type') || ''
                  if (contentType.includes('text/event-stream')) {
                    const reader = upstream.body.getReader()
                    const decoder = new TextDecoder()
                    let buffer = ''
                    while (true) {
                      const { value, done } = await reader.read()
                      if (done) break
                      buffer += decoder.decode(value, { stream: true })
                      const lines = buffer.split(/\r?\n/)
                      buffer = lines.pop() || ''
                      for (const line of lines) {
                        if (!line.startsWith('data: ')) continue
                        const data = line.slice(6).trim()
                        if (!data) continue
                        if (data === '[DONE]') {
                          res.write('data: [DONE]\n\n')
                          res.end()
                          return
                        }
                        try {
                          const parsed = JSON.parse(data)
                          const text = parsed.text || parsed.delta || parsed.content || parsed.message?.content || parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || ''
                          if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`)
                        } catch {
                          res.write(`data: ${JSON.stringify({ text: data })}\n\n`)
                        }
                      }
                    }
                    res.write('data: [DONE]\n\n')
                    res.end()
                    return
                  }

                  const parsed = await upstream.json().catch(async () => ({ text: await upstream.text() }))
                  const text = parsed.text || parsed.output_text || parsed.content || parsed.message?.content || parsed.choices?.[0]?.message?.content || ''
                  res.write(`data: ${JSON.stringify({ text: String(text) })}\n\n`)
                  res.write('data: [DONE]\n\n')
                  res.end()
                } catch (hermesError) {
                  const output = await runGeminiUnderwriting(
                    `${userPrompt}\n\nหมายเหตุระบบ: Hermes ไม่ตอบภายในเวลาที่กำหนด จึงใช้ Gemini fallback เพื่อไม่ให้ workflow สะดุด`,
                    systemPrompt,
                    env
                  )
                  res.statusCode = 200
                  res.setHeader('Content-Type', 'text/event-stream')
                  res.setHeader('Cache-Control', 'no-cache')
                  res.setHeader('Connection', 'keep-alive')
                  res.write(`data: ${JSON.stringify({ text: `${output}\n\nหมายเหตุระบบ: ใช้ Gemini fallback เพราะ Hermes ล้ม/timeout: ${hermesError.message.split('\n')[0]}` })}\n\n`)
                  res.write('data: [DONE]\n\n')
                  res.end()
                }
              } catch (e) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: e.message }))
              }
            })
          })

          server.middlewares.use('/api/landsmaps', async (req, res) => {
            try {
              const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : ''
              const params = new URLSearchParams(qs)
              const action = params.get('action')
              const BASE = 'https://landsmaps.dol.go.th/apiService/LandsMaps'
              const url = action === 'amphoe'
                ? `${BASE}/GetAmphoeByProvinceId/${params.get('provCode')}`
                : `${BASE}/GetParcelByParcelNo/${params.get('provCode')}/${params.get('ampCode')}/${params.get('deedNo')}`
              const userCookie = req.headers['x-dol-cookie'] || ''
              const userToken  = req.headers['x-dol-token'] || ''
              const autoToken  = await autoGetDolToken()
              const bearerToken = userToken || autoToken
              const BASE_HEADERS = {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://landsmaps.dol.go.th/',
                'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...(bearerToken ? { 'Authorization': `Bearer ${bearerToken}` } : {}),
              }
              if (userCookie) {
                const r = await dolGet(url, { ...BASE_HEADERS, Cookie: userCookie })
                console.log('[DOL user-cookie]', r.status, r.body.slice(0, 120))
                if (!r.body.trim().startsWith('<')) { res.statusCode = r.status; res.setHeader('Content-Type', 'application/json'); return res.end(r.body) }
                res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ error: 'INCAPSULA_BLOCK' }))
              }
              const probe = await dolGet(url, BASE_HEADERS)
              if (!probe.body.trim().startsWith('<')) { res.statusCode = probe.status; res.setHeader('Content-Type', 'application/json'); return res.end(probe.body) }
              const retry = await dolGet(url, { ...BASE_HEADERS, Cookie: probe.cookies })
              if (!retry.body.trim().startsWith('<')) { res.statusCode = retry.status; res.setHeader('Content-Type', 'application/json'); return res.end(retry.body) }
              res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'INCAPSULA_BLOCK' }))
            } catch (e) {
              res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: e.message }))
            }
          })

          // Proxy กรมธนารักษ์ — Dev เท่านั้น (Production ใช้ api/treasury.js)
          server.middlewares.use('/api/treasury', async (req, res) => {
            try {
              const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
              const params = new URLSearchParams(qs)
              const targetUrl = decodeURIComponent(params.get('url') || '')
              if (!targetUrl.startsWith('https://catalog.treasury.go.th/')) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Invalid URL' }))
                return
              }
              const upstream = await fetch(targetUrl)
              const text = await upstream.text()
              res.setHeader('Content-Type', 'application/json')
              res.end(text)
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: e.message }))
            }
          })

          // Dev server middleware เท่านั้น — Production ใช้ api/chat.js (Vercel)
          server.middlewares.use('/api/chat', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end('Method Not Allowed')
              return
            }

            let body = ''
            req.on('data', chunk => body += chunk)
            req.on('end', async () => {
              try {
                const { messages, customerData } = JSON.parse(body)

                const apiKey = env.GEMINI_API_KEY
                if (!apiKey || apiKey === 'your_gemini_api_key_here') {
                  res.statusCode = 401
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'กรุณาตั้งค่า GEMINI_API_KEY ในไฟล์ .env' }))
                  return
                }

                const today = new Date().toLocaleDateString('th-TH', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })

                const systemPrompt = `คุณเป็นผู้ช่วย AI ของระบบ AssetX Estate ระบบบริหารสัญญาจำนองและขายฝาก
วันที่ปัจจุบัน: ${today}

ข้อมูลลูกค้าทั้งหมดในระบบ:
${JSON.stringify(customerData, null, 2)}

ความสามารถของคุณ:
- สรุปภาพรวมพอร์ตโฟลิโอ (จำนวนสัญญา, เงินต้นรวม, ดอกเบี้ยรวม)
- แจ้งงวดชำระที่ใกล้ครบกำหนดหรือเลยกำหนด
- คำนวณดอกเบี้ยสะสม, ยอดค้างชำระ
- ค้นหาข้อมูลลูกค้าและโฉนดที่ดิน
- วิเคราะห์และเปรียบเทียบสัญญา
- ตอบคำถามทั่วไปเกี่ยวกับสัญญาจำนองและขายฝาก

กฎการตอบ:
- ตอบเป็นภาษาไทยเสมอ
- กระชับ ชัดเจน ตรงประเด็น
- ใช้ตัวเลขที่คำนวณได้จริงจากข้อมูล
- จัดรูปแบบด้วย markdown เมื่อมีหลายรายการ`

                const userMessage = messages[messages.length - 1].content
                const history = messages.slice(0, -1).map(m => ({
                  role: m.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: m.content }],
                }))

                const genAI = new GoogleGenerativeAI(apiKey)
                const model = genAI.getGenerativeModel({
                  model: 'gemini-3.6-flash',
                  systemInstruction: systemPrompt,
                })

                const chat = model.startChat({ history })

                res.setHeader('Content-Type', 'text/event-stream')
                res.setHeader('Cache-Control', 'no-cache')
                res.setHeader('Connection', 'keep-alive')
                res.setHeader('Access-Control-Allow-Origin', '*')

                const result = await chat.sendMessageStream(userMessage)

                for await (const chunk of result.stream) {
                  const text = chunk.text()
                  if (text) {
                    res.write(`data: ${JSON.stringify({ text })}\n\n`)
                  }
                }

                res.write('data: [DONE]\n\n')
                res.end()
              } catch (err) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: err.message }))
              }
            })
          })

          // Dev server middleware เท่านั้น — Production ใช้ api/assess-chat.js (Vercel)
          // หน้า /assess สาธารณะ — ไม่ส่ง customerData เข้ามาเด็ดขาด
          server.middlewares.use('/api/assess-chat', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end('Method Not Allowed')
              return
            }

            let body = ''
            req.on('data', chunk => body += chunk)
            req.on('end', async () => {
              try {
                const { messages } = JSON.parse(body)

                if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'ข้อความไม่ถูกต้อง' }))
                  return
                }

                const apiKey = env.GEMINI_API_KEY
                if (!apiKey || apiKey === 'your_gemini_api_key_here') {
                  res.statusCode = 401
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'กรุณาตั้งค่า GEMINI_API_KEY ในไฟล์ .env' }))
                  return
                }

                const today = new Date().toLocaleDateString('th-TH', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })

                const systemPrompt = `คุณเป็นที่ปรึกษาทางการเงินและกฎหมายของ AssetX Estate มืออาชีพและเป็นมิตร
วันที่ปัจจุบัน: ${today}

หน้าที่ของคุณ: ช่วยผู้สนใจที่กำลังกรอกแบบฟอร์มประเมินทรัพย์สินออนไลน์ (จำนอง/ขายฝาก) ให้เข้าใจขั้นตอนและตัดสินใจได้ง่ายขึ้น

ความรู้ที่ตอบได้:
- ความแตกต่างระหว่าง "จำนอง" (ยังครอบครองทรัพย์สินได้ จดจำนองที่กรมที่ดิน) กับ "ขายฝาก" (โอนกรรมสิทธิ์ชั่วคราว มีสิทธิ์ไถ่คืนภายในกำหนด)
- ขั้นตอนทั่วไปของการขอสินเชื่อ/ขายฝากกับทางบริษัท
- คำอธิบายฟิลด์ในฟอร์ม (เช่น LTV, ราคาประเมิน, FSV คืออะไร) แบบเข้าใจง่าย ไม่ใช้ศัพท์เทคนิคเกินจำเป็น
- ตอบคำถามที่พบบ่อย เช่น "จะถูกยึดที่ดินไหม" "ไถ่คืนได้กี่ครั้ง" "เอกสารที่ต้องเตรียม"

กฎการตอบ (สำคัญมาก):
- ตอบเป็นภาษาไทยเสมอ กระชับ เป็นมิตร ไม่ใช้ศัพท์กฎหมายจ๋าเกินไป
- ให้ข้อมูลทั่วไปเท่านั้น ไม่ใช่คำแนะนำทางกฎหมายที่ผูกพัน — ถ้าคำถามเจาะจงกรณีของผู้ถามเอง ให้แนะนำให้กรอกฟอร์มให้ครบแล้วทีมงานจะติดต่อกลับ
- ห้ามเดาหรือฟันธงวงเงิน/ราคาประเมินที่แน่นอน ให้บอกว่าต้องรอทีมงานประเมินจริง
- ห้ามขอหรือพูดถึงข้อมูลลูกค้ารายอื่นในระบบ (คุณไม่มีสิทธิ์เข้าถึงข้อมูลนั้น)`

                const userMessage = messages[messages.length - 1].content
                const history = messages.slice(0, -1).map(m => ({
                  role: m.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: m.content }],
                }))

                const genAI = new GoogleGenerativeAI(apiKey)
                const model = genAI.getGenerativeModel({
                  model: 'gemini-3.6-flash',
                  systemInstruction: systemPrompt,
                })

                const chat = model.startChat({ history })

                res.setHeader('Content-Type', 'text/event-stream')
                res.setHeader('Cache-Control', 'no-cache')
                res.setHeader('Connection', 'keep-alive')
                res.setHeader('Access-Control-Allow-Origin', '*')

                const result = await chat.sendMessageStream(userMessage)

                for await (const chunk of result.stream) {
                  const text = chunk.text()
                  if (text) {
                    res.write(`data: ${JSON.stringify({ text })}\n\n`)
                  }
                }

                res.write('data: [DONE]\n\n')
                res.end()
              } catch (err) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: err.message }))
              }
            })
          })
        }
      }
    ],
  }
})

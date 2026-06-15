import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { GoogleGenerativeAI } from '@google/generative-ai'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'gemini-api-dev',
        configureServer(server) {
          // Proxy กรมที่ดิน LandsMaps — Dev เท่านั้น (Production ใช้ api/landsmaps.js)
          server.middlewares.use('/api/landsmaps', async (req, res) => {
            try {
              const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : ''
              const params = new URLSearchParams(qs)
              const action = params.get('action')
              const BASE = 'https://landsmaps.dol.go.th/apiService/LandsMaps'
              const HEADERS = {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Referer': 'https://landsmaps.dol.go.th/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8',
              }
              let url
              if (action === 'amphoe') {
                url = `${BASE}/GetAmphoeByProvinceId/${params.get('provCode')}`
              } else {
                url = `${BASE}/GetParcelByParcelNo/${params.get('provCode')}/${params.get('ampCode')}/${params.get('deedNo')}`
              }
              console.log('[DOL proxy] →', url)
              const upstream = await fetch(url, { headers: HEADERS })
              console.log('[DOL proxy] ← status:', upstream.status)
              const text = await upstream.text()
              console.log('[DOL proxy] body preview:', text.slice(0, 200))
              res.statusCode = upstream.status
              res.setHeader('Content-Type', 'application/json')
              res.end(text)
            } catch (e) {
              console.error('[DOL proxy] ERROR:', e.message, e.cause?.message || '')
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: e.message, cause: e.cause?.message }))
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
                  model: 'gemini-2.0-flash',
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

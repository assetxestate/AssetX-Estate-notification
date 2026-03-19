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

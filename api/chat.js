import { verifySession } from './_auth.js'
import { isHermesEnabled, streamHermesChat } from './_hermes.js'
import { setSseHeaders, streamGeminiChat } from './_gemini.js'

export default async function handler(req, res) {
  // CORS: อนุญาตเฉพาะ same-origin (ไม่เปิด * เพราะ endpoint นี้ส่งข้อมูลลูกค้า)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // ต้องล็อกอินก่อน — กัน endpoint ที่ส่ง PII ลูกค้าไป Gemini ถูกเรียกโดยไม่ได้รับอนุญาต
  if (!verifySession(req)) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })
  }

  try {
    const { messages, customerData } = req.body

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

    if (isHermesEnabled()) {
      setSseHeaders(res)
      try {
        await streamHermesChat({
          res,
          messages,
          systemPrompt,
          context: { customerData },
          mode: 'private-portfolio',
        })
        return res.end()
      } catch (hermesError) {
        await streamGeminiChat({
          res,
          messages,
          systemPrompt,
          completionNote: `\n\nหมายเหตุระบบ: ใช้ Gemini fallback เพราะ Hermes ล้ม/timeout: ${hermesError.message.split('\n')[0]}`,
        })
        return res.end()
      }
    }

    await streamGeminiChat({ res, messages, systemPrompt })
    res.end()

  } catch (err) {
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ text: `\n\nระบบ AI ตอบกลับไม่สำเร็จ: ${err.message}` })}\n\n`)
      res.write('data: [DONE]\n\n')
      return res.end()
    }
    res.status(500).json({ error: err.message })
  }
}

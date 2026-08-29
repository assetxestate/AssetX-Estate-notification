import { isHermesEnabled, streamHermesChat } from './_hermes.js'
import { setSseHeaders, streamGeminiChat } from './_gemini.js'

// Endpoint สาธารณะสำหรับหน้าประเมินออนไลน์ /assess — ไม่ต้องล็อกอิน (ตั้งใจ)
// ห้ามส่งข้อมูลลูกค้าภายในระบบ (customerData) เข้ามาที่นี่เด็ดขาด — ต่างจาก api/chat.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { messages } = req.body

    // จำกัดความยาวบทสนทนาต่อ request กันโดนถีบ Gemini API เกินจำเป็น (endpoint นี้เปิดสาธารณะ)
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
      return res.status(400).json({ error: 'ข้อความไม่ถูกต้อง' })
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

    if (isHermesEnabled()) {
      setSseHeaders(res)
      try {
        await streamHermesChat({
          res,
          messages,
          systemPrompt,
          context: {},
          mode: 'public-assessment',
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

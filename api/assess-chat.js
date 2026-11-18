import { isHermesEnabled, streamHermesChat } from './_hermes.js'
import { setSseHeaders, streamGeminiChat } from './_gemini.js'
import { isOllamaChatEnabled, askOllamaChat } from './_ollama.js'
import { buildAssessSystemPrompt, looksBroken, fallbackAnswer } from './_assess-knowledge.js'
import { POSTER_CONTACT } from '../src/lib/posterDesignSystem.js'
import { leadNotifyText } from '../src/lib/leadSource.js'
import { serviceDb, freshLead, listLeadFiles, uploadLeadFile, leadIdOf } from '../server/leadFiles.js'

const notifiedLeads = new Set() // กันแจ้งซ้ำภายใน instance เดียวกัน (พอสำหรับการกดซ้ำ ไม่ใช่ด่านความปลอดภัย)

// endpoint นี้เปิดสาธารณะ จึงไม่รับข้อความจากผู้เรียกเลย: รับแค่เลขที่ แล้วอ่านแถวเองด้วย service key
// แจ้งเฉพาะแถวที่เป็น lead จากเว็บและเพิ่งสร้าง (freshLead) → คนนอกสั่งให้บอทส่งข้อความตามใจไม่ได้
// ข้อความไม่มีชื่อ เบอร์ หรือ LINE (leadNotifyText) และไม่ log ข้อมูลผู้ติดต่อ
async function notifyNewLead(rawId) {
  const id = leadIdOf(rawId)
  if (!id || notifiedLeads.has(id)) return { sent: false }

  const token = process.env.ASSETX_TELEGRAM_BOT_TOKEN
  const chatId = String(process.env.ASSETX_TELEGRAM_ALLOWED_CHAT_ID || '').trim()
  const admin = serviceDb()
  if (!admin || !token || !chatId) return { sent: false }

  const row = await freshLead(admin, id)
  if (!row) return { sent: false }
  // หน้าเว็บส่งรูปให้ครบก่อนแล้วจึงเรียกแจ้งเตือน จึงนับรูปแนบได้ตรงนี้ (นับไม่ได้ = ไม่บอกจำนวน ไม่ขวางการแจ้ง)
  const files = await listLeadFiles(admin, id).then((list) => list.length).catch(() => 0)

  notifiedLeads.add(id)
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: leadNotifyText(row, { files }), disable_web_page_preview: true }),
  })
  if (!response.ok) { notifiedLeads.delete(id); throw new Error(`Telegram ${response.status}`) }
  return { sent: true }
}

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

  // แจ้งเตือน lead ใหม่จากหน้า /assess — อยู่ในไฟล์นี้เพราะโปรเจกต์ใช้ฟังก์ชัน Vercel ครบโควตาแล้ว
  if (req.body?.mode === 'lead-notify') {
    try {
      return res.status(200).json(await notifyNewLead(req.body.id))
    } catch (err) {
      console.error('lead-notify failed:', err.message)
      return res.status(200).json({ sent: false })
    }
  }

  // รูปแนบของ lead (เอกสารสิทธิ์/รูปทรัพย์) ทีละรูป → bucket ปิด · ด่านตรวจอยู่ใน server/leadFiles.js
  if (req.body?.mode === 'lead-upload') {
    try {
      const result = await uploadLeadFile({ id: req.body.id, file: req.body.file })
      return res.status(result.ok ? 200 : 400).json(result)
    } catch (err) {
      console.error('lead-upload failed:', err.message)
      return res.status(500).json({ ok: false, error: 'ส่งรูปไม่สำเร็จ' })
    }
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
    const phone = POSTER_CONTACT.phone
    // ผู้ช่วยตอบจากคลังความรู้ที่ตรวจแหล่งแล้วเท่านั้น (เลือกข้อตามคำถาม) — ดู api/_assess-knowledge.js
    const systemPrompt = buildAssessSystemPrompt({ messages, today, phone })
    const sendText = (text) => {
      setSseHeaders(res)
      res.write(`data: ${JSON.stringify({ text })}\n\n`)
      res.write('data: [DONE]\n\n')
      return res.end()
    }

    // เจ้าของเลือกให้ Ollama บนเครื่องของเราตอบ (ASSESS_CHAT_PROVIDER=ollama)
    // คำตอบต้องผ่านด่านตรวจก่อนแสดง (ภาษาอื่นหลุด/คำมั่ว) ลองได้ 2 ครั้ง · ไม่ผ่านหรือต่อไม่ติด = ใช้ Gemini ด้านล่าง
    if (isOllamaChatEnabled()) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const answer = await askOllamaChat({ messages, systemPrompt })
          if (!looksBroken(answer)) return sendText(answer.replace(/\*\*|^#+\s*/gm, ''))
          console.error(`assess-chat ollama: คำตอบไม่ผ่านด่านตรวจ (ครั้งที่ ${attempt})`)
        } catch (ollamaError) {
          console.error('assess-chat ollama failed:', ollamaError.message)
          break
        }
      }
    } else if (isHermesEnabled()) {
      setSseHeaders(res)
      try {
        await streamHermesChat({ res, messages, systemPrompt, context: {}, mode: 'public-assessment' })
        return res.end()
      } catch (hermesError) {
        console.error('assess-chat hermes failed:', hermesError.message.split('\n')[0])
      }
    }

    await streamGeminiChat({ res, messages, systemPrompt })
    res.end()

  } catch (err) {
    // หน้าสาธารณะ: ไม่แสดงข้อความผิดพลาดของระบบให้ผู้ใช้เห็น ให้ทางติดต่อแทน
    console.error('assess-chat failed:', err.message)
    const text = fallbackAnswer(POSTER_CONTACT.phone)
    const partial = res.headersSent // มีคำตอบบางส่วนออกไปแล้ว → ต่อท้ายด้วยบรรทัดใหม่
    if (!partial) setSseHeaders(res)
    res.write(`data: ${JSON.stringify({ text: partial ? `\n\n${text}` : text })}\n\n`)
    res.write('data: [DONE]\n\n')
    return res.end()
  }

}

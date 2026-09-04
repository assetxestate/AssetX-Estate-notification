import { verifySession } from './_auth.js'
import { buildUnderwritingSystemPrompt, isHermesEnabled, streamHermesChat } from './_hermes.js'
import { setSseHeaders, streamGeminiText } from './_gemini.js'

function sanitizeValuationContext(input = {}) {
  const {
    valuation = {},
    underwritingPolicy = {},
    nearbyPricePoints = [],
    documents = [],
    missingFields = [],
    instructions = '',
  } = input

  return {
    valuation,
    underwriting_policy: underwritingPolicy && typeof underwritingPolicy === 'object' ? underwritingPolicy : {},
    nearby_price_points: Array.isArray(nearbyPricePoints) ? nearbyPricePoints.slice(0, 12) : [],
    documents: Array.isArray(documents) ? documents.slice(0, 20) : [],
    missing_fields: Array.isArray(missingFields) ? missingFields : [],
    instructions: String(instructions || ''),
  }
}

function buildUserPrompt(context) {
  return `ใช้ skill underwrite-thai-real-estate-collateral เพื่อจัดทำ underwriting memo จากข้อมูล AssetX ด้านล่าง

ข้อกำหนดสำคัญ:
- ตอบภาษาไทยล้วน
- เลือก final decision เพียง 1 ค่า
- แยก MV / QSV / FSV / NRV
- แสดง Safe / Recommended / Maximum exposure
- ใช้ underwriting_policy เป็น policy gate ภายใน: decision, red flags, exposure bands, conditions precedent
- ถ้า underwriting_policy มี decision เป็น Hold / Legal DD หรือ Reduce Exposure ให้ถือเป็นข้อจำกัดสำคัญใน memo
- ระบุ legal/DD risks และ conditions precedent
- ถ้ามี valuation.propertyImages ให้ใช้เป็นรายการภาพประกอบ/หลักฐานตรวจทรัพย์ และระบุสิ่งที่ควรตรวจจากภาพ หากเปิดดูภาพจริงไม่ได้ให้บอกว่า "ต้องตรวจภาพจริงโดยผู้ประเมิน"
- ถ้าข้อมูลไม่พอ ให้ระบุว่าไม่ทราบ / ต้องตรวจสอบ

ข้อมูล:
${JSON.stringify(context, null, 2)}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  if (!verifySession(req)) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })
  }

  try {
    const context = sanitizeValuationContext(req.body)
    const systemPrompt = buildUnderwritingSystemPrompt()
    const userPrompt = buildUserPrompt(context)
    const messages = [{ role: 'user', content: userPrompt }]

    setSseHeaders(res)

    if (isHermesEnabled()) {
      try {
        await streamHermesChat({
          res,
          messages,
          systemPrompt,
          context,
          mode: 'assetx-underwriting',
        })
        return res.end()
      } catch (hermesError) {
        await streamGeminiText({
          res,
          prompt: `${userPrompt}\n\nหมายเหตุระบบ: Hermes ไม่ตอบภายในเวลาที่กำหนด จึงใช้ Gemini fallback เพื่อไม่ให้ workflow สะดุด`,
          systemPrompt,
          completionNote: `\n\nหมายเหตุระบบ: ใช้ Gemini fallback เพราะ Hermes ล้ม/timeout: ${hermesError.message.split('\n')[0]}`,
        })
        return res.end()
      }
    }

    await streamGeminiText({
      res,
      prompt: userPrompt,
      systemPrompt,
      completionNote: '\n\nหมายเหตุระบบ: ใช้ Gemini fallback เพราะยังไม่ได้ตั้งค่า HERMES_AGENT_URL',
    })
    return res.end()
  } catch (err) {
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ text: `\n\nระบบสร้าง memo ไม่สำเร็จ: ${err.message}` })}\n\n`)
      res.write('data: [DONE]\n\n')
      return res.end()
    }
    return res.status(500).json({ error: err.message })
  }
}

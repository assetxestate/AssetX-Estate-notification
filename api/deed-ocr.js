import { GoogleGenerativeAI } from '@google/generative-ai'
import { verifySession } from './_auth.js'

const DEFAULT_DEED_OCR_MODELS = 'gemini-3.6-flash,gemini-3.5-flash,gemini-2.5-flash'
const MAX_IMAGE_BYTES = 7 * 1024 * 1024

function getModels() {
  const configured = process.env.GEMINI_DEED_OCR_MODELS || process.env.GEMINI_MODEL || ''
  return [...new Set(`${configured},${DEFAULT_DEED_OCR_MODELS}`
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean))]
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('กรุณาตั้งค่า GEMINI_API_KEY ใน Environment Variables')
  }
  return new GoogleGenerativeAI(apiKey)
}

function extractJson(text = '') {
  const trimmed = String(text || '').trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : trimmed
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('อ่านผลลัพธ์ OCR ไม่ได้')
  return JSON.parse(raw.slice(start, end + 1))
}

function cleanDigits(value) {
  return String(value ?? '').replace(/[^\d]/g, '')
}

function cleanMapSheet(value) {
  return String(value ?? '').replace(/\s+/g, '').trim()
}

function normalizeResult(parsed = {}) {
  const deed = parsed.deed || parsed
  const area = deed.area || {}
  return {
    titleDeedNo: cleanDigits(deed.titleDeedNo || deed.deedNo || deed.title_deed_no),
    landNo: cleanDigits(deed.landNo || deed.land_no),
    mapSheet: cleanMapSheet(deed.mapSheet || deed.map_sheet),
    surveyPage: cleanDigits(deed.surveyPage || deed.survey_page),
    areaRai: Number(area.rai ?? deed.areaRai ?? deed.area_rai ?? 0) || 0,
    areaNgan: Number(area.ngan ?? deed.areaNgan ?? deed.area_ngan ?? 0) || 0,
    areaSqw: Number(area.sqw ?? deed.areaSqw ?? deed.area_sqw ?? 0) || 0,
    confidence: Number(parsed.confidence ?? deed.confidence ?? 0) || 0,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String).slice(0, 5) : [],
  }
}

function buildPrompt() {
  return `อ่านข้อมูลจากภาพหน้าโฉนดที่ดินไทย และตอบกลับเป็น JSON เท่านั้น

ต้องดึงข้อมูลต่อไปนี้เมื่อเห็นชัด:
- titleDeedNo = เลขโฉนดที่ดิน
- landNo = เลขที่ดิน
- mapSheet = ระวาง
- surveyPage = หน้าสำรวจ
- area.rai = เนื้อที่ไร่
- area.ngan = เนื้อที่งาน
- area.sqw = เนื้อที่ตารางวา
- confidence = ความมั่นใจรวม 0-1
- warnings = ข้อควรตรวจซ้ำ เช่น ภาพไม่ชัด ตัวเลขถูกบัง หรืออ่านได้ไม่ครบ

กติกา:
- ห้ามเดา ถ้าไม่เห็นให้ใส่ค่าว่างหรือ 0
- เลขโฉนด เลขที่ดิน หน้าสำรวจ ให้เป็นตัวเลขล้วน
- ระวางให้คงตัวอักษรโรมัน/เลขที่เห็น เช่น 5237I หรือ 5035IV
- ตอบ JSON เท่านั้น ห้ามมีคำอธิบายอื่น

รูปแบบ:
{
  "titleDeedNo": "",
  "landNo": "",
  "mapSheet": "",
  "surveyPage": "",
  "area": { "rai": 0, "ngan": 0, "sqw": 0 },
  "confidence": 0,
  "warnings": []
}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  if (!verifySession(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })

  try {
    const { imageBase64, mimeType } = req.body || {}
    const image = String(imageBase64 || '').replace(/^data:[^;]+;base64,/, '')
    const mime = String(mimeType || 'image/jpeg')
    const imageBytes = Math.ceil((image.length * 3) / 4)

    if (!image) return res.status(400).json({ error: 'กรุณาแนบรูปหน้าโฉนด' })
    if (!mime.startsWith('image/')) return res.status(400).json({ error: 'รองรับเฉพาะไฟล์รูปภาพ' })
    if (imageBytes > MAX_IMAGE_BYTES) return res.status(413).json({ error: 'รูปใหญ่เกินไป กรุณาลดขนาดรูปก่อนอัปโหลด' })

    const genAI = getGeminiClient()
    const errors = []

    for (const modelName of getModels()) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent([
          { text: buildPrompt() },
          { inlineData: { data: image, mimeType: mime } },
        ])
        const parsed = extractJson(result.response.text())
        return res.status(200).json({ success: true, deed: normalizeResult(parsed), model: modelName })
      } catch (error) {
        errors.push(`${modelName}: ${error.message}`)
      }
    }

    throw new Error(errors[0] || 'อ่านรูปโฉนดไม่สำเร็จ')
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'อ่านรูปโฉนดไม่สำเร็จ' })
  }
}

// ข้อความผิดพลาดที่ปลอดภัยต่อการแสดงบนหน้า /marketing (และหน้าต่างออกแบบภาพที่เปิดจากหน้านี้)
// ไม่โชว์ชื่อตัวแปร env · โค้ด HTTP · ชื่อไฟล์ · ชื่อบริการเบื้องหลัง · ข้อความอังกฤษจากเบราว์เซอร์ — ข้อความไทยปกติจากเซิร์ฟเวอร์ผ่านได้

export const SESSION_EXPIRED_MESSAGE = 'เซสชันหมดอายุ กดเข้าสู่ระบบใหม่'
export const NETWORK_ERROR_MESSAGE = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง'

const LEAKY = /[A-Z]{2,}_[A-Z_]+|Environment Variables|\.env\b|\.sql\b|\.md\b|HTTP \d{3}|API \d{3}|Graph API|\bcode \d+|Supabase|Tavily|Hermes|Obsidian|OpenAI|Gemini|server/i
const THAI = /[฀-๿]/

export function isSafeMessage(text) {
  const value = String(text || '').trim()
  return Boolean(value) && THAI.test(value) && !LEAKY.test(value)
}

// ข้อความจาก API: 401 = เซสชันหมดอายุ · ตัดหางรายละเอียด Facebook Graph · ข้อความที่ไม่ปลอดภัยหรือไม่มีภาษาไทยเลย = ใช้ข้อความสำรอง
export function friendlyApiError(status, data, fallback) {
  if (status === 401) return SESSION_EXPIRED_MESSAGE
  const raw = String(data?.error || data?.message || '').split(' — Facebook (')[0].trim()
  return isSafeMessage(raw) ? raw : fallback
}

// error ที่จับได้ใน catch: fetch ล้มทั้งก้อน (เครือข่าย) → ข้อความเครือข่าย · ข้อความไทยที่ปลอดภัย → ใช้ตามนั้น · อื่น ๆ → ข้อความสำรอง
export function errorMessage(error, fallback) {
  if (error instanceof TypeError && /fetch|network|load failed/i.test(String(error.message || ''))) return NETWORK_ERROR_MESSAGE
  const message = String(error?.message || '').trim()
  return isSafeMessage(message) ? message : fallback
}

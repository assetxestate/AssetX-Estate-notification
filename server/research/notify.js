// ส่งรายงานรอบรีเสิร์ชเข้าห้องเทเลแกรมของเจ้าของ (ห้องเดียวกับบอท AssetX)
// ใช้ ASSETX_TELEGRAM_BOT_TOKEN + ASSETX_TELEGRAM_ALLOWED_CHAT_ID · ไม่มีค่า = ข้ามเงียบ ๆ แล้วบอกใน log
// ข้อความต้องเป็นตัวเลขรวม + หัวข้อที่ผ่านตัวลบข้อมูลบุคคลแล้วเท่านั้น (ผู้เรียกรับผิดชอบ)
const TELEGRAM_API = 'https://api.telegram.org'
const MAX_LEN = 3500

export function telegramConfigured(env = process.env) {
  return Boolean(String(env.ASSETX_TELEGRAM_BOT_TOKEN || '').trim() && String(env.ASSETX_TELEGRAM_ALLOWED_CHAT_ID || '').trim())
}

export async function sendTelegramReport(text, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!telegramConfigured(env)) return { ok: false, skipped: true, reason: 'ไม่มี ASSETX_TELEGRAM_BOT_TOKEN/ASSETX_TELEGRAM_ALLOWED_CHAT_ID' }
  const token = String(env.ASSETX_TELEGRAM_BOT_TOKEN).trim()
  const chatId = String(env.ASSETX_TELEGRAM_ALLOWED_CHAT_ID).trim()
  const body = String(text ?? '').slice(0, MAX_LEN)
  try {
    const response = await fetchImpl(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: body, disable_web_page_preview: true }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.ok === false) return { ok: false, skipped: false, reason: data.description || `HTTP ${response.status}` }
    return { ok: true, skipped: false }
  } catch (error) {
    return { ok: false, skipped: false, reason: error?.message || String(error) }
  }
}

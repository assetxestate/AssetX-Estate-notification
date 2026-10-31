import { buildAssetxTelegramReply } from './_assetxTelegramAssistant.js';

const TELEGRAM_API = 'https://api.telegram.org';
// /diary หรือ /diary@ชื่อบอท (ตามด้วยข้อความอะไรก็ได้) → ส่งปุ่มเปิดไดอารี่งาน ไม่ส่งต่อให้ AI
const DIARY_COMMAND = /^\/diary(?:@\w+)?(?:\s|$)/i;
const DEFAULT_DIARY_HOST = 'assetx-estate.vercel.app';

function getMessage(update) {
  return (
    update?.message ||
    update?.edited_message ||
    update?.channel_post ||
    update?.edited_channel_post ||
    null
  );
}

function getChatId(message) {
  return message?.chat?.id == null ? '' : String(message.chat.id);
}

function isAllowedChat(chatId) {
  const allowed = String(process.env.ASSETX_TELEGRAM_ALLOWED_CHAT_ID || '').trim();
  return !allowed || chatId === allowed;
}

// URL หน้าไดอารี่: ตั้ง ASSETX_DIARY_URL ได้ · ไม่ตั้ง = โดเมนที่รับ webhook นี้อยู่ + /diary
export function diaryUrl(req) {
  const configured = String(process.env.ASSETX_DIARY_URL || '').trim();
  if (configured) return configured;
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim();
  return `https://${host || DEFAULT_DIARY_HOST}/diary`;
}

async function callTelegram(method, payload) {
  const token = process.env.ASSETX_TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('ASSETX_TELEGRAM_BOT_TOKEN is not configured');

  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(`Telegram API ${method} ${response.status}: ${data.description || ''}`.trim());
  }
  return data.result;
}

async function sendTelegramMessage(chatId, text, extra = {}) {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra,
  });
}

// ปุ่มเปิดไดอารี่งานในห้อง: ข้อความพร้อมปุ่มลิงก์ (ปักหมุดไว้บนห้อง) · ปุ่มเมนูข้างช่องพิมพ์ (Telegram ให้ตั้งได้เฉพาะแชทส่วนตัว)
// · ลงทะเบียน /diary ในรายการคำสั่งของบอท — ขั้นเสริมล้มได้โดยไม่กระทบปุ่มหลัก (เช่น บอทไม่ได้เป็นแอดมินกลุ่มจึงปักหมุดไม่ได้)
export async function sendDiaryButton(chatId, url, { chatType = 'private' } = {}) {
  const sent = await sendTelegramMessage(
    chatId,
    '📓 ไดอารี่งาน AssetX\nกดปุ่มด้านล่างเพื่อเปิด — ล็อกอินด้วยบัญชีเว็บ AssetX (ไม่ต้องมีบัญชี Claude)\nติ๊กเรื่องค้าง เลือกทาง หรือพิมพ์สั่งงาน Claude ได้จากหน้านั้น',
    { reply_markup: { inline_keyboard: [[{ text: '📓 เปิดไดอารี่งาน', url }]] } },
  );

  const extras = {};
  if (sent?.message_id) {
    extras.pinned = callTelegram('pinChatMessage', { chat_id: chatId, message_id: sent.message_id, disable_notification: true });
  }
  if (chatType === 'private') {
    extras.menuButton = callTelegram('setChatMenuButton', {
      chat_id: chatId,
      menu_button: { type: 'web_app', text: 'ไดอารี่งาน', web_app: { url } },
    });
  }
  extras.commands = callTelegram('setMyCommands', {
    commands: [
      { command: 'diary', description: 'เปิดไดอารี่งาน AssetX (ปุ่มลิงก์)' },
      { command: 'help', description: 'วิธีใช้บอท' },
      { command: 'id', description: 'ดู chat id ของห้องนี้' },
    ],
  });

  const outcome = { sent: true };
  for (const [key, promise] of Object.entries(extras)) {
    try {
      await promise;
      outcome[key] = true;
    } catch (error) {
      outcome[key] = false;
      console.warn(`AssetX Telegram diary button: ${key} skipped — ${error.message}`);
    }
  }
  return outcome;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'assetx-telegram-webhook',
      botConfigured: Boolean(process.env.ASSETX_TELEGRAM_BOT_TOKEN),
      restrictedChat: Boolean(process.env.ASSETX_TELEGRAM_ALLOWED_CHAT_ID),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const message = getMessage(req.body);
  if (!message) {
    return res.status(200).json({ ok: true, skipped: 'no_message' });
  }

  const chatId = getChatId(message);
  if (!chatId) {
    return res.status(200).json({ ok: true, skipped: 'no_chat_id' });
  }

  if (!isAllowedChat(chatId)) {
    return res.status(200).json({ ok: true, skipped: 'chat_not_allowed' });
  }

  if (DIARY_COMMAND.test(String(message.text || '').trim())) {
    try {
      const diary = await sendDiaryButton(chatId, diaryUrl(req), { chatType: message.chat?.type });
      return res.status(200).json({ ok: true, diary });
    } catch (error) {
      console.error('AssetX Telegram diary button error:', error.message);
      return res.status(200).json({ ok: false, error: 'telegram_send_failed' });
    }
  }

  try {
    await sendTelegramMessage(chatId, await buildAssetxTelegramReply(message));
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('AssetX Telegram webhook error:', error.message);
    return res.status(200).json({ ok: false, error: 'telegram_send_failed' });
  }
}

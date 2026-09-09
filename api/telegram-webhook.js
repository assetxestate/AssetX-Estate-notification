import { buildAssetxTelegramReply } from './_assetxTelegramAssistant.js';

const TELEGRAM_API = 'https://api.telegram.org';

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

async function sendTelegramMessage(chatId, text) {
  const token = process.env.ASSETX_TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('ASSETX_TELEGRAM_BOT_TOKEN is not configured');

  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API ${response.status}: ${body}`);
  }
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

  try {
    await sendTelegramMessage(chatId, await buildAssetxTelegramReply(message));
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('AssetX Telegram webhook error:', error.message);
    return res.status(200).json({ ok: false, error: 'telegram_send_failed' });
  }
}

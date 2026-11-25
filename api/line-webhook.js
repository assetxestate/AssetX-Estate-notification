// LINE webhook → ส่งต่อไป Google Apps Script
// หมายเหตุ (S6): การตรวจ X-Line-Signature ต้องใช้ raw body ซึ่งชนกับวิธีที่ Vercel
// parse body ในโปรเจกต์นี้ จึงตรวจแบบ best-effort (log เตือน แต่ไม่บล็อก) กันบอทล่ม
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { verifySession } from './_auth.js';
import { handleAccountingLineEvents } from '../server/accounting-inbox.js';

async function collectAccountingFiles(body) {
  const events = Array.isArray(body?.events) ? body.events : [];
  // ไม่มีรูป/ไฟล์ และไม่มีคำขอดูรหัส = ไม่ต้องทำอะไร (ข้อความปกติของลูกค้าผ่านไปเร็วเท่าเดิม)
  const relevant = events.some((e) => ['image', 'file'].includes(e?.message?.type) || /^assetx-id$/i.test(String(e?.message?.text || '').trim()));
  if (!relevant) return;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const line = {
    async content(messageId) {
      const response = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
        headers: { Authorization: `Bearer ${lineToken}` },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`LINE content ${response.status}`);
      return { bytes: Buffer.from(await response.arrayBuffer()), mime: response.headers.get('content-type') || '' };
    },
  };
  const notify = async (text) => {
    const token = process.env.ASSETX_TELEGRAM_BOT_TOKEN;
    const chatId = String(process.env.ASSETX_TELEGRAM_ALLOWED_CHAT_ID || '').trim();
    if (!token || !chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000),
    });
  };
  await handleAccountingLineEvents({ events, db, line, notify });
}

const GAS_URL ='https://script.google.com/macros/s/AKfycbwSU57wl8hq-GvlU0MgHgk4Jb1oLL6EMRAFX8b5TPqLib2kfy3zGDh4f92-eeY0ul1gkA/exec';

export default async function handler(req, res) {
  if (req.query?.action === 'send' || req.query?.action === 'check') {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!verifySession(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบใหม่' });
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN' });
    const recipientId = String(req.body?.recipientId || '').trim();
    if (recipientId && !/^U[0-9a-f]{32}$/.test(recipientId)) {
      return res.status(400).json({ error: 'LINE User ID ไม่ถูกต้อง ต้องขึ้นต้นด้วย U ตามด้วย 32 ตัวอักษร' });
    }
    if (req.query.action === 'send' && !recipientId) {
      return res.status(400).json({ error: 'กรุณาระบุ LINE User ID ของผู้รับก่อนส่ง' });
    }
    const message = String(req.body?.message || '').trim();
    if (req.query.action === 'send' && (!message || Array.from(message).length > 5000)) {
      return res.status(400).json({ error: 'ข้อความต้องมีความยาว 1-5,000 ตัวอักษร' });
    }
    try {
      const url = req.query.action === 'send'
        ? 'https://api.line.me/v2/bot/message/push'
        : recipientId
          ? `https://api.line.me/v2/bot/profile/${recipientId}`
          : 'https://api.line.me/v2/bot/info';
      const response = await fetch(url, {
        method: req.query.action === 'send' ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(req.query.action === 'send' ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(req.query.action === 'send' ? { body: JSON.stringify({ to: recipientId, messages: [{ type: 'text', text: message }] }) } : {}),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const error = response.status === 401 || response.status === 403
          ? 'LINE ปฏิเสธ Channel Access Token กรุณาตรวจการตั้งค่า'
          : response.status === 404 && recipientId
            ? 'ไม่พบ LINE UID นี้ในช่องทางของบัญชีทางการ กรุณาตรวจ UID หรือให้ผู้รับเพิ่มเพื่อนใหม่'
            : `LINE API ตอบ HTTP ${response.status}`;
        return res.status(response.status >= 500 ? 502 : 400).json({ error });
      }
      return res.status(200).json({ accepted: true, requestId: response.headers.get('x-line-request-id') });
    } catch (error) {
      return res.status(502).json({ error: error.name === 'TimeoutError' ? 'LINE API ไม่ตอบภายในเวลาที่กำหนด' : 'เชื่อมต่อ LINE API ไม่สำเร็จ' });
    }
  }
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body;

  // best-effort signature check — log เตือนเฉย ๆ ไม่บล็อก
  try {
    const secret = process.env.LINE_CHANNEL_SECRET;
    const signature = req.headers['x-line-signature'];
    if (secret && signature) {
      const expected = crypto
        .createHmac('sha256', secret)
        .update(typeof body === 'string' ? body : JSON.stringify(body))
        .digest('base64');
      if (expected !== signature) {
        console.warn('LINE signature ไม่ตรง (ส่งต่อให้ GAS อยู่ดี)');
      }
    }
  } catch (e) {
    console.error('signature check error:', e.message);
  }

  // เอกสารบัญชีของเจ้าของ: รูป/ไฟล์จากบัญชี LINE ที่อยู่ใน ACCOUNTING_LINE_USER_ID เท่านั้น → กล่องเอกสารบัญชี
  // (รูปของลูกค้าไม่ถูกแตะ · ไม่ใช้ replyToken · ล้มก็ไม่กระทบการส่งต่อให้ GAS ด้านล่าง) — ดู server/accounting-inbox.js
  try {
    await collectAccountingFiles(body);
  } catch (e) {
    console.error('accounting inbox error:', e.message);
  }

  // ส่งต่อให้ GAS แล้วตอบ 200 กลับ LINE
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });
  } catch (e) {
    console.error('GAS forward error:', e.message);
  }

  return res.status(200).json({ ok: true });
}

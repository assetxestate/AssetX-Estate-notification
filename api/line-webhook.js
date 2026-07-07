// LINE webhook → ส่งต่อไป Google Apps Script
// หมายเหตุ (S6): การตรวจ X-Line-Signature ต้องใช้ raw body ซึ่งชนกับวิธีที่ Vercel
// parse body ในโปรเจกต์นี้ จึงตรวจแบบ best-effort (log เตือน แต่ไม่บล็อก) กันบอทล่ม
import crypto from 'crypto';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwSU57wl8hq-GvlU0MgHgk4Jb1oLL6EMRAFX8b5TPqLib2kfy3zGDh4f92-eeY0ul1gkA/exec';

export default async function handler(req, res) {
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

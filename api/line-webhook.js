import crypto from 'crypto';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwSU57wl8hq-GvlU0MgHgk4Jb1oLL6EMRAFX8b5TPqLib2kfy3zGDh4f92-eeY0ul1gkA/exec';

// ปิด body parser ของ Vercel เพื่ออ่าน raw body มาตรวจ signature
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await readRawBody(req);

  // ตรวจ X-Line-Signature (LINE เซ็นด้วย channel secret)
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    console.error('LINE_CHANNEL_SECRET not set');
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  const signature = req.headers['x-line-signature'];
  const expected = crypto.createHmac('SHA256', channelSecret).update(rawBody).digest('base64');

  if (!signature || !safeEqual(signature, expected)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // ส่งต่อ raw body เดิมให้ GAS แล้วตอบ 200 กลับ LINE
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody,
      redirect: 'follow',
    });
  } catch (e) {
    console.error('GAS forward error:', e.message);
  }

  return res.status(200).json({ ok: true });
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

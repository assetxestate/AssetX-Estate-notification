const GAS_URL = 'https://script.google.com/macros/s/AKfycbwSU57wl8hq-GvlU0MgHgk4Jb1oLL6EMRAFX8b5TPqLib2kfy3zGDh4f92-eeY0ul1gkA/exec';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ส่งต่อให้ GAS ก่อน แล้วค่อยตอบ 200 กลับ LINE
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      redirect: 'follow',
    });
  } catch (e) {
    console.error('GAS forward error:', e.message);
  }

  return res.status(200).json({ ok: true });
}

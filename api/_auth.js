// Helper ออก/ตรวจ session cookie แบบเซ็นด้วย HMAC (ไฟล์ขึ้นต้น _ ไม่ถูกมองเป็น route)
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const COOKIE_NAME = 'assetx_session';
const MAX_AGE = 60 * 60 * 12; // 12 ชั่วโมง

function secret() {
  return process.env.SESSION_SECRET || '';
}

export function createSessionCookie() {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = String(exp);
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('hex');
  const value = `${payload}.${sig}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${value}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
}

export function verifySession(req) {
  if (!secret()) return false;
  const cookie = req.headers.cookie || '';
  const match = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;
  const value = match.slice(COOKIE_NAME.length + 1);
  const [payload, sig] = value.split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Date.now() < Number(payload);
}

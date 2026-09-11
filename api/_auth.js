import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const COOKIE_NAME = 'assetx_session';
const MAX_AGE = 60 * 60 * 12; // 12 hours

function secret() {
  return process.env.SESSION_SECRET || '';
}

function sessionVersion() {
  return (
    process.env.SESSION_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    'local-auth-2026-09-11'
  );
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

export function createSessionCookie() {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = Buffer.from(JSON.stringify({ exp, v: sessionVersion() })).toString('base64url');
  const sig = sign(payload);
  const value = `${payload}.${sig}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${value}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function verifySession(req) {
  if (!secret()) return false;
  const cookie = req.headers.cookie || '';
  const match = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;

  const value = match.slice(COOKIE_NAME.length + 1);
  const [payload, sig] = value.split('.');
  if (!payload || !sig) return false;

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Date.now() < Number(data.exp) && data.v === sessionVersion();
  } catch {
    return false;
  }
}

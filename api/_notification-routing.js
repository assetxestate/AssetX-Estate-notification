const VALID_MODES = new Set(['review', 'direct']);

export function getNotificationMode(env = process.env) {
  const mode = String(env.LINE_NOTIFICATION_MODE || 'review').trim().toLowerCase();
  if (!VALID_MODES.has(mode)) {
    throw new Error('LINE_NOTIFICATION_MODE ต้องเป็น review หรือ direct');
  }
  return mode;
}

export function resolveAutomaticRecipient(customerLineUserId, env = process.env) {
  const mode = getNotificationMode(env);
  if (mode === 'direct') return String(customerLineUserId || '').trim();

  const reviewUserId = String(env.LINE_REVIEW_USER_ID || '').trim();
  if (!reviewUserId) {
    throw new Error('Review Mode ยังไม่ได้ตั้งค่า LINE_REVIEW_USER_ID');
  }
  return reviewUserId;
}

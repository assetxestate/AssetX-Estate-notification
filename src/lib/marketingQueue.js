export function canRecoverManualFacebookPost(post = {}) {
  return /facebook/i.test(String(post.channel || '')) &&
    post.status === 'posted' && !post.facebookPostId
}

// การ์ดในคิวที่อนุมัติแล้วแต่ยังไม่ได้ส่งออก → ย้ายกลับแท็บ ร่าง ให้แก้ (เจ้าของขอ 10 พ.ย. 2569 อยากเติมอีโมจิให้ #32 ก่อนโพสต์ใหม่)
// ส่งไป Facebook แล้ว (มีรหัสโพสต์) หรือโพสต์แล้ว ย้ายไม่ได้ — ต้องตรวจบน Facebook ก่อน
export function canReturnToEdit(post = {}) {
  return ['approved', 'scheduled'].includes(post.status) && !post.facebookPostId
}

export function returnToEditPatch(post) {
  if (!canReturnToEdit(post)) return null
  return { status: 'pending', reviewStatus: 'needs_edit', publishError: '' }
}

// เวลาโพสต์ที่ตั้งไว้ผ่านไปแล้ว หรือใกล้เกิน 10 นาที → Facebook ไม่รับตั้งเวลา เซิร์ฟเวอร์ปฏิเสธ และไม่มีโพสต์
// (10 พ.ย. 2569 #32: อนุมัติพร้อมเวลา 14:00 แล้วกดส่งตอน 14:04) → หน้าเว็บถามก่อนว่าจะโพสต์ทันทีไหม
// ตีความเวลาแบบเดียวกับเซิร์ฟเวอร์ (parseScheduledAt ใน server/marketing-facebook.js): ไม่มีโซนเวลา = เวลาไทย
export const FACEBOOK_MIN_SCHEDULE_MS = 10 * 60 * 1000

export function scheduledAtMs(value) {
  const raw = String(value || '').trim()
  if (!raw) return NaN
  let normalized = raw
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) normalized = `${raw}T09:00:00+07:00`
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw)) normalized = `${raw}+07:00`
  return new Date(normalized).getTime()
}

export function facebookScheduleTooSoon(post = {}, now = Date.now()) {
  if (post.status !== 'scheduled' || post.facebookPostId) return false
  const at = scheduledAtMs(post.scheduledAt)
  return Number.isFinite(at) && at < Number(now) + FACEBOOK_MIN_SCHEDULE_MS
}

// ส่งแบบโพสต์ทันที: ล้างเวลาที่ตั้งไว้ (ไม่แก้ object เดิม)
export function publishNowPost(post = {}) {
  return { ...post, status: 'approved', scheduledAt: '' }
}

export function recoverManualFacebookPost(post) {
  if (!canRecoverManualFacebookPost(post)) return null
  return {
    status: 'approved',
    postedAt: '',
    scheduledAt: '',
    facebookScheduledAt: '',
    publishError: '',
  }
}

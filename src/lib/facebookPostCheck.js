// ผลตรวจสถานะโพสต์จริงบน Facebook (server/marketing-facebook.js checkFacebookPost) → ข้อความไทย + ค่าที่บันทึกลงการ์ด
// เจ้าของถาม 10 พ.ย. 2569: #32 ตั้งเวลาไว้ 11:30 (ตอนแอป Meta ยังไม่เผยแพร่) แต่ไม่ขึ้นหน้าเพจเลย — ระบบเดิมรู้แค่ "ส่งให้ Facebook แล้ว"
// ปุ่ม "ส่งใหม่อีกครั้ง" เปิดเฉพาะเมื่อผลตรวจยืนยันว่าโพสต์ไม่ได้ขึ้นจริง (กันโพสต์ซ้ำ) · รหัสโพสต์เดิมเก็บไว้ใน facebookPreviousPostIds (ไม่ลบประวัติ)
// ไฟล์นี้ต้องไม่ import ของ node (หน้าเว็บ import ตรง)

export const RESENDABLE_STATES = ['stuck', 'photo_only', 'not_found']

const thaiTime = (iso) => {
  const t = new Date(iso || '')
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function facebookCheckSummary(check = {}, { now = new Date() } = {}) {
  const state = String(check.state || 'exists')
  const record = { state, checkedAt: now.toISOString(), ...(check.permalink ? { permalink: check.permalink } : {}) }
  const base = { facebookCheck: record, ...(check.permalink ? { facebookPermalink: check.permalink } : {}) }
  const when = thaiTime(check.scheduledAt)
  switch (state) {
    case 'published':
      return {
        tone: 'success',
        message: `Facebook เผยแพร่แล้ว${thaiTime(check.createdTime) ? ` (${thaiTime(check.createdTime)})` : ''} · ลองเปิดในหน้าต่างไม่ระบุตัวตนเพื่อดูว่าคนอื่นเห็น`,
        patch: { ...base, status: 'posted', postedAt: check.createdTime || now.toISOString(), publishError: '' },
      }
    case 'scheduled':
      return { tone: 'success', message: `Facebook ตั้งเวลาไว้แล้ว ยังไม่ถึงเวลาเผยแพร่${when ? ` (${when})` : ''}`, patch: base }
    case 'stuck':
      return {
        tone: 'warn',
        message: `เลยเวลาที่ตั้งไว้${when ? ` (${when})` : ''} แต่ Facebook ยังไม่เผยแพร่ · ลบโพสต์นี้ใน Meta Business Suite (เนื้อหา → ตั้งเวลาไว้) แล้วกด "ส่งใหม่อีกครั้ง"`,
        patch: base,
      }
    case 'hidden':
      return { tone: 'warn', message: 'โพสต์ถูกซ่อนจากหน้าเพจ · เปิดใน Meta Business Suite แล้วเลิกซ่อน', patch: base }
    case 'photo_only':
      return { tone: 'warn', message: 'Facebook มีรูปนี้ แต่ไม่มีโพสต์บนหน้าเพจ (ตั้งเวลาไม่สำเร็จ) · กด "ส่งใหม่อีกครั้ง" ได้', patch: base }
    case 'not_found':
      return { tone: 'warn', message: 'Facebook ไม่พบโพสต์นี้ (โพสต์ไม่สำเร็จ หรือถูกลบไปแล้ว) · กด "ส่งใหม่อีกครั้ง" ได้', patch: base }
    default:
      return { tone: 'warn', message: 'พบโพสต์บน Facebook แต่อ่านสถานะละเอียดไม่ได้ · เปิดดูที่หน้าเพจ', patch: base }
  }
}

export function canResendFacebookPost(post = {}) {
  return /facebook/i.test(String(post.channel || '')) && Boolean(post.facebookPostId) && RESENDABLE_STATES.includes(post.facebookCheck?.state)
}

// คืนการ์ดเข้าคิวเพื่อส่งใหม่ (สถานะอนุมัติ ไม่มีเวลา) · เก็บรหัสโพสต์เดิมไว้เป็นประวัติ
export function resendFacebookPatch(post = {}) {
  if (!canResendFacebookPost(post)) return null
  const previous = Array.isArray(post.facebookPreviousPostIds) ? post.facebookPreviousPostIds : []
  return {
    status: 'approved',
    scheduledAt: '',
    postedAt: '',
    facebookPostId: '',
    facebookMediaType: '',
    facebookScheduledAt: '',
    facebookPermalink: '',
    facebookCheck: null,
    publishError: '',
    facebookPreviousPostIds: [...previous, { id: post.facebookPostId, state: post.facebookCheck.state, checkedAt: post.facebookCheck.checkedAt || '' }],
  }
}

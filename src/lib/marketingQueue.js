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

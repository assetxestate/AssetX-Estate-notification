import assert from 'node:assert/strict'
import { canRecoverManualFacebookPost, canReturnToEdit, recoverManualFacebookPost, returnToEditPatch } from './marketingQueue.js'

const manual = { channel: 'facebook', status: 'posted', scheduledAt: '2026-10-05T17:00', postedAt: '2026-10-05' }
assert.equal(canRecoverManualFacebookPost(manual), true)
assert.deepEqual(recoverManualFacebookPost(manual), {
  status: 'approved', postedAt: '', scheduledAt: '', facebookScheduledAt: '', publishError: '',
})
assert.equal(manual.status, 'posted')
for (const post of [
  { ...manual, facebookPostId: '644192008782966_123' },
  { ...manual, status: 'scheduled', facebookPostId: '123' },
  { ...manual, status: 'approved' },
  { ...manual, channel: 'line-oa' },
  {},
]) {
  assert.equal(canRecoverManualFacebookPost(post), false)
  assert.equal(recoverManualFacebookPost(post), null)
}
// ย้ายการ์ดที่อนุมัติแล้วกลับไปแก้ (ยังไม่ได้ส่งออก)
for (const post of [{ status: 'approved' }, { status: 'scheduled', scheduledAt: '2026-11-11T09:00' }]) {
  assert.equal(canReturnToEdit(post), true)
  assert.deepEqual(returnToEditPatch(post), { status: 'pending', reviewStatus: 'needs_edit', publishError: '' })
}
for (const post of [{ status: 'scheduled', facebookPostId: '123' }, { status: 'posted' }, { status: 'pending' }, {}]) {
  assert.equal(canReturnToEdit(post), false)
  assert.equal(returnToEditPatch(post), null)
}
console.log('marketing queue recovery tests passed')

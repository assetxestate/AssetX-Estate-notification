import assert from 'node:assert/strict'
import { canRecoverManualFacebookPost, canReturnToEdit, facebookScheduleTooSoon, publishNowPost, recoverManualFacebookPost, returnToEditPatch, scheduledAtMs } from './marketingQueue.js'

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
// เวลาที่ตั้งไว้ผ่านไปแล้ว/ใกล้เกิน 10 นาที (เคส #32: เวลา 14:00 กดส่ง 14:04 เวลาไทย)
const at1404 = new Date('2026-11-10T14:04:00+07:00').getTime()
assert.equal(scheduledAtMs('2026-11-10T14:00'), new Date('2026-11-10T14:00:00+07:00').getTime())
assert.equal(scheduledAtMs('2026-11-11'), new Date('2026-11-11T09:00:00+07:00').getTime())
assert.ok(Number.isNaN(scheduledAtMs('')))
const late = { status: 'scheduled', scheduledAt: '2026-11-10T14:00', caption: 'x' }
assert.equal(facebookScheduleTooSoon(late, at1404), true)
assert.equal(facebookScheduleTooSoon({ ...late, scheduledAt: '2026-11-10T14:10' }, at1404), true)
assert.equal(facebookScheduleTooSoon({ ...late, scheduledAt: '2026-11-10T14:15' }, at1404), false)
assert.equal(facebookScheduleTooSoon(late, new Date(at1404)), true)
for (const post of [{ ...late, status: 'approved' }, { ...late, facebookPostId: '123' }, { ...late, scheduledAt: '' }, { ...late, scheduledAt: 'ไม่ใช่วันที่' }, {}]) {
  assert.equal(facebookScheduleTooSoon(post, at1404), false)
}
assert.deepEqual(publishNowPost(late), { status: 'approved', scheduledAt: '', caption: 'x' })
assert.equal(late.status, 'scheduled')
console.log('marketing queue recovery tests passed')

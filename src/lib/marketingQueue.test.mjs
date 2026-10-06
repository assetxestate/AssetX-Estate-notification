import assert from 'node:assert/strict'
import { canRecoverManualFacebookPost, recoverManualFacebookPost } from './marketingQueue.js'

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
console.log('marketing queue recovery tests passed')

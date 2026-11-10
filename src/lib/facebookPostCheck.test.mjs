import test from 'node:test'
import assert from 'node:assert/strict'
import { canResendFacebookPost, facebookCheckSummary, resendFacebookPatch } from './facebookPostCheck.js'

const now = new Date('2026-11-10T06:00:00Z')

test('เผยแพร่แล้ว → ย้ายการ์ดเป็นโพสต์แล้ว พร้อมลิงก์และเวลาจริง', () => {
  const s = facebookCheckSummary({ state: 'published', createdTime: '2026-11-10T04:30:05.000Z', permalink: 'https://www.facebook.com/page/posts/2' }, { now })
  assert.equal(s.tone, 'success')
  assert.equal(s.patch.status, 'posted')
  assert.equal(s.patch.postedAt, '2026-11-10T04:30:05.000Z')
  assert.equal(s.patch.facebookPermalink, 'https://www.facebook.com/page/posts/2')
  assert.match(s.message, /เผยแพร่แล้ว/)
})

test('ค้างเลยเวลา / ไม่พบ / มีแต่รูป → เตือนและเปิดปุ่มส่งใหม่ · ยังรอเวลาหรือซ่อน → ไม่เปิด', () => {
  for (const state of ['stuck', 'not_found', 'photo_only']) {
    const s = facebookCheckSummary({ state, scheduledAt: '2026-11-10T04:30:00.000Z' }, { now })
    assert.equal(s.tone, 'warn', state)
    assert.equal(s.patch.status, undefined, state)
    assert.equal(canResendFacebookPost({ channel: 'facebook', facebookPostId: '1', ...s.patch }), true, state)
  }
  assert.match(facebookCheckSummary({ state: 'stuck', scheduledAt: '2026-11-10T04:30:00.000Z' }, { now }).message, /Meta Business Suite/)
  for (const state of ['scheduled', 'hidden', 'published', 'exists']) {
    const s = facebookCheckSummary({ state }, { now })
    assert.equal(canResendFacebookPost({ channel: 'facebook', facebookPostId: '1', ...s.patch }), false, state)
  }
  assert.equal(canResendFacebookPost({ channel: 'facebook', facebookPostId: '1' }), false)
})

test('ส่งใหม่: คืนการ์ดไปแท็บร่างให้แก้และตรวจใหม่ ล้างรหัสและเวลา เก็บรหัสเดิมเป็นประวัติ', () => {
  const post = { channel: 'facebook', facebookPostId: '122208271406901474', status: 'scheduled', scheduledAt: '2026-11-10T11:30', facebookCheck: { state: 'stuck', checkedAt: now.toISOString() } }
  const patch = resendFacebookPatch(post)
  assert.equal(patch.status, 'pending')
  assert.equal(patch.reviewStatus, 'needs_edit')
  assert.equal(patch.facebookPostId, '')
  assert.equal(patch.scheduledAt, '')
  assert.equal(patch.facebookCheck, null)
  assert.deepEqual(patch.facebookPreviousPostIds, [{ id: '122208271406901474', state: 'stuck', checkedAt: now.toISOString() }])
  const again = resendFacebookPatch({ ...post, facebookPostId: '2', facebookPreviousPostIds: patch.facebookPreviousPostIds, facebookCheck: { state: 'not_found' } })
  assert.equal(again.facebookPreviousPostIds.length, 2)
  assert.equal(resendFacebookPatch({ ...post, facebookCheck: { state: 'published' } }), null)
})

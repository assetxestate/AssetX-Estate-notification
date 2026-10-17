import assert from 'node:assert/strict'
import test from 'node:test'
import { getMarketingQueueState, organizeMarketingQueue } from './marketingQueuePlan.js'

const now = new Date(2026, 9, 17, 10, 0)

test('classifies work by the local calendar day without claiming Facebook delivery', () => {
  assert.equal(getMarketingQueueState({ status: 'scheduled', scheduledAt: '2026-10-16T23:59' }, now), 'overdue')
  assert.equal(getMarketingQueueState({ status: 'scheduled', scheduledAt: '2026-10-17T20:00' }, now), 'today')
  assert.equal(getMarketingQueueState({ status: 'approved', scheduledAt: '2026-10-18T08:00' }, now), 'upcoming')
  assert.equal(getMarketingQueueState({ status: 'approved' }, now), 'unscheduled')
  assert.equal(getMarketingQueueState({ status: 'scheduled', channel: 'facebook', facebookPostId: 'fb-1', scheduledAt: '2026-10-16T10:00' }, now), 'platformScheduled')
  assert.equal(getMarketingQueueState({ status: 'scheduled', channel: 'line-oa', facebookPostId: 'fb-1', scheduledAt: '2026-10-16T10:00' }, now), 'overdue')
  assert.equal(getMarketingQueueState({ status: 'posted', facebookPostId: 'fb-2' }, now), 'posted')
})

test('keeps actionable work separate from scheduled and posted history', () => {
  const groups = organizeMarketingQueue([
    { id: 'future', status: 'scheduled', scheduledAt: '2026-10-18T10:00' },
    { id: 'posted', status: 'posted', postedAt: '2026-10-17T09:00' },
    { id: 'today', status: 'scheduled', scheduledAt: '2026-10-17T11:00' },
    { id: 'facebook', status: 'scheduled', channel: 'facebook', facebookPostId: 'fb-1', scheduledAt: '2026-10-17T12:00' },
    { id: 'overdue', status: 'scheduled', scheduledAt: '2026-10-16T10:00' },
    { id: 'unscheduled', status: 'approved' },
    { id: 'draft', status: 'draft' },
  ], now)
  assert.deepEqual(groups.action.map(({ post }) => post.id), ['overdue', 'today', 'unscheduled', 'future'])
  assert.deepEqual(groups.platformScheduled.map(({ post }) => post.id), ['facebook'])
  assert.deepEqual(groups.posted.map(({ post }) => post.id), ['posted'])
})

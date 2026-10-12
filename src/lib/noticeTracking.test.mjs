import test from 'node:test'
import assert from 'node:assert/strict'
import { validateNotice } from './noticeTracking.js'
const base = { status: 'sent', paymentStatus: 'unknown' }
test('sent can have unknown date and amount; never infers delivery', () => {
  const value = validateNotice(base)
  assert.equal(value.amount, null)
  assert.equal(value.sentDate, '')
  assert.equal(value.deliveredDate, '')
  assert.equal(value.status, 'sent')
})
test('delivery requires dated evidence and correct chronology', () => {
  assert.throws(() => validateNotice({ ...base, status: 'delivered' }))
  assert.throws(() => validateNotice({ ...base, status: 'delivered', sentDate: '2026-10-12', deliveredDate: '2026-10-11', deliveryEvidence: 'receipt' }))
  assert.throws(() => validateNotice({ ...base, deliveredDate: '2026-10-12' }))
})
test('dates must exist and costs must be nonnegative currency', () => {
  for (const sentDate of ['bad', '2026-02-30']) assert.throws(() => validateNotice({ ...base, sentDate }))
  for (const amount of [-1, Infinity, 'bad', 10.123]) assert.throws(() => validateNotice({ ...base, amount }))
  assert.equal(validateNotice({ ...base, amount: 0 }).amount, 0)
})
test('paid state requires actual payment details', () => {
  assert.throws(() => validateNotice({ ...base, paymentStatus: 'paid' }))
  assert.equal(validateNotice({ ...base, paymentStatus: 'paid', amount: '42.50', paidDate: '2026-10-12' }).amount, 42.5)
})

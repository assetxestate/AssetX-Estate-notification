import test from 'node:test'
import assert from 'node:assert/strict'
import { createNoticeHandler } from '../api/notices.js'
const response = () => ({ setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
test('unauthenticated calls cannot touch database', async () => {
  const res = response()
  await createNoticeHandler({ authorized: () => false, database: () => { throw Error('must not run') } })({ method: 'GET' }, res)
  assert.equal(res.code, 401)
})
test('missing server configuration does not claim saved', async () => {
  const res = response()
  await createNoticeHandler({ authorized: () => true, database: () => null })({ method: 'POST' }, res)
  assert.equal(res.code, 503)
})
test('optimistic update conflicts do not claim saved', async () => {
  const chain = { select() { return this }, eq() { return this }, update() { return this }, async maybeSingle() { return { data: null, error: null } } }
  const db = { from(name) { return name === 'customers' ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'test' } }) }) }) } : chain } }
  const res = response()
  await createNoticeHandler({ authorized: () => true, database: () => db })({ method: 'PATCH', url: '/api/notices', body: { customerId: 'test', id: '00000000-0000-4000-8000-000000000001', version: 1, payload: { status: 'sent', paymentStatus: 'unknown' } } }, res)
  assert.equal(res.code, 409)
})

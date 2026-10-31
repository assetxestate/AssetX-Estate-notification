import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPendingPatch, createDiaryHandler } from './diary.js'

const response = () => ({ setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })

const samplePending = () => ([
  { id: 'a', owner: 'you', text: 'งานของเจ้าของ', done: false },
  { id: 'b', owner: 'decide', text: 'เลือกทาง?', options: [{ id: 'x', label: 'ทาง x' }, { id: 'y', label: 'ทาง y' }], recommended: 'x', done: false },
])

test('unauthenticated calls cannot touch database', async () => {
  const res = response()
  await createDiaryHandler({ authorized: () => false, database: () => { throw Error('must not run') } })({ method: 'GET' }, res)
  assert.equal(res.code, 401)
})

test('missing server configuration returns 503, not success', async () => {
  const res = response()
  await createDiaryHandler({ authorized: () => true, database: () => null })({ method: 'GET' }, res)
  assert.equal(res.code, 503)
})

test('ticking done stamps done_at and leaves other items untouched', () => {
  const next = applyPendingPatch(samplePending(), 'a', { done: true }, '2026-10-31T10:00:00.000Z')
  assert.equal(next[0].done, true)
  assert.equal(next[0].done_at, '2026-10-31T10:00:00.000Z')
  assert.deepEqual(next[1], samplePending()[1])
  const back = applyPendingPatch(next, 'a', { done: false }, '2026-10-31T10:05:00.000Z')
  assert.equal(back[0].done, false)
  assert.equal(back[0].done_at, null)
})

test('choosing an option records the choice and resets acted so Claude acts on it', () => {
  const next = applyPendingPatch(samplePending(), 'b', { choice: 'y' }, '2026-10-31T10:00:00.000Z')
  assert.equal(next[1].choice, 'y')
  assert.equal(next[1].acted, false)
  assert.equal(next[1].choice_at, '2026-10-31T10:00:00.000Z')
  assert.throws(() => applyPendingPatch(samplePending(), 'b', { choice: 'z' }), /ไม่มีตัวเลือกนี้/)
  assert.throws(() => applyPendingPatch(samplePending(), 'b', { choice: 'other' }), /กรุณาพิมพ์ทางที่ต้องการ/)
  const other = applyPendingPatch(samplePending(), 'b', { choice: 'other', choice_note: ' ทำแบบที่สาม ' })
  assert.equal(other[1].choice_note, 'ทำแบบที่สาม')
})

test('patch cannot invent fields or touch unknown items', () => {
  assert.throws(() => applyPendingPatch(samplePending(), 'zz', { done: true }), /ไม่พบรายการค้าง/)
  assert.throws(() => applyPendingPatch(samplePending(), 'a', { text: 'แก้ข้อความ', acted: true }), /ไม่มีข้อมูลที่จะแก้/)
  const next = applyPendingPatch(samplePending(), 'a', { done: true, text: 'แก้ข้อความ' })
  assert.equal(next[0].text, 'งานของเจ้าของ')
})

test('empty or oversized commands are rejected before touching the table', async () => {
  const db = { from() { throw Error('must not run') } }
  const handler = createDiaryHandler({ authorized: () => true, database: () => db })
  const empty = response()
  await handler({ method: 'POST', body: { action: 'command', text: '   ' } }, empty)
  assert.equal(empty.code, 400)
  const long = response()
  await handler({ method: 'POST', body: { action: 'command', text: 'x'.repeat(2001) } }, long)
  assert.equal(long.code, 400)
})

test('stale version on a pending patch returns 409 with the current day', async () => {
  const row = { date: '2026-10-31', payload: { title: 't', pending: samplePending() }, version: 3 }
  const chain = {
    select() { return this }, eq() { return this }, update() { throw Error('must not update on stale version') },
    async maybeSingle() { return { data: row, error: null } },
  }
  const res = response()
  await createDiaryHandler({ authorized: () => true, database: () => ({ from: () => chain }) })(
    { method: 'POST', body: { action: 'pending', date: '2026-10-31', pid: 'a', version: 2, patch: { done: true } } }, res)
  assert.equal(res.code, 409)
  assert.equal(res.body.day.version, 3)
})

test('missing tables report setup needed instead of a generic failure', async () => {
  const chain = { select() { return this }, order() { return this }, limit() { return this }, then(resolve) { resolve({ data: null, error: { code: '42P01' } }) } }
  const res = response()
  await createDiaryHandler({ authorized: () => true, database: () => ({ from: () => chain }) })({ method: 'GET' }, res)
  assert.equal(res.code, 503)
  assert.match(res.body.error, /supabase_diary\.sql/)
})

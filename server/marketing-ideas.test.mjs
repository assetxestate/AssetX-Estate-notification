import test from 'node:test'
import assert from 'node:assert/strict'
import { createIdeasHandler, roundRobinBySubtype } from './marketing-ideas.js'

const response = () => ({ setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })

// ฐานข้อมูลปลอมแบบ chainable พอสำหรับ handler นี้
function fakeDb(rows = []) {
  const calls = []
  const make = (table) => {
    const state = { table, op: null, patch: null, filters: [] }
    const q = {
      select() { return q },
      eq(k, v) { state.filters.push(['eq', k, v]); return q },
      in(k, v) { state.filters.push(['in', k, v]); return q },
      order() { return q },
      limit() { return q },
      update(patch) { state.op = 'update'; state.patch = patch; return q },
      insert(row) { state.op = 'insert'; state.patch = row; return q },
      upsert(row) { state.op = 'upsert'; state.patch = row; return q },
      maybeSingle() { calls.push(state); const found = rows.find((r) => state.filters.every(([op, k, v]) => (op === 'eq' ? r[k] === v : v.includes(r[k])))); return Promise.resolve({ data: state.op ? (state.op === 'update' ? (found ? { id: found.id, status: state.patch.status } : null) : { id: 99, ...state.patch }) : found || null, error: null }) },
      then(resolve) { calls.push(state); resolve({ data: rows.filter((r) => state.filters.every(([op, k, v]) => (op === 'eq' ? r[k] === v : v.includes(r[k])))), error: null }) },
    }
    return q
  }
  return { from: (table) => make(table), calls }
}

test('ไม่ล็อกอิน = 401 ไม่แตะฐานข้อมูล · ไม่มี DB = 503', async () => {
  let res = response()
  await createIdeasHandler({ authorized: () => false, database: () => { throw Error('must not run') } })({ method: 'GET', url: '/api/marketing-ideas' }, res)
  assert.equal(res.code, 401)
  res = response()
  await createIdeasHandler({ authorized: () => true, database: () => null })({ method: 'GET', url: '/api/marketing-ideas' }, res)
  assert.equal(res.code, 503)
})

test('roundRobin: วนทีละ subtype ไม่ให้ท็อปเป็นประเภทเดียวกันหมด', () => {
  const rows = [
    { id: 1, subtype: 'rate', score: 9 }, { id: 2, subtype: 'rate', score: 8 }, { id: 3, subtype: 'rate', score: 7 }, { id: 4, subtype: 'rate', score: 6 },
    { id: 5, subtype: 'market', score: 5 }, { id: 6, subtype: 'market', score: 4 }, { id: 7, subtype: 'scam', score: 3 },
  ]
  const out = roundRobinBySubtype(rows, { perSubtype: 3, limit: 10 }).map((r) => r.id)
  assert.deepEqual(out, [1, 5, 7, 2, 6, 3])
  assert.deepEqual(roundRobinBySubtype(rows, { perSubtype: 3, limit: 2 }).map((r) => r.id), [1, 5])
  assert.deepEqual(roundRobinBySubtype([], {}), [])
})

test('GET คืนคิว new · สถานะแปลก = 400', async () => {
  const db = fakeDb([{ id: 1, status: 'new', subtype: 'rate', score: 5 }, { id: 2, status: 'new', subtype: 'market', score: 4 }, { id: 3, status: 'picked', subtype: 'rate', score: 9 }])
  let res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'GET', url: '/api/marketing-ideas?status=new' }, res)
  assert.equal(res.code, 200)
  assert.deepEqual(res.body.ideas.map((i) => i.id), [1, 2])
  res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'GET', url: '/api/marketing-ideas?status=x' }, res)
  assert.equal(res.code, 400)
})

test('pick/dismiss: ล้าง PII ในเหตุผล · ไอเดียที่ไม่มี = 404', async () => {
  const db = fakeDb([{ id: 7, status: 'new' }])
  let res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'POST', body: { action: 'dismiss', id: 7, reason: 'ซ้ำกับที่ทำไปแล้ว โทร 081-234-5678' } }, res)
  assert.equal(res.code, 200)
  const update = db.calls.find((c) => c.op === 'update')
  assert.equal(update.patch.status, 'dismissed')
  assert.match(update.patch.dismiss_reason, /\[ลบ\]/)
  res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'POST', body: { action: 'pick', id: 8, chosen_angle: 'เช็กลิสต์' } }, res)
  assert.equal(res.code, 404)
  res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'POST', body: { action: 'pick', id: 'abc' } }, res)
  assert.equal(res.code, 400)
})

test('manual: กุญแจจาก URL หรือหัวข้อ · ต้องมีอย่างน้อยหนึ่งอย่าง', async () => {
  const db = fakeDb([])
  let res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'POST', body: { action: 'manual', title: 'ทำคอนเทนต์เรื่องสินไถ่', url: 'https://example.com/x?utm_source=fb' } }, res)
  assert.equal(res.code, 200)
  const up = db.calls.find((c) => c.op === 'upsert')
  assert.equal(up.patch.external_key, 'manual:https://example.com/x')
  assert.equal(up.patch.source, 'manual')
  assert.equal(up.patch.score, 6)
  res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'POST', body: { action: 'manual' } }, res)
  assert.equal(res.code, 400)
})

test('lead: รับเฉพาะฟิลด์ที่ไม่ใช่ข้อมูลบุคคล และตรวจ enum', async () => {
  const db = fakeDb([])
  let res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'POST', body: { action: 'lead', channel: 'line', audience: 'A', service: 'ขายฝาก', amount_band: '1-3m', heard_from: 'โพสต์เช็กลิสต์ คุณ สมชาย', name: 'ห้ามเก็บ', phone: '0812345678' } }, res)
  assert.equal(res.code, 200)
  const ins = db.calls.find((c) => c.op === 'insert')
  assert.equal('name' in ins.patch, false)
  assert.equal('phone' in ins.patch, false)
  assert.match(ins.patch.heard_from, /\[ลบ\]/)
  res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'POST', body: { action: 'lead', channel: 'fax' } }, res)
  assert.equal(res.code, 400)
})

test('ตารางยังไม่สร้าง = 503 พร้อมบอกให้รัน SQL', async () => {
  const db = { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: { code: 'PGRST205', message: 'missing' } }) }) }) }) }) }) }
  const res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'GET', url: '/api/marketing-ideas' }, res)
  assert.equal(res.code, 503)
  assert.match(res.body.error, /supabase_marketing_ideas\.sql/)
})

// เทสต์คิว "คิดคอนเทนต์ใหม่ด้วย AI": API (server/marketing-content-jobs.js) + ฝั่งตัวรับงาน (server/content-jobs-worker.js) — ฐานข้อมูลปลอม ไม่เรียก AI
import test from 'node:test'
import assert from 'node:assert/strict'
import { createContentJobsHandler, contentWorkerStatus, MAX_ACTIVE_CONTENT_JOBS } from './marketing-content-jobs.js'
import { claimNextContentJob, processContentJob, releaseStaleContentJobs, isMissingTable } from './content-jobs-worker.js'

const NOW = Date.parse('2026-11-09T12:00:00Z')
const response = () => ({ setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })

// ฐานข้อมูลปลอมแบบ chainable: eq/in/gte/is/order/limit · head count · insert/update · error ต่อโต๊ะ (จำลองตารางยังไม่มี)
function fakeDb({ jobs = [], ideas = [], worker = null, missing = [] } = {}) {
  const tables = { marketing_content_jobs: jobs, marketing_ideas: ideas, marketing_image_worker: worker ? [worker] : [] }
  let nextId = 500
  const test = (row, [op, k, v]) => (op === 'eq' ? row[k] === v : op === 'in' ? v.includes(row[k]) : op === 'is' ? (row[k] ?? null) === v : Date.parse(row[k]) >= Date.parse(v))
  const make = (table) => {
    const s = { op: 'select', patch: null, filters: [], head: false, orders: [], limit: null }
    const run = () => {
      if (missing.includes(table)) return { data: null, error: { code: 'PGRST205', message: 'missing' } }
      const rows = tables[table]
      if (s.op === 'insert') { const row = { id: nextId++, created_at: new Date(NOW).toISOString(), applied_at: null, result: null, error: null, ...s.patch }; rows.push(row); return { data: row, error: null } }
      const hits = rows.filter((r) => s.filters.every((f) => test(r, f)))
      if (s.op === 'update') { hits.forEach((r) => Object.assign(r, s.patch)); return { data: hits, error: null } }
      if (s.head) return { data: null, count: hits.length, error: null }
      let data = hits
      for (const [k, asc] of s.orders.slice().reverse()) data = data.slice().sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (asc ? 1 : -1))
      if (s.limit !== null) data = data.slice(0, s.limit)
      return { data, error: null }
    }
    const q = {
      select(_c, opts = {}) { s.head = opts.head === true; return q },
      eq(k, v) { s.filters.push(['eq', k, v]); return q },
      in(k, v) { s.filters.push(['in', k, v]); return q },
      is(k, v) { s.filters.push(['is', k, v]); return q },
      gte(k, v) { s.filters.push(['gte', k, v]); return q },
      order(k, { ascending = true } = {}) { s.orders.push([k, ascending]); return q },
      limit(n) { s.limit = n; return q },
      insert(row) { s.op = 'insert'; s.patch = row; return q },
      update(patch) { s.op = 'update'; s.patch = patch; return q },
      maybeSingle() { const out = run(); return Promise.resolve({ data: Array.isArray(out.data) ? out.data[0] || null : out.data, error: out.error }) },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject) },
    }
    return q
  }
  return { tables, from: (table) => make(table) }
}

const handlerWith = (db) => createContentJobsHandler({ authorized: () => true, database: () => db, now: () => NOW })
const call = async (db, { method = 'POST', url = '/api/marketing-content-jobs', body } = {}) => {
  const res = response()
  await handlerWith(db)({ method, url, body }, res)
  return res
}
const onlineWorker = { id: 'office-pc', last_seen_at: new Date(NOW - 10 * 1000).toISOString(), info: { version: '2', content_jobs: true } }
const idea = (id, status = 'new') => ({ id, status, title: 'ขายฝากอย่างไรให้ลดความเสี่ยง', summary: 'x', source: 'manual', angles: [{ label: 'มุมเดิม', brief: 'b', draft: { caption: 'เดิม' } }] })

test('ไม่ล็อกอิน = 401 ไม่แตะฐานข้อมูล · ไม่มี DB = 503 · ตารางยังไม่มี = 503 พร้อมชื่อไฟล์ SQL', async () => {
  let res = response()
  await createContentJobsHandler({ authorized: () => false, database: () => { throw Error('must not run') } })({ method: 'GET', url: '/api/marketing-content-jobs' }, res)
  assert.equal(res.code, 401)
  res = response()
  await createContentJobsHandler({ authorized: () => true, database: () => null })({ method: 'GET', url: '/api/marketing-content-jobs' }, res)
  assert.equal(res.code, 503)
  res = await call(fakeDb({ ideas: [idea(33)], worker: onlineWorker, missing: ['marketing_content_jobs'] }), { body: { action: 'create', idea_id: 33 } })
  assert.equal(res.code, 503)
  assert.match(res.body.error, /supabase_marketing_content_jobs\.sql/)
})

test('create: ไอเดียต้องยังอยู่ (new/picked) · คำขอถูกลบข้อมูลบุคคล · ร่างเดิมคงคำว่า "คุณ" แต่เบอร์ถูกลบ · กดซ้ำ = งานเดิม · เกินเพดาน = 429', async () => {
  const db = fakeDb({ ideas: [idea(33), idea(34, 'dismissed'), idea(40, 'picked'), idea(41), idea(42), idea(43)], worker: onlineWorker })
  assert.equal((await call(db, { body: { action: 'create', idea_id: 'x' } })).code, 400)
  assert.equal((await call(db, { body: { action: 'create', idea_id: 99 } })).code, 404)
  assert.equal((await call(db, { body: { action: 'create', idea_id: 34 } })).code, 404, 'ทิ้งแล้วคิดใหม่ไม่ได้')
  assert.equal((await call(db, { body: { action: 'create', idea_id: 33, post_key: 'bad key!' } })).code, 400)

  let res = await call(db, { body: { action: 'create', idea_id: 33, note: 'สั้นลง โทร 081-234-5678' } })
  assert.equal(res.code, 200)
  assert.equal(res.body.reused, false)
  assert.equal(res.body.job.status, 'queued')
  assert.equal(res.body.job.post_key, null)
  assert.equal(res.body.worker.online, true)
  assert.equal(res.body.worker.content, true)
  const stored = db.tables.marketing_content_jobs[0]
  assert.match(stored.request.note, /^สั้นลง/)
  assert.doesNotMatch(stored.request.note, /081/)
  assert.deepEqual(stored.request.avoid, [], 'สั่งจากการ์ดไอเดีย = ไม่มีร่างให้เลี่ยง')

  res = await call(db, { body: { action: 'create', idea_id: 33 } })
  assert.equal(res.body.reused, true)
  assert.equal(db.tables.marketing_content_jobs.length, 1)

  res = await call(db, { body: { action: 'create', idea_id: 40, post_key: '1762600000000', content_no: 27, avoid_headline: 'ขายฝากลดความเสี่ยง', avoid_caption: 'ก่อนเซ็นขายฝากที่ดินของคุณ ต้องตรวจอะไร\r\n\r\n\r\nโทร 0812345678' } })
  assert.equal(res.code, 200)
  const fromDraft = db.tables.marketing_content_jobs.find((j) => j.idea_id === 40)
  assert.equal(fromDraft.post_key, '1762600000000')
  assert.equal(fromDraft.content_no, 27)
  assert.match(fromDraft.request.avoid[0].caption, /ที่ดินของคุณ ต้องตรวจอะไร\n\n/)
  assert.doesNotMatch(fromDraft.request.avoid[0].caption, /0812345678/)
  assert.equal(fromDraft.request.avoid[0].headline, 'ขายฝากลดความเสี่ยง')

  await call(db, { body: { action: 'create', idea_id: 41 } })
  assert.equal(db.tables.marketing_content_jobs.filter((j) => ['queued', 'running'].includes(j.status)).length, MAX_ACTIVE_CONTENT_JOBS)
  res = await call(db, { body: { action: 'create', idea_id: 42 } })
  assert.equal(res.code, 429)
})

test('apply: จองผลได้ครั้งเดียว (สองแท็บไม่สร้างร่างซ้ำ) · งานยังไม่เสร็จจองไม่ได้ · cancel ได้เฉพาะงานที่ยังไม่มีใครหยิบ', async () => {
  const db = fakeDb({
    worker: onlineWorker,
    jobs: [
      { id: 1, status: 'done', idea_id: 33, post_key: '1', applied_at: null, created_at: new Date(NOW - 60000).toISOString() },
      { id: 2, status: 'queued', idea_id: 34, post_key: null, applied_at: null, created_at: new Date(NOW).toISOString() },
      { id: 3, status: 'running', idea_id: 35, post_key: null, applied_at: null, created_at: new Date(NOW).toISOString() },
    ],
  })
  let res = await call(db, { body: { action: 'apply', id: 1 } })
  assert.equal(res.code, 200)
  assert.equal(res.body.job.applied_at, new Date(NOW).toISOString())
  assert.equal((await call(db, { body: { action: 'apply', id: 1 } })).code, 409)
  assert.equal((await call(db, { body: { action: 'apply', id: 2 } })).code, 409)
  res = await call(db, { body: { action: 'cancel', id: 2 } })
  assert.equal(res.body.job.status, 'cancelled')
  assert.equal((await call(db, { body: { action: 'cancel', id: 3 } })).code, 409)
  assert.equal((await call(db, { body: { action: 'nope' } })).code, 400)
})

test('GET: ?id · ?recent=1 เฉพาะ 24 ชม. · สถานะตัวรับงาน (ออนไลน์ · รุ่นที่รับงานคิดคอนเทนต์ได้)', async () => {
  const db = fakeDb({
    worker: onlineWorker,
    jobs: [
      { id: 7, status: 'done', idea_id: 33, created_at: new Date(NOW - 2 * 60 * 60 * 1000).toISOString() },
      { id: 8, status: 'failed', idea_id: 34, created_at: new Date(NOW - 30 * 60 * 60 * 1000).toISOString() },
    ],
  })
  let res = await call(db, { method: 'GET', url: '/api/marketing-content-jobs?id=7' })
  assert.equal(res.body.job.id, 7)
  assert.equal((await call(db, { method: 'GET', url: '/api/marketing-content-jobs?id=9' })).code, 404)
  res = await call(db, { method: 'GET', url: '/api/marketing-content-jobs?recent=1' })
  assert.deepEqual(res.body.jobs.map((j) => j.id), [7])
  res = await call(db, { method: 'GET', url: '/api/marketing-content-jobs' })
  assert.deepEqual(res.body, { worker: { online: true, content: true, last_seen_at: onlineWorker.last_seen_at } })
  assert.deepEqual(contentWorkerStatus({ last_seen_at: new Date(NOW - 5 * 60 * 1000).toISOString(), info: { version: '1' } }, NOW), { online: false, content: false, last_seen_at: new Date(NOW - 5 * 60 * 1000).toISOString() })
  assert.equal(contentWorkerStatus(null, NOW).online, false)
})

test('ตัวรับงาน: หยิบงานเก่าสุดก่อน · มุมใหม่ไปช่องแรกของไอเดีย (มุมเดิมอยู่ครบ) · งาน done พร้อมมุมในผล', async () => {
  const db = fakeDb({
    ideas: [idea(33, 'picked')],
    jobs: [
      { id: 2, status: 'queued', idea_id: 33, post_key: '1', content_no: 27, request: { note: 'สั้นลง', avoid: [{ caption: 'ร่างเดิม' }] }, created_at: '2026-11-09T11:00:00Z' },
      { id: 3, status: 'queued', idea_id: 33, request: {}, created_at: '2026-11-09T11:30:00Z' },
    ],
  })
  const job = await claimNextContentJob(db, 'office-pc')
  assert.equal(job.id, 2)
  assert.equal(db.tables.marketing_content_jobs[0].status, 'running')
  assert.equal(db.tables.marketing_content_jobs[0].worker, 'office-pc')
  let seen = null
  const angle = { label: 'มุมใหม่', brief: 'เล่าใหม่', draft: { caption: 'ร่างใหม่ทั้งชิ้น', headline: 'ใหม่' }, fresh: { at: '2026-11-09T12:00:00.000Z' } }
  const out = await processContentJob(db, job, { generate: async (input) => { seen = input; return { ok: true, angle, provider: 'codex' } }, now: () => new Date(NOW) })
  assert.equal(out.ok, true)
  assert.equal(seen.idea.id, 33)
  assert.equal(seen.note, 'สั้นลง')
  assert.deepEqual(seen.avoid, [{ caption: 'ร่างเดิม' }])
  assert.deepEqual(db.tables.marketing_ideas[0].angles.map((a) => a.label), ['มุมใหม่', 'มุมเดิม'])
  const done = db.tables.marketing_content_jobs[0]
  assert.equal(done.status, 'done')
  assert.deepEqual(done.result, { angle_index: 0, angle, provider: 'codex' })
})

test('ตัวรับงาน: ไอเดียถูกทิ้ง/AI ล้ม = งาน failed พร้อมเหตุผล (ไม่แตะไอเดีย) · งานค้างของตัวเองถูกปิด · ตารางยังไม่มีรู้ได้', async () => {
  const db = fakeDb({
    ideas: [idea(33, 'dismissed'), idea(34)],
    jobs: [
      { id: 1, status: 'running', idea_id: 33, worker: 'office-pc' },
      { id: 2, status: 'running', idea_id: 33, worker: 'other-pc' },
    ],
  })
  assert.equal(await releaseStaleContentJobs(db, 'office-pc'), 1)
  assert.equal(db.tables.marketing_content_jobs[0].status, 'failed')
  assert.equal(db.tables.marketing_content_jobs[1].status, 'running')

  let out = await processContentJob(db, { id: 1, idea_id: 33, request: {} }, { generate: async () => { throw new Error('must not run') } })
  assert.equal(out.ok, false)
  assert.match(db.tables.marketing_content_jobs[0].error, /ถูกทิ้งหรือหมดอายุ/)

  db.tables.marketing_content_jobs.push({ id: 5, status: 'running', idea_id: 34 })
  out = await processContentJob(db, { id: 5, idea_id: 34, request: null }, { generate: async () => ({ ok: false, error: 'AI เขียนร่างไม่ผ่านด่านตรวจ โทร 0812345678' }) })
  assert.equal(out.ok, false)
  const failed = db.tables.marketing_content_jobs.find((j) => j.id === 5)
  assert.equal(failed.status, 'failed')
  assert.match(failed.error, /ไม่ผ่านด่านตรวจ/)
  assert.doesNotMatch(failed.error, /0812345678/)
  assert.deepEqual(db.tables.marketing_ideas[1].angles.map((a) => a.label), ['มุมเดิม'], 'ล้ม = ไอเดียไม่เปลี่ยน')

  assert.equal(isMissingTable({ code: 'PGRST205' }), true)
  assert.equal(isMissingTable({ code: '42P01' }), true)
  assert.equal(isMissingTable({ code: '23505' }), false)
})

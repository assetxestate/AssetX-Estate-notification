import test from 'node:test'
import assert from 'node:assert/strict'
import { createIdeasHandler, roundRobinBySubtype } from './marketing-ideas.js'

const response = () => ({ setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })

// ฐานข้อมูลปลอมแบบ chainable พอสำหรับ handler นี้
// · order/limit ทำงานจริง (เรียงหลายคีย์แบบ stable) · gte เทียบเป็นเวลา (handler ใช้กับ created_at เท่านั้น)
// · select(..., { count: 'exact', head: true }) คืน { count } · count:false จำลอง driver ที่ไม่คืน count · headError จำลองคำสั่งนับพัง
function fakeDb(rows = [], { count = true, headError = null } = {}) {
  const calls = []
  const matches = (r, filters) => filters.every(([op, k, v]) => (op === 'eq' ? r[k] === v : op === 'gte' ? Date.parse(r[k]) >= Date.parse(v) : v.includes(r[k])))
  const make = (table) => {
    const state = { table, op: null, patch: null, filters: [], columns: null, head: false, count: null, orders: [], limit: null }
    const q = {
      select(columns, opts = {}) { state.columns = columns; state.head = opts.head === true; state.count = opts.count || null; return q },
      eq(k, v) { state.filters.push(['eq', k, v]); return q },
      in(k, v) { state.filters.push(['in', k, v]); return q },
      gte(k, v) { state.filters.push(['gte', k, v]); return q },
      order(k, { ascending = true } = {}) { state.orders.push([k, ascending]); return q },
      limit(n) { state.limit = n; return q },
      update(patch) { state.op = 'update'; state.patch = patch; return q },
      insert(row) { state.op = 'insert'; state.patch = row; return q },
      upsert(row) { state.op = 'upsert'; state.patch = row; return q },
      maybeSingle() { calls.push(state); const found = rows.find((r) => matches(r, state.filters)); return Promise.resolve({ data: state.op ? (state.op === 'update' ? (found ? { id: found.id, status: state.patch.status } : null) : { id: 99, ...state.patch }) : found || null, error: null }) },
      then(resolve) {
        calls.push(state)
        const hits = rows.filter((r) => matches(r, state.filters))
        if (state.head) return resolve(headError ? { data: null, count: null, error: headError } : { data: null, count: count ? hits.length : null, error: null })
        let data = hits
        for (const [k, ascending] of state.orders.slice().reverse()) data = data.slice().sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (ascending ? 1 : -1))
        if (state.limit !== null) data = data.slice(0, state.limit)
        resolve({ data, error: null })
      },
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
  assert.equal(res.body.total, 2)
  res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'GET', url: '/api/marketing-ideas?status=x' }, res)
  assert.equal(res.code, 400)
})

test('GET ?channel= (ชิปช่องทาง 12 พ.ย. 2569): ทุกใบของช่องทางนั้นเรียงคะแนน ไม่ติดเพดานต่อประเภท · นับต่อช่องทางใน meta · ช่องทางแปลก = 400', async () => {
  // เพจ Facebook 12 ใบประเภทเดียว (แบบคิวจริง) — คิวปกติติดเพดาน per_subtype 10 · กดชิป Facebook ต้องได้ครบ 12
  const fb = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, status: 'new', source: 'social', subtype: 'social_fb', url: `https://www.facebook.com/p/${i}`, score: 20 - i }))
  const rows = [...fb,
    { id: 50, status: 'new', source: 'social', subtype: 'ad_library', url: 'https://www.facebook.com/ads/library/?id=1', score: 6 },
    { id: 51, status: 'new', source: 'news', subtype: 'valuation', url: 'https://news.google.com/rss/articles/a', score: 5 },
    { id: 52, status: 'new', source: 'youtube', subtype: 'competitor', url: 'https://www.youtube.com/watch?v=a', score: 4 },
  ]
  const db = fakeDb(rows)
  let res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'GET', url: '/api/marketing-ideas?status=new&per_subtype=10&limit=60' }, res)
  assert.equal(res.body.ideas.filter((i) => i.subtype === 'social_fb').length, 10, 'คิวปกติยังติดเพดาน 10 ต่อประเภท')
  assert.deepEqual(res.body.meta.by_channel, { facebook: 12, meta_ads: 1, news: 1, youtube: 1 })
  assert.equal(res.body.channel, undefined)
  res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'GET', url: '/api/marketing-ideas?status=new&channel=facebook' }, res)
  assert.equal(res.code, 200)
  assert.equal(res.body.channel, 'facebook')
  assert.deepEqual(res.body.ideas.map((i) => i.id), fb.map((r) => r.id), 'ครบ 12 ใบ เรียงคะแนน · ไม่ปนแอดคู่แข่ง')
  assert.equal(res.body.total, 15)
  res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'GET', url: '/api/marketing-ideas?status=new&channel=meta_ads' }, res)
  assert.deepEqual(res.body.ideas.map((i) => i.id), [50])
  res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'GET', url: '/api/marketing-ideas?status=new&channel=myspace' }, res)
  assert.equal(res.code, 400)
})

test('pick/dismiss: ล้าง PII ในเหตุผล · ไอเดียที่ไม่มี = 404', async () => {
  const db = fakeDb([{ id: 7, status: 'new' }])
  let res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'POST', body: { action: 'dismiss', id: 7, reason: 'ซ้ำกับที่ทำไปแล้ว โทร 081-234-5678' } }, res)
  assert.equal(res.code, 200)
  const update = db.calls.find((c) => c.op === 'update')
  assert.equal(update.patch.status, 'dismissed')
  // คำสั่งเสริมของ meta (นับหัวตาราง · แถวล่าสุด) วิ่งเฉพาะ GET — POST ต้องไม่แตะ
  assert.equal(db.calls.some((c) => c.head || c.columns === 'created_at'), false)
  assert.match(update.patch.dismiss_reason, /\[ลบ\]/)
  res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'POST', body: { action: 'pick', id: 8, chosen_angle: 'เช็กลิสต์' } }, res)
  assert.equal(res.code, 404)
  res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'POST', body: { action: 'pick', id: 'abc' } }, res)
  assert.equal(res.code, 400)
})

test('unpick: ย้อนร่างกลับเป็นไอเดีย → new · คง chosen_angle (ไม่มี = มุมหลัก) · ทิ้งแล้ว = 404', async () => {
  const db = fakeDb([
    { id: 4, status: 'picked', chosen_angle: 'เช็กลิสต์', title: 'ไอเดียสี่' },
    { id: 5, status: 'picked', chosen_angle: null, title: 'ไอเดียห้า' },
    { id: 6, status: 'dismissed', chosen_angle: null, title: 'ไอเดียหก' },
  ])
  const run = async (body) => {
    const res = response()
    await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'POST', body }, res)
    return res
  }
  let res = await run({ action: 'unpick', id: 4 })
  assert.equal(res.code, 200)
  let update = db.calls.filter((c) => c.op === 'update').at(-1)
  assert.deepEqual(update.patch, { status: 'new' })
  // อัปเดตเฉพาะไอเดียที่ยังเลือกอยู่/ยังใหม่ — ไม่ดึงไอเดียที่ทิ้ง/หมดอายุกลับ · คืนคอลัมน์ของการ์ดเต็ม
  assert.deepEqual(update.filters.find(([op]) => op === 'in'), ['in', 'status', ['picked', 'new']])
  assert.match(update.columns, /angles/)
  res = await run({ action: 'unpick', id: 5 })
  assert.equal(res.code, 200)
  update = db.calls.filter((c) => c.op === 'update').at(-1)
  assert.deepEqual(update.patch, { status: 'new', chosen_angle: 'มุมหลัก' })
  const updates = db.calls.filter((c) => c.op === 'update').length
  res = await run({ action: 'unpick', id: 6 })
  assert.equal(res.code, 404)
  res = await run({ action: 'unpick', id: 99 })
  assert.equal(res.code, 404)
  res = await run({ action: 'unpick', id: 'x' })
  assert.equal(res.code, 400)
  assert.equal(db.calls.filter((c) => c.op === 'update').length, updates)
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

// เวลาคงที่เทียบกับตอนรันเทสต์ ให้หน้าต่าง 24 ชม. ตัดสินได้แน่ (ไม่ตั้งแถวไว้ตรงขอบ 24 ชม. พอดี)
const hoursAgo = (now, h) => new Date(now - h * 3600e3).toISOString()

test('GET meta: สถานะรอบรีเสิร์ชจากข้อมูลจริง · ideas/total เดิมไม่เปลี่ยน', async () => {
  const now = Date.now()
  const db = fakeDb([
    { id: 1, status: 'new', source: 'news', subtype: 'rate', score: 7, angles: [{ label: 'เช็กลิสต์', brief: 'x' }], created_at: hoursAgo(now, 1) },
    { id: 2, status: 'new', source: 'news', subtype: 'market', score: 5, angles: [], created_at: hoursAgo(now, 30) },
    { id: 3, status: 'new', source: 'official', subtype: 'rate', score: 4, angles: null, created_at: hoursAgo(now, 50) },
    // สถานะอื่น: นับใน latest_created_at และ arrived_last_24h (ทุกสถานะ) แต่ไม่นับใน with_angles / by_source (เฉพาะสถานะที่ขอ)
    { id: 4, status: 'picked', source: 'manual', subtype: 'market', score: 9, angles: [{ label: 'มุม' }], created_at: hoursAgo(now, 2) },
    { id: 5, status: 'dismissed', source: 'social', subtype: 'scam', score: 3, angles: null, created_at: hoursAgo(now, 0.5) },
  ])
  const res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'GET', url: '/api/marketing-ideas?status=new' }, res)
  assert.equal(res.code, 200)
  assert.deepEqual(res.body.ideas.map((i) => i.id), [1, 2, 3])
  assert.equal(res.body.total, 3)
  const { meta } = res.body
  assert.deepEqual(Object.keys(meta).sort(), ['arrived_last_24h', 'by_channel', 'by_source', 'degraded', 'fetched_at', 'latest_created_at', 'status', 'total', 'with_angles'])
  assert.deepEqual(meta.by_channel, { news: 2, official: 1 })
  assert.equal(meta.degraded, false)
  assert.equal(meta.status, 'new')
  assert.equal(meta.total, res.body.total)
  assert.equal(meta.latest_created_at, hoursAgo(now, 0.5)) // แถวใหม่สุดคือ dismissed id 5 — มองทุกสถานะ
  assert.equal(meta.arrived_last_24h, 3) // id 1 (1 ชม.) · id 4 (2 ชม.) · id 5 (0.5 ชม.) — id 2 อายุ 30 ชม. ไม่นับ
  assert.equal(meta.with_angles, 1) // id 1 เท่านั้น: [] และ null ไม่นับ · id 4 คนละสถานะ
  assert.deepEqual(meta.by_source, { news: 2, official: 1 })
  assert.ok(Math.abs(Date.parse(meta.fetched_at) - now) < 60e3)
  // รูปร่างคำสั่งเสริม 2 ตัวตามสเปก: นับหัวตารางด้วย gte created_at · แถวล่าสุดด้วย order created_at desc limit 1
  const head = db.calls.find((c) => c.head)
  assert.equal(head.count, 'exact')
  assert.deepEqual(head.filters.map(([op, k]) => [op, k]), [['gte', 'created_at']])
  const latest = db.calls.find((c) => c.columns === 'created_at')
  assert.deepEqual(latest.orders, [['created_at', false]])
  assert.equal(latest.limit, 1)
})

test('GET meta: driver ไม่คืน count → ทางสำรองนับจากแถวของสถานะนี้ที่ดึงมา', async () => {
  const now = Date.now()
  const rows = [
    { id: 1, status: 'new', source: 'news', score: 7, created_at: hoursAgo(now, 1) },
    { id: 2, status: 'new', source: 'news', score: 5, created_at: hoursAgo(now, 30) },
    { id: 4, status: 'picked', source: 'manual', score: 9, created_at: hoursAgo(now, 2) },
  ]
  let res = response()
  await createIdeasHandler({ authorized: () => true, database: () => fakeDb(rows, { count: false }) })({ method: 'GET', url: '/api/marketing-ideas?status=new' }, res)
  assert.equal(res.code, 200)
  assert.equal(res.body.meta.arrived_last_24h, 1) // ทางสำรองเห็นแค่ new: id 1 (id 4 เป็น picked · id 2 เกิน 24 ชม.)
  res = response()
  await createIdeasHandler({ authorized: () => true, database: () => fakeDb(rows) })({ method: 'GET', url: '/api/marketing-ideas?status=new' }, res)
  assert.equal(res.body.meta.arrived_last_24h, 2) // count จริงนับทุกสถานะ: id 1 + id 4
})

test('GET meta: ตารางว่าง → latest_created_at null · ตัวนับ 0 · by_source ว่าง', async () => {
  const res = response()
  await createIdeasHandler({ authorized: () => true, database: () => fakeDb([]) })({ method: 'GET', url: '/api/marketing-ideas' }, res)
  assert.equal(res.code, 200)
  assert.deepEqual(res.body.ideas, [])
  assert.equal(res.body.total, 0)
  const { meta } = res.body
  assert.equal(meta.status, 'new')
  assert.equal(meta.total, 0)
  assert.equal(meta.latest_created_at, null)
  assert.equal(meta.arrived_last_24h, 0)
  assert.equal(meta.with_angles, 0)
  assert.deepEqual(meta.by_source, {})
  assert.match(meta.fetched_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
})

test('GET meta: คำสั่งเสริมพัง → คิวยังมาครบ meta ใช้ค่าสำรองและติดธง degraded (ไม่ทำให้ทั้ง GET ล้ม)', async () => {
  const createdAt = new Date().toISOString()
  const db = fakeDb([{ id: 1, status: 'new', source: 'news', score: 5, created_at: createdAt }], { headError: { code: '42P01', message: 'relation missing' } })
  const res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'GET', url: '/api/marketing-ideas' }, res)
  assert.equal(res.code, 200)
  assert.deepEqual(res.body.ideas.map((i) => i.id), [1])
  assert.equal(res.body.meta.degraded, true)
  assert.equal(res.body.meta.arrived_last_24h, 1) // ทางสำรองนับจากแถวของสถานะนี้
  assert.equal(res.body.meta.latest_created_at, new Date(createdAt).toISOString())
  assert.doesNotMatch(JSON.stringify(res.body), /relation missing/)
})

test('GET: คำสั่งหลักพัง (ตารางหาย) ยังเป็น 503 เหมือนเดิม', async () => {
  const db = {
    from: () => {
      const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, then: (resolve) => resolve({ data: null, error: { code: '42P01', message: 'relation missing' } }) }
      return q
    },
  }
  const res = response()
  await createIdeasHandler({ authorized: () => true, database: () => db })({ method: 'GET', url: '/api/marketing-ideas' }, res)
  assert.equal(res.code, 503)
  assert.match(res.body.error, /supabase_marketing_ideas\.sql/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { createImageJobsHandler, buildPosterJobPrompt, workerStatus, MAX_ACTIVE_JOBS, WORKER_ONLINE_MS } from './marketing-image-jobs.js'
import { POSTER_SIZES, cropPlan, defaultPosterSizeFor } from '../src/lib/posterSizes.js'
import { chatJobMessage, formatElapsed, postKeyFor } from '../src/lib/chatgptImageJob.js'

const NOW = Date.parse('2026-11-06T03:00:00Z')
const response = () => ({ setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })

// ฐานข้อมูลปลอมแบบ chainable พอสำหรับ handler นี้ (eq/in/gte/order/limit · head count · insert/update · storage.download)
function fakeDb({ jobs = [], worker = null, files = {} } = {}) {
  const tables = { marketing_image_jobs: jobs, marketing_image_worker: worker ? [worker] : [] }
  let nextId = 100
  const matches = (row, filters) => filters.every(([op, k, v]) => (op === 'eq' ? row[k] === v : op === 'in' ? v.includes(row[k]) : Date.parse(row[k]) >= Date.parse(v)))
  const make = (table) => {
    const s = { op: 'select', patch: null, filters: [], head: false, orders: [], limit: null }
    const run = () => {
      const rows = tables[table]
      if (s.op === 'insert') { const row = { id: nextId++, created_at: new Date(NOW).toISOString(), ...s.patch }; rows.push(row); return { data: row, error: null } }
      const hits = rows.filter((r) => matches(r, s.filters))
      if (s.op === 'update') { hits.forEach((r) => Object.assign(r, s.patch)); return { data: hits, error: null } }
      if (s.head) return { data: null, count: hits.length, error: null }
      let data = hits
      for (const [k, asc] of s.orders.slice().reverse()) data = data.slice().sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (asc ? 1 : -1))
      if (s.limit !== null) data = data.slice(0, s.limit)
      return { data, error: null }
    }
    const q = {
      select(_columns, opts = {}) { s.head = opts.head === true; return q },
      eq(k, v) { s.filters.push(['eq', k, v]); return q },
      in(k, v) { s.filters.push(['in', k, v]); return q },
      gte(k, v) { s.filters.push(['gte', k, v]); return q },
      order(k, { ascending = true } = {}) { s.orders.push([k, ascending]); return q },
      limit(n) { s.limit = n; return q },
      insert(row) { s.op = 'insert'; s.patch = row; return q },
      update(patch) { s.op = 'update'; s.patch = patch; return q },
      maybeSingle() { const out = run(); return Promise.resolve({ data: Array.isArray(out.data) ? out.data[0] || null : out.data, error: null }) },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject) },
    }
    return q
  }
  return {
    tables,
    from: (table) => make(table),
    storage: { from: () => ({ download: async (p) => (files[p] ? { data: new Blob([files[p]]), error: null } : { data: null, error: new Error('not found') }) }) },
  }
}

const handlerWith = (db, authorized = () => true) => createImageJobsHandler({ authorized, database: () => db, now: () => NOW })
const onlineWorker = { id: 'office-pc', last_seen_at: new Date(NOW - 10 * 1000).toISOString() }

test('ไม่ล็อกอิน = 401 ไม่แตะฐานข้อมูล · ไม่มี DB = 503', async () => {
  let res = response()
  await createImageJobsHandler({ authorized: () => false, database: () => { throw Error('must not run') } })({ method: 'GET', url: '/api/marketing-image-jobs' }, res)
  assert.equal(res.code, 401)
  res = response()
  await createImageJobsHandler({ authorized: () => true, database: () => null })({ method: 'GET', url: '/api/marketing-image-jobs' }, res)
  assert.equal(res.code, 503)
})

test('สร้างงาน: เก็บขนาดแพลตฟอร์ม + สัดส่วนที่สั่ง ChatGPT · ลบเบอร์โทรออกจาก prompt', async () => {
  const db = fakeDb({ worker: onlineWorker })
  const res = response()
  await handlerWith(db)({ method: 'POST', body: {
    action: 'create', post_key: 'no-6', content_no: 6, title: 'จำนอง ตรวจเงื่อนไขให้ครบ',
    caption: 'ก่อนจำนอง ควรตรวจเอกสารสิทธิ์\nโทร 081-234-5678 สอบถาม', size: 'story-9x16',
  } }, res)
  assert.equal(res.code, 200)
  assert.equal(res.body.reused, false)
  assert.equal(res.body.worker.online, true)
  const row = db.tables.marketing_image_jobs[0]
  assert.equal(row.status, 'queued')
  assert.equal(row.size, 'story-9x16')
  assert.equal(row.aspect, 'portrait')
  assert.equal(row.content_no, 6)
  assert.match(row.prompt, /จำนอง ตรวจเงื่อนไขให้ครบ/)
  assert.match(row.prompt, /center-cropped to 1080:1920/)
  assert.doesNotMatch(row.prompt, /081-234-5678/)
})

test('สร้างงาน: ขนาดที่ไม่รู้จัก = ฟีด 4:5 · ไม่มีหัวข้อและเนื้อหา = 400 · รหัสโพสต์แปลก = 400', async () => {
  const db = fakeDb()
  let res = response()
  await handlerWith(db)({ method: 'POST', body: { action: 'create', post_key: 'no-1', title: 'หัวข้อ', size: 'billboard' } }, res)
  assert.equal(res.code, 200)
  assert.equal(db.tables.marketing_image_jobs[0].size, 'feed-4x5')
  res = response()
  await handlerWith(db)({ method: 'POST', body: { action: 'create', post_key: 'no-2', title: '  ', caption: '' } }, res)
  assert.equal(res.code, 400)
  res = response()
  await handlerWith(db)({ method: 'POST', body: { action: 'create', post_key: '../../x y', title: 'หัวข้อ' } }, res)
  assert.equal(res.code, 400)
})

test('กดซ้ำขณะงานเดิมยังไม่เสร็จ = ใช้งานเดิม · งานค้างครบเพดาน = 429', async () => {
  const db = fakeDb({ jobs: [{ id: 1, status: 'running', post_key: 'no-6', created_at: '2026-11-06T02:59:00Z' }] })
  let res = response()
  await handlerWith(db)({ method: 'POST', body: { action: 'create', post_key: 'no-6', title: 'หัวข้อ' } }, res)
  assert.equal(res.code, 200)
  assert.equal(res.body.reused, true)
  assert.equal(res.body.job.id, 1)
  assert.equal(db.tables.marketing_image_jobs.length, 1)

  const busy = fakeDb({ jobs: Array.from({ length: MAX_ACTIVE_JOBS }, (_, i) => ({ id: i + 1, status: 'queued', post_key: `no-${i + 10}`, created_at: '2026-11-06T02:59:00Z' })) })
  res = response()
  await handlerWith(busy)({ method: 'POST', body: { action: 'create', post_key: 'no-6', title: 'หัวข้อ' } }, res)
  assert.equal(res.code, 429)
})

test('ถามสถานะ: ส่งภาพเป็น data URL เมื่อเสร็จและขอ image=1 · งานล่าสุดของโพสต์ใน 24 ชม.', async () => {
  const db = fakeDb({
    worker: onlineWorker,
    jobs: [
      { id: 7, status: 'done', post_key: 'no-6', image_path: 'jobs/7.jpg', created_at: '2026-11-06T02:58:00Z' },
      { id: 3, status: 'done', post_key: 'no-6', image_path: 'jobs/3.jpg', created_at: '2026-11-04T01:00:00Z' },
    ],
    files: { 'jobs/7.jpg': 'jpg-bytes' },
  })
  let res = response()
  await handlerWith(db)({ method: 'GET', url: '/api/marketing-image-jobs?id=7&image=1' }, res)
  assert.equal(res.code, 200)
  assert.equal(res.body.image, `data:image/jpeg;base64,${Buffer.from('jpg-bytes').toString('base64')}`)
  res = response()
  await handlerWith(db)({ method: 'GET', url: '/api/marketing-image-jobs?id=7' }, res)
  assert.equal(res.body.image, undefined)
  res = response()
  await handlerWith(db)({ method: 'GET', url: '/api/marketing-image-jobs?post_key=no-6' }, res)
  assert.equal(res.body.job.id, 7)
  res = response()
  await handlerWith(db)({ method: 'GET', url: '/api/marketing-image-jobs?post_key=no-99' }, res)
  assert.equal(res.body.job, null)
  res = response()
  await handlerWith(db)({ method: 'GET', url: '/api/marketing-image-jobs?id=404' }, res)
  assert.equal(res.code, 404)
})

test('ยกเลิกได้เฉพาะงานที่ยังไม่มีใครหยิบ', async () => {
  const db = fakeDb({ jobs: [{ id: 1, status: 'queued', post_key: 'no-6' }, { id: 2, status: 'running', post_key: 'no-7' }] })
  let res = response()
  await handlerWith(db)({ method: 'POST', body: { action: 'cancel', id: 1 } }, res)
  assert.equal(res.code, 200)
  assert.equal(db.tables.marketing_image_jobs[0].status, 'cancelled')
  res = response()
  await handlerWith(db)({ method: 'POST', body: { action: 'cancel', id: 2 } }, res)
  assert.equal(res.code, 409)
  assert.equal(db.tables.marketing_image_jobs[1].status, 'running')
})

test('ตารางยังไม่ได้ติดตั้ง = 503 บอกไฟล์ SQL ที่ต้องรัน', async () => {
  const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: 'PGRST205' } }) }) }) }) }
  const res = response()
  await handlerWith(db)({ method: 'GET', url: '/api/marketing-image-jobs' }, res)
  assert.equal(res.code, 503)
  assert.match(res.body.error, /supabase_marketing_image_jobs\.sql/)
})

test('สถานะตัวรับงาน: เปิดอยู่เมื่อส่งสัญญาณภายใน 90 วินาที', () => {
  assert.equal(workerStatus({ last_seen_at: new Date(NOW - WORKER_ONLINE_MS + 1000).toISOString() }, NOW).online, true)
  assert.equal(workerStatus({ last_seen_at: new Date(NOW - WORKER_ONLINE_MS - 1000).toISOString() }, NOW).online, false)
  assert.equal(workerStatus(null, NOW).online, false)
})

test('ขนาดแพลตฟอร์ม: ระยะครอปและด้านที่ตัดถูกต้อง', () => {
  assert.deepEqual([cropPlan('feed-4x5').edges, cropPlan('feed-4x5').percent], ['top and bottom', 8])
  assert.deepEqual([cropPlan('story-9x16').edges, cropPlan('story-9x16').percent], ['left and right', 8])
  assert.deepEqual([cropPlan('link-191x1').edges, cropPlan('link-191x1').percent], ['top and bottom', 11])
  assert.equal(cropPlan('square-1x1').edges, null)
  assert.equal(cropPlan('nope').width, POSTER_SIZES['feed-4x5'].width)
  assert.equal(defaultPosterSizeFor('line-oa'), 'square-1x1')
  assert.equal(defaultPosterSizeFor('facebook'), 'feed-4x5')
})

test('prompt: หัวข้อตรงตัว · ห้ามตราครุฑ/เบอร์โทร · โปสเตอร์จัตุรัสไม่มีคำสั่งครอป', () => {
  const prompt = buildPosterJobPrompt({ title: 'ขายฝาก ต่างจาก จำนอง อย่างไร', caption: '', size: 'square-1x1' })
  assert.match(prompt, /^Design ONE finished square/)
  assert.match(prompt, /ขายฝาก ต่างจาก จำนอง อย่างไร/)
  assert.match(prompt, /No Garuda/)
  assert.match(prompt, /phone numbers/)
  assert.match(prompt, /ประเมินเบื้องต้น \| ปรึกษาฟรี \| ดูแลเอกสาร/)
  assert.match(prompt, /ASSETX POSTER DESIGN SYSTEM/)
  assert.match(prompt, /#42c7d8/)
  assert.doesNotMatch(prompt, /CONTENT CARD/, 'ไม่มีเนื้อโพสต์ = ไม่มีการ์ดเนื้อหา ใช้ป้าย 3 ป้าย')
  // v2 7 พ.ย. 2569: โครงการ์ดเนื้อหาเลือกตามโครงโพสต์ (ถอดจากตัวอย่างโปสเตอร์ของเจ้าของ)
  const steps = buildPosterJobPrompt({ title: 'ขายฝากมีค่าใช้จ่ายอะไรบ้าง', caption: 'ค่าใช้จ่ายรวมมี 3 ช่วง\n\n1. วันจดทะเบียน: ค่าธรรมเนียมและภาษี\n\n2. ระหว่างสัญญา: สินไถ่\n\n3. วันไถ่ถอน: ค่าธรรมเนียมไถ่ถอน', size: 'feed-4x5' })
  assert.match(steps, /CONTENT CARD \(layout: steps\): Content card = numbered steps/)
  assert.match(steps, /SUB-LINE on the ribbon/)
  assert.match(steps, /must be copied exactly from the post text/)
  assert.doesNotMatch(steps, /SUPPORTING BADGES/)
  const qa = buildPosterJobPrompt({ title: 'ขายฝาก ถามตอบ', caption: 'ถาม: ขายฝากคืออะไร?\nตอบ: การขายที่มีสิทธิไถ่คืน', size: 'square-1x1' })
  assert.match(qa, /layout: qa/)
  const compare = buildPosterJobPrompt({ title: 'จำนอง vs ขายฝาก', caption: 'จำนอง vs ขายฝาก ต่างกันอย่างไร จำนองไม่โอนกรรมสิทธิ์ ขายฝากโอนกรรมสิทธิ์ทันที', size: 'square-1x1' })
  assert.match(compare, /layout: compare/)
  const warning = buildPosterJobPrompt({ title: 'ระวังแก๊งปลอมโฉนด', caption: 'เตือนภัย แก๊งปลอมโฉนดที่ดิน หลอกให้เซ็น\n1. ทำที่สำนักงานที่ดิน\n2. ตรวจตัวตน', size: 'square-1x1' })
  assert.match(warning, /layout: warning/, 'เรื่องมิจฉาชีพใช้โครงเตือนภัยแม้มีเลขข้อ')
  assert.match(warning, /no villains, no police/)
  assert.doesNotMatch(prompt, /center-cropped/)
})

test('หน้าต่างออกแบบภาพ: รหัสโพสต์และข้อความสถานะ', () => {
  assert.equal(postKeyFor({ contentNo: 6, id: 'abc' }), 'no-6')
  assert.equal(postKeyFor({ id: 'draft 12/ก' }), 'id-draft12')
  assert.equal(postKeyFor({}), '')
  const studioA = postKeyFor({ id: 'generated', title: 'ร่าง ก', caption: 'เนื้อหา ก' })
  assert.match(studioA, /^studio-[0-9a-z]+$/)
  assert.equal(studioA, postKeyFor({ id: 'generated', title: 'ร่าง ก', caption: 'เนื้อหา ก' }))
  assert.notEqual(studioA, postKeyFor({ id: 'generated', title: 'ร่าง ข', caption: 'เนื้อหา ข' }))
  assert.equal(formatElapsed(65), '1:05')
  const queued = { status: 'queued', created_at: new Date(NOW - 5000).toISOString() }
  assert.match(chatJobMessage(queued, { online: true }, NOW), /รอคอมสำนักงานรับงาน · 0:05/)
  assert.match(chatJobMessage(queued, { online: false }, NOW), /npm run image-worker/)
  assert.match(chatJobMessage({ status: 'failed', error: 'โควตาหมด' }, null, NOW), /โควตาหมด/)
  assert.equal(chatJobMessage(null, { online: true }, NOW), '')
})

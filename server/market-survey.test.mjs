import test from 'node:test'
import assert from 'node:assert/strict'
import { createMarketSurveyHandler, surveyWorkerStatus } from './market-survey-jobs.js'
import { claimNextSurveyJob, processSurveyJob, releaseStaleSurveyJobs } from './market-survey-worker.js'

// ฐานข้อมูลจำลองในหน่วยความจำ: รองรับรูปแบบคำสั่งที่โค้ดสองไฟล์นี้ใช้
function fakeDb({ jobs = [], worker = null } = {}) {
  const tables = { market_survey_jobs: jobs, marketing_image_worker: worker ? [worker] : [] }
  let nextId = jobs.reduce((m, j) => Math.max(m, j.id), 0) + 1
  const from = (name) => {
    const q = { filters: [], op: 'select', patch: null, head: false, limitN: null, orderKey: null, asc: true }
    const rows = () => {
      let out = tables[name].filter((r) => q.filters.every((f) => f(r)))
      if (q.orderKey) out = [...out].sort((a, b) => (a[q.orderKey] < b[q.orderKey] ? -1 : 1) * (q.asc ? 1 : -1))
      return q.limitN ? out.slice(0, q.limitN) : out
    }
    const run = () => {
      if (q.op === 'insert') { const row = { id: nextId++, created_at: new Date().toISOString(), result: null, error: null, ...q.patch }; tables[name].push(row); return { data: [row], error: null } }
      if (q.op === 'update') { const hit = rows(); hit.forEach((r) => Object.assign(r, q.patch)); return { data: hit, error: null } }
      const data = rows()
      return q.head ? { count: data.length, error: null } : { data, error: null }
    }
    const api = {
      select: (_c, opts) => { if (opts?.head) q.head = true; return api },
      insert: (row) => { q.op = 'insert'; q.patch = row; return api },
      update: (patch) => { q.op = 'update'; q.patch = patch; return api },
      eq: (k, v) => { q.filters.push((r) => r[k] === v); return api },
      neq: (k, v) => { q.filters.push((r) => r[k] !== v); return api },
      in: (k, v) => { q.filters.push((r) => v.includes(r[k])); return api },
      order: (k, o) => { q.orderKey = k; q.asc = o?.ascending !== false; return api },
      limit: (n) => { q.limitN = n; return api },
      maybeSingle: async () => { const r = run(); return { data: r.data?.[0] || null, error: null } },
      then: (resolve) => resolve(run()),
    }
    return api
  }
  return { from, tables }
}

function call(handler, { method = 'GET', url = '/api/market-survey', body } = {}) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v }, status(code) { this.code = code; return this }, json(data) { resolve({ code: this.code, data }) } }
    handler({ method, url, body }, res)
  })
}

const goodRequest = { province: 'กรุงเทพมหานคร', district: 'จอมทอง', subdistrict: 'จอมทอง', property: 'ที่ดินเปล่า (โฉนด)', total_sqw: 236, gov_price_per_sqw: 30000, titleDeedNo: '99999', contactPhone: '0800000000', lat: 13.7 }

test('API: ต้องล็อกอิน · เก็บเฉพาะช่องที่อนุญาต · กดซ้ำตามงานเดิม · จำกัดจำนวนงานค้าง · ยกเลิกได้เฉพาะงานที่ยังไม่ถูกหยิบ', async () => {
  const db = fakeDb({ worker: { id: 'office-pc', last_seen_at: new Date().toISOString(), info: { market_survey: true } } })
  assert.equal((await call(createMarketSurveyHandler({ authorized: () => false, database: () => db }))).code, 401)
  const handler = createMarketSurveyHandler({ authorized: () => true, database: () => db })

  const made = await call(handler, { method: 'POST', body: { action: 'create', valuation_id: 22, request: goodRequest } })
  assert.equal(made.code, 200)
  assert.equal(made.data.reused, false)
  assert.deepEqual(made.data.worker.online && made.data.worker.survey, true)
  const stored = db.tables.market_survey_jobs[0]
  assert.deepEqual(Object.keys(stored.request).sort(), ['basis', 'district', 'gov_price_per_sqw', 'property', 'province', 'road', 'subdistrict', 'total_sqw'])
  assert.doesNotMatch(JSON.stringify(stored.request), /99999|0800000000|13\.7/)

  const again = await call(handler, { method: 'POST', body: { action: 'create', valuation_id: 22, request: goodRequest } })
  assert.equal(again.data.reused, true)
  assert.equal(db.tables.market_survey_jobs.length, 1)

  assert.equal((await call(handler, { method: 'POST', body: { action: 'create', request: { ...goodRequest, district: '' } } })).code, 400)
  await call(handler, { method: 'POST', body: { action: 'create', valuation_id: 23, request: goodRequest } })
  assert.equal((await call(handler, { method: 'POST', body: { action: 'create', valuation_id: 24, request: goodRequest } })).code, 429)

  assert.equal((await call(handler, { url: '/api/market-survey?valuation_id=22' })).data.job.id, 1)
  assert.equal((await call(handler, { url: '/api/market-survey?id=99' })).code, 404)
  assert.equal((await call(handler, { url: '/api/market-survey?valuation_id=77' })).data.job, null)

  assert.equal((await call(handler, { method: 'POST', body: { action: 'cancel', id: 2 } })).data.job.status, 'cancelled')
  db.tables.market_survey_jobs[0].status = 'running'
  assert.equal((await call(handler, { method: 'POST', body: { action: 'cancel', id: 1 } })).code, 409)
  assert.equal(surveyWorkerStatus({ last_seen_at: new Date(Date.now() - 5 * 60000).toISOString(), info: {} }).online, false)
})

test('ตัวรับงาน: หยิบงานเก่าสุด · เก็บเฉพาะรายการที่ผ่านการตรวจ · AI ตอบไม่ได้หรือไม่พบรายการ = failed พร้อมเหตุผล', async () => {
  const request = { province: 'กรุงเทพมหานคร', district: 'จอมทอง', total_sqw: 236 }
  const db = fakeDb({ jobs: [
    { id: 1, status: 'queued', request, created_at: '2026-11-18T01:00:00Z' },
    { id: 2, status: 'queued', request, created_at: '2026-11-18T02:00:00Z' },
    { id: 3, status: 'queued', request, created_at: '2026-11-18T03:00:00Z' },
    { id: 4, status: 'running', worker: 'office-pc', request, created_at: '2026-11-18T00:00:00Z' },
  ] })
  assert.equal(await releaseStaleSurveyJobs(db, 'office-pc'), 1)
  assert.equal(db.tables.market_survey_jobs[3].status, 'failed')

  const job = await claimNextSurveyJob(db, 'office-pc')
  assert.equal(job.id, 1)
  let prompt = ''
  const ok = await processSurveyJob(db, job, { survey: async (p) => { prompt = p; return JSON.stringify({ listings: [
    { url: 'https://example.com/1', title: 'a', asset: 'ที่ดินเปล่า', price_baht: 8000000, area_sqw: 200, opened_page: true },
    { url: 'https://example.com/2', title: 'b', price_baht: 8000000, area_sqw: 200, opened_page: false },
  ] }) } })
  assert.equal(ok.ok, true)
  assert.match(prompt, /เขตจอมทอง/)
  const done = db.tables.market_survey_jobs[0]
  assert.equal(done.status, 'done')
  assert.equal(done.result.listings.length, 1)
  assert.equal(done.result.rejected.length, 1)

  const none = await processSurveyJob(db, await claimNextSurveyJob(db, 'office-pc'), { survey: async () => '{"listings":[]}' })
  assert.equal(none.ok, false)
  assert.match(db.tables.market_survey_jobs[1].error, /ไม่พบประกาศ/)
  const crash = await processSurveyJob(db, await claimNextSurveyJob(db, 'office-pc'), { survey: async () => { throw new Error('Codex exit 1') } })
  assert.equal(crash.ok, false)
  assert.equal(db.tables.market_survey_jobs[2].status, 'failed')
  assert.equal(await claimNextSurveyJob(db, 'office-pc'), null)
})

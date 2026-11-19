import test from 'node:test'
import assert from 'node:assert/strict'
import { createBrokersHandler, registerLeadBroker } from './brokers.js'

// ฐานข้อมูลจำลองในหน่วยความจำ: รองรับรูปแบบคำสั่งที่ server/brokers.js ใช้ · ข้อมูลสมมติทั้งหมด
function fakeDb({ brokers = [], valuations = [], missing = false } = {}) {
  const tables = { brokers, valuations }
  let nextId = brokers.reduce((m, b) => Math.max(m, b.id), 0) + 1
  const from = (name) => {
    const q = { op: 'select', patch: null, filters: [], limitN: null, orderKey: null, asc: true, single: false }
    const run = () => {
      if (missing && name === 'brokers') return { data: null, error: { code: '42P01', message: 'relation "brokers" does not exist' } }
      if (q.op === 'insert') {
        if (q.patch.phone_key && tables[name].some((r) => r.phone_key === q.patch.phone_key)) return { data: null, error: { code: '23505', message: 'duplicate key' } }
        const row = { id: nextId++, code: null, name: '', phone: '', phone_key: null, line_id: '', note: '', status: 'new', merged_into: null, first_lead_id: null, ...q.patch }
        tables[name].push(row)
        return { data: q.single ? row : [row], error: null }
      }
      let rows = tables[name].filter((r) => q.filters.every((f) => f(r)))
      if (q.op === 'update') { rows.forEach((r) => Object.assign(r, q.patch)); return { data: q.single ? rows[0] || null : rows, error: null } }
      if (q.orderKey) rows = [...rows].sort((a, b) => (a[q.orderKey] < b[q.orderKey] ? -1 : 1) * (q.asc ? 1 : -1))
      if (q.limitN) rows = rows.slice(0, q.limitN)
      return { data: q.single ? rows[0] || null : rows, error: null }
    }
    const api = {
      select: () => api,
      insert: (row) => { q.op = 'insert'; q.patch = row; return api },
      update: (patch) => { q.op = 'update'; q.patch = patch; return api },
      eq: (k, v) => { q.filters.push((r) => r[k] === v); return api },
      order: (k, o) => { q.orderKey = k; q.asc = o?.ascending !== false; return api },
      limit: (n) => { q.limitN = n; return api },
      maybeSingle: () => { q.single = true; return Promise.resolve(run()) },
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
    }
    return api
  }
  return { from, tables }
}

function call(handler, { method = 'GET', body } = {}) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v }, status(code) { this.code = code; return this }, json(data) { resolve({ status: this.code, data }) } }
    handler({ method, url: '/api/brokers', body }, res)
  })
}
const handlerFor = (db, authorized = true) => createBrokersHandler({ authorized: () => authorized, database: () => db })
const lead = (id, over = {}) => ({ id, created_at: `2026-11-${String(10 + id).padStart(2, '0')}T03:00:00Z`, status: 'Lead จากเว็บ', lead_source: 'broker', lead_ref: '', contact_name: `ผู้ส่ง ${id}`, contact_phone: '0800000001', contact_line: '', province: 'กรุงเทพมหานคร', district: 'จอมทอง', subdistrict: 'จอมทอง', total_sqw: 100, deeds: [], ...over })

test('ต้องล็อกอิน และตารางยังไม่ถูกสร้างตอบ 503 พร้อมบอกไฟล์ SQL', async () => {
  assert.equal((await call(handlerFor(fakeDb(), false))).status, 401)
  const missing = await call(handlerFor(fakeDb({ missing: true })))
  assert.equal(missing.status, 503)
  assert.equal(missing.data.missingTable, true)
  assert.match(missing.data.error, /supabase_brokers\.sql/)
})

test('lead แรกของเบอร์ใหม่: เพิ่มเข้าทะเบียนเอง ได้รหัส และรายการถัดไปของเบอร์เดิมเป็นนายหน้าเดิม', async () => {
  const first = lead(1, { contact_phone: '080-000-0001' })
  const db = fakeDb({ valuations: [first] })
  const a = await registerLeadBroker(db, first)
  assert.deepEqual(a.broker, { code: 'N001', isNew: true, priorCount: 0, mismatch: false, unidentified: false })
  assert.equal(db.tables.brokers.length, 1)
  assert.equal(db.tables.brokers[0].phone_key, '0800000001')
  assert.equal(db.tables.brokers[0].status, 'new')

  const second = lead(2, { contact_phone: '+66800000001' })
  db.tables.valuations.push(second)
  const b = await registerLeadBroker(db, second)
  assert.equal(b.broker.code, 'N001')
  assert.equal(b.broker.isNew, false)
  assert.equal(b.broker.priorCount, 1)
  assert.equal(db.tables.brokers.length, 1)
})

test('หลายคนใช้ลิงก์สาธารณะเดียวกัน: ได้คนละรหัส · เบอร์ไม่ครบ = ระบุตัวตนไม่ได้ · เจ้าของทรัพย์ไม่ถูกลงทะเบียน', async () => {
  const one = lead(1, { lead_ref: 'fb', contact_phone: '0800000001' })
  const two = lead(2, { lead_ref: 'fb', contact_phone: '0800000002' })
  const db = fakeDb({ valuations: [one, two] })
  assert.equal((await registerLeadBroker(db, one)).broker.code, 'N001')
  assert.equal((await registerLeadBroker(db, two)).broker.code, 'N002')
  assert.deepEqual((await registerLeadBroker(db, lead(3, { contact_phone: '123' }))).broker, { unidentified: true })
  assert.equal((await registerLeadBroker(db, lead(4, { lead_source: 'owner' }))).broker, null)
  assert.equal(db.tables.brokers.length, 2)
})

test('ลิงก์ส่วนตัวถูกส่งต่อ และทรัพย์ซ้ำ ถูกรายงานกลับ · ตารางยังไม่ถูกสร้างก็ยังตรวจทรัพย์ซ้ำได้', async () => {
  const brokers = [{ id: 1, code: 'N001', name: 'หนึ่ง', phone: '0800000001', phone_key: '0800000001', status: 'active', merged_into: null }]
  const earlier = lead(1, { title_deed_no: '11111' })
  const forwarded = lead(2, { lead_ref: 'N001', contact_phone: '0800000002', title_deed_no: '11111' })
  const db = fakeDb({ brokers, valuations: [earlier, forwarded] })
  const result = await registerLeadBroker(db, forwarded)
  assert.equal(result.broker.mismatch, true)
  assert.equal(result.broker.code, 'N002')
  assert.deepEqual(result.duplicates.map((d) => [d.ticketNo, d.certainty, d.earlier]), [['AX-00001', 'same', true]])

  const noTable = await registerLeadBroker(fakeDb({ missing: true, valuations: [earlier, forwarded] }), forwarded)
  assert.equal(noTable.broker, null)
  assert.equal(noTable.duplicates.length, 1)
})

test('เพิ่มนายหน้าเอง: ตรวจเบอร์ กันเบอร์ซ้ำและรหัสซ้ำ รองรับรหัสที่ตั้งเอง', async () => {
  const db = fakeDb()
  const handler = handlerFor(db)
  assert.equal((await call(handler, { method: 'POST', body: { action: 'create', name: 'หนึ่ง', phone: '123' } })).status, 400)
  assert.equal((await call(handler, { method: 'POST', body: { action: 'create', name: '', phone: '0800000001' } })).status, 400)
  const made = await call(handler, { method: 'POST', body: { action: 'create', name: 'หนึ่ง', phone: '080-000-0001', code: 'คุณเอ' } })
  assert.equal(made.status, 200)
  assert.equal(made.data.broker.code, 'คุณเอ')
  assert.equal(made.data.broker.status, 'active')
  assert.equal((await call(handler, { method: 'POST', body: { action: 'create', name: 'ซ้ำ', phone: '0800000001' } })).status, 409)
  assert.equal((await call(handler, { method: 'POST', body: { action: 'create', name: 'สอง', phone: '0800000002', code: 'คุณเอ' } })).status, 409)
  const auto = await call(handler, { method: 'POST', body: { action: 'create', name: 'สอง', phone: '0800000002' } })
  assert.equal(auto.data.broker.code, 'N002')
})

test('แก้ไข เปลี่ยนสถานะ รวมและแยกรายชื่อ', async () => {
  const db = fakeDb({ brokers: [
    { id: 1, code: 'N001', name: 'หนึ่ง', phone: '0800000001', phone_key: '0800000001', status: 'active', merged_into: null },
    { id: 2, code: 'N002', name: 'สอง', phone: '0800000002', phone_key: '0800000002', status: 'new', merged_into: null },
    { id: 3, code: 'N003', name: 'สาม', phone: '0800000003', phone_key: '0800000003', status: 'new', merged_into: 2 },
  ] })
  const handler = handlerFor(db)
  const post = (body) => call(handler, { method: 'POST', body })
  assert.equal((await post({ action: 'update', id: 2, status: 'active', note: 'คุยแล้ว' })).data.broker.status, 'active')
  assert.equal((await post({ action: 'update', id: 2, status: 'deleted' })).status, 400)
  assert.equal((await post({ action: 'update', id: 99, name: 'x' })).status, 404)
  assert.equal((await post({ action: 'merge', id: 1, into: 1 })).status, 400)
  // รวม 1 เข้า 3 ซึ่งถูกรวมเข้า 2 อยู่แล้ว → ปลายทางจริงคือ 2
  assert.equal((await post({ action: 'merge', id: 1, into: 3 })).data.broker.merged_into, 2)
  // รวม 2 เข้า 1 ตอนนี้จะวนกลับมาที่ตัวเอง → ไม่ให้ทำ
  assert.equal((await post({ action: 'merge', id: 2, into: 1 })).status, 400)
  assert.equal((await post({ action: 'unmerge', id: 1 })).data.broker.merged_into, null)
  assert.equal((await post({ action: 'nothing', id: 1 })).status, 400)
})

test('sync: เพิ่มเฉพาะคนที่เคยส่งงานและยังไม่อยู่ในทะเบียน คนละเบอร์ละหนึ่งรายชื่อ', async () => {
  const db = fakeDb({
    brokers: [{ id: 1, code: 'N001', name: 'หนึ่ง', phone: '0800000001', phone_key: '0800000001', status: 'active', merged_into: null }],
    valuations: [lead(1), lead(2, { contact_phone: '0800000002' }), lead(3, { contact_phone: '080 000 0002' }), lead(4, { lead_source: 'owner', contact_phone: '0800000009' }), lead(5, { contact_phone: 'ไม่มี' }), lead(6, { contact_phone: '0800000007', status: 'ยกเลิก' })],
  })
  const result = await call(handlerFor(db), { method: 'POST', body: { action: 'sync' } })
  assert.equal(result.data.added, 1)
  assert.equal(result.data.brokers.length, 2)
  assert.equal(result.data.brokers[1].code, 'N002')
  assert.equal(result.data.brokers[1].first_lead_id, 2)
})

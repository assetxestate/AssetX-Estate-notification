import test from 'node:test'
import assert from 'node:assert/strict'
import { createPaymentAdditionsHandler, validateAddition } from './paymentAdditions.js'

const TOPUP = 'aaaaaaaa-0000-4000-8000-000000000001'
// วันที่ลูกค้ามาจ่ายส่วนที่ขาด (สมมติ)
const NOW = new Date('2026-11-15T08:00:00Z')

// ฐานข้อมูลในหน่วยความจำ รองรับเฉพาะรูปแบบคำสั่งที่ตัวจัดการใช้ (select/eq/is/order/range/maybeSingle/single/insert/update)
// insert ของ payment_additions บังคับข้อห้ามซ้ำเหมือนจริง: รหัส (payment_additions_pkey) และลำดับต่องวด (payment_additions_seq_key)
function fakeDb(seed = {}) {
  const tables = { customers: [], payments: [], payment_records: [], contract_topups: [], topup_payment_records: [], payment_additions: [], ...structuredClone(seed) }
  let nextId = 1
  return {
    tables,
    from(name) {
      const state = { name, filters: [], op: 'select', payload: null, range: null, error: null }
      const rows = () => (tables[name] || []).filter((row) => state.filters.every(([k, v]) => (v === null ? row[k] == null : row[k] === v)))
      const run = () => {
        if (state.op === 'insert') {
          const row = { id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`, created_at: NOW.toISOString(), voided_at: null, void_reason: '', ...state.payload }
          const table = tables[name]
          if (table.some((r) => r.id === row.id)) {
            state.error = { code: '23505', message: 'duplicate key value violates unique constraint "payment_additions_pkey"', details: `Key (id)=(${row.id}) already exists.` }
            return []
          }
          const sameSeq = (r) => r.customer_id === row.customer_id && (r.topup_id || '') === (row.topup_id || '') && r.installment === row.installment && r.seq === row.seq
          if (name === 'payment_additions' && table.some(sameSeq)) {
            state.error = { code: '23505', message: 'duplicate key value violates unique constraint "payment_additions_seq_key"' }
            return []
          }
          table.push(row)
          return [row]
        }
        if (state.op === 'update') {
          const hit = rows()
          hit.forEach((row) => Object.assign(row, state.payload))
          return hit
        }
        const out = rows()
        return state.range ? out.slice(state.range[0], state.range[1] + 1) : out
      }
      const result = () => { const data = run(); return state.error ? { data: null, error: state.error } : { data, error: null } }
      const builder = {
        select() { return builder },
        eq(k, v) { state.filters.push([k, v]); return builder },
        is(k, v) { state.filters.push([k, v]); return builder },
        order() { return builder },
        range(from, to) { state.range = [from, to]; return builder },
        insert(payload) { state.op = 'insert'; state.payload = payload; return builder },
        update(payload) { state.op = 'update'; state.payload = payload; return builder },
        async maybeSingle() { const { data, error } = result(); return { data: data?.[0] || null, error } },
        async single() { const { data, error } = result(); return error ? { data: null, error } : data[0] ? { data: data[0], error: null } : { data: null, error: { message: 'no row' } } },
        then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) },
      }
      return builder
    },
  }
}

const seed = {
  customers: [{ id: 'CID1', amount: 20000, is_cancelled: false }, { id: 'CIDX', amount: 5000, is_cancelled: true }],
  payments: [{ customer_id: 'CID1', installment: 7 }, { customer_id: 'CID1', installment: 8 }],
  payment_records: [{ customer_id: 'CID1', installment: 7, amount_paid: 20000, slip_id: '' }],
  contract_topups: [{ id: TOPUP, customer_id: 'CID1', interest_amount: 9000, payments: [{ installment: 2, dateStr: '2026-11-06' }] }],
  topup_payment_records: [{ topup_id: TOPUP, installment: 2, amount_paid: 6500, slip_id: '' }],
}
const response = () => ({ setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
const call = async (db, req, opts = {}) => {
  const res = response()
  await createPaymentAdditionsHandler({ authorized: () => true, database: () => db, now: () => NOW, ...opts })({ url: '/api/payment-additions', ...req }, res)
  return res
}
const topupPayment = (extra = {}) => ({ customerId: 'CID1', topupId: TOPUP, installment: 2, kind: 'payment', paidAt: '2026-11-15', amount: 2500, note: 'โอนส่วนที่ขาด', ...extra })

test('ไม่ได้ล็อกอิน = 401 และไม่แตะฐานข้อมูล', async () => {
  const res = response()
  await createPaymentAdditionsHandler({ authorized: () => false, database: () => { throw new Error('must not run') } })({ method: 'GET' }, res)
  assert.equal(res.code, 401)
})

test('เซิร์ฟเวอร์ไม่มีกุญแจฐานข้อมูล = 503 ไม่อ้างว่าบันทึกแล้ว', async () => {
  const res = await call(null, { method: 'POST', body: topupPayment() }, { database: () => null })
  assert.equal(res.code, 503)
  assert.equal(res.body.code, 'not_configured', 'หน้าเว็บต้องแยกจาก "ยังไม่ได้สร้างตาราง" — กรณีนี้อาจมีรายการอยู่แต่อ่านไม่ได้')
})

test('ตรวจข้อมูล: วันที่ จำนวนเงิน งวด ประเภท ลิงก์สลิป และเหตุผลของการยกเว้น', () => {
  const ok = validateAddition(topupPayment({ amount: '2,500.55', slipUrl: 'https://i.ibb.co/x.jpg' }), NOW)
  assert.equal(ok.amount, 2500.55)
  assert.equal(ok.kind, 'payment')
  for (const [patch, message] of [
    [{ customerId: '' }, 'กรุณาระบุลูกค้า'],
    [{ topupId: 'not-a-uuid' }, 'รหัสวงเงินเพิ่มไม่ถูกต้อง'],
    [{ installment: 0 }, 'งวดไม่ถูกต้อง'],
    [{ installment: 1.5 }, 'งวดไม่ถูกต้อง'],
    [{ kind: 'refund' }, 'ประเภทรายการไม่ถูกต้อง'],
    [{ paidAt: '2026-02-30' }, 'วันที่ชำระไม่ถูกต้อง'],
    [{ paidAt: '2027-11-15' }, 'วันที่ชำระอยู่ในอนาคต กรุณาตรวจวันที่'],
    [{ amount: 0 }, 'จำนวนเงินต้องมากกว่า 0'],
    [{ amount: 'abc' }, 'จำนวนเงินต้องมากกว่า 0'],
    [{ amount: 1e12 }, 'จำนวนเงินสูงเกินไป กรุณาตรวจตัวเลข'],
    [{ amount: '2500.555' }, 'จำนวนเงินมีทศนิยมได้ไม่เกิน 2 ตำแหน่ง'],
    [{ amount: -5 }, 'จำนวนเงินต้องมากกว่า 0'],
    [{ slipUrl: 'http://evil.example/x' }, 'ลิงก์สลิปไม่ถูกต้อง'],
    [{ kind: 'waiver', note: '' }, 'การยกเว้นส่วนที่ขาดต้องระบุเหตุผล'],
    [{ slipId: 'ADVANCE_DEDUCTION' }, 'รายการชำระเพิ่มใช้รหัสหักดอกล่วงหน้าไม่ได้'],
  ]) assert.throws(() => validateAddition(topupPayment(patch), NOW), { message }, JSON.stringify(patch))
})

test('จ่ายส่วนที่ขาด 2,500 ของวงเงินเพิ่มงวด 2 ได้ และงวดนั้นจะครบ', async () => {
  const db = fakeDb(seed)
  const res = await call(db, { method: 'POST', body: topupPayment() })
  assert.equal(res.code, 200, JSON.stringify(res.body))
  assert.equal(res.body.addition.amount, 2500)
  assert.equal(res.body.addition.topupId, TOPUP)
  assert.equal(db.tables.payment_additions.length, 1)
  const again = await call(db, { method: 'POST', body: topupPayment({ amount: 100 }) })
  assert.equal(again.code, 409, 'งวดที่ครบแล้วบันทึกเพิ่มไม่ได้')
})

test('งวดที่จ่ายครบแล้ว หรือยังไม่มีบันทึกครั้งแรก บันทึกเพิ่มไม่ได้', async () => {
  const db = fakeDb(seed)
  const full = await call(db, { method: 'POST', body: { customerId: 'CID1', installment: 7, paidAt: '2026-11-15', amount: 100 } })
  assert.equal(full.code, 409)
  const noFirst = await call(db, { method: 'POST', body: { customerId: 'CID1', installment: 8, paidAt: '2026-11-15', amount: 100 } })
  assert.equal(noFirst.code, 409)
  assert.match(noFirst.body.error, /ยังไม่มีบันทึกการชำระครั้งแรก/)
  assert.equal(db.tables.payment_additions.length, 0)
})

test('ลูกค้า งวด หรือวงเงินเพิ่มที่ไม่ตรงกัน = ไม่พบ · สัญญาที่ยกเลิก = บันทึกไม่ได้', async () => {
  const db = fakeDb(seed)
  assert.equal((await call(db, { method: 'POST', body: topupPayment({ customerId: 'NOPE' }) })).code, 404)
  assert.equal((await call(db, { method: 'POST', body: topupPayment({ installment: 9 }) })).code, 404)
  assert.equal((await call(db, { method: 'POST', body: topupPayment({ customerId: 'CIDX' }) })).code, 409)
  assert.equal((await call(db, { method: 'POST', body: { customerId: 'CID1', installment: 99, paidAt: '2026-11-15', amount: 1 } })).code, 404)
})

test('ยกเว้นได้ไม่เกินยอดที่ขาด', async () => {
  const db = fakeDb(seed)
  const over = await call(db, { method: 'POST', body: topupPayment({ kind: 'waiver', amount: 2600, note: 'ส่วนลดพิเศษ' }) })
  assert.equal(over.code, 400)
  const ok = await call(db, { method: 'POST', body: topupPayment({ kind: 'waiver', amount: 2500, note: 'ส่วนลดพิเศษ' }) })
  assert.equal(ok.code, 200)
  assert.equal(ok.body.addition.kind, 'waiver')
})

test('ยกเลิกรายการ = ตั้ง voided_at ไม่ลบ · ยกเลิกซ้ำได้ 409 · งวดกลับมาค้างและบันทึกใหม่ได้', async () => {
  const db = fakeDb(seed)
  const created = await call(db, { method: 'POST', body: topupPayment() })
  const id = created.body.addition.id
  assert.equal((await call(db, { method: 'PATCH', body: { id, customerId: 'CID1', voidReason: 'ab' } })).code, 400)
  const voided = await call(db, { method: 'PATCH', body: { id, customerId: 'CID1', voidReason: 'พิมพ์ยอดผิด' } })
  assert.equal(voided.code, 200)
  assert.equal(voided.body.addition.voidReason, 'พิมพ์ยอดผิด')
  assert.equal(db.tables.payment_additions.length, 1, 'ไม่ลบแถว')
  assert.equal((await call(db, { method: 'PATCH', body: { id, customerId: 'CID1', voidReason: 'ซ้ำ' } })).code, 409)
  assert.equal((await call(db, { method: 'PATCH', body: { id, customerId: 'OTHER', voidReason: 'ผิดคน' } })).code, 409)
  assert.equal((await call(db, { method: 'POST', body: topupPayment() })).code, 200)
})

test('อ่านรายการ: ทั้งหมด หรือเฉพาะลูกค้า (รวมที่ยกเลิก)', async () => {
  const db = fakeDb(seed)
  await call(db, { method: 'POST', body: topupPayment() })
  const all = await call(db, { method: 'GET' })
  assert.equal(all.code, 200)
  assert.equal(all.body.additions.length, 1)
  const mine = await call(db, { method: 'GET', url: '/api/payment-additions?customerId=CID1' })
  assert.equal(mine.body.additions[0].customerId, 'CID1')
  const other = await call(db, { method: 'GET', url: '/api/payment-additions?customerId=CID9' })
  assert.equal(other.body.additions.length, 0)
})

test('ยังไม่ได้รัน SQL สร้างตาราง = 503 พร้อมบอกไฟล์ที่ต้องรัน', async () => {
  const db = fakeDb(seed)
  const realFrom = db.from.bind(db)
  db.from = (name) => {
    if (name !== 'payment_additions') return realFrom(name)
    const b = realFrom(name)
    b.then = (resolve, reject) => Promise.resolve({ data: null, error: { code: 'PGRST205' } }).then(resolve, reject)
    return b
  }
  const res = await call(db, { method: 'GET' })
  assert.equal(res.code, 503)
  assert.equal(res.body.code, 'table_missing')
  assert.match(res.body.error, /supabase_payment_additions\.sql/)
})

test('บันทึกพร้อมกันสองคำขอที่อ่านยอดชุดเดียวกัน: ผ่านได้รายการเดียว อีกรายการได้ 409 (ลำดับต่องวดห้ามซ้ำ)', async () => {
  const db = fakeDb(seed)
  const [a, b] = await Promise.all([
    call(db, { method: 'POST', body: topupPayment() }),
    call(db, { method: 'POST', body: topupPayment({ kind: 'waiver', note: 'ส่วนลดตามที่ตกลง' }) }),
  ])
  assert.deepEqual([a.code, b.code].sort(), [200, 409])
  assert.equal([a, b].find((r) => r.code === 409).body.code, 'conflict')
  assert.equal(db.tables.payment_additions.length, 1)
  assert.equal(db.tables.payment_additions[0].seq, 1)
})

test('ส่งซ้ำด้วยรหัสรายการเดิม (กดซ้ำ/ลองใหม่หลังเน็ตหลุด) = ได้รายการเดิม ไม่เกิดรายการซ้ำ · รายการถัดไปได้ลำดับ 2', async () => {
  const db = fakeDb(seed)
  const id = 'bbbbbbbb-0000-4000-8000-000000000001'
  const first = await call(db, { method: 'POST', body: topupPayment({ id, amount: 1000 }) })
  assert.equal(first.code, 200)
  assert.equal(first.body.addition.id, id)
  const again = await call(db, { method: 'POST', body: topupPayment({ id, amount: 1000 }) })
  assert.equal(again.code, 200)
  assert.equal(again.body.replayed, true)
  assert.equal(db.tables.payment_additions.length, 1)
  const next = await call(db, { method: 'POST', body: topupPayment({ amount: 1500 }) })
  assert.equal(next.code, 200)
  assert.deepEqual(db.tables.payment_additions.map((r) => r.seq), [1, 2])
  assert.throws(() => validateAddition(topupPayment({ id: 'not-a-uuid' }), NOW), { message: 'รหัสรายการไม่ถูกต้อง' })
})

test('สองคำขอรหัสเดียวกันเข้ามาพร้อมกัน: บันทึกได้รายการเดียว อีกคำขอได้ 409', async () => {
  const db = fakeDb(seed)
  const id = 'dddddddd-0000-4000-8000-000000000001'
  const [a, b] = await Promise.all([
    call(db, { method: 'POST', body: topupPayment({ id, amount: 1000 }) }),
    call(db, { method: 'POST', body: topupPayment({ id, amount: 1000 }) }),
  ])
  assert.deepEqual([a.code, b.code].sort(), [200, 409])
  assert.ok(['duplicate', 'conflict'].includes([a, b].find((r) => r.code === 409).body.code))
  assert.equal(db.tables.payment_additions.length, 1)
})

test('ลองใหม่หลังเน็ตหลุดด้วยรหัสเดิม หลังครั้งแรกทำให้งวดครบแล้ว: ได้รายการเดิมกลับมา (ไม่ใช่ "ชำระครบแล้ว")', async () => {
  const db = fakeDb(seed)
  const id = 'cccccccc-0000-4000-8000-000000000001'
  const first = await call(db, { method: 'POST', body: topupPayment({ id }) })
  assert.equal(first.code, 200)
  const replay = await call(db, { method: 'POST', body: topupPayment({ id }) })
  assert.equal(replay.code, 200, JSON.stringify(replay.body))
  assert.equal(replay.body.replayed, true)
  assert.equal(replay.body.addition.id, id)
  assert.equal(db.tables.payment_additions.length, 1)
  const edited = await call(db, { method: 'POST', body: topupPayment({ id, amount: 2000 }) })
  assert.equal(edited.code, 409)
  assert.equal(edited.body.code, 'id_conflict')
  assert.match(edited.body.error, /2,500 บาท/)
  assert.equal(db.tables.payment_additions.length, 1)
  // แก้วันที่หรือแนบสลิปตอนลองใหม่ = ไม่ใช่การส่งซ้ำ บอกค่าที่บันทึกไว้ (ไม่ตอบว่าบันทึกแล้วทั้งที่ไม่ได้เก็บค่าที่แก้)
  const redated = await call(db, { method: 'POST', body: topupPayment({ id, paidAt: '2026-11-14' }) })
  assert.equal(redated.code, 409)
  assert.match(redated.body.error, /2026-11-15/)
  const withSlip = await call(db, { method: 'POST', body: topupPayment({ id, slipUrl: 'https://i.ibb.co/slip.jpg' }) })
  assert.equal(withSlip.code, 409)
})

test('รหัสของรายการที่ยกเลิกแล้วใช้ซ้ำไม่ได้ (ไม่ตอบว่าบันทึกแล้ว)', async () => {
  const db = fakeDb(seed)
  const id = 'eeeeeeee-0000-4000-8000-000000000001'
  await call(db, { method: 'POST', body: topupPayment({ id, amount: 1000 }) })
  await call(db, { method: 'PATCH', body: { id, customerId: 'CID1', voidReason: 'แนบสลิปผิด' } })
  const reuse = await call(db, { method: 'POST', body: topupPayment({ id, amount: 1000 }) })
  assert.equal(reuse.code, 409)
  assert.equal(reuse.body.code, 'id_conflict')
  assert.match(reuse.body.error, /ยกเลิกไปแล้ว/)
})

test('ฐานข้อมูลปฏิเสธเพราะบันทึกครั้งแรกหายไประหว่างบันทึก (trigger 23503) = 409 อ่านเข้าใจได้', async () => {
  const db = fakeDb(seed)
  const realFrom = db.from.bind(db)
  db.from = (name) => {
    const b = realFrom(name)
    if (name !== 'payment_additions') return b
    const realInsert = b.insert
    b.insert = (payload) => {
      realInsert(payload)
      b.single = async () => ({ data: null, error: { code: '23503', message: 'งวดนี้ยังไม่มีบันทึกการชำระครั้งแรก' } })
      return b
    }
    return b
  }
  const res = await call(db, { method: 'POST', body: topupPayment() })
  assert.equal(res.code, 409)
  assert.equal(res.body.code, 'no_first_record')
})

test('อ่านรายการทั้งหมดทีละหน้า: เกิน 1,000 แถวก็มาครบ', async () => {
  const many = Array.from({ length: 2345 }, (_, i) => ({ id: `r${i}`, customer_id: 'CID1', topup_id: null, installment: 7, seq: i + 1, kind: 'payment', paid_at: '2026-11-01', amount: 1, voided_at: null }))
  const res = await call(fakeDb({ ...seed, payment_additions: many }), { method: 'GET' })
  assert.equal(res.code, 200)
  assert.equal(res.body.additions.length, 2345)
})

test('วิธีที่ไม่รองรับ = 405', async () => {
  assert.equal((await call(fakeDb(seed), { method: 'DELETE' })).code, 405)
})

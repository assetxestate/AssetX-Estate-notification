import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bangkokDate, dueReminders, reminderDays, normalizeStatus, buildReminderText, runAccountingReminders, writeStatus, readStatus, STATUS_PATH,
} from './accounting-reminders.js'

function fakeDb() {
  const files = new Map()
  const from = (bucket) => ({
    async list(folder) {
      const prefix = `${bucket}/${folder}/`
      return { data: [...files.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ name: k.slice(prefix.length) })), error: null }
    },
    async upload(objectPath, bytes, { upsert } = {}) {
      const key = `${bucket}/${objectPath}`
      if (files.has(key) && !upsert) return { error: { message: 'The resource already exists' } }
      files.set(key, Buffer.from(bytes))
      return { data: {}, error: null }
    },
    async download(objectPath) {
      const hit = files.get(`${bucket}/${objectPath}`)
      return hit ? { data: { arrayBuffer: async () => hit.buffer.slice(hit.byteOffset, hit.byteOffset + hit.byteLength) }, error: null } : { error: { message: 'not found' } }
    },
  })
  return { files, storage: { createBucket: async () => ({ error: null }), from } }
}

// 02:00 UTC = 09:00 เวลาไทย
const at = (day, month = 12) => new Date(Date.UTC(2026, month - 1, day, 2, 0, 0))

test('วันที่ใช้เวลาไทย: 18:00 UTC ของวันที่ 1 คือวันที่ 2 ที่ไทย', () => {
  assert.equal(bangkokDate(new Date(Date.UTC(2026, 11, 1, 18, 0, 0))).day, 2)
  assert.equal(bangkokDate(at(5)).iso, '2026-12-05')
})

test('กำหนดเตือนตั้งต้น: รอบเบิก 2, 3, 5 · เอกสารที่ยังขาด 18 · รอบเบิกที่ 2 วันที่ 21, 22', () => {
  for (const d of [2, 3, 5]) assert.deepEqual(dueReminders(bangkokDate(at(d)), {}), ['claim'])
  assert.deepEqual(dueReminders(bangkokDate(at(18)), {}), ['missing'])
  for (const d of [21, 22]) assert.deepEqual(dueReminders(bangkokDate(at(d)), {}), ['claim2'])
  for (const d of [1, 4, 6, 17, 19, 20, 23]) assert.deepEqual(dueReminders(bangkokDate(at(d)), {}), [])
  assert.deepEqual(reminderDays('claim2', {}), [21, 22])
  assert.deepEqual(dueReminders(bangkokDate(at(18)), { ACCOUNTING_CLAIM2_DAYS: '18, 20' }), ['claim2', 'missing'])
  assert.deepEqual(reminderDays('claim', { ACCOUNTING_CLAIM_DAYS: '1,x,40,4' }), [1, 4])
})

test('ไฟล์สถานะ: เก่าเกินกำหนดหรือรูปแบบผิด = ไม่มีสถานะ', () => {
  const now = at(18)
  assert.equal(normalizeStatus(null, now), null)
  assert.equal(normalizeStatus({ month: '2026-12', updated_at: '2026-09-01T00:00:00Z', missing: ['x'] }, now), null)
  const ok = normalizeStatus({ month: '2026-12', updated_at: '2026-12-10T00:00:00Z', missing: [' ค่าเช่า ', '', null], extra: 'ทิ้ง' }, now)
  assert.deepEqual(ok.missing, ['ค่าเช่า'])
  assert.equal(ok.extra, undefined)
})

test('ข้อความรอบเบิก: บอกเส้นตาย จำนวนวันที่เหลือ และรายการค้างเบิกจากไฟล์สถานะ', () => {
  const text = buildReminderText('claim', { date: bangkokDate(at(3)), status: { month: '2026-11', claims: ['ค่าโทรศัพท์'], missing: [] }, waiting: 2 })
  assert.match(text, /ไม่เกินวันที่ 6/)
  assert.match(text, /เหลือ 3 วัน/)
  assert.match(text, /• ค่าโทรศัพท์/)
  assert.match(text, /รอจัดเข้าโฟลเดอร์ 2 ไฟล์/)
  assert.match(buildReminderText('claim', { date: bangkokDate(at(2)), status: null }), /ส่งสลิปการโอนเงินและใบเสร็จ/)
  const second = buildReminderText('claim2', { date: bangkokDate(at(21)), status: null })
  assert.match(second, /รอบเบิกที่ 2/)
  assert.match(second, /ไม่เกินวันที่ 23/)
  assert.match(second, /เหลือ 2 วัน/)
  assert.doesNotMatch(buildReminderText('claim2', { date: bangkokDate(at(25)), status: null }), /เหลือ/)
})

test('ข้อความเอกสารที่ยังขาด: ใช้ชื่อเดือนแบบ พ.ศ. และไม่แต่งรายการเมื่อไม่มีสถานะ', () => {
  const text = buildReminderText('missing', { date: bangkokDate(at(18)), status: { month: '2026-11', claims: [], missing: ['ค่าเช่า: ใบเสร็จฉบับเซ็น'] } })
  assert.match(text, /เดือนพฤศจิกายน 2569/)
  assert.match(text, /• ค่าเช่า: ใบเสร็จฉบับเซ็น/)
  assert.match(buildReminderText('missing', { status: { month: '2026-11', claims: [], missing: [] } }), /ครบแล้ว/)
  assert.match(buildReminderText('missing', { status: null }), /ยังไม่มีข้อมูลสถานะ/)
})

test('รันจาก cron: วันที่ไม่ถึงกำหนดไม่ส่ง · วันถึงกำหนดส่งครั้งเดียวแม้ถูกเรียกซ้ำ', async () => {
  const db = fakeDb(); const out = []
  const send = async (t) => { out.push(t) }
  assert.deepEqual((await runAccountingReminders({ db, send, now: at(4), env: {} })).sent, [])
  assert.equal(out.length, 0)
  await writeStatus(db, { month: '2026-11', claims: [], missing: ['ค่าน้ำค่าไฟ: บิลและสลิป'] }, at(1))
  assert.deepEqual((await runAccountingReminders({ db, send, now: at(18), env: {} })).sent, ['missing'])
  const again = await runAccountingReminders({ db, send, now: at(18), env: {} })
  assert.deepEqual(again.sent, [])
  assert.deepEqual(again.skipped, ['missing'])
  assert.equal(out.length, 1)
  assert.match(out[0], /ค่าน้ำค่าไฟ/)
  assert.ok(db.files.has('accounting-inbox/reminders/heartbeat.json'))
})

test('สั่งส่งเอง (force) ไม่ทิ้งไฟล์กันซ้ำ จึงไม่กินโควตาของวันจริง', async () => {
  const db = fakeDb(); const out = []
  await runAccountingReminders({ db, send: async (t) => { out.push(t) }, now: at(18), env: {}, force: ['claim'] })
  assert.equal(out.length, 1)
  assert.equal([...db.files.keys()].filter((k) => k.includes('/reminders/sent/')).length, 0)
})

test('เขียนแล้วอ่านสถานะกลับได้ตรง', async () => {
  const db = fakeDb()
  await writeStatus(db, { month: '2026-11', claims: ['ก'], missing: ['ข'] }, at(1))
  assert.ok(db.files.has(`accounting-inbox/${STATUS_PATH}`))
  assert.deepEqual((await readStatus(db, at(2))).claims, ['ก'])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeLeadImage, uploadLeadFile, createLeadFilesHandler, freshLead, leadIdOf, kindOfFile, LEAD_FILE_MAX, LEAD_FILE_LIMIT } from './leadFiles.js'
import { fitSize, isImageFile } from '../src/lib/leadImage.js'
import { buildBrokerReply, replyHours, leadNotifyText } from '../src/lib/leadSource.js'

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]).toString('base64')
const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(32, 1)]).toString('base64')
const NOW = Date.parse('2026-11-18T05:00:00Z')

// ฐานข้อมูลปลอม: valuations หนึ่งแถว + storage ที่จำไฟล์ไว้ในหน่วยความจำ
function fakeDb({ row, files = [], uploadError = null } = {}) {
  const store = files.map((name, i) => ({ name, id: `f${i}` }))
  return {
    store,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row ?? null, error: null }) }) }) }),
    storage: { from: () => ({
      list: async () => ({ data: store, error: null }),
      upload: async (path) => { if (uploadError) return { error: uploadError }; store.push({ name: path.split('/')[1], id: path }); return { error: null } },
      createSignedUrls: async (paths) => ({ data: paths.map((p) => ({ signedUrl: `https://signed/${p}` })), error: null }),
    }) },
  }
}
const lead = (over = {}) => ({ id: 7, status: 'Lead จากเว็บ', created_at: new Date(NOW - 60000).toISOString(), ...over })

test('ตรวจชนิดรูปจากเนื้อไฟล์ ไม่เชื่อชนิดที่หน้าเว็บบอก', () => {
  assert.equal(decodeLeadImage({ kind: 'deed', base64: JPEG }).type, 'image/jpeg')
  assert.equal(decodeLeadImage({ kind: 'property', base64: PNG }).extension, 'png')
  assert.throws(() => decodeLeadImage({ kind: 'deed', base64: Buffer.from('<script>alert(1)</script>').toString('base64') }))
  assert.throws(() => decodeLeadImage({ kind: 'deed', base64: Buffer.from('%PDF-1.7 ......').toString('base64') }))
  assert.throws(() => decodeLeadImage({ kind: 'other', base64: JPEG }))
  assert.throws(() => decodeLeadImage({ kind: 'deed', base64: 'ไม่ใช่ base64' }))
  assert.throws(() => decodeLeadImage({ kind: 'deed', base64: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(LEAD_FILE_LIMIT + 10)]).toString('base64') }))
  assert.throws(() => decodeLeadImage(null))
})

test('รับรูปเฉพาะ lead จากเว็บที่เพิ่งสร้าง', async () => {
  const ok = fakeDb({ row: lead() })
  assert.deepEqual(await uploadLeadFile({ id: 7, file: { kind: 'deed', base64: JPEG }, db: ok, now: NOW }), { ok: true, count: 1 })
  assert.match(ok.store[0].name, /^deed-[0-9a-f-]{36}\.jpg$/)

  for (const row of [null, lead({ status: 'รอการพิจารณา' }), lead({ created_at: new Date(NOW - 3600e3).toISOString() }), lead({ created_at: new Date(NOW + 60e3).toISOString() })]) {
    const db = fakeDb({ row })
    const result = await uploadLeadFile({ id: 7, file: { kind: 'deed', base64: JPEG }, db, now: NOW })
    assert.equal(result.ok, false)
    assert.equal(db.store.length, 0)
  }
})

test('จำกัดจำนวนรูปต่อรายการ และปฏิเสธเลขรายการหรือไฟล์ที่ผิด', async () => {
  const full = fakeDb({ row: lead(), files: Array.from({ length: LEAD_FILE_MAX }, (_, i) => `deed-${i}.jpg`) })
  assert.equal((await uploadLeadFile({ id: 7, file: { kind: 'deed', base64: JPEG }, db: full, now: NOW })).ok, false)
  assert.equal(full.store.length, LEAD_FILE_MAX)
  const db = fakeDb({ row: lead() })
  assert.equal((await uploadLeadFile({ id: 'x', file: { kind: 'deed', base64: JPEG }, db, now: NOW })).ok, false)
  assert.equal((await uploadLeadFile({ id: 7, file: { kind: 'deed', base64: 'AAAA' }, db, now: NOW })).ok, false)
  assert.equal((await uploadLeadFile({ id: 7, file: { kind: 'deed', base64: JPEG }, db: fakeDb({ row: lead(), uploadError: new Error('x') }), now: NOW })).ok, false)
  assert.equal(leadIdOf('12'), 12)
  assert.equal(leadIdOf('-1'), 0)
  assert.equal(leadIdOf('1.5'), 0)
})

test('freshLead คืนแถวเฉพาะที่ยังอยู่ในช่วงเวลา', async () => {
  assert.equal((await freshLead(fakeDb({ row: lead() }), 7, { now: NOW })).id, 7)
  assert.equal(await freshLead(fakeDb({ row: lead({ status: 'ยกเลิก' }) }), 7, { now: NOW }), null)
})

function call(handler, { method = 'GET', url = '/api/lead-files?id=7' } = {}) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v }, status(code) { this.code = code; return this }, json(body) { resolve({ code: this.code, body, headers: this.headers }) } }
    handler({ method, url, headers: {} }, res)
  })
}

test('ดูรูปแนบต้องล็อกอิน และได้ลิงก์ชั่วคราวพร้อมชนิดรูป', async () => {
  const db = fakeDb({ row: lead(), files: ['deed-a.jpg', 'property-b.jpg'] })
  assert.equal((await call(createLeadFilesHandler({ authorized: () => false, database: () => db }))).code, 401)
  const handler = createLeadFilesHandler({ authorized: () => true, database: () => db })
  const ok = await call(handler)
  assert.equal(ok.code, 200)
  assert.equal(ok.headers['Cache-Control'], 'no-store')
  assert.deepEqual(ok.body.files.map((f) => [f.kind, f.label, f.url]), [
    ['deed', 'เอกสารสิทธิ์', 'https://signed/7/deed-a.jpg'],
    ['property', 'รูปทรัพย์', 'https://signed/7/property-b.jpg'],
  ])
  assert.equal((await call(handler, { url: '/api/lead-files?id=abc' })).code, 400)
  assert.equal((await call(handler, { method: 'POST' })).code, 405)
  assert.deepEqual((await call(createLeadFilesHandler({ authorized: () => true, database: () => fakeDb({ row: lead() }) }))).body, { files: [] })
  assert.equal((await call(createLeadFilesHandler({ authorized: () => true, database: () => null }))).code, 503)
  assert.equal(kindOfFile('deed-x.jpg'), 'deed')
  assert.equal(kindOfFile('property-x.jpg'), 'property')
})

test('ย่อรูปคงสัดส่วน ด้านยาวไม่เกิน 2000', () => {
  assert.deepEqual(fitSize(4000, 3000), { width: 2000, height: 1500 })
  assert.deepEqual(fitSize(3000, 4000), { width: 1500, height: 2000 })
  assert.deepEqual(fitSize(800, 600), { width: 800, height: 600 })
  assert.deepEqual(fitSize(0, 0), { width: 1, height: 1 })
  assert.equal(isImageFile({ type: 'image/jpeg', name: 'a.jpg' }), true)
  assert.equal(isImageFile({ type: '', name: 'IMG_1.HEIC' }), true)
  assert.equal(isImageFile({ type: 'application/pdf', name: 'a.pdf' }), false)
})

test('ข้อความตอบผล: ไม่มีอัตราดอกเบี้ย วงเงินมาจากที่เจ้าของพิมพ์ และกำกับว่ายังไม่ใช่วงเงินอนุมัติ', () => {
  const leadInfo = { ticketNo: 'AX-00020', name: 'ทดสอบ', assessmentType: 'ขายฝาก', propertySubtype: 'บ้านแฝด', district: 'คลองสาน', province: 'กรุงเทพมหานคร', totalSqw: 430, requestedLoan: 1000000 }
  const yes = buildBrokerReply(leadInfo, { result: 'interested', amount: '800000' }, { phone: '096-986-8888', line: 'assetxestate' })
  assert.match(yes, /^เรียนคุณทดสอบ\nผลประเมินเบื้องต้น เลขรับเรื่อง AX-00020/)
  assert.match(yes, /เนื้อที่ 1-0-30 ไร่/)
  assert.match(yes, /วงเงินเบื้องต้น: 800,000 บาท \(ยังไม่ใช่วงเงินอนุมัติ/)
  assert.match(yes, /โทร 096-986-8888 · LINE assetxestate$/)
  assert.doesNotMatch(yes, /ดอกเบี้ย|%|undefined|null|false/)
  assert.doesNotMatch(buildBrokerReply(leadInfo, { result: 'interested' }), /วงเงินเบื้องต้น/)

  const more = buildBrokerReply(leadInfo, { result: 'need-info', needs: ['deed', 'burden'], note: ' ขอภายในพรุ่งนี้ ' })
  assert.match(more, /ขอรบกวนส่ง:\n1\. รูปเอกสารสิทธิ์หน้า-หลังที่อ่านชัด\n2\. ภาระเดิมและยอดที่ต้องไถ่ถอน/)
  assert.match(more, /\n\nขอภายในพรุ่งนี้\n\nAssetX Estate$/)

  const no = buildBrokerReply({ name: '' }, { result: 'declined' })
  assert.match(no, /^เรียนคุณลูกค้า/)
  assert.match(no, /ขออนุญาตไม่รับรายการนี้/)
  assert.doesNotMatch(no, /\n\n\n/)
  assert.match(buildBrokerReply(leadInfo, { result: 'อะไรก็ได้' }), /ผล: รับพิจารณา/)
})

test('เวลาที่ใช้ตอบ และจำนวนรูปในข้อความแจ้งเตือน', () => {
  assert.equal(replyHours('2026-11-18T04:00:00Z', '2026-11-18T07:30:00Z'), 3.5)
  assert.equal(replyHours('2026-11-18T04:00:00Z', '2026-11-18T03:00:00Z'), null)
  assert.equal(replyHours('', ''), null)
  assert.match(leadNotifyText({ id: 5 }, { files: 3 }), /แนบรูป 3 รูป/)
  assert.doesNotMatch(leadNotifyText({ id: 5 }), /แนบรูป/)
})

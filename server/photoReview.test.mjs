// AI อ่านรูปทรัพย์: ส่งเฉพาะรูปทรัพย์ ไม่ส่งรูปเอกสารสิทธิ์ ไม่ส่งข้อมูลส่วนบุคคล และตัดข้อที่ AI ออกนอกหน้าที่
// ข้อมูลในเทสต์เป็นข้อมูลสมมติทั้งหมด
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { photoReviewFacts, buildPhotoReviewPrompt, normalizePhotoReview, photoReviewText, photoReviewWait, PHOTO_REVIEW_CAVEAT, PHOTO_REVIEW_MAX_IMAGES } from '../src/lib/photoReview.js'
import { requestPhotoReview, processPhotoReview, readReviewState, nextQueuedReview, runPhotoReviewLoop, isPropertyPhoto, reviewPath, queuePath } from './photoReview.js'
import { createLeadFilesHandler } from './leadFiles.js'

const ROW = {
  id: 7, status: 'Lead จากเว็บ', assessment_type: 'ขายฝาก', property_type: 'ที่ดิน', property_subtype: 'ที่ดินเปล่า (โฉนด)',
  province: 'กรุงเทพมหานคร', district: 'ดอนเมือง', subdistrict: 'สีกัน', total_sqw: 722, road_type: 'ติดถนนใหญ่', road_width: 12,
  risks: { hardAccess: false, noUtilities: true },
  deeds: [{ titleDeedNo: '99999', docType: 'chanote' }],
  contact_name: 'สมมติ ทดสอบ', contact_phone: '0800000000', contact_line: 'testline', lat: 13.9, lng: 100.6, requested_loan: 1500000, gov_price: 20000,
}

const ANSWER = {
  summary: 'รูปแสดงที่ดินมีอาคารชั้นเดียวอยู่ด้านใน ติดซอยคอนกรีต',
  observations: [
    { topic: 'สิ่งปลูกสร้าง', seen: 'มีอาคารชั้นเดียวหลังคากระเบื้อง', photos: [1, 2, 9], confidence: 'high' },
    { topic: 'ถนนหน้าทรัพย์', seen: 'ซอยคอนกรีตกว้างประมาณ 4 เมตร', photos: [3], confidence: 'sure' },
    { topic: 'มูลค่า', seen: 'น่าจะขายได้ราว 5 ล้านบาท', photos: [1], confidence: 'high' },
    { topic: 'ป้าย', seen: 'มีป้ายติดต่อ 081-234-5678', photos: [2], confidence: 'medium' },
  ],
  mismatches: [
    { field: 'ประเภททรัพย์', entered: 'ที่ดินเปล่า (โฉนด)', seen: 'มีอาคารอยู่บนที่ดิน', photos: [1] },
    { field: 'วงเงิน', entered: '', seen: 'ควรรับที่วงเงินต่ำ', photos: [] },
  ],
  cannot_tell: ['แนวเขตแปลง', 'ราคาซื้อขายแถวนี้'],
  check_on_site: ['ขอรูปถนนหน้าทรัพย์ให้เห็นความกว้าง'],
  photo_quality: 'รูปชัด แต่ไม่มีรูปมุมกว้าง',
}

// ที่เก็บไฟล์ปลอมในหน่วยความจำ
function fakeDb({ row = ROW, files = {} } = {}) {
  const store = new Map(Object.entries(files))
  const asked = []
  return {
    store, asked,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
    storage: { from: () => ({
      // เหมือนที่เก็บจริง: คืนเฉพาะไฟล์ชั้นถัดไป รองรับ search · sortBy name · limit
      list: async (folder, { search = '', sortBy, limit = 100 } = {}) => {
        let names = [...store.keys()].filter((p) => p.startsWith(`${folder}/`)).map((p) => p.slice(folder.length + 1)).filter((n) => !n.includes('/') && n.includes(search)).sort()
        if (sortBy?.order === 'desc') names = names.reverse()
        return { data: names.slice(0, limit).map((name) => ({ name, id: `${folder}/${name}` })), error: null }
      },
      download: async (path) => { asked.push(path); return store.has(path) ? { data: new Blob([store.get(path)]), error: null } : { data: null, error: { message: 'not found' } } },
      // ห้ามเขียนทับ: ที่เก็บจริงแคชไฟล์ที่ถูกเขียนทับ อ่านแล้วได้ของเก่า
      upload: async (file, bytes, options = {}) => { if (store.has(file) || options.upsert) return { error: { message: 'เทสต์: ห้ามเขียนทับไฟล์เดิม' } }; store.set(file, Buffer.from(bytes)); return { error: null } },
      remove: async (paths) => { for (const p of paths) store.delete(p); return { error: null } },
      createBucket: undefined,
      createSignedUrls: async (paths) => ({ data: paths.map((p) => ({ signedUrl: `https://signed/${p}` })), error: null }),
    }) },
  }
}
const IMG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
const listOf = (db, id) => [...db.store.keys()].filter((p) => p.startsWith(`${id}/`)).map((p) => ({ name: p.split('/')[1] }))

test('ข้อมูลที่ส่งให้ AI ไม่มีชื่อ เบอร์ LINE เลขเอกสารสิทธิ์ พิกัด หรือตัวเลขเงิน', () => {
  const facts = photoReviewFacts(ROW)
  const prompt = buildPhotoReviewPrompt(facts, 3)
  for (const secret of ['สมมติ ทดสอบ', '0800000000', 'testline', '99999', '13.9', '100.6', '1500000', '1,500,000', '20000', '20,000']) assert.ok(!prompt.includes(secret), secret)
  assert.match(prompt, /ประเภททรัพย์: ที่ดิน · ที่ดินเปล่า \(โฉนด\)/)
  assert.match(prompt, /ประเภทเอกสารสิทธิ์: โฉนด/)
  assert.match(prompt, /เนื้อที่รวม: 722 ตารางวา/)
  assert.match(prompt, /ปัจจัยเสี่ยงที่ผู้ส่งติ๊ก: ไม่มีสาธารณูปโภค/)
  assert.match(prompt, /มีรูปทรัพย์ 3 รูป/)
  assert.match(buildPhotoReviewPrompt([], 1), /ไม่ได้กรอกข้อมูลที่เทียบกับรูปได้/)
})

test('ผลของ AI: ตัดข้อที่ตั้งราคาหรือตัดสิน ตัดเลขยาว และคุมเลขรูปให้อยู่ในช่วง', () => {
  const review = normalizePhotoReview(JSON.stringify(ANSWER), { imageCount: 3 })
  assert.deepEqual(review.observations.map((o) => o.topic), ['สิ่งปลูกสร้าง', 'ถนนหน้าทรัพย์', 'ป้าย'])
  assert.deepEqual(review.observations[0].photos, [1, 2])
  assert.equal(review.observations[1].confidence, 'low')
  assert.ok(!review.observations[2].seen.includes('081'))
  assert.deepEqual(review.mismatches.map((m) => m.field), ['ประเภททรัพย์'])
  assert.deepEqual(review.cannotTell, ['แนวเขตแปลง'])
  const text = photoReviewText(review)
  assert.ok(!/บาท|วงเงิน|081/.test(text))
  assert.match(text, /กรอกว่า ที่ดินเปล่า \(โฉนด\) · ในรูปเห็น มีอาคารอยู่บนที่ดิน \(รูปทรัพย์ที่ 1\)/)
  assert.ok(text.endsWith(PHOTO_REVIEW_CAVEAT))
  // คำตอบที่มีข้อความครอบ JSON ยังอ่านได้ · คำตอบที่ไม่ใช่ JSON หรือว่างเปล่าไม่ผ่าน
  assert.equal(normalizePhotoReview('```json\n{"summary":"ที่ดินโล่ง"}\n```').summary, 'ที่ดินโล่ง')
  assert.throws(() => normalizePhotoReview('ขออภัย อ่านรูปไม่ได้'))
  assert.throws(() => normalizePhotoReview({ summary: 'ราคาประมาณ 3 ล้านบาท', observations: [] }))
})

test('กดขอ: เข้าคิวเฉพาะรายการที่มีรูปทรัพย์ · ขอซ้ำระหว่างรอได้คำขอเดิม', async () => {
  const onlyDeed = fakeDb({ files: { '7/deed-a.jpg': IMG } })
  const none = await requestPhotoReview({ db: onlyDeed, id: 7, files: listOf(onlyDeed, 7) })
  assert.equal(none.status, 400)
  assert.equal([...onlyDeed.store.keys()].some((p) => p.startsWith('review-queue/')), false)
  const db = fakeDb({ files: { '7/deed-a.jpg': IMG, '7/property-b.jpg': IMG } })
  const first = await requestPhotoReview({ db, id: 7, files: listOf(db, 7), now: () => new Date('2026-11-20T03:00:00Z') })
  assert.deepEqual(first, { ok: true, pending: { requestedAt: '2026-11-20T03:00:00.000Z' } })
  const again = await requestPhotoReview({ db, id: 7, files: listOf(db, 7), now: () => new Date('2026-11-20T03:04:00Z') })
  assert.equal(again.pending.requestedAt, '2026-11-20T03:00:00.000Z')
  assert.deepEqual(await readReviewState(db, 7), { review: null, pending: { requestedAt: '2026-11-20T03:00:00.000Z' } })
  assert.equal(await nextQueuedReview(db), 7)
  assert.equal((await requestPhotoReview({ db: fakeDb({ row: null }), id: 9, files: [] })).status, 404)
})

test('ตัวรับงาน: ส่งให้ AI เฉพาะรูปทรัพย์ รูปเอกสารสิทธิ์ไม่ถูกเปิด ลบรูปชั่วคราว และเอาคำขอออกจากคิว', async () => {
  const db = fakeDb({ files: { '7/deed-a.jpg': IMG, '7/property-b.jpg': IMG, '7/property-c.png': IMG } })
  await requestPhotoReview({ db, id: 7, files: listOf(db, 7) })
  let seen
  const ask = async (input) => { seen = { ...input, names: readdirSync(input.workDir), existed: input.imagePaths.every((p) => existsSync(p)) }; return { text: JSON.stringify(ANSWER), model: 'fake-model' } }
  const result = await processPhotoReview({ db, id: 7, ask, now: () => new Date('2026-11-20T03:01:00Z') })
  assert.equal(result.ok, true)
  assert.deepEqual(seen.names.sort(), ['photo-1.jpg', 'photo-2.png'])
  assert.equal(seen.existed, true)
  assert.equal(existsSync(seen.workDir), false)
  assert.ok(seen.imagePaths.every((p) => path.dirname(p) === seen.workDir))
  assert.ok(!db.asked.some((p) => p.includes('deed-')))
  assert.match(seen.prompt, /มีรูปทรัพย์ 2 รูป/)
  const state = await readReviewState(db, 7)
  assert.equal(state.pending, null)
  assert.equal(state.review.summary, ANSWER.summary)
  assert.equal(state.review.model, 'fake-model')
  assert.deepEqual(state.review.photos, ['property-b.jpg', 'property-c.png'])
  assert.equal(reviewPath(7, 1234), 'reviews/7/000000000001234.json')
  assert.equal(queuePath(7, 1234), 'review-queue/7-1234.json')
  assert.equal(isPropertyPhoto('deed-a.jpg'), false)
  assert.equal(isPropertyPhoto('property-../x.jpg'), false)
})

test('ตัวรับงาน: AI ล้ม = เก็บเหตุผลไว้กับผลเดิม ไม่ทิ้งผลเก่า และคิวไม่ค้าง · รูปเกินจำนวนถูกนับเป็นข้าม', async () => {
  const db = fakeDb({ files: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`7/property-${i}.jpg`, IMG])) })
  const good = await processPhotoReview({ db, id: 7, ask: async () => ({ text: JSON.stringify(ANSWER), model: 'm' }), now: () => new Date('2026-11-20T03:30:00Z') })
  assert.equal(good.review.photos.length, PHOTO_REVIEW_MAX_IMAGES)
  assert.equal(good.review.skipped, 2)
  await requestPhotoReview({ db, id: 7, files: listOf(db, 7), now: () => new Date('2026-11-20T03:59:00Z') })
  const bad = await processPhotoReview({ db, id: 7, ask: async () => { throw new Error('Codex exit 1: not logged in') }, now: () => new Date('2026-11-20T04:00:00Z') })
  assert.equal(bad.ok, false)
  const state = await readReviewState(db, 7)
  assert.equal(state.pending, null)
  assert.equal(state.review.summary, ANSWER.summary)
  assert.deepEqual(state.review.lastError, { message: 'Codex exit 1: not logged in', at: '2026-11-20T04:00:00.000Z' })
  // คำตอบที่ไม่ใช่โครงที่กำหนดก็นับเป็นล้ม
  await processPhotoReview({ db, id: 7, ask: async () => ({ text: 'ขออภัย' }), now: () => new Date('2026-11-20T05:00:00Z') })
  assert.match((await readReviewState(db, 7)).review.lastError.message, /โครงที่กำหนด/)
  // อ่านใหม่สำเร็จ: ได้ผลใหม่ ไม่มีข้อผิดพลาดค้าง · ทุกผลเป็นไฟล์ใหม่ (ไม่เขียนทับ)
  await processPhotoReview({ db, id: 7, ask: async () => ({ text: JSON.stringify({ ...ANSWER, summary: 'ผลรอบใหม่' }), model: 'm' }), now: () => new Date('2026-11-20T06:00:00Z') })
  const fresh = (await readReviewState(db, 7)).review
  assert.equal(fresh.summary, 'ผลรอบใหม่')
  assert.equal(fresh.lastError, undefined)
  assert.equal([...db.store.keys()].filter((p) => p.startsWith('reviews/7/')).length, 4)
})

test('คิว: เลขรายการที่ขึ้นต้นเหมือนกันไม่ปนกัน และหยิบคำขอเก่าสุดก่อน', async () => {
  const db = fakeDb({ files: { '2/property-a.jpg': IMG, '21/property-b.jpg': IMG } })
  await requestPhotoReview({ db, id: 21, files: listOf(db, 21), now: () => new Date('2026-11-20T03:00:00Z') })
  assert.equal((await readReviewState(db, 2)).pending, null)
  await requestPhotoReview({ db, id: 2, files: listOf(db, 2), now: () => new Date('2026-11-20T03:05:00Z') })
  assert.equal((await readReviewState(db, 2)).pending.requestedAt, '2026-11-20T03:05:00.000Z')
  assert.equal(await nextQueuedReview(db), 21)
  await processPhotoReview({ db, id: 21, ask: async () => ({ text: JSON.stringify(ANSWER), model: 'm' }) })
  assert.equal(await nextQueuedReview(db), 2)
  assert.equal((await readReviewState(db, 2)).review, null)
})

test('ลูปตัวรับงาน: หยิบคำขอในคิวทีละรายการจนหมด', async () => {
  const db = fakeDb({ files: { '7/property-b.jpg': IMG, '8/property-x.jpg': IMG } })
  await requestPhotoReview({ db, id: 7, files: listOf(db, 7) })
  await requestPhotoReview({ db, id: 8, files: listOf(db, 8) })
  const done = []
  let stop = false
  await runPhotoReviewLoop({ db, pollMs: 5, isStopping: () => stop, ask: async () => ({ text: JSON.stringify(ANSWER), model: 'm' }), onBusy: (id) => { if (id) done.push(id); else if (done.length === 2) stop = true } })
  assert.deepEqual(done.sort(), [7, 8])
  assert.equal(await nextQueuedReview(db), 0)
})

test('ข้อความระหว่างรอ: เกิน 5 นาทีบอกว่าคอมสำนักงานอาจปิด', () => {
  const at = '2026-11-20T03:00:00Z'
  assert.equal(photoReviewWait(at, Date.parse(at) + 30000).late, false)
  assert.match(photoReviewWait(at, Date.parse(at) + 130000).text, /รอมาแล้ว 2 นาที/)
  const late = photoReviewWait(at, Date.parse(at) + 6 * 60000)
  assert.equal(late.late, true)
  assert.match(late.text, /คอมสำนักงานอาจปิด/)
  assert.equal(photoReviewWait('ไม่ใช่วันที่'), null)
})

function call(handler, { method = 'GET', url = '/api/lead-files?id=7', body } = {}) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v }, status(code) { this.code = code; return this }, json(data) { resolve({ code: this.code, body: data }) } }
    handler({ method, url, headers: {}, body }, res)
  })
}

test('API: ต้องล็อกอิน · กดแล้วเข้าคิว · ถามสถานะได้ทั้งระหว่างรอและหลังเสร็จ', async () => {
  const db = fakeDb({ files: { '7/property-b.jpg': IMG } })
  const post = { method: 'POST', url: '/api/lead-files', body: { id: 7, action: 'analyze' } }
  assert.equal((await call(createLeadFilesHandler({ authorized: () => false, database: () => db }), post)).code, 401)
  const handler = createLeadFilesHandler({ authorized: () => true, database: () => db })
  const queued = await call(handler, post)
  assert.equal(queued.code, 200)
  assert.ok(queued.body.pending.requestedAt)
  assert.deepEqual((await call(handler, { url: '/api/lead-files?id=7&review=1' })).body, { review: null, pending: queued.body.pending })
  assert.deepEqual((await call(handler)).body.pending, queued.body.pending)
  await processPhotoReview({ db, id: 7, ask: async () => ({ text: JSON.stringify(ANSWER), model: 'm' }) })
  const after = (await call(handler, { url: '/api/lead-files?id=7&review=1' })).body
  assert.equal(after.pending, null)
  assert.equal(after.review.mismatches.length, 1)
  assert.equal((await call(handler, { ...post, body: { id: 7, action: 'delete' } })).code, 400)
})

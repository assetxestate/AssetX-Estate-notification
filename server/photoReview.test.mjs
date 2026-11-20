// AI อ่านรูปทรัพย์: ส่งเฉพาะรูปทรัพย์ ไม่ส่งรูปเอกสารสิทธิ์ ไม่ส่งข้อมูลส่วนบุคคล และตัดข้อที่ AI ออกนอกหน้าที่
// ข้อมูลในเทสต์เป็นข้อมูลสมมติทั้งหมด
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { photoReviewFacts, photoReviewEntered, photoReviewImpact, photoFieldLine, buildPhotoReviewPrompt, normalizePhotoReview, photoReviewText, photoReviewWait, PHOTO_REVIEW_CAVEAT, PHOTO_REVIEW_MAX_IMAGES } from '../src/lib/photoReview.js'
import { RISK_FACTORS } from '../src/lib/valuationOptions.js'
import { requestPhotoReview, processPhotoReview, readReviewState, nextQueuedReview, runPhotoReviewLoop, isPropertyPhoto, reviewPath, queuePath } from './photoReview.js'
import { createLeadFilesHandler } from './leadFiles.js'

const ROW = {
  id: 7, status: 'Lead จากเว็บ', assessment_type: 'ขายฝาก', property_type: 'ที่ดิน', property_subtype: 'ที่ดินเปล่า (โฉนด)',
  province: 'กรุงเทพมหานคร', district: 'ดอนเมือง', subdistrict: 'สีกัน', total_sqw: 722, road_type: 'ติดถนนหลัก 2 เลน (สายหลัก)', road_width: '6–7 ม. (คสล./ลาดยาง)', soil_condition: 'ถมเรียบร้อย ระดับดี / ใช้ได้เลย',
  risks: { hardAccess: false, noUtilities: true },
  deeds: [{ titleDeedNo: '99999', docType: 'chanote' }],
  contact_name: 'สมมติ ทดสอบ', contact_phone: '0800000000', contact_line: 'testline', lat: 13.9, lng: 100.6, requested_loan: 1500000, gov_price: 20000,
}

const ANSWER = {
  summary: 'รูปชี้ว่าทางเข้าแคบกว่าที่กรอกและมีคนใช้พื้นที่อยู่',
  fields: [
    { field: 'roadType', suggest: 'ซอยตัน / ปลายซอย', evidence: 'ทางสิ้นสุดที่หน้าแปลง', photos: [1, 9], confidence: 'high' },
    { field: 'roadWidth', suggest: '12–19 ม.', evidence: 'ถนนดูกว้าง', photos: [2], confidence: 'sure' },
    { field: 'soilCondition', suggest: 'ถมเรียบร้อย ระดับดี / ใช้ได้เลย', evidence: 'พื้นเสมอถนน', photos: [3], confidence: 'medium' },
    { field: 'landFrontage', suggest: 'กว้างมาก', evidence: 'ตัวเลือกนี้ไม่มีในฟอร์ม', photos: [1], confidence: 'high' },
    { field: 'roadType', suggest: 'ซอยสั้น < 100ม. ออกถนนใหญ่', evidence: 'ช่องซ้ำ', photos: [1], confidence: 'high' },
  ],
  risks: [
    { key: 'nuisance', evidence: 'เห็นเสาไฟฟ้าแรงสูงติดแปลง', photos: [2], confidence: 'high' },
    { key: 'noUtilities', evidence: 'ไม่เห็นเสาไฟและมิเตอร์', photos: [1], confidence: 'medium' },
    { key: 'ghost', evidence: 'ไม่มีคีย์นี้', photos: [1], confidence: 'high' },
  ],
  flags: [
    { topic: 'occupancy', finding: 'มีรถจอดและของใช้ในลาน', effect: 'risk', affects: ['liquidity', 'legal', 'cost', 'x'], action: 'ถามว่าใครใช้พื้นที่และส่งมอบได้เมื่อใด', photos: [3], confidence: 'high' },
    { topic: 'structure', finding: 'ขายได้ราว 5 ล้านบาท', effect: 'support', affects: ['fsv'], action: '', photos: [1], confidence: 'high' },
    { topic: 'sign', finding: 'มีป้ายติดต่อ 081-234-5678', effect: 'neutral', affects: [], action: 'ควรรับที่วงเงินต่ำ', photos: [2], confidence: 'medium' },
    { topic: 'access', finding: 'มีป้ายบอกทาง 081-234-5678 หน้าซอย', effect: 'support', affects: ['liquidity'], action: 'ตรวจเส้นทาง', photos: [2], confidence: 'medium' },
  ],
  mismatches: [
    { field: 'ประเภททรัพย์', entered: 'ที่ดินเปล่า (โฉนด)', seen: 'มีอาคารอยู่บนที่ดิน', photos: [1] },
    { field: 'วงเงิน', entered: '', seen: 'ควรรับที่วงเงินต่ำ', photos: [] },
  ],
  need_photos: ['รูปถนนหน้าทรัพย์มุมกว้าง เพื่อตัดสินความกว้างถนน', 'รูปที่ช่วยตั้งราคาตลาดแถวนี้'],
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
  assert.match(prompt, /ลักษณะถนน\/ทำเล: ติดถนนหลัก 2 เลน/)
  // ตัวเลือกของฟอร์มและคีย์ปัจจัยเสี่ยงต้องอยู่ในคำสั่ง ให้ AI เลือกจากของจริง
  assert.ok(prompt.includes('  - ซอยตัน / ปลายซอย'))
  assert.ok(prompt.includes('  - nuisance: '))
  assert.deepEqual(photoReviewEntered(ROW), { fields: { roadType: 'ติดถนนหลัก 2 เลน (สายหลัก)', roadWidth: '6–7 ม. (คสล./ลาดยาง)', landFrontage: '', soilCondition: 'ถมเรียบร้อย ระดับดี / ใช้ได้เลย' }, risks: ['noUtilities'] })
  assert.match(buildPhotoReviewPrompt([], 1), /ไม่ได้กรอกข้อมูลที่เทียบกับรูปได้/)
})

test('ผลของ AI: รับเฉพาะตัวเลือกที่มีในฟอร์ม ตัดข้อที่ตั้งราคาหรือตัดสิน ตัดเลขยาว และคุมเลขรูป', () => {
  const review = normalizePhotoReview(JSON.stringify(ANSWER), { imageCount: 3 })
  assert.deepEqual(review.fields.map((f) => [f.field, f.suggest]), [['roadType', 'ซอยตัน / ปลายซอย'], ['roadWidth', '12–19 ม.'], ['soilCondition', 'ถมเรียบร้อย ระดับดี / ใช้ได้เลย']])
  assert.deepEqual(review.fields[0].photos, [1])
  assert.equal(review.fields[1].confidence, 'low')
  assert.deepEqual(review.risks.map((r) => r.key), ['nuisance', 'noUtilities'])
  assert.deepEqual(review.flags.map((f) => f.topic), ['occupancy', 'access'])
  assert.deepEqual(review.flags[0].affects, ['liquidity', 'legal'])
  assert.ok(!review.flags[1].finding.includes('081'))
  assert.deepEqual(review.mismatches.map((m) => m.field), ['ประเภททรัพย์'])
  assert.deepEqual(review.needPhotos, ['รูปถนนหน้าทรัพย์มุมกว้าง เพื่อตัดสินความกว้างถนน'])
  // คำตอบที่มีข้อความครอบ JSON ยังอ่านได้ · คำตอบที่ไม่ใช่ JSON หรือว่างเปล่าไม่ผ่าน
  assert.equal(normalizePhotoReview('```json\n{"summary":"รูปชุดนี้ไม่เปลี่ยนการประเมิน"}\n```').summary, 'รูปชุดนี้ไม่เปลี่ยนการประเมิน')
  assert.throws(() => normalizePhotoReview('ขออภัย อ่านรูปไม่ได้'))
  assert.throws(() => normalizePhotoReview({ summary: 'ราคาประมาณ 3 ล้านบาท', flags: [] }))
})

test('ผลต่อการประเมิน: ตัวคูณและคะแนนมาจากตารางของระบบ และไม่เสนอปรับขึ้นจากรูป', () => {
  const review = { ...normalizePhotoReview(ANSWER, { imageCount: 3 }), entered: photoReviewEntered(ROW) }
  const impact = photoReviewImpact(review)
  const byField = Object.fromEntries(impact.fields.map((f) => [f.field, f]))
  // ถนนหลัก 2 เลน (×1.05) → ซอยตัน (×0.62): รูปขัดกับที่กรอก ราคาที่คำนวณลดลง
  assert.equal(byField.roadType.status, 'differs')
  assert.equal(byField.roadType.direction, 'down')
  assert.deepEqual([byField.roadType.factorFrom, byField.roadType.factorTo], [1.05, 0.62])
  assert.match(photoFieldLine(byField.roadType), /ตัวคูณ ×1\.05 → ×0\.62 \(ราคาที่ระบบคำนวณลดลง\)/)
  // 6–7 ม. (×0.90) → 12–19 ม. (×1.00): ทางขึ้น ไม่นับเป็นข้อควรปรับ
  assert.equal(byField.roadWidth.status, 'upward')
  assert.match(photoFieldLine(byField.roadWidth), /ระบบไม่เสนอให้ปรับขึ้นจากรูป/)
  assert.equal(byField.soilCondition.status, 'same')
  const risks = Object.fromEntries(impact.risks.map((r) => [r.key, r]))
  assert.equal(risks.nuisance.ticked, false)
  assert.equal(risks.nuisance.score, RISK_FACTORS.find((r) => r.key === 'nuisance').score)
  assert.equal(risks.noUtilities.ticked, true)
  assert.equal(impact.changes, 2)
  assert.equal(impact.addedRiskScore, risks.nuisance.score)
  // ช่องที่ยังไม่ได้กรอก = เสนอให้เติม
  const empty = photoReviewImpact({ fields: [{ field: 'landFrontage', suggest: '5–7 ม.', evidence: 'หน้าแปลงแคบ', photos: [1], confidence: 'medium' }], risks: [] }, photoReviewEntered(ROW))
  assert.equal(empty.fields[0].status, 'empty')
  assert.match(photoFieldLine(empty.fields[0]), /ยังไม่ได้กรอก · รูปชี้ว่า "5–7 ม\." · ตัวคูณ ×0\.90/)

  const text = photoReviewText(review)
  assert.ok(!/บาท|วงเงิน|081/.test(text))
  const adjust = text.slice(text.indexOf('ควรปรับในฟอร์มประเมิน:'), text.indexOf('ข้อมูลที่กรอกขัดกับรูป:'))
  assert.match(adjust, /ลักษณะถนน\/ทำเล: กรอกว่า "ติดถนนหลัก 2 เลน \(สายหลัก\)" · รูปชี้ว่า "ซอยตัน \/ ปลายซอย"/)
  assert.match(adjust, /ยังไม่ได้ติ๊ก · รูปชี้ว่ามี \(คะแนนเสี่ยง \+12\)/)
  assert.ok(!adjust.includes('ความกว้างถนน'))
  assert.match(text, /กรอกว่า ที่ดินเปล่า \(โฉนด\) · ในรูปเห็น มีอาคารอยู่บนที่ดิน \(รูปทรัพย์ที่ 1\)/)
  assert.match(text, /การครอบครอง\/ผู้อยู่อาศัย: มีรถจอดและของใช้ในลาน \(รูปทรัพย์ที่ 3\) \[เพิ่มความเสี่ยง · กระทบสภาพคล่องตอนขาย และความเสี่ยงทางกฎหมาย\] → ถามว่าใครใช้พื้นที่/)
  assert.ok(text.endsWith(PHOTO_REVIEW_CAVEAT))
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

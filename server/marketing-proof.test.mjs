import test from 'node:test'
import assert from 'node:assert/strict'
import { assertApprovedForPublish, createProofHandler, proofFlagOn } from './marketing-proof.js'
import { publishFacebookPost } from './marketing-facebook.js'
import { fakeDb } from './marketing-proof.fakedb.mjs'

const NOW = Date.parse('2026-11-23T05:00:00Z')
function call(handler, { method = 'POST', body, query = {} } = {}) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v }, status(code) { this.code = code; return this }, json(data) { resolve({ status: this.code, data }) } }
    handler({ method, url: '/api/marketing-proof', body, query }, res)
  })
}
const handlerFor = (db, { authorized = true, flag = true } = {}) => createProofHandler({ authorized: () => authorized, database: () => db, flag: () => flag, clock: () => NOW })
const post = (over = {}) => ({ id: '1763870000000', contentNo: 12, title: 'ที่ดินติดถนนใหญ่เหมือนกัน ทำไมมูลค่าต่างกัน', caption: 'ติดถนนใหญ่ไม่ได้แปลว่าเข้าออกได้เหมือนกันทุกแปลง\n\nราคาเสนอขายของแปลงใกล้เคียงอยู่ในระดับใกล้กัน แต่ยังไม่ใช่ราคาที่ขายได้', channel: 'facebook', mediaAssetId: 'asset-1', draftSource: 'ai', status: 'approved', reviewStatus: 'passed', ...over })

// บรีฟ + แหล่ง 2 แหล่ง + ข้ออ้าง 2 ข้อ (AC-01)
async function seed(handler) {
  const brief = (await call(handler, { body: { action: 'save-brief', brief: { mode: 'field', topic: 'ที่ดินติดถนนใหญ่เหมือนกัน ทำไมมูลค่าต่างกัน', field: { observations: ['หน้าแปลงติดทางคู่ขนาน'], survey_date: '2026-11-15' } } } })).data.brief
  const s1 = (await call(handler, { body: { action: 'save-source', briefId: brief.id, source: { kind: 'listing', title: 'ประกาศขายออนไลน์', source_url: 'https://example.com/listing', checked_at: '2026-11-20' } } })).data.source
  const s2 = (await call(handler, { body: { action: 'save-source', briefId: brief.id, source: { kind: 'official', title: 'ประกาศราชการตัวอย่าง', source_url: 'https://example.go.th/a', checked_at: '2026-11-21' } } })).data.source
  const c1 = (await call(handler, { body: { action: 'save-claim', briefId: brief.id, sourceIds: [s1.id], claim: { claim_text: 'ราคาเสนอขายของแปลงใกล้เคียงอยู่ในระดับใกล้กัน', claim_type: 'MARKET-ASK', category: 'price', limitation: 'ยังไม่ใช่ราคาที่ขายได้' } } })).data.claim
  const c2 = (await call(handler, { body: { action: 'save-claim', briefId: brief.id, sourceIds: [s2.id], claim: { claim_text: 'แปลงนี้มีภาระจำยอมเรื่องทางผ่านตามเอกสารสิทธิ', claim_type: 'OFFICIAL', category: 'legal' } } })).data.claim
  return { brief, s1, s2, c1, c2 }
}

test('ธงปิดเป็นค่าเริ่มต้น · ต้องล็อกอิน · ธงปิด = ไม่มีฟีเจอร์ (AC-15)', async () => {
  assert.equal(proofFlagOn({}), false)
  assert.equal(proofFlagOn({ MARKETING_PROOF_CARDS: '1' }), true)
  const db = fakeDb()
  assert.equal((await call(handlerFor(db, { authorized: false }), { method: 'GET', query: { flags: '1' } })).status, 401)
  const off = handlerFor(db, { flag: false })
  assert.deepEqual((await call(off, { method: 'GET', query: { flags: '1' } })).data, { flags: { proofCards: false }, ready: false })
  assert.equal((await call(off, { body: { action: 'save-brief', brief: { topic: 'ก' } } })).status, 404)
  assert.equal(db.tables().marketing_content_briefs.length, 0)
  assert.deepEqual((await call(handlerFor(db), { method: 'GET', query: { flags: '1' } })).data, { flags: { proofCards: true }, ready: true })
})

test('ตารางยังไม่ถูกสร้าง: บอกชัดว่าต้องรันไฟล์ไหน และ ready = false', async () => {
  const handler = handlerFor(fakeDb({ missing: true }))
  assert.equal((await call(handler, { method: 'GET', query: { flags: '1' } })).data.ready, false)
  const res = await call(handler, { body: { action: 'save-brief', brief: { topic: 'ก' } } })
  assert.equal(res.status, 503)
  assert.equal(res.data.missingTable, true)
  assert.match(res.data.error, /supabase_marketing_proof\.sql/)
})

test('AC-01: บรีฟ → 2 แหล่ง → 2 ข้ออ้าง → ยืนยัน → ผูกคอนเทนต์ → อนุมัติ → ผ่านด่านส่งออก และลิงก์แหล่งยังครบ', async () => {
  const db = fakeDb()
  const handler = handlerFor(db)
  const { brief, c1, c2 } = await seed(handler)
  const verified = await call(handler, { body: { action: 'review-claim', id: c1.id, version: c1.version, status: 'verified', reviewer: 'ผู้ตรวจทดสอบ' } })
  assert.equal(verified.status, 200)
  assert.equal(verified.data.claim.status, 'verified')
  // ข้อสองยังไม่ยืนยัน → เลือกไม่ใช้ในโพสต์
  const unused = await call(handler, { body: { action: 'save-claim', id: c2.id, version: c2.version, claim: { ...c2, use_in_post: false } } })
  assert.equal(unused.status, 200)
  const attached = await call(handler, { body: { action: 'attach-content', briefId: brief.id, contentId: post().id, contentNo: 12 } })
  assert.equal(attached.data.brief.content_id, post().id)
  const approved = await call(handler, { body: { action: 'approve', post: post(), reviewer: 'ผู้ตรวจทดสอบ', reason: 'ตรวจแหล่งแล้ว' } })
  assert.equal(approved.status, 200)
  assert.deepEqual(approved.data.gate.claim_ids_used, [c1.id])
  const loaded = await call(handler, { method: 'GET', query: { content: post().id } })
  assert.equal(loaded.data.sources.length, 2)
  assert.equal(loaded.data.links.length, 2)
  assert.equal(loaded.data.review.decision, 'approved')
  const pass = await assertApprovedForPublish(db, post(), { now: NOW })
  assert.equal(pass.review.reviewer, 'ผู้ตรวจทดสอบ')
})

test('AC-02: ข้ออ้างยังไม่ยืนยัน → อนุมัติไม่ได้ และบอกข้อที่ต้องตรวจ · ยืนยันโดยไม่มีแหล่งไม่ได้', async () => {
  const db = fakeDb()
  const handler = handlerFor(db)
  const { brief, c1 } = await seed(handler)
  await call(handler, { body: { action: 'attach-content', briefId: brief.id, contentId: post().id } })
  const blocked = await call(handler, { body: { action: 'approve', post: post(), reviewer: 'ผู้ตรวจทดสอบ' } })
  assert.equal(blocked.status, 422)
  assert.ok(blocked.data.gate.evidence_blockers.some((item) => /ยังไม่ยืนยัน/.test(item)))
  assert.equal(db.tables().marketing_content_reviews.length, 0)
  const noName = await call(handler, { body: { action: 'review-claim', id: c1.id, version: c1.version, status: 'verified', reviewer: '' } })
  assert.equal(noName.status, 400)
  const lone = (await call(handler, { body: { action: 'save-claim', briefId: brief.id, claim: { claim_text: 'ข้ออ้างไม่มีแหล่ง', claim_type: 'THIRD-PARTY' } } })).data.claim
  const refuse = await call(handler, { body: { action: 'review-claim', id: lone.id, version: lone.version, status: 'verified', reviewer: 'ผู้ตรวจทดสอบ' } })
  assert.equal(refuse.status, 422)
  assert.match(refuse.data.error, /ผูกแหล่งข้อมูล/)
})

test('AC-03: แหล่งที่สิทธิเผยแพร่ยังไม่ทราบ → ข้ออ้างที่ใช้แหล่งนั้นบล็อกการอนุมัติ', async () => {
  const db = fakeDb()
  const handler = handlerFor(db)
  const brief = (await call(handler, { body: { action: 'save-brief', brief: { topic: 'ภาพหน้าแปลง' } } })).data.brief
  const photo = (await call(handler, { body: { action: 'save-source', briefId: brief.id, source: { kind: 'own_media', title: 'ภาพหน้าแปลงจากลูกค้า', checked_at: '2026-11-20' } } })).data.source
  assert.equal(photo.permission_status, 'unknown')
  const c = (await call(handler, { body: { action: 'save-claim', briefId: brief.id, sourceIds: [photo.id], claim: { claim_text: 'หน้าแปลงกว้างพอสำหรับรถบรรทุกเข้าออก', claim_type: 'THIRD-PARTY', category: 'field' } } })).data.claim
  await call(handler, { body: { action: 'review-claim', id: c.id, version: c.version, status: 'verified', reviewer: 'ผู้ตรวจทดสอบ' } })
  await call(handler, { body: { action: 'attach-content', briefId: brief.id, contentId: 'p-3' } })
  const res = await call(handler, { body: { action: 'approve', post: post({ id: 'p-3', caption: 'เช็กลิสต์ดูหน้าแปลง' }), reviewer: 'ผู้ตรวจทดสอบ' } })
  assert.equal(res.status, 422)
  assert.ok(res.data.gate.evidence_blockers.some((item) => /ยังไม่ได้รับอนุญาตเผยแพร่/.test(item)))
})

test('AC-07: แก้ข้อความ ภาพ หรือข้ออ้างหลังอนุมัติ → ส่งออกไม่ได้จนกว่าจะอนุมัติใหม่', async () => {
  const db = fakeDb()
  const handler = handlerFor(db)
  const { brief, c1, c2 } = await seed(handler)
  const v1 = (await call(handler, { body: { action: 'review-claim', id: c1.id, version: c1.version, status: 'verified', reviewer: 'ผู้ตรวจทดสอบ' } })).data.claim
  await call(handler, { body: { action: 'save-claim', id: c2.id, version: c2.version, claim: { ...c2, use_in_post: false } } })
  await call(handler, { body: { action: 'attach-content', briefId: brief.id, contentId: post().id } })
  await call(handler, { body: { action: 'approve', post: post(), reviewer: 'ผู้ตรวจทดสอบ' } })
  await assertApprovedForPublish(db, post(), { now: NOW })
  await assert.rejects(() => assertApprovedForPublish(db, post({ caption: `${post().caption}\nรับประกันผล` }), { now: NOW }), /เปลี่ยนหลังอนุมัติ/)
  await assert.rejects(() => assertApprovedForPublish(db, post({ mediaAssetId: 'asset-2' }), { now: NOW }), /เปลี่ยนหลังอนุมัติ/)
  // แก้เนื้อความของข้ออ้างที่ยืนยันแล้ว → ข้ออ้างกลับไปต้องตรวจ และการอนุมัติเดิมใช้ไม่ได้
  const edited = await call(handler, { body: { action: 'save-claim', id: v1.id, version: v1.version, claim: { ...v1, claim_text: 'ราคาเสนอขายของแปลงใกล้เคียงสูงกว่ามาก' } } })
  assert.equal(edited.data.claim.status, 'needs_check')
  await assert.rejects(() => assertApprovedForPublish(db, post(), { now: NOW }), /เปลี่ยนหลังอนุมัติ/)
})

test('หลักฐานหมดอายุหลังอนุมัติ → ด่านส่งออกตรวจซ้ำและบล็อก', async () => {
  const db = fakeDb()
  const handler = handlerFor(db)
  const { brief, c1, c2 } = await seed(handler)
  const withExpiry = (await call(handler, { body: { action: 'save-claim', id: c1.id, version: c1.version, claim: { ...c1, expires_at: '2026-12-01' } } })).data.claim
  await call(handler, { body: { action: 'review-claim', id: withExpiry.id, version: withExpiry.version, status: 'verified', reviewer: 'ผู้ตรวจทดสอบ' } })
  await call(handler, { body: { action: 'save-claim', id: c2.id, version: c2.version, claim: { ...c2, use_in_post: false } } })
  await call(handler, { body: { action: 'attach-content', briefId: brief.id, contentId: post().id } })
  assert.equal((await call(handler, { body: { action: 'approve', post: post(), reviewer: 'ผู้ตรวจทดสอบ' } })).status, 200)
  await assertApprovedForPublish(db, post(), { now: NOW })
  await assert.rejects(() => assertApprovedForPublish(db, post(), { now: Date.parse('2026-12-05T00:00:00Z') }), /หมดอายุ/)
})

test('AC-13: แก้รายการเดียวกันจากสองแท็บ → แท็บที่ช้ากว่าได้ 409 ไม่เขียนทับ', async () => {
  const db = fakeDb()
  const handler = handlerFor(db)
  const brief = (await call(handler, { body: { action: 'save-brief', brief: { topic: 'หัวข้อเดิม' } } })).data.brief
  const first = await call(handler, { body: { action: 'save-brief', id: brief.id, version: brief.version, brief: { topic: 'แก้จากแท็บ ก' } } })
  assert.equal(first.status, 200)
  assert.equal(first.data.brief.version, 2)
  const second = await call(handler, { body: { action: 'save-brief', id: brief.id, version: brief.version, brief: { topic: 'แก้จากแท็บ ข' } } })
  assert.equal(second.status, 409)
  assert.equal(second.data.conflict, true)
  assert.equal(db.tables().marketing_content_briefs[0].topic, 'แก้จากแท็บ ก')
  assert.equal((await call(handler, { body: { action: 'save-brief', id: brief.id, brief: { topic: 'ไม่มีเวอร์ชัน' } } })).status, 400)
})

test('บรีฟหนึ่งผูกได้คอนเทนต์เดียว และแหล่งของบรีฟอื่นผูกกับข้ออ้างไม่ได้', async () => {
  const db = fakeDb()
  const handler = handlerFor(db)
  const a = (await call(handler, { body: { action: 'save-brief', brief: { topic: 'ก' } } })).data.brief
  const b = (await call(handler, { body: { action: 'save-brief', brief: { topic: 'ข' } } })).data.brief
  await call(handler, { body: { action: 'attach-content', briefId: a.id, contentId: 'p-1' } })
  assert.equal((await call(handler, { body: { action: 'attach-content', briefId: b.id, contentId: 'p-1' } })).status, 409)
  assert.equal((await call(handler, { body: { action: 'attach-content', briefId: a.id, contentId: 'p-2' } })).status, 409)
  const foreign = (await call(handler, { body: { action: 'save-source', briefId: b.id, source: { kind: 'listing', title: 'แหล่งของบรีฟ ข', source_url: 'https://example.com' } } })).data.source
  const linked = await call(handler, { body: { action: 'save-claim', briefId: a.id, sourceIds: [foreign.id], claim: { claim_text: 'ข้ออ้างของบรีฟ ก' } } })
  assert.deepEqual(linked.data.links, [])
})

test('โพสต์ไม่มีบรีฟ (ความรู้ทั่วไป): อนุมัติได้เมื่อไม่ติดคำต้องห้าม · ไม่มีบันทึกอนุมัติ = ส่งออกไม่ได้', async () => {
  const db = fakeDb()
  const handler = handlerFor(db)
  const general = post({ id: 'p-general', caption: 'ก่อนเซ็นสัญญาขายฝาก ถามตัวเองก่อนว่าเงินที่จะไถ่คืนมาจากไหน' })
  await assert.rejects(() => assertApprovedForPublish(db, general, { now: NOW }), /ยังไม่มีบันทึกการอนุมัติ/)
  assert.equal((await call(handler, { body: { action: 'approve', post: general, reviewer: '' } })).status, 400)
  const ok = await call(handler, { body: { action: 'approve', post: general, reviewer: 'ผู้ตรวจทดสอบ' } })
  assert.equal(ok.status, 200)
  assert.equal(ok.data.gate.mode, 'general')
  await assertApprovedForPublish(db, general, { now: NOW })
  const bad = await call(handler, { body: { action: 'approve', post: post({ id: 'p-bad', caption: 'อนุมัติแน่นอน 100% ทุกเคส' }), reviewer: 'ผู้ตรวจทดสอบ' } })
  assert.equal(bad.status, 422)
  assert.ok(bad.data.gate.compliance_blockers.length >= 1)
})

test('ด่านโพสต์ Facebook: ธงเปิด = เรียก API ตรงโดยอ้างว่า reviewStatus ผ่านแล้ว ก็ส่งไม่ได้ถ้าไม่มีบันทึกอนุมัติ', async () => {
  const db = fakeDb()
  const config = { pageId: 'page-1', accessToken: 'token', appSecret: '', graphVersion: 'v26.0' }
  let sent = 0
  const fetchImpl = async () => { sent += 1; return new Response(JSON.stringify({ id: 'fb-1' }), { status: 200 }) }
  const guard = (p) => assertApprovedForPublish(db, p, { now: NOW })
  const general = post({ id: 'p-fb', caption: 'ก่อนเซ็นสัญญาขายฝาก ถามตัวเองก่อนว่าเงินที่จะไถ่คืนมาจากไหน', mediaAssetId: '' })
  await assert.rejects(() => publishFacebookPost({ post: general }, fetchImpl, config, { approvalGuard: guard }), /ยังไม่มีบันทึกการอนุมัติ/)
  assert.equal(sent, 0)
  await call(handlerFor(db), { body: { action: 'approve', post: general, reviewer: 'ผู้ตรวจทดสอบ' } })
  const done = await publishFacebookPost({ post: general }, fetchImpl, config, { approvalGuard: guard })
  assert.equal(done.facebookPostId, 'fb-1')
  assert.equal(sent, 1)
  // ไม่มี guard (ธงปิด) = พฤติกรรมเดิม
  const legacy = await publishFacebookPost({ post: post({ id: 'p-legacy', caption: general.caption }) }, fetchImpl, config)
  assert.equal(legacy.facebookPostId, 'fb-1')
})

test('Reel: อนุมัติแยกจากโพสต์ ผูกข้อความใต้คลิปกับไฟล์คลิป และต้องยืนยันว่าดูคลิปแล้ว', async () => {
  const db = fakeDb()
  const handler = handlerFor(db)
  const CLIP = 'clips/c12-1795500000000.mp4'
  const reel = (over = {}) => ({ ...post({ caption: 'ก่อนเซ็นสัญญาขายฝาก ถามตัวเองก่อนว่าเงินที่จะไถ่คืนมาจากไหน' }), kind: 'reel', mediaAssetId: CLIP, videoScript: '', ...over })
  // โพสต์อนุมัติแล้ว ไม่ได้แปลว่า Reel อนุมัติแล้ว
  assert.equal((await call(handler, { body: { action: 'approve', post: post({ caption: reel().caption }), reviewer: 'ผู้ตรวจทดสอบ' } })).status, 200)
  await assert.rejects(() => assertApprovedForPublish(db, reel(), { now: NOW }), /ยังไม่มีบันทึกการอนุมัติของคนสำหรับ Reel/)
  // ตรวจอย่างเดียวได้ ไม่บันทึก
  const gate = await call(handler, { body: { action: 'gate', post: reel() } })
  assert.equal(gate.status, 200)
  assert.equal(gate.data.gate.blocked, false)
  // ไม่ยืนยันว่าดูคลิป ไฟล์ไม่ใช่คลิป หรือคลิปของคอนเทนต์เลขอื่น = อนุมัติไม่ได้
  assert.equal((await call(handler, { body: { action: 'approve', post: reel(), reviewer: 'ผู้ตรวจทดสอบ' } })).status, 400)
  assert.equal((await call(handler, { body: { action: 'approve', post: reel({ mediaAssetId: 'asset-1' }), reviewer: 'ผู้ตรวจทดสอบ', watched: true } })).status, 400)
  assert.equal((await call(handler, { body: { action: 'approve', post: reel({ mediaAssetId: 'clips/c99-1795500000000.mp4' }), reviewer: 'ผู้ตรวจทดสอบ', watched: true } })).status, 400)
  // ข้อความใต้คลิปติดคำต้องห้าม = 422
  assert.equal((await call(handler, { body: { action: 'approve', post: reel({ caption: 'อนุมัติแน่นอน 100% ทุกเคส' }), reviewer: 'ผู้ตรวจทดสอบ', watched: true } })).status, 422)
  const ok = await call(handler, { body: { action: 'approve', post: reel(), reviewer: 'ผู้ตรวจทดสอบ', watched: true } })
  assert.equal(ok.status, 200)
  const row = db.tables().marketing_content_reviews.at(-1)
  assert.equal(row.content_id, `${post().id}#reel`)
  assert.equal(row.category, 'reel')
  assert.match(row.reason, /ดูคลิปจนจบแล้ว/)
  await assertApprovedForPublish(db, reel(), { now: NOW })
  // แก้ข้อความใต้คลิป หรือเปลี่ยนไฟล์คลิป หลังอนุมัติ = ส่งไม่ได้
  await assert.rejects(() => assertApprovedForPublish(db, reel({ caption: `${reel().caption}\nเพิ่มบรรทัด` }), { now: NOW }), /เปลี่ยนหลังอนุมัติ/)
  await assert.rejects(() => assertApprovedForPublish(db, reel({ mediaAssetId: 'clips/c12-1795600000000.mp4' }), { now: NOW }), /เปลี่ยนหลังอนุมัติ/)
  // การอนุมัติของ Reel ไม่กระทบบันทึกของโพสต์
  await assertApprovedForPublish(db, post({ caption: reel().caption }), { now: NOW })
  assert.equal((await call(handler, { method: 'GET', query: { content: post().id } })).data.review.decision, 'approved')
})

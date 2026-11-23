import test from 'node:test'
import assert from 'node:assert/strict'
import { MEDIA_MAX_BYTES, dehydrateWorkspace, hydrateWorkspace, imageBytes, isStoragePath, markStored, mediaSummary, needsHydration, needsUpload, sameImage } from './marketingMedia.js'
import { createMediaHandler, mediaStorageOn } from '../../server/marketing-media.js'

const png = (text) => `data:image/png;base64,${Buffer.from(text).toString('base64')}`
const A = png('รูปที่หนึ่ง สมมติ')
const B = png('รูปที่สอง สมมติ')
const ws = (assets) => ({ posts: [{ id: 1, caption: 'โพสต์', mediaAssetId: 'asset-1' }], mediaAssets: assets, contentSeq: 5 })

test('ตำแหน่งไฟล์รับเฉพาะรูปแบบที่ระบบออกให้', () => {
  assert.equal(isStoragePath('workspace/asset-1-abcdef0123456789.png'), true)
  for (const bad of ['', 'workspace/../secret', 'lead-files/x.png', 'workspace/a b.png', '/workspace/a.png', null]) assert.equal(isStoragePath(bad), false)
})

test('ตอนบันทึก: รูปที่ย้ายแล้วไม่พก dataUrl · รูปที่ยังไม่ย้ายคงเดิม · ไม่แก้ object ในหน่วยความจำ', () => {
  const memory = ws([{ id: 'asset-1', dataUrl: A, storagePath: 'workspace/asset-1-aa.png', width: 1080 }, { id: 'asset-2', dataUrl: B }])
  const stored = dehydrateWorkspace(memory)
  assert.equal(stored.mediaAssets[0].dataUrl, undefined)
  assert.equal(stored.mediaAssets[0].storagePath, 'workspace/asset-1-aa.png')
  assert.equal(stored.mediaAssets[0].width, 1080)
  assert.equal(stored.mediaAssets[1].dataUrl, B)
  assert.equal(memory.mediaAssets[0].dataUrl, A)
  assert.deepEqual(stored.posts, memory.posts)
  // ไม่มีรูปที่ย้ายแล้ว = คืน object เดิม (ไม่สร้างสำเนาโดยไม่จำเป็น)
  const untouched = ws([{ id: 'asset-2', dataUrl: B }])
  assert.equal(dehydrateWorkspace(untouched), untouched)
  assert.ok(JSON.stringify(stored).length < JSON.stringify(memory).length)
})

test('ตอนเปิดหน้า: รูปที่มีตำแหน่งไฟล์ถูกเติมกลับ · ตำแหน่งไม่ตรงหรือมีรูปอยู่แล้วไม่ถูกทับ', () => {
  const cloud = ws([{ id: 'asset-1', storagePath: 'workspace/asset-1-aa.png' }, { id: 'asset-2', dataUrl: B }])
  assert.equal(needsHydration(cloud.mediaAssets[0]), true)
  assert.equal(needsHydration(cloud.mediaAssets[1]), false)
  const filled = hydrateWorkspace(cloud, { 'asset-1': { storagePath: 'workspace/asset-1-aa.png', dataUrl: A } })
  assert.equal(filled.mediaAssets[0].dataUrl, A)
  assert.equal(hydrateWorkspace(cloud, { 'asset-1': { storagePath: 'workspace/other.png', dataUrl: A } }), cloud)
  assert.equal(hydrateWorkspace(cloud, { 'asset-2': { storagePath: undefined, dataUrl: A } }), cloud)
  assert.equal(hydrateWorkspace(filled, { 'asset-1': { storagePath: 'workspace/asset-1-aa.png', dataUrl: B } }), filled)
  // ไป-กลับครบรอบ: บันทึกแล้วเปิดใหม่ได้รูปเดิม
  assert.deepEqual(hydrateWorkspace(dehydrateWorkspace(filled), { 'asset-1': { storagePath: 'workspace/asset-1-aa.png', dataUrl: A } }), filled)
})

test('รูปใหม่: ต้องอัปโหลด · ได้ตำแหน่งไฟล์เมื่อรูปยังเป็นรูปเดิมเท่านั้น · รูปใหญ่เกินอยู่ในก้อนต่อไป', () => {
  const memory = ws([{ id: 'asset-1', dataUrl: A }])
  assert.equal(needsUpload(memory.mediaAssets[0]), true)
  const marked = markStored(memory, 'asset-1', 'workspace/asset-1-aa.png', A)
  assert.equal(marked.mediaAssets[0].storagePath, 'workspace/asset-1-aa.png')
  assert.equal(marked.mediaAssets[0].dataUrl, A)
  assert.equal(needsUpload(marked.mediaAssets[0]), false)
  // ระหว่างรออัปโหลด รูปถูกแทนด้วยรูปใหม่ → ไม่ผูกตำแหน่งไฟล์ของรูปเก่า
  assert.equal(markStored(ws([{ id: 'asset-1', dataUrl: B }]), 'asset-1', 'workspace/asset-1-aa.png', A).mediaAssets[0].storagePath, undefined)
  assert.equal(markStored(memory, 'asset-1', '../bad', A), memory)
  const huge = { id: 'asset-9', dataUrl: `data:image/png;base64,${'A'.repeat(Math.ceil((MEDIA_MAX_BYTES + 10) * 4 / 3))}` }
  assert.equal(needsUpload(huge), false)
  assert.deepEqual(mediaSummary(ws([marked.mediaAssets[0], { id: 'asset-2', dataUrl: B }, { id: 'asset-3', storagePath: 'workspace/asset-3-bb.png' }, huge])), { total: 4, stored: 2, pendingUpload: 1, pendingLoad: 1, tooLarge: 1 })
})

test('เทียบรูป: เนื้อเดียวกันถือว่าตรง แม้หัว data: หรือช่องว่างต่างกัน', () => {
  assert.equal(sameImage(A, A.replace('image/png', 'image/PNG').replace(',', ',\n')), true)
  assert.equal(sameImage(A, B), false)
  assert.equal(sameImage('', ''), false)
  assert.equal(imageBytes(A), Buffer.from('รูปที่หนึ่ง สมมติ').length)
})

// ── API ──────────────────────────────────────────────────────────────────────────────
function fakeStorage() {
  const files = new Map()
  const bucket = {
    upload: async (path, buffer, options) => {
      if (files.has(path) && !options?.upsert) return { error: { message: 'The resource already exists', statusCode: '409' } }
      files.set(path, Buffer.from(buffer))
      return { data: { path }, error: null }
    },
    download: async (path) => (files.has(path) ? { data: new Blob([files.get(path)]), error: null } : { data: null, error: { message: 'not found' } }),
  }
  return { files, db: { storage: { from: () => bucket } } }
}
function call(handler, { method = 'GET', body, query = {} } = {}) {
  return new Promise((resolve) => {
    const res = { setHeader() {}, status(code) { this.code = code; return this }, json(data) { resolve({ status: this.code, data }) } }
    handler({ method, body, query }, res)
  })
}

test('API: ต้องล็อกอิน · อัปโหลดแล้วอ่านกลับได้รูปเดิม · อัปซ้ำได้ชื่อเดิมไม่เขียนทับ · ปฏิเสธไฟล์ที่ไม่ใช่รูปและตำแหน่งแปลก', async () => {
  const { files, db } = fakeStorage()
  const handler = createMediaHandler({ authorized: () => true, database: () => db, enabled: () => true, ensure: async () => true })
  assert.equal((await call(createMediaHandler({ authorized: () => false, database: () => db }), { query: { status: '1' } })).status, 401)
  assert.deepEqual((await call(handler, { query: { status: '1' } })).data, { ready: true })
  const up = await call(handler, { method: 'POST', body: { action: 'upload', id: 'asset-1', dataUrl: A } })
  assert.equal(up.status, 200)
  assert.match(up.data.path, /^workspace\/asset-1-[a-f0-9]{16}\.png$/)
  assert.equal(isStoragePath(up.data.path), true)
  const back = await call(handler, { query: { path: up.data.path } })
  assert.equal(sameImage(back.data.dataUrl, A), true)
  const again = await call(handler, { method: 'POST', body: { action: 'upload', id: 'asset-1', dataUrl: A } })
  assert.equal(again.data.path, up.data.path)
  assert.equal(files.size, 1)
  assert.notEqual((await call(handler, { method: 'POST', body: { action: 'upload', id: 'asset-1', dataUrl: B } })).data.path, up.data.path)
  assert.equal((await call(handler, { method: 'POST', body: { action: 'upload', id: 'x', dataUrl: 'data:text/html;base64,PGI+' } })).status, 400)
  assert.equal((await call(handler, { query: { path: 'workspace/../../etc' } })).status, 400)
  assert.equal((await call(handler, { query: { path: 'workspace/missing-0000.png' } })).status, 404)
  assert.equal((await call(handler, { method: 'POST', body: { action: 'delete', id: 'asset-1' } })).status, 400)
})

test('API: ปิดด้วยตัวแปรได้ · ปิดอยู่ = ไม่พร้อม และไม่รับรูป (หน้าเว็บจึงเก็บรูปในก้อนตามเดิม)', async () => {
  assert.equal(mediaStorageOn({}), true)
  assert.equal(mediaStorageOn({ MARKETING_MEDIA_STORAGE: 'off' }), false)
  const { files, db } = fakeStorage()
  const handler = createMediaHandler({ authorized: () => true, database: () => db, enabled: () => false, ensure: async () => true })
  assert.deepEqual((await call(handler, { query: { status: '1' } })).data, { ready: false })
  assert.equal((await call(handler, { method: 'POST', body: { action: 'upload', id: 'asset-1', dataUrl: A } })).status, 503)
  assert.equal(files.size, 0)
})

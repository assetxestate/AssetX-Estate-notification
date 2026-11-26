import test from 'node:test'
import assert from 'node:assert/strict'
import { checkReel, createClipHandler, publishReel, uploadReelFromUrl } from './marketing-clip.js'

const fb = { pageId: 'page-123', accessToken: 'secret-token', appSecret: 'app-secret', appId: '', graphVersion: 'v26.0' }
const PATH = 'clips/c32-1795500000000.mp4'
const json = (data, status = 200) => new Response(JSON.stringify(data), { status })

function fakeDb({ files = [PATH] } = {}) {
  const calls = []
  const bucket = {
    list: async (folder, opts) => { calls.push(['list', folder, opts.search]); return { data: files.filter((f) => f.startsWith(`${folder}/`)).map((f) => ({ name: f.split('/')[1], metadata: { size: 33160899 } })), error: null } },
    createSignedUrl: async (path, seconds) => { calls.push(['sign', path, seconds]); return { data: { signedUrl: `https://files.example/${path}?token=abc` }, error: null } },
    createSignedUploadUrl: async (path) => { calls.push(['upload-url', path]); return { data: { token: 'upload-token', path }, error: null } },
  }
  return { calls, storage: { from: (name) => { calls.push(['from', name]); return bucket } } }
}

function run(handler, { method = 'GET', query = {}, body = null } = {}) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v }, status(code) { this.code = code; return this }, json(data) { resolve({ code: this.code, data }) } }
    handler({ method, query, body }, res)
  })
}

const make = (over = {}) => {
  const db = over.db || fakeDb()
  const requests = []
  const fetchImpl = over.fetchImpl || (async (url, options) => { requests.push({ url: String(url), options }); return json({ success: true }) })
  const handler = createClipHandler({ authorized: () => over.authorized ?? true, database: () => db, enabled: () => over.enabled ?? true, ensure: async () => true, fetchImpl, config: () => over.config || fb, now: () => 1795500000000, approval: () => over.guard || null })
  return { handler, db, requests }
}

test('ต้องล็อกอิน และรับเฉพาะ GET/POST', async () => {
  assert.equal((await run(make({ authorized: false }).handler, { query: { status: '1' } })).code, 401)
  assert.equal((await run(make().handler, { method: 'DELETE' })).code, 405)
})

test('สถานะ: บอกว่าที่เก็บพร้อมไหม และตั้งค่า Facebook แล้วไหม', async () => {
  assert.deepEqual((await run(make().handler, { query: { status: '1' } })).data, { ready: true, facebook: true, approval: false })
  assert.deepEqual((await run(make({ enabled: false, config: { ...fb, accessToken: '' } }).handler, { query: { status: '1' } })).data, { ready: false, facebook: false, approval: false })
  assert.equal((await run(make({ guard: async () => {} }).handler, { query: { status: '1' } })).data.approval, true)
})

test('ขอลิงก์อัปโหลด: ตรวจชนิด ขนาด เลขคอนเทนต์ แล้วคืนตำแหน่งไฟล์ที่มีเวลา', async () => {
  const { handler, db } = make()
  const ok = await run(handler, { method: 'POST', body: { action: 'upload-url', contentNo: 32, bytes: 33160899, type: 'video/mp4' } })
  assert.equal(ok.code, 200)
  assert.deepEqual(ok.data, { bucket: 'marketing-clips', path: PATH, token: 'upload-token' })
  assert.deepEqual(db.calls.find((c) => c[0] === 'upload-url'), ['upload-url', PATH])
  assert.equal((await run(handler, { method: 'POST', body: { action: 'upload-url', contentNo: 32, bytes: 5, type: 'video/quicktime' } })).code, 400)
  assert.equal((await run(handler, { method: 'POST', body: { action: 'upload-url', contentNo: 32, bytes: 200 * 1024 * 1024, type: 'video/mp4' } })).code, 400)
  assert.equal((await run(handler, { method: 'POST', body: { action: 'upload-url', contentNo: 'x', bytes: 5, type: 'video/mp4' } })).code, 400)
})

test('ลิงก์ดูคลิป: ตำแหน่งผิดรูปแบบ 400 · ไม่มีไฟล์ 404 · มีไฟล์ได้ลิงก์ชั่วคราว', async () => {
  const { handler } = make()
  assert.equal((await run(handler, { query: { path: 'workspace/a.png' } })).code, 400)
  assert.equal((await run(make({ db: fakeDb({ files: [] }) }).handler, { query: { path: PATH } })).code, 404)
  const ok = await run(handler, { query: { path: PATH } })
  assert.equal(ok.code, 200)
  assert.match(ok.data.url, /^https:\/\/files\.example\//)
  assert.equal(ok.data.bytes, 33160899)
})

test('ส่งไฟล์ให้ Facebook: เปิดรายการแล้วส่งลิงก์ไฟล์ทาง header โทเคนไม่อยู่ใน URL', async () => {
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options })
    return requests.length === 1 ? json({ video_id: '1234567890', upload_url: 'https://rupload.facebook.com/video-upload/v26.0/1234567890' }) : json({ success: true })
  }
  const result = await uploadReelFromUrl('https://files.example/clip.mp4?token=abc', fetchImpl, fb)
  assert.deepEqual(result, { videoId: '1234567890' })
  assert.equal(requests[0].url, 'https://graph.facebook.com/v26.0/page-123/video_reels')
  assert.equal(requests[0].options.body.get('upload_phase'), 'start')
  assert.ok(requests[0].options.body.get('appsecret_proof'))
  assert.equal(requests[1].url, 'https://rupload.facebook.com/video-upload/v26.0/1234567890')
  assert.equal(requests[1].options.headers.file_url, 'https://files.example/clip.mp4?token=abc')
  assert.equal(requests[1].options.headers.Authorization, 'OAuth secret-token')
  for (const r of requests) assert.doesNotMatch(r.url, /secret-token/)
})

test('ส่งไฟล์ให้ Facebook: ไม่มีรหัสวิดีโอหรือไม่ยืนยันรับไฟล์ = ผิดพลาด', async () => {
  await assert.rejects(() => uploadReelFromUrl('https://f/x.mp4', async () => json({}), fb), /รหัสวิดีโอ/)
  let n = 0
  await assert.rejects(() => uploadReelFromUrl('https://f/x.mp4', async () => (++n === 1 ? json({ video_id: '1234567890' }) : json({ success: false })), fb), /ไม่ยืนยัน/)
  await assert.rejects(() => uploadReelFromUrl('https://f/x.mp4', async () => json({}), { ...fb, pageId: '' }), /META_PAGE_ID/)
})

test('เผยแพร่: ส่ง finish + PUBLISHED + ข้อความ และธง AI เมื่อระบุ', async () => {
  let request
  const fetchImpl = async (url, options) => { request = { url: String(url), options }; return json({ success: true }) }
  await publishReel({ videoId: '1234567890', description: 'ข้อความ', aiGenerated: true }, fetchImpl, fb)
  const body = request.options.body
  assert.equal(body.get('upload_phase'), 'finish')
  assert.equal(body.get('video_id'), '1234567890')
  assert.equal(body.get('video_state'), 'PUBLISHED')
  assert.equal(body.get('description'), 'ข้อความ')
  assert.equal(body.get('is_ai_generated'), 'true')
  await publishReel({ videoId: '1234567890', description: 'ข้อความ' }, fetchImpl, fb)
  assert.equal(request.options.body.get('is_ai_generated'), null)
  await assert.rejects(() => publishReel({ videoId: 'abc', description: 'x' }, fetchImpl, fb), /รหัสวิดีโอ/)
  await assert.rejects(() => publishReel({ videoId: '1234567890', description: 'x' }, async () => json({ success: false }), fb), /ไม่ยืนยัน/)
})

test('คำสั่งเผยแพร่ผ่าน API: ข้อความไม่ผ่านด่านคำหรือไม่ยืนยัน = ไม่เรียก Facebook', async () => {
  const { handler, requests } = make()
  const hype = await run(handler, { method: 'POST', body: { action: 'reel-publish', videoId: '1234567890', description: 'อนุมัติไว รับประกันผล 100% ได้เงินแน่นอน', confirmed: true } })
  assert.equal(hype.code, 400)
  const unconfirmed = await run(handler, { method: 'POST', body: { action: 'reel-publish', videoId: '1234567890', description: 'ขอยอดสินไถ่และวันครบกำหนดเป็นลายลักษณ์อักษรก่อนเซ็น' } })
  assert.equal(unconfirmed.code, 400)
  assert.equal(requests.length, 0)
  const ok = await run(handler, { method: 'POST', body: { action: 'reel-publish', videoId: '1234567890', description: 'ขอยอดสินไถ่และวันครบกำหนดเป็นลายลักษณ์อักษรก่อนเซ็น', confirmed: true, aiGenerated: true } })
  assert.equal(ok.code, 200)
  assert.equal(requests.length, 1)
})

test('คำสั่งส่งไฟล์ผ่าน API: ต้องเป็นตำแหน่งคลิปที่มีไฟล์จริง และลิงก์ที่ให้ Facebook มีอายุ 2 ชั่วโมง', async () => {
  assert.equal((await run(make().handler, { method: 'POST', body: { action: 'reel-upload', path: 'workspace/x.png' } })).code, 400)
  assert.equal((await run(make({ db: fakeDb({ files: [] }) }).handler, { method: 'POST', body: { action: 'reel-upload', path: PATH } })).code, 404)
  let n = 0
  const m = make({ fetchImpl: async () => (++n === 1 ? json({ video_id: '1234567890' }) : json({ success: true })) })
  const ok = await run(m.handler, { method: 'POST', body: { action: 'reel-upload', path: PATH } })
  assert.deepEqual(ok.data, { videoId: '1234567890' })
  assert.deepEqual(m.db.calls.find((c) => c[0] === 'sign'), ['sign', PATH, 7200])
})

test('สถานะ Reel: ย่อสถานะและต่อลิงก์เต็ม · ข้อผิดพลาดของ Facebook ไม่มีโทเคน', async () => {
  const done = await checkReel('1234567890', async () => json({ status: { video_status: 'ready', publishing_phase: { status: 'complete', publish_status: 'published' } }, permalink_url: '/reel/1234567890/' }), fb)
  assert.deepEqual(done, { videoId: '1234567890', state: 'published', message: 'เผยแพร่บนเพจแล้ว', permalink: 'https://www.facebook.com/reel/1234567890/' })
  const failing = make({ fetchImpl: async () => json({ error: { message: 'Invalid token secret-token', code: 190 } }, 400) })
  const result = await run(failing.handler, { query: { reel: '1234567890' } })
  assert.equal(result.code, 502)
  assert.doesNotMatch(result.data.error, /secret-token/)
})

test('คำสั่งที่ไม่รู้จัก 400 · ปิดที่เก็บ 503', async () => {
  assert.equal((await run(make().handler, { method: 'POST', body: { action: 'delete' } })).code, 400)
  assert.equal((await run(make({ enabled: false }).handler, { query: { path: PATH } })).code, 503)
})

test('ธงตรวจหลักฐานเปิด: ส่งไฟล์และเผยแพร่ต้องมีบันทึกการอนุมัติของ Reel ฉบับเดียวกัน ไม่ผ่าน = ไม่เรียก Facebook', async () => {
  const TEXT = 'ขอยอดสินไถ่และวันครบกำหนดเป็นลายลักษณ์อักษรก่อนเซ็น'
  const reel = (over = {}) => ({ id: 'p-32', kind: 'reel', contentNo: 32, caption: TEXT, mediaAssetId: PATH, ...over })
  const seen = []
  let approved = false
  const guard = async (post) => { seen.push(post); if (!approved) throw new Error('ยังไม่มีบันทึกการอนุมัติของคนสำหรับ Reel นี้') }
  let n = 0
  const m = make({ guard, fetchImpl: async () => { n += 1; return n === 1 ? json({ video_id: '1234567890' }) : json({ success: true }) } })
  const upload = (post) => run(m.handler, { method: 'POST', body: { action: 'reel-upload', path: PATH, post } })
  const publish = (post, description = TEXT) => run(m.handler, { method: 'POST', body: { action: 'reel-publish', videoId: '1234567890', description, confirmed: true, post } })

  // ไม่ส่งชุดข้อมูล ส่งชุดของโพสต์ หรือไฟล์/ข้อความไม่ตรงกับที่จะส่งจริง = 422 โดยไม่ถามบันทึกด้วยซ้ำ
  assert.equal((await upload(undefined)).code, 422)
  assert.equal((await upload({ ...reel(), kind: undefined })).code, 422)
  assert.equal((await upload(reel({ mediaAssetId: 'clips/c32-1795600000000.mp4' }))).code, 422)
  assert.equal((await publish(reel({ caption: 'ข้อความฉบับอื่นที่อนุมัติไว้' }))).code, 422)
  assert.equal(seen.length, 0)
  // ชุดถูกต้องแต่ยังไม่มีบันทึกอนุมัติ = 422 พร้อมข้อความของด่าน
  const noReview = await upload(reel())
  assert.equal(noReview.code, 422)
  assert.match(noReview.data.error, /ยังไม่มีบันทึกการอนุมัติ/)
  assert.equal((await publish(reel())).code, 422)
  assert.equal(n, 0)
  // มีบันทึกแล้ว = ผ่านทั้งสองขั้น และด่านได้ชุดข้อมูลของ Reel
  approved = true
  assert.deepEqual((await upload(reel())).data, { videoId: '1234567890' })
  assert.equal((await publish(reel({ caption: `  ${TEXT}\r\n` }), `${TEXT}  `)).code, 200)
  assert.equal(seen.at(-1).kind, 'reel')
  // ด่านคำและการยืนยันยังมาก่อน
  assert.equal((await publish(reel({ caption: 'อนุมัติไว รับประกันผล 100% ได้เงินแน่นอน' }), 'อนุมัติไว รับประกันผล 100% ได้เงินแน่นอน')).code, 400)
})

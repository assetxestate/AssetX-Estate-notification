import assert from 'node:assert/strict'
import { checkFacebookPost, describeTokenHealth, getFacebookConnection, parseImageDataUrl, parseScheduledAt, publishFacebookPost } from './marketing-facebook.js'

const config = {
  pageId: 'page-123',
  accessToken: 'secret-token',
  appSecret: 'app-secret',
  graphVersion: 'v26.0',
}

const connection = await getFacebookConnection(async (url) => {
  assert.match(url, /page-123/)
  assert.doesNotMatch(url, /undefined/)
  assert.doesNotMatch(url, /secret-token/)
  return new Response(JSON.stringify({ id: 'page-123', name: 'AssetX Page' }), { status: 200 })
}, config)
assert.equal(connection.tokenHealth.state, 'unknown')
const { tokenHealth, ...connectionDetails } = connection
assert.deepEqual(connectionDetails, {
  connected: true,
  pageId: 'page-123',
  pageName: 'AssetX Page',
  graphVersion: 'v26.0',
})

let textRequest
const textResult = await publishFacebookPost({
  post: {
    id: 'post-1',
    channel: 'facebook',
    status: 'approved',
    reviewStatus: 'passed',
    caption: 'ข้อความทดสอบ',
  },
}, async (url, options) => {
  textRequest = { url, options }
  return new Response(JSON.stringify({ id: 'page-123_456' }), { status: 200 })
}, config)
assert.equal(textResult.facebookPostId, 'page-123_456')
assert.match(textRequest.url, /page-123\/feed$/)
assert.match(String(textRequest.options.body), /message=/)
assert.doesNotMatch(String(textRequest.options.body), /secret-token/)

const schedule = parseScheduledAt('2099-01-02T09:30', new Date('2099-01-01T00:00:00+07:00').getTime())
assert.equal(schedule.iso, '2099-01-02T02:30:00.000Z')

let scheduledRequest
const scheduledResult = await publishFacebookPost({
  post: {
    id: 'post-2',
    channel: 'facebook',
    status: 'scheduled',
    scheduledAt: '2099-01-02T09:30:00+07:00',
    reviewStatus: 'passed',
    caption: 'โพสต์ตามกำหนด',
  },
}, async (url, options) => {
  scheduledRequest = { url, options }
  return new Response(JSON.stringify({ id: 'page-123_789' }), { status: 200 })
}, config)
assert.equal(scheduledResult.scheduled, true)
assert.equal(scheduledResult.scheduledPublishTime, '2099-01-02T02:30:00.000Z')
assert.match(String(scheduledRequest.options.body), /published=false/)
assert.match(String(scheduledRequest.options.body), /scheduled_publish_time=4071004200/)

const image = parseImageDataUrl(`data:image/png;base64,${Buffer.from('image-bytes').toString('base64')}`)
assert.equal(image.mimeType, 'image/png')
assert.equal(image.buffer.toString(), 'image-bytes')

await assert.rejects(
  () => publishFacebookPost({
    post: { channel: 'facebook', status: 'pending', reviewStatus: 'passed', caption: 'ยังไม่อนุมัติ' },
  }, async () => new Response('{}', { status: 200 }), config),
  /ต้องผ่านการอนุมัติ/,
)

await assert.rejects(
  () => publishFacebookPost({
    post: {
      channel: 'facebook',
      status: 'scheduled',
      scheduledAt: '2020-01-01T09:00:00+07:00',
      reviewStatus: 'passed',
      caption: 'เวลาในอดีต',
    },
  }, async () => new Response('{}', { status: 200 }), config),
  /ล่วงหน้าอย่างน้อย 10 นาที/,
)

for (const caption of ['อนุมัติแน่นอน', 'ก่อนซื้อที่ดิน ตรวจยอดสินไถ่']) {
  await assert.rejects(() => publishFacebookPost({
    post: { channel: 'facebook', status: 'approved', reviewStatus: 'passed', topic: 'ก่อนซื้อที่ดิน', caption },
  }, async () => { assert.fail('Unsafe content must not reach Facebook') }, config), /ห้ามโพสต์/)
}

for (const [status, code] of [[403, 200], [400, 190], [400, 100], [200, 200]]) {
  await assert.rejects(() => getFacebookConnection(async () => new Response(JSON.stringify({
    error: { code, error_subcode: 123, message: 'Original Meta reason secret-token app-secret' },
  }), { status }), config), (error) => {
    assert.match(error.message, /Original Meta reason/)
    assert.ok(error.message.includes(`HTTP ${status}`))
    assert.ok(error.message.includes(`code ${code}`))
    assert.match(error.message, /subcode 123/)
    assert.doesNotMatch(error.message, /secret-token|app-secret/)
    assert.doesNotMatch(error.message, /ยังไม่ได้ให้สิทธิ์/)
    return true
  })
}

const now = Date.now()
assert.equal(describeTokenHealth({ is_valid: false }, now).state, 'expired')
assert.equal(describeTokenHealth({ is_valid: true, expires_at: now / 1000 - 1 }, now).state, 'expired')
assert.equal(describeTokenHealth({ is_valid: true, expires_at: now / 1000 + 3600 }, now).state, 'expiring')
assert.equal(describeTokenHealth({ is_valid: true, expires_at: 0, data_access_expires_at: now / 1000 + 3600 }, now).state, 'expiring')
assert.equal(describeTokenHealth({ is_valid: true, expires_at: 0 }, now).expiresAt, null)
const checked = await getFacebookConnection(async (url, options) => {
  if (url.includes('/debug_token')) {
    assert.equal(options.headers.Authorization, 'Bearer app-123|app-secret')
    return new Response(JSON.stringify({ data: { is_valid: true, expires_at: 0 } }))
  }
  return new Response(JSON.stringify({ id: 'page-123', name: 'AssetX Page' }))
}, { ...config, appId: 'app-123' })
assert.equal(checked.tokenHealth.state, 'valid')
assert.doesNotMatch(JSON.stringify(checked), /secret-token|app-secret/)
// ── ตรวจสถานะโพสต์จริงบน Facebook (10 พ.ย. 2569) ──
const graphError = (code, subcode, message) => new Response(JSON.stringify({ error: { code, ...(subcode ? { error_subcode: subcode } : {}), message } }), { status: 400 })
const at = Date.parse('2026-11-10T06:00:00Z')
const fakeGraph = (routes) => async (url) => {
  assert.doesNotMatch(url, /secret-token/)
  const node = url.split('/v26.0/')[1].split('?')[0]
  const fields = new URL(url).searchParams.get('fields')
  const hit = routes[`${node}|${fields}`] ?? routes[node]
  if (!hit) throw new Error(`unexpected ${node} ${fields}`)
  return typeof hit === 'function' ? hit() : new Response(JSON.stringify(hit))
}
const POST_FIELDS = 'id,created_time,is_published,is_hidden,scheduled_publish_time,permalink_url'
// รูปที่ตั้งเวลาไว้แล้วเลยเวลา (กรณี #32): รูปมี page_story_id → โพสต์ is_published=false และเวลาผ่านไปแล้ว
const stuck = await checkFacebookPost('122208271406901474', fakeGraph({
  '122208271406901474': { id: '122208271406901474', page_story_id: 'page-123_999' },
  'page-123_999': { id: 'page-123_999', is_published: false, scheduled_publish_time: Math.floor(Date.parse('2026-11-10T04:30:00Z') / 1000) },
}), config, at)
assert.equal(stuck.state, 'stuck')
assert.equal(stuck.storyId, 'page-123_999')
assert.equal(stuck.scheduledAt, '2026-11-10T04:30:00.000Z')
// ยังไม่ถึงเวลา
const waiting = await checkFacebookPost('1001', fakeGraph({
  1001: { id: '1001', page_story_id: 'page-123_1' },
  'page-123_1': { id: 'page-123_1', is_published: false, scheduled_publish_time: '2026-11-11T02:00:00+0000' },
}), config, at)
assert.equal(waiting.state, 'scheduled')
// เผยแพร่แล้ว + ลิงก์
const live = await checkFacebookPost('1002', fakeGraph({
  1002: { id: '1002', page_story_id: 'page-123_2', link: 'https://www.facebook.com/photo/?fbid=1002' },
  'page-123_2': { id: 'page-123_2', is_published: true, is_hidden: false, created_time: '2026-11-10T04:30:05+0000', permalink_url: 'https://www.facebook.com/page/posts/2' },
}), config, at)
assert.deepEqual([live.state, live.permalink, live.createdTime], ['published', 'https://www.facebook.com/page/posts/2', '2026-11-10T04:30:05.000Z'])
// รหัสโพสต์ข้อความ (ไม่ใช่รูป): ถามแบบรูปได้ error ฟิลด์ → ถามแบบโพสต์
const textPost = await checkFacebookPost('1003', fakeGraph({
  '1003|id,created_time,link,page_story_id': () => graphError(100, null, '(#100) Tried accessing nonexisting field (page_story_id) on node type (Post)'),
  [`1003|${POST_FIELDS}`]: { id: '1003', is_published: true, is_hidden: true },
}), config, at)
assert.equal(textPost.state, 'hidden')
// ไม่มีโพสต์นี้ (ถูกลบ/โพสต์ไม่สำเร็จ)
assert.equal((await checkFacebookPost('1004', fakeGraph({ 1004: () => graphError(100, 33, 'Unsupported get request. Object with ID does not exist') }), config, at)).state, 'not_found')
// มีรูปแต่ไม่มีโพสต์บนหน้าเพจ
assert.equal((await checkFacebookPost('1005', fakeGraph({ 1005: { id: '1005', link: 'https://www.facebook.com/photo/?fbid=1005' } }), config, at)).state, 'photo_only')
// โทเคนหมดอายุ = โยนข้อผิดพลาดตามเดิม ไม่เดาว่าไม่มีโพสต์
await assert.rejects(checkFacebookPost('1006', fakeGraph({ 1006: () => graphError(190, 463, 'expired') }), config, at), /หมดอายุ/)
await assert.rejects(checkFacebookPost('abc', fakeGraph({}), config, at), /รหัสโพสต์ Facebook ไม่ถูกต้อง/)

console.log('marketing facebook tests passed')

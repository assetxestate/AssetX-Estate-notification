import assert from 'node:assert/strict'
import { describeTokenHealth, getFacebookConnection, parseImageDataUrl, parseScheduledAt, publishFacebookPost } from './marketing-facebook.js'

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
console.log('marketing facebook tests passed')

import assert from 'node:assert/strict'
import { getFacebookConnection, parseImageDataUrl, parseScheduledAt, publishFacebookPost } from './marketing-facebook.js'

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
assert.deepEqual(connection, {
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

console.log('marketing facebook tests passed')

import assert from 'node:assert/strict'
import test from 'node:test'
import { marketingChannelSetup, validateManualPublicationReference } from './marketingChannels.js'

test('all five marketing channels have a clear preparation step', () => {
  assert.deepEqual(marketingChannelSetup.map(channel => channel.id), ['facebook', 'instagram', 'tiktok', 'youtube-shorts', 'line-oa'])
  assert.ok(marketingChannelSetup.every(channel => channel.preparation && channel.managerUrl.startsWith('https://')))
})

test('manual publication accepts only evidence matching the chosen channel', () => {
  assert.equal(validateManualPublicationReference('instagram', 'https://www.instagram.com/reel/ABC123/').ok, true)
  assert.equal(validateManualPublicationReference('tiktok', 'https://www.tiktok.com/@assetx/video/123456789').ok, true)
  assert.equal(validateManualPublicationReference('youtube-shorts', 'https://youtube.com/shorts/abc123').ok, true)
  assert.equal(validateManualPublicationReference('youtube-shorts', 'https://youtu.be/abc123').ok, true)
  assert.equal(validateManualPublicationReference('youtube-shorts', 'https://youtube.com/watch?v=abc123').ok, true)
  assert.equal(validateManualPublicationReference('line-oa', 'broadcast-123').ok, true)
  assert.equal(validateManualPublicationReference('instagram', 'https://www.tiktok.com/@assetx/video/123').ok, false)
  assert.equal(validateManualPublicationReference('tiktok', 'http://www.tiktok.com/@assetx/video/123').ok, false)
  assert.equal(validateManualPublicationReference('youtube-shorts', 'https://evil.com/shorts/abc123').ok, false)
  assert.equal(validateManualPublicationReference('line-oa', '').ok, false)
  assert.equal(validateManualPublicationReference('facebook', 'https://facebook.com/post/1').ok, false)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { CHANNEL_ORDER, CHANNELS, channelMeta, channelOfIdea, channelOfUrl, countByChannel } from './ideaChannels.js'

// รูปแถวแบบในคิวจริง 12 พ.ย. 2569 (node .local/ideas-by-channel.mjs): social/social_fb ลิงก์ facebook.com · news ลิงก์ news.google.com · youtube · official ไม่มีลิงก์
test('ช่องทางจากแหล่งที่ตัวเก็บตั้ง: เพจ Facebook · แอดคู่แข่ง · YouTube · ข่าว · ทางการ · ขายทอดตลาด · ชุมชน · ลีดของเรา', () => {
  assert.equal(channelOfIdea({ source: 'social', subtype: 'social_fb', url: 'https://www.facebook.com/somepage/posts/1' }), 'facebook')
  assert.equal(channelOfIdea({ source: 'social', subtype: 'social_fb', url: '' }), 'facebook', 'ตัวเฝ้าเพจเป็น Facebook แม้ไม่มีลิงก์')
  assert.equal(channelOfIdea({ source: 'social', subtype: 'ad_library', url: 'https://www.facebook.com/ads/library/?id=1' }), 'meta_ads', 'แอดคู่แข่งแยกจากโพสต์เพจ')
  assert.equal(channelOfIdea({ source: 'youtube', subtype: 'competitor', url: 'https://www.youtube.com/watch?v=x' }), 'youtube')
  assert.equal(channelOfIdea({ source: 'news', subtype: 'valuation', url: 'https://news.google.com/rss/articles/abc' }), 'news')
  assert.equal(channelOfIdea({ source: 'news', subtype: 'scam', url: 'https://www.matichon.co.th/x' }), 'news', 'ข่าวลิงก์ตรงสำนักข่าวก็ยังเป็นข่าว')
  assert.equal(channelOfIdea({ source: 'official', subtype: 'rate', url: null }), 'official')
  assert.equal(channelOfIdea({ source: 'auction', subtype: 'auction_npa' }), 'auction')
  assert.equal(channelOfIdea({ source: 'community', subtype: 'community_q' }), 'community')
  assert.equal(channelOfIdea({ source: 'internal', subtype: 'internal' }), 'internal')
  assert.equal(channelOfIdea({ source: 'internal', subtype: 'offer' }), 'offer', 'โปสเตอร์ประกาศบริการของเราแยกจากลีด')
  assert.equal(CHANNEL_ORDER[0], 'offer', 'ชิปบริการของเราขึ้นก่อน')
})

test('ไอเดียที่วางเอง: ดูโดเมนลิงก์ (TikTok · Instagram · X · YouTube · Facebook) · ไม่รู้จัก = วางเอง', () => {
  assert.equal(channelOfIdea({ source: 'manual', url: 'https://www.tiktok.com/@a/video/1' }), 'tiktok')
  assert.equal(channelOfIdea({ source: 'manual', url: 'https://instagram.com/p/abc' }), 'instagram')
  assert.equal(channelOfIdea({ source: 'manual', url: 'https://x.com/a/status/1' }), 'x')
  assert.equal(channelOfIdea({ source: 'manual', url: 'https://twitter.com/a/status/1' }), 'x')
  assert.equal(channelOfIdea({ source: 'manual', url: 'https://youtu.be/abc' }), 'youtube')
  assert.equal(channelOfIdea({ source: 'manual', url: 'https://m.facebook.com/story.php?id=1' }), 'facebook')
  assert.equal(channelOfIdea({ source: 'manual', url: 'https://example.com/a' }), 'manual')
  assert.equal(channelOfIdea({ source: 'manual' }), 'manual')
  assert.equal(channelOfIdea({}), 'manual')
  assert.equal(channelOfUrl('not a url'), '')
  assert.equal(channelOfUrl('https://notfacebook.com/x'), '', 'โดเมนที่แค่ลงท้ายคล้ายกันไม่นับ')
})

test('นับต่อช่องทาง + ทุกช่องทางมีชื่อ/สี/รูป และอยู่ในลำดับชิป', () => {
  const rows = [
    { source: 'social', subtype: 'social_fb' }, { source: 'social', subtype: 'social_fb' },
    { source: 'social', subtype: 'ad_library' }, { source: 'news' }, { source: 'youtube' },
  ]
  assert.deepEqual(countByChannel(rows), { facebook: 2, meta_ads: 1, news: 1, youtube: 1 })
  assert.deepEqual(countByChannel([{ kind: 'radar' }], () => 'radar'), { radar: 1 })
  for (const key of Object.keys(CHANNELS)) {
    const c = CHANNELS[key]
    assert.ok(CHANNEL_ORDER.includes(key), `${key} ต้องอยู่ใน CHANNEL_ORDER`)
    assert.ok(c.label && c.hint && /^#[0-9A-F]{6}$/i.test(c.color), key)
    assert.ok(Boolean(c.path) !== Boolean(c.icon), `${key} ต้องมีโลโก้หรือไอคอนอย่างใดอย่างหนึ่ง`)
    assert.doesNotMatch(c.path || c.icon, /__SI_/, `${key} ยังไม่ได้เติม path โลโก้`)
  }
  assert.equal(CHANNEL_ORDER.length, Object.keys(CHANNELS).length)
  assert.equal(channelMeta('ไม่มี'), CHANNELS.manual)
})

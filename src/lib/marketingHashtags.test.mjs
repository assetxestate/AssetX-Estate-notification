import assert from 'node:assert/strict'
import { appendMarketingHashtags, runAssetxMarketingModel, reviewAssetxContent } from './assetxMarketingModel.js'

assert.equal(appendMarketingHashtags('ข้อความ #AssetXEstate', ['AssetXEstate', '#ขายฝาก', 'ขายฝาก']), 'ข้อความ #AssetXEstate\n\n#ขายฝาก')
assert.equal(appendMarketingHashtags('ข้อความ', []), 'ข้อความ')
const facebook = runAssetxMarketingModel({ prompt: 'ขายฝาก เช็กเงื่อนไขก่อนตัดสินใจ', channel: 'facebook' })
assert.match(facebook.caption, /#AssetXEstate/)
assert.match(facebook.caption, /#ขายฝาก/)
assert.equal(facebook.automationPayload.postText, facebook.caption)
assert.equal(appendMarketingHashtags(facebook.caption, facebook.hashtags), facebook.caption)
assert.equal(reviewAssetxContent({ ...facebook, topic: 'ขายฝาก เช็กเงื่อนไขก่อนตัดสินใจ' }).ok, true)
const purchase = runAssetxMarketingModel({ prompt: 'ก่อนซื้อที่ดิน', channel: 'facebook' })
assert.match(purchase.caption, /#ตรวจสอบก่อนซื้อ/)
assert.doesNotMatch(purchase.caption, /#ขายฝาก/)
const line = runAssetxMarketingModel({ prompt: 'ก่อนซื้อที่ดิน', channel: 'line-oa' })
assert.doesNotMatch(line.caption, /#AssetXEstate/)
console.log('marketing hashtag tests passed')

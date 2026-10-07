import assert from 'node:assert/strict'
import { prioritizeMarketingIdeas, isRedemptionIdea, redemptionIdeas } from './marketingIdeaMix.js'

const ideas = Array.from({ length: 30 }, (_, index) => ({
  id: index, title: index < 21 ? 'เตรียมขายฝาก' : 'ก่อนซื้อทรัพย์', score: index,
}))
const original = JSON.stringify(ideas)
const result = prioritizeMarketingIdeas(ideas)
for (let start = 0; start < 30; start += 10) {
  assert.equal(result.slice(start, start + 10).filter(isRedemptionIdea).length, 7)
}
assert.equal(new Set(result.map(idea => idea.id)).size, 30)
assert.equal(JSON.stringify(ideas), original)
assert.deepEqual(prioritizeMarketingIdeas([]), [])
assert.equal(prioritizeMarketingIdeas(ideas.slice(0, 3)).length, 3)
assert.equal(prioritizeMarketingIdeas(ideas.slice(21)).length, 9)
assert.equal(isRedemptionIdea({ title: 'ก่อนซื้อที่ดิน', angle: 'แบรนด์ขายฝาก' }), false)
assert.ok(redemptionIdeas.every(isRedemptionIdea))
console.log('marketing idea mix tests passed')

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAssetxMarketingInput, runAssetxMarketingModel, reviewAssetxContent, canPublishAssetxPost } from './assetxMarketingModel.js'
import { getPrompts, runMarketingModelWithLLM } from './marketing-model/index.js'

const prompt = 'ข้อควรรู้ก่อนซื้อที่ดินเปล่า ทั้งทำเลทอง'
const studio = { prompt, channel: 'facebook', contentType: 'educate', objective: 'lead_owner', offer: 'วางทางเลือกขายฝาก/จำนอง' }

test('Facebook explains practical checks without expanding short channels or video', () => {
  const brief = { ...studio, prompt: 'ก่อนทำขายฝากควรเตรียมอะไร' }
  const facebook = runAssetxMarketingModel(brief)
  const line = runAssetxMarketingModel({ ...brief, channel: 'line-oa' })
  assert.ok(facebook.caption.length > 1200)
  assert.ok(facebook.caption.length < 2400)
  assert.ok(facebook.caption.length > line.caption.length * 2)
  assert.equal(facebook.videoScript, line.videoScript)
  assert.match(facebook.caption, /เงินที่ได้รับจริง/)
  assert.match(facebook.caption, /ลายลักษณ์อักษร/)
  assert.match(facebook.caption, /ปิดข้อมูลส่วนบุคคล/)
  assert.equal(reviewAssetxContent({ ...facebook, topic: brief.prompt }).ok, true)
})

test('passes original topic and keeps purchase content separate from default lending offer', () => {
  const input = buildAssetxMarketingInput(studio)
  assert.equal(input.topic, prompt)
  const out = runAssetxMarketingModel(studio)
  assert.ok(out.caption.includes(prompt))
  assert.match(out.caption, /เอกสารสิทธิ์/)
  assert.match(out.caption, /ทางเข้าออก/)
  assert.doesNotMatch([out.caption, out.videoScript, ...out.hashtags].join(' '), /ไถ่ถอน|สินไถ่|ขายฝาก|จำนอง|ชลบุรี/)
  assert.equal(out.automationPayload.postText, out.caption)
  assert.ok(out.caption.endsWith(out.hashtags.map(h => '#' + h).join(' ')))
  assert.equal(out.meta.blocking, false)
  assert.equal(reviewAssetxContent({ ...out, topic: prompt, status: 'pending' }).ok, true)
})

test('topics change captions, images and video without unsupported facts', () => {
  for (const topic of ['ก่อนขายที่ดิน', 'ก่อนจำนอง', 'เตรียมไถ่ถอนขายฝาก', 'ขายฝากกับจำนองต่างกันอย่างไร', 'มีโฉนด แต่ไม่อยากขายขาด']) {
    const out = runAssetxMarketingModel({ ...studio, prompt: topic })
    assert.ok(out.caption.includes(topic))
    assert.notEqual(out.imagePrompt, runAssetxMarketingModel(studio).imagePrompt)
    assert.equal(reviewAssetxContent({ ...out, topic }).ok, true, topic)
    assert.doesNotMatch(out.caption, /ไม่มีค่าใช้จ่าย|อนุมัติแน่นอน|วันนี้ทีมลงพื้นที่/)
  }
})

test('LINE has no hashtags; unknown topics stop at draft', () => {
  assert.deepEqual(runAssetxMarketingModel({ ...studio, channel: 'line-oa' }).hashtags, [])
  const out = runAssetxMarketingModel({ ...studio, prompt: 'สูตรทำขนม' })
  assert.equal(out.meta.blocking, true)
  assert.equal(reviewAssetxContent({ ...out, topic: 'สูตรทำขนม' }).ok, false)
})

test('content review is independent of approval but publishing requires both', () => {
  const good = { ...runAssetxMarketingModel(studio), topic: prompt, channel: 'facebook', status: 'pending' }
  assert.equal(reviewAssetxContent(good).ok, true)
  assert.equal(canPublishAssetxPost(good).code, 'not_approved')
  assert.equal(canPublishAssetxPost({ ...good, status: 'approved' }).ok, true)
  for (const caption of ['อนุมัติทุกคน ได้เงินแน่นอน', 'ก่อนซื้อที่ดิน ตรวจยอดสินไถ่และวันไถ่ถอน']) {
    assert.equal(canPublishAssetxPost({ ...good, status: 'approved', caption }).ok, false)
  }
  assert.equal(reviewAssetxContent({ caption: 'ก่อนซื้อที่ดิน\nตรวจยอดสินไถ่' }).ok, false)
})

test('LLM prompts retain topic and LLM output is checked again', async () => {
  const input = buildAssetxMarketingInput(studio)
  assert.ok(JSON.stringify(getPrompts(input)).includes(prompt))
  const out = await runMarketingModelWithLLM(input, {
    parts: ['caption'], generate: async () => ({ caption: 'ก่อนซื้อที่ดิน ให้ตรวจยอดสินไถ่', headline: 'ซื้อที่ดิน' }),
  })
  assert.equal(out.meta.blocking, true)
  assert.ok(out.meta.findings.some(f => f.id === 'topic_mismatch'))
})

test('saved warnings do not contaminate a fresh review or hide real errors', () => {
  const post = {
    ...runAssetxMarketingModel(studio), topic: prompt,
    reviewStatus: 'needs_edit',
    reviewNotes: ['[บริบทแคมเปญ] มีข้อความรับประกันการอนุมัติ', '[ข้อเสนอที่กรอกมา] อาจมีข้อมูลที่ระบุตัวบุคคล'],
  }
  const review = reviewAssetxContent(post)
  assert.equal(review.ok, true)
  assert.doesNotMatch(review.notes.join('\n'), /บริบทแคมเปญ|ข้อเสนอที่กรอกมา/)
  assert.equal(reviewAssetxContent({ ...post, caption: 'อนุมัติแน่นอน' }).ok, false)
  assert.equal(post.reviewNotes.length, 2, 'Reading review must not mutate the saved draft')
})

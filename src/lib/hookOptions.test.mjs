import test from 'node:test'
import assert from 'node:assert/strict'
import { swapOpeningLine, openingLineOf, isCurrentHook, hookOptionsFor, videoScriptFromDraft } from './hookOptions.js'
import { applyAiDraft, applyHookChoice, aiDraftReviewNotes } from './assetxMarketingModel.js'

const caption = 'ก่อนเซ็นขายฝาก อ่าน 3 บรรทัดนี้ในสัญญาให้ครบ\n\nทั้งสามบรรทัดผูกพันจริงหลังจดที่สำนักงานที่ดิน\n\n1. ราคา: ตรงกับที่จด\n\n2. วันครบกำหนด: นับจากวันจด\n\n3. สินไถ่: ไม่เกินเพดาน\n\nข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี\n\nส่งรูปสัญญามาทางแชต ทีม AssetX Estate ช่วยดูให้'
const hooks = [
  { pattern: 'specific-checklist', name: 'เช็กจุดที่จับต้องได้', line: 'ก่อนเซ็นขายฝาก อ่าน 3 บรรทัดนี้ในสัญญาให้ครบ', headline: '3 บรรทัดก่อนเซ็นขายฝาก', score: 85, used: true, bad: [] },
  { pattern: 'can-i', name: 'ทำได้ไหม', line: 'ขายฝากแล้ว ไถ่ก่อนครบกำหนดได้ไหม', headline: 'ไถ่ก่อนครบกำหนด ได้ไหม', score: 90, used: false, bad: [] },
  { pattern: 'other', name: 'แต่งเอง', line: '  ', score: 10 },
]

test('swapOpeningLine / openingLineOf / isCurrentHook', () => {
  assert.equal(openingLineOf('\n\n  สวัสดี\nต่อ'), 'สวัสดี')
  assert.equal(swapOpeningLine(caption, 'ใหม่').split('\n')[0], 'ใหม่')
  assert.equal(swapOpeningLine(caption, 'ใหม่').split('\n').length, caption.split('\n').length)
  assert.equal(isCurrentHook(hooks[0], caption), true)
  assert.equal(isCurrentHook(hooks[1], caption), false)
  assert.equal(isCurrentHook(hooks[0], `${hooks[0].line} (แก้นิดหน่อย)\n\nต่อ`), true, 'คนตรวจเติมท้ายบรรทัดเล็กน้อยยังนับเป็นตัวเดิม')
})

test('hookOptionsFor: เรียงคะแนน · ทิ้งบรรทัดว่าง · ไม่ถึง 2 แบบ = ไม่โชว์', () => {
  const list = hookOptionsFor(hooks)
  assert.deepEqual(list.map((h) => h.pattern), ['can-i', 'specific-checklist'])
  assert.deepEqual(hookOptionsFor([hooks[0]]), [])
  assert.deepEqual(hookOptionsFor(null), [])
})

test('videoScriptFromDraft: 0–3 วิเปิดด้วย hook · ไม่เอาบรรทัดกำกับ/CTA มาเป็นเนื้อ · มีข้อ 1–3', () => {
  const s = videoScriptFromDraft({ caption, cta: 'ส่งรูปสัญญามาทางแชต ทีม AssetX Estate ช่วยดูให้' })
  const lines = s.split('\n')
  assert.match(lines[0], /^0–3 วิ .*: ก่อนเซ็นขายฝาก อ่าน 3 บรรทัดนี้ในสัญญาให้ครบ$/)
  assert.match(lines[1], /^3–6 วิ .*ทั้งสามบรรทัดผูกพันจริง/)
  assert.match(s, /เนื้อหา: 1\) ราคา · 2\) วันครบกำหนด · 3\) สินไถ่/)
  assert.match(s, /ปิด: ส่งรูปสัญญามาทางแชต/)
  assert.equal(videoScriptFromDraft({ caption: '' }), '')
})

test('applyAiDraft + applyHookChoice: ร่างที่มี hooks ได้สคริปต์วิดีโอเปิดด้วย hook · สลับ hook = แคปชั่น พาดหัว สคริปต์ และ postText เปลี่ยนตาม · ร่างเก่าที่ไม่มี hooks ไม่เปลี่ยน', () => {
  const base = { headline: 'แม่แบบ', caption: 'แม่แบบ', videoScript: 'สคริปต์แม่แบบ', hashtags: ['AssetXEstate'], meta: {} }
  const draft = { headline: '3 บรรทัดก่อนเซ็นขายฝาก', caption, cta: 'ส่งรูปสัญญามาทางแชต ทีม AssetX Estate ช่วยดูให้', hashtags: ['ขายฝาก'], hooks, hook_pattern: 'specific-checklist', hook_score: 85 }
  const g = applyAiDraft(base, draft)
  assert.match(g.videoScript, /^0–3 วิ/)
  assert.equal(g.meta.hookPattern, 'specific-checklist')
  assert.equal(g.meta.hooks.length, 3)
  assert.ok(aiDraftReviewNotes(g).some((n) => /ประโยคเปิดสูตร "เช็กจุดที่จับต้องได้" คะแนน 85\/100 · มีทางเลือกอีก 2 แบบ/.test(n)))
  const swapped = applyHookChoice(g, hooks[1])
  assert.equal(swapped.caption.split('\n')[0], hooks[1].line)
  assert.equal(swapped.headline, hooks[1].headline)
  assert.equal(swapped.automationPayload.postText, swapped.caption)
  assert.match(swapped.videoScript, /^0–3 วิ .*ไถ่ก่อนครบกำหนดได้ไหม/)
  assert.equal(swapped.meta.hookPattern, 'can-i')
  const old = applyAiDraft(base, { ...draft, hooks: undefined, hook_pattern: undefined })
  assert.equal(old.videoScript, 'สคริปต์แม่แบบ', 'ร่างก่อนมีระบบ hook ใช้สคริปต์แม่แบบเหมือนเดิม')
  assert.ok(!aiDraftReviewNotes(old).some((n) => /ประโยคเปิดสูตร/.test(n)))
})

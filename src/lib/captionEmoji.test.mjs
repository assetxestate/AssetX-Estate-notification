import test from 'node:test'
import assert from 'node:assert/strict'
import { countEmoji, decorateCaption, hasEmoji, stripEmoji } from './captionEmoji.js'
import { videoScriptFromDraft } from './hookOptions.js'
import { cleanCaption } from './posterBrief.js'
import { applyAiDraft } from './assetxMarketingModel.js'
import { buildPosterJobPrompt } from '../../server/marketing-image-jobs.js'
import { scrubDraftText } from '../../server/research/drafts.js'

const CTA = 'ส่งรูปเอกสารสิทธิ์ทางแชตเพื่อประเมินเบื้องต้น'
const CAPTION = [
  'ก่อนเซ็นขายฝาก ดูยอดรับสุทธิหรือยัง',
  'หลายคนดูแค่วงเงิน แต่เงินที่ถึงมือจริงต้องหักค่าธรรมเนียมและภาษีก่อน',
  '',
  '1. ค่าธรรมเนียมจดทะเบียน: สอบถามสำนักงานที่ดินก่อนวันนัด',
  '2. ภาษีและอากร: ขึ้นกับราคาประเมินของทรัพย์',
  '3. ยอดสินไถ่: ตรวจในสัญญาให้ตรงกับที่ตกลง',
  '',
  'ถาม: ไถ่คืนก่อนกำหนดได้ไหม',
  'ตอบ: ได้ตามสัญญา ต้องดูเงื่อนไขของแต่ละฉบับ',
  '',
  'ข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี',
  '',
  CTA,
].join('\n')

test('decorateCaption วางอีโมจิตามโครงโพสต์ ไม่แตะบรรทัดแรก (hook)', () => {
  const out = decorateCaption(CAPTION, { cta: CTA }).split('\n')
  assert.equal(out[0], 'ก่อนเซ็นขายฝาก ดูยอดรับสุทธิหรือยัง')
  assert.match(out[1], /^🧾 หลายคนดูแค่วงเงิน/)
  assert.equal(out[3], '1️⃣ ค่าธรรมเนียมจดทะเบียน: สอบถามสำนักงานที่ดินก่อนวันนัด')
  assert.match(out[4], /^2️⃣ ภาษีและอากร/)
  assert.match(out[5], /^3️⃣ ยอดสินไถ่/)
  assert.match(out[7], /^❓ ถาม:/)
  assert.match(out[8], /^💡 ตอบ:/)
  assert.match(out[10], /^📌 ข้อมูลนี้เป็นความรู้ทั่วไป/)
  assert.equal(out[12], `👉 ${CTA}`)
})

test('ถอดอีโมจิแล้วได้ข้อความเดิมทุกตัวอักษร · ใส่ซ้ำไม่เพิ่ม', () => {
  const decorated = decorateCaption(CAPTION, { cta: CTA })
  assert.equal(stripEmoji(decorated), CAPTION)
  assert.equal(decorateCaption(decorated, { cta: CTA }), decorated)
  assert.equal(stripEmoji(CAPTION), CAPTION)
})

test('ร่างที่มีอีโมจิอยู่ 1 ตัว (กติกาเดิม) ยังได้อีโมจิ · บรรทัดเดิมไม่แตะ · ใส่ซ้ำไม่เพิ่ม', () => {
  const one = CAPTION.replace('ถาม: ไถ่คืน', '🤔 ถาม: ไถ่คืน')
  const out = decorateCaption(one, { cta: CTA })
  assert.match(out, /^🤔 ถาม: ไถ่คืน/m)
  assert.doesNotMatch(out, /❓/)
  assert.match(out, /^1️⃣ /m)
  assert.equal(decorateCaption(out, { cta: CTA }), out)
  assert.equal(stripEmoji(out), CAPTION)
})

test('ไม่มีอีโมจิเงิน/เร่ง/ฉลอง · ย่อหน้าเนื้อหาได้อีโมจิไม่เกิน 3 ย่อหน้าและไม่ซ้ำกัน', () => {
  const paragraphs = [
    'ทำไมต้องรู้เรื่องนี้ก่อนเซ็น',
    '', 'โฉนดที่ดินต้องตรวจชื่อเจ้าของให้ตรงกับบัตรก่อนวันโอน',
    '', 'โฉนดอีกฉบับก็ต้องตรวจภาระผูกพันที่ด้านหลังทุกครั้ง',
    '', 'สัญญาขายฝากต้องระบุวันครบกำหนดไถ่ให้ชัดเจน',
    '', 'ค่าธรรมเนียมและภาษีควรแยกให้เห็นก่อนวันจดทะเบียน',
    '', 'บ้านพร้อมที่ดินมีขั้นตอนตรวจมากกว่าที่ดินเปล่าเล็กน้อย',
  ].join('\n')
  const out = decorateCaption(paragraphs)
  assert.doesNotMatch(out, /💰|💸|🤑|🔥|⏰|🚨|🎉|📈|❗/u)
  const leads = out.split('\n').filter((l) => /^\p{Extended_Pictographic}/u.test(l)).map((l) => [...l][0])
  assert.equal(leads.length, 3)
  assert.equal(new Set(leads).size, 3)
})

test('แฮชแท็ก หัวข้อย่อย และ CTA ก่อนแฮชแท็ก', () => {
  const caption = ['เช็กก่อนเซ็นสัญญา 3 จุด', '', '- ชื่อในโฉนด', '- วันครบกำหนด', '', 'ทักแชตส่งรูปโฉนดเพื่อประเมินเบื้องต้น', '', '#AssetXEstate #ขายฝาก'].join('\n')
  const out = decorateCaption(caption).split('\n')
  assert.equal(out[2], '- ชื่อในโฉนด')
  assert.equal(out[5], '👉 ทักแชตส่งรูปโฉนดเพื่อประเมินเบื้องต้น')
  assert.equal(out[7], '#AssetXEstate #ขายฝาก')
})

test('stripEmoji: ติ๊กหน้าบรรทัดเป็น "- " · กลางประโยคยุบช่องว่าง · ลำดับ ZWJ และเลข 10', () => {
  assert.equal(stripEmoji('✅ ตรวจชื่อในโฉนด\n✔️ ตรวจภาระผูกพัน'), '- ตรวจชื่อในโฉนด\n- ตรวจภาระผูกพัน')
  assert.equal(stripEmoji('ส่งรูป 📷 มาทางแชต'), 'ส่งรูป มาทางแชต')
  assert.equal(stripEmoji('ครอบครัว 👨‍👩‍👧 ตกลงกันก่อน'), 'ครอบครัว ตกลงกันก่อน')
  assert.equal(stripEmoji('🔟 ข้อสุดท้าย'), '10. ข้อสุดท้าย')
  assert.equal(countEmoji('1️⃣ ก 📌 ข 👨‍👩‍👧'), 3)
  assert.equal(hasEmoji('ขั้นตอน → ถัดไป • ข้อ ✓'), false)
})

test('โปสเตอร์ทุกโหมด และสคริปต์วิดีโอ ได้ผลเหมือนแคปชั่นไม่มีอีโมจิ', () => {
  const decorated = decorateCaption(CAPTION, { cta: CTA })
  for (const mode of ['ref', 'free', 'premium']) {
    assert.equal(buildPosterJobPrompt({ title: 'ยอดรับสุทธิ', caption: decorated, mode, seed: 3 }), buildPosterJobPrompt({ title: 'ยอดรับสุทธิ', caption: CAPTION, mode, seed: 3 }), mode)
  }
  assert.equal(cleanCaption(decorated), cleanCaption(CAPTION))
  const script = videoScriptFromDraft({ caption: decorated, cta: CTA })
  assert.equal(script, videoScriptFromDraft({ caption: CAPTION, cta: CTA }))
  assert.equal(hasEmoji(script), false)
})

test('applyAiDraft ใส่อีโมจิก่อนต่อแฮชแท็ก · ด่านร่าง AI ถอดอีโมจิที่ AI ใส่มาเอง', () => {
  const generated = applyAiDraft({ headline: 'x', caption: 'x', cta: '', hashtags: [] }, { headline: 'ยอดรับสุทธิ', caption: CAPTION, cta: CTA, hashtags: ['AssetXEstate'] })
  assert.match(generated.caption, /\n👉 ส่งรูปเอกสารสิทธิ์[^\n]*\n\n#AssetXEstate$/)
  assert.equal(generated.automationPayload.postText, generated.caption)
  assert.equal(hasEmoji(generated.videoScript || ''), false)
  assert.equal(scrubDraftText('🔥 ก่อนเซ็นขายฝาก 💰 ดูยอดนี้'), 'ก่อนเซ็นขายฝาก ดูยอดนี้')
})

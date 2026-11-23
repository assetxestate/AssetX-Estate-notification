import test from 'node:test'
import assert from 'node:assert/strict'
import { EDITORIAL_PARTS, ORIGINALITY_PARTS, assessContent, samenessFindings } from './marketingOriginality.js'
import { buildReviewGate } from './marketingReviewGate.js'

// ข้อมูลสมมติทั้งหมด — ไม่ใช่เคสลูกค้าจริง
const NOW = Date.parse('2026-11-23T05:00:00Z')
const brief = { id: 1, topic: 'ที่ดินติดถนนใหญ่เหมือนกัน ทำไมมูลค่าต่างกัน', unique_insight: 'ติดถนนใหญ่ไม่ได้แปลว่าเข้าออกได้เหมือนกันทุกแปลง', intended_takeaway: 'ไปยืนหน้าแปลงแล้วดูว่ารถเข้าออกจริงได้ทางไหน', field: { observations: ['หน้าแปลงติดทางคู่ขนาน ต้องอ้อมเข้า', 'ไม่มีจุดกลับรถใกล้แปลง', 'แปลงข้างเคียงเข้าได้จากถนนหลักโดยตรง'], unknowns: ['สิทธิทางเข้าออกตามเอกสาร'] } }
const claim = { id: 3, claim_text: 'ราคาเสนอขายของแปลงใกล้เคียงอยู่ในระดับใกล้กัน', claim_type: 'MARKET-ASK', category: 'price', status: 'verified', use_in_post: true, limitation: 'ยังไม่ใช่ราคาที่ขายได้', publishable_wording: '', permission_status: 'unknown', expires_at: null }
const proof = { brief, claims: [claim], sources: [{ id: 1, kind: 'listing', title: 'ประกาศขายออนไลน์', checked_at: '2026-11-20', permission_status: 'granted', visibility: 'public' }], links: [{ claim_id: 3, source_id: 1 }] }

const strong = 'ติดถนนใหญ่ไม่ได้แปลว่าเข้าออกได้เหมือนกันทุกแปลงครับ\n\nจากที่ไปดูหน้างาน หน้าแปลงติดทางคู่ขนาน ต้องอ้อมเข้า และไม่มีจุดกลับรถใกล้แปลง ส่วนแปลงข้างเคียงเข้าได้จากถนนหลักโดยตรง ผู้ประเมินจึงมองสองแปลงนี้ต่างกัน เพราะสิ่งที่ต้องดูคือเส้นทางที่รถใช้จริง\n\nราคาเสนอขายของแปลงใกล้เคียงอยู่ในระดับใกล้กัน แต่ยังไม่ใช่ราคาที่ขายได้ ดังนั้นจะใช้เป็นตัวตั้งตรง ๆ ไม่ได้ และสิทธิทางเข้าออกตามเอกสารยังต้องตรวจ\n\nลองเช็ก 3 เรื่องนี้กับที่ดินของคุณ\n1. รถเข้าจากถนนหลักได้โดยตรงไหม\n2. มีจุดกลับรถใกล้แปลงไหม\n3. เอกสารระบุสิทธิทางเข้าออกไว้อย่างไร\n\nไปยืนหน้าแปลงแล้วดูว่ารถเข้าออกจริงได้ทางไหน ก่อนเทียบราคากับแปลงข้าง ๆ'
const generic = 'ในปัจจุบันที่ดินทำเลดีมีมูลค่าเพิ่มขึ้นเรื่อย ๆ และเป็นการลงทุนที่ตอบโจทย์\n\nปัจจัยที่มีผลต่อราคาที่ดิน\n1. ทำเล\n2. ศักยภาพ\n3. สภาพคล่อง\n\nบริการครบวงจร ยกระดับการประเมินให้ทันสมัย ทักมาได้เลย'
const assess = (caption, withProof = true, library = []) => {
  const post = { title: brief.topic, caption, channel: 'facebook', draftSource: 'brief' }
  const gate = buildReviewGate(post, withProof ? proof : null, { now: NOW })
  return assessContent(post, { proof: withProof ? proof : null, gate, library })
}

test('คะแนนแยกสามอย่าง และผลรวมของแต่ละมิติไม่เกินเพดาน', () => {
  const result = assess(strong)
  assert.ok(Number.isFinite(result.structural))
  assert.equal(result.originality, result.originality_parts.reduce((sum, part) => sum + part.score, 0))
  assert.equal(result.editorial, result.editorial_parts.reduce((sum, part) => sum + part.score, 0))
  for (const part of [...result.originality_parts, ...result.editorial_parts]) assert.ok(part.score >= 0 && part.score <= part.max, `${part.key} ${part.score}/${part.max}`)
  assert.equal(ORIGINALITY_PARTS.reduce((sum, part) => sum + part.max, 0), 100)
  assert.equal(EDITORIAL_PARTS.reduce((sum, part) => sum + part.max, 0), 100)
})

test('โพสต์จากข้อมูลหน้างานได้คะแนนต้นฉบับสูงกว่าโพสต์กว้าง ๆ มาก และผ่านด่าน 6 ข้อ', () => {
  const good = assess(strong)
  const weak = assess(generic, false)
  assert.ok(good.originality >= 70, `strong ${good.originality}`)
  assert.ok(weak.originality <= 35, `generic ${weak.originality}`)
  assert.deepEqual(good.gates.filter((gate) => !gate.ok).map((gate) => gate.key), [])
  assert.deepEqual(weak.gates.filter((gate) => gate.ok).map((gate) => gate.key), [])
  assert.equal(good.evidence.observations_used, 3)
  assert.equal(good.evidence.claims_used, 1)
  assert.ok(weak.advice.length >= 3)
})

test('เปลี่ยนคำอย่างเดียวไม่ทำให้คะแนนต้นฉบับพุ่ง', () => {
  const base = assess(generic, false)
  const reworded = assess(generic.replace('ในปัจจุบัน', 'ทุกวันนี้').replace('มีมูลค่าเพิ่มขึ้นเรื่อย ๆ', 'ราคาขยับขึ้นต่อเนื่อง').replace('ทักมาได้เลย', 'ติดต่อเราได้'), false)
  assert.ok(Math.abs(reworded.originality - base.originality) <= 5, `${base.originality} → ${reworded.originality}`)
  assert.equal(reworded.originality_parts.find((part) => part.key === 'own').score, 0)
})

test('แต่งตัวเลขหรือเคสเพิ่มไม่ได้คะแนนข้อมูลเฉพาะ และถูกด่านจับ', () => {
  const base = assess(generic, true)
  const faked = assess(`${generic}\n\nเคสล่าสุด ลูกค้าได้วงเงิน 5 ล้านบาท ดอกเบี้ย 1.25% ต่อเดือน อนุมัติใน 3 วัน`, true)
  assert.equal(faked.originality_parts.find((part) => part.key === 'own').score, base.originality_parts.find((part) => part.key === 'own').score)
  assert.equal(faked.blocked, true)
  assert.equal(faked.ready_for_final_review, false)
  assert.equal(faked.gates.find((gate) => gate.key === 'proof').ok, false)
})

test('AC-06: คะแนนสูงแต่ราคาเสนอขายถูกเล่าเป็นราคาซื้อขายจริง → ยังบล็อก คะแนนไม่ลบล้างตัวบล็อก', () => {
  const result = assess(strong.replace('ราคาเสนอขายของแปลงใกล้เคียงอยู่ในระดับใกล้กัน แต่ยังไม่ใช่ราคาที่ขายได้', 'แปลงใกล้เคียงปิดการขายที่ราคาระดับเดียวกัน'))
  assert.ok(result.originality >= 55)
  assert.equal(result.blocked, true)
  assert.equal(result.ready_for_final_review, false)
  assert.equal(result.editorial_parts.find((part) => part.key === 'evidence').score, 0)
})

test('โพสต์ความรู้ทั่วไปที่ถูกต้อง: คะแนนต้นฉบับต่ำตามจริง แต่ไม่ถูกบล็อก และคำแนะนำไม่ให้แต่งเคส', () => {
  const text = 'ขายฝากกับจำนองต่างกันตรงกรรมสิทธิ์ครับ ขายฝากกรรมสิทธิ์โอนไปตั้งแต่วันจดทะเบียน ส่วนจำนองกรรมสิทธิ์ยังอยู่กับเจ้าของ\n\nก่อนเลือก ลองถามตัวเอง 3 ข้อ\n1. เงินที่จะไถ่คืนมาจากไหน\n2. ต้องใช้เงินนานเท่าไร\n3. รับได้ไหมถ้าไถ่ไม่ทันกำหนด\n\nรายละเอียดขึ้นกับแต่ละกรณี ควรยืนยันกับสำนักงานที่ดินก่อนตัดสินใจ'
  const result = assess(text, false)
  assert.equal(result.blocked, false)
  assert.equal(result.originality_parts.find((part) => part.key === 'own').score, 0)
  assert.equal(result.gates.find((gate) => gate.key === 'useful').ok, true)
  assert.equal(result.gates.find((gate) => gate.key === 'honest').ok, true)
  assert.ok(result.advice.some((tip) => /ความรู้ทั่วไป/.test(tip)))
  assert.ok(!result.advice.some((tip) => /แต่งเคส|เพิ่มตัวเลข/.test(tip)))
})

test('ตัวกรองประโยคสำเร็จรูป: เปิดสำเร็จรูป คำกลวง รายการไม่มีเหตุผล ประโยคซ้ำ เปิดซ้ำกับโพสต์เดิม เนื้อหาคล้ายโพสต์เดิม', () => {
  const codes = (caption, library) => samenessFindings(caption, library).findings.map((item) => item.code)
  assert.deepEqual(codes(generic).sort(), ['bare_list', 'generic_opener', 'hollow_words'])
  assert.deepEqual(codes(strong), [])
  assert.ok(codes('ขายฝากต้องดูเงื่อนไขการไถ่คืนให้ชัดเจนก่อนเซ็นทุกครั้ง\n\nขายฝากต้องดูเงื่อนไขการไถ่คืนให้ชัดเจนก่อนเซ็นทุกครั้งนะครับ').includes('repeated_sentence'))
  const old = { caption: strong, contentNo: 12, title: 'โพสต์เดิม' }
  assert.ok(codes(strong, [old]).includes('similar_post'))
  assert.match(samenessFindings(strong, [old]).findings.find((item) => item.code === 'repeated_opener').message, /#12/)
  // ซ้ำกับโพสต์เดิม → คะแนน "ไม่ซ้ำ" เป็นศูนย์
  assert.equal(assess(strong, true, [old]).originality_parts.find((part) => part.key === 'fresh').score, 0)
  assert.equal(assess(strong, true, [{ caption: generic, contentNo: 5 }]).originality_parts.find((part) => part.key === 'fresh').score, 10)
})

test('ผลคงที่: ข้อมูลเดิมได้คะแนนเดิมทุกครั้ง', () => {
  assert.deepEqual(assess(strong), assess(strong))
})

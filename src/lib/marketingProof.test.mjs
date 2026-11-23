import test from 'node:test'
import assert from 'node:assert/strict'
import { briefMissing, canComposeFromBrief, composeProofDraft, containment, evaluateClaims, normalizeBrief, normalizeClaim, normalizeSource, privacyFindings, verifyProblems } from './marketingProof.js'
import { approvalBasis, buildReviewGate } from './marketingReviewGate.js'

// ข้อมูลสมมติทั้งหมด — ไม่ใช่เคสลูกค้าจริง
const NOW = Date.parse('2026-11-23T05:00:00Z')
const source = (id, over = {}) => ({ id, kind: 'official', title: `แหล่งทดสอบ ${id}`, source_url: 'https://example.go.th/doc', checked_at: '2026-11-20', permission_status: 'granted', visibility: 'public', ...over })
const claim = (id, over = {}) => ({ id, claim_text: 'ที่ดินติดทางคู่ขนานมีการเข้าออกต่างจากแปลงที่เข้าจากถนนหลักโดยตรง', claim_type: 'OFFICIAL', category: 'field', status: 'verified', permission_status: 'unknown', use_in_post: true, limitation: '', publishable_wording: '', expires_at: null, ...over })
const link = (claimId, sourceId) => ({ claim_id: claimId, source_id: sourceId })
const brief = (over = {}) => ({ id: 1, mode: 'field', topic: 'ที่ดินติดถนนใหญ่เหมือนกัน ทำไมมูลค่าต่างกัน', audience_problem: '', unique_insight: '', intended_takeaway: '', cta: '', public_location_level: 'none', public_location: '', field: { observations: [], unknowns: [], survey_date: null, lesson: '' }, ...over })

test('บรีฟ: หัวข้อบังคับ ช่องอื่นไม่บังคับ และโหมดลิงก์ต้องมีลิงก์', () => {
  assert.equal(normalizeBrief({ topic: '' }).ok, false)
  const ok = normalizeBrief({ topic: '  หัวข้อ  ', field: { observations: 'ข้อหนึ่ง\n\nข้อสอง', survey_date: '2026-11-01' } })
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.value.field.observations, ['ข้อหนึ่ง', 'ข้อสอง'])
  assert.equal(ok.value.brand_id, 'assetx_estate')
  assert.match(normalizeBrief({ topic: 'ก', mode: 'link' }).errors.join(), /ลิงก์/)
  assert.match(normalizeBrief({ topic: 'ก', field: { survey_date: 'เมื่อวาน' } }).errors.join(), /วันที่สำรวจ/)
  assert.match(normalizeBrief({ topic: 'ก', field: { price_kind: 'SOLD' } }).errors.join(), /ประเภทข้อมูลราคา/)
})

test('แหล่งข้อมูล: แหล่งสาธารณะเริ่มที่อนุญาต ของเราเองเริ่มที่ยังไม่ทราบ', () => {
  assert.equal(normalizeSource({ kind: 'official', title: 'ประกาศ', source_url: 'https://x.go.th' }).value.permission_status, 'granted')
  assert.equal(normalizeSource({ kind: 'own_media', title: 'ภาพหน้าแปลง' }).value.permission_status, 'unknown')
  assert.equal(normalizeSource({ kind: 'official', title: 'ประกาศ' }).ok, false)
  assert.equal(normalizeSource({ kind: 'listing', title: 'ประกาศขาย', source_url: 'ftp://x' }).ok, false)
})

test('ข้ออ้าง: ประเภทที่ไม่รู้จักตกเป็น ยังต้องตรวจ', () => {
  const result = normalizeClaim({ text: 'ข้อความ', claim_type: 'TRUST-ME' })
  assert.equal(result.value.claim_type, 'NEEDS-CHECK')
  assert.equal(result.value.use_in_post, true)
  assert.equal(normalizeClaim({}).ok, false)
})

test('ยืนยันข้ออ้าง: ต้องมีแหล่ง วันที่ตรวจ และสิทธิเผยแพร่ตามประเภท', () => {
  assert.match(verifyProblems(claim(1, { claim_type: 'NEEDS-CHECK' }), []).join(), /เลือกประเภทหลักฐาน/)
  assert.match(verifyProblems(claim(1), []).join(), /ผูกแหล่งข้อมูล/)
  assert.match(verifyProblems(claim(1), [source(1, { checked_at: null })]).join(), /วันที่ตรวจ/)
  assert.match(verifyProblems(claim(1, { claim_type: 'OWN-VERIFIED' }), [source(1)]).join(), /อนุญาตเผยแพร่/)
  assert.deepEqual(verifyProblems(claim(1, { claim_type: 'OWN-VERIFIED', permission_status: 'granted' }), [source(1)]), [])
  assert.deepEqual(verifyProblems(claim(1, { claim_type: 'SIMULATED' }), []), [])
})

test('AC-02: ข้ออ้างยังไม่ยืนยันแต่ข้อความอยู่ในโพสต์ → บล็อกและบอกว่าข้อไหน', () => {
  const pending = claim(7, { status: 'needs_check', claim_type: 'NEEDS-CHECK', use_in_post: false })
  const result = evaluateClaims({ claims: [pending], postText: 'ยืนยันแล้วว่า ที่ดินติดทางคู่ขนานมีการเข้าออกต่างจากแปลงที่เข้าจากถนนหลักโดยตรง', now: NOW })
  assert.equal(result.blockers.length, 1)
  assert.match(result.blockers[0], /ข้ออ้าง 1/)
  assert.match(result.blockers[0], /ยังไม่ยืนยัน/)
  // ไม่ใช้ในโพสต์ และข้อความไม่อยู่ในโพสต์ = ไม่บล็อก
  assert.deepEqual(evaluateClaims({ claims: [pending], postText: 'เช็กลิสต์ก่อนดูที่ดิน', now: NOW }).blockers, [])
  // ตั้งใจจะใช้แต่ยังไม่ยืนยัน = บล็อก
  assert.equal(evaluateClaims({ claims: [{ ...pending, use_in_post: true }], postText: 'เช็กลิสต์ก่อนดูที่ดิน', now: NOW }).blockers.length, 1)
})

test('ข้ออ้างที่ถูกปฏิเสธห้ามอยู่ในโพสต์', () => {
  const rejected = claim(2, { status: 'rejected', use_in_post: false })
  assert.match(evaluateClaims({ claims: [rejected], postText: rejected.claim_text, now: NOW }).blockers[0], /ถูกปฏิเสธ/)
})

test('ข้ออ้างยืนยันแล้ว: แหล่งไม่มีสิทธิเผยแพร่ หรือหลักฐานหมดอายุ → บล็อก', () => {
  const ok = evaluateClaims({ claims: [claim(1)], sources: [source(1)], links: [link(1, 1)], postText: 'x', now: NOW })
  assert.deepEqual(ok.blockers, [])
  assert.equal(ok.used.length, 1)
  const noRight = evaluateClaims({ claims: [claim(1)], sources: [source(1, { permission_status: 'unknown' })], links: [link(1, 1)], postText: 'x', now: NOW })
  assert.match(noRight.blockers.join(), /ยังไม่ได้รับอนุญาตเผยแพร่/)
  const expired = evaluateClaims({ claims: [claim(1, { expires_at: '2026-11-01' })], sources: [source(1)], links: [link(1, 1)], postText: 'x', now: NOW })
  assert.match(expired.blockers.join(), /หมดอายุ/)
  const unlinked = evaluateClaims({ claims: [claim(1)], sources: [source(1)], links: [], postText: 'x', now: NOW })
  assert.match(unlinked.blockers.join(), /ผูกแหล่งข้อมูล/)
})

test('AC-06: ราคาเสนอขายห้ามเล่าเป็นราคาซื้อขายจริง และต้องติดป้าย', () => {
  const ask = claim(3, { claim_type: 'MARKET-ASK', category: 'price', claim_text: 'ประกาศขายที่ดินแปลงใกล้เคียงตั้งราคาไว้ระดับเดียวกัน' })
  const base = { claims: [ask], sources: [source(1, { kind: 'listing' })], links: [link(3, 1)], now: NOW }
  assert.match(evaluateClaims({ ...base, postText: 'แปลงใกล้กันปิดการขายที่ราคานี้ ราคาซื้อขายจริงจึงเท่ากัน' }).blockers.join('\n'), /ราคาเสนอขายห้ามเล่าเป็นราคาซื้อขายจริง/)
  assert.match(evaluateClaims({ ...base, postText: 'แปลงใกล้กันตั้งไว้ระดับเดียวกัน' }).blockers.join('\n'), /ต้องเขียนกำกับว่า "ราคาเสนอขาย"/)
  assert.deepEqual(evaluateClaims({ ...base, postText: 'ราคาเสนอขายของแปลงใกล้กันอยู่ระดับเดียวกัน' }).blockers, [])
})

test('ตัวอย่างสมมติต้องติดป้ายในโพสต์', () => {
  const sim = claim(4, { claim_type: 'SIMULATED', claim_text: 'ที่ดินตั้งขายสิบล้านบาทแต่ทางเข้ามีข้อจำกัด' })
  assert.match(evaluateClaims({ claims: [sim], postText: 'ที่ดินแปลงหนึ่งทางเข้ามีข้อจำกัด', now: NOW }).blockers.join(), /ตัวอย่างสมมติ/)
  assert.deepEqual(evaluateClaims({ claims: [sim], postText: 'ตัวอย่างสมมติ: ที่ดินแปลงหนึ่ง', now: NOW }).blockers, [])
})

test('เปลี่ยนคำเล็กน้อยยังนับว่าเป็นข้อความของข้ออ้างเดิม · ข้อความคนละเรื่องไม่นับ', () => {
  const a = 'ที่ดินติดทางคู่ขนานมีการเข้าออกต่างจากแปลงที่เข้าจากถนนหลักโดยตรง'
  assert.ok(containment(a, `จริง ๆ แล้ว ${a.replace('มีการ', 'จะมีการ')} นะครับ`) >= 0.7)
  assert.ok(containment(a, 'ก่อนขายฝากควรถามตัวเองว่าเงินที่จะไถ่คืนมาจากไหน') < 0.3)
})

test('ข้อมูลส่วนบุคคล: จับเบอร์ เลขบัตร เลขโฉนด พิกัด ชื่อ · ช่องทางของบริษัทและคำทั่วไปไม่โดน', () => {
  assert.equal(privacyFindings('โทร 081-234-5678 ได้เลย').length, 1)
  assert.equal(privacyFindings('เลขบัตร 1-2345-67890-12-3').length, 1)
  assert.equal(privacyFindings('โฉนดเลขที่ 12345 ตำบลตัวอย่าง').length, 1)
  assert.equal(privacyFindings('พิกัด 13.756331, 100.501762').length, 1)
  assert.equal(privacyFindings('ทรัพย์ของนาย สมมติ ทดสอบ').length, 1)
  assert.equal(privacyFindings('ไลน์ไอดี: somchai99').length, 1)
  assert.deepEqual(privacyFindings('ทักแชตหรือโทร 096-986-8888 · LINE Official ของเรา @assetxestate · สิทธิไถ่ของคุณ ข้อมูลนี้ใช้ได้ปี 2569 ราคา 1,250,000 บาท'), [])
})

test('ร่างจากบรีฟ: ใช้ข้อสังเกตหน้างานและข้ออ้างที่ยืนยันแล้วจริง ไม่ใส่ข้ออ้างที่ยังไม่ยืนยัน', () => {
  const b = brief({ unique_insight: 'ติดถนนใหญ่ไม่ได้แปลว่าเข้าออกได้เหมือนกันทุกแปลง', intended_takeaway: 'ตรวจทางเข้าออกจริงก่อนอ้างราคา', field: { observations: ['หน้าแปลงติดทางคู่ขนาน ต้องอ้อมเข้า', 'ไม่มีจุดกลับรถใกล้แปลง'], unknowns: ['สิทธิทางเข้าออกตามเอกสาร'], survey_date: '2026-11-15', lesson: '' }, public_location_level: 'province', public_location: 'จังหวัดตัวอย่าง' })
  const verified = claim(1, { claim_type: 'MARKET-ASK', category: 'price', claim_text: 'แปลงใกล้เคียงประกาศขายในระดับราคาใกล้กัน', limitation: 'ยังไม่ใช่ราคาที่ขายได้' })
  const pending = claim(2, { status: 'needs_check', claim_type: 'NEEDS-CHECK', claim_text: 'แปลงนี้มีภาระจำยอมเรื่องทางผ่าน' })
  const proof = { brief: b, claims: [verified, pending], sources: [source(1, { kind: 'listing', title: 'ประกาศขายออนไลน์' })], links: [link(1, 1)] }
  assert.equal(canComposeFromBrief(b, proof.claims), true)
  const draft = composeProofDraft(proof)
  assert.match(draft.caption, /หน้าแปลงติดทางคู่ขนาน/)
  assert.match(draft.caption, /สำรวจ 15 พ\.ย\. 2569 · จังหวัดตัวอย่าง/)
  assert.match(draft.caption, /ราคาเสนอขาย: แปลงใกล้เคียง/)
  assert.match(draft.caption, /สิทธิทางเข้าออกตามเอกสาร/)
  assert.match(draft.caption, /ที่มา: ประกาศขายออนไลน์ \(ข้อมูล ณ วันที่ 20 พ\.ย\. 2569\)/)
  assert.doesNotMatch(draft.caption, /ภาระจำยอม/)
  assert.deepEqual(draft.claim_ids_used, [1])
  assert.equal(draft.missing_evidence[0].claim_id, 2)
  assert.equal(draft.basis, 'field')
  // ร่างที่ระบบเรียงเอง ต้องผ่านด่านหลักฐานของตัวเองเมื่อเลือกไม่ใช้ข้อที่ยังไม่ยืนยัน
  const gate = buildReviewGate({ title: draft.headline, caption: draft.caption, channel: 'facebook', draftSource: 'ai' }, { ...proof, claims: [verified, { ...pending, use_in_post: false }] }, { now: NOW })
  assert.deepEqual(gate.evidence_blockers, [])
  assert.deepEqual(gate.privacy_blockers, [])
})

test('ไม่มีข้อมูลหน้างานและไม่มีข้ออ้างยืนยัน: ไม่ร่างจากบรีฟ (ใช้โหมดสร้างเร็วแทน) และบอกสิ่งที่ขาด', () => {
  const b = brief()
  assert.equal(canComposeFromBrief(b, []), false)
  const missing = briefMissing(b, [claim(1, { status: 'draft', category: 'legal' })], [])
  assert.ok(missing.some((item) => /ข้อสังเกตจริงจากหน้างาน/.test(item)))
  assert.ok(missing.some((item) => /แหล่งราชการ/.test(item)))
})

test('ด่านรวม: โพสต์ไม่มีบรีฟยังไปให้คนตรวจได้ พร้อมคำเตือนว่าไม่มี Proof Card', () => {
  const gate = buildReviewGate({ title: 'เช็กลิสต์ก่อนขายฝาก', caption: 'ก่อนเซ็นสัญญาขายฝาก ถามตัวเองก่อนว่าเงินที่จะไถ่คืนมาจากไหน', channel: 'facebook', draftSource: 'ai' }, null, { now: NOW })
  assert.equal(gate.mode, 'general')
  assert.equal(gate.blocked, false)
  assert.equal(gate.ready_for_human_review, true)
  assert.ok(gate.editorial_warnings.some((item) => /ไม่มีบรีฟ/.test(item)))
})

test('ด่านรวม: คำต้องห้ามเดิมยังบล็อก และข้อมูลส่วนบุคคลแยกหมวด', () => {
  const gate = buildReviewGate({ title: 'ขายฝาก', caption: 'อนุมัติแน่นอน 100% โทร 081-234-5678', channel: 'facebook', draftSource: 'ai' }, null, { now: NOW })
  assert.equal(gate.blocked, true)
  assert.ok(gate.compliance_blockers.length >= 1)
  assert.ok(gate.privacy_blockers.some((item) => /เบอร์โทร/.test(item)))
})

test('ด่านรวม: ตัวเลขอัตราดอกเบี้ยในโพสต์ที่มีบรีฟ ต้องมีข้ออ้างกฎหมาย/ราคาที่ยืนยันรองรับ', () => {
  const post = { title: 'ดอกเบี้ยขายฝาก', caption: 'ดอกเบี้ย 1.25% ต่อเดือน เป็นเงื่อนไขของกรณีตัวอย่าง อัตราจริงขึ้นกับการพิจารณารายกรณี', channel: 'facebook', draftSource: 'ai' }
  const without = buildReviewGate(post, { brief: brief(), claims: [], sources: [], links: [] }, { now: NOW })
  assert.ok(without.evidence_blockers.some((item) => /ตัวเลขอัตรา/.test(item)))
  const legal = claim(1, { category: 'legal', claim_text: 'เพดานประโยชน์ตอบแทนของขายฝากที่อยู่อาศัยกำหนดไว้ในกฎหมายเฉพาะ', limitation: 'เฉพาะที่ดินเกษตรกรรมและที่อยู่อาศัย' })
  const withClaim = buildReviewGate(post, { brief: brief(), claims: [legal], sources: [source(1)], links: [link(1, 1)] }, { now: NOW })
  assert.ok(!withClaim.evidence_blockers.some((item) => /ตัวเลขอัตรา/.test(item)))
  assert.ok(withClaim.editorial_warnings.some((item) => /ระบบไม่ตัดสินเพดานเอง/.test(item)))
})

test('ฐานของการอนุมัติ: แก้แคปชั่น ภาพ หรือข้ออ้าง = ฐานเปลี่ยน · ลำดับข้ออ้างไม่มีผล', () => {
  const post = { title: 'ก', caption: 'ข', channel: 'Facebook Page', mediaAssetId: 'asset-1' }
  const proof = { brief: brief(), claims: [claim(1), claim(2, { claim_text: 'ข้อสอง' })], sources: [source(1)], links: [link(1, 1)] }
  const base = approvalBasis(post, proof)
  assert.equal(base, approvalBasis({ ...post, caption: 'ข\r\n' }, { ...proof, claims: [...proof.claims].reverse() }))
  assert.notEqual(base, approvalBasis({ ...post, caption: 'ข แก้' }, proof))
  assert.notEqual(base, approvalBasis({ ...post, mediaAssetId: 'asset-2' }, proof))
  assert.notEqual(base, approvalBasis(post, { ...proof, claims: [claim(1, { status: 'needs_check' }), proof.claims[1]] }))
  assert.notEqual(base, approvalBasis(post, { ...proof, links: [] }))
  assert.notEqual(base, approvalBasis(post, null))
})

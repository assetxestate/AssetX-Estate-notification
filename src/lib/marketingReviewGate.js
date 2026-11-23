// ด่านตรวจก่อนอนุมัติ/เผยแพร่ของ /marketing แยกเป็นหมวด (FR-07 · เฟส P0 · 23 พ.ย. 2569)
// ต่อยอด reviewAssetxContent() เดิม ไม่แทนที่: ผลเดิม (คำต้องห้าม/แม่แบบหัวข้อ) → compliance_blockers
// เพิ่ม: หลักฐานรายข้ออ้าง (marketingProof.js) · ข้อมูลส่วนบุคคล · คำเตือนเชิงบรรณาธิการ
// คะแนนโครงสร้าง/คุณภาพไม่มีผลต่อด่านนี้ — คะแนนสูงแค่ไหนก็ข้ามตัวบล็อกไม่ได้
import { reviewAssetxContent } from './assetxMarketingModel.js'
import { evaluateClaims, privacyFindings } from './marketingProof.js'

// นโยบายอัตราดอกเบี้ย/ประโยชน์ตอบแทน (มีเวอร์ชัน): ระบบไม่ตัดสินว่าอัตราใด "ถูกกฎหมาย" เอง
// เพดานต่างกันตามประเภทสัญญา ประเภททรัพย์ และคู่สัญญา → โพสต์ที่มีตัวเลขอัตราต้องให้คนตรวจกับตัวบทเป็นรายกรณี
export const RATE_POLICY = { version: '2026-11-23', mode: 'manual_review' }
const RATE_NUMBER = /(ดอกเบี้ย|ดอก|สินไถ่|ประโยชน์ตอบแทน|ผลตอบแทน)[^\n%\d]{0,16}\d+(\.\d+)?\s*%|ร้อยละ\s*\d+(\.\d+)?/
const SENSITIVE_SITUATION = /ผิดนัด|ค้างชำระ|ถูกฟ้อง|ถูกยึด|บังคับคดี|ขายทอดตลาด/
const GENERIC_OPENERS = /^(ในยุค|ในปัจจุบัน|รู้หรือไม่|คุณรู้หรือไม่|หลายคนอาจไม่รู้ว่า|ยุคนี้ใคร)/

// post = { title, caption, videoScript, topic, channel, draftSource } · proof = { brief, claims, sources, links } หรือ null (โพสต์ที่ไม่มีบรีฟ)
export function buildReviewGate(post = {}, proof = null, { now = Date.now() } = {}) {
  const legacy = reviewAssetxContent(post)
  const failing = legacy.findings.filter((item) => ['block', 'warn'].includes(item.severity))
  const privacyRuleIds = new Set(['personal_data'])
  const compliance = failing.filter((item) => !privacyRuleIds.has(item.id)).map((item) => `${item.where}: ${item.message}`)
  const privacy = failing.filter((item) => privacyRuleIds.has(item.id)).map((item) => `${item.where}: ${item.message}`)
  const postText = [post.title || post.headline, post.caption, post.videoScript].filter(Boolean).join('\n')
  privacy.push(...privacyFindings(postText))

  const hasProof = Boolean(proof?.brief)
  const claims = hasProof ? (proof.claims || []) : []
  const evidence = hasProof
    ? evaluateClaims({ claims, sources: proof.sources || [], links: proof.links || [], postText, now })
    : { blockers: [], warnings: [], used: [], perClaim: [] }

  const warnings = [...legacy.findings.filter((item) => item.severity === 'info').map((item) => `${item.where}: ${item.message}`), ...evidence.warnings]
  if (RATE_NUMBER.test(postText)) {
    const backed = evidence.used.some((claim) => claim.category === 'legal' || claim.category === 'price')
    // มีตัวเลขอัตราแต่ไม่มีข้ออ้างที่ยืนยันรองรับ = ตัวบล็อกเมื่อโพสต์มีบรีฟ · โพสต์ไม่มีบรีฟ = คำเตือนให้คนตรวจกับตัวบท
    const note = `มีตัวเลขอัตราดอกเบี้ย/ประโยชน์ตอบแทน — ตรวจกับตัวบทตามประเภทสัญญา ประเภททรัพย์ และคู่สัญญาเป็นรายกรณี (นโยบาย ${RATE_POLICY.version}: ระบบไม่ตัดสินเพดานเอง)`
    if (hasProof && !backed) evidence.blockers.push(`${note} · ยังไม่มีข้ออ้างหมวดกฎหมาย/ราคาที่ยืนยันแล้วรองรับตัวเลขนี้`)
    else warnings.push(note)
  }
  if (SENSITIVE_SITUATION.test(postText) && claims.some((claim) => claim.claim_type === 'OWN-VERIFIED')) {
    warnings.push('โพสต์พูดถึงสถานการณ์หนี้/คดี ร่วมกับข้อมูลของเราเอง — ตรวจว่ารายละเอียดรวมกันแล้วไม่ชี้ตัวลูกค้าหรือแปลงได้')
  }
  if (GENERIC_OPENERS.test(String(post.caption || '').trim())) warnings.push('ประโยคเปิดเป็นแบบที่ใช้กันทั่วไป — เปิดด้วยข้อสังเกตจริงหรือประเด็นเฉพาะจะดีกว่า')
  if (!hasProof) warnings.push('โพสต์นี้ไม่มีบรีฟและ Proof Card — ถือเป็นความรู้ทั่วไป ผู้ตรวจต้องตรวจข้อเท็จจริงกับแหล่งที่มาเองก่อนอนุมัติ')

  const gate = {
    mode: hasProof ? 'proof' : 'general',
    compliance_blockers: [...new Set(compliance)],
    evidence_blockers: [...new Set(evidence.blockers)],
    privacy_blockers: [...new Set(privacy)],
    editorial_warnings: [...new Set(warnings)],
    claim_ids_used: evidence.used.map((claim) => claim.id),
    per_claim: evidence.perClaim,
    rate_policy_version: RATE_POLICY.version,
  }
  gate.blocked = gate.compliance_blockers.length + gate.evidence_blockers.length + gate.privacy_blockers.length > 0
  // ผ่านด่านอัตโนมัติ = "พร้อมให้คนตรวจ" เท่านั้น ไม่ใช่อนุมัติ
  gate.ready_for_human_review = !gate.blocked
  return gate
}

export const GATE_SECTIONS = [
  { key: 'compliance_blockers', label: 'ถ้อยคำ/กฎหมายที่ต้องแก้', blocking: true },
  { key: 'evidence_blockers', label: 'หลักฐานที่ยังไม่ครบ', blocking: true },
  { key: 'privacy_blockers', label: 'ข้อมูลส่วนบุคคล', blocking: true },
  { key: 'editorial_warnings', label: 'ข้อสังเกตให้ผู้ตรวจดู (ไม่บล็อก)', blocking: false },
]

export function gateBlockerText(gate) {
  return GATE_SECTIONS.filter((section) => section.blocking).flatMap((section) => gate[section.key] || [])
}

// ส่วนของโพสต์ที่การอนุมัติผูกไว้ — เปลี่ยนข้อใดข้อหนึ่ง = การอนุมัติเดิมใช้ไม่ได้ (เซิร์ฟเวอร์คิดแฮชจากค่านี้)
export function approvalBasis(post = {}, proof = null) {
  const clean = (value) => String(value ?? '').replace(/\r\n/g, '\n').trim()
  const claims = (proof?.claims || [])
    .map((claim) => ({
      id: String(claim.id), text: clean(claim.claim_text), wording: clean(claim.publishable_wording), type: claim.claim_type,
      status: claim.status, use: claim.use_in_post !== false, permission: claim.permission_status, expires: claim.expires_at || null,
      sources: (proof.links || []).filter((link) => String(link.claim_id) === String(claim.id)).map((link) => String(link.source_id)).sort(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
  return JSON.stringify({
    v: 1,
    title: clean(post.title || post.headline),
    caption: clean(post.caption),
    videoScript: clean(post.videoScript),
    channel: /facebook/i.test(String(post.channel || '')) ? 'facebook' : String(post.channel || ''),
    media: String(post.mediaAssetId || ''),
    brief: proof?.brief ? String(proof.brief.id) : '',
    claims,
  })
}

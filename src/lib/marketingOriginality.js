// คะแนนความเป็นต้นฉบับ + คะแนนบรรณาธิการ + ด่าน 6 ข้อ + ตัวกรองประโยคสำเร็จรูป ของ /marketing (FR-03 · เฟส P1 · 23 พ.ย. 2569)
// ตรรกะล้วน ไม่ใช้ AI: ผลเดิมเสมอเมื่อข้อมูลเดิม ตรวจย้อนได้ว่าคะแนนมาจากอะไร
//
// แยกจากคะแนนเดิม 3 อย่าง ห้ามปนกัน:
//   structural   = คะแนนโครงสร้าง/อ่านง่ายเดิม (scoreCaption) — ไม่เกี่ยวกับความถูกต้อง
//   originality  = ต่างจากเพจอื่นด้วย "ข้อมูล เหตุผล และประโยชน์" ของเราเองแค่ไหน
//   editorial    = คุณภาพบรรณาธิการรวม
// หลัก:
//   - คะแนนข้อมูลเฉพาะของเรานับเฉพาะสิ่งที่ผูกกับบรีฟ/ข้ออ้างที่ยืนยันแล้วและปรากฏในโพสต์จริง → เปลี่ยนคำหรือแต่งตัวเลขเพิ่มไม่ทำให้คะแนนขึ้น
//   - คะแนนไม่มีผลต่อการบล็อก และตัวบล็อก (ด่านหลักฐาน) ไม่ถูกคะแนนลบล้าง · คะแนนสูง = "ควรส่งให้คนตรวจขั้นสุดท้าย" ไม่ใช่อนุมัติ
//   - เป็นเกณฑ์ภายใน ไม่ใช่คำทำนายยอดเข้าถึงหรือโอกาสไวรัล
//   - โพสต์ความรู้ทั่วไปที่ถูกต้องยังไปให้คนตรวจได้ คะแนนต้นฉบับจะต่ำตามจริง ไม่บังคับแต่งเคสเพื่อเพิ่มคะแนน
import { containment } from './marketingProof.js'
import { scoreCaption, similarity } from './marketing-model/scoring.js'

export const ORIGINALITY_PARTS = [
  { key: 'own', label: 'ข้อมูลหรือข้อสังเกตเฉพาะของเราที่ตรวจได้', max: 25 },
  { key: 'angle', label: 'มุมคิดที่ต่างจริง ไม่ใช่เปลี่ยนคำ', max: 20 },
  { key: 'reasoning', label: 'เหตุผลและวิธีคิด', max: 20 },
  { key: 'actionable', label: 'สิ่งที่คนอ่านทำตามได้', max: 15 },
  { key: 'format', label: 'รูปแบบเหมาะกับช่องทาง', max: 10 },
  { key: 'fresh', label: 'ไม่ซ้ำกับโพสต์เดิมของเรา', max: 10 },
]
export const EDITORIAL_PARTS = [
  { key: 'value', label: 'คุณค่าและข้อมูลเฉพาะ', max: 25 },
  { key: 'usable', label: 'ใช้ประโยชน์ได้', max: 20 },
  { key: 'evidence', label: 'หลักฐานและความถูกต้อง', max: 20 },
  { key: 'story', label: 'การเล่าและการเปิดเรื่อง', max: 15 },
  { key: 'audience', label: 'ตรงกลุ่มคนอ่าน', max: 10 },
  { key: 'voice', label: 'น้ำเสียงและรูปแบบ', max: 10 },
]
export const EDITORIAL_READY = 85

const GENERIC_OPENERS = /^(ในยุค|ในปัจจุบัน|ปัจจุบันนี้|ทุกวันนี้|รู้หรือไม่|คุณรู้หรือไม่|หลายคนอาจไม่รู้ว่า|หลายคนอาจยังไม่รู้|ยุคนี้ใคร|อสังหาริมทรัพย์ถือเป็น|สิ่งสำคัญที่สุดคือ)/
const HOLLOW_WORDS = ['ครบวงจร', 'ตอบโจทย์', 'ยกระดับ', 'ครบจบในที่เดียว', 'ทันสมัย', 'คุ้มค่าที่สุด', 'เพิ่มโอกาสเติบโต', 'มืออาชีพที่สุด', 'อันดับหนึ่ง']
const TENSION = /ไม่ได้แปลว่า|ไม่เท่ากับ|ไม่ใช่ว่า|ทั้งที่|แต่กลับ|ทำไม|ต่างกัน|คนละเรื่อง|ยังไม่บอกว่า|ไม่ได้บอกว่า/
const REASONING = ['เพราะ', 'จึง', 'ดังนั้น', 'ทำให้', 'เหตุผล', 'ขึ้นกับ', 'ขึ้นอยู่กับ', 'ต้องดู', 'เนื่องจาก', 'หมายความว่า', 'ส่งผล']
const CAVEAT = /ข้อจำกัด|ยังต้องตรวจ|ต้องตรวจ|ยังสรุปไม่ได้|ขึ้นกับ|ขึ้นอยู่กับ|แต่ละกรณี|ไม่ใช่คำแนะนำ|ควรยืนยัน|ยืนยันกับ|ยังไม่ใช่/
const ACTIONS = ['ลอง', 'ตรวจ', 'เช็ก', 'ถาม', 'เตรียม', 'เก็บ', 'ขอดู', 'เทียบ', 'จด', 'ไปดู', 'ยืนยัน']
const AUDIENCE = /เจ้าของ|ทรัพย์|ที่ดิน|โฉนด|บ้าน|คอนโด|ขายฝาก|จำนอง|ไถ่/
const LIST_LINE = /^\s*(?:\d{1,2}[.)]|[•\-–]|[0-9]️?⃣)\s*\S/

const clampTo = (value, max) => Math.max(0, Math.min(max, Math.round(value)))
const stripTags = (value) => String(value ?? '').replace(/#[\p{L}\p{M}\p{N}_]+/gu, ' ')
const sentences = (value) => String(value ?? '').split(/\n+|(?<=[.!?])\s+/).map((item) => item.replace(/\s+/g, ' ').trim()).filter((item) => item.length >= 20)
const firstLine = (value) => String(value ?? '').split('\n').map((item) => item.trim()).find(Boolean) || ''

// ประโยคสำเร็จรูปและความซ้ำ → รายการข้อสังเกตพร้อมเหตุผลเฉพาะ (ไม่บล็อก)
export function samenessFindings(caption, library = []) {
  const body = stripTags(caption)
  const opener = firstLine(body)
  const findings = []
  if (GENERIC_OPENERS.test(opener)) findings.push({ code: 'generic_opener', message: `เปิดด้วยประโยคสำเร็จรูป "${opener.slice(0, 40)}…" — เปิดด้วยข้อสังเกตจริงหรือประเด็นของเรื่อง` })
  const hollow = HOLLOW_WORDS.filter((word) => body.includes(word))
  if (hollow.length) findings.push({ code: 'hollow_words', message: `คำที่ไม่ให้ข้อมูล: ${hollow.join(' · ')} — บอกเป็นข้อเท็จจริงแทน หรือตัดออก`, words: hollow })
  const seen = []
  for (const sentence of sentences(body)) {
    if (seen.some((prev) => similarity(prev, sentence) >= 0.8)) { findings.push({ code: 'repeated_sentence', message: `มีประโยคซ้ำความกัน: "${sentence.slice(0, 50)}…"` }); break }
    seen.push(sentence)
  }
  const lines = body.split('\n')
  const listItems = lines.filter((line) => LIST_LINE.test(line)).length
  if (listItems >= 3 && !REASONING.some((word) => body.includes(word))) findings.push({ code: 'bare_list', message: `เป็นรายการ ${listItems} ข้อที่ไม่มีเหตุผลหรือตัวอย่างประกอบ — เพิ่มว่าทำไมแต่ละข้อสำคัญ` })
  let closest = null
  for (const item of library) {
    const other = stripTags(item?.caption)
    if (!other.trim()) continue
    const score = similarity(body, other)
    if (!closest || score > closest.score) closest = { score, no: item.contentNo || null, title: item.title || '' }
    if (opener.length >= 12 && similarity(opener, firstLine(other)) >= 0.75) {
      findings.push({ code: 'repeated_opener', message: `ประโยคเปิดคล้ายกับ${item.contentNo ? ` #${item.contentNo}` : 'โพสต์เดิม'} — เปลี่ยนประเด็นเปิด ไม่ใช่แค่สลับคำ` })
      break
    }
  }
  if (closest && closest.score >= 0.6) findings.push({ code: 'similar_post', message: `เนื้อหาคล้ายกับ${closest.no ? ` #${closest.no}` : 'โพสต์เดิม'} มาก (${Math.round(closest.score * 100)}%) — เพิ่มข้อมูลหรือมุมที่โพสต์เดิมไม่มี` })
  return { findings, closest }
}

// post = { title, caption, channel } · proof = { brief, claims, … } หรือ null · gate = ผลของ buildReviewGate (ถ้ามี) · library = โพสต์อื่นของเรา [{ caption, contentNo, title }]
export function assessContent(post = {}, { proof = null, gate = null, library = [] } = {}) {
  const caption = String(post.caption || '')
  const body = stripTags(caption)
  const brief = proof?.brief || null
  const field = brief?.field || {}
  const structural = scoreCaption(caption, /facebook/i.test(String(post.channel || '')) ? 'facebook' : (post.channel || 'facebook'))?.score ?? 0

  // ── ข้อมูลเฉพาะของเรา: นับเฉพาะที่ผูกกับบรีฟและอยู่ในโพสต์จริง ──
  const observations = (field.observations || []).filter((item) => containment(item, body) >= 0.6)
  const usedIds = new Set((gate?.claim_ids_used || []).map(String))
  const usedClaims = (proof?.claims || []).filter((claim) => usedIds.has(String(claim.id)) && claim.status === 'verified')
  const ownClaims = usedClaims.filter((claim) => claim.claim_type === 'OWN-VERIFIED')
  const own = clampTo([0, 10, 16, 20][Math.min(observations.length, 3)] + ownClaims.length * 5 + (usedClaims.length - ownClaims.length) * 3, 25)

  const sameness = samenessFindings(caption, library)
  const has = (code) => sameness.findings.some((item) => item.code === code)
  const opener = firstLine(body)
  const insightUsed = Boolean(brief?.unique_insight) && containment(brief.unique_insight, body) >= 0.5
  const angle = clampTo((has('generic_opener') || has('repeated_opener') ? 0 : 6) + (TENSION.test(body) ? 7 : 0) + (insightUsed ? 7 : 0), 20)

  const reasons = REASONING.filter((word) => body.includes(word))
  const caveat = CAVEAT.test(body)
  const reasoning = clampTo([0, 6, 11, 15, 18][Math.min(reasons.length, 4)] + (caveat ? 2 : 0), 20)

  const listItems = body.split('\n').filter((line) => LIST_LINE.test(line)).length
  const questions = (body.match(/[?？]|ไหม|หรือเปล่า|หรือไม่/g) || []).length
  const actions = ACTIONS.filter((word) => body.includes(word))
  const takeawayUsed = Boolean(brief?.intended_takeaway) && containment(brief.intended_takeaway, body) >= 0.5
  // รายการเปล่าที่ไม่มีเหตุผลประกอบ ("1. ทำเล 2. ศักยภาพ") ไม่นับเป็นของที่ทำตามได้เต็มคะแนน
  const actionable = clampTo((listItems >= 3 || questions >= 3 ? (has('bare_list') ? 4 : 8) : listItems + questions >= 1 ? 4 : 0) + (actions.length >= 2 ? 5 : actions.length ? 2 : 0) + (takeawayUsed ? 2 : 0), 15)

  const format = clampTo(structural / 10, 10)
  const closest = sameness.closest?.score ?? 0
  const fresh = closest < 0.3 ? 10 : closest < 0.45 ? 7 : closest < 0.6 ? 3 : 0

  const originalityParts = { own, angle, reasoning, actionable, format, fresh }
  const originality = Object.values(originalityParts).reduce((sum, value) => sum + value, 0)

  // ── ด่าน 6 ข้อ: ใช่ / ต้องปรับ พร้อมหลักฐานว่าตัดสินจากอะไร (ไม่ให้ AI ตัดสินเอง) ──
  const hasProof = Boolean(brief)
  const evidenceClear = !(gate?.evidence_blockers?.length)
  const complianceClear = !(gate?.compliance_blockers?.length) && !(gate?.privacy_blockers?.length)
  const gates = [
    { key: 'only_us', label: 'มีแต่เราที่เล่าได้', ok: observations.length >= 1 || ownClaims.length >= 1,
      why: observations.length || ownClaims.length ? `ใช้ข้อสังเกตหน้างาน ${observations.length} ข้อ และข้อมูลของเราเอง ${ownClaims.length} ข้อ` : 'ไม่มีข้อสังเกตหน้างานหรือข้อมูลของเราเองในโพสต์ — เป็นความรู้ที่เพจอื่นก็เขียนได้' },
    { key: 'specific', label: 'เจาะจง', ok: observations.length >= 1 || usedClaims.length >= 1,
      why: observations.length || usedClaims.length ? `มีรายละเอียดเฉพาะ ${observations.length + usedClaims.length} จุดที่ผูกกับบรีฟ` : 'ยังเป็นประโยคกว้างที่ใช้กับทรัพย์ไหนก็ได้' },
    { key: 'proof', label: 'มีหลักฐาน', ok: hasProof && evidenceClear && (observations.length >= 1 || usedClaims.length >= 1),
      why: !hasProof ? 'ไม่มีบรีฟและ Proof Card' : !evidenceClear ? 'ยังมีหลักฐานที่ไม่ครบ (ดูตัวบล็อกด้านบน)' : usedClaims.length ? `ข้ออ้างที่ยืนยันแล้ว ${usedClaims.length} ข้อ มีแหล่งที่มา` : observations.length ? 'อิงบันทึกหน้างานของเรา' : 'มีบรีฟ แต่โพสต์ไม่ได้ใช้ข้อมูลจากบรีฟ' },
    { key: 'useful', label: 'ใช้ได้จริง', ok: actionable >= 8,
      why: actionable >= 8 ? 'มีขั้นตอน เช็กลิสต์ หรือคำถามให้คนอ่านทำตาม' : 'ยังไม่ชัดว่าคนอ่านทำอะไรต่อได้ — เพิ่มสิ่งที่ตรวจหรือถามได้วันนี้' },
    { key: 'honest', label: 'ซื่อตรง', ok: caveat && complianceClear,
      why: !complianceClear ? 'ยังติดเกณฑ์ถ้อยคำหรือข้อมูลส่วนบุคคล' : caveat ? 'บอกข้อจำกัดหรือสิ่งที่ยังต้องตรวจ' : 'ยังไม่ได้บอกข้อจำกัด ความเสี่ยง หรือสิ่งที่ยังไม่แน่นอน' },
    { key: 'human', label: 'ฟังเป็นคนพูด', ok: !has('generic_opener') && !has('hollow_words') && !has('repeated_sentence'),
      why: has('generic_opener') ? 'เปิดด้วยประโยคสำเร็จรูป' : has('hollow_words') ? 'มีคำที่ไม่ให้ข้อมูล' : has('repeated_sentence') ? 'มีประโยคซ้ำความกัน' : 'ไม่พบประโยคสำเร็จรูปหรือคำกลวง (ผู้ตรวจยังควรอ่านออกเสียงดู)' },
  ]

  // ── คะแนนบรรณาธิการ ──
  const hollowCount = sameness.findings.find((item) => item.code === 'hollow_words')?.words?.length || 0
  const editorialParts = {
    value: clampTo(((own + angle) / 45) * 25, 25),
    usable: clampTo((actionable / 15) * 20, 20),
    evidence: clampTo(!evidenceClear || !complianceClear ? 0 : (hasProof && gates[2].ok ? 16 : 8) + (caveat ? 4 : 0), 20),
    story: clampTo((angle / 20) * 10 + (has('generic_opener') ? 0 : 5), 15),
    audience: AUDIENCE.test(body) ? (/คุณ|เจ้าของ/.test(body) ? 10 : 7) : 3,
    voice: clampTo(structural / 10 - hollowCount * 2, 10),
  }
  const editorial = Object.values(editorialParts).reduce((sum, value) => sum + value, 0)
  const blocked = Boolean(gate?.blocked)

  return {
    structural,
    originality,
    editorial,
    originality_parts: ORIGINALITY_PARTS.map((part) => ({ ...part, score: originalityParts[part.key] })),
    editorial_parts: EDITORIAL_PARTS.map((part) => ({ ...part, score: editorialParts[part.key] })),
    gates,
    sameness: sameness.findings,
    evidence: { observations_used: observations.length, claims_used: usedClaims.length, own_claims_used: ownClaims.length, opener },
    // คะแนนถึงเกณฑ์และไม่มีตัวบล็อก = ควรส่งให้คนตรวจขั้นสุดท้าย (ไม่ใช่อนุมัติ ไม่ใช่คำทำนายยอด)
    ready_for_final_review: !blocked && editorial >= EDITORIAL_READY,
    blocked,
    advice: adviceFor({ own, angle, reasoning, actionable, fresh, hasProof, gates }),
  }
}

// คำแนะนำแก้ไขที่เจาะจง เรียงจากข้อที่เพิ่มคะแนนได้มากที่สุด (ไม่แนะนำให้แต่งข้อมูล)
function adviceFor({ own, angle, reasoning, actionable, fresh, hasProof, gates }) {
  const tips = []
  if (own < 10) tips.push(hasProof ? 'ใส่ข้อสังเกตจากหน้างานที่จดไว้ในบรีฟลงในโพสต์ (ถ้ายังไม่มีข้อสังเกตจริง โพสต์นี้คือความรู้ทั่วไป ไม่ต้องแต่งเพิ่ม)' : 'ถ้ามีข้อสังเกตจากงานจริงเรื่องนี้ ให้สร้างจากแผง สร้างจากข้อมูลจริง — ถ้าไม่มี โพสต์นี้คือความรู้ทั่วไป คะแนนต้นฉบับต่ำเป็นเรื่องปกติ')
  if (angle < 10) tips.push('เปิดด้วยสิ่งที่สวนความเข้าใจทั่วไป หรือประเด็นเฉพาะของเรื่อง แทนประโยคกว้าง')
  if (reasoning < 10) tips.push('อธิบายว่าทำไม: ผู้ประเมินดูอะไร เพราะอะไร และข้อจำกัดคืออะไร')
  if (actionable < 8) tips.push('เพิ่มสิ่งที่คนอ่านตรวจหรือถามได้วันนี้ 2–3 ข้อ')
  if (fresh < 7) tips.push('เนื้อหาใกล้กับโพสต์เดิมของเรา — เพิ่มข้อมูลหรือมุมที่โพสต์เดิมไม่มี')
  if (!gates.find((item) => item.key === 'honest').ok) tips.push('บอกข้อจำกัดหรือสิ่งที่ยังต้องตรวจอย่างน้อยหนึ่งจุด')
  return tips
}

// ด่านตรวจข้อความการตลาดด้าน "การเงิน/กฎหมาย" ก่อนเข้ากล่องอนุมัติ
// บล็อกแล้วบอกเหตุผล — ห้ามแก้ข้อความเอง (หลักการ: โค้ดตัดสิน คนแก้)
//
// สิ่งที่ด่านนี้จับ (จากโปรไฟล์อสังหาฯ ข้อ 7 และ 9):
//   1. ดอกเบี้ย/ผลตอบแทนเกิน 15% ต่อปี (ต่อเดือน × 12) — ผิดกฎหมายตั้งแต่คิด ไม่ใช่แค่โฆษณาผิด
//   2. คำต้องห้าม (overclaim) จาก brand_facts.forbidden_phrases
//   3. "ธปท./แบงก์ชาติ" ใกล้ "อนุญาต/กำกับ/รับรอง" — ไม่มีระบบใบอนุญาตแบบนั้นสำหรับขายฝาก/รับจำนองนอกสถาบันการเงิน
//   4. "0.01%" ใกล้ "จำนอง/ขายฝาก" โดยไม่มีคำ "พร้อม(การ)โอน" — มาตรการลดค่าจดจำนองใช้เฉพาะจดพร้อมโอน ขายฝากไม่อยู่ในมาตรการ
//   + กฎ BLOCK จากด่านเดิมของแอป (src/lib/marketing-model/rules.js) เพื่อให้ด่านเดียวครอบคลุม
// ข้อจำกัดที่รู้: ภาษาพูด "บาทละ X สตางค์" / "ดอก X บาท" จับไม่ได้ → คนตรวจ
import { checkText, SEVERITY } from '../../src/lib/marketing-model/rules.js'

export const LEGAL_RATE_CAP_PA = 15

const RATE_RE = /(?:(\d+(?:\.\d+)?)\s*%|ร้อยละ\s*(\d+(?:\.\d+)?))\s*(?:ต่อ|\/)\s*(เดือน|ปี|month|year)/gi
const BOT_RE = /ธปท\.?|แบงก์ชาติ/g
const LICENSE_RE = /อนุญาต|กำกับ|รับรอง/g
const FEE_RE = /0\.01\s*%/g
const TXN_RE = /จำนอง|ขายฝาก/g
const WITH_TRANSFER_RE = /พร้อม(?:การ)?โอน/

const DEFAULT_FORBIDDEN = [
  'อนุมัติทุกเคส', 'ไม่ดูเครดิต 100%', 'ดอกเบี้ยต่ำที่สุด', 'ได้รับอนุญาตจาก ธปท.', 'การันตีผลตอบแทน',
  'ไม่มีความเสี่ยง', 'ไม่ต้องใช้เอกสาร', 'ไม่ถามที่มาเงิน', 'ราคาขึ้นแน่นอน', 'กำไรแน่',
]

function normalize(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

function matchPositions(text, re) {
  const out = []
  re.lastIndex = 0
  let m
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] })
    if (m[0].length === 0) re.lastIndex += 1
  }
  return out
}

function gapBetween(a, b) {
  if (a.end <= b.start) return b.start - a.end
  if (b.end <= a.start) return a.start - b.end
  return 0
}

function near(text, reA, reB, maxGap) {
  const as = matchPositions(text, reA)
  const bs = matchPositions(text, reB)
  for (const a of as) for (const b of bs) if (gapBetween(a, b) <= maxGap) return { a: a.text, b: b.text }
  return null
}

// แปลงอัตราที่พบทั้งหมดเป็นต่อปี · คืน [{ raw, value, per, annual }]
export function findRates(text) {
  const s = String(text ?? '')
  const out = []
  RATE_RE.lastIndex = 0
  let m
  while ((m = RATE_RE.exec(s)) !== null) {
    const value = Number(m[1] ?? m[2])
    const per = /เดือน|month/i.test(m[3]) ? 'month' : 'year'
    out.push({ raw: m[0], value, per, annual: per === 'month' ? value * 12 : value })
  }
  return out
}

// คืน { ok, reasons: [{ code, message, evidence }] }
export function checkContentGate(text, brand = {}) {
  const s = normalize(text)
  const reasons = []
  if (!s) return { ok: true, reasons }

  for (const rate of findRates(s)) {
    if (rate.annual > LEGAL_RATE_CAP_PA + 1e-9) {
      reasons.push({
        code: 'rate_over_cap',
        message: `อัตรา "${rate.raw}" คิดเป็น ${Number(rate.annual.toFixed(2))}% ต่อปี เกินเพดานกฎหมาย ${LEGAL_RATE_CAP_PA}% ต่อปี`,
        evidence: rate.raw,
      })
    }
  }

  const forbidden = Array.isArray(brand.forbidden_phrases) && brand.forbidden_phrases.length ? brand.forbidden_phrases : DEFAULT_FORBIDDEN
  const lower = s.toLowerCase()
  for (const phrase of forbidden) {
    const p = normalize(phrase).toLowerCase()
    if (p && lower.includes(p)) reasons.push({ code: 'forbidden_phrase', message: `พบคำต้องห้าม "${phrase}"`, evidence: phrase })
  }

  const license = near(s, BOT_RE, LICENSE_RE, 20)
  if (license) {
    reasons.push({
      code: 'bot_license_claim',
      message: `"${license.a}" อยู่ใกล้ "${license.b}" — ไม่มีระบบใบอนุญาต ธปท. สำหรับขายฝาก/รับจำนองนอกสถาบันการเงิน ห้ามอ้าง`,
      evidence: `${license.a} … ${license.b}`,
    })
  }

  if (!WITH_TRANSFER_RE.test(s)) {
    const fee = near(s, FEE_RE, TXN_RE, 40)
    if (fee) {
      reasons.push({
        code: 'fee_measure_misapplied',
        message: 'ค่าจดจำนอง 0.01% ใช้เฉพาะจำนองที่จดพร้อมการโอน — จำนองเดี่ยว/รีไฟแนนซ์/ขายฝาก ไม่ได้สิทธิ',
        evidence: `${fee.a} … ${fee.b}`,
      })
    }
  }

  for (const hit of checkText(s, 'ข้อความ')) {
    if (hit.severity === SEVERITY.BLOCK) reasons.push({ code: `rules:${hit.id}`, message: hit.message, evidence: hit.fix || '' })
  }

  return { ok: reasons.length === 0, reasons }
}

// จัดประเภทย่อย (subtype) · ให้คะแนนตามกฎ · กุญแจกันซ้ำ · กุญแจเหตุการณ์
// ทุกฟังก์ชันเป็น pure function — ไม่มี AI ไม่มี I/O (หลักการ: โค้ดคิดตัวเลข AI แค่เล่า)

// ตัวจัดประเภทจากหัวข่าว — เรียงลำดับ ตัวแรกที่ตรงชนะ (ใช้เมื่อฟีดไม่ได้บอก subtype มา)
export const DEFAULT_SUBTYPE_RULES = [
  ['scam', 'หลอก|โกง|มิจฉา|ฉ้อโกง|ปลอม(แปลง)?โฉนด|แก๊ง'],
  ['law', 'พ\\.ร\\.บ\\.|ประมวลกฎหมาย|ศาล|คำพิพากษา|สคบ\\.|กฎกระทรวง|ราชกิจจา'],
  ['valuation', 'ราคาประเมิน'],
  ['fee_measure', 'ค่าโอน|ค่าธรรมเนียม(การ)?โอน|จดจำนอง|LTV'],
  ['rate', 'กนง\\.|ดอกเบี้ยนโยบาย'],
  ['auction_npa', 'ขายทอดตลาด|NPA|บังคับคดี|ประมูล'],
  ['credit_market', 'สินเชื่อ|ปฏิเสธสินเชื่อ|รีเจกต์|ธอส\\.|รีไฟแนนซ์'],
  ['market', '.*'],
]

export const DEFAULT_SCORING = {
  weights: {
    transaction: { w: 2.0, words: ['ขายฝาก', 'จำนอง', 'ไถ่ถอน', 'สินไถ่', 'รับซื้อฝาก', 'รับจำนอง', 'รีไฟแนนซ์', 'สินเชื่อบ้าน', 'บ้านแลกเงิน', 'reverse mortgage', 'ฝากขาย', 'นายหน้า'] },
    pain: { w: 1.5, words: ['หนี้', 'กู้ไม่ผ่าน', 'ติดบูโร', 'แบงก์ไม่อนุมัติ', 'รีเจกต์', 'ปฏิเสธสินเชื่อ', 'เงินด่วน', 'อายัด', 'ปิดหนี้', 'ขายไม่ออก'] },
    policy: { w: 1.5, words: ['ราคาประเมิน', 'ค่าโอน', 'จดจำนอง', 'LTV', 'ดอกเบี้ยนโยบาย', 'กนง.', 'ภาษีที่ดิน', 'ผังเมือง', 'ราชกิจจา'] },
    asset: { w: 1.0, words: ['ที่ดิน', 'โฉนด', 'น.ส.3', 'บ้านเดี่ยว', 'ทาวน์โฮม', 'ตึกแถว', 'อาคารพาณิชย์', 'คอนโด', 'ห้องชุด', 'บ้านมือสอง', 'NPA', 'ขายทอดตลาด'] },
    area: { w: 1.5, words: [] },
  },
  topic_gate: ['transaction', 'policy', 'asset'],
  title_drop: 'ขายฝากทอง|ทองคำ|ค่า GP|รถมือสอง|ไอโฟน|มือถือมือสอง',
  source_drop: ['Vietnam.vn', 'VOV', 'Head Topics', 'Sortir à Paris'],
}

const DAY_MS = 86400000

export function compileSubtypeRules(rules = DEFAULT_SUBTYPE_RULES) {
  return rules.map(([subtype, pattern]) => [subtype, new RegExp(pattern, 'i')])
}

export function classifySubtype(text, rules = DEFAULT_SUBTYPE_RULES) {
  const s = String(text ?? '')
  for (const [subtype, re] of compileSubtypeRules(rules)) if (re.test(s)) return subtype
  return 'market'
}

// คะแนนจากคำ: Σ_กลุ่ม w × min(จำนวนคำต่างกันที่เจอในกลุ่ม, 2) · topic gate: ต้องเจอคำในกลุ่ม transaction/policy/asset อย่างน้อย 1 คำ
export function scoreText(text, scoring = DEFAULT_SCORING) {
  const s = String(text ?? '').toLowerCase()
  const hits = {}
  let score = 0
  for (const [group, def] of Object.entries(scoring.weights || {})) {
    const found = []
    for (const word of def.words || []) {
      const w = String(word).toLowerCase()
      if (w && s.includes(w)) found.push(word)
    }
    if (found.length) {
      hits[group] = found
      score += (Number(def.w) || 0) * Math.min(found.length, 2)
    }
  }
  const gate = scoring.topic_gate || DEFAULT_SCORING.topic_gate
  const gated = gate.some((group) => hits[group] && hits[group].length)
  return { score: round1(score), hits, gated }
}

// โบนัสความสด (news/official/community/auction) · youtube ×0.5 · ไม่มีวันที่ = 0
export function freshnessBonus(publishedAt, now = new Date(), { factor = 1 } = {}) {
  const t = toDate(publishedAt)
  if (!t) return 0
  const ageDays = (now.getTime() - t.getTime()) / DAY_MS
  let bonus = 0
  if (ageDays < 1) bonus = 2.0
  else if (ageDays < 3) bonus = 1.5
  else if (ageDays < 7) bonus = 0.8
  else if (ageDays >= 14) bonus = -1.0
  return round1(bonus * factor)
}

export function ageDays(publishedAt, now = new Date()) {
  const t = toDate(publishedAt)
  if (!t) return null
  return (now.getTime() - t.getTime()) / DAY_MS
}

export function titleDropped(title, pattern = DEFAULT_SCORING.title_drop) {
  if (!pattern) return false
  return new RegExp(pattern, 'i').test(String(title ?? ''))
}

// สำนักต่างประเทศที่ Google News ยัดเข้ามา (ชื่อเป็นอักษรจีน/ญี่ปุ่น/เกาหลี) ไม่ใช่ข่าวต้นทางของตลาดไทย
const FOREIGN_SCRIPT_RE = /[぀-ヿ㐀-鿿가-힯]/

export function sourceDropped(label, list = DEFAULT_SCORING.source_drop) {
  const raw = String(label ?? '')
  if (FOREIGN_SCRIPT_RE.test(raw)) return true
  const s = raw.toLowerCase()
  return (list || []).some((item) => s.includes(String(item).toLowerCase()))
}

// Pantip: เพดาน ~5.5 ต่ำกว่าเลนทางการโดยตั้งใจ
export function pantipScore(views = 0, comments = 0) {
  const v = Math.min(Math.log10(Math.max(0, Number(views) || 0) + 1), 5) / 5 * 2.0
  const c = Math.min(Math.log10(Math.max(0, Number(comments) || 0) + 1), 3) / 3 * 1.0
  return round1(2.5 + v + c)
}

// YouTube: เพดาน ~7.5 · min() คือตัวกันคลิปไวรัลกินท็อป ห้ามตัด
export function youtubeScore(views = 0, publishedAt, now = new Date()) {
  const v = Math.max(0, Number(views) || 0)
  const hours = Math.max(1, (ageDays(publishedAt, now) ?? 1) * 24)
  const base = 3.0 + Math.min(Math.log10(v + 1), 6) / 6 * 2.5 + Math.min(Math.log10(v / hours + 1), 4) / 4 * 1.0
  return round1(base + freshnessBonus(publishedAt, now, { factor: 0.5 }))
}

// ตัด query/utm/fragment ให้ URL เดียวกันได้กุญแจเดียวกัน
export function normalizeUrl(url) {
  try {
    const u = new URL(String(url).trim())
    u.hash = ''
    const keep = []
    for (const [k, v] of u.searchParams) {
      if (/^(utm_|fbclid|gclid|ref$|ref_|source$|mc_)/i.test(k)) continue
      keep.push([k, v])
    }
    u.search = ''
    for (const [k, v] of keep) u.searchParams.append(k, v)
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')
    let out = u.toString()
    if (out.endsWith('/') && u.pathname === '/') out = out.slice(0, -1)
    return out
  } catch {
    return String(url ?? '').trim()
  }
}

const STOPWORDS = new Set(['และ', 'หรือ', 'ที่', 'ของ', 'ใน', 'กับ', 'เพื่อ', 'จาก', 'ให้', 'ไม่', 'เป็น', 'ว่า', 'แล้ว', 'ก็', 'ยัง', 'the', 'a', 'an', 'to', 'of', 'in', 'and', 'or', 'for', 'on'])

export function tokens(text) {
  return String(text ?? '')
    .toLowerCase()
    .split(/[\s,.:;!?()[\]{}"'“”‘’|·\-–—/\\]+/)
    .map((t) => t.trim())
    .filter((t) => t && !STOPWORDS.has(t))
}

// subtype ที่ข่าววันเดียวกันแทบจะเป็นเหตุการณ์เดียวกันเสมอ (มติ กนง. · มาตรการค่าโอน · ประกาศราคาประเมิน)
export const POLICY_SUBTYPES = new Set(['rate', 'fee_measure', 'valuation'])

// กุญแจเหตุการณ์: <subtype>:<YYYY-MM-DD>[:<คำ>] — subtype นโยบายใช้แค่วัน (สำนักต่าง ๆ เลือกคำ policy ต่างกัน เช่น "LTV" กับ "ค่าโอน" ทั้งที่เป็นข่าวเดียว) ·
// subtype อื่นต่อด้วยคำกลุ่ม policy ที่เจอ (เรียงตัวอักษร) หรือ 6 คำแรกของหัวข่าวหลังตัดคำเชื่อม
export function eventKey({ subtype, publishedAt, title, policyHits = [] }, now = new Date()) {
  const day = isoDate(toDate(publishedAt) || now)
  const kind = subtype || 'market'
  if (POLICY_SUBTYPES.has(kind)) return `${kind}:${day}`
  const policy = [...new Set(policyHits.map((w) => String(w).toLowerCase()))].sort()
  const tail = policy.length ? policy.join('+') : tokens(title).slice(0, 6).join('+')
  return `${kind}:${day}:${tail}`.slice(0, 200)
}

export function isoDate(d) {
  const t = toDate(d)
  if (!t) return null
  return t.toISOString().slice(0, 10)
}

export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const t = new Date(value)
  return Number.isNaN(t.getTime()) ? null : t
}

// สัปดาห์ ISO เช่น 2026-W45 (ใช้ในกุญแจสัญญาณภายในและบทเรียน)
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t - yearStart) / DAY_MS + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10
}

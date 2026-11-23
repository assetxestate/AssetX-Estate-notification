// Content Brief + Proof Card ของหน้า /marketing — ตรรกะล้วน ไม่แตะฐานข้อมูล ไม่เรียก AI (เฟส P0 · 23 พ.ย. 2569)
// ใช้ทั้งหน้าเว็บ (แสดงผลก่อนบันทึก) และเซิร์ฟเวอร์ (server/marketing-proof.js · ด่านโพสต์ใน server/marketing-facebook.js)
//
// หลัก: ข้ออ้างที่ "ใช้ในโพสต์" ต้องยืนยันแล้วพร้อมแหล่งที่มาและสิทธิใช้ · ข้ออ้างที่ยังไม่ยืนยันห้ามโผล่ในแคปชั่น
// ราคาเสนอขาย ≠ ราคาซื้อขายจริง ≠ ราคาประเมินราชการ · เคส/ตัวเลขสมมติต้องติดป้าย
// โพสต์ความรู้ทั่วไปที่ไม่มีบรีฟยังผ่านไปให้คนตรวจได้ (ไม่บังคับแต่งเคสเพื่อให้ผ่าน)
import { POST_PII_RULES, foldDigits } from '../../server/research/pii.js'
import { POSTER_CONTACT } from './posterDesignSystem.js'

export const CLAIM_TYPES = {
  'OWN-VERIFIED': { label: 'ข้อมูลของเราเอง ตรวจแล้ว', needsSource: true, needsPermission: true },
  OFFICIAL: { label: 'แหล่งราชการ', needsSource: true, needsPermission: false },
  'MARKET-ASK': { label: 'ราคาเสนอขาย (ไม่ใช่ราคาซื้อขายจริง)', needsSource: true, needsPermission: false },
  'VERIFIED-SOLD': { label: 'ราคาซื้อขายจริงที่ยืนยันและเปิดเผยได้', needsSource: true, needsPermission: true },
  'THIRD-PARTY': { label: 'รายงานภายนอก', needsSource: true, needsPermission: false },
  SIMULATED: { label: 'ตัวอย่างสมมติ', needsSource: false, needsPermission: false },
  'NEEDS-CHECK': { label: 'ยังต้องตรวจ', needsSource: false, needsPermission: false },
}
export const CLAIM_STATUS = { draft: 'ร่าง', needs_check: 'ต้องตรวจ', verified: 'ยืนยันแล้ว', rejected: 'ไม่ใช้ (ปฏิเสธ)' }
export const CLAIM_CATEGORIES = { legal: 'กฎหมาย/ค่าธรรมเนียม', price: 'ราคา', market: 'ตลาด', field: 'หน้างาน', process: 'ขั้นตอน', general: 'ทั่วไป' }
export const PERMISSIONS = { granted: 'อนุญาตเผยแพร่แล้ว', restricted: 'ใช้ได้แบบมีเงื่อนไข', unknown: 'ยังไม่ทราบ', denied: 'ไม่อนุญาต' }
export const SOURCE_KINDS = {
  official: 'เว็บ/เอกสารราชการ', own_field: 'บันทึกหน้างานของเรา', own_media: 'ภาพ/วิดีโอที่เราถ่าย',
  listing: 'ประกาศขาย', transaction: 'เอกสารธุรกรรม', third_party: 'รายงาน/ข่าวภายนอก', other: 'อื่น ๆ',
}
export const PRICE_KINDS = {
  OFFICIAL_APPRAISAL: 'ราคาประเมินราชการ', MARKET_ASK: 'ราคาเสนอขาย', VERIFIED_SOLD: 'ราคาซื้อขายจริงที่ยืนยันแล้ว',
  INTERNAL_ESTIMATE: 'ประมาณการภายใน', SIMULATED: 'ตัวเลขสมมติ',
}
export const BRIEF_MODES = { topic: 'เริ่มจากหัวข้อ', field: 'เริ่มจากข้อมูลหน้างาน', link: 'เริ่มจากลิงก์อ้างอิง' }
export const LOCATION_LEVELS = { none: 'ไม่ระบุพื้นที่', region: 'ระดับภาค', province: 'ระดับจังหวัด', district: 'ระดับอำเภอ/เขต', subdistrict: 'ระดับตำบล/แขวง' }

// แหล่งสาธารณะ (ราชการ ประกาศ รายงาน) อ้างถึงได้โดยไม่ต้องขออนุญาต · ของเราเอง/เอกสารธุรกรรม เริ่มที่ "ยังไม่ทราบ" = ใช้สาธารณะไม่ได้
const PUBLIC_SOURCE_KINDS = new Set(['official', 'listing', 'third_party'])
const text = (value, max) => String(value ?? '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, max)
const lines = (value, max = 12, each = 300) => (Array.isArray(value) ? value : String(value ?? '').split('\n'))
  .map((item) => text(item, each)).filter(Boolean).slice(0, max)
const isoDate = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined
}
const dateOnly = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(Date.parse(raw)) ? raw : undefined
}

// ── ตรวจและจัดรูปข้อมูลขาเข้า (ข้อความผิดพลาดภาษาไทย) ─────────────────────────
export function normalizeBrief(input = {}) {
  const errors = []
  const field = input.field && typeof input.field === 'object' ? input.field : {}
  const surveyDate = dateOnly(field.survey_date)
  if (surveyDate === undefined) errors.push('วันที่สำรวจไม่ถูกต้อง')
  const priceKind = text(field.price_kind, 30)
  if (priceKind && !Object.hasOwn(PRICE_KINDS, priceKind)) errors.push('ประเภทข้อมูลราคาไม่ถูกต้อง')
  const mode = Object.hasOwn(BRIEF_MODES, input.mode) ? input.mode : 'topic'
  const level = Object.hasOwn(LOCATION_LEVELS, input.public_location_level) ? input.public_location_level : 'none'
  const value = {
    mode,
    brand_id: text(input.brand_id, 40) || 'assetx_estate',
    series_id: text(input.series_id, 40),
    topic: text(input.topic, 200),
    audience: text(input.audience, 200),
    objective: text(input.objective, 40),
    platform: text(input.platform, 30) || 'facebook',
    content_format: text(input.content_format, 30) || 'post',
    audience_problem: text(input.audience_problem, 400),
    unique_insight: text(input.unique_insight, 400),
    intended_takeaway: text(input.intended_takeaway, 400),
    cta: text(input.cta, 200),
    asset_type: text(input.asset_type, 40),
    public_location_level: level,
    public_location: text(input.public_location, 120),
    editorial_notes: text(input.editorial_notes, 1000),
    reference_url: text(input.reference_url, 500),
    field: {
      survey_date: surveyDate || null,
      features: text(field.features, 600),
      observations: lines(field.observations),
      unknowns: lines(field.unknowns),
      price_kind: priceKind,
      customer_question: text(field.customer_question, 300),
      lesson: text(field.lesson, 300),
    },
  }
  if (!value.topic) errors.push('กรอกหัวข้อของคอนเทนต์')
  if (value.reference_url && !/^https?:\/\//i.test(value.reference_url)) errors.push('ลิงก์อ้างอิงต้องขึ้นต้นด้วย http:// หรือ https://')
  if (mode === 'link' && !value.reference_url) errors.push('โหมดเริ่มจากลิงก์อ้างอิงต้องใส่ลิงก์')
  return { ok: errors.length === 0, value, errors }
}

export function normalizeSource(input = {}) {
  const errors = []
  const kind = Object.hasOwn(SOURCE_KINDS, input.kind) ? input.kind : 'other'
  const sourceDate = dateOnly(input.source_date)
  const checkedAt = dateOnly(input.checked_at)
  if (sourceDate === undefined) errors.push('วันที่ของแหล่งข้อมูลไม่ถูกต้อง')
  if (checkedAt === undefined) errors.push('วันที่ตรวจแหล่งข้อมูลไม่ถูกต้อง')
  const permission = Object.hasOwn(PERMISSIONS, input.permission_status)
    ? input.permission_status
    : (PUBLIC_SOURCE_KINDS.has(kind) ? 'granted' : 'unknown')
  const value = {
    kind,
    title: text(input.title, 200),
    source_url: text(input.source_url, 500),
    asset_ref: text(input.asset_ref, 200),
    source_date: sourceDate || null,
    checked_at: checkedAt || null,
    permission_status: permission,
    visibility: input.visibility === 'internal' ? 'internal' : 'public',
    note: text(input.note, 500),
  }
  if (!value.title) errors.push('กรอกชื่อแหล่งข้อมูล')
  if (value.source_url && !/^https?:\/\//i.test(value.source_url)) errors.push('ลิงก์แหล่งข้อมูลต้องขึ้นต้นด้วย http:// หรือ https://')
  if (kind === 'official' && !value.source_url && !value.asset_ref) errors.push('แหล่งราชการต้องมีลิงก์หรือชื่อเอกสารอ้างอิง')
  return { ok: errors.length === 0, value, errors }
}

export function normalizeClaim(input = {}) {
  const errors = []
  const claimType = Object.hasOwn(CLAIM_TYPES, input.claim_type) ? input.claim_type : 'NEEDS-CHECK'
  const category = Object.hasOwn(CLAIM_CATEGORIES, input.category) ? input.category : 'general'
  const expiresAt = dateOnly(input.expires_at)
  if (expiresAt === undefined) errors.push('วันหมดอายุของหลักฐานไม่ถูกต้อง')
  const value = {
    claim_text: text(input.claim_text ?? input.text, 500),
    claim_type: claimType,
    category,
    limitation: text(input.limitation ?? input.limitations, 500),
    publishable_wording: text(input.publishable_wording, 500),
    permission_status: Object.hasOwn(PERMISSIONS, input.permission_status) ? input.permission_status : 'unknown',
    expires_at: expiresAt || null,
    use_in_post: input.use_in_post !== false,
  }
  if (!value.claim_text) errors.push('กรอกข้อความของข้ออ้าง')
  return { ok: errors.length === 0, value, errors }
}

// ── ความพร้อมของข้ออ้าง ──────────────────────────────────────────────────────
const sourcesOf = (claim, sources, links) => {
  const ids = new Set((links || []).filter((link) => String(link.claim_id) === String(claim.id)).map((link) => String(link.source_id)))
  return (sources || []).filter((source) => ids.has(String(source.id)))
}

// ยืนยันข้ออ้างได้หรือยัง (ใช้ตอนกด "ยืนยันแล้ว" ฝั่งเซิร์ฟเวอร์) — คืนเหตุผลที่ยังยืนยันไม่ได้
export function verifyProblems(claim, claimSources = []) {
  const spec = CLAIM_TYPES[claim.claim_type] || CLAIM_TYPES['NEEDS-CHECK']
  const problems = []
  if (claim.claim_type === 'NEEDS-CHECK') problems.push('เลือกประเภทหลักฐานก่อน (ตอนนี้เป็น "ยังต้องตรวจ")')
  if (spec.needsSource && !claimSources.length) problems.push('ผูกแหล่งข้อมูลอย่างน้อย 1 แหล่ง')
  if (spec.needsSource && claimSources.length && !claimSources.some((source) => source.checked_at)) problems.push('ใส่วันที่ตรวจแหล่งข้อมูล')
  if (spec.needsPermission && claim.permission_status !== 'granted') problems.push('ข้อมูลของเรา/ธุรกรรมจริงต้องได้รับอนุญาตเผยแพร่ก่อน')
  return problems
}

const SOLD_WORDS = /ราคาซื้อขายจริง|ราคาปิดการขาย|ราคาปิดดีล|ปิดการขายที่|ขายได้ที่ราคา|ซื้อขายกันที่|ราคาที่ขายได้/
// คำปฏิเสธนำหน้า ("ไม่ใช่ราคาซื้อขายจริง" "ยังไม่ใช่ราคาที่ขายได้") คือคำกำกับที่ถูกต้อง ไม่ใช่การอ้างราคาซื้อขาย
const NEGATED_SOLD = new RegExp(`(?:ไม่ใช่|ไม่เท่ากับ|ไม่ได้เป็น|มิใช่|≠)\\s*(?:${SOLD_WORDS.source})`, 'g')
const claimsSoldPrice = (value) => SOLD_WORDS.test(String(value ?? '').replace(NEGATED_SOLD, ' '))
const ASK_LABEL = /ราคาเสนอขาย|ราคาตั้งขาย|ราคาประกาศขาย|ราคาประกาศ/
const SIM_LABEL = /สมมติ|จำลอง/

// ตัวอักษร 3 ตัวติดกัน (ไม่มีช่องว่าง/วรรคตอน) — ภาษาไทยไม่เว้นคำ จึงเทียบความซ้ำด้วยชุดอักษรแทนการตัดคำ
function trigrams(value) {
  const clean = foldDigits(String(value ?? '')).toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
  const set = new Set()
  for (let i = 0; i + 3 <= clean.length; i += 1) set.add(clean.slice(i, i + 3))
  return set
}
// สัดส่วนของข้อความ a ที่ไปปรากฏใน b (0–1)
export function containment(a, b) {
  const left = trigrams(a)
  if (left.size < 6) return 0
  const right = trigrams(b)
  let hit = 0
  for (const gram of left) if (right.has(gram)) hit += 1
  return hit / left.size
}
const CLAIM_IN_TEXT = 0.7

function claimLabel(claim, index) {
  const snippet = String(claim.claim_text || '').slice(0, 60)
  return `ข้ออ้าง ${index + 1} "${snippet}${String(claim.claim_text || '').length > 60 ? '…' : ''}"`
}

// ตรวจข้ออ้างทั้งชุดเทียบกับข้อความโพสต์ → { blockers, warnings, used, perClaim }
export function evaluateClaims({ claims = [], sources = [], links = [], postText = '', now = Date.now() } = {}) {
  const blockers = []
  const warnings = []
  const used = []
  const perClaim = []
  const today = new Date(now).toISOString().slice(0, 10)
  claims.forEach((claim, index) => {
    const label = claimLabel(claim, index)
    const claimSources = sourcesOf(claim, sources, links)
    const issues = []
    const inText = containment(claim.publishable_wording || claim.claim_text, postText) >= CLAIM_IN_TEXT
      || containment(claim.claim_text, postText) >= CLAIM_IN_TEXT
    const wanted = claim.use_in_post !== false
    if (claim.status === 'rejected') {
      if (inText) issues.push({ code: 'rejected_in_text', message: `${label} ถูกปฏิเสธแล้ว แต่ข้อความยังอยู่ในโพสต์ — ตัดออก` })
    } else if (claim.status !== 'verified' || claim.claim_type === 'NEEDS-CHECK') {
      if (inText) issues.push({ code: 'unverified_in_text', message: `${label} ยังไม่ยืนยัน แต่ข้อความอยู่ในโพสต์ — ยืนยันพร้อมแหล่งที่มา หรือตัดออกจากโพสต์` })
      else if (wanted) issues.push({ code: 'unverified', message: `${label} ยังไม่ยืนยัน — ยืนยันพร้อมแหล่งที่มา หรือเลือก "ไม่ใช้ในโพสต์"` })
    } else if (wanted || inText) {
      // ยืนยันแล้ว: ตรวจซ้ำว่าเงื่อนไขยังครบ (แหล่งถูกถอด สิทธิเปลี่ยน หรือหมดอายุหลังยืนยัน)
      for (const problem of verifyProblems(claim, claimSources)) issues.push({ code: 'proof_incomplete', message: `${label}: ${problem}` })
      const badSource = claimSources.find((source) => source.permission_status !== 'granted')
      if (badSource) issues.push({ code: 'source_permission', message: `${label}: แหล่ง "${badSource.title}" ยังไม่ได้รับอนุญาตเผยแพร่ (${PERMISSIONS[badSource.permission_status] || 'ไม่ทราบ'})` })
      if (claim.expires_at && claim.expires_at < today) issues.push({ code: 'expired', message: `${label}: หลักฐานหมดอายุเมื่อ ${claim.expires_at} — ตรวจใหม่ก่อนใช้` })
      if (claim.claim_type === 'SIMULATED' && !SIM_LABEL.test(postText)) issues.push({ code: 'simulated_unlabeled', message: `${label} เป็นตัวอย่างสมมติ — โพสต์ต้องเขียนกำกับว่า "ตัวอย่างสมมติ"` })
      if (claim.claim_type === 'MARKET-ASK' && !ASK_LABEL.test(postText)) issues.push({ code: 'ask_unlabeled', message: `${label} เป็นราคาเสนอขาย — โพสต์ต้องเขียนกำกับว่า "ราคาเสนอขาย"` })
      if (!issues.length) used.push(claim)
      if (!claim.limitation && ['legal', 'price', 'market'].includes(claim.category)) warnings.push(`${label}: ยังไม่ได้เขียนข้อจำกัดของข้อมูลนี้`)
    }
    blockers.push(...issues.map((issue) => issue.message))
    perClaim.push({ id: claim.id, issues, sources: claimSources.map((source) => source.id), inText })
  })
  // ราคาเสนอขายห้ามถูกเล่าเป็นราคาซื้อขายจริง: มีคำว่าซื้อขายจริง/ปิดการขาย ต้องมีข้ออ้าง VERIFIED-SOLD ที่ยืนยันและใช้ได้รองรับ
  if (claims.length && claimsSoldPrice(postText) && !used.some((claim) => claim.claim_type === 'VERIFIED-SOLD')) {
    blockers.push('โพสต์พูดถึงราคาซื้อขายจริง/ราคาปิดการขาย แต่ไม่มีข้ออ้างประเภท "ราคาซื้อขายจริงที่ยืนยันและเปิดเผยได้" รองรับ — ราคาเสนอขายห้ามเล่าเป็นราคาซื้อขายจริง')
  }
  return { blockers: [...new Set(blockers)], warnings: [...new Set(warnings)], used, perClaim }
}

// ── ข้อมูลส่วนบุคคลในข้อความที่จะเผยแพร่ ──────────────────────────────────────
const PRIVACY_LABELS = {
  phone_intl: 'เบอร์โทร', phone: 'เบอร์โทร', line_id: 'LINE ID', email: 'อีเมล', handle: 'ชื่อบัญชี @',
  deed_no: 'เลขเอกสารสิทธิ์', case_no: 'เลขคดี/เลขประกาศ', titled_name: 'ชื่อบุคคล', national_id: 'เลขประจำตัว 13 หลัก', coordinates: 'พิกัดแปลง',
}
const EXTRA_PRIVACY_RULES = [
  { kind: 'national_id', re: /(?<!\d)\d[- ]?\d{4}[- ]?\d{5}[- ]?\d{2}[- ]?\d(?!\d)/g },
  { kind: 'coordinates', re: /(?<!\d)\d{1,2}\.\d{4,}\s*,\s*\d{2,3}\.\d{4,}(?!\d)/g },
  // LINE ID ต้องมีคำว่า ID/ไอดี หรือเครื่องหมาย : นำ — กฎชุดรีเสิร์ชจับ "LINE Official" เป็น ID ซึ่งจะบล็อกโพสต์ปกติ
  { kind: 'line_id', re: /(?:line|ไลน์)\s*(?:(?:id|ไอดี)\s*[:：]?|[:：])\s*@?[A-Za-z0-9_.\-]{3,}/gi },
]
// ชื่อบัญชี @ ไม่บล็อก (เพจ/แบรนด์ถูกเอ่ยถึงได้) · LINE ID ใช้กฎด้านบนแทน
const POST_RULES = POST_PII_RULES.filter((rule) => !['handle', 'line_id'].includes(rule.kind))
// ช่องทางติดต่อของบริษัทเอง ไม่ใช่ข้อมูลส่วนบุคคลของลูกค้า
const OWN_CONTACTS = [POSTER_CONTACT.phone, POSTER_CONTACT.phone.replace(/\D/g, ''), `@${POSTER_CONTACT.line}`, POSTER_CONTACT.line, 'assetxestate@gmail.com']

export function privacyFindings(value, { allow = OWN_CONTACTS } = {}) {
  let body = foldDigits(String(value ?? ''))
  // แฮชแท็กไม่ใช่ชื่อบัญชี · ช่องทางของบริษัทไม่นับ
  for (const item of allow) if (item) body = body.split(item).join(' ')
  const found = []
  for (const rule of [...EXTRA_PRIVACY_RULES, ...POST_RULES]) {
    const re = new RegExp(rule.re.source, rule.re.flags)
    const count = (body.match(re) || []).length
    if (count) {
      found.push({ kind: rule.kind, count })
      body = body.replace(re, ' ')
    }
  }
  return found.map((hit) => `พบ${PRIVACY_LABELS[hit.kind] || 'ข้อมูลส่วนบุคคล'}ในข้อความ (${hit.count} จุด) — ลบหรือปิดก่อนเผยแพร่`)
}

// ── สิ่งที่บรีฟยังขาด (คำแนะนำ ไม่ใช่ตัวบล็อก) ─────────────────────────────────
export function briefMissing(brief = {}, claims = [], sources = []) {
  const missing = []
  const field = brief.field || {}
  if (!brief.audience_problem) missing.push('ปัญหาของคนอ่านที่โพสต์นี้ตอบ')
  if (!brief.intended_takeaway) missing.push('สิ่งที่คนอ่านทำต่อได้ (takeaway)')
  if (brief.mode === 'field') {
    if (!field.observations?.length) missing.push('ข้อสังเกตจริงจากหน้างาน อย่างน้อย 1 ข้อ')
    if (!field.survey_date) missing.push('วันที่สำรวจ')
    if (!field.unknowns?.length) missing.push('สิ่งที่ยังไม่ทราบ/ยังสรุปไม่ได้')
  }
  if (brief.mode === 'link' && !sources.length) missing.push('บันทึกลิงก์อ้างอิงเป็นแหล่งข้อมูล')
  if (!claims.length) missing.push('ข้ออ้างสำคัญที่โพสต์จะพูด (ถ้าเป็นความรู้ทั่วไปไม่ต้องมี)')
  for (const claim of claims) {
    if (claim.status !== 'verified' && claim.status !== 'rejected' && claim.use_in_post !== false) {
      missing.push(`ยืนยันข้ออ้าง "${String(claim.claim_text).slice(0, 50)}" — ${suggestEvidence(claim)}`)
    }
  }
  return missing
}

// หลักฐานที่ควรหาเพิ่มตามหมวดของข้ออ้าง (แนะนำ ไม่เติมข้อเท็จจริงเอง)
export function suggestEvidence(claim = {}) {
  switch (claim.category) {
    case 'legal': return 'หาตัวบท/ประกาศจากแหล่งราชการ พร้อมวันที่มีผลบังคับใช้'
    case 'price': return 'ระบุชนิดราคา (ราชการ/เสนอขาย/ซื้อขายจริง) และแนบแหล่งที่ตรวจได้'
    case 'market': return 'หาแหล่งสถิติ/รายงานที่บอกวิธีเก็บข้อมูลและวันที่'
    case 'field': return 'แนบบันทึกหน้างานหรือภาพที่มีสิทธิใช้ พร้อมวันที่สำรวจ'
    default: return 'แนบแหล่งที่มาและวันที่ตรวจ'
  }
}

// ── ร่างโพสต์จากบรีฟ (ไม่ใช้ AI: เรียงเฉพาะข้อมูลที่คนกรอกและข้ออ้างที่ยืนยันแล้ว ไม่เติมข้อเท็จจริง) ──────────
const thaiDate = (value) => {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00+07:00`)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }) : ''
}
const TYPE_PREFIX = { 'MARKET-ASK': 'ราคาเสนอขาย: ', SIMULATED: 'ตัวอย่างสมมติ: ' }

export function canComposeFromBrief(brief = {}, claims = []) {
  const field = brief.field || {}
  return Boolean(field.observations?.length || claims.some((claim) => claim.status === 'verified' && claim.use_in_post !== false) || brief.unique_insight)
}

export function composeProofDraft({ brief = {}, claims = [], sources = [], links = [] } = {}) {
  const field = brief.field || {}
  const usable = claims.filter((claim) => claim.status === 'verified' && claim.claim_type !== 'NEEDS-CHECK' && claim.use_in_post !== false)
  const pending = claims.filter((claim) => claim.status !== 'verified' && claim.status !== 'rejected' && claim.use_in_post !== false)
  const parts = []
  const opening = brief.unique_insight || brief.audience_problem || brief.topic
  parts.push(opening)
  if (brief.unique_insight && brief.audience_problem) parts.push(brief.audience_problem)
  if (field.observations?.length) {
    const where = brief.public_location_level !== 'none' && brief.public_location ? ` · ${brief.public_location}` : ''
    const when = field.survey_date ? ` (สำรวจ ${thaiDate(field.survey_date)}${where})` : (where ? ` (${where.slice(3)})` : '')
    parts.push([`สิ่งที่เห็นจากหน้างาน${when}`, ...field.observations.map((item, index) => `${index + 1}. ${item}`)].join('\n'))
  }
  if (usable.length) {
    const rows = usable.map((claim) => {
      const wording = claim.publishable_wording || claim.claim_text
      const prefix = TYPE_PREFIX[claim.claim_type] && !wording.includes(TYPE_PREFIX[claim.claim_type].replace(': ', '')) ? TYPE_PREFIX[claim.claim_type] : ''
      const limit = claim.limitation ? ` (${claim.limitation})` : ''
      return `• ${prefix}${wording}${limit}`
    })
    parts.push(['ข้อมูลที่ตรวจแล้ว', ...rows].join('\n'))
  }
  if (field.unknowns?.length) parts.push(['สิ่งที่ยังต้องตรวจก่อนสรุป', ...field.unknowns.map((item) => `• ${item}`)].join('\n'))
  if (field.lesson) parts.push(field.lesson)
  if (brief.intended_takeaway) parts.push(`สิ่งที่ทำได้เลย: ${brief.intended_takeaway}`)
  const usedSources = sources.filter((source) => source.visibility !== 'internal' && source.permission_status === 'granted'
    && usable.some((claim) => links.some((link) => String(link.claim_id) === String(claim.id) && String(link.source_id) === String(source.id))))
  if (usedSources.length) {
    parts.push(`ที่มา: ${usedSources.map((source) => `${source.title}${source.checked_at ? ` (ข้อมูล ณ วันที่ ${thaiDate(source.checked_at)})` : ''}`).join(' · ')}`)
  }
  if (usable.some((claim) => claim.category === 'legal')) parts.push('ข้อมูลทั่วไป ไม่ใช่คำแนะนำทางกฎหมายเฉพาะกรณี')
  const cta = brief.cta || 'เก็บโพสต์นี้ไว้ใช้ตรวจทรัพย์ของตัวเอง'
  parts.push(cta)
  return {
    headline: brief.topic,
    caption: parts.filter(Boolean).join('\n\n'),
    cta,
    claim_ids_used: usable.map((claim) => claim.id),
    missing_evidence: pending.map((claim) => ({ claim_id: claim.id, text: claim.claim_text, need: suggestEvidence(claim) })),
    // บอกผู้ใช้ตรง ๆ ว่าร่างนี้ยืนบนอะไร — ไม่แอบอ้างว่าเป็นเคสจริงเมื่อไม่มีข้อมูลหน้างาน
    basis: field.observations?.length ? 'field' : (usable.length ? 'verified_claims' : 'general'),
  }
}

// server/research/hooks.js — ระบบออกแบบ hook (ประโยคเปิด + พาดหัวคู่) ของร่างโพสต์
//
// เจ้าของสั่ง 9 พ.ย. 2569: "ทำระบบการออกแบบ Hook ให้อ่านแล้วชวนให้หยุดและน่าอ่านต่อ … รีเสิร์ชคลิปหรือคอนเทนต์บนโซเชียลที่เป็นไวรัล มาปรับประยุกต์ให้เป็นแบบฉบับของเรา"
// ที่วัดได้ก่อนทำ (ร่าง AI 58 ชิ้น): พาดหัวเป็นป้ายชื่อเรื่อง ("รับจำนอง ต้องเช็กสิทธิ") · ประโยคเปิดวนอยู่ 3 แม่แบบ
// ("ถ้าคุณกำลัง… มี N ข้อให้เช็ก" · "เคสสมมุติ: …" · "ธนาคารแห่งประเทศไทย (ธปท.) แถลง…") — บอกเรื่อง แต่ไม่มีเหตุให้อ่านต่อ
//
// 3 ส่วน (ไม่มี AI ในไฟล์นี้ — ตรวจสอบได้ทุกขั้น):
//  1. pickHookPatterns — เลือก 3 สูตรต่อร่างจาก research/hook_patterns.json ตามโครงโพสต์ · ไม่ซ้ำสูตรของมุมอื่นในเรื่องเดียวกัน · ลดน้ำหนักสูตรที่เพิ่งใช้ในรอบ
//     · น้ำหนักเพิ่มตามบทเรียนจากของไวรัลจริง (hook-lessons.js → .local/research/hooks/lessons.json)
//  2. hookPromptLines — คำสั่งให้ผู้เขียนเขียนประโยคเปิด 3 แบบ (แบบละสูตร มีพาดหัวคู่) แล้วเลือกแบบที่ดีที่สุดเป็นบรรทัดแรก
//  3. parseHooks / scoreHook — ล้าง ตรวจกติกา (คลิกเบต ขอยอด ระบุสถานะการเงินคนอ่าน ความเร่งปลอม อ้างเคสจริง) และให้คะแนน 0–100 พร้อมเหตุผลภาษาไทย
//     · classifyHook ใช้ทั้งเดาสูตรของประโยคเปิดที่ผู้เขียนแต่งเอง และถอดสูตรของตัวอย่างไวรัลในเลนบทเรียน
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { similarity } from '../../src/lib/marketing-model/scoring.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_HOOKS_FILE = path.resolve(HERE, '..', '..', 'research', 'hook_patterns.json')
export const DEFAULT_LESSONS_FILE = path.resolve(HERE, '..', '..', '.local', 'research', 'hooks', 'lessons.json')

// Facebook ตัดข้อความยาวเป็น "ดูเพิ่มเติม" — บรรทัดแรกต้องจบใจความก่อนนั้น (templates.js facebook.hookChars = 125) · เป้าคือสั้นกว่านั้นมาก
export const HOOK_MAX = 125
export const HOOK_IDEAL = 90
// คะแนนต่ำกว่านี้ = ร่างใหม่ 1 ครั้งพร้อมบอกเหตุผล (generateDrafts) · ครั้งที่สองยังต่ำ = เก็บไว้พร้อมคำเตือน ไม่ทิ้งร่าง
export const HOOK_WEAK = 45
export const HOOKS_PER_DRAFT = 3

export function loadHookPatterns(file = DEFAULT_HOOKS_FILE) {
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  const patterns = (Array.isArray(raw.patterns) ? raw.patterns : [])
    .filter((p) => p && p.id && p.name && p.how && Array.isArray(p.formats) && p.formats.length)
    .map((p) => ({ ...p, weight: Number.isFinite(p.weight) ? p.weight : 1, family: p.family || 'statement' }))
  return { updated: raw.updated || '', rules: Array.isArray(raw.rules) ? raw.rules : [], patterns }
}

// บทเรียนจากของไวรัลจริง (hook-lessons.js) — ไม่มีไฟล์ = น้ำหนักเท่ากันทุกสูตร (ระบบยังทำงานได้)
export function loadHookLessons(file = DEFAULT_LESSONS_FILE) {
  try {
    if (!existsSync(file)) return null
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    return raw && typeof raw === 'object' && raw.patterns ? raw : null
  } catch { return null }
}

// ── ตัวถอดสูตร (ภาษาไทย · regex) ──────────────────────────────────────────────
// สูตรของเรา + สูตรที่พบในตลาดแต่เราไม่ใช้ (offer-led · outcome-promise · hype · big-number · local-callout) — ไว้เทียบในบทเรียนว่าอะไรแรงจริง
const CONSEQUENCE_WORDS = /(เสีย|หลุด|ทุบ|ตัดขาด|โดน|ถูก(ยึด|ฟ้อง|ขาย|ปฏิเสธ)|พลาด|ไม่ทัน|ติด(หนี้|ภาระ)|พัง|จบ|ขายไม่ได้|กู้ไม่ผ่าน)/
const DETECTORS = {
  misconception: (t) => /ไม่ได้แปลว่า|ไม่(ได้)?(ใช่|เป็น)(เจ้าของ|ของ)|เข้าใจผิด|จำไว้|ความจริง(คือ)?|ไม่มีอำนาจ|ไม่จำเป็นต้อง|ที่จริงแล้ว|ไม่เหมือนที่คิด|เป็นของใคร/.test(t),
  'consequence-first': (t) => {
    const at = t.indexOf('เพราะ')
    if (at < 0) return false
    const m = CONSEQUENCE_WORDS.exec(t)
    return Boolean(m) && m.index < at
  },
  'avoid-loss': (t) => /(ถึงจะ|จะได้|ยังไง|อย่างไร|แบบไหน)[^\n]{0,12}ไม่(ให้)?เสีย|ไม่ให้เสีย|ไม่เสีย(โง่|สิทธิ|บ้าน|ที่ดิน|ทรัพย์|เงิน)/.test(t),
  'scam-signal': (t) => /กลโกง|มิจฉาชีพ|หลอก|โกง|สัญญาณ(อันตราย|เตือน)|ระวัง|แก๊ง|ปลอม|เอกสารเปล่า|(ต้อง|ให้)หยุด|หยุดก่อน/.test(t),
  'exact-situation': (t) => /แต่/.test(t) && !/ทำไม/.test(t) && /^(ถ้า|หาก)?\s*(มี|กู้|ซื้อ|ขาย|เป็น|ติด|อยาก|ได้|รับ|ถือ|พ่อ|แม่|ทำ|ใช้|โฉนด|บ้าน|ที่ดิน|คอนโด|เจ้าของ|ทายาท)/.test(t),
  'can-i': (t) => /(ได้|ทำได้)(ไหม|มั้ย|หรือไม่|หรือเปล่า)/.test(t),
  'paradox-why': (t) => /ทำไม/.test(t) && /(แต่|ทั้งที่|กลับ)/.test(t),
  'specific-checklist': (t) => /\d+\s*(ข้อ|สิ่ง|เรื่อง|จุด|ขั้น|วิธี|อย่าง|บรรทัด|เอกสาร|คำถาม)|(สาม|สี่|ห้า|หก)\s*(ข้อ|สิ่ง|จุด|เรื่อง|บรรทัด)/.test(t),
  'cost-reveal': (t) => /ค่าใช้จ่าย|ค่าธรรมเนียม|ภาษี|อากร|ต้องจ่าย|เตรียมเงิน|เงินที่ต้อง|ใครจ่าย/.test(t),
  compare: (t) => /\bvs\.?\b|ต่างกัน|ต่างจาก|ต่างตรงไหน|เทียบ|แบบไหนดี|ดีกว่ากัน/i.test(t),
  'news-impact': (t) => /เตรียม(เฮ|รับมือ|ตัว)|ได้เฮ|มีเฮ|ใครได้|ใครจะ|ได้ประโยชน์|กระทบ|มีผล|เริ่มแล้ว|ข่าวนี้|แปลว่า|ต้องเผื่อ|ต่างจากเดิม/.test(t),
  // คำพูดสั้นที่ปิดเครื่องหมายแล้วมีคำต่อท้าย — ไม่ใช่แอดประกาศขายที่ครอบทั้งบรรทัดด้วย "…" (เจอจริงในคลังแอด 9 พ.ย. 2569: "หลังนี้มีเงินเหลือ…)
  'quote-open': (t) => /^["“‘][^"”’]{3,80}["”’]\s*[ก-๙A-Za-z]/.test(t),
  timeline: (t) => /(เหลือ|อีก|ภายใน)\s*\d+\s*(วัน|เดือน|ปี)|ก่อน(ครบ)?กำหนด|ก่อนวัน(ไถ่|โอน|นัด|เซ็น|ครบ)|ถ้าพลาดรอบนี้/.test(t),
  // ประกาศบริการของเรา (13 พ.ย. 2569 · โครง offer): ขึ้นต้นด้วยบริการ + ทรัพย์ แล้วมีเอกสาร/ขั้นตอน/คำถามที่โพสต์ตอบได้ — แบบตลาดที่ขายเรต/ความเร็วล้วนยังเป็น offer-led
  'service-offer': (t) => /^[^ก-๙A-Za-z0-9]*รับ(ขายฝาก|จำนอง)\s*(คอนโด|ห้องชุด|บ้าน|ทาวน์โฮม|ที่ดิน|อาคาร|ตึกแถว|ทรัพย์)/.test(t) && /สำนักงานที่ดิน|โฉนด|อ\.ช\.\s?2|หนังสือกรรมสิทธิ์|เอกสาร|ไถ่|ค่าใช้จ่าย|ขั้นตอน|[?？]|ไหม|อะไร|วันไหน|อย่างไร|ยังไง/.test(t),
  // ── สูตรที่พบในตลาด แต่ไม่อยู่ในคลังของเรา (ผิดกติกาแบรนด์ หรือไม่ใช่ hook)
  'offer-led': (t) => /^[^ก-๙A-Za-z0-9]*(รับ(จำนอง|ขายฝาก|ซื้อ|ฝากขาย|ไถ่ถอน)|บริการ|สินเชื่อ|เงินด่วน)/.test(t),
  'outcome-promise': (t) => /รวย|ได้เงิน(ก้อน|ไว|ทันที|เร็ว|ใช้)|อนุมัติ(ไว|เร็ว|ง่าย)|ช่วยท่านได้|ทันใจ|ไม่เช็ค(เครดิต|บูโร)|มีเงินเหลือ|ผ่อน(สบาย|ถูก)|เงินทุนหมุนเวียน/.test(t),
  hype: (t) => /!|‼|ช็อก|ช๊อก|อึ้ง|ตะลึง|ห้ามพลาด|ไม่ดูเสียใจ|ยับ/.test(t),
  'big-number': (t) => /(แสน|หมื่น|พัน)ล้าน|\d+\s*ล้าน|\d{1,3}(,\d{3}){1,}/.test(t),
  'local-callout': (t) => /^คน[ก-๙]{2,12}(เตรียม|ได้|มี|รอ)|จังหวัดไหน|เมืองไหน|ทำเลไหน/.test(t),
  question: (t) => /[?？]|ไหม|มั้ย|ทำไม|อย่างไร|ยังไง|อะไรบ้าง|เท่าไร|เท่าไหร่/.test(t),
}
export const MARKET_ONLY_PATTERNS = ['offer-led', 'outcome-promise', 'hype', 'big-number', 'local-callout', 'question']

export function classifyHook(text = '') {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (!t) return []
  return Object.entries(DETECTORS).filter(([, test]) => test(t)).map(([id]) => id)
}

// สูตรของเรา (ไม่ใช่สูตรตลาด) ตัวแรกที่ตรง — ใช้เดาสูตรของประโยคเปิดที่ผู้เขียนแต่งเอง
export function primaryPattern(text = '', ids = null) {
  const own = classifyHook(text).filter((id) => !MARKET_ONLY_PATTERNS.includes(id))
  const allowed = ids ? own.filter((id) => ids.includes(id)) : own
  return allowed[0] || own[0] || 'other'
}

// ── เลือกสูตรต่อร่าง ─────────────────────────────────────────────────────────
function hash32(s) {
  let h = 2166136261
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0 }
  return h >>> 0
}

// น้ำหนักจากบทเรียน: lift = สัดส่วนสูตรนี้ในตัวอย่างที่แรงกว่าปกติ ÷ สัดส่วนในตัวอย่างทั้งหมด · ตัวอย่างน้อยกว่า 5 ไม่นับ · จำกัด 0.6–1.8 เท่า (ข้อมูลยังน้อย ห้ามให้สูตรเดียวกินหมด)
export function lessonWeight(lessons, id) {
  const p = lessons?.patterns?.[id]
  if (!p || !(p.n >= 5) || !Number.isFinite(p.lift)) return 1
  return Math.min(1.8, Math.max(0.6, p.lift))
}

// format = โครงโพสต์ที่ร่างนี้ใช้ (DRAFT_FORMATS) · hasFacts = มีข้อเท็จจริง/คลังความรู้ให้หักความเชื่อได้
// avoid = สูตรที่มุมอื่นของเรื่องเดียวกันใช้แล้ว (ห้ามซ้ำถ้าเลือกได้) · recent = สูตรที่ร่างก่อนหน้าในรอบนี้ใช้ (ลดน้ำหนักทีละ 25%)
export function pickHookPatterns({ format = 'explain', hasFacts = true, avoid = [], recent = [], seed = 0, lessons = null, library = null, count = HOOKS_PER_DRAFT } = {}) {
  const lib = library || loadHookPatterns()
  const fits = lib.patterns.filter((p) => p.formats.includes(format) && (!p.needs_facts || hasFacts))
  const fallback = lib.patterns.filter((p) => p.formats.includes('explain') && (!p.needs_facts || hasFacts))
  let pool = fits.length >= count ? fits : [...fits, ...fallback.filter((p) => !fits.includes(p))]
  const avoidSet = new Set(avoid)
  const fresh = pool.filter((p) => !avoidSet.has(p.id))
  if (fresh.length >= count) pool = fresh
  const used = new Map()
  for (const id of recent) used.set(id, (used.get(id) || 0) + 1)
  const ranked = pool
    .map((p) => ({ p, w: p.weight * lessonWeight(lessons, p.id) * Math.pow(0.75, used.get(p.id) || 0), tie: hash32(`${seed}:${p.id}`) }))
    // สุ่มแบบคงที่ตาม seed ภายในช่วงน้ำหนักใกล้กัน — ไม่ให้ร่างทุกชิ้นได้ 3 สูตรเดิมเรียงเดิม
    .map((r) => ({ ...r, key: r.w * (0.8 + 0.4 * ((r.tie % 1000) / 1000)) }))
    .sort((a, b) => b.key - a.key || a.tie - b.tie)
    .map((r) => r.p)
  // ต่างตระกูลกันก่อน (คำถาม / บอกเล่า / เรื่องเล่า / รายการ / เตือน / ข่าว) แล้วค่อยเติม
  const picked = []
  const families = new Set()
  for (const p of ranked) if (picked.length < count && !families.has(p.family)) { picked.push(p); families.add(p.family) }
  for (const p of ranked) if (picked.length < count && !picked.includes(p)) picked.push(p)
  return picked
}

// ── คำสั่งในพรอมต์ ───────────────────────────────────────────────────────────
export function hookPromptLines(patterns = [], { rules = [] } = {}) {
  if (!patterns.length) return []
  return [
    'Hook (สำคัญที่สุดของโพสต์ — คนตัดสินใจจากบรรทัดแรกและพาดหัวว่าจะหยุดอ่านหรือเลื่อนผ่าน):',
    `- เขียนประโยคเปิด ${patterns.length} แบบ แบบละสูตรตามนี้ แต่ละแบบมีพาดหัวคู่ (ไม่เกิน 26 ตัวอักษร) ที่เป็น hook ในตัว ไม่ใช่ป้ายชื่อเรื่อง:`,
    ...patterns.map((p, i) => `  ${i + 1}. ${p.name} (pattern "${p.id}"): ${p.how} · พาดหัว: ${p.headline} · ตัวอย่างโครง (คนละเรื่อง ห้ามลอก): "${p.example?.line || ''}" / "${p.example?.headline || ''}"`),
    '- เลือกแบบที่ดีที่สุดสำหรับเรื่องนี้ 1 แบบ ใช้เป็นบรรทัดแรกของแคปชั่นคำต่อคำ และใช้พาดหัวของแบบนั้นเป็น headline · บรรทัดที่สองต้องต่อจากบรรทัดแรกให้ลื่น (ส่งต่อความอยากรู้ ไม่ทวนซ้ำ)',
    '- กติกาของทุกแบบ:',
    ...rules.map((r) => `  · ${r}`),
  ]
}

// ── ตรวจและให้คะแนน ──────────────────────────────────────────────────────────
const BAIT_RE = /พิมพ์\s*(\d|เลข|คำว่า)|กด\s*(ไลก์|ไลค์|แชร์|ติดตาม|หัวใจ)|แชร์(ให้|เลย|ต่อ|เก็บ)|คอมเมนต์(ว่า|คำว่า|\s*\d)|เมนต์\s*\d|แท็ก(เพื่อน|คน)/
const HYPE_RE = /ช็อก|ช๊อก|อึ้ง|ตะลึง|ไม่ดูเสียใจ|ห้ามพลาด|ด่วนที่สุด|ความลับ|ไม่มีใครบอก|รู้แล้วจะ|เปิดโปง(?!กลโกง)|รวยเร็ว|รวย/
const PERSONAL_ATTR_RE = /คุณ(กำลัง|ยัง)?\s*(เป็นหนี้|ติดหนี้|มีหนี้|ถังแตก|ไม่มีเงิน|ขาดเงิน|เครดิตเสีย|ติดบูโร|ติดแบล็กลิสต์|ล้มละลาย|ถูกฟ้อง|โดนฟ้อง|กำลังจะเสียบ้าน)/
// ความเร่งแบบโปรโมชั่น — "วันสุดท้าย" ในเรื่องเล่า/สัญญา ("นัดไว้วันสุดท้ายพอดี" "วันสุดท้ายของการไถ่") เป็นข้อเท็จจริงของเรื่อง ไม่นับ
const URGENCY_RE = /(โปร|ราคานี้|สิทธิ์|สมัคร)[^\n]{0,10}วันสุดท้าย|วันสุดท้ายแล้ว|รีบ(ก่อน|เลย|ด่วน|ทัก)|จำนวนจำกัด|เหลือ(อีก)?\s*\d+\s*(ที่|สิทธิ์|ราย)|ด่วน(ๆ|มาก)/
const REAL_CASE_RE = /เคสจริง|ลูกค้า(ของ)?(เรา|ทางเรา)|เมื่อ(วาน|เช้า|สัปดาห์ก่อน|เดือนก่อน)|ล่าสุดทางเรา|ทีม(งาน)?เรา(เพิ่ง|เจอ)/
const BRAND_OPENER_RE = /^(assetx|แอสเซท|ทีมงาน|ทางเรา)/i

// เหตุที่ใช้ประโยคนี้ไม่ได้เลย (ไม่ใช่แค่คะแนนต่ำ) → ข้อความภาษาไทย หรือ ''
export function hookIssue(line = '', { maxLen = HOOK_MAX } = {}) {
  const t = String(line || '').trim()
  if (!t) return 'ว่าง'
  if (t.length > maxLen) return `ยาว ${t.length} ตัวอักษร เกิน ${maxLen} — Facebook ตัดเป็น "ดูเพิ่มเติม" ก่อนจบใจความ`
  const bait = t.match(BAIT_RE); if (bait) return `ขอยอด ("${bait[0]}") — Facebook ลดการมองเห็นโพสต์แบบนี้`
  const hype = t.match(HYPE_RE); if (hype) return `คำเร้าแบบคลิกเบต ("${hype[0]}")`
  // "ถ้าคุณมีหนี้บ้าน…" เป็นเงื่อนไข ไม่ใช่การระบุตัวคนอ่าน — ปัดเฉพาะแบบยืนยัน/ถามตรง ("คุณกำลังเป็นหนี้อยู่ใช่ไหม")
  const attr = t.match(PERSONAL_ATTR_RE); if (attr && !/(ถ้า|หาก)\s*$/.test(t.slice(0, attr.index))) return `ระบุสถานะการเงินของคนอ่านตรง ๆ ("${attr[0]}") — เล่าเป็นสถานการณ์แทน`
  const rush = t.match(URGENCY_RE); if (rush) return `ความเร่งปลอม ("${rush[0]}")`
  const real = t.match(REAL_CASE_RE); if (real) return `อ้างว่าเป็นเคสจริง/ลูกค้าของเรา ("${real[0]}") — เราไม่มีเคสที่เจ้าของอนุญาตให้เล่า`
  if (BRAND_OPENER_RE.test(t)) return 'เปิดด้วยชื่อแบรนด์/ทีมงาน'
  return ''
}

const TOPIC_RE = /ขายฝาก|จำนอง|ไถ่|สินไถ่|โฉนด|น\.ส\.\s?3|อ\.ช\.\s?2|ห้องชุด|คอนโด|ที่ดิน|บ้าน|ทาวน์โฮม|สัญญา|กรรมสิทธิ์|ดอกเบี้ย|ภาษี|ค่าธรรมเนียม|อากร|มรดก|ทายาท|ขายทอดตลาด|บังคับคดี|ประเมิน|วงเงิน|หนี้|รีไฟแนนซ์|ผังเมือง|เงินสด|แคชเชียร์เช็ค|ธปท|กรมที่ดิน|นายหน้า|ทรัพย์/
const CONCRETE_RE = /สัญญา|โฉนด|น\.ส\.\s?3|อ\.ช\.\s?2|หนังสือ|ใบเสร็จ|สำนักงานที่ดิน|วันครบกำหนด|ครบกำหนด|วันไถ่|สินไถ่|ราคาประเมิน|บัตรประชาชน|ทะเบียนบ้าน|มรณบัตร|พินัยกรรม|ภาระ|ค่าธรรมเนียม|อากร|ภาษี|แคชเชียร์เช็ค|เซ็น|วันโอน|เอกสาร|บรรทัด|ช่อง/
const ROLE_RE = /เจ้าของ(บ้าน|ห้อง|ที่ดิน|ทรัพย์|กิจการ|โฉนด)?|ผู้ขายฝาก|ผู้รับซื้อฝาก|ผู้จำนอง|ผู้รับจำนอง|นักลงทุน|ทายาท|ผู้กู้|ผู้ซื้อ|ผู้ขาย|คนที่|ใครที่|ใครจะ/
// คำถามไทยไม่ต้องมี ? ("ต้องเตรียมอะไร" "เริ่มตรงไหน" "ได้กี่ปี") — ทดลองจริง 9 พ.ย. 2569 พาดหัวคำถามถูกเตือนว่าเป็นป้ายชื่อเรื่องเพราะไม่มีคำเหล่านี้
const TENSION_RE = /[?？]|ไหม|มั้ย|หรือไม่|หรือเปล่า|ทำไม|อย่างไร|ยังไง|อะไร(?!ก็)|เท่าไร|เท่าไหร่|ตรงไหน|ที่ไหน|เมื่อไร|เมื่อไหร่|ได้กี่|กี่(ปี|เดือน|วัน|บาท)|ของใคร|ใครจ่าย|แต่|ทั้งที่|ไม่ใช่|ไม่ได้แปลว่า|เพราะ|ระวัง|สัญญาณ|พลาด|เสียสิทธิ|หลุด|ไม่ทัน|ต่างกัน|เข้าใจผิด|หยุด/
const RELEVANCE_RE = /คุณ|ถ้า|หาก|ใคร|คนที่/
// สิ่งที่คนอ่านอาจเสียจริง (ไม่ใช่คำขู่ — คำขู่ติด HYPE_RE/hookIssue ไปแล้ว)
const STAKE_RE = /เสีย(สิทธิ|บ้าน|ที่ดิน|ทรัพย์|เงิน)|ไถ่ไม่ทัน|ถูกยึด|โดนยึด|ขายทอดตลาด|ถูกฟ้อง|หลุดมือ|ส่วนต่าง|จ่ายเกิน|จ่ายมากกว่า/
// ประโยคเปิดที่ร่างก่อน ๆ ใช้จนชิน (สำรวจ 9 พ.ย. 2569) — ยังใช้ได้ แต่หักคะแนน
const STALE_OPENERS = [/^ถ้าคุณกำลัง/, /^(คุณ)?กำลัง(จะ|พิจารณา)/, /^เคสสมมุติ\s*[:：]/, /^ถาม\s*[:：]/, /^ธนาคารแห่งประเทศไทย/, /^นี่คือ/, /^(ขายฝาก|จำนอง)คือ/, /^หาก(คุณ)?กำลัง/]
const STOP = new Set(['ที่', 'และ', 'หรือ', 'แต่', 'ก็', 'ได้', 'ไม่', 'ให้', 'กับ', 'ของ', 'ใน', 'จะ', 'ต้อง', 'มี', 'เป็น', 'คือ', 'ว่า', 'แล้ว', 'ยัง', 'อยู่', 'ไป', 'มา', 'นี้', 'นั้น', 'ถ้า', 'หาก', 'คุณ', 'เรา', 'เขา', 'อะไร', 'ไหม', 'ทำไม', 'อย่างไร', 'ยังไง', 'ก่อน', 'หลัง', 'เพราะ', 'จาก', 'ถึง', 'ทุก', 'แค่', 'กัน', 'ด้วย', 'โดย', 'เพื่อ', 'ทั้ง', 'เมื่อ', 'จริง', 'ครั้ง', 'ควร', 'ช่วง', 'ตอน', 'นี่', 'แบบ', 'เรื่อง', 'อีก', 'ซึ่ง', 'ถูก', 'โดน', 'ทำ', 'ดู', 'รู้', 'เลย', 'บ้าง', 'กว่า', 'มาก', 'น้อย', 'คน', 'ใคร', 'ตรง', 'ไหน', 'เท่า', 'เท่าไร', 'เท่าไหร่', 'หรือไม่', 'หรือเปล่า'])
const thaiWords = new Intl.Segmenter('th', { granularity: 'word' })
export function contentWords(text = '') {
  const out = []
  for (const seg of thaiWords.segment(String(text || ''))) {
    const w = seg.segment.trim()
    if (!seg.isWordLike || w.length < 2 || STOP.has(w)) continue
    if (!out.includes(w)) out.push(w)
  }
  return out
}

// คะแนน 0–100 (กำหนดได้ ไม่ใช้ AI) + เหตุผลสั้น ๆ ภาษาไทยไว้โชว์บนเว็บ · body = แคปชั่นหลังบรรทัดแรก (เช็กว่าเนื้อหาจ่ายสิ่งที่ประโยคเปิดสัญญา)
// recent = ประโยคเปิดของร่างอื่นที่มีแล้ว (ซ้ำ = หักคะแนน)
export function scoreHook(line = '', { body = '', recent = [] } = {}) {
  const t = String(line || '').replace(/\s+/g, ' ').trim()
  const good = []
  const bad = []
  let score = 10
  if (t.length <= HOOK_IDEAL) { score += 15; good.push('สั้น อ่านจบก่อน "ดูเพิ่มเติม"') } else { score += 6; bad.push(`ยาว ${t.length} ตัวอักษร (เป้า ≤ ${HOOK_IDEAL})`) }
  if (TOPIC_RE.test(t.slice(0, 40))) { score += 15; good.push('คำสำคัญอยู่ต้นประโยค') } else bad.push('คำสำคัญของเรื่องมาช้า')
  if (/\d/.test(t) || CONCRETE_RE.test(t)) { score += 15; good.push('เจาะจง (เอกสาร/ขั้นตอน/ตัวเลข)') } else bad.push('ยังกว้าง ไม่มีเอกสาร ขั้นตอน หรือตัวเลข')
  if (ROLE_RE.test(t)) score += 5
  // เหตุให้อ่านต่อ = คำถาม/ความขัดแย้ง หรือ "สัญญาประโยชน์ที่จับต้องได้" (ตัวเลข + เอกสาร · ก่อนเซ็น/ก่อนโอน) แบบสูตรเช็กลิสต์
  const promise = (/\d/.test(t) && CONCRETE_RE.test(t)) || /ก่อน(เซ็น|โอน|ไถ่|จด|ครบ|วัน|ตกลง)/.test(t)
  if (TENSION_RE.test(t) || promise) { score += 20; good.push(TENSION_RE.test(t) ? 'มีคำถาม/ความขัดแย้งให้อยากรู้ต่อ' : 'สัญญาประโยชน์ที่จับต้องได้') } else bad.push('เป็นประโยคบอกเล่า ไม่มีคำถาม ความขัดแย้ง หรือประโยชน์ที่จับต้องได้')
  // หลักฐานเรื่อง "คุณ/พูดกับคนอ่าน" อ่อนและขัดกัน (Gligorić 2023 ไม่ผ่านเกณฑ์ · Banerjee 2021 ไม่พูดตรงกลับดีกว่า) → ให้แค่ 5 · สิ่งที่อาจเสียจริงมีหลักฐานดีกว่า (Robertson 2023: คำเชิงลบ +2.3%/คำ)
  if (RELEVANCE_RE.test(t) || ROLE_RE.test(t)) { score += 5; good.push('ชี้ตัวคนอ่าน/บทบาทชัด') }
  if (STAKE_RE.test(t)) { score += 5; good.push('บอกสิ่งที่อาจเสียจริง') }
  const words = contentWords(t)
  const bodyText = String(body || '')
  if (words.length >= 2 && bodyText) {
    const covered = words.filter((w) => bodyText.includes(w)).length / words.length
    if (covered >= 0.6) { score += 15; good.push('เนื้อหาตอบสิ่งที่ประโยคเปิดสัญญา') } else if (covered < 0.35) { score -= 20; bad.push('เนื้อหาไม่ได้ตอบสิ่งที่ประโยคเปิดสัญญา (เสี่ยงเป็นคลิกเบต)') } else score += 5
  }
  if (STALE_OPENERS.some((re) => re.test(t))) { score -= 15; bad.push('เปิดด้วยแม่แบบเดิมที่ร่างก่อน ๆ ใช้บ่อย') }
  if (recent.some((r) => r && similarity(r, t) >= 0.5)) { score -= 15; bad.push('คล้ายประโยคเปิดของร่างอื่น') }
  return { score: Math.max(0, Math.min(100, score)), good, bad }
}

// พาดหัวที่เป็นแค่ป้ายชื่อเรื่อง (ไม่มีคำถาม ความขัดแย้ง ตัวเลข หรือคำเตือน) — เตือนให้คนตรวจ ไม่ปัดตก
export function headlineIsLabel(headline = '') {
  const t = String(headline || '').trim()
  if (!t) return false
  return !(TENSION_RE.test(t) || /\d/.test(t) || DETECTORS['scam-signal'](t) || DETECTORS.misconception(t) || DETECTORS.timeline(t))
}

const norm = (s) => String(s || '').replace(/[\s"“”'‘’]/g, '')
export function firstCaptionLine(caption = '') {
  return String(caption || '').split('\n').map((l) => l.trim()).find(Boolean) || ''
}
// แคปชั่นหลังบรรทัดแรก
export function captionBody(caption = '') {
  const lines = String(caption || '').split('\n')
  const at = lines.findIndex((l) => l.trim())
  return at < 0 ? '' : lines.slice(at + 1).join('\n')
}
export function sameHookLine(a = '', b = '') {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  return x === y || (Math.min(x.length, y.length) >= 20 && (x.startsWith(y) || y.startsWith(x))) || similarity(a, b) >= 0.7
}

// ล้างคำตอบ hooks ของผู้เขียน → [{ pattern, name, line, headline, score, good, bad, used }] เรียงตามที่ผู้เขียนให้ · ตัวที่ผิดกติกาทิ้ง (dropped)
// clean = ตัวล้างของ drafts.js (ลบข้อมูลบุคคล วันที่ไทย) · check = ด่านของ drafts.js (คำต้องห้าม สัญญาผลลัพธ์ ชื่อเพจต้นทาง ฯลฯ) คืนข้อความเหตุผลหรือ ''
// ประโยคแรกของแคปชั่นไม่ตรงกับแบบไหนเลย = ผู้เขียนแต่งเอง → ต่อท้ายเป็นแบบ "จากแคปชั่น" และนับเป็นตัวที่ใช้อยู่
export function parseHooks(raw, { caption = '', headline = '', clean = (s) => s, check = () => '', recent = [], library = null } = {}) {
  const lib = library || loadHookPatterns()
  const ids = lib.patterns.map((p) => p.id)
  const nameOf = (id) => lib.patterns.find((p) => p.id === id)?.name || (id === 'other' ? 'แต่งเอง' : id)
  const body = captionBody(caption)
  const first = firstCaptionLine(caption)
  // ลบเลขข้อ/ขีดนำหน้าที่ผู้เขียนใส่มาเหมือนรายการ ("1. …") — แต่ตัวเลขที่เป็นเนื้อ hook ("3 บรรทัดก่อนเซ็น") ต้องอยู่
  const tidy = (s) => clean(String(s ?? '')).replace(/\\n/g, ' ').replace(/!+/g, '').replace(/\s+/g, ' ').trim().replace(/^(\d{1,2}[.)]|[-•])\s+/, '').trim()
  const tidyLine = (s) => { const t = tidy(s); return /^["“].*["”]/.test(t) ? t : t.replace(/^["“”]+|["“”]+$/g, '').trim() }
  const hooks = []
  const dropped = []
  for (const item of (Array.isArray(raw) ? raw : []).slice(0, 5)) {
    const obj = item && typeof item === 'object' ? item : { line: item }
    const line = tidyLine(obj.line ?? obj.text ?? obj.hook ?? '')
    const head = tidy(obj.headline ?? '').replace(/["“”]/g, '').slice(0, 40)
    if (!line || hooks.some((h) => sameHookLine(h.line, line))) continue
    const issue = hookIssue(line) || check(line) || (head ? check(head) : '')
    const pattern = ids.includes(obj.pattern) ? obj.pattern : primaryPattern(line, ids)
    if (issue) { dropped.push({ pattern, line, issue }); continue }
    const s = scoreHook(line, { body, recent })
    hooks.push({ pattern, name: nameOf(pattern), line, headline: head, score: s.score, good: s.good, bad: s.bad, used: false })
  }
  let used = hooks.findIndex((h) => sameHookLine(h.line, first))
  if (used < 0 && first) {
    const s = scoreHook(first, { body, recent })
    const pattern = primaryPattern(first, ids)
    hooks.push({ pattern, name: nameOf(pattern), line: first, headline: String(headline || ''), score: s.score, good: s.good, bad: s.bad, used: false, from: 'caption' })
    used = hooks.length - 1
  }
  if (used >= 0) {
    hooks[used].used = true
    // ประโยคเปิดที่ใช้จริงคือบรรทัดแรกของแคปชั่น (อาจต่างจากแบบที่ส่งมาเล็กน้อย) · พาดหัวที่ใช้จริงคือ headline ของร่าง
    hooks[used].line = first
    if (headline) hooks[used].headline = String(headline)
  }
  return { hooks, used, dropped }
}

// ใส่ประโยคเปิดใหม่แทนบรรทัดแรกของแคปชั่น — ตัวเดียวกับปุ่ม "ใช้ประโยคนี้" บนเว็บ (src/lib/hookOptions.js)
export { swapOpeningLine } from '../../src/lib/hookOptions.js'

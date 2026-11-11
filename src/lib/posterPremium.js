// src/lib/posterPremium.js — โปสเตอร์โหมด "พรีเมียม" (อินโฟกราฟิกภาพจริงแนวบรรณาธิการ) ตามสกิล assetx-estate-visuals ที่เจ้าของสร้างกับ Codex
//
// เจ้าของ 9 พ.ย. 2569: สั่ง Codex เจนภาพด้วยสกิลที่สร้างไว้แล้ว "ผลลัพธ์ที่ได้ค่อนข้างโอเคมาก ผมอยากให้ระบบของเราสามารถทำได้แบบนี้ … เป็นอีกสไตล์"
// วิธีของ Codex ที่ให้ผลดี (ภาพต้นแบบ 3 ภาพอยู่ใน .local/poster-refs/premium/ นอก git):
//   1) อ่านโพสต์แล้วเขียนบรีฟ 6 ส่วน (กลุ่มเป้าหมาย · วัตถุประสงค์ · จิตวิทยาการมองเห็น · สารหลัก · อารมณ์ · CTA)
//   2) ย่อเนื้อหาเป็นข้อความบนภาพสั้น ๆ มีลำดับชัด สารหลักเดียว
//   3) สั่งภาพด้วยพรอมต์ที่มีบรีฟ + อาร์ตไดเรกชัน + ข้อความคำต่อคำ + สีเน้นคำ (ฟ้าเข้ม/ม่วง/คอรัลเข้ม) + แนบภาพที่เจ้าของชอบเป็นเรฟสไตล์
// ในระบบเรา: หน้าเว็บส่ง "คำขอ" (buildPremiumJobPrompt) → ตัวรับงานให้ AI วางแผนข้อความ (server/poster-premium-plan.js · ตรวจก่อนใช้)
//   → buildPremiumImagePrompt ประกอบคำสั่งภาพแบบเดียวกับพรอมต์ของ Codex → เจนสัดส่วนที่กว้างกว่าโพสต์ (จัตุรัสสำหรับ 4:5)
//   → ต่อแถบท้ายแบรนด์ใต้ภาพ (โลโก้จริง + เบอร์/LINE) ให้ได้สัดส่วนโพสต์พอดี — ดู premiumFrame
// ต่างจากภาพในแชต Codex: โลโก้ไม่ให้โมเดลวาด (กติกาเดิมของเจ้าของ) — อยู่ในแถบท้ายที่ตัวรับงานวางเอง
// เจ้าของ 10 พ.ย. 2569: "เอารูปผมไปใส่ในโปสเตอร์แทน" + เอาป้าย "ภาพประกอบ" ออกจากภาพ
//   → ภาพหลักมีเจ้าของ (รูปใน .local/poster-refs/presenter/) เป็นผู้แนะนำของ AssetX ทุกภาพ · ไม่มีป้ายกำกับบนภาพถ่าย
import { DEFAULT_POSTER_SIZE, POSTER_SIZES } from './posterSizes.js'
import { FOOTER_RATIO } from './posterFree.js'

export const PREMIUM_REQUEST_HEADER = 'PREMIUM POSTER REQUEST'
// สีจากสกิล (premium-art-direction.md) — ข้อความหลักน้ำเงินเข้ม · เน้นได้ราว 10–20% ของตัวอักษร
export const PREMIUM_COLORS = { navy: '#092B43', teal: '#087F93', violet: '#654697', coral: '#B74434' }
export const PREMIUM_HIGHLIGHT_COLORS = ['violet', 'coral']
// บรรทัดที่สองของ CTA (ตามภาพต้นแบบ) · เบอร์/LINE จริงอยู่ในแถบท้ายใต้ CTA
export const PREMIUM_CTA_SUB = 'ทางแชต AssetX Estate'
// ข้อความกำกับ: ระบบใส่เอง ไม่ให้ AI แต่ง (มาจากภาพต้นแบบที่เจ้าของชอบ)
export const PREMIUM_DISCLAIMER = ['ความรู้ทั่วไป ไม่ใช่ข้อเสนอวงเงินหรือคำรับประกัน', 'ค่าใช้จ่ายและเงื่อนไขขึ้นอยู่กับเอกสารและข้อเท็จจริงแต่ละกรณี']
export const HYPOTHETICAL_NOTE = 'เคสสมมุติ ไม่ใช่ลูกค้าจริง ผลลัพธ์ต่างกันทุกกรณี'
const HYPOTHETICAL_RE = /(?:เคส|กรณี)สมม[ุ]?ติ/
// ภาพโฉนด (สกิล realistic-deeds.md 11 พ.ย. 2569): ต้องมีคำว่า "ตัวอย่าง" บนเอกสาร + ข้อความกำกับใกล้เอกสาร — ข้อความเดียวกับภาพที่เจ้าของยืนยัน
export const DEED_STAMP = 'ตัวอย่าง'
export const DEED_NOTE = 'ภาพประกอบเอกสารตัวอย่าง ไม่ใช่เอกสารทรัพย์จริง'

const q = (s) => `“${String(s || '').trim()}”`

// ---------------------------------------------------------------- คำขอที่หน้าเว็บส่งเข้าคิว (เก็บในคอลัมน์ prompt ของงาน)

export function buildPremiumJobPrompt({ title = '', caption = '', size = DEFAULT_POSTER_SIZE, seed = null } = {}) {
  const key = POSTER_SIZES[size] ? size : DEFAULT_POSTER_SIZE
  return [
    `${PREMIUM_REQUEST_HEADER}: the office image worker plans the poster copy with AI first, then renders it (src/lib/posterPremium.js). This is not an image prompt.`,
    `MODE: premium seed=${seed === null || seed === undefined ? 'none' : seed} size=${key}`,
    `TITLE: ${String(title || '').replace(/\s+/g, ' ').trim()}`,
    'POST:',
    String(caption || '').trim(),
  ].join('\n')
}

export function parsePremiumRequest(prompt = '') {
  const text = String(prompt || '')
  if (!text.startsWith(PREMIUM_REQUEST_HEADER)) return null
  const mode = text.match(/^MODE:\s*premium\b(.*)$/m)
  if (!mode) return null
  const seed = (mode[1].match(/seed=(\d+)/) || [])[1]
  const size = (mode[1].match(/size=([\w-]+)/) || [])[1]
  const title = (text.match(/^TITLE:[ \t]*(.*)$/m) || [])[1] || ''
  const at = text.search(/^POST:\s*$/m)
  const caption = at >= 0 ? text.slice(at).replace(/^POST:\s*\n?/, '').trim() : ''
  return { seed: seed ? Number(seed) : null, size: POSTER_SIZES[size] ? size : DEFAULT_POSTER_SIZE, title: title.trim(), caption }
}

// ---------------------------------------------------------------- แผนโปสเตอร์ (ตรวจแล้วจาก server/poster-premium-plan.js)
// plan = { brief: { audience, goal, visual, emotion, hero } (อังกฤษ · คำสั่ง ไม่พิมพ์บนภาพ), keyMessage, eyebrow, headlineSmall,
//          headline: [1–2 บรรทัด], headlineAccent, subheading, middle: { type: flow|equation|none, title, items, note },
//          points: [{ title, body }], highlights: [{ text, color }], cta }

export function disclaimerLines({ title = '', caption = '' } = {}) {
  return HYPOTHETICAL_RE.test(`${title}\n${caption}`) ? [HYPOTHETICAL_NOTE, ...PREMIUM_DISCLAIMER] : [...PREMIUM_DISCLAIMER]
}

export function ctaLines(cta = '') {
  const main = String(cta || '').trim()
  return /AssetX Estate/.test(main) ? [main] : [main, PREMIUM_CTA_SUB].filter(Boolean)
}

// ทุกสตริงไทยที่ AI เขียนและจะพิมพ์บนภาพ (ใช้ตรวจ ไม่รวมข้อความที่ระบบใส่เอง)
export function premiumCopyStrings(plan = {}) {
  return [
    plan.eyebrow, plan.headlineSmall, ...(plan.headline || []), plan.subheading,
    plan.middle?.title, ...(plan.middle?.items || []), plan.middle?.note,
    plan.callout?.title, plan.callout?.body,
    ...(plan.points || []).flatMap((p) => [p.title, p.body]), plan.cta,
  ].map((s) => String(s || '').trim()).filter(Boolean)
}

export function premiumRefIndex(seed, count) {
  if (!count) return -1
  const n = Number(seed)
  return Number.isFinite(n) ? Math.abs(Math.trunc(n)) % count : 0
}

// เรฟสไตล์ตามโทนที่ AI เลือก: ไฟล์ที่ชื่อมี "dark" = ต้นแบบพื้นน้ำเงินเข้ม (โฉนดหน้า-หลัง ที่เจ้าของยืนยัน 11 พ.ย. 2569) · ที่เหลือ = พื้นสว่าง
// ไม่มีไฟล์ของโทนนั้น → ใช้ทั้งหมด · หมุนตาม seed
export function pickPremiumStyleRef(files = [], { seed = null, theme = 'light' } = {}) {
  const isDark = (f) => /dark/i.test(String(f).split(/[\\/]/).pop())
  const own = files.filter((f) => (theme === 'dark' ? isDark(f) : !isDark(f)))
  const list = own.length ? own : files
  return list.length ? list[premiumRefIndex(seed, list.length)] : null
}

// กรอบงานของโหมดพรีเมียม: สั่งภาพสัดส่วนมาตรฐานที่ "เตี้ยกว่าโพสต์" แล้วต่อแถบท้ายแบรนด์ใต้ภาพ (ไม่วางทับ ไม่ตัดเนื้อหา)
// ทดสอบจริง 9 พ.ย. 2569 — Codex ไม่ทำตามคำสั่งเว้นพื้นที่ทุกแบบ:
//   งาน 22: สั่งเว้นแถบล่างเป็นพิกเซล → วาดแถบ CTA ชิดขอบล่าง แถบท้ายที่วางทับบัง CTA หมด (และประวัติงาน 8–22 แถบดำหนา 0–205 px ไม่แน่นอน)
//   งาน 23: เจนจัตุรัสแล้วสั่งเว้นขอบข้าง → วาดเต็มขอบ ตัดข้างให้ได้สัดส่วนแล้วตัวหนังสือริมขาด
//   งาน 24: สั่ง 1104x1200 (0.92) ได้ 1159x1358 (6:7) — เครื่องมือภาพให้สัดส่วนมาตรฐานชุดหนึ่ง (2:3 · 1:1 · 6:7 · 4:5 ราว 1.57 ล้านพิกเซล)
// → ปลั๊กอิน gpt-image aspect 'auto' (ไม่บังคับ 2:3/1:1) + สั่งสัดส่วนมาตรฐานที่ใกล้ "โพสต์ลบแถบท้าย" ที่สุด
//   ตัวรับงานไม่ครอป · poster-footer.ps1 -Append -Ratio ต่อแถบน้ำเงิน (โลโก้จริง + เบอร์/LINE) ใต้แถบ CTA ของ Codex
//   ความสูงแถบ = กว้าง/สัดส่วนโพสต์ − สูงของภาพ (ได้สัดส่วนพอดีแม้โมเดลให้ขนาดอื่น) · แถบเตี้ย = บล็อกติดต่อแถวเดียว · ภาพยาวเกิน = เติมขอบข้าง
//   งาน 25: สั่ง 6:7 ได้ 1095x1437 (ยาวกว่าที่สั่งอีก) → ต้องเติมขอบข้าง เห็นรอยยืดที่ภาพถ่าย
//   → ขนาดหลักใช้สัดส่วนที่ปลั๊กอินบังคับได้แน่นอน (square/portrait: ภาพ "กว้างกว่า" ที่ต้องการเสมอ แถบท้ายแค่สูงขึ้น ไม่ต้องเติมขอบ/ตัด)
//     ฟีด 4:5 = จัตุรัส + แถบท้าย 20% · Story = 2:3 + แถบ 16% · จัตุรัส/ภาพลิงก์/YouTube ไม่มีสัดส่วนบังคับที่พอดี จึงขอขนาดเอา (aspect auto)
const PREMIUM_CANVAS = {
  'feed-4x5': { aspect: 'square', width: 1024, height: 1024, label: 'square 1:1' },
  'square-1x1': { aspect: 'auto', width: 1344, height: 1152, label: 'landscape 7:6' },
  'story-9x16': { aspect: 'portrait', width: 1024, height: 1536, label: 'portrait 2:3' },
  'link-191x1': { aspect: 'auto', width: 1568, height: 672, label: 'landscape 7:3' },
  'youtube-16x9': { aspect: 'auto', width: 1536, height: 768, label: 'landscape 2:1' },
}

// ความสูงแถบที่ต่อใต้ภาพ — สูตรเดียวกับ poster-footer.ps1 -Append -Ratio (ไม่รวมกรณีเติมขอบข้าง)
export function appendedFooterHeight(width, height, ratio) {
  const standard = Math.round(Math.min(width * FOOTER_RATIO.width, (height * FOOTER_RATIO.height) / (1 - FOOTER_RATIO.height)))
  return Math.max(Math.round(width / ratio) - height, Math.ceil(standard * 0.46))
}

// เจ้าของ 11 พ.ย. 2569 (งาน 41): "ด้านล่างของภาพไม่กลืนกับภาพ เป็นช่องแบ่งแยก และกินพื้นที่ด้านล่างเยอะเกินไป"
// → แถบท้ายกลืนกับภาพ (poster-footer.ps1 -Blend: สีพื้นตามขอบล่างของภาพ ขอบล่างจางลงในแถบ ไม่มีเส้นคั่น)
//   ฟีด/จัตุรัส: แถบบาง 11% ของกว้าง สัดส่วนโพสต์ไม่ล็อก (ฟีด Facebook/IG รับ 4:5 ถึง 1.91:1 · ฟีด 4:5 ได้ราว 9:10) — ส่วนที่เป็นภาพเท่าเดิม แค่แถบบางลงครึ่งหนึ่ง
//   Story/ภาพลิงก์/YouTube ยังล็อกสัดส่วน (เต็มจอ/ภาพปกต้องพอดี) แถบสูงตามที่ต้องเติม แต่กลืนสีเหมือนกัน
export const SLIM_FOOTER_RATIO = 0.11
const FLEXIBLE_SIZES = new Set(['feed-4x5', 'square-1x1'])

export function premiumFrame(size = DEFAULT_POSTER_SIZE) {
  const key = POSTER_SIZES[size] ? size : DEFAULT_POSTER_SIZE
  const target = POSTER_SIZES[key]
  const canvas = PREMIUM_CANVAS[key] || PREMIUM_CANVAS[DEFAULT_POSTER_SIZE]
  const t = target.width / target.height
  const exact = !FLEXIBLE_SIZES.has(key)
  const band = exact ? appendedFooterHeight(canvas.width, canvas.height, t) : Math.round(canvas.width * SLIM_FOOTER_RATIO)
  return {
    ...canvas,
    exact,
    targetRatio: Number(t.toFixed(4)),
    footerPct: Math.round((band / (canvas.height + band)) * 100),
    targetWidth: target.width,
    targetHeight: target.height,
    platform: target.platform,
  }
}

// ส่วนของแถบท้ายในคำสั่งภาพ: ล็อกสัดส่วน = บอกขนาดโพสต์สุดท้าย · ไม่ล็อก = แถบบาง
function footerShare(f) {
  return f.exact
    ? `it becomes the bottom ${f.footerPct}% of the final ${f.targetWidth}x${f.targetHeight} post`
    : `a slim strip, about ${f.footerPct}% of the final post height`
}

export function premiumFrameLine(frame) {
  const f = frame
  const margin = Math.round(Math.min(f.width, f.height) * 0.055)
  return `Canvas (fixed, keep it word for word in your image_gen prompt): render the image at ${f.width}x${f.height} px (${f.label}). The whole canvas is the design, full bleed, with no border, frame or bars; keep every text at least ${margin} px from every edge.`
}

// ---------------------------------------------------------------- โครงภาพหมุนเวียน
// เจ้าของ 11 พ.ย. 2569 (#37): ภาพพรีเมียมออกมาโครงเดียวกันทุกครั้ง (ภาพหลักด้านบน · พื้นขาว · ข้อ 01-03 เรียงลง) เหมือนโพสต์ #32 ที่เพิ่งลง
// "อยากให้ปรับรูปแบบให้แตกต่างจากเดิมนิดนึงเพื่อไม่ให้รูปแบบดูซ้ำและน่าเบื่อ" → 5 โครง หน้าตา/สี/ตัวอักษร/แถบชวนทักแบบเดิม ต่างกันที่การจัดวาง
// ตัวรับงานเลือกด้วย seed และเลี่ยงโครงที่ใช้ไปในงานพรีเมียม 2 งานล่าสุด (pickPremiumLayout) · ทุกโครงจบด้วยแถบ CTA สีน้ำเงินชิดขอบล่าง (ต่อแถบท้ายใต้แถบนี้)
const LIGHT_TEXT = { base: 'warm white #FFF8EE', accent: 'light cyan #7FD8E8' }
const NAVY_TEXT = { base: `navy ${PREMIUM_COLORS.navy}`, accent: `deep teal ${PREMIUM_COLORS.teal}` }

export const PREMIUM_LAYOUTS = [
  {
    id: 'classic',
    label: 'ภาพหลักด้านบน · ข้อ 01-03 เรียงลง',
    summary: 'headline top left, photo hero across the top third, warm-white area below with points 01-03 listed vertically, navy CTA band across the bottom',
    heroPlace: 'The top 35-40% of the design area is the photographic hero',
    headlinePos: 'upper left',
    headlineText: NAVY_TEXT,
    afterHeadline: 'the photographic hero',
    flowPoints: (n) => `the ${n} numbered points`,
    info: 'Below the hero a warm-white information area with thin dividers and a few small thin line icons.',
    points: (n, nums) => `${n} numbered points, vertically arranged with elegant ${nums} numbers (alternating teal and violet) and small restrained line icons:`,
  },
  {
    id: 'split',
    label: 'แบ่งซ้าย-ขวา · ข้อความซ้าย ภาพสูงด้านขวา',
    summary: 'vertical split: text column with a checklist on the left, one tall photo on the right, navy CTA band across the bottom',
    heroPlace: 'The right 52-56% of the design area, from the top edge down to the CTA band, is one tall photographic panel',
    headlinePos: 'at the top of the left text column',
    headlineText: NAVY_TEXT,
    afterHeadline: 'the checklist beside the tall photo',
    flowPoints: null,
    info: 'LAYOUT: a vertical split, not a hero strip across the top. The left 44-48% is a warm-white text column with generous margins: eyebrow, headline and subheading at the top, then the points as a clean checklist; a thin vertical teal rule separates the column from the tall photo on the right.',
    points: (n) => `${n} points as a vertical checklist in the left column, each with a small teal circle check mark instead of big numbers, title SemiBold and body regular:`,
  },
  {
    id: 'cards',
    label: 'พาดหัวกลาง · แถบภาพกลาง · การ์ดเรียงแถว',
    summary: 'centred headline, a wide photo band across the middle, equal numbered cards in a row below, navy CTA band across the bottom',
    heroPlace: 'A wide photographic band across the middle of the design area (about 28-32% of its height, full width)',
    headlinePos: 'centred at the top on warm white, the eyebrow above it and the subheading below it',
    headlineText: NAVY_TEXT,
    afterHeadline: 'the photo band',
    flowPoints: (n) => `the ${n} cards`,
    info: 'LAYOUT: centred and symmetrical, not a hero strip at the very top. Warm-white background above and below the photo band; below the photo the points are equal rounded cards (soft tint, thin border, one small thin line icon each) side by side in one row, or a 2 by 2 grid when there are 4.',
    points: (n, nums) => `${n} points as equal cards, each card topped by a large number (${nums}, alternating teal and violet), then the title and the body:`,
  },
  {
    id: 'overlay',
    label: 'ภาพเต็มใบโทนเข้ม · แผงกระจกฝ้า',
    summary: 'dark full-bleed photo, headline on a navy gradient at the left, points on a frosted-glass panel, navy CTA band across the bottom',
    dark: true,
    heroPlace: 'One full-bleed photograph fills the whole design area behind all the text',
    headlinePos: 'on the left side of the upper half, over a deep navy gradient that darkens the left 55% of the photo',
    headlineText: LIGHT_TEXT,
    afterHeadline: 'the advisor in the photo',
    flowPoints: (n) => `the ${n} points on the glass panel`,
    info: 'LAYOUT: a dark luxurious full-photo poster, not a warm-white information area. The photograph stays clear on the right; the left is a deep navy gradient (#061C2E fading to transparent); the points sit on one translucent dark-navy frosted-glass panel with a thin light border in the lower half.',
    points: (n, nums) => `${n} points on the frosted-glass panel in warm white, each with a slim light-cyan number (${nums}) and a hairline divider between them:`,
  },
  {
    id: 'steps',
    label: 'ภาพหลักมีพาดหัวทับ · ขั้นตอนเรียงแนวนอน',
    summary: 'headline over the lower left of a top photo hero, numbered steps joined by a line from left to right below, navy CTA band across the bottom',
    noMiddle: true,
    heroPlace: 'The top 40-45% of the design area is the photographic hero',
    headlinePos: 'on the lower left of the hero photo, over a soft dark navy gradient along the bottom of the photo',
    headlineText: LIGHT_TEXT,
    afterHeadline: 'the photo behind it',
    flowPoints: (n) => `the ${n} steps from left to right`,
    info: 'LAYOUT: below the hero a warm-white area where the points form one horizontal step path: numbered circles joined by a single thin teal line from left to right, the title and body centred under each circle (no vertical list).',
    points: (n, nums) => `${n} points as steps on that path, numbered circles (${nums}) with a teal outline and navy number:`,
  },
]
const LAYOUT_BY_ID = Object.fromEntries(PREMIUM_LAYOUTS.map((l) => [l.id, l]))
// สกิล assetx-estate-visuals ฉบับ 11 พ.ย. 2569 (composition-freedom.md): เลือกโครงจากเนื้อหา ไม่ใช่รอบหมุนตายตัว
// → AI วางแผน (server/poster-premium-plan.js) เขียน composition เอง = โครง 'content' · 5 โครงด้านบนเหลือเป็นทางสำรองเมื่อแผนไม่มี composition
export const CONTENT_LAYOUT = { id: 'content', label: 'จัดวางตามเนื้อหา (AI เลือกเอง)' }

export function premiumLayout(id) {
  if (id === CONTENT_LAYOUT.id) return CONTENT_LAYOUT
  return LAYOUT_BY_ID[id] || LAYOUT_BY_ID.classic
}

// สรุปงานพรีเมียมล่าสุดหนึ่งงาน (ไฟล์ .local/image-jobs/job-<id>-premium.json) เป็นภาษาอังกฤษสั้น ๆ ให้ AI วางแผนเลี่ยงโครงซ้ำ
// ("Variation from Recent Work" ในสกิล) · ไม่มีข้อความโพสต์ (เนื้อหาไทยอยู่ในไฟล์ แต่ไม่ส่งต่อ)
export function premiumRecentNote(entry = {}) {
  const plan = entry.plan || {}
  const who = entry.presenter ? 'advisor photo' : 'no person'
  if (entry.layout === CONTENT_LAYOUT.id && plan.composition) {
    const text = String(plan.composition).replace(/\s+/g, ' ').trim()
    return `${plan.theme === 'dark' ? 'dark' : 'light'} · ${who}${plan.deed ? ' · title deed' : ''} · ${text.length > 260 ? `${text.slice(0, 257)}...` : text}`
  }
  const L = premiumLayout(entry.layout || 'classic')
  return `${L.dark ? 'dark' : 'light'} · ${who} · ${L.summary}`
}

// recent = โครงของงานพรีเมียมล่าสุด (ใหม่สุดก่อน) · มีแถบกระบวนการกลางภาพ (middle) แล้วไม่ใช้โครง steps (แถบแนวนอนซ้อนกัน 2 แถบ)
export function pickPremiumLayout(seed, { recent = [], hasMiddle = false } = {}) {
  const pool = PREMIUM_LAYOUTS.filter((l) => !(hasMiddle && l.noMiddle))
  const fresh = pool.filter((l) => !recent.includes(l.id))
  const list = fresh.length ? fresh : pool
  const n = Number(seed)
  return list[seed !== null && seed !== undefined && Number.isFinite(n) ? Math.abs(Math.trunc(n)) % list.length : 0]
}

export function premiumHasMiddle(plan = {}) {
  return middleLines(plan.middle || {}).length > 0
}

function middleLines(middle = {}) {
  const items = (middle.items || []).filter(Boolean)
  if (middle.type === 'none' || items.length < 2) return []
  const joiner = middle.type === 'equation' && items.length === 3
    ? 'Use a minus sign between the first two blocks and an equals sign before the last block; the wording of each block matters, keep it exact.'
    : 'Join them with thin arrows in reading order.'
  return [
    middle.title ? `Middle process heading: ${q(middle.title)}` : '',
    `${items.length} connected clean blocks in one row, each a soft-tinted rounded panel with a small thin line icon: ${items.map(q).join(' · ')}`,
    joiner,
    middle.note ? `Small clarification under the blocks: ${q(middle.note)}` : '',
  ].filter(Boolean)
}

// presenter = ตัวรับงานแนบรูปเจ้าของเป็นภาพที่ 1 (เรฟสไตล์เป็นภาพถัดไป) · ไม่มีไฟล์รูป → ภาพหลักไม่มีใบหน้าคนเลย (ไม่ให้วาดคนแปลกหน้าแทนเจ้าของ)
function heroLines({ presenter, refName, brief, layout = premiumLayout('classic') }) {
  const refNo = presenter ? 2 : 1
  const styleOf = layout.dark
    ? 'its warm premium photorealism, flat crisp Thai typography, slim dividers, cyan/violet accent hues and fine diagonal X-inspired edge geometry (this poster is a dark full-photo layout, so do not copy its warm-white information area)'
    : 'its warm premium photorealism, restrained navy/cyan/violet palette, warm-white information area, slim dividers, flat crisp Thai typography, tiny coral accents and fine diagonal X-inspired edge geometry'
  const images = [
    presenter
      ? 'Image 1 = THE ADVISOR (required): the photographic hero features this man as the AssetX Estate advisor, a photoreal figure with the same face, hairstyle, skin tone and white dress shirt, lit to match the scene. Ignore that photo\'s background, signboard, clip-on microphone and any text in it.'
      : '',
    refName
      ? `Image ${refNo} is the approved visual style only: match ${styleOf}. Do NOT copy its text (including the small caption on its photo), its content, its people, its exact grid or its logo corner; new content and a composition tailored to this topic.${layout.id === 'classic' ? '' : ' Follow the LAYOUT described below, not the reference\'s arrangement.'}`
      : '',
    !presenter && !refName ? 'No reference image is attached: create the look from the art direction below.' : '',
  ].filter(Boolean)
  const hero = presenter
    ? `${layout.heroPlace} featuring the advisor from Image 1: ${brief.hero} He is the AssetX advisor on the owner's side of the table (explaining, reviewing papers or looking warmly at the viewer), never shown as the customer, receiving cash or celebrating. He is the only clear face; any other person only from behind or out of focus.`
    : `${layout.heroPlace}: ${brief.hero} No advisor photo is attached, so show no clear face (a person only from behind or out of focus, never a celebrity).`
  return { images, hero }
}

// สีเน้นคำในข้อย่อย: โครงพื้นเข้มใช้เฉดอ่อนให้อ่านออกบนกระจกฝ้าสีน้ำเงิน
function highlightColour(color, dark) {
  if (color === 'violet') return dark ? 'soft violet #B9A3E3' : `violet ${PREMIUM_COLORS.violet}`
  return dark ? 'warm coral #F2A68F' : `dark coral ${PREMIUM_COLORS.coral}`
}

// ---------------------------------------------------------------- โครง 'content' (สกิล 11 พ.ย. 2569: จัดวางอิสระตามเนื้อหา + โฉนดสมจริง)
// ต่างจาก 5 โครงหมุนเวียน: ไม่มีตำแหน่ง/เปอร์เซ็นต์ตายตัว ไม่บังคับแถบ CTA ท้ายภาพ · โทนสว่าง/เข้ม คนหรือวัตถุ และโฉนด AI เลือกจากเนื้อหา
// ที่คงเดิม: PASS-THROUGH · บรีฟ 6 ส่วน · ข้อความคำต่อคำ · สีเน้น 10–20% · ไม่วาดโลโก้/เบอร์/LINE (แถบแบรนด์ต่อใต้ภาพ) · ห้ามคำเกินจริง
const STYLE_REF_ONLY = 'Style reference only: preserve photographic quality, restrained palette and brand character; create a new content-led composition. Do not copy the reference layout, object arrangement, headline position, panel grid or footer.'
const REPEATED_PATTERN = 'headline top left, a house or desk photo across the top half, an information panel below and a CTA band across the bottom'

function contentLedPrompt({ plan, f, seed, refName, presenter, disclaimer, deedLayoutRef, deedRealismRef }) {
  const brief = plan.brief || {}
  const dark = plan.theme === 'dark'
  const deed = Boolean(plan.deed)
  const advisor = Boolean(presenter && plan.advisor)
  const points = (plan.points || []).filter((x) => x?.title)
  const middle = plan.middle || { type: 'none', items: [] }
  const callout = plan.callout?.title ? plan.callout : null
  const accent = plan.headlineAccent && (plan.headline || []).join(' ').includes(plan.headlineAccent) ? plan.headlineAccent : ''
  const highlights = (plan.highlights || []).filter((h) => h?.text && PREMIUM_HIGHLIGHT_COLORS.includes(h.color))
  const cta = ctaLines(plan.cta)
  const notes = deed && !disclaimer.includes(DEED_NOTE) ? [DEED_NOTE, ...disclaimer] : disclaimer
  let n = 0
  const images = []
  if (advisor) {
    n += 1
    images.push(`Image ${n} = THE ADVISOR (required): the photographic hero features this man as the AssetX Estate advisor, a photoreal figure with the same face, hairstyle, skin tone and white dress shirt, lit to match the scene. Ignore that photo's background, signboard, clip-on microphone and any text in it.`)
  }
  if (refName) {
    n += 1
    images.push(`Image ${n}: ${STYLE_REF_ONLY} Do not copy its text, its content, its people or its logo corner either.`)
  }
  if (deed && deedLayoutRef) {
    n += 1
    images.push(`Image ${n} = DEED LAYOUT REFERENCE (official format, from an educational infographic): draw every title deed in this poster with the real layout of the deed pictured there: paper proportions, the red Garuda at the top centre, the header โฉนดที่ดิน, the order of the field blocks and the plot-map box on the front, and the สารบัญจดทะเบียน registration table on the back. Use only the document itself; ignore the orange infographic, its callouts, numbers, labels, colours, logos and contact line.`)
  }
  if (deed && deedRealismRef) {
    n += 1
    images.push(`Image ${n} = DEED REALISM REFERENCE (approved by the owner): match how real its deed pages, paper texture, binding and lighting look and how clearly ${q(DEED_STAMP)} is stamped on each page; do not copy its composition, folder arrangement, headline, panels or footer.`)
  }
  if (!images.length) images.push('No reference image is attached: create the look from the art direction below.')
  const hero = advisor
    ? `${brief.hero} The advisor from Image 1 is the AssetX advisor on the owner's side of the table (explaining, reviewing papers or looking warmly at the viewer), never shown as the customer, receiving cash or celebrating. He is the only clear face; any other person only from behind or out of focus.`
    : `${brief.hero} No person is needed: places, property, documents and objects carry the story, so show no clear face (a person at most from behind or out of focus, never a celebrity).`
  const deedRule = deed
    ? `Every title deed is a realistic Thai land title deed (โฉนดที่ดิน) following the deed layout reference: the front page and/or the back registration page, whichever the content needs, never one invented page that merges the map and the registration list. All fields are blank or covered by neat solid bars: no names, ID numbers, deed numbers, signatures, dates or registration entries. A large translucent red stamp ${q(DEED_STAMP)} lies across each page.`
    : 'Documents stay anonymous: no deeds with seals, no readable personal data.'
  const theme = dark
    ? 'deep navy base (#061C2E to #092B43) with warm-white text and translucent navy panels'
    : 'warm-white base with deep navy and warm-white information panels'
  const colourRule = dark
    ? `Colour: text on dark areas warm white #FFF8EE; accents light cyan #7FD8E8, soft violet #B9A3E3 and a tiny warm coral #F2A68F, about 10-20% of the typography; never dark violet text on dark navy.`
    : `Colour only 10-20% of the typography: primary text navy ${PREMIUM_COLORS.navy}, accents teal ${PREMIUM_COLORS.teal}, violet ${PREMIUM_COLORS.violet}, dark coral ${PREMIUM_COLORS.coral}.`
  const headText = dark ? LIGHT_TEXT : NAVY_TEXT
  const nums = points.map((_, i) => String(i + 1).padStart(2, '0')).join(' ')
  return [
    'PASS-THROUGH RULE: call image_gen with everything below this line as the prompt, exactly as written, character for character. Do not summarize, shorten, reorder or rewrite it; it is already a finished production spec.',
    '',
    `Generate ONE finished premium Thai Facebook educational poster for AssetX Estate, a Thai property advisory for ขายฝาก (sale with right of redemption) and จำนอง (mortgage), for a ${f.platform} post.`,
    ...images,
    premiumFrameLine(f),
    `Brand footer (fixed): after rendering we attach our own brand strip with the real logo, phone and LINE directly below the bottom edge of this design (${footerShare(f)}). The strip continues the colour of this design's bottom edge, so let the design end calmly in its own background or photo, with no text near the bottom edge. Place the CTA where the composition below puts it; do NOT draw any logo, X mark, emblem, phone number, LINE id or QR code anywhere; the only brand name on the poster is inside the CTA text.`,
    '',
    'SIX-PART DESIGN BRIEF (instructions only, not text to print):',
    `1 Target Audience: ${brief.audience}`,
    `2 Communication Goal: ${brief.goal} Secondary action: chat with AssetX Estate.`,
    `3 Visual Psychology: ${brief.visual} The dominant headline is the largest text; secondary titles stay clearly smaller; clear contrast and ample whitespace; the eye follows the order in Creative Composition.`,
    `4 Key Message: ${q(plan.keyMessage)}. One takeaway; every supporting element explains it, no competing slogans.`,
    `5 Emotional Design: ${brief.emotion} The look stays professional and trustworthy: premium realistic light, genuine wood, leather, paper and metal textures, cyan-violet accents and tiny coral. No risk-free claims, urgency or official badges.`,
    `6 Call to Action: ${cta.map(q).join(' / ')}. One action; no invented phone, LINE or QR (the footer carries the real contact); no free, expert or approval claims.`,
    '',
    `Creative Composition (chosen from this post's content, not from a template): ${plan.composition}`,
    `Variation from Recent Work: ${plan.variation || 'No recent work is available to compare.'} Do not fall back to the pattern our recent posters repeated (${REPEATED_PATTERN}).`,
    '',
    `Art direction: premium photorealistic real-estate editorial advertising; content-led photographic composition; realistic architecture and human skin; coherent soft directional lighting; restrained AssetX cyan and violet accents with small coral highlights; ${theme}; crisp flat Thai typography; thin dividers; generous spacing; subtle depth through photography rather than cartoon effects. Hero visual: ${hero} Natural light, coherent perspective, real materials; photographs carry no caption, label or tag. ${deedRule} No currency piles, floating coins, toy houses or cartoon objects. Fine diagonal X geometry and thin cyan-violet gradient lines only as subtle accents. ${colourRule} Flat crisp Thai typography (a refined modern Thai sans, SemiBold or Bold headings, regular body), no extrusion, heavy outlines, stickers, brush strokes, neon, confetti, speech bubbles or 3D text.`,
    '',
    'Exact on-image copy (Thai, copy every string character for character with sensible line breaks; each string appears once; add no other words, figures, interest rates, calculations or hashtags):',
    plan.eyebrow ? `Small eyebrow: ${q(plan.eyebrow)}` : '',
    plan.headlineSmall ? `Headline contextual line, smaller: ${q(plan.headlineSmall)}` : '',
    `Dominant headline${(plan.headline || []).length > 1 ? ', two lines' : ''}: ${(plan.headline || []).map(q).join(' / ')}`,
    accent
      ? `Colour ${q(accent)} ${headText.accent}${dark ? ' (a subtle cyan-to-soft-violet gradient is fine)' : ''}; the rest of the headline ${headText.base}.`
      : `Headline in ${headText.base}.`,
    plan.subheading ? `Subheading: ${q(plan.subheading)}` : '',
    ...middleLines(middle),
    callout ? `Key callout (a calm emphasis block, for example a thin coloured vertical rule beside it): title ${q(callout.title)}${callout.body ? ` / line ${q(callout.body)}` : ''}` : '',
    points.length
      ? `${points.length} information groups, arranged as Creative Composition describes${plan.numbered ? `, numbered ${nums} in reading order` : ', no big numbers'}; small restrained line icons or short labels at most:`
      : '',
    ...points.map((pt, i) => `${plan.numbered ? String(i + 1).padStart(2, '0') : '-'} ${q(pt.title)}${pt.body ? ` / body ${q(pt.body)}` : ''}`),
    highlights.length ? `Selectively colour ${highlights.map((h) => `${q(h.text)} ${highlightColour(h.color, dark)}`).join(' and ')} (only these words); all group titles stay smaller than the dominant headline.` : '',
    deed ? `On every deed page: the red stamp ${q(DEED_STAMP)} (the only added word on the documents).` : '',
    `Small readable disclaimer near the CTA${deed ? ', its first line next to the documents' : ''}: ${notes.map(q).join(' / ')}`,
    `One CTA, the single clear action, placed as Creative Composition describes (a rounded pill, a side box or a calm text line; not necessarily a band across the bottom): ${cta.map(q).join(' / ')}`,
    '',
    'No claims that these costs always apply, of approval, guaranteed funding or a successful case. Educational overview, no solicitation promises. Mobile readable, polished full-bleed output.',
    `Avoid: prices, percentages, interest rates, any phone number, LINE id, URL, QR code, address, personal name or deed number; ${deed ? 'any seal, stamp or signature beyond the printed form of the reference deed and the ตัวอย่าง stamp; government or company emblems outside the deed document' : 'Garuda, seals, stamps, government or company emblems'}; any logo; watermarks, AI labels or any caption, tag or label on the photograph${deed ? ' (the ตัวอย่าง stamp on the deed is required)' : ''}; black-and-gold or green-and-gold loan-flyer looks; neon glow; cartoon, comic, flat vector, clay or toy-like 3D; borders, frames or bars around the design.`,
    `MODE: premium seed=${seed === null || seed === undefined ? 'none' : seed} ref=${refName || 'none'} presenter=${advisor ? 'use' : 'none'} layout=content theme=${dark ? 'dark' : 'light'} deed=${deed ? 'yes' : 'no'} canvas=${f.width}x${f.height} footer=append`,
  ].filter((line) => line !== '').join('\n').replace(/\n(Generate ONE|SIX-PART|Creative Composition|Art direction|Exact on-image|No claims)/g, '\n\n$1')
}

export function buildPremiumImagePrompt({ plan = {}, size = DEFAULT_POSTER_SIZE, seed = null, refName = '', presenter = false, disclaimer = PREMIUM_DISCLAIMER, layout = 'classic', deedLayoutRef = '', deedRealismRef = '' } = {}) {
  const f = premiumFrame(size)
  const L = typeof layout === 'object' && layout ? layout : premiumLayout(layout)
  if (L.id === CONTENT_LAYOUT.id) {
    if (plan.composition) return contentLedPrompt({ plan, f, seed, refName, presenter, disclaimer, deedLayoutRef, deedRealismRef })
    return buildPremiumImagePrompt({ plan, size, seed, refName, presenter, disclaimer, layout: 'classic' })
  }
  const brief = plan.brief || {}
  const points = (plan.points || []).filter((x) => x?.title)
  const middle = plan.middle || { type: 'none', items: [] }
  const hasMiddle = middleLines(middle).length > 0
  const accent = plan.headlineAccent && (plan.headline || []).join(' ').includes(plan.headlineAccent) ? plan.headlineAccent : ''
  const highlights = (plan.highlights || []).filter((h) => h?.text && PREMIUM_HIGHLIGHT_COLORS.includes(h.color))
  const cta = ctaLines(plan.cta)
  const nums = points.map((_, i) => String(i + 1).padStart(2, '0')).join(' ')
  const flow = [hasMiddle ? 'the middle process strip' : '', points.length && L.flowPoints ? L.flowPoints(points.length) : '', 'one navy CTA footer'].filter(Boolean).join(', then ')
  const visuals = heroLines({ presenter, refName, brief, layout: L })
  const colourRule = L.dark
    ? `Colour: text on the dark areas warm white #FFF8EE; accents light cyan #7FD8E8, soft violet #B9A3E3 and a tiny warm coral, about 10-20% of the typography; the CTA band stays solid navy ${PREMIUM_COLORS.navy}.`
    : `Colour only 10-20% of the typography: primary text navy ${PREMIUM_COLORS.navy}, accents teal ${PREMIUM_COLORS.teal}, violet ${PREMIUM_COLORS.violet}, dark coral ${PREMIUM_COLORS.coral}.`
  return [
    'PASS-THROUGH RULE: call image_gen with everything below this line as the prompt, exactly as written, character for character. Do not summarize, shorten, reorder or rewrite it; it is already a finished production spec.',
    '',
    `Generate ONE finished premium Thai Facebook educational poster for AssetX Estate, a Thai property advisory for ขายฝาก (sale with right of redemption) and จำนอง (mortgage), for a ${f.platform} post.`,
    ...visuals.images,
    premiumFrameLine(f),
    `Brand footer (fixed): the design ends with the navy CTA band touching the bottom edge of the design area. After rendering we attach our own navy footer with the real logo, phone and LINE directly below that band (${footerShare(f)}), so add nothing under the CTA band and do NOT draw any logo, X mark, emblem, phone number, LINE id or QR code anywhere; the only brand name on the poster is inside the CTA text below.`,
    '',
    'SIX-PART DESIGN BRIEF (instructions only, not text to print):',
    `1 Target Audience: ${brief.audience}`,
    `2 Communication Goal: ${brief.goal} Secondary action: chat with AssetX Estate.`,
    `3 Visual Psychology: ${brief.visual}${L.id === 'classic' ? '' : ' Where this brief\'s wording on layout or colours differs from the layout and colour lines in this spec, follow the spec.'} The dominant headline is the largest text, ${L.headlinePos}. Eye flows from the headline to ${L.afterHeadline}, then ${flow}. Secondary titles stay clearly smaller than the headline; clear contrast and ample whitespace.`,
    `4 Key Message: ${q(plan.keyMessage)}. One takeaway; every supporting element explains it, no competing slogans.`,
    `5 Emotional Design: ${brief.emotion} The look stays professional and trustworthy: premium realistic daylight, genuine wood, paper and metal textures, warm white and navy, cyan-violet accents and tiny dark coral. No risk-free claims, urgency or official badges.`,
    `6 Call to Action: ${cta.map(q).join(' / ')}. One action; no invented phone, LINE or QR (the footer carries the real contact); no free, expert or approval claims.`,
    '',
    `Art direction: realistic architectural and financial editorial photography with warm commercial quality. ${visuals.hero} Natural light, coherent perspective, real materials; the photo carries no caption, label or tag. No fake deeds, seals, readable personal data, currency piles, toy houses or cartoon objects. A flowing photographic composition, not a flat stock-icon poster. Fine diagonal X geometry only as subtle edge accents. ${L.info} ${colourRule} Flat crisp Thai typography (a refined modern Thai sans, SemiBold or Bold headings, regular body), no extrusion, heavy outlines, stickers, brush strokes, neon, confetti, speech bubbles or 3D text.`,
    '',
    'Exact on-image copy (Thai, copy every string character for character with sensible line breaks; each string appears once; add no other words, figures, interest rates, calculations or hashtags):',
    plan.eyebrow ? `Small eyebrow: ${q(plan.eyebrow)}` : '',
    plan.headlineSmall ? `Headline contextual line, smaller: ${q(plan.headlineSmall)}` : '',
    `Dominant headline${(plan.headline || []).length > 1 ? ', two lines' : ''}: ${(plan.headline || []).map(q).join(' / ')}`,
    accent
      ? `Colour ${q(accent)} ${L.headlineText.accent}; the rest of the headline ${L.headlineText.base}. Not the whole poster in ${L.headlineText === LIGHT_TEXT ? 'cyan' : 'teal'}.`
      : `Headline in ${L.headlineText.base}.`,
    plan.subheading ? `Subheading: ${q(plan.subheading)}` : '',
    ...middleLines(middle),
    points.length ? L.points(points.length, nums) : '',
    ...points.map((pt, i) => `${String(i + 1).padStart(2, '0')} ${q(pt.title)}${pt.body ? ` / body ${q(pt.body)}` : ''}`),
    highlights.length ? `Selectively colour ${highlights.map((h) => `${q(h.text)} ${highlightColour(h.color, L.dark)}`).join(' and ')} (only these words); all point titles stay smaller than the dominant headline.` : '',
    `Small readable disclaimer just above the CTA band${L.dark ? ', warm white over the dark photo' : ''}: ${disclaimer.map(q).join(' / ')}`,
    `Navy CTA band at the very bottom of the design area, full width, white text with tiny cyan accents: ${cta.map(q).join(' / ')}`,
    '',
    'No claims that these costs always apply, of approval, guaranteed funding or a successful case. Educational overview, no solicitation promises. Mobile readable, polished full-bleed output.',
    'Avoid: prices, percentages, interest rates, any phone number, LINE id, URL, QR code, address, personal name or deed number; Garuda, seals, stamps, government or company emblems; any logo; watermarks, AI labels or any caption, tag or label on the photograph; black-and-gold or green-and-gold loan-flyer looks; neon glow; cartoon, comic, flat vector, clay or toy-like 3D; borders, frames or bars around the design.',
    `MODE: premium seed=${seed === null || seed === undefined ? 'none' : seed} ref=${refName || 'none'} presenter=${presenter ? 'use' : 'none'} layout=${L.id} canvas=${f.width}x${f.height} footer=append`,
  ].filter((line) => line !== '').join('\n').replace(/\n(Generate ONE|SIX-PART|Art direction|Exact on-image|No claims)/g, '\n\n$1')
}

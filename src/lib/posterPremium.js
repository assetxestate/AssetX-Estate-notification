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
// ต่างจากภาพในแชต Codex ข้อเดียว: โลโก้ไม่ให้โมเดลวาด (กติกาเดิมของเจ้าของ) — อยู่ในแถบท้ายที่ตัวรับงานวางเอง
import { DEFAULT_POSTER_SIZE, POSTER_SIZES } from './posterSizes.js'
import { FOOTER_RATIO } from './posterFree.js'

export const PREMIUM_REQUEST_HEADER = 'PREMIUM POSTER REQUEST'
// สีจากสกิล (premium-art-direction.md) — ข้อความหลักน้ำเงินเข้ม · เน้นได้ราว 10–20% ของตัวอักษร
export const PREMIUM_COLORS = { navy: '#092B43', teal: '#087F93', violet: '#654697', coral: '#B74434' }
export const PREMIUM_HIGHLIGHT_COLORS = ['violet', 'coral']
export const PREMIUM_HERO_LABEL = 'ภาพประกอบ'
// บรรทัดที่สองของ CTA (ตามภาพต้นแบบ) · เบอร์/LINE จริงอยู่ในแถบท้ายใต้ CTA
export const PREMIUM_CTA_SUB = 'ทางแชต AssetX Estate'
// ข้อความกำกับ: ระบบใส่เอง ไม่ให้ AI แต่ง (มาจากภาพต้นแบบที่เจ้าของชอบ)
export const PREMIUM_DISCLAIMER = ['ความรู้ทั่วไป ไม่ใช่ข้อเสนอวงเงินหรือคำรับประกัน', 'ค่าใช้จ่ายและเงื่อนไขขึ้นอยู่กับเอกสารและข้อเท็จจริงแต่ละกรณี']
export const HYPOTHETICAL_NOTE = 'เคสสมมุติ ไม่ใช่ลูกค้าจริง ผลลัพธ์ต่างกันทุกกรณี'
const HYPOTHETICAL_RE = /(?:เคส|กรณี)สมม[ุ]?ติ/

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
    ...(plan.points || []).flatMap((p) => [p.title, p.body]), plan.cta,
  ].map((s) => String(s || '').trim()).filter(Boolean)
}

export function premiumRefIndex(seed, count) {
  if (!count) return -1
  const n = Number(seed)
  return Number.isFinite(n) ? Math.abs(Math.trunc(n)) % count : 0
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

export function premiumFrame(size = DEFAULT_POSTER_SIZE) {
  const key = POSTER_SIZES[size] ? size : DEFAULT_POSTER_SIZE
  const target = POSTER_SIZES[key]
  const canvas = PREMIUM_CANVAS[key] || PREMIUM_CANVAS[DEFAULT_POSTER_SIZE]
  const t = target.width / target.height
  const band = appendedFooterHeight(canvas.width, canvas.height, t)
  return {
    ...canvas,
    targetRatio: Number(t.toFixed(4)),
    footerPct: Math.round((band / (canvas.height + band)) * 100),
    targetWidth: target.width,
    targetHeight: target.height,
    platform: target.platform,
  }
}

export function premiumFrameLine(frame) {
  const f = frame
  const margin = Math.round(Math.min(f.width, f.height) * 0.055)
  return `Canvas (fixed, keep it word for word in your image_gen prompt): render the image at ${f.width}x${f.height} px (${f.label}). The whole canvas is the design, full bleed, with no border, frame or bars; keep every text at least ${margin} px from every edge.`
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

export function buildPremiumImagePrompt({ plan = {}, size = DEFAULT_POSTER_SIZE, seed = null, refName = '', disclaimer = PREMIUM_DISCLAIMER } = {}) {
  const f = premiumFrame(size)
  const brief = plan.brief || {}
  const points = (plan.points || []).filter((x) => x?.title)
  const middle = plan.middle || { type: 'none', items: [] }
  const hasMiddle = middleLines(middle).length > 0
  const accent = plan.headlineAccent && (plan.headline || []).join(' ').includes(plan.headlineAccent) ? plan.headlineAccent : ''
  const highlights = (plan.highlights || []).filter((h) => h?.text && PREMIUM_HIGHLIGHT_COLORS.includes(h.color))
  const cta = ctaLines(plan.cta)
  const flow = [hasMiddle ? 'the middle process strip' : '', points.length ? `the ${points.length} numbered points` : '', 'one navy CTA footer'].filter(Boolean).join(', then ')
  return [
    'PASS-THROUGH RULE: call image_gen with everything below this line as the prompt, exactly as written, character for character. Do not summarize, shorten, reorder or rewrite it; it is already a finished production spec.',
    '',
    `Generate ONE finished premium Thai Facebook educational poster for AssetX Estate, a Thai property advisory for ขายฝาก (sale with right of redemption) and จำนอง (mortgage), for a ${f.platform} post.`,
    refName
      ? 'Image 1 is the approved visual style only: match its warm premium photorealism, restrained navy/cyan/violet palette, warm-white information area, slim dividers, flat crisp Thai typography, tiny coral accents and fine diagonal X-inspired edge geometry. Do NOT copy its text, its content, its exact grid or its logo corner; new content and a composition tailored to this topic.'
      : 'No reference image is attached: create the look from the art direction below.',
    premiumFrameLine(f),
    `Brand footer (fixed): the design ends with the navy CTA band touching the bottom edge of the design area. After rendering we attach our own navy footer with the real logo, phone and LINE directly below that band (it becomes the bottom ${f.footerPct}% of the final ${f.targetWidth}x${f.targetHeight} post), so add nothing under the CTA band and do NOT draw any logo, X mark, emblem, phone number, LINE id or QR code anywhere; the only brand name on the poster is inside the CTA text below.`,
    '',
    'SIX-PART DESIGN BRIEF (instructions only, not text to print):',
    `1 Target Audience: ${brief.audience}`,
    `2 Communication Goal: ${brief.goal} Secondary action: chat with AssetX Estate.`,
    `3 Visual Psychology: ${brief.visual} The dominant headline is the largest text, upper left. Eye flows from the headline to the photographic hero, then ${flow}. Secondary titles stay clearly smaller than the headline; clear contrast and ample whitespace.`,
    `4 Key Message: ${q(plan.keyMessage)}. One takeaway; every supporting element explains it, no competing slogans.`,
    `5 Emotional Design: ${brief.emotion} The look stays professional and trustworthy: premium realistic daylight, genuine wood, paper and metal textures, warm white and navy, cyan-violet accents and tiny dark coral. No risk-free claims, urgency or official badges.`,
    `6 Call to Action: ${cta.map(q).join(' / ')}. One action; no invented phone, LINE or QR (the footer carries the real contact); no free, expert or approval claims.`,
    '',
    `Art direction: realistic architectural and financial editorial photography with warm commercial quality. The top 35-40% of the design area is the photographic hero: ${brief.hero} Natural light, coherent perspective, real materials; any person is an anonymous Thai adult, never a celebrity. No fake deeds, seals, readable personal data, currency piles, toy houses or cartoon objects. A flowing photographic composition, not a flat stock-icon poster. Fine diagonal X geometry only as subtle edge accents. Below the hero a warm-white information area with thin dividers and a few small thin line icons. Colour only 10-20% of the typography: primary text navy ${PREMIUM_COLORS.navy}, accents teal ${PREMIUM_COLORS.teal}, violet ${PREMIUM_COLORS.violet}, dark coral ${PREMIUM_COLORS.coral}. Flat crisp Thai typography (a refined modern Thai sans, SemiBold or Bold headings, regular body), no extrusion, heavy outlines, stickers, brush strokes, neon, confetti, speech bubbles or 3D text.`,
    '',
    'Exact on-image copy (Thai, copy every string character for character with sensible line breaks; each string appears once; add no other words, figures, interest rates, calculations or hashtags):',
    plan.eyebrow ? `Small eyebrow: ${q(plan.eyebrow)}` : '',
    plan.headlineSmall ? `Headline contextual line, smaller: ${q(plan.headlineSmall)}` : '',
    `Dominant headline${(plan.headline || []).length > 1 ? ', two lines' : ''}: ${(plan.headline || []).map(q).join(' / ')}`,
    accent ? `Colour ${q(accent)} deep teal ${PREMIUM_COLORS.teal}; the rest of the headline navy. Not the whole poster in teal.` : `Headline in navy ${PREMIUM_COLORS.navy}.`,
    plan.subheading ? `Subheading: ${q(plan.subheading)}` : '',
    `Hero label, small, bottom corner of the photo: ${q(PREMIUM_HERO_LABEL)}`,
    ...middleLines(middle),
    points.length ? `${points.length} numbered points, vertically arranged with elegant ${points.map((_, i) => String(i + 1).padStart(2, '0')).join(' ')} numbers (alternating teal and violet) and small restrained line icons:` : '',
    ...points.map((pt, i) => `${String(i + 1).padStart(2, '0')} ${q(pt.title)}${pt.body ? ` / body ${q(pt.body)}` : ''}`),
    highlights.length ? `Selectively colour ${highlights.map((h) => `${q(h.text)} ${h.color === 'violet' ? `violet ${PREMIUM_COLORS.violet}` : `dark coral ${PREMIUM_COLORS.coral}`}`).join(' and ')} (only these words); all point titles stay smaller than the dominant headline.` : '',
    `Small readable disclaimer just above the CTA band: ${disclaimer.map(q).join(' / ')}`,
    `Navy CTA band at the very bottom of the design area, full width, white text with tiny cyan accents: ${cta.map(q).join(' / ')}`,
    '',
    'No claims that these costs always apply, of approval, guaranteed funding or a successful case. Educational overview, no solicitation promises. Mobile readable, polished full-bleed output.',
    'Avoid: prices, percentages, interest rates, any phone number, LINE id, URL, QR code, address, personal name or deed number; Garuda, seals, stamps, government or company emblems; any logo; watermarks or AI labels; black-and-gold or green-and-gold loan-flyer looks; neon glow; cartoon, comic, flat vector, clay or toy-like 3D; borders, frames or bars around the design.',
    `MODE: premium seed=${seed === null || seed === undefined ? 'none' : seed} ref=${refName || 'none'} canvas=${f.width}x${f.height} footer=append`,
  ].filter((line) => line !== '').join('\n').replace(/\n(Generate ONE|SIX-PART|Art direction|Exact on-image|No claims)/g, '\n\n$1')
}

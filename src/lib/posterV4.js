// src/lib/posterV4.js — โปสเตอร์ v4 "ตามเรฟ" (7 พ.ย. 2569 ค่ำ)
//
// เจ้าของดูภาพแบบ v3.2 แล้วบอกว่ายังไม่ตรงใจและไม่ตรงรูปเรฟ จึงดึงจากเรฟทั้ง 6 ข้อ: คนเป็นจุดดึงสายตา (รูปเจ้าของเอง) · บล็อกเยอะแน่น
// ไอคอนทุกแถว · สีสดเพิ่ม 2 สี (เหลือง/ชมพู) บนฐานน้ำเงิน-ไซยาน · แถบล่างบริการ + เบอร์/LINE บริษัท · ลูกเล่นตกแต่ง (ประกาย ลูกศร กล่องคำพูด)
// คำสั่งเขียนตามสคีมาของสกิล imagegen ใน Codex (Use case / Canvas map / Input images / … / Text verbatim / Constraints / Avoid) นำด้วย
// PASS-THROUGH RULE เพื่อให้ตัวแทน Codex ส่งต่อคำต่อคำ (ตรวจแล้ว 7 พ.ย.: ไม่ย่อ) · แถบทึบบน-ล่างเป็นสีดำ (ต่างจากแถบล่างสีน้ำเงิน ตัวรับงานตัดออกเอง)
// ทุกสตริงไทยที่ขึ้นบนภาพคัดจากโพสต์คำต่อคำ ยกเว้นช่องทางติดต่อของบริษัท (POSTER_CONTACT)
// ภาพแนบ (โลโก้เต็ม · รูปผู้แนะนำ · เรฟสไตล์) ตัวรับงานบนคอมสำนักงานเป็นคนเลือกไฟล์ จึงเว้นที่ไว้เป็น {{INPUT_IMAGES}} และ {{PRESENTER}} ให้เติมตอนสั่ง
import { pickHeadlineKeyword, POSTER_CONTACT } from './posterDesignSystem.js'
import { cleanCaption, extractPosterCopy, iconFor, parsePost, trimClause, verbatimMisses, wordCount } from './posterBrief.js'
import { cropPlan, DEFAULT_POSTER_SIZE } from './posterSizes.js'
import { pickPosterVariant, variantLine } from './posterVariants.js'

export const POSTER_V4_VERSION = 'v4'
export const PLACEHOLDER_IMAGES = '{{INPUT_IMAGES}}'
export const PLACEHOLDER_PRESENTER = '{{PRESENTER}}'

// หัวข้อการ์ดเตือน/การ์ดลงมือทำ ต้องเป็นวลีที่มีอยู่ในโพสต์จริง (ค้นตามลำดับ) ไม่มีก็ไม่ใส่หัวข้อ
const WARN_TITLES = ['ก่อนลงนาม', 'ก่อนเซ็น', 'ข้อควรระวัง', 'ก่อนตัดสินใจ', 'ข้อห้าม']
const ACTION_TITLES = ['ก่อนคุยกับผู้ให้บริการ', 'สิ่งที่ต้องเตรียม', 'เอกสารที่ต้องเตรียม', 'เช็กลิสต์', 'ก่อนยื่น', 'ก่อนเริ่ม', 'ก่อนตัดสินใจซื้อ']
// คำนามสำหรับชิปแถบล่าง (ต้องปรากฏในโพสต์) — คำยาวครอบคำสั้น (ยอดสินไถ่ ครอบ สินไถ่)
const CHIP_NOUNS = ['วันครบกำหนด', 'ยอดสินไถ่', 'เอกสารประกอบ', 'สำนักงานที่ดิน', 'ค่าใช้จ่าย', 'ค่าธรรมเนียม', 'ดอกเบี้ย', 'วงเงิน', 'ราคาประเมิน', 'เอกสารสิทธิ์', 'โฉนด', 'สัญญา', 'กรรมสิทธิ์', 'ทำเล', 'ทางเข้าออก', 'ผังเมือง', 'สินไถ่', 'ไถ่ถอน']
const WARN_START_RE = /^(อย่า|ห้าม|ระวัง|ไม่ควร)/
// จุดเริ่มประโยคย่อยในย่อหน้าไทย (คั่นด้วยช่องว่าง) — ไม่รวม ให้/เพราะ/โดย เพื่อไม่ผ่าประโยคเงื่อนไข "หาก… ให้…"
const CLAUSE_START_RE = /\s+(?=(?:หาก|ถ้า|เมื่อ|อย่า|ห้าม|ระวัง|ไม่ควร|ควร|ต้อง|เริ่มจาก|เก็บ|แยก|เตรียม|ก่อน)[ก-๙])/

const tidy = (s) => String(s || '').replace(/[""“”]/g, '').replace(/^[\s,，]+|[\s,，.]+$/g, '').trim()

// ประโยคย่อยทั้งหมดของข้อความ ตามลำดับที่ปรากฏ
export function clausesOf(text = '') {
  return String(text || '').replace(/\r/g, '').split(/\n+|(?<=[.!?])\s+|\s+·\s+|\s{2,}/)
    .flatMap((s) => s.split(CLAUSE_START_RE)).map(tidy).filter(Boolean)
}

// แตกประโยคสั่งทำเป็นเช็กลิสต์: "จดสิ่งที่รู้แล้ว สิ่งที่ยังไม่ชัด และหลักฐานที่ต้องขอเพิ่ม" → 3 ข้อ (ทุกข้อเป็นส่วนของประโยคเดิมคำต่อคำ)
export function splitChecklist(item = '') {
  const parts = tidy(item).split(/\s+และ(?=[ก-๙\s])\s*|\s+หรือ(?=[ก-๙\s])\s*|\s*[,，]\s*/).map(tidy).filter(Boolean)
  const out = []
  for (const p of parts) {
    const tokens = p.split(/\s+/).filter(Boolean)
    if (tokens.length >= 2 && parts.length < 3 && tokens.every((t) => t.length >= 6)) out.push(...tokens)
    else out.push(p)
  }
  return [...new Set(out)].filter((s) => s.length >= 6).slice(0, 4)
}

const firstFound = (text, list) => list.find((w) => text.includes(w)) || ''

// ชิปแถบล่าง: คำนามโดเมนที่มีในโพสต์ — หัวข้อแถวละ 1 คำ (คำยาวสุดในหัวข้อนั้น) ก่อน แล้วเติมจากทั้งโพสต์ตามความยาว · ตัดคำที่เป็นส่วนของคำยาวกว่า
export function pickBandChips(text = '', { max = 3, exclude = [], rowTitles = [] } = {}) {
  const present = CHIP_NOUNS.filter((n) => text.includes(n) && !exclude.includes(n))
  const kept = present.filter((n) => !present.some((o) => o !== n && o.includes(n))).sort((a, b) => b.length - a.length)
  const picked = []
  for (const title of rowTitles) {
    const hit = kept.find((n) => String(title || '').includes(n) && !picked.includes(n))
    if (hit) picked.push(hit)
    if (picked.length >= max) break
  }
  for (const n of kept) if (picked.length < max && !picked.includes(n)) picked.push(n)
  return picked.slice(0, max)
}

// ก๊อปปี้เด็ค v4 = ก๊อปปี้เด็ค v3.2 + ริบบิ้นเต็มประโยคแรก + กล่องคำพูด + การ์ดคู่ (เช็กลิสต์ / ข้อห้าม) + แถบเตือนกว้าง + ชิป 3 ช่อง + ช่องทางติดต่อ
export function extractPosterCopyV4({ title = '', caption = '' } = {}) {
  const base = extractPosterCopy({ title, caption })
  const post = parsePost({ title, caption })
  const text = cleanCaption(caption)
  const headline = base.headline || title
  const keyWord = base.keyWord || pickHeadlineKeyword(headline)

  // ริบบิ้น = ประโยคแรกของโพสต์ทั้งประโยค (แบบเรฟ) ถ้ายาว 4–12 คำ ไม่งั้นใช้ของ v3.2
  const firstLine = tidy((post.opening[0] || '').split('\n')[0])
  const firstSentence = tidy(firstLine.split(/(?<=[.!?])\s+/)[0])
  const ribbon = firstSentence && wordCount(firstSentence) >= 4 && wordCount(firstSentence) <= 12 && !/^หัวข้อ/.test(firstSentence) ? firstSentence : base.ribbon

  const rows = base.rows.map((r) => ({ ...r, icon: r.icon === 'check mark' ? (iconFor(r.detail) === 'check mark' ? 'document' : iconFor(r.detail)) : r.icon }))

  // การ์ดซ้าย = เช็กลิสต์จากประโยคลงมือทำ
  const leftTitle = base.actionTitle || firstFound(text, ACTION_TITLES)
  let leftItems = base.actionItems.flatMap(splitChecklist)
  if (leftItems.length < 2) leftItems = base.actionItems.slice(0, 3)
  leftItems = [...new Set(leftItems)].slice(0, 4)

  // การ์ดขวา = ประโยค อย่า/ห้าม/ระวัง/ไม่ควร ทั่วทั้งโพสต์ (อย่า/ห้าม/ระวัง ก่อน ไม่ควร) ไม่เกิน 3 ข้อ
  const pointClauses = post.points.flatMap((p) => clausesOf(`${p.head} ${p.detail}`))
  const otherClauses = post.others.flatMap((p) => clausesOf(p))
  const allClauses = [...otherClauses.slice(0, post.opening.length ? post.opening.flatMap((p) => clausesOf(p)).length : 0), ...pointClauses, ...otherClauses.slice(post.opening.flatMap((p) => clausesOf(p)).length)]
  const seen = new Set()
  const warningsAll = allClauses.filter((c) => WARN_START_RE.test(c) && wordCount(c) >= 4 && wordCount(c) <= 18)
    .map((c) => trimClause(c, { min: 4, max: 12 }) || c).filter((c) => c && !seen.has(c) && seen.add(c))
  const rightItems = [...warningsAll.filter((c) => /^(อย่า|ห้าม|ระวัง)/.test(c)), ...warningsAll.filter((c) => /^ไม่ควร/.test(c))].slice(0, 3)
  const rightTitle = rightItems.length ? firstFound(text, WARN_TITLES) : ''

  const used = new Set([ribbon, base.ribbon, ...rows.flatMap((r) => [r.title, r.detail]), ...leftItems, ...rightItems, ...base.actionItems].filter(Boolean))
  const unused = (c) => c && ![...used].some((u) => c.includes(u) || u.includes(c))

  // แถบเตือนกว้าง = ประโยคแนะนำ (ควร/ต้อง) 8–18 คำ ที่ยังไม่ใช้ — จากรายละเอียดข้อย่อยก่อน แล้วค่อยย่อหน้าเปิด/ปิด
  // ตัดท้าย "และ…" ของประโยคยาวออก (ส่วนแรกยังเป็นประโยคเดิมคำต่อคำ)
  const stripPool = [...pointClauses, ...otherClauses].map((c) => tidy(c.split(/\s+และ(?=[ก-๙])/)[0]))
    .filter((c) => /ควร|ต้อง/.test(c) && !WARN_START_RE.test(c) && wordCount(c) >= 8 && wordCount(c) <= 18 && unused(c))
  const strip = stripPool[0] ? (trimClause(stripPool[0], { min: 6, max: 16 }) || stripPool[0]) : (base.callout && unused(base.callout) ? base.callout : '')
  if (strip) used.add(strip)

  // กล่องคำพูดข้างผู้แนะนำ = ประโยคเงื่อนไข "หาก/ถ้า/เมื่อ… ให้/ควร/ต้อง…" 5–14 คำ ที่ยังไม่ใช้
  const bubblePool = [...pointClauses, ...otherClauses].filter((c) => /^(หาก|ถ้า|เมื่อ)/.test(c) && /ให้|ควร|ต้อง/.test(c) && wordCount(c) >= 5 && wordCount(c) <= 14 && unused(c))
  const bubble = bubblePool[0] || ''

  // ชิปแถบล่างเลิกใช้ (เจ้าของ 11 พ.ย. 2569 #37: "สำนักงานที่ดิน · เอกสารสิทธิ์ · ค่าใช้จ่าย" ดูแล้วไม่รู้ว่าหมายถึงอะไร)
  // เป็นคำนามที่หยิบจากโพสต์มาเลียนแบบแถบบริการของเรฟ ไม่ได้บอกอะไรคนอ่าน → แถบล่างเหลือเบอร์/LINE · pickBandChips เก็บไว้เผื่อใช้กับข้อความที่มีความหมาย
  const bandChips = []

  return {
    ...base,
    headline,
    keyWord,
    ribbon,
    rows,
    leftTitle,
    leftItems,
    rightTitle,
    rightItems,
    strip,
    bubble,
    bandChips,
    contact: { ...POSTER_CONTACT },
  }
}

// ทุกสตริงที่จะขึ้นบนภาพ (ยกเว้นช่องทางติดต่อ) ต้องมาจากโพสต์คำต่อคำ
export function verbatimMissesV4(copy = {}, { title = '', caption = '' } = {}) {
  return verbatimMisses({
    ribbon: copy.ribbon,
    cardTitle: copy.cardTitle,
    actionTitle: copy.leftTitle,
    callout: copy.strip,
    rows: copy.rows,
    actionItems: [...(copy.leftItems || []), ...(copy.rightItems || []), copy.rightTitle, copy.bubble].filter(Boolean),
    bandChips: copy.bandChips,
  }, { title, caption })
}

// แผนที่แคนวาส: แถบทึบดำบน-ล่างเมื่อขนาดปลายทางต้องครอปบน-ล่าง (โซนเป็นพิกเซล) · ขนาดอื่นบอกเป็น % ของความสูง
// โซนกลางภาพขึ้นกับ "การจัดวาง" ของชุดสไตล์ (posterVariants.js) · แถบดำ โลโก้ และแถบล่างคงที่ทุกแบบ (กันครอปกินเนื้อหา)
const ZONES = { logoTop: 0.02, logoBottom: 0.10, headTop: 0.02, headBottom: 0.20, ribbonBottom: 0.245, presenterBottom: 0.49, cardTop: 0.26, cardBottom: 0.55, pairTop: 0.57, pairBottom: 0.78, stripTop: 0.80, stripBottom: 0.855, bandTop: 0.87, labelsAbove: 0.965 }

// ชื่อบล็อกในแผนที่แคนวาส — บล็อกที่โพสต์ไม่มีข้อความให้ ต้องเปลี่ยนเป็นของที่ไม่มีตัวอักษร (zoneLabels)
// เจอจริง #27 (9 พ.ย. 2569): แผนที่จอง "two side-by-side cards" + คำสั่งบอก "what to do and what to avoid" แต่โพสต์มีแค่ 1 บรรทัด
// → โมเดลแต่งการ์ด "ควรทำอะไรบ้าง / ควรหลีกเลี่ยงอะไร" 8 ข้อเอง (ไม่อยู่ในโพสต์ ไม่ผ่านด่านตรวจ) รวมข้อที่ไล่ลูกค้าติดจำนอง
// การ์ดหลักที่โพสต์ไม่มีข้อให้ = แถบภาพฉากหลัง (เจอจริง #37: การ์ดว่างในแผนที่ → โมเดลแต่ง "คำถาม/คำตอบ" เอง ไม่อยู่ในโพสต์)
export const ZONE_LABELS = { main: 'main card', pair: 'two side-by-side cards', strip: 'one wide callout strip', ribbon: 'brush ribbon' }
const PHOTO_BAND = 'a full-width sharp photo band of the backdrop scene (no text, no cards, no icons)'
export function zoneLabels({ main = true, pair = true, panel = false, strip = true, ribbon = true } = {}) {
  return {
    main: main ? ZONE_LABELS.main : PHOTO_BAND,
    pair: pair ? ZONE_LABELS.pair : panel ? 'one wide checklist panel' : PHOTO_BAND,
    strip: strip ? ZONE_LABELS.strip : 'a thin cyan divider line (no text)',
    ribbon: ribbon ? ZONE_LABELS.ribbon : 'thin cyan brush-stroke accent (no text)',
  }
}

// ข้อความโซนของการจัดวางแต่ละแบบ — Z(a,b) = ช่วง · Y(f) = จุด · topWord = "y <top>" หรือ "the top" · L = ชื่อบล็อก (zoneLabels)
function compositionZones(compositionId, { Z, Y, topWord, a1, L = ZONE_LABELS }) {
  const band = Z(ZONES.bandTop, 1)
  switch (compositionId) {
    case 'presenter-left':
      return `logo chip top-right ${Z(ZONES.logoTop, ZONES.logoBottom)} · headline block ${Z(ZONES.headTop, ZONES.headBottom)} in the right 60% of the width, right-aligned, ending left of the logo chip · speech bubble (if any) entirely inside ${Z(ZONES.logoTop, ZONES.headBottom)} · ${L.ribbon} ${Z(ZONES.headBottom, ZONES.ribbonBottom)} right-aligned · presenter cutout on the left 40% from ${topWord} down to ${Y(ZONES.presenterBottom)}, overlapping the left edge of the main card · ${L.main} ${Z(ZONES.cardTop, ZONES.cardBottom)}${L.main === ZONE_LABELS.main ? ' with all its text in the right 62% of the width' : ''} · ${L.pair} ${Z(ZONES.pairTop, ZONES.pairBottom)} · ${L.strip} ${Z(ZONES.stripTop, ZONES.stripBottom)} · bottom band ${band}`
    case 'numbered-steps':
      return `logo chip top-left ${Z(ZONES.logoTop, ZONES.logoBottom)} · headline block ${Z(ZONES.headTop, ZONES.headBottom)} in the left 60% of the width · speech bubble (if any) entirely inside ${Z(ZONES.logoTop, ZONES.headBottom)} · ${L.ribbon} ${Z(ZONES.headBottom, ZONES.ribbonBottom)} · presenter cutout on the right 40% from ${topWord} down to ${Y(ZONES.presenterBottom)}, overlapping the right edge of the steps card · steps card ${Z(ZONES.cardTop, 0.60)} (one tall card; a vertical dotted cyan line down its left side joins big ${a1} numbered circles, one per row) · ${L.pair} ${Z(0.62, ZONES.pairBottom)} · ${L.strip} ${Z(0.815, 0.86)} · bottom band ${band}`
    case 'hero-scene':
      return `logo chip top-left ${Z(ZONES.logoTop, ZONES.logoBottom)} · headline block ${Z(ZONES.headTop, 0.18)} full width, left-aligned, starting right of the logo chip · ${L.ribbon} ${Z(0.18, 0.225)} · scene strip ${Z(0.235, 0.42)} full width showing the backdrop scene itself, sharp · presenter cutout (head to chest, about 22% of the width) at the right end of the scene strip from ${Y(0.21)} down to ${Y(0.44)}, overlapping the main card's top-right corner · speech bubble (if any) inside the scene strip, left of the presenter · ${L.main} ${Z(0.41, 0.62)} overlapping the bottom edge of the scene strip · ${L.pair} ${Z(0.64, ZONES.pairBottom)} · ${L.strip} ${Z(0.815, 0.86)} · bottom band ${band}`
    case 'presenter-bottom':
      return `logo chip top-left ${Z(ZONES.logoTop, ZONES.logoBottom)} · headline block ${Z(ZONES.headTop, 0.19)} in the left 65% of the width · speech bubble (if any) in the right 35% of the width inside ${Z(ZONES.logoTop, 0.19)} · ${L.ribbon} ${Z(0.19, 0.235)} · ${L.main} ${Z(0.25, 0.52)} full width · ${L.pair} ${Z(0.54, 0.72)} · ${L.strip} ${Z(0.735, 0.785)} with its text in the left 70% of the width · presenter cutout (head to chest, about 26% of the width) in the bottom-right corner from ${Y(0.68)} down to ${Y(ZONES.bandTop)}, overlapping the right end of the callout strip and the bottom-right corner of the right card, never covering text · bottom band ${band}`
    default:
      return `logo chip top-left ${Z(ZONES.logoTop, ZONES.logoBottom)} · headline block ${Z(ZONES.headTop, ZONES.headBottom)} in the left 60% of the width · speech bubble (if any) entirely inside ${Z(ZONES.logoTop, ZONES.headBottom)} · ${L.ribbon} ${Z(ZONES.headBottom, ZONES.ribbonBottom)} · presenter cutout on the right 40% from ${topWord} down to ${Y(ZONES.presenterBottom)}, overlapping the right edge of the main card · ${L.main} ${Z(ZONES.cardTop, ZONES.cardBottom)} · ${L.pair} ${Z(ZONES.pairTop, ZONES.pairBottom)} · ${L.strip} ${Z(ZONES.stripTop, ZONES.stripBottom)} · bottom band ${band}`
  }
}

export function canvasMapV4(plan, variant = null, labels = ZONE_LABELS) {
  const compositionId = variant?.compositionId || 'presenter-right'
  const L = { ...ZONE_LABELS, ...(labels || {}) }
  const a1 = variant?.palette?.a1?.name || 'sunshine yellow'
  const cutsTopBottom = /top/.test(String(plan.edges || ''))
  const cutsSides = /left/.test(String(plan.edges || ''))
  // เผื่อ 45% ของส่วนที่ตัด: โมเดลทาแถบบางกว่าสั่งราว 20–50 px และวางป้ายชิดแถบ (คิวงาน 6 ป้ายชิปและกล่องคำพูดโดนครอป) — แถบกว้างขึ้นให้ครอป 4:5 ไม่กินเนื้อหา
  const slack = Math.round((plan.cutPx || 0) * 0.45)
  const bar = (plan.cutPx || 0) + slack
  const pct = (f) => `${Math.round(f * 100)}%`
  if (cutsTopBottom) {
    const top = bar
    const bottom = plan.sourceHeight - bar
    const usable = bottom - top
    const y = (f) => Math.round(top + usable * f)
    const zones = compositionZones(compositionId, { Z: (a, b) => `y ${y(a)}-${y(b)}`, Y: (f) => `y ${y(f)}`, topWord: `y ${top}`, a1, L })
    return `Canvas map (HIGHEST PRIORITY, ${plan.sourceWidth}x${plan.sourceHeight} px, y from the top): y 0-${top} and y ${bottom}-${plan.sourceHeight} are two solid flat BLACK #000000 bars with absolutely nothing on them; they are cut off before posting. The poster occupies only y ${top}-${bottom} and must be PACKED like the references: no empty area taller than 2% of the poster height anywhere. Zones: ${zones} sitting directly on the black bar, with every pill and label inside it ending above y ${y(ZONES.labelsAbove)} and plain navy between the labels and the black bar. Nothing of the poster may touch the black bars.`
  }
  const sideBars = cutsSides ? ` The left ${bar} px and right ${bar} px of the canvas are solid flat BLACK #000000 bars with nothing on them (cut off before posting); the poster occupies only the area between them.` : ''
  const zones = compositionZones(compositionId, { Z: (a, b) => `${pct(a)}-${pct(b)}`, Y: pct, topWord: 'the top', a1, L })
  return `Canvas map (HIGHEST PRIORITY, ${plan.sourceWidth}x${plan.sourceHeight} px, zones as % of the height from the top):${sideBars} ${zones} on the bottom edge, every label inside it fully above ${pct(ZONES.labelsAbove)}. The poster must be PACKED like the references: no empty area taller than 2% of the height anywhere.`
}

// ตำแหน่งผู้แนะนำตามการจัดวาง (ใช้ทั้งในบรรทัด Presenter และ Constraints)
function presenterPlacement(compositionId) {
  switch (compositionId) {
    case 'presenter-left': return 'standing on the left 40% of the width beside the headline, overlapping the ribbon\'s left end and the top-left corner of the main card'
    case 'numbered-steps': return 'standing on the right 40% of the width beside the headline, overlapping the ribbon\'s right end and the top-right corner of the steps card'
    case 'hero-scene': return 'standing at the right end of the scene strip, about 22% of the width wide, overlapping the main card\'s top-right corner'
    case 'presenter-bottom': return 'standing in the bottom-right corner just above the bottom band, about 26% of the width wide, overlapping the right end of the callout strip and the bottom-right corner of the right card'
    default: return 'standing on the right 40% of the width beside the headline, overlapping the ribbon\'s right end and the top-right corner of the main card'
  }
}

// ประโยค "Input images" และ "Presenter" เติมตอนสั่ง เพราะตัวรับงานเป็นคนรู้ว่าแนบไฟล์ไหนได้บ้าง
// refsMode: 'layout' = ให้เลียนการจัดวางของเรฟ (ชุดที่วางผู้แนะนำข้างพาดหัวแบบเรฟ) · 'finish' = เอาแค่ความแน่น/ไอคอน/พิลสี ส่วนการจัดวางยึดแผนที่แคนวาส (ชุดอิสระกว่า)
export function describeInputImages({ logo = true, presenter = false, refs = 0, refsMode = 'layout', logoCorner = 'top-left' } = {}) {
  const parts = []
  let n = 0
  if (logo) {
    n += 1
    parts.push(`Image ${n} = the official AssetX Estate logo (the X mark with the wordmark "AssetX Estate Co., Ltd." under it); place the whole image once, unchanged and unretyped, inside a white rounded chip in the ${logoCorner} corner about 20% of the width wide; never redraw, recolour or re-type any part of it.`)
  }
  if (presenter) {
    n += 1
    parts.push(`Image ${n} = IDENTITY REFERENCE for the presenter: the man in this photo is the presenter; reproduce his face, hairstyle, skin tone and white dress shirt faithfully as a photoreal cutout; ignore everything else in that photo (its background, signs and text must not appear).`)
  }
  if (refs > 0) {
    const ids = Array.from({ length: refs }, (_, i) => n + i + 1)
    n += refs
    const label = ids.length === 1 ? `Image ${ids[0]}` : `Images ${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`
    const what = refsMode === 'finish'
      ? 'STYLE REFERENCES for finish only: match their density, icon-per-row lists, coloured header pills, bright accent pills and decorative energy, but NOT their composition; the block positions are fixed by the Canvas map above'
      : 'STYLE REFERENCES: match their composition density, layering (cards overlapping the photo, cutout person overlapping the headline zone and the card edge), icon-per-row lists, coloured header pills, speech bubble, decorative sparkles and arrows, and the service band at the bottom'
    parts.push(`${label} = ${what}. Never copy their text, phone numbers, LINE ids, QR codes, emblems, Garuda, logos or their exact green and gold palette; use the palette below.`)
  }
  return parts.length ? parts.join(' ') : `none attached; draw the logo chip as a plain white rounded chip in the ${logoCorner} corner holding a navy letter X with no wordmark.`
}

// ตัวตนผู้แนะนำเท่านั้น — ตำแหน่ง ท่า และช่วงตัวอยู่ในบรรทัด Presenter ของคำสั่ง (เปลี่ยนตามชุดสไตล์ ตัวรับงานไม่ต้องรู้)
export function describePresenter({ presenter = false } = {}) {
  const who = presenter
    ? 'the man from the identity reference image, a Thai advisor in his 30s in a crisp white dress shirt'
    : 'a friendly generic Thai man advisor in his 30s in a crisp white dress shirt (not a real person, no name)'
  return `${who}, warm confident smile, photoreal cutout with crisp edges and one soft navy shadow; no microphone, no name tag, no text on the shirt.`
}

export function fillImagePlaceholders(prompt = '', { logo = true, presenter = false, refs = 0, refsMode = 'layout' } = {}) {
  const logoCorner = /logo chip top-right/.test(String(prompt || '')) ? 'top-right' : 'top-left'
  return String(prompt || '')
    .replace(PLACEHOLDER_IMAGES, describeInputImages({ logo, presenter, refs, refsMode, logoCorner }))
    .replace(PLACEHOLDER_PRESENTER, describePresenter({ presenter }))
}

const q = (s) => `"${String(s || '').trim()}"`

// คำสั่งภาพ v4 ทั้งก้อน (ยังมี {{INPUT_IMAGES}} / {{PRESENTER}} ให้ตัวรับงานเติม)
// seed = null → ชุดสไตล์แรก (หน้าตา v4 เดิม) · seed จากเลขโพสต์ + ลำดับงาน (posterSeed) → ชุดสไตล์ต่างกันต่อโพสต์และต่อการกดสร้างใหม่ · variant ส่งมาเองได้
export function buildCompactPosterPrompt({ title = '', caption = '', size = DEFAULT_POSTER_SIZE, layout = 'steps', seed = null, variant = null } = {}) {
  const copy = extractPosterCopyV4({ title, caption })
  const plan = cropPlan(size)
  const v = variant || pickPosterVariant({ layout, seed, text: `${title}\n${caption}` })
  const { a1, a2 } = v.palette
  const contact = copy.contact
  const rows = copy.rows.slice(0, 5)
  const pair = copy.rightItems.length >= 2 && copy.leftItems.length >= 2
  // บล็อกที่ไม่มีข้อความจากโพสต์ = ของที่ไม่มีตัวอักษร (zoneLabels) — ไม่งั้นโมเดลแต่งข้อความมาเติมเอง
  const panel = !pair && (copy.leftItems.length > 0 || copy.rightItems.length === 1)
  const labels = zoneLabels({ main: rows.length > 0, pair, panel, strip: Boolean(copy.strip), ribbon: Boolean(copy.ribbon) })
  const pairName = pair ? 'the pair' : panel ? 'the checklist panel' : 'the photo band'
  const qa = rows.length > 0 && rows.every((r) => r.qa)
  const gets = ['the topic', ...(rows.length ? [qa ? 'the questions and answers' : 'the key points'] : []), ...(pair ? ['what to do', 'what to avoid'] : [])]
  const readerGets = gets.length > 1 ? `${gets.slice(0, -1).join(', ')} and ${gets.at(-1)}` : gets[0]
  const chips = copy.bandChips || []
  const steps = v.compositionId === 'numbered-steps'
  const hero = v.compositionId === 'hero-scene'
  const mainName = rows.length ? (steps ? 'steps card' : 'main card') : 'the top photo band'
  // การ์ดที่ไม่มีหัวข้อ = ไม่มีป้ายหัวการ์ดเลย (สั่ง "header pill … with no title text" แล้วได้ป้ายสีว่างเปล่า — #37 งาน 38)
  const head = (pill, icon, title) => title ? `${pill} header pill with ${icon}): title ${q(title)}` : `no header pill and no title, only ${icon} at its top-left)`
  const sceneTreatment = hero
    ? ', shown sharp inside the scene strip and softly blurred everywhere else behind the cards; no readable background text'
    : `, all softly blurred with a ${v.palette.light ? 'white' : 'navy'}-to-transparent scrim over the top 30% of the poster; no readable background text`
  const lines = [
    'PASS-THROUGH RULE: call image_gen with everything below this line as the prompt, exactly as written, character for character. Do not summarize, shorten, reorder or rewrite it; it is already a finished production spec in your own schema.',
    '',
    `Use case: ads-marketing (dense Thai infographic poster in the style of the reference posters; card layout: ${layout}; style set: ${v.id})`,
    canvasMapV4(plan, v, labels),
    `Primary request: ONE finished premium Thai property-advisory infographic poster for AssetX Estate (${plan.platform}, final size ${plan.width}x${plan.height}) about ${q(copy.headline)}, with the energy, density and layering of the style reference images. A reader must get ${readerGets} without the caption.`,
    `Input images: ${PLACEHOLDER_IMAGES}`,
    `Presenter (mandatory, the focal point): ${PLACEHOLDER_PRESENTER} Cutout ${v.composition.cutout}, ${presenterPlacement(v.compositionId)}, ${v.pose.text}; it never covers any text.`,
    `Scene/backdrop: ${v.scene.text}${sceneTreatment}${layout === 'warning' ? '; no villains, no police, no handcuffs' : ''}.`,
    `Style/medium: ${v.medium.text}; heavy geometric Thai display face (Kanit or Prompt Black) for the headline; clean Thai sans for everything else; flat duotone line icons on coloured circles, one stroke weight.`,
    `Color palette: ${v.palette.base}; TWO bright accents like the references: ${a1.name} ${a1.hex} (headline key word, one header pill, decorations) and ${a2.name} ${a2.hex} (one warning header pill and its icons, the speech bubble outline). ${v.palette.shadow}. No green, no gold, no neon glow.`,
    'Type scale: headline line 1 about 7.5% of the poster height, line 2 about 4.5%; header pills and row titles about 2.5%; details, checklist items, callout, CTA and chip labels about 2% and never below 24 px; the headline is at least three times the detail text. Text may wrap to two lines; never shrink the headline.',
    `Decorations (exactly these): ${v.decor.text};${copy.bubble ? ` one white speech bubble with a ${a2.name} outline next to the presenter's head;` : ''} nothing else. No other ornaments.`,
    'Text (verbatim; every string appears exactly once, spelled exactly, no added punctuation or quotation marks):',
    copy.keyWord && copy.headline.includes(copy.keyWord)
      ? `- Headline: the key word ${q(copy.keyWord)} ${v.headlineStyle.keyword}, the rest of the headline ${v.headlineStyle.rest}, broken into two lines: ${q(copy.headline)}`
      : `- Headline ${v.headlineStyle.solo}, two lines: ${q(copy.headline)}`,
    copy.ribbon ? `- Ribbon, cyan brush stroke with navy text, one line: ${q(copy.ribbon)}` : '',
    copy.bubble ? `- Speech bubble beside the presenter, navy text, two lines allowed: ${q(copy.bubble)}` : '',
    rows.length
      ? [
          steps
            ? `- Steps card (${v.cards.text}; ${head('navy', 'a cyan magnifier circle', copy.cardTitle)} then ${rows.length} rows on a vertical dotted cyan line, each starting with a big ${a1.name} circle holding its number in navy, then a bold navy title${rows.some((r) => r.detail) ? ' and one regular detail line' : ''}:`
            : qa
              ? `- Main card (${v.cards.text}; ${head('navy', 'a cyan magnifier circle', copy.cardTitle)} then ${rows.length} question-and-answer rows, each with a pale-cyan question-mark icon circle on the left, the question as a bold navy title and its answer as one regular line under it:`
              : `- Main card (${v.cards.text}; ${head('navy', 'a cyan magnifier circle', copy.cardTitle)} then ${rows.length} rows, each with a pale-cyan icon circle on the left, a bold navy title${rows.some((r) => r.detail) ? ' and one regular detail line' : ''}:`,
          ...rows.map((r, i) => `  row ${i + 1} (${steps ? `number ${i + 1}, small ${r.icon} icon after the title` : qa ? 'question-mark icon' : `${r.icon} icon`}): ${q(r.title)}${r.detail ? ` / ${q(r.detail)}` : ''}`),
        ].join('\n')
      : '',
    pair
      ? `- Left card of the pair (${head(a1.name, 'a navy notepad icon', copy.leftTitle)} then ${copy.leftItems.length} checklist lines, each with a cyan check-circle: ${copy.leftItems.map(q).join(' / ')}`
      : (copy.leftItems.length ? `- Wide checklist panel (${head(a1.name, 'a navy notepad icon', copy.leftTitle)} then ${copy.leftItems.length} lines, each with a cyan check-circle: ${copy.leftItems.map(q).join(' / ')}` : ''),
    pair
      ? `- Right card of the pair (${head(a2.name, 'a white warning-triangle icon', copy.rightTitle)} then ${copy.rightItems.length} lines, each with a ${a2.name} exclamation circle: ${copy.rightItems.map(q).join(' / ')}`
      : (copy.rightItems.length === 1 ? `- Warning chip (${a2.name}, white text, under the checklist panel): ${q(copy.rightItems[0])}` : ''),
    copy.strip ? `- Wide callout strip (navy, white text, a small cyan document icon at its left): ${q(copy.strip)}` : '',
    chips.length
      ? `- Bottom band (flat navy, every label fully above the crop line): left a cyan pill with a navy phone icon and navy text ${q(`โทร ${contact.phone}`)} and under it a white pill with a navy chat-bubble icon and navy text ${q(`LINE: ${contact.line}`)}; right ${chips.length} small white chips, each a navy line icon above a short label: ${chips.map((c) => `${iconFor(c)} ${q(c)}`).join(', ')}. The digits ${contact.phone} and the id ${contact.line} must be copied exactly, character for character.`
      : `- Bottom band (flat navy, every label fully above the crop line): a cyan pill with a navy phone icon and navy text ${q(`โทร ${contact.phone}`)} and a white pill with a navy chat-bubble icon and navy text ${q(`LINE: ${contact.line}`)}, side by side and centred; nothing else in the band (no chips, no icon tiles, no other labels). The digits ${contact.phone} and the id ${contact.line} must be copied exactly, character for character.`,
    `Constraints: a card gets a header pill only when the Text section gives it a title (a card without a title has no pill or tab at all, never an empty one); icon-per-row lists like the references; cards overlap the backdrop with soft shadows; the presenter is ${presenterPlacement(v.compositionId)} but never covers any text; all text inside the cards stays clear of the presenter; the ${mainName}, ${pairName} and ${copy.strip ? 'the strip' : 'the divider'} keep the zones of the Canvas map; never add cards, lists, header pills or text that are not in the Text section (if a zone has spare room, use more spacing or more of the backdrop photo instead); the logo image is the only logo and is never redrawn; the black bars stay completely empty; the poster must tell the story with the caption hidden.`,
    `Avoid: any text not listed above; any phone number or LINE id other than the two given above; URLs, QR codes, prices, percentages, interest rates, deed numbers, addresses, names; Garuda, seals, stamps, government or other company emblems; watermarks or AI labels; a second logo; green and gold styling; neon glow, lens flare; anything drawn on the black bars.`,
    variantLine(v),
    `LAYOUT: ${layout}`,
  ].filter(Boolean)
  return lines.join('\n')
}

export function posterV4For({ title = '', caption = '', size = DEFAULT_POSTER_SIZE, layout = 'steps', seed = null } = {}) {
  const copy = extractPosterCopyV4({ title, caption })
  const variant = pickPosterVariant({ layout, seed, text: `${title}\n${caption}` })
  return { copy, variant, prompt: buildCompactPosterPrompt({ title, caption, size, layout, variant }), misses: verbatimMissesV4(copy, { title, caption }) }
}

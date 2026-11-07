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

  const bandChips = pickBandChips(text, { max: 3, exclude: keyWord ? [keyWord] : [], rowTitles: rows.map((r) => r.title) })

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
const ZONES = { logoTop: 0.02, logoBottom: 0.10, headTop: 0.02, headBottom: 0.20, ribbonBottom: 0.245, presenterBottom: 0.49, cardTop: 0.26, cardBottom: 0.55, pairTop: 0.57, pairBottom: 0.78, stripTop: 0.80, stripBottom: 0.855, bandTop: 0.87, labelsAbove: 0.965 }
export function canvasMapV4(plan) {
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
    return `Canvas map (HIGHEST PRIORITY, ${plan.sourceWidth}x${plan.sourceHeight} px, y from the top): y 0-${top} and y ${bottom}-${plan.sourceHeight} are two solid flat BLACK #000000 bars with absolutely nothing on them; they are cut off before posting. The poster occupies only y ${top}-${bottom} and must be PACKED like the references: no empty area taller than 2% of the poster height anywhere. Zones: logo chip top-left y ${y(ZONES.logoTop)}-${y(ZONES.logoBottom)} · headline block y ${y(ZONES.headTop)}-${y(ZONES.headBottom)} in the left 60% of the width · speech bubble (if any) entirely inside y ${y(ZONES.logoTop)}-${y(ZONES.headBottom)} · brush ribbon y ${y(ZONES.headBottom)}-${y(ZONES.ribbonBottom)} · presenter cutout on the right 40% from y ${top} down to y ${y(ZONES.presenterBottom)}, overlapping the right edge of the main card · main card y ${y(ZONES.cardTop)}-${y(ZONES.cardBottom)} · two side-by-side cards y ${y(ZONES.pairTop)}-${y(ZONES.pairBottom)} · one wide callout strip y ${y(ZONES.stripTop)}-${y(ZONES.stripBottom)} · bottom band y ${y(ZONES.bandTop)}-${bottom} sitting directly on the black bar, with every pill and label inside it ending above y ${y(ZONES.labelsAbove)} and plain navy between the labels and the black bar. Nothing of the poster may touch the black bars.`
  }
  const sideBars = cutsSides ? ` The left ${bar} px and right ${bar} px of the canvas are solid flat BLACK #000000 bars with nothing on them (cut off before posting); the poster occupies only the area between them.` : ''
  return `Canvas map (HIGHEST PRIORITY, ${plan.sourceWidth}x${plan.sourceHeight} px, zones as % of the height from the top):${sideBars} logo chip top-left ${pct(ZONES.logoTop)}-${pct(ZONES.logoBottom)} · headline block ${pct(ZONES.headTop)}-${pct(ZONES.headBottom)} in the left 60% of the width · brush ribbon ${pct(ZONES.headBottom)}-${pct(ZONES.ribbonBottom)} · presenter cutout on the right 40% from the top down to ${pct(ZONES.presenterBottom)}, overlapping the right edge of the main card · main card ${pct(ZONES.cardTop)}-${pct(ZONES.cardBottom)} · two side-by-side cards ${pct(ZONES.pairTop)}-${pct(ZONES.pairBottom)} · one wide callout strip ${pct(ZONES.stripTop)}-${pct(ZONES.stripBottom)} · bottom band ${pct(ZONES.bandTop)}-100% on the bottom edge, every label inside it fully above ${pct(ZONES.labelsAbove)}. The poster must be PACKED like the references: no empty area taller than 2% of the height anywhere.`
}

// ประโยค "Input images" และ "Presenter" เติมตอนสั่ง เพราะตัวรับงานเป็นคนรู้ว่าแนบไฟล์ไหนได้บ้าง
export function describeInputImages({ logo = true, presenter = false, refs = 0 } = {}) {
  const parts = []
  let n = 0
  if (logo) {
    n += 1
    parts.push(`Image ${n} = the official AssetX Estate logo (the X mark with the wordmark "AssetX Estate Co., Ltd." under it); place the whole image once, unchanged and unretyped, inside a white rounded chip in the top-left corner about 20% of the width wide; never redraw, recolour or re-type any part of it.`)
  }
  if (presenter) {
    n += 1
    parts.push(`Image ${n} = IDENTITY REFERENCE for the presenter: the man in this photo is the presenter; reproduce his face, hairstyle, skin tone and white dress shirt faithfully as a photoreal cutout; ignore everything else in that photo (its background, signs and text must not appear).`)
  }
  if (refs > 0) {
    const ids = Array.from({ length: refs }, (_, i) => n + i + 1)
    n += refs
    const label = ids.length === 1 ? `Image ${ids[0]}` : `Images ${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`
    parts.push(`${label} = STYLE REFERENCES: match their composition density, layering (cards overlapping the photo, cutout person overlapping the headline zone and the card edge), icon-per-row lists, coloured header pills, speech bubble, decorative sparkles and arrows, and the service band at the bottom. Never copy their text, phone numbers, LINE ids, QR codes, emblems, Garuda, logos or their exact green and gold palette; use the palette below.`)
  }
  return parts.length ? parts.join(' ') : 'none attached; draw the logo chip as a plain white rounded chip holding a navy letter X with no wordmark.'
}

export function describePresenter({ presenter = false } = {}) {
  const who = presenter
    ? 'the man from the identity reference image, a Thai advisor in his 30s in a crisp white dress shirt'
    : 'a friendly generic Thai man advisor in his 30s in a crisp white dress shirt (not a real person, no name)'
  return `${who}, warm confident smile, photoreal cutout from head to waist, standing on the right 40% of the width beside the headline, one hand pointing at the headline key word, overlapping the ribbon's right end and the top-right corner of the main card; crisp edges, one soft navy shadow; no microphone, no name tag, no text on the shirt.`
}

export function fillImagePlaceholders(prompt = '', { logo = true, presenter = false, refs = 0 } = {}) {
  return String(prompt || '')
    .replace(PLACEHOLDER_IMAGES, describeInputImages({ logo, presenter, refs }))
    .replace(PLACEHOLDER_PRESENTER, describePresenter({ presenter }))
}

const q = (s) => `"${String(s || '').trim()}"`

// คำสั่งภาพ v4 ทั้งก้อน (ยังมี {{INPUT_IMAGES}} / {{PRESENTER}} ให้ตัวรับงานเติม)
export function buildCompactPosterPrompt({ title = '', caption = '', size = DEFAULT_POSTER_SIZE, layout = 'steps' } = {}) {
  const copy = extractPosterCopyV4({ title, caption })
  const plan = cropPlan(size)
  const contact = copy.contact
  const rows = copy.rows.slice(0, 5)
  const pair = copy.rightItems.length >= 2 && copy.leftItems.length >= 2
  const chips = copy.bandChips
  const lines = [
    'PASS-THROUGH RULE: call image_gen with everything below this line as the prompt, exactly as written, character for character. Do not summarize, shorten, reorder or rewrite it; it is already a finished production spec in your own schema.',
    '',
    `Use case: ads-marketing (dense Thai infographic poster in the style of the reference posters; card layout: ${layout})`,
    canvasMapV4(plan),
    `Primary request: ONE finished premium Thai property-advisory infographic poster for AssetX Estate (${plan.platform}, final size ${plan.width}x${plan.height}) about ${q(copy.headline)}, with the energy, density and layering of the style reference images. A reader must get the topic, the key points, what to do and what to avoid without the caption.`,
    `Input images: ${PLACEHOLDER_IMAGES}`,
    `Presenter (mandatory, the focal point): ${PLACEHOLDER_PRESENTER}`,
    `Scene/backdrop: bright Thai home-office desk beside a window at mid-morning, light oak desktop, sheer curtains, a small modern Thai house model and a navy clipboard with a plain blank contract at the bottom-left corner behind the cards, all softly blurred with a navy-to-transparent scrim over the top 30% of the poster; no readable background text${layout === 'warning' ? '; no villains, no police, no handcuffs' : ''}.`,
    'Style/medium: photoreal advertising composite with flat vector UI on top; heavy geometric Thai display face (Kanit or Prompt Black) for the headline; clean Thai sans for everything else; flat duotone line icons on coloured circles, one stroke weight.',
    'Color palette: navy #08213f and cyan #42c7d8 are the base; white and off-white #f4f7fb cards; TWO bright accents like the references: sunshine yellow #ffd43b (headline key word fill, one header pill, sparkles) and coral-pink #ff5c7a (one warning header pill and its icons, the speech bubble outline). Deep violet #4b2a82 only as shadow tint inside the photo. No green, no gold, no neon glow.',
    'Type scale: headline line 1 about 7.5% of the poster height, line 2 about 4.5%; header pills and row titles about 2.5%; details, checklist items, callout, CTA and chip labels about 2% and never below 24 px; the headline is at least three times the detail text. Text may wrap to two lines; never shrink the headline.',
    `Decorations (exactly these): one yellow sparkle and one small cyan arrow beside the headline key word pointing at the ribbon;${copy.bubble ? ' one white speech bubble with a coral-pink outline next to the presenter\'s head;' : ''} one 2 px cyan hairline on top of the bottom band. No other ornaments.`,
    'Text (verbatim; every string appears exactly once, spelled exactly, no added punctuation or quotation marks):',
    copy.keyWord && copy.headline.includes(copy.keyWord)
      ? `- Headline: the key word ${q(copy.keyWord)} in sunshine yellow with a navy stroke and solid navy 3D extrusion, the rest of the headline in white-to-pale-cyan with the same stroke and extrusion, broken into two lines: ${q(copy.headline)}`
      : `- Headline, white-to-pale-cyan fill with a navy stroke and solid navy 3D extrusion, two lines: ${q(copy.headline)}`,
    copy.ribbon ? `- Ribbon, cyan brush stroke with navy text, one line: ${q(copy.ribbon)}` : '',
    copy.bubble ? `- Speech bubble beside the presenter, navy text, two lines allowed: ${q(copy.bubble)}` : '',
    rows.length
      ? [
          `- Main card (white, rounded, navy header pill at its top-left with a cyan magnifier circle)${copy.cardTitle ? `: title ${q(copy.cardTitle)}` : ' with no title text'} then ${rows.length} rows, each with a pale-cyan icon circle on the left, a bold navy title${rows.some((r) => r.detail) ? ' and one regular detail line' : ''}:`,
          ...rows.map((r, i) => `  row ${i + 1} (${r.icon} icon): ${q(r.title)}${r.detail ? ` / ${q(r.detail)}` : ''}`),
        ].join('\n')
      : '',
    pair
      ? `- Left card of the pair (white, yellow header pill with a navy notepad icon)${copy.leftTitle ? `: title ${q(copy.leftTitle)}` : ' with no title text'} then ${copy.leftItems.length} checklist lines, each with a cyan check-circle: ${copy.leftItems.map(q).join(' / ')}`
      : (copy.leftItems.length ? `- Wide checklist panel (white, yellow header pill with a navy notepad icon)${copy.leftTitle ? `: title ${q(copy.leftTitle)}` : ' with no title text'} then ${copy.leftItems.length} lines, each with a cyan check-circle: ${copy.leftItems.map(q).join(' / ')}` : ''),
    pair
      ? `- Right card of the pair (white, coral-pink header pill with a white warning-triangle icon)${copy.rightTitle ? `: title ${q(copy.rightTitle)}` : ' with no title text'} then ${copy.rightItems.length} lines, each with a coral-pink exclamation circle: ${copy.rightItems.map(q).join(' / ')}`
      : (copy.rightItems.length === 1 ? `- Warning chip (coral-pink, white text, under the checklist panel): ${q(copy.rightItems[0])}` : ''),
    copy.strip ? `- Wide callout strip (navy, white text, a small cyan document icon at its left): ${q(copy.strip)}` : '',
    `- Bottom band (flat navy, every label fully above the crop line): left a cyan pill with a navy phone icon and navy text ${q(`โทร ${contact.phone}`)} and under it a white pill with a navy chat-bubble icon and navy text ${q(`LINE: ${contact.line}`)}${chips.length ? `; right ${chips.length} small white chips, each a navy line icon above a short label: ${chips.map((c) => `${iconFor(c)} ${q(c)}`).join(', ')}` : ''}. The digits ${contact.phone} and the id ${contact.line} must be copied exactly, character for character.`,
    `Constraints: every card has one header pill and icon-per-row lists like the references; cards overlap the blurred photo with soft navy shadows; the presenter overlaps the ribbon end and the main card's top-right corner but never covers any text; all text inside the cards stays clear of the presenter; the logo image is the only logo and is never redrawn; the black bars stay completely empty; the poster must tell the story with the caption hidden.`,
    `Avoid: any text not listed above; any phone number or LINE id other than the two given above; URLs, QR codes, prices, percentages, interest rates, deed numbers, addresses, names; Garuda, seals, stamps, government or other company emblems; watermarks or AI labels; a second logo; green and gold styling; neon glow, bevel, emboss, lens flare; anything drawn on the black bars.`,
    `LAYOUT: ${layout}`,
  ].filter(Boolean)
  return lines.join('\n')
}

export function posterV4For({ title = '', caption = '', size = DEFAULT_POSTER_SIZE, layout = 'steps' } = {}) {
  const copy = extractPosterCopyV4({ title, caption })
  return { copy, prompt: buildCompactPosterPrompt({ title, caption, size, layout }), misses: verbatimMissesV4(copy, { title, caption }) }
}

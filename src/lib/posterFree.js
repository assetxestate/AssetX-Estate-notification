// src/lib/posterFree.js — โปสเตอร์โหมด "อิสระ": ให้ Codex เป็นอาร์ตไดเรกเตอร์ ออกแบบคอนเซปต์และการจัดวางเอง
//
// เจ้าของ 7 พ.ย. 2569 ดึก: "บอกหัวข้อและข้อความที่จะใส่ไปในภาพให้กับโคเด็กซ์ แล้วปล่อยให้โคเด็กซ์ออกแบบในสไตล์ของโคเด็กซ์เอง
// โดยมีบรีฟ มูดแอนด์โทนสไตล์ของเรา ไม่ต้องฟิกร้อยเปอร์เซ็นต์ เพื่อที่จะได้มีรูปแบบที่แตกต่างและอิสระมากกว่าเดิม" — เป็นตัวเลือกเพิ่ม คู่กับ v4 "ตามเรฟ"
// ต่างจาก v4: ไม่มี PASS-THROUGH RULE (ให้ตัวแทน Codex เขียนคำสั่งภาพเอง) · ไม่มีแผนที่โซน · ไม่แนบเรฟคู่แข่ง · ไม่บังคับกล่องคำพูด/การ์ดคู่
// สิ่งที่ยังบังคับ (ความถูกต้อง ไม่ใช่หน้าตา): แถบดำกันครอป · ข้อความไทยคัดจากโพสต์คำต่อคำ (เลือกใช้บางข้อได้) · โลโก้ไม่วาดใหม่ · เบอร์/LINE บริษัท · รายการห้าม
import { POSTER_CONTACT } from './posterDesignSystem.js'
import { extractPosterCopyV4 } from './posterV4.js'
import { cropPlan, DEFAULT_POSTER_SIZE } from './posterSizes.js'

export const PLACEHOLDER_FREE_IMAGES = '{{FREE_IMAGES}}'

// ทิศเริ่มต้นที่แนะนำต่อรอบ (หมุนตาม seed) — เป็นแค่จุดตั้งต้น Codex ทิ้งได้ถ้าคิดแบบที่ดีกว่า · ช่วยไม่ให้ตัวแทนออกแบบซ้ำทางเดิมทุกครั้ง
export const FREE_DIRECTIONS = [
  { id: 'editorial-cover', text: 'an editorial magazine cover: one strong hero photo, the headline as the cover line, the key points as short cover teasers' },
  { id: 'giant-type', text: 'a bold typographic poster: the headline key word set huge across a third of the design, the key points as small numbered captions around it' },
  { id: 'journey-map', text: 'an illustrated journey path or road map where each key point is a milestone along the way' },
  { id: 'split-screen', text: 'a split-screen composition: the situation or question on one side, the clear answer or checklist on the other' },
  { id: 'notebook-sketch', text: 'a hand-drawn notebook or whiteboard look with marker annotations, arrows and doodles around the key points' },
  { id: 'paper-collage', text: 'a playful paper-cut collage of document cut-outs, tape, arrows and stickers carrying the key points' },
  { id: 'single-object', text: 'a minimalist poster built around one large symbolic object (a house key, a contract, a calendar or a house) with generous breathing room' },
  { id: 'photo-story', text: 'a documentary-style photo of a Thai homeowner moment with the text set in clean overlay panels' },
  { id: 'clay-diorama', text: 'a soft 3D clay diorama scene of the topic with the text on rounded floating labels' },
  { id: 'host-explainer', text: 'the advisor as a friendly host on one side presenting the key points with clean callout lines' },
]

const q = (s) => `"${String(s || '').trim()}"`

// แถบดำกันครอป — เหมือน v4 (ตัวรับงานตัดแถบที่เห็นจริงแล้วครอปตามสัดส่วนแพลตฟอร์ม เมื่อคำสั่งมีคำว่า "BLACK #000000 bars")
export function technicalFrame(plan) {
  const slack = Math.round((plan.cutPx || 0) * 0.45)
  const bar = (plan.cutPx || 0) + slack
  if (/top/.test(String(plan.edges || ''))) {
    const bottom = plan.sourceHeight - bar
    return `Technical frame (the ONLY fixed layout rule, keep it word for word in your image_gen prompt): the canvas is ${plan.sourceWidth}x${plan.sourceHeight} px; y 0-${bar} and y ${bottom}-${plan.sourceHeight} are two solid flat BLACK #000000 bars with absolutely nothing on them (they are cut off before posting). The whole design lives in y ${bar}-${bottom}; keep every text, the logo and the contact area at least 30 px inside that zone.`
  }
  if (/left/.test(String(plan.edges || ''))) {
    return `Technical frame (the ONLY fixed layout rule, keep it word for word in your image_gen prompt): the left ${bar} px and right ${bar} px of the ${plan.sourceWidth}x${plan.sourceHeight} canvas are two solid flat BLACK #000000 bars with nothing on them (cut off before posting); keep every text, the logo and the contact area at least 30 px inside the area between them.`
  }
  return `Technical frame (the ONLY fixed layout rule): ${plan.sourceWidth}x${plan.sourceHeight} canvas; keep every text, the logo and the contact area at least 4% away from every edge.`
}

// คลังข้อความที่ใช้ได้ — ทุกข้อคัดจากโพสต์คำต่อคำ (ยกเว้นช่องทางติดต่อของบริษัท) · ไม่ใส่ประโยคกล่องคำพูด (เจ้าของถามว่ามีไว้ทำไม — ถูกดึงจากรายละเอียดมาลอย ๆ)
export function freeTextPool({ title = '', caption = '' } = {}) {
  const copy = extractPosterCopyV4({ title, caption })
  const points = copy.rows.slice(0, 5).map((r) => ({ title: r.title, detail: r.detail || '' }))
  return {
    headline: copy.headline,
    keyWord: copy.keyWord && copy.headline.includes(copy.keyWord) ? copy.keyWord : '',
    opening: copy.ribbon || '',
    pointsTitle: copy.cardTitle || '',
    points,
    doTitle: copy.leftTitle || '',
    doItems: copy.leftItems || [],
    avoidTitle: copy.rightTitle || '',
    avoidItems: copy.rightItems || [],
    tip: copy.strip || '',
    contact: { ...POSTER_CONTACT },
  }
}

// ทุกสตริงไทยในคลัง (ใช้ตรวจคำต่อคำในเทสต์)
export function freePoolStrings(pool) {
  return [pool.headline, pool.opening, pool.pointsTitle, ...pool.points.flatMap((p) => [p.title, p.detail]), pool.doTitle, ...pool.doItems, pool.avoidTitle, ...pool.avoidItems, pool.tip].filter(Boolean)
}

export function freeDirection(seed) {
  if (seed === null || seed === undefined || Number.isNaN(Number(seed))) return null
  return FREE_DIRECTIONS[Math.abs(Math.trunc(Number(seed))) % FREE_DIRECTIONS.length]
}

export function buildFreePosterPrompt({ title = '', caption = '', size = DEFAULT_POSTER_SIZE, seed = null } = {}) {
  const plan = cropPlan(size)
  const pool = freeTextPool({ title, caption })
  const direction = freeDirection(seed)
  const { phone, line } = pool.contact
  const textLines = [
    `- Headline (required, the biggest text): ${q(pool.headline)}${pool.keyWord ? `; you may emphasise the key word ${q(pool.keyWord)}` : ''}`,
    pool.opening ? `- Opening line (optional): ${q(pool.opening)}` : '',
    pool.points.length ? `- Key points (use 2 to ${pool.points.length}; each title may stand alone, its detail is optional)${pool.pointsTitle ? `, optional group title ${q(pool.pointsTitle)}` : ''}:\n${pool.points.map((p, i) => `  ${i + 1}. ${q(p.title)}${p.detail ? ` / detail: ${q(p.detail)}` : ''}`).join('\n')}` : '',
    pool.doItems.length ? `- What to do (optional)${pool.doTitle ? `, title ${q(pool.doTitle)}` : ''}: ${pool.doItems.map(q).join(' / ')}` : '',
    pool.avoidItems.length ? `- What to avoid (optional)${pool.avoidTitle ? `, title ${q(pool.avoidTitle)}` : ''}: ${pool.avoidItems.map(q).join(' / ')}` : '',
    pool.tip ? `- Tip (optional): ${q(pool.tip)}` : '',
    `- Contact (required, together in one small tidy area): ${q(`โทร ${phone}`)} and ${q(`LINE: ${line}`)}`,
  ].filter(Boolean)
  return [
    'DESIGNER MODE: you are the art director of this poster. Do NOT forward this brief as it is. Read it, invent your own concept, composition and visual style, then write your own detailed image_gen prompt (describe the design in English; copy every Thai string you use exactly, inside quotes) and call image_gen once. Surprise us: this poster should look clearly different from a standard stacked-card infographic unless that is truly the best idea for this content.',
    '',
    technicalFrame(plan),
    `Format: ${plan.platform}, final size ${plan.width}x${plan.height}. Every Thai text must be readable on a phone: nothing smaller than about 2% of the design height, the headline at least three times that.`,
    `Topic: ${q(pool.headline)} — an educational Facebook post from a Thai property advisory about ขายฝาก (sale with right of redemption) and จำนอง (mortgage).`,
    'Brand brief (guidance, not a template): AssetX Estate is a Thai real-estate advisory. Readers are Thai homeowners who need cash and small investors; they are cautious and want clear, honest guidance. Mood: trustworthy, modern, warm and clear, a knowledgeable friend; premium but approachable, never a loan-shark flyer. Brand colours come from the logo: navy #08213f, cyan #42c7d8, with violet and magenta in the X mark. Use any mood, medium and extra accent colours you like (light or dark, photo, illustration, 3D, typographic, hand-drawn) as long as navy or cyan appears somewhere and it feels like one brand. Thai type: a bold modern Thai display face for the headline (like Kanit, Prompt or Noto Sans Thai Black) and a clean Thai sans for the rest.',
    direction ? `Optional starting direction for this run (drop it if a better idea fits the content): ${direction.text}.` : 'Choose the concept freely.',
    `Input images: ${PLACEHOLDER_FREE_IMAGES}`,
    'Text you may put on the poster (Thai, copy exactly, each string at most once; choose only what serves your concept, less is often better; never paraphrase, shorten, merge or invent Thai text):',
    ...textLines,
    `Hard rules: no other words in any language except the strings above, the logo's own wordmark and "LINE"; the digits ${phone} and the id ${line} copied exactly; the attached logo is the only logo and is never redrawn or retyped; the black bars stay completely empty.`,
    'Avoid: prices, percentages, interest rates, any other phone number, LINE id, URL, QR code, address, personal name or deed number; Garuda, seals, stamps, government or company emblems; watermarks or AI labels; a green-and-gold loan-flyer look; villains, police or handcuffs; neon glow.',
    `MODE: free seed=${seed === null || seed === undefined ? 'none' : seed} direction=${direction ? direction.id : 'none'}`,
  ].join('\n')
}

// ภาพแนบของโหมดอิสระ: โลโก้เต็ม + รูปเจ้าของ (ถ้ามีไฟล์) · ไม่แนบเรฟคู่แข่ง (ไม่ให้ลอกโครงเดิม) · ตัวรับงานเติมตามไฟล์ที่มีจริง
export function describeFreeImages({ logo = true, presenter = false } = {}) {
  const parts = []
  let n = 0
  if (logo) {
    n += 1
    parts.push(`Image ${n} = the official AssetX Estate logo (X mark with the wordmark "AssetX Estate Co., Ltd."); place the whole image once, unchanged, wherever it suits your layout (on a white or light chip if the area behind it is dark); never redraw, recolour or retype it.`)
  }
  if (presenter) {
    n += 1
    parts.push(`Image ${n} = IDENTITY REFERENCE (optional to use): if your concept includes a person, it must be this man (same face, hairstyle, skin tone, white dress shirt) as a photoreal figure; ignore that photo's background and any text in it; no other real-looking person's face.`)
  }
  return parts.length ? parts.join(' ') : 'none attached; draw a plain white rounded chip holding a navy letter X as the logo, with no wordmark.'
}

export function fillFreeImages(prompt = '', opts = {}) {
  return String(prompt || '').replace(PLACEHOLDER_FREE_IMAGES, describeFreeImages(opts))
}

export function parseFreeModeLine(prompt = '') {
  const m = String(prompt || '').match(/^MODE:\s*free\b(.*)$/m)
  if (!m) return null
  return { seed: (m[1].match(/seed=(\d+)/) || [])[1] ? Number(m[1].match(/seed=(\d+)/)[1]) : null, direction: (m[1].match(/direction=([\w-]+)/) || [])[1] || 'none' }
}

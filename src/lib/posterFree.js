// src/lib/posterFree.js — โปสเตอร์โหมด "อิสระ": ให้ Codex เป็นอาร์ตไดเรกเตอร์ ออกแบบคอนเซปต์และการจัดวางเอง
//
// เจ้าของ 7 พ.ย. 2569 ดึก: "บอกหัวข้อและข้อความที่จะใส่ไปในภาพให้กับโคเด็กซ์ แล้วปล่อยให้โคเด็กซ์ออกแบบในสไตล์ของโคเด็กซ์เอง
// โดยมีบรีฟ มูดแอนด์โทนสไตล์ของเรา ไม่ต้องฟิกร้อยเปอร์เซ็นต์ เพื่อที่จะได้มีรูปแบบที่แตกต่างและอิสระมากกว่าเดิม" — เป็นตัวเลือกเพิ่ม คู่กับ v4 "ตามเรฟ"
// ต่างจาก v4: ไม่มี PASS-THROUGH RULE (ให้ตัวแทน Codex เขียนคำสั่งภาพเอง) · ไม่มีแผนที่โซน · ไม่แนบเรฟคู่แข่ง · ไม่บังคับกล่องคำพูด/การ์ดคู่
// สิ่งที่ยังบังคับ (ความถูกต้อง ไม่ใช่หน้าตา): แถบดำกันครอป · ข้อความไทยคัดจากโพสต์คำต่อคำ (เลือกใช้บางข้อได้) · โลโก้ไม่วาดใหม่ · เบอร์/LINE บริษัท · รายการห้าม
// 8 พ.ย. 2569: เจ้าของให้เป็นค่าเริ่มต้นแทน "ตามเรฟ" · กติกาหน้าตาข้อเดียวที่บังคับ = สมจริงแนวพรีเมียมหรูหรา ไม่ใช่การ์ตูน (เจ้าของสั่ง)
// 8 พ.ย. บ่าย: โลโก้และเบอร์/LINE ย้ายไปแถบท้ายที่ตัวรับงานวางเอง (scripts/poster-footer.ps1) — Codex เว้นแถบล่างไว้ ไม่วาดโลโก้/เบอร์เอง
import { POSTER_CONTACT } from './posterDesignSystem.js'
import { extractPosterCopyV4 } from './posterV4.js'
import { cropPlan, DEFAULT_POSTER_SIZE } from './posterSizes.js'

export const PLACEHOLDER_FREE_IMAGES = '{{FREE_IMAGES}}'

// ทิศเริ่มต้นที่แนะนำต่อรอบ (หมุนตาม seed) — เป็นแค่จุดตั้งต้น Codex ทิ้งได้ถ้าคิดแบบที่ดีกว่า · ช่วยไม่ให้ตัวแทนออกแบบซ้ำทางเดิมทุกครั้ง
// 8 พ.ย. 2569 เจ้าของ: "อยากให้ดูสมจริงไม่ใช่แนวภาพการ์ตูน บ่งบอกอัตลักษณ์ของความพรีเมี่ยมและหรูหรา" → ทุกทิศเป็นภาพถ่าย/เรนเดอร์สมจริงแนวหรู
// (ตัดสมุดจดวาดมือ · คอลลาจกระดาษ · ไดโอรามาดินปั้น · แผนที่ภาพประกอบ ออก)
// presenter: 'use' = ทิศที่มีคนเป็นจุดเด่น บังคับใส่รูปเจ้าของ (3 ใน 10 ≈ หน้าเจ้าของขึ้นราว 1 ใน 3 ของโปสเตอร์) · 'optional' = Codex เลือกเอง
// เจ้าของ 8 พ.ย.: "รูปผมจะใส่หรือไม่ใส่ก็ได้ตามที่คุณคิดว่าเหมาะสม" — บังคับทุกภาพจะดึงทุกโปสเตอร์กลับไปเป็นโครงผู้แนะนำ+การ์ดแบบเดิม
export const FREE_DIRECTIONS = [
  { id: 'luxury-cover', presenter: 'use', text: 'a luxury property-magazine cover: one cinematic portrait photograph of the advisor from the attached photo in a refined setting, the headline as the cover line, the key points as small elegant cover teasers' },
  { id: 'material-type', presenter: 'optional', text: 'a refined typographic poster set on a real luxury material (deep navy lacquer, dark marble or brushed metal) under soft studio light: the headline key word large and elegant, the key points as small fine captions' },
  { id: 'architecture-dusk', presenter: 'optional', text: 'a premium architectural photograph of a modern Thai house or condominium at blue hour with warm interior lights, the text on real frosted-glass panels' },
  { id: 'split-screen', presenter: 'optional', text: 'a split composition of two real photographs: the situation or question on one side, the clear answer or checklist on the other, divided by a thin brushed-metal line' },
  { id: 'desk-still-life', presenter: 'optional', text: 'a luxury still-life photograph on a walnut or marble desk: a real house key on a leather tag, a fountain pen and a plain closed folder, the text set beside them in clean panels' },
  { id: 'single-object', presenter: 'optional', text: 'a minimalist premium product-style photograph of one symbolic object (a house key, a sealed document envelope or a fine white architectural scale model) under dramatic studio light with generous negative space' },
  { id: 'advisor-office', presenter: 'use', text: 'a cinematic photograph of the advisor from the attached photo at work in a bright premium office or private lounge, any client seen only from behind, the text in clean overlay panels' },
  { id: 'host-explainer', presenter: 'use', text: 'the advisor from the attached photo as a photoreal host standing beside the content in a premium interior, presenting the key points with fine callout lines' },
  { id: 'dark-glass', presenter: 'optional', text: 'a dark premium look: a deep navy scene with one soft spotlight and real frosted-glass cards holding the key points, a subtle cyan rim light' },
  { id: 'aerial-estate', presenter: 'optional', text: 'an aerial drone photograph of Thai land plots or a calm upscale housing estate in soft morning light, the key points as small refined labels' },
]

const q = (s) => `"${String(s || '').trim()}"`

// แถบดำกันครอป — เหมือน v4 (ตัวรับงานตัดแถบที่เห็นจริงแล้วครอปตามสัดส่วนแพลตฟอร์ม เมื่อคำสั่งมีคำว่า "BLACK #000000 bars")
export function technicalFrame(plan) {
  const slack = Math.round((plan.cutPx || 0) * 0.45)
  const bar = (plan.cutPx || 0) + slack
  if (/top/.test(String(plan.edges || ''))) {
    const bottom = plan.sourceHeight - bar
    return `Technical frame (the ONLY fixed layout rule, keep it word for word in your image_gen prompt): the canvas is ${plan.sourceWidth}x${plan.sourceHeight} px; y 0-${bar} and y ${bottom}-${plan.sourceHeight} are two solid flat BLACK #000000 bars with absolutely nothing on them (they are cut off before posting). The whole design lives in y ${bar}-${bottom}; keep every text at least 30 px inside that zone.`
  }
  if (/left/.test(String(plan.edges || ''))) {
    return `Technical frame (the ONLY fixed layout rule, keep it word for word in your image_gen prompt): the left ${bar} px and right ${bar} px of the ${plan.sourceWidth}x${plan.sourceHeight} canvas are two solid flat BLACK #000000 bars with nothing on them (cut off before posting); keep every text at least 30 px inside the area between them.`
  }
  return `Technical frame (the ONLY fixed layout rule): ${plan.sourceWidth}x${plan.sourceHeight} canvas; keep every text at least 4% away from every edge.`
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

// แถบท้ายแบรนด์ (เจ้าของ 8 พ.ย. 2569: โลโก้ไม่เอาพื้นขาว · เบอร์/LINE ให้เป็นระเบียบและสวยกว่านี้)
// Codex ไม่วาดโลโก้/เบอร์/LINE — ตัวรับงานวางของจริงทีหลังด้วย scripts/poster-footer.ps1 (โลโก้พื้นโปร่งใส + ตัวพิมพ์ Kanit)
// สูตรความสูงแถบต้องตรงกับสคริปต์: F = min(16.5% ของกว้าง, 14% ของสูง) · ม่านไล่สีเริ่ม 1.9F จากขอบล่าง
export const FOOTER_RATIO = { width: 0.165, height: 0.14, fade: 1.9 }

export function footerShare({ width, height } = {}) {
  const F = Math.min(width * FOOTER_RATIO.width, height * FOOTER_RATIO.height)
  const pct = (v) => Math.ceil(Number(((v / height) * 100).toFixed(3))) // toFixed ตัดเศษทศนิยมลอย (14.000…2 ไม่ให้ปัดเป็น 15)
  return { band: pct(F), fade: pct(F * FOOTER_RATIO.fade) }
}

export function footerContactLines(contact = POSTER_CONTACT) {
  return [`โทร ${contact.phone}`, `LINE: ${contact.line}`]
}

export function freeDirection(seed) {
  if (seed === null || seed === undefined || Number.isNaN(Number(seed))) return null
  return FREE_DIRECTIONS[Math.abs(Math.trunc(Number(seed))) % FREE_DIRECTIONS.length]
}

export function buildFreePosterPrompt({ title = '', caption = '', size = DEFAULT_POSTER_SIZE, seed = null } = {}) {
  const plan = cropPlan(size)
  const pool = freeTextPool({ title, caption })
  const direction = freeDirection(seed)
  const footer = footerShare(plan)
  const textLines = [
    `- Headline (required, the biggest text): ${q(pool.headline)}${pool.keyWord ? `; you may emphasise the key word ${q(pool.keyWord)}` : ''}`,
    pool.opening ? `- Opening line (optional): ${q(pool.opening)}` : '',
    pool.points.length ? `- Key points (use 2 to ${pool.points.length}; each title may stand alone, its detail is optional)${pool.pointsTitle ? `, optional group title ${q(pool.pointsTitle)}` : ''}:\n${pool.points.map((p, i) => `  ${i + 1}. ${q(p.title)}${p.detail ? ` / detail: ${q(p.detail)}` : ''}`).join('\n')}` : '',
    pool.doItems.length ? `- What to do (optional)${pool.doTitle ? `, title ${q(pool.doTitle)}` : ''}: ${pool.doItems.map(q).join(' / ')}` : '',
    pool.avoidItems.length ? `- What to avoid (optional)${pool.avoidTitle ? `, title ${q(pool.avoidTitle)}` : ''}: ${pool.avoidItems.map(q).join(' / ')}` : '',
    pool.tip ? `- Tip (optional): ${q(pool.tip)}` : '',
  ].filter(Boolean)
  return [
    'DESIGNER MODE: you are the art director of this poster. Do NOT forward this brief as it is. Read it, invent your own concept, composition and camera, then write your own detailed image_gen prompt (describe the design in English; copy every Thai string you use exactly, inside quotes) and call image_gen once. Surprise us: this poster should look clearly different from a standard stacked-card infographic unless that is truly the best idea for this content, while staying photoreal and premium.',
    '',
    technicalFrame(plan),
    `Format: ${plan.platform}, final size ${plan.width}x${plan.height}. Every Thai text must be readable on a phone: nothing smaller than about 2% of the design height, the headline at least three times that.`,
    `Brand footer (fixed, keep it word for word in your image_gen prompt): after rendering we add our own dark-navy footer with the real logo and contact details over the bottom ${footer.band}% of the design area, with a soft dark fade starting ${footer.fade}% from the bottom. Keep the bottom ${footer.band}% as plain continuing background (scene, floor, wall, water or material) with no text, faces, hands or key objects, and keep every text and the main subject above the bottom ${footer.fade}%. Do NOT draw any logo, brand mark, company name, phone number, LINE id or contact text anywhere.`,
    `Topic: ${q(pool.headline)} — an educational Facebook post from a Thai property advisory about ขายฝาก (sale with right of redemption) and จำนอง (mortgage).`,
    'Brand brief (guidance, not a template): AssetX Estate is a Thai real-estate advisory. Readers are Thai homeowners who need cash and investors; they are cautious and want clear, honest guidance. Identity: premium and luxurious, like a private bank or a luxury-property developer; trustworthy, calm, warm and clear; never a loan-shark flyer.',
    'Visual style (required, the one fixed look rule): photoreal and realistic, never cartoon. Use real photography or photoreal renders of real places, people and materials (modern Thai architecture, refined interiors, marble, walnut, leather, glass, brushed metal), cinematic natural or studio light with soft real shadows, shallow depth of field where it helps, a restrained palette and generous negative space. Icons, if any, are thin, fine-line and minimal. Composition, camera angle, crop and layout are entirely yours.',
    'Colours: the logo\'s navy #08213f and cyan #42c7d8 lead; violet and magenta from the X mark only as small accents; add warm luxury neutrals (ivory, champagne, charcoal, walnut) as you like. Thai type: a refined modern Thai face for the headline (like Kanit, Prompt or Noto Sans Thai in SemiBold or Bold, never a comic face) and a clean Thai sans for the rest, with calm generous spacing.',
    direction ? `Optional starting direction for this run (drop it if a better idea fits the content): ${direction.text}.` : 'Choose the concept freely.',
    `Input images: ${PLACEHOLDER_FREE_IMAGES}`,
    'Text you may put on the poster (Thai, copy exactly, each string at most once; choose only what serves your concept, less is often better; never paraphrase, shorten, merge or invent Thai text):',
    ...textLines,
    'Hard rules: no other words, letters or numbers in any language except the strings above; no logo or brand mark of any kind (the footer adds the real one); the black bars stay completely empty.',
    'Avoid: prices, percentages, interest rates, any other phone number, LINE id, URL, QR code, address, personal name or deed number; Garuda, seals, stamps, government or company emblems; watermarks or AI labels; a green-and-gold loan-flyer look; villains, police or handcuffs; neon glow; cartoon or comic style, flat vector illustration, hand-drawn doodles or marker sketches, clay or toy-like 3D, paper collage, stickers, chunky or emoji-style icons, sparkles, starbursts, halftone dots and candy colours.',
    `MODE: free seed=${seed === null || seed === undefined ? 'none' : seed} direction=${direction ? direction.id : 'none'} presenter=${direction?.presenter === 'use' ? 'use' : 'optional'} footer=brand`,
  ].join('\n')
}

// ภาพแนบของโหมดอิสระ: รูปเจ้าของ (ถ้ามีไฟล์) · ไม่แนบเรฟคู่แข่ง (ไม่ให้ลอกโครงเดิม) · ตัวรับงานเติมตามไฟล์ที่มีจริง
// footer=brand (ตั้งแต่ 8 พ.ย. 2569) → ไม่แนบโลโก้ให้ Codex (แถบท้ายวางโลโก้จริงเอง) · งานเก่าที่ไม่มี footer= ยังแนบโลโก้เต็มแบบเดิม (logo: true)
// usePresenter = บรรทัด MODE บอก presenter=use (ทิศที่มีคนเป็นจุดเด่น) → บังคับใส่รูปเจ้าของ · ไม่มีไฟล์รูป → ไม่ใส่คนเลย (ไม่ให้วาดคนแปลกหน้า)
const NO_ADVISOR = 'No advisor photo is attached: leave people out of this design and drop the advisor from the starting direction.'
const OTHER_PEOPLE = 'any other person only from behind or out of focus, never another clear face'

export function describeFreeImages({ logo = true, presenter = false, usePresenter = false, footer = false } = {}) {
  if (footer) {
    if (presenter) {
      return usePresenter
        ? `Image 1 = THE ADVISOR (required in this design): show this man as the advisor, a photoreal figure with the same face, hairstyle, skin tone and white dress shirt, lit to match your scene; you choose his size, crop, pose and position; ignore that photo's background and any text in it; ${OTHER_PEOPLE}.`
        : `Image 1 = IDENTITY REFERENCE (optional to use): if your concept includes a person, it must be this man (same face, hairstyle, skin tone, white dress shirt) as a photoreal figure; ignore that photo's background and any text in it; ${OTHER_PEOPLE}.`
    }
    return usePresenter ? `none attached. ${NO_ADVISOR}` : 'none attached.'
  }
  const parts = []
  let n = 0
  if (logo) {
    n += 1
    parts.push(`Image ${n} = the official AssetX Estate logo (X mark with the wordmark "AssetX Estate Co., Ltd."); place the whole image once, unchanged, wherever it suits your layout (on a white or light chip if the area behind it is dark); never redraw, recolour or retype it.`)
  } else {
    parts.push('No logo is attached: draw a plain white rounded chip holding a navy letter X as the logo, with no wordmark.')
  }
  if (presenter) {
    n += 1
    parts.push(usePresenter
      ? `Image ${n} = THE ADVISOR (required in this design): show this man as the advisor, a photoreal figure with the same face, hairstyle, skin tone and white dress shirt, lit to match your scene; you choose his size, crop, pose and position; ignore that photo's background and any text in it; ${OTHER_PEOPLE}.`
      : `Image ${n} = IDENTITY REFERENCE (optional to use): if your concept includes a person, it must be this man (same face, hairstyle, skin tone, white dress shirt) as a photoreal figure; ignore that photo's background and any text in it; ${OTHER_PEOPLE}.`)
  } else if (usePresenter) {
    parts.push(NO_ADVISOR)
  }
  if (n === 0 && !usePresenter) return 'none attached; draw a plain white rounded chip holding a navy letter X as the logo, with no wordmark.'
  return parts.join(' ')
}

export function fillFreeImages(prompt = '', opts = {}) {
  return String(prompt || '').replace(PLACEHOLDER_FREE_IMAGES, describeFreeImages(opts))
}

export function parseFreeModeLine(prompt = '') {
  const m = String(prompt || '').match(/^MODE:\s*free\b(.*)$/m)
  if (!m) return null
  const seed = (m[1].match(/seed=(\d+)/) || [])[1]
  return {
    seed: seed ? Number(seed) : null,
    direction: (m[1].match(/direction=([\w-]+)/) || [])[1] || 'none',
    presenter: (m[1].match(/presenter=(\w+)/) || [])[1] === 'use' ? 'use' : 'optional',
    footer: (m[1].match(/footer=(\w+)/) || [])[1] === 'brand' ? 'brand' : 'none',
  }
}

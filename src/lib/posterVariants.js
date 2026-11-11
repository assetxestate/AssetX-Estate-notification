// src/lib/posterVariants.js — "ชุดสไตล์" ของโปสเตอร์ v4: ให้แต่ละโพสต์ (และการกด "สร้างโปสเตอร์ใหม่" แต่ละครั้ง) ได้หน้าตาต่างกัน
//
// เจ้าของดูโปสเตอร์ #20 (7 พ.ย. 2569 ค่ำ) แล้วบอกว่า "คล้ายกับรูปคอนเทนต์ก่อนหน้าเลย ช่วยทำพร้อมต์ให้หลากหลายและอิสระกว่านี้"
// — v4 เดิมล็อกทุกอย่างไว้ชุดเดียว (ผู้แนะนำขวา · เหลือง/ชมพู · พาดหัวนูน 3D · ประกาย+ลูกศร · ฉากโต๊ะทำงาน · เรฟ 3 ใบเดิม) ทุกโพสต์จึงเหมือนกัน
// ชุดสไตล์ = การจัดวาง × ชุดสี × สไตล์พาดหัว × ท่าผู้แนะนำ × ลูกเล่นตกแต่ง × สไตล์การ์ด × สื่อ × ฉาก เลือกจาก seed แบบกำหนดได้ (hash ของเลขโพสต์ + ลำดับงานของโพสต์)
// seed = null → ชุดแรกทุกมิติ = หน้าตา v4 เดิมเป๊ะ (เทสต์เดิมยังใช้) · สิ่งที่ไม่เปลี่ยนตามชุด: แถบดำกันครอป · โลโก้ · ข้อความคำต่อคำ · ขนาดตัวอักษร · แถบล่างเบอร์/LINE
import { POSTER_CONTACT } from './posterDesignSystem.js'

// การจัดวาง — แต่ละแบบบอกตำแหน่งผู้แนะนำ ลำดับบล็อก และข้อความแผนที่โซน (ส่วนแถบดำ โลโก้ แถบล่าง คงที่ทุกแบบ)
export const COMPOSITIONS = {
  'presenter-right': { label: 'ผู้แนะนำขวา (แบบเรฟ)', refs: 'layout', cutout: 'from head to waist' },
  'numbered-steps': { label: 'ไทม์ไลน์เลขข้อ ผู้แนะนำขวา', refs: 'layout', cutout: 'from head to waist' },
  'presenter-left': { label: 'ผู้แนะนำซ้าย พาดหัวขวา', refs: 'layout', cutout: 'from head to waist' },
  'hero-scene': { label: 'ฉากใหญ่พาดกลาง ผู้แนะนำเล็ก', refs: 'finish', cutout: 'from head to chest' },
  'presenter-bottom': { label: 'เนื้อหาเต็มกว้าง ผู้แนะนำมุมล่างขวา', refs: 'finish', cutout: 'from head to chest' },
}

// โครงเนื้อหา → การจัดวางที่เข้ากัน เรียงจากที่เหมาะที่สุด (seed = null ได้ตัวแรก)
const COMPOSITIONS_BY_LAYOUT = {
  steps: ['presenter-right', 'numbered-steps', 'presenter-left', 'hero-scene', 'presenter-bottom'],
  checklist: ['presenter-right', 'presenter-left', 'hero-scene', 'presenter-bottom', 'numbered-steps'],
  qa: ['presenter-left', 'presenter-right', 'hero-scene', 'presenter-bottom'],
  compare: ['presenter-bottom', 'hero-scene', 'presenter-right', 'presenter-left'],
  warning: ['presenter-right', 'hero-scene', 'presenter-left', 'presenter-bottom'],
  explain: ['hero-scene', 'presenter-right', 'presenter-left', 'presenter-bottom', 'numbered-steps'],
}

// ชุดสี — ฐานน้ำเงิน/ไซยานของแบรนด์ + สีสด 2 สี (เจ้าของยอมให้ 1–2 สี) · light = พื้นสว่าง ตัวอักษรน้ำเงิน (ต่างจากชุดอื่นชัด)
export const PALETTES = {
  'sun-coral': { label: 'เหลือง-ชมพู บนน้ำเงิน', light: false, base: 'navy #08213f and cyan #42c7d8 are the base; white and off-white #f4f7fb cards', a1: { name: 'sunshine yellow', hex: '#ffd43b' }, a2: { name: 'coral-pink', hex: '#ff5c7a' }, shadow: 'Deep violet #4b2a82 only as shadow tint inside the photo' },
  'tangerine-magenta': { label: 'ส้ม-บานเย็น บนน้ำเงิน', light: false, base: 'navy #08213f and cyan #42c7d8 are the base; white and off-white #f4f7fb cards', a1: { name: 'tangerine orange', hex: '#ff7a1a' }, a2: { name: 'hot magenta', hex: '#ff2f92' }, shadow: 'Deep navy #041426 only as shadow tint inside the photo' },
  'lemon-violet': { label: 'มะนาว-ม่วง บนน้ำเงิน', light: false, base: 'navy #08213f and cyan #42c7d8 are the base; white and off-white #f4f7fb cards', a1: { name: 'lemon yellow', hex: '#fff04d' }, a2: { name: 'electric violet', hex: '#8b5cf6' }, shadow: 'Deep violet #4b2a82 only as shadow tint inside the photo' },
  'light-sun-coral': { label: 'พื้นสว่าง เหลือง-ชมพู', light: true, base: 'an off-white #eef6fb background with navy #08213f text and cyan #42c7d8 lines is the base; pure white cards with a 1 px pale-cyan border', a1: { name: 'sunshine yellow', hex: '#ffd43b' }, a2: { name: 'coral-pink', hex: '#ff5c7a' }, shadow: 'Soft cyan-grey shadows only' },
  'amber-scarlet': { label: 'อำพัน-แดงส้ม บนน้ำเงินเข้ม', light: false, base: 'deep navy #061a33 and cyan #42c7d8 are the base; white and off-white #f4f7fb cards', a1: { name: 'amber', hex: '#ffb020' }, a2: { name: 'scarlet', hex: '#ff4747' }, shadow: 'Deep navy #041426 only as shadow tint inside the photo' },
}

// สไตล์พาดหัว — keyword = คำเน้น · rest = ส่วนที่เหลือ (ใช้ {a1}/{a2}/{rest} เป็นที่ว่าง)
export const HEADLINE_STYLES = {
  'extrude-3d': { label: 'นูน 3D', keyword: 'in {a1} with a navy stroke and solid navy 3D extrusion', rest: 'in {rest} with the same stroke and extrusion', solo: 'in {rest} with a navy stroke and solid navy 3D extrusion' },
  'brush-highlight': { label: 'ไฮไลต์พู่กัน', keyword: 'flat extra-bold in navy sitting on a rough {a1} brush-stroke highlight', rest: 'flat extra-bold in {rest} with one soft navy drop shadow, no extrusion', solo: 'flat extra-bold in {rest} with one soft navy drop shadow, no extrusion' },
  'sticker-badge': { label: 'สติกเกอร์เอียง', keyword: 'in navy inside a tilted (-4 degrees) rounded {a1} sticker badge with a white border and a hard navy shadow', rest: 'flat extra-bold in {rest} with a soft navy drop shadow', solo: 'flat extra-bold in {rest} with a soft navy drop shadow' },
  'outline-shadow': { label: 'ขอบขาวเงาแข็ง', keyword: 'in {a1} with a thick white outline and a hard offset navy shadow (no extrusion)', rest: 'in {rest} with the same white outline and hard shadow', solo: 'in {rest} with a thick white outline and a hard offset navy shadow (no extrusion)' },
  'underline-swash': { label: 'ขีดเส้นใต้วาดมือ', keyword: 'in {a1} with a hand-drawn {a2} underline swash beneath it', rest: 'rounded extra-bold in {rest} with a soft drop shadow', solo: 'rounded extra-bold in {rest} with a hand-drawn {a2} underline swash under the first line' },
}

export const PRESENTER_POSES = {
  point: { label: 'ชี้คำเน้น', text: 'one hand pointing at the headline key word' },
  'arms-crossed': { label: 'กอดอก', text: 'arms crossed, relaxed confident posture' },
  folder: { label: 'ถือแฟ้ม', text: 'holding a navy document folder against the chest with one hand' },
  'present-palm': { label: 'ผายมือ', text: 'one open palm presenting the main card' },
  'thumbs-up': { label: 'ยกนิ้วโป้ง', text: 'one hand giving a thumbs-up' },
  tablet: { label: 'ถือแท็บเล็ต', text: 'holding a tablet whose screen is plain blank cyan (no readable content)' },
}

// ลูกเล่นตกแต่ง — "exactly these" ในคำสั่ง (กันโมเดลเติมเอง)
export const DECORS = {
  'sparkle-arrow': { label: 'ประกาย+ลูกศร', text: 'one {a1} sparkle and one small cyan arrow beside the headline key word pointing at the ribbon; one 2 px cyan hairline on top of the bottom band' },
  'geo-confetti': { label: 'คอนเฟตตีเรขาคณิต', text: 'a few flat {a1} and {a2} geometric confetti shapes (circles, triangles, short bars) only around the headline block and above the bottom band; a faint dotted grid in the backdrop corners' },
  'paper-cut': { label: 'เปเปอร์คัต', text: 'paper-cut layering: one {a1} and one cyan offset rounded shape behind the headline block, soft paper shadows under every card' },
  'sticker-halftone': { label: 'ฮาล์ฟโทน+สตาร์เบิร์สต์', text: 'a small {a2} halftone-dot patch behind the headline key word and one {a1} starburst sticker at the end of the ribbon' },
  'ring-stripes': { label: 'วงแหวน+ลายทแยง', text: 'two thin cyan ring outlines near the headline and a {a1} diagonal-stripe corner patch behind the presenter\'s shoulder' },
}

export const CARD_STYLES = {
  'white-pill': { label: 'การ์ดขาวหัวพิล', text: 'white rounded cards, each with a coloured header pill at its top-left when the card has a title, and a soft navy shadow' },
  glass: { label: 'การ์ดกระจกฝ้า', text: 'frosted-glass cards (white at 85% opacity with a 1 px pale-cyan border), each with a coloured header pill at its top-left when the card has a title' },
  'left-stripe': { label: 'การ์ดแถบข้าง', text: 'white rounded cards with a thick coloured left border stripe and, when the card has a title, a coloured header tab at the top-left instead of a pill' },
  'tilted-sticker': { label: 'การ์ดสติกเกอร์เอียง', text: 'white sticker-style cards with a thick white border, rotated by about 1–2 degrees alternately, each with a coloured header pill at its top-left when the card has a title' },
}

// สื่อ — ภาพถ่ายตัดต่อเป็นรสนิยมหลักของเจ้าของ
export const MEDIA = {
  'photo-composite': { label: 'ภาพถ่ายตัดต่อ', text: 'photoreal advertising composite with flat vector UI on top' },
  illustrated: { label: 'ภาพประกอบแฟลต', text: 'flat vector illustration backdrop (clean shapes, no outlines) with a photoreal presenter cutout and flat vector UI on top' },
  'soft-3d': { label: '3D เคลย์', text: 'soft matte 3D clay-render backdrop props (rounded, pastel-lit) with a photoreal presenter cutout and flat vector UI on top' },
}
// 8 พ.ย. 2569 เจ้าของ: "อยากให้ดูสมจริงไม่ใช่แนวภาพการ์ตูน บ่งบอกอัตลักษณ์ของความพรีเมี่ยมและหรูหรา" → ตัวหมุนเหลือภาพถ่ายตัดต่ออย่างเดียว
// (ภาพประกอบแฟลตกับ 3D เคลย์ยังอยู่ในตารางให้เรียกตรงได้ แต่ไม่ถูกสุ่มแล้ว)
const MEDIA_ORDER = ['photo-composite']

// ฉากตามหัวข้อ (ตรวจคำในโพสต์) × 2 ตัวเลือก
export const SCENES = {
  land: ['a sunny Thai land plot with survey pins and a white rope boundary, trees and blue sky', 'an aerial-angle view of a green land parcel with a dirt access road and distant hills'],
  condo: ['a modern condo balcony overlooking the city at golden hour with a small potted plant', 'a bright condo lobby with a reception counter and glass doors, no readable signs'],
  house: ['a modern Thai single house exterior with a small garden at mid-morning', 'a cozy Thai living room with a sofa, a window and daylight'],
  office: ['a land office service counter with queue chairs and a document tray, no readable signs', 'a consultant desk with a stamp pad, folders and a plant, no readable text'],
  desk: ['bright Thai home-office desk beside a window at mid-morning, light oak desktop, sheer curtains, a small modern Thai house model and a navy clipboard with a plain blank contract at the bottom-left corner behind the cards', 'a tidy consultant desk with a laptop (blank screen), a house key with a plain tag and a coffee cup, soft afternoon light'],
}

export function sceneTopic(text = '') {
  const t = String(text || '')
  if (/คอนโด|ห้องชุด/.test(t)) return 'condo'
  if (/ที่ดินเปล่า|แปลงที่ดิน|\d\s*ไร่|ตารางวา|ผังเมือง|ทางเข้าออก|ซื้อที่ดิน|ขายที่ดิน/.test(t)) return 'land'
  if (/สำนักงานที่ดิน|จดทะเบียน|ไถ่ถอน/.test(t)) return 'office'
  if (/บ้าน|ทาวน์โฮม|ที่อยู่อาศัย/.test(t)) return 'house'
  return 'desk'
}

// hash จำนวนเต็ม 32 บิต (mulberry-style) — เลขโพสต์ที่เป็นพหุคูณของ 5 จะไม่ทำให้ทุกมิติเป็น 0 เหมือนใช้ seed ตรง ๆ
function hash32(n) {
  let x = (Number(n) >>> 0) + 0x6d2b79f5
  x = Math.imul(x ^ (x >>> 15), x | 1)
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
  return (x ^ (x >>> 14)) >>> 0
}

// seed ของงานหนึ่งชิ้น: เลขโพสต์ (หรือ hash ของ post_key ถ้าไม่มีเลข) + ลำดับงานของโพสต์นั้น (0 = งานแรก) → สร้างใหม่ครั้งถัดไปได้ชุดใหม่
export function posterSeed({ contentNo = null, postKey = '', jobIndex = 0 } = {}) {
  const no = Number.isInteger(contentNo) && contentNo > 0 ? contentNo : Array.from(String(postKey || '')).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return hash32(no * 1000 + (Number(jobIndex) || 0)) % 1000000
}

const pick = (seed, dim, keys) => keys[seed === null ? 0 : hash32(seed * 17 + dim) % keys.length]

// เลือกชุดสไตล์ — seed = null คือชุดแรกทุกมิติ (หน้าตา v4 เดิม) · ผลเป็น object ที่ posterV4.js ใช้เขียนคำสั่ง
export function pickPosterVariant({ layout = 'steps', seed = null, text = '' } = {}) {
  const compositions = COMPOSITIONS_BY_LAYOUT[layout] || COMPOSITIONS_BY_LAYOUT.explain
  const s = seed === null || seed === undefined || Number.isNaN(Number(seed)) ? null : Number(seed) >>> 0
  const compositionId = pick(s, 1, compositions)
  const paletteId = pick(s, 2, Object.keys(PALETTES))
  const headlineId = pick(s, 3, Object.keys(HEADLINE_STYLES))
  const poseId = pick(s, 4, Object.keys(PRESENTER_POSES))
  const decorId = pick(s, 5, Object.keys(DECORS))
  const cardId = pick(s, 6, Object.keys(CARD_STYLES))
  const mediumId = pick(s, 7, MEDIA_ORDER)
  // seed = null → ฉากโต๊ะทำงานแบบ v4 เดิม · มี seed → ฉากตามหัวข้อของโพสต์
  const topic = s === null ? 'desk' : sceneTopic(text)
  const sceneIndex = s === null ? 0 : hash32(s * 17 + 8) % SCENES[topic].length
  const composition = COMPOSITIONS[compositionId]
  const palette = PALETTES[paletteId]
  const fill = (str) => String(str).replace(/\{a1\}/g, palette.a1.name).replace(/\{a2\}/g, palette.a2.name).replace(/\{rest\}/g, palette.light ? 'solid navy' : 'white-to-pale-cyan')
  const headline = HEADLINE_STYLES[headlineId]
  return {
    seed: s,
    id: `${compositionId}/${paletteId}/${headlineId}/${poseId}/${decorId}/${cardId}/${mediumId}/${topic}-${sceneIndex + 1}`,
    label: [composition.label, palette.label, `พาดหัว${headline.label}`, PRESENTER_POSES[poseId].label, DECORS[decorId].label, CARD_STYLES[cardId].label, MEDIA[mediumId].label, `ฉาก ${topic} ${sceneIndex + 1}`].join(' · '),
    compositionId,
    composition,
    paletteId,
    palette,
    headlineStyle: { id: headlineId, keyword: fill(headline.keyword), rest: fill(headline.rest), solo: fill(headline.solo) },
    pose: { id: poseId, text: PRESENTER_POSES[poseId].text },
    decor: { id: decorId, text: fill(DECORS[decorId].text) },
    cards: { id: cardId, text: CARD_STYLES[cardId].text },
    medium: { id: mediumId, text: MEDIA[mediumId].text },
    scene: { topic, index: sceneIndex, text: SCENES[topic][sceneIndex] },
    refsMode: composition.refs,
    contact: { ...POSTER_CONTACT },
  }
}

// บรรทัดท้ายคำสั่งให้ตัวรับงานอ่าน (ASCII ล้วน — บรรทัดนี้ถูกส่งถึงโมเดลภาพด้วย)
export function variantLine(variant) {
  return `VARIANT: seed=${variant.seed === null ? 'default' : variant.seed} set=${variant.id} refs=${variant.refsMode}`
}

export function parseVariantLine(prompt = '') {
  const line = String(prompt || '').match(/^VARIANT:\s*(.+)$/m)
  if (!line) return { seed: 0, set: '', refsMode: 'layout' }
  const seed = (line[1].match(/seed=(\d+)/) || [])[1]
  return { seed: seed ? Number(seed) : 0, set: (line[1].match(/set=(\S+)/) || [])[1] || '', refsMode: (line[1].match(/refs=(\w+)/) || [])[1] || 'layout' }
}

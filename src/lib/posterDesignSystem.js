// ระบบออกแบบโปสเตอร์ AssetX (v2 · 7 พ.ย. 2569) — ใช้ร่วมกันทั้งคิวสร้างภาพบนคอมสำนักงาน (server/marketing-image-jobs.js) บรีฟรูปบนหน้าเว็บ (MarketingPage) และทาง OpenAI API (server/marketing-image.js)
// ถอดจากตัวอย่างโปสเตอร์ 8 ชิ้นที่เจ้าของส่งให้ 7 พ.ย. 2569 (อินโฟกราฟิกอสังหา/ขายฝากแบบไทย: พาดหัวใหญ่มีขอบ · ริบบิ้นปัดพู่กัน · ฉากคัตเอาต์สมจริง · การ์ดเนื้อหาพร้อมไอคอน/ตัวเลข/เช็กลิสต์ · ผู้แนะนำชี้ไปที่เนื้อหา · แถบติดต่อด้านล่าง)
// แต่คงมู้ดแอนด์โทนของเรา: น้ำเงินเข้ม-ฟ้าไซยาน-ม่วง-ส้มอมชมพูจากโลโก้ ไม่ใช่เขียว-ทองแบบเพจเงินกู้ · ข้อความทุกคำบนภาพต้องมาจากโพสต์จริง (ห้ามแต่ง)
export const POSTER_PALETTE = 'AssetX palette (from the logo): midnight navy #08213f and cyan/teal #42c7d8 as the two primary colors, deep violet #4b2a82 for depth and shadows, coral-orange #f26b4f as ONE small warm accent, clean white and off-white #f4f7fb for cards. Never use the green-and-gold loan-shop look, metallic gold bars, dominant red, or generic high-saturation finance-ad colors.'

export const POSTER_DESIGN_SYSTEM = [
  'ASSETX POSTER DESIGN SYSTEM (follow every line):',
  'Mood: trustworthy modern property advisory, premium but friendly, bright daylight, a hi-tech navy-and-cyan brand identity.',
  POSTER_PALETTE,
  'Typography: the headline is a very large bold Thai display face (a geometric Thai sans such as Kanit or Prompt), white with a thin navy outline and a soft navy drop shadow, up to two lines, with exactly one key word highlighted in cyan or coral. Under it a short sub-line sits on a cyan brush-stroke ribbon in navy text. Section titles are small navy pills with a cyan icon circle. Card text is a clean Thai sans large enough to read on a phone (body text at least 28 px at 1080 px width).',
  'Layout zones from top to bottom: (1) headline and ribbon in the top 25-30%; (2) a hero band with ONE photoreal cutout scene that matches the topic - a modern Thai house, an open land plot with boundary pegs, a plain generic title-deed document, a pen signing a contract, coin stacks, or a calm consultation desk - with real depth and daylight; (3) ONE white rounded content card (corner radius about 24 px, soft shadow) that holds the structure of the post - this card is the most important part of the poster; (4) an optional small coral callout for a warning or a key reminder; (5) a full-width navy bottom band with a cyan CTA pill in navy text, the brand name AssetX Estate and the attached logo.',
  'Optional advisor figure: a friendly generic Thai advisor in a navy blazer may stand on the right third pointing at the card, never covering any text; not a real or recognisable person, no name.',
  'Icons: flat duotone navy-and-cyan line icons inside circles (document, house, land plot, calendar, coins, shield, check mark, map pin, handshake, magnifier). Numbered items use navy circles with a cyan ring. Checklist items use cyan check circles.',
  'Finish: layered composition with one consistent light source, subtle cyan glow on accents, light bokeh, no element overlapping another, generous spacing, 5% safe margins, everything readable at phone size.',
].join('\n')

// โครงการ์ดเนื้อหาตามโครงของโพสต์ (ตัวอย่างของเจ้าของ: ขั้นตอนมีเลข · ถาม-ตอบ · เทียบสองคอลัมน์ · เตือนภัย · เช็กลิสต์)
const LAYOUTS = {
  steps: 'Content card = numbered steps: copy the numbered lines from the post in order (3 to 6 items, each shortened to its first clause of at most 7 Thai words), navy number circles with a cyan ring, one small icon per step.',
  qa: 'Content card = question and answer pairs: copy 2 or 3 "ถาม:" lines and the first clause of each "ตอบ:" from the post; questions in navy pills, answers as plain text beneath each.',
  compare: 'Content card = two columns side by side for the two things the post compares, each titled in a navy pill with its own icon, 3 or 4 short rows per column copied from the post, a thin cyan divider between the columns.',
  warning: 'Content card = warning checklist: a coral "ข้อควรระวัง" callout on top, then 3 to 5 short lines copied from the post with cyan check circles; the hero scene shows a plain document being inspected - no villains, no police, no real people.',
  checklist: 'Content card = checklist: 3 to 6 short lines copied from the post, each with a cyan check circle and a small icon.',
  explain: 'Content card = three key points: 3 short lines copied from the post (the first clause of each key sentence), each with a navy number circle and a small icon.',
}

export const POSTER_LAYOUTS = Object.keys(LAYOUTS)

export function pickPosterLayout(caption = '') {
  const t = String(caption || '')
  if (/^(ถาม|ตอบ)\s*[:：]/m.test(t)) return 'qa'
  if (/\bvs\.?\b|ต่างกันอย่างไร|ต่างกันยังไง|เปรียบเทียบ|แบบไหนดีกว่า|กับ.{1,20}ต่างกัน/i.test(t)) return 'compare'
  if (/มิจฉาชีพ|หลอก|โกง|ปลอมแปลง|โฉนดปลอม|แก๊ง|เตือนภัย/.test(t)) return 'warning'
  const numbered = (t.match(/^\s*\d{1,2}[.)]\s/gm) || []).length
  if (numbered >= 2) return 'steps'
  if (/เช็ก|เช็ค|ตรวจสอบ|ต้องเตรียม|เตรียม/.test(t) && (/^\s*[-•✅✔☑]\s/m.test(t) || t.split('\n').filter(Boolean).length >= 4)) return 'checklist'
  return 'explain'
}

export function posterLayoutInstruction(layout) {
  return LAYOUTS[layout] || LAYOUTS.explain
}

// กติกาข้อความบนภาพที่ใช้ซ้ำทุกทาง — ทุกคำต้องมาจากโพสต์ · สะกดผิดไม่ได้ · ไม่มีข้อมูลที่ไม่ได้ให้
export const POSTER_TEXT_RULES = [
  'Thai text must be spelled exactly as given. Use fewer words rather than risk a misspelled word.',
  'Every word on the poster must come from the given headline, sub-line, card lines or CTA. Do not add punctuation that is not in the given text: no trailing periods, no extra quotation marks.',
  'Do not add phone numbers, LINE IDs, URLs, deed numbers, addresses, people\'s names, prices, interest rates or percentages unless they appear in the HEADLINE.',
  'No Garuda, national emblem, government seals or official logos. Draw any land title deed as a plain generic document without emblems or numbers.',
  'No other company names, logos or watermarks. No "AI" label of any kind.',
  'No promises of guaranteed approval, instant cash or guaranteed returns.',
]

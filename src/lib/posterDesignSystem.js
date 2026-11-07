// ระบบออกแบบโปสเตอร์ AssetX (v2 · 7 พ.ย. 2569) — ใช้ร่วมกันทั้งคิวสร้างภาพบนคอมสำนักงาน (server/marketing-image-jobs.js) บรีฟรูปบนหน้าเว็บ (MarketingPage) และทาง OpenAI API (server/marketing-image.js)
// ถอดจากตัวอย่างโปสเตอร์ 8 ชิ้นที่เจ้าของส่งให้ 7 พ.ย. 2569 (อินโฟกราฟิกอสังหา/ขายฝากแบบไทย: พาดหัวใหญ่มีขอบ · ริบบิ้นปัดพู่กัน · ฉากคัตเอาต์สมจริง · การ์ดเนื้อหาพร้อมไอคอน/ตัวเลข/เช็กลิสต์ · ผู้แนะนำชี้ไปที่เนื้อหา · แถบติดต่อด้านล่าง)
// แต่คงมู้ดแอนด์โทนของเรา: น้ำเงินเข้ม-ฟ้าไซยาน-ม่วง-ส้มอมชมพูจากโลโก้ ไม่ใช่เขียว-ทองแบบเพจเงินกู้ · ข้อความทุกคำบนภาพต้องมาจากโพสต์จริง (ห้ามแต่ง)
export const POSTER_PALETTE = 'AssetX palette (from the logo): midnight navy #08213f and cyan/teal #42c7d8 as the two primary colors, deep violet #4b2a82 for depth and shadows, coral-orange #f26b4f as ONE small warm accent, clean white and off-white #f4f7fb for cards. Never use the green-and-gold loan-shop look, metallic gold bars, dominant red, or generic high-saturation finance-ad colors.'

// v3 (7 พ.ย. 2569 บ่าย) — เจ้าของดูภาพทดสอบ v2 แล้วติว่า "ไม่สะดุดตา ไม่มีจุดโฟกัส องค์ประกอบใหญ่เทอะทะ โลโก้วางไม่เป็นมืออาชีพ"
// สิ่งที่ตัวอย่าง 8 ภาพมีแต่ v2 ไม่มี: ผู้แนะนำตัวใหญ่ (6 ใน 8 ภาพ) ซ้อนทับโซนพาดหัว/การ์ด · พาดหัว 3D เอียง เน้นคำด้วยสีต่าง · การ์ดหลายใบ ตัวหนังสือเล็ก หนาแน่น มีไอคอนเยอะ
// · กลุ่มภาพถ่ายซ้อนชั้น (บ้าน+เอกสาร+เหรียญ) · ของตกแต่งเล็ก ๆ (ลูกศร ประกาย) · โลโก้เล็กที่มุมบน ไม่ใช่ในแถบล่าง · แถบล่างบาง
export const POSTER_DESIGN_SYSTEM = [
  'ASSETX POSTER DESIGN SYSTEM v3 (follow every line; this is a dense Thai infographic poster, not a minimal layout):',
  'Mood: premium Thai property-advisory infographic, bright daylight, energetic but trustworthy, hi-tech navy-and-cyan brand identity.',
  POSTER_PALETTE,
  'FOCAL POINT (mandatory): ONE large photoreal cutout presenter - a friendly Thai advisor aged 30-40 in a navy blazer with a cyan accent (pocket square or lanyard), waist-up, facing the viewer, pointing at or presenting the content card - standing on the right third, 50-60% of the canvas height tall, in front of the background and overlapping BOTH the lower edge of the headline zone and the right edge of the content card so the layers read as depth. Not a real or recognisable person, no name badge, no text on clothing. Behind the presenter a smaller photo cluster that matches the topic (a modern Thai house render, a plain document; coin stacks only for money topics), tilted slightly, with soft shadows.',
  'OBJECT HERO (only for warning or scam posts, or when a person does not fit the topic): instead of the presenter, a plain generic land title deed with no emblem and no numbers, tilted about 12 degrees, about 34% of the canvas width, in the right third between 20% and 48% of the height and cut by the top-right corner, with a photoreal Thai house model about 22% of the width in front of its lower-left corner; one coral map pin on the house is then the only coral element. No villains, no police, no real people.',
  'HEADLINE: the loudest element and the first read. Two lines in a heavy geometric Thai display face (Kanit/Prompt Black), left-aligned inside the LEFT 60% of the canvas width, starting about 8% from the top: line 1 cap height 8-9% of the canvas height (2-4 Thai words, contains the key word), line 2 at 60-70% of that size. Fill = vertical gradient white to pale cyan, a navy outer stroke about 0.5% of the canvas width, a solid navy 3D extrusion offset toward the bottom-right, soft navy drop shadow, the whole block tilted about -3 degrees; exactly ONE key word in a cyan-to-coral gradient with the same stroke - a whole word of the headline (never a syllable cut out of a longer word). A navy-to-transparent scrim (about 50% opacity at the top edge) sits over the photo behind the headline so it reads at phone size.',
  'RIBBON: directly under the headline, one cyan brush-stroke ribbon about 5% of the canvas height tall and 55-75% of the width, rotated -2 degrees, holding ONE complete phrase of 4-8 Thai words in navy at about 3% height. Never a 1-2 word fragment.',
  'TYPE SCALE (percent of canvas height): exactly three tiers. Tier 1 = headline (8-9% / 5-6%). Tier 2 = ribbon text, pill titles, badge numerals at 2.6-3.2%. Tier 3 = card rows, callout, CTA and chip labels at 2.2-2.5% (30-34 px at 1080 px width), never above 34 px. Nothing except the headline is taller than 3.5% of the canvas height, and the headline must be at least 3.5 times the row text so that something reads as big.',
  'CONTENT CARD: one white rounded card (radius about 24 px, soft navy shadow, inner padding about 3% of the canvas width) occupying 28-34% of the canvas height and 60-70% of the width, anchored left so the presenter overlaps its right edge by up to 5% of the width in an area without text; a navy pill title (about 4% of the canvas height, white text at tier 2, a cyan icon circle straddling its left edge) at the top-left of the card; then 4-6 rows (prefer 4-5; never fewer than 3), each row ONE complete clause of 5-10 Thai words copied from the post that may wrap to two lines (1.25 line spacing), row pitch about 6% of the canvas height including padding, rows separated by 1 px hairlines, all rows left-aligned to one vertical line. Card height follows its rows and is never stretched: 6 rows at most 30% of the canvas height, 3 rows at most 22%. Each row carries ONE marker only at its left edge: a navy number badge (circle about 5% of the canvas width, cyan ring, white numeral) OR a pale-cyan icon circle (about 6% of the width, navy duotone glyph) OR a cyan check circle (about 3% of the width) - never a number and an icon side by side. The card is sized to its content: with 3 rows it must shrink, the rows must not grow.',
  'SECONDARY PANEL: one smaller callout chip (coral for warnings, cyan otherwise, one line of tier-3 text, 4-5% of the canvas height) placed below the card so the layout has a second level of information.',
  'BACKGROUND: a full-canvas photoreal scene with depth (bright modern Thai home exterior or a sunlit office with greenery), blurred to soft bokeh toward the edges and darkened about 20% behind the presenter; the presenter\'s face is the sharpest and brightest area of the poster.',
  'ACCENTS: at most 2 small decorative marks - one cyan sparkle or arrow next to the headline key word, optionally one thin diagonal cyan light streak behind the presenter; subtle bokeh in the background only. No neon glow, bloom, lens flare or emboss on text, pills, icons, the ribbon or the band (glow reads as cheap). Colour count: navy and white build the layout, cyan is the only accent, coral appears at most once (near the presenter\'s hand or on the first badge), violet only as shadow tint; no other blue, no gold, no green, no red.',
  'GRID: one shared margin of 4-5% of the canvas width on the left and right for the logo chip, headline, ribbon, card, callout and band contents (only the band\'s navy fill and the background run edge to edge); one shadow style on the whole poster (soft navy, slightly below the element) for the card, callout, chips and logo chip.',
  'LOGO: the attached image is the AssetX mark. Place it ONCE in the top-right corner (opposite the left-aligned headline, above the presenter) at 8-10% of the canvas width inside a white rounded square with about 1.5% padding and a soft shadow, about 3.5% from the top and right edges. Do not redraw or recolour it, do not add any text beside or under it, do not put it in the bottom band, no second copy.',
  'BOTTOM BAND: flat navy, full width, 9-11% of the canvas height, a 2 px cyan hairline along its top edge, its lower edge flush with the bottom of the final cropped poster (nothing visible below it). Left: a flat cyan CTA pill about 4.5% of the canvas height tall and at most 45% of the width with the CTA text in navy at tier 3 (this is the only place the brand name appears). Right: 2-3 small white icon chips with two-word labels copied from the post. No logo, no second brand name, no phone numbers, no divider lines, no glow.',
  'VERTICAL BUDGET (share of the final poster height, top to bottom): logo corner 0-9% · headline block + ribbon 8-30% in the left 60% of the width · photo cluster 30-44% · content card 44-76% · callout 77-84% · bottom band 89-100%; the presenter spans 10-80% on the right third and crosses the zone boundaries; no empty gap taller than 3% between zones. For a 9:16 Story keep every size as a share of the canvas WIDTH, start the headline at about 12% of the height and let the background photo fill the extra height between the card and the band.',
  'OVERLAP RULES: layered depth is required - the presenter overlaps the headline zone and the card edge, the photo cluster is tilted 5-12 degrees and may bleed off the canvas edge, icon circles may straddle pill edges; but no element may cover any text, and margins of 5% apply to text and the card only.',
  'Icons: flat duotone navy-and-cyan line icons inside circles (document, house, land plot, calendar, coins, shield, check mark, map pin, handshake, magnifier).',
  'FINISH: one key light from the top-left, a thin cyan rim light on the presenter\'s hair and shoulder, crisp cutout edges, consistent soft shadows (the presenter casts one onto the card); no element except the presenter may exceed 40% of the canvas height; readable on a phone.',
].join('\n')

// โครงการ์ดเนื้อหาตามโครงของโพสต์ (ตัวอย่างของเจ้าของ: ขั้นตอนมีเลข · ถาม-ตอบ · เทียบสองคอลัมน์ · เตือนภัย · เช็กลิสต์)
// ทุกแถว = วลีครบความหมาย 5–10 คำที่คัดจากโพสต์ (ทีมวิจารณ์ 7 พ.ย.: แถว 1–2 คำอย่าง "ระหว่างสัญญา" อ่านแล้วไม่รู้เรื่อง ไม่ชวนอ่าน) · แถวละ "เครื่องหมายเดียว" (เลข หรือ ไอคอน หรือ ติ๊ก)
const ROW_RULE = 'each row is ONE complete clause of 5-10 Thai words copied from the post (if the first clause is shorter, join it with the next clause of the same sentence); never a 1-2 word fragment.'
const LAYOUTS = {
  steps: `Content card = numbered steps: copy the numbered lines from the post in order (4 to 6 rows if the post has them, 3 at minimum), ${ROW_RULE} Marker = navy number badge only.`,
  qa: `Content card = question and answer pairs: copy 2 or 3 "ถาม:" lines as navy pill titles and the first 5-10 words of each "ตอบ:" as the row beneath; ${ROW_RULE} Marker = cyan icon circle on the question pill only.`,
  compare: `Content card = two columns side by side for the two things the post compares, each titled in a navy pill with its own icon (the two column titles are the second-loudest element after the headline), 3 or 4 rows per column copied from the post with cyan check circles, a thin cyan divider between the columns; ${ROW_RULE}`,
  warning: `Content card = warning checklist: a coral "ข้อควรระวัง" pill on top, then 3 to 5 rows copied from the post with cyan check circles; ${ROW_RULE} The photo cluster shows a plain document being inspected - no villains, no police, no real people.`,
  checklist: `Content card = checklist: 4 to 6 rows copied from the post, each with a cyan check circle only; ${ROW_RULE}`,
  explain: `Content card = key points: 4 or 5 rows copied from the post (3 at minimum), each with a navy number badge only; ${ROW_RULE}`,
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

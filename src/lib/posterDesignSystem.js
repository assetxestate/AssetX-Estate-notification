// ระบบออกแบบโปสเตอร์ AssetX — ใช้ร่วมกันทั้งคิวสร้างภาพบนคอมสำนักงาน (server/marketing-image-jobs.js) บรีฟรูปบนหน้าเว็บ (MarketingPage) และทาง OpenAI API (server/marketing-image.js)
// ถอดจากตัวอย่างโปสเตอร์ 8 ชิ้นที่เจ้าของส่งให้ 7 พ.ย. 2569 (อินโฟกราฟิกอสังหา/ขายฝากแบบไทย) แต่คงมู้ดแอนด์โทนของเรา: น้ำเงินเข้ม-ฟ้าไซยาน-ม่วง-ส้มอิฐจากโลโก้ ไม่ใช่เขียว-ทองแบบเพจเงินกู้
// ประวัติ: v2 (เช้า) แถบ 5 ชั้น เจ้าของติ "ไม่สะดุดตา ไม่มีจุดโฟกัส ใหญ่ โลโก้ไม่เป็นมืออาชีพ" → v3 (บ่าย) ทีมวิจารณ์ 3 มุมวัดตัวอย่างเป็น % ของภาพ: ผู้แนะนำเป็นจุดโฟกัส ตัวอักษร 3 ระดับ แถวเป็นวลีครบ โลโก้มุมบน
// → v3.2 (บ่าย) เจ้าของกำกับ: "คนมีหรือไม่มีก็ได้ เน้นเนื้อหาให้ตรงคอนเทนต์ มองภาพแล้วรู้เลยว่าโพสต์สื่ออะไรและให้ประโยชน์อะไร" → เนื้อหาเป็นจุดโฟกัส คนเป็นตัวเลือกในโซนเล็ก ภาพต้องอ่านจบในตัว
// ข้อความทุกคำบนภาพต้องมาจากโพสต์จริง (ห้ามแต่ง)
export const POSTER_PALETTE = 'AssetX palette (from the logo): midnight navy #08213f and cyan/teal #42c7d8 as the two primary colors, deep violet #4b2a82 only as shadow tint inside the photo, coral-orange #f26b4f appearing at most ONCE on the whole poster, clean white and off-white #f4f7fb for cards. Navy and white build the layout and cyan is the only UI accent. Never use the green-and-gold loan-shop look, metallic gold bars, dominant red, sky-blue icons or generic high-saturation finance-ad colors.'

export const POSTER_DESIGN_SYSTEM = [
  'ASSETX POSTER DESIGN SYSTEM v3.2 (follow every line; sizes are % of the final poster height H or width W, px assume 1080 px width). This is a CONTENT-FIRST Thai infographic poster: a reader who sees only the image must understand what the post is about, the key points, and what they get or should do - without opening the caption.',
  'Mood: premium Thai property-advisory infographic, bright daylight, energetic but trustworthy, navy-and-cyan brand identity. Three depth layers back to front: (1) a full-bleed photoreal scene of the topic blurred to soft bokeh with a navy-to-transparent scrim over the top 30% H; (2) ribbon, cards, callout and bottom band; (3) at most two small cutout props. Text and cards keep a shared 4-5% W margin left and right; the photo and props may bleed off the edges.',
  POSTER_PALETTE,
  'FOCAL POINT = THE CONTENT: the headline block and the main content card are the largest and sharpest elements and carry the substance of the post. A presenter is OPTIONAL and secondary: include a friendly generic Thai advisor (navy blazer, cyan accent, not a real person, no name) only if the post is about advice or a decision, and only inside the HERO ZONE below, never shrinking or covering the content; otherwise the hero zone holds a small photoreal cluster matching the topic (a plain generic document with a pen, a modern Thai house render, coin stacks for money topics, a land plot with pegs for land topics), tilted 5-12 degrees with soft shadows.',
  'HERO ZONE: the top-right 36% W by 24% H, beside the headline (the headline stays in the left 62% W). The presenter or cluster may overlap the headline zone\'s right edge and bleed off the top or right canvas edge; it must never cover any text and never extend below the top edge of the main card. If a presenter is used: head-and-shoulders only, at most 30% H tall, pointing at the headline key word or the ribbon.',
  'HEADLINE: the loudest element and the first read; it names the topic. Two lines in a heavy geometric Thai display face (Kanit/Prompt Black), left-aligned inside the left 62% W, starting about 7% H from the top: line 1 cap height 7.5-8.5% H (2-4 Thai words), line 2 at 60-70% of that size. Fill = vertical gradient white to pale cyan, navy outer stroke about 0.5% W, solid navy 3D extrusion offset to the bottom-right, soft navy drop shadow, the block tilted about -2 degrees; exactly ONE key word - a whole word of the headline, never a syllable cut out of a longer word - in a cyan-to-coral gradient with the same stroke. No glow.',
  'BENEFIT RIBBON: directly under the headline, one cyan brush-stroke ribbon about 5% H tall and 55-70% W wide, rotated -2 degrees, holding ONE complete phrase of 4-10 Thai words copied from the post\'s opening or key sentence (not from the closing call-to-action sentence) that tells the reader what they get or why it matters to them. Never a 1-2 word fragment.',
  'TYPE SCALE: exactly three tiers. Tier 1 = headline. Tier 2 = ribbon text, card title pill, row titles and badge numerals at 2.6-3.2% H (35-43 px). Tier 3 = row details, action items, callout, CTA and chip labels at 2.1-2.4% H (28-32 px), never above 32 px. Nothing except the headline is taller than 3.5% H; the headline is at least 3 times the row detail text.',
  'MAIN CONTENT CARD: one white rounded card (radius about 24 px, soft navy shadow, inner padding 3% W) spanning the full content width (about 90-92% W) and 34-46% H, starting right under the ribbon (gap at most 3% H). Top-left: a navy pill title (about 4% H, white tier-2 text, 2-4 Thai words copied from the post that name what the rows are and do not repeat the headline or ribbon words, a cyan icon circle straddling its left edge). Then 3-5 rows; each row = a ROW TITLE (3-7 Thai words, bold navy, tier 2) and under it ONE DETAIL clause (8-18 Thai words, tier 3, regular navy, wrapping to at most 2 lines) - both copied word for word from the same point of the post, so each row teaches one fact; the detail ends at a natural clause boundary (before และ/หรือ or at the end of the sentence), never cut in the middle of a list. Row pitch 9-11% H, rows separated by 1 px hairlines, all rows aligned to one vertical line. Exactly ONE marker per row at its left edge: a navy number badge (circle about 5% W, cyan ring, white numeral) OR a pale-cyan icon circle (about 5.5% W, navy duotone glyph) OR a cyan check circle (about 3% W). The card is sized to its rows, never stretched.',
  'ACTION PANEL: below the main card, one slim white panel (or 2-3 compact white chips) with a small navy pill title of 1-4 Thai words copied from the post that introduces the actions (for example the post\'s "ก่อนเซ็น" lead-in; omit the title if the post has none), then 2-3 items, each with a 4% W cyan icon circle and ONE complete clause of 5-12 Thai words copied from the post that tells the reader what to do next or what to check. Items use tier-3 text and wrap to 2 lines rather than shrinking below tier 3. The action panel is 10-14% H.',
  'CALLOUT (optional): one rounded chip of at most 60% W and 4-5% H below the action panel, coral only for warnings (then it is the poster\'s only coral), navy otherwise, white tier-3 text, holding one sentence of at most 12 Thai words copied from the post. Leave it out if the post has no such line.',
  'LOGO: the attached image is the AssetX X-mark only. Place it ONCE in the top-right corner at 8-10% W inside a white rounded square chip with about 1.5% padding and one soft shadow, about 3% from the top and right edges, above the hero zone. Do not redraw, recolour, outline or glow it, write no text beside, under or inside the chip, no second mark or watermark, never in the bottom band.',
  'BOTTOM BAND: flat navy, full width, 9-10% H, a 2 px cyan hairline along its top edge, its lower edge on the bottom edge of the USABLE AREA (when the prompt gives letterbox bars or a canvas map, the band sits directly above the lower bar - never on the canvas edge). Left: a flat cyan CTA pill about 4.5% H tall and at most 42% W wide with the CTA text in navy at tier 3 - the only place the brand name appears. Right: 2-3 small white icon chips with two-word labels copied from the post, or nothing. No logo, no second brand name, no phone numbers, no divider lines, no glow.',
  'VERTICAL BUDGET (share of the final poster height, top to bottom): logo chip and headline block 5-22% · ribbon 22-27% · main card 29-72% · action panel 74-85% · callout 86-90% (optional) · bottom band 90-100%. The hero zone sits at 3-27% H on the right 36% W. No empty vertical gap taller than 3% H between zones; if the card has fewer rows the photo shows through, the card never stretches.',
  'ACCENTS: at most 2 small decorative marks (one cyan sparkle or arrow next to the headline key word, optionally one thin diagonal cyan light streak in the hero zone); bokeh only inside the photo. No neon glow, bloom, lens flare, bevel or emboss on text, pills, icons, ribbon or band. One shadow style on the whole poster (soft navy, slightly below the element) for the cards, chips and logo chip.',
  'Icons: flat duotone navy line icons on pale-cyan circles (document, house, land plot, calendar, coins, shield, check mark, map pin, handshake, magnifier, calculator) - one consistent style, no other colours.',
  'FINISH: one key light from the top-left, crisp cutout edges, consistent shadows; no element may cover any text; every word readable on a phone; the poster must make sense with the caption hidden.',
].join('\n')

// แถวการ์ด = หัวข้อสั้น (3–7 คำ) + รายละเอียด 1 วรรค (8–18 คำ) คัดจากจุดเดียวกันของโพสต์ (v3.2 เจ้าของ: ภาพต้องอ่านแล้วรู้เรื่องโดยไม่เปิดแคปชั่น) · แถวละ "เครื่องหมายเดียว"
const ROW_RULE = 'each row = a ROW TITLE of 3-7 Thai words plus ONE DETAIL clause of 8-18 Thai words, both copied word for word from the same point of the post; the detail must add words the title does not already say - if the whole point is a single short sentence (at most 10 words) show it as the title only, with no detail line; never a 1-2 word fragment and never repeat the title inside the detail.'
const LAYOUTS = {
  steps: `Main card = numbered points: copy the numbered points of the post in order (3 to 5 rows); ${ROW_RULE} Marker = navy number badge only.`,
  qa: `Main card = question and answer pairs: each row title is a "ถาม:" line (without the label) and the detail is the first 8-18 words of its "ตอบ:" (2 or 3 rows); ${ROW_RULE} Marker = cyan icon circle only.`,
  compare: `Main card = two columns side by side for the two things the post compares, each titled in a navy pill with its own icon (the column titles are the second-loudest element after the headline), 3 or 4 rows per column copied from the post with cyan check circles, a thin cyan divider between the columns; in this layout a row may be a single clause of 5-12 words. ${ROW_RULE.replace('each row = ', 'Elsewhere ')}`,
  warning: `Main card = warning checklist: a coral "ข้อควรระวัง" pill on top (the poster's only coral), then 3 to 5 rows copied from the post with cyan check circles; ${ROW_RULE} The hero zone shows a plain document being inspected - no villains, no police, no real people.`,
  checklist: `Main card = checklist: 3 to 5 rows copied from the post, each with a cyan check circle only; ${ROW_RULE}`,
  explain: `Main card = key points: 3 or 4 rows copied from the post, each with a navy number badge only; ${ROW_RULE}`,
}

export const POSTER_LAYOUTS = Object.keys(LAYOUTS)

export function pickPosterLayout(caption = '') {
  const t = String(caption || '')
  const firstLine = t.split('\n').map((s) => s.trim()).find(Boolean) || ''
  if (/^(ถาม|ตอบ)\s*[:：]/m.test(t)) return 'qa'
  // "เปรียบเทียบ" นับเป็นโครงเทียบสองฝั่งเฉพาะเมื่ออยู่ในบรรทัดแรก — โพสต์เช็กลิสต์ที่มีข้อ "เปรียบเทียบราคา" เคยถูกจัดเป็น compare (7 พ.ย. 2569 โพสต์ #2 #4)
  if (/\bvs\.?\b|ต่างกันอย่างไร|ต่างกันยังไง|แบบไหนดีกว่า|กับ.{1,20}ต่างกัน/i.test(t) || /เปรียบเทียบ/.test(firstLine)) return 'compare'
  if (/มิจฉาชีพ|หลอก|โกง|ปลอมแปลง|โฉนดปลอม|แก๊ง|เตือนภัย/.test(t)) return 'warning'
  const numbered = (t.match(/^\s*\d{1,2}[.)]\s/gm) || []).length
  if (numbered >= 2) return 'steps'
  if (/เช็ก|เช็ค|ตรวจสอบ|ต้องเตรียม|เตรียม/.test(t) && (/^\s*[-•✅✔☑]\s/m.test(t) || t.split('\n').filter(Boolean).length >= 4)) return 'checklist'
  return 'explain'
}

export function posterLayoutInstruction(layout) {
  return LAYOUTS[layout] || LAYOUTS.explain
}

// คำที่ให้เน้นในพาดหัว — ต้องเป็น "ทั้งคำ" (โมเดลเคยเน้นแค่พยางค์ "ฝาก" ของ "ขายฝาก" 2 ครั้ง 7 พ.ย. 2569 แม้สั่งว่าห้าม) จึงเลือกให้จากคลังคำโดเมน เรียงคำยาว/เฉพาะก่อน
const HEADLINE_KEYWORDS = ['ค่าใช้จ่ายรวม', 'ค่าใช้จ่าย', 'ค่าธรรมเนียม', 'ดอกเบี้ย', 'สินไถ่', 'ไถ่ถอน', 'ไถ่คืน', 'มิจฉาชีพ', 'โฉนดปลอม', 'โฉนด', 'เอกสารสิทธิ์', 'เอกสาร', 'สัญญา', 'กรรมสิทธิ์', 'ราคาประเมิน', 'วงเงิน', 'ขายฝาก', 'จำนอง', 'ฝากขาย', 'รีไฟแนนซ์', 'ที่ดิน', 'คอนโด', 'บ้าน', 'ทรัพย์', 'ภาษี', 'เงินก้อน', 'เงินทุน']
export function pickHeadlineKeyword(headline = '') {
  const h = String(headline || '')
  const hits = HEADLINE_KEYWORDS.filter((w) => h.includes(w))
  if (!hits.length) return ''
  // คำที่ไม่ใช่ชื่อบริการ (ค่าใช้จ่าย โฉนด มิจฉาชีพ…) น่าเน้นกว่าชื่อบริการที่อยู่ทุกโพสต์ (ขายฝาก จำนอง) · คำยาวกว่าก่อน
  const service = new Set(['ขายฝาก', 'จำนอง', 'ฝากขาย', 'รีไฟแนนซ์'])
  const ranked = hits.sort((a, b) => Number(service.has(a)) - Number(service.has(b)) || b.length - a.length)
  return ranked[0]
}

// กติกาข้อความบนภาพที่ใช้ซ้ำทุกทาง — ทุกคำต้องมาจากโพสต์ · สะกดผิดไม่ได้ · ไม่มีข้อมูลที่ไม่ได้ให้
export const POSTER_TEXT_RULES = [
  'Thai text must be spelled exactly as given. Use fewer words rather than risk a misspelled word.',
  'Every word on the poster must come from the given headline, ribbon, card rows, action items, callout or CTA. Do not add punctuation that is not in the given text: no trailing periods, no extra quotation marks.',
  'Do not add phone numbers, LINE IDs, URLs, deed numbers, addresses, people\'s names, prices, interest rates or percentages unless they appear in the HEADLINE.',
  'No Garuda, national emblem, government seals or official logos. Draw any land title deed as a plain generic document without emblems or numbers.',
  'No other company names, logos or watermarks. No "AI" label of any kind.',
  'No promises of guaranteed approval, instant cash or guaranteed returns.',
]

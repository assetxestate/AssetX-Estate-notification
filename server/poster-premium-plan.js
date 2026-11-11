// server/poster-premium-plan.js — ขั้นแรกของโปสเตอร์โหมด "พรีเมียม": ให้ AI (Codex บนคอมสำนักงาน) วางบรีฟ 6 ส่วน + ข้อความบนภาพจากโพสต์
// แล้วตรวจก่อนส่งให้ src/lib/posterPremium.js ประกอบคำสั่งภาพ — ทำแบบเดียวกับที่ Codex ทำในแชตกับเจ้าของ 9 พ.ย. 2569 (ภาพต้นแบบ 3 ภาพ)
//
// ข้อความบนภาพ "ย่อ/เรียบเรียงจากโพสต์" ได้ (ต่างจากโหมดอื่นที่คัดคำต่อคำ) เพราะภาพต้นแบบที่เจ้าของชอบได้มาด้วยวิธีนี้
// ด่านที่กันการแต่งเรื่อง: ตัวเลขต้องมีในโพสต์ · ห้ามเบอร์/LINE/ลิงก์ · ห้ามคำโฆษณาเกินจริง · ห้ามมุมคนปล่อยเงิน · ภาษาไทยล้วน (ยกเว้น AssetX Estate)
// · ข้อความกำกับ (disclaimer) และ CTA บรรทัดสองระบบใส่เอง · ความยาวเกินเป็นปัญหาเบา (ขอแก้ก่อน ถ้าแก้ไม่หมดยังใช้ได้)
// สกิลฉบับ 11 พ.ย. 2569 (เจ้าของลองกับ Codex แล้ว "ผลออกมาดีเยี่ยม"): AI เลือกโครงภาพจากเนื้อหาเอง (composition + variation จากงานล่าสุด)
// เลือกโทนสว่าง/เข้ม · มีคนหรือไม่ (advisor — มีคน = รูปเจ้าของเสมอ แต่ไม่ต้องทุกโพสต์) · ภาพโฉนดจากแบบเอกสารจริง (deed) · กล่องเน้น (callout)
import { lenderViewHit, readerRuleLines } from './research/audience.js'
import { scrubPostText } from './research/pii.js'
import { premiumCopyStrings, PREMIUM_HIGHLIGHT_COLORS } from '../src/lib/posterPremium.js'

export const PREMIUM_LIMITS = {
  keyMessage: 64, eyebrow: 32, headlineSmall: 30, headlineLine: 24, subheading: 46,
  middleTitle: 28, middleItem: 26, middleNote: 52, pointTitle: 30, pointBody: 56, calloutTitle: 34, calloutBody: 60, cta: 40, total: 540,
  composition: 700, variation: 260,
}
const POINTS_MIN = 2
const POINTS_MAX = 4
const POINTS_MAX_WITH_MIDDLE = 3

// คำโฆษณาเกินจริง/คำที่สกิลห้าม (สกิล: ไม่อ้างอนุมัติแน่นอน ได้เงินทันที ปลอดความเสี่ยง ฟรี ผู้เชี่ยวชาญ)
export const PREMIUM_CLAIM_RE = /ฟรี|อนุมัติ(?:ไว|เร็ว|ง่าย|แน่|ทันที|ทุกเคส)|ได้เงิน(?:ทันที|ไว|เร็ว|ใน\s*\d)|การันตี|รับประกัน|ไม่มีความเสี่ยง|ปลอดภัย\s*100|ไร้ความเสี่ยง|ผู้เชี่ยวชาญ|ดอกเบี้ยต่ำ|ไม่เช็ค|ไม่ตรวจเครดิต|ติดบูโรก็ได้/
const CONTACT_RE = /0\d[\d\s-]{7,}\d|https?:|www\.|\.com|\.co\.th|@\w|\bline\b|ไลน์|ไอดี|คิวอาร์|QR/i
const NUMBER_RE = /[0-9๐-๙]+/g
const LATIN_RE = /[A-Za-z]/
const THAI_RUN_RE = /[฀-๿]+(?:[\s฀-๿]*[฀-๿])?/g

const DEFAULT_BRIEF = {
  audience: 'A Thai owner of land, a house or a condo who needs cash and is weighing a sale with right of redemption or a mortgage on that property. Plain words, relatable property and paperwork photography, no jargon and no wealth fantasy.',
  goal: 'The reader understands the one key point of this post and knows what to check before deciding.',
  visual: 'Teal marks the key idea in the headline; violet and dark coral mark at most one phrase per group.',
  emotion: 'Calm, careful and reassuring, on the owner\'s side of the table.',
  hero: 'the advisor seated at a sophisticated wooden table, calmly explaining a neatly arranged anonymous document folder beside a calculator and a pen, a contemporary Thai house and a green plot seen softly through a window behind, warm morning daylight.',
}
// ภาพหลักแบบไม่มีคน (advisor: false)
const OBJECT_HERO = 'a sophisticated wooden table with a neatly arranged anonymous document folder, a calculator and a pen, a contemporary Thai house and a green plot seen softly through a window behind, warm morning daylight.'
// ภาพโฉนดจริงตามสกิล: AI บอก deed:true หรือพูดถึง deed/โฉนดในภาพหลัก/โครง
const DEED_RE = /\b(?:title )?deeds?\b|โฉนด/i
// โลโก้/เบอร์/LINE ระบบต่อใต้ภาพเอง — ประโยคใน composition ที่สั่งวางของเหล่านี้ถูกตัดทิ้ง (ไม่งั้นโมเดลภาพวาดโลโก้ปลอม)
// LINE แยกแบบตัวพิมพ์ใหญ่ (คำว่า line ธรรมดา เช่น "a thin line" ต้องไม่โดนตัด)
const BRAND_ITEM_RE = /\blogo|\bphone\b|\bQR\b|telephone|contact (?:number|details)/i
const LINE_APP_RE = /\bLINE\b/
const brandItem = (sentence) => BRAND_ITEM_RE.test(sentence) || LINE_APP_RE.test(sentence)
// ภาพหลักต้องมีผู้แนะนำ (รูปเจ้าของที่ตัวรับงานแนบ · เจ้าของ 10 พ.ย. 2569) — บรีฟที่ไม่พูดถึงเขาอาจวาดลูกค้าเป็นตัวเอก
const ADVISOR_RE = /\badvisor\b/i

const clean = (value) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim()
const len = (s) => String(s || '').length

export function buildPremiumPlanPrompt({ title = '', caption = '', feedback = [], recent = [] } = {}) {
  const L = PREMIUM_LIMITS
  const system = 'คุณคือนักออกแบบภาพและครีเอทีฟคอนเทนต์ของ AssetX Estate (ที่ปรึกษาอสังหาริมทรัพย์ไทย บริการขายฝากและจำนอง) งานนี้คือวางแผนโปสเตอร์อินโฟกราฟิกภาพจริงแนวพรีเมียมหนึ่งแผ่นจากโพสต์ Facebook ที่ให้ ยังไม่ต้องสร้างภาพ ตอบเป็น JSON อย่างเดียว ห้ามมีข้อความอื่น'
  const prompt = [
    'คนอ่านของเพจ (กลุ่มเดียว):',
    ...readerRuleLines('A'),
    '',
    'ขั้นตอน:',
    '1. อ่านโพสต์ เลือกสารหลักเพียงหนึ่งประเด็นที่คนอ่านควรจำได้หลังเห็นภาพ (key_message) — ทุกส่วนของโปสเตอร์ต้องสนับสนุนสารนี้ ไม่เน้นทุกข้อเท่ากัน',
    '2. เลือกวิธีเล่าและโครงภาพจากเนื้อหาของโพสต์นี้ (composition) แล้วย่อเนื้อหาเป็นข้อความบนภาพสั้น ๆ อ่านบนมือถือได้ ให้พอดีกับโครงนั้น ไม่เริ่มจากตารางเดิมแล้วยัดข้อความลงไป',
    '3. เขียนบรีฟ 6 ส่วนเป็นภาษาอังกฤษ (กลุ่มเป้าหมาย วัตถุประสงค์ จิตวิทยาการมองเห็น สารหลัก อารมณ์ CTA) ให้เฉพาะเจาะจงกับโพสต์นี้ และเลือกภาพหลักแบบภาพถ่ายสมจริงที่เข้ากับเรื่อง',
    '',
    'โครงภาพ (สกิล assetx-estate-visuals ฉบับ 11 พ.ย. 2569: คงความสวย สมจริง พรีเมียม แต่จัดวางอิสระตามเนื้อหา):',
    '- เลือกโครงเองจากเนื้อหา ไม่ใช่แม่แบบ ไม่ใช่สุ่ม · เครื่องมือคิด (ไม่บังคับ): คำถาม/ความเข้าใจผิด = ภาพเต็มพื้นที่ คำถามใหญ่บนพื้นที่ว่าง คำตอบสั้นถ่วงอีกด้าน · เคส/สถานการณ์ = ภาพบรรยากาศเป็นพระเอก · เปรียบเทียบ = สองฝั่งมีลำดับชัด (ไม่ต้องกรอบสองคอลัมน์ทุกครั้ง) · ขั้นตอน = เส้นทาง/ไทม์ไลน์ตามลำดับจริง · เช็กลิสต์ = ภาพเอกสาร/สถานการณ์ด้านหนึ่ง รายการอีกด้าน · จำนวนเงิน = องค์ประกอบสมการชัด ภาพประกอบเล็ก · สารสั้นประเด็นเดียว = ภาพหลักภาพเดียว ข้อความน้อย ใช้พื้นที่ว่าง · คิดโครงใหม่นอกรายการได้ถ้าเล่าได้ดีกว่า',
    '- ไม่ต้องมีทุกองค์ประกอบ ไม่ต้องสมมาตร แต่ต้องอ่านเป็นลำดับ · ตำแหน่งหัวเรื่อง ภาพ แผงข้อมูล และ CTA เลือกเองได้ · CTA ไม่ต้องเป็นแถบท้ายภาพ (ปุ่มโค้ง กล่องข้าง หรือบรรทัดเรียบในพื้นที่ว่างก็ได้)',
    '- ไม่ต้องวางหรือพูดถึงโลโก้ เบอร์ LINE: ระบบต่อแถบแบรนด์ (โลโก้จริง + เบอร์/LINE) ใต้ภาพให้เอง',
    '- ชุดที่ภาพของเราซ้ำมาตลอด ห้ามเป็นค่าเริ่มต้น: หัวเรื่องซ้ายบน ภาพบ้าน/โต๊ะครึ่งบน แผงข้อมูลด้านล่าง แถบ CTA ท้ายภาพ',
    ...(recent.length
      ? ['- งานพรีเมียมล่าสุดของเรา (ใหม่สุดก่อน) — เปลี่ยนอย่างน้อย 2 ด้าน เช่น โครงพื้นที่กับมุมกล้อง หรือวิธีเล่ากับสัดส่วนภาพ/ข้อความ ไม่ใช่แค่สลับสี/ไอคอน:', ...recent.slice(0, 3).map((r, i) => `  ${i + 1}) ${r}`)]
      : ['- ไม่มีประวัติงานล่าสุดให้เทียบ (variation ให้บอกว่าไม่มี)']),
    '- theme: "light" (พื้นขาวอุ่น ตัวหนังสือน้ำเงินเข้ม) หรือ "dark" (พื้นน้ำเงินเข้ม ตัวหนังสือขาว) ตามอารมณ์เรื่อง',
    '- advisor: true เมื่อเรื่องคือการคุย/ปรึกษากับ AssetX หรือสถานการณ์ของคน (ระบบใส่รูปจริงของผู้แนะนำ AssetX ให้) · false เมื่อเอกสาร ทรัพย์ หรือวัตถุเล่าได้ดีกว่า (ภาพไม่มีหน้าคน) · ไม่ต้องมีคนทุกโพสต์',
    '- deed: true เมื่อภาพควรแสดงโฉนดที่ดิน (ระบบแนบแบบโฉนดจริงให้ เอกสารจะมีตรา "ตัวอย่าง" และไม่มีข้อมูลบุคคล) · false ถ้าไม่ต้องใช้',
    '',
    'กติกาข้อความบนภาพ (สำคัญที่สุด):',
    '- ทุกข้อความต้องมีที่มาจากโพสต์: ย่อหรือเรียบเรียงให้สั้นลงได้ แต่ห้ามเพิ่มข้อเท็จจริง เงื่อนไข ระยะเวลา ค่าธรรมเนียม อัตรา หรือคำแนะนำที่โพสต์ไม่ได้พูด',
    '- ตัวเลขใช้ได้เฉพาะตัวที่มีในโพสต์ ห้ามแต่งตัวเลขตัวอย่างหรือการคำนวณ',
    '- ห้ามเบอร์โทร LINE ลิงก์ QR ชื่อคน ชื่อบริษัทอื่น · ห้ามคำว่า ฟรี อนุมัติไว/แน่นอน ได้เงินทันที การันตี รับประกัน ไม่มีความเสี่ยง ผู้เชี่ยวชาญ ดอกเบี้ยต่ำ',
    '- ใช้คำว่าขายฝาก/จำนองตามที่โพสต์ใช้ ห้ามสลับกัน · ภาษาไทยล้วน ยกเว้นชื่อ AssetX Estate',
    '- พูดกับเจ้าของทรัพย์ตรง ๆ ไม่พูดถึงผู้ขายฝาก/ผู้จำนองแบบบุคคลที่สาม และไม่ใช้มุมคนปล่อยเงิน (ราคาที่รองรับ วงเงินที่ปลอดภัย LTV คัดลูกค้า)',
    '- ไม่ต้องเขียนข้อความกำกับ/ปฏิเสธความรับผิด ระบบใส่ให้เอง · ไม่ต้องใส่เลขข้อ 01 02 (ระบบใส่ให้)',
    '',
    'โครงข้อความ (ความยาวนับเป็นตัวอักษร):',
    `- eyebrow: บรรทัดเล็กบอกบริบท ≤ ${L.eyebrow} ตัว (เช่น "ก่อนขายฝากหรือจำนอง") ถ้าโพสต์เป็นเคสสมมุติให้บอกว่าเคสสมมุติ`,
    `- headline_small: บรรทัดนำเล็กเหนือหัวเรื่อง ≤ ${L.headlineSmall} ตัว หรือ "" ถ้าไม่ต้องใช้`,
    `- headline: หัวเรื่องใหญ่ 1–2 บรรทัด (อาร์เรย์) บรรทัดละ ≤ ${L.headlineLine} ตัว ต้องสื่อสารหลัก`,
    '- headline_accent: คำหรือวลีสั้นที่อยู่ในหัวเรื่องคำต่อคำ จะลงสีฟ้าเข้ม (คำที่สำคัญที่สุด)',
    `- subheading: ประโยครองใต้หัวเรื่อง ≤ ${L.subheading} ตัว`,
    `- middle: แถบกลาง 3 กล่องเชื่อมกัน — type "flow" (ขั้นตอนตามลำดับ) หรือ "equation" (เมื่อเนื้อหาเป็นการหักลบ: กล่อง1 − กล่อง2 = กล่อง3) หรือ "none" (ไม่มีแถบกลาง ข้อหลักได้ที่มากขึ้น) · title ≤ ${L.middleTitle} ตัว · items 3 กล่อง กล่องละ ≤ ${L.middleItem} ตัว · note บรรทัดเล็กใต้แถบ ≤ ${L.middleNote} ตัว หรือ ""`,
    `- points: ข้อหลัก ${POINTS_MIN}–${POINTS_MAX} ข้อ (ถ้ามีแถบกลาง ไม่เกิน ${POINTS_MAX_WITH_MIDDLE}) หรือ [] เมื่อโครงเป็นสารสั้นประเด็นเดียว (ต้องมี callout) · แต่ละข้อ title ≤ ${L.pointTitle} ตัว (คำถามหรือหัวข้อที่ต้องตรวจ) body ≤ ${L.pointBody} ตัว`,
    '- numbered: true เมื่อข้อหลักเป็นลำดับขั้นจริง (ภาพใส่เลข 01 02) · false = ไม่มีเลขใหญ่',
    `- callout: กล่องเน้นสารสำคัญหนึ่งกล่อง title ≤ ${L.calloutTitle} ตัว body ≤ ${L.calloutBody} ตัว หรือ title "" ถ้าไม่ใช้`,
    '- highlights: คำ/วลีสั้นจาก title ของข้อหลักหรือ callout (คำต่อคำ) ไม่เกิน 2 จุด สี "violet" (สิทธิ/รายการสำคัญ) หรือ "coral" (เวลา ค่าใช้จ่าย จุดที่ต้องระวัง)',
    `- cta: การกระทำหนึ่งอย่างที่ชวนคุยกับ AssetX Estate ≤ ${L.cta} ตัว (ระบบเติมบรรทัด "ทางแชต AssetX Estate" และเบอร์/LINE ให้เอง)`,
    '- brief.audience / brief.goal / brief.visual / brief.emotion: ภาษาอังกฤษ 1–2 ประโยค ถ้าจะอ้างข้อความไทยให้คัดจากข้อความบนภาพคำต่อคำเท่านั้น',
    '- brief.hero: ภาษาอังกฤษ ฉากภาพถ่ายสมจริงพรีเมียมที่เล่าเรื่องนี้ (สถานที่ วัตถุ แสง มุมกล้อง) · advisor true: มี "the advisor" เป็นคนเดียวที่เห็นหน้า — เขาคือผู้แนะนำของ AssetX (ระบบแนบรูปจริงให้ ห้ามบรรยายหน้าตา อายุ ทรงผม) เขียนแค่ว่าเขาทำอะไรในฉาก เช่น อธิบายแฟ้มเอกสารบนโต๊ะ มองผู้ชมอย่างอบอุ่น · ห้ามให้เขาเป็นลูกค้า คนรับเงิน หรือฉลอง · advisor false: ไม่มีหน้าคน · คนอื่นถ้ามีเห็นแค่ด้านหลัง · ห้ามเอกสารที่อ่านออก เงินกอง ตราราชการ (ยกเว้นโฉนดตัวอย่างเมื่อ deed true)',
    `- composition: ภาษาอังกฤษ 2–4 ประโยค (≤ ${L.composition} ตัว) โครงที่เลือกและเหตุผลจากเนื้อหา: ภาพหลักอยู่ไหน หัวเรื่องอยู่ไหน ข้อมูลจัดกลุ่มแบบไหน CTA อยู่ไหน ลำดับสายตา · ไม่ต้องระบุพิกัด/เปอร์เซ็นต์ทุกส่วน · ไม่ใส่ข้อความไทย`,
    '- variation: ภาษาอังกฤษ 1 ประโยค ต่างจากงานล่าสุดตรงไหน',
    '',
    'รูปแบบคำตอบ (JSON เท่านั้น):',
    '{"key_message":"","eyebrow":"","headline_small":"","headline":["",""],"headline_accent":"","subheading":"","middle":{"type":"flow","title":"","items":["","",""],"note":""},"callout":{"title":"","body":""},"points":[{"title":"","body":""}],"numbered":false,"highlights":[{"text":"","color":"violet"}],"cta":"","theme":"light","advisor":false,"deed":false,"composition":"","variation":"","brief":{"audience":"","goal":"","visual":"","emotion":"","hero":""}}',
    '',
    feedback.length ? `ร่างก่อนหน้ามีปัญหา แก้ให้ครบแล้วตอบ JSON ใหม่ทั้งชุด:\n${feedback.map((f) => `- ${f}`).join('\n')}\n` : '',
    `หัวข้อโพสต์: ${String(title || '').trim()}`,
    'โพสต์:',
    '"""',
    String(caption || '').trim(),
    '"""',
  ].filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n')
  return { system, prompt }
}

// ข้อความไทยในบรีฟภาษาอังกฤษที่ไม่ใช่ข้อความบนภาพ → ตัดทิ้ง (โมเดลภาพชอบพิมพ์ข้อความไทยที่เห็นในคำสั่งลงภาพ)
function englishBrief(value, copyText, fallback, max = 420) {
  const full = clean(value).replace(THAI_RUN_RE, (run) => (copyText.includes(run.trim()) ? run : ' ')).replace(/[“”"]\s*[“”"]/g, '').replace(/\s{2,}/g, ' ').trim()
  const text = full.length > max ? cutAtSentence(full, max) : full
  return text.length >= 12 ? text : fallback
}

// ยาวเกิน → ตัดที่จบประโยคสุดท้ายที่พอดี (ไม่มีก็ตัดที่ช่องว่าง) ไม่ให้คำขาดกลางคำ (ลองจริง 11 พ.ย.: "no readable docu")
function cutAtSentence(text, max) {
  const head = text.slice(0, max + 1)
  const end = Math.max(head.lastIndexOf('. '), head.lastIndexOf('; '))
  if (end >= max * 0.5) return head.slice(0, end + 1).trim()
  const space = head.lastIndexOf(' ')
  return (space > 0 ? head.slice(0, space) : head.slice(0, max)).replace(/[,;:]$/, '').trim()
}

export function validatePremiumPlan(raw, { title = '', caption = '' } = {}) {
  const hard = []
  const soft = []
  const data = raw && typeof raw === 'object' ? raw : {}
  const L = PREMIUM_LIMITS
  const headlineRaw = Array.isArray(data.headline) ? data.headline : String(data.headline || '').split(/\n|\s\/\s/)
  const headline = headlineRaw.map(clean).filter(Boolean).slice(0, 2)
  const middleRaw = data.middle && typeof data.middle === 'object' ? data.middle : {}
  let middleType = ['flow', 'equation', 'none'].includes(middleRaw.type) ? middleRaw.type : 'none'
  const middleItems = Array.isArray(middleRaw.items) ? middleRaw.items.map(clean).filter(Boolean).slice(0, 4) : []
  if (middleType !== 'none' && middleItems.length < 2) middleType = 'none'
  if (middleType === 'equation' && middleItems.length !== 3) { middleType = 'flow'; soft.push('สมการแถบกลางต้องมี 3 กล่องพอดี (เปลี่ยนเป็นลำดับขั้นแทน)') }
  const middle = middleType === 'none'
    ? { type: 'none', title: '', items: [], note: '' }
    : { type: middleType, title: clean(middleRaw.title), items: middleItems.slice(0, 3), note: clean(middleRaw.note) }
  const maxPoints = middle.type === 'none' ? POINTS_MAX : POINTS_MAX_WITH_MIDDLE
  const pointsRaw = Array.isArray(data.points) ? data.points : []
  let points = pointsRaw.map((pt) => ({ title: clean(pt?.title), body: clean(pt?.body) })).filter((pt) => pt.title)
  if (points.length > maxPoints) { soft.push(`ข้อหลักมี ${points.length} ข้อ เกิน ${maxPoints} (ตัดเหลือ ${maxPoints})`); points = points.slice(0, maxPoints) }
  const calloutRaw = data.callout && typeof data.callout === 'object' ? data.callout : {}
  let callout = { title: clean(calloutRaw.title), body: clean(calloutRaw.body) }
  if (!callout.title) callout = { title: '', body: '' }
  // ข้อหลักข้อเดียวไม่เป็นรายการ → ย้ายไปเป็นกล่องเน้น (โครงสารสั้นประเด็นเดียวของสกิล)
  if (points.length === 1 && !callout.title) { callout = points[0]; points = [] }
  const flag = (v) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : null)
  const plan = {
    keyMessage: clean(data.key_message),
    eyebrow: clean(data.eyebrow),
    headlineSmall: clean(data.headline_small),
    headline,
    headlineAccent: clean(data.headline_accent),
    subheading: clean(data.subheading),
    middle,
    callout,
    points,
    numbered: flag(data.numbered) === true,
    highlights: [],
    cta: clean(data.cta),
    theme: data.theme === 'dark' ? 'dark' : 'light',
    // ไม่บอก = มีผู้แนะนำ (พฤติกรรมเดิมก่อน 11 พ.ย. 2569)
    advisor: flag(data.advisor) ?? true,
    deed: false,
    composition: '',
    variation: '',
    brief: {},
  }
  if (!plan.headline.length) hard.push('ไม่มีหัวเรื่อง (headline)')
  if (!(plan.points.length >= POINTS_MIN || (!plan.points.length && plan.callout.title))) hard.push(`ข้อหลักต้องมีอย่างน้อย ${POINTS_MIN} ข้อ (หรือไม่มีข้อหลักเลยแล้วใช้กล่องเน้น callout)`)
  if (!plan.cta) hard.push('ไม่มี CTA')
  if (!plan.keyMessage) plan.keyMessage = plan.headline.join(' ')

  // ความยาว (ปัญหาเบา)
  const over = (label, value, max) => { if (len(value) > max) soft.push(`${label} ยาว ${len(value)} ตัว เกิน ${max}: "${value}"`) }
  over('eyebrow', plan.eyebrow, L.eyebrow)
  over('headline_small', plan.headlineSmall, L.headlineSmall)
  plan.headline.forEach((line, i) => over(`headline บรรทัด ${i + 1}`, line, L.headlineLine))
  over('subheading', plan.subheading, L.subheading)
  over('middle.title', plan.middle.title, L.middleTitle)
  plan.middle.items.forEach((item, i) => over(`middle กล่อง ${i + 1}`, item, L.middleItem))
  over('middle.note', plan.middle.note, L.middleNote)
  over('callout.title', plan.callout.title, L.calloutTitle)
  over('callout.body', plan.callout.body, L.calloutBody)
  plan.points.forEach((pt, i) => { over(`ข้อ ${i + 1} title`, pt.title, L.pointTitle); over(`ข้อ ${i + 1} body`, pt.body, L.pointBody) })
  over('cta', plan.cta, L.cta)
  const strings = premiumCopyStrings(plan)
  const total = strings.reduce((sum, s) => sum + len(s), 0)
  if (total > L.total) soft.push(`ข้อความบนภาพรวม ${total} ตัว เกิน ${L.total} — ย่อให้สั้นลง`)

  // ความถูกต้อง (ปัญหาหนัก — ห้ามใช้จนกว่าจะแก้)
  const source = `${title}\n${caption}`
  const sourceNumbers = new Set(source.match(NUMBER_RE) || [])
  for (const s of strings) {
    const invented = (s.match(NUMBER_RE) || []).filter((n) => !sourceNumbers.has(n))
    if (invented.length) hard.push(`ตัวเลข ${invented.join(', ')} ไม่มีในโพสต์: "${s}"`)
    if (CONTACT_RE.test(s)) hard.push(`ห้ามช่องทางติดต่อ/ลิงก์ในข้อความ (แถบท้ายใส่ให้เอง): "${s}"`)
    const claim = s.match(PREMIUM_CLAIM_RE)
    if (claim) hard.push(`คำโฆษณาเกินจริง "${claim[0]}": "${s}"`)
    if (LATIN_RE.test(s.replace(/AssetX Estate/g, ''))) hard.push(`ใช้ภาษาไทยบนภาพ (ยกเว้น AssetX Estate): "${s}"`)
    const lender = lenderViewHit(s, 'A')
    if (lender) hard.push(`มุมคนปล่อยเงิน "${lender}": "${s}" — พูดกับเจ้าของทรัพย์ตรง ๆ`)
    if (scrubPostText(s) !== s) hard.push(`มีข้อมูลบุคคล: "${s}"`)
  }

  // ลงสี: ต้องเป็นคำที่อยู่บนภาพจริง (ไม่ใช่ก็ทิ้ง ไม่ถือเป็นปัญหา)
  const headlineText = plan.headline.join(' ')
  if (plan.headlineAccent && !headlineText.includes(plan.headlineAccent)) plan.headlineAccent = ''
  const colourable = [plan.subheading, ...plan.middle.items, plan.callout.title, ...plan.points.map((pt) => pt.title)].join('\n')
  const seen = new Set()
  plan.highlights = (Array.isArray(data.highlights) ? data.highlights : [])
    .map((h) => ({ text: clean(h?.text), color: PREMIUM_HIGHLIGHT_COLORS.includes(h?.color) ? h.color : '' }))
    .filter((h) => h.text && h.color && colourable.includes(h.text) && !seen.has(h.text) && seen.add(h.text))
    .slice(0, 2)

  const copyText = strings.join('\n')
  const briefRaw = data.brief && typeof data.brief === 'object' ? data.brief : {}
  const defaults = { ...DEFAULT_BRIEF, hero: plan.advisor ? DEFAULT_BRIEF.hero : OBJECT_HERO }
  // ภาพหลักยาวได้มากกว่า (สกิลให้บอกมุมกล้อง ระยะ แสง วัสดุ)
  plan.brief = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, englishBrief(briefRaw[key], copyText, fallback, key === 'hero' ? 560 : 420)]))
  if (plan.advisor && !ADVISOR_RE.test(plan.brief.hero)) soft.push('brief.hero ต้องมี "the advisor" (ผู้แนะนำของ AssetX) เป็นคนเดียวที่เห็นหน้าในภาพหลัก')
  if (!plan.advisor && ADVISOR_RE.test(plan.brief.hero)) soft.push('advisor เป็น false แต่ brief.hero มี "the advisor" — ตัดคนออกจากฉาก หรือเปลี่ยน advisor เป็น true')

  // โครงภาพตามเนื้อหา (สกิล 11 พ.ย. 2569) · ไม่มี/สั้นเกิน = ตัวรับงานใช้โครงหมุนเวียน 5 แบบแทน
  const composition = englishBrief(data.composition, copyText, '', L.composition)
    .split(/(?<=[.!?])\s+/).filter((sentence) => !brandItem(sentence)).join(' ').trim()
  if (composition.length >= 40) plan.composition = composition
  else soft.push('ไม่มี composition (โครงภาพที่เลือกจากเนื้อหา) — เขียนภาษาอังกฤษ 2–4 ประโยค')
  if (!plan.advisor && ADVISOR_RE.test(plan.composition)) soft.push('advisor เป็น false แต่ composition มี "the advisor" — ตัดคนออกจากโครง หรือเปลี่ยน advisor เป็น true')
  plan.variation = englishBrief(data.variation, copyText, '', L.variation)
  // AI บอก deed ตรง ๆ = ยึดตามนั้น (ลองจริง 11 พ.ย.: ภาพหลักเขียนว่า "no official seals, title deeds" — เดาจากคำจะผิด) · ไม่บอก = ดูจากคำ
  plan.deed = flag(data.deed) ?? DEED_RE.test(`${plan.brief.hero}\n${plan.composition}`)
  return { plan, hard: [...new Set(hard)], soft: [...new Set(soft)] }
}

// ถาม AI สูงสุด attempts รอบ ส่งปัญหากลับไปให้แก้ · ไม่มีปัญหาหนักแต่ยังมีปัญหาเบา → ใช้ชุดที่ดีที่สุด (ยาวเกินนิดหน่อยยังอ่านได้)
export async function planPremiumPoster({ title = '', caption = '', recent = [], ask, log = () => {}, attempts = 3 } = {}) {
  if (typeof ask !== 'function') return { ok: false, error: 'ไม่มีผู้ให้บริการ AI' }
  let feedback = []
  let best = null
  let lastError = ''
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { system, prompt } = buildPremiumPlanPrompt({ title, caption, feedback, recent })
    const res = await ask({ system, prompt })
    if (!res?.ok) {
      lastError = res?.error || 'AI ไม่ตอบ'
      log(`วางแผนข้อความรอบ ${attempt} ไม่สำเร็จ (${lastError.slice(0, 160)})`)
      if (Array.isArray(ask.providers) && ask.providers.every((p) => ask.unreachable?.has?.(p))) break
      continue
    }
    const checked = validatePremiumPlan(res.data, { title, caption })
    log(`วางแผนข้อความรอบ ${attempt} (${res.provider}): ปัญหาหนัก ${checked.hard.length} · ปัญหาเบา ${checked.soft.length}`)
    if (!checked.hard.length && !checked.soft.length) return { ok: true, plan: checked.plan, provider: res.provider, attempts: attempt, warnings: [] }
    if (!checked.hard.length && (!best || checked.soft.length < best.soft.length)) best = { ...checked, provider: res.provider, attempts: attempt }
    feedback = [...checked.hard, ...checked.soft].slice(0, 12)
    lastError = `ข้อความโปสเตอร์ไม่ผ่านการตรวจ: ${feedback.slice(0, 3).join(' · ')}`
  }
  if (best) return { ok: true, plan: best.plan, provider: best.provider, attempts: best.attempts, warnings: best.soft }
  return { ok: false, error: lastError || 'วางแผนข้อความโปสเตอร์ไม่สำเร็จ' }
}

// บรีฟครีเอทีฟรายคอนเทนต์สำหรับคำสั่งสร้างโปสเตอร์ (7 พ.ย. 2569 — เจ้าของขอ "เขียน prompt ให้ละเอียดขึ้น มีดีเทลแต่ละคอนเทนต์ ในมุมนักออกแบบและนักเขียนคอนเทนต์มืออาชีพ")
// = ก๊อปปี้เด็ค (ข้อความที่จะขึ้นบนภาพ คัดจากโพสต์คำต่อคำ) + อาร์ตไดเรกชัน (พื้นหลัง/พร็อพตามหัวข้อ ไอคอน จุดสีเดียว ลำดับสายตา กฎหดเนื้อหา) + เช็กลิสต์ตรวจภาพ
// รูปแบบถอดจากทีมวิจารณ์ 7 พ.ย. (ก๊อปปี้ไรเตอร์ + อาร์ตไดเรกเตอร์ + ผู้สรุป): ช่องที่ไม่ขึ้นบนภาพเขียนอังกฤษล้วน · ฉากห้ามมีของที่โมเดลชอบวาดตัวเลข/ข้อความ (ปฏิทิน มือถือ กองเหรียญที่อ่านเป็นราคา)
// ตัวนี้เป็น "ฐานแบบกำหนดกฎ" ที่มีเสมอ (ไม่ต้องมี AI) · ตัวรับงานบนคอมสำนักงานให้ AI ในเครื่องเขียนเวอร์ชันละเอียดกว่าแล้วตรวจคำต่อคำก่อนใช้ (server/poster-brief-ai.js)
// ใช้ได้ทั้งเซิร์ฟเวอร์ (server/marketing-image-jobs.js) และหน้าเว็บ (MarketingPage) — ห้าม import ของฝั่งเดียว
import { pickHeadlineKeyword } from './posterDesignSystem.js'
import { stripEmoji } from './captionEmoji.js'

const thaiWords = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null
export function wordCount(text) {
  const s = String(text || '').trim()
  if (!s) return 0
  if (!thaiWords) return s.split(/\s+/).length
  return [...thaiWords.segment(s)].filter((p) => p.isWordLike).length
}

const CAVEAT_RE = /ความรู้ทั่วไป|ไม่ใช่คำแนะนำเฉพาะราย|แต่ละกรณี/
const CTA_RE = /ทางแชต|ทักแชต|สอบถามข้อมูลเบื้องต้นกับ|ติดต่อ|ตอบกลับในแชท|ส่งรูป|ส่งข้อมูล|เดี๋ยวทีม|ทีม\s*AssetX|AssetX Estate|แอสเสทเอ็กซ์/i
const HASHTAG_RE = /(^|\s)#[\p{L}\p{M}\p{N}_]+/gu
// จุดตัดวรรคตามธรรมชาติ (คำเชื่อมที่ขึ้นวรรคใหม่) — ใช้ตัดรายละเอียดให้จบประโยคย่อย ไม่ตัดกลางรายการ
// (\b ใช้กับอักษรไทยไม่ได้ — ดูอักษรไทย/ช่องว่างถัดจากคำเชื่อมแทน) · ตัวแบ่งคำ ICU นับคำไทยละเอียดกว่าคนอ่าน ("ค่าใช้จ่าย" = 3 คำ) เพดานคำจึงตั้งเผื่อไว้ราว 1.3 เท่า
// (ไม่รวม และ/หรือ/กับ — นั่นคือรายการ ไม่ใช่อนุประโยค ถอยตรงนั้นแล้วรายการขาด "แยกจำนวนเงิน… ยอดสินไถ่" ทิ้ง "และค่าใช้จ่าย…")
const CLAUSE_BREAK_RE = /\s+(?=(?:เพราะ|โดย|ซึ่ง|หาก|ถ้า|เพื่อ|แล้ว|จึง|ไม่ควร|อย่า)(?:[ก-๙]|\s|$))/
const TRAILING_LINK_RE = /\s*(และ|หรือ|แต่|กับ|ที่|ของ|ให้|เพื่อ|โดย|ซึ่ง|จาก|ใน)$/

// อีโมจิในแคปชั่น (captionEmoji.js) ไม่ขึ้นโปสเตอร์ · 1️⃣ ต้นบรรทัดกลับเป็น "1." ให้ตัวอ่านโครงโพสต์ยังเห็นรายการเลข
export function cleanCaption(caption = '') {
  return stripEmoji(String(caption || '').replace(/\r\n?/g, '\n')).replace(HASHTAG_RE, '$1').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

// ตัดวลีให้อยู่ในช่วงจำนวนคำ: ตัดที่ช่องว่างถ้ามี (ภาษาไทยเว้นวรรคระหว่างวลี) ไม่งั้นตัดที่ขอบคำจากตัวแบ่งคำ · ถอยไปจุดคำเชื่อมถ้ายังยาวพอ
export function trimClause(text, { min = 5, max = 12, wholePhrases = false } = {}) {
  const s = String(text || '').replace(/\s+/g, ' ').trim().replace(/[.!?:：]+$/, '')
  if (wordCount(s) <= max) return s
  let out = ''
  if (s.includes(' ')) {
    const pieces = s.split(' ')
    let lastWords = 0
    for (const piece of pieces) {
      const next = out ? `${out} ${piece}` : piece
      // ชิ้นก่อนหน้าเป็นคำโดด ("ณ" ใน "หัก ณ ที่จ่าย") = ต้องพ่วงชิ้นถัดไปด้วยแม้เกินเพดาน ไม่งั้นค้างกลางวลี
      if (wordCount(next) > max && !(out && lastWords <= 1)) break
      out = next
      lastWords = wordCount(piece)
      if (wordCount(out) > max) break
    }
  }
  // wholePhrases: ตัดได้เฉพาะที่ช่องว่าง (หัวข้อ/ชื่อการ์ด — ตัดกลางวลีไทยแล้วอ่านไม่รู้เรื่อง เช่น "รวมค่าใช้|จ่าย") · ไม่ได้ = คืนค่าว่างให้ผู้เรียกตัดสินใจ
  if (wholePhrases) return wordCount(out) >= min ? out.replace(TRAILING_LINK_RE, '').trim() : ''
  // วลีเดียวไม่มีช่องว่างที่ยาวเกินเพดานนิดหน่อย: ใช้ทั้งวลี ดีกว่าตัดกลางคำประสม ("ผู้รับซื้อ|ฝาก")
  if ((!out || wordCount(out) < min) && !s.includes(' ') && wordCount(s) <= max + 4) return s
  if (!out || wordCount(out) < min) {
    // วลีเดียวไม่มีช่องว่าง (หรือชิ้นแรกยาวเกิน): ต่อทีละคำจากตัวแบ่งคำ
    const segs = thaiWords ? [...thaiWords.segment(s)].map((p) => p.segment) : s.split('')
    let acc = ''
    let n = 0
    for (const seg of segs) {
      const isWord = seg.trim() && !/^\s+$/.test(seg)
      if (isWord && n + 1 > max) break
      acc += seg
      if (isWord && /\p{L}|\p{N}/u.test(seg)) n += 1
    }
    out = acc.trim()
  }
  // ตัดค้างกลางรายการ (ส่วนที่เหลือขึ้นต้น และ/หรือ/กับ): พ่วงรายการสุดท้ายมาด้วยถ้าไม่ยาวเกินไป
  const rem = s.slice(out.length)
  const listTail = rem.match(/^\s*(?:และ|หรือ|กับ)\S*(?:\s+(?!และ|หรือ|กับ|พร้อม|โดย|ซึ่ง|เพราะ|หาก|ถ้า|เพื่อ)\S+){0,2}/)
  if (out !== s && listTail && wordCount(`${out}${listTail[0]}`) <= max + 6) out = `${out}${listTail[0]}`.trim()
  const parts = out.split(CLAUSE_BREAK_RE).filter(Boolean)
  if (parts.length > 1) {
    const cut = parts.slice(0, -1).join(' ').trim()
    if (wordCount(cut) >= min) out = cut
  }
  return out.replace(TRAILING_LINK_RE, '').trim()
}

function splitSentences(paragraph = '') {
  return String(paragraph || '').split(/(?<=[.!?])\s+|\s+·\s+|\s{2,}/).map((s) => s.trim()).filter(Boolean)
}

// แยกโพสต์เป็นย่อหน้า → หัวข้อ (ถ้าเขียน "หัวข้อ:") · ข้อเลขลำดับพร้อมรายละเอียด · ย่อหน้าเปิด (ก่อนข้อแรก) · ย่อหน้าปิด (หลังข้อสุดท้าย) — ไม่นับบรรทัดกำกับ/ชวนติดต่อ
export function parsePost({ title = '', caption = '' } = {}) {
  const text = cleanCaption(caption)
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  let headline = String(title || '').replace(/\s+/g, ' ').trim()
  const points = []
  const opening = []
  const closing = []
  for (const para of paragraphs) {
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean)
    const first = lines[0] || ''
    const topic = first.match(/^หัวข้อ\s*[:：]\s*(.+)$/)
    if (topic) { if (!headline) headline = topic[1].trim(); continue }
    const numbered = first.match(/^(\d{1,2})[.)]\s*(.+)$/)
    if (numbered) {
      points.push({ n: Number(numbered[1]), head: numbered[2].trim(), detail: lines.slice(1).join(' ').trim() })
      continue
    }
    if (CAVEAT_RE.test(para) && wordCount(para) <= 22) continue
    if (CTA_RE.test(para)) continue
    ;(points.length ? closing : opening).push(para)
  }
  return { headline, points, opening, closing, others: [...opening, ...closing], paragraphs }
}

// ไอคอนจากคำในข้อความ (ชุดไอคอนของระบบออกแบบ) — เรียงตามลำดับที่ทีมวิจารณ์ 7 พ.ย. กำหนด กฎแรกที่ตรงชนะ
const ICON_RULES = [
  [/^วัน(จด|ไถ่|ครบ|นัด|โอน|ชำระ)/, 'calendar'],
  [/มิจฉาชีพ|ปลอม|โกง|หลอก|ความเสี่ยง|ระวัง|ปลอดภัย|ข้อมูลส่วนบุคคล/, 'shield'],
  [/สำนักงานที่ดิน|ทำเล|ทางเข้า|ที่ตั้ง|พิกัด|สภาพจริง|พื้นที่|เดินทางไป/, 'map pin'],
  [/^จด|จดสิ่ง|รายการคำถาม|สิ่งที่รู้แล้ว|บันทึก|เช็กลิสต์/, 'notepad with a pen'],
  [/วันครบ|ครบกำหนด|กำหนดชำระ|ระยะเวลา|วันที่|ตาราง|นัด|ปฏิทิน|งวด|^วัน/, 'calendar'],
  [/ราคา|ค่าใช้จ่าย|ค่าธรรมเนียม|เงิน|สินไถ่|ยอด|วงเงิน|ภาษี|ดอกเบี้ย/, 'coins'],
  [/เปรียบเทียบ|คำนวณ|ประเมิน|ตัวเลข|แยกจำนวน|รวมค่า/, 'calculator'],
  [/ลงนาม|เซ็น|ข้อตกลง|ผู้ให้บริการ|คุยกับ|นายหน้า|ตกลง|สัญญา/, 'handshake'],
  [/โฉนด|เอกสาร|เงื่อนไข|สิทธิ์|สำเนา|หลักฐาน|ลายลักษณ์อักษร|สรุป/, 'document'],
  [/ตรวจ|เช็ก|เช็ค|สอบถาม|ถาม|^ดู/, 'magnifier'],
  [/บ้าน|คอนโด|ห้องชุด|อาคาร|ตึกแถว/, 'house'],
  [/(?<!สำนักงาน|กรม)ที่ดิน|แปลง|ไร่/, 'land plot'],
]
export function iconFor(text = '') {
  const s = String(text || '')
  for (const [re, icon] of ICON_RULES) if (re.test(s)) return icon
  return 'check mark'
}

// ฉากตามหัวข้อ = พื้นหลัง (ชั้น 1 เบลอ) + พร็อพโซนฮีโร่ (ชั้น 3 ≤ 2 ชิ้น) + สิ่งที่ห้าม — ทุกฉาก: ไม่มีตัวหนังสือ ตัวเลข ตรา หน้าจอ · ของที่โมเดลชอบวาดตัวเลข/ข้อความ (ปฏิทิน มือถือ กองเหรียญ) ไม่ใช้
// ดูหัวข้อ (+ริบบิ้น) ก่อน แล้วค่อยดูเนื้อหา · "สำนักงานที่ดิน/กรมที่ดิน" ไม่นับเป็นหัวข้อที่ดิน (เจอจริง: โพสต์ค่าใช้จ่ายเคยได้ฉากแปลงที่ดิน)
const DESK_BG = 'a bright Thai home-office desk beside a window at mid-morning, light-oak matte desktop filling the lower 70% of the frame, a white wall and a sheer-curtained window across the top, one key light from the top-left at 45 degrees, camera 3/4 top-down at 35 degrees elevation (50 mm look), bokeh like f/2.0, shadows tinted deep violet #4b2a82, navy-to-transparent scrim over the top 30% H; no people, no hands, no readable text anywhere'
const CONTRACT_PROP = 'PROP 1 = a navy clipboard holding a plain generic contract (white matte paper, text drawn only as grey line placeholders plus one signature line, no emblem, no digits, no stamp) tilted 8 degrees clockwise, a matte navy pen lying across it at 30 degrees, ONE cyan #42c7d8 paper tab clipped to the contract\'s right edge marking the clause to check'
const SCENE_RULES = [
  [/มิจฉาชีพ|ปลอม|โกง|หลอก|เตือนภัย|แก๊ง/, { background: 'a dark-navy desk under cool window light from the left, shallow depth of field, shadows tinted deep violet #4b2a82', props: 'PROP 1 = one plain generic title-deed document (grey placeholder lines, no emblem, no digits) under a round magnifier, one cyan check sticker on its corner; PROP 2 = none', never: 'never a villain, police, handcuffs, red stamps, warning triangles, padlocks or any person' }],
  [/ค่าใช้จ่าย|ค่าธรรมเนียม|สินไถ่|ดอกเบี้ย|ภาษี|เงินก้อน|วงเงิน|เงินทุน|ยอด/, { background: DESK_BG, props: `${CONTRACT_PROP}; PROP 2 = a small matte calculator with its display dark and blank, tucked under the clipboard's lower-left corner`, never: 'never coin piles, banknotes, price tags, digits on any display, a smartphone or a desk calendar (they read as prices or numbers)' }],
  [/(?<!สำนักงาน|กรม)ที่ดินเปล่า|(?<!สำนักงาน|กรม)ที่ดิน|แปลง|ไร่|สวน/, { background: 'an open land plot seen from slightly above eye level: four red-and-white concrete boundary pegs joined by a taut white string, short grass and bare soil inside, a treeline and farmland behind, late-afternoon sun from the left casting long soft shadows, background blurred to bokeh, navy-to-transparent scrim over the top 30% H', props: 'PROP 1 = the pegged plot itself framed in the hero zone; PROP 2 = none (optionally one plain survey sheet on a clipboard with grey placeholder lines)', never: 'never a for-sale sign, road sign, house number, numbers on the pegs or any person' }],
  [/คอนโด|ห้องชุด|อาคารชุด/, { background: 'a modern condominium facade with glass balconies and a small landscaped entrance, blue sky, warm afternoon light, blurred to bokeh, navy-to-transparent scrim over the top 30% H', props: 'PROP 1 = the building as an 8-degree cutout with a soft shadow; PROP 2 = a plain blank key card without logo or text, or none', never: 'never a project name, banner, price or any person' }],
  [/โฉนด|เอกสาร|สัญญา|เงื่อนไข|ไถ่|จดทะเบียน|มอบอำนาจ|ลงนาม/, { background: DESK_BG, props: `${CONTRACT_PROP}; PROP 2 = a pair of folded reading glasses beside the clipboard (reading the fine print), or none`, never: 'never a Garuda, seal, stamp, QR code, a signature with a readable name, a smartphone or a desk calendar' }],
  [/ขายบ้าน|ฝากขาย|ขายทรัพย์|นายหน้า|ประกาศขาย|ตั้งราคา/, { background: 'a quiet Thai suburban street with greenery, warm afternoon light, blurred to bokeh, navy-to-transparent scrim over the top 30% H', props: 'PROP 1 = a modern two-storey Thai house render with a small front garden and driveway as a 6-degree cutout with a soft shadow; PROP 2 = a navy clipboard with a blank listing sheet (grey lines and one empty photo box)', never: 'never a SOLD or for-sale sign, price tag, phone number on a board or any person' }],
  [/ซื้อบ้าน|ซื้อคอนโด|ก่อนซื้อ|ผู้ซื้อ|มือสอง|บ้าน|บ้านเดี่ยว|ทาวน์เฮาส์|ตึกแถว/, { background: 'a quiet Thai suburban street with greenery, warm afternoon light, blurred to bokeh, navy-to-transparent scrim over the top 30% H', props: 'PROP 1 = a modern two-storey Thai house render with a small front garden and driveway as a 6-degree cutout with a soft shadow; PROP 2 = a round magnifier over a plain document with grey placeholder lines, or none', never: 'never a house number, nameplate, sign, keys with tags, price tag or any person' }],
  [/ปรึกษา|คำแนะนำ|ควรทำอย่างไร|ทางเลือก|เตรียมตัว/, { background: 'a bright consultation desk with two chairs out of focus, window light from the top-left, blurred to bokeh, navy-to-transparent scrim over the top 30% H', props: 'PERSON optional = a friendly generic Thai advisor (navy blazer, cyan accent, not a real person, no name, head-and-shoulders at most 30% H) pointing at the ribbon; PROPS if no person = a plain document with a navy pen and a small white house model', never: 'never a name tag, badge, lanyard text or company sign' }],
]
const DEFAULT_SCENE = { background: DESK_BG, props: 'PROP 1 = a small modern Thai house model; PROP 2 = a plain document (grey placeholder lines) with a navy pen', never: 'never a person, digits, emblems or price tags' }
export function sceneFor(title = '', caption = '') {
  for (const text of [String(title || ''), String(caption || '')]) {
    if (!text) continue
    for (const [re, scene] of SCENE_RULES) if (re.test(text)) return scene
  }
  return DEFAULT_SCENE
}
export const sceneText = (scene) => `${scene.background}. Hero props: ${scene.props}; ${scene.never}`

// ชิปแถบล่าง 2 คำจากหัวข้อแถว: ตัดกริยานำ (ตรวจ/เช็ก/สอบถาม/เปรียบเทียบ) แล้วเอาวลีนามแรกก่อนคำเชื่อม (เช่น "ตรวจวันครบกำหนดและ…" → "วันครบกำหนด")
export function chipFromTitle(title = '') {
  let s = String(title || '').replace(/^(ตรวจสอบ|ตรวจ|เช็ก|เช็ค|สอบถาม|เปรียบเทียบ|เตรียม|ดู|ขอ|แยก)/, '').trim()
  s = s.split(/\s+|(?=และ|หรือ|กับ|พร้อม|ก่อน|ให้|ที่|ใน)/).filter(Boolean)[0] || ''
  s = s.replace(TRAILING_LINK_RE, '').trim()
  const n = wordCount(s)
  return n >= 2 && n <= 4 && s.length <= 16 ? s : ''
}

// ก๊อปปี้เด็คแบบกำหนดกฎ: ทุกสตริงคัดจากโพสต์ (ตัดให้สั้นลงได้ แต่ไม่แต่งคำ)
export function extractPosterCopy({ title = '', caption = '' } = {}) {
  const post = parsePost({ title, caption })
  const headline = post.headline || title
  const keyWord = pickHeadlineKeyword(headline)
  const openingSentences = post.opening.flatMap((p) => splitSentences(p))

  // ริบบิ้น = วลีประโยชน์จากย่อหน้าเปิด (4–12 คำ): วรรคที่บอกว่า "ควร/ต้อง/ช่วย/รู้/คุ้ม" มาก่อน ไม่งั้นวรรคที่ยาวพอ
  const openingClauses = openingSentences.flatMap((s) => s.split(/\s+(?=(?:ควร|ต้อง|อย่า|ลอง|เพื่อ|แต่|แล้ว))|\s*[,，]\s*/)).map((c) => c.replace(/[""“”]/g, '').replace(/^(แต่|แล้ว)\s*/, '').trim()).filter(Boolean)
  const ribbonSource = openingClauses.find((c) => /ควร|ต้อง|ช่วย|รู้|คุ้ม/.test(c) && wordCount(c) >= 5)
    || openingClauses.find((c) => wordCount(c) >= 5) || openingClauses[0] || ''
  const ribbon = ribbonSource ? trimClause(ribbonSource, { min: 4, max: 14 }) : ''

  // แถว = หัวข้อ (บรรทัดข้อ ≤ 15 คำ ใช้ทั้งข้อ ไม่ตัดกลางวลี) + รายละเอียด (ส่วนหลัง ":" หรือบรรทัดถัดไป 8–22 คำ จบที่วรรค) · ข้อสั้นที่ไม่มีรายละเอียด = หัวข้ออย่างเดียว
  const rows = post.points.slice(0, 5).map((p) => {
    const [headPart, ...rest] = p.head.split(/\s*[:：]\s*/)
    const tail = [rest.join(' '), p.detail].filter(Boolean).join(' ').trim()
    const titleFull = headPart.trim()
    const rowTitle = wordCount(titleFull) <= 15 ? titleFull : (trimClause(titleFull, { min: 3, max: 10, wholePhrases: true }) || titleFull)
    let detail = ''
    if (tail) detail = trimClause(splitSentences(tail)[0] || tail, { min: 8, max: 22 })
    if (detail && (rowTitle.includes(detail) || detail.includes(rowTitle))) detail = ''
    return { title: rowTitle, detail, icon: iconFor(rowTitle) === 'check mark' ? iconFor(detail) : iconFor(rowTitle) }
  })

  // ชื่อการ์ด = วลีในเครื่องหมายคำพูดของย่อหน้าเปิด (ที่มีคำเน้น ไม่งั้นอันท้ายสุด) · ไม่มีก็วรรคสั้น 2–4 คำที่ขึ้นต้น ก่อน/เมื่อ/ถ้า และไม่ซ้ำริบบิ้น/คำพาดหัว · ไม่มีก็ 2–4 คำแรกของประโยคเปิด
  const headWords = thaiWords ? [...thaiWords.segment(headline)].filter((p) => p.isWordLike).map((p) => p.segment).filter((w) => w.length >= 4) : []
  let cardTitle = ''
  const quoted = (post.opening.join(' ').match(/["“]([^"”]{3,30})["”]/g) || []).map((q) => q.replace(/["“”]/g, '').trim()).filter((p) => wordCount(p) <= 4 && p !== headline && p !== ribbon)
  if (quoted.length) cardTitle = quoted.find((p) => keyWord && p.includes(keyWord)) || quoted[quoted.length - 1]
  // วลีนามที่บอกว่าแถวคืออะไร ซ่อนอยู่ในเนื้อหาได้ทุกที่ ("รายการที่ต้องตรวจ" "สิ่งที่ต้องเตรียม" "ข้อควรรู้") — ทีมวิจารณ์เลือกแบบนี้ให้โพสต์ #4
  if (!cardTitle) {
    const m = cleanCaption(caption).match(/(รายการที่ต้อง(?:ตรวจ|เตรียม|รู้|ทำ|เช็ก|ถาม)|สิ่งที่ต้อง(?:ตรวจ|เตรียม|รู้|ทำ|เช็ก|ถาม)|ข้อควรรู้|ข้อควรระวัง|เช็กลิสต์|สิ่งที่ควร(?:ทำ|รู้|เช็ก))/)
    if (m && !headline.includes(m[1]) && m[1] !== ribbon) cardTitle = m[1]
  }
  for (const c of cardTitle ? [] : openingClauses) {
    const m = c.match(/^(ก่อน|เมื่อ|ถ้า|หาก)\S*(?:\s+\S+){0,2}/)
    if (m && wordCount(m[0]) <= 4 && m[0] !== ribbon && !headWords.some((w) => m[0].includes(w))) { cardTitle = m[0].trim(); break }
  }
  if (!cardTitle && openingSentences[0]) cardTitle = trimClause(openingSentences[0], { min: 2, max: 4, wholePhrases: true })
  if (cardTitle === ribbon) cardTitle = ''

  // แผงลงมือทำ: หัวข้อ = วรรคนำ "ก่อน…" ของย่อหน้าปิด (มีหรือไม่มีเครื่องหมาย :) · ข้อ = ประโยคสั่งทำ (ขอ/เทียบ/จด/เตรียม/อย่า/ควร/ต้อง) ที่ไม่ใช่แถวการ์ด
  let actionTitle = ''
  const actionItems = []
  const ACTION_RE = /ขอ|เทียบ|จด|เตรียม|อย่า|ควร|ต้อง|เช็ก|ตรวจ|ปิด|สอบถาม|ถาม/
  for (const para of post.closing) {
    const lead = para.match(/^(ก่อน\S*(?:\s+(?!ขอ|จด|เทียบ|เตรียม|ตรวจ|เช็ก|ควร|ต้อง|อย่า|ถาม)\S+){0,4})\s*[:：]?\s+/)
    if (lead && !actionTitle && wordCount(lead[1]) <= 6) actionTitle = lead[1].replace(/[:：]\s*$/, '').trim()
    const body = lead ? para.slice(lead[0].length) : para
    for (const s of splitSentences(body)) {
      for (const clause of s.split(/\s+(?=(?:แล้ว|และ|พร้อม)?\s*(?:เทียบ|ขอ|จด|เตรียม|ตรวจ|เช็ก)\S)/)) {
        const c = clause.replace(/^(แล้ว|และ|พร้อม)\s*/, '').replace(/\s*(จะช่วยให้|เพื่อให้)[^]*$/, '').trim()
        if (ACTION_RE.test(c) && wordCount(c) >= 4 && actionItems.length < 3) actionItems.push(trimClause(c, { min: 5, max: 15 }))
      }
    }
  }
  if (!actionItems.length) {
    // ไม่มีย่อหน้าปิด: ใช้ประโยคเตือนในย่อหน้าเปิด (อย่า…/ควร…/ต้อง…) ที่ไม่ใช่ริบบิ้น
    for (const c of openingClauses) if (/อย่า|ควร|ต้อง/.test(c) && c !== ribbon && !c.includes(ribbon) && actionItems.length < 2) actionItems.push(trimClause(c, { min: 4, max: 12 }))
  }
  // กล่องเตือน: ประโยค อย่า/ห้าม/ระวัง/ไม่ควร ที่ยังไม่ได้ใช้ (≤ 12 คำ) — ค้นทั้งย่อหน้าเปิด/ปิดและรายละเอียดของข้อย่อย (ทีมวิจารณ์: คำเตือนดี ๆ มักซ่อนอยู่ในข้อ)
  const used = new Set([ribbon, ...actionItems, ...rows.map((r) => r.title), ...rows.map((r) => r.detail)].filter(Boolean))
  let callout = ''
  const pool = [...post.others, ...post.points.map((p) => `${p.head} ${p.detail}`)]
  const warnings = pool.flatMap((para) => splitSentences(para).flatMap((x) => x.split(/\s+(?=(?:อย่า|ห้าม|ระวัง|ไม่ควร))/))).map((s) => s.trim())
    .filter((c) => /^(อย่า|ห้าม|ระวัง|ไม่ควร)/.test(c) && ![...used].some((u) => c.includes(u) || u.includes(c)) && wordCount(c) >= 4 && wordCount(c) <= 14)
  // "อย่า/ห้าม/ระวัง" (คำเตือนตรง ๆ) มาก่อน "ไม่ควร"
  const pick = warnings.find((c) => /^(อย่า|ห้าม|ระวัง)/.test(c)) || warnings[0]
  if (pick) callout = trimClause(pick, { min: 4, max: 12 })
  // ชิปแถบล่าง = วลีนาม 2 คำจากหัวข้อแถว 1–2
  const bandChips = rows.slice(0, 2).map((r) => chipFromTitle(r.title)).filter(Boolean)
  return { headline, keyWord, ribbon, cardTitle, rows, actionTitle, actionItems, callout, bandChips: bandChips.length >= 2 ? bandChips : [], cta: 'ติดต่อ AssetX Estate' }
}

// ตรวจว่าสตริงที่จะขึ้นบนภาพมาจากโพสต์คำต่อคำ (ยุบช่องว่างและเครื่องหมายคำพูด/วรรคตอนก่อนเทียบ — โพสต์เขียน คือ "ค่าใช้จ่ายรวม" แต่บนภาพไม่ต้องมีเครื่องหมาย) — ใช้กับบรีฟที่ AI เขียนก่อนเชื่อ
export function verbatimMisses(copy = {}, { title = '', caption = '' } = {}) {
  const squash = (s) => String(s || '').replace(/[\s"“”'‘’,.!?:：()]+/g, '')
  const hay = squash(stripEmoji(`${title}\n${caption}`))
  const strings = [copy.ribbon, copy.cardTitle, copy.actionTitle, copy.callout, ...(copy.rows || []).flatMap((r) => [r.title, r.detail]), ...(copy.actionItems || []), ...(copy.bandChips || [])]
  return strings.filter((s) => s && !hay.includes(squash(s)))
}

// บรีฟเป็นบรรทัดคำสั่งภาษาอังกฤษ (ข้อความไทยในเครื่องหมายคำพูดคือก๊อปปี้สุดท้าย) · extras = ช่องเสริมจาก AI (อังกฤษล้วน): bigIdea · mood · summaryTest · scene/props ที่เจาะจงกว่า
export function buildCreativeBrief(copy, { title = '', caption = '', layout = 'steps', source = 'rule-based', extras = {} } = {}) {
  const scene = sceneFor(copy.headline || title, caption)
  const q = (s) => `"${String(s || '').trim()}"`
  const marker = layout === 'checklist' || layout === 'warning' ? 'cyan check circle' : layout === 'qa' ? 'cyan icon circle' : 'navy number badge'
  const rows = copy.rows || []
  const actions = copy.actionItems || []
  const chips = copy.bandChips || []
  const casualties = [copy.callout ? 'the callout' : '', chips.length ? 'the band chips' : '', actions.length > 2 ? 'action item 3' : ''].filter(Boolean)
  const lines = [
    `CREATIVE BRIEF for this post (${source}; follow it exactly - the quoted Thai strings are the final copy, every other Thai word in POST CONTENT is context only; never add, drop or respell a character):`,
    extras.bigIdea ? `- Big idea (for the designer, never printed): ${extras.bigIdea}` : '',
    `- Headline: ${q(copy.headline)} · key word in the cyan-to-coral gradient: ${q(copy.keyWord || '')} - every character of that word and nothing else (never a syllable); every other headline character stays white-to-pale-cyan; one small cyan arrow beside the key word pointing at the ribbon is the only decorative mark.`,
    copy.ribbon ? `- Benefit ribbon: ${q(copy.ribbon)} on ONE line, navy tier-2 text, cyan brush stroke about 55-65% W x 5% H rotated -2 degrees directly under the headline, ending before the hero props.` : '- Benefit ribbon: none (leave the ribbon out).',
    copy.cardTitle ? `- Main card title pill: ${q(copy.cardTitle)} · pill icon ${iconFor(copy.cardTitle)} (cyan circle straddling the pill's left edge) · layout ${layout}.` : `- Main card: no title pill · layout ${layout}.`,
    ...rows.map((r, i) => `- Row ${i + 1} (${marker}${marker === 'navy number badge' ? ` ${i + 1}` : ''} · icon ${r.icon}): title ${q(r.title)}${r.detail ? ` · detail ${q(r.detail)} (a new fact the title does not say)` : ' · no detail line'}`),
    rows.length ? `  (${rows.length} rows, all markers on one vertical line at an even 9-11% H pitch, 1 px hairlines between rows, card sized to these rows)` : '',
    actions.length ? `- Action panel${copy.actionTitle ? ` titled ${q(copy.actionTitle)}` : ' (no title)'}: ${actions.map((a, i) => `item ${i + 1} ${q(a)} (icon ${iconFor(a)})`).join(' · ')}; navy tier-3 text, each item may wrap to 2 lines, 4% W pale-cyan icon circles aligned to the card rows' left line.` : '- Action panel: none.',
    copy.callout ? `- Callout chip (${layout === 'warning' ? 'coral - the poster\'s only coral' : 'navy'}, white tier-3 text, at most 60% W, 2% H above the band): ${q(copy.callout)}` : '- Callout chip: none.',
    `- CTA pill: ${q(copy.cta || 'ติดต่อ AssetX Estate')} (cyan pill, navy text, at most 40% W, left of the band)${chips.length ? ` · band chips right: ${chips.map((c) => `${q(c)} (icon ${iconFor(c)})`).join(' · ')}` : ' · band chips: none'}.`,
    `- Background scene (layer 1, full bleed, blurred): ${extras.background || scene.background}.`,
    `- Hero props (layer 3, top-right 36% W x 24% H, may bleed off the right edge, never over any text, never below the main card's top edge): ${extras.props || scene.props}; crisp cutout edges, one soft violet-navy contact shadow offset 1.5% W bottom-right; ${scene.never}; no digits, letters, emblems, stamps or screens with UI anywhere.`,
    `- Single coral: the headline key-word gradient only; the callout chip is ${layout === 'warning' ? 'coral' : 'navy'}, pens are navy, paper tabs are cyan, badges are navy with cyan rings, the ribbon is cyan; no red anywhere.`,
    `- Eye path: 1) ${q(copy.keyWord || copy.headline)} (largest, the only coral) 2) the cyan ribbon 3) the ${marker}s down the card's left edge${actions.length ? ` 4) the action pill${copy.actionTitle ? ` ${q(copy.actionTitle)}` : ''}` : ''}${copy.callout ? ' 5) the callout' : ''} 6) the cyan CTA pill; the hero props are glimpsed between 1 and 2 and never compete with the headline.`,
    `- Fit rule: ${rows.length} rows + ${actions.length} action items + callout ${copy.callout ? 'yes' : 'no'}; if the content runs out of height drop ${casualties.length ? casualties.join(', then ') : 'nothing'} first, then set tier-3 text at 28 px; never shrink the headline or the ribbon, never cut a row mid-clause, never let props, scrim or bokeh highlights sit behind text; card sized to its rows, action panel 10-14% H, bottom band on the lower edge of the usable area (directly above the lower letterbox bar when one is given).`,
    `- Mood: ${extras.mood || 'calm, orderly, careful, in-control, bright; warm oak and daylight against cool navy-cyan UI, matte materials only'}; premium Thai property-advisory look; no alarm red, no loan-shop gold, no neon glow, no lens flare.`,
    `- Review before finishing: every quoted Thai string above appears exactly once, spelled exactly, nothing added, no trailing periods or quotation marks; no phone number, LINE ID, price, percentage, Garuda, seal or digit on the props; the logo X once top-right on a white chip with no text beside it${extras.summaryTest ? `; with the caption hidden a reader must be able to say: ${extras.summaryTest}` : '; with the caption hidden a reader must be able to say what the post is about, the key checks and the action'}.`,
  ].filter(Boolean)
  return lines.join('\n')
}

export function posterBriefFor({ title = '', caption = '', layout = 'steps' } = {}) {
  const copy = extractPosterCopy({ title, caption })
  return { copy, brief: buildCreativeBrief(copy, { title, caption, layout }) }
}

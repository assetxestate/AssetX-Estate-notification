// บรีฟครีเอทีฟรายคอนเทนต์สำหรับคำสั่งสร้างโปสเตอร์ (7 พ.ย. 2569 — เจ้าของขอ "เขียน prompt ให้ละเอียดขึ้น มีดีเทลแต่ละคอนเทนต์ ในมุมนักออกแบบและนักเขียนคอนเทนต์มืออาชีพ")
// = ก๊อปปี้เด็ค (ข้อความที่จะขึ้นบนภาพ คัดจากโพสต์คำต่อคำ) + อาร์ตไดเรกชัน (ฉาก ไอคอน จุดเน้น ลำดับการอ่าน) + เช็กลิสต์ตรวจภาพ
// ตัวนี้เป็น "ฐานแบบกำหนดกฎ" ที่มีเสมอ (ไม่ต้องมี AI) · ตัวรับงานบนคอมสำนักงานให้ AI ในเครื่องเขียนเวอร์ชันละเอียดกว่าแล้วตรวจคำต่อคำก่อนใช้ (scripts/image-worker.mjs)
// ใช้ได้ทั้งเซิร์ฟเวอร์ (server/marketing-image-jobs.js) และหน้าเว็บ (MarketingPage) — ห้าม import ของฝั่งเดียว
import { pickHeadlineKeyword } from './posterDesignSystem.js'

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
const CLAUSE_BREAK_RE = /\s+(?=(?:และ|หรือ|แต่|เพราะ|โดย|ซึ่ง|พร้อม|หาก|ถ้า|เพื่อ|แล้ว|จึง|ไม่ควร|อย่า)(?:[ก-๙]|\s|$))/

export function cleanCaption(caption = '') {
  return String(caption || '').replace(/\r\n?/g, '\n').replace(HASHTAG_RE, '$1').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

// ตัดวลีให้อยู่ในช่วงจำนวนคำ: ตัดที่ช่องว่างถ้ามี (ภาษาไทยเว้นวรรคระหว่างวลี) ไม่งั้นตัดที่ขอบคำจากตัวแบ่งคำไทย · ถอยไปจุดคำเชื่อมถ้ายังยาวพอ
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
  if (wholePhrases) return wordCount(out) >= min ? out.replace(/\s*(และ|หรือ|แต่|กับ|ที่|ของ|ให้|เพื่อ|โดย|ซึ่ง|จาก|ใน)$/, '').trim() : ''
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
  const parts = out.split(CLAUSE_BREAK_RE).filter(Boolean)
  if (parts.length > 1) {
    const cut = parts.slice(0, -1).join(' ').trim()
    if (wordCount(cut) >= min) out = cut
  }
  return out.replace(/\s*(และ|หรือ|แต่|กับ|ที่|ของ|ให้|เพื่อ|โดย|ซึ่ง|จาก|ใน)$/, '').trim()
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

// ไอคอนต่อแถวจากคำในข้อความ (ชุดไอคอนของระบบออกแบบ)
const ICON_RULES = [
  [/มิจฉาชีพ|ปลอม|โกง|หลอก|ความเสี่ยง|ระวัง|ปลอดภัย/, 'shield'],
  [/วันครบ|กำหนด|ระยะเวลา|วันที่|ตาราง|นัด|^วัน/, 'calendar'],
  [/ราคา|ค่าใช้จ่าย|ค่าธรรมเนียม|เงิน|สินไถ่|ยอด|วงเงิน|ภาษี/, 'coins'],
  [/เปรียบเทียบ|คำนวณ|ประเมิน/, 'calculator'],
  [/ทำเล|ทางเข้า|ที่ตั้ง|พิกัด|สภาพจริง|พื้นที่/, 'map pin'],
  [/สัญญา|เงื่อนไข|ลงนาม|เซ็น|ข้อตกลง/, 'handshake'],
  [/โฉนด|เอกสาร|สิทธิ์|สำเนา|หลักฐาน/, 'document'],
  [/ตรวจ|เช็ก|เช็ค|สอบถาม|ถาม/, 'magnifier'],
  [/บ้าน|คอนโด|ห้องชุด|อาคาร/, 'house'],
  [/ที่ดิน|แปลง/, 'land plot'],
]
export function iconFor(text = '') {
  const s = String(text || '')
  for (const [re, icon] of ICON_RULES) if (re.test(s)) return icon
  return 'check mark'
}

// ฉากโซนฮีโร่ตามหัวข้อ — อาร์ตไดเรกชันที่เจาะจง (วัตถุ แสง มุมกล้อง ความลึก) แทนคำกว้าง ๆ
// "ที่ดิน" ใน "สำนักงานที่ดิน/กรมที่ดิน" ไม่ใช่หัวข้อที่ดิน (เจอจริง: โพสต์ค่าใช้จ่ายได้ฉากแปลงที่ดิน) · ดูจากหัวข้อก่อน แล้วค่อยดูเนื้อหา
const SCENE_RULES = [
  [/มิจฉาชีพ|ปลอม|โกง|หลอก|เตือนภัย/, 'a plain generic title-deed document (no emblem, no numbers) lying on a dark desk under a round magnifier, one cyan check mark sticker on its corner, cool window light from the left, shallow depth of field - the only prop; no person, no villain, no police'],
  [/ค่าใช้จ่าย|ค่าธรรมเนียม|สินไถ่|ดอกเบี้ย|ภาษี|เงินก้อน|วงเงิน|เงินทุน/, 'a plain generic document on a clipboard with a black pen laid across it, two neat coin stacks and a small calculator beside it on a light wooden desk, soft window light from the top-left, shallow depth of field'],
  [/(?<!สำนักงาน|กรม)ที่ดิน|แปลง|ไร่|สวน/, 'an open land plot seen from slightly above eye level: four red-and-white concrete boundary pegs joined by a taut white string, short grass and bare soil inside, a treeline and farmland behind, late-afternoon sun from the left casting long soft shadows, background blurred to bokeh'],
  [/คอนโด|ห้องชุด/, 'a modern condominium facade with glass balconies and a small landscaped entrance, blue sky, warm afternoon light, the building tilted 8 degrees as a cutout with a soft shadow'],
  [/โฉนด|เอกสาร|สัญญา|เงื่อนไข|ไถ่|จดทะเบียน|มอบอำนาจ/, 'a plain generic title-deed document (no emblem, no numbers) on a navy clipboard with a black pen laid across it, on a light wooden desk, soft window light from the top-left, shallow depth of field, tilted 8 degrees as a cutout with a soft shadow'],
  [/ขายบ้าน|ฝากขาย|ขายทรัพย์|ซื้อบ้าน|บ้าน/, 'a modern two-storey Thai house render with a small front garden and a driveway, warm afternoon light, blue sky, tilted 6 degrees as a cutout with a soft shadow'],
  [/จำนอง|ขายฝาก|ทรัพย์/, 'a modern Thai house render beside a plain generic document and a black pen, on a light wooden desk, soft window light from the top-left, shallow depth of field'],
]
export function sceneFor(title = '', caption = '') {
  for (const text of [String(title || ''), String(caption || '')]) {
    if (!text) continue
    for (const [re, scene] of SCENE_RULES) if (re.test(text)) return scene
  }
  return 'a calm consultation desk: a plain generic document, a black pen and a small house model, soft window light from the top-left, shallow depth of field'
}

// ก๊อปปี้เด็คแบบกำหนดกฎ: ทุกสตริงคัดจากโพสต์ (ตัดให้สั้นลงได้ แต่ไม่แต่งคำ)
export function extractPosterCopy({ title = '', caption = '' } = {}) {
  const post = parsePost({ title, caption })
  const headline = post.headline || title
  const keyWord = pickHeadlineKeyword(headline)
  const openingSentences = post.opening.flatMap((p) => splitSentences(p))

  // ริบบิ้น = วลีประโยชน์จากย่อหน้าเปิด (4–10 คำ): วรรคที่บอกว่า "ควร/ต้อง/ช่วย/ได้/รู้" มาก่อน ไม่งั้นวรรคที่ยาวพอ (ภาษาไทยไม่มีขอบคำแบบ \b — แยกวรรคที่ช่องว่างหน้าคำเหล่านี้)
  const openingClauses = openingSentences.flatMap((s) => s.split(/\s+(?=(?:ควร|ต้อง|อย่า|ลอง|เพื่อ|แต่|แล้ว))|\s*[,，]\s*/)).map((c) => c.replace(/[""“”]/g, '').replace(/^(แต่|แล้ว)\s*/, '').trim()).filter(Boolean)
  const ribbonSource = openingClauses.find((c) => /ควร|ต้อง|ช่วย|รู้|คุ้ม/.test(c) && wordCount(c) >= 5)
    || openingClauses.find((c) => wordCount(c) >= 5) || openingClauses[0] || ''
  const ribbon = ribbonSource ? trimClause(ribbonSource, { min: 4, max: 14 }) : ''

  // แถว = หัวข้อ (บรรทัดข้อ ≤ 12 คำ ใช้ทั้งข้อ ไม่ตัดกลางวลี) + รายละเอียด (ส่วนหลัง ":" หรือบรรทัดถัดไป 8–18 คำ จบที่วรรค) · ข้อสั้นที่ไม่มีรายละเอียด = หัวข้ออย่างเดียว
  const rows = post.points.slice(0, 5).map((p) => {
    const [headPart, ...rest] = p.head.split(/\s*[:：]\s*/)
    const tail = [rest.join(' '), p.detail].filter(Boolean).join(' ').trim()
    const titleFull = headPart.trim()
    const title = wordCount(titleFull) <= 15 ? titleFull : (trimClause(titleFull, { min: 3, max: 10, wholePhrases: true }) || titleFull)
    let detail = ''
    if (tail) detail = trimClause(splitSentences(tail)[0] || tail, { min: 8, max: 22 })
    if (detail && (title.includes(detail) || detail.includes(title))) detail = ''
    return { title, detail, icon: iconFor(title) === 'check mark' ? iconFor(detail) : iconFor(title) }
  })

  // ชื่อการ์ด = วรรคสั้น 2–4 คำจากย่อหน้าเปิดที่ขึ้นต้น ก่อน/เมื่อ/ถ้า และไม่ซ้ำริบบิ้น/คำพาดหัว · ไม่มีก็ใช้ 2–4 คำแรกของประโยคเปิด
  const headWords = thaiWords ? [...thaiWords.segment(headline)].filter((p) => p.isWordLike).map((p) => p.segment).filter((w) => w.length >= 4) : []
  let cardTitle = ''
  // วลีในเครื่องหมายคำพูดของย่อหน้าเปิด ("ค่าใช้จ่ายรวม") มักเป็นชื่อเรื่องของแถว — เลือกอันที่มีคำเน้นของพาดหัวก่อน ไม่งั้นอันท้ายสุด (มักเป็นคำตอบ ไม่ใช่คำถาม)
  const quoted = (post.opening.join(' ').match(/["“]([^"”]{3,30})["”]/g) || []).map((q) => q.replace(/["“”]/g, '').trim()).filter((p) => wordCount(p) <= 4 && p !== headline && p !== ribbon)
  if (quoted.length) cardTitle = quoted.find((p) => keyWord && p.includes(keyWord)) || quoted[quoted.length - 1]
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
      // แยกเป็นข้อ ๆ ที่คำกริยาสั่งทำ (ขอ/จด/เทียบ/เตรียม/ตรวจ/เช็ก) และที่ "และ" เมื่อวรรคถัดไปขึ้นต้นด้วยคำนามสิ่งที่ต้องทำ
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
  // กล่องเตือน: ประโยค อย่า/ห้าม/ระวัง ที่ยังไม่ได้ใช้ (ไม่เกิน 12 คำ)
  const used = new Set([ribbon, ...actionItems, ...rows.map((r) => r.title)])
  let callout = ''
  for (const para of [...post.others]) for (const s of splitSentences(para)) {
    if (/อย่า|ห้าม|ระวัง|ไม่ควร/.test(s) && ![...used].some((u) => u && (s.includes(u) || u.includes(s))) && wordCount(s) <= 12) { callout = trimClause(s, { min: 4, max: 12 }); break }
  }
  return { headline, keyWord, ribbon, cardTitle, rows, actionTitle, actionItems, callout, cta: 'ติดต่อ AssetX Estate' }
}

// ตรวจว่าสตริงที่จะขึ้นบนภาพมาจากโพสต์คำต่อคำ (ยุบช่องว่างก่อนเทียบ) — ใช้กับบรีฟที่ AI เขียนก่อนเชื่อ
export function verbatimMisses(copy = {}, { title = '', caption = '' } = {}) {
  // ยุบช่องว่างและเครื่องหมายคำพูด/วรรคตอนก่อนเทียบ — โพสต์เขียน คือ "ค่าใช้จ่ายรวม" แต่บนภาพไม่ต้องมีเครื่องหมายคำพูด
  const squash = (s) => String(s || '').replace(/[\s"“”'‘’,.!?:：()]+/g, '')
  const hay = squash(`${title}\n${caption}`)
  const strings = [copy.ribbon, copy.cardTitle, copy.actionTitle, copy.callout, ...(copy.rows || []).flatMap((r) => [r.title, r.detail]), ...(copy.actionItems || [])]
  return strings.filter((s) => s && !hay.includes(squash(s)))
}

// บรีฟเป็นบรรทัดคำสั่งภาษาอังกฤษ (ข้อความไทยในเครื่องหมายคำพูดคือก๊อปปี้สุดท้าย)
export function buildCreativeBrief(copy, { title = '', caption = '', layout = 'steps', source = 'rule-based' } = {}) {
  const scene = sceneFor(copy.headline || title, caption)
  const q = (s) => `"${String(s || '').trim()}"`
  const lines = [
    `CREATIVE BRIEF for this post (${source}; follow it exactly - the quoted Thai strings are the final copy, the POST CONTENT above is context only):`,
    `- Headline: ${q(copy.headline)} · key word in the gradient: ${q(copy.keyWord || '')}`,
    copy.ribbon ? `- Benefit ribbon: ${q(copy.ribbon)}` : '- Benefit ribbon: none (leave the ribbon out)',
    copy.cardTitle ? `- Main card title pill: ${q(copy.cardTitle)}` : '',
    ...(copy.rows || []).map((r, i) => `- Row ${i + 1} (${layout === 'checklist' || layout === 'warning' ? 'cyan check circle' : 'navy number badge'} · icon ${r.icon}): title ${q(r.title)}${r.detail ? ` · detail ${q(r.detail)}` : ' · no detail line'}`),
    copy.actionItems?.length ? `- Action panel${copy.actionTitle ? ` titled ${q(copy.actionTitle)}` : ' (no title)'}: ${copy.actionItems.map((a, i) => `item ${i + 1} ${q(a)} (icon ${iconFor(a)})`).join(' · ')}` : '- Action panel: none',
    copy.callout ? `- Callout chip (navy): ${q(copy.callout)}` : '- Callout chip: none',
    `- CTA pill: ${q(copy.cta || 'ติดต่อ AssetX Estate')} · band chips: none unless two-word labels exist in the post`,
    `- Hero zone scene: ${scene}`,
    `- Eye path: 1) the headline key word, 2) the ribbon, 3) the card title, then rows top to bottom, then the action panel, last the CTA; nothing else competes for attention.`,
    `- Accent: the single coral element is the headline key-word gradient; everything else navy, white and cyan.`,
    '- Review before finishing: every Thai string above appears exactly once, spelled exactly; no extra words; the poster reads as a complete story without the caption.',
  ].filter(Boolean)
  return lines.join('\n')
}

export function posterBriefFor({ title = '', caption = '', layout = 'steps' } = {}) {
  const copy = extractPosterCopy({ title, caption })
  return { copy, brief: buildCreativeBrief(copy, { title, caption, layout }) }
}

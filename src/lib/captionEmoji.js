// อีโมจิในแคปชั่นโพสต์ (เจ้าของขอ 10 พ.ย. 2569: "เพิ่มอีโมจิในคอนเทนต์เพื่อให้ดูน่าอ่านยิ่งขึ้น")
// ระบบใส่เองแบบกำหนดกฎ ไม่ให้ AI เลือก — ด่านตรวจทุกด่าน (hook · CTA · คำต้องห้าม · ประโยคแม่แบบซ้ำ) ทำงานบนข้อความล้วนเหมือนเดิม
// และทุกโพสต์ได้หน้าตาชุดเดียวกัน ไม่มีอีโมจิเงิน/เร่ง/ฉลอง (💰 🔥 ⏰ 🎉) ที่ขัดกติกาแบรนด์ (ห้ามเร่งเร้า ห้ามสัญญาผลลัพธ์)
// วางที่ไหน: ข้อ 1. 2. 3. → 1️⃣ 2️⃣ 3️⃣ · ถาม/ตอบ → ❓/💡 · ย่อหน้าเนื้อหาไม่เกิน 3 ย่อหน้าได้อีโมจิตามหัวเรื่อง · คำกำกับ 📌 · ที่มา 📰 · บรรทัดชวนทำต่อ 👉
// ไม่วางที่: บรรทัดแรก (hook — ระบบ "ใช้ประโยคนี้" สลับบรรทัดนี้ และคะแนน hook วัดจากข้อความล้วน) · บรรทัดแฮชแท็ก · บรรทัดหัวข้อย่อย - •
// ของที่อ่านแคปชั่นไปใช้ต่อ (โปสเตอร์ · สคริปต์วิดีโอ) ต้องผ่าน stripEmoji ก่อน: โหมดโปสเตอร์ห้ามไอคอนแบบอีโมจิ และสคริปต์ถูกอ่านออกเสียง
// ไฟล์นี้ต้องไม่ import ของ node (หน้าเว็บ import ตรง)

const PICTO = '(?:\\p{Extended_Pictographic}|\\p{Regional_Indicator})(?:[\\u{FE0E}\\u{FE0F}]|[\\u{1F3FB}-\\u{1F3FF}])*'
const EMOJI_SEQ = `${PICTO}(?:\\u{200D}${PICTO})*`
const EMOJI_RE = new RegExp(EMOJI_SEQ, 'gu')
const KEYCAP_RE = /([0-9#*])️?⃣/g
const HAS_EMOJI_RE = new RegExp(`${EMOJI_SEQ}|[0-9#*]\\u{FE0F}?\\u{20E3}`, 'u')
// เครื่องหมายติ๊กหน้าบรรทัด = หัวข้อย่อย (ตัวเลือกเลย์เอาต์โปสเตอร์นับบรรทัด "- " เป็นเช็กลิสต์)
const CHECK_BULLET_RE = /^([ \t]*)(?:✅|✔️?|☑️?|🔹|🔸|▪️|▫️|•)[ \t]+/gmu

export function hasEmoji(text = '') {
  return HAS_EMOJI_RE.test(String(text || ''))
}

export function countEmoji(text = '') {
  const s = String(text || '')
  return (s.match(EMOJI_RE) || []).length + (s.match(KEYCAP_RE) || []).length
}

// เอาอีโมจิออกโดยคงโครงข้อความ: 1️⃣ ต้นบรรทัดกลับเป็น "1." · 🔟 เป็น "10." · ติ๊กหน้าบรรทัดเป็น "- " · ช่องว่างรอบอีโมจิยุบเหลือช่องเดียว
export function stripEmoji(text = '') {
  const s = String(text || '')
  if (!hasEmoji(s)) return s
  const marked = s
    .replace(/^([ \t]*)([0-9])️?⃣[ \t]*/gm, '$1$2. ')
    .replace(/^([ \t]*)🔟[ \t]*/gmu, '$110. ')
    .replace(CHECK_BULLET_RE, '$1- ')
    .replace(KEYCAP_RE, '$1')
    .replace(EMOJI_RE, '\u0000')
    .replace(/[‍️⃣]/g, '')
  return marked.split('\n').map((line) => (line.includes('\u0000')
    ? line.replace(/[ \t]*\u0000(?:[ \t]*\u0000)*[ \t]*/g, ' ').trim()
    : line)).join('\n')
}

const KEYCAPS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']

// อีโมจิตามหัวเรื่องของย่อหน้า — เรียงตามความเจาะจง ตัวแรกที่ตรงและยังไม่ถูกใช้ในโพสต์นี้ชนะ (ไม่ซ้ำกันในโพสต์เดียว)
const TOPIC_EMOJI = [
  [/มิจฉาชีพ|หลอก|โกง|ปลอม|สัญญาณเตือน|ระวัง|ความเสี่ยง|เสี่ยง|คำเร่ง|ถูกเร่ง|เร่งให้|เร่งเซ็น/, '⚠️'],
  [/โฉนด|น\.ส\.\s?3|อ\.ช\.\s?2|หนังสือกรรมสิทธิ์|เอกสาร|สำเนา/, '📄'],
  [/สัญญา|เซ็น|ลงนาม|ลายมือชื่อ/, '📝'],
  [/ไถ่|สินไถ่/, '🔑'],
  [/ครบกำหนด|กำหนดเวลา|ระยะเวลา|วันนัด|กี่ปี|กี่เดือน/, '📅'],
  [/สำนักงานที่ดิน|กรมที่ดิน|จดทะเบียน|นิติกรรม/, '🏛️'],
  [/ค่าธรรมเนียม|ภาษี|อากร|ค่าใช้จ่าย|ค่าโอน/, '🧾'],
  [/ดอกเบี้ย|ยอดหนี้|ยอดรวม|ยอดรับ|คำนวณ|ส่วนต่าง|เงินต้น|หนี้/, '🧮'],
  [/ตรวจ|เช็ก|เช็ค|ประเมิน|เทียบ/, '🔍'],
  [/ทายาท|มรดก|ครอบครัว|ลูกหลาน/, '👪'],
  [/คอนโด|ห้องชุด/, '🏢'],
  [/บ้าน|ทาวน์โฮม|ที่อยู่อาศัย/, '🏠'],
  [/ที่ดิน|แปลง|ไร่|ตารางวา/, '🏞️'],
  [/เตรียม|ขั้นตอน|วิธี|ลำดับ/, '📋'],
  [/สรุป|บทเรียน|เคล็ดลับ|สิ่งสำคัญ|จำไว้/, '💡'],
]
const MAX_TOPIC_LINES = 3

const SOURCE_RE = /^ที่มา\s*[:：]/
const CAVEAT_RE = /^ข้อมูลนี้เป็นความรู้ทั่วไป/
const HYPO_END_RE = /^เคสสมมุติเพื่ออธิบาย/
const HYPO_START_RE = /^เคสสมมุติ\s*[:：]/
const NUMBERED_RE = /^(\d{1,2})[.)]\s*(\S.*)$/
const QUESTION_RE = /^ถาม\s*[:：]/
const ANSWER_RE = /^ตอบ\s*[:：]/
const BULLET_RE = /^[-•*]\s/
const HASHTAGS_RE = /^(?:#[\p{L}\p{M}\p{N}_]+\s*)+$/u
const CTA_HINT_RE = /ทัก|แชต|แชท|ส่งรูป|ส่งข้อมูล|ส่งเอกสาร|ติดต่อ|สอบถาม|ปรึกษา|คอมเมนต์|ข้อความ|inbox|อินบ็อกซ์|นัด/i
const squash = (s) => String(s || '').replace(/[\s"“”'‘’]/g, '')

function topicEmoji(line, used) {
  for (const [re, emoji] of TOPIC_EMOJI) if (re.test(line) && !used.has(emoji)) return emoji
  return ''
}

// ใส่อีโมจิให้แคปชั่นที่ยังไม่มีหรือมีน้อย · มีตั้งแต่ 3 ตัว (คนเขียนเองหรือใส่ไปแล้ว) คืนตามเดิม · บรรทัดที่มีอีโมจิอยู่แล้วไม่แตะ → เรียกซ้ำได้ผลเดิม
// (ร่าง Codex ก่อน 10 พ.ย. 2569 เขียนตามกติกาเดิม "อีโมจิไม่เกิน 1 ตัว" — ตัวเดียวนั้นต้องไม่ทำให้ทั้งโพสต์ไม่ได้อีโมจิ)
// cta = ประโยคชวนทำต่อของร่าง (ช่วยหาบรรทัดที่จะวาง 👉) · ไม่มีก็หาบรรทัดสุดท้ายที่เป็นการชวนทัก/ส่งรูป/สอบถาม
export const DECORATED_MIN = 3
export function decorateCaption(caption = '', { cta = '' } = {}) {
  const text = String(caption || '')
  if (!text.trim() || countEmoji(text) >= DECORATED_MIN) return text
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const filled = lines.map((l, i) => [l.trim(), i]).filter(([l]) => l)
  if (filled.length < 2) return text
  const hookAt = filled[0][1]
  const tail = (l) => SOURCE_RE.test(l) || CAVEAT_RE.test(l) || HYPO_END_RE.test(l) || HASHTAGS_RE.test(l)

  const callKey = squash(cta).slice(0, 14)
  let ctaAt = callKey ? filled.findLast(([l, i]) => i !== hookAt && squash(l).includes(callKey))?.[1] : undefined
  if (ctaAt === undefined) {
    const last = filled.findLast(([l]) => !tail(l))
    if (last && last[1] !== hookAt && CTA_HINT_RE.test(last[0])) ctaAt = last[1]
  }

  const used = new Set(text.match(EMOJI_RE) || [])
  let topicLines = 0
  const out = lines.map((raw, i) => {
    const line = raw.trim()
    if (!line || i === hookAt || HASHTAGS_RE.test(line) || BULLET_RE.test(line) || hasEmoji(line)) return raw
    if (i === ctaAt) return `👉 ${line}`
    if (SOURCE_RE.test(line)) return `📰 ${line}`
    if (CAVEAT_RE.test(line)) return `📌 ${line}`
    if (HYPO_END_RE.test(line)) return `ℹ️ ${line}`
    if (HYPO_START_RE.test(line)) return `📖 ${line}`
    if (QUESTION_RE.test(line)) return `❓ ${line}`
    if (ANSWER_RE.test(line)) return `💡 ${line}`
    const numbered = line.match(NUMBERED_RE)
    if (numbered && Number(numbered[1]) >= 1 && Number(numbered[1]) <= 10) return `${KEYCAPS[Number(numbered[1])]} ${numbered[2]}`
    // ย่อหน้าเนื้อหา = บรรทัดแรกของย่อหน้า (บรรทัดก่อนหน้าว่าง หรือบรรทัดถัดจาก hook)
    const startsParagraph = i === hookAt + 1 || !String(lines[i - 1] || '').trim()
    if (!startsParagraph || topicLines >= MAX_TOPIC_LINES || line.length < 20) return raw
    const emoji = topicEmoji(line, used)
    if (!emoji) return raw
    used.add(emoji)
    topicLines += 1
    return `${emoji} ${line}`
  })
  return out.join('\n')
}

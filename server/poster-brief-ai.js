// บรีฟครีเอทีฟรายโพสต์ "เวอร์ชัน AI" (7 พ.ย. 2569) — ให้โมเดลในเครื่อง (Ollama qwen2.5:14b ผ่าน server/research/llm.js) เขียนก๊อปปี้เด็ค + อาร์ตไดเรกชันละเอียดกว่าฐานแบบกำหนดกฎ
// ใช้ที่ตัวรับงานบนคอมสำนักงาน (scripts/image-worker.mjs) ก่อนส่งคำสั่งภาพเข้า gpt-image · ทุกสตริงไทยที่จะขึ้นบนภาพต้องคัดจากโพสต์คำต่อคำ — ตรวจด้วย verbatimMisses แล้วถอยกลับไปใช้ค่าแบบกำหนดกฎทีละช่อง
// ช่องที่ไม่ขึ้นบนภาพ (big idea · ฉาก · พร็อพ · มู้ด · ประโยคทดสอบ) ต้องเป็นอังกฤษล้วน — ไม่ให้โมเดลภาพได้ประโยคไทยที่ไม่อยู่ในโพสต์ (ทีมวิจารณ์ 7 พ.ย.)
// ไม่ผ่าน/หมดเวลา/ไม่มี Ollama = คง CREATIVE BRIEF แบบกำหนดกฎที่เซิร์ฟเวอร์ใส่มาแล้ว (ภาพยังสร้างได้เสมอ)
import { extractPosterCopy, buildCreativeBrief, verbatimMisses, wordCount } from '../src/lib/posterBrief.js'
import { pickPosterLayout } from '../src/lib/posterDesignSystem.js'

export const BRIEF_START = /^CREATIVE BRIEF for this post \(/m
const ICONS = new Set(['document', 'house', 'land plot', 'calendar', 'coins', 'shield', 'check mark', 'map pin', 'handshake', 'magnifier', 'calculator', 'notepad with a pen'])

// ดึงหัวข้อ/เนื้อโพสต์/โครงการ์ดกลับจากคำสั่งภาพที่เซิร์ฟเวอร์สร้าง (แถวงานในตารางไม่ได้เก็บ caption แยก)
export function parseJobPrompt(prompt = '') {
  const p = String(prompt || '')
  const title = (p.match(/^HEADLINE \(render exactly[^\n]*\):\n([^\n]+)/m) || [])[1] || ''
  const caption = (p.match(/^POST CONTENT[^\n]*\n"""\n([\s\S]*?)\n"""/m) || [])[1] || ''
  const layout = (p.match(/^CONTENT CARD \(layout: ([a-z]+)\)/m) || [])[1] || (caption ? pickPosterLayout(caption) : 'explain')
  return { title: title.trim(), caption: caption.trim(), layout }
}

// คำสั่งให้โมเดล (ไทย) — กติกาเหล็กจากทีมวิจารณ์ + รูป JSON · ส่งร่างแบบกำหนดกฎไปเป็นตั้งต้น
export function buildBriefAiPrompt({ title, caption, layout, base }) {
  const system = [
    'คุณคือทีมครีเอทีฟของ AssetX Estate (นักเขียนคอนเทนต์ + อาร์ตไดเรกเตอร์ อสังหาริมทรัพย์ ขายฝาก/จำนอง ชลบุรี) งานของคุณ: อ่านโพสต์ Facebook 1 โพสต์ (หัวข้อ + เนื้อหา) แล้วเขียน "บรีฟโปสเตอร์อินโฟกราฟิก" เป็น JSON หนึ่งก้อน โปรแกรมจะนำไปต่อท้ายคำสั่งสร้างภาพ',
    'เป้าหมายของโปสเตอร์: คนที่เห็นแค่ภาพต้องรู้ทันทีว่าโพสต์เรื่องอะไร ประเด็นหลักคืออะไร ได้ประโยชน์อะไร และควรทำอะไรต่อ โดยไม่ต้องอ่านแคปชั่น',
    '',
    'กติกาเหล็ก (ผิดข้อเดียวช่องนั้นถูกทิ้ง):',
    '1. ทุกสตริงภาษาไทยที่จะขึ้นบนภาพ (ribbon, card_title, rows[].title/detail, action_title, action_items, callout, band_chips) ต้อง "คัดลอกต่อเนื่องคำต่อคำ" จากหัวข้อหรือเนื้อหาโพสต์ — ตัดให้สั้นลงได้เฉพาะที่ปลายวรรคหรือปลายประโยค ห้ามเรียบเรียงใหม่ ห้ามสลับคำ ห้ามนำข้อความจากสองจุดมาต่อกัน ห้ามแก้ตัวสะกด ห้ามเติมคำ จุด หรือเครื่องหมายคำพูด ถ้าหาวรรคที่ตรงกติกาไม่ได้ให้ใส่ "" หรือลดจำนวนแถว',
    '2. ห้ามมีเบอร์โทร LINE ราคา จำนวนเงิน ดอกเบี้ย เปอร์เซ็นต์ ชื่อบุคคล เลขโฉนด ที่อยู่ ในทุกช่อง แม้โพสต์จะมี',
    '3. ห้ามใช้ประโยคปิดท้าย (ชวนทักแชต / ชื่อบริษัท) และประโยคกำกับ "ข้อมูลนี้เป็นความรู้ทั่วไป…" ในช่องใด ๆ',
    '4. ช่องภาษาอังกฤษ (big_idea, background, props, mood, summary_test) เขียนเป็นอังกฤษล้วน (ยกเว้นชื่อบริการ ขายฝาก/จำนอง) และห้ามสั่งให้วาดตัวอักษร ตัวเลข ตราครุฑ ตราประทับ โลโก้อื่น คนจริง หน้าจอที่มีข้อความ ปฏิทินที่มีตัวเลข กองเหรียญ/ธนบัตร (อ่านเป็นราคา)',
    '5. ใน string ห้ามขึ้นบรรทัดจริง ใช้ช่องว่างแทน · ส่งครบทุกคีย์ตามรูปแบบ ค่าว่างใช้ "" หรือ []',
    '',
    'วิธีเลือกแต่ละช่อง:',
    '- ribbon = วลี 4–12 คำจากประโยคเปิดที่บอกว่าผู้อ่านได้อะไร/ทำไมต้องสนใจ (เรื่องเงินหรือความเสี่ยงที่พาดหัวยังไม่ได้บอก ดีที่สุด) ไม่เอาประโยคชวนติดต่อ',
    '- card_title = วลี 2–4 คำจากโพสต์ที่บอกว่าแถวในการ์ดคืออะไร (เช่น "รายการที่ต้องตรวจ") ห้ามซ้ำคำในพาดหัวหรือริบบิ้น',
    '- rows = 3–5 แถวจากข้อย่อยของโพสต์ตามลำดับ: title = วลีหลักของข้อ 3–10 คำ · detail = วรรค 8–20 คำที่สอน "ข้อเท็จจริงใหม่" ซึ่ง title ยังไม่ได้พูด จบที่ปลายวรรค ห้ามตัดกลางรายการ · ข้อสั้นให้ detail เป็น "" · icon เลือกจาก: document, house, land plot, calendar, coins, shield, check mark, map pin, handshake, magnifier, calculator, notepad with a pen',
    '- action_title = วลีนำ 1–5 คำของส่วน "สิ่งที่ควรทำ" ของโพสต์เอง (เช่น "ก่อนเซ็น" "ก่อนคุยกับผู้ให้บริการ") ถ้าไม่มีให้ "" · action_items = 2 ประโยคสั่งทำ 5–15 คำจากโพสต์ (ขอ/เทียบ/จด/เตรียม/ตรวจ/อย่า) ที่ไม่ซ้ำกับแถว',
    '- callout = ประโยคเตือน 1 ประโยค ≤ 12 คำจากโพสต์ที่เป็น "สิ่งเดียวที่อยากให้จำ" (ขึ้นต้น อย่า/ห้าม/ระวัง ดีที่สุด) ถ้าไม่มีให้ ""',
    '- band_chips = ป้าย 2 คำ 2 ป้ายจากหัวข้อแถว 1–2 (เช่น "วันครบกำหนด" "ยอดสินไถ่") หรือ []',
    '- big_idea = 1 ประโยคอังกฤษ: สิ่งที่ผู้อ่านต้องได้กลับไปและภาพควรให้ความรู้สึกแบบไหน · background = พื้นหลังชั้นเบลอ 1 ย่อหน้าอังกฤษ (สถานที่ เวลา ทิศแสง มุมกล้อง ความชัดตื้น) · props = พร็อพโซนฮีโร่ ≤ 2 ชิ้น 1 ย่อหน้าอังกฤษ (วัตถุ วัสดุ ความเอียง รายละเอียดที่ทำให้เป็นของโพสต์นี้ และสิ่งที่ห้ามมี) · mood = คำคุณศัพท์ 3–5 คำ + วัสดุและแสงในวลีเดียว (อังกฤษ) · summary_test = 1 ประโยคอังกฤษ "with the caption hidden a reader must be able to say: …"',
    'ตรวจตัวเองก่อนตอบ: ทุกสตริงไทยหาเจอต่อเนื่องในโพสต์ไหม · ไม่มีตัวเลข/เบอร์/ชื่อคน · ช่องอังกฤษไม่มีภาษาไทย · JSON ถูกต้อง',
    'ตอบเป็น JSON object เดียวเท่านั้น ไม่มีข้อความอื่น ไม่มี markdown: {"big_idea":"","ribbon":"","card_title":"","rows":[{"title":"","detail":"","icon":""}],"action_title":"","action_items":[""],"callout":"","band_chips":[""],"background":"","props":"","mood":"","summary_test":""}',
  ].join('\n')
  const prompt = [
    `พาดหัว (คงไว้ตามนี้): ${title}`,
    `โครงการ์ด: ${layout}`,
    'โพสต์ต้นฉบับ (แหล่งเดียวของข้อความที่ขึ้นบนภาพ):',
    '"""', caption, '"""',
    '',
    'ร่างตั้งต้นที่ระบบคัดไว้แบบกำหนดกฎ (ปรับให้ดีขึ้นได้ แต่ทุกสตริงยังต้องคัดจากโพสต์):',
    JSON.stringify({ ribbon: base.ribbon, card_title: base.cardTitle, rows: base.rows, action_title: base.actionTitle, action_items: base.actionItems, callout: base.callout, band_chips: base.bandChips }, null, 0),
    '',
    'เขียนบรีฟเป็น JSON ตามรูปที่กำหนด',
  ].join('\n')
  return { system, prompt }
}

const str = (v, max = 400) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const inRange = (s, min, max) => s && wordCount(s) >= min && wordCount(s) <= max + 4
// ตัดกลางรายการ: ในโพสต์ ข้อความถัดจากสตริงนี้ขึ้นต้นด้วย และ/หรือ/กับ = ยังไม่จบรายการ (โมเดล 14b เคยส่ง "แยกจำนวนเงินที่ได้รับจริง ยอดสินไถ่" ทิ้ง "และค่าใช้จ่าย…")
const cutMidList = (s, caption) => {
  const i = String(caption || '').indexOf(String(s || ''))
  return i >= 0 && /^\s*(และ|หรือ|กับ)/.test(String(caption).slice(i + String(s).length))
}
// อาร์ตไดเรกชันจาก AI ต้องเจาะจงจริง (แสง/กล้อง/ความลึก/วัสดุ/ความเอียง ≥ 3 อย่าง) และไม่มีของต้องห้าม — ไม่งั้นใช้ฉากแบบกำหนดกฎซึ่งละเอียดกว่า (โมเดล 14b ตอบ "a desk with a calendar and documents" ทั้งที่กติกาห้ามปฏิทิน)
const artQuality = (s) => {
  const t = String(s || '').toLowerCase()
  if (/calendar|phone|smartphone|coin|banknote|cash|screen|laptop|monitor|sign\b|signboard|text/.test(t)) return false
  const cues = [/light|sunlight|daylight/, /camera|angle|degrees? elevation|top-down|eye level/, /depth of field|bokeh|blur/, /matte|wood|oak|glass|paper|steel/, /tilt|rotated|degrees/].filter((re) => re.test(t)).length
  return cues >= 3
}
// ช่องอังกฤษ: ต้องมีคำอังกฤษจริง ไม่มีอักษรไทยนอกจากชื่อบริการ ไม่มีตัวเลขยาว/เบอร์/คำที่ชวนวาดตัวหนังสือ
const englishOnly = (s, max) => {
  const t = str(s, max)
  if (!/[A-Za-z]{4}/.test(t)) return ''
  if (/[ก-๙]/.test(t.replace(/ขายฝาก|จำนอง/g, ''))) return ''
  if (/\d{3,}|phone|LINE ID|price tag text|logo of|garuda/i.test(t)) return ''
  return t
}

// รวมคำตอบ AI กับฐานแบบกำหนดกฎ: ช่องไหนไม่ได้คัดจากโพสต์/ยาวผิด = ใช้ของฐาน · คืน { copy, extras, replaced[] }
export function mergeAiBrief(data, base, { title, caption }) {
  const replaced = []
  const copy = { ...base, rows: base.rows.map((r) => ({ ...r })), bandChips: [...(base.bandChips || [])] }
  const post = { title, caption }
  const take = (field, value, min, max) => {
    const s = str(value)
    if (!s) return
    if (!inRange(s, min, max) || verbatimMisses({ [field]: s }, post).length || cutMidList(s, caption)) return
    copy[field] = s
    replaced.push(field)
  }
  take('ribbon', data.ribbon, 4, 12)
  take('cardTitle', data.card_title, 2, 4)
  take('actionTitle', data.action_title, 1, 5)
  take('callout', data.callout, 4, 12)
  if (Array.isArray(data.rows) && data.rows.length >= 3) {
    const rows = data.rows.slice(0, 5).map((r) => ({ title: str(r?.title, 160), detail: str(r?.detail, 320), icon: ICONS.has(String(r?.icon || '').trim()) ? String(r.icon).trim() : '' }))
    const ok = rows.every((r) => inRange(r.title, 3, 12) && (!r.detail || (inRange(r.detail, 6, 22) && !cutMidList(r.detail, caption))) && !verbatimMisses({ rows: [r] }, post).length && !(r.detail && (r.title.includes(r.detail) || r.detail.includes(r.title))))
    if (ok) {
      copy.rows = rows.map((r, i) => ({ ...r, icon: r.icon || base.rows[i]?.icon || 'check mark' }))
      replaced.push('rows')
    }
  }
  if (Array.isArray(data.action_items) && data.action_items.length) {
    // ข้อควรทำต้องไม่ซ้ำกับแถวการ์ด (โมเดลเคยยกรายละเอียดข้อ 3 มาเป็นข้อควรทำ)
    const rowText = copy.rows.map((r) => `${r.title} ${r.detail}`).join('\n')
    const items = data.action_items.slice(0, 3).map((a) => str(a, 240)).filter((a) => a && !rowText.includes(a) && !copy.rows.some((r) => r.detail && a.includes(r.detail)))
    if (items.length && items.every((a) => inRange(a, 4, 15) && !verbatimMisses({ actionItems: [a] }, post).length && !cutMidList(a, caption))) {
      copy.actionItems = items
      replaced.push('actionItems')
    }
  }
  if (Array.isArray(data.band_chips) && data.band_chips.length >= 2) {
    const chips = data.band_chips.slice(0, 2).map((c) => str(c, 40)).filter(Boolean)
    if (chips.length === 2 && chips.every((c) => inRange(c, 2, 4) && c.length <= 16 && !verbatimMisses({ bandChips: [c] }, post).length)) {
      copy.bandChips = chips
      replaced.push('bandChips')
    }
  }
  const background = englishOnly(data.background, 600)
  const props = englishOnly(data.props, 700)
  const extras = {
    bigIdea: englishOnly(data.big_idea, 300),
    background: artQuality(background) ? background : '',
    props: artQuality(props) ? props : '',
    mood: englishOnly(data.mood, 200),
    // โมเดลชอบใส่วลีนำ "with the caption hidden a reader must be able to say:" มาด้วย — บรรทัดตรวจมีวลีนี้อยู่แล้ว
    summaryTest: englishOnly(String(data.summary_test || '').replace(/^\s*with the caption hidden[^:]*:\s*/i, ''), 300),
  }
  return { copy, extras, replaced }
}

export function replaceBriefInPrompt(prompt, brief) {
  const p = String(prompt || '')
  const m = p.match(BRIEF_START)
  if (!m) return `${p}\n\n${brief}`
  const start = m.index
  const rest = p.slice(start)
  const end = rest.search(/\n\n(?=[A-Z])/)
  return `${p.slice(0, start)}${brief}${end >= 0 ? rest.slice(end) : ''}`
}

// ใช้กับงานจริง: ask = createAsk() จาก server/research/llm.js (คืน { ok, data }) · คืน { prompt, used, note }
export async function enhanceBriefWithAi(prompt, { ask, log = () => {} } = {}) {
  const { title, caption, layout } = parseJobPrompt(prompt)
  if (!ask || !caption || !title) return { prompt, used: false, note: 'ไม่มีเนื้อโพสต์/ตัวตอบ AI' }
  const base = extractPosterCopy({ title, caption })
  const res = await ask(buildBriefAiPrompt({ title, caption, layout, base }))
  if (!res?.ok || !res.data || typeof res.data !== 'object') return { prompt, used: false, note: `AI ไม่ตอบ (${res?.error || 'คำตอบอ่านไม่ออก'}) ใช้บรีฟแบบกำหนดกฎ` }
  const { copy, extras, replaced } = mergeAiBrief(res.data, base, { title, caption })
  const extrasUsed = Object.entries(extras).filter(([, v]) => v).map(([k]) => k)
  if (!replaced.length && !extrasUsed.length) return { prompt, used: false, note: 'AI ไม่มีช่องที่ผ่านการตรวจคำต่อคำ ใช้บรีฟแบบกำหนดกฎ' }
  const brief = buildCreativeBrief(copy, { title, caption, layout, source: 'AI-assisted, every Thai string verified word for word against the post', extras })
  log(`บรีฟ AI: ใช้ช่อง ${[...replaced, ...extrasUsed].join(', ') || '-'}`)
  return { prompt: replaceBriefInPrompt(prompt, brief), used: true, note: `บรีฟ AI (${replaced.length} ช่องข้อความ + ${extrasUsed.length} ช่องอาร์ตผ่านการตรวจ)` }
}

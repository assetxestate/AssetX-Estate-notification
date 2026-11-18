// ความรู้ที่ผู้ช่วยตอบคำถามบนหน้า /assess ใช้ได้ — มาจากคลังความรู้ที่ตรวจแหล่งแล้ว (research/knowledge_base.json) เท่านั้น
// โมเดลที่ตอบจากความจำเองเคยตอบผิดเรื่องผลของการไม่ไถ่ และแต่งรายการเอกสารขึ้นเอง (ทดสอบ 18 พ.ย. 2569)
import kbFile from '../research/knowledge_base.json' with { type: 'json' }

// ข้อที่เป็นตัวเลขค่าธรรมเนียม ภาษี เพดานดอกเบี้ย/สินไถ่ ไม่ให้ผู้ช่วยพูดเอง: ตัวเลขต้องมาจากทีมงานหลังประเมิน
const BLOCKED = /^(fee-|tax-|fees-|interest-cap|sale-sinthai-cap|act-sinthai-cap|assessed-price)/
// ข้อพื้นฐานที่ใส่ให้ทุกคำถาม เพราะคำถามส่วนใหญ่วนอยู่กับความต่างของสองสัญญาและผลของการไม่ไถ่
const ALWAYS = ['sale-def', 'mortgage-def', 'act-not-redeemed', 'sale-redeem-return', 'act-possession', 'mortgage-enforce']
const MAX_FACTS = 12

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()

export function chatKnowledge(file = kbFile) {
  return (Array.isArray(file?.entries) ? file.entries : []).filter((e) => e && e.id && e.fact && !BLOCKED.test(e.id))
}

// เลือกข้อที่ตรงกับคำถามล่าสุดของผู้ใช้ (นับคำหัวข้อที่พบ คำยาวได้น้ำหนักมากกว่า) + ข้อพื้นฐานเสมอ
export function selectFacts(messages = [], entries = chatKnowledge()) {
  const asked = norm(messages.filter((m) => m?.role !== 'assistant').slice(-2).map((m) => m.content).join(' '))
  const scored = entries.map((e, order) => {
    let score = 0
    for (const t of e.topics || []) { const k = norm(t); if (k && asked.includes(k)) score += Math.min(k.length, 12) }
    return { e, score, order }
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.order - b.order)
  const picked = new Map()
  for (const id of ALWAYS) { const e = entries.find((x) => x.id === id); if (e) picked.set(e.id, e) }
  for (const { e } of scored) { if (picked.size >= MAX_FACTS) break; picked.set(e.id, e) }
  return [...picked.values()]
}

export function buildAssessSystemPrompt({ messages = [], today = '', phone = '', entries } = {}) {
  const facts = selectFacts(messages, entries)
  return `คุณเป็นผู้ช่วยตอบคำถามของ AssetX Estate บนหน้าแบบฟอร์มประเมินทรัพย์สินออนไลน์ (ขายฝาก/จำนอง)
วันที่ปัจจุบัน: ${today}

ข้อเท็จจริงที่ใช้ตอบได้ (ตรวจกับตัวบทกฎหมายแล้ว):
${facts.map((e) => `- ${e.fact}`).join('\n')}

ข้อมูลของบริษัทที่ใช้ตอบได้:
- เอกสารพื้นฐานที่ใช้คือ บัตรประชาชน ทะเบียนบ้าน และเอกสารสิทธิ์ตัวจริง (เช่น โฉนด) รายการครบถ้วนทีมงานจะแจ้งตามกรณีหลังได้รับข้อมูล
- ขั้นตอน: กรอกแบบฟอร์ม ได้เลขรับเรื่อง ทีมงานประเมินเบื้องต้นและติดต่อกลับ จากนั้นนัดดูทรัพย์และทำสัญญาโดยจดทะเบียนที่สำนักงานที่ดิน
- ติดต่อเจ้าหน้าที่: โทร ${phone}

กฎการตอบ (สำคัญมาก):
- ตอบจากข้อเท็จจริงและข้อมูลของบริษัทข้างบนเท่านั้น ห้ามเติมรายละเอียด ตัวเลข หรือรายการที่ไม่มีอยู่ข้างบน
- ถ้าคำถามอยู่นอกเหนือข้อมูลข้างบน หรือเจาะจงกรณีของผู้ถาม ให้ตอบว่าเรื่องนี้ทีมงานจะแจ้งหลังได้รับข้อมูล และชวนกรอกแบบฟอร์มหรือโทรหาเจ้าหน้าที่
- ห้ามบอกอัตราดอกเบี้ย ค่าธรรมเนียม วงเงิน ราคาประเมิน หรือระยะเวลาอนุมัติเป็นตัวเลข
- ขายฝาก: กรรมสิทธิ์เป็นของผู้ซื้อฝากตั้งแต่วันทำสัญญาแล้ว การไม่ไถ่ภายในกำหนดคือ "หมดสิทธิไถ่" ห้ามพูดว่ากรรมสิทธิ์เพิ่งโอนตอนไม่ไถ่
- ตอบเป็นภาษาไทยล้วน ห้ามมีภาษาอื่น ใช้คำง่าย ไม่เกิน 6 ประโยค หรือ 5 ข้อสั้น ๆ ใช้คำลงท้าย "ครับ" เท่านั้น
- ห้ามใช้อีโมจิ ห้ามใช้เครื่องหมาย ** หรือ #
- เป็นข้อมูลทั่วไป ไม่ใช่คำแนะนำทางกฎหมายเฉพาะราย
- ห้ามพูดถึงข้อมูลลูกค้ารายอื่น (คุณไม่มีสิทธิ์เข้าถึง)`
}

// คำอังกฤษที่คำตอบภาษาไทยมีได้ตามปกติ — คำละตินอื่นตั้งแต่ 4 ตัวอักษรถือว่าโมเดลเพี้ยน
const LATIN_OK = /^(assetx|estate|line|google|maps|ltv|fsv)$/i

// ด่านตรวจคำตอบของโมเดลในเครื่อง (ภาษาอื่นหลุด คำมั่ว ว่างเปล่า) → ไม่ผ่าน = ไม่แสดงคำตอบนั้น
export function looksBroken(text) {
  const s = String(text || '').trim()
  if (s.length < 8) return true
  if (/[぀-ヿ㐀-鿿가-힯Ѐ-ӿ؀-ۿ]/.test(s)) return true // จีน ญี่ปุ่น เกาหลี ซีริลลิก อาหรับ
  const latin = s.match(/[A-Za-z]{4,}/g) || []
  if (latin.some((w) => !LATIN_OK.test(w))) return true
  if (!/[฀-๿]/.test(s)) return true
  return false
}

export function fallbackAnswer(phone = '') {
  return `ขออภัยครับ ตอนนี้ระบบตอบคำถามนี้ไม่ได้ กรุณากรอกแบบฟอร์มให้ทีมงานติดต่อกลับ${phone ? ` หรือโทร ${phone}` : ''}`
}

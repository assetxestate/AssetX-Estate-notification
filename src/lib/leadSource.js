// ที่มาของ lead จากหน้าประเมินออนไลน์ /assess
// ลิงก์ของนายหน้า: /assess?ref=<รหัสหรือชื่อนายหน้า>  ·  ลิงก์จากช่องทางของเรา: /assess?src=<ช่องทาง เช่น fb, tiktok, google>
// ไม่มีทะเบียนนายหน้าแยก — เจ้าของตั้งรหัสเองตอนส่งลิงก์ ระบบแค่จำว่าทรัพย์นี้มากับรหัสไหน

export const LEAD_SOURCES = {
  broker: { label: 'นายหน้า', icon: '🤝' },
  owner: { label: 'เจ้าของทรัพย์', icon: '🏠' },
}

const MAX_REF = 40

// เก็บเฉพาะตัวอักษร ตัวเลข ไทย ช่องว่าง . _ - กันสคริปต์/อักขระควบคุมที่มากับ URL
export function cleanRef(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N} ._-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_REF)
}

// อ่านที่มาจาก query string ของหน้า /assess
// มี ref = นายหน้าส่งมา (ล็อกบทบาทเป็นนายหน้า) · มีแค่ src = คนกดมาจากช่องทางของเรา (บทบาทเลือกเองในฟอร์ม)
export function parseLeadParams(search) {
  let params
  try { params = new URLSearchParams(String(search || '')) } catch { params = new URLSearchParams('') }
  const ref = cleanRef(params.get('ref'))
  const src = cleanRef(params.get('src'))
  if (ref) return { leadSource: 'broker', leadRef: ref, locked: true }
  return { leadSource: 'owner', leadRef: src, locked: false }
}

export function normalizeLeadSource(value) {
  return value === 'broker' ? 'broker' : 'owner'
}

// ป้ายสั้นบนการ์ด lead ในแอป — ข้อมูลเก่าที่ไม่มีที่มาคืนค่าว่าง
export function leadSourceLabel(leadSource, leadRef) {
  if (!leadSource && !leadRef) return ''
  const meta = LEAD_SOURCES[normalizeLeadSource(leadSource)]
  const ref = cleanRef(leadRef)
  return `${meta.icon} ${meta.label}${ref ? ` · ${ref}` : ''}`
}

// เลขรับเรื่องที่ผู้ส่งเห็นหลังส่งฟอร์ม และเจ้าของเห็นใน Telegram/การ์ด lead — ใช้อ้างถึงทรัพย์เดียวกันเวลาคุยกับนายหน้า
export function leadTicketNo(id) {
  const n = Number(id)
  return Number.isInteger(n) && n > 0 ? `AX-${String(n).padStart(5, '0')}` : ''
}

// รวมลิงก์แผนที่กับรายละเอียดเพิ่มเติมจากฟอร์มเป็นหมายเหตุเดียว (คอลัมน์ location_note เดิม)
export function buildLeadNote({ mapLink = '', note = '' } = {}) {
  const link = String(mapLink).trim().slice(0, 300)
  const text = String(note).trim().slice(0, 1000)
  return [link && `แผนที่: ${link}`, text].filter(Boolean).join('\n')
}

// ข้อความเตือนเข้า Telegram เมื่อมีทรัพย์เข้าใหม่ — ไม่ใส่ชื่อ เบอร์ หรือ LINE ของผู้ส่ง (ดูในแอปหลังล็อกอิน)
export function leadNotifyText(row = {}, { files = 0 } = {}) {
  const source = normalizeLeadSource(row.lead_source)
  const ref = cleanRef(row.lead_ref)
  const head = source === 'broker'
    ? `🤝 ทรัพย์เข้าใหม่จากนายหน้า${ref ? ` (${ref})` : ''}`
    : `🏠 ทรัพย์เข้าใหม่จากหน้าประเมินออนไลน์${ref ? ` (ช่องทาง ${ref})` : ''}`
  const place = [row.subdistrict, row.district, row.province].map((s) => String(s || '').trim()).filter(Boolean).join(' · ')
  const requested = Number(row.requested_loan) || 0
  const ticket = leadTicketNo(row.id)
  const lines = [
    head,
    ...(ticket ? [`เลขรับเรื่อง ${ticket}`] : []),
    `${row.assessment_type || 'ไม่ระบุประเภท'} · ${row.property_subtype || row.property_type || 'ไม่ระบุทรัพย์'}`,
    place || 'ไม่ระบุที่ตั้ง',
    requested > 0 ? `วงเงินที่ขอ ${requested.toLocaleString('th-TH')} บาท` : 'ยังไม่ระบุวงเงินที่ขอ',
    ...(Number(files) > 0 ? [`แนบรูป ${Number(files)} รูป`] : []),
    '',
    source === 'broker' ? 'รับปากนายหน้าไว้: ตอบผลเบื้องต้นภายในวัน' : 'รับปากไว้: ติดต่อกลับภายใน 24 ชั่วโมง',
    'เปิดดูข้อมูลติดต่อ: แอป → นายทุน → Lead จากเว็บ',
  ]
  return lines.join('\n')
}

// ── ข้อความตอบผลประเมินเบื้องต้นกลับผู้ส่ง (เจ้าของคัดลอกไปส่งเองทาง LINE/โทรศัพท์) ──
// ไม่มีอัตราดอกเบี้ยหรือค่าธรรมเนียมในข้อความ · วงเงินมาจากที่เจ้าของพิมพ์เองเท่านั้น และกำกับว่ายังไม่ใช่วงเงินอนุมัติ
export const REPLY_RESULTS = {
  interested: { label: 'รับพิจารณา', short: 'รับพิจารณา' },
  'need-info': { label: 'ขอข้อมูลเพิ่ม', short: 'ขอข้อมูลเพิ่ม' },
  declined: { label: 'ไม่รับรายการนี้', short: 'ไม่รับ' },
}

export const REPLY_NEEDS = [
  { key: 'deed', label: 'รูปเอกสารสิทธิ์หน้า-หลังที่อ่านชัด' },
  { key: 'photos', label: 'รูปถ่ายทรัพย์และทางเข้า' },
  { key: 'map', label: 'หมุดที่ตั้งบน Google Maps' },
  { key: 'burden', label: 'ภาระเดิมและยอดที่ต้องไถ่ถอน' },
  { key: 'owner', label: 'ชื่อผู้ถือกรรมสิทธิ์และสถานะสมรส' },
]

const money = (n) => (Number(n) > 0 ? `${Math.round(Number(n)).toLocaleString('th-TH')} บาท` : '')

function areaOf(lead) {
  const sqw = Number(lead.totalSqw) || 0
  if (sqw <= 0) return ''
  const rai = Math.floor(sqw / 400)
  const ngan = Math.floor((sqw % 400) / 100)
  const rest = Math.round((sqw % 100) * 10) / 10
  return `${rai}-${ngan}-${rest} ไร่`
}

// lead: { ticketNo, name, isBroker, assessmentType, propertySubtype, subdistrict, district, province, totalSqw, requestedLoan }
// reply: { result, amount, needs: [key], note }
export function buildBrokerReply(lead = {}, reply = {}, { phone = '', line = '' } = {}) {
  const result = Object.hasOwn(REPLY_RESULTS, reply.result) ? reply.result : 'interested'
  const place = [lead.subdistrict, lead.district, lead.province].map((s) => String(s || '').trim()).filter(Boolean).join(' ')
  const property = [lead.assessmentType, lead.propertySubtype, place, areaOf(lead) && `เนื้อที่ ${areaOf(lead)}`].filter(Boolean).join(' · ')
  const note = String(reply.note || '').trim().slice(0, 600)
  const lines = [
    `เรียนคุณ${String(lead.name || '').trim() || 'ลูกค้า'}`,
    `ผลประเมินเบื้องต้น${lead.ticketNo ? ` เลขรับเรื่อง ${lead.ticketNo}` : ''}`,
    '',
    property && `ทรัพย์: ${property}`,
    money(lead.requestedLoan) && `วงเงินที่ขอ: ${money(lead.requestedLoan)}`,
    '',
  ]
  if (result === 'interested') {
    lines.push('ผล: รับพิจารณา')
    if (money(reply.amount)) lines.push(`วงเงินเบื้องต้น: ${money(reply.amount)} (ยังไม่ใช่วงเงินอนุมัติ ขึ้นกับการตรวจเอกสารสิทธิ์และดูทรัพย์จริง)`)
    lines.push('ขั้นต่อไป: นัดดูทรัพย์และตรวจเอกสารสิทธิ์ตัวจริง ทีมงานจะแจ้งค่าใช้จ่ายรวมก่อนวันทำสัญญาที่สำนักงานที่ดิน')
  } else if (result === 'need-info') {
    const needs = REPLY_NEEDS.filter((n) => (reply.needs || []).includes(n.key))
    lines.push('ผล: ขอข้อมูลเพิ่มเพื่อประเมินต่อ')
    if (needs.length) lines.push('ขอรบกวนส่ง:', ...needs.map((n, i) => `${i + 1}. ${n.label}`))
  } else {
    lines.push('ผล: ขออนุญาตไม่รับรายการนี้ครับ', 'ขอบคุณที่ส่งทรัพย์ให้พิจารณา หากมีทรัพย์รายการอื่นยินดีรับพิจารณาครับ')
  }
  if (note) lines.push('', note)
  const contact = [phone && `โทร ${phone}`, line && `LINE ${line}`].filter(Boolean).join(' · ')
  lines.push('', `AssetX Estate${contact ? ` · ${contact}` : ''}`)
  // ตัดค่าว่างที่มาจากข้อมูลไม่ครบ และบรรทัดว่างซ้อน
  return lines.filter((l) => l !== false && l != null && l !== undefined)
    .filter((l, i, all) => !(l === '' && (i === 0 || all[i - 1] === '')))
    .join('\n').trim()
}

// เวลาที่ใช้ตอบ (ชั่วโมง ทศนิยม 1 ตำแหน่ง) จากเวลาที่ทรัพย์เข้าและเวลาที่กดบันทึกว่าตอบแล้ว
export function replyHours(createdAt, repliedAt) {
  const a = new Date(createdAt).getTime()
  const b = new Date(repliedAt).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
  return Math.round(((b - a) / 3600000) * 10) / 10
}

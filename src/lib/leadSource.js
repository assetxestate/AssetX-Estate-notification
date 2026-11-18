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
export function leadNotifyText(row = {}) {
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
    '',
    source === 'broker' ? 'รับปากนายหน้าไว้: ตอบผลเบื้องต้นภายในวัน' : 'รับปากไว้: ติดต่อกลับภายใน 24 ชั่วโมง',
    'เปิดดูข้อมูลติดต่อ: แอป → นักลงทุน → Lead จากเว็บ',
  ]
  return lines.join('\n')
}

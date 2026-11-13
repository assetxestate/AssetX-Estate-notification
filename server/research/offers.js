// ไอเดียโปสเตอร์ประกาศบริการของเราเอง (source internal · subtype offer) จาก research/offer_topics.json
// เจ้าของขอ 13 พ.ย. 2569: เห็นไอเดีย #64 (โพสต์รับจำนองคอนโดของเพจคู่แข่งแรง 48 เท่า) แต่เรายังไม่มีหัวข้อโปสเตอร์รับขายฝาก
// แถวที่ได้มีมุมเล่าเขียนไว้แล้ว (มุมแรก = "ประกาศบริการ: …" → โครง offer ใน drafts.js) ขั้นร่างของรอบรีเสิร์ชเขียนโพสต์เต็มต่อเอง
// ข้อเท็จจริงขึ้นต้น 📌 = ความจริงของแบรนด์ (บริการ พื้นที่ เอกสาร ขั้นตอน) ไม่ใช่ข้อความของเพจอื่น · บรรทัด "ห้าม…" เป็นหมายเหตุถึงผู้เขียน (splitFactsNotes)
import { isoWeek } from './classify.js'
import { serviceAreaLabel } from './audience.js'

export const OFFER_SUBTYPE = 'offer'
export const OFFER_SOURCE_LABEL = 'บริการของเรา'
const DAY_MS = 86400000

export function offerTopics(config = {}) {
  return (Array.isArray(config.topics) ? config.topics : [])
    .filter((t) => t && t.key && t.title && Array.isArray(t.facts) && t.facts.length && Array.isArray(t.angles) && t.angles.length)
}

// ขั้นตอนขายฝาก/จำนองของแบรนด์ (ข้อเท็จจริง ไม่ใช่โครงโพสต์)
function stepsFact(brand = {}) {
  const steps = brand.steps_by_service?.['ขายฝาก/จำนอง'] || brand.steps || []
  return steps.length ? `ขั้นตอนของเรา: ${steps.join(' → ')}` : ''
}

export function offerSummary(topic, brand = {}) {
  const area = serviceAreaLabel(brand)
  const provinces = Array.isArray(brand.service_area) && brand.service_area.length ? ` (${brand.service_area.join(' ')})` : ''
  const facts = [
    ...topic.facts,
    `พื้นที่ให้บริการตอนนี้: ${area}${provinces}`,
    topic.service === 'จำนอง'
      ? 'จำนองจดทะเบียนที่สำนักงานที่ดิน กรรมสิทธิ์ยังเป็นของผู้จำนอง'
      : 'ขายฝากจดทะเบียนที่สำนักงานที่ดิน กรรมสิทธิ์โอนไปผู้รับซื้อฝากทันที ผู้ขายฝากมีสิทธิไถ่คืนภายในกำหนดเวลาในสัญญา',
    stepsFact(brand),
  ].filter(Boolean)
  const notes = [
    'ห้ามระบุดอกเบี้ย วงเงิน เปอร์เซ็นต์ หรือความเร็วอนุมัติ — ไม่มีในความจริงของแบรนด์',
    'ห้ามลอกข้อเสนอหรือข้อความของโพสต์คู่แข่งที่เป็นแรงบันดาลใจ ใช้แค่โครง บริการ + ประเภททรัพย์ + พื้นที่',
  ]
  return `📌 ${facts.join(' · ')}\n${notes.join('\n')}`
}

export function offerIdeaRow(topic, brand = {}, { now = new Date(), score = 4.5 } = {}) {
  return {
    status: 'new',
    source: 'internal',
    source_label: OFFER_SOURCE_LABEL,
    subtype: OFFER_SUBTYPE,
    title: topic.title,
    summary: offerSummary(topic, brand),
    url: null,
    angles: topic.angles.map((a) => ({ label: String(a.label).slice(0, 40), brief: String(a.brief) })),
    relevance: `โปสเตอร์รับงานของเราเอง · ${topic.service}${topic.asset}`,
    score,
    audience: ['A'],
    property_type: topic.property_type || null,
    service_area: serviceAreaLabel(brand),
    // หัวข้อเดิมกลับมาได้ในสัปดาห์อื่น (โปสเตอร์รับงานทำซ้ำได้ แต่ละรอบร่างไม่ซ้ำเพราะตัวร่างเลี่ยงประโยคเปิดเดิม)
    external_key: `offer:${topic.key}:${isoWeek(now)}`,
  }
}

// รอบรีเสิร์ช: เติมหัวข้อเมื่อคิวมีไอเดียบริการที่ยังไม่ได้ใช้น้อยกว่า min_in_queue และหัวข้อล่าสุดเก่ากว่า cadence_days
// หมุนหัวข้อ: หยิบหัวข้อที่สร้างล่าสุดนานที่สุด (ไม่เคยสร้าง = ก่อน) · existing = แถว offer ทุกสถานะ {external_key, status, created_at}
export function planOfferIdeas(config = {}, existing = [], { now = new Date(), force = false, keys = [] } = {}) {
  const topics = offerTopics(config)
  if (keys.length) return topics.filter((t) => keys.includes(t.key))
  const rows = existing.filter((r) => String(r.external_key || '').startsWith('offer:'))
  const pending = rows.filter((r) => r.status === 'new').length
  const latest = rows.reduce((max, r) => Math.max(max, new Date(r.created_at).getTime() || 0), 0)
  const cadence = Number(config.cadence_days ?? 7) * DAY_MS
  const min = Number(config.min_in_queue ?? 1)
  if (!force && (pending >= min || (latest && now.getTime() - latest < cadence))) return []
  const lastByKey = new Map()
  for (const r of rows) {
    const key = String(r.external_key).split(':')[1]
    lastByKey.set(key, Math.max(lastByKey.get(key) || 0, new Date(r.created_at).getTime() || 0))
  }
  const ordered = topics.slice().sort((a, b) => (lastByKey.get(a.key) || 0) - (lastByKey.get(b.key) || 0))
  return ordered.slice(0, Math.max(1, min - pending))
}

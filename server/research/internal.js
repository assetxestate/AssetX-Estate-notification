// สัญญาณภายในจากตารางลีด (leads) — ไม่มีข้อมูลบุคคล ใช้แค่ตัวเลขรวม
// lead_surge   ลีด (audience × service_area) สัปดาห์นี้ ≥ 2× median 8 สัปดาห์ และ ≥ 3 ลีด
// top_question service ที่มีลีดสูงสุดของสัปดาห์ (≥ 2 ลีด)
// กุญแจรายสัปดาห์ (รายวันจะได้แถวซ้ำ) · คะแนน 4.0–5.0 · ห้ามใส่จำนวนลีดจริงในโพสต์ (summary นี้ใช้ภายในเท่านั้น)
import { isoWeek, toDate } from './classify.js'

const WEEK_MS = 7 * 86400000

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b)
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function weeksAgo(received, now) {
  const t = toDate(received)
  if (!t) return null
  return Math.floor((now.getTime() - t.getTime()) / WEEK_MS)
}

export function leadSignals(leads = [], now = new Date(), { windowWeeks = 8 } = {}) {
  const week = isoWeek(now)
  const out = []
  const rows = (Array.isArray(leads) ? leads : []).filter((l) => l && weeksAgo(l.received_at, now) !== null && weeksAgo(l.received_at, now) <= windowWeeks)
  if (!rows.length) return out

  // lead_surge ต่อ audience × service_area
  const groups = new Map()
  for (const lead of rows) {
    const key = `${lead.audience || '-'}|${lead.service_area || '-'}`
    const ago = weeksAgo(lead.received_at, now)
    if (!groups.has(key)) groups.set(key, new Array(windowWeeks + 1).fill(0))
    groups.get(key)[ago] += 1
  }
  for (const [key, counts] of groups) {
    const thisWeek = counts[0]
    const history = counts.slice(1)
    const base = median(history)
    if (thisWeek >= 3 && thisWeek >= 2 * Math.max(base, 1)) {
      const [audience, area] = key.split('|')
      out.push({
        source: 'internal',
        source_label: 'สัญญาณจากลีดของเรา',
        subtype: 'internal',
        title: `คนกลุ่ม ${audience === '-' ? 'ไม่ระบุ' : audience}${area !== '-' ? ` ในพื้นที่ ${area}` : ''} ทักเข้ามามากกว่าปกติสัปดาห์นี้`,
        summary: `ลีดสัปดาห์นี้สูงกว่าค่ากลาง ${windowWeeks} สัปดาห์อย่างน้อย 2 เท่า (ตัวเลขใช้ภายในเท่านั้น ห้ามลงโพสต์) → ทำคอนเทนต์ตอบคำถามของกลุ่มนี้ในพื้นที่นี้`,
        url: null,
        score: 5.0,
        audience: audience === '-' ? null : [audience],
        service_area: area === '-' ? null : area,
        event_date: null,
        event_key: `crm:lead_surge:${audience}:${area}:${week}`,
        external_key: `crm:lead_surge:${audience}:${area}:${week}`,
        related_sku: null,
        status: 'new',
      })
    }
  }

  // top_question ของสัปดาห์นี้
  const services = new Map()
  for (const lead of rows) {
    if (weeksAgo(lead.received_at, now) !== 0 || !lead.service) continue
    services.set(lead.service, (services.get(lead.service) || 0) + 1)
  }
  const top = [...services.entries()].sort((a, b) => b[1] - a[1])[0]
  if (top && top[1] >= 2) {
    out.push({
      source: 'internal',
      source_label: 'สัญญาณจากลีดของเรา',
      subtype: 'internal',
      title: `เรื่องที่คนถามมากที่สุดสัปดาห์นี้: ${top[0]}`,
      summary: 'ทำคอนเทนต์ตอบคำถามพื้นฐานของบริการนี้ (ขั้นตอน ค่าใช้จ่ายรวม สิทธิไถ่ถอน) · ตัวเลขลีดใช้ภายในเท่านั้น',
      url: null,
      score: 4.0,
      audience: null,
      event_date: null,
      event_key: `crm:top_question:${top[0]}:${week}`,
      external_key: `crm:top_question:${top[0]}:${week}`,
      related_sku: null,
      status: 'new',
    })
  }
  return out
}

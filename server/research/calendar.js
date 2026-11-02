// ปฏิทินเหตุการณ์ → ไอเดียล่วงหน้า (source=official · subtype ตามเหตุการณ์ · event_date = วันจริง)
// และหน้าต่าง กนง. (วันประชุมถึง +N วัน) ที่เปิดคำค้น cadence=mpc_window
// pure function ทั้งไฟล์ · วันที่ใน calendar.json เป็น ค.ศ. ISO เสมอ
import { isoDate, toDate } from './classify.js'

const DAY_MS = 86400000

function daysBetween(a, b) {
  return Math.floor((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS)
}

// คืน true เมื่อ now อยู่ในช่วง [วันประชุม กนง., วันประชุม + mpc_window_days]
export function inMpcWindow(calendar, now = new Date()) {
  const window = Number(calendar?.mpc_window_days ?? 3)
  const today = isoDate(now)
  for (const event of calendar?.events || []) {
    if (event.kind !== 'mpc' || !event.date) continue
    const diff = daysBetween(event.date, today)
    if (diff >= 0 && diff <= window) return true
  }
  return false
}

// ไอเดียจากปฏิทิน: เหตุการณ์ที่จะถึงภายใน lead_days (และยังไม่เกิน 1 วันหลังจากนั้น)
// kind=watch ไม่สร้างไอเดีย (เป็นเช็กลิสต์คน) · กุญแจ cal:<id>:<YYYY-MM-DD>
export function calendarIdeas(calendar, now = new Date()) {
  const lead = Number(calendar?.lead_days ?? 21)
  const today = isoDate(now)
  const out = []
  for (const event of calendar?.events || []) {
    if (!event?.date || event.kind === 'watch') continue
    const diff = daysBetween(today, event.date)
    if (diff < -1 || diff > lead) continue
    const when = diff > 0 ? `อีก ${diff} วัน` : diff === 0 ? 'วันนี้' : 'เมื่อวาน'
    const base = event.kind === 'mpc' ? 4.0 : 4.5
    out.push({
      source: 'official',
      source_label: 'ปฏิทินเหตุการณ์',
      subtype: event.subtype || 'market',
      title: `[${when}] ${event.title}`,
      summary: [event.note ? `📌 ${event.note}` : '', `วันที่ ${event.date} (ค.ศ.) · แหล่ง: ปฏิทินในระบบ ต้องยืนยันกับหน่วยงานก่อนโพสต์`].filter(Boolean).join('\n'),
      url: null,
      score: diff <= 7 ? base + 1.0 : base,
      audience: Array.isArray(event.audience) ? event.audience : null,
      event_date: event.date,
      event_key: `cal:${event.id}`,
      external_key: `cal:${event.id}:${event.date}`,
      related_sku: null,
      status: 'new',
    })
  }
  return out
}

// เช็กลิสต์สำหรับคน (kind=watch และ recurring) ที่ตรงกับช่วงเวลานี้ — ใช้พิมพ์ในรายงาน ไม่เข้าฐานข้อมูล
export function calendarWatchItems(calendar, now = new Date()) {
  const today = isoDate(now)
  const month = toDate(now).getUTCMonth() + 1
  const out = []
  for (const event of calendar?.events || []) {
    if (event.kind !== 'watch') continue
    const from = event.from || event.date
    const to = event.to || event.date
    if (from && to && today >= from && today <= to) out.push(`${event.title} (${from}–${to})`)
  }
  for (const item of calendar?.recurring || []) {
    if (item.kind !== 'watch') continue
    if (Array.isArray(item.months) && !item.months.includes(month)) continue
    out.push(item.title)
  }
  return out
}

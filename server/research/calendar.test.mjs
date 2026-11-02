import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calendarIdeas, inMpcWindow, calendarWatchItems } from './calendar.js'

const calendar = JSON.parse(readFileSync(new URL('../../research/calendar.json', import.meta.url), 'utf8'))

test('calendar.json: ทุกวันที่เป็น ค.ศ. ISO (กันใส่ปี พ.ศ.)', () => {
  for (const event of calendar.events) {
    for (const key of ['date', 'from', 'to']) {
      if (!event[key]) continue
      assert.match(event[key], /^20\d{2}-\d{2}-\d{2}$/, `${event.id}.${key}`)
    }
  }
})

test('หน้าต่าง กนง.: วันประชุมถึง +3 วัน', () => {
  assert.equal(inMpcWindow(calendar, new Date('2026-12-23T02:00:00Z')), true)
  assert.equal(inMpcWindow(calendar, new Date('2026-12-26T02:00:00Z')), true)
  assert.equal(inMpcWindow(calendar, new Date('2026-12-27T02:00:00Z')), false)
  assert.equal(inMpcWindow(calendar, new Date('2026-12-22T02:00:00Z')), false)
})

test('ไอเดียล่วงหน้า: ภายใน lead_days · ไม่สร้างจาก kind=watch · กุญแจ cal:<id>:<วัน>', () => {
  const ideas = calendarIdeas(calendar, new Date('2026-11-02T02:00:00Z'))
  const ids = ideas.map((i) => i.external_key)
  assert.ok(ids.includes('cal:mpc-minutes-2026-5:2026-11-11'))
  assert.ok(ids.includes('cal:bot-cash-rule-57-2569:2026-11-01'), 'เหตุการณ์เมื่อวานยังอยู่ 1 วัน')
  assert.ok(!ids.some((k) => k.startsWith('cal:treasury-valuation-watch')), 'watch ไม่สร้างไอเดีย')
  assert.ok(!ids.includes('cal:mpc-2026-6:2026-12-23'), 'เกิน 21 วันยังไม่ขึ้น')
  const minutes = ideas.find((i) => i.external_key === 'cal:mpc-minutes-2026-5:2026-11-11')
  assert.equal(minutes.source, 'official')
  assert.equal(minutes.subtype, 'rate')
  assert.equal(minutes.event_date, '2026-11-11')
  assert.match(minutes.title, /^\[อีก 9 วัน\]/)
  assert.ok(minutes.score >= 4)
  const soon = calendarIdeas(calendar, new Date('2026-12-20T02:00:00Z')).find((i) => i.external_key === 'cal:mpc-2026-6:2026-12-23')
  assert.ok(soon.score > minutes.score, 'ใกล้วันได้โบนัส')
})

test('เช็กลิสต์คน: ช่วงรอกรมธนารักษ์ และ REIC ตามไตรมาส', () => {
  assert.ok(calendarWatchItems(calendar, new Date('2026-11-28T02:00:00Z')).some((t) => /กรมธนารักษ์/.test(t)))
  assert.ok(!calendarWatchItems(calendar, new Date('2026-11-02T02:00:00Z')).some((t) => /กรมธนารักษ์/.test(t)))
  assert.ok(calendarWatchItems(calendar, new Date('2027-01-10T02:00:00Z')).some((t) => /REIC/.test(t)))
  assert.ok(!calendarWatchItems(calendar, new Date('2026-11-02T02:00:00Z')).some((t) => /REIC/.test(t)))
})

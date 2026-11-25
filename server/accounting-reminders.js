// ตัวเตือนงานเอกสารบัญชีของเจ้าของทางเทเลแกรม (เจ้าของขอ 25 พ.ย. 2569)
//   รอบเบิก            วันที่ 2, 3, 5 ของเดือน  — เจ้าของต้องนำใบขออนุมัติเบิกเงินไปเบิกกับบริษัทไม่เกินวันที่ 6
//   รอบเบิกที่ 2        วันที่ 21, 22 ของเดือน   — สำหรับรายการที่เบิกตกหล่น ต้องเบิกไม่เกินวันที่ 23 (เจ้าของกำหนด 25 พ.ย. 2569)
//   เอกสารที่ยังขาด     วันที่ 18 ของเดือน
// เรียกจาก Vercel Cron วันละครั้ง (ดู vercel.json → /api/telegram-webhook?task=accounting-reminders)
// ระบบบนเว็บไม่เห็นโฟลเดอร์เอกสารในเครื่อง: รายการที่ยังขาดมาจากไฟล์สถานะที่ Claude บนเครื่องเจ้าของเขียนขึ้น bucket
// (status/current.json · node scripts/accounting-inbox.mjs status-set <ไฟล์>) ไม่มีไฟล์สถานะ = เตือนแบบทั่วไป
// ข้อความเตือนมีแค่ชื่อรายการค่าใช้จ่าย ห้ามชื่อลูกค้า ยอดเงิน เลขบัญชี
import { INBOX_BUCKET } from './accounting-inbox.js'

export const STATUS_PATH = 'status/current.json'
export const HEARTBEAT_PATH = 'reminders/heartbeat.json'
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const DEFAULT_DAYS = { claim: [2, 3, 5], claim2: [21, 22], missing: [18] }
const ENV_KEY = { claim: 'ACCOUNTING_CLAIM_DAYS', claim2: 'ACCOUNTING_CLAIM2_DAYS', missing: 'ACCOUNTING_MISSING_DAYS' }
export const CLAIM_DEADLINE_DAY = 6
export const CLAIM2_DEADLINE_DAY = 23
// ไฟล์สถานะเก่ากว่านี้ถือว่าไม่รู้สถานะแล้ว (กันเตือนรายการของเดือนที่จบไปนาน)
const STATUS_MAX_AGE_DAYS = 45

// วันที่ตามเวลาไทย (เซิร์ฟเวอร์เป็น UTC)
export function bangkokDate(now = new Date()) {
  const t = new Date(new Date(now).getTime() + 7 * 3600 * 1000)
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate(), iso: t.toISOString().slice(0, 10) }
}

export function reminderDays(kind, env = process.env) {
  const raw = env[ENV_KEY[kind]]
  if (raw == null || String(raw).trim() === '') return DEFAULT_DAYS[kind]
  return String(raw).split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n >= 1 && n <= 31)
}

// ชนิดการเตือนที่ถึงกำหนดในวันนั้น
export function dueReminders(date, env = process.env) {
  return ['claim', 'claim2', 'missing'].filter((kind) => reminderDays(kind, env).includes(date.day))
}

const thaiMonthLabel = (ym) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ''))
  return m ? `${THAI_MONTHS[+m[2] - 1]} ${+m[1] + 543}` : ''
}

const cleanList = (list) => (Array.isArray(list) ? list : []).map((s) => String(s || '').trim().slice(0, 120)).filter(Boolean).slice(0, 12)

// รับเฉพาะช่องที่รู้จัก · ไฟล์เก่าเกินกำหนด = ไม่มีสถานะ
export function normalizeStatus(raw, now = new Date()) {
  if (!raw || typeof raw !== 'object') return null
  const updated = Date.parse(raw.updated_at || '')
  if (!Number.isFinite(updated) || new Date(now).getTime() - updated > STATUS_MAX_AGE_DAYS * 86400000) return null
  return { month: /^\d{4}-\d{2}$/.test(raw.month || '') ? raw.month : '', updated_at: raw.updated_at, claims: cleanList(raw.claims), missing: cleanList(raw.missing) }
}

const bullets = (list) => list.map((s) => `• ${s}`).join('\n')

export function buildReminderText(kind, { date, status = null, waiting = 0 } = {}) {
  const monthLabel = status?.month ? thaiMonthLabel(status.month) : ''
  const waitingLine = waiting > 0 ? `\n\nมีไฟล์ที่ส่งมาแล้วรอจัดเข้าโฟลเดอร์ ${waiting} ไฟล์ (เปิดคอมแล้วบอก Claude ให้ดึง)` : ''
  if (kind === 'claim' || kind === 'claim2') {
    const head = kind === 'claim'
      ? `📒 เตือนรอบเบิก — ต้องเบิกกับบริษัทไม่เกินวันที่ ${CLAIM_DEADLINE_DAY}`
      : `📒 เตือนรอบเบิกที่ 2 — สำหรับรายการที่เบิกตกหล่นจากรอบแรก ต้องเบิกไม่เกินวันที่ ${CLAIM2_DEADLINE_DAY}`
    const body = status?.claims?.length
      ? `รายการที่ยังไม่ได้ออกใบขออนุมัติเบิกเงิน:\n${bullets(status.claims)}`
      : status
        ? 'ตามข้อมูลล่าสุดไม่มีรายการค้างเบิก ถ้ามีรายการที่สำรองจ่ายเพิ่ม ส่งสลิปการโอนเงินและใบเสร็จเข้าห้องนี้หรือ LINE ของ AssetX'
        : 'รายการที่สำรองจ่ายไปแล้ว ให้ส่งสลิปการโอนเงินและใบเสร็จเข้าห้องนี้หรือ LINE ของ AssetX เพื่อออกใบขออนุมัติเบิกเงิน'
    const deadline = kind === 'claim' ? CLAIM_DEADLINE_DAY : CLAIM2_DEADLINE_DAY
    const tail = date?.day < deadline && deadline - date.day <= 7 ? `\n\nเหลือ ${deadline - date.day} วัน` : ''
    return `${head}\n\n${body}${tail}${waitingLine}`
  }
  const head = `📒 เอกสารบัญชี${monthLabel ? `เดือน${monthLabel} ` : 'ของเดือนนี้'}ที่ยังขาด`
  const body = status?.missing?.length
    ? bullets(status.missing)
    : status
      ? 'ตามข้อมูลล่าสุดเอกสารครบแล้ว'
      : 'ยังไม่มีข้อมูลสถานะของเดือนนี้ เปิดคอมแล้วบอก Claude ให้ตรวจโฟลเดอร์ของเดือน'
  const how = status?.missing?.length ? '\n\nถ่ายรูปหรือสแกนแล้วส่งเข้าห้องนี้หรือ LINE ของ AssetX ได้เลย' : ''
  return `${head}\n\n${body}${how}${waitingLine}`
}

async function readJson(bucket, objectPath) {
  const got = await bucket.download(objectPath)
  if (got.error || !got.data) return null
  try { return JSON.parse(Buffer.from(await got.data.arrayBuffer()).toString('utf8')) } catch { return null }
}

export async function readStatus(db, now = new Date()) {
  return normalizeStatus(await readJson(db.storage.from(INBOX_BUCKET), STATUS_PATH), now)
}

export async function writeStatus(db, status, now = new Date()) {
  const body = { month: status.month || '', updated_at: new Date(now).toISOString(), claims: cleanList(status.claims), missing: cleanList(status.missing) }
  const put = await db.storage.from(INBOX_BUCKET).upload(STATUS_PATH, Buffer.from(JSON.stringify(body, null, 2)), { contentType: 'application/json', upsert: true, cacheControl: '0' })
  if (put.error) throw new Error(put.error.message)
  return body
}

export async function readHeartbeat(db) {
  return readJson(db.storage.from(INBOX_BUCKET), HEARTBEAT_PATH)
}

async function countWaiting(bucket) {
  const listed = await bucket.list('new', { limit: 1000 })
  return listed.error ? 0 : (listed.data || []).filter((f) => !f.name.endsWith('.json')).length
}

// รันวันละครั้งจาก cron · เตือนแต่ละชนิดได้ครั้งเดียวต่อวัน (ไฟล์กันซ้ำ reminders/sent/<วัน>_<ชนิด>.json สร้างก่อนส่ง)
export async function runAccountingReminders({ db, send, now = new Date(), env = process.env, force = [] }) {
  if (!db) throw new Error('ไม่มีการเชื่อมต่อที่เก็บไฟล์')
  const bucket = db.storage.from(INBOX_BUCKET)
  await db.storage.createBucket(INBOX_BUCKET, { public: false }).catch(() => {})
  const date = bangkokDate(now)
  const due = force.length ? force : dueReminders(date, env)
  const sent = []
  const skipped = []
  if (due.length) {
    const [status, waiting] = [await readStatus(db, now), await countWaiting(bucket)]
    for (const kind of due) {
      if (!force.length) {
        const mark = await bucket.upload(`reminders/sent/${date.iso}_${kind}.json`, Buffer.from(JSON.stringify({ at: new Date(now).toISOString() })), { contentType: 'application/json', upsert: false })
        if (mark.error) { skipped.push(kind); continue }
      }
      await send(buildReminderText(kind, { date, status, waiting }))
      sent.push(kind)
    }
  }
  // ร่องรอยว่า cron ทำงาน (ดูด้วย node scripts/accounting-inbox.mjs status) · ชื่อไฟล์เดิมจึงอาจอ่านได้ค่าเก่าจากแคช ใช้ดูคร่าว ๆ เท่านั้น
  await bucket.upload(HEARTBEAT_PATH, Buffer.from(JSON.stringify({ at: new Date(now).toISOString(), date: date.iso, sent, skipped })), { contentType: 'application/json', upsert: true, cacheControl: '0' }).catch(() => {})
  return { date: date.iso, due, sent, skipped }
}

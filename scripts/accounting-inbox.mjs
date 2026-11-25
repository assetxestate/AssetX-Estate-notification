#!/usr/bin/env node
// ดึงเอกสารบัญชีที่เจ้าของส่งทางเทเลแกรม/LINE ลงโฟลเดอร์ "กล่องรับเอกสาร" บนเครื่องนี้ — ดู server/accounting-inbox.js
// ใช้ SUPABASE_SERVICE_ROLE_KEY จาก .env.local (ไม่ผ่านเบราว์เซอร์ ไม่ผ่าน API ของเว็บ)
//
//   node scripts/accounting-inbox.mjs pull     ดึงไฟล์ใหม่ลงเครื่อง แล้วพิมพ์รายการที่ได้
//   node scripts/accounting-inbox.mjs count    นับไฟล์ที่ยังรออยู่บนระบบ (ไม่ดึง)
//   node scripts/accounting-inbox.mjs status   ดูสถานะที่ตัวเตือนใช้ (รายการค้างเบิก · เอกสารที่ยังขาด) และครั้งล่าสุดที่ตัวเตือนทำงาน
//   node scripts/accounting-inbox.mjs status-set <ไฟล์.json>   เขียนสถานะขึ้นระบบ { "month": "2026-11", "claims": [...], "missing": [...] }
//                                               (ชื่อรายการค่าใช้จ่ายเท่านั้น ห้ามชื่อลูกค้า ยอดเงิน เลขบัญชี)
//   node scripts/accounting-inbox.mjs remind <claim|claim2|missing> [--send]   ดูข้อความเตือน · --send = ส่งเข้าห้องบอทจริง
//
// โฟลเดอร์ปลายทาง: ACCOUNTING_INBOX_DIR ใน .env.local หรือค่าเริ่มต้น <โฟลเดอร์แม่ของโปรเจกต์>/เอกสารบัญชี/กล่องรับเอกสาร
// (อยู่นอกรีโป: สลิปและใบเสร็จห้ามเข้า git)
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { INBOX_BUCKET, pullInbox } from '../server/accounting-inbox.js'
import { readStatus, writeStatus, readHeartbeat, buildReminderText, bangkokDate, runAccountingReminders, reminderDays } from '../server/accounting-reminders.js'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
config({ path: path.join(repo, '.env.local'), quiet: true })
config({ path: path.join(repo, '.env'), quiet: true })

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('ไม่พบ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ใน .env.local')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })
const inboxDir = process.env.ACCOUNTING_INBOX_DIR || path.join(path.dirname(repo), 'เอกสารบัญชี', 'กล่องรับเอกสาร')
const command = process.argv[2] || 'pull'

if (command === 'count') {
  const listed = await db.storage.from(INBOX_BUCKET).list('new', { limit: 1000 })
  if (listed.error) {
    console.log(/not found|does not exist/i.test(String(listed.error.message || '')) ? 'รออยู่ 0 ไฟล์ (ยังไม่เคยมีไฟล์ส่งเข้ามา)' : `ตรวจไม่ได้: ${listed.error.message}`)
  } else {
    console.log(`รออยู่ ${listed.data.filter((f) => !f.name.endsWith('.json')).length} ไฟล์`)
  }
} else if (command === 'pull') {
  const pulled = await pullInbox(db, { inboxDir, log: (line) => console.log(line) })
  if (!pulled.length) console.log('ไม่มีไฟล์ใหม่')
  // พิมพ์เฉพาะชื่อไฟล์บนเครื่องและช่องทาง ไม่พิมพ์คำบรรยาย
  for (const item of pulled) console.log(`  ${item.file} (${item.source})`)
  console.log(`โฟลเดอร์: ${inboxDir}`)
} else if (command === 'status') {
  const status = await readStatus(db)
  console.log(status ? JSON.stringify(status, null, 2) : 'ยังไม่มีสถานะ (หรือเก่าเกิน 45 วัน)')
  for (const kind of ['claim', 'claim2', 'missing']) console.log(`วันเตือน ${kind}: ${reminderDays(kind).join(', ') || '(ยังไม่ตั้ง)'}`)
  const beat = await readHeartbeat(db)
  console.log(beat ? `ตัวเตือนทำงานล่าสุด: ${beat.at} · ส่ง: ${(beat.sent || []).join(', ') || '-'}` : 'ตัวเตือนยังไม่เคยทำงาน')
} else if (command === 'status-set') {
  const file = process.argv[3]
  if (!file) { console.error('ระบุไฟล์ .json'); process.exit(1) }
  const saved = await writeStatus(db, JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')))
  console.log(`บันทึกสถานะแล้ว: เดือน ${saved.month || '-'} · ค้างเบิก ${saved.claims.length} · ยังขาด ${saved.missing.length}`)
} else if (command === 'remind') {
  const kind = process.argv[3]
  if (!['claim', 'claim2', 'missing'].includes(kind)) { console.error('ชนิด: claim · claim2 · missing'); process.exit(1) }
  if (process.argv.includes('--send')) {
    const token = process.env.ASSETX_TELEGRAM_BOT_TOKEN
    const chatId = String(process.env.ASSETX_TELEGRAM_ALLOWED_CHAT_ID || '').trim()
    if (!token || !chatId) { console.error('ไม่พบ ASSETX_TELEGRAM_BOT_TOKEN / ASSETX_TELEGRAM_ALLOWED_CHAT_ID ใน .env.local'); process.exit(1) }
    const send = async (text) => {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }) })
      if (!response.ok) throw new Error(`Telegram ${response.status}`)
    }
    const out = await runAccountingReminders({ db, send, force: [kind] })
    console.log(`ส่งแล้ว: ${out.sent.join(', ')}`)
  } else {
    const listed = await db.storage.from(INBOX_BUCKET).list('new', { limit: 1000 })
    const waiting = listed.error ? 0 : listed.data.filter((f) => !f.name.endsWith('.json')).length
    console.log(buildReminderText(kind, { date: bangkokDate(), status: await readStatus(db), waiting }))
  }
} else {
  console.error('คำสั่งที่ใช้ได้: pull · count · status · status-set · remind')
  process.exit(1)
}

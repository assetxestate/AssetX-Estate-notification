#!/usr/bin/env node
// ดึงเอกสารบัญชีที่เจ้าของส่งทางเทเลแกรม/LINE ลงโฟลเดอร์ "กล่องรับเอกสาร" บนเครื่องนี้ — ดู server/accounting-inbox.js
// ใช้ SUPABASE_SERVICE_ROLE_KEY จาก .env.local (ไม่ผ่านเบราว์เซอร์ ไม่ผ่าน API ของเว็บ)
//
//   node scripts/accounting-inbox.mjs pull     ดึงไฟล์ใหม่ลงเครื่อง แล้วพิมพ์รายการที่ได้
//   node scripts/accounting-inbox.mjs count    นับไฟล์ที่ยังรออยู่บนระบบ (ไม่ดึง)
//
// โฟลเดอร์ปลายทาง: ACCOUNTING_INBOX_DIR ใน .env.local หรือค่าเริ่มต้น <โฟลเดอร์แม่ของโปรเจกต์>/เอกสารบัญชี/กล่องรับเอกสาร
// (อยู่นอกรีโป: สลิปและใบเสร็จห้ามเข้า git)
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { INBOX_BUCKET, pullInbox } from '../server/accounting-inbox.js'

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
} else {
  console.error('คำสั่งที่ใช้ได้: pull · count')
  process.exit(1)
}

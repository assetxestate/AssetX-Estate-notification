#!/usr/bin/env node
// งานตรวจเอกสารบัญชีประจำวันบนเครื่องเจ้าของ (เจ้าของขอ 25 พ.ย. 2569: ตรวจวันละรอบ 08:30 น.)
// สคริปต์นี้คือ "มือ" ที่ Claude แบบไม่มีหน้าต่างได้รับอนุญาตให้ใช้ — ทำได้เฉพาะสิ่งที่ระบุไว้ ไม่ลบและไม่เขียนทับไฟล์เอกสาร
// ตัวเรียก: scripts/accounting-daily.ps1 (Task Scheduler) · คำสั่งให้ Claude: scripts/accounting-daily-prompt.md
//
//   check                      ดึงไฟล์จากกล่องบนระบบ แล้วบอกว่ามีของใหม่ไหม (exit 10 = มี · 0 = ไม่มี)
//   scan                       แสดงไฟล์ในกล่องรับเอกสาร และโฟลเดอร์ของเดือนนี้กับเดือนก่อน (* = ใหม่ตั้งแต่รอบที่แล้ว)
//   file <ไฟล์ในกล่อง> <โฟลเดอร์ปลายทาง> <ชื่อไฟล์ใหม่>
//                              คัดลอกไฟล์จากกล่องเข้าโฟลเดอร์รายการ (ต้องมีอยู่แล้ว · ไม่เขียนทับ) แล้วย้ายต้นฉบับไป กล่องรับเอกสาร/จัดแล้ว
//                              โฟลเดอร์ปลายทางเขียนต่อจาก "รายการค่าใช้จ่าย และการชำระเงิน" เช่น "ปี 2569/เดือน 11/ค่าเช่าอาคาร(ชำระเงินแล้ว)"
//   hold <ไฟล์ในกล่อง>         ย้ายไฟล์ที่ซ้ำหรือไม่ใช่เอกสารบัญชีไป กล่องรับเอกสาร/ไม่ได้จัด (ไม่ลบ)
//   report <ไฟล์ข้อความ>       ส่งสรุปเข้าห้องบอทเทเลแกรม (ห้ามชื่อลูกค้า ยอดเงิน เลขบัญชี)
//   done                       จดเวลารอบนี้ (ใช้เทียบของใหม่ในรอบถัดไป)
//
// เอกสารบัญชีทั้งหมดอยู่นอกรีโป · สถานะของงานนี้อยู่ใน .local/accounting/ (ไม่ขึ้น git)
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pullInbox } from '../server/accounting-inbox.js'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
config({ path: path.join(repo, '.env.local'), quiet: true })

const accountingRoot = process.env.ACCOUNTING_ROOT_DIR || path.join(path.dirname(repo), 'เอกสารบัญชี')
const inboxDir = process.env.ACCOUNTING_INBOX_DIR || path.join(accountingRoot, 'กล่องรับเอกสาร')
const expenseRoot = path.join(accountingRoot, 'เอกสารบัญชี', 'รายการค่าใช้จ่าย และการชำระเงิน')
const stateDir = path.join(repo, '.local', 'accounting')
const stateFile = path.join(stateDir, 'last-run.json')
const DOC_EXT = new Set(['.jpg', '.jpeg', '.png', '.pdf'])

const lastRun = () => { try { return Date.parse(JSON.parse(fs.readFileSync(stateFile, 'utf8')).at) || 0 } catch { return 0 } }
const inside = (parent, child) => { const rel = path.relative(parent, child); return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel) }
const fail = (text) => { console.error(text); process.exit(1) }

// โฟลเดอร์ของเดือนนี้และเดือนก่อน ตามเวลาไทย · ปีเป็น พ.ศ. · เดือนไม่เติมศูนย์ (แบบที่เจ้าของใช้)
export function monthFolders(now = new Date()) {
  const t = new Date(now.getTime() + 7 * 3600 * 1000)
  const out = []
  for (const back of [0, 1]) {
    const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - back, 1))
    out.push(path.join(`ปี ${d.getUTCFullYear() + 543}`, `เดือน ${d.getUTCMonth() + 1}`))
  }
  return out
}

function walk(dir, base = dir, out = []) {
  let entries = []
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, base, out)
    else out.push({ rel: path.relative(base, full), mtime: fs.statSync(full).mtimeMs, size: fs.statSync(full).size })
  }
  return out
}

const inboxFiles = () => {
  try { return fs.readdirSync(inboxDir, { withFileTypes: true }).filter((e) => e.isFile() && DOC_EXT.has(path.extname(e.name).toLowerCase())).map((e) => e.name) } catch { return [] }
}

function newInMonthFolders(since) {
  const hits = []
  for (const folder of monthFolders()) {
    for (const f of walk(path.join(expenseRoot, folder))) {
      // ไฟล์ชั่วคราวของ Word (~$...) ไม่นับ
      if (f.mtime > since && !path.basename(f.rel).startsWith('~$')) hits.push(path.join(folder, f.rel))
    }
  }
  return hits
}

const command = process.argv[2]

if (command === 'check') {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  let pulled = 0
  if (url && key) {
    try {
      pulled = (await pullInbox(createClient(url, key, { auth: { persistSession: false } }), { inboxDir })).length
    } catch (error) {
      console.log(`ดึงจากระบบไม่ได้: ${String(error?.message || error).slice(0, 120)}`)
    }
  }
  const waiting = inboxFiles().length
  const changed = newInMonthFolders(lastRun()).length
  console.log(`ดึงใหม่ ${pulled} · รอในกล่อง ${waiting} · ไฟล์ใหม่ในโฟลเดอร์เดือน ${changed}`)
  // ตั้ง exitCode แล้วปล่อยให้จบเอง: process.exit ขณะการเชื่อมต่อยังปิดไม่เสร็จทำให้ Node บน Windows ล้ม
  process.exitCode = waiting || changed ? 10 : 0
} else if (command === 'scan') {
  const since = lastRun()
  console.log(`รอบที่แล้ว: ${since ? new Date(since).toISOString() : 'ยังไม่เคยรัน'}`)
  console.log(`\n[กล่องรับเอกสาร] ${inboxDir}`)
  for (const name of inboxFiles()) console.log(`  ${name}`)
  try {
    const notes = fs.readFileSync(path.join(inboxDir, 'notes.jsonl'), 'utf8').trim().split('\n').slice(-30)
    console.log('  คำบรรยายที่ส่งมากับไฟล์ (ล่าสุด):')
    for (const line of notes) { try { const n = JSON.parse(line); if (n.caption) console.log(`    ${n.file}: ${n.caption}`) } catch { /* ข้ามบรรทัดเสีย */ } }
  } catch { /* ยังไม่มีไฟล์คำบรรยาย */ }
  for (const folder of monthFolders()) {
    const root = path.join(expenseRoot, folder)
    console.log(`\n[${folder}] ${fs.existsSync(root) ? '' : '(ยังไม่มีโฟลเดอร์นี้)'}`)
    for (const f of walk(root).sort((a, b) => a.rel.localeCompare(b.rel, 'th'))) {
      if (path.basename(f.rel).startsWith('~$')) continue
      console.log(`  ${f.mtime > since ? '*' : ' '} ${f.rel}  (${Math.round(f.size / 1024)} KB)`)
    }
  }
} else if (command === 'file') {
  const [, , , srcName, destRel, newName] = process.argv
  if (!srcName || !destRel || !newName) fail('ใช้: file <ไฟล์ในกล่อง> <โฟลเดอร์ปลายทาง> <ชื่อไฟล์ใหม่>')
  const src = path.join(inboxDir, path.basename(srcName))
  if (!fs.existsSync(src)) fail(`ไม่พบไฟล์ในกล่องรับเอกสาร: ${path.basename(srcName)}`)
  const destDir = path.resolve(expenseRoot, destRel)
  if (!inside(expenseRoot, destDir)) fail('โฟลเดอร์ปลายทางต้องอยู่ใต้ "รายการค่าใช้จ่าย และการชำระเงิน"')
  if (!fs.existsSync(destDir) || !fs.statSync(destDir).isDirectory()) fail(`ไม่มีโฟลเดอร์ปลายทาง (งานนี้ไม่สร้างโฟลเดอร์เอง): ${destRel}`)
  if (path.basename(newName) !== newName || /[<>:"|?*]/.test(newName)) fail('ชื่อไฟล์ใหม่ไม่ถูกต้อง')
  if (path.extname(newName).toLowerCase() !== path.extname(src).toLowerCase()) fail('นามสกุลไฟล์ใหม่ต้องตรงกับไฟล์ต้นทาง')
  const dest = path.join(destDir, newName)
  if (fs.existsSync(dest)) fail(`มีไฟล์ชื่อนี้อยู่แล้ว ไม่เขียนทับ: ${newName}`)
  fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL)
  if (fs.statSync(dest).size !== fs.statSync(src).size) fail('คัดลอกแล้วขนาดไม่ตรง ต้นฉบับยังอยู่ในกล่อง')
  const filedDir = path.join(inboxDir, 'จัดแล้ว')
  fs.mkdirSync(filedDir, { recursive: true })
  fs.renameSync(src, path.join(filedDir, path.basename(src)))
  console.log(`จัดเข้าแล้ว: ${path.join(destRel, newName)}`)
} else if (command === 'hold') {
  const srcName = process.argv[3]
  if (!srcName) fail('ใช้: hold <ไฟล์ในกล่อง>')
  const src = path.join(inboxDir, path.basename(srcName))
  if (!fs.existsSync(src)) fail(`ไม่พบไฟล์ในกล่องรับเอกสาร: ${path.basename(srcName)}`)
  const holdDir = path.join(inboxDir, 'ไม่ได้จัด')
  fs.mkdirSync(holdDir, { recursive: true })
  fs.renameSync(src, path.join(holdDir, path.basename(src)))
  console.log(`ย้ายไป ไม่ได้จัด: ${path.basename(src)}`)
} else if (command === 'report') {
  const file = process.argv[3]
  if (!file) fail('ใช้: report <ไฟล์ข้อความ>')
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').trim().slice(0, 3500)
  if (!text) fail('ข้อความว่าง')
  const token = process.env.ASSETX_TELEGRAM_BOT_TOKEN
  const chatId = String(process.env.ASSETX_TELEGRAM_ALLOWED_CHAT_ID || '').trim()
  if (!token || !chatId) fail('ไม่พบ ASSETX_TELEGRAM_BOT_TOKEN / ASSETX_TELEGRAM_ALLOWED_CHAT_ID ใน .env.local')
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  })
  if (!response.ok) fail(`Telegram ${response.status}`)
  console.log('ส่งสรุปแล้ว')
} else if (command === 'done') {
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(stateFile, JSON.stringify({ at: new Date().toISOString() }))
  console.log('จดเวลารอบนี้แล้ว')
} else {
  fail('คำสั่งที่ใช้ได้: check · scan · file · hold · report · done')
}

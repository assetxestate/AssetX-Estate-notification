#!/usr/bin/env node
// scripts/diary-sync.mjs — สะพานระหว่าง Claude Code กับไดอารี่งานในแอป (ตาราง diary_days / diary_commands)
// ใช้ SUPABASE_SERVICE_ROLE_KEY จาก .env.local โดยตรง (ไม่ผ่านเบราว์เซอร์ ไม่ผ่าน API ของเว็บ)
//
// node scripts/diary-sync.mjs brief                      สรุปสิ่งที่ Claude ต้องทำตอนเริ่ม session (hook SessionStart เรียกให้)
// node scripts/diary-sync.mjs pull-days                  ดึงบันทึกทุกวันจาก DB → .claude/diary/days/<วัน>.json (เพื่อซิงก์ติ๊กเข้าไฟล์ md)
// node scripts/diary-sync.mjs push-day <ไฟล์.json>       ส่งบันทึกของวันขึ้น DB · คง done/choice ที่เจ้าของเปลี่ยนจากเว็บ (จับคู่ pending[].id)
// node scripts/diary-sync.mjs command <id> <สถานะ> [ผล]  เปลี่ยนสถานะคำสั่ง: doing | done | dropped (+ข้อความผลที่จะโชว์ใต้คำสั่ง)
// node scripts/diary-sync.mjs acted <วัน> <pid>          บอกว่า Claude ทำตามทางที่เจ้าของเลือกแล้ว
// node scripts/diary-sync.mjs done <วัน> <pid> [--undo]  ติ๊กจบข้อค้าง (งานของ Claude) หรือเอาติ๊กออก
//
// ข้อความในไดอารี่เป็นเชิงคุณภาพอยู่แล้ว (รีโปสาธารณะ) — สคริปต์นี้ไม่พิมพ์ข้อมูลลูกค้า
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
config({ path: path.join(repo, '.env.local'), quiet: true })
config({ path: path.join(repo, '.env'), quiet: true })

let cfg = {}
try { cfg = JSON.parse(readFileSync(path.join(repo, '.claude', 'daily-log.json'), 'utf8')) } catch { /* ไม่มีไฟล์ตั้งค่า → ใช้ค่าเริ่มต้น */ }
const DAYS_DIR = path.join(repo, cfg.diary_days_dir || '.claude/diary/days')
const DAILY_DIR = cfg.dir || 'docs/daily'
const DIARY_URL = cfg.diary_url || 'https://assetx-estate.vercel.app/diary'
const OWNER_FIELDS = ['done', 'done_at', 'choice', 'choice_note', 'choice_at']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const STATUSES = ['doing', 'done', 'dropped']
const SELF = 'node scripts/diary-sync.mjs'

const [cmd, ...args] = process.argv.slice(2)
const out = (s = '') => process.stdout.write(`${s}\n`)
function die(message, code = 1) {
  console.error(message)
  process.exit(code)
}

function database() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('ไม่มี VITE_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน .env.local')
  return createClient(url, key, { auth: { persistSession: false } })
}
const missingTable = (error) => ['42P01', 'PGRST205'].includes(error?.code)
const nowIso = () => new Date().toISOString()
const thaiTime = (iso) => {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return ''
  return t.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
const strip = (payload) => { const copy = { ...payload }; delete copy.version; return copy }
const fileFor = (date) => path.join(DAYS_DIR, `${date}.json`)
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const writeJson = (file, data) => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}

async function listDays(db) {
  const { data, error } = await db.from('diary_days').select('date,payload,version,updated_at').order('date', { ascending: false })
  if (error) throw error
  return data || []
}
async function getDay(db, date) {
  const { data, error } = await db.from('diary_days').select('date,payload,version').eq('date', date).maybeSingle()
  if (error) throw error
  return data
}
// เขียนทับ payload ของวัน โดยตรวจว่าเวอร์ชันยังเป็นของที่เพิ่งอ่าน (ถ้าเจ้าของกดจากเว็บพอดี จะไม่ทับกัน)
async function saveDay(db, row, payload) {
  const { data, error } = await db
    .from('diary_days')
    .update({ payload, version: row.version + 1, updated_at: nowIso() })
    .eq('date', row.date)
    .eq('version', row.version)
    .select('date,version')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`บันทึกของ ${row.date} ถูกแก้จากที่อื่นระหว่างทาง (version ${row.version}) — รันคำสั่งใหม่อีกครั้ง`)
  return data.version
}
async function patchPending(db, date, pid, fn) {
  if (!DATE_RE.test(date || '')) die('วันที่ต้องเป็น YYYY-MM-DD')
  const row = await getDay(db, date)
  if (!row) die(`ไม่พบบันทึกของ ${date} ในฐานข้อมูล`)
  const pending = Array.isArray(row.payload?.pending) ? row.payload.pending : []
  const index = pending.findIndex((p) => p && p.id === pid)
  if (index < 0) die(`ไม่พบข้อค้าง "${pid}" ในวันที่ ${date} (มี: ${pending.map((p) => p.id).join(', ') || 'ไม่มี'})`)
  const next = pending.slice()
  next[index] = fn({ ...pending[index] })
  const version = await saveDay(db, row, { ...row.payload, pending: next })
  const file = fileFor(date)
  if (existsSync(file)) {
    const local = readJson(file)
    local.pending = next
    writeJson(file, local)
  }
  return version
}

async function brief() {
  let db
  try { db = database() } catch (error) { out(`[ไดอารี่งาน] อ่านฐานข้อมูลไม่ได้: ${error.message}`); return }
  let days
  let commands
  try {
    const [d, c] = await Promise.all([
      listDays(db),
      db.from('diary_commands').select('*').in('status', ['new', 'doing']).order('created_at', { ascending: true }),
    ])
    if (c.error) throw c.error
    days = d
    commands = c.data || []
  } catch (error) {
    if (missingTable(error)) { out('[ไดอารี่งาน] ตาราง diary_* ยังไม่ถูกสร้าง — ให้เจ้าของรัน supabase_diary.sql ใน Supabase ก่อน'); return }
    out(`[ไดอารี่งาน] อ่านฐานข้อมูลไม่สำเร็จ: ${error.message || error}`)
    return
  }

  out(`[ไดอารี่งาน] หน้าเว็บ ${DIARY_URL} · ฐานข้อมูลมี ${days.length} วัน · คำสั่งเปิดอยู่ ${commands.length}`)

  if (commands.length) {
    out(`คำสั่งจากเจ้าของที่ยังไม่ปิด (ทำแล้วปิดด้วย: ${SELF} command <id> done "ผล" · ทำไม่ได้: dropped "เหตุผล"):`)
    for (const c of commands) out(`- ${c.id} [${c.status}] ${thaiTime(c.created_at)} — ${String(c.text).replace(/\s+/g, ' ').trim()}`)
  } else {
    out('คำสั่งใหม่จากเจ้าของ: ไม่มี')
  }

  const chosen = []
  const newlyDone = []
  const open = []
  for (const row of days) {
    const pending = Array.isArray(row.payload?.pending) ? row.payload.pending : []
    let local = null
    try { if (existsSync(fileFor(row.date))) local = readJson(fileFor(row.date)) } catch { local = null }
    for (const p of pending) {
      if (!p) continue
      if (p.owner === 'decide' && p.choice && !p.acted && !p.done) {
        const o = (p.options || []).find((x) => x.id === p.choice)
        const label = p.choice === 'other' ? `อื่น ๆ: ${p.choice_note || ''}` : (o ? o.label : p.choice)
        chosen.push(`- ${row.date} / ${p.id}: เลือก "${label}" (${thaiTime(p.choice_at)}) — ${p.text}`)
      }
      const localItem = local && Array.isArray(local.pending) ? local.pending.find((x) => x && x.id === p.id) : null
      if (p.done && local && (!localItem || !localItem.done)) newlyDone.push(`- ${row.date} / ${p.id}: ${p.text}`)
      if (!p.done) open.push(`- ${row.date} · ${p.owner || '-'} · ${p.text}`)
    }
  }
  out(chosen.length ? `ทางที่เจ้าของเลือกแล้ว รอ Claude ทำ (ทำแล้ว: ${SELF} acted <วัน> <pid>):\n${chosen.join('\n')}` : 'ทางที่เจ้าของเลือกแล้วรอทำ: ไม่มี')
  out(newlyDone.length
    ? `ติ๊กจบจากเว็บที่ไฟล์ในรีโปยังไม่ตรง (รัน ${SELF} pull-days แล้วติ๊ก [x] ใน ${DAILY_DIR}/<วัน>.md):\n${newlyDone.join('\n')}`
    : 'ติ๊กใหม่จากเว็บที่ยังไม่ซิงก์: ไม่มี')
  out(open.length ? `ค้างที่ยังไม่จบทั้งหมด ${open.length} ข้อ:\n${open.slice(0, 12).join('\n')}${open.length > 12 ? `\n- … อีก ${open.length - 12} ข้อ` : ''}` : 'ค้างที่ยังไม่จบ: ไม่มี')
}

async function pullDays() {
  const db = database()
  const rows = await listDays(db)
  if (!rows.length) { out('ฐานข้อมูลยังไม่มีบันทึก'); return }
  for (const row of rows) {
    const file = fileFor(row.date)
    const next = strip({ ...row.payload, date: row.date })
    const before = existsSync(file) ? readFileSync(file, 'utf8') : null
    const text = `${JSON.stringify(next, null, 2)}\n`
    if (before === text) { out(`= ${row.date} (เหมือนเดิม)`); continue }
    writeJson(file, next)
    out(`${before ? '~' : '+'} ${row.date} → ${path.relative(repo, file)}`)
  }
}

async function pushDay(file) {
  if (!file) die(`ใช้: ${SELF} push-day <ไฟล์.json>`)
  const abs = path.resolve(repo, file)
  const data = readJson(abs)
  if (!DATE_RE.test(data.date || '')) die('ไฟล์ต้องมี "date" รูป YYYY-MM-DD')
  const db = database()
  const payload = strip(data)
  payload.pending = Array.isArray(payload.pending) ? payload.pending : []
  for (const p of payload.pending) if (!p || typeof p.id !== 'string' || !p.id) die('ทุกข้อใน pending ต้องมี id คงที่')

  const row = await getDay(db, data.date)
  if (!row) {
    const { error } = await db.from('diary_days').insert({ date: data.date, payload, version: 1 })
    if (error) throw error
    out(`push-day ${data.date}: สร้างใหม่ (version 1) · pending ${payload.pending.length} ข้อ`)
    return
  }

  // คงสิ่งที่เจ้าของเปลี่ยนจากเว็บ: done/done_at/choice/choice_note/choice_at · acted เป็นจริงถ้าฝ่ายใดฝ่ายหนึ่งตั้งไว้
  const dbPending = Array.isArray(row.payload?.pending) ? row.payload.pending : []
  let kept = 0
  payload.pending = payload.pending.map((p) => {
    const prev = dbPending.find((x) => x && x.id === p.id)
    if (!prev) return p
    const merged = { ...p }
    for (const f of OWNER_FIELDS) if (prev[f] !== undefined) merged[f] = prev[f]
    if (p.acted || prev.acted) merged.acted = true
    if (OWNER_FIELDS.some((f) => prev[f] !== undefined && prev[f] !== p[f])) kept++
    return merged
  })
  for (const prev of dbPending) {
    if (prev && !payload.pending.some((p) => p.id === prev.id)) payload.pending.push(prev) // ไม่ลบข้อที่ไฟล์ไม่มีแล้ว
  }
  const version = await saveDay(db, row, payload)
  writeJson(abs, { ...payload, date: data.date })
  out(`push-day ${data.date}: version ${row.version} → ${version} · คงค่าที่เจ้าของเปลี่ยนจากเว็บ ${kept} ข้อ · เขียนกลับ ${path.relative(repo, abs)}`)
}

async function command(id, status, ...rest) {
  if (!id || !STATUSES.includes(status)) die(`ใช้: ${SELF} command <id> <doing|done|dropped> [ผล]`)
  const result = rest.join(' ').trim()
  if ((status === 'done' || status === 'dropped') && !result) die('สถานะ done/dropped ต้องมีข้อความผล เจ้าของจะอ่านจากหน้าเว็บ')
  const db = database()
  const { data: row, error } = await db.from('diary_commands').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!row) die(`ไม่พบคำสั่ง ${id}`)
  const patch = { status, version: row.version + 1 }
  if (result) patch.result = result
  patch.done_at = status === 'doing' ? null : nowIso()
  const saved = await db.from('diary_commands').update(patch).eq('id', id).eq('version', row.version).select('id,status').maybeSingle()
  if (saved.error) throw saved.error
  if (!saved.data) die(`คำสั่ง ${id} ถูกแก้จากที่อื่นระหว่างทาง — ลองใหม่`)
  out(`command ${id}: ${row.status} → ${status}${result ? ` · ผล: ${result}` : ''}`)
}

async function acted(date, pid) {
  if (!pid) die(`ใช้: ${SELF} acted <วัน> <pid>`)
  const db = database()
  const version = await patchPending(db, date, pid, (p) => ({ ...p, acted: true, acted_at: nowIso() }))
  out(`acted ${date}/${pid}: ตั้ง acted=true (version ${version})`)
}

async function done(date, pid, flag) {
  if (!pid) die(`ใช้: ${SELF} done <วัน> <pid> [--undo]`)
  const want = flag !== '--undo'
  const db = database()
  const version = await patchPending(db, date, pid, (p) => ({ ...p, done: want, done_at: want ? nowIso() : null }))
  out(`done ${date}/${pid}: ${want ? 'ติ๊กจบแล้ว' : 'เอาติ๊กออก'} (version ${version})`)
}

const commands = { brief, 'pull-days': pullDays, 'push-day': pushDay, command, acted, done }
if (!commands[cmd]) {
  out(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('// node ')).join('\n').replace(/^\/\/ /gm, ''))
  process.exit(cmd ? 1 : 0)
}
try {
  await commands[cmd](...args)
} catch (error) {
  if (missingTable(error)) die('ตาราง diary_* ยังไม่ถูกสร้าง — รัน supabase_diary.sql ใน Supabase Dashboard → SQL Editor ก่อน')
  die(error?.message || String(error))
}

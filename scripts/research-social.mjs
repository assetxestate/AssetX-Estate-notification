#!/usr/bin/env node
// scripts/research-social.mjs — ตัวเฝ้าเพจ Facebook ของ AssetX (ขั้นที่ 7 ของระบบรีเสิร์ช) · ใช้ browser + บัญชีสำรองร่วมกับ DivisionX Card
// ข้อตกลง 2 ระบบ (ต้องทำครบทุกข้อ): ~/.claude/skills/social-research/profiles/shared-browser-dvx-assetx.md · เครื่องยนต์: server/research/social-watch.js
//
// node scripts/research-social.mjs run [--dry-run] [--limit N] [--target คำ] [--no-report]
//     รอบประจำวัน (Task Scheduler 21:00 + สำรอง 23:00 ช่วงกลางคืนตามที่เจ้าของเลือก · ทั้งคู่ก่อนเที่ยงคืนให้อยู่วันไทยเดียวกัน · ห่างจากรอบรีเสิร์ช 07:00–08:30 และรอบ DVX ~07:03):
//     ตรวจแถวพักร่วม/โควตา → ถือกุญแจกลาง (รอได้ 20 นาที) → อ่าน ≤ 4 เพจที่ถึงรอบ ≤ ~7 นาที → ปล่อยกุญแจ →
//     คัดโพสต์แรงกว่าปกติของเพจเข้าคิว marketing_ideas (source social) → รายงานเทเลแกรม
//     วันละ 1 รอบ: ~/.research-browser/usage.jsonl มีแถว assetx วันนี้แล้ว = ข้าม (รอบสำรองข้ามเอง) · ทุกรอบลง runs.jsonl รวมรอบที่ข้าม
//     --dry-run  อ่านจริงแต่ไม่เขียนคลัง/สถานะ/คิวของเรา (ของร่วมใน ~/.research-browser ยังถือกุญแจ+จดตามข้อตกลง 4.7)
//     --limit N  อ่านไม่เกิน N เพจ (รอบลองจริงครั้งแรกใช้ --limit 1)
//     --target คำ  เจ้าของสั่งอ่านเพจเฉพาะ (ชื่อ/ลิงก์มีคำนี้): ไม่สนรอบ และไม่สนว่าวันนี้อ่านแล้ว แต่ยังเคารพแถวพักร่วมและเพดาน 12/4 เสมอ (ข้อตกลง 4.7)
// node scripts/research-social.mjs status     ใครถือกุญแจ · แถวพักร่วม · เพจที่เปิดวันนี้ (รวม/ของเรา) · เพจถึงรอบ · เยี่ยมล่าสุด — อ่านอย่างเดียว ไม่แตะ browser
// node scripts/research-social.mjs report     รอบล่าสุดจาก runs.jsonl
// node scripts/research-social.mjs account check   ตรวจการตั้งบัญชี Facebook ของ AssetX เอง (อ่านอย่างเดียว ไม่แตะ browser): Chrome profile ตามชื่อ · ลงส่วนเสริม OpenCLI แล้วไหม · ชื่อเรียกใน OpenCLI · โหมดในคอนฟิก
// node scripts/research-social.mjs account link    ตั้งชื่อเรียก "assetx" ให้ Chrome profile ใหม่ใน OpenCLI (ใต้กุญแจร่วม · ไม่แตะ research/ค่าเริ่มต้นของเครื่อง)
//     บัญชีแยก (เจ้าของสั่ง 9 พ.ย. 2569 · ข้อตกลงข้อ 9): research/social_watch.json → "account": "own" · แถวพัก/บันทึกการใช้อยู่ใน .local/research/social/account/ · เพดานของเราเอง · กุญแจยังใช้ของร่วม
//
// คอนฟิก: research/social_watch.json (รายชื่อเพจ · เพดาน · งบเวลา) · research/idea_sources.json (scoring = topic gate แคปชั่น · subtypes.social_fb) · research/brand_facts.json (service_area)
// สถานะ/คลัง (ไม่เข้า git): .local/research/social/state.json (visits) · facebook/<tid>.json (โพสต์ที่ผ่านตัวลบข้อมูลบุคคลแล้ว) · runs.jsonl
// ⚠️ ห้ามเรียก opencli ตรงจาก shell — browser นี้เป็นค่าเริ่มต้นของเครื่อง ทุกคำสั่งต้องผ่านตัวรันนี้ (ถือกุญแจ · สัญญาณชีพ · จด usage.jsonl)
import { config } from 'dotenv'
import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSupabaseStore, missingTable } from '../server/research/store.js'
import { withAreaWords } from '../server/research/collector.js'
import { sendTelegramReport, telegramConfigured } from '../server/research/notify.js'
import { Lock, blockedFor, usageRows, todayIso, defaultDir } from '../server/research/shared-browser.mjs'
import { runFacebookWatch, dueTargets, quotaLeft, targetId, loadJson, saveJson, pageStorePath, DEFAULTS, PROJECT, accountSettings, accountDir, chromeProfiles, resolveChromeProfileDir, hasOpenCliExtension, linkAccountAlias, createOc } from '../server/research/social-watch.js'
import os from 'node:os'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
config({ path: path.join(repo, '.env.local'), quiet: true })
config({ path: path.join(repo, '.env'), quiet: true })

const RESEARCH_DIR = path.join(repo, 'research')
const SOCIAL_DIR = path.join(repo, '.local', 'research', 'social')
const RUNS_FILE = path.join(SOCIAL_DIR, 'runs.jsonl')

const [command = 'help', ...rest] = process.argv.slice(2)
const flags = new Set(rest.filter((a) => a.startsWith('--')))
const flagValue = (name, fallback = null) => { const i = rest.indexOf(name); return i >= 0 && rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : fallback }
const out = (s = '') => process.stdout.write(`${s}\n`)
const log = (s) => out(s)

function readJson(file, fallback = null) {
  try { return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')) } catch { return fallback }
}

function loadConfig() {
  const cfg = readJson(path.join(RESEARCH_DIR, 'social_watch.json'))
  if (!cfg) throw new Error('อ่าน research/social_watch.json ไม่ได้')
  const ideaCfg = readJson(path.join(RESEARCH_DIR, 'idea_sources.json'), {})
  const brand = { ...(readJson(path.join(RESEARCH_DIR, 'brand_facts.json'), {})), ...(readJson(path.join(repo, '.local', 'research', 'brand_facts.local.json'), {})) }
  if (ideaCfg.owner_decisions?.facebook_watch?.allowed !== true) throw new Error('owner_decisions.facebook_watch.allowed ไม่ใช่ true ใน research/idea_sources.json — เจ้าของยังไม่อนุมัติ')
  return { cfg, ideaCfg, brand }
}

function appendRun(entry) {
  mkdirSync(SOCIAL_DIR, { recursive: true })
  appendFileSync(RUNS_FILE, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)
}

// ทำเครื่องหมายว่าโพสต์นี้เสนอเป็นไอเดียแล้ว (ไม่เสนอซ้ำรอบหน้า) · ที่ตกเพดานไม่ทำ → รอบหน้าที่เปิดเพจนั้นอีกยังมีสิทธิ์
function markIdea(file, key, day) {
  const store = loadJson(file, null)
  if (!store?.posts?.[key]) return
  store.posts[key].idea = day
  saveJson(file, store)
}

function headline(row) {
  const t = String(row.title || '')
  const i = t.indexOf(' — ')
  return (i >= 0 ? t.slice(i + 3) : t).slice(0, 60)
}

function buildTelegramText(result, queued, cfg) {
  const lines = [`📡 เฝ้าเพจ Facebook AssetX ${result.day}`]
  const summary = result.lines.filter((l) => l.startsWith('[social] Facebook:') || l.startsWith('⚠️'))
  lines.push(...summary.slice(0, 8))
  if (result.touched && !result.dry_run) {
    if (queued.room === 0) lines.push(`[social] คิวไอเดียโซเชียลค้างครบ ${cfg.max_social_in_queue ?? DEFAULTS.max_social_in_queue} ชิ้น — รอบนี้ไม่เติม`)
    else if (result.rows.length) lines.push(`[social] เข้าคิวไอเดีย ${queued.inserted} ชิ้น (เจอ ${result.rows.length}${queued.known ? ` · ลิงก์มีในคิวแล้ว ${queued.known}` : ''}${queued.duplicates ? ` · กุญแจซ้ำ ${queued.duplicates}` : ''})`)
  }
  for (const r of result.rows.slice().sort((a, b) => b.ratio - a.ratio).slice(0, 5)) lines.push(`  ▲ ${r.ratio.toFixed(1)} เท่า · ${r.name} · ${headline(r.row)}`)
  for (const w of result.warnings.slice(0, 5)) if (!lines.includes(w)) lines.push(w)
  if (result.status === 'ok' && result.rows.length) lines.push('เลือกไอเดียที่หน้า /marketing → แท็บ ไอเดีย')
  return lines.join('\n')
}

async function cmdRun() {
  const dryRun = flags.has('--dry-run')
  const { cfg, ideaCfg, brand } = loadConfig()
  const scoring = withAreaWords(ideaCfg.scoring, brand.service_area)
  const audience = ideaCfg.subtypes?.social_fb?.audience || null
  const started = Date.now()
  const limit = flagValue('--limit')
  const targetFilter = flagValue('--target')
  const acct = accountSettings(cfg)
  out(`[social] ${dryRun ? 'DRY RUN · ' : ''}เพจในรายชื่อ ${(cfg.facebook || []).filter((t) => t.enabled !== false).length} · ${acct.mode === 'own' ? `บัญชี AssetX เอง (${acct.label} · alias ${acct.bridge_profile}) โควตา ${acct.capOwn}/วัน ชุดละ ${acct.batch}` : `บัญชีร่วม DVX · โควตา AssetX ${acct.capOwn}/วัน · รวมบัญชี ${acct.capDay}`}${limit ? ` · --limit ${limit}` : ''}${targetFilter ? ` · --target "${targetFilter}"` : ''}`)

  const result = await runFacebookWatch({ cfg, targets: cfg.facebook || [], scoring, storeDir: SOCIAL_DIR, dryRun, limit, targetFilter, audience, deps: { log } })

  // ── หลังปล่อยกุญแจแล้วเท่านั้น: ส่งเข้าคิว (ไม่ถือกุญแจระหว่างคุยกับฐานข้อมูล)
  const queued = { inserted: 0, duplicates: 0, known: 0, room: null, skipped: 0 }
  if (result.rows.length && !dryRun) {
    try {
      const store = createSupabaseStore({ log })
      const existing = await store.existing()
      const socialNew = [...existing.queueCounts].filter(([k]) => k.startsWith('social|')).reduce((n, [, v]) => n + v, 0)
      const room = Math.max(Number(cfg.max_social_in_queue ?? DEFAULTS.max_social_in_queue) - socialNew, 0)
      queued.room = room
      if (room) {
        const sorted = result.rows.slice().sort((a, b) => b.ratio - a.ratio)
        const known = await store.knownUrls(sorted.map((r) => r.row.url).filter(Boolean))
        const fresh = sorted.filter((r) => !known.has(r.row.url))
        const chosen = fresh.slice(0, Math.min(Number(cfg.max_ideas_per_run ?? DEFAULTS.max_ideas_per_run), room))
        const saved = await store.insertIdeas(chosen.map((r) => r.row))
        queued.inserted = saved.inserted
        queued.duplicates = saved.duplicates
        queued.known = sorted.length - fresh.length
        queued.skipped = fresh.length - chosen.length
        for (const r of [...chosen, ...sorted.filter((x) => known.has(x.row.url))]) markIdea(r.file, r.key, result.day)
        out(`[social] ✅ เข้าคิวไอเดีย ${saved.inserted} ชิ้น (เจอ ${result.rows.length} · ลิงก์มีในคิวแล้ว ${queued.known} · กุญแจซ้ำ ${saved.duplicates} · ตกเพดานรอบนี้ ${queued.skipped})`)
      } else {
        out(`[social] คิวไอเดียโซเชียลค้างครบ ${cfg.max_social_in_queue ?? DEFAULTS.max_social_in_queue} ชิ้นแล้ว — รอบนี้ไม่เติม`)
      }
    } catch (error) {
      const reason = missingTable(error) ? 'ยังไม่ได้รัน supabase_marketing_ideas.sql ใน Supabase' : (error?.message || String(error))
      result.warnings.push(`⚠️ [social] ส่งเข้าคิวไอเดียไม่สำเร็จ: ${reason}`)
      out(result.warnings.at(-1))
    }
  }
  for (const r of result.rows.slice().sort((a, b) => b.ratio - a.ratio).slice(0, 6)) out(`[social]   ▲ ${r.ratio.toFixed(1)} เท่า · ${r.name} · ${headline(r.row)}`)
  if (dryRun && result.touched) out(`[social] DRY RUN — เจอแรงกว่าปกติ ${result.rows.length} ชิ้น ไม่ได้เขียนคลัง/สถานะ/คิวของเรา (usage.jsonl ของร่วมจดแล้ว)`)

  appendRun({
    status: result.status, account: result.account, day: result.day, dry_run: dryRun, ms: Date.now() - started, waited_ms: result.waited_ms,
    opened: result.opened.facebook, pages: result.pages.length, posts: result.pages.reduce((n, p) => n + p.posts, 0), new_posts: result.pages.reduce((n, p) => n + p.new, 0),
    low: result.pages.filter((p) => p.low).length, failed: result.pages.filter((p) => p.fail).length, hits: result.rows.length, inserted: queued.inserted,
    result: result.result, holder: result.holder?.project || null, stolen_from: result.stolen_from?.project || null, warnings: result.warnings.length,
  })

  // รายงานเทเลแกรม: รอบที่แตะ browser หรือมีเรื่องต้องบอก · รอบที่ข้ามเงียบ ๆ (วันนี้อ่านแล้ว / ไม่มีเพจถึงรอบ) ไม่ส่ง
  const notable = result.touched || ['browser_busy', 'blocked_shared', 'blocked_account', 'quota_full'].includes(result.status)
  if (!dryRun && !flags.has('--no-report') && notable) {
    const sent = await sendTelegramReport(buildTelegramText(result, queued, cfg))
    out(sent.ok ? '[report] ส่งเทเลแกรมแล้ว' : `[report] ไม่ได้ส่งเทเลแกรม: ${sent.reason}`)
  }
  out(`[social] จบใน ${Math.round((Date.now() - started) / 1000)} วิ · สถานะ ${result.status}`)
  if (['bridge_down', 'lost_lock', 'blocked'].includes(result.status)) process.exitCode = 1
}

function cmdStatus() {
  const { cfg } = loadConfig()
  const base = defaultDir()
  const today = todayIso()
  const holder = new Lock(PROJECT, { base }).holder()
  const acct = accountSettings(cfg)
  out(`บัญชีที่ใช้อ่าน: ${acct.mode === 'own' ? `บัญชี Facebook ของ AssetX เอง · ${acct.label} · alias ${acct.bridge_profile} · เพดาน ${acct.capOwn}/วัน ชุดละ ${acct.batch}` : 'บัญชีสำรองร่วมกับ DivisionX (Chrome profile Research)'}`)
  out(`โฟลเดอร์ร่วม: ${base}`)
  out(`กุญแจ browser: ${holder ? `${holder.project} ถืออยู่ (${holder.purpose || '-'} · เริ่ม ${String(holder.started_at || '').slice(11, 19)} · เงียบ ${holder.idle_sec} วิ${holder.idle_sec >= 600 ? ' · ค้าง ยึดได้' : ''})` : 'ว่าง'}`)
  const b = blockedFor('facebook', today, base)
  out(`แถวพักร่วม Facebook (บัญชีร่วม): ${b ? `⚠️ พักตั้งแต่ ${b.at} โดย ${b.by} — ${b.why}` : 'ไม่มี'}${acct.mode === 'own' ? ' · ไม่กระทบบัญชี AssetX' : ''}`)
  const acctBase = acct.mode === 'own' ? accountDir(SOCIAL_DIR) : base
  if (acct.mode === 'own') {
    const mine = blockedFor('facebook', today, acctBase)
    out(`แถวพักบัญชี AssetX: ${mine ? `⚠️ พักตั้งแต่ ${mine.at} — ${mine.why}` : 'ไม่มี'}`)
  }
  const q = quotaLeft({ rows: usageRows(acctBase), today, capDay: acct.capDay, capOwn: acct.capOwn })
  out(acct.mode === 'own'
    ? `เพจที่บัญชี AssetX เปิดวันนี้ (${today}): ${q.own}/${acct.capOwn} · เหลือ ${Math.max(q.left, 0)}${q.own > 0 ? ' · วันนี้อ่านแล้ว (รอบถัดไปข้าม)' : ''}`
    : `เพจที่เปิดวันนี้ (${today}): รวมทุกโปรเจกต์ ${q.total}/${acct.capDay} · AssetX ${q.own}/${acct.capOwn} · เหลือให้ AssetX ${Math.max(q.left, 0)}${q.own > 0 ? ' · วันนี้อ่านแล้ว (รอบถัดไปข้าม)' : ''}`)
  const state = loadJson(path.join(SOCIAL_DIR, 'state.json'), { visits: {} })
  if (state.last_round) out(`รอบล่าสุดของเรา: ${state.last_round.day} · ${state.last_round.status} · เปิด ${state.last_round.opened} เพจ`)
  const pages = (cfg.facebook || []).filter((t) => t.enabled !== false)
  const due = dueTargets(pages, state.visits || {}, today, 999)
  const perRun = acct.perRun
  out(`เพจถึงรอบ ${due.length}/${pages.length} (รอบหน้าอ่าน ${Math.min(perRun, due.length)}): ${due.slice(0, perRun).map((t) => t.name).join(' · ') || '-'}`)
  out('')
  out(`${'เพจ'.padEnd(44)} กลุ่ม        ทุก  เยี่ยมล่าสุด  โพสต์ในคลัง`)
  for (const t of pages) {
    const tid = targetId(t)
    const store = loadJson(pageStorePath(SOCIAL_DIR, tid), null)
    const n = store ? Object.keys(store.posts || {}).length : 0
    out(`${t.name.slice(0, 42).padEnd(44)} ${String(t.group).padEnd(12)} ${String(t.every_days ?? 7).padStart(3)}  ${(state.visits?.[tid] || '-').padEnd(12)}  ${n}`)
  }
  out('')
  out(`เทเลแกรม ${telegramConfigured() ? 'พร้อม' : 'ไม่ได้ตั้งค่า'} · รายงานรอบ: node scripts/research-social.mjs report`)
}

function cmdReport() {
  if (!existsSync(RUNS_FILE)) { out('ยังไม่มีบันทึกรอบ'); return }
  const lines = readFileSync(RUNS_FILE, 'utf8').trim().split('\n').slice(-10)
  for (const line of lines) {
    let e
    try { e = JSON.parse(line) } catch { continue }
    out(`${e.at.slice(0, 16)} ${e.status}${e.dry_run ? ' (dry-run)' : ''} · เปิด ${e.opened ?? 0} เพจ · โพสต์ ${e.posts ?? 0} (ใหม่ ${e.new_posts ?? 0}) · แรง ${e.hits ?? 0} · เข้าคิว ${e.inserted ?? 0}${e.result?.length ? ` · ${e.result.join(',')}` : ''}${e.holder ? ` · ถือโดย ${e.holder}` : ''}${e.waited_ms ? ` · รอ ${Math.round(e.waited_ms / 1000)} วิ` : ''}${e.warnings ? ` · ⚠️ ${e.warnings}` : ''}`)
  }
}

// ── บัญชี Facebook ของ AssetX เอง (ข้อตกลงข้อ 9 · เจ้าของสั่ง 9 พ.ย. 2569) ──
function opencliAliases() {
  const cfgFile = path.join(process.env.OPENCLI_CONFIG_DIR || path.join(os.homedir(), '.opencli'), 'browser-profiles.json')
  return readJson(cfgFile, { aliases: {} }) || { aliases: {} }
}

// อ่านอย่างเดียว: Local State ของ Chrome · โฟลเดอร์ส่วนเสริม · ~/.opencli/browser-profiles.json — ไม่เรียก OpenCLI ไม่แตะ browser
function cmdAccountCheck() {
  const { cfg } = loadConfig()
  const acct = accountSettings({ ...cfg, account: 'own' })
  const mode = accountSettings(cfg).mode
  out(`โหมดในคอนฟิก: ${mode === 'own' ? 'บัญชี AssetX เอง (own)' : 'บัญชีร่วมกับ DivisionX (shared)'} — research/social_watch.json → "account"`)
  const profiles = chromeProfiles()
  const dir = acct.chrome_profile_dir || resolveChromeProfileDir(acct.chrome_profile_name)
  out(`1. Chrome profile ชื่อ "${acct.chrome_profile_name}": ${dir ? `เจอแล้ว (${dir})` : '❌ ยังไม่เจอ — สร้าง profile ใหม่ชื่อนี้ใน Chrome'}`)
  const ext = dir ? hasOpenCliExtension(dir) : false
  out(`2. ส่วนเสริม OpenCLI ใน profile นี้: ${!dir ? '-' : ext ? 'ลงแล้ว' : '❌ ยังไม่ลง — ลงจาก Chrome Web Store ใน profile นี้'}`)
  const oc = opencliAliases()
  const mine = oc.aliases?.[acct.bridge_profile]
  out(`3. ชื่อเรียกใน OpenCLI "${acct.bridge_profile}": ${mine ? `ตั้งแล้ว (${mine})` : '❌ ยังไม่ตั้ง — เปิด profile ค้างไว้แล้วรัน node scripts/research-social.mjs account link'}`)
  const def = oc.defaultContextId ? (Object.entries(oc.aliases || {}).find(([, v]) => v === oc.defaultContextId)?.[0] || oc.defaultContextId) : '-'
  out(`ค่าเริ่มต้นของเครื่อง (OpenCLI): ${def}${def === 'research' ? ' (ถูกต้อง — เป็นของ DivisionX ห้ามเปลี่ยน)' : ' ⚠️ ควรเป็น research ของ DivisionX'}`)
  out('')
  out('Chrome profile ทั้งหมดในเครื่อง:')
  for (const p of profiles) out(`  ${p.dir.padEnd(12)} ${p.name}${hasOpenCliExtension(p.dir) ? ' · มีส่วนเสริม OpenCLI' : ''}`)
  out('')
  const ready = Boolean(dir && ext && mine)
  out(ready
    ? (mode === 'own' ? '✅ ตั้งครบ และคอนฟิกใช้บัญชี AssetX แล้ว' : '✅ ตั้งครบแล้ว — ขั้นต่อไป: ลองอ่าน 1 เพจด้วยบัญชีใหม่ แล้วเปลี่ยน "account" เป็น "own" ใน research/social_watch.json')
    : 'ยังตั้งไม่ครบ — ขั้นตอนอยู่ใน docs/social-research.md หัวข้อ "บัญชี Facebook ของ AssetX เอง"')
}

// ตั้งชื่อเรียกใน OpenCLI ใต้กุญแจร่วม (OpenCLI ตัวเดียวทั้งเครื่อง) · เลือกเฉพาะ profile ที่ต่ออยู่และยังไม่มีชื่อ ตัวเดียว · ไม่สั่ง profile use
async function cmdAccountLink() {
  const { cfg } = loadConfig()
  const acct = accountSettings({ ...cfg, account: 'own' })
  const lock = new Lock(PROJECT, { purpose: 'account link', base: defaultDir() })
  out('[account] รอกุญแจ browser ร่วม (ไม่เกิน 3 นาที)…')
  if (!(await lock.acquire({ waitMs: 180e3 }))) {
    const h = lock.holder() || {}
    out(`⚠️ [account] browser ไม่ว่าง (${h.project || '?'} ${h.purpose || ''}) — ลองใหม่ภายหลัง`)
    process.exitCode = 1
    return
  }
  try {
    const r = await linkAccountAlias({ oc: createOc({ lock }), alias: acct.bridge_profile })
    const msg = {
      ready: `✅ ชื่อเรียก "${acct.bridge_profile}" ต่ออยู่แล้ว (${r.contextId})`,
      linked: `✅ ตั้งชื่อเรียก "${acct.bridge_profile}" ให้ profile ใหม่แล้ว (${r.contextId})`,
      none: '❌ OpenCLI ไม่เห็น Chrome profile ใหม่ที่ต่ออยู่ — เปิด Chrome profile ของบัญชี AssetX ค้างไว้ และเช็กว่าส่วนเสริม OpenCLI เปิดอยู่ แล้วรันใหม่',
      alias_offline: `❌ ชื่อเรียก "${acct.bridge_profile}" มีแล้วแต่ไม่ได้ต่ออยู่ — เปิด Chrome profile ของบัญชี AssetX ค้างไว้แล้วรันใหม่`,
      ambiguous: '❌ มี profile ที่ต่ออยู่และยังไม่มีชื่อเรียกมากกว่า 1 ตัว — ปิด profile อื่นที่ลงส่วนเสริม OpenCLI ไว้ ให้เหลือ profile ของบัญชี AssetX แล้วรันใหม่ (ระบบไม่เดา)',
      rename_failed: '❌ ตั้งชื่อเรียกไม่สำเร็จ — ดูรายการด้านล่าง',
    }[r.status]
    out(`[account] ${msg}`)
    for (const p of r.profiles || []) out(`  ${p.contextId} · ${p.alias || '(ไม่มีชื่อ)'} · ${p.connected ? 'ต่ออยู่' : 'ไม่ต่อ'}${p.default ? ' · ค่าเริ่มต้น' : ''}`)
    if (!['ready', 'linked'].includes(r.status)) process.exitCode = 1
  } finally {
    lock.release()
  }
}

async function cmdAccount() {
  const sub = rest.find((a) => !a.startsWith('--')) || 'check'
  if (sub === 'check') return cmdAccountCheck()
  if (sub === 'link') return cmdAccountLink()
  out(`ไม่รู้จัก account ${sub} (ใช้ check หรือ link)`)
  process.exitCode = 2
}

function help() {
  out(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).slice(1).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'))
}

const commands = { run: cmdRun, status: cmdStatus, report: cmdReport, account: cmdAccount, help }
const fn = commands[command]
if (!fn) { out(`ไม่รู้จักคำสั่ง "${command}"`); help(); process.exit(2) }
Promise.resolve(fn()).catch((error) => {
  console.error(`[${command}] ${error?.message || error}`)
  try { if (command === 'run') appendRun({ status: 'crashed', error: String(error?.message || error).slice(0, 300) }) } catch {}
  process.exit(1)
})

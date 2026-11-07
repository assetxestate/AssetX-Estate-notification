#!/usr/bin/env node
// scripts/research-ads.mjs — เลนแอดคู่แข่งจาก Meta Ad Library (ขั้นที่ 10) · อ่านหน้าเว็บสาธารณะโดยไม่ล็อกอินด้วย Chrome headless โปรไฟล์ชั่วคราว
// ไม่แตะ Chrome profile Research / บัญชีสำรองที่ใช้ร่วมกับ DivisionX · ไม่ถือกุญแจ browser ร่วม · ไม่กินโควตา 4 เพจ/วัน · เครื่องยนต์: server/research/ads-library.js
//
// node scripts/research-ads.mjs run [--dry-run] [--force] [--phrase คำ] [--no-ai] [--no-report]
//     รอบสัปดาห์ (Task Scheduler วันจันทร์ 09:30 หรือสั่งเอง): ถ้ายังไม่ครบ cadence_days นับจากรอบก่อน = ข้าม (--force ฝืน) → อ่านทีละวลี เว้น 4–8 วิ →
//     ล้างข้อมูลบุคคล → ลงคลัง .local/research/ads/ads.json → คัดแอดที่รันนาน ≥ min_days_running และให้ความรู้ (ตัวคัดเบื้องต้น + AI ยืนยัน ≤ max_ai_classify ชิ้น) →
//     เข้าคิว marketing_ideas (source social · subtype ad_library · คิวค้าง ≤ max_in_queue) → รายงานเทเลแกรม
//     --dry-run  อ่านจริงแต่ไม่เขียนคลัง/สถานะ/คิว (พิมพ์สิ่งที่จะเข้าคิว) · --phrase คำ อ่านเฉพาะวลีที่มีคำนี้ · --no-ai ใช้ตัวคัดเบื้องต้นอย่างเดียว
// node scripts/research-ads.mjs status     รอบล่าสุด · คลัง · ผู้สมัครที่ยังไม่ได้เสนอ — ไม่เปิด browser
// node scripts/research-ads.mjs report     รอบล่าสุดจาก runs.jsonl
//
// คอนฟิก: research/ads_library.json (วลี · เกณฑ์ · browser) · research/idea_sources.json (owner_decisions.ad_library ต้อง allowed:true · scoring = topic gate · subtypes.ad_library)
// สถานะ/คลัง (ไม่เข้า git): .local/research/ads/ads.json · state.json · runs.jsonl · lock.json
import { config } from 'dotenv'
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, unlinkSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSupabaseStore, missingTable } from '../server/research/store.js'
import { withAreaWords } from '../server/research/collector.js'
import { createAsk } from '../server/research/llm.js'
import { sendTelegramReport, telegramConfigured } from '../server/research/notify.js'
import { scrub } from '../server/research/pii.js'
import {
  DEFAULTS, SUBTYPE, SOURCE, readAdLibraryPhrase, mergeAds, pruneAds, cleanStore, pickCandidates, buildClassifyPrompt, parseClassify, adIdeaRow, planQueue, dueForRun, daysBetween,
} from '../server/research/ads-library.js'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
config({ path: path.join(repo, '.env.local'), quiet: true })
config({ path: path.join(repo, '.env'), quiet: true })

const RESEARCH_DIR = path.join(repo, 'research')
const ADS_DIR = path.join(repo, '.local', 'research', 'ads')
const STORE_FILE = path.join(ADS_DIR, 'ads.json')
const STATE_FILE = path.join(ADS_DIR, 'state.json')
const RUNS_FILE = path.join(ADS_DIR, 'runs.jsonl')
const LOCK_FILE = path.join(ADS_DIR, 'lock.json')
const LOCK_STALE_MS = 30 * 60e3

const [command = 'help', ...rest] = process.argv.slice(2)
const flags = new Set(rest.filter((a) => a.startsWith('--')))
const flagValue = (name, fallback = null) => { const i = rest.indexOf(name); return i >= 0 && rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : fallback }
const out = (s = '') => process.stdout.write(`${s}\n`)
const log = (s) => out(s)
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10) // วันไทย (UTC+7)

function readJson(file, fallback = null) {
  try { return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')) } catch { return fallback }
}
function writeJson(file, obj) { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`) }

function loadConfig() {
  const cfg = { ...DEFAULTS, ...(readJson(path.join(RESEARCH_DIR, 'ads_library.json')) || {}) }
  const ideaCfg = readJson(path.join(RESEARCH_DIR, 'idea_sources.json'), {})
  const brand = { ...(readJson(path.join(RESEARCH_DIR, 'brand_facts.json'), {})), ...(readJson(path.join(repo, '.local', 'research', 'brand_facts.local.json'), {})) }
  if (ideaCfg.owner_decisions?.ad_library?.allowed !== true) throw new Error('owner_decisions.ad_library.allowed ไม่ใช่ true ใน research/idea_sources.json — เจ้าของยังไม่อนุมัติเลนนี้')
  if (!ideaCfg.subtypes?.[SUBTYPE]) throw new Error(`subtypes.${SUBTYPE} ยังไม่มีใน research/idea_sources.json`)
  return { cfg, ideaCfg, brand }
}

function appendRun(entry) {
  mkdirSync(ADS_DIR, { recursive: true })
  appendFileSync(RUNS_FILE, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)
}

function acquireLock() {
  mkdirSync(ADS_DIR, { recursive: true })
  if (existsSync(LOCK_FILE)) {
    const age = Date.now() - statSync(LOCK_FILE).mtimeMs
    if (age < LOCK_STALE_MS) return false
    out(`[ads] ล็อกค้างนาน ${Math.round(age / 60000)} นาที — ถือว่าตาย ล้างทิ้ง`)
  }
  writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }))
  return true
}
function releaseLock() { try { unlinkSync(LOCK_FILE) } catch { /* ไม่มีไฟล์ */ } }

async function launchChrome(opts) {
  const { chromium } = await import('playwright-core')
  return chromium.launch(opts)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rand = ([lo, hi]) => lo + Math.random() * Math.max(0, hi - lo)

async function cmdRun() {
  const dryRun = flags.has('--dry-run')
  const { cfg, ideaCfg, brand } = loadConfig()
  const scoring = withAreaWords(ideaCfg.scoring, brand.service_area)
  const audience = ideaCfg.subtypes?.[SUBTYPE]?.audience || null
  const day = today()
  const state = readJson(STATE_FILE, { last_run_day: null })
  if (!flags.has('--force') && !dryRun && !dueForRun(state, day, cfg.cadence_days)) {
    out(`[ads] รอบก่อน ${state.last_run_day} ยังไม่ครบ ${cfg.cadence_days} วัน — ข้าม (--force เพื่อฝืน)`)
    appendRun({ status: 'skipped', reason: 'not_due', day })
    return
  }
  const started = Date.now()
  const phraseFilter = flagValue('--phrase')
  const phrases = (cfg.phrases || []).filter((p) => p && typeof p.q === 'string' && p.enabled !== false && (!phraseFilter || p.q.includes(phraseFilter)))
  const store = readJson(STORE_FILE, { ads: {} })
  // ล้างคลังด้วยกติกาปัจจุบันทุกรอบ (ลิงก์ · บล็อกพรีวิว · ฟุตเตอร์ · เบอร์ +66) — mergeAds เก็บข้อความที่ "ยาวกว่า" จึงไม่ล้างของเก่าเอง
  const cleaned = cleanStore(store)
  if (cleaned) out(`[ads] ล้างคลังเก่า ${cleaned} เรคอร์ด (ลิงก์/บล็อกพรีวิว/ข้อมูลบุคคลตามกติกาใหม่)`)
  const report = { phrases: [], warnings: [], added: 0, candidates: 0, inserted: 0, duplicates: 0, known: 0, room: null, aiChecked: 0 }
  out(`[ads] ${dryRun ? 'DRY RUN · ' : ''}วลี ${phrases.length} · คลัง ${Object.keys(store.ads || {}).length} แอด · ประเทศ ${cfg.country} · ${cfg.search_type}`)
  // ล็อกทันทีก่อน try — โค้ดระหว่างล็อกกับ finally ที่โยน error เคยทำให้ล็อกค้าง 30 นาที
  if (!acquireLock()) { out('[ads] มีรอบอื่นกำลังรัน — ข้าม'); appendRun({ status: 'skipped', reason: 'locked', day }); return }
  try {
    for (let i = 0; i < phrases.length; i += 1) {
      const { q } = phrases[i]
      if (i) await sleep(rand(cfg.between_phrases_ms || DEFAULTS.between_phrases_ms))
      let res
      try {
        res = await readAdLibraryPhrase({ q, cfg, launch: launchChrome, sleep, log })
      } catch (e) {
        // error นอก try ของเครื่องยนต์ (launch Chrome ไม่ได้ ฯลฯ) — วลีเดียวพัง ไม่ล้มทั้งรอบ (docs/social-research.md ข้อ 4) · stack ของ Playwright ยาว ส่งแค่บรรทัดแรก
        const msg = String(e?.message || e).split('\n')[0].slice(0, 160)
        report.phrases.push({ q, status: null, ads: 0, results: '', loginWall: false, error: msg })
        report.warnings.push(`⚠️ [ads] "${q}": อ่านไม่สำเร็จ ${msg}`)
        out(report.warnings.at(-1))
        continue
      }
      const entry = { q, status: res.status, ads: res.ads.length, results: res.results, loginWall: res.loginWall, error: res.error || null }
      report.phrases.push(entry)
      if (res.loginWall) { report.warnings.push(`⚠️ [ads] "${q}": เจอหน้าล็อกอิน — หยุดเลนรอบนี้ (ห้ามหาทางเลี่ยง) · IP เดียวกับ browser ร่วมของ DivisionX ถ้าเจอซ้ำให้แจ้งอีกฝั่ง`); out(report.warnings.at(-1)); break }
      if (!res.ads.length) { report.warnings.push(`⚠️ [ads] "${q}": อ่านการ์ดแอดไม่ได้เลย (HTTP ${res.status ?? '-'}${res.error ? ` · ${res.error}` : ''}) — หน้าอาจเปลี่ยนโครง`); out(report.warnings.at(-1)); continue }
      const added = mergeAds(store, res.ads, q, day)
      report.added += added
      // เก็บทันทีทุกวลี — โดนฆ่า/วลีถัดไปล้ม ก็ไม่เสียแอดที่อ่านแล้ว (ตัวเฝ้าเพจบันทึกต่อเพจแบบเดียวกัน)
      if (!dryRun) writeJson(STORE_FILE, store)
      out(`[ads] "${q}": ${res.results || '?'} · อ่านได้ ${res.ads.length} แอด (ใหม่ ${added}) · HTTP ${res.status ?? '-'}`)
    }
  } finally {
    releaseLock()
  }
  pruneAds(store, day, cfg.keep_days)

  // คัดผู้สมัคร: รันนาน + ให้ความรู้ (ตัวคัดเบื้องต้น) → AI ยืนยัน (ไม่บังคับ)
  let picks = pickCandidates(store, { today: day, cfg, scoring })
  report.candidates = picks.length
  out(`[ads] ผู้สมัคร (รันนาน ≥ ${cfg.min_days_running} วัน · ให้ความรู้ · ผ่าน topic gate · ยังไม่เคยเสนอ): ${picks.length}`)
  const aiVerdicts = new Map()
  if (picks.length && !flags.has('--no-ai')) {
    const ask = createAsk({ log })
    if (ask.providers.length) {
      // ทีละ 4 ชิ้น — โมเดล 14b ตอบ JSON ไม่ครบเมื่อส่ง 12 ชิ้นในคำสั่งเดียว (ลองจริง 7 พ.ย. 2569) · ชุดที่อ่านคำตอบไม่ออก = ไม่ตัดสิน (ผ่านด้วยตัวคัดเบื้องต้น)
      const batchAll = picks.slice(0, Number(cfg.max_ai_classify ?? DEFAULTS.max_ai_classify))
      let failed = 0
      for (let i = 0; i < batchAll.length; i += 4) {
        const batch = batchAll.slice(i, i + 4)
        const batchAds = batch.map((p) => ({ libraryId: p.libraryId, text: p.rec.text }))
        const { system, prompt } = buildClassifyPrompt(batchAds, brand)
        const res = await ask({ system, prompt })
        // ส่งชุดที่ส่งไปให้ parseClassify แมป id (โมเดลตอบเลขลำดับ [n] หรือตัวเลขเพี้ยนเกิน 2^53) · คำตัดสินที่แมปไม่ติด = ไม่นับว่าคัดแล้ว
        const parsed = res.ok ? parseClassify(res.data, batchAds) : null
        if (!parsed || !parsed.size) { failed += batch.length; out(`[ads] AI คัดชุด ${i / 4 + 1} ไม่ได้ (${res.error || 'คำตอบอ่านไม่ออก/ id ไม่ตรง'})`); continue }
        for (const [id, v] of parsed) aiVerdicts.set(id, v)
        report.aiChecked += parsed.size
        failed += batch.length - parsed.size
      }
      out(`[ads] AI คัด ${report.aiChecked} ชิ้น: ให้ความรู้ ${[...aiVerdicts.values()].filter((v) => v.useful).length} · ตัด ${[...aiVerdicts.values()].filter((v) => !v.useful).length}${failed ? ` · อ่านคำตอบไม่ออก ${failed} (ผ่านด้วยตัวคัดเบื้องต้น)` : ''}`)
      if (failed && !report.aiChecked) report.warnings.push('⚠️ [ads] AI คัดไม่ได้เลยรอบนี้ — ใช้ตัวคัดเบื้องต้นอย่างเดียว ตรวจไอเดียก่อนใช้')
    } else out('[ads] ไม่มีผู้ให้บริการ AI — ใช้ตัวคัดเบื้องต้นอย่างเดียว')
  }
  // AI บอกว่าไม่ให้ความรู้ = ตัด · ไม่ได้ส่งให้ AI = ผ่านด้วยตัวคัดเบื้องต้น · เรียงให้ชิ้นที่ AI ยืนยันขึ้นก่อน
  picks = picks.filter((p) => { const v = aiVerdicts.get(p.libraryId); return !v || v.useful })
  picks.sort((a, b) => Number(Boolean(aiVerdicts.get(b.libraryId)?.useful)) - Number(Boolean(aiVerdicts.get(a.libraryId)?.useful)))
  const rows = picks.slice(0, Number(cfg.max_ideas_per_run ?? DEFAULTS.max_ideas_per_run)).map((p) => ({ ...p, row: adIdeaRow({ ...p, ai: aiVerdicts.get(p.libraryId) || null }, day, { audience }) }))
  for (const r of rows) out(`[ads]   ▲ ${r.days} วัน · ${r.rec.versions} เวอร์ชัน · ${r.row.score} · ${scrub(r.row.title.split(' — ')[1] || '').slice(0, 70)}`)

  if (dryRun) {
    out(`[ads] DRY RUN — จะเข้าคิว ${rows.length} ชิ้น ไม่ได้เขียนคลัง/สถานะ/คิว`)
  } else {
    if (rows.length) {
      try {
        const db = createSupabaseStore({ log })
        const existing = await db.existing()
        const inQueue = existing.queueCounts.get(`${SOURCE}|${SUBTYPE}`) || 0
        const knownUrls = inQueue < Number(cfg.max_in_queue ?? DEFAULTS.max_in_queue) ? await db.knownUrls(rows.map((r) => r.row.url)) : new Set()
        const plan = planQueue({ rows, inQueue, maxInQueue: cfg.max_in_queue ?? DEFAULTS.max_in_queue, knownUrls })
        report.room = plan.room
        if (plan.room) {
          const saved = await db.insertIdeas(plan.chosen.map((r) => r.row))
          report.inserted = saved.inserted
          report.duplicates = saved.duplicates
          report.known = plan.known.length
          for (const id of plan.markIds) if (store.ads[id]) store.ads[id].idea = day
          out(`[ads] ✅ เข้าคิวไอเดีย ${saved.inserted} ชิ้น (ผู้สมัคร ${rows.length} · มีในคิวแล้ว ${report.known} · กุญแจซ้ำ ${saved.duplicates})`)
        } else out(`[ads] คิวแอดคู่แข่งค้างครบ ${cfg.max_in_queue} ชิ้นแล้ว — รอบนี้ไม่เติม`)
      } catch (error) {
        const reason = missingTable(error) ? 'ยังไม่ได้รัน supabase_marketing_ideas.sql' : (error?.message || String(error))
        report.warnings.push(`⚠️ [ads] ส่งเข้าคิวไม่สำเร็จ: ${reason}`)
        out(report.warnings.at(-1))
      }
    }
    writeJson(STORE_FILE, store)
    // last_run_day เฉพาะรอบเต็ม — รัน --phrase ทดสอบวลีเดียวเคยทำให้รอบสัปดาห์ถัดไปถูกข้ามว่า not_due
    writeJson(STATE_FILE, { ...state, ...(phraseFilter ? {} : { last_run_day: day }), last_status: report.warnings.length ? 'warn' : 'ok' })
  }
  appendRun({ status: 'ok', day, dry_run: dryRun, ms: Date.now() - started, phrases: report.phrases.map((p) => ({ q: p.q, ads: p.ads, status: p.status })), added: report.added, store: Object.keys(store.ads).length, candidates: report.candidates, ai_checked: report.aiChecked, inserted: report.inserted, warnings: report.warnings.length })

  if (!dryRun && !flags.has('--no-report')) {
    const lines = [`📢 แอดคู่แข่ง (Ad Library) ${day}`, `อ่าน ${report.phrases.length} วลี · แอดใหม่ ${report.added} · คลัง ${Object.keys(store.ads).length} · ผู้สมัคร ${report.candidates} · เข้าคิว ${report.inserted}`]
    for (const r of rows.slice(0, 5)) lines.push(`  ▲ ${r.days} วัน · ${scrub(r.row.title.split(' — ')[1] || '').slice(0, 60)}`)
    lines.push(...report.warnings.slice(0, 4))
    if (report.inserted) lines.push('เลือกไอเดียที่หน้า /marketing → แท็บ ไอเดีย (ป้าย แอดคู่แข่ง)')
    const sent = await sendTelegramReport(lines.join('\n'))
    out(sent.ok ? '[report] ส่งเทเลแกรมแล้ว' : `[report] ไม่ได้ส่งเทเลแกรม: ${sent.reason}`)
  }
  out(`[ads] จบใน ${Math.round((Date.now() - started) / 1000)} วิ`)
}

function cmdStatus() {
  const { cfg, ideaCfg, brand } = loadConfig()
  const scoring = withAreaWords(ideaCfg.scoring, brand.service_area)
  const state = readJson(STATE_FILE, { last_run_day: null })
  const store = readJson(STORE_FILE, { ads: {} })
  const day = today()
  const ads = Object.values(store.ads || {})
  out(`รอบล่าสุด: ${state.last_run_day || '-'} (${state.last_status || '-'}) · ครบรอบถัดไป: ${dueForRun(state, day, cfg.cadence_days) ? 'ถึงรอบแล้ว' : `อีก ${cfg.cadence_days - daysBetween(state.last_run_day, day)} วัน`}`)
  out(`คลัง: ${ads.length} แอด · เสนอเป็นไอเดียแล้ว ${ads.filter((a) => a.idea).length} · รันนาน ≥ ${cfg.min_days_running} วัน ${ads.filter((a) => a.started && daysBetween(a.started, day) >= cfg.min_days_running).length}`)
  const picks = pickCandidates(store, { today: day, cfg, scoring })
  out(`ผู้สมัครรอบหน้า (ยังไม่ได้ส่ง AI คัด): ${picks.length}`)
  for (const p of picks.slice(0, 8)) out(`  ${p.days} วัน · ${p.rec.versions} เวอร์ชัน · ${scrub(p.rec.text).replace(/\s+/g, ' ').slice(0, 70)}`)
  out(`วลี: ${(cfg.phrases || []).map((p) => p.q).join(' · ')} · เทเลแกรม ${telegramConfigured() ? 'พร้อม' : 'ไม่ได้ตั้งค่า'}`)
}

function cmdReport() {
  if (!existsSync(RUNS_FILE)) { out('ยังไม่มีบันทึกรอบ'); return }
  for (const line of readFileSync(RUNS_FILE, 'utf8').trim().split('\n').slice(-10)) {
    let e
    try { e = JSON.parse(line) } catch { continue }
    out(`${e.at.slice(0, 16)} ${e.status}${e.dry_run ? ' (dry-run)' : ''}${e.reason ? ` · ${e.reason}` : ''} · วลี ${e.phrases?.length ?? 0} · แอดใหม่ ${e.added ?? 0} · คลัง ${e.store ?? '-'} · ผู้สมัคร ${e.candidates ?? 0} · เข้าคิว ${e.inserted ?? 0}${e.warnings ? ` · ⚠️ ${e.warnings}` : ''}`)
  }
}

function help() {
  out(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).slice(1).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'))
}

const commands = { run: cmdRun, status: cmdStatus, report: cmdReport, help }
const fn = commands[command]
if (!fn) { out(`ไม่รู้จักคำสั่ง "${command}"`); help(); process.exit(2) }
Promise.resolve(fn()).catch((error) => {
  console.error(`[${command}] ${error?.message || error}`)
  try { if (command === 'run') appendRun({ status: 'crashed', error: String(error?.message || error).slice(0, 300) }) } catch {}
  process.exit(1)
})

#!/usr/bin/env node
// scripts/research-ideas.mjs — ตัวรันระบบรีเสิร์ชโซเชียล/เทรนด์ของ AssetX (โปรไฟล์อสังหาฯ ขายฝาก/จำนอง)
//
// node scripts/research-ideas.mjs run [--force] [--dry-run] [--no-ai] [--no-report]
//     รอบประจำวัน: หมดอายุ → เก็บไอเดีย → ถอดข้อเท็จจริงจากลิงก์ → มุมเล่า AI → ร่างโพสต์ AI (เฉพาะไอเดียที่มีข้อเท็จจริง) → รายงานเทเลแกรม · เช็ก "วันนี้รันแล้วหรือยัง" (ไม่ใช่ตรงเวลาไหม)
//     รันซ้ำวันเดียวกัน = ข้าม (บันทึกลง runs.jsonl ด้วย) · ล็อกกันรันซ้อน · เก็บล้ม = รอบล้ม (Task Scheduler ตั้งซ้ำ 07:00/07:30/08:00 ได้)
// node scripts/research-ideas.mjs collect [--dry-run]       เก็บอย่างเดียว (--dry-run เขียน .local/research/dry-run.json ไม่แตะ DB)
// node scripts/research-ideas.mjs enrich [--limit N] [--retry]  ดึงหน้าต้นทางของไอเดียที่ยังไม่มีข้อเท็จจริง (📌) แล้วให้ AI สรุป ≤ 7 ข้อ · --retry ลองซ้ำที่เคยดึงไม่ได้ · ใน run ใช้ --enrich-limit / --no-enrich
// node scripts/research-ideas.mjs angles [--limit N]        เขียนมุมเล่าให้ไอเดียที่ยังไม่มี (Hermes → Ollama ในเครื่อง → Gemini)
// node scripts/research-ideas.mjs drafts [--limit N] [--include-no-facts] [--id 32,33]  ร่างโพสต์เต็มให้ทุกมุมเล่าของไอเดียที่ "มีข้อเท็จจริง" (📌) · ค่าเริ่มต้น 8 ไอเดีย/รอบ ~1.5–2 นาที/มุมบน Ollama 14b · ใน run ใช้ --drafts-limit · --id = ไอเดียที่ระบุเอง ไม่สนสถานะ (ร่างใหม่ให้ไอเดียที่เจ้าของเลือกไปแล้วได้ หลังลบร่างเดิมด้วย .local/reset-drafts.mjs)
//     ไอเดียที่ไม่มีข้อเท็จจริง (คลิปยังไม่ถอดคำบรรยาย · ดึงเนื้อข่าวไม่ได้) ไม่ร่างให้ — ผู้ตรวจอิสระ 6 พ.ย. 2569 พบว่า AI เดาเอกสาร/ขั้นตอนผิดบริบทไทย · --include-no-facts เปิดได้ถ้าเจ้าของยอมรับ
// node scripts/research-ideas.mjs expire                    ตั้ง status=expired ให้ไอเดียเก่า (ไม่ลบแถว)
// node scripts/research-ideas.mjs probe                     ทดสอบทุกแหล่งแบบเบามือ (ยิง 1 ครั้ง/แหล่ง · สถานะ · จำนวน · วันล่าสุด · บล็อกไหม)
// node scripts/research-ideas.mjs stats                     จำนวนในคิวตามสถานะ/แหล่ง และ % ที่มีมุมเล่า
// node scripts/research-ideas.mjs report                    รอบล่าสุดจาก runs.jsonl
//
// คอนฟิก: research/idea_sources.json · research/brand_facts.json (+ .local/research/brand_facts.local.json ทับ) · research/calendar.json
// สถานะ/ล็อก/บันทึกรอบ: .local/research/ (ไม่เข้า git) · คีย์จาก .env.local (SUPABASE_SERVICE_ROLE_KEY · HERMES_AGENT_URL / OLLAMA_MODEL / GEMINI_API_KEY · ASSETX_TELEGRAM_*)
import { config } from 'dotenv'
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, unlinkSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createFetcher } from '../server/research/fetcher.js'
import { collectIdeas, formatCollectReport, cadenceDue } from '../server/research/collector.js'
import { createSupabaseStore, createDryRunStore, missingTable } from '../server/research/store.js'
import { createAsk, NO_PROVIDER_MESSAGE } from '../server/research/llm.js'
import { generateAngles } from '../server/research/angles.js'
import { generateDrafts, hasResearchFacts, isInternalSourceLabel } from '../server/research/drafts.js'
import { enrichIdeas } from '../server/research/enrich.js'
import { calendarWatchItems, inMpcWindow } from '../server/research/calendar.js'
import { sendTelegramReport, telegramConfigured } from '../server/research/notify.js'
import { parseRss, parseYoutubeFeed, parseGnewsSitemap, parseBotMpc, parseDolNews, parsePantipTagNextData, parseCkanPackage, googleNewsRssUrl, youtubeFeedUrl } from '../server/research/parsers.js'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
config({ path: path.join(repo, '.env.local'), quiet: true })
config({ path: path.join(repo, '.env'), quiet: true })

const RESEARCH_DIR = path.join(repo, 'research')
const LOCAL_DIR = path.join(repo, '.local', 'research')
const STATE_FILE = path.join(LOCAL_DIR, 'state.json')
const RUNS_FILE = path.join(LOCAL_DIR, 'runs.jsonl')
const LOCK_FILE = path.join(LOCAL_DIR, 'run.lock')
const DRY_FILE = path.join(LOCAL_DIR, 'dry-run.json')
const LOCK_STALE_MS = 2 * 60 * 60 * 1000

const [command = 'help', ...rest] = process.argv.slice(2)
const flags = new Set(rest.filter((a) => a.startsWith('--')))
const flagValue = (name, fallback) => { const i = rest.indexOf(name); return i >= 0 && rest[i + 1] ? rest[i + 1] : fallback }
const out = (s = '') => process.stdout.write(`${s}\n`)
const log = (s) => out(s)
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })   // YYYY-MM-DD เวลาไทย

function readJson(file, fallback = null) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return fallback }
}
function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}

function loadConfig() {
  const cfg = readJson(path.join(RESEARCH_DIR, 'idea_sources.json'))
  if (!cfg) throw new Error('อ่าน research/idea_sources.json ไม่ได้')
  const brand = { ...(readJson(path.join(RESEARCH_DIR, 'brand_facts.json'), {})), ...(readJson(path.join(LOCAL_DIR, 'brand_facts.local.json'), {})) }
  const calendar = readJson(path.join(RESEARCH_DIR, 'calendar.json'), { events: [] })
  return { cfg, brand, calendar }
}

function loadState() {
  return readJson(STATE_FILE, { last_success_date: null, attempts: {}, lane_last_run: {} })
}
function saveState(state) { writeJson(STATE_FILE, state) }

function appendRun(entry) {
  mkdirSync(LOCAL_DIR, { recursive: true })
  appendFileSync(RUNS_FILE, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)
}

function acquireLock() {
  mkdirSync(LOCAL_DIR, { recursive: true })
  if (existsSync(LOCK_FILE)) {
    const age = Date.now() - statSync(LOCK_FILE).mtimeMs
    if (age < LOCK_STALE_MS) return false
    out(`[run] ล็อกค้างนาน ${Math.round(age / 60000)} นาที — ถือว่าตาย ล้างทิ้ง`)
  }
  writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }))
  return true
}
function releaseLock() { try { unlinkSync(LOCK_FILE) } catch { /* ไม่มีไฟล์ */ } }

function makeStore(dryRun) {
  if (dryRun) return createDryRunStore({ file: DRY_FILE, log })
  return createSupabaseStore({ log })
}

function makeFetcher(cfg) {
  return createFetcher({ userAgent: cfg.user_agent, hostDelaySec: cfg.host_delay_sec, timeoutMs: Number(cfg.timeout_ms || 30000), log })
}

async function doExpire({ cfg, store }) {
  const subtypes = Object.fromEntries(Object.entries(cfg.subtypes || {}).filter(([k]) => !k.startsWith('_')))
  const result = await store.expireOld({ subtypes, purgeDays: cfg.queue?.purge_after_days ?? 14 })
  out(`[purge] ตรวจ ${result.checked} แถว · ตั้ง expired ${result.expired}`)
  return result
}

async function doCollect({ cfg, brand, calendar, store, state }) {
  const fetcher = makeFetcher(cfg)
  const now = new Date()
  const existing = await store.existing({ eventWindowDays: cfg.queue?.event_window_days ?? 7, now })
  const leads = await store.leadsRecent(9, now)
  // dry-run: ไม่ดูและไม่แสตมป์รอบเวลาเลน (ไม่งั้นรอบจริงถัดไปข้ามเลนที่ dry-run เพิ่งยิง — เจอจริง 3 พ.ย. 2569: รอบจริงแรกได้ 13/34 เลน)
  const dry = store.kind === 'dry-run'
  const laneState = dry ? { ...state, lane_last_run: {} } : state
  const { rows, report } = await collectIdeas({ cfg, brand, calendar, fetcher, now, existing, leads, state: laneState, log })
  const saved = await store.insertIdeas(rows)
  if (!dry) {
    for (const key of report.ranLanes) state.lane_last_run[key] = now.toISOString()
    saveState(state)
  }
  const text = formatCollectReport({ rows, report }, { topTitles: cfg.report?.top_titles ?? 5, inserted: saved.inserted })
  out(text)
  out(`[ideas] fetch ${fetcher.stats.requests} ครั้ง · บล็อก ${fetcher.stats.blocked} · error ${fetcher.stats.errors} · กุญแจเดิมในฐาน ${existing.total}${store.kind === 'dry-run' ? ` · dry-run → ${store.file}` : ''}`)
  return { rows, report, saved, text }
}

async function doAngles({ brand, store, limit }) {
  const ask = createAsk({ log })
  if (!ask.providers.length) {
    out(`[angles] ${NO_PROVIDER_MESSAGE} — ข้าม`)
    return { done: [], failed: [], skipped: true }
  }
  const ideas = await store.ideasNeedingAngles(limit)
  if (!ideas.length) { out('[angles] ไม่มีไอเดียที่รอมุมเล่า'); return { done: [], failed: [] } }
  out(`[angles] ${ideas.length} ไอเดียรอมุมเล่า · ผู้ให้บริการ: ${ask.providers.join(' → ')}`)
  const result = await generateAngles({ ideas, brand, ask, onSave: (id, angles) => store.saveAngles(id, angles), delayMs: 2000, log })
  out(`[angles] ได้มุม ${result.done.length} · ไม่ได้ ${result.failed.length}`)
  return result
}

const draftCount = (result) => (result?.done || []).reduce((n, d) => n + d.drafts, 0)

// ถอดข้อเท็จจริงจากหน้าต้นทาง (ขั้น 2b) — ดึงด้วยตัวดึงมารยาทเดิม แล้วให้ AI สรุป ≤ 7 ข้อ เก็บเป็น summary "📌 …"
async function doEnrich({ cfg, brand, store, limit, retry = false }) {
  const ask = createAsk({ log })
  if (!ask.providers.length) {
    out(`[enrich] ${NO_PROVIDER_MESSAGE} — ข้าม`)
    return { done: [], failed: [], skipped: true }
  }
  const ideas = await store.ideasNeedingFacts(limit, { retry })
  if (!ideas.length) { out('[enrich] ไม่มีไอเดียที่รอถอดข้อเท็จจริง'); return { done: [], failed: [], fetched: 0 } }
  out(`[enrich] ${ideas.length} ไอเดียรอถอดข้อเท็จจริงจากลิงก์ · ผู้ให้บริการ: ${ask.providers.join(' → ')}`)
  const fetcher = makeFetcher(cfg)
  const result = await enrichIdeas({ ideas, fetcher, ask, brand, onSave: (id, summary) => store.saveSummary(id, summary), log, maxFetch: limit })
  out(`[enrich] ได้ข้อเท็จจริง ${result.done.length} · ไม่ได้ ${result.failed.length} · fetch ${fetcher.stats.requests} ครั้ง · บล็อก ${fetcher.stats.blocked}`)
  return result
}

// ร่างโพสต์เต็มให้ทุกมุมเล่าที่ยังไม่มีร่าง — เก็บใน angles[i].draft (คอลัมน์เดิม) · ทีละมุม บันทึกทีละมุม
// บน Ollama 14b เครื่องนี้ ~1–2 นาที/มุม → จำกัดไอเดียต่อรอบ ที่เหลือรอรอบถัดไป (หรือสั่ง drafts --limit N เอง)
// เฉพาะไอเดียที่มีข้อเท็จจริง (📌/manual) — ไม่มีข้อเท็จจริง = AI เดา (ผู้ตรวจอิสระ 6 พ.ย. 2569) · --include-no-facts เปิดได้เอง
// ids = ไอเดียที่ระบุเอง (--id 32,33) ไม่สนสถานะ new/picked — ไอเดียที่เจ้าของเลือกไปแล้ว (picked) ไม่อยู่ในคิวร่างปกติ แต่ร่างใหม่หลังแก้ความรู้/ด่านได้
async function doDrafts({ brand, store, limit, includeNoFacts = false, ids = null }) {
  const ask = createAsk({ log })
  if (!ask.providers.length) {
    out(`[drafts] ${NO_PROVIDER_MESSAGE} — ข้าม`)
    return { done: [], failed: [], skipped: true }
  }
  const candidates = ids?.length ? await store.ideasByIds(ids) : await store.ideasNeedingDrafts(includeNoFacts ? limit : Math.max(limit * 4, 40))
  if (ids?.length) {
    const missing = ids.filter((id) => !candidates.some((c) => c.id === id))
    if (missing.length) out(`[drafts] ไม่พบไอเดีย #${missing.join(' #')} หรือยังไม่มีมุมเล่า`)
    if (!candidates.length) return { done: [], failed: [], skippedNoFacts: 0 }
    limit = candidates.length
  }
  // เหตุการณ์ปฏิทินที่ยังไม่ถึงวัน (รายงานยังไม่ออก) ร่างแล้วกลวง — ผู้ตรวจรอบสอง 6 พ.ย. 2569 → รอให้ถึงวันก่อน
  const futureCalendar = (idea) => isInternalSourceLabel(idea.source_label) && idea.event_date && String(idea.event_date) > today()
  const withFacts = candidates.filter(hasResearchFacts)
  const ideas = (includeNoFacts ? candidates : withFacts.filter((idea) => !futureCalendar(idea))).slice(0, limit)
  const noFacts = candidates.length - withFacts.length
  const future = withFacts.filter(futureCalendar).length
  if (!includeNoFacts && noFacts) out(`[drafts] ข้าม ${noFacts} ไอเดียที่ยังไม่มีข้อเท็จจริง (ไม่ร่างจากหัวข้ออย่างเดียว · --include-no-facts เพื่อฝืน)`)
  if (!includeNoFacts && future) out(`[drafts] ข้าม ${future} ไอเดียปฏิทินที่ยังไม่ถึงวันเหตุการณ์ (ร่างได้เมื่อถึงวัน)`)
  if (!ideas.length) { out('[drafts] ไม่มีไอเดียที่มีข้อเท็จจริงและยังขาดร่าง'); return { done: [], failed: [], skippedNoFacts: noFacts } }
  const pendingAngles = ideas.reduce((n, idea) => n + idea.angles.filter((a) => a && !a.draft?.caption).length, 0)
  out(`[drafts] ${ideas.length} ไอเดีย · ${pendingAngles} มุมรอร่าง · ผู้ให้บริการ: ${ask.providers.join(' → ')}`)
  const result = await generateDrafts({ ideas, brand, ask, onSave: (id, angles) => store.saveAngles(id, angles), delayMs: 1500, log })
  out(`[drafts] ร่างแล้ว ${draftCount(result)} มุม (${result.done.length} ไอเดีย) · ไม่ได้ ${result.failed.length}`)
  return { ...result, skippedNoFacts: noFacts }
}

function buildTelegramText({ collect, enrich, angles, drafts, expire, calendar, warnings }) {
  const lines = [`📡 รีเสิร์ช AssetX ${today()}`]
  if (expire) lines.push(`[purge] expired ${expire.expired}`)
  if (collect) lines.push(collect.text)
  if (enrich && !enrich.skipped) lines.push(`[enrich] ถอดข้อเท็จจริงได้ ${enrich.done.length} · ไม่ได้ ${enrich.failed.length}`)
  if (angles && !angles.skipped) lines.push(`[angles] ได้มุม ${angles.done.length} · ไม่ได้ ${angles.failed.length}`)
  if (angles?.skipped) lines.push('[angles] ⚠️ ไม่มีผู้ให้บริการ AI — ไอเดียยังไม่มีมุมเล่า')
  if (drafts && !drafts.skipped) lines.push(`[drafts] ร่างโพสต์แล้ว ${draftCount(drafts)} มุม (${drafts.done.length} ไอเดีย) · ไม่ได้ ${drafts.failed.length}${drafts.skippedNoFacts ? ` · ข้าม ${drafts.skippedNoFacts} ไอเดียที่ไม่มีข้อเท็จจริง` : ''}`)
  const watch = calendarWatchItems(calendar)
  if (watch.length) lines.push(`👀 เช็กลิสต์คนดูเอง: ${watch.join(' · ')}`)
  for (const w of warnings || []) lines.push(w)
  lines.push('เลือกไอเดียที่หน้า /marketing → แท็บ ไอเดีย')
  return lines.join('\n')
}

async function cmdRun() {
  const dryRun = flags.has('--dry-run')
  const { cfg, brand, calendar } = loadConfig()
  const state = loadState()
  const day = today()
  if (!flags.has('--force') && state.last_success_date === day) {
    out(`[run] วันนี้ (${day}) รันสำเร็จแล้ว — ข้าม (ใช้ --force ถ้าต้องการรันซ้ำ)`)
    appendRun({ status: 'skipped', reason: 'already_ran_today', day })
    return
  }
  if (!acquireLock()) {
    out('[run] มีรอบอื่นกำลังรันอยู่ — ออก')
    appendRun({ status: 'skipped', reason: 'locked', day })
    return
  }
  const started = Date.now()
  const warnings = []
  let store
  try {
    store = makeStore(dryRun)
    let expire = null
    try { expire = await doExpire({ cfg, store }) } catch (error) { warnings.push(`⚠️ purge ล้ม: ${error.message}`); out(warnings.at(-1)) }

    let collect
    try {
      collect = await doCollect({ cfg, brand, calendar, store, state })
    } catch (error) {
      state.attempts[day] = (state.attempts[day] || 0) + 1
      saveState(state)
      const reason = missingTable(error) ? 'ยังไม่ได้รัน supabase_marketing_ideas.sql ใน Supabase' : error.message
      out(`[ideas] ⛔ เก็บไอเดียล้ม (ครั้งที่ ${state.attempts[day]} ของวันนี้): ${reason}`)
      appendRun({ status: 'failed', day, step: 'collect', error: reason, attempt: state.attempts[day], ms: Date.now() - started })
      if (!flags.has('--no-report')) await sendTelegramReport(`📡 รีเสิร์ช AssetX ${day}\n⛔ เก็บไอเดียล้ม (ครั้งที่ ${state.attempts[day]}): ${reason}`)
      process.exitCode = 1
      return
    }

    let enrich = null
    let angles = null
    let drafts = null
    if (!flags.has('--no-ai')) {
      // ถอดข้อเท็จจริงก่อนคิดมุม/ร่าง — มุมเล่าและร่างจะได้ยึดเนื้อจริง ไม่ใช่หัวข้อข่าว
      if (!flags.has('--no-enrich')) {
        try { enrich = await doEnrich({ cfg, brand, store, limit: Number(flagValue('--enrich-limit', 15)) }) } catch (error) { warnings.push(`⚠️ ถอดข้อเท็จจริงล้ม: ${error.message}`); out(warnings.at(-1)) }
      }
      try { angles = await doAngles({ brand, store, limit: Number(flagValue('--limit', 25)) }) } catch (error) { warnings.push(`⚠️ มุมเล่าล้ม: ${error.message}`); out(warnings.at(-1)) }
      // 14b บนเครื่องนี้ ~1.5–2 นาที/มุม → 8 ไอเดีย (≤ 24 มุม) ≈ 40–50 นาทีต่อรอบ ที่เหลือรอรอบถัดไป
      try { drafts = await doDrafts({ brand, store, limit: Number(flagValue('--drafts-limit', 8)), includeNoFacts: flags.has('--include-no-facts') }) } catch (error) { warnings.push(`⚠️ ร่างโพสต์ล้ม: ${error.message}`); out(warnings.at(-1)) }
    }

    warnings.push(...collect.report.warnings.filter((w) => !collect.text.includes(w)))
    const text = buildTelegramText({ collect, enrich, angles, drafts, expire, calendar, warnings })
    let sent = { skipped: true }
    if (!flags.has('--no-report') && !dryRun) {
      sent = await sendTelegramReport(text)
      out(sent.ok ? '[report] ส่งเทเลแกรมแล้ว' : `[report] ไม่ได้ส่งเทเลแกรม: ${sent.reason}`)
    }
    state.last_success_date = day
    saveState(state)
    appendRun({
      status: 'ok', day, dry_run: dryRun, ms: Date.now() - started,
      lanes_ran: collect.report.lanes.filter((l) => l.status !== 'skipped').length,
      lanes_failed: collect.report.lanes.filter((l) => ['error', 'blocked'].includes(l.status)).length,
      candidates: collect.report.candidates, inserted: collect.saved.inserted,
      enrich_done: enrich?.done?.length ?? null, enrich_failed: enrich?.failed?.length ?? null,
      angles_done: angles?.done?.length ?? null, angles_failed: angles?.failed?.length ?? null,
      drafts_done: drafts ? draftCount(drafts) : null, drafts_failed: drafts?.failed?.length ?? null, drafts_skipped_no_facts: drafts?.skippedNoFacts ?? null,
      expired: expire?.expired ?? null, telegram: sent.ok ? 'sent' : sent.skipped ? 'skipped' : 'failed', warnings: warnings.length,
    })
    out(`[run] เสร็จใน ${Math.round((Date.now() - started) / 1000)} วิ`)
  } finally {
    releaseLock()
  }
}

async function cmdCollect() {
  const { cfg, brand, calendar } = loadConfig()
  const state = loadState()
  const store = makeStore(flags.has('--dry-run'))
  const result = await doCollect({ cfg, brand, calendar, store, state })
  appendRun({ status: 'ok', day: today(), step: 'collect', dry_run: store.kind === 'dry-run', candidates: result.report.candidates, inserted: result.saved.inserted })
}

async function cmdAngles() {
  const { brand } = loadConfig()
  const store = makeStore(flags.has('--dry-run'))
  await doAngles({ brand, store, limit: Number(flagValue('--limit', 25)) })
}

async function cmdDrafts() {
  const { brand } = loadConfig()
  const store = makeStore(flags.has('--dry-run'))
  const ids = String(flagValue('--id', '')).split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0)
  await doDrafts({ brand, store, limit: Number(flagValue('--limit', 8)), includeNoFacts: flags.has('--include-no-facts'), ids })
}

async function cmdEnrich() {
  const { cfg, brand } = loadConfig()
  const store = makeStore(flags.has('--dry-run'))
  await doEnrich({ cfg, brand, store, limit: Number(flagValue('--limit', 15)), retry: flags.has('--retry') })
}

async function cmdExpire() {
  const { cfg } = loadConfig()
  const store = makeStore(flags.has('--dry-run'))
  await doExpire({ cfg, store })
}

async function cmdStats() {
  const store = makeStore(flags.has('--dry-run'))
  const stats = await store.stats()
  out(`ทั้งหมด ${stats.total} · ${Object.entries(stats.byStatus).map(([k, v]) => `${k} ${v}`).join(' · ') || 'ว่าง'}`)
  if (stats.anglesCoverage !== null) out(`คิว new ที่มีมุมเล่าแล้ว ${stats.anglesCoverage}%`)
  if (stats.draftsCoverage !== null && stats.draftsCoverage !== undefined) out(`ไอเดียที่มีมุมเล่า ซึ่งทุกมุมมีร่างโพสต์แล้ว ${stats.draftsCoverage}%`)
  for (const [k, v] of Object.entries(stats.queue).sort((a, b) => b[1] - a[1])) out(`  ${k}: ${v}`)
}

function cmdReport() {
  if (!existsSync(RUNS_FILE)) { out('ยังไม่มีบันทึกรอบ'); return }
  const lines = readFileSync(RUNS_FILE, 'utf8').trim().split('\n').slice(-8)
  for (const line of lines) {
    const e = JSON.parse(line)
    out(`${e.at.slice(0, 16)} ${e.status}${e.step ? ` (${e.step})` : ''}${e.reason ? ` ${e.reason}` : ''}${e.error ? ` ${e.error}` : ''}${e.inserted !== undefined ? ` · เข้าคิว ${e.inserted}` : ''}${e.enrich_done != null ? ` · ข้อเท็จจริง ${e.enrich_done}` : ''}${e.angles_done != null ? ` · มุม ${e.angles_done}` : ''}${e.drafts_done != null ? ` · ร่าง ${e.drafts_done}` : ''}${e.telegram ? ` · tg ${e.telegram}` : ''}`)
  }
  const state = loadState()
  out(`สำเร็จล่าสุด ${state.last_success_date || '-'} · เทเลแกรม ${telegramConfigured() ? 'พร้อม' : 'ไม่ได้ตั้งค่า'}`)
}

// ทดสอบทุกแหล่งแบบเบามือ — ยิง 1 ครั้งต่อแหล่ง ไม่เขียนอะไร
async function cmdProbe() {
  const { cfg, calendar } = loadConfig()
  const fetcher = makeFetcher(cfg)
  const now = new Date()
  const rows = []
  const probe = async (label, url, parse) => {
    const res = await fetcher(url)
    let items = []
    let note = ''
    if (res.ok) {
      try { items = parse(res.text) || [] } catch (error) { note = `parser: ${error.message}` }
    } else note = res.blocked ? `⛔ บล็อก ${res.status}` : `✗ ${res.error}`
    const dates = items.map((i) => i.published || i.lastModified).filter(Boolean).sort()
    rows.push({ label, status: res.ok ? 'ok' : res.blocked ? 'blocked' : 'error', items: items.length, latest: dates.at(-1)?.slice(0, 10) || '-', note })
    out(`${res.ok ? '✓' : '✗'} ${label.padEnd(36)} ${String(res.status).padEnd(4)} ${String(items.length).padStart(3)} รายการ · ล่าสุด ${dates.at(-1)?.slice(0, 10) || '-'} ${note}`)
  }
  out(`probe ${now.toISOString().slice(0, 16)} · UA ${cfg.user_agent} · หน้าต่าง กนง.: ${inMpcWindow(calendar, now) ? 'เปิด' : 'ปิด'}`)
  if (cfg.owner_decisions?.google_news_rss?.allowed === true) {
    for (const q of cfg.news_queries?.items || []) await probe(`gnews "${q.q}"`, googleNewsRssUrl(q.q, q.when_days), parseRss)
  } else out('(ข้าม Google News — ยังไม่ได้รับอนุมัติ)')
  const parsers = { rss: parseRss, gnews_sitemap: parseGnewsSitemap, html_bot_mpc: parseBotMpc, html_dol: parseDolNews, pantip_tag: parsePantipTagNextData, ckan: (t) => { const r = parseCkanPackage(t); return r ? [r] : [] } }
  for (const feed of cfg.feeds?.items || []) {
    if (feed.enabled === false) continue
    await probe(`${feed.kind} ${feed.label || feed.key}`, feed.url, parsers[feed.kind] || (() => []))
  }
  if (cfg.owner_decisions?.youtube_rss?.allowed === true) {
    for (const ch of cfg.youtube?.channels || []) if (ch.enabled !== false) await probe(`yt ${ch.label}`, youtubeFeedUrl(ch.channel_id), parseYoutubeFeed)
  }
  const bad = rows.filter((r) => r.status !== 'ok')
  out(`\nสรุป: ${rows.length - bad.length}/${rows.length} แหล่งตอบปกติ${bad.length ? ` · มีปัญหา: ${bad.map((b) => b.label).join(', ')}` : ''}`)
  out(`fetch ${fetcher.stats.requests} ครั้ง · บล็อก ${fetcher.stats.blocked} · error ${fetcher.stats.errors}`)
  if (flags.has('--json')) writeJson(path.join(LOCAL_DIR, `probe-${today()}.json`), rows)
}

function help() {
  out(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).slice(1).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'))
}

const commands = { run: cmdRun, collect: cmdCollect, enrich: cmdEnrich, angles: cmdAngles, drafts: cmdDrafts, expire: cmdExpire, stats: cmdStats, report: cmdReport, probe: cmdProbe, help }
const fn = commands[command]
if (!fn) { out(`ไม่รู้จักคำสั่ง "${command}"`); help(); process.exit(2) }
Promise.resolve(fn()).catch((error) => {
  console.error(`[${command}] ${missingTable(error) ? 'ยังไม่ได้รัน supabase_marketing_ideas.sql ใน Supabase' : (error?.message || error)}`)
  releaseLock()
  process.exit(1)
})

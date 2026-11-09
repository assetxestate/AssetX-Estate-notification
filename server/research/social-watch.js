// ตัวเฝ้าเพจ Facebook ของ AssetX (ขั้นที่ 7 ของสกิล social-research) — อ่านเพจที่ติดตามด้วยบัญชีสำรองที่ใช้ร่วมกับ DivisionX Card
// ข้อตกลง 2 ระบบ: ~/.claude/skills/social-research/profiles/shared-browser-dvx-assetx.md — ไฟล์นี้ทำตามข้อ 4.1–4.7 ครบ:
//   ถือกุญแจ lock.json ก่อนแตะ browser ทุกครั้ง (รวม dry-run) · แตะสัญญาณชีพก่อนทุกคำสั่ง OpenCLI · เจอ login/checkpoint = พักร่วม 3 วัน ·
//   จด usage.jsonl ทีละเพจ "ก่อนเปิด" + แถวสรุปตอนจบ · เพดานรวม 12 / AssetX 4 เพจต่อวัน (ตรวจซ้ำหลังได้กุญแจ) ·
//   ถือกุญแจไม่เกิน ~7 นาที (ไม่เปิดเพจใหม่หลัง 5 นาที · ไม่เปิดซ้ำหลัง 6 นาที) · session "assetxwatch" เท่านั้น · ปิด session ใน finally
// อ่านอย่างเดียว: ไม่มีคำสั่ง [write] ของ OpenCLI ในไฟล์นี้ · เก็บแค่แคปชั่น (ผ่านตัวลบข้อมูลบุคคล) + ตัวเลข + รหัสสื่อ · ไม่เก็บชื่อ/ข้อความคนคอมเมนต์
// ฟังก์ชันคิดตัวเลขทั้งหมดเป็น pure function (เทสต์ได้) · ส่วนที่แตะ browser รับ oc/sleep/now ฉีดเข้ามา (เทสต์ด้วยของปลอม)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Lock, blockedFor, pagesOn, usageRows, todayIso, nowIso, readState, defaultDir } from './shared-browser.mjs'
import { scrub, plainQuotes } from './pii.js'
import { scoreText, DEFAULT_SCORING, round1 } from './classify.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export const PROJECT = 'assetx'
export const PLATFORM = 'facebook'
export const SESSION = 'assetxwatch'
export const SUBTYPE = 'social_fb'
export const OPENCLI_MAIN = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', '@jackwener', 'opencli', 'dist', 'src', 'main.js')
export const CHROME_PATHS = [
  path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
]
// Chrome ต้องเปิดด้วยค่านี้ ไม่งั้นหน้าต่างโหมด background ที่ถูกบัง/จอล็อก = visibilityState hidden → Chrome หยุดวาด FB ไม่โหลดโพสต์ต่อ
// (ต้นเหตุ "เพจละ 1 โพสต์" ที่ DVX หาเจอ 3 พ.ย. 2569 · commit 2e6fcdd ฝั่ง DVX · ยกมาใส่ 6 พ.ย.) · ค่าติดตอน process แรกเท่านั้น —
// ไอคอน Chrome ของเจ้าของใส่ค่านี้ไว้แล้ว (DVX ทำ นอกรีโป) · ตัวเฝ้าเพจใส่เองเมื่อเป็นฝ่ายเปิด Chrome
export const CHROME_FLAGS = ['--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion']

// FB_JS ก๊อปตรงจาก DVX เป็นไฟล์แยก (ห้ามใส่ใน template literal — \/ \d \s จะเพี้ยนและตัวจับหน้า login ตายเงียบ) · ตัดคอมเมนต์หัวไฟล์ออกให้เหลือ IIFE ล้วน
export const FB_JS = fs.readFileSync(path.join(HERE, 'facebook-page.dom.js'), 'utf8').replace(/^(?:\/\/[^\n]*\n|\s*\n)+/, '')

export const DEFAULTS = {
  chrome_profile_dir: 'Profile 9',
  bridge_profile: 'research',
  session: SESSION,
  fb_scroll_steps: 10,
  fb_max_posts: 12,
  fb_low_posts: 3,
  keep_days: 120,
  baseline_days: 60,
  outlier_ratio: 2.0,
  min_engagement: 10,
  min_views: 3000,
  max_ideas_per_target: 2,
  max_ideas_per_run: 8,
  max_social_in_queue: 20,
  max_targets_per_run: { facebook: 4 },
  shared_browser: { daily_cap: { facebook: 12 }, own_daily_cap: { facebook: 4 }, wait_minutes: 20, no_new_page_sec: 300, no_reread_sec: 360 },
  // shared = บัญชีสำรองร่วมกับ DVX (Chrome profile Research) · own = บัญชี Facebook ของ AssetX เอง (เจ้าของสั่ง 9 พ.ย. 2569 — ข้อตกลงข้อ 9)
  account: 'shared',
  own_account: { chrome_profile_name: 'AssetX Research', chrome_profile_dir: '', bridge_profile: 'assetx', daily_cap: { facebook: 8 }, max_targets_per_run: { facebook: 8 }, batch_pages: 4, batch_gap_sec: 45, rounds_per_day: 1, ramp: null, since: '' },
}

// ── บัญชีที่ใช้อ่าน (ข้อตกลงข้อ 9 "แยกบัญชี") ─────────────────────────────────
// shared: ทุกอย่างตามข้อ 4 (แถวพักร่วม · เพดานรวม 12 / AssetX 4 · จด usage.jsonl ของร่วม)
// own: บัญชี/Chrome profile ของ AssetX เอง → แถวพักและบันทึกการใช้อยู่ในเครื่องเรา (.local/research/social/account/) ไม่แตะของร่วมเลย
//   (บัญชีร่วมของ DVX โดนพักก็ไม่เกี่ยวกับเรา · เราโดนพักก็ไม่ทำให้ DVX หยุด · เพดานรวม 12 ไม่นับเรา) · เพดานของบัญชีเราเอง (ค่าเริ่ม 8 เพจ/วัน)
//   · กุญแจ lock.json ยังใช้ของร่วม (OpenCLI ตัวเดียวทั้งเครื่อง ยังไม่ได้ทดสอบสอง profile พร้อมกัน — ข้อ 9) และอ่านเป็นชุดละ batch_pages เพจ
//     ถือกุญแจต่อชุดไม่เกินงบเดิม (~7 นาที) ปล่อยกุญแจพักระหว่างชุด → DVX ที่กดรอบเองระหว่างนั้นไม่ต้องรอนานเกิน 8 นาที
export function accountSettings(cfg = {}) {
  if (cfg.account !== 'own') {
    const sb = { ...DEFAULTS.shared_browser, ...(cfg.shared_browser || {}) }
    return {
      mode: 'shared', label: 'Chrome profile Research',
      bridge_profile: cfg.bridge_profile || DEFAULTS.bridge_profile, chrome_profile_dir: cfg.chrome_profile_dir || DEFAULTS.chrome_profile_dir,
      capDay: Number(sb.daily_cap?.facebook ?? 12), capOwn: Number(sb.own_daily_cap?.facebook ?? 4),
      perRun: Number(cfg.max_targets_per_run?.facebook ?? DEFAULTS.max_targets_per_run.facebook), batch: Infinity, gapMs: 0,
    }
  }
  const o = { ...DEFAULTS.own_account, ...(cfg.own_account || {}) }
  const cap = Number(o.daily_cap?.facebook ?? 8)
  return {
    mode: 'own', label: `Chrome profile ${o.chrome_profile_name || 'AssetX'}`, chrome_profile_name: o.chrome_profile_name || '',
    bridge_profile: o.bridge_profile || 'assetx', chrome_profile_dir: o.chrome_profile_dir || '',
    capDay: cap, capOwn: cap, perRun: Math.min(Number(o.max_targets_per_run?.facebook ?? cap), cap),
    batch: Math.max(1, Number(o.batch_pages ?? 4)), gapMs: Number(o.batch_gap_sec ?? 45) * 1000,
    roundsPerDay: Math.max(1, Number(o.rounds_per_day ?? 1)), ramp: o.ramp && typeof o.ramp === 'object' ? o.ramp : null, since: o.since || '',
  }
}

// โฟลเดอร์ Chrome profile จากชื่อที่เห็นในหน้าเลือกโปรไฟล์ ("AssetX Research" → "Profile 10") — อ่าน Local State ของ Chrome อย่างเดียว ไม่แตะ browser
export function chromeUserDataDir() {
  return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Google', 'Chrome', 'User Data')
}
export function chromeProfiles({ userDataDir = chromeUserDataDir(), readFile = (f) => fs.readFileSync(f, 'utf8') } = {}) {
  try {
    const cache = JSON.parse(readFile(path.join(userDataDir, 'Local State')))?.profile?.info_cache || {}
    return Object.entries(cache).map(([dir, v]) => ({ dir, name: String(v?.name || '') }))
  } catch { return [] }
}
export function resolveChromeProfileDir(name, opts = {}) {
  const want = String(name || '').trim().toLowerCase()
  if (!want) return ''
  return chromeProfiles(opts).find((p) => p.name.trim().toLowerCase() === want)?.dir || ''
}

export const accountDir = (storeDir) => path.join(storeDir, 'account')

// เพดานขั้นบันไดของบัญชี AssetX (เจ้าของ 9 พ.ย. 2569: "เพิ่มโควตาได้มั้ย มันน้อยไปสำหรับหาข้อมูล")
// เริ่มที่ daily_cap แล้วเพิ่ม ramp.step ทุก ramp.every_days วันที่ไม่โดนพัก จนถึง ramp.max · โดนพักเมื่อไร (last_blocked ในสมุดของเรา) นับใหม่จากวันนั้น
// เหตุผล: บัญชีที่เพิ่งเริ่มให้ระบบอ่านแล้วถูกเร่งเยอะทันทีมักโดน Facebook ขอยืนยันตัวตน — ค่อย ๆ ขยับปลอดภัยกว่า
export function rampCap(acct = {}, { today = todayIso(), lastBlocked = '' } = {}) {
  const base = Number(acct.capOwn ?? 8)
  const r = acct.ramp
  if (!r) return base
  const from = [acct.since, lastBlocked].filter(Boolean).sort().at(-1)
  const clean = from ? Math.max(0, dayDiff(from, today)) : 0
  return Math.min(Number(r.max ?? base), base + Number(r.step ?? 0) * Math.floor(clean / Math.max(1, Number(r.every_days ?? 7))))
}
// เพดานวันนี้ของบัญชี AssetX จากคอนฟิก + สมุดของเรา (ใช้ทั้งตัวรอบและคำสั่ง status)
export function ownDailyCap({ cfg = {}, storeDir, today = todayIso() } = {}) {
  const acct = accountSettings({ ...cfg, account: 'own' })
  return rampCap(acct, { today, lastBlocked: storeDir ? readState(accountDir(storeDir)).last_blocked || '' : '' })
}

// รหัสส่วนเสริม OpenCLI ใน Chrome Web Store (README ของ OpenCLI) — ใช้ดูว่า profile ไหนลงส่วนเสริมแล้ว (อ่านโฟลเดอร์อย่างเดียว)
export const OPENCLI_EXTENSION_ID = 'ildkmabpimmkaediidaifkhjpohdnifk'
export function hasOpenCliExtension(dir, { userDataDir = chromeUserDataDir(), exists = fs.existsSync } = {}) {
  return Boolean(dir) && exists(path.join(userDataDir, dir, 'Extensions', OPENCLI_EXTENSION_ID))
}

// ตั้งชื่อเรียก (alias) ให้ Chrome profile ใหม่ของบัญชี AssetX ใน OpenCLI — เรียกใต้กุญแจร่วมเท่านั้น (ตัวรัน account link)
// เลือกเฉพาะ profile ที่ต่ออยู่และยังไม่มีชื่อเรียก · ต้องมีตัวเดียว ไม่งั้นไม่เดา · ห้ามแตะ alias ของคนอื่น (research) และห้ามสั่ง `profile use` (ค่าเริ่มต้นของเครื่องเป็นของ DVX)
export async function linkAccountAlias({ oc, alias = 'assetx' }) {
  const list = async () => (unwrap(await oc(['profile', 'list'], { timeoutMs: 60e3 })) || {}).profiles || []
  const profiles = await list()
  const mine = profiles.find((p) => p && p.alias === alias)
  if (mine && mine.connected) return { status: 'ready', contextId: mine.contextId, profiles }
  const fresh = profiles.filter((p) => p && p.connected && !p.alias && p.contextId)
  if (!fresh.length) return { status: mine ? 'alias_offline' : 'none', profiles }
  if (fresh.length > 1) return { status: 'ambiguous', profiles }
  await oc(['profile', 'rename', fresh[0].contextId, alias], { timeoutMs: 30e3 })
  const after = await list()
  const ok = after.some((p) => p && p.alias === alias && p.connected && p.contextId === fresh[0].contextId)
  return { status: ok ? 'linked' : 'rename_failed', contextId: fresh[0].contextId, profiles: after }
}

// สมุดบันทึกของบัญชีเราเอง — รูปไฟล์เดียวกับของร่วม (state.json · usage.jsonl) เพื่อใช้ blockedFor/usageRows/pagesOn ตัวเดิมได้ · ไม่ต้องถือกุญแจ (ไม่มีใครอื่นเขียน)
export class AccountBook {
  constructor(dir, project = PROJECT) { this.dir = dir; this.project = project; this.started = nowIso() }
  setBlocked(platform, why, day = todayIso()) {
    const st = readState(this.dir)
    st.blocked[platform] = { at: day, why: String(why).slice(0, 300), by: this.project, time: nowIso() }
    st.last_blocked = day // ไม่ลบตอนล้างแถวพัก — เพดานขั้นบันไดนับใหม่จากวันนี้
    st.updated_at = nowIso()
    saveJson(path.join(this.dir, 'state.json'), st)
  }
  clearBlocked(platform) {
    const st = readState(this.dir)
    if (!(platform in st.blocked)) return false
    delete st.blocked[platform]
    st.updated_at = nowIso()
    saveJson(path.join(this.dir, 'state.json'), st)
    return true
  }
  // round = 'scheduled' (รอบตามเวลา) | 'manual' (ลองอ่าน --limit / เจ้าของสั่ง --target) — ใส่เฉพาะแถวสรุป ใช้ตัดสิน "วันนี้อ่านรอบแล้วหรือยัง"
  logUsage(pages, result = 'ok', { day = todayIso(), opened = null, round = null, run = null } = {}) {
    const ints = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v).map(([k, v]) => [k, Math.trunc(v)]))
    const row = { project: this.project, date: day, start: this.started, end: nowIso(), pages: ints(pages), result }
    if (round) row.round = round
    if (run) row.run = run
    if (opened && Object.keys(ints(opened)).length) row.opened = ints(opened)
    fs.mkdirSync(this.dir, { recursive: true })
    fs.appendFileSync(path.join(this.dir, 'usage.jsonl'), `${JSON.stringify(row)}\n`, 'utf8')
  }
}

export class WatchError extends Error {
  constructor(message) { super(message); this.name = 'WatchError' }
}
// แพลตฟอร์มขอล็อกอิน/ยืนยันตัวตน — หยุดเลนทันที อย่ารัวต่อ (บัญชีเดียวกับ DVX)
export class Blocked extends WatchError {
  constructor(message) { super(message); this.name = 'Blocked' }
}
// หน้าต่าง browser ถูกซ่อน (จอล็อก/ถูกหน้าต่างอื่นบัง) — Chrome หยุดวาดหน้า FB จึงไม่โหลดโพสต์ถัดไป · หยุดเลนรอบนี้ (เปิดเพจต่อก็ได้เพจละ 1 โพสต์ เปลืองโควตาบัญชีร่วม)
// ไม่ใช่บัญชีโดนบล็อก → ไม่พัก 3 วัน และต้องไม่เป็น subclass ของ Blocked
export class Hidden extends WatchError {
  constructor(message) { super(message); this.name = 'Hidden' }
}

const FMT_TH = { video: 'คลิป', photo: 'รูป', album: 'อัลบั้มรูป', link: 'แชร์ลิงก์', text: 'ข้อความ', reel: 'Reels' }
const MONTH_TH = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

// คำใบ้ต่อกลุ่มเพจที่ส่งไปกับไอเดีย (AI มุมเล่าอ่านจาก summary) — ค่า group ใช้ได้แค่ 4 ค่านี้ (โปรไฟล์อสังหาฯ ข้อ 10)
export const GROUP_HINT = {
  competitor: 'กลุ่มเพจ: คู่แข่งขายฝาก/จำนอง — ถอดว่าเขาเล่นมุม/ข้อเสนออะไรแล้วคนตอบรับ แล้วทำมุมของเราที่ต่างออกไปด้วยบริการจริงของเรา · เรต/ผลตอบแทนของเขาเป็นโฆษณา ไม่ใช่ข้อเท็จจริง · ห้ามเอ่ยชื่อ ห้ามลอกข้อความ/ภาพ',
  media: 'กลุ่มเพจ: สื่อ/ความรู้อสังหาฯ — หัวข้อนี้คนสนใจมาก ให้เล่าในมุมที่โยงกับคำถามของกลุ่ม A–D ของเรา · ห้ามอ้างชื่อเพจ ห้ามลงเนื้อเต็ม',
  official: 'กลุ่มเพจ: หน่วยงาน — ประกาศที่คนตอบรับแรง สรุปสิ่งที่เจ้าของทรัพย์/นักลงทุนต้องรู้ · ข้อเท็จจริงให้ยืนยันจากเว็บ/ประกาศทางการของหน่วยงานก่อนอ้าง ห้ามอ้างโพสต์เฟซบุ๊กเป็นแหล่ง ห้ามเดา/ทำนาย',
  community: 'กลุ่มเพจ: ชุมชน/ครีเอเตอร์ — หยิบ "คำถาม/ความอยากรู้" มาเล่าเป็นความรู้ทั่วไป · ห้ามอ้างเพจ ห้ามเล่าเคสของคนนั้น',
}

// ── เครื่องมือเล็ก ─────────────────────────────────────────────────────────
const sha14 = (s) => crypto.createHash('sha1').update(String(s), 'utf8').digest('hex').slice(0, 14)
const sanitize = (s) => String(s ?? '').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
export const dayDiff = (fromIso, toIso) => Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400e3)

export function thaiDay(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  if (!y || !m || !d) return String(iso || '')
  return `${d} ${MONTH_TH[m] || m} ${y}`
}

export function shortNum(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-'
  const v = Number(n)
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`.replace('.0M', 'M')
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`.replace('.0K', 'K')
  return String(v)
}

export function metricsTh(m = {}) {
  const parts = [`❤️ ${shortNum(m.reactions || 0)}`, `💬 ${shortNum(m.comments || 0)}`]
  if (m.shares !== null && m.shares !== undefined) parts.push(`↗️ ${shortNum(m.shares)}`)
  if (m.views) parts.push(`▶️ ${shortNum(m.views)} วิว`)
  return parts.join(' · ')
}

export function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}

export function saveJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 1)}\n`, 'utf8')
  fs.renameSync(tmp, file)
}

// ── รหัสเพจ / รหัสโพสต์ / ลิงก์ ────────────────────────────────────────────
// รหัสเพจจาก URL: profile.php?id=N → fb_N · /p/<ชื่อ>-<เลข>/ → fb_<เลข> (ต้นแบบได้ "p" ซ้ำกันทุกเพจ) · /<เลข> → fb_<เลข> · /<slug> → fb_<slug>
export function targetId(target) {
  let u
  try { u = new URL(target.url) } catch { return `fb_${sanitize(target.name || 'page')}` }
  const id = u.searchParams.get('id')
  if (id) return `fb_${sanitize(id)}`
  const segs = u.pathname.split('/').filter(Boolean)
  if (segs[0] === 'p' && segs[1]) {
    const m = /(\d{6,})$/.exec(segs[1])
    return `fb_${m ? m[1] : sanitize(segs[1])}`
  }
  const slug = segs[0] || target.name || 'page'
  const clean = sanitize(slug).replace(/^_+$/, '')
  return `fb_${clean || sha14(slug)}`
}

// ลิงก์โพสต์ที่คงที่: คลิป → /watch/?v= · รูป → /photo/?fbid= · permalink เก็บเฉพาะ story_fbid / id / v (ตัด tracking ทิ้ง)
export function fbLink(p, pageUrl) {
  if (p.vid) return `https://www.facebook.com/watch/?v=${p.vid}`
  if (Array.isArray(p.fbids) && p.fbids.length) return `https://www.facebook.com/photo/?fbid=${p.fbids[0]}`
  if (p.perma) {
    try {
      const u = new URL(p.perma)
      const keep = new URLSearchParams()
      for (const k of ['story_fbid', 'id', 'v']) if (u.searchParams.has(k)) keep.set(k, u.searchParams.get(k))
      const q = keep.toString()
      return `${u.origin}${u.pathname}${q ? `?${q}` : ''}`
    } catch { return p.perma }
  }
  return pageUrl || null
}

// รหัสโพสต์กันซ้ำ: v<videoId> | p<fbid> | u<sha1(ลิงก์ที่คง story_fbid/id)> | h<sha1(แคปชั่น 160 ตัว)>
// ⚠️ ต้นแบบตัด query ทิ้งก่อน hash → permalink.php?story_fbid=… ได้กุญแจเดียวกันทุกโพสต์ — ที่นี่ hash ลิงก์ที่ยังมี story_fbid/id อยู่
export function fbKey(p) {
  if (p.vid) return `v${p.vid}`
  if (Array.isArray(p.fbids) && p.fbids.length) return `p${p.fbids[0]}`
  if (p.perma) return `u${sha14(fbLink(p, ''))}`
  if (p.caption) return `h${sha14(String(p.caption).slice(0, 160))}`
  return null
}

// โพสต์เดียวกันอ่านได้หลายจอ — เก็บชุดที่ "รวยกว่า" (มีตัวเลขครบกว่า · แคปชั่นยาวกว่า)
export const richness = (p) => Object.values(p.m || {}).filter((v) => v !== null && v !== undefined).length * 1000 + String(p.caption || '').length

export function unwrap(res) {
  let d = res && typeof res === 'object' && 'data' in res ? res.data : res
  if (d && typeof d === 'object' && 'result' in d) d = d.result
  return d
}

// ── คลังโพสต์ต่อเพจ (.local/research/social/facebook/<tid>.json) ───────────
const FB_NOISE = /^(?:Facebook|·?\s*(?:See original|Rate this translation|ดูต้นฉบับ|ให้คะแนนคำแปลนี้))$/

export function cleanCaption(c) {
  return String(c || '').split('\n').filter((ln) => !FB_NOISE.test(ln.trim())).join('\n').trim()
}

export function tagsOf(caption) {
  const tags = String(caption || '').match(/#[^\s#.,!?()[\]"']+/g) || []
  return [...new Set(tags.map((t) => t.toLowerCase()))].sort().slice(0, 20)
}

// แคปชั่นผ่านตัวลบข้อมูลบุคคลก่อนลงคลังเสมอ (เพจนายหน้า/รับจำนองใส่เบอร์ + LINE ID แทบทุกโพสต์) · แคปชั่นที่ยาวกว่าหลังล้างชนะ
export function mergePosts(store, posts, today) {
  store.posts = store.posts && typeof store.posts === 'object' ? store.posts : {}
  const seen = []
  for (const p of posts) {
    if (!p?.key) continue
    const cap = scrub(cleanCaption(p.caption))
    let rec = store.posts[p.key]
    if (!rec) {
      rec = store.posts[p.key] = { first_seen: today, posted: p.posted || null, format: p.format || 'text', link: p.link || null, caption: cap, tags: tagsOf(cap), m0: p.m || {}, hist: [] }
    }
    const old = scrub(cleanCaption(rec.caption))
    const best = cap.length > old.length ? cap : old
    if (best !== rec.caption) { rec.caption = best; rec.tags = tagsOf(best) }
    rec.last_seen = today
    rec.m = p.m || {}
    rec.link = p.link || rec.link
    const row = [today, p.m?.reactions ?? null, p.m?.comments ?? null, p.m?.shares ?? null, p.m?.views ?? null]
    const hist = Array.isArray(rec.hist) ? rec.hist : (rec.hist = [])
    if (hist.length && hist[hist.length - 1][0] === today) hist[hist.length - 1] = row
    else hist.push(row)
    if (hist.length > 30) hist.splice(0, hist.length - 30)
    seen.push(p.key)
  }
  return seen
}

export function prunePosts(store, today, keepDays = 120) {
  const old = Object.entries(store.posts || {}).filter(([, r]) => dayDiff(r.last_seen || r.first_seen, today) > keepDays).map(([k]) => k)
  for (const k of old) delete store.posts[k]
  return old.length
}

// ── โพสต์แรงกว่าปกติของเพจเดียวกัน (ไม่เทียบข้ามเพจ) ───────────────────────
// eng = reactions + 2×comments + 3×shares (คอมเมนต์/แชร์ใช้แรงคนมากกว่า) · ฐาน median 60 วัน ต้องมี ≥ 4 โพสต์ (วิว ≥ 3 คลิป)
export const eng = (m = {}) => (m.reactions || 0) + 2 * (m.comments || 0) + 3 * (m.shares || 0)

export function median(values) {
  const s = values.map(Number).filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  const n = s.length
  if (!n) return null
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

// แรง = max(eng/median, views/median) ≥ ratio และ (eng ≥ 10 หรือ views ≥ 3000) และแคปชั่นผ่าน topic gate ของอสังหาฯ (เพจคู่แข่งโพสต์เรื่องอื่นปนเยอะ)
export function outliers(store, seen, today, cfg = {}, scoring = DEFAULT_SCORING) {
  const window = Number(cfg.baseline_days ?? DEFAULTS.baseline_days)
  const ratioMin = Number(cfg.outlier_ratio ?? DEFAULTS.outlier_ratio)
  const minE = Number(cfg.min_engagement ?? DEFAULTS.min_engagement)
  const minV = Number(cfg.min_views ?? DEFAULTS.min_views)
  const recent = Object.values(store.posts || {}).filter((r) => dayDiff(r.posted || r.first_seen, today) <= window)
  const engs = recent.map((r) => eng(r.m))
  const views = recent.map((r) => r.m?.views).filter((v) => v)
  const baseE = engs.length >= 4 ? median(engs) : null
  const baseV = views.length >= 3 ? median(views) : null
  const found = []
  for (const k of seen) {
    const r = store.posts?.[k]
    if (!r || r.idea) continue
    if (!scoreText(r.caption, scoring).gated) continue
    const e = eng(r.m)
    const v = r.m?.views || 0
    const re = baseE !== null ? e / Math.max(baseE, 1) : 0
    const rv = baseV && v ? v / Math.max(baseV, 1) : 0
    const ratio = Math.max(re, rv)
    if (ratio >= ratioMin && (e >= minE || v >= minV)) found.push({ key: k, ratio, by: rv > re ? 'views' : 'eng', base_e: baseE, base_v: baseV })
  }
  found.sort((a, b) => b.ratio - a.ratio)
  return found.slice(0, Number(cfg.max_ideas_per_target ?? DEFAULTS.max_ideas_per_target))
}

// แถวสำหรับ marketing_ideas · source 'social' subtype 'social_fb' · คะแนนอยู่ช่วงเดียวกับเลนอื่น: 2 เท่า = 4.6 · ≥ 6 เท่า = 6.2 (+0.3 คู่แข่ง)
// ทุกข้อความผ่านตัวลบข้อมูลบุคคลอีกชั้น · ห้ามใส่ชื่อ/ข้อความคนคอมเมนต์ (FB_JS ไม่คืนมาอยู่แล้ว)
export function ideaRow(target, rec, hit, today, { audience = null } = {}) {
  const group = GROUP_HINT[target.group] ? target.group : 'media'
  // เครื่องหมายคำพูดโค้งในโพสต์ของเพจ → " ตรง (ขั้นร่างอ่านข้อเท็จจริงจากบรรทัด “…” ถ้าข้างในมี ” จะอ่านขาด — ดู pii.js plainQuotes)
  const captionPlain = plainQuotes(rec.caption || '')
  const headRaw = captionPlain.split('\n').map((s) => s.trim()).find(Boolean) || '(ไม่มีข้อความ)'
  const head = scrub(headRaw).replace(/\s+/g, ' ').slice(0, 110)
  const fmt = FMT_TH[rec.format] || rec.format || 'โพสต์'
  const title = `${fmt}แรงกว่าปกติของเพจ ${Number(hit.ratio).toFixed(1)} เท่า — ${head}`
  const base = hit.by === 'views' && hit.base_v
    ? `คลิปปกติของเพจ ≈ ${shortNum(Math.round(hit.base_v))} วิว`
    : hit.base_e !== null && hit.base_e !== undefined ? `โพสต์ปกติของเพจ ≈ ${shortNum(Math.round(hit.base_e))} เอ็นเกจ` : ''
  const when = rec.posted ? `โพสต์ ${thaiDay(rec.posted)}` : `เห็นครั้งแรก ${thaiDay(rec.first_seen || today)}`
  const cap = scrub(captionPlain).replace(/\s+/g, ' ').trim()
  let summary = [metricsTh(rec.m), base, when].filter(Boolean).join(' · ')
  if (cap) summary += `\n“${cap.slice(0, 300)}${cap.length > 300 ? '…' : ''}”`
  summary += `\n${GROUP_HINT[group]}`
  summary += `\n(ตัวเฝ้าเพจ Facebook · บัญชีสำรอง อ่านอย่างเดียว · ${hit.by === 'views' ? 'เทียบยอดวิวกับคลิปอื่นของเพจ' : 'เทียบเอ็นเกจกับโพสต์อื่นของเพจ'} · ตัวเลขของเขาห้ามลงโพสต์เรา)`
  let score = Math.min(3.8 + 0.4 * Math.min(Number(hit.ratio), 6), 6.2)
  if (group === 'competitor') score += 0.3
  return {
    status: 'new',
    source: 'social',
    source_label: `Facebook · ${target.name}`.slice(0, 120),
    subtype: SUBTYPE,
    title: scrub(title).slice(0, 300),
    summary: scrub(summary).slice(0, 2000),
    url: rec.link || target.url || null,
    score: round1(score),
    audience: Array.isArray(audience) && audience.length ? audience : null,
    service_area: null,
    event_date: null,
    event_key: null,
    external_key: `sw:fb:${targetId(target)}:${hit.key}`.slice(0, 200),
    related_sku: null,
  }
}

// ── เพจที่ถึงรอบ (ค้างนานสุดก่อน · ไม่เคยเยี่ยมก่อน) ────────────────────────
export function dueTargets(targets, visits = {}, today, limit = 4) {
  const due = []
  ;(targets || []).forEach((t, i) => {
    if (!t || t.enabled === false || !t.url) return
    const last = visits[targetId(t)]
    const gap = last ? dayDiff(last, today) : 10000
    const over = gap - Number(t.every_days ?? 7)
    if (over >= 0) due.push({ over, i, t })
  })
  due.sort((a, b) => b.over - a.over || a.i - b.i)
  return due.slice(0, Math.max(0, limit)).map((d) => d.t)
}

// เหลือโควตากี่เพจ: min(รวมทั้งบัญชี 12 − ที่เปิดวันนี้ทุกโปรเจกต์, ส่วนของ AssetX 4 − ที่ AssetX เปิดวันนี้)
export function quotaLeft({ rows, today, capDay = 12, capOwn = 4, project = PROJECT }) {
  const total = pagesOn(today, undefined, rows).facebook || 0
  const own = pagesOn(today, undefined, rows.filter((r) => r.project === project)).facebook || 0
  return { left: Math.min(capDay - total, capOwn - own), total, own }
}

// ── OpenCLI ────────────────────────────────────────────────────────────────
// เรียก node main.js ตรง ๆ (ไม่ผ่าน opencli.cmd/shell — เครื่องหมายคำพูดใน FB_JS จะเพี้ยน) · cwd = โฟลเดอร์บ้าน
// ตัวห่อตัวเดียวที่แตะสัญญาณชีพ (lock.require) ก่อนทุกคำสั่ง · beat:false เฉพาะ browser close ตอนจบ (กุญแจอาจหลุดมือแล้ว)
export function createOc({ lock = null, mainJs = OPENCLI_MAIN, execFileImpl = execFile, cwd = os.homedir() } = {}) {
  return async function oc(args, { beat = true, timeoutMs = 150e3 } = {}) {
    if (beat && lock) lock.require()
    if (!fs.existsSync(mainJs)) throw new WatchError(`ไม่พบ OpenCLI (${mainJs}) — ติดตั้งด้วย npm i -g @jackwener/opencli@2.0.2`)
    const cmd = args.slice(0, 2).join(' ')
    const { stdout, stderr, timedOut } = await new Promise((resolve) => {
      execFileImpl(process.execPath, [mainJs, ...args], { cwd, windowsHide: true, timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' }, (err, out, errOut) => {
        resolve({ stdout: String(out || ''), stderr: String(errOut || ''), timedOut: Boolean(err && (err.killed || err.signal === 'SIGTERM')) })
      })
    })
    if (timedOut) throw new WatchError(`OpenCLI ช้าเกิน ${Math.round(timeoutMs / 1000)} วิ (${cmd})`)
    let res
    try { res = JSON.parse(stdout.trim()) } catch {
      throw new WatchError(`OpenCLI ตอบไม่ใช่ JSON (${cmd}): ${(stdout.trim() || stderr.trim()).slice(-240)}`)
    }
    if (res && typeof res === 'object' && res.ok === false) {
      const e = res.error
      const msg = e && typeof e === 'object' ? e.message : e
      throw new WatchError(`OpenCLI ${cmd}: ${String(msg || JSON.stringify(res)).slice(0, 240)}`)
    }
    return res
  }
}

export function chromeArgs(profileDir) {
  return [`--profile-directory=${profileDir}`, ...CHROME_FLAGS, '--no-startup-window']
}

function defaultSpawnChrome(profileDir) {
  const chrome = CHROME_PATHS.find((p) => p && fs.existsSync(p))
  if (!chrome) return false
  const child = spawn(chrome, chromeArgs(profileDir), { detached: true, stdio: 'ignore', windowsHide: true })
  child.unref()
  return true
}

// Chrome ที่รันอยู่เปิดด้วย CHROME_FLAGS ไหม → true / false / null (ไม่มี Chrome หรือเช็กไม่ได้) · ใช้บอกเจ้าของในรายงานเมื่อเจอ Hidden
// ค่าพวกนี้ติดตอนเปิด process แรกเท่านั้น — เปิด Chrome จากเมนู Start/ลิงก์ของแอปอื่นตอน Chrome ปิดอยู่ = ไม่มีค่า (ต้องปิดทุกหน้าต่างแล้วเปิดใหม่จากไอคอนที่ใส่ค่าไว้)
// ไม่แตะ browser (อ่านรายการ process อย่างเดียว) · เสร็จในไม่กี่วิ จึงเรียกใต้กุญแจได้โดยไม่เงียบเกิน 10 นาที
export async function chromeFlagsActive({ execFileImpl = execFile } = {}) {
  const ps = "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -notmatch '--type=' } | Select-Object -ExpandProperty CommandLine"
  const stdout = await new Promise((resolve) => {
    try {
      execFileImpl('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, timeout: 30e3, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }, (err, out) => resolve(err ? null : String(out || '')))
    } catch { resolve(null) }
  })
  if (stdout === null) return null
  const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return null
  return lines.every((l) => l.includes(CHROME_FLAGS[0]))
}

// bridge ไม่ต่อ → (1) daemon ของ OpenCLI ไม่ได้รัน = สั่ง `daemon restart` แล้วรอ 3×3 วิ (DVX เจอ 31 ต.ค.–3 พ.ย. 2569: daemon ไม่ขึ้นเองหลังเปิดเครื่อง
// `profile list` ไม่สตาร์ตให้ · ส่วนเสริมต่อเองทันทีเมื่อ daemon ขึ้น) → (2) เปิด Chrome profile Research แบบไม่มีหน้าต่าง แล้วถาม profile list ทุก 4 วิ ไม่เกิน 60 วิ
// ทำใต้กุญแจ · ห้ามปิด/ฆ่า Chrome หรือ daemon ที่รันอยู่ (อีกฝั่งอาจใช้)
export async function ensureBridge({ oc, cfg = {}, sleep, spawnChrome = defaultSpawnChrome, now = Date.now, deadlineMs = 60e3, pollMs = 4e3, log = () => {} }) {
  const alias = cfg.bridge_profile || DEFAULTS.bridge_profile
  const info = async () => {
    try {
      const data = unwrap(await oc(['profile', 'list'], { timeoutMs: 60e3 })) || {}
      return { running: typeof data.daemonRunning === 'boolean' ? data.daemonRunning : null, ok: (data.profiles || []).some((p) => p && p.alias === alias && p.connected) }
    } catch (e) {
      if (e.name === 'LostLock') throw e
      return { running: null, ok: false }
    }
  }
  const out = { ready: false, launched: false, daemonStarted: false }
  const first = await info()
  if (first.ok) return { ...out, ready: true }
  if (first.running === false) {
    log('[social] OpenCLI daemon ไม่ได้รัน (เครื่องเพิ่งเปิด?) — สั่งสตาร์ตให้เอง')
    out.daemonStarted = true
    try {
      await oc(['daemon', 'restart'], { timeoutMs: 60e3 })
    } catch (e) {
      if (e.name === 'LostLock') throw e
      log(`⚠️ [social] สตาร์ต OpenCLI daemon ไม่สำเร็จ: ${e.message}`)
    }
    for (let i = 0; i < 3; i++) {
      await sleep(3000)
      if ((await info()).ok) return { ...out, ready: true }
    }
  }
  // ไม่รู้โฟลเดอร์ profile (โหมดบัญชีแยกที่ยังหา profile ไม่เจอ) = ไม่เปิด Chrome เอง — ห้ามถอยไปเปิด Profile 9 ของบัญชีร่วม
  const dir = 'chrome_profile_dir' in cfg ? cfg.chrome_profile_dir : DEFAULTS.chrome_profile_dir
  if (!dir || !spawnChrome(dir)) return out
  out.launched = true
  const end = now() + deadlineMs
  while (now() < end) {
    await sleep(pollMs)
    if ((await info()).ok) return { ...out, ready: true }
  }
  return out
}

// ── อ่านหน้าเพจ: เปิด → รอ → วน eval + เลื่อน (FB ลบเนื้อหาโพสต์ที่พ้นจอ ต้องอ่านทุกจอ) ─────────
export async function readFacebookPage({ target, cfg = {}, oc, sleep, random = Math.random }) {
  const W = ['--session', cfg.session || SESSION, '--window', 'background', '--profile', cfg.bridge_profile || DEFAULTS.bridge_profile]
  await oc(['browser', 'open', target.url, ...W])
  await sleep(5500 + random() * 2000)
  const got = new Map()
  let stale = 0
  const steps = Number(cfg.fb_scroll_steps ?? DEFAULTS.fb_scroll_steps)
  const maxPosts = Number(cfg.fb_max_posts ?? DEFAULTS.fb_max_posts)
  for (let i = 0; i < steps; i++) {
    const res = unwrap(await oc(['browser', 'eval', FB_JS, ...W])) || {}
    if (res.blocked) throw new Blocked(`Facebook ขอ ${res.blocked} (บัญชีสำรองอาจหลุดล็อกอิน/ถูกขอยืนยันตัวตน)`)
    const before = got.size
    for (const p of res.posts || []) {
      const k = fbKey(p)
      if (!k) continue
      if (!got.has(k) || richness(p) > richness(got.get(k))) got.set(k, p)
    }
    // ⚠️ 3 พ.ย. 2569 ต้นเหตุ "เพจละ 1 โพสต์" (DVX เจอ 7 จาก 11 รอบ · เรา 2/2): หน้าต่างโหมด background ถูกบัง/จอล็อก → visibilityState hidden ·
    //    requestAnimationFrame ไม่ทำงาน → FB ไม่โหลดโพสต์ถัดไปแม้เลื่อนสุด (หน้าต่างที่มองเห็นโหลดปกติ 1 → 7) · ได้น้อย = โยน Hidden (ไม่เลื่อนต่อ ไม่เปิดซ้ำ) · ได้พอแล้ว = เก็บเท่าที่มี
    if (res.vis === 'hidden') {
      if (got.size < Number(cfg.fb_low_posts ?? DEFAULTS.fb_low_posts)) throw new Hidden(`หน้าต่าง browser ถูกซ่อน (จอล็อก/ถูกหน้าต่างอื่นบัง) — Chrome หยุดวาดหน้า Facebook ไม่โหลดโพสต์ต่อ (เห็น ${got.size} โพสต์)`)
      break
    }
    if (got.size >= maxPosts) break
    stale = got.size === before ? stale + 1 : 0
    if (stale >= 3) break
    await oc(['browser', 'scroll', 'down', '--amount', '900', ...W])
    await sleep(1800 + random() * 1400)
  }
  return [...got.entries()]
    .sort((a, b) => (a[1].pos || 999) - (b[1].pos || 999))
    .slice(0, maxPosts)
    .map(([key, p]) => ({ key, format: p.format || 'text', link: fbLink(p, target.url), caption: String(p.caption || ''), m: p.m || {}, posted: null }))
}

export const pageStorePath = (storeDir, tid) => path.join(storeDir, 'facebook', `${tid}.json`)

// ── แท็บ Reels ของเพจ (เจ้าของ 9 พ.ย. 2569 ส่งลิงก์ /reels/ ของ Land For Loan Thailand มาให้ติดตาม) ──────────────
// หน้ารวมคลิปมีแค่ไทล์ + ยอดวิว (ไม่มีคำบรรยาย · สำรวจจริง 9 พ.ย.: <a href="/reel/<id>"> aria-label "Reel tile preview" innerText = ยอดวิว "642")
// เปิดเฉพาะเพจที่ตั้ง reels: true · เฉพาะบัญชี AssetX เอง (ไม่เพิ่มภาระให้บัญชีร่วม) · นับเพดาน 1 เพจต่อการเปิด
// คลิปแรง = วิว ≥ 2 เท่าของค่ากลางคลิปบนแท็บเดียวกัน และ ≥ reels_min_views · ต้องมีคลิปมียอด ≥ 6 คลิป · รายงานพร้อมลิงก์ให้เจ้าของเปิดดูเอง
export const REELS_JS = `(() => {
  const tiles = new Map()
  for (const a of document.querySelectorAll('a[href*="/reel/"]')) {
    const m = a.href.match(/\\/reel\\/(\\d+)/)
    if (!m) continue
    const t = tiles.get(m[1]) || { id: m[1], text: '' }
    const txt = (a.innerText || '').trim().replace(/\\s+/g, ' ')
    if (txt && !t.text) t.text = txt.slice(0, 60)
    tiles.set(m[1], t)
  }
  const pass = document.querySelector('input[name=pass]')
  const blocked = /\\/(login|checkpoint)\\b/.test(location.pathname) || (pass && !tiles.size) ? (location.pathname.includes('checkpoint') ? 'checkpoint' : 'login') : null
  return { vis: document.visibilityState, blocked, tiles: [...tiles.values()] }
})()`

// ยอดวิวบนไทล์ (หน้าภาษาอังกฤษ): "642" · "1.2K" · "3,456" · "1.5M" → ตัวเลข · อ่านไม่ออก = null
export function parseCount(text = '') {
  const m = String(text || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([KkMm])?/)
  if (!m) return null
  const n = Number(m[1]) * (m[2] ? (/k/i.test(m[2]) ? 1e3 : 1e6) : 1)
  return Number.isFinite(n) ? Math.round(n) : null
}

export async function readFacebookReels({ target, cfg = {}, oc, sleep, random = Math.random }) {
  const W = ['--session', cfg.session || SESSION, '--window', 'background', '--profile', cfg.bridge_profile || DEFAULTS.bridge_profile]
  const url = `${String(target.url).replace(/\/+$/, '')}/reels/`
  await oc(['browser', 'open', url, ...W])
  await sleep(5500 + random() * 2000)
  const got = new Map()
  const steps = Number(cfg.reels_scroll_steps ?? 3)
  for (let i = 0; i < steps; i++) {
    const res = unwrap(await oc(['browser', 'eval', REELS_JS, ...W])) || {}
    if (res.blocked) throw new Blocked(`Facebook ขอ ${res.blocked} (บัญชีอาจหลุดล็อกอิน/ถูกขอยืนยันตัวตน)`)
    for (const t of res.tiles || []) if (t && t.id && !got.has(t.id)) got.set(t.id, { id: t.id, views: parseCount(t.text) })
    if (res.vis === 'hidden' && got.size < 3) throw new Hidden(`หน้าต่าง browser ถูกซ่อน — แท็บ Reels ไม่โหลด (เห็น ${got.size} คลิป)`)
    if (i < steps - 1) {
      await oc(['browser', 'scroll', 'down', '--amount', '1200', ...W])
      await sleep(1800 + random() * 1400)
    }
  }
  return [...got.values()]
}

// ── หน้าคลิปเดี่ยว (เจ้าของเลือก 9 พ.ย. 2569 "ทำให้เลย": เปิดคลิปแรงอ่านคำบรรยายแล้วส่งเข้าคิวไอเดีย ≤ 2 คลิป/รอบ) ──
// สำรวจจริง 9 พ.ย.: หัว h2 = ชื่อเพจ · คำบรรยายใน span[dir=auto] ตัดด้วย "… See more" · ยอดอยู่ใน aria-label "Like, 498 reactions" / "Comment, 9 comments" / "Share, 13 shares"
// หน้าคลิปโหลดคลิปถัดไปรอไว้ด้วย (มีชุดปุ่มสองชุด) → อ่านเฉพาะสิ่งที่อยู่ในจอ · กด "See more" = แค่ขยายข้อความ ไม่ใช่คำสั่งเขียน (ไม่ไลก์/คอมเมนต์/ติดตาม)
export const REEL_MORE_JS = `(() => {
  const vh = innerHeight
  const onScreen = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < vh }
  const b = [...document.querySelectorAll('[role=button]')].find((e) => /^(See more|ดูเพิ่มเติม)$/i.test((e.innerText || '').trim()) && onScreen(e))
  if (b) b.click()
  return { clicked: Boolean(b) }
})()`
export const REEL_JS = `(() => {
  const vh = innerHeight
  const onScreen = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < vh }
  const texts = [...document.querySelectorAll('span[dir="auto"], div[dir="auto"]')].filter(onScreen).map((e) => (e.innerText || '').trim()).filter((t) => t.length >= 8)
  const caption = texts.sort((a, b) => b.length - a.length)[0] || ''
  const page = [...document.querySelectorAll('h2')].filter(onScreen).map((e) => (e.innerText || '').trim()).find(Boolean) || ''
  const m = {}
  for (const el of document.querySelectorAll('[aria-label]')) {
    if (!onScreen(el)) continue
    const l = el.getAttribute('aria-label') || ''
    let x
    if ((x = l.match(/^Like,\\s*([\\d.,]+\\s*[KM]?)\\s*reactions?/i))) m.reactions = x[1]
    else if ((x = l.match(/^Comment,\\s*([\\d.,]+\\s*[KM]?)\\s*comments?/i))) m.comments = x[1]
    else if ((x = l.match(/^Share,\\s*([\\d.,]+\\s*[KM]?)\\s*shares?/i))) m.shares = x[1]
  }
  const pass = document.querySelector('input[name=pass]')
  const blocked = /\\/(login|checkpoint)\\b/.test(location.pathname) || (pass && !caption) ? (location.pathname.includes('checkpoint') ? 'checkpoint' : 'login') : null
  return { vis: document.visibilityState, page, caption: caption.replace(/\\s*…?\\s*(See more|ดูเพิ่มเติม)$/i, '').slice(0, 3000), m, blocked }
})()`

export async function readFacebookReel({ id, cfg = {}, oc, sleep, random = Math.random }) {
  const W = ['--session', cfg.session || SESSION, '--window', 'background', '--profile', cfg.bridge_profile || DEFAULTS.bridge_profile]
  await oc(['browser', 'open', `https://www.facebook.com/reel/${id}`, ...W])
  await sleep(6000 + random() * 2000)
  const more = unwrap(await oc(['browser', 'eval', REEL_MORE_JS, ...W])) || {}
  if (more.clicked) await sleep(1200 + random() * 800)
  const res = unwrap(await oc(['browser', 'eval', REEL_JS, ...W])) || {}
  if (res.blocked) throw new Blocked(`Facebook ขอ ${res.blocked} (บัญชีอาจหลุดล็อกอิน/ถูกขอยืนยันตัวตน)`)
  if (res.vis === 'hidden' && !res.caption) throw new Hidden('หน้าต่าง browser ถูกซ่อน — หน้าคลิปไม่โหลด')
  const m = {}
  for (const k of ['reactions', 'comments', 'shares']) { const n = parseCount(res.m?.[k]); if (n !== null) m[k] = n }
  return { caption: String(res.caption || '').replace(/\*\*/g, ''), page: String(res.page || ''), m }
}

// รวมคลิปเข้าคลังของเพจ (store.reels) — เก็บยอดวิวล่าสุด + ประวัติ ≤ 30 จุด (ดูว่าคลิปไหนยังโตอยู่)
export function mergeReels(store, reels = [], today) {
  if (!store.reels || typeof store.reels !== 'object') store.reels = {}
  const ids = []
  for (const r of reels) {
    if (!r || !r.id) continue
    ids.push(r.id)
    const rec = store.reels[r.id] || (store.reels[r.id] = { first_seen: today, views: null, hist: [] })
    rec.last_seen = today
    rec.link = `https://www.facebook.com/reel/${r.id}`
    if (Number.isFinite(r.views)) {
      rec.views = r.views
      const last = rec.hist.at(-1)
      if (last && last[0] === today) last[1] = r.views
      else rec.hist.push([today, r.views])
      if (rec.hist.length > 30) rec.hist = rec.hist.slice(-30)
    }
  }
  return ids
}

export function pruneReels(store, today, keepDays = 120) {
  const old = Object.entries(store.reels || {}).filter(([, r]) => dayDiff(r.last_seen || r.first_seen, today) > keepDays).map(([k]) => k)
  for (const k of old) delete store.reels[k]
  return old.length
}

// คลิปแรงกว่าปกติ (เทียบคลิปบนแท็บเดียวกันรอบนี้) · ยังไม่เคยรายงาน · เรียงแรงสุดก่อน
export function hotReels(store, ids = [], cfg = {}) {
  const rows = ids.map((id) => ({ id, ...(store.reels?.[id] || {}) })).filter((r) => Number.isFinite(r.views) && r.views > 0)
  if (rows.length < Number(cfg.reels_min_base ?? 6)) return []
  const med = median(rows.map((r) => r.views))
  const minViews = Number(cfg.reels_min_views ?? 1000)
  const ratioMin = Number(cfg.outlier_ratio ?? DEFAULTS.outlier_ratio)
  return rows
    .filter((r) => !r.reported && r.views >= minViews && med && r.views / med >= ratioMin)
    .map((r) => ({ id: r.id, views: r.views, ratio: round1(r.views / med), median: med, link: r.link }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, Number(cfg.reels_max_hot ?? 3))
}

// ── รอบของ AssetX (ลำดับตามข้อตกลงข้อ 4.6 ทุกบรรทัด) ─────────────────────────
// คืน { status, result[], opened, pages[], rows[], visited[], warnings[], lines[] } · ไม่เขียนฐานข้อมูล (ตัวรันเอา rows ไปใส่คิวหลังปล่อยกุญแจ)
// status: ok · blocked_shared (แถวพักบัญชีร่วม) · blocked_account (แถวพักบัญชี AssetX เอง — โหมด own) · already_today · no_due · quota_full · browser_busy · bridge_down · blocked · hidden · lost_lock
// โหมด own (บัญชี AssetX เอง ข้อตกลงข้อ 9): อ่านเป็นชุด batch_pages เพจ ถือ/ปล่อยกุญแจร่วมต่อชุด · บันทึกการใช้/แถวพักลงสมุดของเรา (accountDir) ไม่แตะของร่วม
export async function runFacebookWatch({ cfg = {}, targets = [], scoring = DEFAULT_SCORING, storeDir, base = defaultDir(), dryRun = false, limit = null, targetFilter = null, audience = null, deps = {} }) {
  const {
    oc: ocImpl = null,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = Date.now,
    random = Math.random,
    log = () => {},
    spawnChrome = defaultSpawnChrome,
    chromeFlagsActive: flagsActive = chromeFlagsActive,
    lockFactory = (opts) => new Lock(PROJECT, opts),
    resolveChromeDir: resolveDir = resolveChromeProfileDir,
    today = todayIso(),
  } = deps
  // แถว usage.jsonl ลงวันตามเวลาที่จดจริง (เหมือนฝั่ง DVX และโค้ดอ้างอิงในข้อตกลงข้อ 4.6) · ระบุวันเองเฉพาะเมื่อเทสต์ฉีด today มา
  const usageDay = deps?.today ? { day: today } : {}
  const acct = accountSettings(cfg)
  const own = acct.mode === 'own'
  const sb = { ...DEFAULTS.shared_browser, ...(cfg.shared_browser || {}) }
  // บัญชี AssetX: เพดานขั้นบันได (rampCap) · บัญชีร่วม: 12/4 ตามข้อตกลง
  const ownCap = own && storeDir ? rampCap(acct, { today, lastBlocked: readState(accountDir(storeDir)).last_blocked || '' }) : acct.capOwn
  const CAP_DAY = own ? ownCap : acct.capDay
  const CAP_OWN = own ? ownCap : acct.capOwn
  const NO_NEW_PAGE_MS = Number(sb.no_new_page_sec ?? 300) * 1000
  const NO_REREAD_MS = Number(sb.no_reread_sec ?? 360) * 1000
  const WAIT_MS = Number(sb.wait_minutes ?? 20) * 60e3
  // วันละหลายรอบ (บัญชี AssetX): แบ่งเพดานเท่า ๆ กันต่อรอบ — 21:00 กับ 23:00 อ่านคนละครึ่ง บัญชีได้พักระหว่างรอบ ไม่อ่านรวดเดียว
  const perRun = own ? Math.min(Number(cfg.own_account?.max_targets_per_run?.facebook ?? acct.perRun), Math.ceil(CAP_OWN / acct.roundsPerDay)) : acct.perRun
  const session = cfg.session || SESSION
  const profile = acct.bridge_profile
  if (!storeDir) throw new Error('runFacebookWatch ต้องการ storeDir (.local/research/social)')
  // โหมดบัญชีแยก: หาโฟลเดอร์ Chrome profile จากชื่อ (ตัวต่อ bridge ใช้เปิด Chrome เองเมื่อส่วนเสริมยังไม่ต่อ) · ตัวอ่าน/ตัวต่อใช้ alias ของบัญชีเรา
  const chromeDir = own ? (acct.chrome_profile_dir || resolveDir(acct.chrome_profile_name)) : acct.chrome_profile_dir
  const rcfg = { ...cfg, bridge_profile: profile, chrome_profile_dir: chromeDir }
  // แถวพัก + บันทึกการใช้: shared = ของร่วม (~/.research-browser) · own = สมุดของเราเอง (.local/research/social/account) · กุญแจใช้ของร่วมทั้งสองโหมด
  const acctBase = own ? accountDir(storeDir) : base
  const book = own ? new AccountBook(acctBase) : null
  const LABEL = acct.label
  const BLOCKED_STATUS = own ? 'blocked_account' : 'blocked_shared'

  const state = loadJson(path.join(storeDir, 'state.json'), { visits: {} })
  if (!state.visits || typeof state.visits !== 'object') state.visits = {}
  const out = { day: today, dry_run: dryRun, status: 'ok', account: acct.mode, result: [], opened: { facebook: 0 }, pages: [], rows: [], reels: [], visited: [], warnings: [], lines: [], holder: null, stolen_from: null, waited_ms: 0, touched: false, picked: 0, batches: 0, chrome_flags_active: null }
  const say = (s) => { out.lines.push(s); log(s) }
  const quota = () => quotaLeft({ rows: usageRows(acctBase), today, capDay: CAP_DAY, capOwn: CAP_OWN })
  const quotaText = (q) => (own ? `บัญชี AssetX เปิด ${q.own}/${CAP_OWN}` : `บัญชีร่วมเปิด ${q.total}/${CAP_DAY} · AssetX ${q.own}/${CAP_OWN}`)

  // ── ก่อนรอกุญแจ: ไม่มีอะไรให้อ่านแน่ ๆ = ไม่ต้องรอ 20 นาที และไม่ต้องจดอะไรของร่วม
  const b0 = blockedFor(PLATFORM, today, acctBase)
  if (b0) {
    out.status = BLOCKED_STATUS
    say(own
      ? `⚠️ [social] บัญชี Facebook ของ AssetX พักอยู่ตั้งแต่ ${thaiDay(b0.at)} (เจอ: ${String(b0.why || '').slice(0, 160)}) — เจ้าของเปิด ${LABEL} เช็กบัญชีก่อน · ระบบลองใหม่เองหลัง 3 วัน`
      : `⚠️ [social] Facebook พักอยู่ตั้งแต่ ${thaiDay(b0.at)} (${b0.by || '?'} เจอ: ${String(b0.why || '').slice(0, 160)}) — เจ้าของเปิด Chrome profile Research เช็กบัญชีก่อน · ระบบลองใหม่เองหลัง 3 วัน`)
    return out
  }
  let q = quota()
  // วันละ 1 รอบ (รอบสำรองข้ามเอง) — ยกเว้นเจ้าของสั่งอ่านเพจเฉพาะ (--target) ซึ่งยังต้องอยู่ในเพดานและเคารพแถวพัก (ข้อตกลง 4.7: AssetX ไม่มีข้อยกเว้นอื่น เว้นแต่เจ้าของสั่ง)
  // บัญชีแยก: นับเฉพาะ "รอบตามเวลา" ที่จบแล้ววันนี้ — รอบลอง (--limit) / เจ้าของสั่ง (--target) ไม่ทำให้รอบ 21:00 ถูกข้าม (เพจที่เปิดยังนับเข้าเพดาน 8)
  //   (9 พ.ย. 2569: ลองอ่าน 1 เพจตอนสลับบัญชีกลางวัน แล้วรอบคืนนั้นหายทั้งรอบ ไม่ใช่สิ่งที่เจ้าของต้องการ)
  const manual = Boolean(limit || targetFilter)
  // บัญชี AssetX: นับรอบตามเวลาที่จบแล้ววันนี้ (แถวสรุป round=scheduled · หนึ่งรอบมีได้หลายชุด จึงนับตาม run) เทียบกับ rounds_per_day
  const runId = `${today}-${Math.round(now())}`
  const roundsDone = () => new Set(usageRows(acctBase).filter((r) => r.date === today && r.round === 'scheduled').map((r) => r.run || r.start)).size
  const roundDoneToday = () => (own ? roundsDone() >= acct.roundsPerDay : q.own > 0)
  if (roundDoneToday() && !targetFilter) {
    out.status = 'already_today'
    say(`[social] วันนี้ AssetX อ่าน Facebook แล้ว ${q.own} เพจ — ข้าม (วันละ 1 รอบ)`)
    return out
  }
  if (q.own > 0 && targetFilter) say(`[social] อ่านเพจตามคำสั่งเจ้าของ (--target) แม้วันนี้ AssetX อ่านแล้ว ${q.own} เพจ — เหลือโควตา ${Math.max(q.left, 0)} เพจ`)
  const all = (targets || []).filter((t) => t && t.enabled !== false && t.url)
  let picks
  if (targetFilter) {
    const f = String(targetFilter).toLowerCase()
    picks = all.filter((t) => JSON.stringify(t).toLowerCase().includes(f)).slice(0, perRun)
    if (!picks.length) { out.status = 'no_due'; say(`[social] ไม่พบเพจที่ตรงกับ "${targetFilter}"`); return out }
  } else {
    picks = dueTargets(all, state.visits, today, perRun)
  }
  if (limit) picks = picks.slice(0, Math.max(0, Number(limit)))
  if (!picks.length) { out.status = 'no_due'; say('[social] ยังไม่มีเพจถึงรอบ'); return out }
  if (q.left <= 0) {
    out.status = 'quota_full'
    say(`[social] โควตา Facebook วันนี้เต็มแล้ว (${quotaText(q)}) — รอบนี้ไม่อ่าน`)
    return out
  }

  // ── อ่านเป็นชุด (บัญชีร่วม = ชุดเดียวทั้งรอบ ตามข้อ 4.6 · บัญชีแยก = ชุดละ batch_pages เพจ ถือกุญแจต่อชุด ปล่อยพักระหว่างชุด)
  const batches = []
  for (let i = 0; i < picks.length; i += Math.min(acct.batch, picks.length)) batches.push(picks.slice(i, i + acct.batch))
  let stop = false

  const holdBatch = async (batch, bi) => {
    const first = bi === 0
    const lock = lockFactory({ purpose: dryRun ? 'facebook_watch --dry-run' : 'facebook_watch', base })
    const h0 = lock.holder()
    const tWait = now()
    if (!(await lock.acquire({ waitMs: WAIT_MS }))) {
      const h = lock.holder() || h0 || {}
      out.holder = h
      stop = true
      if (first) {
        out.status = 'browser_busy'
        say(`⚠️ [social] browser ไม่ว่าง (${h.project || '?'} ${h.purpose || ''} · เริ่ม ${String(h.started_at || '?').slice(11, 16)} · เงียบ ${h.idle_sec ?? '?'} วิ) — รอ ${Math.round(WAIT_MS / 60000)} นาทีแล้วยังไม่ว่าง · ข้ามรอบ (เพจที่ถึงรอบได้อ่านรอบหน้า)`)
        return 'return'
      } else {
        out.result.push('browser_busy')
        say(`⚠️ [social] ชุดที่ ${bi + 1}: browser ไม่ว่าง (${h.project || '?'}) รอ ${Math.round(WAIT_MS / 60000)} นาทีแล้ว — ที่เหลือ ${picks.length - out.pages.length} เพจอ่านรอบหน้า`)
      }
      return
    }
    if (first) out.waited_ms = now() - tWait
    if (lock.stolenFrom) { out.stolen_from = lock.stolenFrom; say(`[social] ยึดกุญแจค้างจาก ${lock.stolenFrom.project || '?'} (เงียบเกิน 10 นาที) — ถือต่อ`) }
    else if (h0 && now() - tWait >= 30e3) say(`[social] รอ ${h0.project || '?'} ใช้ browser เสร็จ ${Math.round((now() - tWait) / 60000)} นาที`)

    // บันทึกการใช้/แถวพัก: บัญชีร่วม = ผ่านกุญแจลงของร่วม (ต้องถือกุญแจ) · บัญชีแยก = สมุดของเรา
    const rec = own
      ? { usage: (pages, result, opts) => book.logUsage(pages, result, opts), block: (why) => book.setBlocked(PLATFORM, why, today), clear: () => book.clearBlocked(PLATFORM) }
      : { usage: (pages, result, opts) => lock.logUsage(pages, result, opts), block: (why) => lock.setBlocked(PLATFORM, why, today), clear: () => lock.clearBlocked(PLATFORM) }
    const oc = ocImpl || createOc({ lock })
    const t0 = now()
    let touched = false
    const opened0 = out.opened.facebook
    const result0 = out.result.length
    try {
      // ตรวจซ้ำหลังได้กุญแจ — ระหว่างรอ อีกฝั่งอาจเพิ่งใช้โควตาหรือเพิ่งเจอบล็อก
      const b1 = blockedFor(PLATFORM, today, acctBase)
      if (b1) { out.status = BLOCKED_STATUS; stop = true; say(own ? '⚠️ [social] บัญชี Facebook ของ AssetX พักอยู่ — ข้ามรอบ' : `⚠️ [social] Facebook พักอยู่ (${b1.by || '?'} เจอระหว่างที่เรารอกุญแจ) — ข้ามรอบ`); return 'return' }
      q = quota()
      if (first && roundDoneToday() && !targetFilter) { out.status = 'already_today'; stop = true; say('[social] AssetX อีกตัวอ่านไปแล้วระหว่างรอ — ข้าม'); return 'return' }
      const todo = batch.slice(0, Math.max(0, q.left))
      if (!todo.length) {
        stop = true
        if (first) { out.status = 'quota_full'; say(`[social] โควตา Facebook วันนี้เต็มแล้ว (ระหว่างรอ อีกฝั่งใช้ไป · ${quotaText(q)})`) } else out.result.push('quota')
        return 'return'
      }
      out.picked += todo.length
      out.batches += 1
      out.touched = true // dry-run ก็จดการใช้ (ข้อ 4.7)
      touched = true
      if (batches.length > 1) say(`[social] ชุดที่ ${bi + 1}/${batches.length} (${todo.length} เพจ · ปล่อยกุญแจพักระหว่างชุด)`)

      const bridge = await ensureBridge({ oc, cfg: rcfg, sleep, spawnChrome, now, log: say })
      if (bridge.daemonStarted && bridge.ready) say('[social] OpenCLI daemon กลับมาแล้ว ส่วนเสริมต่อเอง')
      if (bridge.launched) say(`[social] เปิด ${LABEL} ให้เอง (ไม่มีหน้าต่าง)`)
      if (!bridge.ready) {
        out.result.push('bridge_down')
        out.status = 'bridge_down'
        stop = true
        say(own
          ? `⚠️ [social] ต่อ ${LABEL} ไม่ได้ (OpenCLI ไม่เห็น alias "${profile}")${chromeDir ? '' : ` · ไม่พบ Chrome profile ชื่อ "${acct.chrome_profile_name}"`} — เจ้าของเปิด Chrome profile นั้นค้างไว้และเช็กว่าส่วนเสริม OpenCLI เปิดอยู่ (ยังไม่ได้ตั้งชื่อ = node scripts/research-social.mjs account link) · รอบนี้ข้าม`
          : '⚠️ [social] ต่อ Chrome profile Research ไม่ได้ — เจ้าของเปิด Chrome profile นั้นค้างไว้ แล้วเช็กว่าส่วนเสริม OpenCLI เปิดอยู่ (DVX อ่านเพจไม่ได้เหมือนกัน) · รอบนี้ข้าม')
        return 'return'
      }
      try {
        for (let n = 0; n < todo.length; n++) {
          const t = todo[n]
          if (n) await sleep(6000 + random() * 8000) // เว้นจังหวะระหว่างเพจ ไม่รัว
          if (now() - t0 > NO_NEW_PAGE_MS) {
            out.result.push('budget')
            say(`[social] หมดงบเวลาถือกุญแจ (${Math.round(NO_NEW_PAGE_MS / 1000)} วิ) — ที่เหลือ ${todo.length - n} เพจอ่านรอบหน้า (ยังไม่นับว่าเยี่ยม)`)
            break
          }
          const tid = targetId(t)
          const file = pageStorePath(storeDir, tid)
          const store = loadJson(file, { target: t.name, posts: {} })
          const page = { name: t.name, tid, posts: 0, new: 0, hits: 0, low: false, fail: null }
          out.pages.push(page)
          if (own) lock.require() // ยังถือกุญแจอยู่ก่อนจด (บัญชีร่วมเช็กในตัว logUsage)
          rec.usage({ facebook: 1 }, 'open', usageDay) // จดก่อนเปิด (ใต้กุญแจ) — โดนฆ่า/กุญแจหลุดกลางทางก็ยังนับ
          out.opened.facebook += 1
          let posts
          try {
            posts = await readFacebookPage({ target: t, cfg: rcfg, oc, sleep, random })
            const few = Number(cfg.fb_low_posts ?? DEFAULTS.fb_low_posts)
            if (posts.length < few) {
              if (now() - t0 < NO_REREAD_MS) {
                say(`[social] ${t.name}: อ่านได้ ${posts.length} โพสต์ — เปิดใหม่ลองอีกรอบ`)
                await sleep(8000 + random() * 4000)
                const again = await readFacebookPage({ target: t, cfg: rcfg, oc, sleep, random })
                if (again.length > posts.length) posts = again
              } else {
                out.result.push('budget')
              }
              page.low = posts.length < few
            }
          } catch (e) {
            if (e.name === 'Blocked') {
              rec.block(e.message) // บัญชีร่วม = ให้ DVX พักด้วย · บัญชีแยก = พักเฉพาะของเรา
              out.result.push('blocked:facebook')
              out.status = 'blocked'
              page.fail = 'blocked'
              stop = true
              say(own
                ? `⚠️ [social] ${e.message} — หยุดเลน Facebook ทันที · พักบัญชี AssetX 3 วัน (DVX ไม่เกี่ยว คนละบัญชี) · เจ้าของเปิด ${LABEL} ดูว่าโดนขอยืนยันตัวตนไหม`
                : `⚠️ [social] ${e.message} — หยุดเลน Facebook ทันที (แจ้ง DVX ให้พักด้วยแล้ว 3 วัน)`)
              break
            }
            if (e.name === 'Hidden') {
              // หน้าต่างถูกซ่อน = เปิดเพจต่อก็ได้เพจละ 1 โพสต์ → หยุดเลนรอบนี้ ไม่เปิดซ้ำ ไม่นับว่าเยี่ยม · ไม่ใช่บล็อก ไม่เขียนแถวพัก
              out.result.push('hidden:facebook')
              out.status = 'hidden'
              page.fail = 'hidden'
              stop = true
              let flags = null
              try { flags = await flagsActive() } catch { flags = null }
              out.chrome_flags_active = flags
              const hint = flags === false
                ? ' · Chrome ที่รันอยู่เปิดโดยไม่มีค่ากันหยุดวาด — ปิด Chrome ทุกหน้าต่างแล้วเปิดใหม่จากไอคอนบนเดสก์ท็อป (ไอคอนใส่ค่าไว้แล้ว)'
                : flags ? ' · Chrome มีค่ากันหยุดวาดแล้วแต่ยังถูกซ่อน (หน้าต่างถูกย่อเล็กสุด/จอดับ?)' : ''
              say(`⚠️ [social] ${e.message} — หยุดเลน Facebook รอบนี้ · เพจที่ถึงรอบยังไม่นับว่าอ่าน (รอบหน้าอ่านก่อน) · ไม่ใช่บัญชีโดนบล็อก ไม่พัก 3 วัน${hint}`)
              break
            }
            if (e.name === 'LostLock') throw e
            page.fail = String(e.message || e).slice(0, 160)
            out.warnings.push(`⚠️ [social] อ่าน ${t.name} ไม่สำเร็จ: ${page.fail}`)
            say(out.warnings.at(-1))
            continue
          }
          rec.clear() // อ่านสำเร็จ = บัญชีกลับมาใช้ได้ (เขียนเฉพาะตอนมีแถว)
          const before = Object.keys(store.posts || {}).length
          const seen = mergePosts(store, posts, today)
          page.posts = seen.length
          page.new = Object.keys(store.posts).length - before
          prunePosts(store, today, Number(cfg.keep_days ?? DEFAULTS.keep_days))
          const hits = outliers(store, seen, today, cfg, scoring)
          page.hits = hits.length
          for (const h of hits) out.rows.push({ name: t.name, tid, file, key: h.key, ratio: h.ratio, row: ideaRow(t, store.posts[h.key], h, today, { audience }) })
          // แท็บ Reels (เฉพาะเพจ reels: true · บัญชี AssetX เอง · ยังมีโควตาและงบเวลา) — เปิดเพิ่ม 1 เพจ
          if (own && t.reels && posts.length && quota().left > 0 && now() - t0 < NO_NEW_PAGE_MS) {
            lock.require()
            await sleep(4000 + random() * 4000)
            rec.usage({ facebook: 1 }, 'open', usageDay)
            out.opened.facebook += 1
            try {
              const reels = await readFacebookReels({ target: t, cfg: rcfg, oc, sleep, random })
              const ids = mergeReels(store, reels, today)
              pruneReels(store, today, Number(cfg.keep_days ?? DEFAULTS.keep_days))
              const hot = hotReels(store, ids, cfg)
              page.reels = ids.length
              for (const h of hot) { out.reels.push({ name: t.name, tid, ...h }); if (!dryRun) store.reels[h.id].reported = today }
              say(`[social] ${t.name} · Reels: ${ids.length} คลิป · วิวค่ากลาง ${median(ids.map((id) => store.reels[id]?.views).filter((v) => v > 0)) ?? '-'} · แรงกว่าปกติ ${hot.length}`)
              // เปิดคลิปแรงอ่านคำบรรยาย (≤ reels_open_hot ต่อรอบ · มีโควตาและงบเวลา) → คำบรรยายผ่าน topic gate = ไอเดีย (source social · คลิป)
              for (const h of hot.slice(0, Number(cfg.reels_open_hot ?? 2))) {
                if (quota().left <= 0 || now() - t0 > NO_NEW_PAGE_MS) break
                lock.require()
                await sleep(4000 + random() * 4000)
                rec.usage({ facebook: 1 }, 'open', usageDay)
                out.opened.facebook += 1
                const one = await readFacebookReel({ id: h.id, cfg: rcfg, oc, sleep, random })
                const caption = scrub(cleanCaption(one.caption))
                const r = store.reels[h.id]
                r.caption = caption
                // ยอดบนหน้าคลิปอาจเป็นของคลิปถัดไปที่ Facebook โหลดรอ (ทดสอบจริง 9 พ.ย.: ได้ "แชร์ 1" แต่อีกชุดในหน้าเดียวกันเป็น 498 ถูกใจ) →
                // ไอเดียใช้แค่ยอดวิวจากไทล์บนแท็บ Reels (เชื่อได้) · ยอดหน้าคลิปเก็บแยกไว้ดูเท่านั้น
                r.m = { views: h.views }
                r.page_m = one.m
                const passes = caption.length >= 20 && scoreText(caption, scoring).gated
                h.caption = caption.split('\n').map((s) => s.trim()).find(Boolean)?.slice(0, 90) || ''
                const entry = out.reels.find((x) => x.tid === tid && x.id === h.id)
                if (entry) { entry.caption = h.caption; entry.queued = passes }
                if (passes) {
                  const key = `reel_${h.id}`
                  out.rows.push({ name: t.name, tid, file, key, ratio: h.ratio, row: ideaRow(t, { caption, m: r.m, format: 'video', link: h.link, first_seen: r.first_seen }, { key, ratio: h.ratio, by: 'views', base_v: h.median }, today, { audience }) })
                }
                say(`[social] ${t.name} · คลิปแรง ${h.views} วิว (${h.ratio} เท่า): ${h.caption || '(ไม่มีคำบรรยาย)'}${passes ? ' → เข้าคิวไอเดีย' : ' · ไม่เข้าคิว (คำบรรยายสั้น/ไม่ใช่เรื่องอสังหาฯ)'}`)
              }
            } catch (e) {
              if (e.name === 'LostLock') throw e
              if (e.name === 'Blocked') {
                rec.block(e.message)
                out.result.push('blocked:facebook'); out.status = 'blocked'; page.fail = 'blocked'; stop = true
                say(`⚠️ [social] ${e.message} (ตอนเปิดแท็บ Reels) — หยุดเลน Facebook ทันที · พักบัญชี AssetX 3 วัน`)
                if (!dryRun) saveJson(file, store)
                break
              }
              out.warnings.push(`⚠️ [social] อ่านแท็บ Reels ของ ${t.name} ไม่สำเร็จ: ${String(e.message || e).slice(0, 160)}`)
              say(out.warnings.at(-1))
            }
          }
          if (!posts.length) say(`⚠️ [social] ${t.name}: ไม่เจอโพสต์เลย (เพจย้าย/ปิด/โหลดไม่ขึ้น?)`)
          else if (page.low) say(`⚠️ [social] ${t.name}: อ่านได้แค่ ${posts.length} โพสต์ — ยังไม่นับว่าเยี่ยมเพจนี้ รอบหน้าอ่านก่อน`)
          else say(`[social] ${t.name}: ${seen.length} โพสต์ (ใหม่ ${page.new}) · แรงกว่าปกติ ${hits.length}`)
          if (!dryRun) {
            if (!page.low) { state.visits[tid] = today; out.visited.push(tid) }
            store.target = t.name
            saveJson(file, store)
          }
        }
      } finally {
        // ปิดเฉพาะ session ของเรา · ไม่แตะสัญญาณชีพ (กุญแจอาจหลุดมือไปแล้ว) · ห้ามปิด dvxwatch / ห้ามฆ่า Chrome
        await oc(['browser', 'close', '--session', session, '--profile', profile], { beat: false, timeoutMs: 40e3 }).catch(() => {})
      }
    } catch (e) {
      if (e.name !== 'LostLock') throw e
      out.result.push('lost_lock')
      out.status = 'lost_lock'
      stop = true
      say(`⚠️ [social] ${e.message} — หยุดอ่านทันที · เพจที่อ่านแล้วยังเก็บ/เข้าคิวตามปกติ`)
    } finally {
      try {
        // แถวสรุปของชุดนี้ (pages ว่าง ไม่นับโควตา) · บัญชีร่วมต้องยังถือกุญแจ
        if (touched && (own || lock.held)) rec.usage({}, [...new Set(out.result.slice(result0))].join(',') || 'ok', { opened: { facebook: out.opened.facebook - opened0 }, ...usageDay, ...(own ? { round: manual ? 'manual' : 'scheduled', run: runId } : {}) })
      } catch { /* กุญแจหลุดแล้ว — ข้ามแถวสรุป ห้ามโยนออกจาก finally */ }
      lock.release() // ปล่อยเสมอ
    }
  }

  for (let bi = 0; bi < batches.length && !stop; bi++) {
    if (bi) await sleep(acct.gapMs + random() * 15000) // พักระหว่างชุด — กุญแจว่างให้ DVX แทรกได้
    // ชุดแรกออกก่อนเวลา (ไม่ว่าง/พัก/อ่านแล้ว/โควตา/bridge) = จบรอบแบบเดิมทันที · ชุดหลัง ๆ หยุดแล้วบันทึกเพจที่อ่านไปแล้ว
    if ((await holdBatch(batches[bi], bi)) === 'return' && bi === 0) return out
  }

  if (!dryRun && out.touched) saveJson(path.join(storeDir, 'state.json'), { ...state, last_round: { day: today, status: out.status, opened: out.opened.facebook, account: acct.mode } })
  const fails = out.pages.filter((p) => p.fail).length
  const low = out.pages.filter((p) => p.low).length
  say(`[social] Facebook${own ? ' (บัญชี AssetX)' : ''}: เปิด ${out.opened.facebook} เพจ · โพสต์ ${out.pages.reduce((n, p) => n + p.posts, 0)} (ใหม่ ${out.pages.reduce((n, p) => n + p.new, 0)}) · แรงกว่าปกติ ${out.rows.length}${fails ? ` · ล้ม ${fails}` : ''}${low ? ` · ได้น้อยผิดปกติ ${low}` : ''}${dryRun ? ' · DRY RUN (ไม่เขียนคลัง/สถานะของเรา)' : ''}`)
  return out
}

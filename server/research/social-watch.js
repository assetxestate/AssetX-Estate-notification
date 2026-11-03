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
import { Lock, blockedFor, pagesOn, usageRows, todayIso, defaultDir } from './shared-browser.mjs'
import { scrub } from './pii.js'
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
}

export class WatchError extends Error {
  constructor(message) { super(message); this.name = 'WatchError' }
}
// แพลตฟอร์มขอล็อกอิน/ยืนยันตัวตน — หยุดเลนทันที อย่ารัวต่อ (บัญชีเดียวกับ DVX)
export class Blocked extends WatchError {
  constructor(message) { super(message); this.name = 'Blocked' }
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
  const headRaw = String(rec.caption || '').split('\n').map((s) => s.trim()).find(Boolean) || '(ไม่มีข้อความ)'
  const head = scrub(headRaw).replace(/\s+/g, ' ').slice(0, 110)
  const fmt = FMT_TH[rec.format] || rec.format || 'โพสต์'
  const title = `${fmt}แรงกว่าปกติของเพจ ${Number(hit.ratio).toFixed(1)} เท่า — ${head}`
  const base = hit.by === 'views' && hit.base_v
    ? `คลิปปกติของเพจ ≈ ${shortNum(Math.round(hit.base_v))} วิว`
    : hit.base_e !== null && hit.base_e !== undefined ? `โพสต์ปกติของเพจ ≈ ${shortNum(Math.round(hit.base_e))} เอ็นเกจ` : ''
  const when = rec.posted ? `โพสต์ ${thaiDay(rec.posted)}` : `เห็นครั้งแรก ${thaiDay(rec.first_seen || today)}`
  const cap = scrub(rec.caption || '').replace(/\s+/g, ' ').trim()
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

function defaultSpawnChrome(profileDir) {
  const chrome = CHROME_PATHS.find((p) => p && fs.existsSync(p))
  if (!chrome) return false
  const child = spawn(chrome, [`--profile-directory=${profileDir}`, '--no-startup-window'], { detached: true, stdio: 'ignore', windowsHide: true })
  child.unref()
  return true
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
  if (!spawnChrome(cfg.chrome_profile_dir || DEFAULTS.chrome_profile_dir)) return out
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

// ── รอบของ AssetX (ลำดับตามข้อตกลงข้อ 4.6 ทุกบรรทัด) ─────────────────────────
// คืน { status, result[], opened, pages[], rows[], visited[], warnings[], lines[] } · ไม่เขียนฐานข้อมูล (ตัวรันเอา rows ไปใส่คิวหลังปล่อยกุญแจ)
// status: ok · blocked_shared · already_today · no_due · quota_full · browser_busy · bridge_down · blocked · lost_lock
export async function runFacebookWatch({ cfg = {}, targets = [], scoring = DEFAULT_SCORING, storeDir, base = defaultDir(), dryRun = false, limit = null, targetFilter = null, audience = null, deps = {} }) {
  const {
    oc: ocImpl = null,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = Date.now,
    random = Math.random,
    log = () => {},
    spawnChrome = defaultSpawnChrome,
    lockFactory = (opts) => new Lock(PROJECT, opts),
    today = todayIso(),
  } = deps
  const sb = { ...DEFAULTS.shared_browser, ...(cfg.shared_browser || {}) }
  const CAP_DAY = Number(sb.daily_cap?.facebook ?? 12)
  const CAP_OWN = Number(sb.own_daily_cap?.facebook ?? 4)
  const NO_NEW_PAGE_MS = Number(sb.no_new_page_sec ?? 300) * 1000
  const NO_REREAD_MS = Number(sb.no_reread_sec ?? 360) * 1000
  const WAIT_MS = Number(sb.wait_minutes ?? 20) * 60e3
  const perRun = Number(cfg.max_targets_per_run?.facebook ?? DEFAULTS.max_targets_per_run.facebook)
  const session = cfg.session || SESSION
  const profile = cfg.bridge_profile || DEFAULTS.bridge_profile
  if (!storeDir) throw new Error('runFacebookWatch ต้องการ storeDir (.local/research/social)')

  const state = loadJson(path.join(storeDir, 'state.json'), { visits: {} })
  if (!state.visits || typeof state.visits !== 'object') state.visits = {}
  const out = { day: today, dry_run: dryRun, status: 'ok', result: [], opened: { facebook: 0 }, pages: [], rows: [], visited: [], warnings: [], lines: [], holder: null, stolen_from: null, waited_ms: 0, touched: false, picked: 0 }
  const say = (s) => { out.lines.push(s); log(s) }
  const quota = () => quotaLeft({ rows: usageRows(base), today, capDay: CAP_DAY, capOwn: CAP_OWN })

  // ── ก่อนรอกุญแจ: ไม่มีอะไรให้อ่านแน่ ๆ = ไม่ต้องรอ 20 นาที และไม่ต้องจดอะไรของร่วม
  const b0 = blockedFor(PLATFORM, today, base)
  if (b0) {
    out.status = 'blocked_shared'
    say(`⚠️ [social] Facebook พักอยู่ตั้งแต่ ${thaiDay(b0.at)} (${b0.by || '?'} เจอ: ${String(b0.why || '').slice(0, 160)}) — เจ้าของเปิด Chrome profile Research เช็กบัญชีก่อน · ระบบลองใหม่เองหลัง 3 วัน`)
    return out
  }
  let q = quota()
  if (q.own > 0) {
    out.status = 'already_today'
    say(`[social] วันนี้ AssetX อ่าน Facebook แล้ว ${q.own} เพจ — ข้าม (วันละ 1 รอบ)`)
    return out
  }
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
    say(`[social] โควตา Facebook วันนี้เต็มแล้ว (บัญชีร่วมเปิด ${q.total}/${CAP_DAY} · AssetX ${q.own}/${CAP_OWN}) — รอบนี้ไม่อ่าน`)
    return out
  }

  // ── ถือกุญแจ (รอได้ถึง 20 นาที ครอบรอบเต็มของ DVX)
  const lock = lockFactory({ purpose: dryRun ? 'facebook_watch --dry-run' : 'facebook_watch', base })
  const h0 = lock.holder()
  const tWait = now()
  if (!(await lock.acquire({ waitMs: WAIT_MS }))) {
    const h = lock.holder() || h0 || {}
    out.status = 'browser_busy'
    out.holder = h
    say(`⚠️ [social] browser ไม่ว่าง (${h.project || '?'} ${h.purpose || ''} · เริ่ม ${String(h.started_at || '?').slice(11, 16)} · เงียบ ${h.idle_sec ?? '?'} วิ) — รอ ${Math.round(WAIT_MS / 60000)} นาทีแล้วยังไม่ว่าง · ข้ามรอบ (เพจที่ถึงรอบได้อ่านรอบหน้า)`)
    return out
  }
  out.waited_ms = now() - tWait
  if (lock.stolenFrom) { out.stolen_from = lock.stolenFrom; say(`[social] ยึดกุญแจค้างจาก ${lock.stolenFrom.project || '?'} (เงียบเกิน 10 นาที) — ถือต่อ`) }
  else if (h0 && out.waited_ms >= 30e3) say(`[social] รอ ${h0.project || '?'} ใช้ browser เสร็จ ${Math.round(out.waited_ms / 60000)} นาที`)

  const oc = ocImpl || createOc({ lock })
  const t0 = now()
  try {
    // ตรวจซ้ำหลังได้กุญแจ — ระหว่างรอ อีกฝั่งอาจเพิ่งใช้โควตาหรือเพิ่งเจอบล็อก
    const b1 = blockedFor(PLATFORM, today, base)
    if (b1) { out.status = 'blocked_shared'; say(`⚠️ [social] Facebook พักอยู่ (${b1.by || '?'} เจอระหว่างที่เรารอกุญแจ) — ข้ามรอบ`); return out }
    q = quota()
    if (q.own > 0) { out.status = 'already_today'; say('[social] AssetX อีกตัวอ่านไปแล้วระหว่างรอ — ข้าม'); return out }
    picks = picks.slice(0, Math.max(0, q.left))
    if (!picks.length) { out.status = 'quota_full'; say(`[social] โควตา Facebook วันนี้เต็มแล้ว (ระหว่างรอ อีกฝั่งใช้ไป · บัญชีร่วม ${q.total}/${CAP_DAY})`); return out }
    out.picked = picks.length
    out.touched = true // dry-run ก็จดของร่วม (ข้อ 4.7)

    const bridge = await ensureBridge({ oc, cfg, sleep, spawnChrome, now, log: say })
    if (bridge.daemonStarted && bridge.ready) say('[social] OpenCLI daemon กลับมาแล้ว ส่วนเสริมต่อเอง')
    if (bridge.launched) say('[social] เปิด Chrome profile Research ให้เอง (ไม่มีหน้าต่าง)')
    if (!bridge.ready) {
      out.result.push('bridge_down')
      out.status = 'bridge_down'
      say('⚠️ [social] ต่อ Chrome profile Research ไม่ได้ — เจ้าของเปิด Chrome profile นั้นค้างไว้ แล้วเช็กว่าส่วนเสริม OpenCLI เปิดอยู่ (DVX อ่านเพจไม่ได้เหมือนกัน) · รอบนี้ข้าม')
      return out
    }
    try {
      for (let n = 0; n < picks.length; n++) {
        const t = picks[n]
        if (n) await sleep(6000 + random() * 8000) // เว้นจังหวะระหว่างเพจ ไม่รัว
        if (now() - t0 > NO_NEW_PAGE_MS) {
          out.result.push('budget')
          say(`[social] หมดงบเวลาถือกุญแจ (${Math.round(NO_NEW_PAGE_MS / 1000)} วิ) — ที่เหลือ ${picks.length - n} เพจอ่านรอบหน้า (ยังไม่นับว่าเยี่ยม)`)
          break
        }
        const tid = targetId(t)
        const file = pageStorePath(storeDir, tid)
        const store = loadJson(file, { target: t.name, posts: {} })
        const page = { name: t.name, tid, posts: 0, new: 0, hits: 0, low: false, fail: null }
        out.pages.push(page)
        lock.logUsage({ facebook: 1 }, 'open') // จดก่อนเปิด (ใต้กุญแจ) — โดนฆ่า/กุญแจหลุดกลางทางก็ยังนับ
        out.opened.facebook += 1
        let posts
        try {
          posts = await readFacebookPage({ target: t, cfg, oc, sleep, random })
          const few = Number(cfg.fb_low_posts ?? DEFAULTS.fb_low_posts)
          if (posts.length < few) {
            if (now() - t0 < NO_REREAD_MS) {
              say(`[social] ${t.name}: อ่านได้ ${posts.length} โพสต์ — เปิดใหม่ลองอีกรอบ`)
              await sleep(8000 + random() * 4000)
              const again = await readFacebookPage({ target: t, cfg, oc, sleep, random })
              if (again.length > posts.length) posts = again
            } else {
              out.result.push('budget')
            }
            page.low = posts.length < few
          }
        } catch (e) {
          if (e.name === 'Blocked') {
            lock.setBlocked(PLATFORM, e.message, today) // ให้ DVX พักด้วย (บัญชีเดียวกัน)
            out.result.push('blocked:facebook')
            out.status = 'blocked'
            page.fail = 'blocked'
            say(`⚠️ [social] ${e.message} — หยุดเลน Facebook ทันที (แจ้ง DVX ให้พักด้วยแล้ว 3 วัน)`)
            break
          }
          if (e.name === 'LostLock') throw e
          page.fail = String(e.message || e).slice(0, 160)
          out.warnings.push(`⚠️ [social] อ่าน ${t.name} ไม่สำเร็จ: ${page.fail}`)
          say(out.warnings.at(-1))
          continue
        }
        lock.clearBlocked(PLATFORM) // อ่านสำเร็จ = บัญชีกลับมาใช้ได้ (เขียนเฉพาะตอนมีแถว)
        const before = Object.keys(store.posts || {}).length
        const seen = mergePosts(store, posts, today)
        page.posts = seen.length
        page.new = Object.keys(store.posts).length - before
        prunePosts(store, today, Number(cfg.keep_days ?? DEFAULTS.keep_days))
        const hits = outliers(store, seen, today, cfg, scoring)
        page.hits = hits.length
        for (const h of hits) out.rows.push({ name: t.name, tid, file, key: h.key, ratio: h.ratio, row: ideaRow(t, store.posts[h.key], h, today, { audience }) })
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
    say(`⚠️ [social] ${e.message} — หยุดอ่านทันที · เพจที่อ่านแล้วยังเก็บ/เข้าคิวตามปกติ`)
  } finally {
    try {
      if (out.touched && lock.held) lock.logUsage({}, [...new Set(out.result)].join(',') || 'ok', { opened: out.opened })
    } catch { /* กุญแจหลุดแล้ว — ข้ามแถวสรุป ห้ามโยนออกจาก finally */ }
    lock.release() // ปล่อยเสมอ
  }
  if (!dryRun && out.touched) saveJson(path.join(storeDir, 'state.json'), { ...state, last_round: { day: today, status: out.status, opened: out.opened.facebook } })
  const fails = out.pages.filter((p) => p.fail).length
  const low = out.pages.filter((p) => p.low).length
  say(`[social] Facebook: เปิด ${out.opened.facebook} เพจ · โพสต์ ${out.pages.reduce((n, p) => n + p.posts, 0)} (ใหม่ ${out.pages.reduce((n, p) => n + p.new, 0)}) · แรงกว่าปกติ ${out.rows.length}${fails ? ` · ล้ม ${fails}` : ''}${low ? ` · ได้น้อยผิดปกติ ${low}` : ''}${dryRun ? ' · DRY RUN (ไม่เขียนคลัง/สถานะของเรา)' : ''}`)
  return out
}

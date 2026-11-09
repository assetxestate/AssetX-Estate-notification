// server/research/hook-lessons.js — เลนบทเรียน hook: ถอดสูตรของ "ของที่แรงจริง" ในตลาดอสังหา/การเงินไทย แล้วปรับน้ำหนักสูตรในตัวร่าง
//
// เจ้าของสั่ง 9 พ.ย. 2569: "รีเสิร์ชคลิปหรือคอนเทนต์บนโซเชียลที่เป็นไวรัล มาปรับประยุกต์ให้เป็นในแบบฉบับของเรา"
// แหล่ง (ใช้ของที่ระบบเก็บอยู่แล้ว ไม่เปิดเบราว์เซอร์ ไม่ใช้โควตา Facebook):
//  1. ชื่อคลิปล่าสุดของช่อง YouTube ที่เฝ้า (RSS · วิวเทียบค่ากลางของช่องเดียวกัน — ช่องใหญ่/เล็กเทียบกันได้)
//  2. บรรทัดแรกของโพสต์เพจ Facebook ที่ตัวเฝ้าเพจเก็บไว้ (รีแอค+คอมเมนต์+แชร์ เทียบค่ากลางของเพจเดียวกัน)
//  3. บรรทัดแรกของแอด Meta Ad Library (ยิงนาน = ผู้ลงโฆษณาจ่ายต่อ · ไม่มียอด จึงใช้จำนวนวันเทียบค่ากลาง)
// "แรงกว่าปกติ" = ≥ 2 เท่าของค่ากลาง · lift ของสูตร = สัดส่วนในตัวอย่างที่แรง ÷ สัดส่วนในตัวอย่างทั้งหมด
// เก็บเฉพาะในเครื่อง (.local/research/hooks/) — ข้อความของเพจ/ช่องอื่นไม่ขึ้นรีโปสาธารณะ และไม่ส่งเข้าพรอมต์ร่าง (ส่งแค่น้ำหนักสูตร → hooks.js lessonWeight)
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { parseYoutubeFeed, youtubeFeedUrl } from './parsers.js'
import { classifyHook } from './hooks.js'
import { scrub } from './pii.js'

export const OUTLIER_X = 2
export const LESSONS_MAX_AGE_DAYS = 7

export function median(xs = []) {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!s.length) return 0
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const round1 = (x) => Math.round(x * 10) / 10
const firstLine = (t) => String(t || '').split('\n').map((l) => l.trim()).find(Boolean) || ''
// ชื่อคลิปมักลงท้ายด้วย "| ชื่อช่อง" และแฮชแท็ก — ไม่ใช่ส่วนของ hook
export function cleanTitle(title = '') {
  return String(title || '').replace(/(^|\s)#[\p{L}\p{M}\p{N}_]+/gu, ' ').replace(/\s*\|[^|]*$/, '').replace(/\s+/g, ' ').trim()
}

// items = parseYoutubeFeed(...) ของช่องเดียว
export function youtubeSamples(items = [], channel = '') {
  const med = median(items.map((i) => i.views).filter((v) => v > 0))
  if (!med) return []
  return items.filter((i) => i.views > 0 && i.title).map((i) => ({ source: 'youtube', from: channel, text: cleanTitle(i.title), value: i.views, x: round1(i.views / med) }))
}

// json = ไฟล์ของตัวเฝ้าเพจ (.local/research/social/facebook/fb_*.json) · เพจที่มีโพสต์มียอดน้อยกว่า 4 โพสต์ไม่นับ (ค่ากลางเชื่อไม่ได้ เหมือนกติกาของตัวเฝ้าเพจ)
export function facebookSamples(json = {}, page = '') {
  const posts = Array.isArray(json.posts) ? json.posts : Object.values(json.posts || {})
  const score = (p) => (p.m?.reactions || 0) + 2 * (p.m?.comments || 0) + 3 * (p.m?.shares || 0)
  const scored = posts.filter((p) => p && p.caption && score(p) > 0)
  if (scored.length < 4) return []
  const med = median(scored.map(score))
  return scored.map((p) => ({ source: 'facebook', from: page, text: firstLine(p.caption), value: score(p), x: round1(score(p) / med) }))
}

// json = .local/research/ads/ads.json · ยิงนาน = last_seen − started (วัน)
// เฉพาะแอดที่พูดถึงบริการแบบเรา — คำค้น "จำนองบ้าน" พาแอดประกาศขายบ้าน/คอร์สนายหน้ามาด้วย ซึ่งยิงนานเพราะคนละธุรกิจ (9 พ.ย. 2569: 14 ใน 60 แอดที่ "ยิงนาน" เป็นประกาศขายบ้านของผู้ลงโฆษณารายเดียว)
export const AD_SERVICE_RE = /ขายฝาก|จำนอง|โฉนด|ไถ่ถอน|สินเชื่อ|เพิ่มวงเงิน|เงินทุน/
export function adSamples(json = {}) {
  const ads = Object.values(json.ads || {}).filter((a) => a && a.text && a.started && a.last_seen && AD_SERVICE_RE.test(a.text))
  const days = (a) => Math.max(0, Math.round((new Date(a.last_seen) - new Date(a.started)) / 864e5))
  const med = median(ads.map(days).filter((d) => d > 0))
  if (!med) return []
  return ads.filter((a) => days(a) > 0).map((a) => ({ source: 'ads', from: a.page || '', text: firstLine(a.text), value: days(a), x: round1(days(a) / med) }))
}

// สรุปเป็นบทเรียนต่อสูตร (ตัวเลขล้วน ไม่มีข้อความของใคร) · samples ที่ไม่มีข้อความหรือไม่มี x ไม่นับ
// กุญแจตัดซ้ำ: แหล่ง + 40 ตัวอักษรแรกหลังยุบช่องว่าง/อีโมจิ (แอดหลายเวอร์ชันของเจ้าเดียวกัน · คลิปที่อัปซ้ำ)
export function sampleKey(s = {}) {
  return `${s.source}|${String(s.text || '').replace(/[^ก-๙A-Za-z0-9]+/g, '').slice(0, 40)}`
}
// รวมตัวอย่างรอบนี้เข้ากับที่สะสมไว้ (RSS ให้แค่ 15 คลิปล่าสุดต่อช่อง — สะสมข้ามสัปดาห์บทเรียนถึงจะหนาขึ้น) · ตัวเดิมได้ค่าล่าสุด · เกิน max ตัดตัวเก่าสุด
export function mergeSamples(stored = [], fresh = [], { max = 3000, today = '' } = {}) {
  const map = new Map()
  for (const s of stored) if (s && s.text) map.set(sampleKey(s), s)
  for (const s of fresh) if (s && s.text) map.set(sampleKey(s), { ...(map.get(sampleKey(s)) || {}), ...s, seen: today || s.seen || '' })
  const all = [...map.values()]
  return all.length > max ? all.sort((a, b) => String(b.seen || '').localeCompare(String(a.seen || ''))).slice(0, max) : all
}

export function summarizeHookLessons(samples = [], { outlierX = OUTLIER_X, now = new Date() } = {}) {
  const unique = new Map()
  for (const s of samples) {
    if (!s || !s.text || !Number.isFinite(s.x)) continue
    const k = sampleKey(s)
    if (!unique.has(k) || unique.get(k).x < s.x) unique.set(k, s)
  }
  const rows = [...unique.values()].map((s) => ({ ...s, labels: classifyHook(s.text), hot: s.x >= outlierX }))
  const total = rows.length
  const hot = rows.filter((r) => r.hot).length
  const bySource = {}
  for (const r of rows) {
    bySource[r.source] ||= { n: 0, hot: 0 }
    bySource[r.source].n += 1
    if (r.hot) bySource[r.source].hot += 1
  }
  const ids = [...new Set(rows.flatMap((r) => r.labels))]
  const patterns = {}
  for (const id of ids) {
    const withIt = rows.filter((r) => r.labels.includes(id))
    const hotWith = withIt.filter((r) => r.hot).length
    const share = total ? withIt.length / total : 0
    const hotShare = hot ? hotWith / hot : 0
    const sources = {}
    for (const r of withIt) { sources[r.source] ||= { n: 0, hot: 0 }; sources[r.source].n += 1; if (r.hot) sources[r.source].hot += 1 }
    patterns[id] = {
      n: withIt.length,
      hot: hotWith,
      share: round1(share * 100),
      hot_share: round1(hotShare * 100),
      lift: share ? Math.round((hotShare / share) * 100) / 100 : null,
      median_x: round1(median(withIt.map((r) => r.x))),
      sources,
    }
  }
  // ตัวอย่างที่ไม่มีสูตรใดเลย — ถ้าเยอะ แปลว่าตัวถอดสูตรยังจับรูปแบบที่ตลาดใช้ไม่ครบ
  const unlabeled = rows.filter((r) => !r.labels.length)
  return {
    updated: now.toISOString(),
    outlier_x: outlierX,
    samples: { total, hot, by_source: bySource, unlabeled: unlabeled.length },
    patterns,
  }
}

// ── เก็บตัวอย่างจากของที่มีในเครื่อง + RSS ─────────────────────────────────────
// fetch = politeFetch ของ fetcher.js · channels = idea_sources.youtube.channels (ข้ามช่อง enabled:false)
export async function collectHookSamples({ fetch, channels = [], fbDir = '', adsFile = '', log = () => {} } = {}) {
  const samples = []
  const notes = []
  for (const ch of channels.filter((c) => c && c.channel_id && c.enabled !== false)) {
    if (!fetch) break
    const res = await fetch(youtubeFeedUrl(ch.channel_id))
    if (!res.ok) { notes.push(`YouTube ${ch.label}: ${res.error || res.status}`); continue }
    const got = youtubeSamples(parseYoutubeFeed(res.text), ch.label)
    samples.push(...got)
    log(`[hooks] YouTube ${ch.label}: ${got.length} คลิป`)
  }
  if (fbDir && existsSync(fbDir)) {
    for (const f of readdirSync(fbDir).filter((x) => x.endsWith('.json'))) {
      try {
        const got = facebookSamples(JSON.parse(readFileSync(path.join(fbDir, f), 'utf8')), f.replace(/\.json$/, ''))
        samples.push(...got)
      } catch (e) { notes.push(`Facebook ${f}: ${e.message}`) }
    }
  }
  if (adsFile && existsSync(adsFile)) {
    try { samples.push(...adSamples(JSON.parse(readFileSync(adsFile, 'utf8')))) } catch (e) { notes.push(`แอด: ${e.message}`) }
  }
  // ข้อความต้นทางผ่านตัวลบข้อมูลบุคคลก่อนเก็บ (บรรทัดแรกของโพสต์/แอดมีเบอร์/LINE ได้)
  return { samples: samples.map((s) => ({ ...s, text: scrub(s.text).slice(0, 200) })), notes }
}

// บรรทัดสรุปสำหรับ log / Telegram — สูตรที่ lift สูงสุด 5 อันดับ (ตัวอย่าง ≥ 5)
export function lessonsHeadline(lessons, nameOf = (id) => id) {
  if (!lessons?.patterns) return ''
  const top = Object.entries(lessons.patterns)
    .filter(([, p]) => p.n >= 5 && Number.isFinite(p.lift))
    .sort((a, b) => b[1].lift - a[1].lift)
    .slice(0, 5)
    .map(([id, p]) => `${nameOf(id)} ×${p.lift} (${p.hot}/${p.n})`)
  return top.join(' · ')
}

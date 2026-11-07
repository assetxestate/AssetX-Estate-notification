// เลนแอดคู่แข่งจาก Meta Ad Library (ขั้นที่ 8) — อ่านหน้าเว็บสาธารณะ facebook.com/ads/library โดยไม่ล็อกอิน (Chrome headless โปรไฟล์ชั่วคราว)
// เจ้าของเสนอ 6 พ.ย. 2569 "คัดเอาเฉพาะแอดที่มีเนื้อหาที่เป็นประโยชน์มาใช้งานและปรับปรุงต่อยอด" · เลือกทาง ก. (อ่านอัตโนมัติสัปดาห์ละครั้ง) 7 พ.ย. 2569
//
// หลักการ: แอดที่ "รันนาน" และ "มีหลายเวอร์ชัน" = ข้อเสนอ/มุมที่ตลาดตอบรับ (research/manual-checklist.md) → คัดเฉพาะแอดที่ให้ความรู้ (ขั้นตอน เอกสาร ข้อควรระวัง
// ค่าใช้จ่าย กฎหมาย) ไม่ใช่แอดเรต/ข้อเสนอล้วน → เข้าคิว marketing_ideas เป็น source social · subtype ad_library (ห้ามอ้างเพจ ลอกได้แค่แบบแผน)
// กติกาเดียวกับตัวเฝ้าเพจ: ข้อความผ่านตัวลบข้อมูลบุคคล (pii.js) ก่อนลงคลัง/ก่อนส่ง AI · เก็บแค่ข้อความ+ตัวเลข+รหัสแอด · ไม่แตะ Chrome profile Research · ไม่ถือกุญแจ browser ร่วม
// ฟังก์ชันคิดทั้งหมดเป็น pure function (เทสต์ได้) · ส่วนที่เปิด browser รับ launch/sleep ฉีดเข้ามา
import { scrub } from './pii.js'
import { scoreText, DEFAULT_SCORING, round1 } from './classify.js'
import { thaiDay } from './social-watch.js'

export const SUBTYPE = 'ad_library'
export const SOURCE = 'social'
export const LABEL_PREFIX = 'Meta Ad Library'

export const DEFAULTS = {
  country: 'TH',
  search_type: 'keyword_exact_phrase',
  cadence_days: 7,
  max_ads_per_phrase: 40,
  scroll_rounds: 2,
  wait_after_load_ms: 6000,
  between_phrases_ms: [4000, 8000],
  min_days_running: 14,
  min_text_chars: 80,
  max_ai_classify: 12,
  max_ideas_per_run: 6,
  max_in_queue: 6,
  keep_days: 180,
  browser: { channel: 'chrome', headless: true, locale: 'en-US', viewport: { width: 1280, height: 2000 }, timeout_ms: 60000 },
}

export function adLibraryUrl({ q, country = 'TH', searchType = 'keyword_exact_phrase' }) {
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${encodeURIComponent(country)}&q=${encodeURIComponent(q)}&search_type=${encodeURIComponent(searchType)}&media_type=all`
}

export const adUrl = (libraryId) => `https://www.facebook.com/ads/library/?id=${libraryId}`

// ── อ่านข้อความหน้า (innerText) เป็นการ์ดแอด ────────────────────────────────
// รูปใน innerText (UI อังกฤษ): "Library ID: 123" → "Started running on 1 Sep 2026" → "Platforms" → ("N ads use this creative and text" | "This ad has multiple versions")
// → "Open Drop-down" → "See ad details"/"See summary details" → <ชื่อเพจ> → "Sponsored" → ข้อความแอด … จนถึง "Library ID:" ถัดไป
const UI_LINE_RE = /^(Open Drop-down|Platforms|See (ad|summary) details|Sponsored|Learn more|Learn More|Send message|Send Message|Shop now|Shop Now|Sign up|Sign Up|Contact us|Contact Us|Get offer|Get quote|Book now|Apply now|Apply Now|Watch more|Download|Install now|Like Page|Get directions|Active|Inactive|This ad has multiple versions|\d+ ads use this creative and text|\d{1,2}:\d{2} \/ \d{1,2}:\d{2}|…|​+)$/i
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

// "1 Sep 2026" · "Sep 1, 2026" → "2026-09-01" (null ถ้าอ่านไม่ออก)
export function parseEnglishDate(text) {
  const s = String(text || '').trim()
  let m = s.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})$/)
  if (m) return isoFromParts(m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], m[1])
  m = s.match(/^([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4})$/)
  if (m) return isoFromParts(m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], m[2])
  return null
}
function isoFromParts(y, monthIndex, d) {
  if (monthIndex === undefined) return null
  const date = new Date(Date.UTC(Number(y), monthIndex, Number(d)))
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

export const daysBetween = (fromIso, toIso) => Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400e3)

export function parseAdLibraryText(text) {
  const clean = String(text || '').replace(/\r/g, '').replace(/[​-‏⁠﻿]/g, '')
  const chunks = clean.split(/(?=^Library ID:\s*\d+)/m).filter((c) => /^Library ID:\s*\d+/.test(c))
  const ads = []
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean)
    const libraryId = (lines[0].match(/^Library ID:\s*(\d+)/) || [])[1]
    if (!libraryId) continue
    let started = null
    let versions = 1
    let pageName = ''
    let sponsoredAt = -1
    for (let i = 1; i < lines.length; i += 1) {
      const l = lines[i]
      const s = l.match(/^Started running on (.+)$/i)
      if (s && !started) { started = parseEnglishDate(s[1]); continue }
      const v = l.match(/^(\d+) ads use this creative and text$/i)
      if (v) { versions = Math.max(versions, Number(v[1])); continue }
      if (/^See (ad|summary) details$/i.test(l) && lines[i + 1] && !pageName) { pageName = lines[i + 1]; continue }
      if (/^Sponsored$/i.test(l) && sponsoredAt < 0) { sponsoredAt = i; break }
    }
    const body = sponsoredAt >= 0 ? lines.slice(sponsoredAt + 1) : []
    const textLines = body.filter((l) => !UI_LINE_RE.test(l) && !/^https?:\/\//i.test(l) && !/^[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(l))
    const adText = textLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    ads.push({ libraryId, pageName, started, versions, text: adText })
  }
  return ads
}

// ── คัด "มีประโยชน์" (ให้ความรู้) vs แอดเรต/ข้อเสนอล้วน ─────────────────────────
const EDU_WORDS = ['ขั้นตอน', 'เอกสาร', 'วิธี', 'ข้อควรระวัง', 'ควรรู้', 'รู้ก่อน', 'เช็ก', 'เช็ค', 'ตรวจสอบ', 'ต่างกัน', 'ต่างจาก', 'คืออะไร', 'ข้อดี', 'ข้อเสีย', 'ค่าใช้จ่าย', 'ค่าธรรมเนียม', 'ภาษี', 'กฎหมาย', 'พ.ร.บ', 'สัญญา', 'สิทธิ', 'ไถ่ถอน', 'ไถ่คืน', 'ระวัง', 'มิจฉาชีพ', 'หลอก', 'ตัวอย่าง', 'คำถาม', 'ทำไม', 'เปรียบเทียบ', 'ความเสี่ยง', 'ราคาประเมิน', 'โฉนด', 'สำนักงานที่ดิน', 'กรมที่ดิน', 'ข้อแตกต่าง', 'เข้าใจผิด', 'ความรู้']
const PROMO_WORDS = ['อนุมัติ', 'วงเงิน', 'ดอกเบี้ย', 'ต่อเดือน', 'ทักเลย', 'ทักแชท', 'สนใจทัก', 'ติดต่อ', 'โทร', 'ไลน์', 'line', 'inbox', 'ด่วน', 'ไม่เช็ค', 'ไม่เช็ก', 'ไม่ต้องค้ำ', 'ไม่ดูบูโร', 'ไม่เช็คบูโร', 'รับเงินใน', 'ได้เงินใน', 'เงินก้อน', 'โปรโมชั่น', 'ลดดอก', 'จ่ายดอกถูก']
const countHits = (text, words) => words.filter((w) => text.toLowerCase().includes(w.toLowerCase())).length
// โพสต์รีวิว/เคสลูกค้า/ปิดดีล/อวยพร/รับสมัครทีม — มีคำความรู้ปนเยอะแต่ไม่ใช่เนื้อหาที่เอามาต่อยอดได้ (ปรับจูนกับแอดจริง 74 ชิ้น 7 พ.ย. 2569)
const NOISE_RE = /ขอบพระคุณ|ขอบคุณ(ลูกค้า|นายหน้า|ทุกท่าน)|ความไว้วางใจ|รีวิวจาก|เคสจริง|ปิดดีล|จดจริง|จ่ายจริง|วันนี้(มา)?ทำ(ขายฝาก|จำนอง)|รับเข้าอีก|ต้อนรับปีใหม่|สวัสดีปีใหม่|เปลี่ยนชีวิตการทำงาน|รายได้ก้อนโต|ร่วมงานกับเรา|รับสมัคร(ทีม|พนักงาน|นายหน้า)|เสียงสะท้อน|ลูกค้าจากจังหวัด/
// ฮุคแบบให้ความรู้ (คำถาม/เช็กลิสต์/เตือนก่อนเซ็น) — ผ่านได้แม้คำความรู้ไม่เยอะ ถ้าคำขายไม่มากกว่า
const EXPLAINER_RE = /ได้(อยู่)?ไหม|ได้มั้ย|คืออะไร|ต่างกัน|ต่างจาก|อย่างไร|ยังไง|อย่าเพิ่ง|ก่อนเซ็น|ก่อนทำ(สัญญา|ขายฝาก|จำนอง)|เช็ก\s*\d|\d+\s*(เรื่อง|ข้อ|สัญญาณ|ขั้นตอน)|รู้ก่อน|ข้อควรระวัง|เข้าใจผิด|ความจริง/

export function classifyHeuristic(text = '') {
  const t = String(text || '')
  const edu = countHits(t, EDU_WORDS)
  const promo = countHits(t, PROMO_WORDS)
  const percentLines = (t.match(/\d+(\.\d+)?\s*%/g) || []).length
  const noise = NOISE_RE.test(t)
  const hook = EXPLAINER_RE.test(t)
  const useful = t.length >= 80 && !noise && ((edu >= 3 && promo * 2 <= edu && percentLines <= 1) || (hook && edu >= 2 && promo <= edu))
  return { useful, edu, promo, percentLines, noise, hook }
}

// แอดเดียวกันหลาย Library ID (ครีเอทีฟเดิมยิงหลายชุด) — เทียบ 120 ตัวอักษรแรกหลังยุบช่องว่าง
export const textKey = (text) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120)

export function buildClassifyPrompt(ads, brand = {}) {
  const system = [
    `คุณคือผู้ช่วยทีมคอนเทนต์ของ "${brand.brand || 'AssetX Estate'}" (ธุรกิจขายฝาก/จำนอง/นายหน้าอสังหาริมทรัพย์ไทย) กำลังคัดแอดของคู่แข่งจาก Meta Ad Library`,
    'หน้าที่: ดูข้อความแอดแต่ละชิ้น แล้วตอบว่าแอดนั้น "ให้ความรู้ที่เอามาต่อยอดได้" หรือ "ขายของล้วน"',
    '- useful = true เมื่อแอดอธิบายขั้นตอน เอกสาร ค่าใช้จ่าย ข้อควรระวัง ข้อแตกต่าง กฎหมาย หรือตอบคำถามที่ลูกค้าถามจริง (แม้จะมีการขายปนอยู่บ้าง)',
    '- useful = false เมื่อแอดมีแต่ข้อเสนอ เรต วงเงิน ความเร็ว ช่องทางติดต่อ หรือคำโฆษณาทั่วไป',
    '- โพสต์รีวิวลูกค้า เคสปิดดีล คำอวยพร รับสมัครทีม หรือคำปลุกใจทั่วไป = useful false',
    '- topic = หัวข้อความรู้ที่แอดนั้นพูด (ไม่เกิน 12 คำ ภาษาไทย ไม่เอ่ยชื่อเพจ) · reason = เหตุผล 1 ประโยคสั้น ๆ',
    'ห้ามแต่งเนื้อหาเพิ่ม · ตอบเป็น JSON object เดียวเท่านั้น ไม่มีข้อความนำหรือตาม ไม่มี markdown: {"ads":[{"id":"<libraryId>","useful":true,"topic":"…","reason":"…"}]}',
  ].join('\n')
  const prompt = ads.map((a, i) => `[${i + 1}] id: ${a.libraryId}\nข้อความ: ${scrub(a.text).replace(/\s+/g, ' ').slice(0, 420)}`).join('\n\n')
  return { system, prompt: `แอดที่ต้องคัด ${ads.length} ชิ้น (ตอบครบทุก id):\n\n${prompt}` }
}

export function parseClassify(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.ads) ? data.ads : null
  if (!list) return null
  const out = new Map()
  for (const item of list) {
    const id = String(item?.id ?? '').trim()
    if (!/^\d+$/.test(id)) continue
    out.set(id, { useful: item.useful === true || String(item.useful).toLowerCase() === 'true', topic: scrub(String(item.topic || '')).slice(0, 80), reason: scrub(String(item.reason || '')).slice(0, 160) })
  }
  return out
}

// ── คลัง (.local/research/ads/ads.json) ─────────────────────────────────────
export function mergeAds(store, ads, phrase, today) {
  if (!store.ads || typeof store.ads !== 'object') store.ads = {}
  let added = 0
  for (const ad of ads) {
    if (!ad.libraryId || !ad.text) continue
    const text = scrub(ad.text).slice(0, 700)
    const prev = store.ads[ad.libraryId]
    if (!prev) {
      store.ads[ad.libraryId] = { first_seen: today, last_seen: today, started: ad.started || null, versions: ad.versions || 1, page: scrub(ad.pageName || '').slice(0, 120), text, phrases: [phrase], idea: null }
      added += 1
      continue
    }
    prev.last_seen = today
    if (ad.started && !prev.started) prev.started = ad.started
    prev.versions = Math.max(prev.versions || 1, ad.versions || 1)
    if (text.length > (prev.text || '').length) prev.text = text
    if (!prev.phrases.includes(phrase)) prev.phrases.push(phrase)
  }
  return added
}

export function pruneAds(store, today, keepDays = 180) {
  for (const [id, rec] of Object.entries(store.ads || {})) {
    if (daysBetween(rec.last_seen || today, today) > keepDays) delete store.ads[id]
  }
}

// คะแนน: อายุแอด (ยิ่งรันนานยิ่งน่าเชื่อว่าได้ผล) + หลายเวอร์ชัน + AI ยืนยันว่าให้ความรู้ · อยู่ช่วงเดียวกับเลนอื่น (เพดาน 6.0 ไม่แซงเลนทางการ)
export function scoreAd({ days = 0, versions = 1, aiUseful = false }) {
  return round1(Math.min(3.8 + Math.min(Math.max(days, 0), 180) / 180 * 1.4 + (versions >= 3 ? 0.3 : 0) + (aiUseful ? 0.5 : 0), 6.0))
}

// ผู้สมัครจากคลัง: ยังไม่เคยเสนอ · รันนาน ≥ min_days · ข้อความยาวพอ · ผ่าน topic gate อสังหาฯ · ผ่านตัวคัดเบื้องต้น
export function pickCandidates(store, { today, cfg = {}, scoring = DEFAULT_SCORING }) {
  const minDays = Number(cfg.min_days_running ?? DEFAULTS.min_days_running)
  const minChars = Number(cfg.min_text_chars ?? DEFAULTS.min_text_chars)
  const out = []
  // ครีเอทีฟเดียวกันที่เคยเสนอแล้ว (ไม่ว่ารหัสไหน) ไม่เสนอซ้ำ
  const proposedTexts = new Set(Object.values(store.ads || {}).filter((r) => r.idea).map((r) => textKey(r.text)))
  for (const [libraryId, rec] of Object.entries(store.ads || {})) {
    if (rec.idea) continue
    if (!rec.text || rec.text.length < minChars) continue
    if (proposedTexts.has(textKey(rec.text))) continue
    const days = rec.started ? daysBetween(rec.started, today) : 0
    if (days < minDays) continue
    const { gated, hits } = scoreText(rec.text, scoring)
    if (!gated) continue
    const heuristic = classifyHeuristic(rec.text)
    if (!heuristic.useful) continue
    out.push({ libraryId, rec, days, hits, heuristic })
  }
  out.sort((a, b) => (b.days + 30 * ((b.rec.versions || 1) - 1)) - (a.days + 30 * ((a.rec.versions || 1) - 1)))
  // ครีเอทีฟซ้ำในรอบเดียวกัน เก็บตัวที่รันนาน/หลายเวอร์ชันที่สุด (ตัวแรกหลังเรียง)
  const seen = new Set()
  return out.filter((p) => { const k = textKey(p.rec.text); if (seen.has(k)) return false; seen.add(k); return true })
}

// แถวสำหรับ marketing_ideas — source social (ห้ามอ้างเพจ) · subtype ad_library · summary อยู่ในรูปเดียวกับตัวเฝ้าเพจ (บรรทัดตัวเลข · “ข้อความ” · คำใบ้ · บรรทัดกำกับ)
// ให้ขั้นร่างโพสต์อ่านข้อความแอดเป็นข้อเท็จจริง (drafts.js socialCaption) และไม่ส่งตัวเลข/ชื่อเพจให้ AI
export function adIdeaRow({ libraryId, rec, days, ai = null }, today, { audience = null } = {}) {
  const raw = scrub(rec.text || '')
  const text = raw.replace(/\s+/g, ' ').trim()
  // หัวเรื่อง = บรรทัดแรกของแอด (ก่อนยุบบรรทัด) — ตัวเฝ้าเพจใช้วิธีเดียวกัน
  const head = (raw.split('\n').map((s) => s.trim()).find(Boolean) || '').replace(/^[^\p{L}\p{N}]+/u, '').split(/[!?]/)[0].trim().slice(0, 90) || '(ไม่มีข้อความ)'
  const versions = Number(rec.versions || 1)
  const phrase = (rec.phrases || [])[0] || ''
  const lines = [
    `📢 แอด Meta รันตั้งแต่ ${rec.started ? thaiDay(rec.started) : 'ไม่ทราบวัน'} (${days} วัน · ${versions} เวอร์ชัน · เจอจากคำค้น "${phrase}")${ai?.topic ? ` · หัวข้อ: ${ai.topic}` : ''}`,
    `“${text.slice(0, 300)}${text.length > 300 ? '…' : ''}”`,
    'กลุ่มเพจ: คู่แข่ง — แอดที่รันนานคือข้อเสนอ/มุมที่ตลาดตอบรับ ถอดแบบแผน (ฮุค โครง หัวข้อที่ตอบคำถามลูกค้า) แล้วทำมุมของเราด้วยบริการจริง · เรต วงเงิน ความเร็ว และข้อเสนอของเขาเป็นโฆษณา ห้ามลอก ห้ามเอ่ยชื่อเพจ',
    '(Meta Ad Library · อ่านหน้าเว็บสาธารณะโดยไม่ล็อกอิน · ตัวเลขของเขาห้ามลงโพสต์เรา)',
  ]
  return {
    status: 'new',
    source: SOURCE,
    source_label: `${LABEL_PREFIX} · ${scrub(rec.page || 'เพจไม่ระบุ')}`.slice(0, 120),
    subtype: SUBTYPE,
    title: scrub(`แอดคู่แข่งรันนาน ${days} วัน — ${head}`).slice(0, 300),
    summary: scrub(lines.join('\n')).slice(0, 2000),
    url: adUrl(libraryId),
    score: scoreAd({ days, versions, aiUseful: Boolean(ai?.useful) }),
    audience: Array.isArray(audience) && audience.length ? audience : null,
    service_area: null,
    event_date: null,
    event_key: null,
    external_key: `ads:fb:${libraryId}`.slice(0, 200),
    related_sku: null,
  }
}

export function dueForRun(state = {}, today, cadenceDays = 7) {
  if (!state.last_run_day) return true
  return daysBetween(state.last_run_day, today) >= Number(cadenceDays)
}

// ── อ่านหน้า Ad Library จริง (ฉีด launch/sleep ให้เทสต์ได้) ─────────────────────
// คืน { ads, status, loginWall, results } · ไม่โยนเมื่อหน้าตอบ 403 แต่ยังโหลดเนื้อหา (เจอจริง 6 พ.ย. 2569) · ไม่มีการ์ดเลย = คืน [] ให้ตัวรันบันทึกคำเตือน
export async function readAdLibraryPhrase({ q, cfg = {}, launch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {} }) {
  const b = { ...DEFAULTS.browser, ...(cfg.browser || {}) }
  const url = adLibraryUrl({ q, country: cfg.country || DEFAULTS.country, searchType: cfg.search_type || DEFAULTS.search_type })
  const browser = await launch({ channel: b.channel, headless: b.headless !== false })
  try {
    const ctx = await browser.newContext({ locale: b.locale, viewport: b.viewport })
    const page = await ctx.newPage()
    let status = null
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: Number(b.timeout_ms || 60000) })
      status = res?.status() ?? null
    } catch (e) {
      log(`[ads] "${q}": เปิดหน้าไม่สำเร็จ ${e.message}`)
      return { ads: [], status: null, loginWall: false, results: '', error: e.message }
    }
    await sleep(Number(cfg.wait_after_load_ms ?? DEFAULTS.wait_after_load_ms))
    for (const label of ['Decline optional cookies', 'Allow all cookies', 'Close']) {
      const btn = page.getByRole('button', { name: label }).first()
      if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); await sleep(1500) }
    }
    const rounds = Number(cfg.scroll_rounds ?? DEFAULTS.scroll_rounds)
    for (let i = 0; i < rounds; i += 1) { await page.mouse.wheel(0, 1800); await sleep(2500) }
    const text = await page.evaluate(() => document.body.innerText)
    const finalUrl = page.url()
    const loginWall = /\/login|checkpoint/.test(finalUrl) || (/Log in to Facebook|Log into Facebook|You must log in/i.test(text) && !/Library ID/i.test(text))
    const ads = parseAdLibraryText(text).slice(0, Number(cfg.max_ads_per_phrase ?? DEFAULTS.max_ads_per_phrase))
    const results = (text.match(/~?\d[\d,]*\s+results?/i) || [])[0] || ''
    return { ads, status, loginWall, results }
  } finally {
    await browser.close().catch(() => {})
  }
}

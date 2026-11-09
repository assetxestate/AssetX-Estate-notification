// ตัวเก็บไอเดีย (idea_collector) — รันทีละเลน เลนพังไม่ล้มทั้งรอบ · ทุกเลนคืนแถวรูปเดียวกัน
// ลำดับ: เลน → ตรวจ subtype → ลบข้อมูลบุคคล → คะแนน/กรอง → รวมข่าวซ้ำตามเหตุการณ์ → กันซ้ำ (ทุก status) → cap ต่อ (source, subtype) นับรวมคิว
// ไม่มี I/O ของฐานข้อมูลในไฟล์นี้: รับ existing (กุญแจ/คิว) เข้ามา คืน rows ให้ store บันทึก → เทสต์ได้ด้วย fetcher ปลอม
import {
  parseRss, parseYoutubeFeed, parseGnewsSitemap, parseBotMpc, parseDolNews, parsePantipTagNextData, parseCkanPackage,
  googleNewsRssUrl, youtubeFeedUrl, PROCUREMENT_RE,
} from './parsers.js'
import {
  classifySubtype, scoreText, freshnessBonus, ageDays, titleDropped, sourceDropped, pantipScore, youtubeScore,
  normalizeUrl, eventKey, isoDate, DEFAULT_SUBTYPE_RULES, DEFAULT_SCORING, round1,
} from './classify.js'
import { scrub } from './pii.js'
import { calendarIdeas, inMpcWindow } from './calendar.js'
import { leadSignals } from './internal.js'
import { fitsPageAudience } from './audience.js'

const DAY_MS = 86400000
const DEFAULT_CAP = 3

export function withAreaWords(scoring = DEFAULT_SCORING, serviceArea = []) {
  const weights = { ...(scoring.weights || DEFAULT_SCORING.weights) }
  const area = weights.area || { w: 1.5, words: [] }
  const words = [...new Set([...(area.words || []), ...(Array.isArray(serviceArea) ? serviceArea : [])])].filter(Boolean)
  return { ...DEFAULT_SCORING, ...scoring, weights: { ...weights, area: { ...area, words } } }
}

// cadence: daily (ค่าเริ่มต้น) · weekly · monthly · mpc_window — ตัดสินจาก "รันล่าสุดเมื่อไหร่" ไม่ใช่วันในสัปดาห์ (เปิดเครื่องสายก็รันชดเชย)
export function cadenceDue(cadence = 'daily', now = new Date(), lastRun = null, { mpc = false } = {}) {
  if (cadence === 'mpc_window') return mpc
  if (!lastRun) return true
  const last = new Date(lastRun)
  if (Number.isNaN(last.getTime())) return true
  const days = (now.getTime() - last.getTime()) / DAY_MS
  if (cadence === 'weekly') return days >= 6.5
  if (cadence === 'monthly') return days >= 27
  return days >= 0.5
}

function listOf(section) {
  if (Array.isArray(section)) return section
  if (section && Array.isArray(section.items)) return section.items
  return []
}

function cleanSubtypes(subtypes = {}) {
  const out = {}
  for (const [key, value] of Object.entries(subtypes)) if (!key.startsWith('_') && value && typeof value === 'object') out[key] = value
  return out
}

function requireGroupOk(hits, groups) {
  if (!Array.isArray(groups) || !groups.length) return true
  return groups.some((group) => hits[group] && hits[group].length)
}

function pantipGateOk(hits, categories, allowed) {
  if (hits.pain?.length || hits.transaction?.length || hits.asset?.length || hits.policy?.length) return true
  const cats = (categories || []).map((c) => String(c).toLowerCase())
  return (allowed || []).some((c) => cats.includes(String(c).toLowerCase()))
}

function pantipTopicId(link) {
  const m = /\/topic\/(\d+)/.exec(String(link || ''))
  return m ? m[1] : null
}

function keyForNews(prefix, link) {
  return `${prefix}:${normalizeUrl(link)}`.slice(0, 500)
}

export async function collectIdeas({
  cfg,
  brand = {},
  calendar = { events: [] },
  fetcher,
  now = new Date(),
  existing = { keys: new Set(), eventKeys: new Map(), queueCounts: new Map() },
  leads = [],
  state = {},
  log = () => {},
}) {
  const scoring = withAreaWords(cfg.scoring, brand.service_area)
  const rules = cfg.subtype_rules?.rules || DEFAULT_SUBTYPE_RULES
  const subtypes = cleanSubtypes(cfg.subtypes)
  const decisions = cfg.owner_decisions || {}
  const laneLast = state.lane_last_run || {}
  const mpc = inMpcWindow(calendar, now)
  const report = { lanes: [], warnings: [], candidates: 0, accepted: 0, skipped: { duplicate: 0, event: 0, cap: 0, score: 0, subtype: 0, gate: 0, stale: 0, audience: 0 }, ranLanes: [] }
  const candidates = []

  const lane = async (name, key, label, fn) => {
    const entry = { lane: name, key, label, status: 'ok', fetched: 0, kept: 0, note: '' }
    try {
      const result = await fn(entry)
      if (result === 'skipped') entry.status = 'skipped'
      else report.ranLanes.push(key)
    } catch (error) {
      entry.status = 'error'
      entry.note = error?.message || String(error)
      report.warnings.push(`⚠️ ${label}: ${entry.note}`)
    }
    report.lanes.push(entry)
    return entry
  }

  const fetchText = async (entry, url) => {
    const res = await fetcher(url)
    if (res.blocked) { entry.status = 'blocked'; entry.note = `HTTP ${res.status} (บล็อก/จำกัด — ข้ามรอบนี้ ห้ามลองเลี่ยง)`; report.warnings.push(`⚠️ ${entry.label}: ถูกบล็อก ${res.status}`); return null }
    if (!res.ok) { entry.status = 'error'; entry.note = res.error || `HTTP ${res.status}`; report.warnings.push(`⚠️ ${entry.label}: ${entry.note}`); return null }
    if (!res.text || !res.text.trim()) { entry.status = 'empty'; entry.note = 'ไม่มีเนื้อหา'; return null }
    return res.text
  }

  const push = (row) => { candidates.push(row); return row }

  // ── Google News RSS (หมวด ⚠️) ─────────────────────────────────────────────
  const newsQueries = listOf(cfg.news_queries)
  const maxPerQuery = Number(cfg.news_queries?.max_items_per_query || 8)
  for (const q of newsQueries) {
    const key = `gnews:${q.q}`
    await lane('news', key, `Google News "${q.q}"`, async (entry) => {
      if (decisions.google_news_rss?.allowed !== true) { entry.note = 'ยังไม่ได้รับอนุมัติ'; return 'skipped' }
      if (!cadenceDue(q.cadence, now, laneLast[key], { mpc })) { entry.note = `ยังไม่ถึงรอบ (${q.cadence})`; return 'skipped' }
      const text = await fetchText(entry, googleNewsRssUrl(q.q, q.when_days))
      if (!text) return
      const items = parseRss(text).slice(0, maxPerQuery)
      entry.fetched = items.length
      for (const item of items) {
        if (q.drop && new RegExp(q.drop, 'i').test(item.title)) continue
        if (titleDropped(item.title, scoring.title_drop) || sourceDropped(item.sourceName, scoring.source_drop)) continue
        const age = ageDays(item.published, now)
        if (age === null || age > Number(q.when_days || 14)) { report.skipped.stale += 1; continue }
        const { score, hits, gated } = scoreText(item.title, scoring)
        if (!gated) { report.skipped.gate += 1; continue }
        entry.kept += 1
        push({
          source: 'news', source_label: item.sourceName || 'Google News', subtype: q.subtype || classifySubtype(item.title, rules),
          title: item.title, summary: '', url: item.link, published: item.published,
          score: round1(score + freshnessBonus(item.published, now)), policyHits: hits.policy || [],
          external_key: keyForNews('news', item.link), needsEvent: true, minScore: true,
        })
      }
    })
  }

  // ── ฟีด/หน้าเว็บที่ robots ไม่ห้าม ────────────────────────────────────────
  for (const feed of listOf(cfg.feeds)) {
    if (feed.enabled === false) continue
    await lane(feed.kind, `feed:${feed.key}`, feed.label || feed.key, async (entry) => {
      if (!cadenceDue(feed.cadence, now, laneLast[`feed:${feed.key}`], { mpc })) { entry.note = `ยังไม่ถึงรอบ (${feed.cadence})`; return 'skipped' }
      const text = await fetchText(entry, feed.url)
      if (!text) return
      const maxAge = Number(subtypes[feed.subtype]?.max_age_days || 30)

      if (feed.kind === 'rss' || feed.kind === 'gnews_sitemap') {
        const items = feed.kind === 'rss' ? parseRss(text) : parseGnewsSitemap(text)
        entry.fetched = items.length
        const pathKeep = feed.path_keep ? new RegExp(feed.path_keep, 'i') : null
        for (const item of items) {
          const link = item.link
          if (!link || !item.title) continue
          if (pathKeep && !pathKeep.test(link)) continue
          if (feed.keep_category && !(item.categories || []).some((c) => c.includes(feed.keep_category))) continue
          if (titleDropped(item.title, scoring.title_drop)) continue
          if ((feed.source === 'official' || feed.source === 'auction') && PROCUREMENT_RE.test(item.title)) continue
          const age = ageDays(item.published, now)
          if (age !== null && age > maxAge) { report.skipped.stale += 1; continue }
          const { score, hits, gated } = scoreText(`${item.title} ${(item.categories || []).join(' ')}`, scoring)
          const isPantip = /pantip\.com/.test(link)
          const ok = feed.source === 'community'
            ? (requireGroupOk(hits, feed.require_group) && pantipGateOk(hits, item.categories, scoring.pantip_categories))
            : (requireGroupOk(hits, feed.require_group) && (gated || feed.source === 'auction'))
          if (!ok) { report.skipped.gate += 1; continue }
          entry.kept += 1
          const topicId = isPantip ? pantipTopicId(link) : null
          const prefix = feed.source === 'auction' ? 'sam' : feed.source === 'community' ? 'pt' : 'news'
          push({
            source: feed.source, source_label: feed.label || item.sourceName || item.publication || '', subtype: feed.subtype || classifySubtype(item.title, rules),
            title: item.title, summary: '', url: link, published: item.published,
            score: round1(Math.max(score, feed.source === 'auction' ? 2.0 : 0) + freshnessBonus(item.published, now)), policyHits: hits.policy || [],
            external_key: topicId ? `pt:${topicId}` : keyForNews(prefix, link), needsEvent: feed.source !== 'community', minScore: true,
          })
        }
        return
      }

      if (feed.kind === 'html_bot_mpc') {
        const items = parseBotMpc(text)
        entry.fetched = items.length
        for (const item of items) {
          const age = ageDays(item.published, now)
          if (age !== null && age > maxAge) { report.skipped.stale += 1; continue }
          entry.kept += 1
          push({
            source: 'official', source_label: feed.label || 'ธนาคารแห่งประเทศไทย', subtype: feed.subtype || 'rate',
            title: `ธปท.: ${item.title}`, summary: 'แถลงข่าวผลการประชุม กนง. จากตารางกำหนดการประชุมของ ธปท. · อ่านมติและเหตุผลจากลิงก์ก่อนเขียน · ห้ามทำนายทิศทางดอกเบี้ย',
            url: item.link, published: item.published, score: round1(5.0 + freshnessBonus(item.published, now)), policyHits: ['กนง.'],
            external_key: `bot:mpc:${normalizeUrl(item.link)}`, needsEvent: true, minScore: false,
          })
        }
        return
      }

      if (feed.kind === 'html_dol') {
        const items = parseDolNews(text)
        entry.fetched = items.length
        for (const item of items) {
          if (PROCUREMENT_RE.test(item.title) || titleDropped(item.title, scoring.title_drop)) continue
          const age = ageDays(item.published, now)
          if (age !== null && age > Number(subtypes.law?.max_age_days || 90)) { report.skipped.stale += 1; continue }
          const { score, hits, gated } = scoreText(item.title, scoring)
          if (!gated) { report.skipped.gate += 1; continue }
          entry.kept += 1
          const subtype = classifySubtype(item.title, rules)
          push({
            source: 'official', source_label: feed.label || 'กรมที่ดิน', subtype: subtype === 'market' ? 'law' : subtype,
            title: item.title, summary: '', url: item.link, published: item.published,
            score: round1(score + 1.0 + freshnessBonus(item.published, now)), policyHits: hits.policy || [],
            external_key: `dol:${normalizeUrl(item.link)}`, needsEvent: true, minScore: false,
          })
        }
        return
      }

      if (feed.kind === 'pantip_tag') {
        const topics = parsePantipTagNextData(text)
        entry.fetched = topics.length
        const ranked = []
        for (const topic of topics) {
          const age = ageDays(topic.published, now)
          if (age !== null && age > maxAge) { report.skipped.stale += 1; continue }
          const { hits } = scoreText(`${topic.title} ${(topic.tags || []).join(' ')}`, scoring)
          if (!pantipGateOk(hits, topic.tags, scoring.pantip_categories)) { report.skipped.gate += 1; continue }
          ranked.push({ topic, score: pantipScore(topic.views, topic.comments) })
        }
        ranked.sort((a, b) => b.score - a.score)
        for (const { topic, score } of ranked.slice(0, Number(feed.max_items || 5))) {
          entry.kept += 1
          push({
            source: 'community', source_label: feed.label || 'Pantip', subtype: feed.subtype || 'community_q',
            title: topic.title, summary: '', url: topic.link, published: topic.published, score,
            external_key: `pt:${topic.topicId}`, needsEvent: false, minScore: true,
          })
        }
        return
      }

      if (feed.kind === 'ckan') {
        const latest = parseCkanPackage(text)
        entry.fetched = latest ? 1 : 0
        if (!latest) { entry.status = 'empty'; entry.note = 'ไม่พบ resource'; return }
        const month = latest.monthKey || isoDate(now).slice(0, 7)
        entry.kept = 1
        push({
          source: 'auction', source_label: feed.label || 'กรมบังคับคดี', subtype: feed.subtype || 'auction_npa',
          title: `กรมบังคับคดี: ข้อมูลทรัพย์ขายทอดตลาดชุด ${feed.package || 'led'} อัปเดตเดือน ${month}`,
          summary: `ชุดข้อมูลเปิด (CC BY-NC) อัปเดต ${latest.lastModified ? latest.lastModified.slice(0, 10) : month} · ไฟล์ล่าสุด: ${latest.url} · ใช้วิเคราะห์แนวโน้มภายในพร้อมอ้าง "ที่มา: กรมบังคับคดี" · ตัวเลขห้ามลงโพสต์การตลาดจนกว่าจะได้อนุญาตเป็นหนังสือ`,
          url: latest.url, published: latest.lastModified, score: 4.0,
          external_key: `led:${feed.package || 'led'}:${month}`, needsEvent: false, minScore: false,
        })
        return
      }

      entry.status = 'error'
      entry.note = `ไม่รู้จัก kind "${feed.kind}"`
      report.warnings.push(`⚠️ ${feed.label || feed.key}: ${entry.note}`)
    })
  }

  // ── YouTube channel RSS (หมวด ⚠️) ─────────────────────────────────────────
  const yt = cfg.youtube || {}
  for (const channel of yt.channels || []) {
    if (channel.enabled === false) continue
    await lane('youtube', `yt:${channel.channel_id}`, `YouTube ${channel.label}`, async (entry) => {
      if (decisions.youtube_rss?.allowed !== true) { entry.note = 'ยังไม่ได้รับอนุมัติ'; return 'skipped' }
      const text = await fetchText(entry, youtubeFeedUrl(channel.channel_id))
      if (!text) return
      const videos = parseYoutubeFeed(text)
      entry.fetched = videos.length
      const ranked = []
      for (const video of videos) {
        const age = ageDays(video.published, now)
        if (age === null || age > Number(yt.max_age_days || 7)) { report.skipped.stale += 1; continue }
        if (titleDropped(video.title, scoring.title_drop)) continue
        const { hits, gated } = scoreText(video.title, scoring)
        const ok = channel.require_group ? requireGroupOk(hits, channel.require_group) : gated
        if (!ok) { report.skipped.gate += 1; continue }
        ranked.push({ video, hits, score: youtubeScore(video.views, video.published, now) })
      }
      ranked.sort((a, b) => b.score - a.score)
      for (const { video, hits, score } of ranked.slice(0, Number(yt.max_per_channel || 3))) {
        entry.kept += 1
        push({
          source: 'youtube', source_label: channel.label, subtype: channel.subtype || classifySubtype(video.title, rules),
          title: video.title, summary: `⚠️ ยังไม่รู้เนื้อหาจริงของคลิป (ยังไม่ได้ถอดคำบรรยาย) — ห้ามเดาเนื้อหาจากชื่อคลิป · ช่องประเภท ${channel.kind || '-'} · ยอดดูตอนเก็บ ${video.views}`,
          url: video.link, published: video.published, score, policyHits: hits.policy || [],
          external_key: `yt:${video.videoId}`, needsEvent: false, minScore: true,
        })
      }
    })
  }

  // ── สัญญาณภายใน + ปฏิทิน ─────────────────────────────────────────────────
  await lane('internal', 'internal:leads', 'สัญญาณจากลีด', async (entry) => {
    const rows = leadSignals(leads, now)
    entry.fetched = Array.isArray(leads) ? leads.length : 0
    entry.kept = rows.length
    for (const row of rows) push({ ...row, needsEvent: false, minScore: false })
  })
  await lane('calendar', 'calendar', 'ปฏิทินเหตุการณ์', async (entry) => {
    const rows = calendarIdeas(calendar, now)
    entry.fetched = (calendar?.events || []).length
    entry.kept = rows.length
    for (const row of rows) push({ ...row, subtype: row.subtype || 'calendar', needsEvent: false, minScore: false })
  })

  // ── หลังเก็บ: ตรวจ subtype → PII → คะแนนขั้นต่ำ → event → กันซ้ำ → cap ─────
  report.candidates = candidates.length
  const minScore = Number(scoring.min_score ?? 1.0)
  const prepared = []
  for (const row of candidates) {
    if (!subtypes[row.subtype]) { report.skipped.subtype += 1; report.warnings.push(`⚠️ subtype "${row.subtype}" ไม่อยู่ในคอนฟิก (${row.title.slice(0, 40)})`); continue }
    if (row.minScore && row.score < minScore) { report.skipped.score += 1; continue }
    const title = scrub(row.title).slice(0, 300)
    const summary = scrub(row.summary || '').slice(0, 2000)
    const audience = Array.isArray(row.audience) && row.audience.length ? row.audience : (subtypes[row.subtype].audience || null)
    // ไม่ใช่เรื่องของคนอ่านของเพจ (เช่น ข่าวตลาด B/C/D · มาตรการค่าโอนของผู้ซื้อ) → ไม่เข้าคิว (audience.js · เจ้าของเลือกกลุ่ม A อย่างเดียว 9 พ.ย. 2569)
    if (!fitsPageAudience(audience, brand)) { report.skipped.audience += 1; continue }
    const event_key = row.event_key || (row.needsEvent ? eventKey({ subtype: row.subtype, publishedAt: row.published, title, policyHits: row.policyHits || [] }, now) : null)
    prepared.push({ ...row, title, summary, audience: audience && audience.length ? audience : null, event_key })
  }

  // รวมข่าวซ้ำตามเหตุการณ์ในรอบ: เก็บชิ้นคะแนนสูงสุด ที่เหลือต่อท้าย summary
  prepared.sort((a, b) => b.score - a.score)
  const byEvent = new Map()
  const merged = []
  for (const row of prepared) {
    if (!row.event_key || !row.needsEvent) { merged.push(row); continue }
    const head = byEvent.get(row.event_key)
    if (!head) { byEvent.set(row.event_key, row); merged.push(row); continue }
    head.others = head.others || []
    if (head.others.length < 5 && row.source_label && !head.others.includes(row.source_label) && row.source_label !== head.source_label) head.others.push(row.source_label)
    report.skipped.event += 1
  }
  for (const row of merged) {
    if (row.others?.length) row.summary = `${row.summary ? `${row.summary}\n` : ''}สำนักอื่นที่รายงานเรื่องเดียวกัน: ${row.others.join(' · ')}`
  }

  // กันซ้ำข้ามรอบ: external_key ทุก status · event_key ภายใน event_window_days
  const windowDays = Number(cfg.queue?.event_window_days ?? 7)
  const seenKeys = new Set()
  const deduped = []
  for (const row of merged) {
    if (existing.keys?.has(row.external_key) || seenKeys.has(row.external_key)) { report.skipped.duplicate += 1; continue }
    if (row.event_key && row.needsEvent && existing.eventKeys?.has(row.event_key)) {
      const seenAt = new Date(existing.eventKeys.get(row.event_key))
      if (!Number.isNaN(seenAt.getTime()) && (now.getTime() - seenAt.getTime()) / DAY_MS <= windowDays) { report.skipped.event += 1; continue }
    }
    seenKeys.add(row.external_key)
    deduped.push(row)
  }

  // cap ต่อ (source, subtype) นับรวมของที่ค้างในคิว — ตัวนี้คือตัวคุมจำนวนในคิวจริง
  const counts = new Map(existing.queueCounts || [])
  const maxNew = Number(cfg.queue?.max_new_per_run || 40)
  const accepted = []
  for (const row of deduped) {
    if (accepted.length >= maxNew) { report.skipped.cap += 1; continue }
    const laneKey = `${row.source}|${row.subtype}`
    const cap = Number(subtypes[row.subtype]?.cap || DEFAULT_CAP)
    const used = counts.get(laneKey) || 0
    if (used >= cap) { report.skipped.cap += 1; continue }
    counts.set(laneKey, used + 1)
    accepted.push(row)
  }
  report.accepted = accepted.length

  const rows = accepted.map((row) => ({
    status: 'new',
    source: row.source,
    source_label: row.source_label || null,
    subtype: row.subtype,
    title: row.title,
    summary: row.summary || null,
    url: row.url || null,
    score: round1(row.score),
    audience: row.audience || null,
    service_area: row.service_area || null,
    event_date: row.event_date || null,
    event_key: row.event_key || null,
    external_key: row.external_key,
    related_sku: null,
  }))
  return { rows, report }
}

// สรุปรายงานเป็นข้อความสั้นสำหรับ log/เทเลแกรม (ไม่มีข้อมูลบุคคล — title ผ่านตัวลบแล้ว)
export function formatCollectReport({ rows, report }, { topTitles = 5, inserted = null } = {}) {
  const lines = []
  const ran = report.lanes.filter((l) => l.status !== 'skipped')
  const okLanes = ran.filter((l) => l.status === 'ok').length
  lines.push(`[ideas] เลนที่รัน ${ran.length} (สำเร็จ ${okLanes}) · ผู้สมัคร ${report.candidates} · เข้าคิว ${inserted ?? rows.length}`)
  const s = report.skipped
  lines.push(`[ideas] ตัดออก: ซ้ำ ${s.duplicate} · เหตุการณ์ซ้ำ ${s.event} · เกิน cap ${s.cap} · คะแนนต่ำ ${s.score} · ไม่ผ่าน gate ${s.gate} · เก่า ${s.stale} · ไม่ใช่กลุ่มคนอ่านของเพจ ${s.audience || 0}`)
  for (const l of ran.filter((x) => x.status !== 'ok')) lines.push(`[ideas] ${l.status === 'blocked' ? '⛔' : l.status === 'empty' ? '∅' : '⚠️'} ${l.label}: ${l.note}`)
  const bySource = {}
  for (const r of rows) bySource[r.source] = (bySource[r.source] || 0) + 1
  if (rows.length) lines.push(`[ideas] ตามแหล่ง: ${Object.entries(bySource).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  for (const r of rows.slice().sort((a, b) => b.score - a.score).slice(0, topTitles)) lines.push(`  • ${r.score} ${r.subtype} — ${r.title.slice(0, 90)}`)
  for (const w of report.warnings.slice(0, 10)) if (!lines.includes(w)) lines.push(w)
  return lines.join('\n')
}

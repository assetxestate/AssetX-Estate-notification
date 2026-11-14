import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { collectIdeas, cadenceDue, withAreaWords, formatCollectReport } from './collector.js'
import { planExpiry } from './store.js'

const cfg = JSON.parse(readFileSync(new URL('../../research/idea_sources.json', import.meta.url), 'utf8'))
const brand = JSON.parse(readFileSync(new URL('../../research/brand_facts.json', import.meta.url), 'utf8'))
const calendar = JSON.parse(readFileSync(new URL('../../research/calendar.json', import.meta.url), 'utf8'))
const now = new Date('2026-11-02T09:00:00Z')

const rss = (items) => `<rss><channel>${items.map((i) => `<item><title>${i.title}</title><link>${i.link}</link><pubDate>${i.date}</pubDate>${(i.cats || []).map((c) => `<category>${c}</category>`).join('')}${i.source ? `<source url="x">${i.source}</source>` : ''}<dc:creator>ผู้เขียน</dc:creator></item>`).join('')}</channel></rss>`

// fetcher ปลอม: ตอบตาม URL · ไม่ตอบ = 404
function fakeFetcher(table) {
  const calls = []
  const fn = async (url) => {
    calls.push(url)
    for (const [match, body] of Object.entries(table)) {
      if (url.includes(match)) {
        if (body === 'BLOCK') return { ok: false, status: 429, text: '', blocked: true }
        return { ok: true, status: 200, text: body, blocked: false }
      }
    }
    return { ok: false, status: 404, text: '', blocked: false, error: 'HTTP 404' }
  }
  fn.calls = calls
  return fn
}

test('cadenceDue ตัดสินจากรันล่าสุด ไม่ใช่วันในสัปดาห์', () => {
  assert.equal(cadenceDue('daily', now, null), true)
  assert.equal(cadenceDue('daily', now, '2026-11-02T01:00:00Z'), false)
  assert.equal(cadenceDue('weekly', now, '2026-10-30T09:00:00Z'), false)
  assert.equal(cadenceDue('weekly', now, '2026-10-26T09:00:00Z'), true)
  assert.equal(cadenceDue('monthly', now, '2026-10-20T09:00:00Z'), false)
  assert.equal(cadenceDue('mpc_window', now, null, { mpc: false }), false)
  assert.equal(cadenceDue('mpc_window', now, null, { mpc: true }), true)
})

test('withAreaWords เติมพื้นที่ให้บริการเข้ากลุ่ม area', () => {
  const scoring = withAreaWords(cfg.scoring, ['ชลบุรี', 'ระยอง'])
  assert.deepEqual(scoring.weights.area.words, ['ชลบุรี', 'ระยอง'])
  assert.equal(scoring.weights.transaction.w, 2.0)
})

test('รอบเก็บเต็ม: เลนพังไม่ล้มทั้งรอบ · PII ถูกลบ · event รวม · กันซ้ำ · cap · เลนที่ไม่อนุมัติถูกข้าม', async () => {
  const fetcher = fakeFetcher({
    'news.google.com/rss/search?q=%E0%B8%88%E0%B8%B3%E0%B8%99%E0%B8%AD%E0%B8%87%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99': rss([
      { title: 'ธอส. ออกสินเชื่อบ้านดอกเบี้ยคงที่ 3 ปี', link: 'https://a.example/1?utm_source=g', date: 'Sun, 01 Nov 2026 03:00:00 +0000', source: 'ฐานเศรษฐกิจ' },
      { title: 'ธอส. ออกสินเชื่อบ้านดอกเบี้ยคงที่ 3 ปี', link: 'https://b.example/2', date: 'Sun, 01 Nov 2026 05:00:00 +0000', source: 'กรุงเทพธุรกิจ' },
      { title: 'จำนองบ้าน ติดต่อ คุณ สมชาย โทร 081-234-5678', link: 'https://c.example/3', date: 'Sun, 01 Nov 2026 05:00:00 +0000', source: 'Head Topics' },
      { title: 'ข่าวเก่า จำนองบ้าน', link: 'https://d.example/4', date: 'Mon, 01 Sep 2026 05:00:00 +0000', source: 'x' },
      { title: 'ดาราแต่งงาน', link: 'https://e.example/5', date: 'Sun, 01 Nov 2026 05:00:00 +0000', source: 'y' },
    ]),
    'prachachat.net/real-estate/feed': rss([
      { title: 'ราคาที่ดินชลบุรีขยับ หลังผังเมืองใหม่ โทร 02-123-4567', link: 'https://www.prachachat.net/real-estate/news-9', date: 'Mon, 02 Nov 2026 02:00:00 +0000' },
    ]),
    'pantip.com/forum/home/feed': rss([
      { title: 'กู้แบงก์ไม่ผ่าน มีโฉนด ควรทำยังไงดี', link: 'https://pantip.com/topic/43800001', date: 'Mon, 02 Nov 2026 01:00:00 +0000', cats: ['สินเชื่อเพื่อที่อยู่อาศัย'] },
      { title: 'แนะนำร้านอาหารแถวบ้าน', link: 'https://pantip.com/topic/43800002', date: 'Mon, 02 Nov 2026 01:00:00 +0000', cats: ['อาหาร'] },
    ]),
    'bot.or.th/th/our-roles/monetary-policy/mpc-meeting.html': '<a href="/th/news-and-media/news/mpc/news-20261028-ab12.html">แถลงข่าว</a>',
    'thansettakij.com/sitemap/latest': 'BLOCK',
    'youtube.com/feeds/videos.xml?channel_id=UCR6Satoz7Ont31fEE7exgPQ': `<feed xmlns:yt="x" xmlns:media="y"><entry><yt:videoId>vid1</yt:videoId><title>รับจำนองที่ดิน ดอกเบี้ย 1.25% ต่อเดือน</title><author><name>Land for Loan</name></author><published>2026-11-01T10:00:00+00:00</published><media:group><media:statistics views="1200"/></media:group></entry></feed>`,
  })
  const existing = { keys: new Set(['pt:43800001']), eventKeys: new Map(), queueCounts: new Map([['community|community_q', 5]]) }
  const { rows, report } = await collectIdeas({ cfg, brand, calendar, fetcher, now, existing, leads: [] })

  const byKey = Object.fromEntries(rows.map((r) => [r.external_key, r]))
  // ข่าวเหตุการณ์เดียวกัน 2 สำนัก → 1 แถว + สำนักอื่นต่อท้าย
  const ghb = rows.filter((r) => /สินเชื่อบ้านดอกเบี้ยคงที่/.test(r.title))
  assert.equal(ghb.length, 1)
  assert.match(ghb[0].summary, /สำนักอื่นที่รายงานเรื่องเดียวกัน: (กรุงเทพธุรกิจ|ฐานเศรษฐกิจ)/)
  assert.equal(ghb[0].external_key, 'news:https://a.example/1')
  assert.equal(ghb[0].subtype, 'credit_market', 'คำค้น จำนองบ้าน ไม่มี subtype → ตัวจัดประเภท')
  assert.deepEqual(ghb[0].audience, ['A', 'D'])
  // Head Topics ถูกตัด · ข่าวเก่าถูกตัด · ข่าวไม่เกี่ยวไม่ผ่าน gate
  assert.equal(rows.some((r) => /สมชาย|081-234/.test(r.title)), false)
  assert.equal(rows.some((r) => /ดาราแต่งงาน|ข่าวเก่า/.test(r.title)), false)
  // ข่าวตลาด (กลุ่ม B/C/D) ไม่ใช่เรื่องของคนอ่านเพจ — เพจพูดกับกลุ่ม A อย่างเดียว (เจ้าของเลือก 9 พ.ย. 2569) → ไม่เข้าคิว
  assert.equal(byKey['news:https://prachachat.net/real-estate/news-9'], undefined)
  assert.ok(report.skipped.audience >= 1)
  assert.match(formatCollectReport({ rows, report }), /ไม่ใช่กลุ่มคนอ่านของเพจ [1-9]/)
  // เพจที่พูดกับทุกกลุ่ม: ข่าวเดียวกันเข้าคิว · PII ในหัวข่าวประชาชาติถูกลบ
  const everyone = await collectIdeas({ cfg, brand: { ...brand, page_audience: ['A', 'B', 'C', 'D'] }, calendar, fetcher, now, existing: { keys: new Set(['pt:43800001']), eventKeys: new Map(), queueCounts: new Map([['community|community_q', 5]]) }, leads: [] })
  const pcc = everyone.rows.find((r) => r.external_key === 'news:https://prachachat.net/real-estate/news-9')
  assert.ok(pcc, everyone.rows.map((r) => r.external_key).join(','))
  assert.match(pcc.title, /\[ลบ\]/)
  assert.equal(pcc.source_label, 'ประชาชาติธุรกิจ')
  assert.equal(everyone.report.skipped.audience, 0)
  // Pantip: เจ้าของตัดเลนออก 6 พ.ย. 2569 (enabled:false ทั้ง 3 เลน) → ไม่ยิงฟีด ไม่มีเลนในรายงาน ไม่มี community เข้าเลย
  assert.equal(rows.some((r) => r.source === 'community'), false)
  assert.equal(report.lanes.some((l) => /pantip/i.test(l.key)), false, 'เลน Pantip ต้องไม่ถูกรันเลย')
  assert.equal(fetcher.calls.some((u) => /pantip\.com/.test(u)), false, 'ห้ามยิง pantip.com')
  assert.ok(report.skipped.cap >= 0)
  // ธปท.
  const bot = rows.find((r) => r.external_key.startsWith('bot:mpc:'))
  assert.ok(bot)
  assert.equal(bot.subtype, 'rate')
  assert.equal(bot.source, 'official')
  // ฐานเศรษฐกิจถูกบล็อก → เลนนั้น blocked แต่รอบยังเดินต่อ
  const blocked = report.lanes.find((l) => l.key === 'feed:thansettakij')
  assert.equal(blocked.status, 'blocked')
  assert.ok(report.warnings.some((w) => /ฐานเศรษฐกิจ/.test(w)))
  // YouTube คู่แข่ง
  const yt = byKey['yt:vid1']
  assert.ok(yt)
  assert.equal(yt.subtype, 'competitor')
  assert.match(yt.summary, /ยังไม่รู้เนื้อหาจริงของคลิป/)
  // ปฏิทิน
  assert.ok(byKey['cal:mpc-minutes-2026-5:2026-11-11'])
  assert.equal(byKey['cal:mpc-minutes-2026-5:2026-11-11'].event_date, '2026-11-11')
  // ทุกแถวมีฟิลด์ที่ DB ต้องการ
  for (const r of rows) {
    assert.equal(r.status, 'new')
    assert.ok(cfg.subtypes[r.subtype], r.subtype)
    assert.ok(r.external_key && r.title)
    assert.equal('related_sku' in r, true)
  }
  // dc:creator ไม่หลุดมาที่ไหนเลย
  assert.doesNotMatch(JSON.stringify(rows), /ผู้เขียน/)
  const text = formatCollectReport({ rows, report })
  assert.match(text, /\[ideas\] เลนที่รัน/)
  assert.match(text, /⛔ ฐานเศรษฐกิจ/)
})

test('เลนที่เจ้าของยังไม่อนุมัติถูกข้าม และคำค้น mpc_window ยิงเฉพาะช่วงประชุม', async () => {
  const fetcher = fakeFetcher({})
  const strict = { ...cfg, owner_decisions: { ...cfg.owner_decisions, google_news_rss: { allowed: false }, youtube_rss: { allowed: false } }, feeds: { items: [] } }
  const { report } = await collectIdeas({ cfg: strict, brand, calendar, fetcher, now, leads: [] })
  assert.equal(fetcher.calls.length, 0, 'ไม่ยิงอะไรเลย')
  assert.ok(report.lanes.filter((l) => l.lane === 'news').every((l) => l.status === 'skipped'))
  assert.ok(report.lanes.filter((l) => l.lane === 'youtube').every((l) => l.status === 'skipped'))

  const onlyMpc = { ...cfg, feeds: { items: [] }, youtube: { channels: [] }, news_queries: { items: [{ q: 'ดอกเบี้ยนโยบาย กนง.', when_days: 14, cadence: 'mpc_window', subtype: 'rate' }] } }
  const quiet = fakeFetcher({})
  await collectIdeas({ cfg: onlyMpc, brand, calendar, fetcher: quiet, now, leads: [] })
  assert.equal(quiet.calls.length, 0)
  const during = fakeFetcher({})
  await collectIdeas({ cfg: onlyMpc, brand, calendar, fetcher: during, now: new Date('2026-12-24T09:00:00Z'), leads: [] })
  assert.equal(during.calls.length, 1)
})

test('subtype ที่ไม่อยู่ในคอนฟิกถูกปฏิเสธพร้อมคำเตือน (กันพิมพ์ผิด)', async () => {
  const fetcher = fakeFetcher({ 'example.org/feed': rss([{ title: 'ขายฝากที่ดิน', link: 'https://example.org/1', date: 'Mon, 02 Nov 2026 01:00:00 +0000' }]) })
  const bad = { ...cfg, news_queries: { items: [] }, youtube: { channels: [] }, feeds: { items: [{ key: 'x', kind: 'rss', url: 'https://example.org/feed', source: 'news', label: 'X', subtype: 'typo_here' }] } }
  const { rows, report } = await collectIdeas({ cfg: bad, brand, calendar: { events: [] }, fetcher, now, leads: [] })
  assert.equal(rows.length, 0)
  assert.equal(report.skipped.subtype, 1)
  assert.ok(report.warnings.some((w) => /typo_here/.test(w)))
})

test('planExpiry: อายุต่อ subtype · event_date ยังไม่ถึงไม่หมดอายุ · มีคอนเทนต์อ้างไม่แตะ', () => {
  const subtypes = cfg.subtypes
  const rows = [
    { id: 1, status: 'new', subtype: 'community_q', created_at: '2026-10-10T00:00:00Z' },
    { id: 2, status: 'new', subtype: 'law', created_at: '2026-10-10T00:00:00Z' },
    { id: 3, status: 'new', subtype: 'market', created_at: '2026-09-01T00:00:00Z', event_date: '2027-06-30' },
    { id: 4, status: 'new', subtype: 'market', created_at: '2026-09-01T00:00:00Z', content_id: 9 },
    { id: 5, status: 'picked', subtype: 'market', created_at: '2026-01-01T00:00:00Z' },
    { id: 6, status: 'new', subtype: 'market', created_at: '2026-09-01T00:00:00Z' },
  ]
  assert.deepEqual(planExpiry(rows, { subtypes, purgeDays: 14, now, referenced: new Set([6]) }), [1])
  assert.deepEqual(planExpiry(rows, { subtypes, purgeDays: 14, now }), [1, 6])
  // ไอเดียที่เจ้าของย้อนร่างกลับมาเอง (unpick คง chosen_angle) ไม่หมดอายุเอง แม้อายุเกินเกณฑ์
  const returned = [...rows, { id: 7, status: 'new', subtype: 'market', created_at: '2026-09-01T00:00:00Z', chosen_angle: 'เช็กลิสต์' }]
  assert.deepEqual(planExpiry(returned, { subtypes, purgeDays: 14, now }), [1, 6])
  // เพจพูดกับกลุ่ม A อย่างเดียว (เจ้าของเลือก 9 พ.ย. 2569): ไอเดียป้าย B/C/D ล้วนหมดอายุทันที แม้ยังใหม่หรือเหตุการณ์ยังไม่ถึง
  // ป้ายที่มี A · ไม่ติดป้าย · เจ้าของดึงกลับจากร่าง · มีคอนเทนต์อ้าง · ไม่ใช่ new → ไม่แตะ · ไม่ส่ง pageAudience = ไม่กรองกลุ่ม
  const fresh = '2026-11-01T00:00:00Z'
  const byAudience = [
    { id: 11, status: 'new', subtype: 'market', created_at: fresh, audience: ['B', 'C', 'D'] },
    { id: 12, status: 'new', subtype: 'fee_measure', created_at: fresh, audience: ['C', 'D'], event_date: '2027-06-30' },
    { id: 13, status: 'new', subtype: 'law', created_at: fresh, audience: ['A', 'B'] },
    { id: 14, status: 'new', subtype: 'social_fb', created_at: fresh, audience: null },
    { id: 15, status: 'new', subtype: 'market', created_at: fresh, audience: ['B', 'D'], chosen_angle: 'มุมหลัก' },
    { id: 16, status: 'new', subtype: 'market', created_at: fresh, audience: ['B', 'D'], content_id: 3 },
    { id: 17, status: 'picked', subtype: 'market', created_at: fresh, audience: ['B', 'D'] },
  ]
  assert.deepEqual(planExpiry(byAudience, { subtypes, purgeDays: 14, now, pageAudience: ['A'] }), [11, 12])
  assert.deepEqual(planExpiry(byAudience, { subtypes, purgeDays: 14, now }), [])
  assert.deepEqual(planExpiry(byAudience, { subtypes, purgeDays: 14, now, pageAudience: ['A', 'B'] }), [12])
})

test('รายงานรอบเก็บ: YouTube ล่มรวมเป็นบรรทัดเดียว และคำเตือนไม่ซ้ำสองรอบ (เทเลแกรม 14 พ.ย. 2569)', () => {
  const lane = (l, label, status, note = '') => ({ lane: l, key: label, label, status, fetched: 0, kept: 0, note })
  const report = {
    lanes: [
      lane('news', 'Google News "จำนองบ้าน"', 'ok'),
      lane('youtube', 'YouTube A', 'error', 'HTTP 404'),
      lane('youtube', 'YouTube B', 'error', 'HTTP 500'),
      lane('youtube', 'YouTube C', 'error', 'HTTP 404'),
      lane('youtube', 'YouTube D', 'ok'),
      lane('rss', 'ฟีดหนึ่ง', 'blocked', 'HTTP 500 (บล็อก/จำกัด — ข้ามรอบนี้ ห้ามลองเลี่ยง)'),
    ],
    warnings: ['⚠️ YouTube A: HTTP 404', '⚠️ YouTube B: HTTP 500', '⚠️ YouTube C: HTTP 404', '⚠️ ฟีดหนึ่ง: ถูกบล็อก 500', '⚠️ subtype "x" ไม่อยู่ในคอนฟิก (ข่าว)'],
    candidates: 0, accepted: 0, skipped: { duplicate: 0, event: 0, cap: 0, score: 0, subtype: 1, gate: 0, stale: 0, audience: 0 }, ranLanes: [],
  }
  const text = formatCollectReport({ rows: [], report })
  const yt = text.split('\n').filter((l) => /YouTube/.test(l))
  assert.equal(yt.length, 1, text)
  assert.match(yt[0], /YouTube RSS ไม่ตอบ 3\/4 ช่อง \(404 ×2 · 500 ×1\)/)
  assert.match(yt[0], /A · B · C/)
  assert.equal(text.split('\n').filter((l) => /ฟีดหนึ่ง/.test(l)).length, 1, text)
  assert.match(text, /⛔ ฟีดหนึ่ง/)
  assert.match(text, /subtype "x" ไม่อยู่ในคอนฟิก/)
})

test('เลนที่ subtype ไม่มีกลุ่มคนอ่านของเพจถูกปิดในคอนฟิก และตัวเก็บไม่ยิงคำค้นที่ enabled: false', async () => {
  const page = brand.page_audience || ['A']
  const lanes = [...(cfg.news_queries.items || []), ...(cfg.feeds.items || []), ...(cfg.youtube.channels || [])]
  for (const l of lanes) {
    const aud = cfg.subtypes[l.subtype]?.audience || []
    if (l.subtype && aud.length && !aud.some((c) => page.includes(c))) assert.equal(l.enabled, false, `${l.q || l.key || l.label} (${l.subtype}) ยิงไปก็ไม่เข้าคิว`)
  }
  const fetcher = fakeFetcher({})
  const one = { ...cfg, news_queries: { items: [{ q: 'ปิดอยู่', when_days: 14, cadence: 'daily', enabled: false }] }, feeds: { items: [] }, youtube: { channels: [] } }
  await collectIdeas({ cfg: one, brand, calendar: { events: [] }, fetcher, now })
  assert.equal(fetcher.calls.length, 0)
})

test('title_drop ตัดข่าวโปรสินเชื่อของผู้ซื้อบ้าน แต่ไม่ตัดเรื่องของเจ้าของบ้านที่ต้องการเงิน (14 พ.ย. 2569)', async () => {
  const { titleDropped } = await import('./classify.js')
  const drop = cfg.scoring.title_drop
  for (const t of ['ธอส. ปล่อยสินเชื่อบ้านคนละหลัง PLUS ดอกเบี้ย 2.60% ลุย Money Expo เชียงใหม่', '5 อันดับดอกเบี้ยสินเชื่อบ้าน แบงก์ไหนถูกสุด !', 'MMM ชี้“สินเชื่อบ้านคนละหลัง PLUS”ปลุกยอดโอน Q4', 'KTB บุกเชียงใหม่! อัดโปรฯ ครบวงจร ชูสินเชื่อบ้านดอกเบี้ยเริ่ม 1.33%']) assert.equal(titleDropped(t, drop), true, t)
  for (const t of ['‘ธอส.’ เปิดตัวสินเชื่อบ้านแลกเงินสำหรับผู้สูงอายุ', 'รวบยกแก๊ง! ปลอมโฉนดที่ดิน ตุ๋นเหยื่อ', 'เอาคอนโดไปจำนอง ทำไมบางห้องถึงกู้เงินไม่ผ่าน?']) assert.equal(titleDropped(t, drop), false, t)
})

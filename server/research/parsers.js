// ตัวอ่านฟีด/หน้าเว็บทุกชนิดเป็น pure function รับข้อความ คืน array ของรายการรูปเดียวกัน
// ไม่ใช้ไลบรารี XML/DOM — regex พอสำหรับฟีดมาตรฐาน และเทสต์ได้กับไฟล์ที่เซฟไว้
//
// กติกา PDPA ตั้งแต่ตอนอ่าน: ไม่คืน description / content:encoded / dc:creator / author เว้นแต่ขอชัดเจนใน keepFields
// (ชื่อผู้โพสต์ Pantip และเนื้อเต็มของข่าวต้องไม่เข้าระบบเลย — ลิขสิทธิ์และข้อมูลบุคคล)

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function decodeEntities(input) {
  return String(input ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeChar(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => (name.toLowerCase() in ENTITIES ? ENTITIES[name.toLowerCase()] : m))
}

function safeChar(code) {
  try { return String.fromCodePoint(code) } catch { return '' }
}

export function stripCdata(input) {
  return String(input ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

// ข้อความล้วนจากชิ้น HTML/XML: ตัดแท็ก ถอด CDATA/entity ยุบช่องว่าง
export function textOf(fragment) {
  return decodeEntities(stripCdata(String(fragment ?? '')).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function tagContent(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = re.exec(block)
  return m ? textOf(m[1]) : ''
}

function allTagContents(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  const out = []
  let m
  while ((m = re.exec(block)) !== null) out.push(textOf(m[1]))
  return out
}

function attr(block, tag, name) {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${name}="([^"]*)"`, 'i')
  const m = re.exec(block)
  return m ? decodeEntities(m[1]) : ''
}

export function parseDate(value) {
  if (!value) return null
  const t = new Date(String(value).trim())
  return Number.isNaN(t.getTime()) ? null : t.toISOString()
}

// ── RSS 2.0 (WordPress · Pantip · SAM · Bangkok Post · Google News) ──────────────
// คืน [{ title, link, published, categories[], sourceName, guid }]
export function parseRss(xml, { keepFields = [] } = {}) {
  const items = []
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi
  let m
  while ((m = re.exec(String(xml ?? ''))) !== null) {
    const block = m[1]
    const item = {
      title: tagContent(block, 'title'),
      link: tagContent(block, 'link') || attr(block, 'link', 'href'),
      published: parseDate(tagContent(block, 'pubDate') || tagContent(block, 'dc:date')),
      categories: allTagContents(block, 'category'),
      sourceName: tagContent(block, 'source'),
      guid: tagContent(block, 'guid'),
    }
    for (const field of keepFields) {
      if (!['description', 'content:encoded', 'dc:creator', 'author'].includes(field)) continue
      item[field] = tagContent(block, field.replace(':', '\\:'))
    }
    if (item.title || item.link) items.push(item)
  }
  return items
}

// ── YouTube channel feed (Atom) ─────────────────────────────────────────────────
// คืน [{ videoId, title, link, published, views, channel }]
export function parseYoutubeFeed(xml) {
  const out = []
  const re = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi
  let m
  while ((m = re.exec(String(xml ?? ''))) !== null) {
    const block = m[1]
    const videoId = tagContent(block, 'yt:videoId')
    if (!videoId) continue
    const author = /<author>([\s\S]*?)<\/author>/i.exec(block)
    out.push({
      videoId,
      title: tagContent(block, 'title'),
      link: `https://www.youtube.com/watch?v=${videoId}`,
      published: parseDate(tagContent(block, 'published')),
      views: Number(attr(block, 'media:statistics', 'views')) || 0,
      channel: author ? tagContent(author[1], 'name') : '',
    })
  }
  return out
}

export function youtubeFeedUrl(channelId) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`
}

// ── Google-News sitemap (ฐานเศรษฐกิจ · กรุงเทพธุรกิจ) ──────────────────────────
// คืน [{ link, title, published, publication }]
export function parseGnewsSitemap(xml) {
  const out = []
  const re = /<url\b[^>]*>([\s\S]*?)<\/url>/gi
  let m
  while ((m = re.exec(String(xml ?? ''))) !== null) {
    const block = m[1]
    const link = tagContent(block, 'loc')
    if (!link) continue
    out.push({
      link,
      title: tagContent(block, 'news:title'),
      published: parseDate(tagContent(block, 'news:publication_date') || tagContent(block, 'lastmod')),
      publication: tagContent(block, 'news:name'),
    })
  }
  return out
}

// ── Google News RSS URL (หมวด ⚠️ เจ้าของอนุมัติ) ─────────────────────────────────
// ห้ามเขียน when: ในตัวคำค้น — ฟังก์ชันนี้ต่อให้เอง
export function googleNewsRssUrl(query, whenDays = 14) {
  const q = `${String(query).trim()} when:${Math.max(1, Math.round(Number(whenDays) || 14))}d`
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=th&gl=TH&ceid=TH:th`
}

// ── ธปท. หน้ากำหนดการประชุม กนง. ───────────────────────────────────────────────
// ลิงก์แถลงข่าวมีรหัสสุ่ม เดาไม่ได้ ต้องอ่านจากตาราง · คืน [{ link, title, published }]
export function parseBotMpc(html, base = 'https://www.bot.or.th') {
  const out = []
  const seen = new Set()
  const re = /<a\b[^>]*href="([^"]*\/th\/news-and-media\/news\/mpc\/news-(\d{8})-[\w-]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(String(html ?? ''))) !== null) {
    const href = decodeEntities(m[1])
    const link = href.startsWith('http') ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`
    if (seen.has(link)) continue
    seen.add(link)
    const d = m[2]
    const published = parseDate(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T07:00:00+07:00`)
    const text = textOf(m[3])
    // ข้อความในตารางมักเป็นแค่ "แถลงข่าว" — ใช้ชื่อที่บอกวันประชุมแทน ให้คนอ่านในคิวรู้ว่าคือมติครั้งไหน
    const generic = !text || text.length < 12 || /^แถลงข่าว/.test(text)
    out.push({ link, title: generic ? `แถลงข่าวผลการประชุม กนง. วันที่ ${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : text, published })
  }
  return out
}

// ── กรมที่ดิน ข่าวประชาสัมพันธ์ (หน้า 1) ────────────────────────────────────────
// ลิงก์ /news-<epoch>/ · คืน [{ link, title, published }]
export function parseDolNews(html, base = 'https://www.dol.go.th') {
  const out = []
  const seen = new Set()
  const re = /<a\b[^>]*href="([^"]*\/news-(\d{9,10})\/?)"([^>]*)>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(String(html ?? ''))) !== null) {
    const href = decodeEntities(m[1])
    const link = href.startsWith('http') ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`
    const titleAttr = /\btitle="([^"]*)"/i.exec(m[3])
    const title = textOf(m[4]) || (titleAttr ? decodeEntities(titleAttr[1]) : '')
    if (!title) continue
    if (seen.has(link)) continue
    seen.add(link)
    out.push({ link, title, published: new Date(Number(m[2]) * 1000).toISOString() })
  }
  return out
}

// ข่าวจัดซื้อจัดจ้าง/บุคลากรของหน่วยงาน — ทิ้งทุกเลนทางการ
export const PROCUREMENT_RE = /จัดซื้อ|จัดจ้าง|ประกวดราคา|สอบราคา|e-?bidding|ราคากลาง|ผู้ชนะ|ประกาศผล|รับสมัคร|บรรจุ|แต่งตั้ง/i

// ── Pantip tag: JSON ใน <script id="__NEXT_DATA__"> ────────────────────────────
// คืน [{ topicId, title, link, views, comments, published }] · ทิ้ง author ทุกกรณี
export function parsePantipTagNextData(html) {
  const m = /<script\b[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(String(html ?? ''))
  if (!m) return []
  let data
  try { data = JSON.parse(m[1]) } catch { return [] }
  const direct = data?.props?.initialProps?.pageProps?.topics?.data ?? data?.props?.pageProps?.topics?.data
  const list = Array.isArray(direct) ? direct : findTopicsArray(data)
  return (list || []).map(normalizePantipTopic).filter((t) => t.topicId && t.title)
}

function findTopicsArray(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null
  if (Array.isArray(node)) {
    if (node.length && node.every((item) => item && typeof item === 'object' && ('topic_id' in item || ('id' in item && 'title' in item)))) return node
    for (const item of node) { const found = findTopicsArray(item, depth + 1); if (found) return found }
    return null
  }
  for (const value of Object.values(node)) { const found = findTopicsArray(value, depth + 1); if (found) return found }
  return null
}

function normalizePantipTopic(item) {
  const topicId = String(item.topic_id ?? item.id ?? '').trim()
  const views = Number(item.views_count ?? item.view_count ?? item.views ?? item.visited ?? 0) || 0
  const comments = Number(item.comments_count ?? item.comment_count ?? item.comments ?? 0) || 0
  return {
    topicId,
    title: textOf(item.title ?? ''),
    link: topicId ? `https://pantip.com/topic/${topicId}` : '',
    views,
    comments,
    published: parseDate(item.created_time ?? item.created_at ?? item.post_time ?? null),
    tags: Array.isArray(item.tags) ? item.tags.map((t) => (typeof t === 'string' ? t : t?.name || t?.tag || '')).filter(Boolean) : [],
  }
}

// ── CKAN package_show (data.go.th · กรมบังคับคดี) ──────────────────────────────
// คืน resource ล่าสุด { url, name, format, lastModified, monthKey } หรือ null · ชื่อไฟล์เปลี่ยนทุกเดือน ห้ามใช้เป็นกุญแจ
export function parseCkanPackage(json) {
  const data = typeof json === 'string' ? safeJson(json) : json
  const resources = data?.result?.resources
  if (!Array.isArray(resources) || !resources.length) return null
  const sorted = resources
    .map((r) => ({ url: r.url || '', name: r.name || '', format: r.format || '', lastModified: parseDate(r.last_modified || r.metadata_modified || r.created) }))
    .filter((r) => r.url)
    .sort((a, b) => String(b.lastModified || '').localeCompare(String(a.lastModified || '')))
  const latest = sorted[0]
  if (!latest) return null
  return { ...latest, monthKey: latest.lastModified ? latest.lastModified.slice(0, 7) : null, count: resources.length }
}

function safeJson(text) {
  try { return JSON.parse(text) } catch { return null }
}

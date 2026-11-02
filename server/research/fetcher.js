// ตัวดึงเว็บตัวเดียวสำหรับทุกเลน — มารยาทการดึงอยู่ที่นี่ที่เดียว
//   · User-Agent บอกชื่อบอท + ช่องติดต่อ (ห้ามปลอมเป็นเบราว์เซอร์ — เว็บไม่ตอบ UA บอท = ถือว่าไม่อนุญาต)
//   · เว้นจังหวะต่อ host ตาม host_delay_sec (ค่าเริ่มต้น 1.5 วิ · data.go.th 10 วิ ตาม Crawl-Delay)
//   · ถอด gzip เองเมื่อเนื้อเป็นไบต์ gzip แต่ไม่มี Content-Encoding (Bangkok Post)
//   · 403 / 429 / 503 / หน้า challenge ของ Cloudflare = blocked → ข้ามแหล่งนั้นรอบนี้ ห้ามลองเลี่ยง
//   · ไม่ throw: คืน { ok:false, error } ให้เลนตัดสินเอง
import zlib from 'node:zlib'

const DEFAULT_UA = 'AssetXResearchBot/1.0 (+https://assetx-estate.vercel.app)'
const BLOCKED_STATUS = new Set([401, 403, 429, 503])
const CHALLENGE_RE = /cf-chl|challenge-platform|Just a moment|Attention Required|cf-browser-verification|__cf_chl/i

export function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
}

export function delayForHost(host, hostDelaySec = {}) {
  const table = hostDelaySec || {}
  if (host && table[host] != null) return Number(table[host]) * 1000
  for (const [key, value] of Object.entries(table)) {
    if (key !== 'default' && host && host.endsWith(key)) return Number(value) * 1000
  }
  return (Number(table.default) || 1.5) * 1000
}

export function isGzipBytes(buffer) {
  return buffer && buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b
}

export function createFetcher({
  userAgent = DEFAULT_UA,
  hostDelaySec = {},
  timeoutMs = 30000,
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  log = () => {},
} = {}) {
  const lastHit = new Map()
  const stats = { requests: 0, blocked: 0, errors: 0 }

  async function politeFetch(url, { headers = {}, accept = 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, application/json;q=0.9, */*;q=0.5' } = {}) {
    const host = hostOf(url)
    const wait = delayForHost(host, hostDelaySec)
    const previous = lastHit.get(host) || 0
    const gap = now() - previous
    if (previous && gap < wait) await sleep(wait - gap)
    lastHit.set(host, now())
    stats.requests += 1

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': userAgent, Accept: accept, 'Accept-Language': 'th,en;q=0.8', ...headers },
        signal: controller.signal,
      })
      const buffer = Buffer.from(await response.arrayBuffer())
      let bytes = buffer
      if (isGzipBytes(buffer)) {
        try { bytes = zlib.gunzipSync(buffer) } catch { bytes = buffer }
      }
      const text = bytes.toString('utf8')
      const contentType = response.headers.get('content-type') || ''
      const blocked = BLOCKED_STATUS.has(response.status) || (!response.ok && CHALLENGE_RE.test(text.slice(0, 4000))) || (response.ok && /text\/html/i.test(contentType) && CHALLENGE_RE.test(text.slice(0, 4000)) && /cf-chl|__cf_chl/i.test(text))
      if (blocked) stats.blocked += 1
      if (!response.ok) log(`[fetch] ${response.status} ${url}`)
      return { ok: response.ok && !blocked, status: response.status, text, blocked, url: response.url || url, contentType, error: response.ok ? null : `HTTP ${response.status}` }
    } catch (error) {
      stats.errors += 1
      const message = error?.name === 'AbortError' ? `timeout ${timeoutMs}ms` : (error?.message || String(error))
      log(`[fetch] error ${url}: ${message}`)
      return { ok: false, status: 0, text: '', blocked: false, url, contentType: '', error: message }
    } finally {
      clearTimeout(timer)
    }
  }

  politeFetch.stats = stats
  return politeFetch
}

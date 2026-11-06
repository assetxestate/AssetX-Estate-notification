// ถอดข้อเท็จจริงจากหน้าต้นทางของไอเดีย (ขั้น 2b "enrich") — ตัวเก็บเก็บข่าวมาแค่หัวข้อ+ลิงก์ (summary ว่าง) ตัวร่างจึงไม่มีอะไรยึด
// ผลตรวจ 6 พ.ย. 2569: ไอเดีย 25/29 ไม่มีข้อเท็จจริง → AI เดาเอกสาร/ขั้นตอนผิดบริบทไทย · ร่างจึงต้องยึด "ข้อเท็จจริงที่ถอดจากต้นทาง" (📌) เท่านั้น
//
// วิธี: ดึงหน้าด้วยตัวดึงมารยาทเดิม (fetcher.js: UA บอท · เว้นจังหวะ · 403 = ข้าม ห้ามเลี่ยง) → ดึงข้อความ (<article>/<p> ที่เป็นเนื้อจริง หรือ og:description)
//      → AI สรุป ≤ 7 ข้อ "เฉพาะที่อยู่ในข้อความ" → summary = "📌 …" (ล้างข้อมูลบุคคลก่อนเก็บ) · ดึงไม่ได้ = บันทึกเหตุผลเป็น ⚠️ ให้รู้ว่าลองแล้ว
// สิ่งที่ลองแล้ว (6 พ.ย.): หน้า Google News RSS เป็นหน้า redirect ด้วย JS ไม่มีลิงก์สำนักข่าวใน HTML → ถอดไม่ได้ · prachachat ตอบ 403 → ข้าม
//      · pantip ให้แค่คำโปรย (og:description) · bot.or.th ให้เนื้อเต็ม · กรมที่ดินฝัง PDF → ไม่มีข้อความ
import { scrub } from './pii.js'

export const ARTICLE_MAX_CHARS = 6000
export const DESCRIPTION_MIN_CHARS = 120
export const ARTICLE_MIN_CHARS = 300
export const FACT_MAX_CHARS = 220
export const MAX_FACTS = 7

const NAV_RE = /คุกกี้|cookie|สงวนลิขสิทธิ์|เข้าสู่ระบบ|สมัครสมาชิก|ติดตามเรา|แชร์|อ่านต่อ|ค้นหา|เมนู|ดาวน์โหลดเพื่อเปิดดู|รองรับการใช้งานได้ดีบน|แสดงความคิดเห็น|โฆษณา|ข่าวที่เกี่ยวข้อง|อ่านข่าวอื่น/i
const THAI_RE = /[฀-๿]/g

export function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
}

function metaContent(html, name) {
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'))
  const b = a || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i'))
  return b ? decodeEntities(b[1]).replace(/\s+/g, ' ').trim() : ''
}

function thaiShare(text) {
  const letters = text.replace(/[\s\d\p{P}]/gu, '')
  if (!letters.length) return 0
  return (letters.match(THAI_RE) || []).length / letters.length
}

// ดึง "เนื้อบทความ" จาก HTML แบบไม่พึ่งไลบรารี: ตัด script/style → เลือก <article> ถ้ามี → เอา <p> ที่เป็นข้อความไทยยาวพอและไม่ใช่เมนู/ท้ายเว็บ
export function extractArticle(html, { url = '' } = {}) {
  const raw = String(html || '')
  const body = raw.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
  const title = decodeEntities((body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim()
  const description = metaContent(body, 'og:description') || metaContent(body, 'description')
  const scope = (body.match(/<article\b[\s\S]*?<\/article>/i) || [body])[0]
  const paragraphs = [...scope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decodeEntities(m[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter((t) => t.length >= 60 && !NAV_RE.test(t) && thaiShare(t) >= 0.5)
  const unique = [...new Set(paragraphs)]
  let text = ''
  for (const p of unique) {
    if ((text + p).length > ARTICLE_MAX_CHARS) break
    text += (text ? '\n' : '') + p
  }
  const isGoogleNews = /news\.google\.com/.test(url)
  if (isGoogleNews) return { title, description: '', text: '', kind: 'none', reason: 'หน้า Google News เป็นหน้าเปลี่ยนเส้นทางด้วย JS ไม่มีเนื้อข่าว' }
  if (text.length >= ARTICLE_MIN_CHARS) return { title, description, text, kind: 'article', reason: '' }
  if (description.length >= DESCRIPTION_MIN_CHARS) return { title, description, text: description, kind: 'description', reason: '' }
  return { title, description, text: '', kind: 'none', reason: text.length ? `เนื้อสั้นเกิน (${text.length} ตัวอักษร)` : 'ไม่พบย่อหน้าเนื้อหาในหน้า (อาจเป็น PDF ฝัง หรือโหลดด้วย JS)' }
}

export function isYoutubeUrl(url = '') {
  return /youtube\.com|youtu\.be/i.test(String(url || ''))
}

export function isFacebookUrl(url = '') {
  return /(^|[./])(facebook\.com|fb\.com|fb\.watch)(\/|$)/i.test(String(url || '').replace(/^https?:\/\//i, ''))
}

// ไอเดียที่ควรลองถอด: มีลิงก์ที่ไม่ใช่คลิป และ summary ยังไม่ใช่ข้อเท็จจริงที่ถอดแล้ว (📌) · ⚠️ จาก enrich รอบก่อนลองซ้ำได้เมื่อ retry = true
export function needsFacts(idea = {}, { retry = false } = {}) {
  const url = String(idea.url || '').trim()
  if (!url || isYoutubeUrl(url)) return false
  // ไอเดียจากตัวเฝ้าเพจ Facebook (source social): บอทดึงหน้า facebook.com ไม่ได้ (หน้าล็อกอิน · robots ห้าม) และข้อความโพสต์อยู่ใน summary แล้ว
  // (drafts.js อ่านเป็นข้อเท็จจริง) — ถ้าปล่อยให้ enrich ลอง จะเขียนทับ summary ด้วย ⚠️ แล้วไอเดียเสียข้อเท็จจริงไปเลย
  if (idea.source === 'social' || isFacebookUrl(url)) return false
  const s = String(idea.summary || '').trim()
  if (/^📌/.test(s)) return false
  if (/^⚠️ ดึง/.test(s) && !retry) return false
  return true
}

export function buildFactsPrompt({ idea, article, brand = {} }) {
  const system = [
    `คุณคือผู้ช่วยสรุปข้อเท็จจริงจากบทความให้ทีมคอนเทนต์ของ "${brand.brand || 'AssetX Estate'}" (ธุรกิจขายฝาก/จำนอง/นายหน้าอสังหาริมทรัพย์ไทย)`,
    'หน้าที่: อ่านข้อความต้นทางแล้วดึง "ข้อเท็จจริง" ออกมาเป็นข้อ ๆ เฉพาะที่ปรากฏในข้อความเท่านั้น',
    'กติกา:',
    '- ห้ามตีความ ห้ามคาดเดา ห้ามเติมความรู้ของตัวเอง ห้ามให้คำแนะนำ — เอาเฉพาะสิ่งที่ข้อความบอก',
    '- ตัวเลข วันที่ หน่วย ชื่อหน่วยงาน/บริษัท ให้คงตามต้นฉบับ (เลขไทยหรืออารบิกตามต้นฉบับ) · ปี พ.ศ./ค.ศ. ตามต้นฉบับ',
    '- ห้ามใส่ชื่อบุคคลธรรมดา เบอร์โทร อีเมล เลขโฉนด เลขบัญชี — ถ้าต้นทางมี ให้ตัดชื่อออกเหลือตำแหน่ง/บทบาท',
    `- ไม่เกิน ${MAX_FACTS} ข้อ แต่ละข้อประโยคเดียวไม่เกิน 160 ตัวอักษร เรียงจากสำคัญมากไปน้อย`,
    '- ถ้าข้อความไม่เกี่ยวกับหัวข้อ หรือเป็นแค่หน้าเมนู/คำโฆษณา ให้ตอบ facts เป็น []',
    'ตอบเป็น JSON object เท่านั้น: {"facts":["…"],"date":"วันที่ของเหตุการณ์/ประกาศตามต้นฉบับ หรือ \\"\\" ถ้าไม่มี"}',
  ].join('\n')
  const prompt = [
    `หัวข้อไอเดีย: ${scrub(idea.title || '')}`,
    `แหล่ง: ${scrub(idea.source_label || idea.source || '')}`,
    `ชนิดข้อความ: ${article.kind === 'description' ? 'คำโปรยของหน้า (สั้น อาจไม่ครบ)' : 'เนื้อบทความ'}`,
    `ข้อความต้นทาง:\n${scrub(article.text).slice(0, ARTICLE_MAX_CHARS)}`,
    'สรุปข้อเท็จจริงเป็น JSON ตามที่กำหนด',
  ].join('\n\n')
  return { system, prompt }
}

export function parseFacts(data) {
  const obj = data && typeof data === 'object' && !Array.isArray(data) ? data : null
  const list = Array.isArray(obj?.facts) ? obj.facts : Array.isArray(data) ? data : null
  if (!list) return { ok: false, error: 'คำตอบไม่ใช่ JSON ที่มี facts' }
  const seen = new Set()
  const facts = []
  for (const item of list) {
    const text = scrub(String(item ?? '')).replace(/\s+/g, ' ').replace(/^[-•·\d.)\s]+/, '').trim()
    if (!text || text.length > FACT_MAX_CHARS || seen.has(text)) continue
    seen.add(text)
    facts.push(text)
    if (facts.length === MAX_FACTS) break
  }
  if (facts.length < 2) return { ok: false, error: `ได้ข้อเท็จจริง ${facts.length} ข้อ (ต้องอย่างน้อย 2)` }
  const date = scrub(String(obj?.date ?? '')).replace(/\s+/g, ' ').trim().slice(0, 40)
  return { ok: true, facts, date }
}

// summary รูปเดียวกับที่ตัวเก็บ/ปฏิทินใช้: ขึ้นต้น 📌 · ข้อคั่นด้วย · · ชนิดคำโปรยกำกับไว้ให้ตัวร่างรู้ว่าอาจไม่ครบ
export function factsSummary({ facts, date = '', kind = 'article' }) {
  const parts = [...facts]
  if (date) parts.push(`วันที่ตามต้นฉบับ: ${date}`)
  if (kind === 'description') parts.push('(สรุปจากคำโปรยของหน้าต้นทาง อาจไม่ครบทั้งเรื่อง)')
  return scrub(`📌 ${parts.join(' · ')}`).slice(0, 1900)
}

export function failedSummary(reason) {
  return `⚠️ ดึงเนื้อหาจากลิงก์ไม่ได้ (${String(reason || 'ไม่ทราบสาเหตุ').slice(0, 120)}) — มีแค่หัวข้อ ห้ามเดารายละเอียด`
}

// ทีละไอเดีย บันทึกทีละไอเดีย · ask = createAsk().askJson (Hermes → Ollama → Gemini) · fetcher = createFetcher() (มารยาทเดิม)
export async function enrichIdeas({ ideas, fetcher, ask, brand = {}, onSave, log = () => {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), delayMs = 1000, maxFetch = 15 }) {
  const done = []
  const failed = []
  let fetched = 0
  let stopped = false
  for (const idea of ideas) {
    if (stopped || fetched >= maxFetch) break
    fetched += 1
    const res = await fetcher(idea.url, { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' })
    if (!res.ok) {
      const reason = res.blocked ? `ต้นทางปฏิเสธบอท (HTTP ${res.status})` : (res.error || `HTTP ${res.status}`)
      failed.push({ id: idea.id, error: reason })
      log(`[enrich] #${idea.id} ดึงไม่ได้: ${reason}`)
      if (onSave) await onSave(idea.id, failedSummary(reason))
      continue
    }
    const article = extractArticle(res.text, { url: res.url || idea.url })
    if (article.kind === 'none') {
      failed.push({ id: idea.id, error: article.reason })
      log(`[enrich] #${idea.id} ไม่มีเนื้อให้ถอด: ${article.reason}`)
      if (onSave) await onSave(idea.id, failedSummary(article.reason))
      continue
    }
    let result = null
    let error = null
    for (let attempt = 0; attempt < 2 && !result; attempt += 1) {
      const { system, prompt } = buildFactsPrompt({ idea, article, brand })
      const answer = await ask({ system, prompt })
      if (!answer.ok) {
        error = answer.error
        if (/ไม่มีผู้ให้บริการ/.test(String(error || ''))) { stopped = true; break }
        continue
      }
      const parsed = parseFacts(answer.data)
      if (parsed.ok) result = { ...parsed, provider: answer.provider }
      else error = parsed.error
    }
    if (!result) {
      failed.push({ id: idea.id, error })
      log(`[enrich] #${idea.id} สรุปไม่ได้: ${error}`)
      if (stopped) break
      if (onSave) await onSave(idea.id, failedSummary(`AI สรุปไม่ได้: ${error}`))
    } else {
      const summary = factsSummary({ facts: result.facts, date: result.date, kind: article.kind })
      try {
        if (onSave) await onSave(idea.id, summary)
        done.push({ id: idea.id, facts: result.facts.length, kind: article.kind })
        log(`[enrich] #${idea.id} ได้ข้อเท็จจริง ${result.facts.length} ข้อ จาก${article.kind === 'description' ? 'คำโปรย' : 'เนื้อบทความ'} (${result.provider})`)
      } catch (saveError) {
        failed.push({ id: idea.id, error: `บันทึกไม่สำเร็จ: ${saveError?.message || saveError}` })
      }
    }
    if (delayMs) await sleep(delayMs)
  }
  return { done, failed, fetched, stopped }
}

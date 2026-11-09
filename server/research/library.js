// server/research/library.js — คลังรีเสิร์ช AssetX (Obsidian vault บนเครื่องนี้ นอกรีโป) + สำเนาข้อมูลรีเสิร์ชดิบรายสัปดาห์ในเครื่อง
//
// เจ้าของสั่ง 9 พ.ย. 2569: "เก็บข้อมูลที่ทำรีเสิร์ชไว้เป็นฐานข้อมูลในการปรับปรุงพัฒนาระบบของเราให้ดียิ่งขึ้น ทั้งในด้านการออกแบบ การตลาด และเชิงวิชาการ"
//   และ "ทำงานบนเครื่องนี้เป็นหลัก… เก็บไว้บนเครื่องนี้ก็ได้ไม่ต้องขึ้นไปบนเซิร์ฟเวอร์" → ไม่อัปโหลดที่ใด
// ทำไมไม่เก็บในรีโป: รีโปเป็นสาธารณะ — ข้อความโพสต์/คลิปของเพจอื่นและตัวอย่างดิบห้ามขึ้น GitHub · รีโปเก็บแค่ข้อสรุปที่มีที่มา (hook_patterns · knowledge_base)
// สำเนารายสัปดาห์ (_สำเนาข้อมูลดิบ/<วันที่>.json.gz · เก็บ 12 ชุด) กันเผลอลบ/เขียนทับ — ไม่กันคอมเสีย (เจ้าของเลือกเก็บในเครื่อง)
//
// โครงคลัง (ใต้ ASSETX_RESEARCH_LIBRARY_DIR · ค่าเริ่มต้น <โฟลเดอร์แม่ของรีโป>/AssetX Knowledge/Research/คลังรีเสิร์ช AssetX):
//   00 สารบัญ.md · 01 ออกแบบ/ · 02 การตลาด/ (+ สรุปรายสัปดาห์/) · 03 วิชาการ/ · _สำเนาข้อมูลดิบ/
//   ไฟล์ที่ขึ้นต้น "อัตโนมัติ -" ระบบเขียนทับทุกครั้ง (อย่าแก้ด้วยมือ) · ไฟล์อื่นเป็นโน้ตที่คนเขียน ระบบไม่แตะ
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const REPO = path.resolve(HERE, '..', '..')
export const DEFAULT_LIBRARY_DIR = process.env.ASSETX_RESEARCH_LIBRARY_DIR
  || path.resolve(REPO, '..', 'AssetX Knowledge', 'Research', 'คลังรีเสิร์ช AssetX')
export const SNAPSHOT_DIR = '_สำเนาข้อมูลดิบ'
export const SNAPSHOT_KEEP = 12
export const AREAS = { design: '01 ออกแบบ', marketing: '02 การตลาด', academic: '03 วิชาการ' }
export const AUTO_PREFIX = 'อัตโนมัติ - '

const median = (xs) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const firstLine = (t) => String(t || '').split('\n').map((l) => l.trim()).find(Boolean) || ''
const md = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400e3)

// สัปดาห์แบบ ISO "2026-W46" — ชื่อไฟล์สรุปรายสัปดาห์
export function isoWeek(dayIso) {
  const d = new Date(`${dayIso}T00:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow + 3)
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((d - firstThu) / 86400e3 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// ── หน้าที่สร้างจากไฟล์ในรีโป (ความจริงหลักอยู่ในรีโป · คลังเป็นที่อ่าน) ──────────────
export function knowledgePage(kb, { today }) {
  const sources = kb.sources || {}
  const lines = [
    `# ${AUTO_PREFIX}คลังความรู้กฎหมายและค่าธรรมเนียม ขายฝาก-จำนอง`,
    '',
    `> สร้างจาก \`research/knowledge_base.json\` (ปรับปรุง ${kb.updated || '-'}) เมื่อ ${today} · แก้ที่ไฟล์ในรีโปเท่านั้น หน้านี้ถูกเขียนทับ`,
    '> official = อ่านจากตัวบท/หน้าทางการแล้ว อ้างได้ · secondary = ตัวเลขจากแหล่งรอง ต้องให้ผู้อ่านยืนยันกับสำนักงานที่ดิน',
    '',
    '| ข้อ | ข้อเท็จจริง | อ้างอิง | ความมั่นใจ |',
    '|---|---|---|---|',
  ]
  for (const e of kb.entries || []) {
    const src = sources[e.source] || {}
    const ref = [src.cite || src.label || e.source, e.ref].filter(Boolean).join(' ')
    lines.push(`| ${md(e.id)} | ${md(e.fact)} | ${src.url ? `[${md(ref)}](${src.url})` : md(ref)} | ${e.confidence === 'official' ? 'official' : 'secondary'} |`)
  }
  lines.push('', '## แหล่ง', '')
  for (const [k, s] of Object.entries(sources)) lines.push(`- **${md(k)}** — ${md(s.label || s.cite || '')}${s.url ? ` · ${s.url}` : ''}${s.official ? ' · ทางการ' : ''}`)
  return `${lines.join('\n')}\n`
}

export function hookPage(lib, lessons, { today }) {
  const lines = [
    `# ${AUTO_PREFIX}สูตร hook และบทเรียนจากของไวรัล`,
    '',
    `> สร้างจาก \`research/hook_patterns.json\` (ปรับปรุง ${lib.updated || '-'}) + บทเรียนรายสัปดาห์ในเครื่อง เมื่อ ${today} · รายละเอียดรีเสิร์ชอยู่ที่ docs/hook-system.md และโน้ต "Hook - รีเสิร์ชของไวรัลไทยและหลักฐาน"`,
    '',
    '## กติกาทุก hook',
    '',
    ...(lib.rules || []).map((r) => `- ${r}`),
    '',
    '## สูตร',
    '',
    '| สูตร | ใช้กับโครง | ตัวอย่างโครง | หลักฐาน | บทเรียน (lift · ตัวอย่าง) |',
    '|---|---|---|---|---|',
  ]
  for (const p of lib.patterns || []) {
    const l = lessons?.patterns?.[p.id]
    lines.push(`| ${md(p.name)} (\`${p.id}\`) | ${md(p.formats.join(', '))} | ${md(p.example?.line)} | ${md(p.evidence)} | ${l ? `×${l.lift ?? '-'} · ${l.hot}/${l.n}` : '-'} |`)
  }
  if (lessons?.patterns) {
    const market = Object.entries(lessons.patterns).filter(([id]) => !(lib.patterns || []).some((p) => p.id === id))
    if (market.length) {
      lines.push('', '## สูตรที่พบในตลาดแต่เราไม่ใช้ (เทียบไว้ดู)', '', '| สูตร | lift | แรง/ทั้งหมด |', '|---|---|---|')
      for (const [id, l] of market.sort((a, b) => (b[1].lift ?? 0) - (a[1].lift ?? 0))) lines.push(`| \`${id}\` | ×${l.lift ?? '-'} | ${l.hot}/${l.n} |`)
    }
    lines.push('', `ตัวอย่างสะสม ${lessons.samples?.total ?? 0} · แรงกว่าปกติ ${lessons.samples?.hot ?? 0} · บทเรียนล่าสุด ${String(lessons.updated || '').slice(0, 10)}`)
  }
  return `${lines.join('\n')}\n`
}

// ── สรุปรายสัปดาห์ (ข้อมูลจากของที่ระบบเก็บในเครื่อง) ──────────────────────────────
// fb = [{ page, posts: {key: rec}, reels: {id: rec} }] · ads = ads.json · lessons · ideas = สถิติคิวไอเดีย (ไม่บังคับ)
export function weeklyDigest({ today, fb = [], ads = null, lessons = null, ideas = null, days = 7 }) {
  const inWindow = (d) => d && dayDiff(d, today) >= 0 && dayDiff(d, today) < days
  const eng = (m = {}) => (m.reactions || 0) + 2 * (m.comments || 0) + 3 * (m.shares || 0)
  const hotPosts = []
  const hotReels = []
  let seenPosts = 0
  for (const page of fb) {
    const posts = Object.entries(page.posts || {})
    const base = median(posts.map(([, r]) => eng(r.m)).filter((v) => v > 0))
    for (const [key, r] of posts) {
      if (!inWindow(r.first_seen) && !inWindow(r.last_seen)) continue
      seenPosts += 1
      const e = eng(r.m)
      if (base && e >= 10 && e / base >= 2) hotPosts.push({ page: page.page, ratio: Math.round((e / base) * 10) / 10, e, head: firstLine(r.caption).slice(0, 110), link: r.link, key })
    }
    const reels = Object.entries(page.reels || {})
    const baseR = median(reels.map(([, r]) => r.views).filter((v) => v > 0))
    for (const [id, r] of reels) {
      if (!r.reported || !inWindow(r.reported)) continue
      hotReels.push({ page: page.page, views: r.views, ratio: baseR ? Math.round((r.views / baseR) * 10) / 10 : null, head: firstLine(r.caption).slice(0, 110), link: r.link || `https://www.facebook.com/reel/${id}` })
    }
  }
  hotPosts.sort((a, b) => b.ratio - a.ratio)
  const adList = Object.values(ads?.ads || {})
  // แอดเดียวกันหลายเวอร์ชันของเจ้าเดียว (บรรทัดแรกเหมือนกัน) นับเป็นชิ้นเดียว
  const seenAd = new Set()
  const newAds = adList.filter((a) => inWindow(a.first_seen)).filter((a) => { const k = `${a.page}|${firstLine(a.text).slice(0, 60)}`; if (seenAd.has(k)) return false; seenAd.add(k); return true })
  const lines = [
    `# ${AUTO_PREFIX}สรุปรีเสิร์ชรายสัปดาห์ ${isoWeek(today)}`,
    '',
    `> ช่วง ${days} วันถึง ${today} · เขียนโดย \`npm run research -- library\` (ทุก 7 วันในรอบรีเสิร์ช) · ข้อความของเพจอื่นผ่านตัวลบข้อมูลบุคคลแล้ว ใช้ศึกษาเท่านั้น ห้ามลอกลงโพสต์เรา`,
    '',
    '## การตลาด: โพสต์ที่แรงกว่าปกติของเพจ (Facebook)',
    '',
    `เพจที่มีข้อมูล ${fb.length} · โพสต์ที่เห็นในช่วงนี้ ${seenPosts} · แรงกว่าปกติ (≥ 2 เท่าของค่ากลางเพจ และ ≥ 10 เอ็นเกจ) ${hotPosts.length}`,
    '',
  ]
  if (hotPosts.length) {
    lines.push('| เพจ | แรง | บรรทัดแรก | ลิงก์ |', '|---|---|---|---|')
    for (const p of hotPosts.slice(0, 15)) lines.push(`| ${md(p.page)} | ×${p.ratio} (${p.e}) | ${md(p.head)} | ${p.link ? `[เปิด](${p.link})` : '-'} |`)
  } else lines.push('ยังไม่มีโพสต์แรงกว่าปกติในช่วงนี้')
  lines.push('', '## การตลาด: คลิป Reels ที่แรงกว่าปกติ', '')
  if (hotReels.length) {
    lines.push('| เพจ | วิว | แรง | คำบรรยาย (บรรทัดแรก) | ลิงก์ |', '|---|---|---|---|---|')
    for (const r of hotReels) lines.push(`| ${md(r.page)} | ${r.views} | ${r.ratio ? `×${r.ratio}` : '-'} | ${md(r.head) || '(ยังไม่ได้อ่าน)'} | [เปิด](${r.link}) |`)
  } else lines.push('ยังไม่มีคลิปแรงกว่าปกติในช่วงนี้')
  lines.push('', '## การตลาด: แอดคู่แข่ง (Meta Ad Library)', '', `แอดในคลัง ${adList.length} · เห็นครั้งแรกในช่วงนี้ ${newAds.length}`)
  for (const a of newAds.slice(0, 10)) lines.push(`- ${md(a.page)} · ${md(firstLine(a.text).slice(0, 110))}`)
  lines.push('', '## การตลาด: บทเรียน hook', '')
  if (lessons?.patterns) {
    const top = Object.entries(lessons.patterns).filter(([, p]) => p.n >= 5 && Number.isFinite(p.lift)).sort((a, b) => b[1].lift - a[1].lift).slice(0, 8)
    lines.push(`ตัวอย่างสะสม ${lessons.samples?.total ?? 0} · แรง ${lessons.samples?.hot ?? 0} · ปรับปรุง ${String(lessons.updated || '').slice(0, 10)}`, '')
    for (const [id, p] of top) lines.push(`- \`${id}\` ×${p.lift} (${p.hot}/${p.n})`)
  } else lines.push('ยังไม่มีบทเรียน')
  if (ideas) {
    lines.push('', '## คิวไอเดีย', '', `ไอเดียใหม่ในช่วงนี้ ${ideas.newIdeas ?? '-'} · มีร่าง AI ${ideas.drafted ?? '-'} · ร่างที่มี hook ${ideas.withHooks ?? '-'}${ideas.hookPatterns ? ` · สูตรที่ใช้: ${Object.entries(ideas.hookPatterns).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}` : ''}`)
  }
  lines.push('', '## ใช้ปรับปรุงระบบอย่างไร', '', '- โพสต์/คลิปที่แรง: ดูว่าเปิดด้วยสูตรไหน ถ้าเป็นรูปแบบใหม่ที่ไม่มีในคลังสูตร hook ให้เพิ่ม (research/hook_patterns.json · ต้องมีหลักฐาน)', '- คำถามที่วนซ้ำในคลิป/โพสต์: ถ้าเป็นข้อกฎหมาย/ค่าธรรมเนียมที่ยังไม่มีในคลังความรู้ ให้ตรวจกับแหล่งทางการแล้วเพิ่ม (research/knowledge_base.json)', '- ภาพ/รูปแบบโปสเตอร์ของคู่แข่งที่คนตอบรับ: จดลงโน้ตในหมวดออกแบบ')
  return `${lines.join('\n')}\n`
}

export function indexPage({ today, notes = {} }) {
  const lines = [
    '# คลังรีเสิร์ช AssetX — สารบัญ',
    '',
    `> ปรับปรุงสารบัญ ${today} · คลังนี้อยู่บนเครื่องนี้เท่านั้น นอกรีโป ไม่ขึ้น GitHub หรือเซิร์ฟเวอร์ (เจ้าของเลือก) · สำเนาข้อมูลดิบรายสัปดาห์อยู่ใน \`${SNAPSHOT_DIR}/\` (เก็บ ${SNAPSHOT_KEEP} ชุด)`,
    '> ไฟล์ที่ขึ้นต้น "อัตโนมัติ -" ระบบเขียนทับทุกครั้ง · ไฟล์อื่นเป็นโน้ตที่เขียนเอง ระบบไม่แตะ · ห้ามใส่ข้อมูลลูกค้า เลขโฉนด เบอร์โทร',
    '',
    '## ใช้ทำอะไร',
    '',
    'เก็บสิ่งที่รีเสิร์ชมาแล้วไว้เป็นฐานในการปรับปรุงระบบ 3 ด้าน: **ออกแบบ** (โปสเตอร์ แบรนด์) · **การตลาด** (hook โพสต์ เพจคู่แข่ง คลิป แอด) · **วิชาการ** (กฎหมาย ค่าธรรมเนียม งานวิจัย กติกาแพลตฟอร์ม)',
    'ความจริงที่ระบบใช้งานจริงอยู่ในรีโป (`research/hook_patterns.json` · `research/knowledge_base.json` · `research/social_watch.json` · `src/lib/posterFree.js`) — คลังนี้เก็บที่มา เหตุผล และข้อมูลดิบที่ขึ้นรีโปไม่ได้',
    '',
  ]
  for (const [key, title] of Object.entries(AREAS)) {
    lines.push(`## ${title}`, '')
    const list = notes[key] || []
    if (list.length) for (const n of list) lines.push(`- [[${n}]]`)
    else lines.push('- (ยังไม่มีโน้ต)')
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

// รายชื่อโน้ตในแต่ละหมวด (ชื่อไฟล์ไม่รวม .md · โฟลเดอร์ย่อยนับด้วย) — ใช้ทำสารบัญ
export function listNotes(dir) {
  const out = {}
  for (const [key, title] of Object.entries(AREAS)) {
    const base = path.join(dir, title)
    const acc = []
    const walk = (d, rel = '') => {
      if (!fs.existsSync(d)) return
      for (const f of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'th'))) {
        if (f.isDirectory()) walk(path.join(d, f.name), `${rel}${f.name}/`)
        else if (f.name.endsWith('.md')) acc.push(`${title}/${rel}${f.name.replace(/\.md$/, '')}`)
      }
    }
    walk(base)
    out[key] = acc
  }
  return out
}

export function writeIfChanged(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  if (old === text) return false
  fs.writeFileSync(file, text, 'utf8')
  return true
}

// ── สำเนาข้อมูลดิบรายสัปดาห์ (ในเครื่อง) ────────────────────────────────────────
// ห่อไฟล์ข้อความทั้งหมดในโฟลเดอร์ที่กำหนดเป็น JSON ก้อนเดียวแล้ว gzip — ไม่ต้องพึ่ง tar · กู้คืนด้วย restoreBundle
export function collectFiles(roots = [], { maxBytes = 5 * 1024 * 1024, exts = /\.(json|jsonl|md|txt|log)$/i } = {}) {
  const files = {}
  for (const { dir, as } of roots) {
    if (!dir || !fs.existsSync(dir)) continue
    const walk = (d, rel) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name)
        const r = rel ? `${rel}/${f.name}` : f.name
        if (f.isDirectory()) walk(p, r)
        else if (exts.test(f.name) && fs.statSync(p).size <= maxBytes) files[`${as}/${r}`] = fs.readFileSync(p, 'utf8')
      }
    }
    walk(dir, '')
  }
  return files
}
export function makeBundle(files, { createdAt = new Date().toISOString() } = {}) {
  return zlib.gzipSync(Buffer.from(JSON.stringify({ kind: 'assetx-research-archive', version: 1, created_at: createdAt, files }), 'utf8'))
}
export function restoreBundle(buf) {
  const data = JSON.parse(zlib.gunzipSync(buf).toString('utf8'))
  if (data?.kind !== 'assetx-research-archive') throw new Error('ไม่ใช่ไฟล์สำรองคลังรีเสิร์ช AssetX')
  return data
}

// เขียนสำเนาลง <คลัง>/_สำเนาข้อมูลดิบ/<วันที่>.json.gz แล้วลบชุดเก่าเกิน keep (เรียงตามชื่อ = วันที่) · คืน { file, bytes, removed }
export function writeLocalSnapshot(libraryDir, buf, { day, keep = SNAPSHOT_KEEP } = {}) {
  const dir = path.join(libraryDir, SNAPSHOT_DIR)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${day}.json.gz`)
  fs.writeFileSync(file, buf)
  const all = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json\.gz$/.test(f)).sort()
  const removed = all.slice(0, Math.max(0, all.length - keep))
  for (const f of removed) fs.unlinkSync(path.join(dir, f))
  return { file, bytes: buf.length, removed: removed.length }
}

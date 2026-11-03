// กุญแจกลางของ Chrome profile Research ที่ใช้ร่วมกับ DivisionX Card — ฝั่ง Node (สำหรับ AssetX)
// คู่กับ deploy/agents/shared_browser.py ของ DVX · รูปไฟล์/ความหมายต้องตรงกันทุกตัว (ทดสอบข้ามภาษาแล้ว 3 พ.ย. 2569)
// ข้อตกลงเต็ม: ../profiles/shared-browser-dvx-assetx.md · ไม่มี dependency · Node 18+ · ESM
//
//   import { Lock, blockedFor, pagesOn } from './shared-browser.mjs'
//   const lock = new Lock('assetx', { purpose: 'facebook_watch' })
//   if (!(await lock.acquire({ waitMs: 20 * 60e3 }))) return            // DVX ใช้อยู่ — ข้ามรอบ
//   try {
//     for (const page of picks) { lock.logUsage({ facebook: 1 }, 'open'); /* แล้วค่อยเปิดเพจ · lock.require() ก่อนทุกคำสั่ง OpenCLI */ }
//   } finally {
//     try { if (lock.held) lock.logUsage({}, result, { opened }) } catch {}  // แถวสรุป · กุญแจหลุดแล้วห้ามโยนต่อ
//     lock.release()                                                       // ปล่อยเสมอ
//   }
//   ลำดับเต็ม + กติกาที่ต้องทำครบ: ข้อตกลงข้อ 4.6–4.7
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

export const STALE_MS = 10 * 60 * 1000 // ไม่มีสัญญาณชีพเกิน 10 นาที = กุญแจค้าง ยึดได้
export const BLOCK_DAYS = 3 // บัญชีโดนขอยืนยันตัวตน → พักแพลตฟอร์มนั้น 3 วันทั้งสองโปรเจกต์

export class LostLock extends Error {
  constructor(msg = 'กุญแจ browser หลุดมือ (ค้างนานจนอีกโปรเจกต์ยึดไป)') {
    super(msg)
    this.name = 'LostLock'
  }
}

export function defaultDir() {
  return process.env.RESEARCH_BROWSER_DIR || path.join(os.homedir(), '.research-browser')
}

// เวลาไทย (UTC+7) แบบเดียวกับฝั่ง Python: วันที่ "YYYY-MM-DD" · เวลา "YYYY-MM-DDTHH:MM:SS+07:00"
const thShift = () => new Date(Date.now() + 7 * 3600e3)
export const todayIso = () => thShift().toISOString().slice(0, 10)
export const nowIso = () => thShift().toISOString().slice(0, 19) + '+07:00'

function napSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

// Windows ลบ/แทนไฟล์ที่อีกโปรเซสเปิดอ่านค้างไม่ได้ (Python เปิดไฟล์โดยไม่ให้ลบร่วม) — การอ่านสั้นมาก รอแป๊บแล้วลองใหม่
function retry(fn, tries = 6, waitMs = 250) {
  for (let i = 0; ; i++) {
    try {
      return fn()
    } catch (e) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code) || i >= tries - 1) throw e
      napSync(waitMs)
    }
  }
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function writeJson(p, obj) {
  const tmp = `${p}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1), 'utf8')
  retry(() => fs.renameSync(tmp, p)) // rename ของ Node แทนไฟล์เดิมแบบ atomic (Python ใช้ os.replace)
}

const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400e3)

export function readState(base = defaultDir()) {
  const st = readJson(path.join(base, 'state.json'))
  const out = st && typeof st === 'object' && !Array.isArray(st) ? st : {}
  if (!out.blocked || typeof out.blocked !== 'object' || Array.isArray(out.blocked)) out.blocked = {}
  return out
}

/** แถว blocked ของแพลตฟอร์มนั้นถ้ายังไม่ครบ 3 วัน ไม่งั้น null · today = "YYYY-MM-DD" (เวลาไทย) */
export function blockedFor(platform, today = todayIso(), base = defaultDir()) {
  const b = readState(base).blocked[platform]
  if (!b || !b.at || !/^\d{4}-\d{2}-\d{2}$/.test(b.at)) return null
  const d = dayDiff(b.at, today)
  return Number.isFinite(d) && d < BLOCK_DAYS ? b : null
}

export function usageRows(base = defaultDir()) {
  let text = ''
  try {
    text = fs.readFileSync(path.join(base, 'usage.jsonl'), 'utf8')
  } catch {
    return []
  }
  const rows = []
  for (const ln of text.split(/\r?\n/)) {
    if (!ln.trim()) continue
    try {
      const r = JSON.parse(ln)
      if (r && typeof r === 'object') rows.push(r)
    } catch {
      // บรรทัดเสีย (เขียนค้างตอนเครื่องดับ) ข้ามไป ไม่ล้มทั้งไฟล์
    }
  }
  return rows
}

/** เพจที่เปิดในวันนั้นต่อแพลตฟอร์ม รวมทุกโปรเจกต์ → { facebook: 7, ... } */
export function pagesOn(dayIso = todayIso(), base = defaultDir(), rows = null) {
  const total = {}
  for (const r of rows ?? usageRows(base)) {
    if (r.date !== dayIso) continue
    for (const [k, v] of Object.entries(r.pages || {})) {
      if (typeof v === 'number' && v > 0) total[k] = (total[k] || 0) + Math.trunc(v)
    }
  }
  return total
}

export class Lock {
  /** project = ชื่อสั้นของโปรเจกต์ ("assetx" / "dvx") */
  constructor(project, { purpose = '', base = defaultDir() } = {}) {
    this.project = project
    this.purpose = purpose
    this.dir = base
    this.path = path.join(base, 'lock.json')
    this.token = crypto.randomBytes(8).toString('hex')
    this.held = false
    this.started = null
    this.stolenFrom = null // ยึดกุญแจค้างของใครมา (ไว้รายงาน)
  }

  tryAcquire() {
    fs.mkdirSync(this.dir, { recursive: true })
    for (let i = 0; i < 3; i++) {
      let fd
      try {
        fd = fs.openSync(this.path, 'wx') // O_CREAT|O_EXCL — ใครสร้างได้คนนั้นถือ
      } catch (e) {
        if (e.code === 'EEXIST') {
          if (!this.#clearIfStale()) return false
          continue
        }
        if (['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) return false // อีกฝั่งกำลังลบอยู่พอดี
        throw e
      }
      this.started = nowIso()
      const info = { project: this.project, token: this.token, pid: process.pid, host: os.hostname(),
        purpose: this.purpose, started_at: this.started }
      fs.writeSync(fd, JSON.stringify(info))
      fs.closeSync(fd)
      this.held = true
      return true
    }
    return false
  }

  /** รอได้สูงสุด waitMs → true ถ้าได้กุญแจ */
  async acquire({ waitMs = 0, pollMs = 20e3 } = {}) {
    const end = Date.now() + Math.max(waitMs, 0)
    for (;;) {
      if (this.tryAcquire()) return true
      const left = end - Date.now()
      if (left <= 0) return false
      await new Promise((r) => setTimeout(r, Math.min(pollMs, Math.max(left, 500))))
    }
  }

  #clearIfStale() {
    let st
    try {
      st = fs.statSync(this.path)
    } catch (e) {
      return e.code === 'ENOENT'
    }
    if (Date.now() - st.mtimeMs < STALE_MS) return false
    const grave = path.join(this.dir, `lock.stale-${this.token}.json`)
    try {
      fs.renameSync(this.path, grave)
    } catch (e) {
      return e.code === 'ENOENT'
    }
    let fresh = false
    try {
      fresh = Date.now() - fs.statSync(grave).mtimeMs < STALE_MS
    } catch {}
    if (fresh) {
      // ระหว่างเราดูอายุกับย้าย มีคนยึดแล้วสร้างกุญแจสดใหม่ — คืนที่เดิม (link ไม่ทับไฟล์ที่มีอยู่ · คง mtime)
      try {
        fs.linkSync(grave, this.path)
      } catch {}
      try {
        retry(() => fs.unlinkSync(grave))
      } catch {}
      return false
    }
    this.stolenFrom = readJson(grave) || {}
    try {
      retry(() => fs.unlinkSync(grave))
    } catch {}
    return true
  }

  /** ใครถือกุญแจอยู่ → { project, purpose, started_at, idle_sec, ... } หรือ null ถ้าว่าง */
  holder() {
    let st
    try {
      st = fs.statSync(this.path)
    } catch {
      return null
    }
    return { ...(readJson(this.path) || {}), idle_sec: Math.trunc((Date.now() - st.mtimeMs) / 1000) }
  }

  /** สัญญาณชีพ — เรียกก่อนทุกคำสั่ง OpenCLI · false = กุญแจไม่ใช่ของเราแล้ว (ห้ามใช้ browser ต่อ) */
  beat() {
    if (!this.held) return false
    const cur = readJson(this.path)
    if (!cur || cur.token !== this.token) {
      this.held = false
      return false
    }
    try {
      const t = new Date()
      fs.utimesSync(this.path, t, t)
    } catch {}
    return true
  }

  require() {
    if (!this.beat()) throw new LostLock()
  }

  release() {
    if (!this.held) return
    const cur = readJson(this.path)
    if (cur && cur.token === this.token) {
      try {
        retry(() => fs.unlinkSync(this.path))
      } catch {}
    }
    this.held = false
  }

  // ── เขียนของร่วม (ต้องถือกุญแจ) ──
  setBlocked(platform, why, day = todayIso()) {
    this.require()
    const st = readState(this.dir)
    st.blocked[platform] = { at: day, why: String(why).slice(0, 300), by: this.project, time: nowIso() }
    st.updated_at = nowIso()
    st.updated_by = this.project
    writeJson(path.join(this.dir, 'state.json'), st)
  }

  /** อ่านสำเร็จ = บัญชีกลับมาใช้ได้ → ลบสถานะพักของแพลตฟอร์มนั้น (เขียนเฉพาะตอนมีแถว) */
  clearBlocked(platform) {
    const st = readState(this.dir)
    if (!(platform in st.blocked)) return false
    this.require()
    delete st.blocked[platform]
    st.updated_at = nowIso()
    st.updated_by = this.project
    writeJson(path.join(this.dir, 'state.json'), st)
    return true
  }

  /**
   * จดการใช้บัญชีร่วม (ต้องถือกุญแจ) — เพดานรวมนับจาก `pages` ของทุกแถว
   * จดทีละเพจ **ก่อนเปิด**: logUsage({ facebook: 1 }, 'open') — รอบที่โดนฆ่า/กุญแจหลุดกลางทางก็ยังนับเพจที่เปิดไปแล้ว
   * (นับเกินได้ 1 ดีกว่านับขาด) · จบรอบ: logUsage({}, ผล, { opened: ยอดรวม }) แถวสรุป ไม่นับซ้ำ
   */
  logUsage(pages, result = 'ok', { note = '', day = todayIso(), opened = null } = {}) {
    this.require()
    const ints = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v).map(([k, v]) => [k, Math.trunc(v)]))
    const row = { project: this.project, date: day, start: this.started, end: nowIso(), pages: ints(pages), result }
    if (opened && Object.keys(ints(opened)).length) row.opened = ints(opened)
    if (note) row.note = String(note).slice(0, 200)
    const file = path.join(this.dir, 'usage.jsonl')
    let lead = ''
    try {
      const fd = fs.openSync(file, 'r')
      try {
        const { size } = fs.fstatSync(fd)
        const b = Buffer.alloc(1)
        // บรรทัดก่อนขาดตอนเครื่องดับ (หรือท้ายเป็น NUL) — ปิดบรรทัดก่อน แถวนี้จะได้ไม่หายไปด้วย
        if (size && fs.readSync(fd, b, 0, 1, size - 1) === 1 && b[0] !== 0x0a) lead = '\n'
      } finally {
        fs.closeSync(fd)
      }
    } catch {}
    fs.appendFileSync(file, lead + JSON.stringify(row) + '\n', 'utf8')
  }
}

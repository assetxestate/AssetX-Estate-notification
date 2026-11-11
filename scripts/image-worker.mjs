#!/usr/bin/env node
// scripts/image-worker.mjs — ตัวรับงานสร้างภาพบนคอมสำนักงาน
// หยิบงานจากตาราง marketing_image_jobs (หน้า /marketing สั่ง) → สร้างภาพผ่านปลั๊กอิน gpt-image (Codex CLI ที่ล็อกอิน ChatGPT Plus)
// → แปลงเป็น JPG → อัปโหลดขึ้น bucket marketing-images → ตั้งงานเป็น done ให้หน้าเว็บดึงภาพไปใช้
// + คิว "คิดคอนเทนต์ใหม่ด้วย AI" (ตาราง marketing_content_jobs · 9 พ.ย. 2569) เป็นลูปที่สอง: Codex คิดมุมเล่าใหม่ + ร่างเต็ม (server/research/fresh.js) → มุมใหม่ไปอยู่ช่องแรกของไอเดีย
// + โปสเตอร์โหมดพรีเมียม (9 พ.ย. 2569): Codex วางบรีฟ 6 ส่วน + ข้อความบนภาพก่อน (server/poster-premium-plan.js) แล้วจึงเจนภาพ (src/lib/posterPremium.js)
//
// npm run image-worker              รับงานไปเรื่อย ๆ (ปิดด้วย Ctrl+C) · ส่งสัญญาณ "เปิดอยู่" ทุก 30 วินาที
// npm run image-worker -- --once    ทำงานในคิวงานเดียวแล้วจบ (ไว้ทดสอบ)
// npm run image-worker -- --check   เช็กการตั้งค่า + ส่งสัญญาณครั้งเดียว ไม่หยิบงาน
// scripts/image-worker-hidden.vbs   เปิดแบบซ่อนหน้าต่าง + --log (วางทางลัดไว้ใน shell:startup ให้เปิดเองตอนล็อกอิน Windows)
//
// ต้องมี: SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL ใน .env.local · ปลั๊กอิน gpt-image (GPT_IMAGE_SERVER ชี้ไฟล์ server/index.mjs)
// ภาพดิบเก็บใน .local/image-jobs/ (อยู่ใน .gitignore) · log ไม่พิมพ์เนื้อหาโพสต์
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IMAGE_BUCKET, WORKER_ID } from '../server/marketing-image-jobs.js'
import { POSTER_SIZES } from '../src/lib/posterSizes.js'
import { createAsk, NO_PROVIDER_MESSAGE, ollamaConfigured } from '../server/research/llm.js'
import { enhanceBriefWithAi } from '../server/poster-brief-ai.js'
import { pickStyleRefs, syncPosterRefs } from '../server/poster-refs.js'
import { fillImagePlaceholders, PLACEHOLDER_IMAGES } from '../src/lib/posterV4.js'
import { parseVariantLine } from '../src/lib/posterVariants.js'
import { fillFreeImages, footerContactLines, parseFreeModeLine, PLACEHOLDER_FREE_IMAGES } from '../src/lib/posterFree.js'
import { scrub } from '../server/research/pii.js'
import { claimNextContentJob, CONTENT_JOB_TABLE, isMissingTable, processContentJob, releaseStaleContentJobs } from '../server/content-jobs-worker.js'
import { generateFreshContent } from '../server/research/fresh.js'
import { loadKnowledgeBase } from '../server/research/knowledge.js'
import { loadHookLessons, loadHookPatterns } from '../server/research/hooks.js'
import { buildPremiumImagePrompt, disclaimerLines, parsePremiumRequest, pickPremiumLayout, premiumFrame, premiumHasMiddle, premiumRefIndex } from '../src/lib/posterPremium.js'
import { planPremiumPoster } from '../server/poster-premium-plan.js'

// 2 = รับงานคิดคอนเทนต์ใหม่ได้ (หน้าเว็บดู info.content_jobs ว่าตัวรับงานที่เปิดอยู่เป็นรุ่นนี้หรือยัง)
// 3 = รับโปสเตอร์โหมดพรีเมียมได้ (info.premium_posters · 9 พ.ย. 2569)
const VERSION = '3'
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
config({ path: path.join(repo, '.env.local'), quiet: true })
config({ path: path.join(repo, '.env'), quiet: true })

const ONCE = process.argv.includes('--once')
const CHECK = process.argv.includes('--check')
const POLL_MS = 5 * 1000
const HEARTBEAT_MS = 30 * 1000
const GENERATE_TIMEOUT_MS = 9 * 60 * 1000
const LOCAL_DIR = path.join(repo, '.local')
const OUTPUT_DIR = path.join(LOCAL_DIR, 'image-jobs')
const LOCK_FILE = path.join(LOCAL_DIR, 'image_worker.lock')
// รูปตัวอย่างโปสเตอร์ที่เจ้าของส่งเข้าบอทเทเลแกรม (ตาราง poster_refs) → ดึงลงโฟลเดอร์นี้ทุก ๆ 20 วินาที (ดู server/poster-refs.js)
const REFS_INBOX = path.join(LOCAL_DIR, 'poster-refs', 'inbox')
const REF_SYNC_MS = 20 * 1000
const REF_SYNC_RETRY_MS = 10 * 60 * 1000
// โลโก้สำหรับแปะบนโปสเตอร์ = เฉพาะเครื่องหมาย X (public/logo-mark.jpg ตัดจาก logo.jpg 7 พ.ย. 2569) — ไฟล์เต็มมีข้อความ "AssetX Estate Co., Ltd." ติดมา โมเดลวาดซ้ำแล้วดูไม่เป็นมืออาชีพ (เจ้าของติ)
const LOGO_MARK = path.join(repo, 'public', 'logo-mark.jpg')
const LOGO = existsSync(LOGO_MARK) ? LOGO_MARK : path.join(repo, 'public', 'logo.jpg')
// v4 "ตามเรฟ" (7 พ.ย. 2569 ค่ำ): โลโก้เต็มพร้อมชื่อบริษัท (เจ้าของสั่ง) · รูปเจ้าของเป็นผู้แนะนำ (ไฟล์นอก git) · ภาพอ้างอิงสไตล์จากคลัง (ไม่เกิน 5 ภาพรวมกัน = เพดานของ Codex)
const LOGO_FULL = path.join(repo, 'public', 'logo-full.jpg')
// แถบท้ายแบรนด์ของโหมดอิสระ (8 พ.ย. 2569): สคริปต์วาง · โลโก้แนวนอนพื้นโปร่งใส (scripts/make-logo-assets.py) · ฟอนต์ Kanit (OFL)
const FOOTER_SCRIPT = path.join(repo, 'scripts', 'poster-footer.ps1')
const FOOTER_LOGO = path.join(repo, 'public', 'logo-lockup-white.png')
const FOOTER_FONT = path.join(repo, 'scripts', 'assets', 'fonts', 'Kanit-Medium.ttf')
// บล็อกเบอร์/LINE สำเร็จรูป (9 พ.ย. 2569 เจ้าของขอให้พรีเมียม เป็นทางการ และใช้สัญลักษณ์ LINE ของจริง) — scripts/make-contact-block.mjs
// stacked = สองแถว (แนวตั้ง/จัตุรัส) · inline = แถวเดียว (แนวนอน) · ฟอนต์+ข้อความด้านบนเป็นทางสำรองของสคริปต์ ไม่ได้ใช้เมื่อมีภาพ
const FOOTER_CONTACT = path.join(repo, 'public', 'contact-block-stacked.png')
const FOOTER_CONTACT_INLINE = path.join(repo, 'public', 'contact-block-inline.png')
const REFS_ROOT = path.join(LOCAL_DIR, 'poster-refs')
const PRESENTER = path.join(REFS_ROOT, 'presenter', 'presenter-cut.jpg')
// โหมดพรีเมียม: ภาพต้นแบบที่เจ้าของชอบจากแชต Codex (9 พ.ย. 2569) — แนบ 1 ภาพต่องาน หมุนตาม seed · เพิ่มภาพที่ชอบลงโฟลเดอร์นี้ได้ (นอก git)
const PREMIUM_REFS = path.join(REFS_ROOT, 'premium')

function premiumRefs() {
  if (!existsSync(PREMIUM_REFS)) return []
  return readdirSync(PREMIUM_REFS).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort().map((f) => path.join(PREMIUM_REFS, f))
}

// โครงของงานพรีเมียมล่าสุด (ใหม่สุดก่อน) จากไฟล์แผนใน .local/image-jobs — ไฟล์ก่อนมีโครงหมุนเวียน (ก่อน 11 พ.ย. 2569) = classic
// ใช้เลี่ยงโครงซ้ำกับภาพที่เพิ่งทำ (เจ้าของ: ภาพพรีเมียม "ดูซ้ำและน่าเบื่อ")
function recentPremiumLayouts(count = 2) {
  if (!existsSync(OUTPUT_DIR)) return []
  return readdirSync(OUTPUT_DIR)
    .map((f) => Number((f.match(/^job-(\d+)-premium\.json$/) || [])[1]))
    .filter(Boolean)
    .sort((a, b) => b - a)
    .slice(0, count)
    .map((id) => {
      try { return JSON.parse(readFileSync(path.join(OUTPUT_DIR, `job-${id}-premium.json`), 'utf8')).layout || 'classic' } catch { return 'classic' }
    })
}
const MAX_IMAGES = 5
const PLUGIN_SERVER = process.env.GPT_IMAGE_SERVER || path.join('C:', 'tools', 'gpt-image-marketplace', 'gpt-image', 'server', 'index.mjs')

// --log = เขียนลง .local/image-worker.log ด้วย (ตอนเปิดแบบซ่อนหน้าต่างผ่าน scripts/image-worker-hidden.vbs ไม่มีหน้าจอให้ดู)
const LOG_FILE = process.argv.includes('--log') ? path.join(LOCAL_DIR, 'image-worker.log') : null
const log = (...args) => {
  const line = [new Date().toLocaleString('th-TH', { hour12: false }), '·', ...args].join(' ')
  console.log(line)
  if (LOG_FILE) {
    try { mkdirSync(LOCAL_DIR, { recursive: true }); appendFileSync(LOG_FILE, `${line}\n`) } catch { /* เขียน log ไม่ได้ไม่ทำให้งานหยุด */ }
  }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const shortError = (err) => scrub(String(err?.message || err || 'ไม่ทราบสาเหตุ')).replace(/\s+/g, ' ').trim().slice(0, 300)

// ---------------------------------------------------------------- กันเปิดซ้อน

function isAlive(pid) {
  try { process.kill(Number(pid), 0); return true } catch { return false }
}

async function acquireLock() {
  await fs.mkdir(LOCAL_DIR, { recursive: true })
  try {
    const previous = JSON.parse(await fs.readFile(LOCK_FILE, 'utf8'))
    if (previous?.pid && previous.pid !== process.pid && isAlive(previous.pid)) {
      throw new Error(`ตัวรับงานเปิดอยู่แล้ว (pid ${previous.pid}) — ไม่เปิดซ้อน`)
    }
  } catch (err) {
    if (err.code !== 'ENOENT' && !(err instanceof SyntaxError)) throw err
  }
  await fs.writeFile(LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))
}

async function releaseLock() {
  try {
    const current = JSON.parse(await fs.readFile(LOCK_FILE, 'utf8'))
    if (current?.pid === process.pid) await fs.unlink(LOCK_FILE)
  } catch { /* ไม่มีไฟล์ล็อกแล้ว */ }
}

// ---------------------------------------------------------------- คุยกับปลั๊กอิน gpt-image (MCP ผ่าน stdio)

class PluginClient {
  constructor(serverPath) {
    this.serverPath = serverPath
    this.child = null
    this.nextId = 1
    this.pending = new Map()
    this.buffer = ''
  }

  async start() {
    if (this.child) return
    const child = spawn(process.execPath, [this.serverPath], { cwd: OUTPUT_DIR, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    this.child = child
    this.buffer = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { if (this.child === child) this.onData(chunk) })
    child.stderr.on('data', () => { /* log ของปลั๊กอินไม่ต้องพิมพ์ (อาจมีข้อความ prompt) */ })
    child.stdin.on('error', () => { /* ปลั๊กอินปิดไปก่อนเขียนเสร็จ — exit จะจัดการต่อ */ })
    child.on('exit', (code) => {
      // ตัวเก่าที่ถูกสั่งปิดไปแล้วอาจออกช้ากว่าตัวใหม่ที่เปิดแทน → ไม่แตะงานของตัวใหม่
      if (this.child !== child) return
      this.child = null
      this.rejectAll(new Error(`ปลั๊กอินสร้างภาพปิดตัว (code ${code})`))
    })
    await this.request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'assetx-image-worker', version: VERSION } }, 30 * 1000)
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`)
  }

  rejectAll(error) {
    for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(error) }
    this.pending.clear()
  }

  onData(chunk) {
    this.buffer += chunk
    let newline
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline).trim()
      this.buffer = this.buffer.slice(newline + 1)
      if (!line) continue
      let message
      try { message = JSON.parse(line) } catch { continue }
      const waiting = this.pending.get(message.id)
      if (!waiting) continue
      this.pending.delete(message.id)
      clearTimeout(waiting.timer)
      if (message.error) waiting.reject(new Error(message.error.message || 'ปลั๊กอินตอบ error'))
      else waiting.resolve(message.result)
    }
  }

  request(method, params, timeoutMs) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`ปลั๊กอินไม่ตอบภายใน ${Math.round(timeoutMs / 1000)} วินาที`))
        this.stop()
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })
  }

  async callTool(name, args, timeoutMs) {
    await this.start()
    const result = await this.request('tools/call', { name, arguments: args }, timeoutMs)
    const text = (result?.content || []).filter((item) => item.type === 'text').map((item) => item.text).join('\n')
    if (result?.isError) throw new Error(text || 'สร้างภาพไม่สำเร็จ')
    return text
  }

  stop() {
    // ปิด stdin = ปลั๊กอินฆ่า codex ที่ค้างทั้งต้นแล้วจบเอง
    const child = this.child
    this.child = null
    this.rejectAll(new Error('ปิดปลั๊กอินสร้างภาพแล้ว'))
    try { child?.stdin.end() } catch { /* ปิดไปแล้ว */ }
  }
}

// ---------------------------------------------------------------- แปลงภาพเป็น JPG (Windows: System.Drawing ส่ง path ผ่าน env ไม่ต่อสตริงคำสั่ง)

// AX_TRIM=1: ตัด "แถบทึบบน-ล่าง" ที่คำสั่งภาพสั่งให้ทาไว้ (ขนาดที่ต้องครอป เช่น ฟีด 4:5 จากภาพ 2:3) ออกก่อนส่งขึ้นเว็บ
// — โมเดลวางแถบติดต่อเลยเส้นครอปราว 40–130 px แม้บอกพิกเซลตรง ๆ (ครอปจริง 7 ภาพ 7 พ.ย. 2569 ผ่าน 1) การตัดที่ "ขอบแถบทึบที่เห็นจริง" จึงแม่นกว่าตัดตามตัวเลข
// แถว = แถบทึบเมื่อทุกจุดที่สุ่ม (ทุก 16 px) เป็นน้ำเงินเข้มของแบรนด์ (8,33,63 ±40) หรือสีเดียวกันทั้งแถว (±10) · ตัดได้ข้างละไม่เกิน 25% ของความสูง · บางกว่า 24 px ไม่นับ (ขอบมืดของภาพถ่าย)
const TO_JPEG_PS = [
  'Add-Type -AssemblyName System.Drawing',
  '$img = [System.Drawing.Image]::FromFile($env:AX_SRC)',
  'try {',
  '  $w = $img.Width; $h = $img.Height; $top = 0; $bottom = $h; $left = 0; $cw = $w',
  "  if ($env:AX_TRIM -eq '1') {",
  '    $src = New-Object System.Drawing.Bitmap $img',
  // AX_BARS=black (คำสั่ง v4/โหมดอิสระสั่งแถบ BLACK #000000): นับเฉพาะแถวดำล้วนเป็นแถบ — แถวน้ำเงินเรียบหรือสีเรียบอื่นเป็นส่วนของงานออกแบบ (แถบติดต่อน้ำเงิน · พื้นงาช้าง)
  // ไม่ตั้ง = แบบเดิมของ v2 (แถบน้ำเงิน หรือแถวสีเดียวกันทั้งแถว)
  '    function Test-BarRow([int]$y) {',
  "      if ($env:AX_BARS -eq 'black') {",
  '        for ($x = 0; $x -lt $w; $x += 16) { $p = $src.GetPixel($x, $y); if ($p.R -gt 36 -or $p.G -gt 36 -or $p.B -gt 36) { return $false } }',
  '        return $true',
  '      }',
  '      $first = $src.GetPixel(0, $y); $navy = $true; $uniform = $true',
  '      for ($x = 0; $x -lt $w; $x += 16) {',
  '        $p = $src.GetPixel($x, $y)',
  '        if ([math]::Abs($p.R - 8) -gt 40 -or [math]::Abs($p.G - 33) -gt 40 -or [math]::Abs($p.B - 63) -gt 48) { $navy = $false }',
  '        if ([math]::Abs($p.R - $first.R) -gt 10 -or [math]::Abs($p.G - $first.G) -gt 10 -or [math]::Abs($p.B - $first.B) -gt 10) { $uniform = $false }',
  '        if (-not $navy -and -not $uniform) { return $false }',
  '      }',
  '      return $true',
  '    }',
  '    $limit = [int]($h * 0.25)',
  '    while ($top -lt $limit -and (Test-BarRow $top)) { $top++ }',
  '    while (($h - $bottom) -lt $limit -and (Test-BarRow ($bottom - 1))) { $bottom-- }',
  '    if ($top -lt 24) { $top = 0 }',
  '    if (($h - $bottom) -lt 24) { $bottom = $h }',
  '    $src.Dispose()',
  '    # หลังตัดแถบ ถ้าสัดส่วนใกล้เป้า (ภายใน 12%) ครอปกลางให้ตรงสัดส่วนแพลตฟอร์มพอดี (AX_RATIO = กว้าง/สูง)',
  '    $ratio = 0.0; [double]::TryParse($env:AX_RATIO, [ref]$ratio) | Out-Null',
  '    if ($ratio -gt 0) {',
  '      $want = [int][math]::Round($w / $ratio)',
  '      if ($want -lt ($bottom - $top) -and ($bottom - $top - $want) -lt (($bottom - $top) * 0.12)) {',
  // ส่วนเกินตัดจากด้านบน 70% (โซนบนเป็นม่านแสง/พื้นหลัง) ด้านล่าง 30% — แถบล่างมีป้ายชิดเส้นตัด (คิวงาน 6 ป้ายชิปโดนครอป)
  '        $extra = ($bottom - $top) - $want; $top += [int]($extra * 0.7); $bottom = $top + $want',
  '      } else {',
  // แถบที่วาดหนากว่าเส้นตัด (ภาพที่เหลือเตี้ยกว่าสัดส่วน เช่น 1024x1240 แทน 4:5) → ครอปซ้าย-ขวาเท่ากันให้ตรงสัดส่วน (8 พ.ย. 2569 งาน 13-14)
  '        $wantW = [int][math]::Round(($bottom - $top) * $ratio)',
  '        if ($wantW -lt $w -and ($w - $wantW) -lt ($w * 0.12)) { $left = [int](($w - $wantW) / 2); $cw = $wantW }',
  '      }',
  '    }',
  '  }',
  '  $ch = $bottom - $top',
  '  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }',
  '  $params = New-Object System.Drawing.Imaging.EncoderParameters 1',
  '  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 90L',
  '  $bmp = New-Object System.Drawing.Bitmap $cw, $ch',
  '  $g = [System.Drawing.Graphics]::FromImage($bmp)',
  '  $g.Clear([System.Drawing.Color]::White)',
  '  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $cw, $ch), (New-Object System.Drawing.Rectangle $left, $top, $cw, $ch), [System.Drawing.GraphicsUnit]::Pixel)',
  '  $g.Dispose()',
  '  $bmp.Save($env:AX_DST, $codec, $params)',
  '  $bmp.Dispose()',
  '  Write-Output "trim top=$top bottom=$($h - $bottom) left=$left size=${cw}x${ch}"',
  '} finally { $img.Dispose() }',
].join('\n')

// วางแถบท้ายแบรนด์ลงภาพที่ครอปแล้ว · คืนข้อความสรุปจากสคริปต์ · ล้ม = throw (ให้งานล้ม ไม่ส่งภาพที่ไม่มีช่องทางติดต่อ)
// append = ต่อแถบทึบใต้ภาพแทนการวางทับ (โหมดพรีเมียม) · ratio = สัดส่วนโพสต์สุดท้าย (แถบสูงพอดีให้ได้สัดส่วนนั้น)
function addBrandFooter(src, dst, { append = false, ratio = 0 } = {}) {
  const [phone, line] = footerContactLines()
  return new Promise((resolve, reject) => {
    let out = ''
    let err = ''
    const child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', FOOTER_SCRIPT,
      '-Src', src, '-Dst', dst, '-Logo', FOOTER_LOGO, '-Contact', FOOTER_CONTACT, '-ContactInline', FOOTER_CONTACT_INLINE,
      '-FontFile', FOOTER_FONT, '-Phone', phone, '-Line', line, ...(append ? ['-Append', ...(ratio ? ['-Ratio', String(ratio)] : [])] : [])], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', (d) => { out += String(d) })
    child.stderr.on('data', (d) => { err += String(d) })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 && existsSync(dst) && /footer F=/.test(out)
      ? resolve(out.trim())
      : reject(new Error(`วางแถบท้ายแบรนด์ไม่สำเร็จ (exit ${code}) ${err.replace(/\s+/g, ' ').slice(0, 200)}`))))
  })
}

function toJpeg(src, dst, { trim = false, ratio = 0, bars = '' } = {}) {
  if (process.platform !== 'win32') return Promise.resolve({ file: src, note: '' })
  return new Promise((resolve) => {
    let note = ''
    const child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', TO_JPEG_PS], {
      env: { ...process.env, AX_SRC: src, AX_DST: dst, AX_TRIM: trim ? '1' : '0', AX_RATIO: ratio ? String(ratio) : '', AX_BARS: bars }, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
    })
    child.stdout.on('data', (d) => { note += String(d) })
    child.on('exit', (code) => resolve(code === 0 && existsSync(dst) ? { file: dst, note: note.trim() } : { file: src, note: '' }))
    child.on('error', () => resolve({ file: src, note: '' }))
  })
}

// ---------------------------------------------------------------- งานในคิว

function database() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('ไม่พบ VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ใน .env.local')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function heartbeat(db, busyJob = null, busyContentJob = null) {
  const { error } = await db.from('marketing_image_worker').upsert({
    id: WORKER_ID,
    last_seen_at: new Date().toISOString(),
    info: { version: VERSION, host: os.hostname(), busy_job: busyJob, content_jobs: true, premium_posters: true, busy_content_job: busyContentJob },
  }, { onConflict: 'id' })
  if (error) throw error
}

// งานที่ค้าง running จากรอบก่อน (คอมดับ/ปิดหน้าต่างกลางคัน) → failed ให้หน้าเว็บสั่งใหม่ได้
async function releaseStaleJobs(db) {
  const { data, error } = await db.from('marketing_image_jobs')
    .update({ status: 'failed', error: 'ตัวรับงานบนคอมหยุดกลางคัน กดสร้างใหม่ได้', finished_at: new Date().toISOString() })
    .eq('status', 'running').eq('worker', WORKER_ID).select('id')
  if (error) throw error
  if (data?.length) log(`ปิดงานที่ค้างจากรอบก่อน ${data.length} งาน`)
}

async function claimNextJob(db) {
  const { data, error } = await db.from('marketing_image_jobs').select('id').eq('status', 'queued').order('created_at', { ascending: true }).limit(1)
  if (error) throw error
  const next = data?.[0]
  if (!next) return null
  const claimed = await db.from('marketing_image_jobs')
    .update({ status: 'running', claimed_at: new Date().toISOString(), worker: WORKER_ID })
    .eq('id', next.id).eq('status', 'queued')
    .select('id,content_no,prompt,aspect,size').maybeSingle()
  if (claimed.error) throw claimed.error
  return claimed.data // null = หน้าเว็บยกเลิกไปก่อนหยิบทัน
}

async function processJob(db, plugin, job) {
  const label = `งาน ${job.id}${job.content_no ? ` (#${job.content_no})` : ''}`
  const started = Date.now()
  log(`${label}: เริ่มสร้างภาพ`)
  try {
    let prompt = job.prompt
    let images = existsSync(LOGO) ? [LOGO] : []
    let brandFooter = false
    // โหมดพรีเมียม: กรอบงาน (แคนวาส · สัดส่วนที่ตัด · ต่อแถบท้ายใต้ภาพ) จาก premiumFrame
    let premiumBox = null
    const premium = parsePremiumRequest(job.prompt)
    if (premium) {
      // โหมดพรีเมียม (9 พ.ย. 2569): AI วางบรีฟ 6 ส่วน + ข้อความบนภาพก่อน (ตรวจตัวเลข/คำเกินจริง/มุมคนปล่อยเงิน) → คำสั่งภาพแบบเดียวกับพรอมต์ของ Codex
      // + ภาพต้นแบบที่เจ้าของชอบ 1 ภาพ · โลโก้/เบอร์/LINE = แถบท้ายทึบที่ "ต่อใต้ภาพ" หลังเจน (วางทับแล้ว CTA ของ Codex หาย — งาน 22)
      const missing = [FOOTER_SCRIPT, FOOTER_LOGO, FOOTER_FONT, FOOTER_CONTACT, FOOTER_CONTACT_INLINE].filter((f) => !existsSync(f))
      if (missing.length) throw new Error(`ไม่พบไฟล์แถบท้ายแบรนด์: ${missing.map((f) => path.relative(repo, f)).join(', ')}`)
      const say = (s) => log(`${label}: ${s}`)
      const ask = createAsk({ log: say })
      if (!ask.providers.length) throw new Error(NO_PROVIDER_MESSAGE)
      const t0 = Date.now()
      const planned = await planPremiumPoster({ title: premium.title, caption: premium.caption, ask, log: say })
      if (!planned.ok) throw new Error(`AI วางข้อความโปสเตอร์ไม่สำเร็จ — ${planned.error}`)
      const refs = premiumRefs()
      const ref = refs.length ? refs[premiumRefIndex(premium.seed, refs.length)] : null
      // รูปเจ้าของเป็นผู้แนะนำในภาพหลักทุกภาพ (เจ้าของ 10 พ.ย. 2569) — ภาพที่ 1 เสมอ แล้วตามด้วยเรฟสไตล์
      const presenter = existsSync(PRESENTER) ? PRESENTER : null
      images = [presenter, ref].filter(Boolean)
      // โครงภาพหมุนเวียน 5 แบบ (11 พ.ย. 2569) · เลี่ยงโครงของ 2 งานพรีเมียมล่าสุด
      const layout = pickPremiumLayout(premium.seed, { recent: recentPremiumLayouts(2), hasMiddle: premiumHasMiddle(planned.plan) })
      prompt = buildPremiumImagePrompt({ plan: planned.plan, size: premium.size, seed: premium.seed, refName: ref ? path.basename(ref) : '', presenter: Boolean(presenter), disclaimer: disclaimerLines(premium), layout: layout.id })
      brandFooter = true
      premiumBox = premiumFrame(premium.size)
      // เก็บแผน + คำสั่งภาพไว้ดูย้อนหลังในเครื่อง (.local อยู่นอก git) · log ไม่พิมพ์เนื้อหาโพสต์
      await fs.writeFile(path.join(OUTPUT_DIR, `job-${job.id}-premium.json`), JSON.stringify({ provider: planned.provider, attempts: planned.attempts, warnings: planned.warnings, ref: ref ? path.basename(ref) : null, presenter: Boolean(presenter), layout: layout.id, plan: planned.plan, prompt }, null, 2))
      log(`${label}: พรีเมียม · วางข้อความเสร็จใน ${Math.round((Date.now() - t0) / 1000)} วินาที (${planned.provider} รอบ ${planned.attempts}${planned.warnings.length ? ` · ยาวเกิน ${planned.warnings.length} จุด` : ''}) · ข้อหลัก ${planned.plan.points.length} ข้อ · แถบกลาง ${planned.plan.middle.type} · โครง ${layout.id} (${layout.label}) · เรฟ ${ref ? path.basename(ref) : 'ไม่มี'} · ${presenter ? 'รูปผู้แนะนำ' : 'ไม่มีรูปผู้แนะนำ (ภาพหลักไม่มีหน้าคน)'}`)
    } else if (String(job.prompt || '').includes(PLACEHOLDER_FREE_IMAGES)) {
      // โหมดอิสระ: Codex ออกแบบเอง — ไม่แนบเรฟคู่แข่ง ไม่ให้ลอกโครงเดิม
      // presenter=use ในบรรทัด MODE = ทิศที่มีคนเป็นจุดเด่น → บังคับใส่รูปเจ้าของ (8 พ.ย. 2569)
      // footer=brand = Codex ไม่วาดโลโก้/เบอร์ → ไม่แนบโลโก้ แล้ววางแถบท้ายของจริงหลังเจน (งานเก่าไม่มี footer= ยังแนบโลโก้เต็มแบบเดิม)
      const free = parseFreeModeLine(job.prompt) || { direction: 'none', presenter: 'optional', footer: 'none' }
      brandFooter = free.footer === 'brand'
      if (brandFooter) {
        const missing = [FOOTER_SCRIPT, FOOTER_LOGO, FOOTER_FONT, FOOTER_CONTACT, FOOTER_CONTACT_INLINE].filter((f) => !existsSync(f))
        if (missing.length) throw new Error(`ไม่พบไฟล์แถบท้ายแบรนด์: ${missing.map((f) => path.relative(repo, f)).join(', ')}`)
      }
      const logo = existsSync(LOGO_FULL) ? LOGO_FULL : LOGO
      const presenter = existsSync(PRESENTER) ? PRESENTER : null
      images = [...(brandFooter ? [] : [logo]), ...(presenter ? [presenter] : [])].filter((f) => existsSync(f))
      prompt = fillFreeImages(job.prompt, { logo: !brandFooter && images.includes(logo), presenter: Boolean(presenter), usePresenter: free.presenter === 'use', footer: brandFooter })
      log(`${label}: โหมดอิสระ (Codex ออกแบบเอง) · ทิศเริ่มต้น ${free.direction} · รูปผู้แนะนำ ${free.presenter === 'use' ? 'บังคับใส่' : 'Codex เลือกเอง'} · ${brandFooter ? 'แถบท้ายแบรนด์วางเองหลังเจน' : 'Codex วาดโลโก้/เบอร์เอง (งานเก่า)'} · แนบ ${images.length} ภาพ`)
    } else if (String(job.prompt || '').includes(PLACEHOLDER_IMAGES)) {
      // v4: เติมรายการภาพแนบตามไฟล์ที่มีจริง — โลโก้เต็ม · รูปผู้แนะนำ (ถ้ามี) · เรฟสไตล์ตามโครงของโพสต์
      const layout = (String(job.prompt).match(/^LAYOUT:\s*(\w+)/m) || [])[1] || 'steps'
      // ชุดสไตล์ (บรรทัด VARIANT ของคำสั่ง): seed หมุนลำดับเรฟ · refs=finish = ชุดอิสระ ส่งเรฟแค่ 2 ใบและบอกให้เอาแค่ความแน่น/ไอคอน ไม่เอาการจัดวาง
      const variant = parseVariantLine(job.prompt)
      const logo = existsSync(LOGO_FULL) ? LOGO_FULL : LOGO
      const presenter = existsSync(PRESENTER) ? PRESENTER : null
      const refsMax = Math.min(variant.refsMode === 'finish' ? 2 : MAX_IMAGES, MAX_IMAGES - 1 - (presenter ? 1 : 0))
      const refs = pickStyleRefs(REFS_ROOT, layout, refsMax, { seed: variant.seed })
      images = [logo, ...(presenter ? [presenter] : []), ...refs].filter((f) => existsSync(f)).slice(0, MAX_IMAGES)
      prompt = fillImagePlaceholders(job.prompt, { logo: true, presenter: Boolean(presenter), refs: refs.length, refsMode: variant.refsMode })
      log(`${label}: v4 โครง ${layout}${variant.set ? ` · ชุดสไตล์ ${variant.set} (seed ${variant.seed})` : ''} · แนบ ${images.length} ภาพ (โลโก้เต็ม${presenter ? ' · ผู้แนะนำ' : ' · ไม่มีรูปผู้แนะนำ'}${refs.length ? ` · เรฟ ${refs.length}` : ' · ไม่มีเรฟ'})`)
    } else if (ollamaConfigured() && process.env.POSTER_BRIEF_AI !== '0' && /CREATIVE BRIEF/.test(String(job.prompt))) {
      // คำสั่งแบบเดิม (v3.2): บรีฟครีเอทีฟเวอร์ชัน AI (Ollama ในเครื่อง ~1–2 นาที) แทนบล็อกแบบกำหนดกฎ — ปิดได้ด้วย POSTER_BRIEF_AI=0 · ล้ม/หมดเวลา = ใช้บรีฟแบบกำหนดกฎ
      const t0 = Date.now()
      const ai = await enhanceBriefWithAi(job.prompt, { ask: createAsk({ log: () => {} }), log: (s) => log(`${label}: ${s}`) })
      prompt = ai.prompt
      log(`${label}: ${ai.note} (${Math.round((Date.now() - t0) / 1000)} วินาที)`)
    }
    const text = await plugin.callTool('generate_image', {
      prompt,
      aspect: premiumBox?.aspect || job.aspect || 'portrait',
      images,
      output_dir: OUTPUT_DIR,
    }, GENERATE_TIMEOUT_MS)
    const saved = text.match(/Image saved:\s*(.+)/)?.[1]?.trim()
    if (!saved || !existsSync(saved)) throw new Error('ปลั๊กอินไม่ได้บอกตำแหน่งไฟล์ภาพ')
    // คำสั่งภาพของขนาดที่ต้องครอปมีแถบทึบ (v3.2 "LETTERBOX BARS" น้ำเงิน · v4 แถบดำ) → ตัดแถบที่เห็นจริงทิ้งก่อนส่งขึ้นเว็บ
    const target = POSTER_SIZES[job.size] || null
    // ดูทั้งคำสั่งในคิวและคำสั่งที่ส่งจริง (โหมดพรีเมียม: คำสั่งในคิวเป็นแค่คำขอ แถบดำอยู่ในคำสั่งที่ประกอบบนเครื่องนี้)
    const sent = `${job.prompt || ''}\n${prompt || ''}`
    // โหมดพรีเมียม: ไม่ครอปเนื้อหา (โมเดลวาดเต็มขอบ — งาน 23 ตัดข้างแล้วตัวหนังสือขาด) ตัดแค่แถวดำล้วนถ้ามี · สัดส่วนแพลตฟอร์มได้จากความสูงแถบท้ายที่ต่อใต้ภาพ
    const fitOptions = premiumBox
      ? { trim: true, bars: 'black', ratio: 0 }
      : { trim: /LETTERBOX BARS|BLACK #000000 bars/.test(sent), bars: /BLACK #000000 bars/.test(sent) ? 'black' : '', ratio: target ? target.width / target.height : 0 }
    const { file: jpg, note } = await toJpeg(saved, path.join(OUTPUT_DIR, `job-${job.id}.jpg`), fitOptions)
    if (note) log(`${label}: ${note}`)
    let finalFile = jpg
    if (brandFooter) {
      // แถบท้ายแบรนด์: โลโก้จริงพื้นโปร่งใส + เบอร์/LINE ตัวพิมพ์ Kanit (เจ้าของ 8 พ.ย. 2569) · ล้ม = งานล้ม (ห้ามส่งโปสเตอร์ที่ไม่มีช่องทางติดต่อ)
      if (jpg === saved) throw new Error('ตัดแถบ/แปลง JPEG ไม่สำเร็จ จึงวางแถบท้ายแบรนด์ไม่ได้')
      finalFile = path.join(OUTPUT_DIR, `job-${job.id}-final.jpg`)
      log(`${label}: ${await addBrandFooter(jpg, finalFile, premiumBox ? { append: true, ratio: premiumBox.targetRatio } : {})}`)
    }
    const isJpeg = /\.jpe?g$/i.test(finalFile)
    const objectPath = `jobs/${job.id}.${isJpeg ? 'jpg' : 'png'}`
    const bytes = await fs.readFile(finalFile)
    const upload = await db.storage.from(IMAGE_BUCKET).upload(objectPath, bytes, { contentType: isJpeg ? 'image/jpeg' : 'image/png', upsert: true })
    if (upload.error) throw upload.error
    const done = await db.from('marketing_image_jobs')
      .update({ status: 'done', image_path: objectPath, error: null, finished_at: new Date().toISOString() })
      .eq('id', job.id).select('id').maybeSingle()
    if (done.error) throw done.error
    log(`${label}: เสร็จใน ${Math.round((Date.now() - started) / 1000)} วินาที (${Math.round(bytes.length / 1024)} KB)`)
  } catch (err) {
    const message = shortError(err)
    log(`${label}: ไม่สำเร็จ — ${message}`)
    await db.from('marketing_image_jobs')
      .update({ status: 'failed', error: message, finished_at: new Date().toISOString() })
      .eq('id', job.id)
  }
}

// ---------------------------------------------------------------- คิดคอนเทนต์ใหม่ด้วย AI (คิว marketing_content_jobs · เจ้าของขอ 9 พ.ย. 2569)
// ลูปที่สองคู่กับคิวภาพ: งานภาพยาว 1–9 นาทีไม่ทำให้งานคิดคอนเทนต์ต้องรอ (Codex คนละ process กัน)

const CONTENT_POLL_MS = 5 * 1000
// ตารางยังไม่มี → เช็กซ้ำทุก 1 นาที (select แถวเดียว ถูกมาก) ให้เริ่มรับงานได้เร็วหลังเจ้าของรัน SQL · เตือนใน log ครั้งเดียว
const CONTENT_RETRY_MS = 60 * 1000
const readJsonFile = (file, fallback) => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return fallback } }

// ความจริงของแบรนด์ชุดเดียวกับรอบรีเสิร์ช (research/brand_facts.json + ไฟล์ทับในเครื่อง .local/research/brand_facts.local.json)
function loadBrand() {
  return { ...readJsonFile(path.join(repo, 'research', 'brand_facts.json'), {}), ...readJsonFile(path.join(LOCAL_DIR, 'research', 'brand_facts.local.json'), {}) }
}

// โหลดใหม่ทุกงาน: แก้คลังความรู้/สูตร hook/แบรนด์แล้วไม่ต้องรีสตาร์ตตัวรับงาน · โหลดไม่ได้ = ร่างโดยไม่ใช้ส่วนนั้น (เหมือนรอบรีเสิร์ช)
function contentGenerator(label) {
  const say = (s) => log(`${label}: ${s}`)
  return async ({ idea, avoid, note }) => {
    const ask = createAsk({ log: say })
    if (!ask.providers.length) return { ok: false, error: NO_PROVIDER_MESSAGE }
    let kb = null
    try { kb = loadKnowledgeBase() } catch (err) { say(`โหลดคลังความรู้ไม่ได้ (${shortError(err)}) — ร่างโดยไม่ใช้คลัง`) }
    let hookLibrary = null
    let hookLessons = null
    try { hookLibrary = loadHookPatterns(); hookLessons = loadHookLessons() } catch (err) { say(`โหลดคลังสูตร hook ไม่ได้ (${shortError(err)}) — ร่างแบบเดิม`) }
    return generateFreshContent({ idea, brand: loadBrand(), ask, kb, hookLibrary, hookLessons, avoid, note, log: say })
  }
}

// ---------------------------------------------------------------- main

async function main() {
  if (!existsSync(PLUGIN_SERVER)) throw new Error(`ไม่พบปลั๊กอิน gpt-image ที่ ${PLUGIN_SERVER} (ตั้ง GPT_IMAGE_SERVER ใน .env.local ถ้าย้ายที่)`)
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  const db = database()

  if (CHECK) {
    await heartbeat(db)
    const { count, error } = await db.from('marketing_image_jobs').select('id', { count: 'exact', head: true }).eq('status', 'queued')
    if (error) throw error
    // ใช้ select ธรรมดา ไม่ใช่ head+count: ตารางที่ยังไม่มี PostgREST ตอบ head เป็น 204 ไม่มี error (ตรวจ 7 พ.ย. 2569)
    let refs = 'ตาราง poster_refs ยังไม่มี (รัน supabase_poster_refs.sql ก่อน)'
    try {
      const pending = await db.from('poster_refs').select('id').eq('status', 'new').limit(50)
      if (!pending.error) refs = `รูปตัวอย่างรอดึง ${pending.data?.length ?? 0} ภาพ`
    } catch { /* ยังไม่ได้รัน supabase_poster_refs.sql */ }
    let content = 'ตาราง marketing_content_jobs ยังไม่มี (รัน supabase_marketing_content_jobs.sql ก่อน)'
    try {
      const queued = await db.from(CONTENT_JOB_TABLE).select('id').eq('status', 'queued').limit(50)
      if (!queued.error) content = `งานคิดคอนเทนต์ใหม่รอคิว ${queued.data?.length ?? 0} งาน`
    } catch { /* ยังไม่ได้รัน supabase_marketing_content_jobs.sql */ }
    log(`ตั้งค่าพร้อม · ปลั๊กอิน ${PLUGIN_SERVER} · งานรอคิว ${count ?? 0} งาน · ${refs} · ${content} · ภาพต้นแบบโหมดพรีเมียม ${premiumRefs().length} ภาพ`)
    return
  }

  await acquireLock()
  const plugin = new PluginClient(PLUGIN_SERVER)
  let busyJob = null
  let busyContentJob = null
  let stopping = false
  const beat = () => heartbeat(db, busyJob, busyContentJob).catch((err) => log('ส่งสัญญาณไม่สำเร็จ:', shortError(err)))
  const timer = setInterval(beat, HEARTBEAT_MS)
  const shutdown = async () => {
    if (stopping) return
    stopping = true
    clearInterval(timer)
    plugin.stop()
    if (busyJob) {
      await db.from('marketing_image_jobs').update({ status: 'failed', error: 'ปิดตัวรับงานระหว่างสร้างภาพ กดสร้างใหม่ได้', finished_at: new Date().toISOString() }).eq('id', busyJob)
    }
    if (busyContentJob) {
      await db.from(CONTENT_JOB_TABLE).update({ status: 'failed', error: 'ปิดตัวรับงานระหว่างคิดคอนเทนต์ กดคิดใหม่ได้', finished_at: new Date().toISOString() }).eq('id', busyContentJob)
    }
    await releaseLock()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  try {
    await releaseStaleJobs(db)
    await beat()
    log(`ตัวรับงานสร้างภาพเปิดแล้ว${ONCE ? ' (ทำงานเดียวแล้วจบ)' : ''} · ปิดด้วย Ctrl+C`)
    // รูปตัวอย่างจากเทเลแกรม: ดึงลง inbox ทุก REF_SYNC_MS · ล้ม (เช่น ยังไม่ได้รัน SQL) → พัก 10 นาทีแล้วลองใหม่ ไม่กระทบคิวภาพ
    let nextRefSync = 0
    const syncRefs = async () => {
      if (Date.now() < nextRefSync) return
      try {
        await syncPosterRefs(db, { inboxDir: REFS_INBOX, log })
        nextRefSync = Date.now() + REF_SYNC_MS
      } catch (err) {
        log('ดึงรูปตัวอย่างไม่สำเร็จ (ลองใหม่ใน 10 นาที · ยังไม่ได้รัน supabase_poster_refs.sql?):', shortError(err))
        nextRefSync = Date.now() + REF_SYNC_RETRY_MS
      }
    }
    // คิดคอนเทนต์ใหม่: ลูปแยก ไม่รอกัน · ตารางยังไม่มี = พัก 10 นาทีแล้วลองใหม่ (ไม่กระทบคิวภาพ) · --once ทดสอบคิวภาพอย่างเดียว
    const contentLoop = async () => {
      let nextTry = 0
      let staleChecked = false
      let warnedMissing = false
      while (!stopping) {
        if (Date.now() < nextTry) { await sleep(CONTENT_POLL_MS); continue }
        let job = null
        try {
          if (!staleChecked) {
            const stale = await releaseStaleContentJobs(db, WORKER_ID)
            if (stale) log(`ปิดงานคิดคอนเทนต์ที่ค้างจากรอบก่อน ${stale} งาน`)
            staleChecked = true
          }
          job = await claimNextContentJob(db, WORKER_ID)
        } catch (err) {
          const missing = isMissingTable(err)
          if (!missing) log(`อ่านคิวคิดคอนเทนต์ไม่สำเร็จ: ${shortError(err)}`)
          else if (!warnedMissing) log('คิวคิดคอนเทนต์ใหม่ยังไม่มีตาราง (รัน supabase_marketing_content_jobs.sql ใน Supabase) — เช็กซ้ำทุก 1 นาที')
          if (missing) warnedMissing = true
          nextTry = Date.now() + (missing ? CONTENT_RETRY_MS : CONTENT_POLL_MS)
          continue
        }
        if (warnedMissing) { log('คิวคิดคอนเทนต์ใหม่พร้อมแล้ว (พบตาราง)'); warnedMissing = false }
        if (!job) { await sleep(CONTENT_POLL_MS); continue }
        busyContentJob = job.id
        await beat()
        await processContentJob(db, job, { generate: contentGenerator(`คิดคอนเทนต์ใหม่ งาน ${job.id}`), log })
        busyContentJob = null
        await beat()
      }
    }
    if (!ONCE) contentLoop().catch((err) => log('ลูปคิดคอนเทนต์ใหม่หยุด:', shortError(err)))
    while (!stopping) {
      await syncRefs()
      let job = null
      try { job = await claimNextJob(db) } catch (err) { log('อ่านคิวไม่สำเร็จ:', shortError(err)) }
      if (job) {
        busyJob = job.id
        await beat()
        await processJob(db, plugin, job)
        busyJob = null
        await beat()
        if (ONCE) break
        continue
      }
      if (ONCE) { log('ไม่มีงานในคิว'); break }
      await sleep(POLL_MS)
    }
  } finally {
    clearInterval(timer)
    plugin.stop()
    await releaseLock()
  }
}

main().catch(async (err) => {
  log('ตัวรับงานสร้างภาพหยุด:', shortError(err))
  await releaseLock()
  process.exit(1)
})

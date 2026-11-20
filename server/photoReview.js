// AI อ่านรูปทรัพย์ของรายการ ด้วย Codex บนคอมสำนักงาน (เจ้าของเลือก 20 พ.ย. 2569: Codex อย่างเดียว ไม่ใช้ Gemini)
// หน้าเว็บ (ผู้ล็อกอิน) กดขอ → ไฟล์คำขอใน bucket ปิด lead-reviews ที่ review-queue/<เลขรายการ>.json
// (bucket รูป lead-files รับเฉพาะไฟล์รูป จึงแยก bucket · สร้างเองครั้งแรกด้วย ensureReviewBucket)
// → ตัวรับงาน scripts/image-worker.mjs (ลูปที่สี่ runPhotoReviewLoop) ดึงรูปทรัพย์ลงโฟลเดอร์ชั่วคราว → codex exec -i → ลบรูปชั่วคราว
// → ผลเก็บที่ reviews/<เลขรายการ>/<เวลา>.json · ไม่มีตารางใหม่ ไม่ต้องรัน SQL
// ห้ามเขียนทับไฟล์เดิม: ที่เก็บไฟล์แคชไฟล์ที่ถูกเขียนทับได้ถึง 1 ชั่วโมง (อ่านแล้วได้ของเก่า) → ทุกคำขอและทุกผลใช้ชื่อไฟล์ใหม่
// และสถานะคิวดูจากรายชื่อไฟล์ ซึ่งไม่ผ่านแคช
// ส่งเข้า AI เฉพาะไฟล์ที่ขึ้นต้นด้วย property- · รูปเอกสารสิทธิ์ (deed-) ไม่ออกจากที่เก็บ · ตรรกะล้วนอยู่ใน src/lib/photoReview.js
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { codexLauncher } from './research/llm.js'
import {
  PHOTO_REVIEW_MAX_BYTES, PHOTO_REVIEW_MAX_IMAGES, PHOTO_REVIEW_SYSTEM, PHOTO_REVIEW_VERSION,
  buildPhotoReviewPrompt, normalizePhotoReview, photoReviewFacts,
} from '../src/lib/photoReview.js'

export const PHOTO_BUCKET = 'lead-files'
export const REVIEW_BUCKET = 'lead-reviews'

// bucket ปิดสำหรับคำขอและผลอ่านรูป: รับเฉพาะ JSON ขนาดเล็ก · มีอยู่แล้ว = ผ่าน
export async function ensureReviewBucket(db) {
  const { error } = await db.storage.createBucket(REVIEW_BUCKET, { public: false, allowedMimeTypes: ['application/json'], fileSizeLimit: 262144 })
  return !error || /exist/i.test(String(error.message || ''))
}
const QUEUE_DIR = 'review-queue'
const DEFAULT_TIMEOUT_MS = 6 * 60 * 1000
export const reviewDir = (id) => `reviews/${id}`
export const reviewPath = (id, ms) => `${reviewDir(id)}/${String(ms).padStart(15, '0')}.json`
export const queuePath = (id, ms) => `${QUEUE_DIR}/${id}-${ms}.json`
const QUEUE_NAME = /^(\d+)-(\d+)\.json$/
export const isPropertyPhoto = (name) => /^property-[\w-]+\.(jpe?g|png|webp)$/i.test(String(name || ''))
const shortError = (err) => String(err?.message || err || 'ไม่ทราบสาเหตุ').replace(/\s+/g, ' ').trim().slice(0, 300)

async function readJson(db, file) {
  try {
    const { data, error } = await db.storage.from(REVIEW_BUCKET).download(file)
    if (error || !data) return null
    const value = JSON.parse(Buffer.from(await data.arrayBuffer()).toString('utf8'))
    return value && typeof value === 'object' ? value : null
  } catch { return null }
}
const writeJson = (db, file, value) => db.storage.from(REVIEW_BUCKET).upload(file, Buffer.from(JSON.stringify(value)), { contentType: 'application/json', upsert: false })

// คำขอที่ยังอยู่ในคิว เรียงจากเก่าไปใหม่: [{ id, ms, name }]
async function queuedRequests(db, id = 0) {
  const { data, error } = await db.storage.from(REVIEW_BUCKET).list(QUEUE_DIR, { limit: 100, sortBy: { column: 'name', order: 'asc' }, ...(id ? { search: `${id}-` } : {}) })
  if (error) throw error
  return (data || []).map((f) => { const m = QUEUE_NAME.exec(String(f?.name || '')); return m && f.id ? { id: Number(m[1]), ms: Number(m[2]), name: f.name } : null })
    .filter((q) => q && q.id > 0 && (!id || q.id === id)).sort((a, b) => a.ms - b.ms)
}

// ผลล่าสุดของรายการ (ไฟล์ชื่อมากสุด = ใหม่สุด)
export async function readStoredReview(db, id) {
  try {
    const { data, error } = await db.storage.from(REVIEW_BUCKET).list(reviewDir(id), { limit: 1, sortBy: { column: 'name', order: 'desc' } })
    const latest = !error && (data || []).find((f) => f?.id && /^\d+\.json$/.test(f.name))
    return latest ? await readJson(db, `${reviewDir(id)}/${latest.name}`) : null
  } catch { return null }
}

// สถานะสำหรับหน้าเว็บ: ผลล่าสุด + คำขอที่ยังรอคอมสำนักงาน
export async function readReviewState(db, id) {
  const [review, queued] = await Promise.all([readStoredReview(db, id), queuedRequests(db, id).catch(() => [])])
  return { review, pending: queued.length ? { requestedAt: new Date(queued[0].ms).toISOString() } : null }
}

// ผู้ล็อกอินกดขอให้อ่านรูป → วางคำขอในคิว (ขอซ้ำระหว่างรอ = คำขอเดิม)
export async function requestPhotoReview({ db, id, files, now = () => new Date() }) {
  const { data: row, error } = await db.from('valuations').select('id').eq('id', id).maybeSingle()
  if (error || !row) return { ok: false, status: 404, error: 'ไม่พบรายการนี้' }
  if (!files.some((f) => isPropertyPhoto(f.name))) return { ok: false, status: 400, error: 'รายการนี้ไม่มีรูปทรัพย์ให้อ่าน (รูปเอกสารสิทธิ์ไม่ส่งให้ AI)' }
  const waiting = await queuedRequests(db, id).catch(() => [])
  if (waiting.length) return { ok: true, pending: { requestedAt: new Date(waiting[0].ms).toISOString() } }
  const at = now()
  const requestedAt = at.toISOString()
  const file = queuePath(id, at.getTime())
  let saved = await writeJson(db, file, { id, requested_at: requestedAt })
  // ครั้งแรกยังไม่มี bucket → สร้างแล้วลองอีกครั้ง
  if (saved.error && await ensureReviewBucket(db)) saved = await writeJson(db, file, { id, requested_at: requestedAt })
  if (saved.error) return { ok: false, status: 502, error: 'ส่งคำขอเข้าคิวไม่สำเร็จ' }
  return { ok: true, pending: { requestedAt } }
}

// Codex พร้อมรูปแนบ: คำสั่งทาง stdin · คำตอบสุดท้ายจากไฟล์ · sandbox read-only ในโฟลเดอร์ชั่วคราว (ไม่แตะรีโป)
// -i ต้องอยู่ก่อนตัวเลือกอื่น เพราะรับหลายค่า ถ้าอยู่ท้ายจะกิน "-" (stdin) ไปเป็นชื่อไฟล์
export async function codexPhotoReview({ prompt, imagePaths, workDir, env = process.env, timeoutMs = Number(env.PHOTO_REVIEW_TIMEOUT_MS || DEFAULT_TIMEOUT_MS) }) {
  const launcher = codexLauncher(env)
  const lastFile = path.join(workDir, 'last.txt')
  const model = String(env.CODEX_PHOTO_MODEL || '').trim()
  const args = [...launcher.args, 'exec', ...imagePaths.flatMap((p) => ['-i', p]), '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never', '--output-last-message', lastFile, '--cd', workDir, ...(model ? ['-m', model] : []), '-']
  const text = `${PHOTO_REVIEW_SYSTEM}\n\n${prompt}\n\nดูรูปที่แนบมากับข้อความนี้เท่านั้น ตอบเป็น JSON ล้วน ไม่มีข้อความอื่น ไม่มี code fence ห้ามรันคำสั่ง ห้ามเขียนไฟล์ ห้ามถามกลับ`
  await new Promise((resolve, reject) => {
    const child = spawn(launcher.file, args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true })
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      else child.kill('SIGKILL')
    }, timeoutMs)
    child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000) })
    child.on('error', (err) => { clearTimeout(timer); reject(new Error(`Codex เริ่มไม่ได้ (${launcher.display}): ${err.message}`)) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) return reject(new Error(`Codex อ่านรูปนานเกิน ${Math.round(timeoutMs / 60000)} นาที`))
      if (code !== 0) return reject(new Error(`Codex exit ${code}: ${stderr.trim().split(/\r?\n/).slice(-3).join(' ').slice(0, 300)}`))
      resolve()
    })
    child.stdin.on('error', () => {})
    child.stdin.end(text)
  })
  const out = await readFile(lastFile, 'utf8').catch(() => '')
  if (!out.trim()) throw new Error('Codex ไม่ได้ตอบข้อความ')
  return { text: out, model: model || 'codex' }
}

// งานหนึ่งรายการบนคอมสำนักงาน · ไม่ throw — ล้มทุกแบบบันทึกเหตุผลสั้น ๆ ไว้กับผลเดิม แล้วเอาคำขอออกจากคิว
export async function processPhotoReview({ db, bucket = PHOTO_BUCKET, id, ask = codexPhotoReview, log = () => {}, now = () => new Date() }) {
  const label = `อ่านรูปทรัพย์ รายการ ${id}`
  const started = Date.now()
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'assetx-photos-'))
  log(`${label}: เริ่ม`)
  try {
    const { data: row, error: rowError } = await db.from('valuations').select('*').eq('id', id).maybeSingle()
    if (rowError || !row) throw new Error('ไม่พบรายการนี้')
    const listed = await db.storage.from(bucket).list(String(id), { limit: 100, sortBy: { column: 'created_at', order: 'asc' } })
    if (listed.error) throw listed.error
    const names = (listed.data || []).map((f) => f?.name).filter(isPropertyPhoto)
    if (!names.length) throw new Error('รายการนี้ไม่มีรูปทรัพย์ให้อ่าน')

    const images = []
    let bytesTotal = 0
    for (const name of names) {
      if (images.length >= PHOTO_REVIEW_MAX_IMAGES) break
      const { data, error } = await db.storage.from(bucket).download(`${id}/${name}`)
      if (error || !data) continue
      const bytes = Buffer.from(await data.arrayBuffer())
      if (bytesTotal + bytes.length > PHOTO_REVIEW_MAX_BYTES) break
      bytesTotal += bytes.length
      const file = path.join(workDir, `photo-${images.length + 1}.${name.split('.').pop().toLowerCase()}`)
      await writeFile(file, bytes)
      images.push({ name, file })
    }
    if (!images.length) throw new Error('เปิดรูปทรัพย์จากที่เก็บไฟล์ไม่สำเร็จ')

    const facts = photoReviewFacts(row)
    const answer = await ask({ prompt: buildPhotoReviewPrompt(facts, images.length), imagePaths: images.map((i) => i.file), workDir })
    const seconds = Math.round((Date.now() - started) / 1000)
    const review = {
      ...normalizePhotoReview(answer.text, { imageCount: images.length }),
      version: PHOTO_REVIEW_VERSION,
      at: now().toISOString(),
      model: answer.model || 'codex',
      seconds,
      photos: images.map((i) => i.name),
      skipped: names.length - images.length,
      facts,
    }
    const saved = await writeJson(db, reviewPath(id, now().getTime()), review)
    if (saved.error) throw new Error('เก็บผลอ่านรูปไม่สำเร็จ')
    log(`${label}: เสร็จใน ${seconds} วินาที · ${images.length} รูป · ไม่ตรง ${review.mismatches.length} จุด`)
    return { ok: true, review }
  } catch (err) {
    const message = shortError(err)
    log(`${label}: ไม่สำเร็จ — ${message}`)
    const previous = (await readStoredReview(db, id)) || {}
    await writeJson(db, reviewPath(id, now().getTime()), { ...previous, lastError: { message, at: now().toISOString() } })
    return { ok: false, error: message }
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
    // เอาคำขอของรายการนี้ออกจากคิว (ไฟล์คำขอเป็นแค่ตัวบอกคิว ไม่ใช่ข้อมูลลูกค้า)
    try {
      const mine = await queuedRequests(db, id)
      if (mine.length) await db.storage.from(REVIEW_BUCKET).remove(mine.map((q) => `${QUEUE_DIR}/${q.name}`))
    } catch { /* รอบหน้าจะหยิบซ้ำแล้วลบใหม่ */ }
  }
}

export async function nextQueuedReview(db) {
  return (await queuedRequests(db))[0]?.id || 0
}

// ลูปของตัวรับงาน: ทีละรายการ
export async function runPhotoReviewLoop({ db, bucket = PHOTO_BUCKET, log = () => {}, isStopping = () => false, onBusy = () => {}, pollMs = 8000, ask = codexPhotoReview }) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  let warned = false
  while (!isStopping()) {
    let id = 0
    try {
      id = await nextQueuedReview(db)
      warned = false
    } catch (err) {
      if (!warned) { log(`อ่านคิวอ่านรูปทรัพย์ไม่สำเร็จ: ${shortError(err)}`); warned = true }
    }
    if (!id) { await sleep(pollMs); continue }
    await onBusy(id)
    await processPhotoReview({ db, bucket, id, ask, log })
    await onBusy(null)
  }
}

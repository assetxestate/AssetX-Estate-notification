// ฝั่งตัวรับงานของคิว "สำรวจราคาตลาด" (ตาราง market_survey_jobs) — scripts/image-worker.mjs เรียก runSurveyLoop เป็นลูปที่สาม
// หยิบงาน → ให้ Codex ค้นเว็บและเปิดหน้าประกาศรายแปลง (codex --search exec · read-only) → ตรวจคำตอบด้วย parseSurveyResult → งาน done
// survey (ตัวเรียก AI) ส่งมาจากผู้เรียก ให้เทสต์ได้โดยไม่เรียก Codex จริง
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { codexLauncher } from './research/llm.js'
import { buildSurveyPrompt, dropOutOfArea, parseSurveyResult, surveyRequestProblem } from '../src/lib/marketSurvey.js'

export const SURVEY_JOB_TABLE = 'market_survey_jobs'
export const isMissingTable = (error) => ['42P01', 'PGRST205'].includes(error?.code)
const shortError = (err) => String(err?.message || err || 'ไม่ทราบสาเหตุ').replace(/\s+/g, ' ').trim().slice(0, 300)
const DEFAULT_SURVEY_TIMEOUT_MS = 15 * 60 * 1000

// Codex พร้อมเครื่องมือค้นเว็บ: คำสั่งทาง stdin · คำตอบสุดท้ายจากไฟล์ · sandbox read-only ในโฟลเดอร์ชั่วคราว (ไม่แตะรีโป)
export async function codexSurvey(prompt, { env = process.env, timeoutMs = Number(env.MARKET_SURVEY_TIMEOUT_MS || DEFAULT_SURVEY_TIMEOUT_MS) } = {}) {
  const launcher = codexLauncher(env)
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'assetx-survey-'))
  const lastFile = path.join(workDir, 'last.txt')
  const args = [...launcher.args, '--search', 'exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never', '--output-last-message', lastFile, '--cd', workDir, '-']
  try {
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
        if (timedOut) return reject(new Error(`Codex สำรวจนานเกิน ${Math.round(timeoutMs / 60000)} นาที`))
        if (code !== 0) return reject(new Error(`Codex exit ${code}: ${stderr.trim().split(/\r?\n/).slice(-3).join(' ').slice(0, 300)}`))
        resolve()
      })
      child.stdin.on('error', () => {})
      child.stdin.end(prompt)
    })
    const out = await readFile(lastFile, 'utf8').catch(() => '')
    if (!out.trim()) throw new Error('Codex ไม่ได้ตอบข้อความ')
    return out
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

// งานที่ค้าง running จากรอบก่อน (คอมดับ/ปิดตัวรับงานกลางคัน) → failed ให้หน้าเว็บสั่งใหม่ได้
export async function releaseStaleSurveyJobs(db, workerId) {
  const { data, error } = await db.from(SURVEY_JOB_TABLE)
    .update({ status: 'failed', error: 'ตัวรับงานบนคอมหยุดกลางคัน กดสำรวจใหม่ได้', finished_at: new Date().toISOString() })
    .eq('status', 'running').eq('worker', workerId).select('id')
  if (error) throw error
  return data?.length || 0
}

export async function claimNextSurveyJob(db, workerId) {
  const { data, error } = await db.from(SURVEY_JOB_TABLE).select('id').eq('status', 'queued').order('created_at', { ascending: true }).limit(1)
  if (error) throw error
  const next = data?.[0]
  if (!next) return null
  const claimed = await db.from(SURVEY_JOB_TABLE)
    .update({ status: 'running', claimed_at: new Date().toISOString(), worker: workerId })
    .eq('id', next.id).eq('status', 'queued').select('id,valuation_id,request').maybeSingle()
  if (claimed.error) throw claimed.error
  return claimed.data // null = หน้าเว็บยกเลิกไปก่อนหยิบทัน
}

// คืน { ok, error?, seconds, count } · ไม่ throw — งานล้มทุกแบบลงเป็น failed พร้อมเหตุผลสั้น ๆ
export async function processSurveyJob(db, job, { survey = codexSurvey, log = () => {}, now = () => new Date() } = {}) {
  const label = `สำรวจราคาตลาด งาน ${job.id}`
  const started = Date.now()
  log(`${label}: เริ่ม`)
  try {
    const request = job.request && typeof job.request === 'object' ? job.request : {}
    const problem = surveyRequestProblem(request)
    if (problem) throw new Error(problem)
    // ประกาศนอกเขตของทรัพย์ไม่นับ (ย้ายไปรายการที่ตัดออก)
    const parsed = dropOutOfArea(parseSurveyResult(await survey(buildSurveyPrompt(request))), request)
    if (!parsed.listings.length) throw new Error('ไม่พบประกาศที่เปิดหน้าได้และมีทั้งราคากับเนื้อที่ในเขตนี้')
    const seconds = Math.round((Date.now() - started) / 1000)
    const done = await db.from(SURVEY_JOB_TABLE)
      .update({ status: 'done', result: { ...parsed, seconds }, error: null, finished_at: now().toISOString() })
      .eq('id', job.id).select('id').maybeSingle()
    if (done.error) throw done.error
    log(`${label}: เสร็จใน ${seconds} วินาที · ผ่าน ${parsed.listings.length} · ตัดออก ${parsed.rejected.length}`)
    return { ok: true, seconds, count: parsed.listings.length }
  } catch (err) {
    const message = shortError(err)
    log(`${label}: ไม่สำเร็จ — ${message}`)
    await db.from(SURVEY_JOB_TABLE).update({ status: 'failed', error: message, finished_at: now().toISOString() }).eq('id', job.id)
    return { ok: false, error: message }
  }
}

// ลูปของตัวรับงาน: ทีละงาน · ตารางยังไม่มี = เช็กซ้ำทุก 1 นาที ไม่กระทบคิวอื่น
export async function runSurveyLoop({ db, workerId, log = () => {}, isStopping = () => false, onBusy = () => {}, pollMs = 5000, retryMs = 60000, survey = codexSurvey }) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  let nextTry = 0
  let staleChecked = false
  let warnedMissing = false
  while (!isStopping()) {
    if (Date.now() < nextTry) { await sleep(pollMs); continue }
    let job = null
    try {
      if (!staleChecked) {
        const stale = await releaseStaleSurveyJobs(db, workerId)
        if (stale) log(`ปิดงานสำรวจราคาที่ค้างจากรอบก่อน ${stale} งาน`)
        staleChecked = true
      }
      job = await claimNextSurveyJob(db, workerId)
    } catch (err) {
      const missing = isMissingTable(err)
      if (!missing) log(`อ่านคิวสำรวจราคาไม่สำเร็จ: ${shortError(err)}`)
      else if (!warnedMissing) { log('คิวสำรวจราคาตลาดยังไม่มีตาราง (รัน supabase_market_survey_jobs.sql ใน Supabase) — เช็กซ้ำทุก 1 นาที'); warnedMissing = true }
      nextTry = Date.now() + (missing ? retryMs : pollMs)
      continue
    }
    if (warnedMissing) { log('คิวสำรวจราคาตลาดพร้อมแล้ว (พบตาราง)'); warnedMissing = false }
    if (!job) { await sleep(pollMs); continue }
    await onBusy(job.id)
    await processSurveyJob(db, job, { survey, log })
    await onBusy(null)
  }
}

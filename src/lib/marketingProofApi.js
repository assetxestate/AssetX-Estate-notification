// ตัวเรียก /api/marketing-proof จากหน้า /marketing (Content Brief + Proof Card + การอนุมัติ)
// ข้อผิดพลาดเป็น Error ข้อความไทยที่แสดงบนหน้าได้ พร้อม status · conflict · gate · missingTable ให้หน้าจอแยกกรณี
import { NETWORK_ERROR_MESSAGE, SESSION_EXPIRED_MESSAGE, isSafeMessage } from './marketingErrors.js'

const URL_BASE = '/api/marketing-proof'
const JOBS_TABLE_MESSAGE = 'ยังไม่ได้ติดตั้งคิวให้ AI เขียนจากโน้ต (ต้องสร้างตารางคิวในฐานข้อมูลก่อน) — ระหว่างนี้ใช้ปุ่ม เรียงร่างเอง ได้'
const TABLE_MESSAGE = 'ระบบหลักฐานยังไม่พร้อมใช้งาน ต้องสร้างตารางในฐานข้อมูลก่อน (แจ้งผู้ดูแลระบบ)'

async function request(url, options) {
  let response
  try {
    response = await fetch(url, options)
  } catch {
    throw Object.assign(new Error(NETWORK_ERROR_MESSAGE), { status: 0 })
  }
  const data = await response.json().catch(() => ({}))
  if (response.ok) return data
  const raw = String(data?.error || '').trim()
  const message = response.status === 401 ? SESSION_EXPIRED_MESSAGE
    : data?.missingTable ? TABLE_MESSAGE
      : isSafeMessage(raw) ? raw : 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง'
  throw Object.assign(new Error(data?.missingJobsTable ? JOBS_TABLE_MESSAGE : message), { status: response.status, missingJobsTable: Boolean(data?.missingJobsTable), conflict: Boolean(data?.conflict), gate: data?.gate || null, proof: data?.proof || null, missingTable: Boolean(data?.missingTable) })
}

const post = (body) => request(URL_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

// ธงปิด เซสชันหมด หรือเรียกไม่ได้ = ถือว่าปิด (หน้า /marketing ทำงานแบบเดิม)
export async function getProofFlags() {
  try {
    const data = await request(`${URL_BASE}?flags=1`)
    return { on: Boolean(data?.flags?.proofCards), ready: Boolean(data?.ready) }
  } catch {
    return { on: false, ready: false }
  }
}

export const loadBriefProof = (briefId) => request(`${URL_BASE}?brief=${encodeURIComponent(briefId)}`)
export const loadContentProof = (contentId) => request(`${URL_BASE}?content=${encodeURIComponent(contentId)}`)
export const saveBrief = (brief, { id = null, version = null, createdBy = '' } = {}) => post({ action: 'save-brief', brief, id, version, createdBy })
export const saveSource = (source, { briefId = null, id = null, version = null } = {}) => post({ action: 'save-source', source, briefId, id, version })
export const saveClaim = (claim, { briefId = null, id = null, version = null, sourceIds = null } = {}) => post({ action: 'save-claim', claim, briefId, id, version, sourceIds })
export const reviewClaim = ({ id, version, status, reviewer }) => post({ action: 'review-claim', id, version, status, reviewer })
export const attachBrief = ({ briefId, contentId, contentNo = null }) => post({ action: 'attach-content', briefId, contentId, contentNo })
// ให้ AI บนคอมสำนักงานเขียนจากโน้ต (คิว) · job = งานเดียว · briefJob = งานล่าสุดของบรีฟ (เปิดแผงใหม่แล้วตามงาน/ดูผลเดิม)
export const requestWrite = (briefId, note = '') => post({ action: 'write-request', briefId, note })
export const getWriteJob = (jobId) => request(`${URL_BASE}?job=${encodeURIComponent(jobId)}`)
export const getBriefWriteJob = (briefId) => request(`${URL_BASE}?briefJob=${encodeURIComponent(briefId)}`)

// ข้อความสถานะของงานเขียน { text, tone: info | warn | error } · งานเสร็จ = null (หน้าจอแสดงร่างแทน)
export function writeJobStatus(job, worker, now = Date.now()) {
  if (!job) return null
  const waited = Math.max(0, Math.round((now - Date.parse(job.claimed_at || job.created_at)) / 1000))
  const clock = waited >= 60 ? `${Math.floor(waited / 60)} นาที ${waited % 60} วินาที` : `${waited} วินาที`
  if (job.status === 'failed') return { tone: 'error', text: `AI เขียนไม่สำเร็จ: ${job.error || 'ไม่ทราบสาเหตุ'}` }
  if (job.status === 'queued') {
    if (worker && !worker.online) return { tone: 'warn', text: 'ส่งงานแล้ว แต่คอมสำนักงานปิดอยู่ — AI จะเริ่มเขียนเมื่อเปิดเครื่อง (ปิดหน้านี้ได้ กลับมาเปิดบรีฟนี้ผลจะรออยู่)' }
    if (worker && worker.online && !worker.writer) return { tone: 'warn', text: 'ตัวรับงานบนคอมสำนักงานยังเป็นรุ่นเก่า — ต้องปิดแล้วเปิดตัวรับงานใหม่ก่อน งานนี้จึงจะเริ่ม' }
    return { tone: 'info', text: `รอคิวบนคอมสำนักงาน · ${clock}` }
  }
  if (job.status === 'running') return { tone: 'info', text: `AI กำลังเขียน 3 มุมจากโน้ตนี้ · ${clock} (ปกติราว 1 นาที)` }
  return null
}

export const checkGate = (postPayload, briefId = null) => post({ action: 'gate', post: postPayload, briefId })
export const approveContent = (postPayload, { reviewer, reason = '', briefId = null }) => post({ action: 'approve', post: postPayload, reviewer, reason, briefId })

// ส่วนของโพสต์ที่ส่งให้ด่าน — ต้องเป็นชุดเดียวกันทั้งตอนตรวจ ตอนอนุมัติ และตอนส่งออก (เซิร์ฟเวอร์เทียบแฮชจากชุดนี้)
export function gatePayload(item = {}, mediaAssetId = '') {
  return {
    id: String(item.id ?? ''),
    contentNo: item.contentNo || null,
    title: item.title || item.headline || '',
    caption: item.caption || '',
    videoScript: item.videoScript || '',
    topic: item.topic || '',
    channel: item.channel || '',
    mediaAssetId: String(mediaAssetId || ''),
    draftSource: item.draftSource || undefined,
  }
}

const REVIEWER_KEY = 'assetx_marketing_reviewer'
export function storedReviewer() {
  try { return localStorage.getItem(REVIEWER_KEY) || '' } catch { return '' }
}
export function storeReviewer(name) {
  try { localStorage.setItem(REVIEWER_KEY, String(name || '').slice(0, 80)) } catch { /* จำไม่ได้ก็พิมพ์ใหม่ได้ */ }
}

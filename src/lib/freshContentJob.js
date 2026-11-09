// ตัวช่วยของปุ่ม "✨ คิดคอนเทนต์ใหม่ (AI)" บนการ์ดไอเดียและการ์ดร่าง (คิว /api/marketing-content-jobs → คอมสำนักงาน · เจ้าของขอ 9 พ.ย. 2569)
// ไม่มีโค้ดฝั่งเซิร์ฟเวอร์ — หน้าเว็บใช้ได้ เทสต์ได้ด้วย node
import { elapsedSeconds, formatElapsed, isActiveJob } from './chatgptImageJob.js'

export { isActiveJob }

// งานแบบไหนที่หน้าเว็บต้องตามต่อเมื่อเปิดหน้าใหม่: ยังไม่จบ · หรือเสร็จแล้วจากการ์ดร่างที่ยังไม่ได้สร้างร่างใหม่ (งานจากการ์ดไอเดียเสร็จแล้ว = มุมใหม่อยู่บนไอเดียแล้ว ไม่ต้องทำอะไร)
export function shouldResumeJob(job) {
  if (isActiveJob(job)) return true
  return job?.status === 'done' && Boolean(job.post_key) && !job.applied_at
}

// งานล่าสุดต่อกุญแจ (ไอเดีย หรือ ร่าง) — ใช้แสดงสถานะบนการ์ด · งานจากการ์ดร่างไม่โชว์บนการ์ดไอเดีย และกลับกัน
export function latestJobBy(jobs = [], keyOf) {
  const out = {}
  for (const job of jobs) {
    const key = keyOf(job)
    if (key === null || key === undefined || key === '') continue
    const prev = out[key]
    if (!prev || Number(job.id) > Number(prev.id)) out[key] = job
  }
  return out
}

// ข้อความใต้ปุ่มบนการ์ด { text, tone: info | warn | error } · งานจบแล้ว (done/cancelled) = ไม่มีข้อความ
export function freshJobStatus(job, worker, now = Date.now()) {
  if (!job) return null
  if (job.status === 'failed') return { tone: 'error', text: `คิดใหม่ไม่สำเร็จ: ${job.error || 'ไม่ทราบสาเหตุ'} · กดคิดใหม่ได้อีกครั้ง` }
  if (job.status === 'queued') {
    if (worker && !worker.online) return { tone: 'warn', text: 'ส่งงานแล้ว แต่คอมสำนักงานปิดอยู่ — AI จะเริ่มคิดเมื่อเปิดเครื่อง (ปิดหน้านี้ได้ ผลจะมาเอง)' }
    if (worker && worker.online && !worker.content) return { tone: 'warn', text: 'ตัวรับงานบนคอมสำนักงานยังเป็นรุ่นเก่า — ต้องเปิดตัวรับงานใหม่ก่อน งานนี้จึงจะเริ่ม' }
    return { tone: 'info', text: `รอคิวบนคอมสำนักงาน · ${formatElapsed(elapsedSeconds(job, now))}` }
  }
  if (job.status === 'running') return { tone: 'info', text: `AI กำลังคิดมุมเล่าใหม่และเขียนร่างทั้งชิ้น · ${formatElapsed(elapsedSeconds(job, now))} (ปกติ 1–3 นาที · ปิดหน้านี้ได้ ผลจะมาเอง)` }
  return null
}

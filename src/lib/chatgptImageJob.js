// ตัวช่วยของปุ่ม "สร้างโปสเตอร์ด้วย ChatGPT" ในหน้าต่างออกแบบภาพ (คิว /api/marketing-image-jobs → คอมสำนักงาน)

// แฮชสั้นของข้อความ (djb2) — ใช้แยกร่างในหน้าสร้างโพสต์ที่ยังไม่มีเลข #N
function shortHash(text) {
  let hash = 5381
  for (const char of String(text)) hash = ((hash * 33) ^ char.codePointAt(0)) >>> 0
  return hash.toString(36)
}

// รหัสโพสต์สำหรับหางานล่าสุด: ใช้เลข #N ถ้ามี (คงที่ถาวร) ไม่งั้นใช้ id ของร่าง
// ร่างในหน้าสร้างโพสต์ใช้ id "generated" ร่วมกันทุกร่าง → ใช้แฮชของหัวข้อ+เนื้อหาแทน ไม่ให้ร่างใหม่เห็นภาพของร่างเก่า
export function postKeyFor(brief = {}) {
  const no = Number(brief.contentNo)
  if (Number.isInteger(no) && no > 0) return `no-${no}`
  if (brief.id === 'generated') {
    const text = `${brief.title || brief.headline || ''}\n${brief.caption || ''}`.trim()
    return text ? `studio-${shortHash(text)}` : ''
  }
  const id = String(brief.id ?? '').replace(/[^\w:.-]/g, '').slice(0, 60)
  return id ? `id-${id}` : ''
}

export const isActiveJob = (job) => job?.status === 'queued' || job?.status === 'running'

export function formatElapsed(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function elapsedSeconds(job, now = Date.now()) {
  const start = Date.parse(job?.status === 'running' ? job.claimed_at || job.created_at : job?.created_at)
  return Number.isFinite(start) ? Math.max(0, (now - start) / 1000) : 0
}

// ข้อความสถานะใต้ปุ่ม — บอกตรง ๆ ว่างานอยู่ตรงไหน และต้องทำอะไรถ้าคอมไม่ได้เปิดตัวรับงาน
export function chatJobMessage(job, worker, now = Date.now()) {
  if (!job) return worker && !worker.online ? 'ตัวรับงานบนคอมสำนักงานยังไม่เปิด — กดสร้างได้ งานจะรอในคิวจนกว่าจะเปิด' : ''
  const time = formatElapsed(elapsedSeconds(job, now))
  if (job.status === 'queued') {
    return worker?.online
      ? `ส่งงานแล้ว รอคอมสำนักงานรับงาน · ${time}`
      : `งานรอในคิว แต่ตัวรับงานบนคอมสำนักงานยังไม่เปิด — เปิดคอมแล้วรัน "npm run image-worker" งานจะเริ่มเอง · ${time}`
  }
  if (job.status === 'running') return `กำลังสร้างภาพบนคอมสำนักงาน · ${time} (ปกติราว 1–2 นาที)`
  if (job.status === 'done') return 'ได้ภาพจาก ChatGPT แล้ว · ตรวจตัวสะกดภาษาไทยก่อนกดบันทึก'
  if (job.status === 'failed') return `สร้างภาพไม่สำเร็จ: ${job.error || 'ไม่ทราบสาเหตุ'}`
  if (job.status === 'cancelled') return 'ยกเลิกงานแล้ว'
  return ''
}

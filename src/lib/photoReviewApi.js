// หน้าเว็บ ↔ /api/lead-files สำหรับรูปแนบพร้อมผลอ่านรูปของ AI (ต้องล็อกอิน)
export async function getLeadFilesWithReview(id) {
  const res = await fetch(`/api/lead-files?id=${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'เปิดรูปแนบไม่สำเร็จ')
  return { files: Array.isArray(data.files) ? data.files : [], review: data.review || null, pending: data.pending || null }
}

// เฉพาะผลอ่านรูปและคำขอที่รออยู่ (ใช้ถามเป็นระยะระหว่างรอคอมสำนักงาน)
export async function getPhotoReviewState(id) {
  const res = await fetch(`/api/lead-files?id=${encodeURIComponent(id)}&review=1`, { credentials: 'same-origin', cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'ถามสถานะการอ่านรูปไม่สำเร็จ')
  return { review: data.review || null, pending: data.pending || null }
}

// ขอให้ Codex บนคอมสำนักงานอ่านรูปทรัพย์ของรายการ (ไม่ส่งรูปเอกสารสิทธิ์) — คืนคำขอที่เข้าคิวแล้ว
export async function analyzeLeadPhotos(id) {
  const res = await fetch('/api/lead-files', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'analyze' }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.pending) throw new Error(data.error || 'ส่งคำขอเข้าคิวไม่สำเร็จ ลองใหม่อีกครั้ง')
  return data.pending
}

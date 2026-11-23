// ตัวเรียก /api/marketing-media จากหน้า /marketing (รูปเก็บเป็นไฟล์แยก · src/lib/marketingMedia.js)
// ล้มทุกแบบ = โยน Error เงียบ ๆ ให้ผู้เรียกปล่อยรูปไว้ในก้อนเวิร์กสเปซตามเดิม (ไม่ขึ้นข้อความรบกวนเจ้าของ)
const URL_BASE = '/api/marketing-media'

async function request(url, options) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data?.error || 'media request failed'), { status: response.status })
  return data
}

// ที่เก็บรูปพร้อมหรือไม่ · เรียกไม่ได้ = ไม่พร้อม (หน้าเว็บทำงานแบบเดิม รูปอยู่ในก้อน)
export async function getMediaStatus() {
  try { return { ready: Boolean((await request(`${URL_BASE}?status=1`)).ready) } } catch { return { ready: false } }
}
export const uploadMedia = (id, dataUrl) => request(URL_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'upload', id, dataUrl }) })
export const fetchMedia = async (path) => (await request(`${URL_BASE}?path=${encodeURIComponent(path)}`)).dataUrl

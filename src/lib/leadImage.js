// ย่อรูปที่ผู้ส่งแนบบนหน้า /assess ก่อนส่ง (รูปจากมือถือมัก 3–8 MB เกินที่คำขอรับได้)
// ด้านยาว 2000 px พออ่านตัวหนังสือบนโฉนด · ผลเป็น JPEG เสมอ · ทำในเบราว์เซอร์ ไม่ส่งรูปต้นฉบับออกไป
export const MAX_SIDE = 2000
export const TARGET_BYTES = 1.6 * 1024 * 1024
export const MAX_FILES = 8

// ขนาดที่ย่อแล้ว โดยคงสัดส่วน
export function fitSize(width, height, maxSide = MAX_SIDE) {
  const w = Math.max(1, Math.round(Number(width) || 0))
  const h = Math.max(1, Math.round(Number(height) || 0))
  const scale = Math.min(1, maxSide / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

export const isImageFile = (file) => /^image\/(jpeg|png|webp|heic|heif)$/i.test(file?.type || '') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file?.name || '')

async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { /* ลองทาง <img> ต่อ */ }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

// คืน { base64, bytes, previewUrl } · เปิดรูปไม่ได้ (เช่น HEIC บนเบราว์เซอร์ที่ไม่รองรับ) = โยน error ให้หน้าเว็บบอกผู้ใช้
export async function compressImage(file) {
  const bitmap = await loadBitmap(file)
  const size = fitSize(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close?.()
  let blob = null
  for (const quality of [0.85, 0.75, 0.62, 0.5]) {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (blob && blob.size <= TARGET_BYTES) break
  }
  if (!blob) throw new Error('ย่อรูปไม่สำเร็จ')
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error('อ่านรูปไม่สำเร็จ'))
    reader.readAsDataURL(blob)
  })
  return { base64, bytes: blob.size, previewUrl: URL.createObjectURL(blob) }
}

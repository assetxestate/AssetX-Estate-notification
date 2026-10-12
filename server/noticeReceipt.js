import { randomUUID } from 'node:crypto'

export const RECEIPT_BUCKET = 'notice-receipts'
export const RECEIPT_LIMIT = 2 * 1024 * 1024

export function decodeReceipt(file) {
  if (!file || typeof file.name !== 'string' || !file.name.trim() || file.name.length > 200 || typeof file.base64 !== 'string' || file.base64.length > Math.ceil(RECEIPT_LIMIT / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.base64)) throw new Error('ใบเสร็จต้องเป็น JPG, PNG หรือ PDF ขนาดไม่เกิน 2 MB')
  const bytes = Buffer.from(file.base64, 'base64')
  const types = {
    'image/jpeg': ['jpg', bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255],
    'image/png': ['png', bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))],
    'application/pdf': ['pdf', bytes.subarray(0, 5).toString() === '%PDF-'],
  }
  const type = types[file.type]
  if (!type?.[1] || !bytes.length || bytes.length > RECEIPT_LIMIT) throw new Error('ชนิดไฟล์หรือขนาดใบเสร็จไม่ถูกต้อง')
  return { bytes, type: file.type, name: file.name.trim(), extension: type[0] }
}

export async function uploadReceipt(db, noticeId, file) {
  const path = `${noticeId}/${randomUUID()}.${file.extension}`
  const { error } = await db.storage.from(RECEIPT_BUCKET).upload(path, file.bytes, { contentType: file.type, upsert: false })
  if (error) throw error
  return { path, name: file.name, type: file.type, size: file.bytes.length }
}

// Serverless auth — ตรวจรหัสผ่านฝั่งเซิร์ฟเวอร์ ไม่ให้ credential หลุดใน bundle
// ตั้งค่า ENV บน Vercel: APP_USERNAME, APP_PASSWORD
import crypto from 'crypto'
import { createSessionCookie } from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { username, password } = req.body || {}
  const USER = process.env.APP_USERNAME
  const PASS = process.env.APP_PASSWORD

  if (!USER || !PASS) {
    return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า APP_USERNAME / APP_PASSWORD' })
  }

  // เทียบแบบ constant-time กันการเดา timing
  const ok =
    safeEqual(username, USER) && safeEqual(password, PASS)

  if (!ok) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' })
  }

  res.setHeader('Set-Cookie', createSessionCookie())
  return res.status(200).json({ ok: true })
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a ?? ''))
  const bb = Buffer.from(String(b ?? ''))
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { NETWORK_ERROR_MESSAGE, SESSION_EXPIRED_MESSAGE, errorMessage, friendlyApiError, isSafeMessage } from './marketingErrors.js'

const FALLBACK = 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง'

test('401 = เซสชันหมดอายุ เสมอ ไม่ว่าเซิร์ฟเวอร์ส่งข้อความอะไรมา', () => {
  assert.equal(friendlyApiError(401, { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, FALLBACK), SESSION_EXPIRED_MESSAGE)
})

test('ข้อความไทยปกติจากเซิร์ฟเวอร์ผ่านได้', () => {
  for (const message of ['กรุณาตั้งเวลาโพสต์ล่วงหน้าอย่างน้อย 10 นาที', 'ไอเดียนี้มีอยู่แล้ว', 'รูปภาพมีขนาดเกิน 8 MB', 'กรุณาใส่หัวข้อหรือลิงก์']) {
    assert.equal(friendlyApiError(400, { error: message }, FALLBACK), message)
  }
})

test('ชื่อตัวแปร env / ชื่อไฟล์ / ชื่อบริการ / โค้ด HTTP ไม่หลุดขึ้นจอ', () => {
  const leaky = [
    'ยังไม่ได้ตั้งค่า META_PAGE_ID, META_PAGE_ACCESS_TOKEN',
    'ยังไม่ได้ตั้งค่า TAVILY_API_KEY บน server',
    'ยังไม่ได้ติดตั้งตารางคิวไอเดีย — รัน supabase_marketing_ideas.sql ใน Supabase ก่อน',
    'ยังไม่ได้ตั้งค่า OBSIDIAN_MARKETING_KB_DIR ใน .env.local',
    'สร้างภาพไม่สำเร็จ (HTTP 429)',
    'โควต้า OpenAI หมด',
  ]
  for (const message of leaky) assert.equal(friendlyApiError(500, { error: message }, FALLBACK), FALLBACK, message)
})

test('ข้อความอังกฤษล้วนหรือว่าง → ข้อความสำรอง', () => {
  assert.equal(friendlyApiError(500, { error: 'Tavily API 401' }, FALLBACK), FALLBACK)
  assert.equal(friendlyApiError(500, { error: 'Internal Server Error' }, FALLBACK), FALLBACK)
  assert.equal(friendlyApiError(500, {}, FALLBACK), FALLBACK)
  assert.equal(friendlyApiError(500, null, FALLBACK), FALLBACK)
})

test('ตัดหางรายละเอียด Facebook Graph ทิ้ง เหลือแต่ประโยคไทย', () => {
  const raw = 'Page Access Token ใช้งานไม่ได้ กรุณาตรวจสอบโทเคน — Facebook (HTTP 400, code 190): Error validating access token'
  assert.equal(friendlyApiError(400, { error: raw }, FALLBACK), 'Page Access Token ใช้งานไม่ได้ กรุณาตรวจสอบโทเคน')
})

test('errorMessage: fetch ล้ม (เครือข่าย) → ข้อความเครือข่ายภาษาไทย', () => {
  assert.equal(errorMessage(new TypeError('Failed to fetch'), FALLBACK), NETWORK_ERROR_MESSAGE)
  assert.equal(errorMessage(new TypeError('NetworkError when attempting to fetch resource.'), FALLBACK), NETWORK_ERROR_MESSAGE)
  assert.equal(errorMessage(new TypeError('Load failed'), FALLBACK), NETWORK_ERROR_MESSAGE)
})

test('errorMessage: บั๊กในโค้ดหรือ DOMException อังกฤษ → ข้อความสำรอง ไม่โกหกว่าเป็นเครือข่าย', () => {
  assert.equal(errorMessage(new TypeError("Cannot read properties of undefined (reading 'x')"), FALLBACK), FALLBACK)
  assert.equal(errorMessage(new Error("Failed to execute 'setItem' on 'Storage': Setting the value of 'assetx_marketing_workspace_v5' exceeded the quota."), FALLBACK), FALLBACK)
  assert.equal(errorMessage(undefined, FALLBACK), FALLBACK)
})

test('errorMessage: ข้อความไทยที่โยนเองผ่านได้', () => {
  assert.equal(errorMessage(new Error('บันทึกภาพขึ้นระบบไม่สำเร็จ ลองใหม่อีกครั้ง'), FALLBACK), 'บันทึกภาพขึ้นระบบไม่สำเร็จ ลองใหม่อีกครั้ง')
  assert.equal(isSafeMessage('โหลดภาพไม่สำเร็จ กรุณาเลือกภาพใหม่'), true)
  assert.equal(isSafeMessage(''), false)
})

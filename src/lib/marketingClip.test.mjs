import test from 'node:test'
import assert from 'node:assert/strict'
import { CLIP_MAX_BYTES, checkClipFile, checkReelDescription, clipContentNo, clipPathFor, clipRecord, isClipPath, summarizeReelStatus } from './marketingClip.js'

test('ตำแหน่งไฟล์คลิป: สร้างจากเลขคอนเทนต์และเวลา รับเฉพาะรูปแบบนี้', () => {
  const path = clipPathFor(32, 1795500000000)
  assert.equal(path, 'clips/c32-1795500000000.mp4')
  assert.ok(isClipPath(path))
  assert.equal(clipContentNo(path), 32)
  assert.equal(clipPathFor('abc'), '')
  assert.equal(clipPathFor(0), '')
  for (const bad of ['workspace/a.png', 'clips/../x.mp4', 'clips/c32-1.mp4', 'clips/c32-1795500000000.mov', '/clips/c32-1795500000000.mp4', null]) assert.equal(isClipPath(bad), false)
})

test('ตรวจไฟล์: ชนิดและขนาดบล็อก · ความยาว ขนาดภาพ สัดส่วนเป็นคำเตือน', () => {
  assert.equal(checkClipFile({ type: 'video/mp4', size: 30e6 }).ok, true)
  assert.equal(checkClipFile({ type: 'video/quicktime', size: 30e6 }).ok, false)
  assert.equal(checkClipFile({ type: 'video/mp4', size: CLIP_MAX_BYTES + 1 }).ok, false)
  assert.equal(checkClipFile({ type: 'video/mp4', size: 0 }).ok, false)
  const good = checkClipFile({ type: 'video/mp4', size: 30e6 }, { duration: 53, width: 1080, height: 1920 })
  assert.deepEqual(good.warnings, [])
  const bad = checkClipFile({ type: 'video/mp4', size: 30e6 }, { duration: 120, width: 1920, height: 1080 })
  assert.equal(bad.ok, true)
  assert.equal(bad.warnings.length, 2)
  assert.equal(checkClipFile({ type: 'video/mp4', size: 1e6 }, { duration: 10, width: 360, height: 640 }).warnings.length, 1)
})

test('ข้อความใต้ Reel: ว่างและยาวเกินไม่ผ่าน · ข้อความความรู้ทั่วไปผ่าน · คำเกินจริงไม่ผ่าน', () => {
  assert.equal(checkReelDescription('  ').ok, false)
  assert.equal(checkReelDescription('ก'.repeat(2201)).ok, false)
  const fine = checkReelDescription('ขายฝากแล้ว ที่ดินยังเป็นของคุณไหม 🔑\nขอยอดสินไถ่และวันครบกำหนดเป็นลายลักษณ์อักษรก่อนเซ็น\n#AssetXEstate #ขายฝาก')
  assert.equal(fine.ok, true, fine.notes.join(' | '))
  const hype = checkReelDescription('อนุมัติไว รับประกันผล 100% ได้เงินแน่นอน')
  assert.equal(hype.ok, false)
  assert.ok(hype.notes.length > 0)
})

test('สถานะ Reel: ผิดพลาด · เผยแพร่แล้ว · กำลังประมวลผล (รับทั้ง complete และ completed)', () => {
  assert.equal(summarizeReelStatus({}).state, 'processing')
  assert.equal(summarizeReelStatus({ video_status: 'processing', uploading_phase: { status: 'complete' }, processing_phase: { status: 'in_progress' } }).state, 'processing')
  for (const word of ['complete', 'completed']) {
    assert.equal(summarizeReelStatus({ video_status: 'ready', publishing_phase: { status: word, publish_status: 'published' } }).state, 'published')
  }
  assert.equal(summarizeReelStatus({ publishing_phase: { status: 'complete', publish_status: 'draft' } }).state, 'draft')
  assert.equal(summarizeReelStatus({ publishing_phase: { status: 'not_started', publish_status: 'scheduled' } }).state, 'scheduled')
  const failed = summarizeReelStatus({ video_status: 'error', processing_phase: { status: 'error', error: { message: 'Resolution too low' } } })
  assert.equal(failed.state, 'error')
  assert.match(failed.message, /Resolution too low/)
  assert.equal(summarizeReelStatus({ video_status: 'upload_failed' }).state, 'error')
})

test('รายการคลิป: เก็บเฉพาะช่องที่รู้จัก ตำแหน่งไม่ถูกต้องไม่สร้าง', () => {
  assert.equal(clipRecord({ path: 'x.mp4' }), null)
  const record = clipRecord({ path: 'clips/c32-1795500000000.mp4', bytes: 33160899, name: 'AX32-ad-final.mp4\n', duration: 53.04, width: 1080, height: 1920, extra: 'x', uploadedAt: '2026-11-24T10:00:00.000Z' })
  assert.deepEqual(record, { path: 'clips/c32-1795500000000.mp4', bytes: 33160899, name: 'AX32-ad-final.mp4 ', duration: 53, width: 1080, height: 1920, uploadedAt: '2026-11-24T10:00:00.000Z', reel: null })
})

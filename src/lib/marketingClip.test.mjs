import test from 'node:test'
import assert from 'node:assert/strict'
import { CLIP_MAX_BYTES, checkClipFile, checkReelDescription, clipContentNo, clipPathFor, clipRecord, isClipPath, reelApprovalMatches, reelGatePayload, reelReviewId, replaceClip, summarizeReelStatus } from './marketingClip.js'
import { approvalBasis } from './marketingReviewGate.js'

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

test('แทนที่คลิป: Reel ที่ส่งแล้วของคลิปเดิมถูกเก็บเป็นประวัติ คลิปใหม่ยังไม่มี Reel', () => {
  const next = clipRecord({ path: 'clips/c32-1795600000000.mp4', bytes: 5, name: 'new.mp4', uploadedAt: '2026-11-24T11:00:00.000Z' })
  // คลิปเดิมยังไม่เคยส่ง หรือส่งไฟล์แล้วแต่ยังไม่เผยแพร่: ไม่มีประวัติ
  assert.equal(replaceClip(null, next).previous, undefined)
  assert.equal(replaceClip({ path: 'clips/c32-1795500000000.mp4', reel: null }, next).previous, undefined)
  assert.equal(replaceClip({ path: 'clips/c32-1795500000000.mp4', reel: { videoId: '123456', state: 'uploaded' } }, next).previous, undefined)
  // คลิปเดิมเผยแพร่แล้ว: เก็บรหัส ลิงก์ และข้อความไว้
  const old = { path: 'clips/c32-1795500000000.mp4', name: 'old.mp4', reel: { videoId: '123456', state: 'published', permalink: 'https://www.facebook.com/reel/123456/', sentAt: '2026-11-24T10:00:00.000Z', description: 'ข้อความเดิม' } }
  const replaced = replaceClip(old, next)
  assert.equal(replaced.reel, null)
  assert.equal(replaced.path, 'clips/c32-1795600000000.mp4')
  assert.deepEqual(replaced.previous, [{ path: 'clips/c32-1795500000000.mp4', name: 'old.mp4', videoId: '123456', permalink: 'https://www.facebook.com/reel/123456/', sentAt: '2026-11-24T10:00:00.000Z', state: 'published', description: 'ข้อความเดิม' }])
  // ประวัติสะสมต่อกัน และตัดเหลือ 5 รายการล่าสุด
  const many = { ...old, previous: Array.from({ length: 5 }, (_, i) => ({ path: `clips/c32-179540000000${i}.mp4`, videoId: String(1000 + i) })) }
  const capped = replaceClip(many, next).previous
  assert.equal(capped.length, 5)
  assert.equal(capped.at(-1).videoId, '123456')
  assert.equal(capped[0].videoId, '1001')
  assert.equal(replaceClip(old, null), null)
})

test('ชุดข้อมูลอนุมัติ Reel: ข้อความใต้คลิป + ไฟล์คลิป แยกจากโพสต์ และแฮชของโพสต์เดิมไม่เปลี่ยน', () => {
  const post = { id: '1763870000000', contentNo: 32, title: 'หัวข้อ', caption: 'แคปชั่นของโพสต์', channel: 'facebook', draftSource: 'ai', mediaAssetId: 'asset-1' }
  const payload = reelGatePayload(post, { description: '  ข้อความใต้คลิป\r\nบรรทัดสอง  ', clipPath: 'clips/c32-1795500000000.mp4' })
  assert.deepEqual(payload, { id: '1763870000000', kind: 'reel', contentNo: 32, title: 'หัวข้อ', caption: 'ข้อความใต้คลิป\nบรรทัดสอง', videoScript: '', topic: '', channel: 'facebook', mediaAssetId: 'clips/c32-1795500000000.mp4', draftSource: 'ai' })
  assert.equal(reelReviewId(post.id), '1763870000000#reel')
  // แฮชของ Reel ต่างจากของโพสต์แม้ข้อความและไฟล์เหมือนกัน · โพสต์ที่ไม่มี kind ได้ค่าเดิม (ไม่มีช่อง kind)
  const same = { ...post, mediaAssetId: 'x' }
  assert.notEqual(approvalBasis({ ...same, kind: 'reel' }), approvalBasis(same))
  assert.equal(JSON.parse(approvalBasis(same)).kind, undefined)
  // เปลี่ยนข้อความหรือไฟล์ = ชุดใหม่
  assert.notEqual(approvalBasis(payload), approvalBasis(reelGatePayload(post, { description: 'ข้อความอื่น', clipPath: payload.mediaAssetId })))
  assert.notEqual(approvalBasis(payload), approvalBasis(reelGatePayload(post, { description: payload.caption, clipPath: 'clips/c32-1795600000000.mp4' })))
})

test('บันทึกย่อของการอนุมัติบนคลิป: ตรงเมื่อไฟล์และข้อความเป็นฉบับที่อนุมัติเท่านั้น', () => {
  const clip = { path: 'clips/c32-1795500000000.mp4', reelApproval: { reviewId: 7, reviewer: 'ผู้ตรวจ', at: '2026-11-26T03:00:00Z', path: 'clips/c32-1795500000000.mp4', description: 'ข้อความใต้คลิป' } }
  assert.equal(reelApprovalMatches(clip, ' ข้อความใต้คลิป '), true)
  assert.equal(reelApprovalMatches(clip, 'ข้อความใต้คลิป แก้แล้ว'), false)
  assert.equal(reelApprovalMatches({ ...clip, path: 'clips/c32-1795600000000.mp4' }, 'ข้อความใต้คลิป'), false)
  assert.equal(reelApprovalMatches({ path: clip.path }, 'ข้อความใต้คลิป'), false)
  // คลิปใหม่ที่มาแทนไม่พาการอนุมัติเดิมมา
  assert.equal(replaceClip(clip, clipRecord({ path: 'clips/c32-1795600000000.mp4', bytes: 10 })).reelApproval, undefined)
})

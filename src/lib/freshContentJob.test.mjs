import test from 'node:test'
import assert from 'node:assert/strict'
import { freshJobStatus, latestJobBy, shouldResumeJob } from './freshContentJob.js'

const NOW = Date.parse('2026-11-09T12:00:00Z')

test('shouldResumeJob: งานยังไม่จบ · งานจากการ์ดร่างที่เสร็จแต่ยังไม่ได้สร้างร่างใหม่ — อย่างอื่นไม่ต้องตาม', () => {
  assert.equal(shouldResumeJob({ status: 'queued' }), true)
  assert.equal(shouldResumeJob({ status: 'running' }), true)
  assert.equal(shouldResumeJob({ status: 'done', post_key: '1', applied_at: null }), true)
  assert.equal(shouldResumeJob({ status: 'done', post_key: '1', applied_at: '2026-11-09T11:00:00Z' }), false)
  assert.equal(shouldResumeJob({ status: 'done', post_key: null }), false, 'งานจากการ์ดไอเดีย: มุมใหม่อยู่บนไอเดียแล้ว')
  assert.equal(shouldResumeJob({ status: 'failed', post_key: '1' }), false)
  assert.equal(shouldResumeJob(null), false)
})

test('latestJobBy: งานล่าสุด (id มากสุด) ต่อกุญแจ · กุญแจว่างไม่นับ', () => {
  const jobs = [{ id: 1, idea_id: 33, post_key: null }, { id: 5, idea_id: 33, post_key: null }, { id: 3, idea_id: 40, post_key: '9' }]
  const byIdea = latestJobBy(jobs.filter((j) => !j.post_key), (j) => j.idea_id)
  assert.deepEqual(Object.keys(byIdea), ['33'])
  assert.equal(byIdea[33].id, 5)
  assert.equal(latestJobBy(jobs, (j) => j.post_key)['9'].id, 3)
})

test('freshJobStatus: บอกสถานะจริง — คอมปิด · ตัวรับงานรุ่นเก่า · รอคิว · กำลังคิด (นับเวลา) · ล้มพร้อมเหตุผล · จบแล้วไม่มีข้อความ', () => {
  const queued = { status: 'queued', created_at: new Date(NOW - 20 * 1000).toISOString() }
  assert.equal(freshJobStatus(queued, { online: false }, NOW).tone, 'warn')
  assert.match(freshJobStatus(queued, { online: false }, NOW).text, /คอมสำนักงานปิดอยู่/)
  assert.match(freshJobStatus(queued, { online: true, content: false }, NOW).text, /รุ่นเก่า/)
  assert.match(freshJobStatus(queued, { online: true, content: true }, NOW).text, /^รอคิวบนคอมสำนักงาน · 0:20$/)
  const running = { status: 'running', created_at: new Date(NOW - 200 * 1000).toISOString(), claimed_at: new Date(NOW - 75 * 1000).toISOString() }
  assert.match(freshJobStatus(running, { online: true, content: true }, NOW).text, /กำลังคิด[\s\S]*1:15/)
  const failed = freshJobStatus({ status: 'failed', error: 'AI เขียนร่างไม่ผ่านด่านตรวจ' }, null, NOW)
  assert.equal(failed.tone, 'error')
  assert.match(failed.text, /ไม่ผ่านด่านตรวจ · กดคิดใหม่ได้อีกครั้ง/)
  assert.equal(freshJobStatus({ status: 'done' }, null, NOW), null)
  assert.equal(freshJobStatus(null), null)
})

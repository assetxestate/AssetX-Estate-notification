// เทสต์ของ shared-browser.mjs — รัน: node --test shared-browser.test.mjs (ใช้โฟลเดอร์ชั่วคราว ไม่แตะ ~/.research-browser)
// ก๊อปไปโปรเจกต์ไหน ก๊อปเทสต์ไปด้วย · ฝั่ง DVX มีเทสต์ชุดเดียวกันที่ scripts/test_shared_browser.py
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Lock, LostLock, STALE_MS, blockedFor, pagesOn, readState } from './shared-browser.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'shared-browser-'))
const age = (p, ms) => {
  const t = new Date(Date.now() - ms)
  fs.utimesSync(p, t, t)
}

test('ถือได้ทีละคน · ปล่อยแล้วอีกฝั่งถือได้', () => {
  const base = tmp()
  const a = new Lock('assetx', { base })
  const b = new Lock('dvx', { base })
  assert.equal(a.tryAcquire(), true)
  assert.equal(b.tryAcquire(), false)
  assert.equal(b.holder().project, 'assetx')
  b.release() // ไม่ได้ถือ = ห้ามลบของคนอื่น
  assert.equal(fs.existsSync(a.path), true)
  a.release()
  assert.equal(fs.existsSync(a.path), false)
  assert.equal(b.tryAcquire(), true)
  b.release()
})

test('สัญญาณชีพแตะ mtime · กุญแจค้างเกิน 10 นาทียึดได้ · เจ้าของเดิมรู้ว่าหลุด', () => {
  const base = tmp()
  const a = new Lock('dvx', { base })
  const b = new Lock('assetx', { base })
  a.tryAcquire()
  age(a.path, STALE_MS - 60e3)
  assert.equal(a.beat(), true)
  assert.ok(b.holder().idle_sec < 5)
  age(a.path, STALE_MS - 60e3)
  assert.equal(b.tryAcquire(), false, 'เงียบ 9 นาทียังไม่ค้าง')
  age(a.path, STALE_MS + 60e3)
  assert.equal(b.tryAcquire(), true)
  assert.equal(b.stolenFrom.project, 'dvx')
  assert.deepEqual(fs.readdirSync(base), ['lock.json'])
  assert.equal(a.beat(), false)
  assert.throws(() => a.require(), LostLock)
  a.release()
  assert.equal(b.holder().project, 'assetx', 'เจ้าของเดิมปล่อยต้องไม่ลบกุญแจใหม่')
  b.release()
})

test('ไฟล์กุญแจว่างที่ยังสด = มีคนถือ · ที่ค้าง = ยึดได้', () => {
  const base = tmp()
  fs.writeFileSync(path.join(base, 'lock.json'), '')
  assert.equal(new Lock('x', { base }).tryAcquire(), false)
  age(path.join(base, 'lock.json'), STALE_MS + 5e3)
  assert.equal(new Lock('x', { base }).tryAcquire(), true)
})

test('acquire รอจนว่าง / หมดเวลา', async () => {
  const base = tmp()
  const a = new Lock('dvx', { base })
  a.tryAcquire()
  setTimeout(() => a.release(), 300)
  assert.equal(await new Lock('assetx', { base }).acquire({ waitMs: 3000, pollMs: 100 }), true)
  assert.equal(await new Lock('x', { base }).acquire({ waitMs: 200, pollMs: 100 }), false)
})

test('สถานะพักร่วม 3 วัน + บันทึกการใช้ (ต้องถือกุญแจ)', () => {
  const base = tmp()
  const a = new Lock('assetx', { base })
  assert.throws(() => a.setBlocked('facebook', 'checkpoint'), LostLock)
  a.tryAcquire()
  a.setBlocked('facebook', 'Facebook ขอ checkpoint', '2026-11-03')
  assert.equal(blockedFor('facebook', '2026-11-05', base).by, 'assetx')
  assert.equal(blockedFor('facebook', '2026-11-06', base), null)
  assert.equal(blockedFor('instagram', '2026-11-03', base), null)
  assert.equal(a.clearBlocked('facebook'), true)
  assert.equal(a.clearBlocked('facebook'), false)
  a.logUsage({ facebook: 4 }, 'ok', { day: '2026-11-03' })
  a.logUsage({ facebook: 0, reddit: 2 }, 'ok', { day: '2026-11-03' })
  a.logUsage({ facebook: 3 }, 'ok', { day: '2026-11-02' })
  fs.appendFileSync(path.join(base, 'usage.jsonl'), '{"project":"dvx","date":"2026-11-03","pages":{"facebook":5}}\n{"broken\n')
  assert.deepEqual(pagesOn('2026-11-03', base), { facebook: 9, reddit: 2 })
  a.logUsage({}, 'ok', { day: '2026-11-03', opened: { facebook: 4 } }) // แถวสรุป: ไม่นับซ้ำ
  assert.deepEqual(pagesOn('2026-11-03', base), { facebook: 9, reddit: 2 })
  const torn = Buffer.from('{"project":"assetx","date":"2026-11-03","pages":{"facebook":1},"note":"อ่านเพจ"}')
  fs.appendFileSync(path.join(base, 'usage.jsonl'), torn.subarray(0, -9)) // ของจริง: ขาดกลางทาง ไม่มี \n ปิดท้าย
  a.logUsage({ facebook: 2 }, 'open', { day: '2026-11-03' })
  assert.deepEqual(pagesOn('2026-11-03', base), { facebook: 11, reddit: 2 }, 'เสียบรรทัดเดียว แถวถัดไปไม่โดนกลืน')
  fs.appendFileSync(path.join(base, 'usage.jsonl'), Buffer.alloc(40)) // ท้ายไฟล์เป็น NUL หลังเครื่องดับ
  a.logUsage({ facebook: 1 }, 'open', { day: '2026-11-03' })
  assert.deepEqual(pagesOn('2026-11-03', base), { facebook: 12, reddit: 2 }, 'ท้ายไฟล์เป็น NUL = แถวใหม่ยังนับ')
  a.release()
})

test('กุญแจหลุดกลางรอบ: เพจที่จดก่อนเปิดยังนับ · แถวสรุปเขียนไม่ได้แต่ต้องปล่อยได้ไม่โยน', () => {
  const base = tmp()
  const a = new Lock('assetx', { base })
  a.tryAcquire()
  a.logUsage({ facebook: 1 }, 'open')
  age(a.path, STALE_MS + 60e3)
  const b = new Lock('dvx', { base })
  assert.equal(b.tryAcquire(), true)
  assert.throws(() => a.logUsage({ facebook: 1 }, 'open'), LostLock)
  try {
    if (a.held) a.logUsage({}, 'ok')
  } catch {}
  a.release()
  assert.equal(b.holder().project, 'dvx')
  assert.deepEqual(pagesOn(undefined, base), { facebook: 1 })
  b.release()
  fs.writeFileSync(path.join(base, 'state.json'), '{เสีย')
  assert.deepEqual(readState(base).blocked, {})
})

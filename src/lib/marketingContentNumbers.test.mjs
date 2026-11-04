import test from 'node:test'
import assert from 'node:assert/strict'
import { contentNoOf, contentReference, ensureContentNumbers, findContentByNo, formatContentNo, parseContentNo } from './marketingContentNumbers.js'
import { importHermesDraft } from './hermesMarketingDraft.js'

// posts เรียงใหม่สุดก่อนเสมอ (ทุกทางที่สร้างคอนเทนต์ใส่ไว้หน้าสุด)
const legacy = () => ({ posts: [{ id: 3, title: 'ใหม่สุด' }, { id: 'hermes-abc', title: 'กลาง' }, { id: 1, title: 'เก่าสุด' }] })

test('คอนเทนต์เดิมที่ยังไม่มีเลข ได้เลขไล่จากเก่าสุด และตัวนับเท่ากับเลขสูงสุด', () => {
  const next = ensureContentNumbers(legacy())
  assert.deepEqual(next.posts.map((post) => post.contentNo), [3, 2, 1])
  assert.equal(next.contentSeq, 3)
})

test('เปิดซ้ำกี่ครั้งเลขก็เหมือนเดิม และไม่สร้างอ็อบเจกต์ใหม่ถ้าไม่มีอะไรเปลี่ยน', () => {
  const once = ensureContentNumbers(legacy())
  const twice = ensureContentNumbers(once)
  assert.equal(twice, once)
  assert.deepEqual(ensureContentNumbers(legacy()), once)
})

test('คอนเทนต์ใหม่ได้เลขถัดจากตัวนับ แม้ชิ้นเลขสูงสุดถูกลบไปแล้ว (ไม่ใช้เลขซ้ำ)', () => {
  const numbered = ensureContentNumbers(legacy())
  const afterDelete = { ...numbered, posts: numbered.posts.filter((post) => post.contentNo !== 3) }
  const next = ensureContentNumbers({ ...afterDelete, posts: [{ id: 4, title: 'ชิ้นใหม่' }, ...afterDelete.posts] })
  assert.equal(next.posts[0].contentNo, 4)
  assert.equal(next.contentSeq, 4)
})

test('แก้ข้อความหรือย้ายสถานะ เลขไม่เปลี่ยน', () => {
  const numbered = ensureContentNumbers(legacy())
  const edited = { ...numbered, posts: numbered.posts.map((post) => post.id === 1 ? { ...post, caption: 'แก้แล้ว', status: 'archived' } : post) }
  const next = ensureContentNumbers(edited)
  assert.equal(next, edited)
  assert.equal(findContentByNo(next.posts, 1).caption, 'แก้แล้ว')
})

test('เลขชนกัน: ชิ้นเก่าได้เลขเดิม ชิ้นใหม่ได้เลขใหม่ต่อจากตัวนับ', () => {
  const next = ensureContentNumbers({ contentSeq: 5, posts: [{ id: 9, contentNo: 2 }, { id: 8, contentNo: 2 }, { id: 7, contentNo: 5 }] })
  assert.deepEqual(next.posts.map((post) => post.contentNo), [6, 2, 5])
  assert.equal(next.contentSeq, 6)
})

test('ตัวนับไม่ถอยหลัง แม้เลขสูงสุดที่เหลืออยู่ต่ำกว่า', () => {
  const next = ensureContentNumbers({ contentSeq: 40, posts: [{ id: 2 }, { id: 1, contentNo: 7 }] })
  assert.deepEqual(next.posts.map((post) => post.contentNo), [41, 7])
  assert.equal(next.contentSeq, 41)
})

test('ร่างตัวอย่างจากแม่แบบไม่ได้เลข · ค่าเลขที่ไม่ใช่จำนวนเต็มบวกถูกแทนด้วยเลขใหม่', () => {
  const next = ensureContentNumbers({ posts: [{ id: 'sample-1' }, { id: 5, contentNo: '3' }, { id: 4, contentNo: 0 }, { id: 3, contentNo: 2.5 }] })
  assert.equal(next.posts[0].contentNo, undefined)
  assert.deepEqual(next.posts.slice(1).map((post) => post.contentNo), [3, 2, 1])
})

test('เวิร์กสเปซว่าง: ตัวนับเริ่มที่ 0 · ค่าแปลกปลอมไม่ทำให้ล้ม', () => {
  assert.deepEqual(ensureContentNumbers({}), { posts: [], contentSeq: 0 })
  assert.equal(ensureContentNumbers(null), null)
  const withJunk = ensureContentNumbers({ posts: [null, 'x', { id: 1 }] })
  assert.deepEqual(withJunk.posts, [null, 'x', { id: 1, contentNo: 1 }])
})

test('floor: เลขใหม่เริ่มต่อจากเลขที่เครื่องนี้เคยแจก แม้สำเนาที่ได้มามีตัวนับต่ำกว่า', () => {
  const stale = { contentSeq: 6, posts: [{ id: 'new' }, { id: 6, contentNo: 6 }] }
  const next = ensureContentNumbers(stale, { floor: 9 })
  assert.equal(next.posts[0].contentNo, 10)
  assert.equal(next.contentSeq, 10)
  assert.equal(next.posts[1].contentNo, 6, 'เลขเดิมไม่เปลี่ยน')
  assert.equal(ensureContentNumbers({ contentSeq: 12, posts: [] }, { floor: 9 }).contentSeq, 12, 'floor ไม่ดึงตัวนับลง')
  assert.equal(ensureContentNumbers({ posts: [] }, { floor: 'x' }).contentSeq, 0, 'floor แปลกปลอม = 0')
})

test('ลำดับในหน้าเว็บ: แจกเลขของเก่าจากข้อมูลจากระบบก่อน แล้วค่อยใช้ floor → ทุกเครื่องได้เลขของเก่าตรงกัน', () => {
  const cloudLegacy = { posts: [{ id: 'c' }, { id: 'b' }, { id: 'a' }] }
  // เครื่องที่เคยแจกถึง #50 (floor 50) กับเครื่องใหม่ (floor 0) ต้องได้เลขของเก่าชุดเดียวกัน
  const deviceWithFloor = ensureContentNumbers(ensureContentNumbers(cloudLegacy), { floor: 50 })
  const freshDevice = ensureContentNumbers(ensureContentNumbers(cloudLegacy), { floor: 0 })
  assert.deepEqual(deviceWithFloor.posts.map((post) => post.contentNo), [3, 2, 1])
  assert.deepEqual(freshDevice.posts.map((post) => post.contentNo), [3, 2, 1])
  assert.equal(deviceWithFloor.contentSeq, 50, 'ตัวนับยกขึ้นถึงเลขที่เครื่องนี้เคยแจก — ชิ้นใหม่ถัดไปได้ #51')
  // ถ้าใช้ floor ตั้งแต่แรก (ผิดลำดับ) เลขของเก่าจะไม่ตรงกับเครื่องอื่น — เทสต์นี้กันการสลับลำดับในหน้าเว็บ
  assert.deepEqual(ensureContentNumbers(cloudLegacy, { floor: 50 }).posts.map((post) => post.contentNo), [53, 52, 51])
})

const hermesDraft = (id) => ({
  version: 1,
  id,
  title: 'ร่างจากผู้ช่วย',
  caption: 'แคปชั่นทดสอบ',
  imagePrompt: 'prompt',
  sources: [{ file: 'note.md', sha256: 'a'.repeat(64) }],
  image: 'data:image/png;base64,AAAA',
})

test('ร่างจาก Telegram: ได้เลขถัดไปก่อนบันทึก · นำเข้าซ้ำไม่ได้เลขใหม่ · ลบแล้ว (ซ่อนไว้) ไม่ถูกนำเข้ากลับ', () => {
  const id = 'b'.repeat(32)
  const base = ensureContentNumbers(ensureContentNumbers(legacy()), { floor: 0 })
  const imported = ensureContentNumbers(importHermesDraft(base, hermesDraft(id)))
  assert.equal(contentNoOf(imported, `hermes-${id}`), 4)
  assert.equal(importHermesDraft(imported, hermesDraft(id)), imported, 'มีอยู่แล้ว = ไม่นำเข้าซ้ำ')
  // หน้าเว็บลบร่าง Telegram แล้วจำ id ไว้ใน hiddenPostIds → เปิดลิงก์เดิมอีกครั้งต้องไม่ได้ร่างคืนพร้อมเลขใหม่
  const deleted = { ...imported, posts: imported.posts.filter((post) => post.id !== `hermes-${id}`), hiddenPostIds: [`hermes-${id}`] }
  assert.equal(importHermesDraft(deleted, hermesDraft(id)), deleted)
  // ร่างใหม่ถัดไปไม่ใช้ #4 ซ้ำ
  const nextDraft = ensureContentNumbers({ ...deleted, posts: [{ id: 99 }, ...deleted.posts] })
  assert.equal(nextDraft.posts[0].contentNo, 5)
})

test('อ่านเลขจากข้อความที่คนพิมพ์ — รับเฉพาะเลข ไม่เดาจากข้อความอื่น', () => {
  assert.equal(parseContentNo('12'), 12)
  assert.equal(parseContentNo(' #12 '), 12)
  assert.equal(parseContentNo('คอนเทนต์ 12'), 12)
  assert.equal(parseContentNo('คอนเทนต์ #12 · มีโฉนด แต่ไม่อยากขายขาด'), 12, 'วางข้อความที่คัดลอกจากป้ายได้')
  assert.equal(parseContentNo('#๑๒'), 12)
  assert.equal(parseContentNo('0012'), 12)
  for (const text of ['#0', 'ไม่มีเลข', undefined, '', 'ไอเดีย 5', 'จากไอเดีย 12', '12abc', '1 2', '1,234', '-3', '3.9', 'ก่อนซื้อทรัพย์ เช็ก 3 เรื่อง']) {
    assert.equal(parseContentNo(text), null, `ไม่รับ: ${text}`)
  }
})

test('ค้น จัดรูป และข้อความอ้างอิงสำหรับคัดลอก', () => {
  const numbered = ensureContentNumbers(legacy())
  assert.equal(findContentByNo(numbered.posts, '#2').id, 'hermes-abc')
  assert.equal(findContentByNo(numbered.posts, 99), null)
  assert.equal(findContentByNo([{ id: 'sample-1', contentNo: 1 }], 1), null)
  assert.equal(contentNoOf(numbered, 'hermes-abc'), 2)
  assert.equal(contentNoOf(numbered, 'missing'), null)
  assert.equal(formatContentNo(12), '#12')
  assert.equal(formatContentNo(undefined), '')
  assert.equal(contentReference({ contentNo: 12, title: 'มีโฉนด แต่ไม่อยากขายขาด' }), 'คอนเทนต์ #12 · มีโฉนด แต่ไม่อยากขายขาด')
  assert.equal(contentReference({ title: 'ตัวอย่าง' }), 'ตัวอย่าง')
})

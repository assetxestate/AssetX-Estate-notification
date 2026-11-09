import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isoWeek, knowledgePage, hookPage, weeklyDigest, indexPage, listNotes, writeIfChanged, collectFiles, makeBundle, restoreBundle, writeLocalSnapshot, AREAS, AUTO_PREFIX, SNAPSHOT_DIR } from './library.js'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lib-'))

test('isoWeek: สัปดาห์ ISO (จันทร์เป็นวันแรก · ข้ามปีถูก)', () => {
  assert.equal(isoWeek('2026-11-09'), '2026-W46')
  assert.equal(isoWeek('2026-11-15'), '2026-W46')
  assert.equal(isoWeek('2026-11-16'), '2026-W47')
  assert.equal(isoWeek('2027-01-01'), '2026-W53')
})

test('knowledgePage / hookPage: หน้าอัตโนมัติจากไฟล์ในรีโป มีที่มา/ความมั่นใจ · สูตรพร้อมบทเรียน · สูตรตลาดแยกหมวด', () => {
  const kb = JSON.parse(fs.readFileSync(new URL('../../research/knowledge_base.json', import.meta.url), 'utf8'))
  const k = knowledgePage(kb, { today: '2026-11-09' })
  assert.ok(k.startsWith(`# ${AUTO_PREFIX}`))
  assert.equal((k.match(/^\| [a-z0-9-]+ \|/gm) || []).length, kb.entries.length, 'ทุกข้อในคลังอยู่ในตาราง')
  assert.match(k, /official/)
  const lib = JSON.parse(fs.readFileSync(new URL('../../research/hook_patterns.json', import.meta.url), 'utf8'))
  const h = hookPage(lib, { updated: '2026-11-09T00:00:00Z', samples: { total: 10, hot: 3 }, patterns: { 'can-i': { n: 6, hot: 3, lift: 2 }, 'outcome-promise': { n: 9, hot: 6, lift: 2.2 } } }, { today: '2026-11-09' })
  assert.match(h, /`can-i`\) \|/)
  assert.match(h, /×2 · 3\/6/)
  assert.match(h, /สูตรที่พบในตลาดแต่เราไม่ใช้[\s\S]*`outcome-promise` \| ×2.2/)
})

test('weeklyDigest: โพสต์แรงในช่วง 7 วัน · คลิปที่รายงานในช่วงนี้ · แอดใหม่ไม่ซ้ำ · บทเรียน · คิวไอเดีย · ช่องตาราง | ไม่พัง', () => {
  const posts = { a: { first_seen: '2026-11-08', caption: 'ขายฝากมีค่าใช้จ่ายอะไรบ้าง | ?', m: { reactions: 57 }, link: 'https://fb/a' } }
  for (let i = 0; i < 5; i++) posts[`b${i}`] = { first_seen: '2026-11-08', caption: `โพสต์ ${i}`, m: { reactions: 5 } }
  posts.old = { first_seen: '2026-10-01', last_seen: '2026-10-01', caption: 'เก่า', m: { reactions: 999 } }
  const fb = [{ page: 'เพจ ก', posts, reels: { r1: { views: 4800, reported: '2026-11-09', caption: 'มีโฉนดอยู่ในมือ', link: 'https://fb/reel/r1' }, r2: { views: 600 }, r3: { views: 500 } } }]
  const ads = { ads: { x: { page: 'เจ้า ก', text: 'แอดหนึ่ง\nรายละเอียด', first_seen: '2026-11-07' }, y: { page: 'เจ้า ก', text: 'แอดหนึ่ง\nเวอร์ชันสอง', first_seen: '2026-11-07' }, z: { page: 'เจ้า ข', text: 'แอดสอง', first_seen: '2026-10-01' } } }
  const d = weeklyDigest({ today: '2026-11-09', fb, ads, lessons: { samples: { total: 5, hot: 1 }, patterns: { 'can-i': { n: 6, hot: 3, lift: 2 } } }, ideas: { newIdeas: 4, drafted: 9, withHooks: 6, hookPatterns: { 'can-i': 2 } } })
  assert.match(d, /2026-W46/)
  assert.match(d, /ขายฝากมีค่าใช้จ่ายอะไรบ้าง \\\| \?/, 'อักษร | ในข้อความถูก escape')
  assert.doesNotMatch(d, /เก่า/, 'นอกช่วง 7 วันไม่นับ')
  assert.match(d, /\| เพจ ก \| 4800 \| ×8 \| มีโฉนดอยู่ในมือ \|/)
  assert.equal((d.match(/แอดหนึ่ง/g) || []).length, 1, 'แอดหลายเวอร์ชันนับครั้งเดียว')
  assert.match(d, /`can-i` ×2 \(3\/6\)/)
  assert.match(d, /ไอเดียใหม่ในช่วงนี้ 4 · มีร่าง AI 9 · ร่างที่มี hook 6/)
})

test('indexPage + listNotes + writeIfChanged: สารบัญตาม 3 หมวด รวมโฟลเดอร์ย่อย · เขียนเฉพาะเมื่อเนื้อเปลี่ยน', () => {
  const dir = tmp()
  for (const a of Object.values(AREAS)) fs.mkdirSync(path.join(dir, a), { recursive: true })
  fs.mkdirSync(path.join(dir, AREAS.marketing, 'สรุปรายสัปดาห์'), { recursive: true })
  fs.writeFileSync(path.join(dir, AREAS.design, 'โปสเตอร์.md'), 'x')
  fs.writeFileSync(path.join(dir, AREAS.marketing, 'สรุปรายสัปดาห์', 'อัตโนมัติ - 2026-W46.md'), 'x')
  const notes = listNotes(dir)
  assert.deepEqual(notes.design, [`${AREAS.design}/โปสเตอร์`])
  assert.deepEqual(notes.marketing, [`${AREAS.marketing}/สรุปรายสัปดาห์/อัตโนมัติ - 2026-W46`])
  const idx = indexPage({ today: '2026-11-09', notes })
  assert.match(idx, /\[\[01 ออกแบบ\/โปสเตอร์\]\]/)
  assert.match(idx, /## 03 วิชาการ\n\n- \(ยังไม่มีโน้ต\)/)
  assert.match(idx, /บนเครื่องนี้เท่านั้น/, 'บอกชัดว่าไม่ขึ้นเซิร์ฟเวอร์')
  const f = path.join(dir, '00 สารบัญ.md')
  assert.equal(writeIfChanged(f, idx), true)
  assert.equal(writeIfChanged(f, idx), false)
})

test('สำเนาข้อมูลดิบในเครื่อง: เก็บไฟล์ข้อความ (ไม่เอา .gz/รูป) · gzip กู้คืนได้ครบ · เก็บล่าสุด 12 ชุด ลบชุดเก่า', () => {
  const src = tmp()
  fs.mkdirSync(path.join(src, 'facebook'))
  fs.writeFileSync(path.join(src, 'facebook', 'fb_a.json'), '{"posts":{}}')
  fs.writeFileSync(path.join(src, 'runs.jsonl'), '{"a":1}\n')
  fs.writeFileSync(path.join(src, 'pic.png'), 'x')
  const files = collectFiles([{ dir: src, as: 'social' }, { dir: path.join(src, 'ไม่มี'), as: 'x' }])
  assert.deepEqual(Object.keys(files).sort(), ['social/facebook/fb_a.json', 'social/runs.jsonl'])
  const buf = makeBundle(files, { createdAt: '2026-11-09T00:00:00Z' })
  const back = restoreBundle(buf)
  assert.deepEqual(back.files, files)
  assert.throws(() => restoreBundle(Buffer.from('nope')))
  const lib = tmp()
  for (let i = 1; i <= 14; i++) writeLocalSnapshot(lib, buf, { day: `2026-11-${String(i).padStart(2, '0')}` })
  const left = fs.readdirSync(path.join(lib, SNAPSHOT_DIR)).sort()
  assert.equal(left.length, 12)
  assert.equal(left[0], '2026-11-03.json.gz')
})

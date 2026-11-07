import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { handlePosterRefMessage, isRefCaption, localFileName, pickImage, refNote, slugNote, storagePathFor, syncPosterRefs } from './poster-refs.js'

// ฐานข้อมูลปลอม: ตาราง poster_refs ในหน่วยความจำ + storage ที่จำไฟล์ที่อัปโหลด
function fakeDb(rows = []) {
  const table = rows.map((r, i) => ({ id: i + 1, created_at: '2026-11-07T10:00:00Z', ...r }))
  let nextId = table.length + 1
  const uploads = []
  const matches = (row, filters) => filters.every(([op, k, v]) => (op === 'eq' ? row[k] === v : v.includes(row[k])))
  const make = () => {
    const s = { op: 'select', patch: null, filters: [], limit: null, onConflict: null }
    const run = () => {
      if (s.op === 'upsert') {
        const existing = s.onConflict ? table.find((r) => r[s.onConflict] === s.patch[s.onConflict]) : null
        if (existing) Object.assign(existing, s.patch)
        else table.push({ id: nextId++, created_at: '2026-11-07T10:05:00Z', ...s.patch })
        return { data: null, error: null }
      }
      const hits = table.filter((r) => matches(r, s.filters))
      if (s.op === 'update') { hits.forEach((r) => Object.assign(r, s.patch)); return { data: hits, error: null } }
      return { data: s.limit === null ? hits : hits.slice(0, s.limit), error: null }
    }
    const q = {
      select() { return q },
      eq(k, v) { s.filters.push(['eq', k, v]); return q },
      in(k, v) { s.filters.push(['in', k, v]); return q },
      order() { return q },
      limit(n) { s.limit = n; return q },
      upsert(patch, opts = {}) { s.op = 'upsert'; s.patch = patch; s.onConflict = opts.onConflict || null; return q },
      update(patch) { s.op = 'update'; s.patch = patch; return q },
      then(resolve, reject) { try { resolve(run()) } catch (err) { reject(err) } },
    }
    return q
  }
  return {
    table,
    uploads,
    from(name) { assert.equal(name, 'poster_refs'); return make() },
    storage: {
      from(bucket) {
        assert.equal(bucket, 'marketing-images')
        return {
          async upload(objectPath, bytes, opts) { uploads.push({ objectPath, size: bytes.length, contentType: opts.contentType }); return { error: null } },
          async download(objectPath) { return { data: { arrayBuffer: async () => Buffer.from(`file:${objectPath}`) }, error: null } },
        }
      },
    },
  }
}

function fakeTelegram() {
  const sent = []
  return {
    sent,
    async getFile(fileId) { return { file_path: `photos/${fileId}.jpg` } },
    async download(filePath) { return Buffer.from(`bytes-of-${filePath}`) },
    async send(chatId, text) { sent.push({ chatId, text }) },
  }
}

const photoMessage = (over = {}) => ({
  message_id: 10,
  chat: { id: 555 },
  photo: [
    { file_id: 'small', file_unique_id: 'u-small', width: 320, height: 400 },
    { file_id: 'big', file_unique_id: 'u-big', width: 1024, height: 1280 },
  ],
  ...over,
})

test('pickImage: เลือกรูปใหญ่สุดจาก photo · document รับเฉพาะ jpeg/png · อื่น ๆ null', () => {
  const photo = pickImage(photoMessage())
  assert.equal(photo.file_id, 'big')
  assert.equal(photo.ext, 'jpg')
  const png = pickImage({ document: { file_id: 'd1', file_unique_id: 'ud1', mime_type: 'image/png', file_name: 'ref.png' } })
  assert.equal(png.ext, 'png')
  assert.equal(png.mime, 'image/png')
  assert.equal(pickImage({ document: { file_id: 'd2', file_unique_id: 'ud2', mime_type: 'application/pdf' } }), null)
  assert.equal(pickImage({ text: 'สวัสดี' }), null)
  assert.equal(storagePathFor(photo), 'poster-refs/u-big.jpg')
})

test('คำนำและหมายเหตุ: จับคำว่า รูปตัวอย่าง/poster ref · หมายเหตุตัดคำนำและลบเบอร์โทร · slug คงอักษรไทย', () => {
  assert.equal(isRefCaption('รูปตัวอย่าง ชอบการ์ดเทียบสองฝั่ง'), true)
  assert.equal(isRefCaption('Poster ref: headline style'), true)
  assert.equal(isRefCaption('สลิปโอนเงิน'), false)
  assert.equal(refNote('รูปตัวอย่าง ชอบการ์ดเทียบสองฝั่ง'), 'ชอบการ์ดเทียบสองฝั่ง')
  assert.doesNotMatch(refNote('รูปตัวอย่าง โทร 081-234-5678 ของเพจนี้'), /081/)
  assert.equal(slugNote('ชอบ การ์ด/เทียบ สองฝั่ง!'), 'ชอบ-การ์ด-เทียบ-สองฝั่ง')
  assert.equal(localFileName({ id: 7, created_at: '2026-11-07T12:00:00Z', note: 'ชอบพาดหัว', storage_path: 'poster-refs/x.png' }), '20261107-7-ชอบพาดหัว.png')
  assert.equal(localFileName({ id: 8, created_at: '2026-11-07T12:00:00Z', note: '', storage_path: 'poster-refs/y.jpg' }), '20261107-8.jpg')
})

test('รูปเดี่ยวมีคำนำ: อัปโหลด poster-refs/<uid>.jpg · แถว new พร้อมหมายเหตุ · ตอบกลับนับ 1 ภาพ', async () => {
  const db = fakeDb()
  const telegram = fakeTelegram()
  const result = await handlePosterRefMessage({ message: photoMessage({ caption: 'รูปตัวอย่าง ชอบริบบิ้นใต้พาดหัว' }), db, telegram })
  assert.deepEqual(result, { handled: true, status: 'new', stored: 1 })
  assert.equal(db.uploads.length, 1)
  assert.equal(db.uploads[0].objectPath, 'poster-refs/u-big.jpg')
  assert.equal(db.uploads[0].contentType, 'image/jpeg')
  assert.equal(db.table.length, 1)
  assert.equal(db.table[0].status, 'new')
  assert.equal(db.table[0].note, 'ชอบริบบิ้นใต้พาดหัว')
  assert.equal(db.table[0].storage_path, 'poster-refs/u-big.jpg')
  assert.equal(telegram.sent.length, 1)
  assert.match(telegram.sent[0].text, /รับรูปตัวอย่างแล้ว 1 ภาพ/)
  assert.match(telegram.sent[0].text, /ชอบริบบิ้นใต้พาดหัว/)
})

test('รูปเดี่ยวไม่มีคำนำและไม่ใช่อัลบั้ม → null (ให้ผู้ช่วยตอบตามเดิม) · ไม่มี db → ตอบว่าเก็บไม่ได้', async () => {
  const telegram = fakeTelegram()
  assert.equal(await handlePosterRefMessage({ message: photoMessage(), db: fakeDb(), telegram }), null)
  const noDb = await handlePosterRefMessage({ message: photoMessage({ caption: 'รูปตัวอย่าง' }), db: null, telegram })
  assert.equal(noDb.status, 'skipped')
  assert.match(telegram.sent[0].text, /SUPABASE_SERVICE_ROLE_KEY/)
})

test('อัลบั้ม: รูปที่มาก่อนคำบรรยายเป็น unclaimed ไม่อัปโหลด · รูปที่มีคำบรรยายยกทั้งกลุ่มเป็น new และนับรวม · รูปที่มาทีหลังเป็น new ทันที', async () => {
  const db = fakeDb()
  const telegram = fakeTelegram()
  const first = await handlePosterRefMessage({ message: photoMessage({ message_id: 1, media_group_id: 'g1', photo: [{ file_id: 'a', file_unique_id: 'ua', width: 900, height: 1200 }] }), db, telegram })
  assert.deepEqual(first, { handled: true, status: 'unclaimed', stored: 0 })
  assert.equal(db.uploads.length, 0)
  assert.equal(telegram.sent.length, 0)

  const captioned = await handlePosterRefMessage({ message: photoMessage({ message_id: 2, media_group_id: 'g1', caption: 'รูปตัวอย่าง ชอบการ์ดแถวไอคอน', photo: [{ file_id: 'b', file_unique_id: 'ub', width: 900, height: 1200 }] }), db, telegram })
  assert.deepEqual(captioned, { handled: true, status: 'new', stored: 2 })
  assert.deepEqual(db.uploads.map((u) => u.objectPath).sort(), ['poster-refs/ua.jpg', 'poster-refs/ub.jpg'])
  const rowA = db.table.find((r) => r.file_unique_id === 'ua')
  assert.equal(rowA.status, 'new')
  assert.equal(rowA.note, 'ชอบการ์ดแถวไอคอน')
  assert.match(telegram.sent[0].text, /รับรูปตัวอย่างแล้ว 2 ภาพ/)

  const late = await handlePosterRefMessage({ message: photoMessage({ message_id: 3, media_group_id: 'g1', photo: [{ file_id: 'c', file_unique_id: 'uc', width: 900, height: 1200 }] }), db, telegram })
  assert.deepEqual(late, { handled: true, status: 'new', stored: 1 })
  assert.equal(db.uploads.length, 3)
  assert.equal(telegram.sent.length, 1, 'รูปในอัลบั้มที่ไม่มีคำบรรยายไม่ตอบซ้ำ')

  // อัลบั้มอื่นที่ไม่มีคำนำเลย → unclaimed เงียบ ๆ ไม่อัปโหลด
  const other = await handlePosterRefMessage({ message: photoMessage({ message_id: 4, media_group_id: 'g2', photo: [{ file_id: 'd', file_unique_id: 'ud', width: 900, height: 1200 }] }), db, telegram })
  assert.equal(other.status, 'unclaimed')
  assert.equal(db.uploads.length, 3)
})

test('ส่งรูปเดิมซ้ำ: upsert ตาม file_unique_id ไม่เพิ่มแถวใหม่', async () => {
  const db = fakeDb()
  const telegram = fakeTelegram()
  await handlePosterRefMessage({ message: photoMessage({ caption: 'รูปตัวอย่าง' }), db, telegram })
  await handlePosterRefMessage({ message: photoMessage({ message_id: 11, caption: 'รูปตัวอย่าง ส่งซ้ำ' }), db, telegram })
  assert.equal(db.table.length, 1)
  assert.equal(db.table[0].note, 'ส่งซ้ำ')
})

test('syncPosterRefs: ดึงแถว new ลง inbox เป็นไฟล์ + notes.jsonl แล้วตั้ง fetched · ไม่มีแถว = 0', async () => {
  const inbox = await fs.mkdtemp(path.join(os.tmpdir(), 'poster-refs-'))
  const db = fakeDb([
    { status: 'new', storage_path: 'poster-refs/ua.jpg', note: 'ชอบพาดหัว', mime: 'image/jpeg' },
    { status: 'fetched', storage_path: 'poster-refs/ub.jpg', note: '', mime: 'image/jpeg' },
  ])
  const logs = []
  const n = await syncPosterRefs(db, { inboxDir: inbox, log: (s) => logs.push(s) })
  assert.equal(n, 1)
  const files = (await fs.readdir(inbox)).sort()
  assert.deepEqual(files, ['20261107-1-ชอบพาดหัว.jpg', 'notes.jsonl'])
  assert.equal(await fs.readFile(path.join(inbox, '20261107-1-ชอบพาดหัว.jpg'), 'utf8'), 'file:poster-refs/ua.jpg')
  const notes = (await fs.readFile(path.join(inbox, 'notes.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l))
  assert.equal(notes[0].file, '20261107-1-ชอบพาดหัว.jpg')
  assert.equal(notes[0].note, 'ชอบพาดหัว')
  assert.equal(db.table[0].status, 'fetched')
  assert.equal(db.table[0].local_name, '20261107-1-ชอบพาดหัว.jpg')
  assert.match(logs.join('\n'), /รับรูปตัวอย่างจากเทเลแกรม 1 ภาพ/)
  assert.equal(await syncPosterRefs(db, { inboxDir: inbox }), 0)
  await fs.rm(inbox, { recursive: true, force: true })
})

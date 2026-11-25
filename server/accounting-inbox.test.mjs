import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  INBOX_BUCKET, objectName, pickTelegramFile, telegramSenderAllowed, lineSenderAllowed,
  storeInboxFile, handleAccountingTelegramMessage, handleAccountingLineEvents, localName, pullInbox, ackText,
} from './accounting-inbox.js'

// ที่เก็บไฟล์จำลอง: จำเฉพาะสิ่งที่โมดูลใช้ (createBucket · list · upload · download · move)
function fakeDb() {
  const files = new Map()
  const buckets = []
  const from = (bucket) => ({
    async list(folder, { search } = {}) {
      const prefix = `${bucket}/${folder}/`
      const data = [...files.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ name: k.slice(prefix.length) }))
        .filter((f) => !search || f.name.includes(search)).sort((a, b) => a.name.localeCompare(b.name))
      return { data, error: null }
    },
    async upload(objectPath, bytes, { upsert } = {}) {
      const key = `${bucket}/${objectPath}`
      if (files.has(key) && !upsert) return { error: { message: 'The resource already exists' } }
      files.set(key, Buffer.from(bytes))
      return { data: { path: objectPath }, error: null }
    },
    async download(objectPath) {
      const hit = files.get(`${bucket}/${objectPath}`)
      return hit ? { data: { arrayBuffer: async () => hit.buffer.slice(hit.byteOffset, hit.byteOffset + hit.byteLength) }, error: null } : { error: { message: 'not found' } }
    },
    async move(a, b) {
      const hit = files.get(`${bucket}/${a}`)
      if (!hit) return { error: { message: 'not found' } }
      files.set(`${bucket}/${b}`, hit); files.delete(`${bucket}/${a}`)
      return { error: null }
    },
  })
  return { files, buckets, storage: { createBucket: async (name, opts) => { buckets.push({ name, opts }); return { error: null } }, from } }
}

const photoMessage = (extra = {}) => ({
  message_id: 5, date: 1795000000, chat: { id: -100 }, from: { id: 777 },
  photo: [{ file_id: 'small', file_unique_id: 'u-small', width: 90, height: 90 }, { file_id: 'big', file_unique_id: 'u-big', width: 1200, height: 1600 }],
  ...extra,
})
const fakeTelegram = () => {
  const sent = []
  return { sent, getFile: async (id) => ({ file_path: `photos/${id}.jpg` }), download: async () => Buffer.from('jpeg-bytes'), send: async (chat, text) => { sent.push({ chat, text }) } }
}

test('ชื่อไฟล์ในคิวเรียงตามเวลาและไม่มีอักขระแปลก', () => {
  const name = objectName({ source: 'telegram', uid: 'AQAD/x y', ext: 'jpg', at: new Date('2026-11-25T09:15:07.123Z') })
  assert.equal(name, '20261125T091507Z_telegram_AQADxy.jpg')
})

test('เลือกรูปขนาดใหญ่สุด และรับเอกสารเฉพาะ jpg png pdf', () => {
  assert.equal(pickTelegramFile(photoMessage()).file_id, 'big')
  assert.equal(pickTelegramFile({ document: { file_id: 'd', file_unique_id: 'ud', mime_type: 'application/pdf' } }).ext, 'pdf')
  assert.equal(pickTelegramFile({ document: { file_id: 'd', mime_type: 'application/zip' } }), null)
  assert.equal(pickTelegramFile({ text: 'สวัสดี' }), null)
})

test('ผู้ส่ง: เทเลแกรมไม่ตั้งค่า = รับทุกคนในห้อง · LINE ไม่ตั้งค่า = ไม่รับใครเลย', () => {
  assert.equal(telegramSenderAllowed(photoMessage(), {}), true)
  assert.equal(telegramSenderAllowed(photoMessage(), { ACCOUNTING_TELEGRAM_USER_ID: '1, 777' }), true)
  assert.equal(telegramSenderAllowed(photoMessage(), { ACCOUNTING_TELEGRAM_USER_ID: '1' }), false)
  assert.equal(lineSenderAllowed('Uabc', {}), false)
  assert.equal(lineSenderAllowed('Uabc', { ACCOUNTING_LINE_USER_ID: 'Uabc' }), true)
})

test('เทเลแกรม: เก็บไฟล์เข้า bucket ปิด พร้อมคำบรรยาย แล้วตอบรับ', async () => {
  const db = fakeDb(); const telegram = fakeTelegram()
  const out = await handleAccountingTelegramMessage({ message: photoMessage({ caption: 'สลิปค่าเช่า' }), db, telegram, env: {} })
  assert.deepEqual(out, { handled: true, stored: 1, duplicate: false })
  assert.equal(db.buckets[0].name, INBOX_BUCKET)
  assert.equal(db.buckets[0].opts.public, false)
  const names = [...db.files.keys()]
  assert.equal(names.length, 2)
  assert.match(names[0], /^accounting-inbox\/new\/\d{8}T\d{6}Z_telegram_u-big\.jpg$/)
  const meta = JSON.parse(db.files.get(names[1]).toString('utf8'))
  assert.equal(meta.caption, 'สลิปค่าเช่า')
  assert.equal(meta.source, 'telegram')
  assert.match(telegram.sent[0].text, /รับเอกสารบัญชีแล้ว 1 ไฟล์/)
})

test('เทเลแกรม: ส่งไฟล์เดิมซ้ำไม่เก็บซ้ำ แม้ไฟล์แรกถูกดึงลงเครื่องไปแล้ว', async () => {
  const db = fakeDb(); const telegram = fakeTelegram()
  await handleAccountingTelegramMessage({ message: photoMessage(), db, telegram, env: {} })
  const first = [...db.files.keys()].find((k) => k.endsWith('.jpg'))
  db.files.set(first.replace('/new/', '/fetched/'), db.files.get(first)); db.files.delete(first)
  const again = await handleAccountingTelegramMessage({ message: photoMessage({ date: 1795009999 }), db, telegram, env: {} })
  assert.equal(again.stored, 0)
  assert.equal(again.duplicate, true)
  assert.equal([...db.files.keys()].filter((k) => k.endsWith('.jpg')).length, 1)
  assert.match(telegram.sent[1].text, /เคยรับไว้แล้ว/)
})

test('เทเลแกรม: ข้อความล้วนและผู้ส่งนอกรายชื่อ = ไม่ใช่ธุระของกล่องนี้', async () => {
  const db = fakeDb(); const telegram = fakeTelegram()
  assert.equal(await handleAccountingTelegramMessage({ message: { text: 'hi', chat: { id: 1 } }, db, telegram, env: {} }), null)
  assert.equal(await handleAccountingTelegramMessage({ message: photoMessage(), db, telegram, env: { ACCOUNTING_TELEGRAM_USER_ID: '5' } }), null)
  assert.equal(db.files.size, 0)
})

test('LINE: รับเฉพาะรูปจากผู้ใช้ที่อนุญาต รูปของคนอื่นไม่ถูกดึงและไม่ถูกเก็บ', async () => {
  const db = fakeDb(); const notes = []; const fetched = []
  const line = { content: async (id) => { fetched.push(id); return { bytes: Buffer.from('img'), mime: 'image/jpeg' } } }
  const events = [
    { type: 'message', timestamp: 1795000000000, source: { userId: 'Uowner' }, message: { id: '111', type: 'image' } },
    { type: 'message', timestamp: 1795000001000, source: { userId: 'Ucustomer' }, message: { id: '222', type: 'image' } },
    { type: 'message', timestamp: 1795000002000, source: { userId: 'Uowner' }, message: { id: '333', type: 'text', text: 'สวัสดี' } },
    { type: 'follow', source: { userId: 'Uowner' } },
  ]
  const out = await handleAccountingLineEvents({ events, db, line, notify: async (t) => { notes.push(t) }, env: { ACCOUNTING_LINE_USER_ID: 'Uowner' } })
  assert.deepEqual(out, { stored: 1, duplicates: 0 })
  assert.deepEqual(fetched, ['111'])
  assert.equal([...db.files.keys()].filter((k) => !k.endsWith('.json')).length, 1)
  assert.match(notes[0], /จาก LINE แล้ว 1 ไฟล์/)
})

test('LINE: ยังไม่ตั้งรหัสผู้ใช้ = ไม่เก็บอะไรเลย · พิมพ์ assetx-id แล้วรหัสไปขึ้นที่เทเลแกรม', async () => {
  const db = fakeDb(); const notes = []
  const line = { content: async () => { throw new Error('ไม่ควรถูกเรียก') } }
  const events = [
    { type: 'message', source: { userId: 'Uowner' }, message: { id: '1', type: 'image' } },
    { type: 'message', source: { userId: 'Uowner' }, message: { id: '2', type: 'text', text: ' ASSETX-ID ' } },
  ]
  const out = await handleAccountingLineEvents({ events, db, line, notify: async (t) => { notes.push(t) }, env: {} })
  assert.equal(out.stored, 0)
  assert.equal(db.files.size, 0)
  assert.match(notes[0], /Uowner/)
})

test('ชื่อไฟล์บนเครื่องใช้เวลาไทย', () => {
  assert.equal(localName('20261125T180507Z_line_999.pdf', 2), '2026-11-26_010507_line_03.pdf')
})

test('ดึงลงเครื่อง: เขียนไฟล์ จดคำบรรยาย แล้วย้ายออกจาก new', async () => {
  const db = fakeDb()
  await storeInboxFile(db, { source: 'telegram', uid: 'a1', mime: 'image/jpeg', ext: 'jpg', bytes: Buffer.from('one'), caption: 'สลิป', at: Date.UTC(2026, 10, 25, 2, 0, 0) })
  await storeInboxFile(db, { source: 'line', uid: 'b2', mime: 'application/pdf', ext: 'pdf', bytes: Buffer.from('two'), at: Date.UTC(2026, 10, 25, 3, 0, 0) })
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acc-inbox-'))
  const pulled = await pullInbox(db, { inboxDir: dir })
  assert.equal(pulled.length, 2)
  assert.equal(pulled[0].caption, 'สลิป')
  assert.equal((await fs.readFile(path.join(dir, pulled[0].file))).toString(), 'one')
  assert.equal((await fs.readFile(path.join(dir, 'notes.jsonl'), 'utf8')).trim().split('\n').length, 2)
  assert.equal([...db.files.keys()].filter((k) => k.includes('/new/')).length, 0)
  assert.equal([...db.files.keys()].filter((k) => k.includes('/fetched/')).length, 4)
  assert.deepEqual(await pullInbox(db, { inboxDir: dir }), [])
  await fs.rm(dir, { recursive: true, force: true })
})

test('ข้อความตอบรับไม่มีชื่อไฟล์หรือคำบรรยาย', () => {
  assert.doesNotMatch(ackText({ stored: true }), /\.jpg|สลิป/)
})

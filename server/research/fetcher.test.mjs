import test from 'node:test'
import assert from 'node:assert/strict'
import { createFetcher } from './fetcher.js'

const fakeFetch = (status, body, contentType = 'text/html') => async () => ({
  status,
  ok: status >= 200 && status < 300,
  url: 'https://example.test/feed',
  headers: { get: () => contentType },
  arrayBuffer: async () => new TextEncoder().encode(body).buffer,
})

const make = (status, body) => createFetcher({ fetchImpl: fakeFetch(status, body), sleep: async () => {}, hostDelaySec: { default: 0 } })

test('หน้าปฏิเสธของไฟร์วอลล์ที่มากับ 500 = บล็อก (SAM 14 พ.ย. 2569) → ข้าม ห้ามลองเลี่ยง', async () => {
  const fetcher = make(500, '<html><head><title> The URL you requested has been blocked </title></head><body>Your support ID is: 123</body></html>')
  const res = await fetcher('https://sam.or.th/site/sam/feed/')
  assert.equal(res.ok, false)
  assert.equal(res.blocked, true)
  assert.equal(fetcher.stats.blocked, 1)
  assert.equal(fetcher.stats.httpErrors, 0)
})

test('404/500 ธรรมดาไม่ใช่การบล็อก แต่นับใน httpErrors (เดิมรายงาน error 0 ทั้งที่ 10 เลนล้ม)', async () => {
  const fetcher = make(404, '<!DOCTYPE html><title>Error 404 (Not Found)!!1</title>')
  const res = await fetcher('https://www.youtube.com/feeds/videos.xml?channel_id=UCx')
  assert.equal(res.ok, false)
  assert.equal(res.blocked, false)
  assert.equal(res.error, 'HTTP 404')
  assert.equal(fetcher.stats.httpErrors, 1)
  assert.equal(fetcher.stats.errors, 0)
})

test('403 ยังเป็นการบล็อกเหมือนเดิม', async () => {
  const fetcher = make(403, 'Forbidden')
  const res = await fetcher('https://example.test/x')
  assert.equal(res.blocked, true)
  assert.equal(fetcher.stats.httpErrors, 0)
})

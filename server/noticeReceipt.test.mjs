import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeReceipt } from './noticeReceipt.js'
test('valid PNG receipt accepted', () => {
  const file = decodeReceipt({ name: 'receipt.png', type: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' })
  assert.equal(file.extension, 'png')
})
test('fake and oversized receipts rejected', () => {
  assert.throws(() => decodeReceipt({ name: 'test.jpg', type: 'image/jpeg', base64: Buffer.from('<script>test</script>').toString('base64') }))
  assert.throws(() => decodeReceipt({ name: 'test.pdf', type: 'application/pdf', base64: 'A'.repeat(3000000) }))
})

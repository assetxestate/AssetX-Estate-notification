import assert from 'node:assert/strict'
import handler from './marketing-image.js'
import { createSessionCookie } from '../api/_auth.js'

const previous = { secret: process.env.SESSION_SECRET, key: process.env.OPENAI_API_KEY, fetch: globalThis.fetch }
process.env.SESSION_SECRET = 'artwork-test-session'
process.env.OPENAI_API_KEY = 'artwork-test-key'
let body
let calls = 0
globalThis.fetch = async (url, options) => {
  calls++
  assert.equal(url, 'https://api.openai.com/v1/images/generations')
  body = JSON.parse(options.body)
  return new Response(JSON.stringify({ data: [{ b64_json: 'dGVzdA==' }] }))
}
function response() {
  return { code: 200, setHeader() {}, status(code) { this.code = code; return this }, json(data) { this.data = data; return this } }
}
try {
  const denied = response()
  await handler({ method: 'POST', headers: {}, body: { prompt: 'Landscape' } }, denied)
  assert.equal(denied.code, 401)
  assert.equal(calls, 0)
  const result = response()
  await handler({ method: 'POST', headers: { cookie: createSessionCookie() }, body: {
    prompt: 'Thai property in daylight', mode: 'artwork-background', styleProfile: { allowPosterText: true },
  } }, result)
  assert.equal(result.code, 200)
  assert.equal(result.data.success, true)
  assert.equal(body.size, '1024x1024')
  assert.match(body.prompt, /no readable Thai text/)
  assert.match(body.prompt, /overlays its own Thai typography/)
  assert.doesNotMatch(JSON.stringify(result.data), /artwork-test-key/)
  console.log('PASS: authentication, background-only generation, image size, response without credentials')
} finally {
  globalThis.fetch = previous.fetch
  if (previous.secret === undefined) delete process.env.SESSION_SECRET
  else process.env.SESSION_SECRET = previous.secret
  if (previous.key === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = previous.key
}

import assert from 'node:assert/strict'
import handler from '../api/login.js'
import { verifySession } from '../api/_auth.js'

const keys = ['SESSION_SECRET', 'SESSION_VERSION', 'APP_USERNAME', 'APP_PASSWORD']
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
async function request(method, body, cookie = '') {
  const response = {
    headers: {}, code: 0, body: null,
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this },
  }
  await handler({ method, body, headers: { cookie } }, response)
  return response
}
try {
  process.env.APP_USERNAME = 'test-user'
  process.env.APP_PASSWORD = 'test-password'
  process.env.SESSION_VERSION = 'test-v1'
  delete process.env.SESSION_SECRET
  const missing = await request('POST', { username: 'test-user', password: 'test-password' })
  assert.equal(missing.code, 503)
  assert.equal(missing.headers['Set-Cookie'], undefined)
  process.env.SESSION_SECRET = 'test-secret-not-production'
  assert.equal((await request('GET')).code, 401)
  assert.equal((await request('POST', { username: 'test-user', password: 'wrong' })).code, 401)
  const login = await request('POST', { username: 'test-user', password: 'test-password' })
  assert.equal(login.code, 200)
  const cookie = login.headers['Set-Cookie'].split(';')[0]
  assert.match(login.headers['Set-Cookie'], /HttpOnly/)
  assert.match(login.headers['Set-Cookie'], /SameSite=Strict/)
  assert.equal(verifySession({ headers: { cookie } }), true)
  const session = await request('GET', undefined, cookie)
  assert.deepEqual(session.body, { authenticated: true })
  assert.equal(session.headers['Cache-Control'], 'no-store')
  assert.equal((await request('GET', undefined, cookie + 'tampered')).code, 401)
  process.env.SESSION_VERSION = 'test-v2'
  assert.equal((await request('GET', undefined, cookie)).code, 401)
} finally {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key]
    else process.env[key] = previous[key]
  }
}
console.log('login session tests passed')

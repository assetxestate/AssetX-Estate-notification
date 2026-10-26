import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/line-webhook.js';
import { createSessionCookie } from '../api/_auth.js';

const recipientId = `U${'a'.repeat(32)}`;

function response() {
  return {
    statusCode: 200,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('manual LINE route requires login and reports real API outcomes', async () => {
  const oldSecret = process.env.SESSION_SECRET;
  const oldToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const oldFetch = globalThis.fetch;
  process.env.SESSION_SECRET = 'local-line-test-secret';
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'local-line-test-token';
  try {
    const cookie = createSessionCookie().split(';')[0];
    const request = (body, action = 'send', authenticated = true) => ({
      method: 'POST', query: { action }, headers: { cookie: authenticated ? cookie : '' }, body,
    });
    let calls = 0;
    globalThis.fetch = async () => { calls++; return { ok: true, status: 200, headers: new Headers({ 'x-line-request-id': 'test-request' }) }; };
    const unauthorized = response();
    await handler(request({ recipientId, message: 'test' }, 'send', false), unauthorized);
    assert.equal(unauthorized.statusCode, 401);

    const missing = response();
    await handler(request({ message: 'test' }), missing);
    assert.equal(missing.statusCode, 400);

    const invalid = response();
    await handler(request({ recipientId: 'bad', message: 'test' }), invalid);
    assert.equal(invalid.statusCode, 400);
    assert.equal(calls, 0);

    const accepted = response();
    await handler(request({ recipientId, message: 'test' }), accepted);
    assert.equal(accepted.statusCode, 200);
    assert.equal(accepted.body.accepted, true);
    assert.equal(calls, 1);

    globalThis.fetch = async () => ({ ok: false, status: 401 });
    const rejected = response();
    await handler(request({ recipientId, message: 'test' }), rejected);
    assert.equal(rejected.statusCode, 400);
    assert.match(rejected.body.error, /Channel Access Token/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = oldSecret;
    if (oldToken === undefined) delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    else process.env.LINE_CHANNEL_ACCESS_TOKEN = oldToken;
  }
});

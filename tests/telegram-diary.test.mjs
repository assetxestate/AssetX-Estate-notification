import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/telegram-webhook.js';

function response() {
  return {
    statusCode: 200,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function withTelegram(run) {
  const old = {
    token: process.env.ASSETX_TELEGRAM_BOT_TOKEN,
    allowed: process.env.ASSETX_TELEGRAM_ALLOWED_CHAT_ID,
    url: process.env.ASSETX_DIARY_URL,
    fetch: globalThis.fetch,
  };
  process.env.ASSETX_TELEGRAM_BOT_TOKEN = 'local-telegram-test-token';
  delete process.env.ASSETX_TELEGRAM_ALLOWED_CHAT_ID;
  delete process.env.ASSETX_DIARY_URL;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ method: String(url).split('/').pop(), body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 77 } }) };
  };
  return run(calls).finally(() => {
    if (old.token === undefined) delete process.env.ASSETX_TELEGRAM_BOT_TOKEN; else process.env.ASSETX_TELEGRAM_BOT_TOKEN = old.token;
    if (old.allowed !== undefined) process.env.ASSETX_TELEGRAM_ALLOWED_CHAT_ID = old.allowed;
    if (old.url !== undefined) process.env.ASSETX_DIARY_URL = old.url;
    globalThis.fetch = old.fetch;
  });
}

test('/diary in a private chat sends a link button, pins it and sets the menu button', () => withTelegram(async (calls) => {
  const res = response();
  await handler({
    method: 'POST',
    headers: { host: 'assetx-estate.vercel.app' },
    body: { message: { text: '/diary', chat: { id: 123, type: 'private' } } },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  const send = calls.find((c) => c.method === 'sendMessage');
  assert.equal(send.body.chat_id, '123');
  assert.equal(send.body.reply_markup.inline_keyboard[0][0].url, 'https://assetx-estate.vercel.app/diary');
  assert.ok(calls.some((c) => c.method === 'pinChatMessage' && c.body.message_id === 77));
  const menu = calls.find((c) => c.method === 'setChatMenuButton');
  assert.equal(menu.body.menu_button.type, 'web_app');
  assert.equal(menu.body.menu_button.web_app.url, 'https://assetx-estate.vercel.app/diary');
  assert.ok(calls.some((c) => c.method === 'setMyCommands' && c.body.commands.some((x) => x.command === 'diary')));
}));

test('/diary in a group skips the private-only menu button and honours ASSETX_DIARY_URL', () => withTelegram(async (calls) => {
  process.env.ASSETX_DIARY_URL = 'https://example.test/diary';
  const res = response();
  await handler({
    method: 'POST',
    headers: { host: 'ignored.example' },
    body: { message: { text: '/diary@AssetXBot ขอปุ่ม', chat: { id: -500, type: 'supergroup' } } },
  }, res);
  assert.equal(res.body.ok, true);
  const send = calls.find((c) => c.method === 'sendMessage');
  assert.equal(send.body.reply_markup.inline_keyboard[0][0].url, 'https://example.test/diary');
  assert.ok(!calls.some((c) => c.method === 'setChatMenuButton'));
  assert.ok(calls.some((c) => c.method === 'pinChatMessage'));
}));

test('/diary from a chat outside the allow-list is ignored without calling Telegram', () => withTelegram(async (calls) => {
  process.env.ASSETX_TELEGRAM_ALLOWED_CHAT_ID = '999';
  const res = response();
  await handler({ method: 'POST', headers: {}, body: { message: { text: '/diary', chat: { id: 123, type: 'private' } } } }, res);
  assert.equal(res.body.skipped, 'chat_not_allowed');
  assert.equal(calls.length, 0);
}));

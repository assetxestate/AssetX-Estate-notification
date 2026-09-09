import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { buildAssetxTelegramReply } from '../api/_assetxTelegramAssistant.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const localDir = path.join(rootDir, '.local');
const stateFile = path.join(localDir, 'assetx_telegram_state.json');
const lockFile = path.join(localDir, 'assetx_telegram_poll.lock');
const telegramApi = 'https://api.telegram.org';
const staleLockMs = 10 * 60 * 1000;

config({ path: path.join(rootDir, '.env.local'), quiet: true });
config({ path: path.join(rootDir, '.env'), quiet: true });

const token = process.env.ASSETX_TELEGRAM_BOT_TOKEN;
const allowedChatId = String(process.env.ASSETX_TELEGRAM_ALLOWED_CHAT_ID || '').trim();

if (!token) {
  console.error('Missing ASSETX_TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

async function requestTelegram(method, payload) {
  const response = await fetch(`${telegramApi}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || `${method} failed`);
  }
  return data.result;
}

async function loadState() {
  try {
    return JSON.parse(await fs.readFile(stateFile, 'utf8'));
  } catch {
    return { lastUpdateId: 0 };
  }
}

async function saveState(state) {
  await fs.mkdir(localDir, { recursive: true });
  await fs.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function acquireLock() {
  await fs.mkdir(localDir, { recursive: true });
  try {
    const handle = await fs.open(lockFile, 'wx');
    await handle.writeFile(JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
    }));
    return handle;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;

    try {
      const stat = await fs.stat(lockFile);
      if (Date.now() - stat.mtimeMs > staleLockMs) {
        await fs.rm(lockFile, { force: true });
        return acquireLock();
      }
    } catch {
      await fs.rm(lockFile, { force: true }).catch(() => {});
      return acquireLock();
    }

    console.log('AssetX Telegram poll skipped: previous run still active');
    return null;
  }
}

async function releaseLock(handle) {
  if (!handle) return;
  await handle.close().catch(() => {});
  await fs.rm(lockFile, { force: true }).catch(() => {});
}

function getMessage(update) {
  return (
    update.message ||
    update.edited_message ||
    update.channel_post ||
    update.edited_channel_post ||
    null
  );
}

function getChatId(message) {
  return message?.chat?.id == null ? '' : String(message.chat.id);
}

function isAllowed(chatId) {
  return !allowedChatId || chatId === allowedChatId;
}

async function main() {
  const lock = await acquireLock();
  if (!lock) return;

  try {
  const state = await loadState();
  const offset = Number(state.lastUpdateId || 0) + 1;
  const updates = await requestTelegram('getUpdates', {
    offset,
    limit: 100,
    timeout: 0,
    allowed_updates: ['message', 'edited_message', 'channel_post', 'edited_channel_post'],
  });

  let maxUpdateId = Number(state.lastUpdateId || 0);
  let replied = 0;

  for (const update of updates) {
    maxUpdateId = Math.max(maxUpdateId, Number(update.update_id || 0));
    const message = getMessage(update);
    if (!message) continue;

    const chatId = getChatId(message);
    if (!chatId || !isAllowed(chatId)) continue;

    await requestTelegram('sendMessage', {
      chat_id: chatId,
      text: await buildAssetxTelegramReply(message),
      disable_web_page_preview: true,
      reply_markup: { remove_keyboard: true },
    });
    replied += 1;
  }

  state.lastUpdateId = maxUpdateId;
  state.lastRunAt = new Date().toISOString();
  await saveState(state);
  console.log(`AssetX Telegram poll complete: replied=${replied}`);
  } finally {
    await releaseLock(lock);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

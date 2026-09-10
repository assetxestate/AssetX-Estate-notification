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
const watchMode = process.argv.includes('--watch');

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

function isProcessAlive(pid) {
  const processId = Number(pid);
  if (!processId) return false;

  try {
    process.kill(processId, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      const lock = JSON.parse(await fs.readFile(lockFile, 'utf8'));
      if (isProcessAlive(lock.pid)) {
        console.log('AssetX Telegram poll skipped: previous run still active');
        return null;
      }

      await fs.rm(lockFile, { force: true });
      return acquireLock();
    } catch {
      // Fall through to the mtime check for old or malformed lock files.
    }

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

    console.log('AssetX Telegram poll skipped: lock file is still fresh');
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

async function withTyping(chatId, callback) {
  await requestTelegram('sendChatAction', {
    chat_id: chatId,
    action: 'typing',
  }).catch(() => {});

  const timer = setInterval(() => {
    requestTelegram('sendChatAction', {
      chat_id: chatId,
      action: 'typing',
    }).catch(() => {});
  }, 4000);

  try {
    return await callback();
  } finally {
    clearInterval(timer);
  }
}

async function runOnce() {
  const state = await loadState();
  const offset = Number(state.lastUpdateId || 0) + 1;
  const updates = await requestTelegram('getUpdates', {
    offset,
    limit: 100,
    timeout: watchMode ? 50 : 0,
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

    const replyText = await withTyping(chatId, () => buildAssetxTelegramReply(message));

    await requestTelegram('sendMessage', {
      chat_id: chatId,
      text: replyText,
      disable_web_page_preview: true,
      reply_markup: { remove_keyboard: true },
    });
    replied += 1;
  }

  state.lastUpdateId = maxUpdateId;
  state.lastRunAt = new Date().toISOString();
  await saveState(state);
  console.log(`AssetX Telegram poll complete: replied=${replied}`);
}

async function main() {
  const lock = await acquireLock();
  if (!lock) return;

  try {
    if (!watchMode) {
      await runOnce();
      return;
    }

    console.log('AssetX Telegram watcher started');
    while (true) {
      try {
        await runOnce();
      } catch (error) {
        console.error(`AssetX Telegram watcher error: ${error.message}`);
        await sleep(5000);
      }
    }
  } finally {
    await releaseLock(lock);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

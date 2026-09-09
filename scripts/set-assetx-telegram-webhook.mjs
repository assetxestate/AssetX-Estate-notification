import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const token = process.env.ASSETX_TELEGRAM_BOT_TOKEN;
const baseUrl = process.argv[2];

if (!token) {
  console.error('Missing ASSETX_TELEGRAM_BOT_TOKEN in .env or .env.local');
  process.exit(1);
}

if (!baseUrl) {
  console.error('Usage: node scripts/set-assetx-telegram-webhook.mjs https://your-domain.example');
  process.exit(1);
}

const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/telegram-webhook`;

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: webhookUrl,
    allowed_updates: ['message', 'edited_message', 'channel_post', 'edited_channel_post'],
  }),
});

const data = await response.json();
if (!data.ok) {
  console.error(data.description || 'setWebhook failed');
  process.exit(1);
}

console.log(`Webhook set: ${webhookUrl}`);

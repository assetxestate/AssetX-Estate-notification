# Telegram Bot Roles

AssetX uses two Telegram bots with separate responsibilities and separate data destinations.

## @JK_AssetX_bot

Purpose: secretary, accounting, and document intake.

This bot is handled by the local Hermes inbox scripts under:

```text
J:\ส่วนตัว\เลขาส่วนตัว\ระบบ
```

It accepts PDF/image slips and routes them into the accounting inbox and monthly document folders.

## @AssetX_Estate_bot

Purpose: AssetX Estate web operations.

This bot is reserved for the AssetX Estate web system, such as customer, property, valuation, reminder, or back-office workflows. It must not be used by the accounting inbox script, otherwise web messages and files may be stored in the wrong document folder.

Server-only environment variables for the web app:

```text
ASSETX_TELEGRAM_BOT_TOKEN=
ASSETX_TELEGRAM_ALLOWED_CHAT_ID=
```

Keep these values out of client-side `VITE_` variables.

Webhook endpoint:

```text
/api/telegram-webhook
```

Set the Telegram webhook after deployment:

```bash
node scripts/set-assetx-telegram-webhook.mjs https://your-assetx-domain.example
```

The bot replies to `/start`, `/help`, `/id`, `/chatid`, and ordinary text without showing a reply keyboard.

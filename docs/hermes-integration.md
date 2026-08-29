# Hermes Agent Integration

AssetX can route its existing chat endpoints through Hermes without changing the React UI.

## How It Works

- `/api/chat` is the private portfolio assistant. It requires the normal AssetX login session and may send `customerData` to Hermes.
- `/api/assess-chat` is the public assessment assistant. It does not send internal customer data to Hermes.
- If `HERMES_AGENT_URL` is set, both endpoints call Hermes first.
- If `HERMES_AGENT_URL` is empty, the endpoints keep using Gemini through `GEMINI_API_KEY`.

## Environment Variables

```text
HERMES_AGENT_URL=https://your-hermes-agent.example.com/v1/chat/completions
HERMES_AGENT_API_KEY=optional_bearer_token
HERMES_AGENT_MODEL=hermes
HERMES_AGENT_FORMAT=openai
HERMES_AGENT_TIMEOUT_MS=60000
```

Use `HERMES_AGENT_FORMAT=openai` when Hermes accepts an OpenAI-compatible chat-completions payload:

```json
{
  "model": "hermes",
  "stream": true,
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ]
}
```

Use `HERMES_AGENT_FORMAT=generic` when Hermes expects the AssetX generic payload:

```json
{
  "source": "assetx-estate",
  "mode": "private-portfolio",
  "stream": true,
  "system": "...",
  "messages": [],
  "context": {},
  "input": "..."
}
```

## Security Notes

- Put Hermes credentials only in server-side environment variables, not `VITE_` variables.
- Do not point public `/api/assess-chat` at an agent that can access private customer records.
- For production, configure `HERMES_AGENT_API_KEY` or an equivalent upstream allowlist.

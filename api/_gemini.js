import { GoogleGenerativeAI } from '@google/generative-ai'

const DEFAULT_CHAT_MODELS = 'gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-pro-preview'
const DEFAULT_UNDERWRITE_MODELS = 'gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-pro-preview'

function getConfiguredModels(primaryEnvName, fallback) {
  const configured = process.env[primaryEnvName] || process.env.GEMINI_MODEL || ''
  return [...new Set(`${configured},${fallback}`
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean))]
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('กรุณาตั้งค่า GEMINI_API_KEY ใน Environment Variables')
  }
  return new GoogleGenerativeAI(apiKey)
}

export function setSseHeaders(res) {
  if (res.headersSent) return
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
}

export async function streamGeminiChat({
  res,
  messages,
  systemPrompt,
  modelsEnv = 'GEMINI_CHAT_MODELS',
  fallbackModels = DEFAULT_CHAT_MODELS,
  completionNote = '',
}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('ข้อความไม่ถูกต้อง')
  }

  const genAI = getGeminiClient()
  const modelNames = getConfiguredModels(modelsEnv, fallbackModels)
  const userMessage = String(messages[messages.length - 1]?.content || '')
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '') }],
  }))
  const errors = []

  setSseHeaders(res)

  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      })
      const chat = model.startChat({ history })
      const result = await chat.sendMessageStream(userMessage)

      for await (const chunk of result.stream) {
        const text = chunk.text()
        if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`)
      }

      if (completionNote) {
        res.write(`data: ${JSON.stringify({ text: completionNote })}\n\n`)
      }
      res.write('data: [DONE]\n\n')
      return
    } catch (err) {
      errors.push(`${modelName}: ${err.message}`)
    }
  }

  throw new Error(`Gemini failed for all configured models: ${errors.join(' | ')}`)
}

export async function streamGeminiText({
  res,
  prompt,
  systemPrompt,
  modelsEnv = 'GEMINI_UNDERWRITE_MODELS',
  fallbackModels = DEFAULT_UNDERWRITE_MODELS,
  completionNote = '',
}) {
  const genAI = getGeminiClient()
  const modelNames = getConfiguredModels(modelsEnv, fallbackModels)
  const errors = []

  setSseHeaders(res)

  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      })
      const result = await model.generateContent(String(prompt || ''))
      const text = result.response.text()
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`)
      if (completionNote) {
        res.write(`data: ${JSON.stringify({ text: completionNote })}\n\n`)
      }
      res.write('data: [DONE]\n\n')
      return
    } catch (err) {
      errors.push(`${modelName}: ${err.message}`)
    }
  }

  throw new Error(`Gemini failed for all configured models: ${errors.join(' | ')}`)
}

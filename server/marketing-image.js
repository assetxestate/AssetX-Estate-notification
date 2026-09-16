import { verifySession } from '../api/_auth.js'

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations'
const ASSETX_PALETTE = 'AssetX logo-inspired palette: midnight navy #08213f, deep indigo/violet #4b2a82, cyan/teal #42c7d8, soft sky blue #70d7e8, coral-pink-to-warm-orange #f26b4f, and clean white. Use cyan/teal and navy as the primary poster colors, violet as the depth/shadow color, and coral-pink/orange only as a small warm accent. CTA bands and badges should be navy, teal, white, or cyan-glow style. Avoid metallic gold CTA bars, dominant red map pins, green loan-ad themes, and generic high-saturation finance-ad colors.'

function cleanPrompt(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

function buildStyleGuidance(styleProfile = {}) {
  const name = cleanPrompt(styleProfile.name || 'AssetX Premium Realistic')
  const prompt = cleanPrompt(styleProfile.prompt || '')
  const scenes = cleanPrompt(styleProfile.scenes || '')
  const layoutRules = cleanPrompt(styleProfile.layoutRules || '')
  const allowPosterText = styleProfile.allowPosterText === true
  return [
    `Selected visual system: ${name}.`,
    prompt,
    scenes ? `Preferred scene vocabulary: ${scenes}.` : '',
    layoutRules ? `Layout rules: ${layoutRules}.` : '',
    'Output must look like a new original premium brand asset, not a copy of an existing ad or reference image.',
    allowPosterText
      ? 'If this is a poster/key-visual request, create a complete ready-to-post social-ad composition with the provided Thai headline, benefit badges, CTA, layered visual zones, realistic cutout-like property elements, and reusable design structure. Do not return only a plain background photo.'
      : 'Create a complete premium commercial image for the selected visual style. If the prompt asks for a poster, include meaningful real-estate visual elements and composition depth, but do not add placeholder headline bars or empty CTA boxes.',
    'Photorealistic, premium commercial lighting, clean composition, trustworthy Thai real-estate advisory mood.',
    ASSETX_PALETTE,
    allowPosterText
      ? 'Text policy: readable Thai text is allowed and expected, but use only the exact poster copy provided by the user prompt. Do not invent random phone numbers, deed numbers, addresses, customer names, unrelated logos, unrelated watermarks, or unrealistic financial promises. AssetX Estate brand text/logo mark is allowed.'
      : 'Strict exclusions: no readable Thai text inside the image, no letters, no numbers, no fake UI text, no personal data, no deed numbers, no customer names, no exact addresses, no identifiable real customer faces, no unrealistic financial promise, no logos, no watermarks.',
  ].filter(Boolean).join('\n')
}

function buildFinalPrompt(prompt, styleGuidance) {
  return `${prompt}\n\n${styleGuidance}`
}

function normalizeOpenAIImageModel(value = '') {
  const model = cleanPrompt(value)
  if (!model || model === 'gpt-image-2.5') return 'gpt-image-2.5-flare'
  return model
}

function toFriendlyOpenAIError(message = '', status = 500) {
  const text = String(message || '')
  const quota = /quota|rate limit|billing|insufficient_quota|429/i.test(text) || status === 429
  const auth = /api key|authentication|unauthorized|401/i.test(text) || status === 401
  if (quota) {
    return {
      status: 429,
      code: 'OPENAI_IMAGE_QUOTA_EXCEEDED',
      error: 'โควต้า OpenAI สำหรับสร้างรูปยังไม่พร้อมใช้งาน กรุณาตรวจ billing/rate limit หรือเปลี่ยนโมเดลใน Environment Variables',
    }
  }
  if (auth) {
    return {
      status: 401,
      code: 'OPENAI_IMAGE_AUTH_FAILED',
      error: 'OpenAI API key ไม่พร้อมใช้งาน กรุณาตรวจค่า OPENAI_API_KEY บน server',
    }
  }
  return { status: status >= 400 && status < 600 ? status : 500, code: 'OPENAI_IMAGE_FAILED', error: text || 'สร้างรูปไม่สำเร็จ' }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  if (!verifySession(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })

  let finalPrompt = ''
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า OPENAI_API_KEY บน server')

    const prompt = cleanPrompt(req.body?.prompt)
    if (!prompt) throw new Error('กรุณาส่งบรีฟภาพก่อนสร้างรูป')

    const model = normalizeOpenAIImageModel(process.env.OPENAI_IMAGE_MODEL)
    const styleGuidance = buildStyleGuidance(req.body?.styleProfile || {})
    finalPrompt = buildFinalPrompt(prompt, styleGuidance)
    const size = process.env.OPENAI_IMAGE_SIZE || 'auto'
    const quality = process.env.OPENAI_IMAGE_QUALITY || 'high'
    const outputFormat = process.env.OPENAI_IMAGE_OUTPUT_FORMAT || 'jpeg'

    const response = await fetch(OPENAI_IMAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: finalPrompt,
        n: 1,
        size,
        quality,
        output_format: outputFormat,
        ...(outputFormat === 'jpeg' || outputFormat === 'webp' ? { output_compression: 90 } : {}),
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = data?.error?.message || data?.error || data?.message || `OpenAI image API ${response.status}`
      const friendly = toFriendlyOpenAIError(message, response.status)
      return res.status(friendly.status).json({
        success: false,
        code: friendly.code,
        error: friendly.error,
        fallbackPrompt: finalPrompt,
      })
    }

    const image = data?.data?.[0]
    const base64 = image?.b64_json
    if (!base64) throw new Error('OpenAI ไม่ได้ส่งรูปกลับมา')

    const mimeType = outputFormat === 'png'
      ? 'image/png'
      : outputFormat === 'webp'
        ? 'image/webp'
        : 'image/jpeg'

    return res.status(200).json({
      success: true,
      model,
      mimeType,
      dataUrl: `data:${mimeType};base64,${base64}`,
    })
  } catch (err) {
    const friendly = toFriendlyOpenAIError(err.message)
    return res.status(friendly.status).json({
      success: false,
      code: friendly.code,
      error: friendly.error,
      fallbackPrompt: finalPrompt || (req.body?.prompt ? buildFinalPrompt(cleanPrompt(req.body.prompt), buildStyleGuidance(req.body?.styleProfile || {})) : ''),
    })
  }
}

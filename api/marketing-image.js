import { verifySession } from './_auth.js'

const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
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

function toFriendlyGeminiError(message = '') {
  const text = String(message || '')
  const quota = /quota|rate limit|RESOURCE_EXHAUSTED|free_tier|limit:/i.test(text)
  const retry = text.match(/retry in\s+([0-9.]+)s/i)?.[1]
  if (quota) {
    return {
      status: 429,
      code: 'GEMINI_QUOTA_EXCEEDED',
      error: retry
        ? `โควต้า Gemini สำหรับสร้างรูปเต็มชั่วคราว ลองใหม่อีกประมาณ ${Math.ceil(Number(retry))} วินาที หรือเปิด billing/เปลี่ยนโมเดลใน Environment Variables`
        : 'โควต้า Gemini สำหรับสร้างรูปไม่พร้อมใช้งาน กรุณาตรวจ billing/rate limit หรือเปลี่ยนโมเดลใน Environment Variables',
    }
  }
  return { status: 500, code: 'GEMINI_IMAGE_FAILED', error: text || 'สร้างรูปไม่สำเร็จ' }
}

function findGeneratedMedia(node, targetType) {
  if (!node || typeof node !== 'object') return null
  if (node.type === targetType && node.data) {
    return {
      data: node.data,
      mimeType: node.mime_type || node.mimeType || (targetType === 'image' ? 'image/jpeg' : 'video/mp4'),
    }
  }
  const convenience = targetType === 'image' ? node.output_image || node.outputImage : node.output_video || node.outputVideo
  if (convenience?.data) {
    return {
      data: convenience.data,
      mimeType: convenience.mime_type || convenience.mimeType || (targetType === 'image' ? 'image/jpeg' : 'video/mp4'),
    }
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findGeneratedMedia(item, targetType)
        if (found) return found
      }
    } else if (value && typeof value === 'object') {
      const found = findGeneratedMedia(value, targetType)
      if (found) return found
    }
  }
  return null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  if (!verifySession(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า GEMINI_API_KEY บน server')

    const prompt = cleanPrompt(req.body?.prompt)
    if (!prompt) throw new Error('กรุณาส่งบรีฟภาพก่อนสร้างรูป')

    const aspectRatio = req.body?.aspectRatio || '1:1'
    const imageSize = req.body?.imageSize || '1K'
    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-lite-image'
    const styleGuidance = buildStyleGuidance(req.body?.styleProfile || {})
    const finalPrompt = buildFinalPrompt(prompt, styleGuidance)

    const response = await fetch(`${GEMINI_INTERACTIONS_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: [
          {
            type: 'text',
            text: finalPrompt,
          },
        ],
        response_format: {
          type: 'image',
          mime_type: 'image/jpeg',
          aspect_ratio: aspectRatio,
          image_size: imageSize,
        },
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.error || data?.message || `Gemini image API ${response.status}`)
    }

    const media = findGeneratedMedia(data, 'image')
    if (!media?.data) throw new Error('Gemini ไม่ได้ส่งรูปกลับมา')

    return res.status(200).json({
      success: true,
      model,
      mimeType: media.mimeType,
      dataUrl: `data:${media.mimeType};base64,${media.data}`,
    })
  } catch (err) {
    const friendly = toFriendlyGeminiError(err.message)
    return res.status(friendly.status).json({
      success: false,
      code: friendly.code,
      error: friendly.error,
      fallbackPrompt: req.body?.prompt ? buildFinalPrompt(cleanPrompt(req.body.prompt), buildStyleGuidance(req.body?.styleProfile || {})) : '',
    })
  }
}

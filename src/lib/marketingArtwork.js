export const ARTWORK_FORMATS = {
  portrait: { label: 'ฟีด 4:5', width: 1080, height: 1350 },
  square: { label: 'จัตุรัส 1:1', width: 1080, height: 1080 },
}

export const ARTWORK_THEMES = {
  ocean: { label: 'น้ำเงิน / เขียว', ink: '#153552', accent: '#087d79', paper: '#ffffff' },
  coral: { label: 'ปะการัง / ดำ', ink: '#24282c', accent: '#c34e42', paper: '#ffffff' },
  forest: { label: 'เขียว / เทา', ink: '#23463e', accent: '#537556', paper: '#ffffff' },
}

export function defaultArtwork(brief) {
  return {
    headline: brief.headline || brief.title || '',
    subtitle: '',
    cta: 'สอบถามทางแชต',
    prompt: brief.imagePrompt || brief.title || brief.headline || '',
    format: 'portrait', theme: 'ocean', layout: 'editorial', style: 'photo',
    cropX: 50, cropY: 50, zoom: 1, sourceKind: 'ai',
  }
}

export function readArtworkImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('โหลดภาพไม่สำเร็จ กรุณาเลือกภาพใหม่'))
    image.src = url
  })
}

// Word boundaries keep Thai words together; graphemes handle unusually long words.
export function wrapArtworkText(ctx, text, width) {
  const words = new Intl.Segmenter('th', { granularity: 'word' })
  const graphemes = new Intl.Segmenter('th', { granularity: 'grapheme' })
  const lines = []
  for (const paragraph of String(text).split('\n')) {
    let line = ''
    for (const { segment } of words.segment(paragraph)) {
      const parts = ctx.measureText(segment).width > width
        ? [...graphemes.segment(segment)].map((part) => part.segment) : [segment]
      for (const part of parts) {
        if (line && ctx.measureText(line + part).width > width) {
          lines.push(line.trimEnd())
          line = part.trimStart()
        } else line += part
      }
    }
    lines.push(line.trimEnd())
  }
  return lines
}

function drawText(ctx, text, { x, y, width, height, size, min = 24, color, bold = false }) {
  if (!text.trim()) return
  let lines
  for (; size >= min; size -= 2) {
    ctx.font = `${bold ? 700 : 400} ${size}px Tahoma, sans-serif`
    lines = wrapArtworkText(ctx, text, width)
    if (lines.length * size * 1.5 <= height) break
  }
  if (size < min) throw new Error('ข้อความยาวเกินพื้นที่ภาพ กรุณาย่อหัวข้อหรือรายละเอียด')
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * size * 1.5))
}

export async function renderArtwork(sourceUrl, design) {
  if (design.layout === 'original') {
    const source = await readArtworkImage(sourceUrl)
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(source, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    return { dataUrl, mimeType: 'image/jpeg', width: canvas.width, height: canvas.height, size: Math.ceil(dataUrl.length * 0.75) }
  }
  const format = ARTWORK_FORMATS[design.format] || ARTWORK_FORMATS.portrait
  const theme = ARTWORK_THEMES[design.theme] || ARTWORK_THEMES.ocean
  const [source, logo] = await Promise.all([readArtworkImage(sourceUrl), readArtworkImage('/logo.jpg')])
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = format.width
  canvas.height = format.height
  const ctx = canvas.getContext('2d')
  const { width: w, height: h } = format
  ctx.fillStyle = theme.paper
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = theme.accent
  ctx.fillRect(0, 0, w, 12)
  const logoScale = Math.min(84 / logo.width, 84 / logo.height)
  ctx.drawImage(logo, 64, 40, logo.width * logoScale, logo.height * logoScale)
  drawText(ctx, 'AssetX Estate', { x: 170, y: 61, width: 730, height: 60, size: 34, color: theme.ink, bold: true })

  const photoFirst = design.layout === 'photo'
  const photoY = photoFirst ? 152 : 410
  const photoH = h - 584
  const scale = Math.max(w / source.width, photoH / source.height) * Number(design.zoom || 1)
  const cropW = w / scale
  const cropH = photoH / scale
  const cropX = (source.width - cropW) * Number(design.cropX) / 100
  const cropY = (source.height - cropH) * Number(design.cropY) / 100
  ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, photoY, w, photoH)
  const titleY = photoFirst ? photoY + photoH + 28 : 155
  drawText(ctx, design.headline, { x: 64, y: titleY, width: w - 128, height: 240, size: 68, min: 30, color: theme.ink, bold: true })
  drawText(ctx, design.subtitle, { x: 64, y: h - 160, width: w - 128, height: 65, size: 30, min: 22, color: theme.ink })
  ctx.fillStyle = theme.accent
  ctx.fillRect(0, h - 82, w, 82)
  drawText(ctx, design.cta, { x: 64, y: h - 63, width: 700, height: 54, size: 30, min: 22, color: '#ffffff', bold: true })
  if (design.sourceKind === 'ai') {
    drawText(ctx, 'ภาพประกอบ AI', { x: 814, y: h - 58, width: 216, height: 45, size: 23, min: 19, color: '#ffffff' })
  }
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
  return { dataUrl, mimeType: 'image/jpeg', width: w, height: h, size: Math.ceil(dataUrl.length * 0.75) }
}

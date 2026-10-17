const commonRules = 'Create an original illustration for general education about Thai property and sale with right of redemption. Do not depict a specific real client, property, land deed, official document, transaction, or guaranteed financial outcome. No text, letters, numbers, logos, or watermarks; the AssetX editor adds verified Thai copy separately.'

export const assetxImageStyles = [
  {
    id: 'swiss-design', name: 'Swiss Design', description: 'กริดชัดเจน สีตัดกัน ตัวภาพเรียบเป็นระบบ',
    prompt: 'Swiss International Style illustration: disciplined grid, strong geometric hierarchy, generous white space, precise alignment, restrained navy, teal, white and a small coral accent. Use abstract property shapes and a clear focal point.',
  },
  {
    id: 'clay-style', name: 'Clay Style', description: 'งานปั้นสามมิติเนื้อนุ่ม เป็นมิตร',
    prompt: 'Handcrafted clay-style 3D illustration: tactile matte material, softly sculpted Thai home and land concepts, gentle daylight, simple forms, subtle physical shadows. Clearly illustrated, not a real property photograph.',
  },
  {
    id: 'cyberpunk', name: 'Cyberpunk', description: 'เมืองอนาคต แสงนีออน คอนทราสต์สูง',
    prompt: 'Original cyberpunk illustration of a conceptual Thai city and property data: neon teal and magenta highlights, dark urban setting, cinematic contrast, clean readable shapes. Avoid dystopian distress, fake interfaces and readable numbers.',
  },
  {
    id: 'collage-art', name: 'Collage Art', description: 'ตัดปะภาพและพื้นผิวหลายชั้น',
    prompt: 'Editorial mixed-media collage: original paper cutouts, property silhouettes, map-like abstract shapes and tactile paper texture. Layered but organized, contemporary Thai context, no actual deed or private document.',
  },
  {
    id: 'minimalism', name: 'Minimalism', description: 'องค์ประกอบน้อย จุดเด่นชัด',
    prompt: 'Minimalist illustration: one strong property-related visual metaphor, generous negative space, balanced geometry, restrained AssetX teal, navy and white. Avoid decorative clutter and generic loan-ad symbols.',
  },
  {
    id: 'pop-art', name: 'Pop Art', description: 'สีจัด รูปทรงสนุก จังหวะภาพเด่น',
    prompt: 'Original pop-art illustration: bold flat color blocking, halftone accents, energetic property-related shapes, strong visual rhythm and crisp outlines. Do not imitate a known artist or existing advertisement.',
  },
  {
    id: 'editorial', name: 'Editorial', description: 'ภาพประกอบเชิงนิตยสารสำหรับเรื่องความรู้',
    prompt: 'Sophisticated editorial illustration for a Thai property education article: thoughtful visual metaphor, layered composition, calm confident palette, subtle texture, ample space for separate headline placement.',
  },
  {
    id: 'handwritten', name: 'Handwritten', description: 'ลายเส้นวาดมือแบบสมุดจด',
    prompt: 'Hand-drawn notebook illustration: expressive pen and marker strokes, simple property diagrams, lightly textured off-white paper, warm human feel. No legible handwritten words, numbers or document facsimiles.',
  },
  {
    id: 'aurora', name: 'Aurora', description: 'แสงสีไหลนุ่มนวล แต่ยังเห็นหัวข้อชัด',
    prompt: 'Aurora-inspired abstract illustration: flowing luminous teal, cyan and violet light ribbons that frame a clear property silhouette. Refined and restrained, not a generic blurred gradient or empty glowing background.',
  },
  {
    id: 'vector-art', name: 'Vector Art', description: 'ภาพเวกเตอร์ขอบคม สีเรียบ เข้าใจเร็ว',
    prompt: 'Clean vector-style illustration: crisp scalable shapes, limited palette, precise outlines, simple Thai house, land and document concepts, strong hierarchy and no tiny decorative details.',
  },
].map((style) => ({ ...style, artistic: true, badge: 'ภาพวาด AI', imageAspectRatio: '4:5', allowPosterText: false, photorealistic: false, layoutRules: commonRules }))

export function getAssetxImageStyle(id) {
  return assetxImageStyles.find((style) => style.id === id)
}

export function buildAssetxStylePrompt(styleId, brief) {
  const style = getAssetxImageStyle(styleId)
  if (!style) throw new Error('Unknown image style')
  if (typeof brief !== 'string' || !brief.trim() || brief.length > 2000) throw new Error('Provide a short image brief')
  return [
    `Create one original 4:5 image in ${style.name} style for AssetX Estate.`,
    `Content brief: ${brief.trim()}`,
    style.prompt,
    style.layoutRules,
    'Prioritize the selected illustration style over generic photorealism wording in the content brief. Leave clean space for Thai text to be added later.',
  ].join('\n')
}

export function buildGalleryFireflyPrompt(style, brief) {
  const title = typeof brief === 'object' && brief !== null ? String(brief.title || '').trim() : ''
  const scene = typeof brief === 'object' && brief !== null ? String(brief.imagePrompt || brief.title || '').trim() : String(brief || '').trim()
  if (!style || !scene) return ''
  const contentBrief = scene.slice(0, 1800)
  const topic = title ? `Content topic (for visual relevance, do not render as text): ${title.slice(0, 180)}.` : ''
  const composition = 'Make the subject and its real-estate context immediately recognizable. Keep the primary objects large and in focus, with calm negative space limited to the upper 20-25% for a separate headline. Avoid a large empty ceiling or foreground table.'
  const blankSurfaces = 'Any calendar, contract, map, screen or document must have blank, unprinted surfaces: no month names, dates, labels, letter-like marks or official-looking forms.'
  if (style.artistic) return [topic, buildAssetxStylePrompt(style.id, contentBrief), composition, blankSurfaces].filter(Boolean).join('\n')
  const visualDirection = style.allowPosterText
    ? 'Photorealistic Thai real-estate editorial photograph with a clean social-poster composition and natural light. Add the verified headline and contact details separately after image generation.'
    : `${style.prompt || ''}${style.scenes ? ` Scene ideas: ${style.scenes}` : ''}`
  return [
    'Create one original 4:5 image for AssetX Estate.',
    topic,
    `Visual brief: ${contentBrief}`,
    `Visual style: ${style.name}. ${visualDirection}`,
    composition,
    blankSurfaces,
    'Image only: no text, letters, numbers, logos, watermarks or invented land-deed details. Leave clear space for verified Thai text to be added later.',
    'This is a conceptual marketing image, not a photograph of a specific real client property or transaction.',
  ].filter(Boolean).join('\n')
}

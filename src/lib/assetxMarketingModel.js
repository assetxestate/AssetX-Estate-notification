import {
  canPublish,
  getOptions,
  runMarketingModel,
} from './marketing-model/index.js'
import { checkText, formatWarnings } from './marketing-model/rules.js'
import { checkTopicContent, resolveTopic } from './marketing-model/topics.js'

export const assetxContentTypes = [
  { value: 'educate', label: 'ให้ความรู้' },
  { value: 'case-study', label: 'เคสตัวอย่าง' },
  { value: 'property-highlight', label: 'เปิดตัวทรัพย์' },
  { value: 'behind-the-scenes', label: 'เบื้องหลังลงพื้นที่' },
  { value: 'faq', label: 'ถามตอบ' },
]

export const assetxObjectives = [
  { value: 'lead_owner', label: 'เจ้าของทรัพย์ต้องการสภาพคล่อง' },
  { value: 'lead_seller', label: 'เจ้าของต้องการขายทรัพย์' },
  { value: 'lead_investor', label: 'นักลงทุนต้องการทรัพย์ราคาดี' },
  { value: 'education', label: 'ให้ความรู้เรื่องขายฝาก/จำนอง' },
  { value: 'awareness', label: 'สร้างการรับรู้แบรนด์' },
]

export const assetxChannels = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok / Reels' },
  { value: 'line-oa', label: 'LINE OA' },
  { value: 'youtube-shorts', label: 'YouTube Shorts' },
  { value: 'instagram', label: 'Instagram' },
]

export const assetxTones = [
  { value: 'trustworthy', label: 'น่าเชื่อถือ' },
  { value: 'professional', label: 'มืออาชีพ' },
  { value: 'simple', label: 'เข้าใจง่าย' },
  { value: 'urgent', label: 'เร่งด่วนแบบสุภาพ' },
]

export const assetxAssetTypes = [
  { value: 'land', label: 'ที่ดินเปล่า' },
  { value: 'house', label: 'บ้านพร้อมที่ดิน' },
  { value: 'commercial', label: 'อาคารพาณิชย์' },
  { value: 'factory', label: 'โรงงาน/โกดัง' },
  { value: 'condo', label: 'คอนโด' },
  { value: 'other', label: 'ทรัพย์อื่น ๆ' },
]

export function getAssetxMarketingOptions() {
  const base = getOptions()
  return {
    ...base,
    objectives: assetxObjectives,
    contentTypes: assetxContentTypes,
    channels: assetxChannels,
    tones: assetxTones,
    assetTypes: assetxAssetTypes,
  }
}

function labelFor(options, value, fallback) {
  return options.find((option) => option.value === value || option.id === value)?.label || fallback || value
}

export function buildAssetxMarketingInput(studio = {}) {
  const assetTypeLabel = labelFor(assetxAssetTypes, studio.assetType, 'ที่ดินเปล่า')
  return {
    topic: String(studio.prompt || studio.topic || '').trim(),
    objective: studio.objective || 'lead_owner',
    audience: studio.audience || 'เจ้าของทรัพย์ที่ต้องการสภาพคล่อง',
    offer: studio.offer || 'ประเมินทรัพย์เบื้องต้นและวางทางเลือกอย่างเป็นระบบ',
    assetType: assetTypeLabel,
    province: studio.province || '',
    channel: studio.channel || 'facebook',
    tone: studio.tone || 'trustworthy',
    contentType: studio.contentType || 'educate',
    propertyData: {
      areaRai: studio.areaRai,
      areaNgan: studio.areaNgan,
      areaWa: studio.areaWa,
      price: studio.price,
      pricePerWa: studio.pricePerWa,
      deedType: studio.deedType,
      roadWidth: studio.roadWidth,
      landmark: studio.landmark,
      utilities: studio.utilities,
    },
    campaignContext: {
      brand: 'AssetX Estate',
      positioning: 'ประเมินทรัพย์และวางทางเลือกด้านสภาพคล่องจากหลักประกันอสังหาริมทรัพย์อย่างเป็นระบบ',
      compliance: [
        'ไม่สัญญาว่าอนุมัติแน่นอน',
        'ไม่รับประกันราคาขายหรือผลตอบแทน',
        'เคสจริงต้องปิดข้อมูลส่วนบุคคล',
      ],
    },
  }
}

export function runAssetxMarketingModel(studio = {}, recentCaptions = []) {
  const result = runMarketingModel(buildAssetxMarketingInput(studio), { recentCaptions })
  result.caption = appendMarketingHashtags(result.caption, result.hashtags)
  result.automationPayload.postText = result.caption
  return result
}

export function appendMarketingHashtags(caption = '', hashtags = []) {
  const text = String(caption).trim()
  const existing = new Set((text.match(/#[\p{L}\p{M}\p{N}_]+/gu) || []).map(tag => tag.toLowerCase()))
  const added = []
  for (const value of hashtags) {
    const tag = String(value).trim().replace(/^#+/, '').replace(/[^\p{L}\p{M}\p{N}_]/gu, '')
    const key = `#${tag}`.toLowerCase()
    if (!tag || existing.has(key)) continue
    existing.add(key)
    added.push(`#${tag}`)
  }
  return added.length ? `${text}${text ? '\n\n' : ''}${added.join(' ')}` : text
}

export function canPublishAssetxPost(post, opts = {}) {
  const gate = canPublish(post, {
    publishableChannels: ['facebook', 'line-oa'],
    requireSchedule: false,
    ...opts,
  })
  if (!gate.ok) return gate
  const review = reviewAssetxContent(post)
  return review.ok ? gate : { ok: false, code: 'content_review_failed', reason: review.notes.join('\n') }
}

export function reviewAssetxContent(post = {}) {
  const legacyTopic = post.caption?.split('\n')[0] || ''
  const topic = post.topic || (resolveTopic(legacyTopic) !== 'unknown' ? legacyTopic : '')
  const findings = [
    ...checkText(post.title || post.headline, 'หัวข้อ'),
    ...checkText(post.caption, 'แคปชั่น'),
    ...checkText(post.videoScript, 'สคริปต์วิดีโอ'),
    ...checkTopicContent(topic, post),
  ]
  if (!String(post.caption || '').trim()) findings.push({ id: 'empty_caption', severity: 'block', where: 'แคปชั่น', message: 'ยังไม่มีเนื้อหาโพสต์' })
  const ok = !findings.some(item => ['block', 'warn'].includes(item.severity))
  return { ok, findings, notes: formatWarnings(findings) }
}

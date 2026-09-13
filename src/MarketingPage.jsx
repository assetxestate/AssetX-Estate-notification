import React, { useEffect, useMemo, useState } from 'react'
import { canPublishAssetxPost, runAssetxMarketingModel } from './lib/assetxMarketingModel.js'
import { getMarketingWorkspace, saveMarketingWorkspace } from './lib/api.js'

const STORAGE_KEY = 'assetx_marketing_workspace_v5'

const defaultStudio = {
  prompt: '',
  objective: 'lead_owner',
  audience: 'เจ้าของทรัพย์ที่ต้องการสภาพคล่อง',
  offer: 'ประเมินทรัพย์เบื้องต้นและวางทางเลือกขายฝาก/จำนองอย่างเป็นระบบ',
  assetType: 'land',
  province: 'ชลบุรี',
  tone: 'trustworthy',
  channel: 'facebook',
  contentType: 'educate',
}

const seedIdeas = [
  {
    id: 'pre-market-risk',
    source: 'ระบบสัญญา',
    type: 'ข้อมูลหลังบ้าน',
    score: 92,
    title: 'ทรัพย์เสี่ยงหลุด / Pre-Marketing',
    angle: 'ทำคอนเทนต์อธิบายการเตรียมทรัพย์ก่อนครบกำหนด โดยไม่เปิดเผยข้อมูลลูกค้า',
    audience: 'ทีมขายและนักลงทุน',
    channel: 'Facebook + LINE OA',
    status: 'สำคัญ',
  },
  {
    id: 'owner-liquidity',
    source: 'คำถามลูกค้า',
    type: 'Lead เจ้าของทรัพย์',
    score: 88,
    title: 'เจ้าของที่ดินต้องการเงินก้อน แต่ยังไม่อยากขายขาด',
    angle: 'เล่าให้เข้าใจความต่างระหว่างขายฝาก จำนอง และขายขาดแบบระมัดระวัง',
    audience: 'เจ้าของโฉนด',
    channel: 'Facebook',
    status: 'พร้อมทำ',
  },
  {
    id: 'seller-land',
    source: 'ฟอร์มประเมินทรัพย์',
    type: 'Lead ขายทรัพย์',
    score: 80,
    title: 'เจ้าของต้องการขายที่ดินแต่ยังไม่รู้ราคาตลาด',
    angle: 'ชวนเตรียมเอกสารและข้อมูลทำเล ก่อนส่งให้ทีมประเมินช่วยดูราคาเบื้องต้น',
    audience: 'เจ้าของที่ดิน',
    channel: 'LINE OA',
    status: 'พร้อมทำ',
  },
  {
    id: 'investor-deal',
    source: 'ฐานข้อมูลทรัพย์',
    type: 'นักลงทุน',
    score: 76,
    title: 'นักลงทุนต้องการทรัพย์ราคาดีและข้อมูลตรวจสอบครบ',
    angle: 'เน้น checklist ก่อนดูทรัพย์: เอกสารสิทธิ์ ทำเล ทางเข้า ภาระผูกพัน และราคาตลาด',
    audience: 'นักลงทุน',
    channel: 'Facebook',
    status: 'พร้อมทำ',
  },
  {
    id: 'market-radar',
    source: 'Hermes + Tavily',
    type: 'Trend Radar',
    score: 72,
    title: 'สำรวจทำเลที่เริ่มมีสัญญาณน่าสนใจ',
    angle: 'ให้ Hermes สรุปข่าวอสังหา ดอกเบี้ย และประกาศขายในพื้นที่ แล้วแปลงเป็นหัวข้อคอนเทนต์',
    audience: 'ทีมการตลาด',
    channel: 'Blog + Facebook',
    status: 'รอต่อ API',
  },
  {
    id: 'faq-legal',
    source: 'Brand Brain',
    type: 'ความรู้',
    score: 69,
    title: 'ขายฝากกับจำนองต่างกันอย่างไร',
    angle: 'คอนเทนต์ให้ความรู้แบบไม่ชี้นำ พร้อมคำเตือนว่าเป็นข้อมูลทั่วไป ไม่ใช่คำปรึกษากฎหมายเฉพาะเคส',
    audience: 'เจ้าของทรัพย์',
    channel: 'TikTok / Reels',
    status: 'ควรทำประจำ',
  },
]

const seedDrafts = [
  {
    id: 'sample-1',
    title: 'ขายฝากกับจำนองต่างกันอย่างไร',
    channel: 'Facebook',
    status: 'pending',
    caption: 'ก่อนใช้โฉนดเป็นหลักประกัน ควรรู้ความต่างของขายฝากและจำนองให้ชัด ทั้งสิทธิ ระยะเวลา และภาระที่ต้องรับผิดชอบ\n\nAssetX Estate ช่วยประเมินข้อมูลเบื้องต้นและแนะนำขั้นตอนที่ควรเตรียมก่อนตัดสินใจ\n\nหมายเหตุ: ข้อมูลนี้เป็นข้อมูลทั่วไป ไม่ใช่คำปรึกษากฎหมายเฉพาะกรณี',
    imagePrompt: 'ภาพแนวมืออาชีพ โต๊ะทำงาน มีโฉนด แผนที่ และเช็กลิสต์เอกสาร โทนสว่างน่าเชื่อถือ ไม่มีข้อความบนภาพ',
    reviewStatus: 'passed',
    reviewNotes: ['ไม่มีคำรับประกันอนุมัติ', 'มีคำเตือนทางกฎหมาย', 'เหมาะกับโพสต์ให้ความรู้'],
    source: 'Brand Brain',
  },
  {
    id: 'sample-2',
    title: 'ทรัพย์เสี่ยงหลุดควรเตรียมอะไร',
    channel: 'LINE OA',
    status: 'needs_edit',
    caption: 'ทรัพย์ใกล้ครบกำหนดควรเตรียมข้อมูลให้พร้อม ทั้งเอกสารสิทธิ์ รูปถ่าย ทำเล และราคาตลาด เพื่อวางแผนระบายทรัพย์ได้ทันเวลา',
    imagePrompt: 'ภาพทีมงานตรวจเอกสารและแผนที่ทรัพย์ โทนสุภาพ ไม่เห็นข้อมูลส่วนตัว',
    reviewStatus: 'needs_edit',
    reviewNotes: ['ควรย้ำว่าไม่เปิดเผยข้อมูลลูกค้า', 'ควรหลีกเลี่ยงคำว่า “หลุดแน่นอน”', 'ต้องให้มนุษย์ตรวจก่อนเผยแพร่จริง'],
    source: 'ระบบสัญญา',
  },
]

const pipelineJobs = [
  ['Supabase workspace sync', 'ใช้งานได้', 'บันทึกโพสต์ ไอเดีย และคิวงานของหน้า Marketing ลง marketing_workspaces'],
  ['Tavily Trend Radar', 'ใช้งานได้เมื่อมีคีย์', 'อ่านข่าว ทำเล ดอกเบี้ย และประกาศขายที่เกี่ยวข้องเพื่อสร้างไอเดีย'],
  ['Creative Radar / Reference Vault', 'ใช้งานได้', 'เปิดแหล่งสำรวจ Meta, TikTok, Pinterest และบันทึก reference เพื่อถอด pattern เป็น brief ของ AssetX'],
  ['ดึงเคสจากระบบหลังบ้าน', 'ออกแบบแล้ว', 'ดึงสัญญาครบกำหนด ลูกค้าค้างชำระ และ lead ล่าสุด'],
  ['จัดอันดับไอเดียวันนี้', 'พร้อมใช้แบบ mock', 'ให้คะแนนจากความเร่งด่วน ความเสี่ยง และโอกาสทางยอดขาย'],
  ['ร่างคอนเทนต์', 'ใช้งานได้', 'ใช้ template fallback เพื่อลดเครดิต และต่อโมเดลเมื่อจำเป็น'],
  ['ตรวจความเสี่ยง', 'ใช้งานได้บางส่วน', 'ตรวจคำสัญญาเกินจริง ข้อมูลส่วนตัว และความเสี่ยงทางกฎหมาย'],
  ['ส่งเข้ารออนุมัติ', 'ใช้งานได้', 'ให้เจ้าของงานเลือกอนุมัติ แก้ หรือพักไว้ก่อนโพสต์'],
]

const inboxCases = [
  {
    id: 'legal-sale-with-redemption',
    source: 'Facebook Comment',
    risk: 'สูง',
    intent: 'กฎหมาย/สัญญา',
    question: 'ถ้าขายฝากไว้แล้วอยากไถ่ก่อนครบกำหนด ต้องจ่ายดอกครบตามสัญญาไหม',
    suggestedReply: 'เบื้องต้นผู้ขายฝากควรตรวจข้อความในสัญญาและกฎหมายที่เกี่ยวข้องก่อนสรุปยอดสินไถ่ครับ หากเป็นกรณีขายฝากที่ดินเพื่อเกษตรกรรมหรือที่อยู่อาศัย อาจมีหลักเรื่องสิทธิไถ่ก่อนกำหนดและการคำนวณสินไถ่ตามสัดส่วนเวลา แนะนำส่งสำเนาสัญญาและวันครบกำหนดให้ทีมงานตรวจเบื้องต้นก่อนนัดหมายครับ\n\nหมายเหตุ: คำตอบนี้เป็นข้อมูลทั่วไป ไม่ใช่คำปรึกษากฎหมายเฉพาะกรณี',
    action: 'ให้คนตรวจก่อนตอบ',
  },
  {
    id: 'lead-owner-liquidity',
    source: 'LINE OA',
    risk: 'กลาง',
    intent: 'Lead เจ้าของทรัพย์',
    question: 'มีโฉนดที่ดินต่างจังหวัด อยากได้เงินก้อนแต่ยังไม่อยากขายขาด ทำได้ไหม',
    suggestedReply: 'สามารถส่งข้อมูลเบื้องต้นให้ทีมประเมินได้ครับ ได้แก่ จังหวัด/อำเภอ/ตำบล ประเภททรัพย์ เนื้อที่ และรูปหน้าโฉนดที่ปิดข้อมูลสำคัญบางส่วน ทีมงานจะช่วยดูทางเลือกเบื้องต้น เช่น จำนอง ขายฝาก หรือแนวทางขายทรัพย์ โดยยังไม่ฟันธงวงเงินจนกว่าจะตรวจเอกสารและทำเลจริงครับ',
    action: 'ตอบได้หลังตรวจข้อความ',
  },
  {
    id: 'investor-deal',
    source: 'TikTok Inbox',
    risk: 'ต่ำ',
    intent: 'นักลงทุน',
    question: 'มีทรัพย์ราคาดีให้ลงทุนไหม ขอแบบต่ำกว่าตลาด',
    suggestedReply: 'AssetX Estate จะคัดทรัพย์จากข้อมูลเอกสารสิทธิ์ ทำเล ทางเข้า ภาระผูกพัน และราคาตลาดก่อนนำเสนอครับ หากสนใจรับรายการทรัพย์สำหรับนักลงทุน สามารถฝากประเภททรัพย์ งบประมาณ และพื้นที่ที่สนใจไว้ได้ ทีมงานจะคัดข้อมูลที่เหมาะสมให้ตรวจต่อครับ',
    action: 'ตอบได้',
  },
]

const assetxVisualStyles = [
  {
    id: 'assetx-premium-realistic',
    name: 'AssetX Premium Realistic',
    badge: 'ค่าเริ่มต้น',
    description: 'ภาพสมจริง พรีเมี่ยม สะอาด น่าเชื่อถือ เหมาะกับแบรนด์ที่ปรึกษาอสังหาริมทรัพย์และหลักประกัน',
    prompt: 'Photorealistic premium Thai real-estate advisory brand. Editorial commercial photography, natural daylight, clean composition, premium but approachable, deep navy and teal accents, subtle warm highlights, crisp details, trustworthy financial advisory mood.',
    scenes: 'Clean executive desk, land deed folder with all details obscured, cadastral map without readable private data, calculator, tablet map interface, modern Thai property context, professional hands reviewing documents, no identifiable real person.',
  },
  {
    id: 'assetx-field-survey',
    name: 'Field Survey Premium',
    badge: 'ทรัพย์/ที่ดิน',
    description: 'ภาพลงพื้นที่ดูทรัพย์และทำเล เหมาะกับโพสต์ประเมินที่ดินและนักลงทุน',
    prompt: 'Photorealistic premium field survey style. Real Thai land and property inspection mood, clean sunlight, cinematic documentary look, professional survey team details without identifiable faces, refined teal and navy brand accents.',
    scenes: 'Land plot entrance, road access, map tablet, survey notebook, measuring tape, property boundary atmosphere, realistic Thai provincial environment, no exact address signs, no deed numbers.',
  },
  {
    id: 'assetx-investor-brief',
    name: 'Investor Brief',
    badge: 'นักลงทุน',
    description: 'ภาพประชุมและสรุปข้อมูล เหมาะกับคอนเทนต์นักลงทุน/ทรัพย์ราคาดี',
    prompt: 'Photorealistic premium investor briefing style. Modern meeting table, clean financial advisory setting, sophisticated lighting, calm confidence, premium Thai real-estate investment mood, deep navy and teal palette.',
    scenes: 'Investment brief papers, anonymized property photos, tablet dashboard, coffee, calculator, minimal charts without readable sensitive text, professional hands only.',
  },
]

const referenceSources = [
  {
    id: 'meta-ads',
    name: 'Meta Ads Library',
    type: 'โฆษณา Facebook / Instagram',
    strength: 'ดู hook, ภาพปก, carousel, CTA และข้อความโฆษณาของตลาดจริง',
    searchUrl: (query) => `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&media_type=all&q=${encodeURIComponent(query)}&search_type=keyword_unordered`,
  },
  {
    id: 'tiktok-top-ads',
    name: 'TikTok Creative Center',
    type: 'วิดีโอสั้น / Top Ads',
    strength: 'ดู hook 3 วินาทีแรก, script, pacing และ visual angle สำหรับ Reels/TikTok',
    searchUrl: () => 'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?period=30&region=TH',
  },
  {
    id: 'pinterest-trends',
    name: 'Pinterest Trends',
    type: 'Moodboard / Visual trend',
    strength: 'หา mood, keyword, layout และ direction ของภาพอสังหา/บ้าน/ที่ดิน',
    searchUrl: (query) => `https://trends.pinterest.com/?geo=TH&q=${encodeURIComponent(query)}`,
  },
  {
    id: 'pinterest-search',
    name: 'Pinterest Search',
    type: 'Visual reference',
    strength: 'เก็บไอเดีย composition, โทนสี และ mood ของภาพโดยไม่ลอกภาพเดิม',
    searchUrl: (query) => `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'google-creative',
    name: 'Google Image / Web',
    type: 'ภาพและบทความ',
    strength: 'หา reference กว้าง ๆ จากคีย์เวิร์ดไทยและอังกฤษ',
    searchUrl: (query) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`,
  },
]

const referenceStarterQueries = [
  'ขายฝาก โฉนด ที่ดิน เงินก้อน',
  'จำนอง ที่ดิน ประเมินทรัพย์',
  'real estate investment Thailand',
  'property loan collateral ad',
  'distressed asset real estate investor',
  'land investment social media ad',
]

const defaultReferenceForm = {
  title: '',
  url: '',
  sourceId: 'meta-ads',
  hook: '',
  visualPattern: '',
  contentAngle: '',
  audience: 'เจ้าของทรัพย์',
  channel: 'Facebook',
  risk: 'medium',
  tags: 'ขายฝาก, โฉนด, lead',
  notes: '',
}

function loadWorkspace() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      studio: { ...defaultStudio, ...(stored.studio || {}) },
      generated: stored.generated || null,
      posts: Array.isArray(stored.posts) ? stored.posts : [],
      savedIdeas: Array.isArray(stored.savedIdeas) ? stored.savedIdeas : [],
      radarIdeas: Array.isArray(stored.radarIdeas) ? stored.radarIdeas : [],
      references: Array.isArray(stored.references) ? stored.references : [],
      referenceForm: { ...defaultReferenceForm, ...(stored.referenceForm || {}) },
      referenceQuery: stored.referenceQuery || referenceStarterQueries[0],
      metrics: Array.isArray(stored.metrics) ? stored.metrics : [],
      hiddenPostIds: Array.isArray(stored.hiddenPostIds) ? stored.hiddenPostIds : [],
      manualIdea: stored.manualIdea || '',
    }
  } catch {
    return {
      studio: defaultStudio,
      generated: null,
      posts: [],
      savedIdeas: [],
      radarIdeas: [],
      references: [],
      referenceForm: defaultReferenceForm,
      referenceQuery: referenceStarterQueries[0],
      metrics: [],
      hiddenPostIds: [],
      manualIdea: '',
    }
  }
}

function normalizePrompt(prompt) {
  const text = (prompt || '').trim()
  return text || 'เจ้าของทรัพย์ต้องการเงินก้อน แต่ยังไม่อยากขายขาด'
}

function normalizeWorkspace(workspace = {}) {
  return {
    studio: { ...defaultStudio, ...(workspace.studio || {}) },
    generated: workspace.generated || null,
    posts: Array.isArray(workspace.posts) ? workspace.posts : [],
    savedIdeas: Array.isArray(workspace.savedIdeas) ? workspace.savedIdeas : [],
    radarIdeas: Array.isArray(workspace.radarIdeas) ? workspace.radarIdeas : [],
    references: Array.isArray(workspace.references) ? workspace.references : [],
    referenceForm: { ...defaultReferenceForm, ...(workspace.referenceForm || {}) },
    referenceQuery: workspace.referenceQuery || referenceStarterQueries[0],
    metrics: Array.isArray(workspace.metrics) ? workspace.metrics : [],
    hiddenPostIds: Array.isArray(workspace.hiddenPostIds) ? workspace.hiddenPostIds : [],
    manualIdea: workspace.manualIdea || '',
  }
}

function hasWorkspaceContent(workspace) {
  return Boolean(
    workspace?.generated ||
    workspace?.posts?.length ||
    workspace?.savedIdeas?.length ||
    workspace?.radarIdeas?.length ||
    workspace?.references?.length ||
    workspace?.metrics?.length ||
    workspace?.hiddenPostIds?.length ||
    workspace?.referenceQuery?.trim() ||
    workspace?.manualIdea?.trim(),
  )
}

const statusLabels = {
  draft: 'ร่าง',
  pending: 'รอตรวจ',
  needs_edit: 'ควรแก้',
  approved: 'อนุมัติแล้ว',
  scheduled: 'จองวันแล้ว',
  posted: 'โพสต์แล้ว',
  archived: 'พักไว้',
}

function getPostTime(post) {
  const raw = post.postedAt || post.scheduledAt || post.createdAt || ''
  const time = raw ? new Date(raw).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function buildChannelPreview(post, channel) {
  if (!post) return 'เลือกหรือสร้างโพสต์ก่อน ระบบจะแสดงตัวอย่างตามช่องทางที่เลือก'
  const caption = (post.caption || '').trim()
  if (channel === 'line') {
    const firstLine = caption.split('\n').find(Boolean) || post.title
    return `${firstLine}\n\nสนใจให้ AssetX Estate ช่วยประเมินเบื้องต้น ส่งจังหวัด / ประเภททรัพย์ / เนื้อที่ เข้ามาได้เลย\n\nหมายเหตุ: ทีมงานตรวจข้อมูลจริงก่อนเสนอทางเลือกทุกครั้ง`
  }
  if (channel === 'tiktok') {
    return post.videoScript || `Hook: ${post.title}\n\n1. เปิดด้วยปัญหาที่เจ้าของทรัพย์เจอบ่อย\n2. อธิบายทางเลือกแบบไม่สัญญาเกินจริง\n3. ปิดท้ายด้วยการชวนส่งข้อมูลเพื่อประเมินเบื้องต้น`
  }
  return `${caption}\n\n#AssetXEstate #ขายฝาก #จำนอง #ประเมินทรัพย์`
}

function sourceFromId(id) {
  return referenceSources.find((source) => source.id === id) || referenceSources[0]
}

function hostFromUrl(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function normalizeTags(value = '') {
  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function buildReferenceBrief(reference) {
  const source = sourceFromId(reference.sourceId)
  const tags = Array.isArray(reference.tags) ? reference.tags.join(', ') : reference.tags
  return [
    `Reference: ${reference.title}`,
    `Source: ${source.name}${reference.url ? ` (${reference.url})` : ''}`,
    `Audience: ${reference.audience || 'เจ้าของทรัพย์'}`,
    `Channel: ${reference.channel || 'Facebook'}`,
    `Hook ที่น่าสนใจ: ${reference.hook || 'ยังไม่ระบุ'}`,
    `Pattern ภาพ/วิดีโอ: ${reference.visualPattern || 'ยังไม่ระบุ'}`,
    `Angle ที่ควรทำในแบบ AssetX: ${reference.contentAngle || 'ถอดเป็นคอนเทนต์ให้ความรู้ที่ไม่สัญญาเกินจริง'}`,
    `Tags: ${tags || '-'}`,
    '',
    'AssetX rule:',
    '- ใช้ reference เพื่อเรียนรู้ pattern เท่านั้น ห้ามลอกภาพ/โลโก้/ข้อความคู่แข่ง',
    '- ไม่ใส่ข้อมูลส่วนตัว เลขโฉนด เบอร์โทร ที่อยู่ หรือภาพลูกค้าจริง',
    '- ไม่สัญญาว่าอนุมัติแน่นอน ได้เงินทันที หรือรับประกันผลตอบแทน',
    '- โทนภาพ: สมจริง พรีเมี่ยม สะอาด น่าเชื่อถือ มีสี navy/teal ของ AssetX',
  ].join('\n')
}

function referenceToIdea(reference) {
  const source = sourceFromId(reference.sourceId)
  return {
    id: `ref-idea-${reference.id}`,
    source: `Reference · ${source.name}`,
    type: 'Creative Reference',
    score: reference.risk === 'low' ? 86 : reference.risk === 'high' ? 70 : 80,
    title: reference.title,
    angle: reference.contentAngle || reference.hook || 'นำ reference นี้มาถอดเป็นคอนเทนต์ในภาษาของ AssetX',
    audience: reference.audience || 'เจ้าของทรัพย์',
    channel: reference.channel || 'Facebook',
    status: 'ถอด pattern แล้ว',
    url: reference.url || '',
  }
}

export default function MarketingPage({ onBack }) {
  const [workspace, setWorkspace] = useState(loadWorkspace)
  const [view, setView] = useState('ideas')
  const [showAllIdeas, setShowAllIdeas] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [libraryFilter, setLibraryFilter] = useState('active')
  const [librarySort, setLibrarySort] = useState('newest')
  const [previewChannel, setPreviewChannel] = useState('facebook')
  const [metricForm, setMetricForm] = useState({ title: '', channel: 'Facebook', leads: 0, qualified: 0, appointments: 0, notes: '' })
  const [visualStyleId, setVisualStyleId] = useState('assetx-premium-realistic')
  const [mediaLoading, setMediaLoading] = useState(null)
  const [mediaResult, setMediaResult] = useState(null)
  const [selectedReferenceId, setSelectedReferenceId] = useState(null)
  const [cloudReady, setCloudReady] = useState(false)
  const [syncStatus, setSyncStatus] = useState('กำลังเชื่อม Supabase')
  const [radarLoading, setRadarLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const ideaPool = useMemo(() => [...(workspace.radarIdeas || []), ...seedIdeas], [workspace.radarIdeas])
  const allDrafts = useMemo(
    () => [...workspace.posts, ...seedDrafts.filter((post) => !workspace.hiddenPostIds.includes(post.id))],
    [workspace.posts, workspace.hiddenPostIds],
  )
  const pendingDrafts = allDrafts.filter((post) => post.status === 'pending' || post.status === 'draft' || post.status === 'needs_edit')
  const approvedDrafts = allDrafts.filter((post) => post.status === 'approved' || post.status === 'scheduled' || post.status === 'posted')
  const selectedDraft = allDrafts.find((post) => post.id === selectedId) || allDrafts[0]
  const visibleIdeas = showAllIdeas ? ideaPool : ideaPool.slice(0, 4)
  const dashboardCounts = {
    ideas: ideaPool.length,
    approvals: pendingDrafts.length,
    ready: approvedDrafts.length,
    saved: workspace.savedIdeas.length,
    references: workspace.references?.length || 0,
    library: allDrafts.length + workspace.savedIdeas.length,
  }
  const selectedReference = (workspace.references || []).find((item) => item.id === selectedReferenceId) || (workspace.references || [])[0]

  const save = (next) => {
    setWorkspace(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  useEffect(() => {
    let cancelled = false
    getMarketingWorkspace()
      .then((remote) => {
        if (cancelled) return
        if (remote?.payload && hasWorkspaceContent(remote.payload)) {
          const next = normalizeWorkspace(remote.payload)
          setWorkspace(next)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
          setSyncStatus(`Sync แล้ว ${remote.updated_at ? new Date(remote.updated_at).toLocaleString('th-TH') : ''}`.trim())
        } else {
          setSyncStatus('พร้อม sync')
        }
        setCloudReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setSyncStatus('ใช้ข้อมูลในเครื่อง')
        setCloudReady(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!cloudReady) return undefined
    const timer = window.setTimeout(() => {
      saveMarketingWorkspace(workspace)
        .then(() => setSyncStatus('Sync แล้ว'))
        .catch(() => setSyncStatus('ใช้ข้อมูลในเครื่อง'))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [workspace, cloudReady])

  const notify = (message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 2200)
  }

  const updatePost = (id, patch, message) => {
    if (String(id).startsWith('sample-')) {
      const cloned = allDrafts.find((post) => post.id === id)
      const post = { ...cloned, id: Date.now(), ...patch }
      save({ ...workspace, posts: [post, ...workspace.posts] })
      setSelectedId(post.id)
      if (message) notify(message)
      return
    }
    save({ ...workspace, posts: workspace.posts.map((post) => post.id === id ? { ...post, ...patch } : post) })
    if (message) notify(message)
  }

  const archivePost = (id) => {
    updatePost(id, { status: 'archived' }, 'พักโพสต์ไว้ในคลังแล้ว')
  }

  const restorePost = (id) => {
    updatePost(id, { status: 'draft', reviewStatus: 'needs_edit' }, 'กู้คืนเป็นร่างแล้ว')
  }

  const deletePost = (id) => {
    const isSample = String(id).startsWith('sample-')
    const next = isSample
      ? { ...workspace, hiddenPostIds: [...new Set([...(workspace.hiddenPostIds || []), id])] }
      : { ...workspace, posts: workspace.posts.filter((post) => post.id !== id) }
    save(next)
    if (selectedId === id) setSelectedId(null)
    notify('ลบออกจากคลังแล้ว')
  }

  const deleteSavedIdea = (id) => {
    save({ ...workspace, savedIdeas: workspace.savedIdeas.filter((idea) => idea.id !== id) })
    notify('ลบไอเดียที่เก็บไว้แล้ว')
  }

  const generateContent = (prompt, sourceIdea) => {
    const input = {
      ...workspace.studio,
      prompt: normalizePrompt(prompt),
      audience: sourceIdea?.audience || workspace.studio.audience,
      offer: sourceIdea?.angle || workspace.studio.offer,
      channel: sourceIdea?.channel?.includes('LINE') ? 'line-oa' : workspace.studio.channel,
    }
    const generated = runAssetxMarketingModel(input, allDrafts.slice(0, 8).map((post) => post.caption || ''))
    save({ ...workspace, studio: input, generated })
    setView('studio')
  }

  const addGeneratedToQueue = (status = 'pending') => {
    if (!workspace.generated) return
    const publishCheck = canPublishAssetxPost({ channel: workspace.studio.channel, status, caption: workspace.generated.caption })
    const post = {
      id: Date.now(),
      title: workspace.generated.headline || workspace.studio.prompt,
      channel: workspace.studio.channel,
      status,
      caption: workspace.generated.caption,
      imagePrompt: workspace.generated.imagePrompt,
      videoScript: workspace.generated.videoScript,
      reviewStatus: publishCheck.ok ? 'passed' : 'needs_edit',
      reviewNotes: publishCheck.ok
        ? ['ผ่านเงื่อนไขเบื้องต้น', 'ควรตรวจรายละเอียดจริงก่อนโพสต์']
        : [...(workspace.generated.warnings || []), 'ควรให้คนตรวจซ้ำก่อนเผยแพร่'],
      source: 'AssetX Studio',
      createdAt: new Date().toISOString(),
    }
    save({ ...workspace, posts: [post, ...workspace.posts] })
    setSelectedId(post.id)
    setView('approvals')
    notify(status === 'approved' ? 'อนุมัติไว้ก่อนแล้ว' : 'ส่งเข้าคิวรออนุมัติแล้ว')
  }

  const addManualIdea = () => {
    if (!workspace.manualIdea.trim()) return
    generateContent(workspace.manualIdea, {
      audience: 'กลุ่มเป้าหมายจากไอเดียที่กรอกเอง',
      angle: workspace.manualIdea,
      channel: 'Facebook',
    })
  }

  const saveIdeaForLater = (idea) => {
    const exists = workspace.savedIdeas.some((item) => item.id === idea.id)
    const savedIdeas = exists
      ? workspace.savedIdeas
      : [{ ...idea, savedAt: new Date().toISOString() }, ...workspace.savedIdeas]
    save({ ...workspace, savedIdeas })
    notify(exists ? 'ไอเดียนี้อยู่ในคลังแล้ว' : 'เก็บไอเดียไว้ในผลงานทั้งหมดแล้ว')
  }

  const updateReferenceForm = (patch) => {
    save({ ...workspace, referenceForm: { ...workspace.referenceForm, ...patch } })
  }

  const addReference = () => {
    const form = { ...defaultReferenceForm, ...(workspace.referenceForm || {}) }
    const title = form.title.trim()
    if (!title) {
      notify('กรุณาใส่ชื่อ reference หรือหัวข้อที่เจอ', 'error')
      return
    }
    const reference = {
      id: Date.now(),
      title,
      url: form.url.trim(),
      sourceId: form.sourceId,
      hook: form.hook.trim(),
      visualPattern: form.visualPattern.trim(),
      contentAngle: form.contentAngle.trim(),
      audience: form.audience.trim() || 'เจ้าของทรัพย์',
      channel: form.channel.trim() || 'Facebook',
      risk: form.risk || 'medium',
      tags: normalizeTags(form.tags),
      notes: form.notes.trim(),
      createdAt: new Date().toISOString(),
    }
    save({
      ...workspace,
      references: [reference, ...(workspace.references || [])],
      referenceForm: { ...defaultReferenceForm, sourceId: form.sourceId, audience: form.audience, channel: form.channel, tags: form.tags },
    })
    setSelectedReferenceId(reference.id)
    notify('บันทึก reference แล้ว')
  }

  const deleteReference = (id) => {
    save({ ...workspace, references: (workspace.references || []).filter((item) => item.id !== id) })
    if (selectedReferenceId === id) setSelectedReferenceId(null)
    notify('ลบ reference แล้ว')
  }

  const createFromReference = (reference) => {
    const brief = buildReferenceBrief(reference)
    generateContent(`${reference.title}\n\n${brief}`, referenceToIdea(reference))
    notify('ส่ง reference เข้า Studio แล้ว')
  }

  const saveReferenceAsIdea = (reference) => {
    saveIdeaForLater(referenceToIdea(reference))
  }

  const loadTrendRadar = async () => {
    setRadarLoading(true)
    try {
      const res = await fetch('/api/marketing-radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: `${workspace.studio.province} ${workspace.studio.audience} ${workspace.studio.offer}` }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error || 'ดึง Trend Radar ไม่สำเร็จ')
      const nextIdeas = Array.isArray(data.ideas) ? data.ideas : []
      if (!nextIdeas.length) throw new Error('Tavily ยังไม่พบประเด็นที่นำมาใช้ได้')
      save({ ...workspace, radarIdeas: nextIdeas })
      notify(`ดึง Trend Radar แล้ว ${nextIdeas.length} หัวข้อ`)
      setShowAllIdeas(true)
    } catch (err) {
      notify(err.message || 'ดึง Trend Radar ไม่สำเร็จ', 'error')
    } finally {
      setRadarLoading(false)
    }
  }

  const addMetricRecord = () => {
    const title = metricForm.title.trim()
    if (!title) {
      notify('กรุณากรอกชื่อโพสต์หรือแคมเปญ', 'error')
      return
    }
    const record = {
      id: Date.now(),
      ...metricForm,
      title,
      leads: Number(metricForm.leads) || 0,
      qualified: Number(metricForm.qualified) || 0,
      appointments: Number(metricForm.appointments) || 0,
      createdAt: new Date().toISOString(),
    }
    save({ ...workspace, metrics: [record, ...(workspace.metrics || [])] })
    setMetricForm({ title: '', channel: 'Facebook', leads: 0, qualified: 0, appointments: 0, notes: '' })
    notify('บันทึกผลโพสต์แล้ว')
  }

  const deleteMetricRecord = (id) => {
    save({ ...workspace, metrics: (workspace.metrics || []).filter((item) => item.id !== id) })
    notify('ลบผลโพสต์แล้ว')
  }

  const generateMedia = async (type, brief) => {
    setMediaLoading(`${type}:${brief.id}`)
    try {
      const visualStyle = assetxVisualStyles.find((style) => style.id === visualStyleId) || assetxVisualStyles[0]
      const prompt = type === 'video'
        ? (brief.videoScript || brief.imagePrompt || brief.title)
        : (brief.imagePrompt || brief.title)
      const res = await fetch(type === 'video' ? '/api/marketing-video' : '/api/marketing-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          styleProfile: visualStyle,
          aspectRatio: type === 'video' ? '9:16' : '1:1',
          imageSize: '1K',
          resolution: '720p',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        if (data.fallbackPrompt) {
          setMediaResult({
            id: Date.now(),
            type: 'prompt',
            targetType: type,
            title: brief.title,
            prompt: data.fallbackPrompt,
            model: data.code || 'Prompt fallback',
          })
          notify(data.error || 'โควต้าเต็ม จึงเตรียม prompt พร้อมนำไปใช้แทน', 'error')
          return
        }
        throw new Error(data.error || (type === 'video' ? 'สร้างวิดีโอไม่สำเร็จ' : 'สร้างรูปไม่สำเร็จ'))
      }
      setMediaResult({
        id: Date.now(),
        type,
        title: brief.title,
        dataUrl: data.dataUrl,
        mimeType: data.mimeType,
        model: data.model,
      })
      notify(type === 'video' ? 'สร้างวิดีโอแล้ว' : 'สร้างรูปแล้ว')
    } catch (err) {
      notify(err.message || 'สร้างสื่อไม่สำเร็จ', 'error')
    } finally {
      setMediaLoading(null)
    }
  }

  const copyText = (text) => navigator.clipboard?.writeText(text || '').then(() => notify('คัดลอกแล้ว')).catch(() => notify('คัดลอกไม่สำเร็จ', 'error'))

  return (
    <div className="mx-page">
      <style>{styles}</style>
      <aside className="mx-sidebar">
        <div className="mx-brand">
          <img src="/logo.jpg" alt="AssetX Estate" className="mx-brand-logo" />
          <div>
            <div className="mx-brand-name">AssetX Estate</div>
            <div className="mx-brand-sub">Marketing OS</div>
          </div>
        </div>
        <button className="mx-create" onClick={() => setView('studio')}>+ สร้างโพสต์</button>
        <NavSection title="วันนี้">
          <NavButton active={view === 'ideas'} label="ไอเดียวันนี้" count={dashboardCounts.ideas} onClick={() => setView('ideas')} />
          <NavButton active={view === 'approvals'} label="รออนุมัติ" count={dashboardCounts.approvals} onClick={() => setView('approvals')} />
          <NavButton active={view === 'queue'} label="รอโพสต์" count={dashboardCounts.ready} onClick={() => setView('queue')} />
          <NavButton active={view === 'calendar'} label="ปฏิทินโพสต์" onClick={() => setView('calendar')} />
        </NavSection>
        <NavSection title="สร้าง">
          <NavButton active={view === 'references'} label="สำรวจ Reference" count={dashboardCounts.references} onClick={() => setView('references')} />
          <NavButton active={view === 'gallery'} label="ห้องภาพ" onClick={() => setView('gallery')} />
        </NavSection>
        <NavSection title="แบรนด์ของฉัน">
          <NavButton active={view === 'brand'} label="Brand Brain" onClick={() => setView('brand')} />
          <NavButton active={view === 'library'} label="ผลงานทั้งหมด" count={dashboardCounts.library} onClick={() => setView('library')} />
        </NavSection>
        <NavSection title="ดูผล">
          <NavButton active={view === 'metrics'} label="ตัวเลข" onClick={() => setView('metrics')} />
        </NavSection>
        <NavSection title="ระบบ">
          <NavButton active={view === 'pipeline'} label="สายพานการผลิต" onClick={() => setView('pipeline')} />
          <NavButton active={view === 'inbox'} label="ตอบคอมเมนต์ เฟส 3" onClick={() => setView('inbox')} />
        </NavSection>
        <div className="mx-today-card">
          <div className="mx-card-title">งานวันนี้</div>
          <MetricLine label="ไอเดียพร้อมใช้" value={dashboardCounts.ideas} />
          <MetricLine label="รอตรวจ" value={dashboardCounts.approvals} />
          <MetricLine label="พร้อมโพสต์" value={dashboardCounts.ready} />
        </div>
      </aside>
      <main className="mx-main">
        <header className="mx-topbar">
          <button className="mx-back" onClick={onBack}>กลับหน้าหลัก</button>
          <div className="mx-top-actions">
            <span className="mx-status">Online</span>
            <button className="mx-pill">{syncStatus}</button>
            <button className="mx-pill">มาตรฐาน AssetX</button>
            <button className="mx-pill">40 เครดิต</button>
            <div className="mx-avatar">C</div>
          </div>
        </header>
        <div className="mx-notice">
          <span>Studio พร้อมสร้างคอนเทนต์ · Creative Radar เก็บ reference ได้ · Workspace sync กับ Supabase แล้ว</span>
        </div>
        {view === 'ideas' && (
          <IdeasView
            ideas={visibleIdeas}
            showAll={showAllIdeas}
            total={ideaPool.length}
            radarCount={workspace.radarIdeas?.length || 0}
            radarLoading={radarLoading}
            manualIdea={workspace.manualIdea}
            onManualChange={(manualIdea) => save({ ...workspace, manualIdea })}
            onAddManual={addManualIdea}
            onToggle={() => setShowAllIdeas((value) => !value)}
            onCreate={generateContent}
            onSaveIdea={saveIdeaForLater}
            onLoadRadar={loadTrendRadar}
          />
        )}
        {view === 'studio' && (
          <StudioView
            studio={workspace.studio}
            generated={workspace.generated}
            onPromptChange={(prompt) => save({ ...workspace, studio: { ...workspace.studio, prompt } })}
            onGenerate={() => generateContent(workspace.studio.prompt)}
            onQueue={addGeneratedToQueue}
            onCopy={copyText}
          />
        )}
        {view === 'approvals' && (
          <ApprovalsView drafts={pendingDrafts} selected={selectedDraft} onSelect={setSelectedId} onUpdate={updatePost} onCopy={copyText} />
        )}
        {view === 'queue' && <QueueView posts={approvedDrafts} onCreate={() => setView('ideas')} onUpdate={updatePost} />}
        {view === 'references' && (
          <ReferenceRadarView
            query={workspace.referenceQuery || referenceStarterQueries[0]}
            sources={referenceSources}
            starterQueries={referenceStarterQueries}
            form={{ ...defaultReferenceForm, ...(workspace.referenceForm || {}) }}
            references={workspace.references || []}
            selectedReference={selectedReference}
            onQueryChange={(referenceQuery) => save({ ...workspace, referenceQuery })}
            onFormChange={updateReferenceForm}
            onAdd={addReference}
            onSelect={setSelectedReferenceId}
            onDelete={deleteReference}
            onCopy={(reference) => copyText(buildReferenceBrief(reference))}
            onCreate={createFromReference}
            onSaveIdea={saveReferenceAsIdea}
          />
        )}
        {view === 'gallery' && (
          <GalleryView
            drafts={allDrafts}
            generated={workspace.generated}
            mediaLoading={mediaLoading}
            mediaResult={mediaResult}
            visualStyles={assetxVisualStyles}
            visualStyleId={visualStyleId}
            onVisualStyleChange={setVisualStyleId}
            onCopy={copyText}
            onGenerateImage={(brief) => generateMedia('image', brief)}
            onGenerateVideo={(brief) => generateMedia('video', brief)}
          />
        )}
        {view === 'brand' && <BrandBrainView />}
        {view === 'library' && (
          <LibraryView
            posts={allDrafts}
            savedIdeas={workspace.savedIdeas}
            filter={libraryFilter}
            sort={librarySort}
            previewChannel={previewChannel}
            onFilterChange={setLibraryFilter}
            onSortChange={setLibrarySort}
            onPreviewChannelChange={setPreviewChannel}
            onCreate={generateContent}
            onArchive={archivePost}
            onRestore={restorePost}
            onDelete={deletePost}
            onDeleteSavedIdea={deleteSavedIdea}
          />
        )}
        {view === 'calendar' && <CalendarView posts={approvedDrafts} />}
        {view === 'metrics' && (
          <MetricsView
            metrics={workspace.metrics || []}
            form={metricForm}
            onFormChange={setMetricForm}
            onAdd={addMetricRecord}
            onDelete={deleteMetricRecord}
          />
        )}
        {view === 'pipeline' && <PipelineView />}
        {view === 'inbox' && <InboxView onCopy={copyText} onCreate={generateContent} />}
        {toast && <div className={`mx-toast ${toast.type === 'error' ? 'error' : ''}`}>{toast.message}</div>}
      </main>
    </div>
  )
}

function ReferenceRadarView({
  query,
  sources,
  starterQueries,
  form,
  references,
  selectedReference,
  onQueryChange,
  onFormChange,
  onAdd,
  onSelect,
  onDelete,
  onCopy,
  onCreate,
  onSaveIdea,
}) {
  const activeSource = sourceFromId(form.sourceId)
  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">Creative Radar</div>
          <h1>สำรวจตลาด เก็บ Reference แล้วถอดเป็นภาษาภาพของ AssetX</h1>
          <p>ใช้แหล่งจริงเพื่อดู pattern ของโฆษณา/ภาพ/วิดีโอ แล้วบันทึกเฉพาะ insight ที่นำมาสร้างงานใหม่ได้อย่างปลอดภัย</p>
        </div>
      </div>

      <div className="mx-reference-hero">
        <div className="mx-reference-search">
          <label>
            คำค้นสำหรับสำรวจ
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="เช่น ขายฝาก โฉนด ที่ดิน เงินก้อน" />
          </label>
          <div className="mx-query-chips">
            {starterQueries.map((item) => (
              <button key={item} onClick={() => onQueryChange(item)}>{item}</button>
            ))}
          </div>
        </div>
        <div className="mx-source-grid">
          {sources.map((source) => (
            <a className="mx-source-card" key={source.id} href={source.searchUrl(query)} target="_blank" rel="noreferrer">
              <span>{source.type}</span>
              <strong>{source.name}</strong>
              <p>{source.strength}</p>
              <em>เปิดแหล่งสำรวจ</em>
            </a>
          ))}
        </div>
      </div>

      <div className="mx-reference-layout">
        <article className="mx-reference-form">
          <div className="mx-section-head">
            <div>
              <div className="mx-kicker">Reference Vault</div>
              <h2>บันทึกสิ่งที่เจอจากตลาด</h2>
            </div>
            <a className="mx-mini-button" href={activeSource.searchUrl(query)} target="_blank" rel="noreferrer">เปิด {activeSource.name}</a>
          </div>
          <label>
            หัวข้อ / ชื่อ reference
            <input value={form.title} onChange={(event) => onFormChange({ title: event.target.value })} placeholder="เช่น Hook โฆษณาเจ้าของที่ดินต้องการเงินก้อน" />
          </label>
          <label>
            URL แหล่งที่มา
            <input value={form.url} onChange={(event) => onFormChange({ url: event.target.value })} placeholder="วางลิงก์โฆษณา ข่าว หรือหน้า reference" />
          </label>
          <div className="mx-form-grid">
            <label>
              แหล่งข้อมูล
              <select value={form.sourceId} onChange={(event) => onFormChange({ sourceId: event.target.value })}>
                {sources.map((source) => <option value={source.id} key={source.id}>{source.name}</option>)}
              </select>
            </label>
            <label>
              ความเสี่ยง
              <select value={form.risk} onChange={(event) => onFormChange({ risk: event.target.value })}>
                <option value="low">ต่ำ ใช้เป็นแรงบันดาลใจได้</option>
                <option value="medium">กลาง ต้องปรับภาษา/ภาพ</option>
                <option value="high">สูง ห้ามใกล้เคียงต้นฉบับ</option>
              </select>
            </label>
          </div>
          <div className="mx-form-grid">
            <label>
              กลุ่มเป้าหมาย
              <input value={form.audience} onChange={(event) => onFormChange({ audience: event.target.value })} />
            </label>
            <label>
              ช่องทาง
              <input value={form.channel} onChange={(event) => onFormChange({ channel: event.target.value })} />
            </label>
          </div>
          <label>
            Hook ที่น่าสนใจ
            <textarea value={form.hook} onChange={(event) => onFormChange({ hook: event.target.value })} placeholder="ประโยคเปิด / pain point / คำถามที่ดึงความสนใจ" />
          </label>
          <label>
            Pattern ภาพหรือวิดีโอ
            <textarea value={form.visualPattern} onChange={(event) => onFormChange({ visualPattern: event.target.value })} placeholder="เช่น โต๊ะเอกสาร โฉนดถูกปิดข้อมูล แผนที่ แสงธรรมชาติ โทนพรีเมี่ยม" />
          </label>
          <label>
            Angle ที่ควรทำในแบบ AssetX
            <textarea value={form.contentAngle} onChange={(event) => onFormChange({ contentAngle: event.target.value })} placeholder="แปลงเป็นแนวคิดของเรา ไม่ลอกข้อความเดิม" />
          </label>
          <label>
            Tags
            <input value={form.tags} onChange={(event) => onFormChange({ tags: event.target.value })} placeholder="ขายฝาก, โฉนด, นักลงทุน" />
          </label>
          <label>
            หมายเหตุ
            <textarea value={form.notes} onChange={(event) => onFormChange({ notes: event.target.value })} placeholder="ข้อควรระวัง หรือสิ่งที่อยากลองกับแบรนด์เรา" />
          </label>
          <button className="mx-primary" onClick={onAdd}>บันทึก Reference</button>
        </article>

        <div className="mx-reference-side">
          <article className="mx-pattern-panel">
            <div className="mx-kicker">Pattern Extractor</div>
            <h2>{selectedReference ? selectedReference.title : 'ยังไม่มี reference ที่เลือก'}</h2>
            {selectedReference ? (
              <>
                <div className="mx-reference-meta">
                  <span>{sourceFromId(selectedReference.sourceId).name}</span>
                  {selectedReference.url && <span>{hostFromUrl(selectedReference.url)}</span>}
                  <span className={`risk-${selectedReference.risk}`}>{selectedReference.risk === 'high' ? 'เสี่ยงสูง' : selectedReference.risk === 'low' ? 'เสี่ยงต่ำ' : 'เสี่ยงกลาง'}</span>
                </div>
                <ContentBlock title="Brief พร้อมใช้" value={buildReferenceBrief(selectedReference)} onCopy={() => onCopy(selectedReference)} collapsed />
                <div className="mx-card-actions">
                  <button className="mx-primary" onClick={() => onCreate(selectedReference)}>ส่งเข้า Studio</button>
                  <button className="mx-secondary" onClick={() => onSaveIdea(selectedReference)}>เก็บเป็นไอเดีย</button>
                  {selectedReference.url && <a className="mx-secondary as-link" href={selectedReference.url} target="_blank" rel="noreferrer">อ่านต้นทาง</a>}
                </div>
              </>
            ) : (
              <p>เริ่มจากเปิดแหล่งสำรวจด้านบน แล้วบันทึก reference แรกเพื่อให้ระบบถอด brief ให้</p>
            )}
          </article>

          <div className="mx-reference-list">
            {references.length === 0 && <div className="mx-empty">ยังไม่มี reference ในคลัง ลองเปิด Meta Ads Library หรือ TikTok Creative Center แล้วบันทึก insight แรกเข้ามาได้เลย</div>}
            {references.map((reference) => (
              <article className={`mx-reference-item ${selectedReference?.id === reference.id ? 'active' : ''}`} key={reference.id}>
                <button onClick={() => onSelect(reference.id)}>
                  <span>{sourceFromId(reference.sourceId).name}</span>
                  <strong>{reference.title}</strong>
                  <p>{reference.contentAngle || reference.hook || reference.visualPattern || 'ยังไม่ได้ถอด pattern'}</p>
                </button>
                <div className="mx-reference-tags">
                  {(reference.tags || []).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <div className="mx-card-actions">
                  <button className="mx-mini-button" onClick={() => onCreate(reference)}>ทำคอนเทนต์</button>
                  <button className="mx-mini-button" onClick={() => onCopy(reference)}>คัดลอก brief</button>
                  <button className="mx-mini-button danger" onClick={() => onDelete(reference.id)}>ลบ</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function IdeasView({
  ideas,
  showAll,
  total,
  radarCount,
  radarLoading,
  manualIdea,
  onManualChange,
  onAddManual,
  onToggle,
  onCreate,
  onSaveIdea,
  onLoadRadar,
}) {
  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">ไอเดียวันนี้</div>
          <h1>เลือกหัวข้อที่ควรทำก่อน แล้วให้ AssetX จัดแพ็กคอนเทนต์</h1>
          <p>ข้อมูลเราเอง 6 หัวข้อ · Trend Radar {radarCount} หัวข้อ · เรียงจากความสำคัญและโอกาสสร้าง lead</p>
        </div>
        <div className="mx-page-actions">
          <button className="mx-secondary" onClick={onLoadRadar} disabled={radarLoading}>{radarLoading ? 'กำลังสำรวจ...' : 'สำรวจตลาดด้วย Tavily'}</button>
          <button className="mx-secondary" onClick={onToggle}>{showAll ? 'แสดงเฉพาะตัวเด่น' : `ดูเพิ่ม (${Math.max(0, total - ideas.length)})`}</button>
        </div>
      </div>
      <div className="mx-manual">
        <input value={manualIdea} onChange={(event) => onManualChange(event.target.value)} placeholder="เพิ่มไอเดียเอง เช่น ทำคอนเทนต์เจ้าของที่ดินต้องการเงินก้อน" />
        <button onClick={onAddManual} disabled={!manualIdea.trim()}>เก็บไว้และเริ่มร่าง</button>
      </div>
      <div className="mx-idea-grid">
        {ideas.map((idea) => (
          <article className="mx-idea-card" key={idea.id}>
            <div className="mx-idea-top"><span>{idea.type}</span><strong>คะแนน {idea.score}</strong></div>
            <h2>
              {idea.url ? (
                <a className="mx-idea-title-link" href={idea.url} target="_blank" rel="noreferrer">
                  {idea.title}
                </a>
              ) : idea.title}
            </h2>
            <p>{idea.angle}</p>
            <div className="mx-tags">
              <span>{idea.source}</span>
              <span>{idea.audience}</span>
              <span>{idea.status}</span>
              {idea.url && <a href={idea.url} target="_blank" rel="noreferrer">เปิดแหล่งข่าว</a>}
            </div>
            <div className="mx-card-actions">
              <button className="mx-primary" onClick={() => onCreate(idea.title, idea)}>เริ่มทำคอนเทนต์</button>
              <button className="mx-ghost" onClick={() => onSaveIdea(idea)}>เก็บไว้ก่อน</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function StudioView({ studio, generated, onPromptChange, onGenerate, onQueue, onCopy }) {
  return (
    <section className="mx-content mx-studio">
      <div className="mx-stepper">
        {['หัวข้อ', 'คอนเทนต์', 'เลือกภาพ', 'ตั้งเวลา', 'โพสต์'].map((step, index) => (
          <div className={`mx-step ${index < (generated ? 2 : 1) ? 'active' : ''}`} key={step}>
            <span>{index + 1}</span>{step}
          </div>
        ))}
      </div>
      <div className="mx-page-head compact">
        <div>
          <div className="mx-kicker">สร้างโพสต์ใหม่</div>
          <h1>เริ่มจากหัวข้อเดียว แล้วให้ AssetX ร่างแคปชั่น ภาพ และสคริปต์</h1>
        </div>
      </div>
      <div className="mx-prompt-box">
        <textarea value={studio.prompt} onChange={(event) => onPromptChange(event.target.value)} placeholder="พิมพ์หัวข้อที่อยากโพสต์ เช่น เจ้าของที่ดินต้องการเงินก่อน แต่ไม่อยากขายขาด" />
        <button className="mx-primary" onClick={onGenerate}>สร้างโพสต์</button>
      </div>
      <div className="mx-model-note">ใช้ template fallback ของ AssetX เป็นหลัก เพื่อประหยัดเครดิต แล้วค่อยต่อ AI เมื่อต้องการร่างละเอียด</div>
      {generated && (
        <div className="mx-generated-grid">
          <article className="mx-review-card wide">
            <div className="mx-review-head">
              <div><div className="mx-kicker">คอนเทนต์พร้อมตรวจ</div><h2>{generated.headline}</h2></div>
              <span className="mx-pass">Quality {generated.meta?.captionQuality?.score ?? '-'}%</span>
            </div>
            <ContentBlock title="แคปชั่น" value={generated.caption} onCopy={() => onCopy(generated.caption)} />
            <ContentBlock title="บรีฟภาพ" value={generated.imagePrompt} onCopy={() => onCopy(generated.imagePrompt)} collapsed />
            <ContentBlock title="สคริปต์วิดีโอ" value={generated.videoScript} onCopy={() => onCopy(generated.videoScript)} collapsed />
            <div className="mx-card-actions end">
              <button className="mx-primary" onClick={() => onQueue('pending')}>ส่งรออนุมัติ</button>
              <button className="mx-secondary" onClick={() => onQueue('approved')}>อนุมัติไว้ก่อน</button>
            </div>
          </article>
          <aside className="mx-preview">
            <div className="mx-preview-poster"><span>AssetX</span><strong>{generated.headline}</strong><small>Real Estate Marketing</small></div>
          </aside>
        </div>
      )}
    </section>
  )
}

function ApprovalsView({ drafts, selected, onSelect, onUpdate, onCopy }) {
  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">รออนุมัติ</div>
          <h1>ตรวจโพสต์ก่อนนำไปใช้จริง</h1>
          <p>ผ่าน — โพสต์ได้เลย · {drafts.filter((post) => post.reviewStatus === 'passed').length} / ควรแก้ก่อนโพสต์ · {drafts.filter((post) => post.reviewStatus !== 'passed').length}</p>
        </div>
      </div>
      <div className="mx-approval-layout">
        <div className="mx-draft-list">
          {drafts.map((post) => (
            <button className={`mx-draft-item ${selected?.id === post.id ? 'active' : ''}`} key={post.id} onClick={() => onSelect(post.id)}>
              <strong>{post.title}</strong><span>{post.channel} · {post.reviewStatus === 'passed' ? 'ผ่าน' : 'ควรแก้'}</span>
            </button>
          ))}
        </div>
        {selected ? (
          <article className="mx-review-card">
            <div className="mx-review-head">
              <div><div className="mx-kicker">#{selected.id} · {selected.channel}</div><h2>{selected.title}</h2></div>
              <span className={selected.reviewStatus === 'passed' ? 'mx-pass' : 'mx-warn'}>{selected.reviewStatus === 'passed' ? 'ผ่าน' : 'ควรแก้'}</span>
            </div>
            <div className="mx-image-tools"><button>บรีฟทำรูป</button><button>ตรวจตัวอักษร</button><button>เทมเพลตแบรนด์</button></div>
            <div className="mx-content-block">
              <div className="mx-content-title">
                <span>โพสต์</span>
                <button onClick={() => onCopy(selected.caption)}>คัดลอก</button>
              </div>
              <textarea
                className="mx-edit-caption"
                value={selected.caption}
                onChange={(event) => onUpdate(selected.id, { caption: event.target.value })}
              />
            </div>
            <ContentBlock title="บรีฟภาพ" value={selected.imagePrompt} onCopy={() => onCopy(selected.imagePrompt)} collapsed />
            <div className="mx-schedule-row">
              <label>
                วันที่จะโพสต์
                <input
                  type="date"
                  value={selected.scheduledAt || ''}
                  onChange={(event) => onUpdate(selected.id, { scheduledAt: event.target.value, status: event.target.value ? 'scheduled' : selected.status }, event.target.value ? 'ตั้งวันโพสต์แล้ว' : 'ล้างวันโพสต์แล้ว')}
                />
              </label>
              {selected.scheduledAt && <span>จองไว้วันที่ {selected.scheduledAt}</span>}
            </div>
            <div className="mx-review-notes">
              <strong>ผลตรวจ</strong>
              {selected.reviewNotes?.map((note, index) => <span key={index}>{note}</span>)}
            </div>
            <div className="mx-card-actions end">
              <button className="mx-primary" onClick={() => onUpdate(selected.id, { status: selected.scheduledAt ? 'scheduled' : 'approved', reviewStatus: 'passed' }, selected.scheduledAt ? 'อนุมัติและเข้าปฏิทินแล้ว' : 'อนุมัติแล้ว')}>อนุมัติ</button>
              <button className="mx-secondary" onClick={() => onUpdate(selected.id, { status: 'needs_edit', reviewStatus: 'needs_edit' }, 'ส่งกลับแก้แล้ว')}>ส่งกลับแก้</button>
              <button className="mx-ghost" onClick={() => onUpdate(selected.id, { status: 'draft' }, 'พักโพสต์ไว้ก่อนแล้ว')}>พักไว้ก่อน</button>
            </div>
          </article>
        ) : <div className="mx-empty">ยังไม่มีโพสต์รอตรวจ</div>}
      </div>
    </section>
  )
}

function QueueView({ posts, onCreate, onUpdate }) {
  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">รอโพสต์</div>
          <h1>คิวโพสต์ที่ผ่านการอนุมัติแล้ว</h1>
          <p>ระยะแรกใช้แบบ manual-first: คัดลอกไปโพสต์เอง แล้วกดว่าโพสต์แล้วเพื่อเก็บผล</p>
        </div>
        <button className="mx-secondary" onClick={onCreate}>หาไอเดียเพิ่ม</button>
      </div>
      <div className="mx-list">
        {posts.length === 0 && <div className="mx-empty">ไม่มีอะไรรอโพสต์ อนุมัติคอนเทนต์จากหน้า รออนุมัติ แล้วจะมาโผล่ที่นี่</div>}
        {posts.map((post) => (
          <article className="mx-row-card" key={post.id}>
            <div><strong>{post.title}</strong><span>{post.channel} · {post.source || 'AssetX Studio'}{post.scheduledAt ? ` · จอง ${post.scheduledAt}` : ''}</span></div>
            <div className="mx-row-actions">
              <input
                type="date"
                value={post.scheduledAt || ''}
                onChange={(event) => onUpdate(post.id, { scheduledAt: event.target.value, status: event.target.value ? 'scheduled' : 'approved' }, event.target.value ? 'ตั้งวันโพสต์แล้ว' : 'ล้างวันโพสต์แล้ว')}
              />
              <button className="mx-primary" onClick={() => onUpdate(post.id, { status: 'posted', postedAt: new Date().toISOString() }, 'บันทึกว่าโพสต์แล้ว')}>โพสต์แล้ว</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function GalleryView({
  drafts,
  generated,
  mediaLoading,
  mediaResult,
  visualStyles,
  visualStyleId,
  onVisualStyleChange,
  onCopy,
  onGenerateImage,
  onGenerateVideo,
}) {
  const briefs = [
    ...(generated ? [{
      id: 'generated',
      title: generated.headline,
      imagePrompt: generated.imagePrompt,
      videoScript: generated.videoScript,
      source: 'โพสต์ที่กำลังร่าง',
    }] : []),
    ...drafts.filter((post) => post.imagePrompt).map((post) => ({
      id: post.id,
      title: post.title,
      imagePrompt: post.imagePrompt,
      videoScript: post.videoScript,
      source: post.channel || 'AssetX',
    })),
  ]
  const selectedStyle = visualStyles.find((style) => style.id === visualStyleId) || visualStyles[0]
  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">ห้องภาพ</div>
          <h1>สร้างภาพและวิดีโอจากบรีฟคอนเทนต์</h1>
          <p>ใช้ Gemini ฝั่ง server เพื่อสร้างรูป/วิดีโอจริง โดยไม่ส่ง API key ไปฝั่งเว็บ และยังห้ามใส่ข้อมูลส่วนตัวในภาพ</p>
        </div>
      </div>
      <div className="mx-visual-system">
        <div className="mx-visual-copy">
          <div className="mx-kicker">AssetX Visual System</div>
          <h2>โทนภาพหลัก: สมจริง พรีเมี่ยม น่าเชื่อถือ</h2>
          <p>ใช้ reference เป็นแรงบันดาลใจได้ แต่ผลลัพธ์ต้องเป็นภาพใหม่ในภาษาภาพของ AssetX: สะอาด โปร่ง ข้อมูลครบแต่ไม่เปิดเผยข้อมูลลูกค้า และไม่มีข้อความไทยฝังในภาพ</p>
          <div className="mx-workflow-steps">
            <span>1 เลือกบรีฟ</span>
            <span>2 เลือกสไตล์</span>
            <span>3 สร้างภาพ/วิดีโอ</span>
            <span>4 ตรวจความเสี่ยง</span>
            <span>5 ดาวน์โหลดไปใช้</span>
          </div>
        </div>
        <div className="mx-style-grid">
          {visualStyles.map((style) => (
            <button className={`mx-style-card ${style.id === visualStyleId ? 'active' : ''}`} key={style.id} onClick={() => onVisualStyleChange(style.id)}>
              <span>{style.badge}</span>
              <strong>{style.name}</strong>
              <em>{style.description}</em>
            </button>
          ))}
        </div>
      </div>
      {mediaResult && (
        <article className="mx-media-result">
          <div>
            <div className="mx-kicker">ผลลัพธ์ล่าสุด · {mediaResult.model}</div>
            <h2>{mediaResult.title}</h2>
          </div>
          {mediaResult.type === 'prompt' ? (
            <>
              <div className="mx-quota-note">
                โควต้า Gemini ยังไม่พร้อมสร้างไฟล์จริง ระบบเตรียม prompt แบบครบกฎแบรนด์ไว้ให้แล้ว สามารถคัดลอกไปใช้กับเครื่องมืออื่น เช่น Firefly, Midjourney, Runway หรือกลับมาลองใหม่หลัง quota พร้อม
              </div>
              <pre className="mx-fallback-prompt">{mediaResult.prompt}</pre>
              <button className="mx-primary media-download" onClick={() => onCopy(mediaResult.prompt)}>คัดลอก Prompt</button>
            </>
          ) : (
            <>
              {mediaResult.type === 'video'
                ? <video src={mediaResult.dataUrl} controls playsInline />
                : <img src={mediaResult.dataUrl} alt={mediaResult.title} />}
              <a className="mx-primary media-download" href={mediaResult.dataUrl} download={`assetx-${mediaResult.type}-${mediaResult.id}.${mediaResult.type === 'video' ? 'mp4' : 'jpg'}`}>ดาวน์โหลด</a>
            </>
          )}
        </article>
      )}
      <div className="mx-brief-grid">
        {briefs.map((brief) => (
          <article className="mx-brief-card" key={brief.id}>
            <div className="mx-preview-poster compact"><span>{selectedStyle.name}</span><strong>{brief.title}</strong><small>{brief.source}</small></div>
            <div>
              <strong>{brief.title}</strong>
              <p>{brief.imagePrompt}</p>
              <div className="mx-visual-note">
                <span>Style</span>
                <p>{selectedStyle.scenes}</p>
              </div>
            </div>
            <div className="mx-card-actions">
              <button className="mx-primary" onClick={() => onGenerateImage(brief)} disabled={mediaLoading === `image:${brief.id}`}>
                {mediaLoading === `image:${brief.id}` ? 'กำลังสร้างรูป...' : 'สร้างรูปจริง'}
              </button>
              <button className="mx-secondary" onClick={() => onGenerateVideo(brief)} disabled={mediaLoading === `video:${brief.id}`}>
                {mediaLoading === `video:${brief.id}` ? 'กำลังสร้างวิดีโอ...' : 'สร้างวิดีโอ 9:16'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function BrandBrainView() {
  const rules = [
    ['น้ำเสียง', 'น่าเชื่อถือ ตรงไปตรงมา สุภาพ และอธิบายข้อดีข้อเสียให้ครบก่อนชวนตัดสินใจ'],
    ['ห้ามใช้', 'อนุมัติแน่นอน · ได้เงินทันทีทุกเคส · กำไรแน่นอน · ราคาขึ้นแน่นอน · ไม่ต้องตรวจเอกสาร'],
    ['ต้องมีเมื่อพูดเรื่องกฎหมาย', 'ข้อมูลนี้เป็นข้อมูลทั่วไป ไม่ใช่คำปรึกษากฎหมายเฉพาะกรณี'],
    ['ต้องระวังข้อมูลส่วนตัว', 'ห้ามเปิดเผยชื่อ เบอร์โทร เลขโฉนด ที่อยู่ หรือรายละเอียดลูกค้าจริงในโพสต์สาธารณะ'],
    ['ภาพประกอบ', 'ใช้ภาพโฉนด/แผนที่/ทีมงาน/ทรัพย์แบบไม่เห็นข้อมูลส่วนตัว และไม่ให้โมเดลเขียนข้อความไทยบนภาพโดยตรง'],
  ]
  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">Brand Brain</div>
          <h1>กติกาแบรนด์สำหรับคอนเทนต์ AssetX Estate</h1>
          <p>ใช้เป็นสมองกลางให้ทุกโพสต์คุมโทน ความเสี่ยง และความน่าเชื่อถือไปในทิศทางเดียวกัน</p>
        </div>
      </div>
      <div className="mx-brand-grid">
        {rules.map(([title, detail]) => (
          <article className="mx-brand-rule" key={title}>
            <strong>{title}</strong>
            <p>{detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function LibraryView({
  posts,
  savedIdeas,
  filter,
  sort,
  previewChannel,
  onFilterChange,
  onSortChange,
  onPreviewChannelChange,
  onCreate,
  onArchive,
  onRestore,
  onDelete,
  onDeleteSavedIdea,
}) {
  const filteredPosts = posts
    .filter((post) => {
      if (filter === 'all') return true
      if (filter === 'active') return post.status !== 'archived' && post.status !== 'posted'
      if (filter === 'needs_edit') return post.status === 'needs_edit' || post.reviewStatus === 'needs_edit'
      return post.status === filter
    })
    .sort((a, b) => {
      if (sort === 'oldest') return getPostTime(a) - getPostTime(b)
      if (sort === 'channel') return String(a.channel || '').localeCompare(String(b.channel || ''), 'th')
      if (sort === 'status') return String(a.status || '').localeCompare(String(b.status || ''), 'th')
      return getPostTime(b) - getPostTime(a)
    })
  const previewPost = filteredPosts[0] || posts[0]
  const previewText = buildChannelPreview(previewPost, previewChannel)

  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">ผลงานทั้งหมด</div>
          <h1>รวมโพสต์ที่ร่างแล้วและไอเดียที่เก็บไว้</h1>
          <p>จัดระเบียบงานก่อนต่อ Supabase จริงในรอบถัดไป: กรองสถานะ พักงาน ลบงาน และดูตัวอย่างแต่ละช่องทาง</p>
        </div>
      </div>
      <div className="mx-filter-bar">
        <label>
          สถานะ
          <select value={filter} onChange={(event) => onFilterChange(event.target.value)}>
            <option value="active">งานที่ยังใช้ต่อ</option>
            <option value="all">ทั้งหมด</option>
            <option value="draft">ร่าง</option>
            <option value="pending">รอตรวจ</option>
            <option value="needs_edit">ควรแก้</option>
            <option value="approved">อนุมัติแล้ว</option>
            <option value="scheduled">จองวันแล้ว</option>
            <option value="posted">โพสต์แล้ว</option>
            <option value="archived">พักไว้</option>
          </select>
        </label>
        <label>
          เรียงตาม
          <select value={sort} onChange={(event) => onSortChange(event.target.value)}>
            <option value="newest">ล่าสุดก่อน</option>
            <option value="oldest">เก่าก่อน</option>
            <option value="status">สถานะ</option>
            <option value="channel">ช่องทาง</option>
          </select>
        </label>
        <label>
          พรีวิว
          <select value={previewChannel} onChange={(event) => onPreviewChannelChange(event.target.value)}>
            <option value="facebook">Facebook</option>
            <option value="line">LINE OA</option>
            <option value="tiktok">TikTok / Reels</option>
          </select>
        </label>
      </div>
      <div className="mx-library-split">
        <div className="mx-list">
          <div className="mx-library-head">
            <h2 className="mx-section-title">โพสต์ / ร่างคอนเทนต์</h2>
            <span>{filteredPosts.length} รายการ</span>
          </div>
          {filteredPosts.length === 0 && <div className="mx-empty">ไม่พบโพสต์ในตัวกรองนี้ ลองเปลี่ยนสถานะด้านบน</div>}
          {filteredPosts.map((post) => (
            <article className={`mx-row-card ${post.status === 'archived' ? 'muted' : ''}`} key={post.id}>
              <div>
                <strong>{post.title}</strong>
                <span>{post.channel} · {statusLabels[post.status] || post.status} · {post.source || 'AssetX Studio'}</span>
              </div>
              <div className="mx-post-actions">
                <span className={post.reviewStatus === 'passed' ? 'mx-pass' : 'mx-warn'}>{post.reviewStatus === 'passed' ? 'ผ่าน' : 'ควรแก้'}</span>
                {post.status === 'archived'
                  ? <button className="mx-mini-button" onClick={() => onRestore(post.id)}>กู้คืน</button>
                  : <button className="mx-mini-button" onClick={() => onArchive(post.id)}>พักไว้</button>}
                <button className="mx-mini-button danger" onClick={() => onDelete(post.id)}>ลบ</button>
              </div>
            </article>
          ))}
        </div>
        <div className="mx-list">
          <article className="mx-channel-preview">
            <div className="mx-library-head">
              <h2 className="mx-section-title">ตัวอย่างช่องทาง</h2>
              <span>{previewChannel === 'facebook' ? 'Facebook' : previewChannel === 'line' ? 'LINE OA' : 'TikTok / Reels'}</span>
            </div>
            <div className={`mx-preview-box ${previewChannel}`}>
              <strong>{previewPost?.title || 'ยังไม่มีโพสต์'}</strong>
              <pre>{previewText}</pre>
            </div>
          </article>
          <h2 className="mx-section-title">ไอเดียที่เก็บไว้</h2>
          {savedIdeas.length === 0 && <div className="mx-empty">ยังไม่มีไอเดียที่เก็บไว้ กด “เก็บไว้ก่อน” จากหน้าไอเดียวันนี้เพื่อสะสมหัวข้อ</div>}
          {savedIdeas.map((idea) => (
            <article className="mx-row-card" key={idea.id}>
              <div><strong>{idea.title}</strong><span>{idea.source} · คะแนน {idea.score}</span></div>
              <div className="mx-post-actions">
                <button className="mx-primary" onClick={() => onCreate(idea.title, idea)}>เริ่มทำ</button>
                <button className="mx-mini-button danger" onClick={() => onDeleteSavedIdea(idea.id)}>ลบ</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function CalendarView({ posts = [] }) {
  const days = Array.from({ length: 30 }, (_, index) => index + 1)
  const planned = { 3: 'ความรู้', 7: 'Lead', 12: 'ทรัพย์', 18: 'นักลงทุน', 24: 'Reels' }
  const postsByDay = posts.reduce((acc, post) => {
    const rawDate = post.scheduledAt || post.postedAt || ''
    const day = Number(String(rawDate).slice(8, 10))
    if (!day || day < 1 || day > 30) return acc
    acc[day] = [...(acc[day] || []), post]
    return acc
  }, {})
  return (
    <section className="mx-content">
      <div className="mx-page-head"><div><div className="mx-kicker">ปฏิทินโพสต์</div><h1>กันยายน 2569</h1><p>โพสต์แล้ว · จองวันไว้ · ยังไม่กำหนดวัน</p></div></div>
      <div className="mx-calendar">
        {days.map((day) => (
          <div className={`mx-day ${planned[day] || postsByDay[day]?.length ? 'has' : ''}`} key={day}>
            <strong>{day}</strong>
            {planned[day] && <span>{planned[day]}</span>}
            {postsByDay[day]?.map((post) => (
              <div className="mx-calendar-item" key={post.id}>{post.title}</div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

function MetricsView({ metrics, form, onFormChange, onAdd, onDelete }) {
  const totals = metrics.reduce((acc, item) => ({
    leads: acc.leads + (Number(item.leads) || 0),
    qualified: acc.qualified + (Number(item.qualified) || 0),
    appointments: acc.appointments + (Number(item.appointments) || 0),
  }), { leads: 0, qualified: 0, appointments: 0 })
  const leadToAppointment = totals.leads ? Math.round((totals.appointments / totals.leads) * 100) : 0
  const barData = metrics.slice(0, 12).reverse()
  const maxLeads = Math.max(1, ...barData.map((item) => Number(item.leads) || 0))

  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div><div className="mx-kicker">ตัวเลข</div><h1>วัดผลการตลาดจาก lead และเคสประเมิน</h1><p>เริ่มจากการกรอกสถานะโพสต์เองก่อน แล้วค่อยต่อ Meta/LINE/TikTok API ในระยะถัดไป</p></div>
        <div className="mx-range"><button>7 วัน</button><button>14 วัน</button><button>30 วัน</button></div>
      </div>
      <div className="mx-metric-grid">
        <MetricCard label="Lead ใหม่" value={totals.leads} delta={`${metrics.length} โพสต์`} />
        <MetricCard label="Lead คุณภาพ" value={totals.qualified} delta="จากที่กรอกเอง" />
        <MetricCard label="นัดหมาย" value={totals.appointments} delta={`${leadToAppointment}% ของ lead`} />
        <MetricCard label="โพสต์ที่บันทึกผล" value={metrics.length} delta="manual tracking" />
      </div>
      <div className="mx-metrics-layout">
        <article className="mx-metric-form">
          <h2 className="mx-section-title">บันทึกผลโพสต์</h2>
          <label>ชื่อโพสต์ / แคมเปญ<input value={form.title} onChange={(event) => onFormChange({ ...form, title: event.target.value })} placeholder="เช่น ขายฝากกับจำนองต่างกันอย่างไร" /></label>
          <label>ช่องทาง<select value={form.channel} onChange={(event) => onFormChange({ ...form, channel: event.target.value })}><option>Facebook</option><option>LINE OA</option><option>TikTok / Reels</option><option>Website</option></select></label>
          <div className="mx-metric-inputs">
            <label>Lead<input type="number" min="0" value={form.leads} onChange={(event) => onFormChange({ ...form, leads: event.target.value })} /></label>
            <label>คุณภาพ<input type="number" min="0" value={form.qualified} onChange={(event) => onFormChange({ ...form, qualified: event.target.value })} /></label>
            <label>นัดหมาย<input type="number" min="0" value={form.appointments} onChange={(event) => onFormChange({ ...form, appointments: event.target.value })} /></label>
          </div>
          <label>หมายเหตุ<textarea value={form.notes} onChange={(event) => onFormChange({ ...form, notes: event.target.value })} placeholder="เช่น ได้ lead จากเจ้าของที่ดิน 2 ราย / คำถามเรื่องขายฝากเยอะ" /></label>
          <button className="mx-primary" onClick={onAdd}>บันทึกผล</button>
        </article>
        <div className="mx-list">
          <h2 className="mx-section-title">ผลลัพธ์ล่าสุด</h2>
          {metrics.length === 0 && <div className="mx-empty">ยังไม่มีข้อมูลผลโพสต์ ลองบันทึกจากโพสต์ที่ลงจริงแล้วเพื่อดูแนวโน้ม lead</div>}
          {metrics.map((item) => (
            <article className="mx-row-card" key={item.id}>
              <div><strong>{item.title}</strong><span>{item.channel} · Lead {item.leads} · คุณภาพ {item.qualified} · นัด {item.appointments}</span></div>
              <button className="mx-mini-button danger" onClick={() => onDelete(item.id)}>ลบ</button>
            </article>
          ))}
        </div>
      </div>
      <div className="mx-chart-card">
        <div className="mx-bars">{(barData.length ? barData : [{ leads: 1 }]).map((item, index) => <span title={item.title || 'ยังไม่มีข้อมูล'} style={{ height: `${Math.max(8, ((Number(item.leads) || 0) / maxLeads) * 100)}%` }} key={item.id || index} />)}</div>
        <p>จุดนี้จะใช้ overlay วันที่โพสต์กับจำนวน lead เพื่อดูว่าคอนเทนต์ไหนช่วยขยับผลลัพธ์จริง</p>
      </div>
    </section>
  )
}

function PipelineView() {
  return (
    <section className="mx-content">
      <div className="mx-page-head"><div><div className="mx-kicker">สายพานการผลิต</div><h1>สถานะงานอัตโนมัติของการตลาด</h1><p>ช่วยให้เห็นว่า Hermes, Tavily และโมเดลคอนเทนต์กำลังทำอะไรอยู่</p></div></div>
      <div className="mx-pipeline">
        {pipelineJobs.map(([name, status, detail]) => <article className="mx-pipe-card" key={name}><div><strong>{name}</strong><span>{detail}</span></div><em>{status}</em></article>)}
      </div>
    </section>
  )
}

function InboxView({ onCopy, onCreate }) {
  const [activeId, setActiveId] = useState(inboxCases[0]?.id)
  const selected = inboxCases.find((item) => item.id === activeId) || inboxCases[0]
  const riskClass = selected.risk === 'สูง' ? 'high' : selected.risk === 'กลาง' ? 'medium' : 'low'

  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">ตอบคอมเมนต์ เฟส 3</div>
          <h1>กล่องข้อความสำหรับเคสที่ AI ตอบเองไม่ได้</h1>
          <p>ตอนนี้เป็น workflow จำลองสำหรับทีมตอบแชท: แยกความเสี่ยง ร่างคำตอบ และส่งหัวข้อกลับไปทำคอนเทนต์ได้</p>
        </div>
      </div>
      <div className="mx-inbox-layout">
        <div className="mx-inbox-list">
          {inboxCases.map((item) => (
            <button className={`mx-inbox-item ${item.id === activeId ? 'active' : ''}`} key={item.id} onClick={() => setActiveId(item.id)}>
              <div><strong>{item.intent}</strong><span>{item.source}</span></div>
              <em className={`risk-${item.risk === 'สูง' ? 'high' : item.risk === 'กลาง' ? 'medium' : 'low'}`}>{item.risk}</em>
              <p>{item.question}</p>
            </button>
          ))}
        </div>
        <article className="mx-inbox-detail">
          <div className="mx-review-head">
            <div>
              <div className="mx-kicker">{selected.source} · {selected.intent}</div>
              <h2>{selected.question}</h2>
            </div>
            <span className={`mx-risk ${riskClass}`}>ความเสี่ยง{selected.risk}</span>
          </div>
          <div className="mx-inbox-meta">
            <span>สถานะ: {selected.action}</span>
            <span>กติกา: ห้ามฟันธงวงเงิน/ผลทางกฎหมายเฉพาะเคส</span>
          </div>
          <ContentBlock title="ร่างคำตอบที่ปลอดภัย" value={selected.suggestedReply} onCopy={() => onCopy(selected.suggestedReply)} />
          <div className="mx-card-actions end">
            <button className="mx-primary" onClick={() => onCopy(selected.suggestedReply)}>คัดลอกคำตอบ</button>
            <button className="mx-secondary" onClick={() => onCreate(`ทำคอนเทนต์ตอบคำถาม: ${selected.question}`, {
              audience: selected.intent,
              angle: selected.question,
              channel: selected.source.includes('LINE') ? 'LINE OA' : 'Facebook',
            })}>ทำเป็นโพสต์</button>
          </div>
        </article>
      </div>
    </section>
  )
}

function NavSection({ title, children }) {
  return <div className="mx-nav-section"><div className="mx-nav-title">{title}</div>{children}</div>
}

function NavButton({ label, count, active, onClick }) {
  return (
    <button className={`mx-nav ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="mx-nav-dot" /><span>{label}</span>{typeof count === 'number' && <strong>{count}</strong>}
    </button>
  )
}

function MetricLine({ label, value }) {
  return <div className="mx-metric-line"><span>{label}</span><strong>{value}</strong></div>
}

function MetricCard({ label, value, delta }) {
  return <div className="mx-metric-card"><span>{label}</span><strong>{value}</strong><em>{delta}</em></div>
}

function ContentBlock({ title, value, onCopy, collapsed }) {
  if (collapsed) {
    return (
      <details className="mx-content-block">
        <summary><span>{title}</span><button onClick={(event) => { event.preventDefault(); onCopy() }}>คัดลอก</button></summary>
        <pre>{value}</pre>
      </details>
    )
  }
  return (
    <div className="mx-content-block">
      <div className="mx-content-title"><span>{title}</span><button onClick={onCopy}>คัดลอก</button></div>
      <pre>{value}</pre>
    </div>
  )
}

const styles = `
  .mx-page { min-height: 100vh; display: grid; grid-template-columns: 244px minmax(0, 1fr); background: #f5f8fc; color: #11233d; font-family: "Noto Sans Thai", "Segoe UI", sans-serif; }
  .mx-page * { box-sizing: border-box; }
  .mx-sidebar { background: #eef4fb; border-right: 1px solid #d8e3f2; padding: 18px 10px; }
  .mx-brand { display: flex; align-items: center; gap: 10px; padding: 8px 10px 18px; }
  .mx-brand-logo { width: 42px; height: 42px; border-radius: 11px; object-fit: cover; object-position: 50% 30%; background: #fff; border: 1px solid #d8e3f2; }
  .mx-brand-name { font-size: 15px; font-weight: 900; color: #163150; letter-spacing: 0; }
  .mx-brand-sub { font-size: 11px; color: #657894; font-weight: 800; margin-top: 1px; }
  .mx-create { width: 100%; border: 2px solid #1d74ee; background: #2f73d8; color: #fff; border-radius: 12px; padding: 14px 16px; font-weight: 900; cursor: pointer; box-shadow: inset 0 0 0 2px #d9e9ff, 0 16px 26px rgba(47,115,216,.2); }
  .mx-nav-section { margin-top: 18px; }
  .mx-nav-title { padding: 0 14px 8px; color: #8290a7; font-size: 12px; font-weight: 900; }
  .mx-nav { width: 100%; border: 0; background: transparent; color: #253855; display: grid; grid-template-columns: 14px 1fr auto; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 10px; text-align: left; cursor: pointer; font-size: 14px; }
  .mx-nav.active, .mx-nav:hover { background: #e2ecfa; color: #1556ae; }
  .mx-nav-dot { width: 12px; height: 12px; border: 1px solid #516b8d; border-radius: 3px; }
  .mx-nav strong { font-size: 12px; color: #1f65c8; }
  .mx-today-card { margin: 26px 6px 0; border: 1px solid #d8e3f2; background: #fff; border-radius: 12px; padding: 14px; box-shadow: 0 10px 24px rgba(30,64,124,.06); }
  .mx-card-title { color: #193455; font-weight: 900; margin-bottom: 8px; }
  .mx-metric-line { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #687a95; padding-top: 9px; }
  .mx-main { min-width: 0; background: radial-gradient(circle at 78% 8%, rgba(45,166,161,.12), transparent 28%), linear-gradient(180deg, #f8fbff 0%, #f4f7fb 100%); }
  .mx-topbar { height: 64px; display: flex; justify-content: space-between; align-items: center; padding: 0 24px; background: rgba(249,252,255,.9); border-bottom: 1px solid #d8e3f2; position: sticky; top: 0; z-index: 4; backdrop-filter: blur(14px); }
  .mx-back { border: 0; background: transparent; color: #27466f; font-weight: 800; cursor: pointer; }
  .mx-top-actions { display: flex; align-items: center; gap: 10px; }
  .mx-status { color: #047857; font-size: 12px; font-weight: 900; }
  .mx-pill { border: 1px solid #aac8f4; background: #edf6ff; color: #1f65c8; border-radius: 999px; padding: 8px 13px; font-weight: 800; }
  .mx-avatar { width: 42px; height: 42px; border-radius: 50%; background: #2f73d8; color: #fff; display: grid; place-items: center; font-weight: 900; }
  .mx-notice { margin: 24px 24px 0; border: 1px solid #b8d8ff; background: #eaf4ff; color: #1557c5; border-radius: 7px; padding: 10px 16px; font-size: 13px; }
  .mx-content { max-width: 1180px; margin: 26px auto 80px; padding: 0 24px; }
  .mx-page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 18px; }
  .mx-page-head.compact { margin-bottom: 14px; }
  .mx-page-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
  .mx-kicker { color: #5d7393; font-size: 12px; font-weight: 900; }
  .mx-page-head h1, .mx-review-head h2 { margin: 3px 0 0; font-size: 25px; line-height: 1.35; letter-spacing: 0; color: #12243d; }
  .mx-page-head p { margin: 6px 0 0; color: #70839f; font-size: 13px; }
  .mx-primary, .mx-secondary, .mx-ghost { border-radius: 9px; padding: 10px 14px; font-weight: 900; cursor: pointer; border: 1px solid transparent; }
  .mx-primary { background: #2f73d8; color: #fff; }
  .mx-secondary { background: #fff; color: #2261b7; border-color: #bfd5f2; }
  .mx-ghost { background: transparent; color: #647894; border-color: #d6e2f2; }
  .mx-primary:hover, .mx-secondary:hover, .mx-ghost:hover, .mx-create:hover { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(31,75,138,.10); }
  .mx-primary:disabled, .mx-secondary:disabled, .mx-ghost:disabled, .mx-primary:disabled:hover, .mx-secondary:disabled:hover, .mx-ghost:disabled:hover { opacity: .55; cursor: not-allowed; transform: none; box-shadow: none; }
  .mx-primary, .mx-secondary, .mx-ghost, .mx-create, .mx-nav, .mx-draft-item { transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease; }
  .mx-manual { display: grid; grid-template-columns: 1fr auto; gap: 10px; border: 1px solid #d8e3f2; background: #fff; border-radius: 14px; padding: 12px; box-shadow: 0 18px 44px rgba(31,75,138,.07); margin-bottom: 16px; }
  .mx-manual input, .mx-prompt-box textarea { border: 0; outline: 0; font: inherit; color: #1c2d46; background: transparent; }
  .mx-manual button:disabled { opacity: .48; cursor: not-allowed; }
  .mx-idea-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .mx-idea-card, .mx-review-card, .mx-preview, .mx-empty, .mx-chart-card, .mx-pipe-card, .mx-row-card, .mx-metric-card { border: 1px solid #d8e3f2; background: rgba(255,255,255,.94); border-radius: 14px; box-shadow: 0 18px 44px rgba(31,75,138,.07); }
  .mx-idea-card { padding: 16px; min-height: 250px; display: flex; flex-direction: column; gap: 12px; }
  .mx-idea-top { display: flex; justify-content: space-between; align-items: center; color: #647894; font-size: 12px; font-weight: 800; }
  .mx-idea-top strong { color: #0f8f83; }
  .mx-idea-card h2 { margin: 0; font-size: 18px; line-height: 1.35; color: #13243c; letter-spacing: 0; }
  .mx-idea-title-link { color: inherit; text-decoration: none; border-bottom: 1px solid transparent; }
  .mx-idea-title-link:hover { color: #1f65c8; border-bottom-color: #8ab8f6; }
  .mx-idea-card p { margin: 0; color: #51647f; font-size: 13px; line-height: 1.6; }
  .mx-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; }
  .mx-tags span, .mx-tags a { border: 1px solid #d7e5f6; background: #f6faff; color: #446181; border-radius: 999px; padding: 5px 8px; font-size: 11px; font-weight: 800; text-decoration: none; }
  .mx-tags a { color: #1f65c8; background: #edf6ff; border-color: #b8d8ff; }
  .mx-tags a:hover { background: #dfefff; }
  .mx-card-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .mx-card-actions.end { justify-content: flex-end; margin-top: 14px; }
  .mx-stepper { height: 70px; display: flex; justify-content: center; align-items: center; gap: 28px; border-bottom: 1px solid #e1e8f1; margin-bottom: 22px; }
  .mx-step { color: #9aa9bd; font-weight: 900; display: flex; align-items: center; gap: 8px; }
  .mx-step span { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; border: 2px solid #d8e3f2; }
  .mx-step.active { color: #13243c; }
  .mx-step.active span { background: #2f73d8; color: #fff; border-color: #d5e6ff; }
  .mx-prompt-box { display: grid; grid-template-columns: 1fr auto; gap: 12px; border: 1px solid #d8e3f2; background: #fff; border-radius: 14px; padding: 12px 14px; box-shadow: 0 18px 44px rgba(31,75,138,.07); }
  .mx-prompt-box textarea { min-height: 54px; resize: vertical; }
  .mx-model-note { color: #8293ad; font-size: 12px; margin-top: 12px; }
  .mx-generated-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 14px; margin-top: 20px; }
  .mx-review-card { padding: 16px; }
  .mx-review-card.wide { min-width: 0; }
  .mx-review-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .mx-pass, .mx-warn { border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 900; white-space: nowrap; }
  .mx-pass { background: #ecfdf5; border: 1px solid #95d9c8; color: #047857; }
  .mx-warn { background: #fff8e8; border: 1px solid #f2c874; color: #a15c00; }
  .mx-preview { padding: 14px; }
  .mx-preview-poster { min-height: 220px; display: grid; align-content: space-between; border-radius: 13px; color: #fff; padding: 18px; background: linear-gradient(135deg, #193455 0%, #2f73d8 58%, #21a6a1 100%); }
  .mx-preview-poster.compact { min-height: 156px; }
  .mx-preview-poster span, .mx-preview-poster small { font-weight: 900; opacity: .86; }
  .mx-preview-poster strong { font-size: 22px; line-height: 1.35; letter-spacing: 0; }
  .mx-brief-grid, .mx-brand-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .mx-brief-card, .mx-brand-rule { border: 1px solid #d8e3f2; background: rgba(255,255,255,.94); border-radius: 14px; padding: 14px; box-shadow: 0 18px 44px rgba(31,75,138,.07); }
  .mx-brief-card { display: grid; gap: 12px; }
  .mx-brief-card strong, .mx-brand-rule strong { color: #143355; }
  .mx-brief-card p, .mx-brand-rule p { margin: 8px 0 0; color: #51647f; font-size: 13px; line-height: 1.65; }
  .mx-brief-card p { max-height: 154px; overflow: auto; padding-right: 4px; }
  .mx-preview-poster strong { color: #fff; }
  .mx-visual-system { border: 1px solid #bfd5f2; background: radial-gradient(circle at 100% 0%, rgba(33,166,161,.14), transparent 28%), linear-gradient(180deg, #ffffff, #f3f8ff); border-radius: 18px; padding: 16px; margin-bottom: 16px; display: grid; grid-template-columns: minmax(280px, .9fr) minmax(0, 1.1fr); gap: 14px; box-shadow: 0 20px 50px rgba(31,75,138,.10); }
  .mx-visual-copy h2 { margin: 3px 0 8px; color: #12243d; font-size: 22px; line-height: 1.35; letter-spacing: 0; }
  .mx-visual-copy p { margin: 0; color: #51647f; font-size: 13px; line-height: 1.7; }
  .mx-workflow-steps { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
  .mx-workflow-steps span { border: 1px solid #d7e5f6; background: #fff; color: #27466f; border-radius: 999px; padding: 6px 9px; font-size: 11px; font-weight: 900; }
  .mx-style-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
  .mx-style-card { border: 1px solid #d8e3f2; background: rgba(255,255,255,.88); border-radius: 14px; padding: 12px; text-align: left; display: grid; gap: 7px; cursor: pointer; color: #14243c; }
  .mx-style-card.active { border-color: #2f73d8; background: #eef6ff; box-shadow: inset 0 0 0 1px rgba(47,115,216,.18); }
  .mx-style-card span { color: #0f8f83; font-size: 11px; font-weight: 900; }
  .mx-style-card strong { color: #143355; }
  .mx-style-card em { color: #60738f; font-size: 12px; line-height: 1.45; font-style: normal; }
  .mx-visual-note { border: 1px solid #e0e8f2; background: #fbfdff; border-radius: 10px; padding: 10px; margin-top: 10px; }
  .mx-visual-note span { display: block; color: #1d3f78; font-size: 11px; font-weight: 900; margin-bottom: 4px; }
  .mx-visual-note p { margin: 0; max-height: 88px; font-size: 12px; }
  .mx-media-result { border: 1px solid #bfd5f2; background: linear-gradient(180deg, #fff, #f4f8ff); border-radius: 16px; padding: 16px; margin-bottom: 16px; display: grid; gap: 14px; box-shadow: 0 20px 50px rgba(31,75,138,.10); }
  .mx-media-result h2 { margin: 3px 0 0; color: #14243c; font-size: 20px; line-height: 1.35; letter-spacing: 0; }
  .mx-media-result img, .mx-media-result video { width: min(100%, 760px); max-height: 640px; object-fit: contain; border-radius: 14px; border: 1px solid #d8e3f2; background: #fff; justify-self: start; }
  .mx-media-result video { max-height: 720px; background: #07111f; }
  .mx-media-result .media-download { width: fit-content; text-decoration: none; display: inline-flex; }
  .mx-quota-note { border: 1px solid #f2c874; background: #fff8e8; color: #8a4d00; border-radius: 12px; padding: 12px; font-size: 13px; line-height: 1.6; font-weight: 800; }
  .mx-fallback-prompt { margin: 0; white-space: pre-wrap; border: 1px solid #d8e3f2; background: #fbfdff; color: #243651; border-radius: 12px; padding: 12px; font: inherit; font-size: 12px; line-height: 1.7; max-height: 360px; overflow: auto; }
  .mx-reference-hero { border: 1px solid #bfd5f2; background: radial-gradient(circle at 100% 0%, rgba(33,166,161,.14), transparent 34%), linear-gradient(180deg, #fff, #f3f8ff); border-radius: 18px; padding: 16px; margin-bottom: 16px; display: grid; gap: 14px; box-shadow: 0 20px 50px rgba(31,75,138,.10); }
  .mx-reference-search label, .mx-reference-form label { display: grid; gap: 6px; color: #60738f; font-size: 12px; font-weight: 900; }
  .mx-reference-search input, .mx-reference-form input, .mx-reference-form select, .mx-reference-form textarea { border: 1px solid #d8e3f2; background: #fff; color: #243651; border-radius: 10px; padding: 10px 11px; font: inherit; font-size: 13px; outline: 0; }
  .mx-reference-search input:focus, .mx-reference-form input:focus, .mx-reference-form select:focus, .mx-reference-form textarea:focus { border-color: #8ab8f6; box-shadow: 0 0 0 3px rgba(47,115,216,.10); }
  .mx-reference-form textarea { min-height: 78px; resize: vertical; }
  .mx-query-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .mx-query-chips button { border: 1px solid #d7e5f6; background: #fff; color: #245ca8; border-radius: 999px; padding: 7px 10px; font-size: 12px; font-weight: 900; cursor: pointer; }
  .mx-source-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
  .mx-source-card { border: 1px solid #d8e3f2; background: rgba(255,255,255,.92); border-radius: 14px; padding: 13px; display: grid; gap: 7px; text-decoration: none; color: #14243c; min-height: 160px; }
  .mx-source-card:hover { border-color: #8ab8f6; transform: translateY(-1px); box-shadow: 0 14px 32px rgba(31,75,138,.10); }
  .mx-source-card span { color: #0f8f83; font-size: 11px; font-weight: 900; }
  .mx-source-card strong { color: #143355; font-size: 15px; }
  .mx-source-card p { margin: 0; color: #60738f; font-size: 12px; line-height: 1.55; }
  .mx-source-card em { margin-top: auto; color: #1f65c8; font-style: normal; font-size: 12px; font-weight: 900; }
  .mx-reference-layout { display: grid; grid-template-columns: minmax(320px, .86fr) minmax(0, 1.14fr); gap: 14px; align-items: start; }
  .mx-reference-form, .mx-pattern-panel, .mx-reference-item { border: 1px solid #d8e3f2; background: rgba(255,255,255,.96); border-radius: 14px; padding: 16px; box-shadow: 0 18px 44px rgba(31,75,138,.07); }
  .mx-reference-form { display: grid; gap: 12px; }
  .mx-section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 2px; }
  .mx-section-head h2, .mx-pattern-panel h2 { margin: 3px 0 0; color: #14243c; font-size: 19px; line-height: 1.35; letter-spacing: 0; }
  .mx-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .mx-reference-side { display: grid; gap: 12px; }
  .mx-pattern-panel { display: grid; gap: 10px; }
  .mx-pattern-panel p { margin: 0; color: #60738f; font-size: 13px; line-height: 1.7; }
  .mx-reference-meta, .mx-reference-tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .mx-reference-meta span, .mx-reference-tags span { border: 1px solid #d7e5f6; background: #f6faff; color: #446181; border-radius: 999px; padding: 5px 8px; font-size: 11px; font-weight: 800; }
  .mx-reference-list { display: grid; gap: 10px; }
  .mx-reference-item { display: grid; gap: 10px; padding: 13px; }
  .mx-reference-item.active { border-color: #8ab8f6; background: #f3f8ff; }
  .mx-reference-item > button { border: 0; background: transparent; text-align: left; padding: 0; cursor: pointer; display: grid; gap: 5px; color: #14243c; }
  .mx-reference-item > button span { color: #60738f; font-size: 12px; font-weight: 900; }
  .mx-reference-item > button strong { color: #143355; font-size: 15px; line-height: 1.4; }
  .mx-reference-item > button p { margin: 0; color: #51647f; font-size: 13px; line-height: 1.55; }
  .mx-secondary.as-link { text-decoration: none; display: inline-flex; align-items: center; }
  .mx-library-split { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr); gap: 14px; align-items: start; }
  .mx-filter-bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: end; margin-bottom: 14px; border: 1px solid #d8e3f2; background: rgba(255,255,255,.88); border-radius: 14px; padding: 12px; box-shadow: 0 14px 36px rgba(31,75,138,.06); }
  .mx-filter-bar label { display: grid; gap: 6px; color: #60738f; font-size: 12px; font-weight: 900; min-width: 180px; }
  .mx-filter-bar select { appearance: none; border: 1px solid #cfe0f5; background: #fff; color: #183453; border-radius: 10px; padding: 10px 34px 10px 12px; font: inherit; font-size: 13px; font-weight: 800; outline: 0; box-shadow: inset 0 0 0 1px rgba(255,255,255,.6); }
  .mx-filter-bar label { position: relative; }
  .mx-filter-bar label::after { content: '⌄'; position: absolute; right: 12px; bottom: 10px; color: #5b77a1; pointer-events: none; font-size: 14px; }
  .mx-library-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .mx-library-head span { color: #6b7f9b; font-size: 12px; font-weight: 900; }
  .mx-row-card.muted { opacity: .72; background: #f6f8fb; }
  .mx-post-actions { display: flex !important; grid-template-columns: none !important; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
  .mx-mini-button { border: 1px solid #cfe0f5; background: #fff; color: #245ca8; border-radius: 999px; padding: 7px 10px; font-size: 12px; font-weight: 900; cursor: pointer; }
  .mx-mini-button:hover { border-color: #8ab8f6; background: #f3f8ff; }
  .mx-mini-button.danger { border-color: #ffd1cc; color: #b42318; background: #fff7f6; }
  .mx-channel-preview { border: 1px solid #d8e3f2; background: #fff; border-radius: 14px; padding: 14px; box-shadow: 0 18px 44px rgba(31,75,138,.07); }
  .mx-preview-box { margin-top: 10px; border: 1px solid #d8e3f2; background: #f9fcff; border-radius: 12px; padding: 14px; min-height: 220px; display: grid; gap: 10px; align-content: start; }
  .mx-preview-box.facebook { border-color: #c8ddff; background: linear-gradient(180deg, #f8fbff, #edf5ff); }
  .mx-preview-box.line { border-color: #bee8d2; background: linear-gradient(180deg, #fbfffc, #eefbf4); }
  .mx-preview-box.tiktok { border-color: #d7dbea; background: linear-gradient(180deg, #ffffff, #f6f7fb); }
  .mx-preview-box strong { color: #14243c; font-size: 16px; line-height: 1.45; }
  .mx-preview-box pre { margin: 0; white-space: pre-wrap; font: inherit; color: #30445f; font-size: 13px; line-height: 1.7; }
  .mx-section-title { margin: 0 0 10px; color: #143355; font-size: 17px; letter-spacing: 0; }
  .mx-content-block { border: 1px solid #e0e8f2; background: #fbfdff; border-radius: 10px; padding: 12px; margin-top: 10px; }
  .mx-content-title, .mx-content-block summary { display: flex; justify-content: space-between; align-items: center; color: #1d3f78; font-weight: 900; cursor: pointer; }
  .mx-content-block button { border: 1px solid #cfe0f5; background: #fff; color: #245ca8; border-radius: 7px; padding: 5px 8px; cursor: pointer; }
  .mx-content-block pre { margin: 9px 0 0; white-space: pre-wrap; font: inherit; font-size: 13px; line-height: 1.7; color: #243651; }
  .mx-edit-caption { width: 100%; min-height: 210px; margin-top: 10px; border: 1px solid #d8e3f2; border-radius: 10px; padding: 12px; resize: vertical; font: inherit; font-size: 13px; line-height: 1.7; color: #243651; background: #fff; outline: 0; }
  .mx-edit-caption:focus { border-color: #8ab8f6; box-shadow: 0 0 0 3px rgba(47,115,216,.10); }
  .mx-schedule-row { display: flex; align-items: end; gap: 12px; flex-wrap: wrap; margin-top: 10px; border: 1px solid #e0e8f2; background: #fbfdff; border-radius: 10px; padding: 12px; }
  .mx-schedule-row label { display: grid; gap: 6px; color: #60738f; font-size: 12px; font-weight: 900; }
  .mx-schedule-row input, .mx-row-actions input { border: 1px solid #d8e3f2; background: #fff; color: #243651; border-radius: 8px; padding: 8px 10px; font: inherit; }
  .mx-schedule-row span { color: #0f8f83; font-size: 12px; font-weight: 900; padding-bottom: 9px; }
  summary::-webkit-details-marker { display: none; }
  .mx-approval-layout { display: grid; grid-template-columns: 330px minmax(0, 1fr); gap: 14px; }
  .mx-draft-list { display: grid; gap: 8px; align-content: start; }
  .mx-draft-item { display: grid; gap: 4px; text-align: left; border: 1px solid #d8e3f2; background: #fff; border-radius: 11px; padding: 12px; cursor: pointer; color: #17243b; }
  .mx-draft-item.active, .mx-draft-item:hover { border-color: #8ab8f6; background: #eaf4ff; }
  .mx-draft-item span { color: #71849f; font-size: 12px; }
  .mx-image-tools { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
  .mx-image-tools button { border: 1px solid #cfe0f5; background: #f6faff; color: #245ca8; border-radius: 999px; padding: 7px 10px; font-weight: 800; cursor: pointer; }
  .mx-review-notes { margin-top: 12px; display: grid; gap: 6px; border: 1px solid #e0e8f2; background: #fbfdff; border-radius: 10px; padding: 12px; }
  .mx-review-notes strong { color: #1d3f78; }
  .mx-review-notes span { color: #51647f; font-size: 13px; }
  .mx-empty { padding: 28px; color: #71849f; line-height: 1.7; }
  .mx-list, .mx-pipeline { display: grid; gap: 10px; }
  .mx-row-card, .mx-pipe-card { padding: 14px; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
  .mx-row-card div, .mx-pipe-card div { display: grid; gap: 4px; }
  .mx-row-card span, .mx-pipe-card span { color: #71849f; font-size: 13px; }
  .mx-row-actions { display: flex !important; grid-template-columns: none !important; flex-direction: row; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
  .mx-pipe-card em { font-style: normal; color: #0f8f83; background: #ecfdf5; border: 1px solid #9bdaca; border-radius: 999px; padding: 6px 10px; font-weight: 900; white-space: nowrap; }
  .mx-inbox-layout { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 14px; align-items: start; }
  .mx-inbox-list { display: grid; gap: 9px; }
  .mx-inbox-item { text-align: left; border: 1px solid #d8e3f2; background: rgba(255,255,255,.95); border-radius: 13px; padding: 13px; display: grid; grid-template-columns: 1fr auto; gap: 8px; cursor: pointer; color: #17243b; box-shadow: 0 14px 34px rgba(31,75,138,.06); }
  .mx-inbox-item.active, .mx-inbox-item:hover { border-color: #8ab8f6; background: #f3f8ff; }
  .mx-inbox-item div { display: grid; gap: 3px; }
  .mx-inbox-item strong { color: #143355; }
  .mx-inbox-item span { color: #71849f; font-size: 12px; font-weight: 800; }
  .mx-inbox-item p { grid-column: 1 / -1; margin: 0; color: #51647f; font-size: 13px; line-height: 1.5; }
  .mx-inbox-item em, .mx-risk { font-style: normal; border-radius: 999px; padding: 6px 9px; font-size: 12px; font-weight: 900; white-space: nowrap; align-self: start; }
  .risk-high, .mx-risk.high { color: #b42318; background: #fff1f0; border: 1px solid #ffb8b0; }
  .risk-medium, .mx-risk.medium { color: #a15c00; background: #fff8e8; border: 1px solid #f2c874; }
  .risk-low, .mx-risk.low { color: #047857; background: #ecfdf5; border: 1px solid #95d9c8; }
  .mx-inbox-detail { border: 1px solid #d8e3f2; background: rgba(255,255,255,.96); border-radius: 14px; padding: 16px; box-shadow: 0 18px 44px rgba(31,75,138,.07); }
  .mx-inbox-meta { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
  .mx-inbox-meta span { border: 1px solid #d7e5f6; background: #f6faff; color: #446181; border-radius: 999px; padding: 6px 9px; font-size: 12px; font-weight: 800; }
  .mx-calendar { display: grid; grid-template-columns: repeat(7, minmax(90px, 1fr)); gap: 8px; }
  .mx-day { min-height: 96px; border: 1px solid #d8e3f2; background: #fff; border-radius: 12px; padding: 10px; display: grid; align-content: start; gap: 8px; }
  .mx-day.has { border-color: #8ab8f6; background: #f3f8ff; }
  .mx-day span { color: #1f65c8; font-size: 12px; font-weight: 900; }
  .mx-calendar-item { border: 1px solid #cfe0f5; background: #fff; color: #24466f; border-radius: 8px; padding: 6px 7px; font-size: 11px; line-height: 1.35; }
  .mx-toast { position: fixed; right: 22px; bottom: 22px; z-index: 20; background: #15395f; color: #fff; border-radius: 12px; padding: 12px 16px; font-size: 13px; font-weight: 900; box-shadow: 0 18px 42px rgba(18,36,61,.22); }
  .mx-toast.error { background: #b42318; }
  .mx-range { display: flex; gap: 8px; }
  .mx-range button { border: 1px solid #cfe0f5; background: #fff; color: #245ca8; border-radius: 999px; padding: 8px 12px; font-weight: 900; }
  .mx-metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 14px; }
  .mx-metric-card { padding: 16px; display: grid; gap: 4px; }
  .mx-metric-card span { color: #71849f; font-size: 12px; font-weight: 900; }
  .mx-metric-card strong { font-size: 30px; color: #14243c; }
  .mx-metric-card em { color: #0f8f83; font-style: normal; font-weight: 900; }
  .mx-metrics-layout { display: grid; grid-template-columns: minmax(320px, .85fr) minmax(0, 1.15fr); gap: 14px; margin-bottom: 14px; align-items: start; }
  .mx-metric-form { border: 1px solid #d8e3f2; background: rgba(255,255,255,.96); border-radius: 14px; padding: 16px; display: grid; gap: 12px; box-shadow: 0 18px 44px rgba(31,75,138,.07); }
  .mx-metric-form label { display: grid; gap: 6px; color: #60738f; font-size: 12px; font-weight: 900; }
  .mx-metric-form input, .mx-metric-form select, .mx-metric-form textarea { border: 1px solid #d8e3f2; background: #fff; color: #243651; border-radius: 10px; padding: 10px 11px; font: inherit; font-size: 13px; outline: 0; }
  .mx-metric-form textarea { min-height: 84px; resize: vertical; }
  .mx-metric-inputs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .mx-chart-card { padding: 18px; }
  .mx-bars { height: 240px; display: flex; align-items: end; gap: 10px; padding: 16px; border-radius: 12px; background: linear-gradient(180deg, #f5f9ff, #eef5ff); }
  .mx-bars span { flex: 1; min-width: 10px; border-radius: 8px 8px 0 0; background: linear-gradient(180deg, #2f73d8, #21a6a1); }
  .mx-chart-card p { color: #71849f; font-size: 13px; margin: 12px 0 0; }
  @media (max-width: 980px) { .mx-page { grid-template-columns: 1fr; } .mx-sidebar { border-right: 0; border-bottom: 1px solid #d8e3f2; } .mx-topbar { position: static; } .mx-generated-grid, .mx-approval-layout, .mx-library-split, .mx-inbox-layout, .mx-metrics-layout, .mx-visual-system, .mx-reference-layout { grid-template-columns: 1fr; } }
  @media (max-width: 720px) { .mx-topbar, .mx-page-head, .mx-row-card, .mx-pipe-card { align-items: stretch; flex-direction: column; } .mx-top-actions, .mx-card-actions, .mx-range { flex-wrap: wrap; } .mx-manual, .mx-prompt-box, .mx-metric-inputs, .mx-form-grid { grid-template-columns: 1fr; } .mx-calendar { grid-template-columns: repeat(2, 1fr); } .mx-stepper { justify-content: flex-start; overflow-x: auto; gap: 14px; } }
`

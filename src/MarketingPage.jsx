import React, { useEffect, useMemo, useRef, useState } from 'react'
import { aiDraftReviewNotes, appendMarketingHashtags, applyAiDraft, applyHookChoice, assetxChannels, canPublishAssetxPost, isAiDraft, reviewAssetxContent, runAssetxMarketingModel } from './lib/assetxMarketingModel.js'
import { hookOptionsFor, isCurrentHook, swapOpeningLine, videoScriptFromDraft } from './lib/hookOptions.js'
import { DECORATED_MIN, countEmoji, decorateCaption, stripEmoji } from './lib/captionEmoji.js'
import { getMarketingWorkspace, saveMarketingWorkspace } from './lib/api.js'
import ArtworkEditor from './ArtworkEditor.jsx'
import ArtworkPreview from './ArtworkPreview.jsx'
import { canRecoverManualFacebookPost, recoverManualFacebookPost } from './lib/marketingQueue.js'
import { prioritizeMarketingIdeas, redemptionIdeas } from './lib/marketingIdeaMix.js'
import { importHermesDraft } from './lib/hermesMarketingDraft.js'
import { assetxImageStyles, buildGalleryFireflyPrompt } from './lib/assetxImageStyles.js'
import { POSTER_DESIGN_SYSTEM, POSTER_TEXT_RULES, pickPosterLayout, posterLayoutInstruction, pickHeadlineKeyword } from './lib/posterDesignSystem.js'
import { posterBriefFor } from './lib/posterBrief.js'
import { marketingChannelSetup, validateManualPublicationReference } from './lib/marketingChannels.js'
import { organizeMarketingQueue } from './lib/marketingQueuePlan.js'
import { SESSION_EXPIRED_MESSAGE, errorMessage, friendlyApiError } from './lib/marketingErrors.js'
import { contentNoOf, contentReference, ensureContentNumbers, findContentByNo, formatContentNo, parseContentNo } from './lib/marketingContentNumbers.js'
import { freshJobStatus, isActiveJob as isActiveFreshJob, latestJobBy, shouldResumeJob } from './lib/freshContentJob.js'

const STORAGE_KEY = 'assetx_marketing_workspace_v5'

// การ์ดไอเดียจากระบบรีเสิร์ช (ตาราง marketing_ideas ผ่าน /api/marketing-ideas) → รูปเดียวกับไอเดียอื่นในหน้านี้
const researchSubtypeLabels = {
  rate: 'ดอกเบี้ย/กนง.', fee_measure: 'ค่าโอน/มาตรการรัฐ', valuation: 'ราคาประเมิน', law: 'กฎหมาย', scam: 'เตือนภัยมิจฉาชีพ',
  credit_market: 'สินเชื่อ', market: 'ตลาด', auction_npa: 'ขายทอดตลาด/NPA', community_q: 'คำถามจากชุมชน', competitor: 'คู่แข่ง', internal: 'ลีดของเรา', calendar: 'ปฏิทิน',
  social_fb: 'โพสต์แรงของเพจ', ad_library: 'แอดคู่แข่ง',
}
const researchSourceLabels = { news: 'ข่าว', official: 'ทางการ', community: 'ชุมชน', auction: 'ขายทอดตลาด', youtube: 'YouTube', social: 'โซเชียล', internal: 'ลีดของเรา', manual: 'วางเอง' }
// เพจพูดกับเจ้าของทรัพย์ที่ต้องการเงินอย่างเดียว (เจ้าของเลือก 9 พ.ย. 2569 · server/research/audience.js) — ทุกมุมเล่าและร่าง AI ของไอเดียรีเสิร์ชเขียนถึงกลุ่มนี้
// การ์ดจึงบอกคนอ่านกลุ่มเดียว ไม่ใช่ป้ายกลุ่มของไอเดีย (เดิมขึ้น "ทุกกลุ่ม" แล้วร่างพูดปนกับนักลงทุน)
const RESEARCH_READER_LABEL = 'เจ้าของทรัพย์ที่ต้องการเงิน'

function researchIdeaToCard(row) {
  const cite = ['news', 'official', 'auction'].includes(row.source) && row.source_label
  const audience = RESEARCH_READER_LABEL
  return {
    id: `research-${row.id}`,
    dbId: row.id,
    kind: 'research',
    source: cite ? `${researchSourceLabels[row.source] || row.source} · ${row.source_label}` : (researchSourceLabels[row.source] || 'ตลาด'),
    type: researchSubtypeLabels[row.subtype] || 'ตลาด',
    subtype: row.subtype || null,
    // คะแนนเรดาร์อยู่ช่วง ~1–9 ส่วนไอเดียเดิมในหน้าใช้ 0–100 → ยืดสเกลให้เรียงรวมกันได้ (ใช้เรียงเท่านั้น ไม่โชว์)
    score: Math.round(Math.min(99, 40 + Number(row.score || 0) * 7)),
    radarScore: Number(row.score || 0),
    title: row.title,
    // มีข้อเท็จจริงที่ถอดจากต้นทางแล้ว (📌) · เจ้าของวางเอง · หรือไอเดียจากตัวเฝ้าเพจ Facebook ที่มีข้อความโพสต์ในเครื่องหมายคำพูด (≥ 40 ตัวอักษร)
    // — ต้องตรงกับ hasResearchFacts ใน server/research/drafts.js · ไอเดียที่ไม่มี AI จะไม่ร่างให้ (ป้ายบนการ์ดบอก)
    hasFacts: /^📌/.test(String(row.summary || '').trim()) || row.source === 'manual' || (row.source === 'social' && (/^“[^\n]{40,}/m.test(String(row.summary || '')) || /“[^”\n]{40,}/.test(String(row.summary || '')))),
    angle: row.angles?.[0]?.brief || row.summary || 'รอ AI เขียนมุมเล่า — เลือกได้เลยถ้าหัวข้อตรงใจ',
    audience,
    channel: 'Facebook',
    url: row.url || '',
    angles: Array.isArray(row.angles) ? row.angles : [],
    // มุมที่เคยกด ร่างโพสต์ ไปแล้ว — มีค่าเมื่อเจ้าของย้อนร่างกลับมาเป็นไอเดีย (การ์ดบอกว่าเคยร่างมุมไหน)
    chosenAngle: row.chosen_angle || null,
    eventDate: row.event_date || null,
    createdAt: row.created_at || null,
  }
}

// ป้ายช่องทางสำหรับแสดงผล (ค่าที่บันทึกเป็น facebook / line-oa / Facebook ปะปนกัน)
function channelLabel(value = '') {
  const found = assetxChannels.find((channel) => channel.value === value || channel.label === value)
  return found?.label || value || 'ไม่ระบุช่องทาง'
}

// แหล่งที่มาของโพสต์สำหรับแสดงผล — ไม่แก้ค่าที่บันทึก แค่แปลชื่อระบบเป็นคำที่คนอ่านเข้าใจ
function displaySource(source = '') {
  if (!source) return 'เขียนเอง'
  return String(source)
    .replace(/Hermes \/ Telegram/i, 'ร่างจาก Telegram')
    .replace(/Hermes \+ Tavily/i, 'สำรวจตลาด')
    .replace(/Tavily Trend Radar|Tavily/gi, 'สำรวจตลาด')
    .replace(/AssetX Studio/i, 'เขียนเอง')
    .replace(/^Reference · /, 'ตัวอย่างโฆษณา · ')
    .replace(/^Brand Brain$|^ระบบสัญญา$|^คำถามลูกค้า(บ่อย)?$|^ฟอร์มประเมินทรัพย์$|^ฐานข้อมูลทรัพย์$/, 'หัวข้อตัวอย่าง')
    .replace(/^ไอเดียวันนี้$/, 'จากไอเดีย')
}

const thaiDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
const thaiDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}
const thaiTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

// ข้อความผิดพลาดที่ปลอดภัยต่อการแสดงบนหน้า (SESSION_EXPIRED_MESSAGE · friendlyApiError · errorMessage) อยู่ใน ./lib/marketingErrors.js

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
  ...redemptionIdeas,
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
    type: 'ลีดเจ้าของทรัพย์',
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
    type: 'ลีดขายทรัพย์',
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
  {
    id: 'edu-sale-vs-mortgage',
    source: 'Brand Brain',
    type: 'ความรู้',
    score: 91,
    title: 'ขายฝากกับจำนอง ต่างกันตรงไหน',
    angle: 'อธิบายแบบภาษาคนทั่วไปว่าแต่ละทางเลือกมีผลเรื่องกรรมสิทธิ์ ระยะเวลา ค่าใช้จ่าย และการไถ่ถอนอย่างไร พร้อมเตือนว่าต้องดูสัญญาจริงก่อนตัดสินใจ',
    audience: 'เจ้าของโฉนด',
    channel: 'Facebook + LINE OA',
    status: 'ควรทำประจำ',
  },
  {
    id: 'edu-deed-checklist',
    source: 'Brand Brain',
    type: 'เช็กลิสต์ความรู้',
    score: 89,
    title: 'ก่อนใช้โฉนดเป็นหลักประกัน ต้องเช็กอะไรบ้าง',
    angle: 'ทำเป็นเช็กลิสต์อ่านง่าย: ชื่อผู้ถือกรรมสิทธิ์ ภาระผูกพัน ทางเข้า เนื้อที่ ทำเล และเงื่อนไขที่ต้องอ่านก่อนเซ็น',
    audience: 'เจ้าของทรัพย์',
    channel: 'Facebook',
    status: 'พร้อมทำ',
  },
  {
    id: 'edu-redemption-cost',
    source: 'Brand Brain',
    type: 'ความรู้กฎหมายแบบเบื้องต้น',
    score: 86,
    title: 'สินไถ่และค่าใช้จ่าย ควรถามให้ชัดก่อนทำสัญญา',
    angle: 'ให้ความรู้เรื่องยอดที่ต้องใช้ไถ่ถอน ค่าใช้จ่ายจริง ระยะเวลา และข้อควรถามก่อนทำสัญญา โดยไม่ฟันธงแทนเอกสารจริง',
    audience: 'ผู้ขายฝาก',
    channel: 'Facebook + Reels',
    status: 'ควรทำประจำ',
  },
  {
    id: 'edu-warning-before-sign',
    source: 'Brand Brain',
    type: 'ข้อควรระวัง',
    score: 84,
    title: 'ก่อนเซ็นขายฝาก อ่าน 5 จุดนี้ให้เข้าใจ',
    angle: 'ทำเป็นคอนเทนต์เตือนแบบนุ่มนวล: วันครบกำหนด เงื่อนไขไถ่ถอน ค่าใช้จ่าย ผู้รับผิดชอบ และผลหากชำระไม่ตรง',
    audience: 'เจ้าของทรัพย์ที่กำลังตัดสินใจ',
    channel: 'LINE OA + Facebook',
    status: 'พร้อมทำ',
  },
  {
    id: 'edu-owner-faq',
    source: 'คำถามลูกค้าบ่อย',
    type: 'FAQ ความรู้',
    score: 82,
    title: 'มีโฉนด แต่อยากได้เงินก้อน ต้องเริ่มจากข้อมูลอะไร',
    angle: 'ตอบคำถามแบบลดความกังวลว่าเริ่มจากข้อมูลพื้นที่ ประเภททรัพย์ เนื้อที่ รูปโฉนดที่ปิดข้อมูลสำคัญ และให้ทีมช่วยประเมินทางเลือกเบื้องต้น',
    audience: 'เจ้าของที่ดิน',
    channel: 'Facebook + LINE OA',
    status: 'พร้อมทำ',
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

// ตัวอย่างข้อความสำหรับหน้า "ตอบคอมเมนต์ (ตัวอย่าง)" — เขียนไว้ล่วงหน้า ยังไม่ได้เชื่อมคอมเมนต์จริง
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
    intent: 'ลูกค้าเจ้าของทรัพย์',
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

const assetxPalettePrompt = 'AssetX logo-inspired palette: midnight navy #08213f, deep indigo/violet #4b2a82, cyan/teal #42c7d8, soft sky blue #70d7e8, coral-pink-to-warm-orange #f26b4f, and clean white. Use cyan/teal and navy as the primary poster colors, violet as the depth/shadow color, and coral-pink/orange only as a small warm accent. CTA bands and badges should be navy, teal, white, or cyan-glow style. Avoid metallic gold CTA bars, dominant red map pins, green loan-ad themes, and generic high-saturation finance-ad colors.'

const assetxVisualStyles = [
  {
    id: 'assetx-social-poster',
    name: 'Social Poster Key Visual',
    badge: 'โปสเตอร์ 4:5',
    imageAspectRatio: '4:5',
    allowPosterText: true,
    description: 'ภาพโปสเตอร์พร้อมใช้ มี headline, benefit badge, CTA และองค์ประกอบโฆษณาในภาพ',
    prompt: `Photorealistic Thai real-estate social media poster advertisement, vertical 4:5 composition. A complete ready-to-post marketing creative made from real-looking photography plus bold graphic design, not a plain landscape photo and not an illustration. Strong commercial poster hierarchy, readable Thai headline zones, clean cutout-style layering, realistic land plot, Thai title deed document as a stylized non-real sample, modern house/property element, map pin icons, checkmark-style benefit badges, bottom CTA/contact bar. ${assetxPalettePrompt} High contrast, polished, premium, energetic, social-ad ready.`,
    scenes: 'Main hero area with land deed and property/land visual, secondary grid or left-right comparison zones, 3-step process blocks, circular icon badges, small property thumbnails or map-like panels, large Thai headline, benefit badges, CTA band, brand label area.',
    layoutRules: 'Design as a finished Thai social poster with actual text rendered in the image. Use only the exact poster copy provided in the prompt. Thai text must be large, legible, and intentionally designed. Do not invent unrelated claims, random phone numbers, random company names, fake deed numbers, or fake addresses. Brand mark/text may say AssetX Estate only.',
  },
  {
    id: 'assetx-premium-realistic',
    name: 'AssetX Premium Realistic',
    badge: 'ค่าเริ่มต้น',
    description: 'ภาพสมจริง พรีเมี่ยม สะอาด น่าเชื่อถือ เหมาะกับแบรนด์ที่ปรึกษาอสังหาริมทรัพย์และหลักประกัน',
    prompt: `Photorealistic premium Thai real-estate advisory brand. Editorial commercial photography, natural daylight, clean composition, premium but approachable. ${assetxPalettePrompt} Crisp details, trustworthy financial advisory mood.`,
    scenes: 'Clean executive desk, land deed folder with all details obscured, cadastral map without readable private data, calculator, tablet map interface, modern Thai property context, professional hands reviewing documents, no identifiable real person.',
  },
  {
    id: 'assetx-field-survey',
    name: 'Field Survey Premium',
    badge: 'ทรัพย์/ที่ดิน',
    description: 'ภาพลงพื้นที่ดูทรัพย์และทำเล เหมาะกับโพสต์ประเมินที่ดินและนักลงทุน',
    prompt: `Photorealistic premium field survey style. Real Thai land and property inspection mood, clean sunlight, cinematic documentary look, professional survey team details without identifiable faces. ${assetxPalettePrompt}`,
    scenes: 'Land plot entrance, road access, map tablet, survey notebook, measuring tape, property boundary atmosphere, realistic Thai provincial environment, no exact address signs, no deed numbers.',
  },
  {
    id: 'assetx-investor-brief',
    name: 'Investor Brief',
    badge: 'นักลงทุน',
    description: 'ภาพประชุมและสรุปข้อมูล เหมาะกับคอนเทนต์นักลงทุน/ทรัพย์ราคาดี',
    prompt: `Photorealistic premium investor briefing style. Modern meeting table, clean financial advisory setting, sophisticated lighting, calm confidence, premium Thai real-estate investment mood. ${assetxPalettePrompt}`,
    scenes: 'Investment brief papers, anonymized property photos, tablet dashboard, coffee, calculator, minimal charts without readable sensitive text, professional hands only.',
  },
  ...assetxImageStyles,
]

const referenceSources = [
  {
    id: 'meta-ads',
    name: 'Meta Ads Library',
    type: 'โฆษณา Facebook / Instagram',
    strength: 'ดูประโยคเปิด ภาพปก ภาพชุด ปุ่มชวนติดต่อ และข้อความโฆษณาของตลาดจริง',
    searchUrl: (query) => `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&media_type=all&q=${encodeURIComponent(query)}&search_type=keyword_unordered`,
  },
  {
    id: 'tiktok-top-ads',
    name: 'TikTok Creative Center',
    type: 'วิดีโอสั้น / โฆษณายอดนิยม',
    strength: 'ดูประโยคเปิด 3 วินาทีแรก สคริปต์ จังหวะ และมุมภาพสำหรับ Reels/TikTok',
    searchUrl: () => 'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?period=30&region=TH',
  },
  {
    id: 'pinterest-trends',
    name: 'Pinterest Trends',
    type: 'มู้ดบอร์ด / เทรนด์ภาพ',
    strength: 'หาอารมณ์ภาพ คีย์เวิร์ด เลย์เอาต์ และทิศทางของภาพอสังหา/บ้าน/ที่ดิน',
    searchUrl: (query) => `https://trends.pinterest.com/?geo=TH&q=${encodeURIComponent(query)}`,
  },
  {
    id: 'pinterest-search',
    name: 'Pinterest Search',
    type: 'ตัวอย่างภาพ',
    strength: 'เก็บไอเดียการจัดองค์ประกอบ โทนสี และอารมณ์ของภาพโดยไม่ลอกภาพเดิม',
    searchUrl: (query) => `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'google-creative',
    name: 'Google Image / Web',
    type: 'ภาพและบทความ',
    strength: 'หาตัวอย่างกว้าง ๆ จากคีย์เวิร์ดไทยและอังกฤษ',
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
  tags: 'ขายฝาก, โฉนด, ลีด',
  notes: '',
}

const defaultPosterCopy = {
  headline: 'มีโฉนด แต่ไม่อยากขายขาด',
  subheadline: 'เปลี่ยนที่ดินเป็นเงินทุนอย่างเป็นระบบ',
  badge1: 'ประเมินเบื้องต้น',
  badge2: 'ปรึกษาฟรี',
  badge3: 'ดูแลเอกสาร',
  trustLine: 'ตรวจข้อมูลก่อนเสนอทางเลือก',
  areaLine: 'ให้บริการตามพื้นที่ที่ประเมินได้',
  cta: 'ติดต่อ AssetX Estate',
  contactLine: '',
}

function loadWorkspace() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    // เลขคอนเทนต์: แจกให้ชิ้นที่ยังไม่มี โดยไม่เปลี่ยนเลขเดิม (ดู lib/marketingContentNumbers.js)
    return ensureContentNumbers({
      studio: { ...defaultStudio, ...(stored.studio || {}) },
      generated: stored.generated || null,
      posts: Array.isArray(stored.posts) ? stored.posts : [],
      savedIdeas: Array.isArray(stored.savedIdeas) ? stored.savedIdeas : [],
      radarIdeas: Array.isArray(stored.radarIdeas) ? stored.radarIdeas : [],
      references: Array.isArray(stored.references) ? stored.references : [],
      knowledgeNotes: Array.isArray(stored.knowledgeNotes) ? stored.knowledgeNotes : [],
      referenceForm: { ...defaultReferenceForm, ...(stored.referenceForm || {}) },
      referenceQuery: stored.referenceQuery || referenceStarterQueries[0],
      posterCopy: { ...defaultPosterCopy, ...(stored.posterCopy || {}) },
      mediaAssets: Array.isArray(stored.mediaAssets) ? stored.mediaAssets : [],
      metrics: Array.isArray(stored.metrics) ? stored.metrics : [],
      hiddenPostIds: Array.isArray(stored.hiddenPostIds) ? stored.hiddenPostIds : [],
      manualIdea: stored.manualIdea || '',
      contentSeq: stored.contentSeq,
    })
  } catch {
    return {
      studio: defaultStudio,
      generated: null,
      posts: [],
      savedIdeas: [],
      radarIdeas: [],
      references: [],
      knowledgeNotes: [],
      referenceForm: defaultReferenceForm,
      referenceQuery: referenceStarterQueries[0],
      posterCopy: defaultPosterCopy,
      mediaAssets: [],
      metrics: [],
      hiddenPostIds: [],
      manualIdea: '',
      contentSeq: 0,
    }
  }
}

// ตัวนับเลขคอนเทนต์ที่เบราว์เซอร์นี้เคยแจกจริง — เก็บแยกเป็นคีย์เล็ก ๆ: เขียนได้แม้พื้นที่เต็มเพราะรูปใหญ่ และทุกแท็บในเบราว์เซอร์เดียวกันเห็นค่าเดียวกัน
// ไม่นับเลขที่คำนวณจากข้อมูลเก่าในเครื่อง เพราะข้อมูลจากระบบจะโหลดทับ และต้องได้เลขชุดเดียวกับทุกเครื่อง
const CONTENT_SEQ_KEY = 'assetx_marketing_content_seq'
function readSeqFloor() {
  try {
    const value = Number(localStorage.getItem(CONTENT_SEQ_KEY))
    return Number.isSafeInteger(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}
function writeSeqFloor(value) {
  try { localStorage.setItem(CONTENT_SEQ_KEY, String(value)) } catch { /* เขียนไม่ได้ ตัวนับในหน้านี้ยังกันซ้ำได้ */ }
}
function storedContentSeq() {
  let saved = 0
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')?.contentSeq
    if (Number.isSafeInteger(value) && value > 0) saved = value
  } catch { /* ข้อมูลในเครื่องอ่านไม่ได้ = ไม่มีตัวนับ */ }
  return Math.max(saved, readSeqFloor())
}

function normalizePrompt(prompt) {
  const text = (prompt || '').trim()
  return text || 'เจ้าของทรัพย์ต้องการเงินก้อน แต่ยังไม่อยากขายขาด'
}

function normalizeWorkspace(workspace = {}) {
  return ensureContentNumbers({
    studio: { ...defaultStudio, ...(workspace.studio || {}) },
    generated: workspace.generated || null,
    posts: Array.isArray(workspace.posts) ? workspace.posts : [],
    savedIdeas: Array.isArray(workspace.savedIdeas) ? workspace.savedIdeas : [],
    radarIdeas: Array.isArray(workspace.radarIdeas) ? workspace.radarIdeas : [],
    references: Array.isArray(workspace.references) ? workspace.references : [],
    knowledgeNotes: Array.isArray(workspace.knowledgeNotes) ? workspace.knowledgeNotes : [],
    referenceForm: { ...defaultReferenceForm, ...(workspace.referenceForm || {}) },
    referenceQuery: workspace.referenceQuery || referenceStarterQueries[0],
    posterCopy: { ...defaultPosterCopy, ...(workspace.posterCopy || {}) },
    mediaAssets: Array.isArray(workspace.mediaAssets) ? workspace.mediaAssets : [],
    metrics: Array.isArray(workspace.metrics) ? workspace.metrics : [],
    hiddenPostIds: Array.isArray(workspace.hiddenPostIds) ? workspace.hiddenPostIds : [],
    manualIdea: workspace.manualIdea || '',
    contentSeq: workspace.contentSeq,
  })
}

function hasWorkspaceContent(workspace) {
  return Boolean(
    workspace?.generated ||
    workspace?.posts?.length ||
    workspace?.savedIdeas?.length ||
    workspace?.radarIdeas?.length ||
    workspace?.references?.length ||
    workspace?.knowledgeNotes?.length ||
    workspace?.mediaAssets?.length ||
    workspace?.metrics?.length ||
    workspace?.hiddenPostIds?.length ||
    workspace?.referenceQuery?.trim() ||
    workspace?.posterCopy?.headline?.trim() ||
    workspace?.manualIdea?.trim(),
  )
}

// สถานะโพสต์ → คำเดียวต่อสถานะ (draft / pending / needs_edit อยู่ในรายการ "รอตรวจ" เดียวกัน จึงใช้คำเดียว · ผลตรวจเกณฑ์เป็นอีกแกน: ผ่านเกณฑ์ / ติดเกณฑ์)
const statusLabels = {
  draft: 'รอตรวจ',
  pending: 'รอตรวจ',
  needs_edit: 'รอตรวจ',
  approved: 'อนุมัติแล้ว',
  scheduled: 'ตั้งเวลาแล้ว',
  posted: 'โพสต์แล้ว',
  archived: 'พักไว้',
}

// สถานะคิว (จาก organizeMarketingQueue) → คำเดียวต่อสถานะ ใช้ทั้งคิวและปฏิทิน
const queueStateLabels = {
  overdue: 'เลยกำหนด',
  today: 'ถึงกำหนดวันนี้',
  upcoming: 'ตั้งเวลาแล้ว · รอส่ง',
  unscheduled: 'ยังไม่ตั้งเวลา',
  platformScheduled: 'ตั้งเวลาแล้ว · Facebook จะโพสต์เอง',
  posted: 'โพสต์แล้ว',
}

const isSamplePost = (post) => String(post?.id || '').startsWith('sample-')
// เลขคอนเทนต์ในข้อความ: "#12 · ข้อความ" · ไม่มีเลข (ร่างตัวอย่าง / ร่างที่ยังอยู่ใน Studio) คืนข้อความเดิม
const withContentNo = (no, text) => (formatContentNo(no) ? `${formatContentNo(no)} · ${text}` : text)
const titleWithNo = (post) => withContentNo(post?.contentNo, post?.title || '')
const isFocused = (post, focusNo) => Boolean(focusNo?.no) && post?.contentNo === focusNo.no
// ร่างทั้งหมดที่หน้าแสดง (ของเรา + ร่างตัวอย่างที่ยังไม่ซ่อน) จากเวิร์กสเปซที่ให้มา
const draftsOf = (ws) => [...(ws?.posts || []), ...seedDrafts.filter((post) => !(ws?.hiddenPostIds || []).includes(post.id))]
// ร่างใน Studio ยังเป็นร่างเดิมไหม (ระหว่างรอสร้าง/ย่อรูป อาจกดร่างใหม่ไปแล้ว — รูปต้องไม่ไปผูกกับร่างใหม่)
const sameStudioDraft = (a, b) => Boolean(a && b) && a.headline === b.headline && a.imagePrompt === b.imagePrompt && a.caption === b.caption
// แท็บที่คอนเทนต์อยู่ตามสถานะ (ช่องค้นด้วยเลข และตอนเปิดลิงก์ร่างจาก Telegram)
const viewForStatus = (status) => (['pending', 'draft', 'needs_edit'].includes(status) ? 'approvals'
  : ['approved', 'scheduled', 'posted'].includes(status) ? 'queue'
    : 'library')
const LOADING_MESSAGE = 'กำลังโหลดข้อมูลจากระบบ ลองอีกครั้งในอีกสักครู่'
// แถบบนรายการร่าง/โพสต์/คลังผลงานระหว่างโหลด — บอกล่วงหน้าว่าปุ่มไหนต้องรอ (ไม่ต้องกดก่อนแล้วค่อยรู้)
const LOADING_EDIT_NOTE = 'กำลังโหลดข้อมูลจากระบบ · แก้ข้อความ อนุมัติ ตั้งเวลา พักไว้ หรือลบได้เมื่อโหลดเสร็จ'
// ตัวกรองของคลังผลงาน (ใช้ทั้งในรายการ และตอนค้นด้วยเลขว่าต้องเปลี่ยนตัวกรองไหม)
function libraryFilterMatches(post, filter) {
  if (filter === 'all') return true
  if (filter === 'active') return post.status !== 'archived' && post.status !== 'posted'
  if (filter === 'pending') return ['pending', 'draft', 'needs_edit'].includes(post.status)
  if (filter === 'needs_edit') return post.reviewStatus === 'needs_edit'
  return post.status === filter
}
const reviewLabel = (post) => (post?.reviewStatus === 'passed' ? 'ผ่านเกณฑ์' : 'ติดเกณฑ์')

// ผลตรวจเกณฑ์ซ้ำกันทุกช่อง (หัวข้อ/แคปชั่น/สคริปต์) → แสดงครั้งเดียว โดยตัดป้ายช่องออกเมื่อข้อความเดียวกันซ้ำ
function uniqueReviewNotes(notes = []) {
  const seen = new Set()
  const out = []
  for (const note of notes) {
    const key = String(note).replace(/\[[^\]]*\]\s*/g, '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key === String(note).trim() ? note : String(note).replace(/\s*\[[^\]]*\]\s*/, ' ').trim())
  }
  return out
}

function getPostTime(post) {
  const raw = post.postedAt || post.scheduledAt || post.createdAt || ''
  const time = raw ? new Date(raw).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function scheduleInputValue(raw = '') {
  const value = String(raw || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`
  return value.slice(0, 16)
}

function buildChannelPreview(post, channel) {
  if (!post) return 'เลือกหรือสร้างโพสต์ก่อน ระบบจะแสดงตัวอย่างตามช่องทางที่เลือก'
  const caption = (post.caption || '').trim()
  if (channel === 'line-oa') {
    const firstLine = caption.split('\n').find(Boolean) || post.title
    return `${firstLine}\n\nสนใจให้ AssetX Estate ช่วยประเมินเบื้องต้น ส่งจังหวัด / ประเภททรัพย์ / เนื้อที่ เข้ามาได้เลย\n\nหมายเหตุ: ทีมงานตรวจข้อมูลจริงก่อนเสนอทางเลือกทุกครั้ง`
  }
  if (channel === 'tiktok' || channel === 'youtube-shorts') {
    return post.videoScript || `Hook: ${post.title}\n\n1. เปิดด้วยปัญหาที่เจ้าของทรัพย์เจอบ่อย\n2. อธิบายทางเลือกแบบไม่สัญญาเกินจริง\n3. ปิดท้ายด้วยการชวนส่งข้อมูลเพื่อประเมินเบื้องต้น`
  }
  return caption
}

function findMediaForPost(mediaAssets = [], post = {}) {
  if (!post) return null
  return mediaAssets.find((asset) => asset.id === post.mediaAssetId)
    || mediaAssets.find((asset) => String(asset.postId || asset.briefId) === String(post.id))
    || null
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

function safeSlug(value = 'assetx-knowledge') {
  const slug = String(value)
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
  return slug || 'assetx-knowledge'
}

function mdEscape(value = '') {
  return String(value || '').replace(/\r\n/g, '\n').trim()
}

function yamlString(value = '') {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function uniqueByKey(items = [], getKey) {
  const seen = new Set()
  return items.filter((item) => {
    const key = getKey(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function referenceToKnowledgeNote(reference, context = {}) {
  const source = sourceFromId(reference.sourceId)
  const tags = Array.isArray(reference.tags) ? reference.tags : normalizeTags(reference.tags || '')
  const title = mdEscape(reference.title || 'Untitled reference')
  const createdAt = reference.createdAt || new Date().toISOString()
  return {
    id: `kb-ref-${reference.id || Date.now()}`,
    kind: 'creative-reference',
    title,
    sourceName: source.name,
    sourceUrl: reference.url || '',
    query: context.query || '',
    audience: reference.audience || '',
    channel: reference.channel || '',
    risk: reference.risk || 'medium',
    summary: reference.hook || reference.contentAngle || reference.visualPattern || '',
    keyFindings: [
      reference.hook ? `Hook: ${reference.hook}` : '',
      reference.visualPattern ? `Visual pattern: ${reference.visualPattern}` : '',
      reference.contentAngle ? `AssetX angle: ${reference.contentAngle}` : '',
    ].filter(Boolean),
    implications: [
      'ใช้เป็นแรงบันดาลใจเพื่อถอด pattern เท่านั้น ไม่คัดลอกภาพ ข้อความ โลโก้ หรือ claims ของต้นทาง',
      'นำ insight ไปทำคอนเทนต์ AssetX ที่ให้ความรู้ ชวนตรวจเอกสาร และไม่สัญญาผลลัพธ์เกินจริง',
    ],
    contentIdeas: [
      reference.contentAngle || reference.hook || 'แปลง reference นี้เป็นโพสต์ให้ความรู้ของ AssetX',
    ],
    caveats: [
      'ห้ามเก็บข้อมูลลูกค้าจริง เลขโฉนด เบอร์โทร ที่อยู่ หรือข้อมูลส่วนบุคคล',
      reference.risk === 'high' ? 'ความเสี่ยงสูง: ห้ามทำภาพหรือข้อความใกล้เคียงต้นฉบับ' : 'ตรวจความเสี่ยงด้านกฎหมาย/โฆษณาก่อนเผยแพร่',
    ],
    tags: ['assetx', 'marketing', 'reference', ...tags],
    createdAt,
  }
}

function ideaToKnowledgeNote(idea, context = {}) {
  const title = mdEscape(idea.title || 'Untitled market radar')
  const createdAt = idea.createdAt || new Date().toISOString()
  return {
    id: `kb-radar-${idea.id || Date.now()}`,
    kind: 'market-radar',
    title,
    sourceName: idea.source || 'Tavily Trend Radar',
    sourceUrl: idea.url || '',
    query: context.query || '',
    audience: idea.audience || '',
    channel: idea.channel || '',
    risk: 'medium',
    summary: idea.angle || '',
    keyFindings: [
      idea.angle || '',
      idea.score ? `Priority score: ${idea.score}` : '',
    ].filter(Boolean),
    implications: [
      'ใช้เป็นหัวข้อสำรวจตลาดหรือคอนเทนต์ให้ความรู้สำหรับ AssetX',
      'ตรวจแหล่งข่าวจริงก่อนใช้เป็นข้อเท็จจริงในโพสต์หรือคำแนะนำลูกค้า',
    ],
    contentIdeas: [
      `ทำโพสต์อธิบาย: ${title}`,
      `ทำ short video hook จากประเด็นนี้สำหรับ ${idea.audience || 'กลุ่มเป้าหมาย AssetX'}`,
    ],
    caveats: [
      'ข้อมูลตลาดจากเว็บเป็น preliminary research ต้องตรวจซ้ำกับแหล่งทางการหรือผู้เชี่ยวชาญก่อนใช้อ้างอิง',
      'หลีกเลี่ยงข้อความรับประกันอนุมัติ วงเงิน ราคาขาย หรือผลตอบแทน',
    ],
    tags: ['assetx', 'marketing', 'market-radar', 'tavily'],
    createdAt,
  }
}

function formatKnowledgeNoteMarkdown(note) {
  const tags = (note.tags || []).map((tag) => String(tag).replace(/^#/, '').trim()).filter(Boolean)
  return [
    '---',
    `title: ${yamlString(note.title)}`,
    `created: ${yamlString(note.createdAt)}`,
    `type: ${yamlString(note.kind)}`,
    `source: ${yamlString(note.sourceName)}`,
    note.sourceUrl ? `url: ${yamlString(note.sourceUrl)}` : '',
    note.query ? `query: ${yamlString(note.query)}` : '',
    note.audience ? `audience: ${yamlString(note.audience)}` : '',
    note.channel ? `channel: ${yamlString(note.channel)}` : '',
    `risk: ${yamlString(note.risk || 'medium')}`,
    `tags: [${tags.map(yamlString).join(', ')}]`,
    '---',
    '',
    `# ${note.title}`,
    '',
    '## Executive Summary',
    mdEscape(note.summary) || '-',
    '',
    '## Key Findings',
    ...(note.keyFindings || ['-']).map((item) => `- ${mdEscape(item) || '-'}`),
    '',
    '## Business Implications For AssetX Estate',
    ...(note.implications || ['-']).map((item) => `- ${mdEscape(item) || '-'}`),
    '',
    '## Marketing / Content Ideas',
    ...(note.contentIdeas || ['-']).map((item) => `- ${mdEscape(item) || '-'}`),
    '',
    '## Legal / Compliance Caveats',
    ...(note.caveats || ['-']).map((item) => `- ${mdEscape(item) || '-'}`),
    '',
    '## Sources',
    note.sourceUrl ? `- [${note.sourceName || 'Source'}](${note.sourceUrl})` : `- ${note.sourceName || 'Internal note'}`,
    '',
    '## Follow-up Questions',
    '- ข้อมูลนี้ควรต่อยอดเป็นโพสต์ให้ความรู้ โพสต์หา lead หรือสคริปต์วิดีโอแบบใด',
    '- มีแหล่งข้อมูลทางการหรือแหล่งข่าวอื่นที่ควรตรวจซ้ำหรือไม่',
    '- Hermes ควรใช้ insight นี้กับกลุ่มเป้าหมายใดก่อน',
    '',
  ].filter((line) => line !== '').join('\n')
}

function buildObsidianExport(notes = [], context = {}) {
  const exportDate = new Date().toISOString()
  const title = `AssetX Marketing Knowledge Export - ${exportDate.slice(0, 10)}`
  const uniqueNotes = uniqueByKey(notes, (note) => note.sourceUrl || `${note.kind}:${note.title}`)
  return [
    '---',
    `title: ${yamlString(title)}`,
    `created: ${yamlString(exportDate)}`,
    'type: "assetx-marketing-knowledge-export"',
    'tags: ["assetx", "marketing", "knowledge-base", "hermes", "obsidian"]',
    context.query ? `query: ${yamlString(context.query)}` : '',
    '---',
    '',
    `# ${title}`,
    '',
    'Obsidian-ready knowledge base export จาก AssetX Marketing OS',
    '',
    '## Hermes Usage',
    '- ใช้โน้ตนี้เป็น market/context memory สำหรับ Hermes',
    '- ให้ Hermes อ้างอิงเฉพาะ insight ที่มี source และหลีกเลี่ยงการสรุปเป็นข้อเท็จจริงถ้ายังไม่ได้ตรวจซ้ำ',
    '- ห้ามใช้ข้อมูลนี้แทนคำปรึกษากฎหมายหรือการประเมินทรัพย์เฉพาะเคส',
    '',
    '## Index',
    ...uniqueNotes.map((note, index) => `${index + 1}. [[${safeSlug(note.title)}|${note.title}]] - ${note.kind}`),
    '',
    '---',
    '',
    ...uniqueNotes.flatMap((note) => [
      `<!-- obsidian-note: ${safeSlug(note.title)} -->`,
      formatKnowledgeNoteMarkdown(note),
      '---',
      '',
    ]),
  ].filter((line) => line !== '').join('\n')
}

function downloadMarkdown(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function buildReferenceBrief(reference) {
  const source = sourceFromId(reference.sourceId)
  const tags = Array.isArray(reference.tags) ? reference.tags.join(', ') : reference.tags
  return [
    `ตัวอย่าง: ${reference.title}`,
    `แหล่งที่มา: ${source.name}${reference.url ? ` (${reference.url})` : ''}`,
    `กลุ่มเป้าหมาย: ${reference.audience || 'เจ้าของทรัพย์'}`,
    `ช่องทาง: ${reference.channel || 'Facebook'}`,
    `ประโยคเปิดที่น่าสนใจ: ${reference.hook || 'ยังไม่ระบุ'}`,
    `รูปแบบภาพ/วิดีโอ: ${reference.visualPattern || 'ยังไม่ระบุ'}`,
    `มุมที่ควรทำแบบ AssetX: ${reference.contentAngle || 'ถอดเป็นคอนเทนต์ให้ความรู้ที่ไม่สัญญาเกินจริง'}`,
    `ป้ายกำกับ: ${tags || '-'}`,
    '',
    'กติกา AssetX:',
    '- ใช้ตัวอย่างเพื่อเรียนรู้รูปแบบเท่านั้น ห้ามลอกภาพ/โลโก้/ข้อความคู่แข่ง',
    '- ไม่ใส่ข้อมูลส่วนตัว เลขโฉนด เบอร์โทร ที่อยู่ หรือภาพลูกค้าจริง',
    '- ไม่สัญญาว่าอนุมัติแน่นอน ได้เงินทันที หรือรับประกันผลตอบแทน',
    `- โทนภาพ: สมจริง พรีเมี่ยม สะอาด น่าเชื่อถือ ใช้สีตามโลโก้ AssetX (${assetxPalettePrompt})`,
  ].join('\n')
}

function referenceToIdea(reference) {
  const source = sourceFromId(reference.sourceId)
  return {
    id: `ref-idea-${reference.id}`,
    source: `ตัวอย่างโฆษณา · ${source.name}`,
    type: 'ตัวอย่างโฆษณา',
    score: reference.risk === 'low' ? 86 : reference.risk === 'high' ? 70 : 80,
    title: reference.title,
    angle: reference.contentAngle || reference.hook || 'นำตัวอย่างนี้มาถอดเป็นคอนเทนต์ในภาษาของ AssetX',
    audience: reference.audience || 'เจ้าของทรัพย์',
    channel: reference.channel || 'Facebook',
    status: 'ถอดรูปแบบแล้ว',
    url: reference.url || '',
  }
}

function inferStudioIntentFromIdea(sourceIdea = {}, currentStudio = {}) {
  const text = `${sourceIdea.title || ''} ${sourceIdea.type || ''} ${sourceIdea.angle || ''}`.toLowerCase()
  if (/faq|ถาม|คำถาม/.test(text)) {
    return { contentType: 'faq', objective: 'education', tone: 'simple' }
  }
  if (/ความรู้|เช็กลิสต์|ข้อควรระวัง|เข้าใจผิด|ก่อนเซ็น|ก่อนทำสัญญา|สินไถ่|ไถ่ถอน|ดอกเบี้ย|กฎหมาย|ขายฝากกับจำนอง|จำนอง.*ขายฝาก|ขายฝาก.*จำนอง/.test(text)) {
    return { contentType: 'educate', objective: 'education', tone: 'simple' }
  }
  // ไอเดียรีเสิร์ชพูดกับเจ้าของทรัพย์ที่ต้องการเงินเท่านั้น (เจ้าของเลือก 9 พ.ย. 2569) — ร่างจากแม่แบบห้ามเดาเป้าหมายเป็นหานักลงทุน/หาคนขายจากคำในหัวข้อ
  if (sourceIdea.kind === 'research') return { objective: 'lead_owner' }
  if (/นักลงทุน|ลงทุน|ราคาดี|ทรัพย์ราคา|ผลตอบแทน|investor/.test(text)) {
    return { contentType: currentStudio.contentType || 'property-highlight', objective: 'lead_investor' }
  }
  if (/ขายที่ดิน|ขายทรัพย์|ราคาตลาด|ผู้ขาย/.test(text)) {
    return { contentType: currentStudio.contentType || 'faq', objective: 'lead_seller' }
  }
  return {}
}

function trimThaiLine(value = '', max = 92) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
}

function inferPosterCopyFromBrief(brief = {}, previous = {}) {
  const text = `${brief.title || ''} ${brief.imagePrompt || ''} ${brief.videoScript || ''}`.toLowerCase()
  const keepContact = { contactLine: previous?.contactLine || '' }
  if (/ความรู้|เช็กลิสต์|ข้อควรระวัง|เข้าใจผิด|ถามบ่อย|faq|ก่อนเซ็น|ก่อนทำสัญญา|สินไถ่|ไถ่ถอน|ดอกเบี้ย|กฎหมาย|ขายฝากกับจำนอง|จำนอง.*ขายฝาก|ขายฝาก.*จำนอง/.test(text)) {
    return {
      headline: 'รู้ก่อนใช้โฉนด',
      subheadline: 'เช็กทางเลือกและเงื่อนไขก่อนตัดสินใจ',
      badge1: 'ขายฝาก',
      badge2: 'จำนอง',
      badge3: 'ข้อควรระวัง',
      trustLine: 'ข้อมูลทั่วไป ไม่ใช่คำปรึกษาเฉพาะเคส',
      areaLine: 'ดูเอกสารจริงก่อนสรุปทุกครั้ง',
      cta: 'ถาม AssetX Estate',
      ...keepContact,
    }
  }
  // เดิมมีชุด "ทรัพย์ราคาดี สำหรับนักลงทุน" เมื่อเจอคำว่า ลงทุน/ราคาดี/ผลตอบแทน — ตัดออก 9 พ.ย. 2569: เพจพูดกับเจ้าของทรัพย์ที่ต้องการเงินอย่างเดียว
  // (คำว่า "ผลตอบแทน" ในประโยคเพดานกฎหมายเคยพาโปสเตอร์ไปพูดกับนักลงทุนได้)
  if (/ขายฝาก|ไม่อยากขายขาด|เงินก้อน|สภาพคล่อง|โฉนด/.test(text)) {
    return {
      headline: 'มีโฉนด แต่ไม่อยากขายขาด',
      subheadline: 'เปลี่ยนที่ดินเป็นเงินทุนอย่างเป็นระบบ',
      badge1: 'ประเมินเบื้องต้น',
      badge2: 'ปรึกษาฟรี',
      badge3: 'ดูแลเอกสาร',
      trustLine: 'ตรวจข้อมูลก่อนเสนอทางเลือก',
      areaLine: 'ให้บริการตามพื้นที่ที่ประเมินได้',
      cta: 'ติดต่อ AssetX Estate',
      ...keepContact,
    }
  }
  if (/จำนอง|mortgage|หลักประกัน/.test(text)) {
    return {
      headline: 'ใช้ที่ดินเป็นหลักประกัน',
      subheadline: 'วางทางเลือกจำนองอย่างเป็นระบบ',
      badge1: 'เช็กเอกสาร',
      badge2: 'ประเมินทำเล',
      badge3: 'ดูความเหมาะสม',
      trustLine: 'ไม่ฟันธงวงเงินก่อนตรวจจริง',
      areaLine: 'รองรับทรัพย์หลายประเภท',
      cta: 'ให้ AssetX Estate ช่วยประเมิน',
      ...keepContact,
    }
  }
  if (/เอกสาร|เช็กลิสต์|โฉนด|ตรวจ/.test(text)) {
    return {
      headline: 'ก่อนใช้โฉนด ต้องเช็กอะไรบ้าง',
      subheadline: 'เตรียมเอกสารให้พร้อมก่อนประเมิน',
      badge1: 'โฉนด',
      badge2: 'ทำเล',
      badge3: 'ภาระผูกพัน',
      trustLine: 'ตรวจข้อมูลจริงก่อนเสนอทางเลือก',
      areaLine: 'ลดความผิดพลาดก่อนยื่นข้อมูล',
      cta: 'ขอเช็กลิสต์จาก AssetX Estate',
      ...keepContact,
    }
  }
  if (/เสี่ยง|หลุด|pre-market|ครบกำหนด|ค้าง/.test(text)) {
    return {
      headline: 'ทรัพย์เสี่ยงหลุด ควรเตรียมอะไร',
      subheadline: 'วางแผนเอกสาร ราคา และช่องทางขายล่วงหน้า',
      badge1: 'สำรวจทรัพย์',
      badge2: 'ประเมินราคา',
      badge3: 'เตรียมการตลาด',
      trustLine: 'ไม่เปิดเผยข้อมูลลูกค้า',
      areaLine: 'ใช้สำหรับวางแผนภายใน',
      cta: 'ให้ AssetX Estate ช่วยจัดระบบ',
      ...keepContact,
    }
  }
  const title = String(brief.title || '').trim()
  return {
    ...defaultPosterCopy,
    headline: title && title.length <= 32 ? title : defaultPosterCopy.headline,
    ...keepContact,
  }
}

function buildPosterCopy(brief = {}, copyInput = {}) {
  const copy = { ...defaultPosterCopy, ...(copyInput || {}) }
  const title = String(brief.title || 'โฉนดที่ดิน').replace(/\s+/g, ' ').trim()
  const headline = copy.headline?.trim() || (title.length > 34 ? 'รับจำนอง · ขายฝาก โฉนดที่ดิน' : title)
  const benefits = [copy.badge1, copy.badge2, copy.badge3].map((item) => String(item || '').trim()).filter(Boolean).join(' | ')
  const contactLine = String(copy.contactLine || '').trim()
  return [
    'Create a complete Thai social media poster with the following exact text rendered in the image:',
    `HEADLINE: ${headline}`,
    `SUBHEADLINE: ${copy.subheadline || defaultPosterCopy.subheadline}`,
    `BENEFIT BADGES: ${benefits || 'ประเมินเบื้องต้น | ปรึกษาฟรี | ดูแลเอกสาร'}`,
    `TRUST BADGE: ${copy.trustLine || defaultPosterCopy.trustLine}`,
    `AREA LABEL: ${copy.areaLine || defaultPosterCopy.areaLine}`,
    `CTA: ${copy.cta || defaultPosterCopy.cta}`,
    contactLine ? `CONTACT LINE: ${contactLine}` : '',
    '',
    'Text design requirements: bold Thai display headline, high contrast, clean hierarchy, readable on mobile, integrated like a finished Facebook/LINE poster.',
    'Use generic marketing icons such as check mark, map pin, chat bubble, percent symbol, document icon, shield icon.',
    contactLine
      ? 'Use only this text and the provided contact line. Do not add deed numbers, addresses, random logos, random watermarks, or unrelated company names.'
      : 'Use only this text. Do not add phone numbers, deed numbers, addresses, random LINE IDs, random logos, random watermarks, or unrelated company names.',
  ].filter(Boolean).join('\n')
}

// v2 (7 พ.ย. 2569): ใช้ระบบออกแบบโปสเตอร์ร่วมกับคิวสร้างภาพบนคอมสำนักงาน — การ์ดเนื้อหาตามโครงโพสต์แทนป้าย 3 ป้าย (ถอดจากตัวอย่างโปสเตอร์ของเจ้าของ · คงโทนน้ำเงิน-ไซยาน)
function buildSocialPosterPrompt(brief = {}, posterCopy = defaultPosterCopy) {
  const baseVisual = String(brief.imagePrompt || brief.title || '').trim()
  const body = stripEmoji(String(brief.caption || brief.body || '')).replace(/\s+\n/g, '\n').trim().slice(0, 1500)
  const layout = body ? pickPosterLayout(body) : 'explain'
  const keyword = pickHeadlineKeyword(String(brief.title || posterCopy?.headline || ''))
  return [
    'Create a ready-to-post vertical 4:5 Thai social media marketing poster for AssetX Estate, a Thai real-estate consultancy for ขายฝาก (sale with right of redemption) and จำนอง (mortgage).',
    '',
    POSTER_DESIGN_SYSTEM,
    '',
    'Core content:',
    buildPosterCopy(brief, posterCopy),
    '',
    ...(keyword ? [`KEY WORD to highlight in the headline (this whole word only): ${keyword}`, ''] : []),
    body
      ? ['POST CONTENT (context: build the ribbon, the main card and the action panel from it; do not paste it whole):', '"""', body, '"""', '', `CONTENT CARD (layout: ${layout}): ${posterLayoutInstruction(layout)} Every row on the card must be copied exactly from the post text, read as a complete idea on its own and not start with a connecting word such as และ, หรือ, แต่ or ที่. If a row cannot be copied safely, use fewer rows.`, 'BENEFIT RIBBON: one complete phrase of 4-10 Thai words copied from the post that tells the reader what they get. ACTION PANEL: 2 or 3 complete clauses of 5-12 Thai words copied from the post that tell the reader what to do next. READABILITY TEST: the headline, ribbon, card rows and action items alone must tell the whole story of the post.', '', posterBriefFor({ title: String(brief.title || posterCopy?.headline || ''), caption: body, layout }).brief].join('\n')
      : 'MAIN CARD: use the three benefit badges above as a checklist card with cyan check circles; no action panel.',
    '',
    'Hero zone content (small, beside the headline, never reducing the content area):',
    baseVisual || 'Pick the one scene from the design system that matches the topic: a plain generic title-deed document with a pen, an open land plot with boundary pegs, a modern Thai house, coin stacks, or a calm consultation desk; a head-and-shoulders advisor only if the post is about advice.',
    '',
    'RULES:',
    ...POSTER_TEXT_RULES.map((rule) => `- ${rule}`),
    '- Do not use real customer information.',
  ].join('\n')
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('โหลดรูปไม่สำเร็จ'))
    image.src = dataUrl
  })
}

async function compressImageFile(file, maxSize = 1500, quality = 0.84) {
  const original = await readFileAsDataUrl(file)
  const image = await loadImage(original)
  const ratio = Math.min(1, maxSize / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * ratio))
  const height = Math.max(1, Math.round(image.height * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return {
    dataUrl,
    mimeType: 'image/jpeg',
    width,
    height,
    size: Math.round((dataUrl.length * 3) / 4),
    originalName: file.name,
  }
}

export default function MarketingPage({ onBack }) {
  const [workspace, setWorkspace] = useState(loadWorkspace)
  // เวิร์กสเปซล่าสุดเสมอ — ตัวจัดการที่ต้องรอเครือข่ายหรือไฟล์ต่อยอดจากของล่าสุด ไม่ใช่สำเนาก่อนรอ (ไม่งั้นงานที่ทำระหว่างรอหาย)
  const workspaceRef = useRef(workspace)
  // เลขคอนเทนต์สูงสุดที่แจกไปแล้ว — ไม่ถอยหลังแม้มีการบันทึกสำเนาเก่าหรือโหลดจากระบบทับ จึงไม่แจกเลขเดิมให้คอนเทนต์ชิ้นอื่น
  // อ่านจากเครื่องครั้งเดียวตอนเปิดหน้า (ข้อมูลในเครื่องมีรูปขนาดใหญ่ อย่าอ่านซ้ำทุกครั้งที่หน้าวาดใหม่)
  const seqFloorRef = useRef(null)
  if (seqFloorRef.current === null) seqFloorRef.current = storedContentSeq()
  const commitWorkspace = (next) => {
    workspaceRef.current = next
    setWorkspace(next)
  }
  const numbered = (input) => {
    // ตัวนับ = สูงสุดของ (ในหน้านี้ · แท็บอื่นในเบราว์เซอร์เดียวกัน) → เลขที่แจกไปแล้วไม่ถูกแจกซ้ำ
    const floor = Math.max(seqFloorRef.current, readSeqFloor())
    const next = ensureContentNumbers(input, { floor })
    seqFloorRef.current = next.contentSeq
    if (next.contentSeq > floor) writeSeqFloor(next.contentSeq)
    return next
  }
  // ระหว่างรอข้อมูลจากระบบตอนเปิดหน้า: การสร้างของใหม่ (ร่างใหม่ ช่องไอเดีย พรอมต์ Studio) ทำกับสำเนาในเครื่องก่อน และจดไว้ทำซ้ำบนข้อมูลจากระบบเมื่อมาถึง
  // (เดิมข้อมูลจากระบบทับทั้งก้อน งานที่ทำระหว่างรอหาย) · การกระทำกับคอนเทนต์ที่มีอยู่แล้วต้องรอให้โหลดเสร็จ (blockedWhileLoading)
  // · ยังไม่แจกเลขใหม่จนกว่าจะรู้ตัวนับของระบบ
  const loadSettledRef = useRef(false)
  const pendingRef = useRef([])
  const mountWorkspaceRef = useRef(workspace)
  const toastTimerRef = useRef(null)
  const toolsRef = useRef(null)
  const [view, setView] = useState('ideas')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [findText, setFindText] = useState('')
  // คอนเทนต์ที่เพิ่งค้นด้วยเลข { no, at } → เลื่อนไปที่การ์ดและไฮไลต์ชั่วครู่ (สถานะหน้าจอ ไม่บันทึกลงเวิร์กสเปซ)
  const [focusNo, setFocusNo] = useState(null)
  // ไอเดียที่เพิ่งย้อนกลับจากแท็บร่าง → แท็บไอเดียยกขึ้นบนสุดและไฮไลต์ (สถานะหน้าจอ ไม่บันทึก)
  const [returnedIdea, setReturnedIdea] = useState(null)
  // คิดคอนเทนต์ใหม่ด้วย AI: งานในคิวบนคอมสำนักงาน { [jobId]: job } + สถานะตัวรับงาน (สถานะหน้าจอ · งานจริงอยู่ในตาราง marketing_content_jobs)
  const [contentJobs, setContentJobs] = useState({})
  const [contentWorker, setContentWorker] = useState(null)
  // ไอเดียที่เพิ่งได้มุมใหม่จาก AI { id, at } → การ์ดเลือกมุมใหม่ (ช่องแรก) และไฮไลต์ (สถานะหน้าจอ ไม่บันทึก)
  const [freshIdea, setFreshIdea] = useState(null)
  // งานที่จัดการผลแล้วในหน้านี้ (กันสร้างร่างซ้ำระหว่างรอ) และงานล้มที่แจ้งไปแล้ว · ตามงานเก่าตอนเปิดหน้าครั้งเดียว
  const freshHandledRef = useRef(new Set())
  const freshResumedRef = useRef(false)
  // ข้อความใต้ช่องค้น { text, at } — ส่งข้อความเดิมซ้ำก็นับเวลาใหม่และอ่านออกเสียงใหม่
  const [findMsg, setFindMsg] = useState(null)
  // คลังผลงาน: ชิ้นที่เพิ่งค้นด้วยเลข → ช่องตัวอย่างช่องทางแสดงชิ้นนี้ (สถานะหน้าจอ ไม่บันทึก)
  const [libraryPreviewId, setLibraryPreviewId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [libraryFilter, setLibraryFilter] = useState('active')
  const [librarySort, setLibrarySort] = useState('newest')
  const [previewChannel, setPreviewChannel] = useState('facebook')
  const [metricForm, setMetricForm] = useState({ title: '', channel: 'Facebook', leads: 0, qualified: 0, appointments: 0, notes: '' })
  const [visualStyleId, setVisualStyleId] = useState('assetx-social-poster')
  const [mediaLoading, setMediaLoading] = useState(null)
  const [mediaResult, setMediaResult] = useState(null)
  const [selectedBriefId, setSelectedBriefId] = useState('generated')
  const [selectedReferenceId, setSelectedReferenceId] = useState(null)
  const [cloudReady, setCloudReady] = useState(false)
  // สถานะการบันทึกเวิร์กสเปซ: loading | saved | saving | local (โหลดจากระบบไม่ได้) | failed (บันทึกขึ้นระบบไม่สำเร็จ)
  const [syncState, setSyncState] = useState({ state: 'loading', at: null })
  const [radarLoading, setRadarLoading] = useState(false)
  const [referenceLoading, setReferenceLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [facebookConnection, setFacebookConnection] = useState({ loading: true, connected: false })
  const [facebookPublishingId, setFacebookPublishingId] = useState(null)
  const [artworkBrief, setArtworkBrief] = useState(null)
  // คิวไอเดียจากระบบรีเสิร์ช: state = loading | ok | unauthorized | unavailable | error (ไม่เงียบอีกต่อไป)
  const [researchFeed, setResearchFeed] = useState({ state: 'loading', ideas: [], total: 0, meta: null, httpStatus: null, fetchedAt: null })
  const researchIdeas = researchFeed.ideas
  const setResearchIdeas = (updater) => setResearchFeed((feed) => ({ ...feed, ideas: typeof updater === 'function' ? updater(feed.ideas) : updater }))

  // ไอเดียจากการสำรวจตลาด (เก็บในเวิร์กสเปซ) และหัวข้อตัวอย่างจากแม่แบบ — แยกกองกับไอเดียรีเสิร์ช ไม่ปนลำดับกัน
  const radarCards = useMemo(() => (workspace.radarIdeas || []).map((idea) => ({ ...idea, kind: 'radar' })), [workspace.radarIdeas])
  const exampleCards = useMemo(() => prioritizeMarketingIdeas(seedIdeas).map((idea) => ({ ...idea, kind: 'example' })), [])
  const allDrafts = useMemo(
    () => [...workspace.posts, ...seedDrafts.filter((post) => !workspace.hiddenPostIds.includes(post.id))],
    [workspace.posts, workspace.hiddenPostIds],
  )
  const pendingDrafts = useMemo(() => allDrafts
    .filter((post) => ['pending', 'draft', 'needs_edit'].includes(post.status))
    .map((post) => {
      const review = reviewAssetxContent(post)
      return {
        ...post,
        reviewStatus: review.ok ? 'passed' : 'needs_edit',
        reviewNotes: [...review.notes, 'ผลตรวจเบื้องต้น ต้องตรวจข้อเท็จจริงก่อนอนุมัติ'],
      }
    }), [allDrafts])
  const approvedDrafts = allDrafts.filter((post) => post.status === 'approved' || post.status === 'scheduled' || post.status === 'posted')
  const queueGroups = organizeMarketingQueue(approvedDrafts)
  const selectedDraft = allDrafts.find((post) => post.id === selectedId) || allDrafts[0]
  const dashboardCounts = {
    ideas: researchIdeas.length,
    approvals: pendingDrafts.filter((post) => !isSamplePost(post)).length,
    ready: queueGroups.action.length,
    saved: workspace.savedIdeas.length,
    references: workspace.references?.length || 0,
    knowledge: workspace.knowledgeNotes?.length || 0,
    library: allDrafts.length + workspace.savedIdeas.length,
  }
  const selectedReference = (workspace.references || []).find((item) => item.id === selectedReferenceId) || (workspace.references || [])[0]

  // ทุกการบันทึก = "ฟังก์ชันที่ทำกับเวิร์กสเปซล่าสุด" ไม่ใช่สำเนาตอนหน้าวาดครั้งก่อน → การกดที่มาถึงพร้อมผลของงานที่รอเครือข่าย
  // หรือพร้อมข้อมูลจากระบบตอนเปิดหน้า ไม่ทับกัน · ทุกการบันทึกผ่านตัวแจกเลขคอนเทนต์ (คอนเทนต์ใหม่ทุกทางได้เลขทันที)
  // requireLocal: บันทึกลงเครื่องไม่ได้ = โยนข้อผิดพลาดและไม่เปลี่ยนอะไร (ใช้ตอนยังไม่ได้เชื่อมระบบ)
  const save = (update, { requireLocal = false } = {}) => {
    const apply = typeof update === 'function' ? update : () => update
    const raw = apply(workspaceRef.current)
    const next = loadSettledRef.current ? numbered(raw) : raw
    let stored = true
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      stored = false
    }
    if (!stored && requireLocal) throw new Error('พื้นที่เก็บข้อมูลในเครื่องเต็ม กรุณาเชื่อมต่อระบบจัดเก็บก่อนบันทึกภาพ')
    // จดไว้ทำซ้ำบนข้อมูลจากระบบ (เฉพาะแบบฟังก์ชัน — สำเนาทั้งก้อนห้ามทำซ้ำ ไม่งั้นจะทับข้อมูลจากระบบ)
    if (!loadSettledRef.current && typeof update === 'function') pendingRef.current.push(update)
    commitWorkspace(next)
    // พื้นที่เก็บในเบราว์เซอร์เต็ม (รูปใหญ่หลายรูป) — ข้อมูลยังอยู่ในหน้าและจะบันทึกขึ้นระบบตามปกติ ไม่โยน DOMException ภาษาอังกฤษขึ้นจอ
    if (!stored) notify('พื้นที่เก็บในเบราว์เซอร์เต็ม ข้อมูลยังอยู่ในหน้านี้และจะบันทึกขึ้นระบบต่อไป', 'error')
    return next
  }

  // คิวไอเดียจากระบบรีเสิร์ช — บอกสถานะจริงเสมอ: โหลดอยู่ / โหลดได้ / เซสชันหมดอายุ / ฝั่งเซิร์ฟเวอร์ยังไม่พร้อม / โหลดไม่ได้
  const loadResearchIdeas = async () => {
    setResearchFeed((feed) => ({ ...feed, state: feed.ideas.length ? feed.state : 'loading' }))
    try {
      // per_subtype=10 (เพดานของ API) + limit=60 → ได้ทุกใบในคิวปกติ ไม่ติดเพดาน 3 ใบต่อประเภท ตัวเลขบนแท็บจึงตรงกับคิวจริง
      const res = await fetch('/api/marketing-ideas?status=new&per_subtype=10&limit=60')
      const data = await res.json().catch(() => null)
      if (res.status === 401) return setResearchFeed((feed) => ({ ...feed, state: 'unauthorized', httpStatus: 401 }))
      if (res.status === 503) return setResearchFeed((feed) => ({ ...feed, state: 'unavailable', httpStatus: 503 }))
      if (!res.ok || !data || !Array.isArray(data.ideas)) return setResearchFeed((feed) => ({ ...feed, state: 'error', httpStatus: res.status }))
      setResearchFeed({
        state: 'ok',
        ideas: data.ideas.map(researchIdeaToCard),
        total: Number(data.total) || data.ideas.length,
        meta: data.meta || null,
        httpStatus: res.status,
        fetchedAt: new Date().toISOString(),
      })
    } catch {
      setResearchFeed((feed) => ({ ...feed, state: 'error', httpStatus: null }))
    }
  }

  useEffect(() => {
    loadResearchIdeas()
    // กลับมาที่แท็บนี้หลังปล่อยทิ้งไว้ → โหลดคิวใหม่ (อ่านอย่างเดียว) ให้แถบสถานะไม่ค้างค่าเก่า
    const onVisible = () => { if (document.visibilityState === 'visible') loadResearchIdeas() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    let cancelled = false
    getMarketingWorkspace()
      .then(async (remote) => {
        if (cancelled) return
        const incomingId = new URLSearchParams(window.location.search).get('hermesDraft')
        // ฐาน = ข้อมูลจากระบบ (ชนะเสมอ ตามเดิม) หรือสำเนาในเครื่องตอนเปิดหน้าถ้าระบบยังไม่มีข้อมูล → แล้วทำซ้ำการแก้ระหว่างรอทับลงไป
        // เลขของคอนเทนต์เก่าที่ยังไม่มีเลข คิดจากฐานล้วน ๆ (normalizeWorkspace) ทุกเครื่องจึงได้เลขเดียวกัน · ตัวนับของเครื่องนี้ยกขึ้นทีหลังใน numbered()
        const hasCloud = Boolean(remote?.payload && hasWorkspaceContent(remote.payload))
        let base = numbered(hasCloud ? normalizeWorkspace(remote.payload) : mountWorkspaceRef.current)
        let savedAt = hasCloud ? (remote.updated_at || null) : null
        // ผลของลิงก์ร่างจาก Telegram { postId?, text, type? } → แจ้งและเปิดแท็บหลังโหลดเสร็จ
        let importNotice = null
        if (incomingId) {
          // ลิงก์ร่างจาก Telegram เสีย/หมดอายุ → แจ้งแล้วโหลดข้อมูลตามปกติต่อ (เดิมลิงก์เสียทำให้หยุดบันทึกขึ้นระบบทั้ง session)
          const hermesId = `hermes-${incomingId}`
          let keepLink = false
          try {
            if (!/^[a-f0-9]{32}$/.test(incomingId)) throw new Error('Invalid Hermes draft link')
            let incoming
            try {
              incoming = await getMarketingWorkspace(`hermes-draft-${incomingId}`)
            } catch (fetchError) {
              // อ่านร่างไม่ได้เพราะเครือข่าย (ไม่ใช่ลิงก์เสีย) → คงลิงก์ไว้ลองใหม่ได้
              keepLink = true
              throw fetchError
            }
            if (cancelled) return
            if (!incoming?.payload || incoming.payload.id !== incomingId) throw new Error('Hermes draft not found')
            const raw = importHermesDraft(base, incoming.payload)
            if (raw !== base) {
              // แจกเลขก่อนบันทึก ข้อมูลในระบบจึงมีเลขของร่างนี้ตั้งแต่แรก · การแก้ระหว่างรอบันทึกจะทำซ้ำต่อท้ายและได้เลขถัดไป
              const imported = numbered(raw)
              try {
                await saveMarketingWorkspace(imported)
              } catch (saveError) {
                // ลิงก์ใช้ได้ แต่บันทึกขึ้นระบบไม่สำเร็จ (เช่น เน็ตมือถือหลุด) → คงลิงก์ไว้ให้รีเฟรชลองใหม่ · เลขที่แจกไปแล้วข้ามไป ไม่ใช้ซ้ำ
                keepLink = true
                throw saveError
              }
              if (cancelled) return
              base = imported
              savedAt = new Date().toISOString()
              importNotice = { postId: hermesId, text: 'นำเข้าร่างจากผู้ช่วย Telegram แล้ว · รอตรวจ' }
            } else if ((base.hiddenPostIds || []).includes(hermesId)) {
              // เคยนำเข้าแล้วถูกลบทิ้ง → ไม่นำเข้าซ้ำ และบอกเหตุผล (เดิมเปิดแท็บ ร่าง เฉย ๆ)
              importNotice = { text: 'ร่างจาก Telegram นี้ถูกลบไปแล้ว จึงไม่นำเข้าซ้ำ', type: 'warn' }
            } else {
              importNotice = { postId: hermesId, text: 'ร่างนี้นำเข้าไว้แล้ว' }
            }
          } catch (importError) {
            if (cancelled) return
            console.warn('hermes draft import failed:', importError?.message || importError)
            importNotice = keepLink
              // ไม่บอกให้รีเฟรชทันที: เน็ตยังหลุดอยู่ การรีเฟรชตอนนี้ทำให้งานที่ยังไม่ขึ้นระบบหาย (แถบด้านบนบอกสถานะการบันทึก)
              ? { text: 'ยังนำเข้าร่างจาก Telegram ไม่ได้ · ลิงก์ยังอยู่ · เมื่อแถบด้านบนขึ้น "บันทึกแล้ว" ให้รีเฟรชเพื่อนำเข้าอีกครั้ง', type: 'error' }
              : { text: 'นำเข้าร่างจากผู้ช่วย Telegram ไม่สำเร็จ ลิงก์อาจหมดอายุหรือไม่ถูกต้อง', type: 'error' }
          }
          // ลิงก์ใช้ครั้งเดียว: เอาออกจากแถบที่อยู่ รีเฟรชแล้วจะไม่นำเข้าซ้ำ (ยกเว้นบันทึกไม่สำเร็จ ต้องรีเฟรชลองใหม่ได้)
          if (!keepLink) {
            try {
              const url = new URL(window.location.href)
              url.searchParams.delete('hermesDraft')
              window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
            } catch { /* ข้ามได้ */ }
          }
        }
        if (cancelled) return
        let next = base
        for (const apply of pendingRef.current) next = numbered(apply(next))
        pendingRef.current = []
        loadSettledRef.current = true
        commitWorkspace(next)
        // พื้นที่ในเบราว์เซอร์เต็มต้องไม่ทำให้หยุดบันทึกขึ้นระบบ — ข้อมูลชุดนี้มาจากระบบอยู่แล้ว
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ข้ามได้ */ }
        if (importNotice) {
          const post = importNotice.postId ? draftsOf(next).find((item) => item.id === importNotice.postId) : null
          // เปิดแท็บที่ร่างอยู่ตามสถานะ (ร่างที่นำเข้าไว้แล้วอาจถูกอนุมัติหรือพักไว้แล้ว) และไฮไลต์การ์ด
          if (post) openContent(post)
          notify(post ? withContentNo(post.contentNo, importNotice.text) : importNotice.text, importNotice.type)
        }
        setSyncState({ state: 'saved', at: savedAt })
        setCloudReady(true)
      })
      .catch((error) => {
        if (cancelled) return
        console.warn('load marketing workspace failed:', error?.message || error)
        // โหลดจากระบบไม่ได้ → ทำงานกับสำเนาในเครื่องต่อ (การแก้ระหว่างรออยู่ในนั้นแล้ว) และเริ่มแจกเลขจากสำเนานี้
        pendingRef.current = []
        loadSettledRef.current = true
        const next = numbered(workspaceRef.current)
        commitWorkspace(next)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ข้ามได้ */ }
        setSyncState({ state: 'local', at: null })
        setCloudReady(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!cloudReady) return undefined
    const timer = window.setTimeout(() => {
      setSyncState((prev) => ({ ...prev, state: 'saving' }))
      saveMarketingWorkspace(workspace)
        .then(() => setSyncState({ state: 'saved', at: new Date().toISOString() }))
        .catch(() => setSyncState({ state: 'failed', at: null }))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [workspace, cloudReady])

  // ค้นด้วยเลข → เลื่อนไปที่การ์ดหลังหน้าเปลี่ยนแล้ว และไฮไลต์ชั่วครู่
  useEffect(() => {
    if (!focusNo) return undefined
    const scrollTimer = window.setTimeout(() => {
      const card = document.querySelector(`[data-content-no="${focusNo.no}"]`)
      if (!card) return
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      // หัวหน้าติดบนจอ (จอกว้าง) และสูงไม่คงที่ (แถบสถานะ/แท็บขึ้นบรรทัดใหม่ได้) → วัดจริงทุกครั้ง การ์ดจึงไม่ไปอยู่ใต้หัว
      const head = document.querySelector('.mx-head')
      const sticky = head && getComputedStyle(head).position === 'sticky'
      const offset = (sticky ? head.getBoundingClientRect().height : 0) + 12
      window.scrollTo({ top: Math.max(0, card.getBoundingClientRect().top + window.scrollY - offset), behavior: reduceMotion ? 'auto' : 'smooth' })
      // คนใช้แป้นพิมพ์/โปรแกรมอ่านหน้าจอรู้ตำแหน่ง: โฟกัสไปที่ป้ายเลขของการ์ด (แป้นพิมพ์มือถือปิดเอง)
      card.querySelector('.mx-no')?.focus({ preventScroll: true })
    }, 80)
    const clearTimer = window.setTimeout(() => setFocusNo(null), 3200)
    return () => {
      window.clearTimeout(scrollTimer)
      window.clearTimeout(clearTimer)
    }
  }, [focusNo])

  // ข้อความใต้ช่องค้นหายเองหลังอ่านทัน (ส่งซ้ำ = ออบเจกต์ใหม่ จึงนับเวลาใหม่)
  useEffect(() => {
    if (!findMsg) return undefined
    const timer = window.setTimeout(() => setFindMsg(null), 6000)
    return () => window.clearTimeout(timer)
  }, [findMsg])

  // เปลี่ยนหน้า = ข้อความใต้ช่องค้นหมดความหมาย (เดิมค้างบังปุ่มของหน้าใหม่)
  useEffect(() => { setFindMsg(null) }, [view])

  // เมนูเครื่องมือปิดเมื่อคลิกนอกเมนู โฟกัสออกนอกเมนู (กด Tab ผ่านรายการสุดท้าย) หรือกด Esc (เดิมค้างเปิดบังข้อความใต้ช่องค้นและปุ่มอื่น)
  // ใช้ click ไม่ใช่ pointerdown: เลื่อนจอด้วยนิ้วบนมือถือไม่ทำให้เมนูปิด
  useEffect(() => {
    if (!toolsOpen) return undefined
    const closeIfOutside = (event) => { if (!toolsRef.current?.contains(event.target)) setToolsOpen(false) }
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      const inside = toolsRef.current?.contains(document.activeElement)
      setToolsOpen(false)
      if (inside) toolsRef.current.querySelector('summary')?.focus()
    }
    document.addEventListener('click', closeIfOutside)
    document.addEventListener('focusin', closeIfOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', closeIfOutside)
      document.removeEventListener('focusin', closeIfOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [toolsOpen])

  useEffect(() => {
    let cancelled = false
    fetch('/api/marketing-facebook')
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (response.status === 401) {
          if (!cancelled) setFacebookConnection({ loading: false, connected: false, unauthorized: true })
          return
        }
        if (!response.ok) throw new Error(friendlyApiError(response.status, data, 'ตรวจการเชื่อมต่อ Facebook ไม่สำเร็จ'))
        if (!cancelled) setFacebookConnection({ loading: false, ...data })
      })
      .catch((error) => {
        if (!cancelled) setFacebookConnection({ loading: false, connected: false, error: errorMessage(error, 'ตรวจการเชื่อมต่อ Facebook ไม่สำเร็จ') })
      })
    return () => { cancelled = true }
  }, [])

  // บันทึกขึ้นระบบไม่สำเร็จ → กดลองใหม่ได้ทันที (ส่งก้อนเดียวกับที่ autosave จะส่ง · เกิดจากการกดของคนเท่านั้น ไม่ใช่ตอนเปิดหน้า)
  const retrySave = () => {
    if (!cloudReady) return
    setSyncState((prev) => ({ ...prev, state: 'saving' }))
    saveMarketingWorkspace(workspaceRef.current)
      .then(() => setSyncState({ state: 'saved', at: new Date().toISOString() }))
      .catch(() => setSyncState({ state: 'failed', at: null }))
  }

  // ข้อความแจ้งผลชิ้นใหม่ได้เวลาเต็มเสมอ (เดิมตัวจับเวลาของข้อความก่อนหน้าลบข้อความใหม่ทิ้งในไม่ถึงวินาที)
  // type: success · warn (สิ่งที่ขอไม่ได้เกิดขึ้น เพราะสถานะเปลี่ยน/ต้องรอ — สีเหลือง) · error · warn/error ค้างนานกว่าให้อ่านทัน
  const notify = (message, type = 'success') => {
    window.clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = window.setTimeout(() => setToast(null), type === 'success' ? 2200 : 4500)
  }

  // ระหว่างโหลดข้อมูลจากระบบ หน้าจอยังแสดงสำเนาในเครื่องที่อาจเก่ากว่าระบบ → การกระทำกับของที่มีอยู่แล้ว
  // (แก้ข้อความ อนุมัติ ตั้งเวลา พักไว้ ลบ โพสต์) รอให้โหลดเสร็จก่อน ไม่งั้นจะไปลงกับฉบับในระบบที่คนยังไม่เห็น
  const blockedWhileLoading = () => {
    if (loadSettledRef.current) return false
    notify(LOADING_MESSAGE, 'warn')
    return true
  }

  const updatePost = (id, patch, message) => {
    if (blockedWhileLoading()) return
    // ใช้เวิร์กสเปซล่าสุด: ถูกเรียกหลังรอเครือข่ายได้ (เช่น หลังส่ง Facebook) ต้องไม่ทับงานที่เกิดระหว่างรอ
    const latest = workspaceRef.current
    if (String(id).startsWith('sample-')) {
      // ร่างตัวอย่างนี้ถูกแก้จนกลายเป็นร่างจริงไปแล้ว (เหตุการณ์ที่ยังถือ id เก่ามาถึงทีหลัง) → แก้ที่ร่างจริงชิ้นนั้น ไม่สร้างสำเนาซ้ำ
      const clone = (latest.posts || []).find((post) => post.sampleOf === id)
      if (clone) id = clone.id
    }
    const current = draftsOf(latest).find((post) => post.id === id)
    if (!current) {
      // คอนเทนต์นี้ถูกลบไประหว่างรอ (เช่น ระหว่างส่ง Facebook) — ไม่ตรวจ ไม่บันทึก แจ้งตามจริง
      if (message) notify(`${message} · แต่คอนเทนต์นี้ถูกลบจากหน้านี้ไปแล้ว`, 'warn')
      return
    }
    if (Object.hasOwn(patch, 'caption') || Object.hasOwn(patch, 'channel')) {
      const review = reviewAssetxContent({ ...current, ...patch })
      patch = { ...patch, status: 'pending', reviewStatus: review.ok ? 'passed' : 'needs_edit', reviewNotes: [...review.notes, 'ข้อความเปลี่ยนแล้ว ต้องตรวจและอนุมัติใหม่'] }
    }
    if (['approved', 'scheduled'].includes(patch.status)) {
      const review = reviewAssetxContent({ ...current, ...patch })
      if (!review.ok) {
        notify(review.notes.join('\n'), 'error')
        patch = { reviewStatus: 'needs_edit', reviewNotes: review.notes, status: 'needs_edit' }
        message = ''
      } else {
        patch = { ...patch, reviewStatus: 'passed', reviewNotes: [...review.notes, 'ผ่านการตรวจเบื้องต้น ณ เวลาอนุมัติ'] }
      }
    }
    if (String(id).startsWith('sample-')) {
      // ร่างตัวอย่างแก้ครั้งแรก = กลายเป็นร่างจริงของเรา และซ่อนตัวอย่างเดิม (ไม่งั้นได้สำเนาเพิ่มทุกครั้งที่พิมพ์) · ได้เลขคอนเทนต์ตอนนี้
      const post = { ...current, id: Date.now(), sampleOf: id, ...patch }
      const next = save((ws) => ({ ...ws, posts: [post, ...(ws.posts || [])], hiddenPostIds: [...new Set([...(ws.hiddenPostIds || []), id])] }))
      setSelectedId(post.id)
      // message === '' = ผู้เรียกตั้งใจไม่ให้มีข้อความ (เช่น อนุมัติไม่ผ่านเกณฑ์ ต้องเห็นเหตุผลที่เพิ่งแจ้ง) — ไม่ทับด้วยข้อความอื่น
      const text = message === undefined ? 'สร้างร่างของเราจากตัวอย่างแล้ว' : message
      if (text) notify(withContentNo(contentNoOf(next, post.id), text))
      return
    }
    save((ws) => ({ ...ws, posts: (ws.posts || []).map((post) => post.id === id ? { ...post, ...patch } : post) }))
    if (message) notify(withContentNo(current.contentNo, message))
  }

  const attachDesignedArtwork = async (image) => {
    // ระหว่างโหลดข้อมูลจากระบบ ร่าง/โพสต์ที่เห็นอาจไม่ใช่ฉบับล่าสุด → หน้าต่างออกแบบภาพแจ้งและเก็บงานไว้ กดบันทึกใหม่ได้เมื่อโหลดเสร็จ
    if (!loadSettledRef.current) throw new Error('กำลังโหลดข้อมูลจากระบบ ภาพที่ออกแบบยังอยู่ กดบันทึกอีกครั้งในอีกสักครู่')
    const brief = artworkBrief
    const isGenerated = brief.id === 'generated'
    if (!isGenerated) {
      // หน้าต่างนี้เปิดจากการ์ดร่าง → ตอนบันทึกต้องยังเป็นร่างอยู่ (ระหว่างเปิดค้างไว้ อาจถูกลบ อนุมัติ หรือโพสต์จากอีกเครื่อง)
      // ไม่งั้นการแนบภาพจะดึงโพสต์ที่อนุมัติ/โพสต์แล้วกลับมาเป็นร่าง หรือสร้างร่างตัวอย่างที่ซ่อนไปแล้วขึ้นมาใหม่
      const target = draftsOf(workspaceRef.current).find((item) => String(item.id) === String(brief.id))
      if (!target || !['pending', 'draft', 'needs_edit'].includes(target.status)) {
        throw new Error('คอนเทนต์นี้ถูกลบ อนุมัติ หรือโพสต์ไปแล้วระหว่างนี้ — ปิดหน้าต่างแล้วเปิดออกแบบภาพจากการ์ดร่างอีกครั้ง')
      }
    }
    const isSample = String(brief.id).startsWith('sample-')
    const postId = isSample ? Date.now() : brief.id
    const asset = {
      ...image, id: `asset-${crypto.randomUUID()}`, title: image.design.headline,
      briefId: String(postId), postId: isGenerated ? null : String(postId),
      source: image.design.sourceKind === 'ai' ? 'AI + AssetX template' : 'Photo + AssetX template',
      originalName: 'assetx-artwork.jpg', createdAt: new Date().toISOString(),
    }
    const patch = { mediaAssetId: asset.id, status: 'pending', reviewStatus: 'needs_edit' }
    // ใส่ภาพลงเวิร์กสเปซ (ฟังก์ชันเดียวใช้ทั้งกับของล่าสุด และตอนทำซ้ำหลังรอบันทึกขึ้นระบบ) · ร่างตัวอย่างใช้เลขเดิมที่แจกไปแล้วเมื่อทำซ้ำ
    const withArtwork = (ws, cloneNo = null) => ({
      ...ws,
      // ร่างใน Studio ต้องยังเป็นร่างที่เปิดหน้าต่างออกแบบไว้ (ระหว่างรอบันทึกอาจกดร่างใหม่) ไม่งั้นเก็บภาพไว้ในคลังเฉย ๆ
      generated: isGenerated && ws.generated && sameStudioDraft(ws.generated, brief) ? { ...ws.generated, mediaAssetId: asset.id } : ws.generated,
      posts: isSample ? [{ ...brief, id: postId, ...patch, ...(cloneNo ? { contentNo: cloneNo } : {}) }, ...(ws.posts || [])]
        : (ws.posts || []).map((post) => String(post.id) === String(postId) ? { ...post, ...patch } : post),
      hiddenPostIds: isSample ? [...new Set([...(ws.hiddenPostIds || []), brief.id])] : ws.hiddenPostIds,
      mediaAssets: [asset, ...(ws.mediaAssets || [])],
    })
    let final
    if (!cloudReady) {
      // ยังไม่ได้เชื่อมระบบ (กำลังโหลด หรือโหลดไม่ได้) → บันทึกลงเครื่องตามทางปกติ (ทำซ้ำบนข้อมูลจากระบบได้ถ้ากำลังโหลด)
      // บันทึกลงเครื่องไม่ได้ = แจ้งในหน้าต่างออกแบบภาพ ไม่ปิดเงียบ ๆ ทั้งที่ภาพไม่ได้ถูกเก็บที่ไหน
      final = save((ws) => withArtwork(ws), { requireLocal: true })
    } else {
      // Persist first: a failed storage write must not report a successful attachment.
      const base = workspaceRef.current
      const next = numbered(withArtwork(base))
      try { await saveMarketingWorkspace(next) } catch (error) {
        console.warn('save artwork failed:', error?.message || error)
        throw new Error('บันทึกภาพขึ้นระบบไม่สำเร็จ ลองใหม่อีกครั้ง')
      }
      final = workspaceRef.current === base ? next : numbered(withArtwork(workspaceRef.current, isSample ? contentNoOf(next, postId) : null))
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(final)) } catch { /* ขึ้นระบบแล้ว พื้นที่ในเครื่องเต็มก็ไม่เป็นไร */ }
      commitWorkspace(final)
    }
    if (!isGenerated) setSelectedId(postId)
    if (isGenerated && final.generated?.mediaAssetId !== asset.id) {
      notify('เก็บภาพไว้ในคลังภาพแล้ว · ร่างใน Studio เปลี่ยนไประหว่างรอ จึงไม่ผูกภาพกับร่างใหม่', 'warn')
      return
    }
    notify(isGenerated ? 'แนบภาพแล้ว พร้อมตรวจอนุมัติ' : withContentNo(contentNoOf(final, postId), 'แนบภาพแล้ว พร้อมตรวจอนุมัติ'))
  }

  const publishToFacebook = async (post) => {
    if (blockedWhileLoading()) return
    if (!facebookConnection.connected) {
      notify('ยังไม่เชื่อม Facebook', 'error')
      return
    }
    const media = findMediaForPost(workspaceRef.current.mediaAssets || [], post)
    setFacebookPublishingId(post.id)
    try {
      const response = await fetch('/api/marketing-facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post: {
            id: post.id,
            channel: post.channel,
            status: post.status,
            reviewStatus: post.reviewStatus,
            topic: post.topic,
            title: post.title,
            videoScript: post.videoScript,
            caption: post.caption,
            scheduledAt: post.scheduledAt || '',
            facebookPostId: post.facebookPostId || '',
          },
          media: media ? {
            dataUrl: media.dataUrl,
            mimeType: media.mimeType,
            originalName: media.originalName,
          } : null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) throw new Error(friendlyApiError(response.status, data, 'โพสต์ Facebook ไม่สำเร็จ ลองใหม่หรือตรวจการเชื่อมต่อในหน้าช่องทาง'))
      const doneMessage = data.scheduled ? 'ตั้งเวลาโพสต์บน Facebook แล้ว' : 'โพสต์ไปยัง Facebook Page แล้ว'
      if (!draftsOf(workspaceRef.current).some((item) => item.id === post.id)) {
        // ถูกลบจากหน้านี้ระหว่างรอ Facebook — โพสต์บน Facebook เกิดขึ้นแล้ว บอกตามจริงพร้อมเลข (เป็นคำเตือน ไม่ใช่ข้อความสำเร็จ)
        notify(withContentNo(post.contentNo, `${doneMessage} · แต่คอนเทนต์นี้ถูกลบจากหน้านี้ไปแล้ว`), 'warn')
        return
      }
      updatePost(post.id, {
        status: data.scheduled ? 'scheduled' : 'posted',
        postedAt: data.scheduled ? '' : new Date().toISOString(),
        facebookPostId: data.facebookPostId,
        facebookMediaType: data.mediaType,
        facebookScheduledAt: data.scheduledPublishTime || '',
        publishError: '',
      }, doneMessage)
    } catch (error) {
      const message = errorMessage(error, 'โพสต์ Facebook ไม่สำเร็จ')
      updatePost(post.id, { publishError: message }, '')
      notify(withContentNo(post.contentNo, message), 'error')
    } finally {
      setFacebookPublishingId(null)
    }
  }

  const recordManualPublication = (post, rawReference) => {
    if (blockedWhileLoading()) return false
    if (!['approved', 'scheduled'].includes(post.status) || post.reviewStatus !== 'passed' || !reviewAssetxContent(post).ok) {
      notify('โพสต์นี้ต้องผ่านการตรวจและอนุมัติก่อน', 'error')
      return false
    }
    const result = validateManualPublicationReference(post.channel, rawReference)
    if (!result.ok) {
      notify(result.error, 'error')
      return false
    }
    updatePost(post.id, {
      status: 'posted',
      postedAt: new Date().toISOString(),
      manualReference: result.reference,
      manualConfirmedAt: new Date().toISOString(),
      publishError: '',
    }, 'บันทึกการโพสต์ด้วยตนเองแล้ว')
    return true
  }

  const archivePost = (id) => {
    updatePost(id, { status: 'archived' }, 'พักไว้แล้ว · ดูหรือกู้คืนได้ที่คลังผลงาน')
  }

  const restorePost = (id) => {
    updatePost(id, { status: 'draft', reviewStatus: 'needs_edit' }, 'กู้คืนแล้ว · รอตรวจ')
  }

  const deletePost = (id) => {
    if (blockedWhileLoading()) return
    const isSample = String(id).startsWith('sample-')
    const removedNo = (workspaceRef.current.posts || []).find((post) => post.id === id)?.contentNo
    // ร่างจาก Telegram ที่ลบแล้วต้องไม่ถูกนำเข้าซ้ำเมื่อเปิดลิงก์เดิม → จำ id ไว้ในรายการที่ซ่อน (เหมือนร่างตัวอย่าง)
    const remember = isSample || String(id).startsWith('hermes-')
    save((ws) => ({
      ...ws,
      posts: isSample ? ws.posts : (ws.posts || []).filter((post) => post.id !== id),
      hiddenPostIds: remember ? [...new Set([...(ws.hiddenPostIds || []), id])] : ws.hiddenPostIds,
    }))
    if (selectedId === id) setSelectedId(null)
    notify(isSample ? 'ซ่อนร่างตัวอย่างแล้ว' : withContentNo(removedNo, 'ลบออกจากคลังแล้ว · เลขนี้จะไม่ถูกใช้ซ้ำ'))
  }

  const deleteSavedIdea = (id) => {
    if (blockedWhileLoading()) return
    save((ws) => ({ ...ws, savedIdeas: (ws.savedIdeas || []).filter((idea) => idea.id !== id) }))
    notify('ลบไอเดียที่เก็บไว้แล้ว')
  }

  const generateContent = (prompt, sourceIdea) => {
    const ws = workspaceRef.current
    const inferredIntent = inferStudioIntentFromIdea(sourceIdea, ws.studio)
    // ไอเดียรีเสิร์ชต้นเรื่อง: มาจากการ์ด/คลัง (dbId) หรือกด ร่างโพสต์ ซ้ำใน Studio ด้วยหัวข้อเดิม (คงลิงก์เดิม)
    // แก้หัวข้อใน Studio = เรื่องใหม่ ลิงก์หลุด (onPromptChange) · ไอเดียที่กรอกเอง/ตัวอย่างโฆษณาไม่มีลิงก์
    const sourceIdeaId = sourceIdea ? (sourceIdea.dbId || null) : (ws.studio.sourceIdeaId || null)
    const input = {
      ...ws.studio,
      ...inferredIntent,
      prompt: normalizePrompt(prompt),
      audience: sourceIdea?.audience || ws.studio.audience,
      offer: sourceIdea?.angle || ws.studio.offer,
      channel: sourceIdea?.channel ? (/facebook/i.test(sourceIdea.channel) ? 'facebook' : /LINE/i.test(sourceIdea.channel) ? 'line-oa' : ws.studio.channel) : ws.studio.channel,
      sourceIdeaId,
    }
    // ติดเลขไอเดียไปกับร่างใน Studio → พอส่งเข้ารอตรวจ ร่างจะบอก "จากไอเดีย N" (ตัวร่างไม่ถูกแก้ แค่ติดป้ายผลลัพธ์)
    // ไอเดียจากคลัง/การ์ดที่มีร่าง AI ล่วงหน้า (มุมที่เลือก หรือมุมแรก) → ใช้ร่างนั้นแทนเทมเพลต
    const aiDraft = sourceIdea?.draft?.caption ? sourceIdea.draft : (sourceIdea?.angles?.[0]?.draft?.caption ? sourceIdea.angles[0].draft : null)
    const generated = applyAiDraft({ ...runAssetxMarketingModel(input, draftsOf(ws).slice(0, 8).map((post) => post.caption || '')), ...(sourceIdeaId ? { sourceIdeaId } : {}) }, aiDraft, { channel: input.channel })
    save((current) => ({ ...current, studio: input, generated }))
    goTo('studio')
    notify('ร่างโพสต์แล้ว · ตรวจแล้วกด ส่งเข้ารอตรวจ')
  }

  // replaces = ร่างเดิมที่เจ้าของกด "คิดคอนเทนต์ใหม่ (AI)" — ร่างใหม่บอกว่าแทนเลขไหน ร่างเดิมพักไว้ในคลังผลงาน (ไม่ลบ) และไม่พาไปแท็บอื่นเอง (ผลมาถึงทีหลัง เจ้าของอาจทำอย่างอื่นอยู่)
  const createApprovalContentFromIdea = (prompt, sourceIdea, { replaces = null } = {}) => {
    const ws = workspaceRef.current
    const inferredIntent = inferStudioIntentFromIdea(sourceIdea, ws.studio)
    const sourceIdeaId = sourceIdea?.dbId || null
    const input = {
      ...ws.studio,
      ...inferredIntent,
      prompt: normalizePrompt(prompt),
      audience: sourceIdea?.audience || ws.studio.audience,
      offer: sourceIdea?.angle || ws.studio.offer,
      channel: sourceIdea?.channel ? (/facebook/i.test(sourceIdea.channel) ? 'facebook' : /LINE/i.test(sourceIdea.channel) ? 'line-oa' : ws.studio.channel) : ws.studio.channel,
      sourceIdeaId,
    }
    // ร่างที่ AI เขียนล่วงหน้าจากข้อเท็จจริงของไอเดีย (รอบรีเสิร์ช) ชนะเทมเพลต — เทมเพลต 6 หัวข้อให้โพสต์หน้าตาเดียวกันทุกเรื่อง
    const aiDraft = sourceIdea?.draft?.caption ? sourceIdea.draft : null
    const generated = applyAiDraft({ ...runAssetxMarketingModel(input, draftsOf(ws).slice(0, 8).map((post) => post.caption || '')), ...(sourceIdeaId ? { sourceIdeaId } : {}) }, aiDraft, { channel: input.channel })
    const publishCheck = reviewAssetxContent({ ...generated, topic: input.prompt })
    const post = {
      id: Date.now(),
      title: generated.headline || input.prompt,
      topic: input.prompt,
      channel: input.channel,
      status: 'pending',
      caption: generated.caption,
      imagePrompt: generated.imagePrompt,
      videoScript: generated.videoScript,
      mediaAssetId: generated.mediaAssetId || null,
      reviewStatus: publishCheck.ok ? 'passed' : 'needs_edit',
      reviewNotes: aiDraft
        ? [...publishCheck.notes, ...aiDraftReviewNotes(generated)]
        : publishCheck.ok
          ? [...publishCheck.notes, 'ผ่านการตรวจเบื้องต้น ต้องตรวจข้อเท็จจริงก่อนอนุมัติ']
          : [...publishCheck.notes, 'ควรให้คนตรวจซ้ำก่อนเผยแพร่'],
      // ป้ายว่าแคปชั่นมาจากร่าง AI (ด่านตรวจไม่เทียบกับแม่แบบหัวข้อ · การ์ดโชว์ป้าย) + มุมเล่าที่เลือก
      ...(aiDraft ? { draftSource: 'ai', angleLabel: sourceIdea?.angleLabel || null } : {}),
      // ประโยคเปิดทางเลือกของร่าง AI (ระบบ hook) — ช่องรอตรวจโชว์ให้กดสลับได้ · hookPattern เก็บไว้เทียบยอดต่อสูตรภายหลัง
      ...(generated.meta?.hooks?.length ? { hooks: generated.meta.hooks, hookPattern: generated.meta.hookPattern || null } : {}),
      source: sourceIdea?.source || 'ไอเดียวันนี้',
      // ไอเดียรีเสิร์ชที่เป็นต้นเรื่อง (เลขเดียวกับ "ไอเดีย N" บนการ์ด) — ตามกลับไปหาแหล่งข้อเท็จจริงได้ตอนแก้
      ...(sourceIdea?.dbId ? { ideaId: sourceIdea.dbId } : {}),
      ...(replaces ? { replacesId: replaces.id, replacesNo: replaces.contentNo || null } : {}),
      createdAt: new Date().toISOString(),
    }
    const next = save((current) => ({
      ...current,
      studio: input,
      generated,
      posts: [post, ...(current.posts || []).map((item) => (replaces && item.id === replaces.id ? { ...item, status: 'archived', replacedBy: post.id } : item))],
    }))
    setSelectedId(post.id)
    if (!replaces) goTo('approvals')
    notify(withContentNo(contentNoOf(next, post.id), replaces
      ? `คอนเทนต์ใหม่จาก AI แทน${formatContentNo(replaces.contentNo) ? ` ${formatContentNo(replaces.contentNo)}` : 'ร่างเดิม'} อยู่บนสุดของแท็บ ร่าง · ร่างเดิมพักไว้ในคลังผลงาน`
      : 'ร่างโพสต์แล้ว อยู่ในแท็บ ร่าง รอตรวจ'))
  }

  const addGeneratedToQueue = (status = 'pending') => {
    const ws = workspaceRef.current
    if (!ws.generated) return
    const topic = ws.generated.meta?.resolved?.topic || ws.studio.prompt
    const publishCheck = reviewAssetxContent({ ...ws.generated, topic })
    if (status === 'approved' && !publishCheck.ok) {
      notify(publishCheck.notes.join('\n'), 'error')
      return
    }
    const post = {
      id: Date.now(),
      title: ws.generated.headline || ws.studio.prompt,
      topic,
      channel: ws.studio.channel,
      status,
      caption: appendMarketingHashtags(ws.generated.caption, ws.generated.hashtags),
      imagePrompt: ws.generated.imagePrompt,
      videoScript: ws.generated.videoScript,
      mediaAssetId: ws.generated.mediaAssetId || null,
      reviewStatus: publishCheck.ok ? 'passed' : 'needs_edit',
      reviewNotes: isAiDraft(ws.generated)
        ? [...publishCheck.notes, ...aiDraftReviewNotes(ws.generated)]
        : publishCheck.ok
          ? ['ผ่านเงื่อนไขเบื้องต้น', 'ควรตรวจรายละเอียดจริงก่อนโพสต์']
          : [...publishCheck.notes, 'ควรให้คนตรวจซ้ำก่อนเผยแพร่'],
      ...(isAiDraft(ws.generated) ? { draftSource: 'ai' } : {}),
      ...(ws.generated.meta?.hooks?.length ? { hooks: ws.generated.meta.hooks, hookPattern: ws.generated.meta.hookPattern || null } : {}),
      source: 'AssetX Studio',
      ...(ws.generated.sourceIdeaId ? { ideaId: ws.generated.sourceIdeaId } : {}),
      createdAt: new Date().toISOString(),
    }
    const next = save((current) => ({ ...current, posts: [post, ...(current.posts || [])] }))
    setSelectedId(post.id)
    goTo('approvals')
    notify(withContentNo(contentNoOf(next, post.id), status === 'approved' ? 'อนุมัติแล้ว · ไปตั้งเวลาในแท็บ โพสต์' : 'ส่งเข้ารอตรวจแล้ว'))
  }

  const addManualIdea = () => {
    const manualIdea = workspaceRef.current.manualIdea || ''
    if (!manualIdea.trim()) return
    generateContent(manualIdea, {
      audience: 'กลุ่มเป้าหมายจากไอเดียที่กรอกเอง',
      angle: manualIdea,
      channel: 'Facebook',
    })
  }

  const saveIdeaForLater = (idea) => {
    const exists = (workspaceRef.current.savedIdeas || []).some((item) => item.id === idea.id)
    const savedAt = new Date().toISOString()
    if (!exists) {
      save((ws) => ((ws.savedIdeas || []).some((item) => item.id === idea.id)
        ? ws
        : { ...ws, savedIdeas: [{ ...idea, savedAt }, ...(ws.savedIdeas || [])] }))
    }
    notify(exists ? 'ไอเดียนี้อยู่ในคลังแล้ว' : 'เก็บไอเดียไว้ในคลังผลงานแล้ว')
  }

  const postResearchIdea = async (body) => {
    const res = await fetch('/api/marketing-ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(friendlyApiError(res.status, data, 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'))
    return data
  }

  // เลือกไอเดียจากเรดาร์ = สร้างร่างเหมือนไอเดียอื่น + บอกระบบว่าเลือกแล้ว (status picked) จะไม่โผล่ซ้ำ
  // มุมเล่าที่คนเลือกบนการ์ดส่งไปเป็น chosen_angle และเป็น "offer" ของตัวร่างเดิม (ตัวร่างไม่ถูกแก้)
  const pickResearchIdea = (prompt, idea, angleIndex = 0) => {
    const chosen = idea?.angles?.[angleIndex] || idea?.angles?.[0] || null
    if (idea?.dbId) {
      postResearchIdea({ action: 'pick', id: idea.dbId, chosen_angle: chosen?.label || null })
        .then(() => setResearchIdeas((items) => items.filter((item) => item.dbId !== idea.dbId)))
        .catch((err) => notify(`ร่างแล้ว แต่บันทึกว่าเลือกไอเดียนี้ไม่สำเร็จ — ${errorMessage(err, 'ลองใหม่อีกครั้ง')}`, 'error'))
    }
    // ส่งร่างที่ AI เขียนล่วงหน้าของมุมนี้ไปด้วย (ถ้ามี) — ตัวสร้างร่างจะใช้แทนเทมเพลต
    createApprovalContentFromIdea(prompt, chosen?.brief ? { ...idea, angle: chosen.brief, angleLabel: chosen.label, draft: chosen.draft || null } : idea)
  }

  // ทิ้ง = ใส่เหตุผลสั้น ๆ (ใช้ปรับเกณฑ์คัดไอเดียทีหลัง) · ไม่ลบแถว
  const dismissResearchIdea = async (idea) => {
    if (!idea?.dbId) return
    const reason = window.prompt('ทิ้งไอเดียนี้เพราะอะไร (สั้น ๆ ช่วยปรับเกณฑ์คัดไอเดีย)', 'ไม่เกี่ยวกับธุรกิจเรา')
    if (reason === null) return
    try {
      await postResearchIdea({ action: 'dismiss', id: idea.dbId, reason })
      setResearchIdeas((items) => items.filter((item) => item.dbId !== idea.dbId))
      notify('ทิ้งแล้ว')
    } catch (err) {
      notify(errorMessage(err, 'ทิ้งไอเดียไม่สำเร็จ'), 'error')
    }
  }

  // ย้อนร่างกลับเป็นไอเดีย: ไอเดียต้นเรื่องกลับเข้าแท็บ ไอเดีย (status new · มุมเล่าและร่าง AI ทุกมุมยังอยู่) ให้เลือกมุมใหม่ได้
  // ร่างเดิมไม่ลบ — พักไว้ในคลังผลงาน (กู้คืนได้) · ฝั่งระบบบอกไม่ได้ (ทิ้ง/หมดอายุแล้ว) = ร่างอยู่ที่เดิม
  const returnDraftToIdea = async (post) => {
    if (!post?.ideaId || blockedWhileLoading()) return
    const ok = window.confirm(`ย้อนกลับเป็นไอเดีย ${post.ideaId}?\n\nไอเดียจะกลับไปอยู่ในแท็บ ไอเดีย ให้เลือกมุมเล่าใหม่ได้\nร่างนี้จะถูกพักไว้ในคลังผลงาน (กู้คืนได้ ไม่ลบ)`)
    if (!ok) return
    try {
      const data = await postResearchIdea({ action: 'unpick', id: post.ideaId })
      updatePost(post.id, { status: 'archived' })
      if (selectedId === post.id) setSelectedId(null)
      await loadResearchIdeas()
      // คิวบนหน้าแสดงไม่เกิน 60 ใบ — ไอเดียเก่าอาจหลุดรอบโหลด → วางการ์ดจากแถวที่ระบบคืนมาให้แน่ใจว่าเห็น
      const row = data?.idea
      if (row?.id && row.title) setResearchIdeas((items) => (items.some((item) => item.dbId === row.id) ? items : [researchIdeaToCard(row), ...items]))
      setReturnedIdea({ id: post.ideaId, at: Date.now() })
      goTo('ideas')
      notify(`ไอเดีย ${post.ideaId} กลับมาที่แท็บ ไอเดีย แล้ว · เลือกมุมเล่าใหม่ได้ · ร่างเดิมพักไว้ในคลังผลงาน`)
    } catch (err) {
      notify(errorMessage(err, 'ย้อนกลับเป็นไอเดียไม่สำเร็จ ลองใหม่อีกครั้ง'), 'error')
    }
  }

  // ---- คิดคอนเทนต์ใหม่ด้วย AI (เจ้าของขอ 9 พ.ย. 2569: ไม่ชอบคอนเทนต์ที่ออกแบบไว้ → กดให้ AI คิดใหม่สด ๆ) ----
  // การ์ดไอเดีย → มุมเล่าใหม่ + ร่างเต็มไปอยู่ช่องแรกของการ์ด · การ์ดร่าง → ร่างใหม่แทนร่างนี้ (ร่างเดิมพักไว้ในคลังผลงาน)
  // ทำบนคอมสำนักงาน (Codex · ด่านตรวจชุดเดียวกับรอบรีเสิร์ช · server/research/fresh.js) ราว 1–3 นาที · ปิดหน้าได้ เปิดใหม่แล้วตามงานต่อ
  const contentJobsRequest = async (body) => {
    const res = await fetch('/api/marketing-content-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const error = new Error(friendlyApiError(res.status, data, 'ส่งงานคิดคอนเทนต์ใหม่ไม่สำเร็จ ลองใหม่อีกครั้ง'))
      error.status = res.status
      throw error
    }
    return data
  }
  const putContentJob = (job) => { if (job?.id) setContentJobs((prev) => ({ ...prev, [job.id]: job })) }
  const dropContentJob = (id) => setContentJobs((prev) => {
    if (!prev[id]) return prev
    const next = { ...prev }
    delete next[id]
    return next
  })

  const startFreshContent = async ({ idea = null, post = null } = {}) => {
    if (post && blockedWhileLoading()) return
    const ideaId = post ? post.ideaId : idea?.dbId
    if (!ideaId) return
    const where = post
      ? 'แล้วสร้างเป็นร่างใหม่แทนร่างนี้ (ร่างเดิมพักไว้ในคลังผลงาน กู้คืนได้)'
      : 'แล้ววางเป็นมุมเล่าใหม่ช่องแรกของการ์ดนี้ (มุมเดิมยังอยู่ครบ)'
    const note = window.prompt(`AI จะคิดมุมเล่าใหม่และเขียนร่างใหม่ทั้งชิ้น ${where}\nใช้เวลาราว 1–3 นาทีบนคอมสำนักงาน ระหว่างนี้ทำอย่างอื่นหรือปิดหน้าได้\n\nอยากให้เน้นอะไรเป็นพิเศษ พิมพ์ได้ เช่น "ภาษาเป็นกันเองขึ้น" "สั้นลง" "เล่าเป็นเคสสมมุติ" (เว้นว่างได้)`, '')
    if (note === null) return
    try {
      const data = await contentJobsRequest({
        action: 'create',
        idea_id: ideaId,
        note,
        ...(post ? { post_key: String(post.id), content_no: post.contentNo || null, avoid_headline: post.title || '', avoid_caption: post.caption || '' } : {}),
      })
      putContentJob(data.job)
      if (data.worker) setContentWorker(data.worker)
      const offline = data.worker && !data.worker.online
      notify(
        data.reused ? 'AI กำลังคิดคอนเทนต์ใหม่ของไอเดียนี้อยู่แล้ว รอผลได้เลย'
          : offline ? 'ส่งงานแล้ว แต่คอมสำนักงานปิดอยู่ — AI จะเริ่มคิดเมื่อเปิดเครื่อง'
            : 'ส่งให้ AI คิดคอนเทนต์ใหม่แล้ว · ราว 1–3 นาที',
        offline ? 'warn' : 'success',
      )
    } catch (err) {
      notify(errorMessage(err, 'ส่งงานคิดคอนเทนต์ใหม่ไม่สำเร็จ ลองใหม่อีกครั้ง'), 'error')
    }
  }

  // งานเสร็จ: จากการ์ดไอเดีย = โหลดคิวใหม่ให้การ์ดเลือกมุมใหม่ · จากการ์ดร่าง = จองผล (ครั้งเดียว · เปิดสองแท็บก็ไม่สร้างซ้ำ) แล้วสร้างร่างใหม่แทนร่างเดิม
  const handleFreshDone = async (job) => {
    if (freshHandledRef.current.has(job.id)) return
    freshHandledRef.current.add(job.id)
    const angle = job.result?.angle
    if (!job.post_key) {
      dropContentJob(job.id)
      await loadResearchIdeas()
      setFreshIdea({ id: job.idea_id, at: Date.now() })
      notify(`ไอเดีย ${job.idea_id} ได้มุมเล่าใหม่จาก AI แล้ว${angle?.label ? ` "${angle.label}"` : ''} · อยู่ช่องแรกของการ์ด พร้อมกด ร่างโพสต์`)
      return
    }
    try {
      await contentJobsRequest({ action: 'apply', id: job.id })
    } catch (err) {
      // 409 = แท็บอื่นสร้างร่างจากผลนี้ไปแล้ว → ไม่ต้องทำอะไร · อย่างอื่น (เน็ตสะดุด) = ลองใหม่รอบหน้า
      if (err.status === 409) { dropContentJob(job.id); return }
      freshHandledRef.current.delete(job.id)
      notify(errorMessage(err, 'รับผลคอนเทนต์ใหม่ไม่สำเร็จ จะลองอีกครั้ง'), 'error')
      return
    }
    dropContentJob(job.id)
    const old = (workspaceRef.current.posts || []).find((post) => String(post.id) === String(job.post_key))
    if (!angle?.draft?.caption) { notify('งานคิดคอนเทนต์ใหม่เสร็จ แต่ไม่มีร่างกลับมา ลองกดใหม่อีกครั้ง', 'warn'); return }
    if (!old || ['archived', 'posted'].includes(old.status) || old.facebookPostId) {
      notify(`AI คิดคอนเทนต์ใหม่ของไอเดีย ${job.idea_id} เสร็จแล้ว แต่ร่างเดิมถูกพักหรือโพสต์ไปแล้ว — มุมใหม่ "${angle.label}" เก็บไว้ที่ไอเดีย ${job.idea_id}`, 'warn')
      return
    }
    createApprovalContentFromIdea(old.topic || old.title, {
      kind: 'research',
      dbId: old.ideaId,
      title: old.topic || old.title,
      audience: RESEARCH_READER_LABEL,
      angle: angle.brief,
      angleLabel: angle.label,
      draft: angle.draft,
      channel: /line/i.test(old.channel || '') ? 'LINE OA' : 'Facebook',
      source: old.source,
    }, { replaces: old })
    postResearchIdea({ action: 'pick', id: old.ideaId, chosen_angle: angle.label }).catch(() => {})
  }

  // ตามงานที่ยังไม่จบทุก 4 วินาที (เฉพาะตอนมีงาน) · งานหาย (404) = เลิกตาม
  const activeFreshIds = Object.values(contentJobs).filter(isActiveFreshJob).map((job) => job.id).sort().join(',')
  useEffect(() => {
    if (!activeFreshIds) return undefined
    let stopped = false
    const tick = async () => {
      for (const id of activeFreshIds.split(',')) {
        try {
          const res = await fetch(`/api/marketing-content-jobs?id=${id}`)
          const data = await res.json().catch(() => ({}))
          if (stopped) return
          if (res.ok && data.job) {
            setContentJobs((prev) => (prev[id] ? { ...prev, [id]: data.job } : prev))
            if (data.worker) setContentWorker(data.worker)
          } else if (res.status === 404) dropContentJob(id)
        } catch { /* เน็ตสะดุด — รอบหน้าลองใหม่ */ }
      }
    }
    const timer = window.setInterval(tick, 4000)
    tick()
    return () => { stopped = true; window.clearInterval(timer) }
  }, [activeFreshIds])

  // เปิดหน้าใหม่: ตามงานที่ยังไม่จบ และรับผลจากการ์ดร่างที่เสร็จระหว่างปิดหน้า (หลังโหลดเวิร์กสเปซเสร็จ) · ยังไม่ได้รัน SQL/ยังไม่ล็อกอิน = เงียบ
  useEffect(() => {
    if (syncState.state === 'loading' || freshResumedRef.current) return
    freshResumedRef.current = true
    fetch('/api/marketing-content-jobs?recent=1')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        if (data.worker) setContentWorker(data.worker)
        const resume = (data.jobs || []).filter(shouldResumeJob)
        if (resume.length) setContentJobs((prev) => ({ ...Object.fromEntries(resume.map((job) => [job.id, job])), ...prev }))
      })
      .catch(() => {})
  }, [syncState.state])

  // งานเสร็จ → รับผล (รอเวิร์กสเปซโหลดเสร็จก่อน — ร่างใหม่ต้องลงบนข้อมูลจากระบบ) · งานล้ม → แจ้งครั้งเดียว (ข้อความค้างบนการ์ดจนกดใหม่)
  useEffect(() => {
    if (syncState.state === 'loading') return
    for (const job of Object.values(contentJobs)) {
      if (job.status === 'done') handleFreshDone(job)
      else if (job.status === 'failed' && !freshHandledRef.current.has(job.id)) {
        freshHandledRef.current.add(job.id)
        notify(`คิดคอนเทนต์ใหม่ไม่สำเร็จ: ${job.error || 'ไม่ทราบสาเหตุ'}`, 'error')
      }
    }
  }, [contentJobs, syncState.state])

  // สถานะบนการ์ด: งานล่าสุดต่อไอเดีย (สั่งจากการ์ดไอเดีย) และต่อร่าง (สั่งจากการ์ดร่าง)
  const freshJobList = Object.values(contentJobs).filter((job) => job.status !== 'done')
  const freshByIdea = latestJobBy(freshJobList.filter((job) => !job.post_key), (job) => job.idea_id)
  const freshByPost = latestJobBy(freshJobList.filter((job) => job.post_key), (job) => job.post_key)

  const updateReferenceForm = (patch) => {
    save((ws) => ({ ...ws, referenceForm: { ...ws.referenceForm, ...patch } }))
  }

  const addReference = () => {
    const form = { ...defaultReferenceForm, ...(workspaceRef.current.referenceForm || {}) }
    const title = form.title.trim()
    if (!title) {
      notify('กรุณาใส่ชื่อตัวอย่างหรือหัวข้อที่เจอ', 'error')
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
    save((ws) => ({
      ...ws,
      references: [reference, ...(ws.references || [])],
      referenceForm: { ...defaultReferenceForm, sourceId: form.sourceId, audience: form.audience, channel: form.channel, tags: form.tags },
    }))
    setSelectedReferenceId(reference.id)
    notify('บันทึกตัวอย่างแล้ว')
  }

  const deleteReference = (id) => {
    if (blockedWhileLoading()) return
    save((ws) => ({ ...ws, references: (ws.references || []).filter((item) => item.id !== id) }))
    if (selectedReferenceId === id) setSelectedReferenceId(null)
    notify('ลบตัวอย่างแล้ว')
  }

  const createFromReference = (reference) => {
    const brief = buildReferenceBrief(reference)
    generateContent(`${reference.title}\n\n${brief}`, referenceToIdea(reference))
  }

  const saveReferenceAsIdea = (reference) => {
    saveIdeaForLater(referenceToIdea(reference))
  }

  const loadReferenceRadar = async () => {
    // คำค้นตอนกดค้น — โน้ตความรู้ต้องบอกคำที่ค้นจริง ไม่ใช่คำที่พิมพ์ต่อระหว่างรอ
    const query = workspaceRef.current.referenceQuery || referenceStarterQueries[0]
    setReferenceLoading(true)
    try {
      const res = await fetch('/api/marketing-references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(friendlyApiError(res.status, data, 'ค้นตัวอย่างอัตโนมัติไม่สำเร็จ ลองใหม่อีกครั้ง'))
      const incoming = Array.isArray(data.references) ? data.references : []
      if (!incoming.length) throw new Error('ยังไม่พบตัวอย่างที่นำมาใช้ได้')
      // ต่อยอดจากเวิร์กสเปซล่าสุด (ระหว่างรอค้น อาจมีร่าง/การแก้ใหม่เข้ามา)
      const freshFor = (ws) => {
        const existingKeys = new Set((ws.references || []).map((item) => item.url || item.title))
        return incoming.filter((item) => !existingKeys.has(item.url || item.title))
      }
      const fresh = freshFor(workspaceRef.current)
      save((ws) => {
        const add = freshFor(ws)
        return {
          ...ws,
          references: [...add, ...(ws.references || [])],
          knowledgeNotes: uniqueByKey([
            ...add.map((item) => referenceToKnowledgeNote(item, { query })),
            ...(ws.knowledgeNotes || []),
          ], (note) => note.sourceUrl || `${note.kind}:${note.title}`),
        }
      })
      if (fresh[0]) setSelectedReferenceId(fresh[0].id)
      notify(fresh.length ? `ได้ตัวอย่างใหม่ ${fresh.length} รายการ และเก็บเป็นโน้ตความรู้แล้ว` : 'รายการที่พบอยู่ในคลังแล้ว')
    } catch (err) {
      notify(errorMessage(err, 'ค้นตัวอย่างอัตโนมัติไม่สำเร็จ'), 'error')
    } finally {
      setReferenceLoading(false)
    }
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
      if (!res.ok || !data.success) throw new Error(friendlyApiError(res.status, data, 'สำรวจตลาดอัตโนมัติไม่สำเร็จ ลองใหม่อีกครั้ง'))
      const nextIdeas = Array.isArray(data.ideas) ? data.ideas : []
      if (!nextIdeas.length) throw new Error('ยังไม่พบประเด็นใหม่ที่นำมาใช้ได้')
      // ต่อยอดจากเวิร์กสเปซล่าสุด (กด ร่างโพสต์ ระหว่างรอสำรวจได้ ร่างนั้นต้องไม่หาย)
      save((ws) => ({
        ...ws,
        radarIdeas: nextIdeas,
        knowledgeNotes: uniqueByKey([
          ...nextIdeas.map((item) => ideaToKnowledgeNote(item, { query: data.query || '' })),
          ...(ws.knowledgeNotes || []),
        ], (note) => note.sourceUrl || `${note.kind}:${note.title}`),
      }))
      notify(`ได้หัวข้อใหม่จากการสำรวจตลาด ${nextIdeas.length} หัวข้อ และเก็บเป็นโน้ตความรู้แล้ว`)
    } catch (err) {
      notify(errorMessage(err, 'สำรวจตลาดอัตโนมัติไม่สำเร็จ'), 'error')
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
    save((ws) => ({ ...ws, metrics: [record, ...(ws.metrics || [])] }))
    setMetricForm({ title: '', channel: 'Facebook', leads: 0, qualified: 0, appointments: 0, notes: '' })
    notify('บันทึกผลโพสต์แล้ว')
  }

  const deleteMetricRecord = (id) => {
    if (blockedWhileLoading()) return
    save((ws) => ({ ...ws, metrics: (ws.metrics || []).filter((item) => item.id !== id) }))
    notify('ลบผลโพสต์แล้ว')
  }

  const updatePosterCopy = (patch) => {
    save((ws) => ({ ...ws, posterCopy: { ...defaultPosterCopy, ...(ws.posterCopy || {}), ...patch } }))
  }

  const resetPosterCopy = () => {
    save((ws) => ({ ...ws, posterCopy: defaultPosterCopy }))
    notify('รีเซ็ตข้อความโปสเตอร์แล้ว')
  }

  const applyPosterCopyFromBrief = (brief) => {
    save((ws) => ({ ...ws, posterCopy: inferPosterCopyFromBrief(brief, ws.posterCopy) }))
    setSelectedBriefId(String(brief.id))
    notify('เติมข้อความจากคอนเทนต์ที่เลือกแล้ว')
  }

  const uploadArtwork = async (file, brief) => {
    if (!file || !brief) return
    if (!file.type?.startsWith('image/')) {
      notify('กรุณาเลือกไฟล์รูปภาพ', 'error')
      return
    }
    setMediaLoading(`upload:${brief.id}`)
    // ร่างใน Studio ตอนกด — ระหว่างย่อรูป ถ้ากดร่างใหม่ไปแล้ว รูปนี้ต้องไม่ไปผูกกับร่างใหม่
    const targetDraft = brief.id === 'generated' ? workspaceRef.current.generated : null
    try {
      const image = await compressImageFile(file)
      const asset = {
        id: `asset-${Date.now()}`,
        briefId: String(brief.id),
        postId: brief.id !== 'generated' ? String(brief.id) : null,
        title: brief.title,
        source: brief.source || 'อัปโหลดจากเครื่อง',
        dataUrl: image.dataUrl,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        size: image.size,
        originalName: image.originalName,
        createdAt: new Date().toISOString(),
      }
      // ต่อยอดจากเวิร์กสเปซล่าสุด (ย่อรูปใช้เวลา ระหว่างนั้นมีการแก้อื่นได้)
      let linked = true
      save((ws) => {
        linked = brief.id !== 'generated' || sameStudioDraft(ws.generated, targetDraft)
        return {
          ...ws,
          generated: brief.id === 'generated' && linked && ws.generated ? { ...ws.generated, mediaAssetId: asset.id } : ws.generated,
          posts: (ws.posts || []).map((post) => String(post.id) === String(brief.id) ? { ...post, mediaAssetId: asset.id } : post),
          mediaAssets: [asset, ...(ws.mediaAssets || [])],
        }
      })
      setSelectedBriefId(String(brief.id))
      setMediaResult({
        id: asset.id,
        type: 'image',
        title: asset.title,
        dataUrl: asset.dataUrl,
        mimeType: asset.mimeType,
        model: 'ภาพที่อัปโหลด',
      })
      notify(linked ? 'แนบรูปเข้ากับบรีฟแล้ว' : 'เก็บรูปไว้ในคลังภาพแล้ว · ร่างใน Studio เปลี่ยนไประหว่างรอ จึงไม่ผูกรูปกับร่างใหม่', linked ? 'success' : 'warn')
    } catch (err) {
      notify(err.message || 'อัปโหลดรูปไม่สำเร็จ', 'error')
    } finally {
      setMediaLoading(null)
    }
  }

  const deleteMediaAsset = (id) => {
    if (blockedWhileLoading()) return
    save((ws) => ({
      ...ws,
      generated: ws.generated?.mediaAssetId === id ? { ...ws.generated, mediaAssetId: null } : ws.generated,
      posts: (ws.posts || []).map((post) => post.mediaAssetId === id ? { ...post, mediaAssetId: null } : post),
      mediaAssets: (ws.mediaAssets || []).filter((asset) => asset.id !== id),
    }))
    notify('ลบรูปออกจากคลังแล้ว')
  }

  const generateMedia = async (type, brief) => {
    setMediaLoading(`${type}:${brief.id}`)
    // ร่างใน Studio ตอนกด — สร้างภาพใช้เวลาหลายวินาที ถ้ากดร่างใหม่ไปแล้ว ภาพนี้ต้องไม่ไปผูกกับร่างใหม่
    const targetDraft = brief.id === 'generated' ? workspaceRef.current.generated : null
    let linked = true
    try {
      const selectedVisualStyle = assetxVisualStyles.find((style) => style.id === visualStyleId) || assetxVisualStyles[0]
      const visualStyle = type === 'video' && selectedVisualStyle.artistic ? assetxVisualStyles[1] : selectedVisualStyle
      const basePrompt = type === 'video'
        ? (brief.videoScript || brief.imagePrompt || brief.title)
        : (brief.imagePrompt || brief.title)
      const prompt = type === 'image' && visualStyle.allowPosterText
        ? `${basePrompt}\n\n${buildPosterCopy(brief, workspace.posterCopy)}`
        : basePrompt
      const res = await fetch(type === 'video' ? '/api/marketing-video' : '/api/marketing-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          styleProfile: visualStyle,
          aspectRatio: type === 'video' ? '9:16' : (visualStyle.imageAspectRatio || '1:1'),
          imageSize: '1K',
          resolution: '720p',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        // โค้ดจากเซิร์ฟเวอร์ (เช่น โควต้าหมด / ยังไม่ตั้งคีย์) → บอกเป็นภาษาคน ไม่โชว์โค้ดหรือชื่อตัวแปร
        const code = String(data.code || '')
        const reason = /QUOTA/i.test(code)
          ? 'บริการสร้างภาพใช้โควต้าหมดชั่วคราว — คัดลอกบรีฟรูปด้านล่างไปใช้กับเครื่องมืออื่นได้'
          : /AUTH|KEY/i.test(code) || /_API_KEY/.test(String(data.error || ''))
            ? 'ยังไม่ได้เชื่อมบริการสร้างภาพอัตโนมัติ — ใช้บรีฟรูปด้านล่างกับเครื่องมือที่มีอยู่แทนได้'
            : friendlyApiError(res.status, data, type === 'video' ? 'สร้างวิดีโอไม่สำเร็จ ลองใหม่อีกครั้ง' : 'สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง')
        if (data.fallbackPrompt) {
          setMediaResult({
            id: Date.now(),
            type: 'prompt',
            targetType: type,
            title: brief.title,
            prompt: data.fallbackPrompt,
            model: 'บรีฟรูปสำหรับคัดลอก',
          })
          notify(reason, 'error')
          return
        }
        throw new Error(reason)
      }
      setMediaResult({
        id: Date.now(),
        type,
        title: brief.title,
        dataUrl: data.dataUrl,
        mimeType: data.mimeType,
        model: type === 'video' ? 'วิดีโอที่สร้างด้วย AI' : 'ภาพที่สร้างด้วย AI',
      })
      if (type === 'image') {
        const generatedImage = await loadImage(data.dataUrl)
        const asset = {
          id: `asset-${Date.now()}`,
          briefId: String(brief.id),
          postId: brief.id !== 'generated' ? String(brief.id) : null,
          title: brief.title,
          source: data.model || 'OpenAI generated artwork',
          dataUrl: data.dataUrl,
          mimeType: data.mimeType,
          width: generatedImage.width,
          height: generatedImage.height,
          size: null,
          originalName: 'generated-image.jpg',
          createdAt: new Date().toISOString(),
        }
        // ต่อยอดจากเวิร์กสเปซล่าสุด (สร้างภาพใช้เวลาหลายวินาที ระหว่างนั้นมีการแก้อื่นได้)
        save((ws) => {
          linked = brief.id !== 'generated' || sameStudioDraft(ws.generated, targetDraft)
          return {
            ...ws,
            generated: brief.id === 'generated' && linked && ws.generated ? { ...ws.generated, mediaAssetId: asset.id } : ws.generated,
            posts: (ws.posts || []).map((post) => String(post.id) === String(brief.id) ? { ...post, mediaAssetId: asset.id } : post),
            mediaAssets: [asset, ...(ws.mediaAssets || [])],
          }
        })
      }
      notify(type === 'video' ? 'สร้างวิดีโอแล้ว' : linked ? 'สร้างรูปแล้ว' : 'สร้างรูปแล้ว · ร่างใน Studio เปลี่ยนไประหว่างรอ จึงเก็บรูปไว้ในคลังภาพโดยไม่ผูกกับร่างใหม่', type !== 'video' && !linked ? 'warn' : 'success')
    } catch (err) {
      notify(errorMessage(err, 'สร้างสื่อไม่สำเร็จ'), 'error')
    } finally {
      setMediaLoading(null)
    }
  }

  const copyText = (text, message = 'คัดลอกแล้ว') => (navigator.clipboard ? navigator.clipboard.writeText(text || '') : Promise.reject(new Error('clipboard unavailable')))
    .then(() => notify(message))
    .catch(() => notify('คัดลอกไม่สำเร็จ', 'error'))

  const exportKnowledgeBase = () => {
    const notes = workspace.knowledgeNotes || []
    if (!notes.length) {
      notify('ยังไม่มีโน้ตความรู้ กดสำรวจตลาดหรือค้นตัวอย่างอัตโนมัติก่อน', 'error')
      return
    }
    const content = buildObsidianExport(notes, { query: workspace.referenceQuery || '' })
    const filename = `${new Date().toISOString().slice(0, 10)}-assetx-marketing-knowledge.md`
    downloadMarkdown(filename, content)
    notify('ดาวน์โหลดโน้ตความรู้แล้ว')
  }

  const saveKnowledgeBaseToObsidian = async () => {
    const notes = workspace.knowledgeNotes || []
    if (!notes.length) {
      notify('ยังไม่มีโน้ตความรู้ กดสำรวจตลาดหรือค้นตัวอย่างอัตโนมัติก่อน', 'error')
      return
    }
    try {
      const filename = `${new Date().toISOString().slice(0, 10)}-assetx-marketing-knowledge.md`
      const content = buildObsidianExport(notes, { query: workspace.referenceQuery || '' })
      const res = await fetch('/api/marketing-knowledge-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 400) throw new Error('เครื่องนี้ยังไม่ได้ตั้งโฟลเดอร์คลังความรู้ — ใช้ปุ่มดาวน์โหลดแทนได้')
      if (!res.ok || !data.success) throw new Error(friendlyApiError(res.status, data, 'บันทึกโน้ตความรู้ไม่สำเร็จ ลองใหม่อีกครั้ง'))
      notify('บันทึกโน้ตความรู้ลงคลังในเครื่องแล้ว')
    } catch (err) {
      notify(errorMessage(err, 'บันทึกโน้ตความรู้ไม่สำเร็จ'), 'error')
    }
  }

  // แท็บหลัก 3 อัน (ไอเดีย → ร่าง → โพสต์) · Studio เป็นสถานะย่อยของ "ร่าง" · ปฏิทินเป็นสถานะย่อยของ "โพสต์" · ที่เหลืออยู่ในเมนูเครื่องมือ
  const activeTab = view === 'ideas' ? 'ideas' : ['approvals', 'studio'].includes(view) ? 'drafts' : ['queue', 'calendar'].includes(view) ? 'posts' : 'tools'
  const toolViews = [
    ['library', 'คลังผลงาน', dashboardCounts.library],
    ['gallery', 'ห้องภาพ'],
    ['channels', 'ช่องทาง'],
    ['references', 'คลังตัวอย่างโฆษณา', dashboardCounts.references],
    ['metrics', 'ตัวเลข'],
    ['pipeline', 'สถานะระบบ'],
    ['brand', 'กติกาแบรนด์'],
    ['inbox', 'ตอบคอมเมนต์ (ตัวอย่าง)'],
  ]
  const activeTool = toolViews.find(([id]) => id === view)
  const goTo = (next) => {
    setView(next)
    setToolsOpen(false)
    // ช่องตัวอย่างของคลังผลงานกลับไปแสดงชิ้นแรกตามปกติ (ชิ้นที่ค้นด้วยเลขไม่ค้างตลอด session)
    setLibraryPreviewId(null)
    window.scrollTo({ top: 0 })
  }

  // เปิดคอนเทนต์ในแท็บที่มันอยู่ตามสถานะ แล้วเลื่อนไปไฮไลต์การ์ด (ช่องค้นด้วยเลข และลิงก์ร่างจาก Telegram)
  const openContent = (post) => {
    const target = viewForStatus(post.status)
    if (target === 'approvals') setSelectedId(post.id)
    if (target === 'library') {
      // เปลี่ยนตัวกรองเฉพาะเมื่อตัวกรองที่เลือกอยู่ซ่อนชิ้นนี้ · ช่องตัวอย่างแสดงชิ้นที่เปิด
      if (!libraryFilterMatches(post, libraryFilter)) setLibraryFilter('all')
      setLibraryPreviewId(post.id)
    }
    setView(target)
    setToolsOpen(false)
    if (post.contentNo) setFocusNo({ no: post.contentNo, at: Date.now() })
  }

  // ค้นด้วยเลขคอนเทนต์ → เปิดแท็บที่คอนเทนต์ชิ้นนั้นอยู่ตามสถานะ แล้วเลื่อนไปที่การ์ด (ไม่ดีดขึ้นบนสุดก่อน)
  // ไม่พบ/พิมพ์ผิด = ข้อความใต้ช่องค้น (โปรแกรมอ่านหน้าจออ่านให้ · บนมือถือไม่โดนแป้นพิมพ์บัง) และโฟกัสยังอยู่ในช่อง
  const jumpToContent = (raw) => {
    const text = String(raw || '').trim()
    // ปิดเมนูเครื่องมือทุกครั้ง (เมนูเคยบังข้อความ) · ล้างก่อนแล้วใส่ในเฟรมถัดไป ข้อความเดิมซ้ำจึงถูกอ่านออกเสียงใหม่
    const fail = (message) => {
      setToolsOpen(false)
      setFindMsg(null)
      window.requestAnimationFrame(() => setFindMsg({ text: message, at: Date.now() }))
    }
    if (!loadSettledRef.current) return fail(LOADING_MESSAGE)
    if (!text) return fail('พิมพ์เลขคอนเทนต์ เช่น 12 หรือ #12')
    if (/ไอเดีย/.test(text)) return fail('เลขไอเดียไม่ใช่เลขคอนเทนต์ — ใช้เลขที่มี # บนการ์ดในแท็บ ร่าง หรือ โพสต์')
    const no = parseContentNo(text)
    if (!no) return fail('พิมพ์เฉพาะเลขคอนเทนต์ เช่น 12 หรือ #12')
    const ws = workspaceRef.current
    const post = findContentByNo(ws.posts, no)
    if (!post) {
      const latest = Number(ws.contentSeq) || 0
      if (!latest) return fail('ยังไม่มีคอนเทนต์ที่มีเลข')
      return fail(no <= latest
        ? `ไม่พบคอนเทนต์ ${formatContentNo(no)} — อาจถูกลบไปแล้ว`
        : `ยังไม่มีคอนเทนต์ ${formatContentNo(no)} — เลขล่าสุดตอนนี้คือ ${formatContentNo(latest)}`)
    }
    openContent(post)
    setFindText('')
    setFindMsg(null)
  }

  return (
    <div className="mx-page">
      <style>{styles}</style>
      <div className="mx-head">
        <header className="mx-topbar">
          <div className="mx-topbar-left">
            <button className="mx-back" onClick={onBack}>← หน้าหลัก</button>
            <div className="mx-brand">
              <img src="/logo.jpg" alt="" className="mx-brand-logo" />
              <span className="mx-brand-name">AssetX · การตลาด</span>
            </div>
          </div>
          <StatusStrip feed={researchFeed} syncState={syncState} facebookConnection={facebookConnection} onReload={loadResearchIdeas} onRetrySave={cloudReady ? retrySave : null} />
        </header>
        <nav className="mx-tabs" aria-label="ส่วนหลักของหน้าการตลาด">
          <TabButton id="ideas" active={activeTab === 'ideas'} label="ไอเดีย" count={dashboardCounts.ideas} onClick={() => goTo('ideas')} />
          <TabButton id="drafts" active={activeTab === 'drafts'} label="ร่าง" count={dashboardCounts.approvals} onClick={() => goTo('approvals')} />
          <TabButton id="posts" active={activeTab === 'posts'} label="โพสต์" count={dashboardCounts.ready} onClick={() => goTo('queue')} />
          <form className="mx-find" role="search" onSubmit={(event) => { event.preventDefault(); jumpToContent(findText) }}>
            <input type="search" value={findText} onChange={(event) => { setFindText(event.target.value); setFindMsg(null) }} onFocus={() => setToolsOpen(false)} inputMode="numeric" enterKeyHint="go" placeholder="ไปที่ #เลข" aria-label="ไปที่คอนเทนต์ตามเลข เช่น 12" aria-describedby="mx-find-msg" />
            <button type="submit">ไป</button>
            <span id="mx-find-msg" className="mx-find-msg" role="status" aria-live="polite" onClick={() => setFindMsg(null)}>{findMsg?.text || ''}</span>
          </form>
          <details ref={toolsRef} className={`mx-tools ${activeTab === 'tools' ? 'active' : ''}`} open={toolsOpen} onToggle={(event) => setToolsOpen(event.currentTarget.open)}>
            <summary data-view="tools">เครื่องมือ{activeTool ? <span className="mx-tools-current"> · {activeTool[1]}</span> : null}<span aria-hidden="true"> ▾</span></summary>
            <div className="mx-tools-menu">
              {toolViews.map(([id, label, count]) => (
                <button key={id} type="button" data-view={id} className={view === id ? 'active' : ''} onClick={() => goTo(id)}>
                  <span>{label}</span>{typeof count === 'number' && count > 0 && <strong>{count}</strong>}
                </button>
              ))}
            </div>
          </details>
        </nav>
      </div>
      <main className="mx-main">
        {activeTab === 'posts' && (
          <div className="mx-content mx-subtabs-wrap">
            <div className="mx-subtabs" role="tablist" aria-label="มุมมองโพสต์">
              <button type="button" role="tab" aria-selected={view === 'queue'} className={view === 'queue' ? 'active' : ''} onClick={() => setView('queue')}>รายการ</button>
              <button type="button" role="tab" aria-selected={view === 'calendar'} className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>ปฏิทิน</button>
            </div>
          </div>
        )}
        {view === 'ideas' && (
          <IdeasView
            feed={{ ...researchFeed, syncState }}
            research={researchIdeas}
            radar={radarCards}
            examples={exampleCards}
            radarLoading={radarLoading}
            manualIdea={workspace.manualIdea}
            onManualChange={(manualIdea) => save((ws) => ({ ...ws, manualIdea }))}
            onAddManual={addManualIdea}
            onCreate={pickResearchIdea}
            onSaveIdea={saveIdeaForLater}
            onDismiss={dismissResearchIdea}
            onLoadRadar={loadTrendRadar}
            onReload={loadResearchIdeas}
            highlight={returnedIdea}
            freshJobs={freshByIdea}
            freshWorker={contentWorker}
            onFreshContent={startFreshContent}
            freshIdea={freshIdea}
          />
        )}
        {view === 'studio' && (
          <StudioView
            studio={workspace.studio}
            generated={workspace.generated}
            posterCopy={workspace.posterCopy || defaultPosterCopy}
            onPromptChange={(prompt) => save((ws) => ({ ...ws, studio: { ...ws.studio, prompt, sourceIdeaId: null } }))}
            onChannelChange={(channel) => save((ws) => ({ ...ws, studio: { ...ws.studio, channel } }))}
            artwork={(workspace.mediaAssets || []).find((asset) => asset.id === workspace.generated?.mediaAssetId)}
            onDesignImage={() => setArtworkBrief({ ...workspace.generated, id: 'generated', title: workspace.generated?.headline })}
            onGenerate={() => generateContent(workspaceRef.current.studio.prompt)}
            onPickHook={(hook) => { save((ws) => ({ ...ws, generated: applyHookChoice(ws.generated, hook) })); notify('เปลี่ยนประโยคเปิดและพาดหัวแล้ว · อ่านต่อทั้งโพสต์ว่ายังลื่น') }}
            onQueue={addGeneratedToQueue}
            onCopy={copyText}
            onBack={() => goTo('approvals')}
          />
        )}
        {view === 'approvals' && (
          <ApprovalsView
            drafts={pendingDrafts}
            selected={selectedDraft}
            mediaAssets={workspace.mediaAssets || []}
            posterCopy={workspace.posterCopy || defaultPosterCopy}
            mediaLoading={mediaLoading}
            onSelect={setSelectedId}
            onUpdate={updatePost}
            onCopy={copyText}
            onGenerateImage={(post) => { if (!blockedWhileLoading()) setArtworkBrief(post) }}
            onUploadArtwork={uploadArtwork}
            onDeleteMediaAsset={deleteMediaAsset}
            onDelete={deletePost}
            onArchive={archivePost}
            onReturnToIdea={returnDraftToIdea}
            freshJobs={freshByPost}
            freshWorker={contentWorker}
            onFreshContent={startFreshContent}
            onNewDraft={() => goTo('studio')}
            focusNo={focusNo}
            loading={syncState.state === 'loading'}
            onWaitNotice={blockedWhileLoading}
          />
        )}
        {view === 'queue' && (
          <QueueView
            posts={approvedDrafts}
            mediaAssets={workspace.mediaAssets || []}
            facebookConnection={facebookConnection}
            publishingId={facebookPublishingId}
            onCreate={() => goTo('ideas')}
            onUpdate={updatePost}
            onPublishFacebook={publishToFacebook}
            onRecordManual={recordManualPublication}
            onCopy={copyText}
            focusNo={focusNo}
            loading={syncState.state === 'loading'}
          />
        )}
        {view === 'channels' && (
          <ChannelsView
            posts={allDrafts}
            facebookConnection={facebookConnection}
            onCreate={() => goTo('studio')}
            onQueue={() => goTo('queue')}
          />
        )}
        {view === 'references' && (
          <ReferenceRadarView
            query={workspace.referenceQuery || referenceStarterQueries[0]}
            sources={referenceSources}
            starterQueries={referenceStarterQueries}
            form={{ ...defaultReferenceForm, ...(workspace.referenceForm || {}) }}
            references={workspace.references || []}
            knowledgeCount={dashboardCounts.knowledge}
            selectedReference={selectedReference}
            loading={referenceLoading}
            onQueryChange={(referenceQuery) => save((ws) => ({ ...ws, referenceQuery }))}
            onFormChange={updateReferenceForm}
            onLoadRadar={loadReferenceRadar}
            onAdd={addReference}
            onSelect={setSelectedReferenceId}
            onDelete={deleteReference}
            onCopy={(reference) => copyText(buildReferenceBrief(reference))}
            onCreate={createFromReference}
            onSaveIdea={saveReferenceAsIdea}
            onExportKnowledge={exportKnowledgeBase}
            onSaveKnowledge={saveKnowledgeBaseToObsidian}
          />
        )}
        {view === 'gallery' && (
          <GalleryView
            drafts={allDrafts}
            generated={workspace.generated}
            mediaLoading={mediaLoading}
            mediaResult={mediaResult}
            mediaAssets={workspace.mediaAssets || []}
            selectedBriefId={selectedBriefId}
            onSelectBrief={setSelectedBriefId}
            onCreateContent={() => goTo('studio')}
            posterCopy={workspace.posterCopy || defaultPosterCopy}
            visualStyles={assetxVisualStyles}
            visualStyleId={visualStyleId}
            onVisualStyleChange={setVisualStyleId}
            onPosterCopyChange={updatePosterCopy}
            onPosterCopyReset={resetPosterCopy}
            onApplyPosterCopy={applyPosterCopyFromBrief}
            onUploadArtwork={uploadArtwork}
            onDeleteMediaAsset={deleteMediaAsset}
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
            mediaAssets={workspace.mediaAssets || []}
            filter={libraryFilter}
            sort={librarySort}
            previewChannel={previewChannel}
            onFilterChange={(value) => { setLibraryPreviewId(null); setLibraryFilter(value) }}
            onSortChange={(value) => { setLibraryPreviewId(null); setLibrarySort(value) }}
            onPreviewChannelChange={setPreviewChannel}
            onCreate={generateContent}
            onArchive={archivePost}
            onRestore={restorePost}
            onDelete={deletePost}
            onDeleteSavedIdea={deleteSavedIdea}
            onCopy={copyText}
            focusNo={focusNo}
            previewId={libraryPreviewId}
            loading={syncState.state === 'loading'}
          />
        )}
        {view === 'calendar' && <CalendarView posts={approvedDrafts} onQueue={() => setView('queue')} />}
        {view === 'metrics' && (
          <MetricsView
            metrics={workspace.metrics || []}
            form={metricForm}
            onFormChange={setMetricForm}
            onAdd={addMetricRecord}
            onDelete={deleteMetricRecord}
          />
        )}
        {view === 'pipeline' && <PipelineView feed={researchFeed} syncState={syncState} facebookConnection={facebookConnection} counts={dashboardCounts} onReload={loadResearchIdeas} />}
        {view === 'inbox' && <InboxView onCopy={copyText} onCreate={generateContent} />}
        {artworkBrief && <ArtworkEditor
          key={artworkBrief.id}
          brief={artworkBrief}
          asset={artworkBrief.id === 'generated'
            ? (workspace.mediaAssets || []).find((asset) => asset.id === artworkBrief.mediaAssetId)
            : findMediaForPost(workspace.mediaAssets || [], artworkBrief)}
          onSave={attachDesignedArtwork}
          onClose={() => setArtworkBrief(null)}
        />}
        {/* พื้นที่ประกาศถาวร: โปรแกรมอ่านหน้าจออ่านทุกข้อความแจ้งผล (เดิมข้อความโผล่แล้วหายไปเงียบ ๆ) */}
        <div className="mx-toast-region" role="status" aria-live="polite">
          {toast && <div className={`mx-toast ${toast.type === 'error' || toast.type === 'warn' ? toast.type : ''}`}>{toast.message}</div>}
        </div>
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
  knowledgeCount,
  selectedReference,
  loading,
  onQueryChange,
  onFormChange,
  onLoadRadar,
  onAdd,
  onSelect,
  onDelete,
  onCopy,
  onCreate,
  onSaveIdea,
  onExportKnowledge,
  onSaveKnowledge,
}) {
  const activeSource = sourceFromId(form.sourceId)
  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">คลังตัวอย่างโฆษณา</div>
          <h1>ดูตัวอย่างโฆษณาในตลาด แล้วถอดเป็นแนวทางของ AssetX</h1>
          <p>เปิดแหล่งจริงเพื่อดูรูปแบบโฆษณา ภาพ และวิดีโอ แล้วบันทึกเฉพาะข้อสังเกตที่นำมาสร้างงานใหม่ได้อย่างปลอดภัย</p>
        </div>
        <div className="mx-page-actions">
          <button className="mx-secondary" onClick={onSaveKnowledge} disabled={!knowledgeCount}>
            บันทึกโน้ตความรู้ลงเครื่อง{knowledgeCount ? ` (${knowledgeCount})` : ''}
          </button>
          <button className="mx-secondary" onClick={onExportKnowledge} disabled={!knowledgeCount}>
            ดาวน์โหลดโน้ตความรู้ (.md){knowledgeCount ? ` (${knowledgeCount})` : ''}
          </button>
          <button className="mx-secondary" onClick={onLoadRadar} disabled={loading}>
            {loading ? 'กำลังค้น...' : 'ค้นตัวอย่างอัตโนมัติ'}
          </button>
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
              <div className="mx-kicker">บันทึกตัวอย่าง</div>
              <h2>บันทึกสิ่งที่เจอจากตลาด</h2>
            </div>
            <a className="mx-mini-button" href={activeSource.searchUrl(query)} target="_blank" rel="noreferrer">เปิด {activeSource.name}</a>
          </div>
          <label>
            หัวข้อ / ชื่อตัวอย่าง
            <input value={form.title} onChange={(event) => onFormChange({ title: event.target.value })} placeholder="เช่น Hook โฆษณาเจ้าของที่ดินต้องการเงินก้อน" />
          </label>
          <label>
            ลิงก์ที่มา
            <input value={form.url} onChange={(event) => onFormChange({ url: event.target.value })} placeholder="วางลิงก์โฆษณา ข่าว หรือหน้าตัวอย่าง" />
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
            ประโยคเปิดที่น่าสนใจ
            <textarea value={form.hook} onChange={(event) => onFormChange({ hook: event.target.value })} placeholder="ประโยคเปิด ปัญหาที่คนเจอ หรือคำถามที่ดึงความสนใจ" />
          </label>
          <label>
            รูปแบบภาพหรือวิดีโอ
            <textarea value={form.visualPattern} onChange={(event) => onFormChange({ visualPattern: event.target.value })} placeholder="เช่น โต๊ะเอกสาร โฉนดถูกปิดข้อมูล แผนที่ แสงธรรมชาติ โทนพรีเมี่ยม" />
          </label>
          <label>
            มุมที่ควรทำแบบ AssetX
            <textarea value={form.contentAngle} onChange={(event) => onFormChange({ contentAngle: event.target.value })} placeholder="แปลงเป็นแนวคิดของเรา ไม่ลอกข้อความเดิม" />
          </label>
          <label>
            ป้ายกำกับ
            <input value={form.tags} onChange={(event) => onFormChange({ tags: event.target.value })} placeholder="ขายฝาก, โฉนด, นักลงทุน" />
          </label>
          <label>
            หมายเหตุ
            <textarea value={form.notes} onChange={(event) => onFormChange({ notes: event.target.value })} placeholder="ข้อควรระวัง หรือสิ่งที่อยากลองกับแบรนด์เรา" />
          </label>
          <button className="mx-primary" onClick={onAdd}>บันทึกตัวอย่าง</button>
        </article>

        <div className="mx-reference-side">
          <article className="mx-pattern-panel">
            <div className="mx-kicker">ถอดรูปแบบ</div>
            <h2>{selectedReference ? selectedReference.title : 'ยังไม่ได้เลือกตัวอย่าง'}</h2>
            {selectedReference ? (
              <>
                <div className="mx-reference-meta">
                  <span>{sourceFromId(selectedReference.sourceId).name}</span>
                  {selectedReference.url && <span>{hostFromUrl(selectedReference.url)}</span>}
                  <span className={`risk-${selectedReference.risk}`}>{selectedReference.risk === 'high' ? 'เสี่ยงสูง' : selectedReference.risk === 'low' ? 'เสี่ยงต่ำ' : 'เสี่ยงกลาง'}</span>
                </div>
                <ContentBlock title="บรีฟพร้อมใช้" value={buildReferenceBrief(selectedReference)} onCopy={() => onCopy(selectedReference)} collapsed />
                <div className="mx-card-actions">
                  <button className="mx-primary" onClick={() => onCreate(selectedReference)}>ร่างโพสต์</button>
                  <button className="mx-secondary" onClick={() => onSaveIdea(selectedReference)}>เก็บไว้ก่อน</button>
                  {selectedReference.url && <a className="mx-secondary as-link" href={selectedReference.url} target="_blank" rel="noreferrer">อ่านต้นทาง</a>}
                </div>
              </>
            ) : (
              <p>เริ่มจากกดค้นตัวอย่างอัตโนมัติ หรือเปิดแหล่งด้านบนแล้วบันทึกตัวอย่างแรก ระบบจะสรุปบรีฟให้</p>
            )}
          </article>

          <div className="mx-reference-list">
            {references.length === 0 && <div className="mx-empty">ยังไม่มีตัวอย่างในคลัง กดค้นตัวอย่างอัตโนมัติ หรือเปิด Meta Ads Library / TikTok Creative Center แล้วบันทึกรายการแรกเข้ามาได้เลย</div>}
            {references.map((reference) => (
              <article className={`mx-reference-item ${selectedReference?.id === reference.id ? 'active' : ''}`} key={reference.id}>
                <button onClick={() => onSelect(reference.id)}>
                  <span>{sourceFromId(reference.sourceId).name}</span>
                  <strong>{reference.title}</strong>
                  <p>{reference.contentAngle || reference.hook || reference.visualPattern || 'ยังไม่ได้ถอดรูปแบบ'}</p>
                </button>
                <div className="mx-reference-tags">
                  {(reference.tags || []).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <div className="mx-card-actions">
                  <button className="mx-mini-button" onClick={() => onCreate(reference)}>ร่างโพสต์</button>
                  <button className="mx-mini-button" onClick={() => onCopy(reference)}>คัดลอกบรีฟ</button>
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

// ไอเดีย: การ์ดจากรีเสิร์ชขึ้นก่อน (ใหม่สุดก่อน) → การ์ดจากการสำรวจตลาด → หัวข้อตัวอย่างพับไว้ท้ายหน้า
function IdeasView({
  feed,
  research,
  radar,
  examples,
  radarLoading,
  manualIdea,
  onManualChange,
  onAddManual,
  onCreate,
  onSaveIdea,
  onDismiss,
  onLoadRadar,
  onReload,
  highlight = null,
  freshJobs = {},
  freshWorker = null,
  onFreshContent = null,
  freshIdea = null,
}) {
  const PAGE_SIZE = 6
  const [sort, setSort] = useState('newest')
  const [showAll, setShowAll] = useState(false)
  const [angleChoice, setAngleChoice] = useState({})
  const [expanded, setExpanded] = useState({})
  // ไอเดียที่เพิ่งได้มุมใหม่จาก AI → เลือกช่องแรก (มุมใหม่) ให้เลย
  useEffect(() => {
    if (freshIdea?.id) setAngleChoice((prev) => ({ ...prev, [`research-${freshIdea.id}`]: 0 }))
  }, [freshIdea])
  const syncState = feed.syncState || { state: 'saved' }
  const ordered = useMemo(() => {
    const byDate = (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    const byScore = (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)
    const sorted = [...research].sort(sort === 'score' ? byScore : byDate)
    // ไอเดียที่เพิ่งย้อนกลับจากแท็บร่าง ขึ้นบนสุด (ไม่งั้นไอเดียเก่าจะจมอยู่หน้าหลัง ๆ)
    const back = highlight ? sorted.findIndex((idea) => idea.dbId === highlight.id) : -1
    return back > 0 ? [sorted[back], ...sorted.slice(0, back), ...sorted.slice(back + 1)] : sorted
  }, [research, sort, highlight])
  const live = [...ordered, ...radar]
  const visible = showAll ? live : live.slice(0, PAGE_SIZE)
  const hidden = Math.max(0, live.length - visible.length)
  const status = describeResearchFeed(feed)
  const showNotice = feed.state !== 'ok' || research.length === 0

  const renderCard = (idea) => {
    const isResearch = idea.kind === 'research'
    const isExample = idea.kind === 'example'
    const angles = Array.isArray(idea.angles) ? idea.angles : []
    const angleIndex = angleChoice[idea.id] ?? 0
    const angleText = angles[angleIndex]?.brief || idea.angle
    const isReturned = Boolean(highlight && isResearch && idea.dbId === highlight.id)
    const isFresh = Boolean(freshIdea && isResearch && idea.dbId === freshIdea.id)
    const freshJob = isResearch && idea.dbId ? freshJobs[idea.dbId] || null : null
    const freshBusy = isActiveFreshJob(freshJob)
    const freshNote = freshJobStatus(freshJob, freshWorker)
    // คิดใหม่ได้เมื่อ AI ร่างไอเดียนี้ได้ (มีข้อเท็จจริง · เตือนภัย · หรือเคยร่างจากคลังความรู้แล้ว) — กติกาเดียวกับรอบรีเสิร์ช ตัวรับงานตรวจซ้ำอีกชั้น
    const canFresh = Boolean(isResearch && idea.dbId && onFreshContent && (idea.hasFacts || idea.subtype === 'scam' || angles.some((item) => item?.draft?.caption)))
    return (
      <article className={`mx-idea-card ${isExample ? 'example' : ''} ${isReturned || isFresh ? 'mx-focus' : ''}`} key={isReturned ? `${idea.id}-${highlight.at}` : isFresh ? `${idea.id}-f${freshIdea.at}` : idea.id}>
        <div className="mx-idea-top">
          <span>{isExample ? 'ตัวอย่าง' : idea.kind === 'radar' ? 'สำรวจตลาด' : idea.type}</span>
          <strong>{isResearch ? [idea.dbId ? `ไอเดีย ${idea.dbId}` : '', idea.createdAt ? thaiDate(idea.createdAt) : 'ใหม่'].filter(Boolean).join(' · ') : isExample ? 'จากแม่แบบ' : 'จากการสำรวจตลาด'}</strong>
        </div>
        <h2>
          {idea.url ? (
            <a className="mx-idea-title-link" href={idea.url} target="_blank" rel="noreferrer">{idea.title}</a>
          ) : idea.title}
        </h2>
        {angles.length > 1 && (
          <fieldset className="mx-angle-pick">
            <legend>เลือกมุมเล่า</legend>
            {angles.map((item, index) => (
              <label key={`${idea.id}-${index}`} className={angleIndex === index ? 'active' : ''}>
                <input type="radio" name={`angle-${idea.id}`} checked={angleIndex === index} onChange={() => setAngleChoice((prev) => ({ ...prev, [idea.id]: index }))} />
                <span>{item.label}{item.fresh ? ' · ✨ ใหม่' : ''}{item.draft?.caption ? ' · ร่างพร้อม' : ''}{idea.chosenAngle && item.label === idea.chosenAngle ? ' · เคยร่างแล้ว' : ''}</span>
              </label>
            ))}
          </fieldset>
        )}
        <p className={expanded[idea.id] ? 'open' : ''}>{angleText}</p>
        {String(angleText || '').length > 160 && (
          <button type="button" className="mx-more-link" aria-expanded={Boolean(expanded[idea.id])} onClick={() => setExpanded((prev) => ({ ...prev, [idea.id]: !prev[idea.id] }))}>
            {expanded[idea.id] ? 'ย่อ' : 'อ่านต่อ'}
          </button>
        )}
        <div className="mx-tags">
          {isResearch && (angles[angleIndex]?.draft?.caption
            ? <span className="mx-tag-ai" title="AI เขียนร่างโพสต์เต็มจากข้อเท็จจริงของไอเดียนี้ไว้แล้ว — กด ร่างโพสต์ ได้ร่างนี้ทันที">ร่าง AI พร้อม</span>
            : idea.hasFacts
              ? <span title="มีข้อเท็จจริงแล้ว รอ AI ร่างในรอบรีเสิร์ชถัดไป — กด ร่างโพสต์ ตอนนี้จะได้ร่างจากแม่แบบ">รอร่าง AI</span>
              : <span title="AI ไม่ร่างให้ไอเดียที่ยังไม่มีข้อเท็จจริงจากต้นทาง (คลิปที่ยังไม่ถอดคำบรรยาย · ข่าวที่ดึงเนื้อไม่ได้) เพราะจะเดารายละเอียด — ยกเว้นเรื่องมิจฉาชีพ/เตือนภัย ที่ AI ร่างจากความรู้ทั่วไปให้ในรอบถัดไป · กด ร่างโพสต์ ตอนนี้จะได้ร่างจากแม่แบบ">ไม่มีข้อเท็จจริง · ใช้แม่แบบ</span>)}
          {isResearch && idea.chosenAngle && <span title="เคยกด ร่างโพสต์ แล้วย้อนกลับมาเป็นไอเดีย — ร่างเดิมพักไว้ในคลังผลงาน · ไอเดียนี้ไม่หมดอายุเอง กด ทิ้ง ถ้าไม่ใช้แล้ว">{isReturned ? 'เพิ่งย้อนกลับจากร่าง' : 'เคยร่างแล้ว'}{idea.chosenAngle !== 'มุมหลัก' && !angles.some((item) => item.label === idea.chosenAngle) ? ` (${idea.chosenAngle})` : ''}</span>}
          {!isExample && <span>{displaySource(idea.source)}</span>}
          {idea.audience && <span title={isResearch ? 'ทุกมุมเล่าและร่าง AI ของไอเดียนี้เขียนถึงคนกลุ่มนี้กลุ่มเดียว' : undefined}>{isResearch ? `พูดกับ: ${idea.audience}` : idea.audience}</span>}
          {idea.eventDate && <span>วันที่ {thaiDate(idea.eventDate) || idea.eventDate}</span>}
          {idea.url && <a href={idea.url} target="_blank" rel="noreferrer">เปิดต้นทาง</a>}
        </div>
        <div className="mx-card-actions">
          <button className="mx-primary" onClick={() => onCreate(idea.title, idea, angleIndex)}>ร่างโพสต์</button>
          {canFresh && (
            <button className="mx-ghost" disabled={freshBusy} title="ไม่ชอบมุมเล่าที่มี? ให้ AI คิดมุมใหม่และเขียนร่างใหม่ทั้งชิ้นสด ๆ บนคอมสำนักงาน (ราว 1–3 นาที) · มุมเดิมยังอยู่ครบ" onClick={() => onFreshContent({ idea })}>{freshBusy ? 'AI กำลังคิด…' : '✨ คิดคอนเทนต์ใหม่ (AI)'}</button>
          )}
          <button className="mx-ghost" onClick={() => onSaveIdea(idea)}>เก็บไว้ก่อน</button>
          {idea.dbId && onDismiss && <button className="mx-ghost" onClick={() => onDismiss(idea)}>ทิ้ง</button>}
        </div>
        {freshNote && <div className={`mx-fresh-status ${freshNote.tone}`} role="status">{freshNote.text}</div>}
      </article>
    )
  }

  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">ไอเดีย</div>
          <h1>เลือกไอเดียที่จะทำเป็นโพสต์</h1>
          <p>จากรีเสิร์ช {research.length} หัวข้อ{feed.total > research.length ? ` (คิวมี ${feed.total} แสดงได้ ${research.length})` : ''}{radar.length ? ` · จากการสำรวจตลาด ${radar.length} หัวข้อ` : ''} · เรียง{sort === 'score' ? 'ตามคะแนน' : 'ใหม่สุดก่อน'}</p>
        </div>
        <div className="mx-page-actions">
          <div className="mx-segment" role="group" aria-label="เรียงไอเดีย">
            <button type="button" className={sort === 'newest' ? 'active' : ''} aria-pressed={sort === 'newest'} onClick={() => setSort('newest')}>ใหม่สุด</button>
            <button type="button" className={sort === 'score' ? 'active' : ''} aria-pressed={sort === 'score'} onClick={() => setSort('score')}>คะแนนสูงสุด</button>
          </div>
          <button className="mx-secondary" onClick={onLoadRadar} disabled={radarLoading}>{radarLoading ? 'กำลังสำรวจ...' : 'สำรวจตลาดอัตโนมัติ'}</button>
        </div>
      </div>
      {showNotice && (
        <div className={`mx-feed-notice ${status.tone}`} role="status">
          <span>{feed.state === 'ok' ? 'ยังไม่มีไอเดียจากรีเสิร์ชในคิว — ตัวเก็บรันบนเครื่องของเจ้าของตามตารางเวลา กลับมาดูใหม่หลังรอบถัดไป' : status.text}</span>
          {status.action === 'login' && <button type="button" className="mx-secondary" onClick={() => reloadForLogin(syncState)}>เข้าสู่ระบบใหม่</button>}
          {status.action === 'retry' && <button type="button" className="mx-secondary" onClick={onReload}>ลองใหม่</button>}
        </div>
      )}
      {live.length > 0 && <div className="mx-idea-grid">{visible.map(renderCard)}</div>}
      {live.length > PAGE_SIZE && (
        <div className="mx-more-row">
          <button className="mx-secondary" type="button" onClick={() => setShowAll((value) => !value)}>{showAll ? 'แสดงน้อยลง' : `ดูเพิ่ม (${hidden})`}</button>
        </div>
      )}
      <div className="mx-manual">
        <label htmlFor="mx-manual-idea">เพิ่มไอเดียเอง</label>
        <input id="mx-manual-idea" value={manualIdea} onChange={(event) => onManualChange(event.target.value)} placeholder="เช่น ทำคอนเทนต์เจ้าของที่ดินต้องการเงินก้อน" />
        <button onClick={onAddManual} disabled={!manualIdea.trim()}>ร่างโพสต์</button>
      </div>
      <details className="mx-example-fold">
        <summary>หัวข้อตัวอย่างจากแม่แบบ ({examples.length}) — ไม่ได้มาจากรีเสิร์ช</summary>
        <div className="mx-idea-grid">{examples.map(renderCard)}</div>
      </details>
    </section>
  )
}

function StudioView({ studio, generated, posterCopy, artwork, onDesignImage, onChannelChange, onPromptChange, onGenerate, onQueue, onCopy, onBack, onPickHook }) {
  const posterPrompt = generated ? buildSocialPosterPrompt({
    title: generated.headline || studio.prompt,
    imagePrompt: generated.imagePrompt,
  }, posterCopy) : ''
  return (
    <section className="mx-content mx-studio">
      <div className="mx-page-head compact">
        <div>
          <div className="mx-kicker">ร่าง · เขียนโพสต์ใหม่</div>
          <h1>พิมพ์หัวข้อ แล้วให้ระบบร่างแคปชั่น บรีฟรูป และสคริปต์ให้</h1>
          <p>ขั้นต่อไป (ใส่ภาพ · ตั้งเวลา · โพสต์) ทำในแท็บ ร่าง และ โพสต์</p>
        </div>
        <div className="mx-page-actions"><button className="mx-secondary" type="button" onClick={onBack}>← กลับไปร่างที่รอตรวจ</button></div>
      </div>
      <div className="mx-prompt-box">
        <textarea value={studio.prompt} onChange={(event) => onPromptChange(event.target.value)} placeholder="พิมพ์หัวข้อที่อยากโพสต์ เช่น เจ้าของที่ดินต้องการเงินก่อน แต่ไม่อยากขายขาด" />
        <button className="mx-primary" onClick={onGenerate}>ร่างโพสต์</button>
      </div>
      <label className="mx-schedule-row">ช่องทาง
        <select value={studio.channel} onChange={(event) => onChannelChange(event.target.value)}>
          {assetxChannels.map((channel) => <option key={channel.value} value={channel.value}>{channel.label}</option>)}
        </select>
      </label>
      <div className="mx-model-note">{generated?.meta?.generatedBy === 'llm' ? 'ร่างโดย AI จากข้อเท็จจริงที่สำรวจมา — ตรวจกับแหล่งที่มาและแก้ข้อความก่อนส่งตรวจทุกครั้ง' : 'ร่างจากแม่แบบของ AssetX — ตรวจข้อเท็จจริงและแก้ข้อความก่อนส่งตรวจทุกครั้ง'}</div>
      {generated && (
        <div className="mx-generated-grid">
          <article className="mx-review-card wide">
            <div className="mx-review-head">
              <div><div className="mx-kicker">ร่างพร้อมตรวจ</div><h2>{generated.headline}</h2></div>
              <span className="mx-pass">โครงสร้าง {generated.meta?.captionQuality?.score ?? '-'}/100</span>
            </div>
            <ContentBlock title="แคปชั่น" value={generated.caption} onCopy={() => onCopy(generated.caption)} />
            <HookPicker hooks={generated.meta?.hooks} caption={generated.caption} onPick={onPickHook} />
            <ContentBlock title="บรีฟรูป (ภาษาอังกฤษ สำหรับโปรแกรมสร้างภาพ)" value={posterPrompt} onCopy={() => onCopy(posterPrompt)} collapsed />
            <ContentBlock title="สคริปต์วิดีโอ" value={generated.videoScript} onCopy={() => onCopy(generated.videoScript)} collapsed />
            <div className="mx-card-actions end">
              <button className="mx-primary" onClick={() => onQueue('pending')}>ส่งเข้ารอตรวจ</button>
              <button className="mx-secondary" onClick={() => onQueue('approved')}>อนุมัติ</button>
            </div>
          </article>
          <aside className="mx-preview">
            {artwork ? <ArtworkPreview src={artwork.dataUrl} alt={artwork.title} />
              : <div className="mx-preview-poster"><span>AssetX</span><strong>{generated.headline}</strong><small>ยังไม่มีภาพแนบ</small></div>}
            <button className="mx-primary" onClick={onDesignImage}>{artwork ? 'แก้ไขภาพโพสต์' : 'ออกแบบภาพ AI'}</button>
          </aside>
        </div>
      )}
    </section>
  )
}

function ApprovalsView({
  drafts,
  selected,
  mediaAssets = [],
  posterCopy,
  mediaLoading,
  onSelect,
  onUpdate,
  onCopy,
  onGenerateImage,
  onUploadArtwork,
  onDeleteMediaAsset,
  onDelete,
  onArchive,
  onReturnToIdea,
  onNewDraft,
  focusNo,
  loading = false,
  onWaitNotice,
  freshJobs = {},
  freshWorker = null,
  onFreshContent = null,
}) {
  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">ร่าง</div>
          <h1>ตรวจร่างก่อนโพสต์</h1>
          <p>ผ่านเกณฑ์ {drafts.filter((post) => post.reviewStatus === 'passed').length} · ติดเกณฑ์ {drafts.filter((post) => post.reviewStatus !== 'passed').length} · ทุกร่างต้องกดอนุมัติก่อนไปตั้งเวลา · กดเลข # บนการ์ดเพื่อคัดลอกไปวางในแชตตอนสั่งแก้</p>
        </div>
        <div className="mx-page-actions"><button className="mx-secondary" type="button" onClick={onNewDraft}>เขียนโพสต์ใหม่</button></div>
      </div>
      {loading && <p className="mx-warn">{LOADING_EDIT_NOTE}</p>}
      {drafts.length === 0 ? (
        <div className="mx-empty">ยังไม่มีร่างรอตรวจ — เลือกไอเดียในแท็บ ไอเดีย แล้วกด ร่างโพสต์ หรือกด เขียนโพสต์ใหม่</div>
      ) : (
        <div className="mx-approval-feed">
          {drafts.map((post) => {
            const postMedia = findMediaForPost(mediaAssets, post)
            const postPosterPrompt = buildSocialPosterPrompt({
              title: post.title,
              imagePrompt: post.imagePrompt,
            }, posterCopy)
            const freshJob = freshJobs[String(post.id)] || null
            const freshBusy = isActiveFreshJob(freshJob)
            const freshNote = freshJobStatus(freshJob, freshWorker)
            return (
              <article className={`mx-approval-card ${selected?.id === post.id ? 'active' : ''} ${isFocused(post, focusNo) ? 'mx-focus' : ''}`} data-content-no={post.contentNo || undefined} key={post.sampleOf || post.id} onClick={() => onSelect(post.id)}>
                <div className="mx-approval-media-column">
                  <div className="mx-approval-card-image">
                    {postMedia ? (
                      <ArtworkPreview src={postMedia.dataUrl} alt={postMedia.title} />
                    ) : (
                      <div className="mx-poster-placeholder compact">
                        <span>AssetX Estate</span>
                        <strong>{post.title}</strong>
                        <small>ยังไม่มีภาพแนบ</small>
                      </div>
                    )}
                  </div>
                  <button className="mx-primary" onClick={(event) => { event.stopPropagation(); onGenerateImage(post) }} disabled={mediaLoading === `image:${post.id}`}>
                    {postMedia ? 'แก้ไขภาพโพสต์' : 'ออกแบบภาพ AI'}
                  </button>
                  <label className={`mx-upload-button slim ${mediaLoading === `upload:${post.id}` ? 'disabled' : ''}`} onClick={(event) => event.stopPropagation()}>
                    {mediaLoading === `upload:${post.id}` ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปเอง'}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={mediaLoading === `upload:${post.id}`}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file) onUploadArtwork(file, post)
                      }}
                    />
                  </label>
                  {postMedia && (
                    <button className="mx-mini-button danger" onClick={(event) => { event.stopPropagation(); onDeleteMediaAsset(postMedia.id) }}>ลบรูป</button>
                  )}
                </div>
                <div className="mx-approval-copy-column">
                  <div className="mx-review-head">
                    <div>
                      <div className="mx-kicker">{channelLabel(post.channel)} · {displaySource(post.source)}{post.ideaId ? ` · จากไอเดีย ${post.ideaId}` : ''}{post.draftSource === 'ai' ? ` · ร่าง AI${post.angleLabel ? ` (${post.angleLabel})` : ''}` : ''}{post.replacesNo ? ` · คิดใหม่แทน ${formatContentNo(post.replacesNo)}` : ''}{post.createdAt ? ` · ${thaiDate(post.createdAt)}` : ''}{isSamplePost(post) ? ' · ตัวอย่าง' : ''}</div>
                      <h2><ContentNo post={post} onCopy={onCopy} />{post.title}</h2>
                    </div>
                    <span className={post.reviewStatus === 'passed' ? 'mx-pass' : 'mx-warn'}>{reviewLabel(post)}</span>
                  </div>
                  <textarea
                    className="mx-approval-caption"
                    value={post.caption}
                    readOnly={loading}
                    // แตะหรือพิมพ์ระหว่างโหลด = บอกเหตุผลทันที (บนมือถือแถบบอกด้านบนอาจเลื่อนพ้นจอไปแล้ว)
                    onClick={(event) => { event.stopPropagation(); if (loading) onWaitNotice?.() }}
                    onKeyDown={loading ? () => onWaitNotice?.() : undefined}
                    onChange={(event) => onUpdate(post.id, { caption: event.target.value })}
                  />
                  {/* อีโมจิให้อ่านง่าย (เจ้าของขอ 10 พ.ย. 2569) — ร่างใหม่จาก AI ได้อีโมจิเอง ปุ่มนี้ใส่ให้ร่างเดิม หรือเอาออกถ้าไม่ชอบ · ระบบวางตามโครงโพสต์ (lib/captionEmoji.js) */}
                  {(() => {
                    if (loading || post.status === 'posted' || post.facebookPostId) return null
                    const withEmoji = countEmoji(post.caption) >= DECORATED_MIN
                    const next = withEmoji ? stripEmoji(post.caption) : decorateCaption(post.caption)
                    if (!String(post.caption || '').trim() || next === post.caption) return null
                    return (
                      <div className="mx-caption-tools" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className="mx-mini-button"
                          title={withEmoji ? 'เอาอีโมจิออกจากแคปชั่นทั้งหมด (ตัวหนังสือคงเดิม)' : 'ใส่อีโมจิหน้าข้อ 1 2 3 · ถาม/ตอบ · ย่อหน้าเนื้อหา · บรรทัดชวนทักแชต (บรรทัดแรกคงเดิม)'}
                          onClick={() => onUpdate(post.id, { caption: next }, withEmoji ? 'เอาอีโมจิออกแล้ว · อนุมัติใหม่อีกครั้ง' : 'ใส่อีโมจิแล้ว · อ่านทั้งโพสต์อีกรอบก่อนอนุมัติ')}
                        >{withEmoji ? 'เอาอีโมจิออก' : '😊 ใส่อีโมจิ'}</button>
                      </div>
                    )
                  })()}
                  <HookPicker
                    hooks={post.hooks}
                    caption={post.caption}
                    disabled={loading || post.status === 'posted' || Boolean(post.facebookPostId)}
                    onPick={(hook) => {
                      const caption = swapOpeningLine(post.caption, hook.line)
                      onUpdate(post.id, {
                        caption,
                        ...(hook.headline ? { title: hook.headline } : {}),
                        ...(post.draftSource === 'ai' ? { videoScript: videoScriptFromDraft({ caption, cta: '' }) } : {}),
                        hookPattern: hook.pattern || null,
                        reviewStatus: 'needs_edit',
                      }, 'เปลี่ยนประโยคเปิดและพาดหัวแล้ว · อ่านทั้งโพสต์อีกรอบก่อนอนุมัติ')
                    }}
                  />
                  <label className="mx-schedule-row" onClick={(event) => event.stopPropagation()}>ช่องทาง
                    <select value={/facebook/i.test(post.channel) ? 'facebook' : post.channel} disabled={loading} onChange={(event) => onUpdate(post.id, { channel: event.target.value, reviewStatus: 'needs_edit' })}>
                      {assetxChannels.map((channel) => <option key={channel.value} value={channel.value}>{channel.label}</option>)}
                    </select>
                  </label>
                  <div className="mx-review-notes compact">
                    <strong>ผลตรวจเกณฑ์</strong>
                    {uniqueReviewNotes(post.reviewNotes).map((note, index) => <span key={index}>{note}</span>)}
                  </div>
                  <div className="mx-schedule-row compact" onClick={(event) => event.stopPropagation()}>
                    <label>
                      กำหนดวันโพสต์ (ไม่บังคับ)
                      <input
                        type="datetime-local"
                        value={scheduleInputValue(post.scheduledAt)}
                        onChange={(event) => onUpdate(post.id, { scheduledAt: event.target.value }, event.target.value ? 'บันทึกวันโพสต์แล้ว สถานะจะเปลี่ยนเมื่ออนุมัติ' : 'ล้างวันโพสต์แล้ว')}
                      />
                    </label>
                    {post.scheduledAt && <span>จะโพสต์ {thaiDateTime(post.scheduledAt)}</span>}
                    {postMedia && <span>{postMedia.width} × {postMedia.height} px</span>}
                  </div>
                  <div className="mx-card-actions">
                    <button className="mx-primary" onClick={(event) => { event.stopPropagation(); onUpdate(post.id, { status: post.scheduledAt ? 'scheduled' : 'approved', reviewStatus: 'passed', mediaAssetId: postMedia?.id || post.mediaAssetId || null }, post.scheduledAt ? 'อนุมัติแล้ว · ตั้งเวลาตามวันที่กำหนด' : 'อนุมัติแล้ว · ไปตั้งเวลาในแท็บ โพสต์') }}>อนุมัติ</button>
                    <button className="mx-ghost" onClick={(event) => { event.stopPropagation(); onArchive(post.id) }}>พักไว้</button>
                    {post.ideaId && onFreshContent && !post.facebookPostId && !isSamplePost(post) && (
                      <button className="mx-ghost" disabled={loading || freshBusy} title="ไม่ชอบคอนเทนต์นี้? ให้ AI คิดมุมใหม่และเขียนร่างใหม่ทั้งชิ้นสด ๆ (ราว 1–3 นาที) · ได้ร่างใหม่แทนร่างนี้ ร่างเดิมพักไว้ในคลังผลงาน" onClick={(event) => { event.stopPropagation(); onFreshContent({ post }) }}>{freshBusy ? 'AI กำลังคิด…' : '✨ คิดคอนเทนต์ใหม่ (AI)'}</button>
                    )}
                    {post.ideaId && onReturnToIdea && !post.facebookPostId && !isSamplePost(post) && (
                      <button className="mx-ghost" title={`ส่งไอเดีย ${post.ideaId} กลับไปแท็บ ไอเดีย ให้เลือกมุมเล่าใหม่ · ร่างนี้พักไว้ในคลังผลงาน`} onClick={(event) => { event.stopPropagation(); onReturnToIdea(post) }}>↩ ย้อนกลับเป็นไอเดีย</button>
                    )}
                    <details className="mx-more" onClick={(event) => event.stopPropagation()}>
                      <summary>เพิ่มเติม ▾</summary>
                      <div className="mx-more-menu">
                        {!post.facebookPostId && post.status !== 'posted' && /facebook/i.test(post.channel || '') && !/#[\p{L}\p{N}_]/u.test(post.caption || '') && <button type="button" onClick={() => {
                          const suggested = runAssetxMarketingModel({ prompt: post.topic || post.title, channel: 'facebook' })
                          onUpdate(post.id, { caption: appendMarketingHashtags(post.caption, suggested.hashtags) }, 'เพิ่มแฮชแท็กแล้ว กรุณาตรวจและอนุมัติอีกครั้ง')
                        }}>เพิ่มแฮชแท็ก</button>}
                        <button type="button" onClick={() => onCopy(postPosterPrompt)}>คัดลอกบรีฟรูป</button>
                        {postMedia && <a href={postMedia.dataUrl} download={`assetx-artwork-${postMedia.id}.jpg`}>ดาวน์โหลดรูป</a>}
                        <button type="button" className="danger" onClick={() => onDelete(post.id)}>ลบร่างนี้</button>
                      </div>
                    </details>
                  </div>
                  {freshNote && <div className={`mx-fresh-status ${freshNote.tone}`} role="status" onClick={(event) => event.stopPropagation()}>{freshNote.text}</div>}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ChannelsView({ posts, facebookConnection, onCreate, onQueue }) {
  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">ช่องทาง</div>
          <h1>สถานะช่องทางการตลาด</h1>
        </div>
        <div className="mx-row-actions">
          <button className="mx-primary" onClick={onCreate}>เขียนโพสต์ใหม่</button>
          <button className="mx-secondary" onClick={onQueue}>ไปที่โพสต์</button>
        </div>
      </div>
      <div className="mx-channel-table-wrap">
        <table className="mx-channel-table">
          <thead><tr><th>ช่องทาง</th><th>สิ่งที่ต้องเตรียม</th><th>วิธีโพสต์</th><th>รอตรวจ</th><th>อนุมัติแล้ว</th><th>บัญชี</th></tr></thead>
          <tbody>
            {marketingChannelSetup.map((channel) => {
              const channelPosts = posts.filter((post) => post.channel === channel.id)
              const pending = channelPosts.filter((post) => ['pending', 'draft', 'needs_edit'].includes(post.status)).length
              const queued = channelPosts.filter((post) => ['approved', 'scheduled'].includes(post.status)).length
              const facebookReady = channel.id === 'facebook' && facebookConnection?.connected
              return (
                <tr key={channel.id}>
                  <th scope="row">{channel.label}</th>
                  <td>{channel.preparation}</td>
                  <td><span className={facebookReady ? 'mx-channel-ready' : 'mx-channel-manual'}>{facebookReady ? 'โพสต์อัตโนมัติได้' : channel.id === 'facebook' ? 'ยังไม่เชื่อม Facebook' : 'โพสต์เองก่อน'}</span></td>
                  <td>{pending}</td>
                  <td>{queued}</td>
                  <td><a href={channel.managerUrl} target="_blank" rel="noreferrer">เปิดบัญชี</a></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {facebookConnection?.unauthorized && <p className="mx-channel-warning" role="alert">{SESSION_EXPIRED_MESSAGE}</p>}
      {facebookConnection?.tokenHealth?.warning && facebookConnection.tokenHealth.state !== 'unknown' && <p className="mx-channel-warning" role="status">Facebook: {facebookConnection.tokenHealth.warning}</p>}
      {facebookConnection?.tokenHealth?.state === 'unknown' && <p className="mx-channel-warning" role="status">Facebook: ยังไม่ทราบวันหมดอายุของการเชื่อมต่อ — เชื่อมแล้วใช้โพสต์ได้ตามปกติ</p>}
    </section>
  )
}

function QueueView({ posts, mediaAssets = [], facebookConnection, publishingId, onCreate, onUpdate, onPublishFacebook, onRecordManual, onCopy, focusNo, loading = false }) {
  const [queueFilter, setQueueFilter] = useState('action')
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  const groups = organizeMarketingQueue(posts, now)
  // ค้นด้วยเลขแล้วคอนเทนต์อยู่อีกกลุ่ม (รอโพสต์ / ตั้งเวลาแล้ว / โพสต์แล้ว) → สลับกลุ่มให้เห็นการ์ด
  useEffect(() => {
    if (!focusNo?.no) return
    const group = ['action', 'platformScheduled', 'posted'].find((key) => groups[key].some(({ post }) => post.contentNo === focusNo.no))
    if (group) setQueueFilter(group)
  }, [focusNo])
  const visibleItems = groups[queueFilter]
  const dueCount = groups.action.filter(({ queueState }) => queueState === 'overdue' || queueState === 'today').length
  const verificationCount = groups.platformScheduled.filter(({ post }) => post.scheduledAt && new Date(post.scheduledAt) <= now).length
  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">โพสต์</div>
          <h1>โพสต์ที่อนุมัติแล้ว รอตั้งเวลาและส่ง</h1>
          <p>Facebook ส่งอัตโนมัติจากหน้านี้ได้ ช่องทางอื่นเตรียมไฟล์แล้วบันทึกผลหลังโพสต์จริง</p>
        </div>
        <div className="mx-row-actions">
          <span className={facebookConnection?.connected ? 'mx-pass' : 'mx-warn'}>
            {facebookConnection?.loading
              ? 'กำลังตรวจ Facebook'
              : facebookConnection?.connected
                ? `Facebook · ${facebookConnection.pageName}`
                : 'ยังไม่เชื่อม Facebook'}
          </span>
          <button className="mx-secondary" onClick={onCreate}>ไปที่ไอเดีย</button>
        </div>
      </div>
      {loading && <p className="mx-warn">{LOADING_EDIT_NOTE}</p>}
      {facebookConnection?.unauthorized && <p role="alert" className="mx-warn">{SESSION_EXPIRED_MESSAGE}</p>}
      {facebookConnection?.error && <p role="alert" className="mx-warn">{facebookConnection.error}</p>}
      {facebookConnection?.tokenHealth?.warning && facebookConnection.tokenHealth.state !== 'unknown' && <p role="status" className="mx-warn" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{facebookConnection.tokenHealth.warning}</p>}
      {facebookConnection?.missing?.length > 0 && <p role="alert" className="mx-warn">ยังไม่เชื่อม Facebook Page — ตั้งค่าการเชื่อมต่อฝั่งเซิร์ฟเวอร์ แล้วดูสถานะที่หน้าช่องทาง</p>}
      {dueCount > 0 && <p className="mx-queue-due" role="status">มี {dueCount} โพสต์ที่ถึงกำหนดหรือเลยกำหนดแล้ว ต้องตรวจและเผยแพร่จริงตามช่องทาง</p>}
      {verificationCount > 0 && <p className="mx-queue-verify" role="status">มี {verificationCount} โพสต์ที่ตั้งเวลาบน Facebook และเวลาผ่านแล้ว กรุณาตรวจผลจริงใน Meta Business Suite</p>}
      <div className="mx-queue-tabs" aria-label="สถานะโพสต์">
        {[
          ['action', 'รอโพสต์'],
          ['platformScheduled', 'ตั้งเวลาแล้ว'],
          ['posted', 'โพสต์แล้ว'],
        ].map(([key, label]) => (
          <button key={key} type="button" className={queueFilter === key ? 'active' : ''} aria-pressed={queueFilter === key} onClick={() => setQueueFilter(key)}>
            {label} <span>{groups[key].length}</span>
          </button>
        ))}
      </div>
      <div className="mx-list">
        {visibleItems.length === 0 && <div className="mx-empty">ไม่มีโพสต์ในสถานะนี้</div>}
        {visibleItems.map(({ post, queueState }) => {
          const isFacebook = /facebook/i.test(String(post.channel || ''))
          const isPublishing = String(publishingId) === String(post.id)
          const isScheduledOnFacebook = Boolean(post.facebookPostId) && post.status === 'scheduled'
          const isPosted = post.status === 'posted'
          const isDelivered = isPosted || isScheduledOnFacebook
          const postMedia = findMediaForPost(mediaAssets, post)
          return (
            <article className={`mx-row-card mx-publish-row ${isFocused(post, focusNo) ? 'mx-focus' : ''}`} data-content-no={post.contentNo || undefined} key={post.id}>
              {postMedia && <ArtworkPreview className="mx-row-thumb" src={postMedia.dataUrl} alt={post.title} />}
              <div>
                <strong><ContentNo post={post} onCopy={onCopy} />{post.title}</strong>
                <span>{channelLabel(post.channel)} · {displaySource(post.source)}{isPosted ? (post.postedAt ? ` · โพสต์แล้ว ${thaiDateTime(post.postedAt)}` : '') : (post.scheduledAt ? ` · กำหนด ${thaiDateTime(post.scheduledAt)}` : '')}</span>
                <span className={`mx-queue-state ${queueState}`}>{queueState === 'platformScheduled' && post.scheduledAt && new Date(post.scheduledAt) <= now ? 'ถึงเวลาแล้ว · ตรวจผลจริงบน Facebook' : queueStateLabels[queueState]}</span>
                {post.publishError && <span className="mx-publish-error">{String(post.publishError).split(' — Facebook (')[0]}</span>}
              </div>
              <div className="mx-row-actions">
                <input
                  type="datetime-local"
                  value={scheduleInputValue(post.scheduledAt)}
                  disabled={isDelivered || isPublishing || loading}
                  aria-label={`วันและเวลาโพสต์ ${titleWithNo(post)}`}
                  onChange={(event) => onUpdate(post.id, { scheduledAt: event.target.value, status: event.target.value ? 'scheduled' : 'approved' }, event.target.value ? 'ตั้งวันโพสต์แล้ว' : 'ล้างวันโพสต์แล้ว')}
                />
                {isFacebook && (
                  <button
                    className="mx-primary"
                    disabled={!facebookConnection?.connected || isPublishing || isDelivered}
                    onClick={() => onPublishFacebook(post)}
                    title={post.scheduledAt ? 'Facebook จะเผยแพร่อัตโนมัติตามวันและเวลานี้' : 'เผยแพร่บน Facebook ทันที'}
                  >
                    {isScheduledOnFacebook
                      ? 'ตั้งเวลาแล้ว'
                      : isPosted
                        ? post.facebookPostId ? 'ส่งไป Facebook แล้ว' : 'บันทึกเอง · ยังไม่ยืนยัน Facebook'
                        : isPublishing
                          ? 'กำลังส่ง...'
                          : post.scheduledAt
                            ? 'ตั้งเวลา Facebook'
                            : 'โพสต์ Facebook'}
                  </button>
                )}
                {canRecoverManualFacebookPost(post) && (
                  <button className="mx-secondary" disabled={isPublishing} onClick={() => {
                    if (!window.confirm('โปรดตรวจหน้าเพจและคิวใน Meta Business Suite ว่าไม่มีโพสต์นี้แล้ว เพื่อป้องกันโพสต์ซ้ำ ยืนยันคืนรายการมารอตั้งเวลา? การคืนคิวจะล้างเวลาเดิม แต่ยังไม่ส่งโพสต์ไป Facebook')) return
                    const patch = recoverManualFacebookPost(post)
                    if (patch) onUpdate(post.id, patch, 'คืนคิวแล้ว กรุณาเลือกวันและเวลาใหม่')
                  }}>คืนคิวเพื่อตั้งเวลาใหม่</button>
                )}
                {!isFacebook && isPosted && post.manualReference && (
                  post.channel === 'line-oa'
                    ? <span>ยืนยันการส่งด้วยตนเอง · {post.manualReference}</span>
                    : <a href={post.manualReference} target="_blank" rel="noreferrer">ดูโพสต์ที่บันทึกไว้</a>
                )}
              </div>
              {!isFacebook && !isDelivered && <ManualPublishActions post={post} media={postMedia} onCopy={onCopy} onRecord={onRecordManual} />}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ManualPublishActions({ post, media, onCopy, onRecord }) {
  const [reference, setReference] = useState('')
  const channel = marketingChannelSetup.find((item) => item.id === post.channel)
  return (
    <details className="mx-manual-handoff">
      <summary>เตรียมโพสต์ {channel?.label || post.channel}</summary>
      <div className="mx-manual-handoff-actions">
        <button className="mx-secondary" type="button" onClick={() => onCopy(post.caption)}>คัดลอกแคปชั่น</button>
        {post.videoScript && <button className="mx-secondary" type="button" onClick={() => onCopy(post.videoScript)}>คัดลอกสคริปต์</button>}
        {media && <a className="mx-secondary as-link" href={media.dataUrl} download={`assetx-${post.id}.jpg`}>ดาวน์โหลดภาพ</a>}
        {channel && <a className="mx-secondary as-link" href={channel.managerUrl} target="_blank" rel="noreferrer">เปิด {channel.label}</a>}
      </div>
      <form className="mx-manual-proof" onSubmit={(event) => { event.preventDefault(); if (onRecord(post, reference)) setReference('') }}>
        <label>{post.channel === 'line-oa' ? 'รหัสหรือหลักฐานการส่งจาก LINE OA' : 'ลิงก์โพสต์ที่เผยแพร่แล้ว'}
          <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={post.channel === 'line-oa' ? 'เช่น รหัส Broadcast' : 'https://...'} />
        </label>
        <button className="mx-primary" type="submit">บันทึกผลที่โพสต์จริง</button>
      </form>
      {post.scheduledAt && <small>เวลาที่เลือกเป็นแผนในเว็บ ยังไม่ได้ตั้งเวลาบน {channel?.label || post.channel}</small>}
    </details>
  )
}

function GalleryView({
  drafts,
  generated,
  mediaLoading,
  mediaResult,
  mediaAssets = [],
  selectedBriefId,
  onSelectBrief,
  onCreateContent,
  posterCopy,
  visualStyles,
  visualStyleId,
  onVisualStyleChange,
  onPosterCopyChange,
  onPosterCopyReset,
  onApplyPosterCopy,
  onUploadArtwork,
  onDeleteMediaAsset,
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
      contentNo: post.contentNo,
      title: post.title,
      imagePrompt: post.imagePrompt,
      videoScript: post.videoScript,
      source: channelLabel(post.channel),
    })),
  ]
  const selectedStyle = visualStyles.find((style) => style.id === visualStyleId) || visualStyles[0]
  const selectedBrief = briefs.find((brief) => String(brief.id) === String(selectedBriefId)) || briefs[0]
  const fireflyPrompt = selectedBrief ? buildGalleryFireflyPrompt(selectedStyle, selectedBrief) : ''
  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">ห้องภาพ</div>
          <h1>เตรียมภาพสำหรับคอนเทนต์</h1>
        </div>
      </div>
      {!briefs.length && <div className="mx-gallery-empty">ยังไม่มีร่างที่มีบรีฟรูป <button className="mx-secondary" type="button" onClick={onCreateContent}>เขียนโพสต์ใหม่</button></div>}
      <div className="mx-gallery-flow">
        <div className="mx-gallery-fields">
          <label>
            คอนเทนต์
            <select value={selectedBrief ? String(selectedBrief.id) : ''} onChange={(event) => onSelectBrief(event.target.value)} disabled={!briefs.length}>
              {!briefs.length && <option value="">ยังไม่มีบรีฟรูป</option>}
              {briefs.map((brief) => <option key={brief.id} value={String(brief.id)}>{titleWithNo(brief)}</option>)}
            </select>
          </label>
          <label>
            สไตล์ภาพ
            <select value={selectedStyle.id} onChange={(event) => onVisualStyleChange(event.target.value)}>
              <optgroup label="ภาพแนว AssetX">
                {visualStyles.filter((style) => !style.artistic).map((style) => <option key={style.id} value={style.id}>{style.name}</option>)}
              </optgroup>
              <optgroup label="ภาพวาด 10 สไตล์">
                {visualStyles.filter((style) => style.artistic).map((style) => <option key={style.id} value={style.id}>{style.name}</option>)}
              </optgroup>
            </select>
          </label>
        </div>
        <div className="mx-gallery-prompt-head">
          <strong>บรีฟรูป (ภาษาอังกฤษ สำหรับวางใน Firefly)</strong>
          <span>{selectedStyle.allowPosterText ? 'ภาพพื้นหลังแนวโปสเตอร์ เพิ่มข้อความภายหลัง' : selectedStyle.description}</span>
        </div>
        <textarea aria-label="บรีฟรูป (ภาษาอังกฤษ สำหรับวางใน Firefly)" value={fireflyPrompt} readOnly placeholder="เลือกร่างเพื่อดูบรีฟรูป" />
        <div className="mx-gallery-prompt-actions">
          <button className="mx-primary" type="button" disabled={!fireflyPrompt} onClick={() => onCopy(fireflyPrompt)}>คัดลอกบรีฟรูป</button>
          <a className="mx-secondary as-link" href="https://firefly.adobe.com/" target="_blank" rel="noreferrer">เปิด Firefly</a>
        </div>
      </div>
      <article className="mx-upload-panel">
        <div>
          <div className="mx-kicker">คลังภาพ</div>
          <h2>นำภาพที่สร้างเสร็จกลับเข้าระบบ</h2>
          <p>ภาพที่เลือกจะถูกบีบอัดและผูกกับคอนเทนต์ด้านบน</p>
        </div>
        <div className="mx-upload-actions">
          <span>คอนเทนต์: <strong>{(selectedBrief && titleWithNo(selectedBrief)) || 'ยังไม่มีบรีฟ'}</strong></span>
          <label className={`mx-upload-button ${!selectedBrief ? 'disabled' : ''}`}>
            {mediaLoading === `upload:${selectedBrief?.id}` ? 'กำลังอัปโหลด...' : 'อัปโหลดภาพที่สร้างแล้ว'}
            <input
              type="file"
              accept="image/*"
              disabled={!selectedBrief || mediaLoading === `upload:${selectedBrief?.id}`}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file && selectedBrief) onUploadArtwork(file, selectedBrief)
              }}
            />
          </label>
        </div>
      </article>
      <details className="mx-gallery-advanced">
        <summary>ตัวเลือกขั้นสูง: ข้อความบนโปสเตอร์และการสร้างภาพอัตโนมัติ</summary>
      <div className="mx-visual-system">
        <div className="mx-visual-copy">
          <div className="mx-kicker">แนวภาพของ AssetX</div>
          <h2>โทนภาพหลัก: สมจริง พรีเมี่ยม น่าเชื่อถือ</h2>
          <p>ใช้ตัวอย่างโฆษณาเป็นแรงบันดาลใจได้ แต่ผลลัพธ์ต้องเป็นภาพใหม่ในภาษาภาพของ AssetX: สะอาด โปร่ง ข้อมูลครบแต่ไม่เปิดเผยข้อมูลลูกค้า และไม่มีข้อความไทยฝังในภาพ</p>
          <div className="mx-workflow-steps">
            <span>1 เลือกร่าง</span>
            <span>2 เลือกแนวภาพ</span>
            <span>3 สร้างภาพหรือวิดีโอ</span>
          </div>
        </div>
        <div className="mx-style-grid">
          {visualStyles.filter((style) => !style.artistic).map((style) => (
            <button className={`mx-style-card ${style.id === visualStyleId ? 'active' : ''}`} key={style.id} onClick={() => onVisualStyleChange(style.id)}>
              <span>{style.badge}</span>
              <strong>{style.name}</strong>
              <em>{style.description}</em>
              {style.imageAspectRatio && <small>{style.imageAspectRatio}</small>}
            </button>
          ))}
          <label className="mx-style-picker">
            <strong>สไตล์ภาพวาด (10 แบบ)</strong>
            <select value={selectedStyle.artistic ? selectedStyle.id : ''} onChange={(event) => event.target.value && onVisualStyleChange(event.target.value)}>
              <option value="">เลือกสไตล์ภาพวาด</option>
              {visualStyles.filter((style) => style.artistic).map((style) => <option key={style.id} value={style.id}>{style.name}</option>)}
            </select>
            {selectedStyle.artistic && <em>{selectedStyle.description}</em>}
          </label>
        </div>
      </div>
      <article className="mx-poster-editor">
        <div className="mx-section-head">
          <div>
            <div className="mx-kicker">ข้อความบนโปสเตอร์</div>
            <h2>กำหนดข้อความบนภาพก่อนสร้างโปสเตอร์</h2>
            <p>เลือกบรีฟด้านล่างเพื่อให้ระบบเติมข้อความตั้งต้นตามคอนเทนต์นั้น แล้วปรับแก้เองก่อนสร้างรูปได้</p>
          </div>
          <button className="mx-secondary" onClick={onPosterCopyReset}>รีเซ็ตข้อความ</button>
        </div>
        <div className="mx-poster-form">
          <label>
            หัวเรื่อง
            <input value={posterCopy.headline || ''} onChange={(event) => onPosterCopyChange({ headline: event.target.value })} />
          </label>
          <label>
            หัวเรื่องรอง
            <input value={posterCopy.subheadline || ''} onChange={(event) => onPosterCopyChange({ subheadline: event.target.value })} />
          </label>
          <label>
            จุดเด่น 1
            <input value={posterCopy.badge1 || ''} onChange={(event) => onPosterCopyChange({ badge1: event.target.value })} />
          </label>
          <label>
            จุดเด่น 2
            <input value={posterCopy.badge2 || ''} onChange={(event) => onPosterCopyChange({ badge2: event.target.value })} />
          </label>
          <label>
            จุดเด่น 3
            <input value={posterCopy.badge3 || ''} onChange={(event) => onPosterCopyChange({ badge3: event.target.value })} />
          </label>
          <label>
            ข้อความความน่าเชื่อถือ
            <input value={posterCopy.trustLine || ''} onChange={(event) => onPosterCopyChange({ trustLine: event.target.value })} />
          </label>
          <label>
            พื้นที่ให้บริการ
            <input value={posterCopy.areaLine || ''} onChange={(event) => onPosterCopyChange({ areaLine: event.target.value })} />
          </label>
          <label>
            ข้อความชวนติดต่อ
            <input value={posterCopy.cta || ''} onChange={(event) => onPosterCopyChange({ cta: event.target.value })} />
          </label>
          <label className="wide">
            ช่องทางติดต่อ (ใส่เฉพาะข้อมูลจริงที่ต้องการใช้)
            <input value={posterCopy.contactLine || ''} onChange={(event) => onPosterCopyChange({ contactLine: event.target.value })} placeholder="เช่น โทร 092-xxx-xxxx / LINE: @assetx" />
          </label>
        </div>
      </article>
      </details>
      {mediaResult && (
        <article className="mx-media-result">
          <div>
            <div className="mx-kicker">ผลลัพธ์ล่าสุด · {displaySource(mediaResult.model)}</div>
            <h2>{mediaResult.title}</h2>
          </div>
          {mediaResult.type === 'prompt' ? (
            <>
              <div className="mx-quota-note">
                สร้างภาพอัตโนมัติไม่ได้ในตอนนี้ — ระบบเตรียมบรีฟรูปที่ครบกฎแบรนด์ไว้ให้แล้ว คัดลอกไปวางในเครื่องมือสร้างภาพที่ใช้อยู่ (เช่น Firefly) หรือกลับมาลองใหม่ภายหลังได้
              </div>
              <pre className="mx-fallback-prompt">{mediaResult.prompt}</pre>
              <button className="mx-primary media-download" onClick={() => onCopy(mediaResult.prompt)}>คัดลอกบรีฟรูป</button>
            </>
          ) : (
            <>
              {mediaResult.type === 'video'
                ? <video src={mediaResult.dataUrl} controls playsInline />
                : <ArtworkPreview src={mediaResult.dataUrl} alt={mediaResult.title} />}
              <a className="mx-primary media-download" href={mediaResult.dataUrl} download={`assetx-${mediaResult.type}-${mediaResult.id}.${mediaResult.type === 'video' ? 'mp4' : 'jpg'}`}>ดาวน์โหลด</a>
            </>
          )}
        </article>
      )}
      <details className="mx-gallery-advanced">
        <summary>ดูบรีฟทั้งหมดและสร้างภาพหรือวิดีโออัตโนมัติ</summary>
      <div className="mx-brief-grid">
        {briefs.map((brief) => (
          <article className={`mx-brief-card ${String(brief.id) === String(selectedBriefId) ? 'active' : ''}`} key={brief.id}>
            <div className="mx-preview-poster compact"><span>{selectedStyle.name}</span><strong>{brief.title}</strong><small>{brief.source}</small></div>
            <div>
              <strong>{brief.title}</strong>
              <p>{brief.imagePrompt}</p>
              <div className="mx-visual-note">
                <span>แนวภาพ</span>
                <p>{selectedStyle.scenes}</p>
              </div>
            </div>
            <div className="mx-card-actions">
              <button className="mx-ghost" onClick={() => onApplyPosterCopy(brief)}>
                ใช้บรีฟนี้เติมข้อความ
              </button>
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
      </details>
      {mediaAssets.length > 0 && (
        <div className="mx-artwork-grid">
          {mediaAssets.map((asset) => (
            <article className="mx-artwork-card" key={asset.id}>
              <ArtworkPreview src={asset.dataUrl} alt={asset.title} />
              <div>
                <strong>{asset.title}</strong>
                <span>{asset.width} x {asset.height}px · {new Date(asset.createdAt).toLocaleDateString('th-TH')}</span>
              </div>
              <div className="mx-card-actions">
                <a className="mx-mini-button" href={asset.dataUrl} download={`assetx-artwork-${asset.id}.jpg`}>ดาวน์โหลด</a>
                <button className="mx-mini-button danger" onClick={() => onDeleteMediaAsset(asset.id)}>ลบ</button>
              </div>
            </article>
          ))}
        </div>
      )}
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
          <div className="mx-kicker">กติกาแบรนด์</div>
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
  mediaAssets = [],
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
  onCopy,
  focusNo,
  previewId = null,
  loading = false,
}) {
  const filteredPosts = posts
    .filter((post) => libraryFilterMatches(post, filter))
    .sort((a, b) => {
      if (sort === 'oldest') return getPostTime(a) - getPostTime(b)
      if (sort === 'channel') return String(a.channel || '').localeCompare(String(b.channel || ''), 'th')
      if (sort === 'status') return String(a.status || '').localeCompare(String(b.status || ''), 'th')
      return getPostTime(b) - getPostTime(a)
    })
  // ตัวอย่างช่องทาง: ชิ้นที่เพิ่งค้นด้วยเลข (ถ้ายังอยู่ในตัวกรอง) ไม่งั้นชิ้นแรกของรายการ
  const previewPost = (previewId != null && filteredPosts.find((post) => post.id === previewId)) || filteredPosts[0] || posts[0]
  const previewText = buildChannelPreview(previewPost, previewChannel)
  const previewMedia = findMediaForPost(mediaAssets, previewPost)

  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">คลังผลงาน</div>
          <h1>รวมโพสต์ที่ร่างแล้วและไอเดียที่เก็บไว้</h1>
          <p>กรองตามสถานะ พักงาน ลบงาน และดูตัวอย่างการแสดงผลแต่ละช่องทาง</p>
        </div>
      </div>
      {loading && <p className="mx-warn">{LOADING_EDIT_NOTE}</p>}
      <div className="mx-filter-bar">
        <label>
          สถานะ
          <select value={filter} onChange={(event) => onFilterChange(event.target.value)}>
            <option value="active">งานที่ยังใช้ต่อ</option>
            <option value="all">ทั้งหมด</option>
            <option value="pending">รอตรวจ</option>
            <option value="needs_edit">ติดเกณฑ์</option>
            <option value="approved">อนุมัติแล้ว</option>
            <option value="scheduled">ตั้งเวลาแล้ว</option>
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
            {assetxChannels.map((channel) => <option key={channel.value} value={channel.value}>{channel.label}</option>)}
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
            <article className={`mx-row-card ${post.status === 'archived' ? 'muted' : ''} ${isFocused(post, focusNo) ? 'mx-focus' : ''}`} data-content-no={post.contentNo || undefined} key={post.id}>
              {findMediaForPost(mediaAssets, post) && <ArtworkPreview className="mx-row-thumb" src={findMediaForPost(mediaAssets, post).dataUrl} alt={post.title} />}
              <div>
                <strong><ContentNo post={post} onCopy={onCopy} />{post.title}</strong>
                <span>{channelLabel(post.channel)} · {statusLabels[post.status] || post.status} · {displaySource(post.source)}{post.ideaId ? ` · จากไอเดีย ${post.ideaId}` : ''}{isSamplePost(post) ? ' · ตัวอย่าง' : ''}</span>
              </div>
              <div className="mx-post-actions">
                <span className={post.reviewStatus === 'passed' ? 'mx-pass' : 'mx-warn'}>{reviewLabel(post)}</span>
                {post.status === 'archived'
                  ? <button className="mx-mini-button" onClick={() => onRestore(post.id)}>กู้คืน</button>
                  : <button className="mx-mini-button" onClick={() => onArchive(post.id)}>พักไว้</button>}
                <button className="mx-mini-button danger" onClick={() => onDelete(post.id)}>ลบ</button>
              </div>
            </article>
          ))}
          {mediaAssets.length > 0 && (
            <>
              <div className="mx-library-head">
                <h2 className="mx-section-title">รูปที่สร้างแล้ว</h2>
                <span>{mediaAssets.length} รูป</span>
              </div>
              <div className="mx-mini-artwork-grid">
                {mediaAssets.map((asset) => (
                  <div className="mx-mini-artwork" key={asset.id}>
                    <ArtworkPreview src={asset.dataUrl} alt={asset.title} />
                    <span>{asset.title}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="mx-list">
          <article className="mx-channel-preview">
            <div className="mx-library-head">
              <h2 className="mx-section-title">ตัวอย่างช่องทาง</h2>
              <span>{assetxChannels.find((channel) => channel.value === previewChannel)?.label || previewChannel}</span>
            </div>
            <div className={`mx-preview-box ${previewChannel}`}>
              {previewMedia && <ArtworkPreview className="mx-channel-image" src={previewMedia.dataUrl} alt={previewPost.title} />}
              <strong>{previewPost?.title || 'ยังไม่มีโพสต์'}</strong>
              <pre>{previewText}</pre>
            </div>
          </article>
          <h2 className="mx-section-title">ไอเดียที่เก็บไว้</h2>
          {savedIdeas.length === 0 && <div className="mx-empty">ยังไม่มีไอเดียที่เก็บไว้ กด “เก็บไว้ก่อน” จากแท็บ ไอเดีย เพื่อสะสมหัวข้อ</div>}
          {savedIdeas.map((idea) => (
            <article className="mx-row-card" key={idea.id}>
              <div><strong>{idea.title}</strong><span>{idea.dbId ? `ไอเดีย ${idea.dbId} · ` : ''}{displaySource(idea.source)}{idea.savedAt ? ` · เก็บเมื่อ ${thaiDate(idea.savedAt)}` : ''}</span></div>
              <div className="mx-post-actions">
                <button className="mx-primary" onClick={() => onCreate(idea.title, idea)}>ร่างโพสต์</button>
                <button className="mx-mini-button danger" onClick={() => onDeleteSavedIdea(idea.id)}>ลบ</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function CalendarView({ posts = [], onQueue }) {
  const [monthOffset, setMonthOffset] = useState(0)
  const today = new Date()
  const month = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const days = Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, index) => index + 1)
  const unscheduled = posts.filter((post) => post.status === 'approved' && !post.scheduledAt).length
  const postsByDay = posts.reduce((acc, post) => {
    const rawDate = post.status === 'posted' ? (post.postedAt || post.scheduledAt || '') : (post.scheduledAt || '')
    const date = rawDate ? new Date(rawDate) : null
    if (!date || Number.isNaN(date.getTime()) || date.getFullYear() !== month.getFullYear() || date.getMonth() !== month.getMonth()) return acc
    const day = date.getDate()
    acc[day] = [...(acc[day] || []), post]
    return acc
  }, {})
  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div><div className="mx-kicker">โพสต์ · ปฏิทิน</div><h1>{new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(month)}</h1></div>
        <div className="mx-row-actions"><button className="mx-secondary" onClick={() => setMonthOffset(monthOffset - 1)}>เดือนก่อน</button><button className="mx-secondary" onClick={() => setMonthOffset(0)}>เดือนนี้</button><button className="mx-secondary" onClick={() => setMonthOffset(monthOffset + 1)}>เดือนถัดไป</button></div>
      </div>
      {unscheduled > 0 && <div className="mx-calendar-unscheduled">อนุมัติแล้วแต่ยังไม่ตั้งเวลา {unscheduled} โพสต์ <button className="mx-secondary" onClick={onQueue}>ไปตั้งเวลาในรายการ</button></div>}
      {Object.keys(postsByDay).length === 0 && <div className="mx-calendar-unscheduled">ไม่มีโพสต์ที่ตั้งเวลาหรือโพสต์แล้วในเดือนนี้</div>}
      <div className="mx-calendar">
        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((day) => <div className="mx-weekday" key={day}>{day}</div>)}
        {Array.from({ length: month.getDay() }, (_, index) => <div className="mx-day-empty" key={`blank-${index}`} />)}
        {days.map((day) => (
          <div className={`mx-day ${postsByDay[day]?.length ? 'has' : ''} ${monthOffset === 0 && day === today.getDate() ? 'today' : ''}`} key={day} aria-current={monthOffset === 0 && day === today.getDate() ? 'date' : undefined}>
            <strong>{day}{monthOffset === 0 && day === today.getDate() ? ' · วันนี้' : ''}</strong>
            {postsByDay[day]?.map((post) => (
              <div className="mx-calendar-item" key={post.id}><strong>{titleWithNo(post)}</strong><span>{channelLabel(post.channel)} · {post.status === 'posted' ? statusLabels.posted : post.facebookPostId ? queueStateLabels.platformScheduled : queueStateLabels.upcoming}</span></div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

function MetricsView({ metrics: allMetrics, form, onFormChange, onAdd, onDelete }) {
  // ช่วงเวลา: null = ทั้งหมด · ตัวเลข = วันย้อนหลัง (กรองจาก createdAt ของแต่ละรายการ)
  const [rangeDays, setRangeDays] = useState(null)
  const metrics = rangeDays
    ? allMetrics.filter((item) => item.createdAt && Date.now() - new Date(item.createdAt).getTime() <= rangeDays * 86400000)
    : allMetrics
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
        <div><div className="mx-kicker">ตัวเลข</div><h1>วัดผลการตลาดจากลีดและเคสประเมิน</h1><p>บันทึกผลโพสต์ด้วยตนเองเพื่อดูแนวโน้มลีด{rangeDays ? ` · แสดง ${rangeDays} วันล่าสุด` : ' · แสดงทั้งหมด'}</p></div>
        <div className="mx-range" role="group" aria-label="ช่วงเวลา">
          {[[null, 'ทั้งหมด'], [7, '7 วัน'], [14, '14 วัน'], [30, '30 วัน']].map(([days, label]) => (
            <button key={label} type="button" className={rangeDays === days ? 'active' : ''} aria-pressed={rangeDays === days} onClick={() => setRangeDays(days)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="mx-metric-grid">
        <MetricCard label="ลีดใหม่" value={totals.leads} delta={`จาก ${metrics.length} โพสต์`} />
        <MetricCard label="ลีดคุณภาพ" value={totals.qualified} delta="กรอกเอง" />
        <MetricCard label="นัดหมาย" value={totals.appointments} delta={`${leadToAppointment}% ของลีด`} />
        <MetricCard label="โพสต์ที่บันทึกผล" value={metrics.length} delta="กรอกเอง" />
      </div>
      <div className="mx-metrics-layout">
        <article className="mx-metric-form">
          <h2 className="mx-section-title">บันทึกผลโพสต์</h2>
          <label>ชื่อโพสต์ / แคมเปญ<input value={form.title} onChange={(event) => onFormChange({ ...form, title: event.target.value })} placeholder="เช่น ขายฝากกับจำนองต่างกันอย่างไร" /></label>
          <label>ช่องทาง<select value={form.channel} onChange={(event) => onFormChange({ ...form, channel: event.target.value })}>{assetxChannels.map((channel) => <option key={channel.value} value={channel.label}>{channel.label}</option>)}<option>Website</option></select></label>
          <div className="mx-metric-inputs">
            <label>ลีด<input type="number" min="0" value={form.leads} onChange={(event) => onFormChange({ ...form, leads: event.target.value })} /></label>
            <label>คุณภาพ<input type="number" min="0" value={form.qualified} onChange={(event) => onFormChange({ ...form, qualified: event.target.value })} /></label>
            <label>นัดหมาย<input type="number" min="0" value={form.appointments} onChange={(event) => onFormChange({ ...form, appointments: event.target.value })} /></label>
          </div>
          <label>หมายเหตุ<textarea value={form.notes} onChange={(event) => onFormChange({ ...form, notes: event.target.value })} placeholder="เช่น ได้ลีดจากเจ้าของที่ดิน 2 ราย / คำถามเรื่องขายฝากเยอะ" /></label>
          <button className="mx-primary" onClick={onAdd}>บันทึกผล</button>
        </article>
        <div className="mx-list">
          <h2 className="mx-section-title">ผลลัพธ์ล่าสุด</h2>
          {metrics.length === 0 && <div className="mx-empty">{rangeDays ? `ไม่มีผลโพสต์ที่บันทึกในช่วง ${rangeDays} วันล่าสุด` : 'ยังไม่มีข้อมูลผลโพสต์ ลองบันทึกจากโพสต์ที่ลงจริงแล้วเพื่อดูแนวโน้มลีด'}</div>}
          {metrics.map((item) => (
            <article className="mx-row-card" key={item.id}>
              <div><strong>{item.title}</strong><span>{item.channel} · ลีด {item.leads} · คุณภาพ {item.qualified} · นัด {item.appointments}{item.createdAt ? ` · ${thaiDate(item.createdAt)}` : ''}</span></div>
              <button className="mx-mini-button danger" onClick={() => onDelete(item.id)}>ลบ</button>
            </article>
          ))}
        </div>
      </div>
      <div className="mx-chart-card">
        <div className="mx-bars">{(barData.length ? barData : [{ leads: 1 }]).map((item, index) => <span title={item.title || 'ยังไม่มีข้อมูล'} style={{ height: `${Math.max(8, ((Number(item.leads) || 0) / maxLeads) * 100)}%` }} key={item.id || index} />)}</div>
        <p>แท่งละหนึ่งโพสต์ที่บันทึกผล (ล่าสุด 12 รายการ) ความสูงตามจำนวนลีด</p>
      </div>
    </section>
  )
}

// สถานะระบบ — อ่านจากข้อมูลจริงเท่านั้น: คิวไอเดียจาก API (meta) · การบันทึกเวิร์กสเปซ · Facebook · จำนวนร่าง/คิวในหน้านี้
function PipelineView({ feed, syncState, facebookConnection, counts, onReload }) {
  const research = describeResearchFeed(feed)
  const sync = describeSyncState(syncState)
  const facebook = describeFacebook(facebookConnection) || { tone: 'error', text: SESSION_EXPIRED_MESSAGE }
  const meta = feed.meta
  const bySource = Object.entries(meta?.by_source || {}).sort((a, b) => b[1] - a[1])
  const freshness = (() => {
    if (!meta?.latest_created_at) return null
    const hours = (Date.now() - new Date(meta.latest_created_at).getTime()) / 3600000
    if (!Number.isFinite(hours)) return null
    if (hours < 36) return { tone: 'ok', text: 'มีของใหม่ภายใน 36 ชม.' }
    if (hours < 24 * 4) return { tone: 'warn', text: `ไม่มีไอเดียใหม่มา ${Math.round(hours / 24)} วัน` }
    return { tone: 'error', text: `ไม่มีไอเดียใหม่มา ${Math.round(hours / 24)} วัน — ตรวจตารางเวลาบนเครื่องที่รันตัวเก็บ` }
  })()
  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">สถานะระบบ</div>
          <h1>ระบบที่หน้านี้ใช้อยู่ ทำงานถึงไหน</h1>
          <p>ตัวเก็บไอเดียรันบนเครื่องของเจ้าของตามตารางเวลา หน้านี้เห็นเฉพาะผลที่เข้าตารางคิวแล้ว</p>
        </div>
        <div className="mx-page-actions"><button className="mx-secondary" type="button" onClick={onReload}>โหลดสถานะใหม่</button></div>
      </div>
      <div className="mx-pipeline">
        <article className="mx-pipe-card">
          <div>
            <strong>คิวไอเดียจากรีเสิร์ช</strong>
            <span>{research.text}{research.extra ? ` · ${research.extra}` : ''}</span>
            {meta && (
              <span>
                รอเลือก {meta.total ?? feed.ideas.length} หัวข้อ · มีมุมเล่าจาก AI แล้ว {meta.with_angles ?? 0} หัวข้อ
                {bySource.length ? ` · ตามแหล่ง: ${bySource.map(([source, count]) => `${researchSourceLabels[source] || 'อื่น ๆ'} ${count}`).join(' · ')}` : ''}
                {feed.state !== 'ok' && feed.fetchedAt ? ` (ข้อมูลเมื่อ ${thaiTime(feed.fetchedAt)})` : ''}
              </span>
            )}
            {freshness && feed.state === 'ok' && <span className={`mx-pipe-note ${freshness.tone}`}>{freshness.text}</span>}
          </div>
          <em className={research.tone}>{research.tone === 'ok' ? 'ปกติ' : research.tone === 'muted' ? 'กำลังโหลด' : 'ติดปัญหา'}</em>
        </article>
        <article className="mx-pipe-card">
          <div><strong>เวิร์กสเปซของหน้านี้ (ร่าง รูป ตัวเลข)</strong><span>{sync.text}</span></div>
          <em className={sync.tone}>{sync.tone === 'ok' ? 'ปกติ' : sync.tone === 'muted' ? 'กำลังทำ' : 'ติดปัญหา'}</em>
        </article>
        <article className="mx-pipe-card">
          <div><strong>Facebook Page</strong><span>{facebook.text}</span></div>
          <em className={facebook.tone}>{facebook.tone === 'ok' ? 'เชื่อมแล้ว' : facebook.tone === 'muted' ? 'กำลังตรวจ' : facebook.tone === 'error' ? 'ตรวจไม่ได้' : 'ยังไม่เชื่อม'}</em>
        </article>
        <article className="mx-pipe-card">
          <div><strong>งานในมือ</strong><span>ร่างรอตรวจ {counts.approvals} · รอโพสต์ {counts.ready} · ไอเดียที่เก็บไว้ {counts.saved}</span></div>
          <em className={counts.approvals + counts.ready > 0 ? 'warn' : 'ok'}>{counts.approvals + counts.ready > 0 ? 'มีงานค้าง' : 'ไม่มีงานค้าง'}</em>
        </article>
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
          <div className="mx-kicker">ตอบคอมเมนต์ · ตัวอย่าง</div>
          <h1>ตัวอย่างการคัดกรองข้อความก่อนตอบ</h1>
          <p>ข้อความ 3 รายการนี้เขียนไว้เป็นตัวอย่าง ยังไม่ได้เชื่อมกับคอมเมนต์จริง — ใช้ดูวิธีแยกความเสี่ยง ร่างคำตอบ และส่งหัวข้อไปร่างโพสต์</p>
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
            })}>ร่างโพสต์</button>
          </div>
        </article>
      </div>
    </section>
  )
}

// เลขคอนเทนต์บนการ์ด — กดแล้วคัดลอก "คอนเทนต์ #12 · หัวข้อ" ไปวางในแชตตอนสั่งแก้ · ร่างตัวอย่างไม่มีเลข
function ContentNo({ post, onCopy }) {
  const label = formatContentNo(post?.contentNo)
  if (!label) return null
  return (
    <button
      type="button"
      className="mx-no"
      title={`เลขคอนเทนต์ ${label} · กดเพื่อคัดลอกไว้อ้างถึงตอนสั่งแก้`}
      onClick={(event) => {
        event.stopPropagation()
        onCopy?.(contentReference(post), `คัดลอก ${label} แล้ว · วางในแชตเพื่ออ้างถึงคอนเทนต์นี้`)
      }}
    >
      {label}
    </button>
  )
}

function TabButton({ id, label, count, active, onClick }) {
  return (
    <button type="button" className={`mx-tab ${active ? 'active' : ''}`} data-view={id} aria-current={active ? 'page' : undefined} onClick={onClick}>
      <span>{label}</span>{typeof count === 'number' && count > 0 && <strong>{count > 99 ? '99+' : count}</strong>}
    </button>
  )
}

// แถบสถานะจริงบนหัวหน้า: คิวไอเดีย (จาก API meta) · การบันทึกเวิร์กสเปซ · Facebook — ไม่มีป้ายตายตัว
function describeResearchFeed(feed) {
  if (feed.state === 'loading') return { tone: 'muted', text: 'กำลังโหลดคิวไอเดีย…' }
  if (feed.state === 'unauthorized') return { tone: 'error', text: 'เซสชันหมดอายุ', action: 'login' }
  if (feed.state === 'unavailable') return { tone: 'warn', text: 'ระบบคิวไอเดียยังไม่พร้อม (ฝั่งเซิร์ฟเวอร์)' }
  if (feed.state === 'error') return { tone: 'error', text: 'โหลดไอเดียไม่ได้', action: 'retry' }
  const latest = feed.meta?.latest_created_at
  if (!latest && !feed.ideas.length) return { tone: 'ok', text: 'ยังไม่มีไอเดียในคิว' }
  const recent = Number(feed.meta?.arrived_last_24h)
  return {
    tone: 'ok',
    text: latest ? `ไอเดียล่าสุดเข้าคิว ${thaiDateTime(latest)}` : `ไอเดียรอเลือก ${feed.ideas.length} หัวข้อ`,
    extra: Number.isFinite(recent) ? `ใน 24 ชม. +${recent}` : '',
  }
}

// โหลดหน้าใหม่เพื่อเข้าสู่ระบบ — ถ้าการแก้ไขล่าสุดยังไม่ได้ขึ้นระบบ (บันทึกไม่สำเร็จ/โหลดจากระบบไม่ได้) บอกก่อน เพราะตอนโหลดใหม่ข้อมูลจากระบบจะชนะข้อมูลในเครื่อง
function reloadForLogin(syncState) {
  const unsaved = syncState?.state === 'failed' || syncState?.state === 'local' || syncState?.state === 'saving'
  if (unsaved && !window.confirm('การแก้ไขล่าสุดยังไม่ได้บันทึกขึ้นระบบ ถ้าโหลดหน้าใหม่ตอนนี้ข้อมูลส่วนนั้นอาจหาย — โหลดใหม่เลยไหม?')) return
  window.location.reload()
}

function describeSyncState(syncState) {
  if (syncState.state === 'loading') return { tone: 'muted', text: 'กำลังโหลดข้อมูล…' }
  if (syncState.state === 'saving') return { tone: 'muted', text: 'กำลังบันทึก…' }
  if (syncState.state === 'local') return { tone: 'warn', text: 'โหลดจากระบบไม่ได้ · การแก้ไขตอนนี้ยังไม่ขึ้นระบบ' }
  if (syncState.state === 'failed') return { tone: 'error', text: 'บันทึกขึ้นระบบไม่สำเร็จ · อย่าเพิ่งรีเฟรชหน้า', action: 'retry-save' }
  return { tone: 'ok', text: syncState.at ? `บันทึกแล้ว ${thaiTime(syncState.at)}` : 'บันทึกแล้ว' }
}

function describeFacebook(connection) {
  if (connection?.unauthorized) return null
  if (connection?.loading) return { tone: 'muted', text: 'กำลังตรวจ Facebook' }
  if (connection?.connected) return { tone: 'ok', text: `Facebook · ${connection.pageName || 'เชื่อมแล้ว'}` }
  if (connection?.error) return { tone: 'error', text: 'ตรวจ Facebook ไม่ได้' }
  return { tone: 'warn', text: 'ยังไม่เชื่อม Facebook' }
}

function StatusStrip({ feed, syncState, facebookConnection, onReload, onRetrySave }) {
  const research = describeResearchFeed(feed)
  const sync = describeSyncState(syncState)
  const facebook = describeFacebook(facebookConnection)
  return (
    <div className="mx-strip" role="status" aria-live="polite">
      <span className={`mx-chip ${research.tone}`}>
        <span className="mx-chip-dot" aria-hidden="true" />
        {research.text}{research.extra ? <em>{research.extra}</em> : null}
        {research.action === 'login' && <button type="button" onClick={() => reloadForLogin(syncState)}>เข้าสู่ระบบใหม่</button>}
        {research.action === 'retry' && <button type="button" onClick={onReload}>ลองใหม่</button>}
      </span>
      <span className={`mx-chip ${sync.tone}`}>
        <span className="mx-chip-dot" aria-hidden="true" />{sync.text}
        {sync.action === 'retry-save' && onRetrySave && <button type="button" onClick={onRetrySave}>บันทึกอีกครั้ง</button>}
      </span>
      {facebook && <span className={`mx-chip ${facebook.tone}`}><span className="mx-chip-dot" aria-hidden="true" />{facebook.text}</span>}
      <button type="button" className="mx-strip-refresh" onClick={onReload} title="โหลดสถานะคิวไอเดียใหม่">รีเฟรช</button>
    </div>
  )
}

function MetricCard({ label, value, delta }) {
  return <div className="mx-metric-card"><span>{label}</span><strong>{value}</strong><em>{delta}</em></div>
}

// ประโยคเปิดทางเลือก (hook) ของร่าง AI — รอบรีเสิร์ชเขียนไว้ 2–4 แบบต่างสูตรพร้อมคะแนน (server/research/hooks.js)
// กด "ใช้ประโยคนี้" = แทนบรรทัดแรกของแคปชั่น + พาดหัวคู่ (พาดหัวไปถึงโปสเตอร์ด้วย) · ไม่มีอย่างน้อย 2 แบบ = ไม่โชว์
function HookPicker({ hooks, caption, onPick, disabled = false }) {
  const options = hookOptionsFor(hooks)
  if (!options.length || !onPick) return null
  return (
    <details className="mx-hook-picker" onClick={(event) => event.stopPropagation()}>
      <summary><span>ประโยคเปิดทางเลือก ({options.length} แบบ)</span><small>บรรทัดแรกคือสิ่งที่ทำให้คนหยุดอ่าน · เลือกแบบที่ชอบได้</small></summary>
      <div className="mx-hook-list">
        {options.map((hook, index) => {
          const current = isCurrentHook(hook, caption)
          return (
            <div key={`${hook.pattern}-${index}`} className={`mx-hook-option${current ? ' current' : ''}`}>
              <div className="mx-hook-meta">
                <span className="mx-hook-name">{hook.name || hook.pattern}</span>
                {hook.score !== null && <span className={`mx-hook-score${hook.score >= 70 ? ' high' : hook.score < 45 ? ' low' : ''}`}>{hook.score}/100</span>}
              </div>
              <p>{hook.line}</p>
              {hook.headline && <small>พาดหัว: {hook.headline}</small>}
              {(hook.bad || []).length > 0 && <small className="mx-hook-why">ควรปรับ: {hook.bad.join(' · ')}</small>}
              {current
                ? <em className="mx-hook-current">ใช้อยู่</em>
                : <button type="button" className="mx-mini-button" disabled={disabled} onClick={() => onPick(hook)}>ใช้ประโยคนี้</button>}
            </div>
          )
        })}
      </div>
    </details>
  )
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
  /* ── โทเค็น: ธีม "ศูนย์บัญชาการ" โทนเข้มของแบรนด์ (น้ำเงินกลางคืน · ฟ้าไซยาน · ม่วงลึก) ทุกคู่สีตัวอักษรผ่าน 4.5:1 ── */
  .mx-page {
    --mx-bg: #050b18; --mx-bg-2: #0a1630;
    --mx-panel: rgba(14, 30, 58, .78); --mx-panel-2: rgba(19, 38, 72, .74); --mx-panel-solid: #10203f; --mx-field: rgba(5, 11, 24, .55);
    --mx-line: rgba(112, 215, 232, .16); --mx-line-2: rgba(112, 215, 232, .36);
    --mx-ink: #eef4ff; --mx-ink-2: #c9d7ee; --mx-muted: #9db1d2;
    --mx-cyan: #42c7d8; --mx-sky: #7fe1f0; --mx-blue: #2f9fe6; --mx-violet: #7c5cff; --mx-coral: #ff8e73;
    --mx-ok: #4ade80; --mx-warn: #fbbf24; --mx-err: #fb7185; --mx-err-soft: #ffd1d6;
    --mx-glow: 0 0 0 1px rgba(66,199,216,.35), 0 0 24px rgba(66,199,216,.22);
    --mx-shadow: 0 18px 44px rgba(2, 8, 24, .45);
    --mx-radius: 16px;
    position: relative; isolation: isolate; min-height: 100vh; display: block;
    background: var(--mx-bg); color: var(--mx-ink);
    font-family: "Noto Sans Thai", "Segoe UI", sans-serif; font-size: 15px; line-height: 1.55; font-weight: 400;
  }
  .mx-page * { box-sizing: border-box; }
  .mx-page button, .mx-page input, .mx-page select, .mx-page textarea { font: inherit; color: inherit; }
  .mx-page :focus-visible:not(.ax-artwork *) { outline: 2px solid var(--mx-sky); outline-offset: 2px; }
  .mx-page ::selection { background: rgba(66,199,216,.35); }
  .mx-page ::-webkit-scrollbar { width: 8px; height: 6px; }
  .mx-page ::-webkit-scrollbar-thumb { background: rgba(112,215,232,.28); border-radius: 999px; }
  .mx-page a:not(.ax-artwork a) { color: var(--mx-sky); }
  .mx-angle-pick label:has(input:focus-visible), .mx-upload-button:has(input:focus-visible) { outline: 2px solid var(--mx-sky); outline-offset: 2px; }
  .mx-approval-card:has(.mx-more[open]) { z-index: 5; }
  .mx-approval-card { position: relative; }

  /* ── แสงออโรราเคลื่อนช้า ๆ ด้านหลัง (ปิดเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว) ── */
  .mx-page::before, .mx-page::after { content: ''; position: fixed; z-index: -1; pointer-events: none; border-radius: 50%; filter: blur(70px); opacity: .55; }
  .mx-page::before { width: 60vw; height: 60vw; top: -25vw; right: -15vw; background: radial-gradient(circle at 40% 40%, rgba(66,199,216,.55), rgba(47,159,230,.25) 45%, transparent 70%); animation: mx-drift-a 26s ease-in-out infinite alternate; }
  .mx-page::after { width: 55vw; height: 55vw; bottom: -30vw; left: -20vw; background: radial-gradient(circle at 60% 60%, rgba(124,92,255,.5), rgba(75,42,130,.3) 45%, transparent 70%); animation: mx-drift-b 32s ease-in-out infinite alternate; }
  @keyframes mx-drift-a { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(-8vw, 10vh, 0) scale(1.15); } }
  @keyframes mx-drift-b { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(10vw, -8vh, 0) scale(1.1); } }
  @keyframes mx-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes mx-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(66,199,216,.6); } 70% { box-shadow: 0 0 0 7px rgba(66,199,216,0); } }
  @keyframes mx-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  @keyframes mx-scan { from { transform: translateX(-100%); } to { transform: translateX(100%); } }

  /* ── หัวหน้า: กระจกเบลอ + ตารางจาง + แถบสถานะจริง + แท็บ ── */
  .mx-head { position: sticky; top: 0; z-index: 40; background: rgba(6, 14, 32, .72); backdrop-filter: blur(18px) saturate(140%); -webkit-backdrop-filter: blur(18px) saturate(140%); border-bottom: 1px solid var(--mx-line); overflow: visible; }
  .mx-head::before { content: ''; position: absolute; inset: 0; pointer-events: none; background-image: linear-gradient(rgba(112,215,232,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(112,215,232,.05) 1px, transparent 1px); background-size: 32px 32px; mask-image: linear-gradient(180deg, rgba(0,0,0,.9), transparent); -webkit-mask-image: linear-gradient(180deg, rgba(0,0,0,.9), transparent); }
  .mx-head::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: linear-gradient(90deg, transparent, rgba(66,199,216,.9), rgba(124,92,255,.8), transparent); opacity: .8; }
  .mx-topbar { position: relative; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 18px; min-height: 60px; height: auto; padding: 10px 24px; }
  .mx-topbar-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
  .mx-back { border: 1px solid var(--mx-line); background: rgba(255,255,255,.03); color: var(--mx-ink-2); border-radius: 10px; padding: 8px 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .mx-back:hover { border-color: var(--mx-line-2); color: #fff; }
  .mx-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .mx-brand-logo { width: 34px; height: 34px; border-radius: 10px; object-fit: cover; object-position: 50% 30%; background: #fff; border: 1px solid var(--mx-line-2); box-shadow: 0 0 18px rgba(66,199,216,.25); }
  .mx-brand-name { font-size: 15px; font-weight: 700; color: #fff; letter-spacing: .01em; white-space: nowrap; }

  .mx-strip { position: relative; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0; }
  .mx-chip { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--mx-line); background: rgba(255,255,255,.03); color: var(--mx-ink-2); border-radius: 999px; padding: 6px 12px 6px 10px; font-size: 13px; font-weight: 500; white-space: nowrap; max-width: 100%; }
  .mx-chip em { font-style: normal; color: var(--mx-sky); font-weight: 700; }
  .mx-chip button { border: 1px solid var(--mx-line-2); background: rgba(66,199,216,.12); color: #fff; border-radius: 999px; padding: 2px 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .mx-chip button:hover { background: rgba(66,199,216,.24); }
  .mx-strip-refresh { border: 1px solid var(--mx-line); background: transparent; color: var(--mx-ink-2); border-radius: 999px; padding: 5px 12px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .mx-strip-refresh:hover { border-color: var(--mx-line-2); color: #fff; }
  .mx-page .ax-artwork input::placeholder, .mx-page .ax-artwork textarea::placeholder { color: #6b7c86; }
  .mx-chip-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--mx-cyan); flex: 0 0 auto; }
  .mx-chip.ok .mx-chip-dot { background: var(--mx-ok); box-shadow: 0 0 10px rgba(74,222,128,.8); }
  .mx-chip.muted .mx-chip-dot { background: var(--mx-cyan); animation: mx-pulse 1.6s ease-out infinite; }
  .mx-chip.warn { border-color: rgba(251,191,36,.45); color: #fde68a; }
  .mx-chip.warn .mx-chip-dot { background: var(--mx-warn); box-shadow: 0 0 10px rgba(251,191,36,.7); }
  .mx-chip.error { border-color: rgba(251,113,133,.5); color: var(--mx-err-soft); }
  .mx-chip.error .mx-chip-dot { background: var(--mx-err); box-shadow: 0 0 10px rgba(251,113,133,.8); animation: mx-pulse 1.2s ease-out infinite; }

  .mx-tabs { position: relative; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 0 24px 10px; overflow: visible; }
  .mx-tab, .mx-tools > summary { display: inline-flex; align-items: center; gap: 8px; border: 1px solid transparent; background: transparent; color: var(--mx-ink-2); border-radius: 12px; padding: 10px 16px; font-size: 15px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease; }
  .mx-tab:hover, .mx-tools > summary:hover { background: rgba(255,255,255,.04); color: #fff; }
  .mx-tab.active, .mx-tools.active > summary { background: rgba(66,199,216,.12); border-color: var(--mx-line-2); color: #fff; box-shadow: var(--mx-glow); }
  .mx-tab strong { font-size: 13px; font-weight: 700; color: #06203c; background: var(--mx-cyan); border-radius: 999px; padding: 1px 8px; line-height: 1.5; box-shadow: 0 0 12px rgba(66,199,216,.45); }
  .mx-tools { position: relative; margin-left: auto; }
  .mx-tools > summary { list-style: none; }
  .mx-tools > summary::-webkit-details-marker { display: none; }
  .mx-tools-menu { position: absolute; top: calc(100% + 8px); right: 0; z-index: 50; min-width: 260px; display: grid; gap: 2px; padding: 8px; border: 1px solid var(--mx-line-2); border-radius: 14px; background: #0d1a33; box-shadow: var(--mx-shadow), var(--mx-glow); animation: mx-rise .18s ease both; }
  .mx-tools-menu button { display: flex; justify-content: space-between; align-items: center; gap: 12px; width: 100%; border: 0; background: transparent; color: var(--mx-ink-2); border-radius: 10px; padding: 10px 12px; text-align: left; cursor: pointer; font-size: 15px; font-weight: 500; }
  .mx-tools-menu button:hover, .mx-tools-menu button.active { background: rgba(66,199,216,.12); color: #fff; }
  .mx-tools-menu button strong { font-size: 13px; color: var(--mx-sky); }

  /* ── โครงเนื้อหา ── */
  .mx-main { min-width: 0; }
  .mx-content { max-width: 1180px; margin: 26px auto 80px; padding: 0 24px; }
  .mx-subtabs-wrap { margin: 22px auto 0; }
  .mx-subtabs, .mx-segment { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--mx-line); border-radius: 12px; background: rgba(255,255,255,.03); }
  .mx-subtabs button, .mx-segment button { border: 0; background: transparent; color: var(--mx-ink-2); border-radius: 9px; padding: 7px 14px; font-size: 14px; font-weight: 600; cursor: pointer; }
  .mx-subtabs button.active, .mx-segment button.active { background: rgba(66,199,216,.16); color: #fff; box-shadow: inset 0 0 0 1px rgba(112,215,232,.4); }
  .mx-page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 18px; }
  .mx-page-head.compact { margin-bottom: 14px; }
  .mx-page-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; align-items: center; }
  .mx-kicker { color: var(--mx-sky); font-size: 13px; font-weight: 700; letter-spacing: .04em; text-transform: none; }
  .mx-page-head h1, .mx-review-head h2 { margin: 4px 0 0; font-size: 24px; line-height: 1.3; letter-spacing: 0; color: #fff; font-weight: 700; }
  @supports ((-webkit-background-clip: text) or (background-clip: text)) {
    .mx-page-head h1 { background: linear-gradient(90deg, #ffffff, var(--mx-sky) 70%, #c4b5fd); -webkit-background-clip: text; background-clip: text; color: transparent; }
  }
  .mx-page-head p { margin: 6px 0 0; color: var(--mx-muted); font-size: 15px; }

  /* ── ปุ่ม ── */
  .mx-primary, .mx-secondary, .mx-ghost { border-radius: 11px; padding: 10px 15px; font-weight: 700; font-size: 15px; cursor: pointer; border: 1px solid transparent; transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease; }
  .mx-primary { background: linear-gradient(135deg, var(--mx-cyan), var(--mx-blue)); color: #06203c; box-shadow: 0 8px 22px rgba(47,159,230,.28); }
  .mx-primary:hover { box-shadow: 0 10px 28px rgba(66,199,216,.45), 0 0 0 1px rgba(127,225,240,.6); transform: translateY(-1px); }
  .mx-secondary { background: rgba(66,199,216,.08); color: #bfeef5; border-color: rgba(112,215,232,.4); }
  .mx-secondary:hover { background: rgba(66,199,216,.16); border-color: var(--mx-sky); color: #fff; transform: translateY(-1px); }
  .mx-ghost { background: transparent; color: var(--mx-ink-2); border-color: var(--mx-line); }
  .mx-ghost:hover { border-color: var(--mx-line-2); color: #fff; }
  .mx-primary:disabled, .mx-secondary:disabled, .mx-ghost:disabled, .mx-primary:disabled:hover, .mx-secondary:disabled:hover, .mx-ghost:disabled:hover { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }
  .mx-secondary.as-link { text-decoration: none; display: inline-flex; align-items: center; }
  .mx-mini-button { border: 1px solid var(--mx-line); background: rgba(255,255,255,.03); color: #bfeef5; border-radius: 999px; padding: 7px 12px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
  .mx-mini-button:hover { border-color: var(--mx-line-2); background: rgba(66,199,216,.1); color: #fff; }
  .mx-mini-button.danger { border-color: rgba(251,113,133,.45); color: var(--mx-err-soft); background: rgba(251,113,133,.08); }
  .mx-caption-tools { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0 2px; }
  .mx-more { position: relative; }
  .mx-more > summary { list-style: none; cursor: pointer; border: 1px solid var(--mx-line); background: rgba(255,255,255,.03); color: var(--mx-ink-2); border-radius: 11px; padding: 10px 15px; font-weight: 600; font-size: 15px; }
  .mx-more > summary::-webkit-details-marker { display: none; }
  .mx-more[open] > summary { border-color: var(--mx-line-2); color: #fff; }
  .mx-more-menu { position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; min-width: 220px; display: grid; gap: 2px; padding: 6px; border: 1px solid var(--mx-line-2); border-radius: 12px; background: rgba(12, 24, 48, .97); box-shadow: var(--mx-shadow); animation: mx-rise .16s ease both; }
  .mx-more-menu button, .mx-more-menu a { display: block; width: 100%; border: 0; background: transparent; color: var(--mx-ink-2); border-radius: 8px; padding: 9px 12px; text-align: left; font-size: 15px; cursor: pointer; text-decoration: none; }
  .mx-more-menu button:hover, .mx-more-menu a:hover { background: rgba(66,199,216,.12); color: #fff; }
  .mx-more-menu .danger { color: var(--mx-err-soft); }
  .mx-more-row { display: flex; justify-content: center; margin-top: 16px; }

  /* ── การ์ดและพื้นผิว ── */
  .mx-idea-card, .mx-review-card, .mx-preview, .mx-empty, .mx-chart-card, .mx-pipe-card, .mx-row-card, .mx-metric-card { border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: var(--mx-radius); box-shadow: var(--mx-shadow); }
  .mx-idea-card, .mx-row-card, .mx-approval-card, .mx-pipe-card, .mx-metric-card, .mx-source-card, .mx-brand-rule, .mx-reference-item { animation: mx-rise .45s cubic-bezier(.2,.7,.2,1) both; }
  .mx-idea-grid > :nth-child(2), .mx-list > :nth-child(2), .mx-pipeline > :nth-child(2), .mx-metric-grid > :nth-child(2) { animation-delay: 60ms; }
  .mx-idea-grid > :nth-child(3), .mx-list > :nth-child(3), .mx-pipeline > :nth-child(3), .mx-metric-grid > :nth-child(3) { animation-delay: 120ms; }
  .mx-idea-grid > :nth-child(4), .mx-list > :nth-child(4), .mx-pipeline > :nth-child(4), .mx-metric-grid > :nth-child(4) { animation-delay: 180ms; }
  .mx-idea-grid > :nth-child(5), .mx-list > :nth-child(5) { animation-delay: 240ms; }
  .mx-idea-grid > :nth-child(6), .mx-list > :nth-child(6) { animation-delay: 300ms; }
  .mx-idea-card:hover, .mx-row-card:hover, .mx-approval-card:hover, .mx-pipe-card:hover { border-color: var(--mx-line-2); box-shadow: var(--mx-shadow), 0 0 22px rgba(66,199,216,.14); transform: translateY(-2px); transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease; }
  .mx-idea-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
  .mx-idea-card { position: relative; padding: 16px 16px 14px; display: flex; flex-direction: column; gap: 10px; overflow: hidden; }
  .mx-idea-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: linear-gradient(180deg, var(--mx-cyan), var(--mx-violet)); opacity: .9; }
  .mx-idea-card.example::before { background: rgba(157,177,210,.5); }
  .mx-idea-card.example { background: rgba(14, 30, 58, .45); border-style: dashed; box-shadow: none; }
  .mx-idea-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; color: var(--mx-muted); font-size: 13px; font-weight: 600; }
  .mx-idea-top span { color: var(--mx-sky); }
  .mx-idea-top strong { color: var(--mx-ink-2); font-weight: 600; }
  .mx-idea-card h2 { margin: 0; font-size: 17px; line-height: 1.4; color: #fff; letter-spacing: 0; font-weight: 700; }
  .mx-idea-title-link { color: inherit; text-decoration: none; border-bottom: 1px solid transparent; }
  .mx-idea-title-link:hover { color: var(--mx-sky); border-bottom-color: var(--mx-line-2); }
  .mx-idea-card p { margin: 0; color: var(--mx-ink-2); font-size: 15px; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .mx-idea-card p.open { display: block; -webkit-line-clamp: unset; overflow: visible; }
  .mx-more-link { align-self: flex-start; border: 0; background: transparent; color: var(--mx-sky); font-size: 13px; font-weight: 600; padding: 2px 0; cursor: pointer; margin-top: -4px; }
  .mx-more-link:hover { text-decoration: underline; }
  .mx-angle-pick { margin: 0; padding: 6px 10px 8px; border: 1px solid var(--mx-line); border-radius: 12px; display: flex; flex-wrap: wrap; gap: 5px; background: rgba(5,11,24,.35); }
  .mx-angle-pick legend { padding: 0 6px; font-size: 13px; color: var(--mx-muted); font-weight: 600; }
  .mx-angle-pick label { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--mx-line); border-radius: 999px; padding: 4px 10px; font-size: 13px; color: var(--mx-ink-2); cursor: pointer; }
  .mx-angle-pick label.active { border-color: var(--mx-line-2); background: rgba(66,199,216,.14); color: #fff; box-shadow: 0 0 12px rgba(66,199,216,.25); }
  .mx-angle-pick input { position: absolute; opacity: 0; width: 0; height: 0; }
  .mx-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; }
  .mx-tags span, .mx-tags a { border: 1px solid var(--mx-line); background: rgba(66,199,216,.06); color: #bfe9f0; border-radius: 999px; padding: 4px 10px; font-size: 13px; font-weight: 500; text-decoration: none; }
  .mx-tags .mx-tag-ai { border-color: rgba(66,199,216,.6); background: rgba(66,199,216,.18); color: #eafdff; }
  .mx-fresh-status { font-size: 13px; line-height: 1.5; border-radius: 10px; padding: 8px 12px; border: 1px solid var(--mx-line-2); background: rgba(66,199,216,.08); color: #bfe9f0; }
  .mx-fresh-status.info::before { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--mx-sky); margin-right: 8px; vertical-align: middle; animation: mx-pulse 1.4s ease-out infinite; }
  .mx-fresh-status.warn { border-color: rgba(251,191,36,.45); background: rgba(251,191,36,.10); color: #fde68a; }
  .mx-fresh-status.error { border-color: rgba(251,113,133,.5); background: rgba(251,113,133,.08); color: var(--mx-err-soft); }
  .mx-tags a { color: var(--mx-sky); border-color: var(--mx-line-2); }
  .mx-tags a:hover { background: rgba(66,199,216,.16); }
  .mx-card-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .mx-card-actions.end { justify-content: flex-end; margin-top: 14px; }
  .mx-feed-notice { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; padding: 12px 16px; border-radius: 14px; border: 1px solid var(--mx-line); background: var(--mx-panel); color: var(--mx-ink-2); position: relative; overflow: hidden; }
  .mx-feed-notice.muted::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(66,199,216,.12), transparent); animation: mx-scan 1.8s linear infinite; }
  .mx-feed-notice.warn { border-color: rgba(251,191,36,.45); color: #fde68a; }
  .mx-feed-notice.error { border-color: rgba(251,113,133,.5); color: var(--mx-err-soft); }
  .mx-example-fold { margin-top: 24px; border: 1px dashed var(--mx-line); border-radius: 14px; padding: 4px 14px; }
  .mx-example-fold > summary { cursor: pointer; padding: 10px 0; color: var(--mx-muted); font-weight: 600; list-style: none; }
  .mx-example-fold > summary::-webkit-details-marker { display: none; }
  .mx-example-fold > summary::before { content: '▸ '; color: var(--mx-sky); }
  .mx-example-fold[open] > summary::before { content: '▾ '; }
  .mx-example-fold[open] > summary { margin-bottom: 12px; border-bottom: 1px solid var(--mx-line); }
  .mx-example-fold > .mx-idea-grid { padding-bottom: 14px; }

  .mx-manual { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 14px; padding: 10px 10px 10px 16px; box-shadow: var(--mx-shadow); margin-top: 18px; align-items: center; }
  .mx-manual label { color: var(--mx-sky); font-size: 13px; font-weight: 700; white-space: nowrap; }
  .mx-manual input, .mx-prompt-box textarea { border: 0; outline: 0; color: var(--mx-ink); background: transparent; }
  .mx-manual input::placeholder, .mx-prompt-box textarea::placeholder, .mx-page input::placeholder, .mx-page textarea::placeholder { color: #8ea2c4; }
  .mx-manual button { border: 1px solid var(--mx-line-2); background: rgba(66,199,216,.12); color: #fff; border-radius: 10px; padding: 9px 14px; font-weight: 700; cursor: pointer; }
  .mx-manual button:disabled { opacity: .45; cursor: not-allowed; }

  /* ── Studio ── */
  .mx-prompt-box { display: grid; grid-template-columns: 1fr auto; gap: 12px; border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 14px; padding: 12px 14px; box-shadow: var(--mx-shadow); align-items: center; }
  .mx-prompt-box textarea { min-height: 54px; resize: vertical; }
  .mx-model-note { color: var(--mx-muted); font-size: 13px; margin-top: 12px; }
  .mx-generated-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 14px; margin-top: 20px; }
  .mx-review-card { padding: 18px; }
  .mx-review-card.wide { min-width: 0; }
  .mx-review-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .mx-review-head h2 { font-size: 19px; }
  .mx-pass, .mx-warn { border-radius: 999px; padding: 5px 11px; font-size: 13px; font-weight: 700; white-space: nowrap; }
  .mx-pass { background: rgba(74,222,128,.12); border: 1px solid rgba(74,222,128,.45); color: #bbf7d0; }
  .mx-warn { background: rgba(251,191,36,.12); border: 1px solid rgba(251,191,36,.45); color: #fde68a; }
  p.mx-warn { white-space: normal; border-radius: 12px; padding: 10px 14px; margin: 0 0 12px; }
  .mx-preview { padding: 14px; }
  .mx-preview-poster { min-height: 220px; display: grid; align-content: space-between; border-radius: 13px; color: #fff; padding: 18px; background: linear-gradient(135deg, #08213f 0%, #2a66c4 58%, #156f6c 100%); text-shadow: 0 1px 3px rgba(0,0,0,.55); }
  .mx-preview-poster.compact { min-height: 156px; }
  .mx-preview-poster span, .mx-preview-poster small { font-weight: 700; font-size: 13px; }
  .mx-preview-poster strong { font-size: 22px; line-height: 1.35; letter-spacing: 0; color: #fff; }

  /* ── ร่าง (approvals) ── */
  .mx-approval-feed { display: grid; gap: 14px; max-width: 1120px; }
  .mx-approval-card { border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 18px; padding: 18px; display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 16px; box-shadow: var(--mx-shadow); cursor: pointer; }
  .mx-approval-card.active { border-color: var(--mx-line-2); box-shadow: var(--mx-shadow), var(--mx-glow); }
  .mx-approval-media-column { display: grid; gap: 8px; align-content: start; }
  .mx-approval-card-image { width: 100%; aspect-ratio: 4 / 5; border: 1px solid var(--mx-line); border-radius: 12px; overflow: hidden; background: rgba(5,11,24,.4); display: grid; }
  .mx-approval-card-image img { width: 100%; height: 100%; object-fit: cover; background: #fff; }
  .mx-approval-copy-column { min-width: 0; display: grid; gap: 10px; align-content: start; }
  .mx-approval-caption { width: 100%; min-height: 180px; border: 1px solid transparent; background: transparent; color: var(--mx-ink); padding: 6px; border-radius: 10px; resize: vertical; font-size: 15px; line-height: 1.75; outline: 0; }
  .mx-approval-caption:focus { background: var(--mx-field); border-color: var(--mx-line-2); padding: 10px; box-shadow: 0 0 0 3px rgba(66,199,216,.14); }
  .mx-poster-placeholder { min-height: 260px; display: grid; align-content: space-between; gap: 12px; padding: 18px; color: #fff; background: linear-gradient(135deg, #08213f 0%, #2a66c4 56%, #156f6c 100%); text-shadow: 0 1px 3px rgba(0,0,0,.55); }
  .mx-poster-placeholder.compact { min-height: 100%; padding: 12px; }
  .mx-poster-placeholder span, .mx-poster-placeholder small { font-size: 13px; font-weight: 700; }
  .mx-poster-placeholder strong { font-size: 22px; line-height: 1.35; letter-spacing: 0; }
  .mx-poster-placeholder.compact strong { font-size: 15px; }
  .mx-review-notes { margin-top: 12px; display: grid; gap: 6px; border: 1px solid var(--mx-line); background: rgba(5,11,24,.35); border-radius: 10px; padding: 12px; }
  .mx-review-notes.compact { margin-top: 0; }
  .mx-hook-picker { margin: 10px 0; border: 1px solid var(--mx-line); background: rgba(5,11,24,.35); border-radius: 10px; padding: 10px 12px; }
  .mx-hook-picker > summary { cursor: pointer; display: grid; gap: 2px; list-style: none; }
  .mx-hook-picker > summary span { color: var(--mx-sky); font-size: 15px; font-weight: 700; }
  .mx-hook-picker > summary small { color: var(--mx-ink-2); font-size: 14px; }
  .mx-hook-picker > summary::-webkit-details-marker { display: none; }
  .mx-hook-list { display: grid; gap: 8px; margin-top: 10px; }
  .mx-hook-option { display: grid; gap: 6px; border: 1px solid var(--mx-line); border-radius: 10px; padding: 10px 12px; background: rgba(255,255,255,.02); }
  .mx-hook-option.current { border-color: var(--mx-sky); background: rgba(66,199,216,.08); }
  .mx-hook-option p { margin: 0; color: var(--mx-ink); font-size: 16px; line-height: 1.55; overflow-wrap: anywhere; }
  .mx-hook-option small { color: var(--mx-ink-2); font-size: 14px; line-height: 1.5; }
  .mx-hook-option .mx-hook-why { color: #f3c27a; }
  .mx-hook-option .mx-mini-button { justify-self: start; }
  .mx-hook-meta { display: flex; justify-content: space-between; gap: 8px; align-items: center; flex-wrap: wrap; }
  .mx-hook-name { color: #bfeef5; font-size: 14px; font-weight: 700; }
  .mx-hook-score { font-size: 13px; font-weight: 700; border-radius: 999px; padding: 2px 9px; border: 1px solid var(--mx-line); color: var(--mx-ink-2); }
  .mx-hook-score.high { color: #7ee0a1; border-color: rgba(126,224,161,.5); }
  .mx-hook-score.low { color: #f3c27a; border-color: rgba(243,194,122,.5); }
  .mx-hook-current { color: var(--mx-sky); font-style: normal; font-size: 14px; font-weight: 700; }
  .mx-review-notes strong { color: var(--mx-sky); font-size: 13px; }
  .mx-review-notes span { color: var(--mx-ink-2); font-size: 15px; line-height: 1.5; }
  .mx-schedule-row { display: flex; align-items: end; gap: 12px; flex-wrap: wrap; margin-top: 10px; border: 1px solid var(--mx-line); background: rgba(5,11,24,.35); border-radius: 10px; padding: 12px; }
  .mx-schedule-row.compact { margin-top: 0; padding: 10px; }
  .mx-schedule-row label { display: grid; gap: 6px; color: var(--mx-muted); font-size: 13px; font-weight: 600; }
  .mx-schedule-row input, .mx-row-actions input, .mx-schedule-row select { border: 1px solid var(--mx-line); background: var(--mx-field); color: var(--mx-ink); border-radius: 8px; padding: 8px 10px; color-scheme: dark; }
  .mx-schedule-row span { color: var(--mx-sky); font-size: 13px; font-weight: 600; padding-bottom: 9px; }
  .mx-upload-button { position: relative; overflow: hidden; border: 1px solid var(--mx-line-2); background: rgba(66,199,216,.1); color: #fff; border-radius: 10px; padding: 10px 14px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
  .mx-upload-button.slim { min-height: 38px; padding: 8px 12px; font-size: 13px; }
  .mx-upload-button.disabled { opacity: .5; cursor: not-allowed; }
  .mx-upload-button input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

  /* ── โพสต์ (queue) · รายการ · คิว ── */
  .mx-list, .mx-pipeline { display: grid; gap: 10px; }
  .mx-row-card, .mx-pipe-card { padding: 14px 16px; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
  .mx-row-thumb { width: 58px; height: 72px; object-fit: cover; border-radius: 9px; border: 1px solid var(--mx-line); background: #fff; flex: 0 0 auto; }
  .mx-row-card div, .mx-pipe-card div { display: grid; gap: 4px; min-width: 0; }
  .mx-row-card strong, .mx-pipe-card strong { color: #fff; font-weight: 700; }
  .mx-row-card span, .mx-pipe-card span { color: var(--mx-muted); font-size: 15px; }
  .mx-row-card.muted { background: rgba(14,30,58,.4); }
  .mx-row-card.muted strong { color: var(--mx-ink-2); }
  .mx-row-actions { display: flex !important; grid-template-columns: none !important; flex-direction: row; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
  .mx-post-actions { display: flex !important; grid-template-columns: none !important; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
  .mx-queue-due { margin: 0 0 12px; padding: 10px 14px; border-left: 3px solid var(--mx-err); background: rgba(251,113,133,.1); color: var(--mx-err-soft); border-radius: 0 12px 12px 0; font-size: 15px; font-weight: 600; }
  .mx-queue-verify { margin: 0 0 12px; padding: 10px 14px; border-left: 3px solid var(--mx-warn); background: rgba(251,191,36,.1); color: #fde68a; border-radius: 0 12px 12px 0; font-size: 15px; font-weight: 600; }
  .mx-queue-tabs { display: flex; gap: 18px; overflow-x: auto; margin-bottom: 14px; border-bottom: 1px solid var(--mx-line); }
  .mx-queue-tabs button { flex: 0 0 auto; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--mx-muted); padding: 10px 2px; font-size: 15px; font-weight: 600; cursor: pointer; }
  .mx-queue-tabs button.active { border-color: var(--mx-cyan); color: #fff; text-shadow: 0 0 12px rgba(66,199,216,.6); }
  .mx-queue-tabs button span { margin-left: 6px; color: var(--mx-sky); }
  .mx-row-card .mx-queue-state { font-size: 13px; font-weight: 600; color: var(--mx-ink-2); }
  .mx-row-card .mx-queue-state.overdue { color: var(--mx-err-soft); }
  .mx-row-card .mx-queue-state.today { color: #fde68a; }
  .mx-row-card .mx-queue-state.posted { color: #bbf7d0; }
  .mx-publish-error { color: var(--mx-err-soft); font-size: 13px; }
  .mx-publish-row { flex-wrap: wrap; }
  .mx-publish-row a, .mx-channel-table a { color: var(--mx-sky); font-weight: 600; }
  .mx-manual-handoff { flex: 0 0 100%; border-top: 1px solid var(--mx-line); padding-top: 10px; }
  .mx-manual-handoff summary { color: var(--mx-sky); font-weight: 600; cursor: pointer; }
  .mx-publish-row .mx-manual-handoff-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
  .mx-manual-proof { display: flex; align-items: end; flex-wrap: wrap; gap: 8px; }
  .mx-manual-proof label { display: grid; gap: 5px; color: var(--mx-muted); font-size: 13px; font-weight: 600; flex: 1 1 250px; }
  .mx-manual-proof input { width: 100%; min-width: 0; border: 1px solid var(--mx-line); background: var(--mx-field); border-radius: 8px; padding: 9px 10px; color: var(--mx-ink); }
  .mx-manual-handoff small { display: block; color: #fde68a; margin-top: 8px; font-size: 13px; }
  .mx-pipe-card em { font-style: normal; border-radius: 999px; padding: 6px 12px; font-weight: 700; white-space: nowrap; font-size: 13px; border: 1px solid var(--mx-line); color: var(--mx-ink-2); }
  .mx-pipe-card em.ok { color: #bbf7d0; border-color: rgba(74,222,128,.45); background: rgba(74,222,128,.1); }
  .mx-pipe-card em.warn { color: #fde68a; border-color: rgba(251,191,36,.45); background: rgba(251,191,36,.1); }
  .mx-pipe-card em.error { color: var(--mx-err-soft); border-color: rgba(251,113,133,.5); background: rgba(251,113,133,.1); }
  .mx-pipe-card em.muted { color: var(--mx-ink-2); }
  .mx-pipe-note { font-size: 13px !important; font-weight: 600; }
  .mx-pipe-note.ok { color: #bbf7d0 !important; }
  .mx-pipe-note.warn { color: #fde68a !important; }
  .mx-pipe-note.error { color: var(--mx-err-soft) !important; }

  /* ── ช่องทาง ── */
  .mx-channel-table-wrap { overflow-x: auto; border: 1px solid var(--mx-line); border-radius: 14px; background: var(--mx-panel); }
  .mx-channel-table { width: 100%; min-width: 820px; border-collapse: collapse; text-align: left; font-size: 15px; }
  .mx-channel-table th, .mx-channel-table td { padding: 14px 14px; border-bottom: 1px solid var(--mx-line); vertical-align: top; color: var(--mx-ink-2); }
  .mx-channel-table thead th { color: var(--mx-muted); background: rgba(5,11,24,.35); font-size: 13px; font-weight: 600; }
  .mx-channel-table tbody th { color: #fff; white-space: nowrap; font-weight: 700; }
  .mx-channel-table tbody tr:last-child th, .mx-channel-table tbody tr:last-child td { border-bottom: 0; }
  .mx-channel-ready { color: #bbf7d0; font-weight: 600; }
  .mx-channel-manual { color: #fde68a; font-weight: 600; }
  .mx-channel-warning { color: #fde68a; font-size: 13px; overflow-wrap: anywhere; margin-top: 12px; }

  /* ── ห้องภาพ · โปสเตอร์ ── */
  .mx-brief-grid, .mx-brand-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .mx-brief-card, .mx-brand-rule { border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 14px; padding: 16px; box-shadow: var(--mx-shadow); }
  .mx-brief-card { display: grid; gap: 12px; }
  .mx-brief-card.active { border-color: var(--mx-line-2); box-shadow: var(--mx-shadow), var(--mx-glow); }
  .mx-brief-card strong, .mx-brand-rule strong { color: #fff; }
  .mx-brief-card p, .mx-brand-rule p { margin: 8px 0 0; color: var(--mx-ink-2); font-size: 15px; line-height: 1.65; }
  .mx-brief-card p { max-height: 154px; overflow: auto; padding-right: 4px; }
  .mx-gallery-empty { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; color: var(--mx-ink-2); }
  .mx-gallery-flow { display: grid; gap: 12px; padding: 4px 0 20px; border-bottom: 1px solid var(--mx-line); margin-bottom: 16px; }
  .mx-gallery-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .mx-gallery-fields label { display: grid; gap: 6px; color: var(--mx-muted); font-size: 13px; font-weight: 600; }
  .mx-gallery-fields select, .mx-style-picker select, .mx-filter-bar select { width: 100%; min-width: 0; border: 1px solid var(--mx-line); border-radius: 10px; background: var(--mx-field); color: var(--mx-ink); padding: 10px 11px; color-scheme: dark; }
  .mx-gallery-prompt-head { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; color: #fff; flex-wrap: wrap; }
  .mx-gallery-prompt-head span { color: var(--mx-muted); font-size: 13px; }
  .mx-gallery-flow textarea { width: 100%; min-height: 174px; resize: vertical; border: 1px solid var(--mx-line); border-radius: 10px; background: var(--mx-field); color: var(--mx-ink-2); padding: 12px; font-size: 14px; line-height: 1.55; }
  .mx-gallery-prompt-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .mx-gallery-advanced { margin-bottom: 14px; }
  .mx-gallery-advanced summary { cursor: pointer; padding: 10px 0; color: var(--mx-sky); font-weight: 600; border-bottom: 1px solid var(--mx-line); }
  .mx-gallery-advanced[open] > .mx-visual-system, .mx-gallery-advanced[open] > .mx-brief-grid { margin-top: 14px; }
  .mx-visual-system { border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 18px; padding: 16px; margin-bottom: 16px; display: grid; grid-template-columns: minmax(280px, .9fr) minmax(0, 1.1fr); gap: 14px; box-shadow: var(--mx-shadow); }
  .mx-visual-copy h2 { margin: 3px 0 8px; color: #fff; font-size: 22px; line-height: 1.35; letter-spacing: 0; }
  .mx-visual-copy p { margin: 0; color: var(--mx-ink-2); font-size: 15px; line-height: 1.7; }
  .mx-workflow-steps { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
  .mx-workflow-steps span { border: 1px solid var(--mx-line); background: rgba(66,199,216,.06); color: #bfe9f0; border-radius: 999px; padding: 5px 10px; font-size: 13px; font-weight: 600; }
  .mx-style-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
  .mx-style-card { border: 1px solid var(--mx-line); background: rgba(5,11,24,.35); border-radius: 14px; padding: 12px; text-align: left; display: grid; gap: 7px; cursor: pointer; color: var(--mx-ink-2); }
  .mx-style-card.active { border-color: var(--mx-line-2); background: rgba(66,199,216,.1); box-shadow: var(--mx-glow); }
  .mx-style-card span { color: var(--mx-sky); font-size: 13px; font-weight: 700; }
  .mx-style-card strong { color: #fff; }
  .mx-style-card em { color: var(--mx-muted); font-size: 13px; line-height: 1.45; font-style: normal; }
  .mx-style-card small { width: fit-content; color: #bfe9f0; background: rgba(66,199,216,.1); border: 1px solid var(--mx-line); border-radius: 999px; padding: 3px 8px; font-size: 13px; font-weight: 600; }
  .mx-style-picker { grid-column: 1 / -1; display: grid; gap: 7px; padding: 12px; border: 1px solid var(--mx-line); border-radius: 12px; background: rgba(5,11,24,.35); color: var(--mx-ink-2); }
  .mx-style-picker em { color: var(--mx-muted); font-size: 13px; font-style: normal; }
  .mx-poster-editor { border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 16px; padding: 16px; margin-bottom: 16px; box-shadow: var(--mx-shadow); }
  .mx-poster-editor .mx-section-head p { margin: 5px 0 0; color: var(--mx-muted); font-size: 15px; line-height: 1.6; }
  .mx-poster-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
  .mx-poster-form label { display: grid; gap: 6px; color: var(--mx-muted); font-size: 13px; font-weight: 600; min-width: 0; }
  .mx-poster-form label.wide { grid-column: 1 / -1; }
  .mx-poster-form input, .mx-reference-search input, .mx-reference-form input, .mx-reference-form select, .mx-reference-form textarea, .mx-metric-form input, .mx-metric-form select, .mx-metric-form textarea { width: 100%; min-width: 0; border: 1px solid var(--mx-line); background: var(--mx-field); color: var(--mx-ink); border-radius: 10px; padding: 10px 11px; font-size: 15px; outline: 0; color-scheme: dark; }
  .mx-poster-form input:focus, .mx-reference-search input:focus, .mx-reference-form input:focus, .mx-reference-form select:focus, .mx-reference-form textarea:focus, .mx-metric-form input:focus, .mx-metric-form textarea:focus { border-color: var(--mx-line-2); box-shadow: 0 0 0 3px rgba(66,199,216,.14); }
  .mx-upload-panel { border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 16px; padding: 16px; margin-bottom: 16px; display: flex; justify-content: space-between; gap: 14px; align-items: center; box-shadow: var(--mx-shadow); }
  .mx-upload-panel h2 { margin: 3px 0 0; color: #fff; font-size: 19px; line-height: 1.35; letter-spacing: 0; }
  .mx-upload-panel p { margin: 5px 0 0; color: var(--mx-muted); font-size: 15px; line-height: 1.6; }
  .mx-upload-actions { display: grid; gap: 9px; justify-items: end; min-width: 260px; }
  .mx-upload-actions span { color: var(--mx-muted); font-size: 13px; font-weight: 600; text-align: right; }
  .mx-artwork-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; margin-top: 16px; }
  .mx-artwork-card { border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 14px; padding: 12px; display: grid; gap: 10px; box-shadow: var(--mx-shadow); }
  .mx-artwork-card img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 10px; border: 1px solid var(--mx-line); background: #fff; }
  .mx-artwork-card strong { color: #fff; line-height: 1.35; }
  .mx-artwork-card span { color: var(--mx-muted); font-size: 13px; }
  .mx-visual-note { border: 1px solid var(--mx-line); background: rgba(5,11,24,.35); border-radius: 10px; padding: 10px; margin-top: 10px; }
  .mx-visual-note span { display: block; color: var(--mx-sky); font-size: 13px; font-weight: 700; margin-bottom: 4px; }
  .mx-visual-note p { margin: 0; max-height: 88px; font-size: 13px; color: var(--mx-ink-2); overflow: auto; }
  .mx-media-result { border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 16px; padding: 16px; margin-bottom: 16px; display: grid; gap: 14px; box-shadow: var(--mx-shadow); }
  .mx-media-result h2 { margin: 3px 0 0; color: #fff; font-size: 20px; line-height: 1.35; letter-spacing: 0; }
  .mx-media-result img, .mx-media-result video { width: min(100%, 760px); max-height: 640px; object-fit: contain; border-radius: 14px; border: 1px solid var(--mx-line); background: #fff; justify-self: start; }
  .mx-media-result video { max-height: 720px; background: #07111f; }
  .mx-media-result .media-download { width: fit-content; text-decoration: none; display: inline-flex; }
  .mx-quota-note { border: 1px solid rgba(251,191,36,.45); background: rgba(251,191,36,.1); color: #fde68a; border-radius: 12px; padding: 12px 14px; font-size: 15px; line-height: 1.6; font-weight: 500; }
  .mx-fallback-prompt { margin: 0; white-space: pre-wrap; border: 1px solid var(--mx-line); background: var(--mx-field); color: var(--mx-ink-2); border-radius: 12px; padding: 12px; font-size: 13px; line-height: 1.7; max-height: 360px; overflow: auto; }

  /* ── คลังตัวอย่างโฆษณา (references) ── */
  .mx-reference-hero { border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 18px; padding: 16px; margin-bottom: 16px; display: grid; gap: 14px; box-shadow: var(--mx-shadow); }
  .mx-reference-search label, .mx-reference-form label { display: grid; gap: 6px; color: var(--mx-muted); font-size: 13px; font-weight: 600; min-width: 0; }
  .mx-reference-form textarea { min-height: 78px; resize: vertical; }
  .mx-query-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .mx-query-chips button { border: 1px solid var(--mx-line); background: rgba(255,255,255,.03); color: #bfeef5; border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .mx-query-chips button:hover { border-color: var(--mx-line-2); color: #fff; }
  .mx-source-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
  .mx-source-card { border: 1px solid var(--mx-line); background: rgba(5,11,24,.35); border-radius: 14px; padding: 14px; display: grid; gap: 7px; text-decoration: none; color: var(--mx-ink-2); min-height: 160px; transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
  .mx-source-card:hover { border-color: var(--mx-line-2); transform: translateY(-2px); box-shadow: var(--mx-glow); }
  .mx-source-card span { color: var(--mx-sky); font-size: 13px; font-weight: 700; }
  .mx-source-card strong { color: #fff; font-size: 15px; }
  .mx-source-card p { margin: 0; color: var(--mx-muted); font-size: 13px; line-height: 1.55; }
  .mx-source-card em { margin-top: auto; color: var(--mx-sky); font-style: normal; font-size: 13px; font-weight: 700; }
  .mx-reference-layout { display: grid; grid-template-columns: minmax(320px, .86fr) minmax(0, 1.14fr); gap: 14px; align-items: start; }
  .mx-reference-form, .mx-pattern-panel, .mx-reference-item { border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 14px; padding: 16px; box-shadow: var(--mx-shadow); }
  .mx-reference-form { display: grid; gap: 12px; }
  .mx-section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 2px; flex-wrap: wrap; }
  .mx-section-head h2, .mx-pattern-panel h2 { margin: 3px 0 0; color: #fff; font-size: 19px; line-height: 1.35; letter-spacing: 0; }
  .mx-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .mx-reference-side { display: grid; gap: 12px; }
  .mx-pattern-panel { display: grid; gap: 10px; }
  .mx-pattern-panel p { margin: 0; color: var(--mx-ink-2); font-size: 15px; line-height: 1.7; }
  .mx-reference-meta, .mx-reference-tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .mx-reference-meta span, .mx-reference-tags span, .mx-inbox-meta span { border: 1px solid var(--mx-line); background: rgba(66,199,216,.06); color: #bfe9f0; border-radius: 999px; padding: 4px 10px; font-size: 13px; font-weight: 500; }
  .mx-reference-list { display: grid; gap: 10px; }
  .mx-reference-item { display: grid; gap: 10px; padding: 14px; }
  .mx-reference-item.active { border-color: var(--mx-line-2); box-shadow: var(--mx-shadow), var(--mx-glow); }
  .mx-reference-item > button { border: 0; background: transparent; text-align: left; padding: 0; cursor: pointer; display: grid; gap: 5px; color: var(--mx-ink-2); }
  .mx-reference-item > button span { color: var(--mx-sky); font-size: 13px; font-weight: 700; }
  .mx-reference-item > button strong { color: #fff; font-size: 16px; line-height: 1.4; }
  .mx-reference-item > button p { margin: 0; color: var(--mx-ink-2); font-size: 15px; line-height: 1.55; }

  /* ── คลังผลงาน ── */
  .mx-library-split { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr); gap: 14px; align-items: start; }
  .mx-filter-bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: end; margin-bottom: 14px; border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 14px; padding: 12px; box-shadow: var(--mx-shadow); }
  .mx-filter-bar label { display: grid; gap: 6px; color: var(--mx-muted); font-size: 13px; font-weight: 600; min-width: 180px; }
  .mx-library-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .mx-library-head span { color: var(--mx-muted); font-size: 13px; font-weight: 600; }
  .mx-mini-artwork-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 14px; }
  .mx-mini-artwork { border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 11px; padding: 8px; text-decoration: none; display: grid; gap: 7px; color: var(--mx-ink-2); }
  .mx-mini-artwork img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 8px; background: #fff; }
  .mx-mini-artwork span { color: var(--mx-muted); font-size: 13px; font-weight: 500; line-height: 1.35; }
  .mx-channel-preview { border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 14px; padding: 14px; box-shadow: var(--mx-shadow); }
  .mx-preview-box { margin-top: 10px; border: 1px solid var(--mx-line); background: rgba(5,11,24,.35); border-radius: 12px; padding: 14px; min-height: 220px; display: grid; gap: 10px; align-content: start; }
  .mx-preview-box.facebook { border-color: rgba(47,159,230,.45); }
  .mx-preview-box.line-oa { border-color: rgba(74,222,128,.45); }
  .mx-preview-box.tiktok { border-color: rgba(124,92,255,.5); }
  .mx-channel-image { width: 100%; max-height: 420px; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 10px; border: 1px solid var(--mx-line); background: #fff; }
  .mx-preview-box strong { color: #fff; font-size: 17px; line-height: 1.45; }
  .mx-preview-box pre { margin: 0; white-space: pre-wrap; font: inherit; color: var(--mx-ink-2); font-size: 15px; line-height: 1.7; }
  .mx-section-title { margin: 0 0 10px; color: #fff; font-size: 17px; letter-spacing: 0; font-weight: 700; }
  .mx-content-block { border: 1px solid var(--mx-line); background: rgba(5,11,24,.35); border-radius: 10px; padding: 12px; margin-top: 10px; }
  .mx-content-title, .mx-content-block summary { display: flex; justify-content: space-between; align-items: center; gap: 10px; color: var(--mx-sky); font-weight: 700; cursor: pointer; font-size: 14px; }
  .mx-content-block button { border: 1px solid var(--mx-line); background: rgba(255,255,255,.03); color: #bfeef5; border-radius: 7px; padding: 5px 10px; cursor: pointer; font-size: 13px; }
  .mx-content-block pre { margin: 9px 0 0; white-space: pre-wrap; font: inherit; font-size: 15px; line-height: 1.7; color: var(--mx-ink-2); }
  .mx-page summary::-webkit-details-marker { display: none; }
  .mx-empty { padding: 26px; color: var(--mx-ink-2); line-height: 1.7; }

  /* ── ปฏิทิน ── */
  .mx-calendar { display: grid; grid-template-columns: repeat(7, minmax(90px, 1fr)); gap: 8px; }
  .mx-calendar-unscheduled { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; color: var(--mx-ink-2); font-size: 15px; }
  .mx-weekday { text-align: center; color: var(--mx-muted); font-size: 13px; font-weight: 600; }
  .mx-day { min-height: 96px; border: 1px solid var(--mx-line); background: rgba(14,30,58,.45); border-radius: 12px; padding: 10px; display: grid; align-content: start; gap: 8px; }
  .mx-day.has { border-color: var(--mx-line-2); background: rgba(66,199,216,.08); }
  .mx-day.today { outline: 2px solid var(--mx-cyan); outline-offset: -2px; box-shadow: 0 0 18px rgba(66,199,216,.3); }
  .mx-day > strong { color: var(--mx-sky); font-size: 13px; font-weight: 700; }
  .mx-day.today > strong { color: #fff; }
  .mx-calendar-item { border: 1px solid var(--mx-line); background: rgba(5,11,24,.45); color: var(--mx-ink-2); border-radius: 8px; padding: 6px 8px; font-size: 13px; line-height: 1.4; }
  .mx-calendar-item strong { display: block; overflow-wrap: anywhere; color: #fff; }
  .mx-calendar-item span { color: var(--mx-muted); font-size: 13px; }

  /* ── ตัวเลข ── */
  .mx-range { display: flex; gap: 6px; flex-wrap: wrap; }
  .mx-range button { border: 1px solid var(--mx-line); background: rgba(255,255,255,.03); color: #bfeef5; border-radius: 999px; padding: 7px 13px; font-weight: 600; font-size: 13px; cursor: pointer; }
  .mx-range button.active { background: rgba(66,199,216,.16); border-color: var(--mx-line-2); color: #fff; box-shadow: var(--mx-glow); }
  .mx-metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 14px; }
  .mx-metric-card { padding: 16px; display: grid; gap: 4px; position: relative; overflow: hidden; }
  .mx-metric-card::after { content: ''; position: absolute; right: -30px; top: -30px; width: 90px; height: 90px; border-radius: 50%; background: radial-gradient(circle, rgba(66,199,216,.25), transparent 70%); }
  .mx-metric-card span { color: var(--mx-muted); font-size: 13px; font-weight: 600; }
  .mx-metric-card strong { font-size: 30px; color: #fff; font-weight: 700; letter-spacing: -.01em; }
  .mx-metric-card em { color: var(--mx-sky); font-style: normal; font-weight: 600; font-size: 13px; }
  .mx-metrics-layout { display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); gap: 14px; margin-bottom: 14px; align-items: start; }
  .mx-metric-form { border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 14px; padding: 16px; display: grid; gap: 12px; box-shadow: var(--mx-shadow); min-width: 0; }
  .mx-metric-form label { display: grid; gap: 6px; color: var(--mx-muted); font-size: 13px; font-weight: 600; min-width: 0; }
  .mx-metric-form textarea { min-height: 84px; resize: vertical; }
  .mx-metric-inputs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .mx-chart-card { padding: 18px; }
  .mx-bars { height: 240px; display: flex; align-items: end; gap: 10px; padding: 16px; border-radius: 12px; background: linear-gradient(180deg, rgba(5,11,24,.2), rgba(5,11,24,.55)); border: 1px solid var(--mx-line); }
  .mx-bars span { flex: 1; min-width: 10px; border-radius: 8px 8px 0 0; background: linear-gradient(180deg, var(--mx-cyan), var(--mx-violet)); box-shadow: 0 0 14px rgba(66,199,216,.3); }
  .mx-chart-card p { color: var(--mx-muted); font-size: 15px; margin: 12px 0 0; }

  /* ── ตอบคอมเมนต์ (ตัวอย่าง) ── */
  .mx-inbox-layout { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 14px; align-items: start; }
  .mx-inbox-list { display: grid; gap: 9px; }
  .mx-inbox-item { text-align: left; border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 13px; padding: 13px; display: grid; grid-template-columns: 1fr auto; gap: 8px; cursor: pointer; color: var(--mx-ink-2); box-shadow: var(--mx-shadow); }
  .mx-inbox-item.active, .mx-inbox-item:hover { border-color: var(--mx-line-2); }
  .mx-inbox-item div { display: grid; gap: 3px; }
  .mx-inbox-item strong { color: #fff; }
  .mx-inbox-item span { color: var(--mx-muted); font-size: 13px; font-weight: 600; }
  .mx-inbox-item p { grid-column: 1 / -1; margin: 0; color: var(--mx-ink-2); font-size: 15px; line-height: 1.5; }
  .mx-inbox-item em, .mx-risk { font-style: normal; border-radius: 999px; padding: 5px 10px; font-size: 13px; font-weight: 700; white-space: nowrap; align-self: start; }
  .risk-high, .mx-risk.high { color: var(--mx-err-soft); background: rgba(251,113,133,.1); border: 1px solid rgba(251,113,133,.5); }
  .risk-medium, .mx-risk.medium { color: #fde68a; background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.45); }
  .risk-low, .mx-risk.low { color: #bbf7d0; background: rgba(74,222,128,.1); border: 1px solid rgba(74,222,128,.45); }
  .mx-inbox-detail { border: 1px solid var(--mx-line); background: var(--mx-panel); border-radius: 14px; padding: 16px; box-shadow: var(--mx-shadow); }
  .mx-inbox-meta { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }

  /* ── toast ── */
  .mx-toast { position: fixed; right: 22px; bottom: 22px; z-index: 60; background: rgba(12, 24, 48, .96); color: #fff; border: 1px solid var(--mx-line-2); border-radius: 12px; padding: 12px 16px; font-size: 15px; font-weight: 600; box-shadow: var(--mx-shadow), var(--mx-glow); max-width: min(640px, calc(100vw - 44px)); overflow-wrap: anywhere; white-space: pre-line; animation: mx-rise .25s ease both; }
  .mx-toast.error { border-color: rgba(251,113,133,.6); box-shadow: var(--mx-shadow), 0 0 24px rgba(251,113,133,.35); color: var(--mx-err-soft); }
  .mx-toast.warn { border-color: rgba(251,191,36,.6); box-shadow: var(--mx-shadow), 0 0 24px rgba(251,191,36,.3); color: #fde68a; }

  /* ── เลขคอนเทนต์ (#12) และช่องค้นด้วยเลข ── */
  .mx-page .mx-no { display: inline-flex; align-items: center; margin: 0 8px 0 0; padding: 0 8px; border: 1px solid var(--mx-line-2); border-radius: 8px; background: rgba(66,199,216,.12); color: var(--mx-sky); font-family: inherit; font-size: 14px; font-weight: 700; line-height: 1.7; font-variant-numeric: tabular-nums; letter-spacing: .02em; vertical-align: 2px; cursor: copy; transition: background 160ms ease, color 160ms ease; }
  .mx-page .mx-no:hover { background: rgba(66,199,216,.24); color: #fff; }
  .mx-find { position: relative; margin-left: auto; display: inline-flex; align-items: center; gap: 6px; }
  .mx-find + .mx-tools { margin-left: 0; }
  .mx-find input { width: 140px; min-height: 40px; padding: 8px 12px; border: 1px solid var(--mx-line); border-radius: 12px; background: rgba(5,11,24,.55); color: var(--mx-ink); font: inherit; font-size: 15px; }
  .mx-find input::placeholder { color: var(--mx-muted); }
  .mx-find button { min-height: 40px; padding: 8px 14px; border: 1px solid var(--mx-line-2); border-radius: 12px; background: rgba(66,199,216,.14); color: #fff; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
  .mx-find button:hover { background: rgba(66,199,216,.24); border-color: var(--mx-sky); }
  .mx-find-msg { position: absolute; top: calc(100% + 6px); right: 0; z-index: 46; width: max-content; max-width: min(360px, calc(100vw - 32px)); padding: 8px 12px; border: 1px solid rgba(251,113,133,.6); border-radius: 10px; background: #0d1a33; color: var(--mx-err-soft); font-size: 14px; font-weight: 600; line-height: 1.5; white-space: normal; box-shadow: var(--mx-shadow); cursor: pointer; }
  /* ว่าง = กล่องขนาดศูนย์ที่ไม่รับการคลิก แต่ยังอยู่ในโครงสร้างที่โปรแกรมอ่านหน้าจอเห็น (display:none ทำให้ข้อความแรกไม่ถูกอ่าน)
     มีข้อความ = รับการคลิกเอง และคลิกแล้วปิด — ไม่ปล่อยให้คลิกทะลุไปโดนปุ่มที่ถูกบังอยู่ เช่น ปุ่มลบ */
  .mx-find-msg:empty { padding: 0; border: 0; box-shadow: none; pointer-events: none; }
  /* คง mx-rise ไว้ในรายการ (ชื่อเดิม ตำแหน่งเดิม) ไม่งั้นพอเอาไฮไลต์ออก การ์ดจะเล่นแอนิเมชันเข้าใหม่ = กะพริบ */
  .mx-focus { outline: 2px solid var(--mx-cyan); outline-offset: 3px; animation: mx-rise .45s cubic-bezier(.2,.7,.2,1) both, mx-focus-pulse 1.1s ease 3; }
  @keyframes mx-focus-pulse { 0%, 100% { box-shadow: var(--mx-shadow); } 50% { box-shadow: var(--mx-shadow), 0 0 0 6px rgba(66,199,216,.32), 0 0 28px rgba(66,199,216,.35); } }

  /* ── จอเล็ก ── */
  @media (max-width: 900px) {
    /* ชื่อเครื่องมือที่เปิดอยู่ต่อท้ายปุ่มทำให้ปุ่มตกไปแถวใหม่ (เมนูหลุดขอบซ้าย) เมื่อมีช่องค้นด้วยเลขในแถวเดียวกัน */
    .mx-tools-current { display: none; }
  }
  @media (max-width: 980px) {
    .mx-generated-grid, .mx-library-split, .mx-inbox-layout, .mx-metrics-layout, .mx-visual-system, .mx-reference-layout, .mx-poster-form { grid-template-columns: 1fr; }
    .mx-upload-panel { align-items: stretch; flex-direction: column; }
    .mx-upload-actions { justify-items: start; min-width: 0; }
    .mx-upload-actions span { text-align: left; }
  }
  @media (max-width: 720px) {
    .mx-head { position: relative; }
    .mx-topbar { padding: 10px 16px; gap: 8px 12px; }
    .mx-strip { width: 100%; gap: 6px; }
    .mx-chip { padding: 4px 10px 4px 8px; white-space: normal; }
    .mx-tools-current, .mx-strip-refresh { display: none; }
    .mx-manual { grid-template-columns: 1fr; }
    .mx-tabs { padding: 0 8px 8px; gap: 2px; flex-wrap: nowrap; }
    .mx-tab, .mx-tools > summary { padding: 8px 9px; font-size: 13px; gap: 6px; }
    .mx-tab strong { padding: 0 6px; }
    .mx-tools { margin-left: auto; }
    .mx-tools-menu { right: 0; left: auto; min-width: 230px; }
    .mx-tabs { flex-wrap: wrap; row-gap: 6px; }
    /* แถวแรก = แท็บ 3 อัน · แถวสอง = ช่องค้นด้วยเลข + เครื่องมือ → ลำดับบนจอตรงกับลำดับโฟกัส และตัวเลข 99+ ไม่ดันเครื่องมือตกบรรทัด */
    .mx-find { flex: 1 1 calc(100% - 120px); min-width: 0; margin-left: 0; }
    /* ช่องค้นไม่ได้ชิดขวาจอแล้ว (เครื่องมืออยู่ทางขวา) → ข้อความใต้ช่องยึดขอบซ้ายของช่อง ไม่หลุดขอบซ้ายจอ */
    .mx-find-msg { left: 0; right: auto; }
    .mx-find + .mx-tools { margin-left: auto; }
    .mx-find input { flex: 1 1 auto; width: auto; min-width: 0; }
    .mx-content { padding: 0 16px; margin-top: 18px; }
    .mx-page-head, .mx-row-card, .mx-pipe-card, .mx-section-head { align-items: stretch; flex-direction: column; }
    .mx-page-actions { justify-content: flex-start; }
    .mx-page-head h1 { font-size: 21px; }
    .mx-card-actions, .mx-range { flex-wrap: wrap; }
    .mx-prompt-box, .mx-metric-inputs, .mx-form-grid, .mx-approval-card, .mx-gallery-fields { grid-template-columns: 1fr; }
    .mx-gallery-prompt-head { display: grid; }
    .mx-gallery-prompt-head span { text-align: left; }
    .mx-approval-media-column { max-width: 260px; }
    .mx-calendar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .mx-weekday, .mx-day-empty { display: none; }
    .mx-page::before, .mx-page::after { opacity: .4; }
  }
  @media (max-width: 360px) {
    /* จอ 320–360px: แท็บ 3 อันชิดกันขึ้น แถวแรกไม่ล้นแม้ตัวเลขยาว */
    .mx-tabs { gap: 0; }
    .mx-tab, .mx-tools > summary { padding: 8px 6px; gap: 4px; }
    .mx-tab strong { padding: 0 5px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .mx-page *, .mx-page *::before, .mx-page *::after, .mx-page::before, .mx-page::after { animation: none !important; transition: none !important; }
  }
`

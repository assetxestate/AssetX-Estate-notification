import imageHandler from '../server/marketing-image.js'
import videoHandler from '../server/marketing-video.js'
import referencesHandler from '../server/marketing-references.js'
import radarHandler from '../server/marketing-radar.js'
import knowledgeSaveHandler from '../server/marketing-knowledge-save.js'
import facebookHandler from '../server/marketing-facebook.js'
import ideasHandler from '../server/marketing-ideas.js'
import noticesHandler from '../server/notices.js'
import diaryHandler from '../server/diary.js'
import paymentAdditionsHandler from '../server/paymentAdditions.js'

const handlers = {
  notices: noticesHandler,
  // ไดอารี่งานอยู่ในฟังก์ชันนี้ด้วยเหตุผลเดียวกับ notices: จำกัดจำนวน serverless function บน Vercel
  diary: diaryHandler,
  // ชำระเพิ่ม/ยกเว้นส่วนที่ขาดของงวดดอกเบี้ย (ตาราง payment_additions) — อยู่ที่นี่ด้วยเหตุผลเดียวกัน
  'payment-additions': paymentAdditionsHandler,
  image: imageHandler,
  video: videoHandler,
  references: referencesHandler,
  radar: radarHandler,
  'knowledge-save': knowledgeSaveHandler,
  facebook: facebookHandler,
  // คิวไอเดียจากระบบรีเสิร์ช (research/ + scripts/research-ideas.mjs) — ตาราง marketing_ideas
  ideas: ideasHandler,
}

function inferFeature(req) {
  const url = new URL(req.url || '/', 'http://assetx.local')
  const feature = url.searchParams.get('feature')
  if (feature) return feature

  const path = url.pathname.replace(/\/+$/, '')
  if (path.endsWith('/notices')) return 'notices'
  if (path.endsWith('/diary')) return 'diary'
  if (path.endsWith('/payment-additions')) return 'payment-additions'
  if (path.endsWith('/marketing-image')) return 'image'
  if (path.endsWith('/marketing-video')) return 'video'
  if (path.endsWith('/marketing-references')) return 'references'
  if (path.endsWith('/marketing-radar')) return 'radar'
  if (path.endsWith('/marketing-knowledge-save')) return 'knowledge-save'
  if (path.endsWith('/marketing-facebook')) return 'facebook'
  if (path.endsWith('/marketing-ideas')) return 'ideas'
  return ''
}

export default async function handler(req, res) {
  const feature = inferFeature(req)
  // เฉพาะชื่อที่ประกาศไว้จริง (?feature=constructor / toString จะไปเจอเมธอดของ Object แล้วค้างไม่ตอบ)
  const routeHandler = Object.hasOwn(handlers, feature || '') ? handlers[feature] : null
  if (!routeHandler) {
    return res.status(404).json({ error: 'Unknown marketing endpoint' })
  }
  return routeHandler(req, res)
}

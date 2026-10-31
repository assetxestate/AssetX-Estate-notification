import imageHandler from '../server/marketing-image.js'
import videoHandler from '../server/marketing-video.js'
import referencesHandler from '../server/marketing-references.js'
import radarHandler from '../server/marketing-radar.js'
import knowledgeSaveHandler from '../server/marketing-knowledge-save.js'
import facebookHandler from '../server/marketing-facebook.js'
import noticesHandler from '../server/notices.js'
import diaryHandler from '../server/diary.js'

const handlers = {
  notices: noticesHandler,
  // ไดอารี่งานอยู่ในฟังก์ชันนี้ด้วยเหตุผลเดียวกับ notices: จำกัดจำนวน serverless function บน Vercel
  diary: diaryHandler,
  image: imageHandler,
  video: videoHandler,
  references: referencesHandler,
  radar: radarHandler,
  'knowledge-save': knowledgeSaveHandler,
  facebook: facebookHandler,
}

function inferFeature(req) {
  const url = new URL(req.url || '/', 'http://assetx.local')
  const feature = url.searchParams.get('feature')
  if (feature) return feature

  const path = url.pathname.replace(/\/+$/, '')
  if (path.endsWith('/notices')) return 'notices'
  if (path.endsWith('/diary')) return 'diary'
  if (path.endsWith('/marketing-image')) return 'image'
  if (path.endsWith('/marketing-video')) return 'video'
  if (path.endsWith('/marketing-references')) return 'references'
  if (path.endsWith('/marketing-radar')) return 'radar'
  if (path.endsWith('/marketing-knowledge-save')) return 'knowledge-save'
  if (path.endsWith('/marketing-facebook')) return 'facebook'
  return ''
}

export default async function handler(req, res) {
  const feature = inferFeature(req)
  const routeHandler = handlers[feature]
  if (!routeHandler) {
    return res.status(404).json({ error: 'Unknown marketing endpoint' })
  }
  return routeHandler(req, res)
}

import imageHandler from '../server/marketing-image.js'
import videoHandler from '../server/marketing-video.js'
import referencesHandler from '../server/marketing-references.js'
import radarHandler from '../server/marketing-radar.js'
import knowledgeSaveHandler from '../server/marketing-knowledge-save.js'

const handlers = {
  image: imageHandler,
  video: videoHandler,
  references: referencesHandler,
  radar: radarHandler,
  'knowledge-save': knowledgeSaveHandler,
}

function inferFeature(req) {
  const url = new URL(req.url || '/', 'http://assetx.local')
  const feature = url.searchParams.get('feature')
  if (feature) return feature

  const path = url.pathname.replace(/\/+$/, '')
  if (path.endsWith('/marketing-image')) return 'image'
  if (path.endsWith('/marketing-video')) return 'video'
  if (path.endsWith('/marketing-references')) return 'references'
  if (path.endsWith('/marketing-radar')) return 'radar'
  if (path.endsWith('/marketing-knowledge-save')) return 'knowledge-save'
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

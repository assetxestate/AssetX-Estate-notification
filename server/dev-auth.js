import login from '../api/login.js'
import logout from '../api/logout.js'
import lineWebhook from '../api/line-webhook.js'

export function devAuthMiddleware(req, res, next) {
  const pathname = req.url.split('?')[0]
  const lineAction = new URL(req.url, 'http://localhost').searchParams.get('action')
  const handler = pathname === '/api/login' ? login : pathname === '/api/logout' ? logout
    : pathname === '/api/line-webhook' && ['send', 'check'].includes(lineAction) ? lineWebhook : null
  if (!handler) return next()
  if (handler === lineWebhook) req.query = { action: lineAction }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)) }
  const run = () => Promise.resolve(handler(req, res)).catch(() => res.status(500).json({ error: 'Authentication failed' }))
  if (req.method !== 'POST') return run()
  let body = ''
  req.on('data', (chunk) => {
    if (res.writableEnded) return
    body += chunk
    if (body.length > 16384 && !res.writableEnded) res.status(413).json({ error: 'Request too large' })
  })
  req.on('end', () => {
    if (res.writableEnded) return
    try { req.body = JSON.parse(body || '{}') }
    catch { return res.status(400).json({ error: 'Invalid JSON' }) }
    return run()
  })
}

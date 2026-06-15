// Vercel serverless function — proxy สำหรับ catalog.treasury.go.th (หลีก CORS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  const rawUrl = req.query.url
  if (!rawUrl) return res.status(400).json({ error: 'Missing url parameter' })

  const targetUrl = decodeURIComponent(rawUrl)
  if (!targetUrl.startsWith('https://catalog.treasury.go.th/')) {
    return res.status(400).json({ error: 'URL ต้องเป็น catalog.treasury.go.th เท่านั้น' })
  }

  try {
    const upstream = await fetch(targetUrl)
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream HTTP ${upstream.status}` })
    }
    const data = await upstream.json()
    res.setHeader('Cache-Control', 'public, s-maxage=3600') // cache 1 ชั่วโมง
    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

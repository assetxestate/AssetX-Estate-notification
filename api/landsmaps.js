// Vercel serverless proxy — กรมที่ดิน LandsMaps API
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  const { action, provCode, ampCode, deedNo } = req.query
  const BASE = 'https://landsmaps.dol.go.th/apiService/LandsMaps'
  const HEADERS = { 'Accept': 'application/json', 'Referer': 'https://landsmaps.dol.go.th/' }

  try {
    if (action === 'amphoe') {
      if (!provCode) return res.status(400).json({ error: 'Missing provCode' })
      const r = await fetch(`${BASE}/GetAmphoeByProvinceId/${provCode}`, { headers: HEADERS })
      if (!r.ok) return res.status(r.status).json({ error: `HTTP ${r.status}` })
      const data = await r.json()
      res.setHeader('Cache-Control', 'public, s-maxage=86400')
      return res.status(200).json(data)
    }

    if (!provCode || !ampCode || !deedNo) {
      return res.status(400).json({ error: 'Missing provCode, ampCode, or deedNo' })
    }
    const r = await fetch(`${BASE}/GetParcelByParcelNo/${provCode}/${ampCode}/${deedNo}`, { headers: HEADERS })
    if (!r.ok) return res.status(r.status).json({ error: `HTTP ${r.status}` })
    const data = await r.json()
    res.setHeader('Cache-Control', 'public, s-maxage=86400')
    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

import { verifySession } from '../api/_auth.js'

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search'

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

function scoreResult(result, index) {
  const text = `${result.title || ''} ${result.content || ''}`.toLowerCase()
  let score = 74 - index * 3
  if (/ดอกเบี้ย|สินเชื่อ|จำนอง|ขายฝาก|อสังหา|ที่ดิน|ลงทุน|ภาษี/.test(text)) score += 10
  if (/2569|2026|ล่าสุด|แนวโน้ม|ตลาด/.test(text)) score += 6
  return Math.max(45, Math.min(96, score))
}

function toIdeas(data) {
  const results = Array.isArray(data?.results) ? data.results : []
  return results.slice(0, 6).map((result, index) => {
    const title = cleanText(result.title || `ประเด็นตลาดอสังหา ${index + 1}`)
    const summary = cleanText(result.content || data?.answer || '')
    const sourceHost = (() => {
      try { return new URL(result.url).hostname.replace(/^www\./, '') } catch { return 'Tavily' }
    })()
    return {
      id: `radar-${Date.now()}-${index}`,
      source: `Tavily · ${sourceHost}`,
      type: 'Trend Radar',
      score: scoreResult(result, index),
      title: title.length > 86 ? `${title.slice(0, 83)}...` : title,
      angle: summary
        ? `${summary.slice(0, 180)}${summary.length > 180 ? '...' : ''}`
        : 'นำข่าว/บทความนี้มาทำเป็นคอนเทนต์ให้ความรู้หรือ checklist สำหรับเจ้าของทรัพย์และนักลงทุน',
      audience: index % 2 === 0 ? 'เจ้าของทรัพย์' : 'นักลงทุน',
      channel: index % 3 === 0 ? 'Facebook + LINE OA' : 'Facebook',
      status: 'ไอเดียจากตลาดจริง',
      url: result.url || '',
    }
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  if (!verifySession(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })

  try {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า TAVILY_API_KEY บน server')

    const niche = cleanText(req.body?.niche || 'อสังหาริมทรัพย์ไทย ขายฝาก จำนอง ที่ดิน นักลงทุน เจ้าของทรัพย์')
    const query = `แนวโน้มตลาด ${niche} ล่าสุด 2569 2026 ประเด็นที่ควรทำคอนเทนต์เพื่อหา lead เจ้าของทรัพย์ นักลงทุน`
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'advanced',
        chunks_per_source: 2,
        topic: 'general',
        max_results: 8,
        include_answer: 'advanced',
        include_raw_content: false,
        include_favicon: true,
        country: 'thailand',
        language: 'th',
        filter_by_language: false,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data?.error || data?.message || data?.detail?.error || `Tavily API ${response.status}`)
    }

    const ideas = toIdeas(data)
    return res.status(200).json({
      success: true,
      query,
      answer: cleanText(data?.answer || ''),
      ideas,
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'ดึง Trend Radar ไม่สำเร็จ',
    })
  }
}

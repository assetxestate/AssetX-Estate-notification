import { verifySession } from '../api/_auth.js'

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search'

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

function hostFromUrl(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function inferSourceId(url = '', title = '') {
  const text = `${url} ${title}`.toLowerCase()
  if (text.includes('facebook.com') || text.includes('instagram.com') || text.includes('meta.com')) return 'meta-ads'
  if (text.includes('tiktok.com')) return 'tiktok-top-ads'
  if (text.includes('pinterest.')) return 'pinterest-search'
  return 'google-creative'
}

function inferAudience(text = '') {
  const value = text.toLowerCase()
  if (/investor|ลงทุน|นักลงทุน|yield|ผลตอบแทน/.test(value)) return 'นักลงทุน'
  if (/ขาย|owner|เจ้าของ|โฉนด|ที่ดิน|ขายฝาก|จำนอง/.test(value)) return 'เจ้าของทรัพย์'
  return 'เจ้าของทรัพย์'
}

function inferChannel(sourceId, text = '') {
  if (sourceId === 'tiktok-top-ads') return 'TikTok / Reels'
  if (/line|ไลน์/.test(text.toLowerCase())) return 'LINE OA'
  return 'Facebook'
}

function inferRisk(text = '') {
  if (/อนุมัติแน่นอน|ได้เงินทันที|รับประกัน|กำไรแน่นอน|ไม่เช็ค/.test(text)) return 'high'
  if (/โฆษณา|ads|ad library|creative|competitor|คู่แข่ง/.test(text.toLowerCase())) return 'medium'
  return 'low'
}

function buildTags(text = '', sourceId) {
  const tags = new Set()
  tags.add('reference')
  if (sourceId === 'tiktok-top-ads') tags.add('video')
  if (sourceId === 'pinterest-search') tags.add('visual')
  if (/ขายฝาก/.test(text)) tags.add('ขายฝาก')
  if (/จำนอง/.test(text)) tags.add('จำนอง')
  if (/โฉนด|ที่ดิน|land/i.test(text)) tags.add('ที่ดิน')
  if (/ลงทุน|investor/i.test(text)) tags.add('นักลงทุน')
  if (/ตลาด|แนวโน้ม|trend/i.test(text)) tags.add('trend')
  return Array.from(tags).slice(0, 8)
}

function toReferences(data) {
  const results = Array.isArray(data?.results) ? data.results : []
  return results.slice(0, 10).map((result, index) => {
    const title = cleanText(result.title || `Reference ตลาดอสังหา ${index + 1}`)
    const content = cleanText(result.content || data?.answer || '')
    const text = `${title} ${content}`
    const url = result.url || ''
    const sourceId = inferSourceId(url, title)
    const host = hostFromUrl(url)
    return {
      id: `auto-ref-${Date.now()}-${index}`,
      title: title.length > 96 ? `${title.slice(0, 93)}...` : title,
      url,
      sourceId,
      hook: content
        ? `${content.slice(0, 170)}${content.length > 170 ? '...' : ''}`
        : 'ใช้หัวข้อนี้เป็น hook เพื่อเปิดประเด็นความต้องการของเจ้าของทรัพย์หรือนักลงทุน',
      visualPattern: sourceId === 'tiktok-top-ads'
        ? 'วิดีโอสั้นแนวปัญหา-ทางเลือก-ชวนส่งข้อมูล ใช้ภาพจริงหรือ b-roll อสังหาโดยไม่เปิดเผยข้อมูลส่วนตัว'
        : 'ภาพสมจริงแนวที่ปรึกษาอสังหา โต๊ะเอกสาร โฉนดที่ปิดข้อมูล แผนที่ แสงธรรมชาติ และพื้นที่ว่างสำหรับข้อความ',
      contentAngle: content
        ? `ถอดประเด็นจาก ${host || 'แหล่งข้อมูล'} เป็นคอนเทนต์ให้ความรู้/สร้าง lead ของ AssetX โดยไม่ลอกข้อความต้นทาง`
        : 'สร้างคอนเทนต์ใหม่ในโทน AssetX จาก pattern ของ reference นี้',
      audience: inferAudience(text),
      channel: inferChannel(sourceId, text),
      risk: inferRisk(text),
      tags: buildTags(text, sourceId),
      notes: host ? `ดึงจาก Tavily: ${host}` : 'ดึงจาก Tavily',
      createdAt: new Date().toISOString(),
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

    const queryInput = cleanText(req.body?.query || 'ขายฝาก โฉนด ที่ดิน เงินก้อน')
    const query = [
      queryInput,
      'real estate social media ad creative reference Thailand',
      'property loan mortgage land investment Facebook TikTok Pinterest',
      'content hook visual pattern marketing',
    ].join(' ')

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
        max_results: 10,
        include_answer: 'basic',
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

    const references = toReferences(data)
    return res.status(200).json({
      success: true,
      query,
      references,
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'ดึง Creative Radar ไม่สำเร็จ',
    })
  }
}

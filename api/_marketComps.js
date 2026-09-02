const TAVILY_SEARCH_URL = 'https://api.tavily.com/search'
const DEFAULT_RECENCY_DAYS = 365

function compactText(value, max = 1800) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function toNumber(value) {
  const n = Number(String(value || '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function daysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return formatDate(date)
}

function extractYear(text) {
  const normalized = compactText(text)
  const years = [...normalized.matchAll(/(?:20\d{2}|25\d{2})/g)]
    .map(match => Number(match[0]))
    .map(year => year >= 2500 ? year - 543 : year)
    .filter(year => year >= 2020 && year <= new Date().getFullYear() + 1)
  return years.length ? Math.max(...years) : null
}

function extractPricePerSqw(text) {
  const normalized = compactText(text)
  const patterns = [
    /(\d[\d,]*(?:\.\d+)?)\s*(?:บาท|บ\.?)\s*\/?\s*(?:ตร\.?\s*ว\.?|ตารางวา|sqw)/i,
    /(?:ตร\.?\s*ว\.?|ตารางวา|sqw)\s*(?:ละ|ราคา)?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:บาท|บ\.?)/i,
  ]
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    const price = match ? toNumber(match[1]) : null
    if (price && price >= 100 && price <= 2000000) return Math.round(price)
  }
  return null
}

function hasAny(text, keywords = []) {
  return keywords.some(keyword => text.includes(keyword))
}

function classifyTargetBasis(valuation = {}) {
  const subtype = compactText(valuation.propertySubtype)
  const propertyType = compactText(valuation.propertyType)

  if (propertyType.includes('คอนโด') || subtype.includes('คอนโด') || subtype.includes('อาคารชุด')) {
    return { key: 'condo', label: 'อาคารชุด / คอนโด' }
  }
  if (subtype.includes('ที่ดินเปล่า')) {
    return { key: 'land_only', label: 'ที่ดินเปล่า' }
  }
  if (subtype.includes('พร้อมสิ่งปลูกสร้าง')) {
    return { key: 'land_with_building', label: 'ที่ดินพร้อมสิ่งปลูกสร้าง' }
  }
  if (
    propertyType.includes('ที่อยู่อาศัย') ||
    propertyType.includes('พาณิชยกรรม') ||
    hasAny(subtype, ['บ้าน', 'ทาวน์', 'ตึกแถว', 'อาคาร', 'สำนักงาน', 'ศูนย์การค้า'])
  ) {
    return { key: 'improved_property', label: subtype || propertyType || 'ทรัพย์พร้อมสิ่งปลูกสร้าง' }
  }
  return { key: 'unknown', label: subtype || propertyType || 'ไม่ระบุประเภททรัพย์ย่อย' }
}

function classifySourceBasis(text) {
  const content = compactText(text, 4000)
  const vacantLandSignals = ['ที่ดินเปล่า', 'ขายที่ดินเปล่า', 'ที่ดินว่าง', 'เปล่า', 'ถมแล้ว', 'ยังไม่ปลูกสร้าง']
  const condoSignals = ['คอนโด', 'อาคารชุด', 'ห้องชุด', 'ตร.ม.', 'ตารางเมตร']
  const buildingSignals = [
    'บ้านเดี่ยว', 'บ้านแฝด', 'ทาวน์เฮ้าส์', 'ทาวน์โฮม', 'ตึกแถว', 'อาคารพาณิชย์',
    'อาคาร', 'โกดัง', 'โรงงาน', 'สำนักงาน', 'หอพัก', 'รีสอร์ท', 'สิ่งปลูกสร้าง',
    'พร้อมบ้าน', 'พร้อมอาคาร', 'บ้านพร้อมที่ดิน',
  ]

  const hasCondo = hasAny(content, condoSignals)
  const hasBuilding = hasAny(content, buildingSignals)
  const hasVacantLand = hasAny(content, vacantLandSignals)

  if (hasCondo) return { key: 'condo', label: 'อาคารชุด / คอนโด' }
  if (hasBuilding) return { key: 'includes_building', label: 'อาจรวมสิ่งปลูกสร้าง' }
  if (hasVacantLand) return { key: 'land_only', label: 'ที่ดินเปล่า' }
  return { key: 'unclear', label: 'ยังไม่ชัดเจน' }
}

function basisMatches(targetBasis, sourceBasis) {
  if (targetBasis.key === 'unknown') return sourceBasis.key !== 'condo'
  if (targetBasis.key === 'land_only') return sourceBasis.key === 'land_only'
  if (targetBasis.key === 'condo') return sourceBasis.key === 'condo'
  if (targetBasis.key === 'land_with_building' || targetBasis.key === 'improved_property') {
    return sourceBasis.key === 'includes_building' || sourceBasis.key === 'unclear'
  }
  return false
}

function isNearbyComparisonCandidate(content, checks) {
  return (
    checks.hasSubdistrict ||
    (checks.hasDistrict && checks.hasPlotDetail) ||
    hasAny(content, ['ติดกัน', 'ใกล้เคียง', 'ใกล้', 'ข้างเคียง', 'บริเวณเดียวกัน', 'แปลงข้าง', 'แปลงติด'])
  )
}

function scoreSource(item, valuation = {}) {
  const content = compactText([item.title, item.content, item.raw_content].filter(Boolean).join(' '), 4000)
  const lowerUrl = String(item.url || '').toLowerCase()
  const extractedYear = extractYear(content)
  const currentYear = new Date().getFullYear()
  const province = compactText(valuation.province)
  const district = compactText(valuation.district)
  const subdistrict = compactText(valuation.subdistrict)
  const targetBasis = classifyTargetBasis(valuation)
  const sourceBasis = classifySourceBasis(content)

  const checks = {
    hasPrice: !!extractPricePerSqw(content),
    hasProvince: province ? content.includes(province) : false,
    hasDistrict: district ? content.includes(district) : false,
    hasSubdistrict: subdistrict ? content.includes(subdistrict) : false,
    hasArea: hasAny(content, ['ตร.ว', 'ตารางวา', 'ไร่', 'งาน', 'เนื้อที่', 'พื้นที่']),
    hasRoadOrAccess: hasAny(content, ['ถนน', 'ซอย', 'ทางเข้า', 'หน้ากว้าง', 'ติดถนน']),
    hasPlotDetail: hasAny(content, ['โฉนด', 'เลขที่ดิน', 'ระวาง', 'พิกัด', 'ละติจูด', 'ลองจิจูด', 'แผนที่']),
    hasRecentSignal: !!item.published_date || !!item.publishedDate || !extractedYear || extractedYear >= currentYear - 1,
    isListingSite: /(ddproperty|fazwaz|hipflat|livinginsider|baania|kaidee|dotproperty|prakardproperty|propertyhub|zmyhome|teedin108|landsmaps)/.test(lowerUrl),
    basisMatches: basisMatches(targetBasis, sourceBasis),
    basisClear: sourceBasis.key !== 'unclear',
  }
  checks.isNearbyComparison = isNearbyComparisonCandidate(content, checks)

  const score =
    (checks.hasPrice ? 30 : 0) +
    (checks.hasProvince ? 12 : 0) +
    (checks.hasDistrict ? 14 : 0) +
    (checks.hasSubdistrict ? 12 : 0) +
    (checks.hasArea ? 10 : 0) +
    (checks.hasRoadOrAccess ? 8 : 0) +
    (checks.hasPlotDetail ? 8 : 0) +
    (checks.hasRecentSignal ? 4 : -18) +
    (checks.isListingSite ? 2 : 0) +
    (checks.basisMatches ? 16 : -28) +
    (checks.basisClear ? 4 : -8)

  const missing = []
  if (!checks.hasPrice) missing.push('ไม่มีราคาต่อ ตร.ว.')
  if (district && !checks.hasDistrict) missing.push('ไม่พบอำเภอ/เขตตรงกัน')
  if (subdistrict && !checks.hasSubdistrict) missing.push('ไม่พบตำบล/แขวงตรงกัน')
  if (!checks.hasArea) missing.push('ไม่พบขนาดที่ดิน')
  if (!checks.hasPlotDetail) missing.push('รายละเอียดแปลงยังไม่ครบ')
  if (!checks.hasRecentSignal) missing.push('อาจเป็นข้อมูลเก่า')
  if (!checks.basisClear) missing.push('ไม่ชัดว่าเป็นที่ดินเปล่าหรือรวมสิ่งปลูกสร้าง')
  if (!checks.basisMatches) missing.push(`ประเภทไม่ตรงกับ ${targetBasis.label}`)

  const quality = checks.basisMatches ? (score >= 70 ? 'strong' : score >= 48 ? 'usable' : 'weak') : 'weak'
  const comparisonRole = checks.basisMatches ? 'primary_comp' : (checks.isNearbyComparison ? 'nearby_cross_basis' : 'review_only')
  return { score, quality, checks, missing, extractedYear, targetBasis, sourceBasis, comparisonRole }
}

function buildQuery(valuation = {}) {
  const targetBasis = classifyTargetBasis(valuation)
  const location = [
    valuation.subdistrict ? `ต.${valuation.subdistrict}` : '',
    valuation.district ? `อ.${valuation.district}` : '',
    valuation.province || '',
  ].filter(Boolean).join(' ')
  const type = valuation.propertySubtype || valuation.propertyType || 'ที่ดิน'
  const area = valuation.totalSqw ? `${Math.round(Number(valuation.totalSqw))} ตารางวา` : ''
  const road = valuation.roadType || ''
  const basisTerms = {
    land_only: 'ที่ดินเปล่า ไม่มีสิ่งปลูกสร้าง land only',
    land_with_building: 'ที่ดินพร้อมสิ่งปลูกสร้าง บ้านพร้อมที่ดิน',
    improved_property: 'บ้านพร้อมที่ดิน อาคารพร้อมที่ดิน',
    condo: 'คอนโด อาคารชุด ห้องชุด ราคาต่อตารางเมตร',
    unknown: '',
  }[targetBasis.key]

  return compactText([
    'ราคาตลาดล่าสุด',
    'ประกาศขายปัจจุบัน',
    type,
    basisTerms,
    location,
    area,
    road,
    'บาทต่อตารางวา',
    'เนื้อที่ โฉนด พิกัด ถนน แผนที่',
    '2568 2569',
  ].filter(Boolean).join(' '))
}

function summarizeResults(results = [], valuation = {}) {
  const targetBasis = classifyTargetBasis(valuation)
  const sources = results.slice(0, 12).map((item) => {
    const content = compactText([item.title, item.content, item.raw_content].filter(Boolean).join(' '))
    const quality = scoreSource(item, valuation)
    return {
      title: compactText(item.title, 160),
      url: item.url,
      content: compactText(item.content || item.raw_content, 520),
      score: item.score || null,
      publishedDate: item.published_date || item.publishedDate || null,
      pricePerSqw: extractPricePerSqw(content),
      qualityScore: quality.score,
      quality: quality.quality,
      qualityChecks: quality.checks,
      missing: quality.missing,
      extractedYear: quality.extractedYear,
      assetBasis: quality.sourceBasis,
      comparisonRole: quality.comparisonRole,
    }
  }).sort((a, b) => b.qualityScore - a.qualityScore)

  const qualifiedSources = sources.filter(source => (
    source.pricePerSqw &&
    source.quality !== 'weak' &&
    source.qualityChecks.hasRecentSignal &&
    source.qualityChecks.hasArea &&
    source.qualityChecks.basisMatches
  ))
  const nearbyDifferentBasisSources = sources.filter(source => (
    source.comparisonRole === 'nearby_cross_basis' &&
    source.pricePerSqw &&
    source.qualityChecks.hasRecentSignal
  ))

  const priceSources = qualifiedSources.length ? qualifiedSources : sources.filter(source => source.pricePerSqw)
  const prices = priceSources.map((source) => source.pricePerSqw).filter(Boolean)
  const sorted = [...prices].sort((a, b) => a - b)
  const avg = sorted.length ? Math.round(sorted.reduce((sum, n) => sum + n, 0) / sorted.length) : null

  return {
    targetBasis,
    sources,
    qualifiedSources,
    nearbyDifferentBasisSources,
    priceSummary: sorted.length ? {
      low: sorted[0],
      median: sorted[Math.floor(sorted.length / 2)],
      high: sorted[sorted.length - 1],
      average: avg,
      sampleSize: sorted.length,
      qualifiedSampleSize: qualifiedSources.length,
      usesFallbackSamples: qualifiedSources.length === 0,
    } : null,
  }
}

export async function fetchMarketComps({
  valuation = {},
  apiKey = process.env.TAVILY_API_KEY,
  recencyDays = DEFAULT_RECENCY_DAYS,
} = {}) {
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า TAVILY_API_KEY บน server')
  }

  const query = buildQuery(valuation)
  const startDate = daysAgo(recencyDays)
  const endDate = formatDate(new Date())
  const response = await fetch(TAVILY_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: 'advanced',
      chunks_per_source: 3,
      topic: 'general',
      start_date: startDate,
      end_date: endDate,
      max_results: 12,
      include_answer: 'advanced',
      include_raw_content: 'text',
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

  const summary = summarizeResults(data.results || [], valuation)
  return {
    query,
    recency: {
      days: recencyDays,
      startDate,
      endDate,
    },
    answer: compactText(data.answer, 1200),
    searchedAt: new Date().toISOString(),
    ...summary,
    note: 'คัดกรองเบื้องต้นด้วยความสดของข้อมูลและความครบของรายละเอียดแปลงแล้ว แต่ข้อมูลเว็บส่วนใหญ่ยังเป็นราคาประกาศขาย ไม่ใช่ราคาซื้อขายจริง ควรตรวจซ้ำก่อนใช้อนุมัติ',
  }
}

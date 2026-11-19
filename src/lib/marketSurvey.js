// สำรวจราคาตลาดจากประกาศขายบนอินเทอร์เน็ต (เจ้าของ 18 พ.ย. 2569: ให้ AI สำรวจทุกช่องทาง · ประกาศที่เปิดหน้าเว็บจริงไม่ได้ให้ตัดออก)
// ไฟล์นี้เป็นโค้ดล้วน ใช้ทั้งฝั่งเว็บ เซิร์ฟเวอร์ และตัวรับงานบนคอมสำนักงาน:
//   buildSurveyRequest  → ข้อมูลทรัพย์เท่าที่จำเป็นต่อการค้น (ระดับแขวง/เขต ไม่มีเลขโฉนด พิกัด ชื่อ เบอร์)
//   buildSurveyPrompt   → คำสั่งให้ Codex ค้นและเปิดหน้าประกาศรายแปลง
//   parseSurveyResult   → ตรวจคำตอบของ AI ทีละรายการ ตัดรายการที่ข้อมูลไม่ครบ คำนวณราคาต่อตารางวาเอง
//   summarizeSurvey     → ช่วงราคาต่ำ-กลาง-สูงจากรายการที่เจ้าของเลือก หักส่วนลดต่อรอง
// ราคาที่ได้เป็นราคาตั้งขาย ไม่ใช่ราคาซื้อขายจริง — เจ้าของเป็นคนเลือกรายการที่ใช้เสมอ ระบบไม่ตั้งราคาตลาดเอง

export const SURVEY_MAX_LISTINGS = 25
const text = (v, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const num = (v) => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0 }

// ประเภททรัพย์สำหรับเทียบ: ที่ดินเปล่า กับ ที่ดินพร้อมสิ่งปลูกสร้าง เทียบราคาต่อตารางวากันตรง ๆ ไม่ได้ (ราคารวมค่าสิ่งปลูกสร้าง)
export function assetBasisOf(label) {
  const s = text(label)
  if (/คอนโด|ห้องชุด|อาคารชุด/.test(s)) return 'condo'
  if (/เปล่า/.test(s) && !/พร้อม/.test(s)) return 'land'
  if (/สิ่งปลูกสร้าง|บ้าน|ทาวน์|ตึก|อาคาร|โกดัง|โรงงาน|รีสอร์ท|หอพัก|อพาร์ต/.test(s)) return 'building'
  return 'land'
}
export const ASSET_BASIS_LABEL = { land: 'ที่ดินเปล่า', building: 'ที่ดินพร้อมสิ่งปลูกสร้าง', condo: 'ห้องชุด' }

export function buildSurveyRequest(form = {}, { totalSqw = 0, govPricePerSqw = 0 } = {}) {
  return {
    province: text(form.province, 60), district: text(form.district, 60), subdistrict: text(form.subdistrict, 60),
    property: text(form.propertySubtype || form.propertyType, 80),
    basis: assetBasisOf(form.propertySubtype || form.propertyType),
    total_sqw: Math.round(num(totalSqw) * 10) / 10,
    gov_price_per_sqw: Math.round(num(govPricePerSqw)),
    road: text(form.roadType, 60),
  }
}

// ข้อมูลพอให้ค้นได้หรือยัง → ข้อความบอกสิ่งที่ขาด (ว่าง = พร้อม)
export function surveyRequestProblem(request = {}) {
  if (!request.province || !request.district) return 'เลือกจังหวัดและอำเภอ/เขตของทรัพย์ในขั้นที่ 1 ก่อน'
  if (!(request.total_sqw > 0)) return 'กรอกเนื้อที่ของทรัพย์ในขั้นที่ 1 ก่อน'
  return ''
}

export function buildSurveyPrompt(request = {}) {
  const bangkok = request.province === 'กรุงเทพมหานคร'
  const place = [request.subdistrict && `${bangkok ? 'แขวง' : 'ตำบล'}${request.subdistrict}`, `${bangkok ? 'เขต' : 'อำเภอ'}${request.district}`, bangkok ? request.province : `จังหวัด${request.province}`].filter(Boolean).join(' ')
  const sqw = request.total_sqw
  const lo = Math.max(20, Math.round(sqw * 0.4)), hi = Math.round(sqw * 2.5)
  return [
    'คุณเป็นผู้ช่วยสำรวจราคาตลาดอสังหาริมทรัพย์ไทย ใช้เครื่องมือค้นเว็บของคุณ ห้ามรันคำสั่ง shell',
    '',
    `ทรัพย์เป้าหมาย: ${request.property || 'ที่ดิน'} เนื้อที่ราว ${sqw} ตารางวา ${place}` + (request.road ? ` ลักษณะถนน: ${request.road}` : '') + (request.gov_price_per_sqw ? ` (ราคาประเมินราชการของที่ดิน ${request.gov_price_per_sqw.toLocaleString('en-US')} บาทต่อตารางวา)` : ''),
    '',
    `งาน: สำรวจประกาศขายที่ยังเปิดอยู่บนอินเทอร์เน็ตทุกช่องทางที่หาได้ (DDproperty, Livinginsider, PropertyHub, Hipflat, Baania, Kaidee, Meezub, เว็บนายหน้า, ทรัพย์สินรอการขายของธนาคาร ฯลฯ) ของที่ดินเปล่าและที่ดินพร้อมสิ่งปลูกสร้างใน${bangkok ? 'เขต' : 'อำเภอ'}เดียวกับทรัพย์เป้าหมายเท่านั้น ขนาดราว ${lo}–${hi} ตารางวา เรียงรายการที่ใกล้และคล้ายทรัพย์เป้าหมายที่สุดก่อน ไม่เกิน ${SURVEY_MAX_LISTINGS} รายการ`,
    '',
    'กติกาเข้ม:',
    '- นับเฉพาะประกาศรายแปลงที่คุณเปิดหน้าเว็บนั้นจริงและเห็นราคากับเนื้อที่ดินบนหน้า หน้ารวมรายการหรือผลค้นหาไม่นับ',
    '- ประกาศที่เปิดไม่ได้ ปิดการขายแล้ว หรือไม่เห็นราคา/เนื้อที่บนหน้า ให้ใส่ใน rejected พร้อมเหตุผล ห้ามเดาหรือเติมตัวเลขเอง',
    '- ประกาศเดียวกันที่ลงหลายเว็บให้นับครั้งเดียว',
    `- ประกาศที่อยู่${bangkok ? 'เขต' : 'อำเภอ'}อื่น แม้จะติดกัน ห้ามใส่ใน listings (คนละพื้นที่เทียบกันไม่ได้) · ช่อง location ต้องมีชื่อ${bangkok ? 'เขต' : 'อำเภอ'}ตามหน้าประกาศเสมอ`,
    '- ห้ามใส่ชื่อ เบอร์โทร หรือ LINE ของผู้ประกาศในคำตอบ',
    '',
    'ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ไม่มี code fence รูปแบบ:',
    '{"listings":[{"url":"","site":"","title":"","asset":"ที่ดินเปล่า|ที่ดินพร้อมสิ่งปลูกสร้าง","price_baht":0,"area_sqw":0,"location":"แขวง/ตำบล เขต/อำเภอ","road":"ถนนหรือซอยตามประกาศ","building":"สิ่งปลูกสร้างโดยย่อ ถ้ามี","posted":"วันที่ลงหรืออัปเดตตามหน้าเว็บ ถ้ามี","opened_page":true,"evidence":"ข้อความสั้นจากหน้าที่มีราคาและเนื้อที่"}],"rejected":[{"url":"","reason":""}],"notes":""}',
  ].join('\n')
}

// ลบเบอร์โทรและ LINE ID ที่อาจหลุดมากับข้อความประกาศ
const scrubContact = (s) => text(s, 400).replace(/(?:\+66|0)[\s-]?\d(?:[\s-]?\d){7,8}/g, '[เบอร์]').replace(/(?:line|ไลน์)\s*(?:id)?\s*[:：@]?\s*@?[\w.-]{3,}/gi, '[LINE]')

function safeUrl(value) {
  try { const u = new URL(String(value || '').trim()); return ['http:', 'https:'].includes(u.protocol) ? u.toString() : '' } catch { return '' }
}

// ตรวจคำตอบของ AI → { listings, rejected, notes } · โยน Error เมื่อไม่ใช่ JSON ตามรูปแบบ
export function parseSurveyResult(raw) {
  const s = String(raw || '')
  const a = s.indexOf('{'), b = s.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('AI ไม่ได้ตอบเป็นรายการประกาศ')
  let json
  try { json = JSON.parse(s.slice(a, b + 1)) } catch { throw new Error('อ่านคำตอบของ AI ไม่ได้') }
  const rejected = []
  const seen = new Set()
  const listings = []
  for (const item of Array.isArray(json.listings) ? json.listings : []) {
    const url = safeUrl(item?.url)
    const price = Math.round(num(item?.price_baht)), area = Math.round(num(item?.area_sqw) * 10) / 10
    const reason = !url ? 'ไม่มีลิงก์ประกาศ'
      : seen.has(url) ? 'ลิงก์ซ้ำ'
        : item?.opened_page !== true ? 'AI ไม่ได้เปิดหน้าประกาศจริง'
          : !(price >= 50000) ? 'ไม่มีราคาบนหน้า'
            : !(area > 0) ? 'ไม่มีเนื้อที่บนหน้า' : ''
    if (reason) { rejected.push({ url, reason }); continue }
    seen.add(url)
    listings.push({
      url, site: text(item.site, 40) || new URL(url).hostname.replace(/^www\./, ''),
      title: scrubContact(item.title).slice(0, 160),
      basis: assetBasisOf(item.asset), price, area_sqw: area,
      price_per_sqw: Math.round(price / area),          // คำนวณเองเสมอ ไม่ใช้ตัวเลขที่ AI หารมา
      location: text(item.location, 100), road: text(item.road, 100), building: scrubContact(item.building).slice(0, 160),
      posted: text(item.posted, 40), evidence: scrubContact(item.evidence).slice(0, 240),
    })
    if (listings.length >= SURVEY_MAX_LISTINGS) break
  }
  for (const item of Array.isArray(json.rejected) ? json.rejected : []) {
    const url = safeUrl(item?.url)
    if (url && rejected.length < 60) rejected.push({ url, reason: scrubContact(item.reason).slice(0, 120) || 'AI ตัดออก' })
  }
  return { listings, rejected, notes: scrubContact(json.notes).slice(0, 400) }
}

// ประกาศนี้อยู่เขต/อำเภอเดียวกับทรัพย์ไหม → 'in' | 'out' | 'unknown' (ประกาศไม่ระบุเขต)
// ดูจากช่องทำเลของประกาศก่อน ไม่พอค่อยดูชื่อประกาศ · เจ้าของ 18 พ.ย. 2569: คนละพื้นที่เทียบกันไม่ได้ ไม่ต้องใส่มา
export function listingAreaMatch(listing = {}, request = {}) {
  const squash = (v) => String(v || '').replace(/\s+/g, '')
  const district = squash(request.district)
  if (!district) return 'unknown'
  const named = (s) => [...s.matchAll(/(?:เขต|อำเภอ|อ\.)([ก-๙]+)/g)].map((m) => m[1])
  for (const source of [squash(listing.location), squash(listing.title)]) {
    if (source.includes(district)) return 'in'
    const others = named(source)
    // "อ.เมือง" ของประกาศ = อำเภอเมือง… ของทรัพย์ (ชื่อเต็มมีชื่อจังหวัดต่อท้าย)
    if (others.some((d) => district.startsWith(d) || d.startsWith(district))) return 'in'
    if (others.length) return 'out'
  }
  return 'unknown'
}

// ย้ายประกาศนอกเขตของทรัพย์ไปอยู่ในรายการที่ตัดออก พร้อมเหตุผล · ประกาศที่ไม่ระบุเขตยังอยู่ (ตัดสินไม่ได้)
export function dropOutOfArea({ listings = [], rejected = [], ...rest } = {}, request = {}) {
  const keep = [], out = []
  for (const l of listings) (listingAreaMatch(l, request) === 'out' ? out : keep).push(l)
  return { ...rest, listings: keep, rejected: [...out.map((l) => ({ url: l.url, reason: `อยู่นอกเขตของทรัพย์ (${l.location || 'ทำเลอื่น'})`.slice(0, 120) })), ...rejected], outOfArea: out.length }
}

const median = (sorted) => sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)) : 0

// รายการที่ราคาต่อตารางวาห่างจากค่ากลางของกลุ่มเดียวกันมาก (ต่ำกว่า 0.5 เท่า หรือสูงกว่า 2 เท่า) → ไม่เลือกให้ตั้งต้น เจ้าของเลือกกลับได้
// กลุ่มที่ใช้ตั้งต้น: ทรัพย์ที่ดินเปล่าหรือที่ดินพร้อมสิ่งปลูกสร้าง → กลุ่มที่ดินเปล่า (ได้ราคาที่ดินล้วน ค่าสิ่งปลูกสร้างคิดแยก
// เพราะราคาต่อตารางวาของประกาศที่มีอาคารรวมค่าอาคารไว้และเทียบกันเองไม่ได้ · เจ้าของ 18 พ.ย. 2569) · ห้องชุด → กลุ่มห้องชุด
// กลุ่มนั้นมีไม่ถึง 3 ประกาศ → กลุ่มเดียวกับทรัพย์ → ทุกกลุ่ม ('all')
export function selectionBasis(listings = [], basis = 'land') {
  const count = (b) => listings.filter((l) => l.basis === b).length
  const want = basis === 'condo' ? 'condo' : 'land'
  if (count(want) >= 3) return want
  if (count(basis) >= 3) return basis
  return 'all'
}

export function defaultSelection(listings = [], basis = 'land') {
  const group = selectionBasis(listings, basis)
  const pool = group === 'all' ? listings : listings.filter((l) => l.basis === group)
  const mid = median(pool.map((l) => l.price_per_sqw).sort((x, y) => x - y))
  return pool.filter((l) => mid > 0 && l.price_per_sqw >= mid * 0.5 && l.price_per_sqw <= mid * 2).map((l) => l.url)
}

// ช่วงราคาจากรายการที่เลือก · discountPct = ส่วนลดต่อรองจากราคาตั้งขาย (เจ้าของกำหนด) · totalSqw = เนื้อที่ทรัพย์เรา
export function summarizeSurvey(listings = [], selectedUrls = [], { discountPct = 0, totalSqw = 0 } = {}) {
  const picked = listings.filter((l) => selectedUrls.includes(l.url))
  const sorted = picked.map((l) => l.price_per_sqw).sort((x, y) => x - y)
  if (!sorted.length) return null
  const k = 1 - Math.min(Math.max(num(discountPct), 0), 60) / 100
  const adj = (v) => Math.round(v * k)
  const low = adj(sorted[0]), mid = adj(median(sorted)), high = adj(sorted[sorted.length - 1])
  const sqw = num(totalSqw)
  const mixed = new Set(picked.map((l) => l.basis)).size > 1
  return {
    count: picked.length, discountPct: Math.round((1 - k) * 100), mixed,
    low, mid, high,
    totalLow: Math.round(low * sqw), totalMid: Math.round(mid * sqw), totalHigh: Math.round(high * sqw),
    // ความมั่นใจจากจำนวนหลักฐานและการกระจายของราคาเท่านั้น (ไม่ได้บอกว่าราคาถูกต้อง)
    confidence: picked.length >= 5 && high <= low * 2 ? 'สูง' : picked.length >= 3 ? 'ปานกลาง' : 'ต่ำ',
  }
}

// สิ่งที่เก็บลงฟอร์ม (form.marketSurvey → form_snapshot) เมื่อเจ้าของกดใช้ราคา: พอสำหรับสรุปส่งนายทุนและตรวจย้อนหลัง
export function surveySnapshot({ jobId, surveyedAt, listings = [], selectedUrls = [], summary }) {
  return {
    jobId, surveyedAt, ...summary,
    comps: listings.filter((l) => selectedUrls.includes(l.url)).map(({ url, site, basis, price, area_sqw, price_per_sqw, location, road, building }) => ({ url, site, basis, price, area_sqw, price_per_sqw, location, road, building })),
  }
}

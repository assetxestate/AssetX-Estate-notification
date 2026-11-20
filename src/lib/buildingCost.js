// ราคาประเมินสิ่งปลูกสร้างตามบัญชีของกรมธนารักษ์ (เจ้าของขอ 20 พ.ย. 2569: ทรัพย์ที่มีอาคาร ให้เทียบกับราคาค่าก่อสร้างของกรมธนารักษ์ตามจังหวัด)
// ราคาต่อหน่วย: ชุดข้อมูลเปิดของกรมธนารักษ์ → src/lib/treasuryBuildingCosts.json (สร้างด้วย scripts/build-treasury-building-costs.mjs)
//   - รายจังหวัด 77 จังหวัด ไม่แยกอำเภอ/ตำบล · รอบบัญชี 2566–2569 (รอบใหม่เริ่ม 1 ม.ค. 2570 ต้องสร้างไฟล์ใหม่)
// ค่าเสื่อม: ตารางตามระเบียบของคณะกรรมการกำหนดราคาประเมินทุนทรัพย์ พ.ศ. 2535 (คัดจากคู่มือการใช้บัญชีกำหนดราคาประเมินทุนทรัพย์
//   โรงเรือนสิ่งปลูกสร้าง ฉบับที่เทศบาลเผยแพร่ ตรวจ 20 พ.ย. 2569 — แหล่งชั้นรอง ยืนยันกับสำนักงานที่ดินก่อนใช้เป็นตัวเลขทางการ)
// ผลที่ได้คือ "ราคาประเมินราชการของสิ่งปลูกสร้าง" ไม่ใช่ราคาตลาด · ประเภท พื้นที่ และอายุ เจ้าของเป็นคนยืนยันเสมอ (AI เสนอประเภทจากรูปได้อย่างเดียว)

export const BUILDING_CLASSES = { masonry: 'ตึก', half: 'ครึ่งตึกครึ่งไม้', wood: 'ไม้' }

// ค่าเสื่อมสะสม (%) ตามอายุ: [อายุถึงปีที่, ร้อยละต่อปีในช่วงนั้น] แล้วตามด้วยเพดานตลอดอายุการใช้งาน
const DEPRECIATION = {
  masonry: { steps: [[10, 1], [42, 2]], cap: 76 }, // ปีที่ 10 = 10 · ปีที่ 42 = 74 · ปีที่ 43 ขึ้นไป = 76
  half: { steps: [[5, 2], [15, 4], [21, 5]], cap: 85 }, // ปีที่ 5 = 10 · ปีที่ 15 = 50 · ปีที่ 21 = 80 · ปีที่ 22 ขึ้นไป = 85
  wood: { steps: [[5, 3], [15, 5], [18, 7]], cap: 93 }, // ปีที่ 5 = 15 · ปีที่ 15 = 65 · ปีที่ 18 = 86 · ปีที่ 19 ขึ้นไป = 93
}

// อายุนับตามปีปฏิทิน ปีที่สร้างเสร็จ = ปีที่หนึ่ง เศษของปีนับเป็นหนึ่งปี → ปัดขึ้น
export function depreciationPct(cls, ageYears) {
  const table = DEPRECIATION[cls] || DEPRECIATION.masonry
  const age = Math.ceil(Number(ageYears))
  if (!Number.isFinite(age) || age <= 0) return 0
  let pct = 0
  let from = 0
  for (const [until, rate] of table.steps) {
    if (age <= from) break
    pct += (Math.min(age, until) - from) * rate
    from = until
  }
  return age > from ? table.cap : pct
}

// ประเภทค่าเสื่อมตั้งต้นจากชื่อในบัญชี (เจ้าของแก้ได้)
export function defaultBuildingClass(name = '') {
  if (name.includes('ครึ่งตึกครึ่งไม้')) return 'half'
  if (name.includes('ไม้')) return 'wood'
  return 'masonry'
}

// 1xx–5xx = อาคาร (บาทต่อตารางเมตรของพื้นที่อาคาร) · 6xx = สิ่งปลูกสร้างประกอบ เช่น รั้ว ลาน สระ (หน่วยตามบัญชี ต้องตรวจหน่วยก่อนใช้)
export const isSiteWork = (id) => String(id).startsWith('6')

export function buildingTypes(data) {
  return (data?.types || []).map(([id, name]) => ({ id, name, siteWork: isSiteWork(id), cls: defaultBuildingClass(name) }))
}

const provinceKey = (value) => String(value || '').replace(/^จังหวัด/, '').replace(/\s+/g, '').trim()

export function buildingUnitPrice(data, province, typeId) {
  const index = (data?.types || []).findIndex(([id]) => id === typeId)
  if (index < 0) return 0
  const key = provinceKey(province)
  const name = Object.keys(data.provinces || {}).find((p) => provinceKey(p) === key)
  return name ? Number(data.provinces[name][index]) || 0 : 0
}

const num = (value) => { const n = Number(String(value ?? '').replace(/,/g, '')); return Number.isFinite(n) && n > 0 ? n : 0 }

// หนึ่งรายการสิ่งปลูกสร้าง → ราคาประเมินราชการ · ข้อมูลไม่ครบ = value 0 พร้อมบอกว่าขาดอะไร
export function computeBuilding(item = {}, data, province) {
  const type = buildingTypes(data).find((t) => t.id === item.typeId) || null
  const unit = type ? buildingUnitPrice(data, province, type.id) : 0
  const area = num(item.area)
  const age = num(item.age)
  const cls = Object.hasOwn(BUILDING_CLASSES, item.cls) ? item.cls : type?.cls || 'masonry'
  const missing = [!type && 'ประเภท', type && !unit && 'ราคาของจังหวัดนี้', !area && 'พื้นที่', !age && 'อายุ'].filter(Boolean)
  const newCost = unit * area
  const depPct = age ? depreciationPct(cls, age) : 0
  const value = missing.length ? 0 : Math.round(newCost * (100 - depPct) / 100)
  return { type, unit, area, age, cls, newCost, depPct, value, missing }
}

export function computeBuildings(items = [], data, province) {
  const rows = items.map((item) => computeBuilding(item, data, province))
  return { rows, total: rows.reduce((sum, r) => sum + r.value, 0), complete: rows.length > 0 && rows.every((r) => !r.missing.length) }
}

const baht = (n) => Math.round(n).toLocaleString('en-US')

// ข้อความสำหรับช่อง "สิ่งปลูกสร้าง" ของสรุปส่งนายทุน (เฉพาะรายการที่ข้อมูลครบ)
export function buildingSummaryText(items = [], data, province) {
  return computeBuildings(items, data, province).rows.filter((r) => !r.missing.length)
    .map((r) => `${r.type.name} ${r.area.toLocaleString('en-US')} ตร.ม. อายุ ${r.age} ปี (${BUILDING_CLASSES[r.cls]} หักค่าเสื่อม ${r.depPct}%) ≈ ${baht(r.value)} บาท`).join('\n')
}

export const BUILDING_COST_CAVEAT = 'ราคาต่อหน่วยจากบัญชีราคาประเมินสิ่งปลูกสร้างของกรมธนารักษ์ (รายจังหวัด ไม่แยกอำเภอ) หักค่าเสื่อมตามตารางของคณะกรรมการกำหนดราคาประเมินทุนทรัพย์ เป็นราคาประเมินราชการ ไม่ใช่ราคาตลาด และไม่ใช่ราคาที่สำนักงานที่ดินคำนวณให้ ต้องยืนยันประเภท พื้นที่ และอายุอาคารกับเอกสารจริง'

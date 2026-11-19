// อ่านข้อความที่เจ้าของคัดลอกจากกล่องผลลัพธ์ของ LandsMaps (กรมที่ดิน) แล้วแยกเป็นช่องของฟอร์มประเมิน
// เจ้าของค้นและคัดลอกเอง — ระบบไม่เข้าไปค้นที่เว็บกรมที่ดิน (เว็บห้ามโปรแกรมอัตโนมัติ)
// รูปแบบข้อความ: หัวข้อหนึ่งบรรทัด ค่าอยู่บรรทัดถัดไป (หรือ "หัวข้อ: ค่า" บรรทัดเดียวกัน)

const LABELS = [
  ['titleDeedNo', /^เลข(ที่)?โฉนด(ที่ดิน)?$/],
  ['surveyPage', /^หน้าสำรวจ$/],
  ['landNo', /^เลขที่ดิน$/],
  ['mapSheet', /^ระวาง$/],
  ['subdistrict', /^(ตำบล|แขวง)$/],
  ['district', /^(อำเภอ|เขต)$/],
  ['province', /^จังหวัด$/],
  ['area', /^เนื้อที่$/],
  ['govPrice', /^ราคาประเมิน(ที่ดิน)?$/],
  ['coords', /^(ค่า)?พิกัด(แปลง)?$/],
]

const labelOf = (line) => LABELS.find(([, re]) => re.test(line))?.[0] || null
const num = (s) => { const n = Number(String(s).replace(/,/g, '')); return Number.isFinite(n) ? n : null }

export const LANDSMAPS_FIELD_LABELS = {
  titleDeedNo: 'เลขโฉนด', surveyPage: 'หน้าสำรวจ', landNo: 'เลขที่ดิน', mapSheet: 'ระวาง',
  subdistrict: 'ตำบล', district: 'อำเภอ', province: 'จังหวัด', area: 'เนื้อที่', govPrice: 'ราคาประเมิน', coords: 'พิกัด',
}

// คืน { fields, found } · fields มีเฉพาะช่องที่อ่านได้ · found = รายชื่อช่อง (คีย์ของ LANDSMAPS_FIELD_LABELS)
export function parseLandsMapsText(input) {
  const lines = String(input || '').replace(/\r/g, '').split('\n')
    .flatMap((raw) => {
      // "หัวข้อ: ค่า" หรือ "หัวข้อ<tab>ค่า" ในบรรทัดเดียว → แยกเป็นสองบรรทัด
      const m = raw.match(/^\s*([^\t:：]+?)\s*[\t:：]\s*(.+)$/)
      return m && labelOf(m[1].trim()) ? [m[1], m[2]] : [raw]
    })
    .map((l) => l.trim()).filter(Boolean)

  const raw = {}
  for (let i = 0; i < lines.length; i++) {
    const key = labelOf(lines[i])
    if (!key || raw[key] != null) continue
    // ค่า = บรรทัดถัดไปที่ไม่ใช่หัวข้อ · ข้ามบรรทัดวงเล็บกำกับ เช่น "(กรมธนารักษ์)"
    for (let j = i + 1; j < lines.length && j <= i + 3; j++) {
      if (labelOf(lines[j])) break
      if (/^\(.*\)$/.test(lines[j])) continue
      raw[key] = lines[j]
      break
    }
  }

  const fields = {}
  const found = []
  const take = (key, value, name = key) => { if (value !== null && value !== undefined && value !== '') { fields[key] = value; if (!found.includes(name)) found.push(name) } }

  for (const key of ['titleDeedNo', 'surveyPage', 'landNo', 'mapSheet']) take(key, raw[key] && raw[key] !== '-' ? raw[key] : '')
  for (const key of ['subdistrict', 'district', 'province']) take(key, (raw[key] || '').replace(/^(ตำบล|แขวง|อำเภอ|เขต|จังหวัด)\s*/, ''))

  if (raw.area) {
    const m = raw.area.match(/([\d,.]+)\s*ไร่\s*([\d,.]+)\s*งาน\s*([\d,.]+)\s*(ตารางวา|ตร\.?\s*ว\.?)/) || raw.area.match(/^([\d,]+)\s*-\s*([\d,]+)\s*-\s*([\d,.]+)/)
    if (m && [m[1], m[2], m[3]].every((v) => num(v) !== null)) {
      fields.areaRai = num(m[1]); fields.areaNgan = num(m[2]); fields.areaSqw = num(m[3])
      found.push('area')
    }
  }
  if (raw.govPrice) {
    const m = raw.govPrice.match(/([\d,]+(?:\.\d+)?)\s*บาท/)
    if (m && num(m[1]) > 0) take('govPrice', num(m[1]))
  }
  if (raw.coords) {
    const m = raw.coords.match(/(-?\d{1,2}\.\d+)\s*[,|\s]\s*(-?\d{1,3}\.\d+)/)
    // ประเทศไทยอยู่ราวละติจูด 5–21 ลองจิจูด 97–106: นอกช่วงนี้ถือว่าอ่านผิด ไม่กรอก
    if (m && num(m[1]) >= 5 && num(m[1]) <= 21 && num(m[2]) >= 97 && num(m[2]) <= 106) {
      fields.lat = num(m[1]); fields.lng = num(m[2])
      found.push('coords')
    }
  }
  return { fields, found }
}

// ช่องที่ค่าที่วางไม่ตรงกับที่มีอยู่ในฟอร์ม (ให้เจ้าของเห็นก่อนถูกเขียนทับ) → [{ key, from, to }]
export function landsMapsConflicts(fields, deed = {}) {
  return ['titleDeedNo', 'surveyPage', 'landNo']
    .filter((key) => fields[key] && deed[key] && String(deed[key]).trim() !== String(fields[key]).trim())
    .map((key) => ({ key, from: String(deed[key]).trim(), to: String(fields[key]).trim() }))
}

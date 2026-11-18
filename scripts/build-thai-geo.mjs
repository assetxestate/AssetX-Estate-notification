// สร้าง src/lib/thaiGeo.json (จังหวัด → อำเภอ/เขต → ตำบล/แขวง) สำหรับช่องเลือกที่ตั้งทรัพย์
// แหล่งข้อมูล: github.com/kongvut/thai-province-data (MIT) ไฟล์ api/latest/province_with_district_and_sub_district.json
// ใช้: node scripts/build-thai-geo.mjs <ไฟล์ที่ดาวน์โหลดมา>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROVINCES } from '../src/lib/valuationOptions.js'

const src = process.argv[2]
if (!src) throw new Error('ระบุไฟล์ข้อมูลต้นทาง')
const data = JSON.parse(fs.readFileSync(src, 'utf8'))
const live = (x) => !x.deleted_at
// ชื่อในไฟล์ต้นทางเป็น { th, en } (รุ่นเก่าเป็น name_th)
const nameOf = (x) => String(x.name_th ?? x.name?.th ?? (typeof x.name === 'string' ? x.name : '') ?? '').trim()
const sortTh = (a, b) => a.localeCompare(b, 'th')

const out = {}
let districts = 0
let subs = 0
const odd = []
for (const p of data.filter(live)) {
  const byDistrict = {}
  for (const a of (p.districts || p.amphure || []).filter(live)) {
    const list = [...new Set((a.sub_districts || a.tambon || []).filter(live).map(nameOf).filter(Boolean))].sort(sortTh)
    const name = nameOf(a)
    if (!name || !list.length || /[*()A-Za-z0-9]/.test(name)) { odd.push(`${nameOf(p)}/${name}:${list.length}`); continue }
    for (const t of list) if (/[*()A-Za-z0-9]/.test(t)) odd.push(`${nameOf(p)}/${name}/${t}`)
    byDistrict[name] = list
    districts += 1
    subs += list.length
  }
  out[nameOf(p)] = Object.fromEntries(Object.entries(byDistrict).sort(([a], [b]) => sortTh(a, b)))
}

console.log(`จังหวัด ${Object.keys(out).length} · อำเภอ/เขต ${districts} · ตำบล/แขวง ${subs}`)
console.log('จังหวัดในแอปที่ไม่มีในข้อมูล:', PROVINCES.filter((p) => !out[p]))
console.log('จังหวัดในข้อมูลที่ไม่มีในแอป:', Object.keys(out).filter((p) => !PROVINCES.includes(p)))
console.log('รายการแปลก:', odd.length, odd.slice(0, 40))
const bkk = Object.keys(out).find((p) => p.startsWith('กรุงเทพ'))
console.log('ตัวอย่าง:', bkk, Object.keys(out[bkk] || {}).length, 'เขต ·', Object.keys(out[bkk] || {}).slice(0, 5))

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/lib/thaiGeo.json')
fs.writeFileSync(file, JSON.stringify(out))
console.log(`เขียน ${file} ${fs.statSync(file).size} ไบต์`)

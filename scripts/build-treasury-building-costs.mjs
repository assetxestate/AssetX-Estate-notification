// สร้าง src/lib/treasuryBuildingCosts.json จากชุดข้อมูลเปิด "ราคาประเมินสิ่งปลูกสร้าง" ของกรมธนารักษ์
// แหล่ง: https://catalog.treasury.go.th/dataset/building-valuation (กองมาตรฐานการประเมินราคาทรัพย์สิน · Open Data Common)
// 69 ประเภทสิ่งปลูกสร้าง × 77 จังหวัด · ราคาต่อหน่วยตามบัญชี (อาคาร = บาทต่อตารางเมตร) · ราคาเป็นรายจังหวัด ไม่แยกอำเภอ
// รันใหม่เมื่อกรมธนารักษ์ประกาศบัญชีรอบใหม่ (รอบปัจจุบัน 2566–2569 · รอบถัดไปเริ่ม 1 ม.ค. 2570): node scripts/build-treasury-building-costs.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CKAN = 'https://catalog.treasury.go.th/api/3/action'
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'treasuryBuildingCosts.json')
const headers = { 'User-Agent': 'Mozilla/5.0' }

function parseCsvLine(line) {
  const cells = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1 } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { cells.push(cur); cur = '' } else cur += ch
  }
  cells.push(cur)
  return cells.map((c) => c.trim())
}

const pkg = await (await fetch(`${CKAN}/package_show?id=building-valuation`, { headers })).json()
if (!pkg.success) throw new Error('อ่านรายการชุดข้อมูลไม่สำเร็จ')
const resource = pkg.result.resources.find((r) => /csv/i.test(r.format || ''))
if (!resource) throw new Error('ไม่พบไฟล์ CSV ในชุดข้อมูล')
const csv = (await (await fetch(resource.url, { headers })).text()).replace(/^﻿/, '')
const lines = csv.split(/\r?\n/).filter(Boolean)
const head = parseCsvLine(lines[0])
const col = (name) => { const i = head.indexOf(name); if (i < 0) throw new Error(`ไม่พบคอลัมน์ ${name} (หัวตาราง: ${head.join(',')})`); return i }
const [cId, cName, cProv, cPrice] = ['ID_CONSTR', 'NAME_CONSTR', 'CHANGWAT_NAME', 'PRICE_CONSTR'].map(col)

const types = new Map()
const byProvince = new Map()
for (const line of lines.slice(1)) {
  const c = parseCsvLine(line)
  const id = c[cId]
  const price = Number(c[cPrice])
  const province = c[cProv]
  if (!id || !province || !(price > 0)) throw new Error(`แถวผิดรูป: ${line.slice(0, 80)}`)
  if (!types.has(id)) types.set(id, c[cName].replace(/\s+/g, ' ').trim())
  if (!byProvince.has(province)) byProvince.set(province, new Map())
  byProvince.get(province).set(id, price)
}
const ids = [...types.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
const provinces = {}
for (const [name, prices] of [...byProvince].sort((a, b) => a[0].localeCompare(b[0], 'th'))) {
  provinces[name] = ids.map((id) => { const p = prices.get(id); if (!(p > 0)) throw new Error(`${name} ไม่มีราคาของประเภท ${id}`); return p })
}
if (ids.length < 60 || Object.keys(provinces).length !== 77) throw new Error(`ข้อมูลไม่ครบ: ${ids.length} ประเภท ${Object.keys(provinces).length} จังหวัด`)

const data = {
  source: 'กรมธนารักษ์ · ชุดข้อมูลเปิด "ราคาประเมินสิ่งปลูกสร้าง"',
  url: 'https://catalog.treasury.go.th/dataset/building-valuation',
  file: path.basename(new URL(resource.url).pathname),
  round: '2566–2569',
  fetched: new Date().toISOString().slice(0, 10),
  types: ids.map((id) => [id, types.get(id)]),
  provinces,
}
fs.writeFileSync(OUT, JSON.stringify(data) + '\n')
console.log(`เขียน ${path.relative(process.cwd(), OUT)} · ${ids.length} ประเภท · ${Object.keys(provinces).length} จังหวัด · ไฟล์ต้นทาง ${data.file} · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`)

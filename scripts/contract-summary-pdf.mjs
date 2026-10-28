// สร้างรายงาน "สรุปสัญญา" (A4 แนวนอน หน้าเดียว) จากข้อมูลสดใน Supabase → HTML + PDF
// ใช้: npm run report:contracts            → บันทึกที่โฟลเดอร์แม่ของโปรเจกต์ (C:\Projects\AssetX Estate)
//      npm run report:contracts -- --out D:\reports   → เลือกโฟลเดอร์ปลายทางเอง
// ต้องมี Google Chrome หรือ Microsoft Edge ในเครื่อง (หรือตั้ง CHROME_PATH)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { toMonthlyAmount, sumTopupPrincipal, sumTopupMonthlyInterest, groupTopupsByCustomer } from '../src/lib/topupTotals.js'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
config({ path: path.join(repo, '.env.local'), quiet: true })
config({ path: path.join(repo, '.env'), quiet: true })

const args = process.argv.slice(2)
const outDir = path.resolve(args[args.indexOf('--out') + 1] && args.includes('--out') ? args[args.indexOf('--out') + 1] : path.resolve(repo, '..'))
const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
today.setHours(0, 0, 0, 0)

// ── ตัวช่วยจัดรูปแบบ ─────────────────────────────────────
const money = (n) => Math.round(Number(n) || 0).toLocaleString('en-US')
const thaiShort = (iso) => iso ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso + 'T00:00:00+07:00')) : '-'
const thaiLong = (d) => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysLeft = (iso) => iso ? Math.round((new Date(iso + 'T00:00:00+07:00') - new Date(isoDate(today) + 'T00:00:00+07:00')) / 86400000) : null
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))

// รวมเนื้อที่ "ไร่-งาน-ตารางวา" ของโฉนดหลายแปลง
function sumArea(deeds) {
  let rai = 0, ngan = 0, wa = 0, counted = 0
  for (const d of deeds) {
    const m = String(d?.area || '').match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/)
    if (!m) continue
    rai += Number(m[1]); ngan += Number(m[2]); wa += Number(m[3]); counted++
  }
  if (!counted) return null
  ngan += Math.floor(wa / 100); wa = Math.round((wa % 100) * 10) / 10
  rai += Math.floor(ngan / 4); ngan = ngan % 4
  return `${rai}-${ngan}-${wa}`
}

function collateralHtml(c) {
  const deeds = Array.isArray(c.deeds) ? c.deeds : []
  if (!deeds.length) return `${esc(c.type === 'จำนอง' ? 'ที่ดิน' : 'ทรัพย์')} ${esc(c.location_label || '')}<br><span class="muted">ไม่มีรายละเอียดโฉนดในระบบ</span>`
  const area = sumArea(deeds)
  const first = deeds[0] || {}
  const where = [first.tambon, first.amphoe, first.province].filter(Boolean).join(' ')
  const head = `โฉนด ${deeds.length} แปลง${deeds.length > 1 ? ' รวม' : ''}${area ? ` ${area} ไร่` : ''}`
  return `${esc(head)}<br><span class="muted">${esc(where)}</span>`
}

function labelHtml(c) {
  const raw = String(c.full_label || c.name || '').replace(/^(ขายฝาก|จำนอง)\s*/, '').trim()
  const m = raw.match(/^(.*?)\s*\((.+)\)\s*$/)
  const main = m ? m[1] : raw
  const subs = []
  if (m) subs.push(m[2])
  if (c.topupPrincipal > 0) subs.push(`+ วงเงินเพิ่ม ${money(c.topupPrincipal)}`)
  return `${esc(main)}${subs.length ? `<br><span class="muted">${esc(subs.join(' · '))}</span>` : ''}`
}

// ── โหลดข้อมูลด้วยเกณฑ์เดียวกับหน้าเว็บ ────────────────
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const [{ data: customers, error: e1 }, { data: statuses, error: e2 }, { data: topupRows, error: e3 }] = await Promise.all([
  sb.from('customers').select('id,name,full_label,type,principal,amount,freq,contract_end_date,is_cancelled,deeds'),
  sb.from('contract_statuses').select('customer_id,status'),
  sb.from('contract_topups').select('customer_id,topup_amount,interest_amount,freq,topup_end_date'),
])
if (e1 || e2 || e3) throw new Error((e1 || e2 || e3).message)

const statusMap = new Map(statuses.map((s) => [String(s.customer_id), s.status]))
const topups = groupTopupsByCustomer(topupRows.map((t) => ({ customerId: t.customer_id, topupAmount: t.topup_amount, interestAmount: t.interest_amount, freq: t.freq, topupEndDate: t.topup_end_date })))
const active = customers
  .filter((c) => {
    const st = statusMap.get(String(c.id))
    return st !== 'ปิดแล้ว' && st !== 'ยกเลิก' && !(c.is_cancelled && !st)
  })
  .map((c) => ({
    ...c,
    deeds: typeof c.deeds === 'string' ? JSON.parse(c.deeds || '[]') : c.deeds,
    topups: topups[c.id] || [],
    topupPrincipal: sumTopupPrincipal(topups[c.id]),
    topupInterest: (topups[c.id] || []).reduce((s, t) => s + (Number(t.interestAmount) || 0), 0),
    monthly: toMonthlyAmount(c.amount, c.freq) + sumTopupMonthlyInterest(topups[c.id]),
    days: daysLeft(c.contract_end_date),
  }))
  .sort((a, b) => String(a.contract_end_date || '9999') < String(b.contract_end_date || '9999') ? -1 : 1)

// ── ตัวเลขสรุป ───────────────────────────────────────────
const principal = active.reduce((s, c) => s + (Number(c.principal) || 0), 0)
const topupTotal = active.reduce((s, c) => s + c.topupPrincipal, 0)
const total = principal + topupTotal
const byType = (t) => active.filter((c) => c.type === t)
const sumWith = (arr) => arr.reduce((s, c) => s + (Number(c.principal) || 0) + c.topupPrincipal, 0)
const monthly = active.reduce((s, c) => s + c.monthly, 0)
const avgRate = total > 0 ? (monthly * 12 / total * 100) : 0
const within30 = active.filter((c) => c.days !== null && c.days <= 30)
const within180 = active.filter((c) => c.days !== null && c.days <= 180)
const rateOf = (c) => (Number(c.principal) || 0) > 0 ? toMonthlyAmount(c.amount, c.freq) * 12 / Number(c.principal) * 100 : 0
const rateText = (t) => {
  const rates = [...new Set(byType(t).map((c) => Math.round(rateOf(c) * 10) / 10))].sort((a, b) => a - b)
  return rates.length ? (rates.length === 1 ? `${rates[0]}%` : `${rates[0]}–${rates[rates.length - 1]}%`) : '-'
}
const periodLabel = (c) => c.freq?.includes('ปี') ? 'ปีละครั้ง<br><span class="muted">ณ วันครบกำหนด</span>' : esc(c.freq || '-')

// ── HTML ─────────────────────────────────────────────────
const rows = active.map((c, i) => {
  const cls = c.days !== null && c.days <= 30 ? 'urgent' : c.days !== null && c.days <= 180 ? 'soon' : ''
  const typeCls = c.type === 'ขายฝาก' ? 'sale' : 'mortgage'
  return `
    <tr class="${cls}">
      <td>${i + 1}</td><td><span class="type ${typeCls}">${esc(c.type)}</span></td><td>${labelHtml(c)}</td>
      <td class="num">${money(c.principal)}${c.topupPrincipal > 0 ? `<br><span class="muted">+ ${money(c.topupPrincipal)}</span>` : ''}</td>
      <td class="num">${money(c.amount)}${c.topupInterest > 0 ? `<br><span class="muted">+ ${money(c.topupInterest)}</span>` : ''}</td>
      <td>${periodLabel(c)}</td>
      <td>${thaiShort(c.contract_end_date)}</td><td class="num">${c.days === null ? '-' : `${c.days} วัน`}</td><td>${collateralHtml(c)}</td>
    </tr>`
}).join('')

const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>สรุปสัญญา</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 landscape; margin: 8mm 10mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Sarabun', 'Leelawadee UI', 'Tahoma', sans-serif; color: #1f2937; font-size: 10pt; line-height: 1.25; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1f2937; padding-bottom: 4px; margin-bottom: 6px; }
  .head h1 { font-size: 15pt; font-weight: 700; margin: 0; letter-spacing: 0.2px; }
  .head .sub { font-size: 10pt; color: #4b5563; margin-top: 2px; }
  .head .asof { text-align: right; font-size: 9.5pt; color: #4b5563; }
  .head .asof b { color: #1f2937; font-size: 10.5pt; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 7px; }
  .summary div { border: 1px solid #d1d5db; border-radius: 6px; padding: 4px 8px; background: #fafafa; }
  .summary .k { font-size: 8pt; color: #6b7280; }
  .summary .v { font-size: 11.5pt; font-weight: 700; font-variant-numeric: tabular-nums; }
  .summary .d { font-size: 8pt; color: #4b5563; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #d1d5db; padding: 3px 6px; vertical-align: top; }
  thead th { background: #e5e7eb; font-weight: 700; font-size: 9.5pt; text-align: left; }
  thead th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.num { font-weight: 600; }
  tbody tr.urgent td { background: #fde8e8; }
  tbody tr.soon td { background: #fff6dd; }
  tfoot td { background: #f3f4f6; font-weight: 700; }
  .type { display: inline-block; font-weight: 600; padding: 1px 7px; border-radius: 10px; font-size: 9pt; }
  .type.sale { background: #d9f3ee; color: #0e6b5e; }
  .type.mortgage { background: #e3e6fb; color: #3b3f9e; }
  .muted { color: #6b7280; font-size: 9pt; }
  .note { margin-top: 6px; font-size: 8.5pt; color: #4b5563; display: flex; gap: 22px; flex-wrap: wrap; }
  .legend span { display: inline-block; width: 12px; height: 12px; border: 1px solid #d1d5db; vertical-align: -2px; margin-right: 4px; }
</style>
</head>
<body>
<div class="head">
  <div><h1>สรุปสัญญา</h1><div class="sub">สัญญาที่มีผล ${active.length} ฉบับ เรียงตามวันครบกำหนด</div></div>
  <div class="asof">ข้อมูล ณ วันที่ <b>${thaiLong(today)}</b><br>AssetX Estate</div>
</div>
<div class="summary">
  <div><div class="k">วงเงินรวมที่ปล่อย${topupTotal > 0 ? ' (รวมวงเงินเพิ่ม)' : ''}</div><div class="v">${money(total)} บาท</div><div class="d">ขายฝาก ${byType('ขายฝาก').length} ฉบับ ${money(sumWith(byType('ขายฝาก')))} · จำนอง ${byType('จำนอง').length} ฉบับ ${money(sumWith(byType('จำนอง')))}${topupTotal > 0 ? ` (รวมวงเงินเพิ่ม ${money(topupTotal)})` : ''}</div></div>
  <div><div class="k">ดอกเบี้ยตามสัญญา</div><div class="v">≈ ${money(monthly)} บาท/เดือน</div><div class="d">≈ ${(monthly * 12 / 1e6).toFixed(2)} ล้านบาท/ปี (เฉลี่ย ${avgRate.toFixed(1)}% ต่อปี)</div></div>
  <div><div class="k">ครบกำหนดภายใน 1 เดือน</div><div class="v">${within30.length} ฉบับ · ${money(sumWith(within30))}</div><div class="d">${esc(within30.map((c) => `${String(c.full_label || c.name).replace(/^(ขายฝาก|จำนอง)\s*/, '').replace(/\s*\(.*\)$/, '')} ${thaiShort(c.contract_end_date)}`).join(' · ') || '-')}</div></div>
  <div><div class="k">ครบกำหนดภายใน 6 เดือน</div><div class="v">${within180.length} ฉบับ · ${money(sumWith(within180))}</div><div class="d">${total > 0 ? Math.round(sumWith(within180) / total * 100) : 0}% ของพอร์ต${within180.length ? ` ครบ ${thaiShort(within180[0].contract_end_date)} – ${thaiShort(within180[within180.length - 1].contract_end_date)}` : ''}</div></div>
</div>
<table>
  <colgroup>
    <col style="width:3.5%"><col style="width:8%"><col style="width:18%"><col style="width:11%"><col style="width:10%">
    <col style="width:10%"><col style="width:9.5%"><col style="width:7%"><col style="width:23%">
  </colgroup>
  <thead><tr><th>#</th><th>ประเภท</th><th>สัญญา</th><th class="num">วงเงิน (บาท)</th><th class="num">ดอกเบี้ย/งวด (บาท)</th><th>รอบชำระ</th><th>ครบกำหนด</th><th class="num">คงเหลือ</th><th>หลักประกัน</th></tr></thead>
  <tbody>${rows}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="3">รวม ${active.length} ฉบับ</td>
      <td class="num">${money(principal)}${topupTotal > 0 ? `<br><span class="muted">+ ${money(topupTotal)} = ${money(total)}</span>` : ''}</td>
      <td colspan="5" style="font-weight:500">ดอกเบี้ยตามสัญญารวม ≈ ${money(monthly)} บาท/เดือน · ขายฝาก ${rateText('ขายฝาก')} ต่อปี · จำนอง ${rateText('จำนอง')} ต่อปี</td>
    </tr>
  </tfoot>
</table>
<div class="note">
  <div class="legend"><span style="background:#fde8e8"></span>ครบกำหนดภายใน 30 วัน &nbsp; <span style="background:#fff6dd"></span>ครบกำหนดภายใน 6 เดือน</div>
  <div>วันคงเหลือนับจาก ${thaiShort(isoDate(today))}</div>
  <div>เนื้อที่หน่วย ไร่-งาน-ตารางวา</div>
  <div>ข้อมูลจากระบบ AssetX Estate</div>
</div>
</body>
</html>
`

// ── เขียน HTML แล้วพิมพ์เป็น PDF ด้วย Chrome/Edge headless ──
fs.mkdirSync(outDir, { recursive: true })
const stamp = isoDate(today)
const htmlPath = path.join(os.tmpdir(), `assetx-contract-summary-${stamp}.html`)
const pdfPath = path.join(outDir, `AssetX-contract-summary-${stamp}.pdf`)
fs.writeFileSync(htmlPath, html, 'utf8')

const candidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean)
const browser = candidates.find((p) => fs.existsSync(p))
if (!browser) throw new Error('ไม่พบ Chrome/Edge — ตั้งค่า CHROME_PATH ชี้ไปที่ chrome.exe หรือ msedge.exe')

execFileSync(browser, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--virtual-time-budget=8000', '--no-pdf-header-footer',
  `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href,
], { stdio: 'ignore', timeout: 90000 })

console.log(`สัญญาที่มีผล ${active.length} ฉบับ · วงเงินรวม ${money(total)} บาท · ดอกเบี้ย ≈ ${money(monthly)} บาท/เดือน`)
console.log(`PDF: ${pdfPath}`)
console.log(`HTML (แก้ข้อความแล้วพิมพ์เองได้): ${htmlPath}`)

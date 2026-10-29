// สร้างรายงาน "สรุปสัญญา" (A4 แนวนอน หน้าเดียว) จากข้อมูลสดใน Supabase → HTML + PDF
// ใช้: npm run report:contracts            → บันทึกที่โฟลเดอร์แม่ของโปรเจกต์ (C:\Projects\AssetX Estate)
//      npm run report:contracts -- --out D:\reports   → เลือกโฟลเดอร์ปลายทางเอง
//      npm run report:contracts -- --open             → เปิด PDF ทันทีเมื่อเสร็จ
// ต้องมี Google Chrome หรือ Microsoft Edge ในเครื่อง (หรือตั้ง CHROME_PATH)
// รูปแบบรายงานอยู่ใน src/lib/contractSummaryReport.js (ใช้ร่วมกับปุ่ม "ส่งออก PDF สรุปสัญญา" บนหน้า Dashboard)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { groupTopupsByCustomer } from '../src/lib/topupTotals.js'
import { buildContractSummary, renderContractSummaryHtml, money } from '../src/lib/contractSummaryReport.js'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
config({ path: path.join(repo, '.env.local'), quiet: true })
config({ path: path.join(repo, '.env'), quiet: true })

const args = process.argv.slice(2)
const outDir = path.resolve(args[args.indexOf('--out') + 1] && args.includes('--out') ? args[args.indexOf('--out') + 1] : path.resolve(repo, '..'))
const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
today.setHours(0, 0, 0, 0)

// ── โหลดข้อมูลแล้วแปลงให้อยู่ในรูปเดียวกับหน้าเว็บ (camelCase + ธงสถานะ) ──
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const [{ data: custRows, error: e1 }, { data: statuses, error: e2 }, { data: topupRows, error: e3 }] = await Promise.all([
  sb.from('customers').select('id,name,full_label,type,principal,amount,freq,contract_end_date,is_cancelled,deeds'),
  sb.from('contract_statuses').select('customer_id,status'),
  sb.from('contract_topups').select('customer_id,topup_amount,interest_amount,freq,topup_end_date'),
])
if (e1 || e2 || e3) throw new Error((e1 || e2 || e3).message)

const statusMap = new Map(statuses.map((s) => [String(s.customer_id), s.status]))
const topups = groupTopupsByCustomer(topupRows.map((t) => ({ customerId: t.customer_id, topupAmount: t.topup_amount, interestAmount: t.interest_amount, freq: t.freq, topupEndDate: t.topup_end_date })))
const customers = custRows.map((c) => {
  const st = statusMap.get(String(c.id))
  return {
    id: c.id,
    name: c.name,
    fullLabel: c.full_label,
    type: c.type,
    principal: c.principal,
    amount: c.amount,
    freq: c.freq,
    contractEndDate: c.contract_end_date,
    deeds: c.deeds,
    topups: topups[c.id] || [],
    isClosed: st === 'ปิดแล้ว',
    isVoided: st === 'ยกเลิก',
    isHiddenDraft: Boolean(c.is_cancelled && !st),
  }
})

const summary = buildContractSummary(customers, { today })
const html = renderContractSummaryHtml(summary)

// ── เขียน HTML แล้วพิมพ์เป็น PDF ด้วย Chrome/Edge headless ──
fs.mkdirSync(outDir, { recursive: true })
const htmlPath = path.join(os.tmpdir(), `assetx-contract-summary-${summary.todayIso}.html`)
const pdfPath = path.join(outDir, `${summary.fileStamp}.pdf`)
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

console.log(`สัญญาที่มีผล ${summary.count} ฉบับ · วงเงินรวม ${money(summary.total)} บาท · ดอกเบี้ย ≈ ${money(summary.monthly)} บาท/เดือน`)
console.log(`PDF: ${pdfPath}`)
console.log(`HTML (แก้ข้อความแล้วพิมพ์เองได้): ${htmlPath}`)

// --open: เปิด PDF ด้วยโปรแกรมประจำเครื่องทันที (ใช้กับไฟล์ทางลัดดับเบิลคลิก)
if (args.includes('--open')) {
  if (process.platform === 'win32') execFileSync('cmd', ['/c', 'start', '', pdfPath], { stdio: 'ignore' })
  else execFileSync(process.platform === 'darwin' ? 'open' : 'xdg-open', [pdfPath], { stdio: 'ignore' })
}

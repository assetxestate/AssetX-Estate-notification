// รายงาน "สรุปสัญญา" (A4 แนวนอน) — โมเดลข้อมูล + HTML ที่ใช้ร่วมกันระหว่าง
//   • scripts/contract-summary-pdf.mjs (Node → Chrome headless → PDF)
//   • ปุ่ม "ส่งออก PDF สรุปสัญญา" บนหน้า Dashboard (เบราว์เซอร์ → หน้าต่างพิมพ์ → บันทึกเป็น PDF)
// รับข้อมูลลูกค้ารูปแบบเดียวกับหน้าเว็บ (camelCase: fullLabel, contractEndDate, deeds, topups, isClosed ...)
// ไฟล์นี้ต้องไม่พึ่ง Node หรือ DOM เพื่อให้ทั้งสองฝั่ง import ได้
import { toMonthlyAmount, sumTopupPrincipal, sumTopupMonthlyInterest } from './topupTotals.js'
import { parseDeeds } from './utils.js'

const TZ = 'Asia/Bangkok'

// ── ตัวช่วยจัดรูปแบบ ─────────────────────────────────────
export const money = (n) => Math.round(Number(n) || 0).toLocaleString('en-US')
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))
export const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// วันที่ไทยแบบสั้น/ยาว ยึดเขตเวลาไทยเสมอ ไม่ว่าเครื่องที่เปิดจะตั้งเขตเวลาอะไร
const thaiShort = (iso) => iso ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }).format(new Date(iso + 'T00:00:00+07:00')) : '-'
const thaiLong = (iso) => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(new Date(iso + 'T00:00:00+07:00'))

// จำนวนวันระหว่างวันที่ (YYYY-MM-DD) สองวัน — นับเป็นวันปฏิทิน ไม่ขึ้นกับเขตเวลาเครื่อง
const utcDay = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) }
export const daysBetween = (fromIso, toIso) => Math.round((utcDay(toIso) - utcDay(fromIso)) / 86400000)

// รวมเนื้อที่ "ไร่-งาน-ตารางวา" ของโฉนดหลายแปลง (ทดเศษวา→งาน→ไร่)
export function sumArea(deeds) {
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

// ชื่อสัญญาโดยไม่มีคำนำหน้าประเภท: "ขายฝาก คุณบังอร (บางใหญ่)" → "คุณบังอร (บางใหญ่)"
const stripType = (c) => String(c.fullLabel || c.name || '').replace(/^(ขายฝาก|จำนอง)\s*/, '').trim()
const shortName = (c) => stripType(c).replace(/\s*\(.*\)$/, '')

// เกณฑ์ "สัญญาที่มีผล" เดียวกับ App.jsx: ไม่ปิด ไม่ยกเลิก และไม่ใช่ร่างที่ซ่อนไว้
export const isActiveContract = (c) => !c.isClosed && !c.isVoided && !c.isHiddenDraft

// ── โมเดลข้อมูลของรายงาน ────────────────────────────────
// customers: รายการลูกค้าจากหน้าเว็บ (enriched) หรือที่สคริปต์แปลงให้อยู่ในรูปเดียวกัน
// today: Date ของวันที่ออกรายงาน (ใช้เฉพาะ ปี-เดือน-วัน ตามเครื่อง)
export function buildContractSummary(customers, { today = new Date() } = {}) {
  const todayIso = isoDate(today)
  const contracts = (Array.isArray(customers) ? customers : [])
    .filter(isActiveContract)
    .map((c) => {
      const topups = Array.isArray(c.topups) ? c.topups : []
      const endDate = c.contractEndDate ? String(c.contractEndDate).slice(0, 10) : null
      return {
        id: c.id,
        name: c.name,
        fullLabel: c.fullLabel,
        type: c.type,
        principal: Number(c.principal) || 0,
        amount: Number(c.amount) || 0,
        freq: c.freq || '',
        contractEndDate: endDate,
        deeds: parseDeeds(c.deeds),
        topups,
        topupPrincipal: sumTopupPrincipal(topups),
        // ดอกเบี้ยวงเงินเพิ่มต่องวด (แสดงคู่กับดอกเบี้ย/งวดของสัญญาหลัก)
        topupInterest: topups.reduce((s, t) => s + (Number(t?.interestAmount) || 0), 0),
        monthly: toMonthlyAmount(c.amount, c.freq) + sumTopupMonthlyInterest(topups),
        days: endDate ? daysBetween(todayIso, endDate) : null,
      }
    })
    .sort((a, b) => String(a.contractEndDate || '9999') < String(b.contractEndDate || '9999') ? -1 : 1)

  const sumWith = (arr) => arr.reduce((s, c) => s + c.principal + c.topupPrincipal, 0)
  const principal = contracts.reduce((s, c) => s + c.principal, 0)
  const topupTotal = contracts.reduce((s, c) => s + c.topupPrincipal, 0)
  const total = principal + topupTotal
  const monthly = contracts.reduce((s, c) => s + c.monthly, 0)
  const rateOf = (c) => c.principal > 0 ? toMonthlyAmount(c.amount, c.freq) * 12 / c.principal * 100 : 0
  const typeGroup = (type) => {
    const items = contracts.filter((c) => c.type === type)
    const rates = [...new Set(items.map((c) => Math.round(rateOf(c) * 10) / 10))].sort((a, b) => a - b)
    return {
      count: items.length,
      amount: sumWith(items),
      rateText: rates.length ? (rates.length === 1 ? `${rates[0]}%` : `${rates[0]}–${rates[rates.length - 1]}%`) : '-',
    }
  }
  const dueWithin = (maxDays) => {
    const items = contracts.filter((c) => c.days !== null && c.days <= maxDays)
    return { count: items.length, amount: sumWith(items), items }
  }

  return {
    todayIso,
    fileStamp: `AssetX-contract-summary-${todayIso}`,
    contracts,
    count: contracts.length,
    principal,
    topupTotal,
    total,
    monthly,
    avgRate: total > 0 ? (monthly * 12 / total * 100) : 0,
    byType: { ขายฝาก: typeGroup('ขายฝาก'), จำนอง: typeGroup('จำนอง') },
    within30: dueWithin(30),
    within180: dueWithin(180),
  }
}

// ── HTML ─────────────────────────────────────────────────
function collateralHtml(c) {
  const deeds = Array.isArray(c.deeds) ? c.deeds : []
  if (!deeds.length) {
    const place = stripType(c).match(/\((.+)\)\s*$/)?.[1] || ''
    return `${esc(c.type === 'จำนอง' ? 'ที่ดิน' : 'ทรัพย์')} ${esc(place)}<br><span class="muted">ไม่มีรายละเอียดโฉนดในระบบ</span>`
  }
  const area = sumArea(deeds)
  const first = deeds[0] || {}
  const where = [first.tambon, first.amphoe, first.province].filter(Boolean).join(' ')
  const head = `โฉนด ${deeds.length} แปลง${deeds.length > 1 ? ' รวม' : ''}${area ? ` ${area} ไร่` : ''}`
  return `${esc(head)}<br><span class="muted">${esc(where)}</span>`
}

function labelHtml(c) {
  const raw = stripType(c)
  const m = raw.match(/^(.*?)\s*\((.+)\)\s*$/)
  const main = m ? m[1] : raw
  const subs = []
  if (m) subs.push(m[2])
  if (c.topupPrincipal > 0) subs.push(`+ วงเงินเพิ่ม ${money(c.topupPrincipal)}`)
  return `${esc(main)}${subs.length ? `<br><span class="muted">${esc(subs.join(' · '))}</span>` : ''}`
}

const periodLabel = (c) => c.freq?.includes('ปี') ? 'ปีละครั้ง<br><span class="muted">ณ วันครบกำหนด</span>' : esc(c.freq || '-')

// สไตล์เพิ่มเติมเมื่อเปิดในเบราว์เซอร์: แสดงเป็นแผ่นกระดาษพร้อมแถบปุ่ม และตัดหัว/ท้ายกระดาษของ Chrome ด้วย @page margin 0
const BROWSER_CSS = `
  @page { size: A4 landscape; margin: 0; }
  .page { padding: 8mm 10mm; }
  tbody tr { break-inside: avoid; }
  @media screen {
    body { background: #e5e7eb; padding: 56px 12px 24px; }
    .page { background: #fff; width: 297mm; max-width: 100%; margin: 0 auto; box-shadow: 0 2px 14px rgba(0,0,0,.18); }
    .toolbar { position: fixed; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 16px; background: #111827; color: #e5e7eb; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
    .toolbar b { color: #fff; }
    .toolbar .hint { color: #9ca3af; }
    .toolbar button { background: #2dd4bf; color: #042f2e; border: 0; border-radius: 8px; padding: 7px 16px; font: inherit; font-weight: 700; cursor: pointer; }
    .toolbar button:hover { background: #5eead4; }
  }
  @media print { .toolbar { display: none; } }`

const PRINT_CSS = `
  @page { size: A4 landscape; margin: 8mm 10mm; }`

// mode: 'pdf' = ไฟล์สำหรับ Chrome headless (สคริปต์), 'browser' = เปิดในแท็บใหม่แล้วให้ผู้ใช้กดบันทึก PDF
export function renderContractSummaryHtml(summary, { mode = 'pdf' } = {}) {
  const s = summary
  const browser = mode === 'browser'
  const rows = s.contracts.map((c, i) => {
    const cls = c.days !== null && c.days <= 30 ? 'urgent' : c.days !== null && c.days <= 180 ? 'soon' : ''
    const typeCls = c.type === 'ขายฝาก' ? 'sale' : 'mortgage'
    return `
    <tr class="${cls}">
      <td>${i + 1}</td><td><span class="type ${typeCls}">${esc(c.type)}</span></td><td>${labelHtml(c)}</td>
      <td class="num">${money(c.principal)}${c.topupPrincipal > 0 ? `<br><span class="muted">+ ${money(c.topupPrincipal)}</span>` : ''}</td>
      <td class="num">${money(c.amount)}${c.topupInterest > 0 ? `<br><span class="muted">+ ${money(c.topupInterest)}</span>` : ''}</td>
      <td>${periodLabel(c)}</td>
      <td>${thaiShort(c.contractEndDate)}</td><td class="num">${c.days === null ? '-' : `${c.days} วัน`}</td><td>${collateralHtml(c)}</td>
    </tr>`
  }).join('')
  const sale = s.byType['ขายฝาก']
  const mortgage = s.byType['จำนอง']
  const w30 = s.within30
  const w180 = s.within180

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>${browser ? esc(s.fileStamp) : 'สรุปสัญญา'}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${browser ? '' : PRINT_CSS}
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
  .legend span { display: inline-block; width: 12px; height: 12px; border: 1px solid #d1d5db; vertical-align: -2px; margin-right: 4px; }${browser ? BROWSER_CSS : ''}
</style>
</head>
<body>${browser ? `
<div class="toolbar">
  <div><b>สรุปสัญญา</b> · ${esc(s.fileStamp)}.pdf <span class="hint">· ในหน้าต่างพิมพ์เลือกปลายทาง "บันทึกเป็น PDF / Save as PDF" แล้วกดบันทึก</span></div>
  <button type="button" onclick="window.print()">🖨️ บันทึกเป็น PDF</button>
</div>
<div class="page">` : ''}
<div class="head">
  <div><h1>สรุปสัญญา</h1><div class="sub">สัญญาที่มีผล ${s.count} ฉบับ เรียงตามวันครบกำหนด</div></div>
  <div class="asof">ข้อมูล ณ วันที่ <b>${thaiLong(s.todayIso)}</b><br>AssetX Estate</div>
</div>
<div class="summary">
  <div><div class="k">วงเงินรวมที่ปล่อย${s.topupTotal > 0 ? ' (รวมวงเงินเพิ่ม)' : ''}</div><div class="v">${money(s.total)} บาท</div><div class="d">ขายฝาก ${sale.count} ฉบับ ${money(sale.amount)} · จำนอง ${mortgage.count} ฉบับ ${money(mortgage.amount)}${s.topupTotal > 0 ? ` (รวมวงเงินเพิ่ม ${money(s.topupTotal)})` : ''}</div></div>
  <div><div class="k">ดอกเบี้ยตามสัญญา</div><div class="v">≈ ${money(s.monthly)} บาท/เดือน</div><div class="d">≈ ${(s.monthly * 12 / 1e6).toFixed(2)} ล้านบาท/ปี (เฉลี่ย ${s.avgRate.toFixed(1)}% ต่อปี)</div></div>
  <div><div class="k">ครบกำหนดภายใน 1 เดือน</div><div class="v">${w30.count} ฉบับ · ${money(w30.amount)}</div><div class="d">${esc(w30.items.map((c) => `${shortName(c)} ${thaiShort(c.contractEndDate)}`).join(' · ') || '-')}</div></div>
  <div><div class="k">ครบกำหนดภายใน 6 เดือน</div><div class="v">${w180.count} ฉบับ · ${money(w180.amount)}</div><div class="d">${s.total > 0 ? Math.round(w180.amount / s.total * 100) : 0}% ของพอร์ต${w180.count ? ` ครบ ${thaiShort(w180.items[0].contractEndDate)} – ${thaiShort(w180.items[w180.count - 1].contractEndDate)}` : ''}</div></div>
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
      <td colspan="3">รวม ${s.count} ฉบับ</td>
      <td class="num">${money(s.principal)}${s.topupTotal > 0 ? `<br><span class="muted">+ ${money(s.topupTotal)} = ${money(s.total)}</span>` : ''}</td>
      <td colspan="5" style="font-weight:500">ดอกเบี้ยตามสัญญารวม ≈ ${money(s.monthly)} บาท/เดือน · ขายฝาก ${sale.rateText} ต่อปี · จำนอง ${mortgage.rateText} ต่อปี</td>
    </tr>
  </tfoot>
</table>
<div class="note">
  <div class="legend"><span style="background:#fde8e8"></span>ครบกำหนดภายใน 30 วัน &nbsp; <span style="background:#fff6dd"></span>ครบกำหนดภายใน 6 เดือน</div>
  <div>วันคงเหลือนับจาก ${thaiShort(s.todayIso)}</div>
  <div>เนื้อที่หน่วย ไร่-งาน-ตารางวา</div>
  <div>ข้อมูลจากระบบ AssetX Estate</div>
</div>${browser ? `
</div>
<script>
  // รอฟอนต์ Sarabun โหลดเสร็จก่อนค่อยเปิดหน้าต่างพิมพ์ (ไม่เกิน 3 วินาที) — ผู้ใช้กดปุ่มบนแถบด้านบนซ้ำได้
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]).then(() => setTimeout(() => window.print(), 250))
</script>` : ''}
</body>
</html>
`
}

// เปิดรายงานในแท็บใหม่แล้วเรียกหน้าต่างพิมพ์ให้ (ใช้จากปุ่มบนหน้าเว็บ) — คืนโมเดลไว้ให้แสดง toast
export function openContractSummaryForPrint(customers, { today = new Date() } = {}) {
  const summary = buildContractSummary(customers, { today })
  if (!summary.count) throw new Error('ไม่มีสัญญาที่มีผลให้สรุป')
  const win = window.open('', '_blank')
  if (!win) throw new Error('เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาต pop-up ของเว็บนี้แล้วกดอีกครั้ง')
  win.document.open()
  win.document.write(renderContractSummaryHtml(summary, { mode: 'browser' }))
  win.document.close()
  return summary
}

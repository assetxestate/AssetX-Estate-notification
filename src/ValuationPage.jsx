import React, { useState, useMemo, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const BRAND = {
  teal: '#2DD4BF', gold: '#F59E0B', bg: '#050B18', bgCard: '#0D1B2E',
  border: '#0F2545', borderLt: '#162E56', textPri: '#F0F6FF',
  textSec: '#64748B', textMut: '#475569', success: '#10B981',
}

const CSE_API_KEY = 'AIzaSyB4Aob3vFGs-J2hMMvWsprq8JXiBmlFfFg'
const CSE_CX = 'a02753d79baa74133'

const ASSESSMENT_TYPES = [
  { value: 'ขายฝาก', icon: '🔒', desc: 'รับซื้อฝาก / ได้ผลตอบแทนหลัง' },
  { value: 'จำนอง', icon: '🏛️', desc: 'จดจำนองที่สำนักงานที่ดิน' },
  { value: 'ซื้อขาย', icon: '🤝', desc: 'ประเมินเพื่อซื้อขายทั่วไป' },
  { value: 'ประเมินเพื่อสินเชื่อ', icon: '📋', desc: 'ยื่นธนาคาร / สถาบันการเงิน' },
  { value: 'ประเมินมูลค่าทรัพย์สิน', icon: '📊', desc: 'รายงานมูลค่าทางบัญชี' },
  { value: 'อื่นๆ', icon: '📝', desc: '' },
]

const PROPERTY_TYPES = [
  { value: 'ที่ดิน', icon: '🗺️' }, { value: 'ที่อยู่อาศัย', icon: '🏠' },
  { value: 'อาคารชุด / คอนโด', icon: '🏢' }, { value: 'พาณิชยกรรม', icon: '🏪' },
  { value: 'อุตสาหกรรม / โลจิสติกส์', icon: '🏭' }, { value: 'โรงแรม / รีสอร์ท', icon: '🏨' },
  { value: 'อื่นๆ', icon: '📋' },
]

const PROPERTY_SUBTYPES = {
  'ที่ดิน': ['ที่ดินเปล่า (โฉนด)', 'ที่ดินเปล่า (น.ส.3)', 'ที่ดินเปล่า (ส.ค.1)', 'ที่ดินพร้อมสิ่งปลูกสร้าง'],
  'ที่อยู่อาศัย': ['บ้านเดี่ยว', 'บ้านแฝด', 'ทาวน์เฮ้าส์', 'ตึกแถว'],
  'อาคารชุด / คอนโด': ['คอนโดมิเนียม', 'อาคารชุด', 'เซอร์วิสอพาร์ทเมนท์'],
  'พาณิชยกรรม': ['อาคารพาณิชย์', 'ตึกแถว', 'ศูนย์การค้า', 'สำนักงาน'],
  'อุตสาหกรรม / โลจิสติกส์': ['โกดัง', 'โรงงาน', 'นิคมอุตสาหกรรม', 'คลังสินค้า'],
  'โรงแรม / รีสอร์ท': ['โรงแรม', 'รีสอร์ท', 'เกสต์เฮ้าส์'],
  'อื่นๆ': ['อื่นๆ'],
}

const PROVINCES = [
  'กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น',
  'จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่',
  'ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช',
  'นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี',
  'ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา',
  'พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม',
  'มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี',
  'ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ',
  'สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี',
  'สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ',
  'อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี',
]

const ROAD_TYPE_OPTIONS = [
  { value: 'ไม่ซอย / เลียบตลอง', factor: 1.00 },
  { value: 'ซอยสั้น / ออกถนนใหญ่ < 200ม.', factor: 0.90 },
  { value: 'ซอยลึก 200–500ม.', factor: 0.80 },
  { value: 'ซอยลึก > 500ม.', factor: 0.70 },
  { value: 'ทางลัด / ตรอกแคบ', factor: 0.65 },
]
const ROAD_WIDTH_OPTIONS = [
  { value: '≥ 20 ม.', factor: 1.05 }, { value: '12–19 ม.', factor: 1.00 },
  { value: '8–11 ม.', factor: 0.95 }, { value: '6–7 ม. (คสล.)', factor: 0.90 },
  { value: '4–5 ม.', factor: 0.85 }, { value: '< 4 ม. / ทางเท้า', factor: 0.75 },
]
const FRONTAGE_OPTIONS = [
  { value: '≥ 20 ม.', factor: 1.05 }, { value: '12–19 ม.', factor: 1.00 },
  { value: '8–11 ม.', factor: 0.95 }, { value: '5–7 ม.', factor: 0.90 },
  { value: '< 5 ม.', factor: 0.85 },
]
const ZONE_OPTIONS = [
  { value: 'พ.5 (แดง) — พาณิชยกรรมหลัก', factor: 1.40 },
  { value: 'พ.3/4 (แดง) — พาณิชยกรรม', factor: 1.25 },
  { value: 'ย.10 (ส้ม) — อยู่อาศัยหนาแน่นสูง', factor: 1.15 },
  { value: 'ย.7–9 (ส้ม) — อยู่อาศัยหนาแน่นมาก', factor: 1.08 },
  { value: 'ย.4 (สีเหลือง) — พักอาศัยหนาแน่นน้อย', factor: 1.00 },
  { value: 'ย.1–3 (เขียว) — ชนบทและเกษตร', factor: 0.85 },
  { value: 'ก.1–3 (เขียวอ่อน) — เกษตรกรรม', factor: 0.70 },
]
const SOIL_OPTIONS = [
  { value: 'ถมเรียบร้อย / ใช้ได้เลย', factor: 1.00 }, { value: 'ถมบางส่วน', factor: 0.95 },
  { value: 'ยังไม่ถม', factor: 0.90 }, { value: 'ต่ำกว่าถนน / มีน้ำขัง', factor: 0.80 },
]
const RISK_FACTORS = [
  { key: 'flood', label: 'เสี่ยงน้ำท่วม', penalty: -15 },
  { key: 'hardAccess', label: 'เข้าถึงยาก / ซอยตัน', penalty: -10 },
  { key: 'irregularShape', label: 'รูปแปลงผิดปกติ', penalty: -8 },
  { key: 'encumbrance', label: 'มีภาระผูกพัน', penalty: -20 },
  { key: 'dispute', label: 'มีข้อพิพาท / ครอบครอง', penalty: -25 },
  { key: 'noUtilities', label: 'ไม่มีสาธารณูปโภค', penalty: -7 },
  { key: 'nuisance', label: 'ติดสิ่งรบกวน (โรงงาน/กม.)', penalty: -10 },
  { key: 'incompleteDeed', label: 'โฉนดไม่สมบูรณ์ / น.ส.3', penalty: -15 },
]

const fmt = (n) => Math.round(n || 0).toLocaleString('th-TH')

const INITIAL_FORM = {
  assessmentType: 'ขายฝาก', propertyType: 'ที่ดิน', propertySubtype: 'ที่ดินเปล่า (โฉนด)',
  projectName: '', assessmentDate: new Date().toISOString().split('T')[0], assessorName: '',
  titleDeedNo: '', surveyPage: '', landNo: '', mapSheet: '',
  province: 'กรุงเทพมหานคร', district: '', subdistrict: '',
  areaRai: 0, areaNgan: 0, areaSqw: 0, govPrice: 0,
  roadType: '', roadWidth: '', landFrontage: '', distanceFromMain: '',
  zoneColor: '', soilCondition: '', compPrice: '', compSource: '', locationNote: '',
  risks: { flood: false, hardAccess: false, irregularShape: false, encumbrance: false, dispute: false, noUtilities: false, nuisance: false, incompleteDeed: false },
  ltvRate: 50, linkedCustomer: '',
  lat: null, lng: null,
  requestedLoan: '',
}

// ── UI Components ──────────────────────────────────────
function Stepper({ step }) {
  const steps = ['ประเภท & โฉนด', 'ปัจจัยทำเล', 'ความเสี่ยง', 'ผลประเมิน']
  return (
    <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 4 }}>
      {steps.map((s, i) => {
        const num = i + 1; const done = step > num; const active = step === num
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? BRAND.teal : active ? BRAND.gold : BRAND.border, color: done || active ? '#000' : BRAND.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                {done ? '✓' : num}
              </div>
              <span style={{ fontSize: 12, color: active ? BRAND.gold : done ? BRAND.teal : BRAND.textSec, fontWeight: active ? 700 : 400 }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ width: 28, height: 2, background: step > i + 1 ? BRAND.teal : BRAND.border, margin: '0 4px' }} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

const Card = ({ children, style }) => (
  <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: 20, ...style }}>{children}</div>
)
const Label = ({ children }) => <div style={{ fontSize: 12, color: BRAND.textSec, marginBottom: 6 }}>{children}</div>
const inputBase = { width: '100%', background: '#050B18', border: `1px solid ${BRAND.border}`, borderRadius: 8, color: BRAND.textPri, fontSize: 13, padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }
const Inp = (props) => <input {...props} style={{ ...inputBase, ...props.style }} />
const Sel = ({ children, ...props }) => <select {...props} style={{ ...inputBase, ...props.style }}>{children}</select>

// ── History View ───────────────────────────────────────
function printHistoryRow(row) {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  const f = (v) => Number(v) ? Number(v).toLocaleString('th-TH') : (v || '—')
  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title></title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; font-family: 'Sarabun','Segoe UI',sans-serif; }
    body { margin: 6mm; padding: 0; background: white; color: black; font-size: 12px; }
    .top-bar { display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:#1a3a5c; color:white; border-radius:8px; margin-bottom:10px; font-size:11px; }
    .top-bar .l { font-weight:700; font-size:13px; }
    .top-bar .r { text-align:right; line-height:1.6; }
    h2 { font-size:18px; margin:0 0 4px; }
    .sub { color:#555; font-size:12px; margin-bottom:12px; }
    .grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px; }
    .stat { border:1px solid #ccc; border-radius:8px; padding:10px; text-align:center; }
    .stat .lbl { font-size:10px; color:#666; margin-bottom:4px; }
    .stat .val { font-size:15px; font-weight:800; color:#1a3a5c; }
    .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .box { border:1px solid #ccc; border-radius:8px; padding:10px; }
    .box h3 { font-size:12px; font-weight:700; margin:0 0 8px; color:#b45309; }
    .row { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #eee; font-size:11px; }
    .row .k { color:#555; } .row .v { font-weight:600; text-align:right; max-width:55%; }
    .badge { display:inline-block; border:1px solid #ccc; border-radius:20px; padding:2px 10px; font-size:11px; margin-right:6px; margin-bottom:6px; }
    .footer { text-align:center; font-size:10px; color:#888; margin-top:10px; }
    .zoom { zoom: 0.68; }
  </style></head><body><div class="zoom">
  <div class="top-bar">
    <div class="l">AssetX Estate Co., Ltd.<br><span style="font-size:10px;font-weight:400;">รายงานประเมินมูลค่าอสังหาริมทรัพย์</span></div>
    <div class="r">📅 ${dateStr} &nbsp; 🕐 ${timeStr}<br>ผู้ประเมิน: ${row['ผู้ประเมิน'] || '—'} &nbsp;|&nbsp; วันที่ประเมิน: ${row['วันที่ประเมิน'] || '—'}</div>
  </div>
  <div class="badge">${row['ประเภทการประเมิน'] || ''}</div>
  <div class="badge">${row['ประเภทย่อย'] || ''}</div>
  <h2>${row['รหัส/ชื่อทรัพย์'] || '—'}</h2>
  <div class="sub">โฉนดเลขที่ ${row['เลขโฉนด'] || '—'} | ${row['ตำบล/แขวง'] ? 'ต.' + row['ตำบล/แขวง'] + ' ' : ''}${row['อำเภอ/เขต'] ? 'อ.' + row['อำเภอ/เขต'] + ' ' : ''}${row['จังหวัด'] || ''}</div>
  <div class="grid4">
    <div class="stat"><div class="lbl">ราคาประเมินรัฐ</div><div class="val">฿${f(row['ราคาประเมินรัฐ (บ./ตร.ว.)'])}/ตร.ว.</div></div>
    <div class="stat"><div class="lbl">ราคาตลาดโดยประมาณ</div><div class="val">฿${f(row['มูลค่าตลาดรวม'])}</div></div>
    <div class="stat"><div class="lbl">FORCED SALE VALUE</div><div class="val">฿${f(row['FSV (80%)'])}</div></div>
    <div class="stat"><div class="lbl">วงเงินแนะนำ</div><div class="val" style="color:#0d9488;">฿${f(row['วงเงินแนะนำ'])}</div></div>
  </div>
  <div class="grid2">
    <div class="box">
      <h3>📋 รายละเอียดทรัพย์</h3>
      ${[['ประเภทการประเมิน', row['ประเภทการประเมิน']], ['ประเภทอสังหาฯ', (row['ประเภทอสังหาฯ'] || '') + ' — ' + (row['ประเภทย่อย'] || '')], ['เลขโฉนด', row['เลขโฉนด']], ['ระวาง', row['ระวาง']], ['หน้าสำรวจ', row['หน้าสำรวจ']], ['เลขที่ดิน', row['เลขที่ดิน']], ['เนื้อที่', (row['ไร่'] || 0) + ' ไร่ ' + (row['งาน'] || 0) + ' งาน ' + (row['ตร.ว.'] || 0) + ' ตร.ว.'], ['ราคาประเมินกรมธนารักษ์', f(row['ราคาประเมินรัฐ (บ./ตร.ว.)']) + ' บาท/ตร.ว.'], ['ทำเล', row['ทำเล']], ['ถนนหน้าที่ดิน', row['ความกว้างถนน']], ['ผังเมือง', row['ผังเมือง']], ['สภาพดิน', row['สภาพดิน']]].map(([k,v]) => `<div class="row"><span class="k">${k}</span><span class="v">${v || '—'}</span></div>`).join('')}
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div class="box">
        <h3>⚠️ ความเสี่ยงและ SCORE</h3>
        <div style="font-size:28px;font-weight:800;">${row['Property Score'] || 100}</div>
        <div style="font-size:11px;color:#555;">/100</div>
        <div style="font-size:11px;margin-top:6px;color:#666;">${row['ปัจจัยเสี่ยง'] || 'ไม่มี'}</div>
      </div>
      <div class="box">
        <h3>💰 สรุปวงเงิน</h3>
        ${[['มูลค่าตลาด', row['มูลค่าตลาดรวม']], ['FSV (80%)', row['FSV (80%)']], ['วงเงินแนะนำ (LTV ' + (row['LTV Rate (%)'] || '') + '%)', row['วงเงินแนะนำ']], ['วงเงินที่ลูกค้าขอ', row['วงเงินที่ลูกค้าขอ']], ['LTV ลูกค้า (%)', row['LTV ลูกค้า (% ต่อตลาด)'] + '%']].map(([k,v]) => `<div class="row"><span class="k">${k}</span><span class="v">฿${f(v)}</span></div>`).join('')}
      </div>
    </div>
  </div>
  <div class="footer">AssetX Estate Co., Ltd. — พิมพ์: ${now.toLocaleString('th-TH')}</div>
  </div>
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
  </body></html>`)
  win.document.close()
}

const INVESTOR_STATUS_COLORS = {
  'รอการพิจารณา': { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', text: '#F59E0B' },
  'อนุมัติ':        { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', text: '#10B981' },
  'ปฏิเสธ':         { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  text: '#F87171' },
  'สร้างสัญญาแล้ว': { bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.4)', text: '#A5B4FC' },
}

function HistoryView({ appsScriptUrl }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingIdx, setDeletingIdx] = useState(null)
  const [confirmRow, setConfirmRow] = useState(null)
  const [detailRow, setDetailRow] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [sendingRow, setSendingRow] = useState(null)

  const sendToInvestor = async (row) => {
    setSendingRow(row['_rowIndex'])
    try {
      await fetch(appsScriptUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateValuation', rowIndex: row['_rowIndex'], data: { 'สถานะ': 'รอการพิจารณา' } }),
      })
      await fetch(appsScriptUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'notifyInvestor', valuationData: row }),
      })
      setRows(prev => prev.map(r => r['_rowIndex'] === row['_rowIndex'] ? { ...r, 'สถานะ': 'รอการพิจารณา' } : r))
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSendingRow(null)
    }
  }

  useEffect(() => {
    fetch(`${appsScriptUrl}?action=getValuations`)
      .then(r => r.json())
      .then(r => { setRows(r.data || []); setLoading(false) })
      .catch(() => { setError('ไม่สามารถโหลดข้อมูลได้'); setLoading(false) })
  }, [appsScriptUrl])

  const openEdit = (row) => {
    setEditForm({
      'รหัส/ชื่อทรัพย์': row['รหัส/ชื่อทรัพย์'] || '',
      'วันที่ประเมิน': row['วันที่ประเมิน'] || '',
      'ผู้ประเมิน': row['ผู้ประเมิน'] || '',
      'ประเภทการประเมิน': row['ประเภทการประเมิน'] || '',
      'มูลค่าตลาดรวม': row['มูลค่าตลาดรวม'] || '',
      'FSV (80%)': row['FSV (80%)'] || '',
      'วงเงินแนะนำ': row['วงเงินแนะนำ'] || '',
      'Property Score': row['Property Score'] || '',
      'LTV Rate (%)': row['LTV Rate (%)'] || '',
      'วงเงินที่ลูกค้าขอ': row['วงเงินที่ลูกค้าขอ'] || '',
      'ปัจจัยเสี่ยง': row['ปัจจัยเสี่ยง'] || '',
      'หมายเหตุ': row['หมายเหตุ'] || '',
      'สถานะ': row['สถานะ'] || 'รอดำเนินการ',
    })
    setEditRow(row)
  }

  const handleUpdate = async () => {
    if (!editRow) return
    setSaving(true)
    try {
      await fetch(appsScriptUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'updateValuation', rowIndex: editRow['_rowIndex'], data: editForm }),
      })
      setRows(prev => prev.map(r =>
        r['_rowIndex'] === editRow['_rowIndex'] ? { ...r, ...editForm } : r
      ))
      setEditRow(null)
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    const rowIndex = row['_rowIndex']
    if (!rowIndex) { alert('ไม่พบ index ของรายการ — กรุณา reload แล้วลองใหม่'); return }
    setDeletingIdx(rowIndex)
    try {
      await fetch(appsScriptUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteValuation', rowIndex }),
      })
      setRows(prev => prev.filter(r => r['_rowIndex'] !== rowIndex))
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setDeletingIdx(null)
      setConfirmRow(null)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: BRAND.textSec }}>กำลังโหลด...</div>
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#FCA5A5' }}>⚠️ {error}</div>
  if (rows.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: BRAND.textSec }}>ยังไม่มีข้อมูลการประเมิน</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Confirm Dialog */}
      {confirmRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: BRAND.bgCard, border: `1px solid rgba(239,68,68,0.4)`, borderRadius: 16, padding: 24, maxWidth: 360, width: '100%' }}>
            <div style={{ fontSize: 28, marginBottom: 8, textAlign: 'center' }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: BRAND.textPri, marginBottom: 6, textAlign: 'center' }}>ยืนยันการลบ</div>
            <div style={{ fontSize: 13, color: BRAND.textSec, marginBottom: 4, textAlign: 'center' }}>
              {confirmRow['รหัส/ชื่อทรัพย์'] || '—'}
            </div>
            <div style={{ fontSize: 12, color: BRAND.textMut, marginBottom: 20, textAlign: 'center' }}>
              รายการนี้จะถูกลบออกจากระบบและ Google Sheet ถาวร
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmRow(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${BRAND.border}`, background: 'transparent', color: BRAND.textSec, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleDelete(confirmRow)}
                disabled={deletingIdx !== null}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}
              >
                {deletingIdx !== null ? '⏳ กำลังลบ...' : '🗑️ ลบถาวร'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editRow && (() => {
        const inp = { width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${BRAND.border}`, borderRadius: 8, color: BRAND.textPri, fontSize: 13, padding: '8px 10px', outline: 'none', marginTop: 4 }
        const lbl = { fontSize: 11, color: BRAND.textSec, display: 'block', marginBottom: 2 }
        const ef = (k, v) => setEditForm(p => {
          const next = { ...p, [k]: v }
          if (k === 'มูลค่าตลาดรวม' || k === 'LTV Rate (%)') {
            const market = parseFloat(k === 'มูลค่าตลาดรวม' ? v : next['มูลค่าตลาดรวม']) || 0
            const ltv = parseFloat(k === 'LTV Rate (%)' ? v : next['LTV Rate (%)']) || 50
            const fsv = Math.round(market * 0.8)
            next['FSV (80%)'] = fsv
            next['วงเงินแนะนำ'] = Math.round(fsv * (ltv / 100))
          }
          return next
        })
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
            <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 16, padding: 24, maxWidth: 580, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: BRAND.textPri }}>✏️ แก้ไขรายการประเมิน</div>
                <button onClick={() => setEditRow(null)} style={{ background: 'none', border: 'none', color: BRAND.textSec, fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[['รหัส/ชื่อทรัพย์','text'],['วันที่ประเมิน','date'],['ผู้ประเมิน','text'],['ประเภทการประเมิน','text']].map(([k, t]) => (
                  <div key={k}>
                    <label style={lbl}>{k}</label>
                    <input type={t} value={editForm[k]} onChange={e => ef(k, e.target.value)} style={inp} />
                  </div>
                ))}
              </div>

              <div style={{ margin: '14px 0 8px', fontSize: 12, fontWeight: 700, color: BRAND.gold }}>💰 ผลการประเมิน</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[['มูลค่าตลาดรวม','number'],['FSV (80%)','number'],['วงเงินแนะนำ','number'],['วงเงินที่ลูกค้าขอ','number'],['Property Score','number'],['LTV Rate (%)','number']].map(([k, t]) => (
                  <div key={k}>
                    <label style={lbl}>{k}</label>
                    <input type={t} value={editForm[k]} onChange={e => ef(k, e.target.value)} style={inp} />
                  </div>
                ))}
              </div>

              <div style={{ margin: '14px 0 8px', fontSize: 12, fontWeight: 700, color: BRAND.gold }}>📋 อื่นๆ</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>สถานะ</label>
                  <select value={editForm['สถานะ']} onChange={e => ef('สถานะ', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                    {['รอดำเนินการ','อนุมัติแล้ว','ปฏิเสธ','ยกเลิก'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>ปัจจัยเสี่ยง</label>
                  <input type="text" value={editForm['ปัจจัยเสี่ยง']} onChange={e => ef('ปัจจัยเสี่ยง', e.target.value)} style={inp} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={lbl}>หมายเหตุ</label>
                <textarea value={editForm['หมายเหตุ']} onChange={e => ef('หมายเหตุ', e.target.value)}
                  rows={3} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => setEditRow(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${BRAND.border}`, background: 'transparent', color: BRAND.textSec, fontSize: 13, cursor: 'pointer' }}>ยกเลิก</button>
                <button onClick={handleUpdate} disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: BRAND.teal, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Detail Modal */}
      {detailRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 16, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: BRAND.textPri }}>📋 รายละเอียดการประเมิน</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => printHistoryRow(detailRow)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: BRAND.gold, color: '#000', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>📄 PDF</button>
                <button onClick={() => setDetailRow(null)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${BRAND.border}`, background: 'transparent', color: BRAND.textSec, fontSize: 12, cursor: 'pointer' }}>✕ ปิด</button>
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 17, color: BRAND.textPri, marginBottom: 4 }}>{detailRow['รหัส/ชื่อทรัพย์'] || '—'}</div>
            <div style={{ fontSize: 12, color: BRAND.textSec, marginBottom: 16 }}>
              {detailRow['ประเภทการประเมิน']} • {detailRow['ประเภทย่อย']} • {detailRow['จังหวัด']} • วันที่บันทึก: {detailRow['วันที่บันทึก']}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
              {[['มูลค่าตลาด', `฿${fmt(detailRow['มูลค่าตลาดรวม'])}`], ['FSV (80%)', `฿${fmt(detailRow['FSV (80%)'])}`], ['วงเงินแนะนำ', `฿${fmt(detailRow['วงเงินแนะนำ'])}`], ['Property Score', `${detailRow['Property Score']}/100`], ['วงเงินที่ลูกค้าขอ', `฿${fmt(detailRow['วงเงินที่ลูกค้าขอ'])}`], ['LTV ลูกค้า (%)', `${detailRow['LTV ลูกค้า (% ต่อตลาด)'] || '—'}%`]].map(([k, v]) => (
                <div key={k} style={{ background: BRAND.bg, borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, color: BRAND.textMut }}>{k}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.teal }}>{v}</div>
                </div>
              ))}
            </div>
            {[['📋 รายละเอียดทรัพย์', [['ประเภทอสังหาฯ', detailRow['ประเภทอสังหาฯ']], ['ประเภทย่อย', detailRow['ประเภทย่อย']], ['เลขโฉนด', detailRow['เลขโฉนด']], ['เนื้อที่', `${detailRow['ไร่'] || 0} ไร่ ${detailRow['งาน'] || 0} งาน ${detailRow['ตร.ว.'] || 0} ตร.ว.`], ['ทำเล', detailRow['ทำเล']], ['ผังเมือง', detailRow['ผังเมือง']], ['สภาพดิน', detailRow['สภาพดิน']], ['ผู้ประเมิน', detailRow['ผู้ประเมิน']]]], ['⚠️ ปัจจัยเสี่ยงและหมายเหตุ', [['ปัจจัยเสี่ยง', detailRow['ปัจจัยเสี่ยง']], ['หมายเหตุ', detailRow['หมายเหตุ']], ['Comp ราคา', detailRow['Comp (บ./ตร.ว.)']], ['แหล่ง Comp', detailRow['แหล่ง Comp']]]]].map(([title, fields]) => (
              <div key={title} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.gold, marginBottom: 6 }}>{title}</div>
                {fields.map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${BRAND.border}`, fontSize: 12 }}>
                    <span style={{ color: BRAND.textSec }}>{k}</span>
                    <span style={{ color: BRAND.textPri, textAlign: 'right', maxWidth: '55%' }}>{v || '—'}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontWeight: 700, fontSize: 16, color: BRAND.textPri, marginBottom: 4 }}>
        📋 ประวัติการประเมิน ({rows.length} รายการ)
      </div>
      {[...rows].reverse().map((row, i) => (
        <Card key={row['_rowIndex'] || i} style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: BRAND.textPri, fontSize: 15 }}>{row['รหัส/ชื่อทรัพย์'] || '—'}</div>
              <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 2 }}>
                {row['ประเภทการประเมิน']} • {row['ประเภทย่อย']} • {row['จังหวัด']}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: BRAND.textMut }}>{row['วันที่บันทึก']}</div>
                {(() => {
                  const st = INVESTOR_STATUS_COLORS[row['สถานะ']]
                  return st ? (
                    <span style={{ background: st.bg, border: `1px solid ${st.border}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, color: st.text }}>{row['สถานะ']}</span>
                  ) : (
                    <span style={{ background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.4)', borderRadius: 20, padding: '2px 10px', fontSize: 11, color: BRAND.textSec }}>{row['สถานะ'] || 'รอดำเนินการ'}</span>
                  )
                })()}
              </div>
              {/* ปุ่มส่งนายทุน — แสดงเมื่อยังไม่ส่ง หรือถูกส่งกลับมาแก้ไข */}
              {(!row['สถานะ'] || row['สถานะ'] === 'รอดำเนินการ' || row['สถานะ'] === 'รอการตัดสินใจ') && (
                <button
                  onClick={() => sendToInvestor(row)}
                  disabled={sendingRow === row['_rowIndex']}
                  title="ส่งให้นายทุนตัดสินใจ"
                  style={{ padding: '5px 9px', borderRadius: 8, border: '1px solid rgba(45,212,191,0.4)', background: 'rgba(45,212,191,0.1)', color: BRAND.teal, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
                >
                  {sendingRow === row['_rowIndex'] ? '⏳' : '📤 ส่งนายทุน'}
                </button>
              )}
              <button
                onClick={() => openEdit(row)}
                title="แก้ไขข้อมูล"
                style={{ padding: '5px 9px', borderRadius: 8, border: `1px solid rgba(99,102,241,0.3)`, background: 'rgba(99,102,241,0.08)', color: '#a5b4fc', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
              >
                ✏️
              </button>
              <button
                onClick={() => setDetailRow(row)}
                title="ดูรายละเอียด"
                style={{ padding: '5px 9px', borderRadius: 8, border: `1px solid rgba(45,212,191,0.3)`, background: 'rgba(45,212,191,0.08)', color: BRAND.teal, fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
              >
                👁️
              </button>
              <button
                onClick={() => printHistoryRow(row)}
                title="โหลด PDF"
                style={{ padding: '5px 9px', borderRadius: 8, border: `1px solid rgba(245,158,11,0.3)`, background: 'rgba(245,158,11,0.08)', color: BRAND.gold, fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
              >
                📄
              </button>
              <button
                onClick={() => setConfirmRow(row)}
                title="ลบรายการนี้"
                style={{ padding: '5px 9px', borderRadius: 8, border: `1px solid rgba(239,68,68,0.3)`, background: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
              >
                🗑️
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {[
              ['มูลค่าตลาด', `฿${fmt(row['มูลค่าตลาดรวม'])}`],
              ['FSV (80%)', `฿${fmt(row['FSV (80%)'])}`],
              ['วงเงินแนะนำ', `฿${fmt(row['วงเงินแนะนำ'])}`],
              ['Score', `${row['Property Score']}/100`],
            ].map(([k, v]) => (
              <div key={k} style={{ background: BRAND.bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: BRAND.textMut }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.teal, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── Step 1 ─────────────────────────────────────────────
function Step1({ form, update, customers }) {
  const subtypes = PROPERTY_SUBTYPES[form.propertyType] || ['อื่นๆ']

  const handleCustomerSelect = (val) => {
    update('linkedCustomer', val)
    if (!val) return
    const cust = customers.find(c => String(c.id || c.name) === val)
    if (!cust) return
    if (cust.type === 'ขายฝาก' || cust.type === 'จำนอง') update('assessmentType', cust.type)
    if (cust.name) update('projectName', cust.name)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 18, color: BRAND.textPri, marginBottom: 4 }}>📋 ประเภทการประเมินและข้อมูลโฉนด</div>
        <div style={{ fontSize: 12, color: BRAND.textSec }}>เลือกประเภทและกรอกข้อมูลทรัพย์สิน</div>
      </div>

      {/* Customer Link */}
      {customers.length > 0 && (
        <Card style={{ borderColor: 'rgba(45,212,191,0.3)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.teal, marginBottom: 12 }}>👤 เชื่อมข้อมูลลูกค้า <span style={{ fontSize: 11, fontWeight: 400, color: BRAND.textMut }}>(ไม่บังคับ)</span></div>
          <Label>เลือกลูกค้าจากระบบ</Label>
          <Sel value={form.linkedCustomer} onChange={e => handleCustomerSelect(e.target.value)}>
            <option value="">— ไม่เลือก / กรอกเอง —</option>
            {customers.map(c => (
              <option key={c.id || c.name} value={String(c.id || c.name)}>
                {c.name} ({c.type})
              </option>
            ))}
          </Sel>
          {form.linkedCustomer && (
            <div style={{ marginTop: 8, fontSize: 12, color: BRAND.teal }}>✅ เชื่อมกับลูกค้าแล้ว — ระบบเติมข้อมูลบางส่วนให้อัตโนมัติ</div>
          )}
        </Card>
      )}

      {/* Assessment type */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>⚡ ประเภทการประเมิน</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {ASSESSMENT_TYPES.map(t => (
            <button key={t.value} onClick={() => update('assessmentType', t.value)} style={{ padding: '10px 8px', borderRadius: 10, border: `1px solid ${form.assessmentType === t.value ? BRAND.gold : BRAND.border}`, background: form.assessmentType === t.value ? 'rgba(245,158,11,0.12)' : BRAND.bg, color: BRAND.textPri, cursor: 'pointer', textAlign: 'center', fontSize: 12 }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
              <div style={{ fontWeight: 600 }}>{t.value}</div>
              {t.desc && <div style={{ fontSize: 10, color: BRAND.textSec, marginTop: 2 }}>{t.desc}</div>}
            </button>
          ))}
        </div>
      </Card>

      {/* Property type */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>🏗️ ประเภทอสังหาริมทรัพย์</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
          {PROPERTY_TYPES.map(t => (
            <button key={t.value} onClick={() => { update('propertyType', t.value); update('propertySubtype', (PROPERTY_SUBTYPES[t.value] || ['อื่นๆ'])[0]) }} style={{ padding: '10px 6px', borderRadius: 10, border: `1px solid ${form.propertyType === t.value ? BRAND.teal : BRAND.border}`, background: form.propertyType === t.value ? 'rgba(45,212,191,0.1)' : BRAND.bg, color: BRAND.textPri, cursor: 'pointer', textAlign: 'center', fontSize: 11 }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
              <div style={{ fontWeight: 600 }}>{t.value}</div>
            </button>
          ))}
        </div>
        <Label>ประเภทย่อย</Label>
        <Sel value={form.propertySubtype} onChange={e => update('propertySubtype', e.target.value)}>
          {subtypes.map(s => <option key={s}>{s}</option>)}
        </Sel>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>📌 ข้อมูลการประเมิน</div>
          <Label>ชื่อโครงการ / รหัสทรัพย์</Label>
          <Inp value={form.projectName} onChange={e => update('projectName', e.target.value)} placeholder="เช่น ที่ดินเลียบคลองฯ ซ.20" style={{ marginBottom: 10 }} />
          <Label>วันที่ประเมิน</Label>
          <Inp type="date" value={form.assessmentDate} onChange={e => update('assessmentDate', e.target.value)} style={{ marginBottom: 10 }} />
          <Label>ผู้ประเมิน</Label>
          <Inp value={form.assessorName} onChange={e => update('assessorName', e.target.value)} placeholder="ชื่อผู้ประเมิน" />
        </Card>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold }}>📄 เลขที่โฉนด</div>
            <button
              onClick={() => {
                const deed = form.titleDeedNo ? `เลขโฉนด ${form.titleDeedNo}` : ''
                const prov = form.province ? `จังหวัด${form.province}` : ''
                const q = [deed, prov].filter(Boolean).join(' ')
                window.open(`https://landsmaps.dol.go.th/${q ? '?q=' + encodeURIComponent(q) : ''}`, '_blank')
              }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${BRAND.gold}`, background: 'rgba(245,158,11,0.08)', color: BRAND.gold, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              🌐 LandMap
            </button>
          </div>
          <Label>เลขโฉนดที่ดิน</Label>
          <Inp value={form.titleDeedNo} onChange={e => update('titleDeedNo', e.target.value)} placeholder="เช่น 89062" style={{ marginBottom: 10 }} />
          <Label>ระวาง</Label>
          <Inp value={form.mapSheet} onChange={e => update('mapSheet', e.target.value)} placeholder="เช่น 5237I" style={{ marginBottom: 10 }} />
          <Label>หน้าสำรวจ</Label>
          <Inp value={form.surveyPage} onChange={e => update('surveyPage', e.target.value)} placeholder="เช่น 12560" style={{ marginBottom: 10 }} />
          <Label>เลขที่ดิน</Label>
          <Inp value={form.landNo} onChange={e => update('landNo', e.target.value)} placeholder="เช่น 10" />
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>📍 ที่ตั้ง</div>
          <Label>จังหวัด</Label>
          <Sel value={form.province} onChange={e => update('province', e.target.value)} style={{ marginBottom: 10 }}>
            {PROVINCES.map(p => <option key={p}>{p}</option>)}
          </Sel>
          <Label>อำเภอ / เขต</Label>
          <Inp value={form.district} onChange={e => update('district', e.target.value)} placeholder="เช่น มีนบุรี" style={{ marginBottom: 10 }} />
          <Label>ตำบล / แขวง</Label>
          <Inp value={form.subdistrict} onChange={e => update('subdistrict', e.target.value)} placeholder="เช่น มีนบุรี" />
        </Card>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>📐 เนื้อที่และราคาประเมิน</div>
          <Label>เนื้อที่ (ไร่-งาน-ตร.ว.)</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
            {[['areaRai','ไร่'],['areaNgan','งาน'],['areaSqw','ตร.ว.']].map(([k,lbl]) => (
              <div key={k}>
                <input type="number" min="0" value={form[k]} onChange={e => update(k, +e.target.value)} style={{ ...inputBase, textAlign: 'center', padding: '9px 4px' }} />
                <div style={{ fontSize: 10, color: BRAND.textSec, textAlign: 'center', marginTop: 3 }}>{lbl}</div>
              </div>
            ))}
          </div>
          <Label>ราคาประเมิน กรมธนารักษ์ (บาท/ตร.ว.)</Label>
          <input type="number" min="0" value={form.govPrice} onChange={e => update('govPrice', +e.target.value)} style={inputBase} />
        </Card>
      </div>
    </div>
  )
}

// ── Map Picker ─────────────────────────────────────────
function MapPicker({ form, update }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const [searching, setSearching] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [latInput, setLatInput] = useState(form.lat != null ? String(form.lat) : '')
  const [lngInput, setLngInput] = useState(form.lng != null ? String(form.lng) : '')
  const mapHeight = typeof window !== 'undefined' && window.innerWidth < 640 ? 260 : 320

  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return
    fixLeafletIcons()

    const map = L.map(mapRef.current, {
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
    }).setView([13.0, 101.5], 6)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    map.on('click', async (e) => {
      const { lat, lng } = e.latlng
      update('lat', lat)
      update('lng', lng)
      setLatInput(lat.toFixed(6))
      setLngInput(lng.toFixed(6))
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(map)
        markerRef.current.bindPopup('📍 ตำแหน่งทรัพย์สิน').openPopup()
      }
      setGeocoding(true)
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=th`)
        const data = await res.json()
        if (data.address) {
          const addr = data.address
          const province = (addr.state || '').replace(/^จังหวัด/, '').trim()
          const district = (addr.county || addr.city_district || addr.town || '').replace(/^(อำเภอ|เขต)/, '').trim()
          const subdistrict = (addr.suburb || addr.village || addr.quarter || '').replace(/^(ตำบล|แขวง)/, '').trim()
          if (province) update('province', province)
          if (district) update('district', district)
          if (subdistrict) update('subdistrict', subdistrict)
        }
      } catch {}
      setGeocoding(false)
    })

    mapInstanceRef.current = map

    if (form.lat && form.lng) {
      markerRef.current = L.marker([form.lat, form.lng]).addTo(map)
      map.setView([form.lat, form.lng], 14)
    }

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [])

  const handleSearch = async () => {
    const parts = [form.subdistrict, form.district, form.province].filter(Boolean)
    if (parts.length === 0) {
      alert('กรุณากรอก จังหวัด/อำเภอ/ตำบล ใน Step 1 ก่อน')
      return
    }
    setSearching(true)
    try {
      const q = encodeURIComponent(parts.join(' ') + ' ประเทศไทย')
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`)
      const data = await res.json()
      if (data.length > 0) {
        placeMarker(parseFloat(data[0].lat), parseFloat(data[0].lon))
      } else {
        alert('ไม่พบตำแหน่ง กรุณาคลิกบนแผนที่แทน')
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการค้นหาตำแหน่ง')
    } finally {
      setSearching(false)
    }
  }

  const placeMarker = async (lat, lng) => {
    if (!mapInstanceRef.current) return
    update('lat', lat)
    update('lng', lng)
    setLatInput(String(lat))
    setLngInput(String(lng))
    mapInstanceRef.current.setView([lat, lng], 15)
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current)
      markerRef.current.bindPopup('📍 ตำแหน่งทรัพย์สิน').openPopup()
    }
    setGeocoding(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=th`)
      const data = await res.json()
      if (data.address) {
        const addr = data.address
        const province = (addr.state || '').replace(/^จังหวัด/, '').trim()
        const district = (addr.county || addr.city_district || addr.town || '').replace(/^(อำเภอ|เขต)/, '').trim()
        const subdistrict = (addr.suburb || addr.village || addr.quarter || '').replace(/^(ตำบล|แขวง)/, '').trim()
        if (province) update('province', province)
        if (district) update('district', district)
        if (subdistrict) update('subdistrict', subdistrict)
      }
    } catch {}
    setGeocoding(false)
  }

  const handleCoordConfirm = () => {
    const lat = parseFloat(latInput)
    const lng = parseFloat(lngInput)
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('พิกัดไม่ถูกต้อง\nละติจูด: -90 ถึง 90\nลองจิจูด: -180 ถึง 180')
      return
    }
    placeMarker(lat, lng)
  }

  const handleClear = () => {
    update('lat', null)
    update('lng', null)
    setLatInput('')
    setLngInput('')
    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
  }

  return (
    <Card style={{ borderColor: 'rgba(45,212,191,0.3)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.teal, marginBottom: 12 }}>🗺️ ปักหมุดสถานที่ทรัพย์สิน</div>

      {/* ช่องกรอกพิกัดด้วยมือ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 10, alignItems: 'flex-end' }}>
        <div>
          <Label>ละติจูด (Latitude)</Label>
          <Inp
            type="number" step="any"
            value={latInput}
            onChange={e => setLatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCoordConfirm()}
            placeholder="เช่น 13.75398"
          />
        </div>
        <div>
          <Label>ลองจิจูด (Longitude)</Label>
          <Inp
            type="number" step="any"
            value={lngInput}
            onChange={e => setLngInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCoordConfirm()}
            placeholder="เช่น 100.50144"
          />
        </div>
        <button onClick={handleCoordConfirm} style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${BRAND.teal}`, background: 'rgba(45,212,191,0.12)', color: BRAND.teal, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          📍 ยืนยัน
        </button>
      </div>

      {/* ปุ่มค้นหา + สถานะ */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={handleSearch} disabled={searching} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${BRAND.border}`, background: BRAND.bg, color: BRAND.textSec, fontSize: 12, cursor: 'pointer' }}>
          {searching ? '⏳ กำลังค้นหา...' : '🔍 ค้นหาจากที่อยู่ (Step 1)'}
        </button>
        {form.lat && form.lng && (
          <>
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(45,212,191,0.08)', border: `1px solid rgba(45,212,191,0.3)`, fontSize: 11, color: BRAND.teal }}>
              ✅ บันทึกแล้ว: {Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}
            </div>
            <button onClick={handleClear} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${BRAND.border}`, background: 'transparent', color: BRAND.textSec, fontSize: 11, cursor: 'pointer' }}>
              ✕ ล้าง
            </button>
          </>
        )}
      </div>

      <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${BRAND.border}` }}>
        <div ref={mapRef} style={{ width: '100%', height: mapHeight }} />
      </div>
      <div style={{ fontSize: 11, color: BRAND.textMut, marginTop: 6 }}>
        {geocoding
          ? <span style={{ color: BRAND.teal }}>⏳ กำลังดึงที่อยู่จากพิกัด...</span>
          : '💡 กรอกพิกัดในช่องด้านบน / คลิกบนแผนที่ / หรือกด "ค้นหาจากที่อยู่" — เติมจังหวัด/อำเภอ/ตำบลอัตโนมัติ'
        }
      </div>
    </Card>
  )
}

// ── Market Search Panel ─────────────────────────────────
function MarketSearchPanel({ form, update }) {
  const [manualPrice, setManualPrice] = useState('')
  const [manualSource, setManualSource] = useState('')

  const location = [form.district, form.province].filter(Boolean).join(' ')
  const type = form.propertyType || 'ที่ดิน'
  const q = encodeURIComponent(`${type} ${location} ราคา`)
  const qEn = encodeURIComponent(`${type} ${form.province} price per rai`)

  const portals = [
    {
      name: 'DDproperty',
      icon: '🏠',
      url: `https://www.ddproperty.com/property-for-sale?freetext=${encodeURIComponent(`${type} ${location}`)}`,
      color: '#E53E3E',
    },
    {
      name: 'Fazwaz',
      icon: '🏡',
      url: `https://www.fazwaz.com/search?search=${q}`,
      color: '#D69E2E',
    },
    {
      name: 'Hipflat',
      icon: '🏘️',
      url: `https://www.hipflat.com/th/search?query=${q}`,
      color: '#38A169',
    },
    {
      name: 'Livinginsider',
      icon: '🔑',
      url: `https://www.livinginsider.com/search?keyword=${encodeURIComponent(`${type} ${location}`)}`,
      color: '#3182CE',
    },
    {
      name: 'Google ราคาตลาด',
      icon: '🔍',
      url: `https://www.google.com/search?q=${encodeURIComponent(`ราคา${type} ${location} ตร.ว. 2568`)}`,
      color: '#805AD5',
    },
    {
      name: 'Pantip ราคาที่ดิน',
      icon: '💬',
      url: `https://pantip.com/search?q=${encodeURIComponent(`ราคาที่ดิน ${location}`)}`,
      color: '#DD6B20',
    },
  ]

  return (
    <Card style={{ borderColor: 'rgba(45,212,191,0.3)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.teal, marginBottom: 4 }}>🔍 ค้นหาราคาตลาดจริง</div>
      <div style={{ fontSize: 11, color: BRAND.textSec, marginBottom: 12 }}>
        กดปุ่มด้านล่างเพื่อดูราคาตลาดจริง → จดราคา → กรอกใน "Comp" ด้านบน
        {location && <span style={{ color: BRAND.teal }}> ({type} · {location})</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {portals.map(p => (
          <a
            key={p.name}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: `1px solid ${BRAND.border}`, background: BRAND.bg, textDecoration: 'none', color: BRAND.textPri }}
          >
            <span style={{ fontSize: 18 }}>{p.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: p.color }}>{p.name}</div>
              <div style={{ fontSize: 10, color: BRAND.textSec }}>เปิดดูราคา ↗</div>
            </div>
          </a>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${BRAND.border}`, paddingTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.gold, marginBottom: 8 }}>📝 กรอกราคาที่หามาได้</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 4 }}>ราคาตลาด Comp (บาท/ตร.ว.)</div>
            <input
              type="number"
              value={manualPrice}
              onChange={e => setManualPrice(e.target.value)}
              placeholder="เช่น 25000"
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${BRAND.border}`, borderRadius: 8, color: BRAND.textPri, fontSize: 13, padding: '8px 10px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 4 }}>แหล่งที่มา</div>
            <input
              value={manualSource}
              onChange={e => setManualSource(e.target.value)}
              placeholder="เช่น DDproperty ซ.20"
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${BRAND.border}`, borderRadius: 8, color: BRAND.textPri, fontSize: 13, padding: '8px 10px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button
            disabled={!manualPrice}
            onClick={() => {
              update('compPrice', parseFloat(manualPrice))
              update('compSource', manualSource || 'ค้นหาราคาตลาด')
              setManualPrice('')
              setManualSource('')
            }}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: manualPrice ? BRAND.teal : BRAND.border, color: manualPrice ? '#000' : BRAND.textMut, fontSize: 12, fontWeight: 700, cursor: manualPrice ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
          >
            ✓ เติม
          </button>
        </div>
      </div>
    </Card>
  )
}

// ── Step 2 ─────────────────────────────────────────────
function Step2({ form, update, calc, comps = [] }) {
  // ราคาอ้างอิงจากประวัติในพื้นที่เดียวกัน
  const relevantComps = comps.filter(c =>
    c['จังหวัด'] === form.province && c['ประเภทอสังหาฯ'] === form.propertyType
  )
  const avgGovPrice = relevantComps.length > 0
    ? Math.round(relevantComps.reduce((s, c) => s + (parseFloat(c['ราคาประเมินรัฐ (บ./ตร.ว.)']) || 0), 0) / relevantComps.length)
    : null
  const avgMarketPrice = relevantComps.length > 0
    ? Math.round(relevantComps.reduce((s, c) => s + (parseFloat(c['ราคาตลาด (บ./ตร.ว.)']) || 0), 0) / relevantComps.length)
    : null
  const avgComp = relevantComps.filter(c => parseFloat(c['Comp (บ./ตร.ว.)']) > 0)
  const avgCompPrice = avgComp.length > 0
    ? Math.round(avgComp.reduce((s, c) => s + (parseFloat(c['Comp (บ./ตร.ว.)']) || 0), 0) / avgComp.length)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 18, color: BRAND.textPri, marginBottom: 4 }}>📖 ปัจจัยทำเลและสภาพที่ดิน</div>
        <div style={{ fontSize: 12, color: BRAND.textSec }}>ข้อมูลเหล่านี้ส่งผลต่อราคาตลาดโดยตรง</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>🛣️ ทำเลและการเข้าถึง</div>
          <Label>ทำเล / ระยะจากถนนใหญ่</Label>
          <Sel value={form.roadType} onChange={e => update('roadType', e.target.value)} style={{ marginBottom: 10 }}>
            <option value="">— เลือกทำเล —</option>
            {ROAD_TYPE_OPTIONS.map(o => <option key={o.value}>{o.value}</option>)}
          </Sel>
          <Label>ความกว้างถนนหน้าที่ดิน</Label>
          <Sel value={form.roadWidth} onChange={e => update('roadWidth', e.target.value)} style={{ marginBottom: 10 }}>
            <option value="">— เลือกความกว้าง —</option>
            {ROAD_WIDTH_OPTIONS.map(o => <option key={o.value}>{o.value}</option>)}
          </Sel>
          <Label>หน้ากว้างที่ดิน</Label>
          <Sel value={form.landFrontage} onChange={e => update('landFrontage', e.target.value)} style={{ marginBottom: 10 }}>
            <option value="">— เลือกหน้ากว้าง —</option>
            {FRONTAGE_OPTIONS.map(o => <option key={o.value}>{o.value}</option>)}
          </Sel>
          <Label>ระยะห่างถนนใหญ่ (เมตร)</Label>
          <Inp value={form.distanceFromMain} onChange={e => update('distanceFromMain', e.target.value)} placeholder="เช่น 845 เมตร" />
        </Card>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>🏙️ ลักษณะที่ดินและผังเมือง</div>
          <Label>ผังเมือง (สี)</Label>
          <Sel value={form.zoneColor} onChange={e => update('zoneColor', e.target.value)} style={{ marginBottom: 10 }}>
            <option value="">— เลือกผังเมือง —</option>
            {ZONE_OPTIONS.map(o => <option key={o.value}>{o.value}</option>)}
          </Sel>
          <Label>สภาพดิน</Label>
          <Sel value={form.soilCondition} onChange={e => update('soilCondition', e.target.value)} style={{ marginBottom: 10 }}>
            <option value="">— เลือกสภาพดิน —</option>
            {SOIL_OPTIONS.map(o => <option key={o.value}>{o.value}</option>)}
          </Sel>
          <Label>ราคาตลาดอ้างอิง Comp (บาท/ตร.ว.)</Label>
          <Inp type="number" min="0" value={form.compPrice} onChange={e => update('compPrice', e.target.value)} placeholder="ระบุถ้ามี" style={{ marginBottom: 10 }} />
          <Label>แหล่งที่มา Comp</Label>
          <Inp value={form.compSource} onChange={e => update('compSource', e.target.value)} placeholder="เช่น ซ.20 ถนนแล้ว" />
          {relevantComps.length > 0 && (
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: `1px solid rgba(245,158,11,0.25)` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.gold, marginBottom: 8 }}>
                📊 ราคาอ้างอิงจากประวัติ {form.province} ({form.propertyType}) — {relevantComps.length} รายการ
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {avgGovPrice > 0 && (
                  <button
                    onClick={() => update('govPrice', avgGovPrice)}
                    style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid rgba(245,158,11,0.4)`, background: 'transparent', color: BRAND.textPri, fontSize: 11, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ color: BRAND.textSec, fontSize: 10 }}>เฉลี่ยราคาประเมินรัฐ</div>
                    <div style={{ fontWeight: 700, color: BRAND.gold }}>฿{fmt(avgGovPrice)}/ตร.ว.</div>
                    <div style={{ fontSize: 10, color: BRAND.teal }}>👆 คลิกเติม</div>
                  </button>
                )}
                {avgCompPrice > 0 && (
                  <button
                    onClick={() => { update('compPrice', avgCompPrice); update('compSource', `ค่าเฉลี่ยจากประวัติ ${form.province}`) }}
                    style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid rgba(245,158,11,0.4)`, background: 'transparent', color: BRAND.textPri, fontSize: 11, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ color: BRAND.textSec, fontSize: 10 }}>เฉลี่ยราคาตลาด Comp</div>
                    <div style={{ fontWeight: 700, color: BRAND.gold }}>฿{fmt(avgCompPrice)}/ตร.ว.</div>
                    <div style={{ fontSize: 10, color: BRAND.teal }}>👆 คลิกเติม</div>
                  </button>
                )}
                {avgMarketPrice > 0 && !avgCompPrice && (
                  <button
                    onClick={() => { update('compPrice', avgMarketPrice); update('compSource', `ค่าเฉลี่ยตลาดจากประวัติ ${form.province}`) }}
                    style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid rgba(245,158,11,0.4)`, background: 'transparent', color: BRAND.textPri, fontSize: 11, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ color: BRAND.textSec, fontSize: 10 }}>เฉลี่ยราคาตลาดรวม</div>
                    <div style={{ fontWeight: 700, color: BRAND.gold }}>฿{fmt(avgMarketPrice)}/ตร.ว.</div>
                    <div style={{ fontSize: 10, color: BRAND.teal }}>👆 คลิกเติม Comp</div>
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
      <Card style={{ borderColor: 'rgba(45,212,191,0.3)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.teal, marginBottom: 12 }}>🧮 ผลคำนวณราคาตลาดเบื้องต้น</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: 'ราคาประเมินรัฐ', value: `฿${fmt(form.govPrice)}`, sub: 'บาท/ตร.ว.' },
            { label: 'ราคาตลาดคำนวณ', value: `฿${fmt(calc.calculatedMarketPrice)}`, sub: 'บาท/ตร.ว.' },
            { label: 'ราคาตลาด/ตร.ว.', value: `฿${fmt(calc.effectiveMarketPrice)}`, sub: 'บาท/ตร.ว.' },
            { label: 'มูลค่าตลาดรวม', value: `฿${fmt(calc.marketValue)}`, sub: 'บาท', hi: true },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center', padding: 12, background: BRAND.bg, borderRadius: 10, border: `1px solid ${item.hi ? 'rgba(45,212,191,0.3)' : BRAND.border}` }}>
              <div style={{ fontSize: 11, color: BRAND.textSec, marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: item.hi ? BRAND.teal : BRAND.textPri }}>{item.value}</div>
              <div style={{ fontSize: 10, color: BRAND.textMut }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <Label>หมายเหตุทำเล / สภาพพื้นที่</Label>
        <textarea value={form.locationNote} onChange={e => update('locationNote', e.target.value)} placeholder="บันทึกเพิ่มเติม เช่น สภาพพื้นที่ ทิศทาง สิ่งแวดล้อม..." style={{ width: '100%', background: BRAND.bg, border: `1px solid ${BRAND.border}`, borderRadius: 8, color: BRAND.textPri, fontSize: 13, padding: '10px 12px', outline: 'none', resize: 'vertical', minHeight: 80, boxSizing: 'border-box' }} />
      </Card>
      <MarketSearchPanel form={form} update={update} />
      <MapPicker form={form} update={update} />
    </div>
  )
}

// ── Step 3 ─────────────────────────────────────────────
function Step3({ form, update, calc }) {
  const score = calc.propertyScore
  const scoreColor = score >= 80 ? BRAND.success : score >= 60 ? BRAND.gold : '#EF4444'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 18, color: BRAND.textPri, marginBottom: 4 }}>⚠️ ปัจจัยความเสี่ยงทรัพย์</div>
        <div style={{ fontSize: 12, color: BRAND.textSec }}>ทำเครื่องหมายปัจจัยที่พบในทรัพย์นี้</div>
      </div>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {RISK_FACTORS.map(rf => (
            <label key={rf.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${form.risks[rf.key] ? 'rgba(239,68,68,0.4)' : BRAND.border}`, background: form.risks[rf.key] ? 'rgba(239,68,68,0.08)' : BRAND.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={form.risks[rf.key]} onChange={e => update('risks', { ...form.risks, [rf.key]: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#EF4444', cursor: 'pointer' }} />
                <span style={{ fontSize: 13, color: BRAND.textPri }}>{rf.label}</span>
              </div>
              <span style={{ fontSize: 11, color: '#F87171', fontWeight: 600 }}>{rf.penalty}pt</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: BRAND.bg, borderRadius: 12, border: `1px solid ${scoreColor}40` }}>
          <div>
            <div style={{ fontSize: 11, color: BRAND.textSec, marginBottom: 4 }}>Property Score</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}</div>
            <div style={{ fontSize: 12, color: BRAND.textSec }}>/100</div>
            <div style={{ fontSize: 13, color: scoreColor, marginTop: 4 }}>{score >= 80 ? 'ดีมาก ✅' : score >= 60 ? 'พอใช้' : 'มีความเสี่ยงสูง ⚠️'}</div>
          </div>
          <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="40" cy="40" r="32" fill="none" stroke={BRAND.border} strokeWidth="8" />
            <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor} strokeWidth="8" strokeDasharray={`${(score / 100) * 201} 201`} strokeLinecap="round" />
          </svg>
        </div>
      </Card>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 16 }}>🏦 กำหนด LTV RATE</div>
        <input type="range" min="20" max="75" step="5" value={form.ltvRate} onChange={e => update('ltvRate', +e.target.value)} style={{ width: '100%', accentColor: BRAND.gold, cursor: 'pointer' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: BRAND.textSec }}>
          <span>20% — อนุรักษ์นิยม</span>
          <span style={{ fontWeight: 700, fontSize: 18, color: BRAND.gold }}>{form.ltvRate}%</span>
          <span>75% — สูงสุด</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: BRAND.textMut, marginTop: 2 }}>50% — มาตรฐาน</div>
      </Card>
    </div>
  )
}

// ── Step 4 ─────────────────────────────────────────────
function Step4({ form, calc, update }) {
  const reqLoan = parseFloat(form.requestedLoan) || 0
  const reqLtv = calc.marketValue > 0 ? (reqLoan / calc.marketValue) * 100 : 0
  const reqLtvVsFsv = calc.fsv > 0 ? (reqLoan / calc.fsv) * 100 : 0
  const isOverLimit = reqLoan > calc.recommendedLoan
  const reqColor = reqLoan === 0 ? BRAND.textSec : isOverLimit ? '#EF4444' : BRAND.success
  return (
    <div id="print-area" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, background: BRAND.teal, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#000' }}>X</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: BRAND.textPri }}>AssetX Estate Co., Ltd.</div>
            <div style={{ fontSize: 11, color: BRAND.textSec }}>บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: BRAND.textSec }}>
          <div>รายงานประเมินมูลค่าอสังหาริมทรัพย์</div>
          <div>วันที่ {form.assessmentDate} | ผู้ประเมิน: {form.assessorName || '—'}</div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 20, padding: '3px 12px', fontSize: 12, color: BRAND.gold }}>{form.assessmentType}</span>
          <span style={{ background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 20, padding: '3px 12px', fontSize: 12, color: BRAND.teal }}>{form.propertySubtype}</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.textPri }}>{form.projectName || form.propertySubtype}</div>
        <div style={{ fontSize: 13, color: BRAND.textSec }}>โฉนดเลขที่ {form.titleDeedNo || '—'} | {form.subdistrict ? `ต.${form.subdistrict} ` : ''}{form.district ? `อ.${form.district} ` : ''}{form.province}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { icon: '🏛️', label: 'ราคาประเมินรัฐ', value: `฿${fmt(calc.govPriceTotal)}`, sub: `${fmt(form.govPrice)} บาท/ตร.ว.` },
          { icon: '📊', label: 'ราคาตลาดโดยประมาณ', value: `฿${fmt(calc.marketValue)}`, sub: `${fmt(calc.effectiveMarketPrice)} บาท/ตร.ว.` },
          { icon: '🔥', label: 'FORCED SALE VALUE', value: `฿${fmt(calc.fsv)}`, sub: '80% ของราคาตลาด' },
          { icon: '🏦', label: 'วงเงินขายฝากแนะนำ', value: `฿${fmt(calc.recommendedLoan)}`, sub: `LTV ${form.ltvRate}% × FSV`, hi: true },
        ].map(item => (
          <div key={item.label} style={{ padding: 14, borderRadius: 12, border: `1px solid ${item.hi ? 'rgba(45,212,191,0.4)' : BRAND.border}`, background: item.hi ? 'rgba(45,212,191,0.06)' : BRAND.bgCard, textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{item.icon}</div>
            <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: item.hi ? BRAND.teal : BRAND.textPri }}>{item.value}</div>
            <div style={{ fontSize: 10, color: BRAND.textMut, marginTop: 4 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>📋 รายละเอียดทรัพย์</div>
          {[
            ['ประเภทการประเมิน', form.assessmentType],
            ['ประเภทอสังหาริมทรัพย์', `${form.propertyType} — ${form.propertySubtype}`],
            ['เนื้อที่', `${form.areaRai} ไร่ ${form.areaNgan} งาน ${form.areaSqw} ตร.ว. (${fmt(calc.totalSqw)} ตร.ว.)`],
            ['ราคาประเมินกรมธนารักษ์', `${fmt(form.govPrice)} บาท/ตร.ว.`],
            ['ทำเล', form.roadType || '—'], ['ถนนหน้าที่ดิน', form.roadWidth || '—'],
            ['หน้ากว้าง', form.landFrontage || '—'], ['ผังเมือง', form.zoneColor || '—'],
            ['สภาพดิน', form.soilCondition || '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${BRAND.border}`, fontSize: 12 }}>
              <span style={{ color: BRAND.textSec }}>{k}</span>
              <span style={{ color: BRAND.textPri, textAlign: 'right', maxWidth: '55%' }}>{v}</span>
            </div>
          ))}
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>⚠️ ความเสี่ยงและ SCORE</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: calc.propertyScore >= 80 ? BRAND.success : BRAND.gold }}>{calc.propertyScore}</div>
            <div style={{ fontSize: 12, color: BRAND.textSec }}>/100 — {calc.propertyScore >= 80 ? 'ดีมาก ✅' : 'พอใช้'}</div>
            {RISK_FACTORS.filter(rf => form.risks[rf.key]).length === 0
              ? <div style={{ marginTop: 8, fontSize: 12, color: BRAND.success }}>ไม่พบปัจจัยเสี่ยง</div>
              : <div style={{ marginTop: 8, fontSize: 12, color: '#FCA5A5' }}>{RISK_FACTORS.filter(rf => form.risks[rf.key]).map(rf => rf.label).join(', ')}</div>
            }
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>💰 สรุปวงเงิน</div>
            {[['มูลค่าตลาด', calc.marketValue], ['FSV (80%)', calc.fsv], [`วงเงินแนะนำ (LTV ${form.ltvRate}%)`, calc.recommendedLoan]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${BRAND.border}`, fontSize: 12 }}>
                <span style={{ color: BRAND.textSec }}>{k}</span>
                <span style={{ color: BRAND.textPri, fontWeight: 600 }}>฿{fmt(v)}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: BRAND.textSec }}>วงเงินขายฝากที่แนะนำ</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.teal }}>฿{fmt(calc.recommendedLoan)}</div>
            </div>
          </Card>

          {/* วงเงินที่ลูกค้าเสนอขอ */}
          <Card style={{ borderColor: reqLoan > 0 ? `${reqColor}50` : BRAND.border }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>🙋 วงเงินที่ลูกค้าเสนอขอ</div>
            <Label>ระบุวงเงินที่ลูกค้าต้องการ (บาท)</Label>
            <input
              type="number" min="0" step="10000"
              value={form.requestedLoan}
              onChange={e => update('requestedLoan', e.target.value)}
              placeholder="เช่น 1500000"
              style={{ ...inputBase, marginBottom: 14, fontSize: 15, fontWeight: 600 }}
            />

            {reqLoan > 0 && (
              <>
                {/* ตารางเปรียบเทียบ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'LTV ต่อราคาตลาด', value: `${reqLtv.toFixed(2)}%`, sub: `฿${fmt(reqLoan)} ÷ ฿${fmt(calc.marketValue)}` },
                    { label: 'LTV ต่อ FSV (80%)', value: `${reqLtvVsFsv.toFixed(2)}%`, sub: `฿${fmt(reqLoan)} ÷ ฿${fmt(calc.fsv)}` },
                  ].map(item => (
                    <div key={item.label} style={{ padding: 12, borderRadius: 10, background: BRAND.bg, border: `1px solid ${BRAND.border}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: reqColor }}>{item.value}</div>
                      <div style={{ fontSize: 10, color: BRAND.textMut, marginTop: 3 }}>{item.sub}</div>
                    </div>
                  ))}
                </div>

                {/* ผลเทียบวงเงินแนะนำ */}
                <div style={{ padding: '10px 14px', borderRadius: 10, background: isOverLimit ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${isOverLimit ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.35)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, color: BRAND.textSec }}>เทียบกับวงเงินแนะนำ (฿{fmt(calc.recommendedLoan)})</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: reqColor, marginTop: 2 }}>
                      {isOverLimit
                        ? `⚠️ เกินวงเงิน ฿${fmt(reqLoan - calc.recommendedLoan)}`
                        : `✅ อยู่ในวงเงิน เหลือ ฿${fmt(calc.recommendedLoan - reqLoan)}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: BRAND.textSec }}>ส่วนต่าง LTV</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: reqColor }}>
                      {isOverLimit ? '+' : '-'}{Math.abs(reqLtv - form.ltvRate).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
      {form.lat && form.lng && (
        <MiniMap lat={form.lat} lng={form.lng} label={form.projectName || form.province} />
      )}
      <div style={{ fontSize: 11, color: BRAND.textMut, textAlign: 'center', marginTop: 8 }}>
        AssetX Estate Co., Ltd. — Generated: {new Date().toLocaleString('th-TH')}
      </div>
    </div>
  )
}

// ── Mini Map (Step 4) ───────────────────────────────────
function MiniMap({ lat, lng, label }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return
    fixLeafletIcons()

    const map = L.map(mapRef.current, { zoomControl: false, dragging: false, scrollWheelZoom: false })
      .setView([lat, lng], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
    const marker = L.marker([lat, lng]).addTo(map)
    marker.bindPopup(`📍 ${label || 'ทรัพย์สิน'}`).openPopup()
    mapInstanceRef.current = map

    return () => { map.remove(); mapInstanceRef.current = null }
  }, [])

  return (
    <Card style={{ borderColor: 'rgba(45,212,191,0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.teal }}>🗺️ ตำแหน่งทรัพย์สิน</div>
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, color: BRAND.gold, textDecoration: 'none' }}
        >
          เปิด Google Maps ↗
        </a>
      </div>
      <div ref={mapRef} style={{ width: '100%', height: 200, borderRadius: 10, border: `1px solid ${BRAND.border}` }} />
      <div style={{ fontSize: 11, color: BRAND.textMut, marginTop: 6 }}>
        พิกัด: {lat.toFixed(5)}, {lng.toFixed(5)}
      </div>
    </Card>
  )
}

// ── fix icons helper ────────────────────────────────────
function fixLeafletIcons() {
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

// ── Main ───────────────────────────────────────────────
export default function ValuationPage({ onBack, appsScriptUrl, customers = [] }) {
  const [view, setView] = useState('form')
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [comps, setComps] = useState([])
  const compsLoadedRef = useRef(false)

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  useEffect(() => {
    if (step !== 2 || compsLoadedRef.current || !appsScriptUrl) return
    compsLoadedRef.current = true
    fetch(`${appsScriptUrl}?action=getValuations`)
      .then(r => r.json())
      .then(d => setComps(d.data || []))
      .catch(() => {})
  }, [step, appsScriptUrl])

  const calc = useMemo(() => {
    const totalSqw = form.areaRai * 400 + form.areaNgan * 100 + +form.areaSqw
    const roadTypeFactor = ROAD_TYPE_OPTIONS.find(o => o.value === form.roadType)?.factor ?? 1
    const roadWidthFactor = ROAD_WIDTH_OPTIONS.find(o => o.value === form.roadWidth)?.factor ?? 1
    const frontageFactor = FRONTAGE_OPTIONS.find(o => o.value === form.landFrontage)?.factor ?? 1
    const zoneFactor = ZONE_OPTIONS.find(o => o.value === form.zoneColor)?.factor ?? 1
    const soilFactor = SOIL_OPTIONS.find(o => o.value === form.soilCondition)?.factor ?? 1
    const locationFactor = roadTypeFactor * roadWidthFactor * frontageFactor * zoneFactor * soilFactor
    const calculatedMarketPrice = form.govPrice * locationFactor
    const effectiveMarketPrice = form.compPrice ? +form.compPrice : calculatedMarketPrice
    const marketValue = effectiveMarketPrice * totalSqw
    const govPriceTotal = form.govPrice * totalSqw
    const riskPenalty = RISK_FACTORS.reduce((s, rf) => s + (form.risks[rf.key] ? rf.penalty : 0), 0)
    const propertyScore = Math.max(0, 100 + riskPenalty)
    const fsv = marketValue * 0.80
    const recommendedLoan = fsv * (form.ltvRate / 100)
    return { totalSqw, govPriceTotal, calculatedMarketPrice, effectiveMarketPrice, marketValue, propertyScore, fsv, recommendedLoan }
  }, [form])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(appsScriptUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveValuation', data: { ...form, ...calc, savedAt: new Date().toISOString() } }),
      })
      setSaved(true)
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => {
    const printArea = document.getElementById('print-area')
    if (!printArea) return
    const now = new Date()
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    const win = window.open('', '_blank')
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title></title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          * { box-sizing: border-box; font-family: 'Sarabun', 'Segoe UI', sans-serif; }
          body { margin: 6mm; padding: 0; background: white; color: black; }
          #pdf-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 6px 10px; background: #1a3a5c; color: white;
            border-radius: 8px; margin-bottom: 8px; font-size: 11px;
          }
          #pdf-header .left { font-weight: 700; font-size: 13px; }
          #pdf-header .right { text-align: right; line-height: 1.6; }
          #wrap { zoom: 0.62; display: flex; flex-direction: column; gap: 8px; }
          #wrap > div:first-child { display: none !important; }
          #wrap * { color: black !important; background: white !important; border-color: #ccc !important; box-shadow: none !important; }
          #wrap input, #wrap button, .no-print { display: none !important; }
          .card, [class*="card"] { border: 1px solid #ccc !important; padding: 8px !important; border-radius: 8px; }
          img { max-width: 100%; }
        </style>
      </head>
      <body>
        <div id="pdf-header">
          <div class="left">AssetX Estate Co., Ltd.<br><span style="font-size:10px;font-weight:400;">รายงานประเมินมูลค่าอสังหาริมทรัพย์</span></div>
          <div class="right">
            <span>📅 ${dateStr} &nbsp; 🕐 ${timeStr}</span><br>
            <span>ผู้ประเมิน: ${form.assessorName || '—'} &nbsp;|&nbsp; วันที่ประเมิน: ${form.assessmentDate || '—'}</span>
          </div>
        </div>
        <div id="wrap">${printArea.innerHTML}</div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `)
    win.document.close()
  }

  const handleReset = () => { setForm(INITIAL_FORM); setStep(1); setSaved(false) }

  const btn = (primary, ghost) => ({
    padding: '12px 20px', borderRadius: 10, border: ghost ? `1px solid ${BRAND.border}` : 'none',
    fontWeight: 700, fontSize: 13, cursor: 'pointer',
    background: primary ? BRAND.gold : ghost ? 'transparent' : BRAND.border,
    color: primary ? '#000' : ghost ? BRAND.textSec : BRAND.textSec,
  })

  return (
    <>
      {/* Print Styles */}
      <style>{``}</style>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '20px 16px' }}>
        {/* Top Nav */}
        <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setView('form')} style={{ ...btn(view === 'form'), background: view === 'form' ? BRAND.gold : BRAND.border, color: view === 'form' ? '#000' : BRAND.textSec }}>
            📋 ประเมินใหม่
          </button>
          <button onClick={() => setView('history')} style={{ ...btn(false), background: view === 'history' ? 'rgba(45,212,191,0.15)' : BRAND.border, color: view === 'history' ? BRAND.teal : BRAND.textSec, border: view === 'history' ? `1px solid ${BRAND.teal}` : 'none' }}>
            📂 ประวัติการประเมิน
          </button>
          <button onClick={onBack} style={{ ...btn(false), marginLeft: 'auto' }}>← กลับหน้าหลัก</button>
        </div>

        {/* History View */}
        {view === 'history' && <HistoryView appsScriptUrl={appsScriptUrl} />}

        {/* Form View */}
        {view === 'form' && (
          <>
            <Stepper step={step} />
            {step === 1 && <Step1 form={form} update={update} customers={customers} />}
            {step === 2 && <Step2 form={form} update={update} calc={calc} comps={comps} />}
            {step === 3 && <Step3 form={form} update={update} calc={calc} />}
            {step === 4 && <Step4 form={form} calc={calc} update={update} />}

            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => setStep(s => s - 1)} disabled={step === 1} style={{ ...btn(false), opacity: step === 1 ? 0.4 : 1 }}>← ย้อนกลับ</button>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {step === 4 && (
                  <>
                    <button onClick={handleReset} style={btn(false)}>+ ทรัพย์ใหม่</button>
                    <button onClick={handlePrint} style={{ ...btn(false), color: BRAND.gold }}>📄 PDF</button>
                    <button onClick={handleSave} disabled={saving || saved} style={{ ...btn(true), opacity: saved ? 0.7 : 1 }}>
                      {saving ? 'กำลังบันทึก...' : saved ? '✅ บันทึกแล้ว' : '💾 บันทึกข้อมูล'}
                    </button>
                  </>
                )}
                {step < 4 && (
                  <button onClick={() => setStep(s => s + 1)} style={btn(true)}>
                    {step === 3 ? 'ดูผลประเมิน →' : 'ถัดไป →'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

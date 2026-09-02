import React, { useState, useMemo, useEffect, useRef } from 'react'
import { showToast } from "./lib/toast.js";
import { BRAND as BASE_BRAND } from './lib/config.js'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  getValuations as apiGetValuations,
  saveValuation as apiSaveValuation,
  updateValuation as apiUpdateValuation,
  updateValuationStatus as apiUpdateValuationStatus,
  deleteValuation as apiDeleteValuation,
  getNearbyAreaPricePoints as apiGetNearbyAreaPricePoints,
} from './lib/api.js'
import { searchGovPrice, extractPrice, recordLabel } from './lib/treasuryApi.js'
import { THAI_PROVINCES, PROV_CODE, getAmphoeList, searchByDeed, parseDolResult } from './lib/dolApi.js'
import { confidenceBand } from './lib/pricePoints.js'

// ใช้สีกลางจาก config.js — override เฉพาะคีย์ที่หน้านี้ใช้ต่าง
const BRAND = { ...BASE_BRAND, bgCard: '#0D1B2E', textMut: '#475569', success: '#10B981' }

import {
  ASSESSMENT_TYPES, PROPERTY_TYPES, PROPERTY_SUBTYPES,
  ASSESSMENT_CODE, PROVINCE_CODE, SUBTYPE_CODE, generateAssetCode,
  ROAD_TYPE_OPTIONS, ROAD_WIDTH_OPTIONS, FRONTAGE_OPTIONS, ZONE_OPTIONS, SOIL_OPTIONS,
  FLOOD_LEVELS, TITLE_TYPES, RISK_FACTORS, BASE_FSV_RATE, RISK_BANDS, COMP_ADJ,
  EMPTY_DEED, computeValuation,
} from './lib/valuationOptions.js'
import { ADDRESS_PROVINCES, getDistrictsByProvince, getSubdistrictsByDistrict } from './lib/thaiAddress.js'
import { buildUnderwritingPolicy } from './lib/underwritingPolicy.js'

const fmt = (n) => Math.round(n || 0).toLocaleString('th-TH')
const VALUATION_DRAFT_KEY = 'assetx_valuation_draft'

const INITIAL_FORM = {
  assessmentType: 'ขายฝาก', propertyType: 'ที่ดิน', propertySubtype: 'ที่ดินเปล่า (โฉนด)',
  projectName: '', assessmentDate: new Date().toISOString().split('T')[0], assessorName: '',
  deeds: [EMPTY_DEED()],
  province: 'กรุงเทพมหานคร', district: '', subdistrict: '',
  roadType: '', roadWidth: '', landFrontage: '', distanceFromMain: '',
  zoneColor: '', soilCondition: '', compPrice: '', compSource: '', locationNote: '',
  risks: { hardAccess: false, irregularShape: false, encumbrance: false, dispute: false, noUtilities: false, nuisance: false },
  floodLevel: 'ไม่มีประวัติน้ำท่วม',
  titleType: 'โฉนด (Chanote) ปลอดภาระ',
  comps: [],
  ltvRate: 50, linkedCustomer: '',
  lat: null, lng: null,
  requestedLoan: '', assetCode: '',
}

const createInitialForm = () => ({
  ...INITIAL_FORM,
  deeds: INITIAL_FORM.deeds.map(deed => ({ ...deed })),
  comps: INITIAL_FORM.comps.map(comp => ({ ...comp })),
})

function loadValuationDraft() {
  try {
    const raw = localStorage.getItem(VALUATION_DRAFT_KEY)
    if (!raw) return { form: createInitialForm(), step: 1 }
    const parsed = JSON.parse(raw)
    return {
      form: { ...createInitialForm(), ...(parsed.form || {}) },
      step: Math.min(4, Math.max(1, Number(parsed.step) || 1)),
    }
  } catch {
    return { form: createInitialForm(), step: 1 }
  }
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
  const fm = (v) => Number(v) ? '฿' + Number(v).toLocaleString('th-TH') : '—'
  const score = Number(row['Property Score']) || 100
  const scoreColor = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626'
  const ltv = Number(row['LTV Rate (%)']) || 0
  const ltvCustomer = Number(row['LTV ลูกค้า (% ต่อตลาด)']) || 0
  const ltvColor = ltvCustomer <= 50 ? '#16a34a' : ltvCustomer <= 70 ? '#d97706' : '#dc2626'
  const location = [row['ตำบล/แขวง'] ? 'ต.' + row['ตำบล/แขวง'] : '', row['อำเภอ/เขต'] ? 'อ.' + row['อำเภอ/เขต'] : '', row['จังหวัด'] || ''].filter(Boolean).join(' ')
  const area = `${row['ไร่'] || 0} ไร่ ${row['งาน'] || 0} งาน ${row['ตร.ว.'] || 0} ตร.ว. (${f(row['ตร.ว.รวม'])} ตร.ว.)`
  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html lang="th"><head>
  <meta charset="utf-8">
  <title>AssetX Estate</title>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Sarabun', sans-serif; font-size: 11px; color: #1e293b; background: white; line-height: 1.5; padding: 12mm 14mm; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 3px solid #1a3a5c; margin-bottom: 12px; }
    .company-name { font-size: 16px; font-weight: 800; color: #1a3a5c; }
    .company-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
    .header-right { text-align: right; font-size: 10px; color: #475569; line-height: 1.8; }
    .header-right strong { color: #1a3a5c; }

    /* Title section */
    .title-section { margin-bottom: 12px; }
    .badges { display: flex; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
    .badge { padding: 2px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; border: 1.5px solid; }
    .badge-type { background: #eff6ff; border-color: #3b82f6; color: #1d4ed8; }
    .badge-sub  { background: #f0fdf4; border-color: #16a34a; color: #166534; }
    .title-name { font-size: 17px; font-weight: 800; color: #0f172a; margin-bottom: 3px; }
    .title-loc  { font-size: 11px; color: #64748b; }
    .title-deed { font-size: 11px; color: #475569; margin-top: 2px; }

    /* KPI cards */
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
    .kpi { border-radius: 8px; padding: 10px 8px; text-align: center; border: 1px solid; }
    .kpi .kpi-lbl { font-size: 9px; color: #64748b; margin-bottom: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
    .kpi .kpi-val { font-size: 14px; font-weight: 800; }
    .kpi-gov  { background: #f8faff; border-color: #c7d7f9; } .kpi-gov .kpi-val  { color: #3730a3; }
    .kpi-mkt  { background: #f0fdf4; border-color: #bbf7d0; } .kpi-mkt .kpi-val  { color: #166534; }
    .kpi-fsv  { background: #fff7ed; border-color: #fed7aa; } .kpi-fsv .kpi-val  { color: #c2410c; }
    .kpi-rec  { background: #f0fdfa; border-color: #99f6e4; } .kpi-rec .kpi-val  { color: #0f766e; }

    /* Main content grid */
    .main-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 10px; margin-bottom: 10px; }
    .section { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .section-title { background: #1a3a5c; color: white; font-size: 10px; font-weight: 700; padding: 5px 10px; letter-spacing: 0.5px; }
    .section-body { padding: 8px 10px; }
    .data-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9; font-size: 10.5px; }
    .data-row:last-child { border-bottom: none; }
    .data-key { color: #64748b; }
    .data-val { font-weight: 600; color: #1e293b; text-align: right; max-width: 58%; }

    /* Score box */
    .score-box { display: flex; align-items: center; gap: 14px; padding: 10px; }
    .score-circle { width: 60px; height: 60px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 3px solid ${scoreColor}; flex-shrink: 0; }
    .score-num { font-size: 22px; font-weight: 800; color: ${scoreColor}; line-height: 1; }
    .score-denom { font-size: 9px; color: #94a3b8; }
    .score-detail { flex: 1; }
    .score-label { font-size: 11px; font-weight: 700; color: ${scoreColor}; margin-bottom: 3px; }
    .score-risk { font-size: 10px; color: #64748b; }

    /* LTV section */
    .ltv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px 10px; }
    .ltv-box { text-align: center; background: #f8fafc; border-radius: 6px; padding: 8px; }
    .ltv-lbl { font-size: 9px; color: #64748b; margin-bottom: 3px; }
    .ltv-val { font-size: 16px; font-weight: 800; }

    /* Summary */
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
    .sum-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; text-align: center; }
    .sum-lbl { font-size: 9px; color: #64748b; margin-bottom: 3px; font-weight: 600; }
    .sum-val { font-size: 13px; font-weight: 800; color: #0f766e; }

    /* Signature */
    .sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
    .sig-box { text-align: center; }
    .sig-line { border-bottom: 1px solid #94a3b8; margin: 24px 10px 4px; }
    .sig-lbl { font-size: 10px; color: #64748b; }

    /* Footer */
    .footer { margin-top: 10px; padding-top: 6px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
  </head><body>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="company-name">AssetX Estate Co., Ltd.</div>
      <div class="company-sub">รายงานประเมินมูลค่าอสังหาริมทรัพย์ / Property Valuation Report</div>
    </div>
    <div class="header-right">
      <div>📅 <strong>${dateStr}</strong> &nbsp; 🕐 ${timeStr}</div>
      <div>ผู้ประเมิน: <strong>${row['ผู้ประเมิน'] || '—'}</strong></div>
      <div>วันที่ประเมิน: <strong>${row['วันที่ประเมิน'] || '—'}</strong></div>
    </div>
  </div>

  <!-- Title -->
  <div class="title-section">
    <div class="badges">
      <span class="badge badge-type">${row['ประเภทการประเมิน'] || ''}</span>
      <span class="badge badge-sub">${row['ประเภทอสังหาฯ'] || ''} ${row['ประเภทย่อย'] ? '— ' + row['ประเภทย่อย'] : ''}</span>
    </div>
    <div class="title-name">${row['รหัส/ชื่อทรัพย์'] || '—'}</div>
    <div class="title-loc">📍 ${location || '—'}</div>
    <div class="title-deed">โฉนดเลขที่ ${row['เลขโฉนด'] || '—'} &nbsp;|&nbsp; ระวาง ${row['ระวาง'] || '—'} &nbsp;|&nbsp; หน้าสำรวจ ${row['หน้าสำรวจ'] || '—'} &nbsp;|&nbsp; เลขที่ดิน ${row['เลขที่ดิน'] || '—'}</div>
  </div>

  <!-- KPI -->
  <div class="kpi-grid">
    <div class="kpi kpi-gov">
      <div class="kpi-lbl">ราคาประเมินกรมธนารักษ์</div>
      <div class="kpi-val">${f(row['ราคาประเมินรัฐ (บ./ตร.ว.)'])}</div>
      <div style="font-size:9px;color:#64748b">บาท/ตร.ว.</div>
    </div>
    <div class="kpi kpi-mkt">
      <div class="kpi-lbl">มูลค่าตลาดรวม</div>
      <div class="kpi-val">${fm(row['มูลค่าตลาดรวม'])}</div>
      <div style="font-size:9px;color:#64748b">Market Value</div>
    </div>
    <div class="kpi kpi-fsv">
      <div class="kpi-lbl">Forced Sale Value</div>
      <div class="kpi-val">${fm(row['FSV (80%)'])}</div>
      <div style="font-size:9px;color:#64748b">FSV 80%</div>
    </div>
    <div class="kpi kpi-rec">
      <div class="kpi-lbl">วงเงินแนะนำ</div>
      <div class="kpi-val">${fm(row['วงเงินแนะนำ'])}</div>
      <div style="font-size:9px;color:#64748b">LTV ${ltv}%</div>
    </div>
  </div>

  <!-- Main Grid -->
  <div class="main-grid">
    <!-- Left: Property Detail -->
    <div class="section">
      <div class="section-title">📋 รายละเอียดทรัพย์สิน</div>
      <div class="section-body">
        ${[
          ['เนื้อที่', area],
          ['ราคาตลาด (บ./ตร.ว.)', f(row['ราคาตลาด (บ./ตร.ว.)']) + ' บาท/ตร.ว.'],
          ['ทำเล / ถนน', (row['ทำเล'] || '—') + ' / กว้าง ' + (row['ความกว้างถนน'] || '—')],
          ['หน้ากว้าง', row['หน้ากว้าง'] || '—'],
          ['ระยะห่างถนนใหญ่', row['ระยะห่างถนนใหญ่'] ? row['ระยะห่างถนนใหญ่'] + ' เมตร' : '—'],
          ['ผังเมือง', row['ผังเมือง'] || '—'],
          ['สภาพดิน', row['สภาพดิน'] || '—'],
          ['Comp ราคา (บ./ตร.ว.)', f(row['Comp (บ./ตร.ว.)']) + (row['แหล่ง Comp'] ? ' — ' + row['แหล่ง Comp'] : '')],
          ['หมายเหตุ', row['หมายเหตุ'] || '—'],
        ].map(([k,v]) => `<div class="data-row"><span class="data-key">${k}</span><span class="data-val">${v}</span></div>`).join('')}
      </div>
    </div>

    <!-- Right: Score + LTV -->
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div class="section">
        <div class="section-title">⚠️ Property Score &amp; ความเสี่ยง</div>
        <div class="score-box">
          <div class="score-circle">
            <div class="score-num">${score}</div>
            <div class="score-denom">/100</div>
          </div>
          <div class="score-detail">
            <div class="score-label">${score >= 80 ? '✅ ดีมาก' : score >= 60 ? '⚠️ ปานกลาง' : '🔴 ความเสี่ยงสูง'}</div>
            <div class="score-risk">${row['ปัจจัยเสี่ยง'] || 'ไม่มีปัจจัยเสี่ยง'}</div>
          </div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">💰 วงเงินและ LTV</div>
        <div class="ltv-grid">
          <div class="ltv-box">
            <div class="ltv-lbl">วงเงินที่ขอ</div>
            <div class="ltv-val" style="color:#1a3a5c">${fm(row['วงเงินที่ลูกค้าขอ'])}</div>
          </div>
          <div class="ltv-box">
            <div class="ltv-lbl">LTV ลูกค้า</div>
            <div class="ltv-val" style="color:${ltvColor}">${ltvCustomer ? ltvCustomer + '%' : '—'}</div>
          </div>
        </div>
        <div style="padding:0 10px 8px;">
          ${[
            ['มูลค่าตลาด', fm(row['มูลค่าตลาดรวม'])],
            ['FSV (80%)', fm(row['FSV (80%)'])],
            ['วงเงินแนะนำ (LTV ' + ltv + '%)', fm(row['วงเงินแนะนำ'])],
          ].map(([k,v]) => `<div class="data-row"><span class="data-key">${k}</span><span class="data-val" style="color:#0f766e">${v}</span></div>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- Signature -->
  <div class="sig-section">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-lbl">ผู้ประเมิน / Valuator</div>
      <div style="font-size:10px;color:#475569;margin-top:2px">(${row['ผู้ประเมิน'] || '...................................'})</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-lbl">ผู้อนุมัติ / Authorized</div>
      <div style="font-size:10px;color:#475569;margin-top:2px">(...................................)</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>AssetX Estate Co., Ltd. — รายงานฉบับนี้จัดทำเพื่อใช้ภายในเท่านั้น</span>
    <span>พิมพ์: ${now.toLocaleString('th-TH')} &nbsp;|&nbsp; เลขอ้างอิง: ${row['_rowIndex'] || '—'}</span>
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
  const [expandedContracted, setExpandedContracted] = useState({})
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [sendingRow, setSendingRow] = useState(null)

  const sendToInvestor = async (row) => {
    setSendingRow(row['_rowIndex'])
    try {
      await apiUpdateValuationStatus(row['_rowIndex'], 'รอการพิจารณา')
      setRows(prev => prev.map(r => r['_rowIndex'] === row['_rowIndex'] ? { ...r, 'สถานะ': 'รอการพิจารณา' } : r))
    } catch (e) {
      showToast('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSendingRow(null)
    }
  }

  useEffect(() => {
    apiGetValuations()
      .then(data => { setRows(data); setLoading(false) })
      .catch(() => { setError('ไม่สามารถโหลดข้อมูลได้'); setLoading(false) })
  }, [])

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
      deeds: Array.isArray(row.deeds) && row.deeds.length > 0 ? row.deeds : [EMPTY_DEED()],
    })
    setEditRow(row)
  }

  const handleUpdate = async () => {
    if (!editRow) return
    setSaving(true)
    try {
      await apiUpdateValuation(editRow['_rowIndex'], editForm)
      setRows(prev => prev.map(r =>
        r['_rowIndex'] === editRow['_rowIndex'] ? { ...r, ...editForm } : r
      ))
      setEditRow(null)
    } catch (e) {
      showToast('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    const rowIndex = row['_rowIndex']
    if (!rowIndex) { showToast('ไม่พบ index ของรายการ — กรุณา reload แล้วลองใหม่'); return }
    if (!window.confirm('ยืนยันลบรายการประเมินนี้? การลบไม่สามารถย้อนกลับได้')) return
    setDeletingIdx(rowIndex)
    try {
      await apiDeleteValuation(rowIndex)
      setRows(prev => prev.filter(r => r['_rowIndex'] !== rowIndex))
    } catch (e) {
      showToast('เกิดข้อผิดพลาด: ' + e.message)
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

              <div style={{ margin: '16px 0 8px', fontSize: 12, fontWeight: 700, color: BRAND.gold }}>
                📄 รายการโฉนด ({(editForm.deeds || []).length} แปลง)
              </div>
              {(editForm.deeds || []).map((deed, idx) => (
                <div key={deed.id || idx} style={{ background: BRAND.bg, borderRadius: 10, padding: 12, marginBottom: 10, border: `1px solid ${BRAND.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.textPri }}>โฉนดที่ {idx + 1}</div>
                    {(editForm.deeds || []).length > 1 && (
                      <button
                        onClick={() => setEditForm(p => ({ ...p, deeds: p.deeds.filter((_, i) => i !== idx) }))}
                        style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#FCA5A5', cursor: 'pointer' }}
                      >ลบ</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={lbl}>เลขโฉนด</label>
                      <input value={deed.titleDeedNo || ''} onChange={e => setEditForm(p => ({ ...p, deeds: p.deeds.map((d, i) => i === idx ? { ...d, titleDeedNo: e.target.value } : d) }))} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>ไร่</label>
                      <input type="number" value={deed.areaRai ?? 0} onChange={e => setEditForm(p => ({ ...p, deeds: p.deeds.map((d, i) => i === idx ? { ...d, areaRai: +e.target.value } : d) }))} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>งาน</label>
                      <input type="number" value={deed.areaNgan ?? 0} onChange={e => setEditForm(p => ({ ...p, deeds: p.deeds.map((d, i) => i === idx ? { ...d, areaNgan: +e.target.value } : d) }))} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>ตร.ว.</label>
                      <input type="number" value={deed.areaSqw ?? 0} onChange={e => setEditForm(p => ({ ...p, deeds: p.deeds.map((d, i) => i === idx ? { ...d, areaSqw: +e.target.value } : d) }))} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>ราคาประเมินกรมฯ (บ./ตร.ว.)</label>
                      <input type="number" value={deed.govPrice ?? 0} onChange={e => setEditForm(p => ({ ...p, deeds: p.deeds.map((d, i) => i === idx ? { ...d, govPrice: +e.target.value } : d) }))} style={inp} />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setEditForm(p => ({ ...p, deeds: [...(p.deeds || []), EMPTY_DEED()] }))}
                style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px dashed ${BRAND.gold}`, background: 'transparent', color: BRAND.gold, fontSize: 12, cursor: 'pointer', marginBottom: 4 }}
              >+ เพิ่มโฉนด</button>

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
            {/* โฉนดทั้งหมด */}
            {(() => {
              const deeds = Array.isArray(detailRow.deeds) && detailRow.deeds.length > 0 ? detailRow.deeds : null
              if (!deeds) return null
              const totalSqw = deeds.reduce((s, d) => s + (d.areaRai||0)*400 + (d.areaNgan||0)*100 + +(d.areaSqw||0), 0)
              return (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.gold, marginBottom: 6 }}>📄 รายการโฉนด ({deeds.length} แปลง • รวม {fmt(totalSqw)} ตร.ว.)</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${BRAND.border}` }}>
                          {['#', 'เลขโฉนด', 'เลขที่ดิน', 'เนื้อที่', 'ราคาประเมินรัฐ'].map(h => (
                            <th key={h} style={{ padding: '5px 8px', color: BRAND.textSec, fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deeds.map((d, i) => {
                          const sqw = (d.areaRai||0)*400 + (d.areaNgan||0)*100 + +(d.areaSqw||0)
                          const area = [(d.areaRai>0 ? `${d.areaRai} ไร่` : ''), (d.areaNgan>0 ? `${d.areaNgan} งาน` : ''), (d.areaSqw>0 ? `${d.areaSqw} ตร.ว.` : '')].filter(Boolean).join(' ') || `${sqw} ตร.ว.`
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${BRAND.border}` }}>
                              <td style={{ padding: '5px 8px', color: BRAND.textMut }}>{i+1}</td>
                              <td style={{ padding: '5px 8px', color: BRAND.teal, fontWeight: 600 }}>{d.titleDeedNo || '—'}</td>
                              <td style={{ padding: '5px 8px', color: BRAND.textPri }}>{d.landNo || '—'}</td>
                              <td style={{ padding: '5px 8px', color: BRAND.textPri, whiteSpace: 'nowrap' }}>{area}</td>
                              <td style={{ padding: '5px 8px', color: BRAND.textPri }}>{d.govPrice ? `฿${fmt(d.govPrice)}/ตร.ว.` : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}
            {[['📋 รายละเอียดทรัพย์', [['ประเภทอสังหาฯ', detailRow['ประเภทอสังหาฯ']], ['ประเภทย่อย', detailRow['ประเภทย่อย']], ['เนื้อที่รวม', `${detailRow['ตร.ว.รวม'] ? fmt(detailRow['ตร.ว.รวม']) + ' ตร.ว.' : (detailRow['ไร่'] || 0) + ' ไร่ ' + (detailRow['งาน'] || 0) + ' งาน ' + (detailRow['ตร.ว.'] || 0) + ' ตร.ว.'}`], ['ทำเล', detailRow['ทำเล']], ['ผังเมือง', detailRow['ผังเมือง']], ['สภาพดิน', detailRow['สภาพดิน']], ['ผู้ประเมิน', detailRow['ผู้ประเมิน']]]], ['⚠️ ปัจจัยเสี่ยงและหมายเหตุ', [['ปัจจัยเสี่ยง', detailRow['ปัจจัยเสี่ยง']], ['หมายเหตุ', detailRow['หมายเหตุ']], ['Comp ราคา', detailRow['Comp (บ./ตร.ว.)']], ['แหล่ง Comp', detailRow['แหล่ง Comp']]]]].map(([title, fields]) => (
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
      {[...rows].reverse().map((row, i) => {
        const isContracted = row['สถานะ'] === 'สร้างสัญญาแล้ว'
        const isExpanded = expandedContracted[row['_rowIndex'] || i]
        return (
        <Card key={row['_rowIndex'] || i} style={{ padding: 16, opacity: isContracted ? 0.75 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: isContracted && !isExpanded ? 0 : 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 700, color: isContracted ? BRAND.textSec : BRAND.textPri, fontSize: 15 }}>{row['รหัส/ชื่อทรัพย์'] || '—'}</div>
                {isContracted && (
                  <button
                    onClick={() => setExpandedContracted(p => ({ ...p, [row['_rowIndex'] || i]: !isExpanded }))}
                    style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#a5b4fc', fontSize: 10, cursor: 'pointer' }}
                  >
                    {isExpanded ? '▲ ย่อ' : '▼ ดูข้อมูล'}
                  </button>
                )}
              </div>
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
              {/* ปุ่มส่งนายทุน — แสดงเมื่อยังไม่ถูกอนุมัติ/ปฏิเสธ/สร้างสัญญาแล้ว */}
              {(row['สถานะ'] !== 'อนุมัติ' && row['สถานะ'] !== 'ปฏิเสธ' && row['สถานะ'] !== 'สร้างสัญญาแล้ว') && (
                <button
                  onClick={() => sendToInvestor(row)}
                  disabled={sendingRow === row['_rowIndex']}
                  title="ส่งให้นายทุนตัดสินใจ"
                  style={{ padding: '5px 9px', borderRadius: 8, border: '1px solid rgba(45,212,191,0.4)', background: 'rgba(45,212,191,0.1)', color: BRAND.teal, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
                >
                  {sendingRow === row['_rowIndex'] ? '⏳' : '📤 ส่งนายทุน'}
                </button>
              )}
              {row['สถานะ'] !== 'สร้างสัญญาแล้ว' && (
                <button
                  onClick={() => openEdit(row)}
                  title="แก้ไขข้อมูล"
                  style={{ padding: '5px 9px', borderRadius: 8, border: `1px solid rgba(99,102,241,0.3)`, background: 'rgba(99,102,241,0.08)', color: '#a5b4fc', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
                >
                  ✏️
                </button>
              )}
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
          {(!isContracted || isExpanded) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {[
                  ['มูลค่าตลาด', `฿${fmt(row['มูลค่าตลาดรวม'])}`],
                  ['FSV', `฿${fmt(row['FSV (80%)'])}`],
                  ['วงเงินแนะนำ', `฿${fmt(row['วงเงินแนะนำ'])}`],
                  ['Score', `${row['Property Score']}/100`],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: BRAND.bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: BRAND.textMut }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.teal, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
              {/* โฉนด summary */}
              {(() => {
                const deeds = Array.isArray(row.deeds) && row.deeds.length > 0 ? row.deeds : null
                if (!deeds) return null
                const totalSqw = deeds.reduce((s, d) => s + (d.areaRai||0)*400 + (d.areaNgan||0)*100 + +(d.areaSqw||0), 0)
                return (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: BRAND.bg, border: `1px solid ${BRAND.border}`, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: BRAND.textSec }}>📄 {deeds.length} โฉนด • {fmt(totalSqw)} ตร.ว. รวม</span>
                    <span style={{ color: BRAND.border }}>|</span>
                    {deeds.map((d, i) => (
                      <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(45,212,191,0.08)', border: `1px solid rgba(45,212,191,0.2)`, color: BRAND.teal }}>
                        {d.titleDeedNo || `แปลง${i+1}`}
                        {(d.areaRai||d.areaNgan||d.areaSqw) ? ` (${[(d.areaRai>0?d.areaRai+' ไร่':''), (d.areaNgan>0?d.areaNgan+' งาน':''), (d.areaSqw>0?d.areaSqw+' ตร.ว.':'')].filter(Boolean).join(' ')})` : ''}
                      </span>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}
        </Card>
        )
      })}
    </div>
  )
}

// ── Step 1 ─────────────────────────────────────────────
function Step1({ form, update, updateDeed, addDeed, removeDeed, customers, assetCode }) {
  const subtypes = PROPERTY_SUBTYPES[form.propertyType] || ['อื่นๆ']
  const provinceChoices = form.province && !ADDRESS_PROVINCES.includes(form.province)
    ? [form.province, ...ADDRESS_PROVINCES]
    : ADDRESS_PROVINCES
  const districtOptions = useMemo(() => getDistrictsByProvince(form.province), [form.province])
  const subdistrictOptions = useMemo(() => getSubdistrictsByDistrict(form.province, form.district), [form.province, form.district])
  const districtChoices = form.district && !districtOptions.includes(form.district)
    ? [form.district, ...districtOptions]
    : districtOptions
  const subdistrictChoices = form.subdistrict && !subdistrictOptions.includes(form.subdistrict)
    ? [form.subdistrict, ...subdistrictOptions]
    : subdistrictOptions
  const lockedSelectStyle = { opacity: 0.55, cursor: 'not-allowed' }

  const handleProvinceSelect = (province) => {
    update('province', province)
    update('district', '')
    update('subdistrict', '')
  }

  const handleDistrictSelect = (district) => {
    update('district', district)
    update('subdistrict', '')
  }

  // ── กรมธนารักษ์ lookup ────────────────────────────────
  const [trdLookup, setTrdLookup] = useState(null)

  // ── กรมที่ดิน DOL lookup ──────────────────────────────
  const [dolSearch, setDolSearch] = useState(null) // { deedIdx, provCode, ampCode, amphoeList, loading, error }

  async function openDolSearch(idx) {
    const deed = form.deeds[idx]
    const provCode = PROV_CODE[form.province] || ''
    setDolSearch({ deedIdx: idx, provCode, ampCode: '', amphoeList: null, loading: false, error: null, deedNo: deed.titleDeedNo || '' })
    // โหลดรายการอำเภอ
    if (provCode) {
      const list = await getAmphoeList(provCode)
      setDolSearch(p => p ? { ...p, amphoeList: list } : p)
    }
  }

  async function handleDolSearch() {
    if (!dolSearch) return
    setDolSearch(p => ({ ...p, loading: true, error: null }))
    try {
      const raw = await searchByDeed({ provCode: dolSearch.provCode, ampCode: dolSearch.ampCode, deedNo: dolSearch.deedNo })
      const parsed = parseDolResult(raw)
      const idx = dolSearch.deedIdx
      // auto-fill ทุก field ของโฉนด
      setForm(prev => ({
        ...prev,
        deeds: prev.deeds.map((d, i) => i === idx ? { ...d, ...parsed } : d)
      }))
      setDolSearch(null)
    } catch (e) {
      setDolSearch(p => ({ ...p, loading: false, error: e.message }))
    }
  }

  async function handleGovLookup(idx) {
    const deed = form.deeds[idx]
    if (!deed.landNo) { showToast('กรุณากรอกเลขที่ดินก่อน'); return }
    setTrdLookup({ deedIdx: idx, loading: true, records: [], error: null })
    try {
      const { records, total } = await searchGovPrice({
        province: form.province,
        landNo: deed.landNo,
        mapSheet: deed.mapSheet,
      })
      if (records.length === 1) {
        updateDeed(idx, 'govPrice', extractPrice(records[0]))
        setTrdLookup(null)
      } else {
        setTrdLookup({ deedIdx: idx, loading: false, records, total, error: null })
      }
    } catch (e) {
      setTrdLookup({ deedIdx: idx, loading: false, records: [], total: 0, error: e.message })
    }
  }

  const handleCustomerSelect = (val) => {
    update('linkedCustomer', val)
    if (!val) return
    const cust = customers.find(c => String(c.id || c.name) === val)
    if (!cust) return
    if (cust.type === 'ขายฝาก' || cust.type === 'จำนอง') update('assessmentType', cust.type)
    if (cust.name) update('projectName', cust.name)
  }

  // ── ดึงข้อมูลโฉนดจากประวัติเดิม (ลูกค้าที่มีสัญญาแล้ว + ประวัติการประเมิน) ─────────────────
  const [deedPicker, setDeedPicker] = useState(null) // { query, candidates, loading }

  // ตาราง customers เก็บโฉนดแบบ { no, area: "0-1-75.4 ไร่", amphoe, landNo, mapRef, tambon, province, surveyPage }
  function parseCustomerDeedArea(areaStr) {
    const parts = String(areaStr || '').replace(/ไร่|งาน|ตร\.?ว\.?/g, '').trim().split('-').map(s => parseFloat(s) || 0)
    return { areaRai: parts[0] || 0, areaNgan: parts[1] || 0, areaSqw: parts[2] || 0 }
  }

  function customerToDeedCandidate(cust) {
    if (!Array.isArray(cust.deeds) || cust.deeds.length === 0) return null
    return {
      key: 'cust-' + (cust.id || cust.name),
      source: 'ลูกค้าเดิม',
      label: cust.name,
      subLabel: cust.type || '',
      deeds: cust.deeds.map(d => ({
        id: Date.now() + Math.random(),
        titleDeedNo: d.no || '',
        mapSheet: d.mapRef || '',
        surveyPage: d.surveyPage || '',
        landNo: d.landNo || '',
        govPrice: 0,
        ...parseCustomerDeedArea(d.area),
      })),
      province: cust.deeds[0]?.province || '',
      district: cust.deeds[0]?.amphoe || '',
      subdistrict: cust.deeds[0]?.tambon || '',
    }
  }

  // ตาราง valuations เก็บโฉนดตรงกับ shape ของฟอร์มอยู่แล้ว
  function valuationToDeedCandidate(row) {
    if (!Array.isArray(row.deeds) || row.deeds.length === 0) return null
    return {
      key: 'val-' + row._rowIndex,
      source: 'ประวัติประเมิน',
      label: row['ชื่อลูกค้า'] || row['รหัส/ชื่อทรัพย์'] || '—',
      subLabel: row['วันที่ประเมิน'] || '',
      deeds: row.deeds.map(d => ({ ...d, id: Date.now() + Math.random() })),
      province: row['จังหวัด'] || '',
      district: row['อำเภอ/เขต'] || '',
      subdistrict: row['ตำบล/แขวง'] || '',
    }
  }

  async function openDeedPicker() {
    const fromCustomers = customers.map(customerToDeedCandidate).filter(Boolean)
    setDeedPicker({ query: '', candidates: fromCustomers, loading: true })
    try {
      const rows = await apiGetValuations()
      const fromValuations = rows.map(valuationToDeedCandidate).filter(Boolean)
      setDeedPicker({ query: '', candidates: [...fromCustomers, ...fromValuations], loading: false })
    } catch (e) {
      setDeedPicker({ query: '', candidates: fromCustomers, loading: false })
      showToast('โหลดประวัติการประเมินไม่สำเร็จ (แสดงเฉพาะข้อมูลลูกค้าเดิม): ' + e.message)
    }
  }

  function applyDeedHistory(candidate) {
    update('deeds', candidate.deeds.map(d => ({ ...d, id: Date.now() + Math.random() })))
    if (candidate.province) update('province', candidate.province)
    if (candidate.district) update('district', candidate.district)
    if (candidate.subdistrict) update('subdistrict', candidate.subdistrict)
    setDeedPicker(null)
    showToast('✅ ดึงข้อมูลโฉนดจาก ' + candidate.label + ' สำเร็จ')
  }

  const deedPickerMatches = useMemo(() => {
    if (!deedPicker?.candidates) return []
    const q = deedPicker.query.trim().toLowerCase()
    return deedPicker.candidates
      .filter(c => {
        if (!q) return true
        const haystack = [c.label, ...(c.deeds || []).map(d => d.titleDeedNo)].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(q)
      })
      .slice(0, 20)
  }, [deedPicker])

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

      {/* ดึงข้อมูลโฉนดจากประวัติเดิม */}
      <Card style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold }}>📂 ดึงข้อมูลโฉนดจากประวัติเดิม <span style={{ fontSize: 11, fontWeight: 400, color: BRAND.textMut }}>(ไม่บังคับ)</span></div>
            <div style={{ fontSize: 11, color: BRAND.textSec, marginTop: 2 }}>กรณีโฉนดเดิมไม่เปลี่ยน — คัดลอกเลขโฉนด/ระวาง/เนื้อที่/ราคาประเมินรัฐจากรายการประเมินเก่าได้เลย ไม่ต้องกรอกใหม่</div>
          </div>
          <button onClick={openDeedPicker} disabled={deedPicker?.loading} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: `1px solid ${BRAND.gold}`, background: 'rgba(245,158,11,0.08)', color: BRAND.gold, cursor: deedPicker?.loading ? 'wait' : 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {deedPicker?.loading ? '⏳ กำลังโหลด...' : '🔍 ค้นหาโฉนดเดิม'}
          </button>
        </div>

        {deedPicker && !deedPicker.loading && (
          <div style={{ marginTop: 14 }}>
            <Inp
              autoFocus
              value={deedPicker.query}
              onChange={e => setDeedPicker(p => ({ ...p, query: e.target.value }))}
              placeholder="พิมพ์ชื่อลูกค้า / รหัสทรัพย์ / เลขโฉนด เพื่อค้นหา..."
              style={{ marginBottom: 10 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {deedPickerMatches.length === 0 && (
                <div style={{ textAlign: 'center', padding: '16px 0', color: BRAND.textMut, fontSize: 12 }}>ไม่พบรายการที่มีข้อมูลโฉนด</div>
              )}
              {deedPickerMatches.map(c => (
                <div key={c.key} onClick={() => applyDeedHistory(c)}
                  style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${BRAND.border}`, background: BRAND.bg, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.textPri }}>{c.label}</span>
                    <span style={{ fontSize: 10, color: BRAND.textMut, whiteSpace: 'nowrap' }}>{c.source === 'ลูกค้าเดิม' ? `👤 ${c.subLabel || 'ลูกค้าเดิม'}` : `📋 ${c.subLabel || 'ประวัติประเมิน'}`}</span>
                  </div>
                  <div style={{ fontSize: 11, color: BRAND.textSec, marginTop: 3 }}>
                    📄 {c.deeds.map(d => d.titleDeedNo).filter(Boolean).join(', ') || '—'}
                    {' · '}{[c.subdistrict, c.district, c.province].filter(Boolean).join(' ')}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setDeedPicker(null)} style={{ marginTop: 10, fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${BRAND.border}`, background: 'transparent', color: BRAND.textSec, cursor: 'pointer' }}>ยกเลิก</button>
          </div>
        )}
      </Card>

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
          {assetCode && (
            <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(45,212,191,0.08)', border: `1px solid ${BRAND.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
              <div>
                <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 2 }}>รหัสทรัพย์ (Auto)</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: BRAND.teal, letterSpacing: 1 }}>{assetCode}</div>
              </div>
              <button onClick={() => { navigator.clipboard?.writeText(assetCode) }} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `1px solid ${BRAND.teal}`, background: 'transparent', color: BRAND.teal, cursor: 'pointer' }}>คัดลอก</button>
            </div>
          )}
          <Label>ชื่อโครงการ / หมายเหตุเพิ่มเติม</Label>
          <Inp value={form.projectName} onChange={e => update('projectName', e.target.value)} placeholder="เช่น ที่ดินเลียบคลองฯ ซ.20" style={{ marginBottom: 10 }} />
          <Label>วันที่ประเมิน</Label>
          <Inp type="date" value={form.assessmentDate} onChange={e => update('assessmentDate', e.target.value)} style={{ marginBottom: 10 }} />
          <Label>ผู้ประเมิน</Label>
          <Inp value={form.assessorName} onChange={e => update('assessorName', e.target.value)} placeholder="ชื่อผู้ประเมิน" />
        </Card>
      </div>

      {/* Multi-deed section */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold }}>📄 รายการโฉนด ({form.deeds.length} แปลง)</div>
            <div style={{ fontSize: 11, color: BRAND.textSec, marginTop: 2 }}>เพิ่มได้หลายโฉนดในการประเมินเดียว</div>
          </div>
          <button
            onClick={addDeed}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: `1px solid ${BRAND.teal}`, background: 'rgba(45,212,191,0.08)', color: BRAND.teal, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            + เพิ่มโฉนด
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {form.deeds.map((deed, idx) => {
            const deedSqw = deed.areaRai * 400 + deed.areaNgan * 100 + +deed.areaSqw
            return (
              <div key={deed.id} style={{ padding: 14, borderRadius: 10, border: `1px solid ${BRAND.border}`, background: BRAND.bg }}>
                {/* Deed header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: BRAND.teal, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{idx + 1}</div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: BRAND.textPri }}>
                      {deed.titleDeedNo ? `โฉนด ${deed.titleDeedNo}` : `โฉนดแปลงที่ ${idx + 1}`}
                    </span>
                    {deedSqw > 0 && <span style={{ fontSize: 11, color: BRAND.teal }}>{deed.areaRai > 0 ? `${deed.areaRai} ไร่ ` : ''}{deed.areaNgan > 0 ? `${deed.areaNgan} งาน ` : ''}{deed.areaSqw > 0 ? `${deed.areaSqw} ตร.ว.` : ''}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => {
                        const q = [deed.titleDeedNo ? `เลขโฉนด ${deed.titleDeedNo}` : '', form.province ? `จังหวัด${form.province}` : ''].filter(Boolean).join(' ')
                        window.open(`https://landsmaps.dol.go.th/${q ? '?q=' + encodeURIComponent(q) : ''}`, '_blank')
                      }}
                      style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: `1px solid ${BRAND.gold}`, background: 'transparent', color: BRAND.gold, cursor: 'pointer' }}
                    >🌐 LandMap</button>
                    {form.deeds.length > 1 && (
                      <button
                        onClick={() => removeDeed(idx)}
                        style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#F87171', cursor: 'pointer' }}
                      >✕ ลบ</button>
                    )}
                  </div>
                </div>

                {/* Deed fields grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Label style={{ margin: 0 }}>เลขโฉนดที่ดิน</Label>
                      <button type="button" onClick={() => openDolSearch(idx)}
                        style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(45,212,191,0.5)', background: 'rgba(45,212,191,0.08)', color: BRAND.teal, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        🏛️ ดึงข้อมูลกรมที่ดิน
                      </button>
                    </div>
                    <Inp value={deed.titleDeedNo} onChange={e => updateDeed(idx, 'titleDeedNo', e.target.value)} placeholder="เช่น 89062" />
                  </div>
                  <div>
                    <Label>เลขที่ดิน</Label>
                    <Inp value={deed.landNo} onChange={e => updateDeed(idx, 'landNo', e.target.value)} placeholder="เช่น 10" />
                  </div>
                  <div>
                    <Label>ระวาง</Label>
                    <Inp value={deed.mapSheet} onChange={e => updateDeed(idx, 'mapSheet', e.target.value)} placeholder="เช่น 5237I" />
                  </div>
                  <div>
                    <Label>หน้าสำรวจ</Label>
                    <Inp value={deed.surveyPage} onChange={e => updateDeed(idx, 'surveyPage', e.target.value)} placeholder="เช่น 12560" />
                  </div>
                </div>

                {/* Area + govPrice */}
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 10, marginTop: 10 }}>
                  <div>
                    <Label>เนื้อที่ (ไร่ - งาน - ตร.ว.)</Label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                      {[['areaRai','ไร่'],['areaNgan','งาน'],['areaSqw','ตร.ว.']].map(([k, lbl]) => (
                        <div key={k}>
                          <input type="number" min="0" value={deed[k]} onChange={e => updateDeed(idx, k, +e.target.value)} style={{ ...inputBase, textAlign: 'center', padding: '8px 4px' }} />
                          <div style={{ fontSize: 10, color: BRAND.textSec, textAlign: 'center', marginTop: 2 }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Label style={{ margin: 0 }}>ราคาประเมินรัฐ (บ./ตร.ว.)</Label>
                      <button
                        type="button"
                        onClick={() => handleGovLookup(idx)}
                        disabled={trdLookup?.deedIdx === idx && trdLookup?.loading}
                        style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.08)', color: BRAND.gold, cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.6 }}
                      >
                        {trdLookup?.deedIdx === idx && trdLookup?.loading ? '⏳ กำลังค้นหา...' : '🏛️ กรมธนารักษ์'}
                      </button>
                    </div>
                    <input type="number" min="0" value={deed.govPrice} onChange={e => updateDeed(idx, 'govPrice', +e.target.value)} style={inputBase} />

                    {/* Treasury lookup results */}
                    {trdLookup?.deedIdx === idx && !trdLookup.loading && (
                      <div style={{ marginTop: 6, padding: '10px 12px', background: '#0A1628', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 8, fontSize: 12 }}>
                        {trdLookup.error ? (
                          <div style={{ color: '#FCA5A5' }}>❌ {trdLookup.error}</div>
                        ) : trdLookup.records.length === 0 ? (
                          <div style={{ color: BRAND.textSec }}>ไม่พบข้อมูล — ลองตรวจสอบเลขที่ดินหรือระวาง</div>
                        ) : (
                          <>
                            <div style={{ color: BRAND.textSec, marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>พบ {trdLookup.total.toLocaleString('th-TH')} รายการ</span>
                              {trdLookup.total > 10 && (
                                <span style={{ color: '#FBBF24', fontSize: 9 }}>ระบุระวางเพื่อลดผลลัพธ์</span>
                              )}
                            </div>
                            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                            {trdLookup.records.slice(0, 15).map((r, i) => {
                              const price = extractPrice(r)
                              return (
                                <button key={i}
                                  onClick={() => { updateDeed(trdLookup.deedIdx, 'govPrice', price); setTrdLookup(null) }}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', margin: '2px 0', borderRadius: 6, border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.05)', color: BRAND.textPri, cursor: 'pointer' }}
                                >
                                  <div style={{ color: BRAND.gold, fontWeight: 700, fontSize: 12 }}>{price.toLocaleString('th-TH')} ฿/ตร.ว.</div>
                                  <div style={{ color: BRAND.textSec, fontSize: 9, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{recordLabel(r)}</div>
                                </button>
                              )
                            })}
                            </div>
                            {trdLookup.total > 15 && (
                              <div style={{ color: BRAND.textSec, fontSize: 9, marginTop: 4, textAlign: 'center' }}>แสดง 15 จาก {trdLookup.total} รายการ — กรอกระวางเพื่อกรอง</div>
                            )}
                          </>
                        )}
                        <button onClick={() => setTrdLookup(null)} style={{ fontSize: 10, color: BRAND.textSec, background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0 }}>✕ ปิด</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary row */}
        {form.deeds.length > 1 && (() => {
          const totalSqw = form.deeds.reduce((s, d) => s + d.areaRai * 400 + d.areaNgan * 100 + +d.areaSqw, 0)
          const totalRai = Math.floor(totalSqw / 400)
          const rem1 = totalSqw % 400
          const totalNgan = Math.floor(rem1 / 100)
          const totalSqwRem = rem1 % 100
          return (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(45,212,191,0.08)', border: `1px solid rgba(45,212,191,0.3)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 12, color: BRAND.teal, fontWeight: 700 }}>รวมเนื้อที่ทั้งหมด</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: BRAND.teal }}>
                {totalRai > 0 ? `${totalRai} ไร่ ` : ''}{totalNgan > 0 ? `${totalNgan} งาน ` : ''}{totalSqwRem > 0 ? `${totalSqwRem.toFixed(1)} ตร.ว.` : ''} ({Math.round(totalSqw).toLocaleString('th-TH')} ตร.ว.)
              </div>
            </div>
          )
        })()}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>📍 ที่ตั้ง</div>
          <Label>จังหวัด</Label>
          <Sel value={form.province} onChange={e => handleProvinceSelect(e.target.value)} style={{ marginBottom: 10 }}>
            <option value="">— เลือกจังหวัด —</option>
            {provinceChoices.map(p => <option key={p} value={p}>{p}</option>)}
          </Sel>
          <Label>อำเภอ / เขต</Label>
          <Sel
            value={form.district}
            onChange={e => handleDistrictSelect(e.target.value)}
            disabled={!form.province}
            style={{ marginBottom: 10, ...(!form.province ? lockedSelectStyle : {}) }}
          >
            <option value="">{form.province ? '— เลือกอำเภอ / เขต —' : 'เลือกจังหวัดก่อน'}</option>
            {districtChoices.map(d => <option key={d} value={d}>{d}</option>)}
          </Sel>
          <Label>ตำบล / แขวง</Label>
          <Sel
            value={form.subdistrict}
            onChange={e => update('subdistrict', e.target.value)}
            disabled={!form.province || !form.district}
            style={!form.province || !form.district ? lockedSelectStyle : {}}
          >
            <option value="">{form.district ? '— เลือกตำบล / แขวง —' : 'เลือกอำเภอก่อน'}</option>
            {subdistrictChoices.map(s => <option key={s} value={s}>{s}</option>)}
          </Sel>
        </Card>
      </div>

      {/* ── DOL Search Modal ── */}
      {dolSearch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0D1B2E', border: '1px solid rgba(45,212,191,0.4)', borderRadius: 12, padding: 24, width: 380, maxWidth: '90vw' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: BRAND.teal, marginBottom: 16 }}>🏛️ ค้นหาข้อมูลจากกรมที่ดิน</div>
            <div style={{ marginBottom: 12 }}>
              <Label>จังหวัด</Label>
              <select value={dolSearch.provCode}
                onChange={async e => {
                  const code = e.target.value
                  setDolSearch(p => ({ ...p, provCode: code, ampCode: '', amphoeList: null }))
                  const list = await getAmphoeList(code)
                  setDolSearch(p => p ? { ...p, amphoeList: list } : p)
                }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #162E56', background: '#050B18', color: '#F0F6FF', fontSize: 13 }}>
                <option value="">— เลือกจังหวัด —</option>
                {THAI_PROVINCES.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Label>รหัสอำเภอ (2 หลัก)</Label>
              <input value={dolSearch.ampCode}
                onChange={e => setDolSearch(p => ({ ...p, ampCode: e.target.value }))}
                placeholder="เช่น 01 = เมือง, 02 = อำเภอถัดไป"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #162E56', background: '#050B18', color: '#F0F6FF', fontSize: 13, boxSizing: 'border-box' }} />
              <div style={{ fontSize: 10, color: BRAND.textSec, marginTop: 3 }}>ดูรหัสจาก landsmaps.dol.go.th → เลือกจังหวัด → อำเภอที่ขึ้นต้นด้วย 01, 02...</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Label>เลขโฉนดที่ดิน</Label>
              <input value={dolSearch.deedNo}
                onChange={e => setDolSearch(p => ({ ...p, deedNo: e.target.value }))}
                placeholder="เช่น 34337"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #162E56', background: '#050B18', color: '#F0F6FF', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            {dolSearch.error && (
              <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#FCA5A5', fontSize: 12, marginBottom: 12 }}>
                ❌ {dolSearch.error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleDolSearch} disabled={dolSearch.loading || !dolSearch.provCode || !dolSearch.ampCode || !dolSearch.deedNo}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: (dolSearch.loading || !dolSearch.provCode || !dolSearch.ampCode || !dolSearch.deedNo) ? BRAND.border : BRAND.teal, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {dolSearch.loading ? '⏳ กำลังค้นหา...' : '🔍 ค้นหา'}
              </button>
              <button onClick={() => setDolSearch(null)}
                style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #162E56', background: 'transparent', color: BRAND.textSec, fontSize: 13, cursor: 'pointer' }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
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
      showToast('กรุณากรอก จังหวัด/อำเภอ/ตำบล ใน Step 1 ก่อน')
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
        showToast('ไม่พบตำแหน่ง กรุณาคลิกบนแผนที่แทน')
      }
    } catch {
      showToast('เกิดข้อผิดพลาดในการค้นหาตำแหน่ง')
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
      showToast('พิกัดไม่ถูกต้อง\nละติจูด: -90 ถึง 90\nลองจิจูด: -180 ถึง 180')
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
function CompAdjPanel({ form, update, calc }) {
  const comps = form.comps || []
  const addComp = () => update('comps', [...comps, { price: '', date: '', size: '200–500 ตร.ว.', access: 'ถนนหลัก', utilities: 'ครบทุกอย่าง' }])
  const removeComp = i => update('comps', comps.filter((_, idx) => idx !== i))
  const updateComp = (i, k, v) => update('comps', comps.map((c, idx) => idx === i ? { ...c, [k]: v } : c))
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold }}>📐 Comparable Sales — Adjusted</div>
        <button onClick={addComp} style={{ padding: '5px 14px', borderRadius: 8, background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.4)', color: BRAND.teal, fontSize: 12, cursor: 'pointer' }}>+ เพิ่ม Comp</button>
      </div>
      {comps.length === 0 && (
        <div style={{ textAlign: 'center', padding: '14px 0', fontSize: 12, color: BRAND.textMut }}>ยังไม่มี Comp — กด "+ เพิ่ม Comp" เพื่อบันทึกราคาอ้างอิงพร้อม adjustment อัตโนมัติ</div>
      )}
      {comps.map((c, i) => {
        const months = c.date ? Math.max(0, (Date.now() - new Date(c.date)) / (1000 * 60 * 60 * 24 * 30)) : 0
        const adjPrice = +c.price > 0 ? Math.round(+c.price * (1 + 0.005 * months) * (1 + (COMP_ADJ.size[c.size] ?? 0)) * (1 + (COMP_ADJ.access[c.access] ?? 0)) * (1 + (COMP_ADJ.utilities[c.utilities] ?? 0))) : null
        return (
          <div key={i} style={{ marginBottom: 10, padding: 12, background: BRAND.bg, borderRadius: 10, border: `1px solid ${BRAND.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.textPri }}>Comp {i + 1}</span>
              <button onClick={() => removeComp(i)} style={{ background: 'none', border: 'none', color: BRAND.textSec, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><Label>ราคา (บาท/ตร.ว.)</Label><Inp type="number" min="0" value={c.price} onChange={e => updateComp(i, 'price', e.target.value)} placeholder="เช่น 8500" /></div>
              <div><Label>วันที่ขาย Comp</Label><Inp type="date" value={c.date} onChange={e => updateComp(i, 'date', e.target.value)} /></div>
              <div><Label>ขนาดแปลง Comp</Label>
                <Sel value={c.size} onChange={e => updateComp(i, 'size', e.target.value)}>
                  {Object.keys(COMP_ADJ.size).map(k => <option key={k}>{k}</option>)}
                </Sel>
              </div>
              <div><Label>การเข้าถึง Comp</Label>
                <Sel value={c.access} onChange={e => updateComp(i, 'access', e.target.value)}>
                  {Object.keys(COMP_ADJ.access).map(k => <option key={k}>{k}</option>)}
                </Sel>
              </div>
              <div><Label>สาธารณูปโภค Comp</Label>
                <Sel value={c.utilities} onChange={e => updateComp(i, 'utilities', e.target.value)}>
                  {Object.keys(COMP_ADJ.utilities).map(k => <option key={k}>{k}</option>)}
                </Sel>
              </div>
              {adjPrice && (
                <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.3)', textAlign: 'center', alignSelf: 'end' }}>
                  <div style={{ fontSize: 10, color: BRAND.textSec }}>Adjusted Price</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: BRAND.teal }}>฿{fmt(adjPrice)}/ตร.ว.</div>
                </div>
              )}
            </div>
          </div>
        )
      })}
      {calc.compAvgAdjPrice && (
        <div style={{ marginTop: 4, padding: '12px 16px', borderRadius: 10, background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: BRAND.textSec }}>ราคาตลาด Adjusted เฉลี่ย ({comps.filter(c => +c.price > 0).length} Comps)</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: BRAND.teal }}>฿{fmt(calc.compAvgAdjPrice)}/ตร.ว.</div>
          </div>
          <button
            onClick={() => { update('compPrice', calc.compAvgAdjPrice); update('compSource', `Comp Adjusted เฉลี่ย ${comps.filter(c => +c.price > 0).length} รายการ`) }}
            style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(45,212,191,0.2)', border: '1px solid rgba(45,212,191,0.5)', color: BRAND.teal, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
          >ใช้ราคานี้ →</button>
        </div>
      )}
    </Card>
  )
}

function NearbyPricePointsPanel({ points = [], loading, form, update }) {
  const hasLocation = form.lat && form.lng
  const avgPrice = points.length > 0
    ? Math.round(points.reduce((sum, p) => sum + (Number(p.price_per_sqw) || 0), 0) / points.length)
    : null

  return (
    <Card style={{ borderColor: 'rgba(45,212,191,0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.teal }}>Nearby price points</div>
          <div style={{ fontSize: 11, color: BRAND.textSec, marginTop: 2 }}>Internal comps near this pin, ordered by subtype match and distance.</div>
        </div>
        {avgPrice && (
          <button
            onClick={() => { update('compPrice', avgPrice); update('compSource', `Nearby internal price points (${points.length})`) }}
            style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${BRAND.teal}`, background: 'rgba(45,212,191,0.12)', color: BRAND.teal, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Use avg ฿{fmt(avgPrice)}/sqw
          </button>
        )}
      </div>

      {!hasLocation && (
        <div style={{ fontSize: 12, color: BRAND.textMut, padding: '10px 0' }}>Pin the property on the map to search nearby internal price points.</div>
      )}
      {hasLocation && loading && (
        <div style={{ fontSize: 12, color: BRAND.textSec, padding: '10px 0' }}>Loading nearby price points...</div>
      )}
      {hasLocation && !loading && points.length === 0 && (
        <div style={{ fontSize: 12, color: BRAND.textMut, padding: '10px 0' }}>No nearby internal price points yet. Saving valuations with a pin and market price will build this database.</div>
      )}
      {points.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
          {points.map((p) => {
            const band = confidenceBand(p.confidence_score)
            return (
              <button
                key={p.id}
                onClick={() => { update('compPrice', Number(p.price_per_sqw) || ''); update('compSource', `Nearby ${p.source_type || 'price point'} #${p.id}`) }}
                style={{ textAlign: 'left', padding: 10, borderRadius: 8, border: `1px solid ${BRAND.border}`, background: BRAND.bg, color: BRAND.textPri, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: BRAND.teal }}>฿{fmt(p.price_per_sqw)}/sqw</span>
                  <span style={{ fontSize: 10, color: band.color, whiteSpace: 'nowrap' }}>{band.label}</span>
                </div>
                <div style={{ fontSize: 11, color: BRAND.textSec }}>{Math.round(p.distance_m).toLocaleString('th-TH')} m · {p.property_subtype || p.property_type || 'property'}</div>
                <div style={{ fontSize: 10, color: BRAND.textMut, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.source_note || p.source_type || 'internal comp'}</div>
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function Step2({ form, update, calc, comps = [], nearbyPricePoints = [], nearbyLoading = false }) {
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
            <optgroup label="🔴 พาณิชยกรรม">
              {ZONE_OPTIONS.filter(o => o.value.startsWith('พ')).map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </optgroup>
            <optgroup label="🟡 ที่อยู่อาศัย">
              {ZONE_OPTIONS.filter(o => o.value.startsWith('ย')).map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </optgroup>
            <optgroup label="🟣 อุตสาหกรรมและคลังสินค้า">
              {ZONE_OPTIONS.filter(o => o.value.startsWith('อ') || o.value.startsWith('ค —')).map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </optgroup>
            <optgroup label="🩷 ชนบทและชุมชน">
              {ZONE_OPTIONS.filter(o => o.value.startsWith('ช')).map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </optgroup>
            <optgroup label="🟢 เกษตรกรรม">
              {ZONE_OPTIONS.filter(o => o.value.startsWith('ก')).map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </optgroup>
            <optgroup label="🌿 อนุรักษ์และสิ่งแวดล้อม">
              {ZONE_OPTIONS.filter(o => ['ส —','ปา','ทพ','สท','วท','ล —','ลช','ลท','ลป','สน —','สล'].some(p => o.value.startsWith(p))).map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </optgroup>
            <optgroup label="🔵 สถาบัน / สาธารณูปการ / ทหาร">
              {ZONE_OPTIONS.filter(o => ['สศ','สน —','สร','ทห'].some(p => o.value.startsWith(p))).map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </optgroup>
            <optgroup label="⚫ คมนาคม / เสี่ยงภัย">
              {ZONE_OPTIONS.filter(o => o.value.startsWith('คข') || o.value.startsWith('อภ')).map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </optgroup>
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
                    onClick={() => setForm(prev => ({ ...prev, deeds: prev.deeds.map(d => ({ ...d, govPrice: avgGovPrice })) }))}
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
            { label: 'ราคาประเมินรัฐ', value: `฿${fmt(calc.weightedGovPrice)}`, sub: 'บาท/ตร.ว. (ถัวเฉลี่ย)' },
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
      <CompAdjPanel form={form} update={update} calc={calc} />
      <NearbyPricePointsPanel points={nearbyPricePoints} loading={nearbyLoading} form={form} update={update} />
      <MarketSearchPanel form={form} update={update} />
      <MapPicker form={form} update={update} />
    </div>
  )
}

// ── Step 3 ─────────────────────────────────────────────
function PolicyGatePanel({ policy, compact = false }) {
  if (!policy) return null
  const visibleFlags = policy.activeFlags.slice(0, compact ? 3 : 6)
  const visibleConditions = policy.conditions.slice(0, compact ? 4 : 8)
  return (
    <Card style={{ borderColor: `${policy.decision.color}55`, background: compact ? 'rgba(15,23,42,0.35)' : BRAND.bgCard }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: BRAND.gold }}>Underwriting Policy Gate</div>
          <div style={{ fontSize: 11, color: BRAND.textSec, marginTop: 3 }}>{policy.decision.reason}</div>
        </div>
        <div style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${policy.decision.color}66`, background: `${policy.decision.color}18`, color: policy.decision.color, fontSize: 12, fontWeight: 800 }}>
          {policy.decision.status}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          ['Safe', policy.exposureBands.safe],
          ['Recommended', policy.exposureBands.recommended],
          ['Maximum', policy.exposureBands.maximum],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: 10, borderRadius: 8, background: BRAND.bg, border: `1px solid ${BRAND.border}` }}>
            <div style={{ fontSize: 10, color: BRAND.textSec }}>{label} exposure</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: label === 'Recommended' ? BRAND.teal : BRAND.textPri }}>฿{fmt(value)}</div>
          </div>
        ))}
      </div>

      {visibleFlags.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#FCA5A5', marginBottom: 6 }}>Red flags</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {visibleFlags.map((flag) => (
              <span key={flag.key} style={{ padding: '4px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: 11 }}>
                {flag.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.teal, marginBottom: 6 }}>Conditions precedent</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {visibleConditions.map((condition) => (
            <div key={condition} style={{ fontSize: 11, color: BRAND.textSec, lineHeight: 1.45 }}>• {condition}</div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function Step3({ form, update, calc, policy }) {
  const { riskScore, riskBand } = calc
  const scoreColor = riskScore <= 15 ? '#10B981' : riskScore <= 30 ? '#84CC16' : riskScore <= 50 ? '#F59E0B' : riskScore <= 70 ? '#F97316' : '#EF4444'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 18, color: BRAND.textPri, marginBottom: 4 }}>⚠️ ปัจจัยความเสี่ยงทรัพย์</div>
        <div style={{ fontSize: 12, color: BRAND.textSec }}>ระบุระดับความเสี่ยงแต่ละด้านเพื่อคำนวณ FSV ที่แม่นยำขึ้น</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>🌊 ประวัติน้ำท่วม</div>
          <Label>ระดับความเสี่ยงน้ำท่วม</Label>
          <Sel value={form.floodLevel} onChange={e => update('floodLevel', e.target.value)}>
            {FLOOD_LEVELS.map(f => (
              <option key={f.value} value={f.value}>{f.value}{f.score > 0 ? ` (+${f.score} pts)` : ''}</option>
            ))}
          </Sel>
        </Card>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>📄 เอกสารสิทธิ์</div>
          <Label>ประเภทโฉนด / สิทธิ์ที่ดิน</Label>
          <Sel value={form.titleType} onChange={e => update('titleType', e.target.value)}>
            {TITLE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.value}{t.score > 0 ? ` (+${t.score} pts)` : ''}</option>
            ))}
          </Sel>
        </Card>
      </div>

      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>🚩 ปัจจัยเสี่ยงเพิ่มเติม</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {RISK_FACTORS.map(rf => (
            <label key={rf.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${form.risks[rf.key] ? 'rgba(239,68,68,0.4)' : BRAND.border}`, background: form.risks[rf.key] ? 'rgba(239,68,68,0.08)' : BRAND.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={!!form.risks[rf.key]} onChange={e => update('risks', { ...form.risks, [rf.key]: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#EF4444', cursor: 'pointer' }} />
                <span style={{ fontSize: 13, color: BRAND.textPri }}>{rf.label}</span>
              </div>
              <span style={{ fontSize: 11, color: '#F87171', fontWeight: 600 }}>+{rf.score} pts</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: BRAND.bg, borderRadius: 12, border: `1px solid ${scoreColor}40` }}>
          <div>
            <div style={{ fontSize: 11, color: BRAND.textSec, marginBottom: 4 }}>Risk Score</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{riskScore}</div>
            <div style={{ fontSize: 12, color: BRAND.textSec }}>/100</div>
            <div style={{ marginTop: 6, display: 'inline-block', padding: '2px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: `${scoreColor}20`, color: scoreColor, border: `1px solid ${scoreColor}50` }}>
              ความเสี่ยง{riskBand.label}
            </div>
          </div>
          <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="40" cy="40" r="32" fill="none" stroke={BRAND.border} strokeWidth="8" />
            <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor} strokeWidth="8" strokeDasharray={`${(riskScore / 100) * 201} 201`} strokeLinecap="round" />
          </svg>
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>🏦 กำหนด LTV RATE</div>
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: `${riskBand.color}18`, border: `1px solid ${riskBand.color}40`, fontSize: 12, display: 'flex', gap: 16 }}>
          <span><span style={{ color: BRAND.textSec }}>LTV สูงสุด (Risk Band): </span><span style={{ fontWeight: 700, color: riskBand.color }}>{riskBand.ltvMax}%</span></span>
          <span><span style={{ color: BRAND.textSec }}>FSV Rate: </span><span style={{ fontWeight: 700, color: riskBand.color }}>{Math.round(calc.fsvRate * 100)}%</span></span>
        </div>
        <input type="range" min="20" max="75" step="5" value={form.ltvRate} onChange={e => update('ltvRate', +e.target.value)} style={{ width: '100%', accentColor: BRAND.gold, cursor: 'pointer' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: BRAND.textSec }}>
          <span>20% — อนุรักษ์นิยม</span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: BRAND.gold }}>{form.ltvRate}%</div>
            {form.ltvRate > riskBand.ltvMax && (
              <div style={{ fontSize: 10, color: '#F97316' }}>จะถูก cap ที่ {riskBand.ltvMax}%</div>
            )}
          </div>
          <span>75% — สูงสุด</span>
        </div>
      </Card>

      <PolicyGatePanel policy={policy} />
    </div>
  )
}

// ── Step 4 ─────────────────────────────────────────────
function Step4({ form, calc, update, policy, underwritingMemo, underwritingLoading, underwritingError, onGenerateUnderwriting, onCopyUnderwriting }) {
  const reqLoan = parseFloat(form.requestedLoan) || 0
  const loanToGovLtv = calc.govPriceTotal > 0 ? (reqLoan / calc.govPriceTotal) * 100 : 0
  const reqLtv = calc.marketValue > 0 ? (reqLoan / calc.marketValue) * 100 : 0
  const reqLtvVsFsv = calc.fsv > 0 ? (reqLoan / calc.fsv) * 100 : 0
  const isOverLimit = reqLoan > calc.recommendedLoan
  const reqColor = reqLoan === 0 ? BRAND.textSec : isOverLimit ? '#EF4444' : BRAND.success
  const formatLtv = (value, base) => base > 0 ? `${value.toFixed(2)}%` : '—'
  const formatCushion = (base) => {
    if (!reqLoan || !base) return '—'
    const diff = base - reqLoan
    return `${diff >= 0 ? 'เหลือกันชน' : 'เกินฐานราคา'} ฿${fmt(Math.abs(diff))}`
  }
  const ltvCompareRows = [
    {
      label: 'เทียบราคาประเมินราชการ',
      base: calc.govPriceTotal,
      unit: calc.weightedGovPrice,
      ltv: loanToGovLtv,
      note: 'ฐานอ้างอิงราชการ',
    },
    {
      label: 'เทียบราคาซื้อขาย/ตลาดจริง',
      base: calc.marketValue,
      unit: calc.effectiveMarketPrice,
      ltv: reqLtv,
      note: form.compPrice ? 'ใช้ราคา Comp/ตลาดที่กรอก' : 'ใช้ราคาตลาดจากสูตรประเมิน',
    },
    {
      label: 'เทียบ Forced Sale Value',
      base: calc.fsv,
      unit: calc.totalSqw > 0 ? calc.fsv / calc.totalSqw : 0,
      ltv: reqLtvVsFsv,
      note: `ฐานขายเร็ว ${Math.round(calc.fsvRate * 100)}% ของราคาตลาด`,
    },
  ]
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
        <div style={{ fontSize: 13, color: BRAND.textSec }}>
          โฉนดเลขที่ {form.deeds.map(d => d.titleDeedNo).filter(Boolean).join(', ') || '—'} ({form.deeds.length} แปลง) | {form.subdistrict ? `ต.${form.subdistrict} ` : ''}{form.district ? `อ.${form.district} ` : ''}{form.province}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { icon: '🏛️', label: 'ราคาประเมินรัฐ', value: `฿${fmt(calc.govPriceTotal)}`, sub: `${fmt(calc.weightedGovPrice)} บาท/ตร.ว. (ถัวเฉลี่ย)` },
          { icon: '📊', label: 'ราคาตลาดโดยประมาณ', value: `฿${fmt(calc.marketValue)}`, sub: `${fmt(calc.effectiveMarketPrice)} บาท/ตร.ว.` },
          { icon: '🔥', label: 'FORCED SALE VALUE', value: `฿${fmt(calc.fsv)}`, sub: `${Math.round(calc.fsvRate * 100)}% ของราคาตลาด (Risk: ${calc.riskBand?.label || '—'})` },
          { icon: '🏦', label: 'วงเงินขายฝากแนะนำ', value: `฿${fmt(calc.recommendedLoan)}`, sub: `LTV ${calc.cappedLtv}% × FSV`, hi: true },
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
            ['เนื้อที่รวม', `${fmt(calc.totalSqw)} ตร.ว. (${form.deeds.length} แปลง)`],
            ['ราคาประเมินกรมธนารักษ์', `${fmt(calc.weightedGovPrice)} บาท/ตร.ว. (ถัวเฉลี่ย)`],
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
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: calc.riskBand?.color || BRAND.gold }}>Risk {calc.riskScore}</div>
              <div style={{ fontSize: 12, color: BRAND.textSec }}>/100</div>
            </div>
            <div style={{ marginTop: 4, display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${calc.riskBand?.color || BRAND.gold}20`, color: calc.riskBand?.color || BRAND.gold, border: `1px solid ${calc.riskBand?.color || BRAND.gold}50` }}>ความเสี่ยง{calc.riskBand?.label}</div>
            <div style={{ marginTop: 6, fontSize: 11, color: BRAND.textSec }}>FSV Rate: {Math.round(calc.fsvRate * 100)}% | LTV Cap: {calc.riskBand?.ltvMax}%</div>
            {RISK_FACTORS.filter(rf => form.risks[rf.key]).length === 0 && !form.floodLevel?.includes('ท่วม') && form.titleType === 'โฉนด (Chanote) ปลอดภาระ'
              ? <div style={{ marginTop: 6, fontSize: 12, color: BRAND.success }}>ไม่พบปัจจัยเสี่ยง</div>
              : <div style={{ marginTop: 6, fontSize: 11, color: '#FCA5A5' }}>{[form.floodLevel !== 'ไม่มีประวัติน้ำท่วม' ? form.floodLevel : null, form.titleType !== 'โฉนด (Chanote) ปลอดภาระ' ? form.titleType : null, ...RISK_FACTORS.filter(rf => form.risks[rf.key]).map(rf => rf.label)].filter(Boolean).join(', ')}</div>
            }
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>💰 สรุปวงเงิน</div>
            {[['มูลค่าตลาด', calc.marketValue], [`FSV (${Math.round(calc.fsvRate*100)}%)`, calc.fsv], [`วงเงินแนะนำ (LTV ${calc.cappedLtv}%)`, calc.recommendedLoan]].map(([k, v]) => (
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

          <PolicyGatePanel policy={policy} compact />

          {/* วงเงินที่ลูกค้าเสนอขอ */}
          <Card style={{ borderColor: underwritingMemo ? 'rgba(45,212,191,0.35)' : BRAND.border }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: BRAND.gold }}>Hermes Underwriting Memo</div>
                <div style={{ fontSize: 10, color: BRAND.textSec, marginTop: 3 }}>วิเคราะห์ MV/QSV/FSV, LTV, ความเสี่ยง และเงื่อนไขอนุมัติ</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={onGenerateUnderwriting}
                  disabled={underwritingLoading}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(45,212,191,0.45)',
                    background: underwritingLoading ? 'rgba(45,212,191,0.08)' : 'rgba(45,212,191,0.16)',
                    color: underwritingLoading ? BRAND.textSec : BRAND.teal,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: underwritingLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {underwritingLoading ? 'กำลังประเมินด้วย AI...' : 'ประเมินด้วย AI'}
                </button>
              </div>
            </div>
            {underwritingError && (
              <div style={{ padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: 11, marginBottom: 10 }}>
                {underwritingError}
              </div>
            )}
            {underwritingMemo ? (
              <>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, maxHeight: 520, overflow: 'auto', padding: 12, borderRadius: 8, background: '#050B18', border: `1px solid ${BRAND.border}`, color: BRAND.textPri, fontSize: 12 }}>
                  {underwritingMemo}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={onCopyUnderwriting}
                    disabled={underwritingLoading}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: `1px solid ${underwritingLoading ? BRAND.border : 'rgba(245,158,11,0.45)'}`,
                      background: underwritingLoading ? 'rgba(148,163,184,0.06)' : 'rgba(245,158,11,0.12)',
                      color: underwritingLoading ? BRAND.textMut : BRAND.gold,
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: underwritingLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    คัดลอก Memo
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: 12, borderRadius: 8, background: '#050B18', border: `1px solid ${BRAND.border}`, color: BRAND.textSec, fontSize: 11 }}>
                กดปุ่มเพื่อให้ Hermes วิเคราะห์หลักประกันจากข้อมูลประเมินปัจจุบันและ nearby price points
              </div>
            )}
          </Card>

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
                <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.28)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: BRAND.gold, marginBottom: 8 }}>สรุปเทียบวงเงินขายฝากกับฐานราคา</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.95fr 0.7fr 1fr', gap: 8, paddingBottom: 6, borderBottom: `1px solid ${BRAND.border}`, fontSize: 10, color: BRAND.textSec }}>
                    <div>ฐานราคา</div>
                    <div style={{ textAlign: 'right' }}>มูลค่ารวม</div>
                    <div style={{ textAlign: 'right' }}>LTV</div>
                    <div style={{ textAlign: 'right' }}>ส่วนต่าง</div>
                  </div>
                  {ltvCompareRows.map((row) => (
                    <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.95fr 0.7fr 1fr', gap: 8, padding: '8px 0', borderBottom: `1px solid ${BRAND.border}`, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.textPri }}>{row.label}</div>
                        <div style={{ fontSize: 9, color: BRAND.textMut }}>{row.unit ? `${fmt(row.unit)} บาท/ตร.ว. · ${row.note}` : row.note}</div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.textPri, textAlign: 'right' }}>฿{fmt(row.base)}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: row.ltv > 75 ? '#EF4444' : row.ltv > 60 ? '#F59E0B' : BRAND.success, textAlign: 'right' }}>{formatLtv(row.ltv, row.base)}</div>
                      <div style={{ fontSize: 10, color: row.base >= reqLoan ? BRAND.success : '#EF4444', textAlign: 'right' }}>{formatCushion(row.base)}</div>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, fontSize: 10, color: BRAND.textSec }}>
                    วงเงินขายฝากที่นำมาเทียบ: ฿{fmt(reqLoan)} · วงเงินแนะนำจากระบบ: ฿{fmt(calc.recommendedLoan)}
                  </div>
                </div>
                {/* ตารางเปรียบเทียบ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'LTV ต่อราคาตลาด', value: `${reqLtv.toFixed(2)}%`, sub: `฿${fmt(reqLoan)} ÷ ฿${fmt(calc.marketValue)}` },
                    { label: `LTV ต่อ FSV (${Math.round(calc.fsvRate*100)}%)`, value: `${reqLtvVsFsv.toFixed(2)}%`, sub: `฿${fmt(reqLoan)} ÷ ฿${fmt(calc.fsv)}` },
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
  const initialDraft = useMemo(() => loadValuationDraft(), [])
  const [view, setView] = useState('form')
  const [step, setStep] = useState(initialDraft.step)
  const [form, setForm] = useState(initialDraft.form)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [comps, setComps] = useState([])
  const [nearbyPricePoints, setNearbyPricePoints] = useState([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [underwritingMemo, setUnderwritingMemo] = useState('')
  const [underwritingLoading, setUnderwritingLoading] = useState(false)
  const [underwritingError, setUnderwritingError] = useState('')
  const [valuationSeq, setValuationSeq] = useState(1)
  const compsLoadedRef = useRef(false)
  const seqLoadedRef = useRef(false)

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
  const updateDeed = (idx, key, val) => setForm(prev => ({ ...prev, deeds: prev.deeds.map((d, i) => i === idx ? { ...d, [key]: val } : d) }))
  const addDeed = () => setForm(prev => ({ ...prev, deeds: [...prev.deeds, EMPTY_DEED()] }))
  const removeDeed = (idx) => setForm(prev => ({ ...prev, deeds: prev.deeds.filter((_, i) => i !== idx) }))

  useEffect(() => {
    localStorage.setItem(VALUATION_DRAFT_KEY, JSON.stringify({
      form,
      step,
      updatedAt: new Date().toISOString(),
    }))
  }, [form, step])

  // โหลด sequence number จากจำนวนประเมินทั้งหมด
  useEffect(() => {
    if (seqLoadedRef.current) return
    seqLoadedRef.current = true
    apiGetValuations()
      .then(rows => {
        const curYear = String(new Date().getFullYear()).slice(-2)
        const thisYearCount = rows.filter(r => {
          const code = r['รหัส/ชื่อทรัพย์'] || r['projectName'] || ''
          return code.endsWith(`-${curYear}`)
        }).length
        setValuationSeq(thisYearCount + 1)
      })
      .catch(() => {})
  }, [])

  // Auto-generate รหัสทรัพย์ เมื่อเปลี่ยนประเภท/จังหวัด/ประเภทย่อย
  useEffect(() => {
    const code = generateAssetCode(form.assessmentType, form.province, form.propertySubtype, valuationSeq)
    setForm(prev => ({ ...prev, assetCode: code }))
  }, [form.assessmentType, form.province, form.propertySubtype, valuationSeq])

  useEffect(() => {
    if (step !== 2 || compsLoadedRef.current) return
    compsLoadedRef.current = true
    apiGetValuations()
      .then(data => setComps(data))
      .catch(() => {})
  }, [step])

  useEffect(() => {
    if (step !== 2 || !form.lat || !form.lng) {
      setNearbyPricePoints([])
      return
    }
    let cancelled = false
    setNearbyLoading(true)
    apiGetNearbyAreaPricePoints({
      lat: form.lat,
      lng: form.lng,
      province: form.province,
      propertyType: form.propertyType,
      propertySubtype: form.propertySubtype,
      radiusM: 5000,
      limit: 8,
    })
      .then(points => { if (!cancelled) setNearbyPricePoints(points) })
      .catch(() => { if (!cancelled) setNearbyPricePoints([]) })
      .finally(() => { if (!cancelled) setNearbyLoading(false) })
    return () => { cancelled = true }
  }, [step, form.lat, form.lng, form.province, form.propertyType, form.propertySubtype])

  const calc = useMemo(() => computeValuation(form), [form])
  const underwritingPolicy = useMemo(
    () => buildUnderwritingPolicy(form, calc, nearbyPricePoints),
    [form, calc, nearbyPricePoints]
  )

  const handleGenerateUnderwriting = async () => {
    if (underwritingLoading) return
    setUnderwritingLoading(true)
    setUnderwritingError('')
    setUnderwritingMemo('')
    try {
      const res = await fetch('/api/underwrite-valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valuation: { ...form, ...calc },
          underwritingPolicy,
          nearbyPricePoints,
          missingFields: underwritingPolicy.missingFields,
          instructions: 'จัดทำ preliminary internal underwriting memo สำหรับทีม AssetX',
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'สร้าง Underwriting Memo ไม่สำเร็จ')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('ไม่สามารถอ่านผลลัพธ์จาก Hermes ได้')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (!data || data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) setUnderwritingMemo(prev => prev + parsed.text)
          } catch {
            setUnderwritingMemo(prev => prev + data)
          }
        }
      }
    } catch (e) {
      setUnderwritingError(e.message)
      showToast('สร้าง Underwriting Memo ไม่สำเร็จ: ' + e.message)
    } finally {
      setUnderwritingLoading(false)
    }
  }

  const handleCopyUnderwriting = async () => {
    const text = underwritingMemo.trim()
    if (!text) {
      showToast('ยังไม่มี Underwriting Memo ให้คัดลอก')
      return
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      showToast('คัดลอก Underwriting Memo แล้ว', 'success')
    } catch (e) {
      showToast('คัดลอก Memo ไม่สำเร็จ: ' + e.message)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const primaryDeed = form.deeds[0] || {}
      await apiSaveValuation({
        ...form,
        ...calc,
        savedAt: new Date().toISOString(),
        projectName: form.assetCode || form.projectName,
        // ส่งข้อมูลโฉนดแรกใน top-level fields (backward compat)
        titleDeedNo: primaryDeed.titleDeedNo || '',
        mapSheet: primaryDeed.mapSheet || '',
        surveyPage: primaryDeed.surveyPage || '',
        landNo: primaryDeed.landNo || '',
        areaRai: primaryDeed.areaRai || 0,
        areaNgan: primaryDeed.areaNgan || 0,
        areaSqw: primaryDeed.areaSqw || 0,
        govPrice: calc.weightedGovPrice,
      })
      setSaved(true)
    } catch (e) {
      showToast('เกิดข้อผิดพลาด: ' + e.message)
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

  const handleReset = () => {
    localStorage.removeItem(VALUATION_DRAFT_KEY)
    setForm(createInitialForm())
    setStep(1)
    setView('form')
    setSaved(false)
    setUnderwritingMemo('')
    setUnderwritingError('')
  }

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
          <button onClick={handleReset} style={{ ...btn(view === 'form'), background: view === 'form' ? BRAND.gold : BRAND.border, color: view === 'form' ? '#000' : BRAND.textSec }}>
            📋 ประเมินใหม่
          </button>
          <button onClick={() => setView('history')} style={{ ...btn(false), background: view === 'history' ? 'rgba(45,212,191,0.15)' : BRAND.border, color: view === 'history' ? BRAND.teal : BRAND.textSec, border: view === 'history' ? `1px solid ${BRAND.teal}` : 'none' }}>
            📂 ประวัติการประเมิน
          </button>
          <span style={{ alignSelf: 'center', fontSize: 11, color: BRAND.textSec }}>
            บันทึกดราฟต์อัตโนมัติ
          </span>
          <button onClick={onBack} style={{ ...btn(false), marginLeft: 'auto' }}>← กลับหน้าหลัก</button>
        </div>

        {/* History View */}
        {view === 'history' && <HistoryView appsScriptUrl={appsScriptUrl} />}

        {/* Form View */}
        {view === 'form' && (
          <>
            <Stepper step={step} />
            {step === 1 && <Step1 form={form} update={update} updateDeed={updateDeed} addDeed={addDeed} removeDeed={removeDeed} customers={customers} assetCode={form.assetCode} />}
            {step === 2 && <Step2 form={form} update={update} calc={calc} comps={comps} nearbyPricePoints={nearbyPricePoints} nearbyLoading={nearbyLoading} />}
            {step === 3 && <Step3 form={form} update={update} calc={calc} policy={underwritingPolicy} />}
            {step === 4 && (
              <Step4
                form={form}
                calc={calc}
                update={update}
                policy={underwritingPolicy}
                underwritingMemo={underwritingMemo}
                underwritingLoading={underwritingLoading}
                underwritingError={underwritingError}
                onGenerateUnderwriting={handleGenerateUnderwriting}
                onCopyUnderwriting={handleCopyUnderwriting}
              />
            )}

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

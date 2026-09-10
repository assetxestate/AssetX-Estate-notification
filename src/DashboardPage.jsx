import React, { useMemo, useState } from 'react'
import { BRAND as BASE_BRAND } from './lib/config.js'
import { getDiff } from './lib/utils.js'

// ใช้สีกลางจาก config.js — override เฉพาะคีย์ที่หน้านี้ใช้ต่าง
const BRAND = { ...BASE_BRAND, success: '#10B981', danger: '#EF4444' }

const fmt = (n) => {
  if (!n || isNaN(n)) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K'
  return Number(n).toLocaleString()
}
const fmtFull = (n) => Number(n || 0).toLocaleString('th-TH')
const thMonth = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const dayMs = 1000 * 60 * 60 * 24

const getCustomerPaymentRecord = (paymentRecords, customerId, installment) => (
  paymentRecords?.[customerId]?.[installment] || paymentRecords?.[String(customerId)]?.[installment]
)

const getPlaceLabel = (customer) => customer.fullLabel?.split('(')[1]?.replace(')', '') || customer.locationNote || 'รอตรวจข้อมูลทรัพย์'

const riskWorkItems = [
  'ตรวจสัญญา โฉนด ภาระผูกพัน และยอดค้าง',
  'เตรียมหนังสือแจ้งเตือน/Notice ให้ฝ่ายกฎหมายตรวจ',
  'ทำ Asset Fact Sheet พร้อมรูป พิกัด จุดเด่น และข้อจำกัด',
  'ประเมินราคาตลาด และตั้งกรอบขายด่วนต่ำกว่าตลาด 15-30%',
  'ส่งข้อมูลให้ทีมการตลาด นายหน้าท้องถิ่น และกลุ่มนักลงทุน',
]

// ── KPI Card ────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color, bg }) {
  return (
    <div style={{ background: bg || BRAND.bgCard, border: `1px solid ${color || BRAND.border}`, borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: BRAND.textSec, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: color || BRAND.textPri, letterSpacing: '-0.5px' }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: BRAND.textMut, marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ fontSize: 28 }}>{icon}</div>
      </div>
    </div>
  )
}

// ── Bar Chart ────────────────────────────────────────────
function BarChart({ data, color, label }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.textSec, marginBottom: 12 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 9, color: BRAND.textSec }}>{d.value > 0 ? fmt(d.value) : ''}</div>
            <div style={{ width: '100%', background: color || BRAND.teal, borderRadius: '4px 4px 0 0', height: `${Math.max((d.value / max) * 72, d.value > 0 ? 4 : 0)}px`, opacity: i === data.length - 1 ? 1 : 0.6, transition: 'height 0.3s' }} />
            <div style={{ fontSize: 9, color: BRAND.textSec, whiteSpace: 'nowrap' }}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Donut Chart ──────────────────────────────────────────
function DonutChart({ segments }) {
  const total = segments.reduce((s, g) => s + g.value, 0)
  let cumulative = 0
  const r = 40, cx = 50, cy = 50, stroke = 18
  const circumference = 2 * Math.PI * r

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={100} height={100} style={{ flexShrink: 0 }}>
        {segments.map((seg, i) => {
          const pct = total > 0 ? seg.value / total : 0
          const offset = circumference * (1 - pct)
          const rotation = cumulative * 360 - 90
          cumulative += pct
          return (
            <circle key={i} cx={cx} cy={cy} r={r}
              fill="none" stroke={seg.color} strokeWidth={stroke}
              strokeDasharray={circumference} strokeDashoffset={offset}
              transform={`rotate(${rotation} ${cx} ${cy})`}
              style={{ transition: 'stroke-dashoffset 0.5s' }}
            />
          )
        })}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={BRAND.textPri} fontSize={12} fontWeight={700}>{total}</text>
        <text x={cx} y={cy + 13} textAnchor="middle" dominantBaseline="middle" fill={BRAND.textSec} fontSize={8}>สัญญา</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, color: BRAND.textPri, fontWeight: 600 }}>{seg.label}</div>
              <div style={{ fontSize: 11, color: BRAND.textSec }}>{seg.value} สัญญา · ฿{fmt(seg.amount)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionToggle({ open, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${BRAND.border}`,
        background: open ? 'rgba(45,212,191,.12)' : 'rgba(148,163,184,.08)',
        color: open ? BRAND.teal : BRAND.textSec,
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {open ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
    </button>
  )
}

// ── Main Dashboard ───────────────────────────────────────
export default function DashboardPage({ customers = [], paymentRecords = {} }) {
  const today = new Date()
  const active = customers.filter(c => !c.isClosed && !c.isVoided && !c.isHiddenDraft)
  const [expandedSections, setExpandedSections] = useState({
    liquidation: false,
    riskContracts: false,
    advance: false,
    overdue: false,
  })
  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── KPIs ────────────────────────────────────────────────
  const totalPrincipal = active.reduce((s, c) => s + (c.principal || 0), 0)

  // แปลง amount ต่องวด → รายได้ต่อเดือน ตาม freq
  const toMonthly = (c) => {
    const amt = c.amount || 0
    const f = c.freq || ''
    if (f.includes('ปี') || f === 'รายปี') return amt / 12
    if (f.includes('2 สัปดาห์') || f.includes('สองสัปดาห์')) return amt * 2
    if (f.includes('วัน')) return amt * 30
    return amt // รายเดือน (default)
  }
  const monthlyIncome = active.reduce((s, c) => s + toMonthly(c), 0)

  // ยอดดอกเบี้ยที่ชำระแล้วทั้งหมด — อ้างอิงจาก amountPaid ของสลิปจริง
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  let collectedThisMonth = 0
  let collectedCount = 0
  Object.entries(paymentRecords).forEach(([cid, records]) => {
    Object.values(records || {}).forEach(rec => {
      if (rec?.amountPaid > 0) {
        collectedThisMonth += rec.amountPaid
        collectedCount++
      }
    })
  })

  // ค้างชำระ — เทียบกับ "วันครบกำหนดเดิม" (ก่อนถูกเลื่อน) ไม่ใช่วันที่เลื่อนใหม่
  // เพราะยอดยังคงค้างอยู่จริงจนกว่าจะมีการชำระ ต่อให้เลื่อนกำหนดใหม่ไปแล้วก็ตาม
  // งวดที่ครบกำหนด "วันนี้พอดี" และยังไม่เคยถูกเลื่อน — ยังไม่นับค้าง (ให้เวลาถึงสิ้นวัน)
  // แต่ถ้าเคยถูกเลื่อนมาแล้ว (แม้จะเลื่อนตั้งแต่วันครบกำหนดเดิมพอดี) ถือว่ายอมรับแล้วว่าไม่จ่ายตรงกำหนด นับค้างทันที
  const overduePayments = []
  active.forEach(c => {
    c.payments?.forEach(p => {
      if (paymentRecords[c.id]?.[p.installment]) return
      const originalDueStr = p.postponedFrom || p.dateStr
      const originalDiff = originalDueStr ? getDiff(originalDueStr, today) : null
      if (originalDiff === null) return
      const isOverdue = p.postponedFrom ? originalDiff <= 0 : originalDiff < 0
      if (isOverdue) {
        overduePayments.push({ c, p, originalDueStr, originalDiff })
      }
    })
  })
  const overdueAmount = overduePayments.reduce((s, { c }) => s + (c.amount || 0), 0)

  // Yield
  const yieldRate = totalPrincipal > 0 ? ((monthlyIncome * 12) / totalPrincipal * 100).toFixed(1) : 0

  // ค่านายหน้า Advance 2% (จ่ายล่วงหน้าเข้าบริษัท) — เฉพาะเคสประเภท commission เท่านั้น
  const commissionCases = active.filter(c => (c.incomeType || 'commission') === 'commission')
  const interestCases = active.filter(c => c.incomeType === 'interest')
  const totalAdvance = commissionCases.reduce((s, c) => s + (c.principal || 0) * 0.02, 0)
  const closedCommissionCases = customers.filter(c => c.isClosed && !c.isVoided && (c.incomeType || 'commission') === 'commission')
  const closedAdvance = closedCommissionCases.reduce((s, c) => s + (c.principal || 0) * 0.02, 0)
  const stackedAdvance = totalAdvance + closedAdvance

  // ── กราฟรายได้ 6 เดือนย้อนหลัง ──────────────────────────
  const monthlyChart = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      let total = 0
      Object.entries(paymentRecords).forEach(([cid, records]) => {
        Object.values(records || {}).forEach(rec => {
          const paidStr = rec?.paidAt || rec?.paidDate || ''
          if (paidStr.startsWith(key)) {
            const cust = customers.find(c => String(c.id) === String(cid))
            total += rec?.amountPaid || cust?.amount || 0
          }
        })
      })
      months.push({ label: thMonth[d.getMonth()], value: total })
    }
    return months
  }, [paymentRecords, customers])

  // ── จำนอง vs ขายฝาก ─────────────────────────────────────
  const mortgage = active.filter(c => c.type === 'จำนอง')
  const sellback = active.filter(c => c.type === 'ขายฝาก')
  const donutData = [
    { label: 'ขายฝาก', value: sellback.length, amount: sellback.reduce((s, c) => s + (c.principal || 0), 0), color: BRAND.orange },
    { label: 'จำนอง', value: mortgage.length, amount: mortgage.reduce((s, c) => s + (c.principal || 0), 0), color: BRAND.teal },
  ]

  // ── สัญญาที่ต้องระวัง ────────────────────────────────────
  const riskContracts = active.filter(c => {
    if (!c.contractEndDate) return false
    const end = new Date(c.contractEndDate)
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
    return diffDays >= 0 && diffDays <= 90
  }).map(c => {
    const end = new Date(c.contractEndDate)
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
    return { ...c, diffDays }
  }).sort((a, b) => a.diffDays - b.diffDays)

  // ── ทรัพย์เสี่ยงหลุด / Pre-Marketing ─────────────────────
  const liquidationRiskProfiles = active.map(c => {
    if (c.type !== 'ขายฝาก') return null

    const payments = c.payments || []
    const overdue = payments.filter(p => {
      if (getCustomerPaymentRecord(paymentRecords, c.id, p.installment)) return false
      const dueStr = p.postponedFrom || p.dateStr
      const diff = dueStr ? getDiff(dueStr, today) : null
      if (diff === null) return false
      return p.postponedFrom ? diff <= 0 : diff < 0
    })
    const postponed = payments.filter(p => p.postponedFrom)
    const end = c.contractEndDate ? new Date(c.contractEndDate) : null
    const diffDays = end ? Math.ceil((end - today) / dayMs) : null
    const maxOverdueDays = overdue.reduce((max, p) => {
      const dueStr = p.postponedFrom || p.dateStr
      const diff = dueStr ? getDiff(dueStr, today) : 0
      return Math.max(max, Math.abs(Math.min(diff || 0, 0)))
    }, 0)

    const name = `${c.name || ''} ${c.fullLabel || ''}`
    const manualHighRisk = name.includes('ชลากร')
    const manualWatch = name.includes('สริตา')
    const inPreMarketingWindow = diffDays !== null && diffDays >= 0 && diffDays <= 60
    const inPreparationWindow = diffDays !== null && diffDays >= 0 && diffDays <= 180

    let level = ''
    let label = ''
    let color = BRAND.textSec
    let action = ''

    if (manualHighRisk || overdue.length >= 2 || maxOverdueDays >= 14) {
      level = 'critical'
      label = 'เสี่ยงสูงมาก'
      color = BRAND.danger
      action = 'เร่งรวมเอกสารและเตรียม Notice'
    } else if (manualWatch || postponed.length >= 2 || overdue.length >= 1 || inPreMarketingWindow) {
      level = 'watch'
      label = 'เฝ้าระวัง'
      color = BRAND.gold
      action = inPreMarketingWindow ? 'เริ่ม Pre-Marketing' : 'ยืนยันแผนชำระและเตรียมแฟ้มทรัพย์'
    } else if (inPreparationWindow) {
      level = 'prepare'
      label = 'เตรียมพร้อม'
      color = BRAND.teal
      action = 'สำรวจข้อมูลทรัพย์ล่วงหน้า'
    } else {
      return null
    }

    return {
      ...c,
      level,
      label,
      color,
      action,
      diffDays,
      overdueCount: overdue.length,
      postponedCount: postponed.length,
      maxOverdueDays,
      placeLabel: getPlaceLabel(c),
    }
  }).filter(Boolean).sort((a, b) => {
    const rank = { critical: 0, watch: 1, prepare: 2 }
    return (rank[a.level] - rank[b.level]) || ((a.diffDays ?? 9999) - (b.diffDays ?? 9999))
  })

  const highLiquidationRiskCount = liquidationRiskProfiles.filter(c => c.level === 'critical').length
  const watchLiquidationRiskCount = liquidationRiskProfiles.filter(c => c.level === 'watch').length
  const preMarketingCount = liquidationRiskProfiles.filter(c => c.diffDays !== null && c.diffDays >= 0 && c.diffDays <= 60 && (c.overdueCount > 0 || c.postponedCount > 0)).length

  // ── FSV vs วงเงิน (ความเสี่ยง) ──────────────────────────
  const collectionRate = monthlyIncome > 0 ? Math.round((collectedThisMonth / monthlyIncome) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 0 32px' }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: BRAND.textPri }}>📊 Dashboard ภาพรวมธุรกิจ</div>
        <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 2 }}>
          ข้อมูล ณ {today.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiCard icon="💰" label="วงเงินรวมที่ปล่อย" value={`฿${fmt(totalPrincipal)}`} sub={`${active.length} สัญญา active`} color={BRAND.teal} />
        <KpiCard icon="📈" label="รายได้ดอกเบี้ย/เดือน" value={`฿${fmtFull(Math.round(monthlyIncome))}`} sub={`Yield ${yieldRate}%/ปี`} color={BRAND.gold} />
        <KpiCard icon="✅" label="ดอกเบี้ยที่ชำระแล้ว" value={`฿${fmtFull(collectedThisMonth)}`} sub={`${collectedCount} งวด · อ้างอิงจากสลิปโอนเงิน`} color={BRAND.success} />
        <KpiCard icon="⚠️" label="ค้างชำระ" value={`฿${fmtFull(overdueAmount)}`} sub={overduePayments.length > 0 ? `${overduePayments.length} งวด · ${overduePayments.map(x => x.c.name).filter((v,i,a)=>a.indexOf(v)===i).length} ราย` : 'ไม่มีค้างชำระ'} color={overduePayments.length > 0 ? BRAND.danger : BRAND.success} />
        <KpiCard icon="🏦" label="Advance 2%" value={`฿${fmtFull(Math.round(stackedAdvance))}`} sub={`${commissionCases.length} active + ${closedCommissionCases.length} ปิดแล้ว · 2% ของวงเงินรวม`} color={BRAND.purple} />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Bar Chart */}
        <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.textPri, marginBottom: 16 }}>📅 รายได้ที่เก็บได้ 6 เดือนล่าสุด</div>
          <BarChart data={monthlyChart} color={BRAND.teal} />
          <div style={{ marginTop: 12, fontSize: 11, color: BRAND.textSec }}>
            เป้าต่อเดือน: <span style={{ color: BRAND.gold, fontWeight: 700 }}>฿{fmtFull(monthlyIncome)}</span>
          </div>
        </div>

        {/* Donut Chart */}
        <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.textPri, marginBottom: 16 }}>🏦 จำนอง vs ขายฝาก</div>
          <DonutChart segments={donutData} />
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${BRAND.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ fontSize: 11, color: BRAND.textSec }}>
                วงเงินขายฝาก<br />
                <span style={{ fontSize: 14, fontWeight: 700, color: BRAND.orange }}>฿{fmt(donutData[0].amount)}</span>
              </div>
              <div style={{ fontSize: 11, color: BRAND.textSec }}>
                วงเงินจำนอง<br />
                <span style={{ fontSize: 14, fontWeight: 700, color: BRAND.teal }}>฿{fmt(donutData[1].amount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Liquidation Risk / Pre-Marketing */}
      <div style={{ background: BRAND.bgCard, border: `1px solid rgba(239,68,68,0.35)`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: expandedSections.liquidation ? 16 : 0, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.textPri, marginBottom: 4 }}>🚩 ทรัพย์เสี่ยงหลุด / Pre-Marketing</div>
            <div style={{ fontSize: 11, color: BRAND.textSec }}>
              คัดกรองเคสขายฝากที่เริ่มค้าง เลื่อนชำระ หรือเข้าใกล้ช่วงเตรียมการตลาดล่วงหน้า
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(86px, 1fr))', gap: 8, minWidth: 280 }}>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.32)' }}>
                <div style={{ fontSize: 10, color: BRAND.textSec }}>เสี่ยงสูงมาก</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: BRAND.danger }}>{highLiquidationRiskCount}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.32)' }}>
                <div style={{ fontSize: 10, color: BRAND.textSec }}>เฝ้าระวัง</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: BRAND.gold }}>{watchLiquidationRiskCount}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(45,212,191,.10)', border: '1px solid rgba(45,212,191,.30)' }}>
                <div style={{ fontSize: 10, color: BRAND.textSec }}>Pre-Marketing</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: BRAND.teal }}>{preMarketingCount}</div>
              </div>
            </div>
            <SectionToggle open={expandedSections.liquidation} onClick={() => toggleSection('liquidation')} />
          </div>
        </div>

        {expandedSections.liquidation && (liquidationRiskProfiles.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {liquidationRiskProfiles.map(c => (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '12px 14px', borderRadius: 10, background: BRAND.bg, border: `1px solid ${c.color}55` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.textPri }}>{c.name}</span>
                      <span style={{ fontSize: 10, color: c.color, padding: '2px 7px', borderRadius: 999, border: `1px solid ${c.color}66`, background: `${c.color}18` }}>{c.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: BRAND.textSec }}>
                      {c.placeLabel} · วงเงิน ฿{fmtFull(c.principal)} · ค้าง {c.overdueCount} งวด · เลื่อน {c.postponedCount} งวด
                    </div>
                    <div style={{ fontSize: 11, color: BRAND.textMut, marginTop: 4 }}>
                      กรอบขายด่วน: ประเมินจากราคาตลาดแล้วลด 15-30% หลังสำรวจทรัพย์จริง
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 116 }}>
                    <div style={{ fontSize: 10, color: BRAND.textSec }}>ครบกำหนดไถ่ถอน</div>
                    <div style={{ fontSize: 12, color: BRAND.textPri }}>{c.contractEndDate ? new Date(c.contractEndDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}</div>
                    <div style={{ fontSize: 11, color: c.color, marginTop: 4 }}>{c.diffDays === null ? 'รอตรวจวันครบกำหนด' : `อีก ${Math.max(c.diffDays, 0)} วัน`}</div>
                    <div style={{ marginTop: 8, padding: '4px 8px', borderRadius: 8, background: `${c.color}18`, border: `1px solid ${c.color}44`, fontSize: 10, fontWeight: 700, color: c.color }}>
                      {c.action}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: 14, borderRadius: 10, background: 'rgba(15,23,42,.45)', border: `1px solid ${BRAND.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.textPri, marginBottom: 10 }}>Checklist เตรียมระบายทรัพย์</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {riskWorkItems.map((item, i) => (
                  <div key={item} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, alignItems: 'start' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(45,212,191,.12)', border: '1px solid rgba(45,212,191,.35)', color: BRAND.teal, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{i + 1}</div>
                    <div style={{ fontSize: 11, color: BRAND.textSec, lineHeight: 1.45 }}>{item}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${BRAND.border}`, fontSize: 10, color: BRAND.textMut, lineHeight: 1.45 }}>
                หมายเหตุ: ก่อนส่งหนังสือหรือดำเนินการกระทบสิทธิ ให้ตรวจสัญญาและเอกสารจริงกับฝ่ายกฎหมายก่อนทุกครั้ง
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '18px 0', textAlign: 'center', color: BRAND.textMut, fontSize: 12 }}>
            ยังไม่พบเคสขายฝากที่เข้าเงื่อนไขเตรียม Pre-Marketing
          </div>
        ))}
      </div>

      {/* Risk Table */}
      <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.textPri, marginBottom: 4 }}>🚨 สัญญาที่ต้องระวัง (ครบกำหนดใน 90 วัน)</div>
            <div style={{ fontSize: 11, color: BRAND.textSec }}>{riskContracts.length > 0 ? `${riskContracts.length} รายการ` : 'ไม่มีสัญญาใกล้ครบกำหนด ✅'}</div>
          </div>
          <SectionToggle open={expandedSections.riskContracts} onClick={() => toggleSection('riskContracts')} />
        </div>
        {expandedSections.riskContracts && riskContracts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {riskContracts.map(c => {
              const urgColor = c.diffDays <= 30 ? BRAND.danger : c.diffDays <= 60 ? BRAND.gold : BRAND.textSec
              return (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: BRAND.bg, border: `1px solid ${urgColor}33` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.textPri }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: BRAND.textSec }}>{c.type} · {c.fullLabel?.split('(')[1]?.replace(')', '') || ''}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: BRAND.textSec }}>วงเงิน</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.teal }}>฿{fmt(c.principal)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: BRAND.textSec }}>ครบกำหนด</div>
                    <div style={{ fontSize: 12, color: BRAND.textPri }}>{new Date(c.contractEndDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</div>
                  </div>
                  <div style={{ padding: '4px 10px', borderRadius: 8, background: urgColor + '22', border: `1px solid ${urgColor}55`, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: urgColor }}>{c.diffDays}</div>
                    <div style={{ fontSize: 9, color: urgColor }}>วัน</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Advance 2% Breakdown */}
      <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.purple}44`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: expandedSections.advance ? 16 : 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.textPri, marginBottom: 4 }}>🏦 Advance 2% รายเคส</div>
            <div style={{ fontSize: 11, color: BRAND.textSec }}>
              รวม ฿{fmtFull(Math.round(stackedAdvance))} · active {commissionCases.length + interestCases.length} ราย · ปิดแล้ว {closedCommissionCases.length} ราย
            </div>
          </div>
          <SectionToggle open={expandedSections.advance} onClick={() => toggleSection('advance')} />
        </div>

        {expandedSections.advance && (
        <>
        {commissionCases.length > 0 && (
          <div style={{ marginBottom: interestCases.length > 0 ? 16 : 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.purple, marginBottom: 8 }}>รับค่าคอมมิชชั่น (มี Advance 2%)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {commissionCases.map(c => (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: BRAND.bg, border: `1px solid ${BRAND.border}` }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textPri }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: BRAND.textSec }}>{c.type} · วงเงิน ฿{fmtFull(c.principal)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: BRAND.textSec }}>Advance 2%</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.purple }}>฿{fmtFull(Math.round((c.principal || 0) * 0.02))}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: `${BRAND.purple}18`, border: `1px solid ${BRAND.purple}44`, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: BRAND.textSec }}>รวม Advance ทั้งหมด</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: BRAND.purple }}>฿{fmtFull(Math.round(totalAdvance))}</span>
            </div>
          </div>
        )}

        {interestCases.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.gold, marginBottom: 8 }}>รับดอกเบี้ยแทน (ไม่มี Advance)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {interestCases.map(c => (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: BRAND.bg, border: `1px solid ${BRAND.border}` }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textPri }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: BRAND.textSec }}>{c.type} · วงเงิน ฿{fmtFull(c.principal)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: BRAND.gold }}>ดอกเบี้ย/งวด</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold }}>฿{fmtFull(c.amount)}</div>
                  </div>
                  <div style={{ padding: '3px 8px', borderRadius: 6, background: `${BRAND.gold}22`, border: `1px solid ${BRAND.gold}55` }}>
                    <div style={{ fontSize: 10, color: BRAND.gold, whiteSpace: 'nowrap' }}>รับดอกเบี้ย</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {closedCommissionCases.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px dashed ${BRAND.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.textMut, marginBottom: 8 }}>ปิดสัญญาแล้ว (เก็บไว้ตรวจย้อนหลัง)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {closedCommissionCases.map(c => (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'rgba(15,23,42,.45)', border: `1px solid ${BRAND.border}`, opacity: .72 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textSec, textDecoration: 'line-through' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: BRAND.textMut }}>{c.type} · วงเงิน ฿{fmtFull(c.principal)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: BRAND.textMut }}>Advance 2%</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.textSec }}>฿{fmtFull(Math.round((c.principal || 0) * 0.02))}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(148,163,184,.12)', border: `1px solid ${BRAND.border}`, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: BRAND.textSec }}>รวม Advance เคสปิดแล้ว</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: BRAND.textSec }}>฿{fmtFull(Math.round(closedAdvance))}</span>
            </div>
          </div>
        )}

        {commissionCases.length === 0 && interestCases.length === 0 && closedCommissionCases.length === 0 && (
          <div style={{ fontSize: 12, color: BRAND.textMut, textAlign: 'center', padding: '12px 0' }}>ไม่มีข้อมูล Advance 2%</div>
        )}
        </>
        )}
      </div>

      {/* Overdue */}
      {overduePayments.length > 0 && (
        <div style={{ background: BRAND.bgCard, border: `1px solid rgba(239,68,68,0.4)`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: expandedSections.overdue ? 16 : 0 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.danger, marginBottom: 4 }}>🔴 งวดที่ค้างชำระ</div>
              <div style={{ fontSize: 11, color: BRAND.textSec }}>
                {overduePayments.length} งวด · {overduePayments.map(x => x.c.name).filter((v,i,a)=>a.indexOf(v)===i).length} ราย · รวม ฿{fmtFull(overdueAmount)}
              </div>
            </div>
            <SectionToggle open={expandedSections.overdue} onClick={() => toggleSection('overdue')} />
          </div>
          {expandedSections.overdue && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {overduePayments.slice(0, 10).map(({ c, p, originalDueStr, originalDiff }, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: BRAND.bg }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textPri }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: BRAND.textSec }}>
                    งวดที่ {p.installment} · ครบกำหนดเดิม {new Date(originalDueStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                    {p.postponedFrom && ` · เลื่อนเป็น ${new Date(p.dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`}
                  </div>
                  {p.postponedFrom && p.postponeNote && (
                    <div style={{ fontSize: 11, color: BRAND.gold, marginTop: 3 }}>💬 {p.postponeNote}</div>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.danger }}>฿{fmtFull(c.amount)}</div>
                <div style={{ fontSize: 11, color: BRAND.danger }}>{originalDiff === 0 ? 'ครบกำหนดวันนี้' : `เกิน ${Math.abs(originalDiff)} วัน`}</div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

    </div>
  )
}

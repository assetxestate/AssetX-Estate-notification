import React, { useMemo } from 'react'

const BRAND = {
  teal: '#2DD4BF', gold: '#F59E0B', bg: '#050B18', bgCard: '#080F1E',
  border: '#0F2545', textPri: '#F0F6FF', textSec: '#64748B', textMut: '#334155',
  orange: '#F97316', success: '#10B981', danger: '#EF4444', purple: '#7C3AED',
}

const fmt = (n) => {
  if (!n || isNaN(n)) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K'
  return Number(n).toLocaleString()
}
const fmtFull = (n) => Number(n || 0).toLocaleString('th-TH')
const thMonth = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

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

// ── Main Dashboard ───────────────────────────────────────
export default function DashboardPage({ customers = [], paymentRecords = {} }) {
  const today = new Date()
  const active = customers.filter(c => !c.isClosed && !c.isVoided)

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

  // เก็บได้เดือนนี้จาก paymentRecords
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  let collectedThisMonth = 0
  let collectedCount = 0
  Object.entries(paymentRecords).forEach(([cid, records]) => {
    Object.values(records || {}).forEach(rec => {
      if (rec?.paidDate?.startsWith(thisMonth)) {
        const cust = customers.find(c => String(c.id) === String(cid))
        collectedThisMonth += cust?.amount || rec?.amount || 0
        collectedCount++
      }
    })
  })

  // ค้างชำระ
  const overduePayments = []
  active.forEach(c => {
    c.payments?.forEach(p => {
      if (p.status === 'overdue' && !paymentRecords[c.id]?.[p.installment]) {
        overduePayments.push({ c, p })
      }
    })
  })

  // Yield
  const yieldRate = totalPrincipal > 0 ? ((monthlyIncome * 12) / totalPrincipal * 100).toFixed(1) : 0

  // ── กราฟรายได้ 6 เดือนย้อนหลัง ──────────────────────────
  const monthlyChart = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      let total = 0
      Object.entries(paymentRecords).forEach(([cid, records]) => {
        Object.values(records || {}).forEach(rec => {
          if (rec?.paidDate?.startsWith(key)) {
            const cust = customers.find(c => String(c.id) === String(cid))
            total += cust?.amount || 0
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
        <KpiCard icon="✅" label="เก็บได้เดือนนี้" value={`฿${fmtFull(collectedThisMonth)}`} sub={`${collectedCount} งวด · ${collectionRate}% ของเป้า`} color={BRAND.success} />
        <KpiCard icon="⚠️" label="ค้างชำระ" value={overduePayments.length} sub={overduePayments.length > 0 ? `${overduePayments.map(x => x.c.name).filter((v,i,a)=>a.indexOf(v)===i).length} ราย` : 'ไม่มีค้างชำระ'} color={overduePayments.length > 0 ? BRAND.danger : BRAND.success} />
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

      {/* Risk Table */}
      <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.textPri, marginBottom: 4 }}>🚨 สัญญาที่ต้องระวัง (ครบกำหนดใน 90 วัน)</div>
        <div style={{ fontSize: 11, color: BRAND.textSec, marginBottom: 16 }}>{riskContracts.length > 0 ? `${riskContracts.length} รายการ` : 'ไม่มีสัญญาใกล้ครบกำหนด ✅'}</div>
        {riskContracts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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

      {/* Overdue */}
      {overduePayments.length > 0 && (
        <div style={{ background: BRAND.bgCard, border: `1px solid rgba(239,68,68,0.4)`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.danger, marginBottom: 16 }}>🔴 งวดที่ค้างชำระ ({overduePayments.length} งวด)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {overduePayments.slice(0, 10).map(({ c, p }, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: BRAND.bg }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textPri }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: BRAND.textSec }}>งวดที่ {p.installment} · {new Date(p.dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.danger }}>฿{fmtFull(c.amount)}</div>
                <div style={{ fontSize: 11, color: BRAND.danger }}>เกิน {Math.abs(p.diff)} วัน</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

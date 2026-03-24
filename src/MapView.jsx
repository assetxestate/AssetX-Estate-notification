import React, { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const BRAND = {
  teal: '#2DD4BF', gold: '#F59E0B', bg: '#050B18', bgCard: '#0D1B2E',
  border: '#0F2545', textPri: '#F0F6FF', textSec: '#64748B', textMut: '#475569', success: '#10B981',
}

const fmt = (n) => Math.round(n || 0).toLocaleString('th-TH')

function fixLeafletIcons() {
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

// หมุดลูกค้า — วงกลมสีตามประเภท
function makeCustomerIcon(color, icon) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:36px;height:36px;border-radius:50%;
      background:${color};border:3px solid #fff;
      display:flex;align-items:center;justify-content:center;
      font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.5);
    ">${icon}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22],
  })
}

// หมุดประเมิน — หยดน้ำ
function makeValuationIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50% 50% 50% 0;
      background:${color};border:3px solid #fff;
      transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -32],
  })
}

const TYPE_COLOR = {
  'ขายฝาก': '#F59E0B',
  'จำนอง': '#60A5FA',
  'ซื้อขาย': '#A78BFA',
  'ประเมินเพื่อสินเชื่อ': '#10B981',
  'ประเมินมูลค่าทรัพย์สิน': '#34D399',
  'อื่นๆ': '#64748B',
}

function formatThaiDate(dateStr) {
  if (!dateStr) return '—'
  const MONTHS = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return `${d.getDate()} ${MONTHS[d.getMonth() + 1]} ${d.getFullYear() + 543}`
}

export default function MapView({ appsScriptUrl, customers = [] }) {
  const [valuations, setValuations] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterMode, setFilterMode] = useState('ทั้งหมด')
  const [filterType, setFilterType] = useState('ทั้งหมด')
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])

  // โหลดข้อมูลการประเมิน
  const loadValuations = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    fetch(`${appsScriptUrl}?action=getValuations`)
      .then(r => r.json())
      .then(r => { setValuations(r.data || []); setLoading(false); setRefreshing(false) })
      .catch(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { loadValuations() }, [appsScriptUrl])

  // สร้างแผนที่
  useEffect(() => {
    if (loading || mapInstanceRef.current) return
    fixLeafletIcons()

    const map = L.map(mapRef.current, {
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      zoomControl: true,
    }).setView([13.0, 101.5], 6)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    mapInstanceRef.current = map
    setMapReady(true)
    setTimeout(() => map.invalidateSize(), 150)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markersRef.current = []
      setMapReady(false)
    }
  }, [loading])

  // วาง markers ทุกครั้งที่ filter หรือข้อมูลเปลี่ยน
  useEffect(() => {
    if (!mapInstanceRef.current) return
    const map = mapInstanceRef.current

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    // ── หมุดลูกค้า ──────────────────────────────────────
    if (filterMode !== 'ประเมิน') {
      customers.forEach(c => {
        if (!c.location) return
        const parts = String(c.location).split(',')
        const lat = parseFloat(parts[0])
        const lng = parseFloat(parts[1])
        if (isNaN(lat) || isNaN(lng)) return
        if (filterType !== 'ทั้งหมด' && c.type !== filterType) return

        const nextPayment = (c.payments || []).find(p => p.status !== 'paid')
        const contractColor = c.contractDiff !== null
          ? (c.contractDiff <= 30 ? '#EF4444' : c.contractDiff <= 90 ? '#F59E0B' : BRAND.success)
          : BRAND.textSec

        const marker = L.marker([lat, lng], { icon: makeCustomerIcon(c.color || '#60A5FA', c.icon || '👤') }).addTo(map)
        marker.bindPopup(`
          <div style="font-family:'Sarabun',sans-serif;min-width:220px;padding:4px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:20px">${c.icon || '👤'}</span>
              <div>
                <div style="font-weight:700;font-size:14px;color:#111">คุณ${c.name}</div>
                <span style="background:${c.color || '#60A5FA'}22;border:1px solid ${c.color || '#60A5FA'}66;border-radius:12px;padding:2px 8px;font-size:11px;color:${c.color || '#60A5FA'};font-weight:600">${c.type}</span>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
              <div style="background:#f5f5f5;border-radius:6px;padding:6px;text-align:center">
                <div style="font-size:9px;color:#888">เงินต้น</div>
                <div style="font-size:12px;font-weight:700;color:#1a3a5c">฿${fmt(c.principal)}</div>
              </div>
              <div style="background:#f5f5f5;border-radius:6px;padding:6px;text-align:center">
                <div style="font-size:9px;color:#888">ดอกเบี้ย/งวด</div>
                <div style="font-size:12px;font-weight:700;color:#F59E0B">฿${fmt(c.amount)}</div>
              </div>
            </div>
            <div style="font-size:11px;color:#555;margin-bottom:4px">
              📅 ครบสัญญา: <span style="color:${contractColor};font-weight:600">${formatThaiDate(c.contractEndDate)}</span>
              ${c.contractDiff !== null ? `<span style="color:${contractColor}"> (${c.contractDiff >= 0 ? 'อีก ' + c.contractDiff + ' วัน' : 'เกินกำหนด'})</span>` : ''}
            </div>
            ${nextPayment ? `<div style="font-size:11px;color:#555">💳 งวดถัดไป: งวด ${nextPayment.installment} — ${formatThaiDate(nextPayment.dateStr)}</div>` : ''}
            <div style="font-size:10px;color:#aaa;margin-top:6px">📌 ${c.fullLabel}</div>
          </div>
        `, { maxWidth: 260 })

        markersRef.current.push(marker)
      })
    }

    // ── หมุดการประเมิน ───────────────────────────────────
    if (filterMode !== 'ลูกค้า') {
      valuations.forEach(row => {
        const lat = parseFloat(row['lat'])
        const lng = parseFloat(row['lng'])
        if (isNaN(lat) || isNaN(lng)) return
        if (filterType !== 'ทั้งหมด' && row['ประเภทการประเมิน'] !== filterType) return

        const color = TYPE_COLOR[row['ประเภทการประเมิน']] || '#64748B'
        const score = row['Property Score'] || 0
        const scoreColor = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444'

        const marker = L.marker([lat, lng], { icon: makeValuationIcon(color) }).addTo(map)
        marker.bindPopup(`
          <div style="font-family:'Sarabun',sans-serif;min-width:210px;padding:4px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
              <div style="font-weight:700;font-size:13px;color:#111">${row['รหัส/ชื่อทรัพย์'] || '—'}</div>
            </div>
            <div style="font-size:10px;color:#777;margin-bottom:8px">${row['ประเภทการประเมิน']} • ${row['ประเภทย่อย'] || ''} • 📍${row['จังหวัด'] || ''}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:8px">
              <div style="background:#f5f5f5;border-radius:6px;padding:5px;text-align:center">
                <div style="font-size:9px;color:#888">มูลค่าตลาด</div>
                <div style="font-size:11px;font-weight:700;color:#2DD4BF">฿${fmt(row['มูลค่าตลาดรวม'])}</div>
              </div>
              <div style="background:#f5f5f5;border-radius:6px;padding:5px;text-align:center">
                <div style="font-size:9px;color:#888">วงเงินแนะนำ</div>
                <div style="font-size:11px;font-weight:700;color:#F59E0B">฿${fmt(row['วงเงินแนะนำ'])}</div>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:10px;color:#888">Property Score</span>
              <span style="font-size:13px;font-weight:700;color:${scoreColor}">${score}/100</span>
            </div>
            ${row['วันที่บันทึก'] ? `<div style="font-size:9px;color:#bbb;margin-top:4px">บันทึก: ${row['วันที่บันทึก']}</div>` : ''}
          </div>
        `, { maxWidth: 250 })

        markersRef.current.push(marker)
      })
    }
  }, [customers, valuations, filterMode, filterType, mapReady])

  // ── stats ────────────────────────────────────────────────
  const custWithLoc = customers.filter(c => {
    if (!c.location) return false
    const p = String(c.location).split(',')
    return !isNaN(parseFloat(p[0])) && !isNaN(parseFloat(p[1]))
  }).length
  const valWithLoc = valuations.filter(r => !isNaN(parseFloat(r['lat'])) && !isNaN(parseFloat(r['lng']))).length
  const valTotal = valuations.length
  const valsNoLoc = valuations.filter(r => isNaN(parseFloat(r['lat'])) || isNaN(parseFloat(r['lng'])))
  const mapHeight = typeof window !== 'undefined' && window.innerWidth < 640 ? 380 : 540

  const TYPES = ['ทั้งหมด', 'จำนอง', 'ขายฝาก', 'ซื้อขาย', 'ประเมินเพื่อสินเชื่อ', 'ประเมินมูลค่าทรัพย์สิน']

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: BRAND.textSec }}>
      ⏳ กำลังโหลดข้อมูล...
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`
        .map-gesture-hint { display: none; }
        @media (max-width: 640px) { .map-gesture-hint { display: flex !important; } }
        .leaflet-container { font-family: 'Sarabun', sans-serif; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: BRAND.textPri }}>🗺️ แผนที่ทรัพย์สิน</div>
          <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 2 }}>ตำแหน่งลูกค้าและทรัพย์สินในระบบ</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Stats */}
          {[
            { label: 'ลูกค้า', value: custWithLoc, color: BRAND.teal, icon: '👤' },
            { label: `ประเมิน (${valWithLoc}/${valTotal})`, value: valWithLoc, color: BRAND.gold, icon: '📍' },
            { label: 'รวมบนแผนที่', value: custWithLoc + valWithLoc, color: '#A78BFA', icon: '🗺️' },
          ].map(s => (
            <div key={s.label} style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 10, padding: '7px 12px', textAlign: 'center', minWidth: 64 }}>
              <div style={{ fontSize: 10, color: BRAND.textMut }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
          {/* Refresh */}
          <button onClick={() => loadValuations(true)} disabled={refreshing} style={{
            background: 'transparent', border: `1px solid ${BRAND.border}`, borderRadius: 8,
            color: refreshing ? BRAND.textMut : BRAND.teal, cursor: refreshing ? 'default' : 'pointer',
            padding: '6px 12px', fontSize: 12, fontWeight: 600,
          }}>
            {refreshing ? '⏳' : '🔄'} {refreshing ? 'กำลังโหลด...' : 'รีเฟรช'}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: BRAND.textSec }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#60A5FA', border: '2px solid #fff' }} />
          หมุดลูกค้า (วงกลม)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: BRAND.textSec }}>
          <div style={{ width: 12, height: 12, borderRadius: '50% 50% 50% 0', background: BRAND.gold, transform: 'rotate(-45deg)', border: '2px solid #fff' }} />
          <span style={{ marginLeft: 4 }}>หมุดประเมิน (หยดน้ำ)</span>
        </div>
        {Object.entries(TYPE_COLOR).slice(0, 3).map(([t, c]) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: BRAND.textSec }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{t}
          </div>
        ))}
      </div>

      {/* Filter Mode */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: BRAND.textMut, marginRight: 4 }}>แสดง:</span>
        {['ทั้งหมด', 'ลูกค้า', 'ประเมิน'].map(m => (
          <button key={m} onClick={() => setFilterMode(m)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontWeight: filterMode === m ? 700 : 400,
            border: `1px solid ${filterMode === m ? BRAND.teal : BRAND.border}`,
            background: filterMode === m ? 'rgba(45,212,191,0.12)' : 'transparent',
            color: filterMode === m ? BRAND.teal : BRAND.textSec,
          }}>{m}</button>
        ))}
        <div style={{ width: 1, height: 16, background: BRAND.border, margin: '0 4px' }} />
        <span style={{ fontSize: 11, color: BRAND.textMut }}>ประเภท:</span>
        {TYPES.map(t => (
          <button key={t} onClick={() => setFilterType(t)} style={{
            padding: '4px 10px', borderRadius: 20, fontSize: 10, cursor: 'pointer', fontWeight: filterType === t ? 700 : 400,
            border: `1px solid ${filterType === t ? (TYPE_COLOR[t] || BRAND.gold) : BRAND.border}`,
            background: filterType === t ? `${TYPE_COLOR[t] || BRAND.gold}20` : 'transparent',
            color: filterType === t ? (TYPE_COLOR[t] || BRAND.gold) : BRAND.textSec,
          }}>{t}</button>
        ))}
      </div>

      {/* แผนที่ */}
      <div style={{ position: 'relative', borderRadius: 14, border: `1px solid ${BRAND.border}` }}>
        <div ref={mapRef} style={{ width: '100%', height: mapHeight, borderRadius: 14 }} />
        <div className="map-gesture-hint" style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(5,11,24,0.75)', borderRadius: 20, padding: '5px 12px',
          fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 500,
        }}>
          👆 ใช้ 2 นิ้วเพื่อเลื่อนหน้า / 1 นิ้วเพื่อขยับแผนที่
        </div>
        {(custWithLoc + valWithLoc) === 0 && !loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'rgba(5,11,24,0.72)', borderRadius: 14, pointerEvents: 'none', zIndex: 400,
          }}>
            <div style={{ fontSize: 32 }}>📍</div>
            <div style={{ color: BRAND.textPri, fontWeight: 700 }}>ยังไม่มีข้อมูลพิกัด</div>
          </div>
        )}
      </div>

      {/* ลูกค้าที่ไม่มีพิกัด */}
      {customers.filter(c => !c.location).length > 0 && (
        <div style={{ background: BRAND.bgCard, border: `1px solid rgba(245,158,11,0.25)`, borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: BRAND.gold, fontWeight: 700, marginBottom: 6 }}>
            ⚠️ ลูกค้า {customers.filter(c => !c.location).length} ราย ยังไม่มีพิกัดใน Sheet DATA (ช่อง location)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {customers.filter(c => !c.location).map(c => (
              <span key={c.id} style={{ background: BRAND.bg, border: `1px solid ${BRAND.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, color: BRAND.textSec }}>
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* รายชื่อการประเมินทั้งหมด */}
      {valTotal > 0 && (
        <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, color: BRAND.textPri, fontWeight: 700, marginBottom: 10 }}>
            📋 รายการประเมินทั้งหมด ({valTotal} รายการ — {valWithLoc} มีพิกัดบนแผนที่)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
            {valuations.map((r, i) => {
              const hasLoc = !isNaN(parseFloat(r['lat'])) && !isNaN(parseFloat(r['lng']))
              const color = TYPE_COLOR[r['ประเภทการประเมิน']] || '#64748B'
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: BRAND.bg, borderRadius: 7, padding: '7px 10px',
                  border: `1px solid ${hasLoc ? 'rgba(45,212,191,0.2)' : BRAND.border}`,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r['รหัส/ชื่อทรัพย์'] || '—'}
                    </div>
                    <div style={{ fontSize: 10, color: BRAND.textSec }}>
                      {r['ประเภทการประเมิน']} • {r['จังหวัด'] || '—'} • {r['วันที่บันทึก'] ? String(r['วันที่บันทึก']).slice(0, 10) : '—'}
                    </div>
                  </div>
                  {hasLoc
                    ? <span style={{ fontSize: 10, color: BRAND.teal, background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 10, padding: '2px 7px', whiteSpace: 'nowrap' }}>📍 มีพิกัด</span>
                    : <span style={{ fontSize: 10, color: BRAND.gold, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '2px 7px', whiteSpace: 'nowrap' }}>⚠️ ไม่มีพิกัด</span>
                  }
                </div>
              )
            })}
          </div>
          {valsNoLoc.length > 0 && (
            <div style={{ fontSize: 10, color: BRAND.textMut, marginTop: 8 }}>
              💡 รายการ "ไม่มีพิกัด" ไม่แสดงบนแผนที่ — เพิ่มพิกัดได้จากหน้าประเมินทรัพย์
            </div>
          )}
        </div>
      )}
    </div>
  )
}

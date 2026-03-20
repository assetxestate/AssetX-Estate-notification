import React, { useState, useMemo, useEffect } from 'react'

const BRAND = {
  teal: '#2DD4BF', gold: '#F59E0B', bg: '#050B18', bgCard: '#0D1B2E',
  border: '#0F2545', borderLt: '#162E56', textPri: '#F0F6FF',
  textSec: '#64748B', textMut: '#475569', success: '#10B981',
}

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
  titleDeedNo: '', surveyPage: '', landNo: '',
  province: 'กรุงเทพมหานคร', district: '', subdistrict: '',
  areaRai: 0, areaNgan: 0, areaSqw: 0, govPrice: 0,
  roadType: '', roadWidth: '', landFrontage: '', distanceFromMain: '',
  zoneColor: '', soilCondition: '', compPrice: '', compSource: '', locationNote: '',
  risks: { flood: false, hardAccess: false, irregularShape: false, encumbrance: false, dispute: false, noUtilities: false, nuisance: false, incompleteDeed: false },
  ltvRate: 50, linkedCustomer: '',
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
function HistoryView({ appsScriptUrl }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${appsScriptUrl}?action=getValuations`)
      .then(r => r.json())
      .then(r => { setRows(r.data || []); setLoading(false) })
      .catch(() => { setError('ไม่สามารถโหลดข้อมูลได้'); setLoading(false) })
  }, [appsScriptUrl])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: BRAND.textSec }}>กำลังโหลด...</div>
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#FCA5A5' }}>⚠️ {error}</div>
  if (rows.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: BRAND.textSec }}>ยังไม่มีข้อมูลการประเมิน</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: BRAND.textPri, marginBottom: 4 }}>
        📋 ประวัติการประเมิน ({rows.length} รายการ)
      </div>
      {[...rows].reverse().map((row, i) => (
        <Card key={i} style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, color: BRAND.textPri, fontSize: 15 }}>{row['รหัส/ชื่อทรัพย์'] || '—'}</div>
              <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 2 }}>
                {row['ประเภทการประเมิน']} • {row['ประเภทย่อย']} • {row['จังหวัด']}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: BRAND.textMut }}>{row['วันที่บันทึก']}</div>
              <span style={{ background: row['สถานะ'] === 'รอดำเนินการ' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', border: `1px solid ${row['สถานะ'] === 'รอดำเนินการ' ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, color: row['สถานะ'] === 'รอดำเนินการ' ? BRAND.gold : BRAND.success }}>
                {row['สถานะ']}
              </span>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 12 }}>📄 เลขที่โฉนด</div>
          <Label>เลขโฉนดที่ดิน</Label>
          <Inp value={form.titleDeedNo} onChange={e => update('titleDeedNo', e.target.value)} placeholder="เช่น 89062" style={{ marginBottom: 10 }} />
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

// ── Step 2 ─────────────────────────────────────────────
function Step2({ form, update, calc }) {
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
function Step4({ form, calc }) {
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
            {[['มูลค่าตลาด', calc.marketValue], ['FSV (80%)', calc.fsv], [`วงเงิน (LTV ${form.ltvRate}%)`, calc.recommendedLoan]].map(([k, v]) => (
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
        </div>
      </div>
      <div style={{ fontSize: 11, color: BRAND.textMut, textAlign: 'center', marginTop: 8 }}>
        AssetX Estate Co., Ltd. — Generated: {new Date().toLocaleString('th-TH')}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────
export default function ValuationPage({ onBack, appsScriptUrl, customers = [] }) {
  const [view, setView] = useState('form')
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

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
    window.print()
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
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          #print-area { color: black !important; }
          #print-area * { color: black !important; background: white !important; border-color: #ccc !important; }
          #print-area .card, #print-area > div > div { border: 1px solid #ccc !important; }
        }
      `}</style>

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
            {step === 2 && <Step2 form={form} update={update} calc={calc} />}
            {step === 3 && <Step3 form={form} update={update} calc={calc} />}
            {step === 4 && <Step4 form={form} calc={calc} />}

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

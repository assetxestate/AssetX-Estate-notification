import React, { useState } from 'react'

const BRAND = {
  teal: '#2DD4BF', gold: '#F59E0B', bg: '#050B18', bgCard: '#0D1B2E',
  border: '#0F2545', borderLt: '#162E56', textPri: '#F0F6FF',
  textSec: '#64748B', textMut: '#475569', success: '#10B981',
  danger: '#EF4444', purple: '#7C3AED', orange: '#F97316',
  blue: '#3B82F6', indigo: '#6366F1',
}

const card = {
  background: BRAND.bgCard,
  border: `1px solid ${BRAND.border}`,
  borderRadius: 12,
  padding: '20px 24px',
  marginBottom: 16,
}

const sectionTitle = (color) => ({
  fontSize: 13,
  fontWeight: 700,
  color,
  letterSpacing: 1,
  textTransform: 'uppercase',
  marginBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
})

const badge = (color) => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 700,
  background: `${color}22`,
  color,
  border: `1px solid ${color}44`,
})

const TABLE_STYLE = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
  color: BRAND.textPri,
}

const TH = { padding: '8px 12px', background: '#0a1628', color: BRAND.textSec, fontWeight: 600, fontSize: 11, textAlign: 'left', borderBottom: `1px solid ${BRAND.border}` }
const TD = { padding: '8px 12px', borderBottom: `1px solid ${BRAND.border}44`, verticalAlign: 'top' }

function LegalTable({ headers, rows }) {
  return (
    <table style={TABLE_STYLE}>
      <thead>
        <tr>{headers.map((h, i) => <th key={i} style={TH}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#060d1a' }}>
            {row.map((cell, j) => <td key={j} style={TD}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function AlertBox({ type, children }) {
  const colors = {
    warning: { bg: '#F59E0B22', border: '#F59E0B55', color: '#FCD34D', icon: '⚠️' },
    danger:  { bg: '#EF444422', border: '#EF444455', color: '#FCA5A5', icon: '❌' },
    info:    { bg: '#3B82F622', border: '#3B82F655', color: '#93C5FD', icon: 'ℹ️' },
    success: { bg: '#10B98122', border: '#10B98155', color: '#6EE7B7', icon: '✅' },
  }
  const c = colors[type] || colors.info
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: c.color, fontSize: 13 }}>
      {c.icon} {children}
    </div>
  )
}

function Section({ id, icon, title, color, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div id={id} style={{ ...card, borderLeft: `3px solid ${color}` }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: open ? 16 : 0 }}
      >
        <div style={sectionTitle(color)}>{icon} {title}</div>
        <span style={{ color: BRAND.textSec, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && children}
    </div>
  )
}

// ── SECTIONS DATA ───────────────────────────────────────────

function MortgageSection() {
  return (
    <Section id="mortgage" icon="🏦" title="กฎหมายจำนอง (ป.พ.พ. มาตรา 702–746)" color={BRAND.blue}>
      <AlertBox type="info">ผู้จำนองยังครอบครองทรัพย์ได้ตามปกติ — กรรมสิทธิ์ไม่โอน</AlertBox>

      <p style={{ color: BRAND.textSec, fontSize: 13, marginBottom: 12 }}>
        <strong style={{ color: BRAND.textPri }}>นิยาม (ม.702):</strong> สัญญาที่บุคคลเอาทรัพย์สินตราไว้เป็นประกันหนี้ โดยไม่ส่งมอบทรัพย์
      </p>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: BRAND.textSec, fontWeight: 700, marginBottom: 8 }}>สิทธิ์และหน้าที่</div>
        <LegalTable
          headers={['ฝ่าย', 'สิทธิ์', 'หน้าที่']}
          rows={[
            ['ผู้จำนอง (ลูกค้า)', 'ครอบครองและใช้ทรัพย์ (ม.717), ไถ่ถอนได้ตลอด (ม.722)', 'ชำระหนี้ตามสัญญา, ไม่ทำทรัพย์เสื่อมค่า (ม.718)'],
            ['ผู้รับจำนอง (AssetX)', 'บุริมสิทธิเหนือเจ้าหนี้รายอื่น, บังคับจำนองได้เมื่อผิดนัด', 'ห้ามครอบครองทรัพย์โดยไม่ได้รับอนุญาต'],
          ]}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: BRAND.textSec, fontWeight: 700, marginBottom: 8 }}>การบังคับจำนอง (ม.728–735)</div>
        <AlertBox type="danger">ห้ามริบทรัพย์โดยตรง — ต้องฟ้องศาลเท่านั้น</AlertBox>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { step: '1', text: 'บอกกล่าวบังคับจำนองเป็นหนังสือ', detail: 'ล่วงหน้า 60 วัน' },
            { step: '2', text: 'ยื่นฟ้องต่อศาล', detail: '' },
            { step: '3', text: 'ศาลสั่งขายทอดตลาด', detail: '' },
            { step: '4', text: 'นำเงินชำระหนี้ตามบุริมสิทธิ', detail: '' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span style={{ ...badge(BRAND.blue), minWidth: 22, textAlign: 'center' }}>{s.step}</span>
              <span style={{ color: BRAND.textPri }}>{s.text}</span>
              {s.detail && <span style={{ ...badge(BRAND.gold) }}>{s.detail}</span>}
            </div>
          ))}
        </div>
      </div>

      <LegalTable
        headers={['หัวข้อ', 'รายละเอียด']}
        rows={[
          ['อายุความ', '10 ปี นับจากวันหนี้ถึงกำหนด (ม.193/30)'],
          ['ค่าธรรมเนียมจดจำนอง', '1% ของวงเงิน (สูงสุด 200,000 บาท)'],
          ['ค่าปลดจำนอง', '5 บาท ต่อทุก 1,000 บาท ของวงเงิน'],
          ['ต้องจดทะเบียน', 'ณ สำนักงานที่ดิน — ไม่จด = โมฆะ (ม.714)'],
        ]}
      />
    </Section>
  )
}

function SalePledgeSection() {
  return (
    <Section id="salepledge" icon="📋" title="กฎหมายขายฝาก (ป.พ.พ. มาตรา 491–502)" color={BRAND.orange}>
      <AlertBox type="warning">กรรมสิทธิ์โอนไปยังผู้ซื้อฝากทันที — หากไม่ไถ่ถอนตามกำหนด สิทธิ์หมดโดยเด็ดขาด</AlertBox>

      <div style={{ marginBottom: 16 }}>
        <LegalTable
          headers={['หัวข้อ', 'จำนอง', 'ขายฝาก']}
          rows={[
            ['กรรมสิทธิ์', 'ยังเป็นของผู้จำนอง', 'โอนไปยังผู้ซื้อฝาก'],
            ['การครอบครอง', 'ผู้จำนองครอบครองได้', 'ผู้ซื้อฝากมีสิทธิ์ครอบครอง'],
            ['ความเสี่ยงลูกค้า', 'ต่ำ', 'สูง — เสียกรรมสิทธิ์ถ้าไม่ไถ่ถอน'],
          ]}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: BRAND.textSec, fontWeight: 700, marginBottom: 8 }}>ระยะเวลาไถ่ถอนสูงสุด (พ.ร.บ. ขายฝาก 2562)</div>
        <LegalTable
          headers={['ประเภทอสังหาฯ', 'กำหนดสูงสุด']}
          rows={[
            ['ที่ดิน', '10 ปี'],
            ['บ้าน / อาคาร', '10 ปี'],
            ['ห้องชุด (คอนโด)', '10 ปี'],
          ]}
        />
        <AlertBox type="success">ขยายกำหนดได้ — ทำเป็นหนังสือและจดทะเบียนก่อนวันครบกำหนด (ม.496)</AlertBox>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: BRAND.textSec, fontWeight: 700, marginBottom: 8 }}>พ.ร.บ. คุ้มครองผู้ขายฝาก 2562 — สาระสำคัญ</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'สินไถ่ต้องไม่เกินราคาขายฝาก + ดอกเบี้ยไม่เกิน 15% ต่อปี',
            'ผู้ซื้อฝากต้องแจ้งกำหนดไถ่ถอนล่วงหน้าอย่างน้อย 3 เดือน',
            'ห้ามผู้ซื้อฝากขายต่อทรัพย์ก่อนครบกำหนดโดยไม่แจ้ง',
            'ผู้ขายฝากมีสิทธิ์วางเงินสินไถ่ที่สำนักงานวางทรัพย์ได้',
          ].map((t, i) => (
            <div key={i} style={{ fontSize: 13, color: BRAND.textPri, display: 'flex', gap: 8 }}>
              <span style={{ color: BRAND.orange }}>•</span> {t}
            </div>
          ))}
        </div>
      </div>

      <LegalTable
        headers={['กรณี', 'ผลทางกฎหมาย']}
        rows={[
          ['ไม่ไถ่ถอนภายในกำหนด', 'กรรมสิทธิ์ตกแก่ผู้ซื้อฝากโดยเด็ดขาด (ม.498) — ไม่ต้องฟ้องศาล'],
          ['ผู้ขายฝากเสียชีวิต', 'สิทธิ์ไถ่ถอนตกทอดแก่ทายาท ภายในกำหนดเดิม'],
          ['ผู้ซื้อฝากขายทรัพย์ต่อ', 'ผู้รับโอนมีหน้าที่รับไถ่ถอนแทน (ม.497)'],
        ]}
      />
    </Section>
  )
}

function InterestSection() {
  return (
    <Section id="interest" icon="💰" title="กฎหมายดอกเบี้ยและอัตรา" color={BRAND.success}>
      <AlertBox type="danger">ดอกเบี้ยเกิน 15% ต่อปี = โมฆะทั้งหมด + โทษอาญา</AlertBox>

      <div style={{ marginBottom: 16 }}>
        <LegalTable
          headers={['ประเภท', 'อัตราสูงสุด', 'กฎหมาย']}
          rows={[
            ['สัญญากู้เงินทั่วไป', '15% ต่อปี (1.25%/เดือน)', 'ป.พ.พ. ม.654'],
            ['สินไถ่ขายฝาก', '15% ต่อปี', 'พ.ร.บ. ขายฝาก 2562'],
            ['ดอกเบี้ยผิดนัด (default)', '5% ต่อปี', 'ป.พ.พ. ม.224 (แก้ไข 2564)'],
            ['เงินกู้นอกระบบ', '15% ต่อปี', 'พ.ร.บ. ห้ามเรียกดอกเบี้ยเกินอัตรา 2560'],
          ]}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: BRAND.textSec, fontWeight: 700, marginBottom: 8 }}>สูตรคำนวณ</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: '#060d1a', borderRadius: 8, padding: 14, border: `1px solid ${BRAND.border}` }}>
            <div style={{ fontSize: 11, color: BRAND.success, fontWeight: 700, marginBottom: 6 }}>ดอกเบี้ยรายเดือน</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: BRAND.textPri }}>
              เงินต้น × อัตรา% ÷ 12
            </div>
            <div style={{ fontSize: 11, color: BRAND.textSec, marginTop: 6 }}>
              เช่น 1,000,000 × 1.25% = <span style={{ color: BRAND.gold }}>12,500 บาท/เดือน</span>
            </div>
          </div>
          <div style={{ background: '#060d1a', borderRadius: 8, padding: 14, border: `1px solid ${BRAND.border}` }}>
            <div style={{ fontSize: 11, color: BRAND.danger, fontWeight: 700, marginBottom: 6 }}>ดอกเบี้ยผิดนัด</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: BRAND.textPri }}>
              ยอดค้าง × 5% ÷ 365 × วัน
            </div>
            <div style={{ fontSize: 11, color: BRAND.textSec, marginTop: 6 }}>
              เช่น 500,000 × 5% ÷ 365 × 30 = <span style={{ color: BRAND.gold }}>2,054 บาท</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: BRAND.textSec, fontWeight: 700, marginBottom: 8 }}>โทษดอกเบี้ยเกินอัตรา (พ.ร.บ. 2560)</div>
        <LegalTable
          headers={['ความผิด', 'โทษ']}
          rows={[
            ['เรียกดอกเบี้ยเกิน 15%/ปี', 'จำคุกไม่เกิน 2 ปี หรือปรับไม่เกิน 200,000 บาท หรือทั้งจำทั้งปรับ'],
            ['สัญญาดอกเบี้ยเกินอัตรา', 'โมฆะทั้งฉบับ — ไม่ใช่แค่ส่วนที่เกิน'],
          ]}
        />
      </div>
    </Section>
  )
}

function TaxLegalSection() {
  return (
    <Section id="tax" icon="🧾" title="ภาษีอสังหาริมทรัพย์" color={BRAND.purple}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: BRAND.textSec, fontWeight: 700, marginBottom: 8 }}>ภาษีธุรกิจเฉพาะ (SBT) — 3.3%</div>
        <LegalTable
          headers={['เงื่อนไข', 'ต้องเสีย SBT']}
          rows={[
            ['ถือครองน้อยกว่า 5 ปี', '✅ ต้องเสีย 3.3%'],
            ['ขายในฐานะธุรกิจ', '✅ ต้องเสีย 3.3%'],
            ['มีชื่อทะเบียนบ้านน้อยกว่า 1 ปี (บ้านหลัก)', '✅ ต้องเสีย 3.3%'],
            ['ถือครองเกิน 5 ปี + ชื่อทะเบียนบ้านเกิน 1 ปี', '❌ เสียอากรแสตมป์ 0.5% แทน'],
          ]}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: BRAND.textSec, fontWeight: 700, marginBottom: 8 }}>ค่าธรรมเนียมและภาษีการโอน</div>
        <LegalTable
          headers={['รายการ', 'อัตรา', 'ผู้รับผิดชอบ']}
          rows={[
            ['ค่าธรรมเนียมโอน', '2% ของราคาประเมิน', 'ตกลงกันระหว่างคู่สัญญา'],
            ['ภาษีธุรกิจเฉพาะ (SBT)', '3.3% ของราคาขาย/ประเมิน', 'ผู้ขาย (โดยทั่วไป)'],
            ['อากรแสตมป์', '0.5% ของราคาขาย', 'กรณีไม่เสีย SBT'],
            ['ภาษีหัก ณ ที่จ่าย (บุคคลธรรมดา)', 'คำนวณตามขั้นบันได', 'ผู้ขาย'],
            ['ภาษีหัก ณ ที่จ่าย (นิติบุคคล)', '1% ของราคาขาย/ประเมิน', 'ผู้ขาย'],
            ['ค่าจดทะเบียนจำนอง', '1% ของวงเงิน (สูงสุด 200,000)', 'ผู้จำนอง'],
          ]}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: BRAND.textSec, fontWeight: 700, marginBottom: 8 }}>ภาษีที่ดินและสิ่งปลูกสร้าง (พ.ร.บ. 2562)</div>
        <LegalTable
          headers={['ประเภทการใช้งาน', 'อัตราภาษี']}
          rows={[
            ['เกษตรกรรม', '0.01% – 0.1%'],
            ['ที่อยู่อาศัยหลัก (ราคา ≤ 50 ล้าน)', 'ยกเว้น'],
            ['ที่อยู่อาศัยหลัก (ราคา > 50 ล้าน)', '0.02% – 0.1%'],
            ['พาณิชยกรรม / อุตสาหกรรม', '0.3% – 0.7%'],
            ['ที่ดินรกร้างว่างเปล่า', '0.3% – 3% (เพิ่มขึ้นทุก 3 ปี)'],
          ]}
        />
      </div>
    </Section>
  )
}

function SpecialCasesSection() {
  const cases = [
    {
      title: 'ลูกค้าเสียชีวิต',
      icon: '⚰️',
      points: [
        'หนี้จำนอง/ขายฝากตกทอดแก่ทายาท (ป.พ.พ. ม.1600)',
        'ทายาทมีสิทธิ์ไถ่ถอนได้ภายในกำหนดเดิม',
        'ต้องตรวจสอบพินัยกรรมและผู้จัดการมรดก',
      ]
    },
    {
      title: 'ลูกค้าล้มละลาย',
      icon: '🏦',
      points: [
        'AssetX มีบุริมสิทธิพิเศษเหนือเจ้าหนี้สามัญ',
        'บังคับจำนองได้แม้ลูกหนี้ล้มละลาย (พ.ร.บ. ล้มละลาย ม.95)',
        'ต้องยื่นคำขอรับชำระหนี้ต่อเจ้าพนักงานพิทักษ์ทรัพย์',
      ]
    },
    {
      title: 'ทรัพย์ถูกบังคับคดีโดยเจ้าหนี้อื่น',
      icon: '⚖️',
      points: [
        'AssetX มีสิทธิ์รับชำระหนี้ก่อนเจ้าหนี้รายอื่น (ม.289)',
        'ต้องยื่นคำร้องขอรับชำระหนี้ในคดีบังคับคดี',
      ]
    },
    {
      title: 'ทรัพย์จำนองถูกเวนคืน',
      icon: '🏛️',
      points: [
        'เงินค่าทดแทนการเวนคืนตกแก่ AssetX ก่อน (ม.731)',
        'ต้องแจ้งหน่วยงานรัฐว่ามีการจำนองไว้แล้ว',
      ]
    },
  ]

  return (
    <Section id="special" icon="🔍" title="สถานการณ์พิเศษ" color={BRAND.gold}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {cases.map((c, i) => (
          <div key={i} style={{ background: '#060d1a', borderRadius: 8, padding: 14, border: `1px solid ${BRAND.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 8 }}>
              {c.icon} {c.title}
            </div>
            {c.points.map((p, j) => (
              <div key={j} style={{ fontSize: 12, color: BRAND.textSec, marginBottom: 4, display: 'flex', gap: 6 }}>
                <span style={{ color: BRAND.gold, flexShrink: 0 }}>•</span> {p}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Section>
  )
}

function VoidClausesSection() {
  const voidItems = [
    { clause: 'ดอกเบี้ยเกิน 15% ต่อปี', reason: 'ป.พ.พ. ม.654' },
    { clause: 'ห้ามผู้จำนองไถ่ถอน', reason: 'ป.พ.พ. ม.722' },
    { clause: 'ผู้รับจำนองครอบครองทรัพย์ได้ทันทีเมื่อผิดนัด', reason: 'ป.พ.พ. ม.729' },
    { clause: 'สินไถ่ขายฝากเกิน 15%/ปี', reason: 'พ.ร.บ. ขายฝาก 2562' },
    { clause: 'ผู้ขายฝากไม่มีสิทธิ์ไถ่ถอน', reason: 'ป.พ.พ. ม.491' },
    { clause: 'บังคับจำนองโดยไม่ผ่านศาล', reason: 'ป.พ.พ. ม.728' },
  ]

  return (
    <Section id="void" icon="🚫" title="ข้อสัญญาที่เป็นโมฆะ — ห้ามใช้เด็ดขาด" color={BRAND.danger}>
      <AlertBox type="danger">ข้อสัญญาต่อไปนี้เป็นโมฆะโดยกฎหมาย แม้ลูกค้ายินยอมก็ตาม</AlertBox>
      <LegalTable
        headers={['ข้อสัญญา', 'อ้างอิงกฎหมาย']}
        rows={voidItems.map(v => [
          <span style={{ color: BRAND.danger }}>❌ {v.clause}</span>,
          <span style={{ ...badge(BRAND.danger) }}>{v.reason}</span>
        ])}
      />
    </Section>
  )
}

function ChecklistSection() {
  const groups = [
    {
      title: 'ก่อนทำสัญญา', color: BRAND.blue,
      items: [
        'ตรวจสอบโฉนด/เอกสารสิทธิ์ไม่ติดภาระใด',
        'ตรวจสอบอัตราดอกเบี้ยไม่เกิน 15% ต่อปี',
        'ระบุวันครบกำหนดชำระชัดเจน',
        'จดทะเบียน ณ สำนักงานที่ดิน',
      ]
    },
    {
      title: 'ระหว่างสัญญา', color: BRAND.success,
      items: [
        'เก็บหลักฐานการชำระดอกเบี้ยทุกครั้ง',
        'แจ้งเตือนลูกค้าล่วงหน้า 7+ วัน',
        'ไม่รบกวนการครอบครองทรัพย์ (กรณีจำนอง)',
        'อัปเดตสถานะสัญญาในระบบ',
      ]
    },
    {
      title: 'กรณีผิดนัด', color: BRAND.danger,
      items: [
        'บอกกล่าวเป็นลายลักษณ์อักษรทันที',
        'รอครบ 60 วัน (กรณีบังคับจำนอง)',
        'ยื่นฟ้องผ่านศาล — ห้ามริบทรัพย์เอง',
        'ปรึกษาทนายความก่อนดำเนินการ',
      ]
    },
  ]

  return (
    <Section id="checklist" icon="✅" title="Checklist กฎหมาย AssetX" color={BRAND.teal}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {groups.map((g, i) => (
          <div key={i} style={{ background: '#060d1a', borderRadius: 8, padding: 14, border: `1px solid ${g.color}44` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: g.color, marginBottom: 10 }}>{g.title}</div>
            {g.items.map((item, j) => (
              <div key={j} style={{ fontSize: 12, color: BRAND.textSec, marginBottom: 6, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ color: g.color, flexShrink: 0, marginTop: 1 }}>☐</span> {item}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── MAIN COMPONENT ──────────────────────────────────────────

export default function LegalPage() {
  const [activeSection, setActiveSection] = useState(null)

  const navItems = [
    { id: 'mortgage',   label: 'จำนอง',        color: BRAND.blue },
    { id: 'salepledge', label: 'ขายฝาก',       color: BRAND.orange },
    { id: 'interest',   label: 'ดอกเบี้ย',     color: BRAND.success },
    { id: 'tax',        label: 'ภาษีอสังหาฯ',  color: BRAND.purple },
    { id: 'special',    label: 'สถานการณ์พิเศษ', color: BRAND.gold },
    { id: 'void',       label: 'ข้อโมฆะ',      color: BRAND.danger },
    { id: 'checklist',  label: 'Checklist',    color: BRAND.teal },
  ]

  const scrollTo = (id) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={{ padding: '0 0 40px 0', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: BRAND.textPri, marginBottom: 4 }}>
          ⚖️ กฎหมายอสังหาริมทรัพย์
        </div>
        <div style={{ fontSize: 13, color: BRAND.textSec }}>
          คู่มืออ้างอิงกฎหมายสำหรับสัญญาจำนองและขายฝาก — ใช้เป็นข้อมูลเบื้องต้น ควรปรึกษาทนายความสำหรับกรณีเฉพาะ
        </div>
      </div>

      {/* Quick Nav */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {navItems.map(n => (
          <button
            key={n.id}
            onClick={() => scrollTo(n.id)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: `1px solid ${n.color}55`,
              background: activeSection === n.id ? `${n.color}22` : 'transparent',
              color: n.color,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {n.label}
          </button>
        ))}
      </div>

      {/* Sections */}
      <MortgageSection />
      <SalePledgeSection />
      <InterestSection />
      <TaxLegalSection />
      <SpecialCasesSection />
      <VoidClausesSection />
      <ChecklistSection />

      {/* Footer */}
      <div style={{ fontSize: 11, color: BRAND.textMut, textAlign: 'center', marginTop: 24 }}>
        อ้างอิง: ป.พ.พ. มาตรา 224, 491–502, 654, 702–746 · พ.ร.บ. ขายฝาก 2562 · พ.ร.บ. ห้ามเรียกดอกเบี้ยเกินอัตรา 2560 · พ.ร.บ. ที่ดินและสิ่งปลูกสร้าง 2562 · ประมวลรัษฎากร
      </div>
    </div>
  )
}

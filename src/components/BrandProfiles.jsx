// โปรไฟล์แบรนด์ 2 แบบในหน้า เครื่องมือ → กติกาแบรนด์ ของ /marketing — เฟส P1 · 23 พ.ย. 2569
// แสดงจุดยืน น้ำเสียง สิ่งที่ต้องหลีกเลี่ยง และข้อที่ต้องบอกผู้อ่าน (ล็อก แก้จากหน้านี้ไม่ได้)
// ส่วนที่เจ้าของแก้ได้: คำชวนทำตั้งต้น และคำที่ชอบใช้ (มีเลขเวอร์ชัน) · ตรรกะล้วนอยู่ใน src/lib/marketingBrands.js
import React, { useState } from 'react'
import { brandList, effectiveBrand } from '../lib/marketingBrands.js'

function BrandCard({ brand, onSave }) {
  const [cta, setCta] = useState(brand.cta)
  const [preferred, setPreferred] = useState(brand.preferred.join(' · '))
  const dirty = cta !== brand.cta || preferred !== brand.preferred.join(' · ')
  return (
    <article className="bp-series-card">
      <div className="bp-claim-head">
        <strong>{brand.name}</strong>
        <span className="bp-tag">{brand.settingsVersion ? `ตั้งค่าเวอร์ชัน ${brand.settingsVersion}` : 'ค่าตั้งต้น'}</span>
      </div>
      <p>{brand.purpose}</p>
      <p className="bp-note">น้ำเสียง: {brand.voice}</p>
      <div className="bp-gate-section">
        <em>ต้องหลีกเลี่ยง (แก้จากหน้านี้ไม่ได้)</em>
        {brand.avoid.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="bp-gate-section">
        <em>ต้องบอกผู้อ่าน (แก้จากหน้านี้ไม่ได้)</em>
        {brand.disclosures.map((item) => <span key={item}>{item}</span>)}
      </div>
      <label className="bp-brand-field">คำชวนทำตั้งต้น
        <input value={cta} maxLength={200} onChange={(event) => setCta(event.target.value)} />
      </label>
      <label className="bp-brand-field">คำที่ชอบใช้ (คั่นด้วย ·)
        <input value={preferred} maxLength={300} onChange={(event) => setPreferred(event.target.value)} />
      </label>
      <div className="bp-actions">
        <button type="button" className="mx-secondary" disabled={!dirty} onClick={() => onSave?.(brand.id, { cta, preferred })}>บันทึก</button>
        {brand.settingsUpdatedAt && <span className="bp-note">แก้ล่าสุด {new Date(brand.settingsUpdatedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' })}</span>}
      </div>
    </article>
  )
}

export default function BrandProfiles({ settings = {}, onSave }) {
  return (
    <section className="mx-content">
      <div className="mx-page-head">
        <div>
          <div className="mx-kicker">กติกาแบรนด์</div>
          <h1>สองแบรนด์ ระบบเดียวกัน</h1>
          <p>ทั้งสองแบรนด์พูดกับเจ้าของทรัพย์ · Estate ชวนส่งข้อมูลมาประเมิน · Research เป็นบทวิเคราะห์ที่ยึดหลักฐานและไม่ขาย · เลือกแบรนด์ได้ในแผงบรีฟและบนการ์ดร่าง</p>
        </div>
      </div>
      <div className="bp-series-grid">
        {brandList().map((brand) => {
          const current = effectiveBrand(brand.id, settings)
          return <BrandCard key={`${brand.id}-${current.settingsVersion}`} brand={current} onSave={onSave} />
        })}
      </div>
    </section>
  )
}

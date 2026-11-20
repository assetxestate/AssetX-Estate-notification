import React, { useEffect, useMemo, useState } from 'react'
import { BUILDING_CLASSES, BUILDING_COST_CAVEAT, buildingSummaryText, buildingTypes, computeBuildings } from '../lib/buildingCost.js'
import { areaInput } from '../lib/deedTypes.js'

// ราคาประเมินราชการของสิ่งปลูกสร้าง: ประเภทตามบัญชีของกรมธนารักษ์ × ราคาต่อหน่วยของจังหวัด × พื้นที่ − ค่าเสื่อมตามอายุ
// AI เสนอได้แค่ประเภทและชนิดโครงสร้างจากรูป (suggestions) · พื้นที่และอายุเจ้าของกรอกเอง · ระบบไม่ใส่ยอดลงสรุปเอง ต้องกด "ใช้ยอดนี้"
// รายการที่กรอกจำไว้ในเครื่องนี้ต่อรายการ (ยังไม่เก็บลงฐานข้อมูล)
const money = (n) => Math.round(n).toLocaleString('en-US')
let nextKey = 1
const newItem = (over = {}) => ({ key: `${Date.now()}-${nextKey++}`, typeId: '', cls: '', area: '', age: '', what: '', ...over })

export default function BuildingCostPanel({ rowId, province, suggestions = [], suggestionsNote = '', onUse }) {
  const storeKey = `assetx_buildings_${rowId}`
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [items, setItems] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(storeKey) || '[]'); return Array.isArray(saved) ? saved : [] } catch { return [] }
  })

  useEffect(() => {
    let cancelled = false
    import('../lib/treasuryBuildingCosts.json').then(m => { if (!cancelled) setData(m.default) }).catch(() => { if (!cancelled) setLoadError('โหลดบัญชีราคาประเมินสิ่งปลูกสร้างไม่สำเร็จ') })
    return () => { cancelled = true }
  }, [])

  const save = (next) => {
    setItems(next)
    try { localStorage.setItem(storeKey, JSON.stringify(next)) } catch { /* ไม่จำก็ยังใช้งานได้ */ }
  }
  const update = (key, patch) => save(items.map(it => (it.key === key ? { ...it, ...patch } : it)))

  const types = useMemo(() => buildingTypes(data), [data])
  const typeById = useMemo(() => Object.fromEntries(types.map(t => [t.id, t])), [types])
  const result = useMemo(() => computeBuildings(items, data, province), [items, data, province])
  const provinceKnown = !!data && !!province && Object.keys(data.provinces).some(p => p.replace(/\s+/g, '') === String(province).replace(/^จังหวัด/, '').replace(/\s+/g, ''))

  const addSuggestions = () => {
    const fresh = suggestions.filter(s => typeById[s.typeId]).map(s => newItem({ typeId: s.typeId, cls: s.cls || typeById[s.typeId].cls, what: s.what || '', fromAi: true, confidence: s.confidence, evidence: s.evidence || '' }))
    if (fresh.length) save([...items, ...fresh])
  }

  if (loadError) return <p className="lt-note" data-tone="error">{loadError}</p>
  if (!data) return <p className="lt-note">กำลังโหลดบัญชีราคาประเมินสิ่งปลูกสร้าง…</p>

  return (
    <div className="bc">
      <p className="lt-note">
        เทียบสิ่งปลูกสร้างกับบัญชีราคาประเมินของกรมธนารักษ์ รอบ {data.round} จังหวัด{province || 'ไม่ระบุ'} · เลือกประเภท แล้วกรอกพื้นที่และอายุ ระบบหักค่าเสื่อมให้ตามตารางราชการ
      </p>
      {!provinceKnown && <p className="lt-note" data-tone="warn">รายการนี้ยังไม่มีจังหวัดที่ตรงกับบัญชี จึงยังดึงราคาต่อหน่วยไม่ได้ ให้ใส่จังหวัดในฟอร์มประเมินก่อน</p>}

      {items.map((it, index) => {
        const r = result.rows[index]
        const type = typeById[it.typeId]
        return (
          <div key={it.key} className="bc-row">
            <div className="bc-head">
              <b>{it.what || `สิ่งปลูกสร้างที่ ${index + 1}`}</b>
              {it.fromAi && <span className="lt-conf" data-level={it.confidence}>AI เสนอประเภทจากรูป{it.confidence === 'low' ? ' (ไม่ชัด ให้ตรวจ)' : ''}</span>}
              <button type="button" className="bc-remove" onClick={() => save(items.filter(x => x.key !== it.key))} aria-label={`เอารายการที่ ${index + 1} ออก`}>เอาออก</button>
            </div>
            {it.fromAi && it.evidence && <p className="lt-note">{it.evidence}</p>}
            <div className="bc-grid">
              <label className="lt-field bc-type">
                <span>ประเภทตามบัญชีกรมธนารักษ์</span>
                <select value={it.typeId} onChange={e => update(it.key, { typeId: e.target.value, cls: typeById[e.target.value]?.cls || it.cls })}>
                  <option value="">เลือกประเภท</option>
                  <optgroup label="อาคาร (บาทต่อตารางเมตร)">
                    {types.filter(t => !t.siteWork).map(t => <option key={t.id} value={t.id}>{t.id} · {t.name}</option>)}
                  </optgroup>
                  <optgroup label="สิ่งปลูกสร้างประกอบ (ตรวจหน่วยในบัญชีก่อนใช้)">
                    {types.filter(t => t.siteWork).map(t => <option key={t.id} value={t.id}>{t.id} · {t.name}</option>)}
                  </optgroup>
                </select>
              </label>
              <label className="lt-field">
                <span>โครงสร้าง <small>ใช้คิดค่าเสื่อม</small></span>
                <select value={it.cls || type?.cls || 'masonry'} onChange={e => update(it.key, { cls: e.target.value })}>
                  {Object.entries(BUILDING_CLASSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <label className="lt-field">
                <span>พื้นที่ (ตร.ม.)</span>
                <input type="text" inputMode="decimal" value={it.area} onChange={e => update(it.key, { area: areaInput(e.target.value, { decimal: true }) })} />
              </label>
              <label className="lt-field">
                <span>อายุ (ปี)</span>
                <input type="text" inputMode="numeric" value={it.age} onChange={e => update(it.key, { age: areaInput(e.target.value) })} />
              </label>
            </div>
            <p className="bc-line" data-ready={!r.missing.length}>
              {r.missing.length
                ? `ยังขาด: ${r.missing.join(' · ')}${r.unit ? ` · ราคาบัญชี ${money(r.unit)} บาทต่อหน่วย` : ''}`
                : `${money(r.unit)} บาท × ${r.area.toLocaleString('en-US')} = ${money(r.newCost)} บาท · หักค่าเสื่อม ${r.depPct}% (${BUILDING_CLASSES[r.cls]} อายุ ${r.age} ปี) → ${money(r.value)} บาท`}
            </p>
            {type?.siteWork && <p className="lt-note" data-tone="warn">รายการนี้เป็นสิ่งปลูกสร้างประกอบ หน่วยของราคาในบัญชีอาจไม่ใช่ตารางเมตรของพื้นที่ใช้สอย ตรวจหน่วยกับบัญชีก่อนใช้ยอด</p>}
          </div>
        )
      })}

      <div className="lt-actions">
        <button type="button" className="lt-btn" onClick={() => save([...items, newItem()])}>เพิ่มสิ่งปลูกสร้าง</button>
        {suggestions.length > 0 && <button type="button" className="lt-btn" onClick={addSuggestions}>เติมประเภทจากผลอ่านรูปของ AI ({suggestions.length})</button>}
      </div>
      {suggestions.length === 0 && suggestionsNote && <p className="lt-note">{suggestionsNote}</p>}

      {items.length > 0 && (
        <div className="bc-total">
          <b>รวมราคาประเมินราชการของสิ่งปลูกสร้าง: {money(result.total)} บาท</b>
          {!result.complete && <span className="lt-note" data-tone="warn"> ยังมีรายการที่ข้อมูลไม่ครบ ยอดรวมนับเฉพาะรายการที่ครบ</span>}
          <div className="lt-actions">
            <button type="button" className="lt-btn" data-kind="primary" disabled={result.total <= 0} onClick={() => onUse?.({ total: result.total, text: buildingSummaryText(items, data, province) })}>ใช้ยอดนี้ในสรุปส่งนายทุน</button>
          </div>
        </div>
      )}
      <p className="lt-note">{BUILDING_COST_CAVEAT} · ที่มา: {data.source} (ไฟล์ {data.file})</p>
    </div>
  )
}

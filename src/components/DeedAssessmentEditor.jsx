import React from "react";
import { BRAND } from "../lib/config.js";
import { formatThai } from "../lib/utils.js";
import { getValuations } from "../lib/api.js";
import { deedAssessment, findValuationPriceForDeed } from "../lib/deedAssessment.js";

// โหลดผลประเมินครั้งเดียวต่อการเปิดหน้า เพื่อเสนอราคาที่เคยประเมินโฉนดเลขเดียวกันไว้
let valuationsPromise = null;
const loadValuations = () => {
  if (!valuationsPromise) valuationsPromise = getValuations().catch(() => []);
  return valuationsPromise;
};

const money = (n) => Number(n || 0).toLocaleString("th-TH");

// ── ราคาประเมินราชการของโฉนด 1 แปลง: แสดง + แก้ไขในที่ ────────────────
// onSave(customerId, deeds) → บันทึกทั้งอาร์เรย์โฉนด (ตารางเก็บเป็น JSON)
export function DeedAssessmentEditor({ customer, deed, index, onSave }) {
  const current = deedAssessment(deed);
  const [editing, setEditing] = React.useState(false);
  const [price, setPrice] = React.useState(deed.govPrice ? String(deed.govPrice) : "");
  const [building, setBuilding] = React.useState(deed.buildingValue ? String(deed.buildingValue) : "");
  const [date, setDate] = React.useState(deed.govPriceDate || "");
  const [saving, setSaving] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState(null);

  React.useEffect(() => {
    if (!editing) return;
    let alive = true;
    loadValuations().then(rows => { if (alive) setSuggestion(findValuationPriceForDeed(deed, rows)); });
    return () => { alive = false; };
  }, [editing, deed]);

  const inp = { width: "100%", background: "rgba(255,255,255,.06)", border: `1px solid ${BRAND.border}`, borderRadius: 7, color: BRAND.textPri, fontSize: 12, padding: "6px 9px", outline: "none", boxSizing: "border-box" };
  const lbl = { fontSize: 10, color: BRAND.textSec, marginBottom: 3, display: "block" };
  const btn = (active) => ({ padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: `1px solid ${active ? "rgba(45,212,191,.4)" : BRAND.border}`, background: active ? "rgba(45,212,191,.15)" : "transparent", color: active ? BRAND.teal : BRAND.textSec });

  const handleSave = async () => {
    const govPrice = Number(price);
    if (!(govPrice > 0)) return;
    setSaving(true);
    const deeds = (customer.deeds || []).map((d, i) => i === index
      ? { ...d, govPrice, buildingValue: Number(building) || 0, govPriceDate: date || "" }
      : d);
    const ok = await onSave(customer.id, deeds);
    setSaving(false);
    if (ok) setEditing(false);
  };

  const preview = (() => {
    const p = Number(price);
    if (!(p > 0) || !(current.wa > 0)) return null;
    return Math.round(current.wa * p) + (Number(building) || 0);
  })();

  return (
    <div style={{ gridColumn: "1 / -1", marginTop: 4, padding: "8px 10px", borderRadius: 8, background: current.priced ? "rgba(45,212,191,.06)" : "rgba(245,158,11,.06)", border: `1px solid ${current.priced ? "rgba(45,212,191,.2)" : "rgba(245,158,11,.25)"}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 2 }}>ราคาประเมินราชการ (กรมธนารักษ์)</div>
          {current.priced ? (
            <div style={{ fontSize: 12, color: BRAND.textPri }}>
              <span style={{ fontWeight: 700, color: BRAND.teal }}>฿{money(current.total)}</span>
              <span style={{ color: BRAND.textSec, marginLeft: 8 }}>
                {money(current.govPrice)} ฿/ตร.ว. × {money(current.wa)} ตร.ว.
                {current.buildingValue > 0 ? ` + สิ่งปลูกสร้าง ${money(current.buildingValue)}` : ""}
                {deed.govPriceDate ? ` · อ้างอิง ${formatThai(deed.govPriceDate)}` : ""}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#FCD34D" }}>ยังไม่ระบุ{current.wa > 0 ? ` (เนื้อที่ ${money(current.wa)} ตร.ว.)` : " — เนื้อที่โฉนดอ่านไม่ได้"}</div>
          )}
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); setEditing(v => !v); }} style={btn(!editing)}>
          {editing ? "ยกเลิก" : current.priced ? "แก้ไข" : "+ ระบุราคา"}
        </button>
      </div>

      {editing && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }} onClick={(e) => e.stopPropagation()}>
          {suggestion && (
            <div style={{ fontSize: 11, color: BRAND.textSec, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              ผลประเมินในระบบของโฉนดเลขนี้: <b style={{ color: BRAND.teal }}>{money(suggestion.govPrice)} ฿/ตร.ว.</b>
              {suggestion.date ? ` (${formatThai(suggestion.date)})` : ""}
              <button type="button" onClick={() => { setPrice(String(suggestion.govPrice)); if (suggestion.date) setDate(String(suggestion.date).slice(0, 10)); }} style={btn(true)}>ใช้ค่านี้</button>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            <div>
              <label style={lbl}>ราคาประเมิน (บาท/ตร.ว.) *</label>
              <input type="number" min="0" step="any" value={price} onChange={e => setPrice(e.target.value)} style={inp} placeholder="เช่น 2200" />
            </div>
            <div>
              <label style={lbl}>สิ่งปลูกสร้าง (บาท)</label>
              <input type="number" min="0" step="any" value={building} onChange={e => setBuilding(e.target.value)} style={inp} placeholder="ที่ดินเปล่าใส่ 0" />
            </div>
            <div>
              <label style={lbl}>วันที่อ้างอิงราคา</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: BRAND.textSec }}>
              {preview !== null ? <>รวมแปลงนี้ <b style={{ color: BRAND.teal }}>฿{money(preview)}</b></> : "กรอกราคาต่อตารางวาเพื่อคำนวณ"}
              {" · "}<a href="https://assessprice.treasury.go.th/" target="_blank" rel="noreferrer" style={{ color: BRAND.teal }}>ตรวจราคากรมธนารักษ์</a>
            </span>
            <button type="button" onClick={handleSave} disabled={saving || !(Number(price) > 0)} style={{ ...btn(true), fontWeight: 700, opacity: saving || !(Number(price) > 0) ? 0.5 : 1 }}>
              {saving ? "⏳ กำลังบันทึก..." : "✓ บันทึก"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

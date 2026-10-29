import React from "react";
import { BRAND } from "../lib/config.js";
import { formatThai } from "../lib/utils.js";
import { getValuations } from "../lib/api.js";
import { deedAssessment, findValuationPriceForDeed } from "../lib/deedAssessment.js";

// โหลดผลประเมินครั้งเดียวต่อการเปิดหน้า เพื่อเสนอราคาที่เคยประเมินโฉนดเลขเดียวกันไว้ (โหลดพลาดแล้วลองใหม่ครั้งถัดไปได้)
let valuationsPromise = null;
const loadValuations = () => {
  if (!valuationsPromise) valuationsPromise = getValuations().catch(() => { valuationsPromise = null; return []; });
  return valuationsPromise;
};

const money = (n) => Number(n || 0).toLocaleString("th-TH");
const nonNeg = (v) => Math.max(0, Number(v) || 0);

// ── ราคาประเมินราชการของโฉนด 1 แปลง: แสดง + แก้ไขในที่ ────────────────
// onSave(customerId, index, patch, deedNo) → บันทึกเฉพาะแปลงนี้ (อ่าน deeds ล่าสุดจากฐานข้อมูลก่อนเขียน)
export function DeedAssessmentEditor({ customer, deed, index, onSave }) {
  const current = deedAssessment(deed);
  const [editing, setEditing] = React.useState(false);
  const [price, setPrice] = React.useState("");
  const [building, setBuilding] = React.useState("");
  const [date, setDate] = React.useState("");
  const [area, setArea] = React.useState({ rai: "", ngan: "", wa: "" });
  const [saving, setSaving] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState(null);

  // เปิดฟอร์มทุกครั้งเริ่มจากค่าที่บันทึกไว้ (กด ยกเลิก แล้วค่าที่พิมพ์ค้างต้องหายไป)
  React.useEffect(() => {
    if (!editing) return;
    setPrice(deed.govPrice ? String(deed.govPrice) : "");
    setBuilding(deed.buildingValue ? String(deed.buildingValue) : "");
    setDate(deed.govPriceDate || "");
    setArea({ rai: "", ngan: "", wa: "" });
    let alive = true;
    loadValuations().then(rows => { if (alive) setSuggestion(findValuationPriceForDeed(deed, rows)); });
    return () => { alive = false; };
  }, [editing, deed]);

  const inp = { width: "100%", background: "rgba(255,255,255,.06)", border: `1px solid ${BRAND.border}`, borderRadius: 7, color: BRAND.textPri, fontSize: 12, padding: "6px 9px", outline: "none", boxSizing: "border-box" };
  const lbl = { fontSize: 10, color: BRAND.textSec, marginBottom: 3, display: "block" };
  const btn = (active) => ({ padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: `1px solid ${active ? "rgba(45,212,191,.4)" : BRAND.border}`, background: active ? "rgba(45,212,191,.15)" : "transparent", color: active ? BRAND.teal : BRAND.textSec });

  // โฉนดที่อ่านเนื้อที่ไม่ได้ (ข้อมูลเก่ามีแต่เลขโฉนด) ให้กรอก ไร่-งาน-วา ที่นี่ได้เลย
  const needsArea = !(current.wa > 0);
  const enteredWa = needsArea ? nonNeg(area.rai) * 400 + nonNeg(area.ngan) * 100 + nonNeg(area.wa) : current.wa;
  const canSave = Number(price) > 0 && enteredWa > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const patch = { govPrice: Number(price), buildingValue: nonNeg(building), govPriceDate: date || "" };
    if (needsArea) patch.area = `${Math.trunc(nonNeg(area.rai))}-${Math.trunc(nonNeg(area.ngan))}-${nonNeg(area.wa)} ไร่`;
    const ok = await onSave(customer.id, index, patch, deed.no || "");
    setSaving(false);
    if (ok) setEditing(false);
  };

  const preview = Number(price) > 0 && enteredWa > 0 ? Math.round(enteredWa * Number(price)) + nonNeg(building) : null;

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ gridColumn: "1 / -1", marginTop: 4, padding: "8px 10px", borderRadius: 8, background: current.priced ? "rgba(45,212,191,.06)" : "rgba(245,158,11,.06)", border: `1px solid ${current.priced ? "rgba(45,212,191,.2)" : "rgba(245,158,11,.25)"}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 2 }}>ราคาประเมินราชการ (กรมธนารักษ์)</div>
          {current.priced ? (
            <div style={{ fontSize: 12, color: BRAND.textPri }}>
              <span style={{ fontWeight: 700, color: BRAND.teal }}>{money(current.total)} ฿</span>
              <span style={{ color: BRAND.textSec, marginLeft: 8 }}>
                {money(current.govPrice)} ฿/ตร.ว. × {money(current.wa)} ตร.ว.
                {current.buildingValue > 0 ? ` + สิ่งปลูกสร้าง ${money(current.buildingValue)} ฿` : ""}
                {deed.govPriceDate ? ` · อ้างอิง ${formatThai(deed.govPriceDate)}` : ""}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#FCD34D" }}>
              {deed.govPrice > 0 ? `บันทึกราคา ${money(deed.govPrice)} ฿/ตร.ว. ไว้แล้ว แต่` : "ยังไม่ระบุ"}
              {current.wa > 0 ? ` (เนื้อที่ ${money(current.wa)} ตร.ว.)` : " — เนื้อที่โฉนดอ่านไม่ได้ กรอกไร่-งาน-วาได้ในแบบฟอร์ม"}
            </div>
          )}
        </div>
        <button type="button" onClick={() => setEditing(v => !v)} style={btn(!editing)}>
          {editing ? "ยกเลิก" : current.priced ? "แก้ไข" : "+ ระบุราคา"}
        </button>
      </div>

      {editing && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {suggestion && (
            <div style={{ fontSize: 11, color: BRAND.textSec, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              ผลประเมินในระบบของโฉนดเลขนี้{suggestion.source ? ` (${suggestion.source})` : ""}: <b style={{ color: BRAND.teal }}>{money(suggestion.govPrice)} ฿/ตร.ว.</b>
              {suggestion.date ? ` · ${formatThai(suggestion.date)}` : ""}
              <button type="button" onClick={() => { setPrice(String(suggestion.govPrice)); if (suggestion.date) setDate(String(suggestion.date).slice(0, 10)); }} style={btn(true)}>ใช้ค่านี้</button>
            </div>
          )}
          {needsArea && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[["rai", "ไร่"], ["ngan", "งาน"], ["wa", "ตร.ว."]].map(([key, label]) => (
                <div key={key}>
                  <label style={lbl}>เนื้อที่: {label} *</label>
                  <input type="number" min="0" step={key === "wa" ? "any" : "1"} value={area[key]} onChange={e => setArea(a => ({ ...a, [key]: e.target.value }))} style={inp} placeholder="0" />
                </div>
              ))}
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
              {preview !== null
                ? <>รวมแปลงนี้ <b style={{ color: BRAND.teal }}>{money(preview)} ฿</b> ({money(enteredWa)} ตร.ว.)</>
                : needsArea && !(enteredWa > 0) ? "ต้องกรอกเนื้อที่โฉนดก่อนจึงคำนวณได้" : "กรอกราคาต่อตารางวาเพื่อคำนวณ"}
              {" · "}<a href="https://assessprice.treasury.go.th/" target="_blank" rel="noreferrer" style={{ color: BRAND.teal }}>ตรวจราคากรมธนารักษ์</a>
            </span>
            <button type="button" onClick={handleSave} disabled={!canSave} style={{ ...btn(true), fontWeight: 700, opacity: canSave ? 1 : 0.5, cursor: canSave ? "pointer" : "not-allowed" }}>
              {saving ? "⏳ กำลังบันทึก..." : "✓ บันทึก"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

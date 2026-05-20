import React from "react";
import { BRAND } from "../lib/config.js";

// ── ข้อมูลเพิ่มเติมลูกค้า (ที่อยู่, เลขสัญญา ฯลฯ) ──────────────
export function CustomerExtraInfoSection({ customer, extraInfoMap, onUpdate }) {
  const info = extraInfoMap[customer.id] || {};
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState(info);

  React.useEffect(() => {
    setForm(extraInfoMap[customer.id] || {});
  }, [extraInfoMap, customer.id]);

  const handleSave = () => {
    onUpdate(customer.id, form);
    setEditing(false);
  };

  const field = (key, label, placeholder = "") => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 10, color: BRAND.textSec }}>{label}</label>
      <input
        value={form[key] || ""}
        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{
          background: "rgba(255,255,255,.05)", border: "1px solid rgba(45,212,191,.2)",
          borderRadius: 7, color: BRAND.textPri, fontSize: 12, padding: "6px 10px", outline: "none",
        }}
      />
    </div>
  );

  const isComplete = info.fullName && info.address && info.contractNumber;

  return (
    <div style={{
      marginBottom: 16, padding: "12px 14px",
      background: isComplete ? "rgba(45,212,191,.04)" : "rgba(245,158,11,.04)",
      border: `1px solid ${isComplete ? "rgba(45,212,191,.2)" : "rgba(245,158,11,.2)"}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>📋</span>
          <span style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 13 }}>ข้อมูลสำหรับจดหมาย Notice</span>
          {!isComplete && <span style={{ fontSize: 10, color: "#F59E0B", background: "rgba(245,158,11,.15)", padding: "2px 8px", borderRadius: 20 }}>ยังไม่ครบ</span>}
        </div>
        <button onClick={() => setEditing(v => !v)} style={{
          background: "rgba(45,212,191,.1)", border: "1px solid rgba(45,212,191,.3)",
          borderRadius: 6, color: BRAND.teal, fontSize: 11, padding: "3px 10px", cursor: "pointer",
        }}>
          {editing ? "ยกเลิก" : isComplete ? "แก้ไข" : "+ กรอกข้อมูล"}
        </button>
      </div>

      {!editing && isComplete && (
        <div style={{ fontSize: 12, color: BRAND.textSec, display: "flex", flexDirection: "column", gap: 3 }}>
          <div><span style={{ color: BRAND.textPri }}>ชื่อ:</span> {info.fullName}</div>
          <div><span style={{ color: BRAND.textPri }}>ที่อยู่:</span> {info.address}</div>
          <div><span style={{ color: BRAND.textPri }}>เลขที่สัญญา:</span> {info.contractNumber} | <span style={{ color: BRAND.textPri }}>วันที่:</span> {info.contractDate || "-"}</div>
          {info.landOffice && <div><span style={{ color: BRAND.textPri }}>สำนักงานที่ดิน:</span> {info.landOffice}</div>}
        </div>
      )}
      {!editing && !isComplete && (
        <div style={{ fontSize: 12, color: BRAND.textSec }}>กรอกข้อมูลเพื่อใช้สร้างจดหมาย Notice</div>
      )}

      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {field("fullName", "ชื่อ-นามสกุลเต็ม (ผู้ขายฝาก)", "เช่น นายสมชาย ใจดี")}
          {field("address", "ที่อยู่สำหรับจ่าหน้าซอง", "เช่น 123 ถ.สุขุมวิท กรุงเทพฯ 10110")}
          {field("contractNumber", "เลขที่สัญญาขายฝาก", "เช่น ขฝ.2568/001")}
          {field("contractDate", "วันที่ทำสัญญา (YYYY-MM-DD)", "เช่น 2025-03-19")}
          {field("landOffice", "สำนักงานที่ดิน (ไม่บังคับ — ระบบใช้จากโฉนดอัตโนมัติ)", "เช่น สำนักงานที่ดินจังหวัดสมุทรสาคร")}
          <button onClick={handleSave} style={{
            padding: "8px 0", borderRadius: 8, marginTop: 4,
            background: "linear-gradient(135deg,#2DD4BF,#0E7490)",
            border: "none", color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>
            บันทึก
          </button>
        </div>
      )}
    </div>
  );
}


import React from "react";
import { BRAND } from "../lib/config.js";

// ── ข้อมูลเพิ่มเติมลูกค้า (ที่อยู่, เลขสัญญา ฯลฯ) ──────────────
export function CustomerExtraInfoSection({ customer, extraInfoMap, onUpdate }) {
  const info = extraInfoMap[customer.id] || {};
  const firstDeed = Array.isArray(customer.deeds) ? customer.deeds[0] || {} : {};
  const buildForm = React.useCallback((savedInfo) => ({
    ...savedInfo,
    titleDeedNumber: savedInfo.titleDeedNumber || firstDeed.no || "",
    landNumber: savedInfo.landNumber || firstDeed.landNo || "",
    surveyPage: savedInfo.surveyPage || firstDeed.surveyPage || "",
    subdistrict: savedInfo.subdistrict || firstDeed.tambon || "",
    district: savedInfo.district || firstDeed.amphoe || "",
    province: savedInfo.province || firstDeed.province || "",
    landArea: savedInfo.landArea || firstDeed.area || "",
  }), [firstDeed.no, firstDeed.landNo, firstDeed.surveyPage, firstDeed.tambon, firstDeed.amphoe, firstDeed.province, firstDeed.area]);
  const requiredValues = [
    info.fullName, info.sellerNationalId, info.address, info.contractNumber, info.contractDate,
    info.landOffice, info.redemptionAmount, info.buyerName, info.buyerNationalId, info.buyerAddress,
    info.titleDeedNumber || firstDeed.no,
    info.landNumber || firstDeed.landNo,
    info.subdistrict || firstDeed.tambon,
    info.district || firstDeed.amphoe,
    info.province || firstDeed.province,
  ];
  const completedCount = requiredValues.filter(value => String(value || "").trim()).length;
  const isComplete = completedCount === requiredValues.length;
  const [editing, setEditing] = React.useState(() => !isComplete);
  const [form, setForm] = React.useState(() => buildForm(info));

  React.useEffect(() => {
    setForm(buildForm(extraInfoMap[customer.id] || {}));
    setEditing(!isComplete);
  }, [extraInfoMap, customer.id, buildForm, isComplete]);

  const handleSave = () => {
    onUpdate(customer.id, form);
    setEditing(false);
  };

  const field = (key, label, placeholder = "", type = "text") => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 10, color: BRAND.textSec }}>{label}</label>
      <input
        type={type}
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

  const sectionLabel = (text) => (
    <div style={{ marginTop: 5, paddingBottom: 4, borderBottom: `1px solid ${BRAND.border}`, color: BRAND.teal, fontSize: 11, fontWeight: 700 }}>
      {text}
    </div>
  );

  return (
    <div style={{
      marginBottom: 16, padding: "12px 14px",
      background: isComplete ? "rgba(45,212,191,.04)" : "rgba(245,158,11,.04)",
      border: `1px solid ${isComplete ? "rgba(45,212,191,.2)" : "rgba(245,158,11,.2)"}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 14 }}>📋</span>
          <span style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 13 }}>ข้อมูลหนังสือแจ้งกำหนดไถ่</span>
          {!isComplete && <span style={{ fontSize: 10, color: "#F59E0B", background: "rgba(245,158,11,.15)", padding: "2px 8px", borderRadius: 20 }}>ข้อมูล {completedCount}/{requiredValues.length}</span>}
        </div>
        <button onClick={() => setEditing(v => !v)} style={{
          background: editing ? "transparent" : BRAND.teal,
          border: `1px solid ${BRAND.teal}`, borderRadius: 6,
          color: editing ? BRAND.teal : "#062723", fontSize: 11,
          fontWeight: 700, padding: "6px 12px", cursor: "pointer",
        }}>
          {editing ? "ย่อแบบฟอร์ม" : isComplete ? "แก้ไขข้อมูล" : "เปิดแบบฟอร์มกรอกข้อมูล"}
        </button>
      </div>

      {!editing && isComplete && (
        <div style={{ fontSize: 12, color: BRAND.textSec, display: "flex", flexDirection: "column", gap: 3 }}>
          <div><span style={{ color: BRAND.textPri }}>ชื่อ:</span> {info.fullName}</div>
          <div><span style={{ color: BRAND.textPri }}>ที่อยู่:</span> {info.address}</div>
          <div><span style={{ color: BRAND.textPri }}>เลขที่สัญญา:</span> {info.contractNumber} | <span style={{ color: BRAND.textPri }}>วันที่:</span> {info.contractDate || "-"}</div>
          {info.landOffice && <div><span style={{ color: BRAND.textPri }}>สำนักงานที่ดิน:</span> {info.landOffice}</div>}
          <div><span style={{ color: BRAND.textPri }}>จำนวนสินไถ่:</span> {Number(info.redemptionAmount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</div>
          <div><span style={{ color: BRAND.textPri }}>ผู้ซื้อฝาก:</span> {info.buyerName}</div>
        </div>
      )}
      {!editing && !isComplete && (
        <div style={{ fontSize: 12, color: BRAND.textSec }}>กรอกข้อมูลคู่สัญญาและจำนวนสินไถ่ก่อนสร้างร่างหนังสือ</div>
      )}

      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sectionLabel("ผู้ขายฝากและผู้รับหนังสือ")}
          {field("fullName", "ชื่อ-นามสกุลเต็ม (ผู้ขายฝาก)", "เช่น นายสมชาย ใจดี")}
          {field("sellerNationalId", "เลขประจำตัวประชาชนผู้ขายฝาก", "เช่น 1-2345-67890-12-3")}
          {field("address", "ที่อยู่ผู้ขายฝากตามสัญญา", "เช่น บ้านเลขที่ 123 ถนน... จังหวัด... 10110")}

          {sectionLabel("สัญญาและจำนวนสินไถ่")}
          {field("contractNumber", "เลขที่สัญญาขายฝาก", "เช่น ขฝ.2568/001")}
          {field("contractDate", "วันที่ทำสัญญา", "", "date")}
          {field("contractTerm", "กำหนดเวลาไถ่ (ไม่กรอกได้ ระบบคำนวณจากวันครบสัญญา)", "เช่น 1 ปี")}
          {field("redemptionAmount", "จำนวนสินไถ่ตามสัญญา (บาท)", "ตรวจสอบยอดจากสัญญาก่อนพิมพ์", "number")}
          <div style={{ fontSize: 10, color: "#F59E0B", lineHeight: 1.5 }}>
            จำนวนสินไถ่เป็นข้อมูลสำคัญ ระบบจะไม่คำนวณแทนโดยอัตโนมัติ กรุณาตรวจสอบกับสัญญาฉบับจริง
          </div>
          {field("landOffice", "สำนักงานที่ดินที่จดทะเบียน", "เช่น สำนักงานที่ดินกรุงเทพมหานคร สาขาหนองแขม")}
          {field("paymentLocation", "สถานที่ดำเนินการไถ่ (ไม่กรอกได้ ใช้สำนักงานที่ดินด้านบน)", "")}

          {sectionLabel("ข้อมูลโฉนดที่ใช้ในหนังสือ")}
          {field("titleDeedNumber", "เลขที่โฉนด", "เช่น 43603")}
          {field("landNumber", "เลขที่ดิน", "เช่น 835")}
          {field("surveyPage", "หน้าสำรวจ (ถ้ามี)", "เช่น 41013")}
          {field("subdistrict", "ตำบล / แขวง", "เช่น หนองแขม")}
          {field("district", "อำเภอ / เขต", "เช่น หนองแขม")}
          {field("province", "จังหวัด", "เช่น กรุงเทพมหานคร")}
          {field("landArea", "เนื้อที่ รูปแบบ ไร่-งาน-ตารางวา", "เช่น 0-0-60.2")}
          {field("buildingDetails", "รายละเอียดสิ่งปลูกสร้าง (ถ้ามี)", "เช่น บ้านเลขที่ 123 ขนาด 204 ตารางเมตร")}

          {sectionLabel("ผู้ซื้อฝากและผู้ลงนาม")}
          {field("buyerName", "ชื่อ-นามสกุลผู้ซื้อฝาก", "เช่น นายสมหมาย ใจดี")}
          {field("buyerNationalId", "เลขประจำตัวประชาชนผู้ซื้อฝาก", "เช่น 1-2345-67890-12-3")}
          {field("buyerAddress", "ที่อยู่ผู้ซื้อฝาก / สถานที่ทำหนังสือ", "เช่น บ้านเลขที่ 345/34 ...")}
          {field("noticeDate", "วันที่ออกหนังสือ (ไม่กรอกได้ ใช้วันที่ปัจจุบัน)", "", "date")}
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


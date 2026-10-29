import React from "react";
import { showToast } from "../lib/toast.js";
import { BRAND } from "../lib/config.js";
import { formatThai } from "../lib/utils.js";
import { postponePayment as apiPostponePayment, postponeTopupPayment as apiPostponeTopupPayment } from "../lib/api.js";

// ── Modal เลื่อนนัดชำระ ──────────────────────────────────────────
// ส่ง topup มาด้วยเมื่อเป็นงวดของวงเงินเพิ่ม (ตารางชำระอยู่ใน contract_topups.payments ไม่ใช่ตาราง payments)
export function PostponeModal({ customer, payment, topup = null, onSave, onClose }) {
  const [newDate, setNewDate] = React.useState(payment.dateStr || "");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const inp = { width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${BRAND.border}`, borderRadius: 8, color: BRAND.textPri, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box" };
  const lbl = { fontSize: 11, color: BRAND.textSec, display: "block", marginBottom: 4, marginTop: 10 };

  const handleSave = async () => {
    if (!newDate) return;
    setSaving(true);
    try {
      if (topup) await apiPostponeTopupPayment(topup.id, payment.installment, newDate, note);
      else await apiPostponePayment(customer.id, payment.installment, newDate, note);
      onSave({ newDate, note });
    } catch (e) {
      showToast("เกิดข้อผิดพลาด: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 16, padding: 24, maxWidth: 380, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: BRAND.textPri }}>{topup ? "📅 เลื่อนนัดชำระวงเงินเพิ่ม" : "📅 เลื่อนนัดชำระ"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: BRAND.textSec, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: BRAND.textPri, fontWeight: 600 }}>{customer.name}</div>
          {topup && (
            <div style={{ fontSize: 12, color: BRAND.gold, marginTop: 2 }}>
              💵 วงเงินเพิ่ม +{Number(topup.topupAmount || 0).toLocaleString("th-TH")} ฿ · ดอกเบี้ย {Number(topup.interestAmount || 0).toLocaleString("th-TH")} ฿/{topup.freq || "งวด"}
            </div>
          )}
          <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 2 }}>
            งวดที่ {payment.installment} · กำหนดเดิม: <span style={{ color: BRAND.gold }}>{formatThai(payment.dateStr)}</span>
          </div>
          {payment.postponedFrom && (
            <div style={{ fontSize: 11, color: BRAND.textMut, marginTop: 2 }}>
              (เลื่อนจากต้น: {formatThai(payment.postponedFrom)})
            </div>
          )}
        </div>

        <label style={lbl}>วันนัดใหม่ *</label>
        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inp} />

        <label style={lbl}>เหตุผล / บันทึก</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="เช่น ลูกค้าขอเลื่อน 7 วัน, ติดธุระ..."
          rows={3}
          style={{ ...inp, resize: "vertical", fontFamily: "inherit" }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${BRAND.border}`, background: "transparent", color: BRAND.textSec, fontSize: 13, cursor: "pointer" }}>
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={!newDate || saving}
            style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none", background: newDate ? BRAND.gold : "rgba(245,158,11,.3)", color: "#000", fontSize: 13, fontWeight: 700, cursor: newDate ? "pointer" : "not-allowed" }}
          >
            {saving ? "⏳ กำลังบันทึก..." : "📅 บันทึกการเลื่อน"}
          </button>
        </div>
      </div>
    </div>
  );
}


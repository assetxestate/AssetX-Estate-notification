import React, { useState, useMemo } from "react";
import { BRAND } from "../lib/config.js";
import { formatMoney, formatThai } from "../lib/utils.js";
import { renewContract as apiRenewContract } from "../lib/api.js";

function generateRenewalSchedule(lastDateStr, freq, newEndDateStr, lastInstallment) {
  const payments = [];
  if (!lastDateStr || !newEndDateStr) return payments;

  const addFreq = (d) => {
    const next = new Date(d);
    if (freq === "สัปดาห์") next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
    return next;
  };

  const end = new Date(newEndDateStr);
  let current = addFreq(new Date(lastDateStr));
  let installment = lastInstallment + 1;

  while (current <= end && installment <= lastInstallment + 360) {
    payments.push({ installment, dateStr: current.toISOString().split("T")[0] });
    current = addFreq(current);
    installment++;
  }
  return payments;
}

export function RenewContractModal({ customer, onClose, onSaved }) {
  const lastPayment = useMemo(() =>
    [...(customer.payments || [])].sort((a, b) => b.installment - a.installment)[0] ?? null,
    [customer.payments]
  );

  const [newEndDate, setNewEndDate] = useState(customer.contractEndDate || "");
  const [saving, setSaving] = useState(false);

  const newPayments = useMemo(() => {
    if (!lastPayment || !newEndDate) return [];
    return generateRenewalSchedule(
      lastPayment.dateStr,
      customer.freq || "เดือน",
      newEndDate,
      lastPayment.installment
    );
  }, [lastPayment, newEndDate, customer.freq]);

  const handleSave = async () => {
    if (!newEndDate) { alert("กรุณาระบุวันครบสัญญาใหม่"); return; }
    if (newPayments.length === 0) { alert("วันที่เลือกต้องอยู่หลังจากงวดสุดท้าย"); return; }
    setSaving(true);
    try {
      await apiRenewContract(customer.id, { newEndDate, newPayments });
      onSaved(newEndDate, newPayments);
    } catch (e) {
      alert("เกิดข้อผิดพลาด: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = { width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13, background: "rgba(255,255,255,0.05)", border: `1px solid ${BRAND.border}`, color: BRAND.textPri, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 18, padding: 20, width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: BRAND.textPri }}>🔄 ต่ออายุสัญญา</div>
            <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 2 }}>{customer.name}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: BRAND.textSec, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        {/* สัญญาปัจจุบัน */}
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(45,212,191,.06)", border: "1px solid rgba(45,212,191,.2)", borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: BRAND.teal, fontWeight: 700, marginBottom: 8 }}>📋 สัญญาปัจจุบัน</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 16px", fontSize: 12 }}>
            <span style={{ color: BRAND.textSec }}>วงเงิน</span>
            <span style={{ color: BRAND.textPri, fontWeight: 700 }}>{formatMoney(customer.principal || 0)} ฿</span>
            <span style={{ color: BRAND.textSec }}>ดอกเบี้ย/งวด</span>
            <span style={{ color: BRAND.gold, fontWeight: 700 }}>{formatMoney(customer.amount || 0)} ฿/{customer.freq}</span>
            <span style={{ color: BRAND.textSec }}>งวดสุดท้าย</span>
            <span style={{ color: BRAND.textPri }}>
              งวดที่ {lastPayment?.installment} · {formatThai(lastPayment?.dateStr)}
            </span>
            <span style={{ color: BRAND.textSec }}>ครบสัญญาเดิม</span>
            <span style={{ color: "#FCA5A5", fontWeight: 600 }}>{formatThai(customer.contractEndDate)}</span>
          </div>
        </div>

        {/* วันครบสัญญาใหม่ */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.gold, marginBottom: 10 }}>📅 ต่ออายุถึงวันที่</div>
          <input type="date" style={inp} value={newEndDate}
            onChange={e => setNewEndDate(e.target.value)}
            min={lastPayment?.dateStr || ""} />
        </div>

        {/* Preview งวดใหม่ */}
        {newPayments.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ padding: "8px 12px", background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 8, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: BRAND.textSec }}>งวดใหม่ที่จะเพิ่ม</span>
              <div>
                <span style={{ color: BRAND.gold, fontWeight: 700 }}>+{newPayments.length} งวด</span>
                <span style={{ fontSize: 11, color: BRAND.textSec, marginLeft: 8 }}>
                  ({formatMoney(newPayments.length * (customer.amount || 0))} ฿)
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
              {newPayments.slice(0, 6).map(p => (
                <div key={p.installment} style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", background: "rgba(245,158,11,.04)", borderRadius: 6, fontSize: 12 }}>
                  <span style={{ color: BRAND.textSec }}>งวดที่ {p.installment}</span>
                  <span style={{ color: BRAND.textPri }}>{formatThai(p.dateStr)}</span>
                  <span style={{ color: BRAND.gold }}>{formatMoney(customer.amount || 0)} ฿</span>
                </div>
              ))}
              {newPayments.length > 6 && (
                <div style={{ textAlign: "center", fontSize: 11, color: BRAND.textMut, padding: "4px 0" }}>
                  ...และอีก {newPayments.length - 6} งวด
                </div>
              )}
            </div>
          </div>
        )}

        {newEndDate && newPayments.length === 0 && (
          <div style={{ marginBottom: 16, padding: "8px 12px", background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 8, fontSize: 12, color: "#FCA5A5" }}>
            วันที่เลือกต้องอยู่หลังงวดสุดท้าย ({formatThai(lastPayment?.dateStr)})
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${BRAND.border}`, background: "transparent", color: BRAND.textSec, fontSize: 13, cursor: "pointer" }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving || newPayments.length === 0}
            style={{ flex: 2, padding: 10, borderRadius: 10, border: "none", background: newPayments.length > 0 ? "linear-gradient(135deg,#F59E0B,#D97706)" : "rgba(245,158,11,.3)", color: "#000", fontSize: 13, fontWeight: 700, cursor: newPayments.length > 0 ? "pointer" : "not-allowed", opacity: saving ? 0.7 : 1 }}>
            {saving ? "⏳ กำลังบันทึก..."
              : newPayments.length > 0
              ? `🔄 ต่ออายุ +${newPayments.length} งวด`
              : "🔄 ต่ออายุสัญญา"}
          </button>
        </div>
      </div>
    </div>
  );
}

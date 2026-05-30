import React, { useState, useMemo } from "react";
import { BRAND } from "../lib/config.js";
import { formatMoney, formatThai } from "../lib/utils.js";

export function AdvancePaymentModal({ customer, onClose, onSaved }) {
  // งวดที่ยังไม่ชำระทั้งหมด (รวม overdue และอนาคต)
  const unpaidPayments = useMemo(() =>
    (customer.payments || [])
      .filter(p => !p.record)
      .sort((a, b) => a.installment - b.installment),
    [customer.payments]
  );

  const [selected, setSelected] = useState(new Set());
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("ชำระล่วงหน้า");
  const [saving, setSaving] = useState(false);

  const toggle = (n) =>
    setSelected(prev => {
      const s = new Set(prev);
      s.has(n) ? s.delete(n) : s.add(n);
      return s;
    });

  const selectedList = unpaidPayments.filter(p => selected.has(p.installment));
  const lastDate = selectedList.at(-1)?.dateStr ?? null;
  const totalAmount = selected.size * (customer.amount || 0);

  const handleSave = async () => {
    if (selected.size === 0) { alert("กรุณาเลือกงวดที่ต้องการชำระ"); return; }
    if (!paidDate) { alert("กรุณาระบุวันที่ชำระ"); return; }
    setSaving(true);
    try {
      await onSaved(customer.id, Array.from(selected), {
        paidDate,
        amountPaid: customer.amount || 0,
        note: note || "ชำระล่วงหน้า",
      });
    } finally {
      setSaving(false);
    }
  };

  const inp = { width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13, background: "rgba(255,255,255,0.05)", border: `1px solid ${BRAND.border}`, color: BRAND.textPri, outline: "none", boxSizing: "border-box" };
  const lbl = { fontSize: 11, color: BRAND.textSec, marginBottom: 4, display: "block" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 12px 12px" }}>
      <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 18, padding: 20, width: "100%", maxWidth: 500, maxHeight: "92vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: BRAND.textPri }}>💰 ชำระดอกเบี้ยล่วงหน้า</div>
            <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 2 }}>
              {customer.name} · {formatMoney(customer.amount)} ฿/{customer.freq}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: BRAND.textSec, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        {/* Summary */}
        {selected.size > 0 && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(45,212,191,.08)", border: "1px solid rgba(45,212,191,.3)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ color: BRAND.teal, fontWeight: 800, fontSize: 15 }}>{selected.size} งวด</span>
              {lastDate && (
                <span style={{ color: BRAND.textSec, fontSize: 11, marginLeft: 8 }}>
                  ถึงงวดที่ {selectedList.at(-1)?.installment} · {formatThai(lastDate)}
                </span>
              )}
            </div>
            <span style={{ color: BRAND.gold, fontWeight: 800, fontSize: 16 }}>{formatMoney(totalAmount)} ฿</span>
          </div>
        )}

        {/* รายการงวด */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.textSec }}>เลือกงวดที่ต้องการชำระ</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setSelected(new Set(unpaidPayments.map(p => p.installment)))}
                style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: `1px solid ${BRAND.border}`, background: "transparent", color: BRAND.teal, cursor: "pointer" }}>
                เลือกทั้งหมด
              </button>
              <button onClick={() => setSelected(new Set())}
                style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: `1px solid ${BRAND.border}`, background: "transparent", color: BRAND.textSec, cursor: "pointer" }}>
                ล้าง
              </button>
            </div>
          </div>

          {unpaidPayments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: BRAND.textMut, fontSize: 13 }}>
              ไม่มีงวดที่รอชำระ
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
              {unpaidPayments.map(p => {
                const on = selected.has(p.installment);
                const isOverdue = p.diff < 0;
                const isToday = p.diff === 0;
                const isSoon = p.diff > 0 && p.diff <= 7;
                return (
                  <div key={p.installment} onClick={() => toggle(p.installment)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer", background: on ? "rgba(45,212,191,.1)" : "rgba(255,255,255,.03)", border: `1px solid ${on ? "rgba(45,212,191,.4)" : BRAND.border}`, transition: "all .15s" }}>
                    {/* Checkbox */}
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${on ? BRAND.teal : BRAND.textMut}`, background: on ? BRAND.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .15s" }}>
                      {on && <span style={{ color: "#000", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: on ? BRAND.teal : BRAND.textPri }}>
                        งวดที่ {p.installment}
                      </span>
                      <span style={{ fontSize: 11, color: BRAND.textSec, marginLeft: 8 }}>{formatThai(p.dateStr)}</span>
                      {isOverdue && <span style={{ fontSize: 10, color: "#FCA5A5", marginLeft: 6 }}>เกิน {Math.abs(p.diff)} วัน</span>}
                      {isToday && <span style={{ fontSize: 10, color: "#FCA5A5", marginLeft: 6 }}>วันนี้!</span>}
                      {isSoon && <span style={{ fontSize: 10, color: "#FCD34D", marginLeft: 6 }}>อีก {p.diff} วัน</span>}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.gold }}>{formatMoney(customer.amount || 0)} ฿</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* วันที่ชำระ + หมายเหตุ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div>
            <label style={lbl}>วันที่ชำระ *</label>
            <input type="date" style={inp} value={paidDate} onChange={e => setPaidDate(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>หมายเหตุ</label>
            <input type="text" style={inp} value={note} onChange={e => setNote(e.target.value)} placeholder="ชำระล่วงหน้า" />
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${BRAND.border}`, background: "transparent", color: BRAND.textSec, fontSize: 13, cursor: "pointer" }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving || selected.size === 0}
            style={{ flex: 2, padding: 10, borderRadius: 10, border: "none", background: selected.size > 0 ? "linear-gradient(135deg,#2DD4BF,#0E7490)" : "rgba(45,212,191,.25)", color: "#000", fontSize: 13, fontWeight: 700, cursor: selected.size > 0 ? "pointer" : "not-allowed", opacity: saving ? 0.7 : 1 }}>
            {saving ? "⏳ กำลังบันทึก..."
              : selected.size > 0
              ? `💰 บันทึก ${selected.size} งวด · ${formatMoney(totalAmount)} ฿`
              : "💰 บันทึกชำระล่วงหน้า"}
          </button>
        </div>
      </div>
    </div>
  );
}

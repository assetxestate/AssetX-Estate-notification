import React, { useState, useMemo } from "react";
import { BRAND } from "../lib/config.js";
import { formatMoney, formatThai } from "../lib/utils.js";
import { createTopup } from "../lib/api.js";

export function TopupModal({ customer, onClose, onSaved }) {
  // งวดที่ยังไม่ได้ชำระของสัญญาหลัก — ใช้เป็น schedule ของวงเงินเพิ่ม
  const availablePayments = useMemo(() =>
    (customer.payments || [])
      .filter(p => !p.record)
      .sort((a, b) => a.installment - b.installment),
    [customer.payments]
  );

  const [form, setForm] = useState({
    topupDate: new Date().toISOString().split("T")[0],
    topupAmount: "",
    interestAmount: "",
    startInstallment: availablePayments[0]?.installment ?? 1,
    approvedBy: "",
    reason: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const topupAmt = parseFloat(form.topupAmount) || 0;
  const totalPrincipal = (customer.principal || 0) + topupAmt;

  // schedule อิงวันที่ตามสัญญาหลัก ตั้งแต่งวดที่เลือก
  const schedule = useMemo(() =>
    availablePayments
      .filter(p => p.installment >= Number(form.startInstallment))
      .map((p, idx) => ({ installment: idx + 1, dateStr: p.dateStr })),
    [availablePayments, form.startInstallment]
  );

  const handleSave = async () => {
    if (!topupAmt) { alert("กรุณากรอกจำนวนเงินที่ขอเพิ่ม"); return; }
    if (!parseFloat(form.interestAmount)) { alert("กรุณากรอกดอกเบี้ยต่องวด"); return; }
    if (schedule.length === 0) { alert("ไม่มีงวดที่เหลือในสัญญาหลัก"); return; }
    setSaving(true);
    try {
      await createTopup({
        customerId: customer.id,
        topupDate: form.topupDate,
        topupAmount: topupAmt,
        originalPrincipal: customer.principal || 0,
        totalPrincipal,
        interestAmount: parseFloat(form.interestAmount),
        freq: customer.freq || "เดือน",
        topupStartDate: schedule[0].dateStr,
        topupEndDate: schedule[schedule.length - 1].dateStr,
        approvedBy: form.approvedBy,
        reason: form.reason,
        note: form.note,
        payments: schedule,
      });
      onSaved();
    } catch (e) {
      alert("บันทึกไม่สำเร็จ: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = {
    width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13,
    background: "rgba(255,255,255,0.05)", border: `1px solid ${BRAND.border}`,
    color: BRAND.textPri, outline: "none", boxSizing: "border-box",
  };
  const lbl = { fontSize: 11, color: BRAND.textSec, marginBottom: 4, display: "block" };
  const row2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 12px 12px" }}>
      <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 18, padding: 20, width: "100%", maxWidth: 500, maxHeight: "92vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: BRAND.textPri }}>➕ เพิ่มวงเงินจำนอง</div>
            <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 2 }}>{customer.name}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: BRAND.textSec, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        {/* สัญญาเดิม */}
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(45,212,191,.06)", border: "1px solid rgba(45,212,191,.2)", borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: BRAND.teal, fontWeight: 700, marginBottom: 8 }}>📋 สัญญาเดิม</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 16px", fontSize: 12 }}>
            <span style={{ color: BRAND.textSec }}>วงเงินเดิม</span>
            <span style={{ color: BRAND.textPri, fontWeight: 700 }}>{formatMoney(customer.principal || 0)} ฿</span>
            <span style={{ color: BRAND.textSec }}>ดอกเบี้ย/งวดเดิม</span>
            <span style={{ color: BRAND.gold, fontWeight: 700 }}>{formatMoney(customer.amount || 0)} ฿/{customer.freq}</span>
            <span style={{ color: BRAND.textSec }}>งวดที่เหลือ</span>
            <span style={{ color: BRAND.textPri }}>{availablePayments.length} งวด</span>
          </div>
        </div>

        {availablePayments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: BRAND.textMut, fontSize: 13 }}>
            ไม่มีงวดที่เหลือในสัญญาหลัก — ไม่สามารถเพิ่มวงเงินได้
          </div>
        ) : (
          <>
            {/* วงเงินที่ขอเพิ่ม */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.gold, marginBottom: 10 }}>💵 วงเงินที่ขอเพิ่ม</div>
              <div style={row2}>
                <div>
                  <label style={lbl}>จำนวนเงินที่ขอเพิ่ม (บาท) *</label>
                  <input type="number" style={inp} value={form.topupAmount}
                    onChange={e => set("topupAmount", e.target.value)} placeholder="700000" />
                </div>
                <div>
                  <label style={lbl}>วันที่ทำสัญญาเพิ่มวงเงิน</label>
                  <input type="date" style={inp} value={form.topupDate}
                    onChange={e => set("topupDate", e.target.value)} />
                </div>
              </div>
              {topupAmt > 0 && (
                <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: BRAND.textSec }}>วงเงินรวมใหม่</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: BRAND.gold }}>{formatMoney(totalPrincipal)} ฿</span>
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <label style={lbl}>เหตุผลที่ขอเพิ่ม</label>
                <input type="text" style={inp} value={form.reason}
                  onChange={e => set("reason", e.target.value)} placeholder="เช่น ต้องการทุนเพิ่มเติม" />
              </div>
            </div>

            {/* เงื่อนไขชำระ */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.teal, marginBottom: 10 }}>💰 เงื่อนไขชำระส่วนเพิ่ม</div>
              <div style={row2}>
                <div>
                  <label style={lbl}>ดอกเบี้ยต่องวด (บาท) *</label>
                  <input type="number" style={inp} value={form.interestAmount}
                    onChange={e => set("interestAmount", e.target.value)} placeholder="เช่น 10500" />
                </div>
                <div>
                  <label style={lbl}>รอบชำระ</label>
                  <div style={{ ...inp, display: "flex", alignItems: "center", color: BRAND.textSec }}>
                    {customer.freq || "เดือน"} (อิงสัญญาหลัก)
                  </div>
                </div>
              </div>

              {/* เลือกเริ่มเก็บจากงวดใด */}
              <div style={{ marginTop: 10 }}>
                <label style={lbl}>เริ่มเก็บดอกเบี้ยส่วนเพิ่มตั้งแต่งวดที่</label>
                <select style={inp} value={form.startInstallment}
                  onChange={e => set("startInstallment", e.target.value)}>
                  {availablePayments.map(p => (
                    <option key={p.installment} value={p.installment}>
                      งวดที่ {p.installment} — {formatThai(p.dateStr)}
                    </option>
                  ))}
                </select>
              </div>

              {/* สรุป schedule */}
              {schedule.length > 0 && (
                <div style={{ marginTop: 8, padding: "7px 12px", background: "rgba(45,212,191,.05)", border: "1px solid rgba(45,212,191,.15)", borderRadius: 8, fontSize: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span style={{ color: BRAND.textSec }}>จำนวน: <span style={{ color: BRAND.teal, fontWeight: 700 }}>{schedule.length} งวด</span></span>
                  <span style={{ color: BRAND.textSec }}>งวดแรก: <span style={{ color: BRAND.teal, fontWeight: 700 }}>{formatThai(schedule[0].dateStr)}</span></span>
                  <span style={{ color: BRAND.textSec }}>งวดสุดท้าย: <span style={{ color: BRAND.teal, fontWeight: 700 }}>{formatThai(schedule[schedule.length - 1].dateStr)}</span></span>
                </div>
              )}
            </div>

            {/* การอนุมัติ */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.textSec, marginBottom: 10 }}>👤 การอนุมัติ</div>
              <div style={row2}>
                <div>
                  <label style={lbl}>ผู้อนุมัติ</label>
                  <input type="text" style={inp} value={form.approvedBy}
                    onChange={e => set("approvedBy", e.target.value)} placeholder="ชื่อผู้อนุมัติ" />
                </div>
                <div>
                  <label style={lbl}>หมายเหตุ</label>
                  <input type="text" style={inp} value={form.note}
                    onChange={e => set("note", e.target.value)} placeholder="หมายเหตุเพิ่มเติม" />
                </div>
              </div>
            </div>

            {/* ตัวอย่าง 3 งวดแรก */}
            {schedule.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: BRAND.textSec, marginBottom: 6 }}>📅 ตัวอย่าง 3 งวดแรก (วันเดียวกับสัญญาหลัก)</div>
                {schedule.slice(0, 3).map(p => (
                  <div key={p.installment} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${BRAND.border}`, fontSize: 12 }}>
                    <span style={{ color: BRAND.textSec }}>งวดที่ {p.installment}</span>
                    <span style={{ color: BRAND.textPri }}>{formatThai(p.dateStr)}</span>
                    {form.interestAmount && (
                      <span style={{ color: BRAND.gold, fontWeight: 600 }}>{formatMoney(parseFloat(form.interestAmount) || 0)} ฿</span>
                    )}
                  </div>
                ))}
                {schedule.length > 3 && (
                  <div style={{ textAlign: "center", fontSize: 11, color: BRAND.textMut, paddingTop: 4 }}>
                    ...และอีก {schedule.length - 3} งวด
                  </div>
                )}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${BRAND.border}`, background: "transparent", color: BRAND.textSec, fontSize: 13, cursor: "pointer" }}>
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#2DD4BF,#0E7490)", color: "#000", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "⏳ กำลังบันทึก..." : "💾 บันทึกสัญญาเพิ่มวงเงิน"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import React from "react";
import { BRAND } from "../lib/config.js";
import { formatThai, formatMoney } from "../lib/utils.js";

// แถบใต้แถวงวด (สัญญาหลักหรือวงเงินเพิ่ม): ยอดค้างเมื่อจ่ายไม่ครบ + ประวัติชำระเพิ่ม/ยกเว้น + ปุ่มบันทึก
// availability: 'ready' | 'loading' | 'missing' (ยังไม่ได้รัน supabase_payment_additions.sql) | 'unauthorized' | 'error'
export function InstallmentBalance({ balance, additions = [], availability = "ready", onAddPayment, onWaive, onVoid }) {
  if (!balance || balance.state === "unpaid") return null;
  // บันทึกแรกไม่ครบแต่ยังโหลดรายการชำระเพิ่มไม่ได้ → ยังบอกไม่ได้ว่าขาดจริงไหม (ไม่ขึ้นว่าครบ ไม่ขึ้นว่าขาด)
  if (balance.unverified) {
    return (
      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 6, fontSize: 11, color: BRAND.textSec }}>
        บันทึกครั้งแรก {formatMoney(balance.paid)} / {formatMoney(balance.due)} บาท ·{" "}
        {availability === "loading" ? "กำลังตรวจรายการชำระเพิ่ม…" : availability === "unauthorized" ? "เซสชันหมดอายุ เข้าสู่ระบบใหม่เพื่อตรวจยอด" : "ตรวจรายการชำระเพิ่มไม่ได้ (ดูแถบเตือนในแท็บการชำระ)"}
      </div>
    );
  }
  const partial = balance.state === "partial";
  const showDone = !partial && (balance.paymentCount > 1 || balance.waived > 0 || balance.extra > 0);
  if (!partial && !showDone && additions.length === 0) return null;
  const canWrite = availability === "ready";
  const button = (label, onClick, tone = BRAND.teal) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      disabled={!canWrite}
      style={{
        padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
        cursor: canWrite ? "pointer" : "not-allowed", opacity: canWrite ? 1 : 0.5,
        background: "rgba(45,212,191,.08)", border: `1px solid ${tone}`, color: tone,
      }}
    >{label}</button>
  );
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
      {partial && (
        <div style={{
          padding: "8px 10px", borderRadius: 8, fontSize: 12,
          background: "rgba(245,158,11,.10)", border: "1px solid rgba(245,158,11,.45)", color: "#FDE68A",
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontWeight: 700 }}>⚠️ ชำระไม่ครบ · ขาด {formatMoney(balance.outstanding)} บาท</span>
          <span style={{ color: BRAND.textSec }}>ชำระแล้ว {formatMoney(balance.paid)}{balance.waived > 0 ? ` · ยกเว้น ${formatMoney(balance.waived)}` : ""} / {formatMoney(balance.due)} บาท</span>
          <span style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
            {button("＋ ชำระเพิ่ม", onAddPayment)}
            {button("ยกเว้นส่วนที่ขาด", onWaive, "#FCD34D")}
          </span>
          {availability === "missing" && (
            <span style={{ flexBasis: "100%", fontSize: 11, color: "#FCA5A5" }}>
              ยังบันทึกชำระเพิ่มไม่ได้: ต้องรันไฟล์ supabase_payment_additions.sql ใน Supabase ก่อน (ใช้ปุ่มเลื่อนนัดเพื่อกำหนดวันชำระส่วนที่ขาดได้เลย)
            </span>
          )}
          {(availability === "error" || availability === "unauthorized") && (
            <span style={{ flexBasis: "100%", fontSize: 11, color: "#FCA5A5" }}>โหลดรายการชำระเพิ่มไม่สำเร็จ รีเฟรชหน้าเพื่อลองใหม่</span>
          )}
        </div>
      )}
      {showDone && (
        <div style={{ fontSize: 11, color: "#86EFAC" }}>
          ✓ ชำระครบ {formatMoney(balance.paid)} บาท
          {balance.paymentCount > 1 ? ` · ${balance.paymentCount} ครั้ง` : ""}
          {balance.waived > 0 ? ` · ยกเว้น ${formatMoney(balance.waived)} บาท` : ""}
          {balance.extra > 0 ? ` · เกินยอด ${formatMoney(balance.extra)} บาท` : ""}
        </div>
      )}
      {additions.map((a) => {
        const voided = Boolean(a.voidedAt);
        return (
          <div key={a.id} style={{
            padding: "5px 10px", borderRadius: 7, fontSize: 11,
            background: voided ? "rgba(148,163,184,.06)" : a.kind === "waiver" ? "rgba(245,158,11,.06)" : "rgba(34,197,94,.06)",
            border: `1px solid ${voided ? "rgba(148,163,184,.25)" : a.kind === "waiver" ? "rgba(245,158,11,.25)" : "rgba(34,197,94,.2)"}`,
            display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
            color: voided ? BRAND.textSec : undefined,
          }}>
            <span style={{ color: voided ? BRAND.textSec : a.kind === "waiver" ? "#FCD34D" : "#86EFAC", textDecoration: voided ? "line-through" : "none" }}>
              {a.kind === "waiver" ? "ยกเว้น" : "+ ชำระเพิ่ม"} {formatMoney(a.amount)} บาท
            </span>
            <span style={{ color: BRAND.textSec }}>{a.kind === "waiver" ? "บันทึก" : "วันที่"} {formatThai(a.paidAt)}</span>
            {a.note && <span style={{ color: BRAND.textSec }}>| {a.note}</span>}
            {a.slipUrl && (
              <a href={a.slipUrl} target="_blank" rel="noreferrer" style={{ color: BRAND.teal, textDecoration: "none" }}>🖼️ ดูสลิป</a>
            )}
            {voided
              ? <span style={{ color: "#FCA5A5" }}>ยกเลิกแล้ว{a.voidReason ? `: ${a.voidReason}` : ""}</span>
              : (
                <button type="button" disabled={!canWrite} onClick={(e) => { e.stopPropagation(); onVoid?.(a); }}
                  style={{ marginLeft: "auto", background: "none", border: "none", color: "#FCA5A5", fontSize: 11, cursor: canWrite ? "pointer" : "not-allowed", padding: 0 }}>
                  ยกเลิกรายการ
                </button>
              )}
          </div>
        );
      })}
    </div>
  );
}

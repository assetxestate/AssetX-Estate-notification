import React, { useState, useEffect, useMemo } from "react";
import {
  getReservations, createReservation,
  updateReservation, deleteReservation,
} from "./lib/api";

const BRAND = {
  teal: "#2DD4BF", gold: "#F59E0B", bg: "#050B18", bgCard: "#0D1B2E",
  border: "#0F2545", borderLt: "#162E56", textPri: "#F0F6FF",
  textSec: "#64748B", textMut: "#475569", success: "#10B981",
  danger: "#EF4444", purple: "#7C3AED", orange: "#F97316", blue: "#3B82F6",
};

const fmt = (n) => Number(n || 0).toLocaleString("th-TH");
const fmtDate = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
};
const daysUntil = (d) => {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / 86400000);
};

const STATUS_CONFIG = {
  "ถือครอง":      { color: BRAND.blue,    bg: "#3B82F622" },
  "หาผู้รับโอน":  { color: BRAND.gold,    bg: "#F59E0B22" },
  "โอนแล้ว":      { color: BRAND.success,  bg: "#10B98122" },
  "หมดอายุ":      { color: BRAND.danger,   bg: "#EF444422" },
};
const PROPERTY_TYPES = ["บ้านเดี่ยว", "ทาวน์โฮม", "คอนโดมิเนียม", "ที่ดิน", "อาคารพาณิชย์"];
const STATUSES = Object.keys(STATUS_CONFIG);

const EMPTY_FORM = {
  projectName: "", developer: "", propertyType: "คอนโดมิเนียม", unitNo: "",
  bookingPrice: "", depositPaid: "", downPaymentPaid: "", monthlyInstallment: "",
  bookingDate: "", transferDeadline: "", status: "ถือครอง",
  assignedTo: "", assignmentPrice: "", assignmentDate: "", assignmentFee: "",
  notes: "",
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: BRAND.textSec, bg: "#ffffff11" };
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}44`,
    }}>{status}</span>
  );
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: BRAND.bgCard, border: `1px solid ${BRAND.border}`,
      borderRadius: 10, padding: "14px 18px", borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, color: BRAND.textSec, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: BRAND.textMut, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function DeadlineChip({ date }) {
  const days = daysUntil(date);
  if (days === null) return null;
  const color = days < 0 ? BRAND.danger : days <= 30 ? BRAND.gold : days <= 90 ? BRAND.orange : BRAND.textSec;
  const label = days < 0 ? `เกินกำหนด ${Math.abs(days)} วัน` : days === 0 ? "ครบกำหนดวันนี้" : `อีก ${days} วัน`;
  return <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>;
}

function InputField({ label, name, form, onChange, type = "text", options, required }) {
  const style = {
    width: "100%", background: "#060d1a", border: `1px solid ${BRAND.border}`,
    borderRadius: 8, padding: "8px 12px", color: BRAND.textPri, fontSize: 13,
    outline: "none", boxSizing: "border-box",
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: BRAND.textSec, display: "block", marginBottom: 4 }}>
        {label}{required && <span style={{ color: BRAND.danger }}> *</span>}
      </label>
      {options ? (
        <select name={name} value={form[name]} onChange={onChange} style={style}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} name={name} value={form[name]} onChange={onChange} style={style} />
      )}
    </div>
  );
}

function ReservationModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item ? { ...EMPTY_FORM, ...item } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const totalCost = useMemo(() => {
    return (Number(form.depositPaid) || 0) + (Number(form.downPaymentPaid) || 0);
  }, [form.depositPaid, form.downPaymentPaid]);

  const profit = useMemo(() => {
    if (!form.assignmentPrice) return null;
    const fee = Number(form.assignmentFee) || 0;
    return (Number(form.assignmentPrice) || 0) - totalCost - fee;
  }, [form.assignmentPrice, form.assignmentFee, totalCost]);

  const handleSave = async () => {
    if (!form.projectName) return alert("กรุณากรอกชื่อโครงการ");
    setSaving(true);
    try {
      const payload = {
        ...form,
        bookingPrice: Number(form.bookingPrice) || 0,
        depositPaid: Number(form.depositPaid) || 0,
        downPaymentPaid: Number(form.downPaymentPaid) || 0,
        monthlyInstallment: Number(form.monthlyInstallment) || 0,
        assignmentPrice: Number(form.assignmentPrice) || 0,
        assignmentFee: Number(form.assignmentFee) || 0,
      };
      await onSave(payload);
      onClose();
    } catch (e) {
      alert("บันทึกไม่สำเร็จ: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000000cc", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: BRAND.bgCard, border: `1px solid ${BRAND.border}`,
        borderRadius: 14, width: "100%", maxWidth: 640, maxHeight: "90vh",
        overflowY: "auto", padding: 24,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: BRAND.textPri, marginBottom: 20 }}>
          {item ? "✏️ แก้ไขใบจอง" : "➕ เพิ่มใบจองใหม่"}
        </div>

        {/* ข้อมูลโครงการ */}
        <div style={{ fontSize: 11, color: BRAND.teal, fontWeight: 700, marginBottom: 10 }}>ข้อมูลโครงการ</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <InputField label="ชื่อโครงการ" name="projectName" form={form} onChange={handleChange} required />
          <InputField label="Developer" name="developer" form={form} onChange={handleChange} />
          <InputField label="ประเภท" name="propertyType" form={form} onChange={handleChange} options={PROPERTY_TYPES} />
          <InputField label="เลขยูนิต/แปลง" name="unitNo" form={form} onChange={handleChange} />
        </div>

        {/* การเงิน */}
        <div style={{ fontSize: 11, color: BRAND.gold, fontWeight: 700, marginBottom: 10, marginTop: 8 }}>การเงิน</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <InputField label="ราคาขายโครงการ (บาท)" name="bookingPrice" form={form} onChange={handleChange} type="number" />
          <InputField label="มัดจำที่จ่ายแล้ว (บาท)" name="depositPaid" form={form} onChange={handleChange} type="number" />
          <InputField label="ดาวน์สะสมที่จ่ายแล้ว (บาท)" name="downPaymentPaid" form={form} onChange={handleChange} type="number" />
          <InputField label="งวดดาวน์รายเดือน (บาท)" name="monthlyInstallment" form={form} onChange={handleChange} type="number" />
        </div>
        {totalCost > 0 && (
          <div style={{ fontSize: 12, color: BRAND.textSec, marginBottom: 12 }}>
            ต้นทุนรวมปัจจุบัน: <span style={{ color: BRAND.gold, fontWeight: 700 }}>{fmt(totalCost)} บาท</span>
          </div>
        )}

        {/* วันที่ */}
        <div style={{ fontSize: 11, color: BRAND.purple, fontWeight: 700, marginBottom: 10, marginTop: 8 }}>วันที่</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <InputField label="วันที่จอง" name="bookingDate" form={form} onChange={handleChange} type="date" />
          <InputField label="วันครบกำหนดโอน" name="transferDeadline" form={form} onChange={handleChange} type="date" />
        </div>

        {/* สถานะและการโอน */}
        <div style={{ fontSize: 11, color: BRAND.orange, fontWeight: 700, marginBottom: 10, marginTop: 8 }}>สถานะ & การโอนสิทธิ์</div>
        <InputField label="สถานะ" name="status" form={form} onChange={handleChange} options={STATUSES} />
        {(form.status === "หาผู้รับโอน" || form.status === "โอนแล้ว") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <InputField label="ชื่อผู้รับโอน" name="assignedTo" form={form} onChange={handleChange} />
            <InputField label="ราคาโอนสิทธิ์ (บาท)" name="assignmentPrice" form={form} onChange={handleChange} type="number" />
            <InputField label="ค่าธรรมเนียมโอน (บาท)" name="assignmentFee" form={form} onChange={handleChange} type="number" />
            <InputField label="วันที่โอน" name="assignmentDate" form={form} onChange={handleChange} type="date" />
          </div>
        )}
        {profit !== null && (
          <div style={{
            background: profit >= 0 ? "#10B98122" : "#EF444422",
            border: `1px solid ${profit >= 0 ? BRAND.success : BRAND.danger}44`,
            borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13,
            color: profit >= 0 ? BRAND.success : BRAND.danger,
          }}>
            {profit >= 0 ? "📈" : "📉"} กำไร/ขาดทุนประมาณการ: <strong>{fmt(profit)} บาท</strong>
            {profit > 0 && <span style={{ color: BRAND.textSec }}> · ภาษี ม.40(8) ประมาณ {fmt(profit * 0.1)} บาท (10%)</span>}
          </div>
        )}

        <InputField label="หมายเหตุ" name="notes" form={form} onChange={handleChange} />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={{
            padding: "9px 20px", borderRadius: 8, border: `1px solid ${BRAND.border}`,
            background: "transparent", color: BRAND.textSec, cursor: "pointer", fontSize: 13,
          }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "9px 20px", borderRadius: 8, border: "none",
            background: BRAND.teal, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13,
            opacity: saving ? 0.6 : 1,
          }}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
        </div>
      </div>
    </div>
  );
}

function PnLModal({ item, onClose }) {
  const totalCost = (item.depositPaid || 0) + (item.downPaymentPaid || 0);
  const revenue = item.assignmentPrice || 0;
  const fee = item.assignmentFee || 0;
  const profit = revenue - totalCost - fee;
  const tax = profit > 0 ? profit * 0.1 : 0;
  const netProfit = profit - tax;
  const roi = totalCost > 0 ? ((profit / totalCost) * 100).toFixed(1) : 0;

  const row = (label, val, color) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${BRAND.border}44`, fontSize: 13 }}>
      <span style={{ color: BRAND.textSec }}>{label}</span>
      <span style={{ color: color || BRAND.textPri, fontWeight: 600 }}>{val}</span>
    </div>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000000cc", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: BRAND.bgCard, border: `1px solid ${BRAND.border}`,
        borderRadius: 14, width: "100%", maxWidth: 400, padding: 24,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: BRAND.textPri, marginBottom: 4 }}>
          📊 P&L — {item.projectName}
        </div>
        <div style={{ fontSize: 11, color: BRAND.textSec, marginBottom: 20 }}>{item.unitNo}</div>

        {row("ราคาจอง (โครงการ)", `${fmt(item.bookingPrice)} บาท`)}
        {row("เงินมัดจำที่จ่าย", `${fmt(item.depositPaid)} บาท`, BRAND.danger)}
        {row("ดาวน์สะสมที่จ่าย", `${fmt(item.downPaymentPaid)} บาท`, BRAND.danger)}
        {row("ต้นทุนรวม", `${fmt(totalCost)} บาท`, BRAND.danger)}
        <div style={{ height: 8 }} />
        {row("ราคาโอนสิทธิ์", `${fmt(revenue)} บาท`, BRAND.success)}
        {row("ค่าธรรมเนียมโอน", `− ${fmt(fee)} บาท`, BRAND.orange)}
        <div style={{ height: 8 }} />
        {row("กำไรก่อนภาษี", `${fmt(profit)} บาท`, profit >= 0 ? BRAND.success : BRAND.danger)}
        {row("ภาษี ม.40(8) ≈10%", `− ${fmt(tax)} บาท`, BRAND.orange)}
        <div style={{ marginTop: 12, background: profit >= 0 ? "#10B98122" : "#EF444422", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: BRAND.textSec }}>กำไรสุทธิหลังภาษี (ประมาณการ)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: netProfit >= 0 ? BRAND.success : BRAND.danger }}>
            {fmt(netProfit)} บาท
          </div>
          <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 4 }}>ROI {roi}%</div>
        </div>

        <div style={{ fontSize: 10, color: BRAND.textMut, marginTop: 12 }}>
          * ภาษีเงินได้ ม.40(8) เป็นประมาณการเบื้องต้น ขึ้นอยู่กับรายได้อื่นของผู้ขาย
        </div>

        <button onClick={onClose} style={{
          marginTop: 16, width: "100%", padding: "9px 0", borderRadius: 8,
          border: `1px solid ${BRAND.border}`, background: "transparent",
          color: BRAND.textSec, cursor: "pointer", fontSize: 13,
        }}>ปิด</button>
      </div>
    </div>
  );
}

export default function ReservationPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | "add" | "edit" | "pnl"
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ทั้งหมด");
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setItems(await getReservations()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filterStatus === "ทั้งหมด") return items;
    return items.filter((i) => i.status === filterStatus);
  }, [items, filterStatus]);

  // KPIs
  const kpi = useMemo(() => {
    const active = items.filter((i) => i.status !== "โอนแล้ว" && i.status !== "หมดอายุ");
    const done = items.filter((i) => i.status === "โอนแล้ว");
    const expiring = active.filter((i) => { const d = daysUntil(i.transferDeadline); return d !== null && d <= 30; });
    const totalInvest = active.reduce((s, i) => s + (i.depositPaid || 0) + (i.downPaymentPaid || 0), 0);
    const totalProfit = done.reduce((s, i) => {
      const cost = (i.depositPaid || 0) + (i.downPaymentPaid || 0);
      return s + ((i.assignmentPrice || 0) - cost - (i.assignmentFee || 0));
    }, 0);
    return { total: items.length, active: active.length, done: done.length, expiring: expiring.length, totalInvest, totalProfit };
  }, [items]);

  const handleSave = async (data) => {
    if (selected) await updateReservation(selected.id, data);
    else await createReservation(data);
    await load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("ลบใบจองนี้?")) return;
    setDeleting(id);
    try { await deleteReservation(id); await load(); }
    catch (e) { alert("ลบไม่สำเร็จ: " + e.message); }
    finally { setDeleting(null); }
  };

  return (
    <div style={{ padding: "0 0 40px 0", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: BRAND.textPri, marginBottom: 4 }}>
            🏷️ ระบบใบจอง
          </div>
          <div style={{ fontSize: 13, color: BRAND.textSec }}>
            ติดตามการซื้อขายสิทธิ์ใบจองโครงการอสังหาริมทรัพย์
          </div>
        </div>
        <button onClick={() => { setSelected(null); setModal("add"); }} style={{
          padding: "9px 18px", borderRadius: 8, border: "none",
          background: BRAND.teal, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13,
        }}>+ เพิ่มใบจอง</button>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard label="ใบจองทั้งหมด" value={kpi.total} color={BRAND.blue} />
        <KpiCard label="กำลังถือครอง" value={kpi.active} color={BRAND.gold} />
        <KpiCard label="โอนแล้ว" value={kpi.done} color={BRAND.success} />
        <KpiCard label="ใกล้หมดอายุ ≤30 วัน" value={kpi.expiring} color={BRAND.danger} />
        <KpiCard label="กำไรสะสม" value={`${fmt(kpi.totalProfit)} ฿`} color={kpi.totalProfit >= 0 ? BRAND.success : BRAND.danger} sub={`ลงทุนค้าง ${fmt(kpi.totalInvest)} ฿`} />
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["ทั้งหมด", ...STATUSES].map((s) => {
          const cfg = STATUS_CONFIG[s];
          const active = filterStatus === s;
          return (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: "pointer", border: `1px solid ${cfg ? cfg.color + "55" : BRAND.border}`,
              background: active ? (cfg ? cfg.bg : "#ffffff11") : "transparent",
              color: cfg ? cfg.color : (active ? BRAND.textPri : BRAND.textSec),
            }}>{s}</button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", color: BRAND.textSec, padding: 40 }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", color: BRAND.textSec, padding: 60,
          background: BRAND.bgCard, borderRadius: 12, border: `1px solid ${BRAND.border}`,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div>ยังไม่มีใบจอง</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((item) => {
            const cost = (item.depositPaid || 0) + (item.downPaymentPaid || 0);
            const profit = item.assignmentPrice ? item.assignmentPrice - cost - (item.assignmentFee || 0) : null;
            const days = daysUntil(item.transferDeadline);
            const urgent = days !== null && days <= 30 && item.status !== "โอนแล้ว" && item.status !== "หมดอายุ";

            return (
              <div key={item.id} style={{
                background: BRAND.bgCard, border: `1px solid ${urgent ? BRAND.danger + "88" : BRAND.border}`,
                borderRadius: 12, padding: "16px 20px",
                borderLeft: `3px solid ${STATUS_CONFIG[item.status]?.color || BRAND.border}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: BRAND.textPri }}>{item.projectName}</span>
                      {item.unitNo && <span style={{ fontSize: 11, color: BRAND.textSec }}>#{item.unitNo}</span>}
                      <StatusBadge status={item.status} />
                      <span style={{ fontSize: 11, color: BRAND.textSec, background: "#ffffff0a", padding: "2px 8px", borderRadius: 6 }}>
                        {item.propertyType}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12, color: BRAND.textSec }}>
                      {item.developer && <span>🏢 {item.developer}</span>}
                      <span>💰 ราคาจอง <strong style={{ color: BRAND.textPri }}>{fmt(item.bookingPrice)}</strong> บาท</span>
                      <span>📥 ต้นทุน <strong style={{ color: BRAND.gold }}>{fmt(cost)}</strong> บาท</span>
                      {item.monthlyInstallment > 0 && <span>📅 งวด <strong style={{ color: BRAND.textPri }}>{fmt(item.monthlyInstallment)}</strong>/เดือน</span>}
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: BRAND.textSec, alignItems: "center" }}>
                      {item.transferDeadline && (
                        <>
                          <span>📆 ครบกำหนด {fmtDate(item.transferDeadline)}</span>
                          <DeadlineChip date={item.transferDeadline} />
                        </>
                      )}
                      {item.assignedTo && <span>👤 {item.assignedTo}</span>}
                      {profit !== null && (
                        <span style={{ color: profit >= 0 ? BRAND.success : BRAND.danger, fontWeight: 700 }}>
                          {profit >= 0 ? "📈" : "📉"} {fmt(profit)} บาท
                        </span>
                      )}
                    </div>
                    {item.notes && <div style={{ fontSize: 11, color: BRAND.textMut, marginTop: 6 }}>📝 {item.notes}</div>}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, marginLeft: 12, flexShrink: 0 }}>
                    {item.assignmentPrice > 0 && (
                      <button onClick={() => { setSelected(item); setModal("pnl"); }} style={{
                        padding: "6px 12px", borderRadius: 7, border: `1px solid ${BRAND.purple}55`,
                        background: "#7C3AED22", color: BRAND.purple, cursor: "pointer", fontSize: 12, fontWeight: 600,
                      }}>P&L</button>
                    )}
                    <button onClick={() => { setSelected(item); setModal("edit"); }} style={{
                      padding: "6px 12px", borderRadius: 7, border: `1px solid ${BRAND.border}`,
                      background: "transparent", color: BRAND.textSec, cursor: "pointer", fontSize: 12,
                    }}>แก้ไข</button>
                    <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id} style={{
                      padding: "6px 12px", borderRadius: 7, border: `1px solid ${BRAND.danger}44`,
                      background: "#EF444411", color: BRAND.danger, cursor: "pointer", fontSize: 12,
                      opacity: deleting === item.id ? 0.5 : 1,
                    }}>ลบ</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legal reminder */}
      <div style={{
        marginTop: 24, background: "#3B82F611", border: `1px solid ${BRAND.blue}33`,
        borderRadius: 10, padding: "12px 16px", fontSize: 12, color: BRAND.blue,
      }}>
        ⚖️ <strong>ข้อควรระวัง:</strong> การโอนสิทธิ์ใบจองต้องทำเป็นหนังสือและบอกกล่าวโครงการ (ป.พ.พ. ม.306–315)
        · กำไรจากการโอนสิทธิ์ต้องเสียภาษีเงินได้ ม.40(8) · อัตราดอกเบี้ยห้ามเกิน 15% ต่อปี
      </div>

      {/* Modals */}
      {(modal === "add" || modal === "edit") && (
        <ReservationModal item={modal === "edit" ? selected : null} onClose={() => setModal(null)} onSave={handleSave} />
      )}
      {modal === "pnl" && selected && (
        <PnLModal item={selected} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

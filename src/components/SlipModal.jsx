import React from "react";
import { BRAND } from "../lib/config.js";
import { formatThai } from "../lib/utils.js";
import { IMGBB_KEY, IMGBB_ALBUMS } from "../lib/messages.js";

export function SlipModal({ customer, payment, existing, onSave, onDelete, onClose }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = React.useState({
    paidDate: existing?.paidDate || today,
    amount: existing?.amount || customer.amount || "",
    note: existing?.note || "",
    slipUrl: existing?.slipUrl || existing?.slipImage || null,
    slipId: existing?.slipId || null,
    slipDeleteUrl: existing?.slipDeleteUrl || null,
  });
  const [imgPreview, setImgPreview] = React.useState(existing?.slipUrl || existing?.slipImage || null);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const handleImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      // แปลงเป็น base64 ก่อนส่ง (รองรับ album parameter ได้ดีกว่า)
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result.split(",")[1]);
        reader.readAsDataURL(file);
      });
      const now = new Date();
      const albumKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
      const albumId = IMGBB_ALBUMS[albumKey];
      const fd = new FormData();
      fd.append("image", base64);
      if (albumId) fd.append("album", albumId);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        setImgPreview(data.data.url);
        setForm(prev => ({
          ...prev,
          slipUrl: data.data.url,
          slipId: data.data.id,
          slipDeleteUrl: data.data.delete_url,
        }));
      } else {
        alert("อัปโหลดรูปไม่สำเร็จ: " + (data.error?.message || "กรุณาลองใหม่"));
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!form.paidDate || !form.amount) return;
    setSaving(true);
    onSave({
      paidDate: form.paidDate,
      amount: parseFloat(form.amount),
      note: form.note,
      slipUrl: form.slipUrl,
      slipId: form.slipId,
      slipDeleteUrl: form.slipDeleteUrl,
      savedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,.75)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "#080F1E", border: "1px solid rgba(45,212,191,.25)",
        borderRadius: 16, padding: 24, width: "100%", maxWidth: 420,
        maxHeight: "90vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, color: BRAND.textPri, fontSize: 16 }}>บันทึกการชำระเงิน</div>
            <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 2 }}>
              {customer.name} — งวดที่ {payment.installment} ({formatThai(payment.dateStr)})
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: BRAND.textSec, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* วันที่ชำระ */}
          <div>
            <label style={{ fontSize: 12, color: BRAND.textSec, display: "block", marginBottom: 5 }}>วันที่ชำระเงิน *</label>
            <input type="date" value={form.paidDate}
              onChange={e => setForm(p => ({ ...p, paidDate: e.target.value }))}
              style={{ width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(45,212,191,.25)", borderRadius: 8, color: BRAND.textPri, fontSize: 14, padding: "9px 12px", outline: "none" }}
            />
          </div>

          {/* จำนวนเงิน */}
          <div>
            <label style={{ fontSize: 12, color: BRAND.textSec, display: "block", marginBottom: 5 }}>จำนวนเงินที่ชำระ (บาท) *</label>
            <input type="number" value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
              style={{ width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(45,212,191,.25)", borderRadius: 8, color: BRAND.textPri, fontSize: 14, padding: "9px 12px", outline: "none" }}
            />
            <div style={{ fontSize: 11, color: BRAND.textSec, marginTop: 3 }}>
              ยอดที่ต้องชำระ: {(customer.amount || 0).toLocaleString("th-TH")} บาท
            </div>
          </div>

          {/* หมายเหตุ */}
          <div>
            <label style={{ fontSize: 12, color: BRAND.textSec, display: "block", marginBottom: 5 }}>หมายเหตุ / เลขอ้างอิง</label>
            <input type="text" value={form.note}
              onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              placeholder="เช่น โอนผ่าน SCB เลขที่ 123456"
              style={{ width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(45,212,191,.25)", borderRadius: 8, color: BRAND.textPri, fontSize: 13, padding: "9px 12px", outline: "none" }}
            />
          </div>

          {/* อัปโหลดสลิป */}
          <div>
            <label style={{ fontSize: 12, color: BRAND.textSec, display: "block", marginBottom: 5 }}>แนบสลิปการโอนเงิน</label>
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 0", borderRadius: 8, cursor: "pointer",
              border: "1px dashed rgba(45,212,191,.35)", background: "rgba(45,212,191,.04)",
              color: BRAND.teal, fontSize: 13, fontWeight: 600,
            }}>
              {uploading ? "⏳ กำลังอัปโหลด..." : imgPreview ? "เปลี่ยนรูปสลิป" : "📎 เลือกไฟล์รูปภาพ"}
              <input type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} disabled={uploading} />
            </label>
            {imgPreview && (
              <div style={{ marginTop: 10, position: "relative" }}>
                <img src={imgPreview} alt="slip" style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(45,212,191,.2)" }} />
                <button onClick={() => { setImgPreview(null); setForm(p => ({ ...p, slipUrl: null, slipId: null, slipDeleteUrl: null })); }}
                  style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,.7)", border: "none", borderRadius: "50%", color: "#fff", width: 24, height: 24, cursor: "pointer", fontSize: 12 }}>✕</button>
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {existing && (
            <button onClick={() => { onDelete(); onClose(); }} style={{
              flex: "0 0 auto", padding: "10px 16px", borderRadius: 8,
              background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)",
              color: "#FCA5A5", fontSize: 13, cursor: "pointer",
            }}>
              🗑️ ลบ
            </button>
          )}
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 8,
            background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
            color: BRAND.textSec, fontSize: 13, cursor: "pointer",
          }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={!form.paidDate || !form.amount}
            style={{
              flex: 2, padding: "10px 0", borderRadius: 8,
              background: form.paidDate && form.amount
                ? "linear-gradient(135deg,#22C55E,#16A34A)"
                : "rgba(34,197,94,.15)",
              border: "none", color: form.paidDate && form.amount ? "#000" : BRAND.textSec,
              fontWeight: 700, fontSize: 14, cursor: form.paidDate && form.amount ? "pointer" : "not-allowed",
            }}>
            ✓ บันทึกการชำระ
          </button>
        </div>
      </div>
    </div>
  );
}


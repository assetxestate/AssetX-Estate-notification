import React from "react";
import { BRAND } from "../lib/config.js";

// ── LINE User ID Section per Customer ──────────────────────────
export function CustomerLineIdSection({ customer, customerLineIds, savedUserIds, onUpdate }) {
  const currentId = customerLineIds[customer.id] || "";
  const [input, setInput] = React.useState(currentId);
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    setInput(customerLineIds[customer.id] || "");
  }, [customerLineIds, customer.id]);

  const handleSave = () => {
    onUpdate(customer.id, input.trim());
    setEditing(false);
  };

  const handleSelect = (id) => {
    setInput(id);
    onUpdate(customer.id, id);
    setEditing(false);
  };

  return (
    <div style={{
      marginBottom: 16,
      padding: "12px 14px",
      background: currentId ? "rgba(45,212,191,.06)" : "rgba(239,68,68,.05)",
      border: `1px solid ${currentId ? "rgba(45,212,191,.2)" : "rgba(239,68,68,.2)"}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>💬</span>
          <span style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 13 }}>LINE User ID ลูกค้า</span>
        </div>
        <button
          onClick={() => setEditing(v => !v)}
          style={{
            background: "rgba(45,212,191,.1)", border: "1px solid rgba(45,212,191,.3)",
            borderRadius: 6, color: BRAND.teal, fontSize: 11, padding: "3px 10px", cursor: "pointer",
          }}
        >
          {editing ? "ยกเลิก" : currentId ? "แก้ไข" : "+ ตั้งค่า"}
        </button>
      </div>

      {!editing && (
        <div style={{ fontSize: 12, color: currentId ? BRAND.teal : BRAND.textSec, fontFamily: currentId ? "monospace" : "inherit" }}>
          {currentId
            ? <>
                <span style={{ fontSize: 10, color: BRAND.textSec, fontFamily: "inherit", marginRight: 6 }}>
                  {savedUserIds.find(u => u.id === currentId)?.label || ""}
                </span>
                {currentId}
              </>
            : "ยังไม่ได้ตั้งค่า — ปุ่ม LINE จะใช้ User ID หลักแทน"}
        </div>
      )}

      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* เลือกจากรายการที่บันทึกไว้ */}
          {savedUserIds.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 10, color: BRAND.textSec }}>เลือกจาก ID ที่บันทึกไว้</div>
              {savedUserIds.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleSelect(u.id)}
                  style={{
                    textAlign: "left", padding: "6px 10px",
                    background: input === u.id ? "rgba(45,212,191,.15)" : "rgba(255,255,255,.04)",
                    border: `1px solid ${input === u.id ? "rgba(45,212,191,.4)" : BRAND.border}`,
                    borderRadius: 7, cursor: "pointer", color: BRAND.textPri, fontSize: 12,
                  }}
                >
                  <span style={{ color: BRAND.teal, fontWeight: 600 }}>{u.label || "ไม่มีชื่อ"}</span>
                  <span style={{ color: BRAND.textSec, marginLeft: 8, fontFamily: "monospace", fontSize: 11 }}>
                    {u.id.substring(0, 20)}...
                  </span>
                </button>
              ))}
            </div>
          )}
          {/* กรอก ID เอง */}
          <div style={{ fontSize: 10, color: BRAND.textSec }}>หรือกรอก User ID เอง</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              style={{
                flex: 1, background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(45,212,191,.2)", borderRadius: 8,
                color: BRAND.textPri, fontSize: 12, padding: "7px 10px",
                outline: "none", fontFamily: "monospace",
              }}
            />
            <button
              onClick={handleSave}
              disabled={!input.trim()}
              style={{
                padding: "7px 14px", borderRadius: 8,
                background: input.trim() ? "linear-gradient(135deg,#2DD4BF,#0E7490)" : "rgba(45,212,191,.1)",
                border: "none", color: input.trim() ? "#000" : BRAND.textSec,
                fontWeight: 600, fontSize: 12, cursor: input.trim() ? "pointer" : "not-allowed",
              }}
            >
              บันทึก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


import React, { useState } from "react";
import { APPS_SCRIPT_URL, BRAND } from "../lib/config.js";

// System Status Page Component
export function SystemStatusPage({ lineHook, apiConnected, lastFetch, targetUserId, onSetTargetUserId, savedUserIds = [], onSaveNewUserId, onDeleteSavedUserId, syncStatus = "idle", triggerActive = false, onSetTriggerActive }) {
  const { sending, logs, testConnection, sendTestMessage, addLog } = lineHook;
  const [customMessage, setCustomMessage] = useState("");
  const [editingUserId, setEditingUserId] = useState(false);
  const [userIdInput, setUserIdInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleSaveUserId = () => {
    if (!userIdInput.trim()) return;
    onSaveNewUserId(userIdInput.trim(), labelInput.trim() || null);
    addLog("success", `✅ บันทึก User ID: ${labelInput.trim() || userIdInput.trim().substring(0, 10) + "..."}`);
    setUserIdInput("");
    setLabelInput("");
    setEditingUserId(false);
  };

  const handleCancelEdit = () => {
    setUserIdInput("");
    setLabelInput("");
    setEditingUserId(false);
  };

  const handleSelect = (id) => {
    onSetTargetUserId(id);
    addLog("info", `🔄 เปลี่ยน Active ID → ${id.substring(0, 10)}...`);
  };

  const handleDelete = (id) => {
    if (confirmDelete === id) {
      onDeleteSavedUserId(id);
      setConfirmDelete(null);
      addLog("info", "🗑️ ลบ User ID แล้ว");
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const sendCustom = async () => {
    if (!customMessage.trim()) return;
    addLog("info", "กำลังส่งข้อความ Manual...");
    try {
      const did = targetUserId && targetUserId.trim() ? targetUserId.trim() : "";
      const url = did ? `${APPS_SCRIPT_URL}?dest=${encodeURIComponent(did)}` : APPS_SCRIPT_URL;
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "sendLine", message: customMessage, type: "manual" }),
      });
      addLog("success", "✅ ส่งข้อความ Manual สำเร็จ");
      setCustomMessage("");
    } catch (err) {
      addLog("error", "❌ ส่งล้มเหลว: " + err.message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* System Status Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 12,
        }}
      >
        {/* LINE API Status */}
        <div className="card" style={{ padding: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 24 }}>💬</span>
            <div>
              <div style={{ fontWeight: 700, color: BRAND.textPri }}>
                LINE API
              </div>
              <div style={{ fontSize: 11, color: BRAND.textSec }}>
                Messaging API
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span
              className={`status-dot ${apiConnected ? "success" : "warning"}`}
            ></span>
            <span
              style={{
                fontSize: 13,
                color: apiConnected ? "#4ADE80" : "#F59E0B",
              }}
            >
              {apiConnected ? "เชื่อมต่อแล้ว" : "รอตรวจสอบ"}
            </span>
          </div>
          <button
            onClick={testConnection}
            disabled={sending}
            className="btn"
            style={{
              width: "100%",
              padding: "8px",
              background: "rgba(56,189,248,.1)",
              border: "1px solid rgba(56,189,248,.3)",
              borderRadius: 8,
              color: "#38BDF8",
              fontSize: 12,
            }}
          >
            {sending ? "⏳ กำลังทดสอบ..." : "🔄 ทดสอบการเชื่อมต่อ"}
          </button>
        </div>

        {/* User ID Management */}
        <div className="card" style={{ padding: 16, gridColumn: "1 / -1" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>👤</span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 700, color: BRAND.textPri }}>User ID ผู้รับแจ้งเตือน</div>
                  {/* Sync badge */}
                  {syncStatus === "syncing" && (
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(56,189,248,.15)", border: "1px solid rgba(56,189,248,.3)", color: "#38BDF8", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> กำลัง Sync...
                    </span>
                  )}
                  {syncStatus === "synced" && (
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(74,222,128,.15)", border: "1px solid rgba(74,222,128,.3)", color: "#4ADE80" }}>
                      ✅ Synced กับ Script
                    </span>
                  )}
                  {syncStatus === "error" && (
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)", color: "#FCA5A5" }}>
                      ❌ Sync ล้มเหลว
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: BRAND.textSec }}>
                  {savedUserIds.length > 0 ? `บันทึกไว้ ${savedUserIds.length} ID` : "ยังไม่มี ID ที่บันทึก"}
                </div>
              </div>
            </div>
            {!editingUserId && (
              <button onClick={() => setEditingUserId(true)} className="btn" style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12,
                background: "rgba(45,212,191,.1)", border: "1px solid rgba(45,212,191,.3)",
                color: BRAND.teal, display: "flex", alignItems: "center", gap: 5,
              }}>
                ➕ เพิ่ม ID ใหม่
              </button>
            )}
          </div>

          {/* Active ID banner */}
          <div style={{
            marginBottom: 14, padding: "10px 14px", borderRadius: 10,
            background: targetUserId ? "rgba(45,212,191,.08)" : "rgba(239,68,68,.06)",
            border: `1px solid ${targetUserId ? "rgba(45,212,191,.25)" : "rgba(239,68,68,.25)"}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span className={`status-dot ${targetUserId ? "success" : "error"}`}></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: BRAND.textSec, marginBottom: 2 }}>
                {targetUserId ? "🟢 Active — ส่งแจ้งเตือนไปที่:" : "🔴 ยังไม่ได้เลือก User ID"}
              </div>
              {targetUserId && (
                <>
                  <div style={{ fontWeight: 700, color: BRAND.teal, fontSize: 13 }}>
                    {savedUserIds.find(u => u.id === targetUserId)?.label || "ไม่มีชื่อ"}
                  </div>
                  <div style={{
                    fontSize: 11, color: BRAND.textSec, fontFamily: "monospace",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {targetUserId}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Saved IDs list */}
          {savedUserIds.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: editingUserId ? 14 : 0 }}>
              {savedUserIds.map((u) => {
                const isActive = u.id === targetUserId;
                const isDeleting = confirmDelete === u.id;
                return (
                  <div key={u.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 12px", borderRadius: 10,
                    background: isActive ? "rgba(45,212,191,.1)" : "rgba(0,0,0,.2)",
                    border: `1px solid ${isActive ? "rgba(45,212,191,.35)" : BRAND.border}`,
                    transition: "all .2s",
                  }}>
                    {/* Select radio */}
                    <div
                      onClick={() => handleSelect(u.id)}
                      style={{
                        width: 18, height: 18, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                        border: `2px solid ${isActive ? BRAND.teal : BRAND.textMut}`,
                        background: isActive ? BRAND.teal : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all .2s",
                      }}
                    >
                      {isActive && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#000" }} />}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => handleSelect(u.id)}>
                      <div style={{ fontWeight: 600, color: isActive ? BRAND.teal : BRAND.textPri, fontSize: 13 }}>
                        {u.label}
                        {isActive && <span style={{
                          marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: .5,
                          background: BRAND.teal, color: "#000", padding: "1px 6px", borderRadius: 10,
                        }}>ACTIVE</span>}
                      </div>
                      <div style={{
                        fontSize: 10, color: BRAND.textMut, fontFamily: "monospace",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {u.id}
                      </div>
                      <div style={{ fontSize: 9, color: BRAND.textMut, marginTop: 1 }}>บันทึก: {u.savedAt}</div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      {!isActive && (
                        <button onClick={() => handleSelect(u.id)} className="btn" style={{
                          padding: "4px 9px", borderRadius: 7, fontSize: 11,
                          background: "rgba(45,212,191,.08)", border: "1px solid rgba(45,212,191,.2)",
                          color: BRAND.teal,
                        }}>ใช้งาน</button>
                      )}
                      <button onClick={() => handleDelete(u.id)} className="btn" style={{
                        padding: "4px 9px", borderRadius: 7, fontSize: 11,
                        background: isDeleting ? "rgba(239,68,68,.2)" : "rgba(239,68,68,.06)",
                        border: `1px solid ${isDeleting ? "#EF4444" : "rgba(239,68,68,.2)"}`,
                        color: isDeleting ? "#FCA5A5" : "#EF444490",
                        transition: "all .2s",
                      }}>
                        {isDeleting ? "ยืนยันลบ?" : "🗑️"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add new ID form */}
          {editingUserId && (
            <div style={{
              marginTop: savedUserIds.length > 0 ? 4 : 0,
              padding: 14, borderRadius: 10,
              background: "rgba(45,212,191,.04)",
              border: "1px dashed rgba(45,212,191,.3)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.teal, marginBottom: 2 }}>
                ➕ เพิ่ม User ID ใหม่
              </div>
              <input
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                placeholder="ชื่อเรียก เช่น Admin, ทีมงาน..."
                style={{
                  width: "100%", padding: "8px 10px",
                  background: "rgba(0,0,0,.35)", border: "1px solid rgba(100,116,139,.4)",
                  borderRadius: 8, color: BRAND.textPri, fontSize: 12, outline: "none",
                  fontFamily: "'Sarabun', sans-serif",
                }}
              />
              <input
                value={userIdInput}
                onChange={e => setUserIdInput(e.target.value)}
                placeholder="LINE User ID เช่น Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                autoFocus
                style={{
                  width: "100%", padding: "8px 10px",
                  background: "rgba(0,0,0,.35)", border: "1px solid rgba(45,212,191,.35)",
                  borderRadius: 8, color: BRAND.teal, fontSize: 12,
                  fontFamily: "monospace", outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={handleSaveUserId} disabled={!userIdInput.trim()} className="btn" style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, fontWeight: 700, fontSize: 12,
                  background: userIdInput.trim() ? "linear-gradient(135deg,#2DD4BF,#0E7490)" : "rgba(45,212,191,.1)",
                  border: "none", color: userIdInput.trim() ? "#000" : BRAND.textMut,
                }}>
                  💾 บันทึก &amp; ใช้งาน
                </button>
                <button onClick={handleCancelEdit} className="btn" style={{
                  padding: "8px 14px", borderRadius: 8, fontSize: 12,
                  background: "rgba(100,116,139,.1)", border: "1px solid rgba(100,116,139,.3)",
                  color: BRAND.textSec,
                }}>
                  ยกเลิก
                </button>
              </div>
              <div style={{ fontSize: 10, color: BRAND.textMut, lineHeight: 1.6 }}>
                💡 รับ User ID โดยส่งข้อความหา LINE Bot แล้วดูใน Apps Script Log
              </div>
            </div>
          )}

          {savedUserIds.length === 0 && !editingUserId && (
            <div style={{ textAlign: "center", padding: "16px 0", color: BRAND.textMut, fontSize: 13 }}>
              ยังไม่มี User ID — กด <span style={{ color: BRAND.teal }}>➕ เพิ่ม ID ใหม่</span> เพื่อเริ่มต้น
            </div>
          )}
        </div>

        {/* API Endpoint Status */}
        <div className="card" style={{ padding: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 24 }}>🌐</span>
            <div>
              <div style={{ fontWeight: 700, color: BRAND.textPri }}>
                API Endpoint
              </div>
              <div style={{ fontSize: 11, color: BRAND.textSec }}>
                Google Apps Script
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span
              className={`status-dot ${apiConnected ? "success" : "warning"}`}
            ></span>
            <span
              style={{
                fontSize: 13,
                color: apiConnected ? "#4ADE80" : "#F59E0B",
              }}
            >
              {apiConnected ? "Deploy แล้ว" : "รอ Deploy"}
            </span>
          </div>
          <div
            style={{
              fontSize: 10,
              color: BRAND.textMut,
              wordBreak: "break-all",
            }}
          >
            {APPS_SCRIPT_URL.substring(0, 45)}...
          </div>
        </div>

        {/* Auto Notification Status */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>⏰</span>
            <div>
              <div style={{ fontWeight: 700, color: BRAND.textPri }}>แจ้งเตือนอัตโนมัติ</div>
              <div style={{ fontSize: 11, color: BRAND.textSec }}>Daily Trigger</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className={`status-dot ${triggerActive ? "success" : "warning"}`}></span>
            <span style={{ fontSize: 13, color: triggerActive ? "#10B981" : "#F59E0B" }}>
              {triggerActive ? "✅ Trigger ทำงานอยู่ (8–9 AM)" : "รอตั้ง Trigger"}
            </span>
          </div>
          <div style={{ fontSize: 10, color: BRAND.textMut, marginBottom: 10 }}>
            {triggerActive ? "ระบบจะส่งแจ้งเตือนอัตโนมัติทุกวัน" : "ตั้งค่าใน Apps Script → Triggers"}
          </div>
          {!triggerActive ? (
            <button
              onClick={() => {
                localStorage.setItem("assetx_trigger_active", "true")
                onSetTriggerActive && onSetTriggerActive(true)
              }}
              style={{
                background: "#10B981", color: "#fff", border: "none",
                borderRadius: 8, padding: "7px 14px", fontSize: 12,
                fontWeight: 600, cursor: "pointer", width: "100%"
              }}
            >
              ✅ ฉันตั้ง Trigger แล้ว
            </button>
          ) : (
            <button
              onClick={() => {
                localStorage.setItem("assetx_trigger_active", "false")
                onSetTriggerActive && onSetTriggerActive(false)
              }}
              style={{
                background: "transparent", color: "#9CA3AF", border: "1px solid #E5E7EB",
                borderRadius: 8, padding: "6px 14px", fontSize: 11,
                cursor: "pointer", width: "100%"
              }}
            >
              รีเซ็ตสถานะ
            </button>
          )}
        </div>
      </div>

      {/* Manual Send Section */}
      <div className="card" style={{ padding: 20 }}>
        <div
          style={{
            fontWeight: 700,
            color: BRAND.textPri,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 20 }}>📤</span> ส่ง LINE แบบ Manual
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={sendTestMessage}
            disabled={sending}
            className="line-btn"
            style={{ flex: "0 0 auto" }}
          >
            {sending ? "⏳ กำลังส่ง..." : "🧪 ส่งข้อความทดสอบ"}
          </button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontSize: 12,
              color: BRAND.textSec,
              marginBottom: 6,
              display: "block",
            }}
          >
            ข้อความที่ต้องการส่ง:
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="พิมพ์ข้อความที่ต้องการส่งผ่าน LINE..."
            style={{
              width: "100%",
              height: 100,
              background: "rgba(0,0,0,.3)",
              border: "1px solid " + BRAND.border,
              borderRadius: 10,
              padding: 12,
              color: BRAND.textPri,
              fontSize: 13,
              resize: "vertical",
              fontFamily: "'Sarabun',sans-serif",
            }}
          />
        </div>
        <button
          onClick={sendCustom}
          disabled={sending || !customMessage.trim()}
          className="line-btn"
        >
          {sending ? "⏳ กำลังส่ง..." : "📤 ส่งข้อความนี้"}
        </button>
      </div>

      {/* Activity Log */}
      <div className="card" style={{ padding: 20 }}>
        <div
          style={{
            fontWeight: 700,
            color: BRAND.textPri,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            <span style={{ fontSize: 20 }}>📋</span> Log กิจกรรม
          </span>
          <span style={{ fontSize: 11, color: BRAND.textSec }}>
            {logs.length} รายการ
          </span>
        </div>

        <div style={{ maxHeight: 250, overflowY: "auto" }}>
          {logs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 20,
                color: BRAND.textMut,
                fontSize: 13,
              }}
            >
              ยังไม่มีกิจกรรม - ลองกดปุ่มทดสอบด้านบน
            </div>
          ) : (
            logs
              .slice()
              .reverse()
              .map((log, i) => (
                <div key={i} className={`log-entry log-${log.type}`}>
                  <span style={{ opacity: 0.7 }}>[{log.time}]</span>{" "}
                  {log.message}
                </div>
              ))
          )}
        </div>
      </div>

      {/* Quick Guide */}
      <div
        className="card"
        style={{ padding: 20, borderColor: "rgba(45,212,191,.3)" }}
      >
        <div style={{ fontWeight: 700, color: BRAND.teal, marginBottom: 12 }}>
          📖 วิธีตั้งค่าให้ครบ
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 13,
            color: BRAND.textSec,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ color: "#4ADE80" }}>✅</span>
            <span>LINE Channel Access Token - ตั้งค่าแล้ว</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: targetUserId ? "#4ADE80" : "#F59E0B" }}>{targetUserId ? "✅" : "⏳"}</span>
              <span>User ID ผู้รับแจ้งเตือน
                {targetUserId
                  ? <span style={{ color: BRAND.teal, fontFamily: "monospace", marginLeft: 6, fontSize: 11 }}>
                      ({targetUserId.substring(0, 10)}...)
                    </span>
                  : <span style={{ color: "#F59E0B", marginLeft: 6, fontSize: 11 }}> - ยังไม่ได้ตั้งค่า</span>
                }
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ color: apiConnected ? "#4ADE80" : "#F59E0B" }}>
              {apiConnected ? "✅" : "⏳"}
            </span>
            <span>Deploy Apps Script เป็น Web App</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ color: "#F59E0B" }}>⏳</span>
            <span>ตั้ง Trigger แจ้งเตือนอัตโนมัติ (8:00-9:00 น.)</span>
          </div>
        </div>
      </div>
    </div>
  );
}


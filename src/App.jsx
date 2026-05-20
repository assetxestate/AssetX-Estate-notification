import React, { useState, useEffect, useMemo, useCallback } from "react";
import ChatPanel from "./ChatPanel.jsx";
import ValuationPage from "./ValuationPage.jsx";
import MapView from "./MapView.jsx";
import InvestorPage from "./InvestorPage.jsx";
import DashboardPage from "./DashboardPage.jsx";
import TaxPage from "./TaxPage.jsx";
import LegalPage from "./LegalPage.jsx";
import ReservationPage from "./ReservationPage.jsx";
import {
  getCustomers as apiGetCustomers,
  getContractStatuses as apiGetContractStatuses,
  closeContract as apiCloseContract,
  reopenContract as apiReopenContract,
  getPaymentRecords as apiGetPaymentRecords,
  savePaymentRecord as apiSavePaymentRecord,
  deletePaymentRecord as apiDeletePaymentRecord,
  getDestinations as apiGetDestinations,
  updateCustomer as apiUpdateCustomer,
  postponePayment as apiPostponePayment,
  cancelCustomer as apiCancelCustomer,
} from "./lib/api.js";
import {
  parseDate, formatThai, formatThaiLong, formatMoney, pad, fmtCal,
  getDiff, payStatus, contractStatus, parseDeeds,
  P_STATUS, C_STATUS, styles,
} from "./lib/utils.js";
import { IMGBB_KEY, IMGBB_ALBUMS, gcalPayment, msgPayment, msgContract } from "./lib/messages.js";
import { SENDER_INFO, numberToThaiText, formatThaiDateFull, formatLandArea, printNotice } from "./lib/notice.js";

// Logo Component
function Logo({ size = 40 }) {
  const hasBase64 = LOGO_CONFIG.type === "base64" && LOGO_CONFIG.base64;
  const hasUrl = LOGO_CONFIG.type === "url" && LOGO_CONFIG.url;

  if (hasBase64) {
    return (
      <img
        src={`data:image/png;base64,${LOGO_CONFIG.base64}`}
        alt="Logo"
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          objectFit: "cover",
        }}
      />
    );
  }

  if (hasUrl) {
    return (
      <img
        src={LOGO_CONFIG.url}
        alt="Logo"
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          objectFit: "cover",
        }}
      />
    );
  }

  // Fallback: Text Logo
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: "linear-gradient(135deg,#2DD4BF,#7C3AED)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        color: "#fff",
      }}
    >
      {LOGO_CONFIG.fallbackText}
    </div>
  );
}

// LINE Send Hook with Logging
function useLineNotification(targetUserId) {
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState([]);

  // useRef เพื่อให้จับ targetUserId ล่าสุดเสมอ ป้องกัน stale closure
  const targetUserIdRef = React.useRef(targetUserId);
  React.useEffect(() => {
    targetUserIdRef.current = targetUserId;
  }, [targetUserId]);

  const addLog = useCallback((type, message) => {
    const now = new Date().toLocaleTimeString("th-TH");
    setLogs(prev => [...prev.slice(-19), { type, message, time: now }]);
  }, []);

  const sendNotification = useCallback(async (message, type = "payment", targetName = "") => {
    const currentId = targetUserIdRef.current;
    setSending(true);
    addLog("info", `กำลังส่งข้อความ${targetName ? " ถึง " + targetName : ""}...`);
    try {
      const did = currentId && currentId.trim() ? currentId.trim() : "";
      const url = did ? `${APPS_SCRIPT_URL}?dest=${encodeURIComponent(did)}` : APPS_SCRIPT_URL;
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "sendLine", message, type }),
      });
      addLog("success", `✅ ส่งสำเร็จ${targetName ? " → " + targetName : ""}${currentId ? " [" + currentId.substring(0,8) + "...]" : ""}`);
      setSending(false);
      return { success: true };
    } catch (error) {
      addLog("error", `❌ ล้มเหลว: ${error.message}`);
      setSending(false);
      return { success: false, error: error.message };
    }
  }, [addLog]);

  const testConnection = useCallback(async () => {
    setSending(true);
    addLog("info", "กำลังทดสอบการเชื่อมต่อ...");
    try {
      const response = await fetch(APPS_SCRIPT_URL);
      if (response.ok) {
        addLog("success", "✅ เชื่อมต่อ API สำเร็จ");
      } else {
        addLog("error", `❌ HTTP Error: ${response.status}`);
      }
    } catch (error) {
      addLog("error", `❌ ไม่สามารถเชื่อมต่อ: ${error.message}`);
    }
    setSending(false);
  }, [addLog]);

  const sendTestMessage = useCallback(async () => {
    const testMsg = `🧪 ทดสอบระบบแจ้งเตือน\n\nจาก: AssetX Dashboard\nเวลา: ${new Date().toLocaleString("th-TH")}\n\n✅ ระบบทำงานปกติ`;
    return sendNotification(testMsg, "test", "ทดสอบ");
  }, [sendNotification]);

  return { sending, logs, sendNotification, testConnection, sendTestMessage, addLog };
}

// Components
function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton" style={{ height: 88 }} />
      ))}
    </div>
  );
}

function LineButton({
  message,
  type,
  label = "ส่ง LINE",
  compact = false,
  onSend,
  destinationId = "",
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleClick = async (e) => {
    e.stopPropagation();
    setSending(true);
    try {
      const did = destinationId && destinationId.trim() ? destinationId.trim() : "";
      const url = did ? `${APPS_SCRIPT_URL}?dest=${encodeURIComponent(did)}` : APPS_SCRIPT_URL;
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "sendLine", message, type }),
      });
      setResult("success");
      if (onSend) onSend(true);
    } catch (err) {
      setResult("error");
      if (onSend) onSend(false);
    }
    setSending(false);
    setTimeout(() => setResult(null), 3000);
  };

  return (
    <button
      className={`line-btn ${sending ? "sending" : ""}`}
      onClick={handleClick}
      disabled={sending}
      style={compact ? { padding: "4px 10px", fontSize: 11 } : {}}
    >
      {sending ? (
        <>
          <span
            style={{
              animation: "spin 1s linear infinite",
              display: "inline-block",
            }}
          >
            ⏳
          </span>{" "}
          กำลังส่ง...
        </>
      ) : result === "success" ? (
        <>
          <span>✅</span> ส่งแล้ว!
        </>
      ) : result === "error" ? (
        <>
          <span>❌</span> ลองใหม่
        </>
      ) : (
        <>
          <span style={{ fontSize: 14 }}>💬</span> {label}
        </>
      )}
    </button>
  );
}

function TypeBadge({ type }) {
  return (
    <span
      className={type === "จำนอง" ? "badge-mortgage" : "badge-sell"}
      style={{
        borderRadius: 20,
        padding: "2px 9px",
        fontSize: 10,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {type}
    </span>
  );
}

// System Status Page Component
function SystemStatusPage({ lineHook, apiConnected, lastFetch, targetUserId, onSetTargetUserId, savedUserIds = [], onSaveNewUserId, onDeleteSavedUserId, syncStatus = "idle", triggerActive = false, onSetTriggerActive }) {
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

function SlipModal({ customer, payment, existing, onSave, onDelete, onClose }) {
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

// ── ข้อมูลเพิ่มเติมลูกค้า (ที่อยู่, เลขสัญญา ฯลฯ) ──────────────
function CustomerExtraInfoSection({ customer, extraInfoMap, onUpdate }) {
  const info = extraInfoMap[customer.id] || {};
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState(info);

  React.useEffect(() => {
    setForm(extraInfoMap[customer.id] || {});
  }, [extraInfoMap, customer.id]);

  const handleSave = () => {
    onUpdate(customer.id, form);
    setEditing(false);
  };

  const field = (key, label, placeholder = "") => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 10, color: BRAND.textSec }}>{label}</label>
      <input
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

  const isComplete = info.fullName && info.address && info.contractNumber;

  return (
    <div style={{
      marginBottom: 16, padding: "12px 14px",
      background: isComplete ? "rgba(45,212,191,.04)" : "rgba(245,158,11,.04)",
      border: `1px solid ${isComplete ? "rgba(45,212,191,.2)" : "rgba(245,158,11,.2)"}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>📋</span>
          <span style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 13 }}>ข้อมูลสำหรับจดหมาย Notice</span>
          {!isComplete && <span style={{ fontSize: 10, color: "#F59E0B", background: "rgba(245,158,11,.15)", padding: "2px 8px", borderRadius: 20 }}>ยังไม่ครบ</span>}
        </div>
        <button onClick={() => setEditing(v => !v)} style={{
          background: "rgba(45,212,191,.1)", border: "1px solid rgba(45,212,191,.3)",
          borderRadius: 6, color: BRAND.teal, fontSize: 11, padding: "3px 10px", cursor: "pointer",
        }}>
          {editing ? "ยกเลิก" : isComplete ? "แก้ไข" : "+ กรอกข้อมูล"}
        </button>
      </div>

      {!editing && isComplete && (
        <div style={{ fontSize: 12, color: BRAND.textSec, display: "flex", flexDirection: "column", gap: 3 }}>
          <div><span style={{ color: BRAND.textPri }}>ชื่อ:</span> {info.fullName}</div>
          <div><span style={{ color: BRAND.textPri }}>ที่อยู่:</span> {info.address}</div>
          <div><span style={{ color: BRAND.textPri }}>เลขที่สัญญา:</span> {info.contractNumber} | <span style={{ color: BRAND.textPri }}>วันที่:</span> {info.contractDate || "-"}</div>
          {info.landOffice && <div><span style={{ color: BRAND.textPri }}>สำนักงานที่ดิน:</span> {info.landOffice}</div>}
        </div>
      )}
      {!editing && !isComplete && (
        <div style={{ fontSize: 12, color: BRAND.textSec }}>กรอกข้อมูลเพื่อใช้สร้างจดหมาย Notice</div>
      )}

      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {field("fullName", "ชื่อ-นามสกุลเต็ม (ผู้ขายฝาก)", "เช่น นายสมชาย ใจดี")}
          {field("address", "ที่อยู่สำหรับจ่าหน้าซอง", "เช่น 123 ถ.สุขุมวิท กรุงเทพฯ 10110")}
          {field("contractNumber", "เลขที่สัญญาขายฝาก", "เช่น ขฝ.2568/001")}
          {field("contractDate", "วันที่ทำสัญญา (YYYY-MM-DD)", "เช่น 2025-03-19")}
          {field("landOffice", "สำนักงานที่ดิน (ไม่บังคับ — ระบบใช้จากโฉนดอัตโนมัติ)", "เช่น สำนักงานที่ดินจังหวัดสมุทรสาคร")}
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

// ── แก้ไขข้อมูลหลักลูกค้าจาก Sheet DATA ────────────────────────
function CustomerSheetEditModal({ customer, appsScriptUrl, onClose, onSaved }) {
  const [form, setForm] = React.useState({
    name: customer.name || '',
    type: customer.type || 'จำนอง',
    principal: String(customer.principal || ''),
    amount: String(customer.amount || ''),
    freq: customer.freq || 'รายเดือน',
    contractEndDate: customer.contractEndDate || '',
    lineUserId: customer.lineUserId || '',
    incomeType: customer.incomeType || 'commission',
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);

  const up = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('กรุณากรอกชื่อลูกค้า'); return; }
    setSaving(true); setError(null);
    try {
      await apiUpdateCustomer(customer.id, {
        name: form.name,
        type: form.type,
        principal: parseFloat(form.principal) || 0,
        amount: parseFloat(form.amount) || 0,
        freq: form.freq,
        contractEndDate: form.contractEndDate || null,
        lineUserId: form.lineUserId,
        incomeType: form.incomeType,
      });
      onSaved({ ...customer, ...form, principal: parseFloat(form.principal) || 0, amount: parseFloat(form.amount) || 0 });
      onClose();
    } catch (e) {
      setError('เกิดข้อผิดพลาด: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(45,212,191,.2)',
    borderRadius: 7, color: BRAND.textPri, fontSize: 13, padding: '8px 10px', outline: 'none',
  };
  const labelStyle = { fontSize: 11, color: BRAND.textSec, marginBottom: 4, display: 'block' };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: BRAND.card, border: `1px solid rgba(45,212,191,.3)`, borderRadius: 16,
        padding: 24, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: BRAND.textPri, fontSize: 16 }}>✏️ แก้ไขข้อมูลลูกค้า</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: BRAND.textSec, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>ชื่อลูกค้า</label>
            <input style={inputStyle} value={form.name} onChange={e => up('name', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>ประเภทสัญญา</label>
            <select style={inputStyle} value={form.type} onChange={e => up('type', e.target.value)}>
              <option value="จำนอง">จำนอง</option>
              <option value="ขายฝาก">ขายฝาก</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>เงินต้น (บาท)</label>
              <input style={inputStyle} type="number" value={form.principal} onChange={e => up('principal', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>ดอกเบี้ย/งวด (บาท)</label>
              <input style={inputStyle} type="number" value={form.amount} onChange={e => up('amount', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>รอบชำระ</label>
            <select style={inputStyle} value={form.freq} onChange={e => up('freq', e.target.value)}>
              <option value="รายเดือน">รายเดือน</option>
              <option value="ราย 2 สัปดาห์">ราย 2 สัปดาห์</option>
              <option value="รายปี">รายปี</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>วันสิ้นสุดสัญญา (YYYY-MM-DD)</label>
            <input style={inputStyle} value={form.contractEndDate} onChange={e => up('contractEndDate', e.target.value)} placeholder="เช่น 2026-06-01" />
          </div>
          <div>
            <label style={labelStyle}>LINE User ID</label>
            <input style={inputStyle} value={form.lineUserId} onChange={e => up('lineUserId', e.target.value)} placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
          </div>
          <div>
            <label style={labelStyle}>ประเภทรายได้บริษัท</label>
            <select style={inputStyle} value={form.incomeType} onChange={e => up('incomeType', e.target.value)}>
              <option value="commission">รับค่าคอมมิชชั่น (มี Advance 2%)</option>
              <option value="interest">รับดอกเบี้ยแทน (ไม่มี Advance)</option>
            </select>
          </div>
        </div>

        {error && <div style={{ color: '#F87171', fontSize: 12, marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)',
            color: BRAND.textSec, fontSize: 13, cursor: 'pointer',
          }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 2, padding: '10px 0', borderRadius: 8,
            background: saving ? 'rgba(45,212,191,.3)' : 'linear-gradient(135deg,#2DD4BF,#0E7490)',
            border: 'none', color: '#000', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกลง Sheet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LINE User ID Section per Customer ──────────────────────────
function CustomerLineIdSection({ customer, customerLineIds, savedUserIds, onUpdate }) {
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

// ── Modal เลื่อนนัดชำระ ──────────────────────────────────────────
function PostponeModal({ customer, payment, onSave, onClose }) {
  const [newDate, setNewDate] = React.useState(payment.dateStr || "");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const inp = { width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${BRAND.border}`, borderRadius: 8, color: BRAND.textPri, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box" };
  const lbl = { fontSize: 11, color: BRAND.textSec, display: "block", marginBottom: 4, marginTop: 10 };

  const handleSave = async () => {
    if (!newDate) return;
    setSaving(true);
    try {
      await apiPostponePayment(customer.id, payment.installment, newDate, note);
      onSave({ newDate, note });
    } catch (e) {
      alert("เกิดข้อผิดพลาด: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 16, padding: 24, maxWidth: 380, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: BRAND.textPri }}>📅 เลื่อนนัดชำระ</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: BRAND.textSec, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: BRAND.textPri, fontWeight: 600 }}>{customer.name}</div>
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

// ── Modal สรุปการเบิกจ่าย ────────────────────────────────────────
function DisbursementModal({ customer, onClose, onSaved }) {
  const EMPTY_DEBT = () => ({
    id: Date.now() + Math.random(),
    creditorName: '', contractType: 'จำนอง', amount: '',
    paymentMethod: 'โอน', bankName: '', accountNo: '', accountName: '', checkPayableTo: '',
  })

  const ex = customer.disbursement || {}
  const [form, setForm] = React.useState({
    approvedAmount: String(ex.approvedAmount || customer.principal || ''),
    existingDebts: ex.existingDebts?.length > 0 ? ex.existingDebts : [],
    advanceMonths: String(ex.advanceMonths ?? 0),
    externalBrokerName: ex.externalBrokerName || '',
    externalBrokerAmount: String(ex.externalBrokerAmount || ''),
    externalBrokerPayment: ex.externalBrokerPayment || 'โอน',
    companyFeeType: ex.companyFeeType || 'fixed',
    companyFeeRate: String(ex.companyFeeRate || ''),
    companyFeeAmount: String(ex.companyFeeAmount || ''),
  })
  const [saving, setSaving] = React.useState(false)
  const up = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const approved = parseFloat(form.approvedAmount) || 0
  const totalDebt = form.existingDebts.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
  const monthlyAmount = customer.amount || 0
  const advanceTotal = (parseInt(form.advanceMonths) || 0) * monthlyAmount
  const externalFee = parseFloat(form.externalBrokerAmount) || 0
  const companyFee = form.companyFeeType === 'percent'
    ? Math.round(approved * (parseFloat(form.companyFeeRate) || 0) / 100)
    : parseFloat(form.companyFeeAmount) || 0
  const net = approved - totalDebt - advanceTotal - externalFee - companyFee

  const addDebt = () => setForm(p => ({ ...p, existingDebts: [...p.existingDebts, EMPTY_DEBT()] }))
  const removeDebt = (id) => setForm(p => ({ ...p, existingDebts: p.existingDebts.filter(d => d.id !== id) }))
  const updateDebt = (id, key, val) => setForm(p => ({ ...p, existingDebts: p.existingDebts.map(d => d.id === id ? { ...d, [key]: val } : d) }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const disbursement = {
        approvedAmount: approved,
        existingDebts: form.existingDebts,
        advanceMonths: parseInt(form.advanceMonths) || 0,
        advanceTotal,
        externalBrokerName: form.externalBrokerName,
        externalBrokerAmount: externalFee,
        externalBrokerPayment: form.externalBrokerPayment,
        companyFeeType: form.companyFeeType,
        companyFeeRate: parseFloat(form.companyFeeRate) || 0,
        companyFeeAmount: companyFee,
        netDisbursement: net,
      }
      await apiUpdateCustomer(customer.id, { disbursement })
      onSaved({ ...customer, disbursement })
      onClose()
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const inp = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(45,212,191,.2)',
    borderRadius: 7, color: BRAND.textPri, fontSize: 13, padding: '8px 10px', outline: 'none',
  }
  const lbl = { fontSize: 11, color: BRAND.textSec, marginBottom: 4, display: 'block' }
  const SectionTitle = ({ icon, text }) => (
    <div style={{ margin: '16px 0 8px', fontSize: 12, fontWeight: 700, color: BRAND.gold }}>{icon} {text}</div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: BRAND.bgCard, border: `1px solid rgba(45,212,191,.3)`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 800, color: BRAND.textPri, fontSize: 16 }}>💰 สรุปการเบิกจ่าย</div>
            <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 2 }}>{customer.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: BRAND.textSec, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {/* วงเงินอนุมัติ */}
        <SectionTitle icon="🏦" text="วงเงินที่นายทุนอนุมัติ" />
        <div>
          <label style={lbl}>วงเงินอนุมัติ (บาท)</label>
          <input style={inp} type="number" value={form.approvedAmount} onChange={e => up('approvedAmount', e.target.value)} placeholder="0" />
        </div>

        {/* ทุนเก่า */}
        <SectionTitle icon="🔗" text={`ทุนเก่า (${form.existingDebts.length} รายการ)`} />
        {form.existingDebts.map((debt, idx) => (
          <div key={debt.id} style={{ background: 'rgba(0,0,0,.3)', borderRadius: 10, padding: 12, marginBottom: 10, border: `1px solid ${BRAND.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.textPri }}>เจ้าหนี้ที่ {idx + 1}</div>
              <button onClick={() => removeDebt(debt.id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,.4)', background: 'transparent', color: '#FCA5A5', cursor: 'pointer' }}>ลบ</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>ชื่อเจ้าหนี้เดิม</label>
                <input style={inp} value={debt.creditorName} onChange={e => updateDebt(debt.id, 'creditorName', e.target.value)} placeholder="ชื่อ-นามสกุล / บริษัท" />
              </div>
              <div>
                <label style={lbl}>ประเภทสัญญาเดิม</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={debt.contractType} onChange={e => updateDebt(debt.id, 'contractType', e.target.value)}>
                  <option value="จำนอง">จำนอง</option>
                  <option value="ขายฝาก">ขายฝาก</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>
              <div>
                <label style={lbl}>ยอดที่ต้องปลด (บาท)</label>
                <input style={inp} type="number" value={debt.amount} onChange={e => updateDebt(debt.id, 'amount', e.target.value)} placeholder="0" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>วิธีชำระ</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={debt.paymentMethod} onChange={e => updateDebt(debt.id, 'paymentMethod', e.target.value)}>
                  <option value="โอน">เงินโอน</option>
                  <option value="แคชเชียร์เช็ก">แคชเชียร์เช็ก</option>
                  <option value="เงินสด">เงินสด</option>
                </select>
              </div>
              {debt.paymentMethod === 'โอน' && (<>
                <div>
                  <label style={lbl}>ธนาคาร</label>
                  <input style={inp} value={debt.bankName} onChange={e => updateDebt(debt.id, 'bankName', e.target.value)} placeholder="เช่น กสิกรไทย" />
                </div>
                <div>
                  <label style={lbl}>เลขบัญชี</label>
                  <input style={inp} value={debt.accountNo} onChange={e => updateDebt(debt.id, 'accountNo', e.target.value)} placeholder="xxx-x-xxxxx-x" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>ชื่อบัญชี</label>
                  <input style={inp} value={debt.accountName} onChange={e => updateDebt(debt.id, 'accountName', e.target.value)} />
                </div>
              </>)}
              {debt.paymentMethod === 'แคชเชียร์เช็ก' && (
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>สั่งจ่ายในนาม</label>
                  <input style={inp} value={debt.checkPayableTo} onChange={e => updateDebt(debt.id, 'checkPayableTo', e.target.value)} placeholder="ชื่อ-นามสกุล หรือ บริษัท" />
                </div>
              )}
            </div>
          </div>
        ))}
        <button onClick={addDebt} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px dashed rgba(239,68,68,.5)', background: 'transparent', color: '#FCA5A5', fontSize: 12, cursor: 'pointer', marginBottom: 4 }}>
          + เพิ่มเจ้าหนี้เดิม
        </button>

        {/* หักล่วงหน้า */}
        <SectionTitle icon="📅" text="หักล่วงหน้า" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <label style={lbl}>จำนวนงวด</label>
            <input style={inp} type="number" value={form.advanceMonths} onChange={e => up('advanceMonths', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={lbl}>ยอด/งวด (บาท)</label>
            <input style={{ ...inp, opacity: 0.6 }} value={monthlyAmount.toLocaleString('th-TH')} readOnly />
          </div>
          <div>
            <label style={lbl}>รวม (บาท)</label>
            <input style={{ ...inp, color: '#FCA5A5' }} value={advanceTotal.toLocaleString('th-TH')} readOnly />
          </div>
        </div>

        {/* ค่านายหน้าภายนอก */}
        <SectionTitle icon="🤝" text="ค่านายหน้าภายนอก" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>ชื่อนายหน้า (ถ้ามี)</label>
            <input style={inp} value={form.externalBrokerName} onChange={e => up('externalBrokerName', e.target.value)} placeholder="ชื่อ-นามสกุล" />
          </div>
          <div>
            <label style={lbl}>ค่านายหน้า (บาท)</label>
            <input style={inp} type="number" value={form.externalBrokerAmount} onChange={e => up('externalBrokerAmount', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={lbl}>วิธีจ่าย</label>
            <select style={{ ...inp, cursor: 'pointer' }} value={form.externalBrokerPayment} onChange={e => up('externalBrokerPayment', e.target.value)}>
              <option value="โอน">เงินโอน</option>
              <option value="เงินสด">เงินสด</option>
            </select>
          </div>
        </div>

        {/* ค่านายหน้าบริษัท */}
        <SectionTitle icon="🏢" text="ค่านายหน้าบริษัท (รายได้ AssetX)" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <label style={lbl}>ประเภท</label>
            <select style={{ ...inp, cursor: 'pointer' }} value={form.companyFeeType} onChange={e => up('companyFeeType', e.target.value)}>
              <option value="fixed">ยอดคงที่</option>
              <option value="percent">% ของวงเงิน</option>
            </select>
          </div>
          {form.companyFeeType === 'percent' ? (<>
            <div>
              <label style={lbl}>อัตรา (%)</label>
              <input style={inp} type="number" step="0.1" value={form.companyFeeRate} onChange={e => up('companyFeeRate', e.target.value)} placeholder="เช่น 2" />
            </div>
            <div>
              <label style={lbl}>ยอด (คำนวณแล้ว)</label>
              <input style={{ ...inp, color: BRAND.gold }} value={companyFee.toLocaleString('th-TH')} readOnly />
            </div>
          </>) : (
            <div style={{ gridColumn: '2/-1' }}>
              <label style={lbl}>ยอด (บาท)</label>
              <input style={{ ...inp, color: BRAND.gold }} type="number" value={form.companyFeeAmount} onChange={e => up('companyFeeAmount', e.target.value)} placeholder="0" />
            </div>
          )}
        </div>

        {/* Summary */}
        <div style={{ marginTop: 20, padding: 16, background: 'rgba(0,0,0,.4)', borderRadius: 12, border: `1px solid ${BRAND.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.textSec, marginBottom: 10 }}>สรุปการเบิกจ่าย</div>
          {[
            ['วงเงินอนุมัติ', approved, BRAND.textPri, false],
            ['หักทุนเก่า', totalDebt, '#FCA5A5', true],
            ['หักล่วงหน้า', advanceTotal, '#FCA5A5', true],
            ['ค่านายหน้าภายนอก', externalFee, '#FCA5A5', true],
            ['ค่านายหน้าบริษัท', companyFee, BRAND.gold, true],
          ].filter(([, val]) => val > 0).map(([label, val, color, minus]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${BRAND.border}`, fontSize: 13 }}>
              <span style={{ color: BRAND.textSec }}>{label}</span>
              <span style={{ color, fontWeight: 600 }}>{minus ? '−' : ''}{val.toLocaleString('th-TH')}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 16, fontWeight: 800 }}>
            <span style={{ color: BRAND.textPri }}>ยอดที่ลูกค้าได้รับจริง</span>
            <span style={{ color: net >= 0 ? BRAND.teal : '#FCA5A5' }}>{net.toLocaleString('th-TH')} ฿</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', color: BRAND.textSec, fontSize: 13, cursor: 'pointer' }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '10px 0', borderRadius: 8, background: saving ? 'rgba(45,212,191,.3)' : 'linear-gradient(135deg,#2DD4BF,#0E7490)', border: 'none', color: '#000', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการเบิกจ่าย'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Main App Component
export default function App() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [filter, setFilter] = useState("all");
  const [mainTab, setMainTab] = useState("dashboard");
  const [expandedId, setExpandedId] = useState(null);
  const [expandedDeeds, setExpandedDeeds] = useState({});
  const [slipModal, setSlipModal] = React.useState(null); // { customer, payment }
  const [postponeModal, setPostponeModal] = React.useState(null); // { customer, payment }
  const [cancelConfirm, setCancelConfirm] = React.useState(null); // customer object
  const [cancelling, setCancelling] = React.useState(false);
  const [editCustomerModal, setEditCustomerModal] = React.useState(null); // customer object
  const [disbursementModal, setDisbursementModal] = React.useState(null); // customer object
  const [toast, setToast] = useState(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [currentView, setCurrentView] = useState("main");
  const [triggerActive, setTriggerActive] = useState(
    () => localStorage.getItem("assetx_trigger_active") === "true"
  );

  // ── User ID Management + Real-time Sync ────────────────────
  const [targetUserId, setTargetUserId] = useState(
    () => localStorage.getItem("assetx_target_user_id") || ""
  );
  const [savedUserIds, setSavedUserIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("assetx_saved_user_ids") || "[]"); }
    catch { return []; }
  });
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error

  // ── ข้อมูลเพิ่มเติมลูกค้า (สำหรับจดหมาย Notice) ────────────────
  const [customerExtraInfo, setCustomerExtraInfo] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("assetx_customer_extra_info") || "{}"); }
    catch { return {}; }
  });
  const updateCustomerExtraInfo = React.useCallback((customerId, info) => {
    setCustomerExtraInfo(prev => {
      const updated = { ...prev, [customerId]: { ...prev[customerId], ...info } };
      localStorage.setItem("assetx_customer_extra_info", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ── counter เลขที่หนังสือ ────────────────────────────────────────
  const [noticeCounter, setNoticeCounter] = React.useState(() => {
    return parseInt(localStorage.getItem("assetx_notice_counter") || "0");
  });
  const getDocNumber = React.useCallback(() => {
    const next = noticeCounter + 1;
    setNoticeCounter(next);
    localStorage.setItem("assetx_notice_counter", String(next));
    const year = new Date().getFullYear() + 543;
    return `ขฝ.${String(next).padStart(3,"0")}/${year}`;
  }, [noticeCounter]);

  // ── สถานะสัญญา (ปิดแล้ว) ────────────────────────────────────────
  const [contractStatuses, setContractStatuses] = React.useState({});

  React.useEffect(() => {
    apiGetContractStatuses()
      .then(data => setContractStatuses(data))
      .catch(() => {});
  }, []);

  const closeContract = React.useCallback(async (customer) => {
    if (!window.confirm(`ยืนยันปิดสัญญาของ คุณ${customer.name}?\n\nระบบจะหยุดแจ้งเตือนสัญญานี้ทั้งหมด`)) return;
    setContractStatuses(prev => ({ ...prev, [customer.id]: { status: 'ปิดแล้ว', customerName: customer.name } }));
    await apiCloseContract(customer.id, customer.name).catch(() => {});
  }, []);

  const reopenContract = React.useCallback(async (customer) => {
    if (!window.confirm(`ยืนยันเปิดสัญญาคุณ${customer.name} ใหม่?\n\nระบบจะกลับมาแจ้งเตือนตามปกติ`)) return;
    setContractStatuses(prev => { const n = { ...prev }; delete n[customer.id]; return n; });
    await apiReopenContract(customer.id).catch(() => {});
  }, []);

  // ── บันทึกการชำระเงิน (สลิป) ────────────────────────────────────
  const [paymentRecords, setPaymentRecords] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("assetx_payment_records") || "{}"); }
    catch { return {}; }
  });

  // โหลดข้อมูลจาก Supabase เพื่อ sync ข้ามอุปกรณ์
  React.useEffect(() => {
    apiGetPaymentRecords()
      .then(data => {
        if (Object.keys(data).length > 0) {
          setPaymentRecords(data);
          localStorage.setItem("assetx_payment_records", JSON.stringify(data));
        }
      })
      .catch(() => {});
  }, []);

  const savePaymentRecord = React.useCallback((customerId, installment, record) => {
    setPaymentRecords(prev => {
      const updated = { ...prev, [customerId]: { ...prev[customerId], [installment]: record } };
      localStorage.setItem("assetx_payment_records", JSON.stringify(updated));
      return updated;
    });
    apiSavePaymentRecord(customerId, installment, record).catch(() => {});
  }, []);

  const deletePaymentRecord = React.useCallback((customerId, installment) => {
    setPaymentRecords(prev => {
      const cust = { ...prev[customerId] };
      delete cust[installment];
      const updated = { ...prev, [customerId]: cust };
      localStorage.setItem("assetx_payment_records", JSON.stringify(updated));
      return updated;
    });
    apiDeletePaymentRecord(customerId, installment).catch(() => {});
  }, []);

  // ── LINE User ID รายลูกค้า ──────────────────────────────────
  const [customerLineIds, setCustomerLineIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("assetx_customer_line_ids") || "{}"); }
    catch { return {}; }
  });
  const updateCustomerLineId = useCallback((customerId, lineUserId) => {
    setCustomerLineIds(prev => {
      const updated = { ...prev, [customerId]: lineUserId };
      localStorage.setItem("assetx_customer_line_ids", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // sync savedUserIds → Apps Script PropertiesService
  const syncToScript = useCallback(async (ids) => {
    setSyncStatus("syncing");
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateDestinations", destinations: ids }),
      });
      setSyncStatus("synced");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (err) {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 4000);
    }
  }, []);

  // โหลด destinations จาก Supabase (merge กับ localStorage)
  useEffect(() => {
    apiGetDestinations()
      .then(rows => {
        if (rows.length > 0) {
          setSavedUserIds(prev => {
            const merged = rows.map(row => {
              const existing = prev.find(u => u.id === row.id);
              return existing || { id: row.id, label: row.label, savedAt: "จาก Supabase" };
            });
            const extra = prev.filter(u => !rows.find(r => r.id === u.id));
            const result = [...merged, ...extra];
            localStorage.setItem("assetx_saved_user_ids", JSON.stringify(result));
            return result;
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSetTargetUserId = useCallback((id) => {
    const trimmed = id.trim();
    setTargetUserId(trimmed);
    if (trimmed) localStorage.setItem("assetx_target_user_id", trimmed);
    else localStorage.removeItem("assetx_target_user_id");
  }, []);

  const handleSaveNewUserId = useCallback((id, label) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setSavedUserIds(prev => {
      const exists = prev.find(u => u.id === trimmed);
      let updated;
      if (exists) {
        updated = [{ ...exists, label: label || exists.label, savedAt: new Date().toLocaleString("th-TH") },
          ...prev.filter(u => u.id !== trimmed)];
      } else {
        updated = [{ id: trimmed, label: label || trimmed.substring(0, 12) + "...", savedAt: new Date().toLocaleString("th-TH") },
          ...prev];
      }
      localStorage.setItem("assetx_saved_user_ids", JSON.stringify(updated));
      syncToScript(updated); // ← sync ทันที
      return updated;
    });
    handleSetTargetUserId(trimmed);
  }, [handleSetTargetUserId, syncToScript]);

  const handleDeleteSavedUserId = useCallback((id) => {
    setSavedUserIds(prev => {
      const updated = prev.filter(u => u.id !== id);
      localStorage.setItem("assetx_saved_user_ids", JSON.stringify(updated));
      syncToScript(updated); // ← sync ทันที
      return updated;
    });
    if (targetUserId === id) handleSetTargetUserId("");
  }, [targetUserId, handleSetTargetUserId, syncToScript]);
  // ───────────────────────────────────────────────────────────

  const lineHook = useLineNotification(targetUserId);
  const [lineTokens, setLineTokens] = React.useState({});

  const generateToken = React.useCallback(async (customerId, customerName) => {
    setLineTokens(prev => ({ ...prev, [customerId]: { loading: true } }));
    try {
      const res = await fetch(
        `${APPS_SCRIPT_URL}?action=generateRegistrationToken&customerId=${encodeURIComponent(customerId)}&customerName=${encodeURIComponent(customerName)}`
      ).then(r => r.json());
      if (res.success) {
        setLineTokens(prev => ({ ...prev, [customerId]: { token: res.token, expiresAt: res.expiresAt } }));
      } else {
        setLineTokens(prev => ({ ...prev, [customerId]: { error: res.error } }));
      }
    } catch {
      setLineTokens(prev => ({ ...prev, [customerId]: { error: 'เชื่อมต่อไม่ได้' } }));
    }
  }, []);

  const [today, setToday] = React.useState(() => new Date());
  React.useEffect(() => {
    const now = new Date();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
    const timer = setTimeout(() => setToday(new Date()), msUntilMidnight);
    return () => clearTimeout(timer);
  }, [today]);
  const thToday = formatThai(
    `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
      today.getDate()
    )}`
  );

  // นาฬิกา real-time
  const [nowTime, setNowTime] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetCustomers();
      if (data.length > 0) {
        const merged = data.map(c => {
          const mock = MOCK_DATA.find(m => m.id === c.id || m.name === c.name) || {};
          return { ...mock, ...c };
        });
        setCustomers(merged);
        lineHook.addLog("success", "✅ โหลดข้อมูลลูกค้าสำเร็จ " + merged.length + " ราย");
      } else {
        setCustomers(MOCK_DATA);
        lineHook.addLog("info", "ℹ️ ยังไม่มีข้อมูลใน Supabase — ใช้ข้อมูล fallback");
      }
      setLastFetch(new Date().toLocaleTimeString("th-TH"));
      setApiConnected(true);
    } catch (e) {
      setCustomers(MOCK_DATA);
      setError(e.message);
      setApiConnected(false);
      lineHook.addLog("error", "❌ โหลดข้อมูลไม่สำเร็จ: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [lineHook]);

  useEffect(() => {
    fetchData();
  }, []);

  const enriched = useMemo(
    () =>
      customers.map((c) => ({
        ...c,
        deeds: parseDeeds(c.deeds),
        isClosed: contractStatuses[c.id]?.status === 'ปิดแล้ว',
        isVoided: contractStatuses[c.id]?.status === 'ยกเลิก',
        payments: (c.payments || []).map((p) => {
          const diff = getDiff(p.dateStr, today);
          const record = paymentRecords[c.id]?.[p.installment];
          const status = record ? "paid" : payStatus(diff);
          return { ...p, diff, status, record: record || null };
        }),
        contractDiff: c.contractEndDate
          ? getDiff(c.contractEndDate, today)
          : null,
      })),
    [customers, today, paymentRecords, contractStatuses]
  );

  const payAlerts = useMemo(() => {
    const r = [];
    enriched.forEach((c) => {
      if (c.isClosed || c.isVoided) return;
      c.payments.forEach((p) => {
        if (p.status === "today" || p.status === "soon") r.push({ c, p });
      });
    });
    return r.sort((a, b) => a.p.diff - b.p.diff);
  }, [enriched]);

  const overdueAlerts = useMemo(() => {
    const r = [];
    enriched.forEach((c) => {
      if (c.isClosed || c.isVoided) return;
      c.payments.forEach((p) => {
        if (p.status === "past") r.push({ c, p });
      });
    });
    return r.sort((a, b) => a.p.diff - b.p.diff); // เรียงเกินนานที่สุดก่อน
  }, [enriched]);

  const contractAlerts = useMemo(
    () =>
      enriched
        .filter((c) => !c.isClosed && !c.isVoided && c.contractDiff !== null && c.contractDiff <= 180)
        .sort((a, b) => a.contractDiff - b.contractDiff),
    [enriched]
  );

  const filtered = useMemo(
    () =>
      enriched
        .map((c) => {
          if (c.isVoided) return null; // ซ่อนลูกค้าที่ถูกยกเลิก
          if (filter === "mortgage" && c.type !== "จำนอง") return null;
          if (filter === "sell" && c.type !== "ขายฝาก") return null;
          let pays = c.payments;
          if (filter === "today")
            pays = pays.filter((p) => p.status === "today");
          else if (filter === "soon")
            pays = pays.filter(
              (p) => p.status === "today" || p.status === "soon"
            );
          if ((filter === "today" || filter === "soon") && pays.length === 0)
            return null;
          return { ...c, payments: pays };
        })
        .filter(Boolean),
    [enriched, filter]
  );

  const totalPrincipal = enriched.reduce((s, c) => s + (c.principal || 0), 0);

  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setToast({ success: true, message: "📋 คัดลอกแล้ว!" });
      setTimeout(() => setToast(null), 2000);
    });
  };

  const handleLineSend = (success, name) => {
    if (success) {
      lineHook.addLog("success", `✅ ส่ง LINE ถึง ${name} สำเร็จ`);
    } else {
      lineHook.addLog("error", `❌ ส่ง LINE ถึง ${name} ล้มเหลว`);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div
        style={{
          minHeight: "100vh",
          background: `radial-gradient(ellipse at 20% 0%, rgba(45,212,191,.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(124,58,237,.07) 0%, transparent 50%), ${BRAND.bg}`,
          paddingBottom: 72,
        }}
      >
        {/* Navbar */}
        <nav
          className="glass"
          style={{
            borderBottom: "1px solid rgba(45,212,191,.12)",
            padding: "0 20px",
            position: "sticky",
            top: 0,
            zIndex: 200,
          }}
        >
          <div
            style={{
              maxWidth: 1040,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: 60,
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Logo size={40} />
              <div>
                <div
                  style={{
                    fontFamily: "'Kanit',sans-serif",
                    fontSize: 15,
                    fontWeight: 700,
                    background: "linear-gradient(90deg,#2DD4BF,#A78BFA)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  AssetX Estate
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

              {/* วันที่ + เวลา real-time */}
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "flex-end",
                padding: "4px 10px",
                background: "rgba(45,212,191,.06)",
                border: "1px solid rgba(45,212,191,.15)",
                borderRadius: 10,
                lineHeight: 1.4,
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: BRAND.teal, letterSpacing: 0.3 }}>
                  {formatThaiLong(`${nowTime.getFullYear()}-${pad(nowTime.getMonth()+1)}-${pad(nowTime.getDate())}`)}
                </span>
                <span style={{
                  fontSize: 16, fontWeight: 700, color: BRAND.textPri,
                  fontFamily: "monospace", letterSpacing: 1,
                }}>
                  {pad(nowTime.getHours())}:{pad(nowTime.getMinutes())}:{pad(nowTime.getSeconds())}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                }}
              >
                <span
                  className={`status-dot ${
                    apiConnected ? "success" : "warning"
                  }`}
                ></span>
                <span style={{ color: apiConnected ? "#4ADE80" : "#F59E0B" }}>
                  {apiConnected ? "Online" : "Offline"}
                </span>
              </div>
              <button
                onClick={() => setCurrentView(v => v === "valuation" ? "main" : "valuation")}
                style={{
                  background: currentView === "valuation" ? "rgba(45,212,191,0.15)" : "rgba(245,158,11,0.12)",
                  border: `1px solid ${currentView === "valuation" ? BRAND.teal : BRAND.gold}`,
                  padding: "6px 14px",
                  borderRadius: 8,
                  color: currentView === "valuation" ? BRAND.teal : BRAND.gold,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🏠 ประเมิน
              </button>
              <button
                onClick={fetchData}
                className="btn"
                style={{
                  background: BRAND.border,
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: 8,
                  color: BRAND.textSec,
                  fontSize: 11,
                }}
              >
                🔄
              </button>
            </div>
          </div>
        </nav>

        {/* Valuation Page */}
        {currentView === "valuation" && (
          <ValuationPage
            onBack={() => setCurrentView("main")}
            appsScriptUrl={APPS_SCRIPT_URL}
            customers={enriched}
          />
        )}

        {/* Content */}
        {currentView === "main" && <div style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 16px" }}>
          {/* Main Tabs */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <button
              className={`tab ${mainTab === "dashboard" ? "active" : ""}`}
              onClick={() => setMainTab("dashboard")}
              style={mainTab === "dashboard" ? { borderColor: '#7C3AED', background: 'rgba(124,58,237,0.1)', color: '#A78BFA' } : {}}
            >
              📊 Dashboard
            </button>
            <button
              className={`tab ${mainTab === "customers" ? "active" : ""}`}
              onClick={() => setMainTab("customers")}
            >
              👥 ลูกค้า ({enriched.length})
            </button>
            <button
              className={`tab ${mainTab === "payment" ? "active" : ""}`}
              onClick={() => setMainTab("payment")}
            >
              💳 การชำระ ({payAlerts.length > 0 ? `⚠️${payAlerts.length}` : "0"}
              )
            </button>
            <button
              className={`tab ${mainTab === "contract" ? "active" : ""}`}
              onClick={() => setMainTab("contract")}
            >
              📜 สัญญา ({contractAlerts.length})
            </button>
            <button
              className={`tab ${mainTab === "status" ? "active" : ""}`}
              onClick={() => setMainTab("status")}
            >
              ⚙️ สถานะระบบ
            </button>
            <button
              className={`tab ${mainTab === "map" ? "active" : ""}`}
              onClick={() => setMainTab("map")}
              style={mainTab === "map" ? { borderColor: '#2DD4BF', background: 'rgba(45,212,191,0.1)', color: '#2DD4BF' } : {}}
            >
              🗺️ แผนที่ทรัพย์
            </button>
            <button
              className={`tab ${mainTab === "investor" ? "active" : ""}`}
              onClick={() => setMainTab("investor")}
              style={mainTab === "investor" ? { borderColor: '#F59E0B', background: 'rgba(245,158,11,0.1)', color: '#F59E0B' } : {}}
            >
              💼 นายทุน
            </button>
            <button
              className={`tab ${mainTab === "tax" ? "active" : ""}`}
              onClick={() => setMainTab("tax")}
              style={mainTab === "tax" ? { borderColor: '#10B981', background: 'rgba(16,185,129,0.1)', color: '#10B981' } : {}}
            >
              🧮 ภาษี
            </button>
            <button
              className={`tab ${mainTab === "legal" ? "active" : ""}`}
              onClick={() => setMainTab("legal")}
              style={mainTab === "legal" ? { borderColor: '#3B82F6', background: 'rgba(59,130,246,0.1)', color: '#3B82F6' } : {}}
            >
              ⚖️ กฎหมาย
            </button>
            <button
              className={`tab ${mainTab === "reservation" ? "active" : ""}`}
              onClick={() => setMainTab("reservation")}
              style={mainTab === "reservation" ? { borderColor: '#F59E0B', background: 'rgba(245,158,11,0.1)', color: '#F59E0B' } : {}}
            >
              🏷️ ใบจอง
            </button>
          </div>

          {/* Dashboard Tab */}
          {mainTab === "dashboard" && (
            <DashboardPage customers={enriched} paymentRecords={paymentRecords} />
          )}

          {/* System Status Tab */}
          {mainTab === "status" && (
            <SystemStatusPage
              lineHook={lineHook}
              apiConnected={apiConnected}
              lastFetch={lastFetch}
              targetUserId={targetUserId}
              onSetTargetUserId={handleSetTargetUserId}
              savedUserIds={savedUserIds}
              onSaveNewUserId={handleSaveNewUserId}
              onDeleteSavedUserId={handleDeleteSavedUserId}
              syncStatus={syncStatus}
              triggerActive={triggerActive}
              onSetTriggerActive={setTriggerActive}
            />
          )}

          {/* Map Tab */}
          {mainTab === "map" && (
            <MapView appsScriptUrl={APPS_SCRIPT_URL} customers={enriched} />
          )}

          {/* Investor Tab */}
          {mainTab === "investor" && (
            <InvestorPage appsScriptUrl={APPS_SCRIPT_URL} />
          )}

          {/* Tax Tab */}
          {mainTab === "tax" && <TaxPage />}

          {/* Legal Tab */}
          {mainTab === "legal" && <LegalPage />}

          {/* Reservation Tab */}
          {mainTab === "reservation" && <ReservationPage />}

          {/* Payment Tab */}
          {mainTab === "payment" && (
            <>
              {/* Stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div
                  className="card"
                  style={{ padding: "14px 16px", textAlign: "center" }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: BRAND.textSec,
                      marginBottom: 4,
                    }}
                  >
                    📋 ลูกค้าทั้งหมด
                  </div>
                  <div
                    style={{ fontSize: 24, fontWeight: 700, color: BRAND.teal }}
                  >
                    {enriched.length}
                  </div>
                </div>
                <div
                  className="card"
                  style={{ padding: "14px 16px", textAlign: "center" }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: BRAND.textSec,
                      marginBottom: 4,
                    }}
                  >
                    💰 เงินต้นรวม
                  </div>
                  <div
                    style={{ fontSize: 16, fontWeight: 700, color: BRAND.gold }}
                  >
                    {formatMoney(totalPrincipal)} ฿
                  </div>
                </div>
                <div
                  className="card"
                  style={{
                    padding: "14px 16px",
                    textAlign: "center",
                    background:
                      payAlerts.length > 0 ? "rgba(239,68,68,.08)" : undefined,
                    borderColor: payAlerts.length > 0 ? "#EF4444" : undefined,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: BRAND.textSec,
                      marginBottom: 4,
                    }}
                  >
                    ⚠️ ต้องแจ้งเตือน
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: payAlerts.length > 0 ? "#FCA5A5" : "#4ADE80",
                    }}
                  >
                    {payAlerts.length}
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {payAlerts.length > 0 && (
                <div
                  className="card"
                  style={{
                    padding: 16,
                    marginBottom: 20,
                    borderColor: "#EF4444",
                    background: "rgba(239,68,68,.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#FCA5A5",
                        fontSize: 14,
                      }}
                    >
                      🚨 รายการต้องแจ้งเตือนด่วน
                    </div>
                    <span style={{ fontSize: 11, color: BRAND.textSec }}>
                      {thToday}
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {payAlerts.slice(0, 5).map(({ c, p }, i) => {
                      const st = P_STATUS[p.status];
                      const msg =
                        p.diff <= 0
                          ? msgPayment(c, p, "due")
                          : msgPayment(c, p, "early");
                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            background: "rgba(0,0,0,.3)",
                            borderRadius: 10,
                            border: `1px solid ${st.border}40`,
                            flexWrap: "wrap",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              flex: 1,
                              minWidth: 200,
                            }}
                          >
                            <span style={{ fontSize: 18 }}>
                              {c.icon || "🏠"}
                            </span>
                            <div>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: BRAND.textPri,
                                  fontSize: 13,
                                }}
                              >
                                {c.name}
                              </div>
                              <div
                                style={{ fontSize: 11, color: BRAND.textSec }}
                              >
                                งวด {p.installment} • {formatThai(p.dateStr)}
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                padding: "3px 10px",
                                borderRadius: 20,
                                background: st.bg,
                                border: `1px solid ${st.border}`,
                                color: st.text,
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              {p.diff === 0 ? "วันนี้!" : `อีก ${p.diff} วัน`}
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                color: BRAND.gold,
                                fontSize: 13,
                              }}
                            >
                              {formatMoney(c.amount)} ฿
                            </span>
                            <LineButton
                              message={msg}
                              type="payment"
                              label="ส่ง LINE"
                              compact
                              onSend={(ok) => handleLineSend(ok, c.name)}
                              destinationId={targetUserId}
                            />
                            <button
                              onClick={() => setPostponeModal({ customer: c, payment: p })}
                              className="btn"
                              style={{ padding: "4px 10px", borderRadius: 7, fontSize: 11, border: "1px solid rgba(251,146,60,.4)", background: "rgba(251,146,60,.08)", color: "#FB923C", cursor: "pointer" }}
                            >
                              📅 เลื่อน
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── ค้างชำระ (เลยกำหนดยังไม่ชำระ) ── */}
              {overdueAlerts.length > 0 && (
                <div className="card" style={{ borderColor: "rgba(251,146,60,.4)", background: "rgba(251,146,60,.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, color: "#FB923C", fontSize: 14 }}>
                      ⏰ ค้างชำระ ({overdueAlerts.length} งวด)
                    </div>
                    <span style={{ fontSize: 11, color: BRAND.textSec }}>เลยกำหนดแล้วยังไม่ได้บันทึก</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {overdueAlerts.map(({ c, p }, i) => (
                      <div
                        key={i}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(0,0,0,.3)", borderRadius: 10, border: "1px solid rgba(251,146,60,.3)", flexWrap: "wrap", gap: 8 }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 180 }}>
                          <span style={{ fontSize: 18 }}>{c.icon || "🏠"}</span>
                          <div>
                            <div style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 13 }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: BRAND.textSec }}>
                              งวด {p.installment} • {formatThai(p.dateStr)}
                              {p.postponedFrom && (
                                <span style={{ color: "#FB923C", marginLeft: 6 }}>(เลื่อนจาก {formatThai(p.postponedFrom)})</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(251,146,60,.15)", border: "1px solid rgba(251,146,60,.5)", color: "#FB923C", fontSize: 11, fontWeight: 600 }}>
                            เลย {Math.abs(p.diff)} วัน
                          </span>
                          <span style={{ fontWeight: 700, color: BRAND.gold, fontSize: 13 }}>
                            {formatMoney(c.amount)} ฿
                          </span>
                          <button
                            onClick={() => setPostponeModal({ customer: c, payment: p })}
                            className="btn"
                            style={{ padding: "4px 10px", borderRadius: 7, fontSize: 11, border: p.postponedFrom ? "1px solid rgba(251,146,60,.6)" : "1px solid rgba(251,146,60,.4)", background: p.postponedFrom ? "rgba(251,146,60,.18)" : "rgba(251,146,60,.08)", color: "#FB923C", cursor: "pointer" }}
                          >
                            {p.postponedFrom ? "🔄 เลื่อนแล้ว" : "📅 เลื่อนนัด"}
                          </button>
                          <button
                            onClick={() => setSlipModal({ customer: c, payment: p })}
                            className="btn"
                            style={{ padding: "4px 10px", borderRadius: 7, fontSize: 11, border: "1px solid rgba(45,212,191,.3)", background: "rgba(45,212,191,.08)", color: BRAND.teal, cursor: "pointer" }}
                          >
                            💳 บันทึกชำระ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {payAlerts.length === 0 && (
                <div
                  className="card"
                  style={{ padding: 40, textAlign: "center" }}
                >
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <div
                    style={{
                      color: "#4ADE80",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    ไม่มีรายการต้องแจ้งเตือน
                  </div>
                  <div style={{ color: BRAND.textSec, fontSize: 13 }}>
                    ทุกรายการยังไม่ถึงกำหนดชำระ
                  </div>
                </div>
              )}
            </>
          )}

          {/* Contract Tab */}
          {mainTab === "contract" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {contractAlerts.length === 0 ? (
                <div
                  className="card"
                  style={{ padding: 40, textAlign: "center" }}
                >
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <div style={{ color: "#4ADE80", fontWeight: 600 }}>
                    ไม่มีสัญญาที่ใกล้ครบกำหนดใน 6 เดือน
                  </div>
                </div>
              ) : (
                contractAlerts.map((c) => {
                  const cSt = contractStatus(c.contractDiff);
                  const st = C_STATUS[cSt];
                  const msg = msgContract(c, c.contractDiff);
                  return (
                    <div
                      key={c.id}
                      className="card"
                      style={{
                        padding: 16,
                        borderColor: st.border,
                        background: st.bg,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 12,
                              background: c.color || BRAND.teal,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 20,
                            }}
                          >
                            {c.icon || "🏠"}
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                color: BRAND.textPri,
                                fontSize: 15,
                              }}
                            >
                              {c.name}
                            </div>
                            <div style={{ fontSize: 12, color: BRAND.textSec }}>
                              {c.fullLabel}
                            </div>
                            <TypeBadge type={c.type} />
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              padding: "4px 12px",
                              borderRadius: 20,
                              background: st.bg,
                              border: `1px solid ${st.border}`,
                              color: st.text,
                              fontSize: 11,
                              fontWeight: 600,
                              marginBottom: 6,
                            }}
                          >
                            {st.label} •{" "}
                            {c.contractDiff >= 0
                              ? `อีก ${c.contractDiff} วัน`
                              : "หมดอายุแล้ว"}
                          </div>
                          <div style={{ fontSize: 12, color: BRAND.textSec }}>
                            📆 {formatThaiLong(c.contractEndDate)}
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: BRAND.gold,
                              marginTop: 2,
                            }}
                          >
                            {formatMoney(c.principal)} ฿
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <LineButton
                              message={msg}
                              type="contract"
                              label="ส่ง LINE"
                              onSend={(ok) => handleLineSend(ok, c.name)}
                              destinationId={targetUserId}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Customers Tab */}
          {mainTab === "customers" && (
            <>
              {loading ? (
                <Skeleton />
              ) : error ? (
                <div
                  className="card"
                  style={{ padding: 32, textAlign: "center", color: "#FCA5A5" }}
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
                  <div>{error}</div>
                  <button
                    onClick={fetchData}
                    className="btn"
                    style={{
                      marginTop: 16,
                      padding: "8px 20px",
                      background: BRAND.teal,
                      border: "none",
                      borderRadius: 8,
                      color: "#000",
                      fontWeight: 600,
                    }}
                  >
                    ลองใหม่
                  </button>
                </div>
              ) : (
                <>
                  {/* Filters */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    {[
                      ["all", "ทั้งหมด"],
                      ["today", "วันนี้"],
                      ["soon", "≤7 วัน"],
                      ["mortgage", "จำนอง"],
                      ["sell", "ขายฝาก"],
                    ].map(([k, l]) => (
                      <button
                        key={k}
                        className={`tab ${filter === k ? "active" : ""}`}
                        onClick={() => setFilter(k)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>

                  {/* Customer List */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {filtered.map((c) => {
                      const isExp = expandedId === c.id;
                      const nextPay =
                        c.payments.find((p) => p.diff >= 0) || c.payments[0];
                      return (
                        <div
                          key={c.id}
                          className="card"
                          style={{ overflow: "hidden", opacity: c.isClosed ? 0.6 : 1 }}
                        >
                          <div
                            style={{
                              padding: 16,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                            }}
                            onClick={() => setExpandedId(isExp ? null : c.id)}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                              }}
                            >
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 12,
                                  background: c.isClosed ? '#334155' : (c.color || BRAND.teal),
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 20,
                                  flexShrink: 0,
                                }}
                              >
                                {c.isClosed ? "🔒" : (c.icon || "🏠")}
                              </div>
                              <div>
                                <div
                                  style={{
                                    fontWeight: 700,
                                    color: c.isClosed ? BRAND.textMut : BRAND.textPri,
                                    fontSize: 15,
                                    textDecoration: c.isClosed ? 'line-through' : 'none',
                                  }}
                                >
                                  {c.name}
                                </div>
                                <div
                                  style={{ fontSize: 12, color: BRAND.textSec }}
                                >
                                  {c.fullLabel}
                                </div>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                                  <TypeBadge type={c.type} />
                                  {c.isClosed && (
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(100,116,139,0.2)', color: '#94A3B8', border: '1px solid rgba(100,116,139,0.4)' }}>
                                      🔒 ปิดแล้ว
                                    </span>
                                  )}
                                  {c.lineUserId ? (
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(6,199,85,0.15)', color: '#06C755', border: '1px solid rgba(6,199,85,0.4)' }}>
                                      ✅ LINE
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(251,191,36,0.15)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.4)' }}>
                                      ⚠️ ยังไม่มี LINE
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              {nextPay && (
                                <div
                                  style={{
                                    padding: "3px 10px",
                                    borderRadius: 20,
                                    background: P_STATUS[nextPay.status].bg,
                                    border: `1px solid ${
                                      P_STATUS[nextPay.status].border
                                    }`,
                                    color: P_STATUS[nextPay.status].text,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    marginBottom: 4,
                                  }}
                                >
                                  งวด {nextPay.installment} •{" "}
                                  {nextPay.diff === 0
                                    ? "วันนี้"
                                    : nextPay.diff > 0
                                    ? `อีก ${nextPay.diff} วัน`
                                    : "ชำระแล้ว"}
                                </div>
                              )}
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: BRAND.gold,
                                }}
                              >
                                {formatMoney(c.amount)} ฿/{c.freq}
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: BRAND.textMut,
                                  marginTop: 2,
                                }}
                              >
                                เงินต้น: {formatMoney(c.principal)} ฿
                              </div>
                              <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}>
                                <button
                                  onClick={e => { e.stopPropagation(); setEditCustomerModal(c); }}
                                  style={{
                                    padding: '3px 10px', borderRadius: 6,
                                    background: 'rgba(45,212,191,.1)', border: '1px solid rgba(45,212,191,.3)',
                                    color: BRAND.teal, fontSize: 11, cursor: 'pointer',
                                  }}
                                >✏️ แก้ไข</button>
                                <button
                                  onClick={e => { e.stopPropagation(); setDisbursementModal(c); }}
                                  style={{
                                    padding: '3px 10px', borderRadius: 6,
                                    background: c.disbursement?.netDisbursement ? 'rgba(245,158,11,.15)' : 'rgba(245,158,11,.07)',
                                    border: `1px solid ${c.disbursement?.netDisbursement ? 'rgba(245,158,11,.6)' : 'rgba(245,158,11,.25)'}`,
                                    color: BRAND.gold, fontSize: 11, cursor: 'pointer',
                                  }}
                                >💰 เบิกจ่าย</button>
                                {!c.lineUserId && (
                                  <button
                                    onClick={e => { e.stopPropagation(); generateToken(c.id, c.name); }}
                                    style={{
                                      padding: '3px 10px', borderRadius: 6,
                                      background: 'rgba(6,199,85,.1)', border: '1px solid rgba(6,199,85,.3)',
                                      color: '#06C755', fontSize: 11, cursor: 'pointer',
                                    }}
                                  >
                                    {lineTokens[c.id]?.loading ? '⏳' : '📲 สร้างรหัส LINE'}
                                  </button>
                                )}
                                <button
                                  onClick={e => { e.stopPropagation(); setCancelConfirm(c); }}
                                  style={{
                                    padding: '3px 10px', borderRadius: 6,
                                    background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)',
                                    color: '#FCA5A5', fontSize: 11, cursor: 'pointer',
                                  }}
                                >🚫 ยกเลิกสัญญา</button>
                              </div>
                              {(() => {
                                const tk = lineTokens[c.id];
                                if (!tk || tk.loading) return null;
                                if (tk.error) return (
                                  <div style={{ marginTop: 6, fontSize: 11, color: '#F87171', textAlign: 'right' }}>❌ {tk.error}</div>
                                );
                                return (
                                  <div onClick={e => e.stopPropagation()} style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(6,199,85,0.08)', border: '1px solid rgba(6,199,85,0.3)', textAlign: 'right' }}>
                                    <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 4 }}>รหัสลงทะเบียน LINE (หมดอายุ {tk.expiresAt})</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                      <span style={{ fontSize: 16, fontWeight: 800, color: '#06C755', letterSpacing: 2 }}>{tk.token}</span>
                                      <button
                                        onClick={() => { navigator.clipboard.writeText(tk.token); }}
                                        style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(6,199,85,.2)', border: '1px solid rgba(6,199,85,.4)', color: '#06C755', fontSize: 10, cursor: 'pointer' }}
                                      >คัดลอก</button>
                                    </div>
                                    <div style={{ fontSize: 10, color: BRAND.textSec, marginTop: 4 }}>
                                      แจ้งลูกค้าพิมพ์ใน LINE: <strong style={{ color: BRAND.textPri }}>/ลงทะเบียน {tk.token}</strong>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {isExp && (
                            <div
                              style={{
                                borderTop: `1px solid ${BRAND.border}`,
                                padding: 16,
                                background: "rgba(0,0,0,.2)",
                              }}
                            >
                              {/* ── โฉนดที่ดิน ── */}
                              {c.deeds && c.deeds.length > 0 && (
                                <div style={{ marginBottom: 20 }}>
                                  {/* Header กดได้ */}
                                  <div
                                    onClick={() => setExpandedDeeds(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                                    style={{
                                      display: "flex", alignItems: "center", justifyContent: "space-between",
                                      padding: "10px 14px",
                                      background: expandedDeeds[c.id] ? "rgba(45,212,191,.1)" : "rgba(45,212,191,.05)",
                                      border: "1px solid rgba(45,212,191,.2)",
                                      borderRadius: expandedDeeds[c.id] ? "10px 10px 0 0" : 10,
                                      cursor: "pointer",
                                      transition: "all .2s",
                                      userSelect: "none",
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontSize: 15 }}>📜</span>
                                      <span style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 13 }}>
                                        โฉนดที่ดิน
                                      </span>
                                      <span style={{
                                        background: "rgba(45,212,191,.2)", color: BRAND.teal,
                                        fontSize: 10, fontWeight: 700,
                                        padding: "2px 8px", borderRadius: 20,
                                      }}>
                                        {c.deeds.length} แปลง
                                      </span>
                                      {/* Preview โฉนดแปลงแรก เมื่อยังไม่ขยาย */}
                                      {!expandedDeeds[c.id] && (
                                        <span style={{ fontSize: 11, color: BRAND.textSec }}>
                                          น.ส.4 เลขที่ {c.deeds[0].no} · ต.{c.deeds[0].tambon} จ.{c.deeds[0].province}
                                          {c.deeds.length > 1 ? ` +${c.deeds.length - 1}` : ""}
                                        </span>
                                      )}
                                    </div>
                                    <span style={{
                                      color: BRAND.teal, fontSize: 14, fontWeight: 700,
                                      transform: expandedDeeds[c.id] ? "rotate(180deg)" : "rotate(0deg)",
                                      transition: "transform .25s",
                                      display: "inline-block",
                                    }}>▼</span>
                                  </div>

                                  {/* เนื้อหาโฉนด แสดงเมื่อขยาย */}
                                  {expandedDeeds[c.id] && (
                                    <div style={{
                                      border: "1px solid rgba(45,212,191,.2)",
                                      borderTop: "none",
                                      borderRadius: "0 0 10px 10px",
                                      overflow: "hidden",
                                    }}>
                                      {c.deeds.map((d, idx) => (
                                        <div key={idx} style={{
                                          padding: "12px 14px",
                                          background: idx % 2 === 0 ? "rgba(45,212,191,.03)" : "rgba(0,0,0,.15)",
                                          borderTop: idx > 0 ? "1px solid rgba(45,212,191,.1)" : "none",
                                          display: "grid",
                                          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                                          gap: "8px 16px",
                                        }}>
                                          {c.deeds.length > 1 && (
                                            <div style={{ gridColumn: "1 / -1", marginBottom: 4 }}>
                                              <span style={{
                                                fontSize: 10, fontWeight: 700, color: BRAND.teal,
                                                background: "rgba(45,212,191,.15)", padding: "2px 8px", borderRadius: 6,
                                              }}>
                                                แปลงที่ {idx + 1}
                                              </span>
                                            </div>
                                          )}
                                          <div>
                                            <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 2 }}>เลขโฉนด</div>
                                            <div style={{ fontWeight: 700, color: BRAND.teal, fontSize: 14 }}>น.ส.4 เลขที่ {d.no || "-"}</div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 2 }}>เนื้อที่</div>
                                            <div style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 13 }}>{d.area || "-"}</div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 2 }}>ที่ตั้ง</div>
                                            <div style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 13 }}>
                                              ต.{d.tambon || "-"} อ.{d.amphoe || "-"}
                                              <br />
                                              <span style={{ color: BRAND.textSec, fontSize: 12 }}>จ.{d.province || "-"}</span>
                                            </div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 2 }}>หน้าสำรวจ / เลขที่ดิน</div>
                                            <div style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 12 }}>
                                              {d.surveyPage || "-"} / {d.landNo || "-"}
                                            </div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 2 }}>ระวาง</div>
                                            <div style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 12, fontFamily: "monospace" }}>
                                              {d.mapRef || "-"}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* ── ข้อมูล Notice (เฉพาะขายฝาก) ── */}
                              {c.type === "ขายฝาก" && (() => {
                                const daysLeft = Math.ceil((new Date(c.contractEndDate) - new Date()) / 86400000);
                                const showNotice = daysLeft <= 180 && daysLeft >= 0;
                                const urgent = daysLeft <= 90;
                                return (
                                  <div style={{ marginBottom: 16 }}>
                                    <CustomerExtraInfoSection
                                      customer={c}
                                      extraInfoMap={customerExtraInfo}
                                      onUpdate={updateCustomerExtraInfo}
                                    />
                                    {showNotice && (
                                      <div style={{
                                        padding: "12px 14px", borderRadius: 10, marginBottom: 8,
                                        background: urgent ? "rgba(239,68,68,.06)" : "rgba(245,158,11,.06)",
                                        border: `1px solid ${urgent ? "rgba(239,68,68,.3)" : "rgba(245,158,11,.3)"}`,
                                      }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                                          <div>
                                            <div style={{ fontWeight: 700, color: urgent ? "#FCA5A5" : "#FDE68A", fontSize: 13 }}>
                                              {urgent ? "🚨" : "⚠️"} ครบกำหนดไถ่ใน {daysLeft} วัน
                                            </div>
                                            <div style={{ fontSize: 11, color: BRAND.textSec, marginTop: 2 }}>
                                              ต้องส่ง Notice ตาม พ.ร.บ. ขายฝาก มาตรา 17
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => {
                                              const extra = customerExtraInfo[c.id] || {};
                                              const docNo = getDocNumber();
                                              printNotice(c, extra, docNo);
                                            }}
                                            style={{
                                              padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                                              background: "linear-gradient(135deg,#2DD4BF,#0E7490)",
                                              border: "none", color: "#000", fontWeight: 700, fontSize: 12,
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            📄 สร้าง Notice PDF
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* ── LINE User ID รายลูกค้า ── */}
                              <CustomerLineIdSection
                                customer={c}
                                customerLineIds={customerLineIds}
                                savedUserIds={savedUserIds}
                                onUpdate={updateCustomerLineId}
                              />

                              {/* ── สรุปการเบิกจ่าย ── */}
                              {c.disbursement?.netDisbursement > 0 && (
                                <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 10 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.gold }}>💰 สรุปการเบิกจ่าย</div>
                                    <button onClick={e => { e.stopPropagation(); setDisbursementModal(c); }} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(245,158,11,.4)', background: 'transparent', color: BRAND.gold, cursor: 'pointer' }}>แก้ไข</button>
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
                                    {[
                                      ['วงเงินอนุมัติ', c.disbursement.approvedAmount, BRAND.textPri],
                                      c.disbursement.existingDebts?.length > 0 && ['ทุนเก่า', -c.disbursement.existingDebts.reduce((s, d) => s + (d.amount || 0), 0), '#FCA5A5'],
                                      c.disbursement.advanceTotal > 0 && ['หักล่วงหน้า', -c.disbursement.advanceTotal, '#FCA5A5'],
                                      c.disbursement.externalBrokerAmount > 0 && ['ค่านายหน้าภายนอก', -c.disbursement.externalBrokerAmount, '#FCA5A5'],
                                      c.disbursement.companyFeeAmount > 0 && ['ค่านายหน้าบริษัท', c.disbursement.companyFeeAmount, BRAND.gold],
                                    ].filter(Boolean).map(([label, val, color]) => (
                                      <React.Fragment key={label}>
                                        <span style={{ color: BRAND.textSec }}>{label}</span>
                                        <span style={{ color, fontWeight: 600, textAlign: 'right' }}>{(val < 0 ? '−' : '') + Math.abs(val).toLocaleString('th-TH')}</span>
                                      </React.Fragment>
                                    ))}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(245,158,11,.2)', fontSize: 13, fontWeight: 800 }}>
                                    <span style={{ color: BRAND.textPri }}>ยอดที่ลูกค้าได้รับจริง</span>
                                    <span style={{ color: BRAND.teal }}>{c.disbursement.netDisbursement.toLocaleString('th-TH')} ฿</span>
                                  </div>
                                </div>
                              )}

                              <div
                                style={{
                                  marginBottom: 12,
                                  fontWeight: 600,
                                  color: BRAND.textPri,
                                  fontSize: 13,
                                }}
                              >
                                📅 ตารางชำระ
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 8,
                                }}
                              >
                                {c.payments.map((p, pIdx) => {
                                  const isLastPayment = pIdx === c.payments.length - 1;
                                  const pSt = P_STATUS[p.status];
                                  const msg =
                                    p.status === "today"
                                      ? msgPayment(c, p, "due")
                                      : msgPayment(c, p, "early");
                                  return (
                                    <div
                                      key={p.installment}
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        padding: "10px 14px",
                                        background: pSt.bg,
                                        borderRadius: 10,
                                        border: `1px solid ${pSt.border}40`,
                                        gap: 8,
                                      }}
                                    >
                                      {/* แถวบน: วงกลม + ชื่องวด | ปุ่มต่างๆ */}
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 10,
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: "50%",
                                            background: pSt.border + "30",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontWeight: 700,
                                            fontSize: 12,
                                            color: pSt.text,
                                          }}
                                        >
                                          {p.installment}
                                        </span>
                                        <div>
                                          <div
                                            style={{
                                              fontWeight: 600,
                                              color: BRAND.textPri,
                                              fontSize: 13,
                                            }}
                                          >
                                            งวดที่ {p.installment}
                                          </div>
                                          <div style={{ fontSize: 11, color: BRAND.textSec }}>
                                            {formatThai(p.dateStr)}
                                          </div>
                                          {p.postponedFrom && (
                                            <div style={{ fontSize: 10, color: "#FB923C", marginTop: 1 }}>
                                              เลื่อนจาก {formatThai(p.postponedFrom)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 6,
                                        }}
                                      >
                                        <span
                                          style={{
                                            padding: "3px 10px",
                                            borderRadius: 20,
                                            border: `1px solid ${pSt.border}`,
                                            color: pSt.text,
                                            fontSize: 10,
                                            fontWeight: 600,
                                          }}
                                        >
                                          {pSt.label}
                                        </span>
                                        {/* ปุ่มบันทึกสลิป */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSlipModal({ customer: c, payment: p });
                                          }}
                                          className="btn"
                                          style={{
                                            padding: "3px 8px", borderRadius: 7, fontSize: 10,
                                            border: p.status === "paid"
                                              ? "1px solid rgba(34,197,94,.4)"
                                              : "1px solid rgba(45,212,191,.3)",
                                            background: p.status === "paid"
                                              ? "rgba(34,197,94,.12)"
                                              : "rgba(45,212,191,.08)",
                                            color: p.status === "paid" ? "#86EFAC" : BRAND.teal,
                                          }}
                                        >
                                          {p.status === "paid" ? "🧾 ดูสลิป" : "💳 บันทึก"}
                                        </button>
                                        {/* ปุ่มเลื่อนนัดชำระ (เฉพาะยังไม่ชำระ) */}
                                        {p.status !== "paid" && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setPostponeModal({ customer: c, payment: p });
                                            }}
                                            className="btn"
                                            style={{
                                              padding: "3px 8px", borderRadius: 7, fontSize: 10,
                                              border: p.postponedFrom
                                                ? "1px solid rgba(251,146,60,.6)"
                                                : "1px solid rgba(251,146,60,.3)",
                                              background: p.postponedFrom
                                                ? "rgba(251,146,60,.18)"
                                                : "rgba(251,146,60,.07)",
                                              color: "#FB923C",
                                            }}
                                          >
                                            {p.postponedFrom ? "🔄 เลื่อนแล้ว" : "📅 เลื่อน"}
                                          </button>
                                        )}
                                        {(p.status === "today" ||
                                          p.status === "soon") && (
                                          <LineButton
                                            message={msg}
                                            type="payment"
                                            compact
                                            onSend={(ok) =>
                                              handleLineSend(ok, c.name)
                                            }
                                            destinationId={customerLineIds[c.id] || targetUserId}
                                          />
                                        )}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            copy(msg);
                                          }}
                                          className="btn"
                                          style={{
                                            padding: "3px 8px",
                                            borderRadius: 7,
                                            border: "1px solid rgba(245,158,11,.3)",
                                            background: "rgba(245,158,11,.08)",
                                            color: "#F59E0B",
                                            fontSize: 10,
                                          }}
                                        >
                                          📋
                                        </button>
                                        <a
                                          href={gcalPayment(c, p, false)}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{
                                            padding: "3px 8px",
                                            borderRadius: 7,
                                            border: "1px solid rgba(56,189,248,.3)",
                                            background: "rgba(56,189,248,.08)",
                                            color: "#38BDF8",
                                            fontSize: 10,
                                            textDecoration: "none",
                                          }}
                                          className="btn"
                                        >
                                          📅
                                        </a>
                                      </div>
                                      </div>{/* /แถวบน */}
                                      {/* แสดงข้อมูลสลิปถ้าชำระแล้ว */}
                                      {p.record && (
                                        <div style={{
                                          marginTop: 6, padding: "6px 10px",
                                          background: "rgba(34,197,94,.06)",
                                          border: "1px solid rgba(34,197,94,.2)",
                                          borderRadius: 7, fontSize: 11,
                                          display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
                                        }}>
                                          <span style={{ color: "#86EFAC" }}>✓ ชำระ {(p.record.amountPaid||0).toLocaleString("th-TH")} บาท</span>
                                          <span style={{ color: BRAND.textSec }}>วันที่ {formatThai(p.record.paidDate)}</span>
                                          {p.record.note && <span style={{ color: BRAND.textSec }}>| {p.record.note}</span>}
                                          {(p.record.slipUrl || p.record.slipImage) && (
                                            <button onClick={() => {
                                              const src = p.record.slipUrl || p.record.slipImage;
                                              if (p.record.slipUrl) {
                                                window.open(src, "_blank");
                                              } else {
                                                const win = window.open('', '_blank', 'width=500,height=700');
                                                win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>สลิป</title><style>body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;}img{max-width:100%;max-height:100vh;border-radius:8px;}</style></head><body><img src="${src}" alt="slip"/></body></html>`);
                                                win.document.close();
                                              }
                                            }}
                                              style={{ background: "none", border: "none", color: BRAND.teal, fontSize: 11, cursor: "pointer", padding: 0 }}>
                                              🖼️ ดูสลิป
                                            </button>
                                          )}
                                        </div>
                                      )}

                                      {/* ปุ่มปิดสัญญา — แสดงใต้งวดสุดท้าย */}
                                      {isLastPayment && (
                                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                          {c.isClosed ? (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); reopenContract(c); }}
                                              className="btn"
                                              style={{
                                                padding: '3px 8px', borderRadius: 7, fontSize: 10,
                                                background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.4)',
                                                color: '#2DD4BF', fontWeight: 700, cursor: 'pointer',
                                              }}
                                            >
                                              🔓 เปิดสัญญา
                                            </button>
                                          ) : (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); closeContract(c); }}
                                              className="btn"
                                              style={{
                                                padding: '3px 8px', borderRadius: 7, fontSize: 10,
                                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)',
                                                color: '#FCA5A5', fontWeight: 700, cursor: 'pointer',
                                              }}
                                            >
                                              🔒 ปิดสัญญา
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {filtered.length === 0 && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "50px 20px",
                        color: BRAND.textMut,
                        fontSize: 13,
                      }}
                    >
                      ไม่พบรายการที่ตรงกับเงื่อนไขที่เลือก
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.success ? "" : "error"}`}>
          {toast.success ? "✅" : "❌"} {toast.message}
        </div>
      )}

      {/* Claude AI Chat */}
      {/* <ChatPanel customerData={customers} /> */}

      {/* Edit Customer Modal */}
      {editCustomerModal && (
        <CustomerSheetEditModal
          customer={editCustomerModal}
          appsScriptUrl={APPS_SCRIPT_URL}
          onClose={() => setEditCustomerModal(null)}
          onSaved={(updated) => {
            setCustomers(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
            setEditCustomerModal(null);
          }}
        />
      )}

      {/* Disbursement Modal */}
      {disbursementModal && (
        <DisbursementModal
          customer={disbursementModal}
          onClose={() => setDisbursementModal(null)}
          onSaved={(updated) => {
            setCustomers(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
            setDisbursementModal(null);
          }}
        />
      )}

      {/* Slip Modal */}
      {slipModal && (
        <SlipModal
          customer={slipModal.customer}
          payment={slipModal.payment}
          existing={paymentRecords[slipModal.customer.id]?.[slipModal.payment.installment]}
          onSave={(record) => savePaymentRecord(slipModal.customer.id, slipModal.payment.installment, record)}
          onDelete={() => deletePaymentRecord(slipModal.customer.id, slipModal.payment.installment)}
          onClose={() => setSlipModal(null)}
        />
      )}

      {/* Cancel Contract Confirmation */}
      {cancelConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: BRAND.bgCard, border: '1px solid rgba(239,68,68,.4)', borderRadius: 16, padding: 24, maxWidth: 360, width: '100%' }}>
            <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>🚫</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: BRAND.textPri, textAlign: 'center', marginBottom: 6 }}>ยืนยันยกเลิกสัญญา</div>
            <div style={{ fontSize: 13, color: '#FCA5A5', textAlign: 'center', marginBottom: 4 }}>{cancelConfirm.fullLabel || cancelConfirm.name}</div>
            <div style={{ fontSize: 12, color: BRAND.textSec, textAlign: 'center', marginBottom: 20 }}>
              ลูกค้ารายนี้จะถูกซ่อนออกจากระบบทั้งหมด<br/>ข้อมูลยังคงอยู่ในฐานข้อมูล
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setCancelConfirm(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${BRAND.border}`, background: 'transparent', color: BRAND.textSec, fontSize: 13, cursor: 'pointer' }}
              >ไม่ใช่</button>
              <button
                disabled={cancelling}
                onClick={async () => {
                  setCancelling(true);
                  try {
                    await apiCancelCustomer(cancelConfirm.id);
                    setCustomers(prev => prev.filter(c => c.id !== cancelConfirm.id));
                    setCancelConfirm(null);
                    setToast({ success: true, message: `ยกเลิกสัญญา ${cancelConfirm.name} แล้ว` });
                    setTimeout(() => setToast(null), 3000);
                  } catch (e) {
                    alert('เกิดข้อผิดพลาด: ' + e.message);
                  } finally {
                    setCancelling(false);
                  }
                }}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {cancelling ? '⏳ กำลังยกเลิก...' : '🚫 ยืนยันยกเลิก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Postpone Modal */}
      {postponeModal && (
        <PostponeModal
          customer={postponeModal.customer}
          payment={postponeModal.payment}
          onSave={({ newDate, note }) => {
            const { customer: c, payment: p } = postponeModal;
            setCustomers(prev => prev.map(cust =>
              cust.id !== c.id ? cust : {
                ...cust,
                payments: cust.payments.map(pay =>
                  pay.installment !== p.installment ? pay : {
                    ...pay,
                    dateStr: newDate,
                    postponedFrom: pay.postponedFrom || pay.dateStr,
                    postponeNote: note,
                  }
                ),
              }
            ));
            setPostponeModal(null);
          }}
          onClose={() => setPostponeModal(null)}
        />
      )}
    </>
  );
}

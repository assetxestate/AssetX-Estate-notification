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
  getTopups as apiGetTopups,
  createTopup as apiCreateTopup,
  deleteTopup as apiDeleteTopup,
  saveTopupPaymentRecord as apiSaveTopupPaymentRecord,
  deleteTopupPaymentRecord as apiDeleteTopupPaymentRecord,
  renewContract as apiRenewContract,
} from "./lib/api.js";
import {
  parseDate, formatThai, formatThaiLong, formatMoney, pad, fmtCal,
  getDiff, payStatus, contractStatus, parseDeeds,
  P_STATUS, C_STATUS, styles,
} from "./lib/utils.js";
import { IMGBB_KEY, IMGBB_ALBUMS, gcalPayment, msgPayment, msgContract } from "./lib/messages.js";
import { SENDER_INFO, numberToThaiText, formatThaiDateFull, formatLandArea, printNotice } from "./lib/notice.js";
import { APPS_SCRIPT_URL, LOGO_CONFIG, BRAND } from "./lib/config.js";
import { MOCK_DATA } from "./lib/mockData.js";
import { useLineNotification } from "./hooks/useLineNotification.js";
import { Logo, Skeleton, LineButton, TypeBadge } from "./components/SharedComponents.jsx";
import { SystemStatusPage } from "./components/SystemStatusPage.jsx";
import { SlipModal } from "./components/SlipModal.jsx";
import { CustomerExtraInfoSection } from "./components/CustomerExtraInfoSection.jsx";
import { CustomerSheetEditModal } from "./components/CustomerSheetEditModal.jsx";
import { CustomerLineIdSection } from "./components/CustomerLineIdSection.jsx";
import { PostponeModal } from "./components/PostponeModal.jsx";
import { DisbursementModal } from "./components/DisbursementModal.jsx";
import { TopupModal } from "./components/TopupModal.jsx";
import { AdvancePaymentModal } from "./components/AdvancePaymentModal.jsx";
import { RenewContractModal } from "./components/RenewContractModal.jsx";

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
  const [detailTabs, setDetailTabs] = React.useState({});
  const [customerTopups, setCustomerTopups] = React.useState({});
  const loadedTopupIdsRef = React.useRef(new Set());
  const [topupModal, setTopupModal] = React.useState(null);
  const [topupSlipModal, setTopupSlipModal] = React.useState(null);
  const [advancePaymentModal, setAdvancePaymentModal] = React.useState(null);
  const [renewModal, setRenewModal] = React.useState(null);
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

  React.useEffect(() => {
    if (!expandedId) return;
    if (loadedTopupIdsRef.current.has(expandedId)) return;
    loadedTopupIdsRef.current.add(expandedId);
    apiGetTopups(expandedId)
      .then(data => setCustomerTopups(prev => ({ ...prev, [expandedId]: data })))
      .catch(() => { loadedTopupIdsRef.current.delete(expandedId); });
  }, [expandedId]);

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

  const reloadTopups = React.useCallback(async (customerId) => {
    loadedTopupIdsRef.current.delete(customerId);
    const data = await apiGetTopups(customerId);
    setCustomerTopups(prev => ({ ...prev, [customerId]: data }));
    loadedTopupIdsRef.current.add(customerId);
  }, []);

  const saveTopupPayment = React.useCallback(async (topupId, customerId, installment, record) => {
    await apiSaveTopupPaymentRecord(topupId, customerId, installment, record);
    setCustomerTopups(prev => ({
      ...prev,
      [customerId]: (prev[customerId] || []).map(t =>
        t.id !== topupId ? t : { ...t, records: { ...t.records, [installment]: record } }
      ),
    }));
  }, []);

  const deleteTopupPayment = React.useCallback(async (topupId, customerId, installment) => {
    await apiDeleteTopupPaymentRecord(topupId, installment);
    setCustomerTopups(prev => ({
      ...prev,
      [customerId]: (prev[customerId] || []).map(t => {
        if (t.id !== topupId) return t;
        const records = { ...t.records };
        delete records[installment];
        return { ...t, records };
      }),
    }));
  }, []);

  const saveAdvancePayment = React.useCallback(async (customerId, installments, record) => {
    const newRecs = {};
    installments.forEach(n => { newRecs[n] = { paidDate: record.paidDate, amountPaid: record.amountPaid, note: record.note }; });
    setPaymentRecords(prev => {
      const updated = { ...prev, [customerId]: { ...(prev[customerId] || {}), ...newRecs } };
      localStorage.setItem("assetx_payment_records", JSON.stringify(updated));
      return updated;
    });
    await Promise.all(installments.map(n => apiSavePaymentRecord(customerId, n, { paidDate: record.paidDate, amountPaid: record.amountPaid, note: record.note })));
    setAdvancePaymentModal(null);
  }, []);

  const handleRenewContract = React.useCallback((customer, newEndDate, newPayments) => {
    setCustomers(prev => prev.map(c => {
      if (c.id !== customer.id) return c;
      return {
        ...c,
        contractEndDate: newEndDate,
        payments: [
          ...c.payments,
          ...newPayments.map(p => ({ installment: p.installment, dateStr: p.dateStr })),
        ],
      };
    }));
    setRenewModal(null);
  }, []);

  const handleDeleteTopup = React.useCallback(async (topupId, customerId) => {
    if (!window.confirm("ลบรายการเพิ่มวงเงินนี้?")) return;
    await apiDeleteTopup(topupId);
    setCustomerTopups(prev => ({
      ...prev,
      [customerId]: (prev[customerId] || []).filter(t => t.id !== topupId),
    }));
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
          if (filter === "closed") {
            // แท็บนี้แสดงเฉพาะสัญญาที่ปิดแล้ว/ยกเลิกเท่านั้น (ปกติจะถูกซ่อน/ทำให้จาง)
            if (!c.isClosed && !c.isVoided) return null;
            return c;
          }
          if (c.isVoided) return null; // ซ่อนลูกค้าที่ถูกยกเลิก (ยกเว้นในแท็บ "ปิด/ยกเลิกสัญญา")
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
                      ["closed", "🔒 ปิด/ยกเลิกสัญญา"],
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
                        c.payments.find((p) => p.diff >= 0 && p.status !== 'paid')
                        || c.payments.find((p) => p.diff >= 0)
                        || c.payments[0];
                      return (
                        <div
                          key={c.id}
                          className="card"
                          style={{ overflow: "hidden", opacity: (c.isClosed || c.isVoided) ? 0.6 : 1 }}
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
                                  background: c.isVoided ? '#7C2D12' : (c.isClosed ? '#334155' : (c.color || BRAND.teal)),
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 20,
                                  flexShrink: 0,
                                }}
                              >
                                {c.isVoided ? "🚫" : (c.isClosed ? "🔒" : (c.icon || "🏠"))}
                              </div>
                              <div>
                                <div
                                  style={{
                                    fontWeight: 700,
                                    color: (c.isClosed || c.isVoided) ? BRAND.textMut : BRAND.textPri,
                                    fontSize: 15,
                                    textDecoration: (c.isClosed || c.isVoided) ? 'line-through' : 'none',
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
                                  {c.isVoided && (
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(180,83,9,0.2)', color: '#FB923C', border: '1px solid rgba(180,83,9,0.4)' }}>
                                      🚫 ยกเลิกสัญญา
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
                                  {nextPay.status === 'paid'
                                    ? "ชำระแล้ว"
                                    : nextPay.diff === 0
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
                              {(customerTopups[c.id] || []).length > 0 && (() => {
                                const tops = customerTopups[c.id] || [];
                                const extraPrincipal = tops.reduce((s, t) => s + (t.topupAmount || 0), 0);
                                const extraInterest = tops.reduce((s, t) => s + (t.interestAmount || 0), 0);
                                return (
                                  <div style={{ fontSize: 10, color: BRAND.gold, marginTop: 2, fontWeight: 600 }}>
                                    💵 +{formatMoney(extraPrincipal)} ฿ · ดอกเบี้ยรวม {formatMoney((c.amount || 0) + extraInterest)} ฿/{c.freq}
                                  </div>
                                );
                              })()}
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

                              {/* ── Detail Tabs ── */}
                              <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    onClick={e => { e.stopPropagation(); setDetailTabs(prev => ({ ...prev, [c.id]: 'schedule' })); }}
                                    style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: (detailTabs[c.id] || 'schedule') === 'schedule' ? "rgba(45,212,191,.2)" : "transparent", border: (detailTabs[c.id] || 'schedule') === 'schedule' ? "1px solid rgba(45,212,191,.5)" : `1px solid ${BRAND.border}`, color: (detailTabs[c.id] || 'schedule') === 'schedule' ? BRAND.teal : BRAND.textSec }}
                                  >📅 ตารางชำระ</button>
                                  <button
                                    onClick={e => { e.stopPropagation(); setDetailTabs(prev => ({ ...prev, [c.id]: 'topup' })); }}
                                    style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: (detailTabs[c.id] || 'schedule') === 'topup' ? "rgba(245,158,11,.2)" : "transparent", border: (detailTabs[c.id] || 'schedule') === 'topup' ? "1px solid rgba(245,158,11,.5)" : `1px solid ${BRAND.border}`, color: (detailTabs[c.id] || 'schedule') === 'topup' ? BRAND.gold : BRAND.textSec }}
                                  >💵 วงเงินเพิ่ม{(customerTopups[c.id] || []).length > 0 ? ` (${(customerTopups[c.id] || []).length})` : ""}</button>
                                </div>
                                <div style={{ display: "flex", gap: 4 }}>
                                  {(detailTabs[c.id] || 'schedule') === 'schedule' && (
                                    <>
                                      <button onClick={e => { e.stopPropagation(); setAdvancePaymentModal(c); }}
                                        style={{ padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "rgba(45,212,191,.15)", border: "1px solid rgba(45,212,191,.4)", color: BRAND.teal }}>
                                        💰 ล่วงหน้า
                                      </button>
                                      <button onClick={e => { e.stopPropagation(); setRenewModal(c); }}
                                        style={{ padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.4)", color: BRAND.gold }}>
                                        🔄 ต่ออายุ
                                      </button>
                                    </>
                                  )}
                                  {(detailTabs[c.id] || 'schedule') === 'topup' && (
                                    <button onClick={e => { e.stopPropagation(); setTopupModal(c); }}
                                      style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.4)", color: BRAND.gold }}>
                                      ➕ เพิ่มวงเงิน
                                    </button>
                                  )}
                                </div>
                              </div>
                              {(detailTabs[c.id] || 'schedule') === 'schedule' && (
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
                              )}
                              {/* ── วงเงินเพิ่ม Tab ── */}
                              {(detailTabs[c.id] || 'schedule') === 'topup' && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                  {(customerTopups[c.id] || []).length === 0 ? (
                                    <div style={{ textAlign: "center", padding: "28px 0", color: BRAND.textMut, fontSize: 13 }}>
                                      <div style={{ fontSize: 28, marginBottom: 8 }}>💵</div>
                                      ยังไม่มีการเพิ่มวงเงิน
                                      <div style={{ fontSize: 11, marginTop: 4 }}>กดปุ่ม ➕ เพิ่มวงเงิน เพื่อบันทึกสัญญาเพิ่มวงเงิน</div>
                                    </div>
                                  ) : (customerTopups[c.id] || []).map(topup => {
                                    const tPays = (topup.payments || []).map(tp => {
                                      const diff = getDiff(tp.dateStr, today);
                                      const record = topup.records[tp.installment];
                                      const status = record ? 'paid' : payStatus(diff);
                                      return { ...tp, diff, record, status };
                                    });
                                    const paidCount = tPays.filter(tp => tp.record).length;
                                    return (
                                      <div key={topup.id} style={{ border: "1px solid rgba(245,158,11,.25)", borderRadius: 12, overflow: "hidden" }}>
                                        {/* Topup Header */}
                                        <div style={{ padding: "12px 14px", background: "rgba(245,158,11,.06)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14, color: BRAND.gold }}>
                                              💵 เพิ่มวงเงิน +{formatMoney(topup.topupAmount)} ฿
                                            </div>
                                            <div style={{ fontSize: 11, color: BRAND.textSec, marginTop: 2 }}>
                                              วันที่: {formatThai(topup.topupDate)}{topup.approvedBy ? ` • อนุมัติโดย: ${topup.approvedBy}` : ""}
                                            </div>
                                            <div style={{ fontSize: 12, marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                                              <span style={{ color: BRAND.textSec }}>วงเงินรวม: <span style={{ color: BRAND.textPri, fontWeight: 700 }}>{formatMoney(topup.totalPrincipal)} ฿</span></span>
                                              <span style={{ color: BRAND.textSec }}>ดอกเบี้ย/งวด: <span style={{ color: BRAND.gold, fontWeight: 700 }}>{formatMoney(topup.interestAmount)} ฿/{topup.freq}</span></span>
                                            </div>
                                            {topup.reason && <div style={{ fontSize: 11, color: BRAND.textMut, marginTop: 2 }}>เหตุผล: {topup.reason}</div>}
                                            <div style={{ fontSize: 11, color: BRAND.textSec, marginTop: 4 }}>ชำระแล้ว {paidCount}/{tPays.length} งวด</div>
                                          </div>
                                          <button
                                            onClick={e => { e.stopPropagation(); handleDeleteTopup(topup.id, c.id); }}
                                            style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)", color: "#FCA5A5", fontSize: 10, cursor: "pointer", flexShrink: 0, marginLeft: 8 }}
                                          >🗑️ ลบ</button>
                                        </div>
                                        {/* Topup Payment Schedule */}
                                        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                                          <div style={{ fontSize: 11, fontWeight: 600, color: BRAND.textSec, marginBottom: 2 }}>
                                            📅 ตารางชำระส่วนเพิ่ม ({tPays.length} งวด)
                                          </div>
                                          {tPays.map(tp => {
                                            const pSt = P_STATUS[tp.status];
                                            return (
                                              <div key={tp.installment} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: pSt.bg, borderRadius: 8, border: `1px solid ${pSt.border}40` }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: pSt.border + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: pSt.text, flexShrink: 0 }}>
                                                    {tp.installment}
                                                  </span>
                                                  <div>
                                                    <div style={{ fontSize: 12, fontWeight: 600, color: pSt.text }}>งวดที่ {tp.installment}</div>
                                                    <div style={{ fontSize: 11, color: BRAND.textSec }}>{formatThai(tp.dateStr)}</div>
                                                    <div style={{ fontSize: 10, color: pSt.text, marginTop: 1 }}>
                                                      {tp.record
                                                        ? "ชำระแล้ว ✓"
                                                        : tp.diff === 0
                                                        ? "วันนี้!"
                                                        : tp.diff > 0
                                                        ? `อีก ${tp.diff} วัน`
                                                        : `เกิน ${Math.abs(tp.diff)} วัน`}
                                                    </div>
                                                  </div>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                  {tp.record && (
                                                    <span style={{ fontSize: 11, color: "#86EFAC" }}>✓ {(tp.record.amountPaid || topup.interestAmount).toLocaleString("th-TH")} ฿</span>
                                                  )}
                                                  <button
                                                    onClick={e => { e.stopPropagation(); setTopupSlipModal({ topup, customer: c, payment: tp }); }}
                                                    style={{ padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", background: tp.record ? "rgba(45,212,191,.08)" : "rgba(45,212,191,.15)", border: "1px solid rgba(45,212,191,.3)", color: BRAND.teal }}
                                                  >{tp.record ? "✏️ แก้ไข" : "💳 บันทึก"}</button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

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

      {/* Advance Payment Modal */}
      {advancePaymentModal && (
        <AdvancePaymentModal
          customer={advancePaymentModal}
          onClose={() => setAdvancePaymentModal(null)}
          onSaved={saveAdvancePayment}
        />
      )}

      {/* Renew Contract Modal */}
      {renewModal && (
        <RenewContractModal
          customer={renewModal}
          onClose={() => setRenewModal(null)}
          onSaved={(newEndDate, newPayments) => handleRenewContract(renewModal, newEndDate, newPayments)}
        />
      )}

      {/* Topup Modal */}
      {topupModal && (
        <TopupModal
          customer={topupModal}
          onClose={() => setTopupModal(null)}
          onSaved={() => {
            const id = topupModal.id;
            setTopupModal(null);
            reloadTopups(id);
          }}
        />
      )}

      {/* Topup Slip Modal */}
      {topupSlipModal && (
        <SlipModal
          customer={topupSlipModal.customer}
          payment={topupSlipModal.payment}
          existing={topupSlipModal.topup.records[topupSlipModal.payment.installment]}
          onSave={(record) => {
            saveTopupPayment(topupSlipModal.topup.id, topupSlipModal.customer.id, topupSlipModal.payment.installment, record);
            setTopupSlipModal(null);
          }}
          onDelete={() => {
            deleteTopupPayment(topupSlipModal.topup.id, topupSlipModal.customer.id, topupSlipModal.payment.installment);
            setTopupSlipModal(null);
          }}
          onClose={() => setTopupSlipModal(null)}
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

import React, { useState } from "react";
import { LOGO_CONFIG, APPS_SCRIPT_URL } from "../lib/config.js";

export function Logo({ size = 40 }) {
  const hasBase64 = LOGO_CONFIG.type === "base64" && LOGO_CONFIG.base64;
  const hasUrl = LOGO_CONFIG.type === "url" && LOGO_CONFIG.url;

  if (hasBase64) {
    return (
      <img
        src={`data:image/png;base64,${LOGO_CONFIG.base64}`}
        alt="Logo"
        style={{ width: size, height: size, borderRadius: 10, objectFit: "cover" }}
      />
    );
  }

  if (hasUrl) {
    return (
      <img
        src={LOGO_CONFIG.url}
        alt="Logo"
        style={{ width: size, height: size, borderRadius: 10, objectFit: "cover" }}
      />
    );
  }

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

export function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton" style={{ height: 88 }} />
      ))}
    </div>
  );
}

export function LineButton({
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
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>{" "}
          กำลังส่ง...
        </>
      ) : result === "success" ? (
        <><span>✅</span> ส่งแล้ว!</>
      ) : result === "error" ? (
        <><span>❌</span> ลองใหม่</>
      ) : (
        <><span style={{ fontSize: 14 }}>💬</span> {label}</>
      )}
    </button>
  );
}

export function TypeBadge({ type }) {
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

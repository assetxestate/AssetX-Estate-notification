// ============================================================
// Toast แจ้งเตือนแบบไม่บล็อกหน้าจอ — ใช้แทน alert()
// ใช้: showToast("ข้อความ") หรือ showToast("ข้อความ", "error"|"success"|"info")
// ============================================================

const COLORS = {
  info:    { bg: "#0E7490", icon: "ℹ️" },
  success: { bg: "#059246", icon: "✅" },
  error:   { bg: "#B91C1C", icon: "⚠️" },
};

let container = null;

function ensureContainer() {
  if (container && document.body.contains(container)) return container;
  container = document.createElement("div");
  container.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:360px;";
  document.body.appendChild(container);
  return container;
}

export function showToast(message, type) {
  // เดา type จากข้อความ ถ้าไม่ได้ระบุ
  if (!type) {
    const msg = String(message);
    if (/ผิดพลาด|ไม่สำเร็จ|ไม่ได้|ไม่ถูกต้อง|กรุณา|❌|⚠️/.test(msg)) type = "error";
    else if (/สำเร็จ|เรียบร้อย|✅/.test(msg)) type = "success";
    else type = "info";
  }
  const c = COLORS[type] || COLORS.info;
  const el = document.createElement("div");
  el.style.cssText =
    `background:${c.bg};color:#fff;padding:12px 16px;border-radius:10px;` +
    "font-size:14px;line-height:1.5;box-shadow:0 4px 20px rgba(0,0,0,0.35);" +
    "font-family:'Segoe UI','Noto Sans Thai',sans-serif;white-space:pre-line;word-break:break-word;" +
    "opacity:0;transform:translateX(12px);transition:opacity .25s,transform .25s;cursor:pointer;";
  el.textContent = `${c.icon} ${message}`;
  el.onclick = () => el.remove();
  ensureContainer().appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateX(0)"; });
  const ttl = type === "error" ? 6000 : 3500;
  setTimeout(() => {
    el.style.opacity = "0"; el.style.transform = "translateX(12px)";
    setTimeout(() => el.remove(), 300);
  }, ttl);
}

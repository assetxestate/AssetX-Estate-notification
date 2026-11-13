// ── Date Helpers ────────────────────────────────────────────────
export function parseDate(s) {
  if (!s) return new Date(NaN);
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatThai(s) {
  if (!s) return "—";
  try {
    const d = parseDate(s);
    if (isNaN(d.getTime())) return String(s);
    const M = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear() + 543}`;
  } catch {
    return String(s);
  }
}

export function formatThaiLong(s) {
  try {
    const d = parseDate(s);
    const M = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
               "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear() + 543}`;
  } catch {
    return s;
  }
}

// ── Number / Money Helpers ───────────────────────────────────────
export function formatMoney(n) {
  return Number(n).toLocaleString("th-TH");
}

export function pad(n) {
  return String(n).padStart(2, "0");
}

export function fmtCal(dt) {
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`;
}

// ── Status Helpers ───────────────────────────────────────────────
export function getDiff(s, today) {
  const d = parseDate(s);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d - t) / 86400000);
}

export function payStatus(diff) {
  if (diff < 0) return "past";
  if (diff === 0) return "today";
  if (diff <= 7) return "soon";
  return "upcoming";
}

export function contractStatus(diff) {
  if (diff < 0) return "expired";
  if (diff <= 30) return "critical";
  if (diff <= 90) return "warning";
  if (diff <= 180) return "notice";
  return "safe";
}

// ── Data Parsers ─────────────────────────────────────────────────
export function parseDeeds(raw) {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw || [];
  } catch {
    return [];
  }
}

// ── Status Config ────────────────────────────────────────────────
export const P_STATUS = {
  today:    { bg: "rgba(239,68,68,.12)",   border: "var(--ax-c-ef4444)", text: "var(--ax-c-fca5a5)", label: "วันนี้!" },
  soon:     { bg: "rgba(245,158,11,.1)",   border: "var(--ax-c-f59e0b)", text: "var(--ax-c-fcd34d)", label: "เร็วๆนี้" },
  upcoming: { bg: "rgba(56,189,248,.08)",  border: "var(--ax-c-0ea5e9)", text: "var(--ax-c-38bdf8)", label: "รอชำระ" },
  past:     { bg: "rgba(34,197,94,.08)",   border: "var(--ax-c-16a34a)", text: "var(--ax-c-4ade80)", label: "เลยกำหนด" },
  paid:     { bg: "rgba(34,197,94,.12)",   border: "var(--ax-c-22c55e)", text: "var(--ax-c-86efac)", label: "ชำระแล้ว ✓" },
};

export const C_STATUS = {
  expired:  { border: "var(--ax-c-ef4444)", text: "var(--ax-c-fca5a5)", bg: "rgba(239,68,68,.08)",   label: "หมดอายุ!" },
  critical: { border: "var(--ax-c-ef4444)", text: "var(--ax-c-fca5a5)", bg: "rgba(239,68,68,.08)",   label: "วิกฤต ≤1เดือน" },
  warning:  { border: "var(--ax-c-f59e0b)", text: "var(--ax-c-fcd34d)", bg: "rgba(245,158,11,.08)",  label: "เร่งด่วน ≤3เดือน" },
  notice:   { border: "var(--ax-c-f97316)", text: "var(--ax-c-fdba74)", bg: "rgba(249,115,22,.08)",  label: "แจ้งเตือน ≤6เดือน" },
  safe:     { border: "var(--ax-c-16a34a)", text: "var(--ax-c-4ade80)", bg: "rgba(22,163,74,.08)",   label: "ปกติ" },
};

// ── Global CSS ───────────────────────────────────────────────────
export const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Kanit:wght@400;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--ax-bg); font-family: 'Sarabun', sans-serif; color: var(--ax-text-pri); }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--ax-border-lt) 50%, transparent); border-radius: 4px; }

  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
  @keyframes linePulse{0%,100%{box-shadow:0 0 8px rgba(6,199,85,.3)}50%{box-shadow:0 0 20px rgba(6,199,85,.6)}}

  .card{
    background:linear-gradient(145deg,var(--ax-c-r15-22-45-a900),var(--ax-c-r8-14-32-a950));
    border:1px solid var(--ax-c-0f2545);
    border-radius:18px;
    transition:all .25s;
  }
  .card:hover{border-color:color-mix(in srgb, var(--ax-border-lt) 50%, transparent);transform:translateY(-2px);box-shadow:0 8px 32px var(--ax-c-r0-0-0-a400);}
  .btn{cursor:pointer;font-family:'Sarabun',sans-serif;transition:all .2s;}
  .btn:hover{filter:brightness(1.2);transform:scale(1.02);}
  .glass{background:var(--ax-c-r8-15-30-a850);backdrop-filter:blur(16px);}

  .line-btn{
    background: linear-gradient(135deg, var(--ax-line-green) 0%, var(--ax-line-green-dk) 100%);
    border: none; color: #fff; font-weight: 600;
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 10px; cursor: pointer;
    transition: all 0.2s; font-size: 12px; font-family: 'Sarabun', sans-serif;
  }
  .line-btn:hover{transform: scale(1.03);box-shadow: 0 4px 20px rgba(6,199,85,.4);}
  .line-btn:disabled{opacity: 0.6;cursor: not-allowed;transform: none;}
  .line-btn.sending{animation: linePulse 1s infinite;}

  .skeleton{
    background:linear-gradient(90deg,var(--ax-c-0a1628) 25%,var(--ax-c-0f1e3a) 50%,var(--ax-c-0a1628) 75%);
    background-size:200% 100%;
    animation:shimmer 1.6s infinite;
    border-radius:14px;border:1px solid var(--ax-c-0f2545);
  }

  .badge-mortgage{background:rgba(56,189,248,.12);color:var(--ax-c-38bdf8);border:1px solid rgba(56,189,248,.3);}
  .badge-sell{background:rgba(249,115,22,.12);color:var(--ax-c-fb923c);border:1px solid rgba(249,115,22,.3);}

  .tab{padding:8px 18px;border-radius:30px;border:1.5px solid var(--ax-c-0f2545);background:transparent;color:var(--ax-c-475569);cursor:pointer;font-family:'Sarabun',sans-serif;font-size:12px;transition:all .2s;}
  .tab:hover{border-color:var(--ax-c-162e56);}
  .tab.active{border-color:var(--ax-c-2dd4bf);background:rgba(45,212,191,.1);color:var(--ax-c-2dd4bf);font-weight:600;}

  .toast{
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: linear-gradient(135deg, var(--ax-line-green) 0%, var(--ax-line-green-dk) 100%);
    color: #fff; padding: 12px 24px; border-radius: 12px; font-weight: 600;
    display: flex; align-items: center; gap: 8px; z-index: 1000;
    animation: fadeUp 0.3s ease; box-shadow: 0 8px 32px rgba(6,199,85,.4);
  }
  .toast.error{background: linear-gradient(135deg, var(--ax-c-ef4444) 0%, var(--ax-c-dc2626) 100%);box-shadow: 0 8px 32px rgba(239,68,68,.4);}

  .status-dot{width:10px;height:10px;border-radius:50%;display:inline-block;}
  .status-dot.success{background:var(--ax-c-4ade80);box-shadow:0 0 8px rgba(74,222,128,.5);}
  .status-dot.warning{background:var(--ax-c-f59e0b);box-shadow:0 0 8px rgba(245,158,11,.5);}
  .status-dot.error{background:var(--ax-c-ef4444);box-shadow:0 0 8px rgba(239,68,68,.5);}
  .status-dot.loading{background:var(--ax-c-38bdf8);animation:pulse 1.5s infinite;}

  .log-entry{padding:8px 12px;border-radius:8px;font-size:12px;margin-bottom:6px;font-family:monospace;}
  .log-success{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.3);color:var(--ax-c-4ade80);}
  .log-error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:var(--ax-c-fca5a5);}
  .log-info{background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);color:var(--ax-c-38bdf8);}
`;

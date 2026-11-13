// App configuration constants
const APPS_SCRIPT_URL = import.meta.env.VITE_GAS_URL || "";

const LOGO_CONFIG = {
  // ใช้ไฟล์ static ใน public/ แทน base64 — ลดขนาด bundle ~175KB และให้ browser cache ได้
  type: "url",
  base64: "",
  url: "/logo.jpg",
  fallbackText: "AX",
};

// สีแบรนด์ = ตัวแปร CSS สลับตามโหมดมืด/สว่าง (ค่าจริงอยู่ใน src/theme.css · 13 พ.ย. 2569)
// ใช้ได้เฉพาะในสไตล์ของหน้าเว็บ — ต่อสตริงความโปร่งใสให้ใช้ withAlpha() จาก lib/theme.js · งานที่ต้องการรหัสสีจริง (พิมพ์/PDF/แคนวาส) ใช้ BRAND_HEX
export const BRAND_HEX = {
  teal: "#2DD4BF",
  tealDk: "#0E7490",
  purple: "#7C3AED",
  purpleLt: "#A78BFA",
  orange: "#F97316",
  pink: "#EC4899",
  gold: "#F59E0B",
  bg: "#050B18",
  bgCard: "#080F1E",
  bgGlass: "rgba(8,15,30,0.85)",
  border: "#0F2545",
  borderLt: "#162E56",
  textPri: "#F0F6FF",
  textSec: "#64748B",
  textMut: "#334155",
  lineGreen: "#06C755",
  lineGreenDk: "#059246",
};

export const BRAND = {
  teal: "var(--ax-teal)",
  tealDk: "var(--ax-teal-dk)",
  purple: "var(--ax-purple)",
  purpleLt: "var(--ax-purple-lt)",
  orange: "var(--ax-orange)",
  pink: "var(--ax-pink)",
  gold: "var(--ax-gold)",
  bg: "var(--ax-bg)",
  bgCard: "var(--ax-bg-card)",
  bgGlass: "var(--ax-bg-glass)",
  border: "var(--ax-border)",
  borderLt: "var(--ax-border-lt)",
  textPri: "var(--ax-text-pri)",
  textSec: "var(--ax-text-sec)",
  textMut: "var(--ax-text-mut)",
  lineGreen: "var(--ax-line-green)", // โหมดสว่างเขียวเข้มขึ้นให้ตัวขาวบนปุ่มอ่านได้
  lineGreenDk: "var(--ax-line-green-dk)",
};

export { APPS_SCRIPT_URL, LOGO_CONFIG };

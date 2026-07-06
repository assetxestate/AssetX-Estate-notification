// App configuration constants
const APPS_SCRIPT_URL = import.meta.env.VITE_GAS_URL || "";

const LOGO_CONFIG = {
  // ใช้ไฟล์ static ใน public/ แทน base64 — ลดขนาด bundle ~175KB และให้ browser cache ได้
  type: "url",
  base64: "",
  url: "/logo.jpg",
  fallbackText: "AX",
};

export const BRAND = {
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

export { APPS_SCRIPT_URL, LOGO_CONFIG };

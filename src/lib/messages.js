import { parseDate, formatThai, formatThaiLong, formatMoney, fmtCal } from "./utils.js";

// ── ImgBB Config ─────────────────────────────────────────────────
export const IMGBB_KEY = "c83de7744f238eb8f1d0e87efb8bc639";
export const IMGBB_ALBUMS = {
  "2026-3":  "k5zwF3",
  "2026-4":  "FHR9kk",
  "2026-5":  "wBhbzx",
  "2026-6":  "tqx66x",
  "2026-7":  "BqqfBk",
  "2026-8":  "jP0hTG",
  "2026-9":  "31WZ3s",
  "2026-10": "xmZXwy",
  "2026-11": "KxKbwv",
  "2026-12": "r20fDp",
};

// ── Google Calendar Link ─────────────────────────────────────────
export function gcalPayment(c, p, isReminder) {
  const d = parseDate(p.dateStr);
  const base = new Date(d);
  if (isReminder) base.setDate(base.getDate() - 7);
  const next = new Date(base);
  next.setDate(next.getDate() + 1);
  const title = encodeURIComponent(
    isReminder
      ? `🔔 แจ้งเตือน 7 วัน – ${c.name} งวด ${p.installment}`
      : `💰 ครบชำระ – ${c.name} งวด ${p.installment}`
  );
  const desc = encodeURIComponent(
    `📌 ${c.fullLabel}\n💵 ${formatMoney(c.amount)} บาท\nงวด ${p.installment} · ${formatThai(p.dateStr)}`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmtCal(base)}/${fmtCal(next)}&details=${desc}`;
}

// ── LINE Message Templates ───────────────────────────────────────
export function msgPayment(c, p, type) {
  const dt = formatThaiLong(p.dateStr);
  const amt = formatMoney(c.amount);
  const label = c.type === "จำนอง" ? "ดอกเบี้ยจำนอง" : "ดอกเบี้ยขายฝาก";
  const bankInfo = `💳 ช่องทางชำระเงิน:\nธนาคาร กสิกรไทย\nชื่อบัญชี: กิตติชัย โสมทัตถ์\nเลขบัญชี: 194-8-33331-3`;

  if (type === "early") {
    return `📢 แจ้งเตือนล่วงหน้า 7 วัน\n\nเรียน คุณ${c.name},\n\nAssetX Estate Co., Ltd. ขอแจ้งให้ทราบว่า\nครบกำหนดชำระ${label}งวดที่ ${p.installment} ในอีก 7 วันข้างหน้า\n\n📌 รายละเอียด:\n• ประเภท: ${c.type}\n• ยอดชำระ: ${amt} บาท\n• งวดที่: ${p.installment}\n• กำหนดชำระ: ${dt}\n\n${bankInfo}\n\nAssetX Estate Co., Ltd. 🏠`;
  }
  return `⚠️ วันนี้ครบกำหนดชำระ\n\nเรียน คุณ${c.name},\n\nวันนี้ (${dt}) ครบกำหนดชำระ${label}งวดที่ ${p.installment}\n\n📌 รายละเอียด:\n• ประเภท: ${c.type}\n• ยอดชำระ: ${amt} บาท\n\n${bankInfo}\n\n⚠️ กรุณาชำระและส่งสลิปยืนยันด้วย\n\nAssetX Estate Co., Ltd. 🏠`;
}

export function msgContract(c, diff) {
  const mo = Math.max(0, Math.floor(diff / 30));
  return `📜 แจ้งเตือนครบกำหนดสัญญา\n\nเรียน คุณ${c.name},\n\nสัญญา${c.type}จะครบกำหนดในอีก ${mo} เดือน\n\n📌 รายละเอียด:\n• เงินต้น: ${formatMoney(c.principal)} บาท\n• วันครบกำหนด: ${formatThaiLong(c.contractEndDate)}\n\n🔔 กรุณาดำเนินการก่อนวันครบกำหนด\n\nAssetX Estate Co., Ltd. 🏠`;
}

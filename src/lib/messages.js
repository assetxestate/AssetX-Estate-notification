import { parseDate, formatThai, formatThaiLong, formatMoney, fmtCal } from "./utils.js";
import { boldAmount, paymentTotal, amountDue } from "./combinedPayment.js";

// ── ImgBB Config ─────────────────────────────────────────────────
// SECURITY: key เดิมรั่วใน git แล้ว — แนะนำ regenerate ที่ api.imgbb.com แล้วใส่ใน .env.local
export const IMGBB_KEY = import.meta.env?.VITE_IMGBB_KEY || "";
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

const PAYMENT_CLOSING = `📩 เพื่อรักษาสถานะสัญญา รบกวนดำเนินการภายในวันที่กำหนด
และกรุณาแจ้งหลักฐานการโอนเงินเพื่อยืนยันรายการครับ

ขอบคุณครับ🙏
บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด 🏠`;

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
    `📌 ${c.fullLabel}\n💵 ${formatMoney(amountDue(c.amount, p.balance))} บาท${p.balance?.state === "partial" ? " (ส่วนที่ยังขาด)" : ""}\nงวด ${p.installment} · ${formatThai(p.dateStr)}`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmtCal(base)}/${fmtCal(next)}&details=${desc}`;
}

export function gcalTopupPayment(c, topup, p, isReminder) {
  const d = parseDate(p.dateStr);
  const base = new Date(d);
  if (isReminder) base.setDate(base.getDate() - 7);
  const next = new Date(base);
  next.setDate(next.getDate() + 1);
  const title = encodeURIComponent(
    isReminder
      ? `แจ้งเตือนวงเงินเพิ่ม - ${c.name} งวด ${p.installment}`
      : `ครบชำระวงเงินเพิ่ม - ${c.name} งวด ${p.installment}`
  );
  const desc = encodeURIComponent(
    `${c.fullLabel || c.name}\nวงเงินเพิ่ม ${formatMoney(topup.topupAmount)} บาท\nดอกเบี้ยส่วนเพิ่ม ${formatMoney(amountDue(topup.interestAmount, p.balance))} บาท${p.balance?.state === "partial" ? " (ส่วนที่ยังขาด)" : ""}\nงวด ${p.installment} · ${formatThai(p.dateStr)}`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmtCal(base)}/${fmtCal(next)}&details=${desc}`;
}

// ── LINE Message Templates ───────────────────────────────────────
// งวดที่จ่ายไม่ครบ: บอกยอดที่จ่ายแล้ว (และที่ยกเว้นให้ ถ้ามี) จากยอดเต็ม — ยอดชำระในข้อความ = ยอดที่ยังขาด ตัวเลขจึงรวมกันลงตัว
function partialNote(balance) {
  if (balance?.state !== "partial") return "";
  const waived = Number(balance.waived) > 0 ? ` · ยกเว้น ${formatMoney(balance.waived)} บาท` : "";
  return `\n• ชำระแล้ว: ${formatMoney(balance.paid)} บาท${waived} จากยอด ${formatMoney(balance.due)} บาท`;
}

export function msgPayment(c, p, type) {
  const dt = formatThaiLong(p.dateStr);
  const amt = formatMoney(amountDue(c.amount, p.balance));
  const paidLine = partialNote(p.balance);
  const label = c.type === "จำนอง" ? "ดอกเบี้ยจำนอง" : "ดอกเบี้ยขายฝาก";
  const bankInfo = `💳 ช่องทางชำระเงิน:\nธนาคาร กสิกรไทย\nชื่อบัญชี: กิตติชัย โสมทัตถ์\nเลขบัญชี: 194-8-33331-3`;

  if (type === "overdue") {
    return `⚠️ แจ้งเตือนเกินกำหนดชำระ\n\nเรียน คุณ${c.name},\n\n${label}งวดที่ ${p.installment} เกินกำหนดชำระ ${Math.abs(Number(p.diff) || 0)} วัน\n\n📌 รายละเอียด:\n• ประเภท: ${c.type}\n• ยอดชำระ: ${amt} บาท${paidLine}\n• งวดที่: ${p.installment}\n• กำหนดชำระ: ${dt}\n\n${bankInfo}\n\n${PAYMENT_CLOSING}`;
  }
  if (type === "early") {
    // จำนวนวันจริงก่อนครบ (ปุ่มนี้ขึ้นตั้งแต่ 1–7 วันก่อน) · ไม่รู้จำนวนวันใช้ 7 ตามเดิม
    const days = Number(p.diff) > 0 ? Number(p.diff) : 7;
    return `📢 แจ้งเตือนล่วงหน้า ${days} วัน\n\nเรียน คุณ${c.name},\n\nบริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด ขอแจ้งให้ทราบว่า\nครบกำหนดชำระ${label}งวดที่ ${p.installment} ในอีก ${days} วันข้างหน้า\n\n📌 รายละเอียด:\n• ประเภท: ${c.type}\n• ยอดชำระ: ${amt} บาท${paidLine}\n• งวดที่: ${p.installment}\n• กำหนดชำระ: ${dt}\n\n${bankInfo}\n\n${PAYMENT_CLOSING}`;
  }
  return `⚠️ วันนี้ครบกำหนดชำระ\n\nเรียน คุณ${c.name},\n\nวันนี้ (${dt}) ครบกำหนดชำระ${label}งวดที่ ${p.installment}\n\n📌 รายละเอียด:\n• ประเภท: ${c.type}\n• ยอดชำระ: ${amt} บาท${paidLine}\n\n${bankInfo}\n\n${PAYMENT_CLOSING}`;
}

// ข้อความรวมของทุกรายการที่ครบวันเดียวกัน · mains = งวดสัญญาหลักของวันนั้น (รับแถวเดียวแบบเดิมได้ · ว่างได้เมื่อมีแต่วงเงินเพิ่ม
// · หลายงวดได้เมื่อเลื่อนส่วนที่ขาดมาชนงวดถัดไป) · type: early | due | overdue · diff ใช้เมื่อไม่มีงวดสัญญาหลักให้อ่านจำนวนวัน
export function msgCombinedPayment(c, mainOrMains, topupEntries, type, diff) {
  const mains = (Array.isArray(mainOrMains) ? mainOrMains : [mainOrMains]).filter(Boolean);
  const date = formatThaiLong(mains[0]?.dateStr || topupEntries[0]?.payment?.dateStr);
  const dayDiff = Number(mains[0]?.diff ?? diff);
  const days = Math.max(0, dayDiff || 7);
  const interestLabel = c.type === "จำนอง" ? "ดอกจำนอง" : "ดอกเบี้ยขายฝาก";
  const subject = mains.length ? `${interestLabel}งวดที่ ${mains.map((p) => p.installment).join(", ")}` : "ดอกเบี้ยวงเงินเพิ่ม";
  const partialTag = (balance) => (balance?.state === "partial" ? " (ส่วนที่ยังขาด)" : "");
  const total = mains.reduce((sum, p) => sum + amountDue(c.amount, p.balance), 0) + paymentTotal(0, topupEntries);
  const lines = [
    type === "early" ? "📢 แจ้งเตือนชำระเงินล่วงหน้า" : type === "overdue" ? "⚠️ แจ้งเตือนเกินกำหนดชำระ" : "⚠️ แจ้งเตือนครบกำหนดชำระ",
    `เรียน คุณ${c.name}`,
    type === "early"
      ? `บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด ขอแจ้งให้ทราบว่า\nครบกำหนดชำระ${subject} ในอีก ${days} วันข้างหน้า`
      : type === "overdue"
        ? `${subject} เกินกำหนดชำระ ${Math.abs(dayDiff || 0)} วัน`
        : `วันนี้ครบกำหนดชำระ${subject}`,
    `รายการที่ครบกำหนดวันที่ ${date}`,
    ...mains.map((p) => `• สัญญาหลัก งวดที่ ${p.installment}: ${formatMoney(amountDue(c.amount, p.balance))} บาท${partialTag(p.balance)}`),
    ...topupEntries.map(({ topup, payment, balance }) =>
      `• วงเงินเพิ่ม ${formatMoney(topup.topupAmount)} บาท งวดที่ ${payment.installment}: ${formatMoney(amountDue(topup.interestAmount, balance))} บาท${partialTag(balance)}`),
    `💰 รวมยอดที่ต้องชำระ\n${boldAmount(total)} บาท`,
    `💳 ช่องทางชำระเงิน:\nธนาคาร กสิกรไทย\nชื่อบัญชี: กิตติชัย โสมทัตถ์\nเลขบัญชี: 194-8-33331-3`,
    PAYMENT_CLOSING,
  ];
  return lines.join("\n\n");
}

// ข้อความฉบับเดียวของกลุ่ม "ลูกค้า + วันครบกำหนด" (จาก sameDayGroup) เลือกแบบเดียวกับงานเตือนตอนเช้า:
// งวดสัญญาหลักงวดเดียว → msgPayment · วงเงินเพิ่มงวดเดียว → msgTopupPayment · มากกว่านั้น → ข้อความรวม
export function msgPaymentGroup(c, group, type) {
  const { mains, extras, diff } = group;
  if (!mains.length && !extras.length) return "";
  if (mains.length === 1 && extras.length === 0) return msgPayment(c, mains[0], type);
  if (mains.length === 0 && extras.length === 1) {
    const [{ topup, payment, balance }] = extras;
    return msgTopupPayment(c, topup, { ...payment, balance, diff }, type);
  }
  return msgCombinedPayment(c, mains, extras, type, diff);
}

export function msgTopupPayment(c, topup, p, type) {
  const dt = formatThaiLong(p.dateStr);
  const amount = formatMoney(amountDue(topup.interestAmount, p.balance));
  const topupAmount = formatMoney(topup.topupAmount);
  const days = Math.max(0, Number(p.diff) || 0);
  const bankInfo = `💳 ช่องทางชำระเงิน:\nธนาคาร กสิกรไทย\nชื่อบัญชี: กิตติชัย โสมทัตถ์\nเลขบัญชี: 194-8-33331-3`;
  const details = `📌 รายละเอียด:\n• ประเภท: ดอกเบี้ยวงเงินเพิ่ม${c.type ? ` (${c.type})` : ""}\n• วงเงินเพิ่ม: ${topupAmount} บาท\n• ยอดชำระ: ${amount} บาท${partialNote(p.balance)}\n• งวดที่: ${p.installment}\n• กำหนดชำระ: ${dt}`;

  if (type === "overdue") {
    return [
      "⚠️ แจ้งเตือนเกินกำหนดชำระวงเงินเพิ่ม",
      `เรียน คุณ${c.name},`,
      `ดอกเบี้ยวงเงินเพิ่มงวดที่ ${p.installment} เกินกำหนดชำระ ${Math.abs(Number(p.diff) || 0)} วัน`,
      details,
      bankInfo,
      PAYMENT_CLOSING,
    ].join("\n\n");
  }
  if (type === "early") {
    return [
      `📢 แจ้งเตือนล่วงหน้า ${days} วัน`,
      `เรียน คุณ${c.name},`,
      `บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด ขอแจ้งให้ทราบว่า\nดอกเบี้ยวงเงินเพิ่มงวดที่ ${p.installment} จะครบกำหนดในอีก ${days} วัน`,
      details,
      bankInfo,
      PAYMENT_CLOSING,
    ].join("\n\n");
  }
  return [
    "⚠️ วันนี้ครบกำหนดชำระวงเงินเพิ่ม",
    `เรียน คุณ${c.name},`,
    `วันนี้ (${dt}) ครบกำหนดชำระดอกเบี้ยวงเงินเพิ่มงวดที่ ${p.installment}`,
    details,
    bankInfo,
    PAYMENT_CLOSING,
  ].join("\n\n");
}

export function msgContract(c, diff) {
  const mo = Math.max(0, Math.floor(diff / 30));
  return `📜 แจ้งเตือนครบกำหนดสัญญา\n\nเรียน คุณ${c.name},\n\nสัญญา${c.type}จะครบกำหนดในอีก ${mo} เดือน\n\n📌 รายละเอียด:\n• เงินต้น: ${formatMoney(c.principal)} บาท\n• วันครบกำหนด: ${formatThaiLong(c.contractEndDate)}\n\n🔔 กรุณาดำเนินการก่อนวันครบกำหนด\n\nบริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด 🏠`;
}

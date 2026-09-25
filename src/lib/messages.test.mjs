import assert from "node:assert/strict";
import { gcalTopupPayment, msgTopupPayment } from "./messages.js";

const customer = { name: "นาย สิทธิชัย คล้ายพลับ", fullLabel: "นาย สิทธิชัย คล้ายพลับ (จำนอง)", type: "จำนอง" };
const topup = { topupAmount: 700_000, interestAmount: 8_400, freq: "เดือน" };
const payment = { installment: 1, dateStr: "2026-09-30", diff: 5 };

const earlyMessage = msgTopupPayment(customer, topup, payment, "early");
const expectedEarlyMessage = `📢 แจ้งเตือนล่วงหน้า 5 วัน

เรียน คุณนาย สิทธิชัย คล้ายพลับ,

บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด ขอแจ้งให้ทราบว่า
ดอกเบี้ยวงเงินเพิ่มงวดที่ 1 จะครบกำหนดในอีก 5 วัน

📌 รายละเอียด:
• ประเภท: ดอกเบี้ยวงเงินเพิ่ม (จำนอง)
• วงเงินเพิ่ม: 700,000 บาท
• ยอดชำระ: 8,400 บาท
• งวดที่: 1
• กำหนดชำระ: 30 กันยายน 2569

💳 ช่องทางชำระเงิน:
ธนาคาร กสิกรไทย
ชื่อบัญชี: กิตติชัย โสมทัตถ์
เลขบัญชี: 194-8-33331-3

📩 เพื่อรักษาสถานะสัญญา รบกวนดำเนินการภายในวันที่กำหนด
และกรุณาแจ้งหลักฐานการโอนเงินเพื่อยืนยันรายการครับ

ขอบคุณครับ🙏
บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด 🏠`;
assert.equal(earlyMessage, expectedEarlyMessage);
assert.ok(earlyMessage.includes("แจ้งเตือนล่วงหน้า 5 วัน"));
assert.ok(earlyMessage.includes("วงเงินเพิ่ม: 700,000 บาท"));
assert.ok(earlyMessage.includes("ยอดชำระ: 8,400 บาท"));
assert.ok(earlyMessage.includes("เลขบัญชี: 194-8-33331-3"));
assert.ok(earlyMessage.includes("เพื่อรักษาสถานะสัญญา รบกวนดำเนินการภายในวันที่กำหนด"));
assert.ok(earlyMessage.includes("ขอบคุณครับ🙏"));

const dueMessage = msgTopupPayment(customer, topup, { ...payment, diff: 0 }, "due");
assert.ok(dueMessage.includes("วันนี้ครบกำหนดชำระวงเงินเพิ่ม"));

const overdueMessage = msgTopupPayment(customer, topup, { ...payment, diff: -3 }, "overdue");
assert.ok(overdueMessage.includes("เกินกำหนดชำระ 3 วัน"));

const calendarUrl = gcalTopupPayment(customer, topup, payment, false);
assert.ok(calendarUrl.startsWith("https://calendar.google.com/calendar/render?"));
assert.ok(calendarUrl.includes("20260930%2F20261001") || calendarUrl.includes("20260930/20261001"));

console.log("messages tests passed");

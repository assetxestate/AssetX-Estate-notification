import assert from "node:assert/strict";
import { gcalTopupPayment, msgTopupPayment } from "./messages.js";

const customer = { name: "ลูกค้าทดสอบ", fullLabel: "ลูกค้าทดสอบ (จำนอง)", type: "จำนอง" };
const topup = { topupAmount: 700_000, interestAmount: 8_400, freq: "เดือน" };
const payment = { installment: 1, dateStr: "2026-09-30", diff: 5 };

const earlyMessage = msgTopupPayment(customer, topup, payment, "early");
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

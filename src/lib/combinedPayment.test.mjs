import test from 'node:test';
import assert from 'node:assert/strict';
import { boldAmount, unpaidTopupsOnDate, paymentTotal } from './combinedPayment.js';
import { msgCombinedPayment } from './messages.js';

const dateStr = '2026-10-30';
const customer = { name: 'ทดสอบ', type: 'จำนอง', amount: 24000 };
const main = { installment: 4, dateStr, diff: 4 };

test('combines only unpaid topups due on the same date', () => {
  const topups = [
    { topupAmount: 700000, interestAmount: 8400, payments: [{ installment: 1, dateStr }], records: {} },
    { topupAmount: 100000, interestAmount: 1200, payments: [{ installment: 2, dateStr }], records: { 2: { amountPaid: 1200 } } },
    { topupAmount: 50000, interestAmount: 600, payments: [{ installment: 3, dateStr: '2026-11-30' }], records: {} },
  ];
  const entries = unpaidTopupsOnDate(topups, dateStr);
  assert.equal(entries.length, 1);
  assert.equal(paymentTotal(customer.amount, entries), 32400);
  const message = msgCombinedPayment(customer, main, entries, 'due');
  assert.match(message, /สัญญาหลัก งวดที่ 4: 24,000 บาท/);
  assert.match(message, /วงเงินเพิ่ม 700,000 บาท งวดที่ 1: 8,400 บาท/);
  assert.match(message, /รวมยอดที่ต้องชำระ\n𝟑𝟐,𝟒𝟎𝟎 บาท/);
  assert.equal(boldAmount(32400), '𝟑𝟐,𝟒𝟎𝟎');
  assert.doesNotMatch(message, /1,200 บาท|600 บาท/);
  const earlyMessage = msgCombinedPayment(customer, main, entries, 'early');
  assert.match(earlyMessage, /บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด ขอแจ้งให้ทราบว่า\nครบกำหนดชำระดอกจำนองงวดที่ 4 ในอีก 4 วันข้างหน้า/);
});

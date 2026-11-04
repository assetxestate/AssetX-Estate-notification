// ผลแบบเดิมเมื่อผู้เรียกไม่ได้ส่งตัวคิดยอด: มีบันทึก = ครบ
const recordOnly = (topup, payment) => ({ state: topup.records?.[payment.installment] ? 'paid' : 'unpaid' });

// งวดวงเงินเพิ่มที่ยังไม่จบและครบกำหนดวันเดียวกัน (ใช้รวมยอดในข้อความแจ้งเตือน)
// balanceOf(topup, payment) คืนผลของ installmentBalance — งวดที่จ่ายไม่ครบยังนับว่าค้าง และใช้ยอดที่ยังขาด
export function unpaidTopupsOnDate(topups, dateStr, balanceOf = recordOnly) {
  return (topups || []).flatMap(topup =>
    (topup.payments || [])
      .filter(payment => payment.dateStr === dateStr)
      .map(payment => ({ topup, payment, balance: balanceOf(topup, payment) }))
      .filter(({ balance }) => balance?.state !== 'paid')
  );
}

// ยอดที่ต้องชำระของงวดที่ยังไม่จบ: งวดที่จ่ายไม่ครบใช้ยอดที่ยังขาด ไม่ใช่ยอดเต็ม
export function amountDue(fullAmount, balance) {
  return balance?.state === 'partial' ? Number(balance.outstanding) || 0 : Number(fullAmount) || 0;
}

// รายการที่ยังไม่จบของลูกค้าที่ครบวันเดียวกัน: งวดสัญญาหลักทุกงวด + งวดวงเงินเพิ่มทุกวงเงิน
// ใช้ทำข้อความ LINE ฉบับเดียวต่อ "ลูกค้า + วันครบกำหนด" ให้ตรงกับงานเตือนตอนเช้า (planPaymentReminders)
// — เลื่อนส่วนที่ขาดไปชนวันครบของงวดถัดไปแล้ว วงเงินเพิ่มจะไม่ถูกทวงซ้ำสองข้อความ และไม่มีงวดหลุด
// payments ต้องเป็นแถวที่คิดสถานะแล้ว (status/balance) ของลูกค้าทั้งสัญญา (ไม่ใช่ชุดที่ถูกกรอง)
export function sameDayGroup(payments, dateStr, diff, topups, topupBalanceOf) {
  const mains = (payments || [])
    .filter((p) => p.dateStr === dateStr && p.status !== 'paid')
    .sort((a, b) => a.installment - b.installment);
  return { dateStr, diff, mains, extras: unpaidTopupsOnDate(topups, dateStr, topupBalanceOf) };
}

// ยอดรวมของกลุ่ม (งวดที่จ่ายไม่ครบใช้ยอดที่ยังขาด) — ตรงกับยอดรวมในข้อความ
export function groupTotal(mainAmount, group) {
  return group.mains.reduce((sum, p) => sum + amountDue(mainAmount, p.balance), 0)
    + group.extras.reduce((sum, { topup, balance }) => sum + amountDue(topup.interestAmount, balance), 0);
}

// แบบข้อความตามจำนวนวันถึงกำหนด: เลยกำหนด · ครบวันนี้ · ล่วงหน้า
export function messageTypeFor(diff) {
  return diff < 0 ? 'overdue' : diff === 0 ? 'due' : 'early';
}

export function paymentTotal(mainAmount, topupEntries) {
  return (Number(mainAmount) || 0) + topupEntries.reduce(
    (total, { topup, balance }) => total + amountDue(topup.interestAmount, balance), 0
  );
}

export function boldAmount(amount) {
  return Array.from(Number(amount).toLocaleString('th-TH'), char =>
    /[0-9]/.test(char) ? String.fromCodePoint(0x1d7ce + Number(char)) : char
  ).join('');
}

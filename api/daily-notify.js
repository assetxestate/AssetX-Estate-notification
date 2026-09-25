// แจ้งเตือน LINE รายวัน — อ่านข้อมูลจาก Supabase โดยตรง (แทนที่ checkAndSendNotifications ใน GAS ที่ยังอ่านจาก Google Sheet เก่า)
// เรียกผ่าน Vercel Cron ทุกวัน (ดู vercel.json) — ป้องกันด้วย CRON_SECRET
import { createClient } from '@supabase/supabase-js';
import { getNotificationMode, resolveAutomaticRecipient } from './_notification-routing.js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const CONTRACT_REMINDER_DAYS = {
  'ขายฝาก': [180, 150, 90, 60, 30, 7, 3, 0],
  'จำนอง': [60, 30, 7, 3, 0],
};

const PAYMENT_FOOTER = [
  `💳 ช่องทางชำระเงิน:`,
  `ธนาคาร กสิกรไทย`,
  `ชื่อบัญชี: กิตติชัย โสมทัตถ์`,
  `เลขบัญชี: 194-8-33331-3`, ``,
  `📩 เพื่อรักษาสถานะสัญญา รบกวนดำเนินการภายในวันที่กำหนด`,
  `และกรุณาแจ้งหลักฐานการโอนเงินเพื่อยืนยันรายการครับ`, ``,
  `ขอบคุณครับ🙏`,
  `บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด 🏠`,
];

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDays(dateStr, today) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function formatThaiDate(dateStr) {
  const MONTHS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth() + 1]} ${d.getFullYear() + 543}`;
}

function buildDueMsg(name, installment, amount, freq, dateStr) {
  return [
    `📅 ครบกำหนดชำระวันนี้`, ``,
    `เรียน คุณ${name}`,
    `วันนี้เป็นวันครบกำหนดชำระดอกเบี้ย`,
    `งวดที่ ${installment} วันที่ ${formatThaiDate(dateStr)}`, ``,
    `💰 จำนวน: ${Number(amount).toLocaleString('th-TH')} บาท`,
    `📌 ความถี่: ${freq}`, ``,
    ...PAYMENT_FOOTER,
  ].join('\n');
}

function buildEarlyMsg(name, installment, amount, freq, dateStr, days) {
  return [
    `🔔 แจ้งเตือนล่วงหน้า ${days} วัน`, ``,
    `เรียน คุณ${name}`,
    `อีก ${days} วัน จะถึงกำหนดชำระดอกเบี้ย`,
    `งวดที่ ${installment} วันที่ ${formatThaiDate(dateStr)}`, ``,
    `💰 จำนวน: ${Number(amount).toLocaleString('th-TH')} บาท`,
    `📌 ความถี่: ${freq}`, ``,
    ...PAYMENT_FOOTER,
  ].join('\n');
}

function buildTopupDueMsg(name, installment, interestAmount, topupAmount, freq, dateStr) {
  return [
    `📅 ครบกำหนดชำระวงเงินเพิ่มวันนี้`, ``,
    `เรียน คุณ${name}`,
    `วันนี้เป็นวันครบกำหนดชำระดอกเบี้ยวงเงินเพิ่ม`,
    `งวดที่ ${installment} วันที่ ${formatThaiDate(dateStr)}`, ``,
    `💵 วงเงินเพิ่ม: ${Number(topupAmount).toLocaleString('th-TH')} บาท`,
    `💰 ยอดชำระ: ${Number(interestAmount).toLocaleString('th-TH')} บาท`,
    `📌 ความถี่: ${freq}`, ``,
    ...PAYMENT_FOOTER,
  ].join('\n');
}

function buildTopupEarlyMsg(name, installment, interestAmount, topupAmount, freq, dateStr, days) {
  return [
    `🔔 แจ้งเตือนวงเงินเพิ่มล่วงหน้า ${days} วัน`, ``,
    `เรียน คุณ${name}`,
    `อีก ${days} วัน จะถึงกำหนดชำระดอกเบี้ยวงเงินเพิ่ม`,
    `งวดที่ ${installment} วันที่ ${formatThaiDate(dateStr)}`, ``,
    `💵 วงเงินเพิ่ม: ${Number(topupAmount).toLocaleString('th-TH')} บาท`,
    `💰 ยอดชำระ: ${Number(interestAmount).toLocaleString('th-TH')} บาท`,
    `📌 ความถี่: ${freq}`, ``,
    ...PAYMENT_FOOTER,
  ].join('\n');
}

function buildContractMsg(name, type, principal, amount, contractEndDate, daysLeft) {
  const timing = daysLeft === 0 ? 'วันนี้' : `ในอีก ${daysLeft} วัน`;
  const principalAmount = Number(principal) || 0;
  const interestAmount = Number(amount) || 0;
  const legalNote = type === 'ขายฝาก'
    ? 'กรุณาตรวจแผนไถ่ถอน/ขยายสัญญาให้เรียบร้อยก่อนครบกำหนด'
    : 'กรุณาตรวจแผนชำระหนี้และเอกสารสัญญาก่อนเข้าสู่ขั้นตอนติดตาม';
  return [
    `📜 แจ้งเตือนครบกำหนดสัญญา${type || ''}`, ``,
    `เรียน คุณ${name}`,
    `สัญญา${type || ''}ของท่านจะครบกำหนด${timing}`,
    `วันที่ ${formatThaiDate(contractEndDate)}`, ``,
    `💰 เงินต้น: ${principalAmount.toLocaleString('th-TH')} บาท`,
    `💳 สินไถ่รวม: ${(principalAmount + interestAmount).toLocaleString('th-TH')} บาท`, ``,
    legalNote,
    `หนังสือ Notice ได้จัดส่งทางไปรษณีย์แล้ว`,
    `— AssetX Estate —`,
  ].join('\n');
}

async function sendLine(userId, message) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('ไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN');
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: message }] }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE API ${res.status}: ${body}`);
  }
}

export default async function handler(req, res) {
  // Vercel Cron ส่ง Authorization: Bearer $CRON_SECRET มาให้อัตโนมัติเมื่อตั้ง env CRON_SECRET ไว้
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const today = todayMidnight();
  let sentCount = 0;
  let skipCount = 0;
  const errors = [];

  try {
    const deliveryMode = getNotificationMode();
    if (deliveryMode === 'review') resolveAutomaticRecipient('');

    const [{ data: customers, error: custErr }, { data: payments, error: payErr },
           { data: paymentRecords, error: recErr }, { data: statuses, error: statErr },
           { data: topups, error: topupErr }, { data: topupRecords, error: topupRecErr }] =
      await Promise.all([
        supabase.from('customers').select('*').eq('is_cancelled', false),
        supabase.from('payments').select('*'),
        supabase.from('payment_records').select('customer_id, installment'),
        supabase.from('contract_statuses').select('customer_id'),
        supabase.from('contract_topups').select('id, customer_id, topup_amount, interest_amount, freq, payments'),
        supabase.from('topup_payment_records').select('topup_id, installment'),
      ]);
    if (custErr) throw custErr;
    if (payErr) throw payErr;
    if (recErr) throw recErr;
    if (statErr) throw statErr;
    if (topupErr) throw topupErr;
    if (topupRecErr) throw topupRecErr;

    // ลูกค้าที่ปิดสัญญาแล้ว (ไม่ว่าจะปิดแล้ว/ยกเลิก — มีแถวในตารางนี้ = หยุดแจ้งเตือน)
    const closedIds = new Set(statuses.map((s) => s.customer_id));

    // งวดที่จ่ายแล้ว
    const paidKeys = new Set(paymentRecords.map((r) => `${r.customer_id}|${r.installment}`));
    const paidTopupKeys = new Set(topupRecords.map((r) => `${r.topup_id}|${r.installment}`));

    const customerById = Object.fromEntries(customers.map((c) => [c.id, c]));

    for (const p of payments) {
      const c = customerById[p.customer_id];
      if (!c) { skipCount++; continue; } // ลูกค้ายกเลิก/ไม่พบ
      if (closedIds.has(c.id)) { skipCount++; continue; } // ปิดสัญญาแล้ว
      if (paidKeys.has(`${p.customer_id}|${p.installment}`)) { skipCount++; continue; } // จ่ายแล้ว

      const recipientId = resolveAutomaticRecipient(c.line_user_id);
      if (!recipientId) { skipCount++; continue; }

      const diff = diffDays(p.date_str, today);
      try {
        if (diff === 0) {
          await sendLine(recipientId, buildDueMsg(c.name, p.installment, c.amount, c.freq, p.date_str));
          sentCount++;
        } else if (diff === 7) {
          await sendLine(recipientId, buildEarlyMsg(c.name, p.installment, c.amount, c.freq, p.date_str, 7));
          sentCount++;
        }
      } catch (e) {
        errors.push(`${c.name} งวด ${p.installment}: ${e.message}`);
      }
    }

    // แจ้งเตือนงวดดอกเบี้ยของวงเงินเพิ่ม แยกจากตารางชำระสัญญาหลัก
    for (const topup of topups) {
      const c = customerById[topup.customer_id];
      if (!c || closedIds.has(c.id)) { skipCount++; continue; }
      const recipientId = resolveAutomaticRecipient(c.line_user_id);
      if (!recipientId) { skipCount++; continue; }
      const schedule = Array.isArray(topup.payments) ? topup.payments : [];
      for (const payment of schedule) {
        if (paidTopupKeys.has(`${topup.id}|${payment.installment}`)) { skipCount++; continue; }
        const diff = diffDays(payment.dateStr, today);
        try {
          if (diff === 0) {
            await sendLine(recipientId, buildTopupDueMsg(
              c.name, payment.installment, topup.interest_amount,
              topup.topup_amount, topup.freq, payment.dateStr,
            ));
            sentCount++;
          } else if (diff === 7) {
            await sendLine(recipientId, buildTopupEarlyMsg(
              c.name, payment.installment, topup.interest_amount,
              topup.topup_amount, topup.freq, payment.dateStr, 7,
            ));
            sentCount++;
          }
        } catch (e) {
          errors.push(`${c.name} วงเงินเพิ่มงวด ${payment.installment}: ${e.message}`);
        }
      }
    }

    // แจ้งเตือนครบกำหนดสัญญาตาม policy threshold
    for (const c of customers) {
      if (closedIds.has(c.id)) continue;
      if (!c.contract_end_date) continue;
      const recipientId = resolveAutomaticRecipient(c.line_user_id);
      if (!recipientId) continue;
      const reminderDays = CONTRACT_REMINDER_DAYS[c.type] || [30, 7, 3, 0];
      const cDiff = diffDays(c.contract_end_date, today);
      if (reminderDays.includes(cDiff)) {
        try {
          await sendLine(recipientId, buildContractMsg(c.name, c.type, c.principal, c.amount, c.contract_end_date, cDiff));
          sentCount++;
        } catch (e) {
          errors.push(`${c.name} (ครบกำหนดสัญญา): ${e.message}`);
        }
      }
    }

    return res.status(200).json({ success: true, deliveryMode, sentCount, skipCount, errors });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

// แจ้งเตือน LINE รายวัน — อ่านข้อมูลจาก Supabase โดยตรง (แทนที่ checkAndSendNotifications ใน GAS ที่ยังอ่านจาก Google Sheet เก่า)
// เรียกผ่าน Vercel Cron ทุกวัน (ดู vercel.json) — ป้องกันด้วย CRON_SECRET
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const CONTRACT_REMINDER_DAYS = {
  'ขายฝาก': [180, 150, 90, 60, 30, 7, 3, 0],
  'จำนอง': [60, 30, 7, 3, 0],
};

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
    `กรุณาชำระภายในวันนี้`,
    `— AssetX Estate —`,
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
    `กรุณาเตรียมชำระให้ตรงเวลา`,
    `— AssetX Estate —`,
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
    const [{ data: customers, error: custErr }, { data: payments, error: payErr },
           { data: paymentRecords, error: recErr }, { data: statuses, error: statErr }] =
      await Promise.all([
        supabase.from('customers').select('*').eq('is_cancelled', false),
        supabase.from('payments').select('*'),
        supabase.from('payment_records').select('customer_id, installment'),
        supabase.from('contract_statuses').select('customer_id'),
      ]);
    if (custErr) throw custErr;
    if (payErr) throw payErr;
    if (recErr) throw recErr;
    if (statErr) throw statErr;

    // ลูกค้าที่ปิดสัญญาแล้ว (ไม่ว่าจะปิดแล้ว/ยกเลิก — มีแถวในตารางนี้ = หยุดแจ้งเตือน)
    const closedIds = new Set(statuses.map((s) => s.customer_id));

    // งวดที่จ่ายแล้ว
    const paidKeys = new Set(paymentRecords.map((r) => `${r.customer_id}|${r.installment}`));

    const customerById = Object.fromEntries(customers.map((c) => [c.id, c]));

    for (const p of payments) {
      const c = customerById[p.customer_id];
      if (!c) { skipCount++; continue; } // ลูกค้ายกเลิก/ไม่พบ
      if (closedIds.has(c.id)) { skipCount++; continue; } // ปิดสัญญาแล้ว
      if (!c.line_user_id) { skipCount++; continue; }
      if (paidKeys.has(`${p.customer_id}|${p.installment}`)) { skipCount++; continue; } // จ่ายแล้ว

      const diff = diffDays(p.date_str, today);
      try {
        if (diff === 0) {
          await sendLine(c.line_user_id, buildDueMsg(c.name, p.installment, c.amount, c.freq, p.date_str));
          sentCount++;
        } else if (diff === 7) {
          await sendLine(c.line_user_id, buildEarlyMsg(c.name, p.installment, c.amount, c.freq, p.date_str, 7));
          sentCount++;
        }
      } catch (e) {
        errors.push(`${c.name} งวด ${p.installment}: ${e.message}`);
      }
    }

    // แจ้งเตือนครบกำหนดสัญญาตาม policy threshold
    for (const c of customers) {
      if (closedIds.has(c.id) || !c.line_user_id) continue;
      if (!c.contract_end_date) continue;
      const reminderDays = CONTRACT_REMINDER_DAYS[c.type] || [30, 7, 3, 0];
      const cDiff = diffDays(c.contract_end_date, today);
      if (reminderDays.includes(cDiff)) {
        try {
          await sendLine(c.line_user_id, buildContractMsg(c.name, c.type, c.principal, c.amount, c.contract_end_date, cDiff));
          sentCount++;
        } catch (e) {
          errors.push(`${c.name} (ครบกำหนดสัญญา): ${e.message}`);
        }
      }
    }

    return res.status(200).json({ success: true, sentCount, skipCount, errors });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

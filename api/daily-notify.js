// แจ้งเตือน LINE รายวัน — อ่านข้อมูลจาก Supabase โดยตรง (แทนที่ checkAndSendNotifications ใน GAS ที่ยังอ่านจาก Google Sheet เก่า)
// เรียกผ่าน Vercel Cron ทุกวัน (ดู vercel.json) — ป้องกันด้วย CRON_SECRET
import { createClient } from '@supabase/supabase-js';
import { getNotificationMode, resolveAutomaticRecipient } from './_notification-routing.js';
import { boldAmount, amountDue } from '../src/lib/combinedPayment.js';
import { planPaymentReminders } from '../src/lib/paymentReminderPlan.js';
import { additionFromRow } from '../src/lib/installmentBalance.js';
import { fetchAllAdditionRows } from '../server/paymentAdditions.js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
// รายการชำระเพิ่ม/ยกเว้น (payment_additions) อ่านได้เฉพาะ service role → ใช้ client แยกเฉพาะตารางนี้
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = serviceKey
  ? createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, serviceKey, { auth: { persistSession: false } })
  : null;

// trusted = รู้ครบว่ามีรายการชำระเพิ่มอะไรบ้าง → เตือนงวดที่จ่ายไม่ครบด้วยยอดที่ยังขาดได้
// ไม่ trusted → ไม่ทวงงวดที่จ่ายไม่ครบ (ลูกค้าอาจจ่ายส่วนที่เหลือไปแล้ว) และรายงานในผลลัพธ์ · งวดอื่นเตือนตามปกติ
// ตารางยังไม่ถูกสร้างก็ไม่ทวง: ระหว่างนั้นหน้าเว็บบันทึกเงินที่ลูกค้ามาจ่ายเพิ่มไม่ได้ ถ้าทวงอัตโนมัติจะทวงเงินที่รับแล้วซ้ำ
async function loadPaymentAdditions() {
  if (!admin) return { additions: [], trusted: false, warning: 'ไม่มี SUPABASE_SERVICE_ROLE_KEY — ข้ามการเตือนงวดที่จ่ายไม่ครบ' };
  const { data, error } = await fetchAllAdditionRows(admin, { columns: 'id, customer_id, topup_id, installment, kind, paid_at, amount, created_at, voided_at' });
  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code)) return { additions: [], trusted: false, warning: 'ยังไม่ได้รัน supabase_payment_additions.sql — ข้ามการเตือนงวดที่จ่ายไม่ครบ' };
    return { additions: [], trusted: false, warning: `อ่านรายการชำระเพิ่มไม่ได้ (${error.message}) — ข้ามการเตือนงวดที่จ่ายไม่ครบ` };
  }
  return { additions: data.map(additionFromRow), trusted: true, warning: '' };
}

// งวดที่จ่ายไม่ครบ: ยอดในข้อความ = ส่วนที่ยังขาด และบอกว่าชำระมาแล้วเท่าไร (และยกเว้นให้เท่าไร) จากยอดเต็ม ตัวเลขจึงรวมกันลงตัว
const partialTag = (balance) => (balance?.state === 'partial' ? ' (ส่วนที่ยังขาด)' : '');
function partialLine(balance) {
  if (balance?.state !== 'partial') return [];
  const waived = Number(balance.waived) > 0 ? ` · ยกเว้น ${Number(balance.waived).toLocaleString('th-TH')} บาท` : '';
  return [`✅ ชำระแล้ว ${Number(balance.paid).toLocaleString('th-TH')} บาท${waived} จากยอด ${Number(balance.due).toLocaleString('th-TH')} บาท`];
}

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

function buildDueMsg(name, installment, amount, freq, dateStr, balance) {
  return [
    `📅 ครบกำหนดชำระวันนี้`, ``,
    `เรียน คุณ${name}`,
    `วันนี้เป็นวันครบกำหนดชำระดอกเบี้ย${partialTag(balance)}`,
    `งวดที่ ${installment} วันที่ ${formatThaiDate(dateStr)}`, ``,
    `💰 จำนวน: ${Number(amount).toLocaleString('th-TH')} บาท`,
    ...partialLine(balance),
    `📌 ความถี่: ${freq}`, ``,
    ...PAYMENT_FOOTER,
  ].join('\n');
}

function buildEarlyMsg(name, installment, amount, freq, dateStr, days, balance) {
  return [
    `🔔 แจ้งเตือนล่วงหน้า ${days} วัน`, ``,
    `เรียน คุณ${name}`,
    `อีก ${days} วัน จะถึงกำหนดชำระดอกเบี้ย${partialTag(balance)}`,
    `งวดที่ ${installment} วันที่ ${formatThaiDate(dateStr)}`, ``,
    `💰 จำนวน: ${Number(amount).toLocaleString('th-TH')} บาท`,
    ...partialLine(balance),
    `📌 ความถี่: ${freq}`, ``,
    ...PAYMENT_FOOTER,
  ].join('\n');
}

function buildTopupDueMsg(name, installment, interestAmount, topupAmount, freq, dateStr, balance) {
  return [
    `📅 ครบกำหนดชำระวงเงินเพิ่มวันนี้`, ``,
    `เรียน คุณ${name}`,
    `วันนี้เป็นวันครบกำหนดชำระดอกเบี้ยวงเงินเพิ่ม${partialTag(balance)}`,
    `งวดที่ ${installment} วันที่ ${formatThaiDate(dateStr)}`, ``,
    `💵 วงเงินเพิ่ม: ${Number(topupAmount).toLocaleString('th-TH')} บาท`,
    `💰 ยอดชำระ: ${Number(interestAmount).toLocaleString('th-TH')} บาท`,
    ...partialLine(balance),
    `📌 ความถี่: ${freq}`, ``,
    ...PAYMENT_FOOTER,
  ].join('\n');
}

function buildTopupEarlyMsg(name, installment, interestAmount, topupAmount, freq, dateStr, days, balance) {
  return [
    `🔔 แจ้งเตือนวงเงินเพิ่มล่วงหน้า ${days} วัน`, ``,
    `เรียน คุณ${name}`,
    `อีก ${days} วัน จะถึงกำหนดชำระดอกเบี้ยวงเงินเพิ่ม${partialTag(balance)}`,
    `งวดที่ ${installment} วันที่ ${formatThaiDate(dateStr)}`, ``,
    `💵 วงเงินเพิ่ม: ${Number(topupAmount).toLocaleString('th-TH')} บาท`,
    `💰 ยอดชำระ: ${Number(interestAmount).toLocaleString('th-TH')} บาท`,
    ...partialLine(balance),
    `📌 ความถี่: ${freq}`, ``,
    ...PAYMENT_FOOTER,
  ].join('\n');
}

// mains = งวดสัญญาหลักของวันนั้น (ปกติ 0–1 งวด · มากกว่านั้นเมื่อเลื่อนส่วนที่ขาดมาวันเดียวกับงวดถัดไป)
function buildCombinedPaymentMsg(customer, dateStr, diff, mains, extras) {
  const entries = [
    ...mains.map(({ installment, balance }) =>
      `• สัญญาหลัก งวดที่ ${installment}: ${amountDue(customer.amount, balance).toLocaleString('th-TH')} บาท${partialTag(balance)}`),
    ...extras.map(({ topup, installment, balance }) =>
      `• วงเงินเพิ่ม ${Number(topup.topup_amount).toLocaleString('th-TH')} บาท งวดที่ ${installment}: ${amountDue(topup.interest_amount, balance).toLocaleString('th-TH')} บาท${partialTag(balance)}`),
  ];
  const total = mains.reduce((sum, { balance }) => sum + amountDue(customer.amount, balance), 0)
    + extras.reduce((sum, { topup, balance }) => sum + amountDue(topup.interest_amount, balance), 0);
  const mainInstallments = mains.map(({ installment }) => installment).join(', ');
  return [
    diff === 0 ? '📅 ครบกำหนดชำระวันนี้' : '🔔 แจ้งเตือนล่วงหน้า 7 วัน', '',
    `เรียน คุณ${customer.name}`, '',
    'บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด ขอแจ้งให้ทราบว่า',
    mains.length
      ? diff === 0
        ? `วันนี้ครบกำหนดชำระ${customer.type === 'จำนอง' ? 'ดอกจำนอง' : 'ดอกเบี้ยขายฝาก'}งวดที่ ${mainInstallments}`
        : `ครบกำหนดชำระ${customer.type === 'จำนอง' ? 'ดอกจำนอง' : 'ดอกเบี้ยขายฝาก'}งวดที่ ${mainInstallments} ในอีก ${diff} วันข้างหน้า`
      : diff === 0
        ? 'วันนี้ครบกำหนดชำระดอกเบี้ยวงเงินเพิ่ม'
        : `ครบกำหนดชำระดอกเบี้ยวงเงินเพิ่มในอีก ${diff} วันข้างหน้า`, '',
    `รายการที่ครบกำหนดวันที่ ${formatThaiDate(dateStr)}`, '',
    ...entries,
    `💰 รวมยอดที่ต้องชำระ\n${boldAmount(total)} บาท`, '',
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

function buildReviewTestMsg() {
  return [
    '🧪 ทดสอบระบบแจ้งเตือน Review Mode', '',
    'ข้อความนี้ส่งเพื่อยืนยันว่าระบบแจ้งเตือนอัตโนมัติ',
    'สามารถส่งถึงผู้ดูแล Jak_AssetX ได้สำเร็จ', '',
    'ยังไม่มีการส่งข้อความแจ้งเตือนไปยังลูกค้า',
    'บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด 🏠',
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

    // ทดสอบปลายทางผู้ตรวจทานโดยไม่อ่านหรือส่งรายการลูกค้าจริง
    if (req.method === 'POST' && req.query?.action === 'test-review') {
      if (deliveryMode !== 'review') {
        return res.status(409).json({ success: false, error: 'ระบบไม่ได้อยู่ใน Review Mode' });
      }
      await sendLine(resolveAutomaticRecipient(''), buildReviewTestMsg());
      return res.status(200).json({ success: true, deliveryMode, test: true });
    }

    const [{ data: customers, error: custErr }, { data: payments, error: payErr },
           { data: paymentRecords, error: recErr }, { data: statuses, error: statErr },
           { data: topups, error: topupErr }, { data: topupRecords, error: topupRecErr }] =
      await Promise.all([
        supabase.from('customers').select('*').eq('is_cancelled', false),
        supabase.from('payments').select('*'),
        supabase.from('payment_records').select('customer_id, installment, amount_paid, slip_id'),
        supabase.from('contract_statuses').select('customer_id'),
        supabase.from('contract_topups').select('id, customer_id, topup_amount, interest_amount, freq, payments'),
        supabase.from('topup_payment_records').select('topup_id, installment, amount_paid, slip_id'),
      ]);
    if (custErr) throw custErr;
    if (payErr) throw payErr;
    if (recErr) throw recErr;
    if (statErr) throw statErr;
    if (topupErr) throw topupErr;
    if (topupRecErr) throw topupRecErr;

    // ลูกค้าที่ปิดสัญญาแล้ว (ไม่ว่าจะปิดแล้ว/ยกเลิก — มีแถวในตารางนี้ = หยุดแจ้งเตือน)
    const closedIds = new Set(statuses.map((s) => s.customer_id));

    // งวดที่จ่ายครบแล้ว (บันทึกแรก + ชำระเพิ่ม/ยกเว้น) ข้าม · จ่ายไม่ครบยังเตือนด้วยยอดที่ยังขาด ตามวันนัด (ดู src/lib/paymentReminderPlan.js)
    const { additions, trusted: additionsTrusted, warning: additionsWarning } = await loadPaymentAdditions();
    const plan = planPaymentReminders({
      customers, payments, paymentRecords, topups, topupRecords, additions, closedIds, today,
      canNotify: (c) => Boolean(resolveAutomaticRecipient(c.line_user_id)),
      remindPartial: additionsTrusted,
    });
    skipCount += plan.skipped;

    for (const group of plan.groups) {
      const { customer, dateStr, diff, mains, extras } = group;
      try {
        const [main] = mains;
        const [extra] = extras;
        const message = mains.length === 1 && extras.length === 0
          ? diff === 0
            ? buildDueMsg(customer.name, main.installment, amountDue(customer.amount, main.balance), customer.freq, dateStr, main.balance)
            : buildEarlyMsg(customer.name, main.installment, amountDue(customer.amount, main.balance), customer.freq, dateStr, 7, main.balance)
          : mains.length === 0 && extras.length === 1
            ? diff === 0
              ? buildTopupDueMsg(customer.name, extra.installment, amountDue(extra.topup.interest_amount, extra.balance), extra.topup.topup_amount, extra.topup.freq, dateStr, extra.balance)
              : buildTopupEarlyMsg(customer.name, extra.installment, amountDue(extra.topup.interest_amount, extra.balance), extra.topup.topup_amount, extra.topup.freq, dateStr, 7, extra.balance)
            : buildCombinedPaymentMsg(customer, dateStr, diff, mains, extras);
        await sendLine(resolveAutomaticRecipient(customer.line_user_id), message);
        sentCount++;
      } catch (e) {
        errors.push(`${customer.name} วันที่ ${dateStr}: ${e.message}`);
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

    return res.status(200).json({
      success: true, deliveryMode, sentCount, skipCount, errors,
      ...(additionsWarning ? { warnings: [additionsWarning] } : {}),
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

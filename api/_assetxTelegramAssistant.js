import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { listShortInstallments } from '../src/lib/paymentReminderPlan.js';
import { additionFromRow } from '../src/lib/installmentBalance.js';
import { fetchAllAdditionRows } from '../server/paymentAdditions.js';

const DEFAULT_MODELS = 'gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-pro-preview';
const DEFAULT_HERMES_TIMEOUT_MS = 120000;
const execFileAsync = promisify(execFile);

function getModels() {
  const configured = process.env.GEMINI_CHAT_MODELS || process.env.GEMINI_MODEL || '';
  return [...new Set(`${configured},${DEFAULT_MODELS}`
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean))];
}

function todayThai() {
  return new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function makeSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// งวดที่รับเงินมาแล้วบางส่วน ยังขาดอีก (สัญญาหลัก + วงเงินเพิ่ม) คิดด้วยตัวคิดยอดเดียวกับหน้าเว็บและงานเตือน LINE
// + ยอดรับจริงของงวดที่มีเงินจ่ายเพิ่ม/ยกเว้น (คิดไว้ให้แล้ว ระบุสัญญาหลัก/วงเงินเพิ่ม บอทไม่ต้องบวกเองจนปนกัน)
// ส่งแค่ตัวเลขกับวันที่ ไม่ส่งหมายเหตุ/เหตุผลยกเลิก (อาจมีข้อมูลส่วนตัว)
// อ่านแต่ละส่วนแยกกัน ส่วนไหนพังยังคิดส่วนที่เหลือได้ · topupsLoaded / additionsLoaded บอกบอทว่าส่วนไหนเชื่อไม่ได้
async function loadShortInstallments(supabase, { customers, payments, paymentRecords, statuses }) {
  const notes = [];
  try {
    const [{ data: topups, error: topupsError }, { data: topupRecords, error: topupRecordsError }] = await Promise.all([
      supabase.from('contract_topups').select('id,customer_id,topup_amount,interest_amount,payments'),
      supabase.from('topup_payment_records').select('topup_id,installment,amount_paid,slip_id'),
    ]);
    const topupsLoaded = !topupsError && !topupRecordsError;
    if (!topupsLoaded) notes.push('อ่านข้อมูลวงเงินเพิ่มไม่ได้ ไม่มีข้อมูลงวดของวงเงินเพิ่มในรอบนี้');
    let additions = [];
    let additionsLoaded = true;
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const admin = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await fetchAllAdditionRows(admin, { columns: 'id,customer_id,topup_id,installment,kind,paid_at,amount,created_at,voided_at' });
      if (!error) additions = data.map(additionFromRow);
      else if (!['42P01', 'PGRST205'].includes(error.code)) additionsLoaded = false; // ยังไม่มีตาราง = ยังไม่มีรายการ ถือว่าครบ
    } else {
      additionsLoaded = false;
    }
    if (!additionsLoaded) notes.push('อ่านรายการชำระเพิ่มไม่ได้ ยอดที่ขาดอาจยังไม่หักเงินที่ลูกค้ามาจ่ายเพิ่ม');
    const nameById = new Map((customers || []).map((c) => [c.id, c.name]));
    const usableTopups = topupsLoaded ? topups || [] : [];
    const usableTopupRecords = topupsLoaded ? topupRecords || [] : [];
    const list = listShortInstallments({
      customers: customers || [], payments: payments || [], paymentRecords: paymentRecords || [],
      topups: usableTopups, topupRecords: usableTopupRecords, additions,
      closedIds: new Set((statuses || []).map((s) => s.customer_id)),
    }).map((item) => ({ ...item, customerName: nameById.get(item.customerId) || '', contract: item.topupId ? 'วงเงินเพิ่ม' : 'สัญญาหลัก' }));

    // ยอดรับจริงต่องวด เฉพาะงวดที่มีเงินจ่ายเพิ่มหรือยกเว้นที่ยังใช้อยู่
    const firstMain = new Map((paymentRecords || []).map((r) => [`${r.customer_id}|${r.installment}`, Number(r.amount_paid) || 0]));
    const firstTopup = new Map(usableTopupRecords.map((r) => [`${r.topup_id}|${r.installment}`, Number(r.amount_paid) || 0]));
    const byInstallment = new Map();
    for (const a of additions) {
      if (a.voidedAt) continue;
      if (a.topupId && !topupsLoaded) continue; // ไม่มีบันทึกแรกของวงเงินเพิ่มรอบนี้ → ยอดรับจะขาด ไม่ส่งดีกว่าส่งผิด
      const k = `${a.customerId}|${a.topupId || ''}|${a.installment}`;
      if (!byInstallment.has(k)) {
        const firstRecordPaid = a.topupId ? firstTopup.get(`${a.topupId}|${a.installment}`) || 0 : firstMain.get(`${a.customerId}|${a.installment}`) || 0;
        byInstallment.set(k, {
          customerId: a.customerId, customerName: nameById.get(a.customerId) || '', contract: a.topupId ? 'วงเงินเพิ่ม' : 'สัญญาหลัก',
          topupId: a.topupId, installment: a.installment, firstRecordPaid, additionalPaid: 0, waived: 0,
        });
      }
      const row = byInstallment.get(k);
      if (a.kind === 'waiver') row.waived += a.amount;
      else row.additionalPaid += a.amount;
    }
    const installmentPayments = [...byInstallment.values()].map((row) => ({ ...row, totalReceived: row.firstRecordPaid + row.additionalPaid }));
    return { list, installmentPayments, topupsLoaded, additionsLoaded, note: notes.join(' · ') };
  } catch (error) {
    return { list: [], installmentPayments: [], topupsLoaded: false, additionsLoaded: false, note: `คิดงวดที่ชำระไม่ครบไม่ได้: ${error.message}` };
  }
}

async function loadAssetxContext() {
  const supabase = makeSupabase();
  if (!supabase) return { customerData: [], note: 'Supabase is not configured.' };

  const [
    { data: customers, error: customersError },
    { data: payments, error: paymentsError },
    { data: paymentRecords, error: recordsError },
    { data: statuses, error: statusesError },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('id,name,type,principal,amount,freq,contract_end_date,is_cancelled,created_at,disbursement')
      .eq('is_cancelled', false),
    supabase.from('payments').select('customer_id,installment,date_str,postponed_from,postpone_note'),
    supabase.from('payment_records').select('customer_id,installment,paid_at,amount_paid,note,slip_id'),
    supabase.from('contract_statuses').select('customer_id,status,updated_at'),
  ]);

  const firstError = customersError || paymentsError || recordsError || statusesError;
  if (firstError) {
    return { customerData: [], note: `Supabase read failed: ${firstError.message}` };
  }
  const short = await loadShortInstallments(supabase, { customers, payments, paymentRecords, statuses });

  return {
    customerData: {
      customers: (customers || []).map(({ disbursement, ...customer }) => ({
        ...customer,
        advanceDeduction: disbursement?.advanceMonths > 0 ? {
          months: disbursement.advanceMonths,
          total: disbursement.advanceTotal,
          deductedAt: disbursement.advanceDeductedAt || null,
          treatment: disbursement.advanceTreatment || 'unverified',
        } : null,
      })),
      payments: payments || [],
      // slip_id ใช้แค่คิดงวดหักดอกล่วงหน้าใน shortInstallments ไม่ต้องส่งเข้า AI
      paymentRecords: (paymentRecords || []).map(({ slip_id, ...record }) => record),
      contractStatuses: statuses || [],
      shortInstallments: short.list,
      installmentPayments: short.installmentPayments,
      topupsLoaded: short.topupsLoaded,
      additionsLoaded: short.additionsLoaded,
    },
    note: short.note,
  };
}

function buildSystemPrompt(customerData, contextNote = '') {
  return `คุณเป็นผู้ช่วย AI ของระบบ AssetX Estate ระบบบริหารสัญญาจำนองและขายฝาก
วันที่ปัจจุบัน: ${todayThai()}

ข้อมูลระบบที่ใช้ตอบ:
${JSON.stringify(customerData, null, 2)}

${contextNote ? `หมายเหตุระบบ: ${contextNote}\n` : ''}
บทบาทของคุณ:
- ดูแลคำถามฝั่งเว็บ AssetX Estate ไม่ใช่งานเลขา/บัญชี/รับเอกสาร
- สรุปภาพรวมพอร์ตโฟลิโอ จำนวนสัญญา เงินต้น ดอกเบี้ย และสถานะที่ต้องติดตาม
- แจ้งงวดชำระที่ใกล้ครบกำหนดหรือเลยกำหนดจากข้อมูลที่มี
- คำนวณดอกเบี้ยสะสม ยอดค้างชำระ และแยกจำนอง/ขายฝากเมื่อข้อมูลพอ
- shortInstallments คืองวดที่รับเงินมาแล้วบางส่วน ยังขาดอีก (สัญญาหลักและวงเงินเพิ่ม) คิดจากบันทึกครั้งแรกรวมเงินที่มาจ่ายเพิ่มและการยกเว้นแล้ว ใช้ outstanding เป็นยอดที่ยังขาดของงวดนั้น และ dateStr เป็นวันนัดชำระส่วนที่ขาด
- paymentRecords เก็บแค่บันทึกครั้งแรกของงวดสัญญาหลักเท่านั้น · installmentPayments คืองวด (ดู contract ว่าสัญญาหลักหรือวงเงินเพิ่ม) ที่มีเงินมาจ่ายเพิ่มหรือยกเว้น: totalReceived = เงินที่รับจริงทั้งงวด (บันทึกแรก + จ่ายเพิ่ม) ใช้แทน amount_paid ของงวดนั้น · waived = ยกเว้นให้ ไม่ใช่เงินรับ · ห้ามเอาตัวเลขของวงเงินเพิ่มไปรวมกับงวดสัญญาหลักเลขเดียวกัน
- งวดที่มีบันทึกแต่ไม่อยู่ใน shortInstallments ถือว่าชำระครบแล้ว ห้ามคิดยอดขาดจาก amount_paid เอง
- ถ้า additionsLoaded เป็น false: งวดใน shortInstallments อาจจ่ายเพิ่มครบไปแล้ว ให้บอกว่ายอดที่ขาดยังต้องตรวจในหน้าเว็บ · ถ้า topupsLoaded เป็น false: ไม่มีข้อมูลวงเงินเพิ่มในรอบนี้ ห้ามสรุปเรื่องงวดของวงเงินเพิ่ม
- ถ้า advanceDeduction.treatment เป็น before_schedule จำนวนเดือนและยอดที่หักวันทำสัญญาไม่รวมในตาราง payments ห้ามหักซ้ำจากงวดที่ยังไม่จ่าย และอย่าสร้าง payment record สมมติ
- ถ้า treatment เป็น unverified ให้แจ้งว่าต้องเทียบสัญญาและใบหักเงินก่อนสรุปยอดสินไถ่
- ค้นหาลูกค้าจากชื่อ ประเภทสัญญา งวดชำระ และข้อมูลโฉนดถ้ามีในบริบท
- ช่วยวิเคราะห์งานหลังบ้าน ประเมินทรัพย์ การติดตามลูกค้า และแผนแจ้งเตือน

กฎการตอบ:
- ตอบเป็นภาษาไทยเสมอ
- ใช้ภาษาไทยล้วนให้มากที่สุด ห้ามปนคำอังกฤษทั่วไป เช่น or, and, then, from เว้นแต่เป็นชื่อระบบหรือคำย่อทางเทคนิค
- กระชับ ชัดเจน ตรงประเด็น
- ถ้าเป็นคำถามข้อมูลลูกค้า ให้ตอบเฉพาะเท่าที่จำเป็น ไม่เปิดเผยเลขบัตร เบอร์โทร ที่อยู่ หรือข้อมูลอ่อนไหวที่ไม่จำเป็น
- ใช้ตัวเลขที่คำนวณได้จริงจากข้อมูลเท่านั้น ถ้าข้อมูลไม่พอให้บอกว่าไม่พบ/ต้องตรวจเพิ่ม
- ถ้าเป็นเรื่องกฎหมาย ให้บอกเป็นข้อมูลทั่วไปและแนะนำให้ตรวจเอกสารจริงก่อนดำเนินการ
- ห้ามรับ/จัดเก็บสลิปหรือเอกสารบัญชี บอกให้ส่งไปที่บอทเลขา/บัญชีแทน`;
}

function isHermesConfigured() {
  const transport = String(process.env.HERMES_AGENT_TRANSPORT || '').trim().toLowerCase();
  const url = String(process.env.HERMES_AGENT_URL || '').trim();
  return Boolean(url && url !== 'cli' && transport !== 'cli');
}

function buildHermesPayload({ text, systemPrompt, customerData }) {
  const format = String(process.env.HERMES_AGENT_FORMAT || 'openai').toLowerCase();
  const mode = 'private-portfolio';
  const messages = [{ role: 'user', content: String(text || '') }];
  const context = { customerData };

  if (format === 'generic') {
    return {
      source: 'assetx-estate-telegram',
      mode,
      stream: false,
      system: systemPrompt,
      messages,
      context,
      input: String(text || ''),
    };
  }

  return {
    model: process.env.HERMES_AGENT_MODEL || 'hermes',
    stream: false,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    metadata: {
      source: 'assetx-estate-telegram',
      mode,
    },
    assetx_context: context,
  };
}

function extractHermesText(raw, contentType = '') {
  if (!raw) return '';

  if (contentType.includes('text/event-stream') || raw.includes('\ndata: ')) {
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice(6).trim())
      .filter((data) => data && data !== '[DONE]')
      .map((data) => {
        try {
          const parsed = JSON.parse(data);
          return (
            parsed.text ||
            parsed.delta ||
            parsed.content ||
            parsed.message?.content ||
            parsed.choices?.[0]?.delta?.content ||
            parsed.choices?.[0]?.message?.content ||
            ''
          );
        } catch {
          return data;
        }
      })
      .join('');
  }

  try {
    const parsed = JSON.parse(raw);
    return String(
      parsed.text ||
      parsed.output_text ||
      parsed.content ||
      parsed.message?.content ||
      parsed.choices?.[0]?.message?.content ||
      parsed.choices?.[0]?.text ||
      ''
    );
  } catch {
    return raw;
  }
}

function cleanHermesCliText(text) {
  const withoutAnsi = String(text || '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '');
  const withoutFooter = withoutAnsi
    .split(/\r?\nResume this session with:/)[0]
    .split(/\r?\nSession:\s+/)[0];
  const lines = withoutFooter.split(/\r?\n/);
  const hermesHeaderIndex = lines.findIndex((line) => /Hermes/.test(line) && /[╭─]/.test(line));
  const contentLines = hermesHeaderIndex >= 0 ? lines.slice(hermesHeaderIndex + 1) : lines;

  return contentLines
    .map((line) => line.replace(/[╭╮╰╯│─]/g, '').trimEnd())
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (trimmed === 'Query:') return false;
      if (/^Initializing agent/.test(trimmed)) return false;
      if (/^[-]{3,}$/.test(trimmed)) return false;
      if (/^คุณเป็นผู้ช่วย AI ของระบบ AssetX Estate/.test(trimmed)) return false;
      if (/^คำถามจาก Telegram:/.test(trimmed)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function askHermes(text, customerData, note) {
  if (!isHermesConfigured()) return '';

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.HERMES_AGENT_TIMEOUT_MS || DEFAULT_HERMES_TIMEOUT_MS)
  );

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.HERMES_AGENT_API_KEY) {
    headers.Authorization = `Bearer ${process.env.HERMES_AGENT_API_KEY}`;
  }

  try {
    const response = await fetch(process.env.HERMES_AGENT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildHermesPayload({
        text,
        systemPrompt: buildSystemPrompt(customerData, note),
        customerData,
      })),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Hermes agent ${response.status}: ${body || response.statusText}`);
    }

    const raw = await response.text();
    return extractHermesText(raw, response.headers.get('content-type') || '').trim();
  } finally {
    clearTimeout(timeout);
  }
}

async function askHermesCli(text, customerData, note) {
  const hermesBin = process.env.HERMES_CLI_PATH || 'hermes';
  const prompt = [
    buildSystemPrompt(customerData, note),
    '',
    'คำถามจาก Telegram:',
    String(text || ''),
  ].join('\n');
  const tmpPath = path.join(
    os.tmpdir(),
    `assetx-telegram-hermes-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`
  );

  await fs.writeFile(tmpPath, prompt, 'utf8');

  try {
    const args = [
      'chat',
      '--query-file',
      tmpPath,
      '--oneshot',
      '--ignore-rules',
      '--in',
      process.cwd(),
      '--source',
      'tool',
      '--run-budget',
      String(process.env.HERMES_AGENT_RUN_BUDGET_SECONDS || 180),
      '--max-turns',
      String(process.env.HERMES_AGENT_MAX_TURNS || 4),
    ];
    if (process.env.HERMES_AGENT_PROVIDER) args.push('--provider', process.env.HERMES_AGENT_PROVIDER);
    if (process.env.HERMES_AGENT_MODEL) args.push('--model', process.env.HERMES_AGENT_MODEL);

    const result = await execFileAsync(hermesBin, args, {
      cwd: process.cwd(),
      env: process.env,
      timeout: Number(process.env.HERMES_CLI_TIMEOUT_MS || process.env.HERMES_AGENT_TIMEOUT_MS || 180000),
      maxBuffer: 1024 * 1024 * 8,
      windowsHide: true,
    });
    return cleanHermesCliText(result.stdout);
  } finally {
    await fs.rm(tmpPath, { force: true }).catch(() => {});
  }
}

async function askGemini(text, customerData, note) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return 'AssetX Estate รับข้อความแล้วครับ แต่ยังไม่ได้ตั้งค่า GEMINI_API_KEY สำหรับคำตอบแบบ AI';
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const errors = [];

  for (const modelName of getModels()) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: buildSystemPrompt(customerData, note),
      });
      const result = await model.generateContent(String(text || ''));
      return result.response.text();
    } catch (error) {
      errors.push(`${modelName}: ${error.message}`);
    }
  }

  return `AssetX Estate รับข้อความแล้วครับ แต่ระบบ AI ตอบไม่สำเร็จชั่วคราว\n${errors[0] || ''}`.trim();
}

async function askAssetxAgent(text) {
  const { customerData, note } = await loadAssetxContext();

  try {
    const hermesReply = await askHermes(text, customerData, note);
    if (hermesReply) return hermesReply;
  } catch (error) {
    if (process.env.ASSETX_TELEGRAM_DEBUG === '1') {
      console.error('AssetX Hermes Telegram fallback:', error.message);
    }
  }

  try {
    const cliReply = await askHermesCli(text, customerData, note);
    if (cliReply) return cliReply;
  } catch (error) {
    if (process.env.ASSETX_TELEGRAM_DEBUG === '1') {
      console.error('AssetX Hermes CLI fallback:', error.message);
    }
  }

  return askGemini(text, customerData, note);
}

export async function buildAssetxTelegramReply(message) {
  const text = String(message?.text || '').trim();
  const lower = text.toLowerCase();

  if (/^\/(?:id|chatid)(?:@\w+)?/.test(lower)) {
    const title = message?.chat?.title || message?.chat?.username || message?.chat?.first_name || '-';
    const chatId = message?.chat?.id == null ? '' : String(message.chat.id);
    return `AssetX Estate chat id\nchat: ${title}\nid: ${chatId}`;
  }

  if (/^\/(?:start|help)(?:@\w+)?/.test(lower)) {
    return [
      'AssetX Estate bot พร้อมใช้งานครับ',
      '',
      'ถามเรื่องพอร์ต ลูกค้า สัญญาจำนอง/ขายฝาก งวดชำระ ประเมินทรัพย์ หรือการติดตามงานหลังบ้านได้เลย',
      'พิมพ์ /diary เพื่อรับปุ่มเปิดไดอารี่งาน (สรุปงานรายวัน · ติ๊กเรื่องค้าง · สั่งงาน Claude)',
      'งานสลิป/ใบเสร็จ/เอกสารบัญชีให้ส่งที่บอทเลขา/บัญชีแทนครับ',
    ].join('\n');
  }

  if (!text && (message?.photo || message?.document)) {
    return 'บอทนี้ใช้ดูแลงานเว็บ AssetX Estate ครับ งานสลิป/เอกสารบัญชีให้ส่งไปที่บอทเลขา/บัญชีแทน';
  }

  return askAssetxAgent(text || 'สวัสดี');
}

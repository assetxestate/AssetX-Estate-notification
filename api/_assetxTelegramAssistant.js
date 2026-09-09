import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

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
      .select('id,name,type,principal,amount,freq,contract_end_date,is_cancelled,created_at')
      .eq('is_cancelled', false),
    supabase.from('payments').select('customer_id,installment,date_str,postponed_from,postpone_note'),
    supabase.from('payment_records').select('customer_id,installment,paid_at,amount_paid,note'),
    supabase.from('contract_statuses').select('customer_id,status,updated_at'),
  ]);

  const firstError = customersError || paymentsError || recordsError || statusesError;
  if (firstError) {
    return { customerData: [], note: `Supabase read failed: ${firstError.message}` };
  }

  return {
    customerData: {
      customers: customers || [],
      payments: payments || [],
      paymentRecords: paymentRecords || [],
      contractStatuses: statuses || [],
    },
    note: '',
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
      'งานสลิป/ใบเสร็จ/เอกสารบัญชีให้ส่งที่บอทเลขา/บัญชีแทนครับ',
    ].join('\n');
  }

  if (!text && (message?.photo || message?.document)) {
    return 'บอทนี้ใช้ดูแลงานเว็บ AssetX Estate ครับ งานสลิป/เอกสารบัญชีให้ส่งไปที่บอทเลขา/บัญชีแทน';
  }

  return askAssetxAgent(text || 'สวัสดี');
}

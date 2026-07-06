// ============================================================
// AssetX — Migration Script
// ย้ายข้อมูลจาก Google Apps Script → Supabase
// วิธีใช้: node migrate.js
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// อ่าน .env.local
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => l.split("=").map(s => s.trim()))
    .map(([k, ...v]) => [k, v.join("=")])
);

const SUPABASE_URL     = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
const GAS_URL          = env.VITE_GAS_URL;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GAS_URL) {
  console.error("❌ ไม่พบค่าใน .env.local — ตรวจสอบ VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GAS_URL");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Helpers ───────────────────────────────────────────────────
async function fetchGAS(action, params = "") {
  const url = `${GAS_URL}?action=${action}${params}`;
  console.log(`  → GET ${action}`);
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(`GAS ${action} failed: ${json.error || "unknown"}`);
  return json.data;
}

function toDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().split("T")[0];
}

function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

async function upsertChunks(table, rows, conflict) {
  for (const batch of chunk(rows, 50)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict: conflict });
    if (error) throw error;
  }
}

// ── Step 1: Customers + Payments ─────────────────────────────
async function migrateCustomers() {
  console.log("\n📋 Step 1: ลูกค้า (customers + payments)");
  const data = await fetchGAS("getCustomers");

  const customerRows = data.map(c => ({
    id:                c.id,
    name:              c.name || "",
    full_label:        c.fullLabel || "",
    type:              c.type || "",
    principal:         Number(c.principal) || 0,
    amount:            Number(c.amount) || 0,
    freq:              c.freq || "",
    contract_end_date: toDate(c.contractEndDate),
    line_user_id:      c.lineUserId || "",
    location:          c.location || "",
    deeds:             (() => {
      try { return typeof c.deeds === "string" ? JSON.parse(c.deeds) : (c.deeds || []); }
      catch { return []; }
    })(),
    is_cancelled: false,
  }));

  await upsertChunks("customers", customerRows, "id");
  console.log(`  ✅ บันทึกลูกค้า ${customerRows.length} ราย`);

  const paymentRows = [];
  data.forEach(c => {
    (c.payments || []).forEach(p => {
      if (p.installment && p.dateStr) {
        paymentRows.push({
          customer_id: c.id,
          installment: Number(p.installment),
          date_str:    toDate(p.dateStr) || p.dateStr,
        });
      }
    });
  });

  if (paymentRows.length > 0) {
    await upsertChunks("payments", paymentRows, "customer_id,installment");
    console.log(`  ✅ บันทึกงวดชำระ ${paymentRows.length} รายการ`);
  }
}

// ── Step 2: Contract Statuses ─────────────────────────────────
async function migrateContractStatuses() {
  console.log("\n📋 Step 2: สถานะสัญญา (contract_statuses)");
  const data = await fetchGAS("getContractStatuses");

  // ดึง customer IDs ที่มีอยู่ใน Supabase
  const { data: existingCustomers } = await supabase.from("customers").select("id");
  const validIds = new Set((existingCustomers || []).map(c => c.id));

  const allRows = Object.entries(data).map(([customerId, info]) => ({
    customer_id:   customerId,
    status:        info.status || "ปิดแล้ว",
    customer_name: info.customerName || "",
    updated_at:    new Date().toISOString(),
  }));

  const rows = allRows.filter(r => validIds.has(r.customer_id));
  const skipped = allRows.length - rows.length;

  if (skipped > 0) console.log(`  ⚠️  ข้าม ${skipped} รายการ (ไม่พบ customer_id ใน Supabase)`);

  if (rows.length === 0) {
    console.log("  ℹ️  ไม่มีสัญญาที่ปิดแล้ว — ข้ามขั้นตอนนี้");
    return;
  }

  await upsertChunks("contract_statuses", rows, "customer_id");
  console.log(`  ✅ บันทึกสถานะสัญญา ${rows.length} รายการ`);
}

// ── Step 3: Payment Records ───────────────────────────────────
async function migratePaymentRecords() {
  console.log("\n📋 Step 3: ประวัติชำระเงิน (payment_records)");
  const data = await fetchGAS("getPaymentRecords");

  const { data: existingCustomers } = await supabase.from("customers").select("id");
  const validIds = new Set((existingCustomers || []).map(c => c.id));

  const rows = [];
  let skipped = 0;
  Object.entries(data).forEach(([customerId, installments]) => {
    if (!validIds.has(customerId)) { skipped++; return; }
    Object.entries(installments).forEach(([installment, record]) => {
      rows.push({
        customer_id: customerId,
        installment: Number(installment),
        paid_at:     record.paidAt    || record.date    || "",
        slip_url:    record.slipUrl   || record.imageUrl || "",
        slip_id:     record.slipId    || record.imageId  || "",
        amount_paid: Number(record.amountPaid || record.amount || 0),
        note:        record.note      || "",
      });
    });
  });

  if (skipped > 0) console.log(`  ⚠️  ข้าม ${skipped} ลูกค้า (ไม่พบใน Supabase)`);

  if (rows.length === 0) {
    console.log("  ℹ️  ไม่มีประวัติการชำระ — ข้ามขั้นตอนนี้");
    return;
  }

  await upsertChunks("payment_records", rows, "customer_id,installment");
  console.log(`  ✅ บันทึกประวัติชำระ ${rows.length} รายการ`);
}

// ── Step 4: Valuations ────────────────────────────────────────
async function migrateValuations() {
  console.log("\n📋 Step 4: ประวัติการประเมิน (valuations)");
  const data = await fetchGAS("getValuations");

  const rows = data.map(v => ({
    recorded_at:            String(v["วันที่บันทึก"]  || ""),
    assessment_date:        toDate(v["วันที่ประเมิน"]),
    assessor_name:          String(v["ผู้ประเมิน"]     || ""),
    project_name:           String(v["รหัส/ชื่อทรัพย์"] || ""),
    assessment_type:        String(v["ประเภทการประเมิน"] || ""),
    property_type:          String(v["ประเภทอสังหาฯ"]   || ""),
    property_subtype:       String(v["ประเภทย่อย"]      || ""),
    title_deed_no:          String(v["เลขโฉนด"]         || ""),
    map_sheet:              String(v["ระวาง"]            || ""),
    survey_page:            String(v["หน้าสำรวจ"]        || ""),
    land_no:                String(v["เลขที่ดิน"]        || ""),
    province:               String(v["จังหวัด"]          || ""),
    district:               String(v["อำเภอ/เขต"]        || ""),
    subdistrict:            String(v["ตำบล/แขวง"]        || ""),
    area_rai:               Number(v["ไร่"])              || 0,
    area_ngan:              Number(v["งาน"])              || 0,
    area_sqw:               Number(v["ตร.ว."])            || 0,
    total_sqw:              Number(v["ตร.ว.รวม"])         || 0,
    gov_price:              Number(v["ราคาประเมินรัฐ (บ./ตร.ว.)"]) || 0,
    effective_market_price: Number(v["ราคาตลาด (บ./ตร.ว.)"])       || 0,
    market_value:           Number(v["มูลค่าตลาดรวม"])   || 0,
    road_type:              String(v["ทำเล"]              || ""),
    road_width:             String(v["ความกว้างถนน"]      || ""),
    land_frontage:          String(v["หน้ากว้าง"]         || ""),
    distance_from_main:     String(v["ระยะห่างถนนใหญ่"]  || ""),
    zone_color:             String(v["ผังเมือง"]          || ""),
    soil_condition:         String(v["สภาพดิน"]           || ""),
    comp_price:             String(v["Comp (บ./ตร.ว.)"]   || ""),
    comp_source:            String(v["แหล่ง Comp"]        || ""),
    property_score:         Number(v["Property Score"])   || 100,
    ltv_rate:               Number(v["LTV Rate (%)"])     || 50,
    fsv:                    Number(v["FSV (80%)"])         || 0,
    recommended_loan:       Number(v["วงเงินแนะนำ"])      || 0,
    requested_loan:         Number(v["วงเงินที่ลูกค้าขอ"]) || 0,
    req_ltv_pct:            Number(v["LTV ลูกค้า (% ต่อตลาด)"]) || 0,
    lat:                    v["lat"]  != null && v["lat"]  !== "" ? Number(v["lat"])  : null,
    lng:                    v["lng"]  != null && v["lng"]  !== "" ? Number(v["lng"])  : null,
    risks:                  String(v["ปัจจัยเสี่ยง"]      || ""),
    location_note:          String(v["หมายเหตุ"]          || ""),
    status:                 String(v["สถานะ"]             || "รอดำเนินการ"),
    customer_name:          String(v["ชื่อลูกค้า"]        || ""),
  }));

  if (rows.length === 0) {
    console.log("  ℹ️  ไม่มีข้อมูลประเมิน — ข้ามขั้นตอนนี้");
    return;
  }

  // valuations ไม่มี unique constraint — insert ทีละ batch
  for (const batch of chunk(rows, 50)) {
    const { error } = await supabase.from("valuations").insert(batch);
    if (error) throw error;
  }
  console.log(`  ✅ บันทึกประวัติประเมิน ${rows.length} รายการ`);
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log("🚀 เริ่ม Migration: GAS → Supabase");
  console.log(`   Supabase: ${SUPABASE_URL}`);
  console.log(`   GAS:      ${GAS_URL.substring(0, 60)}...`);

  try {
    await migrateCustomers();
    await migrateContractStatuses();
    await migratePaymentRecords();
    await migrateValuations();

    console.log("\n✅ Migration สำเร็จทั้งหมด!");
    console.log("   เปิดเว็บแล้วตรวจสอบข้อมูลได้เลยครับ");
  } catch (err) {
    console.error("\n❌ Migration ล้มเหลว:", err.message);
    console.error(err);
    process.exit(1);
  }
}

main();

// ============================================================
// AssetX API — Supabase wrapper แทน Google Apps Script
// ทุก component ที่เคย fetch(APPS_SCRIPT_URL) ให้ import จากที่นี่
// ============================================================
import { supabase } from "./supabase";
import { dehydrateWorkspace } from "./marketingMedia.js";
import { haversineDistanceMeters } from "./pricePoints";
import { postponeTopupInstallment } from "./topupSchedule.js";

// ── Customers ─────────────────────────────────────────────────

export async function getCustomers() {
  const { data: custRows, error: custErr } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: true });
  if (custErr) throw custErr;

  const { data: payRows, error: payErr } = await supabase
    .from("payments")
    .select("*")
    .order("installment", { ascending: true });
  if (payErr) throw payErr;

  const payMap = {};
  payRows.forEach((p) => {
    if (!payMap[p.customer_id]) payMap[p.customer_id] = [];
    payMap[p.customer_id].push({
      installment: p.installment,
      dateStr: p.date_str,
      postponedFrom: p.postponed_from || null,
      postponeNote: p.postpone_note || "",
    });
  });

  return custRows.map((c) => ({
    id: c.id,
    name: c.name,
    fullLabel: c.full_label,
    type: c.type,
    principal: c.principal,
    amount: c.amount,
    freq: c.freq,
    contractEndDate: c.contract_end_date || "",
    lineUserId: c.line_user_id,
    location: c.location,
    deeds: typeof c.deeds === "string" ? c.deeds : JSON.stringify(c.deeds || []),
    isCancelled: c.is_cancelled === true,
    incomeType: c.income_type || 'commission',
    disbursement: c.disbursement || {},
    payments: payMap[c.id] || [],
  }));
}

export async function createCustomer(data) {
  const { customer, payments: payList } = data;

  const { error: custErr } = await supabase.from("customers").upsert({
    id: customer.id,
    name: customer.name,
    full_label: customer.fullLabel || "",
    type: customer.type || "",
    principal: customer.principal || 0,
    amount: customer.amount || 0,
    freq: customer.freq || "",
    contract_end_date: customer.contractEndDate || null,
    line_user_id: customer.lineUserId || "",
    location: customer.location || "",
    deeds: customer.deeds || [],
    income_type: customer.incomeType || 'commission',
    disbursement: customer.disbursement || {},
    updated_at: new Date().toISOString(),
  });
  if (custErr) throw custErr;

  if (payList && payList.length > 0) {
    const rows = payList.map((p) => ({
      customer_id: customer.id,
      installment: p.installment,
      date_str: p.dateStr,
    }));
    const { error: payErr } = await supabase.from("payments").upsert(rows, {
      onConflict: "customer_id,installment",
    });
    if (payErr) throw payErr;
  }

  return { success: true, id: customer.id };
}

export async function updateCustomer(customerId, data) {
  const updates = {};
  if (data.name !== undefined)            updates.name = data.name;
  if (data.fullLabel !== undefined)       updates.full_label = data.fullLabel;
  if (data.type !== undefined)            updates.type = data.type;
  if (data.principal !== undefined)       updates.principal = data.principal;
  if (data.amount !== undefined)          updates.amount = data.amount;
  if (data.freq !== undefined)            updates.freq = data.freq;
  if (data.contractEndDate !== undefined) updates.contract_end_date = data.contractEndDate || null;
  if (data.lineUserId !== undefined)      updates.line_user_id = data.lineUserId;
  if (data.location !== undefined)        updates.location = data.location;
  if (data.deeds !== undefined)           updates.deeds = data.deeds;
  if (data.incomeType !== undefined)      updates.income_type = data.incomeType;
  if (data.disbursement !== undefined)    updates.disbursement = data.disbursement;
  updates.updated_at = new Date().toISOString();

  const { error } = await supabase.from("customers").update(updates).eq("id", customerId);
  if (error) throw error;
  return { success: true };
}

// แก้ข้อมูลโฉนด 1 แปลง (เช่น ราคาประเมินราชการ) — อ่าน deeds ล่าสุดจากฐานข้อมูลก่อนแล้วเขียนทั้งชุด (JSONB)
// กันกรณีอีกเครื่องเพิ่งบันทึกแปลงอื่นไปแล้วแต่หน้านี้ยังถือข้อมูลเก่า; จับคู่แปลงด้วยเลขโฉนดก่อน ลำดับเป็นตัวสำรอง
export async function updateCustomerDeed(customerId, index, patch, deedNo = "") {
  const { data: current, error: fetchErr } = await supabase
    .from("customers")
    .select("deeds")
    .eq("id", customerId)
    .single();
  if (fetchErr) throw fetchErr;
  const deeds = (typeof current.deeds === "string" ? JSON.parse(current.deeds || "[]") : current.deeds) || [];
  const no = String(deedNo || "").trim();
  let at = no && String(deeds[index]?.no || "").trim() === no ? index : -1;
  if (at < 0 && no) at = deeds.findIndex((d) => String(d?.no || "").trim() === no);
  if (at < 0) at = index;
  if (!deeds[at]) throw new Error("ไม่พบโฉนดแปลงนี้ในฐานข้อมูล (อาจถูกแก้จากเครื่องอื่น กรุณารีเฟรชหน้า)");
  const next = deeds.map((d, i) => (i === at ? { ...d, ...patch } : d));
  const { data: updated, error } = await supabase
    .from("customers")
    .update({ deeds: next, updated_at: new Date().toISOString() })
    .eq("id", customerId)
    .select("id");
  if (error) throw error;
  if (!updated?.length) throw new Error("บันทึกไม่สำเร็จ: ไม่พบลูกค้าหรือไม่มีสิทธิ์แก้ไข");
  return next;
}

export async function cancelCustomer(customerId) {
  const { error } = await supabase
    .from("customers")
    .update({ is_cancelled: true, updated_at: new Date().toISOString() })
    .eq("id", customerId);
  if (error) throw error;
  return { success: true };
}

export async function voidContract(customerId, customerName) {
  const now = new Date().toISOString();
  const { error: custErr } = await supabase
    .from("customers")
    .update({ is_cancelled: true, updated_at: now })
    .eq("id", customerId);
  if (custErr) throw custErr;

  const { error: statusErr } = await supabase.from("contract_statuses").upsert({
    customer_id: customerId,
    status: "ยกเลิก",
    customer_name: customerName || "",
    updated_at: now,
  });
  if (statusErr) throw statusErr;
  return { success: true };
}

// ── Contract Statuses ─────────────────────────────────────────

export async function getContractStatuses() {
  const { data, error } = await supabase.from("contract_statuses").select("*");
  if (error) throw error;

  const result = {};
  data.forEach((row) => {
    result[row.customer_id] = {
      status: row.status,
      customerName: row.customer_name,
    };
  });
  return result;
}

export async function closeContract(customerId, customerName) {
  const { error } = await supabase.from("contract_statuses").upsert({
    customer_id: customerId,
    status: "ปิดแล้ว",
    customer_name: customerName,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { success: true };
}

export async function reopenContract(customerId) {
  const { error } = await supabase
    .from("contract_statuses")
    .delete()
    .eq("customer_id", customerId);
  if (error) throw error;
  return { success: true };
}

// ── Payment Records ───────────────────────────────────────────

export async function getPaymentRecords() {
  const { data, error } = await supabase.from("payment_records").select("*");
  if (error) throw error;

  const result = {};
  data.forEach((row) => {
    if (!result[row.customer_id]) result[row.customer_id] = {};
    result[row.customer_id][row.installment] = {
      paidAt: row.paid_at,
      paidDate: row.paid_at,
      slipUrl: row.slip_url,
      slipId: row.slip_id,
      amountPaid: row.amount_paid,
      note: row.note,
    };
  });
  return result;
}

export async function savePaymentRecord(customerId, installment, record) {
  const { error } = await supabase.from("payment_records").upsert({
    customer_id: customerId,
    installment: installment,
    paid_at: record.paidDate || record.paidAt || "",
    slip_url: record.slipUrl || "",
    slip_id: record.slipId || "",
    amount_paid: record.amountPaid || record.amount || 0,
    note: record.note || "",
  }, { onConflict: "customer_id,installment" });
  if (error) throw error;
  return { success: true };
}

export async function postponePayment(customerId, installment, newDate, note) {
  const { data: current, error: fetchErr } = await supabase
    .from("payments")
    .select("date_str, postponed_from")
    .eq("customer_id", customerId)
    .eq("installment", installment)
    .single();
  if (fetchErr) throw fetchErr;

  const originalDate = current.postponed_from || current.date_str;
  const { error } = await supabase
    .from("payments")
    .update({
      date_str: newDate,
      postponed_from: originalDate,
      postpone_note: note || "",
    })
    .eq("customer_id", customerId)
    .eq("installment", installment);
  if (error) throw error;
  return { success: true };
}

export async function deletePaymentRecord(customerId, installment) {
  const { error } = await supabase
    .from("payment_records")
    .delete()
    .eq("customer_id", customerId)
    .eq("installment", installment);
  if (error) throw error;
  return { success: true };
}

// ── Valuations ────────────────────────────────────────────────

export async function getValuations() {
  const { data, error } = await supabase
    .from("valuations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return data.map((v) => ({
    _rowIndex: v.id,
    "วันที่บันทึก": v.recorded_at,
    "วันที่ประเมิน": v.assessment_date,
    "ผู้ประเมิน": v.assessor_name,
    "รหัส/ชื่อทรัพย์": v.project_name,
    "ประเภทการประเมิน": v.assessment_type,
    "ประเภทอสังหาฯ": v.property_type,
    "ประเภทย่อย": v.property_subtype,
    "เลขโฉนด": v.title_deed_no,
    "ระวาง": v.map_sheet,
    "หน้าสำรวจ": v.survey_page,
    "เลขที่ดิน": v.land_no,
    "จังหวัด": v.province,
    "อำเภอ/เขต": v.district,
    "ตำบล/แขวง": v.subdistrict,
    "ไร่": v.area_rai,
    "งาน": v.area_ngan,
    "ตร.ว.": v.area_sqw,
    "ตร.ว.รวม": v.total_sqw,
    "ราคาประเมินรัฐ (บ./ตร.ว.)": v.gov_price,
    "ราคาตลาด (บ./ตร.ว.)": v.effective_market_price,
    "มูลค่าตลาดรวม": v.market_value,
    "ทำเล": v.road_type,
    "ความกว้างถนน": v.road_width,
    "หน้ากว้าง": v.land_frontage,
    "ระยะห่างถนนใหญ่": v.distance_from_main,
    "ผังเมือง": v.zone_color,
    "สภาพดิน": v.soil_condition,
    "Comp (บ./ตร.ว.)": v.comp_price,
    "แหล่ง Comp": v.comp_source,
    "Property Score": v.property_score,
    "LTV Rate (%)": v.ltv_rate,
    "FSV (80%)": v.fsv,
    "วงเงินแนะนำ": v.recommended_loan,
    "วงเงินที่ลูกค้าขอ": v.requested_loan,
    "LTV ลูกค้า (% ต่อตลาด)": v.req_ltv_pct,
    lat: v.lat,
    lng: v.lng,
    "ปัจจัยเสี่ยง": v.risks,
    "หมายเหตุ": v.location_note,
    "สถานะ": v.status,
    "ชื่อลูกค้า": v.customer_name,
    deeds: Array.isArray(v.deeds) ? v.deeds : [],
    propertyImages: Array.isArray(v.property_images) ? v.property_images : [],
    contactName: v.contact_name || "",
    contactPhone: v.contact_phone || "",
    contactLine: v.contact_line || "",
    leadSource: v.lead_source || "",
    leadRef: v.lead_ref || "",
    leadRepliedAt: v.lead_replied_at || "",
    leadReplyResult: v.lead_reply_result || "",
    createdAt: v.created_at || "",
    totalSqw: v.total_sqw || 0,
    // เส้นทางหลังรับทรัพย์ (คอลัมน์จาก supabase_valuation_workflow.sql)
    formSnapshot: v.form_snapshot || null,
    underwritingMemo: v.underwriting_memo || "",
    underwritingAt: v.underwriting_at || "",
    investorSentAt: v.investor_sent_at || "",
    investorSummary: v.investor_summary || "",
    approvedLoan: v.approved_loan || 0,
    _customerId: v.customer_id || "",
  }));
}

// คอลัมน์เสริมที่มาจากไฟล์ SQL ทีหลัง: ถ้าฐานข้อมูลยังไม่มีคอลัมน์ไหน ให้ตัดคอลัมน์นั้นแล้วลองใหม่
// (งานหลักต้องบันทึกได้เสมอ) · คืน { data, error, dropped } — dropped = ชื่อคอลัมน์ที่ยังไม่มี
async function writeWithOptionalColumns(run, base, extras = {}) {
  const pending = { ...extras };
  const dropped = [];
  for (let attempt = 0; attempt <= Object.keys(extras).length; attempt++) {
    const { data, error } = await run({ ...base, ...pending });
    if (!error) return { data, error: null, dropped };
    const detail = `${error.message || ""} ${error.details || ""}`;
    const missing = Object.keys(pending).find((key) => detail.includes(key));
    if (!missing) return { data: null, error, dropped };
    delete pending[missing];
    dropped.push(missing);
  }
  return { data: null, error: new Error("บันทึกไม่สำเร็จ"), dropped };
}

// updateId = เลขรายการเดิม → อัปเดตรายการนั้นด้วยผลประเมินเต็มจากฟอร์ม (ไม่แตะสถานะ ผู้ติดต่อ ที่มาของ lead และวันที่รับเรื่อง)
export async function saveValuation(data, { updateId } = {}) {
  const riskLabels = {
    flood: "เสี่ยงน้ำท่วม", hardAccess: "เข้าถึงยาก/ซอยตัน",
    irregularShape: "รูปแปลงผิดปกติ", encumbrance: "มีภาระผูกพัน",
    dispute: "มีข้อพิพาท/ครอบครอง", noUtilities: "ไม่มีสาธารณูปโภค",
    nuisance: "ติดสิ่งรบกวน", incompleteDeed: "โฉนดไม่สมบูรณ์",
  };
  const risks = data.risks || {};
  const riskText = [
    ...Object.keys(riskLabels).filter((k) => risks[k]).map((k) => riskLabels[k]),
    data.deedRiskText || "", // ข้อจำกัดเอกสารสิทธิ์จาก deedTypes.js (ว่าง = โฉนดปลอดภาระ)
  ].filter(Boolean).join(", ") || "ไม่มี";

  const requestedLoan = parseFloat(data.requestedLoan) || 0;
  const marketValue = parseFloat(data.marketValue) || 0;
  const reqLtvPct = marketValue > 0 ? ((requestedLoan / marketValue) * 100).toFixed(2) : 0;

  const row = {
    recorded_at: new Date().toLocaleString("th-TH"),
    assessment_date: data.assessmentDate || null,
    assessor_name: data.assessorName || "",
    project_name: data.projectName || "",
    assessment_type: data.assessmentType || "",
    property_type: data.propertyType || "",
    property_subtype: data.propertySubtype || "",
    title_deed_no: data.titleDeedNo || "",
    map_sheet: data.mapSheet || "",
    survey_page: data.surveyPage || "",
    land_no: data.landNo || "",
    province: data.province || "",
    district: data.district || "",
    subdistrict: data.subdistrict || "",
    area_rai: data.areaRai || 0,
    area_ngan: data.areaNgan || 0,
    area_sqw: data.areaSqw || 0,
    total_sqw: data.totalSqw || 0,
    gov_price: data.govPrice || 0,
    effective_market_price: data.effectiveMarketPrice || 0,
    market_value: marketValue,
    road_type: data.roadType || "",
    road_width: data.roadWidth || "",
    land_frontage: data.landFrontage || "",
    distance_from_main: data.distanceFromMain || "",
    zone_color: data.zoneColor || "",
    soil_condition: data.soilCondition || "",
    comp_price: data.compPrice || "",
    comp_source: data.compSource || "",
    property_score: data.propertyScore || 100,
    ltv_rate: data.ltvRate || 50,
    fsv: data.fsv || 0,
    recommended_loan: data.recommendedLoan || 0,
    requested_loan: requestedLoan,
    req_ltv_pct: reqLtvPct,
    lat: data.lat != null && data.lat !== "" ? data.lat : null,
    lng: data.lng != null && data.lng !== "" ? data.lng : null,
    risks: riskText,
    location_note: data.locationNote || "",
    status: data.status || "รอดำเนินการ",
    customer_name: data.customerName || "",
    deeds: Array.isArray(data.deeds) ? data.deeds : [],
    property_images: Array.isArray(data.propertyImages) && data.propertyImages.length > 0 ? data.propertyImages : undefined,
    contact_name: data.contactName || "",
    contact_phone: data.contactPhone || "",
    contact_line: data.contactLine || "",
  };
  const extras = {
    // ที่มาของ lead (หน้า /assess เท่านั้น) — supabase_valuation_lead_source.sql
    ...(data.leadSource && !updateId ? { lead_source: data.leadSource, lead_ref: data.leadRef || "" } : {}),
    // ฟอร์มทั้งชุด ไว้เปิดประเมินต่อได้ครบทุกช่อง + บันทึกวิเคราะห์หลักประกัน — supabase_valuation_workflow.sql
    ...(data.formSnapshot ? { form_snapshot: data.formSnapshot } : {}),
    ...(data.underwritingMemo ? { underwriting_memo: data.underwritingMemo, underwriting_at: new Date().toISOString() } : {}),
  };

  if (updateId) {
    const { recorded_at, status, customer_name, contact_name, contact_phone, contact_line, ...assessment } = row;
    const result = await writeWithOptionalColumns(
      (payload) => supabase.from("valuations").update(payload).eq("id", updateId).select("id").single(),
      assessment, extras);
    if (result.error) throw result.error;
    return { success: true, rowIndex: updateId, dropped: result.dropped };
  }

  // ยังไม่ได้รัน SQL เพิ่มคอลัมน์ → บันทึกไว้ก่อนโดยไม่มีคอลัมน์เสริม ดีกว่าทำให้ฟอร์มสาธารณะส่งไม่ได้
  const { data: inserted, error } = await writeWithOptionalColumns(
    (payload) => supabase.from("valuations").insert(payload).select("id").single(), row, extras);
  if (error) throw error;
  await saveAreaPricePointFromValuation(inserted.id, data).catch(() => {});
  return { success: true, rowIndex: inserted.id };
}

export async function saveAreaPricePointFromValuation(valuationId, data) {
  const lat = data.lat != null && data.lat !== "" ? Number(data.lat) : null;
  const lng = data.lng != null && data.lng !== "" ? Number(data.lng) : null;
  const pricePerSqw = Number(data.effectiveMarketPrice) || Number(data.compPrice) || 0;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || pricePerSqw <= 0) {
    return { success: false, skipped: true };
  }

  const { error } = await supabase.from("area_price_points").insert({
    valuation_id: valuationId || null,
    source_type: "assetx_valuation",
    province: data.province || "",
    district: data.district || "",
    subdistrict: data.subdistrict || "",
    lat,
    lng,
    radius_m: 1000,
    property_type: data.propertyType || "",
    property_subtype: data.propertySubtype || "",
    land_area_sqw: data.totalSqw || 0,
    price_per_sqw: pricePerSqw,
    total_price: data.marketValue || 0,
    transaction_or_listing_date: data.assessmentDate || null,
    source_note: data.compSource || data.projectName || "AssetX valuation",
    confidence_score: Number(data.propertyScore) || 60,
    verified_by: data.assessorName || "",
  });
  if (error) throw error;
  return { success: true };
}

export async function getNearbyAreaPricePoints({ lat, lng, province, propertyType, propertySubtype, radiusM = 5000, limit = 8 }) {
  const centerLat = Number(lat);
  const centerLng = Number(lng);
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return [];

  let query = supabase
    .from("area_price_points")
    .select("*")
    .eq("province", province || "")
    .limit(300);

  if (propertyType) query = query.eq("property_type", propertyType);

  const { data, error } = await query;
  if (error) return [];

  return (data || [])
    .map((row) => ({
      ...row,
      distance_m: haversineDistanceMeters(centerLat, centerLng, row.lat, row.lng),
      subtype_match: propertySubtype && row.property_subtype === propertySubtype,
    }))
    .filter((row) => row.distance_m != null && row.distance_m <= radiusM)
    .sort((a, b) => {
      if (a.subtype_match !== b.subtype_match) return a.subtype_match ? -1 : 1;
      return a.distance_m - b.distance_m;
    })
    .slice(0, limit);
}

// รับ lead จากหน้าประเมินออนไลน์สาธารณะ (/assess) — ใช้ insert path เดียวกับ saveValuation
// แค่บังคับ status ให้แยกจากงานประเมินภายในของพนักงาน เพื่อให้ทีมงานคัดกรองก่อนเข้า pipeline ปกติ
export async function submitPublicAssessment(data) {
  // ผู้เรียกส่งรูปแนบ (ถ้ามี) แล้วเรียก notifyPublicLead เอง — เซิร์ฟเวอร์อ่านแถวจากเลขที่ ไม่รับข้อความจากหน้าเว็บ
  return saveValuation({ ...data, status: "Lead จากเว็บ", leadSource: data.leadSource || "owner" });
}

// แจ้งเจ้าของทาง Telegram ว่ามี lead ใหม่ — เรียกหลังส่งรูปแนบครบ เพื่อให้ข้อความบอกจำนวนรูปได้
// คืน { sent, brokerCode } — brokerCode = รหัสในทะเบียนนายหน้าของผู้ส่ง (ใช้ทำลิงก์ส่วนตัวในหน้าส่งสำเร็จ)
export async function notifyPublicLead(id) {
  try {
    const res = await fetch("/api/assess-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "lead-notify", id }),
      keepalive: true,
    });
    return await res.json().catch(() => ({}));
  } catch { return {}; /* เงียบไว้: lead บันทึกแล้ว เจ้าของยังเห็นในแอป */ }
}

// ทะเบียนนายหน้า (server/brokers.js · ต้องล็อกอิน) — error.missingTable = ยังไม่ได้รัน supabase_brokers.sql
async function brokersCall(method, body) {
  const res = await fetch("/api/brokers", { method, credentials: "same-origin", cache: "no-store", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "ติดต่อทะเบียนนายหน้าไม่สำเร็จ"), { missingTable: Boolean(data.missingTable) });
  return data;
}
export const getBrokers = async () => (await brokersCall("GET")).brokers || [];
export const brokerAction = (action, payload = {}) => brokersCall("POST", { action, ...payload });

// ส่งรูปแนบของ lead ทีละรูป (หน้า /assess) — file = { kind: 'deed' | 'property', base64 }
export async function uploadPublicLeadFile(id, file) {
  const res = await fetch("/api/assess-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "lead-upload", id, file }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "ส่งรูปไม่สำเร็จ");
  return data;
}

// รูปแนบของ lead พร้อมลิงก์ชั่วคราว (ต้องล็อกอิน)
export async function getLeadFiles(id) {
  const res = await fetch(`/api/lead-files?id=${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "เปิดรูปแนบไม่สำเร็จ");
  return Array.isArray(data.files) ? data.files : [];
}

// คิวสำรวจราคาตลาดจากประกาศขาย (server/market-survey-jobs.js · ต้องล็อกอิน) — งานรันบนคอมสำนักงาน หน้าเว็บถามสถานะเป็นระยะ
async function marketSurveyCall(method, { query = "", body } = {}) {
  const res = await fetch(`/api/market-survey${query}`, { method, credentials: "same-origin", cache: "no-store", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "ติดต่อคิวสำรวจราคาไม่สำเร็จ");
  return data;
}
export const getMarketSurvey = ({ id, valuationId } = {}) => marketSurveyCall("GET", { query: id ? `?id=${encodeURIComponent(id)}` : valuationId ? `?valuation_id=${encodeURIComponent(valuationId)}` : "" });
export const createMarketSurvey = ({ valuationId, request }) => marketSurveyCall("POST", { body: { action: "create", valuation_id: valuationId || null, request } });
export const cancelMarketSurvey = (id) => marketSurveyCall("POST", { body: { action: "cancel", id } });

// บันทึกว่าตอบผลเบื้องต้นกลับผู้ส่งแล้ว (คอลัมน์จาก supabase_lead_files_reply.sql)
export async function markLeadReplied(rowIndex, result) {
  const repliedAt = new Date().toISOString();
  const { error } = await supabase.from("valuations")
    .update({ lead_replied_at: repliedAt, lead_reply_result: result || "" }).eq("id", rowIndex);
  if (error) throw error;
  return repliedAt;
}

// ส่งสรุปให้นายทุนแล้ว → ย้ายไปแท็บรอตัดสินใจ พร้อมเก็บเวลาและข้อความที่ส่ง (ไว้ดูว่ารอผลมานานแค่ไหน)
export async function markInvestorSent(rowIndex, summary) {
  const sentAt = new Date().toISOString();
  const result = await writeWithOptionalColumns(
    (payload) => supabase.from("valuations").update(payload).eq("id", rowIndex).select("id").single(),
    { status: "รอการพิจารณา" }, { investor_sent_at: sentAt, investor_summary: String(summary || "").slice(0, 4000) });
  if (result.error) throw result.error;
  return { sentAt: result.dropped.includes("investor_sent_at") ? "" : sentAt, dropped: result.dropped };
}

// นายทุนอนุมัติ → เก็บวงเงินที่อนุมัติ ใช้เป็นเงินต้นตั้งต้นตอนสร้างสัญญา
export async function approveValuation(rowIndex, approvedLoan) {
  const amount = Number(approvedLoan) > 0 ? Number(approvedLoan) : null;
  const result = await writeWithOptionalColumns(
    (payload) => supabase.from("valuations").update(payload).eq("id", rowIndex).select("id").single(),
    { status: "อนุมัติ" }, amount ? { approved_loan: amount } : {});
  if (result.error) throw result.error;
  return { approvedLoan: result.dropped.includes("approved_loan") ? 0 : (amount || 0), dropped: result.dropped };
}

// สร้างสัญญาแล้ว → ผูกรายการประเมินกับรหัสลูกค้า (ปุ่มเบรกทรัพย์/ยกเลิกสัญญาใช้รหัสนี้หาลูกค้า)
export async function linkValuationCustomer(rowIndex, customerId) {
  const result = await writeWithOptionalColumns(
    (payload) => supabase.from("valuations").update(payload).eq("id", rowIndex).select("id").single(),
    { status: "สร้างสัญญาแล้ว" }, { customer_id: customerId });
  if (result.error) throw result.error;
  return { dropped: result.dropped };
}

export async function updateValuation(rowIndex, data) {
  const updates = {};
  const fieldMap = {
    // camelCase keys
    assessmentDate: "assessment_date", assessorName: "assessor_name",
    projectName: "project_name", assessmentType: "assessment_type",
    propertyType: "property_type", propertySubtype: "property_subtype",
    titleDeedNo: "title_deed_no", mapSheet: "map_sheet",
    surveyPage: "survey_page", landNo: "land_no",
    province: "province", district: "district", subdistrict: "subdistrict",
    areaRai: "area_rai", areaNgan: "area_ngan", areaSqw: "area_sqw", totalSqw: "total_sqw",
    govPrice: "gov_price", effectiveMarketPrice: "effective_market_price", marketValue: "market_value",
    roadType: "road_type", roadWidth: "road_width", landFrontage: "land_frontage",
    distanceFromMain: "distance_from_main", zoneColor: "zone_color", soilCondition: "soil_condition",
    compPrice: "comp_price", compSource: "comp_source",
    propertyScore: "property_score", ltvRate: "ltv_rate", fsv: "fsv",
    recommendedLoan: "recommended_loan", requestedLoan: "requested_loan",
    lat: "lat", lng: "lng", locationNote: "location_note", customerName: "customer_name",
    // Thai keys (used by HistoryView editForm)
    'รหัส/ชื่อทรัพย์': "project_name",
    'วันที่ประเมิน': "assessment_date",
    'ผู้ประเมิน': "assessor_name",
    'ประเภทการประเมิน': "assessment_type",
    'มูลค่าตลาดรวม': "market_value",
    'FSV (80%)': "fsv",
    'วงเงินแนะนำ': "recommended_loan",
    'Property Score': "property_score",
    'LTV Rate (%)': "ltv_rate",
    'วงเงินที่ลูกค้าขอ': "requested_loan",
    'ปัจจัยเสี่ยง': "risks",
    'หมายเหตุ': "location_note",
    'สถานะ': "status",
  };
  Object.entries(fieldMap).forEach(([jsKey, dbKey]) => {
    if (data[jsKey] !== undefined) updates[dbKey] = data[jsKey];
  });
  if (data.deeds !== undefined) updates.deeds = data.deeds;
  if (data.propertyImages !== undefined) updates.property_images = data.propertyImages;

  const { error } = await supabase.from("valuations").update(updates).eq("id", rowIndex);
  if (error) throw error;
  return { success: true };
}

export async function updateValuationStatus(rowIndex, status) {
  const { error } = await supabase.from("valuations").update({ status }).eq("id", rowIndex);
  if (error) throw error;
  return { success: true };
}

export async function deleteValuation(rowIndex) {
  const { error } = await supabase.from("valuations").delete().eq("id", rowIndex);
  if (error) throw error;
  return { success: true };
}

// -- Case workflow ----------------------------------------------------------
export async function getWorkflowCases() {
  const { data, error } = await supabase
    .from("workflow_cases")
    .select("*")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createWorkflowCase(input) {
  const { data, error } = await supabase
    .from("workflow_cases")
    .insert({
      case_code: input.caseCode,
      valuation_id: input.valuationId || null,
      customer_id: input.customerId || null,
      case_name: input.caseName || "",
      contact_name: input.contactName || "",
      transaction_type: input.transactionType || "",
      phase: 1,
      status: "active",
      priority: input.priority || "normal",
      owner_name: input.ownerName || "",
      next_action: input.nextAction || "ตรวจเอกสารรับเรื่อง",
      due_date: input.dueDate || null,
      checklist: {},
      phase_notes: {},
    })
    .select("*")
    .single();
  if (error) throw error;
  await addWorkflowEvent({
    caseId: data.id,
    eventType: "case_created",
    toPhase: 1,
    note: "สร้างเคสใหม่",
    actor: input.ownerName || "ทีม AssetX",
  });
  return data;
}

export async function updateWorkflowCase(caseId, updates) {
  const { data, error } = await supabase
    .from("workflow_cases")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", caseId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function addWorkflowEvent({ caseId, eventType, fromPhase, toPhase, note, actor, metadata }) {
  const { data, error } = await supabase
    .from("workflow_case_events")
    .insert({
      case_id: caseId,
      event_type: eventType,
      from_phase: fromPhase || null,
      to_phase: toPhase || null,
      note: note || "",
      actor: actor || "ทีม AssetX",
      metadata: metadata || {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getWorkflowEvents(caseId) {
  const { data, error } = await supabase
    .from("workflow_case_events")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── Reservations (ใบจอง) ─────────────────────────────────────

export async function getReservations() {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .order("transfer_deadline", { ascending: true });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    projectName: r.project_name,
    developer: r.developer || "",
    propertyType: r.property_type || "",
    unitNo: r.unit_no || "",
    bookingPrice: r.booking_price || 0,
    depositPaid: r.deposit_paid || 0,
    downPaymentPaid: r.down_payment_paid || 0,
    monthlyInstallment: r.monthly_installment || 0,
    bookingDate: r.booking_date || "",
    transferDeadline: r.transfer_deadline || "",
    status: r.status || "ถือครอง",
    assignedTo: r.assigned_to || "",
    assignmentPrice: r.assignment_price || 0,
    assignmentDate: r.assignment_date || "",
    assignmentFee: r.assignment_fee || 0,
    notes: r.notes || "",
    createdAt: r.created_at,
  }));
}

export async function createReservation(data) {
  const { error } = await supabase.from("reservations").insert({
    project_name: data.projectName,
    developer: data.developer || "",
    property_type: data.propertyType || "",
    unit_no: data.unitNo || "",
    booking_price: data.bookingPrice || 0,
    deposit_paid: data.depositPaid || 0,
    down_payment_paid: data.downPaymentPaid || 0,
    monthly_installment: data.monthlyInstallment || 0,
    booking_date: data.bookingDate || null,
    transfer_deadline: data.transferDeadline || null,
    status: data.status || "ถือครอง",
    notes: data.notes || "",
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { success: true };
}

export async function updateReservation(id, data) {
  const updates = { updated_at: new Date().toISOString() };
  const map = {
    projectName: "project_name", developer: "developer",
    propertyType: "property_type", unitNo: "unit_no",
    bookingPrice: "booking_price", depositPaid: "deposit_paid",
    downPaymentPaid: "down_payment_paid", monthlyInstallment: "monthly_installment",
    bookingDate: "booking_date", transferDeadline: "transfer_deadline",
    status: "status", assignedTo: "assigned_to",
    assignmentPrice: "assignment_price", assignmentDate: "assignment_date",
    assignmentFee: "assignment_fee", notes: "notes",
  };
  Object.entries(map).forEach(([k, v]) => { if (data[k] !== undefined) updates[v] = data[k]; });
  const { error } = await supabase.from("reservations").update(updates).eq("id", id);
  if (error) throw error;
  return { success: true };
}

export async function deleteReservation(id) {
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) throw error;
  return { success: true };
}

// ── Contract Top-ups ─────────────────────────────────────────

export async function getTopups(customerId) {
  const { data: topupRows, error: topupErr } = await supabase
    .from("contract_topups")
    .select("*")
    .eq("customer_id", customerId)
    .order("topup_date", { ascending: true });
  if (topupErr) throw topupErr;

  const { data: recRows, error: recErr } = await supabase
    .from("topup_payment_records")
    .select("*")
    .eq("customer_id", customerId);
  if (recErr) throw recErr;

  return mapTopupRows(topupRows, recRows);
}

// โหลดวงเงินเพิ่มทุกรายการของทุกลูกค้า — ใช้ให้ยอดรวมบนหน้าหลัก/Dashboard นับวงเงินเพิ่มได้ตั้งแต่เปิดหน้า
export async function getAllTopups() {
  const { data: topupRows, error: topupErr } = await supabase
    .from("contract_topups")
    .select("*")
    .order("topup_date", { ascending: true });
  if (topupErr) throw topupErr;

  const { data: recRows, error: recErr } = await supabase
    .from("topup_payment_records")
    .select("*");
  if (recErr) throw recErr;

  return mapTopupRows(topupRows, recRows);
}

function mapTopupRows(topupRows, recRows) {
  const recMap = {};
  (recRows || []).forEach((r) => {
    if (!recMap[r.topup_id]) recMap[r.topup_id] = {};
    recMap[r.topup_id][r.installment] = {
      paidDate: r.paid_at,
      slipUrl: r.slip_url,
      slipId: r.slip_id,
      amountPaid: r.amount_paid,
      note: r.note,
    };
  });

  return (topupRows || []).map((t) => ({
    id: t.id,
    customerId: t.customer_id,
    topupDate: t.topup_date,
    topupAmount: t.topup_amount,
    originalPrincipal: t.original_principal,
    totalPrincipal: t.total_principal,
    interestAmount: t.interest_amount,
    freq: t.freq,
    topupStartDate: t.topup_start_date,
    topupEndDate: t.topup_end_date || "",
    approvedBy: t.approved_by || "",
    reason: t.reason || "",
    note: t.note || "",
    payments: Array.isArray(t.payments) ? t.payments : [],
    records: recMap[t.id] || {},
    createdAt: t.created_at,
  }));
}

export async function createTopup(data) {
  const { error } = await supabase.from("contract_topups").insert({
    customer_id: data.customerId,
    topup_date: data.topupDate,
    topup_amount: data.topupAmount,
    original_principal: data.originalPrincipal,
    total_principal: data.totalPrincipal,
    interest_amount: data.interestAmount,
    freq: data.freq,
    topup_start_date: data.topupStartDate,
    topup_end_date: data.topupEndDate || null,
    approved_by: data.approvedBy || "",
    reason: data.reason || "",
    note: data.note || "",
    payments: data.payments || [],
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { success: true };
}

export async function deleteTopup(topupId) {
  const { error } = await supabase
    .from("contract_topups")
    .delete()
    .eq("id", topupId);
  if (error) throw error;
  return { success: true };
}

export async function saveTopupPaymentRecord(topupId, customerId, installment, record) {
  const { error } = await supabase.from("topup_payment_records").upsert({
    topup_id: topupId,
    customer_id: customerId,
    installment,
    paid_at: record.paidDate || record.paidAt || "",
    slip_url: record.slipUrl || "",
    slip_id: record.slipId || "",
    amount_paid: record.amountPaid || record.amount || 0,
    note: record.note || "",
  }, { onConflict: "topup_id,installment" });
  if (error) throw error;
  return { success: true };
}

export async function deleteTopupPaymentRecord(topupId, installment) {
  const { error } = await supabase
    .from("topup_payment_records")
    .delete()
    .eq("topup_id", topupId)
    .eq("installment", installment);
  if (error) throw error;
  return { success: true };
}

// เลื่อนนัดงวดดอกเบี้ยของวงเงินเพิ่ม — ตารางชำระเก็บเป็น JSON ใน contract_topups.payments จึงต้องอ่านทั้งชุดแล้วเขียนกลับ
export async function postponeTopupPayment(topupId, installment, newDate, note) {
  const { data: current, error: fetchErr } = await supabase
    .from("contract_topups")
    .select("payments")
    .eq("id", topupId)
    .single();
  if (fetchErr) throw fetchErr;

  const payments = postponeTopupInstallment(current.payments, installment, newDate, note);
  const { data: updated, error } = await supabase
    .from("contract_topups")
    .update({ payments, updated_at: new Date().toISOString() })
    .eq("id", topupId)
    .select("id");
  if (error) throw error;
  // PATCH ที่ไม่ตรงแถวใด (ถูก RLS กัน/แถวถูกลบไปแล้ว) ไม่ถือเป็น error — ต้องเช็กเอง ไม่งั้นหน้าเว็บจะแสดงว่าเลื่อนแล้วทั้งที่ไม่ได้บันทึก
  if (!updated?.length) throw new Error("บันทึกการเลื่อนไม่สำเร็จ: ไม่พบรายการวงเงินเพิ่ม หรือไม่มีสิทธิ์แก้ไข");
  return { success: true, payments };
}

// ── ชำระเพิ่ม / ยกเว้นส่วนที่ขาดของงวด ─────────────────────────
// ผ่านเซิร์ฟเวอร์เท่านั้น (/api/payment-additions ตรวจ session) — ตาราง payment_additions เพิ่มอย่างเดียว ยกเลิกด้วยการตั้งวันที่ยกเลิก
// ข้อผิดพลาดมี status และ code ติดไปด้วย: 503 + table_missing = ยังไม่ได้รัน supabase_payment_additions.sql
//   503 + not_configured = เซิร์ฟเวอร์ไม่มีกุญแจ · 409 + duplicate/conflict/settled = บันทึกไว้แล้ว/มีคนบันทึกพร้อมกัน/งวดครบแล้ว

async function paymentAdditionsRequest(method, { query = "", body } = {}) {
  let res;
  try {
    res = await fetch(`/api/payment-additions${query}`, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // เน็ตหลุด/เซิร์ฟเวอร์ไม่ตอบ: ยังไม่รู้ว่าบันทึกถึงฐานข้อมูลหรือยัง — ส่งซ้ำด้วยหน้าต่างเดิมได้ (รหัสรายการเดิมกันบันทึกซ้ำ)
    throw Object.assign(new Error("ติดต่อเซิร์ฟเวอร์ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่"), { status: 0, code: "network" });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "ติดต่อระบบชำระเพิ่มไม่สำเร็จ กรุณาลองใหม่"), { status: res.status, code: data.code || "" });
  return data;
}

// ไม่ระบุลูกค้า = ทุกรายการ (รวมที่ยกเลิกแล้ว) สำหรับคิดสถานะงวดบนหน้าหลัก
export async function getPaymentAdditions(customerId = "") {
  const data = await paymentAdditionsRequest("GET", { query: customerId ? `?customerId=${encodeURIComponent(customerId)}` : "" });
  return Array.isArray(data.additions) ? data.additions : [];
}

export async function addPaymentAddition(input) {
  const data = await paymentAdditionsRequest("POST", { body: input });
  return data.addition;
}

export async function voidPaymentAddition(id, customerId, voidReason) {
  const data = await paymentAdditionsRequest("PATCH", { body: { id, customerId, voidReason } });
  return data.addition;
}

// ── Contract Renewal ─────────────────────────────────────────

export async function renewContract(customerId, data) {
  const { error: custErr } = await supabase
    .from("customers")
    .update({ contract_end_date: data.newEndDate, updated_at: new Date().toISOString() })
    .eq("id", customerId);
  if (custErr) throw custErr;

  if (data.newPayments && data.newPayments.length > 0) {
    const rows = data.newPayments.map(p => ({
      customer_id: customerId,
      installment: p.installment,
      date_str: p.dateStr,
    }));
    const { error: payErr } = await supabase
      .from("payments")
      .upsert(rows, { onConflict: "customer_id,installment" });
    if (payErr) throw payErr;
  }
  return { success: true };
}

// ── Destinations ──────────────────────────────────────────────

export async function getDestinations() {
  const { data, error } = await supabase.from("destinations").select("*");
  if (error) throw error;
  return data;
}

// ── Marketing OS workspace ───────────────────────────────────

export async function getMarketingWorkspace(id = "default") {
  const { data, error } = await supabase
    .from("marketing_workspaces")
    .select("payload,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// รูปที่อยู่ในที่เก็บไฟล์แล้ว (มี storagePath) ไม่ถูกส่งไปกับก้อนนี้ — เหลือแค่ตำแหน่งไฟล์ (lib/marketingMedia.js)
export async function saveMarketingWorkspace(payload, id = "default") {
  const { error } = await supabase.from("marketing_workspaces").upsert({
    id,
    payload: dehydrateWorkspace(payload),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { success: true };
}

// ── LINE ──
export async function sendLineMessage(destinationId, message) {
  const { sendLineMessage: send } = await import('./lineDelivery.js');
  return send(destinationId, message);
}

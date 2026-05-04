// ============================================================
// AssetX API — Supabase wrapper แทน Google Apps Script
// ทุก component ที่เคย fetch(APPS_SCRIPT_URL) ให้ import จากที่นี่
// ============================================================
import { supabase } from "./supabase";

// ── Customers ─────────────────────────────────────────────────

export async function getCustomers() {
  const { data: custRows, error: custErr } = await supabase
    .from("customers")
    .select("*")
    .eq("is_cancelled", false)
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

export async function cancelCustomer(customerId) {
  const { error } = await supabase
    .from("customers")
    .update({ is_cancelled: true, updated_at: new Date().toISOString() })
    .eq("id", customerId);
  if (error) throw error;
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
  }));
}

export async function saveValuation(data) {
  const riskLabels = {
    flood: "เสี่ยงน้ำท่วม", hardAccess: "เข้าถึงยาก/ซอยตัน",
    irregularShape: "รูปแปลงผิดปกติ", encumbrance: "มีภาระผูกพัน",
    dispute: "มีข้อพิพาท/ครอบครอง", noUtilities: "ไม่มีสาธารณูปโภค",
    nuisance: "ติดสิ่งรบกวน", incompleteDeed: "โฉนดไม่สมบูรณ์",
  };
  const risks = data.risks || {};
  const riskText = Object.keys(riskLabels).filter((k) => risks[k]).map((k) => riskLabels[k]).join(", ") || "ไม่มี";

  const requestedLoan = parseFloat(data.requestedLoan) || 0;
  const marketValue = parseFloat(data.marketValue) || 0;
  const reqLtvPct = marketValue > 0 ? ((requestedLoan / marketValue) * 100).toFixed(2) : 0;

  const { data: inserted, error } = await supabase.from("valuations").insert({
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
    status: "รอดำเนินการ",
    customer_name: data.customerName || "",
    deeds: Array.isArray(data.deeds) ? data.deeds : [],
  }).select("id").single();
  if (error) throw error;
  return { success: true, rowIndex: inserted.id };
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

// ── Destinations ──────────────────────────────────────────────

export async function getDestinations() {
  const { data, error } = await supabase.from("destinations").select("*");
  if (error) throw error;
  return data;
}

// ── LINE (ยังส่งผ่าน GAS เพราะ LINE API ต้องการ server-side token) ──
export async function sendLineMessage(destinationId, message) {
  const GAS_URL = import.meta.env.VITE_GAS_URL;
  if (!GAS_URL) return { success: false, error: "ไม่มี GAS_URL" };
  const url = destinationId ? `${GAS_URL}?dest=${encodeURIComponent(destinationId)}` : GAS_URL;
  await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "sendLine", message }),
  });
  return { success: true };
}

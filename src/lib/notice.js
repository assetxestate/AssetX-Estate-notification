// ข้อมูลตั้งต้นสำหรับผู้ใช้งานหลัก สามารถแก้ไขเป็นรายสัญญาได้ในหน้าลูกค้า
export const SENDER_INFO = {
  name: "จักรพันธ์ ศรีสว่าง",
  position: "ผู้จัดการ",
  company: "บริษัท แอสเสท เอ็กซ์ เอสเตท จำกัด",
  address: "345/34 หมู่บ้านแกรนดิโอ2 - พระราม2 หมู่ที่ 5 ตำบลพันท้ายนรสิงห์ อำเภอเมืองสมุทรสาคร จังหวัดสมุทรสาคร 74000",
};

const THAI_MONTHS = [
  "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const REQUIRED_NOTICE_FIELDS = [
  ["fullName", "ชื่อผู้ขายฝาก"],
  ["sellerNationalId", "เลขประจำตัวประชาชนผู้ขายฝาก"],
  ["address", "ที่อยู่ผู้ขายฝาก"],
  ["contractNumber", "เลขที่สัญญาขายฝาก"],
  ["contractDate", "วันที่ทำสัญญา"],
  ["landOffice", "สำนักงานที่ดิน"],
  ["redemptionAmount", "จำนวนสินไถ่"],
  ["buyerName", "ชื่อผู้ซื้อฝาก"],
  ["buyerNationalId", "เลขประจำตัวประชาชนผู้ซื้อฝาก"],
  ["buyerAddress", "ที่อยู่ผู้ซื้อฝาก"],
];

function readThaiUnderMillion(value, useEtForOne = false) {
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
  const text = String(value);
  let result = "";

  for (let index = 0; index < text.length; index += 1) {
    const digit = Number(text[index]);
    const position = text.length - index - 1;
    if (digit === 0) continue;
    if (position === 1 && digit === 1) result += "สิบ";
    else if (position === 1 && digit === 2) result += "ยี่สิบ";
    else if (position === 0 && digit === 1 && (text.length > 1 || useEtForOne)) result += "เอ็ด";
    else result += digits[digit] + positions[position];
  }

  return result;
}

function readThaiInteger(value) {
  if (value < 1_000_000) return readThaiUnderMillion(value);
  const higher = Math.floor(value / 1_000_000);
  const remainder = value % 1_000_000;
  return `${readThaiInteger(higher)}ล้าน${remainder ? readThaiUnderMillion(remainder, true) : ""}`;
}

export function numberToThaiText(amount) {
  const number = Number(amount);
  if (!Number.isFinite(number) || number < 0) return "-";

  const rounded = Math.round((number + Number.EPSILON) * 100);
  const baht = Math.floor(rounded / 100);
  const satang = rounded % 100;
  let result = baht === 0 ? "ศูนย์บาท" : `${readThaiInteger(baht)}บาท`;

  if (satang === 0) return `${result}ถ้วน`;
  result += `${readThaiUnderMillion(satang)}สตางค์`;
  return result;
}

function parseDateParts(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { day: value.getDate(), month: value.getMonth() + 1, year: value.getFullYear() };
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { day, month, year };
}

function toLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatThaiDateFull(dateValue) {
  const parts = parseDateParts(dateValue);
  if (!parts) return "-";
  return `${parts.day} ${THAI_MONTHS[parts.month]} พ.ศ. ${parts.year + 543}`;
}

export function formatThaiLegalDate(dateValue) {
  const parts = parseDateParts(dateValue);
  if (!parts) return "-";
  return `${parts.day} ${THAI_MONTHS[parts.month]} ${parts.year + 543}`;
}

export function formatLandArea(areaStr) {
  if (!areaStr) return "-";
  const match = String(areaStr).match(/^(\d+)-(\d+)-([\d.]+)/);
  if (!match) return String(areaStr);
  const parts = [];
  if (Number(match[1]) > 0) parts.push(`${Number(match[1])} ไร่`);
  if (Number(match[2]) > 0) parts.push(`${Number(match[2])} งาน`);
  if (Number(match[3]) > 0) parts.push(`${Number(match[3])} ตารางวา`);
  return parts.join(" ") || "-";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function calculateContractTerm(contractDate, endDate) {
  const start = parseDateParts(contractDate);
  const end = parseDateParts(endDate);
  if (!start || !end) return "-";
  let months = (end.year - start.year) * 12 + end.month - start.month;
  if (end.day < start.day) months -= 1;
  if (months > 0 && months % 12 === 0) return `${months / 12} ปี`;
  return months > 0 ? `${months} เดือน` : "-";
}

function normalizeDeeds(rawDeeds) {
  let parsed = rawDeeds;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = [];
    }
  }
  if (Array.isArray(parsed)) return parsed.filter(deed => deed && typeof deed === "object");
  if (parsed && typeof parsed === "object") return [parsed];
  return [];
}

function buildDeedDescription(deed) {
  const locality = [
    deed.tambon ? `ตำบล/แขวง${deed.tambon}` : "",
    deed.amphoe ? `อำเภอ/เขต${deed.amphoe}` : "",
    deed.province ? `จังหวัด${deed.province}` : "",
  ].filter(Boolean).join(" ");
  return [
    `โฉนดที่ดินเลขที่ ${deed.no || "-"}`,
    `เลขที่ดิน ${deed.landNo || "-"}`,
    deed.surveyPage ? `หน้าสำรวจ ${deed.surveyPage}` : "",
    locality,
    `เนื้อที่ ${formatLandArea(deed.area)}`,
  ].filter(Boolean).join(" ");
}

export function getSaleRedemptionNoticeMissingFields(customer, extraInfo = {}) {
  const missing = REQUIRED_NOTICE_FIELDS
    .filter(([key]) => !String(extraInfo?.[key] ?? "").trim())
    .map(([, label]) => label);
  if (!customer?.contractEndDate) missing.push("วันครบกำหนดไถ่");
  const deed = normalizeDeeds(customer?.deeds)[0] || {};
  if (!extraInfo.titleDeedNumber && !deed.no) missing.push("เลขที่โฉนด");
  if (!extraInfo.landNumber && !deed.landNo) missing.push("เลขที่ดิน");
  if (!extraInfo.subdistrict && !deed.tambon) missing.push("ตำบล/แขวงตามโฉนด");
  if (!extraInfo.district && !deed.amphoe) missing.push("อำเภอ/เขตตามโฉนด");
  if (!extraInfo.province && !deed.province) missing.push("จังหวัดตามโฉนด");
  if (!(Number(extraInfo?.redemptionAmount) > 0)) missing.push("จำนวนสินไถ่ที่มากกว่า 0 บาท");
  return [...new Set(missing)];
}

export function buildSaleRedemptionNoticeData(customer, extraInfo = {}, now = new Date()) {
  const normalizedDeeds = normalizeDeeds(customer?.deeds);
  const sourceDeeds = normalizedDeeds.length ? normalizedDeeds : [{}];
  const deeds = sourceDeeds.map((deed, index) => index !== 0 ? deed : ({
    ...deed,
    no: extraInfo.titleDeedNumber || deed.no,
    landNo: extraInfo.landNumber || deed.landNo,
    surveyPage: extraInfo.surveyPage || deed.surveyPage,
    tambon: extraInfo.subdistrict || deed.tambon,
    amphoe: extraInfo.district || deed.amphoe,
    province: extraInfo.province || deed.province,
    area: extraInfo.landArea || deed.area,
  }));
  const noticeDate = extraInfo.noticeDate || toLocalIsoDate(now);
  const redemptionAmount = Number(extraInfo.redemptionAmount || 0);
  const contractDate = formatThaiLegalDate(extraInfo.contractDate);
  const contractTerm = extraInfo.contractTerm || calculateContractTerm(extraInfo.contractDate, customer.contractEndDate);
  const buyerAddress = extraInfo.buyerAddress || SENDER_INFO.address;

  return {
    title: "หนังสือแจ้งกำหนดเวลาไถ่และจำนวนสินไถ่จากขายฝาก",
    noticeDate: formatThaiLegalDate(noticeDate),
    contractDate,
    contractEndDate: formatThaiLegalDate(customer.contractEndDate),
    contractTerm,
    redemptionAmount,
    redemptionAmountText: numberToThaiText(redemptionAmount),
    landOffice: extraInfo.landOffice || "-",
    paymentLocation: extraInfo.paymentLocation || extraInfo.landOffice || "-",
    sellerName: extraInfo.fullName || customer.name || "-",
    sellerNationalId: extraInfo.sellerNationalId || "-",
    sellerAddress: extraInfo.address || "-",
    sellerPhone: extraInfo.sellerPhone || "-",
    buyerName: extraInfo.buyerName || SENDER_INFO.name || "-",
    buyerNationalId: extraInfo.buyerNationalId || "-",
    buyerAddress,
    buyerPhone: extraInfo.buyerPhone || "-",
    documentPlace: extraInfo.documentPlace || buyerAddress,
    contractNumber: extraInfo.contractNumber || "-",
    propertyDescription: deeds.map(buildDeedDescription).join(" และ "),
    buildingDetails: extraInfo.buildingDetails || "",
    attachmentText: extraInfo.attachmentText || `สำเนาหนังสือสัญญาขายฝากเลขที่ ${extraInfo.contractNumber || "-"} ลงวันที่ ${contractDate} จำนวน 1 ชุด`,
  };
}

export function buildSaleRedemptionNoticeHtml(customer, extraInfo = {}, now = new Date()) {
  const data = buildSaleRedemptionNoticeData(customer, extraInfo, now);
  const propertyText = `${data.propertyDescription}${data.buildingDetails ? ` พร้อมสิ่งปลูกสร้าง${data.buildingDetails}` : ""}`;

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.title)} - ${escapeHtml(data.sellerName)}</title>
<style>
  @page { size: A4; margin: 16mm 20mm 15mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #e5e7eb; color: #000; font-family: "TH Sarabun New", "Sarabun", Tahoma, sans-serif; font-size: 16pt; line-height: 1.25; }
  .toolbar { position: sticky; top: 0; z-index: 2; display: flex; justify-content: center; gap: 10px; padding: 12px; background: #0f172a; }
  .toolbar button { border: 0; border-radius: 6px; padding: 9px 18px; background: #2dd4bf; color: #062723; font: 700 14px "Sarabun", sans-serif; cursor: pointer; }
  .page { width: 210mm; min-height: 297mm; margin: 16px auto; padding: 16mm 20mm 15mm; background: #fff; box-shadow: 0 3px 16px rgba(0,0,0,.18); }
  .title { margin: 0 0 10px; text-align: center; font-size: 18pt; font-weight: 700; }
  .place { width: 58%; margin-left: auto; margin-bottom: 8px; }
  .place div { margin-bottom: 2px; }
  .meta-row { display: grid; grid-template-columns: 38mm 1fr; margin: 2px 0; }
  .meta-label { font-weight: 700; }
  p { margin: 6px 0; }
  .body-paragraph { text-indent: 35mm; text-align: justify; }
  .detail-table { width: calc(100% - 18mm); margin: 8px 0 10px 18mm; border-collapse: collapse; }
  .detail-table td { padding: 2px 4px; vertical-align: top; }
  .detail-table td:first-child { width: 50mm; font-weight: 700; white-space: nowrap; }
  .signature { width: 75mm; margin: 16px 0 0 auto; text-align: center; }
  .signature-space { height: 20px; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .page { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
  }
</style>
</head>
<body>
<div class="toolbar"><button type="button" onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button></div>

<main class="page">
  <h1 class="title">${escapeHtml(data.title)}</h1>
  <div class="place">
    <div>ทำที่ ${escapeHtml(data.documentPlace)}</div>
    <div>วันที่ ${escapeHtml(data.noticeDate)}</div>
  </div>

  <div class="meta-row"><div class="meta-label">เรื่อง</div><div>แจ้งกำหนดเวลาไถ่และจำนวนสินไถ่จากขายฝาก</div></div>
  <div class="meta-row"><div class="meta-label">เรียน</div><div>${escapeHtml(data.sellerName)}</div></div>
  <div class="meta-row"><div class="meta-label">สิ่งที่ส่งมาด้วย</div><div>${escapeHtml(data.attachmentText)}</div></div>

  <p class="body-paragraph">ตามที่ ${escapeHtml(data.sellerName)} เลขประจำตัวประชาชน ${escapeHtml(data.sellerNationalId)} อยู่${escapeHtml(data.sellerAddress)} ได้ทำหนังสือสัญญาขายฝากเลขที่ ${escapeHtml(data.contractNumber)} มีกำหนดเวลาไถ่ ${escapeHtml(data.contractTerm)} ลงวันที่ ${escapeHtml(data.contractDate)} ณ ${escapeHtml(data.landOffice)} กับ${escapeHtml(data.buyerName)} เลขประจำตัวประชาชน ${escapeHtml(data.buyerNationalId)} ผู้ซื้อฝาก โดยทรัพย์สินที่ขายฝากคือ ${escapeHtml(propertyText)} นั้น</p>

  <p class="body-paragraph">บัดนี้ สัญญาขายฝากดังกล่าวจะครบกำหนดเวลาไถ่ในวันที่ ${escapeHtml(data.contractEndDate)} ผู้ซื้อฝากจึงมีหนังสือฉบับนี้แจ้งให้ท่านทราบถึงกำหนดเวลาไถ่และจำนวนสินไถ่ เพื่อให้ท่านใช้สิทธิไถ่ทรัพย์สินที่ขายฝากภายในกำหนดเวลาไถ่ตามสัญญา โดยมีรายละเอียดดังต่อไปนี้</p>

  <table class="detail-table">
    <tr><td>กำหนดเวลาไถ่</td><td>ภายในวันที่ ${escapeHtml(data.contractEndDate)}</td></tr>
    <tr><td>จำนวนสินไถ่</td><td>จำนวน ${formatMoney(data.redemptionAmount)} บาท (${escapeHtml(data.redemptionAmountText)})</td></tr>
    <tr><td>ผู้รับชำระสินไถ่</td><td>${escapeHtml(data.buyerName)} ผู้ซื้อฝาก</td></tr>
    <tr><td>สถานที่ดำเนินการ</td><td>${escapeHtml(data.paymentLocation)}</td></tr>
  </table>

  <p class="body-paragraph">จึงขอให้ท่านดำเนินการใช้สิทธิไถ่ภายในกำหนดเวลาดังกล่าว โดยชำระสินไถ่ตามจำนวนที่ระบุข้างต้นแก่ผู้ซื้อฝาก ทั้งนี้ หนังสือฉบับนี้ได้จัดส่งพร้อมสำเนาหนังสือสัญญาขายฝาก และจัดส่งทางไปรษณีย์ลงทะเบียนตอบรับไปยังที่อยู่ของผู้ขายฝากตามที่ปรากฏในสัญญาขายฝาก</p>
  <p class="body-paragraph">จึงเรียนมาเพื่อทราบและดำเนินการภายในกำหนดเวลาไถ่</p>

  <div class="signature">
    <div class="signature-space"></div>
    <div>ลงชื่อ ........................................................ ผู้ซื้อฝาก</div>
    <div>(${escapeHtml(data.buyerName)})</div>
  </div>
</main>
</body>
</html>`;
}

function showNoticePreview(html) {
  const existing = document.getElementById("assetx-notice-preview");
  if (existing?.closePreview) existing.closePreview();

  const previousOverflow = document.body.style.overflow;
  const overlay = document.createElement("div");
  overlay.id = "assetx-notice-preview";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "20000",
    display: "flex",
    flexDirection: "column",
    background: "#050b18",
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    height: "52px",
    flex: "0 0 52px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "0 14px 0 18px",
    background: "#0d1b2e",
    borderBottom: "1px solid #20324d",
    color: "#f0f6ff",
    fontFamily: '"Sarabun", sans-serif',
  });

  const title = document.createElement("strong");
  title.textContent = "ตัวอย่างหนังสือแจ้งกำหนดเวลาไถ่";
  title.style.fontSize = "14px";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.title = "ปิดตัวอย่าง";
  closeButton.setAttribute("aria-label", "ปิดตัวอย่างหนังสือ");
  Object.assign(closeButton.style, {
    width: "34px",
    height: "34px",
    border: "1px solid #475569",
    borderRadius: "6px",
    background: "transparent",
    color: "#e2e8f0",
    fontSize: "24px",
    lineHeight: "1",
    cursor: "pointer",
  });

  const frame = document.createElement("iframe");
  frame.title = "ตัวอย่างหนังสือแจ้งกำหนดเวลาไถ่";
  frame.srcdoc = html;
  Object.assign(frame.style, {
    width: "100%",
    flex: "1 1 auto",
    border: "0",
    background: "#e5e7eb",
  });

  const closePreview = () => {
    document.removeEventListener("keydown", handleKeyDown);
    overlay.remove();
    document.body.style.overflow = previousOverflow;
  };
  const handleKeyDown = (event) => {
    if (event.key === "Escape") closePreview();
  };
  overlay.closePreview = closePreview;
  closeButton.addEventListener("click", closePreview);
  document.addEventListener("keydown", handleKeyDown);

  header.append(title, closeButton);
  overlay.append(header, frame);
  document.body.append(overlay);
  document.body.style.overflow = "hidden";
}

export function printNotice(customer, extraInfo) {
  const missing = getSaleRedemptionNoticeMissingFields(customer, extraInfo);
  if (missing.length > 0) {
    window.alert(`กรุณากด \"+ กรอกข้อมูล\" ในหัวข้อข้อมูลหนังสือแจ้งกำหนดไถ่ แล้วกรอกข้อมูลต่อไปนี้ให้ครบ:\n- ${missing.join("\n- ")}`);
    return { ok: false, missing };
  }

  let html;
  try {
    html = buildSaleRedemptionNoticeHtml(customer, extraInfo);
  } catch (error) {
    window.alert(`ไม่สามารถประกอบร่างหนังสือได้: ${error instanceof Error ? error.message : "ข้อมูลมีรูปแบบไม่ถูกต้อง"}`);
    return { ok: false, missing: [], error };
  }

  try {
    showNoticePreview(html);
  } catch (error) {
    window.alert(`ไม่สามารถเปิดตัวอย่างหนังสือได้: ${error instanceof Error ? error.message : "เบราว์เซอร์ไม่รองรับหน้าตัวอย่าง"}`);
    return { ok: false, missing: [], error };
  }
  return { ok: true, missing: [] };
}

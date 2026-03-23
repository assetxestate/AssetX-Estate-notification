// ============================================================
// AssetX Estate — LINE Auto Notification + Valuation System
// ============================================================

const LINE_TOKEN = 'QXRCBb+4ZwejMcdd/+3Tkn5o1wJBzwRxR2nBswV+gGWqSYXA5cXr93uxzet9cTbZEwlhdsuRj4p06R+IkDKYLChwCA+MFBYjqu23YpbFhdEkiVmLh8pbQslOoSU7D9P6v9Fk+Hmbl5uZfC7ICqIsQgdB04t89/1O/w1cDnyilFU=';
const SPREADSHEET_ID = '1gzLzNATVHVPVcFTnIGfOIMmRFGXzQnTfqa54NHIprKo';
const SHEET_NAME = 'DATA';

// ── คอลัมน์ใน Sheet DATA ────────────────────────────────────
const COL = {
  customer_id:       1,
  name:              2,
  full_label:        3,
  type:              4,
  principal:         7,
  amount:            8,
  freq:              9,
  contract_end_date: 12,
  installment:       13,
  date:              14,
  line_user_id:      16,  // ← เพิ่ม column นี้ใน Sheet
};

// ============================================================
// ฟังก์ชันหลัก — รันทุกวันเวลา 8:00 น.
// ============================================================
function checkAndSendNotifications() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID)
                              .getSheetByName(SHEET_NAME);
  if (!sheet) { Logger.log('❌ ไม่พบ Sheet: ' + SHEET_NAME); return; }

  const data = sheet.getDataRange().getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let sentCount = 0;
  let skipCount = 0;

  // วนทุกแถว (ข้าม header แถวแรก)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[COL.name - 1]) continue; // ข้ามแถวว่าง

    const name           = row[COL.name - 1];
    const type           = row[COL.type - 1];
    const principal      = row[COL.principal - 1] || 0;
    const amount         = row[COL.amount - 1] || 0;
    const freq           = row[COL.freq - 1] || '';
    const installment    = row[COL.installment - 1];
    const dateVal        = row[COL.date - 1];
    const contractEndVal = row[COL.contract_end_date - 1];
    const lineUserId     = row[COL.line_user_id - 1];

    if (!lineUserId || !dateVal) { skipCount++; continue; }

    const dueDate = new Date(dateVal);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDate - today) / 86400000);

    // ── ส่วนที่ 1: แจ้งเตือนชำระดอกเบี้ย ──────────────────
    if (diffDays === 0) {
      const msg = buildDueMsg(name, installment, amount, freq, dueDate);
      sendLine(lineUserId, msg);
      sentCount++;
      Logger.log(`✅ ส่ง (วันนี้) → ${name} งวด ${installment}`);

    } else if (diffDays === 7) {
      const msg = buildEarlyMsg(name, installment, amount, freq, dueDate, 7);
      sendLine(lineUserId, msg);
      sentCount++;
      Logger.log(`✅ ส่ง (7 วัน) → ${name} งวด ${installment}`);
    }

    // ── ส่วนที่ 2: แจ้งเตือนครบกำหนดสัญญา (ขายฝาก) ───────
    if (type === 'ขายฝาก' && contractEndVal) {
      const contractEnd = new Date(contractEndVal);
      contractEnd.setHours(0, 0, 0, 0);
      const contractDiff = Math.round((contractEnd - today) / 86400000);

      if (contractDiff === 150) { // 5 เดือน ≈ 150 วัน
        const msg = buildContractMsg(name, principal, amount, contractEnd);
        sendLine(lineUserId, msg);
        sentCount++;
        Logger.log(`✅ ส่ง (Notice 5 เดือน) → ${name}`);
      }
    }
  }

  Logger.log(`📊 สรุป: ส่งสำเร็จ ${sentCount} | ข้าม ${skipCount} (ไม่มี User ID)`);
}

// ============================================================
// สร้างข้อความ
// ============================================================
function buildDueMsg(name, installment, amount, freq, dueDate) {
  const dateStr = formatThaiDate(dueDate);
  const amtStr  = amount.toLocaleString('th-TH');
  return [
    `📅 ครบกำหนดชำระวันนี้`,
    ``,
    `เรียน คุณ${name}`,
    `วันนี้เป็นวันครบกำหนดชำระดอกเบี้ย`,
    `งวดที่ ${installment} วันที่ ${dateStr}`,
    ``,
    `💰 จำนวน: ${amtStr} บาท`,
    `📌 ความถี่: ${freq}`,
    ``,
    `กรุณาชำระภายในวันนี้`,
    `— AssetX Estate —`
  ].join('\n');
}

function buildEarlyMsg(name, installment, amount, freq, dueDate, days) {
  const dateStr = formatThaiDate(dueDate);
  const amtStr  = amount.toLocaleString('th-TH');
  return [
    `🔔 แจ้งเตือนล่วงหน้า ${days} วัน`,
    ``,
    `เรียน คุณ${name}`,
    `อีก ${days} วัน จะถึงกำหนดชำระดอกเบี้ย`,
    `งวดที่ ${installment} วันที่ ${dateStr}`,
    ``,
    `💰 จำนวน: ${amtStr} บาท`,
    `📌 ความถี่: ${freq}`,
    ``,
    `กรุณาเตรียมชำระให้ตรงเวลา`,
    `— AssetX Estate —`
  ].join('\n');
}

function buildContractMsg(name, principal, amount, contractEnd) {
  const dateStr  = formatThaiDate(contractEnd);
  const prStr    = principal.toLocaleString('th-TH');
  const totalStr = (principal + amount).toLocaleString('th-TH');
  return [
    `📜 แจ้งเตือนครบกำหนดสัญญาขายฝาก`,
    ``,
    `เรียน คุณ${name}`,
    `สัญญาขายฝากของท่านจะครบกำหนด`,
    `ในอีก 5 เดือน วันที่ ${dateStr}`,
    ``,
    `💰 เงินต้น: ${prStr} บาท`,
    `💳 สินไถ่รวม: ${totalStr} บาท`,
    ``,
    `กรุณาเตรียมการไถ่ถอนภายในกำหนด`,
    `หนังสือ Notice ได้จัดส่งทางไปรษณีย์แล้ว`,
    `— AssetX Estate —`
  ].join('\n');
}

// ============================================================
// ส่ง LINE Messaging API
// ============================================================
function sendLine(userId, message) {
  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = JSON.stringify({
    to: userId,
    messages: [{ type: 'text', text: message }]
  });

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + LINE_TOKEN },
    payload: payload,
    muteHttpExceptions: true,
  };

  const res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() !== 200) {
    Logger.log(`❌ LINE Error (${userId}): ${res.getContentText()}`);
  }
}

// ============================================================
// แปลงวันที่เป็นภาษาไทย
// ============================================================
function formatThaiDate(date) {
  const MONTHS = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                  'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const d = new Date(date);
  return `${d.getDate()} ${MONTHS[d.getMonth()+1]} ${d.getFullYear()+543}`;
}

// ============================================================
// ตั้ง Trigger อัตโนมัติ — รันครั้งเดียวเพื่อสร้าง Trigger
// ============================================================
function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('checkAndSendNotifications')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  Logger.log('✅ ตั้ง Trigger สำเร็จ — ระบบจะส่งแจ้งเตือนทุกวัน 8:00 น.');
}

// ============================================================
// ทดสอบส่งข้อความ — รันเพื่อทดสอบก่อน Deploy
// ============================================================
function testSendToMe() {
  const TEST_USER_ID = 'U90a5c8f66cb2c879a48ba36a46b300a3';
  sendLine(TEST_USER_ID, '🧪 ทดสอบระบบแจ้งเตือน AssetX Estate\n\n✅ ระบบทำงานปกติ\nจะส่งแจ้งเตือนอัตโนมัติทุกวัน 8:00 น.');
  Logger.log('✅ ส่งทดสอบแล้ว — เช็ค LINE ได้เลย');
}

// ============================================================
// บันทึกข้อมูลการประเมิน (อัปเดต: รองรับ lat/lng และวงเงินที่ลูกค้าขอ)
// ============================================================
function saveValuation(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("ประเมิน");

  if (!sheet) {
    sheet = ss.insertSheet("ประเมิน");
    const headers = [
      "วันที่บันทึก", "วันที่ประเมิน", "ผู้ประเมิน", "รหัส/ชื่อทรัพย์",
      "ประเภทการประเมิน", "ประเภทอสังหาฯ", "ประเภทย่อย",
      "เลขโฉนด", "หน้าสำรวจ", "เลขที่ดิน",
      "จังหวัด", "อำเภอ/เขต", "ตำบล/แขวง",
      "ไร่", "งาน", "ตร.ว.", "ตร.ว.รวม",
      "ราคาประเมินรัฐ (บ./ตร.ว.)", "ราคาตลาด (บ./ตร.ว.)", "มูลค่าตลาดรวม",
      "ทำเล", "ความกว้างถนน", "หน้ากว้าง", "ระยะห่างถนนใหญ่",
      "ผังเมือง", "สภาพดิน", "Comp (บ./ตร.ว.)", "แหล่ง Comp",
      "Property Score", "LTV Rate (%)", "FSV (80%)", "วงเงินแนะนำ",
      "วงเงินที่ลูกค้าขอ", "LTV ลูกค้า (% ต่อตลาด)",
      "lat", "lng",
      "ปัจจัยเสี่ยง", "หมายเหตุ", "สถานะ"
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground("#1a3a5c").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  const riskLabels = {
    flood: "เสี่ยงน้ำท่วม", hardAccess: "เข้าถึงยาก/ซอยตัน",
    irregularShape: "รูปแปลงผิดปกติ", encumbrance: "มีภาระผูกพัน",
    dispute: "มีข้อพิพาท/ครอบครอง", noUtilities: "ไม่มีสาธารณูปโภค",
    nuisance: "ติดสิ่งรบกวน", incompleteDeed: "โฉนดไม่สมบูรณ์"
  };
  const risks = data.risks || {};
  const riskText = Object.keys(riskLabels)
    .filter(k => risks[k])
    .map(k => riskLabels[k])
    .join(", ") || "ไม่มี";

  // คำนวณ LTV ลูกค้า
  const requestedLoan = parseFloat(data.requestedLoan) || 0;
  const marketValue   = parseFloat(data.marketValue) || 0;
  const reqLtvPct     = marketValue > 0 ? ((requestedLoan / marketValue) * 100).toFixed(2) : 0;

  const row = [
    new Date().toLocaleString("th-TH"),
    data.assessmentDate || "",
    data.assessorName || "",
    data.projectName || "",
    data.assessmentType || "",
    data.propertyType || "",
    data.propertySubtype || "",
    data.titleDeedNo || "",
    data.surveyPage || "",
    data.landNo || "",
    data.province || "",
    data.district || "",
    data.subdistrict || "",
    data.areaRai || 0,
    data.areaNgan || 0,
    data.areaSqw || 0,
    data.totalSqw || 0,
    data.govPrice || 0,
    data.effectiveMarketPrice || 0,
    data.marketValue || 0,
    data.roadType || "",
    data.roadWidth || "",
    data.landFrontage || "",
    data.distanceFromMain || "",
    data.zoneColor || "",
    data.soilCondition || "",
    data.compPrice || "",
    data.compSource || "",
    data.propertyScore || 100,
    data.ltvRate || 50,
    data.fsv || 0,
    data.recommendedLoan || 0,
    requestedLoan,
    reqLtvPct,
    data.lat || "",
    data.lng || "",
    riskText,
    data.locationNote || "",
    "รอดำเนินการ"
  ];

  sheet.appendRow(row);

  const lastRow = sheet.getLastRow();
  const color = lastRow % 2 === 0 ? "#0d1b2e" : "#080f1e";
  sheet.getRange(lastRow, 1, 1, row.length).setBackground(color).setFontColor("#e2e8f0");

  return { success: true, row: lastRow };
}

// ============================================================
// ทดสอบบันทึกข้อมูลการประเมิน
// ============================================================
function testSaveValuation() {
  const result = saveValuation({
    assessmentDate: "2026-03-23",
    assessorName: "จักรพันธ์",
    projectName: "ทดสอบระบบ",
    assessmentType: "ขายฝาก",
    propertyType: "ที่ดิน",
    propertySubtype: "ที่ดินเปล่า (โฉนด)",
    province: "กรุงเทพมหานคร",
    district: "มีนบุรี", subdistrict: "มีนบุรี",
    areaRai: 1, areaNgan: 0, areaSqw: 0, totalSqw: 400,
    govPrice: 50000, effectiveMarketPrice: 75000,
    marketValue: 30000000, propertyScore: 100,
    ltvRate: 50, fsv: 24000000, recommendedLoan: 12000000,
    requestedLoan: 10000000,
    lat: 13.81694, lng: 100.75168,
    risks: {}
  });
  Logger.log(JSON.stringify(result));
}

// ============================================================
// รับ HTTP POST จากเว็บแอป
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    let result = {};

    if (action === "saveValuation") {
      result = saveValuation(body.data);
    } else if (action === "deleteValuation") {
      result = deleteValuation(body.rowIndex);
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// รับ HTTP GET จากเว็บแอป (ดึงประวัติการประเมิน)
// ============================================================
function doGet(e) {
  try {
    const action = e.parameter.action;
    let result = {};

    if (action === "getValuations") {
      result = getValuations();
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// ดึงข้อมูลประวัติการประเมินทั้งหมด
// ============================================================
function getValuations() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("ประเมิน");

  if (!sheet) {
    return { success: true, data: [] };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = data[0];
  const rows = data.slice(1).map((row, i) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    obj['_rowIndex'] = i + 2; // row จริงใน Sheet (1=header, ดังนั้น data เริ่มที่ 2)
    return obj;
  });

  rows.reverse();

  return { success: true, data: rows };
}

// ============================================================
// ลบรายการประเมิน (ลบแถวจาก Sheet)
// ============================================================
function deleteValuation(rowIndex) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("ประเมิน");
  if (!sheet) return { success: false, error: 'ไม่พบ Sheet ประเมิน' };

  const lastRow = sheet.getLastRow();
  if (rowIndex < 2 || rowIndex > lastRow) {
    return { success: false, error: 'rowIndex ไม่ถูกต้อง' };
  }

  sheet.deleteRow(rowIndex);
  return { success: true, deletedRow: rowIndex };
}

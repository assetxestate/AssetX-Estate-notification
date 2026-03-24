// ============================================================
// AssetX Estate — LINE Auto Notification + Valuation System
// ============================================================

const LINE_TOKEN = 'QXRCBb+4ZwejMcdd/+3Tkn5o1wJBzwRxR2nBswV+gGWqSYXA5cXr93uxzet9cTbZEwlhdsuRj4p06R+IkDKYLChwCA+MFBYjqu23YpbFhdEkiVmLh8pbQslOoSU7D9P6v9Fk+Hmbl5uZfC7ICqIsQgdB04t89/1O/w1cDnyilFU=';
const SPREADSHEET_ID = '1gzLzNATVHVPVcFTnIGfOIMmRFGXzQnTfqa54NHIprKo';
const SHEET_NAME = 'DATA';

// LINE User ID ของนายทุน — ใส่ ID จริงตรงนี้
const INVESTOR_LINE_USER_ID = 'INVESTOR_LINE_ID_HERE';

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

      // ── ข้ามสัญญาที่ปิดแล้ว ──────────────────────────────
    if (isContractClosed(String(row[COL.customer_id - 1] || i))) { skipCount++; continue; }

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
      "เลขโฉนด", "ระวาง", "หน้าสำรวจ", "เลขที่ดิน",
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
    data.mapSheet || "",
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

  // ตรวจ headers ก่อน append เสมอ
  ensureValuationHeaders(sheet);

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
    } else if (action === "sendLine") {
      const userId = e.parameter.dest || body.to;
      if (!userId) {
        result = { success: false, error: 'ไม่มี LINE User ID' };
      } else {
        sendLine(userId, body.message || '');
        result = { success: true };
      }
    } else if (action === "savePaymentRecord") {
      result = savePaymentRecord(body.data);
    } else if (action === "deletePaymentRecord") {
      result = deletePaymentRecord(body.customerId, body.installment);
    } else if (action === "updateValuation") {
      result = updateValuation(body.rowIndex, body.data);
    } else if (action === "deleteImgbbImage") {
      result = deleteImgbbImage(body.imageId);
    } else if (action === "closeContract") {
      result = closeContract(body.customerId, body.customerName);
    } else if (action === "reopenContract") {
      result = reopenContract(body.customerId);
    } else if (action === "updateValuationStatus") {
      result = updateValuationStatus(body.rowIndex, body.status);
    } else if (action === "createCustomerFromValuation") {
      result = createCustomerFromValuation(body.data);
    } else if (action === "notifyInvestor") {
      result = notifyInvestorNewValuation(body.valuationData);
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
    } else if (action === "debugValuations") {
      result = debugValuations();
    } else if (action === "getPaymentRecords") {
      result = getPaymentRecords();
    } else if (action === "getCustomers") {
      result = getCustomers();
    } else if (action === "getContractStatuses") {
      result = getContractStatuses();
    } else if (action === "getPendingValuations") {
      result = getPendingValuations();
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
// Debug: ดู headers และ lat/lng จริงๆ ใน Sheet
// ============================================================
function debugValuations() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("ประเมิน");
  if (!sheet) return { error: 'ไม่พบ Sheet ประเมิน' };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const latIdx = headers.indexOf('lat');
  const lngIdx = headers.indexOf('lng');

  const rows = data.slice(1, 4).map(function(row, i) {
    return {
      rowNum: i + 2,
      latIdx: latIdx,
      lngIdx: lngIdx,
      latValue: latIdx >= 0 ? row[latIdx] : 'NO LAT COLUMN',
      lngValue: lngIdx >= 0 ? row[lngIdx] : 'NO LNG COLUMN',
      colAI: row[34],
      colAJ: row[35],
      colAK: row[36],
    };
  });

  return {
    totalHeaders: headers.length,
    latColumnIndex: latIdx,
    lngColumnIndex: lngIdx,
    headers_AI_to_AM: headers.slice(34, 39),
    sampleRows: rows,
  };
}

// ============================================================
// แก้ไข header row ของ Sheet ประเมิน ให้ตรงกับโครงสร้างปัจจุบัน
// รันครั้งเดียวเพื่อ fix Sheet เก่า
// ============================================================
function fixValuationHeaders() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("ประเมิน");
  if (!sheet) { Logger.log('ไม่พบ Sheet ประเมิน'); return; }

  const CORRECT_HEADERS = [
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

  // เขียน header ทับแถวที่ 1
  sheet.getRange(1, 1, 1, CORRECT_HEADERS.length).setValues([CORRECT_HEADERS]);
  sheet.getRange(1, 1, 1, CORRECT_HEADERS.length)
    .setBackground("#1a3a5c").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(1);

  // ล้าง header column ส่วนเกิน (ที่ถูก ensureValuationHeaders เพิ่มผิดที่)
  const lastCol = sheet.getLastColumn();
  if (lastCol > CORRECT_HEADERS.length) {
    const extraCols = lastCol - CORRECT_HEADERS.length;
    sheet.getRange(1, CORRECT_HEADERS.length + 1, 1, extraCols).clearContent();
    sheet.getRange(1, CORRECT_HEADERS.length + 1, 1, extraCols).setBackground(null).setFontColor(null).setFontWeight(null);
    Logger.log('ล้าง ' + extraCols + ' extra columns (col ' + (CORRECT_HEADERS.length + 1) + ' ถึง ' + lastCol + ')');
  }

  Logger.log('✅ แก้ไข headers เสร็จแล้ว — ' + CORRECT_HEADERS.length + ' columns');
  Logger.log('lat อยู่ที่ column 36 (AJ), lng อยู่ที่ column 37 (AK)');
}

// ============================================================
// ตรวจและเพิ่ม headers ที่ขาดใน Sheet ประเมิน
// ============================================================
function ensureValuationHeaders(sheet) {
  const REQUIRED_HEADERS = [
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

  const lastCol = sheet.getLastColumn();
  const currentHeaders = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    : [];

  var added = 0;
  REQUIRED_HEADERS.forEach(function(h) {
    if (currentHeaders.indexOf(h) === -1) {
      const newCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, newCol).setValue(h);
      sheet.getRange(1, newCol).setBackground("#1a3a5c").setFontColor("#ffffff").setFontWeight("bold");
      added++;
      Logger.log('เพิ่ม header: ' + h + ' ที่ column ' + newCol);
    }
  });

  if (added > 0) Logger.log('ensureValuationHeaders: เพิ่ม ' + added + ' headers');
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

  // ตรวจและเพิ่ม headers ที่ขาดไป (เช่น lat/lng)
  ensureValuationHeaders(sheet);

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = data[0].map(function(h) { return String(h).trim(); });
  const rows = data.slice(1).map(function(row, i) {
    const obj = {};
    headers.forEach(function(h, idx) {
      obj[h] = row[idx] !== undefined ? row[idx] : '';
    });
    obj['_rowIndex'] = i + 2;
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

// ============================================================
// ดึงข้อมูลลูกค้าจาก Sheet DATA
// ============================================================
function getCustomers() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) return { success: false, error: 'ไม่พบ Sheet DATA' };

  const data = sheet.getDataRange().getValues();
  const customerMap = {};

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[COL.name - 1]) continue;

    var id = String(row[COL.customer_id - 1] || i);

    if (!customerMap[id]) {
      var contractRaw = row[COL.contract_end_date - 1];
      var contractStr = '';
      if (contractRaw) {
        try { contractStr = Utilities.formatDate(new Date(contractRaw), 'Asia/Bangkok', 'yyyy-MM-dd'); } catch(e) {}
      }
      customerMap[id] = {
        id: id,
        name: String(row[COL.name - 1] || ''),
        fullLabel: String(row[COL.full_label - 1] || ''),
        type: String(row[COL.type - 1] || ''),
        principal: Number(row[COL.principal - 1]) || 0,
        amount: Number(row[COL.amount - 1]) || 0,
        freq: String(row[COL.freq - 1] || ''),
        contractEndDate: contractStr,
        lineUserId: String(row[COL.line_user_id - 1] || ''),
        payments: []
      };
    }

    var installNum = row[COL.installment - 1];
    var dateRaw = row[COL.date - 1];
    if (installNum && dateRaw) {
      var dateStr = '';
      try { dateStr = Utilities.formatDate(new Date(dateRaw), 'Asia/Bangkok', 'yyyy-MM-dd'); } catch(e) {}
      customerMap[id].payments.push({ installment: Number(installNum), dateStr: dateStr });
    }
  }

  return { success: true, data: Object.values(customerMap) };
}

// ============================================================
// ลบรูปภาพจาก ImgBB (ผ่าน server เพื่อหลีก CORS)
// ============================================================
function deleteImgbbImage(imageId) {
  const IMGBB_API_KEY = 'c83de7744f238eb8f1d0e87efb8bc639';
  if (!imageId) return { success: false, error: 'ไม่มี image ID' };
  try {
    const res = UrlFetchApp.fetch(
      'https://api.imgbb.com/1/image/' + imageId + '?api_key=' + IMGBB_API_KEY,
      { method: 'DELETE', muteHttpExceptions: true }
    );
    const code = res.getResponseCode();
    Logger.log('ImgBB delete ' + imageId + ' → ' + code + ' ' + res.getContentText());
    return { success: code === 200 };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// อัปเดตรายการประเมิน
// ============================================================
function updateValuation(rowIndex, data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("ประเมิน");
  if (!sheet) return { success: false, error: 'ไม่พบ Sheet ประเมิน' };
  const lastRow = sheet.getLastRow();
  if (rowIndex < 2 || rowIndex > lastRow) return { success: false, error: 'rowIndex ไม่ถูกต้อง' };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Object.keys(data).forEach(function(key) {
    const colIdx = headers.indexOf(key);
    if (colIdx !== -1) sheet.getRange(rowIndex, colIdx + 1).setValue(data[key]);
  });
  return { success: true };
}

// ============================================================
// จัดการสถานะสัญญา (ปิดแล้ว / เปิดใหม่)
// ============================================================
function getOrCreateStatusSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("สถานะสัญญา");
  if (!sheet) {
    sheet = ss.insertSheet("สถานะสัญญา");
    const h = ["customerId", "customerName", "status", "closedAt"];
    sheet.getRange(1, 1, 1, h.length).setValues([h]);
    sheet.getRange(1, 1, 1, h.length).setBackground("#1a3a5c").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getContractStatuses() {
  const sheet = getOrCreateStatusSheet();
  const rows = sheet.getDataRange().getValues();
  const result = {};
  for (var i = 1; i < rows.length; i++) {
    const id = String(rows[i][0]);
    if (id) result[id] = { customerName: String(rows[i][1]), status: String(rows[i][2]), closedAt: String(rows[i][3]) };
  }
  return { success: true, data: result };
}

function isContractClosed(customerId) {
  const sheet = getOrCreateStatusSheet();
  const rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(customerId) && rows[i][2] === 'ปิดแล้ว') return true;
  }
  return false;
}

function closeContract(customerId, customerName) {
  const sheet = getOrCreateStatusSheet();
  const rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(customerId)) {
      sheet.getRange(i + 1, 3).setValue('ปิดแล้ว');
      sheet.getRange(i + 1, 4).setValue(new Date().toLocaleString('th-TH'));
      return { success: true };
    }
  }
  sheet.appendRow([String(customerId), customerName || '', 'ปิดแล้ว', new Date().toLocaleString('th-TH')]);
  return { success: true };
}

function reopenContract(customerId) {
  const sheet = getOrCreateStatusSheet();
  const rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(customerId)) {
      sheet.getRange(i + 1, 3).setValue('');
      sheet.getRange(i + 1, 4).setValue('');
      return { success: true };
    }
  }
  return { success: true };
}

// ============================================================
// บันทึกการชำระเงิน (sync ข้ามอุปกรณ์)
// ============================================================
function savePaymentRecord(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("การชำระเงิน");
  if (!sheet) {
    sheet = ss.insertSheet("การชำระเงิน");
    const headers = ["customerId", "installment", "paidDate", "amount", "note", "slipUrl", "slipId", "slipDeleteUrl", "savedAt"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground("#1a3a5c").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  const rows = sheet.getDataRange().getValues();
  const newRow = [
    String(data.customerId || ""),
    String(data.installment || ""),
    data.paidDate || "",
    data.amount || 0,
    data.note || "",
    data.slipUrl || "",
    data.slipId || "",
    data.slipDeleteUrl || "",
    data.savedAt || new Date().toISOString()
  ];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.customerId) && String(rows[i][1]) === String(data.installment)) {
      sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
      return { success: true };
    }
  }
  sheet.appendRow(newRow);
  return { success: true };
}

// ============================================================
// ดึงข้อมูลการชำระเงินทั้งหมด
// ============================================================
function getPaymentRecords() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("การชำระเงิน");
  if (!sheet) return { success: true, data: {} };
  const rows = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    const [customerId, installment, paidDate, amount, note, slipUrl, slipId, slipDeleteUrl, savedAt] = rows[i];
    if (!customerId) continue;
    const cid = String(customerId);
    const inst = String(installment);
    if (!result[cid]) result[cid] = {};
    result[cid][inst] = { paidDate: String(paidDate || ""), amount: amount || 0, note: String(note || ""), slipUrl: String(slipUrl || ""), slipId: String(slipId || ""), slipDeleteUrl: String(slipDeleteUrl || ""), savedAt: String(savedAt || "") };
  }
  return { success: true, data: result };
}

// ============================================================
// ลบรายการชำระเงิน
// ============================================================
function deletePaymentRecord(customerId, installment) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("การชำระเงิน");
  if (!sheet) return { success: false, error: 'ไม่พบ Sheet' };
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(customerId) && String(rows[i][1]) === String(installment)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'ไม่พบรายการ' };
}

// ============================================================
// ระบบนายทุน: อัพเดทสถานะการประเมิน
// ============================================================
function updateValuationStatus(rowIndex, status) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("ประเมิน");
  if (!sheet) return { success: false, error: 'ไม่พบ Sheet ประเมิน' };
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('สถานะ') + 1;
  if (statusCol === 0) return { success: false, error: 'ไม่พบ column สถานะ' };
  sheet.getRange(rowIndex, statusCol).setValue(status);
  return { success: true };
}

// ============================================================
// ระบบนายทุน: ดึงรายการประเมินทั้งหมด (พร้อม rowIndex)
// ============================================================
function getPendingValuations() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("ประเมิน");
  if (!sheet) return { success: false, data: [] };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, j) => { row[h] = data[i][j]; });
    row['_rowIndex'] = i + 1;
    rows.push(row);
  }
  return { success: true, data: rows };
}

// ============================================================
// ระบบนายทุน: สร้างลูกค้าใหม่จากข้อมูลการประเมิน
// ============================================================
function createCustomerFromValuation(d) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { success: false, error: 'ไม่พบ Sheet DATA' };

  // สร้าง customer_id อัตโนมัติ
  const customerId = 'CID' + Date.now();
  // คำนวณวันสิ้นสุดสัญญา
  const startDate = new Date(d.contractStartDate);
  const endDate = new Date(startDate);
  if (d.freq === 'ราย 2 สัปดาห์') {
    endDate.setDate(endDate.getDate() + (d.installmentCount * 14));
  } else {
    endDate.setMonth(endDate.getMonth() + parseInt(d.installmentCount));
  }
  const endDateStr = endDate.toISOString().split('T')[0];

  // สร้าง location string
  const location = [d.subdistrict ? 'ต.' + d.subdistrict : '', d.district ? 'อ.' + d.district : '', d.province || ''].filter(Boolean).join(' ');
  // สร้าง full_label
  const typeLabel = d.contractType === 'ขายฝาก' ? 'ขายฝาก' : 'จำนอง';
  const fullLabel = typeLabel + ' คุณ' + d.customerName + ' (' + (d.province || '') + ')';
  // คำนวณ amount (ดอกเบี้ยต่องวด)
  const amount = Math.round((parseFloat(d.principal) * parseFloat(d.interestRate)) / 100);
  // color/icon ตาม type
  const color = d.contractType === 'ขายฝาก' ? '#F97316' : '#3B82F6';
  const icon = d.contractType === 'ขายฝาก' ? '🏡' : '🏦';

  // สร้าง installment string (วันที่ทุกงวด)
  const installments = [];
  const payDate = new Date(startDate);
  for (let i = 0; i < parseInt(d.installmentCount); i++) {
    if (d.freq === 'ราย 2 สัปดาห์') {
      payDate.setDate(payDate.getDate() + (i === 0 ? 0 : 14));
    } else {
      if (i > 0) payDate.setMonth(payDate.getMonth() + 1);
      payDate.setDate(parseInt(d.payDay));
    }
    installments.push(payDate.toISOString().split('T')[0]);
  }

  // เพิ่มแถวใน Sheet DATA ตาม column order
  const row = [
    customerId,           // customer_id
    d.customerName,       // name
    fullLabel,            // full_label
    d.contractType,       // type
    color,                // color
    icon,                 // icon
    parseFloat(d.principal),  // principal
    amount,               // amount
    d.freq,               // freq
    location,             // location
    d.propertyType,       // property_type
    endDateStr,           // contract_end_date
    installments.join(','),   // installment
    parseInt(d.payDay),   // date
    d.titleDeedNo || '',  // deeds
    d.lineUserId || '',   // line_user_id
  ];
  sheet.appendRow(row);

  // อัพเดทสถานะใน Sheet ประเมิน
  if (d.valuationRowIndex) {
    updateValuationStatus(d.valuationRowIndex, 'สร้างสัญญาแล้ว');
  }

  return { success: true, customerId: customerId };
}

// ============================================================
// ระบบนายทุน: ส่ง LINE แจ้งนายทุนเมื่อมีการประเมินใหม่
// ============================================================
function notifyInvestorNewValuation(v) {
  if (!INVESTOR_LINE_USER_ID || INVESTOR_LINE_USER_ID === 'INVESTOR_LINE_ID_HERE') {
    return { success: false, error: 'ยังไม่ได้ตั้งค่า INVESTOR_LINE_USER_ID' };
  }
  const loc = [v['ตำบล/แขวง'] ? 'ต.' + v['ตำบล/แขวง'] : '', v['อำเภอ/เขต'] ? 'อ.' + v['อำเภอ/เขต'] : '', v['จังหวัด'] || ''].filter(Boolean).join(' ');
  const fmtNum = (n) => n ? Number(n).toLocaleString('th-TH') : '—';
  const msg = [
    '🏠 มีการประเมินทรัพย์ใหม่',
    '─────────────────',
    '📋 ' + (v['รหัส/ชื่อทรัพย์'] || '—'),
    '📌 ประเภท: ' + (v['ประเภทการประเมิน'] || '—') + ' • ' + (v['ประเภทย่อย'] || ''),
    '📍 ที่ตั้ง: ' + (loc || v['จังหวัด'] || '—'),
    '💰 มูลค่าตลาด: ฿' + fmtNum(v['มูลค่าตลาดรวม']),
    '🏦 วงเงินที่ขอ: ฿' + fmtNum(v['วงเงินที่ลูกค้าขอ']),
    '✅ วงเงินแนะนำ: ฿' + fmtNum(v['วงเงินแนะนำ']),
    '👤 ผู้ประเมิน: ' + (v['ผู้ประเมิน'] || '—'),
    '─────────────────',
    '⏳ รอการตัดสินใจจากท่าน',
    'AssetX Estate Co., Ltd. 🏠'
  ].join('\n');
  sendLine(INVESTOR_LINE_USER_ID, msg);
  return { success: true };
}

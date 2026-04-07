// ============================================================
// AssetX Estate — LINE Auto Notification + Valuation System
// ============================================================

// ============================================================
// [รันครั้งเดียว] Backfill สิทธิชัย → DEEDS + CONTRACT_NOTICE
// วิธีใช้: เปิด GAS Editor → เลือกฟังก์ชันนี้ → กด Run
// ============================================================
function runBackfillSithichai() {
  const result = backfillCustomerToSheets('CID1774859320575');
  Logger.log(JSON.stringify(result));
  SpreadsheetApp.getActiveSpreadsheet().toast(
    result.success ? '✅ ' + result.message : '❌ ' + result.error,
    'Backfill สิทธิชัย', 5
  );
}

const LINE_TOKEN = 'QXRCBb+4ZwejMcdd/+3Tkn5o1wJBzwRxR2nBswV+gGWqSYXA5cXr93uxzet9cTbZEwlhdsuRj4p06R+IkDKYLChwCA+MFBYjqu23YpbFhdEkiVmLh8pbQslOoSU7D9P6v9Fk+Hmbl5uZfC7ICqIsQgdB04t89/1O/w1cDnyilFU=';
const SPREADSHEET_ID = '1gzLzNATVHVPVcFTnIGfOIMmRFGXzQnTfqa54NHIprKo';
const SHEET_NAME = 'DATA';

// LINE User ID ของนายทุน — ใส่ ID จริงตรงนี้
const INVESTOR_LINE_USER_ID = 'U90a5c8f66cb2c879a48ba36a46b300a3';

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

  // ตรวจและเพิ่ม headers ที่ขาดก่อนเสมอ
  ensureValuationHeaders(sheet);

  // เขียนข้อมูลตาม header จริงใน Sheet (ป้องกัน column misalignment)
  const sheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const dataMap = {
    'วันที่บันทึก':               new Date().toLocaleString("th-TH"),
    'วันที่ประเมิน':              data.assessmentDate || "",
    'ผู้ประเมิน':                 data.assessorName || "",
    'รหัส/ชื่อทรัพย์':           data.projectName || "",
    'ประเภทการประเมิน':           data.assessmentType || "",
    'ประเภทอสังหาฯ':              data.propertyType || "",
    'ประเภทย่อย':                 data.propertySubtype || "",
    'เลขโฉนด':                   data.titleDeedNo || "",
    'ระวาง':                      data.mapSheet || "",
    'หน้าสำรวจ':                  data.surveyPage || "",
    'เลขที่ดิน':                  data.landNo || "",
    'จังหวัด':                   data.province || "",
    'อำเภอ/เขต':                 data.district || "",
    'ตำบล/แขวง':                 data.subdistrict || "",
    'ไร่':                        data.areaRai || 0,
    'งาน':                        data.areaNgan || 0,
    'ตร.ว.':                      data.areaSqw || 0,
    'ตร.ว.รวม':                  data.totalSqw || 0,
    'ราคาประเมินรัฐ (บ./ตร.ว.)': data.govPrice || 0,
    'ราคาตลาด (บ./ตร.ว.)':       data.effectiveMarketPrice || 0,
    'มูลค่าตลาดรวม':              data.marketValue || 0,
    'ทำเล':                       data.roadType || "",
    'ความกว้างถนน':               data.roadWidth || "",
    'หน้ากว้าง':                  data.landFrontage || "",
    'ระยะห่างถนนใหญ่':           data.distanceFromMain || "",
    'ผังเมือง':                   data.zoneColor || "",
    'สภาพดิน':                   data.soilCondition || "",
    'Comp (บ./ตร.ว.)':            data.compPrice || "",
    'แหล่ง Comp':                 data.compSource || "",
    'Property Score':              data.propertyScore || 100,
    'LTV Rate (%)':                data.ltvRate || 50,
    'FSV (80%)':                   data.fsv || 0,
    'วงเงินแนะนำ':                data.recommendedLoan || 0,
    'วงเงินที่ลูกค้าขอ':          requestedLoan,
    'LTV ลูกค้า (% ต่อตลาด)':    reqLtvPct,
    'lat':                         data.lat != null && data.lat !== "" ? data.lat : "",
    'lng':                         data.lng != null && data.lng !== "" ? data.lng : "",
    'ปัจจัยเสี่ยง':               riskText,
    'หมายเหตุ':                   data.locationNote || "",
    'สถานะ':                      "รอดำเนินการ",
  };

  const newRow = sheetHeaders.map(function(h) {
    return dataMap.hasOwnProperty(h) ? dataMap[h] : "";
  });

  sheet.appendRow(newRow);

  const lastRow = sheet.getLastRow();
  const color = lastRow % 2 === 0 ? "#0d1b2e" : "#080f1e";
  sheet.getRange(lastRow, 1, 1, newRow.length).setBackground(color).setFontColor("#e2e8f0");

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
    // LINE Webhook มี destination + events array
    if (body.destination !== undefined && Array.isArray(body.events)) {
      return handleLineWebhook(body);
    }
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
    } else if (action === "cancelCustomer") {
      result = cancelCustomer(body.customerId, body.customerName);
    } else if (action === "updateValuationStatus") {
      result = updateValuationStatus(body.rowIndex, body.status);
    } else if (action === "createCustomerFromValuation") {
      result = createCustomerFromValuation(body.data);
    } else if (action === "updateCustomer") {
      result = updateCustomer(body.customerId, body.data);
    } else if (action === "notifyInvestor") {
      result = notifyInvestorNewValuation(body.valuationData);
    } else if (action === "syncCustomerToSheets") {
      result = backfillCustomerToSheets(body.customerId);
    } else if (action === "generateRegistrationToken") {
      result = generateRegistrationToken(body.customerId, body.customerName);
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
    } else if (action === "generateRegistrationToken") {
      result = generateRegistrationToken(e.parameter.customerId, e.parameter.customerName);
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
// ซ่อมข้อมูล lat/lng ที่ misaligned ใน Sheet ประเมิน
// รันครั้งเดียวใน Apps Script Editor → เลือกฟังก์ชันนี้แล้วกด Run
// ============================================================
function repairValuationData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("ประเมิน");
  if (!sheet) { Logger.log('❌ ไม่พบ Sheet ประเมิน'); return; }

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);

  const col = function(name) { return headers.indexOf(name) + 1; }; // 1-based
  const latCol  = col('lat');
  const lngCol  = col('lng');
  const riskCol = col('ปัจจัยเสี่ยง');
  const noteCol = col('หมายเหตุ');
  const statCol = col('สถานะ');

  if (!latCol || !lngCol) { Logger.log('❌ ไม่พบ column lat/lng — รัน fixValuationHeaders() ก่อน'); return; }

  Logger.log('📌 lat=col' + latCol + '  lng=col' + lngCol + '  ปัจจัยเสี่ยง=col' + riskCol);

  const lastRow = sheet.getLastRow();
  const readCols = Math.max(lastCol, statCol + 1);
  const allData  = sheet.getRange(1, 1, lastRow, readCols).getValues();
  let fixed = 0, skipped = 0;

  for (var i = 1; i < allData.length; i++) {
    var row     = allData[i];
    var latVal  = row[latCol  - 1];
    var lngVal  = row[lngCol  - 1];
    var riskVal = row[riskCol - 1];
    var noteVal = row[noteCol - 1];
    var statVal = row[statCol - 1];
    var extraVal = statCol < readCols ? row[statCol] : ''; // column ถัดจาก สถานะ

    var latNum  = parseFloat(latVal);
    var lngNum  = parseFloat(lngVal);
    var riskNum = parseFloat(riskVal);

    // ตรวจ: lat มีค่า 20–100 (= LTV%) + lng มีค่า 5–21 (= Thai lat) + ปัจจัยเสี่ยง มีค่า 95–108 (= Thai lng)
    var isMisaligned =
      !isNaN(latNum)  && latNum  >  20 && latNum  <= 100 &&
      !isNaN(lngNum)  && lngNum  >=  5 && lngNum  <=  21 &&
      !isNaN(riskNum) && riskNum >= 95 && riskNum <= 108;

    if (isMisaligned) {
      var rowNum = i + 1;
      sheet.getRange(rowNum, latCol ).setValue(lngVal);                   // lat จริงอยู่ใน lng column
      sheet.getRange(rowNum, lngCol ).setValue(riskVal);                  // lng จริงอยู่ใน ปัจจัยเสี่ยง column
      sheet.getRange(rowNum, riskCol).setValue(noteVal);                  // ปัจจัยเสี่ยง จริงอยู่ใน หมายเหตุ column
      sheet.getRange(rowNum, noteCol).setValue(statVal);                  // หมายเหตุ จริงอยู่ใน สถานะ column
      sheet.getRange(rowNum, statCol).setValue(extraVal || 'รอดำเนินการ'); // สถานะ จริงอยู่ใน column ถัดไป
      fixed++;
      Logger.log('✅ แถว ' + rowNum + ': lat=' + lngVal + ', lng=' + riskVal);
    } else if (latVal !== '' && !isNaN(latNum) && (latNum < 5 || latNum > 21)) {
      // lat มีค่า แต่ไม่ใช่พิกัดไทย และไม่ตรงเงื่อนไข misaligned → log เตือน
      Logger.log('⚠️  แถว ' + (i+1) + ': lat=' + latVal + ' อาจผิดปกติ (ไม่แก้)');
      skipped++;
    }
  }

  Logger.log('');
  Logger.log('════════════════════════════════');
  Logger.log('✅ แก้ไขสำเร็จ  : ' + fixed   + ' แถว');
  Logger.log('⚠️  ข้ามไป      : ' + skipped + ' แถว (ค่าผิดปกติแต่ไม่ชัดเจน)');
  Logger.log('════════════════════════════════');
}

// ============================================================
// ตรวจและเพิ่ม headers ที่ขาดใน Sheet ประเมิน
// ============================================================
function ensureValuationHeaders(sheet) {
  const REQUIRED_HEADERS = [
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
    "ปัจจัยเสี่ยง", "หมายเหตุ", "สถานะ", "ชื่อลูกค้า"
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
      // อ่านข้อมูลโฉนด (col 15) — อาจเป็น JSON array string หรือข้อความธรรมดา
      var deedsRaw = String(row[14] || ''); // col 15 (index 14)
      var deedsValue = deedsRaw;
      if (deedsRaw && deedsRaw.charAt(0) !== '[') {
        // ข้อความธรรมดา (เลขโฉนดเก่า) → แปลงเป็น array เบื้องต้น
        deedsValue = JSON.stringify([{ no: deedsRaw }]);
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
        location: String(row[9] || ''),  // col 10: location (ต.xxx อ.xxx จ.xxx)
        deeds: deedsValue,               // col 15: deeds JSON
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
// แก้ไขข้อมูลลูกค้าใน Sheet DATA (ทุกแถวของ customer_id นั้น)
// ============================================================
function updateCustomer(customerId, d) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) return { success: false, error: 'ไม่พบ Sheet DATA' };
  if (!customerId) return { success: false, error: 'ไม่มี customerId' };

  const data = sheet.getDataRange().getValues();
  var updatedRows = 0;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL.customer_id - 1]) !== String(customerId)) continue;

    // อัปเดตคอลัมน์ที่แก้ไขได้
    if (d.name != null)            sheet.getRange(i + 1, COL.name).setValue(d.name);
    if (d.type != null) {
      sheet.getRange(i + 1, COL.type).setValue(d.type);
      // สร้าง full_label ใหม่
      var loc = String(data[i][9] || ''); // col 10: location
      var newLabel = d.type + ' คุณ' + (d.name || data[i][COL.name - 1]) + (loc ? ' (' + loc + ')' : '');
      sheet.getRange(i + 1, COL.full_label).setValue(newLabel);
    }
    if (d.principal != null)       sheet.getRange(i + 1, COL.principal).setValue(parseFloat(d.principal) || 0);
    if (d.amount != null)          sheet.getRange(i + 1, COL.amount).setValue(parseFloat(d.amount) || 0);
    if (d.freq != null)            sheet.getRange(i + 1, COL.freq).setValue(d.freq);
    if (d.contractEndDate != null) sheet.getRange(i + 1, COL.contract_end_date).setValue(d.contractEndDate);
    if (d.lineUserId != null)      sheet.getRange(i + 1, COL.line_user_id).setValue(d.lineUserId);
    updatedRows++;
  }

  if (updatedRows === 0) return { success: false, error: 'ไม่พบลูกค้า ID: ' + customerId };
  return { success: true, updatedRows: updatedRows };
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

function cancelCustomer(customerId, customerName) {
  const sheet = getOrCreateStatusSheet();
  const rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(customerId)) {
      sheet.getRange(i + 1, 3).setValue('ยกเลิก');
      sheet.getRange(i + 1, 4).setValue(new Date().toLocaleString('th-TH'));
      return { success: true };
    }
  }
  sheet.appendRow([String(customerId), customerName || '', 'ยกเลิก', new Date().toLocaleString('th-TH')]);
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

  // สร้าง deeds JSON จากข้อมูลโฉนดในฟอร์มประเมิน
  const areaRai  = parseInt(d.areaRai)  || 0;
  const areaNgan = parseInt(d.areaNgan) || 0;
  const areaSqw  = parseFloat(d.areaSqw) || 0;
  const deedObj = {
    no:        d.titleDeedNo  || '',
    area:      areaRai + '-' + areaNgan + '-' + areaSqw + ' ไร่',
    tambon:    d.subdistrict  || '',
    amphoe:    d.district     || '',
    province:  d.province     || '',
    surveyPage: d.surveyPage  || '',
    landNo:    d.landNo       || '',
    mapRef:    d.mapSheet     || '',
  };
  const deedsJson = JSON.stringify([deedObj]);

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
    installments.push(Utilities.formatDate(payDate, 'Asia/Bangkok', 'yyyy-MM-dd'));
  }

  // เพิ่มแถวใน Sheet DATA — 1 แถวต่อ 1 งวด (เหมือนโครงสร้างเดิม)
  const baseInfo = [
    customerId,               // col 1: customer_id
    d.customerName,           // col 2: name
    fullLabel,                // col 3: full_label
    d.contractType,           // col 4: type
    color,                    // col 5: color
    icon,                     // col 6: icon
    parseFloat(d.principal),  // col 7: principal
    amount,                   // col 8: amount
    d.freq,                   // col 9: freq
    location,                 // col 10: location
    d.propertyType,           // col 11: property_type
    endDateStr,               // col 12: contract_end_date
  ];

  installments.forEach(function(dateStr, idx) {
    const row = baseInfo.slice();
    row.push(idx + 1);        // col 13: installment number (1, 2, 3, ...)
    row.push(dateStr);        // col 14: actual date of this installment
    row.push(deedsJson);      // col 15: deeds (JSON array)
    row.push(d.lineUserId || ''); // col 16: line_user_id
    sheet.appendRow(row);
  });

  // บันทึกงวดที่หักล่วงหน้าเป็น "ชำระแล้ว" อัตโนมัติ
  const advanceCount = parseInt(d.advanceInstallments) || 0;
  if (advanceCount > 0) {
    const paymentSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('การชำระเงิน');
    if (paymentSheet) {
      const paidDate = d.contractStartDate || new Date().toISOString().split('T')[0];
      const savedAt = new Date().toISOString();
      for (let i = 1; i <= advanceCount; i++) {
        paymentSheet.appendRow([
          customerId,          // customer_id
          i,                   // installment number
          paidDate,            // paidDate (วันเซ็นสัญญา)
          amount,              // amount (ดอกเบี้ย/งวด)
          'หักดอกเบี้ยล่วงหน้า', // note
          '',                  // slipUrl
          '',                  // slipId
          '',                  // slipDeleteUrl
          savedAt,             // savedAt
        ]);
      }
    }
  }

  // อัพเดทสถานะและชื่อลูกค้าใน Sheet ประเมิน
  if (d.valuationRowIndex) {
    updateValuationStatus(d.valuationRowIndex, 'สร้างสัญญาแล้ว');
    // บันทึกชื่อลูกค้าและ customer_id ลงในแถวประเมิน เพื่อให้แผนที่ match ได้
    const valSheet = ss.getSheetByName("ประเมิน");
    if (valSheet) {
      const headers = valSheet.getRange(1, 1, 1, valSheet.getLastColumn()).getValues()[0].map(String);
      var nameColIdx = headers.indexOf('ชื่อลูกค้า');
      if (nameColIdx === -1) {
        nameColIdx = valSheet.getLastColumn();
        valSheet.getRange(1, nameColIdx + 1).setValue('ชื่อลูกค้า');
        nameColIdx = nameColIdx; // 0-based
      }
      valSheet.getRange(d.valuationRowIndex, nameColIdx + 1).setValue(d.customerName);
    }
  }

  // เพิ่มข้อมูลลง DEEDS และ CONTRACT_NOTICE อัตโนมัติ
  const customerForSheets = {
    id: customerId,
    name: d.customerName,
    fullLabel: fullLabel,
    type: d.contractType,
    propertyType: d.propertyType || '',
    principal: parseFloat(d.principal),
    amount: amount,
    freq: d.freq,
    location: location,
    contractEndDate: endDateStr,
  };
  appendToDeeds(ss, customerForSheets, [deedObj]);
  appendToContractNotice(ss, customerForSheets, [deedObj]);

  return { success: true, customerId: customerId };
}

// ============================================================
// เขียนข้อมูลโฉนดลง Sheet DEEDS
// ============================================================
function appendToDeeds(ss, customer, deedsArray) {
  try {
    var sheet = ss.getSheetByName('DEEDS');
    if (!sheet) {
      sheet = ss.insertSheet('DEEDS');
      sheet.appendRow(['📄  รายละเอียดโฉนดที่ดิน — AssetX Estate']);
      sheet.appendRow(['รหัสลูกค้า','ชื่อลูกค้า','สัญญา','ประเภททรัพย์','โฉนดเลขที่','เนื้อที่','ตำบล/แขวง','อำเภอ/เขต','จังหวัด','หน้าสำรวจ','เลขที่ดิน','ระวาง','หมายเหตุ']);
    }
    var lastRow = sheet.getLastRow();
    // Section header
    var headerText = '  ID ' + customer.id + '  ·  ' + customer.name + '  ·  ' + customer.fullLabel + '  ·  ' + (customer.propertyType || '—');
    sheet.appendRow([headerText,'','','','','','','','','','','','']);
    sheet.getRange(lastRow + 1, 1, 1, 13).merge().setBackground('#1a3a5c').setFontColor('#ffffff').setFontWeight('bold');
    // Deed rows
    if (!deedsArray || deedsArray.length === 0) {
      sheet.appendRow(['  — ยังไม่มีข้อมูลโฉนด กรุณากรอกข้อมูลด้านล่าง','','','','','','','','','','','','']);
      sheet.getRange(lastRow + 2, 1, 1, 13).merge().setFontColor('#94a3b8').setFontStyle('italic');
    } else {
      deedsArray.forEach(function(deed) {
        sheet.appendRow([
          customer.id,
          customer.name,
          customer.fullLabel,
          customer.propertyType || '',
          deed.no || '',
          deed.area || '',
          deed.tambon || '',
          deed.amphoe || '',
          deed.province || '',
          deed.surveyPage || '',
          deed.landNo || '',
          deed.mapRef || '',
          ''
        ]);
      });
    }
    // เว้นบรรทัด
    sheet.appendRow(['']);
  } catch(e) {
    Logger.log('appendToDeeds error: ' + e.message);
  }
}

// ============================================================
// เขียนข้อมูลลง Sheet CONTRACT_NOTICE
// ============================================================
function appendToContractNotice(ss, customer, deedsArray) {
  try {
    var sheet = ss.getSheetByName('CONTRACT_NOTICE');
    if (!sheet) {
      sheet = ss.insertSheet('CONTRACT_NOTICE');
      sheet.appendRow(['📜  หนังสือแจ้งเตือนครบกำหนดสัญญาล่วงหน้า 6 เดือน  —  AssetX Estate']);
      sheet.appendRow(['จัดทำโดย: นาย กิตติชัย โสมทัตถ์  |  บัญชี กสิกรไทย 194-8-33331-3  |  ระบบ AssetX Estate']);
      sheet.appendRow(['รหัส','ชื่อลูกค้า','สัญญา','ประเภท','ประเภททรัพย์','ทรัพย์หลักประกัน','เงินต้น (บาท)','ครบกำหนดสัญญา','สถานะ','โฉนดเลขที่']);
    }

    // ฟอร์แมตวันที่ภาษาไทย
    var endDateTh = '';
    if (customer.contractEndDate) {
      try {
        var d = new Date(customer.contractEndDate);
        var thMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
        endDateTh = d.getDate() + ' ' + thMonths[d.getMonth()] + ' ' + (d.getFullYear() + 543);
      } catch(e) { endDateTh = customer.contractEndDate; }
    }

    var firstDeedNo = deedsArray && deedsArray.length > 0 ? (deedsArray[0].no || '') : '';
    var principalFmt = Number(customer.principal).toLocaleString('th-TH');
    var amountFmt = Number(customer.amount).toLocaleString('th-TH');

    var lastRow = sheet.getLastRow();

    // Detailed block — header
    var blockHeader = '  📌  ID ' + customer.id + '  ·  ' + customer.name + '  ·  ' + customer.fullLabel + '  ·  ' + (customer.propertyType || '—');
    sheet.appendRow([blockHeader,'','','','','','','','','']);
    sheet.getRange(lastRow + 1, 1, 1, 10).merge().setBackground('#1a3a5c').setFontColor('#ffffff').setFontWeight('bold');

    // Notice title
    var noticeTitle = '  หนังสือแจ้งเตือนครบกำหนดสัญญา' + customer.type + 'ล่วงหน้า 6 เดือน';
    sheet.appendRow([noticeTitle,'','','','','','','','','']);
    sheet.getRange(lastRow + 2, 1, 1, 10).merge().setBackground('#e8f0fe').setFontWeight('bold');

    // รายละเอียด
    sheet.appendRow(['    ประเภทสัญญา','','','',customer.type,'','','','','']);
    sheet.appendRow(['    ประเภททรัพย์','','','',customer.propertyType || '—','','','','','']);
    sheet.appendRow(['    ทรัพย์หลักประกัน','','','',customer.location || '—','','','','','']);
    sheet.appendRow(['    โฉนดเลขที่','','','',firstDeedNo || '—','','','','','']);
    sheet.appendRow(['    ยอดเงินต้น','','','',principalFmt + ' บาท','','','','','']);
    sheet.appendRow(['    ดอกเบี้ย','','','',amountFmt + ' บาท (' + customer.freq + ')','','','','','']);
    sheet.appendRow(['    วันครบกำหนดสัญญา','','','',endDateTh,'','','','','']);

    // รายละเอียดโฉนด
    sheet.appendRow(['    รายละเอียดโฉนด','','','','','','','','','']);
    sheet.getRange(lastRow + 10, 1, 1, 10).merge().setBackground('#f1f5f9').setFontWeight('bold');
    sheet.appendRow(['โฉนดเลขที่','เนื้อที่','ตำบล/แขวง','เลขที่ดิน','ระวาง','','','','','']);
    if (deedsArray && deedsArray.length > 0) {
      deedsArray.forEach(function(deed) {
        sheet.appendRow([deed.no||'', deed.area||'', deed.tambon||'', deed.landNo||'', deed.mapRef||'','','','','','']);
      });
    } else {
      sheet.appendRow(['—','—','—','—','—','','','','','']);
    }

    // ข้อความแจ้งเตือน
    sheet.appendRow(['    📨  ข้อความสำหรับส่งหนังสือแจ้งเตือน (คัดลอกส่งได้เลย)','','','','','','','','','']);
    sheet.getRange(lastRow + 13, 1, 1, 10).merge().setBackground('#fef9c3').setFontWeight('bold');
    var greetName = customer.name.replace(/^(นาย|นาง|นางสาว|คุณ)\s*/,'');
    sheet.appendRow(['เรียน  คุณ' + greetName,'','','','','','','','','']);
    sheet.getRange(lastRow + 14, 1, 1, 10).merge();
    sheet.appendRow(['']);
    sheet.appendRow(['ขอเรียนให้ทราบว่า สัญญา' + customer.type + 'ของท่านกับ AssetX Estate จะครบกำหนดในวันที่ ' + endDateTh,'','','','','','','','','']);
    sheet.getRange(lastRow + 16, 1, 1, 10).merge();
    sheet.appendRow(['กรุณาติดต่อกลับเพื่อดำเนินการต่อสัญญาหรือไถ่ถอนทรัพย์สินก่อนวันครบกำหนด','','','','','','','','','']);
    sheet.getRange(lastRow + 17, 1, 1, 10).merge();
    sheet.appendRow(['']);
    sheet.appendRow(['']);
  } catch(e) {
    Logger.log('appendToContractNotice error: ' + e.message);
  }
}

// ============================================================
// Backfill ลูกค้าที่มีอยู่แล้วเข้า DEEDS และ CONTRACT_NOTICE
// รันครั้งเดียวจาก GAS Editor เพื่อ sync ข้อมูลเก่า
// ============================================================
function backfillCustomerToSheets(customerId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const dataSheet = ss.getSheetByName(SHEET_NAME);
  if (!dataSheet) return { success: false, error: 'ไม่พบ Sheet DATA' };

  const data = dataSheet.getDataRange().getValues();
  var customerFound = null;
  var deedsRaw = '';

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var id = String(row[0] || '');
    if (id !== String(customerId)) continue;
    if (!customerFound) {
      var endRaw = row[11];
      var endStr = '';
      if (endRaw) { try { endStr = Utilities.formatDate(new Date(endRaw), 'Asia/Bangkok', 'yyyy-MM-dd'); } catch(e){} }
      customerFound = {
        id: id,
        name: String(row[1] || ''),
        fullLabel: String(row[2] || ''),
        type: String(row[3] || ''),
        propertyType: String(row[10] || ''),
        principal: Number(row[6]) || 0,
        amount: Number(row[7]) || 0,
        freq: String(row[8] || ''),
        location: String(row[9] || ''),
        contractEndDate: endStr,
      };
      deedsRaw = String(row[14] || '');
    }
  }

  if (!customerFound) return { success: false, error: 'ไม่พบลูกค้า ID: ' + customerId };

  // แปลง deeds
  var deedsArray = [];
  if (deedsRaw) {
    if (deedsRaw.charAt(0) === '[') {
      try { deedsArray = JSON.parse(deedsRaw); } catch(e) {}
    } else {
      deedsArray = [{ no: deedsRaw }];
    }
  }

  appendToDeeds(ss, customerFound, deedsArray);
  appendToContractNotice(ss, customerFound, deedsArray);

  return { success: true, message: 'เพิ่มข้อมูล ' + customerFound.name + ' ลง DEEDS และ CONTRACT_NOTICE แล้ว' };
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
    '⏳ รอการพิจารณาจากท่าน',
    'AssetX Estate Co., Ltd. 🏠'
  ].join('\n');
  sendLine(INVESTOR_LINE_USER_ID, msg);
  return { success: true };
}

// ============================================================
// ระบบลงทะเบียน LINE กลุ่ม
// ============================================================

function getOrCreateTokenSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('รหัสลงทะเบียน');
  if (!sheet) {
    sheet = ss.insertSheet('รหัสลงทะเบียน');
    const headers = ['token', 'customer_id', 'customer_name', 'line_id', 'used', 'created_at', 'expires_at'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#1a3a5c').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function generateRegistrationToken(customerId, customerName) {
  if (!customerId) return { success: false, error: 'ไม่มี customerId' };
  const sheet = getOrCreateTokenSheet();
  const rows = sheet.getDataRange().getValues();

  // ลบ token เก่าที่ยังไม่ได้ใช้ของลูกค้าคนนี้ออกก่อน
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][1]) === String(customerId) && rows[i][4] === false) {
      sheet.deleteRow(i + 1);
    }
  }

  // สุ่ม token ใหม่ที่ไม่ซ้ำ
  var token, tries = 0;
  do {
    token = 'AX-' + String(Math.floor(1000 + Math.random() * 9000));
    tries++;
  } while (tries < 20 && rows.some(function(r) { return r[0] === token && r[4] === false; }));

  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  sheet.appendRow([
    token,
    String(customerId),
    customerName || '',
    '',
    false,
    Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'),
    Utilities.formatDate(expires, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss')
  ]);

  return {
    success: true,
    token: token,
    expiresAt: Utilities.formatDate(expires, 'Asia/Bangkok', 'yyyy-MM-dd')
  };
}

function registerCustomer(token, lineId) {
  const sheet = getOrCreateTokenSheet();
  const rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] !== token) continue;
    if (rows[i][4] === true) return { success: false, error: 'รหัสนี้ถูกใช้งานไปแล้ว' };

    const expires = new Date(rows[i][6]);
    if (new Date() > expires) return { success: false, error: 'รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่จากเจ้าหน้าที่' };

    const customerId = String(rows[i][1]);
    const customerName = rows[i][2];

    // อัพเดท token sheet: บันทึก line_id + mark ใช้แล้ว
    sheet.getRange(i + 1, 4).setValue(lineId);
    sheet.getRange(i + 1, 5).setValue(true);

    // อัพเดท line_user_id ในทุกแถวของลูกค้าคนนี้ใน Sheet DATA
    const dataSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const dataRows = dataSheet.getDataRange().getValues();
    for (var j = 1; j < dataRows.length; j++) {
      if (String(dataRows[j][COL.customer_id - 1]) === customerId) {
        dataSheet.getRange(j + 1, COL.line_user_id).setValue(lineId);
      }
    }

    return { success: true, customerName: customerName };
  }

  return { success: false, error: 'ไม่พบรหัส ' + token + ' กรุณาตรวจสอบรหัสอีกครั้ง' };
}

function replyLine_webhook(replyToken, message) {
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + LINE_TOKEN
      },
      payload: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: 'text', text: message }]
      }),
      muteHttpExceptions: true
    });
  } catch(e) {
    Logger.log('replyLine_webhook error: ' + e.message);
  }
}

function handleLineWebhook(body) {
  const events = body.events || [];
  events.forEach(function(event) {
    if (event.type !== 'message' || event.message.type !== 'text') return;

    const text = event.message.text.trim();
    const replyToken = event.replyToken;
    const source = event.source;
    const lineId = source.groupId || source.userId || '';
    const sourceType = source.type; // 'group' | 'user'

    if (text.startsWith('/ลงทะเบียน')) {
      const parts = text.trim().split(/\s+/);
      const raw = (parts[1] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const numMatch = raw.match(/(\d{4})$/);
      const token = numMatch ? 'AX-' + numMatch[1] : '';

      if (!token) {
        replyLine_webhook(replyToken,
          '❌ รูปแบบไม่ถูกต้อง\n\nกรุณาพิมพ์:\n/ลงทะเบียน AX-XXXX\n\nโดย AX-XXXX คือรหัสที่ได้รับจากเจ้าหน้าที่');
        return;
      }

      const result = registerCustomer(token, lineId);
      var replyMsg;
      if (result.success) {
        const dest = sourceType === 'group' ? 'กลุ่มนี้' : 'แชทนี้';
        replyMsg = [
          '✅ ลงทะเบียนรับการแจ้งเตือนสำเร็จ!',
          '',
          'สวัสดีครับ/ค่ะ คุณ' + result.customerName,
          'ระบบจะส่งการแจ้งเตือนการชำระเงิน',
          'มาที่' + dest + 'โดยอัตโนมัติครับ/ค่ะ',
          '',
          '🔒 ข้อมูลของคุณถูกเก็บรักษาเป็นความลับ',
          'และใช้เพื่อการแจ้งเตือนเท่านั้น',
          '',
          'AssetX Estate Co., Ltd. 🏠'
        ].join('\n');
      } else {
        replyMsg = '❌ ไม่สามารถลงทะเบียนได้\n\n' + result.error + '\n\nกรุณาติดต่อเจ้าหน้าที่เพื่อขอรหัสใหม่';
      }
      replyLine_webhook(replyToken, replyMsg);
    }
  });

  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

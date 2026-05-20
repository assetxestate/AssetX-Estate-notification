// ── ข้อมูลผู้ส่ง ─────────────────────────────────────────────────
export const SENDER_INFO = {
  name:     "จักรพันธ์ ศรีสว่าง",
  position: "ผู้จัดการ",
  company:  "บริษัท แอสเสท เอ็กซ์ เอสเตท จำกัด",
  address:  "345/34 หมู่บ้านแกรนดิโอ2 - พระราม2 หมู่ที่ 5 ตำบลพันท้ายนรสิงห์ อำเภอเมืองสมุทรสาคร จังหวัดสมุทรสาคร 74000",
};

// ── แปลงตัวเลขเป็นภาษาไทย ───────────────────────────────────────
export function numberToThaiText(amount) {
  if (amount === 0) return "ศูนย์บาทถ้วน";
  const DIGITS    = ["ศูนย์","หนึ่ง","สอง","สาม","สี่","ห้า","หก","เจ็ด","แปด","เก้า"];
  const POSITIONS = ["","สิบ","ร้อย","พัน","หมื่น","แสน","ล้าน"];
  const baht   = Math.floor(amount);
  const satang = Math.round((amount - baht) * 100);
  let result = "";

  if (baht > 0) {
    const s = String(baht);
    const len = s.length;
    for (let i = 0; i < len; i++) {
      const d   = parseInt(s[i]);
      const pos = len - i - 1;
      if (d === 0) continue;
      if (pos === 1 && d === 1)       result += "สิบ";
      else if (pos === 1 && d === 2)  result += "ยี่สิบ";
      else if (pos === 0 && d === 1 && len > 1) result += "เอ็ด";
      else result += DIGITS[d] + POSITIONS[pos % 6] + (pos === 6 ? "ล้าน" : "");
    }
    result += "บาท";
  }

  if (satang > 0) {
    const ss = String(satang).padStart(2, "0");
    for (let i = 0; i < 2; i++) {
      const d   = parseInt(ss[i]);
      const pos = 1 - i;
      if (d === 0) continue;
      if (pos === 1 && d === 1)      result += "สิบ";
      else if (pos === 1 && d === 2) result += "ยี่สิบ";
      else if (pos === 0 && d === 1 && satang >= 10) result += "เอ็ด";
      else result += DIGITS[d] + POSITIONS[pos];
    }
    result += "สตางค์";
  } else {
    result += "ถ้วน";
  }
  return result;
}

// ── แปลงวันที่เป็นรูปแบบ "1 มกราคม พ.ศ. 2568" ──────────────────
export function formatThaiDateFull(dateStr) {
  const MONTHS = ["","มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
                  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth() + 1]} พ.ศ. ${d.getFullYear() + 543}`;
}

// ── จัดรูปแบบเนื้อที่ดิน "0-1-75.4 ไร่" → "1 งาน 75.4 ตารางวา" ─
export function formatLandArea(areaStr) {
  if (!areaStr) return "-";
  const m = areaStr.match(/^(\d+)-(\d+)-([\d.]+)/);
  if (!m) return areaStr;
  const parts = [];
  if (parseInt(m[1]) > 0) parts.push(`${m[1]} ไร่`);
  if (parseInt(m[2]) > 0) parts.push(`${m[2]} งาน`);
  if (parseFloat(m[3]) > 0) parts.push(`${m[3]} ตารางวา`);
  return parts.join(" ") || "-";
}

// ── สร้างและเปิดหน้าต่าง Notice ──────────────────────────────────
export function printNotice(customer, extraInfo, docNumber) {
  const allDeeds = customer.deeds || [];
  const deed     = allDeeds[0] || {};
  const today    = new Date();

  const todayStr       = formatThaiDateFull(today.toISOString().split("T")[0]);
  const contractEndStr = formatThaiDateFull(customer.contractEndDate);
  const contractDateStr = extraInfo.contractDate
    ? formatThaiDateFull(extraInfo.contractDate) : "-";

  const remaining      = customer.payments?.filter(p => p.diff >= 0).length || 0;
  const totalInterest  = (customer.amount || 0) * remaining;
  const totalRedemption = (customer.principal || 0) + totalInterest;

  const deedList = allDeeds.map((d) =>
    `โฉนดเลขที่ ${d.no || "-"} เลขที่ดิน ${d.landNo || "-"} ต.${d.tambon || "-"} อ.${d.amphoe || "-"} จ.${d.province || "-"} เนื้อที่ ${formatLandArea(d.area)}`
  ).join("\n           ");

  const landOffice = extraInfo.landOffice || `สำนักงานที่ดินจังหวัด${deed.province || "-"}`;

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>หนังสือแจ้งกำหนดเวลาไถ่จากขายฝาก - ${customer.name}</title>
<style>
  @page { size: A4; margin: 2.5cm; }
  * { box-sizing: border-box; }
  body { font-family: 'TH Sarabun New', 'Sarabun', serif; font-size: 16pt; line-height: 1.8; color: #000; background: #fff; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .title { font-size: 18pt; font-weight: bold; text-align: center; margin-bottom: 8px; }
  .doc-info { text-align: right; margin-bottom: 16px; }
  .section { margin-bottom: 12px; }
  .indent { padding-left: 60px; }
  .indent2 { padding-left: 80px; }
  .sign-area { text-align: center; margin-top: 40px; }
  .dotline { display: inline-block; width: 220px; border-bottom: 1px dotted #000; }
  .remark { margin-top: 20px; font-size: 13pt; border-top: 1px solid #000; padding-top: 8px; }
  @media print { .no-print { display: none; } body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="no-print" style="display:block;text-align:center;margin-bottom:20px;font-family:sans-serif;">
  <button onclick="window.print()" style="padding:10px 30px;font-size:16px;background:#2DD4BF;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">
    🖨️ พิมพ์ / บันทึก PDF
  </button>
</div>

<div class="title">หนังสือแจ้งกำหนดเวลาไถ่จากขายฝาก</div>
<div class="doc-info">ที่ ${docNumber}<br>วันที่ ${todayStr}</div>

<div class="section"><span class="bold">เรื่อง</span>&nbsp;&nbsp;&nbsp;แจ้งกำหนดเวลาไถ่และจำนวนสินไถ่จากการขายฝาก</div>

<div class="section">
  <span class="bold">เรียน</span>&nbsp;&nbsp;&nbsp;${extraInfo.fullName || customer.name} (ผู้ขายฝาก)<br>
  <span class="indent">${extraInfo.address || "-"}</span>
</div>

<div class="section">
  <span class="bold">อ้างถึง</span>&nbsp;&nbsp;สัญญาขายฝากที่ดิน เลขที่ ${extraInfo.contractNumber || "-"} ลงวันที่ ${contractDateStr}<br>
  <span class="indent2">จดทะเบียน ณ ${landOffice}</span>
</div>

<div class="section"><span class="bold">สิ่งที่ส่งมาด้วย</span>&nbsp;&nbsp;สำเนาสัญญาขายฝาก จำนวน 1 ชุด</div>

<div class="section indent" style="margin-top:16px;">
  ตามที่ท่านได้ทำสัญญาขายฝากที่ดิน ${deedList} ไว้กับข้าพเจ้า ตามสัญญาขายฝากอ้างถึงนั้น
</div>

<div class="section indent">บัดนี้ ใกล้จะครบกำหนดเวลาไถ่ตามสัญญาแล้ว ข้าพเจ้าจึงขอแจ้งรายละเอียด ดังนี้</div>

<div class="section indent2">
  1. กำหนดวันครบกำหนดไถ่&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;${contractEndStr}<br>
  2. จำนวนสินไถ่&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;${totalRedemption.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท<br>
  &nbsp;&nbsp;&nbsp;&nbsp;(${numberToThaiText(totalRedemption)})<br>
  &nbsp;&nbsp;&nbsp;&nbsp;ประกอบด้วย<br>
  &nbsp;&nbsp;&nbsp;&nbsp;- เงินต้น (ราคาขายฝาก)&nbsp;&nbsp;:&nbsp;&nbsp;${(customer.principal || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท<br>
  &nbsp;&nbsp;&nbsp;&nbsp;- ผลประโยชน์ตอบแทน&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;${totalInterest.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท<br>
  3. สถานที่ชำระสินไถ่&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;${SENDER_INFO.company} ${SENDER_INFO.address}
</div>

<div class="section indent" style="margin-top:16px;">จึงเรียนมาเพื่อทราบและดำเนินการไถ่ถอนภายในกำหนดเวลาข้างต้น</div>

<div class="sign-area">
  ขอแสดงความนับถือ<br><br><br>
  <span class="dotline"></span><br>
  (${SENDER_INFO.name})<br>
  ${SENDER_INFO.position}<br>
  ${SENDER_INFO.company}
</div>

<div class="remark">
  <span class="bold">หมายเหตุ:</span> หนังสือฉบับนี้ส่งทางไปรษณีย์ลงทะเบียนตอบรับ
  ตามมาตรา 17 แห่ง พ.ร.บ. คุ้มครองประชาชนในการทำสัญญาขายฝากที่ดินเพื่อเกษตรกรรม
  หรือที่อยู่อาศัย พ.ศ. 2562
</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  win.document.write(html);
  win.document.close();
}

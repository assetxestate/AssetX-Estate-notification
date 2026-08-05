// ── ตาราง options + สูตรคำนวณสำหรับการประเมินทรัพย์ ─────────────────
// ใช้ร่วมกันระหว่าง ValuationPage.jsx (หน้าประเมินภายใน) และ AssessPage.jsx (หน้าประเมินออนไลน์สาธารณะ)

export const ASSESSMENT_TYPES = [
  { value: 'ขายฝาก', icon: '🔒', desc: 'รับซื้อฝาก / ได้ผลตอบแทนหลัง' },
  { value: 'จำนอง', icon: '🏛️', desc: 'จดจำนองที่สำนักงานที่ดิน' },
  { value: 'ซื้อขาย', icon: '🤝', desc: 'ประเมินเพื่อซื้อขายทั่วไป' },
  { value: 'ประเมินเพื่อสินเชื่อ', icon: '📋', desc: 'ยื่นธนาคาร / สถาบันการเงิน' },
  { value: 'ประเมินมูลค่าทรัพย์สิน', icon: '📊', desc: 'รายงานมูลค่าทางบัญชี' },
  { value: 'อื่นๆ', icon: '📝', desc: '' },
]

export const PROPERTY_TYPES = [
  { value: 'ที่ดิน', icon: '🗺️' }, { value: 'ที่อยู่อาศัย', icon: '🏠' },
  { value: 'อาคารชุด / คอนโด', icon: '🏢' }, { value: 'พาณิชยกรรม', icon: '🏪' },
  { value: 'อุตสาหกรรม / โลจิสติกส์', icon: '🏭' }, { value: 'โรงแรม / รีสอร์ท', icon: '🏨' },
  { value: 'อื่นๆ', icon: '📋' },
]

export const PROPERTY_SUBTYPES = {
  'ที่ดิน': ['ที่ดินเปล่า (โฉนด)', 'ที่ดินเปล่า (น.ส.3)', 'ที่ดินเปล่า (ส.ค.1)', 'ที่ดินพร้อมสิ่งปลูกสร้าง'],
  'ที่อยู่อาศัย': ['บ้านเดี่ยว', 'บ้านแฝด', 'ทาวน์เฮ้าส์', 'ตึกแถว'],
  'อาคารชุด / คอนโด': ['คอนโดมิเนียม', 'อาคารชุด', 'เซอร์วิสอพาร์ทเมนท์'],
  'พาณิชยกรรม': ['อาคารพาณิชย์', 'ตึกแถว', 'ศูนย์การค้า', 'สำนักงาน'],
  'อุตสาหกรรม / โลจิสติกส์': ['โกดัง', 'โรงงาน', 'นิคมอุตสาหกรรม', 'คลังสินค้า'],
  'โรงแรม / รีสอร์ท': ['โรงแรม', 'รีสอร์ท', 'เกสต์เฮ้าส์'],
  'อื่นๆ': ['อื่นๆ'],
}

export const PROVINCES = [
  'กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น',
  'จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่',
  'ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช',
  'นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี',
  'ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา',
  'พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม',
  'มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี',
  'ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ',
  'สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี',
  'สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ',
  'อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี',
]

// ── รหัสทรัพย์ Mappings ────────────────────────────────
export const ASSESSMENT_CODE = {
  'ขายฝาก': 'SR', 'จำนอง': 'MG', 'ซื้อขาย': 'PS',
  'ประเมินเพื่อสินเชื่อ': 'LN', 'ประเมินมูลค่าทรัพย์สิน': 'AV', 'อื่นๆ': 'OT',
}

export const PROVINCE_CODE = {
  'กรุงเทพมหานคร':'BKK','กระบี่':'KBI','กาญจนบุรี':'KAN','กาฬสินธุ์':'KSN',
  'กำแพงเพชร':'KPT','ขอนแก่น':'KKN','จันทบุรี':'CTI','ฉะเชิงเทรา':'CCO',
  'ชลบุรี':'CBI','ชัยนาท':'CNT','ชัยภูมิ':'CPM','ชุมพร':'CPN',
  'เชียงราย':'CRI','เชียงใหม่':'CMI','ตรัง':'TRG','ตราด':'TRT',
  'ตาก':'TAK','นครนายก':'NYK','นครปฐม':'NPT','นครพนม':'NPM',
  'นครราชสีมา':'NMA','นครศรีธรรมราช':'NST','นครสวรรค์':'NSN','นนทบุรี':'NBI',
  'นราธิวาส':'NWT','น่าน':'NAN','บึงกาฬ':'BKN','บุรีรัมย์':'BRM',
  'ปทุมธานี':'PTM','ประจวบคีรีขันธ์':'PKN','ปราจีนบุรี':'PRI','ปัตตานี':'PTN',
  'พระนครศรีอยุธยา':'AYA','พะเยา':'PYO','พังงา':'PNA','พัทลุง':'PLG',
  'พิจิตร':'PCT','พิษณุโลก':'PLK','เพชรบุรี':'PBI','เพชรบูรณ์':'PNB',
  'แพร่':'PRE','ภูเก็ต':'PKT','มหาสารคาม':'MKM','มุกดาหาร':'MDH',
  'แม่ฮ่องสอน':'MSN','ยโสธร':'YST','ยะลา':'YLA','ร้อยเอ็ด':'RET',
  'ระนอง':'RNG','ระยอง':'RYG','ราชบุรี':'RBR','ลพบุรี':'LRI',
  'ลำปาง':'LPG','ลำพูน':'LPN','เลย':'LEI','ศรีสะเกษ':'SSK',
  'สกลนคร':'SNK','สงขลา':'SKA','สตูล':'STN','สมุทรปราการ':'SPK',
  'สมุทรสงคราม':'SKM','สมุทรสาคร':'SAK','สระแก้ว':'SKW','สระบุรี':'SRI',
  'สิงห์บุรี':'SBR','สุโขทัย':'STI','สุพรรณบุรี':'SPB','สุราษฎร์ธานี':'SNI',
  'สุรินทร์':'SRN','หนองคาย':'NKI','หนองบัวลำภู':'NBP','อ่างทอง':'ATG',
  'อำนาจเจริญ':'ACR','อุดรธานี':'UDN','อุตรดิตถ์':'UTD','อุทัยธานี':'UTI',
  'อุบลราชธานี':'UBL',
}

export const SUBTYPE_CODE = {
  'ที่ดินเปล่า (โฉนด)':'NS','ที่ดินเปล่า (น.ส.3)':'N3','ที่ดินเปล่า (ส.ค.1)':'SK',
  'ที่ดินพร้อมสิ่งปลูกสร้าง':'LB','บ้านเดี่ยว':'HB','บ้านแฝด':'TW',
  'ทาวน์เฮ้าส์':'TH','ตึกแถว':'SH','คอนโดมิเนียม':'CD','อาคารชุด':'AP',
  'เซอร์วิสอพาร์ทเมนท์':'SA','อาคารพาณิชย์':'CM','ศูนย์การค้า':'ML',
  'สำนักงาน':'OF','โกดัง':'WH','โรงงาน':'FC','นิคมอุตสาหกรรม':'IE',
  'คลังสินค้า':'WS','โรงแรม':'HT','รีสอร์ท':'RS','เกสต์เฮ้าส์':'GH','อื่นๆ':'OT',
}

export function generateAssetCode(assessmentType, province, propertySubtype, seq) {
  const typeCode = ASSESSMENT_CODE[assessmentType] || 'OT'
  const provCode = PROVINCE_CODE[province] || 'UNK'
  const subCode = SUBTYPE_CODE[propertySubtype] || 'OT'
  const year = String(new Date().getFullYear()).slice(-2)
  const seqStr = String(seq).padStart(3, '0')
  return `${typeCode}-${provCode}-${subCode}-${seqStr}-${year}`
}

export const ROAD_TYPE_OPTIONS = [
  // ── ติดถนนสาธารณะโดยตรง ──────────────────────────────────────
  { value: 'ติดทางหลวง / ถนนหลัก 4 เลนขึ้นไป', factor: 1.15 },
  { value: 'ติดถนนหลัก 2 เลน (สายหลัก)', factor: 1.05 },
  { value: 'ติดถนนคสล./ลาดยาง สาธารณะ (ท้องถิ่น/อบต.)', factor: 1.00 },
  { value: 'ติดถนนลูกรัง/หินคลุก สาธารณะ', factor: 0.88 },
  { value: 'ติดถนนดิน / ทางชลประทาน', factor: 0.80 },
  // ── มุมถนน / ลักษณะพิเศษบวก ─────────────────────────────────
  { value: 'มุมถนน 2 ด้าน (Corner Plot)', factor: 1.12 },
  { value: 'ชายทะเล / ติดหาดทราย', factor: 1.20 },
  { value: 'ริมน้ำ / เลียบแม่น้ำ / คลองใหญ่', factor: 1.05 },
  { value: 'ใกล้รถไฟฟ้า BTS/MRT/ARL < 500ม.', factor: 1.12 },
  { value: 'ใกล้รถไฟฟ้า BTS/MRT/ARL 500ม.–1กม.', factor: 1.05 },
  // ── เข้าซอย ──────────────────────────────────────────────────
  { value: 'ซอยสั้น < 100ม. ออกถนนใหญ่', factor: 0.93 },
  { value: 'ซอย 100–200ม. ออกถนนใหญ่', factor: 0.87 },
  { value: 'ซอย 200–500ม.', factor: 0.80 },
  { value: 'ซอยลึก 500ม.–1กม.', factor: 0.72 },
  { value: 'ซอยลึกมาก > 1กม.', factor: 0.65 },
  { value: 'ซอยตัน / ปลายซอย', factor: 0.62 },
  // ── ทางเข้าพิเศษ / จำกัด ─────────────────────────────────────
  { value: 'ตรอกแคบ (รถเล็กผ่านได้ < 3ม.)', factor: 0.68 },
  { value: 'ทางเดินเท้าเท่านั้น (รถไม่ผ่าน)', factor: 0.45 },
  { value: 'ทางเอกชน — มีภาระจำยอมจดทะเบียน', factor: 0.78 },
  { value: 'ทางเอกชน — ไม่มีภาระจำยอม (ขออนุญาตผ่าน)', factor: 0.55 },
  { value: 'ที่ดินตาบอด (ไม่มีทางเข้าออก)', factor: 0.25 },
  // ── ลักษณะที่กระทบเชิงลบ ─────────────────────────────────────
  { value: 'เลียบทางด่วน / ใต้ทางด่วน (เสียง/ฝุ่น)', factor: 0.85 },
  { value: 'เลียบทางรถไฟ (เสียงรบกวน)', factor: 0.80 },
  { value: 'ที่ดินบนเนิน / ทางชัน (รถขึ้นยาก)', factor: 0.82 },
  { value: 'เลียบคลองเล็ก / คูน้ำชลประทาน', factor: 0.92 },
]
export const ROAD_WIDTH_OPTIONS = [
  { value: '≥ 30 ม. (ถนนหลักใหญ่)', factor: 1.10 },
  { value: '20–29 ม.', factor: 1.05 },
  { value: '12–19 ม.', factor: 1.00 },
  { value: '8–11 ม.', factor: 0.95 },
  { value: '6–7 ม. (คสล./ลาดยาง)', factor: 0.90 },
  { value: '4–5 ม.', factor: 0.85 },
  { value: '< 4 ม. / ตรอกแคบ', factor: 0.75 },
  { value: 'ไม่มีถนนหน้าที่ดิน', factor: 0.60 },
]
export const FRONTAGE_OPTIONS = [
  { value: '≥ 30 ม.', factor: 1.08 },
  { value: '20–29 ม.', factor: 1.05 },
  { value: '12–19 ม.', factor: 1.00 },
  { value: '8–11 ม.', factor: 0.95 },
  { value: '5–7 ม.', factor: 0.90 },
  { value: '2–4 ม.', factor: 0.80 },
  { value: '< 2 ม. (แคบมาก)', factor: 0.70 },
  { value: 'ไม่มีหน้ากว้าง / เข้าทางอื่น', factor: 0.50 },
]
export const ZONE_OPTIONS = [
  // ── พาณิชยกรรม (สีแดง) ──────────────────────────────────────
  { value: 'พ.5 — พาณิชยกรรมหลัก (แดงเข้ม)', factor: 1.40 },
  { value: 'พ.4 — พาณิชยกรรม (แดง)', factor: 1.30 },
  { value: 'พ.3 — พาณิชยกรรม (แดง)', factor: 1.25 },
  { value: 'พ.2 — พาณิชยกรรม (แดง)', factor: 1.20 },
  { value: 'พ.1 — พาณิชยกรรม (แดง)', factor: 1.15 },
  { value: 'พ/ย — พาณิชยกรรมและที่อยู่อาศัยหนาแน่นมาก (แดงลาย)', factor: 1.18 },
  // ── ที่อยู่อาศัย (สีเหลือง-ส้ม) ─────────────────────────────
  { value: 'ย.10 — อยู่อาศัยหนาแน่นสูงมาก (ส้ม)', factor: 1.15 },
  { value: 'ย.9 — อยู่อาศัยหนาแน่นสูง (ส้ม)', factor: 1.12 },
  { value: 'ย.8 — อยู่อาศัยหนาแน่นมาก (ส้ม)', factor: 1.10 },
  { value: 'ย.7 — อยู่อาศัยหนาแน่นมาก (ส้ม)', factor: 1.08 },
  { value: 'ย.6 — อยู่อาศัยหนาแน่นปานกลาง (เหลืองส้ม)', factor: 1.05 },
  { value: 'ย.5 — อยู่อาศัยหนาแน่นปานกลาง (เหลืองส้ม)', factor: 1.03 },
  { value: 'ย.4 — อยู่อาศัยหนาแน่นน้อย (เหลือง)', factor: 1.00 },
  { value: 'ย.3 — อยู่อาศัยหนาแน่นน้อย (เหลือง)', factor: 0.95 },
  { value: 'ย.2 — อยู่อาศัยหนาแน่นน้อย (เหลือง)', factor: 0.92 },
  { value: 'ย.1 — อยู่อาศัยหนาแน่นน้อยมาก (เหลือง)', factor: 0.90 },
  { value: 'ย/อ — อนุรักษ์เพื่อการอยู่อาศัย (เหลืองลาย)', factor: 0.88 },
  // ── อุตสาหกรรม (สีม่วง) ──────────────────────────────────────
  { value: 'อ.1 — อุตสาหกรรมทั่วไป (ม่วง)', factor: 0.90 },
  { value: 'อ.2 — อุตสาหกรรมทั่วไป (ม่วง)', factor: 0.88 },
  { value: 'อ.3 — อุตสาหกรรมหนัก (ม่วงเข้ม)', factor: 0.85 },
  { value: 'อ/ค — อุตสาหกรรมและคลังสินค้า (ม่วง)', factor: 0.88 },
  { value: 'ค — คลังสินค้า (ม่วงอ่อน)', factor: 0.87 },
  { value: 'อก — อุตสาหกรรมเฉพาะกิจ (ม่วง)', factor: 0.83 },
  { value: 'อ/มล — อุตสาหกรรมไม่เป็นมลพิษ + คลังสินค้า (ม่วงลาย)', factor: 0.85 },
  { value: 'อ/ค/ก — อุตสาหกรรม คลังสินค้า และเกษตรกรรม (ม่วงลาย)', factor: 0.80 },
  // ── ชนบทและชุมชน (สีชมพู) ───────────────────────────────────
  { value: 'ช — ชุมชน (ชมพู)', factor: 0.88 },
  { value: 'ช.1 — ชุมชน ช1 (ชมพูอ่อน)', factor: 0.87 },
  { value: 'ช.2 — ชุมชน ช2 (ชมพูอ่อน)', factor: 0.85 },
  { value: 'ชก — ชนบทและเกษตรกรรม (เขียวอ่อน)', factor: 0.78 },
  { value: 'ชก/อ — อนุรักษ์ชนบทและเกษตรกรรม (เขียวลาย)', factor: 0.72 },
  { value: 'ชก/ป — ชนบทและปศุสัตว์ (เขียวลาย)', factor: 0.70 },
  // ── เกษตรกรรม (สีเขียว) ──────────────────────────────────────
  { value: 'ก.1 — เกษตรกรรม (เขียวอ่อน)', factor: 0.75 },
  { value: 'ก.2 — เกษตรกรรม (เขียวอ่อน)', factor: 0.72 },
  { value: 'ก.3 — เกษตรกรรม (เขียวอ่อน)', factor: 0.70 },
  { value: 'กป — พื้นที่ปฏิรูปที่ดินเพื่อเกษตรกรรม (เขียวลาย)', factor: 0.68 },
  { value: 'กจ — จัดรูปที่ดินเพื่อเกษตรกรรม (เขียวลาย)', factor: 0.68 },
  // ── อนุรักษ์และสิ่งแวดล้อม (สีเขียวเข้ม) ────────────────────
  { value: 'ส — รักษาคุณภาพสิ่งแวดล้อม (เขียวเข้ม)', factor: 0.65 },
  { value: 'ปา — อนุรักษ์ป่าไม้ (เขียวเข้ม)', factor: 0.55 },
  { value: 'ทพ — อนุรักษ์ทรัพยากรธรรมชาติและสิ่งแวดล้อม (เขียวเข้ม)', factor: 0.60 },
  { value: 'สท — อนุรักษ์สภาพแวดล้อมและการท่องเที่ยว (เขียวเข้ม)', factor: 0.65 },
  { value: 'วท — อนุรักษ์เอกลักษณ์ศิลปวัฒนธรรมไทย (เขียวเข้ม)', factor: 0.65 },
  { value: 'ล — ที่โล่งเพื่อนันทนาการและสิ่งแวดล้อม (เขียวอ่อน)', factor: 0.60 },
  { value: 'ลช — ที่โล่งนันทนาการและสิ่งแวดล้อมชายฝั่ง (เขียวอ่อน)', factor: 0.58 },
  { value: 'ลท — ที่โล่งรักษาสิ่งแวดล้อมและการท่องเที่ยว (เขียวอ่อน)', factor: 0.62 },
  { value: 'ลป — ที่โล่งนันทนาการและปศุสัตว์ (เขียวอ่อน)', factor: 0.58 },
  { value: 'สน — สวนนันทนาการและรักษาสิ่งแวดล้อม (เขียวอ่อน)', factor: 0.60 },
  { value: 'สล — สวนรักษาสภาพป่าชายเลน (เขียวเข้ม)', factor: 0.50 },
  // ── สถาบัน/สาธารณูปการ (สีเทา-น้ำเงิน) ─────────────────────
  { value: 'สศ — สถาบันการศึกษา (เทา)', factor: 0.85 },
  { value: 'สน — สถาบันศาสนา (เทา)', factor: 0.82 },
  { value: 'สร — สถาบันราชการและสาธารณูปการ (น้ำเงิน)', factor: 0.88 },
  { value: 'ทห — เขตทหาร (น้ำเงินเข้ม)', factor: 0.70 },
  // ── คมนาคม ───────────────────────────────────────────────────
  { value: 'คข — คมนาคมขนส่ง (เทา)', factor: 0.80 },
  // ── เสี่ยงภัย ─────────────────────────────────────────────────
  { value: 'อภ — เสี่ยงอุกภัย (เทาลาย)', factor: 0.40 },
]
export const SOIL_OPTIONS = [
  // ── พร้อมใช้ ──────────────────────────────────────────────────
  { value: 'ถมเรียบร้อย ระดับดี / ใช้ได้เลย', factor: 1.00 },
  { value: 'ถมแล้ว ระดับพอดีถนน', factor: 0.97 },
  { value: 'ถมบางส่วน ยังไม่เสร็จ', factor: 0.93 },
  // ── ต้องถมเพิ่ม ───────────────────────────────────────────────
  { value: 'ยังไม่ถม (ต้องถมทั้งแปลง)', factor: 0.88 },
  { value: 'ต่ำกว่าถนน 0.5–1 ม.', factor: 0.85 },
  { value: 'ต่ำกว่าถนน > 1 ม. (ถมมาก)', factor: 0.78 },
  { value: 'มีน้ำขัง / ทุ่งน้ำท่วมซ้ำซาก', factor: 0.70 },
  // ── ดินมีปัญหา ────────────────────────────────────────────────
  { value: 'ดินเหนียวอ่อน / ดินเสียง (ต้องปรับปรุง)', factor: 0.85 },
  { value: 'ที่นา / สวน ยังไม่ปรับที่', factor: 0.82 },
  { value: 'บ่อ / สระน้ำ (ต้องถมมาก)', factor: 0.65 },
  { value: 'ป่าละเมาะ / ดงไผ่ / ต้องถางมาก', factor: 0.80 },
  // ── ปนเปื้อน / ปัญหาพิเศษ ────────────────────────────────────
  { value: 'เคยเป็นโรงงาน / สงสัยปนเปื้อน', factor: 0.55 },
  { value: 'ดินทรุด / มีโพรงใต้ดิน', factor: 0.60 },
  { value: 'ที่ดินลาดชัน / ดินไหล (ต้องกันดิน)', factor: 0.75 },
]
export const FLOOD_LEVELS = [
  { value: 'ไม่มีประวัติน้ำท่วม', score: 0 },
  { value: 'ท่วม 1 ครั้ง/10 ปี', score: 5 },
  { value: 'ท่วม 2-3 ครั้ง/10 ปี', score: 15 },
  { value: 'ท่วมรุนแรง/บ่อย (เช่น ระดับ 2554)', score: 25 },
]
export const TITLE_TYPES = [
  { value: 'โฉนด (Chanote) ปลอดภาระ', score: 0 },
  { value: 'โฉนด มีจำนองอยู่ชั้นเดียว', score: 3 },
  { value: 'น.ส.3ก (NS3G)', score: 5 },
  { value: 'น.ส.3 (NS3)', score: 8 },
  { value: 'มีภาระ/ข้อพิพาทรุนแรง', score: 18 },
]
export const RISK_FACTORS = [
  { key: 'hardAccess',     label: 'เข้าถึงยาก / ซอยตัน',         score: 10 },
  { key: 'irregularShape', label: 'รูปแปลงผิดปกติ',                score: 8  },
  { key: 'encumbrance',    label: 'มีภาระผูกพัน',                  score: 10 },
  { key: 'dispute',        label: 'มีข้อพิพาท / ครอบครอง',         score: 15 },
  { key: 'noUtilities',    label: 'ไม่มีสาธารณูปโภค',              score: 10 },
  { key: 'nuisance',       label: 'ติดสิ่งรบกวน (โรงงาน/กม.)',     score: 12 },
]
export const BASE_FSV_RATE = {
  'บ้านเดี่ยว': 0.78, 'บ้านแฝด': 0.75, 'ทาวน์เฮ้าส์': 0.75, 'ตึกแถว': 0.73,
  'ที่ดินเปล่า (โฉนด)': 0.72, 'ที่ดินเปล่า (น.ส.3)': 0.65, 'ที่ดินเปล่า (ส.ค.1)': 0.60,
  'ที่ดินพร้อมสิ่งปลูกสร้าง': 0.70, 'คอนโดมิเนียม': 0.73, 'อาคารชุด': 0.70,
  'อาคารพาณิชย์': 0.70, 'โกดัง': 0.65, 'โรงงาน': 0.60,
}
export const RISK_BANDS = [
  { maxScore: 15,  label: 'ต่ำมาก',  color: '#10B981', fsvAdj: 1.00, ltvMax: 75 },
  { maxScore: 30,  label: 'ต่ำ',     color: '#84CC16', fsvAdj: 0.98, ltvMax: 70 },
  { maxScore: 50,  label: 'กลาง',    color: '#F59E0B', fsvAdj: 0.95, ltvMax: 65 },
  { maxScore: 70,  label: 'สูง',     color: '#F97316', fsvAdj: 0.88, ltvMax: 55 },
  { maxScore: 100, label: 'สูงมาก',  color: '#EF4444', fsvAdj: 0.78, ltvMax: 45 },
]
export const COMP_ADJ = {
  size:      { '< 200 ตร.ว.': 0.05, '200–500 ตร.ว.': 0, '500–1,000 ตร.ว.': -0.10, '> 1,000 ตร.ว.': -0.20 },
  access:    { 'ถนนหลัก': 0, 'ซอยปกติ': -0.08, 'ซอยลึก': -0.15, 'ซอยตัน': -0.25 },
  utilities: { 'ครบทุกอย่าง': 0, 'บางส่วน': -0.08, 'ไม่มี': -0.15 },
}

export const EMPTY_DEED = () => ({ id: Date.now() + Math.random(), titleDeedNo: '', mapSheet: '', surveyPage: '', landNo: '', areaRai: 0, areaNgan: 0, areaSqw: 0, govPrice: 0 })

// ── สูตรคำนวณราคา/ความเสี่ยง (pure function — ย้ายมาจาก calc useMemo ใน ValuationPage.jsx) ─────
export function computeValuation(form) {
  const deeds = form.deeds || []
  const totalSqw = deeds.reduce((s, d) => s + d.areaRai * 400 + d.areaNgan * 100 + +d.areaSqw, 0)
  const weightedGovPrice = totalSqw > 0
    ? deeds.reduce((s, d) => { const sq = d.areaRai * 400 + d.areaNgan * 100 + +d.areaSqw; return s + d.govPrice * sq }, 0) / totalSqw
    : 0
  const roadTypeFactor = ROAD_TYPE_OPTIONS.find(o => o.value === form.roadType)?.factor ?? 1
  const roadWidthFactor = ROAD_WIDTH_OPTIONS.find(o => o.value === form.roadWidth)?.factor ?? 1
  const frontageFactor = FRONTAGE_OPTIONS.find(o => o.value === form.landFrontage)?.factor ?? 1
  const zoneFactor = ZONE_OPTIONS.find(o => o.value === form.zoneColor)?.factor ?? 1
  const soilFactor = SOIL_OPTIONS.find(o => o.value === form.soilCondition)?.factor ?? 1
  const locationFactor = roadTypeFactor * roadWidthFactor * frontageFactor * zoneFactor * soilFactor
  const calculatedMarketPrice = weightedGovPrice * locationFactor
  const effectiveMarketPrice = form.compPrice ? +form.compPrice : calculatedMarketPrice
  const marketValue = effectiveMarketPrice * totalSqw
  const govPriceTotal = weightedGovPrice * totalSqw
  const floodScore = FLOOD_LEVELS.find(f => f.value === form.floodLevel)?.score ?? 0
  const titleScore = TITLE_TYPES.find(t => t.value === form.titleType)?.score ?? 0
  const flagScore = RISK_FACTORS.reduce((s, rf) => s + (form.risks?.[rf.key] ? rf.score : 0), 0)
  const riskScore = Math.min(100, floodScore + titleScore + flagScore)
  const riskBand = RISK_BANDS.find(b => riskScore <= b.maxScore) || RISK_BANDS[RISK_BANDS.length - 1]
  const propertyScore = Math.max(0, 100 - riskScore)
  const baseFsvRate = BASE_FSV_RATE[form.propertySubtype] ?? 0.72
  const fsvRate = Math.round(baseFsvRate * riskBand.fsvAdj * 100) / 100
  const fsv = marketValue * fsvRate
  const cappedLtv = Math.min(form.ltvRate ?? 50, riskBand.ltvMax)
  const recommendedLoan = fsv * (cappedLtv / 100)
  const compAdjPrices = (form.comps || []).filter(c => +c.price > 0).map(c => {
    const months = c.date ? Math.max(0, (Date.now() - new Date(c.date)) / (1000 * 60 * 60 * 24 * 30)) : 0
    return +c.price * (1 + 0.005 * months) * (1 + (COMP_ADJ.size[c.size] ?? 0)) * (1 + (COMP_ADJ.access[c.access] ?? 0)) * (1 + (COMP_ADJ.utilities[c.utilities] ?? 0))
  })
  const compAvgAdjPrice = compAdjPrices.length > 0 ? Math.round(compAdjPrices.reduce((a, b) => a + b, 0) / compAdjPrices.length) : null
  return { totalSqw, govPriceTotal, weightedGovPrice, calculatedMarketPrice, effectiveMarketPrice, marketValue, propertyScore, riskScore, riskBand, fsvRate, fsv, cappedLtv, recommendedLoan, compAvgAdjPrice }
}

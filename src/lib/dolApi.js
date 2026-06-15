// กรมที่ดิน (DOL) LandsMaps API client
// endpoint: /apiService/LandsMaps/GetParcelByParcelNo/{provCode}/{ampCode}/{deedNo}

export const THAI_PROVINCES = [
  { code: '10', name: 'กรุงเทพมหานคร' },
  { code: '11', name: 'สมุทรปราการ' },
  { code: '12', name: 'นนทบุรี' },
  { code: '13', name: 'ปทุมธานี' },
  { code: '14', name: 'พระนครศรีอยุธยา' },
  { code: '15', name: 'อ่างทอง' },
  { code: '16', name: 'ลพบุรี' },
  { code: '17', name: 'สิงห์บุรี' },
  { code: '18', name: 'ชัยนาท' },
  { code: '19', name: 'สระบุรี' },
  { code: '20', name: 'ชลบุรี' },
  { code: '21', name: 'ระยอง' },
  { code: '22', name: 'จันทบุรี' },
  { code: '23', name: 'ตราด' },
  { code: '24', name: 'ฉะเชิงเทรา' },
  { code: '25', name: 'ปราจีนบุรี' },
  { code: '26', name: 'นครนายก' },
  { code: '27', name: 'สระแก้ว' },
  { code: '30', name: 'นครราชสีมา' },
  { code: '31', name: 'บุรีรัมย์' },
  { code: '32', name: 'สุรินทร์' },
  { code: '33', name: 'ศรีสะเกษ' },
  { code: '34', name: 'อุบลราชธานี' },
  { code: '35', name: 'ยโสธร' },
  { code: '36', name: 'ชัยภูมิ' },
  { code: '37', name: 'อำนาจเจริญ' },
  { code: '38', name: 'บึงกาฬ' },
  { code: '39', name: 'หนองบัวลำภู' },
  { code: '40', name: 'ขอนแก่น' },
  { code: '41', name: 'อุดรธานี' },
  { code: '42', name: 'เลย' },
  { code: '43', name: 'หนองคาย' },
  { code: '44', name: 'มหาสารคาม' },
  { code: '45', name: 'ร้อยเอ็ด' },
  { code: '46', name: 'กาฬสินธุ์' },
  { code: '47', name: 'สกลนคร' },
  { code: '48', name: 'นครพนม' },
  { code: '49', name: 'มุกดาหาร' },
  { code: '50', name: 'เชียงใหม่' },
  { code: '51', name: 'ลำพูน' },
  { code: '52', name: 'ลำปาง' },
  { code: '53', name: 'อุตรดิตถ์' },
  { code: '54', name: 'แพร่' },
  { code: '55', name: 'น่าน' },
  { code: '56', name: 'พะเยา' },
  { code: '57', name: 'เชียงราย' },
  { code: '58', name: 'แม่ฮ่องสอน' },
  { code: '60', name: 'นครสวรรค์' },
  { code: '61', name: 'อุทัยธานี' },
  { code: '62', name: 'กำแพงเพชร' },
  { code: '63', name: 'ตาก' },
  { code: '64', name: 'สุโขทัย' },
  { code: '65', name: 'พิษณุโลก' },
  { code: '66', name: 'พิจิตร' },
  { code: '67', name: 'เพชรบูรณ์' },
  { code: '70', name: 'ราชบุรี' },
  { code: '71', name: 'กาญจนบุรี' },
  { code: '72', name: 'สุพรรณบุรี' },
  { code: '73', name: 'นครปฐม' },
  { code: '74', name: 'สมุทรสาคร' },
  { code: '75', name: 'สมุทรสงคราม' },
  { code: '76', name: 'เพชรบุรี' },
  { code: '77', name: 'ประจวบคีรีขันธ์' },
  { code: '80', name: 'นครศรีธรรมราช' },
  { code: '81', name: 'กระบี่' },
  { code: '82', name: 'พังงา' },
  { code: '83', name: 'ภูเก็ต' },
  { code: '84', name: 'สุราษฎร์ธานี' },
  { code: '85', name: 'ระนอง' },
  { code: '86', name: 'ชุมพร' },
  { code: '90', name: 'สงขลา' },
  { code: '91', name: 'สตูล' },
  { code: '92', name: 'ตรัง' },
  { code: '93', name: 'พัทลุง' },
  { code: '94', name: 'ปัตตานี' },
  { code: '95', name: 'ยะลา' },
  { code: '96', name: 'นราธิวาส' },
]

// แปลงชื่อจังหวัด → รหัส
export const PROV_CODE = Object.fromEntries(THAI_PROVINCES.map(p => [p.name, p.code]))

// cache อำเภอ per province
const _amphoeCache = {}

async function dolFetch(params) {
  const qs = new URLSearchParams(params)
  const res = await fetch(`/api/landsmaps?${qs}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ดึงรายการอำเภอตามรหัสจังหวัด
export async function getAmphoeList(provCode) {
  if (_amphoeCache[provCode]) return _amphoeCache[provCode]
  try {
    const json = await dolFetch({ action: 'amphoe', provCode })
    // DOL อาจ return หลายรูปแบบ
    const list = json.result || json.data || (Array.isArray(json) ? json : null)
    if (list && list.length > 0) {
      _amphoeCache[provCode] = list
      return list
    }
  } catch {}
  return null // ไม่มี API → ให้ user กรอกเอง
}

// ค้นหาโฉนดจากกรมที่ดิน
export async function searchByDeed({ provCode, ampCode, deedNo }) {
  if (!provCode) throw new Error('กรุณาเลือกจังหวัด')
  if (!ampCode) throw new Error('กรุณาเลือกหรือกรอกรหัสอำเภอ')
  if (!deedNo) throw new Error('กรุณากรอกเลขโฉนด')

  const json = await dolFetch({ provCode, ampCode, deedNo: String(deedNo).trim() })
  if (json.error || !json.result?.length) {
    throw new Error(json.message || 'ไม่พบข้อมูลโฉนดนี้ — ตรวจสอบจังหวัด อำเภอ และเลขโฉนด')
  }
  return json.result[0]
}

// แปลงข้อมูล DOL → รูปแบบที่ form ใช้
export function parseDolResult(r) {
  return {
    titleDeedNo: r.parcelno || '',
    surveyPage:  r.surveyno || '',
    landNo:      r.landno || '',
    mapSheet:    r.utm || '',           // "5035 IV 1286-03 (2000)"
    areaRai:     Number(r.rai)  || 0,
    areaNgan:    Number(r.ngan) || 0,
    areaSqw:     Number(r.wa)   || 0,
    govPrice:    Number(r.landprice) || 0,
    // ข้อมูลที่ดินเพิ่มเติม
    tumbol:      r.tumbolname || '',
    amphur:      r.amphurname || '',
    province:    r.provname || '',
    lat:         r.parcellat || '',
    lng:         r.parcellon || '',
    parcelType:  r.parcel_type || '',
  }
}

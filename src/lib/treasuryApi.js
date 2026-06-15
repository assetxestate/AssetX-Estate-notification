// ── กรมธนารักษ์ CKAN Data API ─────────────────────────────────────
// ราคาประเมินที่ดิน: https://catalog.treasury.go.th/dataset/land-valuation
// ใช้ CKAN API v3 — ไม่ต้อง API Key สำหรับข้อมูลสาธารณะ

const CKAN = 'https://catalog.treasury.go.th/api/3/action';
const PACKAGE_ID = 'land-valuation';

let _resources = null;

// ดึง resource_id ของแต่ละจังหวัด (cache ใน sessionStorage)
export async function getProvinceResources() {
  if (_resources) return _resources;

  const cached = sessionStorage.getItem('trd_province_resources');
  if (cached) {
    try { _resources = JSON.parse(cached); return _resources; } catch {}
  }

  const res = await fetch(`${CKAN}/package_show?id=${PACKAGE_ID}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error('โหลดรายการจังหวัดไม่สำเร็จ');

  const map = {};
  (json.result.resources || []).forEach(r => {
    if (r.name && r.id) map[r.name] = r.id;
  });

  _resources = map;
  sessionStorage.setItem('trd_province_resources', JSON.stringify(map));
  return map;
}

// แปลง "5237I" / "5036II" → { num: "5237", quadrant: 1 }
function parseMapSheet(s) {
  if (!s) return {};
  const m = String(s).trim().match(/^(\d+)\s*(IV|III|II|I)?$/i);
  if (!m) return {};
  const quadrant = { I: 1, II: 2, III: 3, IV: 4 }[(m[2] || '').toUpperCase()];
  return { num: m[1], quadrant };
}

// หา column ที่มีราคาจาก record (รองรับชื่อ column หลายแบบ)
export function extractPrice(record) {
  if (!record) return 0;
  const priceKey = Object.keys(record).find(k =>
    k.includes('ราคาประเมิน') || k.toLowerCase().includes('price')
  );
  return priceKey ? parseFloat(record[priceKey]) || 0 : 0;
}

// สร้าง label แสดงข้อมูลระวางสำหรับ UI
export function recordLabel(record) {
  const parts = [
    record['หมายเลขระหว่างภูมิประเทศ'] && `ระวาง ${record['หมายเลขระหว่างภูมิประเทศ']}`,
    record['หมายเลขแผ่นระวางภูมิประเทศ'] && `แผ่น ${record['หมายเลขแผ่นระวางภูมิประเทศ']}`,
    record['เลขที่ดิน'] && `เลขที่ ${record['เลขที่ดิน']}`,
    record['หมายเลขระวาง UTM'] && `UTM ${record['หมายเลขระวาง UTM']}`,
  ].filter(Boolean);
  return parts.join(' • ') || 'รายการที่พบ';
}

// ค้นหาราคาประเมินจากกรมธนารักษ์
export async function searchGovPrice({ province, landNo, mapSheet }) {
  if (!province) throw new Error('กรุณาระบุจังหวัด');
  if (!landNo) throw new Error('กรุณากรอกเลขที่ดิน');

  const resources = await getProvinceResources();
  const resourceId = resources[province];
  if (!resourceId) {
    throw new Error(`ไม่พบข้อมูลจังหวัด "${province}" ในระบบกรมธนารักษ์`);
  }

  const filters = { เลขที่ดิน: String(landNo).trim() };
  const { num, quadrant } = parseMapSheet(mapSheet);
  if (num) filters['หมายเลขระหว่างภูมิประเทศ'] = num;
  if (quadrant != null) filters['หมายเลขแผ่นระวางภูมิประเทศ'] = quadrant;

  const params = new URLSearchParams({
    resource_id: resourceId,
    filters: JSON.stringify(filters),
    limit: 20,
  });

  let res;
  try {
    res = await fetch(`${CKAN}/datastore_search?${params}`);
  } catch {
    throw new Error('เชื่อมต่อ catalog.treasury.go.th ไม่ได้ — อาจเป็นปัญหา CORS หรือเครือข่าย');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error('ค้นหาไม่สำเร็จ');

  return {
    records: json.result.records || [],
    total: json.result.total || 0,
  };
}

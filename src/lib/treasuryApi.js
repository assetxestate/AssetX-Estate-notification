// ── กรมธนารักษ์ CKAN Data API ─────────────────────────────────────
// ราคาประเมินที่ดิน: https://catalog.treasury.go.th/dataset/land-valuation
// ใช้ CKAN API v3 — ไม่ต้อง API Key สำหรับข้อมูลสาธารณะ

const CKAN = 'https://catalog.treasury.go.th/api/3/action';
const PACKAGE_ID = 'land-valuation';

// ส่ง request ผ่าน proxy /api/treasury (หลีก CORS)
async function proxyFetch(url) {
  const res = await fetch(`/api/treasury?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

let _resources = null;

// ดึง resource_id ของแต่ละจังหวัด (cache ใน sessionStorage)
export async function getProvinceResources() {
  if (_resources) return _resources;

  const cached = sessionStorage.getItem('trd_province_resources');
  if (cached) {
    try { _resources = JSON.parse(cached); return _resources; } catch {}
  }

  const json = await proxyFetch(`${CKAN}/package_show?id=${PACKAGE_ID}`);
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

// แปลง field name จาก CKAN เป็นภาษาไทยอ่านง่าย
const FIELD_LABEL = {
  UTMMAP1: 'ระวาง', UTMMAP2: 'แผ่น', UTMMAP3: 'ลำดับ', UTMMAP4: 'ย่อย',
  UTMSCALE: 'มาตราส่วน', LAND_NO: 'เลขที่ดิน',
  'หมายเลขระหว่างภูมิประเทศ': 'ระวาง', 'หมายเลขแผ่นระวางภูมิประเทศ': 'แผ่น',
  'เลขที่ดิน': 'เลขที่ดิน', 'หมายเลขระวาง UTM': 'UTM',
};

// สร้าง label แสดงข้อมูลตำแหน่งสำหรับ UI
export function recordLabel(record) {
  const SKIP = new Set(['_id', '_full_text', 'rank']);
  const priceKeys = new Set(
    Object.keys(record).filter(k => k.includes('ราคา') || k.toLowerCase().includes('price'))
  );
  const parts = Object.entries(record)
    .filter(([k, v]) => !SKIP.has(k) && !priceKeys.has(k) && v != null && String(v).trim() !== '')
    .map(([k, v]) => {
      const label = FIELD_LABEL[k] || k;
      const val = k === 'UTMSCALE' ? `1:${Number(v).toLocaleString('th-TH')}` : v;
      return `${label} ${val}`;
    });
  return parts.join(' | ') || 'รายการที่พบ';
}

// ค้นหาราคาประเมินจากกรมธนารักษ์
export async function searchGovPrice({ province, landNo, mapSheet }) {
  if (!province) throw new Error('กรุณาระบุจังหวัด');
  if (!landNo) throw new Error('กรุณากรอกเลขที่ดิน');

  const resources = await getProvinceResources();
  const resourceId = resources[province];
  if (!resourceId) {
    const available = Object.keys(resources).slice(0, 5).join(', ');
    throw new Error(`ไม่พบข้อมูลจังหวัด "${province}" — จังหวัดที่มี: ${available || 'ไม่มี (โหลดไม่สำเร็จ)'}`);
  }

  // ขั้นที่ 1: ดูชื่อ field จริงจาก datastore (limit=1)
  const infoParams = new URLSearchParams({ resource_id: resourceId, limit: 1 });
  const infoJson = await proxyFetch(`${CKAN}/datastore_search?${infoParams}`);
  if (!infoJson.success) {
    const msg = infoJson.error?.message || infoJson.error?.__type || 'datastore ไม่พร้อมใช้งาน';
    throw new Error(`resource_id: ${resourceId} — ${msg}`);
  }

  // หา field ที่น่าจะเป็นเลขที่ดิน (รองรับทั้ง Thai และ English field names)
  const fields = (infoJson.result.fields || []).map(f => f.id);
  const fl = (f) => f.toLowerCase();
  // LAND_NO หรือ เลขที่ดิน
  const landField = fields.find(f => fl(f).includes('land_no') || fl(f) === 'land_no' || f.includes('ที่ดิน')) || 'LAND_NO';
  // UTMMAP1 = หมายเลขระวางหลัก (4 หลัก เช่น 4935)
  const mapField  = fields.find(f => fl(f) === 'utmmap1' || f.includes('ระหว่างภูมิ') || (fl(f).includes('utm') && fl(f).endsWith('1'))) || 'UTMMAP1';
  // UTMMAP2 = quadrant (1=I, 2=II, 3=III, 4=IV)
  const quadField = fields.find(f => fl(f) === 'utmmap2' || f.includes('แผ่นระวาง') || (fl(f).includes('utm') && fl(f).endsWith('2'))) || 'UTMMAP2';

  // ขั้นที่ 2: ค้นด้วย q (full-text) แล้ว filter client-side ด้วย landField จริง
  const { num, quadrant } = parseMapSheet(mapSheet);
  const q = String(landNo).trim();

  const searchParams = new URLSearchParams({ resource_id: resourceId, q, limit: 100 });
  const json = await proxyFetch(`${CKAN}/datastore_search?${searchParams}`);
  if (!json.success) {
    const msg = json.error?.message || json.error?.__type || 'unknown';
    throw new Error(`ค้นหาไม่สำเร็จ: ${msg}`);
  }

  // Filter client-side: เลขที่ดินตรง + ระวางตรง (ถ้ามี)
  let records = (json.result.records || []).filter(r =>
    String(r[landField]).trim() === q
  );
  if (num && records.length > 1) {
    records = records.filter(r => String(r[mapField]).trim() === num);
  }
  if (quadrant != null && records.length > 1) {
    // UTMMAP2 เก็บเป็น number (1-4) เทียบกับ quadrant ที่ได้จาก I→1, II→2, III→3, IV→4
    records = records.filter(r => String(r[quadField]).trim() === String(quadrant));
  }

  return { records, total: records.length, fields };
}

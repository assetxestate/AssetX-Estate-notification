// ราคาประเมินราชการของหลักประกันรายลูกค้า — เก็บไว้ในโฉนดแต่ละแปลง (customers.deeds[])
//   govPrice      บาท/ตร.ว. (คีย์เดียวกับ deeds ของผลประเมิน valuations.deeds[].govPrice)
//   buildingValue ราคาประเมินสิ่งปลูกสร้างรวม (บาท) ไม่มีก็ 0
//   govPriceDate  วันที่อ้างอิงราคา (YYYY-MM-DD) ไม่บังคับ
// ใช้โดยหน้าลูกค้า (แสดง/แก้ไข) และหน้าภาษี (ฐานราคาประเมินของรีไฟแนนซ์ย้ายทุน)

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// เนื้อที่เป็นตารางวา จาก "ไร่-งาน-วา" ("5-2-0 ไร่", "0-0-60.2 ไร่") หรือจากช่องตัวเลข areaRai/areaNgan/areaSqw
export function deedAreaWa(deed) {
  if (!deed) return 0
  const m = String(deed.area || '').match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/)
  if (m) return round2(Number(m[1]) * 400 + Number(m[2]) * 100 + Number(m[3]))
  if (deed.areaRai !== undefined || deed.areaNgan !== undefined || deed.areaSqw !== undefined) {
    return round2(num(deed.areaRai) * 400 + num(deed.areaNgan) * 100 + num(deed.areaSqw))
  }
  // รูปแบบมีหน่วย เช่น "1 ไร่", "2 งาน 50 ตร.ว." — ห้ามตีความ "1 ไร่" เป็น 1 ตร.ว.
  const text = String(deed.area || '')
  const unit = (re) => { const u = text.match(re); return u ? Number(u[1]) : 0 }
  const rai = unit(/(\d+(?:\.\d+)?)\s*ไร่/)
  const ngan = unit(/(\d+(?:\.\d+)?)\s*งาน/)
  const wa = unit(/(\d+(?:\.\d+)?)\s*(?:ตร\.?\s*ว\.?|ตารางวา|วา)/)
  if (rai || ngan || wa) return round2(rai * 400 + ngan * 100 + wa)
  // ตัวเลขล้วน = ตารางวา
  return /^\s*\d+(?:\.\d+)?\s*$/.test(text) ? round2(Number(text)) : 0
}

export function deedAssessment(deed) {
  const wa = deedAreaWa(deed)
  const govPrice = Math.max(0, num(deed?.govPrice))
  const buildingValue = Math.max(0, num(deed?.buildingValue)) // ค่าติดลบไม่มีความหมาย ถือเป็น 0
  const landValue = round2(wa * govPrice)
  return { wa, govPrice, landValue, buildingValue, total: round2(landValue + buildingValue), priced: govPrice > 0 && wa > 0 }
}

// รวมทุกแปลงของลูกค้า — complete = ทุกแปลงมีราคาแล้ว (ใช้เป็นฐานคำนวณได้)
export function customerAssessment(deeds) {
  const list = Array.isArray(deeds) ? deeds : []
  const items = list.map(deedAssessment)
  const pricedCount = items.filter((d) => d.priced).length
  return {
    count: list.length,
    pricedCount,
    complete: list.length > 0 && pricedCount === list.length,
    totalWa: round2(items.reduce((s, d) => s + d.wa, 0)),
    landValue: round2(items.filter((d) => d.priced).reduce((s, d) => s + d.landValue, 0)),
    buildingValue: round2(items.reduce((s, d) => s + d.buildingValue, 0)),
    total: round2(items.filter((d) => d.priced).reduce((s, d) => s + d.total, 0)),
    items,
  }
}

// หาราคาประเมินราชการของโฉนดเลขนี้จากผลประเมินในระบบ (ValuationPage) → { govPrice, date, source } หรือ null
// เลขโฉนดซ้ำกันข้ามจังหวัดได้ จึงต้องให้จังหวัดตรงกันด้วยเมื่อทั้งสองฝั่งระบุไว้
export function findValuationPriceForDeed(deed, valuationRows) {
  const no = String(deed?.no || '').trim()
  if (!no) return null
  const province = String(deed?.province || '').trim()
  for (const row of Array.isArray(valuationRows) ? valuationRows : []) {
    const rowProvince = String(row?.['จังหวัด'] || '').trim()
    if (province && rowProvince && province !== rowProvince) continue
    const inDeeds = (Array.isArray(row?.deeds) ? row.deeds : []).find((d) => String(d?.titleDeedNo || '').trim() === no && num(d?.govPrice) > 0)
    if (inDeeds) return { govPrice: num(inDeeds.govPrice), date: row['วันที่ประเมิน'] || '', source: row['รหัส/ชื่อทรัพย์'] || '' }
    if (String(row?.['เลขโฉนด'] || '').trim() === no && num(row?.['ราคาประเมินรัฐ (บ./ตร.ว.)']) > 0) {
      return { govPrice: num(row['ราคาประเมินรัฐ (บ./ตร.ว.)']), date: row['วันที่ประเมิน'] || '', source: row['รหัส/ชื่อทรัพย์'] || '' }
    }
  }
  return null
}

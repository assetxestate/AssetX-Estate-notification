// ตารางชำระของวงเงินเพิ่มเก็บเป็น JSON array ใน contract_topups.payments
// รูปแบบรายการ: { installment, dateStr, postponedFrom?, postponeNote? }
// (ฟิลด์เลื่อนนัดใช้ชื่อเดียวกับตารางชำระหลักใน payments เพื่อให้หน้าเว็บแสดงผลด้วยโค้ดชุดเดียวกัน)

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// เลื่อนนัดงวดที่ระบุ → คืนอาร์เรย์ใหม่ (ไม่แก้ของเดิม)
// เก็บวันนัดเดิมครั้งแรกไว้ใน postponedFrom เสมอ เลื่อนซ้ำกี่ครั้งก็ยังอ้างถึงวันต้นฉบับได้
export function postponeTopupInstallment(payments, installment, newDate, note = '') {
  if (!ISO_DATE.test(String(newDate || ''))) throw new Error('วันนัดใหม่ต้องอยู่ในรูปแบบ YYYY-MM-DD')
  const list = Array.isArray(payments) ? payments : []
  const target = list.find((p) => Number(p?.installment) === Number(installment))
  if (!target) throw new Error(`ไม่พบงวดที่ ${installment} ในตารางชำระวงเงินเพิ่ม`)
  return list.map((p) => p !== target ? p : {
    ...p,
    dateStr: newDate,
    postponedFrom: p.postponedFrom || p.dateStr,
    postponeNote: String(note || ''),
  })
}

// งวดที่ใกล้ถึงกำหนดที่สุดในรายการ (แต่ละรายการมี diff = จำนวนวันนับจากวันนี้, ติดลบ = เกินกำหนด)
// ใช้แทนการหยิบงวดแรกตามลำดับ เพราะหลังเลื่อนนัดแล้ววันที่ของงวดอาจไม่เรียงตามเลขงวด; วันเดียวกันให้งวดที่มาก่อนในรายการ
export function nearestDue(list) {
  return Array.isArray(list) && list.length ? list.reduce((a, b) => (b.diff < a.diff ? b : a)) : null
}

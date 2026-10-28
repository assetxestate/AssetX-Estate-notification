// รวมวงเงินเพิ่ม (top-up) เข้ากับเงินต้นของสัญญา เพื่อให้ยอดรวมทุกหน้าตรงกัน

// แปลงยอดต่องวด → ต่อเดือน ตามรอบชำระ (ใช้กฎเดียวกับ Dashboard)
export function toMonthlyAmount(amount, freq) {
  const amt = Number(amount) || 0
  const f = String(freq || '')
  if (f.includes('ปี') || f === 'รายปี') return amt / 12
  if (f.includes('2 สัปดาห์') || f.includes('สองสัปดาห์')) return amt * 2
  if (f.includes('วัน')) return amt * 30
  return amt // รายเดือน (ค่าเริ่มต้น)
}

export function sumTopupPrincipal(topups) {
  return (Array.isArray(topups) ? topups : []).reduce((s, t) => s + (Number(t?.topupAmount) || 0), 0)
}

export function sumTopupMonthlyInterest(topups) {
  return (Array.isArray(topups) ? topups : []).reduce((s, t) => s + toMonthlyAmount(t?.interestAmount, t?.freq), 0)
}

// เงินต้นตามสัญญา + วงเงินเพิ่มทั้งหมดของลูกค้ารายนั้น
export function principalWithTopups(customer) {
  return (Number(customer?.principal) || 0) + (Number(customer?.topupPrincipal) || 0)
}

// จัดกลุ่มรายการวงเงินเพิ่มตามรหัสลูกค้า → { [customerId]: Topup[] }
export function groupTopupsByCustomer(topups) {
  const grouped = {}
  for (const t of Array.isArray(topups) ? topups : []) {
    const key = String(t?.customerId ?? '')
    if (!key) continue
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(t)
  }
  return grouped
}

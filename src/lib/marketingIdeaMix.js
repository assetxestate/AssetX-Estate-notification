export const redemptionIdeas = [
  ['redemption-documents', 'ก่อนขายฝากที่ดิน เตรียมเอกสารอะไรบ้าง', 'เตรียมข้อมูลผู้ถือกรรมสิทธิ์ เอกสารสิทธิ์และภาระผูกพัน โดยปิดข้อมูลส่วนบุคคลก่อนส่งประเมิน'],
  ['redemption-budget', 'ก่อนขายฝาก วางแผนเงินสำหรับไถ่ถอนอย่างไร', 'ทบทวนแหล่งเงิน ระยะเวลา และค่าใช้จ่ายจากสัญญาจริงก่อนตัดสินใจ'],
  ['redemption-questions', 'ขายฝากครั้งแรก ควรถามอะไรให้ชัด', 'รวบรวมคำถามเรื่องเงื่อนไข ค่าใช้จ่าย วันครบกำหนด และขั้นตอนการไถ่ถอน'],
  ['redemption-valuation', 'ทำเลและข้อมูลทรัพย์เกี่ยวข้องกับการประเมินขายฝากอย่างไร', 'อธิบายข้อมูลที่ใช้พิจารณาเป็นรายกรณี ไม่รับประกันวงเงินหรือการอนุมัติ'],
].map(([id, title, angle]) => ({
  id, title, angle, pillar: 'redemption', source: 'Brand Brain', type: 'ความรู้ขายฝาก',
  score: 85, audience: 'เจ้าของทรัพย์ที่พิจารณาขายฝาก', channel: 'Facebook', status: 'พร้อมทำ',
}))

export function isRedemptionIdea(idea) {
  return idea.pillar === 'redemption' || /ขายฝาก|ไถ่ถอน|สินไถ่/.test(idea.title || '')
}

// Keep every idea available; apply the 7:3 mix while both pools have supply.
export function prioritizeMarketingIdeas(ideas) {
  const ranked = [...ideas].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
  const primary = ranked.filter(isRedemptionIdea)
  const secondary = ranked.filter(idea => !isRedemptionIdea(idea))
  const pattern = [true, true, false, true, true, false, true, true, false, true]
  const result = []
  let first = 0
  let second = 0
  while (first < primary.length || second < secondary.length) {
    const preferPrimary = pattern[result.length % pattern.length]
    if ((preferPrimary && first < primary.length) || second >= secondary.length) result.push(primary[first++])
    else result.push(secondary[second++])
  }
  return result
}

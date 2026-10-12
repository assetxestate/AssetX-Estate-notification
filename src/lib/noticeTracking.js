export const NOTICE_STATUSES = {
  prepared: 'เตรียมหนังสือ',
  sent: 'ส่ง Notice แล้ว · รอยืนยันรับ',
  delivered: 'มีหลักฐานรับหนังสือแล้ว',
  returned: 'หนังสือตีกลับ',
}

export function validateNotice(input) {
  const result = {}
  if (!NOTICE_STATUSES[input.status]) throw new Error('กรุณาเลือกสถานะ Notice')
  result.status = input.status
  for (const key of ['sentDate', 'deliveredDate', 'receiptDate', 'paidDate']) {
    const value = input[key] || ''
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) {
      throw new Error('วันที่ไม่ถูกต้อง')
    }
    result[key] = value
  }
  for (const key of ['channel', 'trackingNumber', 'deliveryEvidence', 'receiptNumber', 'issuer', 'expenseDescription', 'notes']) {
    if (input[key] != null && typeof input[key] !== 'string') throw new Error('รูปแบบข้อความไม่ถูกต้อง')
    result[key] = (input[key] || '').trim()
    if (result[key].length > 2000) throw new Error('ข้อความยาวเกิน 2,000 ตัวอักษร')
  }
  if (result.status === 'delivered' && (!result.deliveredDate || !result.deliveryEvidence)) throw new Error('กรุณาระบุวันที่รับและหลักฐานการรับหนังสือ')
  if (result.status !== 'delivered' && (result.deliveredDate || result.deliveryEvidence)) throw new Error('ข้อมูลรับหนังสือต้องใช้กับสถานะมีหลักฐานรับแล้ว')
  if (result.sentDate && result.deliveredDate && result.deliveredDate < result.sentDate) throw new Error('วันที่รับต้องไม่ก่อนวันที่ส่ง')
  result.amount = input.amount === '' || input.amount == null ? null : Number(input.amount)
  if (result.amount !== null && (!Number.isFinite(result.amount) || result.amount < 0 || result.amount > 10000000 || Math.abs(result.amount * 100 - Math.round(result.amount * 100)) > 0.00001)) throw new Error('ค่าใช้จ่ายต้องเป็นจำนวนไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง')
  if (!['unknown', 'unpaid', 'paid'].includes(input.paymentStatus)) throw new Error('สถานะค่าใช้จ่ายไม่ถูกต้อง')
  result.paymentStatus = input.paymentStatus
  if (result.paymentStatus === 'paid' && (!result.paidDate || result.amount === null)) throw new Error('กรุณาระบุยอดและวันที่ชำระค่าใช้จ่าย')
  if (result.paymentStatus !== 'paid' && result.paidDate) throw new Error('วันที่ชำระใช้ได้เมื่อสถานะชำระแล้วเท่านั้น')
  return result
}

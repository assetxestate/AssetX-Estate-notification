import { calculateIndividualWht } from './transactionCostEngine.js'

const validAmount = value => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) >= 0
const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// Registration-day WHT, not the investor's annual income-tax liability.
export function calculateRefinanceWithholding(form, assessedValue) {
  const calculate = side => {
    const mode = form[`${side}WithholdingMode`] || 'manual'
    const key = `${side}Withholding`
    if (mode === 'manual') return validAmount(form[key])
      ? { ready: true, tax: Number(form[key]), errors: {} }
      : { ready: false, errors: { [key]: 'กรอกภาษีที่ต้องนำมารวม หรือ 0 เมื่อไม่ใช้ทุนใหม่จ่าย' } }
    const errors = {}
    const expectedMode = side === 'old' ? 'individual' : 'individual_same_day'
    if (mode !== expectedMode) errors[`${side}WithholdingMode`] = 'กรุณาเลือกวิธีคำนวณภาษี'
    if (!validAmount(assessedValue) || Number(assessedValue) <= 0) errors[key] = 'รอราคาประเมินราชการรวมที่ถูกต้อง'
    if (!validDate(form.transferDate)) errors.transferDate = 'ระบุวันจดทะเบียนไถ่และย้ายทุน'
    if (!validDate(form.startDate)) errors.startDate = 'ระบุวันจดทะเบียนขายฝากเดิม'
    if (!validDate(form.endDate)) errors.endDate = 'ระบุวันครบกำหนดตามสัญญา'
    if (validDate(form.startDate) && validDate(form.transferDate) && form.transferDate <= form.startDate) errors.transferDate = 'วันไถ่ต้องหลังวันรับซื้อฝาก'
    if (validDate(form.endDate) && validDate(form.transferDate) && form.transferDate > form.endDate) errors.transferDate = 'ไถ่เกินกำหนด: ให้ตรวจสิทธิและกรอกภาษีที่สำนักงานที่ดินยืนยัน'
    if (Object.keys(errors).length) return { ready: false, errors }
    const years = side === 'old' ? Math.min(10, Number(form.transferDate.slice(0, 4)) - Number(form.startDate.slice(0, 4)) + 1) : 1
    const detail = calculateIndividualWht({ assessedValue: Number(assessedValue), ownershipYears: years, acquisitionType: 'other' })
    return { ready: true, tax: detail.tax, years, detail, errors: {} }
  }
  return { old: calculate('old'), new: calculate('new') }
}

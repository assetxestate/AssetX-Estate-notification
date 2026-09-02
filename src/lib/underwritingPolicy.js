export const POLICY_TAGS = [
  'assetx',
  'underwriting',
  'secured-lending',
  'property-valuation',
]

export const RED_FLAG_CHECKS = [
  {
    key: 'hardAccess',
    label: 'เข้าถึงยาก / ซอยตัน',
    severity: 'medium',
    condition: 'ต้องตรวจสิทธิทางเข้า ถนนสาธารณะ และความสามารถขายทอดตลาด',
  },
  {
    key: 'irregularShape',
    label: 'รูปแปลงผิดปกติ',
    severity: 'medium',
    condition: 'ต้องดูแผนที่ระวาง รูปแปลง และ utility ของที่ดินจริง',
  },
  {
    key: 'encumbrance',
    label: 'มีภาระผูกพัน',
    severity: 'high',
    condition: 'ต้องเคลียร์ภาระเดิมและตรวจยอดไถ่ถอนก่อนอนุมัติ',
  },
  {
    key: 'dispute',
    label: 'มีข้อพิพาท / ครอบครอง',
    severity: 'critical',
    condition: 'หยุดอนุมัติจนกว่าจะตรวจข้อพิพาทและสิทธิครอบครองครบถ้วน',
  },
  {
    key: 'noUtilities',
    label: 'ไม่มีสาธารณูปโภค',
    severity: 'medium',
    condition: 'ลด liquidity และต้องสำรวจค่าใช้จ่ายพัฒนาเพิ่ม',
  },
  {
    key: 'nuisance',
    label: 'ติดสิ่งรบกวน',
    severity: 'medium',
    condition: 'ต้องสำรวจผลกระทบด้านราคาและเวลาขายออก',
  },
]

export const SALE_WITH_REDEMPTION_CHECKLIST = [
  'ยืนยันวันครบกำหนดไถ่ถอนและทำ reminder ล่วงหน้า 90/60/30/7/3 วัน',
  'ตรวจว่าการขยายกำหนดไถ่ถอนมีหลักฐานและจดทะเบียนถูกต้อง',
  'ตรวจว่าดอกเบี้ย/ผลตอบแทนรวมไม่เกินกรอบ 15% ต่อปี',
  'ตรวจถ้อยคำสัญญาไม่ให้ถูกตีความเป็นนิติกรรมอำพรางหรือกู้ยืมแฝง',
]

export const MORTGAGE_CHECKLIST = [
  'ตรวจยอดภาระจำนองเดิมและลำดับบุริมสิทธิ',
  'เตรียมกรอบบอกกล่าว/ติดตามก่อนบังคับจำนองอย่างน้อย 60 วันตาม workflow ภายใน',
  'ตรวจเจ้าของกรรมสิทธิ์ ผู้ให้ความยินยอม และเอกสารแนบท้ายสัญญา',
]

function severityRank(severity) {
  return { low: 1, medium: 2, high: 3, critical: 4 }[severity] || 1
}

function pickDecision({ criticalCount, highCount, riskScore, requestedLoan, recommendedLoan, missingFields }) {
  if (criticalCount > 0) return { status: 'Hold / Legal DD', color: '#EF4444', reason: 'พบ red flag ระดับ critical ต้องหยุดเพื่อ DD ก่อน' }
  if (requestedLoan > 0 && recommendedLoan > 0 && requestedLoan > recommendedLoan) {
    return { status: 'Reduce Exposure', color: '#F97316', reason: 'วงเงินที่ขอสูงกว่าวงเงินแนะนำจาก FSV/LTV' }
  }
  if (riskScore >= 70 || highCount > 1) return { status: 'Decline / Committee Review', color: '#EF4444', reason: 'ความเสี่ยงสูงมาก ต้องเข้าคณะพิจารณาหรือปฏิเสธ' }
  if (riskScore >= 50 || highCount > 0 || missingFields.length >= 3) return { status: 'Conditional Approve', color: '#F59E0B', reason: 'อนุมัติได้เฉพาะเมื่อปิดเงื่อนไขสำคัญครบ' }
  return { status: 'Proceed with Conditions', color: '#10B981', reason: 'ความเสี่ยงอยู่ในกรอบ แต่ยังต้องตรวจเอกสารมาตรฐาน' }
}

export function buildUnderwritingPolicy(form = {}, calc = {}, nearbyPricePoints = []) {
  const missingFields = [
    !form.lat || !form.lng ? 'พิกัดทรัพย์' : '',
    !form.compPrice ? 'ราคา Comp/ตลาดจริง' : '',
    !form.roadWidth ? 'ความกว้างถนน' : '',
    !form.zoneColor ? 'ผังเมือง' : '',
    !form.requestedLoan ? 'วงเงินที่ลูกค้าขอ' : '',
  ].filter(Boolean)

  const activeFlags = RED_FLAG_CHECKS.filter((flag) => form.risks?.[flag.key])

  if (form.floodLevel && form.floodLevel !== 'ไม่มีประวัติน้ำท่วม') {
    activeFlags.push({
      key: 'floodLevel',
      label: form.floodLevel,
      severity: form.floodLevel.includes('รุนแรง') || form.floodLevel.includes('บ่อย') ? 'high' : 'medium',
      condition: 'ต้องตรวจประวัติน้ำท่วม แผนระบายน้ำ และ discount เพิ่มใน FSV',
    })
  }

  if (form.titleType && form.titleType !== 'โฉนด (Chanote) ปลอดภาระ') {
    activeFlags.push({
      key: 'titleType',
      label: form.titleType,
      severity: form.titleType.includes('พิพาท') || form.titleType.includes('ภาระ') ? 'high' : 'medium',
      condition: 'ต้องตรวจเอกสารสิทธิ์และข้อจำกัดการโอน/บังคับหลักประกัน',
    })
  }

  const requestedLoan = Number(form.requestedLoan) || 0
  const recommendedLoan = Number(calc.recommendedLoan) || 0
  const riskScore = Number(calc.riskScore) || 0
  const criticalCount = activeFlags.filter((flag) => flag.severity === 'critical').length
  const highCount = activeFlags.filter((flag) => flag.severity === 'high').length
  const decision = pickDecision({ criticalCount, highCount, riskScore, requestedLoan, recommendedLoan, missingFields })

  const safeExposure = Math.round(Math.min(
    Number(calc.fsv || 0) * 0.35,
    recommendedLoan > 0 ? recommendedLoan * 0.8 : Number(calc.fsv || 0) * 0.35
  ))
  const maximumExposure = Math.round(Math.min(
    Number(calc.fsv || 0) * ((calc.riskBand?.ltvMax || 50) / 100),
    Number(calc.marketValue || 0) * 0.65
  ))

  const baseConditions = [
    'ตรวจโฉนด/สารบัญจดทะเบียน ณ สำนักงานที่ดินก่อนวันโอน',
    'ตรวจบุคคลผู้มีกรรมสิทธิ์ คู่สมรส ผู้ยินยอม และผู้ครอบครองจริง',
    'ตรวจราคาตลาดอย่างน้อย 2-3 แหล่ง และบันทึก source URL/วันที่ค้น',
    'ถ่ายภาพทรัพย์ ทางเข้า ถนนหน้าแปลง และสภาพแวดล้อมก่อนเสนออนุมัติ',
  ]

  const contractChecklist = form.assessmentType === 'จำนอง'
    ? MORTGAGE_CHECKLIST
    : SALE_WITH_REDEMPTION_CHECKLIST

  const conditions = [
    ...baseConditions,
    ...contractChecklist,
    ...activeFlags.map((flag) => flag.condition),
    ...missingFields.map((field) => `เติมข้อมูลที่ยังขาด: ${field}`),
  ]

  const sortedFlags = [...activeFlags].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))

  return {
    decision,
    missingFields,
    activeFlags: sortedFlags,
    conditions: [...new Set(conditions)],
    exposureBands: {
      safe: safeExposure,
      recommended: Math.round(recommendedLoan),
      maximum: maximumExposure,
    },
    marketContext: {
      nearbyPricePointCount: nearbyPricePoints.length,
      compSource: form.compSource || '',
      hasManualComp: Boolean(form.compPrice),
      needsResearchRefresh: !form.compPrice || nearbyPricePoints.length === 0,
    },
    educationNotes: [
      'ขายฝากโอนกรรมสิทธิ์ทันทีและต้องไถ่ถอนในกำหนด ส่วนจำนองยังไม่โอนกรรมสิทธิ์แต่ต้องบังคับตามกระบวนการ',
      'ข้อความสื่อสารลูกค้าควรเป็นข้อมูลทั่วไป ไม่ใช่คำแนะนำกฎหมายเฉพาะราย',
    ],
    tags: POLICY_TAGS,
  }
}

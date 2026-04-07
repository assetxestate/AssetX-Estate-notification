import React, { useState, useMemo } from 'react'

const BRAND = {
  teal: '#2DD4BF', gold: '#F59E0B', bg: '#050B18', bgCard: '#0D1B2E',
  border: '#0F2545', borderLt: '#162E56', textPri: '#F0F6FF',
  textSec: '#64748B', textMut: '#475569', success: '#10B981',
  danger: '#EF4444', purple: '#7C3AED', orange: '#F97316',
}

const fmtMoney = (n) => {
  if (!n || isNaN(n)) return '0'
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const num = (v) => parseFloat(String(v).replace(/,/g, '')) || 0

// ── อัตราภาษีเงินได้บุคคลธรรมดา ──────────────────────────
const PIT_BRACKETS = [
  { max: 150000, rate: 0 },
  { max: 300000, rate: 0.05 },
  { max: 500000, rate: 0.10 },
  { max: 750000, rate: 0.15 },
  { max: 1000000, rate: 0.20 },
  { max: 2000000, rate: 0.25 },
  { max: 5000000, rate: 0.30 },
  { max: Infinity, rate: 0.35 },
]

function calcPIT(income) {
  if (income <= 0) return 0
  let tax = 0
  let prev = 0
  for (const bracket of PIT_BRACKETS) {
    if (income <= prev) break
    const taxable = Math.min(income, bracket.max) - prev
    tax += taxable * bracket.rate
    prev = bracket.max
  }
  return tax
}

// % หักค่าใช้จ่ายตามปีที่ถือครอง (กฎกระทรวง)
const DEDUCTION_BY_YEAR = {
  1: 0.50, 2: 0.55, 3: 0.60, 4: 0.65, 5: 0.70,
  6: 0.75, 7: 0.80, 8: 0.85,
}
function getDeductionRate(years) {
  const y = Math.min(Math.max(Math.floor(years), 1), 8)
  return DEDUCTION_BY_YEAR[y]
}

// ── คำนวณภาษีเงินได้หัก ณ ที่จ่าย (บุคคลธรรมดา) ──────────
function calcWithholdingTax(assessedValue, years) {
  if (assessedValue <= 0 || years <= 0) return 0
  const y = Math.min(Math.max(Math.floor(years), 1), 8)
  const deductRate = getDeductionRate(y)
  const netIncome = assessedValue * (1 - deductRate)
  const annualIncome = netIncome / y
  const annualTax = calcPIT(annualIncome)
  return annualTax * y
}

// ── ประเภทธุรกรรม ──────────────────────────────────────────
const TRANSACTION_TYPES = [
  { value: 'sale', label: 'ซื้อ-ขาย', icon: '🤝', color: BRAND.teal },
  { value: 'mortgage', label: 'จำนอง', icon: '🏛️', color: BRAND.purple },
  { value: 'sale_redeem', label: 'ขายฝาก', icon: '🔒', color: BRAND.gold },
  { value: 'rental', label: 'ให้เช่า', icon: '🏠', color: BRAND.orange },
  { value: 'inheritance', label: 'รับมรดก / รับให้', icon: '📜', color: BRAND.success },
]

// ── Input Component ──────────────────────────────────────────
function TaxInput({ label, value, onChange, hint, prefix = '฿', unit, type = 'number' }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, color: BRAND.textSec, marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', background: '#0A1628', border: `1px solid ${BRAND.border}`, borderRadius: 8, overflow: 'hidden' }}>
        {prefix && (
          <span style={{ padding: '0 12px', color: BRAND.textMut, fontSize: 13, background: '#060E1C', borderRight: `1px solid ${BRAND.border}`, height: '100%', display: 'flex', alignItems: 'center', minWidth: 32, justifyContent: 'center' }}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: BRAND.textPri, padding: '10px 12px', fontSize: 14 }}
          min={0}
        />
        {unit && (
          <span style={{ padding: '0 12px', color: BRAND.textMut, fontSize: 12 }}>{unit}</span>
        )}
      </div>
      {hint && <div style={{ fontSize: 11, color: BRAND.textMut, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

// ── Select Component ─────────────────────────────────────────
function TaxSelect({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, color: BRAND.textSec, marginBottom: 6 }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', background: '#0A1628', border: `1px solid ${BRAND.border}`, borderRadius: 8, color: BRAND.textPri, padding: '10px 12px', fontSize: 14, outline: 'none' }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: BRAND.bgCard }}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ── แถวผลลัพธ์ภาษี ───────────────────────────────────────────
function TaxRow({ label, amount, color, sub, bold, isTotal }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: isTotal ? '14px 0 0 0' : '10px 0',
      borderTop: isTotal ? `1px solid ${BRAND.borderLt}` : undefined,
      borderBottom: !isTotal ? `1px solid rgba(15,37,69,0.5)` : undefined,
    }}>
      <div>
        <div style={{ fontSize: bold || isTotal ? 13 : 12, color: isTotal ? BRAND.textPri : BRAND.textSec, fontWeight: bold || isTotal ? 700 : 400 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: BRAND.textMut, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: isTotal ? 18 : 13, fontWeight: isTotal ? 800 : 500, color: color || (isTotal ? BRAND.teal : BRAND.textPri), textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
        ฿{fmtMoney(amount)}
      </div>
    </div>
  )
}

// ── Tag หมายเหตุ ─────────────────────────────────────────────
function Note({ text, color }) {
  return (
    <div style={{ background: `${color || BRAND.gold}18`, border: `1px solid ${color || BRAND.gold}40`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: color || BRAND.gold, marginTop: 12, lineHeight: 1.6 }}>
      💡 {text}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
//  คำนวณ: ซื้อ-ขาย
// ────────────────────────────────────────────────────────────
function SaleCalc() {
  const [sellingPrice, setSellingPrice] = useState('')
  const [assessedLand, setAssessedLand] = useState('')
  const [assessedBuilding, setAssessedBuilding] = useState('')
  const [years, setYears] = useState('1')
  const [isPrimary, setIsPrimary] = useState('no')
  const [sellerType, setSellerType] = useState('individual')
  const [primaryYears, setPrimaryYears] = useState('1')

  const result = useMemo(() => {
    const sp = num(sellingPrice)
    const aLand = num(assessedLand)
    const aBuilding = num(assessedBuilding)
    const assessed = aLand + aBuilding
    const baseValue = Math.max(sp, assessed)
    const yrs = num(years)
    const pYrs = num(primaryYears)

    if (assessed === 0 && sp === 0) return null

    // ค่าธรรมเนียมการโอน 2% ของราคาประเมิน
    const transferFee = assessed * 0.02

    // SBT เงื่อนไข: ถือครอง < 5 ปี หรือ ไม่ได้เป็นที่อยู่อาศัยหลักครบ 1 ปี
    let useSBT = false
    if (sellerType === 'company') {
      useSBT = true
    } else {
      const heldLessThan5 = yrs < 5
      const notPrimaryOver1Year = isPrimary === 'no' || pYrs < 1
      useSBT = heldLessThan5 || notPrimaryOver1Year
    }

    // ภาษีธุรกิจเฉพาะ 3.3% (รวมภาษีท้องถิ่น 0.3%)
    const sbt = useSBT ? baseValue * 0.033 : 0
    // อากรแสตมป์ 0.5% (เฉพาะกรณียกเว้น SBT)
    const stampDuty = !useSBT ? baseValue * 0.005 : 0

    // ภาษีเงินได้หัก ณ ที่จ่าย
    let withholdingTax = 0
    if (sellerType === 'individual') {
      withholdingTax = calcWithholdingTax(assessed > 0 ? assessed : sp, yrs)
    } else {
      // นิติบุคคล: 1% ของราคาขายหรือราคาประเมิน แล้วแต่สูงกว่า
      withholdingTax = baseValue * 0.01
    }

    const totalTax = transferFee + sbt + stampDuty + withholdingTax

    return {
      assessed, baseValue, transferFee, sbt, stampDuty, withholdingTax, totalTax,
      useSBT, sellerType,
      deductRate: sellerType === 'individual' ? getDeductionRate(yrs) : null,
    }
  }, [sellingPrice, assessedLand, assessedBuilding, years, isPrimary, sellerType, primaryYears])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) minmax(280px,1fr)', gap: 20 }}>
      {/* ── ฝั่งซ้าย: Input ── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.teal, marginBottom: 16 }}>ข้อมูลการซื้อ-ขาย</div>
        <TaxInput label="ราคาซื้อขาย (ตามสัญญา)" value={sellingPrice} onChange={setSellingPrice} hint="ราคาที่ตกลงซื้อขายจริง" />
        <TaxInput label="ราคาประเมินที่ดิน (กรมธนารักษ์)" value={assessedLand} onChange={setAssessedLand} hint="ดูจากสำนักงานที่ดินหรือเว็บไซต์กรมธนารักษ์" />
        <TaxInput label="ราคาประเมินสิ่งปลูกสร้าง" value={assessedBuilding} onChange={setAssessedBuilding} hint="0 ถ้าเป็นที่ดินเปล่า" />
        <TaxSelect label="ผู้ขาย" value={sellerType} onChange={setSellerType} options={[
          { value: 'individual', label: 'บุคคลธรรมดา' },
          { value: 'company', label: 'นิติบุคคล / บริษัท' },
        ]} />
        {sellerType === 'individual' && (
          <>
            <TaxInput label="จำนวนปีที่ถือครอง" value={years} onChange={setYears} prefix="" unit="ปี" hint="นับตั้งแต่วันที่ได้มา (สูงสุด 8 ปีสำหรับการคำนวณภาษี)" />
            <TaxSelect label="เป็นที่อยู่อาศัยหลัก?" value={isPrimary} onChange={setIsPrimary} options={[
              { value: 'no', label: 'ไม่ใช่ที่อยู่อาศัยหลัก' },
              { value: 'yes', label: 'ใช่ที่อยู่อาศัยหลัก' },
            ]} />
            {isPrimary === 'yes' && (
              <TaxInput label="ถือครองเป็นที่อยู่อาศัยหลักมาแล้ว" value={primaryYears} onChange={setPrimaryYears} prefix="" unit="ปี" hint="ต้องครบ 1 ปีจึงจะยกเว้น SBT" />
            )}
          </>
        )}
      </div>

      {/* ── ฝั่งขวา: ผลลัพธ์ ── */}
      <div>
        {result ? (
          <>
            <div className="card" style={{ padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.teal, marginBottom: 16 }}>ผลการคำนวณภาษีและค่าธรรมเนียม</div>
              <div style={{ fontSize: 11, color: BRAND.textMut, marginBottom: 4 }}>ฐานราคาประเมินรวม</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: BRAND.textPri, marginBottom: 16 }}>
                ฿{fmtMoney(result.assessed)} <span style={{ fontSize: 12, color: BRAND.textMut }}>/ ฐานเปรียบเทียบ ฿{fmtMoney(result.baseValue)}</span>
              </div>

              <TaxRow
                label="ค่าธรรมเนียมการโอนกรรมสิทธิ์"
                sub="2% ของราคาประเมินรวม — แบ่งจ่ายผู้ซื้อ/ขายตามตกลง"
                amount={result.transferFee}
              />
              {result.useSBT ? (
                <TaxRow
                  label="ภาษีธุรกิจเฉพาะ (SBT)"
                  sub="3.3% (รวม 0.3% ภาษีท้องถิ่น) ของราคาสูงสุด — ผู้ขายเป็นผู้ชำระ"
                  amount={result.sbt}
                  color={BRAND.orange}
                />
              ) : (
                <TaxRow
                  label="อากรแสตมป์"
                  sub="0.5% ของราคาสูงสุด — ได้รับยกเว้น SBT"
                  amount={result.stampDuty}
                />
              )}
              <TaxRow
                label={result.sellerType === 'company' ? 'ภาษีเงินได้หัก ณ ที่จ่าย (นิติบุคคล)' : 'ภาษีเงินได้หัก ณ ที่จ่าย (บุคคลธรรมดา)'}
                sub={result.sellerType === 'individual' && result.deductRate
                  ? `หักค่าใช้จ่าย ${(result.deductRate * 100).toFixed(0)}% → คำนวณตามอัตราก้าวหน้า`
                  : '1% ของราคาสูงสุด'}
                amount={result.withholdingTax}
                color={BRAND.purple}
              />
              <TaxRow label="รวมค่าใช้จ่ายทั้งหมด" amount={result.totalTax} isTotal />
            </div>
            <Note text={result.useSBT
              ? 'ต้องจ่ายภาษีธุรกิจเฉพาะ เนื่องจากถือครองไม่ถึง 5 ปี หรือไม่ได้ใช้เป็นที่อยู่อาศัยหลักครบ 1 ปี'
              : 'ได้รับยกเว้นภาษีธุรกิจเฉพาะ จ่ายอากรแสตมป์แทน เนื่องจากถือครองครบ 5 ปี หรือใช้เป็นที่อยู่อาศัยหลักครบ 1 ปี'}
            />
          </>
        ) : (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🧮</div>
            <div style={{ color: BRAND.textMut, fontSize: 13 }}>กรอกข้อมูลเพื่อคำนวณภาษี</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
//  คำนวณ: จำนอง
// ────────────────────────────────────────────────────────────
function MortgageCalc() {
  const [mortgageAmount, setMortgageAmount] = useState('')
  const [loanAmount, setLoanAmount] = useState('')

  const result = useMemo(() => {
    const ma = num(mortgageAmount)
    const la = num(loanAmount) || ma
    if (ma === 0) return null

    // ค่าธรรมเนียมจดจำนอง 1% สูงสุด 200,000 บาท
    const regFee = Math.min(ma * 0.01, 200000)
    // อากรแสตมป์สัญญากู้ 0.05% สูงสุด 10,000 บาท
    const stampDuty = Math.min(la * 0.0005, 10000)
    const total = regFee + stampDuty

    return { regFee, stampDuty, total, ma, la }
  }, [mortgageAmount, loanAmount])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) minmax(280px,1fr)', gap: 20 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.purple, marginBottom: 16 }}>ข้อมูลการจำนอง</div>
        <TaxInput label="วงเงินจำนอง" value={mortgageAmount} onChange={setMortgageAmount} hint="วงเงินที่จดจำนองที่สำนักงานที่ดิน" />
        <TaxInput label="วงเงินกู้ยืม (ถ้าต่างจากวงเงินจำนอง)" value={loanAmount} onChange={setLoanAmount} hint="ปล่อยว่างหากเท่ากับวงเงินจำนอง" />
      </div>
      <div>
        {result ? (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.purple, marginBottom: 16 }}>ผลการคำนวณ</div>
            <TaxRow label="ค่าธรรมเนียมจดจำนอง" sub={`1% ของวงเงินจำนอง (สูงสุด ฿200,000)${result.ma * 0.01 > 200000 ? ' — คิดสูงสุดแล้ว' : ''}`} amount={result.regFee} color={BRAND.purple} />
            <TaxRow label="อากรแสตมป์สัญญากู้" sub={`0.05% ของวงเงินกู้ (สูงสุด ฿10,000)${result.la * 0.0005 > 10000 ? ' — คิดสูงสุดแล้ว' : ''}`} amount={result.stampDuty} />
            <TaxRow label="รวมค่าใช้จ่าย" amount={result.total} isTotal />
          </div>
        ) : (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏛️</div>
            <div style={{ color: BRAND.textMut, fontSize: 13 }}>กรอกวงเงินจำนองเพื่อคำนวณ</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
//  คำนวณ: ขายฝาก
// ────────────────────────────────────────────────────────────
function SaleRedeemCalc() {
  const [sellingPrice, setSellingPrice] = useState('')
  const [assessedLand, setAssessedLand] = useState('')
  const [assessedBuilding, setAssessedBuilding] = useState('')
  const [years, setYears] = useState('1')

  const result = useMemo(() => {
    const sp = num(sellingPrice)
    const aLand = num(assessedLand)
    const aBuilding = num(assessedBuilding)
    const assessed = aLand + aBuilding
    const baseValue = Math.max(sp, assessed)
    const yrs = num(years)

    if (assessed === 0 && sp === 0) return null

    // ขายฝากถือว่าเป็น SBT เสมอ (ไม่ยกเว้น)
    const transferFee = assessed * 0.02
    const sbt = baseValue * 0.033
    const withholdingTax = calcWithholdingTax(assessed > 0 ? assessed : sp, yrs)
    const total = transferFee + sbt + withholdingTax

    // ค่าธรรมเนียมสัญญาขายฝาก (ไม่มีอากรแสตมป์เพิ่มเติม เพราะจ่าย SBT แล้ว)
    return { assessed, baseValue, transferFee, sbt, withholdingTax, total, deductRate: getDeductionRate(yrs) }
  }, [sellingPrice, assessedLand, assessedBuilding, years])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) minmax(280px,1fr)', gap: 20 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 16 }}>ข้อมูลการขายฝาก</div>
        <TaxInput label="ราคาขายฝาก" value={sellingPrice} onChange={setSellingPrice} />
        <TaxInput label="ราคาประเมินที่ดิน" value={assessedLand} onChange={setAssessedLand} />
        <TaxInput label="ราคาประเมินสิ่งปลูกสร้าง" value={assessedBuilding} onChange={setAssessedBuilding} hint="0 ถ้าเป็นที่ดินเปล่า" />
        <TaxInput label="จำนวนปีที่ถือครอง (ก่อนขายฝาก)" value={years} onChange={setYears} prefix="" unit="ปี" hint="นับตั้งแต่ได้กรรมสิทธิ์มา" />
      </div>
      <div>
        {result ? (
          <>
            <div className="card" style={{ padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 16 }}>ผลการคำนวณ</div>
              <div style={{ fontSize: 11, color: BRAND.textMut, marginBottom: 12 }}>ราคาประเมินรวม ฿{fmtMoney(result.assessed)} / ฐานเปรียบเทียบ ฿{fmtMoney(result.baseValue)}</div>
              <TaxRow label="ค่าธรรมเนียมการโอน" sub="2% ของราคาประเมินรวม" amount={result.transferFee} />
              <TaxRow label="ภาษีธุรกิจเฉพาะ (SBT)" sub="3.3% — ขายฝากต้องจ่าย SBT เสมอ" amount={result.sbt} color={BRAND.orange} />
              <TaxRow label="ภาษีเงินได้หัก ณ ที่จ่าย" sub={`หักค่าใช้จ่าย ${(result.deductRate * 100).toFixed(0)}% → คำนวณอัตราก้าวหน้า`} amount={result.withholdingTax} color={BRAND.purple} />
              <TaxRow label="รวมค่าใช้จ่าย" amount={result.total} isTotal />
            </div>
            <Note text="การขายฝากต้องเสีย SBT เสมอ เนื่องจากถือเป็นการโอนกรรมสิทธิ์เชิงธุรกิจ" color={BRAND.gold} />
          </>
        ) : (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
            <div style={{ color: BRAND.textMut, fontSize: 13 }}>กรอกข้อมูลเพื่อคำนวณ</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
//  คำนวณ: ให้เช่า
// ────────────────────────────────────────────────────────────
function RentalCalc() {
  const [monthlyRent, setMonthlyRent] = useState('')
  const [rentalMonths, setRentalMonths] = useState('12')
  const [propertyType, setPropertyType] = useState('building')

  const result = useMemo(() => {
    const rent = num(monthlyRent)
    const months = num(rentalMonths)
    if (rent === 0 || months === 0) return null

    const totalRent = rent * months

    // อากรแสตมป์สัญญาเช่า: 1 บาทต่อ 1,000 บาท (0.1%) ปัดขึ้นทุก 1,000 บาท
    const stampDutyRaw = totalRent * 0.001
    const stampDuty = Math.ceil(stampDutyRaw) // ปัดขึ้น

    // ภาษีเงินได้: หักค่าใช้จ่าย 30% (อาคาร) หรือ 20% (ที่ดิน)
    const expenseDeductRate = propertyType === 'building' ? 0.30 : 0.20
    const annualRent = (rent * 12)
    const annualNet = annualRent * (1 - expenseDeductRate)
    // ลดหย่อนส่วนตัว 60,000 บาท (ประมาณการ)
    const taxableAnnual = Math.max(annualNet - 60000, 0)
    const annualPIT = calcPIT(taxableAnnual)

    const total = stampDuty + annualPIT

    return { totalRent, stampDuty, annualPIT, total, expenseDeductRate, annualNet, months }
  }, [monthlyRent, rentalMonths, propertyType])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) minmax(280px,1fr)', gap: 20 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.orange, marginBottom: 16 }}>ข้อมูลการเช่า</div>
        <TaxInput label="ค่าเช่า / เดือน" value={monthlyRent} onChange={setMonthlyRent} />
        <TaxInput label="ระยะเวลาสัญญาเช่า" value={rentalMonths} onChange={setRentalMonths} prefix="" unit="เดือน" />
        <TaxSelect label="ประเภทอสังหาริมทรัพย์" value={propertyType} onChange={setPropertyType} options={[
          { value: 'building', label: 'อาคาร / สิ่งปลูกสร้าง (หักค่าใช้จ่าย 30%)' },
          { value: 'land', label: 'ที่ดินเปล่า (หักค่าใช้จ่าย 20%)' },
        ]} />
      </div>
      <div>
        {result ? (
          <>
            <div className="card" style={{ padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.orange, marginBottom: 16 }}>ผลการคำนวณ</div>
              <div style={{ fontSize: 11, color: BRAND.textMut, marginBottom: 12 }}>ค่าเช่าตลอดสัญญา ฿{fmtMoney(result.totalRent)} ({result.months} เดือน)</div>
              <TaxRow label="อากรแสตมป์สัญญาเช่า" sub="0.1% ของค่าเช่าตลอดสัญญา (ปัดขึ้น)" amount={result.stampDuty} />
              <TaxRow label="ภาษีเงินได้จากค่าเช่า (ประมาณการ/ปี)" sub={`หักค่าใช้จ่าย ${(result.expenseDeductRate * 100).toFixed(0)}% → รายได้สุทธิ ฿${fmtMoney(result.annualNet)}/ปี`} amount={result.annualPIT} color={BRAND.purple} />
              <TaxRow label="รวมค่าใช้จ่าย" amount={result.total} isTotal />
            </div>
            <Note text="ภาษีเงินได้แสดงเป็นประมาณการต่อปี หักลดหย่อนส่วนตัว 60,000 บาท ค่าจริงขึ้นอยู่กับรายได้และการลดหย่อนทั้งหมดของผู้เสียภาษี" color={BRAND.orange} />
          </>
        ) : (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏠</div>
            <div style={{ color: BRAND.textMut, fontSize: 13 }}>กรอกข้อมูลเพื่อคำนวณ</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
//  คำนวณ: รับมรดก / รับให้
// ────────────────────────────────────────────────────────────
function InheritanceCalc() {
  const [assessedValue, setAssessedValue] = useState('')
  const [transType, setTransType] = useState('inherit_lineal')

  const result = useMemo(() => {
    const av = num(assessedValue)
    if (av === 0) return null

    let transferFeeRate, taxLabel, taxAmount, stampDuty = 0, notes = []

    if (transType === 'inherit_lineal') {
      // รับมรดก ทายาทโดยธรรม (บุพการี/ผู้สืบสันดาน/คู่สมรส)
      transferFeeRate = 0.005 // 0.5%
      // ภาษีการรับมรดก: 5% ส่วนที่เกิน 100 ล้านบาท
      taxLabel = 'ภาษีการรับมรดก (ทายาทโดยธรรม)'
      taxAmount = av > 100000000 ? (av - 100000000) * 0.05 : 0
      notes.push('ทายาทโดยธรรมได้รับยกเว้นภาษีมรดก ≤ 100 ล้านบาท')
      notes.push('ยกเว้นภาษีเงินได้บุคคลธรรมดา สำหรับทรัพย์สินที่ได้จากมรดก')
    } else if (transType === 'inherit_other') {
      // รับมรดก บุคคลอื่น (ไม่ใช่ทายาทโดยธรรม)
      transferFeeRate = 0.005
      taxLabel = 'ภาษีการรับมรดก (บุคคลอื่น)'
      taxAmount = av > 100000000 ? (av - 100000000) * 0.10 : 0
      notes.push('บุคคลอื่น (ไม่ใช่ทายาทโดยธรรม) เสียภาษีมรดกในอัตรา 10%')
    } else if (transType === 'gift_lineal') {
      // รับให้ระหว่างบุพการี-ผู้สืบสันดาน
      transferFeeRate = 0.005
      taxLabel = 'ภาษีเงินได้จากการรับให้ (บุพการี)'
      // ยกเว้น 20 ล้านบาทต่อปี ส่วนที่เกินเสีย 5%
      taxAmount = av > 20000000 ? (av - 20000000) * 0.05 : 0
      notes.push('ระหว่างบุพการี-ผู้สืบสันดาน ยกเว้น ≤ 20 ล้านบาท/ปี ส่วนที่เกินเสียภาษี 5%')
    } else if (transType === 'gift_spouse') {
      // รับให้ระหว่างสามี-ภรรยา
      transferFeeRate = 0.005
      taxLabel = 'ภาษีเงินได้จากการรับให้ (คู่สมรส)'
      taxAmount = av > 20000000 ? (av - 20000000) * 0.05 : 0
      notes.push('ระหว่างคู่สมรส ยกเว้น ≤ 20 ล้านบาท/ปี ส่วนที่เกินเสียภาษี 5%')
    } else {
      // รับให้ บุคคลทั่วไป
      transferFeeRate = 0.02
      taxLabel = 'ภาษีเงินได้จากการรับให้ (บุคคลทั่วไป)'
      taxAmount = av > 10000000 ? (av - 10000000) * 0.05 : 0
      notes.push('บุคคลทั่วไป ยกเว้น ≤ 10 ล้านบาท/ปี ส่วนที่เกินเสียภาษี 5%')
      notes.push('ค่าธรรมเนียมโอน 2% (ไม่ใช่ 0.5% เหมือนทายาท)')
    }

    const transferFee = av * transferFeeRate
    const total = transferFee + taxAmount + stampDuty

    return { transferFee, taxLabel, taxAmount, stampDuty, total, transferFeeRate, notes }
  }, [assessedValue, transType])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) minmax(280px,1fr)', gap: 20 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.success, marginBottom: 16 }}>ข้อมูลการรับมรดก / รับให้</div>
        <TaxSelect label="ประเภทการโอน" value={transType} onChange={setTransType} options={[
          { value: 'inherit_lineal', label: 'รับมรดก — ทายาทโดยธรรม (บุพการี/ผู้สืบสันดาน/คู่สมรส)' },
          { value: 'inherit_other', label: 'รับมรดก — บุคคลอื่น (ไม่ใช่ทายาทโดยธรรม)' },
          { value: 'gift_lineal', label: 'รับให้ — จากบุพการีหรือให้ผู้สืบสันดาน' },
          { value: 'gift_spouse', label: 'รับให้ — ระหว่างสามี-ภรรยา' },
          { value: 'gift_other', label: 'รับให้ — บุคคลทั่วไป' },
        ]} />
        <TaxInput label="ราคาประเมิน (กรมธนารักษ์)" value={assessedValue} onChange={setAssessedValue} hint="ใช้ราคาประเมินของกรมธนารักษ์เป็นฐาน" />
      </div>
      <div>
        {result ? (
          <>
            <div className="card" style={{ padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.success, marginBottom: 16 }}>ผลการคำนวณ</div>
              <TaxRow label="ค่าธรรมเนียมการโอน" sub={`${(result.transferFeeRate * 100).toFixed(1)}% ของราคาประเมิน`} amount={result.transferFee} />
              <TaxRow label={result.taxLabel} sub={result.taxAmount === 0 ? 'ไม่เกินเกณฑ์ยกเว้น' : 'ส่วนที่เกินเกณฑ์ยกเว้น'} amount={result.taxAmount} color={result.taxAmount > 0 ? BRAND.danger : BRAND.success} />
              <TaxRow label="รวมค่าใช้จ่าย" amount={result.total} isTotal />
            </div>
            {result.notes.map((n, i) => (
              <Note key={i} text={n} color={BRAND.success} />
            ))}
          </>
        ) : (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📜</div>
            <div style={{ color: BRAND.textMut, fontSize: 13 }}>กรอกข้อมูลเพื่อคำนวณ</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
//  ตารางอัตราภาษีอ้างอิง
// ────────────────────────────────────────────────────────────
function ReferenceTable() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 16 }}>
      {/* อัตราภาษีเงินได้ก้าวหน้า */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.teal, marginBottom: 14 }}>📊 อัตราภาษีเงินได้บุคคลธรรมดา (Progressive)</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', color: BRAND.textSec, padding: '4px 0', borderBottom: `1px solid ${BRAND.border}` }}>เงินได้สุทธิ</th>
              <th style={{ textAlign: 'right', color: BRAND.textSec, padding: '4px 0', borderBottom: `1px solid ${BRAND.border}` }}>อัตรา</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['0 – 150,000', '0%'],
              ['150,001 – 300,000', '5%'],
              ['300,001 – 500,000', '10%'],
              ['500,001 – 750,000', '15%'],
              ['750,001 – 1,000,000', '20%'],
              ['1,000,001 – 2,000,000', '25%'],
              ['2,000,001 – 5,000,000', '30%'],
              ['5,000,001 ขึ้นไป', '35%'],
            ].map(([range, rate], i) => (
              <tr key={i}>
                <td style={{ padding: '6px 0', color: BRAND.textPri, borderBottom: `1px solid ${BRAND.border}40` }}>{range}</td>
                <td style={{ padding: '6px 0', color: BRAND.teal, fontWeight: 700, textAlign: 'right', borderBottom: `1px solid ${BRAND.border}40` }}>{rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* อัตราหักค่าใช้จ่ายตามปีถือครอง */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.purple, marginBottom: 14 }}>📅 อัตราหักค่าใช้จ่ายตามปีถือครอง</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', color: BRAND.textSec, padding: '4px 0', borderBottom: `1px solid ${BRAND.border}` }}>ปีที่ถือครอง</th>
              <th style={{ textAlign: 'right', color: BRAND.textSec, padding: '4px 0', borderBottom: `1px solid ${BRAND.border}` }}>หักค่าใช้จ่าย</th>
              <th style={{ textAlign: 'right', color: BRAND.textSec, padding: '4px 0', borderBottom: `1px solid ${BRAND.border}` }}>คงเหลือ</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(DEDUCTION_BY_YEAR).map(([yr, rate]) => (
              <tr key={yr}>
                <td style={{ padding: '6px 0', color: BRAND.textPri, borderBottom: `1px solid ${BRAND.border}40` }}>{yr === '8' ? '8 ปีขึ้นไป' : `${yr} ปี`}</td>
                <td style={{ padding: '6px 0', color: BRAND.orange, fontWeight: 600, textAlign: 'right', borderBottom: `1px solid ${BRAND.border}40` }}>{(rate * 100).toFixed(0)}%</td>
                <td style={{ padding: '6px 0', color: BRAND.textSec, textAlign: 'right', borderBottom: `1px solid ${BRAND.border}40` }}>{((1 - rate) * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* สรุปอัตราค่าธรรมเนียม */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold, marginBottom: 14 }}>💰 สรุปอัตราค่าธรรมเนียม & ภาษีหลัก</div>
        {[
          { label: 'ค่าธรรมเนียมโอน (ซื้อ-ขาย)', value: '2% ของราคาประเมิน', color: BRAND.teal },
          { label: 'ค่าธรรมเนียมโอน (มรดก/ให้ทายาท)', value: '0.5% ของราคาประเมิน', color: BRAND.success },
          { label: 'ภาษีธุรกิจเฉพาะ (SBT)', value: '3.3% ของราคาสูงสุด', color: BRAND.orange },
          { label: 'อากรแสตมป์ (แทน SBT)', value: '0.5% ของราคาสูงสุด', color: BRAND.textPri },
          { label: 'อากรแสตมป์สัญญาเช่า', value: '0.1% ของค่าเช่ารวม', color: BRAND.textPri },
          { label: 'ค่าจดจำนอง', value: '1% (สูงสุด ฿200,000)', color: BRAND.purple },
          { label: 'อากรแสตมป์สัญญากู้', value: '0.05% (สูงสุด ฿10,000)', color: BRAND.textSec },
          { label: 'ภาษีมรดก (ทายาทโดยธรรม)', value: '5% ส่วนที่เกิน ฿100M', color: BRAND.danger },
          { label: 'ภาษีมรดก (บุคคลอื่น)', value: '10% ส่วนที่เกิน ฿100M', color: BRAND.danger },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${BRAND.border}40` }}>
            <span style={{ fontSize: 12, color: BRAND.textSec }}>{item.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: item.color }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
//  TaxPage หลัก
// ────────────────────────────────────────────────────────────
export default function TaxPage() {
  const [activeType, setActiveType] = useState('sale')
  const [showReference, setShowReference] = useState(false)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: BRAND.textPri }}>🧮 คำนวณภาษีอสังหาริมทรัพย์</div>
          <div style={{ fontSize: 12, color: BRAND.textMut, marginTop: 4 }}>คำนวณภาษีและค่าธรรมเนียมตามประเภทธุรกรรม</div>
        </div>
        <button
          onClick={() => setShowReference(!showReference)}
          style={{ background: showReference ? `${BRAND.teal}20` : 'transparent', border: `1px solid ${showReference ? BRAND.teal : BRAND.border}`, borderRadius: 8, color: showReference ? BRAND.teal : BRAND.textSec, padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
        >
          📋 {showReference ? 'ซ่อน' : 'ดู'}ตารางอ้างอิง
        </button>
      </div>

      {/* Reference Table */}
      {showReference && (
        <div style={{ marginBottom: 20 }}>
          <ReferenceTable />
        </div>
      )}

      {/* Transaction Type Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TRANSACTION_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setActiveType(t.value)}
            style={{
              background: activeType === t.value ? `${t.color}20` : 'transparent',
              border: `1px solid ${activeType === t.value ? t.color : BRAND.border}`,
              borderRadius: 10, color: activeType === t.value ? t.color : BRAND.textSec,
              padding: '10px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Calculator */}
      {activeType === 'sale' && <SaleCalc />}
      {activeType === 'mortgage' && <MortgageCalc />}
      {activeType === 'sale_redeem' && <SaleRedeemCalc />}
      {activeType === 'rental' && <RentalCalc />}
      {activeType === 'inheritance' && <InheritanceCalc />}

      {/* Disclaimer */}
      <div style={{ marginTop: 24, padding: '12px 16px', background: `${BRAND.textMut}15`, border: `1px solid ${BRAND.border}`, borderRadius: 10 }}>
        <div style={{ fontSize: 11, color: BRAND.textMut, lineHeight: 1.7 }}>
          ⚠️ <strong style={{ color: BRAND.textSec }}>หมายเหตุ:</strong> ผลการคำนวณเป็นเพียงการประมาณการเบื้องต้นเท่านั้น อัตราภาษีและเงื่อนไขอาจเปลี่ยนแปลงตามกฎหมายและประกาศกรมสรรพากร
          ควรปรึกษาเจ้าหน้าที่สำนักงานที่ดินหรือผู้เชี่ยวชาญด้านภาษีก่อนทำธุรกรรมจริง
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import { readRefinanceDraft, saveRefinanceDraft } from './lib/refinanceDraft.js'
import { refinanceFieldErrors } from './lib/refinanceFieldErrors.js'
import { calculateOldPayoffEstimate, calculateRefinanceFunding, calculateOfficialAssessment } from './lib/refinanceCalculator.js'

const initial = {
  oldPayoff: '', assessedValue: '', oldRegisteredValue: '', deedCount: '1',
  oldWithholding: '', newWithholding: '', taxMode: '', upfrontRate: '0',
  newAnnualRate: '', newAdvanceMonths: '0',
  fixedDeduction: '0', otherCosts: '0', customerCash: '0',
  principal: '', annualRate: '', startDate: '', transferDate: '', endDate: '',
  advanceMonths: '0', advancePaidAmount: '', otherPaid: '0',
  paymentMode: 'installments', paidInstallments: '0', partialPaid: '0',
  assessmentMode: 'area', landPricePerWa: '', areaRai: '0', areaNgan: '0', areaWa: '', buildingAssessedValue: '',
}
const baht = value => Number(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const draftStorage = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
}

export default function RefinanceCalculator() {
  const [draft] = useState(() => readRefinanceDraft(draftStorage, initial))
  const [form, setForm] = useState(draft.form)
  const [payoffMode, setPayoffMode] = useState(draft.payoffMode)
  const [saved, setSaved] = useState(null)
  useEffect(() => {
    setSaved(saveRefinanceDraft(draftStorage, form, payoffMode))
  }, [form, payoffMode])
  const clearDraft = () => {
    if (!window.confirm('ล้างร่างคำนวณย้ายทุนและเริ่มกรอกใหม่? ข้อมูลลูกค้าจริงไม่เปลี่ยนแปลง')) return
    setSaved(saveRefinanceDraft(draftStorage, initial, 'calculated'))
    setForm({ ...initial })
    setPayoffMode('calculated')
  }
  const payoffEstimate = useMemo(() => calculateOldPayoffEstimate(form), [form])
  const effectivePayoff = payoffMode === 'calculated' && payoffEstimate.ready ? payoffEstimate.payoff : form.oldPayoff
  const assessment = useMemo(() => calculateOfficialAssessment(form), [form])
  const assessedValue = form.assessmentMode === 'area' ? (assessment.ready ? assessment.total : '') : form.assessedValue
  const result = useMemo(() => calculateRefinanceFunding({ ...form, assessedValue, oldPayoff: payoffMode === 'calculated' && !payoffEstimate.ready ? '' : effectivePayoff }), [form, assessedValue, payoffMode, payoffEstimate.ready, effectivePayoff])
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }))
  const fieldErrors = refinanceFieldErrors(form, payoffMode)
  const errorText = key => fieldErrors[key] && <small id={`rf-error-${key}`} className="rf-error-text">{fieldErrors[key]}</small>
  const errorProps = key => ({ 'aria-invalid': Boolean(fieldErrors[key]), 'aria-describedby': fieldErrors[key] ? `rf-error-${key}` : undefined })
  const field = (key, label, hint, suffix = 'บาท') => <label className={`tx-field ${fieldErrors[key] ? 'rf-invalid' : ''}`} key={key}>
    <span>{label}</span><div><input {...errorProps(key)} type="number" min="0" step="any" value={form[key]} onChange={event => set(key, event.target.value)} /><em>{suffix}</em></div>
    {errorText(key)}
    {hint && <small>{hint}</small>}
  </label>
  const dateField = (key, label) => <label className={`tx-field ${fieldErrors[key] ? 'rf-invalid' : ''}`} key={key}><span>{label}</span><div><input {...errorProps(key)} type="date" value={form[key]} onChange={event => set(key, event.target.value)} /></div>{errorText(key)}</label>
  const row = (label, value, detail, total = false) => <div className={`tx-row ${total ? 'total' : ''}`} key={label}>
    <div><b>{label}</b>{detail && <small>{detail}</small>}</div><strong>{baht(value)} บาท</strong>
  </div>
  const hasValue = value => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) >= 0
  const validPayoff = payoffMode === 'calculated' ? payoffEstimate.ready : hasValue(form.oldPayoff) && Number(form.oldPayoff) > 0
  const hasAssessment = hasValue(assessedValue) && Number(assessedValue) > 0
  const knownDeeds = hasValue(form.deedCount) && Number.isInteger(Number(form.deedCount)) && Number(form.deedCount) > 0
  const partialResults = <>
    {validPayoff && row('ยอดปิดทุนเก่าประมาณการ', effectivePayoff)}
    {hasAssessment && row('ราคาประเมินราชการรวม', assessedValue)}
    {knownDeeds && row('ค่าจดไถ่', Number(form.deedCount) * 50)}
    {hasAssessment && row('ค่าจดขายฝากใหม่', Math.round(Number(assessedValue) * 2) / 100)}
    {hasAssessment && hasValue(form.oldRegisteredValue) && Number(form.oldRegisteredValue) > 0 && row('อากรไถ่', Math.ceil(Math.max(Number(assessedValue), Number(form.oldRegisteredValue)) / 200))}
    {hasValue(form.newAnnualRate) && hasValue(form.newAdvanceMonths) && Number.isInteger(Number(form.newAdvanceMonths)) && <p className="tx-note">ทุนใหม่หักล่วงหน้า: {Number(form.newAnnualRate) / 12 * Number(form.newAdvanceMonths)}% ของวงเงินใหม่ · รอยอดวงเงินเพื่อคำนวณเป็นบาท</p>}
  </>

  return <div className="tx-grid" aria-label="คำนวณย้ายทุนขายฝาก">
    <style>{`.tx-field.rf-invalid>div,.tx-field.rf-invalid>select{border:1px solid #f87171!important;background:#301b24!important}.tx-field.rf-invalid>span,.tx-field .rf-error-text{color:#fca5a5!important}.tx-field [aria-invalid=true]:focus{outline:2px solid #f87171;outline-offset:2px}`}</style>
    <style>{`.rf-mode{display:flex;gap:6px;margin:0 0 18px}.rf-mode button{flex:1;min-width:0}.rf-mode button.active{color:#2dd4bf;border-color:#2dd4bf;background:#102d31}.tx-basis strong{color:#2dd4bf;display:block;margin-top:8px}@media(max-width:520px){.rf-mode{flex-wrap:wrap}.rf-mode button{flex-basis:100%}}`}</style>
    <section className="tx-form">
      <p role="status" className="tx-note">{saved === false ? 'บันทึกร่างไม่สำเร็จ เบราว์เซอร์ไม่อนุญาตหรือพื้นที่เต็ม' : saved ? 'บันทึกร่างในเบราว์เซอร์นี้แล้ว' : 'กำลังกู้คืนร่าง'}</p>
      <button type="button" onClick={clearDraft}>ล้างร่างคำนวณ</button>
      <h3>ปิดทุนเดิม</h3>
      <div className="rf-mode" role="group" aria-label="วิธีกำหนดยอดปิดทุน">
        <button type="button" aria-pressed={payoffMode === 'calculated'} className={payoffMode === 'calculated' ? 'active' : ''} onClick={() => setPayoffMode('calculated')}>คำนวณจากเงินต้น</button>
        <button type="button" aria-pressed={payoffMode === 'manual'} className={payoffMode === 'manual' ? 'active' : ''} onClick={() => setPayoffMode('manual')}>กรอกยอดปิดจริง</button>
      </div>
      {payoffMode === 'calculated' ? <>
        {field('advanceMonths', 'จำนวนงวดที่ชำระล่วงหน้าแล้ว', '1 งวด = 1 เดือน ไม่รวมงวดที่จ่ายเพิ่มเติมหลังทำสัญญา', 'งวด')}
        {field('principal', 'เงินต้นทุนเดิม', 'เงินต้นตามสัญญา ไม่ใช่ยอดเงินสุทธิหลังหักล่วงหน้า')}
        {field('annualRate', 'อัตราผลตอบแทนตามสัญญาต่อปี', 'เช่น 15% ต่อปี = 1.25% ต่อเดือน', '%')}
        <div className="tx-two">{dateField('startDate', 'วันที่ทำสัญญา')}{dateField('endDate', 'วันครบกำหนดตามสัญญา')}</div>
        {dateField('transferDate', 'วันที่ต้องการย้ายทุน')}
        {field('advancePaidAmount', 'ยอดหักล่วงหน้าจริง (ถ้าต่างจากสูตร)', 'ปล่อยว่างเพื่อใช้เงินต้น × อัตรารายเดือน × จำนวนงวดที่ชำระล่วงหน้าแล้ว')}
        <label className="tx-field"><span>รับชำระดอกเบี้ยเพิ่มเติมถึงวันย้ายทุน</span><select value={form.paymentMode} onChange={event => set('paymentMode', event.target.value)}><option value="installments">ระบุจำนวนงวดและยอดจ่ายบางส่วน</option><option value="amount">ระบุยอดรับจริงรวม</option></select></label>
        {form.paymentMode === 'installments' ? <div className="tx-two">
          {field('paidInstallments', 'งวดที่จ่ายเต็มแล้ว', 'ไม่รวมงวดที่ชำระล่วงหน้าแล้วด้านบน', 'งวด')}
          {field('partialPaid', 'ยอดจ่ายบางส่วนเพิ่มเติม', 'ไม่รวมยอดงวดเต็มและยอดหักล่วงหน้า')}
        </div> : field('otherPaid', 'รับชำระเพิ่มหลังทำสัญญาแล้ว', 'เฉพาะดอกเบี้ย ไม่รวมยอดหักล่วงหน้าที่กรอกด้านบน')}
        {payoffEstimate.ready ? <div className="tx-basis" aria-live="polite">
          <p>ผลตอบแทนรายเดือน: {baht(payoffEstimate.monthlyAmount)} บาท</p>
          <p>ถึงวันย้ายทุน: {payoffEstimate.fullMonths} เดือนเต็ม{payoffEstimate.elapsedDays ? ` + ${payoffEstimate.elapsedDays} วัน` : ''} · ผลตอบแทน {baht(payoffEstimate.accrued)} บาท</p>
          <p>หักล่วงหน้าแล้ว: {baht(payoffEstimate.advanceCredit)} บาท · รับชำระเพิ่ม: {baht(payoffEstimate.otherPaid)} บาท</p>
          <strong>ยอดปิดทุนประมาณการ: {baht(payoffEstimate.payoff)} บาท</strong>
        </div> : <div className="tx-warn" role="status">{payoffEstimate.errors.map((error, index) => <p key={index}>{error}</p>)}</div>}
        <p className="tx-note">สูตรคิดผลตอบแทนตามเดือนเต็ม และเฉลี่ยตามวันจริงของรอบเดือนที่ยังไม่เต็ม ยอดสินไถ่และสิทธิเรียกค่าเสียโอกาสต้องตรวจสัญญา</p>
      </> : <>
        <p className="tx-note">กรอกยอดสินไถ่ที่ตกลง ณ วันย้ายทุน ไม่ใช้ยอดค้างงวดมาบวกซ้ำ</p>
        {field('oldPayoff', 'ยอดจ่ายให้ทุนเดิม', 'ต้องหักเงินล่วงหน้าและเงินที่รับชำระแล้วจากยอดสินไถ่ก่อนกรอก')}
      </>}
      <h3 style={{ marginTop: 28 }}>ราคาประเมินราชการ</h3>
      <label className="tx-field"><span>ฐานราคาประเมิน</span><select value={form.assessmentMode} onChange={event => set('assessmentMode', event.target.value)}><option value="area">ราคาต่อตารางวา × เนื้อที่</option><option value="manual">ยอดรวมตามเอกสาร / หลายแปลงต่างราคา</option></select></label>
      {form.assessmentMode === 'area' ? <>
        {field('landPricePerWa', 'ราคาประเมินที่ดินราชการ', 'ราคาของแปลงที่จดทะเบียน ณ วันทำรายการ ไม่ใช่ราคาตลาด', 'บาท/ตร.ว.')}
        <div className="tx-two">{field('areaRai', 'เนื้อที่ตามเอกสารสิทธิ: ไร่', null, 'ไร่')}{field('areaNgan', 'งาน', null, 'งาน')}</div>
        {field('areaWa', 'ตารางวา', '1 ไร่ = 400 ตารางวา; 1 งาน = 100 ตารางวา', 'ตร.ว.')}
        {field('buildingAssessedValue', 'ราคาประเมินราชการสิ่งปลูกสร้างรวม', 'ยอดประเมินที่ใช้จดทะเบียนหลังปรับค่าเสื่อมตามเกณฑ์แล้ว; ที่ดินเปล่าใส่ 0')}
        {assessment.ready ? <div className="tx-basis" aria-live="polite"><p>เนื้อที่รวม: {baht(assessment.totalWa)} ตารางวา</p><p>ราคาประเมินที่ดิน: {baht(assessment.landValue)} บาท</p><strong>ราคาประเมินรวม: {baht(assessment.total)} บาท</strong></div> : <div className="tx-warn" role="status">{assessment.errors.map(error => <p key={error}>{error}</p>)}</div>}
      </> : field('assessedValue', 'ราคาประเมินราชการรวม', 'รวมที่ดินทุกแปลงและสิ่งปลูกสร้างที่จดทะเบียนในรายการนี้')}
      <p className="tx-note"><a href="https://assessprice.treasury.go.th/" target="_blank" rel="noreferrer">ตรวจราคาประเมินกรมธนารักษ์</a></p>
      {field('oldRegisteredValue', 'ราคาไถ่ถอนที่แจ้งสำนักงานที่ดิน', 'ใช้เทียบราคาประเมินเพื่อคำนวณอากรไถ่')}
      <button type="button" disabled={!validPayoff} onClick={() => set('oldRegisteredValue', String(effectivePayoff))}>ใช้ยอดปิดทุนเก่าที่คำนวณได้</button>
      {field('deedCount', 'จำนวนแปลงที่ไถ่', 'ค่าจดไถ่ทั่วไป 50 บาทต่อแปลง', 'แปลง')}
      {field('oldWithholding', 'ภาษีไถ่ที่ต้องใช้ทุนใหม่จ่าย', 'หากทุนเดิมรับผิดชอบเองและไม่ต้องใช้เงินเพิ่ม ให้ใส่ 0')}

      <h3 style={{ marginTop: 28 }}>ขายฝากกับทุนใหม่</h3>
      {field('customerCash', 'ยอดเงินสุทธิที่ต้องการเหลือให้ลูกค้า', 'หลังปิดทุนเก่าและหักค่าใช้จ่ายวันย้ายทุนทั้งหมด; ใส่ 0 หากต้องการเพียงปิดทุนเก่า')}
      <div className="tx-two">{field('newAnnualRate', 'อัตราผลตอบแทนทุนใหม่ต่อปี', 'ใช้แสดงยอดรายเดือนและคำนวณเงินหักล่วงหน้า', '%')}{field('newAdvanceMonths', 'ทุนใหม่หักล่วงหน้า', 'จำนวนเดือนที่หักจากวงเงินก่อนจ่าย', 'เดือน')}</div>
      <label className={`tx-field ${fieldErrors.taxMode ? 'rf-invalid' : ''}`}><span>ภาษีธุรกรรมใหม่ที่ตรวจยืนยันแล้ว</span>
        <select {...errorProps('taxMode')} value={form.taxMode} onChange={event => set('taxMode', event.target.value)}>
          <option value="">ยังไม่ทราบ ต้องตรวจ</option><option value="sbt">ภาษีธุรกิจเฉพาะ 3.3%</option><option value="stamp">อากรแสตมป์ 0.5%</option>
        </select>{errorText('taxMode')}<small>เลือกอย่างใดอย่างหนึ่งหลังตรวจวันได้มาและสิทธิยกเว้น</small>
      </label>
      {field('newWithholding', 'ภาษีหัก ณ ที่จ่ายของสัญญาใหม่', 'คำนวณในแท็บโอนกรรมสิทธิ์หรือให้สำนักงานที่ดินยืนยัน; ใส่ 0 เฉพาะเมื่อไม่ต้องใช้ทุนนี้จ่าย')}
      {field('upfrontRate', 'ทุนใหม่หักอื่นเพิ่มเติม', 'เปอร์เซ็นต์อื่นนอกเหนือจากเดือนที่หักล่วงหน้าข้างบน', '%')}
      <div className="tx-two">{field('fixedDeduction', 'ทุนใหม่หักคงที่')}{field('otherCosts', 'ค่าใช้จ่ายอื่นที่ต้องใช้ทุนนี้จ่าย')}</div>
      <div aria-live="polite">
        <h3>ผลคำนวณขณะกรอก</h3>
        {result.ready ? <>
          {row('วงเงินทุนใหม่ที่ต้องขอ', result.gross, null, true)}
          {row('ทุนใหม่หักล่วงหน้า', result.newAdvanceWithheld)}
          {row('ผลตอบแทนทุนใหม่ต่อเดือน', result.monthlyNewReturn)}
          {row('เงินสุทธิคงเหลือถึงลูกค้า', result.netCustomerCash, null, true)}
        </> : <>
          {partialResults}
          <div className="tx-warn"><b>ข้อมูลที่ยังขาดหรือไม่ถูกต้อง</b>{result.errors.map(error => <p key={error}>{error}</p>)}<p>ภาษีที่ยังว่างไม่ถือเป็น 0 จึงยังไม่สรุปวงเงินใหม่</p></div>
        </>}
      </div>
    </section>

    <section className="tx-result rf-result" aria-live="polite">
      <header><div><span>{result.ready ? 'ประมาณการตามข้อมูลที่ระบุ' : 'รอข้อมูลสำคัญ'}</span><h3>วงเงินทุนใหม่ที่ต้องขอ</h3></div><button disabled={!result.ready} onClick={() => window.print()} title="พิมพ์ผลคำนวณ">พิมพ์สรุป</button></header>
      {result.ready ? <>
        {row('วงเงินทุนใหม่ที่ต้องขอ', result.gross, 'ประมาณการปัดขึ้นเป็นบาทเต็ม', true)}
        {row('หักยอดปิดทุนเก่า', result.oldPayoff)}
        {row('หักค่าใช้จ่ายและเงินหักล่วงหน้ารวม', result.totalExpenses)}
        {row('เงินสุทธิคงเหลือถึงลูกค้า', result.netCustomerCash, `เป้าหมาย ${baht(result.customerCash)} บาท · ส่วนเกินจากการปัดวงเงิน ${baht(result.surplus)} บาท`, true)}
        <h3>รายละเอียดค่าใช้จ่ายวันย้ายทุน</h3>
        {payoffMode === 'calculated' && <div className="tx-basis"><p>เงินต้นทุนเดิม: {baht(form.principal)} บาท · ผลตอบแทนถึงวันย้ายทุน: {baht(payoffEstimate.accrued)} บาท</p><p>หักล่วงหน้าและรับแล้ว: {baht(payoffEstimate.advanceCredit + payoffEstimate.otherPaid)} บาท</p></div>}
        {row('จ่ายให้ทุนเดิม', result.oldPayoff)}
        {row('ค่าจดไถ่', result.oldFee)}
        {row('อากรไถ่', result.oldStamp, '1 บาทต่อทุก 200 บาทหรือเศษของฐานที่สูงกว่า')}
        {row('ค่าจดขายฝากใหม่', result.newFee, '2% ของราคาประเมิน')}
        {row(form.taxMode === 'sbt' ? 'ภาษีธุรกิจเฉพาะสัญญาใหม่' : 'อากรแสตมป์สัญญาใหม่', result.newTax, 'ฐานสูงกว่าระหว่างราคาประเมินกับวงเงินทุนใหม่')}
        {row('ภาษีหัก ณ ที่จ่ายที่นำมารวม', Number(form.oldWithholding) + Number(form.newWithholding))}
        {row('ทุนใหม่หักล่วงหน้า', result.newAdvanceWithheld, `${form.newAdvanceMonths} เดือน`)}
        {row('ทุนใหม่หักอื่น (%)', result.otherWithheld)}
        {row('ค่าใช้จ่ายคงที่และค่าใช้จ่ายอื่น', Number(form.fixedDeduction) + Number(form.otherCosts))}
        <div className="tx-basis"><p>ผลตอบแทนทุนใหม่ต่อเดือน: {baht(result.monthlyNewReturn)} บาท (ไม่บวกซ้ำในค่าใช้จ่ายวันย้ายทุน)</p><p>วงเงินเพิ่มจากยอดปิดทุนเก่า: {baht(result.gross - result.oldPayoff)} บาท (รวมเงินสุทธิให้ลูกค้า)</p></div>
      </> : <>{partialResults}<div className="tx-warn" role="status"><b>ยังไม่สรุปวงเงิน</b>{result.errors.map((error, index) => <p key={index}>{error}</p>)}</div></>}
      <div className="tx-warn"><b>ก่อนใช้เสนอทุน</b>
        <p>ยอดไถ่ต้องยืนยันตามสัญญาและวันที่ทำรายการจริง ภาษีและผู้รับผิดชอบค่าใช้จ่ายต้องตรวจที่สำนักงานที่ดิน</p>
        {payoffMode === 'calculated' && payoffEstimate.warnings.map((warning, index) => <p key={`payoff-${index}`}>{warning}</p>)}
        {result.warnings?.map((warning, index) => <p key={index}>{warning}</p>)}
      </div>
      <p className="tx-note">ร่างเก็บเฉพาะเบราว์เซอร์นี้ ไม่บันทึกในข้อมูลลูกค้า ผู้ใช้เครื่องร่วมกันอาจเห็นร่างนี้ ไม่ใช่ใบประเมินภาษีหรือคำอนุมัติวงเงิน</p>
    </section>
  </div>
}

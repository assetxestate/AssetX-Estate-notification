import React from "react";
import { BRAND } from "../lib/config.js";
import { updateCustomer as apiUpdateCustomer } from "../lib/api.js";

// ── Modal สรุปการเบิกจ่าย ────────────────────────────────────────
export function DisbursementModal({ customer, onClose, onSaved }) {
  const EMPTY_DEBT = () => ({
    id: Date.now() + Math.random(),
    creditorName: '', contractType: 'จำนอง', amount: '',
    paymentMethod: 'โอน', bankName: '', accountNo: '', accountName: '', checkPayableTo: '',
  })

  const ex = customer.disbursement || {}
  const [form, setForm] = React.useState({
    approvedAmount: String(ex.approvedAmount || customer.principal || ''),
    existingDebts: ex.existingDebts?.length > 0 ? ex.existingDebts : [],
    advanceMonths: String(ex.advanceMonths ?? 0),
    externalBrokerName: ex.externalBrokerName || '',
    externalBrokerAmount: String(ex.externalBrokerAmount || ''),
    externalBrokerPayment: ex.externalBrokerPayment || 'โอน',
    companyFeeType: ex.companyFeeType || 'fixed',
    companyFeeRate: String(ex.companyFeeRate || ''),
    companyFeeAmount: String(ex.companyFeeAmount || ''),
  })
  const [saving, setSaving] = React.useState(false)
  const up = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const approved = parseFloat(form.approvedAmount) || 0
  const totalDebt = form.existingDebts.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
  const monthlyAmount = customer.amount || 0
  const advanceTotal = (parseInt(form.advanceMonths) || 0) * monthlyAmount
  const externalFee = parseFloat(form.externalBrokerAmount) || 0
  const companyFee = form.companyFeeType === 'percent'
    ? Math.round(approved * (parseFloat(form.companyFeeRate) || 0) / 100)
    : parseFloat(form.companyFeeAmount) || 0
  const net = approved - totalDebt - advanceTotal - externalFee - companyFee

  const addDebt = () => setForm(p => ({ ...p, existingDebts: [...p.existingDebts, EMPTY_DEBT()] }))
  const removeDebt = (id) => setForm(p => ({ ...p, existingDebts: p.existingDebts.filter(d => d.id !== id) }))
  const updateDebt = (id, key, val) => setForm(p => ({ ...p, existingDebts: p.existingDebts.map(d => d.id === id ? { ...d, [key]: val } : d) }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const disbursement = {
        approvedAmount: approved,
        existingDebts: form.existingDebts,
        advanceMonths: parseInt(form.advanceMonths) || 0,
        advanceTotal,
        externalBrokerName: form.externalBrokerName,
        externalBrokerAmount: externalFee,
        externalBrokerPayment: form.externalBrokerPayment,
        companyFeeType: form.companyFeeType,
        companyFeeRate: parseFloat(form.companyFeeRate) || 0,
        companyFeeAmount: companyFee,
        netDisbursement: net,
      }
      await apiUpdateCustomer(customer.id, { disbursement })
      onSaved({ ...customer, disbursement })
      onClose()
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const inp = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(45,212,191,.2)',
    borderRadius: 7, color: BRAND.textPri, fontSize: 13, padding: '8px 10px', outline: 'none',
  }
  const lbl = { fontSize: 11, color: BRAND.textSec, marginBottom: 4, display: 'block' }
  const SectionTitle = ({ icon, text }) => (
    <div style={{ margin: '16px 0 8px', fontSize: 12, fontWeight: 700, color: BRAND.gold }}>{icon} {text}</div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: BRAND.bgCard, border: `1px solid rgba(45,212,191,.3)`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 800, color: BRAND.textPri, fontSize: 16 }}>💰 สรุปการเบิกจ่าย</div>
            <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 2 }}>{customer.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: BRAND.textSec, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {/* วงเงินอนุมัติ */}
        <SectionTitle icon="🏦" text="วงเงินที่นายทุนอนุมัติ" />
        <div>
          <label style={lbl}>วงเงินอนุมัติ (บาท)</label>
          <input style={inp} type="number" value={form.approvedAmount} onChange={e => up('approvedAmount', e.target.value)} placeholder="0" />
        </div>

        {/* ทุนเก่า */}
        <SectionTitle icon="🔗" text={`ทุนเก่า (${form.existingDebts.length} รายการ)`} />
        {form.existingDebts.map((debt, idx) => (
          <div key={debt.id} style={{ background: 'rgba(0,0,0,.3)', borderRadius: 10, padding: 12, marginBottom: 10, border: `1px solid ${BRAND.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.textPri }}>เจ้าหนี้ที่ {idx + 1}</div>
              <button onClick={() => removeDebt(debt.id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,.4)', background: 'transparent', color: '#FCA5A5', cursor: 'pointer' }}>ลบ</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>ชื่อเจ้าหนี้เดิม</label>
                <input style={inp} value={debt.creditorName} onChange={e => updateDebt(debt.id, 'creditorName', e.target.value)} placeholder="ชื่อ-นามสกุล / บริษัท" />
              </div>
              <div>
                <label style={lbl}>ประเภทสัญญาเดิม</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={debt.contractType} onChange={e => updateDebt(debt.id, 'contractType', e.target.value)}>
                  <option value="จำนอง">จำนอง</option>
                  <option value="ขายฝาก">ขายฝาก</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>
              <div>
                <label style={lbl}>ยอดที่ต้องปลด (บาท)</label>
                <input style={inp} type="number" value={debt.amount} onChange={e => updateDebt(debt.id, 'amount', e.target.value)} placeholder="0" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>วิธีชำระ</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={debt.paymentMethod} onChange={e => updateDebt(debt.id, 'paymentMethod', e.target.value)}>
                  <option value="โอน">เงินโอน</option>
                  <option value="แคชเชียร์เช็ก">แคชเชียร์เช็ก</option>
                  <option value="เงินสด">เงินสด</option>
                </select>
              </div>
              {debt.paymentMethod === 'โอน' && (<>
                <div>
                  <label style={lbl}>ธนาคาร</label>
                  <input style={inp} value={debt.bankName} onChange={e => updateDebt(debt.id, 'bankName', e.target.value)} placeholder="เช่น กสิกรไทย" />
                </div>
                <div>
                  <label style={lbl}>เลขบัญชี</label>
                  <input style={inp} value={debt.accountNo} onChange={e => updateDebt(debt.id, 'accountNo', e.target.value)} placeholder="xxx-x-xxxxx-x" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>ชื่อบัญชี</label>
                  <input style={inp} value={debt.accountName} onChange={e => updateDebt(debt.id, 'accountName', e.target.value)} />
                </div>
              </>)}
              {debt.paymentMethod === 'แคชเชียร์เช็ก' && (
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>สั่งจ่ายในนาม</label>
                  <input style={inp} value={debt.checkPayableTo} onChange={e => updateDebt(debt.id, 'checkPayableTo', e.target.value)} placeholder="ชื่อ-นามสกุล หรือ บริษัท" />
                </div>
              )}
            </div>
          </div>
        ))}
        <button onClick={addDebt} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px dashed rgba(239,68,68,.5)', background: 'transparent', color: '#FCA5A5', fontSize: 12, cursor: 'pointer', marginBottom: 4 }}>
          + เพิ่มเจ้าหนี้เดิม
        </button>

        {/* หักล่วงหน้า */}
        <SectionTitle icon="📅" text="หักล่วงหน้า" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <label style={lbl}>จำนวนงวด</label>
            <input style={inp} type="number" value={form.advanceMonths} onChange={e => up('advanceMonths', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={lbl}>ยอด/งวด (บาท)</label>
            <input style={{ ...inp, opacity: 0.6 }} value={monthlyAmount.toLocaleString('th-TH')} readOnly />
          </div>
          <div>
            <label style={lbl}>รวม (บาท)</label>
            <input style={{ ...inp, color: '#FCA5A5' }} value={advanceTotal.toLocaleString('th-TH')} readOnly />
          </div>
        </div>

        {/* ค่านายหน้าภายนอก */}
        <SectionTitle icon="🤝" text="ค่านายหน้าภายนอก" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>ชื่อนายหน้า (ถ้ามี)</label>
            <input style={inp} value={form.externalBrokerName} onChange={e => up('externalBrokerName', e.target.value)} placeholder="ชื่อ-นามสกุล" />
          </div>
          <div>
            <label style={lbl}>ค่านายหน้า (บาท)</label>
            <input style={inp} type="number" value={form.externalBrokerAmount} onChange={e => up('externalBrokerAmount', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={lbl}>วิธีจ่าย</label>
            <select style={{ ...inp, cursor: 'pointer' }} value={form.externalBrokerPayment} onChange={e => up('externalBrokerPayment', e.target.value)}>
              <option value="โอน">เงินโอน</option>
              <option value="เงินสด">เงินสด</option>
            </select>
          </div>
        </div>

        {/* ค่านายหน้าบริษัท */}
        <SectionTitle icon="🏢" text="ค่านายหน้าบริษัท (รายได้ AssetX)" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <label style={lbl}>ประเภท</label>
            <select style={{ ...inp, cursor: 'pointer' }} value={form.companyFeeType} onChange={e => up('companyFeeType', e.target.value)}>
              <option value="fixed">ยอดคงที่</option>
              <option value="percent">% ของวงเงิน</option>
            </select>
          </div>
          {form.companyFeeType === 'percent' ? (<>
            <div>
              <label style={lbl}>อัตรา (%)</label>
              <input style={inp} type="number" step="0.1" value={form.companyFeeRate} onChange={e => up('companyFeeRate', e.target.value)} placeholder="เช่น 2" />
            </div>
            <div>
              <label style={lbl}>ยอด (คำนวณแล้ว)</label>
              <input style={{ ...inp, color: BRAND.gold }} value={companyFee.toLocaleString('th-TH')} readOnly />
            </div>
          </>) : (
            <div style={{ gridColumn: '2/-1' }}>
              <label style={lbl}>ยอด (บาท)</label>
              <input style={{ ...inp, color: BRAND.gold }} type="number" value={form.companyFeeAmount} onChange={e => up('companyFeeAmount', e.target.value)} placeholder="0" />
            </div>
          )}
        </div>

        {/* Summary */}
        <div style={{ marginTop: 20, padding: 16, background: 'rgba(0,0,0,.4)', borderRadius: 12, border: `1px solid ${BRAND.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.textSec, marginBottom: 10 }}>สรุปการเบิกจ่าย</div>
          {[
            ['วงเงินอนุมัติ', approved, BRAND.textPri, false],
            ['หักทุนเก่า', totalDebt, '#FCA5A5', true],
            ['หักล่วงหน้า', advanceTotal, '#FCA5A5', true],
            ['ค่านายหน้าภายนอก', externalFee, '#FCA5A5', true],
            ['ค่านายหน้าบริษัท', companyFee, BRAND.gold, true],
          ].filter(([, val]) => val > 0).map(([label, val, color, minus]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${BRAND.border}`, fontSize: 13 }}>
              <span style={{ color: BRAND.textSec }}>{label}</span>
              <span style={{ color, fontWeight: 600 }}>{minus ? '−' : ''}{val.toLocaleString('th-TH')}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 16, fontWeight: 800 }}>
            <span style={{ color: BRAND.textPri }}>ยอดที่ลูกค้าได้รับจริง</span>
            <span style={{ color: net >= 0 ? BRAND.teal : '#FCA5A5' }}>{net.toLocaleString('th-TH')} ฿</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', color: BRAND.textSec, fontSize: 13, cursor: 'pointer' }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '10px 0', borderRadius: 8, background: saving ? 'rgba(45,212,191,.3)' : 'linear-gradient(135deg,#2DD4BF,#0E7490)', border: 'none', color: '#000', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการเบิกจ่าย'}
          </button>
        </div>
      </div>
    </div>
  )
}


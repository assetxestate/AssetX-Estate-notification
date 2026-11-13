import React from "react";
import { BRAND } from "../lib/config.js";
import { updateCustomer as apiUpdateCustomer } from "../lib/api.js";
import { isAdvanceDeductionRecord } from "../lib/advanceDeduction.js";

// ── แก้ไขข้อมูลหลักลูกค้าจาก Sheet DATA ────────────────────────
export function CustomerSheetEditModal({ customer, appsScriptUrl, onClose, onSaved }) {
  const [form, setForm] = React.useState({
    name: customer.name || '',
    type: customer.type || 'จำนอง',
    principal: String(customer.principal || ''),
    amount: String(customer.amount || ''),
    freq: customer.freq || 'รายเดือน',
    contractEndDate: customer.contractEndDate || '',
    lineUserId: customer.lineUserId || '',
    incomeType: customer.incomeType || 'commission',
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);

  const up = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ระบบคิดว่างวดไหน "ครบ/ยังขาด" จากยอดต่องวดตัวนี้ทุกงวด (ไม่มียอดแยกรายงวด)
  // เพิ่มยอด → งวดเก่าที่บันทึกชำระด้วยยอดเดิมจะกลายเป็น "ชำระไม่ครบ" ทันที จึงเตือนก่อนบันทึก
  const newAmount = parseFloat(form.amount) || 0;
  const shortAfterEdit = newAmount > (Number(customer.amount) || 0)
    ? (customer.payments || []).filter((p) => p.record && !isAdvanceDeductionRecord(p.record)
      && (Number(p.balance?.paid ?? p.record.amountPaid) || 0) + (Number(p.balance?.waived) || 0) < newAmount).length
    : 0;

  const handleSave = async () => {
    if (!form.name.trim()) { setError('กรุณากรอกชื่อลูกค้า'); return; }
    setSaving(true); setError(null);
    try {
      await apiUpdateCustomer(customer.id, {
        name: form.name,
        type: form.type,
        principal: parseFloat(form.principal) || 0,
        amount: parseFloat(form.amount) || 0,
        freq: form.freq,
        contractEndDate: form.contractEndDate || null,
        lineUserId: form.lineUserId,
        incomeType: form.incomeType,
      });
      onSaved({ ...customer, ...form, principal: parseFloat(form.principal) || 0, amount: parseFloat(form.amount) || 0 });
      onClose();
    } catch (e) {
      setError('เกิดข้อผิดพลาด: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--ax-c-r255-255-255-a50)', border: '1px solid rgba(45,212,191,.2)',
    borderRadius: 7, color: BRAND.textPri, fontSize: 13, padding: '8px 10px', outline: 'none',
  };
  const labelStyle = { fontSize: 11, color: BRAND.textSec, marginBottom: 4, display: 'block' };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--ax-c-r0-0-0-a700)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: BRAND.bgCard, border: `1px solid rgba(45,212,191,.3)`, borderRadius: 16,
        padding: 24, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: BRAND.textPri, fontSize: 16 }}>✏️ แก้ไขข้อมูลลูกค้า</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: BRAND.textSec, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>ชื่อลูกค้า</label>
            <input style={inputStyle} value={form.name} onChange={e => up('name', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>ประเภทสัญญา</label>
            <select style={inputStyle} value={form.type} onChange={e => up('type', e.target.value)}>
              <option value="จำนอง">จำนอง</option>
              <option value="ขายฝาก">ขายฝาก</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>เงินต้น (บาท)</label>
              <input style={inputStyle} type="number" value={form.principal} onChange={e => up('principal', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>ดอกเบี้ย/งวด (บาท)</label>
              <input style={inputStyle} type="number" value={form.amount} onChange={e => up('amount', e.target.value)} />
            </div>
          </div>
          {shortAfterEdit > 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.4)', color: 'var(--ax-c-fbbf24)', fontSize: 12, lineHeight: 1.5 }}>
              ⚠️ ถ้าเพิ่มดอกเบี้ย/งวดเป็น {newAmount.toLocaleString('th-TH')} บาท งวดที่บันทึกชำระไว้แล้ว {shortAfterEdit} งวดจะขึ้นว่า "ชำระไม่ครบ" เพราะระบบคิดยอดของทุกงวดจากตัวเลขนี้ — ถ้ายอดที่รับไว้ถูกต้องแล้ว อย่าแก้ตรงนี้
            </div>
          )}
          <div>
            <label style={labelStyle}>รอบชำระ</label>
            <select style={inputStyle} value={form.freq} onChange={e => up('freq', e.target.value)}>
              <option value="รายเดือน">รายเดือน</option>
              <option value="ราย 2 สัปดาห์">ราย 2 สัปดาห์</option>
              <option value="รายปี">รายปี</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>วันสิ้นสุดสัญญา (YYYY-MM-DD)</label>
            <input style={inputStyle} value={form.contractEndDate} onChange={e => up('contractEndDate', e.target.value)} placeholder="เช่น 2026-06-01" />
          </div>
          <div>
            <label style={labelStyle}>LINE User ID</label>
            <input style={inputStyle} value={form.lineUserId} onChange={e => up('lineUserId', e.target.value)} placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
          </div>
          <div>
            <label style={labelStyle}>ประเภทรายได้บริษัท</label>
            <select style={inputStyle} value={form.incomeType} onChange={e => up('incomeType', e.target.value)}>
              <option value="commission">รับค่าคอมมิชชั่น (มี Advance 2%)</option>
              <option value="interest">รับดอกเบี้ยแทน (ไม่มี Advance)</option>
            </select>
          </div>
        </div>

        {error && <div style={{ color: 'var(--ax-c-f87171)', fontSize: 12, marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            background: 'var(--ax-c-r255-255-255-a70)', border: '1px solid var(--ax-c-r255-255-255-a100)',
            color: BRAND.textSec, fontSize: 13, cursor: 'pointer',
          }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 2, padding: '10px 0', borderRadius: 8,
            background: saving ? 'rgba(45,212,191,.3)' : 'linear-gradient(135deg,var(--ax-c-2dd4bf),var(--ax-c-0e7490))',
            border: 'none', color: 'var(--ax-c-000)', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกลง Sheet'}
          </button>
        </div>
      </div>
    </div>
  );
}


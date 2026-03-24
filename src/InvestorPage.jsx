import React, { useState, useEffect } from "react";

const BRAND = {
  bg: "#0A1628", cardBg: "#111D35", border: "rgba(45,212,191,0.15)",
  textPri: "#E2E8F0", textSec: "#94A3B8", textMut: "#64748B",
  teal: "#2DD4BF", gold: "#F59E0B", success: "#10B981",
};

const STATUS_CONFIG = {
  'รอการตัดสินใจ': { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', text: '#F59E0B', label: '⏳ รอการตัดสินใจ' },
  'อนุมัติ':        { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.4)', text: '#10B981', label: '✅ อนุมัติแล้ว' },
  'ปฏิเสธ':         { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.4)',  text: '#F87171', label: '❌ ปฏิเสธ' },
  'สร้างสัญญาแล้ว': { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.4)', text: '#A5B4FC', label: '📋 สร้างสัญญาแล้ว' },
  'ยกเลิก':         { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.4)', text: '#94A3B8', label: '🚫 ยกเลิก' },
};

const TABS = [
  { key: 'รอการตัดสินใจ', label: '⏳ รอตัดสินใจ' },
  { key: 'อนุมัติ',        label: '✅ อนุมัติ' },
  { key: 'ปฏิเสธ',         label: '❌ ปฏิเสธ' },
  { key: 'สร้างสัญญาแล้ว', label: '📋 สร้างสัญญา' },
  { key: 'ยกเลิก',         label: '🚫 ยกเลิก' },
];

const FREQ_OPTIONS = ['รายเดือน', 'ราย 2 สัปดาห์'];

function fmt(n) {
  const num = parseFloat(n);
  return isNaN(num) ? '—' : num.toLocaleString('th-TH');
}

function Card({ children, style }) {
  return (
    <div style={{ background: BRAND.cardBg, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: 16, ...style }}>
      {children}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BRAND.border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color || BRAND.textPri }}>{value}</div>
    </div>
  );
}

// ── Modal สร้างสัญญา ────────────────────────────────────────
function ContractModal({ row, appsScriptUrl, onClose, onSuccess }) {
  const [form, setForm] = useState({
    customerName: '',
    interestRate: '',
    installmentCount: '',
    contractStartDate: new Date().toISOString().split('T')[0],
    payDay: '',
    freq: 'รายเดือน',
    lineUserId: '',
  });
  const [saving, setSaving] = useState(false);

  const up = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const principal = parseFloat(row['วงเงินที่ลูกค้าขอ']) || parseFloat(row['วงเงินแนะนำ']) || 0;
  const amountPerInstall = form.interestRate
    ? Math.round(principal * parseFloat(form.interestRate) / 100)
    : 0;

  const calcEndDate = () => {
    if (!form.contractStartDate || !form.installmentCount) return '—';
    const d = new Date(form.contractStartDate);
    if (form.freq === 'ราย 2 สัปดาห์') {
      d.setDate(d.getDate() + parseInt(form.installmentCount) * 14);
    } else {
      d.setMonth(d.getMonth() + parseInt(form.installmentCount));
    }
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleSave = async () => {
    if (!form.customerName || !form.interestRate || !form.installmentCount || !form.payDay) {
      alert('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        principal,
        contractType: row['ประเภทการประเมิน'],
        propertyType: row['ประเภทย่อย'],
        province: row['จังหวัด'],
        district: row['อำเภอ/เขต'],
        subdistrict: row['ตำบล/แขวง'],
        titleDeedNo: row['เลขโฉนด'],
        valuationRowIndex: row['_rowIndex'],
      };
      await fetch(appsScriptUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createCustomerFromValuation', data }),
      });
      onSuccess();
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${BRAND.border}`, background: 'rgba(255,255,255,0.05)', color: BRAND.textPri, fontSize: 13, boxSizing: 'border-box' };
  const lbl = { fontSize: 11, color: BRAND.textSec, marginBottom: 4, display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: BRAND.cardBg, border: `1px solid ${BRAND.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: BRAND.textPri, marginBottom: 4 }}>📋 สร้างสัญญาลูกค้า</div>
        <div style={{ fontSize: 12, color: BRAND.textSec, marginBottom: 20 }}>{row['รหัส/ชื่อทรัพย์'] || '—'} • {row['จังหวัด']}</div>

        {/* Pre-filled info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, padding: 12, background: 'rgba(45,212,191,0.05)', borderRadius: 10, border: `1px solid ${BRAND.border}` }}>
          {[
            ['ประเภท', row['ประเภทการประเมิน']],
            ['ทรัพย์', row['ประเภทย่อย']],
            ['วงเงินที่ขอ', '฿' + fmt(row['วงเงินที่ลูกค้าขอ'])],
            ['วงเงินแนะนำ', '฿' + fmt(row['วงเงินแนะนำ'])],
            ['ที่อยู่', (row['ตำบล/แขวง'] ? 'ต.' + row['ตำบล/แขวง'] + ' ' : '') + (row['อำเภอ/เขต'] ? 'อ.' + row['อำเภอ/เขต'] + ' ' : '') + (row['จังหวัด'] || '')],
            ['เลขโฉนด', row['เลขโฉนด'] || '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: BRAND.textMut }}>{k}</div>
              <div style={{ fontSize: 12, color: BRAND.textPri, fontWeight: 600 }}>{v || '—'}</div>
            </div>
          ))}
        </div>

        {/* Form fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>ชื่อลูกค้า *</label>
            <input style={inp} value={form.customerName} onChange={e => up('customerName', e.target.value)} placeholder="เช่น สมชาย ใจดี" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>ดอกเบี้ย (% ต่อเดือน) *</label>
              <input style={inp} type="number" step="0.1" value={form.interestRate} onChange={e => up('interestRate', e.target.value)} placeholder="เช่น 2" />
            </div>
            <div>
              <label style={lbl}>จำนวนงวด *</label>
              <input style={inp} type="number" value={form.installmentCount} onChange={e => up('installmentCount', e.target.value)} placeholder="เช่น 12" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>วันเริ่มสัญญา *</label>
              <input style={inp} type="date" value={form.contractStartDate} onChange={e => up('contractStartDate', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>วันชำระ/เดือน *</label>
              <input style={inp} type="number" min="1" max="31" value={form.payDay} onChange={e => up('payDay', e.target.value)} placeholder="เช่น 9" />
            </div>
          </div>
          <div>
            <label style={lbl}>ความถี่การชำระ</label>
            <select style={inp} value={form.freq} onChange={e => up('freq', e.target.value)}>
              {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>LINE User ID (ไม่บังคับ)</label>
            <input style={inp} value={form.lineUserId} onChange={e => up('lineUserId', e.target.value)} placeholder="Uxxxxxxxxxxxxxxxxx" />
          </div>
        </div>

        {/* Summary */}
        {form.interestRate && form.installmentCount && (
          <div style={{ marginTop: 16, padding: 12, background: 'rgba(45,212,191,0.08)', borderRadius: 10, border: `1px solid rgba(45,212,191,0.3)` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><div style={{ fontSize: 10, color: BRAND.textSec }}>วงเงิน</div><div style={{ fontWeight: 700, color: BRAND.teal }}>฿{fmt(principal)}</div></div>
              <div><div style={{ fontSize: 10, color: BRAND.textSec }}>ดอกเบี้ย/งวด</div><div style={{ fontWeight: 700, color: BRAND.gold }}>฿{fmt(amountPerInstall)}</div></div>
              <div style={{ gridColumn: '1/-1' }}><div style={{ fontSize: 10, color: BRAND.textSec }}>สิ้นสุดสัญญา (ประมาณ)</div><div style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 13 }}>{calcEndDate()}</div></div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${BRAND.border}`, background: 'transparent', color: BRAND.textSec, cursor: 'pointer', fontSize: 13 }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: saving ? 'rgba(45,212,191,0.3)' : 'linear-gradient(135deg,#2DD4BF,#0E7490)', color: '#000', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13 }}>
            {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกลูกค้า'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main InvestorPage ────────────────────────────────────────
export default function InvestorPage({ appsScriptUrl }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('รอการตัดสินใจ');
  const [contractModal, setContractModal] = useState(null);
  const [processingRow, setProcessingRow] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  const load = () => {
    setLoading(true);
    fetch(`${appsScriptUrl}?action=getValuations`)
      .then(r => r.json())
      .then(r => { setRows(r.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [appsScriptUrl]);

  const updateStatus = async (row, status) => {
    setProcessingRow(row['_rowIndex']);
    try {
      await fetch(appsScriptUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateValuation', rowIndex: row['_rowIndex'], data: { 'สถานะ': status } }),
      });
      setRows(prev => prev.map(r => r['_rowIndex'] === row['_rowIndex'] ? { ...r, 'สถานะ': status } : r));
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    } finally {
      setProcessingRow(null);
    }
  };

  const cancelCustomer = async (row) => {
    setProcessingRow(row['_rowIndex']);
    try {
      await fetch(appsScriptUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancelCustomer', customerId: row['_customerId'] || row['รหัส/ชื่อทรัพย์'], customerName: row['รหัส/ชื่อทรัพย์'] }),
      });
      await updateStatus(row, 'ยกเลิก');
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    } finally {
      setProcessingRow(null);
    }
  };

  const handleContractSuccess = () => {
    setContractModal(null);
    setSuccessMsg('✅ บันทึกลูกค้าเรียบร้อย! ลูกค้าใหม่จะปรากฏในหน้าลูกค้าแล้ว');
    load();
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const filtered = rows.filter(r => r['สถานะ'] === activeTab);
  const counts = TABS.reduce((acc, t) => {
    acc[t.key] = rows.filter(r => r['สถานะ'] === t.key).length;
    return acc;
  }, {});

  return (
    <div style={{ padding: '0 0 80px' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', borderBottom: `1px solid ${BRAND.border}` }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: BRAND.textPri }}>💼 หน้านายทุน</div>
        <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 2 }}>อนุมัติ / ปฏิเสธ / สร้างสัญญาจากการประเมิน</div>
      </div>

      {successMsg && (
        <div style={{ margin: '12px 16px', padding: '12px 16px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 10, color: '#10B981', fontSize: 13, fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      {/* Tabs — wrap grid + refresh */}
      <div style={{ padding: '10px 16px 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
          {TABS.map(t => {
            const st = STATUS_CONFIG[t.key];
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '8px 6px', borderRadius: 10,
                  border: `1px solid ${isActive ? st.border : BRAND.border}`,
                  background: isActive ? st.bg : 'transparent',
                  color: isActive ? st.text : BRAND.textSec,
                  fontSize: 12, fontWeight: isActive ? 700 : 400,
                  cursor: 'pointer', textAlign: 'center',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                {t.label}
                {counts[t.key] > 0 && (
                  <span style={{ background: isActive ? 'rgba(0,0,0,0.2)' : BRAND.border, borderRadius: 10, padding: '0px 6px', fontSize: 11, fontWeight: 700 }}>
                    {counts[t.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={load} style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${BRAND.border}`, background: 'transparent', color: BRAND.textSec, fontSize: 12, cursor: 'pointer' }}>🔄 รีเฟรช</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: BRAND.textSec, padding: 40 }}>⏳ กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: BRAND.textMut, padding: 40 }}>ไม่มีรายการใน "{activeTab}"</div>
        ) : (
          filtered.map((row, i) => {
            const st = STATUS_CONFIG[row['สถานะ']] || STATUS_CONFIG['รอการตัดสินใจ'];
            const isProcessing = processingRow === row['_rowIndex'];
            const loc = [
              row['ตำบล/แขวง'] ? 'ต.' + row['ตำบล/แขวง'] : '',
              row['อำเภอ/เขต'] ? 'อ.' + row['อำเภอ/เขต'] : '',
              row['จังหวัด'] || '',
            ].filter(Boolean).join(' ');
            const ltv = row['LTV ลูกค้า (% ต่อตลาด)'];

            return (
              <Card key={row['_rowIndex'] || i}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: BRAND.textPri }}>{row['รหัส/ชื่อทรัพย์'] || '—'}</div>
                    <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 2 }}>
                      {row['ประเภทการประเมิน']} • {row['ประเภทย่อย']} • {loc}
                    </div>
                    <div style={{ fontSize: 11, color: BRAND.textMut, marginTop: 2 }}>
                      ผู้ประเมิน: {row['ผู้ประเมิน'] || '—'} | {row['วันที่บันทึก']}
                    </div>
                  </div>
                  <span style={{ background: st.bg, border: `1px solid ${st.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: st.text, whiteSpace: 'nowrap' }}>
                    {st.label}
                  </span>
                </div>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 14 }}>
                  <StatBox label="มูลค่าตลาด" value={'฿' + fmt(row['มูลค่าตลาดรวม'])} />
                  <StatBox label="FSV (80%)" value={'฿' + fmt(row['FSV (80%)'])} />
                  <StatBox label="วงเงินที่ขอ" value={'฿' + fmt(row['วงเงินที่ลูกค้าขอ'])} color={BRAND.gold} />
                  <StatBox label="วงเงินแนะนำ" value={'฿' + fmt(row['วงเงินแนะนำ'])} color={BRAND.teal} />
                </div>

                {/* LTV bar */}
                {ltv && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: BRAND.textSec, marginBottom: 4 }}>
                      <span>LTV ลูกค้า</span>
                      <span style={{ color: parseFloat(ltv) > 80 ? '#F87171' : parseFloat(ltv) > 60 ? BRAND.gold : BRAND.success, fontWeight: 700 }}>{parseFloat(ltv).toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: Math.min(parseFloat(ltv), 100) + '%', borderRadius: 3, background: parseFloat(ltv) > 80 ? '#F87171' : parseFloat(ltv) > 60 ? BRAND.gold : BRAND.success }} />
                    </div>
                  </div>
                )}

                {/* Risk & Score */}
                {(row['ปัจจัยเสี่ยง'] || row['Property Score']) && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, fontSize: 12 }}>
                    <span style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '4px 10px', color: BRAND.textSec }}>
                      Score: <b style={{ color: BRAND.textPri }}>{row['Property Score']}</b>/100
                    </span>
                    {row['ปัจจัยเสี่ยง'] && row['ปัจจัยเสี่ยง'] !== 'ไม่มี' && (
                      <span style={{ color: '#F87171', fontSize: 11 }}>⚠️ {row['ปัจจัยเสี่ยง']}</span>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                {activeTab === 'รอการตัดสินใจ' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => updateStatus(row, 'ปฏิเสธ')}
                      disabled={isProcessing}
                      style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#F87171', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >
                      {isProcessing ? '⏳' : '❌ ปฏิเสธ'}
                    </button>
                    <button
                      onClick={() => updateStatus(row, 'อนุมัติ')}
                      disabled={isProcessing}
                      style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.08)', color: '#10B981', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >
                      {isProcessing ? '⏳' : '✅ อนุมัติ'}
                    </button>
                  </div>
                )}
                {activeTab === 'อนุมัติ' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => updateStatus(row, 'รอการตัดสินใจ')}
                      disabled={isProcessing}
                      style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1px solid ${BRAND.border}`, background: 'transparent', color: BRAND.textSec, fontSize: 12, cursor: 'pointer' }}
                    >
                      ↩️ ยกเลิกอนุมัติ
                    </button>
                    <button
                      onClick={() => setContractModal(row)}
                      style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2DD4BF,#0E7490)', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >
                      📋 สร้างสัญญาลูกค้า
                    </button>
                  </div>
                )}
                {activeTab === 'ปฏิเสธ' && (
                  <button
                    onClick={() => updateStatus(row, 'รอการตัดสินใจ')}
                    disabled={isProcessing}
                    style={{ width: '100%', padding: '9px', borderRadius: 10, border: `1px solid ${BRAND.border}`, background: 'transparent', color: BRAND.textSec, fontSize: 12, cursor: 'pointer' }}
                  >
                    ↩️ ส่งกลับรอตัดสินใจ
                  </button>
                )}
                {activeTab === 'สร้างสัญญาแล้ว' && (
                  <button
                    onClick={() => {
                      if (!window.confirm(`ยืนยันยกเลิกสัญญาของ "${row['รหัส/ชื่อทรัพย์'] || '—'}"?\n\nลูกค้าจะถูกซ่อนออกจากระบบ แต่ข้อมูลยังคงอยู่`)) return;
                      cancelCustomer(row);
                    }}
                    disabled={isProcessing}
                    style={{ width: '100%', padding: '9px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    🚫 ยกเลิกสัญญา (ลูกค้าเปลี่ยนใจ)
                  </button>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Contract Modal */}
      {contractModal && (
        <ContractModal
          row={contractModal}
          appsScriptUrl={appsScriptUrl}
          onClose={() => setContractModal(null)}
          onSuccess={handleContractSuccess}
        />
      )}
    </div>
  );
}

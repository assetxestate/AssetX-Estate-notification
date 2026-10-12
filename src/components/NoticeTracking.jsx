import React, { useEffect, useState } from 'react'
import { NOTICE_STATUSES, validateNotice } from '../lib/noticeTracking.js'
import './NoticeTracking.css'

const empty = () => ({ status: 'sent', sentDate: '', channel: '', trackingNumber: '', deliveredDate: '', deliveryEvidence: '', receiptNumber: '', receiptDate: '', issuer: '', expenseDescription: '', amount: '', paymentStatus: 'unknown', paidDate: '', notes: '' })
async function request(customerId, method = 'GET', body) {
  const response = await fetch(`/api/notices?customerId=${encodeURIComponent(customerId)}`, {
    method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify({ ...body, customerId: String(customerId) }) } : {}),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || (method === 'GET' && !Array.isArray(data.records))) throw new Error(data.error || 'ไม่สามารถเชื่อมต่อระบบ Notice')
  return data
}

export default function NoticeTracking({ customerId }) {
  const [records, setRecords] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [receipt, setReceipt] = useState(null)
  useEffect(() => {
    let active = true
    request(customerId).then(data => { if (active) setRecords(data.records) }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [customerId])
  const refresh = async () => {
    setBusy(true)
    try { const data = await request(customerId); setRecords(data.records); setError('') } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const start = (record) => {
    setReceipt(null)
    setEditing(record || { id: crypto.randomUUID() })
    setForm(record ? { ...empty(), ...record.payload, amount: record.payload.amount ?? '' } : empty())
    setMessage('')
  }
  const save = async event => {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const payload = validateNotice(form)
      let receiptUpload
      if (receipt) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(',')[1])
          reader.onerror = () => reject(new Error('อ่านใบเสร็จไม่สำเร็จ'))
          reader.readAsDataURL(receipt)
        })
        receiptUpload = { name: receipt.name, type: receipt.type, base64 }
      }
      const { record } = await request(customerId, editing.version ? 'PATCH' : 'POST', { id: editing.id, version: editing.version, payload, receiptUpload })
      setRecords(prev => editing.version ? prev.map(item => item.id === record.id ? record : item) : [record, ...prev])
      setForm(null); setMessage('บันทึก Notice แล้ว')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const downloadReceipt = async record => {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/notices?customerId=${encodeURIComponent(customerId)}&receiptId=${encodeURIComponent(record.id)}`, { credentials: 'same-origin' })
      const data = await response.json()
      if (!response.ok || !data.url) throw new Error(data.error || 'เปิดใบเสร็จไม่สำเร็จ')
      const link = document.createElement('a')
      link.href = data.url; link.rel = 'noopener noreferrer'; link.target = '_blank'; link.click()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const field = (key, label, type = 'text') => <label>{label}<input type={type} value={form[key]} maxLength={2000} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>
  return <details className="notice-tracking">
    <summary>{records === null ? 'Notice · ยังไม่ยืนยันสถานะ' : records.length ? NOTICE_STATUSES[records[0].payload.status] : 'Notice · ยังไม่มีบันทึกการส่ง'}</summary>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <div className="notice-actions">
      <button type="button" disabled={busy} onClick={refresh}>โหลดประวัติใหม่</button>
      <button type="button" disabled={busy || records === null || !!form} onClick={() => start()}>บันทึกการส่ง Notice</button>
    </div>
    {records?.map(record => <div key={record.id} className="notice-entry">
      <strong>{NOTICE_STATUSES[record.payload.status]}</strong>
      <div>ส่ง: {record.payload.sentDate || 'ยังไม่ระบุวันที่'} · {record.payload.channel || 'ยังไม่ระบุช่องทาง'}</div>
      <div>เลขติดตาม: {record.payload.trackingNumber || 'ยังไม่ระบุ'}</div>
      {record.payload.status === 'delivered' && <div>รับ: {record.payload.deliveredDate} · {record.payload.deliveryEvidence}</div>}
      <div>บิล/ใบเสร็จ: {record.payload.receiptNumber || 'ยังไม่ระบุ'} · {record.payload.issuer || 'ยังไม่ระบุผู้ออก'}</div>
      <div>ค่าใช้จ่าย: {record.payload.amount == null ? 'ยังไม่ทราบยอด' : `${Number(record.payload.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`} · {{ unknown: 'ยังไม่ทราบสถานะชำระ', unpaid: 'ยังไม่ชำระ', paid: 'ชำระแล้ว' }[record.payload.paymentStatus]}</div>
      <button type="button" disabled={busy || !!form} onClick={() => start(record)}>รายละเอียด / แก้ไข</button>
      {record.payload.receiptFile && <button type="button" disabled={busy} onClick={() => downloadReceipt(record)}>ดาวน์โหลดใบเสร็จ: {record.payload.receiptFile.name}</button>}
    </div>)}
    {form && <form onSubmit={save}>
      <fieldset disabled={busy}>
        <legend>{editing.version ? 'แก้ไขประวัติ Notice' : 'บันทึกการส่งครั้งใหม่'}</legend>
        <div className="notice-fields">
          <label>สถานะหนังสือ<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value, ...(e.target.value !== 'delivered' ? { deliveredDate: '', deliveryEvidence: '' } : {}) })}>{Object.entries(NOTICE_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {field('sentDate', 'วันที่ส่ง', 'date')}
          {field('channel', 'ช่องทาง / ผู้ให้บริการจัดส่ง')}
          {field('trackingNumber', 'เลขติดตาม / เลขอ้างอิง')}
          {form.status === 'delivered' && <>{field('deliveredDate', 'วันที่รับหนังสือ', 'date')}{field('deliveryEvidence', 'หลักฐานรับ / ผู้ลงชื่อรับ')}</>}
          {field('receiptNumber', 'เลขที่บิล / ใบเสร็จ')}
          <label>ใบเสร็จการจัดส่ง (JPG, PNG, PDF ไม่เกิน 2 MB)
            <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => {
              const file = e.target.files?.[0]
              setReceipt(null)
              if (!file) return
              if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) || file.size > 2 * 1024 * 1024 || !file.size) {
                setError('กรุณาเลือก JPG, PNG หรือ PDF ขนาดไม่เกิน 2 MB'); e.target.value = ''; return
              }
              setError(''); setReceipt(file)
            }} />
            {form.receiptFile && <span>ไฟล์เดิม: {form.receiptFile.name}</span>}
          </label>
          {field('receiptDate', 'วันที่บิล / ใบเสร็จ', 'date')}
          {field('issuer', 'ผู้ออกบิล / ผู้รับเงิน')}
          {field('expenseDescription', 'รายการค่าใช้จ่าย')}
          {field('amount', 'ยอดรวมตามบิล (บาท)', 'number')}
          <label>สถานะค่าใช้จ่าย<select value={form.paymentStatus} onChange={e => setForm({ ...form, paymentStatus: e.target.value, ...(e.target.value !== 'paid' ? { paidDate: '' } : {}) })}><option value="unknown">ยังไม่ทราบ</option><option value="unpaid">ยังไม่ชำระ</option><option value="paid">ชำระแล้ว</option></select></label>
          {form.paymentStatus === 'paid' && field('paidDate', 'วันที่ชำระค่าใช้จ่าย', 'date')}
          {field('notes', 'หมายเหตุ / ที่เก็บเอกสารอ้างอิง')}
        </div>
        <div className="notice-actions"><button type="submit">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button><button type="button" onClick={() => setForm(null)}>ยกเลิก</button></div>
      </fieldset>
    </form>}
  </details>
}

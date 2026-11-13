// ปุ่มสลับโหมดมืด/สว่าง (13 พ.ย. 2569) — ใช้บนแถบหัวของหน้าหลักและหน้าการตลาด · จำค่าที่เลือกไว้ในเครื่อง
import React from 'react'
import { BRAND } from '../lib/config.js'
import { toggleTheme, useTheme } from '../lib/theme.js'

export function ThemeToggle({ className, style }) {
  const dark = useTheme() === 'dark'
  const label = dark ? 'เปลี่ยนเป็นโหมดสว่าง (พื้นขาว)' : 'เปลี่ยนเป็นโหมดมืด'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={className}
      aria-label={label}
      title={label}
      style={className ? style : {
        background: 'transparent',
        border: `1px solid ${BRAND.borderLt}`,
        padding: '6px 12px',
        borderRadius: 8,
        color: BRAND.textSec,
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span aria-hidden="true">{dark ? '☀️' : '🌙'}</span> {dark ? 'สว่าง' : 'มืด'}
    </button>
  )
}

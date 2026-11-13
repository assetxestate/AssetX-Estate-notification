// โหมดสีของแอป (เจ้าของขอ 13 พ.ย. 2569: ทั้งแอปพื้นขาวเพื่อความสบายตา + ปุ่มสลับมืด/สว่าง)
// ค่าเริ่มต้น = สว่าง · จำค่าที่เลือกไว้ในเครื่อง (localStorage) · ตั้งเป็น <html data-theme="light|dark"> ซึ่ง src/theme.css อ่าน
// index.html ตั้งค่าก่อนหน้าแสดงผล (ไม่กะพริบ) — ชื่อคีย์และค่าเริ่มต้นต้องตรงกับที่นั่น
import { useSyncExternalStore } from 'react'

export const THEME_KEY = 'assetx-theme'
export const DEFAULT_THEME = 'light'
const listeners = new Set()

function readStored() {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
}

export function getTheme() {
  if (typeof document !== 'undefined') {
    const current = document.documentElement.dataset.theme
    if (current === 'dark' || current === 'light') return current
  }
  return readStored() || DEFAULT_THEME
}

export function applyTheme(theme) {
  const value = theme === 'dark' ? 'dark' : 'light'
  const root = document.documentElement
  root.dataset.theme = value
  root.style.colorScheme = value
  listeners.forEach((listener) => listener())
  return value
}

export function setTheme(theme) {
  const value = applyTheme(theme)
  try { localStorage.setItem(THEME_KEY, value) } catch { /* โหมดส่วนตัว/บล็อกที่เก็บข้อมูล: ใช้ได้เฉพาะรอบนี้ */ }
  return value
}

export function toggleTheme() {
  return setTheme(getTheme() === 'dark' ? 'light' : 'dark')
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  return useSyncExternalStore(subscribe, getTheme, () => DEFAULT_THEME)
}

// สี + ความโปร่งใสแบบเลขฐานสิบหก 2 หลัก (เช่น '33' = 20%) — สีที่เป็นตัวแปร CSS ต่อสตริงตรง ๆ ไม่ได้ จึงใช้ color-mix
export function withAlpha(color, alphaHex) {
  if (typeof color !== 'string' || !color) return color
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color + alphaHex
  const percent = Math.round((parseInt(alphaHex, 16) / 255) * 1000) / 10
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`
}

// การ์ดความรู้ประเภทเอกสารสิทธิ์ — ใช้ในหน้ากฎหมาย (เต็ม) และหน้าประเมิน (ย่อ) · ข้อมูลทั้งหมดจาก src/lib/deedTypes.js
import React from 'react'
import { BRAND } from '../lib/config.js'
import { withAlpha } from '../lib/theme.js'
import {
  DEED_TYPES, DEED_GROUPS, DEED_RIGHTS, TX_LABELS, TX_STATUS, deedTypeOf, deedVerdict, deedSource,
} from '../lib/deedTypes.js'

export const DEED_STATUS_COLOR = { yes: 'var(--ax-c-10b981)', check: BRAND.gold, no: 'var(--ax-c-ef4444)' }

export function DeedStatusChip({ tx, status, active = false }) {
  const color = DEED_STATUS_COLOR[status] || BRAND.textSec
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
      color, background: withAlpha(color, active ? '26' : '14'), border: `1px solid ${withAlpha(color, active ? '80' : '40')}`, whiteSpace: 'nowrap',
    }}>
      {TX_STATUS[status]?.icon} {TX_LABELS[tx]}{TX_STATUS[status]?.label}
    </span>
  )
}

export function DeedTxChips({ type, activeTx }) {
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
      {Object.keys(TX_LABELS).map((tx) => <DeedStatusChip key={tx} tx={tx} status={type.tx[tx].s} active={tx === activeTx} />)}
    </span>
  )
}

// select ประเภทเอกสารแบ่งกลุ่ม
export function DeedTypeSelect({ value, onChange, style, id }) {
  const groups = Object.keys(DEED_GROUPS).map((g) => [g, DEED_TYPES.filter((t) => t.group === g)]).filter(([, list]) => list.length)
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} style={style}>
      {groups.map(([g, list]) => (
        <optgroup key={g} label={DEED_GROUPS[g]}>
          {list.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

function SmallList({ title, items, color }) {
  if (!items?.length) return null
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.textSec, marginBottom: 4 }}>{title}</div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, fontSize: 12, color: BRAND.textPri, lineHeight: 1.55, marginBottom: 3 }}>
          <span style={{ color, flexShrink: 0 }}>•</span><span>{item}</span>
        </div>
      ))}
    </div>
  )
}

export function DeedRefs({ refs = [] }) {
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {refs.map((r, i) => {
        const src = deedSource(r)
        if (!src) return null
        return (
          <div key={i} style={{ fontSize: 11, color: BRAND.textSec, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700, color: src.official ? 'var(--ax-c-10b981)' : BRAND.gold }}>{src.official ? 'ทางการ' : 'แหล่งรอง'}</span>
            {' · '}
            <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ color: BRAND.teal }}>{src.title}</a>
            {r.at ? ` — ${r.at}` : ''}
          </div>
        )
      })}
    </div>
  )
}

// compact = การ์ดย่อในหน้าประเมิน (ไม่มีรายการที่มาแบบเต็ม)
export function DeedTypeCard({ typeKey, assessmentType, compact = false }) {
  const type = deedTypeOf(typeKey)
  if (!type) return null
  const verdict = deedVerdict(typeKey, assessmentType)
  const color = verdict ? DEED_STATUS_COLOR[verdict.status] : BRAND.teal
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${withAlpha(color, '55')}`, background: withAlpha(color, '0d'), padding: compact ? '12px 14px' : '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.textPri }}>{type.name}</div>
        <span style={{ fontSize: 11, color: BRAND.textSec }}>{DEED_RIGHTS[type.right]}</span>
      </div>
      <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 4, lineHeight: 1.6 }}>{type.summary}</div>
      <div style={{ fontSize: 11, color: BRAND.textMut, marginTop: 4 }}>ผู้ออก: {type.issuer}</div>
      {verdict && (
        <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: withAlpha(color, '18'), border: `1px solid ${withAlpha(color, '50')}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color }}>{verdict.icon} {verdict.txLabel}{verdict.statusLabel}</div>
          <div style={{ fontSize: 12, color: BRAND.textPri, marginTop: 3, lineHeight: 1.55 }}>{verdict.note}</div>
        </div>
      )}
      <div style={{ marginTop: 10 }}><DeedTxChips type={type} activeTx={verdict?.tx} /></div>
      {!compact && Object.keys(TX_LABELS).filter((tx) => tx !== verdict?.tx).map((tx) => (
        <div key={tx} style={{ fontSize: 12, color: BRAND.textSec, marginTop: 6, lineHeight: 1.55 }}>
          <strong style={{ color: DEED_STATUS_COLOR[type.tx[tx].s] }}>{TX_LABELS[tx]}:</strong> {type.tx[tx].note}
        </div>
      ))}
      <SmallList title="ข้อจำกัด" items={compact ? type.limits.slice(0, 3) : type.limits} color={BRAND.gold} />
      <SmallList title="ตรวจก่อนวันจด" items={type.checks} color={BRAND.teal} />
      {!compact && <DeedRefs refs={type.refs} />}
    </div>
  )
}

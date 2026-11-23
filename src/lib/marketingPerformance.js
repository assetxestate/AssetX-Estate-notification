// ผลวัดต่อคอนเทนต์ต่อช่องทาง + การทดลอง + บทเรียน ของ /marketing (FR-08 · FR-09 · เฟส P2 · 23 พ.ย. 2569) — ตรรกะล้วน
// หลัก:
//   - หนึ่งบันทึก = คอนเทนต์หนึ่งชิ้น (#เลข) × ช่องทางหนึ่ง × ช่วงวัดหนึ่ง · #12 บน Facebook กับ #12 บน TikTok เป็นคนละบันทึก
//   - ไม่มีข้อมูล (null) ≠ ศูนย์: ช่องว่างเก็บเป็น null แสดงว่า "ไม่มีข้อมูล" ไม่ถูกนับเป็น 0 และไม่ถูกเอาไปหาร
//   - อัตราคำนวณเมื่อตัวหารมีข้อมูลและมากกว่าศูนย์เท่านั้น
//   - นำเข้าซ้ำด้วยกุญแจเดิม = แทนที่บันทึกเดิม ไม่บวกซ้ำ · ทุกบันทึกบอกที่มา (กรอกเอง / CSV / API)
//   - ไม่ประกาศผู้ชนะและไม่อ้างเหตุและผลเมื่อข้อมูลไม่พอ · ไม่มีการทำนายยอด
// เก็บใน workspace.performance และ workspace.experiments (ตัวเลขล้วน ขนาดเล็ก) — ยังไม่ได้เชื่อม Insights ของแพลตฟอร์มใด
export const PLATFORMS = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', 'youtube-shorts': 'YouTube Shorts', 'line-oa': 'LINE OA' }
export const WINDOWS = { '48h': '48 ชั่วโมงแรก', '7d': '7 วัน', '28d': '28 วัน', custom: 'ช่วงอื่น' }
export const SOURCE_METHODS = { manual: 'กรอกเอง', csv: 'นำเข้า CSV', api: 'ดึงจากแพลตฟอร์ม' }
export const METRIC_GROUPS = [
  { key: 'discovery', label: 'การค้นพบ', note: 'คนเห็นกี่คน ไม่ได้บอกคุณภาพของลีด', fields: ['reach', 'impressions', 'plays', 'views'] },
  { key: 'value', label: 'คุณค่า', note: 'คนเห็นว่าน่าแชร์หรือน่าเก็บ', fields: ['shares', 'saves', 'comments'] },
  { key: 'retention', label: 'การดูต่อ', note: 'เฉพาะวิดีโอ นิยามต่างกันแต่ละแพลตฟอร์ม', fields: ['avg_watch_time'] },
  { key: 'business', label: 'ธุรกิจ', note: 'ผลที่นำไปสู่งานจริง', fields: ['profile_visits', 'link_clicks', 'dm_inquiries', 'leads', 'qualified_leads', 'appointments', 'assessed_cases', 'spend'] },
]
export const METRIC_LABELS = {
  reach: 'เข้าถึง', impressions: 'จำนวนครั้งที่แสดง', plays: 'เล่นวิดีโอ', views: 'ยอดดู', avg_watch_time: 'ดูเฉลี่ย (วินาที)',
  shares: 'แชร์', saves: 'บันทึก', comments: 'คอมเมนต์', profile_visits: 'เข้าดูโปรไฟล์', link_clicks: 'คลิกลิงก์', dm_inquiries: 'ทักแชต',
  leads: 'ลีด', qualified_leads: 'ลีดคุณภาพ', appointments: 'นัดหมาย', assessed_cases: 'เคสที่ประเมิน', spend: 'ค่าโฆษณา (บาท)',
}
export const METRIC_FIELDS = METRIC_GROUPS.flatMap((group) => group.fields)
export const MIN_PEERS = 5 // เทียบค่ากลางของกลุ่มเดียวกันเมื่อมีอย่างน้อยเท่านี้
export const MIN_PER_VARIANT = 3 // การทดลอง: ต้องมีโพสต์ที่มีข้อมูลต่อแบบอย่างน้อยเท่านี้จึงสรุปทิศทางได้

const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const isoOrNull = (value) => { const raw = String(value ?? '').trim(); if (!raw) return null; const ms = Date.parse(raw); return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined }

// ค่าตัวเลขของช่องผลวัด: ว่าง = null (ไม่มีข้อมูล) · ตัวเลขไม่ติดลบ = ค่านั้น · อย่างอื่น = undefined (ผิด)
export function metricValue(raw) {
  if (raw === null || raw === undefined) return null
  const cleaned = String(raw).replace(/,/g, '').trim()
  if (cleaned === '' || cleaned === '-' || /^(n\/a|na|null|ไม่มีข้อมูล)$/i.test(cleaned)) return null
  const number = Number(cleaned)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

export function normalizePlatform(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (/facebook|^fb$/.test(raw)) return 'facebook'
  if (/instagram|^ig$/.test(raw)) return 'instagram'
  if (/tiktok|reels?$/.test(raw)) return 'tiktok'
  if (/youtube|shorts/.test(raw)) return 'youtube-shorts'
  if (/line/.test(raw)) return 'line-oa'
  return Object.hasOwn(PLATFORMS, raw) ? raw : ''
}

export function normalizeSnapshot(input = {}, { now = new Date() } = {}) {
  const errors = []
  const contentNo = Number(String(input.content_no ?? input.contentNo ?? '').replace(/^#/, ''))
  if (!Number.isInteger(contentNo) || contentNo <= 0) errors.push('เลขคอนเทนต์ (#) ไม่ถูกต้อง')
  const platform = normalizePlatform(input.platform)
  if (!platform) errors.push('ไม่รู้จักช่องทาง')
  const window = Object.hasOwn(WINDOWS, input.window) ? input.window : (String(input.window || '').trim() ? '' : '7d')
  if (!window) errors.push('ช่วงวัดไม่ถูกต้อง (48h · 7d · 28d · custom)')
  const publishedAt = isoOrNull(input.published_at)
  const collectedAt = isoOrNull(input.collected_at) ?? null
  if (publishedAt === undefined) errors.push('วันที่โพสต์ไม่ถูกต้อง')
  if (collectedAt === undefined) errors.push('วันที่เก็บข้อมูลไม่ถูกต้อง')
  const metrics = {}
  for (const field of METRIC_FIELDS) {
    const value = metricValue(input.metrics ? input.metrics[field] : input[field])
    if (value === undefined) errors.push(`${METRIC_LABELS[field]}: ต้องเป็นตัวเลขไม่ติดลบ หรือเว้นว่างเมื่อไม่มีข้อมูล`)
    else metrics[field] = value
  }
  if (!errors.length && METRIC_FIELDS.every((field) => metrics[field] === null)) errors.push('ยังไม่ได้กรอกผลวัดสักช่อง')
  const value = {
    content_no: contentNo, platform, window,
    platform_post_id: text(input.platform_post_id, 80),
    published_at: publishedAt || null,
    collected_at: collectedAt || now.toISOString(),
    source_method: Object.hasOwn(SOURCE_METHODS, input.source_method) ? input.source_method : 'manual',
    paid_or_organic: input.paid_or_organic === 'paid' ? 'paid' : 'organic',
    import_key: text(input.import_key, 80),
    note: text(input.note, 200),
    metrics,
  }
  return { ok: errors.length === 0, value: { ...value, key: snapshotKey(value) }, errors }
}

// กุญแจของบันทึก: คอนเทนต์ × ช่องทาง × ช่วงวัด (หรือกุญแจนำเข้าที่ไฟล์ระบุมาเอง)
export const snapshotKey = (snapshot) => (snapshot.import_key ? `k:${snapshot.import_key}` : `${snapshot.content_no}|${snapshot.platform}|${snapshot.window}`)

// รวมบันทึกใหม่เข้ากับของเดิม: กุญแจซ้ำ = แทนที่ (ไม่บวกซ้ำ) · คืน { list, added, updated }
export function upsertSnapshots(existing = [], incoming = []) {
  const map = new Map((Array.isArray(existing) ? existing : []).map((item) => [item.key || snapshotKey(item), item]))
  let added = 0
  let updated = 0
  for (const item of incoming) {
    const key = item.key || snapshotKey(item)
    if (map.has(key)) updated += 1
    else added += 1
    map.set(key, { ...item, key })
  }
  return { list: [...map.values()].sort((a, b) => String(b.collected_at).localeCompare(String(a.collected_at))), added, updated }
}

// อัตรา: มีค่าเมื่อทั้งตัวตั้งและตัวหารมีข้อมูล และตัวหารมากกว่าศูนย์ · ไม่งั้น null (ไม่มีข้อมูล)
export const rate = (numerator, denominator) => (numerator === null || numerator === undefined || denominator === null || denominator === undefined || !(denominator > 0) ? null : numerator / denominator)

export function derived(snapshot) {
  const m = snapshot?.metrics || {}
  return {
    share_rate: rate(m.shares, m.reach),
    save_rate: rate(m.saves, m.reach),
    qualified_rate: rate(m.qualified_leads, m.leads),
    appointment_rate: rate(m.appointments, m.leads),
    cost_per_qualified: rate(m.spend, m.qualified_leads),
  }
}

// ── CSV ──────────────────────────────────────────────────────────────────────────────
const HEADER_ALIASES = {
  content_no: ['content_no', 'content', 'no', '#', 'เลขคอนเทนต์', 'เลข', 'คอนเทนต์'],
  platform: ['platform', 'channel', 'ช่องทาง', 'แพลตฟอร์ม'],
  window: ['window', 'ช่วงวัด', 'ช่วง'],
  platform_post_id: ['platform_post_id', 'post_id', 'รหัสโพสต์'],
  published_at: ['published_at', 'วันที่โพสต์'],
  collected_at: ['collected_at', 'วันที่เก็บ', 'วันที่เก็บข้อมูล'],
  paid_or_organic: ['paid_or_organic', 'paid', 'ประเภท'],
  import_key: ['import_key', 'key', 'กุญแจ'],
  note: ['note', 'notes', 'หมายเหตุ'],
  ...Object.fromEntries(METRIC_FIELDS.map((field) => [field, [field, METRIC_LABELS[field]]])),
}
const HEADER_LOOKUP = new Map(Object.entries(HEADER_ALIASES).flatMap(([field, names]) => names.map((name) => [name.toLowerCase().replace(/\s+/g, ''), field])))

function splitCsvLine(line) {
  const cells = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quoted) { if (ch === '"' && line[i + 1] === '"') { current += '"'; i += 1 } else if (ch === '"') quoted = false; else current += ch }
    else if (ch === '"') quoted = true
    else if (ch === ',' || ch === '\t') { cells.push(current); current = '' }
    else current += ch
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

// อ่าน CSV → ตัวอย่างก่อนบันทึก { ok, rows: [{ line, value?, errors }], unknownHeaders, missingHeaders, valid }
// knownNos = เลขคอนเทนต์ที่มีจริง (ถ้าส่งมา แถวที่อ้างเลขที่ไม่มีถือว่าผิด)
export function parsePerformanceCsv(csv, { knownNos = null, now = new Date() } = {}) {
  const lines = String(csv ?? '').replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return { ok: false, rows: [], unknownHeaders: [], missingHeaders: [], valid: [], error: 'ไฟล์ต้องมีบรรทัดหัวตารางและข้อมูลอย่างน้อยหนึ่งแถว' }
  const headers = splitCsvLine(lines[0])
  const fields = headers.map((header) => HEADER_LOOKUP.get(header.toLowerCase().replace(/\s+/g, '')) || null)
  const unknownHeaders = headers.filter((_, index) => !fields[index])
  const missingHeaders = ['content_no', 'platform'].filter((field) => !fields.includes(field))
  if (missingHeaders.length) return { ok: false, rows: [], unknownHeaders, missingHeaders, valid: [], error: `หัวตารางขาดคอลัมน์ที่จำเป็น: ${missingHeaders.map((field) => HEADER_ALIASES[field][0]).join(', ')}` }
  const rows = lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line)
    const record = {}
    fields.forEach((field, i) => { if (field) record[field] = cells[i] ?? '' })
    const result = normalizeSnapshot({ ...record, source_method: 'csv' }, { now })
    const errors = [...result.errors]
    if (result.ok && knownNos && !knownNos.has(result.value.content_no)) errors.push(`ไม่พบคอนเทนต์ #${result.value.content_no}`)
    return { line: index + 2, value: errors.length ? null : result.value, errors }
  })
  const valid = rows.filter((row) => row.value).map((row) => row.value)
  return { ok: valid.length > 0, rows, unknownHeaders, missingHeaders, valid, error: valid.length ? '' : 'ไม่มีแถวที่ใช้ได้' }
}

// ── สรุป ─────────────────────────────────────────────────────────────────────────────
// รวมต่อกลุ่ม: แต่ละช่องรวมเฉพาะบันทึกที่มีข้อมูล และบอกว่ามาจากกี่บันทึก · ไม่มีเลย = null (แสดงว่า "ไม่มีข้อมูล")
export function summarize(snapshots = []) {
  const totals = {}
  for (const field of METRIC_FIELDS) {
    const withData = snapshots.filter((item) => item.metrics?.[field] !== null && item.metrics?.[field] !== undefined)
    totals[field] = { value: withData.length ? withData.reduce((sum, item) => sum + item.metrics[field], 0) : null, records: withData.length }
  }
  // เวลาดูเฉลี่ยไม่ใช่ยอดรวม: ใช้ค่าเฉลี่ยของบันทึกที่มีข้อมูล
  if (totals.avg_watch_time.records) totals.avg_watch_time.value = Math.round((totals.avg_watch_time.value / totals.avg_watch_time.records) * 10) / 10
  return { records: snapshots.length, groups: METRIC_GROUPS.map((group) => ({ ...group, metrics: group.fields.map((field) => ({ field, label: METRIC_LABELS[field], ...totals[field] })) })) }
}

export function median(values) {
  const list = values.filter((value) => value !== null && value !== undefined && Number.isFinite(value)).sort((a, b) => a - b)
  if (!list.length) return null
  const mid = Math.floor(list.length / 2)
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2
}

// เทียบกับค่ากลางของบันทึกกลุ่มเดียวกัน (ช่องทาง + ช่วงวัดเดียวกัน ไม่รวมตัวเอง) · ไม่ถึงขั้นต่ำ = บอกว่าข้อมูลไม่พอ
export function compareToPeers(snapshot, all = [], field = 'reach') {
  const own = snapshot?.metrics?.[field]
  const peers = all.filter((item) => item.key !== snapshot.key && item.platform === snapshot.platform && item.window === snapshot.window).map((item) => item.metrics?.[field]).filter((value) => value !== null && value !== undefined)
  if (own === null || own === undefined) return { status: 'no_data', text: 'ไม่มีข้อมูล' }
  if (peers.length < MIN_PEERS) return { status: 'insufficient', text: `ยังเทียบไม่ได้ (มีโพสต์กลุ่มเดียวกัน ${peers.length} จากขั้นต่ำ ${MIN_PEERS})`, peers: peers.length }
  const mid = median(peers)
  return { status: own > mid ? 'above' : own < mid ? 'below' : 'equal', median: mid, peers: peers.length, text: `${own > mid ? 'สูงกว่า' : own < mid ? 'ต่ำกว่า' : 'เท่ากับ'}ค่ากลางของ ${peers.length} โพสต์กลุ่มเดียวกัน (${mid})` }
}

// ── การทดลอง ─────────────────────────────────────────────────────────────────────────
export const DECISIONS = { repeat: 'ทำซ้ำ', expand: 'ขยาย', revise: 'ปรับ', retire: 'เลิก', insufficient_data: 'ข้อมูลไม่พอ' }

export function normalizeExperiment(input = {}, { now = new Date() } = {}) {
  const errors = []
  const hypothesis = text(input.hypothesis, 300)
  if (!hypothesis) errors.push('เขียนสมมติฐานที่จะทดสอบ')
  const primary = METRIC_FIELDS.includes(input.primary_metric) ? input.primary_metric : ''
  if (!primary) errors.push('เลือกตัววัดหลัก')
  const variants = (Array.isArray(input.variants) ? input.variants : []).map((variant, index) => ({
    label: text(variant?.label, 60) || `แบบ ${String.fromCharCode(65 + index)}`,
    content_nos: [...new Set(String(Array.isArray(variant?.content_nos) ? variant.content_nos.join(',') : variant?.content_nos ?? '').split(/[\s,#]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0))],
  })).filter((variant) => variant.content_nos.length)
  if (variants.length < 2) errors.push('ต้องมีอย่างน้อย 2 แบบ และแต่ละแบบต้องมีเลขคอนเทนต์')
  const value = {
    id: input.id || `exp-${now.getTime().toString(36)}`, hypothesis, primary_metric: primary, variants,
    platform: normalizePlatform(input.platform) || '', window: Object.hasOwn(WINDOWS, input.window) ? input.window : '7d',
    notes: text(input.notes, 300), confounders: text(input.confounders, 300), created_at: input.created_at || now.toISOString(),
    decision: Object.hasOwn(DECISIONS, input.decision) ? input.decision : '', decided_at: input.decided_at || null,
  }
  return { ok: errors.length === 0, value, errors }
}

// อ่านผลการทดลองอย่างระมัดระวัง: ไม่บอกว่าแบบไหนชนะเมื่อข้อมูลไม่พอ และไม่อ้างเหตุและผล
export function experimentReadout(experiment, snapshots = []) {
  const field = experiment.primary_metric
  const variants = experiment.variants.map((variant) => {
    const rows = snapshots.filter((item) => variant.content_nos.includes(item.content_no) && (!experiment.platform || item.platform === experiment.platform) && item.window === experiment.window)
    const values = rows.map((item) => item.metrics?.[field]).filter((value) => value !== null && value !== undefined)
    return { label: variant.label, content_nos: variant.content_nos, with_data: values.length, median: median(values), paid: rows.some((item) => item.paid_or_organic === 'paid'), platforms: [...new Set(rows.map((item) => item.platform))] }
  })
  const warnings = []
  if (variants.some((variant) => variant.paid) && !variants.every((variant) => variant.paid)) warnings.push('บางแบบมีโพสต์ที่ยิงโฆษณา บางแบบไม่มี — เทียบกันตรง ๆ ไม่ได้')
  if (new Set(variants.flatMap((variant) => variant.platforms)).size > 1 && !experiment.platform) warnings.push('โพสต์ในการทดลองอยู่คนละช่องทาง — นิยามของตัววัดต่างกัน ควรเทียบในช่องทางเดียวกัน')
  if (experiment.confounders) warnings.push(`ปัจจัยอื่นที่จดไว้: ${experiment.confounders}`)
  const enough = variants.every((variant) => variant.with_data >= MIN_PER_VARIANT)
  if (!enough) {
    return { status: 'insufficient_data', variants, warnings, summary: `ข้อมูลไม่พอ: ต้องมีโพสต์ที่มีข้อมูล ${METRIC_LABELS[field]} อย่างน้อย ${MIN_PER_VARIANT} ชิ้นต่อแบบ (ตอนนี้ ${variants.map((variant) => `${variant.label} ${variant.with_data}`).join(' · ')}) — ยังไม่สรุปว่าแบบไหนดีกว่า` }
  }
  const sorted = [...variants].sort((a, b) => b.median - a.median)
  const tie = sorted[0].median === sorted[1].median
  return {
    status: 'directional', variants, warnings,
    summary: tie
      ? `ค่ากลางของ ${METRIC_LABELS[field]} เท่ากัน (${sorted[0].median}) — ยังไม่เห็นความต่าง`
      : `ค่ากลางของ ${METRIC_LABELS[field]}: ${sorted.map((variant) => `${variant.label} ${variant.median}`).join(' · ')} — ${sorted[0].label} สูงกว่าในชุดนี้ เป็นทิศทางเบื้องต้นจากโพสต์จำนวนน้อย ยังไม่ใช่ข้อสรุปว่าเพราะอะไร ควรทดสอบซ้ำก่อนเปลี่ยนแนวทาง`,
  }
}

// บทเรียนรวม: บอกสิ่งที่เห็นจากตัวเลข สิ่งที่ยังไม่รู้ และการทดสอบถัดไป · ข้อมูลน้อย = บอกว่าไม่พอ ไม่ฟันธง
export function learningSummary(snapshots = [], experiments = []) {
  const withReach = snapshots.filter((item) => item.metrics?.reach > 0)
  if (snapshots.length < MIN_PEERS) {
    return { status: 'insufficient_data', worked: [], failed: [], unknown: [`มีบันทึกผล ${snapshots.length} รายการ น้อยกว่า ${MIN_PEERS} — ยังไม่พอจะบอกว่าอะไรได้ผล`], next: ['บันทึกผล 48 ชั่วโมงและ 7 วันของทุกโพสต์ให้ครบก่อน', 'ตั้งการทดลองหนึ่งเรื่อง แล้วทำอย่างน้อย 3 โพสต์ต่อแบบ'] }
  }
  const worked = []
  const failed = []
  const unknown = []
  const byRate = (field) => withReach.map((item) => ({ item, value: rate(item.metrics[field], item.metrics.reach) })).filter((row) => row.value !== null)
  for (const [field, label] of [['shares', 'แชร์ต่อการเข้าถึง'], ['saves', 'บันทึกต่อการเข้าถึง']]) {
    const rows = byRate(field)
    if (rows.length < MIN_PEERS) { unknown.push(`${label}: มีข้อมูล ${rows.length} โพสต์ ยังไม่พอเทียบ`); continue }
    const mid = median(rows.map((row) => row.value))
    const top = rows.filter((row) => row.value > mid).sort((a, b) => b.value - a.value).slice(0, 3)
    const low = rows.filter((row) => row.value < mid).sort((a, b) => a.value - b.value).slice(0, 3)
    if (top.length) worked.push(`${label} สูงกว่าค่ากลาง: ${top.map((row) => `#${row.item.content_no} (${PLATFORMS[row.item.platform]})`).join(' · ')}`)
    if (low.length) failed.push(`${label} ต่ำกว่าค่ากลาง: ${low.map((row) => `#${row.item.content_no} (${PLATFORMS[row.item.platform]})`).join(' · ')}`)
  }
  const leads = snapshots.filter((item) => item.metrics?.qualified_leads !== null && item.metrics?.qualified_leads !== undefined)
  if (!leads.length) unknown.push('ยังไม่มีโพสต์ที่บันทึกลีดคุณภาพ — บอกไม่ได้ว่าโพสต์แบบไหนนำไปสู่งานจริง')
  else worked.push(`โพสต์ที่มีลีดคุณภาพ: ${leads.filter((item) => item.metrics.qualified_leads > 0).map((item) => `#${item.content_no}`).join(' · ') || 'ยังไม่มี'}`)
  const open = experiments.filter((experiment) => !experiment.decision)
  const next = [
    ...open.map((experiment) => `การทดลองที่ยังไม่สรุป: ${experiment.hypothesis}`),
    worked.length ? 'ดูว่าโพสต์ที่อยู่เหนือค่ากลางมีอะไรเหมือนกัน (ซีรีส์ มุมเล่า ภาพจริงหรือไม่) แล้วตั้งเป็นสมมติฐานทดสอบรอบถัดไป' : 'ตั้งการทดลองหนึ่งเรื่อง แล้วทำอย่างน้อย 3 โพสต์ต่อแบบ',
  ]
  return { status: 'observed', worked, failed, unknown, next, caution: 'เป็นข้อสังเกตจากตัวเลขที่บันทึก ไม่ได้บอกสาเหตุ และไม่ได้บอกว่าอัลกอริทึมของแพลตฟอร์มทำงานอย่างไร' }
}

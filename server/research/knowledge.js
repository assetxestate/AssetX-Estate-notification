// server/research/knowledge.js — คลังข้อเท็จจริงของ AssetX (research/knowledge_base.json) สำหรับตัวร่างโพสต์
//
// เจ้าของสั่ง 7 พ.ย. 2569 ค่ำ: "สร้างคลังของเราเองเลย" — ร่างจากไอเดียที่ไม่มีข้อเท็จจริง (เลนแอดคู่แข่ง · YouTube ไม่ถอดคำ · ข่าวที่ดึงไม่ได้)
// ออกมาเป็นความรู้ทั่วไปกลวง ๆ จึงมีคลังข้อกฎหมาย/ค่าธรรมเนียม/ขั้นตอนที่ตรวจกับตัวบทแล้ว ให้ผู้เขียนหยิบใช้ได้พร้อมที่มา
// · official = อ่านจากตัวบท/หน้าทางการแล้ว อ้างชื่อกฎหมายและมาตราได้ · secondary = ตัวเลขจากแหล่งรอง ต้องบอกผู้อ่านให้ยืนยันกับสำนักงานที่ดิน
// · จับคู่ด้วยคำในหัวข้อไอเดีย + มุมเล่า + ข้อเท็จจริงที่มี (ไม่ใช้ AI เลือก — ให้ตรวจสอบได้)
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_KB_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'research', 'knowledge_base.json')
export const KB_MIN_MATCHES = 2
// คะแนนต่ำสุดของข้อที่นับว่า "ตรงเรื่อง" — คำเฉพาะ 1 คำในเนื้อ (1.0) หรือคำที่อยู่ ≤ 3 ข้อในหัวข้อไอเดีย (≈0.78) · คำทั่วไปอย่าง "ขายฝาก" ในหัวข้ออย่างเดียว (≈0.5) ไม่พอ
export const KB_MIN_SCORE = 0.75

export function loadKnowledgeBase(file = DEFAULT_KB_FILE) {
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  const sources = raw.sources && typeof raw.sources === 'object' ? raw.sources : {}
  const entries = (Array.isArray(raw.entries) ? raw.entries : [])
    .filter((e) => e && e.id && e.fact && e.source && sources[e.source])
    .map((e, order) => ({ ...e, order, topics: Array.isArray(e.topics) ? e.topics.map(normalize).filter(Boolean) : [], confidence: e.confidence === 'official' ? 'official' : 'secondary' }))
  // คำหัวข้อที่อยู่ในหลายข้อ (ขายฝาก · ค่าใช้จ่าย) บอกเรื่องได้น้อยกว่าคำที่อยู่ข้อเดียว (แจ้งเตือน · วางทรัพย์) → น้ำหนัก 1/(1+log2(จำนวนข้อที่มีคำนั้น))
  const df = new Map()
  for (const e of entries) for (const t of new Set(e.topics)) df.set(t, (df.get(t) || 0) + 1)
  const weights = new Map([...df].map(([t, n]) => [t, 1 / (1 + Math.log2(n))]))
  return { updated: raw.updated || '', sources, entries, weights }
}

function normalize(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim() }

// คะแนน = ผลรวมน้ำหนักของคำหัวข้อของข้อนั้นที่พบในข้อความ (พบในหัวข้อไอเดีย นับสองเท่า) · คืนข้อที่มีคะแนน เรียงมาก→น้อย แล้วตามลำดับในไฟล์
export function matchKnowledge({ title = '', angle = {}, summary = '', extra = '' } = {}, { kb, max = 8, minScore = 0 } = {}) {
  if (!kb?.entries?.length) return []
  const head = normalize(title)
  const body = normalize([angle?.label, angle?.brief, summary, extra].filter(Boolean).join(' '))
  const weight = (t) => kb.weights?.get(t) ?? 1
  const scored = kb.entries.map((e) => {
    let score = 0
    for (const k of e.topics) {
      if (head.includes(k)) score += 2 * weight(k)
      else if (body.includes(k)) score += weight(k)
    }
    return { entry: e, score }
  }).filter((x) => x.score > 0 && x.score >= minScore)
  scored.sort((a, b) => b.score - a.score || a.entry.order - b.entry.order)
  return scored.slice(0, max).map((x) => x.entry)
}

export function knowledgeCite(entry, kb) {
  const src = kb?.sources?.[entry.source] || {}
  return [src.cite || src.label || entry.source, entry.ref].filter(Boolean).join(' ')
}

// บรรทัดข้อเท็จจริงสำหรับ prompt — ข้อ secondary ติดป้าย [ยืนยันตัวเลข] ให้ผู้เขียนบอกผู้อ่านตรวจกับสำนักงานที่ดิน
export function knowledgeFactLines(entries = [], kb) {
  return entries.map((e) => `- ${e.fact} (ที่มา: ${knowledgeCite(e, kb)})${e.confidence === 'official' ? '' : ' [ยืนยันตัวเลข]'}`)
}

export function knowledgeSourceLabels(entries = [], kb) {
  return [...new Set(entries.map((e) => kb?.sources?.[e.source]?.cite || e.source))]
}

export const knowledgeIds = (entries = []) => entries.map((e) => e.id)

const anglesText = (idea) => (Array.isArray(idea?.angles) ? idea.angles : [])
  .filter((a) => a && typeof a === 'object').map((a) => `${a.label || ''} ${a.brief || ''}`).join(' ')

// ข้อจากคลังสำหรับ "ทั้งไอเดีย" — ใช้ตัดสินว่าไอเดียที่ไม่มีข้อเท็จจริงร่างได้ไหม (≥ KB_MIN_MATCHES ข้อที่คะแนน ≥ KB_MIN_SCORE)
// ดูจากหัวข้อ + ข้อเท็จจริงที่มีเท่านั้น ไม่ดูมุมเล่า: มุมเล่าที่ AI เขียนโยงเข้าหาบริการเราทุกเรื่อง (ข่าวงานประกาศรางวัลนายหน้ายังมี "ขายฝาก" ในมุม)
// ถ้านับมุมด้วย ข่าวที่ไม่เกี่ยวกับกลไกขายฝาก/จำนองจะได้ร่างกฎหมายขายฝากไปวางทับ = ร่างที่เปลี่ยนชื่อเรื่องแล้วยังใช้ได้ (วัดครั้งแรก 7 พ.ย. 2569: 11 จาก 14 ไอเดียผ่าน ส่วนใหญ่ไม่ควรผ่าน)
export function knowledgeForIdea(idea = {}, { kb, max = 8 } = {}) {
  return matchKnowledge({ title: idea.title, summary: idea.summary }, { kb, max, minScore: KB_MIN_SCORE })
}

// ข้อจากคลังสำหรับมุมเล่าหนึ่งมุม (ไอเดียผ่านเกณฑ์แล้ว จึงให้มุมเล่าช่วยเลือกข้อได้) — มุมที่จับได้ไม่ถึงเกณฑ์ใช้ชุดของทั้งไอเดียแทน
export function knowledgeForAngle(idea = {}, angle = {}, { kb, max = 6 } = {}) {
  const own = matchKnowledge({ title: idea.title, angle, summary: idea.summary, extra: anglesText({ angles: [angle] }) }, { kb, max, minScore: KB_MIN_SCORE })
  return own.length >= KB_MIN_MATCHES ? own : knowledgeForIdea(idea, { kb, max })
}

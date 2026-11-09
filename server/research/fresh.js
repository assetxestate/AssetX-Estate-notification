// "คิดคอนเทนต์ใหม่ด้วย AI" — ปุ่มบนการ์ดไอเดียและการ์ดร่างในหน้า /marketing (เจ้าของขอ 9 พ.ย. 2569: ไม่ชอบคอนเทนต์ที่ออกแบบไว้ → กดให้ AI คิดใหม่สด ๆ)
// ไอเดียหนึ่งใบ → มุมเล่าใหม่ 1 มุมที่ไม่ซ้ำมุมเดิม + ร่างโพสต์เต็มของมุมนั้น
// ร่างผ่านด่านชุดเดียวกับรอบรีเสิร์ช (generateDrafts → parseDraft: คนอ่านกลุ่มเดียว · คำต้องห้าม · hook · ซ้ำกับร่างเดิม) ไม่มีทางลัด
// ผู้เรียก = ตัวรับงานบนคอมสำนักงาน (scripts/image-worker.mjs · คิว marketing_content_jobs) — โมดูลนี้ไม่เขียนฐานข้อมูลเอง คืนมุมใหม่ให้ผู้เรียกบันทึก
import { scrub, scrubPostText } from './pii.js'
import { buildAnglesPrompt, parseAngles } from './angles.js'
import { generateDrafts, draftableIdea } from './drafts.js'
import { similarity } from '../../src/lib/marketing-model/scoring.js'

export const FRESH_NOTE_MAX = 200
// มุมใหม่ที่ brief คล้ายมุมเดิมเกินนี้ = เปลี่ยนแค่คำ ไม่นับเป็นมุมใหม่
export const FRESH_BRIEF_SIMILARITY = 0.5
// ร่างเดิมที่เจ้าของไม่ชอบ (จากการ์ดร่าง) ส่งมาเทียบได้ไม่เกินนี้ต่องาน
export const FRESH_AVOID_MAX = 3

// คำขอของเจ้าของ (ไม่บังคับ) → บรรทัดเดียว ไม่มีข้อมูลบุคคล ไม่เกิน 200 ตัวอักษร
export function cleanFreshNote(note) {
  return scrub(String(note ?? '')).replace(/\s+/g, ' ').trim().slice(0, FRESH_NOTE_MAX)
}

const normLabel = (s) => String(s || '').replace(/\s+/g, '').toLowerCase()

// คำสั่งมุมเล่าเดิมของรอบรีเสิร์ช + รายการมุมที่มีแล้ว (ห้ามซ้ำ) + คำขอของเจ้าของ
export function buildFreshAnglesPrompt({ idea, brand = {}, existing = [], note = '' }) {
  const base = buildAnglesPrompt({ idea, brand })
  const known = existing.filter((a) => a && typeof a === 'object' && a.label).slice(0, 10)
  const request = cleanFreshNote(note)
  const prompt = [
    base.prompt,
    known.length
      ? `มุมเล่าที่ทีมมีแล้ว (เจ้าของเพจอ่านแล้วยังไม่ชอบ — ห้ามเสนอซ้ำ ห้ามแค่เปลี่ยนคำ ต้องเป็นประเด็นและวิธีเล่าใหม่จริงของเรื่องเดียวกัน):\n${known.map((a, i) => `${i + 1}. ${scrub(a.label)} — ${scrub(String(a.brief || '')).slice(0, 220)}`).join('\n')}`
      : '',
    request ? `คำขอเพิ่มเติมจากเจ้าของเพจ (ทำตามได้เมื่อไม่ขัดกติกาข้างบน · ห้ามใช้เป็นเหตุให้แต่งข้อเท็จจริง): ${request}` : '',
    'เสนอ 3 มุมเล่าใหม่ทั้งหมดที่ไม่ซ้ำรายการข้างบน เป็น JSON array ตามที่กำหนด',
  ].filter(Boolean).join('\n\n')
  return { ...base, prompt }
}

// มุมแรกจากคำตอบที่ไม่ซ้ำมุมเดิม: ชื่อไม่ซ้ำ และ brief คล้ายมุมเดิมทุกมุมน้อยกว่าเกณฑ์ · ไม่มีเลย = null
export function pickFreshAngle(candidates = [], existing = []) {
  const labels = new Set(existing.map((a) => normLabel(a?.label)).filter(Boolean))
  const briefs = existing.map((a) => String(a?.brief || '')).filter(Boolean)
  return candidates.find((c) => c?.label && c?.brief
    && !labels.has(normLabel(c.label))
    && briefs.every((b) => similarity(b, c.brief) < FRESH_BRIEF_SIMILARITY)) || null
}

// ร่างเดิมที่เจ้าของไม่ชอบ → มุมหลอกที่มีร่าง (ให้ generateDrafts เลี่ยงประโยคเปิด ประเด็น พาดหัว และกันร่างซ้ำ) · ไม่ถูกบันทึก
// เป็นโพสต์ของเราเอง → ชุดกฎข้อความโพสต์ (ชุดเต็มลบคำว่า คุณ… ทั้งโพสต์)
export function avoidAnglesFrom(avoid = []) {
  return (Array.isArray(avoid) ? avoid : [])
    .filter((d) => d && typeof d.caption === 'string' && d.caption.trim())
    .slice(0, FRESH_AVOID_MAX)
    .map((d, i) => ({ label: `ร่างที่ไม่ใช้ ${i + 1}`, brief: '', draft: { caption: scrubPostText(d.caption), headline: scrubPostText(String(d.headline || '')) } }))
}

// คืน { ok, angle, provider, error } · ไม่ throw
// angle = { label, brief, draft, fresh: { at, note? } } — ผู้เรียกวางไว้ช่องแรกของ angles (การ์ดเลือกช่องแรกให้เอง)
export async function generateFreshContent({ idea, brand = {}, ask, kb = null, hookLibrary = null, hookLessons = null, avoid = [], note = '', now = () => new Date(), log = () => {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  if (!idea || !idea.id) return { ok: false, error: 'ไม่พบไอเดีย' }
  const eligible = draftableIdea(idea, { kb })
  if (!eligible.ok) return { ok: false, error: eligible.reason }
  const request = cleanFreshNote(note)
  const existing = (Array.isArray(idea.angles) ? idea.angles : []).filter((a) => a && typeof a === 'object' && a.label)

  // 1) มุมเล่าใหม่ — ขอ 3 มุมแล้วเลือกมุมแรกที่ไม่ซ้ำ · ซ้ำทั้งหมด = ลองอีกครั้งโดยบอกว่ามุมที่เพิ่งเสนอก็ห้ามใช้
  let angle = null
  let provider = null
  let error = null
  const rejected = []
  for (let attempt = 0; attempt < 2 && !angle; attempt += 1) {
    const { system, prompt } = buildFreshAnglesPrompt({ idea, brand, existing: [...existing, ...rejected], note: request })
    const res = await ask({ system, prompt })
    if (!res.ok) {
      error = res.error
      if (/ไม่มีผู้ให้บริการ/.test(String(error || ''))) break
      continue
    }
    const list = parseAngles(res.data)
    if (!list) { error = 'AI ตอบมุมเล่าไม่ครบ'; continue }
    angle = pickFreshAngle(list, [...existing, ...rejected])
    if (!angle) { error = 'มุมเล่าที่ AI เสนอยังซ้ำกับมุมเดิม'; rejected.push(...list) } else provider = res.provider
  }
  if (!angle) return { ok: false, error: error || 'AI ยังคิดมุมเล่าใหม่ไม่ได้' }
  log(`[fresh] #${idea.id} มุมใหม่ "${angle.label}" (${provider})`)

  // 2) ร่างเต็มของมุมใหม่ — ไอเดียชั่วคราว: ร่างเดิมทุกชิ้น (มุมเดิม + ร่างที่เจ้าของไม่ชอบ) เป็นของที่ต้องเลี่ยง มุมใหม่เป็นมุมเดียวที่ยังไม่มีร่าง
  const temp = { ...idea, angles: [...existing.filter((a) => a.draft?.caption), ...avoidAnglesFrom(avoid), { label: angle.label, brief: angle.brief }] }
  let drafted = null
  const result = await generateDrafts({
    ideas: [temp], brand, ask, sleep, log, now, kb, hookLibrary, hookLessons,
    delayMs: 0, maxPerIdea: 1, attempts: 3, request,
    onSave: async (_id, angles) => { drafted = angles[angles.length - 1] },
  })
  if (!drafted?.draft?.caption) return { ok: false, error: result.failed[0]?.error ? `AI เขียนร่างไม่ผ่านด่านตรวจ: ${result.failed[0].error}` : 'AI เขียนร่างไม่ผ่านด่านตรวจ', provider }
  return {
    ok: true,
    provider: drafted.draft.provider || provider,
    angle: { label: angle.label, brief: angle.brief, draft: drafted.draft, fresh: { at: now().toISOString(), ...(request ? { note: request } : {}) } },
  }
}

// ประโยคเปิดทางเลือก (hook) ของร่าง AI — ใช้ทั้งหน้าเว็บ (/marketing) และตัวร่างฝั่ง server (server/research/hooks.js re-export)
// ร่างจากรอบรีเสิร์ชเก็บ hook 2–4 แบบพร้อมคะแนน (angles[i].draft.hooks) · คนตรวจกด "ใช้ประโยคนี้" = แทนบรรทัดแรกของแคปชั่น + พาดหัว
// ไฟล์นี้ต้องไม่ import ของ node (หน้าเว็บ import ตรง)

// ใส่ประโยคเปิดใหม่แทนบรรทัดแรกที่มีข้อความของแคปชั่น (บรรทัดว่างนำหน้าคงไว้)
export function swapOpeningLine(caption = '', line = '') {
  const lines = String(caption || '').split('\n')
  const at = lines.findIndex((l) => l.trim())
  if (at < 0 || !String(line || '').trim()) return String(caption || '')
  lines[at] = String(line).trim()
  return lines.join('\n')
}

export function openingLineOf(caption = '') {
  return String(caption || '').split('\n').map((l) => l.trim()).find(Boolean) || ''
}

const squash = (s) => String(s || '').replace(/[\s"“”'‘’]/g, '')
// ตัวไหนคือประโยคเปิดที่แคปชั่นใช้อยู่ตอนนี้ (คนตรวจแก้แคปชั่นเองแล้วก็ยังจับได้ถ้าบรรทัดแรกยังเหมือนเดิม)
export function isCurrentHook(hook = {}, caption = '') {
  const a = squash(hook.line)
  const b = squash(openingLineOf(caption))
  return Boolean(a && b) && (a === b || (Math.min(a.length, b.length) >= 20 && (a.startsWith(b) || b.startsWith(a))))
}

// รายการที่หน้าเว็บโชว์: เรียงคะแนนมาก→น้อย · ทิ้งของเสีย · ไม่มีอย่างน้อย 2 แบบ = ไม่ต้องโชว์ตัวเลือก
export function hookOptionsFor(hooks = []) {
  const list = (Array.isArray(hooks) ? hooks : [])
    .filter((h) => h && typeof h.line === 'string' && h.line.trim())
    .map((h) => ({ ...h, score: Number.isFinite(h.score) ? h.score : null }))
  return list.length >= 2 ? [...list].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)) : []
}

// สคริปต์วิดีโอของร่าง AI: 0–3 วิ = hook ที่ใช้ (แพลตฟอร์มแนะนำให้บอกว่าคลิปให้อะไรภายใน 3 วิ และให้ hook ลงภายใน 6 วิ) แล้วตามด้วยเนื้อจากแคปชั่น
// เดิมสคริปต์มาจากแม่แบบหัวข้อ เปิดด้วย "เรื่องนี้หลายคนยังเข้าใจไม่ตรงกัน" ทุกโพสต์ ไม่ตรงกับแคปชั่น AI
export function videoScriptFromDraft({ caption = '', cta = '' } = {}) {
  const lines = String(caption || '').split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return ''
  const hook = lines[0]
  const rest = lines.slice(1).filter((l) => !/^ที่มา\s*[:：]|^ข้อมูลนี้เป็นความรู้ทั่วไป|^เคสสมมุติเพื่ออธิบาย|^\(เคสสมมุติ\)$/.test(l) && l !== cta)
  const promise = rest.find((l) => !/^\d+[.)]/.test(l) && !/^(ถาม|ตอบ)\s*[:：]/.test(l)) || ''
  const points = rest.filter((l) => /^\d+[.)]/.test(l) || /^ถาม\s*[:：]/.test(l)).slice(0, 4).map((l) => l.replace(/^(\d+[.)]|ถาม\s*[:：])\s*/, '').split(/[:：]/)[0].trim()).filter(Boolean)
  const cut = (s, n) => (s.length > n ? `${s.slice(0, n).trim()}…` : s)
  return [
    `0–3 วิ · ผู้แนะนำพูดเข้ากล้อง + ตัวหนังสือบนจอ: ${hook}`,
    promise ? `3–6 วิ · บอกว่าคลิปนี้จะได้อะไร: ${cut(promise, 110)}` : '',
    points.length ? `เนื้อหา: ${points.map((p, i) => `${i + 1}) ${cut(p, 60)}`).join(' · ')}` : '',
    'ท้ายคลิป: ข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารของแต่ละกรณี',
    cta ? `ปิด: ${cta}` : '',
  ].filter(Boolean).join('\n')
}

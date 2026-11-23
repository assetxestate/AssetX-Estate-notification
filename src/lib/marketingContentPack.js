// ชุดคอนเทนต์จากร่างเดียว: storyboard ของ Reel + Carousel + บรีฟภาพ (FR-06 · เฟส P2 · 23 พ.ย. 2569) — ตรรกะล้วน ไม่ใช้ AI
// ทุกชิ้นสร้างจาก "ข้อความของร่างที่เลือกจริง" ไม่ใช่แม่แบบหัวข้อ และไม่เติมข้อเท็จจริง: คำบรรยายมาจากประโยคในร่างเท่านั้น
//
// ต่างจากสคริปต์วิดีโอเดิม (videoScriptFromDraft = ย่อแคปชั่นเป็น 4–5 บรรทัด): storyboard แยกเป็นฉาก มีเวลาเริ่ม–จบต่อเนื่อง
//   ภาพที่ต้องถ่าย/เตรียม คำบรรยาย ตัวหนังสือบนจอ ข้ออ้างที่ฉากนั้นใช้ ฉากข้อจำกัด และฉากชวนทำ + รายการของที่ต้องเตรียมก่อนถ่าย
// นโยบายภาพ: ภาพจริงที่มีสิทธิใช้ > แผนภาพ/ตัวหนังสือ > ภาพ AI เชิงแนวคิด (ติดป้าย) · ห้ามใช้ภาพ AI แทนสถานที่จริงหรือเอกสารสิทธิ์
// ชุดนี้ผูกกับข้อความของร่าง: แก้พาดหัวหรือแคปชั่นแล้วชุดเดิม "ล้าสมัย" ต้องสร้างใหม่ก่อนนำไปใช้ (isPackStale)
import { containment } from './marketingProof.js'
import { stripEmoji } from './captionEmoji.js'
import { hashSeed } from './marketing-model/scoring.js'

export const REEL_MIN_SEC = 30
export const REEL_MAX_SEC = 60
export const REEL_DEFAULT_SEC = 40
const HOOK_SEC = 3
const CTA_SEC = 4
const CAVEAT_SEC = 5
const BEAT_MIN_SEC = 4
const CHARS_PER_SEC = 14 // ความเร็วอ่านออกเสียงภาษาไทยโดยประมาณ ใช้ตัดคำบรรยายให้พอดีเวลาของฉาก
const DEFAULT_CAVEAT = 'ข้อมูลนี้เป็นข้อมูลทั่วไป แต่ละกรณีต้องดูเอกสารและข้อเท็จจริงของทรัพย์นั้น'

const LIST_LINE = /^\s*(?:\d{1,2}[.)]|[•\-–])\s*/
const SOURCE_LINE = /^ที่มา\s*[:：]/
const CAVEAT_RE = /ยังต้องตรวจ|ต้องตรวจ|ข้อจำกัด|ยังสรุปไม่ได้|ขึ้นกับ|ขึ้นอยู่กับ|ควรยืนยัน|ยืนยันกับ|ยังไม่ใช่|ไม่ใช่คำแนะนำ|ข้อมูลทั่วไป|แต่ละกรณี|ตัวอย่างสมมติ|เคสสมมุ?ติ/
const FIELD_CUE = /หน้างาน|หน้าแปลง|ทางเข้า|ถนน|สำรวจ|ไปดู|พื้นที่จริง|กลับรถ|หน้ากว้าง/
const PRICE_CUE = /ราคา|มูลค่า|วงเงิน/
const LEGAL_CUE = /กฎหมาย|มาตรา|กรรมสิทธิ์|สำนักงานที่ดิน|จดทะเบียน|ไถ่|สัญญา|เอกสารสิทธิ์|โฉนด/

const squash = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
// ตัดที่ขอบประโยค/วรรค ไม่ตัดกลางคำเมื่อเลี่ยงได้
export function shorten(value, max) {
  const text = squash(value)
  if (text.length <= max) return text
  const head = text.slice(0, max)
  const cut = Math.max(head.lastIndexOf(' '), head.lastIndexOf('。'))
  return `${(cut > max * 0.5 ? head.slice(0, cut) : head).trim()}…`
}
const firstClause = (value, max) => shorten(squash(value).split(/[,，:：;]| แต่ | เพราะ | และ | จึง /)[0], max)

// แยกแคปชั่นเป็นส่วน ๆ ตามหน้าที่: เปิด · เนื้อหา (ย่อหน้า/ข้อในรายการ) · ข้อจำกัด · ที่มา · ชวนทำ
export function parseCaption(caption) {
  const lines = stripEmoji(String(caption ?? '')).replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim())
  const paragraphs = []
  let current = []
  for (const line of lines) {
    if (!line) { if (current.length) paragraphs.push(current); current = []; continue }
    if (/^(#[\p{L}\p{M}\p{N}_]+\s*)+$/u.test(line)) continue // บรรทัดแฮชแท็ก
    current.push(line)
  }
  if (current.length) paragraphs.push(current)
  const parts = { hook: '', beats: [], caveat: '', sources: '', cta: '' }
  if (!paragraphs.length) return parts
  parts.hook = paragraphs[0][0]
  const rest = [paragraphs[0].slice(1), ...paragraphs.slice(1)].filter((group) => group.length)
  // ย่อหน้าสุดท้ายที่สั้นและไม่ใช่ที่มา/ข้อจำกัด = คำชวนทำ
  for (let i = rest.length - 1; i >= 0; i -= 1) {
    const text = rest[i].join(' ')
    if (SOURCE_LINE.test(text) || (CAVEAT_RE.test(text) && !/ลอง|เก็บ|ส่ง|ทัก/.test(text))) continue
    if (text.length <= 170 && !rest[i].some((line) => LIST_LINE.test(line)) && rest.length > 1) { parts.cta = squash(text); rest.splice(i, 1) }
    break
  }
  for (const group of rest) {
    const text = squash(group.join(' '))
    if (SOURCE_LINE.test(text)) { parts.sources = text.replace(SOURCE_LINE, '').trim(); continue }
    const items = group.filter((line) => LIST_LINE.test(line))
    if (items.length >= 2) {
      const lead = group.filter((line) => !LIST_LINE.test(line)).join(' ')
      if (lead) parts.beats.push({ kind: 'paragraph', text: squash(lead) })
      for (const item of items) parts.beats.push({ kind: 'point', text: squash(item.replace(LIST_LINE, '')) })
      continue
    }
    if (CAVEAT_RE.test(text) && !parts.caveat && text.length <= 260) { parts.caveat = text; continue }
    parts.beats.push({ kind: 'paragraph', text })
  }
  return parts
}

// แบ่งข้อความเป็นวรรคตามช่องว่าง รวมวรรคสั้นเข้าด้วยกันให้แต่ละท่อนยาวพอเป็นหนึ่งฉาก (ไม่แก้ถ้อยคำ)
export function splitClauses(text, min = 45) {
  const out = []
  let current = ''
  for (const piece of squash(text).split(' ')) {
    current = current ? `${current} ${piece}` : piece
    if (current.length >= min) { out.push(current); current = '' }
  }
  if (current) { if (out.length && current.length < min / 2) out[out.length - 1] = `${out[out.length - 1]} ${current}`; else out.push(current) }
  return out
}

function shotFor(beat) {
  if (FIELD_CUE.test(beat.text)) return { shot: `ภาพจริงจากหน้างาน: ${firstClause(beat.text, 70)} (ต้องเป็นภาพที่มีสิทธิใช้ · ถ้าไม่มี ใช้แผนภาพและติดป้าย "ภาพจำลอง")`, need: 'footage' }
  if (PRICE_CUE.test(beat.text)) return { shot: 'ตัวหนังสือบนจอ ระบุชนิดของราคาและที่มาให้ชัด (ไม่ใช้ภาพป้ายราคาหรือเอกสารจริงของลูกค้า)', need: 'graphic' }
  if (LEGAL_CUE.test(beat.text)) return { shot: 'แผนภาพอธิบายขั้นตอนหรือความต่าง (ไม่ใช้ภาพเอกสารสิทธิ์จริงของลูกค้า)', need: 'graphic' }
  if (beat.kind === 'point') return { shot: `ข้อความขึ้นทีละข้อ พร้อมภาพประกอบของข้อนี้: ${firstClause(beat.text, 60)}`, need: 'graphic' }
  return { shot: 'ผู้พูดหน้ากล้อง หรือภาพประกอบเชิงแนวคิด (ถ้าเป็นภาพ AI ต้องติดป้ายว่าเป็นภาพประกอบ)', need: 'presenter' }
}

const claimsIn = (text, claims) => (claims || []).filter((claim) => claim?.status === 'verified'
  && (containment(claim.publishable_wording || claim.claim_text, text) >= 0.6 || containment(claim.claim_text, text) >= 0.6)).map((claim) => claim.id)

// แบ่งเวลาที่เหลือให้ฉากเนื้อหาตามความยาวข้อความ: จำนวนเต็ม ไม่ต่ำกว่าขั้นต่ำ รวมแล้วเท่ากับเวลาที่มีพอดี
function allocate(weights, total) {
  const n = weights.length
  if (!n) return []
  const spare = total - n * BEAT_MIN_SEC
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  const exact = weights.map((w) => (spare * w) / sum)
  const secs = exact.map((x) => BEAT_MIN_SEC + Math.floor(x))
  let left = total - secs.reduce((a, b) => a + b, 0)
  const order = exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0])
  for (let k = 0; left > 0; k = (k + 1) % n, left -= 1) secs[order[k][1]] += 1
  return secs
}

// post = { title, caption } · claims = ข้ออ้างของบรีฟ (ถ้ามี) ใช้บอกว่าฉากไหนใช้ข้ออ้างไหน
export function buildReelStoryboard(post = {}, { durationSec = REEL_DEFAULT_SEC, claims = [] } = {}) {
  const duration = Math.max(REEL_MIN_SEC, Math.min(REEL_MAX_SEC, Math.round(Number(durationSec) || REEL_DEFAULT_SEC)))
  const parts = parseCaption(post.caption)
  const hook = parts.hook || squash(post.title)
  if (!hook) return { ok: false, error: 'ร่างยังไม่มีข้อความ สร้าง storyboard ไม่ได้' }
  const middleTime = duration - HOOK_SEC - CAVEAT_SEC - CTA_SEC
  // ร่างที่มีย่อหน้าน้อย: ฉากเดียวยาวเกิน ~9 วินาทีดูไม่ได้ → แบ่งย่อหน้ายาวเป็นวรรค (ภาษาไทยเว้นวรรคระหว่างประโยค) ทีละย่อหน้าจนพอ
  let source = parts.beats
  while (source.length && middleTime / source.length > 9) {
    // เลือกย่อหน้าที่ยาวที่สุดที่ยังแบ่งได้
    let index = -1
    source.forEach((beat, i) => {
      if (beat.kind === 'paragraph' && splitClauses(beat.text, 30).length > 1 && (index < 0 || beat.text.length > source[index].text.length)) index = i
    })
    if (index < 0) break
    const pieces = splitClauses(source[index].text, 30)
    const half = Math.ceil(pieces.length / 2)
    source = [...source.slice(0, index), { kind: 'paragraph', text: pieces.slice(0, half).join(' ') }, { kind: 'paragraph', text: pieces.slice(half).join(' ') }, ...source.slice(index + 1)]
  }
  const beats = source.slice(0, Math.max(1, Math.floor(middleTime / BEAT_MIN_SEC)))
  const dropped = source.length - beats.length
  const secs = allocate(beats.map((beat) => Math.max(20, beat.text.length)), middleTime)
  const scenes = []
  let at = 0
  const push = (role, seconds, scene) => { scenes.push({ no: scenes.length + 1, role, start_sec: at, end_sec: at + seconds, ...scene }); at += seconds }
  push('hook', HOOK_SEC, { shot: 'ผู้พูดหน้ากล้อง หรือภาพเปิดของสถานที่จริงที่มีสิทธิใช้', narration: shorten(hook, HOOK_SEC * CHARS_PER_SEC + 20), overlay: firstClause(hook, 38), proof_source_ids: claimsIn(hook, claims), need: 'presenter' })
  if (!beats.length) {
    // ร่างสั้นมาก: ยังต้องมีฉากเนื้อหาหนึ่งฉาก ใช้พาดหัวเป็นเนื้อ ไม่แต่งเพิ่ม
    push('point', middleTime, { shot: 'ผู้พูดหน้ากล้อง อธิบายประเด็นของโพสต์', narration: shorten(squash(post.title) || hook, middleTime * CHARS_PER_SEC), overlay: firstClause(squash(post.title) || hook, 38), proof_source_ids: [], need: 'presenter' })
  }
  beats.forEach((beat, index) => {
    const visual = shotFor(beat)
    push(beat.kind === 'point' ? 'point' : 'explain', secs[index], { shot: visual.shot, narration: shorten(beat.text, secs[index] * CHARS_PER_SEC), overlay: firstClause(beat.text, 38), proof_source_ids: claimsIn(beat.text, claims), need: visual.need })
  })
  push('caveat', CAVEAT_SEC, { shot: 'ตัวหนังสือบนพื้นเรียบ อ่านง่าย ค้างไว้ให้อ่านทัน', narration: shorten(parts.caveat || DEFAULT_CAVEAT, CAVEAT_SEC * CHARS_PER_SEC + 10), overlay: firstClause(parts.caveat || DEFAULT_CAVEAT, 44), proof_source_ids: [], need: 'graphic' })
  push('cta', CTA_SEC, { shot: 'ผู้พูดหน้ากล้อง หรือหน้าปิดของแบรนด์', narration: shorten(parts.cta || 'เก็บคลิปนี้ไว้ใช้ตรวจทรัพย์ของตัวเอง', CTA_SEC * CHARS_PER_SEC + 10), overlay: firstClause(parts.cta || 'เก็บคลิปนี้ไว้', 38), proof_source_ids: [], need: 'presenter' })

  const footage = scenes.filter((scene) => scene.need === 'footage')
  const warnings = []
  if (!footage.length) warnings.push('ร่างนี้ไม่มีฉากที่ต้องใช้ภาพหน้างาน — คลิปจะเป็นผู้พูดกับตัวหนังสือ ห้ามใช้ภาพ AI แทนสถานที่จริง')
  if (dropped > 0) warnings.push(`เนื้อหา ${dropped} ส่วนท้ายไม่พอเวลา ${duration} วินาที จึงไม่อยู่ในคลิป — เพิ่มความยาวหรือทำเป็น Carousel`)
  if (!parts.caveat) warnings.push('ร่างไม่มีประโยคข้อจำกัด — ฉากข้อจำกัดใช้ข้อความมาตรฐาน ควรเขียนให้ตรงกับเรื่อง')
  return {
    ok: true,
    duration,
    scenes,
    prep: {
      footage: footage.map((scene) => `ฉาก ${scene.no}: ${scene.shot}`),
      graphics: scenes.filter((scene) => scene.need === 'graphic').map((scene) => `ฉาก ${scene.no}: ${scene.overlay}`),
      voiceover: scenes.map((scene) => scene.narration).join('\n'),
    },
    sources: parts.sources,
    warnings,
  }
}

// ปก + หน้าเนื้อหา 5–7 หน้า + หน้าชวนทำ · เนื้อหาไม่พอ 5 หน้า = ได้เท่าที่มีพร้อมคำเตือน (ไม่แต่งเพิ่มให้ครบ)
export function buildCarousel(post = {}, { claims = [] } = {}) {
  const parts = parseCaption(post.caption)
  const title = squash(post.title) || parts.hook
  if (!title && !parts.hook) return { ok: false, error: 'ร่างยังไม่มีข้อความ สร้าง Carousel ไม่ได้' }
  const beats = [...parts.beats]
  if (parts.caveat) beats.push({ kind: 'caveat', text: parts.caveat })
  const body = beats.slice(0, 7)
  const slides = [{ no: 1, role: 'cover', title: shorten(title, 60), body: parts.hook && parts.hook !== title ? shorten(parts.hook, 110) : '', visual: 'ปก: พาดหัวตัวใหญ่ พื้นเรียบของแบรนด์ ไม่มีตัวเลขถ้าไม่มีที่มา', source_note: '' }]
  for (const beat of body) {
    const visual = beat.kind === 'caveat' ? { shot: 'ตัวหนังสือบนพื้นเรียบ' } : shotFor(beat)
    slides.push({ no: slides.length + 1, role: beat.kind === 'caveat' ? 'caveat' : 'content', title: firstClause(beat.text, 42), body: shorten(beat.text, 170), visual: visual.shot, source_note: claimsIn(beat.text, claims).length && parts.sources ? `ที่มา: ${shorten(parts.sources, 90)}` : '' })
  }
  slides.push({ no: slides.length + 1, role: 'cta', title: shorten(parts.cta || 'เก็บโพสต์นี้ไว้ใช้ตรวจทรัพย์ของตัวเอง', 60), body: parts.sources ? `ที่มา: ${shorten(parts.sources, 140)}` : '', visual: 'หน้าปิดของแบรนด์', source_note: '' })
  const warnings = []
  if (body.length < 5) warnings.push(`ร่างนี้มีเนื้อหา ${body.length} หน้า น้อยกว่า 5 หน้าที่ Carousel ควรมี — เพิ่มข้อสังเกตหรือขั้นตอนในร่าง ไม่ควรเติมหน้าที่ไม่มีเนื้อหา`)
  if (beats.length > 7) warnings.push(`เนื้อหา ${beats.length - 7} ส่วนท้ายไม่อยู่ใน Carousel (จำกัด 7 หน้า)`)
  return { ok: true, slides, warnings }
}

// บรีฟภาพจากข้อความของร่าง (แทนบรีฟจากแม่แบบหัวข้อ) — ภาษาอังกฤษสำหรับโปรแกรมสร้างภาพ ข้อความไทยคงตามร่างคำต่อคำ
export function draftImagePrompt(post = {}) {
  const parts = parseCaption(post.caption)
  const points = parts.beats.slice(0, 3).map((beat) => firstClause(beat.text, 60)).filter(Boolean)
  const headline = shorten(squash(post.title) || parts.hook, 70)
  return [
    'Editorial social poster for a Thai real-estate advisory page, premium and realistic, clean layout.',
    `Thai headline, verbatim: "${headline}".`,
    points.length ? `Supporting Thai lines, verbatim: ${points.map((point) => `"${point}"`).join(' / ')}.` : '',
    'Visual: a clear diagram or conceptual illustration that explains the idea. This is an illustration, not evidence.',
    'Do not depict a specific real property, a real land title deed, a price tag, or any person who could be read as a customer. No invented numbers.',
  ].filter(Boolean).join(' ')
}

// ฐานของชุด: พาดหัว + แคปชั่น (ไม่นับอีโมจิและแฮชแท็ก) → แก้ข้อความแล้วชุดเดิมล้าสมัย
export const packBasis = (post = {}) => String(hashSeed(`${squash(post.title)}\n${parseCaption(post.caption).hook}\n${squash(stripEmoji(String(post.caption ?? '')))}`))

export function buildContentPack(post = {}, { durationSec = REEL_DEFAULT_SEC, claims = [], now = new Date() } = {}) {
  const reel = buildReelStoryboard(post, { durationSec, claims })
  if (!reel.ok) return reel
  return { ok: true, pack: { basis: packBasis(post), builtAt: now.toISOString(), reel, carousel: buildCarousel(post, { claims }), imagePrompt: draftImagePrompt(post) } }
}
export const isPackStale = (post = {}) => Boolean(post.contentPack) && post.contentPack.basis !== packBasis(post)

// ข้อความ storyboard สำหรับคัดลอกไปให้คนถ่าย
export function storyboardText(reel) {
  if (!reel?.ok) return ''
  return [
    `Storyboard ${reel.duration} วินาที`,
    ...reel.scenes.map((scene) => `${scene.start_sec}–${scene.end_sec} วิ · ภาพ: ${scene.shot}\n  พูด: ${scene.narration}\n  บนจอ: ${scene.overlay}`),
    reel.prep.footage.length ? `ภาพที่ต้องถ่าย/หา:\n${reel.prep.footage.map((item) => `- ${item}`).join('\n')}` : '',
    reel.prep.graphics.length ? `กราฟิกที่ต้องทำ:\n${reel.prep.graphics.map((item) => `- ${item}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n')
}

// ── หน้าทำวิดีโอ: แก้ฉากด้วยมือ ติ๊กว่าถ่ายแล้ว และติ๊กของที่เตรียมแล้ว (เจ้าของขอแยกหน้า 23 พ.ย. 2569) ──
// แก้ได้เฉพาะภาพ คำบรรยาย ตัวหนังสือบนจอ โน้ต และสถานะถ่ายแล้ว · เวลาของฉากมาจากตัวแบ่งเวลา ไม่แก้ด้วยมือ (รวมแล้วต้องเท่าความยาวคลิป)
// คำบรรยายที่แก้เองไม่ผ่านด่านตรวจของโพสต์: หน้าจอเตือนให้ตรงกับโพสต์ที่อนุมัติ
const SCENE_TEXT = { shot: 300, narration: 400, overlay: 60, note: 200 }
export function updateScene(pack, sceneNo, patch = {}) {
  if (!pack?.reel?.scenes) return pack
  let changed = false
  const scenes = pack.reel.scenes.map((scene) => {
    if (scene.no !== sceneNo) return scene
    const next = { ...scene }
    for (const [key, max] of Object.entries(SCENE_TEXT)) {
      if (patch[key] === undefined) continue
      const value = String(patch[key]).replace(/\r\n?/g, '\n').slice(0, max)
      if (value !== (scene[key] ?? '')) { next[key] = value; if (key !== 'note') next.edited = true; changed = true }
    }
    if (patch.done !== undefined && Boolean(patch.done) !== Boolean(scene.done)) { next.done = Boolean(patch.done); changed = true }
    return next
  })
  return changed ? { ...pack, reel: { ...pack.reel, scenes } } : pack
}

// ติ๊กรายการของที่ต้องเตรียม (ภาพที่ต้องถ่าย · กราฟิกที่ต้องทำ) — เก็บเป็นรายการข้อความที่ติ๊กแล้ว
export function togglePrep(pack, item) {
  if (!pack?.reel) return pack
  const done = new Set(pack.reel.prepDone || [])
  if (done.has(item)) done.delete(item)
  else done.add(item)
  return { ...pack, reel: { ...pack.reel, prepDone: [...done] } }
}

export function packProgress(pack) {
  const scenes = pack?.reel?.scenes || []
  const prep = [...(pack?.reel?.prep?.footage || []), ...(pack?.reel?.prep?.graphics || [])]
  const prepDone = new Set(pack?.reel?.prepDone || [])
  return { scenes: scenes.length, scenesDone: scenes.filter((scene) => scene.done).length, prep: prep.length, prepDone: prep.filter((item) => prepDone.has(item)).length, edited: scenes.filter((scene) => scene.edited).length }
}

// บทพูดล้วนสำหรับอ่านหน้ากล้องหรืออัดเสียง (ตามฉาก พร้อมเวลา)
export const teleprompterText = (reel) => (reel?.scenes || []).map((scene) => `[${scene.start_sec}–${scene.end_sec} วิ] ${scene.narration}`).join('\n\n')

// ซีรีส์ประจำของคอนเทนต์ (Signature Series · FR-05 · เฟส P1 · 23 พ.ย. 2569) — ตรรกะล้วน
// ซีรีส์ตั้งต้น 7 ชุดมาจากสกิล thai-real-estate-content-strategist v2 (บรีฟของเจ้าของ) · เจ้าของเพิ่มซีรีส์เองได้ (เก็บใน workspace.customSeries)
// ร่างหนึ่งชิ้นอยู่ได้ซีรีส์เดียว: post.seriesId + post.episodeNo (เลขตอนแจกครั้งเดียวตอนเลือกซีรีส์ ไม่เลื่อนเมื่อตอนอื่นถูกพักหรือลบ)
// ตอนใหม่ต้องมีมุมใหม่: เตือนเมื่อพาดหัวหรือเนื้อหาคล้ายตอนก่อน (เปลี่ยนชื่ออย่างเดียวไม่นับเป็นตอนใหม่)
import { similarity } from './marketing-model/scoring.js'

export const SIGNATURE_SERIES = [
  { id: 'rethink-deal', name: 'ทำไมดีลนี้ต้องคิดใหม่', thesis: 'ข้อจำกัดที่ชวนแปลกใจของทรัพย์ ซึ่งทำให้ต้องประเมินใหม่', evidence: 'ภาพหรือบันทึกหน้างานที่อนุญาตเผยแพร่ · สิทธิทางเข้าออกที่ตรวจแล้ว', formats: ['Reels', 'Carousel'] },
  { id: 'where-price', name: 'ราคานี้มาจากไหน?', thesis: 'แยกราคาประเมินราชการ ราคาเสนอขาย ราคาซื้อขายที่ยืนยัน และมูลค่าหลักประกัน', evidence: 'ราคาแต่ละชนิดพร้อมแหล่งและวันที่ตรวจ', formats: ['Carousel', 'โพสต์'] },
  { id: 'one-minute-field', name: '1 นาทีหน้างาน', thesis: 'สิ่งที่เห็นจริงหน้าทรัพย์ ทางเข้า หน้ากว้าง และบริบทพื้นที่', evidence: 'วิดีโอหรือภาพหน้างานที่ได้รับอนุญาต', formats: ['Reels'] },
  { id: 'deal-desk', name: 'โต๊ะพิจารณาดีล', thesis: 'หลักคิดของผู้ประเมินและคำถามก่อนรับดีล โดยไม่เปิดข้อมูลลูกค้า', evidence: 'หลักคิดประเมินของบริษัทที่อนุญาตเผยแพร่', formats: ['โพสต์', 'คลิปสั้น'] },
  { id: 'owner-should-ask', name: 'เจ้าของที่ควรถาม', thesis: 'คำถามที่ทำให้ตัดสินใจเรื่องขายฝากหรือจำนองรอบคอบขึ้น', evidence: 'เช็กลิสต์ที่ตรวจกับข้อกฎหมายแล้ว', formats: ['โพสต์'] },
  { id: 'read-deed-first', name: 'อ่านโฉนดก่อนเชื่อราคา', thesis: 'ความเสี่ยงที่ตรวจได้จากเอกสารสิทธิ์และแผนที่ โดยไม่เปิดข้อมูลส่วนบุคคล', evidence: 'ตัวอย่างเอกสารที่ปิดข้อมูลแล้ว · ข้อกฎหมายจากแหล่งราชการ', formats: ['Carousel', 'โพสต์'] },
  { id: 'real-news', name: 'อสังหาฯ กับข่าวจริง', thesis: 'ผลของประกาศทางการและสถิติต่อเจ้าของทรัพย์ พร้อมวันที่และที่มา', evidence: 'ประกาศจริง วันใช้บังคับ และบริบท', formats: ['โพสต์'] },
]
export const SERIES_ANGLE_SIMILARITY = 0.6

const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

// ซีรีส์ที่เจ้าของเพิ่มเอง → { ok, value, errors }
export function normalizeCustomSeries(input = {}, existing = []) {
  const errors = []
  const name = text(input.name, 60)
  const thesis = text(input.thesis, 240)
  if (!name) errors.push('ตั้งชื่อซีรีส์')
  if (!thesis) errors.push('เขียนว่าซีรีส์นี้เล่าเรื่องอะไร')
  if (name && existing.some((series) => series.name === name)) errors.push('มีซีรีส์ชื่อนี้แล้ว')
  return { ok: errors.length === 0, errors, value: { id: input.id || `custom-${Date.now().toString(36)}`, name, thesis, evidence: text(input.evidence, 240), formats: [], custom: true, paused: Boolean(input.paused) } }
}

// ซีรีส์ทั้งหมดที่เลือกได้ (ตั้งต้น + ของเจ้าของ) · includePaused = หน้าจัดการ
export function seriesList(custom = [], { includePaused = false } = {}) {
  const mine = (Array.isArray(custom) ? custom : []).filter((series) => series && series.id && series.name)
  return [...SIGNATURE_SERIES, ...mine].filter((series) => includePaused || !series.paused)
}
export const findSeries = (seriesId, custom = []) => seriesList(custom, { includePaused: true }).find((series) => series.id === seriesId) || null

// ตอนของซีรีส์ เรียงตามเลขตอน (รวมตอนที่พักไว้ เพื่อไม่แจกเลขซ้ำ)
export function seriesEpisodes(posts = [], seriesId) {
  return posts.filter((post) => post && post.seriesId === seriesId && Number.isInteger(post.episodeNo))
    .sort((a, b) => a.episodeNo - b.episodeNo)
}
export const nextEpisodeNo = (posts = [], seriesId) => seriesEpisodes(posts, seriesId).reduce((max, post) => Math.max(max, post.episodeNo), 0) + 1

// ค่าที่จะบันทึกลงร่างเมื่อเลือกซีรีส์ · เลือกซีรีส์เดิมซ้ำ = เลขตอนเดิม · เอาออกจากซีรีส์ = ล้างทั้งคู่
export function assignSeries(post = {}, seriesId, posts = []) {
  if (!seriesId) return { seriesId: null, episodeNo: null }
  if (post.seriesId === seriesId && Number.isInteger(post.episodeNo)) return { seriesId, episodeNo: post.episodeNo }
  return { seriesId, episodeNo: nextEpisodeNo(posts.filter((item) => item.id !== post.id), seriesId) }
}

// ตอนนี้ซ้ำกับตอนก่อนหรือไม่ → ข้อความเตือน หรือ null
export function repeatedEpisode(post = {}, posts = []) {
  if (!post.seriesId) return null
  for (const other of seriesEpisodes(posts, post.seriesId)) {
    if (other.id === post.id || other.status === 'archived') continue
    const sameTitle = text(other.title, 200) && similarity(text(post.title, 200), text(other.title, 200)) >= 0.8
    const sameBody = similarity(String(post.caption || ''), String(other.caption || '')) >= SERIES_ANGLE_SIMILARITY
    if (sameBody) return `เนื้อหาคล้ายกับตอนที่ ${other.episodeNo}${other.contentNo ? ` (#${other.contentNo})` : ''} ของซีรีส์เดียวกัน — ตอนใหม่ต้องมีมุมหรือข้อมูลใหม่ ไม่ใช่เปลี่ยนชื่อ`
    if (sameTitle) return `พาดหัวคล้ายกับตอนที่ ${other.episodeNo}${other.contentNo ? ` (#${other.contentNo})` : ''} ของซีรีส์เดียวกัน`
  }
  return null
}

// สรุปต่อซีรีส์สำหรับหน้าจัดการ: จำนวนตอน ตอนที่โพสต์แล้ว วันที่โพสต์ล่าสุด และรายการตอน
export function seriesOverview(posts = [], custom = []) {
  return seriesList(custom, { includePaused: true }).map((series) => {
    const episodes = seriesEpisodes(posts, series.id)
    const posted = episodes.filter((post) => post.status === 'posted')
    const last = posted.map((post) => post.postedAt).filter(Boolean).sort().pop() || null
    return { ...series, episodes, total: episodes.length, posted: posted.length, lastPostedAt: last }
  })
}

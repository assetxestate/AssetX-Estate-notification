// เลขกำกับคอนเทนต์ (#1 #2 …) — ให้เจ้าของ ทีม และ Claude อ้างถึงคอนเทนต์ชิ้นเดียวกันได้ตรงตัวเวลาสั่งแก้
//
// กติกา
// - แจกครั้งเดียวตอนคอนเทนต์เข้าเวิร์กสเปซ: แก้ข้อความ ย้ายสถานะ พักไว้ กู้คืน เลขไม่เปลี่ยน
// - ไม่ใช้เลขซ้ำแม้คอนเทนต์ถูกลบ: ตัวนับสูงสุดเก็บที่ workspace.contentSeq และไม่ถอยหลัง
// - เลขอยู่ที่ post.contentNo (จำนวนเต็มบวก) · ไม่อยู่ในแคปชั่น จึงไม่หลุดไปโพสต์จริง
// - ร่างตัวอย่างจากแม่แบบ (id ขึ้นต้น sample-) ไม่มีเลข จนกว่าจะถูกแก้ครั้งแรกและกลายเป็นร่างจริง
// - คอนเทนต์เดิมที่ยังไม่มีเลข: ไล่จากเก่าสุด (posts เรียงใหม่สุดก่อน เพราะทุกทางที่สร้างคอนเทนต์ใส่ไว้หน้าสุด)
//   ผลจึงเหมือนกันทุกเครื่องที่เปิดเวิร์กสเปซชุดเดียวกัน
// - เลขชนกัน (ข้อมูลเสีย) → ชิ้นที่เก่ากว่าได้เลขเดิม ชิ้นที่ใหม่กว่าได้เลขใหม่
// - floor = เลขที่เครื่อง/แท็บนี้เคยแจกไปแล้ว: เลขใหม่เริ่มต่อจากค่านี้เสมอ (กันแจกซ้ำเมื่อมีการบันทึกสำเนาเก่าทับ)
//   หน้าเว็บต้อง "แจกเลขของเก่าจากข้อมูลจากระบบล้วน ๆ ก่อน" แล้วค่อยใช้ floor — ถ้าใช้ floor ตั้งแต่แรก
//   เครื่องที่เคยแจกเลขสูงจะได้เลขของเก่าไม่ตรงกับเครื่องอื่น (ดูเทสต์ "ลำดับในหน้าเว็บ")

const isSampleId = (id) => String(id ?? '').startsWith('sample-')
const isValidNo = (value) => Number.isSafeInteger(value) && value > 0
const isContent = (post) => Boolean(post) && typeof post === 'object' && !isSampleId(post.id)

export function ensureContentNumbers(workspace, { floor = 0 } = {}) {
  if (!workspace || typeof workspace !== 'object') return workspace
  const posts = Array.isArray(workspace.posts) ? workspace.posts : []
  let seq = Math.max(isValidNo(workspace.contentSeq) ? workspace.contentSeq : 0, isValidNo(floor) ? floor : 0)
  const taken = new Set()
  const keep = posts.map(() => false)
  for (let index = posts.length - 1; index >= 0; index -= 1) {
    const post = posts[index]
    if (!isContent(post) || !isValidNo(post.contentNo) || taken.has(post.contentNo)) continue
    taken.add(post.contentNo)
    keep[index] = true
    if (post.contentNo > seq) seq = post.contentNo
  }
  let changed = !Array.isArray(workspace.posts) || seq !== workspace.contentSeq
  const next = posts.slice()
  for (let index = posts.length - 1; index >= 0; index -= 1) {
    if (keep[index] || !isContent(posts[index])) continue
    seq += 1
    next[index] = { ...posts[index], contentNo: seq }
    changed = true
  }
  return changed ? { ...workspace, posts: next, contentSeq: seq } : workspace
}

// รับเฉพาะ "12" · "#12" · "คอนเทนต์ 12" · "#๑๒" · ข้อความที่คัดลอกจากป้าย "คอนเทนต์ #12 · หัวข้อ" → 12
// ข้อความอื่น (หัวข้อที่มีตัวเลข · "ไอเดีย 5" · "12abc" · "1 2" · "-3" · "3.9") → null ไม่เดาให้
export function parseContentNo(text) {
  const western = String(text ?? '').replace(/[๐-๙]/g, (digit) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(digit)))
  const match = western.match(/^\s*(?:คอนเทนต์\s*)?#?\s*(\d+)\s*(?:·[\s\S]*)?$/)
  if (!match) return null
  const value = Number(match[1])
  return isValidNo(value) ? value : null
}

export function formatContentNo(value) {
  return isValidNo(value) ? `#${value}` : ''
}

export function findContentByNo(posts, value) {
  const wanted = typeof value === 'number' ? value : parseContentNo(value)
  if (!isValidNo(wanted) || !Array.isArray(posts)) return null
  return posts.find((post) => isContent(post) && post.contentNo === wanted) || null
}

export function contentNoOf(workspace, postId) {
  const post = (workspace?.posts || []).find((item) => String(item?.id) === String(postId))
  return isValidNo(post?.contentNo) ? post.contentNo : null
}

// ข้อความสำหรับคัดลอกไปวางในแชต เช่น "คอนเทนต์ #12 · มีโฉนด แต่ไม่อยากขายขาด"
export function contentReference(post) {
  const label = formatContentNo(post?.contentNo)
  const title = String(post?.title || '').trim()
  if (!label) return title
  return title ? `คอนเทนต์ ${label} · ${title}` : `คอนเทนต์ ${label}`
}

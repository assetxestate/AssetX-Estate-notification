// ขนาดโปสเตอร์ตามแพลตฟอร์มโซเชียล — ใช้ร่วมกันทั้งหน้าต่างออกแบบภาพ (ครอป/ย่อขยาย) และ API คิวสร้างภาพ (คำสั่งเว้นขอบ)
// เครื่องมือสร้างภาพของ ChatGPT ให้ได้ 3 แบบ: portrait 1024×1536 (2:3) · square 1024×1024 · landscape 1536×1024 (3:2)
// ขนาดปลายทางที่สัดส่วนไม่ตรง → สร้างแบบที่ใกล้ที่สุด แล้วครอปตรงกลางให้ได้สัดส่วนจริง (AI ถูกสั่งให้วางข้อความในพื้นที่ปลอดภัย)

export const GENERATION_SIZES = {
  portrait: { width: 1024, height: 1536 },
  square: { width: 1024, height: 1024 },
  landscape: { width: 1536, height: 1024 },
}

export const POSTER_SIZES = {
  'feed-4x5': { label: 'ฟีด Facebook / Instagram · 4:5', platform: 'Facebook and Instagram feed', width: 1080, height: 1350, aspect: 'portrait' },
  'square-1x1': { label: 'จัตุรัส · 1:1 (Facebook / Instagram / LINE OA)', platform: 'square feed post and LINE OA', width: 1080, height: 1080, aspect: 'square' },
  'story-9x16': { label: 'Story / Reels / TikTok · 9:16', platform: 'Stories, Reels and TikTok', width: 1080, height: 1920, aspect: 'portrait' },
  'link-191x1': { label: 'ภาพลิงก์ / แนวนอน Facebook · 1.91:1', platform: 'Facebook link and landscape post', width: 1200, height: 628, aspect: 'landscape' },
  'youtube-16x9': { label: 'ปก YouTube · 16:9', platform: 'YouTube thumbnail', width: 1280, height: 720, aspect: 'landscape' },
}

export const DEFAULT_POSTER_SIZE = 'feed-4x5'

// ขนาดเริ่มต้นตามช่องทางของโพสต์: LINE OA ใช้จัตุรัส · อื่น ๆ ใช้ฟีด 4:5
export function defaultPosterSizeFor(channel = '') {
  return /line/i.test(String(channel)) ? 'square-1x1' : DEFAULT_POSTER_SIZE
}

// ภาพที่สร้างได้ต้องถูกตัดขอบด้านไหน กี่เปอร์เซ็นต์ต่อด้าน เพื่อให้ได้สัดส่วนปลายทาง
// cutPx = พิกเซลที่หายต่อด้านบนภาพที่ ChatGPT สร้าง · safePx = ระยะที่ต้องเว้นจากขอบ (เผื่ออีก 3% ของด้านนั้น)
export function cropPlan(sizeKey) {
  const target = POSTER_SIZES[sizeKey] || POSTER_SIZES[DEFAULT_POSTER_SIZE]
  const source = GENERATION_SIZES[target.aspect]
  const base = { ...target, sourceWidth: source.width, sourceHeight: source.height }
  const targetRatio = target.width / target.height
  const sourceRatio = source.width / source.height
  if (Math.abs(targetRatio - sourceRatio) < 0.01) return { ...base, edges: null, percent: 0, cutPx: 0, safePx: 0 }
  // ภาพต้นทางสูงกว่าปลายทาง → ตัดบน-ล่าง · กว้างกว่า → ตัดซ้าย-ขวา
  const vertical = sourceRatio < targetRatio
  const kept = vertical ? sourceRatio / targetRatio : targetRatio / sourceRatio
  const side = vertical ? source.height : source.width
  const cutPx = Math.round(((1 - kept) / 2) * side)
  return {
    ...base,
    edges: vertical ? 'top and bottom' : 'left and right',
    percent: Math.round(((1 - kept) / 2) * 100),
    cutPx,
    safePx: cutPx + Math.round(side * 0.03),
  }
}

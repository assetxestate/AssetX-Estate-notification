// โปรไฟล์แบรนด์ 2 แบบของ /marketing (FR-05 · เฟส P1 · 23 พ.ย. 2569) — ตรรกะล้วน
// ใช้ระบบเดียวกัน ต่างกันที่จุดยืน น้ำเสียง คำชวนทำ และข้อที่ต้องบอกผู้อ่าน
// เจ้าของเลือก 23 พ.ย. 2569: AssetX Research พูดกับ "เจ้าของทรัพย์" เหมือน Asset X Estate (ไม่เขียนมุมนักลงทุน/คนปล่อยเงิน
//   — กติกากลุ่มคนอ่านของเพจใน research/brand_facts.json ไม่เปลี่ยน) ต่างกันที่ Research เป็นบทวิเคราะห์ที่ยึดหลักฐาน ไม่ขาย
// ส่วนที่เจ้าของแก้ได้ (มีเวอร์ชัน เก็บใน workspace.brandSettings): คำชวนทำตั้งต้น และคำที่ชอบใช้
// ส่วนที่แก้จากหน้าเว็บไม่ได้: ข้อห้าม ข้อที่ต้องบอกผู้อ่าน และกติกากฎหมาย (อยู่ในไฟล์นี้และด่านตรวจ)
export const BRAND_VERSION = '2026-11-23'
export const DEFAULT_BRAND = 'assetx_estate'

export const BRAND_PROFILES = {
  assetx_estate: {
    id: 'assetx_estate',
    name: 'Asset X Estate',
    short: 'Estate',
    purpose: 'ให้เจ้าของทรัพย์เข้าใจและไว้ใจการขายฝาก/จำนอง แล้วส่งข้อมูลมาประเมินเบื้องต้นเมื่อพร้อม',
    voice: 'ตรงไปตรงมา โปร่งใส อธิบายขั้นตอน เงื่อนไข และความเสี่ยงเป็นภาษาพูดสุภาพ',
    cta: 'ส่งข้อมูลทรัพย์มาประเมินเบื้องต้นได้ ปิดข้อมูลส่วนบุคคลได้',
    preferred: ['ต้องดูอะไร', 'ไม่เท่ากับ', 'สิ่งที่เจ้าของทรัพย์ควรทราบ', 'ก่อนตัดสินใจ'],
    avoid: ['ขายแรงหรือเร่งให้รีบตัดสินใจ', 'กดดันคนที่กำลังต้องการเงิน', 'รับประกันผลอนุมัติ วงเงิน หรือการไถ่คืน'],
    disclosures: ['เรื่องกฎหมาย: ข้อมูลทั่วไป ไม่ใช่คำแนะนำเฉพาะกรณี'],
    // คำที่ทำให้โพสต์ของแบรนด์นี้ผิดน้ำเสียง → ข้อสังเกตให้ผู้ตรวจ (คำรับประกันผลถูกด่านคำบล็อกอยู่แล้ว)
    offTone: [{ re: /ด่วนที่สุด|รีบเลย|วันนี้เท่านั้น|ก่อนหมดเขต|พลาดไม่ได้/, why: 'ถ้อยคำเร่งให้รีบตัดสินใจ' }],
  },
  assetx_research: {
    id: 'assetx_research',
    name: 'AssetX Research',
    short: 'Research',
    purpose: 'ให้เจ้าของทรัพย์เข้าใจราคา ทำเล ภาระผูกพัน และข่าว/กฎหมาย ผ่านบทวิเคราะห์ที่ตรวจที่มาได้',
    voice: 'เชิงบรรณาธิการ ยึดหลักฐาน แยกข้อเท็จจริงกับความเห็นให้ชัด บอกสิ่งที่ยังไม่รู้',
    cta: 'เก็บโพสต์นี้ไว้ใช้ตรวจทรัพย์ของตัวเอง หรือส่งคำถามมาได้',
    preferred: ['ข้อมูล ณ วันที่', 'ราคาเสนอขาย', 'ยังสรุปไม่ได้', 'ที่มา'],
    avoid: ['แอบโฆษณาบริการในรูปบทวิเคราะห์ที่ดูเป็นกลาง', 'อ้างข้อมูลที่ไม่มีแหล่ง', 'ปิดท้ายด้วยคำชวนใช้บริการแบบขายตรง'],
    disclosures: ['บอกที่มาและวันที่ของข้อมูลทุกครั้ง', 'ถ้าพูดถึงบริการ ต้องบอกตรง ๆ ว่า AssetX Estate เป็นผู้ให้บริการรับขายฝาก/จำนอง (ไม่ทำเป็นกลางปลอม)'],
    offTone: [
      { re: /ทักเลย|ทักแชตเลย|สนใจทัก|โปรโมชั่น|ด่วน|รีบ|ปรึกษาฟรี|ประเมินฟรี/, why: 'ถ้อยคำขายตรง ไม่เข้ากับบทวิเคราะห์' },
      { re: /รับขายฝาก|รับจำนอง/, why: 'พูดถึงบริการของเรา — ต้องบอกตรง ๆ ว่าเป็นผู้ให้บริการ ไม่ใช่บทวิเคราะห์กลาง', unless: /AssetX Estate (เป็น|คือ)ผู้ให้บริการ|ผู้ให้บริการรับขายฝาก|ผู้เขียนเป็นผู้ให้บริการ/ },
    ],
    needsSource: true,
  },
}

export const brandList = () => Object.values(BRAND_PROFILES)
export const brandProfile = (id) => BRAND_PROFILES[id] || BRAND_PROFILES[DEFAULT_BRAND]
export const cleanBrandId = (id) => (Object.hasOwn(BRAND_PROFILES, id) ? id : DEFAULT_BRAND)

// โปรไฟล์ที่ใช้จริง = ค่าตั้งต้น + ส่วนที่เจ้าของแก้ (คำชวนทำ คำที่ชอบใช้) · ข้อห้ามและข้อที่ต้องบอกผู้อ่านมาจากไฟล์นี้เสมอ
export function effectiveBrand(id, settings = {}) {
  const base = brandProfile(id)
  const mine = settings && typeof settings === 'object' ? settings[base.id] : null
  const cta = String(mine?.cta || '').trim().slice(0, 200)
  const preferred = Array.isArray(mine?.preferred) ? mine.preferred.map((item) => String(item).trim().slice(0, 60)).filter(Boolean).slice(0, 8) : []
  return { ...base, cta: cta || base.cta, preferred: preferred.length ? preferred : base.preferred, settingsVersion: Number(mine?.version) || 0, settingsUpdatedAt: mine?.updatedAt || null }
}

// บันทึกส่วนที่แก้ได้ → ค่าที่จะเก็บใน workspace.brandSettings (เวอร์ชันเพิ่มทีละหนึ่ง)
export function saveBrandSettings(settings = {}, id, { cta = '', preferred = [] } = {}, now = new Date()) {
  const brandId = cleanBrandId(id)
  const list = (Array.isArray(preferred) ? preferred : String(preferred).split(/[\n·,]/)).map((item) => String(item).trim().slice(0, 60)).filter(Boolean).slice(0, 8)
  const previous = settings?.[brandId]
  return { ...(settings || {}), [brandId]: { cta: String(cta || '').trim().slice(0, 200), preferred: list, version: (Number(previous?.version) || 0) + 1, updatedAt: now.toISOString() } }
}

// ข้อสังเกตเรื่องน้ำเสียงของแบรนด์ (ไม่บล็อก) — เปลี่ยนแบรนด์แล้วข้อสังเกตเปลี่ยนตาม โดยไม่แตะข้ออ้างและแหล่งที่มา
export function brandWarnings(post = {}, brandId) {
  const brand = brandProfile(brandId)
  const text = [post.title || post.headline, post.caption].filter(Boolean).join('\n')
  const warnings = []
  for (const rule of brand.offTone || []) {
    if (rule.re.test(text) && !(rule.unless && rule.unless.test(text))) warnings.push(`${brand.short}: ${rule.why}`)
  }
  if (brand.needsSource && !/ที่มา|ข้อมูล ณ วันที่|อ้างอิง|จากการสำรวจ|จากที่(ไป)?ดู|หน้างาน/.test(text)) warnings.push(`${brand.short}: ยังไม่บอกที่มาหรือวันที่ของข้อมูล`)
  return warnings
}

// บรรทัดที่ใส่ในคำสั่งถึง AI ตอนเขียนจากโน้ต
export function brandPromptLines(brandId) {
  const brand = brandProfile(brandId)
  return [
    `แบรนด์ของโพสต์นี้: ${brand.name} — ${brand.purpose}`,
    `น้ำเสียง: ${brand.voice}`,
    `ต้องหลีกเลี่ยง: ${brand.avoid.join(' · ')}`,
    `ต้องทำ: ${brand.disclosures.join(' · ')}`,
    brand.id === 'assetx_research'
      ? 'คำชวนทำของ Research คือให้เก็บโพสต์ ใช้ตรวจทรัพย์ของตัวเอง หรือส่งคำถาม ห้ามชวนใช้บริการ ห้ามใช้คำว่า ทักเลย ปรึกษาฟรี ประเมินฟรี'
      : 'คำชวนทำของ Estate คือชวนส่งข้อมูลมาประเมินเบื้องต้นแบบไม่กดดัน',
  ]
}

// มุมเล่า AI — 3 มุม "คนละรูปแบบคอนเทนต์" ต่อไอเดีย · AI ได้แค่เล่าจากข้อเท็จจริงที่โค้ดเตรียมให้
// กติกาผูกกับ subtype (ไม่ใช่ source) · นโยบายเครดิตของอสังหาฯ: news/official/auction ต้องอ้างแหล่ง · community/youtube/social ห้ามอ้าง
// ทุกข้อความผ่านตัวลบข้อมูลบุคคลก่อนเข้า prompt (ซ้ำอีกชั้นแม้ตัวเก็บลบมาแล้ว)
import { scrub } from './pii.js'
import { targetAudience, pageServices, businessLine, readerRuleLines, serviceAreaLabel } from './audience.js'

export const SUBTYPE_NOTES = {
  rate: 'อ้างหน่วยงานทางการ + วันที่มีผล · อธิบายผลต่อคนอ่านของโพสต์นี้แบบทั่วไป · ห้ามทำนายดอกเบี้ยหรือราคา · ห้ามบอกว่า "วงเงิน = X% ของราคาประเมิน" ตายตัว',
  fee_measure: 'อ้างหน่วยงานทางการ + วันที่มีผล/สิ้นสุด · ระบุเงื่อนไขให้ครบ (มาตรการลดค่าจดจำนองใช้เฉพาะจดพร้อมโอน · ขายฝากไม่อยู่ในมาตรการ) · ห้ามทำนาย',
  valuation: 'อ้างกรมธนารักษ์/หน่วยงาน + วันที่มีผล · อธิบายผลต่อค่าโอน ภาษี วงเงินอ้างอิง แบบทั่วไป · ห้ามอ้างตัวเลขที่ยังไม่ประกาศ · ห้ามบอกว่า "วงเงิน = X% ของราคาประเมิน" ตายตัว',
  law: 'สรุปสิทธิ/หน้าที่ตามตัวบท + ปิดท้าย "ปรึกษาสำนักงานที่ดิน/ทนายสำหรับเคสจริง" · ห้ามฟันธงผลคดี · ห้ามตีความเกินตัวบท',
  scam: 'เน้นวิธีป้องกัน (ทำที่สำนักงานที่ดินเท่านั้น · ตรวจตัวตน/โฉนด · อ่านสัญญาก่อนเซ็น) · ห้ามเอ่ยชื่อผู้ต้องหา/ผู้เสียหาย · ห้ามโยงไปคู่แข่ง',
  credit_market: 'ใช้ตัวเลขจากหน่วยงาน/สื่อพร้อมแหล่ง · ห้าม "ราคาขึ้นแน่" "ลงทุนแล้วกำไร" · เล่าว่าคนที่แบงก์ไม่อนุมัติมีทางเลือกอะไร โดยไม่สัญญาผล',
  market: 'ใช้ตัวเลขจากหน่วยงาน/สื่อพร้อมแหล่ง · ห้าม "ราคาขึ้นแน่" "ลงทุนแล้วกำไร" · เชื่อมกับคำถามของคนอ่านของโพสต์นี้ ไม่ใช่เล่าข่าวซ้ำ',
  auction_npa: 'ข้อมูลสาธารณะ บอกความเสี่ยง (ผู้ครอบครองเดิม ภาระติดพัน สภาพทรัพย์) · ห้ามเชียร์ให้ซื้อ · ตัวเลขกรมบังคับคดี (CC BY-NC) ห้ามลงโพสต์จนกว่าเจ้าของจะได้อนุญาตเป็นหนังสือ — เล่าเป็นแนวโน้มด้วยคำเรา',
  community_q: 'เปลี่ยนคำถามเป็นคอนเทนต์ความรู้ทั่วไป · ห้ามอ้าง/ลิงก์กระทู้ · ห้ามเล่าเคสของคนนั้น · ตอบคำถามที่คนกลุ่มนี้กลัวจริง',
  competitor: 'ลอกได้แค่แบบแผน (ฮุค ประเภทโพสต์ โครงเรื่อง) ด้วยบริการจริงของเรา · ห้ามลอกเรต ข้อความ ภาพ · ห้ามเอ่ยชื่อ · ห้ามเทียบดอกเบี้ยกับเจ้าอื่นแบบระบุชื่อ · เรต/ผลตอบแทนในคลิป/โพสต์คู่แข่งเป็นโฆษณา ไม่ใช่ข้อเท็จจริง',
  ad_library: 'แอดคู่แข่งที่รันนาน = สัญญาณว่าหัวข้อ/มุมนี้ตลาดตอบรับ · ลอกได้แค่แบบแผน (ฮุค โครง หัวข้อที่ตอบคำถามลูกค้า) แล้วเขียนเป็นความรู้/เช็กลิสต์ของเราที่ตอบคำถามเดียวกันด้วยบริการจริง · ห้ามลอกข้อความ ภาพ เรต วงเงิน ความเร็ว หรือข้อเสนอ · ห้ามเอ่ยชื่อเพจ · คำอ้างในแอดเป็นโฆษณาของเขา ไม่ใช่ข้อเท็จจริง',
  internal: 'ใช้ได้แค่ตัวเลขรวม (ห้ามชื่อ เบอร์ เลขโฉนด ที่อยู่ ข้อความแชต) · ห้ามใส่จำนวนลีด/ยอดดีลจริงในโพสต์ · เคสจริงต้องไม่ระบุตัวตนและได้รับอนุญาตจากลูกค้า',
  calendar: 'เหตุการณ์ยังไม่เกิด: เล่าว่าต้องเตรียมอะไร อ้างหน่วยงาน + วันที่ · ห้ามอ้างตัวเลข/ผลที่ยังไม่ประกาศ · บอกว่าต้องยืนยันกับหน่วยงานก่อน',
}

export const SOURCE_NOTES = {
  social: 'ลอกได้แค่แบบแผน (ฮุคเปิด ประเภทโพสต์ โครงเรื่อง) ด้วยบริการจริงของเรา · ห้ามลอกข้อความ/ภาพ/มุก · ห้ามเอ่ยชื่อเพจ · ห้ามใช้ตัวเลขยอดของเขา · ข้อเท็จจริงในโพสต์ต้นทางเป็นของเพจนั้น ไม่ใช่ของเรา',
  youtube: 'ถ้า summary ไม่มีป้าย 📌 แสดงว่ายังไม่รู้เนื้อหาจริงของคลิป — ห้ามเดาเนื้อหาจากชื่อคลิป ให้เสนอมุมจากหัวข้อกว้าง ๆ เท่านั้น · ห้ามอ้างชื่อช่อง',
  manual: 'เจ้าของวางลิงก์/หัวข้อเอง · ยึดหัวข้อที่ให้มา ห้ามเติมข้อเท็จจริงที่ไม่มีในสรุป',
}

export function noteFor(subtype, source) {
  return SUBTYPE_NOTES[subtype] || SOURCE_NOTES[source] || SUBTYPE_NOTES.market
}

// 'cite' = ต้องส่ง "ที่มา" ถึงตัวเขียนและคงไว้ในโพสต์ · 'no_cite' = ล้างชื่อแหล่งก่อนเข้า prompt
export function creditPolicy(idea, brand = {}) {
  const policy = brand.credit_policy || {}
  const noCiteSubtypes = policy.no_cite_subtypes || ['competitor', 'community_q']
  if (noCiteSubtypes.includes(idea.subtype)) return 'no_cite'
  const cite = policy.cite || ['news', 'official', 'auction']
  return cite.includes(idea.source) ? 'cite' : 'no_cite'
}

export const AUDIENCE_FALLBACK = {
  A: 'เจ้าของทรัพย์ที่ต้องการเงิน (ผู้ขายฝาก/ผู้จำนอง)',
  B: 'นักลงทุนรับซื้อฝาก/รับจำนอง',
  C: 'เจ้าของที่อยากขาย (ฝากขาย)',
  D: 'ผู้ซื้อบ้าน/ที่ดิน/คอนโด',
}

// ใช้ร่วมกับ drafts.js (ร่างโพสต์เต็ม) — บรรทัดกลุ่มเป้าหมายต้องเป็นชุดเดียวกันทั้งมุมเล่าและร่าง
export function audienceLines(codes, brand) {
  const table = brand.audiences || AUDIENCE_FALLBACK
  const list = Array.isArray(codes) && codes.length ? codes : Object.keys(table)
  return list.map((code) => `- ${code}: ${table[code] || AUDIENCE_FALLBACK[code] || code}`).join('\n')
}

// บริบทของไอเดียที่ส่งเข้า prompt — ล้าง PII และบังคับนโยบายเครดิต
export function ideaContextForPrompt(idea, brand = {}) {
  const policy = creditPolicy(idea, brand)
  const title = scrub(idea.title)
  const summary = scrub(idea.summary || '')
  const sourceLine = policy === 'cite'
    ? `ที่มา: ${scrub(idea.source_label || idea.source)} — ต้องคงชื่อแหล่งนี้ (และวันที่ถ้ามี) ไว้ในโพสต์ ห้ามลงเนื้อหาเต็ม`
    : 'ที่มา: (ห้ามอ้างชื่อเพจ/ช่อง/กระทู้ต้นทาง — เล่าเป็นความรู้ทั่วไปด้วยคำของเราเอง)'
  return { policy, title, summary, sourceLine }
}

export function buildAnglesPrompt({ idea, brand = {} }) {
  const ctx = ideaContextForPrompt(idea, brand)
  if (idea.source === 'social') {
    // ตัวเฝ้าเพจ/เลนแอด: ส่วนหน้าของชื่อเรื่อง ("รูปแรงกว่าปกติของเพจ 2.0 เท่า —" "แอดคู่แข่งรันนาน 67 วัน —") และบรรทัดตัวเลข (ยอด/วัน/เวอร์ชัน/คำค้น) เป็นภาษาภายใน
    // ขั้นร่างตัดอยู่แล้ว (drafts.js cleanTitleForPrompt · splitFactsNotes) แต่ขั้นมุมเล่าเคยส่งทั้งก้อน → มุม "แอดที่รัน 67 วัน" รั่วเข้าร่างผ่าน angle.brief (ผู้ตรวจ 7 พ.ย. 2569)
    ctx.title = ctx.title.replace(/^[^—]*(แรงกว่าปกติ|รันนาน)[^—]*—\s*/, '').trim() || ctx.title
    ctx.summary = ctx.summary.split('\n').filter((l, i) => !(i === 0 && !/^“/.test(l.trim()))).join('\n')
  }
  const formats = (brand.content_formats || ['ให้ความรู้', 'เช็กลิสต์', 'ถามตอบ', 'เตือนภัย/วิธีป้องกัน', 'เคสสมมติ']).join(' · ')
  const reader = targetAudience(idea, brand)
  const system = [
    `คุณคือนักวางแผนคอนเทนต์ของ "${brand.brand || 'AssetX Estate'}" ${businessLine(brand)}`,
    'หน้าที่: อ่านไอเดียที่ระบบคัดมาแล้ว แล้วเสนอ "มุมเล่า" 3 มุม สำหรับโพสต์ Facebook/LINE OA — คนละรูปแบบคอนเทนต์ ห้ามซ้ำกัน · ทั้ง 3 มุมพูดกับคนอ่านกลุ่มเดียวกันตามด้านล่าง',
    `รูปแบบคอนเทนต์ที่ทีมทำได้: ${formats}`,
    '',
    'คนอ่านของทุกมุม (กลุ่มเดียว · สำคัญที่สุด):',
    ...readerRuleLines(reader),
    '',
    'ความจริงของแบรนด์ (ใช้ได้เฉพาะเรื่องเหล่านี้ ห้ามแต่งเพิ่ม):',
    `- บริการ: ${pageServices(brand).join(', ') || 'ขายฝาก, จำนอง'}`,
    `- พื้นที่ให้บริการ: ${serviceAreaLabel(brand)}`,
    `- ประเภททรัพย์ที่รับ: ${(brand.property_types || []).join(', ') || 'ไม่ระบุ'}`,
    `- ขั้นตอนจริง: ${(brand.steps || []).join(' → ') || 'ไม่ระบุ'}`,
    `- ต้องพูดเสมอเมื่อเกี่ยวข้อง: ${(brand.must_say || []).join(' · ')}`,
    '',
    'กติกาเด็ดขาด:',
    `- ห้ามใช้คำเหล่านี้หรือความหมายเดียวกัน: ${(brand.forbidden_phrases || []).join(' · ')}`,
    '- ดอกเบี้ย/สินไถ่/ผลตอบแทนห้ามเกิน 15% ต่อปี และห้ามระบุตัวเลขดอกเบี้ยของเราถ้าไม่มีในความจริงของแบรนด์',
    '- ห้ามแต่งตัวเลข สถิติ วันที่ หรือข้อเท็จจริงที่ไม่อยู่ในไอเดีย · ไม่แน่ใจให้เขียนว่า "ต้องยืนยันกับหน่วยงาน"',
    '- ห้ามอ้างว่าได้รับอนุญาต/กำกับโดย ธปท. · ห้ามใช้ข้อมูลส่วนบุคคลใด ๆ',
    '- เล่าด้วยคำของเราเอง ไม่ลอกข้อความต้นทาง · ปิดท้ายทุกมุมด้วยสิ่งที่ผู้อ่านควรทำ (ไม่ใช่คำขายของ)',
    '',
    'ตอบเป็น JSON array เท่านั้น ไม่มีข้อความอื่น: [{"label":"ชื่อมุม ≤ 22 ตัวอักษร","brief":"1–2 ประโยคว่าจะเล่าอะไร ด้วยรูปแบบไหน และช่วยคนอ่านอย่างไร"}] จำนวน 3 รายการ',
  ].join('\n')

  const prompt = [
    `ไอเดีย: ${ctx.title}`,
    ctx.summary ? `ข้อเท็จจริงที่มี:\n${ctx.summary}` : 'ข้อเท็จจริงที่มี: (มีแค่หัวข้อ — ห้ามเดารายละเอียด)',
    `ประเภท: ${idea.subtype || 'market'} · แหล่ง: ${idea.source}`,
    ctx.sourceLine,
    `กติกาของประเภทนี้: ${noteFor(idea.subtype, idea.source)}`,
    'คนอ่านของโพสต์ (กลุ่มเดียว):',
    audienceLines([reader], brand),
    idea.event_date ? `วันที่ของเหตุการณ์: ${idea.event_date} (ค.ศ.)` : '',
    'เสนอ 3 มุมเล่า คนละรูปแบบคอนเทนต์ เป็น JSON array ตามที่กำหนด',
  ].filter(Boolean).join('\n\n')

  return { system, prompt, policy: ctx.policy }
}

// ตัดชื่อมุมให้ไม่เกิน max ตัวอักษร "ที่ขอบคำ" ด้วยตัวแบ่งคำไทยของระบบ — เดิม slice(0, 22) ตัดกลางพยางค์ ("เช็กลิสต์ขายคอนโดติดหน") และป้ายนี้โผล่บนหน้าเลือกมุม
const labelWords = new Intl.Segmenter('th', { granularity: 'word' })
export function trimLabel(text, max = 22) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  if (s.length <= max) return s
  let out = ''
  for (const { segment } of labelWords.segment(s)) {
    if ((out + segment).length > max) break
    out += segment
  }
  out = out.replace(/[\s:：·,\-–—]+$/, '').trim()
  return out.length >= 6 ? out : s.slice(0, max).replace(/[ัิ-ฺ็-๎]+$/, '').trim()
}

// ตรวจ/ทำความสะอาดคำตอบ AI → [{label, brief}] อย่างน้อย 2 รายการ ไม่งั้น null
export function parseAngles(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.angles) ? data.angles : null
  if (!list) return null
  const out = []
  const seen = new Set()
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const label = trimLabel(scrub(String(item.label ?? '').replace(/\s+/g, ' ').trim()), 22)
    const brief = scrub(String(item.brief ?? item.description ?? '').replace(/\s+/g, ' ').trim()).slice(0, 400)
    if (!label || !brief || seen.has(label)) continue
    seen.add(label)
    out.push({ label, brief })
    if (out.length === 3) break
  }
  return out.length >= 2 ? out : null
}

// ทำทีละไอเดีย เขียนทีละแถวผ่าน onSave (ไม่รวบตอนจบ — timeout กลางทางไม่ทิ้งงานทั้งรอบ)
export async function generateAngles({ ideas, brand, ask, onSave, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), delayMs = 2000, log = () => {} }) {
  const done = []
  const failed = []
  for (const idea of ideas) {
    const { system, prompt } = buildAnglesPrompt({ idea, brand })
    let angles = null
    let provider = null
    let error = null
    for (let attempt = 0; attempt < 2 && !angles; attempt += 1) {
      const result = await ask({ system, prompt })
      if (!result.ok) { error = result.error; break }
      provider = result.provider
      angles = parseAngles(result.data)
      if (!angles) error = 'AI ตอบไม่ครบ 2 มุม'
    }
    if (angles) {
      try {
        if (onSave) await onSave(idea.id, angles, provider)
        done.push({ id: idea.id, angles, provider })
        log(`[angles] #${idea.id} ได้ ${angles.length} มุม (${provider})`)
      } catch (saveError) {
        failed.push({ id: idea.id, error: saveError?.message || String(saveError) })
      }
    } else {
      failed.push({ id: idea.id, error })
      log(`[angles] #${idea.id} ไม่ได้มุม: ${error}`)
      if (error && /ไม่มีผู้ให้บริการ/.test(error)) break
    }
    if (delayMs) await sleep(delayMs)
  }
  return { done, failed }
}

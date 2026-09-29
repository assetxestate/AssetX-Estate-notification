// Topic selection uses the user's brief, never the brand's default lending offer.
export function resolveTopic(topic = '') {
  const text = String(topic).trim()
  if (!text) return null
  if (/ขายฝาก/.test(text) && /จำนอง/.test(text)) return 'comparison'
  if (/ขายฝาก|ไถ่ถอน|สินไถ่/.test(text)) return 'redemption'
  if (/จำนอง/.test(text)) return 'mortgage'
  if (/ขายขาด|เงินก้อน|สภาพคล่อง/.test(text)) return 'liquidity'
  if (/ซื้อ|ลงทุน|ทางเข้า|ทางออก|ตรวจ.*ที่ดิน|ที่ดิน.*ตรวจ/.test(text)) return 'purchase'
  if (/ขาย|ราคาตลาด|ประเมิน/.test(text)) return 'sale'
  return 'unknown'
}

const TOPICS = {
  purchase: {
    headline: 'ก่อนซื้อทรัพย์ เช็ก 3 เรื่อง',
    intro: 'ก่อนตัดสินใจซื้อ อย่าดูเฉพาะภาพสวยหรือราคาที่เสนอ ควรตรวจข้อมูลให้ครบก่อน',
    checks: ['ตรวจเอกสารสิทธิ์และภาระผูกพันกับหน่วยงานที่เกี่ยวข้อง', 'ตรวจทำเล สภาพจริง สิทธิทางเข้าออก และข้อจำกัดการใช้ประโยชน์', 'เปรียบเทียบราคาและรวมค่าใช้จ่ายก่อนตัดสินใจ'],
    tags: ['ตรวจสอบก่อนซื้อ', 'ความรู้อสังหา'],
    visual: 'An illustrative Thai property inspection, access road, blank site plan and checklist. No invented cadastral boundaries.',
  },
  sale: {
    headline: 'ก่อนขายทรัพย์ เตรียมให้ครบ',
    intro: 'การตั้งราคาขายควรเริ่มจากข้อมูลทรัพย์และข้อมูลเปรียบเทียบ ไม่ใช่ความคาดหวังเพียงอย่างเดียว',
    checks: ['เตรียมเอกสารสิทธิ์และตรวจภาระผูกพัน', 'บันทึกสภาพจริง ทำเล และข้อจำกัดของทรัพย์', 'เปรียบเทียบทรัพย์ใกล้เคียง แยกราคาประกาศออกจากราคาซื้อขายจริง'],
    tags: ['เตรียมขายทรัพย์', 'ประเมินทรัพย์'],
    visual: 'An illustrative property valuation desk with blank comparison sheets and a calculator.',
  },
  redemption: {
    headline: 'ขายฝาก เช็กเงื่อนไขก่อนตัดสินใจ',
    intro: 'ก่อนทำขายฝากหรือเตรียมไถ่ถอน ควรตรวจสัญญาจริงและวางแผนค่าใช้จ่ายให้ชัดเจน',
    checks: ['ตรวจวันครบกำหนดและเงื่อนไขการไถ่ถอนในสัญญา', 'ตรวจยอดสินไถ่และค่าใช้จ่ายพร้อมเอกสารประกอบ', 'สอบถามขั้นตอนและเอกสารที่ต้องใช้กับสำนักงานที่ดินหรือผู้เชี่ยวชาญ'],
    tags: ['ขายฝาก', 'เตรียมไถ่ถอน'],
    visual: 'An illustrative contract review desk with a blank calendar and calculator, no money or legal seals.',
  },
  mortgage: {
    headline: 'จำนอง ตรวจเงื่อนไขให้ครบ',
    intro: 'ก่อนจำนอง ควรทำความเข้าใจภาระชำระและเงื่อนไขของสัญญาที่เกี่ยวข้อง',
    checks: ['ตรวจเอกสารสิทธิ์และสัญญาที่เกี่ยวข้อง', 'ตรวจยอดหนี้ อัตราดอกเบี้ย หน่วยเวลา และค่าใช้จ่าย', 'วางแผนชำระและสอบถามขั้นตอนปลดจำนองเมื่อชำระครบ'],
    tags: ['จำนอง', 'วางแผนชำระ'],
    visual: 'An illustrative mortgage consultation desk with blank payment schedule and property model.',
  },
  comparison: {
    headline: 'ขายฝากกับจำนอง ต่างกันอย่างไร',
    intro: 'อย่าใช้เงื่อนไขของสัญญาประเภทหนึ่งไปสรุปแทนอีกประเภท ควรเปรียบเทียบจากเอกสารจริง',
    checks: ['สอบถามผลต่อกรรมสิทธิ์และสิทธิของคู่สัญญาแต่ละประเภท', 'แยกเงื่อนไขสินไถ่ของขายฝากออกจากภาระหนี้และดอกเบี้ยของจำนอง', 'เปรียบเทียบกำหนดเวลา ค่าใช้จ่าย และผลเมื่อไม่ปฏิบัติตามสัญญากับผู้เชี่ยวชาญ'],
    tags: ['ขายฝาก', 'จำนอง', 'ความรู้อสังหา'],
    visual: 'Two distinct blank contract folders on a property consultation desk for comparing options, no legal claims or readable text.',
  },
  liquidity: {
    headline: 'มีทรัพย์ วางแผนสภาพคล่องก่อน',
    intro: 'ก่อนนำทรัพย์มาวางแผนสภาพคล่อง ควรเริ่มจากเป้าหมายและความสามารถในการชำระของตนเอง',
    checks: ['ระบุจำนวนเงินที่ต้องการและวัตถุประสงค์', 'ตรวจเอกสารสิทธิ์ ภาระผูกพัน และข้อมูลทรัพย์', 'เปรียบเทียบทางเลือก เงื่อนไข และค่าใช้จ่ายกับผู้เชี่ยวชาญก่อนตัดสินใจ'],
    tags: ['วางแผนสภาพคล่อง', 'ความรู้อสังหา'],
    visual: 'An illustrative financial planning desk with property model, blank papers and calculator, no cash.',
  },
}

export function buildTopicContent(input, resolved) {
  const topic = String(input.topic || '').trim()
  const key = resolveTopic(topic)
  if (!key) return null
  const spec = TOPICS[key]
  const cta = 'สอบถามข้อมูลเบื้องต้นกับ บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด ทางแชตได้'
  const caveat = 'ข้อมูลนี้เป็นความรู้ทั่วไป ต้องตรวจเอกสารและข้อเท็จจริงของแต่ละกรณีก่อนตัดสินใจ'
  const headline = spec?.headline || 'หัวข้อนี้ต้องตรวจข้อมูลเพิ่มเติม'
  const paragraphs = spec ? [
    `หัวข้อ: ${topic}`, spec.intro,
    ...spec.checks.map((text, index) => `${index + 1}. ${text}`), caveat, cta,
  ] : [`หัวข้อ: ${topic}`, 'ยังไม่มีข้อมูลที่ตรวจสอบแล้วเพียงพอสำหรับร่างหัวข้อนี้ กรุณาเพิ่มข้อเท็จจริงและแหล่งอ้างอิงก่อนเผยแพร่']
  return {
    headline, caption: paragraphs.join('\n\n'), videoScript: paragraphs.join('\n'), cta,
    hashtags: resolved.channelSpec.hashtagCount ? ['AssetXEstate', ...(spec?.tags || [])].slice(0, resolved.channelSpec.hashtagCount) : [],
    imagePrompt: `${spec?.visual || 'A neutral blank research desk.'} Fictional illustrative scene, not a real listing or customer case. Natural daylight. No text, logos, personal data or official stamps. Leave space for an independently overlaid headline.`,
    topicKey: key,
  }
}

export function checkTopicContent(topic, output = {}) {
  const key = resolveTopic(topic)
  const text = `${output.caption || ''}\n${output.videoScript || ''}`
  const findings = []
  const block = (id, message) => findings.push({ id, severity: 'block', where: 'ความตรงกับหัวข้อ', message, fix: 'แก้เนื้อหาให้ตรงหัวข้อและตรวจข้อมูลก่อนอนุมัติ' })
  if (key === 'unknown') block('unsupported_topic', 'ยังไม่มีแม่แบบที่ตรวจสอบแล้วสำหรับหัวข้อนี้')
  if (['purchase', 'sale'].includes(key) && /สินไถ่|ไถ่ถอน|ปลดจำนอง|#ขายฝาก|#จำนอง/.test(text)) {
    block('topic_mismatch', 'หัวข้อซื้อขายทรัพย์มีเนื้อหาขายฝากหรือจำนองปนอยู่')
  }
  if (key === 'mortgage' && /สินไถ่/.test(text)) block('topic_mismatch', 'เนื้อหาจำนองใช้คำว่าสินไถ่ของขายฝาก')
  return findings
}

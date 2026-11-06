// ตัวลบข้อมูลบุคคล (PDPA) — ใช้กับ title / summary / caption ของทุกเลน
// ก่อนบันทึกลงฐานข้อมูล และก่อนส่งข้อความเข้า AI ทุกครั้ง
//
// หลัก: แทนด้วย "[ลบ]" ไม่ใช่ลบทิ้งเงียบ ๆ เพื่อให้คนอ่านรู้ว่าตรงนั้นเคยมีข้อมูลบุคคล
// ข้อจำกัดที่รู้: ชื่อที่ติดคำนำหน้าแบบไม่เว้นวรรค (เช่น "คุณสมชาย") จับไม่ได้
// จึงต้องทิ้งฟิลด์ผู้เขียน (dc:creator / author) ตั้งแต่ตอนอ่านฟีดด้วย (ดู parsers.js)
//
// ลำดับกฎสำคัญ: อีเมลและ LINE ID ต้องมาก่อน @handle ไม่งั้นจะเหลือครึ่งหน้า
const REPLACEMENT = '[ลบ]'

export const PII_RULES = [
  // เบอร์โทรไทย 9–10 หลัก มี/ไม่มีขีด จุด ช่องว่าง · ต้องขึ้นต้น 0 แล้วตามด้วย 2–9 (กันปี พ.ศ. และ "0.01%")
  { kind: 'phone', re: /(?<!\d)0[2-9]\d?[- .]?\d{3}[- .]?\d{3,4}(?!\d)/g },
  // LINE ID — ID ต้องเป็น ASCII (\w ไม่จับอักษรไทยอยู่แล้วใน JS แต่ระบุชัดเพื่ออ่านง่าย)
  { kind: 'line_id', re: /(?:line|ไลน์)\s*(?:id|ไอดี)?\s*[:：]?\s*@?[A-Za-z0-9_.\-]{3,}/gi },
  { kind: 'email', re: /[\w.+-]+@[\w-]+\.[\w.]+/g },
  { kind: 'handle', re: /(?<![\w])@[\w.]{3,}/g },
  // เลขเอกสารสิทธิ์
  { kind: 'deed_no', re: /(?:โฉนด(?:ที่ดิน)?|น\.ส\.\s?[34][กข]?|เลขที่ดิน)\s*(?:เลขที่)?\s*\d+/g },
  // เลขประกาศ / เลขคดี
  // ใช้ \p{L}\p{M}\p{N} แทน \w เพราะ \w ใน JS ไม่จับอักษรไทย (เช่น "ผบ.123/2569")
  { kind: 'case_no', re: /(?:เลขประกาศ|คดีหมายเลข(?:ดำ|แดง)?(?:ที่)?)\s*[\p{L}\p{M}\p{N}/.-]+/gu },
  // ชื่อหลังคำนำหน้า — ต้องมีช่องว่างหลังคำนำหน้า ("นายหน้า" "คุณภาพ" "นางฟ้า" ต้องรอด)
  { kind: 'titled_name', re: /(?:คุณ|นาย|นาง|นางสาว)\s+[ก-๙]{2,}(?:\s+[ก-๙]{2,})?/g },
]

// คืน { text, hits } · hits = [{ kind, count }] เฉพาะชนิดที่เจอ
// rules: ส่งชุดกฎอื่นได้ (เช่น drafts.js ใช้ชุดที่ไม่จับ "คุณ" + คำถัดไป เพราะโพสต์การตลาดพูดกับ "คุณ" ตลอด) · ค่าเริ่มต้น = ชุดเต็ม
export function scrubPersonalData(input, rules = PII_RULES) {
  let text = String(input ?? '')
  const hits = []
  for (const rule of rules) {
    let count = 0
    text = text.replace(rule.re, () => {
      count += 1
      return REPLACEMENT
    })
    if (count) hits.push({ kind: rule.kind, count })
  }
  return { text, hits }
}

// ทางลัดเมื่อต้องการแค่ข้อความ
export function scrub(input, rules = PII_RULES) {
  return scrubPersonalData(input, rules).text
}

export function hasPersonalData(input) {
  return scrubPersonalData(input).hits.length > 0
}

export { REPLACEMENT as PII_REPLACEMENT }

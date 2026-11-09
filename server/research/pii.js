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
  // เบอร์โทรรูปแบบสากล +66 (แอดใน Ad Library ใช้บ่อย · เคยหลุดลงคลัง 5 รายการ 7 พ.ย. 2569) — รับ (0)/0 หลังรหัสประเทศ · "+66%" "+66 ล้านบาท" ไม่โดน
  { kind: 'phone_intl', re: /\+66[\s-]?(?:\(0\)|0)?[\s-]?[2-9](?:[\s-]?\d){7,8}(?!\d)/g },
  // เบอร์โทรไทย 9–10 หลัก มี/ไม่มีขีด จุด ช่องว่าง · ต้องขึ้นต้น 0 แล้วตามด้วย 2–9 (กันปี พ.ศ. และ "0.01%") · รับการจัดกลุ่ม 2-4-3 ("02-1234-567") โดยไม่จับเวลาทำการ "08.00-17.00"
  { kind: 'phone', re: /(?<!\d)0[2-9](?:\d?[- .]?\d{3}[- .]?\d{3,4}|[- .]?\d{4}[- .]?\d{3})(?!\d)/g },
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
// ตัวเลขหน้าตาคล้าย (𝟬 U+1D7EC แบบที่แอดจริงใช้เลี่ยงตัวกรอง · เลขเต็มความกว้าง ０) → ASCII ก่อนวนกฎ
// ห้ามใช้ normalize('NFKC') ทั้งก้อน: มันแยก "ำ" (U+0E33) ทำให้ "จำนอง" เพี้ยน
export const foldDigits = (text) => String(text ?? '')
  .replace(/[\u{1D7CE}-\u{1D7FF}]/gu, (c) => String((c.codePointAt(0) - 0x1D7CE) % 10))
  .replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xFF10))

// เครื่องหมายคำพูดโค้ง “ ” ในข้อความต้นทาง → " ตรง — ตัวเฝ้าเพจ/เลนแอดห่อข้อความด้วย “…” เป็นบรรทัดของตัวเอง ถ้าข้างในมี ” อีกตัว
// ขั้นร่าง (drafts.js socialCaption) จะอ่านข้อเท็จจริงขาด (เจอจริงในคลังแอด 25/182 ชิ้น 7 พ.ย. 2569) · อยู่ไฟล์นี้เพราะทั้งสองเลน import pii.js อยู่แล้ว (ไม่เกิด import วน)
export const plainQuotes = (s) => String(s ?? '').replace(/[“”„‟]/g, '"')

export function scrubPersonalData(input, rules = PII_RULES) {
  let text = foldDigits(input)
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

// ชุดกฎสำหรับ "ข้อความโพสต์ของเราเอง" — ชุดเต็มจับ "คุณ" + คำถัดไปเป็นชื่อคน (ออกแบบไว้ล้างสรุปข่าว)
// แต่โพสต์การตลาดพูดกับ "คุณ" ตลอด: "สิทธิไถ่ถอนของคุณ ข้อมูลนี้…" เคยถูกลบเป็น [ลบ] กลางประโยค (6 พ.ย. 2569) → คงเฉพาะคำนำหน้าชื่อจริง
// ใช้กับร่างโพสต์ (drafts.js) และร่างเดิมที่ส่งให้ AI เลี่ยงตอน "คิดคอนเทนต์ใหม่" (server/marketing-content-jobs.js · fresh.js) · ข้อความที่คนพิมพ์เองยังใช้ชุดเต็ม
export const POST_PII_RULES = PII_RULES.map((rule) => (rule.kind === 'titled_name'
  ? { kind: 'titled_name', re: /(?:นาย|นาง|นางสาว)\s+[ก-๙]{2,}(?:\s+[ก-๙]{2,})?/g }
  : rule))
export const scrubPostText = (text) => scrub(text, POST_PII_RULES)

export { REPLACEMENT as PII_REPLACEMENT }

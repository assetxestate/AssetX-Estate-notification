// ทะเบียนนายหน้า (เจ้าของขอ 19 พ.ย. 2569): โพสต์ลิงก์เดียวหานายหน้าได้หลายคน แล้วแยกแต่ละคนด้วย "เบอร์โทร" ที่เขากรอกเอง
// - ตัวตน = เบอร์โทร (phoneKey) · รหัสในลิงก์ /assess?ref= เป็นแค่ป้ายสะดวกใช้ ส่งต่อให้คนอื่นได้ จึงไม่ใช้ยืนยันตัวตน
// - ตาราง brokers เก็บชื่อ รหัส บันทึก สถานะ และการรวมรายชื่อ (merged_into) · จำนวนงานนับจากรายการ lead เสมอ ไม่เก็บซ้ำ
// - ทรัพย์ซ้ำ: ระบบแค่เตือนพร้อมเวลาที่แต่ละคนส่ง เจ้าของเป็นคนตัดสิน (กติกาตั้งต้น: ส่งก่อนได้ก่อน)
// ใช้ได้ทั้งแถวจากฐานข้อมูล (snake_case) และแถวที่หน้าเว็บแปลงแล้ว (getValuations)
import { cleanRef, leadTicketNo } from './leadSource.js'

export const BROKER_STATUS = {
  new: { label: 'นายหน้าใหม่', hint: 'ยังไม่ได้คุยกัน ควรโทรคุยก่อนรับงาน' },
  active: { label: 'คุยแล้ว', hint: '' },
  paused: { label: 'พักไว้', hint: 'ไม่รับงานจากคนนี้ในตอนนี้' },
}
export const CANCELLED_STATUS = 'ยกเลิก'

// เบอร์โทรไทยในรูปเดียว: 0 นำหน้า 9–10 หลัก · +66 / 66 → 0 · รูปอื่นคืนค่าว่าง (ระบุตัวตนไม่ได้)
export function phoneKey(value) {
  let digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('66') && digits.length >= 10) digits = '0' + digits.slice(2)
  return /^0\d{8,9}$/.test(digits) ? digits : ''
}

// รหัสนายหน้าที่ระบบออกให้: N001, N002 … (ไม่ซ้ำเพราะมาจากเลขแถว)
export function brokerCodeOf(id) {
  const n = Number(id)
  return Number.isInteger(n) && n > 0 ? `N${String(n).padStart(3, '0')}` : ''
}

export const codeKey = (value) => cleanRef(value).toLowerCase()

export function brokerLink(origin, code) {
  const ref = cleanRef(code)
  return ref ? `${String(origin || '').replace(/\/+$/, '')}/assess?ref=${encodeURIComponent(ref)}` : ''
}

// ลิงก์สาธารณะสำหรับโพสต์หานายหน้า: ทุกคนใช้ลิงก์เดียวกัน ระบบแยกคนจากเบอร์ที่กรอก · channel = โพสต์/ช่องทางที่มา
export function recruitLink(origin, channel = '') {
  const src = cleanRef(channel)
  return `${String(origin || '').replace(/\/+$/, '')}/assess?role=broker${src ? `&src=${encodeURIComponent(src)}` : ''}`
}

// ข้อมูลของ lead ที่ใช้จับคู่ — รับได้ทั้งสองรูปของแถว
export function leadFacts(row = {}) {
  const deedList = Array.isArray(row.deeds) ? row.deeds : []
  const deedNos = [row.title_deed_no ?? row['เลขโฉนด'], ...deedList.map((d) => d?.titleDeedNo)]
    .flatMap((v) => String(v ?? '').split(/[,\s/]+/))
    .map((v) => v.replace(/\D/g, ''))
    .filter((v) => v.length >= 2)
  return {
    id: Number(row.id ?? row._rowIndex) || 0,
    createdAt: row.created_at ?? row.createdAt ?? '',
    status: row.status ?? row['สถานะ'] ?? '',
    isBroker: (row.lead_source ?? row.leadSource) === 'broker',
    isLead: Boolean(row.lead_source ?? row.leadSource),
    ref: cleanRef(row.lead_ref ?? row.leadRef),
    phone: phoneKey(row.contact_phone ?? row.contactPhone),
    name: String(row.contact_name ?? row.contactName ?? '').trim(),
    deedNos: [...new Set(deedNos)],
    province: place(row.province ?? row['จังหวัด']),
    district: place(row.district ?? row['อำเภอ/เขต']),
    subdistrict: place(row.subdistrict ?? row['ตำบล/แขวง']),
    sqw: Math.round((Number(row.total_sqw ?? row.totalSqw ?? row['ตร.ว.รวม']) || 0) * 10) / 10,
  }
}
const place = (value) => String(value ?? '').replace(/\s+/g, '').replace(/^(เขต|แขวง|อำเภอ|ตำบล|จังหวัด|อ\.|ต\.|จ\.)/, '')

// ดัชนีของทะเบียน: ตามการรวมรายชื่อ (merged_into) ไปหาคนปลายทาง · หาได้จากเบอร์และจากรหัส
export function brokerIndex(brokers = []) {
  const byId = new Map(brokers.map((b) => [Number(b.id), b]))
  const final = (broker) => {
    let current = broker
    for (let hop = 0; current && current.merged_into != null && hop < 10; hop += 1) current = byId.get(Number(current.merged_into))
    return current || broker
  }
  const byPhone = new Map()
  const byCode = new Map()
  for (const b of brokers) {
    const target = final(b)
    if (b.phone_key) byPhone.set(b.phone_key, target)
    if (codeKey(b.code)) byCode.set(codeKey(b.code), target)
  }
  return { byId, byPhone, byCode, final, active: brokers.filter((b) => b.merged_into == null) }
}

// นายหน้าของ lead หนึ่งรายการ
// sender = คนที่กรอกเบอร์ (ตัวตนจริง) · linkOwner = เจ้าของรหัสในลิงก์ · mismatch = ลิงก์ของคนหนึ่งแต่เบอร์เป็นของอีกคน (ลิงก์ถูกส่งต่อ)
export function brokerOfLead(row, index) {
  const facts = leadFacts(row)
  if (!facts.isBroker) return null
  const sender = facts.phone ? index.byPhone.get(facts.phone) || null : null
  const linkOwner = facts.ref ? index.byCode.get(codeKey(facts.ref)) || null : null
  return {
    sender,
    linkOwner,
    phone: facts.phone,
    unidentified: !facts.phone,
    unregistered: Boolean(facts.phone) && !sender,
    mismatch: Boolean(linkOwner && (!sender || Number(sender.id) !== Number(linkOwner.id))),
  }
}

// สรุปงานต่อคน นับจาก lead จริง (ไม่นับรายการที่ยกเลิก) · คนที่ยังไม่อยู่ในทะเบียนแต่มี lead คืนใน unregistered ให้เจ้าของกดเพิ่ม
export function brokerStats(brokers = [], rows = []) {
  const index = brokerIndex(brokers)
  const stats = new Map(index.active.map((b) => [Number(b.id), { broker: b, count: 0, cancelled: 0, lastAt: '', tickets: [], phones: new Set(b.phone_key ? [b.phone_key] : []) }]))
  for (const b of brokers) {
    if (b.merged_into == null || !b.phone_key) continue
    stats.get(Number(index.final(b).id))?.phones.add(b.phone_key)
  }
  const loose = new Map()
  for (const row of rows) {
    const facts = leadFacts(row)
    if (!facts.isBroker || !facts.phone) continue
    const owner = index.byPhone.get(facts.phone)
    let entry = owner ? stats.get(Number(owner.id)) : loose.get(facts.phone)
    if (!entry) { entry = { phone: facts.phone, name: facts.name, count: 0, cancelled: 0, lastAt: '', tickets: [] }; loose.set(facts.phone, entry) }
    if (facts.status === CANCELLED_STATUS) { entry.cancelled += 1; continue }
    entry.count += 1
    entry.tickets.push(leadTicketNo(facts.id))
    if (String(facts.createdAt) > String(entry.lastAt)) { entry.lastAt = facts.createdAt; if (!owner) entry.name = facts.name || entry.name }
  }
  const order = (a, b) => String(b.lastAt).localeCompare(String(a.lastAt)) || b.count - a.count
  return {
    registered: [...stats.values()].map((s) => ({ ...s, phones: [...s.phones] })).sort(order),
    unregistered: [...loose.values()].sort(order),
  }
}

// ทรัพย์ซ้ำ: same = เลขโฉนดตรงกันในจังหวัดเดียวกัน (เขต/อำเภอต้องไม่ขัดกัน) · possible = ไม่มีเลขโฉนดให้เทียบ แต่ตำบลเดียวกันและเนื้อที่เท่ากัน
// คืนรายการเรียงจากที่ส่งก่อน · earlier = รายการนั้นส่งก่อน row · ไม่นับรายการที่ยกเลิก
export function findDuplicateLeads(row, rows = []) {
  const me = leadFacts(row)
  if (!me.id && !me.createdAt) return []
  const out = []
  for (const other of rows) {
    const it = leadFacts(other)
    if (!it.id || it.id === me.id || it.status === CANCELLED_STATUS) continue
    if (!me.province || me.province !== it.province) continue
    const districtClash = me.district && it.district && me.district !== it.district
    const sameDeed = !districtClash && me.deedNos.some((no) => it.deedNos.includes(no))
    const sameShape = !sameDeed && !(me.deedNos.length && it.deedNos.length)
      && me.sqw > 0 && me.sqw === it.sqw && me.subdistrict && me.subdistrict === it.subdistrict && me.district === it.district
    if (!sameDeed && !sameShape) continue
    out.push({
      id: it.id,
      ticketNo: leadTicketNo(it.id),
      certainty: sameDeed ? 'same' : 'possible',
      createdAt: it.createdAt,
      earlier: it.id < me.id,
      sameSender: Boolean(me.phone) && me.phone === it.phone,
      status: it.status,
    })
  }
  return out.sort((a, b) => a.id - b.id)
}

const agoText = (from, to) => {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const hours = Math.floor(ms / 3600000)
  if (hours < 1) return 'ไม่ถึงชั่วโมง'
  return hours < 24 ? `${hours} ชั่วโมง` : `${Math.floor(hours / 24)} วัน`
}

// ข้อความเตือนทรัพย์ซ้ำหนึ่งบรรทัดต่อรายการ (ไม่มีชื่อ เบอร์ เลขโฉนด) — ใช้บนการ์ด lead และในข้อความเทเลแกรม
export function duplicateLines(row, duplicates = []) {
  const me = leadFacts(row)
  return duplicates.map((d) => {
    const gap = agoText(d.earlier ? d.createdAt : me.createdAt, d.earlier ? me.createdAt : d.createdAt)
    const order = d.earlier ? `ส่งเข้ามาก่อน${gap ? ` ${gap}` : ''}` : `ส่งเข้ามาทีหลัง${gap ? ` ${gap}` : ''}`
    const who = d.sameSender ? 'ผู้ส่งคนเดียวกัน' : 'ผู้ส่งคนละคน'
    return `${d.certainty === 'same' ? 'ทรัพย์ซ้ำกับ' : 'อาจซ้ำกับ'} ${d.ticketNo} (${order} · ${who})`
  })
}

// บรรทัดเรื่องนายหน้าในข้อความเทเลแกรมของ lead ใหม่ — ไม่มีชื่อหรือเบอร์
// info: { code, isNew, priorCount, mismatch, unidentified }
export function brokerNotifyLines(info) {
  if (!info) return []
  if (info.unidentified) return ['นายหน้า: เบอร์ที่กรอกไม่ครบ ระบุตัวตนไม่ได้']
  const lines = [info.isNew
    ? `นายหน้าใหม่ (รหัส ${info.code}) ยังไม่เคยส่งงาน ควรโทรคุยก่อน`
    : `นายหน้าเดิม รหัส ${info.code} · ส่งมาแล้ว ${info.priorCount} ทรัพย์ก่อนหน้านี้`]
  if (info.mismatch) lines.push('ลิงก์ที่ใช้เป็นของนายหน้าอีกคน (ลิงก์ถูกส่งต่อ) ระบบยึดเบอร์ที่กรอกเป็นหลัก')
  return lines
}

// เส้นทางของรายการประเมินหลังรับทรัพย์: ประเมินละเอียด (ฟอร์มเต็ม บันทึกกลับรายการเดิม) → สรุปส่งนายทุน → รอผล → สร้างสัญญา
// ฟังก์ชันล้วน ไม่แตะฐานข้อมูล — ทดสอบที่ valuationWorkflow.test.mjs
import { leadTicketNo } from './leadSource.js'
import { drawnBoundarySummary } from './parcelBoundary.js'

// ป้ายความเสี่ยงที่ saveValuation เขียนลงคอลัมน์ risks (ข้อความ) — ใช้แปลงกลับเป็นช่องติ๊กเมื่อรายการเก่าไม่มี form_snapshot
export const RISK_LABELS = {
  hardAccess: 'เข้าถึงยาก/ซอยตัน', irregularShape: 'รูปแปลงผิดปกติ', encumbrance: 'มีภาระผูกพัน',
  dispute: 'มีข้อพิพาท/ครอบครอง', noUtilities: 'ไม่มีสาธารณูปโภค', nuisance: 'ติดสิ่งรบกวน',
}

// ช่องของฟอร์มประเมินที่เก็บลง form_snapshot (ช่องที่ไม่มีคอลัมน์ของตัวเอง เช่น ระดับน้ำท่วม ประเภทเอกสารสิทธิ์ ราคาเทียบ)
const SNAPSHOT_KEYS = [
  'assessmentType', 'propertyType', 'propertySubtype', 'projectName', 'assessmentDate', 'assessorName', 'deeds',
  'province', 'district', 'subdistrict', 'roadType', 'roadWidth', 'landFrontage', 'distanceFromMain',
  'zoneColor', 'soilCondition', 'compPrice', 'compSource', 'locationNote', 'risks', 'floodLevel', 'titleType', 'titleEncumbrance',
  'comps', 'ltvRate', 'lat', 'lng', 'requestedLoan', 'assetCode', 'parcelBoundary',
]

// assessed = true เมื่อบันทึกจากฟอร์มประเมินเต็มของทีมงาน · false = ข้อมูลที่ผู้ส่งกรอกเองบนหน้า /assess
export function formSnapshotOf(form = {}, { assessed = false } = {}) {
  const snapshot = {}
  for (const key of SNAPSHOT_KEYS) if (form[key] !== undefined) snapshot[key] = form[key]
  return { ...JSON.parse(JSON.stringify(snapshot)), _assessed: !!assessed }
}

// รายการนี้ผ่านการประเมินละเอียดโดยทีมงานแล้วหรือยัง
export const isAssessed = (row = {}) => row.formSnapshot?._assessed === true

const text = (v) => (v == null ? '' : String(v))
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

// แปลงรายการที่บันทึกไว้ (รูปแบบของ getValuations) กลับเป็นค่าตั้งต้นของฟอร์มประเมินเต็ม
// มี form_snapshot = ใช้ทั้งชุด · ไม่มี (lead จากเว็บรุ่นแรก รายการเก่า) = ประกอบจากคอลัมน์ ช่องที่ไม่เคยถูกเก็บใช้ค่าเริ่มต้น
// คืน { form, rebuilt } — rebuilt = true แปลว่าผู้ใช้ควรตรวจช่องความเสี่ยงและเอกสารสิทธิ์อีกครั้ง
export function rowToForm(row = {}, initialForm = {}) {
  const base = JSON.parse(JSON.stringify(initialForm))
  const images = Array.isArray(row.propertyImages) ? row.propertyImages : []
  if (row.formSnapshot && typeof row.formSnapshot === 'object') {
    const { _assessed, ...saved } = JSON.parse(JSON.stringify(row.formSnapshot))
    // snapshot จากหน้า /assess มีเฉพาะช่องที่ผู้ส่งกรอก → ยังต้องให้ทีมงานตรวจช่องที่เหลือ
    return { form: { ...base, ...saved, propertyImages: images }, rebuilt: _assessed !== true }
  }
  const riskText = text(row['ปัจจัยเสี่ยง'])
  const risks = { ...(base.risks || {}) }
  for (const [key, label] of Object.entries(RISK_LABELS)) risks[key] = riskText.includes(label)
  const deeds = Array.isArray(row.deeds) && row.deeds.length ? JSON.parse(JSON.stringify(row.deeds)) : base.deeds
  const form = {
    ...base,
    assessmentType: text(row['ประเภทการประเมิน']) || base.assessmentType,
    propertyType: text(row['ประเภทอสังหาฯ']) || base.propertyType,
    propertySubtype: text(row['ประเภทย่อย']) || base.propertySubtype,
    projectName: text(row['รหัส/ชื่อทรัพย์']),
    assessmentDate: text(row['วันที่ประเมิน']) || base.assessmentDate,
    assessorName: text(row['ผู้ประเมิน']),
    deeds,
    province: text(row['จังหวัด']) || base.province,
    district: text(row['อำเภอ/เขต']),
    subdistrict: text(row['ตำบล/แขวง']),
    roadType: text(row['ทำเล']), roadWidth: text(row['ความกว้างถนน']), landFrontage: text(row['หน้ากว้าง']),
    distanceFromMain: text(row['ระยะห่างถนนใหญ่']), zoneColor: text(row['ผังเมือง']), soilCondition: text(row['สภาพดิน']),
    compPrice: text(row['Comp (บ./ตร.ว.)']), compSource: text(row['แหล่ง Comp']),
    locationNote: text(row['หมายเหตุ']),
    risks,
    ltvRate: num(row['LTV Rate (%)']) || base.ltvRate,
    lat: row.lat ?? null, lng: row.lng ?? null,
    requestedLoan: num(row['วงเงินที่ลูกค้าขอ']) ? String(num(row['วงเงินที่ลูกค้าขอ'])) : '',
    propertyImages: images,
  }
  return { form, rebuilt: true }
}

const baht = (n) => (num(n) > 0 ? `${Math.round(num(n)).toLocaleString('th-TH')} บาท` : '')

function areaText(totalSqw) {
  const sqw = num(totalSqw)
  if (sqw <= 0) return ''
  const rest = Math.round((sqw % 100) * 10) / 10
  return `${Math.floor(sqw / 400)}-${Math.floor((sqw % 400) / 100)}-${rest} ไร่ (${sqw.toLocaleString('th-TH')} ตร.ว.)`
}

// จำนวนเงินแบบที่เจ้าของใช้ในข้อความถึงนายทุน: ตั้งแต่ 1 ล้านขึ้นไปเป็น "ลบ." (ทศนิยมไม่เกิน 2 ตำแหน่ง) ต่ำกว่านั้นเป็นบาทเต็ม
export function millions(n) {
  const v = num(n)
  if (v <= 0) return ''
  if (v < 1e6) return `${Math.round(v).toLocaleString('th-TH')} บาท`
  return `${String(Math.round(v / 1e4) / 100)} ลบ.`
}

const pct = (part, whole) => (num(part) > 0 && num(whole) > 0 ? `${Math.round((num(part) / num(whole)) * 100)}%` : '')
const mapLinkOf = (row) => {
  const fromNote = text(row['หมายเหตุ']).split('\n').map((l) => l.trim()).find((l) => l.startsWith('แผนที่:'))
  if (fromNote) return fromNote.replace('แผนที่:', '').trim()
  return Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng)) && row.lat != null && row.lng != null ? `https://maps.google.com/?q=${row.lat},${row.lng}` : ''
}

// ค่าตั้งต้นของช่องในแผง "สรุปส่งนายทุน" จากรายการประเมิน (เจ้าของแก้ได้ทุกช่อง)
export function investorDefaults(row = {}) {
  const place = [row['อำเภอ/เขต'], row['จังหวัด']].map((s) => text(s).trim()).filter(Boolean).join(' ')
  return {
    to: '',
    title: [text(row['ประเภทการประเมิน']), text(row['ประเภทย่อย']) || text(row['ประเภทอสังหาฯ']), place].filter(Boolean).join(' '),
    building: '', buildingGovValue: '',
    marketValue: num(row['มูลค่าตลาดรวม']) ? String(Math.round(num(row['มูลค่าตลาดรวม']))) : '',
    fsv: num(row['FSV (80%)']) ? String(Math.round(num(row['FSV (80%)']))) : '',
    amount: num(row['วงเงินที่ลูกค้าขอ']) ? String(Math.round(num(row['วงเงินที่ลูกค้าขอ']))) : '',
    ratePct: '', advanceMonths: '', feePct: '', term: '', altPct: '60', note: '',
  }
}

// ข้อความสรุปทรัพย์ถึงนายทุน ตามรูปแบบที่เจ้าของใช้จริง (ตัวอย่างที่เจ้าของส่งให้ 18 พ.ย. 2569):
// หัวเรื่อง → โฉนด/ที่ตั้ง/เนื้อที่/แผนที่ → ทำเล → สิ่งปลูกสร้าง → ราคาประเมินราชการ → ราคาตลาดและราคาเทียบ → ราคาบังคับขาย
// → เงื่อนไขที่ขอ → LTV เทียบสามฐานราคา → วงเงินทางเลือกต่อรอง
// ไม่มีชื่อ เบอร์ หรือ LINE ของลูกค้า/นายหน้า · ระบบร่างให้ เจ้าของแก้ข้อความต่อได้ก่อนคัดลอกไปส่งเอง
// ตัวเลขทุกตัวมาจากรายการประเมินหรือช่องที่เจ้าของกรอก บรรทัดที่ไม่มีข้อมูลจะไม่ถูกเขียน
export function buildInvestorSummary(row = {}, input = {}) {
  const o = { ...investorDefaults(row), ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== null)) }
  const snap = row.formSnapshot && typeof row.formSnapshot === 'object' ? row.formSnapshot : {}
  const deeds = (Array.isArray(snap.deeds) && snap.deeds.length ? snap.deeds : Array.isArray(row.deeds) ? row.deeds : [])
  const ticket = leadTicketNo(row._rowIndex)
  const sqw = num(row.totalSqw || row['ตร.ว.รวม'])
  const place = [row['ตำบล/แขวง'] && `ต.${text(row['ตำบล/แขวง']).trim()}`, row['อำเภอ/เขต'] && `อ.${text(row['อำเภอ/เขต']).trim()}`, row['จังหวัด'] && `จ.${text(row['จังหวัด']).trim()}`].filter(Boolean).join(' ')
  const deedLines = deeds.filter((d) => text(d.titleDeedNo).trim() || text(d.landNo).trim())
    .map((d) => [text(d.titleDeedNo).trim() && `โฉนด ${text(d.titleDeedNo).trim()}`, text(d.landNo).trim() && `เลขที่ดิน ${text(d.landNo).trim()}`].filter(Boolean).join(' | '))
  const titleType = text(snap.titleType).trim()
  const mapLink = mapLinkOf(row)
  // แนวเขตที่เจ้าของวาดบนภาพถ่ายดาวเทียม (ปุ่ม "วัดพื้นที่บนแผนที่"): บอกเนื้อที่ที่วัดได้ และส่วนต่างจากหน้าโฉนดเมื่อวาดครบทุกแปลง
  const drawn = drawnBoundarySummary(snap)
  const drawnDiff = drawn && drawn.complete && sqw > 0 ? Math.abs(drawn.sqw - sqw) / sqw * 100 : null
  const drawnLine = drawn && drawn.sqw > 0
    ? `แนวเขตที่วาดบนภาพถ่ายดาวเทียม ≈ ${drawn.sqw.toLocaleString('th-TH')} ตร.ว.${drawnDiff != null ? ` (ต่างจากหน้าโฉนด ${drawnDiff < 1 ? 'ไม่ถึง 1' : Math.round(drawnDiff)}%)` : drawn.complete ? '' : ` (วาดแล้ว ${drawn.count} แปลง)`} · ค่าประมาณ ไม่ใช่แนวเขตทางการ`
    : ''

  const road = text(snap.roadType || row['ทำเล']).trim()
  const location = [
    [road, text(snap.roadWidth || row['ความกว้างถนน']).trim() && `ถนนกว้าง ${text(snap.roadWidth || row['ความกว้างถนน']).trim()}`].filter(Boolean).join(' · '),
    text(snap.landFrontage || row['หน้ากว้าง']).trim() && `หน้ากว้างที่ดิน ${text(snap.landFrontage || row['หน้ากว้าง']).trim()}`,
    text(snap.distanceFromMain || row['ระยะห่างถนนใหญ่']).trim() && `ห่างถนนใหญ่ ${text(snap.distanceFromMain || row['ระยะห่างถนนใหญ่']).trim()}`,
    text(snap.zoneColor || row['ผังเมือง']).trim() && `ผังเมือง ${text(snap.zoneColor || row['ผังเมือง']).trim()}`,
    text(snap.floodLevel).trim() && text(snap.floodLevel).trim() !== 'ไม่มีประวัติน้ำท่วม' && `น้ำท่วม: ${text(snap.floodLevel).trim()}`,
  ].filter(Boolean)
  const risk = text(row['ปัจจัยเสี่ยง']).trim()
  const senderNote = text(row['หมายเหตุ']).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('แผนที่:')).join('\n')

  const govPerSqw = num(row['ราคาประเมินรัฐ (บ./ตร.ว.)'])
  const govLand = govPerSqw * sqw
  const buildingGov = num(o.buildingGovValue)
  const govTotal = govLand + buildingGov
  const market = num(o.marketValue)
  const fsv = num(o.fsv)
  const marketPerSqw = num(row['ราคาตลาด (บ./ตร.ว.)']) || (market > 0 && sqw > 0 && !buildingGov ? market / sqw : 0)
  const comps = (Array.isArray(snap.comps) ? snap.comps : []).filter((c) => num(c.price) > 0)
    .map((c) => `→ ≈ ${Math.round(num(c.price)).toLocaleString('th-TH')} บ./ตร.ว.${[c.access, c.size].filter(Boolean).length ? ` (${[c.access, c.size].filter(Boolean).join(' · ')})` : ''}`)
  const compSource = text(snap.compSource || row['แหล่ง Comp']).trim()
  // ผลสำรวจประกาศขายที่เจ้าของกดใช้ (form.marketSurvey จากแผงสำรวจราคาตลาด): ช่วงราคา + รายการประกาศที่เลือก พร้อมลิงก์ให้นายทุนเปิดดูเอง
  const survey = snap.marketSurvey && Array.isArray(snap.marketSurvey.comps) && snap.marketSurvey.comps.length ? snap.marketSurvey : null
  const BASIS = { land: 'ที่ดินเปล่า', building: 'พร้อมสิ่งปลูกสร้าง', condo: 'ห้องชุด' }
  const surveyRange = survey && num(survey.low) > 0 ? `ช่วงราคาประกาศขายใกล้เคียง ≈ ${Math.round(num(survey.low)).toLocaleString('th-TH')}–${Math.round(num(survey.high)).toLocaleString('th-TH')} บ./ตร.ว. (${survey.comps.length} ประกาศ${num(survey.discountPct) > 0 ? ` หักต่อรอง ${num(survey.discountPct)}%` : ''})` : ''
  const surveyComps = survey ? survey.comps.slice(0, 8).flatMap((c) => [
    `→ ≈ ${Math.round(num(c.price_per_sqw)).toLocaleString('th-TH')} บ./ตร.ว. (${[BASIS[c.basis], num(c.area_sqw) > 0 && `${num(c.area_sqw)} ตร.ว.`, text(c.road || c.location).trim()].filter(Boolean).join(' · ')})`,
    /^https?:\/\//.test(text(c.url)) ? `   ${text(c.url)}` : false,
  ]) : []

  const amount = num(o.amount)
  const rate = num(o.ratePct)
  const interest = amount > 0 && rate > 0 ? Math.round((amount * rate) / 100) : 0
  const feeTerm = [num(o.feePct) > 0 && `ปากถุง ${num(o.feePct)}%`, text(o.term).trim() && `สัญญา ${text(o.term).trim()}`].filter(Boolean).join(' ')
  const altPct = num(o.altPct)
  // วงเงินทางเลือกต่อรอง = สัดส่วนของราคาราชการ แสดงเฉพาะเมื่อต่ำกว่าวงเงินที่ขอ (สูงกว่าที่ขอไม่ใช่ทางเลือกต่อรอง)
  const altRaw = govTotal > 0 && altPct > 0 ? (govTotal * altPct) / 100 : 0
  const alt = altRaw > 0 && (amount <= 0 || altRaw < amount) ? altRaw : 0
  const building = text(o.building).trim()
  const note = text(o.note).trim().slice(0, 800)

  const block = (...lines) => { const kept = lines.flat().filter((l) => l !== false && l != null && l !== undefined && l !== ''); return kept.length ? [...kept, ''] : [] }
  const lines = [
    ...block(`${text(o.to).trim() ? `@${text(o.to).trim().replace(/^@/, '')} ` : ''}${text(o.title).trim() || 'สรุปทรัพย์เพื่อพิจารณา'}`, ticket && `เลขรับเรื่อง ${ticket}`),
    ...block(deedLines, place, sqw > 0 && `เนื้อที่ ${areaText(sqw).replace(/\((.*) ตร\.ว\.\)/, '($1 ตร.ว.)')}`, drawnLine, titleType, mapLink && `📍 ${mapLink}`),
    ...(location.length || (risk && risk !== 'ไม่มี') ? block('📌 ทำเล', location, risk && risk !== 'ไม่มี' && `ข้อสังเกต: ${risk}`) : []),
    ...(building ? block('สิ่งปลูกสร้าง', building) : []),
    ...(govLand > 0 ? block(
      `💰 ราคาประเมินที่ดิน รวม ${sqw.toLocaleString('th-TH')} ตร.ว.`,
      `${Math.round(govPerSqw).toLocaleString('th-TH')} บาทต่อตารางวา${deeds.length > 1 ? ' (เฉลี่ยตามเนื้อที่)' : ''}`,
      `= ${Math.round(govLand).toLocaleString('th-TH')} บาท`,
      buildingGov > 0 && `ส่วนของสิ่งปลูกสร้าง (ราคาราชการ) ≈ ${Math.round(buildingGov).toLocaleString('th-TH')} บาท`,
      buildingGov > 0 && `ประเมินกรมที่ดิน (รวมสิ่งปลูกสร้าง) ≈ ${millions(govTotal)}`,
    ) : []),
    ...(market > 0 || comps.length || surveyComps.length || fsv > 0 ? block(
      market > 0 && `ราคาตลาด: ≈ ${millions(market)}${marketPerSqw > 0 ? ` (${Math.round(marketPerSqw).toLocaleString('th-TH')} บ./ตร.ว.)` : ''}${compSource ? ` (อ้างอิง ${compSource})` : ''}`,
      surveyRange,
      (comps.length > 0 || surveyComps.length > 0) && 'ข้อมูลราคาตลาดใกล้เคียง',
      comps,
      surveyComps,
      fsv > 0 && `ราคาบังคับขาย ≈ ${millions(fsv)}`,
    ) : []),
    ...(amount > 0 ? block(
      '📝 เงื่อนไขที่ขอ',
      `วงเงิน ${Math.round(amount).toLocaleString('th-TH')} บาท`,
      rate > 0 && `ดอกเบี้ย ${rate}%/เดือน (${interest.toLocaleString('th-TH')} บาท)`,
      num(o.advanceMonths) > 0 && `หักล่วงหน้า ${num(o.advanceMonths)} เดือน`,
      feeTerm,
    ) : []),
    ...(amount > 0 && (govTotal > 0 || market > 0 || fsv > 0) ? block(
      `LTV ที่วงเงิน ${millions(amount)}`,
      pct(amount, govTotal) && `ราคาราชการ ≈ ${pct(amount, govTotal)}`,
      pct(amount, market) && `ราคาตลาด ≈ ${pct(amount, market)}`,
      pct(amount, fsv) && `ราคาบังคับขาย ≈ ${pct(amount, fsv)}`,
    ) : []),
    ...(alt > 0 ? block('วงเงินทางเลือกต่อรอง', `${millions(alt)} (${altPct}% ของราคาราชการ${buildingGov > 0 ? 'รวมสิ่งปลูกสร้าง' : ''})`) : []),
    ...(senderNote ? block('หมายเหตุจากผู้ส่ง', senderNote) : []),
    ...(note ? block(note) : []),
  ]
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}


// ค่าตั้งต้นของฟอร์มสร้างสัญญาจากรายการประเมิน
// lead ที่เจ้าของทรัพย์ส่งเอง: ผู้ติดต่อ = ลูกค้า · lead จากนายหน้า: ผู้ติดต่อ = นายหน้า (ชื่อลูกค้าต้องกรอกเอง)
// เงินต้น: วงเงินที่นายทุนอนุมัติ > วงเงินที่ลูกค้าขอ > วงเงินแนะนำ (สองอย่างหลังคือพฤติกรรมเดิม)
export function contractPrefill(row = {}) {
  const approved = num(row.approvedLoan)
  const requested = num(row['วงเงินที่ลูกค้าขอ'])
  const recommended = num(row['วงเงินแนะนำ'])
  const principal = approved || requested || recommended
  const principalSource = approved ? 'วงเงินที่นายทุนอนุมัติ' : requested ? 'วงเงินที่ลูกค้าขอ' : recommended ? 'วงเงินแนะนำ' : ''
  const isBroker = row.leadSource === 'broker'
  const isOwner = row.leadSource === 'owner'
  return {
    principal,
    principalSource,
    customerName: isOwner ? text(row.contactName).trim() : '',
    brokerName: isBroker ? [text(row.contactName).trim(), text(row.leadRef).trim() && `(${text(row.leadRef).trim()})`].filter(Boolean).join(' ') : '',
  }
}

// ชั่วโมงที่รอผลจากนายทุน (ทศนิยม 1 ตำแหน่ง) · ยังไม่ส่ง = null
export function waitingHours(sentAt, now = Date.now()) {
  const t = new Date(sentAt).getTime()
  if (!sentAt || !Number.isFinite(t) || now < t) return null
  return Math.round(((now - t) / 3600000) * 10) / 10
}

// สถานะที่รายการควรกลับไปเมื่อกด "ส่งกลับแก้ไขประเมินใหม่" — lead จากเว็บกลับไปแท็บ Lead (ไม่หายจากหน้านายทุน)
export const returnStatusOf = (row = {}) => (row.leadSource ? 'Lead จากเว็บ' : 'รอดำเนินการ')

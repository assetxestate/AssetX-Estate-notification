import test from 'node:test'
import assert from 'node:assert/strict'
import { rowToForm, formSnapshotOf, isAssessed, buildInvestorSummary, investorDefaults, millions, contractPrefill, waitingHours, returnStatusOf } from './valuationWorkflow.js'

const INITIAL = {
  assessmentType: 'ขายฝาก', propertyType: 'ที่ดิน', propertySubtype: 'ที่ดินเปล่า (โฉนด)', projectName: '', assessmentDate: '2026-11-18', assessorName: '',
  deeds: [{ id: 1, titleDeedNo: '', areaRai: 0, areaNgan: 0, areaSqw: 0 }], province: 'กรุงเทพมหานคร', district: '', subdistrict: '',
  roadType: '', roadWidth: '', landFrontage: '', distanceFromMain: '', zoneColor: '', soilCondition: '', compPrice: '', compSource: '', locationNote: '',
  risks: { hardAccess: false, irregularShape: false, encumbrance: false, dispute: false, noUtilities: false, nuisance: false },
  floodLevel: 'ไม่มีประวัติน้ำท่วม', titleType: 'โฉนด (Chanote) ปลอดภาระ', comps: [], ltvRate: 50, linkedCustomer: '', lat: null, lng: null,
  requestedLoan: '', assetCode: '', propertyImages: [], parcelBoundary: null,
}

// แถวตัวอย่าง (ตัวเลขและชื่อสมมติ) ในรูปแบบของ getValuations
const leadRow = {
  _rowIndex: 31, 'ประเภทการประเมิน': 'ขายฝาก', 'ประเภทอสังหาฯ': 'ที่อยู่อาศัย', 'ประเภทย่อย': 'บ้านเดี่ยว', 'รหัส/ชื่อทรัพย์': 'ตัวอย่าง — 12345',
  'จังหวัด': 'นนทบุรี', 'อำเภอ/เขต': 'ปากเกร็ด', 'ตำบล/แขวง': 'บางพูด', 'ทำเล': 'ติดถนนซอย', 'ผังเมือง': 'สีเหลือง',
  'Comp (บ./ตร.ว.)': '65000', 'LTV Rate (%)': 50, 'วงเงินที่ลูกค้าขอ': 2000000, 'วงเงินแนะนำ': 2015000, 'มูลค่าตลาดรวม': 4030000, 'FSV (80%)': 3224000,
  'Property Score': 88, 'ราคาประเมินรัฐ (บ./ตร.ว.)': 42000, 'ปัจจัยเสี่ยง': 'มีภาระผูกพัน, ติดสิ่งรบกวน', 'หมายเหตุ': 'ภาระเดิมกับธนาคาร',
  totalSqw: 62, deeds: [{ id: 9, titleDeedNo: '12345', areaRai: 0, areaNgan: 0, areaSqw: 62, docType: 'chanote' }], propertyImages: [],
  contactName: 'นายหน้า ตัวอย่าง', contactPhone: '080-000-0000', contactLine: 'brokerline', leadSource: 'broker', leadRef: 'คุณเอ',
}

test('รายการเก่าที่ไม่มี snapshot: ประกอบฟอร์มจากคอลัมน์ และแปลงข้อความความเสี่ยงกลับเป็นช่องติ๊ก', () => {
  const { form, rebuilt } = rowToForm(leadRow, INITIAL)
  assert.equal(rebuilt, true)
  assert.equal(form.propertySubtype, 'บ้านเดี่ยว')
  assert.equal(form.district, 'ปากเกร็ด')
  assert.equal(form.compPrice, '65000')
  assert.equal(form.requestedLoan, '2000000')
  assert.deepEqual(form.risks, { hardAccess: false, irregularShape: false, encumbrance: true, dispute: false, noUtilities: false, nuisance: true })
  assert.equal(form.deeds[0].areaSqw, 62)
  assert.equal(form.floodLevel, INITIAL.floodLevel) // ไม่เคยถูกเก็บ → ค่าเริ่มต้น
  form.deeds[0].areaSqw = 999
  assert.equal(leadRow.deeds[0].areaSqw, 62) // ไม่แก้ข้อมูลต้นทาง
})

test('รายการที่มี snapshot: ได้ฟอร์มเดิมครบทุกช่อง รวมช่องที่ไม่มีคอลัมน์', () => {
  const edited = { ...rowToForm(leadRow, INITIAL).form, floodLevel: 'ท่วมบางปี', titleType: 'น.ส.3ก', comps: [{ price: 70000 }], lat: 13.9, lng: 100.5 }
  const snapshot = formSnapshotOf(edited, { assessed: true })
  assert.equal(isAssessed({ formSnapshot: snapshot }), true)
  assert.equal(isAssessed({ formSnapshot: formSnapshotOf(edited) }), false)
  assert.equal(isAssessed({}), false)
  assert.equal(rowToForm({ ...leadRow, formSnapshot: formSnapshotOf(edited) }, INITIAL).rebuilt, true)
  assert.equal(rowToForm({ ...leadRow, formSnapshot: snapshot }, INITIAL).form._assessed, undefined)
  assert.equal(snapshot.propertyImages, undefined)
  assert.equal(snapshot.linkedCustomer, undefined)
  const { form, rebuilt } = rowToForm({ ...leadRow, formSnapshot: snapshot, propertyImages: [{ url: 'x' }] }, INITIAL)
  assert.equal(rebuilt, false)
  assert.equal(form.floodLevel, 'ท่วมบางปี')
  assert.equal(form.titleType, 'น.ส.3ก')
  assert.deepEqual(form.comps, [{ price: 70000 }])
  assert.equal(form.lat, 13.9)
  assert.deepEqual(form.propertyImages, [{ url: 'x' }])
})

test('รายการว่าง: ได้ฟอร์มเริ่มต้น ไม่พัง', () => {
  const { form } = rowToForm({}, INITIAL)
  assert.equal(form.province, 'กรุงเทพมหานคร')
  assert.equal(form.requestedLoan, '')
  assert.equal(form.deeds.length, 1)
})

// ทรัพย์สมมติตามรูปแบบข้อความที่เจ้าของใช้ (18 พ.ย. 2569) — ตัวเลข LTV ต้องออกมาตรงกับการคำนวณด้วยมือ
const resort = {
  _rowIndex: 22, 'ประเภทการประเมิน': 'ขายฝาก', 'ประเภทย่อย': 'รีสอร์ท', 'จังหวัด': 'ประจวบคีรีขันธ์', 'อำเภอ/เขต': 'หัวหิน', 'ตำบล/แขวง': 'หนองแก',
  totalSqw: 350, 'ราคาประเมินรัฐ (บ./ตร.ว.)': 8000, 'มูลค่าตลาดรวม': 8095000, 'FSV (80%)': 5270000, 'วงเงินที่ลูกค้าขอ': 4500000, 'ปัจจัยเสี่ยง': 'ไม่มี',
  'หมายเหตุ': 'แผนที่: https://maps.app.goo.gl/example\nภาระเดิมกับธนาคาร',
  contactName: 'นายหน้า ตัวอย่าง', contactPhone: '080-000-0000', contactLine: 'brokerline', leadSource: 'broker', leadRef: 'คุณเอ',
  formSnapshot: {
    deeds: [{ titleDeedNo: '12345', landNo: '678', areaRai: 0, areaNgan: 3, areaSqw: 50, govPrice: 8000 }], titleType: 'โฉนด (Chanote) ปลอดภาระ',
    roadType: 'ซอยปกติ', distanceFromMain: '450 ม.', zoneColor: 'ชุมชน (ชมพู)', floodLevel: 'ไม่มีประวัติน้ำท่วม',
    comps: [{ price: 15000, access: 'ซอยปกติ', size: '> 1,000 ตร.ว.' }, { price: 0 }], compSource: 'ประกาศขาย ปี 2569',
  },
}

test('สรุปส่งนายทุนตามรูปแบบของเจ้าของ: โฉนด ที่ตั้ง ราคาสามฐาน เงื่อนไข และ LTV ตรงกับตัวอย่างจริง', () => {
  const msg = buildInvestorSummary(resort, { to: 'INV', title: 'ขายฝาก รีสอร์ทตัวอย่าง หัวหิน', building: 'ห้องพักชั้นเดียว 8 หลัง', buildingGovValue: '1523511', ratePct: '1.25', advanceMonths: '3', feePct: '5', term: '1 ปี' })
  assert.match(msg, /^@INV ขายฝาก รีสอร์ทตัวอย่าง หัวหิน\nเลขรับเรื่อง AX-00022/)
  assert.match(msg, /โฉนด 12345 \| เลขที่ดิน 678\nต\.หนองแก อ\.หัวหิน จ\.ประจวบคีรีขันธ์\nเนื้อที่ 0-3-50 ไร่ \(350 ตร\.ว\.\)\nโฉนด \(Chanote\) ปลอดภาระ\n📍 https:\/\/maps\.app\.goo\.gl\/example/)
  assert.match(msg, /📌 ทำเล\nซอยปกติ\nห่างถนนใหญ่ 450 ม\.\nผังเมือง ชุมชน \(ชมพู\)/)
  assert.match(msg, /สิ่งปลูกสร้าง\nห้องพักชั้นเดียว 8 หลัง/)
  assert.match(msg, /💰 ราคาประเมินที่ดิน รวม 350 ตร\.ว\.\n8,000 บาทต่อตารางวา\n= 2,800,000 บาท\nส่วนของสิ่งปลูกสร้าง \(ราคาราชการ\) ≈ 1,523,511 บาท\nประเมินกรมที่ดิน \(รวมสิ่งปลูกสร้าง\) ≈ 4\.32 ลบ\./)
  assert.match(msg, /ราคาตลาด: ≈ 8\.1 ลบ\. \(อ้างอิง ประกาศขาย ปี 2569\)\nข้อมูลราคาตลาดใกล้เคียง\n→ ≈ 15,000 บ\.\/ตร\.ว\. \(ซอยปกติ · > 1,000 ตร\.ว\.\)\nราคาบังคับขาย ≈ 5\.27 ลบ\./)
  assert.match(msg, /📝 เงื่อนไขที่ขอ\nวงเงิน 4,500,000 บาท\nดอกเบี้ย 1\.25%\/เดือน \(56,250 บาท\)\nหักล่วงหน้า 3 เดือน\nปากถุง 5% สัญญา 1 ปี/)
  assert.match(msg, /LTV ที่วงเงิน 4\.5 ลบ\.\nราคาราชการ ≈ 104%\nราคาตลาด ≈ 56%\nราคาบังคับขาย ≈ 85%/)
  assert.match(msg, /วงเงินทางเลือกต่อรอง\n2\.59 ลบ\. \(60% ของราคาราชการรวมสิ่งปลูกสร้าง\)/)
  assert.match(msg, /หมายเหตุจากผู้ส่ง\nภาระเดิมกับธนาคาร/)
  // ไม่มีข้อมูลบุคคลของลูกค้า/นายหน้า และไม่มีค่าว่างหลุด
  assert.doesNotMatch(msg, /นายหน้า ตัวอย่าง|080-000-0000|brokerline|คุณเอ|undefined|null|false|NaN/)
  assert.doesNotMatch(msg, /\n\n\n/)
})

test('สรุปส่งนายทุน: ข้อมูลน้อยก็ไม่มีหัวข้อเปล่า · ไม่มีสิ่งปลูกสร้างคิดจากราคาที่ดินอย่างเดียว', () => {
  const thin = buildInvestorSummary({ _rowIndex: 2, 'ปัจจัยเสี่ยง': 'ไม่มี' })
  assert.equal(thin, 'สรุปทรัพย์เพื่อพิจารณา\nเลขรับเรื่อง AX-00002')
  const land = buildInvestorSummary({ ...resort, formSnapshot: null, deeds: [{ titleDeedNo: '1' }, { titleDeedNo: '2' }], 'ราคาตลาด (บ./ตร.ว.)': 14000, 'มูลค่าตลาดรวม': 4900000, 'ปัจจัยเสี่ยง': 'มีภาระผูกพัน' }, { ratePct: '', altPct: '0' })
  assert.match(land, /^ขายฝาก รีสอร์ท หัวหิน ประจวบคีรีขันธ์/)
  assert.match(land, /โฉนด 1\nโฉนด 2/)
  assert.match(land, /8,000 บาทต่อตารางวา \(เฉลี่ยตามเนื้อที่\)/)
  assert.match(land, /ราคาตลาด: ≈ 4\.9 ลบ\. \(14,000 บ\.\/ตร\.ว\.\)/)
  assert.match(land, /ข้อสังเกต: มีภาระผูกพัน/)
  assert.match(land, /ราคาราชการ ≈ 161%/)
  assert.doesNotMatch(land, /สิ่งปลูกสร้าง|ดอกเบี้ย|ทางเลือกต่อรอง|ข้อมูลราคาตลาดใกล้เคียง/)
  assert.equal(millions(950000), '950,000 บาท')
  assert.equal(millions(2592107), '2.59 ลบ.')
  assert.equal(millions(4500000), '4.5 ลบ.')
  assert.equal(millions(0), '')
  assert.equal(investorDefaults(resort).amount, '4500000')
  assert.equal(investorDefaults(resort).altPct, '60')
  assert.equal(investorDefaults({ lat: 13.5, lng: 100.5 }).title, '')
  assert.match(buildInvestorSummary({ lat: 13.5, lng: 100.5 }), /📍 https:\/\/maps\.google\.com\/\?q=13\.5,100\.5/)
})

test('ค่าตั้งต้นสัญญา: นายหน้าไม่ถูกใส่เป็นชื่อลูกค้า และเงินต้นใช้ยอดที่นายทุนอนุมัติก่อน', () => {
  assert.deepEqual(contractPrefill({ ...leadRow, approvedLoan: 1800000 }), {
    principal: 1800000, principalSource: 'วงเงินที่นายทุนอนุมัติ', customerName: '', brokerName: 'นายหน้า ตัวอย่าง (คุณเอ)',
  })
  const owner = contractPrefill({ ...leadRow, leadSource: 'owner', leadRef: 'tiktok', contactName: ' สมชาย ตัวอย่าง ' })
  assert.equal(owner.customerName, 'สมชาย ตัวอย่าง')
  assert.equal(owner.brokerName, '')
  assert.equal(owner.principal, 2000000)
  assert.equal(owner.principalSource, 'วงเงินที่ลูกค้าขอ')
  // รายการประเมินภายใน (ไม่ใช่ lead): พฤติกรรมเดิม
  assert.deepEqual(contractPrefill({ 'วงเงินแนะนำ': 900000 }), { principal: 900000, principalSource: 'วงเงินแนะนำ', customerName: '', brokerName: '' })
  assert.equal(contractPrefill({}).principal, 0)
})

test('เวลารอผล และสถานะเมื่อส่งกลับ', () => {
  const now = Date.parse('2026-11-18T10:00:00Z')
  assert.equal(waitingHours('2026-11-18T07:30:00Z', now), 2.5)
  assert.equal(waitingHours('', now), null)
  assert.equal(waitingHours('2026-11-18T11:00:00Z', now), null)
  assert.equal(returnStatusOf({ leadSource: 'broker' }), 'Lead จากเว็บ')
  assert.equal(returnStatusOf({}), 'รอดำเนินการ')
})

test('boundary drawn on the map: measured area and difference from the deed go into the investor summary', async () => {
  const { drawnBoundarySummary, geodesicAreaSqm } = await import('./parcelBoundary.js')
  // about 30.7 m x 30.7 m square near Bangkok = about 944 sq m = about 236 sq wa
  const d = 0.000277, lat = 13.7, lng = 100.47, k = Math.cos(lat * Math.PI / 180)
  const points = [{ lat, lng }, { lat: lat + d, lng }, { lat: lat + d, lng: lng + d / k }, { lat, lng: lng + d / k }]
  const sqw = geodesicAreaSqm(points) / 4
  assert.ok(sqw > 225 && sqw < 245, String(sqw))
  assert.equal(geodesicAreaSqm(points.slice(0, 2)), 0)
  assert.equal(drawnBoundarySummary({ deeds: [{}] }), null)
  assert.deepEqual(drawnBoundarySummary({ parcelBoundary: { points }, deeds: [{}] }).complete, true)
  assert.equal(drawnBoundarySummary({ deeds: [{ parcelBoundary: { points } }, {}] }).complete, false)
  const msg = buildInvestorSummary({ _rowIndex: 22, totalSqw: 236, formSnapshot: { deeds: [{ parcelBoundary: { points } }] } })
  assert.match(msg, /≈ 2\d\d(\.\d)? .*\(.* \d+%|1%\)/)
  assert.doesNotMatch(msg, /NaN|undefined/)
  const none = buildInvestorSummary({ _rowIndex: 22, totalSqw: 236, formSnapshot: { deeds: [{}] } })
  assert.equal(none.split('\n').length, msg.split('\n').length - 1)
})

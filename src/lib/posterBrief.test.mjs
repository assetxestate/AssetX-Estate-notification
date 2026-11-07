// เทสต์บรีฟครีเอทีฟรายโพสต์ (ก๊อปปี้เด็คคัดจากโพสต์คำต่อคำ + ฉาก/ไอคอน) — รัน: node --test src/lib/posterBrief.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractPosterCopy, posterBriefFor, verbatimMisses, trimClause, sceneFor, sceneText, iconFor, parsePost, chipFromTitle } from './posterBrief.js'

const COST = {
  title: 'ขายฝากมีค่าใช้จ่ายอะไรบ้าง',
  caption: `คนส่วนใหญ่ถามแค่ "ได้เงินเท่าไหร่" แต่สิ่งที่ตัดสินว่าคุ้มหรือไม่คุ้มคือ "ค่าใช้จ่ายรวม" ตั้งแต่วันจดทะเบียนจนถึงวันไถ่คืน ลองไล่ดูทีละช่วง

1. วันจดทะเบียนที่สำนักงานที่ดิน: ขายฝากถือเป็นการขาย จึงมีค่าธรรมเนียมจดทะเบียนที่คิดจากราคาประเมินราชการ ภาษีเงินได้หัก ณ ที่จ่าย และอากรแสตมป์หรือภาษีธุรกิจเฉพาะอย่างใดอย่างหนึ่ง

2. ระหว่างสัญญา: สินไถ่ที่สูงกว่าราคาขายฝากคือผลประโยชน์ของผู้ซื้อฝาก และเงินที่ถูกหักล่วงหน้านับเป็นส่วนหนึ่งของสินไถ่ด้วย

3. วันไถ่ถอน: ค่าธรรมเนียมจดทะเบียนไถ่ถอนต่ำกว่าวันขายฝากมาก และผู้ซื้อฝากต้องแจ้งกำหนดไถ่เป็นหนังสือล่วงหน้าอย่างน้อย 3 เดือน

ก่อนเซ็น ขอใบสรุปค่าใช้จ่ายรวมเป็นตัวเลขจากผู้รับซื้อฝาก แล้วเทียบเงินที่คุณได้รับจริงในวันจดทะเบียน กับยอดที่ต้องไถ่คืนและวันครบกำหนด

ข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี

ส่งรูปเอกสารสิทธิ์มาทางแชต (ปิดชื่อและเลขบัตรก่อนได้) ทีม AssetX Estate ช่วยไล่ค่าใช้จ่ายรวมให้ดูก่อนตัดสินใจ`,
}
const LAND = {
  title: 'ข้อควรรู้ก่อนซื้อที่ดินเปล่า',
  caption: `ก่อนตัดสินใจซื้อ อย่าดูเฉพาะภาพสวยหรือราคาที่เสนอ ควรตรวจข้อมูลให้ครบก่อน

1. ตรวจเอกสารสิทธิ์และภาระผูกพันกับหน่วยงานที่เกี่ยวข้อง

2. ตรวจทำเล สภาพจริง สิทธิทางเข้าออก และข้อจำกัดการใช้ประโยชน์

3. เปรียบเทียบราคาและรวมค่าใช้จ่ายก่อนตัดสินใจ

ข้อมูลนี้เป็นความรู้ทั่วไป ต้องตรวจเอกสารและข้อเท็จจริงของแต่ละกรณีก่อนตัดสินใจ

สอบถามข้อมูลเบื้องต้นกับ บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด ทางแชตได้`,
}

test('parsePost: หัวข้อ/ข้อเลขลำดับ/ย่อหน้าเปิด-ปิด · บรรทัดกำกับและชวนติดต่อไม่ปน', () => {
  const p = parsePost(COST)
  assert.equal(p.points.length, 3)
  assert.equal(p.points[1].head, 'ระหว่างสัญญา: สินไถ่ที่สูงกว่าราคาขายฝากคือผลประโยชน์ของผู้ซื้อฝาก และเงินที่ถูกหักล่วงหน้านับเป็นส่วนหนึ่งของสินไถ่ด้วย')
  assert.equal(p.opening.length, 1)
  assert.equal(p.closing.length, 1, 'ย่อหน้ากำกับความรู้ทั่วไปและย่อหน้าชวนส่งเอกสารไม่นับ')
  assert.match(p.closing[0], /^ก่อนเซ็น/)
  const withTopic = parsePost({ title: '', caption: 'หัวข้อ: ข้อควรรู้\n\nเนื้อหา' })
  assert.equal(withTopic.headline, 'ข้อควรรู้')
})

test('trimClause: ตัดที่ช่องว่าง/คำเชื่อม ไม่ตัดกลางคำประสม · wholePhrases คืนค่าว่างถ้าตัดที่ช่องว่างไม่ได้', () => {
  assert.equal(trimClause('ขอใบสรุปค่าใช้จ่ายรวมเป็นตัวเลขจากผู้รับซื้อฝาก', { min: 5, max: 12 }), 'ขอใบสรุปค่าใช้จ่ายรวมเป็นตัวเลขจากผู้รับซื้อฝาก', 'วลีเดียวยาวเกินนิดหน่อย = ใช้ทั้งวลี')
  assert.equal(trimClause('ตรวจทำเล สภาพจริง สิทธิทางเข้าออก และข้อจำกัดการใช้ประโยชน์', { min: 3, max: 8, wholePhrases: true }), 'ตรวจทำเล สภาพจริง สิทธิทางเข้าออก')
  assert.equal(trimClause('เปรียบเทียบราคาและรวมค่าใช้จ่ายก่อนตัดสินใจ', { min: 3, max: 4, wholePhrases: true }), '', 'ไม่มีช่องว่างให้ตัด = ว่าง')
  assert.equal(trimClause('สั้น ๆ', { min: 1, max: 5 }), 'สั้น ๆ')
})

test('extractPosterCopy (โพสต์ค่าใช้จ่าย): คำเน้นทั้งคำ · ริบบิ้นจากประโยคเปิด · ชื่อการ์ดจากวลีในเครื่องหมายคำพูดที่มีคำเน้น · แถว = หัวข้อ + รายละเอียดจบที่วรรค · แผงลงมือทำมีหัวข้อ "ก่อนเซ็น" · ทุกสตริงคัดจากโพสต์', () => {
  const c = extractPosterCopy(COST)
  assert.equal(c.keyWord, 'ค่าใช้จ่าย')
  assert.equal(c.ribbon, 'สิ่งที่ตัดสินว่าคุ้มหรือไม่คุ้มคือ ค่าใช้จ่ายรวม')
  assert.equal(c.cardTitle, 'ค่าใช้จ่ายรวม')
  assert.deepEqual(c.rows.map((r) => r.title), ['วันจดทะเบียนที่สำนักงานที่ดิน', 'ระหว่างสัญญา', 'วันไถ่ถอน'])
  assert.equal(c.rows[0].detail, 'ขายฝากถือเป็นการขาย จึงมีค่าธรรมเนียมจดทะเบียนที่คิดจากราคาประเมินราชการ ภาษีเงินได้หัก ณ ที่จ่าย')
  assert.equal(c.rows[1].detail, 'สินไถ่ที่สูงกว่าราคาขายฝากคือผลประโยชน์ของผู้ซื้อฝาก และเงินที่ถูกหักล่วงหน้านับเป็นส่วนหนึ่งของสินไถ่ด้วย', 'รายการที่ต่อด้วย "และ…" ไม่ถูกตัดค้างกลางรายการ')
  assert.equal(c.rows[0].icon, 'calendar', 'หัวข้อขึ้นต้น "วัน…" = ปฏิทิน แม้มีคำว่าสำนักงานที่ดิน')
  assert.equal(c.rows[1].icon, 'handshake')
  assert.equal(c.actionTitle, 'ก่อนเซ็น')
  assert.equal(c.actionItems[0], 'ขอใบสรุปค่าใช้จ่ายรวมเป็นตัวเลขจากผู้รับซื้อฝาก')
  assert.match(c.actionItems[1], /^เทียบเงินที่คุณได้รับจริงในวันจดทะเบียน/)
  assert.deepEqual(c.bandChips, ['วันจดทะเบียน', 'ระหว่างสัญญา'])
  assert.deepEqual(verbatimMisses(c, COST), [])
})

test('ชื่อการ์ดจากวลีนามในเนื้อหา ("รายการที่ต้องตรวจ") · กล่องเตือนเลือก อย่า/ห้าม ก่อน ไม่ควร และค้นในข้อย่อยด้วย · ชิปแถบล่างตัดกริยานำ', () => {
  const caption = `สินไถ่และค่าใช้จ่าย ควรถามให้ชัดก่อนทำสัญญา\n\n1. ตรวจวันครบกำหนดและเงื่อนไขการไถ่ถอนในสัญญา\nเริ่มจากทำตารางวันที่สำคัญและรายการที่ต้องตรวจจากสัญญา ไม่ควรรอให้ใกล้ครบกำหนดจึงเริ่มวางแผน\n\n2. ตรวจยอดสินไถ่และค่าใช้จ่ายพร้อมเอกสารประกอบ\nแยกจำนวนเงินที่ได้รับจริง ยอดสินไถ่ และค่าใช้จ่ายแต่ละรายการออกจากกัน อย่าพิจารณาเฉพาะวงเงินที่เสนอ\n\n3. สอบถามขั้นตอนและเอกสารที่ต้องใช้กับสำนักงานที่ดินหรือผู้เชี่ยวชาญ\nเตรียมข้อมูลทรัพย์ สำเนาสัญญาที่มี และรายการคำถามไปตรวจสอบ\n\nก่อนคุยกับผู้ให้บริการ: จดสิ่งที่รู้แล้ว สิ่งที่ยังไม่ชัด และหลักฐานที่ต้องขอเพิ่ม`
  const c = extractPosterCopy({ title: 'ขายฝาก เช็กเงื่อนไขก่อนตัดสินใจ', caption })
  assert.equal(c.ribbon, 'ควรถามให้ชัดก่อนทำสัญญา')
  assert.equal(c.cardTitle, 'รายการที่ต้องตรวจ')
  assert.equal(c.callout, 'อย่าพิจารณาเฉพาะวงเงินที่เสนอ')
  assert.equal(c.actionTitle, 'ก่อนคุยกับผู้ให้บริการ')
  assert.deepEqual(c.bandChips, ['วันครบกำหนด', 'ยอดสินไถ่'])
  assert.equal(chipFromTitle('ตรวจเอกสารสิทธิ์และภาระผูกพัน'), 'เอกสารสิทธิ์')
  assert.equal(chipFromTitle('ตรวจทำเล สภาพจริง'), '', 'คำเดียวไม่เป็นชิป')
  assert.deepEqual(verbatimMisses(c, { title: 'ขายฝาก เช็กเงื่อนไขก่อนตัดสินใจ', caption }), [])
})

test('extractPosterCopy (โพสต์ที่ดินสั้น): ข้อสั้นเป็นหัวข้ออย่างเดียว ไม่ซ้ำเป็นรายละเอียด · ริบบิ้นเลือกวรรค "ควร…" · ชื่อการ์ด "ก่อนตัดสินใจซื้อ" · ไม่มีย่อหน้าปิด = ข้อควรทำจากประโยคเตือนในย่อหน้าเปิด', () => {
  const c = extractPosterCopy(LAND)
  assert.equal(c.keyWord, 'ที่ดิน')
  assert.equal(c.ribbon, 'ควรตรวจข้อมูลให้ครบก่อน')
  assert.equal(c.cardTitle, 'ก่อนตัดสินใจซื้อ')
  assert.equal(c.rows[0].title, 'ตรวจเอกสารสิทธิ์และภาระผูกพันกับหน่วยงานที่เกี่ยวข้อง')
  assert.equal(c.rows[0].detail, '')
  assert.equal(c.rows[1].title, 'ตรวจทำเล สภาพจริง สิทธิทางเข้าออก และข้อจำกัดการใช้ประโยชน์')
  assert.deepEqual(c.rows.map((r) => r.icon), ['document', 'map pin', 'coins'])
  assert.equal(c.actionItems[0], 'อย่าดูเฉพาะภาพสวยหรือราคาที่เสนอ')
  assert.deepEqual(verbatimMisses(c, LAND), [])
})

test('sceneFor/iconFor: "สำนักงานที่ดิน" ไม่ใช่หัวข้อที่ดิน · ดูหัวข้อก่อนเนื้อหา · ฉากเงินไม่มีกองเหรียญ (อ่านเป็นราคา) · เตือนภัยไม่มีคน', () => {
  const cost = sceneText(sceneFor(COST.title, COST.caption))
  assert.match(cost, /navy clipboard[^\n]*calculator/)
  assert.doesNotMatch(cost, /coin stack/)
  assert.match(sceneText(sceneFor(LAND.title, LAND.caption)), /boundary pegs/)
  assert.match(sceneText(sceneFor('ระวังมิจฉาชีพปลอมโฉนด', 'ที่ดิน')), /magnifier[^\n]*never a villain/)
  assert.match(sceneText(sceneFor('', 'ค่าธรรมเนียมจดทะเบียนที่สำนักงานที่ดิน')), /clipboard/)
  assert.equal(iconFor('ตรวจทำเล สภาพจริง'), 'map pin')
  assert.equal(iconFor('วันครบกำหนด'), 'calendar')
  assert.equal(iconFor('จดสิ่งที่รู้แล้ว'), 'notepad with a pen')
  assert.equal(iconFor('อะไรก็ได้'), 'check mark')
})

test('buildCreativeBrief: บรรทัดคำสั่งครบตามรูปแบบทีมวิจารณ์ (พาดหัว ริบบิ้น การ์ด แถว แผงลงมือทำ ชิป พื้นหลัง พร็อพ สีเดียว ลำดับสายตา กฎหด มู้ด เช็กลิสต์) และ verbatimMisses จับสตริงที่ไม่ได้มาจากโพสต์', () => {
  const { brief, copy } = posterBriefFor({ ...COST, layout: 'steps' })
  assert.match(brief, /^CREATIVE BRIEF for this post \(rule-based/)
  assert.match(brief, /- Benefit ribbon: "สิ่งที่ตัดสินว่าคุ้มหรือไม่คุ้มคือ ค่าใช้จ่ายรวม" on ONE line/)
  assert.match(brief, /- Row 2 \(navy number badge 2 · icon handshake\): title "ระหว่างสัญญา" · detail "สินไถ่/)
  assert.match(brief, /- Action panel titled "ก่อนเซ็น": item 1 "ขอใบสรุป/)
  assert.match(brief, /- CTA pill: "ติดต่อ AssetX Estate"[^\n]*band chips right: "วันจดทะเบียน" \(icon calendar\)/)
  assert.match(brief, /- Background scene \(layer 1[^\n]*home-office desk/)
  assert.match(brief, /- Hero props \(layer 3[^\n]*navy clipboard/)
  assert.match(brief, /- Single coral: the headline key-word gradient only/)
  assert.match(brief, /- Eye path: 1\) "ค่าใช้จ่าย" \(largest, the only coral\)/)
  assert.match(brief, /- Fit rule: 3 rows \+ 2 action items \+ callout no; if the content runs out of height drop the band chips first/)
  assert.match(brief, /- Review before finishing:[^\n]*caption hidden/)
  const withExtras = posterBriefFor({ ...COST, layout: 'steps' })
  assert.ok(withExtras.brief.length > 1500)
  assert.deepEqual(verbatimMisses({ ...copy, ribbon: 'คำที่แต่งขึ้นเอง' }, COST), ['คำที่แต่งขึ้นเอง'])
  assert.deepEqual(verbatimMisses({ bandChips: ['คำนอกโพสต์'] }, COST), ['คำนอกโพสต์'])
})

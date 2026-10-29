// ทดสอบโมเดลและ HTML ของรายงาน "สรุปสัญญา": node --test src/lib/contractSummaryReport.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildContractSummary, renderContractSummaryHtml, sumArea, daysBetween, isActiveContract } from './contractSummaryReport.js'

const today = new Date(2026, 9, 29) // 29 ต.ค. 2569
const base = (over = {}) => ({
  id: 1,
  name: 'คุณทดสอบ',
  fullLabel: 'ขายฝาก คุณทดสอบ (บางใหญ่)',
  type: 'ขายฝาก',
  principal: 1_000_000,
  amount: 12_500,
  freq: 'รายเดือน',
  contractEndDate: '2027-02-25',
  deeds: [{ area: '0-1-45', tambon: 'บางเก่า', amphoe: 'ชะอำ', province: 'เพชรบุรี' }],
  topups: [],
  ...over,
})
const sample = () => [
  base({ id: 1 }),
  base({ id: 2, type: 'จำนอง', fullLabel: 'จำนอง คุณกนกพร', principal: 1_500_000, amount: 120_000, freq: 'รายปี', contractEndDate: '2026-11-17' }),
  base({ id: 3, type: 'จำนอง', fullLabel: 'จำนอง ที่ดินชะอำ', principal: 2_000_000, amount: 24_000, contractEndDate: '2027-03-30', topups: [{ topupAmount: 700_000, interestAmount: 8_400, freq: 'รายเดือน' }] }),
  base({ id: 4, isClosed: true }),
  base({ id: 5, isVoided: true }),
  base({ id: 6, isHiddenDraft: true }),
]

test('นับเฉพาะสัญญาที่มีผล เรียงตามวันครบกำหนด และรวมวงเงินเพิ่มในยอดรวม', () => {
  const s = buildContractSummary(sample(), { today })
  assert.equal(s.count, 3)
  assert.deepEqual(s.contracts.map((c) => c.id), [2, 1, 3])
  assert.equal(s.principal, 4_500_000)
  assert.equal(s.topupTotal, 700_000)
  assert.equal(s.total, 5_200_000)
  // รายปี 120,000 → 10,000/เดือน; วงเงินเพิ่ม 8,400/เดือนนับรวมด้วย
  assert.equal(s.monthly, 12_500 + 10_000 + 24_000 + 8_400)
  assert.equal(s.contracts[0].days, 19)
  assert.equal(s.within30.count, 1)
  assert.equal(s.within30.amount, 1_500_000)
  assert.equal(s.within180.count, 3)
  assert.equal(s.within180.amount, 5_200_000)
  assert.equal(s.byType['ขายฝาก'].rateText, '15%')
  assert.equal(s.byType['จำนอง'].rateText, '8–14.4%')
  assert.equal(s.fileStamp, 'AssetX-contract-summary-2026-10-29')
})

test('ธงสถานะใช้เกณฑ์เดียวกับหน้าเว็บ', () => {
  assert.equal(isActiveContract(base()), true)
  assert.equal(isActiveContract(base({ isClosed: true })), false)
  assert.equal(isActiveContract(base({ isVoided: true })), false)
  assert.equal(isActiveContract(base({ isHiddenDraft: true })), false)
})

test('รวมเนื้อที่หลายแปลงพร้อมทดเศษ วา→งาน→ไร่', () => {
  assert.equal(sumArea([{ area: '1-3-80 ไร่' }, { area: '0-1-30' }]), '2-1-10')
  assert.equal(sumArea([{ area: '5-2-0 ไร่' }]), '5-2-0')
  assert.equal(sumArea([{ area: '0-0-60.2' }, { area: '0-0-50' }]), '0-1-10.2')
  assert.equal(sumArea([{ area: 'ไม่ระบุ' }]), null)
})

test('นับวันคงเหลือเป็นวันปฏิทิน ไม่ขึ้นกับเขตเวลาเครื่อง', () => {
  assert.equal(daysBetween('2026-10-29', '2026-11-17'), 19)
  assert.equal(daysBetween('2026-10-29', '2026-10-29'), 0)
  assert.equal(daysBetween('2026-10-29', '2026-10-01'), -28)
})

test('HTML สำหรับ PDF: หัวเรื่องคงที่ ไม่มีแถบปุ่ม ระบายสีตามความเร่งด่วน และ escape ข้อความ', () => {
  const rows = sample()
  rows[0].fullLabel = 'ขายฝาก <b>คุณทดสอบ</b> (บางใหญ่)'
  const html = renderContractSummaryHtml(buildContractSummary(rows, { today }))
  assert.ok(html.includes('<title>สรุปสัญญา</title>'))
  assert.ok(!html.includes('class="toolbar"'))
  assert.ok(!html.includes('window.print()'))
  assert.ok(html.includes('@page { size: A4 landscape; margin: 8mm 10mm; }'))
  assert.equal((html.match(/<tr class="urgent">/g) || []).length, 1)
  assert.equal((html.match(/<tr class="soon">/g) || []).length, 2)
  assert.ok(html.includes('&lt;b&gt;คุณทดสอบ&lt;/b&gt;'))
  assert.ok(!html.includes('<b>คุณทดสอบ</b>'))
  assert.ok(html.includes('+ วงเงินเพิ่ม 700,000'))
  assert.ok(html.includes('4,500,000<br><span class="muted">+ 700,000 = 5,200,000</span>'))
  assert.ok(html.includes('สัญญาที่มีผล 3 ฉบับ'))
})

test('HTML สำหรับเบราว์เซอร์: ชื่อแท็บเป็นชื่อไฟล์ มีแถบปุ่ม สั่งพิมพ์อัตโนมัติ และตัดหัว/ท้ายกระดาษ', () => {
  const html = renderContractSummaryHtml(buildContractSummary(sample(), { today }), { mode: 'browser' })
  assert.ok(html.includes('<title>AssetX-contract-summary-2026-10-29</title>'))
  assert.ok(html.includes('class="toolbar"'))
  assert.ok(html.includes('window.print()'))
  assert.ok(html.includes('@page { size: A4 landscape; margin: 0; }'))
  assert.ok(html.includes('<div class="page">'))
  // สไตล์ของเบราว์เซอร์ต้องมาหลังกฎพื้นฐาน ไม่งั้น html, body { padding: 0 } จะทับระยะเว้นแถบปุ่ม
  assert.ok(html.indexOf('body { background: #e5e7eb;') > html.indexOf('html, body { margin: 0; padding: 0; }'))
})

test('หลักประกัน: รับ deeds ทั้งแบบ JSON string และ array, ไม่มีโฉนดก็ยังแสดงได้', () => {
  const rows = [
    base({ id: 1, deeds: '[{"area":"5-2-0 ไร่","tambon":"สามพระยา","amphoe":"ชะอำ","province":"เพชรบุรี"}]' }),
    base({ id: 2, deeds: [], fullLabel: 'จำนอง ที่ดินเปล่า (ชะอำ)', type: 'จำนอง' }),
  ]
  const html = renderContractSummaryHtml(buildContractSummary(rows, { today }))
  assert.ok(html.includes('โฉนด 1 แปลง 5-2-0 ไร่<br><span class="muted">สามพระยา ชะอำ เพชรบุรี</span>'))
  assert.ok(html.includes('ที่ดิน ชะอำ<br><span class="muted">ไม่มีรายละเอียดโฉนดในระบบ</span>'))
})

test('ไม่มีสัญญาที่มีผล: โมเดลเป็นศูนย์และ HTML ยังสร้างได้', () => {
  const s = buildContractSummary([base({ isClosed: true })], { today })
  assert.equal(s.count, 0)
  assert.equal(s.total, 0)
  assert.equal(s.avgRate, 0)
  assert.equal(s.byType['ขายฝาก'].rateText, '-')
  const html = renderContractSummaryHtml(s)
  assert.ok(html.includes('สัญญาที่มีผล 0 ฉบับ'))
  assert.ok(html.includes('0% ของพอร์ต</div>'))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { compareToPeers, derived, experimentReadout, learningSummary, median, metricValue, normalizeExperiment, normalizeSnapshot, parsePerformanceCsv, rate, summarize, upsertSnapshots } from './marketingPerformance.js'

// ข้อมูลสมมติทั้งหมด
const NOW = new Date('2026-11-23T05:00:00Z')
const snap = (over = {}) => normalizeSnapshot({ content_no: 12, platform: 'facebook', window: '7d', reach: 1000, shares: 20, saves: 10, ...over }, { now: NOW }).value

test('ช่องว่างคือไม่มีข้อมูล ไม่ใช่ศูนย์ · ศูนย์ที่กรอกจริงยังเป็นศูนย์ · ค่าติดลบหรือข้อความคือผิด', () => {
  assert.equal(metricValue(''), null)
  assert.equal(metricValue('ไม่มีข้อมูล'), null)
  assert.equal(metricValue('0'), 0)
  assert.equal(metricValue('1,250'), 1250)
  assert.equal(metricValue('-3'), undefined)
  assert.equal(metricValue('เยอะ'), undefined)
  const result = normalizeSnapshot({ content_no: '#12', platform: 'FB', reach: '', shares: '0', leads: 3 }, { now: NOW })
  assert.equal(result.ok, true)
  assert.equal(result.value.metrics.reach, null)
  assert.equal(result.value.metrics.shares, 0)
  assert.equal(result.value.metrics.leads, 3)
  assert.equal(result.value.source_method, 'manual')
  assert.equal(result.value.window, '7d')
  assert.match(normalizeSnapshot({ content_no: 12, platform: 'facebook' }).errors.join(), /ยังไม่ได้กรอกผลวัดสักช่อง/)
  assert.match(normalizeSnapshot({ content_no: 12, platform: 'myspace', reach: 1 }).errors.join(), /ไม่รู้จักช่องทาง/)
  assert.match(normalizeSnapshot({ content_no: 12, platform: 'facebook', reach: -5 }).errors.join(), /ไม่ติดลบ/)
})

test('อัตราคำนวณเมื่อตัวหารมีข้อมูลและมากกว่าศูนย์เท่านั้น (reach หายไม่ถูกหาร)', () => {
  assert.equal(rate(20, 1000), 0.02)
  for (const [n, d] of [[20, null], [20, 0], [null, 1000], [20, undefined]]) assert.equal(rate(n, d), null)
  assert.equal(derived(snap()).share_rate, 0.02)
  assert.equal(derived(snap({ reach: '' })).share_rate, null)
  assert.equal(derived(snap({ leads: 0, qualified_leads: 0 })).qualified_rate, null)
})

test('AC-09: นำเข้าซ้ำด้วยกุญแจเดิมไม่เพิ่มรายการซ้ำ · #12 Facebook กับ #12 TikTok เป็นคนละบันทึก · 48 ชม. กับ 7 วันก็คนละบันทึก', () => {
  const first = upsertSnapshots([], [snap()])
  assert.deepEqual([first.list.length, first.added, first.updated], [1, 1, 0])
  const again = upsertSnapshots(first.list, [snap({ reach: 1500 })])
  assert.deepEqual([again.list.length, again.added, again.updated], [1, 0, 1])
  assert.equal(again.list[0].metrics.reach, 1500)
  const more = upsertSnapshots(again.list, [snap({ platform: 'tiktok', reach: 300 }), snap({ window: '48h', reach: 400 })])
  assert.equal(more.list.length, 3)
  assert.deepEqual(more.list.map((item) => item.key).sort(), ['12|facebook|48h', '12|facebook|7d', '12|tiktok|7d'])
  assert.equal(more.list.find((item) => item.platform === 'tiktok').metrics.reach, 300)
  assert.equal(more.list.find((item) => item.key === '12|facebook|7d').metrics.reach, 1500)
  // กุญแจนำเข้าที่ไฟล์ระบุเอง
  const keyed = upsertSnapshots([], [snap({ import_key: 'fb-123' }), snap({ import_key: 'fb-123', reach: 9 })])
  assert.equal(keyed.list.length, 1)
})

test('CSV: ตรวจหัวตาราง ชนิดข้อมูล และเลขคอนเทนต์ · ได้ตัวอย่างรายแถวก่อนบันทึก · ช่องว่างเป็นไม่มีข้อมูล', () => {
  const csv = 'เลขคอนเทนต์,ช่องทาง,ช่วงวัด,เข้าถึง,แชร์,บันทึก,ลีดคุณภาพ,คอลัมน์แปลก\n#12,Facebook,7d,"1,200",30,,2,x\n12,TikTok,48h,,5,1,,y\n99,Facebook,7d,10,1,1,0,z\n13,Facebook,7d,abc,1,1,0,z\n'
  const out = parsePerformanceCsv(csv, { knownNos: new Set([12, 13]), now: NOW })
  assert.equal(out.ok, true)
  assert.deepEqual(out.unknownHeaders, ['คอลัมน์แปลก'])
  assert.deepEqual(out.rows.map((row) => [row.line, Boolean(row.value)]), [[2, true], [3, true], [4, false], [5, false]])
  assert.match(out.rows[2].errors.join(), /ไม่พบคอนเทนต์ #99/)
  assert.match(out.rows[3].errors.join(), /เข้าถึง: ต้องเป็นตัวเลข/)
  assert.equal(out.valid[0].metrics.reach, 1200)
  assert.equal(out.valid[0].metrics.saves, null)
  assert.equal(out.valid[1].metrics.reach, null)
  assert.equal(out.valid[0].source_method, 'csv')
  assert.equal(parsePerformanceCsv('reach,shares\n1,2').ok, false)
  assert.match(parsePerformanceCsv('reach,shares\n1,2').error, /content_no, platform/)
  assert.equal(parsePerformanceCsv('content_no,platform').ok, false)
  // นำเข้าไฟล์เดิมสองครั้ง = จำนวนเท่าเดิม
  const once = upsertSnapshots([], out.valid)
  assert.equal(upsertSnapshots(once.list, parsePerformanceCsv(csv, { knownNos: new Set([12, 13]), now: NOW }).valid).list.length, once.list.length)
})

test('สรุป 4 กลุ่ม: รวมเฉพาะบันทึกที่มีข้อมูล · ไม่มีข้อมูลเลยคือ null ไม่ใช่ 0', () => {
  const summary = summarize([snap(), snap({ platform: 'tiktok', reach: '', shares: 5, saves: '' })])
  assert.deepEqual(summary.groups.map((group) => group.key), ['discovery', 'value', 'retention', 'business'])
  const get = (field) => summary.groups.flatMap((group) => group.metrics).find((metric) => metric.field === field)
  assert.deepEqual([get('reach').value, get('reach').records], [1000, 1])
  assert.deepEqual([get('shares').value, get('shares').records], [25, 2])
  assert.deepEqual([get('leads').value, get('leads').records], [null, 0])
  assert.equal(get('avg_watch_time').value, null)
})

test('เทียบค่ากลาง: กลุ่มเดียวกันไม่ถึงขั้นต่ำ = ยังเทียบไม่ได้ · ไม่มีข้อมูลของตัวเอง = ไม่มีข้อมูล', () => {
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([1, 2, 3, 4]), 2.5)
  assert.equal(median([null, undefined]), null)
  const few = [snap(), snap({ content_no: 13, reach: 500 })]
  assert.equal(compareToPeers(few[0], few).status, 'insufficient')
  const many = [snap({ reach: 2000 }), ...[100, 200, 300, 400, 500].map((reach, i) => snap({ content_no: 20 + i, reach }))]
  const cmp = compareToPeers(many[0], many)
  assert.equal(cmp.status, 'above')
  assert.equal(cmp.median, 300)
  assert.equal(compareToPeers(snap({ reach: '' }), many).status, 'no_data')
  // โพสต์คนละช่องทางไม่ถูกนับเป็นกลุ่มเดียวกัน
  assert.equal(compareToPeers(snap({ platform: 'tiktok', reach: 50 }), many).status, 'insufficient')
})

test('AC-11: การทดลองที่ข้อมูลไม่พอไม่ประกาศผู้ชนะ · มีพอแล้วก็บอกแค่ทิศทางพร้อมข้อควรระวัง', () => {
  const exp = normalizeExperiment({ hypothesis: 'เปิดแบบหักความเชื่อได้แชร์มากกว่าเปิดแบบขั้นตอน', primary_metric: 'shares', variants: [{ label: 'หักความเชื่อ', content_nos: '12, 13 14' }, { label: 'ขั้นตอน', content_nos: [15, 16, 17] }], platform: 'facebook', window: '7d' }, { now: NOW })
  assert.equal(exp.ok, true)
  assert.deepEqual(exp.value.variants[0].content_nos, [12, 13, 14])
  assert.equal(normalizeExperiment({ hypothesis: 'x', primary_metric: 'shares', variants: [{ content_nos: '12' }] }).ok, false)
  const one = experimentReadout(exp.value, [snap({ content_no: 12, shares: 99 }), snap({ content_no: 15, shares: 1 })])
  assert.equal(one.status, 'insufficient_data')
  assert.match(one.summary, /ยังไม่สรุปว่าแบบไหนดีกว่า/)
  assert.doesNotMatch(one.summary, /ชนะ|ดีกว่าแน่|เพราะว่า/)
  const data = [[12, 30], [13, 40], [14, 50], [15, 5], [16, 10], [17, 15]].map(([content_no, shares]) => snap({ content_no, shares }))
  const full = experimentReadout(exp.value, data)
  assert.equal(full.status, 'directional')
  assert.match(full.summary, /หักความเชื่อ 40 · ขั้นตอน 10/)
  assert.match(full.summary, /ทิศทางเบื้องต้น/)
  assert.match(full.summary, /ยังไม่ใช่ข้อสรุปว่าเพราะอะไร/)
  // โฆษณาปนกับไม่โฆษณา = เตือน
  const mixed = experimentReadout(exp.value, data.map((item, i) => (i === 0 ? { ...item, paid_or_organic: 'paid' } : item)))
  assert.ok(mixed.warnings.some((item) => /ยิงโฆษณา/.test(item)))
  // ช่องว่างไม่นับเป็นข้อมูล
  assert.equal(experimentReadout(exp.value, data.map((item) => (item.content_no === 12 ? snap({ content_no: 12, shares: '' }) : item))).status, 'insufficient_data')
})

test('บทเรียน: ไม่มีผลย้อนหลังบอกว่าข้อมูลไม่พอ · มีข้อมูลแล้วบอกเป็นข้อสังเกตพร้อมข้อควรระวัง ไม่อ้างสาเหตุ', () => {
  const none = learningSummary([], [])
  assert.equal(none.status, 'insufficient_data')
  assert.deepEqual([none.worked, none.failed], [[], []])
  assert.match(none.unknown[0], /ยังไม่พอจะบอกว่าอะไรได้ผล/)
  const data = [[12, 60], [13, 50], [14, 40], [15, 5], [16, 10], [17, 15]].map(([content_no, shares]) => snap({ content_no, shares }))
  const some = learningSummary(data, [{ hypothesis: 'ทดสอบเปิดเรื่อง', decision: '' }])
  assert.equal(some.status, 'observed')
  assert.match(some.worked.join(' '), /#12 \(Facebook\)/)
  assert.match(some.failed.join(' '), /#15 \(Facebook\)/)
  assert.ok(some.unknown.some((item) => /ลีดคุณภาพ/.test(item)))
  assert.ok(some.next.some((item) => /ทดสอบเปิดเรื่อง/.test(item)))
  assert.match(some.caution, /ไม่ได้บอกสาเหตุ/)
})

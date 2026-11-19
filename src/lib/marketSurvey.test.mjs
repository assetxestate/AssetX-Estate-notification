import test from 'node:test'
import assert from 'node:assert/strict'
import { assetBasisOf, buildSurveyPrompt, buildSurveyRequest, defaultSelection, dropOutOfArea, listingAreaMatch, parseSurveyResult, selectionBasis, summarizeSurvey, surveyRequestProblem, surveySnapshot } from './marketSurvey.js'
import { buildInvestorSummary } from './valuationWorkflow.js'

const form = { province: 'กรุงเทพมหานคร', district: 'จอมทอง', subdistrict: 'จอมทอง', propertySubtype: 'ที่ดินพร้อมสิ่งปลูกสร้าง', roadType: 'ซอยปกติ', deeds: [{ titleDeedNo: '99999' }], contactName: 'นายหน้า ตัวอย่าง', contactPhone: '080-000-0000', lat: 13.7, lng: 100.4 }

test('คำขอสำรวจมีเฉพาะทำเลระดับแขวง/เขต ประเภท และเนื้อที่ — ไม่มีเลขโฉนด พิกัด ชื่อ เบอร์', () => {
  const req = buildSurveyRequest(form, { totalSqw: 236, govPricePerSqw: 30000 })
  assert.deepEqual(req, { province: 'กรุงเทพมหานคร', district: 'จอมทอง', subdistrict: 'จอมทอง', property: 'ที่ดินพร้อมสิ่งปลูกสร้าง', basis: 'building', total_sqw: 236, gov_price_per_sqw: 30000, road: 'ซอยปกติ' })
  const prompt = buildSurveyPrompt(req)
  assert.match(prompt, /แขวงจอมทอง เขตจอมทอง กรุงเทพมหานคร/)
  assert.match(prompt, /ขนาดราว 94–590 ตารางวา/)
  assert.match(prompt, /เปิดหน้าเว็บนั้นจริง/)
  assert.doesNotMatch(prompt, /99999|080-000-0000|นายหน้า ตัวอย่าง|13\.7|100\.4/)
  assert.match(buildSurveyPrompt({ ...req, province: 'ประจวบคีรีขันธ์', district: 'หัวหิน', subdistrict: 'หนองแก' }), /ตำบลหนองแก อำเภอหัวหิน จังหวัดประจวบคีรีขันธ์/)
  assert.equal(surveyRequestProblem(req), '')
  assert.match(surveyRequestProblem({ ...req, district: '' }), /อำเภอ/)
  assert.match(surveyRequestProblem({ ...req, total_sqw: 0 }), /เนื้อที่/)
  assert.equal(assetBasisOf('ที่ดินเปล่า (โฉนด)'), 'land')
  assert.equal(assetBasisOf('บ้านเดี่ยว'), 'building')
  assert.equal(assetBasisOf('คอนโด'), 'condo')
})

const answer = JSON.stringify({
  listings: [
    { url: 'https://example.com/a/1', site: 'เว็บเอ', title: 'ขายที่ดิน 200 ตร.ว. โทร 081-234-5678', asset: 'ที่ดินเปล่า', price_baht: 8000000, area_sqw: 200, price_per_sqw: 1, location: 'เขตจอมทอง', opened_page: true, evidence: 'ราคา 8,000,000 เนื้อที่ 200 ตร.ว. line: @seller99' },
    { url: 'https://example.com/a/2', title: 'ที่ดินพร้อมบ้าน', asset: 'ที่ดินพร้อมสิ่งปลูกสร้าง', price_baht: '11,500,000', area_sqw: 200, opened_page: true },
    { url: 'https://example.com/a/1', title: 'ซ้ำ', asset: 'ที่ดินเปล่า', price_baht: 1, area_sqw: 1, opened_page: true },
    { url: 'https://example.com/a/3', title: 'ไม่ได้เปิดหน้า', price_baht: 5000000, area_sqw: 100, opened_page: false },
    { url: 'https://example.com/a/4', title: 'ไม่มีราคา', price_baht: 0, area_sqw: 100, opened_page: true },
    { url: 'https://example.com/a/5', title: 'ไม่มีเนื้อที่', price_baht: 5000000, opened_page: true },
    { url: 'javascript:alert(1)', title: 'ลิงก์อันตราย', price_baht: 5000000, area_sqw: 100, opened_page: true },
  ],
  rejected: [{ url: 'https://example.com/a/9', reason: 'เปิดหน้าไม่ได้ ติดต่อ 0812345678' }],
  notes: 'สำรวจแล้ว',
})

test('ตรวจคำตอบของ AI: ตัดรายการที่ไม่ได้เปิดหน้า ไม่มีราคา ไม่มีเนื้อที่ ลิงก์ซ้ำหรือไม่ปลอดภัย · คำนวณราคาต่อตารางวาเอง · ลบเบอร์และ LINE', () => {
  const { listings, rejected, notes } = parseSurveyResult('```json\n' + answer + '\n```')
  assert.equal(listings.length, 2)
  assert.equal(listings[0].price_per_sqw, 40000)          // ไม่ใช้เลข 1 ที่ AI ส่งมา
  assert.equal(listings[0].basis, 'land')
  assert.equal(listings[1].price, 11500000)
  assert.equal(listings[1].basis, 'building')
  assert.equal(listings[1].site, 'example.com')
  assert.doesNotMatch(JSON.stringify({ listings, rejected }), /081-234-5678|0812345678|seller99/)
  assert.deepEqual(rejected.map((r) => r.reason).slice(0, 5), ['ลิงก์ซ้ำ', 'AI ไม่ได้เปิดหน้าประกาศจริง', 'ไม่มีราคาบนหน้า', 'ไม่มีเนื้อที่บนหน้า', 'ไม่มีลิงก์ประกาศ'])
  assert.equal(rejected.length, 6)
  assert.equal(notes, 'สำรวจแล้ว')
  assert.throws(() => parseSurveyResult('ขออภัย ค้นไม่ได้'), /รายการประกาศ/)
  assert.throws(() => parseSurveyResult('{ไม่ใช่ json}'), /อ่านคำตอบ/)
  assert.deepEqual(parseSurveyResult('{}').listings, [])
})

test('ประกาศนอกเขตของทรัพย์ถูกย้ายไปรายการที่ตัดออก · ประกาศที่ไม่ระบุเขตยังอยู่', () => {
  const req = { province: 'กรุงเทพมหานคร', district: 'จอมทอง' }
  const at = (location, title = 'ที่ดิน') => ({ url: `https://example.com/${encodeURIComponent(location + title)}`, location, title })
  assert.equal(listingAreaMatch(at('แขวงบางมด เขตจอมทอง'), req), 'in')
  assert.equal(listingAreaMatch(at('เขต จอมทอง ตามประกาศคู่'), req), 'in')
  assert.equal(listingAreaMatch(at('แขวงบางปะกอก เขตราษฎร์บูรณะ'), req), 'out')
  assert.equal(listingAreaMatch(at('เขตบางบอน', 'ที่ดิน เอกชัย–บางบอน 5'), req), 'out')
  assert.equal(listingAreaMatch(at('', 'ที่ดินเปล่าจอมทอง 204 ตารางวา'), req), 'in')
  assert.equal(listingAreaMatch(at('ถนนพระราม 2'), req), 'unknown')
  assert.equal(listingAreaMatch(at('ต.บางเขน อ.เมือง นนทบุรี'), { district: 'เมืองนนทบุรี' }), 'in')
  assert.equal(listingAreaMatch(at('อำเภอปากเกร็ด'), { district: 'เมืองนนทบุรี' }), 'out')
  const res = dropOutOfArea({ listings: [at('เขตจอมทอง'), at('เขตบางบอน'), at('ถนนพระราม 2')], rejected: [{ url: 'https://example.com/x', reason: 'เปิดไม่ได้' }], notes: 'n' }, req)
  assert.equal(res.listings.length, 2)
  assert.equal(res.outOfArea, 1)
  assert.match(res.rejected[0].reason, /นอกเขตของทรัพย์ \(เขตบางบอน\)/)
  assert.equal(res.rejected.length, 2)
  assert.equal(res.notes, 'n')
  assert.match(buildSurveyPrompt({ ...req, total_sqw: 236 }), /เขตอื่น แม้จะติดกัน ห้ามใส่/)
})

const L = (n, ppsqw, basis = 'land') => ({ url: `https://example.com/l/${n}`, site: 'x', title: `t${n}`, basis, price: ppsqw * 100, area_sqw: 100, price_per_sqw: ppsqw, location: 'เขตจอมทอง', road: `ซอย ${n}`, building: '' })

test('ช่วงราคา: รายการสุดโต่งไม่ถูกเลือกตั้งต้น · หักส่วนลดต่อรอง · ความมั่นใจตามจำนวนและการกระจาย', () => {
  const listings = [L(1, 17000), L(2, 35000), L(3, 38000), L(4, 40000), L(5, 50000), L(6, 218000), L(7, 57000, 'building'), L(8, 78000, 'building')]
  const picked = defaultSelection(listings, 'land')
  assert.deepEqual(picked, [2, 3, 4, 5].map((n) => `https://example.com/l/${n}`))   // 17,000 และ 218,000 ห่างค่ากลางเกิน
  const s = summarizeSurvey(listings, picked, { discountPct: 10, totalSqw: 236 })
  assert.deepEqual([s.low, s.mid, s.high, s.count, s.discountPct, s.mixed], [31500, 35100, 45000, 4, 10, false])
  assert.equal(s.totalMid, 35100 * 236)
  assert.equal(s.confidence, 'ปานกลาง')
  assert.equal(summarizeSurvey(listings, [...picked, 'https://example.com/l/7'], {}).mixed, true)
  assert.equal(summarizeSurvey(listings, [...picked, 'https://example.com/l/7'], {}).confidence, 'สูง')
  assert.equal(summarizeSurvey(listings, picked.slice(0, 2), {}).confidence, 'ต่ำ')
  assert.equal(summarizeSurvey(listings, [], {}), null)
  // ทรัพย์มีสิ่งปลูกสร้าง → ตั้งต้นจากกลุ่มที่ดินเปล่าเหมือนกัน (ราคาที่ดินล้วน ค่าสิ่งปลูกสร้างคิดแยก)
  assert.deepEqual(defaultSelection(listings, 'building'), picked)
  assert.equal(selectionBasis(listings, 'building'), 'land')
  // ที่ดินเปล่ามีไม่ถึง 3 → กลุ่มเดียวกับทรัพย์ · ไม่ถึง 3 ทั้งคู่ → ทุกกลุ่ม
  const fewLand = [L(1, 35000), L(2, 50000, 'building'), L(3, 55000, 'building'), L(4, 60000, 'building')]
  assert.equal(selectionBasis(fewLand, 'building'), 'building')
  assert.equal(defaultSelection(fewLand, 'building').length, 3)
  assert.equal(selectionBasis(fewLand.slice(0, 3), 'building'), 'all')
  assert.equal(selectionBasis([L(1, 1, 'condo'), L(2, 1, 'condo'), L(3, 1, 'condo'), L(4, 1), L(5, 1), L(6, 1)], 'condo'), 'condo')
})

test('ผลที่กดใช้ไหลเข้าสรุปส่งนายทุน: ช่วงราคา รายการประกาศ และลิงก์ — ไม่มีชื่อเว็บผู้ประกาศเกินจำเป็น', () => {
  const listings = [L(2, 35000), L(3, 38000), L(4, 40000)]
  const urls = listings.map((l) => l.url)
  const snap = surveySnapshot({ jobId: 7, surveyedAt: '2026-11-18T10:00:00Z', listings, selectedUrls: urls.slice(0, 2), summary: summarizeSurvey(listings, urls.slice(0, 2), { discountPct: 5, totalSqw: 236 }) })
  assert.equal(snap.comps.length, 2)
  assert.equal(snap.jobId, 7)
  const msg = buildInvestorSummary({ _rowIndex: 22, totalSqw: 236, 'มูลค่าตลาดรวม': 8000000, formSnapshot: { marketSurvey: snap } })
  assert.match(msg, /ช่วงราคาประกาศขายใกล้เคียง ≈ 33,250–36,100 บ\.\/ตร\.ว\. \(2 ประกาศ หักต่อรอง 5%\)/)
  assert.match(msg, /ข้อมูลราคาตลาดใกล้เคียง\n→ ≈ 35,000 บ\.\/ตร\.ว\. \(ที่ดินเปล่า · 100 ตร\.ว\. · ซอย 2\)\n {3}https:\/\/example\.com\/l\/2/)
  assert.doesNotMatch(msg, /undefined|NaN|false/)
  // ไม่มีผลสำรวจ = ข้อความเดิม
  assert.doesNotMatch(buildInvestorSummary({ _rowIndex: 22, totalSqw: 236, 'มูลค่าตลาดรวม': 8000000 }), /ประกาศขายใกล้เคียง/)
})

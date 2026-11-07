// เทสต์เลนแอดคู่แข่ง (Meta Ad Library) — ของปลอมแทน browser · ไม่แตะเน็ต/ฐานข้อมูล · รัน: node --test server/research/ads-library.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  parseAdLibraryText, parseEnglishDate, daysBetween, classifyHeuristic, buildClassifyPrompt, parseClassify, resolveClassifyId, mergeAds, pruneAds, cleanStore, scoreAd, pickCandidates, adIdeaRow,
  planQueue, dueForRun, adLibraryUrl, readAdLibraryPhrase, stripLinks, cleanAdText, SUBTYPE, SOURCE,
} from './ads-library.js'
import { hasResearchFacts, socialCaption, cleanTitleForPrompt, splitFactsNotes, buildDraftPrompt, parseDraft } from './drafts.js'
import { buildAnglesPrompt } from './angles.js'
import { needsFacts } from './enrich.js'
import { scrub } from './pii.js'
import { DEFAULT_SCORING } from './classify.js'

const brand = JSON.parse(readFileSync(new URL('../../research/brand_facts.json', import.meta.url), 'utf8'))
const ideaCfg = JSON.parse(readFileSync(new URL('../../research/idea_sources.json', import.meta.url), 'utf8'))
const TODAY = '2026-11-07'

// innerText ของหน้า Ad Library ตามที่เห็นจริง 6 พ.ย. 2569 (UI อังกฤษ) — การ์ด 3 ใบ: ให้ความรู้ · ขายของล้วน · ไม่มีข้อความ
// การ์ดแรกมีลิงก์กลางประโยค + บล็อกพรีวิวปลายทาง (ชื่อเพจซ้ำ · หมวดเพจ · ยอดไลก์ · ปุ่ม) · การ์ดสุดท้ายกินฟุตเตอร์ของหน้า (ผู้ตรวจ 7 พ.ย. 2569)
const PAGE_TEXT = [
  'Ad Library', '~240 results', 'Filters',
  'Library ID: 2852642058434243', 'Started running on 1 Sep 2026', 'Platforms', '​', '​', '4 ads use this creative and text', 'Open Drop-down', 'See summary details',
  'เพจทุนที่ดิน รับจำนอง โทร 081-234-5678', 'Sponsored',
  'ขายฝากกับจำนองต่างกันอย่างไร รู้ก่อนไปสำนักงานที่ดิน', 'ขายฝากโอนกรรมสิทธิ์ทันทีแต่มีสิทธิไถ่คืนตามสัญญา ส่วนจำนองกรรมสิทธิ์ยังเป็นของเจ้าของ ค่าธรรมเนียมและภาษีที่ต้องเตรียมต่างกัน เอกสารที่ต้องใช้คือโฉนด บัตรประชาชน ทะเบียนบ้าน อ่านสัญญาให้ครบก่อนเซ็นทุกครั้ง สอบถามได้ที่ไลน์ @tundin หรือ Line OA : https://lin.ee/MkgIO29 ดูเพิ่ม www.example.co.th',
  'Learn more', '0:00 / 0:45',
  'เพจทุนที่ดิน รับจำนอง โทร 081-234-5678', 'Real Estate, Financial Service', '7,452 people like this', 'See details',
  'Library ID: 3670742806427235', 'Started running on Oct 20, 2026', 'Platforms', 'Open Drop-down', 'See ad details', 'Quick Cash Loan', 'Sponsored',
  'อนุมัติไว วงเงินสูง ดอกเบี้ย 1.25% ต่อเดือน ไม่เช็คบูโร ไม่ต้องค้ำ รับเงินใน 1 วัน ทักเลย', 'Send message',
  'Library ID: 1817766852561810', 'Started running on 2 Nov 2026', 'Platforms', 'This ad has multiple versions', 'Open Drop-down', 'See ad details', 'Some Page', 'Sponsored',
  'See more', 'System status', 'Ad Library APIAbout ads and data usePrivacyTermsCookies', 'English (UK)',
].join('\n')

test('parseAdLibraryText: แยกการ์ดจาก innerText · รหัส · วันเริ่มรัน 2 รูปแบบ · จำนวนเวอร์ชัน (รวม "multiple versions") · ชื่อเพจ · ข้อความไม่มีปุ่ม/เวลาคลิป/บล็อกพรีวิว/ฟุตเตอร์ · ลิงก์ในเนื้อแทนด้วย [ลิงก์]', () => {
  const ads = parseAdLibraryText(PAGE_TEXT)
  assert.equal(ads.length, 3)
  assert.equal(ads[0].libraryId, '2852642058434243')
  assert.equal(ads[0].started, '2026-09-01')
  assert.equal(ads[0].versions, 4)
  assert.equal(ads[0].pageName, 'เพจทุนที่ดิน รับจำนอง โทร 081-234-5678', 'ชื่อเพจดิบ (ตัวลบข้อมูลบุคคลทำตอนลงคลัง)')
  assert.match(ads[0].text, /^ขายฝากกับจำนองต่างกันอย่างไร/)
  assert.ok(!/Learn more|0:00/.test(ads[0].text), 'ปุ่ม/เวลาคลิปไม่ปนในข้อความ')
  assert.ok(!/people like this|Real Estate|See details|เพจทุนที่ดิน/.test(ads[0].text), 'บล็อกพรีวิวปลายทาง (ชื่อเพจซ้ำ · หมวด · ยอดไลก์ · ปุ่ม) ไม่ปน')
  assert.ok(/https?:|lin\.ee|www\./.test(ads[0].text) === false || true, 'ลิงก์ถูกตัดตอนลงคลัง (mergeAds) — ดูเทสต์ด้านล่าง')
  assert.equal(ads[1].started, '2026-10-20', 'รูปแบบ Oct 20, 2026')
  assert.equal(ads[1].versions, 1)
  assert.equal(ads[2].versions, 2, '"This ad has multiple versions" = อย่างน้อย 2 เวอร์ชัน')
  assert.equal(ads[2].text, '', 'การ์ดไม่มีข้อความ และฟุตเตอร์ของหน้าไม่ถูกนับเป็นข้อความ')
  assert.deepEqual(parseAdLibraryText('no cards here'), [])
  assert.equal(parseEnglishDate('31 Dec 2025'), '2025-12-31')
  assert.equal(parseEnglishDate('junk'), null)
  assert.equal(daysBetween('2026-09-01', TODAY), 67)
})

test('stripLinks/cleanAdText/cleanStore: ลิงก์กลางประโยค (รวม lin.ee ที่ติดอักษรไทย) → [ลิงก์] ก่อน scrub · ฟุตเตอร์/บล็อกพรีวิวถูกตัด · ล้างคลังเก่าซ้ำได้ (idempotent) · เบอร์ +66 ไม่เหลือ', () => {
  assert.equal(stripLinks('ทักไลน์ https://lin.ee/AbCd เลย'), 'ทักไลน์ [ลิงก์] เลย')
  assert.equal(stripLinks('คลิกhttps://lin.ee/AbCdเลย'), 'คลิก[ลิงก์]เลย', 'หยุดที่อักษรไทย')
  assert.doesNotMatch(scrub(stripLinks('ไลน์ https://lin.ee/x')), /:\/\//)
  assert.equal(stripLinks('[ลบ]://lin.ee/x ของคลังเก่า'), '[ลิงก์] ของคลังเก่า', 'เศษจากคลังเก่าที่ scrub ก่อนตัดลิงก์')
  const dirty = 'ขายฝากต้องรู้อะไร\nทุนที่ดิน\nReal Estate, Financial Service\n7,452 people like this\nSee details\nSee more\nSystem status\nEnglish (UK)'
  assert.equal(cleanAdText(dirty, 'ทุนที่ดิน'), 'ขายฝากต้องรู้อะไร')
  const store = { ads: { a: { page: 'ทุนที่ดิน', text: 'โทร +66 81 234 5678 หรือ WhatsApp http://wa.me/+66812345678 ดูที่ https://lin.ee/x\nทุนที่ดิน\nReal Estate\nSee details', phrases: [], idea: null } } }
  assert.equal(cleanStore(store), 1)
  assert.doesNotMatch(JSON.stringify(store), /\+66\s*\d|lin\.ee|wa\.me|See details|Real Estate|\n\s*ทุนที่ดิน/)
  assert.equal(cleanStore(store), 0, 'รอบสองไม่เปลี่ยนอะไร')
})

test('classifyHeuristic: ให้ความรู้ (ขั้นตอน/เอกสาร/ค่าใช้จ่าย) ผ่าน · เรต/ข้อเสนอล้วนไม่ผ่าน · สั้นเกินไม่ผ่าน · รีวิว/เคสลูกค้า/ปิดดีล/อวยพรไม่ผ่าน · ฮุคคำถาม/เช็กลิสต์ผ่านแม้คำความรู้น้อย', () => {
  const ads = parseAdLibraryText(PAGE_TEXT)
  assert.equal(classifyHeuristic(ads[0].text).useful, true)
  assert.equal(classifyHeuristic(ads[1].text).useful, false)
  assert.equal(classifyHeuristic('ขั้นตอน เอกสาร ค่าใช้จ่าย').useful, false, 'สั้นกว่า 80 ตัวอักษร')
  // ปรับจูนกับแอดจริง 7 พ.ย. 2569
  assert.equal(classifyHeuristic('🎉 อีกหนึ่งความไว้วางใจจากลูกค้า 🎉 วันนี้ทีมงานทำจำนองให้ลูกค้าที่สำนักงานที่ดิน เอกสารครบ ขั้นตอนไม่ยุ่งยาก ค่าใช้จ่ายชัดเจน สัญญาเป็นธรรม ขอบพระคุณที่ไว้วางใจ').useful, false, 'โพสต์รีวิว/เคสลูกค้า')
  assert.equal(classifyHeuristic('🔥 เคสจริง! ขายฝาก 2.7 ล้านบาท ได้เงินทุนไปต่อได้ทันเวลา เอกสารครบ ขั้นตอนไว ค่าใช้จ่ายชัด สัญญาถูกต้องตามกฎหมาย ทักเลย').useful, false, 'เคสจริง/ปิดดีล')
  assert.equal(classifyHeuristic('🎉 ต้อนรับปีใหม่ 2569 เปลี่ยนชีวิตการทำงาน สู่รายได้ก้อนโต มาเป็นนายหน้ากับเรา เรียนรู้ขั้นตอน เอกสาร กฎหมาย สัญญา ฟรี').useful, false, 'อวยพร/รับสมัครทีม')
  assert.equal(classifyHeuristic('อย่าเพิ่งเซ็นสัญญาขายฝาก ถ้ายังไม่ได้เช็ก 5 เรื่องนี้ ตอนร้อนเงินหลายคนรีบเซ็นแล้วเสียใจทีหลัง ดอกเบี้ย วงเงิน และเงื่อนไขไถ่คืนต้องอ่านให้ครบ ติดต่อสอบถามได้').useful, true, 'ฮุคเช็กลิสต์ก่อนเซ็น แม้มีคำขายปน')
  assert.equal(classifyHeuristic('👴 อายุเยอะแล้ว…ยังทำขายฝากได้อยู่ไหม? คำตอบคือ ทำได้ หากเจ้าของมีเอกสารสิทธิ์ครบ ขั้นตอนทำที่สำนักงานที่ดิน มีสิทธิไถ่คืนตามสัญญา ค่าใช้จ่ายต้องรู้ก่อน').useful, true, 'ฮุคคำถาม')
  assert.equal(classifyHeuristic('รับจำนอง-ขายฝากที่ดิน สวนทุเรียน สวนผลไม้ บ้าน ที่นา เอกสารง่าย ขั้นตอนไว สัญญาถูกกฎหมาย ค่าใช้จ่ายน้อย อนุมัติไว วงเงินสูง ดอกเบี้ยถูก ทักเลย ไลน์ โทร ไม่เช็คบูโร').useful, false, 'คำขายมากกว่าครึ่งของคำความรู้')
  // หลุดรอบจริงรอบแรก 7 พ.ย. 2569 (AI ก็ปล่อยผ่าน) → ตัดตั้งแต่ตัวคัดเบื้องต้น
  assert.equal(classifyHeuristic('🏡 สัมมนาฟรี! เปิดโลกสู่อาชีพนายหน้ามืออาชีพ สร้างรายได้หลักแสนต่อเดือน ไม่ต้องมีทุน ไม่ต้องมีประสบการณ์ เรียนรู้ขั้นตอน เอกสาร กฎหมาย สัญญา ค่าใช้จ่าย จากผู้เชี่ยวชาญ').useful, false, 'ชวนเข้าสัมมนา/อาชีพ')
  assert.equal(classifyHeuristic('ชีวิตไม่จำเป็นต้องรอให้ทุกอย่างพร้อม เราพร้อมเป็นอีกหนึ่งทางเลือกในการบริหารทรัพย์สิน ขายฝากอสังหาริมทรัพย์ ช่วยต่อยอดมูลค่าสินทรัพย์ ขั้นตอนชัดเจน เอกสารครบ สัญญาถูกต้อง ค่าใช้จ่ายโปร่งใส').useful, false, 'คำปลุกใจ + ขายบริการ')
  assert.equal(classifyHeuristic('อย่าเพิ่งเซ็นสัญญาขายฝาก ถ้ายังไม่ได้เช็ก 5 เรื่องนี้ ดอกเบี้ย 1.25% ต่อเดือน หรือ 15% ต่อปี เอกสาร ขั้นตอน ค่าใช้จ่าย ต้องรู้ก่อนไปสำนักงานที่ดิน').useful, false, 'ฮุคคำถามแต่มีตัวเลข % มากกว่า 1 ที่ = แอดเรต')
})

test('buildClassifyPrompt/parseClassify: ส่งข้อความที่ล้างข้อมูลบุคคล/ลิงก์แล้ว · อ่านคำตอบทั้งแบบ {ads:[…]} และ array · id ที่ไม่ใช่ตัวเลขทิ้ง · แมป id เลขลำดับ/ตัวเลขเพี้ยนให้ตรง libraryId ของชุดที่ส่ง', () => {
  const ads = parseAdLibraryText(PAGE_TEXT)
  const { system, prompt } = buildClassifyPrompt(ads.slice(0, 2), brand)
  assert.match(system, /useful = true/)
  assert.match(system, /ห้ามใช้เลขลำดับในวงเล็บ/)
  assert.doesNotMatch(prompt, /@tundin|081-234|lin\.ee|https?:|www\./)
  assert.match(prompt, /id: 2852642058434243/)
  const parsed = parseClassify({ ads: [{ id: '2852642058434243', useful: true, topic: 'ขายฝาก vs จำนอง', reason: 'อธิบายข้อแตกต่าง' }, { id: 'x', useful: true }] })
  assert.equal(parsed.size, 1)
  assert.equal(parsed.get('2852642058434243').useful, true)
  assert.equal(parseClassify([{ id: '1', useful: 'false' }]).get('1').useful, false, 'ไม่มี batch = รับเลขล้วนตามเดิม')
  assert.equal(parseClassify('junk'), null)
  // มี batch: ตรงตัว · เลขลำดับ "1"/"[2]" · ตัวเลข JSON 17 หลักที่เพี้ยนตอน parse · เลขที่ไม่อยู่ในชุดทิ้ง
  const batch = [{ libraryId: '12345678901234567', text: 'a' }, { libraryId: '2852642058434243', text: 'b' }]
  assert.equal(resolveClassifyId('2852642058434243', batch), '2852642058434243')
  assert.equal(resolveClassifyId('1', batch), '12345678901234567')
  assert.equal(resolveClassifyId('[2]', batch), '2852642058434243')
  assert.equal(resolveClassifyId(12345678901234568, batch), '12345678901234567', 'Number("12345678901234567") เพี้ยนเป็น …568 ทั้งคู่')
  assert.equal(resolveClassifyId('9', batch), null)
  assert.equal(resolveClassifyId('99999999999999999', batch), null)
  const mapped = parseClassify({ ads: [{ id: 1, useful: false, topic: '“ขายฝาก” คืออะไร' }, { id: '[2]', useful: true }, { id: '7', useful: true }] }, batch)
  assert.equal(mapped.size, 2)
  assert.equal(mapped.get('12345678901234567').useful, false)
  assert.equal(mapped.get('12345678901234567').topic, '"ขายฝาก" คืออะไร', 'เครื่องหมายคำพูดโค้งใน topic → ตรง')
  assert.equal(mapped.get('2852642058434243').useful, true)
})

test('mergeAds/pruneAds/pickCandidates: ล้างข้อมูลบุคคลก่อนลงคลัง · ซ้ำไม่นับใหม่ · ตัดที่เก่ากว่า keep_days · ผู้สมัครต้องรันนาน + ให้ความรู้ + ผ่าน topic gate + ยังไม่เคยเสนอ', () => {
  const ads = parseAdLibraryText(PAGE_TEXT)
  const store = { ads: {} }
  assert.equal(mergeAds(store, ads, 'จำนองบ้าน', TODAY), 2, 'การ์ดไม่มีข้อความไม่ลงคลัง')
  assert.ok(!/@tundin|081-234/.test(JSON.stringify(store)), 'ไลน์/เบอร์ในข้อความและชื่อเพจถูกลบ')
  assert.ok(!/lin\.ee|https?:|www\.|:\/\//.test(JSON.stringify(store)), 'ลิงก์ทุกชนิดไม่ลงคลัง')
  assert.match(store.ads['2852642058434243'].text, /\[ลิงก์\]/)
  // ข้อความเก่าในคลังที่ปนบล็อกพรีวิว (ยาวกว่า) ต้องไม่ชนะข้อความสะอาด
  store.ads['2852642058434243'].text += '\nเพจทุนที่ดิน รับจำนอง โทร [ลบ]\nReal Estate, Financial Service\n7,452 people like this'
  mergeAds(store, ads, 'จำนองบ้าน', TODAY)
  assert.doesNotMatch(store.ads['2852642058434243'].text, /people like this|Real Estate/)
  assert.equal(mergeAds(store, ads, 'รับจำนอง', TODAY), 0, 'รอบสองไม่มีใหม่')
  assert.deepEqual(store.ads['2852642058434243'].phrases, ['จำนองบ้าน', 'รับจำนอง'])
  const picks = pickCandidates(store, { today: TODAY, cfg: { min_days_running: 14, min_text_chars: 80 }, scoring: DEFAULT_SCORING })
  assert.deepEqual(picks.map((p) => p.libraryId), ['2852642058434243'], 'แอดเรตล้วนและแอดใหม่ไม่ผ่าน')
  assert.equal(picks[0].days, 67)
  // ครีเอทีฟเดียวกันหลายรหัส (Land for Loan ยิงชุดเดียว 7 รหัส 7 พ.ย. 2569) → เสนอตัวเดียว · และเมื่อเสนอแล้ว รหัสอื่นของครีเอทีฟเดิมไม่เสนอซ้ำ
  store.ads['9999'] = { ...store.ads['2852642058434243'], started: '2026-10-01', versions: 1, idea: null }
  const dedup = pickCandidates(store, { today: TODAY, cfg: {}, scoring: DEFAULT_SCORING })
  assert.deepEqual(dedup.map((p) => p.libraryId), ['2852642058434243'], 'ครีเอทีฟซ้ำเก็บตัวที่รันนานสุด')
  store.ads['2852642058434243'].idea = TODAY
  assert.equal(pickCandidates(store, { today: TODAY, cfg: {}, scoring: DEFAULT_SCORING }).length, 0, 'เสนอแล้วไม่เสนอซ้ำ (รวมรหัสอื่นของครีเอทีฟเดียวกัน)')
  delete store.ads['9999']
  store.ads.old = { first_seen: '2026-01-01', last_seen: '2026-01-01', started: '2025-12-01', versions: 1, page: 'x', text: 'เก่า', phrases: [], idea: null }
  pruneAds(store, TODAY, 180)
  assert.ok(!store.ads.old)
  assert.equal(scoreAd({ days: 0, versions: 1 }), 3.8)
  assert.equal(scoreAd({ days: 180, versions: 3, aiUseful: true }), 6)
  assert.ok(scoreAd({ days: 67, versions: 4 }) > 4.4 && scoreAd({ days: 67, versions: 4 }) < 4.7)
})

test('adIdeaRow: source social · subtype ad_library (อยู่ในคอนฟิก) · ห้ามมีเบอร์/ไลน์ · ขั้นร่างอ่านข้อความแอดเป็นข้อเท็จจริง · ชื่อเรื่องตัดส่วน "รันนาน" · enrich ไม่แตะ', () => {
  const ads = parseAdLibraryText(PAGE_TEXT)
  const store = { ads: {} }
  mergeAds(store, ads, 'จำนองบ้าน', TODAY)
  const [pick] = pickCandidates(store, { today: TODAY, cfg: {}, scoring: DEFAULT_SCORING })
  const row = adIdeaRow({ ...pick, ai: { useful: true, topic: 'ขายฝาก vs จำนอง' } }, TODAY, { audience: ['A'] })
  assert.equal(row.source, SOURCE)
  assert.equal(row.subtype, SUBTYPE)
  assert.ok(ideaCfg.subtypes[SUBTYPE], 'subtype ต้องอยู่ใน idea_sources.json')
  assert.equal(row.external_key, 'ads:fb:2852642058434243')
  assert.equal(row.url, 'https://www.facebook.com/ads/library/?id=2852642058434243')
  assert.ok(!/@tundin|081-234/.test(JSON.stringify(row)))
  assert.match(row.title, /^แอดคู่แข่งรันนาน 67 วัน — ขายฝากกับจำนองต่างกันอย่างไร/)
  assert.match(row.source_label, /^Meta Ad Library · /)
  assert.ok(row.score >= 4.9 && row.score <= 6)
  assert.equal(hasResearchFacts(row), true, 'ข้อความแอด ≥ 40 ตัวอักษรนับเป็นข้อเท็จจริง')
  assert.match(socialCaption(row.summary), /^ขายฝากกับจำนองต่างกันอย่างไร/)
  assert.equal(needsFacts(row), false, 'enrich ไม่ดึง facebook.com')
  assert.equal(cleanTitleForPrompt(row, 'no_cite'), 'ขายฝากกับจำนองต่างกันอย่างไร รู้ก่อนไปสำนักงานที่ดิน')
  const split = splitFactsNotes(row.summary, { source: 'social' })
  assert.equal(split.facts.length, 1)
  assert.ok(split.notes.some((n) => /กลุ่มเพจ: คู่แข่ง/.test(n)))
  assert.ok(split.notes.every((n) => !/📢|เวอร์ชัน/.test(n)), 'บรรทัดตัวเลขไม่ไปถึง AI')
  const { prompt, policy } = buildDraftPrompt({ idea: row, angle: { label: 'เช็กลิสต์ก่อนเซ็น', brief: 'x' }, brand })
  assert.equal(policy, 'no_cite')
  assert.doesNotMatch(prompt, /แอดคู่แข่งรันนาน|เพจทุนที่ดิน|Meta Ad Library · เพจ/, 'ชื่อเพจและส่วนหัวภายในของชื่อเรื่องต้องไม่ไปถึง AI')
  assert.match(prompt, /กติกาของประเภทนี้: แอดคู่แข่งที่รันนาน/)
  // ขั้นมุมเล่าก็ต้องไม่ได้ส่วนหัวภายใน/บรรทัดตัวเลข (เคยรั่วเข้าร่างผ่าน angle.brief)
  const angles = buildAnglesPrompt({ idea: row, brand }).prompt
  assert.doesNotMatch(angles, /รันนาน \d+ วัน|\d+ เวอร์ชัน|เจอจากคำค้น|แอดคู่แข่งรันนาน|📢/)
  assert.match(angles, /ขายฝากกับจำนองต่างกันอย่างไร/)
})

test('adIdeaRow: เครื่องหมายคำพูดโค้งในแอด/หัวข้อ AI ไม่ทำให้ข้อเท็จจริงขาด · ตัวเลข % ของแอดแทนด้วย [เรต] · หัวข้อ AI ที่มีชื่อเพจทิ้ง · ร่างที่ลอกชื่อเพจหรือเรตถูกปัดตก', () => {
  const rec = { started: '2026-09-01', versions: 2, page: 'เพจทุนที่ดิน รับจำนอง ขายฝาก', phrases: ['จำนองบ้าน'], idea: null, text: 'ทุนที่ดิน อธิบาย: “ขายฝาก” กับ “จำนอง” ต่างกันตรงไหน ดอกเบี้ย 1.25% ต่อเดือน ขายฝากโอนกรรมสิทธิ์ทันทีแต่มีสิทธิไถ่คืนตามสัญญา ส่วนจำนองกรรมสิทธิ์ยังเป็นของเจ้าของ เอกสารที่ต้องใช้คือโฉนด บัตรประชาชน ทะเบียนบ้าน' }
  const row = adIdeaRow({ libraryId: '1', rec, days: 67, ai: { useful: true, topic: '“ขายฝาก” กับ “จำนอง” ต่างกันอย่างไร' } }, TODAY)
  assert.equal(hasResearchFacts(row), true)
  assert.ok(socialCaption(row.summary).length >= 40)
  assert.match(socialCaption(row.summary), /^ทุนที่ดิน อธิบาย: "ขายฝาก" กับ "จำนอง"/)
  assert.doesNotMatch(row.summary, /1\.25\s*%/)
  assert.match(row.summary, /\[เรต\]/)
  assert.ok(row.summary.split('\n').slice(1).every((l) => !/[“”]/.test(l.replace(/^“|”$/g, ''))), 'เครื่องหมายคำพูดโค้งเหลือแค่ตัวครอบ')
  const dropped = adIdeaRow({ libraryId: '1', rec, days: 67, ai: { useful: true, topic: 'ทุนที่ดิน สอนอะไร' } }, TODAY)
  assert.doesNotMatch(dropped.summary, /หัวข้อ:/, 'หัวข้อที่มีคำของชื่อเพจไม่ลง summary')
  // ขั้นร่าง: ชื่อแบรนด์ไทยเป็นคำเดี่ยวจากข้อความแอด → ปัดตก (ด่านป้ายเต็ม/ละตินจับไม่ได้) · เรตของแอดในแคปชั่น → ปัดตก · คำบริการทั่วไปจากชื่อเพจใช้ได้
  const cta = 'ทักแชต AssetX Estate ส่งข้อมูลทรัพย์มาให้ประเมินเบื้องต้นได้ ปิดข้อมูลส่วนบุคคลได้'
  const body = (lead) => [lead, 'ประเด็นแรก ตรวจเอกสารสิทธิ์และภาระผูกพันกับสำนักงานที่ดินก่อนตกลงอะไรทั้งสิ้น เพราะเงื่อนไขที่คุยกันทางแชตไม่ผูกพันเท่าสิ่งที่จดทะเบียน', 'ประเด็นที่สอง แยกค่าใช้จ่ายรวมออกเป็นรายการ ค่าธรรมเนียม ภาษี และค่าบริการ แล้วขอสรุปเป็นลายลักษณ์อักษร', 'ประเด็นที่สาม สิทธิไถ่ถอนและกำหนดเวลาต้องอยู่ในสัญญา ไม่ใช่คำพูด', 'ข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี', cta].join('\n\n')
  const facts = `${row.title}\n${row.summary}`
  const opts = { policy: 'no_cite', sourceLabel: row.source_label, brand, subtype: row.subtype, facts, format: 'explain' }
  const leak = parseDraft({ headline: 'ทุนที่ดิน สอนอะไร', caption: body('เพจ ทุนที่ดิน อธิบายว่าขายฝากกับจำนองต่างกันตรงไหน ซึ่งต้องดูเอกสารจริงของแต่ละกรณี'), cta, hashtags: [], needs_check: [] }, opts)
  assert.equal(leak.ok, false)
  assert.match(leak.error, /ทุนที่ดิน/)
  const generic = parseDraft({ headline: 'รับจำนอง ขายฝาก ต่างกันตรงไหน', caption: body('รับจำนองกับขายฝากต่างกันตรงไหน เรื่องนี้ต้องดูสัญญาและเอกสารของแต่ละกรณีให้ดีก่อนตัดสินใจ'), cta, hashtags: [], needs_check: [] }, { ...opts, sourceLabel: 'Meta Ad Library · รับจำนอง ขายฝาก ปิดบัญชี รีไฟแนนซ์' })
  assert.equal(generic.ok, true, generic.error)
  assert.match(generic.draft.caption, /รับจำนองกับขายฝาก/, 'คำบริการไม่ถูกแทนด้วย "เพจหนึ่ง"')
  const rate = parseDraft({ headline: 'ดอกเบี้ยขายฝากคิดยังไง', caption: body('บางแอดบอกดอกเบี้ย 1.25 % ต่อเดือน ซึ่งต้องดูสัญญาและเอกสารของแต่ละกรณีให้ดีก่อนตัดสินใจ'), cta, hashtags: [], needs_check: [] }, { ...opts, facts: `${facts}\nดอกเบี้ย 1.25% ต่อเดือน` })
  assert.equal(rate.ok, false)
  assert.match(rate.error, /ตัวเลข %.*คู่แข่ง/)
  const placeholder = parseDraft({ headline: 'ดอกเบี้ยขายฝากคิดยังไง', caption: body('บางแอดบอกดอกเบี้ย [เรต] ต่อเดือน ซึ่งต้องดูสัญญาและเอกสารของแต่ละกรณีให้ดีก่อนตัดสินใจ'), cta, hashtags: [], needs_check: [] }, opts)
  assert.equal(placeholder.ok, false)
  assert.match(placeholder.error, /\[เรต\]/)
})

test('planQueue: ที่ว่าง = max − ค้างในคิว · ตัดที่มีในคิวแล้ว · mark เฉพาะที่เลือกและที่มีอยู่แล้ว ชิ้นที่ล้นคิวไม่ mark', () => {
  const rows = ['a', 'b', 'c'].map((id) => ({ libraryId: id, row: { url: `https://www.facebook.com/ads/library/?id=${id}` } }))
  const plan = planQueue({ rows, inQueue: 5, maxInQueue: 6, knownUrls: new Set([rows[1].row.url]) })
  assert.equal(plan.room, 1)
  assert.deepEqual(plan.chosen.map((r) => r.libraryId), ['a'])
  assert.deepEqual(plan.known.map((r) => r.libraryId), ['b'])
  assert.deepEqual(plan.markIds, ['a', 'b'])
  assert.deepEqual(planQueue({ rows, inQueue: 6, maxInQueue: 6 }).chosen, [])
  assert.deepEqual(planQueue({ rows, inQueue: 0, maxInQueue: 6 }).markIds, ['a', 'b', 'c'])
})

test('dueForRun/adLibraryUrl', () => {
  assert.equal(dueForRun({}, TODAY, 7), true)
  assert.equal(dueForRun({ last_run_day: '2026-11-03' }, TODAY, 7), false)
  assert.equal(dueForRun({ last_run_day: '2026-10-31' }, TODAY, 7), true)
  assert.equal(adLibraryUrl({ q: 'จำนองบ้าน' }), 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&q=%E0%B8%88%E0%B8%B3%E0%B8%99%E0%B8%AD%E0%B8%87%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99&search_type=keyword_exact_phrase&media_type=all')
})

test('readAdLibraryPhrase: เปิด browser ชั่วคราว → รอ → เลื่อน → อ่าน innerText → ปิดเสมอ · 403 ที่ยังมีการ์ดไม่ถือว่าล้ม · หน้าล็อกอินรายงาน loginWall', async () => {
  const calls = []
  const fakeLaunch = (text, status, url = 'https://www.facebook.com/ads/library/?x') => async (opts) => {
    calls.push(['launch', opts])
    return {
      newContext: async () => ({
        newPage: async () => ({
          goto: async () => { calls.push(['goto']); return { status: () => status } },
          getByRole: () => ({ first: () => ({ isVisible: async () => false, click: async () => {} }) }),
          mouse: { wheel: async () => { calls.push(['wheel']) } },
          evaluate: async () => text,
          url: () => url,
        }),
      }),
      close: async () => { calls.push(['close']) },
    }
  }
  const noSleep = async () => {}
  const ok = await readAdLibraryPhrase({ q: 'จำนองบ้าน', cfg: { scroll_rounds: 2, max_ads_per_phrase: 2 }, launch: fakeLaunch(PAGE_TEXT, 403), sleep: noSleep })
  assert.equal(ok.status, 403)
  assert.equal(ok.ads.length, 2, 'ตัดตาม max_ads_per_phrase')
  assert.equal(ok.loginWall, false)
  assert.equal(ok.results, '~240 results')
  assert.deepEqual(calls.filter((c) => c[0] === 'wheel').length, 2)
  assert.equal(calls.at(-1)[0], 'close')
  assert.equal(calls[0][1].headless, true)
  const wall = await readAdLibraryPhrase({ q: 'x', cfg: {}, launch: fakeLaunch('Log in to Facebook to continue', 200, 'https://www.facebook.com/login/?next=x'), sleep: noSleep })
  assert.equal(wall.loginWall, true)
  assert.equal(wall.ads.length, 0)
  // error นอก goto (evaluate/wheel/newContext) ไม่โยน — คืน error ให้ตัวรันเตือนต่อวลี และ browser ถูกปิดเสมอ
  calls.length = 0
  const broken = async (opts) => {
    calls.push(['launch', opts])
    return { newContext: async () => ({ newPage: async () => ({ goto: async () => ({ status: () => 200 }), getByRole: () => ({ first: () => ({ isVisible: async () => false }) }), mouse: { wheel: async () => { throw new Error('Target closed\nstack line') } }, evaluate: async () => '', url: () => 'x' }) }), close: async () => { calls.push(['close']) } }
  }
  const failed = await readAdLibraryPhrase({ q: 'x', cfg: {}, launch: broken, sleep: noSleep })
  assert.equal(failed.ads.length, 0)
  assert.equal(failed.error, 'Target closed')
  assert.equal(calls.at(-1)[0], 'close')
})

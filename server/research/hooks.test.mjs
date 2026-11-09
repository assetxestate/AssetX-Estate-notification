import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadHookPatterns, classifyHook, primaryPattern, pickHookPatterns, hookPromptLines, hookIssue, scoreHook, parseHooks, headlineIsLabel, swapOpeningLine, lessonWeight, HOOK_WEAK } from './hooks.js'
import { youtubeSamples, facebookSamples, adSamples, summarizeHookLessons, mergeSamples, cleanTitle, lessonsHeadline } from './hook-lessons.js'
import { buildDraftPrompt, parseDraft, generateDrafts } from './drafts.js'
import { checkText } from '../../src/lib/marketing-model/rules.js'

const lib = loadHookPatterns()
const brand = JSON.parse(readFileSync(new URL('../../research/brand_facts.json', import.meta.url), 'utf8'))

test('คลังสูตร: ทุกสูตรมีครบ · ตัวอย่างของทุกสูตรผ่านกติกาของตัวเอง (คำต้องห้ามของแบรนด์ · คลิกเบต · สัญญาผลลัพธ์) และตัวถอดสูตรจับได้', () => {
  assert.ok(lib.patterns.length >= 10)
  assert.ok(lib.rules.length >= 6)
  const ids = new Set()
  for (const p of lib.patterns) {
    assert.ok(!ids.has(p.id), `รหัสซ้ำ ${p.id}`); ids.add(p.id)
    for (const key of ['name', 'how', 'headline', 'family', 'evidence']) assert.ok(p[key], `${p.id} ขาด ${key}`)
    assert.ok(p.example?.line && p.example?.headline, `${p.id} ขาดตัวอย่าง`)
    assert.equal(hookIssue(p.example.line), '', `${p.id}: ตัวอย่างผิดกติกา hook`)
    assert.ok(!/!/.test(p.example.line + p.example.headline), `${p.id}: มี !`)
    assert.equal(checkText(`${p.example.headline}\n${p.example.line}`, 'x').filter((f) => f.severity === 'block').length, 0, `${p.id}: ติดคำต้องห้าม`)
    assert.ok(p.example.headline.length <= 30, `${p.id}: พาดหัวตัวอย่างยาว ${p.example.headline.length}`)
    assert.ok(classifyHook(p.example.line).includes(p.id) || classifyHook(p.example.headline).includes(p.id), `${p.id}: ตัวถอดสูตรจับตัวอย่างของตัวเองไม่ได้ (${classifyHook(p.example.line)})`)
  }
})

test('classifyHook: ถอดสูตรจากชื่อคลิป/โพสต์จริงในตลาด · แอดประกาศขายที่ครอบด้วย "…" ไม่นับเป็นสูตรคำพูด', () => {
  assert.ok(classifyHook('เจ้าของห้องไม่มีอำนาจครอบครอง จำไว้นะ').includes('misconception'))
  assert.ok(classifyHook('ทุบบ้านร้อยล้านทิ้ง เพราะที่ดินส่วนกลาง').includes('consequence-first'))
  assert.ok(!classifyHook('ซื้อบ้านเพราะอยากมีที่อยู่').includes('consequence-first'), 'ไม่มีผลเสียก่อนคำว่าเพราะ')
  assert.ok(classifyHook('กลโกงใหม่ ถือครองบ้านผ่านนอมินี').includes('scam-signal'))
  assert.ok(classifyHook('กู้ซื้อบ้านกับแฟน แต่ไม่จดทะเบียนสมรส อยากเอาชื่อผู้กู้ร่วมออก').includes('exact-situation'))
  assert.ok(classifyHook('แบ่งแยกโฉนด ทำได้ไหม ทำเมื่อไหร่').includes('can-i'))
  assert.ok(classifyHook('เงินเดือนขึ้นทุกปี แต่ทำไมยังรู้สึกจน').includes('paradox-why'))
  assert.ok(classifyHook('ก่อนรับที่ดินเข้าพอร์ต ต้องเช็ก 3 สิ่งนี้').includes('specific-checklist'))
  assert.ok(classifyHook('“ไม่ต้องอ่านหรอก” ประโยคนี้แหละที่อันตราย').includes('quote-open'))
  assert.ok(!classifyHook('"หลังนี้มีเงินเหลือ 50,000 บาท++ หมู่บ้านใหม่').includes('quote-open'))
  assert.ok(classifyHook('อยากซื้อขายที่ดิน ต้องทำแบบไหน ถึงจะไม่เสียโง่').includes('avoid-loss'))
  assert.ok(classifyHook('เมื่อลูกหนี้ตาย หนี้จะจบไปด้วยจริงไหม').includes('question'))
  assert.ok(classifyHook('รับจำนอง ขายฝาก ไถ่ถอน เพิ่มวงเงิน').includes('offer-led'))
  assert.ok(classifyHook('มีโฉนดก็ได้เงินไว อนุมัติไว').includes('outcome-promise'))
  assert.deepEqual(classifyHook(''), [])
  assert.equal(primaryPattern('รับจำนอง ด่วน!'), 'other', 'สูตรตลาดอย่างเดียว = แต่งเอง')
})

test('hookIssue: คลิกเบต · ขอยอด · ระบุสถานะการเงินคนอ่าน (เงื่อนไข "ถ้า" ผ่าน) · ความเร่งปลอม · อ้างเคสจริง · เปิดด้วยแบรนด์ · ยาวเกิน', () => {
  assert.match(hookIssue('ช็อก ขายฝากแบบนี้เสียบ้าน'), /คลิกเบต/)
  assert.match(hookIssue('ใครเคยขายฝาก พิมพ์ 1 ไว้ใต้โพสต์'), /ขอยอด/)
  assert.match(hookIssue('แชร์เก็บไว้ ก่อนเซ็นขายฝาก'), /ขอยอด/)
  assert.match(hookIssue('คุณกำลังเป็นหนี้อยู่ใช่ไหม'), /สถานะการเงิน/)
  assert.equal(hookIssue('ถ้าคุณมีหนี้บ้านกับธนาคาร แต่อยากรีไฟแนนซ์ ต้องเช็กอะไร'), '')
  assert.match(hookIssue('รีบก่อนสิ้นเดือน ขายฝากได้ไว'), /เร่ง/)
  assert.equal(hookIssue('วันสุดท้ายของการไถ่ ต้องเตรียมอะไร'), '', 'วันสุดท้ายของการไถ่ = ข้อเท็จจริงของสัญญา ไม่ใช่ความเร่งปลอม')
  assert.match(hookIssue('เคสจริงเมื่อวาน ลูกค้าเราเกือบเสียบ้าน'), /เคสจริง/)
  assert.match(hookIssue('AssetX ขอเล่าเรื่องขายฝาก'), /แบรนด์/)
  assert.match(hookIssue('ก'.repeat(130)), /ยาว/)
  assert.equal(hookIssue('ก่อนเซ็นขายฝาก อ่าน 3 บรรทัดนี้ในสัญญาให้ครบ'), '')
})

test('scoreHook: เจาะจง+คำถาม+เนื้อหาตอบ ได้คะแนนสูง · แม่แบบเดิม/บอกเล่ากว้าง ๆ/สัญญาแล้วไม่จ่าย ได้ต่ำ', () => {
  const body = 'สัญญาขายฝากต้องระบุราคา วันครบกำหนด และสินไถ่ให้ชัด\n\n1. ราคา: ตรงกับที่จดที่สำนักงานที่ดิน\n2. วันครบกำหนด: นับจากวันจด\n3. สินไถ่: ไม่เกินเพดานตามกฎหมาย'
  const strong = scoreHook('ก่อนเซ็นขายฝาก อ่าน 3 บรรทัดนี้ในสัญญาให้ครบ: ราคา วันครบกำหนด และสินไถ่', { body })
  const stale = scoreHook('ถ้าคุณกำลังพิจารณาขายฝาก มี 4 ข้อให้เช็กก่อนตัดสินใจเพื่อความมั่นใจในการทำธุรกรรม', { body })
  const flat = scoreHook('บริการของเราดูแลอย่างใส่ใจและเป็นมืออาชีพ', { body })
  const bait = scoreHook('ทำไมนายหน้าบางคนถึงไม่อยากให้รู้เรื่องภาษีมรดกที่ดินชายทะเล', { body })
  assert.ok(strong.score >= 75, `strong ${strong.score} ${strong.bad}`)
  assert.ok(stale.score < strong.score - 15, `stale ${stale.score}`)
  assert.ok(stale.bad.some((b) => /แม่แบบเดิม/.test(b)))
  assert.ok(flat.score < HOOK_WEAK, `flat ${flat.score}`)
  assert.ok(bait.bad.some((b) => /ไม่ได้ตอบ/.test(b)), 'hook สัญญาเรื่องที่เนื้อหาไม่พูดถึง = เสี่ยงคลิกเบต')
  const repeat = scoreHook('ก่อนเซ็นขายฝาก อ่าน 3 บรรทัดนี้ในสัญญาให้ครบ', { body, recent: ['ก่อนเซ็นขายฝาก อ่าน 3 บรรทัดนี้ในสัญญาให้ครบถ้วน'] })
  assert.ok(repeat.bad.some((b) => /คล้าย/.test(b)))
})

test('pickHookPatterns: 3 สูตรที่เข้ากับโครง ต่างตระกูล · ไม่ซ้ำมุมพี่น้อง · คงที่ตาม seed · สูตรที่ต้องมีข้อเท็จจริงหายเมื่อไม่มี · บทเรียนเพิ่มน้ำหนัก', () => {
  const a = pickHookPatterns({ format: 'checklist', seed: 'x:0', library: lib })
  assert.equal(a.length, 3)
  assert.ok(a.every((p) => p.formats.includes('checklist')))
  assert.equal(new Set(a.map((p) => p.family)).size, 3, 'ต่างตระกูลกัน')
  assert.deepEqual(pickHookPatterns({ format: 'checklist', seed: 'x:0', library: lib }).map((p) => p.id), a.map((p) => p.id), 'seed เดิม = ผลเดิม')
  const b = pickHookPatterns({ format: 'checklist', seed: 'x:0', avoid: a.map((p) => p.id), library: lib })
  assert.ok(b.every((p) => !a.map((x) => x.id).includes(p.id)), 'สูตรของมุมพี่น้องไม่กลับมา')
  assert.ok(!pickHookPatterns({ format: 'qa', hasFacts: false, library: lib, count: 6 }).some((p) => p.id === 'misconception'))
  assert.deepEqual(pickHookPatterns({ format: 'warning', library: lib }).map((p) => p.id).includes('scam-signal'), true)
  assert.ok(pickHookPatterns({ format: 'news', library: lib }).some((p) => p.id === 'news-impact'))
  assert.equal(lessonWeight(null, 'can-i'), 1)
  assert.equal(lessonWeight({ patterns: { 'can-i': { n: 3, lift: 3 } } }, 'can-i'), 1, 'ตัวอย่าง < 5 ไม่นับ')
  assert.equal(lessonWeight({ patterns: { 'can-i': { n: 9, lift: 3 } } }, 'can-i'), 1.8, 'จำกัดเพดาน')
  assert.equal(lessonWeight({ patterns: { 'can-i': { n: 9, lift: 0 } } }, 'can-i'), 0.6, 'จำกัดพื้น ไม่ให้สูตรหายจากรอบหมุน')
  const lines = hookPromptLines(a, { rules: lib.rules })
  assert.match(lines.join('\n'), /เขียนประโยคเปิด 3 แบบ/)
  for (const p of a) assert.match(lines.join('\n'), new RegExp(`pattern "${p.id}"`))
  assert.match(lines.join('\n'), /คุณเป็นหนี้อยู่ใช่ไหม/, 'กติกาสถานะการเงินอยู่ในพรอมต์')
})

test('parseHooks: ล้าง · ทิ้งตัวผิดกติกา · จับตัวที่ใช้จริงจากบรรทัดแรก · บรรทัดแรกที่ไม่ตรงแบบไหน = "แต่งเอง" · คำพูดที่มีคู่ปิดอยู่ครบ', () => {
  const caption = 'ก่อนเซ็นขายฝาก อ่าน 3 บรรทัดนี้ในสัญญาให้ครบ\n\nราคา วันครบกำหนด และสินไถ่ ต้องอยู่ในสัญญาที่จดกับสำนักงานที่ดิน'
  const raw = [
    { pattern: 'specific-checklist', line: '1. ก่อนเซ็นขายฝาก อ่าน 3 บรรทัดนี้ในสัญญาให้ครบ!', headline: '3 บรรทัดก่อนเซ็น' },
    { pattern: 'can-i', line: 'ขายฝากแล้ว ไถ่ก่อนครบกำหนดได้ไหม', headline: 'ไถ่ก่อนได้ไหม' },
    { pattern: 'misconception', line: 'ช็อก ขายฝากแล้วเสียบ้าน', headline: 'x' },
    { pattern: 'quote-open', line: '“สัญญาแบบเดียวกับทุกคน” ประโยคนี้ควรทำให้อ่านช้าลง', headline: 'สัญญาเหมือนกันหมด จริงไหม' },
    { pattern: 'mystery', line: 'ขายฝากแล้ว ไถ่ก่อนครบกำหนดได้ไหมนะ', headline: 'ซ้ำ' },
  ]
  const r = parseHooks(raw, { caption, headline: '3 บรรทัดก่อนเซ็น', library: lib })
  assert.equal(r.hooks.length, 3, 'ตัวคลิกเบตทิ้ง · ตัวซ้ำทิ้ง')
  assert.equal(r.dropped.length, 1)
  assert.equal(r.used, 0)
  assert.equal(r.hooks[0].line, 'ก่อนเซ็นขายฝาก อ่าน 3 บรรทัดนี้ในสัญญาให้ครบ', 'เลขข้อและ ! ถูกล้าง')
  assert.equal(r.hooks[0].used, true)
  assert.match(r.hooks[2].line, /^“สัญญาแบบเดียวกับทุกคน”/)
  assert.ok(r.hooks.every((h) => Number.isFinite(h.score) && h.name))
  const own = parseHooks(raw.slice(1, 2), { caption, headline: 'h', library: lib })
  assert.equal(own.hooks.at(-1).from, 'caption')
  assert.equal(own.hooks.at(-1).used, true)
  const guarded = parseHooks([{ pattern: 'can-i', line: 'ขายฝากกับเพจหนึ่ง ได้ไหม' }], { caption, check: (t) => (/เพจหนึ่ง/.test(t) ? 'ชื่อเพจ' : ''), library: lib })
  assert.equal(guarded.dropped.length, 1)
  assert.equal(parseHooks(null, { caption: '', library: lib }).used, -1)
})

test('headlineIsLabel / swapOpeningLine', () => {
  assert.equal(headlineIsLabel('รับจำนอง ต้องเช็กสิทธิ'), true, 'ป้ายชื่อเรื่องจากร่างจริง')
  assert.equal(headlineIsLabel('เตรียมเอกสาร ก่อนจำนอง'), true)
  assert.equal(headlineIsLabel('ขายฝาก บริการครบวงจร'), true)
  assert.equal(headlineIsLabel('ขายฝากแล้ว บ้านเป็นของใคร'), false, 'คำถามไม่มีเครื่องหมาย ? ก็นับ')
  assert.equal(headlineIsLabel('ไถ่ก่อนครบกำหนด ได้ไหม'), false)
  assert.equal(headlineIsLabel('วันจดจำนอง ต้องเตรียมอะไร'), false, 'คำถามไม่มี ? (เตือนผิดในการทดลองจริง 9 พ.ย. 2569)')
  assert.equal(headlineIsLabel('ขายฝากได้กี่ปี'), false)
  assert.equal(headlineIsLabel('3 บรรทัดก่อนเซ็นขายฝาก'), false)
  assert.equal(headlineIsLabel(''), false)
  assert.equal(swapOpeningLine('\nบรรทัดเดิม\n\nเนื้อหา', 'บรรทัดใหม่'), '\nบรรทัดใหม่\n\nเนื้อหา')
  assert.equal(swapOpeningLine('ก\n\nข', ''), 'ก\n\nข')
})

test('เลนบทเรียน: ตัวอย่างจาก YouTube/Facebook/แอด เทียบค่ากลางของแหล่งเดียวกัน · lift ต่อสูตร · ตัดซ้ำ · รวมข้ามสัปดาห์ · ไม่มีข้อความในบทเรียน', () => {
  assert.equal(cleanTitle('แบ่งแยกโฉนด ทำได้ไหม? | My Property Pro #ที่ดิน'), 'แบ่งแยกโฉนด ทำได้ไหม?')
  const yt = youtubeSamples([{ title: 'เจ้าของห้องไม่มีอำนาจครอบครอง จำไว้นะ', views: 9000 }, { title: 'บ้านสวย', views: 1000 }, { title: 'คอนโดใหม่', views: 1000 }, { title: 'x', views: 0 }], 'ช่อง')
  assert.equal(yt.length, 3)
  assert.equal(yt[0].x, 9)
  const fb = facebookSamples({ posts: [1, 1, 1, 10].map((r, i) => ({ caption: i === 3 ? 'ขายฝากมีค่าใช้จ่ายอะไรบ้าง ?\nรายละเอียด' : `โพสต์ ${i}`, m: { reactions: r } })) }, 'เพจ')
  assert.equal(fb.length, 4)
  assert.equal(fb[3].text, 'ขายฝากมีค่าใช้จ่ายอะไรบ้าง ?')
  assert.deepEqual(facebookSamples({ posts: [{ caption: 'a', m: { reactions: 3 } }] }), [], 'โพสต์มียอดน้อยกว่า 4 = ค่ากลางเชื่อไม่ได้')
  const ads = adSamples({ ads: { a: { text: 'รับจำนอง ขายฝาก ไถ่ถอน', started: '2026-01-01', last_seen: '2026-11-01' }, b: { text: 'ขายบ้านสวย ผ่อนวันละ 99', started: '2026-01-01', last_seen: '2026-11-01' }, c: { text: 'ขายฝากที่ดิน ทำได้ไหม', started: '2026-10-01', last_seen: '2026-11-01' } } })
  assert.equal(ads.length, 2, 'แอดขายบ้าน (ไม่ใช่บริการแบบเรา) ไม่นับ')
  const lessons = summarizeHookLessons([...yt, ...fb, ...ads, { ...yt[0] }], { now: new Date('2026-11-09T00:00:00Z') })
  assert.equal(lessons.samples.total, 9, 'ตัวซ้ำนับครั้งเดียว')
  assert.ok(lessons.patterns.misconception.hot === 1 && lessons.patterns.misconception.lift > 1)
  assert.ok(!JSON.stringify(lessons).includes('อำนาจครอบครอง'), 'บทเรียนเก็บตัวเลขอย่างเดียว')
  const merged = mergeSamples([{ source: 'youtube', text: 'เก่า', x: 1 }], [{ source: 'youtube', text: 'เก่า', x: 3 }, { source: 'ads', text: 'ใหม่', x: 2 }], { today: '2026-11-09' })
  assert.equal(merged.length, 2)
  assert.equal(merged.find((s) => s.text === 'เก่า').x, 3)
  assert.match(lessonsHeadline({ patterns: { 'can-i': { n: 6, hot: 3, lift: 2 }, compare: { n: 2, hot: 2, lift: 5 } } }, (id) => id), /^can-i ×2 \(3\/6\)$/)
})

// ── ต่อกับตัวร่าง ──
const idea = { id: 7, source: 'news', source_label: 'ฐานเศรษฐกิจ', subtype: 'market', title: 'ขายฝากที่ดิน ต้องดูสัญญาให้ครบ', summary: '📌 สัญญาขายฝากต้องระบุราคา วันครบกำหนด และสินไถ่', angles: [{ label: 'เช็กลิสต์ก่อนเซ็น', brief: 'เช็กลิสต์' }] }
const goodCaption = [
  'ก่อนเซ็นขายฝาก อ่าน 3 บรรทัดนี้ในสัญญาให้ครบ: ราคา วันครบกำหนด และสินไถ่',
  'ทั้งสามบรรทัดคือสิ่งที่ผูกพันจริงหลังจดที่สำนักงานที่ดิน ไม่ใช่สิ่งที่คุยกันทางแชต',
  '1. ราคา: ตรงกับที่จดทะเบียนที่สำนักงานที่ดิน และตรงกับเงินที่ได้รับจริงหลังหักค่าใช้จ่าย',
  '2. วันครบกำหนด: นับจากวันจดทะเบียน จดวันนี้ไว้ในปฏิทินของตัวเองตั้งแต่วันแรก',
  '3. สินไถ่: ตัวเลขที่ต้องจ่ายตอนไถ่คืน ต้องเป็นตัวเลขเดียวกับในสัญญา และไม่เกินเพดานตามกฎหมาย',
  'ข้อมูลนี้เป็นความรู้ทั่วไป ต้องดูเอกสารและข้อเท็จจริงของแต่ละกรณี',
  'ส่งรูปสัญญาที่ปิดชื่อแล้วมาทางแชต ทีม AssetX Estate ช่วยดูสามบรรทัดนี้ให้ก่อนเซ็น',
].join('\n\n')

test('buildDraftPrompt + hooks: มีส่วน Hook 3 สูตรตามโครง · JSON ต้องมี hooks · ไม่ส่ง = พรอมต์แบบเดิม', () => {
  const on = buildDraftPrompt({ idea, angle: idea.angles[0], brand, hooks: { library: lib, seed: 'a' } })
  assert.equal(on.format, 'checklist')
  assert.equal(on.hookPatterns.length, 3)
  assert.match(on.prompt, /Hook \(สำคัญที่สุดของโพสต์/)
  assert.match(on.system, /"hooks":\[/)
  assert.match(on.system, /บรรทัดแรกคือ hook/)
  const off = buildDraftPrompt({ idea, angle: idea.angles[0], brand })
  assert.deepEqual(off.hookPatterns, [])
  assert.doesNotMatch(off.prompt, /Hook \(/)
  assert.doesNotMatch(off.system, /"hooks"/)
})

test('parseDraft + hooks: เก็บประโยคเปิดทางเลือกพร้อมคะแนน · ตัวที่ใช้ = บรรทัดแรก · ประโยคเปิดคลิกเบต = ร่างใหม่ · เคสสมมุติต้องบอกภายในบรรทัดที่สอง', () => {
  const data = {
    hooks: [
      { pattern: 'specific-checklist', line: 'ก่อนเซ็นขายฝาก อ่าน 3 บรรทัดนี้ในสัญญาให้ครบ: ราคา วันครบกำหนด และสินไถ่', headline: '3 บรรทัดก่อนเซ็นขายฝาก' },
      { pattern: 'consequence-first', line: 'สินไถ่ในสัญญาไม่ตรงกับที่คุย อาจต้องจ่ายมากกว่าที่คิด เพราะไม่ได้อ่านบรรทัดเดียว', headline: 'จ่ายเกิน เพราะไม่อ่าน' },
      { pattern: 'misconception', line: 'ได้เงินก้อนแน่นอน แค่มีโฉนด', headline: 'x' },
    ],
    headline: '3 บรรทัดก่อนเซ็นขายฝาก', caption: goodCaption, cta: 'ส่งรูปสัญญาที่ปิดชื่อแล้วมาทางแชต ทีม AssetX Estate ช่วยดูสามบรรทัดนี้ให้ก่อนเซ็น', hashtags: ['ขายฝาก'], needs_check: [],
  }
  const r = parseDraft(data, { policy: 'cite', sourceLabel: 'ฐานเศรษฐกิจ', brand, format: 'checklist', facts: idea.summary, hookLibrary: lib })
  assert.equal(r.ok, true, r.error)
  assert.equal(r.draft.hooks.length, 2, 'ตัวสัญญาผลลัพธ์ถูกทิ้ง')
  assert.equal(r.draft.hooks_dropped, 1)
  assert.equal(r.draft.hook_pattern, 'specific-checklist')
  assert.ok(r.draft.hook_score >= 60, String(r.draft.hook_score))
  assert.equal(r.draft.hooks.filter((h) => h.used).length, 1)
  const none = parseDraft(data, { policy: 'cite', sourceLabel: 'ฐานเศรษฐกิจ', brand, format: 'checklist', facts: idea.summary })
  assert.equal(none.draft.hooks, undefined, 'ไม่ส่งคลัง = ไม่มีฟิลด์ hook (ร่างแบบเดิม)')
  const bait = parseDraft({ ...data, caption: goodCaption.replace(/^[^\n]+/, 'ใครเคยขายฝาก พิมพ์ 1 ไว้ใต้โพสต์นี้ แล้วอ่าน 3 บรรทัดนี้ในสัญญา') }, { policy: 'cite', sourceLabel: 'ฐานเศรษฐกิจ', brand, format: 'checklist', facts: idea.summary, hookLibrary: lib })
  assert.equal(bait.ok, false)
  assert.match(bait.error, /ประโยคเปิดใช้ไม่ได้: ขอยอด/)
  const quoted = parseDraft({ ...data, caption: goodCaption.replace(/^[^\n]+/, '“สัญญาแบบเดียวกับทุกคน ไม่ต้องอ่านหรอก” ประโยคนี้แหละที่ควรทำให้อ่านสัญญาขายฝากช้าลง') }, { policy: 'cite', sourceLabel: 'ฐานเศรษฐกิจ', brand, format: 'checklist', facts: idea.summary, hookLibrary: lib })
  assert.match(quoted.draft.caption, /^“สัญญาแบบเดียวกับทุกคน ไม่ต้องอ่านหรอก” ประโยคนี้/, 'คำพูดที่มีคู่ปิดไม่ถูกลบ')
  const caseDraft = parseDraft({ ...data, caption: goodCaption.replace(/^[^\n]+/, 'เงินไถ่พร้อมแล้ว แต่อาจไถ่ไม่ทัน เพราะนัดสำนักงานที่ดินไว้วันสุดท้ายพอดี') }, { policy: 'cite', sourceLabel: 'ฐานเศรษฐกิจ', brand, format: 'case', facts: idea.summary, hookLibrary: lib })
  assert.equal(caseDraft.ok, true, caseDraft.error)
  assert.match(caseDraft.draft.caption.split('\n').slice(0, 2).join('\n'), /\(เคสสมมุติ\)/)
})

test('generateDrafts + hooks: hook อ่อนครั้งแรก = ร่างใหม่พร้อมเหตุผล · ครั้งสองล้ม = ใช้ร่างแรก (ไม่ทิ้งงาน) · ส่งสูตรที่ใช้แล้วต่อให้ร่างถัดไป', async () => {
  const weakCaption = goodCaption.replace(/^[^\n]+/, 'บริการของเราดูแลอย่างใส่ใจและเป็นมืออาชีพเสมอมา')
  const prompts = []
  let n = 0
  const ask = async ({ prompt }) => {
    prompts.push(prompt)
    n += 1
    if (n === 1) return { ok: true, provider: 'test', data: { headline: 'บริการดูแลใส่ใจ', caption: weakCaption, cta: 'ส่งรูปสัญญาที่ปิดชื่อแล้วมาทางแชต ทีม AssetX Estate ช่วยดูให้ก่อนเซ็น', hashtags: [], needs_check: [] } }
    return { ok: false, error: 'ตอบไม่ใช่ JSON' }
  }
  const result = await generateDrafts({ ideas: [JSON.parse(JSON.stringify(idea))], brand, ask, onSave: async () => {}, sleep: async () => {}, delayMs: 0, hookLibrary: lib })
  assert.equal(prompts.length, 2)
  assert.match(prompts[1], /ยังไม่ชวนอ่านต่อ/)
  assert.equal(result.done.length, 1, 'ร่างแรกถูกใช้เป็นสำรอง')
  const second = []
  const ask2 = async ({ prompt }) => { second.push(prompt); return { ok: true, provider: 'test', data: { hooks: [{ pattern: 'specific-checklist', line: goodCaption.split('\n')[0], headline: '3 บรรทัดก่อนเซ็นขายฝาก' }], headline: '3 บรรทัดก่อนเซ็นขายฝาก', caption: goodCaption, cta: 'ส่งรูปสัญญาที่ปิดชื่อแล้วมาทางแชต ทีม AssetX Estate ช่วยดูให้ก่อนเซ็น', hashtags: [], needs_check: [] } } }
  const two = JSON.parse(JSON.stringify(idea))
  two.id = 8
  const saved = []
  await generateDrafts({ ideas: [JSON.parse(JSON.stringify(idea)), two], brand, ask: ask2, onSave: async (id, angles) => saved.push(angles[0].draft), sleep: async () => {}, delayMs: 0, hookLibrary: lib })
  assert.equal(saved[0].hook_pattern, 'specific-checklist')
  assert.ok(saved[0].hook_score >= HOOK_WEAK)
  assert.equal(second.length, 2)
})

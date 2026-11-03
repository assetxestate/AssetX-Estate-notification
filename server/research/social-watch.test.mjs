// เทสต์ตัวเฝ้าเพจ Facebook — ของปลอมแทน OpenCLI + โฟลเดอร์ชั่วคราวแทน ~/.research-browser (ห้ามจำลองบล็อก/บันทึกปลอมลงของจริง: แถวพักปลอม = DVX หยุดอ่าน 3 วัน)
// รัน: node --test server/research/social-watch.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Lock, LostLock, usageRows, readState } from './shared-browser.mjs'
import {
  FB_JS, SESSION, DEFAULTS, WatchError, Blocked,
  targetId, fbKey, fbLink, richness, cleanCaption, tagsOf, mergePosts, prunePosts, eng, median, outliers, ideaRow, dueTargets, quotaLeft,
  createOc, unwrap, readFacebookPage, runFacebookWatch, pageStorePath,
} from './social-watch.js'

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix))
const TODAY = '2026-11-03'
const noSleep = async () => {}
const TARGETS = [
  { name: 'เพจทดสอบ A', url: 'https://www.facebook.com/TestPageA', group: 'competitor', every_days: 4 },
  { name: 'เพจทดสอบ B', url: 'https://www.facebook.com/TestPageB', group: 'media', every_days: 7 },
]
const CFG = { shared_browser: { wait_minutes: 0 }, fb_scroll_steps: 2, fb_max_posts: 12, fb_low_posts: 3 }

// โพสต์ตามรูปที่ FB_JS คืน (DOM) — ใส่คำ "ที่ดิน/ขายฝาก" ให้ผ่าน topic gate
function domPost(i, reactions, caption = `โพสต์ ${i} เรื่องขายฝากที่ดิน`) {
  return { pos: i, vid: null, fbids: [String(900000 + i)], perma: null, ext: null, format: 'photo', caption, m: { reactions, comments: 0, shares: 0, views: null } }
}
const fixturePosts = () => [domPost(1, 12), domPost(2, 9), domPost(3, 11), domPost(4, 60, 'ขายฝากที่ดินโทร 081-234-5678 ไลน์ @landdeal')]

// OpenCLI ปลอม: เรียก lock.require() ก่อนทุกคำสั่งเหมือนตัวจริง (ยกเว้น beat:false) · บันทึกทุกคำสั่งไว้ตรวจ
function fakeOc({ lockRef, connected = true, daemonRunning = true, blocked = null, posts = fixturePosts, onOpen = null } = {}) {
  const calls = []
  const oc = async (args, opts = {}) => {
    if (opts.beat !== false && lockRef.lock) lockRef.lock.require()
    calls.push({ args, beat: opts.beat !== false })
    const [a, b] = args
    if (a === 'profile' && b === 'list') {
      const up = typeof connected === 'function' ? connected(calls) : connected
      return { ok: true, data: { daemonRunning: typeof daemonRunning === 'function' ? daemonRunning(calls) : daemonRunning, profiles: [{ alias: 'research', connected: up }] } }
    }
    if (a === 'daemon' && b === 'restart') return { ok: true, data: { restarted: true } }
    if (a === 'browser' && b === 'open') { oc.lastUrl = args[2]; if (onOpen) await onOpen(args[2], calls); return { ok: true, data: {} } }
    if (a === 'browser' && b === 'eval') return { ok: true, data: { result: blocked ? { blocked, posts: [] } : { blocked: null, posts: posts(oc.lastUrl) } } }
    if (a === 'browser' && b === 'scroll') return { ok: true, data: {} }
    if (a === 'browser' && b === 'close') return { ok: true, data: {} }
    throw new Error(`คำสั่งที่ไม่คาดคิด: ${args.slice(0, 2).join(' ')}`)
  }
  oc.calls = calls
  return oc
}

function harness(ocOpts = {}, extra = {}) {
  const base = tmp('sw-shared-')
  const storeDir = tmp('sw-store-')
  const lockRef = {}
  const oc = fakeOc({ lockRef, ...ocOpts })
  const clock = { t: 1_000_000 }
  const deps = {
    oc,
    sleep: async (ms) => { clock.t += ms },
    now: () => clock.t,
    random: () => 0.5,
    lockFactory: (opts) => (lockRef.lock = new Lock('assetx', opts)),
    today: TODAY,
    spawnChrome: () => false,
    log: () => {},
    ...(extra.deps || {}),
  }
  const run = (over = {}) => runFacebookWatch({ cfg: CFG, targets: TARGETS, storeDir, base, deps, ...over })
  return { base, storeDir, lockRef, oc, clock, deps, run }
}

const openCalls = (oc) => oc.calls.filter((c) => c.args[0] === 'browser' && c.args[1] === 'open')
const closeCalls = (oc) => oc.calls.filter((c) => c.args[0] === 'browser' && c.args[1] === 'close')

// ── FB_JS ──────────────────────────────────────────────────────────────────
test('FB_JS เป็น IIFE ล้วนที่ parse ผ่าน และยังมีตัวจับหน้า login/checkpoint (ไม่โดน template literal กิน \\/)', () => {
  assert.ok(FB_JS.startsWith('(() => {'), 'ต้องตัดคอมเมนต์หัวไฟล์ออกจนเหลือ IIFE')
  assert.doesNotThrow(() => new Function(`return ${FB_JS}`))
  for (const must of ['/^\\/(login|checkpoint)/.test(path)', "input[name=\"pass\"]", 'div[aria-posinset]', 'data-ad-comet-preview="message"', 'return { blocked: null, posts };']) {
    assert.ok(FB_JS.includes(must), `ขาดข้อความต้นฉบับ: ${must}`)
  }
  assert.ok(!FB_JS.includes('`'), 'ต้นฉบับไม่มี backtick')
  // ส่วนเพิ่มของ AssetX 3 พ.ย. 2569: อ่านยอดจาก aria-label "Like: 47 people" เมื่อบรรทัด "All reactions:" หายไป (FB แสดงตัวเลขแยกหลักพร้อมตัวลวง)
  assert.ok(FB_JS.includes('AssetX addition'), 'ต้องมีส่วนเพิ่มของ AssetX (aria-label fallback)')
  assert.ok(/\(\?:Like\|ถูกใจ\):/.test(FB_JS), 'regex ยอดรีแอคชันจาก aria-label')
  assert.ok(FB_JS.indexOf('AssetX addition') < FB_JS.indexOf('const msgEl'), 'ส่วนเพิ่มอยู่ก่อนอ่านแคปชั่น (ยังอยู่ในลูปโพสต์)')
})

// ── pure functions ─────────────────────────────────────────────────────────
test('targetId: /p/<ชื่อ>-<เลข>/ ได้เลขเพจ (ต้นแบบได้ "p" ชนกันทุกเพจ) · profile.php?id · เลขล้วน · slug', () => {
  assert.equal(targetId({ url: 'https://www.facebook.com/p/Loan-DD-รับจำนองขายฝาก-ดอกเบี้ยต่ำ-61557696524403/' }), 'fb_61557696524403')
  assert.equal(targetId({ url: 'https://www.facebook.com/p/ลงทุนจำนอง-ขายฝาก-Land-for-Loan-100068212976075/' }), 'fb_100068212976075')
  assert.equal(targetId({ url: 'https://www.facebook.com/profile.php?id=61583179858522' }), 'fb_61583179858522')
  assert.equal(targetId({ url: 'https://www.facebook.com/61574180634668' }), 'fb_61574180634668')
  assert.equal(targetId({ url: 'https://www.facebook.com/Baania.Official/' }), 'fb_Baania.Official')
  assert.notEqual(targetId({ url: 'https://www.facebook.com/p/A-1' }), targetId({ url: 'https://www.facebook.com/p/B-2' }))
})

test('fbKey/fbLink: permalink.php คง story_fbid → โพสต์ต่างกันได้กุญแจต่างกัน · คลิป/รูปใช้ id · ลิงก์ตัด tracking', () => {
  const a = { perma: 'https://www.facebook.com/permalink.php?story_fbid=111&id=999&__cft__=x' }
  const b = { perma: 'https://www.facebook.com/permalink.php?story_fbid=222&id=999&__cft__=y' }
  assert.notEqual(fbKey(a), fbKey(b))
  assert.equal(fbLink(a, 'https://www.facebook.com/x'), 'https://www.facebook.com/permalink.php?story_fbid=111&id=999')
  assert.equal(fbKey({ vid: '77' }), 'v77')
  assert.equal(fbLink({ vid: '77' }), 'https://www.facebook.com/watch/?v=77')
  assert.equal(fbKey({ fbids: ['5', '6'] }), 'p5')
  assert.equal(fbLink({ fbids: ['5'] }), 'https://www.facebook.com/photo/?fbid=5')
  assert.match(fbKey({ caption: 'สวัสดี' }), /^h[0-9a-f]{14}$/)
  assert.equal(fbKey({}), null)
  assert.equal(fbLink({}, 'https://www.facebook.com/page'), 'https://www.facebook.com/page')
  assert.ok(richness({ m: { reactions: 1, comments: null }, caption: 'ab' }) > richness({ m: { reactions: null }, caption: 'abcdef' }))
})

test('mergePosts: แคปชั่นผ่านตัวลบข้อมูลบุคคลก่อนลงคลัง · ยาวกว่าหลังล้างชนะ · ป้าย Facebook/ปุ่มแปลถูกตัด · hist ไม่เกิน 30 · prune', () => {
  const store = { target: 'x', posts: {} }
  const p = { key: 'p1', format: 'photo', link: 'https://www.facebook.com/photo/?fbid=1', caption: 'Facebook\nขายฝากที่ดิน โทร 081-234-5678 LINE: @deal99\nSee original', m: { reactions: 5, comments: 1, shares: 0, views: null } }
  const seen = mergePosts(store, [p], '2026-11-01')
  assert.deepEqual(seen, ['p1'])
  const rec = store.posts.p1
  assert.equal(rec.caption, 'ขายฝากที่ดิน โทร [ลบ] [ลบ]')
  assert.ok(!/081|@deal99|Facebook|See original/.test(rec.caption))
  assert.equal(rec.first_seen, '2026-11-01')
  assert.deepEqual(rec.m0, p.m)
  // รอบถัดไป: แคปชั่นสั้นกว่าไม่ทับของเดิม · ตัวเลขอัปเดต · hist เพิ่มวัน
  mergePosts(store, [{ ...p, caption: 'ขายฝาก', m: { reactions: 9, comments: 2, shares: 1, views: null } }], '2026-11-02')
  assert.equal(store.posts.p1.caption, 'ขายฝากที่ดิน โทร [ลบ] [ลบ]')
  assert.equal(store.posts.p1.m.reactions, 9)
  assert.equal(store.posts.p1.last_seen, '2026-11-02')
  assert.deepEqual(store.posts.p1.hist, [['2026-11-01', 5, 1, 0, null], ['2026-11-02', 9, 2, 1, null]])
  mergePosts(store, [{ ...p, m: { reactions: 10, comments: 2, shares: 1, views: null } }], '2026-11-02')
  assert.equal(store.posts.p1.hist.length, 2, 'วันเดียวกันทับแถวเดิม')
  for (let i = 0; i < 40; i++) mergePosts(store, [p], `2026-12-${String((i % 28) + 1).padStart(2, '0')}`)
  assert.ok(store.posts.p1.hist.length <= 30)
  store.posts.old = { first_seen: '2026-01-01', last_seen: '2026-01-02', m: {}, caption: '' }
  assert.equal(prunePosts(store, '2026-11-03', 120), 1)
  assert.ok(!store.posts.old)
  assert.equal(cleanCaption('Facebook\nFacebook\nสวัสดี\n· Rate this translation'), 'สวัสดี')
  assert.deepEqual(tagsOf('#ขายฝาก #Land #ขายฝาก.'), ['#land', '#ขายฝาก'])
})

test('outliers: ต้องมีฐาน ≥ 4 โพสต์ · แรง ≥ 2 เท่า + eng ≥ 10 · แคปชั่นต้องผ่าน topic gate · ข้ามที่เคยเป็นไอเดีย · ≤ 2 ต่อเพจ', () => {
  const store = { posts: {} }
  const mk = (k, reactions, caption, extra = {}) => { store.posts[k] = { first_seen: '2026-11-01', caption, m: { reactions, comments: 0, shares: 0, views: null }, ...extra } }
  mk('a', 10, 'ขายฝากที่ดิน 1'); mk('b', 10, 'ขายฝากที่ดิน 2'); mk('c', 10, 'ขายฝากที่ดิน 3')
  assert.deepEqual(outliers(store, ['a', 'b', 'c'], TODAY), [], 'แค่ 3 โพสต์ ยังไม่มีฐาน')
  mk('d', 10, 'ขายฝากที่ดิน 4'); mk('hot', 50, 'โฉนดที่ดินแปลงนี้ขายฝากได้')
  const hits = outliers(store, ['a', 'b', 'c', 'd', 'hot'], TODAY)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].key, 'hot')
  assert.equal(hits[0].by, 'eng')
  assert.ok(Math.abs(hits[0].ratio - 50 / 10) < 1e-9)
  assert.equal(hits[0].base_e, 10)
  mk('offtopic', 500, 'ขอบคุณลูกค้าทุกท่าน สุขสันต์วันปีใหม่')
  assert.equal(outliers(store, ['offtopic'], TODAY).length, 0, 'ไม่มีคำอสังหาฯ ไม่เข้าคิว (กันโฆษณาเรื่องอื่นของเพจ)')
  mk('tiny', 8, 'ที่ดิน'); // 8/10 < 2 เท่า
  assert.equal(outliers(store, ['tiny'], TODAY).length, 0)
  mk('done', 90, 'ขายฝาก', { idea: '2026-11-01' })
  assert.equal(outliers(store, ['done'], TODAY).length, 0, 'เคยเข้าคิวแล้วไม่เสนอซ้ำ')
  mk('h2', 400, 'คอนโด'); mk('h3', 450, 'ทาวน์โฮม')
  const top = outliers(store, ['hot', 'h2', 'h3'], TODAY)
  assert.equal(top.length, 2, 'เพดาน 2 ต่อเพจ แรงสุดก่อน (median ขยับเป็น 30 → hot ไม่ถึง 2 เท่าแล้ว)')
  assert.deepEqual(top.map((x) => x.key), ['h3', 'h2'])
  // คลิป: เทียบวิวกับคลิป ≥ 3 ตัว
  const vs = { posts: {} }
  for (const [k, v] of [['v1', 1000], ['v2', 1200], ['v3', 900], ['v4', 1100]]) vs.posts[k] = { first_seen: TODAY, format: 'video', caption: 'ที่ดิน', m: { reactions: 1, comments: 0, shares: 0, views: v } }
  vs.posts.viral = { first_seen: TODAY, format: 'video', caption: 'ขายฝากที่ดิน', m: { reactions: 2, comments: 0, shares: 0, views: 9000 } }
  const vh = outliers(vs, ['viral'], TODAY)
  assert.equal(vh[0]?.by, 'views')
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([1, 2, 3, 4]), 2.5)
  assert.equal(eng({ reactions: 1, comments: 2, shares: 3 }), 1 + 4 + 9)
})

test('ideaRow: source social · subtype social_fb · กุญแจ sw:fb:<tid>:<key> · คะแนนในช่วงเลนอื่น (+0.3 คู่แข่ง · เพดาน 6.2) · ไม่มีเบอร์/LINE หลุด', () => {
  const target = { name: 'เพจคู่แข่ง', url: 'https://www.facebook.com/Cashpital', group: 'competitor' }
  const rec = { first_seen: '2026-11-03', format: 'photo', link: 'https://www.facebook.com/photo/?fbid=5', caption: 'รับขายฝากที่ดิน ดอกต่ำ โทร 081-234-5678\nไลน์ @cash', m: { reactions: 50, comments: 4, shares: 2, views: null } }
  const row = ideaRow(target, rec, { key: 'p5', ratio: 2.0, by: 'eng', base_e: 25, base_v: null }, TODAY, { audience: ['B'] })
  assert.equal(row.source, 'social')
  assert.equal(row.subtype, 'social_fb')
  assert.equal(row.status, 'new')
  assert.equal(row.external_key, 'sw:fb:fb_Cashpital:p5')
  assert.equal(row.source_label, 'Facebook · เพจคู่แข่ง')
  assert.equal(row.url, 'https://www.facebook.com/photo/?fbid=5')
  assert.equal(row.score, 4.9, '3.8 + 0.4×2 = 4.6 +0.3 คู่แข่ง')
  assert.deepEqual(row.audience, ['B'])
  assert.match(row.title, /^รูปแรงกว่าปกติของเพจ 2\.0 เท่า — รับขายฝากที่ดิน ดอกต่ำ โทร \[ลบ\]$/)
  assert.ok(!/081|@cash/.test(row.title + row.summary), 'เบอร์/LINE ต้องถูกลบ')
  assert.ok(row.summary.includes('❤️ 50 · 💬 4 · ↗️ 2'))
  assert.ok(row.summary.includes('โพสต์ปกติของเพจ ≈ 25 เอ็นเกจ'))
  assert.ok(row.summary.includes('เห็นครั้งแรก 3 พ.ย. 2026'))
  assert.ok(row.summary.includes('กลุ่มเพจ: คู่แข่ง'))
  const media = ideaRow({ name: 'สื่อ', url: 'https://www.facebook.com/M', group: 'media' }, { ...rec, format: 'video' }, { key: 'v1', ratio: 9, by: 'views', base_e: 5, base_v: 1000 }, TODAY)
  assert.equal(media.score, 6.2, 'เพดาน 6.2 ไม่แซงเลนทางการ')
  assert.ok(media.summary.includes('คลิปปกติของเพจ ≈ 1K วิว'))
  assert.equal(media.audience, null)
  assert.ok(media.title.startsWith('คลิปแรงกว่าปกติของเพจ 9.0 เท่า'))
  const weird = ideaRow({ name: 'x', url: 'https://www.facebook.com/x', group: 'shop' }, rec, { key: 'k', ratio: 2, by: 'eng', base_e: 1 }, TODAY)
  assert.ok(weird.summary.includes('กลุ่มเพจ: สื่อ'), 'group ที่ไม่รู้จักตกไปใช้คำใบ้ของ media')
  assert.equal(weird.score, 4.6)
})

test('dueTargets: ค้างนานสุดก่อน · ไม่เคยเยี่ยมก่อน · every_days · enabled:false ข้าม · จำกัดจำนวน', () => {
  const ts = [
    { name: 'a', url: 'https://www.facebook.com/a', every_days: 4 },
    { name: 'b', url: 'https://www.facebook.com/b', every_days: 7 },
    { name: 'c', url: 'https://www.facebook.com/c', every_days: 4, enabled: false },
    { name: 'd', url: 'https://www.facebook.com/d', every_days: 4 },
  ]
  const visits = { fb_a: '2026-10-25', fb_b: '2026-11-01' } // a เลยรอบ 5 วัน · b ยังไม่ถึง · d ไม่เคย
  assert.deepEqual(dueTargets(ts, visits, TODAY, 4).map((t) => t.name), ['d', 'a'])
  assert.deepEqual(dueTargets(ts, visits, TODAY, 1).map((t) => t.name), ['d'])
  assert.deepEqual(dueTargets(ts, { fb_a: '2026-10-30', fb_b: TODAY, fb_d: '2026-10-29' }, TODAY, 4).map((t) => t.name), ['d', 'a'], 'd ค้าง 5 วัน > a ค้าง 4')
  assert.deepEqual(dueTargets(ts, { fb_a: '2026-10-30', fb_d: '2026-10-29' }, TODAY, 4).map((t) => t.name), ['b', 'd', 'a'], 'ไม่เคยเยี่ยมมาก่อนทุกเพจ')
  assert.deepEqual(dueTargets(ts, { fb_a: TODAY, fb_b: TODAY, fb_d: TODAY }, TODAY, 4), [])
})

test('quotaLeft: min(12 − รวมทุกโปรเจกต์, 4 − ของ assetx) · แถวสรุป (pages ว่าง) ไม่นับ', () => {
  const rows = [
    { project: 'dvx', date: TODAY, pages: { facebook: 6 } },
    { project: 'dvx', date: TODAY, pages: {}, opened: { facebook: 6 } },
    { project: 'assetx', date: TODAY, pages: { facebook: 1 } },
    { project: 'assetx', date: '2026-11-02', pages: { facebook: 4 } },
  ]
  assert.deepEqual(quotaLeft({ rows, today: TODAY }), { left: 3, total: 7, own: 1 })
  assert.equal(quotaLeft({ rows: [{ project: 'dvx', date: TODAY, pages: { facebook: 12 } }], today: TODAY }).left, 0)
  assert.equal(quotaLeft({ rows: [], today: TODAY }).left, 4)
})

// ── OpenCLI wrapper ────────────────────────────────────────────────────────
test('createOc: เรียก node main.js ตรง ๆ จากโฟลเดอร์บ้าน · ตอบไม่ใช่ JSON / ok:false / หมดเวลา = WatchError · ต้องถือกุญแจก่อน (beat) ยกเว้น beat:false', async () => {
  const mainJs = fileURLToPath(import.meta.url) // ไฟล์ที่มีอยู่จริง แทน OpenCLI
  const seen = []
  const mk = (stdout, err = null) => (file, args, opts, cb) => { seen.push({ file, args, opts }); cb(err, stdout, '') }
  const base = tmp('oc-')
  const lock = new Lock('assetx', { base })
  const oc = createOc({ lock, mainJs, execFileImpl: mk('{"ok":true,"data":{"result":{"x":1}}}') })
  await assert.rejects(oc(['profile', 'list']), LostLock, 'ไม่ได้ถือกุญแจ = ห้ามใช้ browser')
  assert.equal(seen.length, 0)
  lock.tryAcquire()
  assert.deepEqual(unwrap(await oc(['profile', 'list'])), { x: 1 })
  assert.equal(seen[0].file, process.execPath)
  assert.deepEqual(seen[0].args, [mainJs, 'profile', 'list'])
  assert.equal(seen[0].opts.cwd, os.homedir())
  assert.equal(seen[0].opts.windowsHide, true)
  await assert.rejects(createOc({ lock, mainJs, execFileImpl: mk('Error: boom') })(['browser', 'open', 'u']), (e) => e instanceof WatchError && /ไม่ใช่ JSON/.test(e.message))
  await assert.rejects(createOc({ lock, mainJs, execFileImpl: mk('{"ok":false,"error":{"message":"no bridge"}}') })(['browser', 'open', 'u']), /no bridge/)
  await assert.rejects(createOc({ lock, mainJs, execFileImpl: mk('', Object.assign(new Error('t'), { killed: true })) })(['browser', 'eval', 'x'], { timeoutMs: 1500 }), /ช้าเกิน 2 วิ/)
  lock.release()
  // beat:false (ใช้ตอน browser close) ไม่ต้องถือกุญแจ
  const r = await createOc({ lock, mainJs, execFileImpl: mk('{"ok":true}') })(['browser', 'close'], { beat: false })
  assert.equal(r.ok, true)
  await assert.rejects(createOc({ mainJs: path.join(base, 'missing.js'), execFileImpl: mk('{}') })(['profile', 'list']), /ไม่พบ OpenCLI/)
})

test('readFacebookPage: เปิด → eval/เลื่อนทุกจอ → รวมโพสต์ซ้ำเอาชุดที่รวยกว่า · หยุดเมื่อครบ fb_max_posts หรือ 3 รอบไม่มีใหม่ · เจอ blocked โยน Blocked', async () => {
  const lockRef = {}
  let evals = 0
  const oc = fakeOc({ lockRef, posts: () => { evals += 1; return evals === 1 ? [domPost(1, 1, 'ที่ดิน'), { ...domPost(2, 2, 'สั้น'), m: { reactions: null, comments: null, shares: null, views: null } }] : [{ ...domPost(2, 2, 'ยาวกว่าและมีตัวเลขครบ'), m: { reactions: 2, comments: 1, shares: 0, views: null } }] } })
  const posts = await readFacebookPage({ target: TARGETS[0], cfg: { fb_scroll_steps: 10, fb_max_posts: 12 }, oc, sleep: noSleep, random: () => 0 })
  assert.equal(posts.length, 2)
  assert.equal(posts[1].caption, 'ยาวกว่าและมีตัวเลขครบ', 'ชุดที่รวยกว่าชนะ')
  assert.equal(posts[1].m.comments, 1)
  assert.equal(posts[0].link, 'https://www.facebook.com/photo/?fbid=900001')
  assert.equal(posts[0].posted, null, 'FB ซ่อนเวลาโพสต์ → ใช้ first_seen แทน')
  const evalCalls = oc.calls.filter((c) => c.args[1] === 'eval')
  assert.equal(evalCalls.length, 4, 'จอแรกได้ 2 · อีก 3 จอไม่มีโพสต์ใหม่แล้วหยุด')
  for (const c of oc.calls.filter((x) => x.args[0] === 'browser')) {
    assert.deepEqual(c.args.slice(-6), ['--session', 'assetxwatch', '--window', 'background', '--profile', 'research'])
  }
  assert.equal(evalCalls[0].args[2], FB_JS, 'ส่ง FB_JS ต้นฉบับทั้งก้อน')
  await assert.rejects(readFacebookPage({ target: TARGETS[0], cfg: {}, oc: fakeOc({ lockRef, blocked: 'checkpoint' }), sleep: noSleep }), Blocked)
})

// ── รอบเต็ม (ข้อตกลง 4.6) ─────────────────────────────────────────────────
test('รอบปกติ: ถือ/ปล่อยกุญแจ · จดทีละเพจก่อนเปิด + แถวสรุป · ปิดแค่ session assetxwatch (beat:false) · เยี่ยมแล้ว · ไอเดียเมื่อแรงกว่าฐาน', async () => {
  // เพจ B ได้ 3 โพสต์ (ไม่ต่ำกว่าเกณฑ์ 3 · แต่ยังไม่ถึงฐาน 4 → ไม่มีไอเดีย)
  const h = harness({ posts: (url) => (/TestPageB/.test(url) ? fixturePosts().slice(0, 3) : fixturePosts()) })
  // เพจ A มีฐาน 4 โพสต์เก่าในคลังแล้ว → โพสต์ 60 รีแอคชันแรง 5 เท่า
  const tidA = targetId(TARGETS[0])
  const seed = { target: 'เพจทดสอบ A', posts: {} }
  for (let i = 1; i <= 3; i++) seed.posts[`p${900000 + i}`] = { first_seen: '2026-10-28', last_seen: '2026-10-28', caption: `ขายฝากที่ดิน ${i}`, format: 'photo', m: { reactions: 10 + i, comments: 0, shares: 0, views: null }, hist: [] }
  seed.posts.pold = { first_seen: '2026-10-28', last_seen: '2026-10-28', caption: 'ที่ดินเก่า', format: 'photo', m: { reactions: 12, comments: 0, shares: 0, views: null }, hist: [] }
  fs.mkdirSync(path.dirname(pageStorePath(h.storeDir, tidA)), { recursive: true })
  fs.writeFileSync(pageStorePath(h.storeDir, tidA), JSON.stringify(seed))

  const out = await h.run()
  assert.equal(out.status, 'ok')
  assert.deepEqual(out.result, [])
  assert.equal(out.opened.facebook, 2)
  assert.equal(out.pages.length, 2)
  assert.ok(!fs.existsSync(path.join(h.base, 'lock.json')), 'ปล่อยกุญแจแล้ว')
  const rows = usageRows(h.base)
  assert.equal(rows.length, 3)
  assert.deepEqual(rows.slice(0, 2).map((r) => [r.project, r.date, r.pages.facebook, r.result]), [['assetx', TODAY, 1, 'open'], ['assetx', TODAY, 1, 'open']])
  assert.deepEqual([rows[2].pages, rows[2].opened, rows[2].result], [{}, { facebook: 2 }, 'ok'])
  assert.ok(!fs.existsSync(path.join(h.base, 'state.json')), 'อ่านสำเร็จโดยไม่มีแถวพัก = ไม่เขียน state.json')
  // ลำดับคำสั่ง: profile list → เปิด/eval/เลื่อน ×2 เพจ → close ท้ายสุด beat:false
  assert.deepEqual(h.oc.calls[0].args, ['profile', 'list'])
  const last = h.oc.calls.at(-1)
  assert.deepEqual(last.args, ['browser', 'close', '--session', SESSION, '--profile', 'research'])
  assert.equal(last.beat, false)
  assert.equal(closeCalls(h.oc).length, 1)
  assert.equal(openCalls(h.oc).length, 2)
  const allowed = new Set(['profile list', 'daemon restart', 'browser open', 'browser eval', 'browser scroll', 'browser close'])
  for (const c of h.oc.calls) assert.ok(allowed.has(c.args.slice(0, 2).join(' ')), `คำสั่งนอกรายการอ่านอย่างเดียว: ${c.args.slice(0, 2).join(' ')}`)
  // สถานะของเรา
  const state = JSON.parse(fs.readFileSync(path.join(h.storeDir, 'state.json'), 'utf8'))
  assert.deepEqual(state.visits, { [tidA]: TODAY, [targetId(TARGETS[1])]: TODAY })
  assert.equal(state.last_round.status, 'ok')
  const storeA = JSON.parse(fs.readFileSync(pageStorePath(h.storeDir, tidA), 'utf8'))
  assert.equal(Object.keys(storeA.posts).length, 5)
  assert.equal(storeA.posts.p900004.caption, 'ขายฝากที่ดินโทร [ลบ] [ลบ]', 'แคปชั่นในคลังผ่านตัวลบข้อมูลบุคคล')
  assert.equal(out.rows.length, 1, 'เพจ A มีฐาน → โพสต์ 60 แรง · เพจ B ยังไม่มีฐาน (3 โพสต์)')
  assert.equal(out.rows[0].row.external_key, `sw:fb:${tidA}:p900004`)
  assert.equal(out.rows[0].row.source, 'social')
  assert.ok(!/081-234|@landdeal/.test(JSON.stringify(out.rows[0].row)))
  assert.equal(out.pages[1].posts, 3)
  assert.equal(out.pages[1].new, 3)
  assert.equal(out.pages[1].hits, 0)
  assert.equal(out.pages[1].low, false)
})

test('เจอ checkpoint: เขียนแถวพักร่วม by=assetx · หยุดเลนทันที · แถวสรุปบอก blocked:facebook · ไม่นับว่าเยี่ยม', async () => {
  const h = harness({ blocked: 'checkpoint' })
  const out = await h.run()
  assert.equal(out.status, 'blocked')
  assert.deepEqual(out.result, ['blocked:facebook'])
  const st = readState(h.base)
  assert.equal(st.blocked.facebook.by, 'assetx')
  assert.equal(st.blocked.facebook.at, TODAY)
  assert.match(st.blocked.facebook.why, /checkpoint/)
  assert.equal(st.updated_by, 'assetx')
  const rows = usageRows(h.base)
  assert.equal(rows.length, 2, 'เปิดเพจแรกเพจเดียวแล้วหยุด + แถวสรุป')
  assert.equal(rows[0].result, 'open')
  assert.equal(rows[1].result, 'blocked:facebook')
  assert.deepEqual(rows[1].opened, { facebook: 1 })
  assert.equal(openCalls(h.oc).length, 1)
  assert.equal(closeCalls(h.oc).length, 1)
  assert.ok(!fs.existsSync(path.join(h.base, 'lock.json')))
  assert.deepEqual(out.visited, [])
  const state = JSON.parse(fs.readFileSync(path.join(h.storeDir, 'state.json'), 'utf8'))
  assert.deepEqual(state.visits, {})
  // รอบถัดไป (วันเดียวกันของเรา = ข้ามด้วย already_today อยู่แล้ว) → ลองวันถัดไป: แถวพักยังไม่ครบ 3 วัน = ไม่เปิด
  const next = await h.run({ deps: { ...h.deps, today: '2026-11-05' } })
  assert.equal(next.status, 'blocked_shared')
  assert.equal(openCalls(h.oc).length, 1, 'ไม่เปิดเพจเพิ่ม')
})

test('อีกฝั่ง (DVX) ตั้งพักไว้ → ไม่รอกุญแจ ไม่เปิดเพจ ไม่จดอะไร · ครบ 3 วันแล้วอ่านสำเร็จ = ล้างแถวพัก', async () => {
  const h = harness()
  const dvx = new Lock('dvx', { base: h.base })
  dvx.tryAcquire()
  dvx.setBlocked('facebook', 'Facebook ขอ checkpoint (จาก DVX)', '2026-11-02')
  dvx.release()
  const out = await h.run()
  assert.equal(out.status, 'blocked_shared')
  assert.equal(h.oc.calls.length, 0)
  assert.equal(usageRows(h.base).length, 0)
  assert.ok(!fs.existsSync(path.join(h.base, 'lock.json')))
  assert.match(out.lines[0], /dvx/)
  // 3 วันผ่านไป → อ่านได้ → clearBlocked (เขียนเฉพาะตอนมีแถว)
  const h2 = harness()
  const d2 = new Lock('dvx', { base: h2.base })
  d2.tryAcquire(); d2.setBlocked('facebook', 'เก่า', '2026-10-30'); d2.release()
  const out2 = await h2.run()
  assert.equal(out2.status, 'ok')
  assert.deepEqual(readState(h2.base).blocked, {})
  assert.equal(readState(h2.base).updated_by, 'assetx')
})

test('โควตา: บัญชีร่วมเปิดครบ 12 → ไม่รอกุญแจ · AssetX อ่านแล้ววันนี้ → ข้าม (รอบสำรอง) · เหลือ 1 → อ่านแค่ 1', async () => {
  const h = harness()
  fs.writeFileSync(path.join(h.base, 'usage.jsonl'), `${JSON.stringify({ project: 'dvx', date: TODAY, pages: { facebook: 12 }, result: 'open' })}\n`)
  const out = await h.run()
  assert.equal(out.status, 'quota_full')
  assert.equal(h.oc.calls.length, 0)
  assert.equal(usageRows(h.base).length, 1, 'ไม่จดอะไรเพิ่ม')

  const h2 = harness()
  fs.writeFileSync(path.join(h2.base, 'usage.jsonl'), `${JSON.stringify({ project: 'assetx', date: TODAY, pages: { facebook: 1 }, result: 'open' })}\n`)
  const out2 = await h2.run()
  assert.equal(out2.status, 'already_today')
  assert.equal(h2.oc.calls.length, 0)

  const h3 = harness()
  fs.writeFileSync(path.join(h3.base, 'usage.jsonl'), `${JSON.stringify({ project: 'dvx', date: TODAY, pages: { facebook: 11 }, result: 'open' })}\n`)
  const out3 = await h3.run()
  assert.equal(out3.status, 'ok')
  assert.equal(out3.opened.facebook, 1, 'เหลือโควตา 1 → อ่านเพจเดียว')
  assert.equal(out3.picked, 1)
})

test('browser ไม่ว่าง (DVX ถือกุญแจสด) → รอตาม wait_minutes แล้วข้าม บอกว่าใครถือ · ไม่แตะ browser', async () => {
  const h = harness()
  const dvx = new Lock('dvx', { base: h.base, purpose: 'social_watch' })
  dvx.tryAcquire()
  const out = await h.run()
  assert.equal(out.status, 'browser_busy')
  assert.equal(out.holder.project, 'dvx')
  assert.equal(h.oc.calls.length, 0)
  assert.equal(usageRows(h.base).length, 0)
  assert.equal(new Lock('x', { base: h.base }).holder().project, 'dvx', 'ไม่ลบกุญแจของคนอื่น')
  dvx.release()
})

test('กุญแจหลุดกลางรอบ (อีกฝั่งยึดไป): หยุดอ่านทันที · เพจที่จดก่อนเปิดยังนับ · ไม่มีแถวสรุป · ปล่อยได้ไม่โยน · ยังสั่งปิด session ของเรา', async () => {
  const h = harness({
    onOpen: (url) => {
      if (/TestPageB/.test(url)) {
        // จำลองว่ากุญแจของเราค้างแล้ว DVX ยึดไป (ลบของเรา สร้างของเขา)
        fs.unlinkSync(path.join(h.base, 'lock.json'))
        new Lock('dvx', { base: h.base }).tryAcquire()
      }
    },
  })
  const out = await h.run()
  assert.equal(out.status, 'lost_lock')
  assert.deepEqual(out.result, ['lost_lock'])
  const rows = usageRows(h.base)
  assert.equal(rows.length, 2, 'เปิด 2 เพจ (จดก่อนเปิด) · ไม่มีแถวสรุป')
  assert.ok(rows.every((r) => r.result === 'open'))
  assert.equal(new Lock('x', { base: h.base }).holder().project, 'dvx', 'ห้ามลบกุญแจของคนอื่นตอนปล่อย')
  assert.equal(closeCalls(h.oc).length, 1, 'ยังสั่งปิด session assetxwatch (beat:false)')
  assert.equal(out.pages.length, 2)
  assert.equal(out.pages[0].posts, 4, 'เพจแรกอ่านจบและเก็บไว้')
  assert.deepEqual(out.visited, [targetId(TARGETS[0])])
})

test('หมดงบเวลา: ไม่เปิดเพจใหม่หลัง no_new_page_sec · ที่เหลือไม่นับว่าเยี่ยม · แถวสรุป result=budget', async () => {
  const h = harness()
  const out = await h.run({ cfg: { ...CFG, shared_browser: { wait_minutes: 0, no_new_page_sec: 5, no_reread_sec: 6 } } })
  assert.equal(out.status, 'ok')
  assert.deepEqual(out.result, ['budget'])
  assert.equal(out.opened.facebook, 1)
  assert.equal(openCalls(h.oc).length, 1)
  const rows = usageRows(h.base)
  assert.equal(rows.length, 2)
  assert.equal(rows[1].result, 'budget')
  assert.deepEqual(out.visited, [targetId(TARGETS[0])])
  assert.ok(out.lines.some((l) => /หมดงบเวลา/.test(l)))
})

test('ได้น้อยผิดปกติ (< 3 โพสต์): เปิดใหม่ 1 ครั้งถ้ายังอยู่ในงบ · ยังน้อย = ไม่นับว่าเยี่ยม · โควตานับครั้งเดียว', async () => {
  const h = harness({ posts: () => [domPost(1, 5, 'ที่ดิน')] })
  const out = await h.run({ targets: [TARGETS[0]] })
  assert.equal(out.status, 'ok')
  assert.equal(openCalls(h.oc).length, 2, 'เปิดซ้ำ 1 ครั้ง')
  assert.equal(out.pages[0].low, true)
  assert.deepEqual(out.visited, [])
  const rows = usageRows(h.base)
  assert.equal(rows.filter((r) => r.result === 'open').length, 1, 'เปิดซ้ำเพจเดิมไม่จดเพิ่ม')
  assert.equal(rows.at(-1).opened.facebook, 1)
  // หมดงบเปิดซ้ำ → ไม่เปิดใหม่ ติด budget
  const h2 = harness({ posts: () => [domPost(1, 5, 'ที่ดิน')] })
  const out2 = await h2.run({ targets: [TARGETS[0]], cfg: { ...CFG, shared_browser: { wait_minutes: 0, no_new_page_sec: 300, no_reread_sec: 1 } } })
  assert.equal(openCalls(h2.oc).length, 1)
  assert.deepEqual(out2.result, ['budget'])
  assert.equal(out2.pages[0].low, true)
})

test('bridge ไม่ต่อ: เปิด Chrome ให้เอง (ไม่มีหน้าต่าง) แล้วรอ · ยังไม่ต่อ = bridge_down ไม่เปิดเพจ · แถวสรุปจดไว้ · ไม่ฆ่า Chrome', async () => {
  let spawned = 0
  const h = harness({ connected: false }, { deps: { spawnChrome: (dir) => { spawned += 1; assert.equal(dir, 'Profile 9'); return true } } })
  const out = await h.run()
  assert.equal(out.status, 'bridge_down')
  assert.deepEqual(out.result, ['bridge_down'])
  assert.equal(spawned, 1)
  assert.equal(openCalls(h.oc).length, 0)
  const lists = h.oc.calls.filter((c) => c.args[0] === 'profile')
  assert.ok(lists.length >= 2 && lists.length <= 17, `ถาม profile list ซ้ำทุก 4 วิ ไม่เกิน 60 วิ (ได้ ${lists.length})`)
  const rows = usageRows(h.base)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].result, 'bridge_down')
  assert.deepEqual(rows[0].pages, {})
  assert.ok(!fs.existsSync(path.join(h.base, 'lock.json')))
  // ไม่พบ chrome.exe → ไม่รอ
  const h2 = harness({ connected: false })
  const out2 = await h2.run()
  assert.equal(out2.status, 'bridge_down')
  assert.equal(h2.oc.calls.filter((c) => c.args[0] === 'profile').length, 1)
})

test('daemon ของ OpenCLI ไม่ได้รัน (เครื่องเพิ่งเปิด) → สั่ง daemon restart แล้วรอ ส่วนเสริมต่อเอง · ไม่ต้องเปิด Chrome', async () => {
  let restarted = false
  const h = harness({
    daemonRunning: (calls) => calls.some((c) => c.args[0] === 'daemon'),
    connected: (calls) => calls.some((c) => c.args[0] === 'daemon'),
  }, { deps: { spawnChrome: () => { throw new Error('ไม่ควรเปิด Chrome เมื่อ daemon กลับมาแล้ว') } } })
  h.oc.calls.push = function (c) { if (c.args[0] === 'daemon') restarted = true; return Array.prototype.push.call(this, c) }
  const out = await h.run()
  assert.equal(out.status, 'ok')
  assert.equal(restarted, true)
  assert.deepEqual(h.oc.calls.filter((c) => c.args[0] === 'daemon').map((c) => c.args), [['daemon', 'restart']])
  assert.ok(h.oc.calls.filter((c) => c.args[0] === 'daemon').every((c) => c.beat), 'daemon restart ทำใต้กุญแจ (แตะสัญญาณชีพ)')
  assert.equal(out.opened.facebook, 2)
  assert.ok(out.lines.some((l) => /daemon ไม่ได้รัน/.test(l)))
  assert.ok(out.lines.some((l) => /daemon กลับมาแล้ว/.test(l)))
  // daemon รันอยู่แต่ส่วนเสริมไม่ต่อ → ไม่สั่ง restart (ไม่รบกวน daemon ที่อีกฝั่งอาจใช้) → ไปทางเปิด Chrome
  const h2 = harness({ connected: false, daemonRunning: true })
  const out2 = await h2.run()
  assert.equal(out2.status, 'bridge_down')
  assert.equal(h2.oc.calls.filter((c) => c.args[0] === 'daemon').length, 0)
})

test('dry-run: ยังถือกุญแจ + จด usage.jsonl ของร่วม แต่ไม่เขียนคลัง/สถานะของเรา · ยังคืน rows ให้ดู', async () => {
  const h = harness()
  const out = await h.run({ dryRun: true })
  assert.equal(out.status, 'ok')
  assert.equal(usageRows(h.base).length, 3)
  assert.equal(h.lockRef.lock.purpose, 'facebook_watch --dry-run')
  assert.ok(!fs.existsSync(path.join(h.storeDir, 'state.json')))
  assert.ok(!fs.existsSync(path.join(h.storeDir, 'facebook')))
  assert.deepEqual(out.visited, [])
  assert.equal(out.pages.length, 2)
})

test('--target (เจ้าของสั่ง): กรองชื่อเพจ ไม่สนรอบ ไม่สนว่าวันนี้อ่านแล้ว แต่ยังเคารพแถวพัก/เพดาน 12/4 (ข้อตกลง 4.7)', async () => {
  const h = harness()
  fs.writeFileSync(path.join(h.storeDir, 'state.json'), JSON.stringify({ visits: { [targetId(TARGETS[1])]: TODAY } }))
  fs.writeFileSync(path.join(h.base, 'usage.jsonl'), `${JSON.stringify({ project: 'assetx', date: TODAY, pages: { facebook: 1 }, result: 'open' })}\n`)
  const out = await h.run({ targetFilter: 'ทดสอบ B' })
  assert.equal(out.status, 'ok', 'อ่านแล้ววันนี้ 1 เพจ แต่เจ้าของสั่ง --target ยังอ่านได้ (เหลือโควตา 3)')
  assert.deepEqual(out.pages.map((p) => p.name), ['เพจทดสอบ B'])
  assert.equal(usageRows(h.base).filter((r) => r.result === 'open').length, 2)
  assert.ok(out.lines.some((l) => /ตามคำสั่งเจ้าของ/.test(l)))
  // ส่วนของ AssetX ครบ 4 แล้ว → --target ก็ไม่อ่าน
  const h4 = harness()
  fs.writeFileSync(path.join(h4.base, 'usage.jsonl'), `${JSON.stringify({ project: 'assetx', date: TODAY, pages: { facebook: 4 }, result: 'open' })}\n`)
  assert.equal((await h4.run({ targetFilter: 'ทดสอบ' })).status, 'quota_full')
  assert.equal(h4.oc.calls.length, 0)
  const hb = harness()
  const dvx = new Lock('dvx', { base: hb.base }); dvx.tryAcquire(); dvx.setBlocked('facebook', 'checkpoint', TODAY); dvx.release()
  assert.equal((await hb.run({ targetFilter: 'ทดสอบ' })).status, 'blocked_shared', '--target ไม่ข้ามแถวพักร่วม')
  const h2 = harness()
  fs.writeFileSync(path.join(h2.base, 'usage.jsonl'), `${JSON.stringify({ project: 'dvx', date: TODAY, pages: { facebook: 12 } })}\n`)
  assert.equal((await h2.run({ targetFilter: 'ทดสอบ' })).status, 'quota_full')
  const h3 = harness()
  assert.equal((await h3.run({ targetFilter: 'ไม่มีเพจนี้' })).status, 'no_due')
  assert.equal(h3.oc.calls.length, 0)
})

test('อ่านเพจหนึ่งล้ม (OpenCLI ตอบไม่ใช่ JSON) = ข้ามเพจนั้น ไปต่อ · ไม่พักเลน · ไอเดียเพจอื่นยังได้', async () => {
  const h = harness({ onOpen: (url) => { if (/TestPageA/.test(url)) throw new WatchError('OpenCLI ตอบไม่ใช่ JSON (browser open): garbage') } })
  const out = await h.run()
  assert.equal(out.status, 'ok')
  assert.equal(out.pages[0].fail?.includes('ไม่ใช่ JSON'), true)
  assert.equal(out.pages[1].posts, 4)
  assert.deepEqual(readState(h.base).blocked, {})
  assert.equal(usageRows(h.base).length, 3, 'เพจที่ล้มก็นับว่าเปิดแล้ว (จดก่อนเปิด)')
  assert.deepEqual(out.visited, [targetId(TARGETS[1])])
  assert.equal(out.warnings.length, 1)
})

test('DEFAULTS ตรงกับข้อตกลง: เพดานรวม 12 · AssetX 4 · ถือกุญแจ ≤ ~7 นาที · session assetxwatch', () => {
  assert.equal(DEFAULTS.shared_browser.daily_cap.facebook, 12)
  assert.equal(DEFAULTS.shared_browser.own_daily_cap.facebook, 4)
  assert.equal(DEFAULTS.shared_browser.no_new_page_sec, 300)
  assert.equal(DEFAULTS.shared_browser.no_reread_sec, 360)
  assert.equal(DEFAULTS.shared_browser.wait_minutes, 20)
  assert.equal(DEFAULTS.max_targets_per_run.facebook, 4)
  assert.equal(SESSION, 'assetxwatch')
  const cfg = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'research', 'social_watch.json'), 'utf8'))
  assert.equal(cfg.session, 'assetxwatch')
  assert.deepEqual(cfg.shared_browser.daily_cap, { facebook: 12 })
  assert.deepEqual(cfg.shared_browser.own_daily_cap, { facebook: 4 })
  assert.ok(cfg.shared_browser.no_new_page_sec <= 300 && cfg.shared_browser.no_reread_sec <= 360)
  const pages = cfg.facebook.filter((t) => t.enabled !== false)
  assert.ok(pages.length >= 15 && pages.length <= 20, `คัดเพจหลัก 15–20 (มี ${pages.length})`)
  const perDay = pages.reduce((n, t) => n + 1 / Number(t.every_days), 0)
  assert.ok(perDay <= 4, `ภาระต่อวัน ${perDay.toFixed(2)} ต้องไม่เกินโควตา 4`)
  for (const t of pages) {
    assert.ok(['competitor', 'media', 'official', 'community'].includes(t.group), `${t.name}: group ${t.group} ไม่รู้จัก`)
    assert.ok(Number(t.every_days) >= 3 && Number(t.every_days) <= 7, `${t.name}: every_days ${t.every_days}`)
    assert.match(t.url, /^https:\/\/www\.facebook\.com\//)
    assert.ok(!/\d{9,10}/.test(t.url.split('/p/')[0].replace(/\d{12,}/g, '')), `${t.name}: URL ไม่ควรมีเบอร์โทร`)
  }
  const ids = pages.map(targetId)
  assert.equal(new Set(ids).size, ids.length, 'รหัสเพจต้องไม่ซ้ำกัน')
  assert.ok(!JSON.stringify(cfg).includes('@gmail') && !/password|รหัสผ่าน:/i.test(JSON.stringify(cfg)), 'ห้ามมีอีเมล/รหัสบัญชีสำรอง')
})

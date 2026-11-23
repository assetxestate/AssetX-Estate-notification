import test from 'node:test'
import assert from 'node:assert/strict'
import { SIGNATURE_SERIES, assignSeries, findSeries, nextEpisodeNo, normalizeCustomSeries, repeatedEpisode, seriesList, seriesOverview } from './marketingSeries.js'

// ข้อมูลสมมติทั้งหมด
const post = (id, over = {}) => ({ id, contentNo: id, title: `ตอน ${id}`, caption: `เนื้อหาของโพสต์หมายเลข ${id} เรื่องที่ไม่ซ้ำกับใคร`, status: 'pending', ...over })

test('ซีรีส์ตั้งต้นมี 7 ชุด รหัสไม่ซ้ำ และซีรีส์ของเจ้าของต่อท้าย (ที่พักไว้ไม่อยู่ในตัวเลือก)', () => {
  assert.equal(SIGNATURE_SERIES.length, 7)
  assert.equal(new Set(SIGNATURE_SERIES.map((series) => series.id)).size, 7)
  const custom = [{ id: 'custom-a', name: 'ถามตอบหลังไมค์', thesis: 'คำถามที่เจอบ่อย' }, { id: 'custom-b', name: 'พักแล้ว', thesis: 'x', paused: true }]
  assert.deepEqual(seriesList(custom).slice(7).map((series) => series.id), ['custom-a'])
  assert.equal(seriesList(custom, { includePaused: true }).length, 9)
  assert.equal(findSeries('custom-b', custom).name, 'พักแล้ว')
  assert.equal(findSeries('nope', custom), null)
})

test('เพิ่มซีรีส์เอง: ต้องมีชื่อและเรื่องที่เล่า และชื่อไม่ซ้ำ', () => {
  assert.equal(normalizeCustomSeries({}).ok, false)
  const ok = normalizeCustomSeries({ name: '  ถามตอบหลังไมค์ ', thesis: 'คำถามที่เจ้าของทรัพย์ถามบ่อย' })
  assert.equal(ok.ok, true)
  assert.equal(ok.value.name, 'ถามตอบหลังไมค์')
  assert.match(ok.value.id, /^custom-/)
  assert.match(normalizeCustomSeries({ name: 'ราคานี้มาจากไหน?', thesis: 'ซ้ำ' }, SIGNATURE_SERIES).errors.join(), /มีซีรีส์ชื่อนี้แล้ว/)
})

test('เลขตอน: ต่อจากเลขสูงสุด ไม่เลื่อนเมื่อตอนก่อนถูกพัก และเลือกซีรีส์เดิมซ้ำได้เลขเดิม', () => {
  const posts = [post(1, { seriesId: 'where-price', episodeNo: 1 }), post(2, { seriesId: 'where-price', episodeNo: 2, status: 'archived' }), post(3, { seriesId: 'deal-desk', episodeNo: 1 }), post(4)]
  assert.equal(nextEpisodeNo(posts, 'where-price'), 3)
  assert.deepEqual(assignSeries(posts[3], 'where-price', posts), { seriesId: 'where-price', episodeNo: 3 })
  assert.deepEqual(assignSeries(posts[0], 'where-price', posts), { seriesId: 'where-price', episodeNo: 1 })
  assert.deepEqual(assignSeries(posts[0], 'deal-desk', posts), { seriesId: 'deal-desk', episodeNo: 2 })
  assert.deepEqual(assignSeries(posts[0], '', posts), { seriesId: null, episodeNo: null })
  assert.deepEqual(assignSeries(post(9), 'real-news', posts), { seriesId: 'real-news', episodeNo: 1 })
})

test('ตอนใหม่ที่เนื้อหาหรือพาดหัวคล้ายตอนก่อน → เตือนพร้อมเลขตอน · มุมใหม่ไม่เตือน', () => {
  const first = post(1, { seriesId: 'where-price', episodeNo: 1, title: 'ราคาตั้งขายไม่ใช่ราคาที่ขายได้', caption: 'ราคาบนป้ายประกาศคือราคาที่เจ้าของอยากได้ ยังไม่ใช่ราคาที่มีคนจ่ายจริง จึงใช้เป็นมูลค่าหลักประกันตรง ๆ ไม่ได้' })
  const copy = post(2, { seriesId: 'where-price', episodeNo: 2, title: 'ราคาป้ายกับราคาจริง', caption: first.caption })
  const retitled = post(3, { seriesId: 'where-price', episodeNo: 3, title: 'ราคาตั้งขายไม่ใช่ราคาที่ขายได้', caption: 'ราคาประเมินราชการใช้คิดค่าธรรมเนียม ไม่ได้บอกว่าตลาดยอมจ่ายเท่าไร' })
  const fresh = post(4, { seriesId: 'where-price', episodeNo: 4, title: 'ราคาประเมินราชการใช้ทำอะไร', caption: 'ราคาประเมินราชการใช้คิดค่าธรรมเนียม ไม่ได้บอกว่าตลาดยอมจ่ายเท่าไร' })
  assert.match(repeatedEpisode(copy, [first, copy]), /เนื้อหาคล้ายกับตอนที่ 1 \(#1\)/)
  assert.match(repeatedEpisode(retitled, [first, retitled]), /พาดหัวคล้ายกับตอนที่ 1/)
  assert.equal(repeatedEpisode(fresh, [first, fresh]), null)
  assert.equal(repeatedEpisode(post(5), [first]), null)
  // ตอนที่พักไว้ไม่เอามาเทียบ
  assert.equal(repeatedEpisode(copy, [{ ...first, status: 'archived' }, copy]), null)
})

test('สรุปต่อซีรีส์: จำนวนตอน ตอนที่โพสต์แล้ว และวันที่โพสต์ล่าสุด', () => {
  const posts = [post(1, { seriesId: 'where-price', episodeNo: 1, status: 'posted', postedAt: '2026-11-10T03:00:00Z' }), post(2, { seriesId: 'where-price', episodeNo: 2, status: 'posted', postedAt: '2026-11-17T03:00:00Z' }), post(3, { seriesId: 'where-price', episodeNo: 3 })]
  const row = seriesOverview(posts).find((series) => series.id === 'where-price')
  assert.equal(row.total, 3)
  assert.equal(row.posted, 2)
  assert.equal(row.lastPostedAt, '2026-11-17T03:00:00Z')
  assert.deepEqual(row.episodes.map((item) => item.episodeNo), [1, 2, 3])
  assert.equal(seriesOverview(posts).find((series) => series.id === 'deal-desk').total, 0)
})

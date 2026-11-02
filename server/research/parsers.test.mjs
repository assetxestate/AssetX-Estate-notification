import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseRss, parseYoutubeFeed, parseGnewsSitemap, parseBotMpc, parseDolNews, parsePantipTagNextData,
  parseCkanPackage, googleNewsRssUrl, decodeEntities, textOf, PROCUREMENT_RE,
} from './parsers.js'

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>ประชาชาติ</title>
<item><title><![CDATA[ค่าโอน&amp;จดจำนอง 0.01% ต่ออายุถึง มิ.ย. 70]]></title>
<link>https://www.prachachat.net/real-estate/news-1?utm_source=rss</link>
<pubDate>Sun, 01 Nov 2026 03:15:00 +0000</pubDate>
<dc:creator>สมชาย ใจดี</dc:creator>
<category>อสังหาริมทรัพย์</category><category>มาตรการรัฐ</category>
<description>เนื้อเต็มที่ห้ามเก็บ โทร 081-111-2222</description>
<content:encoded><![CDATA[<p>บทความเต็ม</p>]]></content:encoded>
<source url="https://www.prachachat.net">ประชาชาติธุรกิจ</source>
</item>
<item><title>ข่าวที่สอง</title><link>https://example.com/2</link><pubDate>ไม่ใช่วันที่</pubDate></item>
</channel></rss>`

test('RSS: เก็บแค่หัว ลิงก์ วันที่ หมวด แหล่ง — ไม่คืน description/creator', () => {
  const items = parseRss(RSS)
  assert.equal(items.length, 2)
  assert.equal(items[0].title, 'ค่าโอน&จดจำนอง 0.01% ต่ออายุถึง มิ.ย. 70')
  assert.equal(items[0].link, 'https://www.prachachat.net/real-estate/news-1?utm_source=rss')
  assert.equal(items[0].published, '2026-11-01T03:15:00.000Z')
  assert.deepEqual(items[0].categories, ['อสังหาริมทรัพย์', 'มาตรการรัฐ'])
  assert.equal(items[0].sourceName, 'ประชาชาติธุรกิจ')
  assert.equal('description' in items[0], false)
  assert.equal('dc:creator' in items[0], false)
  assert.doesNotMatch(JSON.stringify(items), /081-111|สมชาย/)
  assert.equal(items[1].published, null)
})

test('YouTube Atom: videoId วิว วันที่ ช่อง', () => {
  const xml = `<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <entry><id>yt:video:abc123XYZ</id><yt:videoId>abc123XYZ</yt:videoId><title>ขายฝากกับจำนอง ต่างกันยังไง</title>
  <author><name>Land for Loan</name></author><published>2026-10-30T10:00:00+00:00</published>
  <media:group><media:community><media:statistics views="15234"/></media:community></media:group></entry></feed>`
  const [v] = parseYoutubeFeed(xml)
  assert.equal(v.videoId, 'abc123XYZ')
  assert.equal(v.link, 'https://www.youtube.com/watch?v=abc123XYZ')
  assert.equal(v.views, 15234)
  assert.equal(v.channel, 'Land for Loan')
  assert.equal(v.published, '2026-10-30T10:00:00.000Z')
})

test('Google-News sitemap: loc + news:title + publication_date', () => {
  const xml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url><loc>https://www.thansettakij.com/real-estate/123456</loc><news:news><news:publication><news:name>ฐานเศรษฐกิจ</news:name></news:publication>
  <news:publication_date>2026-11-02T08:30:00+07:00</news:publication_date><news:title><![CDATA[REIC เผยยอดโอน &quot;บ้านมือสอง&quot; Q3 ลด]]></news:title></news:news></url>
  <url><loc>https://www.thansettakij.com/politics/1</loc><news:news><news:title>การเมือง</news:title></news:news></url></urlset>`
  const items = parseGnewsSitemap(xml)
  assert.equal(items.length, 2)
  assert.equal(items[0].title, 'REIC เผยยอดโอน "บ้านมือสอง" Q3 ลด')
  assert.equal(items[0].published, '2026-11-02T01:30:00.000Z')
  assert.equal(items[0].publication, 'ฐานเศรษฐกิจ')
})

test('Google News RSS URL ต่อ when: เอง และ encode ภาษาไทย', () => {
  const url = googleNewsRssUrl('จำนองบ้าน', 14)
  assert.ok(url.startsWith('https://news.google.com/rss/search?q='))
  assert.ok(url.includes(encodeURIComponent('จำนองบ้าน when:14d')))
  assert.ok(url.endsWith('&hl=th&gl=TH&ceid=TH:th'))
})

test('ธปท. ตาราง กนง.: ลิงก์แถลงข่าวมีรหัสสุ่ม อ่านวันที่จากชื่อไฟล์', () => {
  const html = `<table><tr><td>28 ต.ค. 2569</td><td><a href="/th/news-and-media/news/mpc/news-20261028-ab12cd.html" class="x">แถลงข่าว</a>
  <a href="/th/news-and-media/news/mpc/news-20261028-ab12cd.html">แถลงข่าว (ซ้ำ)</a></td></tr>
  <tr><td><a href="https://www.bot.or.th/th/news-and-media/news/mpc/news-20260827-zz99.html"><span>แถลงข่าว</span></a></td></tr></table>`
  const items = parseBotMpc(html)
  assert.equal(items.length, 2)
  assert.equal(items[0].link, 'https://www.bot.or.th/th/news-and-media/news/mpc/news-20261028-ab12cd.html')
  assert.equal(items[0].published, '2026-10-28T00:00:00.000Z')
  assert.equal(items[1].published.slice(0, 10), '2026-08-27')
})

test('กรมที่ดิน: ลิงก์ /news-<epoch>/ และคำกรองจัดซื้อ', () => {
  const html = `<ul><li><a href="https://www.dol.go.th/news-1761900000/" title="x">กรมที่ดินแจ้งค่าธรรมเนียมจดทะเบียนขายฝากปี 2570</a></li>
  <li><a href="/news-1761800000/">ประกาศผู้ชนะการเสนอราคา จัดซื้อครุภัณฑ์</a></li>
  <li><a href="/news-1761800000/">ประกาศผู้ชนะการเสนอราคา จัดซื้อครุภัณฑ์</a></li></ul>`
  const items = parseDolNews(html)
  assert.equal(items.length, 2)
  assert.equal(items[0].published, new Date(1761900000 * 1000).toISOString())
  assert.equal(items[1].link, 'https://www.dol.go.th/news-1761800000/')
  assert.equal(PROCUREMENT_RE.test(items[1].title), true)
  assert.equal(PROCUREMENT_RE.test(items[0].title), false)
})

test('Pantip __NEXT_DATA__: topics.data หรือค้นลึก · ทิ้ง author', () => {
  const payload = { props: { initialProps: { pageProps: { topics: { data: [
    { topic_id: 43812345, title: 'กู้แบงก์ไม่ผ่าน มีโฉนด ควรทำยังไง', views_count: 1200, comments_count: 18, created_time: '2026-11-01T02:00:00Z', author: { name: 'สมหญิง', id: 1 }, tags: [{ name: 'สินเชื่อเพื่อที่อยู่อาศัย' }] },
    { topic_id: 43812346, title: '<b>ขายฝาก</b> &amp; จำนอง', views: 10, comments: 0 },
  ] } } } } }
  const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script></html>`
  const topics = parsePantipTagNextData(html)
  assert.equal(topics.length, 2)
  assert.equal(topics[0].topicId, '43812345')
  assert.equal(topics[0].link, 'https://pantip.com/topic/43812345')
  assert.equal(topics[0].views, 1200)
  assert.deepEqual(topics[0].tags, ['สินเชื่อเพื่อที่อยู่อาศัย'])
  assert.equal(topics[1].title, 'ขายฝาก & จำนอง')
  assert.doesNotMatch(JSON.stringify(topics), /สมหญิง|author/)
  const deep = { props: { pageProps: { nested: { list: [{ id: 7, title: 'ลึก' }] } } } }
  assert.equal(parsePantipTagNextData(`<script id="__NEXT_DATA__">${JSON.stringify(deep)}</script>`)[0].topicId, '7')
  assert.deepEqual(parsePantipTagNextData('<html>no data</html>'), [])
})

test('CKAN: เลือก resource ล่าสุด และ monthKey ไม่ใช่ชื่อไฟล์', () => {
  const pkg = { result: { resources: [
    { url: 'https://x/led_2569_09.csv', name: 'ก.ย. 69', last_modified: '2026-10-05T01:00:00' },
    { url: 'https://x/led_2569_10.csv', name: 'ต.ค. 69', last_modified: '2026-11-04T01:00:00' },
  ] } }
  const latest = parseCkanPackage(pkg)
  assert.equal(latest.url, 'https://x/led_2569_10.csv')
  assert.equal(latest.monthKey, '2026-11')
  assert.equal(latest.count, 2)
  assert.equal(parseCkanPackage('{bad json'), null)
  assert.equal(parseCkanPackage({ result: { resources: [] } }), null)
})

test('entity และ textOf', () => {
  assert.equal(decodeEntities('A &amp; B &lt;c&gt; &#3585; &#x0E02;'), 'A & B <c> ก ข')
  assert.equal(textOf('<p>สวัสดี <b>โลก</b></p>\n\n  <![CDATA[x]]>'), 'สวัสดี โลก x')
})

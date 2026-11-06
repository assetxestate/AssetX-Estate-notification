import test from 'node:test'
import assert from 'node:assert/strict'
import { extractArticle, needsFacts, parseFacts, factsSummary, failedSummary, enrichIdeas, buildFactsPrompt, decodeEntities } from './enrich.js'

const para = (t) => `<p>${t}</p>`
const thai = 'คณะกรรมการนโยบายการเงินมีมติเป็นเอกฉันท์ให้คงอัตราดอกเบี้ยนโยบายไว้ที่ร้อยละหนึ่งต่อปี โดยประเมินว่าเศรษฐกิจไทยขยายตัวใกล้เคียงกับที่คาดไว้'
const articleHtml = `<html><head><title>ผลการประชุม กนง.</title><meta property="og:description" content="นายดอน นาครทรรพ เลขานุการ กนง. แถลงผลการประชุม &amp; มีมติคงอัตราดอกเบี้ย" /></head><body>
<nav><p>ค้นหาข่าวสาร สุนทรพจน์ สื่อประชาสัมพันธ์ รวมถึงกำหนดการกิจกรรมต่าง ๆ ล่าสุดของ ธปท. และหน่วยงาน</p></nav>
<script>var x = "<p>ไม่ใช่เนื้อ</p>"</script>
<article>${para(thai)}${para(thai.replace('เศรษฐกิจไทย', 'อัตราเงินเฟ้อทั่วไป'))}${para(thai.replace('เศรษฐกิจไทย', 'ภาคการส่งออก'))}${para('Short english only paragraph that should be dropped because it is not Thai text at all okay')}${para(thai)}</article>
<footer><p>สงวนลิขสิทธิ์ พ.ศ. 2567 ธนาคารแห่งประเทศไทย ติดตามเราได้ทุกช่องทางที่สะดวกสำหรับท่าน</p></footer></body></html>`

test('extractArticle: เอาเฉพาะย่อหน้าไทยในบทความ ตัดเมนู/ท้ายเว็บ/script · ซ้ำไม่นับ · กลายเป็นชนิด article', () => {
  const art = extractArticle(articleHtml, { url: 'https://www.bot.or.th/x' })
  assert.equal(art.kind, 'article')
  assert.equal(art.title, 'ผลการประชุม กนง.')
  assert.match(art.description, /แถลงผลการประชุม & มีมติคงอัตราดอกเบี้ย/)
  assert.doesNotMatch(art.text, /ค้นหาข่าวสาร|สงวนลิขสิทธิ์|ไม่ใช่เนื้อ|Short english/)
  assert.equal(art.text.split('\n').length, 3, 'ย่อหน้าซ้ำถูกตัด')
})

test('extractArticle: ไม่มีย่อหน้า → ใช้คำโปรยถ้ายาวพอ · หน้า Google News = none · PDF ฝัง = none', () => {
  const desc = 'ใครที่อยู่ต่างจังหวัดแล้วเห็นบิ๊กซีใกล้บ้านเริ่มเงียบเหงาหรือทยอยปิดตัวลง ไม่ต้องแปลกใจครับ เพราะนี่คือมูฟเมนต์การเงินครั้งใหญ่ของกลุ่มทุนระดับแสนล้าน หลังจากบริษัทประกาศขายทรัพย์สิน'
  const pantip = extractArticle(`<html><head><meta name="description" content="${desc}"></head><body><p>คุณสามารถแสดงความคิดเห็นกับกระทู้นี้ได้ด้วยการเข้าสู่ระบบ</p></body></html>`, { url: 'https://pantip.com/topic/1' })
  assert.equal(pantip.kind, 'description')
  assert.equal(pantip.text, desc)
  const gnews = extractArticle(articleHtml, { url: 'https://news.google.com/rss/articles/abc' })
  assert.equal(gnews.kind, 'none')
  assert.match(gnews.reason, /Google News/)
  const pdf = extractArticle('<html><head><title>เว็บไซต์กรมที่ดิน</title></head><body><p>ไม่สามารถแสดงตัวอย่างไฟล์ dol.pdf กรุณาดาวน์โหลดเพื่อเปิดดู</p></body></html>', { url: 'https://www.dol.go.th/x' })
  assert.equal(pdf.kind, 'none')
  assert.equal(decodeEntities('&#3588;&#x0E19; &amp; &quot;x&quot;'), 'คน & "x"')
})

test('needsFacts: มีลิงก์ที่ไม่ใช่คลิป และ summary ยังไม่ใช่ 📌 · ⚠️ จาก enrich รอบก่อนลองซ้ำเฉพาะ retry', () => {
  assert.equal(needsFacts({ url: 'https://www.bot.or.th/x', summary: 'อ่านมติจากลิงก์ก่อนเขียน' }), true)
  assert.equal(needsFacts({ url: 'https://www.bot.or.th/x', summary: '' }), true)
  assert.equal(needsFacts({ url: 'https://www.bot.or.th/x', summary: '📌 มีมติคงดอกเบี้ย' }), false)
  assert.equal(needsFacts({ url: 'https://www.youtube.com/watch?v=1', summary: '⚠️ ยังไม่รู้เนื้อหาจริงของคลิป' }), false)
  assert.equal(needsFacts({ url: '', summary: '' }), false)
  assert.equal(needsFacts({ url: 'https://x.th', summary: failedSummary('HTTP 403') }), false)
  assert.equal(needsFacts({ url: 'https://x.th', summary: failedSummary('HTTP 403') }, { retry: true }), true)
})

test('parseFacts / factsSummary: ล้าง PII · ตัดเลขนำ · ซ้ำไม่นับ · ≤ 7 · ต้อง ≥ 2 · summary ขึ้นต้น 📌 และบอกเมื่อมาจากคำโปรย', () => {
  const res = parseFacts({ facts: ['1. กนง. มีมติคงดอกเบี้ยนโยบาย', '- กนง. มีมติคงดอกเบี้ยนโยบาย', 'ติดต่อ นาย สมชาย ใจดี โทร 081-234-5678', ...Array.from({ length: 9 }, (_, i) => `ข้อ ${i}`)], date: '28 ตุลาคม 2569' })
  assert.equal(res.ok, true)
  assert.equal(res.facts.length, 7)
  assert.equal(res.facts[0], 'กนง. มีมติคงดอกเบี้ยนโยบาย')
  assert.match(res.facts[1], /\[ลบ\]/)
  assert.equal(res.date, '28 ตุลาคม 2569')
  assert.equal(parseFacts({ facts: ['ข้อเดียว'] }).ok, false)
  assert.equal(parseFacts('ไม่ใช่ json').ok, false)
  const summary = factsSummary({ facts: ['ก', 'ข'], date: '1 พ.ย.', kind: 'description' })
  assert.match(summary, /^📌 ก · ข · วันที่ตามต้นฉบับ: 1 พ\.ย\. · \(สรุปจากคำโปรย/)
  assert.match(failedSummary('HTTP 403'), /^⚠️ ดึงเนื้อหาจากลิงก์ไม่ได้ \(HTTP 403\)/)
})

test('buildFactsPrompt: ข้อความต้นทางผ่านตัวลบข้อมูลบุคคล และบอกชนิดข้อความ', () => {
  const { system, prompt } = buildFactsPrompt({ idea: { title: 'ข่าว', source_label: 'ธปท.' }, article: { kind: 'description', text: 'โทร 081-234-5678 มีมติคง' }, brand: { brand: 'AssetX Estate' } })
  assert.match(system, /ห้ามตีความ/)
  assert.match(prompt, /คำโปรยของหน้า/)
  assert.doesNotMatch(prompt, /081-234/)
})

test('enrichIdeas: บล็อก → บันทึก ⚠️ · บทความ → สรุป 📌 · คำโปรย → สรุป 📌 (กำกับ) · ไม่มีผู้ให้บริการ → หยุด', async () => {
  const pages = {
    'https://blocked.th/a': { ok: false, status: 403, blocked: true, text: '', url: 'https://blocked.th/a' },
    'https://www.bot.or.th/a': { ok: true, status: 200, blocked: false, text: articleHtml, url: 'https://www.bot.or.th/a' },
    'https://pantip.com/topic/1': { ok: true, status: 200, blocked: false, text: `<html><head><meta name="description" content="${'คำโปรยยาวพอสมควรเกี่ยวกับการขายทรัพย์สินของบริษัทแห่งหนึ่งเพื่อเคลียร์หนี้ ตามที่มีรายงานในกระทู้นี้ซึ่งอธิบายรายละเอียดต่าง ๆ ไว้'}"></head><body></body></html>`, url: 'https://pantip.com/topic/1' },
  }
  const fetcher = async (url) => pages[url] || { ok: false, status: 404, blocked: false, text: '', url, error: 'HTTP 404' }
  const ask = async () => ({ ok: true, provider: 'ollama', data: { facts: ['ข้อเท็จจริงหนึ่ง', 'ข้อเท็จจริงสอง'], date: '' } })
  const saved = []
  const ideas = [
    { id: 1, url: 'https://blocked.th/a', title: 'a', source_label: 'ประชาชาติ' },
    { id: 2, url: 'https://www.bot.or.th/a', title: 'b', source_label: 'ธปท.' },
    { id: 3, url: 'https://pantip.com/topic/1', title: 'c', source_label: 'Pantip' },
  ]
  const result = await enrichIdeas({ ideas, fetcher, ask, onSave: async (id, s) => saved.push([id, s]), sleep: async () => {}, delayMs: 0 })
  assert.equal(result.fetched, 3)
  assert.deepEqual(result.done.map((d) => [d.id, d.kind]), [[2, 'article'], [3, 'description']])
  assert.equal(result.failed.length, 1)
  assert.match(saved[0][1], /^⚠️ ดึงเนื้อหาจากลิงก์ไม่ได้ \(ต้นทางปฏิเสธบอท \(HTTP 403\)\)/)
  assert.match(saved[1][1], /^📌 ข้อเท็จจริงหนึ่ง · ข้อเท็จจริงสอง$/)
  assert.match(saved[2][1], /สรุปจากคำโปรย/)

  const none = await enrichIdeas({ ideas: ideas.slice(1), fetcher, ask: async () => ({ ok: false, error: 'ไม่มีผู้ให้บริการ AI' }), onSave: async () => {}, sleep: async () => {}, delayMs: 0 })
  assert.equal(none.stopped, true)
  assert.equal(none.done.length, 0)
})

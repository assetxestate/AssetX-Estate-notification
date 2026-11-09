#!/usr/bin/env node
// scripts/make-contact-block.mjs — สร้างบล็อกเบอร์/LINE สำหรับแถบท้ายโปสเตอร์ (public/contact-block-*.png พื้นโปร่งใส)
//
// เจ้าของ 9 พ.ย. 2569: "เบอร์โทรศัพท์และไลน์ อยากให้ดูพรีเมียมและเป็นทางการกว่านี้… โทรศัพท์ก็ให้ดูสวยงามกว่านี้ และไลน์ก็ใช้เป็นสัญลักษณ์ของจริง"
// เดิม poster-footer.ps1 วาดไอคอนเส้นของ Windows (Segoe MDL2) สีไซยาน + "โทร 096-…" / "LINE: …" ด้วย System.Drawing
// ตอนนี้: เบอร์/LINE ของบริษัทคงที่ (POSTER_CONTACT) จึงจัดหน้าครั้งเดียวด้วย Chrome (ตัวพิมพ์ Kanit คมกว่า วางระยะแบบ CSS ได้) แล้วให้สคริปต์แถบท้ายวางภาพนี้
//  · ไอคอน LINE = "Brand icon" ทางการ (scripts/assets/icons/line-brand-icon.png) ใช้ตามต้นฉบับ ไม่แก้สี/รูปทรง เว้นระยะรอบไอคอน (กติกา line.me/en/logo)
//  · โทรศัพท์ = ไอคอนทึบมุมมน (Phosphor, MIT) บนกรอบมนขนาด/ความโค้งเท่าไอคอน LINE สีไล่ไซยานของแบรนด์ — สองแถวดูเป็นชุดเดียวกัน
//  · ตัวเลข/ไอดี Kanit SemiBold สีขาว ตัวเลขกว้างเท่ากัน (tabular) ไม่มีคำนำหน้า "โทร" / "LINE:" เพราะไอคอนบอกแล้ว
// 2 แบบ: stacked (สองแถว · ภาพแนวตั้ง/จัตุรัส) · inline (แถวเดียว · ภาพแนวนอนที่แถบท้ายเตี้ย ไอคอนจะได้ไม่เล็กกว่าขั้นต่ำของ LINE)
// ใช้: node scripts/make-contact-block.mjs   (ต้องมี Google Chrome ในเครื่อง · เปิดแบบ headless โปรไฟล์ชั่วคราว ไม่แตะโปรไฟล์ Research)
// เปลี่ยนเบอร์/LINE ใน src/lib/posterDesignSystem.js แล้วรันสคริปต์นี้ใหม่ทุกครั้ง
import { readFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { POSTER_CONTACT } from '../src/lib/posterDesignSystem.js'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const asset = (...p) => path.join(repo, 'scripts', 'assets', ...p)
const dataUri = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`
export const CONTACT_BLOCK_FILES = {
  stacked: path.join(repo, 'public', 'contact-block-stacked.png'),
  inline: path.join(repo, 'public', 'contact-block-inline.png'),
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

export function contactBlockHtml(contact = POSTER_CONTACT) {
  const phoneSvg = readFileSync(asset('icons', 'phone-fill.svg'), 'utf8').replace('<svg ', '<svg class="handset" ')
  const lineIcon = dataUri(asset('icons', 'line-brand-icon.png'), 'image/png')
  const kanit = dataUri(asset('fonts', 'Kanit-SemiBold.ttf'), 'font/ttf')
  const phone = escapeHtml(contact.phone)
  const line = escapeHtml(contact.line)
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'KanitSB'; src: url(${kanit}) format('truetype'); font-weight: 600; }
html, body { margin: 0; background: transparent; }
body { padding: 20px; }
/* ไอคอนสูง 88 px (ภาพจริง ×3) · กรอบโทรศัพท์โค้ง 22% เท่าไอคอน LINE · ช่องว่างรอบไอคอน LINE ≥ 30% ของความสูง (เขตปลอดภัยตามกติกา LINE) */
.tile { width: 88px; height: 88px; flex: none; display: block; }
.phone { border-radius: 22%; background: linear-gradient(150deg, #7fe3ee 0%, #3fbccf 45%, #147f98 100%); display: grid; place-items: center;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.45), inset 0 -2px 4px rgba(4,40,60,.25); }
.handset { width: 50px; height: 50px; fill: #ffffff; filter: drop-shadow(0 1px 1px rgba(4,40,60,.35)); }
.val { font-family: 'KanitSB'; font-weight: 600; font-size: 54px; line-height: 1; color: #ffffff; letter-spacing: .035em; white-space: nowrap; font-feature-settings: "tnum" 1, "lnum" 1; }
.stacked { display: inline-grid; grid-template-columns: 88px auto; column-gap: 30px; row-gap: 30px; align-items: center; }
.inline { display: inline-flex; align-items: center; gap: 28px; }
.rule { width: 2px; height: 70px; background: linear-gradient(180deg, rgba(66,199,216,0), rgba(66,199,216,.75), rgba(66,199,216,0)); margin: 0 18px; }
</style></head><body>
<div id="stacked" class="stacked">
  <div class="tile phone">${phoneSvg}</div><div class="val">${phone}</div>
  <img class="tile" src="${lineIcon}" alt="LINE"><div class="val">${line}</div>
</div>
<div style="height:40px"></div>
<div id="inline" class="inline">
  <div class="tile phone">${phoneSvg}</div><div class="val">${phone}</div>
  <div class="rule"></div>
  <img class="tile" src="${lineIcon}" alt="LINE"><div class="val">${line}</div>
</div>
</body></html>`
}

async function main() {
  const { chromium } = await import('playwright-core')
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await browser.newPage({ deviceScaleFactor: 3, viewport: { width: 1400, height: 700 } })
    await page.setContent(contactBlockHtml(), { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    const family = await page.evaluate(() => getComputedStyle(document.querySelector('.val')).fontFamily)
    const loaded = await page.evaluate(() => document.fonts.check('600 54px KanitSB'))
    if (!loaded) throw new Error(`ฟอนต์ Kanit ไม่โหลด (${family})`)
    mkdirSync(path.dirname(CONTACT_BLOCK_FILES.stacked), { recursive: true })
    for (const [id, file] of Object.entries(CONTACT_BLOCK_FILES)) {
      const el = await page.$(`#${id}`)
      // เว้นขอบโปร่งใสรอบบล็อก 8 px (CSS) — เขตปลอดภัยของไอคอน LINE ด้านซ้าย/บน/ล่าง
      const box = await el.boundingBox()
      await page.screenshot({ path: file, omitBackground: true, clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 } })
      console.log(`${id}: ${path.relative(repo, file)} (${Math.round((box.width + 16) * 3)}×${Math.round((box.height + 16) * 3)})`)
    }
  } finally {
    await browser.close()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message || error); process.exitCode = 1 })
}

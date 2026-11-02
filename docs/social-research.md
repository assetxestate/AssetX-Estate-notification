# ระบบรีเสิร์ชโซเชียลและเทรนด์ (social-research) — โปรไฟล์อสังหาฯ ขายฝาก/จำนอง

สร้าง 2 พ.ย. 2569 จากสกิล `social-research` (ต้นแบบ DivisionX Card) **ยกโครง ไม่ยกเนื้อ** — เลน คำค้น คะแนน กติกา เขียนใหม่สำหรับธุรกิจขายฝาก/จำนอง/นายหน้า
เป้าหมาย: ให้ระบบ (และ Hermes ในฐานะ AI ที่เขียนมุมเล่า) ออกไปสำรวจข่าว เว็บทางการ ชุมชน และคู่แข่ง แล้วนำกลับมาเป็น **คิวไอเดีย** ให้เจ้าของเลือกทำคอนเทนต์ที่หน้า `/marketing`

## หลักการที่ห้ามตัด

1. **โค้ดคิดตัวเลข AI แค่เล่า** — คะแนน คัดกรอง กันซ้ำ ทำด้วยกฎใน JS ทั้งหมด AI ได้รับไอเดียที่คิดเสร็จแล้วไปเขียน "มุมเล่า" 3 มุม
2. **ทุกอย่างเข้าคิวให้คนเลือก** — ไม่มีอะไรโพสต์เองหรือแก้ prompt เอง
3. **อ่านอย่างเดียว · ไม่โต้ตอบอัตโนมัติ · แยกจากบัญชีเพจจริงของร้าน**
4. **แยกเลนต่อแหล่ง** — เลนพังไม่ล้มทั้งรอบ · กันซ้ำด้วย `external_key` UNIQUE (นับทุก status) · cap ต่อ (source, subtype) นับรวมคิว
5. **ยึดเนื้อหาจริง** — ไม่มีเนื้อหาจริง = ติดป้าย ⚠️ "ห้ามเดาจากชื่อ" (คลิป YouTube ทุกตัวตอนนี้)
6. **ใช้เฉพาะช่องทางฟรีที่กติกาอนุญาต หรือเจ้าของอนุมัติรับความเสี่ยงไว้ชัดเจน** — UA บอกชื่อบอท · เจอ 429/403/Cloudflare = ข้าม ห้ามเลี่ยง
7. **ไม่เก็บข้อมูลบุคคล (PDPA)** — ตัวลบข้อมูลบุคคลทำงานกับทุกข้อความก่อนบันทึกและก่อนส่ง AI · ฟีดทิ้ง `dc:creator`/`description`/`author` ตั้งแต่ตอนอ่าน
8. **ด่านการเงินในโค้ด** — ดอกเบี้ย/สินไถ่ > 15% ต่อปี · คำ overclaim · "ธปท. อนุญาต" · "0.01%" ผิดเงื่อนไข = บล็อก (ใช้กับร่างคอนเทนต์)

## ภาพรวม

```
07:00 ทุกวัน (Task Scheduler บนเครื่องที่เปิด · เปิดสายก็รันชดเชย เพราะเช็ก "วันนี้รันแล้วหรือยัง")
  node scripts/research-ideas.mjs run
    1 expire    ตั้ง status=expired ให้ไอเดียเก่า (ไม่ลบแถว)
    2 collect   ทุกเลน → ตรวจ subtype → ลบ PII → คะแนน → รวมข่าวซ้ำตามเหตุการณ์ → กันซ้ำ → cap → upsert
    3 angles    AI (Hermes → Gemini) เขียน 3 มุมเล่าคนละรูปแบบ ให้ไอเดียที่ยังไม่มี (เขียนทีละแถว)
    4 report    สรุปเข้าเทเลแกรมเจ้าของ + เช็กลิสต์แหล่งที่คนต้องดูเองที่ถึงรอบ
        ↓
  ตาราง marketing_ideas (status new) → หน้า /marketing "ไอเดียวันนี้" (การ์ด "เรดาร์รีเสิร์ช")
        ↓ เริ่มทำคอนเทนต์ = picked → ร่างเข้ากล่องรออนุมัติตามเดิม · ทิ้ง = dismissed + เหตุผล
```

ขั้น 2 ล้มเท่านั้นที่นับว่ารอบล้ม (exit 1 · ตั้ง Task Scheduler ซ้ำ 07:30/08:00 ได้ สคริปต์ข้ามเองถ้าสำเร็จแล้ว) · ขั้น 1/3/4 ล้มแค่เตือน ⚠️

## ไฟล์

| ส่วน | ไฟล์ |
|---|---|
| คอนฟิก (แก้ได้ไม่ต้องแตะโค้ด) | `research/idea_sources.json` · `research/brand_facts.json` (+ `.local/research/brand_facts.local.json` ทับ) · `research/calendar.json` · `research/manual-checklist.md` |
| เครื่องยนต์ (pure function มีเทสต์) | `server/research/parsers.js` อ่านฟีด/HTML/JSON · `classify.js` subtype คะแนน กุญแจ · `pii.js` ตัวลบข้อมูลบุคคล · `gate.js` ด่านการเงิน · `collector.js` รอบเก็บ · `calendar.js` · `internal.js` สัญญาณลีด · `angles.js` prompt มุมเล่า · `llm.js` Hermes→Gemini · `fetcher.js` มารยาทการดึง · `store.js` Supabase/dry-run · `notify.js` เทเลแกรม |
| ตัวรัน | `scripts/research-ideas.mjs` (`run` · `collect` · `angles` · `expire` · `probe` · `stats` · `report`) |
| API หน้าเว็บ | `server/marketing-ideas.js` ← `/api/marketing-ideas` (rewrite ใน `vercel.json` → `api/marketing.js?feature=ideas`) |
| หน้าเว็บ | `src/MarketingPage.jsx` — การ์ดจาก `researchIdeaToCard()` ปุ่ม "เริ่มทำคอนเทนต์" (pick) และ "ทิ้ง" (dismiss) |
| ฐานข้อมูล | `supabase_marketing_ideas.sql` — `marketing_ideas` · `marketing_content` · `leads` (service_role เท่านั้น ไม่มี DELETE) |
| สถานะ/บันทึก (ไม่เข้า git) | `.local/research/state.json` · `runs.jsonl` · `run.lock` · `dry-run.json` · `probe-<วัน>.json` |
| เทสต์ | `npm run test:research` (server/research/*.test.mjs + server/marketing-ideas.test.mjs) |

## เลนข้อมูล (ทดสอบยิงจริง 2 พ.ย. 2569 ด้วย `probe` — 32/33 แหล่งตอบปกติ · SAM ตอบ 500 ฝั่งเขา)

| เลน | แหล่ง | `source` / `subtype` | สถานะกติกา |
|---|---|---|---|
| rate | ธปท. ตารางประชุม กนง. (HTML · ลิงก์แถลงข่าวอ่านจากตาราง) | official / rate | ✅ ToS อนุญาต |
| news | ประชาชาติ RSS หมวดอสังหา · ฐานเศรษฐกิจ sitemap (`/real-estate|finance/`) · กรุงเทพธุรกิจ sitemap (`/business/property/`) · Bangkok Post RSS property | news / ตัวจัดประเภท | ✅ ฐานเศรษฐกิจ, Bangkok Post · ⏳ ประชาชาติ, กรุงเทพธุรกิจ (อ่าน ToS ก่อน) |
| news ⚠️ | Google News RSS 11 คำค้น (ยิง ≤ 12/วัน เว้น 2.5 วิ · `กนง.` เฉพาะช่วงประชุม) | news / ตามคำค้น | ⚠️ robots ห้าม — เจ้าของอนุมัติ 2 พ.ย. 2569 |
| community | Pantip ชายคา + สินธร (RSS · สินธรต้องเจอคำ pain/transaction/asset) · Pantip tag อสังหาริมทรัพย์ (`__NEXT_DATA__` มีวิว ≤ 5/วัน) | community / community_q | ⏳ ToS ยังไม่อ่าน · ทิ้งผู้เขียน/เนื้อเสมอ |
| auction | กรมบังคับคดี open data (CKAN · รายเดือน · CC BY-NC) · SAM RSS หมวดประชาสัมพันธ์ | auction / auction_npa | ✅ open data (ตัวเลขห้ามลงโพสต์) · ⏳ SAM |
| law | กรมที่ดิน ข่าวประชาสัมพันธ์ หน้า 1 (กรองจัดซื้อ) | official / law… | ⏳ · ห้ามแตะ announce.dol.go.th |
| video ⚠️ | YouTube channel RSS 11 ช่อง (คู่แข่ง · ทนาย · นายหน้า · ตลาด · ทางการ) ≤ 7 วัน ≤ 3/ช่อง | youtube / competitor หรือตัวจัดประเภท | ⚠️ เจ้าของอนุมัติ · ยังไม่ถอดคำบรรยาย |
| internal | ตาราง `leads` (ลีดพุ่งตามกลุ่ม×พื้นที่ · คำถามยอดนิยม) รายสัปดาห์ | internal / internal | ของเราเอง · ไม่มีข้อมูลบุคคล |
| calendar | `calendar.json` (กนง. · ราคาประเมิน 2570 · สิ้นสุดลดค่าโอน/LTV 30 มิ.ย. 2570) ล่วงหน้า 21 วัน | official / ตามเหตุการณ์ | ของเราเอง |
| manual | เจ้าของวางหัวข้อ/ลิงก์ที่หน้า `/marketing` หรือ API | manual / market | — |

แหล่งที่ **ห้ามอัตโนมัติ** (กรมธนารักษ์ · ราชกิจจาฯ · REIC · DDproperty · Meta Ad Library · TikTok · เว็บประกาศ · ธนาคาร NPA · เพจ Facebook) → `research/manual-checklist.md`

### คำตัดสินของเจ้าของ (`owner_decisions` ใน idea_sources.json)

เจ้าของอนุมัติ 2 พ.ย. 2569 ให้ใช้ 4 ทางเดียวกับต้นแบบแม้ robots/ToS ของแพลตฟอร์มห้าม (รับความเสี่ยงเอง): Google News RSS · YouTube channel RSS · yt-dlp · อ่านเพจ Facebook ผ่านบัญชีสำรอง
ตัวเก็บ**ข้ามเลนที่ `allowed` ไม่ใช่ `true`** และพิมพ์บอก · เว็บที่ ToS ห้ามสคริปต์ยังเป็นคนดูเอง

## สิ่งที่สร้างแล้ว / ยังไม่สร้าง (ตามลำดับ 9 ขั้นของสกิล)

| ขั้น | สถานะ |
|---|---|
| 0 โปรไฟล์ + ทดสอบแหล่ง | ✅ โปรไฟล์อยู่ในสกิล · probe 32/33 |
| 1 คำค้น | ✅ 11 คำ (ผลทดสอบต่อคำอยู่ใน `_note`) |
| 2 ตาราง ideas | ✅ `supabase_marketing_ideas.sql` — **เจ้าของต้องรันใน Supabase SQL Editor** |
| 3 เลน + parser + เทสต์ | ✅ 9 เลน · 71 เทสต์ |
| 4 มุมเล่า AI | ✅ Hermes (HERMES_AGENT_URL) → Gemini · ยังไม่ได้ทดสอบกับ Hermes จริง (เครื่องเก่า) |
| 5 หน้าเลือกไอเดีย | ✅ การ์ดในหน้า /marketing + pick/dismiss/manual API · ยังไม่มี UI กรอกลีด (ใช้ API `action:"lead"`) |
| 6 ถอดเนื้อหาจริง (yt-dlp) | ⬜ ยังไม่สร้าง — เครื่องนี้ไม่มี yt-dlp · คลิปทุกตัวติดป้าย ⚠️ |
| 7 ตัวเฝ้าเพจ Facebook | ⬜ ยังไม่สร้าง — ต้องมีบัญชีสำรองวอร์ม ~1 สัปดาห์ + OpenCLI + Chrome profile บนเครื่องที่เปิดค้าง · ลิสต์ 47 เพจอยู่ใน vault |
| 8 บทเรียนรายสัปดาห์ | ⬜ ยังไม่สร้าง — ต้องมีลีดใน `leads` ก่อน (ทางหลักของอสังหาฯ คือลีด ไม่ใช่ไลก์) |
| 9 ตารางเวลา | ◐ สคริปต์พร้อม (lock · ran-today · runs.jsonl · retry) · ต้องตั้ง Task Scheduler (ด้านล่าง) |

## ติดตั้ง/ใช้งาน

```bash
# 1) สร้างตาราง — Supabase Dashboard → SQL Editor → วาง supabase_marketing_ideas.sql → Run (รันซ้ำได้)
# 2) ทดสอบแหล่งทั้งหมดแบบเบามือ (ยิง 1 ครั้ง/แหล่ง ~1.5 นาที ไม่เขียนอะไร)
node scripts/research-ideas.mjs probe
# 3) ลองเก็บโดยไม่แตะฐานข้อมูล → ดูผลที่ .local/research/dry-run.json
node scripts/research-ideas.mjs collect --dry-run
# 4) รอบจริงครั้งแรก (เก็บ + มุมเล่า + รายงานเทเลแกรม)
node scripts/research-ideas.mjs run
# 5) ดูคิว / รอบล่าสุด
node scripts/research-ideas.mjs stats
node scripts/research-ideas.mjs report
```

ตั้งเวลาบน Windows (รันใน PowerShell ครั้งเดียว · ตั้ง 3 เวลา สคริปต์ข้ามเองถ้าวันนั้นสำเร็จแล้ว):

```powershell
$repo = 'C:\Projects\AssetX Estate\AssetX-Estate-notification'
foreach ($t in '07:00','07:30','08:00') {
  schtasks /Create /F /TN "AssetX Research $t" /SC DAILY /ST $t /TR "cmd /c cd /d `"$repo`" && node scripts\research-ideas.mjs run >> .local\research\task.log 2>&1"
}
```

ค่าใน `.env.local` ที่ใช้: `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (ฐานข้อมูล) · `HERMES_AGENT_URL` (+ `HERMES_AGENT_FORMAT` `HERMES_AGENT_MODEL` `HERMES_AGENT_API_KEY`) หรือ `GEMINI_API_KEY` (มุมเล่า) · `ASSETX_TELEGRAM_BOT_TOKEN` + `ASSETX_TELEGRAM_ALLOWED_CHAT_ID` (รายงาน)

## ประเภทย่อย คะแนน และคิว

- `subtype` ต้องอยู่ใน `idea_sources.json → subtypes` (อายุ · กลุ่ม A–D · cap) ไม่งั้นตัวเก็บปฏิเสธพร้อมคำเตือน
- คะแนน = Σ_กลุ่ม w × min(คำต่างกันที่เจอ, 2) + ความสด (วันนี้ +2 · <3 วัน +1.5 · <7 วัน +0.8 · ≥14 วัน −1) · **topic gate** ต้องเจอคำ transaction/policy/asset อย่างน้อย 1 คำ
- Pantip เพดาน ~5.5 · YouTube เพดาน ~7.5 (คลิปไวรัลไม่กินท็อป) · ธปท. ฐาน 5.0 · ปฏิทิน 4–5.5 · ลีด 4–5 · manual 6
- รวมข่าวเหตุการณ์เดียวกันด้วย `event_key = <subtype>:<วัน>:<คำ policy>` (กนง. 70 ชิ้น → 1 แถว + "สำนักอื่นที่รายงาน") · ซ้ำข้ามรอบภายใน 7 วันไม่ใส่
- หมดอายุ = `status='expired'` เมื่ออายุ > max(14, max_age_days ของ subtype) · `event_date` ยังไม่ถึง หรือมีคอนเทนต์อ้าง = ไม่แตะ

## นโยบายเครดิตและมุมเล่า

- `news` `official` `auction` → ต้องอ้างชื่อสำนัก/หน่วยงาน (+วันที่) ในโพสต์ ห้ามลงเนื้อเต็ม (ฐานเศรษฐกิจ · Bangkok Post · REIC · กรมบังคับคดี บังคับ)
- `community` `youtube` `social` และ subtype `competitor` → ห้ามอ้างกระทู้/ช่อง/เพจ · เล่าเป็นความรู้ทั่วไป
- กติกาต่อ subtype อยู่ `angles.js → SUBTYPE_NOTES` (เช่น auction_npa ห้ามเชียร์ซื้อ · scam ห้ามเอ่ยชื่อ · competitor เรตเป็นโฆษณาไม่ใช่ข้อเท็จจริง)
- ความจริงของแบรนด์จาก `brand_facts.json` เท่านั้น — เติมพื้นที่/ค่าธรรมเนียม/ช่องติดต่อจริงใน `.local/research/brand_facts.local.json`

## วัดผล: ลีด ไม่ใช่ไลก์

ตาราง `leads` ไม่มีข้อมูลบุคคล (ช่องทาง · กลุ่ม A–D · บริการ · ประเภททรัพย์ · พื้นที่ · ช่วงวงเงิน · qualified · closed · `ref_code`/`heard_from` ว่ารู้จักจากโพสต์ไหน)
บันทึกผ่าน `POST /api/marketing-ideas {action:"lead", channel, audience, service, ...}` · ชื่อ/เบอร์อยู่ใน CRM เท่านั้น
สัญญาณ `lead_surge`/`top_question` เข้าคิวเองรายสัปดาห์ · บทเรียนรายสัปดาห์ (ขั้น 8) จะใช้ตารางนี้เป็นทางหลัก

## กับดักที่รู้

- `event_date` ต้องเป็น ค.ศ. (ใส่ พ.ศ. = อนาคต 543 ปี ไม่หมดอายุตลอดกาล) — ตารางมี CHECK กันไว้ · `calendar.json` มีเทสต์ตรวจรูปวันที่
- ตัวลบข้อมูลบุคคลจับ "คุณสมชาย" (ไม่เว้นวรรค) ไม่ได้ → ฟีดทิ้งฟิลด์ผู้เขียนตั้งแต่ตอนอ่าน
- Google News ห้ามเขียน `when:` ในคำค้น (ตัวเก็บต่อให้) · ใส่ `site:`/วงเล็บซ้อนทำให้ตัวกรองเวลาเพี้ยน
- ชื่อไฟล์ CSV ของกรมบังคับคดีเปลี่ยนทุกเดือน → กุญแจคือ `led:<package>:<YYYY-MM>`
- Bangkok Post ส่ง gzip โดยไม่บอก → `fetcher.js` ถอดจาก magic bytes
- `\w` ใน JS ไม่จับอักษรไทย → regex เลขคดีใช้ `\p{L}\p{M}\p{N}` + flag `u`
- ตัวเก็บต้องไม่รันซ้อน (ล็อกไฟล์ · stale 2 ชม.) · upsert ignore-duplicates ทำให้รันซ้ำปลอดภัย

# รายงาน Audit โค้ด — AssetX Estate Notification
วันที่: 6 กรกฎาคม 2569 (2026)

---

## (1) ช่องโหว่ความปลอดภัย — เรียงตามความร้ายแรง

### 🔴 ร้ายแรงมาก (Critical)

**S1. LINE Channel Access Token ถูก hardcode และ commit เข้า Git**
- ไฟล์: `Google App Script.js` บรรทัด 18, และ `ไฟล์App scrip เก่า.txt` บรรทัด 13
- Token จริงโผล่เป็น plaintext (`QXRCBb+4Zwej...`) ใครก็ตามที่เห็น repo สามารถส่ง LINE แทนบริษัทได้ทั้งหมด
- **ต้อง revoke token นี้ทันทีในหน้า LINE Developers Console** — การลบออกจากโค้ดอย่างเดียวไม่พอ เพราะ token ยังอยู่ใน git history

**S2. RLS ของ Supabase เปิด `allow_all` (อ่าน/เขียน/ลบได้หมด)**
- ไฟล์: `supabase_schema.sql` บรรทัด 118–132
- Policy เป็น `FOR ALL USING (true) WITH CHECK (true)` ทุกตาราง รวมตารางลูกค้าที่มีเลขบัตรประชาชน/เบอร์โทร
- Anon key ของ Supabase ฝังอยู่ใน bundle ฝั่ง client (เปิดดูได้จาก DevTools) → ใครก็ดึงหรือลบข้อมูลลูกค้าทั้งฐานได้ ขัดกับ Business Rule "ห้ามลบข้อมูลลูกค้าโดยตรง"

**S3. Google API Key โผล่ในโค้ด client**
- ไฟล์: `src/ValuationPage.jsx` บรรทัด 21–22 (`CSE_API_KEY = 'AIzaSy...'`)
- คีย์นี้ **ไม่ได้ถูกใช้งานจริง** (dead code) แต่ถูก build ติดไปกับ bundle ที่ deploy แล้ว (ตรวจพบใน `dist/`) ใครก็นำไปใช้จน quota หมด/เกิดค่าใช้จ่าย

### 🟠 ร้ายแรง (High)

**S4. รหัสผ่านเข้าระบบ hardcode ฝั่ง client**
- ไฟล์: `src/LoginPage.jsx` บรรทัด 3 (`{ username: "admin", password: "assetx" }`)
- Auth ทำฝั่ง browser ทั้งหมด (แค่ตั้ง flag ใน sessionStorage) เปิด bundle ก็เห็นรหัส หรือ set `sessionStorage.assetx_auth=true` ก็ผ่านได้เลย

**S5. `/api/chat` เปิดสาธารณะ ไม่มี auth + ส่ง PII ลูกค้าออกไป**
- ไฟล์: `api/chat.js` — `Access-Control-Allow-Origin: *`, ไม่ตรวจสิทธิ์
- รับ `customerData` ทั้งก้อน (ข้อมูลลูกค้าทุกคน) ยัดเข้า prompt ส่งไป Gemini ใครยิง POST มาก็เปลือง quota และ endpoint สะท้อนข้อมูลได้

### 🟡 ปานกลาง (Medium)

**S6. `/api/line-webhook` ไม่ตรวจ X-Line-Signature**
- ไฟล์: `api/line-webhook.js` — รับ POST อะไรก็ส่งต่อ GAS ทันที ปลอม webhook ได้

**S7. Proxy `treasury.js` / `landsmaps.js` เป็น open proxy (CORS `*`, ไม่มี rate-limit)**
- ใช้ยิงต่อไปยัง endpoint ภายนอกในนามเซิร์ฟเวอร์เราได้

**S8. PII ถูกเก็บใน localStorage แบบไม่เข้ารหัส + log ชื่อลูกค้า**
- `src/App.jsx` เก็บ `assetx_customer_line_ids`, `assetx_customer_extra_info` ใน localStorage และ `addLog` บันทึกชื่อลูกค้า ขัด Business Rule "ข้อมูลส่วนตัวต้องไม่แสดงใน logs"

---

## (2) โค้ดซ้ำซ้อน / ไฟล์ที่ควรลบ

- **ไฟล์ที่ควรลบออกจาก repo** (หลายไฟล์อยู่ใน git แต่เป็นของเก่า/มีความลับ):
  `Google App Script.js`, `ไฟล์App scrip เก่า.txt` (โค้ดเก่า + มี token), `fix-duplicates.js`, `migrate.js` (สคริปต์ครั้งเดียวจบ), `LoGo.jpg` (ซ้ำกับ `public/logo.jpg`), `C:UsersjakkaAssetX-Estate-notificationtmp_query.txt` (ไฟล์ชื่อเพี้ยนจาก path Windows), `vite.config.js.timestamp-*.mjs` (ไฟล์ชั่วคราวของ Vite)
- **เอกสาร/ข้อมูลไม่ควรอยู่ใน repo:** `.docx` รายงานหลายเวอร์ชัน (v2–v6), `.xlsx` ข้อมูลลูกค้าจริง + `_backup.xlsx`, โฟลเดอร์ `หน้าเว็บ/` (handoff zip + สำเนาโปรเจกต์เก่า ~ทำให้ repo บวมเป็น 154MB)
- **`BRAND` object ซ้ำ 9 ไฟล์:** นิยาม `const BRAND = {...}` ซ้ำใน `ValuationPage`, `TaxPage`, `LegalPage`, `MapView`, `ChatPanel`, `DashboardPage`, `InvestorPage`, `ReservationPage` ทั้งที่มีตัวกลางอยู่แล้วใน `src/lib/config.js` → ควร import จากที่เดียว
- **`dist/` ถูก commit** ทั้งที่ Vercel build เอง และมี anon key รั่วในนั้น — ควรลบและใส่ .gitignore (มีอยู่แล้วแต่ไฟล์ถูก track ไปก่อน)

## (3) จุดที่ทำให้แอปช้า

- **ไม่มี code-splitting เลย** (`React.lazy`/`Suspense` = 0) `App.jsx` 2,196 บรรทัด + `ValuationPage.jsx` 2,733 บรรทัด รวมเป็น bundle ก้อนเดียว โหลดครั้งแรกช้า
- **โลโก้ base64 ~175KB ฝังใน `config.js`** (บรรทัดเดียว 174,922 อักษร) ถูก parse ทุกครั้งที่โหลด ทั้งที่มีไฟล์ `public/logo.jpg` ให้ browser cache ได้อยู่แล้ว
- **`getCustomers()` ดึง `customers` + `payments` แล้ว merge ฝั่ง client** — โตขึ้นตามจำนวนงวด ควรใช้ join/view ฝั่ง Supabase หรือ paginate
- **`MOCK_DATA` ~หลาย KB import เข้า bundle เสมอ** แม้ production ต่อ Supabase ได้ ควรแยกโหลดเฉพาะตอน fallback

## (4) สิ่งที่ควรปรับให้ใช้งานง่ายขึ้น (UX)

- **แจ้ง error ด้วย `alert()` 38 จุด** — บล็อกทั้งหน้า ดูไม่โปร ควรใช้ toast/inline message
- **Login ไม่มีสถานะ "กำลังเข้าสู่ระบบ" / ไม่จำ session ข้ามวัน** (ใช้ sessionStorage หลุดเมื่อปิดแท็บ) พิจารณา remember-me
- **ไม่มี loading skeleton** ระหว่างโหลดข้อมูล ผู้ใช้เห็นจอว่าง
- **ไม่มีข้อความยืนยันก่อนทำรายการสำคัญ** (ปิดสัญญา/เลื่อนงวด) เสี่ยงกดพลาด
- **การแจ้งเตือนล่วงหน้า** ควรมี UI ตั้งค่าจำนวนวัน (Business Rule กำหนดอย่างน้อย 7 วัน) ให้ปรับได้

---

## หมายเหตุการแก้ไข
เริ่มแก้ข้อ (1) ก่อนตามที่สั่ง รายการที่ **ต้องทำเองในคอนโซล** (แก้ในโค้ดอย่างเดียวไม่พอ):
1. Revoke LINE Channel Access Token เดิม แล้วออกใหม่ (S1)
2. ปรับ RLS policy ใน Supabase Dashboard (S2)
3. ลบไฟล์ที่มีความลับออกจาก git history (เช่น `git filter-repo`) — S1/S3


---

# ✅ สถานะการแก้ไข (อัปเดต 6 ก.ค. 2569)

## แก้เสร็จแล้วในโค้ด

**ข้อ 1 — ความปลอดภัย**
- S1: `Google App Script.js` เปลี่ยนเป็นอ่าน token จาก Script Properties / ลบ `ไฟล์App scrip เก่า.txt` ที่มี token แล้ว
- S3: ลบ Google API key ที่ไม่ได้ใช้ออกจาก `ValuationPage.jsx`
- S4: login ตรวจฝั่งเซิร์ฟเวอร์ (`api/login.js` + ENV `APP_USERNAME`/`APP_PASSWORD`) พร้อม session cookie (HttpOnly, HMAC-signed)
- S5: `/api/chat` ต้องมี session ก่อนใช้ + ปิด CORS `*`
- S6: `api/line-webhook.js` ตรวจ `X-Line-Signature` (ต้องตั้ง ENV `LINE_CHANNEL_SECRET`)
- S7: ลบ CORS `*` ออกจาก proxy ทั้งสองตัว
- S9 (พบเพิ่ม): `IMGBB_KEY` hardcode ใน `messages.js` → ย้ายไป `VITE_IMGBB_KEY` ใน .env.local

**ข้อ 2 — โค้ดซ้ำ/ไฟล์ขยะ**
- รวม `BRAND` 7 หน้าให้ import จาก `config.js` (override เฉพาะคีย์ที่ต่าง — สีเหมือนเดิมทุกหน้า, InvestorPage คงพาเลตต์เฉพาะไว้)
- ลบ: `LoGo.jpg` (ซ้ำ), `ไฟล์App scrip เก่า.txt`, ไฟล์ tmp ชื่อเพี้ยน, `vite.config.js.timestamp-*.mjs`
- ย้าย `fix-duplicates.js`, `migrate.js` → `scripts/`
- ล้างข้อมูลลูกค้าจริงออกจาก `mockData.js`
- เพิ่ม `.gitignore`: `*.docx`, `หน้าเว็บ/`, vite timestamp

**ข้อ 3 — Performance**
- ลบโลโก้ base64 ~175KB ออกจาก bundle (`config.js` ใช้ `/logo.jpg` แทน)
- Code splitting: ทุกหน้า (Valuation, Map, Investor, Dashboard, Tax, Legal, Reservation, SystemStatus) โหลดแบบ lazy
- ลบ import `ChatPanel` ที่ไม่ได้ใช้ / `MOCK_DATA` เหลือ array ว่าง

**ข้อ 4 — UX**
- แทน `alert()` 32 จุดด้วย toast ไม่บล็อกหน้าจอ (`src/lib/toast.js` — เดาประเภท error/success อัตโนมัติ)
- เพิ่ม confirm ก่อนลบรายการประเมิน (ValuationPage)
- หน้า login: ปุ่มแสดงสถานะ "กำลังเข้าสู่ระบบ..." + checkbox "จำฉันไว้ในเครื่องนี้"

## ⚠️ สิ่งที่คุณต้องทำเอง (โค้ดอย่างเดียวแก้ไม่ได้)

1. **Revoke LINE Channel Access Token เดิม** (LINE Developers Console → Messaging API → reissue) แล้วใส่ token ใหม่ใน GAS: Project Settings → Script Properties → key `LINE_TOKEN` — token เก่าอยู่ใน git history แล้ว ถือว่ารั่ว
2. **Regenerate คีย์ที่รั่ว:** Google API key (`AIzaSyB4Ao...`) ที่ console.cloud.google.com และ imgbb key ที่ api.imgbb.com (แล้วอัปเดต `VITE_IMGBB_KEY` ใน .env.local + Vercel)
3. **ตั้ง ENV บน Vercel** (Project Settings → Environment Variables): `APP_USERNAME`, `APP_PASSWORD`, `SESSION_SECRET` (สุ่มยาว ๆ), `LINE_CHANNEL_SECRET`, `GEMINI_API_KEY`, และ `VITE_IMGBB_KEY` — **ถ้าไม่ตั้ง login จะใช้ไม่ได้**
4. **Supabase RLS:** เปิด Supabase Auth ก่อน แล้วรัน `supabase_rls_hardening.sql` (อย่ารันก่อนเปิด Auth ไม่งั้นแอปอ่านข้อมูลไม่ได้)
5. **รัน git ฝั่ง Windows** (git index ใน sandbox มีปัญหา):
   ```
   git rm -r --cached dist
   git rm --cached "Google App Script.js"   (ถ้าไม่อยากให้โค้ด GAS อยู่ใน repo)
   git add -A && git commit -m "security audit fixes"
   ```
   และถ้าต้องการล้าง token เก่าออกจาก history จริง ๆ: ใช้ `git filter-repo` (ถ้า repo เป็น public ควรทำ)
6. **ทดสอบ `npm run dev` / `npm run build`** บนเครื่องคุณ 1 รอบ — โค้ดผ่านการ compile-check ใน sandbox แล้ว แต่ควร build จริงบน Windows ก่อน deploy

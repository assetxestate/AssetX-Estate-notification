# การเชื่อม AssetX Marketing OS กับ Facebook Page

ระบบรองรับโพสต์ข้อความ รูปภาพ และตั้งเวลาเผยแพร่จากหน้า `การตลาด > คิวโพสต์` โดยโพสต์จะต้องผ่านการอนุมัติและการตรวจเนื้อหาก่อนเสมอ

> คำเตือน: Access Token และ App Secret เป็นรหัสลับ ห้ามส่งผ่านแชต ห้ามใส่ในไฟล์ที่ commit เข้า Git และห้ามถ่ายภาพหน้าจอที่เห็นค่าเต็ม

## ภาพรวมการเชื่อมต่อ

ต้องดำเนินการ 5 ช่วงตามลำดับ:

1. ตรวจสิทธิ์ Facebook Page
2. สร้าง Meta Developer App
3. ออก Token และหา Page ID
4. ใส่ค่าลับใน Vercel
5. ทดสอบโพสต์จาก AssetX Marketing OS

ชื่อเมนูของ Meta อาจเปลี่ยนเล็กน้อยตามภาษาและรุ่นของหน้าจอ แต่ชื่อสิทธิ์ API ต้องตรงตามคู่มือนี้

## 1. ตรวจสิทธิ์ Facebook Page

1. เข้า Facebook ด้วยบัญชีที่ดูแลเพจ
2. กดรูปโปรไฟล์ แล้วเลือก `ดูโปรไฟล์ทั้งหมด` หรือ `See all profiles`
3. สลับเข้าโปรไฟล์ของ Page ที่ต้องการเชื่อม
4. ไปที่ `การตั้งค่าและความเป็นส่วนตัว > การตั้งค่า > การตั้งค่าเพจ > สิทธิ์การเข้าถึงเพจ`
5. ตรวจชื่อบัญชีส่วนตัวของคุณในหัวข้อ `ผู้ที่มีสิทธิ์การเข้าถึง Facebook`
6. ควรแสดงว่า `สิทธิ์ควบคุมทั้งหมด` หรือ `Full control`

ถ้าไม่มี Full control ให้เจ้าของ Page เพิ่มสิทธิ์ให้ก่อน บัญชีที่มีเพียงสิทธิ์ดูข้อมูลหรือจัดการโฆษณาอาจออก Token สำหรับโพสต์ไม่ได้

เอกสารอ้างอิง: [About Facebook Page access](https://www.facebook.com/help/289207354498410/r.php/)

## 2. สร้าง Meta Developer App

1. เปิด [Meta for Developers - Apps](https://developers.facebook.com/apps/)
2. เข้าสู่ระบบด้วยบัญชี Facebook ที่มี Full control ของ Page
3. กด `Create App` หรือ `สร้างแอพ`
4. ถ้ามีหน้าเลือก Use case ให้เลือกกรณีที่เกี่ยวกับการจัดการ Page หรือเลือก `Other`
5. เลือกประเภทแอพ `Business`
6. ตั้งชื่อ เช่น `AssetX Marketing OS`
7. ใส่อีเมลติดต่อของผู้ดูแลระบบ
8. เลือก Business Portfolio ของบริษัทถ้ามี แล้วกดสร้างแอพ

หลังสร้างเสร็จ ให้เปิด `App settings > Basic` และจดข้อมูลต่อไปนี้ไว้ในตัวจัดการรหัสผ่าน:

- `App ID`
- `App Secret` กด `Show` เพื่อดูค่า

ตั้ง `META_APP_ID` คู่กับ `META_APP_SECRET` เพื่อให้ระบบตรวจวันหมดอายุผ่าน Meta Debug Token ส่วน App Secret ใช้สร้าง `appsecret_proof` ด้วย การอ่านชื่อเพจสำเร็จไม่ใช่หลักฐานว่าโทเคนมีอายุยาวหรือมีสิทธิ์เผยแพร่ครบ

### เมื่อโทเคนหมดอายุซ้ำ (code 190 / subcode 463)

อย่าออก Page Token อายุสั้นจาก Explorer แล้วนำขึ้น Production ซ้ำ การ Redeploy ไม่ต่ออายุโทเคน

1. ออก User Token ใหม่สำหรับ App เดิม พร้อม `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` และอนุญาตเพจที่ต้องการ
2. เปิด Access Token Debugger ตรวจ User Token แล้วใช้ `Extend Access Token` หากมี ให้ได้ Long-lived User Token ก่อน ห้ามใช้โทเคนเก่าที่หมดอายุแล้ว
3. กลับ Explorer วาง Long-lived User Token ใหม่นั้น เรียก `GET /me/accounts?fields=id,name,access_token` โดยไม่กด Generate อีก เพราะอาจแทนที่ด้วยโทเคนระยะสั้น
4. คัดลอก `access_token` จากรายการเพจที่ถูกต้อง ตรวจใน Debugger ว่าเป็น Page ของเพจนั้น สิทธิ์ครบ และตรวจทั้ง Expires กับ Data Access Expires ห้ามนำโทเคนที่เหลือหนึ่งชั่วโมงไปใช้เป็นการเชื่อมต่อระยะยาว
5. ใส่ค่าใน `META_PAGE_ACCESS_TOKEN` บน Vercel Production แล้ว Redeploy ตรวจวันหมดอายุจากคิวอีกครั้ง

ถ้าไม่มี Extend ให้ทำการแลกโทเคนตามเอกสาร Meta ฝั่งเซิร์ฟเวอร์โดยผู้ดูแล ห้ามส่ง App Secret หรือโทเคนในแชตหรือ commit ลง Git

โทเคนที่ไม่ระบุวันหมดอายุยังถูกเพิกถอนได้ ระบบนี้ไม่ได้ต่ออายุหรือออกโทเคนใหม่แทนผู้ใช้โดยอัตโนมัติ และไม่ได้ตรวจสถานะเมื่อไม่มีผู้เปิดหน้าเว็บ โพสต์ที่ Facebook รับตั้งเวลาแล้วกับรายการที่บันทึกเองต้องตรวจแยกกันก่อนส่งซ้ำ

อ้างอิง: https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/

## 3. ขอสิทธิ์ที่ระบบต้องใช้

สิทธิ์ขั้นต่ำมี 3 รายการ:

- `pages_show_list` ใช้ค้นหา Page ที่บัญชีดูแล
- `pages_read_engagement` ใช้อ่านข้อมูลพื้นฐานและการมีส่วนร่วมของ Page
- `pages_manage_posts` ใช้สร้างและจัดการโพสต์ของ Page

สำหรับ Page ของคุณเองและบัญชีที่เป็น Admin/Developer ของ App สามารถเริ่มทดสอบขณะ App อยู่ใน Development mode ได้โดยทั่วไป ถ้าจะให้ลูกค้าหรือผู้ใช้อื่นเชื่อม Page ของตนเอง ต้องเปิด Live mode และอาจต้องผ่าน App Review, Advanced Access และ Business Verification ก่อน

## 4A. ออก Token แบบทดสอบเร็ว

วิธีนี้เหมาะสำหรับยืนยันว่าระบบทำงาน แต่ Token อาจหมดอายุ จึงไม่ควรใช้เป็นวิธีถาวร

1. เปิด [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. มุมขวาบน เลือก App ที่สร้างไว้ เช่น `AssetX Marketing OS`
3. เลือกชนิด Token เป็น `User Token`
4. กด `Get Token > Get User Access Token`
5. เลือกสิทธิ์ `pages_show_list`, `pages_read_engagement` และ `pages_manage_posts`
6. กดยืนยัน Facebook และเลือก Page ที่ต้องการให้ App เข้าถึง
7. ในช่องคำสั่ง เลือก `GET` แล้วใส่:

```text
/me/accounts?fields=id,name,access_token,tasks
```

8. กด `Submit`
9. ในผลลัพธ์ หา Page ที่ต้องการเชื่อม แล้วจด:

```json
{
  "name": "ชื่อเพจ",
  "id": "PAGE_ID",
  "access_token": "PAGE_ACCESS_TOKEN",
  "tasks": ["CREATE_CONTENT"]
}
```

ชื่อ task อาจแสดงเป็น `CREATE_CONTENT` หรือ `PROFILE_PLUS_CREATE_CONTENT` ถ้าไม่พบ task ที่เกี่ยวกับการสร้างเนื้อหา ให้กลับไปตรวจ Page access

ชุดคำสั่ง `/me/accounts` เป็นวิธีที่ Meta ระบุสำหรับรับ Page ID และ Page Access Token: [Facebook API Tokens](https://www.postman.com/meta/facebook/folder/3nyjb4m/tokens)

### ตรวจ Token ก่อนนำไปใช้

ใน Graph API Explorer เปลี่ยนคำสั่งเป็น:

```text
/PAGE_ID?fields=id,name
```

แทน `PAGE_ID` ด้วยค่าจริง แล้วกด `Submit` ถ้าผลลัพธ์คืนชื่อและ ID ของ Page ถูกต้อง แสดงว่า Token อ่าน Page ได้แล้ว

## 4B. ออก Token สำหรับใช้งานจริงระยะยาว

วิธีที่แนะนำสำหรับระบบอัตโนมัติคือ System User Token เพราะไม่ผูกกับการเปิดเบราว์เซอร์ทุกครั้ง และสามารถกำหนดสิทธิ์เฉพาะทรัพย์สินของบริษัทได้

1. เปิด [Meta Business Settings](https://business.facebook.com/settings/)
2. เลือก Business Portfolio ที่เป็นเจ้าของ App และ Page
3. ไปที่ `Users > System users`
4. กด `Add` และตั้งชื่อ เช่น `AssetX Marketing Publisher`
5. เลือกบทบาท Admin สำหรับ System User นี้
6. กด `Assign assets`
7. เลือก `Pages` แล้วเลือก Page ที่จะเชื่อม
8. ให้สิทธิ์จัดการเนื้อหา/Create content ของ Page แล้วบันทึก
9. กลับมาที่ System User และกด `Generate new token`
10. เลือก App `AssetX Marketing OS`
11. เลือกระยะหมดอายุที่ยาวที่สุดหรือ `Never` ถ้าบัญชีมีตัวเลือกนี้
12. เลือก `pages_show_list`, `pages_read_engagement` และ `pages_manage_posts`
13. กดสร้าง Token และเก็บค่าทันที เพราะ Meta อาจไม่แสดงค่าเต็มอีก

ถ้าเมนู System User ไม่มี Page หรือ App ให้เลือก แสดงว่า Page/App ยังไม่ได้อยู่ใน Business Portfolio เดียวกัน ให้เพิ่มที่ `Accounts > Pages` และ `Accounts > Apps` ก่อน

## 5. ใส่ค่าใน Vercel

1. เปิด [Vercel Dashboard](https://vercel.com/dashboard)
2. เลือกโปรเจกต์ `assetx-estate`
3. ไปที่ `Settings > Environment Variables`
4. เพิ่มค่าต่อไปนี้ทีละรายการ:

| Name | Value | Environment |
|---|---|---|
| `META_PAGE_ID` | Page ID ที่ได้จาก `/me/accounts` | Production |
| `META_PAGE_ACCESS_TOKEN` | Page Access Token หรือ System User Token | Production |
| `META_APP_SECRET` | App Secret จาก Meta App | Production |
| `META_APP_ID` | App ID ของ App ที่ออกโทเคน ใช้ตรวจอายุ | Production |
| `META_GRAPH_API_VERSION` | `v26.0` | Production |

5. ตรวจว่าไม่มีช่องว่างหรือเครื่องหมายอัญประกาศติดหัวท้ายค่า
6. กด Save
7. ไปที่ `Deployments` เลือก deployment ล่าสุด แล้วกด `Redeploy`

Environment Variables จะมีผลกับ deployment ใหม่เท่านั้น ถ้าไม่ Redeploy หน้าเว็บจะยังแจ้งว่าไม่ได้เชื่อม

## 6. ตรวจสถานะใน AssetX

1. เปิด [AssetX Estate](https://assetx-estate.vercel.app/)
2. เข้าสู่ระบบ
3. เปิดเมนู `การตลาด`
4. เข้า `คิวโพสต์`
5. ป้ายด้านขวาควรเปลี่ยนจาก `ยังไม่ได้เชื่อม Facebook` เป็น `เชื่อมแล้ว · ชื่อเพจ`

ถ้ายังไม่เชื่อม ให้รีเฟรชหน้าแบบไม่ใช้ cache ด้วย `Ctrl+F5` แล้วตรวจ Environment Variables และ deployment อีกครั้ง

## 7. ทดสอบโพสต์

ใช้ข้อความทดสอบที่ไม่มีข้อมูลลูกค้า เช่น:

```text
ทดสอบระบบจัดตารางคอนเทนต์ของ บริษัท แอสเสทเอ็กซ์ เอสเตท จำกัด
```

1. สร้างหรือเลือกร่างที่ช่องทางเป็น Facebook
2. ตรวจข้อความและรูปภาพ
3. กดอนุมัติเพื่อให้สถานะผ่านการตรวจ
4. เปิด `คิวโพสต์`
5. ถ้าต้องการโพสต์ทันที ให้เว้นวันเวลาไว้ แล้วกด `โพสต์ Facebook`
6. ถ้าต้องการตั้งเวลา ให้เลือกวันและเวลาล่วงหน้าอย่างน้อย 10 นาที แล้วกด `ตั้งเวลา Facebook`
7. ระบบควรแสดง `โพสต์แล้ว` หรือ `ตั้งเวลาแล้ว`
8. เปิด Facebook Page เพื่อตรวจโพสต์ หรือเปิด Meta Business Suite เพื่อตรวจ Scheduled posts

แนะนำให้ทดสอบโพสต์ทันทีหนึ่งครั้งก่อน แล้วจึงทดสอบตั้งเวลาอีกหนึ่งครั้ง เมื่อเสร็จแล้วสามารถลบโพสต์ทดสอบจาก Facebook ได้

## ข้อผิดพลาดที่พบบ่อย

### ยังไม่ได้เชื่อม Facebook

- ชื่อตัวแปร Vercel ไม่ตรง
- ใส่ค่าแล้วแต่ยังไม่ได้ Redeploy
- ตั้งค่าเฉพาะ Preview แต่ไม่ได้ตั้ง Production

### Page Access Token หมดอายุหรือไม่ถูกต้อง

- Token แบบทดสอบหมดอายุ
- Token ถูกยกเลิกหลังเปลี่ยนรหัสผ่านหรือแก้สิทธิ์
- ออก Token จาก App คนละตัวกับ App Secret ที่ตั้งไว้

ให้ออก Token ใหม่ แล้วแก้ `META_PAGE_ACCESS_TOKEN` และ Redeploy

### ไม่มีสิทธิ์ pages_manage_posts

- ตอนออก Token ไม่ได้เลือกสิทธิ์ครบ
- บัญชีไม่มีสิทธิ์สร้างเนื้อหาใน Page
- Page ยังไม่ได้ Assign ให้ System User
- App อยู่ใน Development mode แต่บัญชีที่ใช้ไม่ใช่ Admin/Developer/Tester ของ App

### `/me/accounts` ไม่พบ Page

- เข้าสู่ระบบด้วยบัญชี Facebook ผิดบัญชี
- ยังไม่ได้ให้ App เข้าถึง Page ตอนหน้าขออนุญาต
- บัญชีมีสิทธิ์ไม่เพียงพอ

### ตั้งเวลาไม่สำเร็จ

- ต้องตั้งล่วงหน้าอย่างน้อย 10 นาที
- เวลาในระบบใช้เขตเวลาไทย `Asia/Bangkok`
- ตรวจว่าเวลาที่เลือกยังไม่ผ่านไปแล้ว

## ความปลอดภัยและขอบเขตปัจจุบัน

- รองรับข้อความและรูปเดี่ยว JPEG, PNG หรือ WebP ขนาดไม่เกิน 8 MB
- Token อยู่ฝั่งเซิร์ฟเวอร์และไม่ถูกส่งกลับไปยังเบราว์เซอร์
- ระบบบังคับให้โพสต์ผ่านการอนุมัติและการตรวจเนื้อหาก่อน
- ระบบบันทึก Facebook Post ID เพื่อป้องกันการส่งโพสต์เดิมซ้ำ
- ยังไม่รองรับอัลบั้ม วิดีโอ/Reels การแก้หรือลบโพสต์จาก AssetX และการดึงสถิติกลับอัตโนมัติ
- ถ้า Token หมดอายุหรือสิทธิ์ Page เปลี่ยน ระบบจะหยุดโพสต์และแสดงข้อผิดพลาดในคิว

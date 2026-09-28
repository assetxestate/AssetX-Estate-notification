# การเชื่อม AssetX Marketing OS กับ Facebook Page

ระบบรองรับโพสต์ข้อความ รูปภาพ และตั้งเวลาเผยแพร่จากหน้า `การตลาด > คิวโพสต์` โดยโพสต์จะต้องผ่านการอนุมัติและการตรวจเนื้อหาก่อนเสมอ

## สิ่งที่ต้องมี

1. บัญชี Facebook ที่มีสิทธิ์ Full control หรือ Create content ของ Page
2. Meta Developer App ประเภท Business
3. สิทธิ์ `pages_show_list`, `pages_read_engagement` และ `pages_manage_posts`
4. Page ID และ Page Access Token ของ Page ที่จะเชื่อม

ตรวจสอบ Page และ Token ได้ด้วยชุดคำสั่งทางการของ Meta ที่ [Facebook API บน Postman](https://www.postman.com/meta/facebook/overview)

## ตัวแปรระบบ

ตั้งค่าต่อไปนี้เฉพาะใน Vercel Environment Variables หรือ `.env.local` ห้ามวาง Token ในโค้ดหรือส่ง Token ผ่านแชต

```dotenv
META_PAGE_ID=เลขประจำเพจ
META_PAGE_ACCESS_TOKEN=page_access_token
META_APP_SECRET=app_secret
META_GRAPH_API_VERSION=v26.0
```

`META_APP_SECRET` ไม่บังคับ แต่ควรตั้งเพื่อให้ทุกคำขอมี `appsecret_proof`

## วิธีตรวจหลังเชื่อม

1. เปิด `การตลาด > คิวโพสต์`
2. ป้ายด้านขวาต้องแสดง `เชื่อมแล้ว · ชื่อเพจ`
3. อนุมัติโพสต์ทดสอบที่ไม่มีข้อมูลลูกค้าหรือข้อมูลส่วนบุคคล
4. ไม่กรอกวันเวลาเพื่อโพสต์ทันที หรือกรอกวันเวลาล่วงหน้าอย่างน้อย 10 นาทีเพื่อให้ Facebook เผยแพร่อัตโนมัติ
5. ตรวจว่าแถวคิวแสดง `โพสต์แล้ว` หรือ `ตั้งเวลาแล้ว` และมี Facebook Post ID ถูกบันทึกใน workspace

## ขอบเขตปัจจุบัน

- รองรับข้อความและรูปเดี่ยว JPEG, PNG หรือ WebP ขนาดไม่เกิน 8 MB
- Token อยู่ฝั่งเซิร์ฟเวอร์และไม่ถูกส่งกลับไปยังเบราว์เซอร์
- ยังไม่รองรับอัลบั้ม วิดีโอ/Reels การแก้โพสต์ หรือดึงสถิติกลับอัตโนมัติ
- ถ้า Token หมดอายุหรือสิทธิ์ Page เปลี่ยน ระบบจะหยุดโพสต์และแสดงข้อผิดพลาดในคิว

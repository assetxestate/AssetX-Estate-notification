# AssetX Underwriting Upgrade Plan

แผนนี้แปลงข้อมูลจาก Hermes + Tavily research ให้เป็นงานระบบที่นำไปใช้ใน AssetX ได้จริง

## Phase 1: Risk Scoring + Policy Gate

สถานะ: เริ่มใช้งานในหน้าประเมินแล้ว

สิ่งที่ระบบทำ:
- คำนวณ risk score จากน้ำท่วม เอกสารสิทธิ์ และ red flags
- สร้าง underwriting policy gate ได้แก่ decision, red flags, conditions precedent
- คำนวณ Safe / Recommended / Maximum exposure
- ส่ง policy gate เข้า Hermes Underwriting Memo เพื่อใช้เป็นฐานวิเคราะห์

แนวทางใช้งาน:
- ถ้า decision เป็น `Hold / Legal DD` ให้หยุดอนุมัติจนตรวจเอกสารและข้อพิพาทครบ
- ถ้า decision เป็น `Reduce Exposure` ให้ลดวงเงินหรือเพิ่มเงื่อนไขก่อนเสนออนุมัติ
- ถ้า decision เป็น `Conditional Approve` ต้องปิด conditions precedent ก่อนจ่ายเงิน

## Phase 2: Legal + Operation Reminders

สถานะ: เพิ่ม policy threshold ใน daily notify แล้ว

ขายฝาก:
- แจ้ง 180, 150, 90, 60, 30, 7, 3 และ 0 วันก่อนครบกำหนด

จำนอง:
- แจ้ง 60, 30, 7, 3 และ 0 วันก่อนวันครบกำหนด/วันทบทวนสัญญา

ข้อควรระวัง:
- ข้อความแจ้งเตือนเป็น operation reminder ไม่ใช่คำแนะนำทางกฎหมายเฉพาะราย
- ลูกค้าที่ปิดสัญญา/ยกเลิก/ไม่มี LINE ID จะถูกข้ามตาม logic เดิม

## Phase 3: Knowledge Loop

สถานะ: Hermes cron ถูกตั้งให้ใช้ Tavily และบันทึกเข้า Obsidian แล้ว

ที่เก็บหลัก:

```text
J:\ส่วนตัว\เลขาส่วนตัว\Obsidain\JK Knowledge\Research\AssetX\Property-Valuation\
```

ชื่อไฟล์:

```text
YYYY-MM-DD AssetX Hermes Scout Report.md
```

มาตรฐาน note:
- มี source URLs
- มีวันที่ค้น
- มี uncertainty/ข้อจำกัด
- มี action ที่เสนอ
- แยกผลกระทบต่อ MV/QSV/FSV/NRV, LTV, liquidity และ legal/DD

## Phase 4: Customer Education

สถานะ: มี draft message พร้อมใช้ในเอกสาร `customer-education-sale-vs-mortgage.md`

ช่องทางที่เหมาะ:
- LINE OA
- Telegram broadcast
- หน้า FAQ หรือข้อความก่อนกรอกแบบประเมิน

หลักการ:
- ใช้ภาษาทั่วไป เข้าใจง่าย
- ไม่ให้คำแนะนำกฎหมายเฉพาะราย
- ชวนให้ลูกค้าตรวจสัญญาและเอกสารก่อนตัดสินใจ

## Backlog ถัดไป

- บันทึก policy gate ลงประวัติ valuation เพื่อ audit ภายหลัง
- ทำหน้า dashboard รวมเคสที่ decision เป็น `Hold / Legal DD` หรือ `Reduce Exposure`
- ให้ Hermes อ่าน Obsidian notes ล่าสุดมาประกอบ memo แบบ retrieval
- เพิ่ม manual override เหตุผลอนุมัติเมื่อวงเงินเกิน recommended exposure

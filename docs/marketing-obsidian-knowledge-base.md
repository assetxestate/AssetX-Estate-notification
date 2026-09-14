# AssetX Marketing Obsidian Knowledge Base

หน้า `/marketing` สามารถแปลงผลสำรวจจาก Tavily / Creative Radar เป็น Markdown สำหรับเก็บใน Obsidian ได้ เพื่อให้ทีมและ Hermes ใช้เป็นองค์ความรู้ร่วมกัน

## Workflow

1. เปิดหน้า `/marketing`
2. ไปที่ `สำรวจ Reference`
3. กด `สำรวจอัตโนมัติด้วย Tavily` หรือ `สำรวจตลาดด้วย Tavily` จากหน้าไอเดีย
4. ระบบจะเก็บผลลัพธ์เป็น `knowledgeNotes` ใน Marketing workspace
5. กด `บันทึกเข้า Obsidian` เพื่อเขียนไฟล์ลง vault บนเครื่องนี้โดยตรง
6. ถ้าใช้งานบน production หรือเครื่องที่ไม่ได้ตั้งค่า path ให้กด `ส่งออก Obsidian MD` แล้วนำไฟล์ `.md` ที่ดาวน์โหลดไปวางใน Obsidian vault เช่น:

```text
AssetX Knowledge/Marketing Research/
```

## Local Machine Setup

บนเครื่องที่รัน local API ให้ตั้งค่าใน `.env.local`:

```text
OBSIDIAN_MARKETING_KB_DIR=J:\ส่วนตัว\เลขาส่วนตัว\Obsidain\JK Knowledge\Research\AssetX Marketing
```

ค่า path นี้เป็นค่าเฉพาะเครื่อง จึงไม่ควร commit เข้า git และควรเก็บใน `.env.local` เท่านั้น

## Local API Development

เมื่อต้องทดสอบฟีเจอร์ที่เรียก `/api/*` เช่น สร้างรูปด้วย OpenAI, สำรวจ Tavily, หรือบันทึกเข้า Obsidian ให้รันแบบ full-stack:

```bash
npm run dev:full
```

ถ้ารันเฉพาะ `npm run dev` จะได้ Vite frontend อย่างเดียว และปุ่มที่ต้องใช้ Vercel API routes อาจตอบ 404 ได้

## Note Structure

ไฟล์ที่ส่งออกมี:

- YAML frontmatter สำหรับให้ Obsidian / Hermes อ่าน metadata
- Executive Summary
- Key Findings
- Business Implications For AssetX Estate
- Marketing / Content Ideas
- Legal / Compliance Caveats
- Sources
- Follow-up Questions

## Hermes Usage

เมื่อ Hermes ใช้ knowledge base นี้ ให้ถือเป็น market/context memory:

- ใช้ insight เพื่อเสนอหัวข้อคอนเทนต์ มุมภาพ hook และคำถามที่ควรสำรวจต่อ
- อ้างอิงเฉพาะ note ที่มี source URL เมื่อพูดถึงข้อมูลจากภายนอก
- ถ้าข้อมูลเป็น trend หรือข่าว ให้ระบุว่าเป็นข้อมูล ณ วันที่บันทึก
- ห้ามใช้แทนคำปรึกษากฎหมาย การประเมินทรัพย์ หรือข้อเท็จจริงเฉพาะเคส
- ห้ามดึงข้อมูลส่วนตัวลูกค้า เลขโฉนด เบอร์โทร ที่อยู่ หรือข้อมูลสัญญาจริงเข้า vault นี้

## Recommended Obsidian Tags

```text
#assetx
#marketing
#knowledge-base
#market-radar
#creative-reference
#tavily
#hermes
```

## Important Limits

เว็บบน Vercel ไม่ควรเขียนไฟล์เข้า Obsidian vault บนเครื่องส่วนตัวโดยตรง เพราะ path ในเครื่องแต่ละคนไม่เหมือนกันและอาจเสี่ยงเรื่องสิทธิ์ไฟล์

โหมดที่รองรับ:

- Local/dev บนเครื่องนี้: กด `บันทึกเข้า Obsidian`
- Production/Vercel: กด `ส่งออก Obsidian MD` หรือให้ automation ภายนอกที่ได้รับอนุญาตเป็นตัว sync ต่อ

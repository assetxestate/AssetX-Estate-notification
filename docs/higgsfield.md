# Higgsfield (ภาพ/วิดีโอ AI) กับโปรเจกต์ AssetX

ติดตั้ง 7 พ.ย. 2569 ตามที่เจ้าของขอ (ลิงก์ higgsfield.ai/mcp จากคลิปของ borntodev) เพื่อลองใช้ควบคู่กับคิวโปสเตอร์ โดยยึดหลัก **ออกแบบและวางแผนฝั่งเรา สั่งเจนครั้งเดียว** เพื่อประหยัดเครดิต

## ติดตั้งแบบไหน และทำไม

Higgsfield มี 2 ทาง: MCP แบบรีโมต `https://mcp.higgsfield.ai/mcp` (ล็อกอิน OAuth ไม่ต้องมีคีย์) สำหรับแชทอย่าง Claude บนเว็บ/เดสก์ท็อป และ **CLI + สกิล** สำหรับโค้ดดิ้งเอเจนต์อย่าง Claude Code ผู้ผลิตระบุว่า MCP ส่งสคีมาเครื่องมือเต็มทุกครั้ง (เปลืองโทเคน) ส่วน CLI มีโครงคำสั่งตายตัว จึงติดตั้งแบบ CLI:

- `npm i -g @higgsfield/cli` (ต้อง `--allow-scripts=@higgsfield/cli` เพราะ postinstall ดาวน์โหลดไบนารี) → คำสั่ง `higgsfield` / `hf` เวอร์ชัน 1.2.2
- `npx skills add higgsfield-ai/skills -a claude-code -s '*' -y --copy` → สกิลใน `.claude/skills/higgsfield-*` (เก็บไว้ 7 ตัว: generate · product-photoshoot · youtube-thumbnail · video-explainer · faceless-video · brandkit · soul-id · ตัด websites และ marketplace-cards ออก) และ `skills-lock.json` · สกิลโหลดเมื่อเปิด session ใหม่
- ไม่ได้เพิ่ม MCP server ใน Claude Code

## ขั้นที่เจ้าของต้องทำเอง (ครั้งเดียว)

1. เปิด PowerShell พิมพ์ `higgsfield auth login` แล้วล็อกอินในเบราว์เซอร์ที่เด้งขึ้น (OAuth PKCE · Claude ทำแทนไม่ได้)
2. `higgsfield workspace list` แล้ว `higgsfield workspace set <id>` (ถ้าไม่ตั้ง คำสั่งอื่นจะบอกว่า No workspace selected)
3. `higgsfield account status` ดูแพ็กเกจและเครดิต · **ต้องเป็นแพ็กเกจเสียเงิน** การเจนผ่าน CLI/MCP หักเครดิตทุกครั้ง สิทธิ์ unlimited บนเว็บไม่มีผล และ **ไม่มีเพดานค่าใช้จ่ายในตัว**
4. ห้ามวางผลของ `higgsfield auth token` ลงแชตหรือไฟล์ในรีโป

## ราคาโดยประมาณ (ต.ค. 2569 จากเพจของ Higgsfield · ตรวจซ้ำที่ higgsfield.ai/pricing)

| รายการ | เครดิต | ≈ บาท (คิดจาก Plus $49 = 1,000 เครดิต) |
|---|---|---|
| ภาพ FLUX.2 Pro | 1 | 1.7 |
| ภาพ Nano Banana Pro (2K / 4K) | 2 / 4 | 3.5 / 7 |
| ภาพ FLUX.2 Max | 4 | 7 |
| วิดีโอ Seedance 2.5 5 วิ 720p / 1080p | 35 / 80 | 60 / 137 |
| วิดีโอ Seedance 2.5 10 วิ 720p | 70 | 120 |
| วิดีโอ Veo 3 Fast 8 วิ 720p | ≈22 | 38 |

แพ็กเกจ: Starter $15 = 200 เครดิต · Plus $49 = 1,000 · Ultra $129 = 3,000 · เครดิตแพ็กเสริมหมดอายุ 90 วัน · ใช้เชิงพาณิชย์ได้เฉพาะแพ็กเกจเสียเงิน

## กติกาการใช้ในโปรเจกต์นี้

1. เขียนคำสั่ง/บรีฟให้เสร็จฝั่งเราก่อน (แบบเดียวกับบรีฟโปสเตอร์ใน `src/lib/posterBrief.js`) ไม่ใช้ Higgsfield คิดแทน
2. ก่อนสั่งทุกครั้งรัน `higgsfield generate cost <model> --prompt "..."` แล้วรายงานเครดิตให้เจ้าของ งานที่เกินราว 10 เครดิตต้องได้รับคำยืนยันก่อน (ข้อนี้แทนกติกาในสกิลของผู้ผลิตที่บอกว่า "ไม่ต้องประเมินราคาก่อน")
3. สั่งด้วย `higgsfield generate create <model> --prompt "..." --wait` ครั้งเดียวต่อชิ้น ไม่วนลอง · ผลเป็น URL และเก็บใน Assets บน higgsfield.ai ด้วย · ดาวน์โหลดเก็บใน `.local/higgsfield/` (ไม่ขึ้น git)
4. ข้อความไทยในภาพ: ไม่มีโมเดลใดรับรองในเอกสาร ต้องตรวจทุกภาพเหมือนเดิม

## ใช้คู่กับงานของเราได้ตรงไหน

- **วิดีโอสั้นสำหรับ Reels/TikTok** คือความสามารถใหม่จริง (Seedance 2.5 · Kling 3.0 Turbo ถูกกว่า · Marketing Studio สำหรับโฆษณา/UGC) เทียบกับ HERO AI ที่ทำสคริปต์เป็นวิดีโอพร้อมเสียงพากย์และซับไทยอยู่แล้ว
- **โปสเตอร์** สกิลใช้ GPT Image 2.6 Sunburst เป็นค่าเริ่มต้น (`gpt_image_2_6`) กำหนดสัดส่วนได้ตรง เป็นทางเข้าถึงโมเดลรุ่นใหม่ที่คิว Codex ของเราไปไม่ถึง โดยจ่ายต่อภาพแทนคีย์ OpenAI · แต่ผลทดสอบ 7 พ.ย. บอกว่าระดับคุณภาพไม่ใช่ตัวแปรหลักของความสวย คิวเดิม (ฟรีกับ Plus) ยังเป็นทางหลัก
- **ทดสอบภาษาไทยกับ Nano Banana Pro** ที่ 2 เครดิตต่อภาพ ถูกกว่าเปิดคีย์ Google

รหัสโมเดลที่ใช้บ่อย: `gpt_image_2_6` · `gpt_image_2_6_flare` · `nano_banana_2` (= Nano Banana Pro) · `nano_banana_flash` (= Nano Banana 2) · `seedance_2_5` · `seedance_2_0` · `kling3_0_turbo` · `recraft_v4_1` (เวกเตอร์/โลโก้) · ดูทั้งหมดด้วย `higgsfield model list --image` / `--video` หลังล็อกอิน

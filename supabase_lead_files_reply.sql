-- ============================================================
-- AssetX — รูปแนบของ lead จากหน้า /assess + บันทึกการตอบผลกลับผู้ส่ง (18 พ.ย. 2569)
-- 1) bucket ปิด `lead-files` เก็บรูปเอกสารสิทธิ์และรูปทรัพย์ที่ผู้ส่งแนบมา
--    ไม่มี policy ให้คนนอก: อ่าน/เขียนได้เฉพาะเซิร์ฟเวอร์ (service role) · แอปเปิดดูผ่านลิงก์ชั่วคราวหลังล็อกอิน
-- 2) คอลัมน์เวลาที่ตอบผลเบื้องต้นและผลที่ตอบ ไว้วัดว่าตอบภายในวันตามที่รับปากหรือไม่
-- รันครั้งเดียวใน Supabase SQL Editor · รันซ้ำได้ ไม่กระทบข้อมูลเดิม
-- ก่อนรัน: ฟอร์มยังส่งได้ แต่รูปแนบจะส่งไม่สำเร็จ และปุ่ม "บันทึกว่าตอบแล้ว" จะแจ้งให้รันไฟล์นี้
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lead-files', 'lead-files', false, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE valuations ADD COLUMN IF NOT EXISTS lead_replied_at timestamptz;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS lead_reply_result text;

-- ให้ API เห็นคอลัมน์ใหม่ทันที
NOTIFY pgrst, 'reload schema';

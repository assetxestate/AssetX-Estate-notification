-- ============================================================
-- AssetX — เพิ่มคอลัมน์ข้อมูลติดต่อสำหรับ lead จากหน้าประเมินออนไลน์ (/assess)
-- รันเองใน Supabase → SQL Editor ก่อนใช้งานฟีเจอร์นี้จริง
-- ============================================================

ALTER TABLE valuations ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS contact_line text;

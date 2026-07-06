-- ============================================================
-- AssetX — RLS Hardening (S2)
-- ปัญหา: policy เดิมเป็น "allow_all" (USING true / CHECK true) ทุกตาราง
--        + anon key ฝังใน bundle ฝั่ง client → ใครก็อ่าน/แก้/ลบข้อมูลลูกค้าได้
--
-- คำเตือน: อย่ารันไฟล์นี้จนกว่าจะเปิดใช้ Supabase Auth ในแอปแล้ว
--          มิฉะนั้นแอปที่ยังใช้ anon key ล้วน ๆ จะอ่านข้อมูลไม่ได้ทันที
--
-- ขั้นตอนแนะนำ:
--   1) เปิด Supabase Auth (email/password) ให้ผู้ใช้ระบบล็อกอินจริง
--   2) ให้ client ใช้ session ของผู้ใช้ (supabase.auth) แทน anon key ล้วน
--   3) จึงรันสคริปต์นี้เพื่อจำกัดสิทธิ์เฉพาะผู้ล็อกอิน
-- ============================================================

-- ลบ policy เปิดกว้างเดิม
DROP POLICY IF EXISTS "allow_all" ON customers;
DROP POLICY IF EXISTS "allow_all" ON payments;
DROP POLICY IF EXISTS "allow_all" ON payment_records;
DROP POLICY IF EXISTS "allow_all" ON contract_statuses;
DROP POLICY IF EXISTS "allow_all" ON valuations;
DROP POLICY IF EXISTS "allow_all" ON destinations;

-- อนุญาตเฉพาะผู้ใช้ที่ล็อกอินแล้ว (role = authenticated)
-- อ่าน/เขียนได้ แต่ "ห้าม DELETE" ตาม business rule (ใช้ soft delete: is_cancelled)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','payments','payment_records','contract_statuses','valuations','destinations']
  LOOP
    EXECUTE format('CREATE POLICY "auth_select" ON %I FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY "auth_insert" ON %I FOR INSERT TO authenticated WITH CHECK (true);', t);
    EXECUTE format('CREATE POLICY "auth_update" ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', t);
    -- ไม่มี policy DELETE โดยตั้งใจ → RLS จะบล็อกการลบทั้งหมด (บังคับใช้ soft delete)
  END LOOP;
END $$;

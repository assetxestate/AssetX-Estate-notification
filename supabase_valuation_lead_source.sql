-- ============================================================
-- AssetX — ที่มาของ lead จากหน้าประเมินออนไลน์ /assess (18 พ.ย. 2569)
-- lead_source : 'broker' (นายหน้าส่งทรัพย์มา) | 'owner' (เจ้าของทรัพย์กรอกเอง)
-- lead_ref    : รหัสนายหน้าจากลิงก์ /assess?ref=... หรือช่องทางจาก /assess?src=...
-- รันครั้งเดียวใน Supabase SQL Editor · รันซ้ำได้ ไม่กระทบข้อมูลเดิม
-- ก่อนรัน: ฟอร์มยังส่งได้ตามปกติ แต่ระบบยังไม่จำที่มา
-- ============================================================

ALTER TABLE valuations ADD COLUMN IF NOT EXISTS lead_source text;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS lead_ref text;

-- ให้ API เห็นคอลัมน์ใหม่ทันที
NOTIFY pgrst, 'reload schema';

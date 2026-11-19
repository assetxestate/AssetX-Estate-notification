-- ============================================================
-- AssetX — เส้นทางหลังรับทรัพย์: ประเมินละเอียด → ส่งสรุปให้นายทุน → รอผล → สร้างสัญญา (18 พ.ย. 2569)
-- form_snapshot      : ฟอร์มประเมินทั้งชุด ไว้เปิดรายการเดิมมาประเมินต่อได้ครบทุกช่อง
-- underwriting_memo  : ผลวิเคราะห์หลักประกันด้วย AI ที่บันทึกไว้กับรายการ (+ เวลาที่วิเคราะห์)
-- investor_sent_at   : เวลาที่ส่งสรุปให้นายทุน (ไว้ดูว่ารอผลมานานแค่ไหน) · investor_summary = ข้อความที่ส่ง
-- approved_loan      : วงเงินที่นายทุนอนุมัติ ใช้เป็นเงินต้นตั้งต้นตอนสร้างสัญญา
-- customer_id        : รหัสลูกค้าที่สร้างจากรายการนี้ (ปุ่มเบรกทรัพย์/ยกเลิกสัญญาใช้หาลูกค้า)
-- รันครั้งเดียวใน Supabase SQL Editor · รันซ้ำได้ ไม่กระทบข้อมูลเดิม
-- ก่อนรัน: ทุกปุ่มยังทำงาน แต่ค่าข้างบนจะไม่ถูกเก็บ และแอปจะแจ้งให้รันไฟล์นี้
-- ============================================================

ALTER TABLE valuations ADD COLUMN IF NOT EXISTS form_snapshot jsonb;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS underwriting_memo text;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS underwriting_at timestamptz;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS investor_sent_at timestamptz;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS investor_summary text;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS approved_loan numeric;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS customer_id text;

-- ให้ API เห็นคอลัมน์ใหม่ทันที
NOTIFY pgrst, 'reload schema';

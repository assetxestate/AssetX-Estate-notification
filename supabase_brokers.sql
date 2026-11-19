-- ============================================================
-- AssetX — ทะเบียนนายหน้า (เจ้าของขอ 19 พ.ย. 2569)
--
-- ทำไม: โพสต์ลิงก์เดียวหานายหน้าได้หลายคน ระบบแยกแต่ละคนด้วยเบอร์โทรที่เขากรอกเองในหน้า /assess
--   - นายหน้าที่ส่งงานครั้งแรกถูกเพิ่มเข้าทะเบียนเอง (status = new) พร้อมรหัส N001, N002 …
--   - รหัสใช้เป็นลิงก์ส่วนตัว /assess?ref=<รหัส> และใช้เรียกในข้อความเทเลแกรมแทนชื่อ
--   - จำนวนงานของแต่ละคนนับจากตาราง valuations ทุกครั้ง ไม่เก็บซ้ำที่นี่
--
-- การเข้าถึง: เบราว์เซอร์ไม่แตะตารางตรง — ผ่าน /api/brokers ที่ตรวจ session ของแอป (service role) เท่านั้น
-- ไม่มี DELETE โดยตั้งใจ: รายชื่อซ้ำใช้ merged_into (รวมเข้ากับอีกรายชื่อ) · คนที่ไม่รับงานแล้วใช้ status = paused
-- รันไฟล์นี้ครั้งเดียวใน Supabase Dashboard → SQL Editor (รันซ้ำได้ ไม่ทับข้อมูล)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brokers (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT UNIQUE,                    -- รหัสในลิงก์ส่วนตัว (ระบบออกให้จากเลขแถว หรือเจ้าของตั้งเอง)
  name          TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',       -- ตามที่กรอก
  phone_key     TEXT UNIQUE,                    -- เบอร์ในรูปเดียว (0XXXXXXXXX) ใช้จับคู่กับ lead
  line_id       TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'active', 'paused')),
  merged_into   BIGINT REFERENCES public.brokers (id),  -- รายชื่อนี้เป็นเบอร์สำรองของอีกรายชื่อ
  first_lead_id BIGINT,                         -- lead แรกที่ทำให้ถูกเพิ่มเข้าทะเบียน
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.trg_brokers_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS brokers_updated_at ON public.brokers;
CREATE TRIGGER brokers_updated_at BEFORE UPDATE ON public.brokers
  FOR EACH ROW EXECUTE FUNCTION public.trg_brokers_updated_at();

-- ล็อกไม่ให้ anon/authenticated (คีย์ที่ฝังในเบราว์เซอร์) อ่านหรือเขียน — ให้เฉพาะ service_role
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brokers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.brokers TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.brokers_id_seq TO service_role;
-- ไม่ GRANT DELETE โดยตั้งใจ (ดูหัวไฟล์)

NOTIFY pgrst, 'reload schema';

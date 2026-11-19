-- ============================================================
-- AssetX — คิว "สำรวจราคาตลาด" (เจ้าของขอ 18 พ.ย. 2569)
--
-- ทางเดินงาน:
--   หน้าประเมิน ขั้นที่ 2 ปุ่ม "สำรวจราคาตลาด"
--     → POST /api/market-survey   แถวใหม่ status = queued (request = ทำเลระดับแขวง/เขต ประเภท เนื้อที่ — ไม่มีเลขโฉนด พิกัด ชื่อ เบอร์)
--     → scripts/image-worker.mjs บนคอมสำนักงานหยิบงาน ให้ Codex (ChatGPT Plus) ค้นเว็บและเปิดหน้าประกาศรายแปลง
--       ตรวจคำตอบด้วย src/lib/marketSurvey.js แล้วเก็บรายการที่ผ่านลง result → status = done
--     → หน้าเว็บถามสถานะทุกไม่กี่วินาที แสดงตารางให้เจ้าของเลือกรายการที่ใช้
--
-- การเข้าถึง: เบราว์เซอร์ไม่แตะตารางตรง — ผ่าน API ที่ตรวจ session ของแอป (service role) เท่านั้น
-- ไม่มี DELETE โดยตั้งใจ: ผลสำรวจเก็บไว้ตรวจย้อนหลังได้ · งานที่ไม่ใช้เปลี่ยนเป็น cancelled
-- รันไฟล์นี้ครั้งเดียวใน Supabase Dashboard → SQL Editor (รันซ้ำได้ ไม่ทับข้อมูล)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.market_survey_jobs (
  id            BIGSERIAL PRIMARY KEY,
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  valuation_id  BIGINT,                       -- รายการประเมินที่สั่ง (null = ประเมินใหม่ที่ยังไม่บันทึก)
  request       JSONB NOT NULL DEFAULT '{}',  -- { province, district, subdistrict, property, basis, total_sqw, gov_price_per_sqw, road }
  result        JSONB,                        -- { listings: [...], rejected: [...], notes, seconds } เมื่อ done
  error         TEXT,
  worker        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_market_survey_jobs_queue     ON public.market_survey_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_market_survey_jobs_valuation ON public.market_survey_jobs (valuation_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.trg_market_survey_jobs_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS market_survey_jobs_updated_at ON public.market_survey_jobs;
CREATE TRIGGER market_survey_jobs_updated_at BEFORE UPDATE ON public.market_survey_jobs
  FOR EACH ROW EXECUTE FUNCTION public.trg_market_survey_jobs_updated_at();

-- ล็อกไม่ให้ anon/authenticated (คีย์ที่ฝังในเบราว์เซอร์) อ่านหรือเขียน — ให้เฉพาะ service_role
ALTER TABLE public.market_survey_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_survey_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.market_survey_jobs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.market_survey_jobs_id_seq TO service_role;
-- ไม่ GRANT DELETE โดยตั้งใจ (ดูหัวไฟล์)

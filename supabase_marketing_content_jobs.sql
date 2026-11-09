-- ============================================================
-- AssetX — คิว "คิดคอนเทนต์ใหม่ด้วย AI" (เจ้าของขอ 9 พ.ย. 2569)
--
-- ทางเดินงาน:
--   หน้า /marketing ปุ่ม "✨ คิดคอนเทนต์ใหม่ (AI)" บนการ์ดไอเดีย หรือการ์ดในแท็บ ร่าง
--     → POST /api/marketing-content-jobs   แถวใหม่ status = queued
--     → scripts/image-worker.mjs บนคอมสำนักงานหยิบงาน (running) แล้วให้ Codex (ChatGPT Plus) คิดมุมเล่าใหม่ + เขียนร่างเต็ม
--       ผ่านด่านตรวจชุดเดียวกับรอบรีเสิร์ช (server/research/fresh.js) → วางมุมใหม่ไว้ช่องแรกของ marketing_ideas.angles → status = done
--     → หน้าเว็บถามสถานะทุกไม่กี่วินาที: งานจากการ์ดไอเดีย = การ์ดเลือกมุมใหม่ให้ · งานจากการ์ดร่าง = สร้างร่างใหม่แทน (ร่างเดิมพักไว้ในคลังผลงาน)
--
-- สัญญาณว่าตัวรับงานเปิดอยู่ใช้แถวเดิมในตาราง marketing_image_worker (id = 'office-pc') — ตัวเดียวกับคิวสร้างภาพ
--
-- การเข้าถึง: เบราว์เซอร์ไม่แตะตารางตรง — ผ่าน API ที่ตรวจ session ของแอป (service role) เท่านั้น
-- ไม่มี DELETE โดยตั้งใจ: งานที่ไม่ใช้แล้วเปลี่ยนเป็น cancelled
-- ต้องมีตาราง marketing_ideas ก่อน (supabase_marketing_ideas.sql)
-- รันไฟล์นี้ครั้งเดียวใน Supabase Dashboard → SQL Editor (รันซ้ำได้ ไม่ทับข้อมูล)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_content_jobs (
  id           BIGSERIAL PRIMARY KEY,
  status       TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  idea_id      BIGINT NOT NULL REFERENCES public.marketing_ideas(id),  -- ไอเดียต้นเรื่อง (มุมใหม่ไปอยู่ที่ไอเดียนี้)
  post_key     TEXT,                         -- id ของร่างในแท็บ ร่าง ที่สั่ง (null = สั่งจากการ์ดไอเดีย)
  content_no   INTEGER,                      -- #N ของร่างนั้น (ถ้ามี)
  request      JSONB NOT NULL DEFAULT '{}',  -- { note, avoid: [{ headline, caption }] } ผ่านตัวลบข้อมูลบุคคลแล้ว
  result       JSONB,                        -- { angle_index, angle: { label, brief, draft, fresh } } เมื่อ done
  error        TEXT,                         -- เหตุผลเมื่อ failed (ข้อความสั้น)
  worker       TEXT,                         -- ตัวรับงานที่หยิบไป
  applied_at   TIMESTAMPTZ,                  -- หน้าเว็บสร้างร่างใหม่จากผลแล้ว (งานจากการ์ดร่าง · กันสองแท็บสร้างซ้ำ)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_content_jobs_queue ON public.marketing_content_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_marketing_content_jobs_idea  ON public.marketing_content_jobs (idea_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.trg_marketing_content_jobs_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS marketing_content_jobs_updated_at ON public.marketing_content_jobs;
CREATE TRIGGER marketing_content_jobs_updated_at BEFORE UPDATE ON public.marketing_content_jobs
  FOR EACH ROW EXECUTE FUNCTION public.trg_marketing_content_jobs_updated_at();

-- ล็อกไม่ให้ anon/authenticated (คีย์ที่ฝังในเบราว์เซอร์) อ่านหรือเขียน — ให้เฉพาะ service_role
ALTER TABLE public.marketing_content_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_content_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketing_content_jobs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.marketing_content_jobs_id_seq TO service_role;
-- ไม่ GRANT DELETE โดยตั้งใจ (ดูหัวไฟล์)

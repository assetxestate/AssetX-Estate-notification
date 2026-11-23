-- ============================================================
-- AssetX Marketing — คิว "ให้ AI เขียนจากโน้ต" ของแผงบรีฟ (เจ้าของขอ 23 พ.ย. 2569)
--
-- ทางเดินงาน:
--   หน้า /marketing → เขียนโพสต์ใหม่ → แผง "สร้างจากข้อมูลจริง" → ปุ่ม "ให้ AI เขียนจากโน้ตนี้"
--     → POST /api/marketing-proof { action: "write-request" }   แถวใหม่ status = queued
--     → scripts/image-worker.mjs บนคอมสำนักงานหยิบงาน (running) ให้ Codex เขียน 3 มุมจากบรีฟและข้ออ้างที่ยืนยันแล้ว
--       ผ่านด่านตรวจที่ไม่ใช้ AI (server/briefWriter.js: ตัวเลขต้องมีในโน้ต · ด่านคำ · ด่านหลักฐาน) → status = done พร้อมร่างในผล
--     → หน้าเว็บถามสถานะทุกไม่กี่วินาที แล้วให้เจ้าของเลือกมุม
--
-- สัญญาณว่าตัวรับงานเปิดอยู่ใช้แถวเดิมในตาราง marketing_image_worker (id = 'office-pc')
-- การเข้าถึง: ผ่าน API ที่ตรวจ session ของแอป (service role) เท่านั้น · ไม่มี DELETE
-- ต้องมีตาราง marketing_content_briefs ก่อน (supabase_marketing_proof.sql)
-- รันไฟล์นี้ครั้งเดียวใน Supabase Dashboard → SQL Editor (รันซ้ำได้ ไม่ทับข้อมูล)
-- ยกเลิก: DROP TABLE IF EXISTS public.marketing_brief_jobs; (ปุ่มบนหน้าเว็บจะแจ้งว่ายังไม่ได้ติดตั้งคิว ส่วนอื่นทำงานตามเดิม)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_brief_jobs (
  id           BIGSERIAL PRIMARY KEY,
  status       TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  brief_id     BIGINT NOT NULL REFERENCES public.marketing_content_briefs (id),
  request      JSONB NOT NULL DEFAULT '{}',  -- { note } ผ่านตัวลบข้อมูลบุคคลแล้ว
  result       JSONB,                        -- { drafts: [{ kind, label, headline, caption, cta, facts_used, claim_ids_used }], skipped, provider, brief_version }
  error        TEXT,
  worker       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_brief_jobs_queue ON public.marketing_brief_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_marketing_brief_jobs_brief ON public.marketing_brief_jobs (brief_id, id DESC);

CREATE OR REPLACE FUNCTION public.trg_marketing_brief_jobs_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS marketing_brief_jobs_updated_at ON public.marketing_brief_jobs;
CREATE TRIGGER marketing_brief_jobs_updated_at BEFORE UPDATE ON public.marketing_brief_jobs
  FOR EACH ROW EXECUTE FUNCTION public.trg_marketing_brief_jobs_updated_at();

ALTER TABLE public.marketing_brief_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_brief_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketing_brief_jobs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.marketing_brief_jobs_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';

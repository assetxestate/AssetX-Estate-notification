-- ============================================================
-- AssetX — คิวสร้างภาพโพสต์ผ่าน ChatGPT บนคอมสำนักงาน
--
-- ทางเดินงาน:
--   หน้า /marketing (ปุ่ม "สร้างโปสเตอร์ด้วย ChatGPT" ในหน้าต่างออกแบบภาพ)
--     → POST /api/marketing-image-jobs   แถวใหม่ status = queued
--     → scripts/image-worker.mjs บนคอมสำนักงานหยิบงาน (running) แล้วเรียก Codex CLI ที่ล็อกอิน ChatGPT Plus
--     → อัปโหลด JPG ขึ้น bucket marketing-images (ไม่สาธารณะ) แล้วตั้ง status = done
--     → หน้าเว็บถามสถานะทุกไม่กี่วินาที ได้ภาพกลับไปใส่หน้าต่างออกแบบภาพ แล้วเจ้าของกด "บันทึกและแนบกับโพสต์" ตามเดิม
--
-- marketing_image_worker = สัญญาณว่าตัวรับงานบนคอมเปิดอยู่ (แถวเดียว id = 'office-pc' อัปเดตทุก 30 วินาที)
--
-- การเข้าถึง: เบราว์เซอร์ไม่แตะตารางหรือ bucket ตรง — ผ่าน API ที่ตรวจ session ของแอป (service role) เท่านั้น
-- ไม่มี DELETE โดยตั้งใจ: งานที่ไม่ใช้แล้วเปลี่ยนเป็น cancelled
-- รันไฟล์นี้ครั้งเดียวใน Supabase Dashboard → SQL Editor (รันซ้ำได้ ไม่ทับข้อมูล)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_image_jobs (
  id           BIGSERIAL PRIMARY KEY,
  status       TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  post_key     TEXT NOT NULL,                -- เลขคอนเทนต์ (#N) หรือ id ของร่าง — ใช้หางานล่าสุดของโพสต์เมื่อเปิดหน้าต่างใหม่
  content_no   INTEGER,                      -- #N ของโพสต์ (ถ้ามี)
  title        TEXT,                         -- หัวข้อโพสต์ (ผ่านตัวลบข้อมูลบุคคลแล้ว)
  prompt       TEXT NOT NULL,                -- คำสั่งภาพที่ส่งให้ Codex (ผ่านตัวลบข้อมูลบุคคลแล้ว)
  size         TEXT,                         -- ขนาดปลายทางตามแพลตฟอร์ม (คีย์ใน src/lib/posterSizes.js เช่น feed-4x5 · story-9x16)
  aspect       TEXT NOT NULL DEFAULT 'portrait' CHECK (aspect IN ('portrait', 'square', 'landscape')),  -- สัดส่วนที่สั่ง ChatGPT สร้างจริง
  image_path   TEXT,                         -- path ใน bucket marketing-images เมื่อเสร็จ
  error        TEXT,                         -- เหตุผลเมื่อ failed (ข้อความสั้น)
  worker       TEXT,                         -- ตัวรับงานที่หยิบไป
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_image_jobs_queue ON public.marketing_image_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_marketing_image_jobs_post  ON public.marketing_image_jobs (post_key, created_at DESC);

CREATE OR REPLACE FUNCTION public.trg_marketing_image_jobs_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS marketing_image_jobs_updated_at ON public.marketing_image_jobs;
CREATE TRIGGER marketing_image_jobs_updated_at BEFORE UPDATE ON public.marketing_image_jobs
  FOR EACH ROW EXECUTE FUNCTION public.trg_marketing_image_jobs_updated_at();

CREATE TABLE IF NOT EXISTS public.marketing_image_worker (
  id            TEXT PRIMARY KEY,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  info          JSONB NOT NULL DEFAULT '{}'      -- เวอร์ชันสคริปต์ · งานที่กำลังทำ (ไม่มีข้อมูลลูกค้า)
);

-- ล็อกไม่ให้ anon/authenticated (คีย์ที่ฝังในเบราว์เซอร์) อ่านหรือเขียน — ให้เฉพาะ service_role
ALTER TABLE public.marketing_image_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_image_worker ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_image_jobs, public.marketing_image_worker FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketing_image_jobs, public.marketing_image_worker TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.marketing_image_jobs_id_seq TO service_role;
-- ไม่ GRANT DELETE โดยตั้งใจ (ดูหัวไฟล์)

-- bucket เก็บภาพที่เจนเสร็จ: ไม่สาธารณะ (service role อ่าน/เขียนได้โดยไม่ต้องมี policy)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('marketing-images', 'marketing-images', false, 10485760, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

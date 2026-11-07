-- ============================================================
-- AssetX — คลังภาพอ้างอิงโปสเตอร์ที่เจ้าของส่งเข้าบอทเทเลแกรม
--
-- ทางเดินงาน:
--   เจ้าของส่งรูป (หรือไฟล์ jpg/png) เข้าห้องบอท AssetX พร้อมคำว่า "รูปตัวอย่าง" + หมายเหตุสั้น ๆ
--     → api/telegram-webhook.js ดาวน์โหลดจาก Telegram แล้วอัปโหลดขึ้น bucket marketing-images ใต้ poster-refs/
--       และเพิ่มแถวในตารางนี้ (status = new)
--     → scripts/image-worker.mjs บนคอมสำนักงานดึงไฟล์ลง .local/poster-refs/inbox/ แล้วตั้ง status = fetched
--   unclaimed = รูปในอัลบั้มที่มาถึงก่อนรูปที่มีคำบรรยาย (ยกเป็น new เมื่อคำบรรยายมาถึง)
--
-- การเข้าถึง: service role เท่านั้น (เบราว์เซอร์ไม่แตะ) · ไม่มี DELETE โดยตั้งใจ (รูปที่ไม่ใช้ตั้ง dismissed)
-- รันไฟล์นี้ครั้งเดียวใน Supabase Dashboard → SQL Editor (รันซ้ำได้) · ต้องรัน supabase_marketing_image_jobs.sql มาก่อน (bucket)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.poster_refs (
  id              BIGSERIAL PRIMARY KEY,
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('unclaimed', 'new', 'fetched', 'dismissed')),
  source          TEXT NOT NULL DEFAULT 'telegram',
  chat_id         TEXT,
  message_id      BIGINT,
  media_group_id  TEXT,                       -- อัลบั้มเดียวกันใน Telegram
  file_id         TEXT NOT NULL,              -- ไว้ขอไฟล์จาก Telegram ภายหลัง
  file_unique_id  TEXT NOT NULL UNIQUE,       -- กันส่งซ้ำ
  mime            TEXT,
  width           INTEGER,
  height          INTEGER,
  bytes           INTEGER,
  caption         TEXT,                       -- คำบรรยายเต็ม (ผ่านตัวลบข้อมูลบุคคลแล้ว)
  note            TEXT,                       -- หมายเหตุของเจ้าของ = คำบรรยายที่ตัดคำว่า "รูปตัวอย่าง" ออก
  storage_path    TEXT,                       -- poster-refs/<file_unique_id>.jpg ใน bucket marketing-images
  local_name      TEXT,                       -- ชื่อไฟล์ใน inbox บนคอมสำนักงานเมื่อดึงแล้ว
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  fetched_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_poster_refs_status ON public.poster_refs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_poster_refs_group  ON public.poster_refs (media_group_id);

CREATE OR REPLACE FUNCTION public.trg_poster_refs_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS poster_refs_updated_at ON public.poster_refs;
CREATE TRIGGER poster_refs_updated_at BEFORE UPDATE ON public.poster_refs
  FOR EACH ROW EXECUTE FUNCTION public.trg_poster_refs_updated_at();

ALTER TABLE public.poster_refs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.poster_refs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.poster_refs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.poster_refs_id_seq TO service_role;
-- ไม่ GRANT DELETE โดยตั้งใจ

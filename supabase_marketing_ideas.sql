-- ============================================================
-- AssetX — ระบบรีเสิร์ชโซเชียล/เทรนด์ (social-research · โปรไฟล์อสังหาฯ ขายฝาก/จำนอง)
-- ตาราง 3 ใบ:
--   marketing_ideas    คิวไอเดียจากเรดาร์ (ข่าว · ทางการ · ชุมชน · ขายทอดตลาด · YouTube · ปฏิทิน · สัญญาณภายใน · คนวางเอง)
--   marketing_content  คอนเทนต์ที่สร้างจากไอเดีย (ร่าง → อนุมัติ → โพสต์) + ref_code ให้ลีดอ้างกลับ
--   leads              ลีดแบบไม่มีข้อมูลบุคคล (ช่องทาง · กลุ่ม · บริการ · ประเภททรัพย์ · พื้นที่ · ช่วงวงเงิน) เพื่อวัดว่าโพสต์ไหนได้ลีด
--
-- การเข้าถึง: เบราว์เซอร์ไม่แตะตารางตรง — ผ่าน /api/marketing-ideas (ตรวจ session ของแอป · service role)
--             ตัวเก็บ/มุมเล่า: scripts/research-ideas.mjs ด้วย SUPABASE_SERVICE_ROLE_KEY จาก .env.local
-- ไม่มี DELETE โดยตั้งใจ: ไอเดียหมดอายุใช้ status='expired' (กุญแจกันซ้ำต้องอยู่ ไม่งั้นข่าวอายุยาววนกลับเข้าคิว)
-- รันไฟล์นี้ครั้งเดียวใน Supabase Dashboard → SQL Editor (รันซ้ำได้ ไม่ทับข้อมูล)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_ideas (
  id             BIGSERIAL PRIMARY KEY,
  status         TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'picked', 'dismissed', 'expired')),
  source         TEXT NOT NULL CHECK (source IN ('news', 'official', 'community', 'auction', 'youtube', 'social', 'internal', 'manual')),
  source_label   TEXT,                       -- ชื่อสำนัก/หน่วยงาน/ช่อง (news/official/auction ต้องอ้างในโพสต์ · community/youtube/social ห้ามอ้าง)
  subtype        TEXT,                       -- rate · fee_measure · valuation · law · scam · credit_market · market · auction_npa · community_q · competitor · internal · calendar
  title          TEXT NOT NULL,
  summary        TEXT,                       -- ข้อเท็จจริงสรุปด้วยคำเรา ≤ 7 ข้อ + ชื่อแหล่ง · ขึ้นต้น 📌/⚠️ เมื่อผ่านตัวถอดเนื้อหาจริงแล้ว · ห้ามเนื้อข่าวเต็ม
  url            TEXT,
  angle          TEXT,                       -- มุมจากแม่แบบ (สำรอง)
  angles         JSONB,                      -- [{label, brief}] × 3 จาก AI · null = ยังไม่ได้ทำ
  chosen_angle   TEXT,                       -- label ที่คนเลือก
  relevance      TEXT,                       -- ทำไมเกี่ยวกับเรา
  score          NUMERIC NOT NULL DEFAULT 0,
  related_sku    TEXT,                       -- ผูกทรัพย์/บริการ (null ได้)
  audience       TEXT[] CHECK (audience <@ ARRAY['A', 'B', 'C', 'D']),   -- A เจ้าของทรัพย์ต้องการเงิน · B นักลงทุน · C เจ้าของอยากขาย · D ผู้ซื้อ
  property_type  TEXT CHECK (property_type IN ('ที่ดิน', 'บ้านเดี่ยว', 'ทาวน์โฮม', 'ตึกแถว', 'คอนโด', 'อื่น')),
  service_area   TEXT,                       -- ระดับจังหวัด/อำเภอเท่านั้น
  event_date     DATE CHECK (event_date BETWEEN '2000-01-01' AND '2100-12-31'),   -- กันใส่ปี พ.ศ.
  event_key      TEXT,                       -- รวมข่าวเหตุการณ์เดียวกัน (ไม่ unique)
  content_id     BIGINT,                     -- คอนเทนต์ที่สร้างจากไอเดียนี้
  dismiss_reason TEXT,
  external_key   TEXT NOT NULL UNIQUE,       -- กันซ้ำข้ามรอบ (นับทุก status รวม expired)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_ideas_queue    ON public.marketing_ideas (status, score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_ideas_lane     ON public.marketing_ideas (status, source, subtype, score DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_ideas_noangles ON public.marketing_ideas (status) WHERE angles IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_ideas_event    ON public.marketing_ideas (event_date) WHERE event_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_ideas_evkey    ON public.marketing_ideas (event_key) WHERE event_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.trg_marketing_ideas_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS marketing_ideas_updated_at ON public.marketing_ideas;
CREATE TRIGGER marketing_ideas_updated_at BEFORE UPDATE ON public.marketing_ideas
  FOR EACH ROW EXECUTE FUNCTION public.trg_marketing_ideas_updated_at();

CREATE TABLE IF NOT EXISTS public.marketing_content (
  id         BIGSERIAL PRIMARY KEY,
  idea_id    BIGINT REFERENCES public.marketing_ideas(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'posted', 'rejected')),
  caption    TEXT,
  channel    TEXT,                           -- facebook · tiktok · line_oa …
  format     TEXT,                           -- รูปแบบโพสต์ (ใช้ในบทเรียน)
  ref_code   TEXT UNIQUE,                    -- รหัสสั้นในโพสต์/ลิงก์ เช่น ?r=K7Q2 ให้ลีดอ้างกลับ
  posted_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ลีดไม่มีข้อมูลบุคคล — ชื่อ/เบอร์อยู่ใน CRM (ตาราง customers) เท่านั้น
CREATE TABLE IF NOT EXISTS public.leads (
  id            BIGSERIAL PRIMARY KEY,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel       TEXT NOT NULL CHECK (channel IN ('messenger', 'line', 'phone', 'web_form', 'walk_in', 'other')),
  content_id    BIGINT REFERENCES public.marketing_content(id) ON DELETE SET NULL,
  ref_code      TEXT,
  heard_from    TEXT,                        -- "รู้จักเราจากโพสต์ไหน" ที่ลูกค้าตอบ (ผ่านตัวลบข้อมูลบุคคลก่อนบันทึก)
  audience      TEXT CHECK (audience IN ('A', 'B', 'C', 'D')),
  service       TEXT CHECK (service IN ('ขายฝาก', 'จำนอง', 'ฝากขาย', 'หาซื้อ', 'อื่น')),
  property_type TEXT,
  service_area  TEXT,                        -- จังหวัด/อำเภอ
  amount_band   TEXT CHECK (amount_band IN ('<500k', '500k-1m', '1-3m', '3-10m', '>10m')),
  qualified     BOOLEAN,                     -- ทรัพย์ในพื้นที่ · มีเอกสาร · วงเงินในเกณฑ์
  closed        BOOLEAN
);
CREATE INDEX IF NOT EXISTS idx_leads_received ON public.leads (received_at DESC);

-- ล็อกไม่ให้ anon/authenticated (คีย์ที่ฝังในเบราว์เซอร์) อ่านหรือเขียน — ให้เฉพาะ service_role
ALTER TABLE public.marketing_ideas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads             ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_ideas, public.marketing_content, public.leads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketing_ideas, public.marketing_content, public.leads TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.marketing_ideas_id_seq, public.marketing_content_id_seq, public.leads_id_seq TO service_role;
-- ไม่ GRANT DELETE โดยตั้งใจ (ดูหัวไฟล์)

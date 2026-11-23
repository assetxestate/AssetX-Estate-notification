-- ============================================================
-- AssetX Marketing — Content Brief + Proof Card + บันทึกการอนุมัติ (เฟส P0 · 23 พ.ย. 2569)
--
-- ทำไม: โพสต์ต้องตามกลับไปหาหลักฐานของแต่ละข้ออ้างได้ และการอนุมัติของคนต้องผูกกับเนื้อหาฉบับที่ตรวจจริง
--   - marketing_content_briefs    บรีฟ + บันทึกหน้างาน (1 บรีฟต่อ 1 คอนเทนต์ · content_id ว่างได้ก่อนส่งเข้ารอตรวจ)
--   - marketing_evidence_sources  แหล่งข้อมูล + สิทธิการเผยแพร่
--   - marketing_proof_claims      ข้ออ้าง (Proof Card) + สถานะการยืนยัน
--   - marketing_claim_sources     ข้ออ้าง ↔ แหล่งข้อมูล
--   - marketing_content_reviews   บันทึกการอนุมัติ (ผู้ตรวจ เวลา แฮชของเนื้อหาที่อนุมัติ) — เพิ่มอย่างเดียว ไม่แก้ ไม่ลบ
--
-- แยกเป็นแถวต่อรายการ (ไม่ฝังในเวิร์กสเปซทั้งก้อน) เพื่อไม่ให้สองแท็บ/สองเครื่องเขียนทับกัน: ทุกแถวมี version
--   การแก้ต้องส่ง version ที่อ่านมา ถ้าไม่ตรง = มีคนแก้ไปก่อน ระบบแจ้งแทนการทับเงียบ ๆ
--
-- การเข้าถึง: เบราว์เซอร์ไม่แตะตารางตรง — ผ่าน /api/marketing-proof ที่ตรวจ session ของแอป (service role) เท่านั้น
-- ไม่มี DELETE กับข้อมูลหลัก: ข้ออ้างที่ไม่ใช้ = status 'rejected' หรือ use_in_post = false (ยกเว้นตารางเชื่อม ซึ่งเป็นแค่ลิงก์)
-- ตารางเดิมทั้งหมด (marketing_workspaces ฯลฯ) ไม่ถูกแตะ · เลขคอนเทนต์ # เดิมไม่เปลี่ยน
-- รันไฟล์นี้ครั้งเดียวใน Supabase Dashboard → SQL Editor (รันซ้ำได้ ไม่ทับข้อมูล)
-- ยกเลิก: ดูท้ายไฟล์ (ROLLBACK) — ปิดธง MARKETING_PROOF_CARDS ก่อน แล้วระบบกลับไปทำงานแบบเดิมทันทีโดยไม่ต้องลบตาราง
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_content_briefs (
  id          BIGSERIAL PRIMARY KEY,
  content_id  TEXT,                               -- id ของโพสต์ในเวิร์กสเปซ (ว่างได้จนกว่าจะส่งเข้ารอตรวจ)
  content_no  INTEGER,                            -- เลขคอนเทนต์ # (สำเนาไว้ค้น ไม่ใช่ตัวแจกเลข)
  brand_id    TEXT NOT NULL DEFAULT 'assetx_estate',
  topic       TEXT NOT NULL DEFAULT '',
  audience    TEXT NOT NULL DEFAULT '',
  objective   TEXT NOT NULL DEFAULT '',
  input       JSONB NOT NULL DEFAULT '{}',        -- ช่องที่เหลือของบรีฟ + บันทึกหน้างาน (ห้ามมีชื่อ เบอร์ เลขเอกสารสิทธิ์ของลูกค้า)
  version     INTEGER NOT NULL DEFAULT 1,
  created_by  TEXT NOT NULL DEFAULT '',           -- ชื่อที่ผู้ใช้พิมพ์เอง (แอปมีบัญชีเดียว ไม่มีรหัสผู้ใช้)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_content_briefs_content_uidx
  ON public.marketing_content_briefs (content_id) WHERE content_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.marketing_evidence_sources (
  id                BIGSERIAL PRIMARY KEY,
  brief_id          BIGINT NOT NULL REFERENCES public.marketing_content_briefs (id),
  kind              TEXT NOT NULL DEFAULT 'other'
                    CHECK (kind IN ('official', 'own_field', 'own_media', 'listing', 'transaction', 'third_party', 'other')),
  title             TEXT NOT NULL DEFAULT '',
  source_url        TEXT NOT NULL DEFAULT '',
  asset_ref         TEXT NOT NULL DEFAULT '',     -- ชื่อ/ตำแหน่งไฟล์ในที่เก็บปิด (ไม่เก็บตัวไฟล์หรือ base64 ที่นี่)
  source_date       DATE,
  checked_at        DATE,
  permission_status TEXT NOT NULL DEFAULT 'unknown'
                    CHECK (permission_status IN ('granted', 'restricted', 'unknown', 'denied')),
  visibility        TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal')),
  metadata          JSONB NOT NULL DEFAULT '{}',
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_evidence_sources_brief_idx ON public.marketing_evidence_sources (brief_id);

CREATE TABLE IF NOT EXISTS public.marketing_proof_claims (
  id                  BIGSERIAL PRIMARY KEY,
  brief_id            BIGINT NOT NULL REFERENCES public.marketing_content_briefs (id),
  claim_text          TEXT NOT NULL,
  claim_type          TEXT NOT NULL DEFAULT 'NEEDS-CHECK'
                      CHECK (claim_type IN ('OWN-VERIFIED', 'OFFICIAL', 'MARKET-ASK', 'VERIFIED-SOLD', 'THIRD-PARTY', 'SIMULATED', 'NEEDS-CHECK')),
  category            TEXT NOT NULL DEFAULT 'general'
                      CHECK (category IN ('legal', 'price', 'market', 'field', 'process', 'general')),
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'needs_check', 'verified', 'rejected')),
  limitation          TEXT NOT NULL DEFAULT '',
  publishable_wording TEXT NOT NULL DEFAULT '',
  permission_status   TEXT NOT NULL DEFAULT 'unknown'
                      CHECK (permission_status IN ('granted', 'restricted', 'unknown', 'denied')),
  use_in_post         BOOLEAN NOT NULL DEFAULT TRUE,
  reviewer            TEXT NOT NULL DEFAULT '',
  reviewed_at         TIMESTAMPTZ,
  expires_at          DATE,
  version             INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_proof_claims_brief_idx ON public.marketing_proof_claims (brief_id);

CREATE TABLE IF NOT EXISTS public.marketing_claim_sources (
  claim_id      BIGINT NOT NULL REFERENCES public.marketing_proof_claims (id),
  source_id     BIGINT NOT NULL REFERENCES public.marketing_evidence_sources (id),
  evidence_note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (claim_id, source_id)
);

CREATE TABLE IF NOT EXISTS public.marketing_content_reviews (
  id            BIGSERIAL PRIMARY KEY,
  content_id    TEXT NOT NULL,
  content_no    INTEGER,
  brief_id      BIGINT REFERENCES public.marketing_content_briefs (id),
  content_hash  TEXT NOT NULL,                    -- sha256 ของเนื้อหา + ข้ออ้าง ณ เวลาอนุมัติ
  category      TEXT NOT NULL DEFAULT 'publish',
  decision      TEXT NOT NULL CHECK (decision IN ('approved', 'blocked', 'revoked')),
  blockers      JSONB NOT NULL DEFAULT '[]',
  warnings      JSONB NOT NULL DEFAULT '[]',
  claim_ids     JSONB NOT NULL DEFAULT '[]',      -- ข้ออ้างที่โพสต์ใช้ ณ เวลาอนุมัติ
  reviewer      TEXT NOT NULL DEFAULT '',
  reason        TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_content_reviews_content_idx ON public.marketing_content_reviews (content_id, id DESC);

CREATE OR REPLACE FUNCTION public.trg_marketing_proof_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS marketing_content_briefs_updated_at ON public.marketing_content_briefs;
CREATE TRIGGER marketing_content_briefs_updated_at BEFORE UPDATE ON public.marketing_content_briefs
  FOR EACH ROW EXECUTE FUNCTION public.trg_marketing_proof_updated_at();
DROP TRIGGER IF EXISTS marketing_evidence_sources_updated_at ON public.marketing_evidence_sources;
CREATE TRIGGER marketing_evidence_sources_updated_at BEFORE UPDATE ON public.marketing_evidence_sources
  FOR EACH ROW EXECUTE FUNCTION public.trg_marketing_proof_updated_at();
DROP TRIGGER IF EXISTS marketing_proof_claims_updated_at ON public.marketing_proof_claims;
CREATE TRIGGER marketing_proof_claims_updated_at BEFORE UPDATE ON public.marketing_proof_claims
  FOR EACH ROW EXECUTE FUNCTION public.trg_marketing_proof_updated_at();

-- ล็อกไม่ให้ anon/authenticated (คีย์ที่ฝังในเบราว์เซอร์) อ่านหรือเขียน — ให้เฉพาะ service_role
ALTER TABLE public.marketing_content_briefs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_proof_claims     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_claim_sources    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_content_reviews  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_content_briefs, public.marketing_evidence_sources, public.marketing_proof_claims,
  public.marketing_claim_sources, public.marketing_content_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketing_content_briefs, public.marketing_evidence_sources, public.marketing_proof_claims TO service_role;
GRANT SELECT, INSERT, DELETE ON public.marketing_claim_sources TO service_role;   -- ตารางเชื่อม: ถอดลิงก์ได้
GRANT SELECT, INSERT ON public.marketing_content_reviews TO service_role;         -- บันทึกการอนุมัติ: เพิ่มอย่างเดียว
GRANT USAGE, SELECT ON SEQUENCE public.marketing_content_briefs_id_seq, public.marketing_evidence_sources_id_seq,
  public.marketing_proof_claims_id_seq, public.marketing_content_reviews_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- ROLLBACK (ไม่ต้องรัน เว้นแต่จะถอดฟีเจอร์ออกถาวร)
--   1) ปิดธง: ลบ MARKETING_PROOF_CARDS ออกจาก Environment Variables แล้ว Redeploy → หน้า /marketing กลับเป็นแบบเดิมทันที
--   2) ถ้าต้องการลบตารางด้วย (ข้อมูลบรีฟ/หลักฐาน/บันทึกอนุมัติจะหายถาวร — สำรองก่อน):
--        DROP TABLE IF EXISTS public.marketing_content_reviews;
--        DROP TABLE IF EXISTS public.marketing_claim_sources;
--        DROP TABLE IF EXISTS public.marketing_proof_claims;
--        DROP TABLE IF EXISTS public.marketing_evidence_sources;
--        DROP TABLE IF EXISTS public.marketing_content_briefs;
--        DROP FUNCTION IF EXISTS public.trg_marketing_proof_updated_at();
-- ============================================================

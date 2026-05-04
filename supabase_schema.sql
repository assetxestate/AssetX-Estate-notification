-- ============================================================
-- AssetX Estate — Supabase Schema
-- วิธีใช้: เปิด Supabase Dashboard → SQL Editor → วางทั้งหมดแล้วกด Run
-- ============================================================

-- ── 1. ตารางลูกค้า ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id              TEXT PRIMARY KEY,           -- เช่น CID1774859320575
  name            TEXT NOT NULL,
  full_label      TEXT DEFAULT '',
  type            TEXT DEFAULT '',            -- จำนอง / ขายฝาก
  principal       NUMERIC DEFAULT 0,
  amount          NUMERIC DEFAULT 0,
  freq            TEXT DEFAULT '',
  contract_end_date DATE,
  line_user_id    TEXT DEFAULT '',
  location        TEXT DEFAULT '',
  deeds           JSONB DEFAULT '[]',
  disbursement    JSONB DEFAULT '{}',
  is_cancelled    BOOLEAN DEFAULT FALSE,
  income_type     TEXT DEFAULT 'commission',  -- 'commission' = มีค่าคอม+Advance 2%, 'interest' = รับดอกเบี้ยแทน
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. ตารางงวดชำระ (ความสัมพันธ์ 1 ลูกค้า → หลายงวด) ────────
CREATE TABLE IF NOT EXISTS payments (
  id           SERIAL PRIMARY KEY,
  customer_id  TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  installment  INT NOT NULL,
  date_str     DATE NOT NULL,
  UNIQUE(customer_id, installment)
);

-- ── 3. ตารางประวัติการชำระจริง (พร้อมสลิป) ──────────────────
CREATE TABLE IF NOT EXISTS payment_records (
  id           SERIAL PRIMARY KEY,
  customer_id  TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  installment  INT NOT NULL,
  paid_at      TEXT DEFAULT '',
  slip_url     TEXT DEFAULT '',
  slip_id      TEXT DEFAULT '',
  amount_paid  NUMERIC DEFAULT 0,
  note         TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, installment)
);

-- ── 4. ตารางสถานะสัญญา (ปิดแล้ว / ยกเลิก) ──────────────────
CREATE TABLE IF NOT EXISTS contract_statuses (
  customer_id   TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  status        TEXT NOT NULL,               -- 'ปิดแล้ว' / 'ยกเลิก'
  customer_name TEXT DEFAULT '',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. ตารางการประเมินอสังหาฯ ────────────────────────────────
CREATE TABLE IF NOT EXISTS valuations (
  id                    SERIAL PRIMARY KEY,
  recorded_at           TEXT DEFAULT '',
  assessment_date       DATE,
  assessor_name         TEXT DEFAULT '',
  project_name          TEXT DEFAULT '',
  assessment_type       TEXT DEFAULT '',
  property_type         TEXT DEFAULT '',
  property_subtype      TEXT DEFAULT '',
  title_deed_no         TEXT DEFAULT '',
  map_sheet             TEXT DEFAULT '',
  survey_page           TEXT DEFAULT '',
  land_no               TEXT DEFAULT '',
  province              TEXT DEFAULT '',
  district              TEXT DEFAULT '',
  subdistrict           TEXT DEFAULT '',
  area_rai              NUMERIC DEFAULT 0,
  area_ngan             NUMERIC DEFAULT 0,
  area_sqw              NUMERIC DEFAULT 0,
  total_sqw             NUMERIC DEFAULT 0,
  gov_price             NUMERIC DEFAULT 0,
  effective_market_price NUMERIC DEFAULT 0,
  market_value          NUMERIC DEFAULT 0,
  road_type             TEXT DEFAULT '',
  road_width            TEXT DEFAULT '',
  land_frontage         TEXT DEFAULT '',
  distance_from_main    TEXT DEFAULT '',
  zone_color            TEXT DEFAULT '',
  soil_condition        TEXT DEFAULT '',
  comp_price            TEXT DEFAULT '',
  comp_source           TEXT DEFAULT '',
  property_score        NUMERIC DEFAULT 100,
  ltv_rate              NUMERIC DEFAULT 50,
  fsv                   NUMERIC DEFAULT 0,
  recommended_loan      NUMERIC DEFAULT 0,
  requested_loan        NUMERIC DEFAULT 0,
  req_ltv_pct           NUMERIC DEFAULT 0,
  lat                   NUMERIC,
  lng                   NUMERIC,
  risks                 TEXT DEFAULT '',
  location_note         TEXT DEFAULT '',
  status                TEXT DEFAULT 'รอดำเนินการ',
  customer_name         TEXT DEFAULT '',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Migration: เพิ่ม disbursement column (run ถ้า table มีอยู่แล้ว) ──
-- ALTER TABLE customers ADD COLUMN IF NOT EXISTS disbursement JSONB DEFAULT '{}';

-- ── 6. ตาราง LINE destinations (กลุ่มแจ้งเตือน) ──────────────
CREATE TABLE IF NOT EXISTS destinations (
  id           TEXT PRIMARY KEY,             -- LINE User/Group ID
  label        TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. เปิด Row Level Security (RLS) แบบ public อ่าน/เขียนได้ ──
-- (ปรับ policy นี้เป็น auth-based ทีหลังเมื่อเพิ่ม multi-user)
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON customers         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON payments          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON payment_records   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON contract_statuses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON valuations        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON destinations      FOR ALL USING (true) WITH CHECK (true);

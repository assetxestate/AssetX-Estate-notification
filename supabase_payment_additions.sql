-- ============================================================
-- AssetX — ชำระเพิ่ม / ยกเว้นส่วนที่ขาด ของงวดดอกเบี้ย (สัญญาหลักและวงเงินเพิ่ม)
--
-- ปัญหาเดิม: payment_records และ topup_payment_records เก็บได้งวดละ 1 รายการ (บันทึกซ้ำ = ทับของเดิม)
--   ลูกค้าจ่ายไม่ครบแล้วมาจ่ายส่วนที่เหลือทีหลัง จึงบันทึกไม่ได้โดยไม่ลบยอดแรก
--   และระบบถือว่างวดที่มีบันทึก = จ่ายครบ แม้จ่ายมาไม่เต็มยอด
--
-- ตารางนี้: รายการถัดจากบันทึกแรกของงวด แบบเพิ่มอย่างเดียว (บันทึกแรกยังอยู่ที่ตารางเดิม)
--   kind = 'payment' เงินที่รับจริง · 'waiver' ยกเว้นส่วนที่ขาด (ปิดยอดค้าง ไม่นับเป็นเงินรับ)
--   ยกเลิกรายการ = ตั้ง voided_at และ void_reason (ไม่ลบจริง ตามกติกาห้ามลบประวัติการชำระ)
--   topup_id ว่าง = งวดของสัญญาหลัก
--
-- สิทธิ์: เบราว์เซอร์ไม่มีสิทธิ์ตรง ทุกอย่างผ่าน /api/payment-additions (ตรวจ session ของแอป)
--   และงานแจ้งเตือนรายวัน ซึ่งใช้ service role ฝั่งเซิร์ฟเวอร์ · ไม่มีใครลบแถวได้
--
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งไฟล์แล้วกด Run (รันซ้ำได้ ไม่ทับข้อมูลเดิม)
-- ต้องมีอยู่แล้ว: customers (id text) · payment_records · contract_topups (id uuid) · topup_payment_records (topup_id uuid)
--   ฐานข้อมูลจริงของ AssetX มีครบแล้ว (contract_topups / topup_payment_records สร้างจากหน้า Supabase ไม่มีไฟล์ในรีโป)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_additions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  TEXT NOT NULL REFERENCES public.customers(id),
  topup_id     UUID REFERENCES public.contract_topups(id),
  installment  INTEGER NOT NULL CHECK (installment > 0),
  seq          INTEGER NOT NULL CHECK (seq > 0),
  kind         TEXT NOT NULL DEFAULT 'payment' CHECK (kind IN ('payment', 'waiver')),
  paid_at      DATE NOT NULL,
  amount       NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  slip_url     TEXT NOT NULL DEFAULT '',
  slip_id      TEXT NOT NULL DEFAULT '',
  note         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at    TIMESTAMPTZ,
  void_reason  TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS payment_additions_customer_idx ON public.payment_additions (customer_id, installment);
CREATE INDEX IF NOT EXISTS payment_additions_topup_idx ON public.payment_additions (topup_id, installment) WHERE topup_id IS NOT NULL;

-- ลำดับรายการต่องวดห้ามซ้ำ: สองคำขอที่อ่านยอดของงวดชุดเดียวกันแล้วบันทึกพร้อมกันจะได้ลำดับเดียวกัน
-- ฐานข้อมูลจึงรับได้รายการเดียว (กันบันทึกเงินก้อนเดียวกันสองครั้ง หรือยกเว้นเกินยอดที่ขาด)
CREATE UNIQUE INDEX IF NOT EXISTS payment_additions_seq_key
  ON public.payment_additions (customer_id, (COALESCE(topup_id::text, '')), installment, seq);

ALTER TABLE public.payment_additions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_additions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_additions TO service_role;
-- ไม่ให้ลบแม้แต่ service role: ประวัติการชำระต้องอยู่ครบ (ยกเลิกด้วย voided_at แทน)
REVOKE DELETE, TRUNCATE ON public.payment_additions FROM service_role;

-- หมายเหตุ: foreign key ไม่ CASCADE โดยตั้งใจ — ลบวงเงินเพิ่มหรือลูกค้าที่มีประวัติชำระเพิ่มไม่ได้ (ฐานข้อมูลจะปฏิเสธ)

-- ── กันประวัติขาดตอน: ฐานข้อมูลบังคับเอง ไม่พึ่งหน้าเว็บ ─────────────────
-- 1) ลบบันทึกครั้งแรกของงวด (payment_records / topup_payment_records) ไม่ได้ ถ้างวดนั้นยังมีรายการชำระเพิ่ม/ยกเว้นที่ไม่ได้ยกเลิก
--    กันทั้งหน้าเว็บรุ่นเก่าที่ไม่มีการตรวจ และสองเครื่องที่กดลบกับกดชำระเพิ่มพร้อมกัน
--    SECURITY DEFINER เพราะผู้ลบจากหน้าเว็บ (anon) ไม่มีสิทธิ์อ่านตาราง payment_additions
-- 2) เพิ่มรายการได้เฉพาะงวดที่มีบันทึกครั้งแรก และล็อกแถวบันทึกนั้นไว้จนบันทึกเสร็จ (FOR KEY SHARE)
--    การลบที่เกิดพร้อมกันจึงต้องรอ แล้วถูกข้อ 1 ปฏิเสธ — หรือการเพิ่มถูกปฏิเสธเพราะบันทึกแรกถูกลบไปก่อนแล้ว
CREATE OR REPLACE FUNCTION public.payment_first_record_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  has_active BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'payment_records' THEN
    SELECT EXISTS (SELECT 1 FROM public.payment_additions a
                   WHERE a.customer_id = OLD.customer_id AND a.topup_id IS NULL
                     AND a.installment = OLD.installment AND a.voided_at IS NULL) INTO has_active;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.payment_additions a
                   WHERE a.topup_id = OLD.topup_id AND a.installment = OLD.installment AND a.voided_at IS NULL) INTO has_active;
  END IF;
  IF has_active THEN
    -- ลบต่อเนื่องจากการลบลูกค้า/วงเงินเพิ่ม (trigger ซ้อน) = ลบทั้งก้อนไม่ได้เพราะมีประวัติ ไม่ใช่ให้ไปยกเลิกรายการ
    IF pg_trigger_depth() > 1 THEN
      RAISE EXCEPTION 'ลบไม่ได้: มีประวัติชำระเพิ่ม/ยกเว้นผูกอยู่ (ประวัติการชำระห้ามลบ)' USING ERRCODE = '23503';
    END IF;
    RAISE EXCEPTION 'ลบบันทึกการชำระครั้งแรกไม่ได้: งวดนี้มีรายการชำระเพิ่ม/ยกเว้นที่ยังใช้อยู่ — ยกเลิกรายการเหล่านั้นก่อน';
  END IF;
  RETURN OLD;
END
$$;

DROP TRIGGER IF EXISTS payment_records_keep_additions ON public.payment_records;
CREATE TRIGGER payment_records_keep_additions BEFORE DELETE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.payment_first_record_guard();
DROP TRIGGER IF EXISTS topup_payment_records_keep_additions ON public.topup_payment_records;
CREATE TRIGGER topup_payment_records_keep_additions BEFORE DELETE ON public.topup_payment_records
  FOR EACH ROW EXECUTE FUNCTION public.payment_first_record_guard();

CREATE OR REPLACE FUNCTION public.payment_additions_need_first_record() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.topup_id IS NULL THEN
    PERFORM 1 FROM public.payment_records r
      WHERE r.customer_id = NEW.customer_id AND r.installment = NEW.installment
      FOR KEY SHARE;
  ELSE
    PERFORM 1 FROM public.topup_payment_records r
      WHERE r.topup_id = NEW.topup_id AND r.installment = NEW.installment
      FOR KEY SHARE;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'งวดนี้ยังไม่มีบันทึกการชำระครั้งแรก' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS payment_additions_need_first_record ON public.payment_additions;
CREATE TRIGGER payment_additions_need_first_record BEFORE INSERT ON public.payment_additions
  FOR EACH ROW EXECUTE FUNCTION public.payment_additions_need_first_record();

-- ฟังก์ชันของ trigger ไม่ต้องให้ใครเรียกตรง
REVOKE ALL ON FUNCTION public.payment_first_record_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_additions_need_first_record() FROM PUBLIC, anon, authenticated;

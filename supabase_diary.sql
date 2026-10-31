-- ============================================================
-- AssetX — ไดอารี่งาน (daily diary) ย้ายจากหน้า claude.ai มาอยู่ในแอป
-- ตาราง 2 ใบ: diary_days (บันทึกละวัน payload JSON รูปเดียวกับ .claude/diary/days/*.json)
--             diary_commands (คำสั่งที่เจ้าของพิมพ์จากหน้า /diary ให้ Claude ทำ)
--
-- การเข้าถึง: เบราว์เซอร์ไม่แตะตารางตรง — ผ่าน /api/diary ที่ตรวจ session ของแอป (service role เท่านั้น)
--             Claude Code ใช้ scripts/diary-sync.mjs ด้วย SUPABASE_SERVICE_ROLE_KEY จาก .env.local
-- รันไฟล์นี้ครั้งเดียวใน Supabase Dashboard → SQL Editor (รันซ้ำได้ ไม่ทับข้อมูล)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.diary_days (
  date        TEXT PRIMARY KEY CHECK (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  payload     JSONB NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.diary_commands (
  id          TEXT PRIMARY KEY,
  text        TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'doing', 'done', 'dropped')),
  result      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at     TIMESTAMPTZ,
  version     INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS diary_commands_status_idx ON public.diary_commands (status, created_at DESC);

-- ล็อกไม่ให้ anon/authenticated (คีย์ที่ฝังในเบราว์เซอร์) อ่านหรือเขียน — ให้เฉพาะ service_role
ALTER TABLE public.diary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.diary_days FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.diary_commands FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.diary_days TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.diary_commands TO service_role;
-- ไม่ GRANT DELETE โดยตั้งใจ: ประวัติคำสั่งและบันทึกรายวันไม่ลบ (เปลี่ยนสถานะเป็น dropped แทน)

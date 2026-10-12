-- Staff access is mediated by api/notices.js and the existing signed session.
-- Never grant browser roles direct access to notice/billing data.
CREATE TABLE IF NOT EXISTS public.notice_records (
  id UUID PRIMARY KEY,
  customer_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notice_records_customer_idx ON public.notice_records(customer_id);
ALTER TABLE public.notice_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notice_records FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notice_records TO service_role;

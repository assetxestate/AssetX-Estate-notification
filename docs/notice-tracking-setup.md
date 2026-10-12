# Notice Tracking

## Installation

1. Run `supabase_notice_records.sql` in the **AssetX** project's SQL editor.
2. Configure server-only `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` (or existing `VITE_SUPABASE_URL`). Never prefix the service key with `VITE_`.
3. Deploy the Notice route, dashboard component, and helpers together. Existing `SESSION_SECRET` authenticates staff through the shared AssetX login.
4. Verify authenticated create/read/update and unauthenticated 401. Browser roles must not read `notice_records` directly.

## Scope

- Separate prepared, sent, received-with-evidence, and returned states. Sending is not proof of receipt or legal validity.
- Unknown date and unknown cost remain blank/null, not today's date or zero.
- Multiple dispatch records per customer. Optimistic version checks prevent silent concurrent overwrites. Edits do not retain prior field values; this is not an immutable legal audit log.
- Receipt number/date, issuer, description, amount and payment date/status are recorded. One JPG, PNG or PDF receipt up to 2 MiB can be attached per dispatch. Upload occurs on save; replacing it retains the old private object. This does not issue a tax invoice.
- Storage bucket `notice-receipts` must be private, with a 2097152-byte limit and JPEG/PNG/PDF MIME allowlist. Server-only uploads; authenticated download links expire after 60 seconds. No public storage policy is required.
- Records are never hard-deleted through this API. The customer's payment schedule and risk level are unchanged.
- Users must verify the recipient and evidence against original documents. No legal deadline calculation or automatic dispatch.

## Current Release Gate

Local implementation only; not deployed. Database and server credentials verified. Private receipt bucket provisioned. A synthetic attachment was uploaded and downloaded through the local API, public access was denied, and the test record/file were removed. No existing customer dispatch records were changed. Browser interaction has not yet been verified.

## Verification

`node --test src/lib/noticeTracking.test.mjs server/notices.test.mjs`

`npm run build`

# Underwriting Skill Integration

Purpose: connect the `underwrite-thai-real-estate-collateral` Hermes skill to AssetX Estate's property valuation workflow so the app can produce faster, more conservative, and more repeatable collateral decisions.

## Source Skill

Local skill package:

```text
C:\Users\jakka\AssetX-Estate-notification\Hermes\underwrite-thai-real-estate-collateral-v2.0.0\underwrite-thai-real-estate-collateral
```

Important files:

- `SKILL.md`: main exit-first underwriting instructions.
- `references/valuation-framework.md`: MV, QSV, FSV, NRV, comparable hierarchy, stress-test logic.
- `references/scoring-rubric.md`: weighted risk score and approval bands.
- `references/output-spec.md`: required underwriting report structure.
- `scripts/underwriting_calculator.py`: area conversion, LTV, and stress scenario calculator.

## Fit With AssetX

The skill is a strong match for AssetX because it formalizes the exact behavior needed for secured real-estate work:

- Do not anchor on appraisal price, seller ask, or government valuation.
- Separate Market Value, Quick Sale Value, Forced Sale Value, and Net Recovery Value.
- Treat liquidity and exit buyer pool as valuation variables.
- Use legal/title/access/zoning checks as approval gates.
- Produce a clear decision: Accept, Accept with Conditions, Renegotiate, or Decline.

## Recommended Architecture

### 1. Hermes Decision Layer

Use the skill as the primary Hermes workflow whenever AssetX asks for:

- collateral review
- sale with right of redemption review
- mortgage review
- lending ceiling
- appraisal report challenge
- distressed-sale or forced-sale estimate

Hermes should receive structured context from the app:

```json
{
  "mode": "assetx-underwriting",
  "valuation": {},
  "nearby_price_points": [],
  "customer_or_transaction_summary": {},
  "known_documents": [],
  "missing_fields": []
}
```

The Hermes response should follow `references/output-spec.md`.

### 2. App UI Layer

Add an underwriting section after the valuation result step:

- Executive decision
- MV / QSV / FSV / NRV table
- Liquidity score
- Stress-test table
- Safe / Recommended / Maximum exposure
- Legal and DD risks
- Conditions precedent
- Confidence grade

This should be shown as an internal preliminary underwriting memo, not a certified appraisal.

### 3. Supabase Data Layer

Current table already added:

- `area_price_points`

Recommended future tables:

- `underwriting_reports`: save Hermes underwriting memo output by valuation id.
- `valuation_comparables`: save detailed comparable adjustment grid.
- `valuation_dd_checklist`: save legal/title/access/zoning checklist status.

Keep customer PII out of public research notes and do not expose service-role keys to the client.

### 4. Price Intelligence Layer

Use `area_price_points` as the internal comparable memory.

Workflow:

1. User enters location or map pin.
2. App pulls nearby price points.
3. App sends those comps to Hermes.
4. Hermes applies the underwriting skill.
5. Staff verifies or edits result.
6. Final accepted comps are saved back into `area_price_points`.

This creates a feedback loop where AssetX becomes better in repeated operating areas.

### 5. Obsidian Research Layer

Long-form market/legal/business research should be stored in:

```text
J:\ส่วนตัว\เลขาส่วนตัว\Obsidain\JK Knowledge\Research\AssetX\
```

Recommended folders:

- `Market`
- `Legal`
- `Marketing`
- `Business`
- `Property-Valuation`

Use Obsidian for reusable knowledge and Supabase for structured valuation/comparable data.

## Implementation Phases

### Phase 1: Skill Registration

Install or copy the skill into the active Hermes skill folder so Hermes can invoke it by name.

Recommended active location:

```text
C:\Users\jakka\AppData\Local\hermes-clean\skills\business\underwrite-thai-real-estate-collateral
```

Then update AssetX Hermes instructions so valuation prompts explicitly call this skill for collateral underwriting.

### Phase 2: Structured Hermes Endpoint

Add an app API route such as:

```text
api/underwrite-valuation.js
```

Status: implemented as a streaming Hermes endpoint.

The route:

- requires the normal AssetX login session
- accepts valuation context from the frontend
- calls Hermes with `mode=assetx-underwriting`
- forces the underwriting prompt contract: Thai-only output, one final decision, MV/QSV/FSV/NRV, exposure bands, legal/DD risks, and conditions precedent
- returns an AssetX-compatible server-sent event stream

Request body:

```json
{
  "valuation": {},
  "nearbyPricePoints": [],
  "documents": [],
  "missingFields": [],
  "instructions": ""
}
```

Endpoint:

```text
POST /api/underwrite-valuation
```

### Phase 3: Underwriting UI

Add a button in `src/ValuationPage.jsx`:

```text
Generate Underwriting Memo
```

Display the memo in the final valuation step with the output sections required by the skill.

### Phase 4: Save Report

Persist the report in Supabase after staff review.

The first version can store JSON only. Later versions can split data into tables for analytics.

### Phase 5: Outcome Feedback

When a case is approved, rejected, redeemed, defaulted, or sold, write the result back into the valuation knowledge layer.

This is the most important long-term improvement because it trains AssetX on its own realized outcomes.

## Recommended Prompt Contract

System instruction for Hermes:

```text
Use the underwrite-thai-real-estate-collateral skill.
Apply exit-first, downside-focused underwriting.
Use nearby_price_points only as internal comparable evidence.
Separate Market Value, Quick Sale Value, Forced Sale Value, and Net Recovery Value.
Do not treat government valuation, appraisal report, seller ask, or listing price as self-validating.
Return the output in the mandatory underwriting report structure.
If facts are missing, label them Unknown / Must Verify and reduce confidence.
```

## Safety Rules

- The app must label generated underwriting as internal preliminary analysis.
- Legal/title/access/zoning risks must remain staff verification gates.
- A high score cannot override fatal legal defects.
- Research notes in Obsidian must not include customer PII.
- Public assessment chat must not access private customer or underwriting records.

## Best Next Step

Start with Phase 1 and Phase 2:

1. Register the skill in the active Hermes skill directory.
2. Create a dedicated underwriting API route.
3. Send one existing valuation plus nearby price points to Hermes.
4. Render the memo manually before automating storage.

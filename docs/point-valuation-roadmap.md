# Point-Level Property Valuation Roadmap

Purpose: make AssetX Estate faster and more accurate when estimating property value for a specific location, parcel, or nearby area.

## Current Baseline

The app already supports:

- DOL LandsMaps lookup through `api/landsmaps.js` and `src/lib/dolApi.js`.
- Treasury land valuation lookup through `api/treasury.js` and `src/lib/treasuryApi.js`.
- Valuation records with province, district, subdistrict, deed fields, government price, market price, comp price, and `lat`/`lng` in `valuations`.
- A rule-based valuation formula in `src/lib/valuationOptions.js`.

Current limitation: the market estimate is still mostly rule-based and depends heavily on manual comp input. It does not yet maintain a reusable point/area price intelligence layer.

## Target Capability

When a user enters or selects a property location, the system should quickly return:

- Government assessed price per square wah.
- Estimated market price per square wah.
- Confidence level.
- Nearby comparable range.
- Risk-adjusted forced-sale value.
- Recommended lending ceiling.
- Source trail showing where each number came from.

The output must be a preliminary internal estimate, not a certified appraisal.

For the underwriting decision layer that turns these estimates into Safe / Recommended / Maximum exposure, liquidity score, stress test, and Accept / Conditional / Renegotiate / Decline decision, see `docs/underwriting-skill-integration.md`.

## Recommended Data Layers

### 1. Official Valuation Layer

Source:

- Treasury land valuation data.
- DOL LandsMaps parcel data where available.

Use for:

- Baseline official value.
- Parcel metadata.
- Cross-checking title deed, land number, map sheet, area, and coordinates.

### 2. Internal Comparable Layer

Source:

- Past AssetX valuations.
- Approved deals.
- Rejected deals with reason.
- Sale/listing comps manually verified by staff.

Use for:

- Area-specific market adjustment.
- Reuse of known prices near a coordinate.
- Better decisions in repeated operating zones.

Suggested table: `area_price_points`

Fields:

- `id`
- `source_type`: `assetx_valuation`, `approved_deal`, `manual_comp`, `public_listing`, `official`
- `province`
- `district`
- `subdistrict`
- `lat`
- `lng`
- `radius_m`
- `property_type`
- `property_subtype`
- `land_area_sqw`
- `price_per_sqw`
- `total_price`
- `transaction_or_listing_date`
- `source_url`
- `source_note`
- `confidence_score`
- `verified_by`
- `created_at`
- `updated_at`

### 3. Market Research Layer

Source:

- Tavily research.
- Public market reports.
- Government and central bank data.
- Local news and infrastructure updates.

Store long-term research notes in Obsidian:

```text
J:\ส่วนตัว\เลขาส่วนตัว\Obsidain\JK Knowledge\Research\AssetX\Market\
J:\ส่วนตัว\เลขาส่วนตัว\Obsidain\JK Knowledge\Research\AssetX\Property-Valuation\
```

Use for:

- Province/zone-level trend adjustment.
- Local demand/supply context.
- Risk notes that should not be converted into exact numbers without verification.

## Valuation Method

### Step 1. Resolve Location

Input can be:

- Province, district, subdistrict.
- Title deed number and land office area.
- DOL parcel lookup result.
- Map pin `lat`/`lng`.

Goal: get reliable coordinates and parcel metadata.

### Step 2. Pull Official Price

Use Treasury data as the baseline:

```text
official_price_per_sqw
```

If exact parcel price is unavailable, use nearest matching land number/map sheet or area-level official data and lower confidence.

### Step 3. Find Nearby Comps

Search internal `area_price_points` by distance from `lat`/`lng`.

Suggested initial radii:

- Urban: 500 m, then 1 km, then 2 km.
- Suburban: 1 km, then 3 km, then 5 km.
- Rural/agricultural: 3 km, then 5 km, then 10 km.

Prefer comps with:

- Same property subtype.
- Recent date.
- Verified source.
- Similar road access and plot size.
- Same or similar zoning.

### Step 4. Adjust Comparable Prices

Adjust for:

- Time since comp date.
- Plot size.
- Road width/access.
- Frontage.
- Zoning.
- Soil/fill condition.
- Flood history.
- Utilities.
- Legal/title risk.

Reuse existing factors in `src/lib/valuationOptions.js` first, then refine with actual historical outcomes.

### Step 5. Estimate Market Price

Use weighted blend:

```text
market_price = official_price_weight + nearby_comp_weight + manual_adjustment_weight
```

Initial conservative weighting:

- Official price: 30%
- Verified nearby comps: 50%
- Location/risk adjustment: 20%

If no good comps exist:

- Official price: 60%
- Location/risk adjustment: 40%
- Mark confidence as low.

### Step 6. Generate Confidence Score

Score factors:

- Exact coordinate available.
- Exact official parcel match.
- Number of nearby comps.
- Freshness of comps.
- Same property subtype.
- Verified source.
- No serious legal/access risk.

Suggested confidence levels:

- High: 80-100
- Medium: 50-79
- Low: 0-49

### Step 7. Lending Decision Layer

Use existing FSV/LTV logic after market estimate:

- Calculate market value.
- Calculate FSV.
- Apply risk band and capped LTV.
- Show recommended loan range, not just one number.

Example:

```text
Conservative loan: 45% of FSV
Normal loan: 55% of FSV
Maximum policy loan: capped LTV from risk band
```

## Implementation Phases

### Phase 1. Internal Price Point Database

Add `area_price_points` table and simple admin UI to add verified comps.

Goal: stop losing local market knowledge after each valuation.

### Phase 2. Nearby Comp Finder

Use `lat`/`lng` to search nearest internal comps and show them in the valuation page.

Goal: when a new property is assessed, staff immediately sees nearby known prices.

### Phase 3. Confidence And Source Trail

Show confidence score and source trail in each valuation result.

Goal: users know whether the number is strong, medium, or only a rough estimate.

### Phase 4. Tavily Market Research Support

For areas with weak internal data, ask Hermes/Tavily to produce current market notes and store them in Obsidian under `Research\AssetX\Market` or `Research\AssetX\Property-Valuation`.

Goal: research supports human judgment, not automatic pricing by itself.

### Phase 4.5. Underwriting Skill Decision Layer

Use the `underwrite-thai-real-estate-collateral` Hermes skill to convert valuation evidence into a collateral decision:

- Market Value, Quick Sale Value, Forced Sale Value, and Net Recovery Value.
- Liquidity score and likely exit buyer pool.
- Stress-test table.
- Safe / Recommended / Maximum exposure.
- Legal/title/access/zoning conditions precedent.
- Final Accept / Accept with Conditions / Renegotiate / Decline decision.

### Phase 5. Outcome Feedback

Record final approved price, actual disbursement, repayment outcome, default, resale recovery, and realized sale price where available.

Goal: improve future valuation factors using real AssetX outcomes.

## Safety Rules

- Do not show a price as "exact" unless it is an official assessed price from a cited source.
- Market estimate must be labeled as an internal preliminary estimate.
- Keep customer identity separate from public comps and research notes.
- Do not store customer PII in Obsidian research notes.
- For legal, title, encumbrance, and enforcement concerns, require staff verification before final approval.

## Suggested Hermes Prompt

```text
ใช้ assetx-estate skill
ช่วยวิเคราะห์ราคาประเมินรายจุดสำหรับทรัพย์นี้:
- จังหวัด:
- อำเภอ:
- ตำบล:
- พิกัด:
- ประเภททรัพย์:
- ขนาด:
- ถนน/การเข้าถึง:

ให้ตรวจจากข้อมูลในระบบก่อน แล้วค่อยเสนอว่าต้องใช้ Tavily research เพิ่มหรือไม่
แยกผลเป็น:
1. ราคาประเมินรัฐ
2. ราคา comp ใกล้เคียง
3. ราคาตลาดประเมินเบื้องต้น
4. confidence
5. ข้อควรตรวจสอบก่อนปล่อยสินเชื่อ
ยังไม่เขียนไฟล์หรือแก้ข้อมูลจริง
```

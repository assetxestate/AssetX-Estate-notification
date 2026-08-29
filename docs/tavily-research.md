# Tavily Research Workflow

This project uses Tavily as the preferred Hermes web-search backend for current research.

## Purpose

Use Tavily for AssetX Estate research involving:

- Thai real-estate secured lending, mortgages, sale with right of redemption, land valuation, and enforcement context.
- Business strategy, marketing trends, competitor signals, and customer education topics.
- Legal and regulatory research that needs current sources.
- Market analysis, property price trends, credit-risk context, and macroeconomic context.

## Hermes Configuration

Hermes should use Tavily as the web backend:

```yaml
web:
  backend: tavily
```

Set the API key in Hermes or the deployment environment:

```text
TAVILY_API_KEY=tvly-your-key
```

Do not put Tavily keys in `VITE_` variables or client-side code.

## Research Output Location

Store approved long-term research notes in the Obsidian knowledge vault only:

```text
J:\ส่วนตัว\เลขาส่วนตัว\Obsidain\JK Knowledge\Research\AssetX\
```

Use these subfolders:

```text
Research\AssetX\Market\
Research\AssetX\Legal\
Research\AssetX\Marketing\
Research\AssetX\Business\
Research\AssetX\Property-Valuation\
```

Use `marketing/` in the AssetX repo only for content, plans, or artifacts that are ready to be used by the app/website/marketing workflow. Do not use it as the default research archive.

If the research is only a temporary draft, show the draft first and ask before writing a file.

Use this naming pattern:

```text
YYYY-MM-DD-topic-slug.md
```

Examples:

```text
J:\ส่วนตัว\เลขาส่วนตัว\Obsidain\JK Knowledge\Research\AssetX\Market\2026-08-29-thai-mortgage-market.md
J:\ส่วนตัว\เลขาส่วนตัว\Obsidain\JK Knowledge\Research\AssetX\Legal\2026-08-29-sale-with-right-of-redemption-law.md
J:\ส่วนตัว\เลขาส่วนตัว\Obsidain\JK Knowledge\Research\AssetX\Property-Valuation\2026-08-29-property-credit-risk.md
```

## Summary Format

Each research note should include:

```markdown
---
tags:
  - assetx
  - research
source_tool: tavily
date_researched: YYYY-MM-DD
---

# Research Title

Date researched: YYYY-MM-DD
Research purpose: ...

## Executive Summary

...

## Key Findings

- ...

## Business Implications For AssetX Estate

- ...

## Marketing / Content Ideas

- ...

## Legal Or Compliance Caveats

- ...

## Sources

- Source title - URL - accessed YYYY-MM-DD

## Follow-Up Questions

- ...
```

## Rules

- Prefer official, primary, or high-reputation sources for legal, financial, and market claims.
- Include source URLs for every important factual claim.
- Use the current date in the note so later readers know when the information was checked.
- Separate facts, analysis, and recommendations.
- For legal/regulatory topics, say clearly when a lawyer or official source should verify before production use.
- Do not paste long copyrighted text into project files. Summarize and cite URLs.
- Do not store secrets, API keys, customer PII, or private customer financial details in research notes.
- When writing to Obsidian, keep the note link-friendly: use clear headings, source URLs, and frontmatter tags.
- After writing an Obsidian research note, update the Obsidian research index if one exists.

## Suggested Hermes Prompt

```text
ใช้ assetx-estate skill และ Tavily web research
ค้นคว้าหัวข้อ: <หัวข้อ>
เน้นแหล่งข้อมูลไทย/ทางการ/น่าเชื่อถือ
สรุปเป็นภาษาไทย พร้อม source URL และวันที่ค้น
ยังไม่เขียนไฟล์จริง ให้แสดง draft ก่อน
ถ้าอนุมัติ ให้เก็บใน Obsidain/JK Knowledge/Research/AssetX/ ตามหมวดที่เหมาะสม
```

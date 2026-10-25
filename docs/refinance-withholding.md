# Refinance withholding estimates

Reviewed: 2026-10-25. These estimates concern registration-day withholding,
not the investor's annual personal income tax. Confirm final amounts with DOL.

Supported automatic scope: a single individual original buyer receiving timely
redemption; a single individual seller redeeming and reselling with redemption
rights on the same registration date. Other cases use manual verified amounts.

- Old investor: current official assessed value; calendar holding years from
  original sale-with-redemption registration to redemption registration.
- New seller: same-day redemption and resale counts as one calendar holding year
  for withholding, distinct from the five-year SBT ownership test.
- Reuse calculateIndividualWht with ordinary acquisition expense rates and no
  annual PIT zero-rate allowance. Do not apply annual redemption-income expenses.
- Both automatic taxes are financed in full. Manual mode can record only the
  portion financed; zero does not assert tax exemption.
- Existing manually entered drafts retain manual mode on upgrade.

Sources:
- DOL registration fee/tax manual (redemption basis and holding period):
  https://www.dol.go.th/media/813280496149729280/2026/01/6q8JueYhNksadgDC0EQ4XTy2.pdf
- DOL Ubon meeting record (same-day resale: one calendar year):
  https://www.dol.go.th/ubonratchathani/Documents/รายงานการประชุม3/Report_102361.2.pdf
- RD expense table:
  https://rd.go.th/fileadmin/tax_pdf/pit/2566/Ins90_131166_02.pdf
- RD property withholding example (no first-band exemption):
  https://www.rd.go.th/63765.html

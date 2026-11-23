---
name: QualCount-spreadsheet-to-workflow-mapper
description: Parse messy real-world NGO Excel or CSV outreach spreadsheets and safely convert them into deduplicated bottom-to-top multiplex partnership workflows via the Partnership Ledger MCP server.
---

# Spreadsheet-to-Workflow Mapper Skill

## Purpose
Real NGO spreadsheets contain messy column headers, Indian currency strings ("2.5L", "Rs 50,000", "1 Cr"), cold outreach lists of 100+ rows, and free-text status notes. Convert them into a clean, readable partnership graph without flooding the canvas.

## Strict Ingestion Rules
1. **Read Context First**: Call `QualCount-get_workbook_full(workbookId)` and `QualCount-search_entities("")` to learn the Workbook's `targetBudgetInr`, Root NGO placement ID, and existing entity names.
2. **Prevent the 100-Node Canvas Tangle (Ghoniem et al., 2005)**:
   - If the spreadsheet has > 30 rows, DO NOT blindly dump 100 cold uncontacted rows onto the visual canvas!
   - Separate rows into: (a) Active / Confirmed / Referred / Explicitly Declined rows -> import onto the canvas; (b) Uncontacted cold prospects -> ask the user whether to import only the top priority tier (10-25 nodes) or group them cleanly.
3. **Currency Normalization (India-Aware)**:
   - Convert rupee strings (`₹2.5 Lakh` = 250000, `₹1.2 Cr` = 12000000, `50k` = 50000) into strict `valuePct = (amountInr / targetBudgetInr) * 100` rounded to 1 decimal place for `green` branches, or `inKindValueInr` for non-cash `white` assets.
4. **Status Mapping**:
   - Positive confirmed commitments -> `"tick"`
   - Declined / rejected / no budget -> `"cross"`
   - Contacted / awaiting reply / follow-up -> `"pending"`
5. **Referral Chain Detection**:
   - If a row has a `"Referred By"` or `"Introduced Through"` column naming Organization A, generate:
     (1) `yellow` branch `A -> Target` (`tick` if intro happened, `pending` if requested), AND
     (2) `white` branch `Root NGO -> Target` ONLY if the Target directly replied/engaged with the NGO.
6. **Commit & Tidy**:
   - Call `QualCount-batch_import_workflow_rows(workbookId, rows, runTidyUpAfter: true)`.
   - Report exact counts: imported, deduplicated/reused, skipped cold rows, and any ambiguous rows needing user review.

---
name: QualCount-partnership-graph-operator
description: Operate the Partnership Ledger MCP server to build, edit, deduplicate, and tidy bottom-to-top multiplex NGO partnership workbooks cleanly without breaking ownership or measurement rules.
---

# Partnership Graph Operator Skill

## Core Domain Rules (NEVER VIOLATE)
1. **Always Search Before Creating**: Before calling `QualCount-add_or_import_entity`, ALWAYS call `QualCount-search_entities` with partial keywords (e.g., "collectorate", "museum", "agrocell") to reuse existing master entities and avoid duplicates.
2. **Strict Three-Color Branch Semantics**:
   - `green`: Cash CSR/grant funding ONLY. `valuePct` MUST be a strict percentage of `targetBudgetInr` (e.g., ₹2.5L on ₹10L target = `25`, displayed as `M25`). Never put non-cash items on green lines.
   - `white`: Direct working relationships owned by the Root NGO (venues, attendance, co-hosting, direct staff ties). Optional verifiable `inKindValueInr` allowed for real market-value venue/asset savings.
   - `yellow`: Third-party introductions, referrals, and amplification bridges.
3. **Ownership Separation Rule**:
   - If Partner A introduces the NGO to Agency B, create a `yellow` branch `A -> B`.
   - NEVER draw a `white` branch `A -> B` to represent the NGO's relationship with B.
   - Only when Agency B directly engages with the Root NGO should you add a `white` branch `Root NGO -> B`.
4. **Preserve Declined Memory**:
   - When an organization says no, call `QualCount-update_branch` with `status: "cross"` instead of `QualCount-delete_branch`. Only delete genuine typos or accidental duplicates.
5. **No False Confirmations**:
   - Planned outreach or unconfirmed introductions MUST start as `status: "pending"`. Only set `status: "tick"` when concrete verification exists in user notes.
6. **Keep the Canvas Clean**:
   - After adding 2 or more nodes or branches, ALWAYS call `QualCount-run_tidy_up_layout(workbookId)` so the graph stays organized bottom-to-top with zero overlapping cards.

## Standard Workflow
1. Call `QualCount-list_workbooks` or `QualCount-get_workbook_full(workbookId)` to inspect current state.
2. Deduplicate entities via `QualCount-search_entities`.
3. Execute targeted mutations (`QualCount-add_or_import_entity`, `QualCount-create_branch`, `QualCount-update_branch`, `QualCount-update_placement_attributes`).
4. Run `QualCount-run_tidy_up_layout(workbookId)`.
5. Summarize changes concisely: nodes added/reused, branches updated, new `M%` funding, and any newly formed Double/Triple-Thread convergences.

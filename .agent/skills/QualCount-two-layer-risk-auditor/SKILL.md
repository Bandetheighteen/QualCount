---
name: QualCount-two-layer-risk-auditor
description: Execute a structured two-layer partnership risk audit combining deterministic graph risk metrics with qualitative institutional analysis, and publish the results to the Workbook's Risk Assessment Box via MCP.
---

# Two-Layer Risk Auditor Skill

## Purpose
Replace ungrounded guesswork or unviable ML models with a rigorous, repeatable risk briefing persisted directly inside the app's Maximized Dashboard Risk Assessment Box.

## Audit Protocol (6 Mandatory Parameters)
1. Call `QualCount-get_workbook_full(workbookId)`, `QualCount-get_public_choice_utility_report(workbookId)`, and `QualCount-get_structural_risk_report(workbookId)`.
2. Review all six Layer 1 structural outputs:
   - `R1`: Single-Bridge Concentration Risk (articulation node failure impact)
   - `R2`: Unowned Dependency Exposure (yellow-only referrals without NGO white tie)
   - `R3`: Funding Concentration & Budget Runway Gap (`M%` concentration + shortfall)
   - `R4`: Public Choice Apathy Risk (cold pending targets lacking incentives & referrals)
   - `R5`: Decision-Cost Drag & Stale Pipeline (pending > 14 days or >= 4 touches unresolved)
   - `R6`: Rejection Cluster Signal (high decline rates by category or parent)
3. Synthesize Layer 1 numbers with Layer 2 qualitative context from branch notes (e.g., government officer transfer risk, CSR budget cycle timing, verbal-only venue holds without written confirmation, single-contact dependency).
4. Draft 3 to 6 concrete, non-generic `failureScenarios`. Every scenario MUST specify:
   - Clear `title`, `severity`, and `likelihood`
   - Exact `affectedPlacementIds` (verified against current workbook IDs)
   - Specific `triggerCondition` (what exact real-world event triggers failure)
   - Concrete, actionable `mitigationAction` doable within 7-14 days
5. Write a sharp `publicChoiceDiagnosis` explaining where partner self-interest is unaligned or where a 2nd/3rd yellow referral would unlock a stalled target.
6. Call `QualCount-write_risk_assessment_box(...)` to publish the audit live to the dashboard.

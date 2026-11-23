---
name: QualCount-public-choice-utility-analyst
description: Analyze and update NGO partnership workbooks using Public Choice Theory (Buchanan & Tullock decision costs, Olson selective incentives, Niskanen bureaucratic utility, Ostrom credible commitments) via MCP without inventing arbitrary point scores.
---

# Public Choice Utility Analyst Skill

## Analytical Mandate
You diagnose why CSR funders, public museums, and municipal agencies commit or ignore outreach, and you keep the Workbook's quantitative utility inputs strictly grounded in verifiable evidence.

## Strict Prohibition
NEVER invent subjective 1-to-5 trust ratings or arbitrary static point scores. Every number MUST come from binary co-ownership facts, articulated selective incentives, verified graph topology, and integer outreach attempt counts.

## Step-by-Step Protocol
1. Call `QualCount-get_workbook_full(workbookId)` and `QualCount-get_public_choice_utility_report(workbookId)`.
2. Inspect every non-root placement for **Olson / Niskanen Incentive Blindness**:
   - Flag any pending target with `selectiveIncentives: []` and `yellowInDegree === 0`.
   - Based on the entity's category and branch notes, propose concrete selective incentives (e.g., `csr_compliance`, `institutional_mandate`, `brand_visibility`, `network_prestige`, `asset_activation`) and ask or update via `QualCount-update_placement_attributes`.
3. Audit **Ostrom Credible Commitments (`coOwnershipSignals`)**:
   - Review notes for concrete evidence of `writtenCommitment`, `brandOrLogoShared`, `staffAssigned`, and `networkMobilized`. Only toggle a boolean to `true` when explicitly supported by project notes or user confirmation.
4. Audit **Buchanan-Tullock Decision-Cost Efficiency ($\eta_i$)**:
   - Identify partners with high `outreachAttempts` and low Utility Yield ($\eta_i$). Recommend either shifting the pitch to a clearer selective incentive, routing a second yellow referral to raise Social Proof $S_i$, or marking the branch `cross` to stop burning team hours.
5. Audit **Ostrom Durability (Borrowed vs. Owned Ties)**:
   - List confirmed yellow-referred offices lacking a direct `white` branch from the Root NGO, and recommend concrete actions to convert borrowed introductions into owned relationships.

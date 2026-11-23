/**
 * QualCount: Visual Multiplex Partnership Management System
 * Native Spreadsheet Export Pipeline (src/io/spreadsheetExport.ts)
 * 
 * 100% Native Pure TypeScript — Zero external APIs, zero tokens, instant execution.
 * Generates RFC-4180 UTF-8 BOM CSV bundles and 4-tab XML Excel Workbooks.
 */

import type {
  Entity,
} from '../types/schema';
import type { WorkbookLike, WorkbookUtilityReport } from '../engine/utility';
import type { StructuralRiskReport } from '../engine/risk';

const UTF8_BOM = '\uFEFF';

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 1. Export CSV Bundle
 * Generates two RFC-4180 compliant, UTF-8 BOM-prefixed CSV strings:
 * - <slug>_nodes.csv: Organizations and Public Choice attributes
 * - <slug>_branches.csv: Multiplex branches and commitments
 */
export function exportCsvBundle(
  workbook: WorkbookLike,
  entities: Record<string, Entity>,
  utilityReport: WorkbookUtilityReport
): { nodesCsv: string; branchesCsv: string } {
  const targetBudget = workbook.targetBudgetInr ?? 1000000;
  const placementsList = Object.values(workbook.placements);
  const branchesList = Object.values(workbook.branches);

  // --- NODES CSV ---
  const nodeHeaders = [
    'entity_id',
    'name',
    'category',
    'is_root_ngo',
    'outreach_attempts',
    'selective_incentives',
    'written_commitment',
    'brand_logo_shared',
    'staff_assigned',
    'network_mobilized',
    'yellow_in_degree',
    'social_proof_s',
    'utility_score_u',
    'utility_yield_per_touch',
    'global_notes',
  ];

  const nodeRows: string[] = [nodeHeaders.join(',')];

  for (const plc of placementsList) {
    const ent = entities[plc.entityId];
    const metrics = utilityReport.partners[plc.placementId];
    const signals = plc.coOwnershipSignals || {
      writtenCommitment: false,
      brandOrLogoShared: false,
      staffAssigned: false,
      networkMobilized: false,
    };
    const yellowIn = branchesList.filter(
      (b) => b.targetPlacementId === plc.placementId && b.type === 'yellow' && b.status === 'tick'
    ).length;

    const row = [
      escapeCsvField(plc.entityId),
      escapeCsvField(ent?.name || 'Unknown'),
      escapeCsvField(ent?.category || 'other'),
      escapeCsvField(plc.isRootNgo ? 'TRUE' : 'FALSE'),
      escapeCsvField(plc.outreachAttempts ?? 1),
      escapeCsvField(plc.selectiveIncentives ? plc.selectiveIncentives.join('; ') : ''),
      escapeCsvField(signals.writtenCommitment ? 'TRUE' : 'FALSE'),
      escapeCsvField(signals.brandOrLogoShared ? 'TRUE' : 'FALSE'),
      escapeCsvField(signals.staffAssigned ? 'TRUE' : 'FALSE'),
      escapeCsvField(signals.networkMobilized ? 'TRUE' : 'FALSE'),
      escapeCsvField(yellowIn),
      escapeCsvField(metrics ? metrics.socialProofS.toFixed(2) : '0.00'),
      escapeCsvField(metrics ? metrics.utilityScoreU.toFixed(1) : (plc.isRootNgo ? '100.0' : '0.0')),
      escapeCsvField(metrics ? metrics.utilityYieldEta.toFixed(1) : (plc.isRootNgo ? '100.0' : '0.0')),
      escapeCsvField(ent?.globalNotes || ''),
    ];
    nodeRows.push(row.join(','));
  }

  // --- BRANCHES CSV ---
  const branchHeaders = [
    'branch_id',
    'source_org',
    'target_org',
    'branch_type',
    'status',
    'funding_pct',
    'funding_inr',
    'in_kind_inr',
    'note',
    'created_at',
    'updated_at',
  ];

  const branchRows: string[] = [branchHeaders.join(',')];

  for (const br of branchesList) {
    const srcPlc = workbook.placements[br.sourcePlacementId];
    const tgtPlc = workbook.placements[br.targetPlacementId];
    const srcName = (srcPlc ? entities[srcPlc.entityId]?.name : br.sourcePlacementId) || 'Unknown';
    const tgtName = (tgtPlc ? entities[tgtPlc.entityId]?.name : br.targetPlacementId) || 'Unknown';
    const fundingInr = br.valuePct ? Math.round((br.valuePct / 100) * targetBudget) : '';

    const row = [
      escapeCsvField(br.branchId),
      escapeCsvField(srcName),
      escapeCsvField(tgtName),
      escapeCsvField(br.type),
      escapeCsvField(br.status),
      escapeCsvField(br.valuePct !== undefined ? br.valuePct : ''),
      escapeCsvField(fundingInr),
      escapeCsvField(br.inKindValueInr !== undefined ? br.inKindValueInr : ''),
      escapeCsvField(br.note || ''),
      escapeCsvField(br.createdAt || ''),
      escapeCsvField(br.updatedAt || ''),
    ];
    branchRows.push(row.join(','));
  }

  return {
    nodesCsv: UTF8_BOM + nodeRows.join('\r\n'),
    branchesCsv: UTF8_BOM + branchRows.join('\r\n'),
  };
}

function escapeXml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 2. Export 4-Tab Excel Workbook (.xlsx / SpreadsheetML XML)
 * Produces an Excel-compatible multi-tab workbook with:
 * Tab 1: Executive Summary
 * Tab 2: Organizations & Utility
 * Tab 3: Branches & Outreach
 * Tab 4: Risk Assessment
 */
export async function exportExcelWorkbook(
  workbook: WorkbookLike,
  entities: Record<string, Entity>,
  utilityReport: WorkbookUtilityReport,
  riskReport: StructuralRiskReport
): Promise<Blob> {
  const targetBudget = workbook.targetBudgetInr ?? 1000000;
  const placementsList = Object.values(workbook.placements);
  const branchesList = Object.values(workbook.branches);

  const greenBranches = branchesList.filter((b) => b.type === 'green');
  const securedPct = greenBranches
    .filter((b) => b.status === 'tick')
    .reduce((sum, b) => sum + (b.valuePct || 0), 0);
  const securedInr = Math.round((securedPct / 100) * targetBudget);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#1C1B18"/>
   <Interior ss:Color="#F2EFE9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Bold">
   <Font ss:Bold="1"/>
  </Style>
 </Styles>

 <!-- Tab 1: Executive Summary -->
 <Worksheet ss:Name="Executive Summary">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Metric</Data></Cell>
    <Cell><Data ss:Type="String">Value</Data></Cell>
    <Cell><Data ss:Type="String">Notes</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Target Budget (INR)</Data></Cell>
    <Cell><Data ss:Type="Number">${targetBudget}</Data></Cell>
    <Cell><Data ss:Type="String">Total campaign funding target</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Secured Funding (%)</Data></Cell>
    <Cell><Data ss:Type="Number">${securedPct}</Data></Cell>
    <Cell><Data ss:Type="String">M% confirmed CSR grants</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Secured Funding (INR)</Data></Cell>
    <Cell><Data ss:Type="Number">${securedInr}</Data></Cell>
    <Cell><Data ss:Type="String">Confirmed cash in INR</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">In-Kind Asset Value (INR)</Data></Cell>
    <Cell><Data ss:Type="Number">${utilityReport.inKindEquivalentInr}</Data></Cell>
    <Cell><Data ss:Type="String">M_eq ${utilityReport.inKindEquivalentPct}% of target budget</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Workbook Utility Index (PUI)</Data></Cell>
    <Cell><Data ss:Type="Number">${utilityReport.pui}</Data></Cell>
    <Cell><Data ss:Type="String">Ratio-scale coalition strength (0-100)</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Actions Per Touch</Data></Cell>
    <Cell><Data ss:Type="Number">${utilityReport.actionsPerTouch}</Data></Cell>
    <Cell><Data ss:Type="String">Buchanan-Tullock efficiency</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Structural Risk Tier</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(riskReport.aggregateTier.toUpperCase())}</Data></Cell>
    <Cell><Data ss:Type="String">Layer 1 deterministic tier</Data></Cell>
   </Row>
  </Table>
 </Worksheet>

 <!-- Tab 2: Organizations & Utility -->
 <Worksheet ss:Name="Organizations &amp; Utility">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Organization</Data></Cell>
    <Cell><Data ss:Type="String">Category</Data></Cell>
    <Cell><Data ss:Type="String">Touches (d)</Data></Cell>
    <Cell><Data ss:Type="String">Selective Incentives</Data></Cell>
    <Cell><Data ss:Type="String">Proof (S)</Data></Cell>
    <Cell><Data ss:Type="String">Commitment (R)</Data></Cell>
    <Cell><Data ss:Type="String">Amplification (A)</Data></Cell>
    <Cell><Data ss:Type="String">Conversion (V)</Data></Cell>
    <Cell><Data ss:Type="String">Reinforcement (C)</Data></Cell>
    <Cell><Data ss:Type="String">Utility Score (U)</Data></Cell>
    <Cell><Data ss:Type="String">Yield (eta)</Data></Cell>
   </Row>
   ${placementsList
     .map((plc) => {
       const ent = entities[plc.entityId];
       const metrics = utilityReport.partners[plc.placementId];
       return `
   <Row>
    <Cell><Data ss:Type="String">${escapeXml(ent?.name || 'Unknown')}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(ent?.category || 'other')}</Data></Cell>
    <Cell><Data ss:Type="Number">${plc.outreachAttempts ?? 1}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(plc.selectiveIncentives?.join('; ') || 'None')}</Data></Cell>
    <Cell><Data ss:Type="Number">${metrics?.socialProofS ?? 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${metrics?.directCommitmentR ?? (plc.isRootNgo ? 1 : 0)}</Data></Cell>
    <Cell><Data ss:Type="Number">${metrics?.amplificationA ?? 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${metrics?.ownedConversionV ?? 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${metrics?.multiThreadReinforcementC ?? 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${metrics?.utilityScoreU ?? (plc.isRootNgo ? 100 : 0)}</Data></Cell>
    <Cell><Data ss:Type="Number">${metrics?.utilityYieldEta ?? (plc.isRootNgo ? 100 : 0)}</Data></Cell>
   </Row>`;
     })
     .join('')}
  </Table>
 </Worksheet>

 <!-- Tab 3: Branches & Outreach -->
 <Worksheet ss:Name="Branches &amp; Outreach">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Branch ID</Data></Cell>
    <Cell><Data ss:Type="String">Source</Data></Cell>
    <Cell><Data ss:Type="String">Target</Data></Cell>
    <Cell><Data ss:Type="String">Type</Data></Cell>
    <Cell><Data ss:Type="String">Status</Data></Cell>
    <Cell><Data ss:Type="String">Value M%</Data></Cell>
    <Cell><Data ss:Type="String">In-Kind INR</Data></Cell>
    <Cell><Data ss:Type="String">Notes</Data></Cell>
   </Row>
   ${branchesList
     .map((br) => {
       const srcPlc = workbook.placements[br.sourcePlacementId];
       const tgtPlc = workbook.placements[br.targetPlacementId];
       const srcName = srcPlc ? entities[srcPlc.entityId]?.name : br.sourcePlacementId;
       const tgtName = tgtPlc ? entities[tgtPlc.entityId]?.name : br.targetPlacementId;
       return `
   <Row>
    <Cell><Data ss:Type="String">${escapeXml(br.branchId)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(srcName || 'Unknown')}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(tgtName || 'Unknown')}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(br.type)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(br.status)}</Data></Cell>
    <Cell><Data ss:Type="Number">${br.valuePct ?? 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${br.inKindValueInr ?? 0}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(br.note || '')}</Data></Cell>
   </Row>`;
     })
     .join('')}
  </Table>
 </Worksheet>

 <!-- Tab 4: Risk Assessment -->
 <Worksheet ss:Name="Risk Assessment">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Parameter ID</Data></Cell>
    <Cell><Data ss:Type="String">Parameter Name</Data></Cell>
    <Cell><Data ss:Type="String">Score</Data></Cell>
    <Cell><Data ss:Type="String">Severity</Data></Cell>
    <Cell><Data ss:Type="String">Analysis</Data></Cell>
   </Row>
   ${Object.values(riskReport.parameters)
     .map(
       (p) => `
   <Row>
    <Cell><Data ss:Type="String">${escapeXml(p.id)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.name)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.scoreFormatted)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.severity.toUpperCase())}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.plainCommentary)}</Data></Cell>
   </Row>`
     )
     .join('')}
  </Table>
 </Worksheet>
</Workbook>`;

  return new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
}

/**
 * Triggers instant browser download of a file
 */
export function downloadFile(
  content: Blob | string,
  filename: string,
  mimeType: string = 'text/csv;charset=utf-8'
): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

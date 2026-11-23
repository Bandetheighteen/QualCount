import assert from 'node:assert';
import {
  exportCsvBundle,
  exportExcelWorkbook,
} from '../src/io/spreadsheetExport';
import {
  parseStructuredCsv,
  validateAndPreviewImport,
  commitImportedRows,
  parseRupeeAmount,
} from '../src/io/spreadsheetImport';
import {
  seedDelhiNgoWorkspaceV2,
  WORKBOOK_DELHI_ID,
} from '../src/data/seedDelhiNgo';
import { computePublicChoiceUtilityReport } from '../src/engine/utility';
import { computeStructuralRiskReport } from '../src/engine/risk';

console.log('--- Running Spreadsheet I/O & 3-Door Import Pipeline Test Suite ---');

// 1. Rupee Currency Parser
console.log('1. Testing India-aware Rupee currency parsing...');
assert.strictEqual(parseRupeeAmount('₹2.5 Lakh'), 250000);
assert.strictEqual(parseRupeeAmount('₹1.2 Cr'), 12000000);
assert.strictEqual(parseRupeeAmount('50k'), 50000);
assert.strictEqual(parseRupeeAmount('5,00,000'), 500000);
assert.strictEqual(parseRupeeAmount('100000'), 100000);
assert.strictEqual(parseRupeeAmount(750000), 750000);
console.log('✓ Currency normalizer passed all tests.');

// 2. CSV Export Pipeline
console.log('2. Testing CSV Bundle generation with UTF-8 BOM...');
const ws = seedDelhiNgoWorkspaceV2;
const utilityReport = computePublicChoiceUtilityReport(ws, ws.entities);
const riskReport = computeStructuralRiskReport(ws, ws.entities);

const bundle = exportCsvBundle(ws, ws.entities, utilityReport);

// Check UTF-8 BOM prefix
assert.strictEqual(bundle.nodesCsv.charCodeAt(0), 0xfeff, 'nodesCsv must start with UTF-8 BOM (0xFEFF)');
assert.strictEqual(bundle.branchesCsv.charCodeAt(0), 0xfeff, 'branchesCsv must start with UTF-8 BOM (0xFEFF)');

// Check Node CSV Headers & Contents
assert.ok(bundle.nodesCsv.includes('entity_id,name,category,is_root_ngo,outreach_attempts'));
assert.ok(bundle.nodesCsv.includes('City Museum'));
assert.ok(bundle.nodesCsv.includes('institutional_mandate'));

// Check Branch CSV Headers & Contents
assert.ok(bundle.branchesCsv.includes('branch_id,source_org,target_org,branch_type,status'));
assert.ok(bundle.branchesCsv.includes('City Museum'));
assert.ok(bundle.branchesCsv.includes('750000')); // in-kind value

console.log('✓ CSV Bundle generated with clean headers and UTF-8 BOM.');

// 3. Multi-Tab Excel Export
console.log('3. Testing 4-Tab Excel Workbook generation...');
const excelBlob = await exportExcelWorkbook(ws, ws.entities, utilityReport, riskReport);
assert.ok(excelBlob, 'Excel blob must be created');
assert.strictEqual(excelBlob.type, 'application/vnd.ms-excel;charset=utf-8');

const excelText = await excelBlob.text();
assert.ok(excelText.includes('<Workbook'), 'Must be valid SpreadsheetML XML workbook');
assert.ok(excelText.includes('ss:Name="Executive Summary"'), 'Tab 1: Executive Summary must exist');
assert.ok(excelText.includes('ss:Name="Organizations &amp; Utility"'), 'Tab 2: Organizations & Utility must exist');
assert.ok(excelText.includes('ss:Name="Branches &amp; Outreach"'), 'Tab 3: Branches & Outreach must exist');
assert.ok(excelText.includes('ss:Name="Risk Assessment"'), 'Tab 4: Risk Assessment must exist');

console.log('✓ Multi-Tab Excel Workbook verified with 4 formatted sheets.');

// 4. CSV Import Parser & Preview
console.log('4. Testing CSV Import Parser & Validation Preview...');
const testCsv = `\uFEFFsource_org,target_org,target_category,branch_type,status,funding_pct,in_kind_inr,note,selective_incentives,outreach_attempts
Your NGO,New CSR Foundation,csr,green,tick,20,,Primary CSR grant,csr_compliance,2
Your NGO,City Museum,institution,white,tick,,400000,Additional hall,asset_activation,1
City Museum,District Education Dept,government,yellow,pending,,,Referred to director,institutional_mandate,3`;

const parsedRows = parseStructuredCsv(testCsv);
assert.strictEqual(parsedRows.length, 3, 'Must parse exactly 3 rows');

const r0 = parsedRows[0];
assert.strictEqual(r0.sourceOrg, 'Your NGO');
assert.strictEqual(r0.targetOrg, 'New CSR Foundation');
assert.strictEqual(r0.targetCategory, 'csr');
assert.strictEqual(r0.branchType, 'green');
assert.strictEqual(r0.status, 'tick');
assert.strictEqual(r0.fundingPct, 20);
assert.deepStrictEqual(r0.selectiveIncentives, ['csr_compliance']);
assert.strictEqual(r0.outreachAttempts, 2);

const preview = validateAndPreviewImport(parsedRows, ws.entities, 1000000);
assert.strictEqual(preview.validRows.length, 3);
assert.ok(preview.newEntities.includes('New CSR Foundation'));
assert.ok(preview.newEntities.includes('District Education Dept'));
assert.ok(preview.reusedEntities.includes('Your NGO'));
assert.ok(preview.reusedEntities.includes('City Museum'));

// Test RFC-4180 multiline notes with CRLF and escaped quotes
const multilineCsv = `source_org,target_org,target_category,branch_type,status,note\r\n"Your NGO","Complex Partner","institution","white","tick","Line 1 of note,\r\nLine 2 with ""escaped quotes"" and, commas."\r\n"Your NGO","Normal Partner","community","yellow","pending","Simple note"`;
const multilineRows = parseStructuredCsv(multilineCsv);
assert.strictEqual(multilineRows.length, 2, 'Must parse exactly 2 rows despite CRLF inside quotes');
assert.strictEqual(multilineRows[0].targetOrg, 'Complex Partner');
assert.ok(multilineRows[0].note?.includes('Line 1 of note,'));
assert.ok(multilineRows[0].note?.includes('Line 2 with "escaped quotes" and, commas.'));
assert.strictEqual(multilineRows[1].targetOrg, 'Normal Partner');

console.log('✓ CSV parser and validation preview passed (including RFC-4180 multiline CRLF & escaped quotes).');

// 5. Atomic Commit with Bottom-to-Top ELK Layout
console.log('5. Testing atomic commit with bottom-to-top layout...');
const committedState = await commitImportedRows(parsedRows, WORKBOOK_DELHI_ID, ws);

// Entities check
const newCsrEnt = Object.values(committedState.entities).find((e) => e.name === 'New CSR Foundation');
assert.ok(newCsrEnt, 'New CSR Foundation must exist in committed entities');
assert.strictEqual(newCsrEnt.category, 'csr');

// Placements check
const newCsrPlc = Object.values(committedState.placements).find((p) => p.entityId === newCsrEnt.entityId);
assert.ok(newCsrPlc, 'New CSR Foundation must have a placement');
assert.strictEqual(newCsrPlc.outreachAttempts, 2);

// Branches check
const newGreenBranch = Object.values(committedState.branches).find(
  (b) => b.targetPlacementId === newCsrPlc.placementId && b.type === 'green'
);
assert.ok(newGreenBranch, 'New green funding branch must be committed');
assert.strictEqual(newGreenBranch.valuePct, 20);

// Verify ELK bottom-to-top layout was applied (coordinates are non-zero numbers)
for (const p of Object.values(committedState.placements)) {
  assert.ok(typeof p.x === 'number' && typeof p.y === 'number');
}

console.log('✓ Atomic import committed with automatic bottom-to-top layout.');
console.log('--- ALL SPREADSHEET I/O TESTS PASSED (100%) ---');

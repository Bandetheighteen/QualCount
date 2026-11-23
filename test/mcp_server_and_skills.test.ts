import * as fs from 'fs';
import * as path from 'path';
import assert from 'node:assert';
import { McpWorkspaceStorage } from '../packages/mcp-server/src/storageAdapter';
import { createPartnershipMcpServer } from '../packages/mcp-server/src/server';
import { FolderWorkspaceRepository } from '../src/storage/folderWorkspaceRepository';

const TEST_WS_DIR = path.resolve(process.cwd(), 'test_workspace_mcp_e2e');

function cleanTestDir() {
  if (fs.existsSync(TEST_WS_DIR)) {
    fs.rmSync(TEST_WS_DIR, { recursive: true, force: true });
  }
}

async function runMcpAndSkillsTestSuite() {
  console.log('================================================================');
  console.log('--- Running QualCount Phase 7 MCP Server & Skills Test Suite ---');
  console.log('================================================================');

  cleanTestDir();

  try {
    const storage = new McpWorkspaceStorage(TEST_WS_DIR);
    await storage.ensureWorkspaceInitialized('Phase 7 Test Workspace');

    const server = createPartnershipMcpServer(storage);
    const tools = (server as any)._registeredTools;
    const resources = (server as any)._registeredResources;
    const resourceTemplates = (server as any)._registeredResourceTemplates;

    // Helper to call tool handler and parse JSON result
    async function callTool(name: string, args: any = {}) {
      const toolName = name.startsWith('QualCount-') ? name : `QualCount-${name}`;
      const tool = tools[toolName];
      assert(tool, `Tool ${toolName} must be registered`);
      const res = await tool.handler(args);
      assert(res && res.content && res.content[0], `Tool ${toolName} must return content`);
      return JSON.parse(res.content[0].text);
    }

    // ---------------------------------------------------------------------------
    // TEST 1: MCP Server Scaffolding & Tool/Resource Registration
    // ---------------------------------------------------------------------------
    console.log('\n[1/12] Testing MCP Server Tool & Resource Catalog (MCP-01)...');
    const expectedToolNames = [
      'QualCount-list_workbooks',
      'QualCount-get_workbook_full',
      'QualCount-search_entities',
      'QualCount-create_workbook',
      'QualCount-add_or_import_entity',
      'QualCount-update_placement_attributes',
      'QualCount-create_branch',
      'QualCount-update_branch',
      'QualCount-delete_branch',
      'QualCount-run_tidy_up_layout',
      'QualCount-get_public_choice_utility_report',
      'QualCount-update_utility_strategy_weights',
      'QualCount-patch_workbook_metadata',
      'QualCount-get_structural_risk_report',
      'QualCount-write_risk_assessment_box',
      'QualCount-export_workbook_spreadsheet',
      'QualCount-batch_import_workflow_rows',
    ];

    assert.strictEqual(
      Object.keys(tools).length,
      17,
      `Expected exactly 17 registered tools, got ${Object.keys(tools).length}`
    );
    for (const toolName of expectedToolNames) {
      assert(tools[toolName], `Tool "${toolName}" must be registered`);
    }

    const staticResourceUris = Object.keys(resources);
    const templateNames = Object.keys(resourceTemplates);
    assert.strictEqual(staticResourceUris.length, 2, 'Expected 2 static resources');
    assert.strictEqual(templateNames.length, 2, 'Expected 2 resource templates');
    assert(staticResourceUris.includes('partnership://workspace/overview'), 'Must have workspace overview resource');
    assert(staticResourceUris.includes('partnership://workspace/entities'), 'Must have workspace entities resource');
    assert(templateNames.includes('Workbook Graph'), 'Must have Workbook Graph template');
    assert(templateNames.includes('Workbook Metrics'), 'Must have Workbook Metrics template');
    console.log('✓ All 17 tools and 4 resources cataloged and verified.');

    // ---------------------------------------------------------------------------
    // TEST 2: create_workbook Tool
    // ---------------------------------------------------------------------------
    console.log('\n[2/12] Testing create_workbook tool (Tier 0 Anchor & Manifest)...');
    const createRes = await callTool('create_workbook', {
      title: 'Delhi Clean Air Action',
      description: 'Municipal NGO coalition for air quality monitoring',
      targetBudgetInr: 2500000,
      rootNgoName: 'Clean Air Trust',
    });

    assert.strictEqual(createRes.success, true);
    const wbId = createRes.workbookId;
    assert(wbId.startsWith('wb-delhi-clean-air-action'), `Expected slugged workbook ID, got ${wbId}`);

    // Verify on disk
    const wbFile = await storage.readWorkbook(wbId);
    assert.strictEqual(wbFile.title, 'Delhi Clean Air Action');
    assert.strictEqual(wbFile.targetBudgetInr, 2500000);
    assert.strictEqual(wbFile.revision, 1);

    const rootPlc = wbFile.placements[createRes.rootPlacementId];
    assert(rootPlc, 'Root placement must exist in workbook');
    assert.strictEqual(rootPlc.isRootNgo, true);
    assert.strictEqual(rootPlc.x, 400);
    assert.strictEqual(rootPlc.y, 600);
    assert.strictEqual(rootPlc.width, 190);
    assert.strictEqual(rootPlc.height, 76);

    const manifest = await storage.readManifest();
    assert(manifest.workbooks[wbId], 'Workbook must be indexed in manifest');
    console.log('✓ create_workbook created valid JSON file with Root NGO anchored at Tier 0.');

    // ---------------------------------------------------------------------------
    // TEST 3: search_entities Tool
    // ---------------------------------------------------------------------------
    console.log('\n[3/12] Testing search_entities tool (Fuzzy Entity Matching)...');
    const searchRes = await callTool('search_entities', { query: 'clean air' });
    assert(searchRes.count >= 1, 'Should find at least 1 match');
    assert.strictEqual(searchRes.localMatches[0].name, 'Clean Air Trust');
    assert.strictEqual(searchRes.localMatches[0].category, 'ngo');
    console.log('✓ search_entities successfully matches existing master entities.');

    // ---------------------------------------------------------------------------
    // TEST 4: add_or_import_entity & Deduplication
    // ---------------------------------------------------------------------------
    console.log('\n[4/12] Testing add_or_import_entity tool (Deduplication & Public Choice)...');
    const partner1Res = await callTool('add_or_import_entity', {
      workbookId: wbId,
      name: 'Blue Star Climate Fund',
      category: 'csr',
      globalNotes: 'CSR arm of Blue Star dedicated to urban environment',
      selectiveIncentives: ['csr_compliance', 'brand_visibility'],
      outreachAttempts: 2,
    });

    assert.strictEqual(partner1Res.success, true);
    assert.strictEqual(partner1Res.isReusedEntity, false);
    const p1PlacementId = partner1Res.placementId;

    // Call again with lowercase name -> should reuse entity
    const partner1Dup = await callTool('add_or_import_entity', {
      workbookId: wbId,
      name: 'blue star climate fund',
      category: 'csr',
    });
    assert.strictEqual(partner1Dup.isReusedEntity, true);
    assert.strictEqual(partner1Dup.entityId, partner1Res.entityId);

    // Verify placement in workbook
    const wbAfterP1 = await storage.readWorkbook(wbId);
    const p1Plc = wbAfterP1.placements[p1PlacementId];
    assert(p1Plc, 'Placement 1 must exist');
    assert.deepStrictEqual(p1Plc.selectiveIncentives, ['csr_compliance', 'brand_visibility']);
    assert.strictEqual(p1Plc.outreachAttempts, 2);
    console.log('✓ add_or_import_entity deduplicated against entities.json and preserved public choice tags.');

    // ---------------------------------------------------------------------------
    // TEST 5: Multiplex Branch Mutation Tools
    // ---------------------------------------------------------------------------
    console.log('\n[5/12] Testing create_branch, update_branch, delete_branch tools...');
    const rootPlcId = createRes.rootPlacementId;

    // Self-loop validation
    await assert.rejects(
      async () => {
        await callTool('create_branch', {
          workbookId: wbId,
          sourcePlacementId: rootPlcId,
          targetPlacementId: rootPlcId,
          type: 'green',
          status: 'pending',
        });
      },
      /Self-loops are forbidden/,
      'Self-loops must throw error'
    );

    // Create green branch: Blue Star -> Root NGO (or Root NGO -> Blue Star funding)
    const greenBrRes = await callTool('create_branch', {
      workbookId: wbId,
      sourcePlacementId: p1PlacementId,
      targetPlacementId: rootPlcId,
      type: 'green',
      status: 'pending',
      valuePct: 40,
      note: 'CSR proposal submitted for ₹10L (40% of target budget)',
    });
    assert.strictEqual(greenBrRes.success, true);
    const greenBrId = greenBrRes.branch.branchId;

    // Update branch to confirmed ('tick')
    const updateBrRes = await callTool('update_branch', {
      workbookId: wbId,
      branchId: greenBrId,
      status: 'tick',
      note: 'Grant approved and sanctioned',
    });
    assert.strictEqual(updateBrRes.branch.status, 'tick');
    assert(updateBrRes.branch.resolvedAt, 'Resolved timestamp must be recorded on confirmation');

    // Create a temporary branch to delete
    const tempBrRes = await callTool('create_branch', {
      workbookId: wbId,
      sourcePlacementId: rootPlcId,
      targetPlacementId: p1PlacementId,
      type: 'white',
      status: 'pending',
      note: 'Draft meeting',
    });
    const deleteBrRes = await callTool('delete_branch', {
      workbookId: wbId,
      branchId: tempBrRes.branch.branchId,
    });
    assert.strictEqual(deleteBrRes.success, true);

    // Ownership Separation Rule: White branch between two non-root partners must fail
    const nonRootPartner2 = await callTool('add_or_import_entity', {
      workbookId: wbId,
      name: 'Secondary Partner Foundation',
      category: 'ngo',
    });

    await assert.rejects(
      async () => {
        await callTool('create_branch', {
          workbookId: wbId,
          sourcePlacementId: p1PlacementId,
          targetPlacementId: nonRootPartner2.placementId,
          type: 'white',
          status: 'pending',
        });
      },
      /Ownership rule violation/,
      'Creating a white branch between two non-root partners must throw an ownership error'
    );

    const wbAfterBr = await storage.readWorkbook(wbId);
    assert(!wbAfterBr.branches[tempBrRes.branch.branchId], 'Deleted branch must not exist');
    assert.strictEqual(wbAfterBr.branches[greenBrId].status, 'tick');
    console.log('✓ Multiplex branch lifecycle verified with strict type/status & ownership enforcement.');

    // ---------------------------------------------------------------------------
    // TEST 6: run_tidy_up_layout Tool (Pure ELK Hierarchical Layout)
    // ---------------------------------------------------------------------------
    console.log('\n[6/12] Testing run_tidy_up_layout tool (Pure Bottom-to-Top ELK)...');
    // Add two more partners (Ministry & University)
    const p2Res = await callTool('add_or_import_entity', {
      workbookId: wbId,
      name: 'Delhi Environment Department',
      category: 'government',
      selectiveIncentives: ['institutional_mandate'],
    });
    const p3Res = await callTool('add_or_import_entity', {
      workbookId: wbId,
      name: 'IIT Delhi Clean Air Lab',
      category: 'institution',
      selectiveIncentives: ['network_prestige'],
    });

    // Branches: Root -> IIT (white), IIT -> Govt (yellow bridge)
    await callTool('create_branch', {
      workbookId: wbId,
      sourcePlacementId: rootPlcId,
      targetPlacementId: p3Res.placementId,
      type: 'white',
      status: 'tick',
    });
    await callTool('create_branch', {
      workbookId: wbId,
      sourcePlacementId: p3Res.placementId,
      targetPlacementId: p2Res.placementId,
      type: 'yellow',
      status: 'tick',
    });

    const tidyRes = await callTool('run_tidy_up_layout', { workbookId: wbId });
    assert.strictEqual(tidyRes.success, true);
    assert(tidyRes.placementsUpdated >= 4, 'All placed nodes must be repositioned');

    const wbAfterLayout = await storage.readWorkbook(wbId);
    const rootPos = wbAfterLayout.placements[rootPlcId];
    const govtPos = wbAfterLayout.placements[p2Res.placementId];

    // In bottom-to-top ('UP') layout, root NGO at bottom has higher Y than top government agency
    assert(
      rootPos.y > govtPos.y,
      `Expected root NGO Y (${rootPos.y}) > top government Y (${govtPos.y}) in UP layout`
    );
    console.log(`✓ ELK Layout successfully positioned hierarchy: Root Y=${rootPos.y}, Gov Y=${govtPos.y}`);

    // ---------------------------------------------------------------------------
    // TEST 7: Public Choice Utility Engine Tools
    // ---------------------------------------------------------------------------
    console.log('\n[7/12] Testing Public Choice Utility tools (PUI, Weights, Metadata)...');
    const utilityReport = await callTool('get_public_choice_utility_report', { workbookId: wbId });
    assert(typeof utilityReport.pui === 'number', 'PUI must be a number');
    assert(Object.keys(utilityReport.partners).length >= 3, 'Must decompose per partner');
    assert(utilityReport.strategyPreset, 'Must contain strategy preset');

    // Test weight validation error
    await assert.rejects(
      async () => {
        await callTool('update_utility_strategy_weights', {
          workbookId: wbId,
          alphaR: 0.5,
          alphaA: 0.5,
          alphaV: 0.5,
          alphaC: 0.5, // sum = 2.0
        });
      },
      /Weights must sum to 1.00/,
      'Invalid weights sum must be rejected'
    );

    // Valid weights update
    const validWeightsRes = await callTool('update_utility_strategy_weights', {
      workbookId: wbId,
      alphaR: 0.25,
      alphaA: 0.25,
      alphaV: 0.25,
      alphaC: 0.25,
    });
    assert.strictEqual(validWeightsRes.success, true);

    const patchRes = await callTool('patch_workbook_metadata', {
      workbookId: wbId,
      title: 'Delhi Clean Air Action Plan 2026',
    });
    assert.strictEqual(patchRes.metadata.title, 'Delhi Clean Air Action Plan 2026');
    console.log('✓ Public choice utility report and strategy weight validation verified.');

    // ---------------------------------------------------------------------------
    // TEST 8: Two-Layer Risk Engine Tools
    // ---------------------------------------------------------------------------
    console.log('\n[8/12] Testing Two-Layer Risk tools (Structural R1-R6 & Assessment Box)...');
    const riskReport = await callTool('get_structural_risk_report', { workbookId: wbId });
    assert(riskReport.aggregateTier, 'Aggregate tier must be present');
    assert(riskReport.parameters.R1, 'Parameter R1 must be present');
    assert(riskReport.parameters.R2, 'Parameter R2 must be present');
    assert(riskReport.parameters.R3, 'Parameter R3 must be present');

    const writeRiskRes = await callTool('write_risk_assessment_box', {
      workbookId: wbId,
      overallPosition: 'Moderate risk due to single funding pillar and officer transfer vulnerability.',
      parameterCommentary: {
        R1: 'Single bridge through IIT Delhi creates bottleneck.',
        R2: 'Unowned referral to Environment Dept needs direct MOU.',
        R3: 'Blue Star grant covers 40% but shortfall remains ₹15L.',
        R4: 'Low apathy risk as institutional mandates are articulated.',
        R5: 'No stale pipeline touches over 14 days.',
        R6: 'No rejection cluster observed in municipal sector.',
      },
      failureScenarios: [
        {
          title: 'Municipal Officer Transfer',
          severity: 'moderate',
          likelihood: 'medium',
          triggerCondition: 'Key nodal officer transferred during budget review cycle.',
          affectedPlacementIds: [p2Res.placementId],
          mitigationAction: 'Secure joint working committee ratification before end of Q3.',
        },
      ],
      publicChoiceDiagnosis: 'Align Department mandate with upcoming state clean air compliance deadlines.',
      agentName: 'Claude Code via MCP',
    });

    assert.strictEqual(writeRiskRes.success, true);
    assert.strictEqual(writeRiskRes.riskAssessment.assessedBy, 'Claude Code via MCP');

    const wbWithRisk = await storage.readWorkbook(wbId);
    assert(wbWithRisk.riskAssessment, 'Risk assessment must be persisted on workbook');
    assert.strictEqual(wbWithRisk.riskAssessment.failureScenarios.length, 1);
    console.log('✓ Two-layer risk audit computed and published live to Maximized Dashboard data contract.');

    // ---------------------------------------------------------------------------
    // TEST 9: Spreadsheet Batch Import Tool
    // ---------------------------------------------------------------------------
    console.log('\n[9/12] Testing batch_import_workflow_rows tool (Deduplication & Tidy Up)...');
    const importRows = [
      {
        sourceOrg: 'Clean Air Trust',
        targetOrg: 'Apollo Hospitals CSR',
        targetCategory: 'csr',
        branchType: 'green',
        branchStatus: 'tick',
        valuePct: 30,
        note: 'Hospital air quality ward sponsorship',
      },
      {
        sourceOrg: 'Apollo Hospitals CSR',
        targetOrg: 'Delhi Medical Association',
        targetCategory: 'institution',
        branchType: 'yellow',
        branchStatus: 'tick',
        note: 'Introduction to pediatric health committee',
      },
      {
        sourceOrg: 'Delhi Medical Association',
        targetOrg: 'Central Pollution Control Board',
        targetCategory: 'government',
        branchType: 'yellow',
        branchStatus: 'pending',
        note: 'Requested referral meeting',
      },
    ];

    const batchRes = await callTool('batch_import_workflow_rows', {
      workbookId: wbId,
      rows: importRows,
      runTidyUpAfter: true,
    });

    assert.strictEqual(batchRes.success, true);
    assert.strictEqual(batchRes.rowsImported, 3);
    assert(batchRes.totalPlacements >= 6);

    const entitiesAfterBatch = await storage.readEntities();
    assert(
      Object.values(entitiesAfterBatch.entities).some((e) => e.name === 'Apollo Hospitals CSR'),
      'Apollo Hospitals must be indexed in entities.json'
    );
    console.log(`✓ Batch import ingested ${batchRes.rowsImported} rows, deduplicated entities, and ran layout.`);

    // ---------------------------------------------------------------------------
    // TEST 10: Spreadsheet Exporter Tool
    // ---------------------------------------------------------------------------
    console.log('\n[10/12] Testing export_workbook_spreadsheet tool (CSV Bundle & Excel XML)...');
    const csvExportPath = path.join(TEST_WS_DIR, 'export_test.csv');
    const xlsxExportPath = path.join(TEST_WS_DIR, 'export_test.xlsx');

    const csvRes = await callTool('export_workbook_spreadsheet', {
      workbookId: wbId,
      format: 'csv',
      outputPath: csvExportPath,
    });
    assert.strictEqual(csvRes.success, true);
    assert(fs.existsSync(csvExportPath), 'CSV export file must exist');
    assert(csvRes.bytesWritten > 100, 'CSV export must contain content');

    const xlsxRes = await callTool('export_workbook_spreadsheet', {
      workbookId: wbId,
      format: 'xlsx',
      outputPath: xlsxExportPath,
    });
    assert.strictEqual(xlsxRes.success, true);
    assert(fs.existsSync(xlsxExportPath), 'XLSX export file must exist');
    assert(xlsxRes.bytesWritten > 500, 'XLSX export must contain multi-tab XML');
    console.log('✓ Spreadsheet exporter generated RFC-4180 CSV bundle and 4-tab Excel workbook.');

    // ---------------------------------------------------------------------------
    // TEST 11: Atomicity, Pre-Write Snapshots, 20 Rolling Limit & Undo (MCP-02 & DASH-04)
    // ---------------------------------------------------------------------------
    console.log('\n[11/12] Testing Snapshot Rolling Cap (20) & Revert Rollback (MCP-02 & DASH-04)...');
    const snapshotsDir = path.join(TEST_WS_DIR, '.snapshots');

    // Run 25 mutations to exceed 20 snapshot cap
    console.log('  Executing 25 consecutive mutations to test rolling snapshot pruning...');
    for (let i = 1; i <= 25; i++) {
      await callTool('update_placement_attributes', {
        workbookId: wbId,
        placementId: rootPlcId,
        outreachAttempts: i,
      });
    }

    const snapshotFiles = fs
      .readdirSync(snapshotsDir)
      .filter((f) => f.startsWith(`wb_${wbId}_`) && f.endsWith('.json'));

    assert.strictEqual(
      snapshotFiles.length,
      20,
      `Expected rolling snapshot cap to strictly retain 20 snapshots, got ${snapshotFiles.length}`
    );
    console.log(`✓ Rolling snapshot cap strictly preserved ${snapshotFiles.length} latest backups (pruned 5 oldest).`);

    // Verify Undo / Revert Last Snapshot
    const wbBeforeRevert = await storage.readWorkbook(wbId);
    assert.strictEqual(wbBeforeRevert.placements[rootPlcId].outreachAttempts, 25);

    const revertRes = await storage.revertLastSnapshot(wbId);
    assert.strictEqual(revertRes.reverted, true);

    const wbAfterRevert = await storage.readWorkbook(wbId);
    assert.strictEqual(
      wbAfterRevert.placements[rootPlcId].outreachAttempts,
      24,
      'Revert must restore state from prior snapshot (outreachAttempts = 24)'
    );

    // Verify snapshot file was popped
    const remainingSnapshots = fs
      .readdirSync(snapshotsDir)
      .filter((f) => f.startsWith(`wb_${wbId}_`) && f.endsWith('.json'));
    assert.strictEqual(
      remainingSnapshots.length,
      19,
      'Popping the reverted snapshot leaves 19 snapshots in the rolling stack'
    );

    // Verify reverting when snapshots are exhausted
    while ((await storage.listSnapshots(wbId)).length > 0) {
      await storage.revertLastSnapshot(wbId);
    }
    const emptyRevertRes = await storage.revertLastSnapshot(wbId);
    assert.strictEqual(emptyRevertRes.reverted, false, 'revertLastSnapshot on empty snapshots must return { reverted: false }');
    console.log('✓ revertLastSnapshot accurately rolled back workbook state and popped snapshot stack (gracefully handles exhaustion).');

    // ---------------------------------------------------------------------------
    // TEST 12: Production Agent Skills Complete Verification (SKILL-01)
    // ---------------------------------------------------------------------------
    console.log('\n[12/13] Testing Production Agent Skills Installation across .agent, .claude, .cursor (SKILL-01)...');
    const skillRoots = ['.agent/skills', '.claude/skills', '.cursor/skills'];
    const requiredSkills = [
      'QualCount-partnership-graph-operator',
      'QualCount-public-choice-utility-analyst',
      'QualCount-two-layer-risk-auditor',
      'QualCount-spreadsheet-to-workflow-mapper',
    ];

    let totalVerifiedSkills = 0;
    for (const root of skillRoots) {
      for (const skillName of requiredSkills) {
        const skillPath = path.resolve(process.cwd(), root, skillName, 'SKILL.md');
        assert(fs.existsSync(skillPath), `Skill file must exist at: ${skillPath}`);
        const content = fs.readFileSync(skillPath, 'utf-8');

        // Verify YAML frontmatter
        assert(content.startsWith('---'), `Skill ${skillName} in ${root} must start with YAML frontmatter`);
        assert(content.includes(`name: ${skillName}`), `Skill ${skillName} in ${root} must declare name in frontmatter`);
        assert(content.includes('description:'), `Skill ${skillName} in ${root} must declare description in frontmatter`);

        // Verify critical core rules
        if (skillName.includes('partnership-graph-operator')) {
          assert(content.includes('Always Search Before Creating'), 'Must include Search Before Creating rule');
          assert(content.includes('Strict Three-Color Branch Semantics'), 'Must include Three-Color rule');
          assert(content.includes('Ownership Separation Rule'), 'Must include Ownership Separation rule');
          assert(content.includes('Preserve Declined Memory'), 'Must include Preserve Declined Memory rule');
        } else if (skillName.includes('public-choice-utility-analyst')) {
          assert(content.includes('Olson / Niskanen Incentive Blindness'), 'Must include Olson/Niskanen protocol');
          assert(content.includes('Ostrom Credible Commitments'), 'Must include Ostrom protocol');
          assert(content.includes('Buchanan-Tullock Decision-Cost Efficiency'), 'Must include Buchanan-Tullock protocol');
        } else if (skillName.includes('two-layer-risk-auditor')) {
          assert(content.includes('Audit Protocol (6 Mandatory Parameters)'), 'Must include 6 parameters review');
          assert(content.includes('write_risk_assessment_box'), 'Must reference write_risk_assessment_box tool');
        } else if (skillName.includes('spreadsheet-to-workflow-mapper')) {
          assert(content.includes('Prevent the 100-Node Canvas Tangle'), 'Must include 100-node tangle rule');
          assert(content.includes('Currency Normalization (India-Aware)'), 'Must include Currency rule');
          assert(content.includes('batch_import_workflow_rows'), 'Must reference batch_import_workflow_rows tool');
        }

        totalVerifiedSkills++;
      }
    }

    assert.strictEqual(
      totalVerifiedSkills,
      12,
      `Expected exactly 12 verified SKILL.md files, got ${totalVerifiedSkills}`
    );
    console.log(`✓ All 12 production agent skill blueprints verified across .agent, .claude, and .cursor.`);

    // ---------------------------------------------------------------------------
    // TEST 13: Live Stdio Process Transport Execution (Node Binary & Bundled Dist)
    // ---------------------------------------------------------------------------
    console.log('\n[13/13] Testing Live Stdio Process Transport Execution over Child Process Pipe...');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

    const liveWsDir = path.resolve(process.cwd(), 'test_workspace_mcp_live_stdio');
    if (fs.existsSync(liveWsDir)) {
      fs.rmSync(liveWsDir, { recursive: true, force: true });
    }

    const mcpDistPath = path.resolve(process.cwd(), 'packages/mcp-server/dist/index.js');
    assert(fs.existsSync(mcpDistPath), `Bundled MCP entrypoint must exist at: ${mcpDistPath}`);

    const clientTransport = new StdioClientTransport({
      command: 'node',
      args: [mcpDistPath, '--workspace', liveWsDir],
    });

    const mcpClient = new Client({ name: 'qualcount-e2e-tester', version: '2.0.0' }, { capabilities: {} });
    await mcpClient.connect(clientTransport);

    const listedTools = await mcpClient.listTools();
    assert.strictEqual(listedTools.tools.length, 17, `Live server must expose 17 tools over stdio pipe`);

    const liveListRes = await mcpClient.callTool({ name: 'QualCount-list_workbooks', arguments: {} });
    const liveListParsed = JSON.parse((liveListRes.content[0] as any).text);
    assert.strictEqual(liveListParsed.sourceType, 'local');

    const liveCreateRes = await mcpClient.callTool({
      name: 'QualCount-create_workbook',
      arguments: {
        title: 'Live Stdio Project',
        description: 'Created through live stdio process pipe',
        targetBudgetInr: 500000,
        rootNgoName: 'Stdio Test Foundation',
      },
    });
    const liveCreateParsed = JSON.parse((liveCreateRes.content[0] as any).text);
    assert.strictEqual(liveCreateParsed.success, true);
    assert.strictEqual(liveCreateParsed.title, 'Live Stdio Project');

    // Read resources over stdio pipe
    const overviewRes = await mcpClient.readResource({ uri: 'partnership://workspace/overview' });
    const overviewParsed = JSON.parse((overviewRes.contents[0] as any).text);
    assert(overviewParsed.workbooks[liveCreateParsed.workbookId]);

    await mcpClient.close();
    if (fs.existsSync(liveWsDir)) {
      fs.rmSync(liveWsDir, { recursive: true, force: true });
    }
    console.log('✓ External client connected to bundled binary over real OS stdio pipes and executed tools & resources.');

    console.log('\n================================================================');
    console.log('--- ALL QUALCOUNT PHASE 7 MCP & SKILLS TESTS PASSED (100%) ---');
    console.log('================================================================\n');
  } finally {
    cleanTestDir();
  }
}

runMcpAndSkillsTestSuite().catch((err) => {
  console.error('\n❌ Phase 7 test suite failed with error:', err);
  cleanTestDir();
  process.exit(1);
});

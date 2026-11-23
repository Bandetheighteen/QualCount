import assert from 'node:assert';
import { seedDelhiNgoWorkspace, WORKBOOK_DELHI_ID } from '../src/data/seedDelhiNgo';
import { computeMacroGraph } from '../src/components/landing/OverviewMacroMap';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import type { WorkspaceState, Workbook } from '../src/types/schema';

console.log('--- Running QualCount Landing Page & Navigation Test Suite ---');

async function runLandingPageTests() {
  const seedState = seedDelhiNgoWorkspace;

  // 1. Initial boot state defaults to 'landing'
  console.log('1. Testing initial view state and navigation actions...');
  const store = useWorkspaceStore.getState();
  assert.strictEqual(store.activeView, 'landing', 'Initial boot view must default to landing');

  store.setActiveView('canvas');
  assert.strictEqual(useWorkspaceStore.getState().activeView, 'canvas', 'setActiveView switches to canvas');

  store.setActiveView('landing');
  assert.strictEqual(useWorkspaceStore.getState().activeView, 'landing', 'setActiveView switches back to landing');
  console.log('✓ View state transitions between landing and canvas validated.');

  // 2. Overview Macro-Map Computation with shared entities and explicit links
  console.log('2. Testing Overview Macro-Map shared partner graph computation...');
  const secondWbId = 'wb_mumbai_health';
  const secondWb: Workbook = {
    workbookId: secondWbId,
    title: 'Mumbai Health Alliance',
    description: 'Public health initiative in Maharashtra',
    targetBudgetInr: 20000000,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Create state where Delhi and Mumbai share "ent-agrocell-csr"
  const multiWbState: WorkspaceState = {
    ...seedState,
    workbooks: {
      ...seedState.workbooks,
      [secondWbId]: secondWb,
    },
    placements: {
      ...seedState.placements,
      plc_mumbai_agrocell: {
        placementId: 'plc_mumbai_agrocell',
        workbookId: secondWbId,
        entityId: 'ent-agrocell-csr', // Shared partner!
        isRootNgo: false,
        x: 200,
        y: 200,
        width: 190,
        height: 76,
      },
    },
    workbookLinks: {
      link_1: {
        linkId: 'link_1',
        sourceWorkbookId: WORKBOOK_DELHI_ID,
        targetWorkbookId: secondWbId,
        relationLabel: 'Parallel Expansion',
        note: 'National replication test',
      },
    },
  };

  const macro = computeMacroGraph(
    multiWbState.workbooks,
    multiWbState.placements,
    multiWbState.entities,
    multiWbState.workbookLinks
  );

  assert.strictEqual(macro.nodes.length, 2, 'Macro graph must contain 2 nodes');
  assert.ok(macro.edges.length >= 2, 'Macro graph must contain shared entity edge and explicit link');

  const sharedEdge = macro.edges.find((e) => e.sharedEntityCount > 0);
  assert.ok(sharedEdge, 'Must detect shared entity edge between Delhi and Mumbai');
  assert.strictEqual(sharedEdge.sharedEntityCount, 1, 'Must have exactly 1 shared partner (Agrocell)');
  assert.strictEqual(sharedEdge.sharedEntityNames[0], 'Agrocell CSR');

  const explicitEdge = macro.edges.find((e) => e.relationLabel === 'Parallel Expansion');
  assert.ok(explicitEdge, 'Must detect explicit workbook link');
  console.log('✓ Overview Macro-Map correctly derives inter-project partner overlaps and links.');

  // 3. Sibling workbook flipping via openWorkbook
  console.log('3. Testing sibling workbook flipping...');
  useWorkspaceStore.setState({ workspace: multiWbState });

  useWorkspaceStore.getState().openWorkbook(secondWbId);
  const updatedStore = useWorkspaceStore.getState();
  assert.strictEqual(updatedStore.activeWorkbookId, secondWbId, 'Active workbook must switch to Mumbai');
  assert.strictEqual(updatedStore.activeView, 'canvas', 'openWorkbook must transition view to canvas');
  assert.strictEqual(updatedStore.nodes.length, 1, 'Mumbai canvas must only display its 1 placement');
  assert.strictEqual(updatedStore.nodes[0].id, 'plc_mumbai_agrocell');
  console.log('✓ Sibling workbook flipping verified without canvas reload.');

  // 4. Book Index Sidebar toggle
  console.log('4. Testing Book Index Sidebar toggling...');
  assert.strictEqual(useWorkspaceStore.getState().isBookIndexOpen, true);
  useWorkspaceStore.getState().toggleBookIndex();
  assert.strictEqual(useWorkspaceStore.getState().isBookIndexOpen, false);
  useWorkspaceStore.getState().toggleBookIndex();
  assert.strictEqual(useWorkspaceStore.getState().isBookIndexOpen, true);
  console.log('✓ Book Index Sidebar collapse/expand verified.');

  // 5. Search filtering across workbooks and entities
  console.log('5. Testing search filtering across workbooks and entities...');
  // Simulate the search filtering logic from LandingPage
  const filterWorkbooks = (q: string, ws: WorkspaceState) => {
    const query = q.toLowerCase().trim();
    if (!query) return Object.keys(ws.workbooks);

    return Object.entries(ws.workbooks)
      .filter(([wbId, wb]) => {
        if (wb.title.toLowerCase().includes(query)) return true;
        if (wb.description?.toLowerCase().includes(query)) return true;
        // Check entities placed in this workbook
        const placementsInWb = Object.values(ws.placements).filter(
          (p) => p.workbookId === wbId || (!p.workbookId && wbId === ws.activeWorkbookId)
        );
        for (const plc of placementsInWb) {
          const ent = ws.entities[plc.entityId];
          if (ent && ent.name.toLowerCase().includes(query)) return true;
        }
        return false;
      })
      .map(([wbId]) => wbId);
  };

  const mumbaiMatches = filterWorkbooks('Mumbai', multiWbState);
  assert.strictEqual(mumbaiMatches.length, 1);
  assert.strictEqual(mumbaiMatches[0], secondWbId);

  // Search by shared partner name "Agrocell"
  const agrocellMatches = filterWorkbooks('Agrocell', multiWbState);
  assert.strictEqual(agrocellMatches.length, 2, 'Agrocell is placed in both Delhi and Mumbai');

  // Search by unique Delhi partner name "City Museum"
  const museumMatches = filterWorkbooks('Museum', multiWbState);
  assert.strictEqual(museumMatches.length, 1);
  assert.strictEqual(museumMatches[0], WORKBOOK_DELHI_ID);
  console.log('✓ Search filtering across workbooks and partner entities validated.');

  // 6. Circular Tree & Loop Logo and Asset Verification
  console.log('6. Testing Circular Logo, Favicons, and About Modal assets...');
  const fs = await import('node:fs');
  const path = await import('node:path');

  const rootDir = process.cwd();
  const logoSvgPath = path.join(rootDir, 'public', 'logo.svg');
  const faviconSvgPath = path.join(rootDir, 'public', 'favicon.svg');
  const logoPngPath = path.join(rootDir, 'public', 'logo.png');
  const faviconIcoPath = path.join(rootDir, 'public', 'favicon.ico');

  assert.ok(fs.existsSync(logoSvgPath), 'public/logo.svg must exist');
  assert.ok(fs.existsSync(faviconSvgPath), 'public/favicon.svg must exist');
  assert.ok(fs.existsSync(logoPngPath), 'public/logo.png must exist');
  assert.ok(fs.existsSync(faviconIcoPath), 'public/favicon.ico must exist');

  const logoSvgContent = fs.readFileSync(logoSvgPath, 'utf8');
  assert.ok(logoSvgContent.includes('QUALICOUNT'), 'logo.svg must contain "QUALICOUNT" text');
  assert.ok(logoSvgContent.includes('id="encircling-loop"'), 'logo.svg must include encircling loop');
  assert.ok(logoSvgContent.includes('id="tree-diagram"'), 'logo.svg must include tree diagram');
  assert.ok(logoSvgContent.includes('PARTNERSHIP LEDGER'), 'logo.svg must include subtitle');

  // Verify text path geometry: arc must bow downwards to y ~ 445 beneath roots (roots end at y=338)
  assert.ok(logoSvgContent.includes('M 115,385 A 195,195 0 0,0 397,385'), 'logo.svg text arc path must use corrected arc geometry');

  const faviconSvgContent = fs.readFileSync(faviconSvgPath, 'utf8');
  assert.ok(faviconSvgContent.includes('QUALICOUNT'), 'favicon.svg must contain "QUALICOUNT" text');

  console.log('✓ Master circular logo, favicons, and branding assets verified.');

  // 7. Testing Workspace Name and Deletion Invariants on Landing Page
  console.log('7. Testing Landing Page Workspace Naming and Deletion Invariants...');
  const currentWs = useWorkspaceStore.getState().workspace;
  assert.strictEqual(currentWs?.workspaceName, 'Sample Workspace', 'Default workspace name must be "Sample Workspace"');
  assert.strictEqual(currentWs?.workspaceId, 'ws_sample_workspace', 'Default workspace ID must be "ws_sample_workspace"');

  // Verify deletion can be triggered
  await useWorkspaceStore.getState().deleteWorkspace(currentWs?.workspaceId);
  const postDeleteState = useWorkspaceStore.getState();
  assert.strictEqual(postDeleteState.workspace?.workspaceName, 'New Workspace', 'Post-deletion workspace must be "New Workspace"');
  assert.strictEqual(postDeleteState.workspace?.userDeletedSample, true, 'Deleted sample flag must be set');

  // Re-seed for safety
  await useWorkspaceStore.getState().resetToDelhiSeed();
  console.log('✓ Landing page workspace naming and deletion invariants validated.');

  console.log('--- ALL LANDING PAGE & NAVIGATION TESTS PASSED (100%) ---');
}

runLandingPageTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

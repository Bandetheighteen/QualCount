/**
 * QualCount: Visual Multiplex Partnership Management System
 * Native Spreadsheet Import Pipeline (src/io/spreadsheetImport.ts)
 * 
 * Implements Door 1: Native Structured CSV/Excel Importer with
 * entity deduplication against entities.json and automatic bottom-to-top ELK layout.
 */

import type {
  WorkspaceState,
  Entity,
  Placement,
  Branch,
  BranchType,
  BranchStatus,
  EntityCategory,
  SelectiveIncentiveTag,
} from '../types/schema';
import { computeHierarchicalLayout } from '../engine/layout';

export interface ImportRow {
  sourceOrg: string;
  targetOrg: string;
  targetCategory?: EntityCategory;
  branchType: BranchType;
  status: BranchStatus;
  fundingPct?: number;
  inKindInr?: number;
  note?: string;
  selectiveIncentives?: SelectiveIncentiveTag[];
  outreachAttempts?: number;
}

export interface ImportPreviewResult {
  validRows: ImportRow[];
  newEntities: string[];
  reusedEntities: string[];
  branchCount: number;
  warnings: string[];
}

/**
 * Normalizes Indian currency strings into raw INR numbers:
 * e.g., "₹2.5 Lakh" -> 250000, "1.2 Cr" -> 12000000, "50k" -> 50000
 */
export function parseRupeeAmount(raw: unknown): number | undefined {
  if (typeof raw === 'number' && !isNaN(raw)) return raw;
  if (typeof raw !== 'string') return undefined;

  const cleaned = raw.replace(/[₹$,\s]/g, '').trim().toLowerCase();
  if (!cleaned) return undefined;

  if (cleaned.endsWith('cr') || cleaned.endsWith('crore') || cleaned.endsWith('crores')) {
    const num = parseFloat(cleaned.replace(/(cr|crore|crores)/g, ''));
    return isNaN(num) ? undefined : Math.round(num * 10000000);
  }
  if (cleaned.endsWith('l') || cleaned.endsWith('lakh') || cleaned.endsWith('lakhs')) {
    const num = parseFloat(cleaned.replace(/(l|lakh|lakhs)/g, ''));
    return isNaN(num) ? undefined : Math.round(num * 100000);
  }
  if (cleaned.endsWith('k')) {
    const num = parseFloat(cleaned.replace('k', ''));
    return isNaN(num) ? undefined : Math.round(num * 1000);
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : Math.round(num);
}

/**
 * RFC-4180 compliant streaming CSV tokenizer.
 * Correctly preserves newlines (\r\n or \n) and commas inside quoted fields,
 * and handles escaped double quotes ("").
 */
export function tokenizeCsv(csvText: string): string[][] {
  let cleanText = csvText;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < cleanText.length) {
    const char = cleanText[i];

    if (char === '"') {
      if (inQuotes && cleanText[i + 1] === '"') {
        currentField += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
      i++;
      continue;
    }

    if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && cleanText[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      i++;
      continue;
    }

    currentField += char;
    i++;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * 1. Parse structured CSV text into normalized ImportRow objects
 */
export function parseStructuredCsv(csvText: string): ImportRow[] {
  const table = tokenizeCsv(csvText);
  if (table.length < 2) return [];

  const headers = table[0].map((h) => h.toLowerCase().replace(/[\s_-]+/g, ''));
  const rows: ImportRow[] = [];

  for (let idx = 1; idx < table.length; idx++) {
    const values = table[idx];
    if (values.length < 2 || !values[0] || !values[1]) continue;

    const rowMap: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (values[i] !== undefined) {
        rowMap[h] = values[i];
      }
    });

    // Detect fields
    const sourceOrg =
      rowMap['sourceorg'] || rowMap['source'] || rowMap['from'] || values[0] || '';
    const targetOrg =
      rowMap['targetorg'] || rowMap['target'] || rowMap['to'] || values[1] || '';

    if (!sourceOrg || !targetOrg) continue;

    // Category
    const rawCat = (rowMap['targetcategory'] || rowMap['category'] || 'other').toLowerCase();
    const targetCategory: EntityCategory = [
      'csr',
      'government',
      'institution',
      'community',
      'ngo',
      'other',
    ].includes(rawCat)
      ? (rawCat as EntityCategory)
      : 'other';

    // Branch Type
    const rawType = (rowMap['branchtype'] || rowMap['type'] || 'white').toLowerCase();
    const branchType: BranchType = rawType === 'green' || rawType === 'yellow' ? rawType : 'white';

    // Status
    const rawStatus = (rowMap['status'] || 'pending').toLowerCase();
    let status: BranchStatus = 'pending';
    if (rawStatus === 'tick' || rawStatus === 'confirmed' || rawStatus === 'accepted') {
      status = 'tick';
    } else if (rawStatus === 'cross' || rawStatus === 'declined' || rawStatus === 'rejected') {
      status = 'cross';
    }

    // Funding Pct & In-Kind INR
    const rawFunding = rowMap['fundingpct'] || rowMap['m%'] || rowMap['funding'];
    const fundingPct = rawFunding ? parseFloat(rawFunding.replace('%', '')) : undefined;

    const rawInKind = rowMap['inkindinr'] || rowMap['inkind'];
    const inKindInr = rawInKind ? parseRupeeAmount(rawInKind) : undefined;

    const note = rowMap['note'] || rowMap['notes'] || rowMap['description'] || '';

    // Selective Incentives
    const rawIncentives = rowMap['selectiveincentives'] || rowMap['incentives'] || '';
    const selectiveIncentives: SelectiveIncentiveTag[] = rawIncentives
      ? (rawIncentives
          .split(/[;,]/)
          .map((s) => s.trim().toLowerCase().replace(/[\s-]+/g, '_'))
          .filter((s) =>
            [
              'csr_compliance',
              'brand_visibility',
              'institutional_mandate',
              'policy_influence',
              'network_prestige',
              'asset_activation',
              'community_legitimacy',
            ].includes(s)
          ) as SelectiveIncentiveTag[])
      : [];

    const rawTouches = rowMap['outreachattempts'] || rowMap['touches'];
    const outreachAttempts = rawTouches ? Math.max(1, parseInt(rawTouches, 10)) : 1;

    rows.push({
      sourceOrg,
      targetOrg,
      targetCategory,
      branchType,
      status,
      fundingPct: isNaN(fundingPct as number) ? undefined : fundingPct,
      inKindInr,
      note,
      selectiveIncentives,
      outreachAttempts,
    });
  }

  return rows;
}

/**
 * Parses tabular JSON outreach data into normalized ImportRow objects.
 * Handles arrays of row objects, objects with rows/data/partnerships arrays,
 * and extracts branches from WorkspaceState or WorkbookFile objects.
 */
export function parseTabularJson(jsonInput: unknown): ImportRow[] {
  if (!jsonInput) return [];

  // If it's a WorkspaceState or WorkbookFile with branches and placements dictionaries
  if (
    typeof jsonInput === 'object' &&
    jsonInput !== null &&
    'branches' in jsonInput &&
    'placements' in jsonInput
  ) {
    const ws = jsonInput as {
      branches: Record<string, Branch>;
      placements: Record<string, Placement>;
      entities?: Record<string, Entity>;
    };
    const rows: ImportRow[] = [];
    const entities = ws.entities || {};

    for (const br of Object.values(ws.branches || {})) {
      const srcPlc = ws.placements[br.sourcePlacementId];
      const tgtPlc = ws.placements[br.targetPlacementId];
      if (!srcPlc || !tgtPlc) continue;

      const srcEnt = entities[srcPlc.entityId];
      const tgtEnt = entities[tgtPlc.entityId];

      const sourceOrg = srcEnt?.name || srcPlc.entityId || br.sourcePlacementId;
      const targetOrg = tgtEnt?.name || tgtPlc.entityId || br.targetPlacementId;
      const targetCategory = tgtEnt?.category || 'other';

      rows.push({
        sourceOrg: sourceOrg.trim(),
        targetOrg: targetOrg.trim(),
        targetCategory,
        branchType: br.type || 'white',
        status: br.status || 'pending',
        fundingPct: typeof br.valuePct === 'number' ? br.valuePct : undefined,
        inKindInr: typeof br.inKindValueInr === 'number' ? br.inKindValueInr : undefined,
        note: br.note || '',
        selectiveIncentives: Array.isArray(tgtPlc.selectiveIncentives) ? [...tgtPlc.selectiveIncentives] : [],
        outreachAttempts: typeof tgtPlc.outreachAttempts === 'number' ? tgtPlc.outreachAttempts : 1,
      });
    }
    return rows;
  }

  // Extract array of records from various container shapes
  let items: unknown[] = [];
  if (Array.isArray(jsonInput)) {
    items = jsonInput;
  } else if (typeof jsonInput === 'object' && jsonInput !== null) {
    const obj = jsonInput as Record<string, unknown>;
    if (Array.isArray(obj.rows)) items = obj.rows;
    else if (Array.isArray(obj.data)) items = obj.data;
    else if (Array.isArray(obj.partnerships)) items = obj.partnerships;
    else if (Array.isArray(obj.records)) items = obj.records;
    else if (Array.isArray(obj.items)) items = obj.items;
  }

  if (!Array.isArray(items) || items.length === 0) return [];

  const rows: ImportRow[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, any>;

    const sourceOrg = (
      r.sourceOrg ||
      r.source_org ||
      r.source ||
      r['Source Org'] ||
      r['source_name'] ||
      r.from ||
      r['From'] ||
      ''
    ).toString().trim();

    const targetOrg = (
      r.targetOrg ||
      r.target_org ||
      r.target ||
      r['Target Org'] ||
      r['target_name'] ||
      r.to ||
      r['To'] ||
      ''
    ).toString().trim();

    if (!sourceOrg || !targetOrg) continue;

    const rawCat = (
      r.targetCategory ||
      r.target_category ||
      r.category ||
      r['Category'] ||
      'other'
    ).toString().toLowerCase();

    const targetCategory: EntityCategory = [
      'csr',
      'government',
      'institution',
      'community',
      'ngo',
      'other',
    ].includes(rawCat)
      ? (rawCat as EntityCategory)
      : 'other';

    const rawType = (r.branchType || r.branch_type || r.type || r['Type'] || 'white')
      .toString()
      .toLowerCase();
    const branchType: BranchType =
      rawType === 'green' || rawType === 'yellow' ? rawType : 'white';

    const rawStatus = (r.status || r['Status'] || 'pending').toString().toLowerCase();
    let status: BranchStatus = 'pending';
    if (rawStatus === 'tick' || rawStatus === 'confirmed' || rawStatus === 'accepted') {
      status = 'tick';
    } else if (rawStatus === 'cross' || rawStatus === 'declined' || rawStatus === 'rejected') {
      status = 'cross';
    }

    const rawFunding =
      r.fundingPct ?? r.funding_pct ?? r.funding ?? r['Funding %'] ?? r.valuePct ?? r.value_pct;
    const fundingPct =
      typeof rawFunding === 'number'
        ? rawFunding
        : typeof rawFunding === 'string'
        ? parseFloat(rawFunding.replace('%', ''))
        : undefined;

    const rawInKind =
      r.inKindInr ?? r.in_kind_inr ?? r.inKindValueInr ?? r.in_kind ?? r['In-Kind INR'];
    const inKindInr =
      typeof rawInKind === 'number'
        ? rawInKind
        : typeof rawInKind === 'string'
        ? parseRupeeAmount(rawInKind)
        : undefined;

    const note = (r.note || r.notes || r.description || r['Note'] || '').toString();

    let selectiveIncentives: SelectiveIncentiveTag[] = [];
    const rawIncentives = r.selectiveIncentives || r.selective_incentives || r.incentives;
    if (Array.isArray(rawIncentives)) {
      selectiveIncentives = rawIncentives.filter((s: string) =>
        [
          'csr_compliance',
          'brand_visibility',
          'institutional_mandate',
          'policy_influence',
          'network_prestige',
          'asset_activation',
          'community_legitimacy',
        ].includes(s)
      );
    } else if (typeof rawIncentives === 'string') {
      selectiveIncentives = rawIncentives
        .split(/[;,]/)
        .map((s) => s.trim().toLowerCase().replace(/[\s-]+/g, '_'))
        .filter((s) =>
          [
            'csr_compliance',
            'brand_visibility',
            'institutional_mandate',
            'policy_influence',
            'network_prestige',
            'asset_activation',
            'community_legitimacy',
          ].includes(s)
        ) as SelectiveIncentiveTag[];
    }

    const rawTouches = r.outreachAttempts ?? r.outreach_attempts ?? r.touches;
    const outreachAttempts =
      typeof rawTouches === 'number' && rawTouches >= 1
        ? Math.round(rawTouches)
        : typeof rawTouches === 'string'
        ? Math.max(1, parseInt(rawTouches, 10) || 1)
        : 1;

    rows.push({
      sourceOrg,
      targetOrg,
      targetCategory,
      branchType,
      status,
      fundingPct: typeof fundingPct === 'number' && !isNaN(fundingPct) ? fundingPct : undefined,
      inKindInr: typeof inKindInr === 'number' && !isNaN(inKindInr) ? inKindInr : undefined,
      note,
      selectiveIncentives,
      outreachAttempts,
    });
  }

  return rows;
}

/**
 * Universal file content parser: automatically detects JSON vs CSV and parses into ImportRow[].
 */
export function parseImportFileContent(content: string): ImportRow[] {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const jsonRows = parseTabularJson(parsed);
      if (jsonRows.length > 0) {
        return jsonRows;
      }
    } catch {
      // If JSON parse fails, fall through to CSV
    }
  }
  return parseStructuredCsv(content);
}


/**
 * 2. Validate and Preview Import before committing
 */
export function validateAndPreviewImport(
  rows: ImportRow[],
  existingEntities: Record<string, Entity>,
  _targetBudgetInr: number
): ImportPreviewResult {
  const existingNames = new Set(
    Object.values(existingEntities).map((e) => e.name.toLowerCase().trim())
  );

  const newEntitiesSet = new Set<string>();
  const reusedEntitiesSet = new Set<string>();
  const warnings: string[] = [];

  for (const row of rows) {
    for (const orgName of [row.sourceOrg, row.targetOrg]) {
      const clean = orgName.trim();
      if (!clean) continue;
      if (existingNames.has(clean.toLowerCase())) {
        reusedEntitiesSet.add(clean);
      } else {
        newEntitiesSet.add(clean);
      }
    }

    if (row.sourceOrg.toLowerCase() === row.targetOrg.toLowerCase()) {
      warnings.push(`Self-referencing branch skipped: ${row.sourceOrg}`);
    }
  }

  return {
    validRows: rows.filter(
      (r) => r.sourceOrg.toLowerCase() !== r.targetOrg.toLowerCase()
    ),
    newEntities: Array.from(newEntitiesSet),
    reusedEntities: Array.from(reusedEntitiesSet),
    branchCount: rows.length,
    warnings,
  };
}

/**
 * 3. Commit imported rows atomically with bottom-to-top ELK layout
 */
export async function commitImportedRows(
  rows: ImportRow[],
  activeWorkbookId: string,
  state: WorkspaceState
): Promise<WorkspaceState> {
  const now = new Date().toISOString();
  const entities: Record<string, Entity> = { ...state.entities };
  const placements: Record<string, Placement> = { ...state.placements };
  const branches: Record<string, Branch> = { ...state.branches };

  // Helper to find or create entity
  const entityNameToId: Record<string, string> = {};
  for (const ent of Object.values(entities)) {
    entityNameToId[ent.name.toLowerCase().trim()] = ent.entityId;
  }

  const getOrCreateEntityId = (name: string, category: EntityCategory = 'other'): string => {
    const key = name.toLowerCase().trim();
    if (entityNameToId[key]) {
      return entityNameToId[key];
    }
    const newId = `ent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    entities[newId] = {
      entityId: newId,
      name: name.trim(),
      category,
      globalNotes: 'Imported from spreadsheet',
      createdAt: now,
      updatedAt: now,
    };
    entityNameToId[key] = newId;
    return newId;
  };

  // Helper to find or create placement
  const entityIdToPlacementId: Record<string, string> = {};
  for (const plc of Object.values(placements)) {
    if (!plc.workbookId || plc.workbookId === activeWorkbookId) {
      entityIdToPlacementId[plc.entityId] = plc.placementId;
    }
  }

  const getOrCreatePlacementId = (
    entityId: string,
    isRoot: boolean = false,
    row?: ImportRow
  ): string => {
    if (entityIdToPlacementId[entityId]) {
      return entityIdToPlacementId[entityId];
    }
    const newPlcId = `plc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    placements[newPlcId] = {
      placementId: newPlcId,
      workbookId: activeWorkbookId,
      entityId,
      isRootNgo: isRoot,
      x: 100,
      y: 100,
      width: 190,
      height: 76,
      outreachAttempts: row?.outreachAttempts ?? 1,
      selectiveIncentives: row?.selectiveIncentives || [],
      coOwnershipSignals: {
        writtenCommitment: false,
        brandOrLogoShared: false,
        staffAssigned: false,
        networkMobilized: false,
      },
    };
    entityIdToPlacementId[entityId] = newPlcId;
    return newPlcId;
  };

  // First determine if any root placement exists
  let rootPlacement = Object.values(placements).find((p) => p.isRootNgo);

  for (const row of rows) {
    if (row.sourceOrg.toLowerCase() === row.targetOrg.toLowerCase()) continue;

    const isSourceRoot = !rootPlacement && row.sourceOrg.toLowerCase().includes('ngo');
    const srcEntId = getOrCreateEntityId(row.sourceOrg, 'ngo');
    const tgtEntId = getOrCreateEntityId(row.targetOrg, row.targetCategory || 'other');

    const srcPlcId = getOrCreatePlacementId(srcEntId, isSourceRoot, row);
    const tgtPlcId = getOrCreatePlacementId(tgtEntId, false, row);

    if (isSourceRoot && !rootPlacement) {
      rootPlacement = placements[srcPlcId];
    }

    // Create branch
    const branchId = `br-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    branches[branchId] = {
      branchId,
      workbookId: activeWorkbookId,
      sourcePlacementId: srcPlcId,
      targetPlacementId: tgtPlcId,
      type: row.branchType,
      status: row.status,
      valuePct: row.fundingPct,
      inKindValueInr: row.inKindInr,
      note: row.note || '',
      createdAt: now,
      updatedAt: now,
      resolvedAt: row.status !== 'pending' ? now : undefined,
    };
  }

  // Run bottom-to-top ELK hierarchical layout so all nodes are cleanly positioned
  const intermediateState: WorkspaceState = {
    ...state,
    entities,
    placements,
    branches,
  };

  try {
    const layoutCoords = await computeHierarchicalLayout(
      placements,
      branches,
      activeWorkbookId,
      'UP'
    );
    const updatedPlacements: Record<string, Placement> = {};
    for (const [id, plc] of Object.entries(placements)) {
      if (layoutCoords[id]) {
        updatedPlacements[id] = {
          ...plc,
          x: layoutCoords[id].x,
          y: layoutCoords[id].y,
        };
      } else {
        updatedPlacements[id] = { ...plc };
      }
    }
    return {
      ...intermediateState,
      placements: updatedPlacements,
    };
  } catch (err) {
    console.warn('[spreadsheetImport] ELK layout pass failed, returning unshifted state:', err);
    return intermediateState;
  }
}

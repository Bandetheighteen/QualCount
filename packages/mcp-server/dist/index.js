#!/usr/bin/env node

// packages/mcp-server/src/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// packages/mcp-server/src/storageAdapter.ts
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
async function atomicWriteFile(filePath, content) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.promises.writeFile(tmpPath, content, "utf-8");
  try {
    await fs.promises.rename(tmpPath, filePath);
  } catch (err) {
    if (err.code === "EEXIST" || err.code === "EPERM") {
      try {
        await fs.promises.unlink(filePath);
      } catch {
      }
      await fs.promises.rename(tmpPath, filePath);
    } else {
      try {
        await fs.promises.unlink(tmpPath);
      } catch {
      }
      throw err;
    }
  }
}
function resolveWorkspacePath(cliWorkspaceArg) {
  if (cliWorkspaceArg && cliWorkspaceArg.trim()) {
    return path.resolve(process.cwd(), cliWorkspaceArg.trim());
  }
  const args = process.argv;
  const wsIndex = args.indexOf("--workspace");
  if (wsIndex !== -1 && args[wsIndex + 1]) {
    return path.resolve(process.cwd(), args[wsIndex + 1]);
  }
  const envPath = process.env.QUALCOUNT_WORKSPACE || process.env.PARTNERSHIP_WORKSPACE;
  if (envPath && envPath.trim()) {
    return path.resolve(process.cwd(), envPath.trim());
  }
  try {
    const configPath = path.join(os.homedir(), ".partnership-ledger", "config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.activeWorkspacePath && typeof config.activeWorkspacePath === "string") {
        return path.resolve(config.activeWorkspacePath);
      }
    }
  } catch {
  }
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, "workspace.json"))) {
    return cwd;
  }
  return path.resolve(cwd, "workspace");
}
var McpWorkspaceStorage = class {
  workspacePath;
  maxSnapshotsPerWorkbook = 20;
  constructor(workspacePath) {
    this.workspacePath = resolveWorkspacePath(workspacePath);
  }
  getWorkspacePath() {
    return this.workspacePath;
  }
  async ensureWorkspaceInitialized(defaultName = "QualCount Workspace") {
    await fs.promises.mkdir(this.workspacePath, { recursive: true });
    await fs.promises.mkdir(path.join(this.workspacePath, "workbooks"), { recursive: true });
    await fs.promises.mkdir(path.join(this.workspacePath, ".snapshots"), { recursive: true });
    const manifestPath = path.join(this.workspacePath, "workspace.json");
    if (!fs.existsSync(manifestPath)) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const manifest = {
        schemaVersion: 2,
        workspaceId: `ws-${Date.now()}`,
        name: defaultName,
        revision: 1,
        workbooks: {},
        workbookLinks: {},
        createdAt: now,
        updatedAt: now,
        sourceType: "local"
      };
      await this.writeManifest(manifest);
    }
    const entitiesPath = path.join(this.workspacePath, "entities.json");
    if (!fs.existsSync(entitiesPath)) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const entitiesFile = {
        schemaVersion: 2,
        revision: 1,
        updatedAt: now,
        entities: {}
      };
      await this.writeEntities(entitiesFile);
    }
  }
  async readManifest() {
    const manifestPath = path.join(this.workspacePath, "workspace.json");
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Workspace manifest not found at: ${manifestPath}`);
    }
    const raw = await fs.promises.readFile(manifestPath, "utf-8");
    return JSON.parse(raw);
  }
  async writeManifest(manifest) {
    const manifestPath = path.join(this.workspacePath, "workspace.json");
    await atomicWriteFile(manifestPath, JSON.stringify(manifest, null, 2));
  }
  async readEntities() {
    const entitiesPath = path.join(this.workspacePath, "entities.json");
    if (!fs.existsSync(entitiesPath)) {
      throw new Error(`Entities file not found at: ${entitiesPath}`);
    }
    const raw = await fs.promises.readFile(entitiesPath, "utf-8");
    return JSON.parse(raw);
  }
  async writeEntities(entitiesFile) {
    const entitiesPath = path.join(this.workspacePath, "entities.json");
    await atomicWriteFile(entitiesPath, JSON.stringify(entitiesFile, null, 2));
  }
  async readWorkbook(workbookId) {
    let filePath = path.join(this.workspacePath, "workbooks", `wb_${workbookId}.json`);
    if (!fs.existsSync(filePath)) {
      try {
        const manifest = await this.readManifest();
        const ref = manifest.workbooks[workbookId];
        if (ref && ref.fileName) {
          filePath = path.join(this.workspacePath, ref.fileName);
        }
      } catch {
      }
    }
    if (!fs.existsSync(filePath)) {
      throw new Error(`Workbook not found: ${workbookId} (at ${filePath})`);
    }
    const raw = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  }
  async writeWorkbookDirect(workbook) {
    const filePath = path.join(this.workspacePath, "workbooks", `wb_${workbook.workbookId}.json`);
    await atomicWriteFile(filePath, JSON.stringify(workbook, null, 2));
    try {
      const manifest = await this.readManifest();
      manifest.workbooks[workbook.workbookId] = {
        workbookId: workbook.workbookId,
        fileName: `workbooks/wb_${workbook.workbookId}.json`,
        title: workbook.title,
        status: workbook.status,
        updatedAt: workbook.updatedAt
      };
      manifest.updatedAt = workbook.updatedAt;
      await this.writeManifest(manifest);
    } catch {
    }
  }
  /**
   * Performs an atomic workbook mutation with pre-write snapshot and rolling backup pruning.
   */
  async writeWorkbookWithSnapshot(workbookId, mutator, audit) {
    const current = await this.readWorkbook(workbookId);
    const snapshotsDir = path.join(this.workspacePath, ".snapshots");
    await fs.promises.mkdir(snapshotsDir, { recursive: true });
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const snapshotFilename = `wb_${workbookId}_${timestamp}.json`;
    const snapshotPath = path.join(snapshotsDir, snapshotFilename);
    await atomicWriteFile(snapshotPath, JSON.stringify(current, null, 2));
    try {
      const allFiles = await fs.promises.readdir(snapshotsDir);
      const prefix = `wb_${workbookId}_`;
      const matchingSnapshots = allFiles.filter((file) => file.startsWith(prefix) && file.endsWith(".json")).sort();
      if (matchingSnapshots.length > this.maxSnapshotsPerWorkbook) {
        const toRemove = matchingSnapshots.slice(0, matchingSnapshots.length - this.maxSnapshotsPerWorkbook);
        for (const file of toRemove) {
          try {
            await fs.promises.unlink(path.join(snapshotsDir, file));
          } catch {
          }
        }
      }
    } catch {
    }
    const currentClone = JSON.parse(JSON.stringify(current));
    const mutated = await mutator(currentClone);
    mutated.revision = (current.revision || 1) + 1;
    mutated.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    mutated.lastAgentMutation = {
      agentName: audit.agentName,
      toolName: audit.toolName,
      summary: audit.summary,
      timestamp: mutated.updatedAt
    };
    const filePath = path.join(this.workspacePath, "workbooks", `wb_${workbookId}.json`);
    await atomicWriteFile(filePath, JSON.stringify(mutated, null, 2));
    try {
      const manifest = await this.readManifest();
      manifest.workbooks[workbookId] = {
        workbookId,
        fileName: `workbooks/wb_${workbookId}.json`,
        title: mutated.title,
        status: mutated.status,
        updatedAt: mutated.updatedAt
      };
      manifest.updatedAt = mutated.updatedAt;
      manifest.revision = (manifest.revision || 1) + 1;
      await this.writeManifest(manifest);
    } catch {
    }
    return mutated;
  }
  /**
   * Reverts active workbook to the most recent pre-write snapshot.
   */
  async revertLastSnapshot(workbookId) {
    const snapshotsDir = path.join(this.workspacePath, ".snapshots");
    if (!fs.existsSync(snapshotsDir)) {
      return { reverted: false };
    }
    const allFiles = await fs.promises.readdir(snapshotsDir);
    const prefix = `wb_${workbookId}_`;
    const matchingSnapshots = allFiles.filter((file) => file.startsWith(prefix) && file.endsWith(".json")).sort();
    if (matchingSnapshots.length === 0) {
      return { reverted: false };
    }
    const latestSnapshot = matchingSnapshots[matchingSnapshots.length - 1];
    const snapshotPath = path.join(snapshotsDir, latestSnapshot);
    const snapshotRaw = await fs.promises.readFile(snapshotPath, "utf-8");
    const restoredWb = JSON.parse(snapshotRaw);
    restoredWb.revision = (restoredWb.revision || 1) + 1;
    restoredWb.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    restoredWb.lastAgentMutation = {
      agentName: "System",
      toolName: "revertLastSnapshot",
      summary: `Reverted to snapshot ${latestSnapshot}`,
      timestamp: restoredWb.updatedAt
    };
    const filePath = path.join(this.workspacePath, "workbooks", `wb_${workbookId}.json`);
    await atomicWriteFile(filePath, JSON.stringify(restoredWb, null, 2));
    try {
      await fs.promises.unlink(snapshotPath);
    } catch {
    }
    try {
      const manifest = await this.readManifest();
      manifest.workbooks[workbookId] = {
        workbookId,
        fileName: `workbooks/wb_${workbookId}.json`,
        title: restoredWb.title,
        status: restoredWb.status,
        updatedAt: restoredWb.updatedAt
      };
      manifest.updatedAt = restoredWb.updatedAt;
      manifest.revision = (manifest.revision || 1) + 1;
      await this.writeManifest(manifest);
    } catch {
    }
    return {
      reverted: true,
      snapshotFilename: latestSnapshot,
      workbook: restoredWb
    };
  }
  /**
   * Lists available snapshot files for a workbook, newest first.
   */
  async listSnapshots(workbookId) {
    const snapshotsDir = path.join(this.workspacePath, ".snapshots");
    if (!fs.existsSync(snapshotsDir)) {
      return [];
    }
    const allFiles = await fs.promises.readdir(snapshotsDir);
    const prefix = `wb_${workbookId}_`;
    return allFiles.filter((file) => file.startsWith(prefix) && file.endsWith(".json")).sort().reverse();
  }
};

// packages/mcp-server/src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// packages/mcp-server/src/tools/discovery.ts
import { z } from "zod";

// src/types/schema.ts
var DEFAULT_UTILITY_WEIGHTS = {
  presetName: "balanced",
  alphaR: 0.3,
  alphaA: 0.35,
  alphaV: 0.2,
  alphaC: 0.15
};

// src/engine/utility.ts
function normalizeWeights(weights) {
  if (!weights) return DEFAULT_UTILITY_WEIGHTS;
  const rawSum = weights.alphaR + weights.alphaA + weights.alphaV + weights.alphaC;
  if (rawSum <= 0 || isNaN(rawSum)) {
    return DEFAULT_UTILITY_WEIGHTS;
  }
  if (Math.abs(rawSum - 1) < 1e-3) {
    return weights;
  }
  return {
    ...weights,
    alphaR: weights.alphaR / rawSum,
    alphaA: weights.alphaA / rawSum,
    alphaV: weights.alphaV / rawSum,
    alphaC: weights.alphaC / rawSum
  };
}
function computeCoOwnershipDepth(signals) {
  if (!signals) return 0;
  const count = (signals.writtenCommitment ? 1 : 0) + (signals.brandOrLogoShared ? 1 : 0) + (signals.staffAssigned ? 1 : 0) + (signals.networkMobilized ? 1 : 0);
  return count / 4;
}
function computeSocialProofFactor(yellowInDegree) {
  const k = Math.max(0, yellowInDegree);
  return 1 - 1 / (1 + k);
}
function computeDownstreamAmplifierReach(placementId, placements, branches) {
  const adj = {};
  for (const br of Object.values(branches)) {
    if (br.type === "yellow" && br.status === "tick") {
      if (!adj[br.sourcePlacementId]) adj[br.sourcePlacementId] = [];
      adj[br.sourcePlacementId].push(br.targetPlacementId);
    }
  }
  const visited = /* @__PURE__ */ new Set();
  const queue = [placementId];
  visited.add(placementId);
  while (queue.length > 0) {
    const curr = queue.shift();
    const neighbors = adj[curr] || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  visited.delete(placementId);
  for (const [id, plc] of Object.entries(placements)) {
    if (plc.isRootNgo) {
      visited.delete(id);
    }
  }
  return visited.size;
}
function computePartnerUtility(placementId, workbook, entities, rootPlacementId) {
  const placement = workbook.placements[placementId];
  if (!placement) {
    throw new Error(`Placement ${placementId} not found in workbook`);
  }
  const entity = entities[placement.entityId];
  const entityName = entity?.name || "Unknown Partner";
  const activeWb = workbook.activeWorkbookId && workbook.workbooks ? workbook.workbooks[workbook.activeWorkbookId] : void 0;
  const rawWeights = workbook.utilityWeights || activeWb?.utilityWeights || DEFAULT_UTILITY_WEIGHTS;
  const weights = normalizeWeights(rawWeights);
  const branchesList = Object.values(workbook.branches);
  const yellowInBranches = branchesList.filter(
    (b) => b.targetPlacementId === placementId && b.type === "yellow" && b.status === "tick"
  );
  const yellowInDegree = yellowInBranches.length;
  const coOwnershipO = computeCoOwnershipDepth(placement.coOwnershipSignals);
  const socialProofS = computeSocialProofFactor(yellowInDegree);
  const incentiveFlagI = Boolean(placement.selectiveIncentives && placement.selectiveIncentives.length >= 1);
  const hasIncomingActive = branchesList.some(
    (b) => b.targetPlacementId === placementId && (b.status === "tick" || b.status === "pending")
  );
  const hasConfirmedDirect = branchesList.some(
    (b) => b.targetPlacementId === placementId && (b.type === "white" || b.type === "green") && b.status === "tick"
  );
  const isApathyWarning = !hasConfirmedDirect && hasIncomingActive && !incentiveFlagI && yellowInDegree === 0;
  const hasTickedWhiteFromRoot = branchesList.some(
    (b) => b.sourcePlacementId === rootPlacementId && b.targetPlacementId === placementId && b.type === "white" && b.status === "tick"
  );
  const directCommitmentR = hasTickedWhiteFromRoot ? 0.5 + 0.5 * coOwnershipO : 0;
  const confTargets = /* @__PURE__ */ new Set();
  for (const b of branchesList) {
    if (b.status === "tick" && workbook.placements[b.targetPlacementId] && !workbook.placements[b.targetPlacementId].isRootNgo) {
      confTargets.add(b.targetPlacementId);
    }
  }
  const nConf = Math.max(1, confTargets.size);
  const reachCount = computeDownstreamAmplifierReach(placementId, workbook.placements, workbook.branches);
  const amplificationA = Math.min(1, reachCount / nConf);
  const directYellowTargets = branchesList.filter((b) => b.sourcePlacementId === placementId && b.type === "yellow" && b.status === "tick").map((b) => b.targetPlacementId);
  let ownedConversionV = 0;
  if (directYellowTargets.length > 0) {
    const ownedCount = directYellowTargets.filter(
      (targetId) => branchesList.some(
        (b) => b.sourcePlacementId === rootPlacementId && b.targetPlacementId === targetId && b.type === "white" && b.status === "tick"
      )
    ).length;
    ownedConversionV = ownedCount / directYellowTargets.length;
  }
  const multiThreadTargets = /* @__PURE__ */ new Set();
  for (const pId of Object.keys(workbook.placements)) {
    if (pId === rootPlacementId) continue;
    const inY = branchesList.filter(
      (b) => b.targetPlacementId === pId && b.type === "yellow" && b.status === "tick"
    ).length;
    if (inY >= 2) {
      multiThreadTargets.add(pId);
    }
  }
  let multiThreadReinforcementC = 0;
  if (multiThreadTargets.size > 0) {
    const suppliedCount = directYellowTargets.filter((targetId) => multiThreadTargets.has(targetId)).length;
    multiThreadReinforcementC = suppliedCount / multiThreadTargets.size;
  }
  const weightedR = Number((100 * weights.alphaR * directCommitmentR).toFixed(2));
  const weightedA = Number((100 * weights.alphaA * amplificationA).toFixed(2));
  const weightedV = Number((100 * weights.alphaV * ownedConversionV).toFixed(2));
  const weightedC = Number((100 * weights.alphaC * multiThreadReinforcementC).toFixed(2));
  const utilityScoreU = Number(
    (100 * (weights.alphaR * directCommitmentR + weights.alphaA * amplificationA + weights.alphaV * ownedConversionV + weights.alphaC * multiThreadReinforcementC)).toFixed(1)
  );
  const outreachAttempts = Math.max(1, placement.outreachAttempts ?? 1);
  const utilityYieldEta = Number((utilityScoreU / outreachAttempts).toFixed(1));
  return {
    placementId,
    entityId: placement.entityId,
    entityName,
    coOwnershipO: Number(coOwnershipO.toFixed(2)),
    socialProofS: Number(socialProofS.toFixed(3)),
    incentiveFlagI,
    directCommitmentR: Number(directCommitmentR.toFixed(2)),
    amplificationA: Number(amplificationA.toFixed(2)),
    ownedConversionV: Number(ownedConversionV.toFixed(2)),
    multiThreadReinforcementC: Number(multiThreadReinforcementC.toFixed(2)),
    utilityScoreU,
    utilityYieldEta,
    decomposition: {
      R: Number(directCommitmentR.toFixed(2)),
      A: Number(amplificationA.toFixed(2)),
      V: Number(ownedConversionV.toFixed(2)),
      C: Number(multiThreadReinforcementC.toFixed(2)),
      weightedR,
      weightedA,
      weightedV,
      weightedC
    },
    isApathyWarning
  };
}
function computePublicChoiceUtilityReport(workbook, entities) {
  const placementsList = Object.values(workbook.placements);
  const branchesList = Object.values(workbook.branches);
  const rootPlacement = placementsList.find((p) => p.isRootNgo);
  const rootPlacementId = rootPlacement?.placementId || "";
  const activeWb = workbook.activeWorkbookId && workbook.workbooks ? workbook.workbooks[workbook.activeWorkbookId] : void 0;
  const rawWeights = workbook.utilityWeights || activeWb?.utilityWeights || DEFAULT_UTILITY_WEIGHTS;
  const weights = normalizeWeights(rawWeights);
  const partners = {};
  for (const placement of placementsList) {
    if (placement.isRootNgo) continue;
    partners[placement.placementId] = computePartnerUtility(
      placement.placementId,
      workbook,
      entities,
      rootPlacementId
    );
  }
  const directWhiteTargets = branchesList.filter(
    (b) => b.sourcePlacementId === rootPlacementId && b.type === "white" && (b.status === "tick" || b.status === "cross")
  );
  let rBar = 0;
  if (directWhiteTargets.length > 0) {
    let rSum = 0;
    for (const b of directWhiteTargets) {
      if (b.status === "tick") {
        const targetPlacement = workbook.placements[b.targetPlacementId];
        const oDepth = computeCoOwnershipDepth(targetPlacement?.coOwnershipSignals);
        rSum += 0.5 + 0.5 * oDepth;
      }
    }
    rBar = rSum / directWhiteTargets.length;
  }
  const referredNodeIds = /* @__PURE__ */ new Set();
  for (const b of branchesList) {
    if (b.type === "yellow" && b.status === "tick") {
      const tgt = workbook.placements[b.targetPlacementId];
      if (tgt && !tgt.isRootNgo) {
        referredNodeIds.add(b.targetPlacementId);
      }
    }
  }
  const convertedNodeIds = /* @__PURE__ */ new Set();
  for (const refId of referredNodeIds) {
    const hasWhiteTick = branchesList.some(
      (b) => b.sourcePlacementId === rootPlacementId && b.targetPlacementId === refId && b.type === "white" && b.status === "tick"
    );
    if (hasWhiteTick) {
      convertedNodeIds.add(refId);
    }
  }
  const vBar = referredNodeIds.size > 0 ? convertedNodeIds.size / referredNodeIds.size : 0;
  let multiThreadCount = 0;
  for (const refId of referredNodeIds) {
    const inY = branchesList.filter(
      (b) => b.targetPlacementId === refId && b.type === "yellow" && b.status === "tick"
    ).length;
    if (inY >= 2) {
      multiThreadCount++;
    }
  }
  const cBar = referredNodeIds.size > 0 ? multiThreadCount / referredNodeIds.size : 0;
  const nonRootPlacements = placementsList.filter((p) => !p.isRootNgo);
  let alignedCount = 0;
  for (const plc of nonRootPlacements) {
    const hasIncentive = Boolean(plc.selectiveIncentives && plc.selectiveIncentives.length >= 1);
    const hasIncomingYellow = branchesList.some(
      (b) => b.targetPlacementId === plc.placementId && b.type === "yellow" && b.status === "tick"
    );
    if (hasIncentive || hasIncomingYellow) {
      alignedCount++;
    }
  }
  const iBar = nonRootPlacements.length > 0 ? alignedCount / nonRootPlacements.length : 0;
  const pui = Number((100 * (0.35 * rBar + 0.25 * vBar + 0.2 * cBar + 0.2 * iBar)).toFixed(1));
  const totalTickedBranches = branchesList.filter((b) => b.status === "tick").length;
  const totalTouches = nonRootPlacements.reduce((sum, p) => sum + Math.max(1, p.outreachAttempts ?? 1), 0);
  const actionsPerTouch = totalTouches > 0 ? Number((totalTickedBranches / totalTouches).toFixed(2)) : 0;
  const inKindEquivalentInr = branchesList.reduce((sum, b) => {
    if (b.type === "white" && b.status === "tick" && typeof b.inKindValueInr === "number") {
      return sum + b.inKindValueInr;
    }
    return sum;
  }, 0);
  const targetBudgetInr = workbook.targetBudgetInr ?? activeWb?.targetBudgetInr ?? 0;
  const inKindEquivalentPct = targetBudgetInr > 0 ? Number((inKindEquivalentInr / targetBudgetInr * 100).toFixed(1)) : 0;
  return {
    pui,
    actionsPerTouch,
    inKindEquivalentPct,
    inKindEquivalentInr,
    partners,
    weights,
    strategyPreset: weights.presetName || "balanced"
  };
}

// src/engine/risk.ts
function computeStructuralRiskReport(workbook, entities, referenceTimeMs = Date.now()) {
  const placementsList = Object.values(workbook.placements);
  const branchesList = Object.values(workbook.branches);
  const rootPlacement = placementsList.find((p) => p.isRootNgo);
  const rootPlacementId = rootPlacement?.placementId || "";
  const yellowAdj = {};
  for (const b of branchesList) {
    if (b.type === "yellow" && b.status === "tick") {
      if (!yellowAdj[b.sourcePlacementId]) yellowAdj[b.sourcePlacementId] = [];
      yellowAdj[b.sourcePlacementId].push(b.targetPlacementId);
    }
  }
  const distFromRoot = {};
  if (rootPlacementId) {
    const q = [{ id: rootPlacementId, dist: 0 }];
    distFromRoot[rootPlacementId] = 0;
    while (q.length > 0) {
      const { id, dist } = q.shift();
      for (const next of yellowAdj[id] || []) {
        if (distFromRoot[next] === void 0) {
          distFromRoot[next] = dist + 1;
          q.push({ id: next, dist: dist + 1 });
        }
      }
    }
  }
  const indirectNodes = Object.keys(distFromRoot).filter(
    (id) => id !== rootPlacementId && distFromRoot[id] >= 2
  );
  let maxLossPct = 0;
  let topBridgeId = "";
  const r1OffendingPlacements = [];
  const r1OffendingBranches = [];
  if (indirectNodes.length > 0) {
    const candidateBridges = Object.keys(distFromRoot).filter(
      (id) => id !== rootPlacementId && (yellowAdj[id] || []).length > 0
    );
    for (const bridgeId of candidateBridges) {
      const simVisited = /* @__PURE__ */ new Set();
      const simQ = [rootPlacementId];
      simVisited.add(rootPlacementId);
      while (simQ.length > 0) {
        const curr = simQ.shift();
        for (const next of yellowAdj[curr] || []) {
          if (next !== bridgeId && !simVisited.has(next)) {
            simVisited.add(next);
            simQ.push(next);
          }
        }
      }
      const evalNodes = indirectNodes.filter((id) => id !== bridgeId);
      const lostCount = evalNodes.filter((id) => !simVisited.has(id)).length;
      const lossPct = evalNodes.length > 0 ? lostCount / evalNodes.length * 100 : 0;
      if (lossPct > maxLossPct) {
        maxLossPct = lossPct;
        topBridgeId = bridgeId;
      }
    }
  }
  let r1Severity = "low";
  if (maxLossPct > 70) r1Severity = "critical";
  else if (maxLossPct >= 50) r1Severity = "elevated";
  else if (maxLossPct >= 35) r1Severity = "moderate";
  if (topBridgeId && r1Severity !== "low") {
    r1OffendingPlacements.push(topBridgeId);
    const bridgeBranches = branchesList.filter(
      (b) => (b.sourcePlacementId === topBridgeId || b.targetPlacementId === topBridgeId) && b.type === "yellow" && b.status === "tick"
    ).map((b) => b.branchId);
    r1OffendingBranches.push(...bridgeBranches);
  }
  const bridgeName = topBridgeId ? entities[workbook.placements[topBridgeId]?.entityId]?.name || topBridgeId : "None";
  const r1 = {
    id: "R1",
    name: "Single-Bridge Concentration",
    score: Number(maxLossPct.toFixed(1)),
    scoreFormatted: `${maxLossPct.toFixed(1)}%`,
    severity: r1Severity,
    thresholdDescription: "Low < 35% | Mod 35-50% | Elev 50-70% | Crit > 70%",
    plainCommentary: maxLossPct === 0 ? "No articulation bridge bottleneck detected. Network pathways are either direct or diversified." : `${maxLossPct.toFixed(1)}% of indirect downstream network depends on a single bridge (${bridgeName}).`,
    offendingPlacementIds: r1OffendingPlacements,
    offendingBranchIds: r1OffendingBranches
  };
  const yellowReferredNodes = /* @__PURE__ */ new Set();
  for (const b of branchesList) {
    if (b.type === "yellow" && b.status === "tick") {
      const tgt = workbook.placements[b.targetPlacementId];
      if (tgt && !tgt.isRootNgo) {
        yellowReferredNodes.add(b.targetPlacementId);
      }
    }
  }
  const unownedNodes = Array.from(yellowReferredNodes).filter((targetId) => {
    const hasWhiteTick = branchesList.some(
      (b) => b.sourcePlacementId === rootPlacementId && b.targetPlacementId === targetId && b.type === "white" && b.status === "tick"
    );
    return !hasWhiteTick;
  });
  const r2Score = yellowReferredNodes.size > 0 ? unownedNodes.length / yellowReferredNodes.size * 100 : 0;
  let r2Severity = "low";
  if (r2Score > 75) r2Severity = "critical";
  else if (r2Score >= 50) r2Severity = "elevated";
  else if (r2Score >= 30) r2Severity = "moderate";
  const r2OffendingPlacements = r2Severity !== "low" ? unownedNodes : [];
  const r2 = {
    id: "R2",
    name: "Unowned Dependency Exposure",
    score: Number(r2Score.toFixed(1)),
    scoreFormatted: `${r2Score.toFixed(1)}%`,
    severity: r2Severity,
    thresholdDescription: "Low < 30% | Mod 30-50% | Elev 50-75% | Crit > 75%",
    plainCommentary: yellowReferredNodes.size === 0 ? "No referred nodes in workspace." : `${unownedNodes.length} of ${yellowReferredNodes.size} referred partners (${r2Score.toFixed(1)}%) lack a direct confirmed working relationship with the lead NGO.`,
    offendingPlacementIds: r2OffendingPlacements,
    offendingBranchIds: []
  };
  const greenBranches = branchesList.filter((b) => b.type === "green");
  const securedCashPct = greenBranches.filter((b) => b.status === "tick").reduce((sum, b) => sum + (b.valuePct || 0), 0);
  const pendingCashPct = greenBranches.filter((b) => b.status === "pending").reduce((sum, b) => sum + (b.valuePct || 0), 0);
  const donorSecured = {};
  for (const b of greenBranches) {
    if (b.status === "tick" && b.valuePct) {
      donorSecured[b.targetPlacementId] = (donorSecured[b.targetPlacementId] || 0) + b.valuePct;
    }
  }
  let topDonorPlacementId = "";
  let topDonorSecuredPct = 0;
  for (const [plcId, val] of Object.entries(donorSecured)) {
    if (val > topDonorSecuredPct) {
      topDonorSecuredPct = val;
      topDonorPlacementId = plcId;
    }
  }
  const topDonorShareOfSecured = securedCashPct > 0 ? topDonorSecuredPct / securedCashPct * 100 : 0;
  const combinedFunding = securedCashPct + pendingCashPct;
  let r3Severity = "low";
  if (topDonorShareOfSecured > 65 || combinedFunding < 50) {
    r3Severity = "critical";
  } else if (topDonorShareOfSecured > 50) {
    r3Severity = "elevated";
  } else if (topDonorShareOfSecured > 35 || combinedFunding < 75) {
    r3Severity = "moderate";
  }
  const r3OffendingPlacements = [];
  const r3OffendingBranches = [];
  if (topDonorPlacementId && (r3Severity === "elevated" || r3Severity === "critical")) {
    r3OffendingPlacements.push(topDonorPlacementId);
    const donorBranches = greenBranches.filter((b) => b.targetPlacementId === topDonorPlacementId && b.status === "tick").map((b) => b.branchId);
    r3OffendingBranches.push(...donorBranches);
  }
  const r3 = {
    id: "R3",
    name: "Funding Concentration & Runway Gap",
    score: Number(topDonorShareOfSecured.toFixed(1)),
    scoreFormatted: `${topDonorShareOfSecured.toFixed(1)}% / ${combinedFunding.toFixed(1)}%`,
    severity: r3Severity,
    thresholdDescription: "Crit: single donor >65% OR combined <50% | Elev: single >50%",
    plainCommentary: `Top donor accounts for ${topDonorShareOfSecured.toFixed(1)}% of secured cash. Combined pipeline covers ${combinedFunding.toFixed(1)}% of budget.`,
    offendingPlacementIds: r3OffendingPlacements,
    offendingBranchIds: r3OffendingBranches
  };
  const nonRootPlacements = placementsList.filter((p) => !p.isRootNgo);
  const pendingPartners = nonRootPlacements.filter((p) => {
    const hasTick = branchesList.some(
      (b) => b.targetPlacementId === p.placementId && b.status === "tick"
    );
    if (hasTick) return false;
    const hasPending = branchesList.some(
      (b) => b.targetPlacementId === p.placementId && b.status === "pending"
    );
    const hasAnyIncoming = branchesList.some(
      (b) => b.targetPlacementId === p.placementId
    );
    return hasAnyIncoming ? hasPending : true;
  });
  const apathyPartners = pendingPartners.filter((p) => {
    const yellowIn = branchesList.filter(
      (b) => b.targetPlacementId === p.placementId && b.type === "yellow" && b.status === "tick"
    ).length;
    const incentivesCount = p.selectiveIncentives?.length ?? 0;
    return yellowIn === 0 && incentivesCount === 0;
  });
  const denominator = pendingPartners.length > 0 ? pendingPartners.length : nonRootPlacements.length;
  const r4Score = denominator > 0 ? apathyPartners.length / denominator * 100 : 0;
  let r4Severity = "low";
  if (r4Score > 60) r4Severity = "critical";
  else if (r4Score >= 40) r4Severity = "elevated";
  else if (r4Score >= 20) r4Severity = "moderate";
  const r4OffendingPlacements = r4Severity !== "low" ? apathyPartners.map((p) => p.placementId) : [];
  const r4 = {
    id: "R4",
    name: "Public Choice Apathy Risk",
    score: Number(r4Score.toFixed(1)),
    scoreFormatted: `${r4Score.toFixed(1)}%`,
    severity: r4Severity,
    thresholdDescription: "Low < 20% | Mod 20-40% | Elev 40-60% | Crit > 60%",
    plainCommentary: apathyPartners.length === 0 ? "No apathy risk detected. All pending prospects possess either selective incentives or institutional referrals." : `${apathyPartners.length} unconfirmed prospects lack both selective incentives and referrals (high probability of rational apathy).`,
    offendingPlacementIds: r4OffendingPlacements,
    offendingBranchIds: []
  };
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1e3;
  const staleBranches = branchesList.filter((b) => {
    if (b.status !== "pending") return false;
    const createdMs = b.createdAt ? new Date(b.createdAt).getTime() : b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return createdMs > 0 && referenceTimeMs - createdMs > FOURTEEN_DAYS_MS;
  });
  const highFrictionPartners = nonRootPlacements.filter((p) => {
    const touches = p.outreachAttempts ?? 1;
    if (touches < 4) return false;
    const hasTick = branchesList.some(
      (b) => (b.targetPlacementId === p.placementId || b.sourcePlacementId === p.placementId) && b.status === "tick"
    );
    return !hasTick;
  });
  const r5Score = staleBranches.length + highFrictionPartners.length;
  let r5Severity = "low";
  if (r5Score >= 6) r5Severity = "critical";
  else if (r5Score >= 3) r5Severity = "elevated";
  else if (r5Score >= 1) r5Severity = "moderate";
  const r5OffendingPlacements = r5Severity !== "low" ? highFrictionPartners.map((p) => p.placementId) : [];
  const r5OffendingBranches = r5Severity !== "low" ? staleBranches.map((b) => b.branchId) : [];
  const r5 = {
    id: "R5",
    name: "Decision-Cost Drag & Stale Pipeline",
    score: r5Score,
    scoreFormatted: `${r5Score} issues`,
    severity: r5Severity,
    thresholdDescription: "Low = 0 | Mod = 1-2 | Elev = 3-5 | Crit >= 6",
    plainCommentary: r5Score === 0 ? "Pipeline is fresh and active. No stale branches or decision-sink partners." : `${staleBranches.length} branches unresolved >14 days; ${highFrictionPartners.length} partners at >=4 touches with 0 commitments.`,
    offendingPlacementIds: r5OffendingPlacements,
    offendingBranchIds: r5OffendingBranches
  };
  const totalTicks = branchesList.filter((b) => b.status === "tick").length;
  const totalCrosses = branchesList.filter((b) => b.status === "cross").length;
  const totalResolved = totalTicks + totalCrosses;
  const overallRejectionRate = totalResolved > 0 ? totalCrosses / totalResolved * 100 : 0;
  const categoryDeclines = {};
  for (const b of branchesList) {
    if (b.status === "tick" || b.status === "cross") {
      const tgt = workbook.placements[b.targetPlacementId];
      if (tgt) {
        const cat = entities[tgt.entityId]?.category || "other";
        if (!categoryDeclines[cat]) categoryDeclines[cat] = { tick: 0, cross: 0 };
        if (b.status === "tick") categoryDeclines[cat].tick++;
        if (b.status === "cross") categoryDeclines[cat].cross++;
      }
    }
  }
  let hasCategoryCluster = false;
  let clusteredCategory = "";
  for (const [cat, counts] of Object.entries(categoryDeclines)) {
    const total = counts.tick + counts.cross;
    if (counts.cross >= 3 && counts.cross / total > 0.6) {
      hasCategoryCluster = true;
      clusteredCategory = cat;
      break;
    }
  }
  let r6Severity = "low";
  if (overallRejectionRate > 65 || hasCategoryCluster) {
    r6Severity = "critical";
  } else if (overallRejectionRate >= 45) {
    r6Severity = "elevated";
  } else if (overallRejectionRate >= 25) {
    r6Severity = "moderate";
  }
  const r6OffendingBranches = branchesList.filter((b) => b.status === "cross").map((b) => b.branchId);
  const r6OffendingPlacements = branchesList.filter((b) => b.status === "cross").map((b) => b.targetPlacementId);
  const r6 = {
    id: "R6",
    name: "Rejection Cluster Signal",
    score: Number(overallRejectionRate.toFixed(1)),
    scoreFormatted: `${overallRejectionRate.toFixed(1)}%`,
    severity: r6Severity,
    thresholdDescription: "Low < 25% | Mod 25-45% | Elev 45-65% | Crit > 65%",
    plainCommentary: hasCategoryCluster ? `Rejection cluster detected in '${clusteredCategory}' sector (>=3 declines, >60% decline rate).` : `${totalCrosses} total declines out of ${totalResolved} resolved branches (${overallRejectionRate.toFixed(1)}% decline rate).`,
    offendingPlacementIds: r6Severity !== "low" ? Array.from(new Set(r6OffendingPlacements)) : [],
    offendingBranchIds: r6Severity !== "low" ? r6OffendingBranches : []
  };
  const params = { R1: r1, R2: r2, R3: r3, R4: r4, R5: r5, R6: r6 };
  const severities = Object.values(params).map((p) => p.severity);
  const criticalCount = severities.filter((s) => s === "critical").length;
  const elevatedCount = severities.filter((s) => s === "elevated").length;
  const moderateCount = severities.filter((s) => s === "moderate").length;
  let aggregateTier = "low";
  if (criticalCount >= 1 || elevatedCount >= 3) {
    aggregateTier = "critical";
  } else if (elevatedCount >= 1 || moderateCount >= 3) {
    aggregateTier = "elevated";
  } else if (moderateCount >= 1) {
    aggregateTier = "moderate";
  }
  const allOffendingPlacements = Array.from(
    new Set(Object.values(params).flatMap((p) => p.offendingPlacementIds))
  );
  const allOffendingBranches = Array.from(
    new Set(Object.values(params).flatMap((p) => p.offendingBranchIds))
  );
  return {
    aggregateTier,
    assessedAt: new Date(referenceTimeMs).toISOString(),
    parameters: params,
    allOffendingPlacementIds: allOffendingPlacements,
    allOffendingBranchIds: allOffendingBranches
  };
}

// src/engine/entityIndex.ts
function normalizeEntityName(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
}
function searchCrossWorkbookEntities(query, currentEntities, recentIndex = [], currentWorkbooks = {}, currentBranches = {}, currentPlacements = {}) {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return [];
  }
  const queryLower = trimmed.toLowerCase();
  const queryNormalized = normalizeEntityName(trimmed);
  const results = [];
  const seenEntityNames = /* @__PURE__ */ new Set();
  for (const [entityId, entity] of Object.entries(currentEntities)) {
    const entNameLower = entity.name.toLowerCase();
    const entNameNorm = normalizeEntityName(entity.name);
    if (entNameLower.includes(queryLower) || entNameNorm.includes(queryNormalized)) {
      seenEntityNames.add(entNameNorm);
      const matchingPlacements = Object.values(currentPlacements).filter(
        (p) => p.entityId === entityId
      );
      const targetYellowLeads = [];
      const seenTargetIds = /* @__PURE__ */ new Set();
      for (const plc of matchingPlacements) {
        for (const br of Object.values(currentBranches)) {
          if (br.sourcePlacementId === plc.placementId && br.type === "yellow" && br.status === "tick") {
            const targetPlc = currentPlacements[br.targetPlacementId];
            if (targetPlc) {
              const targetEnt = currentEntities[targetPlc.entityId];
              if (targetEnt && !seenTargetIds.has(targetEnt.entityId)) {
                seenTargetIds.add(targetEnt.entityId);
                targetYellowLeads.push({
                  targetEntityId: targetEnt.entityId,
                  targetEntityName: targetEnt.name,
                  targetCategory: targetEnt.category,
                  note: br.note || "Proven referral gateway"
                });
              }
            }
          }
        }
      }
      const firstPlc = matchingPlacements[0];
      const wbTitle = firstPlc?.workbookId && currentWorkbooks[firstPlc.workbookId] ? currentWorkbooks[firstPlc.workbookId].title : void 0;
      const historySummary = targetYellowLeads.length > 0 ? `Proven bridge with ${targetYellowLeads.length} confirmed referral${targetYellowLeads.length > 1 ? "s" : ""}` : entity.pointsOfContact && entity.pointsOfContact.length > 0 ? `${entity.pointsOfContact.length} documented point${entity.pointsOfContact.length > 1 ? "s" : ""} of contact` : "Registered organization in current workspace";
      results.push({
        entityId,
        name: entity.name,
        category: entity.category,
        source: "current_workspace",
        workbookTitle: wbTitle,
        historySummary,
        confirmedYellowOutCount: targetYellowLeads.length,
        targetYellowLeads
      });
    }
  }
  for (const entry of recentIndex) {
    const entryNameNorm = normalizeEntityName(entry.name);
    if (seenEntityNames.has(entryNameNorm)) {
      continue;
    }
    if (entry.name.toLowerCase().includes(queryLower) || entry.normalizedName.includes(queryNormalized)) {
      seenEntityNames.add(entryNameNorm);
      const lastMention = entry.workbookMentions[0];
      const targetYellowLeads = entry.targetYellowLeads || [];
      const confirmedYellowOutCount = entry.confirmedYellowOutCount ?? targetYellowLeads.length;
      const historySummary = entry.historySummary || (confirmedYellowOutCount > 0 ? `Proven referral gateway with ${confirmedYellowOutCount} confirmed lead${confirmedYellowOutCount > 1 ? "s" : ""} in ${entry.workspaceName}` : `Found in ${entry.workspaceName} [${entry.sourceType === "gdrive" ? "Google Drive" : "Local"}]`);
      results.push({
        entityId: entry.entityId,
        name: entry.name,
        category: entry.category,
        source: "external_workspace",
        workspaceName: entry.workspaceName,
        workbookTitle: lastMention?.workbookTitle,
        historySummary,
        confirmedYellowOutCount,
        targetYellowLeads
      });
    }
  }
  return results;
}

// packages/mcp-server/src/tools/discovery.ts
function registerDiscoveryTools(server, storage) {
  server.tool(
    "QualCount-list_workbooks",
    "Returns workspace metadata, source type, and all workbooks with summary KPIs (funding %, PUI, risk tier, node/edge counts).",
    {},
    async () => {
      const manifest = await storage.readManifest();
      const entitiesFile = await storage.readEntities();
      const workbooksSummary = [];
      for (const [wbId, ref] of Object.entries(manifest.workbooks || {})) {
        try {
          const wb = await storage.readWorkbook(wbId);
          const placementsCount = Object.keys(wb.placements || {}).length;
          const branchesCount = Object.keys(wb.branches || {}).length;
          let fundingPct = 0;
          const branches = Object.values(wb.branches || {});
          for (const branch of branches) {
            if (branch.type === "green" && branch.status === "tick") {
              fundingPct += branch.valuePct || 0;
            }
          }
          let pui = 0;
          try {
            const utilityRep = computePublicChoiceUtilityReport(wb, entitiesFile.entities);
            pui = utilityRep.pui;
          } catch {
          }
          let riskTier = "low";
          try {
            const riskRep = computeStructuralRiskReport(wb, entitiesFile.entities);
            riskTier = riskRep.aggregateTier;
          } catch {
          }
          workbooksSummary.push({
            id: wbId,
            title: wb.title || ref.title,
            description: wb.description,
            status: wb.status || ref.status,
            targetBudgetInr: wb.targetBudgetInr,
            placementsCount,
            branchesCount,
            fundingPct: Number(fundingPct.toFixed(1)),
            pui: Number(pui.toFixed(1)),
            riskTier,
            revision: wb.revision,
            updatedAt: wb.updatedAt
          });
        } catch (e) {
          workbooksSummary.push({
            id: wbId,
            title: ref.title,
            status: ref.status,
            error: e.message
          });
        }
      }
      const result = {
        workspaceId: manifest.workspaceId,
        workspaceName: manifest.name,
        sourceType: manifest.sourceType || "local",
        revision: manifest.revision,
        workbooksCount: workbooksSummary.length,
        workbooks: workbooksSummary
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }
  );
  server.tool(
    "QualCount-get_workbook_full",
    "Returns full Workbook JSON resolved with Entity names, computed Public Choice utility report, and Layer 1 structural risk report.",
    {
      workbookId: z.string().describe("The ID of the workbook to retrieve")
    },
    async ({ workbookId }) => {
      const workbook = await storage.readWorkbook(workbookId);
      const entitiesFile = await storage.readEntities();
      const resolvedPlacements = {};
      for (const [plcId, plc] of Object.entries(workbook.placements || {})) {
        const entity = entitiesFile.entities[plc.entityId];
        resolvedPlacements[plcId] = {
          ...plc,
          entityName: entity ? entity.name : "Unknown Entity",
          category: entity ? entity.category : "other",
          globalNotes: entity ? entity.globalNotes : ""
        };
      }
      const utilityReport = computePublicChoiceUtilityReport(workbook, entitiesFile.entities);
      const structuralRiskReport = computeStructuralRiskReport(workbook, entitiesFile.entities);
      const result = {
        workbook: {
          ...workbook,
          resolvedPlacements
        },
        publicChoiceUtilityReport: utilityReport,
        structuralRiskReport
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }
  );
  server.tool(
    "QualCount-search_entities",
    "Fuzzy searches entities in entities.json (and optional cross-workspace index) to prevent duplicate organizations before creation.",
    {
      query: z.string().describe("Search query string (min 1 character for MCP, 3 for fuzzy UI)"),
      includeCrossWorkspaceIndex: z.boolean().optional().describe("Whether to query cross-workspace recent index")
    },
    async ({ query, includeCrossWorkspaceIndex }) => {
      const entitiesFile = await storage.readEntities();
      if (!query || !query.trim()) {
        const all = Object.values(entitiesFile.entities).slice(0, 50);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query: "",
                  count: all.length,
                  total: all.length,
                  matches: all,
                  localMatches: all,
                  crossMatches: []
                },
                null,
                2
              )
            }
          ]
        };
      }
      const q = query.trim().toLowerCase();
      const localMatches = Object.values(entitiesFile.entities).filter((ent) => {
        return ent.name.toLowerCase().includes(q) || ent.category.toLowerCase().includes(q) || ent.globalNotes && ent.globalNotes.toLowerCase().includes(q);
      });
      let crossMatches = [];
      if (includeCrossWorkspaceIndex) {
        try {
          const manifest = await storage.readManifest();
          const dummyWorkbooks = {};
          for (const wbId of Object.keys(manifest.workbooks || {})) {
            dummyWorkbooks[wbId] = { workbookId: wbId, title: manifest.workbooks[wbId].title };
          }
          const results = searchCrossWorkbookEntities(query, entitiesFile.entities, [], dummyWorkbooks);
          crossMatches = results;
        } catch {
        }
      }
      const totalCount = localMatches.length + crossMatches.length;
      const result = {
        query,
        count: totalCount,
        total: totalCount,
        matches: localMatches,
        localMatches,
        crossMatches
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }
  );
}

// packages/mcp-server/src/tools/mutation.ts
import * as fs2 from "fs";
import * as path2 from "path";
import { z as z2 } from "zod";

// src/engine/layout.ts
import ELK from "elkjs/lib/elk.bundled.js";
var elk = new ELK();
var DEFAULT_LAYOUT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "UP",
  "elk.edgeRouting": "SPLINES",
  "elk.spacing.nodeNode": "72",
  "elk.layered.spacing.nodeNodeBetweenLayers": "125",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX"
};
async function computeHierarchicalLayout(placements, branches, activeWorkbookId, direction = "UP") {
  const placementList = Object.values(placements).filter(
    (p) => !activeWorkbookId || p.workbookId === activeWorkbookId
  );
  const branchList = Object.values(branches).filter(
    (b) => !activeWorkbookId || b.workbookId === activeWorkbookId
  );
  if (placementList.length === 0) {
    return {};
  }
  const placementIdSet = new Set(placementList.map((p) => p.placementId));
  const connectedIdSet = /* @__PURE__ */ new Set();
  const validBranches = [];
  for (const b of branchList) {
    if (placementIdSet.has(b.sourcePlacementId) && placementIdSet.has(b.targetPlacementId)) {
      connectedIdSet.add(b.sourcePlacementId);
      connectedIdSet.add(b.targetPlacementId);
      validBranches.push(b);
    }
  }
  const connectedPlacements = placementList.filter(
    (p) => connectedIdSet.has(p.placementId)
  );
  const isolatedPlacements = placementList.filter(
    (p) => !connectedIdSet.has(p.placementId)
  );
  const resultPositions = {};
  let minX = 100;
  let maxY = 100;
  if (connectedPlacements.length > 0) {
    const layoutOptions = {
      ...DEFAULT_LAYOUT_OPTIONS,
      "elk.direction": direction
    };
    const elkGraph = {
      id: "root",
      layoutOptions,
      children: connectedPlacements.map((p) => ({
        id: p.placementId,
        width: p.width || 190,
        height: p.height || 76
      })),
      edges: validBranches.map((b) => ({
        id: b.branchId,
        sources: [b.sourcePlacementId],
        targets: [b.targetPlacementId]
      }))
    };
    try {
      const laidOut = await elk.layout(elkGraph);
      if (laidOut.children && laidOut.children.length > 0) {
        let currentMinX = Infinity;
        let currentMaxY = -Infinity;
        for (const node of laidOut.children) {
          const nx = Math.round(node.x ?? 0);
          const ny = Math.round(node.y ?? 0);
          resultPositions[node.id] = { x: nx, y: ny };
          if (nx < currentMinX) {
            currentMinX = nx;
          }
          const nodeHeight = node.height ?? 76;
          if (ny + nodeHeight > currentMaxY) {
            currentMaxY = ny + nodeHeight;
          }
        }
        if (currentMinX !== Infinity) {
          minX = currentMinX;
        }
        if (currentMaxY !== -Infinity) {
          maxY = currentMaxY;
        }
      }
    } catch {
      for (const p of connectedPlacements) {
        resultPositions[p.placementId] = {
          x: Math.round(p.x ?? 0),
          y: Math.round(p.y ?? 0)
        };
      }
    }
  }
  if (isolatedPlacements.length > 0) {
    const rackY = maxY + 150;
    const rackSpacing = 220;
    isolatedPlacements.forEach((p, idx) => {
      resultPositions[p.placementId] = {
        x: minX + idx * rackSpacing,
        y: rackY
      };
    });
  }
  return resultPositions;
}

// packages/mcp-server/src/tools/mutation.ts
function registerMutationTools(server, storage) {
  server.tool(
    "QualCount-create_workbook",
    "Creates a new workbook JSON file with Root NGO anchored at Tier 0 (x: 400, y: 600).",
    {
      title: z2.string().min(1).describe("Title of the new workbook"),
      description: z2.string().optional().describe("Description of the project/campaign"),
      targetBudgetInr: z2.number().positive().optional().describe("Target funding budget in INR (default 1,000,000)"),
      rootNgoName: z2.string().optional().describe('Name of the Host/Root NGO (default "Lead NGO")')
    },
    async ({ title, description, targetBudgetInr, rootNgoName }) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      let workbookId = `wb-${slug || Date.now()}`;
      const existingWbPath = path2.join(storage.getWorkspacePath(), "workbooks", `wb_${workbookId}.json`);
      if (fs2.existsSync(existingWbPath)) {
        workbookId = `wb-${slug || "project"}-${Date.now().toString(36).slice(2, 6)}`;
      }
      const ngoName = rootNgoName && rootNgoName.trim() || "Lead NGO";
      const entitiesFile = await storage.readEntities();
      let rootEntityId = Object.keys(entitiesFile.entities).find(
        (id) => entitiesFile.entities[id].name.toLowerCase() === ngoName.toLowerCase()
      );
      if (!rootEntityId) {
        rootEntityId = `ent-${Date.now()}-root`;
        entitiesFile.entities[rootEntityId] = {
          entityId: rootEntityId,
          name: ngoName,
          category: "ngo",
          globalNotes: "Root NGO entity created via MCP",
          createdAt: now,
          updatedAt: now
        };
        await storage.writeEntities(entitiesFile);
      }
      const rootPlacementId = `plc-${Date.now()}-root`;
      const rootPlacement = {
        placementId: rootPlacementId,
        workbookId,
        entityId: rootEntityId,
        isRootNgo: true,
        x: 400,
        y: 600,
        width: 190,
        height: 76,
        selectiveIncentives: ["institutional_mandate"],
        coOwnershipSignals: {
          writtenCommitment: true,
          brandOrLogoShared: true,
          staffAssigned: true,
          networkMobilized: true
        },
        outreachAttempts: 1
      };
      const newWorkbook = {
        schemaVersion: 2,
        workbookId,
        revision: 1,
        title: title.trim(),
        description: (description || "").trim(),
        targetBudgetInr: targetBudgetInr || 1e6,
        status: "active",
        utilityWeights: {
          presetName: "balanced",
          alphaR: 0.3,
          alphaA: 0.35,
          alphaV: 0.2,
          alphaC: 0.15
        },
        placements: {
          [rootPlacementId]: rootPlacement
        },
        branches: {},
        lastAgentMutation: {
          agentName: "MCP Agent",
          toolName: "create_workbook",
          summary: `Created workbook "${title}" with Tier 0 root "${ngoName}"`,
          timestamp: now
        },
        createdAt: now,
        updatedAt: now
      };
      await storage.writeWorkbookDirect(newWorkbook);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                workbookId,
                title: newWorkbook.title,
                targetBudgetInr: newWorkbook.targetBudgetInr,
                rootPlacementId,
                rootEntityId
              },
              null,
              2
            )
          }
        ]
      };
    }
  );
  server.tool(
    "QualCount-add_or_import_entity",
    "Deduplicates against entities.json, inserts a non-overlapping Placement, and optionally pulls confirmed yellow leads as dashed pending branches.",
    {
      workbookId: z2.string().min(1).describe("The target workbook ID"),
      name: z2.string().min(1).describe("Partner organization name"),
      category: z2.enum(["ngo", "csr", "government", "institution", "community", "other"]).describe("Organization category"),
      globalNotes: z2.string().optional().describe("Global institutional notes"),
      selectiveIncentives: z2.array(
        z2.enum([
          "csr_compliance",
          "brand_visibility",
          "institutional_mandate",
          "policy_influence",
          "network_prestige",
          "asset_activation",
          "community_legitimacy"
        ])
      ).optional().describe("Selective incentives aligned with partner"),
      outreachAttempts: z2.number().int().min(1).optional().describe("Decision cost touches (default 1)"),
      importPendingYellowFromWorkbookId: z2.string().optional().describe("Optional sibling workbook to inspect for proven referral bridges")
    },
    async ({
      workbookId,
      name,
      category,
      globalNotes,
      selectiveIncentives,
      outreachAttempts,
      importPendingYellowFromWorkbookId
    }) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const normName = name.trim().toLowerCase();
      const entitiesFile = await storage.readEntities();
      let entityId = Object.keys(entitiesFile.entities).find(
        (id) => entitiesFile.entities[id].name.trim().toLowerCase() === normName
      );
      let isReusedEntity = false;
      if (entityId) {
        isReusedEntity = true;
        if (globalNotes && !entitiesFile.entities[entityId].globalNotes) {
          entitiesFile.entities[entityId].globalNotes = globalNotes;
          entitiesFile.entities[entityId].updatedAt = now;
          await storage.writeEntities(entitiesFile);
        }
      } else {
        entityId = `ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newEntity = {
          entityId,
          name: name.trim(),
          category,
          globalNotes: globalNotes || "",
          createdAt: now,
          updatedAt: now
        };
        entitiesFile.entities[entityId] = newEntity;
        await storage.writeEntities(entitiesFile);
      }
      let createdPlacementId = "";
      let importedBridgesCount = 0;
      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          const existingPlacement = Object.values(wb.placements || {}).find((p) => p.entityId === entityId);
          if (existingPlacement) {
            createdPlacementId = existingPlacement.placementId;
            return wb;
          }
          createdPlacementId = `plc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const placementCount = Object.keys(wb.placements || {}).length;
          const x = 200 + placementCount % 5 * 220;
          const y = 350 - Math.floor(placementCount / 5) * 120;
          const newPlacement = {
            placementId: createdPlacementId,
            workbookId,
            entityId,
            isRootNgo: false,
            x,
            y,
            width: 190,
            height: 76,
            selectiveIncentives: selectiveIncentives || [],
            coOwnershipSignals: {
              writtenCommitment: false,
              brandOrLogoShared: false,
              staffAssigned: false,
              networkMobilized: false
            },
            outreachAttempts: outreachAttempts || 1
          };
          wb.placements[createdPlacementId] = newPlacement;
          if (importPendingYellowFromWorkbookId) {
            try {
              const srcWb = await storage.readWorkbook(importPendingYellowFromWorkbookId);
              const srcPlc = Object.values(srcWb.placements || {}).find((p) => p.entityId === entityId);
              if (srcPlc) {
                for (const branch of Object.values(srcWb.branches || {})) {
                  if (branch.type === "yellow" && branch.status === "tick") {
                    if (branch.sourcePlacementId === srcPlc.placementId) {
                      const tgtSrcPlc = srcWb.placements[branch.targetPlacementId];
                      if (tgtSrcPlc) {
                        const localTgtPlc = Object.values(wb.placements).find(
                          (p) => p.entityId === tgtSrcPlc.entityId
                        );
                        if (localTgtPlc) {
                          const alreadyExists = Object.values(wb.branches).some(
                            (b) => b.type === "yellow" && b.sourcePlacementId === createdPlacementId && b.targetPlacementId === localTgtPlc.placementId
                          );
                          if (!alreadyExists) {
                            const newBrId = `br-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                            wb.branches[newBrId] = {
                              branchId: newBrId,
                              workbookId,
                              sourcePlacementId: createdPlacementId,
                              targetPlacementId: localTgtPlc.placementId,
                              type: "yellow",
                              status: "pending",
                              // CRITICAL: Always pending dashed, no false confirmations!
                              note: `Imported referral bridge from ${srcWb.title}`,
                              createdAt: now,
                              updatedAt: now
                            };
                            importedBridgesCount++;
                          }
                        }
                      }
                    }
                    if (branch.targetPlacementId === srcPlc.placementId) {
                      const srcSrcPlc = srcWb.placements[branch.sourcePlacementId];
                      if (srcSrcPlc) {
                        const localSrcPlc = Object.values(wb.placements).find(
                          (p) => p.entityId === srcSrcPlc.entityId
                        );
                        if (localSrcPlc) {
                          const alreadyExists = Object.values(wb.branches).some(
                            (b) => b.type === "yellow" && b.sourcePlacementId === localSrcPlc.placementId && b.targetPlacementId === createdPlacementId
                          );
                          if (!alreadyExists) {
                            const newBrId = `br-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                            wb.branches[newBrId] = {
                              branchId: newBrId,
                              workbookId,
                              sourcePlacementId: localSrcPlc.placementId,
                              targetPlacementId: createdPlacementId,
                              type: "yellow",
                              status: "pending",
                              // CRITICAL: Always pending dashed, no false confirmations!
                              note: `Imported referral bridge from ${srcWb.title}`,
                              createdAt: now,
                              updatedAt: now
                            };
                            importedBridgesCount++;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } catch {
            }
          }
          return wb;
        },
        {
          agentName: "MCP Agent",
          toolName: "add_or_import_entity",
          summary: `Added partner "${name}" (${category})${isReusedEntity ? " [reused entity]" : ""}`
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                entityId,
                placementId: createdPlacementId,
                name: name.trim(),
                category,
                isReusedEntity,
                importedBridgesCount
              },
              null,
              2
            )
          }
        ]
      };
    }
  );
  server.tool(
    "QualCount-update_placement_attributes",
    "Updates Public Choice attributes (selective incentives, co-ownership signals, outreach touches) without touching visual coordinates.",
    {
      workbookId: z2.string().min(1).describe("The workbook ID"),
      placementId: z2.string().min(1).describe("The placement ID to update"),
      selectiveIncentives: z2.array(
        z2.enum([
          "csr_compliance",
          "brand_visibility",
          "institutional_mandate",
          "policy_influence",
          "network_prestige",
          "asset_activation",
          "community_legitimacy"
        ])
      ).optional().describe("Selective incentive tags"),
      coOwnershipSignals: z2.object({
        writtenCommitment: z2.boolean().optional(),
        brandOrLogoShared: z2.boolean().optional(),
        staffAssigned: z2.boolean().optional(),
        networkMobilized: z2.boolean().optional()
      }).optional().describe("Ostrom co-ownership checklist signals"),
      outreachAttempts: z2.number().int().min(1).optional().describe("Decision cost outreach touches"),
      globalNotes: z2.string().optional().describe("Update master entity global notes")
    },
    async ({ workbookId, placementId, selectiveIncentives, coOwnershipSignals, outreachAttempts, globalNotes }) => {
      let updatedPlacement = null;
      let entityIdToUpdate = "";
      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          const placement = wb.placements[placementId];
          if (!placement) {
            throw new Error(`Placement "${placementId}" not found in workbook "${workbookId}"`);
          }
          entityIdToUpdate = placement.entityId;
          if (selectiveIncentives !== void 0) {
            placement.selectiveIncentives = selectiveIncentives;
          }
          if (coOwnershipSignals !== void 0) {
            placement.coOwnershipSignals = {
              writtenCommitment: coOwnershipSignals.writtenCommitment ?? placement.coOwnershipSignals?.writtenCommitment ?? false,
              brandOrLogoShared: coOwnershipSignals.brandOrLogoShared ?? placement.coOwnershipSignals?.brandOrLogoShared ?? false,
              staffAssigned: coOwnershipSignals.staffAssigned ?? placement.coOwnershipSignals?.staffAssigned ?? false,
              networkMobilized: coOwnershipSignals.networkMobilized ?? placement.coOwnershipSignals?.networkMobilized ?? false
            };
          }
          if (outreachAttempts !== void 0) {
            placement.outreachAttempts = outreachAttempts;
          }
          updatedPlacement = { ...placement };
          return wb;
        },
        {
          agentName: "MCP Agent",
          toolName: "update_placement_attributes",
          summary: `Updated Public Choice attributes for placement ${placementId}`
        }
      );
      if (globalNotes !== void 0 && entityIdToUpdate) {
        try {
          const entitiesFile = await storage.readEntities();
          if (entitiesFile.entities[entityIdToUpdate]) {
            entitiesFile.entities[entityIdToUpdate].globalNotes = globalNotes;
            entitiesFile.entities[entityIdToUpdate].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
            await storage.writeEntities(entitiesFile);
          }
        } catch {
        }
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                placement: updatedPlacement
              },
              null,
              2
            )
          }
        ]
      };
    }
  );
  server.tool(
    "QualCount-create_branch",
    "Creates a directed multiplex branch (green cash funding, white direct tie, or yellow referral bridge). Validates no self-loops.",
    {
      workbookId: z2.string().min(1).describe("The workbook ID"),
      sourcePlacementId: z2.string().min(1).describe("Source placement ID"),
      targetPlacementId: z2.string().min(1).describe("Target placement ID"),
      type: z2.enum(["green", "white", "yellow"]).describe("Branch type: green (funding), white (direct), yellow (bridge)"),
      status: z2.enum(["pending", "tick", "cross"]).describe("Branch status: pending (dashed), tick (confirmed), cross (declined)"),
      valuePct: z2.number().min(0).max(100).optional().describe("Green branch only: percentage of target budget"),
      inKindValueInr: z2.number().min(0).optional().describe("White branch only: estimated market value of in-kind asset"),
      note: z2.string().optional().describe("Contextual note or meeting record")
    },
    async ({
      workbookId,
      sourcePlacementId,
      targetPlacementId,
      type,
      status,
      valuePct,
      inKindValueInr,
      note
    }) => {
      if (sourcePlacementId === targetPlacementId) {
        throw new Error("Self-loops are forbidden: sourcePlacementId cannot equal targetPlacementId");
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const branchId = `br-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      let createdBranch = null;
      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          const srcPlc = wb.placements[sourcePlacementId];
          const tgtPlc = wb.placements[targetPlacementId];
          if (!srcPlc) {
            throw new Error(`Source placement "${sourcePlacementId}" not found in workbook`);
          }
          if (!tgtPlc) {
            throw new Error(`Target placement "${targetPlacementId}" not found in workbook`);
          }
          if ((type === "white" || type === "green") && !srcPlc.isRootNgo && !tgtPlc.isRootNgo) {
            throw new Error(
              `Ownership rule violation: Direct ${type} branches must connect to or from the Root NGO. Third-party relationships between external partners must be recorded as yellow referral bridges.`
            );
          }
          const branch = {
            branchId,
            workbookId,
            sourcePlacementId,
            targetPlacementId,
            type,
            status,
            valuePct: type === "green" ? valuePct ?? 0 : void 0,
            inKindValueInr: type === "white" ? inKindValueInr : void 0,
            note: note || "",
            createdAt: now,
            updatedAt: now,
            resolvedAt: status !== "pending" ? now : void 0
          };
          wb.branches[branchId] = branch;
          createdBranch = branch;
          return wb;
        },
        {
          agentName: "MCP Agent",
          toolName: "create_branch",
          summary: `Created ${type} (${status}) branch ${sourcePlacementId} -> ${targetPlacementId}`
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                branch: createdBranch
              },
              null,
              2
            )
          }
        ]
      };
    }
  );
  server.tool(
    "QualCount-update_branch",
    "Updates branch status (pending/tick/cross), type, values, or notes. Preserves declined memory by setting status to cross instead of deleting.",
    {
      workbookId: z2.string().min(1).describe("The workbook ID"),
      branchId: z2.string().min(1).describe("The branch ID to update"),
      status: z2.enum(["pending", "tick", "cross"]).optional().describe("New branch status"),
      type: z2.enum(["green", "white", "yellow"]).optional().describe("New branch type"),
      valuePct: z2.number().min(0).max(100).optional().describe("Green branch percentage"),
      inKindValueInr: z2.number().min(0).optional().describe("White branch in-kind value in INR"),
      note: z2.string().optional().describe("Updated note")
    },
    async ({ workbookId, branchId, status, type, valuePct, inKindValueInr, note }) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      let updatedBranch = null;
      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          const branch = wb.branches[branchId];
          if (!branch) {
            throw new Error(`Branch "${branchId}" not found in workbook "${workbookId}"`);
          }
          if (status !== void 0) {
            branch.status = status;
            if (status !== "pending" && !branch.resolvedAt) {
              branch.resolvedAt = now;
            }
          }
          if (type !== void 0) {
            const srcPlc = wb.placements[branch.sourcePlacementId];
            const tgtPlc = wb.placements[branch.targetPlacementId];
            if ((type === "white" || type === "green") && srcPlc && tgtPlc && !srcPlc.isRootNgo && !tgtPlc.isRootNgo) {
              throw new Error(
                `Ownership rule violation: Direct ${type} branches must connect to or from the Root NGO. Third-party relationships between external partners must be recorded as yellow referral bridges.`
              );
            }
            branch.type = type;
          }
          if (valuePct !== void 0) {
            branch.valuePct = valuePct;
          }
          if (inKindValueInr !== void 0) {
            branch.inKindValueInr = inKindValueInr;
          }
          if (note !== void 0) {
            branch.note = note;
          }
          branch.updatedAt = now;
          updatedBranch = { ...branch };
          return wb;
        },
        {
          agentName: "MCP Agent",
          toolName: "update_branch",
          summary: `Updated branch ${branchId} (${status || "fields"})`
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                branch: updatedBranch
              },
              null,
              2
            )
          }
        ]
      };
    }
  );
  server.tool(
    "QualCount-delete_branch",
    'Deletes an erroneous branch. Agents should prefer update_branch with status: "cross" to preserve institutional memory of declines.',
    {
      workbookId: z2.string().min(1).describe("The workbook ID"),
      branchId: z2.string().min(1).describe("The branch ID to remove")
    },
    async ({ workbookId, branchId }) => {
      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          if (!wb.branches[branchId]) {
            throw new Error(`Branch "${branchId}" not found in workbook "${workbookId}"`);
          }
          delete wb.branches[branchId];
          return wb;
        },
        {
          agentName: "MCP Agent",
          toolName: "delete_branch",
          summary: `Deleted branch ${branchId}`
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                deletedBranchId: branchId
              },
              null,
              2
            )
          }
        ]
      };
    }
  );
  server.tool(
    "QualCount-run_tidy_up_layout",
    'Executes pure elkjs bottom-to-top hierarchical layout (direction: "UP") and updates placement coordinates so the canvas opens cleanly.',
    {
      workbookId: z2.string().min(1).describe("The workbook ID to layout")
    },
    async ({ workbookId }) => {
      let placementsUpdated = 0;
      let layoutResult = {};
      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          layoutResult = await computeHierarchicalLayout(wb.placements, wb.branches, workbookId, "UP");
          for (const [plcId, coords] of Object.entries(layoutResult)) {
            if (wb.placements[plcId]) {
              wb.placements[plcId].x = coords.x;
              wb.placements[plcId].y = coords.y;
              placementsUpdated++;
            }
          }
          return wb;
        },
        {
          agentName: "MCP Agent",
          toolName: "run_tidy_up_layout",
          summary: `Applied bottom-to-top ELK layout (${placementsUpdated} placements repositioned)`
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                placementsUpdated,
                coordinates: layoutResult
              },
              null,
              2
            )
          }
        ]
      };
    }
  );
}

// packages/mcp-server/src/tools/utility.ts
import { z as z3 } from "zod";
function registerUtilityTools(server, storage) {
  server.tool(
    "QualCount-get_public_choice_utility_report",
    "Returns exact Partnership Utility Index (PUI), Decision-Cost Efficiency, per-partner utility decomposition, and apathy warnings.",
    {
      workbookId: z3.string().min(1).describe("The workbook ID")
    },
    async ({ workbookId }) => {
      const workbook = await storage.readWorkbook(workbookId);
      const entitiesFile = await storage.readEntities();
      const report = computePublicChoiceUtilityReport(workbook, entitiesFile.entities);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(report, null, 2)
          }
        ]
      };
    }
  );
  server.tool(
    "QualCount-update_utility_strategy_weights",
    "Updates Public Choice strategy weights (alphaR + alphaA + alphaV + alphaC = 1.00 \xB1 0.001).",
    {
      workbookId: z3.string().min(1).describe("The workbook ID"),
      alphaR: z3.number().min(0).max(1).describe("Weight for Direct Commitment & Co-Ownership (0 to 1)"),
      alphaA: z3.number().min(0).max(1).describe("Weight for Ecosystem Brokerage & Amplification (0 to 1)"),
      alphaV: z3.number().min(0).max(1).describe("Weight for Owned Relationship Conversion (0 to 1)"),
      alphaC: z3.number().min(0).max(1).describe("Weight for Multi-Thread Reinforcement (0 to 1)")
    },
    async ({ workbookId, alphaR, alphaA, alphaV, alphaC }) => {
      const sum = alphaR + alphaA + alphaV + alphaC;
      if (Math.abs(sum - 1) > 1e-3) {
        throw new Error(
          `Weights must sum to 1.00 \xB1 0.001. Current sum: ${sum.toFixed(4)} (R=${alphaR}, A=${alphaA}, V=${alphaV}, C=${alphaC})`
        );
      }
      const updatedWeights = {
        presetName: "custom",
        alphaR,
        alphaA,
        alphaV,
        alphaC
      };
      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          wb.utilityWeights = updatedWeights;
          return wb;
        },
        {
          agentName: "MCP Agent",
          toolName: "update_utility_strategy_weights",
          summary: `Updated utility strategy weights: R=${alphaR}, A=${alphaA}, V=${alphaV}, C=${alphaC}`
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                utilityWeights: updatedWeights
              },
              null,
              2
            )
          }
        ]
      };
    }
  );
  server.tool(
    "QualCount-patch_workbook_metadata",
    "Edits workbook-level dashboard header settings (title, description, targetBudgetInr, status).",
    {
      workbookId: z3.string().min(1).describe("The workbook ID"),
      title: z3.string().min(1).optional().describe("New title"),
      description: z3.string().optional().describe("New description"),
      targetBudgetInr: z3.number().positive().optional().describe("New target budget in INR"),
      status: z3.enum(["active", "draft", "archived"]).optional().describe("New workbook status")
    },
    async ({ workbookId, title, description, targetBudgetInr, status }) => {
      let updatedMetadata = null;
      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          if (title !== void 0) wb.title = title.trim();
          if (description !== void 0) wb.description = description.trim();
          if (targetBudgetInr !== void 0) wb.targetBudgetInr = targetBudgetInr;
          if (status !== void 0) wb.status = status;
          updatedMetadata = {
            workbookId: wb.workbookId,
            title: wb.title,
            description: wb.description,
            targetBudgetInr: wb.targetBudgetInr,
            status: wb.status
          };
          return wb;
        },
        {
          agentName: "MCP Agent",
          toolName: "patch_workbook_metadata",
          summary: `Updated metadata for workbook "${workbookId}"`
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                metadata: updatedMetadata
              },
              null,
              2
            )
          }
        ]
      };
    }
  );
}

// packages/mcp-server/src/tools/risk.ts
import { z as z4 } from "zod";
function registerRiskTools(server, storage) {
  server.tool(
    "QualCount-get_structural_risk_report",
    "Executes Layer 1 deterministic structural risk analysis across all 6 parameters (R1-R6) and returns thresholds, severity, and offending IDs.",
    {
      workbookId: z4.string().min(1).describe("The workbook ID")
    },
    async ({ workbookId }) => {
      const workbook = await storage.readWorkbook(workbookId);
      const entitiesFile = await storage.readEntities();
      const report = computeStructuralRiskReport(workbook, entitiesFile.entities);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(report, null, 2)
          }
        ]
      };
    }
  );
  server.tool(
    "QualCount-write_risk_assessment_box",
    "Populates or updates the persistent Layer 2 Risk Assessment Box displayed live on the Maximized Dashboard.",
    {
      workbookId: z4.string().min(1).describe("The workbook ID"),
      overallPosition: z4.string().min(1).describe("High-level qualitative synthesis of institutional risk posture"),
      parameterCommentary: z4.object({
        R1: z4.string().describe("Commentary on Single-Bridge Concentration (R1)"),
        R2: z4.string().describe("Commentary on Unowned Dependency Exposure (R2)"),
        R3: z4.string().describe("Commentary on Funding Concentration & Runway Gap (R3)"),
        R4: z4.string().describe("Commentary on Public Choice Apathy Risk (R4)"),
        R5: z4.string().describe("Commentary on Decision-Cost Drag & Stale Pipeline (R5)"),
        R6: z4.string().describe("Commentary on Rejection Cluster Signal (R6)")
      }).describe("Qualitative commentary for each of the 6 risk parameters"),
      failureScenarios: z4.array(
        z4.object({
          id: z4.string().optional(),
          title: z4.string().min(1).describe("Scenario title"),
          severity: z4.enum(["low", "moderate", "elevated", "critical"]).describe("Severity tier"),
          likelihood: z4.enum(["low", "medium", "high"]).describe("Likelihood level"),
          triggerCondition: z4.string().min(1).describe("Specific real-world trigger event"),
          affectedPlacementIds: z4.array(z4.string()).describe("IDs of affected placements"),
          mitigationAction: z4.string().min(1).describe("Concrete mitigation action doable in 7-14 days"),
          status: z4.enum(["open", "mitigating", "resolved"]).optional().describe("Scenario status")
        })
      ).describe("Concrete failure scenarios with triggers and actionable mitigations"),
      publicChoiceDiagnosis: z4.string().min(1).describe("Institutional analysis of partner incentive misalignments"),
      agentName: z4.string().optional().describe('Name of the auditing agent (e.g. "Claude Code via MCP")')
    },
    async ({
      workbookId,
      overallPosition,
      parameterCommentary,
      failureScenarios,
      publicChoiceDiagnosis,
      agentName
    }) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const auditor = agentName || "Agent via MCP";
      const scenarios = failureScenarios.map((s, idx) => ({
        id: s.id || `scen-${Date.now()}-${idx + 1}`,
        title: s.title,
        severity: s.severity,
        likelihood: s.likelihood,
        triggerCondition: s.triggerCondition,
        affectedPlacementIds: s.affectedPlacementIds,
        mitigationAction: s.mitigationAction,
        status: s.status || "open"
      }));
      const assessment = {
        assessedAt: now,
        assessedBy: auditor,
        overallPosition,
        parameterCommentary,
        failureScenarios: scenarios,
        publicChoiceDiagnosis
      };
      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          wb.riskAssessment = assessment;
          return wb;
        },
        {
          agentName: auditor,
          toolName: "write_risk_assessment_box",
          summary: `Published Layer 2 Risk Briefing (${scenarios.length} scenarios identified)`
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                riskAssessment: assessment
              },
              null,
              2
            )
          }
        ]
      };
    }
  );
}

// packages/mcp-server/src/tools/spreadsheet.ts
import * as fs3 from "fs";
import * as path3 from "path";
import { z as z5 } from "zod";

// src/io/spreadsheetExport.ts
var UTF8_BOM = "\uFEFF";
function escapeCsvField(val) {
  if (val === null || val === void 0) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
function exportCsvBundle(workbook, entities, utilityReport) {
  const targetBudget = workbook.targetBudgetInr ?? 1e6;
  const placementsList = Object.values(workbook.placements);
  const branchesList = Object.values(workbook.branches);
  const nodeHeaders = [
    "entity_id",
    "name",
    "category",
    "is_root_ngo",
    "outreach_attempts",
    "selective_incentives",
    "written_commitment",
    "brand_logo_shared",
    "staff_assigned",
    "network_mobilized",
    "yellow_in_degree",
    "social_proof_s",
    "utility_score_u",
    "utility_yield_per_touch",
    "global_notes"
  ];
  const nodeRows = [nodeHeaders.join(",")];
  for (const plc of placementsList) {
    const ent = entities[plc.entityId];
    const metrics = utilityReport.partners[plc.placementId];
    const signals = plc.coOwnershipSignals || {
      writtenCommitment: false,
      brandOrLogoShared: false,
      staffAssigned: false,
      networkMobilized: false
    };
    const yellowIn = branchesList.filter(
      (b) => b.targetPlacementId === plc.placementId && b.type === "yellow" && b.status === "tick"
    ).length;
    const row = [
      escapeCsvField(plc.entityId),
      escapeCsvField(ent?.name || "Unknown"),
      escapeCsvField(ent?.category || "other"),
      escapeCsvField(plc.isRootNgo ? "TRUE" : "FALSE"),
      escapeCsvField(plc.outreachAttempts ?? 1),
      escapeCsvField(plc.selectiveIncentives ? plc.selectiveIncentives.join("; ") : ""),
      escapeCsvField(signals.writtenCommitment ? "TRUE" : "FALSE"),
      escapeCsvField(signals.brandOrLogoShared ? "TRUE" : "FALSE"),
      escapeCsvField(signals.staffAssigned ? "TRUE" : "FALSE"),
      escapeCsvField(signals.networkMobilized ? "TRUE" : "FALSE"),
      escapeCsvField(yellowIn),
      escapeCsvField(metrics ? metrics.socialProofS.toFixed(2) : "0.00"),
      escapeCsvField(metrics ? metrics.utilityScoreU.toFixed(1) : plc.isRootNgo ? "100.0" : "0.0"),
      escapeCsvField(metrics ? metrics.utilityYieldEta.toFixed(1) : plc.isRootNgo ? "100.0" : "0.0"),
      escapeCsvField(ent?.globalNotes || "")
    ];
    nodeRows.push(row.join(","));
  }
  const branchHeaders = [
    "branch_id",
    "source_org",
    "target_org",
    "branch_type",
    "status",
    "funding_pct",
    "funding_inr",
    "in_kind_inr",
    "note",
    "created_at",
    "updated_at"
  ];
  const branchRows = [branchHeaders.join(",")];
  for (const br of branchesList) {
    const srcPlc = workbook.placements[br.sourcePlacementId];
    const tgtPlc = workbook.placements[br.targetPlacementId];
    const srcName = (srcPlc ? entities[srcPlc.entityId]?.name : br.sourcePlacementId) || "Unknown";
    const tgtName = (tgtPlc ? entities[tgtPlc.entityId]?.name : br.targetPlacementId) || "Unknown";
    const fundingInr = br.valuePct ? Math.round(br.valuePct / 100 * targetBudget) : "";
    const row = [
      escapeCsvField(br.branchId),
      escapeCsvField(srcName),
      escapeCsvField(tgtName),
      escapeCsvField(br.type),
      escapeCsvField(br.status),
      escapeCsvField(br.valuePct !== void 0 ? br.valuePct : ""),
      escapeCsvField(fundingInr),
      escapeCsvField(br.inKindValueInr !== void 0 ? br.inKindValueInr : ""),
      escapeCsvField(br.note || ""),
      escapeCsvField(br.createdAt || ""),
      escapeCsvField(br.updatedAt || "")
    ];
    branchRows.push(row.join(","));
  }
  return {
    nodesCsv: UTF8_BOM + nodeRows.join("\r\n"),
    branchesCsv: UTF8_BOM + branchRows.join("\r\n")
  };
}
function escapeXml(str) {
  if (str === null || str === void 0) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
async function exportExcelWorkbook(workbook, entities, utilityReport, riskReport) {
  const targetBudget = workbook.targetBudgetInr ?? 1e6;
  const placementsList = Object.values(workbook.placements);
  const branchesList = Object.values(workbook.branches);
  const greenBranches = branchesList.filter((b) => b.type === "green");
  const securedPct = greenBranches.filter((b) => b.status === "tick").reduce((sum, b) => sum + (b.valuePct || 0), 0);
  const securedInr = Math.round(securedPct / 100 * targetBudget);
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
   ${placementsList.map((plc) => {
    const ent = entities[plc.entityId];
    const metrics = utilityReport.partners[plc.placementId];
    return `
   <Row>
    <Cell><Data ss:Type="String">${escapeXml(ent?.name || "Unknown")}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(ent?.category || "other")}</Data></Cell>
    <Cell><Data ss:Type="Number">${plc.outreachAttempts ?? 1}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(plc.selectiveIncentives?.join("; ") || "None")}</Data></Cell>
    <Cell><Data ss:Type="Number">${metrics?.socialProofS ?? 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${metrics?.directCommitmentR ?? (plc.isRootNgo ? 1 : 0)}</Data></Cell>
    <Cell><Data ss:Type="Number">${metrics?.amplificationA ?? 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${metrics?.ownedConversionV ?? 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${metrics?.multiThreadReinforcementC ?? 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${metrics?.utilityScoreU ?? (plc.isRootNgo ? 100 : 0)}</Data></Cell>
    <Cell><Data ss:Type="Number">${metrics?.utilityYieldEta ?? (plc.isRootNgo ? 100 : 0)}</Data></Cell>
   </Row>`;
  }).join("")}
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
   ${branchesList.map((br) => {
    const srcPlc = workbook.placements[br.sourcePlacementId];
    const tgtPlc = workbook.placements[br.targetPlacementId];
    const srcName = srcPlc ? entities[srcPlc.entityId]?.name : br.sourcePlacementId;
    const tgtName = tgtPlc ? entities[tgtPlc.entityId]?.name : br.targetPlacementId;
    return `
   <Row>
    <Cell><Data ss:Type="String">${escapeXml(br.branchId)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(srcName || "Unknown")}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(tgtName || "Unknown")}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(br.type)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(br.status)}</Data></Cell>
    <Cell><Data ss:Type="Number">${br.valuePct ?? 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${br.inKindValueInr ?? 0}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(br.note || "")}</Data></Cell>
   </Row>`;
  }).join("")}
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
   ${Object.values(riskReport.parameters).map(
    (p) => `
   <Row>
    <Cell><Data ss:Type="String">${escapeXml(p.id)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.name)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.scoreFormatted)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.severity.toUpperCase())}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.plainCommentary)}</Data></Cell>
   </Row>`
  ).join("")}
  </Table>
 </Worksheet>
</Workbook>`;
  return new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
}

// src/io/spreadsheetImport.ts
async function commitImportedRows(rows, activeWorkbookId, state) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const entities = { ...state.entities };
  const placements = { ...state.placements };
  const branches = { ...state.branches };
  const entityNameToId = {};
  for (const ent of Object.values(entities)) {
    entityNameToId[ent.name.toLowerCase().trim()] = ent.entityId;
  }
  const getOrCreateEntityId = (name, category = "other") => {
    const key = name.toLowerCase().trim();
    if (entityNameToId[key]) {
      return entityNameToId[key];
    }
    const newId = `ent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    entities[newId] = {
      entityId: newId,
      name: name.trim(),
      category,
      globalNotes: "Imported from spreadsheet",
      createdAt: now,
      updatedAt: now
    };
    entityNameToId[key] = newId;
    return newId;
  };
  const entityIdToPlacementId = {};
  for (const plc of Object.values(placements)) {
    if (!plc.workbookId || plc.workbookId === activeWorkbookId) {
      entityIdToPlacementId[plc.entityId] = plc.placementId;
    }
  }
  const getOrCreatePlacementId = (entityId, isRoot = false, row) => {
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
        networkMobilized: false
      }
    };
    entityIdToPlacementId[entityId] = newPlcId;
    return newPlcId;
  };
  let rootPlacement = Object.values(placements).find((p) => p.isRootNgo);
  for (const row of rows) {
    if (row.sourceOrg.toLowerCase() === row.targetOrg.toLowerCase()) continue;
    const isSourceRoot = !rootPlacement && row.sourceOrg.toLowerCase().includes("ngo");
    const srcEntId = getOrCreateEntityId(row.sourceOrg, "ngo");
    const tgtEntId = getOrCreateEntityId(row.targetOrg, row.targetCategory || "other");
    const srcPlcId = getOrCreatePlacementId(srcEntId, isSourceRoot, row);
    const tgtPlcId = getOrCreatePlacementId(tgtEntId, false, row);
    if (isSourceRoot && !rootPlacement) {
      rootPlacement = placements[srcPlcId];
    }
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
      note: row.note || "",
      createdAt: now,
      updatedAt: now,
      resolvedAt: row.status !== "pending" ? now : void 0
    };
  }
  const intermediateState = {
    ...state,
    entities,
    placements,
    branches
  };
  try {
    const layoutCoords = await computeHierarchicalLayout(
      placements,
      branches,
      activeWorkbookId,
      "UP"
    );
    const updatedPlacements = {};
    for (const [id, plc] of Object.entries(placements)) {
      if (layoutCoords[id]) {
        updatedPlacements[id] = {
          ...plc,
          x: layoutCoords[id].x,
          y: layoutCoords[id].y
        };
      } else {
        updatedPlacements[id] = { ...plc };
      }
    }
    return {
      ...intermediateState,
      placements: updatedPlacements
    };
  } catch (err) {
    console.warn("[spreadsheetImport] ELK layout pass failed, returning unshifted state:", err);
    return intermediateState;
  }
}

// packages/mcp-server/src/tools/spreadsheet.ts
function registerSpreadsheetTools(server, storage) {
  server.tool(
    "QualCount-export_workbook_spreadsheet",
    "Runs the native deterministic spreadsheet exporter and writes CSV files or a 4-Tab Excel Workbook directly to outputPath.",
    {
      workbookId: z5.string().min(1).describe("The workbook ID to export"),
      format: z5.enum(["csv", "xlsx"]).describe("Export format: csv or xlsx"),
      outputPath: z5.string().min(1).describe("Absolute or relative output file or directory path")
    },
    async ({ workbookId, format, outputPath }) => {
      const workbook = await storage.readWorkbook(workbookId);
      const entitiesFile = await storage.readEntities();
      const utilityReport = computePublicChoiceUtilityReport(workbook, entitiesFile.entities);
      const riskReport = computeStructuralRiskReport(workbook, entitiesFile.entities);
      const resolvedPath = path3.resolve(process.cwd(), outputPath);
      const dir = path3.dirname(resolvedPath);
      await fs3.promises.mkdir(dir, { recursive: true });
      let bytesWritten = 0;
      if (format === "csv") {
        const { nodesCsv, branchesCsv } = exportCsvBundle(workbook, entitiesFile.entities, utilityReport);
        if (resolvedPath.toLowerCase().endsWith(".csv")) {
          const basePath = resolvedPath.slice(0, -4);
          const nodesPath = `${basePath}_nodes.csv`;
          const branchesPath = `${basePath}_branches.csv`;
          await fs3.promises.writeFile(nodesPath, nodesCsv, "utf-8");
          await fs3.promises.writeFile(branchesPath, branchesCsv, "utf-8");
          await fs3.promises.writeFile(resolvedPath, `${nodesCsv}

${branchesCsv}`, "utf-8");
          bytesWritten = Buffer.byteLength(nodesCsv, "utf-8") + Buffer.byteLength(branchesCsv, "utf-8");
        } else {
          await fs3.promises.mkdir(resolvedPath, { recursive: true });
          const nodesPath = path3.join(resolvedPath, "nodes.csv");
          const branchesPath = path3.join(resolvedPath, "branches.csv");
          await fs3.promises.writeFile(nodesPath, nodesCsv, "utf-8");
          await fs3.promises.writeFile(branchesPath, branchesCsv, "utf-8");
          bytesWritten = Buffer.byteLength(nodesCsv, "utf-8") + Buffer.byteLength(branchesCsv, "utf-8");
        }
      } else {
        let xlsxFilePath = resolvedPath;
        if (fs3.existsSync(resolvedPath) && fs3.statSync(resolvedPath).isDirectory()) {
          xlsxFilePath = path3.join(resolvedPath, `${workbook.title || workbookId}.xlsx`);
        } else if (!xlsxFilePath.toLowerCase().endsWith(".xlsx")) {
          xlsxFilePath = `${xlsxFilePath}.xlsx`;
        }
        const blob = await exportExcelWorkbook(workbook, entitiesFile.entities, utilityReport, riskReport);
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs3.promises.writeFile(xlsxFilePath, buffer);
        bytesWritten = buffer.length;
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                format,
                outputPath: format === "xlsx" && !resolvedPath.toLowerCase().endsWith(".xlsx") ? `${resolvedPath}.xlsx` : resolvedPath,
                bytesWritten
              },
              null,
              2
            )
          }
        ]
      };
    }
  );
  server.tool(
    "QualCount-batch_import_workflow_rows",
    "Atomic batch ingestion tool: deduplicates entities, creates placements & branches, runs bottom-to-top layout, and returns summary.",
    {
      workbookId: z5.string().min(1).describe("The workbook ID to import rows into"),
      rows: z5.array(
        z5.object({
          sourceOrg: z5.string().min(1).describe("Source organization name"),
          targetOrg: z5.string().min(1).describe("Target organization name"),
          targetCategory: z5.enum(["ngo", "csr", "government", "institution", "community", "other"]).optional().describe("Target organization category"),
          branchType: z5.enum(["green", "white", "yellow"]).describe("Branch type"),
          branchStatus: z5.enum(["pending", "tick", "cross"]).describe("Branch status"),
          valuePct: z5.number().optional().describe("Funding percentage (green only)"),
          fundingPct: z5.number().optional().describe("Alias for valuePct"),
          inKindValueInr: z5.number().optional().describe("In-kind INR value (white only)"),
          inKindInr: z5.number().optional().describe("Alias for inKindValueInr"),
          note: z5.string().optional().describe("Outreach or relationship notes"),
          outreachAttempts: z5.number().int().optional().describe("Outreach touches"),
          selectiveIncentives: z5.array(z5.string()).optional().describe("Selective incentives tags")
        })
      ).describe("Array of workflow relationship rows to import"),
      runTidyUpAfter: z5.boolean().optional().describe("Whether to run bottom-to-top hierarchical layout (default true)")
    },
    async ({ workbookId, rows, runTidyUpAfter = true }) => {
      const workbook = await storage.readWorkbook(workbookId);
      const entitiesFile = await storage.readEntities();
      const importRows = rows.map((r) => ({
        sourceOrg: r.sourceOrg,
        targetOrg: r.targetOrg,
        targetCategory: r.targetCategory,
        branchType: r.branchType,
        status: r.branchStatus || "pending",
        fundingPct: r.valuePct ?? r.fundingPct,
        inKindInr: r.inKindValueInr ?? r.inKindInr,
        note: r.note,
        selectiveIncentives: r.selectiveIncentives,
        outreachAttempts: r.outreachAttempts
      }));
      const wsState = {
        schemaVersion: 2,
        workspaceId: "current",
        workspaceName: "current",
        activeWorkbookId: workbookId,
        workbooks: {
          [workbookId]: {
            workbookId,
            title: workbook.title,
            description: workbook.description,
            targetBudgetInr: workbook.targetBudgetInr,
            status: workbook.status,
            createdAt: workbook.createdAt,
            updatedAt: workbook.updatedAt
          }
        },
        workbookLinks: {},
        placements: { ...workbook.placements },
        branches: { ...workbook.branches },
        entities: { ...entitiesFile.entities }
      };
      const committedState = await commitImportedRows(importRows, workbookId, wsState);
      if (runTidyUpAfter === false) {
      } else {
        const layoutCoords = await computeHierarchicalLayout(
          committedState.placements,
          committedState.branches,
          workbookId,
          "UP"
        );
        for (const [id, plc] of Object.entries(committedState.placements)) {
          if (layoutCoords[id]) {
            plc.x = layoutCoords[id].x;
            plc.y = layoutCoords[id].y;
          }
        }
      }
      entitiesFile.entities = committedState.entities;
      entitiesFile.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      entitiesFile.revision = (entitiesFile.revision || 1) + 1;
      await storage.writeEntities(entitiesFile);
      let finalPlacementsCount = 0;
      let finalBranchesCount = 0;
      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          wb.placements = committedState.placements;
          wb.branches = committedState.branches;
          finalPlacementsCount = Object.keys(wb.placements).length;
          finalBranchesCount = Object.keys(wb.branches).length;
          return wb;
        },
        {
          agentName: "MCP Agent",
          toolName: "batch_import_workflow_rows",
          summary: `Batch imported ${rows.length} rows (${finalPlacementsCount} nodes, ${finalBranchesCount} branches)`
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                rowsImported: rows.length,
                totalPlacements: finalPlacementsCount,
                totalBranches: finalBranchesCount,
                tidyUpApplied: runTidyUpAfter
              },
              null,
              2
            )
          }
        ]
      };
    }
  );
}

// packages/mcp-server/src/resources.ts
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
function registerResources(server, storage) {
  server.resource(
    "Workspace Overview",
    "partnership://workspace/overview",
    { mimeType: "application/json", description: "Active workspace manifest and list of workbooks" },
    async (uri) => {
      const manifest = await storage.readManifest();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(manifest, null, 2)
          }
        ]
      };
    }
  );
  server.resource(
    "Workspace Entities",
    "partnership://workspace/entities",
    { mimeType: "application/json", description: "Full master entities.json database" },
    async (uri) => {
      const entitiesFile = await storage.readEntities();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(entitiesFile, null, 2)
          }
        ]
      };
    }
  );
  server.resource(
    "Workbook Graph",
    new ResourceTemplate("partnership://workbook/{id}/graph", { list: void 0 }),
    { mimeType: "application/json", description: "Full workbook JSON graph data (placements and branches)" },
    async (uri, { id }) => {
      const workbookId = String(id);
      const workbook = await storage.readWorkbook(workbookId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(workbook, null, 2)
          }
        ]
      };
    }
  );
  server.resource(
    "Workbook Metrics",
    new ResourceTemplate("partnership://workbook/{id}/metrics", { list: void 0 }),
    { mimeType: "application/json", description: "Live Funding, Public Choice Utility, and Structural Risk metrics" },
    async (uri, { id }) => {
      const workbookId = String(id);
      const workbook = await storage.readWorkbook(workbookId);
      const entitiesFile = await storage.readEntities();
      let fundingPct = 0;
      let securedInr = 0;
      const branches = Object.values(workbook.branches || {});
      for (const branch of branches) {
        if (branch.type === "green" && branch.status === "tick") {
          const pct = branch.valuePct || 0;
          fundingPct += pct;
          securedInr += Math.round(pct / 100 * workbook.targetBudgetInr);
        }
      }
      const utilityReport = computePublicChoiceUtilityReport(workbook, entitiesFile.entities);
      const structuralRiskReport = computeStructuralRiskReport(workbook, entitiesFile.entities);
      const metrics = {
        workbookId,
        funding: {
          targetBudgetInr: workbook.targetBudgetInr,
          fundingPct: Number(fundingPct.toFixed(1)),
          securedInr,
          unfundedGapInr: Math.max(0, workbook.targetBudgetInr - securedInr)
        },
        utility: utilityReport,
        risk: structuralRiskReport
      };
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(metrics, null, 2)
          }
        ]
      };
    }
  );
}

// packages/mcp-server/src/server.ts
function createPartnershipMcpServer(storage, serverInfo = { name: "QualCount-partnership-ledger-mcp", version: "2.0.0" }) {
  const server = new McpServer(serverInfo);
  registerDiscoveryTools(server, storage);
  registerMutationTools(server, storage);
  registerUtilityTools(server, storage);
  registerRiskTools(server, storage);
  registerSpreadsheetTools(server, storage);
  registerResources(server, storage);
  return server;
}

// packages/mcp-server/src/index.ts
async function runCli() {
  const workspacePath = resolveWorkspacePath();
  const storage = new McpWorkspaceStorage(workspacePath);
  await storage.ensureWorkspaceInitialized();
  const server = createPartnershipMcpServer(storage);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[QualCount MCP] Partnership Ledger Server running on stdio for workspace: ${workspacePath}`);
}
var isMain = process.argv[1] && (process.argv[1].endsWith("index.js") || process.argv[1].endsWith("index.ts") || process.argv[1].includes("partnership-ledger-mcp") || process.argv[1].includes("QualCount"));
if (isMain) {
  runCli().catch((err) => {
    console.error("[QualCount MCP] Fatal server error:", err);
    process.exit(1);
  });
}
export {
  McpWorkspaceStorage,
  createPartnershipMcpServer,
  resolveWorkspacePath
};
//# sourceMappingURL=index.js.map

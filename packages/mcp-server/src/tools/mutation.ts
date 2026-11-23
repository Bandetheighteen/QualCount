import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpWorkspaceStorage } from '../storageAdapter';
import { computeHierarchicalLayout } from '../../../../src/engine/layout';
import type {
  WorkbookFile,
  Placement,
  Branch,
  Entity,
  SelectiveIncentiveTag,
} from '../types';

export function registerMutationTools(server: McpServer, storage: McpWorkspaceStorage): void {
  // 4. QualCount-create_workbook
  server.tool(
    'QualCount-create_workbook',
    'Creates a new workbook JSON file with Root NGO anchored at Tier 0 (x: 400, y: 600).',
    {
      title: z.string().min(1).describe('Title of the new workbook'),
      description: z.string().optional().describe('Description of the project/campaign'),
      targetBudgetInr: z.number().positive().optional().describe('Target funding budget in INR (default 1,000,000)'),
      rootNgoName: z.string().optional().describe('Name of the Host/Root NGO (default "Lead NGO")'),
    },
    async ({ title, description, targetBudgetInr, rootNgoName }) => {
      const now = new Date().toISOString();
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      let workbookId = `wb-${slug || Date.now()}`;
      const existingWbPath = path.join(storage.getWorkspacePath(), 'workbooks', `wb_${workbookId}.json`);
      if (fs.existsSync(existingWbPath)) {
        workbookId = `wb-${slug || 'project'}-${Date.now().toString(36).slice(2, 6)}`;
      }
      const ngoName = (rootNgoName && rootNgoName.trim()) || 'Lead NGO';

      // 1. Ensure Root NGO entity exists in entities.json
      const entitiesFile = await storage.readEntities();
      let rootEntityId = Object.keys(entitiesFile.entities).find(
        (id) => entitiesFile.entities[id].name.toLowerCase() === ngoName.toLowerCase()
      );

      if (!rootEntityId) {
        rootEntityId = `ent-${Date.now()}-root`;
        entitiesFile.entities[rootEntityId] = {
          entityId: rootEntityId,
          name: ngoName,
          category: 'ngo',
          globalNotes: 'Root NGO entity created via MCP',
          createdAt: now,
          updatedAt: now,
        };
        await storage.writeEntities(entitiesFile);
      }

      // 2. Create Root NGO placement anchored at Tier 0 (x: 400, y: 600)
      const rootPlacementId = `plc-${Date.now()}-root`;
      const rootPlacement: Placement = {
        placementId: rootPlacementId,
        workbookId: workbookId,
        entityId: rootEntityId,
        isRootNgo: true,
        x: 400,
        y: 600,
        width: 190,
        height: 76,
        selectiveIncentives: ['institutional_mandate'],
        coOwnershipSignals: {
          writtenCommitment: true,
          brandOrLogoShared: true,
          staffAssigned: true,
          networkMobilized: true,
        },
        outreachAttempts: 1,
      };

      // 3. Construct WorkbookFile
      const newWorkbook: WorkbookFile = {
        schemaVersion: 2,
        workbookId: workbookId,
        revision: 1,
        title: title.trim(),
        description: (description || '').trim(),
        targetBudgetInr: targetBudgetInr || 1000000,
        status: 'active',
        utilityWeights: {
          presetName: 'balanced',
          alphaR: 0.3,
          alphaA: 0.35,
          alphaV: 0.2,
          alphaC: 0.15,
        },
        placements: {
          [rootPlacementId]: rootPlacement,
        },
        branches: {},
        lastAgentMutation: {
          agentName: 'MCP Agent',
          toolName: 'create_workbook',
          summary: `Created workbook "${title}" with Tier 0 root "${ngoName}"`,
          timestamp: now,
        },
        createdAt: now,
        updatedAt: now,
      };

      await storage.writeWorkbookDirect(newWorkbook);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                workbookId,
                title: newWorkbook.title,
                targetBudgetInr: newWorkbook.targetBudgetInr,
                rootPlacementId,
                rootEntityId,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 5. QualCount-add_or_import_entity
  server.tool(
    'QualCount-add_or_import_entity',
    'Deduplicates against entities.json, inserts a non-overlapping Placement, and optionally pulls confirmed yellow leads as dashed pending branches.',
    {
      workbookId: z.string().min(1).describe('The target workbook ID'),
      name: z.string().min(1).describe('Partner organization name'),
      category: z.enum(['ngo', 'csr', 'government', 'institution', 'community', 'other']).describe('Organization category'),
      globalNotes: z.string().optional().describe('Global institutional notes'),
      selectiveIncentives: z
        .array(
          z.enum([
            'csr_compliance',
            'brand_visibility',
            'institutional_mandate',
            'policy_influence',
            'network_prestige',
            'asset_activation',
            'community_legitimacy',
          ])
        )
        .optional()
        .describe('Selective incentives aligned with partner'),
      outreachAttempts: z.number().int().min(1).optional().describe('Decision cost touches (default 1)'),
      importPendingYellowFromWorkbookId: z
        .string()
        .optional()
        .describe('Optional sibling workbook to inspect for proven referral bridges'),
    },
    async ({
      workbookId,
      name,
      category,
      globalNotes,
      selectiveIncentives,
      outreachAttempts,
      importPendingYellowFromWorkbookId,
    }) => {
      const now = new Date().toISOString();
      const normName = name.trim().toLowerCase();

      // 1. Deduplicate against master entities
      const entitiesFile = await storage.readEntities();
      let entityId = Object.keys(entitiesFile.entities).find(
        (id) => entitiesFile.entities[id].name.trim().toLowerCase() === normName
      );
      let isReusedEntity = false;

      if (entityId) {
        isReusedEntity = true;
        // Optionally update global notes if provided
        if (globalNotes && !entitiesFile.entities[entityId].globalNotes) {
          entitiesFile.entities[entityId].globalNotes = globalNotes;
          entitiesFile.entities[entityId].updatedAt = now;
          await storage.writeEntities(entitiesFile);
        }
      } else {
        entityId = `ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newEntity: Entity = {
          entityId,
          name: name.trim(),
          category,
          globalNotes: globalNotes || '',
          createdAt: now,
          updatedAt: now,
        };
        entitiesFile.entities[entityId] = newEntity;
        await storage.writeEntities(entitiesFile);
      }

      // 2. Insert placement into target workbook with snapshot
      let createdPlacementId = '';
      let importedBridgesCount = 0;

      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          // Check if entity is already placed in this workbook
          const existingPlacement = Object.values(wb.placements || {}).find((p) => p.entityId === entityId);
          if (existingPlacement) {
            createdPlacementId = existingPlacement.placementId;
            return wb;
          }

          createdPlacementId = `plc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const placementCount = Object.keys(wb.placements || {}).length;

          // Non-overlapping initial coordinate
          const x = 200 + (placementCount % 5) * 220;
          const y = 350 - Math.floor(placementCount / 5) * 120;

          const newPlacement: Placement = {
            placementId: createdPlacementId,
            workbookId,
            entityId,
            isRootNgo: false,
            x,
            y,
            width: 190,
            height: 76,
            selectiveIncentives: (selectiveIncentives as SelectiveIncentiveTag[]) || [],
            coOwnershipSignals: {
              writtenCommitment: false,
              brandOrLogoShared: false,
              staffAssigned: false,
              networkMobilized: false,
            },
            outreachAttempts: outreachAttempts || 1,
          };

          wb.placements[createdPlacementId] = newPlacement;

          // 3. Optional: Import yellow referral bridges from sibling workbook
          if (importPendingYellowFromWorkbookId) {
            try {
              const srcWb = await storage.readWorkbook(importPendingYellowFromWorkbookId);
              // Find source workbook placement for this entity
              const srcPlc = Object.values(srcWb.placements || {}).find((p) => p.entityId === entityId);
              if (srcPlc) {
                // Find confirmed yellow branches originating from or pointing to this placement
                for (const branch of Object.values(srcWb.branches || {})) {
                  if (branch.type === 'yellow' && branch.status === 'tick') {
                    // Case A: This partner introduced another target (outbound)
                    if (branch.sourcePlacementId === srcPlc.placementId) {
                      const tgtSrcPlc = srcWb.placements[branch.targetPlacementId];
                      if (tgtSrcPlc) {
                        const localTgtPlc = Object.values(wb.placements).find(
                          (p) => p.entityId === tgtSrcPlc.entityId
                        );
                        if (localTgtPlc) {
                          const alreadyExists = Object.values(wb.branches).some(
                            (b) =>
                              b.type === 'yellow' &&
                              b.sourcePlacementId === createdPlacementId &&
                              b.targetPlacementId === localTgtPlc.placementId
                          );
                          if (!alreadyExists) {
                            const newBrId = `br-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                            wb.branches[newBrId] = {
                              branchId: newBrId,
                              workbookId,
                              sourcePlacementId: createdPlacementId,
                              targetPlacementId: localTgtPlc.placementId,
                              type: 'yellow',
                              status: 'pending', // CRITICAL: Always pending dashed, no false confirmations!
                              note: `Imported referral bridge from ${srcWb.title}`,
                              createdAt: now,
                              updatedAt: now,
                            };
                            importedBridgesCount++;
                          }
                        }
                      }
                    }

                    // Case B: Another partner introduced this partner (inbound)
                    if (branch.targetPlacementId === srcPlc.placementId) {
                      const srcSrcPlc = srcWb.placements[branch.sourcePlacementId];
                      if (srcSrcPlc) {
                        const localSrcPlc = Object.values(wb.placements).find(
                          (p) => p.entityId === srcSrcPlc.entityId
                        );
                        if (localSrcPlc) {
                          const alreadyExists = Object.values(wb.branches).some(
                            (b) =>
                              b.type === 'yellow' &&
                              b.sourcePlacementId === localSrcPlc.placementId &&
                              b.targetPlacementId === createdPlacementId
                          );
                          if (!alreadyExists) {
                            const newBrId = `br-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                            wb.branches[newBrId] = {
                              branchId: newBrId,
                              workbookId,
                              sourcePlacementId: localSrcPlc.placementId,
                              targetPlacementId: createdPlacementId,
                              type: 'yellow',
                              status: 'pending', // CRITICAL: Always pending dashed, no false confirmations!
                              note: `Imported referral bridge from ${srcWb.title}`,
                              createdAt: now,
                              updatedAt: now,
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
              // ignore sibling workbook read error
            }
          }

          return wb;
        },
        {
          agentName: 'MCP Agent',
          toolName: 'add_or_import_entity',
          summary: `Added partner "${name}" (${category})${isReusedEntity ? ' [reused entity]' : ''}`,
        }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                entityId,
                placementId: createdPlacementId,
                name: name.trim(),
                category,
                isReusedEntity,
                importedBridgesCount,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 6. QualCount-update_placement_attributes
  server.tool(
    'QualCount-update_placement_attributes',
    'Updates Public Choice attributes (selective incentives, co-ownership signals, outreach touches) without touching visual coordinates.',
    {
      workbookId: z.string().min(1).describe('The workbook ID'),
      placementId: z.string().min(1).describe('The placement ID to update'),
      selectiveIncentives: z
        .array(
          z.enum([
            'csr_compliance',
            'brand_visibility',
            'institutional_mandate',
            'policy_influence',
            'network_prestige',
            'asset_activation',
            'community_legitimacy',
          ])
        )
        .optional()
        .describe('Selective incentive tags'),
      coOwnershipSignals: z
        .object({
          writtenCommitment: z.boolean().optional(),
          brandOrLogoShared: z.boolean().optional(),
          staffAssigned: z.boolean().optional(),
          networkMobilized: z.boolean().optional(),
        })
        .optional()
        .describe('Ostrom co-ownership checklist signals'),
      outreachAttempts: z.number().int().min(1).optional().describe('Decision cost outreach touches'),
      globalNotes: z.string().optional().describe('Update master entity global notes'),
    },
    async ({ workbookId, placementId, selectiveIncentives, coOwnershipSignals, outreachAttempts, globalNotes }) => {
      let updatedPlacement: Placement | null = null;
      let entityIdToUpdate = '';

      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          const placement = wb.placements[placementId];
          if (!placement) {
            throw new Error(`Placement "${placementId}" not found in workbook "${workbookId}"`);
          }

          entityIdToUpdate = placement.entityId;

          if (selectiveIncentives !== undefined) {
            placement.selectiveIncentives = selectiveIncentives as SelectiveIncentiveTag[];
          }

          if (coOwnershipSignals !== undefined) {
            placement.coOwnershipSignals = {
              writtenCommitment:
                coOwnershipSignals.writtenCommitment ?? placement.coOwnershipSignals?.writtenCommitment ?? false,
              brandOrLogoShared:
                coOwnershipSignals.brandOrLogoShared ?? placement.coOwnershipSignals?.brandOrLogoShared ?? false,
              staffAssigned:
                coOwnershipSignals.staffAssigned ?? placement.coOwnershipSignals?.staffAssigned ?? false,
              networkMobilized:
                coOwnershipSignals.networkMobilized ?? placement.coOwnershipSignals?.networkMobilized ?? false,
            };
          }

          if (outreachAttempts !== undefined) {
            placement.outreachAttempts = outreachAttempts;
          }

          updatedPlacement = { ...placement };
          return wb;
        },
        {
          agentName: 'MCP Agent',
          toolName: 'update_placement_attributes',
          summary: `Updated Public Choice attributes for placement ${placementId}`,
        }
      );

      // Optionally update master entity global notes
      if (globalNotes !== undefined && entityIdToUpdate) {
        try {
          const entitiesFile = await storage.readEntities();
          if (entitiesFile.entities[entityIdToUpdate]) {
            entitiesFile.entities[entityIdToUpdate].globalNotes = globalNotes;
            entitiesFile.entities[entityIdToUpdate].updatedAt = new Date().toISOString();
            await storage.writeEntities(entitiesFile);
          }
        } catch {
          // ignore
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                placement: updatedPlacement,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 7. QualCount-create_branch
  server.tool(
    'QualCount-create_branch',
    'Creates a directed multiplex branch (green cash funding, white direct tie, or yellow referral bridge). Validates no self-loops.',
    {
      workbookId: z.string().min(1).describe('The workbook ID'),
      sourcePlacementId: z.string().min(1).describe('Source placement ID'),
      targetPlacementId: z.string().min(1).describe('Target placement ID'),
      type: z.enum(['green', 'white', 'yellow']).describe('Branch type: green (funding), white (direct), yellow (bridge)'),
      status: z.enum(['pending', 'tick', 'cross']).describe('Branch status: pending (dashed), tick (confirmed), cross (declined)'),
      valuePct: z.number().min(0).max(100).optional().describe('Green branch only: percentage of target budget'),
      inKindValueInr: z.number().min(0).optional().describe('White branch only: estimated market value of in-kind asset'),
      note: z.string().optional().describe('Contextual note or meeting record'),
    },
    async ({
      workbookId,
      sourcePlacementId,
      targetPlacementId,
      type,
      status,
      valuePct,
      inKindValueInr,
      note,
    }) => {
      if (sourcePlacementId === targetPlacementId) {
        throw new Error('Self-loops are forbidden: sourcePlacementId cannot equal targetPlacementId');
      }

      const now = new Date().toISOString();
      const branchId = `br-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      let createdBranch: Branch | null = null;

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

          // Enforce ownership separation rule:
          // Direct white working relationships and green funding must connect to or from Root NGO.
          // Third-party relationships between non-root partners must be yellow referral bridges.
          if ((type === 'white' || type === 'green') && !srcPlc.isRootNgo && !tgtPlc.isRootNgo) {
            throw new Error(
              `Ownership rule violation: Direct ${type} branches must connect to or from the Root NGO. Third-party relationships between external partners must be recorded as yellow referral bridges.`
            );
          }

          const branch: Branch = {
            branchId,
            workbookId,
            sourcePlacementId,
            targetPlacementId,
            type,
            status,
            valuePct: type === 'green' ? valuePct ?? 0 : undefined,
            inKindValueInr: type === 'white' ? inKindValueInr : undefined,
            note: note || '',
            createdAt: now,
            updatedAt: now,
            resolvedAt: status !== 'pending' ? now : undefined,
          };

          wb.branches[branchId] = branch;
          createdBranch = branch;
          return wb;
        },
        {
          agentName: 'MCP Agent',
          toolName: 'create_branch',
          summary: `Created ${type} (${status}) branch ${sourcePlacementId} -> ${targetPlacementId}`,
        }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                branch: createdBranch,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 8. QualCount-update_branch
  server.tool(
    'QualCount-update_branch',
    'Updates branch status (pending/tick/cross), type, values, or notes. Preserves declined memory by setting status to cross instead of deleting.',
    {
      workbookId: z.string().min(1).describe('The workbook ID'),
      branchId: z.string().min(1).describe('The branch ID to update'),
      status: z.enum(['pending', 'tick', 'cross']).optional().describe('New branch status'),
      type: z.enum(['green', 'white', 'yellow']).optional().describe('New branch type'),
      valuePct: z.number().min(0).max(100).optional().describe('Green branch percentage'),
      inKindValueInr: z.number().min(0).optional().describe('White branch in-kind value in INR'),
      note: z.string().optional().describe('Updated note'),
    },
    async ({ workbookId, branchId, status, type, valuePct, inKindValueInr, note }) => {
      const now = new Date().toISOString();
      let updatedBranch: Branch | null = null;

      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          const branch = wb.branches[branchId];
          if (!branch) {
            throw new Error(`Branch "${branchId}" not found in workbook "${workbookId}"`);
          }

          if (status !== undefined) {
            branch.status = status;
            if (status !== 'pending' && !branch.resolvedAt) {
              branch.resolvedAt = now;
            }
          }

          if (type !== undefined) {
            const srcPlc = wb.placements[branch.sourcePlacementId];
            const tgtPlc = wb.placements[branch.targetPlacementId];
            if ((type === 'white' || type === 'green') && srcPlc && tgtPlc && !srcPlc.isRootNgo && !tgtPlc.isRootNgo) {
              throw new Error(
                `Ownership rule violation: Direct ${type} branches must connect to or from the Root NGO. Third-party relationships between external partners must be recorded as yellow referral bridges.`
              );
            }
            branch.type = type;
          }

          if (valuePct !== undefined) {
            branch.valuePct = valuePct;
          }

          if (inKindValueInr !== undefined) {
            branch.inKindValueInr = inKindValueInr;
          }

          if (note !== undefined) {
            branch.note = note;
          }

          branch.updatedAt = now;
          updatedBranch = { ...branch };
          return wb;
        },
        {
          agentName: 'MCP Agent',
          toolName: 'update_branch',
          summary: `Updated branch ${branchId} (${status || 'fields'})`,
        }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                branch: updatedBranch,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 9. QualCount-delete_branch
  server.tool(
    'QualCount-delete_branch',
    'Deletes an erroneous branch. Agents should prefer update_branch with status: "cross" to preserve institutional memory of declines.',
    {
      workbookId: z.string().min(1).describe('The workbook ID'),
      branchId: z.string().min(1).describe('The branch ID to remove'),
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
          agentName: 'MCP Agent',
          toolName: 'delete_branch',
          summary: `Deleted branch ${branchId}`,
        }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                deletedBranchId: branchId,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 10. QualCount-run_tidy_up_layout
  server.tool(
    'QualCount-run_tidy_up_layout',
    'Executes pure elkjs bottom-to-top hierarchical layout (direction: "UP") and updates placement coordinates so the canvas opens cleanly.',
    {
      workbookId: z.string().min(1).describe('The workbook ID to layout'),
    },
    async ({ workbookId }) => {
      let placementsUpdated = 0;
      let layoutResult: Record<string, { x: number; y: number }> = {};

      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          layoutResult = await computeHierarchicalLayout(wb.placements, wb.branches, workbookId, 'UP');

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
          agentName: 'MCP Agent',
          toolName: 'run_tidy_up_layout',
          summary: `Applied bottom-to-top ELK layout (${placementsUpdated} placements repositioned)`,
        }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                placementsUpdated,
                coordinates: layoutResult,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}

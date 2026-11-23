import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpWorkspaceStorage } from '../storageAdapter';
import { computePublicChoiceUtilityReport } from '../../../../src/engine/utility';
import { computeStructuralRiskReport } from '../../../../src/engine/risk';
import { searchCrossWorkbookEntities } from '../../../../src/engine/entityIndex';
import type { WorkbookFile, EntitiesFile, Branch } from '../types';

export function registerDiscoveryTools(server: McpServer, storage: McpWorkspaceStorage): void {
  // 1. QualCount-list_workbooks()
  server.tool(
    'QualCount-list_workbooks',
    'Returns workspace metadata, source type, and all workbooks with summary KPIs (funding %, PUI, risk tier, node/edge counts).',
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

          // Funding % calculation from confirmed green branches
          let fundingPct = 0;
          const branches = Object.values(wb.branches || {}) as Branch[];
          for (const branch of branches) {
            if (branch.type === 'green' && branch.status === 'tick') {
              fundingPct += branch.valuePct || 0;
            }
          }

          // Compute PUI
          let pui = 0;
          try {
            const utilityRep = computePublicChoiceUtilityReport(wb, entitiesFile.entities);
            pui = utilityRep.pui;
          } catch {
            // fallback
          }

          // Compute Structural Risk Tier
          let riskTier = 'low';
          try {
            const riskRep = computeStructuralRiskReport(wb, entitiesFile.entities);
            riskTier = riskRep.aggregateTier;
          } catch {
            // fallback
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
            updatedAt: wb.updatedAt,
          });
        } catch (e: any) {
          workbooksSummary.push({
            id: wbId,
            title: ref.title,
            status: ref.status,
            error: e.message,
          });
        }
      }

      const result = {
        workspaceId: manifest.workspaceId,
        workspaceName: manifest.name,
        sourceType: manifest.sourceType || 'local',
        revision: manifest.revision,
        workbooksCount: workbooksSummary.length,
        workbooks: workbooksSummary,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // 2. QualCount-get_workbook_full({ workbookId })
  server.tool(
    'QualCount-get_workbook_full',
    'Returns full Workbook JSON resolved with Entity names, computed Public Choice utility report, and Layer 1 structural risk report.',
    {
      workbookId: z.string().describe('The ID of the workbook to retrieve'),
    },
    async ({ workbookId }) => {
      const workbook: WorkbookFile = await storage.readWorkbook(workbookId);
      const entitiesFile: EntitiesFile = await storage.readEntities();

      // Resolve entity names for placements
      const resolvedPlacements: Record<string, any> = {};
      for (const [plcId, plc] of Object.entries(workbook.placements || {})) {
        const entity = entitiesFile.entities[plc.entityId];
        resolvedPlacements[plcId] = {
          ...plc,
          entityName: entity ? entity.name : 'Unknown Entity',
          category: entity ? entity.category : 'other',
          globalNotes: entity ? entity.globalNotes : '',
        };
      }

      // Compute live reports
      const utilityReport = computePublicChoiceUtilityReport(workbook, entitiesFile.entities);
      const structuralRiskReport = computeStructuralRiskReport(workbook, entitiesFile.entities);

      const result = {
        workbook: {
          ...workbook,
          resolvedPlacements,
        },
        publicChoiceUtilityReport: utilityReport,
        structuralRiskReport: structuralRiskReport,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // 3. QualCount-search_entities({ query, includeCrossWorkspaceIndex? })
  server.tool(
    'QualCount-search_entities',
    'Fuzzy searches entities in entities.json (and optional cross-workspace index) to prevent duplicate organizations before creation.',
    {
      query: z.string().describe('Search query string (min 1 character for MCP, 3 for fuzzy UI)'),
      includeCrossWorkspaceIndex: z.boolean().optional().describe('Whether to query cross-workspace recent index'),
    },
    async ({ query, includeCrossWorkspaceIndex }) => {
      const entitiesFile = await storage.readEntities();

      if (!query || !query.trim()) {
        const all = Object.values(entitiesFile.entities).slice(0, 50);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  query: '',
                  count: all.length,
                  total: all.length,
                  matches: all,
                  localMatches: all,
                  crossMatches: [],
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const q = query.trim().toLowerCase();
      const localMatches = Object.values(entitiesFile.entities).filter((ent) => {
        return (
          ent.name.toLowerCase().includes(q) ||
          ent.category.toLowerCase().includes(q) ||
          (ent.globalNotes && ent.globalNotes.toLowerCase().includes(q))
        );
      });

      let crossMatches: any[] = [];
      if (includeCrossWorkspaceIndex) {
        try {
          const manifest = await storage.readManifest();
          const dummyWorkbooks: Record<string, any> = {};
          for (const wbId of Object.keys(manifest.workbooks || {})) {
            dummyWorkbooks[wbId] = { workbookId: wbId, title: manifest.workbooks[wbId].title };
          }
          const results = searchCrossWorkbookEntities(query, entitiesFile.entities, [], dummyWorkbooks);
          crossMatches = results;
        } catch {
          // ignore
        }
      }

      const totalCount = localMatches.length + crossMatches.length;
      const result = {
        query,
        count: totalCount,
        total: totalCount,
        matches: localMatches,
        localMatches,
        crossMatches,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}

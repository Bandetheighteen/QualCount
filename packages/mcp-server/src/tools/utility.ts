import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpWorkspaceStorage } from '../storageAdapter';
import { computePublicChoiceUtilityReport } from '../../../../src/engine/utility';
import type { UtilityStrategyWeights } from '../types';

export function registerUtilityTools(server: McpServer, storage: McpWorkspaceStorage): void {
  // 11. QualCount-get_public_choice_utility_report
  server.tool(
    'QualCount-get_public_choice_utility_report',
    'Returns exact Partnership Utility Index (PUI), Decision-Cost Efficiency, per-partner utility decomposition, and apathy warnings.',
    {
      workbookId: z.string().min(1).describe('The workbook ID'),
    },
    async ({ workbookId }) => {
      const workbook = await storage.readWorkbook(workbookId);
      const entitiesFile = await storage.readEntities();

      const report = computePublicChoiceUtilityReport(workbook, entitiesFile.entities);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    }
  );

  // 12. QualCount-update_utility_strategy_weights
  server.tool(
    'QualCount-update_utility_strategy_weights',
    'Updates Public Choice strategy weights (alphaR + alphaA + alphaV + alphaC = 1.00 ± 0.001).',
    {
      workbookId: z.string().min(1).describe('The workbook ID'),
      alphaR: z.number().min(0).max(1).describe('Weight for Direct Commitment & Co-Ownership (0 to 1)'),
      alphaA: z.number().min(0).max(1).describe('Weight for Ecosystem Brokerage & Amplification (0 to 1)'),
      alphaV: z.number().min(0).max(1).describe('Weight for Owned Relationship Conversion (0 to 1)'),
      alphaC: z.number().min(0).max(1).describe('Weight for Multi-Thread Reinforcement (0 to 1)'),
    },
    async ({ workbookId, alphaR, alphaA, alphaV, alphaC }) => {
      const sum = alphaR + alphaA + alphaV + alphaC;
      if (Math.abs(sum - 1.0) > 0.001) {
        throw new Error(
          `Weights must sum to 1.00 ± 0.001. Current sum: ${sum.toFixed(4)} (R=${alphaR}, A=${alphaA}, V=${alphaV}, C=${alphaC})`
        );
      }

      const updatedWeights: UtilityStrategyWeights = {
        presetName: 'custom',
        alphaR,
        alphaA,
        alphaV,
        alphaC,
      };

      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          wb.utilityWeights = updatedWeights;
          return wb;
        },
        {
          agentName: 'MCP Agent',
          toolName: 'update_utility_strategy_weights',
          summary: `Updated utility strategy weights: R=${alphaR}, A=${alphaA}, V=${alphaV}, C=${alphaC}`,
        }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                utilityWeights: updatedWeights,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 13. QualCount-patch_workbook_metadata
  server.tool(
    'QualCount-patch_workbook_metadata',
    'Edits workbook-level dashboard header settings (title, description, targetBudgetInr, status).',
    {
      workbookId: z.string().min(1).describe('The workbook ID'),
      title: z.string().min(1).optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      targetBudgetInr: z.number().positive().optional().describe('New target budget in INR'),
      status: z.enum(['active', 'draft', 'archived']).optional().describe('New workbook status'),
    },
    async ({ workbookId, title, description, targetBudgetInr, status }) => {
      let updatedMetadata: any = null;

      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          if (title !== undefined) wb.title = title.trim();
          if (description !== undefined) wb.description = description.trim();
          if (targetBudgetInr !== undefined) wb.targetBudgetInr = targetBudgetInr;
          if (status !== undefined) wb.status = status;

          updatedMetadata = {
            workbookId: wb.workbookId,
            title: wb.title,
            description: wb.description,
            targetBudgetInr: wb.targetBudgetInr,
            status: wb.status,
          };

          return wb;
        },
        {
          agentName: 'MCP Agent',
          toolName: 'patch_workbook_metadata',
          summary: `Updated metadata for workbook "${workbookId}"`,
        }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                metadata: updatedMetadata,
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

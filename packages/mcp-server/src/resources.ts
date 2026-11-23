import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpWorkspaceStorage } from './storageAdapter';
import { computePublicChoiceUtilityReport } from '../../../src/engine/utility';
import { computeStructuralRiskReport } from '../../../src/engine/risk';
import type { Branch } from './types';

export function registerResources(server: McpServer, storage: McpWorkspaceStorage): void {
  // 1. partnership://workspace/overview
  server.resource(
    'Workspace Overview',
    'partnership://workspace/overview',
    { mimeType: 'application/json', description: 'Active workspace manifest and list of workbooks' },
    async (uri) => {
      const manifest = await storage.readManifest();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(manifest, null, 2),
          },
        ],
      };
    }
  );

  // 2. partnership://workspace/entities
  server.resource(
    'Workspace Entities',
    'partnership://workspace/entities',
    { mimeType: 'application/json', description: 'Full master entities.json database' },
    async (uri) => {
      const entitiesFile = await storage.readEntities();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(entitiesFile, null, 2),
          },
        ],
      };
    }
  );

  // 3. partnership://workbook/{id}/graph
  server.resource(
    'Workbook Graph',
    new ResourceTemplate('partnership://workbook/{id}/graph', { list: undefined }),
    { mimeType: 'application/json', description: 'Full workbook JSON graph data (placements and branches)' },
    async (uri, { id }) => {
      const workbookId = String(id);
      const workbook = await storage.readWorkbook(workbookId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(workbook, null, 2),
          },
        ],
      };
    }
  );

  // 4. partnership://workbook/{id}/metrics
  server.resource(
    'Workbook Metrics',
    new ResourceTemplate('partnership://workbook/{id}/metrics', { list: undefined }),
    { mimeType: 'application/json', description: 'Live Funding, Public Choice Utility, and Structural Risk metrics' },
    async (uri, { id }) => {
      const workbookId = String(id);
      const workbook = await storage.readWorkbook(workbookId);
      const entitiesFile = await storage.readEntities();

      // Funding calculation
      let fundingPct = 0;
      let securedInr = 0;
      const branches = Object.values(workbook.branches || {}) as Branch[];
      for (const branch of branches) {
        if (branch.type === 'green' && branch.status === 'tick') {
          const pct = branch.valuePct || 0;
          fundingPct += pct;
          securedInr += Math.round((pct / 100) * workbook.targetBudgetInr);
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
          unfundedGapInr: Math.max(0, workbook.targetBudgetInr - securedInr),
        },
        utility: utilityReport,
        risk: structuralRiskReport,
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(metrics, null, 2),
          },
        ],
      };
    }
  );
}

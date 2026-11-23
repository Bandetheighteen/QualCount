import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpWorkspaceStorage } from '../storageAdapter';
import { exportCsvBundle, exportExcelWorkbook } from '../../../../src/io/spreadsheetExport';
import { commitImportedRows, type ImportRow } from '../../../../src/io/spreadsheetImport';
import { computePublicChoiceUtilityReport } from '../../../../src/engine/utility';
import { computeStructuralRiskReport } from '../../../../src/engine/risk';
import { computeHierarchicalLayout } from '../../../../src/engine/layout';
import type { WorkspaceState, EntityCategory, BranchType, BranchStatus, SelectiveIncentiveTag } from '../types';

export function registerSpreadsheetTools(server: McpServer, storage: McpWorkspaceStorage): void {
  // 16. QualCount-export_workbook_spreadsheet
  server.tool(
    'QualCount-export_workbook_spreadsheet',
    'Runs the native deterministic spreadsheet exporter and writes CSV files or a 4-Tab Excel Workbook directly to outputPath.',
    {
      workbookId: z.string().min(1).describe('The workbook ID to export'),
      format: z.enum(['csv', 'xlsx']).describe('Export format: csv or xlsx'),
      outputPath: z.string().min(1).describe('Absolute or relative output file or directory path'),
    },
    async ({ workbookId, format, outputPath }) => {
      const workbook = await storage.readWorkbook(workbookId);
      const entitiesFile = await storage.readEntities();

      const utilityReport = computePublicChoiceUtilityReport(workbook, entitiesFile.entities);
      const riskReport = computeStructuralRiskReport(workbook, entitiesFile.entities);

      const resolvedPath = path.resolve(process.cwd(), outputPath);
      const dir = path.dirname(resolvedPath);
      await fs.promises.mkdir(dir, { recursive: true });

      let bytesWritten = 0;

      if (format === 'csv') {
        const { nodesCsv, branchesCsv } = exportCsvBundle(workbook, entitiesFile.entities, utilityReport);

        // If outputPath ends in .csv, write nodes to outputPath and branches to _branches.csv
        if (resolvedPath.toLowerCase().endsWith('.csv')) {
          const basePath = resolvedPath.slice(0, -4);
          const nodesPath = `${basePath}_nodes.csv`;
          const branchesPath = `${basePath}_branches.csv`;

          await fs.promises.writeFile(nodesPath, nodesCsv, 'utf-8');
          await fs.promises.writeFile(branchesPath, branchesCsv, 'utf-8');
          // Also write combined or primary to resolvedPath for convenience
          await fs.promises.writeFile(resolvedPath, `${nodesCsv}\n\n${branchesCsv}`, 'utf-8');
          bytesWritten = Buffer.byteLength(nodesCsv, 'utf-8') + Buffer.byteLength(branchesCsv, 'utf-8');
        } else {
          // Treat as directory
          await fs.promises.mkdir(resolvedPath, { recursive: true });
          const nodesPath = path.join(resolvedPath, 'nodes.csv');
          const branchesPath = path.join(resolvedPath, 'branches.csv');
          await fs.promises.writeFile(nodesPath, nodesCsv, 'utf-8');
          await fs.promises.writeFile(branchesPath, branchesCsv, 'utf-8');
          bytesWritten = Buffer.byteLength(nodesCsv, 'utf-8') + Buffer.byteLength(branchesCsv, 'utf-8');
        }
      } else {
        let xlsxFilePath = resolvedPath;
        if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
          xlsxFilePath = path.join(resolvedPath, `${workbook.title || workbookId}.xlsx`);
        } else if (!xlsxFilePath.toLowerCase().endsWith('.xlsx')) {
          xlsxFilePath = `${xlsxFilePath}.xlsx`;
        }
        const blob = await exportExcelWorkbook(workbook, entitiesFile.entities, utilityReport, riskReport);
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.promises.writeFile(xlsxFilePath, buffer);
        bytesWritten = buffer.length;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                format,
                outputPath: format === 'xlsx' && !resolvedPath.toLowerCase().endsWith('.xlsx') ? `${resolvedPath}.xlsx` : resolvedPath,
                bytesWritten,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 17. QualCount-batch_import_workflow_rows
  server.tool(
    'QualCount-batch_import_workflow_rows',
    'Atomic batch ingestion tool: deduplicates entities, creates placements & branches, runs bottom-to-top layout, and returns summary.',
    {
      workbookId: z.string().min(1).describe('The workbook ID to import rows into'),
      rows: z
        .array(
          z.object({
            sourceOrg: z.string().min(1).describe('Source organization name'),
            targetOrg: z.string().min(1).describe('Target organization name'),
            targetCategory: z
              .enum(['ngo', 'csr', 'government', 'institution', 'community', 'other'])
              .optional()
              .describe('Target organization category'),
            branchType: z.enum(['green', 'white', 'yellow']).describe('Branch type'),
            branchStatus: z.enum(['pending', 'tick', 'cross']).describe('Branch status'),
            valuePct: z.number().optional().describe('Funding percentage (green only)'),
            fundingPct: z.number().optional().describe('Alias for valuePct'),
            inKindValueInr: z.number().optional().describe('In-kind INR value (white only)'),
            inKindInr: z.number().optional().describe('Alias for inKindValueInr'),
            note: z.string().optional().describe('Outreach or relationship notes'),
            outreachAttempts: z.number().int().optional().describe('Outreach touches'),
            selectiveIncentives: z.array(z.string()).optional().describe('Selective incentives tags'),
          })
        )
        .describe('Array of workflow relationship rows to import'),
      runTidyUpAfter: z.boolean().optional().describe('Whether to run bottom-to-top hierarchical layout (default true)'),
    },
    async ({ workbookId, rows, runTidyUpAfter = true }) => {
      const workbook = await storage.readWorkbook(workbookId);
      const entitiesFile = await storage.readEntities();

      // Normalize input rows into ImportRow interface
      const importRows: ImportRow[] = rows.map((r) => ({
        sourceOrg: r.sourceOrg,
        targetOrg: r.targetOrg,
        targetCategory: r.targetCategory as EntityCategory,
        branchType: r.branchType as BranchType,
        status: (r.branchStatus || 'pending') as BranchStatus,
        fundingPct: r.valuePct ?? r.fundingPct,
        inKindInr: r.inKindValueInr ?? r.inKindInr,
        note: r.note,
        selectiveIncentives: r.selectiveIncentives as SelectiveIncentiveTag[],
        outreachAttempts: r.outreachAttempts,
      }));

      // Mock WorkspaceState to pass into commitImportedRows
      const wsState: WorkspaceState = {
        schemaVersion: 2,
        workspaceId: 'current',
        workspaceName: 'current',
        activeWorkbookId: workbookId,
        workbooks: {
          [workbookId]: {
            workbookId,
            title: workbook.title,
            description: workbook.description,
            targetBudgetInr: workbook.targetBudgetInr,
            status: workbook.status,
            createdAt: workbook.createdAt,
            updatedAt: workbook.updatedAt,
          },
        },
        workbookLinks: {},
        placements: { ...workbook.placements },
        branches: { ...workbook.branches },
        entities: { ...entitiesFile.entities },
      };

      const committedState = await commitImportedRows(importRows, workbookId, wsState);

      // If user disabled tidy up, revert positions back
      if (runTidyUpAfter === false) {
        // keep placement coords as were or simple unshifted
      } else {
        // commitImportedRows already ran layout, but let's ensure pure layout coords are applied
        const layoutCoords = await computeHierarchicalLayout(
          committedState.placements,
          committedState.branches,
          workbookId,
          'UP'
        );
        for (const [id, plc] of Object.entries(committedState.placements)) {
          if (layoutCoords[id]) {
            plc.x = layoutCoords[id].x;
            plc.y = layoutCoords[id].y;
          }
        }
      }

      // Update entitiesFile with new entities
      entitiesFile.entities = committedState.entities;
      entitiesFile.updatedAt = new Date().toISOString();
      entitiesFile.revision = (entitiesFile.revision || 1) + 1;
      await storage.writeEntities(entitiesFile);

      // Update workbook with new placements and branches with snapshot
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
          agentName: 'MCP Agent',
          toolName: 'batch_import_workflow_rows',
          summary: `Batch imported ${rows.length} rows (${finalPlacementsCount} nodes, ${finalBranchesCount} branches)`,
        }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                rowsImported: rows.length,
                totalPlacements: finalPlacementsCount,
                totalBranches: finalBranchesCount,
                tidyUpApplied: runTidyUpAfter,
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

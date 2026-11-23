import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpWorkspaceStorage } from '../storageAdapter';
import { computeStructuralRiskReport } from '../../../../src/engine/risk';
import type { AgentRiskAssessment, RiskFailureScenario } from '../types';

export function registerRiskTools(server: McpServer, storage: McpWorkspaceStorage): void {
  // 14. QualCount-get_structural_risk_report
  server.tool(
    'QualCount-get_structural_risk_report',
    'Executes Layer 1 deterministic structural risk analysis across all 6 parameters (R1-R6) and returns thresholds, severity, and offending IDs.',
    {
      workbookId: z.string().min(1).describe('The workbook ID'),
    },
    async ({ workbookId }) => {
      const workbook = await storage.readWorkbook(workbookId);
      const entitiesFile = await storage.readEntities();

      const report = computeStructuralRiskReport(workbook, entitiesFile.entities);

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

  // 15. QualCount-write_risk_assessment_box
  server.tool(
    'QualCount-write_risk_assessment_box',
    'Populates or updates the persistent Layer 2 Risk Assessment Box displayed live on the Maximized Dashboard.',
    {
      workbookId: z.string().min(1).describe('The workbook ID'),
      overallPosition: z.string().min(1).describe('High-level qualitative synthesis of institutional risk posture'),
      parameterCommentary: z
        .object({
          R1: z.string().describe('Commentary on Single-Bridge Concentration (R1)'),
          R2: z.string().describe('Commentary on Unowned Dependency Exposure (R2)'),
          R3: z.string().describe('Commentary on Funding Concentration & Runway Gap (R3)'),
          R4: z.string().describe('Commentary on Public Choice Apathy Risk (R4)'),
          R5: z.string().describe('Commentary on Decision-Cost Drag & Stale Pipeline (R5)'),
          R6: z.string().describe('Commentary on Rejection Cluster Signal (R6)'),
        })
        .describe('Qualitative commentary for each of the 6 risk parameters'),
      failureScenarios: z
        .array(
          z.object({
            id: z.string().optional(),
            title: z.string().min(1).describe('Scenario title'),
            severity: z.enum(['low', 'moderate', 'elevated', 'critical']).describe('Severity tier'),
            likelihood: z.enum(['low', 'medium', 'high']).describe('Likelihood level'),
            triggerCondition: z.string().min(1).describe('Specific real-world trigger event'),
            affectedPlacementIds: z.array(z.string()).describe('IDs of affected placements'),
            mitigationAction: z.string().min(1).describe('Concrete mitigation action doable in 7-14 days'),
            status: z.enum(['open', 'mitigating', 'resolved']).optional().describe('Scenario status'),
          })
        )
        .describe('Concrete failure scenarios with triggers and actionable mitigations'),
      publicChoiceDiagnosis: z.string().min(1).describe('Institutional analysis of partner incentive misalignments'),
      agentName: z.string().optional().describe('Name of the auditing agent (e.g. "Claude Code via MCP")'),
    },
    async ({
      workbookId,
      overallPosition,
      parameterCommentary,
      failureScenarios,
      publicChoiceDiagnosis,
      agentName,
    }) => {
      const now = new Date().toISOString();
      const auditor = agentName || 'Agent via MCP';

      const scenarios: RiskFailureScenario[] = failureScenarios.map((s, idx) => ({
        id: s.id || `scen-${Date.now()}-${idx + 1}`,
        title: s.title,
        severity: s.severity,
        likelihood: s.likelihood,
        triggerCondition: s.triggerCondition,
        affectedPlacementIds: s.affectedPlacementIds,
        mitigationAction: s.mitigationAction,
        status: s.status || 'open',
      }));

      const assessment: AgentRiskAssessment = {
        assessedAt: now,
        assessedBy: auditor,
        overallPosition,
        parameterCommentary,
        failureScenarios: scenarios,
        publicChoiceDiagnosis,
      };

      await storage.writeWorkbookWithSnapshot(
        workbookId,
        async (wb) => {
          wb.riskAssessment = assessment;
          return wb;
        },
        {
          agentName: auditor,
          toolName: 'write_risk_assessment_box',
          summary: `Published Layer 2 Risk Briefing (${scenarios.length} scenarios identified)`,
        }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                riskAssessment: assessment,
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

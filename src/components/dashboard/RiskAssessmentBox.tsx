import React, { useState } from 'react';
import { clsx } from 'clsx';
import {
  ShieldAlert,
  ShieldCheck,
  Bot,
  Copy,
  Check,
  ChevronRight,
} from 'lucide-react';
import type {
  WorkspaceState,
  RiskSeverity,
  AgentRiskAssessment,
} from '../../types/schema';
import {
  computeStructuralRiskReport,
  type StructuralRiskReport,
  type RiskParameterResult,
} from '../../engine/risk';

interface RiskAssessmentBoxProps {
  workspace: WorkspaceState;
  activeWorkbookId: string;
  theme: 'dark' | 'night' | 'light';
  onJumpToNode?: (placementId: string) => void;
  onUpdateScenarioStatus?: (scenarioId: string, status: 'open' | 'mitigating' | 'resolved') => void;
  onSelectCulprits?: (placementIds: string[]) => void;
}

const SEVERITY_COLORS: Record<RiskSeverity, { bg: string; text: string; border: string }> = {
  low: {
    bg: 'bg-[#E6F4EC] dark:bg-[#064E3B]',
    text: 'text-[#0F6B38] dark:text-[#A7F3D0]',
    border: 'border-[#0F6B38]/30 dark:border-[#34D399]/40',
  },
  moderate: {
    bg: 'bg-[#FEF3C7] dark:bg-[#451A03]',
    text: 'text-[#9A5B00] dark:text-[#FDE68A]',
    border: 'border-[#9A5B00]/30 dark:border-[#FACC15]/40',
  },
  elevated: {
    bg: 'bg-[#FFEDD5] dark:bg-[#7C2D12]/60',
    text: 'text-[#B54708] dark:text-[#FED7AA]',
    border: 'border-[#B54708]/30 dark:border-[#FB923C]/40',
  },
  critical: {
    bg: 'bg-[#FEE2E2] dark:bg-[#7F1D1D]/70',
    text: 'text-[#991B1B] dark:text-[#FECACA]',
    border: 'border-[#991B1B]/40 dark:border-[#F87171]/50',
  },
};

export const RiskAssessmentBox: React.FC<RiskAssessmentBoxProps> = ({
  workspace,
  activeWorkbookId,
  theme: _theme,
  onJumpToNode: _onJumpToNode,
  onUpdateScenarioStatus,
  onSelectCulprits,
}) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const workbook = workspace.workbooks[activeWorkbookId];

  // Compute Layer 1 live report
  const riskReport: StructuralRiskReport = computeStructuralRiskReport(
    workspace,
    workspace.entities
  );

  const layer2Assessment: AgentRiskAssessment | undefined = workbook?.riskAssessment;

  const handleCopyAuditPrompt = () => {
    const paramsSummary = Object.values(riskReport.parameters)
      .map((p) => `- ${p.id} (${p.name}): ${p.scoreFormatted} [${p.severity.toUpperCase()}] - ${p.plainCommentary}`)
      .join('\n');

    const promptText = `Please perform a Layer 2 Public Choice Strategic Risk Audit on this QualCount workbook.

WORKBOOK METADATA:
- Title: ${workbook?.title || 'Untitled'}
- Target Budget: ₹${workbook?.targetBudgetInr?.toLocaleString() || 0}
- Aggregate Layer 1 Tier: ${riskReport.aggregateTier.toUpperCase()}

DETERMINISTIC LAYER 1 STRUCTURAL RISK MATRIX:
${paramsSummary}

OFFENDING NODE/BRANCH IDS:
- Offending Placements: ${riskReport.allOffendingPlacementIds.join(', ') || 'None'}
- Offending Branches: ${riskReport.allOffendingBranchIds.join(', ') || 'None'}

Please return a structured AgentRiskAssessment JSON with:
1. overallPosition (2-3 sentences on where the coalition stands)
2. parameterCommentary (R1 through R6 contextual notes)
3. failureScenarios (array of concrete scenarios with trigger conditions and mitigations)
4. publicChoiceDiagnosis (targeted advice on incentives and social proof)`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const handleRowClick = (param: RiskParameterResult) => {
    if (param.offendingPlacementIds.length > 0 && onSelectCulprits) {
      onSelectCulprits(param.offendingPlacementIds);
    }
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#DDD6C8] dark:border-[#2D333B] pb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[#B54708] dark:text-[#FB923C]" />
          <div>
            <h2 className="font-serif text-lg font-semibold tracking-tight text-[#1C1B18] dark:text-[#F4F2ED]">
              III. Two-Layer Risk Assessment Box
            </h2>
            <p className="text-xs text-[#5A554C] dark:text-[#9CA3AF]">
              Zero-ML deterministic matrix (Layer 1) paired with qualitative agent risk audit briefing (Layer 2).
            </p>
          </div>
        </div>

        {/* Aggregate Tier Badge */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-[#8A8377] dark:text-[#6B7280]">
            Aggregate Tier:
          </span>
          <span
            className={clsx(
              'px-2.5 py-1 rounded-[4px] font-mono text-xs font-bold uppercase tracking-wider border',
              SEVERITY_COLORS[riskReport.aggregateTier].bg,
              SEVERITY_COLORS[riskReport.aggregateTier].text,
              SEVERITY_COLORS[riskReport.aggregateTier].border
            )}
          >
            {riskReport.aggregateTier}
          </span>
        </div>
      </div>

      {/* Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Layer 1 Deterministic Matrix */}
        <div className="bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] overflow-hidden shadow-sm flex flex-col justify-between">
          <div>
            <div className="bg-[#F2EFE9] dark:bg-[#181B20] px-4 py-2 border-b border-[#DDD6C8] dark:border-[#2D333B] flex items-center justify-between">
              <span className="font-serif text-xs font-semibold text-[#1C1B18] dark:text-[#F4F2ED]">
                Layer 1: Deterministic Structural Matrix
              </span>
              <span className="text-[10px] text-[#8A8377] dark:text-[#6B7280]">
                Click row to pinpoint on canvas
              </span>
            </div>

            <div className="divide-y divide-[#DDD6C8]/60 dark:divide-[#2D333B]/60">
              {(Object.values(riskReport.parameters) as RiskParameterResult[]).map((param) => {
                const colors = SEVERITY_COLORS[param.severity];
                const hasCulprits = param.offendingPlacementIds.length > 0;

                return (
                  <div
                    key={param.id}
                    onClick={() => handleRowClick(param)}
                    className={clsx(
                      'p-3 transition-colors',
                      hasCulprits ? 'cursor-pointer hover:bg-[#F2EFE9]/60 dark:hover:bg-[#181B20]/60' : ''
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#1C1B18] dark:text-[#F4F2ED]">
                          [{param.id}]
                        </span>
                        <span className="text-xs font-semibold text-[#1C1B18] dark:text-[#F4F2ED]">
                          {param.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold tabular-nums text-[#1C1B18] dark:text-[#F4F2ED]">
                          {param.scoreFormatted}
                        </span>
                        <span
                          className={clsx(
                            'px-1.5 py-0.5 rounded-[3px] text-[9px] font-bold uppercase tracking-wider border',
                            colors.bg,
                            colors.text,
                            colors.border
                          )}
                        >
                          {param.severity}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#5A554C] dark:text-[#9CA3AF] leading-relaxed">
                      {param.plainCommentary}
                    </p>

                    {hasCulprits && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[#0F6B38] dark:text-[#34D399] font-medium">
                        <span>Pinpoint {param.offendingPlacementIds.length} culprit node(s) on canvas</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#FAF8F4] dark:bg-[#121417] p-2.5 border-t border-[#DDD6C8] dark:border-[#2D333B] text-[10px] text-[#8A8377] dark:text-[#6B7280]">
            Deterministic rules: Freeman articulation, Ostrom durability, funding concentration, Olson apathy, decision-drag, decline clusters.
          </div>
        </div>

        {/* Right Column: Layer 2 Agent Briefing */}
        <div className="bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] overflow-hidden shadow-sm flex flex-col justify-between">
          <div>
            <div className="bg-[#F2EFE9] dark:bg-[#181B20] px-4 py-2 border-b border-[#DDD6C8] dark:border-[#2D333B] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-[#5A554C] dark:text-[#9CA3AF]" />
                <span className="font-serif text-xs font-semibold text-[#1C1B18] dark:text-[#F4F2ED]">
                  Layer 2: Agent Risk Auditor Briefing
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyAuditPrompt}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border border-[#BEB5A4] dark:border-[#4B5563] text-[10px] font-semibold text-[#1C1B18] dark:text-[#F4F2ED] bg-[#FFFFFF] dark:bg-[#1E2228] hover:bg-[#F2EFE9] cursor-pointer"
                title="Copy prompt for Claude Code, Antigravity, or ChatGPT"
              >
                {copiedPrompt ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                {copiedPrompt ? 'Copied' : 'Copy Audit Prompt'}
              </button>
            </div>

            {layer2Assessment ? (
              <div className="p-4 space-y-4">
                {/* Assessed By & Date */}
                <div className="flex items-center justify-between text-[10px] text-[#8A8377] dark:text-[#6B7280]">
                  <span>Assessed By: {layer2Assessment.assessedBy}</span>
                  <span>{new Date(layer2Assessment.assessedAt).toLocaleDateString()}</span>
                </div>

                {/* Overall Position */}
                <div>
                  <h4 className="font-serif text-xs font-bold text-[#1C1B18] dark:text-[#F4F2ED] mb-1">
                    Executive Verdict:
                  </h4>
                  <p className="text-xs text-[#5A554C] dark:text-[#9CA3AF] leading-relaxed bg-[#F2EFE9]/50 dark:bg-[#181B20]/50 p-2.5 rounded-[4px] border border-[#DDD6C8] dark:border-[#2D333B]">
                    {layer2Assessment.overallPosition}
                  </p>
                </div>

                {/* Failure Scenarios */}
                {layer2Assessment.failureScenarios && layer2Assessment.failureScenarios.length > 0 && (
                  <div>
                    <h4 className="font-serif text-xs font-bold text-[#1C1B18] dark:text-[#F4F2ED] mb-2">
                      Failure Scenarios ("What Could Go Wrong"):
                    </h4>
                    <div className="space-y-2">
                      {layer2Assessment.failureScenarios.map((sc) => {
                        const sevColors = SEVERITY_COLORS[sc.severity];
                        return (
                          <div
                            key={sc.id}
                            className="p-2.5 rounded-[4px] border border-[#DDD6C8] dark:border-[#2D333B] bg-[#FAF8F4]/50 dark:bg-[#121417]/50 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-xs text-[#1C1B18] dark:text-[#F4F2ED]">
                                {sc.title}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={clsx(
                                    'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                                    sevColors.bg,
                                    sevColors.text
                                  )}
                                >
                                  {sc.severity}
                                </span>
                                {/* Status Chip Toggle */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextStatus =
                                      sc.status === 'open'
                                        ? 'mitigating'
                                        : sc.status === 'mitigating'
                                        ? 'resolved'
                                        : 'open';
                                    onUpdateScenarioStatus?.(sc.id, nextStatus);
                                  }}
                                  className={clsx(
                                    'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border cursor-pointer',
                                    sc.status === 'resolved'
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                      : sc.status === 'mitigating'
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-rose-100 text-rose-800 border-rose-300'
                                  )}
                                  title="Click to toggle status: open -> mitigating -> resolved"
                                >
                                  {sc.status}
                                </button>
                              </div>
                            </div>
                            <p className="text-[11px] text-[#5A554C] dark:text-[#9CA3AF]">
                              <strong className="text-[#1C1B18] dark:text-[#F4F2ED]">Trigger:</strong> {sc.triggerCondition}
                            </p>
                            <p className="text-[11px] text-[#0F6B38] dark:text-[#34D399]">
                              <strong>Mitigation:</strong> {sc.mitigationAction}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Public Choice Diagnosis */}
                {layer2Assessment.publicChoiceDiagnosis && (
                  <div>
                    <h4 className="font-serif text-xs font-bold text-[#1C1B18] dark:text-[#F4F2ED] mb-1">
                      Public Choice Strategic Diagnosis:
                    </h4>
                    <p className="text-xs text-[#5A554C] dark:text-[#9CA3AF] leading-relaxed italic">
                      "{layer2Assessment.publicChoiceDiagnosis}"
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center space-y-3">
                <ShieldCheck className="w-8 h-8 text-[#8A8377] dark:text-[#6B7280] mx-auto" />
                <div className="text-xs font-semibold text-[#1C1B18] dark:text-[#F4F2ED]">
                  No qualitative agent assessment recorded
                </div>
                <p className="text-[11px] text-[#5A554C] dark:text-[#9CA3AF] max-w-sm mx-auto">
                  Click "Copy Audit Prompt" to run an audit via Claude Code, Antigravity, or ChatGPT, or connect via MCP tool <code className="font-mono text-[10px] bg-[#DDD6C8]/40 px-1 py-0.5 rounded">QualCount-two-layer-risk-auditor</code>.
                </p>
              </div>
            )}
          </div>

          <div className="bg-[#FAF8F4] dark:bg-[#121417] p-2.5 border-t border-[#DDD6C8] dark:border-[#2D333B] text-[10px] text-[#8A8377] dark:text-[#6B7280]">
            Layer 2 assessments persist directly inside workbook files (<code className="font-mono text-[9px]">riskAssessment</code>).
          </div>
        </div>
      </div>
    </section>
  );
};

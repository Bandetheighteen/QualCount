import React, { useState } from 'react';
import { clsx } from 'clsx';
import {
  Sliders,
  Plus,
  Minus,
  AlertTriangle,
} from 'lucide-react';
import type {
  WorkspaceState,
  Placement,
  SelectiveIncentiveTag,
  UtilityStrategyWeights,
} from '../../types/schema';
import {
  DEFAULT_UTILITY_WEIGHTS,
  UTILITY_PRESETS,
} from '../../types/schema';
import {
  computePublicChoiceUtilityReport,
  type WorkbookUtilityReport,
} from '../../engine/utility';

interface UtilityLedgerSectionProps {
  workspace: WorkspaceState;
  activeWorkbookId: string;
  theme: 'dark' | 'night' | 'light';
  onUpdatePlacement: (placementId: string, updates: Partial<Placement>) => void;
  onUpdateWeights: (weights: UtilityStrategyWeights) => void;
  onJumpToNode?: (placementId: string) => void;
}

const ALL_SELECTIVE_INCENTIVES: Array<{ id: SelectiveIncentiveTag; label: string }> = [
  { id: 'csr_compliance', label: 'CSR Compliance' },
  { id: 'brand_visibility', label: 'Brand Visibility' },
  { id: 'institutional_mandate', label: 'Institutional Mandate' },
  { id: 'policy_influence', label: 'Policy Influence' },
  { id: 'network_prestige', label: 'Network Prestige' },
  { id: 'asset_activation', label: 'Asset Activation' },
  { id: 'community_legitimacy', label: 'Community Legitimacy' },
];

export const UtilityLedgerSection: React.FC<UtilityLedgerSectionProps> = ({
  workspace,
  activeWorkbookId,
  theme: _theme,
  onUpdatePlacement,
  onUpdateWeights,
  onJumpToNode,
}) => {
  const workbook = workspace.workbooks[activeWorkbookId];
  const weights = workbook?.utilityWeights || DEFAULT_UTILITY_WEIGHTS;

  const [activeIncentivePopoverId, setActiveIncentivePopoverId] = useState<string | null>(null);

  // Compute live utility report with active workbook weights & budget
  const utilityReport: WorkbookUtilityReport = computePublicChoiceUtilityReport(
    {
      ...workspace,
      activeWorkbookId,
      utilityWeights: weights,
      targetBudgetInr: workbook?.targetBudgetInr,
    },
    workspace.entities
  );

  const handlePresetChange = (presetKey: string) => {
    if (presetKey in UTILITY_PRESETS) {
      onUpdateWeights(UTILITY_PRESETS[presetKey as keyof typeof UTILITY_PRESETS]);
    } else {
      onUpdateWeights({
        ...weights,
        presetName: 'custom',
      });
    }
  };

  const handleWeightSlider = (key: 'alphaR' | 'alphaA' | 'alphaV' | 'alphaC', value: number) => {
    const rawVal = Math.round(value * 100) / 100;
    onUpdateWeights({
      ...weights,
      presetName: 'custom',
      [key]: rawVal,
    });
  };

  const handleStepTouches = (placementId: string, delta: number) => {
    const plc = workspace.placements[placementId];
    if (!plc) return;
    const curr = plc.outreachAttempts ?? 1;
    const next = Math.max(1, curr + delta);
    onUpdatePlacement(placementId, { outreachAttempts: next });
  };

  const handleToggleCoOwnership = (
    placementId: string,
    field: 'writtenCommitment' | 'brandOrLogoShared' | 'staffAssigned' | 'networkMobilized'
  ) => {
    const plc = workspace.placements[placementId];
    if (!plc) return;
    const signals = plc.coOwnershipSignals || {
      writtenCommitment: false,
      brandOrLogoShared: false,
      staffAssigned: false,
      networkMobilized: false,
    };
    onUpdatePlacement(placementId, {
      coOwnershipSignals: {
        ...signals,
        [field]: !signals[field],
      },
    });
  };

  const handleToggleIncentive = (placementId: string, tag: SelectiveIncentiveTag) => {
    const plc = workspace.placements[placementId];
    if (!plc) return;
    const existing = plc.selectiveIncentives || [];
    const next = existing.includes(tag) ? existing.filter((t) => t !== tag) : [...existing, tag];
    onUpdatePlacement(placementId, { selectiveIncentives: next });
  };

  const nonRootPlacements = Object.values(workspace.placements).filter((p) => !p.isRootNgo);

  return (
    <section className="space-y-4">
      {/* Header & Macro KPIs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#DDD6C8] dark:border-[#2D333B] pb-3 gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold tracking-tight text-[#1C1B18] dark:text-[#F4F2ED]">
            II. Public Choice Utility Ledger
          </h2>
          <p className="text-xs text-[#5A554C] dark:text-[#9CA3AF]">
            Objective microeconomic utility modeling: decision touches (η), selective incentives (I), co-ownership (O), and multi-thread contagion.
          </p>
        </div>

        {/* Macro PUI Badge & Confirmed Actions per Touch */}
        <div className="flex items-center gap-3">
          <div className="bg-[#FAF8F4] dark:bg-[#121417] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] px-3 py-1.5 text-center">
            <span className="text-[9px] uppercase font-bold tracking-wider text-[#8A8377] dark:text-[#6B7280] block">
              Workbook PUI
            </span>
            <span className="font-mono text-xl font-bold tabular-nums text-[#1C1B18] dark:text-[#F4F2ED]">
              {utilityReport.pui.toFixed(1)}
              <span className="text-xs font-normal text-[#8A8377] dark:text-[#6B7280]">/100</span>
            </span>
          </div>

          <div className="bg-[#FAF8F4] dark:bg-[#121417] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] px-3 py-1.5 text-center">
            <span className="text-[9px] uppercase font-bold tracking-wider text-[#8A8377] dark:text-[#6B7280] block">
              Actions / Touch
            </span>
            <span className="font-mono text-xl font-bold tabular-nums text-[#0F6B38] dark:text-[#34D399]">
              {utilityReport.actionsPerTouch.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Strategy Preset & Sliders Bar */}
      <div className="bg-[#F2EFE9] dark:bg-[#181B20] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] p-3 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-[#5A554C] dark:text-[#9CA3AF]" />
            <span className="font-serif text-xs font-semibold text-[#1C1B18] dark:text-[#F4F2ED]">
              Coalition Strategy Weighting:
            </span>
            <select
              value={weights.presetName}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[4px] px-2 py-1 text-xs font-medium text-[#1C1B18] dark:text-[#F4F2ED] focus:outline-none"
            >
              <option value="balanced">Balanced Coalition (30% R, 35% A, 20% V, 15% C)</option>
              <option value="amplification">Amplification Push (20% R, 45% A, 15% V, 20% C)</option>
              <option value="delivery">Delivery & Venues (50% R, 20% A, 20% V, 10% C)</option>
              <option value="custom">Custom Policy Weights</option>
            </select>
          </div>
          <span className="text-[10px] text-[#8A8377] dark:text-[#6B7280]">
            Weights must sum to 1.00 (α_R + α_A + α_V + α_C = 1.00)
          </span>
        </div>

        {/* 4 Weight Sliders */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="flex justify-between text-[10px] text-[#5A554C] dark:text-[#9CA3AF] mb-1">
              <span>Direct Commitment (α_R)</span>
              <span className="font-mono font-bold">{Math.round(weights.alphaR * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.alphaR}
              onChange={(e) => handleWeightSlider('alphaR', parseFloat(e.target.value))}
              className="w-full accent-[#0F6B38] dark:accent-[#34D399] h-1.5 bg-[#DDD6C8] dark:bg-[#2D333B] rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-[#5A554C] dark:text-[#9CA3AF] mb-1">
              <span>Amplification (α_A)</span>
              <span className="font-mono font-bold">{Math.round(weights.alphaA * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.alphaA}
              onChange={(e) => handleWeightSlider('alphaA', parseFloat(e.target.value))}
              className="w-full accent-[#B45309] dark:accent-[#FACC15] h-1.5 bg-[#DDD6C8] dark:bg-[#2D333B] rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-[#5A554C] dark:text-[#9CA3AF] mb-1">
              <span>Owned Conversion (α_V)</span>
              <span className="font-mono font-bold">{Math.round(weights.alphaV * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.alphaV}
              onChange={(e) => handleWeightSlider('alphaV', parseFloat(e.target.value))}
              className="w-full accent-[#18181B] dark:accent-[#F8FAFC] h-1.5 bg-[#DDD6C8] dark:bg-[#2D333B] rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-[#5A554C] dark:text-[#9CA3AF] mb-1">
              <span>Multi-Thread (α_C)</span>
              <span className="font-mono font-bold">{Math.round(weights.alphaC * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.alphaC}
              onChange={(e) => handleWeightSlider('alphaC', parseFloat(e.target.value))}
              className="w-full accent-[#2563EB] dark:accent-[#38BDF8] h-1.5 bg-[#DDD6C8] dark:bg-[#2D333B] rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Partner Utility Ledger Table */}
      <div className="bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#DDD6C8] dark:border-[#2D333B] bg-[#FAF8F4]/50 dark:bg-[#121417]/50 text-[10px] font-bold uppercase tracking-wider text-[#5A554C] dark:text-[#9CA3AF]">
                <th className="py-2.5 px-3">Partner Organization</th>
                <th className="py-2.5 px-2 text-center" title="Buchanan-Tullock decision touches (d_i)">Touches (d)</th>
                <th className="py-2.5 px-3" title="Olson selective incentive alignment">Selective Incentives (I)</th>
                <th className="py-2.5 px-3" title="Ostrom revealed co-ownership checklist">Co-Ownership Signals (O)</th>
                <th className="py-2.5 px-2 text-right" title="Centola-Macy social proof factor">Proof (S)</th>
                <th className="py-2.5 px-2 text-right" title="Direct commitment R_i">R</th>
                <th className="py-2.5 px-2 text-right" title="Downstream reach A_i">A</th>
                <th className="py-2.5 px-2 text-right" title="Owned conversion V_i">V</th>
                <th className="py-2.5 px-2 text-right" title="Multi-thread reinforcement C_i">C</th>
                <th className="py-2.5 px-3 text-right" title="Partner Structural Utility (0-100)">Utility (U)</th>
                <th className="py-2.5 px-3 text-right" title="Decision-Cost Adjusted Yield (U / d)">Yield (η)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDD6C8]/60 dark:divide-[#2D333B]/60 font-sans">
              {nonRootPlacements.map((plc) => {
                const metrics = utilityReport.partners[plc.placementId];
                if (!metrics) return null;

                const decomp = metrics.decomposition;
                const touches = plc.outreachAttempts ?? 1;
                const signals = plc.coOwnershipSignals || {
                  writtenCommitment: false,
                  brandOrLogoShared: false,
                  staffAssigned: false,
                  networkMobilized: false,
                };
                const incentives = plc.selectiveIncentives || [];

                return (
                  <tr
                    key={plc.placementId}
                    className="hover:bg-[#F2EFE9]/40 dark:hover:bg-[#181B20]/40 transition-colors"
                  >
                    {/* Partner Name + Apathy Warning */}
                    <td className="py-2 px-3 font-medium text-[#1C1B18] dark:text-[#F4F2ED]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onJumpToNode?.(plc.placementId)}
                          className="hover:underline text-left cursor-pointer font-semibold"
                          title="Click to view on canvas"
                        >
                          {metrics.entityName}
                        </button>
                        {metrics.isApathyWarning && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#991B1B]/30"
                            title="Apathy Risk: No selective incentive and 0 referrals"
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Apathy
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Touch Stepper (+/-) */}
                    <td className="py-2 px-2 text-center">
                      <div className="inline-flex items-center border border-[#DDD6C8] dark:border-[#2D333B] rounded-[4px] bg-[#FFFFFF] dark:bg-[#1E2228] p-0.5">
                        <button
                          type="button"
                          onClick={() => handleStepTouches(plc.placementId, -1)}
                          disabled={touches <= 1}
                          className="p-0.5 hover:bg-[#F2EFE9] dark:hover:bg-[#2D333B] rounded disabled:opacity-30 cursor-pointer"
                          title="Decrease outreach touches"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="font-mono text-xs px-1.5 font-bold tabular-nums">
                          {touches}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStepTouches(plc.placementId, 1)}
                          className="p-0.5 hover:bg-[#F2EFE9] dark:hover:bg-[#2D333B] rounded cursor-pointer"
                          title="Increase outreach touches"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </td>

                    {/* Selective Incentives Tag Dropdown */}
                    <td className="py-2 px-3 relative">
                      <div className="flex flex-wrap items-center gap-1">
                        {incentives.map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 text-[9px] rounded-[3px] bg-[#EFECE6] dark:bg-[#2D333B] text-[#3D3830] dark:text-[#E2E8F0] border border-[#CFC7B8] dark:border-[#4B5563]"
                          >
                            {tag.replace('_', ' ')}
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setActiveIncentivePopoverId(
                              activeIncentivePopoverId === plc.placementId ? null : plc.placementId
                            )
                          }
                          className="px-1.5 py-0.5 text-[9px] font-bold rounded border border-dashed border-[#DDD6C8] hover:border-[#1C1B18] dark:border-[#4B5563] text-[#5A554C] dark:text-[#9CA3AF] cursor-pointer"
                        >
                          + Tag
                        </button>
                      </div>

                      {/* Popover */}
                      {activeIncentivePopoverId === plc.placementId && (
                        <div className="absolute top-8 left-3 z-30 w-56 bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#BEB5A4] dark:border-[#4B5563] rounded-[6px] shadow-lg p-2 space-y-1">
                          <div className="text-[10px] font-bold uppercase text-[#8A8377] dark:text-[#9CA3AF] mb-1">
                            Olson Selective Incentives
                          </div>
                          {ALL_SELECTIVE_INCENTIVES.map(({ id, label }) => {
                            const isChecked = incentives.includes(id);
                            return (
                              <label
                                key={id}
                                className="flex items-center gap-2 text-[11px] p-1 rounded hover:bg-[#F2EFE9] dark:hover:bg-[#2D333B] cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleIncentive(plc.placementId, id)}
                                  className="rounded text-[#0F6B38] focus:ring-0"
                                />
                                <span>{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Co-Ownership 4 Binary Checks */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] cursor-pointer" title="Written Commitment">
                          <input
                            type="checkbox"
                            checked={signals.writtenCommitment}
                            onChange={() => handleToggleCoOwnership(plc.placementId, 'writtenCommitment')}
                            className="rounded text-[#0F6B38]"
                          />
                          <span>Writ</span>
                        </label>
                        <label className="flex items-center gap-1 text-[10px] cursor-pointer" title="Brand / Logo Shared">
                          <input
                            type="checkbox"
                            checked={signals.brandOrLogoShared}
                            onChange={() => handleToggleCoOwnership(plc.placementId, 'brandOrLogoShared')}
                            className="rounded text-[#0F6B38]"
                          />
                          <span>Logo</span>
                        </label>
                        <label className="flex items-center gap-1 text-[10px] cursor-pointer" title="Staff Assigned">
                          <input
                            type="checkbox"
                            checked={signals.staffAssigned}
                            onChange={() => handleToggleCoOwnership(plc.placementId, 'staffAssigned')}
                            className="rounded text-[#0F6B38]"
                          />
                          <span>Staff</span>
                        </label>
                        <label className="flex items-center gap-1 text-[10px] cursor-pointer" title="Network Mobilized">
                          <input
                            type="checkbox"
                            checked={signals.networkMobilized}
                            onChange={() => handleToggleCoOwnership(plc.placementId, 'networkMobilized')}
                            className="rounded text-[#0F6B38]"
                          />
                          <span>Net</span>
                        </label>
                      </div>
                    </td>

                    {/* Proof (S) */}
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-[#5A554C] dark:text-[#9CA3AF]">
                      {metrics.socialProofS.toFixed(2)}
                    </td>

                    {/* R, A, V, C */}
                    <td className="py-2 px-2 text-right font-mono tabular-nums">{metrics.directCommitmentR.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">{metrics.amplificationA.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">{metrics.ownedConversionV.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">{metrics.multiThreadReinforcementC.toFixed(2)}</td>

                    {/* Utility Score (U) with exact additive tooltip */}
                    <td className="py-2 px-3 text-right">
                      <span
                        className="font-mono font-bold text-xs tabular-nums cursor-help underline decoration-dotted text-[#1C1B18] dark:text-[#F4F2ED]"
                        title={`4-Part Additive Decomposition:\nR: ${decomp.weightedR.toFixed(1)} + A: ${decomp.weightedA.toFixed(1)} + V: ${decomp.weightedV.toFixed(1)} + C: ${decomp.weightedC.toFixed(1)} = ${metrics.utilityScoreU}`}
                      >
                        {metrics.utilityScoreU.toFixed(1)}
                      </span>
                    </td>

                    {/* Decision Yield (η) */}
                    <td className="py-2 px-3 text-right">
                      <span
                        className={clsx(
                          'font-mono font-bold text-xs tabular-nums',
                          metrics.utilityYieldEta >= 20
                            ? 'text-[#0F6B38] dark:text-[#34D399]'
                            : metrics.utilityYieldEta >= 10
                            ? 'text-[#B45309] dark:text-[#FACC15]'
                            : 'text-[#8A8377] dark:text-[#6B7280]'
                        )}
                        title={`Buchanan-Tullock yield: ${metrics.utilityScoreU} utility / ${touches} touches`}
                      >
                        {metrics.utilityYieldEta.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

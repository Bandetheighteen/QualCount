import React, { useState, useRef } from 'react';
import { clsx } from 'clsx';
import {
  X,
  FileSpreadsheet,
  Download,
  Bot,
  Copy,
  Check,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import {
  parseImportFileContent,
  validateAndPreviewImport,
  type ImportRow,
  type ImportPreviewResult,
} from '../../io/spreadsheetImport';
import { downloadFile } from '../../io/spreadsheetExport';

interface SpreadsheetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CANONICAL_CSV_TEMPLATE = `source_org,target_org,target_category,branch_type,status,funding_pct,in_kind_inr,note,selective_incentives,outreach_attempts
Your NGO,Apex CSR,csr,green,pending,25,,Corporate grant application,csr_compliance; brand_visibility,2
Your NGO,City Central Museum,institution,white,tick,,500000,Auditorium and exhibition space,institutional_mandate; asset_activation,3
City Central Museum,Youth Sports Federation,community,yellow,tick,,,Introduced to regional sports director,network_prestige,2
Apex CSR,District Skill Council,government,yellow,pending,,,Intro requested via CSR chair,policy_influence,1`;

export const SpreadsheetImportModal: React.FC<SpreadsheetImportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedAgentSnippet, setCopiedAgentSnippet] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const workspace = useWorkspaceStore((state) => state.workspace);
  const activeWorkbookId = useWorkspaceStore((state) => state.activeWorkbookId);
  const commitSpreadsheetImport = useWorkspaceStore((state) => state.commitSpreadsheetImport);
  const activeWorkbook = workspace && activeWorkbookId ? workspace.workbooks[activeWorkbookId] : null;
  const targetBudget = activeWorkbook?.targetBudgetInr ?? 1000000;

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    downloadFile(CANONICAL_CSV_TEMPLATE, 'qualcount_partnership_template.csv', 'text/csv;charset=utf-8');
  };

  const handleFileProcess = async (file: File) => {
    useWorkspaceStore.getState().setIsLoading(true, `Reading and parsing ${file.name}...`);
    setIsProcessing(true);
    await new Promise((r) => setTimeout(r, 40));
    try {
      const text = await file.text();
      useWorkspaceStore.getState().setIsLoading(true, 'Extracting partnership rows & validating structure...');
      await new Promise((r) => setTimeout(r, 40));
      const rows = parseImportFileContent(text);
      setParsedRows(rows);
      if (workspace) {
        const preview = validateAndPreviewImport(rows, workspace.entities, targetBudget);
        setPreviewResult(preview);
      }
    } catch (err) {
      console.error('[SpreadsheetImportModal] Failed to parse input file:', err);
    } finally {
      setIsProcessing(false);
      useWorkspaceStore.getState().setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileProcess(file);
  };

  const handleCommit = async () => {
    if (!workspace || !activeWorkbookId || parsedRows.length === 0) return;
    setIsProcessing(true);
    try {
      await commitSpreadsheetImport(parsedRows);
      onClose();
    } catch (err) {
      console.error('[SpreadsheetImportModal] Failed to commit rows:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyWebAiPrompt = () => {
    if (!workspace || !activeWorkbook) return;
    const existingEntitiesList = Object.values(workspace.entities)
      .map((e) => `- ${e.name} (${e.category})`)
      .join('\n');

    const promptText = `I have a partnership spreadsheet that I need to map into a QualCount Version 2 Coalition Network.

WORKBOOK CONTEXT:
- Workbook Title: "${activeWorkbook.title}"
- Target Budget: ₹${targetBudget.toLocaleString()}
- Active Workbook ID: "${activeWorkbookId}"

EXISTING ORGANIZATIONS IN THIS WORKSPACE (match spellings where possible):
${existingEntitiesList || 'None yet'}

SCHEMA RULES:
1. Green branch = Financial / CSR funding only. Convert rupees into valuePct = (amount / ${targetBudget}) * 100.
2. White branch = Direct working relationship with Lead NGO (venue, attendance, co-host). Can have inKindValueInr.
3. Yellow branch = Third-party referral or gateway between non-root organizations.
4. Status = 'tick' (confirmed), 'pending' (in-progress), or 'cross' (declined).
5. Output ONLY a valid CSV with headers:
source_org,target_org,target_category,branch_type,status,funding_pct,in_kind_inr,note,selective_incentives,outreach_attempts`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const handleCopyAgentSnippet = () => {
    const snippet = `Import partnership sheet into "${activeWorkbook?.title || 'Active Workbook'}" using the QualCount-spreadsheet-to-workflow-mapper skill.`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(snippet);
      setCopiedAgentSnippet(true);
      setTimeout(() => setCopiedAgentSnippet(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-[#FAF8F4] dark:bg-[#181B20] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-[#1C1B18] dark:text-[#F4F2ED]">
        {/* Header */}
        <div className="px-5 py-3 bg-[#F2EFE9] dark:bg-[#121417] border-b border-[#DDD6C8] dark:border-[#2D333B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#5A554C] dark:text-[#9CA3AF]" />
            <div>
              <h3 id="import-modal-title" className="font-serif text-sm font-bold">
                Import Partnership Spreadsheet
              </h3>
              <p className="text-[10px] text-[#8A8377] dark:text-[#6B7280]">
                Choose one of three entry paths: structured template, connected agent, or web AI prompt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded text-[#5A554C] hover:text-[#1C1B18] dark:text-[#9CA3AF] dark:hover:text-[#F4F2ED] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Doors Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Door 1: Native Template Importer */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileProcess(file);
            }}
            className={clsx(
              'border rounded-[6px] p-4 space-y-3 transition-colors',
              isDragOver
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-500'
                : 'bg-[#FFFFFF] dark:bg-[#1E2228] border-[#DDD6C8] dark:border-[#2D333B]'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-serif text-xs font-bold text-[#1C1B18] dark:text-[#F4F2ED]">
                Door 1: Native Template Importer
              </span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F6B38] dark:text-[#34D399] hover:underline cursor-pointer"
              >
                <Download className="w-3 h-3" />
                Download Clean Template (.csv)
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,application/json,text/csv"
                onChange={handleFileChange}
                className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-[4px] file:border file:border-[#BEB5A4] file:text-xs file:font-semibold file:bg-[#F2EFE9] dark:file:bg-[#2D333B] file:text-[#1C1B18] dark:file:text-[#F4F2ED] hover:file:bg-[#DDD6C8] cursor-pointer"
              />
            </div>

            {/* Preview Summary */}
            {previewResult && (
              <div className="bg-[#FAF8F4] dark:bg-[#121417] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[4px] p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-[#0F6B38] dark:text-[#34D399]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Validation Passed: {previewResult.branchCount} branches detected</span>
                </div>
                <div className="text-[11px] text-[#5A554C] dark:text-[#9CA3AF]">
                  • <strong>{previewResult.newEntities.length}</strong> new organizations will be created
                  <br />
                  • <strong>{previewResult.reusedEntities.length}</strong> existing organizations will be linked
                </div>

                {previewResult.warnings.length > 0 && (
                  <div className="text-[10px] text-amber-700 dark:text-amber-300">
                    {previewResult.warnings.map((w, i) => (
                      <div key={i}>⚠ {w}</div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={isProcessing}
                  className="mt-2 w-full py-2 bg-[#0F6B38] hover:bg-[#0B522A] text-white rounded-[4px] text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? 'Importing & Tidying Canvas...' : 'Commit Import & Auto-Layout (UP)'}
                </button>
              </div>
            )}
          </div>

          {/* Door 2: Connected Local AI Agent (MCP) */}
          <div className="bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#5A554C] dark:text-[#9CA3AF]" />
              <span className="font-serif text-xs font-bold text-[#1C1B18] dark:text-[#F4F2ED]">
                Door 2: Local Connected AI Agent (via MCP)
              </span>
            </div>
            <p className="text-[11px] text-[#5A554C] dark:text-[#9CA3AF] leading-relaxed">
              Have Claude Code, Cursor, Codex, or Antigravity connected to QualCount? Point it at any raw spreadsheet:
            </p>
            <div className="flex items-center justify-between gap-2 bg-[#F2EFE9] dark:bg-[#121417] p-2 rounded-[4px] border border-[#DDD6C8] dark:border-[#2D333B]">
              <code className="font-mono text-[10px] text-[#1C1B18] dark:text-[#F4F2ED] truncate">
                Import &lt;filename.xlsx&gt; using QualCount-spreadsheet-to-workflow-mapper
              </code>
              <button
                type="button"
                onClick={handleCopyAgentSnippet}
                className="px-2 py-1 rounded text-[10px] font-semibold border border-[#BEB5A4] dark:border-[#4B5563] bg-white dark:bg-[#1E2228] hover:bg-slate-50 cursor-pointer shrink-0"
              >
                {copiedAgentSnippet ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Door 3: Web AI Conversion Prompt Bridge */}
          <div className="bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="font-serif text-xs font-bold text-[#1C1B18] dark:text-[#F4F2ED]">
                  Door 3: Zero-MCP Web AI Prompt Bridge
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyWebAiPrompt}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-[#0F6B38] text-[#0F6B38] dark:border-[#34D399] dark:text-[#34D399] bg-[#E6F4EC] dark:bg-[#064E3B] text-[11px] font-semibold hover:bg-emerald-100 cursor-pointer transition-colors"
              >
                {copiedPrompt ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedPrompt ? 'Prompt Copied!' : 'Copy Web AI Conversion Prompt'}
              </button>
            </div>
            <p className="text-[11px] text-[#5A554C] dark:text-[#9CA3AF] leading-relaxed">
              No local agent installed? Click above to copy a customized prompt embedding this workbook's target budget and organization names. Paste it into ChatGPT or Claude web with your raw spreadsheet, then drop the resulting CSV into Door 1.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

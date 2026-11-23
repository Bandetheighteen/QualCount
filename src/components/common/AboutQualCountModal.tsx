import React from 'react';
import { clsx } from 'clsx';
import { X, ShieldCheck, Cpu, Layers, HardDrive } from 'lucide-react';
import { QualCountLogo } from './QualCountLogo';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

interface AboutQualCountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutQualCountModal: React.FC<AboutQualCountModalProps> = ({ isOpen, onClose }) => {
  const theme = useWorkspaceStore((state) => state.theme);
  const isDark = theme === 'dark' || theme === 'night';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div
        className={clsx(
          'w-full max-w-lg rounded-sm border p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto',
          isDark ? 'bg-[#181B20] border-[#2D333B] text-[#F4F2ED]' : 'bg-[#FAF8F4] border-[#DDD6C8] text-[#1C1B18]'
        )}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={clsx(
            'absolute right-4 top-4 p-1.5 rounded-xs transition-colors',
            isDark ? 'text-[#8A8377] hover:text-[#FAF8F4] hover:bg-[#252A32]' : 'text-[#8A8377] hover:text-[#1C1B18] hover:bg-[#EAE6DF]'
          )}
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Master Circular Emblem */}
        <div className="flex flex-col items-center text-center mb-4">
          <QualCountLogo size={148} showText={true} className="drop-shadow-lg mb-2" />
          <h2 className="text-xl font-serif font-bold tracking-tight mt-1">QualCount</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-xs border border-[#B45309] text-[#B45309] bg-[#B45309]/10 font-medium">
              Version 2.0.0
            </span>
            <span className="text-[11px] font-mono text-[#8A8377]">Archival Release</span>
          </div>
          <p className={clsx('text-xs mt-2 max-w-sm', isDark ? 'text-[#A0AAB4]' : 'text-[#5A554C]')}>
            Visual Multiplex Partnership Management System · Objective Topological Progress & Public Choice Utility
          </p>
        </div>

        {/* Core Pillars */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-4">
          <div className={clsx('p-2.5 rounded-xs border flex items-start gap-2', isDark ? 'bg-[#1E2228] border-[#2D333B]' : 'bg-white border-[#DDD6C8]')}>
            <Layers className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[11px]">Multiplex Graph</div>
              <div className="text-[10px] text-[#8A8377] leading-tight">Financial, direct working, and yellow referral bridges</div>
            </div>
          </div>

          <div className={clsx('p-2.5 rounded-xs border flex items-start gap-2', isDark ? 'bg-[#1E2228] border-[#2D333B]' : 'bg-white border-[#DDD6C8]')}>
            <Cpu className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[11px]">Public Choice Utility</div>
              <div className="text-[10px] text-[#8A8377] leading-tight">Ratio-scale decision costs without arbitrary point scores</div>
            </div>
          </div>

          <div className={clsx('p-2.5 rounded-xs border flex items-start gap-2', isDark ? 'bg-[#1E2228] border-[#2D333B]' : 'bg-white border-[#DDD6C8]')}>
            <ShieldCheck className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[11px]">Two-Layer Risk Matrix</div>
              <div className="text-[10px] text-[#8A8377] leading-tight">Deterministic 6-parameter topological audit (R1–R6)</div>
            </div>
          </div>

          <div className={clsx('p-2.5 rounded-xs border flex items-start gap-2', isDark ? 'bg-[#1E2228] border-[#2D333B]' : 'bg-white border-[#DDD6C8]')}>
            <HardDrive className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[11px]">Offline-First Storage</div>
              <div className="text-[10px] text-[#8A8377] leading-tight">Portable Workspace Folders & local stdio MCP server</div>
            </div>
          </div>
        </div>

        {/* Specifications & Packaging */}
        <div className={clsx('p-3 rounded-xs border text-[11px] font-mono leading-relaxed mb-4', isDark ? 'bg-[#15181D] border-[#2D333B] text-[#8A8377]' : 'bg-[#F2EFE9] border-[#DDD6C8] text-[#5A554C]')}>
          <div>Target: Windows x64 Native Desktop Application (Tauri v2 + WebView2)</div>
          <div>Bundle: QualCount-Setup.exe (Single-File NSIS Installer)</div>
          <div>Standalone: QualCount.exe (Portable Release Binary)</div>
          <div>Engine Isolation: Pure TypeScript math & layout (Zero browser leakage)</div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xs bg-[#1C1B18] text-[#FAF8F4] text-xs font-medium hover:bg-[#2F2D29] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

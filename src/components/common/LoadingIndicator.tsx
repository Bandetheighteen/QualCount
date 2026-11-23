import React from 'react';
import { clsx } from 'clsx';
import { Network, BookOpen } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export interface LoadingIndicatorProps {
  message?: string;
  subMessage?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message,
  subMessage,
}) => {
  const isLoading = useWorkspaceStore((state) => state.isLoading);
  const storeLoadingMessage = useWorkspaceStore((state) => state.loadingMessage);
  const theme = useWorkspaceStore((state) => state.theme);
  const isDark = theme === 'dark' || theme === 'night';

  if (!isLoading && !message) return null;

  const displayMessage = message || storeLoadingMessage || 'Loading ledger dataset...';
  const displaySub = subMessage || 'Building multiplex network topology & computing bottom-to-top hierarchy...';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm select-none transition-all duration-200"
    >
      <div
        className={clsx(
          'relative w-[340px] max-w-[90vw] rounded-sm border p-6 shadow-2xl flex flex-col items-center text-center',
          isDark
            ? 'bg-[#181B20] border-[#2D333B] text-[#F4F2ED]'
            : 'bg-[#FAF8F4] border-[#DDD6C8] text-[#1C1B18]'
        )}
      >
        {/* Animated Network Building & Scrolling Book Graphic */}
        <div className="relative w-32 h-24 mb-4 flex items-center justify-center">
          {/* Subtle Archival Grid Backdrop */}
          <div className="absolute inset-0 rounded-xs border border-dashed border-[#B45309]/30 bg-[#B45309]/5 animate-pulse" />

          {/* SVG Animated Topology Network Assembly & Scrolling Ledger Book */}
          <svg className="w-full h-full" viewBox="0 0 130 96">
            <defs>
              <linearGradient id="bookCoverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#B45309" />
                <stop offset="100%" stopColor="#78350F" />
              </linearGradient>
            </defs>

            {/* Scrolling / Open Ledger Book Base */}
            <g transform="translate(18, 52)">
              {/* Left Page */}
              <path
                d="M5,22 Q24,18 45,20 L45,36 Q24,34 5,38 Z"
                fill={isDark ? '#1E2228' : '#FFFFFF'}
                stroke={isDark ? '#2D333B' : '#DDD6C8'}
                strokeWidth="1.2"
              />
              {/* Right Page */}
              <path
                d="M49,20 Q70,18 89,22 L89,38 Q70,34 49,36 Z"
                fill={isDark ? '#1E2228' : '#FFFFFF'}
                stroke={isDark ? '#2D333B' : '#DDD6C8'}
                strokeWidth="1.2"
              />
              {/* Center Spine */}
              <line x1="47" y1="19" x2="47" y2="37" stroke="#B45309" strokeWidth="1.5" />

              {/* Scrolling Text Lines on Pages */}
              <line x1="12" y1="25" x2="38" y2="25" stroke="#B45309" strokeWidth="1" strokeDasharray="3 2" className="animate-[dash_1s_linear_infinite]" opacity="0.6" />
              <line x1="12" y1="29" x2="34" y2="29" stroke="#8A8377" strokeWidth="1" strokeDasharray="2 2" className="animate-[dash_1.5s_linear_infinite]" opacity="0.5" />
              <line x1="12" y1="33" x2="36" y2="33" stroke="#0F6B38" strokeWidth="1" strokeDasharray="4 2" className="animate-[dash_1.2s_linear_infinite]" opacity="0.6" />

              <line x1="56" y1="25" x2="82" y2="25" stroke="#0F6B38" strokeWidth="1" strokeDasharray="4 2" className="animate-[dash_1.2s_linear_infinite]" opacity="0.6" />
              <line x1="56" y1="29" x2="78" y2="29" stroke="#8A8377" strokeWidth="1" strokeDasharray="3 1" className="animate-[dash_1.4s_linear_infinite]" opacity="0.5" />
              <line x1="56" y1="33" x2="80" y2="33" stroke="#B45309" strokeWidth="1" strokeDasharray="2 2" className="animate-[dash_1s_linear_infinite]" opacity="0.6" />
            </g>

            {/* Rising Network Branches Assembling Above Book */}
            <line
              x1="65"
              y1="56"
              x2="35"
              y2="32"
              stroke="#0F6B38"
              strokeWidth="2"
              strokeDasharray="4 2"
              className="animate-[dash_1.5s_linear_infinite]"
            />
            <line
              x1="65"
              y1="56"
              x2="95"
              y2="32"
              stroke={isDark ? '#F4F2ED' : '#1C1B18'}
              strokeWidth="1.8"
              strokeDasharray="6 3"
              className="animate-[dash_1.2s_linear_infinite]"
            />
            <line
              x1="35"
              y1="32"
              x2="65"
              y2="12"
              stroke="#B45309"
              strokeWidth="2"
              strokeDasharray="4 2"
              className="animate-[dash_1s_linear_infinite]"
            />
            <line
              x1="95"
              y1="32"
              x2="65"
              y2="12"
              stroke="#0F6B38"
              strokeWidth="2"
            />
            <line
              x1="35"
              y1="32"
              x2="95"
              y2="32"
              stroke="#B45309"
              strokeWidth="1.5"
              strokeDasharray="3 2"
            />

            {/* Pulsing Multiplex Nodes */}
            {/* Root Hub Node */}
            <circle cx="65" cy="56" r="6" fill="#B45309" className="animate-ping opacity-20" />
            <circle cx="65" cy="56" r="4.5" fill="#B45309" />

            {/* Lateral Partner Nodes */}
            <circle cx="35" cy="32" r="4" fill="#0F6B38" />
            <circle cx="95" cy="32" r="4" fill={isDark ? '#F4F2ED' : '#1C1B18'} />

            {/* Top Crown Apex Node */}
            <circle cx="65" cy="12" r="5" fill="#B45309" className="animate-pulse" />
          </svg>

          {/* Floating book / ledger badge */}
          <div
            className={clsx(
              'absolute -bottom-1 -right-1 p-1 rounded-xs border shadow-xs flex items-center gap-1',
              isDark ? 'bg-[#1E2228] border-[#2D333B] text-[#B45309]' : 'bg-white border-[#DDD6C8] text-[#B45309]'
            )}
            title="Archival Ledger Dataset"
          >
            <BookOpen className="w-3.5 h-3.5 animate-pulse" />
          </div>
        </div>

        {/* Status Typography */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <Network className="w-4 h-4 text-[#B45309] animate-spin" />
          <h4 className="text-sm font-serif font-bold tracking-tight">
            {displayMessage}
          </h4>
        </div>
        <p className="text-[11px] font-mono text-[#8A8377] leading-relaxed">
          {displaySub}
        </p>

        {/* Progress Bar Line */}
        <div className="w-full bg-[#DDD6C8]/40 dark:bg-[#2D333B] h-1 rounded-full mt-4 overflow-hidden">
          <div className="bg-[#B45309] h-full w-1/3 rounded-full animate-[progress_1.2s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
};

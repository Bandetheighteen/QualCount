import React from 'react';
import { AlertTriangle, Layers, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export interface RiskNotificationItem {
  id: string;
  type: 'triple-threat' | 'single-dependency';
  title: string;
  message: string;
  badge: string;
  colorBorder: string;
  colorBg: string;
  colorText: string;
  colorBadge: string;
  icon: React.ReactNode;
}

export const RiskNotifications: React.FC = () => {
  const metrics = useWorkspaceStore((state) => state.metrics);
  const dismissedNotificationIds = useWorkspaceStore((state) => state.dismissedNotificationIds);
  const dismissNotification = useWorkspaceStore((state) => state.dismissNotification);

  const notifications: RiskNotificationItem[] = [];

  // 1. Triple Threat Risk: Triple-Thread Triangulation & Multi-Bridge Convergence
  const multiThread = metrics?.multiThreadTargets;
  if (multiThread && (multiThread.tripleThreadCount > 0 || multiThread.quadPlusThreadCount > 0)) {
    const targets = multiThread.triplePlusNames.length > 0
      ? multiThread.triplePlusNames.join(', ')
      : `${multiThread.tripleThreadCount + multiThread.quadPlusThreadCount} partner nodes`;

    notifications.push({
      id: 'triple-threat-risk',
      type: 'triple-threat',
      title: 'Triple Threat Dependency Risk',
      message: `${targets} triangulated by 3+ yellow bridges. Multiple overlapping bridge lines create coordination bottlenecks.`,
      badge: 'Triple Threat (3T+)',
      colorBorder: 'border-l-amber-400 border-amber-500/40',
      colorBg: 'bg-slate-900/95 shadow-[0_0_15px_rgba(245,158,11,0.2)]',
      colorText: 'text-amber-200',
      colorBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: <Layers className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
    });
  }

  // 2. Too much dependency on single node: Bridge Concentration Risk
  const concentration = metrics?.bridgeConcentration;
  if (concentration && concentration.concentrationPct > 30 && concentration.bridgeEntityName) {
    notifications.push({
      id: 'single-node-dependency-risk',
      type: 'single-dependency',
      title: 'Single Node Dependency Risk',
      message: `Critical concentration on "${concentration.bridgeEntityName}" (${concentration.concentrationPct}% of indirect network). Failure will disconnect downstream partners.`,
      badge: `${concentration.concentrationPct}% Concentration`,
      colorBorder: 'border-l-rose-500 border-rose-500/40',
      colorBg: 'bg-slate-900/95 shadow-[0_0_15px_rgba(244,63,94,0.25)]',
      colorText: 'text-rose-200',
      colorBadge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      icon: <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
    });
  }

  // Filter out any dismissed notifications
  const activeNotifications = notifications.filter(
    (n) => !dismissedNotificationIds.includes(n.id)
  );

  if (activeNotifications.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Risk Alerts"
      className="flex flex-col gap-2 w-80 max-w-[360px] pointer-events-auto select-none"
    >
      {activeNotifications.map((n) => (
        <div
          key={n.id}
          className={clsx(
            'p-3 rounded-xl border border-l-4 backdrop-blur-md flex flex-col gap-1.5 transition-all animate-in fade-in slide-in-from-top-2 duration-200',
            n.colorBorder,
            n.colorBg
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {n.icon}
              <span className={clsx('font-bold text-xs truncate', n.colorText)}>
                {n.title}
              </span>
            </div>
            <button
              type="button"
              onClick={() => dismissNotification(n.id)}
              title="Dismiss notification"
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Description */}
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {n.message}
          </p>

          {/* Adjacent Tag Pill */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px]">
            <span className={clsx('px-1.5 py-0.5 rounded font-bold border', n.colorBadge)}>
              {n.badge}
            </span>
            <span className="text-slate-400 text-[10px]">Topology Risk Alert</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RiskNotifications;

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Building2, Check, Sparkles, Lock, ArrowDownRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { ManageSectorsModal } from './ManageSectorsModal';
import type { EntityCategory } from '../../types/schema';
import {
  searchCrossWorkbookEntities,
} from '../../engine/entityIndex';
import { loadRecentEntitiesIndex } from '../../storage';

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPosition?: { x: number; y: number };
}

export const AddNodeModal: React.FC<AddNodeModalProps> = ({
  isOpen,
  onClose,
  initialPosition,
}) => {
  const sectors = useWorkspaceStore((state) => state.sectors);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<EntityCategory>(sectors[0]?.id || 'csr');
  const [notes, setNotes] = useState('');
  const [internalLead, setInternalLead] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isManageSectorsOpen, setIsManageSectorsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const workspace = useWorkspaceStore((state) => state.workspace);
  const addNode = useWorkspaceStore((state) => state.addNode);
  const importEntityWithProvenBridges = useWorkspaceStore(
    (state) => state.importEntityWithProvenBridges
  );

  // Reset form whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setCategory(sectors[0]?.id || 'csr');
      setNotes('');
      setInternalLead('');
      setIsDropdownOpen(false);
      setIsManageSectorsOpen(false);
    }
  }, [isOpen, sectors]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close dropdown on click outside autocomplete container
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  // Autocomplete matching against existing entities in workspace
  const matchingEntities = useMemo(() => {
    if (!workspace || !name.trim()) return [];
    const query = name.trim().toLowerCase();
    return Object.values(workspace.entities).filter((e) =>
      e.name.toLowerCase().includes(query)
    );
  }, [workspace, name]);

  const crossWorkbookMatches = useMemo(() => {
    if (!workspace || name.trim().length < 3) return [];
    const recent = loadRecentEntitiesIndex();
    return searchCrossWorkbookEntities(
      name,
      workspace.entities,
      recent,
      workspace.workbooks,
      workspace.branches,
      workspace.placements
    );
  }, [workspace, name]);

  const exactMatch = useMemo(() => {
    if (!workspace || !name.trim()) return null;
    const query = name.trim().toLowerCase();
    return (
      Object.values(workspace.entities).find(
        (e) => e.name.trim().toLowerCase() === query
      ) ?? null
    );
  }, [workspace, name]);

  // Synchronize and lock category if exact match exists
  useEffect(() => {
    if (exactMatch) {
      setCategory(exactMatch.category);
    }
  }, [exactMatch]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await addNode(
      name.trim(),
      category,
      notes.trim() || undefined,
      initialPosition,
      internalLead.trim() || undefined
    );
    setName('');
    setCategory('csr');
    setNotes('');
    setInternalLead('');
    setIsDropdownOpen(false);
    onClose();
  };

  const handleSelectExisting = (entityName: string, entityCategory: EntityCategory) => {
    setName(entityName);
    setCategory(entityCategory);
    setIsDropdownOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-partner-title"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-opacity duration-150"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-sky-400" />
            <h3 id="add-partner-title" className="text-base font-semibold text-slate-100">
              Add Partner Organization
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Organization Name Input with Live Deduplication Autocomplete */}
          <div ref={containerRef} className="relative flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="org-name-input" className="font-medium text-slate-300">
                Organization Name
              </label>
              {exactMatch ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3" />
                  Existing Partner (Reusing ID)
                </span>
              ) : name.trim() ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  New Partner
                </span>
              ) : null}
            </div>

            <input
              id="org-name-input"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="e.g. City Museum, Tata Trust, Ministry..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />

            {/* Autocomplete & Cross-Workbook Detection Dropdown */}
            {isDropdownOpen && (crossWorkbookMatches.length > 0 || matchingEntities.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-700/50">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between bg-slate-850">
                  <span>Cross-Project Entity Detection</span>
                  {crossWorkbookMatches.length > 0 && (
                    <span className="text-amber-400 font-mono text-[9px]">
                      {crossWorkbookMatches.length} Found
                    </span>
                  )}
                </div>

                {crossWorkbookMatches.length > 0
                  ? crossWorkbookMatches.map((res) => (
                      <div
                        key={res.entityId}
                        className="p-2.5 hover:bg-slate-750 transition-colors flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-semibold text-xs text-slate-100">{res.name}</span>
                            <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-slate-700 text-slate-300">
                              {res.category}
                            </span>
                          </div>
                          <span
                            className={clsx(
                              'text-[9px] font-mono px-1.5 py-0.5 rounded border',
                              res.source === 'current_workspace'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            )}
                          >
                            {res.source === 'current_workspace'
                              ? '[This Workspace]'
                              : `[From: ${res.workspaceName || 'External'}]`}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 font-sans">
                          {res.historySummary}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              setIsDropdownOpen(false);
                              await importEntityWithProvenBridges(res, false);
                              onClose();
                            }}
                            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-medium transition-colors"
                          >
                            {res.source === 'external_workspace' ? 'Import Entity' : 'Place Existing Partner'}
                          </button>

                          {res.targetYellowLeads.length > 0 && (
                            <button
                              type="button"
                              onClick={async () => {
                                setIsDropdownOpen(false);
                                await importEntityWithProvenBridges(res, true);
                                onClose();
                              }}
                              className="px-2 py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-200 text-[10px] font-medium transition-colors flex items-center gap-1"
                              title="Import this entity and pull all confirmed referral leads as dashed pending branches"
                            >
                              <ArrowDownRight className="w-3 h-3 text-amber-400" />
                              <span>Import + {res.targetYellowLeads.length} Pending Leads</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  : matchingEntities.map((entity) => (
                      <button
                        key={entity.entityId}
                        type="button"
                        onClick={() => handleSelectExisting(entity.name, entity.category)}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700/80 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span className="font-medium">{entity.name}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">
                          {entity.category}
                        </span>
                      </button>
                    ))}
              </div>
            )}
          </div>

          {/* Sector Category */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-300">
              <label htmlFor="org-category-select">Sector Category</label>
              <div className="flex items-center gap-2">
                {exactMatch && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-300">
                    <Lock className="w-3 h-3" />
                    Locked to existing partner
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsManageSectorsOpen(true)}
                  className="text-[11px] text-sky-400 hover:text-sky-300 underline cursor-pointer"
                >
                  + Add / Manage Sectors
                </button>
              </div>
            </div>
            <select
              id="org-category-select"
              value={category}
              disabled={Boolean(exactMatch)}
              onChange={(e) => setCategory(e.target.value as EntityCategory)}
              className={clsx(
                'w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-500',
                exactMatch && 'opacity-60 cursor-not-allowed bg-slate-900'
              )}
            >
              {sectors.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Responsible Person / Team From Our Side (Internal Lead) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-300">
              <label htmlFor="org-internal-lead-input">Responsible Person / Team (From Our Side)</label>
              <span className="text-[10px] text-slate-400">Internal Lead</span>
            </div>
            <input
              id="org-internal-lead-input"
              type="text"
              value={internalLead}
              onChange={(e) => setInternalLead(e.target.value)}
              placeholder="e.g. Sarah / Outreach Team"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Global Notes (Optional) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="org-notes-input" className="text-xs font-medium text-slate-300">
              Global Notes (Optional)
            </label>
            <textarea
              id="org-notes-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key contact person, historical context, or partnership notes..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className={clsx(
                'px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-md',
                name.trim()
                  ? 'bg-sky-600 text-white hover:bg-sky-500 shadow-sky-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              )}
            >
              Add to Workbook
            </button>
          </div>
        </form>
      </div>

      <ManageSectorsModal
        isOpen={isManageSectorsOpen}
        onClose={() => setIsManageSectorsOpen(false)}
      />
    </div>
  );
};

export default AddNodeModal;

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Building2, User, X, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export interface SearchMatch {
  placementId: string;
  entityId: string;
  nodeName: string;
  category: string;
  categoryLabel: string;
  isRootNgo: boolean;
  matchType: 'title' | 'contact' | 'lead' | 'category' | 'notes';
  matchedDetail: string;
  contactPerson?: {
    name: string;
    designation: string;
    phone?: string;
    email?: string;
  };
}

export interface WorkbookSearchBarProps {
  variant?: 'menubar' | 'toolbar' | 'standalone';
  autoFocus?: boolean;
  onClose?: () => void;
  className?: string;
  dropdownPlacement?: 'top' | 'bottom';
  dropdownAlign?: 'left' | 'right';
}

export const WorkbookSearchBar: React.FC<WorkbookSearchBarProps> = ({
  variant = 'menubar',
  autoFocus = false,
  onClose,
  className,
  dropdownPlacement = 'bottom',
  dropdownAlign = 'left',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);

  const workspace = useWorkspaceStore((state) => state.workspace);
  const activeWorkbookId = useWorkspaceStore((state) => state.activeWorkbookId);
  const selectPlacement = useWorkspaceStore((state) => state.selectPlacement);
  const setFlashingPlacement = useWorkspaceStore((state) => state.setFlashingPlacement);
  const openSearch = useWorkspaceStore((state) => state.openSearch);
  const searchFocusTrigger = useWorkspaceStore((state) => state.searchFocusTrigger);
  const sectors = useWorkspaceStore((state) => state.sectors);
  const theme = useWorkspaceStore((state) => state.theme);
  const isDark = theme === 'dark' || theme === 'night';

  const isToolbar = variant === 'toolbar';

  // Listen for Ctrl+F / Cmd+F to open and focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault();
        openSearch();
        setIsOpen(true);
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 30);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSearch]);

  // Focus whenever store signals focus trigger or autoFocus is set
  useEffect(() => {
    if (searchFocusTrigger > 0 || autoFocus) {
      setIsOpen(true);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 40);
    }
  }, [searchFocusTrigger, autoFocus]);

  // Scroll selected item into view when navigating via arrow keys
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        if (isToolbar) {
          onClose?.();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isToolbar, onClose]);

  // Total active placements in this workbook
  const activePlacements = useMemo(() => {
    if (!workspace || !activeWorkbookId) return [];
    return Object.values(workspace.placements).filter(
      (p) => p.workbookId === activeWorkbookId || (!p.workbookId && activeWorkbookId === workspace.activeWorkbookId)
    );
  }, [workspace, activeWorkbookId]);

  // Compute live search matches across nodes and contacts instantaneously (100-200+ nodes)
  const matches = useMemo<SearchMatch[]>(() => {
    if (!workspace || !activeWorkbookId || activePlacements.length === 0) return [];
    const q = query.toLowerCase().trim();

    // If query is empty and dropdown is open, list all nodes in the workbook (root first, then alphabetical)
    if (!q) {
      const all: SearchMatch[] = [];
      for (const p of activePlacements) {
        const ent = workspace.entities[p.entityId];
        if (!ent) continue;
        const nodeName = ent.name || 'Unnamed Organization';
        const sector = sectors.find((s) => s.id === ent.category);
        const categoryLabel = sector?.label || ent.category || 'other';

        all.push({
          placementId: p.placementId,
          entityId: ent.entityId,
          nodeName,
          category: ent.category || 'other',
          categoryLabel,
          isRootNgo: Boolean(p.isRootNgo),
          matchType: 'title',
          matchedDetail: nodeName,
          contactPerson: ent.pointsOfContact && ent.pointsOfContact.length > 0 ? ent.pointsOfContact[0] : undefined,
        });
      }
      return all.sort((a, b) => {
        if (a.isRootNgo && !b.isRootNgo) return -1;
        if (!a.isRootNgo && b.isRootNgo) return 1;
        return a.nodeName.localeCompare(b.nodeName);
      });
    }

    const titleMatches: SearchMatch[] = [];
    const contactMatches: SearchMatch[] = [];
    const otherMatches: SearchMatch[] = [];

    for (const p of activePlacements) {
      const ent = workspace.entities[p.entityId];
      if (!ent) continue;

      const nodeName = ent.name || 'Unnamed Organization';
      const sector = sectors.find((s) => s.id === ent.category);
      const categoryLabel = sector?.label || ent.category || 'other';

      const matchesTitle = nodeName.toLowerCase().includes(q);
      const matchesCategory =
        (ent.category && ent.category.toLowerCase().includes(q)) ||
        categoryLabel.toLowerCase().includes(q);

      // Match Associated Points of Contact
      const matchedContacts: any[] = [];
      if (ent.pointsOfContact && ent.pointsOfContact.length > 0) {
        for (const poc of ent.pointsOfContact) {
          const matchName = poc.name && poc.name.toLowerCase().includes(q);
          const matchDesig = poc.designation && poc.designation.toLowerCase().includes(q);
          const matchEmail = poc.email && poc.email.toLowerCase().includes(q);
          const matchPhone = poc.phone && poc.phone.includes(q);

          if (matchName || matchDesig || matchEmail || matchPhone) {
            matchedContacts.push(poc);
          }
        }
      }

      const matchesLead = Boolean(ent.internalLead && ent.internalLead.toLowerCase().includes(q));
      const matchesNotes = Boolean(ent.globalNotes && ent.globalNotes.toLowerCase().includes(q));

      const primaryContact =
        matchedContacts.length > 0
          ? matchedContacts[0]
          : ent.pointsOfContact && ent.pointsOfContact.length > 0
          ? ent.pointsOfContact[0]
          : undefined;

      // 1. Title match
      if (matchesTitle) {
        titleMatches.push({
          placementId: p.placementId,
          entityId: ent.entityId,
          nodeName,
          category: ent.category || 'other',
          categoryLabel,
          isRootNgo: Boolean(p.isRootNgo),
          matchType: 'title',
          matchedDetail: nodeName,
          contactPerson: primaryContact,
        });
        continue;
      }

      // 2. Contact match
      if (matchedContacts.length > 0) {
        const firstPoc = matchedContacts[0];
        contactMatches.push({
          placementId: p.placementId,
          entityId: ent.entityId,
          nodeName,
          category: ent.category || 'other',
          categoryLabel,
          isRootNgo: Boolean(p.isRootNgo),
          matchType: 'contact',
          matchedDetail: `${firstPoc.name}${firstPoc.designation ? ` · ${firstPoc.designation}` : ''}`,
          contactPerson: {
            name: firstPoc.name,
            designation: firstPoc.designation,
            phone: firstPoc.phone,
            email: firstPoc.email,
          },
        });
        continue;
      }

      // 3. Category match
      if (matchesCategory) {
        otherMatches.push({
          placementId: p.placementId,
          entityId: ent.entityId,
          nodeName,
          category: ent.category || 'other',
          categoryLabel,
          isRootNgo: Boolean(p.isRootNgo),
          matchType: 'category',
          matchedDetail: `Category: ${categoryLabel}`,
          contactPerson: primaryContact,
        });
        continue;
      }

      // 4. Internal lead match
      if (matchesLead && ent.internalLead) {
        otherMatches.push({
          placementId: p.placementId,
          entityId: ent.entityId,
          nodeName,
          category: ent.category || 'other',
          categoryLabel,
          isRootNgo: Boolean(p.isRootNgo),
          matchType: 'lead',
          matchedDetail: `Internal Lead: ${ent.internalLead}`,
          contactPerson: primaryContact,
        });
        continue;
      }

      // 5. Notes match
      if (matchesNotes && ent.globalNotes) {
        otherMatches.push({
          placementId: p.placementId,
          entityId: ent.entityId,
          nodeName,
          category: ent.category || 'other',
          categoryLabel,
          isRootNgo: Boolean(p.isRootNgo),
          matchType: 'notes',
          matchedDetail: ent.globalNotes.length > 50 ? `${ent.globalNotes.slice(0, 50)}...` : ent.globalNotes,
          contactPerson: primaryContact,
        });
      }
    }

    return [...titleMatches, ...contactMatches, ...otherMatches];
  }, [workspace, activeWorkbookId, activePlacements, sectors, query]);

  // Navigate to and select a matched node with smooth animation & beacon flash
  const handleSelectMatch = (match: SearchMatch) => {
    // If active filters hide the matched node, clear filters so it is visible
    const filters = useWorkspaceStore.getState().filters;
    const isFilterActive =
      filters.branchTypes.length < 3 ||
      filters.branchStatuses.length < 3 ||
      filters.minFundingPct > 0 ||
      filters.nodeCategories.length > 0 ||
      filters.connectionFilter !== 'all' ||
      Boolean(filters.connectedToPlacementIds && filters.connectedToPlacementIds.length > 0);

    const currentNodes = useWorkspaceStore.getState().nodes;
    const isNodeInCurrentCanvas = currentNodes.some((n) => n.id === match.placementId);
    if (!isNodeInCurrentCanvas && isFilterActive) {
      useWorkspaceStore.getState().resetFilters();
    }

    selectPlacement(match.placementId);
    setFlashingPlacement(match.placementId);

    const flow = useWorkspaceStore.getState().flowInstance;
    const refreshedNodes = useWorkspaceStore.getState().nodes;
    const targetNode = refreshedNodes.find((n) => n.id === match.placementId);
    const plc = workspace?.placements[match.placementId];

    if (flow) {
      const posX = targetNode?.position?.x ?? plc?.x ?? 400;
      const posY = targetNode?.position?.y ?? plc?.y ?? 300;
      const nodeW = targetNode?.measured?.width ?? plc?.width ?? 190;
      const nodeH = targetNode?.measured?.height ?? plc?.height ?? 76;

      flow.setCenter(posX + nodeW / 2, posY + nodeH / 2, {
        zoom: 1.25,
        duration: 600,
      });
    }

    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  };

  // Keyboard navigation within dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (matches.length > 0 ? (prev + 1) % matches.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (matches.length > 0 ? (prev - 1 + matches.length) % matches.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matches.length > 0 && matches[selectedIndex]) {
        handleSelectMatch(matches[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
      if (onClose) {
        onClose();
      }
    }
  };

  const placeholderText =
    activePlacements.length > 0
      ? `Search ${activePlacements.length} nodes & contacts... (Ctrl+F)`
      : 'Search node or contact... (Ctrl+F)';

  return (
    <div className={clsx('relative flex items-center', className)}>
      {/* Search Input Box */}
      <div
        className={clsx(
          'relative flex items-center transition-all font-sans',
          isToolbar
            ? clsx(
                'h-8 px-2 rounded-lg border shadow-sm',
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-200 focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400/40'
                  : 'bg-slate-100 border-black text-black focus-within:border-amber-600 focus-within:ring-1 focus-within:ring-amber-500/40'
              )
            : clsx(
                'rounded-xs border',
                isDark
                  ? 'bg-[#181B20] border-[#2D333B] focus-within:border-[#B45309]'
                  : 'bg-[#FAF8F4] border-[#DDD6C8] focus-within:border-[#B45309]'
              ),
          isOpen && matches.length > 0 && dropdownPlacement === 'bottom' ? 'rounded-b-none' : '',
          isOpen && matches.length > 0 && dropdownPlacement === 'top' ? 'rounded-t-none' : ''
        )}
      >
        <Search className="w-3.5 h-3.5 ml-1 text-[#8A8377] shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          className={clsx(
            'px-2 py-0.5 text-xs bg-transparent outline-none truncate',
            isToolbar ? 'w-52 sm:w-64 md:w-72' : 'w-48 md:w-64',
            isDark ? 'text-[#F4F2ED] placeholder-[#8A8377]' : 'text-[#1C1B18] placeholder-[#8A8377]'
          )}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(true);
              inputRef.current?.focus();
            }}
            className="p-1 text-[#8A8377] hover:text-[#1C1B18] dark:hover:text-[#F4F2ED] cursor-pointer"
            title="Clear search query"
          >
            <X className="w-3 h-3" />
          </button>
        ) : (
          <span className="text-[10px] font-mono text-[#8A8377] mr-1 hidden sm:inline">Ctrl+F</span>
        )}

        {isToolbar && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 ml-0.5 text-[#8A8377] hover:text-[#1C1B18] dark:hover:text-[#F4F2ED] cursor-pointer border-l border-slate-300 dark:border-slate-700"
            title="Close search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Live Results Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={clsx(
            'absolute z-50 w-80 md:w-96 max-h-80 overflow-y-auto border shadow-2xl divide-y font-sans animate-in fade-in zoom-in-95 duration-100',
            dropdownAlign === 'right' ? 'right-0' : 'left-0',
            dropdownPlacement === 'top'
              ? 'bottom-full mb-1 rounded-t-lg'
              : 'top-full mt-1 rounded-b-lg',
            isDark
              ? 'bg-[#181B20] border-[#2D333B] divide-[#2D333B]'
              : 'bg-[#FFFFFF] border-[#DDD6C8] divide-[#DDD6C8]/60 shadow-slate-900/15'
          )}
        >
          {matches.length === 0 ? (
            <div className="p-3 text-center text-xs text-[#8A8377]">
              {query.trim()
                ? `No nodes or contacts matching "${query}"`
                : 'No organizations in current workbook'}
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#8A8377] bg-black/5 dark:bg-white/5 flex items-center justify-between sticky top-0 backdrop-blur-md z-10">
                <span>
                  {query.trim()
                    ? `Matching Nodes & Contacts (${matches.length})`
                    : `All Workbook Nodes (${matches.length})`}
                </span>
                <span className="lowercase font-sans text-[11px] opacity-80">↑↓ navigate · enter select</span>
              </div>
              {matches.map((match, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${match.placementId}-${idx}`}
                    ref={isSelected ? selectedItemRef : null}
                    type="button"
                    onClick={() => handleSelectMatch(match)}
                    className={clsx(
                      'w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer',
                      isSelected
                        ? isDark
                          ? 'bg-[#252A32] text-white border-l-2 border-l-amber-400'
                          : 'bg-[#F2EFE9] text-black font-medium border-l-2 border-l-[#B45309]'
                        : isDark
                        ? 'hover:bg-[#1E2228] text-slate-200'
                        : 'hover:bg-[#FAF8F4] text-[#1C1B18]'
                    )}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {match.matchType === 'contact' ? (
                        <User className="w-3.5 h-3.5 mt-0.5 text-[#B45309] dark:text-amber-400 shrink-0" />
                      ) : (
                        <Building2 className="w-3.5 h-3.5 mt-0.5 text-sky-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold truncate">{match.nodeName}</span>
                          {match.isRootNgo && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-500 dark:text-amber-300 font-mono font-bold uppercase border border-amber-500/40">
                              Root
                            </span>
                          )}
                          <span
                            className={clsx(
                              'text-[9px] px-1 py-0.2 rounded font-mono uppercase border',
                              isDark
                                ? 'bg-slate-800 text-slate-300 border-slate-700'
                                : 'bg-[#EDE8DE] text-[#5A554C] border-[#DDD6C8]'
                            )}
                          >
                            {match.categoryLabel || match.category}
                          </span>
                        </div>

                        {/* Point of Contact Details (Name, Designation, Email) */}
                        {match.contactPerson && (
                          <div className="text-[11px] text-[#B45309] dark:text-amber-400 flex items-center gap-1.5 mt-0.5 truncate">
                            <span className="font-medium">
                              {match.matchType === 'contact' ? 'Contact:' : 'POC:'} {match.contactPerson.name}
                            </span>
                            {match.contactPerson.designation && (
                              <span className="text-[#8A8377] dark:text-[#9CA3AF] text-[10px]">
                                ({match.contactPerson.designation})
                              </span>
                            )}
                            {match.contactPerson.email && (
                              <span className="text-[#8A8377] dark:text-[#9CA3AF] font-mono text-[10px] hidden sm:inline">
                                · {match.contactPerson.email}
                              </span>
                            )}
                          </div>
                        )}

                        {match.matchType === 'lead' && (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                            {match.matchedDetail}
                          </div>
                        )}

                        {match.matchType === 'notes' && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 italic mt-0.5 truncate">
                            {match.matchedDetail}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#8A8377] shrink-0" />
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};

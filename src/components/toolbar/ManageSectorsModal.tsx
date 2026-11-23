import React, { useState, useEffect, useRef } from 'react';
import { X, Layers, Plus, Edit2, Trash2, Check, RotateCcw } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

interface ManageSectorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageSectorsModal: React.FC<ManageSectorsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const sectors = useWorkspaceStore((state) => state.sectors);
  const addSector = useWorkspaceStore((state) => state.addSector);
  const updateSector = useWorkspaceStore((state) => state.updateSector);
  const deleteSector = useWorkspaceStore((state) => state.deleteSector);
  const resetSectors = useWorkspaceStore((state) => state.resetSectors);

  const [newSectorName, setNewSectorName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const newSectorInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setNewSectorName('');
      setEditingId(null);
      setEditingLabel('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (editingId) {
          setEditingId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingId, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleAddSector = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newSectorName.trim();
    if (!trimmed) {
      setErrorMsg('Sector name cannot be empty.');
      return;
    }
    addSector(trimmed);
    setNewSectorName('');
    setErrorMsg(null);
    newSectorInputRef.current?.focus();
  };

  const handleStartEdit = (id: string, currentLabel: string) => {
    setEditingId(id);
    setEditingLabel(currentLabel);
    setErrorMsg(null);
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editingLabel.trim();
    if (!trimmed) {
      setErrorMsg('Sector name cannot be empty.');
      return;
    }
    await updateSector(id, trimmed);
    setEditingId(null);
    setEditingLabel('');
    setErrorMsg(null);
  };

  const handleDelete = async (id: string) => {
    await deleteSector(id);
    if (editingId === id) {
      setEditingId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-sectors-title"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-opacity duration-150 select-none"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h3 id="manage-sectors-title" className="text-base font-semibold text-slate-100">
              Manage Sector Categories
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

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Description */}
          <p className="text-xs text-slate-400 leading-relaxed">
            Create custom sector categories or rename and organize existing ones. Custom sectors appear across all partner creation forms, filters, and node cards.
          </p>

          {/* Add New Sector Form */}
          <form onSubmit={handleAddSector} className="flex gap-2 items-center">
            <input
              ref={newSectorInputRef}
              type="text"
              value={newSectorName}
              onChange={(e) => {
                setNewSectorName(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="Enter new sector name..."
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-400/50 shadow-md transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Sector</span>
            </button>
          </form>

          {errorMsg && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Sector List */}
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-800">
              <span>Existing Sectors ({sectors.length})</span>
              <button
                type="button"
                onClick={resetSectors}
                title="Reset to default categories"
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-amber-400 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Defaults</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {sectors.map((sector) => {
                const isEditing = editingId === sector.id;

                if (isEditing) {
                  return (
                    <div
                      key={sector.id}
                      className="flex items-center gap-2 p-1.5 bg-slate-950 border border-indigo-500/60 rounded-lg"
                    >
                      <input
                        type="text"
                        value={editingLabel}
                        autoFocus
                        onChange={(e) => setEditingLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEdit(sector.id);
                          }
                        }}
                        className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 focus:outline-none focus:border-indigo-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(sector.id)}
                        title="Save Changes"
                        className="p-1 rounded bg-emerald-600/30 hover:bg-emerald-600/60 text-emerald-300 border border-emerald-500/50 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        title="Cancel"
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={sector.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-200 font-medium">{sector.label}</span>
                      <span className="text-[10px] text-slate-500 font-mono">({sector.id})</span>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(sector.id, sector.label)}
                        title="Edit / Rename Sector"
                        className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(sector.id)}
                        title="Delete Sector"
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-800/20 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageSectorsModal;
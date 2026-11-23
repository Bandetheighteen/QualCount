import React, { useEffect } from 'react';
import {
  X,
  Keyboard,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'Canvas Navigation' | 'Selection & Isolation' | 'History & Editing' | 'Workbook & Connectivity';
}

const SHORTCUTS: ShortcutItem[] = [
  // Navigation
  {
    keys: ['Space', 'Drag'],
    description: 'Temporary Hand pan tool (click and drag to move canvas)',
    category: 'Canvas Navigation',
  },
  {
    keys: ['H'],
    description: 'Switch between Hand pan tool and Pointer tool',
    category: 'Canvas Navigation',
  },
  {
    keys: ['V'],
    description: 'Select standard Pointer interaction tool',
    category: 'Canvas Navigation',
  },
  {
    keys: ['+'],
    description: 'Zoom in canvas viewport',
    category: 'Canvas Navigation',
  },
  {
    keys: ['-'],
    description: 'Zoom out canvas viewport',
    category: 'Canvas Navigation',
  },
  {
    keys: ['F'],
    description: 'Fit all nodes and branches to screen view',
    category: 'Canvas Navigation',
  },

  // Selection & Isolation
  {
    keys: ['Ctrl', 'A'],
    description: 'Select all currently visible organization cards and branches',
    category: 'Selection & Isolation',
  },
  {
    keys: ['N', 'Drag'],
    description: 'Box select nodes only (ignores branches in marquee)',
    category: 'Selection & Isolation',
  },
  {
    keys: ['B', 'Drag'],
    description: 'Box select branches only (ignores nodes in marquee)',
    category: 'Selection & Isolation',
  },
  {
    keys: ['B', 'Click Node'],
    description: 'Hold B and click nodes to multi-select and move them collectively',
    category: 'Selection & Isolation',
  },
  {
    keys: ['Double Click Node'],
    description: 'Enter Illustrator-style isolation mode for node and direct neighbors',
    category: 'Selection & Isolation',
  },
  {
    keys: ['Double Click Branch'],
    description: 'Enter isolation mode for branch with quick origin/target reroute dropdowns',
    category: 'Selection & Isolation',
  },
  {
    keys: ['Escape'],
    description: 'Exit isolation mode or deselect all items',
    category: 'Selection & Isolation',
  },

  // History & Editing
  {
    keys: ['Ctrl', 'Z'],
    description: 'Undo last change (creation, movement, status change, deletion)',
    category: 'History & Editing',
  },
  {
    keys: ['Ctrl', 'Y'],
    description: 'Redo last undone change (also Ctrl+Shift+Z)',
    category: 'History & Editing',
  },
  {
    keys: ['Delete'],
    description: 'Delete selected node(s) or branch(es) (also Backspace)',
    category: 'History & Editing',
  },
  {
    keys: ['Right Click'],
    description: 'Open context menu for Node, Branch, Multiple Selection, or Canvas',
    category: 'History & Editing',
  },

  // Workbook & Connectivity
  {
    keys: ['T'],
    description: 'Tidy up layout with bottom-to-top hierarchical alignment',
    category: 'Workbook & Connectivity',
  },
  {
    keys: ['L'],
    description: 'Toggle workbook edit lock on or off',
    category: 'Workbook & Connectivity',
  },
  {
    keys: ['Handle Drag'],
    description: 'Drag from node handle to another node to connect a multiplex branch',
    category: 'Workbook & Connectivity',
  },
  {
    keys: ['Double Click Lock'],
    description: 'Lock entire workbook (single click locks selected card or branch)',
    category: 'Workbook & Connectivity',
  },
  {
    keys: ['Fullscreen'],
    description: 'Toggle full screen canvas presentation mode',
    category: 'Workbook & Connectivity',
  },
  {
    keys: ['?'],
    description: 'Open this Keyboard Shortcuts & Keybindings dialog',
    category: 'Workbook & Connectivity',
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const theme = useWorkspaceStore((state) => state.theme);
  const isLight = theme === 'light';

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm select-none p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={clsx(
          'w-full max-w-2xl border rounded-2xl shadow-2xl p-5 flex flex-col gap-4 text-xs max-h-[85vh] overflow-hidden transition-colors',
          isLight
            ? 'bg-white border-2 border-black text-black shadow-slate-900/20'
            : 'bg-slate-900 border-slate-700/80 text-slate-200'
        )}
      >
        {/* Header */}
        <div
          className={clsx(
            'flex items-center justify-between border-b pb-3',
            isLight ? 'border-black' : 'border-slate-800'
          )}
        >
          <div className="flex items-center gap-2">
            <Keyboard className={clsx('w-5 h-5', isLight ? 'text-black' : 'text-sky-400')} />
            <div>
              <h2 id="shortcuts-modal-title" className="text-sm font-bold">
                Keyboard Shortcuts & Keybindings
              </h2>
              <p className={clsx('text-[11px]', isLight ? 'text-black font-medium' : 'text-slate-400')}>
                QualCount navigation, spatial selection, and editing controls
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts modal"
            className={clsx(
              'p-1.5 rounded-lg transition-colors cursor-pointer',
              isLight
                ? 'text-black hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts list by category */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin">
          {categories.map((cat) => (
            <div key={cat} className="flex flex-col gap-1.5">
              <span
                className={clsx(
                  'font-bold text-[11px] uppercase tracking-wider',
                  isLight ? 'text-black' : 'text-slate-400'
                )}
              >
                {cat}
              </span>
              <div
                className={clsx(
                  'rounded-xl border divide-y overflow-hidden',
                  isLight
                    ? 'bg-slate-50 border-2 border-black divide-black/20'
                    : 'bg-slate-950/60 border-slate-800 divide-slate-800/80'
                )}
              >
                {SHORTCUTS.filter((s) => s.category === cat).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 gap-3"
                  >
                    <span className={clsx('text-xs', isLight ? 'text-black font-medium' : 'text-slate-300')}>
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <React.Fragment key={kIdx}>
                          <kbd
                            className={clsx(
                              'px-2 py-0.5 rounded text-[11px] font-mono font-bold shadow-sm border',
                              isLight
                                ? 'bg-white border-black text-black'
                                : 'bg-slate-800 border-slate-700 text-slate-200'
                            )}
                          >
                            {k}
                          </kbd>
                          {kIdx < item.keys.length - 1 && (
                            <span className={clsx('text-[10px]', isLight ? 'text-black font-bold' : 'text-slate-400')}>+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div
          className={clsx(
            'flex items-center justify-between pt-3 border-t text-[11px]',
            isLight ? 'border-black text-black font-medium' : 'border-slate-800 text-slate-400'
          )}
        >
          <span>Press <kbd className="px-1.5 py-0.5 rounded border border-current text-[10px] font-mono font-bold">Esc</kbd> anytime to close dialog</span>
          <button
            type="button"
            onClick={onClose}
            className={clsx(
              'px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
              isLight
                ? 'bg-black text-white hover:bg-slate-800'
                : 'bg-sky-600 hover:bg-sky-500 text-white'
            )}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;

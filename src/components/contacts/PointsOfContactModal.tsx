import React, { useState } from 'react';
import {
  X,
  User,
  Users,
  Phone,
  Mail,
  Briefcase,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Check,
  Building,
  ShieldCheck,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import type { PointOfContact } from '../../types/schema';

export interface PointsOfContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string | null;
}

export const PointsOfContactModal: React.FC<PointsOfContactModalProps> = ({
  isOpen,
  onClose,
  entityId,
}) => {
  const storeWorkspace = useWorkspaceStore((state) => state.workspace);
  const workspace = useWorkspaceStore.getState().workspace ?? storeWorkspace;
  const updateEntity = useWorkspaceStore((state) => state.updateEntity);
  const theme = useWorkspaceStore((state) => state.theme);
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<'all' | 'partner' | 'internal'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formHabit, setFormHabit] = useState('');
  const [formIsInternal, setFormIsInternal] = useState(false);

  if (!isOpen || !entityId || !workspace) return null;

  const entity = workspace.entities[entityId];
  if (!entity) return null;

  const contacts: PointOfContact[] = entity.pointsOfContact || [];

  const filteredContacts = contacts.filter((c) => {
    if (activeTab === 'internal') return Boolean(c.isInternal);
    if (activeTab === 'partner') return !c.isInternal;
    return true;
  });

  const resetForm = () => {
    setFormName('');
    setFormDesignation('');
    setFormPhone('');
    setFormEmail('');
    setFormDescription('');
    setFormHabit('');
    setFormIsInternal(false);
    setEditingId(null);
    setIsAddingNew(false);
  };

  const handleStartEdit = (contact: PointOfContact) => {
    setEditingId(contact.id);
    setIsAddingNew(false);
    setFormName(contact.name);
    setFormDesignation(contact.designation || '');
    setFormPhone(contact.phone || '');
    setFormEmail(contact.email || '');
    setFormDescription(contact.description || '');
    setFormHabit(contact.habitOrPeculiarity || '');
    setFormIsInternal(Boolean(contact.isInternal));
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    let updatedList: PointOfContact[] = [];

    if (editingId) {
      updatedList = contacts.map((c) =>
        c.id === editingId
          ? {
              ...c,
              name: formName.trim(),
              designation: formDesignation.trim(),
              phone: formPhone.trim(),
              email: formEmail.trim(),
              description: formDescription.trim(),
              habitOrPeculiarity: formHabit.trim(),
              isInternal: formIsInternal,
            }
          : c
      );
    } else {
      const newContact: PointOfContact = {
        id: 'poc-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36),
        name: formName.trim(),
        designation: formDesignation.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        description: formDescription.trim(),
        habitOrPeculiarity: formHabit.trim(),
        isInternal: formIsInternal,
      };
      updatedList = [...contacts, newContact];
    }

    await updateEntity(entityId, { pointsOfContact: updatedList });
    resetForm();
  };

  const handleDeleteContact = async (contactId: string) => {
    const updatedList = contacts.filter((c) => c.id !== contactId);
    await updateEntity(entityId, { pointsOfContact: updatedList });
    if (editingId === contactId) resetForm();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="poc-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm select-none p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          resetForm();
          onClose();
        }
      }}
    >
      <div
        className={clsx(
          'w-full max-w-lg border rounded-2xl shadow-2xl p-5 flex flex-col gap-4 text-xs max-h-[85vh] overflow-hidden transition-colors',
          isLight
            ? 'bg-white border-2 border-black text-black shadow-slate-900/20'
            : 'bg-slate-900 border-slate-700/80 text-slate-200'
        )}
      >
        {/* Header */}
        <div className={clsx('flex items-center justify-between border-b pb-3', isLight ? 'border-black' : 'border-slate-800')}>
          <div className="flex items-center gap-2 min-w-0">
            <Users className={clsx('w-4 h-4 shrink-0', isLight ? 'text-black' : 'text-sky-400')} />
            <div className="min-w-0">
              <h2 id="poc-modal-title" className="text-sm font-bold truncate">
                Points of Contact
              </h2>
              <p className={clsx('text-[11px] truncate flex items-center gap-1', isLight ? 'text-black font-medium' : 'text-slate-400')}>
                <Building className={clsx('w-3 h-3', isLight ? 'text-black' : 'text-slate-500')} />
                <span>{entity.name}</span>
                <span className={clsx('uppercase text-[9px] px-1 py-0.2 rounded border ml-1', isLight ? 'bg-slate-100 text-black border-black font-bold' : 'bg-slate-800 text-sky-400 border-slate-700')}>
                  {entity.category}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className={clsx(
              'p-1 rounded-lg transition-colors cursor-pointer',
              isLight ? 'text-black hover:bg-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Responsible Person / Team From Our Side (Internal Lead) */}
        <div className={clsx('p-3 rounded-xl border flex flex-col gap-1.5', isLight ? 'bg-slate-50 border-2 border-black text-black' : 'bg-slate-950 border-slate-800')}>
          <label
            htmlFor="poc-modal-internal-lead"
            className={clsx('text-xs font-semibold flex items-center justify-between', isLight ? 'text-black font-bold' : 'text-emerald-400')}
          >
            <span className="flex items-center gap-1.5">
              <ShieldCheck className={clsx('w-3.5 h-3.5', isLight ? 'text-black' : 'text-emerald-500')} />
              <span>Responsible Person / Team (From Our Side)</span>
            </span>
            <span className={clsx('text-[10px] font-normal', isLight ? 'text-black' : 'text-slate-500')}>Internal Lead</span>
          </label>
          <input
            id="poc-modal-internal-lead"
            type="text"
            value={entity.internalLead || ''}
            onChange={(e) => updateEntity(entityId, { internalLead: e.target.value })}
            placeholder="e.g. John Doe / Outreach Team (responsible person from our side)"
            className={clsx(
              'w-full px-2.5 py-1.5 rounded-lg text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 border',
              isLight
                ? 'bg-white border-black text-black font-medium'
                : 'bg-slate-900 border-slate-700 text-slate-100'
            )}
          />
          <span className={clsx('text-[10px]', isLight ? 'text-black' : 'text-slate-500')}>
            The person or team in our organization responsible for liaising with {entity.name}.
          </span>
        </div>

        {/* Tab Filters & Add Action */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                activeTab === 'all'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              All ({contacts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('partner')}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                activeTab === 'partner'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              Partner Contacts ({contacts.filter((c) => !c.isInternal).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('internal')}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                activeTab === 'internal'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              Our Lead ({contacts.filter((c) => c.isInternal).length})
            </button>
          </div>

          {!isAddingNew && !editingId && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsAddingNew(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600/90 text-white font-semibold hover:bg-sky-500 transition-all cursor-pointer text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Contact</span>
            </button>
          )}
        </div>

        {/* Content Area: Form or Contact List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {/* Add / Edit Form */}
          {(isAddingNew || editingId) && (
            <form
              onSubmit={handleSaveContact}
              className="p-3.5 rounded-xl bg-slate-950 border border-sky-500/40 flex flex-col gap-3 shadow-lg"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-xs text-sky-300">
                  {editingId ? 'Edit Point of Contact' : 'New Point of Contact'}
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {/* Internal Organization Contact Switch */}
              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsInternal}
                  onChange={(e) => setFormIsInternal(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs text-slate-300 font-medium">
                  Point of contact from our side (Our organization's responsible lead)
                </span>
              </label>

              {/* Name & Designation */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400 font-medium">
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Dr. Rajesh Kumar"
                    className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400 font-medium">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    value={formDesignation}
                    onChange={(e) => setFormDesignation(e.target.value)}
                    placeholder="e.g. Joint Secretary / Director"
                    className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400 font-medium">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400 font-medium">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="rajesh@ministry.gov.in"
                    className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              {/* Habit / Peculiarity / Leverage Point */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Habit, Peculiarity, or Leverage Point</span>
                </label>
                <input
                  type="text"
                  value={formHabit}
                  onChange={(e) => setFormHabit(e.target.value)}
                  placeholder="e.g. Needs physical letters for approvals; highly receptive to youth livelihood data"
                  className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-amber-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Description / Engagement Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400 font-medium">
                  Description / Engagement Notes
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Visit history, key topics discussed, meeting notes..."
                  className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-md cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingId ? 'Update Contact' : 'Save Contact'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Contact List */}
          {filteredContacts.length === 0 && !isAddingNew && !editingId ? (
            <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
              <User className="w-8 h-8 text-slate-600" />
              <span>No contacts listed for this partner yet.</span>
              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                className="mt-1 text-xs text-sky-400 hover:underline cursor-pointer"
              >
                + Add the first point of contact
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className={clsx(
                    'p-3 rounded-xl border transition-all',
                    contact.isInternal
                      ? 'bg-slate-950/80 border-emerald-500/30 hover:border-emerald-500/50'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  )}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-xs">
                          {contact.name}
                        </span>
                        {contact.isInternal ? (
                          <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Our Lead
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            Partner Contact
                          </span>
                        )}
                      </div>
                      {contact.designation && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Briefcase className="w-3 h-3 text-slate-500" />
                          <span>{contact.designation}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(contact)}
                        title="Edit contact"
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContact(contact.id)}
                        title="Delete contact"
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Phone & Email */}
                  {(contact.phone || contact.email) && (
                    <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-slate-850 text-[11px]">
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-1 text-slate-300 hover:text-sky-300 font-mono transition-colors"
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{contact.phone}</span>
                        </a>
                      )}
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-1 text-slate-300 hover:text-sky-300 font-mono transition-colors truncate"
                        >
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span className="truncate">{contact.email}</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Habit, Peculiarity or Leverage Point */}
                  {contact.habitOrPeculiarity && (
                    <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 flex items-start gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-semibold text-amber-300">Habit / Leverage: </span>
                        <span>{contact.habitOrPeculiarity}</span>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {contact.description && (
                    <div className="mt-1.5 text-[11px] text-slate-400 leading-relaxed italic">
                      "{contact.description}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PointsOfContactModal;

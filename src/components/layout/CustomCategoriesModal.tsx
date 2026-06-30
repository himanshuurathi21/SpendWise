import { useState, useCallback } from 'react';
import { X, Tag as TagIcon } from 'lucide-react';
import { CustomCategoryDef, Transaction } from '@/types';
import { useCategories } from '@/hooks/useCategories';
import CategoryListView from '@/components/layout/CategoryListView';
import CategoryEditorView from '@/components/layout/CategoryEditorView';
import CategoryReassignView from '@/components/layout/CategoryReassignView';

interface CustomCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  customCategories: CustomCategoryDef[];
  onAdd: (def: Omit<CustomCategoryDef, 'id'>) => void;
  onUpdate: (id: string, def: Partial<CustomCategoryDef>) => void;
  onDelete: (id: string) => void;
  transactions?: Transaction[];
  onReassign?: (oldCategoryName: string, newCategoryName: string) => void;
}

const EMOJI_OPTIONS = [
  '🛍️',
  '🍔',
  '✈️',
  '🎮',
  '🚗',
  '💡',
  '🏥',
  '💰',
  '🐶',
  '📚',
  '☕',
  '🎫',
  '🍷',
  '🛠️',
  '🎓',
];
const COLOR_OPTIONS = [
  '#f43f5e',
  '#ec4899',
  '#a855f7',
  '#6366f1',
  '#3b82f6',
  '#0ea5e9',
  '#06b6d4',
  '#14b8a6',
  '#10b981',
  '#22c55e',
  '#eab308',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#64748b',
];

export default function CustomCategoriesModal({
  isOpen,
  onClose,
  customCategories,
  onAdd,
  onUpdate,
  onDelete,
  transactions = [],
  onReassign,
}: CustomCategoriesModalProps) {
  const { allCategories, mergedIcons, suggestedCategories } = useCategories();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reassigningCat, setReassigningCat] = useState<CustomCategoryDef | null>(null);
  const [selectedFallback, setSelectedFallback] = useState<string>('Other');

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🛍️');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [monthlyLimit, setMonthlyLimit] = useState<string>('');

  const handleStartAdd = useCallback(() => {
    setEditingId('new');
    setName('');
    setIcon(EMOJI_OPTIONS[0]);
    setColor(COLOR_OPTIONS[0]);
    setMonthlyLimit('');
  }, []);

  const handleStartEdit = useCallback((cat: CustomCategoryDef) => {
    setEditingId(cat.id);
    setName(cat.name);
    setIcon(cat.icon);
    setColor(cat.color);
    setMonthlyLimit(cat.monthlyLimit?.toString() || '');
  }, []);

  const handleSave = useCallback(() => {
    if (!name.trim()) return;
    const limit = monthlyLimit ? parseFloat(monthlyLimit) : undefined;
    if (editingId === 'new') {
      onAdd({ name: name.trim(), icon, color, monthlyLimit: limit });
    } else if (editingId) {
      onUpdate(editingId, { name: name.trim(), icon, color, monthlyLimit: limit });
    }
    setEditingId(null);
  }, [name, monthlyLimit, editingId, onAdd, onUpdate, color, icon]);

  const handleDeleteAttempt = useCallback(
    (cat: CustomCategoryDef) => {
      const usedCount = transactions.filter(t => t.category === cat.name).length;
      if (usedCount > 0 && onReassign) {
        setReassigningCat(cat);
        const fallback = allCategories.find(c => c !== cat.name) || 'Other';
        setSelectedFallback(fallback);
      } else {
        onDelete(cat.id);
      }
    },
    [transactions, onReassign, onDelete, allCategories]
  );

  const handleConfirmReassign = useCallback(() => {
    if (!reassigningCat) return;
    if (onReassign) onReassign(reassigningCat.name, selectedFallback);
    onDelete(reassigningCat.id);
    setReassigningCat(null);
  }, [reassigningCat, selectedFallback, onReassign, onDelete]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="animate-scale-in w-full flex flex-col"
        style={{
          maxWidth: '440px',
          background: 'var(--surface-card)',
          borderRadius: '20px',
          boxShadow: 'var(--shadow-modal)',
          maxHeight: '90vh',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1.5px solid #f0f2f5', flexShrink: 0 }}
        >
          <div className="flex items-center gap-2">
            <TagIcon size={18} style={{ color: 'var(--teal)' }} />
            <h2
              style={{
                fontFamily: 'var(--font-manrope)',
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              Custom Categories
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {reassigningCat ? (
            <CategoryReassignView
              reassigningCat={reassigningCat}
              transactions={transactions}
              allCategories={allCategories}
              mergedIcons={mergedIcons}
              selectedFallback={selectedFallback}
              onFallbackChange={setSelectedFallback}
              onConfirm={handleConfirmReassign}
              onCancel={() => setReassigningCat(null)}
            />
          ) : !editingId ? (
            <CategoryListView
              customCategories={customCategories}
              transactions={transactions}
              onStartAdd={handleStartAdd}
              onStartEdit={handleStartEdit}
              onDeleteAttempt={handleDeleteAttempt}
            />
          ) : (
            <CategoryEditorView
              editingId={editingId}
              name={name}
              icon={icon}
              color={color}
              monthlyLimit={monthlyLimit}
              EMOJI_OPTIONS={EMOJI_OPTIONS}
              COLOR_OPTIONS={COLOR_OPTIONS}
              suggestedCategories={suggestedCategories}
              allCategories={allCategories}
              onNameChange={setName}
              onIconChange={setIcon}
              onColorChange={setColor}
              onMonthlyLimitChange={setMonthlyLimit}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
              onAddSuggested={onAdd}
            />
          )}
        </div>
      </div>
    </div>
  );
}

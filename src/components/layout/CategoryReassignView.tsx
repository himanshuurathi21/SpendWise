import { Trash2 } from 'lucide-react';
import { CustomCategoryDef, Transaction } from '@/types';

interface CategoryReassignViewProps {
  reassigningCat: CustomCategoryDef;
  transactions: Transaction[];
  allCategories: string[];
  mergedIcons: Record<string, string>;
  selectedFallback: string;
  onFallbackChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CategoryReassignView({
  reassigningCat,
  transactions,
  allCategories,
  mergedIcons,
  selectedFallback,
  onFallbackChange,
  onConfirm,
  onCancel,
}: CategoryReassignViewProps) {
  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="text-center">
        <div className="w-14 h-14 bg-[var(--red-dim)] rounded-full flex items-center justify-center mx-auto mb-3">
          <Trash2 size={24} className="text-[var(--red)]" />
        </div>
        <h3 className="text-title" style={{ fontFamily: 'var(--font-manrope)' }}>
          Category in Use
        </h3>
        <p className="text-body mt-2">
          You have{' '}
          <strong className="text-[var(--text-primary)]">
            {transactions.filter(t => t.category === reassigningCat.name).length}
          </strong>{' '}
          transaction(s) categorized as <strong>"{reassigningCat.name}"</strong>. Before deleting
          this category, please select a new category for these transactions.
        </p>
      </div>

      <div>
        <label className="text-label block mb-2">Move transactions to...</label>
        <select
          value={selectedFallback}
          onChange={e => onFallbackChange(e.target.value)}
          className="w-full rounded-xl py-3 px-4 text-sm font-medium focus:outline-none transition-all"
          style={{
            background: 'var(--surface-input)',
            border: '2px solid transparent',
            color: 'var(--text-primary)',
          }}
          onFocus={e => {
            e.target.style.border = '2px solid var(--teal)';
          }}
          onBlur={e => {
            e.target.style.border = '2px solid transparent';
          }}
        >
          {allCategories
            .filter(c => c !== reassigningCat.name)
            .map(c => (
              <option key={c} value={c}>
                {mergedIcons[c] || '📦'} {c}
              </option>
            ))}
          {!allCategories.includes('Other') && <option value="Other">📦 Other</option>}
        </select>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl font-semibold text-sm transition-colors bg-[#f5f7fa] dark:bg-[var(--surface-input)] text-[var(--text-secondary)]"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all bg-[var(--red)] border-none cursor-pointer"
        >
          Move & Delete
        </button>
      </div>
    </div>
  );
}

import { Plus, Edit3, Trash2 } from 'lucide-react';
import { CustomCategoryDef, Transaction } from '@/types';

interface CategoryListViewProps {
  customCategories: CustomCategoryDef[];
  transactions: Transaction[];
  onStartAdd: () => void;
  onStartEdit: (cat: CustomCategoryDef) => void;
  onDeleteAttempt: (cat: CustomCategoryDef) => void;
}

export default function CategoryListView({
  customCategories,
  transactions,
  onStartAdd,
  onStartEdit,
  onDeleteAttempt,
}: CategoryListViewProps) {
  return (
    <div>
      {customCategories.length === 0 ? (
        <div className="text-center py-6">
          <p
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: '13px',
              color: 'var(--text-muted)',
              marginBottom: '16px',
            }}
          >
            You haven't added any custom categories yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {customCategories.map(cat => (
            <div
              key={cat.id}
              className="p-3 rounded-xl card-hover border border-[var(--surface-border)]"
              style={{ background: 'var(--surface-card)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span
                    className="flex w-10 h-10 items-center justify-center rounded-xl text-lg shrink-0"
                    style={{ background: `${cat.color}15` }}
                  >
                    {cat.icon}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-inter)',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {cat.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {cat.monthlyLimit && (
                    <span className="px-2 py-1 rounded-lg bg-[var(--surface-submerged)] border border-[var(--surface-border)] text-[length:var(--fs-overline)] font-bold text-[var(--text-primary)]">
                      ${cat.monthlyLimit}
                    </span>
                  )}
                  <button
                    onClick={() => onStartEdit(cat)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg"
                    style={{
                      background: '#f5f7fa',
                      color: 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => onDeleteAttempt(cat)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg"
                    style={{
                      background: 'var(--red-dim)',
                      color: 'var(--red)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {cat.monthlyLimit && (
                <div className="mt-2">
                  <div className="h-1.5 w-full bg-[var(--surface-submerged)] rounded-full overflow-hidden">
                    {(() => {
                      const spent = transactions
                        .filter(
                          t =>
                            t.category === cat.name &&
                            t.type === 'debit' &&
                            t.date.startsWith(new Date().toISOString().substring(0, 7))
                        )
                        .reduce((s, t) => s + t.amount, 0);
                      const pct = Math.min(100, (spent / cat.monthlyLimit) * 100);
                      return (
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${spent > cat.monthlyLimit ? 'bg-red-500' : 'bg-[var(--teal)]'}`}
                          style={{ width: `${pct}%` }}
                        />
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onStartAdd}
        className="w-full h-12 flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-all"
        style={{
          background: 'var(--teal-dim)',
          color: 'var(--teal)',
          border: '1.5px dashed var(--teal-glow)',
          cursor: 'pointer',
        }}
      >
        <Plus size={16} /> Create New Category
      </button>
    </div>
  );
}

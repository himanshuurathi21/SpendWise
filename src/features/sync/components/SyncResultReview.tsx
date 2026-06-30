import { Transaction, Category } from '@/types';

interface SyncResultReviewProps {
  stagedTxs: Transaction[];
  CATEGORIES: Category[];
  onCategoryChange: (txId: string, newCat: Category) => void;
  onConfirmImport: () => void;
  onCancel: () => void;
}

export default function SyncResultReview({
  stagedTxs,
  CATEGORIES,
  onCategoryChange,
  onConfirmImport,
  onCancel,
}: SyncResultReviewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-[var(--surface-input)] p-4 rounded-xl border border-[var(--border)]">
        <div>
          <p className="font-manrope font-bold text-sm text-[var(--text-primary)]">
            Review Categorised Transactions
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Please verify or correct categories before importing into your wallet.
          </p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--teal-dim)] text-[var(--teal)]">
          {stagedTxs.length} Ready
        </span>
      </div>

      <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
        {stagedTxs.map(tx => (
          <div
            key={tx.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-[var(--surface-input)] border border-[var(--border)] gap-3 hover:border-[var(--teal)] transition-all"
          >
            <div>
              <p className="font-inter font-bold text-sm text-[var(--text-primary)]">
                {tx.merchant}
              </p>
              <p className="font-inter text-xs text-[var(--text-muted)] mt-0.5">{tx.description}</p>
            </div>
            <div className="flex items-center gap-3 justify-between sm:justify-end">
              <span className="font-inter font-bold text-sm text-[var(--text-primary)]">
                ₹{tx.amount.toFixed(0)}
              </span>
              <select
                value={tx.category}
                onChange={e => onCategoryChange(tx.id, e.target.value as Category)}
                className="p-2 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] focus:border-[var(--teal)] outline-none cursor-pointer"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-[var(--border)]">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl bg-[var(--surface-input)] text-[var(--text-primary)] font-bold border border-[var(--border)] cursor-pointer hover:bg-[var(--surface-card)] transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onConfirmImport}
          className="flex-1 py-3 rounded-xl bg-[var(--teal)] text-white font-bold border-none cursor-pointer shadow-lg shadow-teal-500/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          Confirm & Import ({stagedTxs.length})
        </button>
      </div>
    </div>
  );
}

import { Brain, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Transaction, Category } from '@/types';
import SyncResultReview from '@/features/sync/components/SyncResultReview';

interface SyncingOverlayProps {
  syncState: 'idle' | 'parsing' | 'categorising' | 'review' | 'done' | 'error';
  stagedTxs: Transaction[];
  existingCount: number;
  onClose: () => void;
  onConfirmImport: () => void;
  onCategoryChange: (txId: string, newCat: Category) => void;
  CATEGORIES: Category[];
}

export default function SyncingOverlay({
  syncState,
  stagedTxs,
  existingCount,
  onClose,
  onConfirmImport,
  onCategoryChange,
  CATEGORIES,
}: SyncingOverlayProps) {
  if (syncState === 'idle') return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col animate-scale-in">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
          <h3 className="text-xl font-manrope font-bold flex items-center gap-2 text-[var(--text-primary)]">
            <Brain className="text-[var(--teal)]" size={24} />
            UPI Payment Synchronization
          </h3>
          {syncState === 'review' && (
            <button
              onClick={onClose}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>

        {syncState === 'parsing' && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 size={48} className="animate-spin text-[var(--teal)]" />
            <p className="font-manrope font-bold text-lg text-[var(--text-primary)]">
              Parsing UPI strings & extracting merchants...
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Applying Indian bank regex patterns (PhonePe, GPay, Paytm, HDFC)...
            </p>
          </div>
        )}

        {syncState === 'categorising' && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 size={48} className="animate-spin text-[var(--teal)]" />
            <p className="font-manrope font-bold text-lg text-[var(--text-primary)]">
              Categorising {stagedTxs.length || 10} transactions...
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Matching against Merchant Memory & AI rules...
            </p>
          </div>
        )}

        {syncState === 'review' && (
          <SyncResultReview
            stagedTxs={stagedTxs}
            CATEGORIES={CATEGORIES}
            onCategoryChange={onCategoryChange}
            onConfirmImport={onConfirmImport}
            onCancel={onClose}
          />
        )}

        {syncState === 'done' && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-6 animate-bounce-in">
            <CheckCircle2 size={64} className="text-[var(--green)]" />
            <div>
              <h4 className="text-2xl font-manrope font-extrabold text-[var(--text-primary)] mb-2">
                Import Successful!
              </h4>
              <p className="text-sm text-[var(--text-muted)]">
                ✅ Imported {stagedTxs.length} transactions ({existingCount} already existed and
                were skipped)
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-4 rounded-xl bg-[var(--teal)] text-white font-bold border-none cursor-pointer shadow-lg shadow-teal-500/20 hover:opacity-90 transition-all"
            >
              Done
            </button>
          </div>
        )}

        {syncState === 'error' && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
            <AlertCircle size={64} className="text-[var(--red)]" />
            <div>
              <h4 className="text-2xl font-manrope font-bold text-[var(--text-primary)] mb-2">
                Sync Failed
              </h4>
              <p className="text-sm text-[var(--text-muted)]">
                Could not complete UPI synchronization. Please try again.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-4 rounded-xl bg-[var(--surface-input)] text-[var(--text-primary)] font-bold border border-[var(--border)] cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

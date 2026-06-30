import React, { useState, useMemo } from 'react';
import { Transaction, Category } from '@/types';
import { Virtuoso } from 'react-virtuoso';
import { Search } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { haptic } from '@/core/haptic';
import EmptyState from '@/components/ui/EmptyState';
import TransactionRow from './components/TransactionRow';

interface HistoryViewMobileProps {
  transactions: Transaction[];
  onDelete?: (id: string) => void;
  currency?: string;
  onCategoryChange?: (id: string, newCategory: Category) => void;
}

export default function HistoryViewMobile({
  transactions,
  onDelete,
  currency = '₹',
  onCategoryChange,
}: HistoryViewMobileProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { allCategories, mergedIcons, mergedColors } = useCategories();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [_isFilterOpen, _setIsFilterOpen] = useState(false);

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      const matchesSearch =
        tx.merchant.toLowerCase().includes(search.toLowerCase()) ||
        tx.category.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'All' || tx.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [transactions, search, activeCategory]);

  const total = useMemo(() => {
    return filtered.reduce((sum, tx) => sum + (tx.type === 'debit' ? -tx.amount : tx.amount), 0);
  }, [filtered]);

  type DisplayRow =
    | { type: 'header'; date: string; subtotal: number }
    | { type: 'tx'; tx: Transaction };

  const displayRows = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filtered.forEach(tx => {
      const d = tx.date;
      if (!groups[d]) groups[d] = [];
      groups[d].push(tx);
    });

    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    const rows: DisplayRow[] = [];

    sortedDates.forEach(date => {
      const list = groups[date];
      const subtotal = list.reduce(
        (sum, tx) => sum + (tx.type === 'debit' ? -tx.amount : tx.amount),
        0
      );
      rows.push({ type: 'header', date, subtotal });
      list.forEach(tx => {
        rows.push({ type: 'tx', tx });
      });
    });

    return rows;
  }, [filtered]);

  const _handleRowClick = (_tx: Transaction) => {
    haptic.light();
    // Detail view or edit could go here
  };

  return (
    <div className="view-enter flex flex-col h-[calc(100vh-140px)]">
      {/* 1. Header with Quick Stats */}
      <div className="px-1 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-black text-[var(--text-primary)]">History</h2>
            <p className="text-[length:var(--fs-overline)] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">
              {filtered.length} TRANSACTIONS
            </p>
          </div>
          <div
            className={`px-4 py-2 rounded-2xl ${total >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'} border border-current/20`}
          >
            <p className="text-[length:var(--fs-overline)] font-bold uppercase tracking-widest text-center opacity-70">
              Net
            </p>
            <p className="text-sm font-bold">
              {total >= 0 ? '+' : ''}
              {currency}
              {Math.abs(total).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-dim)]">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search merchants, categories..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-12 bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl pl-12 pr-4 text-sm text-[var(--text-primary)] focus:border-[var(--teal)] outline-none transition-all"
          />
        </div>
      </div>

      {/* 2. Category Chips */}
      <div className="flex gap-2 overflow-x-auto px-1 pb-4 no-scrollbar">
        {['All', ...allCategories].map(cat => (
          <button
            key={cat}
            onClick={() => {
              haptic.light();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              setActiveCategory(cat as any);
            }}
            className={`px-4 py-2 rounded-full text-[length:var(--fs-overline)] font-bold uppercase tracking-widest whitespace-nowrap border transition-all ${
              activeCategory === cat
                ? 'bg-[var(--teal)] text-white border-[var(--teal)] shadow-md'
                : 'bg-[var(--surface-card)] text-[var(--text-muted)] border-[var(--border)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 3. Transaction List */}
      <div className="flex-1 min-h-0 bg-[var(--surface-card)] rounded-[var(--radius-sheet)] border border-[var(--border)] shadow-sm overflow-hidden">
        <Virtuoso
          totalCount={displayRows.length}
          itemContent={index => {
            const row = displayRows[index];
            if (row.type === 'header') {
              const formattedDate = new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
              });
              const sign = row.subtotal >= 0 ? '+' : '';
              const color = row.subtotal >= 0 ? 'var(--teal)' : 'var(--red)';
              return (
                <div
                  className="tx-date-header px-4 bg-[var(--surface-card)]"
                  style={{ borderBottom: '1px solid var(--border)', margin: '14px 0 4px 0' }}
                >
                  <span>{formattedDate}</span>
                  <span className="subtotal" style={{ color }}>
                    {sign}
                    {currency}
                    {row.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            }

            const tx = row.tx;
            return (
              <TransactionRow
                key={tx.id}
                tx={tx}
                selected={selectedIds.has(tx.id)}
                onSelect={(id, isSel) => {
                  setSelectedIds(prev => {
                    const next = new Set(prev);
                    if (isSel) next.add(id);
                    else next.delete(id);
                    return next;
                  });
                }}
                onCategoryChange={onCategoryChange}
                onDelete={onDelete}
                currency={currency}
                mergedColors={mergedColors}
                mergedIcons={mergedIcons}
              />
            );
          }}
          style={{ height: '100%' }}
        />

        {filtered.length === 0 && (
          <EmptyState
            message="No results found."
            subMessage="Try a different search term or category."
          />
        )}
      </div>
    </div>
  );
}

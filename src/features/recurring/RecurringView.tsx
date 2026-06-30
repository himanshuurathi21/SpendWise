import { useState } from 'react';
import { RefreshCw, Calendar, TrendingUp, Clock, Zap, LayoutGrid } from 'lucide-react';
import { RecurringPattern, Transaction } from '@/types';
import { useCategories } from '@/hooks/useCategories';

interface RecurringViewProps {
  patterns: RecurringPattern[];
  currency?: string;
  transactions?: Transaction[];
  subscriptionCalendar?: React.ReactNode;
  priceHikeDetector?: React.ReactNode;
}

// ─── Frequency badge ──────────────────────────────────────────────────────────

const FREQ_CONFIG = {
  weekly: { label: 'Weekly', color: '#3b82f6', emoji: '🔁' },
  monthly: { label: 'Monthly', color: '#a855f7', emoji: '🔄' },
  annual: { label: 'Annual', color: '#f59e0b', emoji: '📅' },
  daily: { label: 'Daily', color: '#10b981', emoji: '🌅' },
};

// ─── Days until next ──────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86_400_000));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ─── Pattern card ─────────────────────────────────────────────────────────────

function PatternCard({ pattern, currency }: { pattern: RecurringPattern; currency: string }) {
  const { mergedColors, mergedIcons } = useCategories();
  const freq = FREQ_CONFIG[pattern.frequency];
  const days = daysUntil(pattern.nextExpected);
  const isUrgent = days <= 5;
  const catColor = mergedColors[pattern.category] ?? '#64748b';
  const catIcon = mergedIcons[pattern.category] ?? '💳';

  return (
    <div className="group relative overflow-hidden rounded-xl p-4 transition-all duration-200 card card-hover">
      {/* Top accent */}
      <div
        className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl"
        style={{ background: catColor }}
      />

      <div className="flex items-start gap-3">
        {/* Category icon */}
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: `${catColor}18` }}
        >
          {catIcon}
        </div>

        <div className="min-w-0 flex-1">
          {/* Merchant + frequency badge */}
          <div className="flex flex-wrap items-center gap-1.5">
            <p
              style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {pattern.merchant}
            </p>
            <span
              className="rounded-full px-1.5 py-0.5 text-[length:var(--fs-overline)] font-bold"
              style={{
                backgroundColor: `${freq.color}15`,
                color: freq.color,
                fontFamily: 'var(--font-inter)',
              }}
            >
              {freq.emoji} {freq.label}
            </span>
          </div>

          {/* Category + occurrences */}
          <p
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '2px',
            }}
          >
            <span style={{ color: catColor, fontWeight: 500 }}>{pattern.category}</span>
            {' · '}
            {pattern.occurrences}× detected · {currency}
            {pattern.totalSpent.toFixed(0)} total
          </p>
        </div>

        {/* Amount */}
        <div className="flex-shrink-0 text-right">
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            ~{currency}
            {pattern.avgAmount.toFixed(2)}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            avg / charge
          </p>
        </div>
      </div>

      {/* Next expected */}
      <div
        className="mt-3 flex items-center justify-between pt-2.5"
        style={{ borderTop: '1px solid #f0f2f5' }}
      >
        <div className="flex items-center gap-1.5">
          <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
          <span
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            Next:{' '}
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {formatDate(pattern.nextExpected)}
            </span>
          </span>
        </div>
        <span
          className="flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{
            fontFamily: 'var(--font-inter)',
            fontSize: '11px',
            fontWeight: 600,
            background: isUrgent ? 'var(--amber-dim)' : '#f5f7fa',
            color: isUrgent ? 'var(--amber)' : 'var(--text-muted)',
          }}
        >
          <Clock size={10} />
          {days === 0 ? 'Today' : `${days}d`}
        </span>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div
        className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: '#f5f7fa' }}
      >
        <RefreshCw size={24} style={{ color: 'var(--text-muted)' }} />
      </div>
      <p
        style={{
          fontFamily: 'var(--font-inter)',
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--text-muted)',
        }}
      >
        No recurring patterns found
      </p>
      <p
        style={{
          fontFamily: 'var(--font-inter)',
          fontSize: '12px',
          color: 'var(--text-dim)',
          marginTop: '4px',
        }}
      >
        Add more transactions — patterns emerge after 2+ identical charges
      </p>
    </div>
  );
}

// ─── Summary stats bar ────────────────────────────────────────────────────────

function SummaryBar({ patterns, currency }: { patterns: RecurringPattern[]; currency: string }) {
  const total = patterns.reduce((a, p) => a + p.avgAmount, 0);
  const monthly = patterns
    .filter(p => p.frequency === 'monthly')
    .reduce((a, p) => a + p.avgAmount, 0);
  const subscriptions = patterns.filter(p => p.category === 'Subscriptions').length;

  const colors = ['var(--teal)', 'var(--purple)', 'var(--blue)'];
  return (
    <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
      {[
        { label: 'Total Monthly', value: `${currency}${total.toFixed(0)}`, icon: TrendingUp },
        { label: 'Subscriptions', value: `${currency}${monthly.toFixed(0)}/mo`, icon: RefreshCw },
        { label: 'Recurring Bills', value: `${subscriptions} services`, icon: Zap },
      ].map((s, i) => (
        <div key={s.label} className="card px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5">
            <s.icon size={12} style={{ color: colors[i] }} />
            <span
              style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-muted)',
              }}
            >
              {s.label}
            </span>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: '16px',
              fontWeight: 700,
              color: colors[i],
            }}
          >
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RecurringView({
  patterns = [],
  currency = '$',
  transactions = [],
  subscriptionCalendar: subscriptionCalendarProp,
  priceHikeDetector: priceHikeDetectorProp,
}: RecurringViewProps) {
  const [view, setView] = useState<'list' | 'calendar'>('list');

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="flex items-center gap-2 text-headline">
            <RefreshCw size={18} style={{ color: 'var(--purple)' }} />
            Recurring Charges
          </h2>
          <p className="text-caption mt-1">Auto-detected from your transaction history</p>
        </div>
        <div className="flex items-center gap-2">
          {patterns.length > 0 && (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: 'var(--purple-dim)',
                color: 'var(--purple)',
                fontFamily: 'var(--font-inter)',
              }}
            >
              {patterns.length} detected
            </span>
          )}
          {/* View toggle */}
          <div className="flex rounded-xl overflow-hidden border border-[var(--border)]">
            {(['list', 'calendar'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[length:var(--fs-caption)] font-bold transition-colors border-none cursor-pointer"
                style={{
                  background: view === v ? 'var(--teal)' : 'var(--surface-card)',
                  color: view === v ? '#fff' : 'var(--text-muted)',
                  fontFamily: 'var(--font-inter)',
                }}
              >
                {v === 'list' ? <LayoutGrid size={12} /> : <Calendar size={12} />}
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'list' ? (
        <>
          {patterns.length > 0 && <SummaryBar patterns={patterns} currency={currency} />}

          {/* Price Hike Detection */}
          {transactions.length > 0 && (
            <div className="card p-4 sm:p-5 mb-5">{priceHikeDetectorProp}</div>
          )}

          {patterns.length === 0 ? (
            <div className="card p-8">
              <EmptyState />
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {patterns.map(p => (
                <PatternCard key={`${p.merchant}-${p.frequency}`} pattern={p} currency={currency} />
              ))}
            </div>
          )}
        </>
      ) : (
        subscriptionCalendarProp
      )}
    </div>
  );
}

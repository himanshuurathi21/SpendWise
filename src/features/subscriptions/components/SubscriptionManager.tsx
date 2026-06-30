import { useState } from 'react';
import {
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Calendar,
  Plus,
  Zap,
  Clock,
  Shield,
} from 'lucide-react';
import { RecurringPattern } from '@/types';
import { useCategories } from '@/hooks/useCategories';
import AddSubscriptionModal from '@/features/subscriptions/components/AddSubscriptionModal';
import { useCurrency } from '@/contexts/CurrencyContext';
import { SubscriptionCalendar } from '@/features/subscriptions/components/SubscriptionCalendar';
import { useSubscriptionManager } from '@/features/subscriptions/hooks/useSubscriptionManager';
import { useStore } from '@/store';

interface SubscriptionManagerProps {
  patterns: RecurringPattern[];
  currency?: string;
  // FSD: inject MandateManager from the app/page layer instead of importing from sync feature
  mandateManager?: React.ReactNode;
}

function getServiceColor(name: string): string {
  const SERVICE_COLORS: Record<string, string> = {
    netflix: '#e50914',
    spotify: '#1db954',
    notion: '#000000',
    amazon: '#ff9900',
    apple: '#555555',
    youtube: '#ff0000',
    gym: '#6366f1',
    jio: '#0052cc',
    airtel: '#e40000',
    phone: '#64748b',
    adobe: '#ff0000',
    canva: '#00c4cc',
  };
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(SERVICE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#6366f1';
}

function getServiceInitials(name: string): string {
  return name
    .split(/[\s/]+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function SubscriptionManager({
  patterns,
  currency = '₹',
  mandateManager: mandateManagerProp,
}: SubscriptionManagerProps) {
  const { mergedIcons } = useCategories();
  const { format } = useCurrency();
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeView, setActiveView] = useState<'subscriptions' | 'mandates'>('subscriptions');
  const { subscriptions, monthlyTotal, annualTotal, upcoming, daysUntil } =
    useSubscriptionManager(patterns);
  const mandates = useStore(s => s.mandates);

  const statsCards = [
    {
      label: 'Monthly Burn',
      value: format(monthlyTotal),
      color: 'var(--teal)',
      icon: <RefreshCw size={16} />,
    },
    {
      label: 'Annual Spend',
      value: format(annualTotal),
      color: 'var(--purple)',
      icon: <TrendingUp size={16} />,
    },
    {
      label: 'Active Services',
      value: `${subscriptions.length}`,
      color: 'var(--blue)',
      icon: <DollarSign size={16} />,
    },
    {
      label: 'Due This Week',
      value: `${upcoming.length}`,
      color: 'var(--amber)',
      icon: <AlertTriangle size={16} />,
    },
  ];

  const activeMandatesCount = mandates.filter(m => m.status === 'active').length;

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-headline">
            <RefreshCw size={22} style={{ color: '#a855f7' }} />
            Subscription Intelligence
          </h2>
          <p className="text-caption mt-1">
            All recurring charges auto-detected from your transaction history.
          </p>
        </div>
        {activeView === 'subscriptions' ? (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-sm rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
          >
            <Plus size={16} /> Add Manual
          </button>
        ) : null}
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
        <button
          onClick={() => setActiveView('subscriptions')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
            activeView === 'subscriptions'
              ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <RefreshCw size={14} />
          Subscriptions
          <span className="ml-1 text-xs opacity-60">({subscriptions.length})</span>
        </button>
        <button
          onClick={() => setActiveView('mandates')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
            activeView === 'mandates'
              ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Shield size={14} />
          Mandates
          {mandates.length > 0 && (
            <span className="ml-1 text-xs opacity-60">({activeMandatesCount} active)</span>
          )}
        </button>
      </div>

      {activeView === 'mandates' ? (
        mandateManagerProp
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statsCards.map(s => (
              <div key={s.label} className="card px-5 py-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <span style={{ color: s.color }}>{s.icon}</span>
                  <span
                    className="font-inter text-[length:var(--fs-overline)] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {s.label}
                  </span>
                </div>
                <p className="font-manrope font-bold text-2xl" style={{ color: s.color }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Upcoming this week alert */}
          {upcoming.length > 0 && (
            <div
              className="card px-5 py-4 flex items-start gap-3"
              style={{
                background: 'rgba(251,191,36,0.08)',
                border: '1.5px solid rgba(251,191,36,0.3)',
              }}
            >
              <AlertTriangle
                size={20}
                style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }}
              />
              <div>
                <p className="font-inter font-bold text-[14px]" style={{ color: 'var(--amber)' }}>
                  Bills due within 7 days
                </p>
                <p className="font-inter text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  {upcoming
                    .map(
                      s =>
                        `${s.merchant} (${daysUntil(s.nextExpected) === 0 ? 'Today' : `in ${daysUntil(s.nextExpected)}d`})`
                    )
                    .join(' · ')}
                </p>
              </div>
            </div>
          )}

          {/* Calendar View */}
          {subscriptions.length > 0 && (
            <SubscriptionCalendar
              subscriptions={subscriptions.map((s, idx) => ({
                id: `${s.merchant}-${s.frequency}-${idx}`,
                name: s.merchant,
                amount: s.avgAmount,
                billingDay: new Date(s.nextExpected + 'T00:00:00').getDate(),
                color: getServiceColor(s.merchant),
              }))}
              currency={format(0)
                .replace(/[0-9.,]/g, '')
                .trim()}
            />
          )}

          {/* Subscriptions Grid */}
          {subscriptions.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: '#f5f7fa' }}
              >
                <RefreshCw size={26} style={{ color: 'var(--text-muted)' }} />
              </div>
              <p
                className="font-inter font-medium text-[14px]"
                style={{ color: 'var(--text-muted)' }}
              >
                No subscriptions detected yet
              </p>
              <p className="font-inter text-[12px] mt-1" style={{ color: 'var(--text-dim)' }}>
                Add recurring transactions — they'll automatically appear here after 2+ charges.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subscriptions.map(sub => {
                const color = getServiceColor(sub.merchant);
                const initials = getServiceInitials(sub.merchant);
                const days = daysUntil(sub.nextExpected);
                const isUrgent = days <= 5;
                const annualCost = sub.frequency === 'monthly' ? sub.avgAmount * 12 : sub.avgAmount;

                return (
                  <div
                    key={`${sub.merchant}-${sub.frequency}`}
                    className="card relative overflow-hidden transition-all"
                    style={{ borderTop: `3px solid ${color}` }}
                  >
                    <div className="px-5 pt-4 pb-5">
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0"
                          style={{ background: color, fontFamily: 'var(--font-manrope)' }}
                        >
                          {mergedIcons[sub.category] ? (
                            <span className="text-lg">{mergedIcons[sub.category]}</span>
                          ) : (
                            initials
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className="font-inter text-[length:var(--fs-overline)] font-bold uppercase tracking-wider rounded-full px-2 py-0.5"
                            style={{ background: color + '15', color }}
                          >
                            {sub.frequency}
                          </span>
                          {sub.isTrial && (
                            <span className="flex items-center gap-1 font-inter text-[length:var(--fs-overline)] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 rounded-full px-2 py-0.5 border border-amber-500/20">
                              <Zap size={10} /> Trial
                            </span>
                          )}
                        </div>
                      </div>

                      <p
                        className="font-inter font-bold text-[14px] mb-1 truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {sub.merchant}
                      </p>
                      <p
                        className="font-manrope font-bold text-2xl"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {format(sub.avgAmount)}
                        <span
                          className="font-inter text-[length:var(--fs-caption)] font-medium ml-1"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          /{sub.frequency === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      </p>

                      {sub.isTrial && sub.trialEndsAt && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock size={11} className="text-amber-500" />
                          <span className="font-inter text-[length:var(--fs-overline)] text-amber-600 font-medium">
                            Ends{' '}
                            {new Date(sub.trialEndsAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      )}

                      {sub.priceCreep && (
                        <div className="flex items-center gap-1.5 mt-1 animate-pulse">
                          <TrendingUp size={12} className="text-red-500" />
                          <span className="font-inter text-[length:var(--fs-overline)] font-bold text-red-500 uppercase tracking-tight">
                            Price Increased Recently
                          </span>
                        </div>
                      )}

                      <p
                        className="font-inter text-[length:var(--fs-caption)] mt-1"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {format(annualCost)} / year
                      </p>

                      <div
                        className="flex items-center justify-between mt-4 pt-3"
                        style={{ borderTop: '1px dashed var(--border)' }}
                      >
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} style={{ color: 'var(--text-muted)' }} />
                          <span
                            className="font-inter text-[length:var(--fs-caption)]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Next:{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>
                              {new Date(sub.nextExpected + 'T00:00:00').toLocaleDateString(
                                'en-US',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                }
                              )}
                            </strong>
                          </span>
                        </div>
                        <span
                          className="font-inter text-[length:var(--fs-overline)] font-bold rounded-full px-2 py-0.5"
                          style={{
                            background: isUrgent ? 'var(--amber-dim)' : '#f5f7fa',
                            color: isUrgent ? 'var(--amber)' : 'var(--text-muted)',
                          }}
                        >
                          {days === 0 ? 'Today!' : `${days}d`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Annual Summary */}
          {subscriptions.length > 0 && (
            <div
              className="card px-6 py-5"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                border: 'none',
              }}
            >
              <p className="font-inter text-[12px] font-semibold text-white/70 uppercase tracking-wider mb-2">
                Total Annual Subscription Cost
              </p>
              <p className="font-manrope font-bold text-4xl text-white">{format(annualTotal)}</p>
              <p className="font-inter text-[13px] text-white/70 mt-2">
                across {subscriptions.length} recurring service
                {subscriptions.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          <AddSubscriptionModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            currency={currency}
          />
        </>
      )}
    </div>
  );
}

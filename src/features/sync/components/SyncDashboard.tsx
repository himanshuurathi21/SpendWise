import React from 'react';
import {
  Landmark,
  Zap,
  MoreVertical,
  TrendingDown,
  Hash,
  Sparkles,
  Brain,
  SmartphoneNfc,
  Link2,
  History,
  CreditCard,
  Clock,
  RefreshCw,
  Activity,
  Users,
} from 'lucide-react';
import { Transaction, LinkedAccount, SyncView } from '@/types';
import { UPI_PROVIDERS } from '@/features/sync/parsers/upi';
import CSVImporter from '@/features/sync/components/CSVImporter';
import { CloudSync } from '@/features/sync/components/CloudSync';

export interface SyncDashboardProps {
  totalUPISpend: number;
  aiParsedCount: number;
  merchantMemoryCount: number;
  accounts: LinkedAccount[];
  recentTransactions: Transaction[];
  syncingAccountId: string | null;
  onSyncAccount: (acc: LinkedAccount) => void;
  onSetView: (view: SyncView) => void;
  currency: string;
  onAutoAddTransactions: (txs: Transaction[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNavigate?: (view: any) => void;
  // FSD: inject shared wallet data from the app/page layer instead of importing shared feature
  sharedWalletData?: {
    groups: Array<{ id: string; name: string; emoji: string; memberCount: number }>;
    pendingInvites: Array<{ memberId: string; groupName: string }>;
    acceptInvite: (memberId: string) => Promise<void>;
    declineInvite: (memberId: string) => Promise<void>;
    createGroup: (
      name: string,
      purpose: string,
      creatorName: string,
      creatorEmoji?: string
    ) => Promise<void>;
  };
}

export function SyncDashboard({
  totalUPISpend,
  aiParsedCount,
  merchantMemoryCount,
  accounts,
  recentTransactions,
  syncingAccountId,
  onSyncAccount,
  onSetView,
  currency,
  onAutoAddTransactions,
  onNavigate,
  sharedWalletData: sharedWalletDataProp,
}: SyncDashboardProps) {
  const { groups, pendingInvites, acceptInvite, declineInvite, createGroup } =
    sharedWalletDataProp ?? {
      groups: [],
      pendingInvites: [],
      acceptInvite: async () => {},
      declineInvite: async () => {},
      createGroup: async () => {},
    };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-headline">
            <Landmark size={22} style={{ color: 'var(--teal)' }} />
            Bank Sync & Ingestion
          </h2>
          <p className="text-caption mt-1 max-w-lg">
            Connect bank sources or make instant UPI payments with local AI categorisation.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSetView('pay-form')}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--teal)] text-white font-manrope font-bold text-sm border-none shadow-lg shadow-teal-500/20 hover:opacity-90 transition-all active:scale-[0.98]"
          >
            <Zap size={16} />
            Make UPI Payment
          </button>
          <button
            onClick={() => onSetView('select-source')}
            className="flex items-center justify-center p-3 rounded-xl bg-[var(--surface-input)] text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--surface-input)] hover:text-[var(--text-primary)] transition-all"
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            icon: <TrendingDown size={16} />,
            label: 'Total UPI Spend',
            value: `${currency}${totalUPISpend.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`,
            color: 'var(--red)',
          },
          {
            icon: <Hash size={16} />,
            label: 'Payments Made',
            value: String(recentTransactions.length),
            color: 'var(--teal)',
          },
          {
            icon: <Sparkles size={16} />,
            label: 'Local Parsing',
            value: String(aiParsedCount),
            color: '#a78bfa',
          },
          {
            icon: <Brain size={16} />,
            label: 'Merchants Learned',
            value: String(merchantMemoryCount),
            color: '#f59e0b',
          },
        ].map(stat => (
          <div key={stat.label} className="card px-4 py-4">
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: stat.color }}>{stat.icon}</span>
              <span className="font-inter text-[length:var(--fs-overline)] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
                {stat.label}
              </span>
            </div>
            <p className="font-manrope font-bold text-xl text-[var(--text-primary)]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Connected Sources */}
          <div className="card px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 font-manrope font-bold text-lg text-[var(--text-primary)]">
                <SmartphoneNfc size={18} className="text-[var(--teal)]" />
                Connected Sources
              </h3>
              <button
                onClick={() => onSetView('select-source')}
                className="font-inter text-xs font-bold text-[var(--teal)] px-3 py-1.5 rounded-lg bg-[var(--teal-dim)] border-none cursor-pointer"
              >
                + Add Source
              </button>
            </div>

            {accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-input)]">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-[var(--teal-dim)]">
                  <Link2 size={20} className="text-[var(--teal)]" />
                </div>
                <h4 className="font-inter font-semibold text-[15px] mb-1 text-[var(--text-primary)]">
                  No sources linked
                </h4>
                <p className="font-inter text-sm mb-5 max-w-sm mx-auto text-[var(--text-muted)]">
                  Link your UPI apps or Razorpay test key to auto-categorise spending.
                </p>
                <button
                  onClick={() => onSetView('select-source')}
                  className="font-inter text-xs font-bold text-teal-600 px-4 py-2 rounded-lg bg-[var(--teal-dim)] border-none cursor-pointer"
                >
                  Connect Source
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {accounts.map(acc => {
                  const isRzp = (acc.provider as string) === 'razorpay';
                  const providerDef = isRzp
                    ? { name: 'Razorpay', icon: <Zap size={18} />, color: '#3395FF' }
                    : UPI_PROVIDERS.find(p => p.id === acc.provider) || UPI_PROVIDERS[0];

                  return (
                    <div
                      key={acc.id}
                      className="rounded-xl p-5 relative overflow-hidden border border-[var(--border)] bg-[var(--surface-card)]"
                    >
                      <div className="absolute top-4 right-4 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                        <span className="font-inter text-[length:var(--fs-overline)] uppercase tracking-wider font-bold text-[var(--green)]">
                          Active
                        </span>
                      </div>
                      <div className="flex items-start gap-3 mb-4">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                          style={{ background: providerDef.color }}
                        >
                          {'icon' in providerDef
                            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              (providerDef as any).icon
                            : providerDef.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-inter font-semibold text-[14px] text-[var(--text-primary)]">
                            {providerDef.name}
                          </p>
                          <p className="font-inter text-[length:var(--fs-caption)] font-medium text-[var(--text-muted)]">
                            {acc.upiId}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-dashed border-[var(--border)]">
                        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                          <Activity size={12} />
                          <span className="font-inter text-[length:var(--fs-overline)]">
                            {formatDate(acc.lastSynced)}
                          </span>
                        </div>
                        {!isRzp && (
                          <button
                            onClick={() => onSyncAccount(acc)}
                            disabled={syncingAccountId === acc.id}
                            className="flex items-center gap-1.5 text-[var(--teal)] border-none bg-transparent cursor-pointer font-bold text-[length:var(--fs-caption)]"
                          >
                            <RefreshCw
                              size={13}
                              className={syncingAccountId === acc.id ? 'animate-spin' : ''}
                            />
                            Sync
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Shared Wallets */}
          <div className="card px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 font-manrope font-bold text-lg text-[var(--text-primary)]">
                <Users size={18} className="text-[var(--teal)]" />
                Shared Wallets
              </h3>
              <button
                onClick={() => {
                  const name = prompt('Enter Group Name:');
                  if (!name) return;
                  createGroup(name, 'friends', 'Me', '👑');
                }}
                className="font-inter text-xs font-bold text-[var(--teal)] px-3 py-1.5 rounded-lg bg-[var(--teal-dim)] border-none cursor-pointer"
              >
                + Create Wallet
              </button>
            </div>

            {pendingInvites.length > 0 && (
              <div className="mb-4 space-y-2">
                <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Pending Invites
                </h4>
                {pendingInvites.map(inv => (
                  <div
                    key={inv.memberId}
                    className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
                  >
                    <div>
                      <p className="font-bold text-sm text-amber-700 dark:text-amber-400">
                        {inv.groupName}
                      </p>
                      <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                        Invited you
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptInvite(inv.memberId)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold border-none cursor-pointer"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineInvite(inv.memberId)}
                        className="px-3 py-1.5 rounded-lg bg-transparent text-amber-600 text-xs font-bold border border-amber-500/30 cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {groups.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                No active shared wallets. Create one to split bills with friends!
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {groups.map((g: any) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      if (onNavigate) onNavigate('shared');
                    }}
                    className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] flex items-center justify-between hover:border-[var(--teal)] hover:bg-[var(--surface-card)] cursor-pointer text-left w-full transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] border-solid"
                  >
                    <div>
                      <p className="font-bold text-sm text-[var(--text-primary)] m-0">{g.name}</p>
                      <p className="text-xs text-[var(--text-muted)] capitalize m-0 mt-0.5">
                        {g.purpose}
                      </p>
                    </div>
                    <Users size={16} className="text-[var(--text-muted)]" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Payments */}
          <div className="card px-6 py-6">
            <h3 className="flex items-center gap-2 font-manrope font-bold text-lg text-[var(--text-primary)] mb-4">
              <History size={18} className="text-[var(--teal)]" />
              Recent Ingested Payments
            </h3>
            {recentTransactions.length === 0 ? (
              <p className="text-center py-10 text-[var(--text-muted)] text-sm">
                No recent synced payments
              </p>
            ) : (
              <div className="space-y-1">
                {recentTransactions.slice(0, 8).map(tx => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-[var(--surface-input)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--teal-dim)] shrink-0">
                        <CreditCard size={14} className="text-[var(--teal)]" />
                      </div>
                      <div>
                        <p className="font-inter font-semibold text-[13px] text-[var(--text-primary)]">
                          {tx.merchant}
                        </p>
                        <p className="font-inter text-[length:var(--fs-overline)] text-[var(--text-muted)] flex items-center gap-1.5">
                          <Clock size={9} /> {formatDate(tx.date)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-inter font-bold text-[13px] text-[var(--red)]">
                        −{currency}
                        {tx.amount.toFixed(0)}
                      </p>
                      <span className="text-[length:var(--fs-overline)] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--surface-input)] text-[var(--text-muted)]">
                        {tx.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div
            className="card px-6 py-6 border-none text-white shadow-xl"
            style={{ background: 'linear-gradient(135deg, var(--teal) 0%, #0d9488 100%)' }}
          >
            <Sparkles size={20} className="mb-4 text-white/80" />
            <h3 className="font-manrope font-bold text-base mb-2">Heuristic Auto-Detection</h3>
            <p className="font-inter text-xs text-teal-50 leading-relaxed">
              Our local engine analyzes payment descriptions to automatically categorize spend
              without ever sending data to a server.
            </p>
          </div>
          <CloudSync transactions={recentTransactions} onPullTransactions={onAutoAddTransactions} />
          <CSVImporter onImport={onAutoAddTransactions} />
        </div>
      </div>
    </div>
  );
}

export default SyncDashboard;

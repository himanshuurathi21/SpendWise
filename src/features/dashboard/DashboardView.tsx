import { useState, lazy, Suspense, useMemo } from 'react';
import { AppView, SavingsGoal } from '@/types';
import { FinanceState } from '@/types/state';
import LevelProgress from '@/features/gamification/components/LevelProgress';
import DashboardHero from '@/features/dashboard/components/DashboardHero';
import MagicInput from '@/features/ai/components/MagicInput';
import PullToRefresh from '@/components/layout/PullToRefresh';
import { haptic } from '@/core/haptic';
import StatCard from '@/features/dashboard/components/StatCard';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import RecentTransactions from '@/features/dashboard/components/RecentTransactions';
import GoalsSummary from '@/features/dashboard/components/GoalsSummary';
import DailyStats from '@/features/dashboard/components/DailyStats';
import { SafeToSpend } from '@/features/dashboard/components/SafeToSpend';
import { SpendWiseConfig } from '@/types/config';
import { useIsMobile } from '@/hooks/useMediaQuery';
import DashboardViewMobile from '@/features/dashboard/DashboardViewMobile';
import { useDashboardData } from '@/features/dashboard/hooks/useDashboardData';
import { DashboardHeader } from '@/features/dashboard/components/DashboardHeader';
import { AIInsights } from '@/features/dashboard/components/AIInsights';
import { BankSyncCard } from '@/features/dashboard/components/BankSyncCard';
import { getProactiveNudge } from '@/features/analytics/insights/advisor';
import { useStore } from '@/store';

// FSD VIOLATION: lazy-loaded cross-feature components (gamification, etc.)
// Lazy load non-critical/heavy components
const FinanceChartLazy = lazy(() => import('@/features/dashboard/components/FinanceChart'));
const WealthCity = lazy(() => import('@/features/gamification/components/WealthCity'));
const QuestsPanel = lazy(() =>
  import('@/features/gamification/components/QuestsPanel').then(m => ({ default: m.QuestsPanel }))
);
const SavingsChallenges = lazy(() =>
  import('@/features/gamification/components/SavingsChallenges').then(m => ({
    default: m.SavingsChallenges,
  }))
);
const RoundUpVault = lazy(() =>
  import('@/features/gamification/components/RoundUpVault').then(m => ({ default: m.RoundUpVault }))
);
const SocialLeaderboard = lazy(() =>
  import('@/features/gamification/components/SocialLeaderboard').then(m => ({
    default: m.SocialLeaderboard,
  }))
);
const PredictiveForecasting = lazy(() =>
  import('@/features/analytics/components/PredictiveForecasting').then(m => ({
    default: m.PredictiveForecasting,
  }))
);
const StreakShareCard = lazy(() =>
  import('@/features/gamification/components/StreakShareCard').then(m => ({
    default: m.StreakShareCard,
  }))
);
const WeeklyDigestCard = lazy(() =>
  import('@/features/dashboard/components/WeeklyDigestCard').then(m => ({
    default: m.WeeklyDigestCard,
  }))
);
const QuickAddPanel = lazy(() => import('@/features/dashboard/components/QuickAddPanel'));
const PremiumCard = lazy(() => import('@/features/dashboard/components/PremiumCard'));

const WidgetSkeleton = () => (
  <div className="w-full h-32 rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 animate-pulse" />
);

// ─────────────────────────────────────────────────────────────────────────────
// Main DashboardView
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardView({
  financeState,
  onAdd,
  currency,
  onNavigate,
  hideBalances = false,
  onTogglePrivacy,
  config,
  streak: streakProp,
  healthScore: healthScoreProp,
  level: levelProp,
  levelName: levelNameProp,
  savingsRate: savingsRateProp,
  goals: goalsProp,
  netWorth: netWorthProp,
  budgetStats: budgetStatsProp,
}: {
  financeState: FinanceState;
  onAdd: Parameters<typeof MagicInput>[0]['onAdd'];
  onOpenAdd: () => void;
  currency: string;
  onNavigate: (view: AppView) => void;
  hideBalances?: boolean;
  onTogglePrivacy?: () => void;
  config: SpendWiseConfig | null;
  streak?: number;
  healthScore?: number;
  level?: number;
  levelName?: string;
  savingsRate?: number;
  goals?: SavingsGoal[];
  netWorth?: number;
  budgetStats?: Array<{ category: string; limit: number; spent: number }>;
}) {
  const [showAllWidgets, setShowAllWidgets] = useState(false);
  const isMobile = useIsMobile();

  const {
    transactions,
    currentBalance,
    monthlyStats,
    monthlyHistory,
    dailySpendRate,
    balanceTrend,
    predictedEndOfMonth,
  } = financeState;
  const streak = streakProp ?? 0;
  const healthScore = healthScoreProp ?? 75;
  const level = levelProp ?? 1;
  const levelName = levelNameProp ?? 'Beginner';
  const gamificationSavingsRate = savingsRateProp;
  const goals = useMemo(() => goalsProp ?? [], [goalsProp]);
  const netWorth = netWorthProp ?? 0;
  const budgetStats = useMemo(() => budgetStatsProp ?? [], [budgetStatsProp]);
  const razorpayKeys = useStore(s => s.razorpayKeys);
  const [dashboardInput, setDashboardInput] = useState('');

  const budgetMap = useMemo(() => {
    const map: Record<string, { limit: number; spent: number }> = {};
    budgetStats.forEach(b => {
      map[b.category] = { limit: b.limit, spent: b.spent };
    });
    return map;
  }, [budgetStats]);

  const nudge = useMemo(
    () => getProactiveNudge(transactions, budgetMap, goals, streak, currency),
    [transactions, budgetMap, goals, streak, currency]
  );

  const { chartData, recentMerchants, recentTx, trendPct, insights } = useDashboardData(
    transactions,
    monthlyStats,
    monthlyHistory,
    balanceTrend
  );

  const handleRefresh = async () => {
    haptic.medium();
    await new Promise(resolve => setTimeout(resolve, 1500));
    haptic.success();
  };

  if (isMobile) {
    return (
      <DashboardViewMobile
        financeState={financeState}
        onAdd={onAdd}
        currency={currency}
        onNavigate={onNavigate}
        hideBalances={hideBalances}
        config={config}
      />
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen pb-6 md:pb-2">
        <div className="max-w-[1200px] mx-auto">
          {/* Header */}
          <DashboardHeader config={config} isMobile={isMobile} streak={streak} />

          {/* AI Insights - Hidden on mobile unless expanded to save space */}
          {(!isMobile || showAllWidgets) && (
            <AIInsights
              insights={insights}
              transactionsCount={transactions.length}
              currency={currency}
            />
          )}

          {/* Proactive Nudge Alert Strip */}
          {nudge && (
            <div
              className={`mb-4 rounded-2xl p-4 flex items-start gap-3 border ${
                nudge.urgency === 'high'
                  ? 'bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400'
                  : nudge.urgency === 'medium'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : 'bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400'
              }`}
            >
              <span className="text-xl mt-0.5">
                {nudge.urgency === 'high' ? '⚠️' : nudge.urgency === 'medium' ? '💡' : '🔥'}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{nudge.message}</p>
              </div>
              <button
                onClick={() =>
                  onNavigate(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    nudge.action.toLowerCase().replace('create_', '').replace('view_', '') as any
                  )
                }
                className="text-xs font-bold shrink-0 hover:underline"
              >
                Fix →
              </button>
            </div>
          )}

          {/* Core Dashboard Hero */}
          <div className="mb-6">
            <DashboardHero
              currentBalance={currentBalance}
              monthlyStats={monthlyStats}
              balanceTrend={balanceTrend}
              healthScore={healthScore}
              currency={currency}
              hideBalances={hideBalances}
              onTogglePrivacy={onTogglePrivacy}
              predictedEndOfMonth={predictedEndOfMonth}
            />
          </div>

          <div className="dashboard-cols flex flex-col lg:flex-row gap-4 lg:gap-6 items-start w-full">
            {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 min-w-0 w-full lg:flex-1">
              {/* Level Progress */}
              {(!isMobile || showAllWidgets) && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {config?.userRole !== 'student' && (
                    <div className="hidden lg:block lg:col-span-7">
                      <Suspense fallback={<WidgetSkeleton />}>
                        <WealthCity />
                      </Suspense>
                    </div>
                  )}
                  <div
                    className={
                      config?.userRole === 'student'
                        ? 'col-span-full'
                        : 'col-span-full lg:col-span-5'
                    }
                  >
                    <LevelProgress onNavigate={onNavigate} />
                  </div>
                </div>
              )}

              {/* Stat Cards - Hidden on Mobile because DashboardHeroMobile already shows this data! */}
              {!isMobile && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                  <StatCard
                    label="Balance"
                    value={`${currency}${Math.abs(currentBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                    icon={Wallet}
                    iconColor="text-[#6366f1]"
                    iconBg="rgba(99,102,241,0.1)"
                    trend={trendPct >= 0 ? 'up' : 'down'}
                    hideBalances={hideBalances}
                  />
                  <StatCard
                    label="Income"
                    value={`${currency}${monthlyStats.totalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                    icon={TrendingUp}
                    iconColor="text-[#10b981]"
                    iconBg="rgba(16,185,129,0.1)"
                    trend="up"
                    hideBalances={hideBalances}
                  />
                  <StatCard
                    label="Expenses"
                    value={`${currency}${monthlyStats.totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                    icon={TrendingDown}
                    iconColor="text-[#f87171]"
                    iconBg="rgba(248,113,113,0.1)"
                    trend="down"
                    hideBalances={hideBalances}
                  />
                  <StatCard
                    label="Net Worth"
                    value={`${currency}${Math.abs(netWorth).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                    icon={Target}
                    iconColor="text-[#8b5cf6]"
                    iconBg="rgba(139,92,246,0.1)"
                    trend={netWorth >= 0 ? 'up' : 'down'}
                    hideBalances={hideBalances}
                  />
                  <div className="col-span-2 sm:col-span-1">
                    <StatCard
                      label="Health Score"
                      value={`${healthScore}/100`}
                      icon={Sparkles}
                      iconColor="text-[#14b8a6]"
                      iconBg="rgba(20,184,166,0.1)"
                      trend={healthScore > 70 ? 'up' : 'neutral'}
                      hideBalances={false}
                    />
                  </div>
                </div>
              )}

              {/* Weekly Digest - Desktop or Expanded Mobile */}
              {(!isMobile || showAllWidgets) && (
                <Suspense fallback={<WidgetSkeleton />}>
                  <WeeklyDigestCard transactions={transactions} currency={currency} />
                </Suspense>
              )}

              {/* Quick Add Panel - Very important, keep prominent */}
              <div className="w-full">
                <Suspense fallback={<WidgetSkeleton />}>
                  <QuickAddPanel
                    onAdd={onAdd}
                    recentMerchants={recentMerchants}
                    onQuickInput={val => setDashboardInput(val)}
                    dashboardInput={dashboardInput}
                    setDashboardInput={setDashboardInput}
                    transactions={transactions}
                  />
                </Suspense>
              </div>

              {/* Recent Transactions - Keep prominent */}
              <RecentTransactions
                recentTx={recentTx}
                onNavigate={onNavigate}
                hideBalances={hideBalances}
                currency={currency}
              />

              {/* Mobile "Show More" Button */}
              {isMobile && (
                <button
                  onClick={() => setShowAllWidgets(!showAllWidgets)}
                  className="w-full py-4 mt-2 rounded-2xl bg-[var(--surface-light)] border border-[var(--border)] text-[var(--text-primary)] font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  {showAllWidgets ? (
                    <>
                      Hide extra widgets <ChevronUp size={16} />
                    </>
                  ) : (
                    <>
                      Show all widgets & stats <ChevronDown size={16} />
                    </>
                  )}
                </button>
              )}

              {/* Expanded Mobile / Standard Desktop Widgets */}
              {(!isMobile || showAllWidgets) && (
                <div className="flex flex-col gap-4">
                  <Suspense fallback={<WidgetSkeleton />}>
                    <FinanceChartLazy chartData={chartData} currency={currency} />
                  </Suspense>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SafeToSpend
                      transactions={transactions}
                      currency={currency}
                      currentBalance={currentBalance}
                    />
                    <Suspense fallback={<WidgetSkeleton />}>
                      <RoundUpVault transactions={transactions} currency={currency} />
                    </Suspense>
                  </div>

                  <Suspense fallback={<WidgetSkeleton />}>
                    <PredictiveForecasting
                      transactions={transactions}
                      currency={currency}
                      currentBalance={currentBalance}
                    />
                  </Suspense>
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="flex flex-col gap-3 w-full lg:w-[300px] lg:shrink-0">
              {/* Essential right-column items always shown */}
              {config?.userRole !== 'student' && !isMobile && (
                <Suspense fallback={<WidgetSkeleton />}>
                  <PremiumCard currentBalance={currentBalance} currency={currency} />
                </Suspense>
              )}

              {!razorpayKeys && <BankSyncCard onNavigate={onNavigate} />}

              <GoalsSummary goals={goals} onNavigate={onNavigate} />

              {/* Hide the rest of the right column on mobile unless expanded */}
              {(!isMobile || showAllWidgets) && (
                <>
                  <Suspense fallback={<WidgetSkeleton />}>
                    <QuestsPanel transactions={transactions} />
                  </Suspense>
                  <Suspense fallback={<WidgetSkeleton />}>
                    <SocialLeaderboard />
                  </Suspense>
                  {config?.userRole === 'student' && (
                    <div
                      onClick={() => onNavigate('education')}
                      className="card p-4 bg-gradient-to-br from-indigo-600 to-violet-700 text-white cursor-pointer hover:scale-[1.02] transition-transform shadow-xl shadow-indigo-500/20"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-[var(--surface-card)]/20 flex items-center justify-center">
                          <Sparkles size={20} />
                        </div>
                        <h3 className="font-bold text-sm">Learning Center</h3>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed">
                        Master your money with our byte-sized finance lessons. Complete tasks to
                        earn XP!
                      </p>
                    </div>
                  )}
                  <Suspense fallback={<WidgetSkeleton />}>
                    <SavingsChallenges onNavigate={onNavigate} />
                  </Suspense>
                  <DailyStats
                    currency={currency}
                    dailySpendRate={dailySpendRate}
                    streak={streak}
                    transactionCount={transactions.length}
                  />
                  <Suspense fallback={<WidgetSkeleton />}>
                    <StreakShareCard
                      streak={streak}
                      level={level}
                      levelName={levelName}
                      savingsRate={gamificationSavingsRate ?? 0}
                      currency={currency}
                    />
                  </Suspense>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </PullToRefresh>
  );
}

import React, { Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppView, Transaction, Category } from '@/types';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import AlertBanner from '@/components/layout/AlertBanner';
import { DesktopOnlyGuard } from '@/components/layout/DesktopOnlyGuard';

// Lazy loaded views
const AnalyticsView = lazy(() => import('@/features/analytics/AnalyticsView'));
const HistoryView = lazy(() => import('@/features/transactions/HistoryView'));
const RecurringView = lazy(() => import('@/features/recurring/RecurringView'));
const GoalsView = lazy(() => import('@/features/goals/GoalsView'));
const SharedView = lazy(() => import('@/features/shared/SharedView'));
const BankSyncView = lazy(() => import('@/features/sync/BankSyncView'));
const ProfileView = lazy(() => import('@/features/profile/ProfileView'));
const PortfolioView = lazy(() => import('@/features/portfolio/PortfolioView'));
const AdvisorView = lazy(() => import('@/features/advisor/AdvisorView'));
const ReportsView = lazy(() => import('@/features/reports/ReportsView'));
const TaxReport = lazy(() => import('@/features/analytics/components/TaxReport'));
const ParentalView = lazy(() => import('@/features/parental/ParentalView'));
const BudgetManager = lazy(() => import('@/features/budget/components/BudgetManager'));
const SubscriptionManager = lazy(
  () => import('@/features/subscriptions/components/SubscriptionManager')
);
const EducationView = lazy(() => import('@/features/education/EducationView'));
const GamificationView = lazy(() => import('@/features/gamification/GamificationView'));
const ReceiptGallery = lazy(() => import('@/features/transactions/components/ReceiptGallery'));
const DashboardView = lazy(() =>
  import('@/features/dashboard/DashboardView').then(m => ({ default: m.DashboardView }))
);

// Cross-feature injected components (FSD: page layer injects into feature components)
import { PricingCard } from '@/features/pricing/PricingCard';
import { BillingView } from '@/features/billing/BillingView';
import { SubscriptionCalendar } from '@/features/subscriptions/components/SubscriptionCalendar';
import { PriceHikeDetector } from '@/features/subscriptions/components/PriceHikeDetector';
import MandateManager from '@/features/sync/components/MandateManager';
import { useGamification } from '@/features/gamification/hooks/useGamification';
import { useGoals } from '@/features/goals/hooks/useGoals';
import { usePortfolio } from '@/features/portfolio/hooks/usePortfolio';
import { useBudgets } from '@/hooks/useBudgets';

import { SpendWiseConfig } from '@/types/config';
import { SpendWiseStore, ParentalControlState } from '@/store';
import { AppState } from '@/types/state';

interface ViewRendererProps {
  activeView: AppView;
  appState: AppState;
  store: SpendWiseStore;
  pcSettings: ParentalControlState;
  onNavigate: (view: AppView) => void;
  onAdd: (tx: Transaction) => void;
  onPDFReport: () => void;
  config: SpendWiseConfig | null;
  setConfig: (config: SpendWiseConfig) => void;
  resetData: () => Promise<void>;
  userId: string | null;
  onManageCategories?: () => void;
  voiceSearchQuery?: string;
}

const ViewWrapper: React.FC<{
  children: React.ReactNode;
  id: string;
  className?: string;
  activeView: AppView;
}> = ({ children, id, className = 'w-full h-full', activeView: _activeView }) => {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 40,
        opacity: { duration: 0.15 },
      }}
      className={className}
    >
      <ErrorBoundary>
        <Suspense fallback={<SkeletonLoader />}>{children}</Suspense>
      </ErrorBoundary>
    </motion.div>
  );
};

export const ViewRenderer: React.FC<ViewRendererProps> = ({
  activeView,
  appState,
  store,
  pcSettings,
  onNavigate,
  onAdd,
  onPDFReport,
  config,
  setConfig,
  resetData,
  userId,
  onManageCategories,
  voiceSearchQuery,
}) => {
  const {
    financeState,
    budgetState,
    goalsState,
    alertState,
    recurringData,
    transactions,
    currency,
    notifState,
  } = appState;

  const gamificationData = useGamification(transactions);
  const { goals } = useGoals();
  const { netWorth } = usePortfolio();
  const { budgetStats } = useBudgets();
  const injectedPricingCard = (
    <PricingCard currentPlan={config?.isFamily ? 'family' : 'individual'} compact />
  );
  const injectedBillingView = (
    <BillingView
      onPlanChange={plan => {
        setConfig({ ...config, isFamily: plan === 'family' } as SpendWiseConfig);
      }}
    />
  );
  const injectedMandateManager = <MandateManager mandates={store.mandates} currency={currency} />;
  const injectedSubscriptionCalendar = (
    <SubscriptionCalendar subscriptions={[]} currency={currency} />
  );
  const injectedPriceHikeDetector = (
    <PriceHikeDetector transactions={transactions} currency={currency} />
  );

  return (
    <>
      {activeView === 'dashboard' && alertState.alerts.length > 0 && (
        <AlertBanner
          alerts={alertState.alerts}
          onDismiss={alertState.dismissAlert}
          onDismissAll={alertState.dismissAll}
        />
      )}

      <AnimatePresence mode="wait">
        {activeView === 'dashboard' && (
          <ViewWrapper id="dashboard" activeView={activeView}>
            <DashboardView
              financeState={financeState}
              onAdd={onAdd}
              onOpenAdd={() => {
                const el = document.getElementById('magic-input-textarea');
                if (el) {
                  el.focus();
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              currency={currency}
              onNavigate={onNavigate}
              hideBalances={pcSettings.hideBalances}
              onTogglePrivacy={store.togglePrivacy}
              config={config}
              streak={gamificationData.streak}
              healthScore={gamificationData.healthScore}
              level={gamificationData.level}
              levelName={gamificationData.levelName}
              savingsRate={gamificationData.savingsRate}
              goals={goals}
              netWorth={netWorth}
              budgetStats={budgetStats}
            />
          </ViewWrapper>
        )}

        {activeView === 'budget' && (
          <ViewWrapper id="budget" activeView={activeView}>
            <BudgetManager
              budgets={budgetState.budgetStats}
              totalBudgeted={budgetState.totalBudgeted}
              totalSpentAgainstBudget={budgetState.totalSpentAgainstBudget}
              overBudgetCount={budgetState.overBudgetCount}
              period={budgetState.budgetSettings.period}
              periodLabel={budgetState.periodLabel}
              rolloverEnabled={budgetState.budgetSettings.rolloverEnabled}
              onUpdateLimit={budgetState.setBudget}
              onDeleteLimit={budgetState.removeBudget}
              onResetLimits={budgetState.resetLimits}
              onChangePeriod={budgetState.updatePeriod}
              onToggleRollover={budgetState.toggleRollover}
              onManageCategories={onManageCategories}
              currency={currency}
              transactions={transactions}
            />
          </ViewWrapper>
        )}

        {activeView === 'analytics' && (
          <DesktopOnlyGuard viewLabel="Statistics & Analytics" onNavigate={onNavigate}>
            <ViewWrapper id="analytics" activeView={activeView} className="w-full h-full space-y-6">
              <AnalyticsView
                monthlyHistory={financeState.monthlyHistory}
                monthlyStats={financeState.monthlyStats}
                categorySpending={financeState.categorySpending}
                totalSpent={financeState.totalSpent}
                currency={currency}
                transactions={transactions}
                onNavigate={onNavigate}
                config={config}
              />
              <RecurringView
                patterns={recurringData}
                currency={currency}
                transactions={transactions}
                subscriptionCalendar={injectedSubscriptionCalendar}
                priceHikeDetector={injectedPriceHikeDetector}
              />
            </ViewWrapper>
          </DesktopOnlyGuard>
        )}

        {activeView === 'goals' && (
          <ViewWrapper id="goals" activeView={activeView}>
            <GoalsView
              goals={goalsState.goals}
              stats={goalsState.stats}
              onAdd={data => {
                goalsState.addGoal({
                  name: data.name,
                  emoji: data.emoji,
                  targetAmount: Number(data.targetAmount),
                  savedAmount: Number(data.savedAmount) || 0,
                  targetDate: data.targetDate,
                  monthlyContribution: Number(data.monthlyContribution),
                  color: data.color,
                });
              }}
              onUpdate={goalsState.updateGoal}
              onDelete={goalsState.deleteGoal}
              onContribute={goalsState.addContribution}
              currency={currency}
              transactions={transactions}
            />
          </ViewWrapper>
        )}

        {activeView === 'shared' && (
          <ViewWrapper id="shared" activeView={activeView}>
            <SharedView currency={currency} userId={userId} />
          </ViewWrapper>
        )}

        {activeView === 'history' && (
          <ViewWrapper id="history" activeView={activeView}>
            <HistoryView
              transactions={transactions}
              onCategoryChange={async (id: string, newCategory: string) => {
                financeState.updateTransactionCategory(id, newCategory as Category);
              }}
              onDelete={financeState.deleteTransaction}
              onBulkDelete={financeState.bulkDeleteTransactions}
              onBulkCategoryChange={financeState.bulkUpdateTransactionsCategory}
              onImportClick={() => onNavigate('sync')}
              onPDFReport={onPDFReport}
              currency={currency}
              initialSearchQuery={voiceSearchQuery}
            />
          </ViewWrapper>
        )}

        {activeView === 'sync' && (
          <ViewWrapper id="sync" activeView={activeView}>
            <BankSyncView
              onAutoAddTransactions={txs => {
                financeState.addTransactions(txs);
              }}
              recentTransactions={transactions.filter(
                (t: Transaction) =>
                  t.tags?.includes('razorpay') ||
                  t.tags?.includes('upi') ||
                  t.tags?.includes('upi-sync')
              )}
              currency={currency}
              onNavigate={onNavigate}
            />
          </ViewWrapper>
        )}

        {activeView === 'profile' && (
          <ViewWrapper id="profile" activeView={activeView}>
            <ProfileView
              config={config}
              onUpdateConfig={setConfig}
              onResetData={async () => {
                await resetData();
                if (config) {
                  const nextConfig = { ...config, initialBalance: 0 };
                  setConfig(nextConfig);
                }
              }}
              transactions={transactions}
              onNavigate={onNavigate}
              addNotification={notifState.addNotification}
              pricingCard={injectedPricingCard}
              billingView={injectedBillingView}
            />
          </ViewWrapper>
        )}

        {activeView === 'parental' && (
          <ViewWrapper id="parental" activeView={activeView}>
            <ParentalView />
          </ViewWrapper>
        )}

        {activeView === 'portfolio' && (
          <DesktopOnlyGuard viewLabel="Net Worth & Portfolio" onNavigate={onNavigate}>
            <ViewWrapper id="portfolio" activeView={activeView}>
              <PortfolioView currency={currency} financeState={financeState} config={config} />
            </ViewWrapper>
          </DesktopOnlyGuard>
        )}

        {activeView === 'subscriptions' && (
          <ViewWrapper id="subscriptions" activeView={activeView}>
            <SubscriptionManager
              patterns={recurringData}
              currency={currency}
              mandateManager={injectedMandateManager}
            />
          </ViewWrapper>
        )}

        {activeView === 'advisor' && (
          <ViewWrapper id="advisor" activeView={activeView}>
            <AdvisorView onNavigate={onNavigate} />
          </ViewWrapper>
        )}

        {activeView === 'education' && (
          <DesktopOnlyGuard viewLabel="Financial Education" onNavigate={onNavigate}>
            <ViewWrapper id="education" activeView={activeView}>
              <EducationView
                currency={currency}
                financeState={financeState}
                addNotification={notifState.addNotification}
                config={config}
              />
            </ViewWrapper>
          </DesktopOnlyGuard>
        )}

        {activeView === 'reports' && (
          <DesktopOnlyGuard viewLabel="Reports" onNavigate={onNavigate}>
            <ViewWrapper id="reports" activeView={activeView}>
              <ReportsView
                transactions={transactions}
                currency={currency}
                monthlyStats={financeState.monthlyStats}
              />
            </ViewWrapper>
          </DesktopOnlyGuard>
        )}

        {activeView === 'taxreport' && (
          <DesktopOnlyGuard viewLabel="ITR Tax Report" onNavigate={onNavigate}>
            <ViewWrapper id="taxreport" activeView={activeView}>
              <TaxReport transactions={transactions} currency={currency} />
            </ViewWrapper>
          </DesktopOnlyGuard>
        )}

        {(activeView === 'quests' ||
          activeView === 'badges' ||
          activeView === 'inventory' ||
          activeView === 'shop' ||
          activeView === 'gamification') && (
          <ViewWrapper id={activeView} activeView={activeView}>
            <GamificationView
              transactions={transactions}
              goals={goalsState.goals}
              currency={currency}
              onNavigate={onNavigate}
            />
          </ViewWrapper>
        )}

        {/* Alias: transactions → HistoryView */}
        {activeView === 'transactions' && (
          <ViewWrapper id="transactions" activeView={activeView}>
            <HistoryView
              transactions={transactions}
              onCategoryChange={async (id: string, newCategory: string) => {
                financeState.updateTransactionCategory(id, newCategory as Category);
              }}
              onDelete={financeState.deleteTransaction}
              onBulkDelete={financeState.bulkDeleteTransactions}
              onBulkCategoryChange={financeState.bulkUpdateTransactionsCategory}
              onImportClick={() => onNavigate('sync')}
              onPDFReport={onPDFReport}
              currency={currency}
            />
          </ViewWrapper>
        )}

        {activeView === 'receipts' && (
          <ViewWrapper id="receipts" activeView={activeView}>
            <ReceiptGallery transactions={transactions} currency={currency} />
          </ViewWrapper>
        )}

        {/* Alias: settings → ProfileView */}
        {activeView === 'settings' && (
          <ViewWrapper id="settings" activeView={activeView}>
            <ProfileView
              config={config}
              onUpdateConfig={setConfig}
              onResetData={async () => {
                await resetData();
              }}
              transactions={transactions}
              onNavigate={onNavigate}
              addNotification={notifState.addNotification}
              pricingCard={injectedPricingCard}
              billingView={injectedBillingView}
            />
          </ViewWrapper>
        )}
      </AnimatePresence>
    </>
  );
};

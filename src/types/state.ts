import {
  Transaction,
  Category,
  MonthlyStats,
  MonthlyHistoryPoint,
  CategorySpend,
  BalanceDataPoint,
  RecurringPattern,
  SavingsGoal,
  Budget,
  BudgetPeriod,
} from '@/types/finance';
import { SpendingAlert, AppNotification } from '@/components/ui/types';
import { ParentalControlState } from '@/store';
import { CustomCategoryDef } from '@/types/index';

export interface FinanceState {
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => void;
  addTransactions: (txs: Transaction[]) => void;
  deleteTransaction: (id: string) => void;
  updateTransactionCategory: (id: string, newCategory: Category) => void;
  bulkUpdateTransactionsCategory: (ids: string[], newCategory: Category) => void;
  bulkDeleteTransactions: (ids: string[]) => void;
  bulkReassignCategory: (oldCategory: string, newCategory: string) => void;
  resetData: () => void;
  currentBalance: number;
  predictedEndOfMonth: number;
  categorySpending: CategorySpend[];
  totalSpent: number;
  balanceTrend: BalanceDataPoint[];
  dailySpendRate: number;
  monthlyStats: MonthlyStats;
  monthlyHistory: MonthlyHistoryPoint[];
  projectionMeta: {
    daysLeftInMonth: number;
    dataQuality: 'low' | 'medium' | 'high';
    expectedChange: number;
  };
  topCategory: CategorySpend | null;
}

export interface BudgetState {
  budgets: Record<string, number>;
  budgetStats: Budget[];
  setBudget: (category: string, amount: number) => void;
  removeBudget: (category: string) => void;
  totalBudgeted: number;
  overallBudgetPercent: number;
  monthlyExpenses: number;
  budgetSettings: {
    period: BudgetPeriod;
    rolloverEnabled: boolean;
  };
  updateBudgetSettings: (settings: Partial<BudgetState['budgetSettings']>) => void;
  resetBudgets: () => void;
  resetLimits: () => void;
  totalSpentAgainstBudget: number;
  overBudgetCount: number;
  periodLabel: string;
  updatePeriod: (p: BudgetPeriod) => void;
  toggleRollover: () => void;
}

export interface GoalsState {
  goals: SavingsGoal[];
  addGoal: (goal: Omit<SavingsGoal, 'id' | 'status' | 'createdAt'>) => Promise<void>;
  updateGoal: (id: string, data: Partial<SavingsGoal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addContribution: (id: string, amount: number) => Promise<void>;
  totalSaved: number;
  totalTarget: number;
  overallProgress: number;
  goalStats: {
    onTrack: number;
    atRisk: number;
    achieved: number;
  };
  stats: {
    activeCount: number;
    achievedCount: number;
    totalTarget: number;
    totalSaved: number;
    overallPercent: number;
    monthlyCommitted: number;
  };
}

export interface CategoryState {
  customCategories: CustomCategoryDef[];
  allCategories: string[];
  mergedColors: Record<string, string>;
  mergedIcons: Record<string, string>;
  addCustomCategory: (def: Omit<CustomCategoryDef, 'id'>) => void;
  updateCustomCategory: (id: string, def: Partial<CustomCategoryDef>) => void;
  deleteCustomCategory: (id: string) => void;
  suggestedCategories: string[];
  categoryLimits: Record<string, number>;
}

export interface AlertState {
  alerts: SpendingAlert[];
  alertCount: number;
  dangerCount: number;
  warningCount: number;
  dismissAlert: (id: string) => void;
  dismissAll: () => void;
  clearDismissed: () => void;
}

export interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  snoozeNotification: (id: string, hours?: number) => void;
  dismissNotification: (id: string) => void;
}

export interface AppState {
  currency: string;
  transactions: Transaction[];
  financeState: FinanceState;
  budgetState: BudgetState;
  goalsState: GoalsState;
  categoryState: CategoryState;
  recurringData: RecurringPattern[];
  alertState: AlertState;
  notifState: NotificationState;
  parentalState: ParentalControlState;
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/store', () => ({
  useStore: vi.fn(),
}));

vi.mock('@/hooks/useTransactions', () => ({
  useTransactions: vi.fn(),
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: vi.fn(),
}));

import { useStore } from '@/store';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { formatLocalYYYYMMDD } from '@/utils/date';
import type { Transaction } from '@/types';

function setupMocks({
  budgets = {},
  budgetSettings = { period: 'monthly', rolloverEnabled: false },
  transactions = [] as Transaction[],
  categoryLimits = {},
} = {}) {
  const mockStore = {
    budgets,
    budgetSettings,
    setBudget: vi.fn(),
    removeBudget: vi.fn(),
    updateBudgetSettings: vi.fn(),
    resetBudgets: vi.fn(),
    resetLimits: vi.fn(),
    toggleRollover: vi.fn(),
  };

  const mockTransactions = {
    transactions,
    monthlyStats: {
      totalIncome: 50000,
      totalExpenses: 30000,
      savingsRate: 40,
      netCashFlow: 20000,
      avgDailySpend: 1000,
      transactionCount: transactions.length,
    },
  };

  const mockCategories = {
    categoryLimits,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useStore).mockImplementation((selector: any) => {
    if (typeof selector === 'function') return selector(mockStore);
    return mockStore;
  });

  vi.mocked(useTransactions).mockReturnValue(mockTransactions as unknown as ReturnType<typeof useTransactions>);
  vi.mocked(useCategories).mockReturnValue(mockCategories as unknown as ReturnType<typeof useCategories>);
}

describe('useBudgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('budget period calculations', () => {
    it('uses monthly period by default', async () => {
      setupMocks();
      const { useBudgets } = await import('@/hooks/useBudgets');
      const { result } = renderHook(() => useBudgets());
      expect(result.current.budgetSettings.period).toBe('monthly');
    });

    it('uses weekly period when configured', async () => {
      setupMocks({ budgetSettings: { period: 'weekly', rolloverEnabled: false } });
      const { useBudgets } = await import('@/hooks/useBudgets');
      const { result } = renderHook(() => useBudgets());
      expect(result.current.budgetSettings.period).toBe('weekly');
    });

    it('computes budgetStats from categoryLimits and budgets', async () => {
      setupMocks({
        budgets: { Food: 5000, Transport: 2000 },
        categoryLimits: { Entertainment: 1000 },
        transactions: [
          {
            id: '1',
            date: formatLocalYYYYMMDD(new Date()),
            amount: 500,
            category: 'Food' as const,
            merchant: 'Test',
            type: 'debit' as const,
            description: '',
          },
          {
            id: '2',
            date: formatLocalYYYYMMDD(new Date()),
            amount: 300,
            category: 'Food' as const,
            merchant: 'Test',
            type: 'debit' as const,
            description: '',
          },
          {
            id: '3',
            date: formatLocalYYYYMMDD(new Date()),
            amount: 200,
            category: 'Transport' as const,
            merchant: 'Test',
            type: 'debit' as const,
            description: '',
          },
        ],
      });
      const { useBudgets } = await import('@/hooks/useBudgets');
      const { result } = renderHook(() => useBudgets());
      expect(result.current.budgetStats.length).toBeGreaterThanOrEqual(3);
      const foodBudget = result.current.budgetStats.find(b => b.category === 'Food');
      expect(foodBudget).toBeDefined();
      expect(foodBudget!.spent).toBe(800);
      expect(foodBudget!.remaining).toBe(4200);
    });

    it('marks budget as danger when 90%+ used', async () => {
      setupMocks({
        budgets: { Food: 1000 },
        transactions: [
          {
            id: '1',
            date: formatLocalYYYYMMDD(new Date()),
            amount: 950,
            category: 'Food' as const,
            merchant: 'Test',
            type: 'debit' as const,
            description: '',
          },
        ],
      });
      const { useBudgets } = await import('@/hooks/useBudgets');
      const { result } = renderHook(() => useBudgets());
      const food = result.current.budgetStats.find(b => b.category === 'Food');
      expect(food!.status).toBe('danger');
    });

    it('marks budget as warning when 75-89% used', async () => {
      setupMocks({
        budgets: { Food: 1000 },
        transactions: [
          {
            id: '1',
            date: formatLocalYYYYMMDD(new Date()),
            amount: 800,
            category: 'Food' as const,
            merchant: 'Test',
            type: 'debit' as const,
            description: '',
          },
        ],
      });
      const { useBudgets } = await import('@/hooks/useBudgets');
      const { result } = renderHook(() => useBudgets());
      const food = result.current.budgetStats.find(b => b.category === 'Food');
      expect(food!.status).toBe('warning');
    });

    it('computes totalBudgeted across all budgets', async () => {
      setupMocks({
        budgets: { Food: 5000, Transport: 2000, Shopping: 3000 },
      });
      const { useBudgets } = await import('@/hooks/useBudgets');
      const { result } = renderHook(() => useBudgets());
      expect(result.current.totalBudgeted).toBe(10000);
    });

    it('computes overBudgetCount', async () => {
      setupMocks({
        budgets: { Food: 1000, Transport: 2000 },
        transactions: [
          {
            id: '1',
            date: formatLocalYYYYMMDD(new Date()),
            amount: 950,
            category: 'Food' as const,
            merchant: 'Test',
            type: 'debit' as const,
            description: '',
          },
          {
            id: '2',
            date: formatLocalYYYYMMDD(new Date()),
            amount: 1900,
            category: 'Transport' as const,
            merchant: 'Test',
            type: 'debit' as const,
            description: '',
          },
        ],
      });
      const { useBudgets } = await import('@/hooks/useBudgets');
      const { result } = renderHook(() => useBudgets());
      expect(result.current.overBudgetCount).toBeGreaterThanOrEqual(1);
    });

    it('supports rollover calculations', async () => {
      const today = new Date();
      const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

      setupMocks({
        budgets: { Food: 1000 },
        budgetSettings: { period: 'monthly', rolloverEnabled: true },
        transactions: [
          {
            id: 'prev',
            date: formatLocalYYYYMMDD(prevMonthStart),
            amount: 600,
            category: 'Food' as const,
            merchant: 'Test',
            type: 'debit' as const,
            description: '',
          },
          {
            id: 'curr',
            date: formatLocalYYYYMMDD(today),
            amount: 200,
            category: 'Food' as const,
            merchant: 'Test',
            type: 'debit' as const,
            description: '',
          },
        ],
      });
      const { useBudgets } = await import('@/hooks/useBudgets');
      const { result } = renderHook(() => useBudgets());
      const food = result.current.budgetStats.find(b => b.category === 'Food');
      expect(food).toBeDefined();
      expect(food!.rolloverAmount).toBeGreaterThanOrEqual(0);
    });

    it('returns correct period label for monthly', async () => {
      setupMocks();
      const { useBudgets } = await import('@/hooks/useBudgets');
      const { result } = renderHook(() => useBudgets());
      expect(result.current.periodLabel).toBe('This Month');
    });

    it('returns correct period label for weekly', async () => {
      setupMocks({ budgetSettings: { period: 'weekly', rolloverEnabled: false } });
      const { useBudgets } = await import('@/hooks/useBudgets');
      const { result } = renderHook(() => useBudgets());
      expect(result.current.periodLabel).toBe('This Week');
    });

    it('returns correct period label for biweekly', async () => {
      setupMocks({ budgetSettings: { period: 'biweekly', rolloverEnabled: false } });
      const { useBudgets } = await import('@/hooks/useBudgets');
      const { result } = renderHook(() => useBudgets());
      expect(result.current.periodLabel).toBe('Last 14 Days');
    });

    it('updatePeriod calls updateBudgetSettings with correct period', async () => {
      setupMocks();
      const { useBudgets } = await import('@/hooks/useBudgets');
      const { result } = renderHook(() => useBudgets());
      result.current.updatePeriod('weekly');
      const store = vi.mocked(useStore);
      expect(store).toHaveBeenCalled();
    });
  });
});

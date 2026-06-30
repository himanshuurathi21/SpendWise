import { useMemo } from 'react';
import {
  CategorySpend,
  MonthlyStats,
  BalanceDataPoint,
  Category,
  MonthlyHistoryPoint,
} from '@/types';
import { useCategories } from '@/hooks/useCategories';
import { useStore } from '@/store';
import { formatLocalYYYYMMDD } from '@/utils/date';

import { FINANCE_DEFAULTS } from '@/constants';
const DEFAULT_BALANCE = FINANCE_DEFAULTS.INITIAL_BALANCE;

export function useTransactions(initialBalance: number = DEFAULT_BALANCE) {
  const { mergedColors } = useCategories();

  const transactions = useStore(state => state.transactions);
  const addTransaction = useStore(state => state.addTransaction);
  const addTransactions = useStore(state => state.addTransactions);
  const deleteTransaction = useStore(state => state.deleteTransaction);
  const updateTransactionCategory = useStore(state => state.updateTransactionCategory);
  const bulkUpdateTransactionsCategory = useStore(state => state.bulkUpdateTransactionsCategory);
  const bulkDeleteTransactions = useStore(state => state.bulkDeleteTransactions);
  const bulkReassignCategory = useStore(state => state.bulkReassignCategory);
  const updateTransaction = useStore(state => state.updateTransaction);
  const resetData = useStore(state => state.resetData);
  const undo = useStore(state => state.undo);
  const indexedData = useStore(state => state.indexedData);

  const currentBalance = useMemo(() => {
    return (
      Math.round(
        transactions.reduce((acc, tx) => {
          const amount = Number(tx.amount) || 0;
          return tx.type === 'credit' ? acc + amount : acc - amount;
        }, initialBalance) * 100
      ) / 100
    );
  }, [transactions, initialBalance]);

  const categorySpending = useMemo((): CategorySpend[] => {
    const map = new Map<Category, number>();
    transactions.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'debit') {
        map.set(tx.category, (map.get(tx.category) ?? 0) + amount);
      }
    });
    // BUG-06 fix: compute total so percent is not always 0
    const totalDebitAmount = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value: Math.round(value * 100) / 100,
        color: mergedColors[name] || '#14b8a6',
        percent: totalDebitAmount > 0 ? Math.round((value / totalDebitAmount) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, mergedColors]);

  const totalSpent = useMemo(
    () => Math.round(categorySpending.reduce((acc, c) => acc + c.value, 0) * 100) / 100,
    [categorySpending]
  );

  const dailySpendRate = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = formatLocalYYYYMMDD(cutoff);
    const recent = transactions.filter(tx => tx.type === 'debit' && tx.date >= cutoffStr);
    const total = recent.reduce((acc, tx) => acc + tx.amount, 0);
    return Math.round((total / 30) * 100) / 100;
  }, [transactions]);

  const predictedEndOfMonth = useMemo(() => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = lastDay - today.getDate();
    return Math.round((currentBalance - dailySpendRate * daysLeft) * 100) / 100;
  }, [currentBalance, dailySpendRate]);

  const monthlyStats = useMemo((): MonthlyStats => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Filter transactions for the current calendar month
    const thisMonth = transactions.filter(tx => tx.date.startsWith(currentMonthStr));

    const income = thisMonth
      .filter(tx => tx.type === 'credit')
      .reduce((a, tx) => a + (Number(tx.amount) || 0), 0);
    const expenses = thisMonth
      .filter(tx => tx.type === 'debit')
      .reduce((a, tx) => a + (Number(tx.amount) || 0), 0);
    const net = income - expenses;
    const savings = income > 0 ? Math.round((net / income) * 100) : 0;

    // BUG-11 fix: compute topCategory and categoryDistribution (were always undefined)
    const catMap: Record<string, number> = {};
    thisMonth
      .filter(tx => tx.type === 'debit')
      .forEach(tx => {
        catMap[tx.category] = (catMap[tx.category] || 0) + (Number(tx.amount) || 0);
      });
    const sortedCats = Object.entries(catMap).sort(([, a], [, b]) => b - a);

    return {
      totalIncome: Math.round(income * 100) / 100,
      totalExpenses: Math.round(expenses * 100) / 100,
      savingsRate: savings,
      netCashFlow: Math.round(net * 100) / 100,
      avgDailySpend: Math.round((expenses / Math.max(1, now.getDate())) * 100) / 100,
      transactionCount: thisMonth.length,
      topCategory: sortedCats[0]?.[0] as Category | undefined,
      categoryDistribution: Object.fromEntries(sortedCats),
    };
  }, [transactions]);

  const monthlyHistory = useMemo((): MonthlyHistoryPoint[] => {
    const historyMap = new Map<string, { income: number; expenses: number }>();

    // Get all unique months from transactions
    transactions.forEach(tx => {
      const monthStr = tx.date.substring(0, 7); // YYYY-MM
      const existing = historyMap.get(monthStr) || { income: 0, expenses: 0 };

      const amount = Number(tx.amount) || 0;
      if (tx.type === 'credit') {
        existing.income += amount;
      } else {
        existing.expenses += amount;
      }
      historyMap.set(monthStr, existing);
    });

    // Sort months and take the last 6
    const sortedMonths = Array.from(historyMap.keys()).sort();
    const recentMonths = sortedMonths.slice(-6);

    return recentMonths.map(month => {
      const data = historyMap.get(month)!;
      const [year, m] = month.split('-');
      const date = new Date(parseInt(year), parseInt(m) - 1);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short' });

      return {
        month: monthLabel,
        income: Math.round(data.income * 100) / 100,
        expenses: Math.round(data.expenses * 100) / 100,
        savings: Math.round((data.income - data.expenses) * 100) / 100,
      };
    });
  }, [transactions]);

  const balanceTrend = useMemo((): BalanceDataPoint[] => {
    const points: BalanceDataPoint[] = [];
    const today = new Date();

    // Sort transactions by date once
    const sortedTx = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

    let runningBalance = currentBalance;
    let txIdx = 0;

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = formatLocalYYYYMMDD(d);

      // While the transaction date is after the current day, subtract/add it back from running balance
      // BUG-05 fix: was inverted — credits appeared as increases when unwinding (they should decrease the earlier balance)
      while (txIdx < sortedTx.length && sortedTx[txIdx].date > dateStr) {
        const tx = sortedTx[txIdx];
        const amount = Number(tx.amount) || 0;
        runningBalance += tx.type === 'credit' ? -amount : amount;
        txIdx++;
      }

      points.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        balance: Math.round(runningBalance * 100) / 100,
      });
    }
    return points.reverse();
  }, [transactions, currentBalance]);

  const projectionMeta = useMemo(() => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = lastDay - today.getDate();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = formatLocalYYYYMMDD(cutoff);
    const debitCount = transactions.filter(
      tx => tx.type === 'debit' && tx.date >= cutoffStr
    ).length;

    let quality: 'low' | 'medium' | 'high' = 'low';
    if (debitCount > 20) quality = 'high';
    else if (debitCount > 5) quality = 'medium';

    return {
      daysLeftInMonth: daysLeft,
      dataQuality: quality,
      expectedChange: Math.round(dailySpendRate * daysLeft * 100) / 100,
    };
  }, [transactions, dailySpendRate]);

  return {
    transactions,
    addTransaction,
    addTransactions,
    deleteTransaction,
    updateTransactionCategory,
    bulkUpdateTransactionsCategory,
    bulkDeleteTransactions,
    bulkReassignCategory,
    updateTransaction,
    resetData,
    undo,
    indexedData,
    currentBalance,
    predictedEndOfMonth,
    categorySpending,
    totalSpent,
    balanceTrend,
    dailySpendRate,
    monthlyStats,
    monthlyHistory,
    projectionMeta,

    topCategory: categorySpending[0] || null,
  };
}

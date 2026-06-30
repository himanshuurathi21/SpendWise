import { Transaction, RecurringPattern } from '@/types';
import { formatLocalYYYYMMDD } from '@/utils/date';

const MIN_OCCURRENCES = 2;

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatLocalYYYYMMDD(d);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.abs(Math.round((db.getTime() - da.getTime()) / 86_400_000));
}

function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function detectFrequency(avgDays: number): RecurringPattern['frequency'] {
  if (avgDays >= 6 && avgDays <= 8) return 'weekly';
  if (avgDays >= 25 && avgDays <= 45) return 'monthly';
  if (avgDays >= 360 && avgDays <= 370) return 'annual';
  if (avgDays <= 10) return 'weekly';
  if (avgDays <= 90) return 'monthly';
  return 'annual';
}

export function detectRecurringPatterns(transactions: Transaction[]): RecurringPattern[] {
  const groups = new Map<string, Transaction[]>();

  transactions
    .filter(tx => tx.type === 'debit')
    .forEach(tx => {
      const key = normalise(tx.merchant);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(tx);
    });

  const patterns: RecurringPattern[] = [];

  groups.forEach(txs => {
    if (txs.length < MIN_OCCURRENCES) return;

    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
    }

    const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 30;

    const variance =
      gaps.length > 1 ? gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length : 0;
    const cv = avgGap > 0 ? Math.sqrt(variance) / avgGap : 1;
    if (cv > 0.6 && txs.length < 4) return;

    const freq = detectFrequency(avgGap);

    const lastSeen = sorted[sorted.length - 1].date;
    const nextGap = freq === 'weekly' ? 7 : freq === 'monthly' ? 30 : 365;
    const nextExpected = addDays(lastSeen, nextGap);
    const totalSpent = sorted.reduce((a, b) => a + b.amount, 0);
    const avgAmount = totalSpent / sorted.length;

    const lastAmount = sorted[sorted.length - 1].amount;
    const prevTxs = sorted.slice(0, -1);
    const avgPrevAmount =
      prevTxs.length > 0 ? prevTxs.reduce((a, tx) => a + tx.amount, 0) / prevTxs.length : avgAmount;

    const priceCreep = lastAmount > avgPrevAmount * 1.05;

    patterns.push({
      merchant: sorted[0].merchant,
      category: sorted[0].category,
      avgAmount: Math.round(avgAmount * 100) / 100,
      frequency: freq,
      lastSeen,
      nextExpected,
      occurrences: sorted.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      priceCreep,
    });
  });

  return patterns.sort((a, b) => b.totalSpent - a.totalSpent);
}

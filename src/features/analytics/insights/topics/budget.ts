import { Transaction } from '@/types';
import type { FinancialBriefing } from '../advisor';

export function handleBudgetQuery(
  query: string,
  _txs: Transaction[],
  briefing: FinancialBriefing,
  currency: string
): string | null {
  const q = query.toLowerCase();
  const C = (v: number) => `${currency}${v.toLocaleString('en-IN')}`;
  const top = briefing.topCategories[0];
  const top2 = briefing.topCategories[1];
  const isInDef = briefing.net < 0;

  if (!/budget|over.?spend|deficit|limit/.test(q)) return null;

  if (isInDef)
    return `You're in a **deficit of ${C(Math.abs(briefing.net))}** this period. Your top two leaks are **${top?.name ?? 'spending'}** (${C(top?.amount ?? 0)}) and **${top2?.name ?? 'other'}** (${C(top2?.amount ?? 0)}). Start with a strict limit on just these two categories.\n\n[ACTION:CREATE_BUDGET]`;
  return `Your budget is healthy — **${C(briefing.net)} surplus** this period (${briefing.savingsRate}% savings rate). To stay ahead, set limits on **${top?.name ?? 'your top category'}** before next month starts.\n\n[ACTION:CREATE_BUDGET]`;
}

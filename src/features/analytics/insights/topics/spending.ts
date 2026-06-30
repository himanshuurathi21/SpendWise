import { Transaction } from '@/types';
import type { FinancialBriefing } from '../advisor';

export function handleSpendingQuery(
  query: string,
  _txs: Transaction[],
  briefing: FinancialBriefing,
  currency: string
): string | null {
  const q = query.toLowerCase();
  const C = (v: number) => `${currency}${v.toLocaleString('en-IN')}`;
  const top = briefing.topCategories[0];

  // Largest expense
  if (/largest|biggest|highest|most expensive|single/.test(q)) {
    if (!briefing.largestExpense) return 'No expenses logged yet.';
    return `Your largest single expense was **${briefing.largestExpense.merchant}** for **${C(briefing.largestExpense.amount)}** in **${briefing.largestExpense.category}**. If this was a one-off, great. If it repeats, consider setting a budget for that category.\n\n[ACTION:VIEW_HISTORY]`;
  }

  // Spending breakdown / where did my money go
  if (/spend|spent|where|breakdown|categor|money go/.test(q)) {
    if (!top)
      return "No debit transactions yet. Start logging your expenses and I'll give you a full breakdown.";
    const catList = briefing.topCategories
      .slice(0, 3)
      .map(c => `— **${c.name}** ${C(c.amount)} (${c.percent}%)`)
      .join('\n');
    return `You've spent **${C(briefing.totalSpent)}** total. Here's where it went:\n\n${catList}\n\nYour daily average is **${C(briefing.avgDailySpend)}/day**.\n\n[ACTION:VIEW_ANALYTICS]`;
  }

  // Merchant-specific questions
  if (/merchant|shop|store|vendor|restaurant|amazon|flipkart|swiggy|zomato/.test(q)) {
    const top3m = briefing.topMerchants
      .slice(0, 3)
      .map(m => `— **${m.name}**: ${C(m.amount)}`)
      .join('\n');
    return `Your top merchants by spend:\n\n${top3m || '— No merchant data yet'}\n\n[ACTION:VIEW_HISTORY]`;
  }

  return null;
}

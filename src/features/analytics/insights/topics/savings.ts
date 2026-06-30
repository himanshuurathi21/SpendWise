import { Transaction } from '@/types';
import type { FinancialBriefing } from '../advisor';

export function handleSavingsQuery(
  query: string,
  _txs: Transaction[],
  briefing: FinancialBriefing,
  currency: string
): string | null {
  const q = query.toLowerCase();
  const C = (v: number) => `${currency}${v.toLocaleString('en-IN')}`;
  const top = briefing.topCategories[0];
  const noIncome = briefing.totalIncome === 0;

  if (!/sav(e|ing|ings)|investm|mutual fund|sip|fd|fixed deposit/.test(q)) return null;

  if (noIncome)
    return `No income logged yet. Add your salary or income source so I can calculate your savings rate.\n\n[ACTION:ADD_TRANSACTION]`;
  if (briefing.savingsRate < 0)
    return `You're spending **${Math.abs(briefing.savingsRate)}% more than you earn**. Before saving, close the gap — cut ${C(Math.abs(briefing.net))} from monthly expenses. Your highest cost is **${top?.name}** at ${C(top?.amount ?? 0)}.\n\n[ACTION:CREATE_BUDGET]`;
  if (briefing.savingsRate < 10)
    return `Your savings rate is **${briefing.savingsRate}%** — below the healthy 20% benchmark. Redirect just ${C(Math.round(briefing.totalIncome * 0.2 - briefing.net))} more per month from **${top?.name}** to hit 20%. Consider a recurring SIP on your payday.\n\n[ACTION:SET_GOAL]`;
  if (briefing.savingsRate < 20)
    return `Savings rate: **${briefing.savingsRate}%** — getting there. To hit 20%, reduce **${top?.name}** spending by about ${C(Math.round(briefing.topCategories[0]?.amount * 0.15 || 0))} next month.\n\n[ACTION:SET_GOAL]`;
  return `Excellent! Savings rate: **${briefing.savingsRate}%** — above the 20% benchmark. Your surplus of **${C(briefing.net)}** should be working harder. Have you set a goal to channel it?\n\n[ACTION:SET_GOAL]`;
}

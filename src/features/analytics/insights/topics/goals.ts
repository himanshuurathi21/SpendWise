import { Transaction } from '@/types';
import type { FinancialBriefing } from '../advisor';

export function handleGoalsQuery(
  query: string,
  _txs: Transaction[],
  briefing: FinancialBriefing,
  currency: string
): string | null {
  const q = query.toLowerCase();
  const C = (v: number) => `${currency}${v.toLocaleString('en-IN')}`;

  if (!/goal|target|dream|plan|milestone/.test(q)) return null;

  if (briefing.net <= 0)
    return `To set meaningful goals, first close your current deficit of **${C(Math.abs(briefing.net))}**. Once you have a surplus, goals become achievable.\n\n[ACTION:CREATE_BUDGET]`;
  return `With a monthly surplus of **${C(briefing.net)}**, you could reach a **${C(briefing.net * 12)}** goal in one year — or a **${C(briefing.net * 6)}** emergency fund in 6 months. What are you saving for?\n\n[ACTION:SET_GOAL]`;
}

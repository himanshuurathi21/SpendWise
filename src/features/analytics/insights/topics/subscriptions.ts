import { Transaction } from '@/types';
import type { FinancialBriefing } from '../advisor';

export function handleSubscriptionsQuery(
  query: string,
  _txs: Transaction[],
  briefing: FinancialBriefing,
  currency: string
): string | null {
  const q = query.toLowerCase();
  const C = (v: number) => `${currency}${v.toLocaleString('en-IN')}`;

  if (!/subscri|netflix|spotify|streaming|recurring/.test(q)) return null;

  if (briefing.subscriptionTotal === 0)
    return `No subscription transactions detected yet. Tag your recurring services as **Subscriptions** and I can give you an audit.\n\n[ACTION:VIEW_SUBSCRIPTIONS]`;
  return `Your subscriptions cost **${C(briefing.subscriptionTotal)}/month** — that's **${C(briefing.subscriptionTotal * 12)}/year**. Review which ones you actively use. Most people save 20–30% by cancelling one unused service.\n\n[ACTION:VIEW_SUBSCRIPTIONS]`;
}

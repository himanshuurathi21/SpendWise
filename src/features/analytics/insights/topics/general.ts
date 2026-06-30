import { Transaction } from '@/types';
import type { FinancialBriefing } from '../advisor';

export function handleGeneralQuery(
  query: string,
  _txs: Transaction[],
  briefing: FinancialBriefing,
  currency: string
): string | null {
  const q = query.toLowerCase();
  const C = (v: number) => `${currency}${v.toLocaleString('en-IN')}`;
  const top = briefing.topCategories[0];
  const isInDef = briefing.net < 0;
  const noIncome = briefing.totalIncome === 0;

  // Health score / financial health
  if (/health|score|performance|rating|how am i doing/.test(q)) {
    const score =
      briefing.savingsRate >= 20
        ? 'Excellent 🟢'
        : briefing.savingsRate >= 10
          ? 'Good 🟡'
          : briefing.savingsRate >= 0
            ? 'Needs Work 🟠'
            : 'Critical 🔴';
    return `**Financial Health: ${score}**\n\n— Savings rate: **${briefing.savingsRate}%** (target: 20%)\n— Daily spend: **${C(briefing.avgDailySpend)}/day**\n— Subscriptions: **${C(briefing.subscriptionTotal)}/month**\n— Transactions logged: **${briefing.transactionCount}**\n\n[ACTION:VIEW_ANALYTICS]`;
  }

  // Income
  if (/income|earn|salary|revenue|paych/.test(q)) {
    if (noIncome)
      return `No income transactions logged. Add your salary or any other income source with the + button.\n\n[ACTION:ADD_TRANSACTION]`;
    return `You've logged **${C(briefing.totalIncome)}** in income. Your net after all expenses is **${C(briefing.net)}** (${briefing.savingsRate}% savings rate).\n\n[ACTION:VIEW_ANALYTICS]`;
  }

  // Export / report
  if (/report|export|pdf|statement|history/.test(q)) {
    return `You can export your full transaction history as a **PDF statement** or **CSV** from the Reports view. It includes income, expenses, category breakdown, and month-over-month comparison.\n\n[ACTION:EXPORT_REPORT]`;
  }

  // Anomaly / unusual
  if (/unusual|anomal|weird|strange|different/.test(q)) {
    if (briefing.unusualCount === 0)
      return `No unusual spending patterns detected in your recent transactions. Everything looks consistent with your normal habits.\n\n[ACTION:VIEW_ANALYTICS]`;
    return `I've detected **${briefing.unusualCount} unusual transaction(s)** that deviate from your normal spending patterns. Check the Analytics view for details.\n\n[ACTION:VIEW_ANALYTICS]`;
  }

  // EMI / loan / debt
  if (/emi|loan|debt|credit card|borrow/.test(q)) {
    return `To manage EMIs effectively: log each EMI payment under **Utilities** or a custom "Loan" category, then track it in your budget. Your current net is **${C(briefing.net)}** — ensure your EMI total stays under 40% of income.\n\n[ACTION:CREATE_BUDGET]`;
  }

  // Credit score / CIBIL
  if (/credit|CIBIL|cibil|score|loan eligibility|credit health/.test(q)) {
    if (!briefing.creditScore)
      return `I don't have your credit score data yet. Connect your bank account via **Setu AA** in the Analytics → Credit Health section, and I'll be able to answer questions about your CIBIL score and loan eligibility.\n\n[ACTION:VIEW_ANALYTICS]`;
    const band =
      briefing.creditScore >= 750
        ? 'Excellent'
        : briefing.creditScore >= 700
          ? 'Good'
          : briefing.creditScore >= 600
            ? 'Fair'
            : 'Needs Improvement';
    return `Your **CIBIL score** is **${briefing.creditScore}** (${band}) as of ${briefing.creditScoreDate ?? 'recently'}. The CIBIL range is 300-900.\n\n— **750+**: Excellent — you qualify for the best interest rates\n— **700-749**: Good — most loans will be approved\n— **600-699**: Fair — may face higher rates or reduced limits\n— **Below 600**: Needs improvement — consider secured credit or a credit-builder loan\n\nWould you like specific advice on improving your score?\n\n[ACTION:VIEW_ANALYTICS]`;
  }

  // Tax
  if (/tax|it return|80c|deduction|tds/.test(q)) {
    return `For Indian tax planning: Section 80C allows up to **₹1.5L** deduction (ELSS, PPF, EPF, LIC). Section 80D covers health insurance premiums. Your current income logged is **${C(briefing.totalIncome)}** — I recommend reviewing your tax liability in the Analytics → Tax Predictor section.\n\n[ACTION:VIEW_ANALYTICS]`;
  }

  // Advice / tips / help
  if (/advice|tip|help|suggest|recommend|how/.test(q)) {
    if (isInDef)
      return `My top suggestion: you're **${C(Math.abs(briefing.net))}** in deficit. Cut **${top?.name ?? 'your top category'}** spending by 20% this week — that's about ${C(Math.round((top?.amount ?? 0) * 0.2))}. Small, consistent cuts beat big dramatic ones.\n\n[ACTION:CREATE_BUDGET]`;
    return `You're doing well with a **${briefing.savingsRate}% savings rate**. My top tip: automate — set a budget for **${top?.name ?? 'your top category'}** and let SpendWise alert you when you're at 80%. Automation beats willpower every time.\n\n[ACTION:CREATE_BUDGET]`;
  }

  // Non-finance question guard
  const isFinance =
    /money|spend|budget|sav|income|expense|transaction|invest|buy|afford|rich|poor|debt|loan|tax|goal|category|merchant|sub|bill/.test(
      q
    );
  if (!isFinance && q.length < 60) {
    return `I'm your SpendWise financial advisor — I can only help with your budget, spending, savings, and financial goals. What would you like to know about your finances?`;
  }

  // General catch-all
  return `Based on your **${briefing.transactionCount} transactions**: income **${C(briefing.totalIncome)}**, spent **${C(briefing.totalSpent)}**, net **${C(briefing.net)}** (${briefing.savingsRate}% savings rate). Your biggest cost is **${top?.name ?? 'not yet categorised'}**. What specific area would you like to explore?\n\n[ACTION:VIEW_ANALYTICS]`;
}

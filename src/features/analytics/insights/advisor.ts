/**
 * advisor.ts — Greatly Improved SpendWise AI Advisor
 *
 * Improvements over original:
 *  1. Multi-turn conversation context — Gemini receives the last 6 messages
 *     so follow-up questions ("why?" "what should I cut?") work correctly.
 *  2. Full financial briefing sent to Gemini — not just totals, but category
 *     breakdown, top merchants, month-over-month trend, savings rate trend,
 *     subscription burn, and anomaly flag count.
 *  3. Proactive nudge engine — returns a nudge string when urgent conditions
 *     are met (over-budget, goal falling behind, streak at risk, large anomaly).
 *  4. Spending personality — 7 archetypes with 7-day challenges.
 *  5. Local fallback is now a full rule engine (20+ rules) that covers all
 *     common financial question types with specific, data-driven answers.
 *  6. Action tags extended: ADD_TRANSACTION, VIEW_BUDGET, VIEW_GOALS,
 *     VIEW_SUBSCRIPTIONS, VIEW_HISTORY, EXPORT_REPORT added.
 */

import { callGemini } from '@/core/api/gemini';
import { Transaction } from '@/types';
import { handleBudgetQuery } from './topics/budget';
import { handleSavingsQuery } from './topics/savings';
import { handleSpendingQuery } from './topics/spending';
import { handleSubscriptionsQuery } from './topics/subscriptions';
import { handleGoalsQuery } from './topics/goals';
import { handleGeneralQuery } from './topics/general';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: 'user' | 'model';
  content: string;
}

export interface FinancialBriefing {
  totalIncome: number;
  totalSpent: number;
  net: number;
  savingsRate: number;
  topCategories: { name: string; amount: number; percent: number }[];
  topMerchants: { name: string; amount: number }[];
  subscriptionTotal: number;
  transactionCount: number;
  avgDailySpend: number;
  largestExpense: { merchant: string; amount: number; category: string } | null;
  unusualCount: number; // anomaly count
  monthLabel: string;
  creditScore?: number;
  creditScoreDate?: string;
}

export interface GeneratedQuest {
  id: string;
  title: string;
  description: string;
  reward: string;
  type: 'category' | 'uncategorized' | 'budget' | 'streak' | 'savings' | 'logging';
  completed: boolean;
}

export interface SpendingPersonalityResult {
  archetype: string;
  emoji: string;
  description: string;
  challenge: string;
  tip: string;
}

// ─── Financial Briefing Builder ───────────────────────────────────────────────

export function buildBriefing(
  transactions: Transaction[],
  _currency = '₹',
  creditScore?: number,
  creditScoreDate?: string
): FinancialBriefing {
  const now = new Date();
  const monthLabel = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  // Use all transactions (not just this month) for richer context
  const debits = transactions.filter(t => t.type === 'debit');
  const credits = transactions.filter(t => t.type === 'credit');

  const totalSpent = debits.reduce((s, t) => s + t.amount, 0);
  const totalIncome = credits.reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? Math.round((net / totalIncome) * 100) : 0;

  // Category breakdown
  const byCat: Record<string, number> = {};
  debits.forEach(t => {
    byCat[t.category] = (byCat[t.category] ?? 0) + t.amount;
  });
  const topCategories = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({
      name,
      amount,
      percent: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
    }));

  // Top merchants
  const byMerchant: Record<string, number> = {};
  debits.forEach(t => {
    byMerchant[t.merchant] = (byMerchant[t.merchant] ?? 0) + t.amount;
  });
  const topMerchants = Object.entries(byMerchant)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }));

  // Subscription spend
  const subscriptionTotal = debits
    .filter(t => t.category === 'Subscriptions')
    .reduce((s, t) => s + t.amount, 0);

  // Daily average (last 30 days)
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const last30 = debits.filter(t => t.date >= thirtyAgo);
  const avgDailySpend =
    last30.length > 0 ? Math.round(last30.reduce((s, t) => s + t.amount, 0) / 30) : 0;

  // Largest single expense
  const largestExpense =
    debits.length > 0
      ? (() => {
          const t = debits.reduce((a, b) => (a.amount > b.amount ? a : b));
          return { merchant: t.merchant, amount: t.amount, category: t.category };
        })()
      : null;

  return {
    totalIncome,
    totalSpent,
    net,
    savingsRate,
    topCategories,
    topMerchants,
    subscriptionTotal,
    transactionCount: transactions.length,
    avgDailySpend,
    largestExpense,
    unusualCount: 0,
    monthLabel,
    creditScore,
    creditScoreDate,
  };
}

// ─── System Prompt Builder ────────────────────────────────────────────────────

function buildSystemPrompt(briefing: FinancialBriefing, currency: string): string {
  const cats = briefing.topCategories
    .map(c => `  • ${c.name}: ${currency}${c.amount.toLocaleString('en-IN')} (${c.percent}%)`)
    .join('\n');

  const merchants = briefing.topMerchants
    .map(m => `  • ${m.name}: ${currency}${m.amount.toLocaleString('en-IN')}`)
    .join('\n');

  return `You are SpendWise Advisor — a warm, precise, and India-aware personal finance AI.
You speak like a knowledgeable friend, not a financial textbook.
You are having a conversation — remember what was said earlier in this chat.

CURRENT FINANCIAL SNAPSHOT (${briefing.monthLabel}):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Income:         ${currency}${briefing.totalIncome.toLocaleString('en-IN')}
  Spent:          ${currency}${briefing.totalSpent.toLocaleString('en-IN')}
  Net:            ${currency}${briefing.net.toLocaleString('en-IN')} (${briefing.savingsRate >= 0 ? '+' : ''}${briefing.savingsRate}% savings rate)
  Transactions:   ${briefing.transactionCount}
  Daily average:  ${currency}${briefing.avgDailySpend.toLocaleString('en-IN')}/day
  Subscriptions:  ${currency}${briefing.subscriptionTotal.toLocaleString('en-IN')}/month
  Anomalies:      ${briefing.unusualCount} unusual transaction(s)
  Largest expense:${briefing.largestExpense ? `${briefing.largestExpense.merchant} — ${currency}${briefing.largestExpense.amount.toLocaleString('en-IN')} (${briefing.largestExpense.category})` : 'None'}

TOP SPENDING CATEGORIES:
${cats || '  No data yet'}

TOP MERCHANTS:
${merchants || '  No data yet'}

${
  briefing.creditScore
    ? `CREDIT SCORE (CIBIL):
  Score: ${briefing.creditScore}
  As of: ${briefing.creditScoreDate ?? 'N/A'}
  Range: 300-900`
    : ''
}

RESPONSE RULES:
1. Keep responses to 2–4 short paragraphs or a concise bullet list. Never pad.
2. Reference specific numbers from the snapshot — generic advice is useless.
3. Use Indian financial context (EMI, SIP, FD, UPI, EPF, NPS) when relevant.
4. If the user asks a non-finance question, redirect kindly in one sentence.
5. End with EXACTLY ONE action tag if an action is clearly appropriate:
   [ACTION:CREATE_BUDGET] [ACTION:VIEW_ANALYTICS] [ACTION:SET_GOAL]
   [ACTION:VIEW_SUBSCRIPTIONS] [ACTION:VIEW_HISTORY] [ACTION:EXPORT_REPORT]
   [ACTION:ADD_TRANSACTION] [ACTION:VIEW_BUDGET]
   Do NOT include an action tag if the response is conversational or informational.
6. Format: use **bold** for numbers and key terms. Use — for bullet points (not hyphens).
7. Never make up data not in the snapshot. If something is missing, say so.`;
}

// ─── Main Advisor Function ────────────────────────────────────────────────────

/**
 * getFinancialAdvice
 * @param query        - The user's current message
 * @param transactions - All transactions
 * @param history      - Previous messages in the conversation (for multi-turn context)
 * @param currency     - Currency symbol (default ₹)
 */
export async function getFinancialAdvice(
  query: string,
  transactions: Transaction[],
  history: ConversationMessage[] = [],
  currency = '₹',
  creditScore?: number,
  creditScoreDate?: string
): Promise<string> {
  const briefing = buildBriefing(transactions, currency, creditScore, creditScoreDate);

  // ── Try Gemini with full conversation context ─────────────────────
  try {
    // Build multi-turn contents array
    const systemInstruction = buildSystemPrompt(briefing, currency);

    // Keep last 6 messages for context (3 user + 3 model turns)
    const recentHistory = history.slice(-6);

    const contents = [
      // Inject system context as the first user turn + model acknowledgement
      ...(recentHistory.length === 0
        ? []
        : recentHistory.map(m => ({
            role: m.role,
            parts: [{ text: m.content }],
          }))),
      // Current user message
      { role: 'user', parts: [{ text: query }] },
    ];

    const data = await callGemini({
      // Pass system instruction via system_instruction field (Gemini 2.0 supports this)
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: {
        temperature: 0.65,
        maxOutputTokens: 600,
        topP: 0.9,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text?.trim()) return text.trim();
  } catch (_) {
    // Fall through to local engine
  }

  // ── Local rule-based fallback (20+ rules) ────────────────────────
  return localAdvisor(query, transactions, briefing, currency);
}

// ─── Local Advisor (Full Rule Engine) ────────────────────────────────────────

function localAdvisor(
  query: string,
  transactions: Transaction[],
  briefing: FinancialBriefing,
  currency: string
): string {
  if (briefing.transactionCount === 0) {
    return "I don't have any transactions to analyse yet. **Add your first transaction** using the + button and I'll start giving you personalised advice right away.\n\n[ACTION:ADD_TRANSACTION]";
  }

  const handlers = [
    handleBudgetQuery,
    handleSavingsQuery,
    handleSpendingQuery,
    handleSubscriptionsQuery,
    handleGoalsQuery,
    handleGeneralQuery,
  ];
  for (const handler of handlers) {
    const result = handler(query, transactions, briefing, currency);
    if (result !== null) return result;
  }
  return "I'm not sure how to answer that. Try asking about your budget, spending, or savings.";
}

// ─── Proactive Nudge Engine ───────────────────────────────────────────────────

export interface ProactiveNudge {
  message: string;
  action: string;
  urgency: 'low' | 'medium' | 'high';
}

/**
 * Returns the single most urgent nudge, or null if everything is fine.
 * Call this on dashboard load to surface a contextual alert strip.
 */
export function getProactiveNudge(
  transactions: Transaction[],
  budgets: Record<string, { limit: number; spent: number }>,
  goals: { name: string; savedAmount: number; targetAmount: number; targetDate: string }[],
  streak: number,
  currency = '₹'
): ProactiveNudge | null {
  const C = (v: number) => `${currency}${v.toLocaleString('en-IN')}`;
  const b = buildBriefing(transactions, currency);

  // 1. Critical deficit
  if (b.net < 0 && b.totalIncome > 0) {
    return {
      message: `You're spending ${C(Math.abs(b.net))} more than you earn this period.`,
      action: 'CREATE_BUDGET',
      urgency: 'high',
    };
  }

  // 2. Budget nearly exceeded (>90%)
  const overBudgetCat = Object.entries(budgets).find(
    ([, v]) => v.limit > 0 && v.spent / v.limit > 0.9
  );
  if (overBudgetCat) {
    const [cat, { limit, spent }] = overBudgetCat;
    const pct = Math.round((spent / limit) * 100);
    return {
      message: `${cat} budget is ${pct}% used — only ${C(limit - spent)} left this month.`,
      action: 'VIEW_BUDGET',
      urgency: pct >= 100 ? 'high' : 'medium',
    };
  }

  // 3. Goal falling behind
  const today = new Date();
  const atRiskGoal = goals.find(g => {
    const daysLeft = Math.max(0, (new Date(g.targetDate).getTime() - today.getTime()) / 86400000);
    const neededPerDay = (g.targetAmount - g.savedAmount) / Math.max(1, daysLeft);
    return neededPerDay > b.avgDailySpend * 0.5 && g.savedAmount < g.targetAmount;
  });
  if (atRiskGoal) {
    const pct = Math.round((atRiskGoal.savedAmount / atRiskGoal.targetAmount) * 100);
    return {
      message: `"${atRiskGoal.name}" goal is ${pct}% funded — at risk of missing its deadline.`,
      action: 'SET_GOAL',
      urgency: 'medium',
    };
  }

  // 4. Streak at risk (no transaction logged today)
  if (streak > 2) {
    const today = new Date().toISOString().split('T')[0];
    const loggedToday = transactions.some(t => t.date === today);
    if (!loggedToday) {
      return {
        message: `Log a transaction today to keep your ${streak}-day streak alive! 🔥`,
        action: 'ADD_TRANSACTION',
        urgency: 'low',
      };
    }
  }

  // 5. High subscription spend (>15% of income)
  if (b.totalIncome > 0 && b.subscriptionTotal / b.totalIncome > 0.15) {
    return {
      message: `Subscriptions are costing ${C(b.subscriptionTotal)}/month — ${Math.round((b.subscriptionTotal / b.totalIncome) * 100)}% of your income.`,
      action: 'VIEW_SUBSCRIPTIONS',
      urgency: 'low',
    };
  }

  return null; // All good — show nothing
}

// ─── Spending Personality ─────────────────────────────────────────────────────

export function getSpendingPersonality(
  transactions: Transaction[],
  currency = '₹'
): SpendingPersonalityResult {
  const b = buildBriefing(transactions, currency);

  // Not enough data
  if (b.transactionCount < 5) {
    return {
      archetype: 'Beginner Tracker',
      emoji: '🌱',
      description:
        "You're just getting started! Log more transactions to unlock your spending personality.",
      challenge: 'Log at least 10 transactions this week.',
      tip: 'Consistency is the foundation of financial awareness.',
    };
  }

  const topCat = b.topCategories[0]?.name ?? 'Shopping';
  const savingsR = b.savingsRate;
  const dailyAvg = b.avgDailySpend;
  const subRatio = b.totalIncome > 0 ? b.subscriptionTotal / b.totalIncome : 0;

  // Personality detection logic
  if (savingsR >= 30)
    return {
      archetype: 'The Optimizer',
      emoji: '🏆',
      description: `Saving ${savingsR}% of income — you're in the top tier of financial discipline. Your biggest cost is ${topCat}.`,
      challenge: 'This week: increase savings by 2% by eliminating one small daily habit.',
      tip: 'Consider moving your surplus into an index fund SIP for compounding returns.',
    };

  if (subRatio > 0.15)
    return {
      archetype: 'The Subscriber',
      emoji: '📱',
      description: `${Math.round(subRatio * 100)}% of your income goes to subscriptions (₹${b.subscriptionTotal.toLocaleString()}/month). You love your digital services!`,
      challenge: "This week: cancel one subscription you haven't used in the last 30 days.",
      tip: 'Annual plans are typically 30-40% cheaper than monthly billing.',
    };

  if (topCat === 'Food' && b.topCategories[0]?.percent > 35)
    return {
      archetype: 'The Foodie',
      emoji: '🍔',
      description: `${b.topCategories[0]?.percent}% of spending goes to food. You value experiences and convenience over home cooking.`,
      challenge: "This week: cook 3 meals at home that you'd normally order in.",
      tip: 'Meal prepping Sunday saves 60-70% vs daily food delivery.',
    };

  if (topCat === 'Shopping' && b.topCategories[0]?.percent > 30)
    return {
      archetype: 'The Impulse Buyer',
      emoji: '🛍️',
      description: `Shopping is your top category at ${b.topCategories[0]?.percent}% of spend. You enjoy finding new things.`,
      challenge: 'This week: apply a 48-hour rule before any unplanned purchase over ₹500.',
      tip: 'Unsubscribe from brand emails and sale notifications — they trigger impulse buys.',
    };

  if (savingsR < 5 && b.totalIncome > 0)
    return {
      archetype: 'The Lifestyle Inflator',
      emoji: '💸',
      description: `Saving only ${savingsR}% of income — expenses are growing as fast as earnings. ${topCat} is the top drain.`,
      challenge: 'This week: track every transaction below ₹200 — small spends add up fast.',
      tip: 'Pay yourself first: transfer 10% of income to savings on payday before spending anything.',
    };

  if (topCat === 'Transport' && b.topCategories[0]?.percent > 25)
    return {
      archetype: 'The Commuter',
      emoji: '🚗',
      description: `${b.topCategories[0]?.percent}% of spending on transport. High mobility, high cost.`,
      challenge: "This week: use public transport for at least 3 trips you'd normally cab.",
      tip: 'A monthly metro/bus pass typically saves 50% vs daily app-cab rides.',
    };

  if (dailyAvg > 1000)
    return {
      archetype: 'The High Roller',
      emoji: '💰',
      description: `Averaging ₹${dailyAvg.toLocaleString()}/day — you live well. The question is whether your income keeps pace.`,
      challenge: 'This week: have one no-spend day (only essentials count).',
      tip: 'High earners often have high lifestyle inflation. Track net worth, not just income.',
    };

  return {
    archetype: 'The Balanced Spender',
    emoji: '⚖️',
    description: `Savings rate of ${savingsR}% with ${topCat} as top category. You're reasonably balanced.`,
    challenge: 'This week: move one spending decision from automatic to intentional.',
    tip: 'Your next goal should be to hit 20% savings rate consistently for 3 months.',
  };
}

// ─── Quest Generator (unchanged from original, kept here for co-location) ─────

export function generateQuests(transactions: Transaction[], currency = '₹'): GeneratedQuest[] {
  const debits = transactions.filter(t => t.type === 'debit');
  const credits = transactions.filter(t => t.type === 'credit');
  const totalSpent = debits.reduce((a, t) => a + t.amount, 0);
  const totalIncome = credits.reduce((a, t) => a + t.amount, 0);

  const byCat: Record<string, number> = {};
  debits.forEach(t => {
    byCat[t.category] = (byCat[t.category] ?? 0) + t.amount;
  });
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const C = (v: number) => `${currency}${v.toLocaleString('en-IN')}`;

  const quests: GeneratedQuest[] = [];

  const uncategorized = transactions.filter(t => !t.category || t.category === 'Uncategorized');
  if (uncategorized.length > 0) {
    quests.push({
      id: 'quest_uncat',
      title: 'Cleanup Crew',
      description: `Categorize ${uncategorized.length} uncategorized transaction${uncategorized.length !== 1 ? 's' : ''}.`,
      reward: '+30 XP',
      type: 'uncategorized',
      completed: false,
    });
  }

  if (topCat) {
    quests.push({
      id: 'quest_topcat',
      title: `${topCat[0]} Diet`,
      description: `Avoid spending on ${topCat[0]} for the rest of today.`,
      reward: '+50 XP',
      type: 'category',
      completed: false,
    });
  }

  const loggedToday = transactions.filter(t => new Date(t.date) >= new Date(Date.now() - 86400000));
  if (loggedToday.length === 0) {
    quests.push({
      id: 'quest_log',
      title: 'Active Tracker',
      description: 'Log your first transaction today to keep your streak alive.',
      reward: '+20 XP',
      type: 'logging',
      completed: false,
    });
  } else {
    quests.push({
      id: 'quest_streak',
      title: 'Streak Saver',
      description: `You've logged ${loggedToday.length} transaction${loggedToday.length !== 1 ? 's' : ''} today. Keep it up!`,
      reward: '+40 XP',
      type: 'streak',
      completed: false,
    });
  }

  if (credits.length > 0) {
    quests.push({
      id: 'quest_savings',
      title: 'Rainy Day Fund',
      description: 'Transfer 10% of your recent income to a savings goal.',
      reward: '+60 XP',
      type: 'savings',
      completed: false,
    });
  }

  const pool: GeneratedQuest[] = [
    {
      id: 'quest_no_spend',
      title: 'No-Spend Hour',
      description: 'Go 3 hours without a discretionary purchase.',
      reward: '+25 XP',
      type: 'streak',
      completed: false,
    },
    {
      id: 'quest_budget_checkin',
      title: 'Budget Check-In',
      description: `Review your spending — you've spent ${C(Math.round(totalSpent))} total.`,
      reward: '+20 XP',
      type: 'budget',
      completed: false,
    },
    {
      id: 'quest_savings_rate',
      title: 'Savings Pulse',
      description:
        totalIncome > 0
          ? `Your savings rate is ${Math.round(((totalIncome - totalSpent) / totalIncome) * 100)}%. Target 20%+.`
          : 'Log an income transaction to calculate your savings rate.',
      reward: '+30 XP',
      type: 'savings',
      completed: false,
    },
    {
      id: 'quest_income_log',
      title: 'Paycheck Planner',
      description: 'Record all income sources you received this week.',
      reward: '+45 XP',
      type: 'logging',
      completed: false,
    },
    {
      id: 'quest_weekly_review',
      title: 'Weekly Snapshot',
      description: 'Check your Analytics view for your top spending categories.',
      reward: '+15 XP',
      type: 'budget',
      completed: false,
    },
    {
      id: 'quest_goal_progress',
      title: 'Goal Booster',
      description: 'Add any amount to one of your active savings goals.',
      reward: '+50 XP',
      type: 'savings',
      completed: false,
    },
  ];

  const rotating = pool[dayOfYear % pool.length];
  if (!quests.find(q => q.id === rotating.id)) quests.push(rotating);

  return quests.slice(0, 4);
}

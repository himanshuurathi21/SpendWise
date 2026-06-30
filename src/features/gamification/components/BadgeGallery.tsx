/**
 * BadgeGallery.tsx
 * Full achievement badge showcase — unlocked + locked badges with earn criteria.
 */
import { useMemo } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { haptic } from '@/core/haptic';

interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  criteria: string;
  color: string;
  unlocked: boolean;
  unlockedAt?: string;
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transactions: any[];
  streak: number;
  level: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  goals: any[];
  currency?: string;
}

function computeBadges(props: Props): Badge[] {
  const { transactions, streak, level, goals, currency = '₹' } = props;
  const totalTx = transactions.length;
  const totalSpent = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions
    .filter(t => t.type === 'credit')
    .reduce((s, t) => s + t.amount, 0);
  const achieved = goals.filter(g => g.status === 'achieved').length;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpent) / totalIncome) * 100 : 0;

  const categories = new Set(
    transactions.flatMap(t => (t.category !== 'Other' ? [t.category] : []))
  );

  return [
    {
      id: 'first_tx',
      emoji: '🚀',
      color: '#14b8a6',
      name: 'First Step',
      description: 'Logged your first transaction',
      criteria: 'Add 1 transaction',
      unlocked: totalTx >= 1,
    },
    {
      id: 'tx_10',
      emoji: '📊',
      color: '#3b82f6',
      name: 'Data Cruncher',
      description: 'Logged 10 transactions',
      criteria: 'Add 10 transactions',
      unlocked: totalTx >= 10,
    },
    {
      id: 'tx_50',
      emoji: '📈',
      color: '#6366f1',
      name: 'Habit Builder',
      description: 'Logged 50 transactions',
      criteria: 'Add 50 transactions',
      unlocked: totalTx >= 50,
    },
    {
      id: 'tx_100',
      emoji: '🏆',
      color: '#f59e0b',
      name: 'Century Club',
      description: 'Logged 100 transactions',
      criteria: 'Add 100 transactions',
      unlocked: totalTx >= 100,
    },
    {
      id: 'streak_3',
      emoji: '🔥',
      color: '#ef4444',
      name: 'On Fire',
      description: '3-day login streak',
      criteria: 'Log in 3 days in a row',
      unlocked: streak >= 3,
    },
    {
      id: 'streak_7',
      emoji: '⚡',
      color: '#f59e0b',
      name: 'Week Warrior',
      description: '7-day login streak',
      criteria: 'Log in 7 days in a row',
      unlocked: streak >= 7,
    },
    {
      id: 'streak_30',
      emoji: '💎',
      color: '#8b5cf6',
      name: 'Diamond Saver',
      description: '30-day login streak',
      criteria: 'Log in 30 days in a row',
      unlocked: streak >= 30,
    },
    {
      id: 'savings_20',
      emoji: '🐷',
      color: '#ec4899',
      name: 'Piggy Bank',
      description: 'Saved 20%+ of income',
      criteria: 'Keep monthly savings rate above 20%',
      unlocked: savingsRate >= 20,
    },
    {
      id: 'savings_50',
      emoji: '🦁',
      color: '#f59e0b',
      name: 'Frugal Lion',
      description: 'Saved 50%+ of income',
      criteria: 'Keep monthly savings rate above 50%',
      unlocked: savingsRate >= 50,
    },
    {
      id: 'goal_1',
      emoji: '🎯',
      color: '#14b8a6',
      name: 'Goal Getter',
      description: 'Completed your first savings goal',
      criteria: 'Achieve 1 goal',
      unlocked: achieved >= 1,
    },
    {
      id: 'goal_3',
      emoji: '🌟',
      color: '#f59e0b',
      name: 'Dream Achiever',
      description: 'Completed 3 savings goals',
      criteria: 'Achieve 3 goals',
      unlocked: achieved >= 3,
    },
    {
      id: 'cat_diversity',
      emoji: '🌈',
      color: '#06b6d4',
      name: 'Well Rounded',
      description: 'Tracked 5+ different categories',
      criteria: 'Use 5+ spending categories',
      unlocked: categories.size >= 5,
    },
    {
      id: 'level_5',
      emoji: '🥈',
      color: '#94a3b8',
      name: 'Rising Star',
      description: 'Reached Level 5',
      criteria: 'Reach Level 5',
      unlocked: level >= 5,
    },
    {
      id: 'level_10',
      emoji: '🥇',
      color: '#f59e0b',
      name: 'Money Master',
      description: 'Reached Level 10',
      criteria: 'Reach Level 10',
      unlocked: level >= 10,
    },
    {
      id: 'level_20',
      emoji: '👑',
      color: '#8b5cf6',
      name: 'Wealth Titan',
      description: 'Reached Level 20',
      criteria: 'Reach Level 20',
      unlocked: level >= 20,
    },
    {
      id: 'spent_big',
      emoji: '💸',
      color: '#ef4444',
      name: 'Big Spender',
      description: `Total lifetime spending over ${currency}1,00,000`,
      criteria: `Spend more than ${currency}1,00,000 lifetime`,
      unlocked: totalSpent >= 100000,
    },
  ];
}

export function BadgeGallery({
  transactions,
  streak,
  level,
  goals,
  currency: _currency = '₹',
}: Props) {
  const badges = useMemo(
    () => computeBadges({ transactions, streak, level, goals }),
    [transactions, streak, level, goals]
  );
  const unlocked = badges.filter(b => b.unlocked);
  const locked = badges.filter(b => !b.unlocked);

  return (
    <div className="card px-4 sm:px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Achievement Gallery
          </h3>
          <p
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '2px',
            }}
          >
            {unlocked.length} / {badges.length} badges earned
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background: 'var(--teal-dim)' }}
        >
          <CheckCircle2 size={14} style={{ color: 'var(--teal)' }} />
          <span
            className="text-xs font-bold"
            style={{ color: 'var(--teal)', fontFamily: 'var(--font-inter)' }}
          >
            {Math.round((unlocked.length / badges.length) * 100)}% Complete
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full bg-[var(--surface-input)] rounded-full overflow-hidden mb-6">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(unlocked.length / badges.length) * 100}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, var(--teal), #6366f1)' }}
        />
      </div>

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div className="mb-6">
          <p
            className="text-[length:var(--fs-overline)] font-bold uppercase tracking-widest mb-3"
            style={{ color: 'var(--teal)', fontFamily: 'var(--font-inter)' }}
          >
            ✅ Unlocked ({unlocked.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {unlocked.map(badge => (
              <motion.div
                key={badge.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  haptic.light();
                }}
                className="relative flex flex-col items-center text-center p-4 rounded-2xl border cursor-pointer"
                style={{ borderColor: `${badge.color}30`, background: `${badge.color}08` }}
              >
                <div className="text-3xl mb-2 drop-shadow-sm">{badge.emoji}</div>
                <p
                  className="text-[length:var(--fs-caption)] font-bold"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-inter)' }}
                >
                  {badge.name}
                </p>
                <p
                  className="text-[length:var(--fs-overline)] mt-0.5 line-clamp-2"
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-inter)' }}
                >
                  {badge.description}
                </p>
                <div className="absolute top-2 right-2">
                  <CheckCircle2 size={12} style={{ color: badge.color }} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <p
            className="text-[length:var(--fs-overline)] font-bold uppercase tracking-widest mb-3"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-inter)' }}
          >
            🔒 Locked ({locked.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {locked.map(badge => (
              <div
                key={badge.id}
                className="group relative flex flex-col items-center text-center p-4 rounded-2xl border border-[var(--border)] opacity-50 hover:opacity-70 grayscale cursor-default transition-opacity"
                style={{ background: 'var(--surface-input)' }}
                title={`To unlock: ${badge.criteria}`}
              >
                <div className="text-3xl mb-2">{badge.emoji}</div>
                <p
                  className="text-[length:var(--fs-caption)] font-bold"
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-inter)' }}
                >
                  {badge.name}
                </p>
                <p
                  className="text-[length:var(--fs-overline)] mt-0.5 line-clamp-2"
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-inter)' }}
                >
                  {badge.criteria}
                </p>
                <div className="absolute top-2 right-2">
                  <Lock size={11} style={{ color: 'var(--text-muted)' }} />
                </div>
                {/* Hover tooltip */}
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 w-40 text-center"
                  style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border)',
                    fontSize: '10px',
                    fontFamily: 'var(--font-inter)',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                  }}
                >
                  🔓 {badge.criteria}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

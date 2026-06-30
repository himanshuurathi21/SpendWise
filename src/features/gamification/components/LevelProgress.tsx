import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, TrendingUp, Zap, ArrowRight } from 'lucide-react';
import { useStore } from '@/store';
import { useQuestReset } from '@/features/gamification/hooks/useQuestReset';
import { AppView } from '@/components/ui/types';

export default React.memo(function LevelProgress({ onNavigate }: { onNavigate?: (view: AppView) => void }) {
  const level = useStore(state => state.level);
  const totalXP = useStore(state => state.totalXP);
  const rank = useStore(state => state.rank);
  const { totalXPToday, completedCount } = useQuestReset();

  const XP_PER_LEVEL = 1000;
  const currentLevelXP = totalXP % XP_PER_LEVEL;
  const progress = (currentLevelXP / XP_PER_LEVEL) * 100;

  return (
    <div className="card p-4 sm:p-6 overflow-hidden relative group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Trophy size={80} />
      </div>

      <div className="flex items-center justify-between mb-3 sm:mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[var(--teal)] to-[#0d9488] flex items-center justify-center text-white shadow-lg shadow-[var(--teal-dim)]/50 border border-white/20 shrink-0">
            <span className="font-manrope font-black text-lg sm:text-2xl">{level}</span>
          </div>
          <div className="min-w-0">
            <h3 className="font-manrope font-bold text-sm sm:text-base text-[var(--text-primary)] truncate">
              {rank}
            </h3>
            <p className="font-inter text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-1.5">
              <Star size={10} className="text-amber-500 fill-amber-500" />
              Level {level} Financialist
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-manrope font-bold text-xs sm:text-sm text-[var(--text-primary)]">
            {currentLevelXP} / {XP_PER_LEVEL} XP
          </p>
          <p className="font-inter text-[length:var(--fs-overline)] sm:text-[length:var(--fs-overline)] font-bold text-[var(--teal)] uppercase tracking-wider">
            Next Rank Lvl {level < 2 ? 2 : level < 5 ? 5 : level < 10 ? 10 : 20}
          </p>
        </div>
      </div>

      <div className="space-y-1.5 mt-4">
        <div className="h-3 w-full bg-[var(--surface-input)] rounded-full overflow-hidden border border-[var(--border)]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-[var(--teal)] via-[#2dd4bf] to-[var(--teal)] bg-[length:200%_100%] animate-shimmer shadow-[0_0_12px_rgba(20,184,166,0.4)]"
          />
        </div>
        <div className="flex justify-between items-center text-[length:var(--fs-overline)] font-bold text-[var(--text-dim)] uppercase tracking-tighter">
          <span>{level}</span>
          <span>Next Milestone</span>
          <span>{level + 1}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-4">
        {/* Daily XP — live from quest completions */}
        <div className="p-3 rounded-xl bg-[var(--surface-input)] border border-[var(--border)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Zap size={14} className="text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[length:var(--fs-overline)] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Today's XP
            </p>
            <p className="text-xs font-manrope font-bold text-[var(--text-primary)]">
              {totalXPToday > 0
                ? `+${totalXPToday} earned`
                : completedCount === 0
                  ? 'Do a quest!'
                  : 'Claimed'}
            </p>
          </div>
        </div>
        {/* XP Multiplier */}
        <div className="p-3 rounded-xl bg-[var(--surface-input)] border border-[var(--border)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--teal-dim)] flex items-center justify-center shrink-0">
            <TrendingUp size={14} className="text-[var(--teal)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[length:var(--fs-overline)] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              XP Multiplier
            </p>
            <p className="text-xs font-manrope font-bold text-[var(--text-primary)]">1.2x Active</p>
          </div>
        </div>
      </div>

      {onNavigate && (
        <button
          onClick={() => onNavigate('education')}
          className="mt-4 w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm text-[var(--teal)] transition-all bg-[var(--teal-dim)] hover:bg-[var(--teal)] hover:text-white"
          style={{ border: 'none', cursor: 'pointer' }}
        >
          Start Learning <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
});

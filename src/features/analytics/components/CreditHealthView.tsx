import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CreditCard,
  Home,
  Banknote,
  Info,
  ExternalLink,
} from 'lucide-react';
import { CreditScore, LoanEligibility } from '@/types';
import {
  fetchCreditScore,
  getScoreTrend,
  analyzeScoreFactors,
  estimateLoanEligibility,
} from '@/core/creditScore';
import { createSetuConsent, checkSetuConsentStatus } from '@/core/setuAA';

const ScoreGauge = memo(function ScoreGauge({ score }: { score: number }) {
  const pct = ((score - 300) / 600) * 100;
  const color =
    score < 600 ? '#ef4444' : score < 700 ? '#f59e0b' : score < 750 ? '#eab308' : '#10b981';
  const label = score < 600 ? 'Poor' : score < 700 ? 'Fair' : score < 750 ? 'Good' : 'Excellent';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="72"
            cy="72"
            r="60"
            fill="none"
            stroke="var(--surface-input)"
            strokeWidth="10"
          />
          <circle
            cx="72"
            cy="72"
            r="60"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 377} 377`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black text-[var(--text-primary)] leading-none">
            {score}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-widest mt-1" style={{ color }}>
            {label}
          </span>
        </div>
      </div>
      <div className="flex justify-between w-full text-[10px] font-semibold text-[var(--text-muted)]">
        <span>300</span>
        <span>600</span>
        <span>900</span>
      </div>
    </div>
  );
});

function ScoreTrendChart({ trend }: { trend: { month: string; score: number }[] }) {
  const maxScore = Math.max(...trend.map(t => t.score), 750);
  const minScore = Math.min(...trend.map(t => t.score), 300);
  const range = Math.max(maxScore - minScore, 100);

  return (
    <div className="space-y-3">
      <p className="text-[length:var(--fs-caption)] font-bold text-[var(--text-muted)] uppercase tracking-widest">
        Score Trend (Last 6 Months)
      </p>
      <div className="flex items-end gap-2 h-28">
        {trend.map((t, _i) => {
          const h = ((t.score - minScore) / range) * 100;
          const color =
            t.score < 600
              ? '#ef4444'
              : t.score < 700
                ? '#f59e0b'
                : t.score < 750
                  ? '#eab308'
                  : '#10b981';
          return (
            <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)]">{t.score}</span>
              <div
                className="w-full rounded-full overflow-hidden"
                style={{ background: 'var(--surface-input)', height: '80px' }}
              >
                <div
                  className="w-full rounded-full transition-all duration-700"
                  style={{ height: `${h}%`, background: color, marginTop: `${100 - h}%` }}
                />
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] text-center leading-tight">
                {t.month.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FactorBreakdown({ factors }: { factors: CreditScore['factors'] }) {
  const impactIcon = (impact: string) => {
    if (impact === 'positive') return <TrendingUp size={14} className="text-emerald-500" />;
    if (impact === 'negative') return <TrendingDown size={14} className="text-red-500" />;
    return <Minus size={14} className="text-gray-400" />;
  };

  const impactColor = (impact: string) => {
    if (impact === 'positive') return 'border-emerald-500/20 bg-emerald-500/5';
    if (impact === 'negative') return 'border-red-500/20 bg-red-500/5';
    return 'border-gray-500/20 bg-gray-500/5';
  };

  return (
    <div className="space-y-3">
      <p className="text-[length:var(--fs-caption)] font-bold text-[var(--text-muted)] uppercase tracking-widest">
        Factor Breakdown
      </p>
      <div className="space-y-2">
        {factors.map((f, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border ${impactColor(f.impact)}`}
          >
            <div className="mt-0.5">{impactIcon(f.impact)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-[var(--text-primary)]">{f.name}</p>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{f.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraggingFactors({ score }: { score: CreditScore }) {
  const negative = score.factors.filter(f => f.impact === 'negative');

  if (negative.length === 0) {
    return (
      <div
        className="rounded-xl px-4 py-3"
        style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}
      >
        <div className="flex items-start gap-2">
          <TrendingUp size={16} className="text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-emerald-600">
              What's Dragging Your Score Down?
            </p>
            <p className="text-[12px] text-emerald-700 mt-1">
              Great news! No major negative factors detected. Your credit health is in good shape.
              Keep up the on-time payments and low utilisation to maintain your score.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-[13px] font-bold text-red-600">What's Dragging Your Score Down?</p>
          <div className="mt-2 space-y-1.5">
            {negative.map((f, i) => (
              <p key={i} className="text-[12px] text-red-700">
                • <strong>{f.name}:</strong> {f.description}
              </p>
            ))}
          </div>
          <p className="text-[12px] text-red-700 mt-2">
            Addressing these factors could significantly improve your credit score over the next 3-6
            months.
          </p>
        </div>
      </div>
    </div>
  );
}

const LoanEligibilityCards = memo(function LoanEligibilityCards({ eligibility }: { eligibility: LoanEligibility[] }) {
  const probabilityColors = {
    high: {
      bg: 'rgba(16,185,129,0.06)',
      border: 'rgba(16,185,129,0.12)',
      text: '#10b981',
      label: 'High',
    },
    medium: {
      bg: 'rgba(245,158,11,0.06)',
      border: 'rgba(245,158,11,0.12)',
      text: '#f59e0b',
      label: 'Medium',
    },
    low: {
      bg: 'rgba(239,68,68,0.06)',
      border: 'rgba(239,68,68,0.12)',
      text: '#ef4444',
      label: 'Low',
    },
  };

  const loanIcons: Record<string, React.ElementType> = {
    'Personal Loan': Banknote,
    'Credit Card': CreditCard,
    'Home Loan': Home,
  };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="space-y-3">
      <p className="text-[length:var(--fs-caption)] font-bold text-[var(--text-muted)] uppercase tracking-widest">
        You may be eligible for:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {eligibility.map((loan, i) => {
          const pc = probabilityColors[loan.probability];
          const Icon = loanIcons[loan.loanType] || Banknote;
          return (
            <div
              key={i}
              className="rounded-2xl p-4 flex flex-col gap-3"
              style={{ background: pc.bg, border: `1.5px solid ${pc.border}` }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `${pc.text}15` }}
                >
                  <Icon size={15} style={{ color: pc.text }} />
                </div>
                <span
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: pc.text }}
                >
                  {pc.label} Probability
                </span>
              </div>
              <div>
                <p className="text-[13px] font-bold text-[var(--text-primary)]">{loan.bankName}</p>
                <p className="text-[12px] text-[var(--text-muted)]">{loan.loanType}</p>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-black text-[var(--text-primary)]">
                  {fmt(loan.maxAmount)}
                </span>
                <span className="text-[13px] font-bold text-emerald-600">
                  at {loan.interestRate}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-center">
        <div className="w-36 h-36 rounded-full bg-[var(--surface-input)]" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-12 rounded-xl bg-[var(--surface-input)]" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 rounded-2xl bg-[var(--surface-input)]" />
        ))}
      </div>
    </div>
  );
}

export default function CreditHealthView() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [_consentId, setConsentId] = useState<string | null>(null);
  const [creditScore, setCreditScore] = useState<CreditScore | null>(null);
  const [scoreTrend, setScoreTrend] = useState<{ month: string; score: number }[]>([]);
  const [consentError, setConsentError] = useState<string | null>(null);

  const eligibility = useMemo(() => {
    if (!creditScore) return [];
    return estimateLoanEligibility(60000, 5000, creditScore.score);
  }, [creditScore]);

  const {
    positive: _positive,
    negative: _negative,
    neutral: _neutral,
  } = useMemo(() => {
    if (!creditScore) return { positive: [], negative: [], neutral: [] };
    return analyzeScoreFactors(creditScore);
  }, [creditScore]);

  const handleRefresh = useCallback(async () => {
    setConsentLoading(true);
    setConsentError(null);
    try {
      const consent = await createSetuConsent('9999999999');
      setConsentId(consent.id);
      const status = await checkSetuConsentStatus(consent.id);
      if (status === 'ACTIVE') {
        setLoading(true);
        const [score, trend] = await Promise.all([fetchCreditScore(consent.id), getScoreTrend()]);
        setCreditScore(score);
        setScoreTrend(trend);
      }
    } catch (e) {
      console.warn('[CreditHealth] Failed to fetch credit data:', e);
      setConsentError('Failed to fetch credit data. Please try again.');
    } finally {
      setConsentLoading(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleRefresh();
  }, [handleRefresh]);

  if (!creditScore && loading) {
    return (
      <div className="card px-4 sm:px-6 py-5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <CreditCard size={18} className="text-indigo-500" />
          </div>
          <div>
            <h3 className="font-manrope font-bold text-base text-[var(--text-primary)]">
              {t('credit.healthTitle', 'Credit Health')}
            </h3>
            <p className="text-[length:var(--fs-caption)] text-[var(--text-muted)]">
              {t('credit.fetchingData', 'Fetching your credit data...')}
            </p>
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!creditScore && !loading) {
    return (
      <div className="card px-4 sm:px-6 py-5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <CreditCard size={18} className="text-indigo-500" />
          </div>
          <div>
            <h3 className="font-manrope font-bold text-base text-[var(--text-primary)]">
              {t('credit.healthTitle', 'Credit Health')}
            </h3>
            <p className="text-[length:var(--fs-caption)] text-[var(--text-muted)]">
              {t('credit.subtitle', 'CIBIL score & loan eligibility')}
            </p>
          </div>
        </div>

        <div className="py-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto">
            <CreditCard size={28} className="text-indigo-500" />
          </div>
          <div>
            <p className="text-base font-bold text-[var(--text-primary)]">
              {t('credit.emptyTitle', 'Connect Your Bank Account')}
            </p>
            <p className="text-sm text-[var(--text-muted)] mt-1 max-w-md mx-auto">
              {t(
                'credit.emptyDescription',
                'Connect your bank account via Setu AA to see your credit health, CIBIL score, and loan eligibility.'
              )}
            </p>
          </div>
          {consentError && <p className="text-sm text-red-500">{consentError}</p>}
          <button
            onClick={handleRefresh}
            disabled={consentLoading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-xl font-bold text-sm hover:bg-indigo-600 active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={consentLoading ? 'animate-spin' : ''} />
            {consentLoading
              ? t('credit.connecting', 'Connecting...')
              : t('credit.connectSetu', 'Connect via Setu AA')}
          </button>
          <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--text-muted)]">
            <Info size={12} />
            <span>
              {t('credit.secureInfo', 'Your data is encrypted and never stored on our servers.')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card px-4 sm:px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <CreditCard size={18} className="text-indigo-500" />
          </div>
          <div>
            <h3 className="font-manrope font-bold text-base text-[var(--text-primary)]">
              {t('credit.healthTitle', 'Credit Health')}
            </h3>
            <p className="text-[length:var(--fs-caption)] text-[var(--text-muted)]">
              {t('credit.lastUpdated', 'Last updated: {{date}}', { date: creditScore?.date ?? '' })}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={consentLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-[13px] font-bold hover:bg-indigo-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <RefreshCw size={14} className={consentLoading ? 'animate-spin' : ''} />
          {t('credit.refresh', 'Refresh')}
        </button>
      </div>

      <div className="space-y-6">
        {/* Score Gauge */}
        <div className="flex justify-center">
          {creditScore && <ScoreGauge score={creditScore.score} />}
        </div>

        {/* Score Trend */}
        {scoreTrend.length > 0 && <ScoreTrendChart trend={scoreTrend} />}

        {/* Factor Breakdown */}
        {creditScore && <FactorBreakdown factors={creditScore.factors} />}

        {/* Dragging Factors */}
        {creditScore && <DraggingFactors score={creditScore} />}

        {/* Loan Eligibility */}
        {eligibility.length > 0 && <LoanEligibilityCards eligibility={eligibility} />}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <ExternalLink size={11} />
            <span>{t('credit.dataViaSetu', 'Data via Setu AA')}</span>
          </div>
          <span className="text-[11px] font-bold text-[var(--text-muted)]">
            {t('credit.scoreRange', '300-900 CIBIL Range')}
          </span>
        </div>
      </div>
    </div>
  );
}

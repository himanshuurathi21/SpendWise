import React from 'react';

type SkeletonVariant = 'dashboard' | 'list' | 'chart' | 'goals' | 'budget' | 'analytics';

interface SkeletonLoaderProps {
  variant?: SkeletonVariant;
  className?: string;
}

// ─── Reusable shimmer block ───────────────────────────────────────────────────
const Shimmer = ({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => <div className={`rounded-xl skeleton-wave ${className}`} style={style} />;

// ─── Variant renderers ────────────────────────────────────────────────────────
const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse p-1">
    {/* Hero card */}
    <Shimmer className="h-52 w-full" style={{ borderRadius: '24px' }} />
    {/* Stat row */}
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {[...Array(5)].map((_, i) => (
        <Shimmer key={i} className="h-20" />
      ))}
    </div>
    {/* Two col layout */}
    <div className="flex gap-4">
      <div className="flex-1 space-y-4">
        <Shimmer className="h-48" />
        <Shimmer className="h-32" />
      </div>
      <div className="w-[280px] space-y-4 hidden lg:block">
        <Shimmer className="h-48" />
        <Shimmer className="h-28" />
      </div>
    </div>
  </div>
);

const ListSkeleton = () => (
  <div className="space-y-2 animate-pulse">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-2 py-2">
        <Shimmer className="w-10 h-10 !rounded-2xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-3 w-[55%]" />
          <Shimmer className="h-2.5 w-[35%]" />
        </div>
        <Shimmer className="h-4 w-16 shrink-0" />
      </div>
    ))}
  </div>
);

const ChartSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="flex items-center justify-between">
      <Shimmer className="h-5 w-40" />
      <div className="flex gap-2">
        <Shimmer className="h-7 w-20" />
        <Shimmer className="h-7 w-20" />
      </div>
    </div>
    {/* Bar chart skeleton */}
    <div className="flex items-end gap-3 h-48 px-4">
      {[65, 45, 80, 55, 70, 40, 90, 60, 75, 50, 85, 45].map((h, i) => (
        <Shimmer key={i} className="flex-1" style={{ height: `${h}%`, minWidth: 0 }} />
      ))}
    </div>
    {/* Legend */}
    <div className="flex gap-4 justify-center">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Shimmer className="w-3 h-3 !rounded-full" />
          <Shimmer className="h-3 w-16" />
        </div>
      ))}
    </div>
  </div>
);

const GoalsSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="card p-5 space-y-4">
        <div className="flex items-center gap-4">
          <Shimmer className="w-[72px] h-[72px] !rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-4 w-[60%]" />
            <Shimmer className="h-3 w-[80%]" />
            <Shimmer className="h-5 w-20 !rounded-full" />
          </div>
        </div>
        <Shimmer className="h-2 w-full !rounded-full" />
        <div className="flex justify-between items-center">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-8 w-24 !rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

const BudgetSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {/* Summary bar */}
    <Shimmer className="h-16 w-full" /* tailwind-migration:replaced */ />
    {/* Budget rows */}
    {[...Array(5)].map((_, i) => (
      <div key={i} className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shimmer className="w-10 h-10 !rounded-xl shrink-0" />
            <div className="space-y-1.5">
              <Shimmer className="h-3.5 w-28" />
              <Shimmer className="h-2.5 w-20" />
            </div>
          </div>
          <Shimmer className="h-4 w-16" />
        </div>
        <Shimmer className="h-2 w-full !rounded-full" />
      </div>
    ))}
  </div>
);

const AnalyticsSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {/* Tabs */}
    <div className="flex gap-2">
      {[...Array(4)].map((_, i) => (
        <Shimmer key={i} className="h-9 w-24 !rounded-full" />
      ))}
    </div>
    {/* Donut + bar grid */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card p-5 space-y-3">
        <Shimmer className="h-4 w-32" />
        <div className="flex justify-center">
          <Shimmer className="w-52 h-52 !rounded-full" />
        </div>
      </div>
      <div className="card p-5">
        <ChartSkeleton />
      </div>
    </div>
    {/* Heatmap placeholder */}
    <div className="card p-5 space-y-3">
      <Shimmer className="h-4 w-40" />
      <div className="grid grid-cols-7 gap-1">
        {[...Array(35)].map((_, i) => (
          <Shimmer key={i} className="h-8" />
        ))}
      </div>
    </div>
  </div>
);

// ─── Main export ──────────────────────────────────────────────────────────────
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = React.memo(
  ({ variant = 'dashboard', className = '' }) => {
    const content = (() => {
      switch (variant) {
        case 'list':
          return <ListSkeleton />;
        case 'chart':
          return <ChartSkeleton />;
        case 'goals':
          return <GoalsSkeleton />;
        case 'budget':
          return <BudgetSkeleton />;
        case 'analytics':
          return <AnalyticsSkeleton />;
        default:
          return <DashboardSkeleton />;
      }
    })();

    return <div className={className}>{content}</div>;
  }
);

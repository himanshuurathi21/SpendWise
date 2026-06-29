import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Settings, LogOut, DownloadCloud } from 'lucide-react';
import { AppView } from '@/types';
import { haptic } from '@/core/haptic';
import { IconNavItem, Sep } from './IconNavItem';

interface DesktopSidebarProps {
  activeView: AppView;
  navigate: (view: AppView) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coreItems: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wealthItems: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolItems: any[];
  overBudgetCount: number;
  showInstall?: boolean;
  onInstall?: () => void;
  signOut: () => void;
}

export function DesktopSidebar({
  activeView,
  navigate,
  coreItems,
  wealthItems,
  toolItems,
  overBudgetCount,
  showInstall,
  onInstall,
  signOut,
}: DesktopSidebarProps) {
  const [showSignOutTip, setShowSignOutTip] = useState(false);
  const [signOutTipTop, setSignOutTipTop] = useState(0);
  const signOutRef = useRef<HTMLButtonElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signOutTimer = useRef<any>(null);

  return (
    <aside
      className="hidden md:flex flex-col fixed left-0 top-0 h-full z-40 items-center py-4 overflow-y-auto hide-scrollbar"
      style={{
        width: '56px',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="mb-4 flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md"
          style={{ background: 'linear-gradient(135deg, var(--teal) 0%, #0d9488 100%)' }}
          title="SpendWise"
        >
          <Coins size={16} className="text-white" />
        </div>
      </div>

      <Sep />

      <nav
        className="flex flex-col items-center gap-1 mt-2"
        role="navigation"
        aria-label="Core navigation"
      >
        {coreItems.map(item => (
          <IconNavItem
            key={item.id}
            id={item.id}
            label={item.label}
            icon={item.icon}
            isActive={activeView === item.id}
            badge={item.id === 'budget' ? overBudgetCount : 0}
            onClick={() => navigate(item.id)}
          />
        ))}
      </nav>

      <Sep style={{ marginTop: '8px', marginBottom: '8px' }} />

      <nav
        className="flex flex-col items-center gap-1"
        role="navigation"
        aria-label="Wealth navigation"
      >
        {wealthItems.map(item => (
          <IconNavItem
            key={item.id}
            id={item.id}
            label={item.label}
            icon={item.icon}
            isActive={activeView === item.id}
            onClick={() => navigate(item.id)}
          />
        ))}
      </nav>

      <Sep style={{ marginTop: '8px', marginBottom: '8px' }} />

      <nav
        className="flex flex-col items-center gap-1"
        role="navigation"
        aria-label="Tools navigation"
      >
        {toolItems.map(item => (
          <IconNavItem
            key={item.id}
            id={item.id}
            label={item.label}
            icon={item.icon}
            isActive={activeView === item.id}
            onClick={() => navigate(item.id)}
          />
        ))}
      </nav>

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-1">
        {showInstall && (
          <IconNavItem
            id={'profile' as AppView}
            label="Install SpendWise"
            icon={DownloadCloud}
            isActive={false}
            onClick={() => {
              haptic.medium();
              onInstall?.();
            }}
          />
        )}
        <IconNavItem
          id={'profile' as AppView}
          label="Profile & Settings"
          icon={Settings}
          isActive={activeView === 'profile'}
          onClick={() => navigate('profile')}
        />
        <div
          className="relative flex items-center"
          onMouseEnter={() => {
            if (signOutRef.current) {
              const rect = signOutRef.current.getBoundingClientRect();
              setSignOutTipTop(rect.top + rect.height / 2);
            }
            signOutTimer.current = setTimeout(() => setShowSignOutTip(true), 120);
          }}
          onMouseLeave={() => {
            clearTimeout(signOutTimer.current);
            setShowSignOutTip(false);
          }}
        >
          <button
            ref={signOutRef}
            onClick={() => {
              haptic.light();
              signOut();
            }}
            aria-label="Sign out"
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
            style={{ color: 'var(--sidebar-text)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)';
              (e.currentTarget as HTMLButtonElement).style.color = '#f87171';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--sidebar-text)';
            }}
          >
            <LogOut size={18} strokeWidth={2} />
          </button>

          <AnimatePresence>
            {showSignOutTip && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                className="fixed z-[100] pointer-events-none whitespace-nowrap"
                style={{ left: '68px', top: `${signOutTipTop}px`, transform: 'translateY(-50%)' }}
              >
                <div
                  className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold shadow-2xl relative"
                  style={{
                    background: 'rgba(239, 68, 68, 0.95)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    boxShadow:
                      '0 10px 25px -5px rgba(239, 68, 68, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
                    fontFamily: 'var(--font-inter)',
                  }}
                >
                  <div
                    className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rotate-45"
                    style={{
                      background: 'rgba(239, 68, 68, 0.95)',
                      borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                  />
                  <span className="relative z-10">Sign Out</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}

import { motion, AnimatePresence } from 'framer-motion';
import { X, Sun, Moon, DownloadCloud, Settings, LogOut } from 'lucide-react';
import { AppView } from '@/types';
import { haptic } from '@/core/haptic';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: AppView;
  navigate: (view: AppView) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mobileDrawerItems: any[];
  overBudgetCount: number;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  showInstall?: boolean;
  onInstall?: () => void;
  signOut: () => void;
}

export function MobileDrawer({
  isOpen,
  onClose,
  activeView,
  navigate,
  mobileDrawerItems,
  overBudgetCount,
  theme,
  onToggleTheme,
  showInstall,
  onInstall,
  signOut,
}: MobileDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] md:hidden flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative rounded-t-[28px] overflow-hidden flex flex-col"
            style={{
              background: 'var(--sidebar-bg)',
              maxHeight: '80vh',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              />
            </div>

            <div
              className="flex items-center justify-between px-5 pb-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-manrope)',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: '#fff',
                }}
              >
                Spend<span style={{ color: 'var(--teal)' }}>Wise</span>
              </span>
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="w-9 h-9 flex items-center justify-center rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <X size={18} className="text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2 mb-4">
                {mobileDrawerItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all min-h-[52px]"
                      style={{
                        background: isActive
                          ? 'linear-gradient(135deg, var(--teal) 0%, #0d9488 100%)'
                          : 'rgba(255,255,255,0.05)',
                        color: isActive ? '#fff' : 'var(--sidebar-text)',
                        fontFamily: 'var(--font-inter)',
                        fontSize: '13px',
                        fontWeight: isActive ? 600 : 500,
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                      <span>{item.label}</span>
                      {item.id === 'budget' && overBudgetCount > 0 && (
                        <span
                          className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full text-[10px] font-bold px-1"
                          style={{ background: 'var(--red, #ef4444)', color: '#fff' }}
                        >
                          {overBudgetCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="h-px mb-4" style={{ background: 'rgba(255,255,255,0.07)' }} />

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    haptic.medium();
                    onToggleTheme?.();
                  }}
                  className="flex items-center justify-between px-4 py-3 rounded-2xl min-h-[52px]"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontFamily: 'var(--font-inter)',
                    fontSize: '14px',
                    fontWeight: 500,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                    <span>Dark Mode</span>
                  </div>
                  <div
                    className="w-10 h-5 rounded-full relative"
                    style={{ background: 'rgba(255,255,255,0.1)' }}
                  >
                    <div
                      className="absolute top-1 w-3 h-3 rounded-full transition-all"
                      style={{
                        background: 'var(--teal)',
                        left: theme === 'dark' ? 'calc(100% - 16px)' : '4px',
                      }}
                    />
                  </div>
                </button>

                {showInstall && (
                  <button
                    onClick={() => {
                      haptic.medium();
                      onInstall?.();
                      onClose();
                    }}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl min-h-[52px]"
                    style={{
                      background: 'var(--teal)',
                      color: '#fff',
                      fontFamily: 'var(--font-inter)',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  >
                    <DownloadCloud size={18} />
                    <span>Install App</span>
                  </button>
                )}

                <button
                  onClick={() => navigate('profile')}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl min-h-[52px]"
                  style={{
                    background:
                      activeView === 'profile'
                        ? 'linear-gradient(135deg, var(--teal) 0%, #0d9488 100%)'
                        : 'rgba(255,255,255,0.05)',
                    color: activeView === 'profile' ? '#fff' : 'var(--sidebar-text)',
                    fontFamily: 'var(--font-inter)',
                    fontSize: '14px',
                    fontWeight: activeView === 'profile' ? 600 : 500,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Settings size={18} strokeWidth={2} />
                  <span>Profile & Settings</span>
                </button>

                <button
                  onClick={() => {
                    haptic.light();
                    signOut();
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl min-h-[52px]"
                  style={{
                    color: 'var(--teal)',
                    fontFamily: 'var(--font-inter)',
                    fontSize: '14px',
                    fontWeight: 500,
                    border: '1px solid rgba(20,184,166,0.2)',
                  }}
                >
                  <LogOut size={18} strokeWidth={2} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

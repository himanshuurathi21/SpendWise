import { useEffect, useRef, useState, memo } from 'react';
import { X, Bell, CheckCheck, ExternalLink, Sparkles, AlarmClock } from 'lucide-react';
import { AppNotification, AlertSeverity, AppView } from '@/types';

interface NotificationCenterProps {
  notifications: AppNotification[];
  unreadCount: number;
  isOpen: boolean;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigate: (view: AppView) => void;
  onSnooze?: (id: string, hours: number) => void;
  cloudMode?: boolean;
}

function severityBorderColor(s: AlertSeverity): string {
  if (s === 'danger') return 'var(--red)';
  if (s === 'warning') return 'var(--amber)';
  return 'var(--teal)';
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const NotifRow = memo(function NotifRow({
  notif,
  onMarkRead,
  onNavigate,
  onClose,
  onSnooze,
}: {
  notif: AppNotification;
  onMarkRead: (id: string) => void;
  onNavigate: (v: AppView) => void;
  onClose: () => void;
  onSnooze?: (id: string, hours: number) => void;
}) {
  const [showSnooze, setShowSnooze] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking snooze button
    if ((e.target as HTMLElement).closest('.snooze-btn')) return;
    onMarkRead(notif.id);
    if (notif.link) {
      onNavigate(notif.link);
      onClose();
    }
  };

  const SNOOZE_OPTIONS = [
    { label: '1 hour', hours: 1 },
    { label: '8 hours', hours: 8 },
    { label: 'Tomorrow', hours: 24 },
  ];

  return (
    <div
      onClick={handleClick}
      className="group relative flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface-hover)]"
      style={{
        borderLeft: `3px solid ${severityBorderColor(notif.severity)}`,
        opacity: notif.read ? 0.6 : 1,
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '2px' }}>{notif.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: '13px',
              fontWeight: notif.read ? 400 : 600,
              color: 'var(--text-primary)',
              lineHeight: 1.4,
            }}
          >
            {notif.title}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {relativeTime(notif.timestamp)}
            </span>
            {/* Snooze dropdown */}
            {onSnooze && !notif.read && (
              <div className="snooze-btn relative">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setShowSnooze(v => !v);
                  }}
                  className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--surface-input)] border-none cursor-pointer"
                  style={{ background: 'transparent', color: 'var(--text-muted)' }}
                  title="Snooze"
                >
                  <AlarmClock size={12} />
                </button>
                {showSnooze && (
                  <div
                    className="absolute right-0 top-7 z-20 rounded-xl shadow-lg overflow-hidden"
                    style={{
                      background: 'var(--surface-card)',
                      border: '1px solid var(--border)',
                      minWidth: 110,
                    }}
                  >
                    {SNOOZE_OPTIONS.map(opt => (
                      <button
                        key={opt.hours}
                        onClick={e => {
                          e.stopPropagation();
                          onSnooze(notif.id, opt.hours);
                          setShowSnooze(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-[var(--surface-hover)] border-none cursor-pointer block"
                        style={{
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-inter)',
                          background: 'transparent',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <p
          style={{
            fontFamily: 'var(--font-inter)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            marginTop: '2px',
            lineHeight: 1.5,
          }}
        >
          {notif.message}
        </p>
        {notif.link && (
          <span
            className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--teal)',
            }}
          >
            <ExternalLink size={10} /> Go to{' '}
            {notif.link.charAt(0).toUpperCase() + notif.link.slice(1)}
          </span>
        )}
      </div>
      {!notif.read && (
        <span
          className="mt-1.5 h-2 w-2 rounded-full shrink-0"
          style={{ background: 'var(--teal)' }}
        />
      )}
    </div>
  );
});

export default function NotificationCenter({
  notifications,
  unreadCount,
  isOpen,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
  onSnooze,
}: NotificationCenterProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', fn), 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', fn);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const grouped = {
    unread: notifications.filter(n => !n.read),
    read: notifications.filter(n => n.read),
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60]"
        style={{ background: 'rgba(0,0,0,0.15)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-4 z-[70] flex flex-col overflow-hidden animate-scale-in"
        style={{
          top: '80px',
          width: '360px',
          maxWidth: 'calc(100vw - 2rem)',
          maxHeight: 'calc(100vh - 100px)',
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--teal-dim)' }}
            >
              <Bell size={15} style={{ color: 'var(--teal)' }} />
            </div>
            <div>
              <h3
                style={{
                  fontFamily: 'var(--font-manrope)',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                Notifications
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-inter)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}
              >
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  background: 'var(--surface-input)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-inter)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{
                color: 'var(--text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* AI Insights Summary */}
          {unreadCount > 0 && (
            <div
              className="m-4 p-3 rounded-xl"
              style={{ background: 'var(--surface-input)', border: '1px solid var(--teal-glow)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} style={{ color: 'var(--teal)' }} />
                <span
                  style={{
                    fontFamily: 'var(--font-inter)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--teal)',
                  }}
                >
                  SpendWise Summary
                </span>
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-inter)',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                You have {unreadCount} new alert{unreadCount === 1 ? '' : 's'}. Priority attention
                is needed on your active budgets over limit.
              </p>
            </div>
          )}

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ background: 'var(--surface-input)' }}
              >
                <Bell size={20} style={{ color: 'var(--text-muted)' }} />
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-inter)',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                }}
              >
                No notifications
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-inter)',
                  fontSize: '12px',
                  color: 'var(--text-dim)',
                  marginTop: '4px',
                }}
              >
                You're all caught up!
              </p>
            </div>
          ) : (
            <>
              {grouped.unread.length > 0 && (
                <>
                  <div
                    className="sticky top-0 px-4 py-2"
                    style={{ background: 'var(--surface-card)' }}
                  >
                    <p
                      style={{
                        fontFamily: 'var(--font-inter)',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--text-muted)',
                      }}
                    >
                      New · {grouped.unread.length}
                    </p>
                  </div>
                  {grouped.unread.map(n => (
                    <NotifRow
                      key={n.id}
                      notif={n}
                      onMarkRead={onMarkRead}
                      onNavigate={onNavigate}
                      onClose={onClose}
                      onSnooze={onSnooze}
                    />
                  ))}
                </>
              )}
              {grouped.read.length > 0 && (
                <>
                  <div
                    className="sticky top-0 px-4 py-2"
                    style={{ background: 'var(--surface-card)' }}
                  >
                    <p
                      style={{
                        fontFamily: 'var(--font-inter)',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Earlier · {grouped.read.length}
                    </p>
                  </div>
                  {grouped.read.map(n => (
                    <NotifRow
                      key={n.id}
                      notif={n}
                      onMarkRead={onMarkRead}
                      onNavigate={onNavigate}
                      onClose={onClose}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 px-5 py-3 text-center"
          style={{ borderTop: '1.5px solid var(--border)' }}
        >
          <p
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            Powered by SpendWise · Data stored locally
          </p>
        </div>
      </div>
    </>
  );
}

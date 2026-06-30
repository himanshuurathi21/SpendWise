import { useEffect } from 'react';
import { useStore } from '@/store';
import { haptic } from '@/core/haptic';
import type { NotificationType, AlertSeverity } from '@/components/ui/types';

interface ShakeNotification {
  title: string;
  message: string;
  type: NotificationType;
  icon: string;
  severity: AlertSeverity;
}

export function useShakeFeedback(
  setShowFeedback: (show: boolean) => void,
  addNotification: (notif: ShakeNotification) => void
) {
  const store = useStore();

  // Shake Detection for Feedback & AI Assistant
  useEffect(() => {
    const enabled = store.userPreferences?.shakeEnabled ?? true;
    if (!enabled || !window.DeviceMotionEvent) return;

    let lastX = 0,
      lastY = 0,
      lastZ = 0;
    let lastUpdate = 0;
    const threshold = 18; // Slightly higher threshold for fewer false positives

    const handleMotion = (e: DeviceMotionEvent) => {
      const curTime = Date.now();
      if (curTime - lastUpdate > 100) {
        const acc = e.accelerationIncludingGravity;
        if (!acc) return;

        const { x, y, z } = acc;
        if (x === null || y === null || z === null) return;

        const deltaX = Math.abs(x - lastX);
        const deltaY = Math.abs(y - lastY);
        const deltaZ = Math.abs(z - lastZ);

        if (
          (deltaX > threshold && deltaY > threshold) ||
          (deltaX > threshold && deltaZ > threshold) ||
          (deltaY > threshold && deltaZ > threshold)
        ) {
          // Shake detected!
          haptic.heavy();

          // Show feedback modal instead of just switching view
          setShowFeedback(true);

          addNotification({
            title: 'Shake to Feedback 📱',
            message: 'Got something to say? We value your feedback!',
            type: 'insight',
            icon: '📱',
            severity: 'info',
          });
        }

        lastX = x;
        lastY = y;
        lastZ = z;
        lastUpdate = curTime;
      }
    };

    let isSubscribed = true;

    const deviceMotion = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof deviceMotion.requestPermission === 'function') {
      deviceMotion
        .requestPermission()
        .then((permission: string) => {
          if (permission === 'granted' && isSubscribed) {
            window.addEventListener('devicemotion', handleMotion, { passive: true });
          }
        })
        .catch((err: unknown) => console.error('DeviceMotion permission error:', err));
    } else {
      window.addEventListener('devicemotion', handleMotion, { passive: true });
    }

    return () => {
      isSubscribed = false;
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [store.userPreferences?.shakeEnabled, setShowFeedback, addNotification]);
}

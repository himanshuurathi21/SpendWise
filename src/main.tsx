import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from '@/app/App';
import { AuthProvider } from '@/hooks/useAuth';
import { CategoryProvider } from '@/hooks/useCategories';
import { CurrencyProvider } from '@/contexts/CurrencyContext';

import { validateEnv } from '@/config/env';
import { registerSW } from 'virtual:pwa-register';
import { runDexieMigration } from '@/db/migration';
import { setupPushNotifications } from '@/core/push/setupPushNotifications';

const envErrors = validateEnv();
if (envErrors.length > 0) {
  // Non-fatal: app works in offline/guest mode without Supabase
  console.warn('[SpendWise] ' + envErrors.join(', ') + ' — running in offline/guest mode');
}

// Register service worker for PWA (immediate: ensures update on next visit)
registerSW({ immediate: true });

// Run one-time migration from legacy localStorage → IndexedDB on first load
runDexieMigration().catch(err =>
  console.warn('[SpendWise] Dexie migration skipped or failed:', err)
);

// Setup Web Push notifications after app initializes
const userId =
  localStorage.getItem('spendwise_device_id') ||
  'device_' + Math.random().toString(36).substr(2, 12);
setupPushNotifications(userId).catch(err =>
  console.warn('[SpendWise] Push notification setup failed:', err)
);

// Preferences are now restored via the encrypted Zustand store inside App.tsx

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CurrencyProvider>
        <CategoryProvider>
          <App />
        </CategoryProvider>
      </CurrencyProvider>
    </AuthProvider>
  </StrictMode>
);

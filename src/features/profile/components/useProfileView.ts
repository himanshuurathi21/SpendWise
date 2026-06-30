import { useState, useCallback, useRef, useEffect } from 'react';
import { SpendWiseConfig } from '@/types/config';
import { parseTransactionsJSON } from '@/utils/import';
import { encryptData, decryptData } from '@/core/encryption';
import { useStore } from '@/store';
import { downloadDatabaseBackup, importDatabase } from '@/db/backup';
import { useCurrency, CurrencyCode } from '@/contexts/CurrencyContext';
import { haptic } from '@/core/haptic';
import { useAuth } from '@/hooks/useAuth';

const FONT_SIZES = ['text-sm', 'text-base', 'text-lg', 'text-xl'] as const;
export type FontSizeKey = (typeof FONT_SIZES)[number];
export const FONT_LABELS: Record<FontSizeKey, string> = {
  'text-sm': 'Small',
  'text-base': 'Medium',
  'text-lg': 'Large',
  'text-xl': 'XL',
};

interface ProfileNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export function useProfileView(
  config: SpendWiseConfig | null,
  onUpdateConfig: (cfg: SpendWiseConfig) => void,
  addNotification?: (n: ProfileNotification) => void
) {
  const store = useStore();
  const { setActiveCurrency } = useCurrency();
  const { sendPhoneOtp, verifyPhoneOtp } = useAuth();

  const [name, setName] = useState(config?.name ?? 'User');
  const [phone, setPhone] = useState(config?.phone ?? '');
  const [occupation, setOccupation] = useState(config?.occupation ?? '');
  const [location, setLocation] = useState(config?.location ?? '');
  const [phoneVerified, setPhoneVerified] = useState(
    () => !!store.userPreferences?.phoneVerified || false
  );
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [monthlyGoal, setMonthlyGoal] = useState(
    config?.monthlyGoal !== undefined ? String(config.monthlyGoal) : ''
  );
  const [currency, setCurrency] = useState(config?.currency ?? '$');
  const [showSavedMsg, setShowSavedMsg] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSecureExportModal, setShowSecureExportModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Preferences from secure store
  const prefs = store.userPreferences;

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatar = prefs.avatar;
  const fontSize = prefs.fontSize as FontSizeKey;
  const darkMode = prefs.darkMode;
  const highContrast = prefs.highContrast;
  const hapticsEnabled = prefs.hapticsEnabled;
  const shakeEnabled = prefs.shakeEnabled;

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Sync DOM with font size (in case it wasn't caught globally)
  useEffect(() => {
    if (!fontSize) return;
    FONT_SIZES.forEach(s => document.documentElement.classList.remove(s));
    document.documentElement.classList.add(fontSize);
  }, [fontSize]);

  // Handlers
  const handleFontSize = (size: FontSizeKey) => {
    FONT_SIZES.forEach(s => document.documentElement.classList.remove(s));
    document.documentElement.classList.add(size);
    store.setUserPreferences({ ...prefs, fontSize: size });
  };
  const handleDarkMode = (on: boolean) => {
    document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
    if (on) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    store.setUserPreferences({ ...prefs, darkMode: on });
  };
  const toggleHighContrast = (checked: boolean) => {
    document.documentElement.classList.toggle('high-contrast', checked);
    store.setUserPreferences({ ...prefs, highContrast: checked });
  };
  const toggleHaptics = (enabled: boolean) => {
    store.setUserPreferences({ ...prefs, hapticsEnabled: enabled });
    if (enabled) haptic.medium();
  };
  const toggleShake = (enabled: boolean) => {
    store.setUserPreferences({ ...prefs, shakeEnabled: enabled });
    if (enabled) haptic.medium();
  };
  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    haptic.medium();
    const p = await Notification.requestPermission();
    setNotifPermission(p);
    if (p === 'granted') haptic.success();
  };
  const testNotification = () => {
    if (notifPermission !== 'granted') return;
    haptic.light();
    new Notification('SpendWise Premium', {
      body: 'Notifications are working perfectly! 🚀',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💎</text></svg>',
    });
  };
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      store.setUserPreferences({ ...prefs, avatar: b64 });
    };
    reader.readAsDataURL(file);
  };
  const handleSendOtp = useCallback(async () => {
    setOtpLoading(true);
    setOtpError('');
    try {
      await sendPhoneOtp(phone);
      setOtpSent(true);
      haptic.success();
    } catch (err) {
      setOtpError((err as Error).message || 'Failed to send OTP');
      haptic.error();
    } finally {
      setOtpLoading(false);
    }
  }, [phone, sendPhoneOtp]);

  const handleVerifyOtp = useCallback(async () => {
    setOtpLoading(true);
    setOtpError('');
    try {
      await verifyPhoneOtp(phone, otpValue);
      setPhoneVerified(true);
      setOtpSent(false);
      setOtpValue('');
      const prefs = store.userPreferences;
      store.setUserPreferences({ ...prefs, phoneVerified: true });
      haptic.success();
    } catch (err) {
      setOtpError((err as Error).message || 'Failed to verify OTP');
      haptic.error();
    } finally {
      setOtpLoading(false);
    }
  }, [phone, otpValue, verifyPhoneOtp, store]);

  const handleSave = useCallback(() => {
    if (!config) return;
    onUpdateConfig({
      ...config,
      name,
      currency,
      phone: phone.trim() || undefined,
      occupation: occupation.trim() || undefined,
      location: location.trim() || undefined,
      monthlyGoal: monthlyGoal ? parseFloat(monthlyGoal) : undefined,
    });
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 3000);
  }, [config, name, currency, phone, occupation, location, monthlyGoal, onUpdateConfig]);

  const handleSecureExport = async (password: string) => {
    setIsExporting(true);
    try {
      const dataToExport = {
        transactions: store.transactions,
        budgets: store.budgets,
        quests: store.quests,
        parentalState: store.parentalState,
        assets: store.assets,
        liabilities: store.liabilities,
        subscriptions: store.subscriptions,
        exportDate: new Date().toISOString(),
      };
      const encrypted = await encryptData(JSON.stringify(dataToExport), password);
      const blob = new Blob([encrypted], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `spendwise_secure_backup_${new Date().toISOString().split('T')[0]}.swb`;
      link.click();
      URL.revokeObjectURL(url);
      setShowSecureExportModal(false);
    } catch (e) {
      console.warn('[Profile] Secure export failed:', e);
      alert('Export failed.');
    } finally {
      setIsExporting(false);
    }
  };
  const handleRestore = async (file: File, password: string) => {
    setIsRestoring(true);
    try {
      const decryptedJson = await decryptData(await file.text(), password);
      store.restoreBackup(JSON.parse(decryptedJson));
      setShowRestoreModal(false);
      alert('Backup restored successfully!');
    } catch (e) {
      console.warn('[Profile] Restore failed:', e);
      alert('Restore failed. Invalid password or corrupted file.');
    } finally {
      setIsRestoring(false);
    }
  };
  const handleRawDBExport = async () => {
    try {
      await downloadDatabaseBackup();
    } catch (e) {
      console.warn('[Profile] Raw DB export failed:', e);
      alert('Failed to download raw database backup.');
    }
  };
  const handleRawDBImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (window.confirm('This will OVERWRITE your current database. Are you sure?')) {
      try {
        await importDatabase(file);
      } catch (e) {
        console.warn('[Profile] Raw DB import failed:', e);
        alert('Failed to import database.');
      }
    }
  };
  const handleImportTransactions = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { transactions: importedTxs, errors } = await parseTransactionsJSON(file);
      if (errors.length > 0 && importedTxs.length === 0) {
        alert(`Failed to import: ${errors[0]}`);
        return;
      }
      if (
        importedTxs.length > 0 &&
        window.confirm(`Found ${importedTxs.length} transactions. Import them?`)
      ) {
        store.addTransactions(importedTxs);
        addNotification?.({
          id: Date.now().toString(),
          type: 'system',
          title: 'Transactions Imported',
          message: `${importedTxs.length} transactions successfully added.`,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }
    } catch (e) {
      console.warn('[Profile] Transaction import failed:', e);
      alert('Failed to read file.');
    }
  };
  const handleCurrencySelect = (code: CurrencyCode) => {
    setActiveCurrency(code);
    setCurrency(code);
    if (config) {
      onUpdateConfig({ ...config, currency: code });
    }
  };

  return {
    // form fields
    name,
    setName,
    phone,
    setPhone,
    phoneVerified,
    otpSent,
    otpValue,
    setOtpValue,
    otpLoading,
    otpError,
    handleSendOtp,
    handleVerifyOtp,
    occupation,
    setOccupation,
    location,
    setLocation,
    monthlyGoal,
    setMonthlyGoal,
    currency,
    // modals
    showSavedMsg,
    showResetConfirm,
    setShowResetConfirm,
    showSecureExportModal,
    setShowSecureExportModal,
    showRestoreModal,
    setShowRestoreModal,
    isExporting,
    isRestoring,
    // avatar
    avatar,
    avatarInputRef,
    handleAvatarChange,
    // accessibility
    fontSize,
    FONT_SIZES,
    FONT_LABELS,
    handleFontSize,
    darkMode,
    handleDarkMode,
    highContrast,
    toggleHighContrast,
    hapticsEnabled,
    toggleHaptics,
    shakeEnabled,
    toggleShake,
    notifPermission,
    requestNotifPermission,
    testNotification,
    // handlers
    handleSave,
    handleSecureExport,
    handleRestore,
    handleRawDBExport,
    handleRawDBImport,
    handleImportTransactions,
    handleCurrencySelect,
  };
}

import { useState } from 'react';
import { useStore } from '@/store';

export function useParentalManager() {
  const store = useStore();
  const settings = store.parentalState;
  // Setup state
  const [setupStep, setSetupStep] = useState<'welcome' | 'pin' | 'limits'>('welcome');
  const [newPin, setNewPin] = useState('');
  const [pinError] = useState('');

  // Unlocking state
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const isSetup = settings.enabled && (settings.parentPinHash || settings.parentId);
  const isLocked = settings.enabled && settings.parentPinHash && !settings.sessionUnlocked;

  const pendingTransactions = settings.pendingTransactions || [];

  const handleUnlock = async () => {
    const isValid = await store.verifyPin(unlockPin);
    if (isValid) {
      store.unlockSession();
      setUnlockPin('');
      setUnlockError('');
    } else {
      setUnlockError('Invalid PIN');
      setUnlockPin('');
    }
  };

  const handleSetPin = async () => {
    if (newPin.length === 4) {
      await store.setupPin(newPin);
      setSetupStep('limits');
    }
  };

  const handleApprove = (id: string) => {
    store.approveTransaction(id);
  };

  const handleReject = (id: string) => {
    store.denyTransaction(id);
  };

  const updateSettings = (updates: Partial<typeof settings>) => {
    store.updateParentalSettings(updates);
  };

  const lockSession = () => store.lockSession();
  const removePin = () => store.removePin();

  const completeSetup = () => {
    store.updateParentalSettings({ enabled: true, sessionUnlocked: true });
  };

  return {
    settings,
    setupStep,
    setSetupStep,
    newPin,
    setNewPin,
    pinError,
    unlockPin,
    setUnlockPin,
    unlockError,
    setUnlockError,
    isSetup,
    isLocked,
    pendingTransactions,
    handleUnlock,
    handleSetPin,
    handleApprove,
    handleReject,
    updateSettings,
    lockSession,
    removePin,
    completeSetup,
  };
}

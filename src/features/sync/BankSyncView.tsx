import { useState, useEffect, useCallback } from 'react';
import { Brain, CheckCircle2, Sparkles } from 'lucide-react';
import { Transaction, LinkedAccount, FinanceProvider, Category, SyncView } from '@/types';
import { UPI_PROVIDERS } from '@/features/sync/parsers/upi';
import { useSharedWallets, SharedGroup } from '@/features/shared/hooks/useSharedWallets';
import { useAuth } from '@/hooks/useAuth';
import {
  parseONDCNotification,
  ONDC_BUYER_APPS,
  ParsedONDTransaction,
} from '@/features/sync/parsers/ondc';
import {
  initiateRazorpayPayment,
  parseUPIPayment,
  rememberMerchant,
  parseUPIDescription,
  loadMerchantMemory,
} from '@/utils/razorpaySync';
import { createSetuConsent, fetchSetuBankStatements } from '@/core/setuAA';
import { predictCategory } from '@/utils/merchantMapper';
import { useStore } from '@/store';
import { Category as CategoryType } from '@/types';
import SyncDashboard from '@/features/sync/components/SyncDashboard';
import SelectSource from '@/features/sync/components/SelectSource';
import UPILink from '@/features/sync/components/UPILink';
import RazorpayLink from '@/features/sync/components/RazorpayLink';
import PayForm from '@/features/sync/components/PayForm';
import ONDCConnectView from '@/features/sync/components/ONDCConnectView';
import SyncingOverlay from '@/features/sync/components/SyncingOverlay';

let idCounter = 0;

interface BankSyncViewProps {
  onAutoAddTransactions: (txs: Transaction[]) => void;
  recentTransactions?: Transaction[];
  currency?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNavigate?: (view: any) => void;
}

const CATEGORIES: Category[] = [
  'Food',
  'Transport',
  'Shopping',
  'Subscriptions',
  'Entertainment',
  'Utilities',
  'Health',
  'Income',
  'Transfer',
];

export default function BankSyncView({
  onAutoAddTransactions,
  recentTransactions = [],
  currency = '₹',
  onNavigate,
}: BankSyncViewProps) {
  const { razorpayKeys, setRazorpayKeys, updateTransactionCategory } = useStore();
  const { user } = useAuth();
  const userId = user?.id ?? 'local-user';
  const userEmail = user?.email ?? null;
  const sharedWalletsHook = useSharedWallets(userId, userEmail);
  const [view, setView] = useState<SyncView>('dashboard');
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [merchantMemoryCount, setMerchantMemoryCount] = useState(0);

  const [lastTx, setLastTx] = useState<Transaction | null>(null);
  const [corrCategory, setCorrCat] = useState<Category>('Transfer');

  const [syncState, setSyncState] = useState<
    'idle' | 'parsing' | 'categorising' | 'review' | 'done' | 'error'
  >('idle');
  const [stagedTxs, setStagedTxs] = useState<Transaction[]>([]);
  const [syncingAcc, setSyncingAcc] = useState<LinkedAccount | null>(null);
  const [existingCount, setExistingCount] = useState(0);

  // Load Razorpay account from store on mount
  useEffect(() => {
    const key = razorpayKeys?.keyId;
    if (key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccounts((p: LinkedAccount[]) => {
        if (p.some(a => a.provider === 'razorpay')) return p;
        return [
          ...p,
          {
            id: 'rzp-auth',
            provider: 'razorpay',
            upiId: key.substring(0, 14) + '…',
            linkedAt: new Date().toISOString(),
            lastSynced: new Date().toISOString(),
            status: 'active',
          },
        ];
      });
    }
    // Count merchant memory entries from secure storage
    const mem = loadMerchantMemory();
    setMerchantMemoryCount(Object.keys(mem).length);
  }, [razorpayKeys, setRazorpayKeys]);

  const handleUPILinkSuccess = (provider: (typeof UPI_PROVIDERS)[0], id: string) => {
    const newAccount: LinkedAccount = {
      id: `acc-${idCounter++}`,
      provider: provider.id as FinanceProvider,
      upiId: id,
      linkedAt: new Date().toISOString(),
      lastSynced: new Date().toISOString(),
      status: 'active',
    };
    setAccounts(prev => [newAccount, ...prev]);
    handleMockSync(newAccount);
    setView('dashboard');
  };

  const handleONDCLinkSuccess = (app: (typeof ONDC_BUYER_APPS)[number], upiId: string) => {
    const newAccount: LinkedAccount = {
      id: `acc-${idCounter++}`,
      provider: 'ondc',
      upiId: upiId,
      linkedAt: new Date().toISOString(),
      lastSynced: new Date().toISOString(),
      status: 'active',
    };
    setAccounts(prev => [newAccount, ...prev]);
    handleMockONDCNotifications();
    setView('dashboard');
  };

  const handleMockONDCNotifications = async () => {
    setSyncingAcc({
      id: 'ondc-mock',
      provider: 'ondc',
      upiId: 'ondc@open network',
      linkedAt: new Date().toISOString(),
      lastSynced: new Date().toISOString(),
      status: 'active',
    });
    setSyncState('parsing');
    try {
      const mockNotifications = [
        'ONDC order confirmed: ₹350 at Pizza Hut via Magicpin',
        'ONDC delivery completed: ONDC_ORD_001 from Meesho Fashion',
        'ONDC order confirmed: ₹1200 at Flipkart Electronics via Flipkart',
        'ONDC payment: ₹85 at Fresh Bakery via Magicpin',
        'ONDC order placed: ONDC_ORD_002 — ₹1599 at Myntra Fashion',
        'ONDC delivery completed: ONDC_ORD_003 from Blinkit Grocery',
      ];

      await new Promise(r => setTimeout(r, 1000));
      setSyncState('categorising');
      await new Promise(r => setTimeout(r, 800));

      const parsed = mockNotifications
        .map(parseONDCNotification)
        .filter(Boolean) as ParsedONDTransaction[];

      const txs: Transaction[] = parsed.map(p => ({
        id: p.id,
        date: p.date,
        amount: p.amount,
        type: p.type,
        category: p.category,
        merchant: p.merchant,
        description: p.orderId
          ? `ONDC Order: ${p.orderId}`
          : p.buyerApp
            ? `via ${p.buyerApp}`
            : undefined,
        isNew: true,
        confidence: p.confidence === 'high' ? 0.9 : p.confidence === 'medium' ? 0.6 : 0.3,
        aiParsed: true,
        tags: ['ondc', p.buyerApp?.toLowerCase() ?? 'ondc'].filter(Boolean),
      }));

      setExistingCount(0);
      setStagedTxs(txs);
      setSyncState('review');
    } catch (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      err: any
    ) {
      console.error(err);
      setSyncState('error');
    } finally {
      setSyncingAccountId(null);
    }
  };

  const handlePay = useCallback(
    (amount: number, description: string) => {
      const keyId = razorpayKeys?.keyId;
      if (!keyId) {
        setView('rzp-link');
        return;
      }

      initiateRazorpayPayment({
        keyId,
        amount: amount,
        description: description || 'UPI Payment',
        prefillContact: undefined,
        onSuccess: async result => {
          setView('pay-parsing');
          const parsed = await parseUPIPayment(description || result.description, '');
          const tx: Transaction = {
            id: `rzp_pay_${result.razorpay_payment_id}`,
            date: new Date().toISOString(),
            amount: result.amount,
            type: 'debit',
            category: parsed.category,
            merchant: parsed.merchant,
            description: `Razorpay UPI · ${result.razorpay_payment_id}`,
            isNew: true,
            confidence: parsed.confidence,
            aiParsed: parsed.aiParsed,
            tags: ['upi', 'razorpay'],
          };
          setLastTx(tx);
          setCorrCat(parsed.category);
          onAutoAddTransactions([tx]);
          setView('pay-success');
        },
        onFailure: () => setView('pay-form'),
      });
    },
    [razorpayKeys, onAutoAddTransactions]
  );

  const applyCorrection = () => {
    if (!lastTx) return;
    // BUG-15 fix: use merchant name as fallback key when no UPI VPA is available
    rememberMerchant(lastTx.merchant.toLowerCase(), lastTx.merchant, corrCategory);
    // BUG-15 fix: update the existing transaction instead of re-adding (was causing duplicates)
    updateTransactionCategory(lastTx.id, corrCategory as CategoryType);
    setView('dashboard');
  };

  /** Mock sync for non-Razorpay providers with Step-by-Step feedback and Review */
  const handleMockSync = async (acc: LinkedAccount) => {
    setSyncingAccountId(acc.id);
    setSyncingAcc(acc);
    setSyncState('parsing');
    try {
      // 1. Request Consent from Setu Account Aggregator
      const mobileNumber = '9876543210'; // In a real app, prompt the user or pull from profile
      const consent = await createSetuConsent(mobileNumber);

      // (In real flow: we would redirect the user to `consent.url`, they approve, and return)

      // 2. Fetch Bank Statements from Setu AA
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawMockTxs = (await fetchSetuBankStatements(consent.id)) as any[];

      // Step 1: Parse UPI strings
      const parsedTxs = rawMockTxs.map(tx => {
        const parsed = parseUPIDescription(tx.merchant || '');
        return {
          ...tx,
          merchant: parsed.merchant || tx.merchant,
          description: parsed.upiId ? `UPI VPA: ${parsed.upiId}` : tx.description,
          upiId: parsed.upiId,
          id: `tx_${idCounter++}`,
        };
      });

      setSyncState('categorising');
      await new Promise(r => setTimeout(r, 1000));

      // Step 2: Bulk categorise using existing merchant memory & merchantMapper
      const mem = loadMerchantMemory();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const categorisedTxs = parsedTxs.map((tx: any) => {
        const vpaKey = tx.upiId?.toLowerCase();
        let cat;
        if (vpaKey && mem[vpaKey]) {
          cat = mem[vpaKey].category as Category;
        } else {
          cat = predictCategory(tx.merchant) || 'Shopping';
        }
        return {
          ...tx,
          category: cat,
        };
      });

      setExistingCount(Math.floor(Math.random() * 3) + 1);
      setStagedTxs(categorisedTxs);
      setSyncState('review');
    } catch (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      err: any
    ) {
      console.error(err);
      setSyncState('error');
    } finally {
      setSyncingAccountId(null);
    }
  };

  const handleConfirmImport = useCallback(() => {
    onAutoAddTransactions(stagedTxs);
    if (syncingAcc) {
      setAccounts(p =>
        p.map(a => (a.id === syncingAcc.id ? { ...a, lastSynced: new Date().toISOString() } : a))
      );
    }
    setSyncState('done');
  }, [onAutoAddTransactions, stagedTxs, syncingAcc]);

  const handleCategoryChange = useCallback((txId: string, newCat: Category) => {
    setStagedTxs(prev => prev.map(t => (t.id === txId ? { ...t, category: newCat } : t)));
  }, []);

  const handleSyncAccount = (acc: LinkedAccount) => {
    if ((acc.provider as string) === 'razorpay') return;
    handleMockSync(acc);
  };

  const _formatDate = (iso: string) =>
    new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));

  const totalUPISpend = recentTransactions
    .filter(t => t.type === 'debit')
    .reduce((s, t) => s + t.amount, 0);
  const aiParsedCount = recentTransactions.filter(t => t.aiParsed).length;

  const handleRazorpayConnect = useCallback(
    (keyId: string, secret: string) => {
      setRazorpayKeys({ keyId, keySecret: secret });
      setAccounts((p: LinkedAccount[]) => {
        const filtered = p.filter(a => a.provider !== 'razorpay');
        return [
          {
            id: 'rzp-auth',
            provider: 'razorpay',
            upiId: keyId.substring(0, 14) + '…',
            linkedAt: new Date().toISOString(),
            lastSynced: new Date().toISOString(),
            status: 'active',
          },
          ...filtered,
        ];
      });
      setView('dashboard');
    },
    [setRazorpayKeys]
  );

  return (
    <div className="view-container">
      {view === 'dashboard' && (
        <SyncDashboard
          totalUPISpend={totalUPISpend}
          aiParsedCount={aiParsedCount}
          merchantMemoryCount={merchantMemoryCount}
          accounts={accounts}
          recentTransactions={recentTransactions}
          syncingAccountId={syncingAccountId}
          onSyncAccount={handleSyncAccount}
          onSetView={setView}
          currency={currency}
          onAutoAddTransactions={onAutoAddTransactions}
          onNavigate={onNavigate}
          sharedWalletData={{
            groups: sharedWalletsHook.groups.map((g: SharedGroup) => ({
              id: g.id,
              name: g.name,
              emoji: '👥',
              memberCount: 0,
            })),
            pendingInvites: sharedWalletsHook.pendingInvites,
            acceptInvite: sharedWalletsHook.acceptInvite,
            declineInvite: sharedWalletsHook.declineInvite,
            createGroup: sharedWalletsHook.createGroup,
          }}
        />
      )}
      {view === 'select-source' && <SelectSource onSetView={setView} />}
      {view === 'upi-link' && (
        <UPILink onSetView={setView} onUPILinkSuccess={handleUPILinkSuccess} />
      )}
      {view === 'rzp-link' && (
        <RazorpayLink onSetView={setView} onConnect={handleRazorpayConnect} />
      )}
      {view === 'ondc-link' && (
        <ONDCConnectView onSetView={setView} onONDCLinkSuccess={handleONDCLinkSuccess} />
      )}
      {view === 'pay-form' && <PayForm onSetView={setView} onPay={handlePay} currency={currency} />}

      {view === 'pay-parsing' && (
        <div className="flex flex-col items-center justify-center py-32 animate-pulse">
          <Brain size={48} className="text-[var(--teal)] mb-4" />
          <p className="font-manrope font-bold text-xl">Local AI is parsing payment...</p>
        </div>
      )}
      {view === 'pay-success' && lastTx && (
        <div className="max-w-md mx-auto py-12 text-center animate-bounce-in">
          <CheckCircle2 size={64} className="text-[var(--green)] mx-auto mb-6" />
          <h2 className="text-3xl font-manrope font-extrabold mb-2">Payment Sent!</h2>
          <p className="text-lg text-[var(--text-muted)] mb-8">
            ₹{lastTx.amount.toFixed(0)} to {lastTx.merchant}
          </p>
          <div className="card p-6 mb-8 text-left">
            <div className="flex justify-between mb-4">
              <span className="text-sm text-[var(--text-muted)]">Detected Category</span>
              <span className="text-sm font-bold text-[var(--teal)]">{lastTx.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[var(--text-muted)]">Engine Confidence</span>
              <span className="text-sm font-bold flex items-center gap-1">
                <Sparkles size={14} className="text-purple-500" /> High
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setView('pay-correction')}
              className="flex-1 py-4 rounded-xl bg-[var(--surface-input)] text-[var(--text-primary)] font-bold border border-[var(--border)] cursor-pointer"
            >
              Fix Category
            </button>
            <button
              onClick={() => setView('dashboard')}
              className="flex-1 py-4 rounded-xl bg-[var(--teal)] text-white font-bold border-none cursor-pointer"
            >
              Dashboard
            </button>
          </div>
        </div>
      )}
      {view === 'pay-correction' && lastTx && (
        <div className="max-w-md mx-auto py-12 animate-scale-in">
          <h2 className="text-2xl font-manrope font-bold mb-6">Correct Category</h2>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCorrCat(cat)}
                className={`p-4 rounded-xl border font-inter font-bold text-sm transition-all cursor-pointer ${corrCategory === cat ? 'bg-[var(--teal)] text-white border-transparent' : 'bg-[var(--surface-card)] text-[var(--text-muted)] border-[var(--border)]'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            onClick={applyCorrection}
            className="w-full py-4 rounded-xl bg-[var(--teal)] text-white font-bold border-none cursor-pointer shadow-lg shadow-teal-500/20"
          >
            Save Correction
          </button>
        </div>
      )}

      <SyncingOverlay
        syncState={syncState}
        stagedTxs={stagedTxs}
        existingCount={existingCount}
        CATEGORIES={CATEGORIES}
        onClose={() => setSyncState('idle')}
        onConfirmImport={handleConfirmImport}
        onCategoryChange={handleCategoryChange}
      />
    </div>
  );
}

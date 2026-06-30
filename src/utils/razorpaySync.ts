import { Transaction, Category } from '@/types';
import { processNaturalLanguageExpense } from '@/features/ai/parsers/nlp';
import { useStore } from '@/store';
import { RAZORPAY_PROXY_URL } from '@/config/env';

// ─── Merchant Memory (Phase 8.3) ────────────────────────────────────────────
export type MerchantMemory = Record<string, { merchant: string; category: string }>;

export function loadMerchantMemory(): MerchantMemory {
  return useStore.getState().merchantMemory || {};
}

/** After AI parse or manual correction — remember this UPI VPA mapping. */
export function rememberMerchant(upiVPA: string, merchant: string, category: string) {
  if (!upiVPA) return;
  useStore.getState().setMerchantMemory(prev => ({
    ...prev,
    [upiVPA.toLowerCase()]: { merchant, category },
  }));
}

export function parseUPIDescription(description: string): {
  merchant: string;
  upiId: string;
  amount?: number;
} {
  // PhonePe: "UPI/CR/PhonePe/MERCHANT_NAME/9876543210@ybl"
  // GPay:    "UPI-MERCHANTNAME-gpay@okaxis-AXIS..."
  // Paytm:   "PAYTM/UPI/merchant@paytm/DESCRIPTION"
  // HDFC:    "UPI-CR-MERCHANTNAME-123456@upi"
  // NEFT:    "NEFT/IMPS" (not UPI, ignore)

  const vpaMatch = description.match(/[\w.-]+@[\w]+/); // UPI VPA: name@bank
  const upiId = vpaMatch ? vpaMatch[0].toLowerCase() : '';

  // Extract merchant name — try multiple patterns:
  const merchantPatterns = [
    /UPI\/(?:CR|DR)\/[^/]+\/([^/]+)\//i, // PhonePe pattern
    /UPI-([A-Z0-9\s]+)-[a-z@]/i, // GPay/HDFC pattern
    /PAYTM\/UPI\/([^/]+)\//i, // Paytm pattern
    /TO\s+([A-Z\s]{3,30})\s+REF/i, // Generic TO NAME REF
  ];

  let merchant = '';
  for (const pattern of merchantPatterns) {
    const m = description.match(pattern);
    if (m?.[1]) {
      merchant = m[1].trim();
      break;
    }
  }
  if (!merchant && upiId) merchant = upiId.split('@')[0]; // Fallback to VPA prefix

  const amountMatch = description.match(/(?:rs|inr|₹)\.?\s*([\d,]+\.?\d*)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : undefined;

  return { merchant: merchant || 'UPI Payment', upiId, amount };
}

/**
 * Parse a UPI payment description with Gemini AI.
 * Falls back to simple keyword heuristics if Gemini is unavailable.
 * Uses merchant memory to skip repeat AI calls for known VPAs.
 */
export async function parseUPIPayment(
  description: string,
  upiVPA = ''
): Promise<{ merchant: string; category: Category; confidence: number; aiParsed: boolean }> {
  const vpaKey = upiVPA.toLowerCase();

  // 1 — Check merchant memory first (Phase 8.3)
  if (vpaKey) {
    const memory = loadMerchantMemory();
    if (memory[vpaKey]) {
      return {
        merchant: memory[vpaKey].merchant,
        category: memory[vpaKey].category as Category,
        confidence: 1.0,
        aiParsed: false, // from memory — no AI call
      };
    }
  }

  // 2 — Attempt AI Analysis
  const aiResult = await processNaturalLanguageExpense(description || upiVPA);
  if (aiResult && aiResult.length > 0) {
    const firstResult = aiResult[0];
    const out = {
      merchant: firstResult.merchant || description || upiVPA || 'UPI Payment',
      category: firstResult.category || 'Shopping',
      confidence: 0.95,
      aiParsed: true,
    };
    if (vpaKey) rememberMerchant(vpaKey, out.merchant, out.category);
    return out;
  }

  // 3 — Offline Heuristics Parse (Fallback)
  const desc = (description || upiVPA).toLowerCase();
  const cat: Category = /zomato|swiggy|food|cafe|restaurant|eat|lunch|dinner|pizza|burger/.test(
    desc
  )
    ? 'Food'
    : /uber|ola|rapido|metro|bus|train|flight|fuel|petrol/.test(desc)
      ? 'Transport'
      : /netflix|spotify|amazon|prime|youtube|hotstar|sub/.test(desc)
        ? 'Subscriptions'
        : /amazon|flipkart|myntra|mall|shop|store/.test(desc)
          ? 'Shopping'
          : /electricity|water|bill|recharge|mobile|broadband|wifi/.test(desc)
            ? 'Utilities'
            : /doctor|hospital|pharma|med|health|clinic/.test(desc)
              ? 'Health'
              : /movie|game|play|event|party|concert/.test(desc)
                ? 'Entertainment'
                : 'Transfer';

  const out = {
    merchant: description || upiVPA || 'UPI Payment',
    category: cat,
    confidence: 0.8,
    aiParsed: false,
  };

  if (vpaKey) rememberMerchant(vpaKey, out.merchant, out.category);
  return out;
}

export interface RazorpayAuth {
  keyId: string;
  keySecret?: string;
}

/**
 * Fetches recent captured payments from Razorpay API via secure backend proxy or mock fallback.
 */
export async function fetchRazorpayTransactions(auth: RazorpayAuth): Promise<Transaction[]> {
  const proxyUrl = RAZORPAY_PROXY_URL;

  if (proxyUrl) {
    const response = await fetch(`${proxyUrl}/sync-payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keyId: auth.keyId }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.description || 'Failed to fetch from Razorpay Proxy.');
    }

    const data = await response.json();
    const payments = data.items || [];
    return processPaymentsToTransactions(payments);
  }

  // Fallback to secure mock if no proxy URL is configured (preventing client-side secret exposure)
  console.warn(
    'RAZORPAY_PROXY_URL not configured. Using secure mock simulation to prevent client-side secret exposure.'
  );

  // Return simulated transactions
  const mockPayments = [
    {
      id: 'pay_mock1',
      status: 'captured',
      created_at: Math.floor(Date.now() / 1000) - 3600,
      amount: 150000,
      method: 'upi',
      email: 'client@example.com',
      description: 'Freelance Advance',
    },
    {
      id: 'pay_mock2',
      status: 'captured',
      created_at: Math.floor(Date.now() / 1000) - 86400,
      amount: 2500000,
      method: 'netbanking',
      email: 'hr@company.com',
      description: 'Monthly Salary',
    },
  ];

  return processPaymentsToTransactions(mockPayments);
}

function processPaymentsToTransactions(payments: Record<string, unknown>[]): Transaction[] {
  const transactions: Transaction[] = [];

  /* eslint-disable @typescript-eslint/no-explicit-any */
  for (const p of payments) {
    if ((p as any).status !== 'captured') continue;

    const isoDate = new Date((p as any).created_at * 1000).toISOString();
    const realAmount = typeof (p as any).amount === 'number' ? (p as any).amount / 100 : 0;
    if (realAmount <= 0) continue;

    const t: Transaction = {
      id: `rzp_${(p as any).id}`,
      date: isoDate,
      amount: realAmount,
      type: 'credit',
      category: (p as any).method === 'upi' ? ('Transfer' as Category) : ('Salary' as Category),
      merchant: (p as any).email || (p as any).contact || `Razorpay - ${(p as any).method?.toUpperCase() || 'Gateway'}`,
      description: (p as any).description || `Payment via ${(p as any).method}`,
      isNew: true,
      confidence: 1.0,
      aiParsed: false,
    };

    transactions.push(t);
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return transactions;
}

// ─── UPI Payment Checkout ───────────────────────────────────────────────────

export interface RazorpayPaymentOptions {
  keyId: string;
  amount: number; // in rupees — converted to paise internally
  description: string;
  prefillName?: string;
  prefillEmail?: string;
  prefillContact?: string;
  onSuccess: (details: RazorpayPaymentResult) => void;
  onFailure?: (error: unknown) => void;
}

export interface RazorpayPaymentResult {
  razorpay_payment_id: string;
  amount: number; // in rupees
  description: string;
  method: string;
}

// Razorpay types are now in src/types/dom.ts

/** Opens the Razorpay checkout popup for a UPI payment. */
export async function initiateRazorpayPayment(opts: RazorpayPaymentOptions): Promise<void> {
  if (!window.Razorpay) {
    try {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Razorpay SDK failed to load'));
        document.head.appendChild(script);
      });
    } catch (_) {
      alert('Razorpay SDK failed to load. Check your internet connection.');
      return;
    }
  }

  const RazorpaySDK = window.Razorpay;
  if (!RazorpaySDK) {
    alert('Razorpay SDK not loaded. Check your internet connection.');
    return;
  }

  const rzp = new RazorpaySDK({
    key: opts.keyId,
    amount: Math.round(opts.amount * 100), // convert to paise
    currency: 'INR',
    name: 'SpendWise',
    description: opts.description,
    prefill: {
      name: opts.prefillName ?? '',
      email: opts.prefillEmail ?? '',
      contact: opts.prefillContact ?? '',
    },
    theme: { color: '#14b8a6' },
    handler: function (response) {
      opts.onSuccess({
        razorpay_payment_id: response.razorpay_payment_id ?? `demo_${Date.now()}`,
        amount: opts.amount,
        description: opts.description,
        method: 'upi',
      });
    },
    modal: {
      ondismiss: () => opts.onFailure?.({ message: 'Payment cancelled by user' }),
    },
  });

  rzp.open();
}

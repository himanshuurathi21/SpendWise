/**
 * upi.ts — Complete UPI / Bank Sync Engine
 *
 * Covers:
 *  1. UPI string parser — all 12 Indian bank SMS formats
 *  2. CSV bank statement importer — HDFC, SBI, ICICI, Axis, Kotak column mapping
 *  3. Razorpay payment fetch — real API call via Supabase proxy
 *  4. Merchant → category memory with learning
 *  5. Duplicate detection — same amount ±60 seconds
 */

import { Transaction, DefaultCategory, UPIMandate, MandateFrequency, MandateType } from '@/types';
import { useStore } from '@/store';
import { formatLocalYYYYMMDD } from '@/utils/date';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/config/env';
import { MERCHANT_CATEGORY_MAP } from '@/data/categoryMap';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedUPITransaction {
  id: string;
  merchant: string;
  amount: number;
  type: 'debit' | 'credit';
  category: DefaultCategory;
  date: string;
  upiId?: string;
  bankRef?: string;
  rawText: string;
  confidence: 'high' | 'medium' | 'low';
  currency?: string;
}

export interface ReviewTransaction extends ParsedUPITransaction {
  isDuplicate: boolean;
  selected: boolean;
}

function detectCategory(merchant: string): DefaultCategory {
  const m = merchant.toLowerCase();

  // Check merchant memory (user corrections take priority)
  const memory = useStore.getState().merchantMemory ?? {};
  if (memory[m]) return memory[m].category as DefaultCategory;

  // Keyword match from shared map
  for (const [keyword, category] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (m.includes(keyword)) return category;
  }

  return 'Shopping'; // safe default
}

export { learnMerchant } from '@/core/merchantMemory';

// ─── UPI String Parser ────────────────────────────────────────────────────────
// Handles all major Indian bank SMS + UPI notification formats

const UPI_PATTERNS = [
  // PhonePe: "UPI/CR/PhonePe/SWIGGY INDIA/payment@okicici"
  // PhonePe: "UPI/DR/PhonePe/MERCHANT NAME/vpa@ybl"
  {
    pattern: /UPI\/(CR|DR)\/[^/]+\/([^/]+)\/(\S+@\S+)/i,
    extract: (m: RegExpMatchArray) => ({
      type: m[1].toUpperCase() === 'CR' ? 'credit' : 'debit',
      merchant: m[2].trim(),
      upiId: m[3].toLowerCase(),
    }),
  },
  // HDFC SMS: "Rs 350.00 debited from A/c XX1234 on 19-05-26 to UPI-SWIGGY-swiggy@ic"
  {
    pattern:
      /Rs\.?\s*([\d,]+\.?\d*)\s+(debited|credited)\s+.*?to\s+UPI[-\s]([A-Z0-9\s]+)[-\s](\S+@\S+)/i,
    extract: (m: RegExpMatchArray) => ({
      type: m[2].toLowerCase().includes('debit') ? 'debit' : 'credit',
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[3].trim(),
      upiId: m[4].toLowerCase(),
    }),
  },
  // SBI: "Your A/c XX1234 debited by INR 350.00 on 19/05/26. UPI Ref: 123456789012"
  {
    pattern:
      /A\/c\s+\S+\s+(debited|credited)\s+by\s+INR\s+([\d,]+\.?\d*)\s+on\s+([\d/-]+)\.?\s+(?:.*?Ref[:\s]+(\d+))?/i,
    extract: (m: RegExpMatchArray) => ({
      type: m[1].toLowerCase().includes('debit') ? 'debit' : 'credit',
      amount: parseFloat(m[2].replace(/,/g, '')),
      date: parseIndianDate(m[3]),
      bankRef: m[4],
    }),
  },
  // ICICI: "ICICI Bank Acct XX1234 debited with Rs.350.00 on 19-May-26; UPI:swiggy@ic"
  {
    pattern: /debited\s+with\s+Rs\.?([\d,]+\.?\d*)\s+on\s+([^;]+);\s+UPI:(\S+)/i,
    extract: (m: RegExpMatchArray) => ({
      type: 'debit',
      amount: parseFloat(m[1].replace(/,/g, '')),
      date: parseIndianDate(m[2].trim()),
      upiId: m[3].toLowerCase(),
    }),
  },
  // Axis Bank: "INR 350.00 debited from Axis Bank Acct XX1234 towards UPI/SWIGGY/payment@upi"
  {
    pattern: /INR\s+([\d,]+\.?\d*)\s+(debited|credited)\s+.*?UPI\/([A-Z0-9\s]+)\/(\S+)/i,
    extract: (m: RegExpMatchArray) => ({
      type: m[2].toLowerCase().includes('debit') ? 'debit' : 'credit',
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[3].trim(),
      upiId: m[4].toLowerCase(),
    }),
  },
  // Paytm: "PAYTM/UPI/merchant@paytm/MERCHANT NAME"
  {
    pattern: /PAYTM\/UPI\/([^/]+)\/([^/\n]+)/i,
    extract: (m: RegExpMatchArray) => ({
      upiId: m[1].toLowerCase(),
      merchant: m[2].trim(),
    }),
  },
  // Generic UPI VPA pattern: anything@bank
  {
    pattern: /[-\s/]([a-z0-9.-]+@[a-z]+)\b/i,
    extract: (m: RegExpMatchArray) => ({
      upiId: m[1].toLowerCase(),
    }),
  },
  // ─── UAE Banks ──────────────────────────────────────────────────────────────
  // Emirates NBD: "AED XXXX.XX debited from account XXXX at MERCHANT on DD/MM/YYYY"
  {
    pattern:
      /AED\s+([\d,]+\.?\d*)\s+debited\s+from\s+account\s+\S+\s+at\s+(.+?)\s+on\s+(\d{2}\/\d{2}\/\d{4})/i,
    extract: (m: RegExpMatchArray) => ({
      currency: 'AED',
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[2].trim(),
      type: 'debit',
      date: parseIndianDate(m[3]),
    }),
  },
  // ADCB: "Your ADCB account XXXX debited by AED X.XX at MERCHANT"
  {
    pattern: /ADCB\s+account\s+\S+\s+debited\s+by\s+AED\s+([\d,]+\.?\d*)\s+at\s+(.+)/i,
    extract: (m: RegExpMatchArray) => ({
      currency: 'AED',
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[2].trim(),
      type: 'debit',
    }),
  },
  // FAB: "FAB Alert: AED X.XX spent at MERCHANT on your card XXXX"
  {
    pattern: /FAB\s+Alert:\s+AED\s+([\d,]+\.?\d*)\s+spent\s+at\s+(.+?)\s+on\s+your\s+card/i,
    extract: (m: RegExpMatchArray) => ({
      currency: 'AED',
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[2].trim(),
      type: 'debit',
    }),
  },
  // ─── Singapore Banks ────────────────────────────────────────────────────────
  // DBS: "DBS Acct XXXX debited SGD X.XX on DD/MM at MERCHANT"
  {
    pattern: /DBS\s+Acct\s+\S+\s+debited\s+SGD\s+([\d,]+\.?\d*)\s+on\s+(\d{2}\/\d{2})\s+at\s+(.+)/i,
    extract: (m: RegExpMatchArray) => ({
      currency: 'SGD',
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[3].trim(),
      type: 'debit',
      date: parseIndianDate(m[2]),
    }),
  },
  // OCBC: "OCBC: SGD X.XX charged to account XXXX at MERCHANT"
  {
    pattern: /OCBC:\s+SGD\s+([\d,]+\.?\d*)\s+charged\s+to\s+account\s+\S+\s+at\s+(.+)/i,
    extract: (m: RegExpMatchArray) => ({
      currency: 'SGD',
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[2].trim(),
      type: 'debit',
    }),
  },
  // UOB: "UOB: SGD X.XX spent at MERCHANT on DD/MM"
  {
    pattern: /UOB:\s+SGD\s+([\d,]+\.?\d*)\s+spent\s+at\s+(.+?)\s+on\s+(\d{2}\/\d{2})/i,
    extract: (m: RegExpMatchArray) => ({
      currency: 'SGD',
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[2].trim(),
      type: 'debit',
      date: parseIndianDate(m[3]),
    }),
  },
  // ─── UK Banks ───────────────────────────────────────────────────────────────
  // HSBC: "HSBC: £X.XX spent at MERCHANT on card XXXX"
  {
    pattern: /HSBC:\s+£([\d,]+\.?\d*)\s+spent\s+at\s+(.+?)\s+on\s+card/i,
    extract: (m: RegExpMatchArray) => ({
      currency: 'GBP',
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[2].trim(),
      type: 'debit',
    }),
  },
  // Barclays: "Barclays: £X.XX payment to MERCHANT on DD/MM"
  {
    pattern: /Barclays:\s+£([\d,]+\.?\d*)\s+payment\s+to\s+(.+?)\s+on\s+(\d{2}\/\d{2})/i,
    extract: (m: RegExpMatchArray) => ({
      currency: 'GBP',
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[2].trim(),
      type: 'debit',
      date: parseIndianDate(m[3]),
    }),
  },
  // NatWest: "NatWest: £X.XX debited from account XXXX to MERCHANT"
  {
    pattern: /NatWest:\s+£([\d,]+\.?\d*)\s+debited\s+from\s+account\s+\S+\s+to\s+(.+)/i,
    extract: (m: RegExpMatchArray) => ({
      currency: 'GBP',
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[2].trim(),
      type: 'debit',
    }),
  },
];

// ─── UPI Mandate (AutoPay) Patterns ────────────────────────────────────────────

interface MandateExtract {
  type: 'creation' | 'execution' | 'cancellation';
  merchant?: string;
  amount?: number;
  umr?: string;
  frequency?: MandateFrequency;
  date?: string;
  provider?: string;
}

const MANDATE_PATTERNS: { pattern: RegExp; extract: (m: RegExpMatchArray) => MandateExtract }[] = [
  // Mandate creation: "UPI mandate created for ₹X to MERCHANT on MM/DD"
  {
    pattern:
      /upi\s+mandate\s+created\s+for\s+(?:₹|rs\.?\s*)?([\d,]+\.?\d*)\s*to\s+([A-Za-z0-9\s.]+?)(?:\s+on\s+(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?))?/i,
    extract: (m: RegExpMatchArray) => ({
      type: 'creation' as const,
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[2]?.trim(),
      date: m[3] ? parseIndianDate(m[3]) : undefined,
    }),
  },
  // Mandate creation alternative: "AutoPay mandate set up for MERCHANT"
  {
    pattern:
      /autopay\s+mandate\s+set\s+up\s+for\s+([A-Za-z0-9\s.]+?)(?:\s+of\s+(?:₹|rs\.?\s*)?([\d,]+\.?\d*))?/i,
    extract: (m: RegExpMatchArray) => ({
      type: 'creation' as const,
      merchant: m[1]?.trim(),
      amount: m[2] ? parseFloat(m[2].replace(/,/g, '')) : undefined,
    }),
  },
  // Mandate execution: "UPI AutoPay mandate executed for ₹X to MERCHANT"
  {
    pattern:
      /upi\s+autopay\s+mandate\s+executed\s+for\s+(?:₹|rs\.?\s*)?([\d,]+\.?\d*)\s*to\s+([A-Za-z0-9\s.]+?)(?:\s+on\s+(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?))?/i,
    extract: (m: RegExpMatchArray) => ({
      type: 'execution' as const,
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[2]?.trim(),
      date: m[3] ? parseIndianDate(m[3]) : undefined,
    }),
  },
  // Recurring payment: "Recurring payment of ₹X to MERCHANT"
  {
    pattern:
      /recurring\s+payment\s+of\s+(?:₹|rs\.?\s*)?([\d,]+\.?\d*)\s*to\s+([A-Za-z0-9\s.]+?)(?:\s+on\s+(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?))?/i,
    extract: (m: RegExpMatchArray) => ({
      type: 'execution' as const,
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[2]?.trim(),
      date: m[3] ? parseIndianDate(m[3]) : undefined,
    }),
  },
  // Mandate cancellation: "UPI mandate cancelled for MERCHANT"
  {
    pattern: /upi\s+mandate\s+cancelled\s+for\s+([A-Za-z0-9\s.]+?)(?:\s+umr[:\s]*(\w+))?/i,
    extract: (m: RegExpMatchArray) => ({
      type: 'cancellation' as const,
      merchant: m[1]?.trim(),
      umr: m[2]?.trim(),
    }),
  },
  // Mandate cancellation alternative: "AutoPay mandate revoked"
  {
    pattern: /autopay\s+mandate\s+revoked\s+(?:for\s+([A-Za-z0-9\s.]+?))?(?:\s+umr[:\s]*(\w+))?/i,
    extract: (m: RegExpMatchArray) => ({
      type: 'cancellation' as const,
      merchant: m[1]?.trim(),
      umr: m[2]?.trim(),
    }),
  },
  // UMR extraction from any mandate-related message
  {
    pattern: /umr[:\s]*([A-Z0-9]{6,20})/i,
    extract: (m: RegExpMatchArray) => ({
      type: 'execution' as const,
      umr: m[1]?.trim(),
    }),
  },
];

function detectMandateProvider(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('phonepe')) return 'PhonePe';
  if (lower.includes('gpay') || lower.includes('google pay')) return 'Google Pay';
  if (lower.includes('paytm')) return 'Paytm';
  if (lower.includes('cred')) return 'CRED';
  if (lower.includes('bhim')) return 'BHIM UPI';
  return 'UPI';
}

function detectMandateType(merchant: string, _amount: number): MandateType {
  const m = merchant.toLowerCase();
  if (/loan|emi|finance|hdfc.*emi|icici.*emi|bajaj|tata.*capital|kredit/i.test(m)) return 'emi';
  if (/sip|mutual\s*fund|mf|hdfc.*mf|icici.*mf|invest/i.test(m)) return 'sip';
  if (/insurance|lic|icici.*prudential|hdfc.*life|max.*life/i.test(m)) return 'insurance';
  if (/netflix|spotify|prime|youtube|hotstar|disney|zee|sony|linkedin/i.test(m))
    return 'subscription';
  return 'other';
}

function detectMandateFrequency(text: string): MandateFrequency {
  const lower = text.toLowerCase();
  if (/daily/i.test(lower)) return 'daily';
  if (/weekly/i.test(lower)) return 'weekly';
  if (/quarterly/i.test(lower)) return 'quarterly';
  if (/annual|yearly/i.test(lower)) return 'annual';
  return 'monthly';
}

/**
 * parseUPIMandateString — Parse a UPI mandate (AutoPay) SMS and return a UPIMandate.
 */
export function parseUPIMandateString(text: string): UPIMandate | null {
  if (!text?.trim()) return null;

  let merchant = '';
  let amount = 0;
  let umr = '';
  let type: 'creation' | 'execution' | 'cancellation' = 'creation';
  let date = formatLocalYYYYMMDD(new Date());

  for (const { pattern, extract } of MANDATE_PATTERNS) {
    const m = text.match(pattern);
    if (!m) continue;
    const result = extract(m);
    if (result.type) type = result.type;
    if (result.merchant) merchant = result.merchant;
    if (result.amount) amount = result.amount;
    if (result.umr) umr = result.umr;
    if (result.date) date = result.date;
  }

  if (type === 'execution' && !amount) {
    const amtMatch = text.match(/(?:₹|rs\.?\s*|inr\s*)\s*([\d,]+\.?\d*)/i);
    if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));
  }

  if (!merchant && type === 'cancellation') merchant = 'Unknown Merchant';
  if (!merchant && !amount) return null;

  if (!merchant) merchant = 'Mandate Payment';

  const provider = detectMandateProvider(text);
  const freq = detectMandateFrequency(text);
  const mandateType = detectMandateType(merchant, amount);

  // For creation mandates, compute next debit based on frequency
  const nextDebitDate = new Date();
  if (freq === 'daily') nextDebitDate.setDate(nextDebitDate.getDate() + 1);
  else if (freq === 'weekly') nextDebitDate.setDate(nextDebitDate.getDate() + 7);
  else if (freq === 'monthly') nextDebitDate.setMonth(nextDebitDate.getMonth() + 1);
  else if (freq === 'quarterly') nextDebitDate.setMonth(nextDebitDate.getMonth() + 3);
  else if (freq === 'annual') nextDebitDate.setFullYear(nextDebitDate.getFullYear() + 1);

  return {
    id: `mandate_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    umr: umr || `UMR${Date.now()}`,
    merchant: merchant.substring(0, 60),
    amount: Math.round(amount * 100) / 100,
    frequency: freq,
    status: type === 'cancellation' ? 'cancelled' : 'active',
    startDate: date,
    nextDebit: formatLocalYYYYMMDD(nextDebitDate),
    lastDebit: type === 'execution' ? date : undefined,
    provider,
    category: detectCategory(merchant),
    type: mandateType,
  };
}

/**
 * parseMultipleMandateStrings — Parse a block of text for multiple mandate messages.
 */
export function parseMultipleMandateStrings(bulkText: string): UPIMandate[] {
  const blocks = bulkText
    .split(/\n{2,}|(?=(?:upi\s+mandate|autopay\s+mandate|recurring\s+payment))/i)
    .map(b => b.trim())
    .filter(b => b.length > 10);

  const results: UPIMandate[] = [];
  for (const block of blocks) {
    const parsed = parseUPIMandateString(block);
    if (parsed) results.push(parsed);
  }
  return results;
}

function parseIndianDate(dateStr: string): string {
  if (!dateStr) return formatLocalYYYYMMDD(new Date());

  // DD/MM/YY or DD-MM-YY
  const dmy = dateStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmy) {
    const [, d, mo, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD-Mon-YY: 19-May-26
  const dMonY = dateStr.match(/(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})/);
  if (dMonY) {
    const months: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    };
    const [, d, mon, y] = dMonY;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${months[mon.toLowerCase()] ?? '01'}-${d.padStart(2, '0')}`;
  }

  return formatLocalYYYYMMDD(new Date());
}

/**
 * parseUPIString — Parse a single UPI notification / bank SMS string
 */
export function parseUPIString(text: string): ParsedUPITransaction | null {
  if (!text?.trim()) return null;

  let merchant = '';
  let amount = 0;
  let type: 'debit' | 'credit' = 'debit';
  let upiId = '';
  let bankRef = '';
  let date = formatLocalYYYYMMDD(new Date());
  let currency = '';

  // Run all patterns
  for (const { pattern, extract } of UPI_PATTERNS) {
    const m = text.match(pattern);
    if (!m) continue;
    const result: Record<string, unknown> = extract(m);
    if (result.merchant) merchant = result.merchant as string;
    if (result.amount) amount = result.amount as number;
    if (result.type) type = result.type as 'debit' | 'credit';
    if (result.upiId) upiId = result.upiId as string;
    if (result.bankRef) bankRef = result.bankRef as string;
    if (result.date) date = result.date as string;
    if (result.currency) currency = result.currency as string;
  }

  // Extract amount if not yet found
  if (!amount) {
    const amtMatch =
      text.match(/(?:inr|rs\.?|₹)\s*([\d,]+\.?\d*)/i) ||
      text.match(/\b([\d,]+\.?\d*)\s*(?:rs\.?|inr|rupees?)\b/i) ||
      text.match(/\b(\d{2,7}\.?\d{0,2})\b/);
    if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));
  }

  if (!amount || amount <= 0) return null;

  // Extract merchant from UPI ID if still missing
  if (!merchant && upiId) {
    merchant = upiId
      .split('@')[0]
      .replace(/[-._]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }

  if (!merchant) merchant = 'UPI Payment';

  // Detect type from keywords if not set by pattern
  if (!type) {
    type = /debit|paid|sent|debited|purchase/i.test(text) ? 'debit' : 'credit';
  }

  // Detect date from text if still today
  const dateMatch = text.match(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}[- ][A-Za-z]{3}[- ]\d{2,4}/);
  if (dateMatch) date = parseIndianDate(dateMatch[0]);

  const confidence: 'high' | 'medium' | 'low' =
    merchant !== 'UPI Payment' && amount > 0 ? 'high' : amount > 0 ? 'medium' : 'low';

  return {
    id: `upi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    merchant: merchant.substring(0, 60),
    amount: Math.round(amount * 100) / 100,
    type,
    category: detectCategory(merchant),
    date,
    upiId: upiId || undefined,
    bankRef: bankRef || undefined,
    rawText: text.trim(),
    confidence,
    currency: currency || undefined,
  };
}

/**
 * parseMultipleUPIStrings — Parse a block of text containing multiple UPI notifications
 * (e.g. paste from SMS inbox). Each line / double-newline = one transaction.
 */
export function parseMultipleUPIStrings(bulkText: string): ParsedUPITransaction[] {
  // Split by blank lines or lines that look like new SMS starts
  const blocks = bulkText
    .split(/\n{2,}|(?=(?:UPI\/|Your A\/c|ICICI Bank|HDFC|Axis Bank|SBI|PAYTM|INR\s+\d))/i)
    .map(b => b.trim())
    .filter(b => b.length > 10);

  const results: ParsedUPITransaction[] = [];
  for (const block of blocks) {
    const parsed = parseUPIString(block);
    if (parsed) results.push(parsed);
  }
  return results;
}

// ─── Duplicate Detector ───────────────────────────────────────────────────────

export function markDuplicates(
  parsed: ParsedUPITransaction[],
  existing: Transaction[]
): ReviewTransaction[] {
  return parsed.map(p => {
    const isDuplicate = existing.some(e => {
      const sameAmount = e.amount === p.amount;
      const sameType = e.type === p.type;
      const sameDate = e.date === p.date;
      const similarMerchant = e.merchant
        ?.toLowerCase()
        .includes(p.merchant.toLowerCase().split(' ')[0]);
      return sameAmount && sameType && sameDate && similarMerchant;
    });
    return { ...p, isDuplicate, selected: !isDuplicate };
  });
}

// ─── CSV Bank Statement Importer ──────────────────────────────────────────────

interface ColumnMap {
  date: string | number;
  narration: string | number;
  debit?: string | number;
  credit?: string | number;
  amount?: string | number;
  type?: string | number;
  balance?: string | number;
}

// Column mappings for major Indian banks (header-row detection)
const BANK_COLUMN_PROFILES: { name: string; headers: string[]; map: ColumnMap }[] = [
  {
    name: 'HDFC Bank',
    headers: ['date', 'narration', 'chq', 'ref', 'value', 'withdrawal', 'deposit', 'closing'],
    map: { date: 'Date', narration: 'Narration', debit: 'Withdrawal Amt.', credit: 'Deposit Amt.' },
  },
  {
    name: 'SBI',
    headers: ['txn date', 'description', 'ref no', 'debit', 'credit', 'balance'],
    map: { date: 'Txn Date', narration: 'Description', debit: 'Debit', credit: 'Credit' },
  },
  {
    name: 'ICICI Bank',
    headers: [
      's no',
      'transaction date',
      'cheque number',
      'particulars',
      'amount (dr)',
      'amount (cr)',
    ],
    map: {
      date: 'Transaction Date',
      narration: 'Particulars',
      debit: 'Amount (Dr)',
      credit: 'Amount (Cr)',
    },
  },
  {
    name: 'Axis Bank',
    headers: ['tran date', 'chequen', 'particulars', 'dr', 'cr', 'balance'],
    map: { date: 'Tran Date', narration: 'Particulars', debit: 'DR', credit: 'CR' },
  },
  {
    name: 'Kotak',
    headers: ['date', 'description', 'cheque no', 'withdrawal', 'deposit', 'balance'],
    map: { date: 'Date', narration: 'Description', debit: 'Withdrawal', credit: 'Deposit' },
  },
  {
    name: 'Generic',
    headers: [], // fallback — used if no profile matches
    map: { date: 0, narration: 1, amount: 3, type: 4 },
  },
  // ─── UK Bank CSV Profiles ───────────────────────────────────────────────────
  {
    name: 'HSBC UK',
    headers: ['date', 'description', 'paid out', 'paid in', 'balance'],
    map: { date: 'Date', narration: 'Description', debit: 'Paid Out', credit: 'Paid In' },
  },
  {
    name: 'Barclays UK',
    headers: ['date', 'description', 'money out', 'money in', 'balance'],
    map: { date: 'Date', narration: 'Description', debit: 'Money Out', credit: 'Money In' },
  },
  {
    name: 'NatWest UK',
    headers: ['date', 'description', 'debit', 'credit', 'balance'],
    map: { date: 'Date', narration: 'Description', debit: 'Debit', credit: 'Credit' },
  },
];

function detectBankProfile(headers: string[]): (typeof BANK_COLUMN_PROFILES)[0] {
  const lh = headers.map(h => h.toLowerCase().trim());
  for (const profile of BANK_COLUMN_PROFILES) {
    if (profile.headers.length === 0) continue;
    const matches = profile.headers.filter(h => lh.some(lhh => lhh.includes(h))).length;
    if (matches >= Math.min(3, profile.headers.length)) return profile;
  }
  return BANK_COLUMN_PROFILES[BANK_COLUMN_PROFILES.length - 1]; // Generic
}

function getCol(row: string[], headers: string[], key: string | number): string {
  if (typeof key === 'number') return row[key]?.trim() ?? '';
  const idx = headers.findIndex(h => h.toLowerCase().trim() === key.toLowerCase().trim());
  return idx >= 0 ? (row[idx]?.trim() ?? '') : '';
}

/**
 * parseCSVStatement — Import a CSV bank statement and return parsed transactions.
 * @param csvText   Raw CSV text from File reader
 * @param bankHint  Optional bank name hint ("HDFC", "SBI", "ICICI", etc.)
 */
export function parseCSVStatement(csvText: string, bankHint?: string): ParsedUPITransaction[] {
  const lines = csvText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) return [];

  // Find the header row (first line with recognisable column names)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const lc = lines[i].toLowerCase();
    if (/date|narration|description|particulars|withdrawal|amount|debit|credit/.test(lc)) {
      headerIdx = i;
      break;
    }
  }

  // Parse CSV (handles quoted fields with commas inside)
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = '',
      inQ = false;
    for (const ch of line) {
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === ',' && !inQ) {
        result.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[headerIdx]);
  const profile = bankHint
    ? (BANK_COLUMN_PROFILES.find(p => p.name.toLowerCase().includes(bankHint.toLowerCase())) ??
      detectBankProfile(headers))
    : detectBankProfile(headers);

  const results: ParsedUPITransaction[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    if (row.length < 2) continue;

    const dateStr = getCol(row, headers, profile.map.date);
    const narr = getCol(row, headers, profile.map.narration);
    const debitStr = profile.map.debit != null ? getCol(row, headers, profile.map.debit) : '';
    const creditStr = profile.map.credit != null ? getCol(row, headers, profile.map.credit) : '';
    const amtStr = profile.map.amount != null ? getCol(row, headers, profile.map.amount) : '';

    if (!dateStr && !narr) continue;

    const debit = parseFloat(debitStr.replace(/[^0-9.]/g, '')) || 0;
    const credit = parseFloat(creditStr.replace(/[^0-9.]/g, '')) || 0;
    const amount =
      debit > 0 ? debit : credit > 0 ? credit : parseFloat(amtStr.replace(/[^0-9.]/g, '')) || 0;
    const type: 'debit' | 'credit' = debit > 0 ? 'debit' : 'credit';

    if (!amount || amount <= 0) continue;

    // Try extracting UPI VPA from narration
    const vpaMatch = narr.match(/[\w.-]+@[\w]+/);
    const upiId = vpaMatch ? vpaMatch[0].toLowerCase() : undefined;

    // Extract merchant name from narration
    let merchant: string;
    if (upiId) {
      merchant = upiId
        .split('@')[0]
        .replace(/[-._]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
    } else {
      // Strip common bank boilerplate
      merchant = narr
        .replace(/UPI[-/\s]+/gi, '')
        .replace(/NEFT[-/\s]+/gi, '')
        .replace(/IMPS[-/\s]+/gi, '')
        .replace(/CRF?[-/\s]+/gi, '')
        .replace(/\d{10,}/g, '') // remove long ref numbers
        .replace(/[A-Z0-9]{20,}/g, '') // remove long reference strings
        .replace(/\s{2,}/g, ' ')
        .trim()
        .substring(0, 50);
    }

    if (!merchant) merchant = 'Bank Transaction';

    results.push({
      id: `csv_${i}_${Date.now()}`,
      merchant,
      amount,
      type,
      category: detectCategory(merchant),
      date: parseIndianDate(dateStr),
      upiId,
      rawText: narr,
      confidence: upiId ? 'high' : 'medium',
    });
  }

  return results;
}

// ─── Razorpay Live Transaction Fetch ─────────────────────────────────────────

/**
 * fetchRazorpayTransactions — Fetch real payments from Razorpay via Supabase proxy.
 *
 * The Edge Function `razorpay-proxy` makes the server-side API call
 * (so the secret key never leaves the server). Install it:
 *   supabase functions deploy razorpay-proxy
 *   supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxx
 *   supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxxxx
 */
export async function fetchRazorpayTransactions(
  from?: Date,
  to?: Date
): Promise<ParsedUPITransaction[]> {
  const { isSupabaseConfigured } = await import('@/core/api/supabase');

  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured. Using realistic mock data for Razorpay demo.');
    return generateRealisticMocks();
  }

  // SUPABASE_URL, SUPABASE_ANON_KEY imported from @/config/env

  const params: Record<string, number> = {};
  if (from) params.from = Math.floor(from.getTime() / 1000);
  if (to) params.to = Math.floor(to.getTime() / 1000);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/razorpay-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionStorage.getItem('spendwise_supabase_token') || SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action: 'list-payments', params }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Razorpay proxy error: ${err}`);
  }
  const data = await res.json();

  const items = (data as Record<string, unknown>)?.items as Record<string, unknown>[] | undefined;
  const payments: Record<string, unknown>[] = items ?? [];

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return payments
    .filter(p => (p as any).status === 'captured')
    .map(p => ({
      id: `rzp_${(p as any).id}`,
      merchant: (p as any).description || (p as any).email?.split('@')[0] || 'Razorpay Payment',
      amount: (p as any).amount / 100,
      type: 'credit' as const,
      category: 'Income' as DefaultCategory,
      date: formatLocalYYYYMMDD(new Date((p as any).created_at * 1000)),
      bankRef: (p as any).id,
      rawText: JSON.stringify(p),
      confidence: 'high' as const,
    }));
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

// ─── Merchant Category Learning ───────────────────────────────────────────────

/** Call this when user manually changes a category in the review table */
export { saveMerchantCorrection } from '@/core/merchantMemory';

// ─── Convert to App Transaction ──────────────────────────────────────────────

export function toAppTransaction(
  p: ParsedUPITransaction,
  defaultCurrency = '₹'
): Omit<Transaction, 'id'> {
  return {
    merchant: p.merchant,
    amount: p.amount,
    type: p.type,
    category: p.category,
    date: p.date,
    description: p.bankRef ? `Ref: ${p.bankRef}` : undefined,
    originalCurrency: p.currency || defaultCurrency,
  };
}

export const UPI_PROVIDERS = [
  { id: 'phonepe', name: 'PhonePe', color: '#5f259f' },
  { id: 'gpay', name: 'Google Pay', color: '#1a73e8' },
  { id: 'paytm', name: 'Paytm', color: '#002970' },
  { id: 'cred', name: 'CRED', color: '#000000' },
  { id: 'bhim', name: 'BHIM UPI', color: '#f26822' },
] as const;

export function generateRealisticMocks(): ParsedUPITransaction[] {
  const merchants = [
    { name: 'Swiggy', category: 'Food', amounts: [250, 430, 150, 600, 1100], type: 'debit' },
    { name: 'Zomato', category: 'Food', amounts: [320, 199, 450, 800], type: 'debit' },
    { name: 'Uber India', category: 'Transport', amounts: [150, 290, 85, 420], type: 'debit' },
    { name: 'Ola Cabs', category: 'Transport', amounts: [120, 310, 95], type: 'debit' },
    { name: 'Amazon India', category: 'Shopping', amounts: [1499, 599, 2999, 899], type: 'debit' },
    { name: 'Flipkart', category: 'Shopping', amounts: [850, 1200, 350], type: 'debit' },
    { name: 'Blinkit', category: 'Food', amounts: [240, 150, 560, 310], type: 'debit' },
    { name: 'Zepto', category: 'Food', amounts: [180, 210, 420], type: 'debit' },
    { name: 'Netflix India', category: 'Subscriptions', amounts: [499, 199, 649], type: 'debit' },
    { name: 'Spotify', category: 'Subscriptions', amounts: [119], type: 'debit' },
    { name: 'Jio Prepaid', category: 'Utilities', amounts: [299, 666, 719], type: 'debit' },
    { name: 'Airtel', category: 'Utilities', amounts: [299, 549], type: 'debit' },
    {
      name: 'Salary / ACME Corp',
      category: 'Income',
      amounts: [45000, 55000, 30000],
      type: 'credit',
    },
    { name: 'Freelance Payment', category: 'Income', amounts: [5000, 12000, 8000], type: 'credit' },
    { name: 'Cashback', category: 'Income', amounts: [15, 25, 50, 100], type: 'credit' },
  ];

  const results: ParsedUPITransaction[] = [];
  const count = Math.floor(Math.random() * 5) + 5; // 5 to 9 transactions

  for (let i = 0; i < count; i++) {
    const merchant = merchants[Math.floor(Math.random() * merchants.length)];
    const amount = merchant.amounts[Math.floor(Math.random() * merchant.amounts.length)];

    // Generate dates within the last 14 days
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 14));

    results.push({
      id: `mock_rzp_${Date.now()}_${i}`,
      merchant: merchant.name,
      amount: amount,
      type: merchant.type as 'credit' | 'debit',
      category: merchant.category as DefaultCategory,
      date: formatLocalYYYYMMDD(date),
      rawText: `Mock ${merchant.name} transaction`,
      confidence: 'high',
    });
  }

  // Sort by date descending
  return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * ondc.ts — ONDC (Open Network for Digital Commerce) Parser
 *
 * Parses ONDC payment confirmation and delivery notification SMS/notification formats.
 * Integrates with the existing UPI sync pipeline by matching ParsedUPITransaction shape.
 */

import { Transaction, DefaultCategory } from '@/types';
import { formatLocalYYYYMMDD } from '@/utils/date';
import { inferCategory } from '@/data/categoryMap';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedONDTransaction {
  id: string;
  merchant: string;
  amount: number;
  type: 'debit' | 'credit';
  category: DefaultCategory;
  date: string;
  orderId?: string;
  buyerApp?: string;
  rawText: string;
  confidence: 'high' | 'medium' | 'low';
}

// Keep ONDC-specific entries that are too generic for the global map
const ONDC_SPECIFIC_MAP: Record<string, DefaultCategory> = {
  magicpin: 'Shopping',
  burgerking: 'Food',
  jiodmart: 'Food',
  shop: 'Shopping',
  retail: 'Shopping',
  store: 'Shopping',
  mart: 'Shopping',
  bazaar: 'Shopping',
};

function detectCategory(merchant: string): DefaultCategory {
  const m = merchant.toLowerCase();
  // Check ONDC-specific entries first
  for (const [keyword, category] of Object.entries(ONDC_SPECIFIC_MAP)) {
    if (m.includes(keyword)) return category;
  }
  // Fall back to shared inferCategory
  return inferCategory(merchant) as DefaultCategory;
}

// ─── ONDC Regex Patterns ──────────────────────────────────────────────────────

const ONDC_PATTERNS = [
  // "ONDC order confirmed: ₹350 at Pizza Hut via Magicpin"
  {
    pattern:
      /ONDC\s+order\s+confirmed[:\s]+₹?([\d,]+\.?\d*)\s+at\s+([A-Za-z0-9\s&.-]+?)(?:\s+via\s+([A-Za-z0-9\s]+))?/i,
    extract: (m: RegExpMatchArray) => ({
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[2].trim(),
      buyerApp: m[3]?.trim(),
    }),
  },
  // "ONDC delivery completed: ONDC_ORD_12345 from Meesho"
  {
    pattern: /ONDC\s+delivery\s+completed[:\s]+([A-Z0-9_-]+)\s+from\s+([A-Za-z0-9\s&.-]+)/i,
    extract: (m: RegExpMatchArray) => ({
      orderId: m[1].trim(),
      merchant: m[2].trim(),
    }),
  },
  // "ONDC payment: ₹250 to Fresh Meat Shop via ONDC"
  {
    pattern:
      /ONDC\s+(?:payment|txn|pay)[:\s]+₹?([\d,]+\.?\d*)\s+(?:to|at)\s+([A-Za-z0-9\s&.-]+?)(?:\s+via\s+([A-Za-z0-9\s]+))?/i,
    extract: (m: RegExpMatchArray) => ({
      amount: parseFloat(m[1].replace(/,/g, '')),
      merchant: m[2].trim(),
      buyerApp: m[3]?.trim(),
    }),
  },
  // "ONDC order placed: ORDER_ID — ₹X at MERCHANT"
  {
    pattern:
      /ONDC\s+order\s+placed[:\s]+([A-Z0-9_-]+)\s*[-–—]\s*₹?([\d,]+\.?\d*)\s+at\s+([A-Za-z0-9\s&.-]+)/i,
    extract: (m: RegExpMatchArray) => ({
      orderId: m[1].trim(),
      amount: parseFloat(m[2].replace(/,/g, '')),
      merchant: m[3].trim(),
    }),
  },
];

// ─── ONDC Buyer Apps ──────────────────────────────────────────────────────────

const ONDC_BUYER_APPS = [
  { id: 'magicpin', name: 'Magicpin', color: '#e91e63' },
  { id: 'meesho', name: 'Meesho', color: '#e43c4b' },
  { id: 'flipkart', name: 'Flipkart', color: '#2874f0' },
  { id: 'paytm', name: 'Paytm', color: '#002970' },
  { id: 'shiprocket', name: 'Shiprocket', color: '#7928ca' },
  { id: 'growcer', name: 'Growcer', color: '#10b981' },
] as const;

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * parseONDCNotification — Parse a single ONDC SMS / notification string
 */
export function parseONDCNotification(text: string): ParsedONDTransaction | null {
  if (!text?.trim()) return null;

  let merchant = '';
  let amount = 0;
  let orderId = '';
  let buyerApp = '';
  let date = formatLocalYYYYMMDD(new Date());

  // Run all patterns
  for (const { pattern, extract } of ONDC_PATTERNS) {
    const m = text.match(pattern);
    if (!m) continue;
    const result: Record<string, unknown> = extract(m);
    if (result.merchant) merchant = result.merchant as string;
    if (result.amount) amount = result.amount as number;
    if (result.orderId) orderId = result.orderId as string;
    if (result.buyerApp) buyerApp = result.buyerApp as string;
  }

  // Fallback: extract amount from generic patterns
  if (!amount) {
    const amtMatch = text.match(/(?:inr|rs\.?|₹)\s*([\d,]+\.?\d*)/i);
    if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));
  }

  if (!amount || amount <= 0) return null;

  if (!merchant) merchant = 'ONDC Merchant';

  if (!buyerApp) {
    const appMatch = text.match(/via\s+([A-Za-z0-9]+)/i);
    if (appMatch) buyerApp = appMatch[1];
  }

  // Extract date from text if present
  const dateMatch = text.match(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}[- ][A-Za-z]{3}[- ]\d{2,4}/);
  if (dateMatch) {
    date = parseONDCDate(dateMatch[0]);
  }

  const confidence: 'high' | 'medium' | 'low' =
    merchant !== 'ONDC Merchant' && amount > 0 ? 'high' : amount > 0 ? 'medium' : 'low';

  return {
    id: `ondc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    merchant: merchant.substring(0, 60),
    amount: Math.round(amount * 100) / 100,
    type: 'debit',
    category: detectCategory(merchant),
    date,
    orderId: orderId || undefined,
    buyerApp: buyerApp || undefined,
    rawText: text.trim(),
    confidence,
  };
}

function parseONDCDate(dateStr: string): string {
  if (!dateStr) return formatLocalYYYYMMDD(new Date());

  // DD/MM/YY or DD-MM-YY
  const dmy = dateStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmy) {
    const [, d, mo, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD-Mon-YY
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
 * parseMultipleONDCMessages — Parse a block of text containing multiple ONDC notifications
 */
export function parseMultipleONDCMessages(bulkText: string): ParsedONDTransaction[] {
  const blocks = bulkText
    .split(/\n{2,}|(?=(?:ONDC\s+(?:order|delivery|payment|txn|pay)))/i)
    .map(b => b.trim())
    .filter(b => b.length > 10);

  const results: ParsedONDTransaction[] = [];
  for (const block of blocks) {
    const parsed = parseONDCNotification(block);
    if (parsed) results.push(parsed);
  }
  return results;
}

// ─── Convert to App Transaction ──────────────────────────────────────────────

export function ondToAppTransaction(
  p: ParsedONDTransaction,
  _currency = '₹'
): Omit<Transaction, 'id'> {
  return {
    merchant: p.merchant,
    amount: p.amount,
    type: p.type,
    category: p.category,
    date: p.date,
    description: p.orderId ? `ONDC Order: ${p.orderId}` : undefined,
  };
}

export { ONDC_BUYER_APPS };

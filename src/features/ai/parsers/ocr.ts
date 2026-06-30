import Tesseract from 'tesseract.js';
import { Transaction } from '@/types';
import { MERCHANT_CATEGORY_MAP } from '@/features/ai/parsers/common';
import { formatLocalYYYYMMDD } from '@/utils/date';

export async function recognizeReceipt(imageBase64: string): Promise<string> {
  try {
    const {
      data: { text },
    } = await Tesseract.recognize(imageBase64, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          // Optional progress logging
        }
      },
    });
    return text;
  } catch (error) {
    console.error('Tesseract OCR error:', error);
    throw new Error('Failed to extract text locally', { cause: error });
  }
}

export function parseOfflineReceipt(rawText: string): Partial<Transaction> & { splits?: { label: string; amount: number; category: string }[] } {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2);
  let totalAmount = 0;
  const items: { label: string; amount: number; category: string }[] = [];

  // 1. Find Total Amount (Prioritize "total" over "subtotal")
  const amountRegex = /[\d]+[.,]\d{2}/g;
  let maxTotal = 0;
  let maxSubtotal = 0;

  for (const line of lines) {
    const lower = line.toLowerCase();
    const matches = line.match(amountRegex);
    if (matches) {
      const val = parseFloat(matches[matches.length - 1].replace(',', '.'));
      if (lower.includes('total') && !lower.includes('sub')) {
        if (val > maxTotal) maxTotal = val;
      } else if (lower.includes('subtotal') || lower.includes('sub total')) {
        if (val > maxSubtotal) maxSubtotal = val;
      }

      // Check for line items
      const desc = line
        .replace(matches[matches.length - 1], '')
        .trim()
        .replace(/[^a-zA-Z0-9\s]/g, '');
      if (
        val > 0 &&
        desc.length > 2 &&
        !lower.includes('total') &&
        !lower.includes('tax') &&
        !lower.includes('change') &&
        !lower.includes('cash')
      ) {
        let cat = 'Other';
        const lowerDesc = desc.toLowerCase();
        for (const [merch, c] of Object.entries(MERCHANT_CATEGORY_MAP)) {
          if (lowerDesc.includes(merch)) {
            cat = c;
            break;
          }
        }
        items.push({ label: desc, amount: val, category: cat });
      }
    }
  }

  totalAmount = maxTotal > 0 ? maxTotal : maxSubtotal;
  if (totalAmount === 0) {
    const allNums: number[] = [];
    for (const line of lines) {
      const matches = line.match(amountRegex);
      if (matches) {
        matches.forEach(m => allNums.push(parseFloat(m.replace(',', '.'))));
      }
    }
    totalAmount = allNums.length > 0 ? Math.max(...allNums) : 0;
  }

  // 2. Find Merchant (Skip address, phone, and store metadata lines)
  let merchant = 'Receipt';
  const excludeWords =
    /street|st\b|avenue|ave\b|road|rd\b|boulevard|blvd|highway|hwy|city|town|zip|pincode|store|reg\b|trans|tel|phone|ph\b|fax|gst|tax|invoice|date|time|receipt|customer|copy|cashier/i;
  for (const line of lines.slice(0, 12)) {
    if (line.length > 3 && !line.match(/^\d+$/) && !excludeWords.test(line)) {
      const clean = line.replace(/[^a-zA-Z0-9\s]/g, '').trim();
      if (clean.length > 2) {
        merchant = clean;
        break;
      }
    }
  }

  // 3. Find Category
  let category = 'Shopping';
  const lowerText = rawText.toLowerCase();
  if (
    /grocery|mart|supermarket|food|fruit|vegetable|milk|bread|strawberries|yogurt|avocados|sourdough|coffee|cafe|restaurant|eat|lunch|dinner|snack/.test(
      lowerText
    )
  )
    category = 'Food';
  else if (/uber|ola|rapido|metro|bus|train|flight|fuel|travel|cab/.test(lowerText))
    category = 'Transport';
  else if (/netflix|spotify|amazon|prime|youtube|hotstar|sub|subscription/.test(lowerText))
    category = 'Subscriptions';
  else if (/electricity|water|bill|recharge|mobile|broadband/.test(lowerText))
    category = 'Utilities';
  else if (/doctor|hospital|pharma|med|health/.test(lowerText)) category = 'Health';
  else if (/movie|game|play|event|party/.test(lowerText)) category = 'Entertainment';

  // Final check against merchant category map
  for (const [merch, cat] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (rawText.toLowerCase().includes(merch)) {
      category = cat;
      if (merchant === 'Receipt' || merchant.length < 3) {
        merchant = merch.charAt(0).toUpperCase() + merch.slice(1);
      }
      break;
    }
  }

  return {
    amount: totalAmount,
    merchant: merchant.substring(0, 40),
    category,
    date: formatLocalYYYYMMDD(new Date()),
    type: 'debit',
    description: 'Scanned via SpendWise Vision',
    splits: items.length > 1 ? items.filter(i => i.amount < totalAmount * 0.9) : undefined,
  };
}

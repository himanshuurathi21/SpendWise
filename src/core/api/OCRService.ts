import { callGemini } from '@/core/api/gemini';
import { formatLocalYYYYMMDD } from '@/utils/date';

export interface OCRResult {
  merchant?: string;
  amount?: number;
  date?: string;
  category?: string;
  rawText: string;
}

export const processReceipt = async (imageFile: File): Promise<OCRResult> => {
  try {
    // Convert file to base64
    const base64 = await fileToBase64(imageFile);
    const mimeType = imageFile.type;

    const data = await callGemini({
      contents: [
        {
          parts: [
            {
              text: 'Extract details from this receipt. Return a JSON object with fields: merchant (string), amount (number), date (string, YYYY-MM-DD), category (string), and rawText (string containing all text found). If a field is not found, use null or omit it. Be accurate with the amount (look for total/sum).',
            },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    if (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !(data as any).candidates ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data as any).candidates.length === 0 ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !(data as any).candidates[0].content ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !(data as any).candidates[0].content.parts
    ) {
      console.error('Gemini API structure mismatch:', data);
      throw new Error('Receipt analysis returned no results. Please ensure the image is clear.');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = (data as any).candidates[0].content.parts[0].text;

    try {
      const cleanJson = text.replace(/```json|```/g, '').trim();
      const result = JSON.parse(cleanJson);

      return {
        merchant: result.merchant || 'Unknown Merchant',
        amount: result.amount || 0,
        date: result.date || formatLocalYYYYMMDD(new Date()),
        category: result.category || 'Other',
        rawText: result.rawText || text,
      };
    } catch (_) {
      console.warn('Failed to parse Gemini response as JSON, falling back to regex:', text);
      const amountMatch = text.match(/(?:total|amount|sum|due)\s*[:$₹Rs]?\s*(\d+[.,]\d{2})/i);
      return {
        merchant: 'Receipt',
        amount: amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0,
        date: formatLocalYYYYMMDD(new Date()),
        rawText: text,
      };
    }
  } catch (geminiError) {
    console.warn('Gemini OCR failed, falling back to Tesseract:', geminiError);
  }

  // Tesseract.js fallback (Highly advanced heuristic extraction)
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const {
      data: { text },
    } = await worker.recognize(imageFile);
    await worker.terminate();

    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 2);
    let amount = 0;

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
      }
    }

    amount = maxTotal > 0 ? maxTotal : maxSubtotal;
    if (amount === 0) {
      const allNums: number[] = [];
      for (const line of lines) {
        const matches = line.match(amountRegex);
        if (matches) {
          matches.forEach(m => allNums.push(parseFloat(m.replace(',', '.'))));
        }
      }
      amount = allNums.length > 0 ? Math.max(...allNums) : 0;
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

    // 3. Find Date
    const dateMatch = text.match(
      /\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/](?:20)?\d{2}|[A-Za-z]{3}\s+\d{1,2},?\s+20\d{2})\b/
    );
    let dateStr = formatLocalYYYYMMDD(new Date());
    if (dateMatch) {
      try {
        const d = new Date(dateMatch[0]);
        // R4 fix: use formatLocalYYYYMMDD for parsed receipt dates too
        if (!isNaN(d.getTime())) dateStr = formatLocalYYYYMMDD(d);
      } catch (_) {}
    }

    // 4. Find Category
    let category = 'Shopping';
    const lowerText = text.toLowerCase();
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

    return {
      merchant: merchant.substring(0, 40),
      amount,
      date: dateStr,
      category,
      rawText: text,
    };
  } catch (tessErr) {
    throw new Error('Could not read receipt. Please ensure the image is clear and well-lit.', {
      cause: tessErr,
    });
  }
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

import { Transaction } from '@/types';

/**
 * Validates and parses a JSON file containing an array of transactions.
 * Returns the valid transactions and any errors encountered.
 */
export async function parseTransactionsJSON(
  file: File
): Promise<{ transactions: Transaction[]; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        if (!Array.isArray(parsed)) {
          return resolve({ transactions: [], errors: ['JSON must be an array of transactions.'] });
        }

        const validTransactions: Transaction[] = [];
        const errors: string[] = [];

        parsed.forEach((item: Record<string, unknown>, index: number) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const i = item as any;
          // Basic validation
          if (!i.amount || !i.merchant || !i.category || !i.date) {
            errors.push(
              `Row ${index + 1}: Missing required fields (amount, merchant, category, date).`
            );
            return;
          }

          validTransactions.push({
            id: i.id || `imported-${Date.now()}-${index}`,
            amount: Number(i.amount),
            merchant: i.merchant,
            category: i.category,
            date: i.date,
            type: i.type === 'credit' ? 'credit' : 'debit',
            description: i.description || '',
            tags: Array.isArray(i.tags) ? i.tags : i.tags ? [i.tags] : [],
            status: i.status || 'completed',
          });
        });

        resolve({ transactions: validTransactions, errors });
      } catch (_) {
        resolve({ transactions: [], errors: ['Invalid JSON file.'] });
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

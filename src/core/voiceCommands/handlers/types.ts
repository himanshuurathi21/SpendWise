import { VoiceCommand, CommandResult } from '@/core/voiceCommands/types';
import { AppView } from '@/types';
import { formatLocalYYYYMMDD } from '@/utils/date';

export interface CommandContext {
  command: VoiceCommand;
  navigate: (view: AppView) => void;
  onExport: () => void;
  toggleTheme: () => void;
  setSearchQuery?: (q: string) => void;
}

export type IntentHandler = (context: CommandContext) => Promise<CommandResult> | CommandResult;

// Utility functions
export function formatCurrency(amount: number): string {
  let symbol = '₹';
  try {
    const raw = localStorage.getItem('spendwise_config');
    if (raw) {
      const config = JSON.parse(raw);
      if (config.currency) symbol = config.currency;
    }
  } catch (_) {
    // ignore
  }

  const locale = symbol === '₹' ? 'en-IN' : 'en-US';
  return `${symbol}${amount.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function shortId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function todayISO(): string {
  return formatLocalYYYYMMDD(new Date());
}

export function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatLocalYYYYMMDD(d);
}

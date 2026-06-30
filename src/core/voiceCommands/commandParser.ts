/**
 * Voice Command Parser — SpendWise Master Voice Engine
 *
 * Primary parsing is handled via Gemini (parseMasterVoiceWithGemini).
 * This file provides the fallback local parser and validation logic.
 */

import { VoiceCommand, AppView } from '@/core/voiceCommands/types';
import { FALLBACK_PATTERNS } from '@/core/voiceCommands/fallbackPatterns';

// ─── Indian Number Parser ─────────────────────────────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  paanch: 5,
  chhe: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  das: 10,
  bees: 20,
  tees: 30,
  chalis: 40,
  pachas: 50,
  saath: 60,
  sattar: 70,
  assi: 80,
  nabbe: 90,
  sau: 100,
  hazaar: 1000,
  lakh: 100000,
  crore: 10000000,
};

export function parseIndianNumber(text: string): number | null {
  const digitMatch = text.match(/[\d,]+\.?\d*/);
  if (digitMatch) {
    const num = parseFloat(digitMatch[0].replace(/,/g, ''));
    if (!isNaN(num)) return num;
  }

  const magnitudeMatch = text.match(/([\d.]+)\s*(lakh|lac|crore|cr|k|thousand|hundred)/i);
  if (magnitudeMatch) {
    const base = parseFloat(magnitudeMatch[1]);
    const multipliers: Record<string, number> = {
      lakh: 100000,
      lac: 100000,
      crore: 10000000,
      cr: 10000000,
      k: 1000,
      thousand: 1000,
      hundred: 100,
    };
    return base * (multipliers[magnitudeMatch[2].toLowerCase()] || 1);
  }

  const words = text.toLowerCase().split(/\s+/);
  let total = 0,
    current = 0;
  for (const word of words) {
    const val = NUMBER_WORDS[word];
    if (val !== undefined) {
      if (val >= 100) {
        current = (current || 1) * val;
        if (val >= 100000) {
          total += current;
          current = 0;
        }
      } else current += val;
    }
  }
  total += current;
  return total > 0 ? total : null;
}

// ─── Category Normalizer ──────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  food: 'Food',
  grocery: 'Food',
  transport: 'Transport',
  travel: 'Travel',
  rent: 'Utilities',
  emi: 'Utilities',
  loan: 'Utilities',
  shopping: 'Shopping',
  medical: 'Health',
  entertainment: 'Entertainment',
  utilities: 'Utilities',
  bills: 'Utilities',
  salary: 'Income',
  investment: 'Business',
  savings: 'Income',
  subscription: 'Subscriptions',
  subscriptions: 'Subscriptions',
  education: 'Education',
  business: 'Business',
  income: 'Income',
  health: 'Health',
};

export function normalizeCategory(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower === 'budget' || lower === 'burget') return 'Shopping';
  return CATEGORY_MAP[lower] || 'Shopping';
}

// ─── Navigation Map ───────────────────────────────────────────────────────────

export const NAV_MAP: Record<string, AppView> = {
  dashboard: 'dashboard',
  home: 'dashboard',
  analytics: 'analytics',
  stats: 'analytics',
  budget: 'budget',
  goals: 'goals',
  history: 'history',
  sync: 'sync',
  profile: 'profile',
  portfolio: 'portfolio',
  subscriptions: 'subscriptions',
};

// ─── Main Parser ──────────────────────────────────────────────────────────────

/**
 * Validates that required entities are present.
 */
export function getMissingEntityPrompt(command: VoiceCommand): string | null {
  const { intent, entities } = command;
  switch (intent) {
    case 'BUDGET_UPDATE':
      if (!entities.category) return 'Which budget category?';
      if (!entities.amount) return `How much should I set the ${entities.category} budget to?`;
      break;
    case 'TRANSACTION_ADD':
      if (!entities.amount) return 'What was the amount?';
      break;
    case 'GOAL_ADD':
      if (!entities.amount) return 'What is your savings target amount?';
      break;
  }
  return null;
}

/** True if this command should require explicit confirmation */
export function requiresConfirmation(command: VoiceCommand): boolean {
  const { intent, entities } = command;
  const HIGH_VALUE_THRESHOLD = 50_000;
  return (
    (intent === 'TRANSACTION_ADD' || intent === 'LIABILITY_ADD' || intent === 'PORTFOLIO_UPDATE') &&
    (entities.amount ?? 0) >= HIGH_VALUE_THRESHOLD
  );
}

/** Fallback local regex parser */
export function parseVoiceCommand(transcript: string): VoiceCommand {
  const cleaned = transcript.trim().toLowerCase();

  for (const pattern of FALLBACK_PATTERNS) {
    const match = cleaned.match(pattern.regex);
    if (match) {
      const entities = pattern.extract(match, cleaned, {
        normalizeCategory,
        parseIndianNumber,
        NAV_MAP,
      });
      return {
        intent: pattern.intent,
        entities,
        confidence: pattern.confidence,
        rawTranscript: transcript,
        summary: pattern.summarize(entities),
      };
    }
  }

  return {
    intent: 'UNKNOWN',
    entities: {},
    confidence: 0,
    rawTranscript: transcript,
    summary: `I didn't understand: "${transcript}"`,
  };
}

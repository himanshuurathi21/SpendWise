import { callGemini } from '@/core/api/gemini';
import type { Category } from '@/types';
import type { VoiceCommand } from '@/core/voiceCommands/types';

export interface VoiceParsedTransaction {
  amount: number;
  category: Category;
  merchant: string;
  type: 'credit' | 'debit';
  date: string;
  recurring?: string;
}

export const parseVoiceWithGemini = async (
  text: string,
  today: string
): Promise<VoiceParsedTransaction> => {
  const data = await callGemini({
    contents: [
      {
        parts: [
          {
            text: `Parse this voice command for a financial transaction: "${text}". 
          Today's date is ${today}.
          Return a JSON object with fields: 
          - amount (number)
          - category (string, must be one of: Food, Subscriptions, Transport, Entertainment, Shopping, Utilities, Health, Travel, Education, Business, Income)
          - merchant (string)
          - type (string, must be 'credit' or 'debit')
          - date (string, YYYY-MM-DD)
          - recurring (string, optional, e.g., month, week, year, day if specified).
          If a field is not found, use null or omit it. Be smart about relative dates like 'yesterday' or 'last week'.`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resultText = (data as any).candidates[0].content.parts[0].text;

  try {
    const result = JSON.parse(resultText);
    return {
      amount: result.amount || 0,
      category: result.category || 'Shopping',
      merchant: result.merchant || 'Unknown Merchant',
      type: result.type || 'debit',
      date: result.date || today,
      recurring: result.recurring,
    };
  } catch (e) {
    console.error('Failed to parse Gemini response as JSON:', resultText);
    throw new Error('Invalid response from Gemini', { cause: e });
  }
};

export const parseMasterVoiceWithGemini = async (
  text: string,
  today: string
): Promise<VoiceCommand> => {
  const data = await callGemini({
    contents: [
      {
        parts: [
          {
            text: `Parse this natural language voice command into a structured JSON object for a personal finance application.
          Today's date is ${today}.
          Command: "${text}"

          CRITICAL RULES:
          - If the user explicitly says "delete", "remove", "clear", or "cancel" for ANY entity (budget, transaction, liability, portfolio asset, goal, subscription, or recurring transaction), the intent MUST be the respective *_DELETE intent (e.g., BUDGET_DELETE, GOAL_DELETE, LIABILITY_DELETE, PORTFOLIO_DELETE, SUBSCRIPTION_DELETE, RECURRING_DELETE, TRANSACTION_DELETE) and NOT an *_ADD or *_UPDATE intent.
          - For example: "delete budget 200" -> BUDGET_DELETE, "remove goal travel" -> GOAL_DELETE, "cancel subscription netflix" -> SUBSCRIPTION_DELETE.

          Return a valid JSON object matching this schema exactly:
          {
            "intent": "BUDGET_UPDATE" | "BUDGET_DELETE" | "BUDGET_RESET" | "BUDGET_SETTINGS_UPDATE" | "TRANSACTION_ADD" | "TRANSACTION_UPDATE" | "TRANSACTION_DELETE" | "TRANSACTION_BULK_DELETE" | "TRANSACTION_BULK_UPDATE" | "LIABILITY_ADD" | "LIABILITY_PAY" | "LIABILITY_DELETE" | "PORTFOLIO_UPDATE" | "PORTFOLIO_ADJUST" | "PORTFOLIO_DELETE" | "GOAL_ADD" | "GOAL_UPDATE" | "GOAL_DELETE" | "SUBSCRIPTION_ADD" | "SUBSCRIPTION_UPDATE" | "SUBSCRIPTION_DELETE" | "RECURRING_ADD" | "RECURRING_DELETE" | "REPORT_EXPORT" | "QUERY_REPORT" | "BATCH_TRANSACTIONS" | "SETTINGS_TOGGLE" | "PARENTAL_TOGGLE" | "PARENTAL_LIMIT_SET" | "PARENTAL_RESTRICT_CATEGORY" | "PARENTAL_APPROVE_TX" | "PARENTAL_DENY_TX" | "SESSION_LOCK" | "DATA_QUERY" | "QUEST_ACTION" | "QUEST_CLAIM" | "SEARCH_ACTION" | "NAVIGATE" | "UNDO_ACTION" | "HELP" | "UNKNOWN",
            "entities": {
              "category": "string (e.g. Food, Transport, Shopping)",
              "amount": "number (extract amount in INR, handle lakh/crore)",
              "targetAmount": "number (extract target amount or payment amount)",
              "name": "string (merchant name, liability name, goal name)",
              "period": "string (e.g. yesterday, today, month, week)",
              "view": "string (e.g. dashboard, analytics, budget, goals, shared, history, sync, profile, portfolio, subscriptions, UNDO)",
              "type": "debit" | "credit",
              "frequency": "daily | weekly | monthly | annual",
              "settingKey": "theme" | "privacy" | "notifications" | "biometric" | "shake" | "currency",
              "settingValue": "on" | "off" | "toggle",
              "searchQuery": "string (search term)",
              "actionType": "string (e.g. start, check, claim)",
              "items": [{"amount": "number", "category": "string", "name": "string"}] (for batch operations)
            },
            "confidence": "number between 0 and 1",
            "rawTranscript": "${text}",
            "summary": "Short human readable summary of the action"
          }
          Do not include any extra text or markdown formatting. Just the JSON.`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resultText = (data as any).candidates[0].content.parts[0].text;

  try {
    const result = JSON.parse(resultText);
    return result as VoiceCommand;
  } catch (e) {
    console.error('Failed to parse Gemini response as JSON:', resultText);
    throw new Error('Invalid response from Gemini', { cause: e });
  }
};

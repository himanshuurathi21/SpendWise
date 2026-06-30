/* eslint-disable no-console */
/**
 * Setu Account Aggregator (AA) Sandbox Mock
 *
 * This file simulates the interaction with the Setu AA API.
 * In a real environment, these calls would be made from a secure backend
 * to prevent leaking the Setu Client ID and Secret.
 *
 * Flow:
 * 1. Create Consent Request (POST /consents)
 * 2. User approves consent via Setu UI
 * 3. Fetch Data Session (POST /sessions)
 * 4. Fetch Bank Statements (GET /sessions/{id}/data)
 */

import { Transaction } from '@/types';
import { formatLocalYYYYMMDD } from '@/utils/date';

import { SETU_CLIENT_ID, SETU_SECRET } from '@/config/env';

// Log a warning if env vars are missing (they're optional for the mock/sandbox flow)
if (!SETU_CLIENT_ID || !SETU_SECRET) {
  console.warn(
    '[Setu AA] VITE_SETU_CLIENT_ID / VITE_SETU_SECRET not set — using sandbox mock defaults'
  );
}

export interface SetuConsentResponse {
  id: string;
  url: string; // The URL to redirect the user to for approval
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
}

/**
 * Step 1: Request consent to view bank data
 */
export async function createSetuConsent(mobileNumber: string): Promise<SetuConsentResponse> {
  console.info(`[Setu AA] Creating consent request for ${mobileNumber}...`);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  return {
    id: `setu_cons_${Date.now()}`,
    url: `https://sandbox.setu.co/consent?id=mock_${Date.now()}`,
    status: 'PENDING',
  };
}

/**
 * Step 2: Poll for consent status (In production, use Webhooks instead)
 */
export async function checkSetuConsentStatus(
  _consentId: string
): Promise<'PENDING' | 'ACTIVE' | 'REJECTED'> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // For the sake of the mock, we assume it's instantly active if they check
  return 'ACTIVE';
}

/**
 * Request consent specifically for credit bureau data (CIBIL score)
 */
export async function refreshCreditConsent(mobileNumber: string): Promise<SetuConsentResponse> {
  console.info(`[Setu AA] Requesting credit data consent for ${mobileNumber}...`);

  await new Promise(resolve => setTimeout(resolve, 800));

  return {
    id: `setu_credit_${Date.now()}`,
    url: `https://sandbox.setu.co/consent/credit?id=mock_${Date.now()}`,
    status: 'PENDING',
  };
}

export async function fetchSetuBankStatements(consentId: string): Promise<Partial<Transaction>[]> {
  console.info(`[Setu AA] Fetching secure bank statements for consent ${consentId}...`);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Return realistic data that matches the FI (Financial Information) data schema
  return [
    {
      merchant: 'HDFC Bank IMPS',
      amount: 15000,
      type: 'credit',
      description: 'IMPS-1234567890-SALARY',
      date: formatLocalYYYYMMDD(new Date()),
    },
    {
      merchant: 'Zomato Ltd',
      amount: 450,
      type: 'debit',
      description: 'UPI-ZOMATO@HDFC-FOOD',
      date: formatLocalYYYYMMDD(new Date(Date.now() - 86400000)),
    },
    {
      merchant: 'Amazon India',
      amount: 1299,
      type: 'debit',
      description: 'UPI-AMAZON@SBI-SHOPPING',
      date: formatLocalYYYYMMDD(new Date(Date.now() - 172800000)),
    },
  ];
}

export type AssetType =
  | 'bank'
  | 'investment'
  | 'crypto'
  | 'property'
  | 'business'
  | 'education'
  | 'other';
export type LiabilityType =
  | 'loan'
  | 'car_loan'
  | 'credit_card'
  | 'mortgage'
  | 'student_loan'
  | 'business_loan'
  | 'other';
export type FinanceProvider =
  | 'gpay'
  | 'phonepe'
  | 'paytm'
  | 'cred'
  | 'bhim'
  | 'razorpay'
  | 'plaid'
  | 'web3'
  | 'ondc'
  | 'other';

export interface AssetEntry {
  id: string;
  name: string;
  type: AssetType;
  balance: number;
  currency?: string;
  icon?: string;
  color?: string;
  symbol?: string;
  assetClass?: 'mutual_fund' | 'equity' | 'etf';
  lastUpdated: string;
}

export interface LiabilityEntry {
  id: string;
  name: string;
  type: LiabilityType;
  balance: number;
  interestRate?: number; // Annual percentage rate
  minPayment?: number;
  currency?: string;
  icon?: string;
  lastUpdated: string;
}

export interface LinkedAccount {
  id: string;
  provider: FinanceProvider;
  upiId: string;
  linkedAt: string;
  lastSynced: string;
  status: 'active' | 'error' | 'disconnected';
}

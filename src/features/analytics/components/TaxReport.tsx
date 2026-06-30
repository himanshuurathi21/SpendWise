import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt,
  Download,
  Share2,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Calculator,
  Wallet,
  PiggyBank,
  Heart,
  Home,
  GraduationCap,
} from 'lucide-react';
import {
  OLD_REGIME_SLABS,
  NEW_REGIME_SLABS,
  STANDARD_DEDUCTION,
  SECTION_80C_LIMIT,
  SECTION_80D_LIMIT,
  NPS_80CCD_1B_LIMIT,
  HOME_LOAN_24B_LIMIT,
  getAnnualIncomeFromTransactions,
  calculateTax,
  calculateCess,
  calculateSurcharge,
} from '@/utils/taxConstants';
import { TaxComparisonTable } from './TaxComparisonTable';
import { cn } from '@/utils/cn';
import { Transaction } from '@/types';

interface TaxReportProps {
  transactions?: Transaction[];
  currency?: string;
}

interface DeductionField {
  key: string;
  label: string;
  icon: React.ReactNode;
  limit: number;
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}

export default function TaxReport({ transactions = [], currency = '\u20B9' }: TaxReportProps) {
  const autoIncome = useMemo(() => getAnnualIncomeFromTransactions(transactions), [transactions]);
  const [income, setIncome] = useState(autoIncome);
  const [section80C, setSection80C] = useState(0);
  const [section80D, setSection80D] = useState(0);
  const [hraRent, setHraRent] = useState(0);
  const [hraMetro, setHraMetro] = useState(true);
  const [nps80CCD, setNps80CCD] = useState(0);
  const [homeLoan24b, setHomeLoan24b] = useState(0);
  const [showInputs, setShowInputs] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const hraExemption = useMemo(() => {
    if (hraRent <= 0) return 0;
    const salaryForHRA = income * 0.7;
    const actualRentExcess = hraRent * 12 - salaryForHRA * 0.1;
    const metroExemption = hraMetro ? salaryForHRA * 0.5 : salaryForHRA * 0.4;
    return Math.max(0, Math.min(actualRentExcess, metroExemption));
  }, [income, hraRent, hraMetro]);

  const totalDeductions = useMemo(
    () =>
      Math.min(section80C, SECTION_80C_LIMIT) +
      Math.min(section80D, SECTION_80D_LIMIT) +
      hraExemption +
      Math.min(nps80CCD, NPS_80CCD_1B_LIMIT) +
      Math.min(homeLoan24b, HOME_LOAN_24B_LIMIT),
    [section80C, section80D, hraExemption, nps80CCD, homeLoan24b]
  );

  const oldTaxableIncome = useMemo(
    () => Math.max(0, income - totalDeductions - STANDARD_DEDUCTION),
    [income, totalDeductions]
  );
  const newTaxableIncome = useMemo(() => Math.max(0, income - STANDARD_DEDUCTION), [income]);

  const oldTax = calculateTax(OLD_REGIME_SLABS, oldTaxableIncome);
  const newTax = calculateTax(NEW_REGIME_SLABS, newTaxableIncome);
  const oldTotal = oldTax + calculateCess(oldTax) + calculateSurcharge(oldTaxableIncome, oldTax);
  const newTotal = newTax + calculateCess(newTax) + calculateSurcharge(newTaxableIncome, newTax);
  const recommended = oldTotal <= newTotal ? 'Old' : 'New';
  const savings = Math.abs(oldTotal - newTotal);

  const suggestions = useMemo(() => {
    const tips: { text: string; icon: string }[] = [];
    const remaining80C = Math.max(0, SECTION_80C_LIMIT - section80C);
    if (remaining80C > 0 && oldTotal > newTotal) {
      tips.push({
        text: `Invest \u20B9${remaining80C.toLocaleString('en-IN')} more in Section 80C (ELSS, PPF, LIC) to maximize deduction.`,
        icon: '\uD83D\uDCB0',
      });
    }
    const remaining80D = Math.max(0, SECTION_80D_LIMIT - section80D);
    if (remaining80D > 0 && oldTotal > newTotal) {
      tips.push({
        text: `Claim \u20B9${remaining80D.toLocaleString('en-IN')} more under Section 80D for health insurance premiums.`,
        icon: '\uD83C\uDFE5',
      });
    }
    if (oldTotal > newTotal) {
      tips.push({
        text: `Switching to New Regime saves \u20B9${savings.toLocaleString('en-IN')}. No deductions needed.`,
        icon: '\uD83D\uDEE1\uFE0F',
      });
    } else if (savings > 0) {
      tips.push({
        text: `Stick with Old Regime to save \u20B9${savings.toLocaleString('en-IN')}. Keep maximizing deductions.`,
        icon: '\uD83D\uDCB3',
      });
    }
    if (income > 5000000) {
      tips.push({
        text: 'Your income exceeds \u20B950L — surcharge applies. Consider structuring income efficiently.',
        icon: '\u26A0\uFE0F',
      });
    }
    if (nps80CCD < NPS_80CCD_1B_LIMIT && oldTotal > newTotal) {
      tips.push({
        text: `Contribute up to \u20B9${NPS_80CCD_1B_LIMIT.toLocaleString('en-IN')} in NPS under 80CCD(1B) for additional \u20B950K deduction.`,
        icon: '\uD83C\uDFDB\uFE0F',
      });
    }
    return tips;
  }, [section80C, section80D, nps80CCD, oldTotal, newTotal, savings, income]);

  const handleDownloadPDF = useCallback(() => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Pop-up blocked! Please allow pop-ups to download the PDF.');
      return;
    }

    const doc = win.document;
    doc.write('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>SpendWise ITR Tax Report</title></head><body></body></html>');
    doc.close();

    const style = doc.createElement('style');
    style.textContent = `
      body { font-family: 'Inter', -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a202c; line-height: 1.6; }
      h1 { color: #14b8a6; font-size: 1.8rem; border-bottom: 3px solid #14b8a6; padding-bottom: 8px; }
      h2 { color: #1a202c; font-size: 1.3rem; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
      th { background: #f7fafc; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: #718096; }
      .summary { background: #f0fdfa; border: 1px solid #14b8a6; border-radius: 12px; padding: 16px; margin: 16px 0; }
      .green { color: #059669; font-weight: 700; }
      .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #718096; text-align: center; }
      @media print { body { padding: 20px; } }
    `;
    doc.head.appendChild(style);

    const body = doc.body;

    const h1 = doc.createElement('h1');
    h1.textContent = 'SpendWise ITR Tax Report';
    body.appendChild(h1);

    const dateP = doc.createElement('p');
    dateP.style.cssText = 'color:#718096;font-size:14px;';
    dateP.textContent = `Generated on ${new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}`;
    body.appendChild(dateP);

    const h2Income = doc.createElement('h2');
    h2Income.textContent = 'Income & Deductions';
    body.appendChild(h2Income);

    const table1 = doc.createElement('table');
    const incomeRows = [
      ['Annual Gross Income', `${currency}${income.toLocaleString('en-IN')}`],
      ['Total Deductions', `${currency}${totalDeductions.toLocaleString('en-IN')}`],
      ['Standard Deduction', `${currency}${STANDARD_DEDUCTION.toLocaleString('en-IN')}`],
    ];
    for (const [label, value] of incomeRows) {
      const tr = doc.createElement('tr');
      const td1 = doc.createElement('td');
      td1.textContent = label;
      tr.appendChild(td1);
      const td2 = doc.createElement('td');
      td2.style.cssText = 'text-align:right;font-weight:700;';
      td2.textContent = value;
      tr.appendChild(td2);
      table1.appendChild(tr);
    }
    for (const [label, val] of [['Old Regime Taxable Income', oldTaxableIncome] as [string, number], ['New Regime Taxable Income', newTaxableIncome] as [string, number]]) {
      const tr = doc.createElement('tr');
      if (label === 'Old Regime Taxable Income') tr.style.borderTop = '2px solid #1a202c';
      const td1 = doc.createElement('td');
      const strong = doc.createElement('strong');
      strong.textContent = label;
      td1.appendChild(strong);
      tr.appendChild(td1);
      const td2 = doc.createElement('td');
      td2.style.cssText = 'text-align:right;font-weight:700;';
      td2.textContent = `${currency}${val.toLocaleString('en-IN')}`;
      tr.appendChild(td2);
      table1.appendChild(tr);
    }
    body.appendChild(table1);

    const h2Tax = doc.createElement('h2');
    h2Tax.textContent = 'Tax Comparison';
    body.appendChild(h2Tax);

    const table2 = doc.createElement('table');
    const headerTr = doc.createElement('tr');
    for (const text of ['', 'Old Regime', 'New Regime']) {
      const th = doc.createElement('th');
      th.textContent = text;
      headerTr.appendChild(th);
    }
    table2.appendChild(headerTr);

    const taxRows = [
      { label: 'Base Tax', old: oldTax, new: newTax },
      { label: 'Cess (4%)', old: calculateCess(oldTax), new: calculateCess(newTax) },
      { label: 'Surcharge', old: calculateSurcharge(oldTaxableIncome, oldTax), new: calculateSurcharge(newTaxableIncome, newTax) },
    ];
    for (const row of taxRows) {
      const tr = doc.createElement('tr');
      const tdL = doc.createElement('td');
      tdL.textContent = row.label;
      tr.appendChild(tdL);
      for (const val of [row.old, row.new]) {
        const td = doc.createElement('td');
        td.style.textAlign = 'right';
        td.textContent = `${currency}${val.toLocaleString('en-IN')}`;
        tr.appendChild(td);
      }
      table2.appendChild(tr);
    }

    const trTotal = doc.createElement('tr');
    trTotal.style.borderTop = '2px solid #1a202c';
    const tdTotalLabel = doc.createElement('td');
    const strongTotal = doc.createElement('strong');
    strongTotal.textContent = 'Total Liability';
    tdTotalLabel.appendChild(strongTotal);
    trTotal.appendChild(tdTotalLabel);
    for (const val of [oldTotal, newTotal]) {
      const td = doc.createElement('td');
      td.style.cssText = 'text-align:right;font-weight:700;';
      td.textContent = `${currency}${val.toLocaleString('en-IN')}`;
      trTotal.appendChild(td);
    }
    table2.appendChild(trTotal);
    body.appendChild(table2);

    const summaryDiv = doc.createElement('div');
    summaryDiv.className = 'summary';
    const recP = doc.createElement('p');
    recP.style.cssText = 'font-size:16px;font-weight:700;';
    recP.textContent = `Recommended: ${recommended} Regime`;
    summaryDiv.appendChild(recP);
    const savingsP = doc.createElement('p');
    savingsP.style.fontSize = '14px';
    savingsP.textContent = 'Potential savings: ';
    const savingsSpan = doc.createElement('span');
    savingsSpan.className = 'green';
    savingsSpan.textContent = `${currency}${savings.toLocaleString('en-IN')}`;
    savingsP.appendChild(savingsSpan);
    summaryDiv.appendChild(savingsP);
    body.appendChild(summaryDiv);

    const h2Ded = doc.createElement('h2');
    h2Ded.textContent = 'Deductions Breakdown';
    body.appendChild(h2Ded);

    const table3 = doc.createElement('table');
    const dedRows = [
      ['Section 80C (ELSS, PPF, LIC)', Math.min(section80C, SECTION_80C_LIMIT)],
      ['Section 80D (Health Insurance)', Math.min(section80D, SECTION_80D_LIMIT)],
      ['HRA Exemption', hraExemption],
      ['NPS 80CCD(1B)', Math.min(nps80CCD, NPS_80CCD_1B_LIMIT)],
      ['Home Loan Interest 24(b)', Math.min(homeLoan24b, HOME_LOAN_24B_LIMIT)],
    ];
    for (const [label, value] of dedRows as [string, number][]) {
      const tr = doc.createElement('tr');
      const td1 = doc.createElement('td');
      td1.textContent = label;
      tr.appendChild(td1);
      const td2 = doc.createElement('td');
      td2.style.textAlign = 'right';
      td2.textContent = `${currency}${value.toLocaleString('en-IN')}`;
      tr.appendChild(td2);
      table3.appendChild(tr);
    }
    body.appendChild(table3);

    const footerDiv = doc.createElement('div');
    footerDiv.className = 'footer';
    const footerP = doc.createElement('p');
    footerP.textContent = 'Generated by SpendWise \u2014 Financial Intelligence';
    footerDiv.appendChild(footerP);
    body.appendChild(footerDiv);

    setTimeout(() => {
      win.focus();
      win.print();
    }, 500);
  }, [
    income,
    oldTaxableIncome,
    newTaxableIncome,
    oldTax,
    newTax,
    oldTotal,
    newTotal,
    totalDeductions,
    section80C,
    section80D,
    hraExemption,
    nps80CCD,
    homeLoan24b,
    recommended,
    savings,
    currency,
  ]);

  const handleShareWithCA = useCallback(async () => {
    const text = [
      'SpendWise ITR Tax Summary',
      '========================',
      '',
      `Annual Income: ${currency}${income.toLocaleString('en-IN')}`,
      `Old Regime Tax: ${currency}${oldTotal.toLocaleString('en-IN')}`,
      `New Regime Tax: ${currency}${newTotal.toLocaleString('en-IN')}`,
      `Recommended: ${recommended} Regime`,
      `Savings: ${currency}${savings.toLocaleString('en-IN')}`,
      '',
      'Deductions:',
      `  80C: ${currency}${Math.min(section80C, SECTION_80C_LIMIT).toLocaleString('en-IN')}`,
      `  80D: ${currency}${Math.min(section80D, SECTION_80D_LIMIT).toLocaleString('en-IN')}`,
      `  HRA: ${currency}${hraExemption.toLocaleString('en-IN')}`,
      `  80CCD(1B): ${currency}${Math.min(nps80CCD, NPS_80CCD_1B_LIMIT).toLocaleString('en-IN')}`,
      `  24(b): ${currency}${Math.min(homeLoan24b, HOME_LOAN_24B_LIMIT).toLocaleString('en-IN')}`,
      '',
      'Generated by SpendWise',
    ].join('\n');

    if (navigator.share) {
      await navigator.share({ title: 'ITR Tax Summary - SpendWise', text }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text);
      alert('Tax summary copied to clipboard! You can paste it in an email to your CA.');
    }
  }, [
    income,
    oldTotal,
    newTotal,
    recommended,
    savings,
    section80C,
    section80D,
    hraExemption,
    nps80CCD,
    homeLoan24b,
    currency,
  ]);

  const deductionFields: DeductionField[] = [
    {
      key: '80c',
      label: 'Section 80C (ELSS, PPF, LIC)',
      icon: <PiggyBank size={18} />,
      limit: SECTION_80C_LIMIT,
      value: section80C,
      onChange: setSection80C,
      placeholder: 'e.g. 150000',
    },
    {
      key: '80d',
      label: 'Section 80D (Health Insurance)',
      icon: <Heart size={18} />,
      limit: SECTION_80D_LIMIT,
      value: section80D,
      onChange: setSection80D,
      placeholder: 'e.g. 25000',
    },
    {
      key: 'nps',
      label: 'NPS 80CCD(1B)',
      icon: <GraduationCap size={18} />,
      limit: NPS_80CCD_1B_LIMIT,
      value: nps80CCD,
      onChange: setNps80CCD,
      placeholder: 'e.g. 50000',
    },
    {
      key: 'home',
      label: 'Home Loan Interest 24(b)',
      icon: <Home size={18} />,
      limit: HOME_LOAN_24B_LIMIT,
      value: homeLoan24b,
      onChange: setHomeLoan24b,
      placeholder: 'e.g. 200000',
    },
  ];

  return (
    <div className="view-enter max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
          <Receipt size={22} className="text-amber-500" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-[var(--text-primary)]">ITR Tax Report</h2>
          <p className="text-[var(--text-muted)] font-medium">
            Old vs New regime comparison with AI-powered suggestions
          </p>
        </div>
      </div>

      <button
        onClick={() => setShowInputs(!showInputs)}
        className="w-full flex items-center justify-between p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] hover:bg-[var(--surface-input)] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Calculator size={20} className="text-[var(--teal)]" />
          <span className="font-bold text-[var(--text-primary)]">Income & Deduction Details</span>
        </div>
        {showInputs ? (
          <ChevronUp size={20} className="text-[var(--text-muted)]" />
        ) : (
          <ChevronDown size={20} className="text-[var(--text-muted)]" />
        )}
      </button>

      {showInputs && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] p-6">
            <div className="flex items-center gap-3 mb-4">
              <Wallet size={18} className="text-[var(--teal)]" />
              <h3 className="font-bold text-[var(--text-primary)]">Annual Gross Income</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-[var(--text-muted)]">{currency}</span>
              <input
                type="number"
                value={income || ''}
                onChange={e => setIncome(Number(e.target.value) || 0)}
                className="flex-1 p-3 rounded-xl bg-[var(--surface-input)] border border-[var(--border)] text-[var(--text-primary)] font-bold text-lg outline-none focus:border-[var(--teal)] transition-colors"
                placeholder="Enter annual income"
              />
            </div>
            {autoIncome > 0 && (
              <p className="text-[length:var(--fs-overline)] text-[var(--text-muted)] mt-2">
                Auto-filled from {new Date().getFullYear()} credit transactions: {currency}
                {autoIncome.toLocaleString('en-IN')}
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <Receipt size={18} className="text-amber-500" />
              <h3 className="font-bold text-[var(--text-primary)]">Deductions</h3>
            </div>

            {deductionFields.map(field => (
              <div key={field.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--teal)]">{field.icon}</span>
                    <label className="text-sm font-semibold text-[var(--text-primary)]">
                      {field.label}
                    </label>
                  </div>
                  <span className="text-[length:var(--fs-overline)] font-bold text-[var(--text-muted)]">
                    Max: {currency}
                    {field.limit.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[var(--text-muted)]">{currency}</span>
                  <input
                    type="number"
                    value={field.value || ''}
                    onChange={e => field.onChange(Number(e.target.value) || 0)}
                    className="flex-1 p-2.5 rounded-xl bg-[var(--surface-input)] border border-[var(--border)] text-[var(--text-primary)] font-semibold outline-none focus:border-[var(--teal)] transition-colors text-sm"
                    placeholder={field.placeholder}
                  />
                </div>
                {field.value > field.limit && (
                  <p className="text-xs text-amber-500 mt-1">
                    Capped at {currency}
                    {field.limit.toLocaleString('en-IN')} per ITR rules
                  </p>
                )}
              </div>
            ))}

            <div className="pt-2">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[var(--teal)]">
                  <Home size={18} />
                </span>
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  HRA Details
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[var(--text-muted)]">{currency}</span>
                  <input
                    type="number"
                    value={hraRent || ''}
                    onChange={e => setHraRent(Number(e.target.value) || 0)}
                    className="flex-1 p-2.5 rounded-xl bg-[var(--surface-input)] border border-[var(--border)] text-[var(--text-primary)] font-semibold outline-none focus:border-[var(--teal)] transition-colors text-sm"
                    placeholder="Rent per month"
                  />
                </div>
                <label className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--surface-input)] border border-[var(--border)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hraMetro}
                    onChange={e => setHraMetro(e.target.checked)}
                    className="w-4 h-4 accent-[var(--teal)]"
                  />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    Metro City
                  </span>
                </label>
              </div>
              {hraExemption > 0 && (
                <p className="text-xs text-[var(--teal)] mt-1">
                  HRA Exemption: {currency}
                  {hraExemption.toLocaleString('en-IN')}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-[var(--text-primary)]">Tax Comparison</h3>
          <div className="flex items-center gap-2">
            <span className="text-[length:var(--fs-overline)] font-bold text-[var(--text-muted)]">
              Old Regime Income:
            </span>
            <span className="font-bold text-[var(--text-primary)]">
              {currency}
              {oldTaxableIncome.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <TaxComparisonTable
          oldSlabs={OLD_REGIME_SLABS}
          newSlabs={NEW_REGIME_SLABS}
          oldTaxableIncome={oldTaxableIncome}
          newTaxableIncome={newTaxableIncome}
          currency={currency}
        />

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-[var(--surface-input)] border border-[var(--border)] text-center">
            <p className="text-[length:var(--fs-overline)] font-bold text-[var(--text-muted)] uppercase tracking-widest">
              Old Regime
            </p>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {currency}
              {oldTotal.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-input)] border border-[var(--border)] text-center">
            <p className="text-[length:var(--fs-overline)] font-bold text-[var(--text-muted)] uppercase tracking-widest">
              New Regime
            </p>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {currency}
              {newTotal.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-input)] border border-[var(--border)] text-center">
            <p className="text-[length:var(--fs-overline)] font-bold text-[var(--text-muted)] uppercase tracking-widest">
              Deductions
            </p>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {currency}
              {totalDeductions.toLocaleString('en-IN')}
            </p>
          </div>
          <div
            className={cn(
              'p-3 rounded-xl border text-center',
              recommended === 'Old'
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-blue-500/10 border-blue-500/20'
            )}
          >
            <p className="text-[length:var(--fs-overline)] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Best Regime
            </p>
            <p
              className={cn(
                'text-lg font-bold',
                recommended === 'Old' ? 'text-emerald-600' : 'text-blue-500'
              )}
            >
              {recommended} ({currency}
              {savings.toLocaleString('en-IN')})
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] overflow-hidden">
        <button
          onClick={() => setShowSuggestions(!showSuggestions)}
          className="w-full flex items-center justify-between p-4 hover:bg-[var(--surface-input)] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Lightbulb size={20} className="text-amber-500" />
            <span className="font-bold text-[var(--text-primary)]">
              Suggested Tax-Saving Actions
            </span>
          </div>
          {showSuggestions ? (
            <ChevronUp size={20} className="text-[var(--text-muted)]" />
          ) : (
            <ChevronDown size={20} className="text-[var(--text-muted)]" />
          )}
        </button>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 pb-4 space-y-2"
          >
            {suggestions.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] p-3 rounded-xl bg-[var(--surface-input)]">
                No suggestions available. Add income and deduction details first.
              </p>
            ) : (
              suggestions.map((tip, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10"
                >
                  <span className="text-lg shrink-0">{tip.icon}</span>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">{tip.text}</p>
                </div>
              ))
            )}
          </motion.div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleDownloadPDF}
          className="flex items-center justify-center gap-2 flex-1 px-6 py-3 bg-[var(--teal)] text-white border-none rounded-2xl cursor-pointer font-bold shadow-lg shadow-teal-500/20 hover:scale-105 active:scale-95 transition-all"
        >
          <Download size={18} />
          Download PDF Summary
        </button>
        <button
          onClick={handleShareWithCA}
          className="flex items-center justify-center gap-2 flex-1 px-6 py-3 bg-[var(--surface-input)] text-[var(--text-primary)] border border-[var(--border)] rounded-2xl cursor-pointer font-bold hover:bg-[var(--border)] active:scale-95 transition-all"
        >
          <Share2 size={18} />
          Share with CA
        </button>
      </div>

      <p className="text-[length:var(--fs-overline)] text-[var(--text-muted)] text-center">
        This is an indicative calculation for planning purposes. Consult a qualified CA for filing.
      </p>
    </div>
  );
}

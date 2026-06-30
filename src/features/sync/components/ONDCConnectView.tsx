import { ArrowLeft, ChevronRight } from 'lucide-react';
import { ONDC_BUYER_APPS } from '@/features/sync/parsers/ondc';
import { SyncView } from '@/types';

interface ONDCConnectViewProps {
  onSetView: (view: SyncView) => void;
  onONDCLinkSuccess: (app: (typeof ONDC_BUYER_APPS)[number], upiId: string) => void;
}

export default function ONDCConnectView({ onSetView, onONDCLinkSuccess }: ONDCConnectViewProps) {
  return (
    <div className="max-w-2xl mx-auto py-8 animate-scale-in">
      <button
        onClick={() => onSetView('select-source')}
        className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-6 transition-colors border-none bg-transparent cursor-pointer font-semibold"
      >
        <ArrowLeft size={18} /> Back to Sources
      </button>
      <h2 className="text-headline mb-2">Connect ONDC Buyer App</h2>
      <p className="text-caption mb-8">
        Select your ONDC-enabled app to sync order notifications.
      </p>
      <div className="grid gap-4">
        {ONDC_BUYER_APPS.map(app => (
          <button
            key={app.id}
            onClick={() => onONDCLinkSuccess(app, `${app.id}@ondc`)}
            className="w-full flex items-center gap-5 p-6 rounded-2xl border border-[var(--border)] hover:border-[var(--teal)] hover:shadow-lg hover:shadow-teal-500/5 cursor-pointer bg-[var(--surface-card)] transition-all text-left"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-white font-bold text-lg"
              style={{ background: app.color }}
            >
              {app.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-manrope font-bold text-lg text-[var(--text-primary)]">
                {app.name}
              </p>
              <p className="font-inter text-sm text-[var(--text-muted)] mt-1">
                Sync ONDC orders via {app.name}
              </p>
            </div>
            <ChevronRight size={20} className="text-[var(--text-muted)]" />
          </button>
        ))}
      </div>
    </div>
  );
}

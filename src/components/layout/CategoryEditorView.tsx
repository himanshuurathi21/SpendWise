import { CustomCategoryDef } from '@/types';

interface CategoryEditorViewProps {
  editingId: string | null;
  name: string;
  icon: string;
  color: string;
  monthlyLimit: string;
  EMOJI_OPTIONS: string[];
  COLOR_OPTIONS: string[];
  suggestedCategories: string[];
  allCategories: string[];
  onNameChange: (name: string) => void;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
  onMonthlyLimitChange: (limit: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddSuggested: (def: Omit<CustomCategoryDef, 'id'>) => void;
}

export default function CategoryEditorView({
  editingId,
  name,
  icon,
  color,
  monthlyLimit,
  EMOJI_OPTIONS,
  COLOR_OPTIONS,
  suggestedCategories,
  allCategories,
  onNameChange,
  onIconChange,
  onColorChange,
  onMonthlyLimitChange,
  onSave,
  onCancel,
  onAddSuggested,
}: CategoryEditorViewProps) {
  return (
    <div className="space-y-5 animate-fade-in-up">
      <div>
        <label
          style={{
            fontFamily: 'var(--font-inter)',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: '8px',
          }}
        >
          Category Name
        </label>
        <input
          type="text"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="e.g. Travel, Pets..."
          autoFocus
          className="w-full rounded-xl py-3 px-4 text-sm focus:outline-none transition-all"
          style={{
            background: 'var(--surface-input)',
            border: '2px solid transparent',
            fontFamily: 'var(--font-inter)',
            color: 'var(--text-primary)',
          }}
          onFocus={e => {
            e.target.style.border = '2px solid var(--teal)';
          }}
          onBlur={e => {
            e.target.style.border = '2px solid transparent';
          }}
        />

        {editingId === 'new' && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <p
                style={{
                  fontFamily: 'var(--font-inter)',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Suggested for your Role
              </p>
              {suggestedCategories.filter(c => !allCategories.includes(c)).length > 1 && (
                <button
                  onClick={() => {
                    suggestedCategories
                      .filter(c => !allCategories.includes(c))
                      .forEach(sug => {
                        onAddSuggested({
                          name: sug,
                          icon: '🏷️',
                          color: '#14b8a6',
                          monthlyLimit: 0,
                        });
                      });
                  }}
                  className="text-[length:var(--fs-overline)] font-bold text-[var(--teal)] hover:underline"
                >
                  Add All
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedCategories
                .filter(c => !allCategories.includes(c))
                .map(sug => (
                  <button
                    key={sug}
                    onClick={() => onNameChange(sug)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--teal-dim)] text-[var(--teal)] border border-[var(--teal-glow)] hover:scale-105 transition-transform"
                  >
                    + {sug}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <label
          style={{
            fontFamily: 'var(--font-inter)',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: '8px',
          }}
        >
          Choose Emoji
        </label>
        <div className="flex flex-wrap gap-2">
          {EMOJI_OPTIONS.map(em => (
            <button
              key={em}
              onClick={() => onIconChange(em)}
              className="w-10 h-10 text-lg flex items-center justify-center rounded-xl transition-all"
              style={{
                background: icon === em ? 'var(--teal-dim)' : 'var(--surface-input)',
                border: icon === em ? '2px solid var(--teal)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          style={{
            fontFamily: 'var(--font-inter)',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: '8px',
          }}
        >
          Choose Color
        </label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map(col => (
            <button
              key={col}
              onClick={() => onColorChange(col)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-transform"
              style={{
                background: col,
                border: 'none',
                cursor: 'pointer',
                transform: color === col ? 'scale(1.15)' : 'scale(1)',
                boxShadow:
                  color === col
                    ? `0 0 0 2px var(--surface-card), 0 0 0 4px ${col}`
                    : 'none',
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <label
          style={{
            fontFamily: 'var(--font-inter)',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: '8px',
          }}
        >
          Monthly Spending Limit (Optional)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-bold">
            $
          </span>
          <input
            type="number"
            value={monthlyLimit}
            onChange={e => onMonthlyLimitChange(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl py-3 pl-8 pr-4 text-sm focus:outline-none transition-all"
            style={{
              background: 'var(--surface-input)',
              border: '2px solid transparent',
              fontFamily: 'var(--font-inter)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => {
              e.target.style.border = '2px solid var(--teal)';
            }}
            onBlur={e => {
              e.target.style.border = '2px solid transparent';
            }}
          />
        </div>
        <p className="text-[length:var(--fs-overline)] text-[var(--text-muted)] mt-2 italic">
          Leave empty for no limit. This helps SpendWise track your budget health.
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl font-semibold text-sm transition-colors"
          style={{
            background: '#f5f7fa',
            color: 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!name.trim()}
          className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50"
          style={{
            background: 'var(--teal)',
            border: 'none',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          {editingId === 'new' ? 'Add Category' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

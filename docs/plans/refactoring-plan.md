# SpendWise Refactoring & Full Coverage Test Plan

**Generated:** 2026-06-29  
**Scope:** All `.ts`/`.tsx` files in `src/` (398 files) + All E2E tests in `tests/e2e/` (5 files, 22 tests)

---

## Cycle
Each phase follows: **Analyze → Refactor → Recheck (lint+typecheck+test+build) → Fix issues → Recheck again**

---

## Priority Matrix

| Pri | Area | Effort |
|-----|------|--------|
| P0 | Security: `window.__SW_STORE` production leak, CSP, innerHTML, env vars | 30 min |
| P0 | Data: `mockData.ts` vs `categories.ts` 90% duplicate, npm audit vulns | 30 min |
| P1 | Structure: BankSyncView, CustomCategoriesModal split, merchant map consolidation | 4 hr |
| P1 | Code quality: 31 file-level eslint-disable removal, duplicate modals | 2 hr |
| P1 | Refactor: advisor.ts localAdvisor → 6 topic handlers | 1 hr |
| P2 | Remaining: cross-feature deps, React.memo, useCallback | 2 hr |
| P3 | **Full Playwright E2E coverage**: every feature, button, flow tested | 8-12 hr |
| P4 | Low-hanging: non-null assertion, filter/map, mock phones, style tag, dep bumps | 30 min |

---

## Phase 0 — Security & Critical Fixes (P0)

### P0-1: Guard `window.__SW_STORE` behind `import.meta.env.DEV`
**File:** `src/store/index.ts:441-443`

### P0-2: Delete `categories.ts` (90% duplicate of `mockData.ts`)
**Action:** Remove file, keep mockData.ts as canonical source.

### P0-3: Add Content Security Policy
**File:** `vite.config.ts` — Add CSP meta tag via `transformIndexHtml`.

### P0-4: Fix server-only env vars
**File:** `src/config/env.ts` — Remove `VITE_` prefix from `EXCHANGE_RATE_API_KEY`.

### P0-5: Replace innerHTML in TaxReport
**File:** `src/features/analytics/components/TaxReport.tsx` — Replace `win.document.write()` with safe DOM API.

### P0-6: npm audit fix
Run `npm audit fix` then `npm audit fix --force` for vite.

---

## Phase 1 — Structural Refactoring (P1)

### P1-1: Consolidate merchant category maps
**Files:** `common.ts` (440+ entries), `upi.ts` (130 entries), `ondc.ts`, `mockData.ts`
**Action:** Create `src/data/categoryMap.ts` with `inferCategory()` + single source of truth. Update all 4 parsers to import from it.

### P1-2: Split BankSyncView.tsx
**File:** `src/features/sync/BankSyncView.tsx` (634 lines)
**Extract:** SyncingOverlay, SyncResultReview, ONDCConnectView. Keep main file as thin orchestrator (~200 lines).

### P1-3: Split CustomCategoriesModal.tsx
**File:** `src/components/layout/CustomCategoriesModal.tsx` (568 lines)
**Extract:** CategoryListView, CategoryEditorView, CategoryReassignView. Main file becomes thin orchestrator (~180 lines).

### P1-4: Refactor localAdvisor in advisor.ts
**File:** `src/features/analytics/insights/advisor.ts` (648 lines)
**Action:** Extract 154-line if/else chain into 6 topic handler files in `topics/` dir.

### P1-5: Remove 31 file-level eslint-disable directives
**Files across:** `src/core/api/`, `src/utils/`, `src/features/`, `src/db/`, `src/hooks/`, `src/types/`
**Action:** Fix underlying `any` types, remove unused vars, remove blanket disables.

### P1-6: Delete duplicate sharedModals directory
**Action:** Delete `src/features/shared/components/sharedModals/` (5 files, 0 imports).

---

## Phase 2 — Remaining Quality Fixes (P2)

### P2-1: Inject cross-feature deps instead of direct imports
**5 TODO comments:**
- `DashboardView.tsx:5` — extract pages layer
- `ProfileView.tsx:22` — pass props
- `RecurringView.tsx:6` — pass props
- `SubscriptionManager.tsx:20` — pass mandateManager prop
- `SyncDashboard.tsx:24` — pass sharedWalletsData prop

### P2-2: Add React.memo + useCallback
**Memo targets:** ScoreGauge, LoanEligibilityCards, LevelProgress, NotifRow, SkeletonLoader
**Callback targets:** All inline handlers in BankSyncView (10+), CustomCategoriesModal inputs

---

## Phase 3 — Full Playwright E2E Coverage (P3)

Every feature, every button, every flow must have a Playwright test. Tests run against the real dev server with IndexedDB. Each test file covers one feature domain.

### P3-1: Audit existing tests for gaps
Read all 5 existing e2e files, map which buttons/flows are missing. The existing files:
- `01-onboarding-auth.spec.ts` — onboarding + auth
- `02-dashboard-transactions.spec.ts` — dashboard + transactions
- `03-budget-goals-analytics.spec.ts` — budget, goals, analytics
- `04-advanced-features.spec.ts` — advanced features
- `05-settings-gamification-pwa.spec.ts` — settings, gamification, PWA

For each, open the app, navigate through EVERY screen, note untested interactions.

### P3-2: Add missing tests per feature domain

#### Auth & Onboarding
- [ ] Login page renders (email/password fields, submit button)
- [ ] Login with invalid credentials shows error
- [ ] Family member setup completes
- [ ] Skip onboarding works
- [ ] Profile creation flow

#### Dashboard
- [ ] Balance display updates after adding transaction
- [ ] Empty state shows when no transactions
- [ ] Quick statistics cards render
- [ ] Each stat card is clickable (navigates to detail)
- [ ] Recent transactions list renders with correct data
- [ ] Scroll through transaction list
- [ ] Pull-to-refresh works (if implemented)

#### Transactions
- [ ] Add transaction form opens
- [ ] All input fields work (amount, category, merchant, date, description)
- [ ] Category dropdown has all categories
- [ ] Transaction type toggle (credit/debit)
- [ ] Form validation (negative amounts, empty fields)
- [ ] Quick add "magic input" parses text
- [ ] Voice input button exists
- [ ] Receipt scanner button exists
- [ ] Transaction list renders
- [ ] Transaction detail view opens
- [ ] Edit transaction works
- [ ] Delete transaction works (with confirmation)
- [ ] Search/filter transactions
- [ ] Export transactions button exists

#### Budget
- [ ] Budget page renders correctly
- [ ] Create budget form works
- [ ] Budget progress bars show correct percentages
- [ ] Edit budget limit
- [ ] Delete budget
- [ ] Budget alerts/notifications

#### Goals
- [ ] Goals page renders
- [ ] Create goal form works (name, target amount, deadline)
- [ ] Goal progress bar updates
- [ ] Edit goal
- [ ] Delete goal
- [ ] Mark goal as achieved

#### Analytics / Reports
- [ ] Reports page renders
- [ ] Spending chart renders (donut/bar)
- [ ] Category breakdown shows correct data
- [ ] Monthly trend chart
- [ ] Credit health view renders
- [ ] Tax report renders with inputs
- [ ] Tax comparison table updates when income changes
- [ ] Download PDF button works
- [ ] Share with CA button works
- [ ] Filter by date range

#### AI Features
- [ ] Advisor chat opens
- [ ] Send a question to advisor
- [ ] AI suggestions render
- [ ] Spending personality renders
- [ ] Proactive nudge shows

#### Gamification
- [ ] Gamification page renders
- [ ] Level/XP display updates
- [ ] Badges gallery renders
- [ ] Earned vs locked badges show correctly
- [ ] Quests panel renders
- [ ] Complete a quest
- [ ] Savings challenges render
- [ ] Social leaderboard renders

#### Settings
- [ ] Settings page renders
- [ ] Toggle dark mode
- [ ] Toggle privacy mode
- [ ] Currency selector works
- [ ] Export data button
- [ ] Import data button
- [ ] Reset data with confirmation
- [ ] Profile edit works
- [ ] Notification settings toggles

#### Navigation
- [ ] Bottom/tab navigation switches between all main views
- [ ] Back navigation works
- [ ] Deep links work (/?action=new, /?view=history)
- [ ] Quick add modal opens from any view

#### Edge Cases
- [ ] Empty state for every list (no transactions, no budgets, no goals)
- [ ] Error state for network failures (handled gracefully)
- [ ] Loading states show spinners/skeletons
- [ ] Long transaction lists handle overflow
- [ ] Special characters in merchant names
- [ ] Very large amounts (10M+)
- [ ] Zero amounts
- [ ] Concurrent operations

### P3-3: Run full E2E suite, fix all failures
Cycle: Run → Find failures → Diagnose → Fix code → Re-run → Repeat until all pass.

### P3-4: Verify no regressions
After all fixes: `npm run test` (unit) + `npm run test:e2e` (playwright) must pass 100%.

---

## Phase 4 — Low-Hanging Fruit (P4)

| Task | File | Fix |
|------|------|-----|
| Non-null assertion | `src/utils/recurringDetection.ts:39` | `?.` instead of `!` |
| `.filter().map()` → `.flatMap()` | `BadgeGallery.tsx:41` | Single pass |
| Hardcoded mock phone numbers | `BankSyncView.tsx`, `CreditHealthView.tsx` | Extract to constants |
| Inline `<style>` tag | `MasterMic.tsx:504-529` | CSS module |
| Outdated deps | `package.json` | `npm update` |

---

## Measurement & Success Criteria

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Lint errors | 0 | 0 | `npm run lint` |
| Type errors | 0 | 0 | `npm run typecheck` |
| Build | Passes | Passes | `npm run build` |
| Unit tests | 281 pass | 281+ pass | `npm run test` |
| E2E tests (existing) | 22 pass | 22+ pass | `npm run test:e2e` |
| E2E tests (new) | 0 | TBD (feature coverage) | Count by test file |
| npm vulnerabilities | 10 (5 high) | 0 high | `npm audit` |
| File-level eslint-disable | 14 files | 0 | `rg "eslint-disable" src/` |
| `innerHTML` in source | 2 | 0 | `rg "innerHTML" src/"` |
| Files >400 lines | 26 | <20 | Script |
| Feature coverage in E2E | Partial | 100% | Test matrix |

---

## Rollback Plan

Each phase is independently revertible via git:
1. `git checkout -- <affected-files>`
2. Record the failure
3. Skip to next phase

---

## Handoff Doc

Saved at `docs/handoff-2026-06-29.md` for session continuation.

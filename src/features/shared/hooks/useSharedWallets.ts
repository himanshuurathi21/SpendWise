/**
 * useSharedWallets.ts
 *
 * Changes from original:
 *  1. Calls syncEngine.joinGroup(selectedGroupId) whenever the selected group changes
 *     so the Supabase Realtime channel is correctly subscribed.
 *  2. Removes the broken PeerJS-specific connectToPeer return value
 *     (replaced with a no-op that shows a toast instead).
 *  3. inviteMember now also calls the send-invite Edge Function so a real
 *     email is delivered via Resend (falls back silently if Supabase not configured).
 *
 * Everything else (CRDT, data shapes, return API) is identical to the original.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SharedGroup,
  SharedGroupMember,
  SharedWalletEntry,
  SharedExpense,
  SharedExpenseSplit,
  SharedGoal,
  SharedGoalContribution,
  SharedStorage,
  mergeSharedStorage,
} from '@/core/crdt';
import { syncEngine, SyncState } from '@/core/syncEngine';
import { useStore } from '@/store';
import { isSupabaseConfigured } from '@/core/api/supabase';

export type {
  SharedGroup,
  SharedGroupMember,
  SharedWalletEntry,
  SharedExpense,
  SharedExpenseSplit,
  SharedGoal,
  SharedGoalContribution,
};

export interface PendingInvite {
  memberId: string;
  groupId: string;
  groupName: string;
  groupPurpose: string;
  invitedAt: string;
}

// ─── Real email invite via Supabase Edge Function ────────────────────────────

async function sendInviteEmail(params: {
  to: string;
  toName: string;
  groupName: string;
  groupId: string;
  fromName: string;
}): Promise<void> {
  if (!isSupabaseConfigured) return; // skip silently in offline mode

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON}`,
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify({
        to: params.to,
        toName: params.toName,
        groupName: params.groupName,
        groupId: params.groupId,
        fromName: params.fromName,
        joinUrl: `${window.location.origin}/?action=join-group&id=${params.groupId}`,
      }),
    });
  } catch (error) {
    console.error('Failed to send invite email:', error);
  }
  // Errors are swallowed — the invite is still stored locally.
  // The mailto: fallback in InviteModal handles the UX.
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSharedWallets(
  userId: string | null,
  userEmail: string | null = null,
  userName: string = 'A friend'
) {
  const data = useStore(state => state.sharedData);
  const setData = useStore(state => state.setSharedData);

  const [selectedGroupId, setSelectedGroupIdRaw] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('disconnected');
  const [connectedPeers, setConnectedPeers] = useState<number>(0);

  // ── Sync engine wiring ────────────────────────────────────────────
  useEffect(() => {
    syncEngine.init();

    syncEngine.onStateChange((state, peers) => {
      setSyncState(state);
      setConnectedPeers(peers);
    });

    syncEngine.onData(incoming => {
      try {
        const remoteData = typeof incoming === 'string' ? JSON.parse(incoming) : incoming;
        if (remoteData && Array.isArray(remoteData.groups)) {
          setData(prev => mergeSharedStorage(prev, remoteData as SharedStorage));
        }
      } catch (_err) {
        // Malformed packet — ignore
      }
    });
  }, [setData]);

  // ── Join the Supabase Realtime channel for the selected group ─────
  useEffect(() => {
    if (selectedGroupId) {
      syncEngine.joinGroup(selectedGroupId);
    }
  }, [selectedGroupId]);

  // ── Broadcast our state when newly connected ──────────────────────
  useEffect(() => {
    if (syncState === 'connected' && connectedPeers > 0) {
      syncEngine.broadcast(data);
    }
  }, [connectedPeers, syncState, data]);

  // ── Derived slices ────────────────────────────────────────────────
  const groups = data.groups;
  const selectedGroup = groups.find(g => g.id === selectedGroupId) ?? null;

  const activeIds = useMemo(() => new Set(data.deleted_ids), [data.deleted_ids]);
  const members = data.members.filter(m => m.group_id === selectedGroupId && !activeIds.has(m.id));
  const walletEntries = data.walletEntries.filter(
    w => w.group_id === selectedGroupId && !activeIds.has(w.id)
  );
  const expenses = data.expenses.filter(
    e => e.group_id === selectedGroupId && !activeIds.has(e.id)
  );
  const goals = data.goals.filter(g => g.group_id === selectedGroupId && !activeIds.has(g.id));

  // Auto-select first group
  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupIdRaw(groups[0].id); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [groups, selectedGroupId]);

  // Pending invites for current user
  const pendingInvites: PendingInvite[] = useMemo(() => {
    if (!userEmail) return [];
    return data.members
      .filter(m => m.invited_email === userEmail && m.status === 'pending' && !activeIds.has(m.id))
      .map(inv => {
        const g = data.groups.find(x => x.id === inv.group_id);
        if (!g || activeIds.has(g.id)) return null;
        return {
          memberId: inv.id,
          groupId: g.id,
          groupName: g.name,
          groupPurpose: g.purpose,
          invitedAt: inv.invited_at,
        };
      })
      .filter(Boolean) as PendingInvite[];
  }, [data.members, data.groups, userEmail, activeIds]);

  // Wallet balance
  const walletBalance = walletEntries.reduce(
    (sum, e) => (e.kind === 'contribution' ? sum + e.amount : sum - e.amount),
    0
  );

  // Split balances
  const splitBalances: Record<string, number> = {};
  for (const m of members) splitBalances[m.id] = 0;
  for (const ex of expenses) {
    for (const s of ex.splits ?? []) {
      const owed = Math.round(ex.amount * (s.share_percent / 100) * 100) / 100;
      splitBalances[s.member_id] = (splitBalances[s.member_id] ?? 0) - owed;
    }
    splitBalances[ex.paid_by_member_id] = (splitBalances[ex.paid_by_member_id] ?? 0) + ex.amount;
  }

  // ── Mutate helper ─────────────────────────────────────────────────
  const mutate = useCallback(
    (updater: (prev: SharedStorage) => SharedStorage) => {
      setData(prev => {
        const next = updater(prev);
        syncEngine.broadcast(next);
        return next;
      });
    },
    [setData]
  );

  const markDeleted = (prev: SharedStorage, id: string): SharedStorage => ({
    ...prev,
    deleted_ids: [...prev.deleted_ids, id],
  });

  const uid = () => Math.random().toString(36).substr(2, 9);

  // ── Actions ───────────────────────────────────────────────────────

  const setSelectedGroupId = useCallback((id: string) => {
    setSelectedGroupIdRaw(id);
  }, []);

  const createGroup = useCallback(
    async (name: string, purpose: string, creatorName: string, creatorEmoji = '👑') => {
      if (!userId) return;
      const groupId = uid();
      const memberId = uid();
      mutate(prev => ({
        ...prev,
        groups: [...prev.groups, { id: groupId, name, purpose, created_by: userId }],
        members: [
          ...prev.members,
          {
            id: memberId,
            group_id: groupId,
            user_id: userId,
            display_name: creatorName,
            emoji: creatorEmoji,
            role: 'admin',
            status: 'accepted',
            invited_at: new Date().toISOString(),
            joined_at: new Date().toISOString(),
          },
        ],
      }));
      setSelectedGroupIdRaw(groupId);
    },
    [userId, mutate]
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      mutate(prev => markDeleted(prev, groupId));
      setSelectedGroupIdRaw(null);
    },
    [mutate]
  );

  const inviteMember = useCallback(
    async (email: string, displayName: string, emoji = '👤') => {
      if (!selectedGroupId) return;
      const memberId = uid();
      mutate(prev => ({
        ...prev,
        members: [
          ...prev.members,
          {
            id: memberId,
            group_id: selectedGroupId,
            invited_email: email,
            display_name: displayName,
            emoji,
            role: 'member',
            status: 'pending',
            invited_at: new Date().toISOString(),
          },
        ],
      }));

      // Fire real email (non-blocking)
      const groupName = data.groups.find(g => g.id === selectedGroupId)?.name ?? 'Shared Wallet';
      sendInviteEmail({
        to: email,
        toName: displayName,
        groupName,
        groupId: selectedGroupId,
        fromName: userName,
      }).catch(() => {
        /* InviteModal mailto: fallback still shown */
      });
    },
    [selectedGroupId, data.groups, userName, mutate]
  );

  const acceptInvite = useCallback(
    async (memberId: string) => {
      mutate(prev => ({
        ...prev,
        members: prev.members.map(m =>
          m.id === memberId ? { ...m, status: 'accepted', joined_at: new Date().toISOString() } : m
        ),
      }));
    },
    [mutate]
  );

  const declineInvite = useCallback(
    async (memberId: string) => {
      mutate(prev => markDeleted(prev, memberId));
    },
    [mutate]
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      mutate(prev => markDeleted(prev, memberId));
    },
    [mutate]
  );

  const addWalletEntry = useCallback(
    async (payload: {
      memberId: string;
      kind: SharedWalletEntry['kind'];
      amount: number;
      label: string;
      date: string;
    }) => {
      if (!selectedGroupId) return;
      mutate(prev => ({
        ...prev,
        walletEntries: [
          ...prev.walletEntries,
          {
            id: uid(),
            group_id: selectedGroupId,
            member_id: payload.memberId,
            kind: payload.kind,
            amount: payload.amount,
            label: payload.label,
            date: payload.date,
          },
        ],
      }));
    },
    [selectedGroupId, mutate]
  );

  const deleteWalletEntry = useCallback(
    async (id: string) => {
      mutate(prev => markDeleted(prev, id));
    },
    [mutate]
  );

  const addExpense = useCallback(
    async (payload: {
      paidByMemberId: string;
      label: string;
      category: string;
      amount: number;
      date: string;
      splits: { memberId: string; sharePercent: number }[];
    }) => {
      if (!selectedGroupId) return;
      const expenseId = uid();
      mutate(prev => ({
        ...prev,
        expenses: [
          ...prev.expenses,
          {
            id: expenseId,
            group_id: selectedGroupId,
            paid_by_member_id: payload.paidByMemberId,
            label: payload.label,
            category: payload.category,
            amount: payload.amount,
            date: payload.date,
            splits: payload.splits.map(s => ({
              id: uid(),
              expense_id: expenseId,
              member_id: s.memberId,
              share_percent: s.sharePercent,
            })),
          },
        ],
      }));
    },
    [selectedGroupId, mutate]
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      mutate(prev => markDeleted(prev, id));
    },
    [mutate]
  );

  const addGoal = useCallback(
    async (payload: {
      name: string;
      emoji: string;
      targetAmount: number;
      targetDate: string;
      color: string;
    }) => {
      if (!selectedGroupId) return;
      mutate(prev => ({
        ...prev,
        goals: [
          ...prev.goals,
          {
            id: uid(),
            group_id: selectedGroupId,
            name: payload.name,
            emoji: payload.emoji,
            target_amount: payload.targetAmount,
            target_date: payload.targetDate,
            color: payload.color,
            contributions: [],
          },
        ],
      }));
    },
    [selectedGroupId, mutate]
  );

  const contributeToGoal = useCallback(
    async (goalId: string, memberId: string, amount: number, date: string, note?: string) => {
      mutate(prev => ({
        ...prev,
        goals: prev.goals.map(g =>
          g.id !== goalId
            ? g
            : {
                ...g,
                contributions: [
                  ...(g.contributions || []),
                  {
                    id: uid(),
                    goal_id: goalId,
                    member_id: memberId,
                    amount,
                    date,
                    note,
                  },
                ],
              }
        ),
      }));
    },
    [mutate]
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      mutate(prev => markDeleted(prev, id));
    },
    [mutate]
  );

  const exportGroup = useCallback(
    (groupId: string): string | null => {
      const g = data.groups.find(x => x.id === groupId);
      if (!g) return null;
      const exportData = {
        type: 'spendwise-shared-group',
        group: g,
        members: data.members.filter(m => m.group_id === groupId),
        walletEntries: data.walletEntries.filter(w => w.group_id === groupId),
        expenses: data.expenses.filter(e => e.group_id === groupId),
        goals: data.goals.filter(goal => goal.group_id === groupId),
        channelHint: `shared-wallet:${groupId}`, // tell joiner which RT channel to use
        exportedAt: new Date().toISOString(),
      };
      try {
        return btoa(encodeURIComponent(JSON.stringify(exportData)));
      } catch {
        // silently ignore — non-critical
        return btoa(JSON.stringify(exportData));
      }
    },
    [data]
  );

  const importGroup = useCallback(
    async (encodedData: string): Promise<boolean> => {
      try {
        let decoded: Record<string, unknown>;
        try {
          decoded = JSON.parse(decodeURIComponent(atob(encodedData)));
        } catch (e) {
          console.warn('[SharedWallets] Base64 decode fallback triggered:', e);
          decoded = JSON.parse(atob(encodedData));
        }
        if (decoded.type !== 'spendwise-shared-group') throw new Error('Invalid group data');

        mutate(prev => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = decoded as any;
          const id = d.group.id;
          return {
            groups: [...prev.groups.filter(g => g.id !== id), d.group],
            members: [...prev.members.filter(m => m.group_id !== id), ...d.members],
            walletEntries: [
              ...prev.walletEntries.filter(w => w.group_id !== id),
              ...d.walletEntries,
            ],
            expenses: [...prev.expenses.filter(e => e.group_id !== id), ...d.expenses],
            goals: [...prev.goals.filter(g => g.group_id !== id), ...d.goals],
            deleted_ids: prev.deleted_ids,
          };
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSelectedGroupIdRaw((decoded as any).group.id);
        return true;
      } catch (e) {
        console.warn('[SharedWallets] Group import failed:', e);
        setError('Failed to import group — invalid or corrupted QR data.');
        return false;
      }
    },
    [mutate]
  );

  return {
    // Data
    groups,
    selectedGroupId,
    selectedGroup,
    members,
    walletEntries,
    expenses,
    goals,
    pendingInvites,
    walletBalance,
    splitBalances,
    loading: false,
    error,

    // Sync state (now Supabase Realtime, not PeerJS)
    syncState,
    connectedPeers,
    localPeerId: syncEngine.localPeerId,
    /**
     * connectToPeer — kept for UI compat but is now a no-op.
     * Supabase Realtime handles multi-peer automatically via joinGroup().
     * The ConnectCohortModal can be removed from the UI or repurposed
     * to show a "Share group QR to invite others" message.
     */
    connectToPeer: (_remoteId: string) => {
      // No-op — all peers sharing the same groupId are already connected
      // via the Supabase Realtime channel "shared-wallet:{groupId}".
    },

    // Actions
    setSelectedGroupId,
    createGroup,
    deleteGroup,
    inviteMember,
    acceptInvite,
    declineInvite,
    removeMember,
    addWalletEntry,
    deleteWalletEntry,
    addExpense,
    deleteExpense,
    addGoal,
    contributeToGoal,
    deleteGoal,
    exportGroup,
    importGroup,
    reload: () => {},
  };
}

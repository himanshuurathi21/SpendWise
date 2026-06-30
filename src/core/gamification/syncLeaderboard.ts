import { supabaseRequest, isSupabaseConfigured } from '@/core/api/supabase';

export interface LeaderboardStats {
  level: number;
  xp: number;
  streak: number;
  savingsRate: number;
}

export interface LeaderboardEntry {
  user_hash: string;
  display_name: string | null;
  level: number;
  xp: number;
  streak: number;
  savings_rate: number;
  city_tier: string;
}

export async function simpleHash(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str + 'spendwise_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

export async function syncLeaderboardStats(userId: string, stats: LeaderboardStats): Promise<void> {
  if (!isSupabaseConfigured) return;
  const userHash = await simpleHash(userId);
  await supabaseRequest('/leaderboard_snapshots', {
    method: 'POST',
    body: JSON.stringify({
      user_hash: userHash,
      level: stats.level,
      xp: stats.xp,
      streak: stats.streak,
      savings_rate: stats.savingsRate,
      updated_at: new Date().toISOString(),
    }),
    headers: { Prefer: 'resolution=merge-duplicates' },
  });
}

export async function fetchLeaderboard(cityTier = 'tier2'): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured) return [];
  const rows =
    (await supabaseRequest(
      `/leaderboard_snapshots?city_tier=eq.${cityTier}&order=xp.desc&limit=20`
    )) ?? [];
  return rows as unknown as LeaderboardEntry[];
}

export async function fetchFriendsLeaderboard(userHashes: string[]): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured || userHashes.length === 0) return [];
  const orClause = userHashes.map(h => `user_hash.eq.${h}`).join(',');
  const rows =
    (await supabaseRequest(`/leaderboard_snapshots?or=(${orClause})&order=xp.desc`)) ?? [];
  return rows as unknown as LeaderboardEntry[];
}

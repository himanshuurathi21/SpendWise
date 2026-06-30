/**
 * syncEngine.ts — Supabase Realtime P2P sync
 *
 * REPLACES the Trystero/MQTT WebRTC implementation entirely.
 *
 * ARCHITECTURE:
 *   • Each SpendWise client joins a Supabase Realtime channel named
 *     "group:{groupId}" when a group is selected.
 *   • Mutations are broadcast to all other clients in the same channel.
 *   • CRDT merge handles conflicts — same as before.
 *   • localPeerId is kept for backward compat.
 */

import { RealtimeClient } from '@supabase/realtime-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/config/env';

export type SyncState = 'disconnected' | 'connecting' | 'connected';

type DataCallback = (data: unknown) => void;
type StateCallback = (state: SyncState, peers: number) => void;

class SyncEngine {
  public localPeerId: string = '';
  private client: RealtimeClient | null = null;
  private channel: ReturnType<RealtimeClient['channel']> | null = null;
  private currentGroupId: string = '';
  private peers = new Set<string>();
  private localChannel: BroadcastChannel | null = null;

  private onDataCb: DataCallback | null = null;
  private onStateCb: StateCallback | null = null;

  constructor() {
    let id = localStorage.getItem('spendwise_peer_id');
    if (!id) {
      id = 'sw-' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('spendwise_peer_id', id);
    }
    this.localPeerId = id;
  }

  public init() {
    this.notifyState('disconnected');
  }

  public joinGroup(groupId: string) {
    if (!groupId) {
      this.leaveChannel();
      return;
    }

    if (groupId === this.currentGroupId && this.channel) return;

    this.leaveChannel();
    this.currentGroupId = groupId;
    this.notifyState('connecting');

    // ── Local Cross-Tab Sync via BroadcastChannel ──
    try {
      this.localChannel = new BroadcastChannel(`spendwise-local-sync-${groupId}`);
      this.localChannel.onmessage = event => {
        if (event.data?.senderId === this.localPeerId) return;
        if (this.onDataCb && event.data?.payload) {
          this.onDataCb(event.data.payload);
        }
      };
    } catch (e) {
      console.warn('[SyncEngine] BroadcastChannel failed (probably unsupported environment):', e);
    }

    // ── Supabase Realtime Channel ──
    try {
      const realtimeUrl = SUPABASE_URL.replace(/\/$/, '') + '/realtime/v1';
      this.client = new RealtimeClient(realtimeUrl, {
        params: { apikey: SUPABASE_ANON_KEY },
      });

      this.channel = this.client.channel(`group:${groupId}`, {
        config: { broadcast: { self: true } },
      });

      this.channel.on('broadcast', { event: 'mutation' }, ({ payload }: { payload: unknown }) => {
        if (this.onDataCb) this.onDataCb(payload);
      });

      this.channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          this.notifyState('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[SyncEngine] Realtime channel error:', status);
          this.notifyState('disconnected');
        }
      });
    } catch (e) {
      console.error('[SyncEngine] Failed to initialize Realtime channel:', e);
      this.notifyState('disconnected');
    }
  }

  public broadcast(data: unknown) {
    // 1. Broadcast globally via Supabase Realtime
    if (this.channel) {
      try {
        this.channel.send({
          type: 'broadcast',
          event: 'mutation',
          payload: data,
        });
      } catch (e) {
        console.warn('[SyncEngine] Realtime broadcast failed:', e);
      }
    }

    // 2. Broadcast locally to other tabs
    if (this.localChannel) {
      try {
        this.localChannel.postMessage({
          senderId: this.localPeerId,
          payload: data,
        });
      } catch (e) {
        console.warn('[SyncEngine] BroadcastChannel send failed:', e);
      }
    }
  }

  public connect(_remotePeerId: string) {
    console.warn('[SyncEngine] Manual connect not needed with Realtime channels');
  }

  public onData(cb: DataCallback) {
    this.onDataCb = cb;
  }

  public onStateChange(cb: StateCallback) {
    this.onStateCb = cb;
  }

  public get connectedPeers(): number {
    return this.peers.size;
  }

  private leaveChannel() {
    if (this.channel) {
      this.client?.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    if (this.localChannel) {
      this.localChannel.close();
      this.localChannel = null;
    }
    this.peers.clear();
    this.currentGroupId = '';
    this.notifyState('disconnected');
  }

  private notifyState(state: SyncState) {
    this.onStateCb?.(state, this.connectedPeers);
  }
}

export const syncEngine = new SyncEngine();

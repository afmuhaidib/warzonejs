// net/NetManager.js — "Play with friends" over WebRTC peer-to-peer (PeerJS).
//
// The game is a static site (no server), so we use PeerJS's free public broker
// for signaling ONLY; gameplay packets flow directly browser-to-browser. PeerJS
// is lazy-loaded from a CDN the first time someone opens the online lobby, so
// the zero-dependency single-player bundle is completely untouched.
//
// v1 = presence co-op: a short room code seeds the (deterministic) map so every
// peer generates the identical world, and each peer broadcasts its player state
// ~20 Hz so friends appear as live avatars. Each peer still simulates its own
// enemies locally (documented limitation — see TEMP_ISSUES_AND_MULTIPLAYER_PLAN).
//
// EVERYTHING here is opt-in: `game.net` exists always but `active` is false in
// single-player, and every hook in Game/MainMenu is a `game.net?.…` no-op then.
//
// Dependencies (only used when a networked match actually starts): world/Map,
// world/MapRenderer, world/Minimap, ai/Pathfinder, ai/FlowField.

import { RemotePlayer } from './RemotePlayer.js';
import { GameMap } from '../world/Map.js';
import { MapRenderer } from '../world/MapRenderer.js';
import { Minimap } from '../world/Minimap.js';
import { Pathfinder } from '../ai/Pathfinder.js';
import { FlowField } from '../ai/FlowField.js';

const PEERJS_CDN = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const ID_PREFIX  = 'wzjs-';                 // namespaces our codes on the public broker
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
const SEND_HZ    = 20;
const STALE_MS   = 6000;                    // drop a peer we haven't heard from

// PeerJS signaling server. The free public broker (0.peerjs.com) was shut down.
// Deploy peerserver/ to Render.com (free) and set this to your service URL.
// e.g. 'https://your-app.onrender.com'
const PEER_SERVER_URL = 'https://warzonejs-peer.onrender.com/peerjs';

function _parsePeerHost(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname.replace(/\/$/, '') || '/',
      secure: u.protocol === 'https:',
    };
  } catch {
    // fallback — let PeerJS use its own default (will likely fail, but shows a clear error)
    return {};
  }
}

let _peerLib = null;

/** Lazy-load the PeerJS UMD bundle (exposes window.Peer). */
function loadPeerJS() {
  if (_peerLib) return Promise.resolve(_peerLib);
  if (window.Peer) { _peerLib = window.Peer; return Promise.resolve(_peerLib); }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PEERJS_CDN;
    s.onload = () => {
      if (window.Peer) { _peerLib = window.Peer; resolve(_peerLib); }
      else reject(new Error('PeerJS failed to initialise'));
    };
    s.onerror = () => reject(new Error('Could not load PeerJS (offline?)'));
    document.head.appendChild(s);
  });
}

/** Deterministic 32-bit seed from a room code so all peers build the same map. */
function seedFromCode(code) {
  let h = 2166136261;
  const s = (code || '').toUpperCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1e9;
}

function randomCode() {
  let c = '';
  for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

export class NetManager {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.role = null;            // 'host' | 'client'
    this.relation = 'with';      // 'with' (co-op) | 'against' (pvp)
    this.status = 'idle';        // idle|loading|hosting|connecting|connected|ingame|error
    this.error = null;
    this.roomCode = null;
    this.mode = 'ffa';

    this.peer = null;
    this.conns = [];             // open DataConnections
    this.remotes = new Map();    // peerId -> RemotePlayer

    this._sendTimer = 0;
    this._matchStarted = false;
    this._pendingStart = null;   // start packet arriving before we're ready

    // Iterable list other systems can render/scan. Empty in single-player.
    game.remotePlayers = [];
  }

  get connected() { return this.conns.length > 0; }
  get teamLabel() { return this.relation === 'against' ? 'enemy' : 'player'; }

  // ─────────────────────────────────────────────────────────── lobby: host
  async host(relation = 'with') {
    this.role = 'host';
    this.relation = relation;
    this.status = 'loading';
    this.error = null;
    try {
      const Peer = await loadPeerJS();
      if (this.status !== 'loading') return; // aborted (user hit BACK) while awaiting
      this.roomCode = randomCode();
      this.peer = new Peer(ID_PREFIX + this.roomCode, _parsePeerHost(PEER_SERVER_URL));
      this._wirePeer();
      this.peer.on('open', () => { this.status = 'hosting'; });
      this.peer.on('connection', (conn) => this._addConn(conn));
    } catch (e) {
      this._fail(e);
    }
  }

  // ─────────────────────────────────────────────────────────── lobby: join
  async join(code, relation = 'with') {
    this.role = 'client';
    this.relation = relation;
    this.status = 'connecting';
    this.error = null;
    this.roomCode = (code || '').trim().toUpperCase();
    try {
      const Peer = await loadPeerJS();
      if (this.status !== 'connecting') return; // aborted while awaiting
      this.peer = new Peer(undefined, _parsePeerHost(PEER_SERVER_URL));
      this._wirePeer();
      this.peer.on('open', () => {
        // Reliable + ordered: the 'start' handshake must not be dropped. State
        // packets are tiny and 20 Hz, well within a reliable channel's budget.
        const conn = this.peer.connect(ID_PREFIX + this.roomCode, { reliable: true });
        this._addConn(conn);
      });
    } catch (e) {
      this._fail(e);
    }
  }

  _wirePeer() {
    this.peer.on('error', (e) => {
      // 'peer-unavailable' = bad/expired join code. 'unavailable-id' = room code
      // collision on the public broker (rare). Both are user-recoverable.
      const msg = e?.type === 'peer-unavailable' ? 'Room not found — check the code'
                : e?.type === 'unavailable-id'   ? 'Room code taken — try hosting again'
                : e?.type === 'server-error'     ? 'Signaling server unreachable — check PEER_SERVER_URL in NetManager.js'
                : e?.type === 'network'          ? 'Network error — check your connection'
                : (e?.type || e?.message || 'connection error');
      this._fail(new Error(msg));
    });
    this.peer.on('disconnected', () => { try { this.peer?.reconnect(); } catch { /* ignore */ } });
  }

  _addConn(conn) {
    conn.on('open', () => {
      this.conns.push(conn);
      this.status = this._matchStarted ? 'ingame' : 'connected';
      // Host tells a late joiner to start immediately if a match is already live.
      if (this.role === 'host' && this._matchStarted) this._sendStart(conn);
    });
    conn.on('data', (msg) => this._onData(conn, msg));
    conn.on('close', () => this._dropConn(conn));
    conn.on('error', () => this._dropConn(conn));
  }

  _dropConn(conn) {
    this.conns = this.conns.filter((c) => c !== conn);
    if (conn.peer && this.remotes.has(conn.peer)) {
      this.remotes.delete(conn.peer);
      this._syncRemoteList();
    }
    if (!this.connected && this.status !== 'ingame') this.status = this.role === 'host' ? 'hosting' : 'idle';
  }

  _fail(e) {
    this.error = e?.message || String(e);
    this.status = 'error';
    try { this.peer?.destroy(); } catch { /* ignore */ }
    this.peer = null;
  }

  // ───────────────────────────────────────────────────── match lifecycle
  /** Host only: derive the shared seed, tell peers, and start locally. */
  beginMatch(mode) {
    if (this.role !== 'host') return;
    this.mode = mode;
    const seed = seedFromCode(this.roomCode);
    this._matchStarted = true;
    this.active = true;
    this.status = 'ingame';
    for (const c of this.conns) this._sendStart(c);
    this._startLocal(seed, mode);
  }

  _sendStart(conn) {
    this._safeSend(conn, { t: 'start', seed: seedFromCode(this.roomCode), mode: this.mode, rel: this.relation });
  }

  _onData(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'start':
        // Client receives the go signal from the host.
        if (this.role === 'client' && !this._matchStarted) {
          this.relation = msg.rel || this.relation;
          this._matchStarted = true;
          this.active = true;
          this.status = 'ingame';
          this._startLocal(msg.seed, msg.mode);
        }
        break;
      case 'state': {
        let rp = this.remotes.get(conn.peer);
        if (!rp) {
          rp = new RemotePlayer(conn.peer, msg.n, this.teamLabel);
          this.remotes.set(conn.peer, rp);
          this._syncRemoteList();
        }
        rp.applyState(msg, performance.now());
        break;
      }
    }
  }

  _syncRemoteList() {
    this.game.remotePlayers = [...this.remotes.values()];
  }

  /** Rebuild the world from the shared seed, then start the chosen mode. */
  _startLocal(seed, mode) {
    const g = this.game;
    g.map = new GameMap(seed);
    g.camera.setBounds(g.map.worldWidth, g.map.worldHeight);
    g.mapRenderer = new MapRenderer(g.map, g.assets);
    g.minimap = new Minimap(g.map);
    g.ai.pathfinder = new Pathfinder(g.map);
    g.ai.flowField = new FlowField(g.map);
    // Use the default friendly squad count for online matches.
    g.multiplayerConfig = { type: 'online', relation: this.relation, coopFriendlies: null };
    // modes.start respawns the player on the new spawn and repopulates AI.
    g.modes.start(mode);
  }

  // ──────────────────────────────────────────────────────────── per-frame
  update(dt) {
    if (!this.active) return;

    // Advance remote avatars and prune the disconnected.
    const now = performance.now();
    let pruned = false;
    for (const [id, rp] of this.remotes) {
      rp.update(dt);
      if (now - rp.lastUpdate > STALE_MS) { this.remotes.delete(id); pruned = true; }
    }
    if (pruned) this._syncRemoteList();

    // Broadcast our own player state at a fixed rate.
    this._sendTimer -= dt;
    if (this._sendTimer <= 0 && this.connected) {
      this._sendTimer = 1 / SEND_HZ;
      this._broadcastSelf();
    }
  }

  _broadcastSelf() {
    const p = this.game.player;
    const fired = this.game.time - (p.lastShotTime ?? -99) < 1 / SEND_HZ + 0.02;
    const packet = {
      t: 'state',
      n: 'PLAYER',
      x: Math.round(p.pos.x), y: Math.round(p.pos.y),
      a: +p.angle.toFixed(2),
      h: Math.max(0, Math.round(p.health)), mh: p.maxHealth,
      al: p.alive, f: fired,
      w: this.game.weapons?.current?.shortName || 'AK',
    };
    for (const c of this.conns) this._safeSend(c, packet);
  }

  _safeSend(conn, obj) {
    try { if (conn && conn.open) conn.send(obj); } catch { /* peer mid-teardown */ }
  }

  draw(ctx) {
    if (!this.active) return;
    for (const rp of this.remotes.values()) rp.draw(ctx);
  }

  /** Tear everything down (leaving a match / returning to menu). */
  shutdown() {
    for (const c of this.conns) { try { c.close(); } catch { /* ignore */ } }
    try { this.peer?.destroy(); } catch { /* ignore */ }
    this.conns = [];
    this.remotes.clear();
    this.peer = null;
    this.active = false;
    this.role = null;
    this.status = 'idle';
    this._matchStarted = false;
    this.roomCode = null;
    this.game.remotePlayers = [];
  }
}

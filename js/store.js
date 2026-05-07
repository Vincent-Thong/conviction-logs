/**
 * store.js — Conviction Logs data layer
 * Backend: Supabase (Postgres + REST API)
 * No login or PAT required — works on any device instantly.
 */

const SUPABASE_URL = 'https://wurfkzoscmhiulizgwax.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cmZrem9zY21oaXVsaXpnd2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMjA4OTgsImV4cCI6MjA5MzY5Njg5OH0.e-UJytBdlLFCU9lMoYxAiRXgJZlFWZCqG3Y3n7WpJLs';

/* ── Supabase REST helper ─────────────────────────────────────── */
const db = (() => {
  const headers = {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  };

  async function request(method, table, body = null, params = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}${params}`;
    const res  = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`[Supabase] ${method} ${table} failed: ${err.message || res.status}`);
    }
    // 204 No Content has no body
    if (res.status === 204) return null;
    return res.json();
  }

  return {
    /** Fetch all rows, returns array of data objects */
    async getAll(table) {
      const rows = await request('GET', table, null, '?select=id,data,created_at&order=created_at.desc');
      return (rows || []).map(r => ({ id: r.id, createdAt: r.created_at, ...r.data }));
    },

    /** Upsert a single row (insert or update by id) */
    async upsert(table, id, data) {
      // Strip id and createdAt from data payload — they live as top-level columns
      const { id: _id, createdAt: _ca, ...payload } = data;
      await request('POST', table, { id, data: payload }, '');
      // On conflict (existing id) update instead
      // Supabase upsert via Prefer: resolution=merge-duplicates
      const upsertHeaders = { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' };
      const url = `${SUPABASE_URL}/rest/v1/${table}`;
      const res = await fetch(url, {
        method:  'POST',
        headers: upsertHeaders,
        body:    JSON.stringify({ id, data: payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`[Supabase] upsert ${table} failed: ${err.message || res.status}`);
      }
    },

    /** Delete a row by id */
    async remove(table, id) {
      await request('DELETE', table, null, `?id=eq.${encodeURIComponent(id)}`);
    },
  };
})();

/* ── In-memory state ─────────────────────────────────────────── */
let _state = { positions: [], entries: [], watchlist: [] };
const _id  = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/**
 * StoreInit — call once on every page load.
 * Fetches all data from Supabase → populates _state → calls onReady().
 */
async function StoreInit(onReady) {
  console.log('[Store] StoreInit — fetching from Supabase…');
  _setSyncDot('syncing');

  try {
    const [positions, entries, watchlist] = await Promise.all([
      db.getAll('positions'),
      db.getAll('entries'),
      db.getAll('watchlist'),
    ]);

    _state = { positions, entries, watchlist };

    console.log('[Store] Loaded:', {
      positions: positions.length,
      entries:   entries.length,
      watchlist: watchlist.length,
    });

    _setSyncDot('idle');
  } catch (err) {
    console.error('[Store] StoreInit failed:', err.message);
    _setSyncDot('error');
    _showError('Could not load data from Supabase. Check your connection.');
  }

  if (onReady) onReady();
}

/* ── Sync dot UI ─────────────────────────────────────────────── */
function _setSyncDot(state) {
  const dot = document.getElementById('sync-status-dot');
  if (!dot) return;
  dot.style.cursor = 'default';
  if      (state === 'syncing') { dot.style.background = '#c9a84c'; dot.title = 'Syncing…'; }
  else if (state === 'saved')   { dot.style.background = '#3ecf8e'; dot.title = 'Saved ✓'; setTimeout(() => _setSyncDot('idle'), 2000); }
  else if (state === 'error')   { dot.style.background = '#f06080'; dot.title = 'Sync error — check console'; }
  else                          { dot.style.background = '#3ecf8e'; dot.title = 'Connected to Supabase ✓'; }
}

function _showError(msg) {
  let b = document.getElementById('sync-error-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'sync-error-banner';
    b.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:#1e1010;border:1px solid #f06080;color:#f06080;border-radius:8px;padding:12px 18px;font-size:.8125rem;font-family:monospace;max-width:360px;line-height:1.5;box-shadow:0 4px 24px rgba(0,0,0,.5)';
    document.body.appendChild(b);
  }
  b.innerHTML = `⚠ ${msg} <button onclick="this.parentElement.remove()" style="float:right;background:none;border:none;color:inherit;cursor:pointer;font-size:1rem">✕</button>`;
  setTimeout(() => b?.remove(), 10000);
}

/* ── Public Store API ────────────────────────────────────────── */
const Store = {

  // ── Positions ──────────────────────────────────────────────
  getPositions() { return _state.positions; },

  async savePosition(pos) {
    _setSyncDot('syncing');
    const id   = pos.id || _id();
    const item = { ...pos, id };
    try {
      await db.upsert('positions', id, item);
      const idx = _state.positions.findIndex(p => p.id === id);
      if (idx >= 0) _state.positions[idx] = item;
      else _state.positions.unshift(item);
      _setSyncDot('saved');
    } catch (err) { console.error(err); _setSyncDot('error'); _showError(err.message); }
  },

  async deletePosition(id) {
    _setSyncDot('syncing');
    try {
      await db.remove('positions', id);
      _state.positions = _state.positions.filter(p => p.id !== id);
      _setSyncDot('saved');
    } catch (err) { console.error(err); _setSyncDot('error'); _showError(err.message); }
  },

  // ── Journal entries ────────────────────────────────────────
  getEntries() { return _state.entries; },

  async saveEntry(entry) {
    _setSyncDot('syncing');
    const id   = entry.id || _id();
    const item = { ...entry, id };
    try {
      await db.upsert('entries', id, item);
      const idx = _state.entries.findIndex(e => e.id === id);
      if (idx >= 0) _state.entries[idx] = item;
      else _state.entries.unshift(item);
      _setSyncDot('saved');
    } catch (err) { console.error(err); _setSyncDot('error'); _showError(err.message); }
  },

  async deleteEntry(id) {
    _setSyncDot('syncing');
    try {
      await db.remove('entries', id);
      _state.entries = _state.entries.filter(e => e.id !== id);
      _setSyncDot('saved');
    } catch (err) { console.error(err); _setSyncDot('error'); _showError(err.message); }
  },

  // ── Watchlist ──────────────────────────────────────────────
  getWatchlist() { return _state.watchlist; },

  async saveWatchItem(item) {
    _setSyncDot('syncing');
    const id   = item.id || _id();
    const w    = { ...item, id };
    try {
      await db.upsert('watchlist', id, w);
      const idx = _state.watchlist.findIndex(x => x.id === id);
      if (idx >= 0) _state.watchlist[idx] = w;
      else _state.watchlist.unshift(w);
      _setSyncDot('saved');
    } catch (err) { console.error(err); _setSyncDot('error'); _showError(err.message); }
  },

  async deleteWatchItem(id) {
    _setSyncDot('syncing');
    try {
      await db.remove('watchlist', id);
      _state.watchlist = _state.watchlist.filter(w => w.id !== id);
      _setSyncDot('saved');
    } catch (err) { console.error(err); _setSyncDot('error'); _showError(err.message); }
  },
};

/**
 * store.js — Conviction Logs data layer
 * Backend: Supabase (Postgres + REST API)
 * No login or PAT required — works on any device instantly.
 */

// Exposed on window so settings.html inline script can access them too
var SUPABASE_URL = 'https://wurfkzoscmhiulizgwax.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cmZrem9zY21oaXVsaXpnd2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMjA4OTgsImV4cCI6MjA5MzY5Njg5OH0.e-UJytBdlLFCU9lMoYxAiRXgJZlFWZCqG3Y3n7WpJLs';

/* ── Supabase REST helper ─────────────────────────────────────── */
var db = (function() {

  function getHeaders() {
    return {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    };
  }

  async function getAll(table) {
    var url = SUPABASE_URL + '/rest/v1/' + table + '?select=id,data,created_at&order=created_at.desc';
    var res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('getAll ' + table + ' failed: ' + res.status);
    var rows = await res.json();
    return rows.map(function(r) {
      return Object.assign({ id: r.id, createdAt: r.created_at }, r.data);
    });
  }

  async function upsert(table, id, data) {
    var payload = Object.assign({}, data);
    delete payload.id;
    delete payload.createdAt;

    var headers = getHeaders();
    headers['Prefer'] = 'resolution=merge-duplicates,return=minimal';

    var url = SUPABASE_URL + '/rest/v1/' + table;
    var res = await fetch(url, {
      method:  'POST',
      headers: headers,
      body:    JSON.stringify({ id: id, data: payload }),
    });
    if (!res.ok && res.status !== 204) {
      var err = await res.json().catch(function() { return {}; });
      throw new Error('upsert ' + table + ' failed: ' + (err.message || res.status));
    }
  }

  async function remove(table, id) {
    var url = SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id);
    var headers = getHeaders();
    headers['Prefer'] = 'return=minimal';
    var res = await fetch(url, { method: 'DELETE', headers: headers });
    if (!res.ok && res.status !== 204) {
      throw new Error('delete ' + table + ' failed: ' + res.status);
    }
  }

  return { getAll: getAll, upsert: upsert, remove: remove };

})();

/* ── In-memory state ─────────────────────────────────────────── */
var _state = { positions: [], entries: [], watchlist: [] };

function _newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ── StoreInit ───────────────────────────────────────────────── */
async function StoreInit(onReady) {
  console.log('[Store] StoreInit — fetching from Supabase…');
  _setSyncDot('syncing');

  try {
    var results = await Promise.all([
      db.getAll('positions'),
      db.getAll('entries'),
      db.getAll('watchlist'),
    ]);

    _state.positions = results[0];
    _state.entries   = results[1];
    _state.watchlist = results[2];

    console.log('[Store] Loaded:', {
      positions: _state.positions.length,
      entries:   _state.entries.length,
      watchlist: _state.watchlist.length,
    });

    _setSyncDot('idle');
  } catch (err) {
    console.error('[Store] StoreInit failed:', err.message);
    _setSyncDot('error');
    _showError('Could not load data: ' + err.message);
  }

  if (onReady) onReady();
}

/* ── Sync dot UI ─────────────────────────────────────────────── */
function _setSyncDot(state) {
  var dot = document.getElementById('sync-status-dot');
  if (!dot) return;
  dot.style.transition = 'background 0.3s ease';
  if (state === 'syncing') {
    dot.style.background = '#c9a84c';
    dot.title = 'Syncing…';
  } else if (state === 'saved') {
    dot.style.background = '#3ecf8e';
    dot.title = 'Saved ✓';
    setTimeout(function() { _setSyncDot('idle'); }, 2000);
  } else if (state === 'error') {
    dot.style.background = '#f06080';
    dot.title = 'Error — check console';
  } else {
    dot.style.background = '#3ecf8e';
    dot.title = 'Connected to Supabase ✓';
  }
}

function _showError(msg) {
  var b = document.getElementById('sync-error-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'sync-error-banner';
    b.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:#1e1010;border:1px solid #f06080;color:#f06080;border-radius:8px;padding:12px 18px;font-size:.8125rem;font-family:monospace;max-width:360px;line-height:1.5;box-shadow:0 4px 24px rgba(0,0,0,.5)';
    document.body.appendChild(b);
  }
  b.innerHTML = '⚠ ' + msg + ' <button onclick="this.parentElement.remove()" style="float:right;background:none;border:none;color:inherit;cursor:pointer;font-size:1rem">✕</button>';
  setTimeout(function() { if (b) b.remove(); }, 10000);
}

/* ── Public Store API ────────────────────────────────────────── */
var Store = {

  getPositions: function() { return _state.positions; },

  savePosition: async function(pos) {
    _setSyncDot('syncing');
    var id   = pos.id || _newId();
    var item = Object.assign({}, pos, { id: id });
    try {
      await db.upsert('positions', id, item);
      var idx = _state.positions.findIndex(function(p) { return p.id === id; });
      if (idx >= 0) _state.positions[idx] = item;
      else _state.positions.unshift(item);
      _setSyncDot('saved');
    } catch (err) { console.error(err); _setSyncDot('error'); _showError(err.message); }
  },

  deletePosition: async function(id) {
    _setSyncDot('syncing');
    try {
      await db.remove('positions', id);
      _state.positions = _state.positions.filter(function(p) { return p.id !== id; });
      _setSyncDot('saved');
    } catch (err) { console.error(err); _setSyncDot('error'); _showError(err.message); }
  },

  getEntries: function() { return _state.entries; },

  saveEntry: async function(entry) {
    _setSyncDot('syncing');
    var id   = entry.id || _newId();
    var item = Object.assign({}, entry, { id: id });
    try {
      await db.upsert('entries', id, item);
      var idx = _state.entries.findIndex(function(e) { return e.id === id; });
      if (idx >= 0) _state.entries[idx] = item;
      else _state.entries.unshift(item);
      _setSyncDot('saved');
    } catch (err) { console.error(err); _setSyncDot('error'); _showError(err.message); }
  },

  deleteEntry: async function(id) {
    _setSyncDot('syncing');
    try {
      await db.remove('entries', id);
      _state.entries = _state.entries.filter(function(e) { return e.id !== id; });
      _setSyncDot('saved');
    } catch (err) { console.error(err); _setSyncDot('error'); _showError(err.message); }
  },

  getWatchlist: function() { return _state.watchlist; },

  saveWatchItem: async function(item) {
    _setSyncDot('syncing');
    var id = item.id || _newId();
    var w  = Object.assign({}, item, { id: id });
    try {
      await db.upsert('watchlist', id, w);
      var idx = _state.watchlist.findIndex(function(x) { return x.id === id; });
      if (idx >= 0) _state.watchlist[idx] = w;
      else _state.watchlist.unshift(w);
      _setSyncDot('saved');
    } catch (err) { console.error(err); _setSyncDot('error'); _showError(err.message); }
  },

  deleteWatchItem: async function(id) {
    _setSyncDot('syncing');
    try {
      await db.remove('watchlist', id);
      _state.watchlist = _state.watchlist.filter(function(w) { return w.id !== id; });
      _setSyncDot('saved');
    } catch (err) { console.error(err); _setSyncDot('error'); _showError(err.message); }
  },
};

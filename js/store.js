/**
 * store.js — Conviction Logs data layer
 * Backend: Supabase (Postgres + REST API)
 */

var SUPABASE_URL = 'https://wurfkzoscmhiulizgwax.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cmZrem9zY21oaXVsaXpnd2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMjA4OTgsImV4cCI6MjA5MzY5Njg5OH0.e-UJytBdlLFCU9lMoYxAiRXgJZlFWZCqG3Y3n7WpJLs';

/* ── Profile cache ───────────────────────────────────────────── */
var _profiles = {}; // keyed by user_id → { display_name, avatar_url }

async function loadProfiles() {
  try {
    var res = await fetch(SUPABASE_URL + '/rest/v1/profiles?select=id,display_name,nickname,avatar_url', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
    });
    if (!res.ok) {
      console.warn('[Store] Failed to load profiles:', res.status);
      return;
    }
    var rows = await res.json();
    rows.forEach(function(r) {
      // Prefer nickname if set, fall back to display_name
      _profiles[r.id] = { displayName: r.nickname || r.display_name, avatarUrl: r.avatar_url };
    });
    console.log('[Store] Loaded', rows.length, 'profiles');
  } catch (e) {
    console.warn('[Store] Could not load profiles:', e.message);
  }
}

function getProfile(userId) {
  return _profiles[userId] || { displayName: 'Anonymous', avatarUrl: null };
}

// Expose _profiles globally for other modules
window._profiles = _profiles;

/* ── Supabase REST helper ─────────────────────────────────────── */
var db = (function() {

  function getHeaders(requireAuth) {
    var token = (requireAuth && typeof Auth !== 'undefined' && Auth.isLoggedIn())
      ? Auth.getAccessToken() : SUPABASE_KEY;
    return {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + token,
      'Content-Type':  'application/json',
    };
  }

  async function getAll(table) {
    var loggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn();
    var rows = [];

    if (loggedIn) {
      var userId = Auth.getUserId();
      // Own rows (all visibility)
      var r1 = await fetch(
        SUPABASE_URL + '/rest/v1/' + table +
        '?select=id,data,user_id,is_public,created_at,updated_at&user_id=eq.' + userId + '&order=created_at.desc',
        { headers: getHeaders(true) }
      );
      if (!r1.ok) throw new Error('getAll own ' + table + ' failed: ' + r1.status);
      var own = await r1.json();

      // Others' public rows
      var r2 = await fetch(
        SUPABASE_URL + '/rest/v1/' + table +
        '?select=id,data,user_id,is_public,created_at,updated_at&is_public=eq.true&user_id=neq.' + userId + '&order=created_at.desc',
        { headers: getHeaders(true) }
      );
      var others = r2.ok ? await r2.json() : [];
      rows = own.concat(others);
    } else {
      var r = await fetch(
        SUPABASE_URL + '/rest/v1/' + table +
        '?select=id,data,user_id,is_public,created_at,updated_at&is_public=eq.true&order=created_at.desc',
        { headers: getHeaders(false) }
      );
      if (!r.ok) throw new Error('getAll public ' + table + ' failed: ' + r.status);
      rows = await r.json();
    }

    return rows.map(function(r) {
      return Object.assign(
        { id: r.id, createdAt: r.created_at, updatedAt: r.updated_at, userId: r.user_id, isPublic: r.is_public },
        r.data
      );
    });
  }

  async function upsert(table, id, data) {
    if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) throw new Error('Must be logged in to save');
    var payload = Object.assign({}, data);
    delete payload.id; delete payload.createdAt; delete payload.updatedAt;
    delete payload.userId; delete payload.isPublic;

    var row = {
      id:         id,
      data:       payload,
      user_id:    Auth.getUserId(),
      is_public:  data.isPublic || false,
      updated_at: new Date().toISOString(),
    };

    var headers = getHeaders(true);
    headers['Prefer'] = 'resolution=merge-duplicates,return=minimal';
    var res = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
      method: 'POST', headers: headers, body: JSON.stringify(row),
    });
    if (!res.ok && res.status !== 204) {
      var err = await res.json().catch(function() { return {}; });
      throw new Error('upsert ' + table + ' failed: ' + (err.message || res.status));
    }
  }

  async function remove(table, id) {
    if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) throw new Error('Must be logged in to delete');
    var headers = getHeaders(true);
    headers['Prefer'] = 'return=minimal';
    var res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id), {
      method: 'DELETE', headers: headers,
    });
    if (!res.ok && res.status !== 204) throw new Error('delete ' + table + ' failed: ' + res.status);
  }

  return { getAll: getAll, upsert: upsert, remove: remove };
})();

/* ── In-memory state ─────────────────────────────────────────── */
var _state = { positions: [], entries: [], watchlist: [] };
function _newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ── StoreInit ───────────────────────────────────────────────── */
async function StoreInit(onReady) {
  console.log('[Store] StoreInit…');
  _setSyncDot('syncing');
  if (typeof Auth !== 'undefined') await Auth.init();
  if (typeof Follows !== 'undefined') await Follows.load();

  try {
    var results = await Promise.all([
      db.getAll('positions'),
      db.getAll('entries'),
      db.getAll('watchlist'),
      loadProfiles(),
    ]);
    _state.positions = results[0];
    _state.entries   = results[1];
    _state.watchlist = results[2];
    console.log('[Store] Loaded:', { positions: _state.positions.length, entries: _state.entries.length, watchlist: _state.watchlist.length });
    _setSyncDot('idle');
  } catch (err) {
    console.error('[Store] StoreInit failed:', err.message);
    _setSyncDot('error');
    _showError('Could not load data: ' + err.message);
  }

  if (onReady) onReady();
}

/* ── Sync dot ────────────────────────────────────────────────── */
function _setSyncDot(state) {
  var dot = document.getElementById('sync-status-dot');
  if (!dot) return;
  if      (state === 'syncing') { dot.style.background = '#c9a84c'; dot.title = 'Syncing…'; }
  else if (state === 'saved')   { dot.style.background = '#3ecf8e'; dot.title = 'Saved ✓'; setTimeout(function() { _setSyncDot('idle'); }, 2000); }
  else if (state === 'error')   { dot.style.background = '#f06080'; dot.title = 'Error'; }
  else                          { dot.style.background = '#3ecf8e'; dot.title = 'Connected ✓'; }
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
  setTimeout(function() { if (b && b.parentElement) b.remove(); }, 10000);
}

function _isOwner(item) {
  return typeof Auth !== 'undefined' && Auth.isLoggedIn() && item.userId === Auth.getUserId();
}

async function _persist(table, id, item) {
  localStorage.setItem('cl_data_cache_' + table, JSON.stringify(_state[table]));
  _setSyncDot('syncing');
  await db.upsert(table, id, item);
  _setSyncDot('saved');
}

/* ── Public Store API ────────────────────────────────────────── */
var Store = {

  getPositions:    function() { return _state.positions; },
  getMyPositions:  function() { return _state.positions.filter(function(p) { return _isOwner(p); }); },

  savePosition: async function(pos) {
    var id = pos.id || _newId();
    var item = Object.assign({}, pos, { id: id });
    try {
      await _persist('positions', id, item);
      var idx = _state.positions.findIndex(function(p) { return p.id === id; });
      if (idx >= 0) _state.positions[idx] = item; else _state.positions.unshift(item);
    } catch (e) { console.error(e); _setSyncDot('error'); _showError(e.message); }
  },

  deletePosition: async function(id) {
    try {
      await db.remove('positions', id);
      _state.positions = _state.positions.filter(function(p) { return p.id !== id; });
      _setSyncDot('saved');
    } catch (e) { console.error(e); _setSyncDot('error'); _showError(e.message); }
  },

  getEntries:   function() { return _state.entries; },
  getMyEntries: function() { return _state.entries.filter(function(e) { return _isOwner(e); }); },

  saveEntry: async function(entry) {
    var id = entry.id || _newId();
    var item = Object.assign({}, entry, { id: id });
    try {
      await _persist('entries', id, item);
      var idx = _state.entries.findIndex(function(e) { return e.id === id; });
      if (idx >= 0) _state.entries[idx] = item; else _state.entries.unshift(item);
    } catch (e) { console.error(e); _setSyncDot('error'); _showError(e.message); }
  },

  deleteEntry: async function(id) {
    try {
      await db.remove('entries', id);
      _state.entries = _state.entries.filter(function(e) { return e.id !== id; });
      _setSyncDot('saved');
    } catch (e) { console.error(e); _setSyncDot('error'); _showError(e.message); }
  },

  getWatchlist:   function() { return _state.watchlist; },
  getMyWatchlist: function() { return _state.watchlist.filter(function(w) { return _isOwner(w); }); },

  saveWatchItem: async function(item) {
    var id = item.id || _newId();
    var w = Object.assign({}, item, { id: id });
    try {
      await _persist('watchlist', id, w);
      var idx = _state.watchlist.findIndex(function(x) { return x.id === id; });
      if (idx >= 0) _state.watchlist[idx] = w; else _state.watchlist.unshift(w);
    } catch (e) { console.error(e); _setSyncDot('error'); _showError(e.message); }
  },

  deleteWatchItem: async function(id) {
    try {
      await db.remove('watchlist', id);
      _state.watchlist = _state.watchlist.filter(function(w) { return w.id !== id; });
      _setSyncDot('saved');
    } catch (e) { console.error(e); _setSyncDot('error'); _showError(e.message); }
  },

  isOwner:    _isOwner,
  getProfile: getProfile,
};

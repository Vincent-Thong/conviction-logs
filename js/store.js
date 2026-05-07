/**
 * store.js — Conviction Logs data layer
 * GitHub Contents API sync + localStorage cache fallback
 */

const GithubSync = (() => {
  const CONFIG_KEY = 'cl_github_config';
  const CACHE_KEY  = 'cl_data_cache';
  const DATA_PATH  = 'data/store.json';
  let _sha = null;

  const getConfig    = () => { try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || null; } catch { return null; } };
  const saveConfig   = (cfg) => localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  const isConfigured = () => { const c = getConfig(); return !!(c && c.pat && c.owner && c.repo); };
  const _apiUrl      = () => { const c = getConfig(); return `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${DATA_PATH}`; };
  const _headers     = () => { const c = getConfig(); return { 'Authorization': `token ${c.pat}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' }; };
  const _emptyData   = () => ({ positions: [], entries: [], watchlist: [] });
  const _fromCache   = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || _emptyData(); } catch { return _emptyData(); } };

  async function load() {
    if (!isConfigured()) return null;
    const c = getConfig();
    const url = _apiUrl() + (c.branch ? `?ref=${c.branch}` : '');
    try {
      const res = await fetch(url, { headers: _headers() });
      if (res.status === 404) { _sha = null; return _emptyData(); }
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const json = await res.json();
      _sha = json.sha;
      const data = JSON.parse(atob(json.content.replace(/\n/g, '')));
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      return data;
    } catch (err) {
      console.warn('[GithubSync] load failed, using cache:', err.message);
      return _fromCache();
    }
  }

  async function push(data) {
    if (!isConfigured()) return;
    const c       = getConfig();
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const body    = { message: `chore: sync store [${new Date().toISOString().slice(0,10)}]`, content, ...(c.branch ? { branch: c.branch } : {}), ...(_sha ? { sha: _sha } : {}) };
    try {
      const res = await fetch(_apiUrl(), { method: 'PUT', headers: _headers(), body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `status ${res.status}`); }
      const json = await res.json();
      _sha = json.content.sha;
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('[GithubSync] push failed:', err.message);
      _showSyncError(err.message);
    }
  }

  async function testConnection(cfg) {
    try {
      const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`, { headers: { 'Authorization': `token ${cfg.pat}`, 'Accept': 'application/vnd.github+json' } });
      if (res.status === 200) return { ok: true,  message: 'Connected successfully!' };
      if (res.status === 401) return { ok: false, message: 'Invalid PAT — check your token.' };
      if (res.status === 404) return { ok: false, message: 'Repo not found — check owner/repo name.' };
      return { ok: false, message: `Unexpected status ${res.status}` };
    } catch { return { ok: false, message: 'Network error.' }; }
  }

  function _showSyncError(msg) {
    let b = document.getElementById('sync-error-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'sync-error-banner';
      b.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:#1e1010;border:1px solid #f06080;color:#f06080;border-radius:8px;padding:12px 18px;font-size:.8125rem;font-family:monospace;max-width:360px;line-height:1.5;box-shadow:0 4px 24px rgba(0,0,0,.5)';
      document.body.appendChild(b);
    }
    b.innerHTML = `⚠ Sync failed: ${msg}<br><span style="color:#8a9ab0;font-size:.75rem">Data cached locally. Check Settings.</span><button onclick="this.parentElement.remove()" style="float:right;background:none;border:none;color:inherit;cursor:pointer;font-size:1rem">✕</button>`;
    setTimeout(() => b?.remove(), 10000);
  }

  return { load, push, getConfig, saveConfig, isConfigured, testConnection };
})();

/* ── In-memory state ─────────────────────────────────────────── */
let _state = { positions: [], entries: [], watchlist: [] };
const _id  = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function StoreInit(onReady) {
  _setSyncDot('syncing');
  if (GithubSync.isConfigured()) {
    const data = await GithubSync.load();
    if (data) _state = data;
  } else {
    try { const c = localStorage.getItem('cl_data_cache'); if (c) _state = JSON.parse(c); } catch {}
  }
  _setSyncDot('idle');
  if (onReady) onReady();
}

function _setSyncDot(state) {
  const dot = document.getElementById('sync-status-dot');
  if (!dot) return;
  const cfg = GithubSync.isConfigured();
  if      (state === 'syncing') { dot.title = 'Syncing…';             dot.style.background = '#c9a84c'; }
  else if (state === 'saved')   { dot.title = 'Saved to GitHub ✓';   dot.style.background = '#3ecf8e'; setTimeout(() => _setSyncDot('idle'), 2000); }
  else                          { dot.title = cfg ? 'Synced' : 'GitHub not configured — visit Settings'; dot.style.background = cfg ? '#4d5a6b' : '#f06080'; }
}

async function _persist() {
  localStorage.setItem('cl_data_cache', JSON.stringify(_state));
  _setSyncDot('syncing');
  await GithubSync.push(_state);
  _setSyncDot('saved');
}

/* ── Public API ──────────────────────────────────────────────── */
const Store = {
  getPositions()         { return _state.positions; },
  async savePosition(p)  { const a = _state.positions; const i = a.findIndex(x=>x.id===p.id); if(i>=0) a[i]=p; else _state.positions.unshift({...p,id:_id(),createdAt:Date.now()}); await _persist(); },
  async deletePosition(id){ _state.positions=_state.positions.filter(p=>p.id!==id); await _persist(); },

  getEntries()           { return _state.entries; },
  async saveEntry(e)     { const a = _state.entries; const i = a.findIndex(x=>x.id===e.id); if(i>=0) a[i]=e; else _state.entries.unshift({...e,id:_id(),createdAt:Date.now()}); await _persist(); },
  async deleteEntry(id)  { _state.entries=_state.entries.filter(e=>e.id!==id); await _persist(); },

  getWatchlist()         { return _state.watchlist; },
  async saveWatchItem(w) { const a = _state.watchlist; const i = a.findIndex(x=>x.id===w.id); if(i>=0) a[i]=w; else _state.watchlist.unshift({...w,id:_id(),createdAt:Date.now()}); await _persist(); },
  async deleteWatchItem(id){ _state.watchlist=_state.watchlist.filter(w=>w.id!==id); await _persist(); },
};

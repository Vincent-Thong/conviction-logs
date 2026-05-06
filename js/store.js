/**
 * store.js — Conviction Logs local data layer
 * Simple localStorage-backed store for portfolio, journal, watchlist.
 */

const Store = (() => {
  const KEYS = {
    positions:  'cl_positions',
    entries:    'cl_entries',
    watchlist:  'cl_watchlist',
  };

  const _get = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  };

  const _set = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  const _id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ── Positions ────────────────────────────────────────────
  const getPositions  = ()    => _get(KEYS.positions);
  const savePosition  = (pos) => {
    const all = getPositions();
    const idx = all.findIndex(p => p.id === pos.id);
    if (idx >= 0) all[idx] = pos; else all.unshift({ ...pos, id: _id(), createdAt: Date.now() });
    _set(KEYS.positions, all);
  };
  const deletePosition = (id) => _set(KEYS.positions, getPositions().filter(p => p.id !== id));

  // ── Journal entries ──────────────────────────────────────
  const getEntries   = ()      => _get(KEYS.entries);
  const saveEntry    = (entry) => {
    const all = getEntries();
    const idx = all.findIndex(e => e.id === entry.id);
    if (idx >= 0) all[idx] = entry; else all.unshift({ ...entry, id: _id(), createdAt: Date.now() });
    _set(KEYS.entries, all);
  };
  const deleteEntry  = (id)    => _set(KEYS.entries, getEntries().filter(e => e.id !== id));

  // ── Watchlist ────────────────────────────────────────────
  const getWatchlist   = ()     => _get(KEYS.watchlist);
  const saveWatchItem  = (item) => {
    const all = getWatchlist();
    const idx = all.findIndex(w => w.id === item.id);
    if (idx >= 0) all[idx] = item; else all.unshift({ ...item, id: _id(), createdAt: Date.now() });
    _set(KEYS.watchlist, all);
  };
  const deleteWatchItem = (id)  => _set(KEYS.watchlist, getWatchlist().filter(w => w.id !== id));

  return {
    getPositions, savePosition, deletePosition,
    getEntries, saveEntry, deleteEntry,
    getWatchlist, saveWatchItem, deleteWatchItem,
  };
})();

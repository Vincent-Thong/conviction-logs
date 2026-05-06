/**
 * dashboard.js
 */

// Hero date
const heroDate = document.getElementById('hero-date');
if (heroDate) {
  const now = new Date();
  heroDate.textContent = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// Stats
function refreshStats() {
  const positions  = Store.getPositions();
  const entries    = Store.getEntries();
  const watchlist  = Store.getWatchlist();

  const openPos    = positions.filter(p => p.status === 'open');
  const avgConv    = entries.length
    ? (entries.reduce((s, e) => s + (e.conviction || 0), 0) / entries.length).toFixed(1)
    : '—';

  document.getElementById('stat-positions').textContent  = openPos.length || 0;
  document.getElementById('stat-entries').textContent    = entries.length || 0;
  document.getElementById('stat-watchlist').textContent  = watchlist.length || 0;
  document.getElementById('stat-conviction').textContent = avgConv;
}

// Recent entries
function renderRecentEntries() {
  const container = document.getElementById('recent-entries');
  if (!container) return;

  const entries = Store.getEntries().slice(0, 5);

  if (!entries.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✦</div>
        <p class="empty-state-title">No entries yet</p>
        <p class="empty-state-text">Start documenting your investment thesis. Your future self will thank you.</p>
        <br/>
        <a href="journal.html" class="btn btn-primary">Write First Entry</a>
      </div>`;
    return;
  }

  container.innerHTML = entries.map(e => `
    <a class="entry-row" href="journal.html">
      <span class="entry-row-date">${formatDate(e.date)}</span>
      <span class="badge ${typeBadgeClass(e.type)}">${e.type || 'note'}</span>
      ${e.ticker ? exchangeBadge(e.exchange) : ''}
      <span class="entry-row-title">${escHtml(e.title)}</span>
      <span class="entry-row-excerpt">${escHtml((e.body || '').slice(0, 100))}</span>
    </a>
  `).join('');
}

// Watchlist snapshot
function renderWatchlistSnapshot() {
  const container = document.getElementById('watchlist-snapshot');
  if (!container) return;

  const items = Store.getWatchlist().slice(0, 6);

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">◎</div>
        <p class="empty-state-title">Watchlist is empty</p>
        <p class="empty-state-text">Add stocks you're monitoring to keep them front of mind.</p>
        <br/>
        <a href="watchlist.html" class="btn btn-ghost">Build Watchlist →</a>
      </div>`;
    return;
  }

  container.innerHTML = items.map(w => {
    const upside = w.price && w.target
      ? (((w.target - w.price) / w.price) * 100).toFixed(1)
      : null;
    const upsideHtml = upside !== null
      ? `<span class="watch-snap-ticker" style="font-size:0.7rem;color:${parseFloat(upside) >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${parseFloat(upside) >= 0 ? '+' : ''}${upside}% upside</span>`
      : '';
    return `
      <div class="watch-snap-card">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <span class="watch-snap-ticker">${escHtml(w.ticker)}</span>
          ${exchangeBadge(w.exchange)}
        </div>
        <div class="watch-snap-name">${escHtml(w.name)}</div>
        <div class="watch-snap-prices">
          <div>
            <span style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.1em">Current</span><br>
            <span style="font-family:var(--font-mono);font-size:0.875rem;color:var(--text-primary)">${w.price || '—'}</span>
          </div>
          <div style="text-align:right">
            <span style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.1em">Target</span><br>
            <span style="font-family:var(--font-mono);font-size:0.875rem;color:var(--gold)">${w.target || '—'}</span>
          </div>
        </div>
        ${upsideHtml}
      </div>`;
  }).join('');
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

refreshStats();
renderRecentEntries();
renderWatchlistSnapshot();

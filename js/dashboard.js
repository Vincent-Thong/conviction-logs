/* dashboard.js */
var heroDate = document.getElementById('hero-date');
if (heroDate) {
  heroDate.textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function refreshStats() {
  var loggedIn  = typeof Auth !== 'undefined' && Auth.isLoggedIn();
  var positions = loggedIn ? Store.getMyPositions() : Store.getPositions();
  var entries   = loggedIn ? Store.getMyEntries()   : Store.getEntries();
  var watchlist = loggedIn ? Store.getMyWatchlist() : Store.getWatchlist();
  var avgConv   = entries.length ? (entries.reduce(function(s,e){return s+(e.conviction||0);},0)/entries.length).toFixed(1) : '—';
  document.getElementById('stat-positions').textContent  = positions.filter(function(p){return p.status==='open';}).length;
  document.getElementById('stat-entries').textContent    = entries.length;
  document.getElementById('stat-watchlist').textContent  = watchlist.length;
  document.getElementById('stat-conviction').textContent = avgConv;

  // Show follow stats if logged in
  if (loggedIn && typeof Follows !== 'undefined') {
    var followStat = document.getElementById('stat-following');
    if (followStat) {
      followStat.querySelector('.stat-value').textContent = Follows.followingCount();
    }
  }
}

function renderRecentEntries() {
  var container = document.getElementById('recent-entries');
  if (!container) return;
  var loggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn();
  var entries  = (loggedIn ? Store.getMyEntries() : Store.getEntries()).slice(0,5);
  if (!entries.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✦</div><p class="empty-state-title">No entries yet</p><br/><a href="' + (loggedIn?'journal.html':'login.html') + '" class="btn btn-primary">' + (loggedIn?'Write First Entry':'Sign In to Write') + '</a></div>';
    return;
  }
  container.innerHTML = entries.map(function(e) {
    return '<a class="entry-row" href="journal.html?share=' + e.id + '">' +
      '<span class="entry-row-date">' + formatDate(e.date) + '</span>' +
      '<span class="badge ' + typeBadgeClass(e.type) + '">' + (e.type||'note') + '</span>' +
      (e.exchange ? exchangeBadge(e.exchange) : '') +
      (e.isPublic ? '<span style="font-size:.7rem">🌐</span>' : '<span style="font-size:.7rem">🔒</span>') +
      '<span class="entry-row-title">' + escHtml(e.title) + '</span>' +
      '<span class="entry-row-excerpt">' + escHtml((e.body||'').slice(0,100)) + '</span>' +
      '</a>';
  }).join('');
}

function renderFollowingFeed() {
  var container = document.getElementById('following-feed');
  if (!container) return;
  var loggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn();
  if (!loggedIn || typeof Follows === 'undefined') {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><p class="empty-state-title">Sign in to see your feed</p></div>';
    return;
  }
  var feed = Follows.getFollowingFeed(Store.getEntries()).slice(0,8);
  if (!feed.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><p class="empty-state-title">Your feed is empty</p><p class="empty-state-text">Follow other investors to see their public journal entries here.</p><br/><a href="journal.html" class="btn btn-ghost btn-sm">Browse Journal →</a></div>';
    return;
  }
  container.innerHTML = feed.map(function(e) {
    var profile = Store.getProfile(e.userId);
    var name    = profile.displayName || 'Anonymous';
    return '<a class="entry-row" href="journal.html?share=' + e.id + '">' +
      '<span class="entry-row-date">' + formatDate(e.date) + '</span>' +
      '<span class="badge ' + typeBadgeClass(e.type) + '">' + (e.type||'note') + '</span>' +
      (e.exchange ? exchangeBadge(e.exchange) : '') +
      '<span class="entry-row-title">' + escHtml(e.title) + '</span>' +
      '<span class="entry-row-excerpt" style="color:var(--gold);font-family:var(--font-mono);font-size:.7rem">' + escHtml(name) + '</span>' +
      '</a>';
  }).join('');
}

function renderWatchlistSnapshot() {
  var container = document.getElementById('watchlist-snapshot');
  if (!container) return;
  var loggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn();
  var items    = (loggedIn ? Store.getMyWatchlist() : Store.getWatchlist()).slice(0,6);
  if (!items.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">◎</div><p class="empty-state-title">Watchlist is empty</p><br/><a href="watchlist.html" class="btn btn-ghost">Build Watchlist →</a></div>';
    return;
  }
  container.innerHTML = items.map(function(w) {
    var upside = w.price && w.target ? (((w.target-w.price)/w.price)*100).toFixed(1) : null;
    return '<div class="watch-snap-card">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><span class="watch-snap-ticker">' + escHtml(w.ticker) + '</span>' + exchangeBadge(w.exchange) + '</div>' +
      '<div class="watch-snap-name">' + escHtml(w.name) + '</div>' +
      '<div class="watch-snap-prices">' +
        '<div><span style="font-family:var(--font-mono);font-size:.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.1em">Current</span><br><span style="font-family:var(--font-mono);font-size:.875rem;color:var(--text-primary)">' + (w.price||'—') + '</span></div>' +
        '<div style="text-align:right"><span style="font-family:var(--font-mono);font-size:.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.1em">Target</span><br><span style="font-family:var(--font-mono);font-size:.875rem;color:var(--gold)">' + (w.target||'—') + '</span></div>' +
      '</div>' +
      (upside!==null?'<span style="font-family:var(--font-mono);font-size:.7rem;color:'+(parseFloat(upside)>=0?'var(--green)':'var(--red)')+'">'+( parseFloat(upside)>=0?'+':'')+upside+'% upside</span>':'') +
      '</div>';
  }).join('');
}

StoreInit(function() {
  updateAuthNav();
  if (typeof Notifications !== 'undefined' && typeof Auth !== 'undefined' && Auth.isLoggedIn()) Notifications.load().then(function() { Notifications.startPolling(); });
  showLoginPromptIfNeeded('.page-wrapper .container');
  refreshStats();
  renderRecentEntries();
  renderFollowingFeed();
  renderWatchlistSnapshot();
});

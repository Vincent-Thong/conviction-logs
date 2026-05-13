/* watchlist.js */
var editingWatchId = null, filterMarket = 'all', searchTerm = '';
var watchVisToggle = null;
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function openAddWatch(id) {
  if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) { window.location.href = 'login.html'; return; }
  editingWatchId = id || null;
  ['watch-ticker','watch-name','watch-price','watch-target','watch-catalyst','watch-notes'].forEach(function(fid) { var el = document.getElementById(fid); if (el) el.value = ''; });
  document.getElementById('watch-exchange').value = 'HK';
  document.querySelectorAll('#watch-conviction-picker .cpip').forEach(function(b) { b.classList.remove('selected'); });
  document.getElementById('watch-modal-title').textContent = id ? 'Edit Watchlist Item' : 'Add to Watchlist';
  var initPublic = false;
  if (id) {
    var w = Store.getWatchlist().find(function(x) { return x.id === id; });
    if (w) {
      document.getElementById('watch-ticker').value   = w.ticker   || '';
      document.getElementById('watch-name').value     = w.name     || '';
      document.getElementById('watch-exchange').value = w.exchange || 'HK';
      document.getElementById('watch-price').value    = w.price    || '';
      document.getElementById('watch-target').value   = w.target   || '';
      document.getElementById('watch-catalyst').value = w.catalyst || '';
      document.getElementById('watch-notes').value    = w.notes    || '';
      setConvictionPicker('watch-conviction-picker', w.conviction);
      initPublic = w.isPublic || false;
    }
  }
  watchVisToggle = makeVisibilityToggle('watch-visibility', initPublic);
  document.getElementById('add-watch-modal').style.display = 'flex';
}

async function saveWatchItem() {
  var ticker = document.getElementById('watch-ticker').value.trim().toUpperCase();
  var name   = document.getElementById('watch-name').value.trim();
  if (!ticker) { alert('Ticker is required.');       return; }
  if (!name)   { alert('Company name is required.'); return; }
  var item = {
    id:         editingWatchId,
    ticker:     ticker,
    name:       name,
    exchange:   document.getElementById('watch-exchange').value,
    price:      parseFloat(document.getElementById('watch-price').value)  || null,
    target:     parseFloat(document.getElementById('watch-target').value) || null,
    catalyst:   document.getElementById('watch-catalyst').value.trim(),
    notes:      document.getElementById('watch-notes').value.trim(),
    conviction: getConvictionPicker('watch-conviction-picker'),
    isPublic:   watchVisToggle ? watchVisToggle.getValue() : false,
  };
  await Store.saveWatchItem(item);
  closeModal('add-watch-modal');
  render();
}

async function toggleWatchVisibility(id) {
  var w = Store.getWatchlist().find(function(x) { return x.id === id; });
  if (!w || !Store.isOwner(w)) return;
  await Store.saveWatchItem(Object.assign({}, w, { isPublic: !w.isPublic }));
  render();
}

async function deleteWatch(id) {
  if (!confirm('Remove from watchlist?')) return;
  await Store.deleteWatchItem(id);
  render();
}

function render() {
  var loggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn();
  var all   = Store.getWatchlist();
  var items = loggedIn ? all : all.filter(function(w) { return w.isPublic; });
  if (filterMarket !== 'all') items = items.filter(function(w) { return w.exchange === filterMarket; });
  if (searchTerm) {
    var q = searchTerm.toLowerCase();
    items = items.filter(function(w) { return (w.ticker||'').toLowerCase().includes(q) || (w.name||'').toLowerCase().includes(q); });
  }

  var grid = document.getElementById('watchlist-grid');
  if (!items.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">◎</div>' +
      '<p class="empty-state-title">' + (searchTerm ? 'No matching stocks' : loggedIn ? 'Watchlist is empty' : 'No public items yet') + '</p><br/>' +
      (loggedIn ? '<button class="btn btn-primary" onclick="openAddWatch()">Add First Stock</button>' : '<a href="login.html" class="btn btn-primary">Sign In to Add</a>') +
      '</div>';
    return;
  }

  grid.innerHTML = items.map(function(w) {
    var upside  = w.price && w.target ? (((w.target - w.price) / w.price) * 100).toFixed(1) : null;
    var uc      = upside !== null ? (parseFloat(upside) >= 0 ? 'var(--green)' : 'var(--red)') : '';
    var isOwn   = Store.isOwner(w);

    return '<div class="watch-card">' +
      '<div class="watch-card-top">' +
        '<div class="watch-card-ticker-block">' +
          '<span class="watch-card-ticker">' + escHtml(w.ticker) + '</span>' +
          '<span class="watch-card-name">'   + escHtml(w.name)   + '</span>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
          exchangeBadge(w.exchange) +
          (isOwn ? '<span class="mine-indicator">Mine</span>' : '') +
          (w.isPublic ? '<span style="font-size:.75rem" title="Public">🌐</span>' : '<span style="font-size:.75rem" title="Private">🔒</span>') +
        '</div>' +
      '</div>' +
      '<div class="watch-card-prices">' +
        '<div class="watch-price-item"><span class="watch-price-label">Current</span><span class="watch-price-value">' + (w.price  ?? '—') + '</span></div>' +
        '<div class="watch-price-item" style="text-align:right"><span class="watch-price-label">Target</span><span class="watch-price-value" style="color:var(--gold)">' + (w.target ?? '—') + '</span></div>' +
      '</div>' +
      (upside !== null ? '<span style="font-family:var(--font-mono);font-size:.75rem;color:' + uc + ';margin-bottom:10px;display:block">' + (parseFloat(upside) >= 0 ? '+' : '') + upside + '% upside</span>' : '') +
      (w.catalyst ? '<div class="watch-card-catalyst">💡 ' + escHtml(w.catalyst) + '</div>' : '') +
      '<div class="watch-card-footer">' +
        (w.conviction ? convictionBadge(w.conviction) : '<span></span>') +
      '</div>' +
      // Author block + owner actions
      authorBlock(w) +
      (isOwn
        ? '<div class="owner-actions" style="margin-top:8px">' +
            '<button class="owner-action-btn" onclick="toggleWatchVisibility(\'' + w.id + '\')">' + (w.isPublic ? '🔒 Make Private' : '🌐 Make Public') + '</button>' +
            '<button class="owner-action-btn" onclick="openAddWatch(\'' + w.id + '\')">Edit</button>' +
            '<button class="owner-action-btn danger" onclick="deleteWatch(\'' + w.id + '\')">Delete</button>' +
          '</div>'
        : '') +
      '</div>';
  }).join('');
}

document.querySelectorAll('#watch-conviction-picker .cpip').forEach(function(btn) {
  btn.addEventListener('click', function() { document.querySelectorAll('#watch-conviction-picker .cpip').forEach(function(b) { b.classList.remove('selected'); }); btn.classList.add('selected'); });
});
document.querySelectorAll('.filter-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); }); btn.classList.add('active'); filterMarket = btn.dataset.filter; render(); });
});
var searchEl = document.getElementById('watch-search');
if (searchEl) searchEl.addEventListener('input', function(e) { searchTerm = e.target.value; render(); });

StoreInit(function() {
  updateAuthNav();
  if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) showLoginPromptIfNeeded('.page-wrapper .container');
  render();
});

/* portfolio.js */
var editingId = null, filterStatus = 'all', filterMarket = null;
var visibilityToggle = null;
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function toggleClosePriceField() {
  var status = document.getElementById('pos-status').value;
  var closePriceGroup = document.getElementById('close-price-group');
  if (status === 'closed') {
    closePriceGroup.style.display = 'block';
  } else {
    closePriceGroup.style.display = 'none';
    document.getElementById('pos-close-price').value = '';
  }
}

function openAddPosition(id) {
  if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) { 
    sessionStorage.setItem('cl_return_url', window.location.href);
    window.location.href = 'login.html'; 
    return; 
  }
  editingId = id || null;
  ['pos-ticker','pos-name','pos-entry-date','pos-entry-price','pos-total-units','pos-target','pos-stop','pos-thesis','pos-close-price'].forEach(function(fid) { var el = document.getElementById(fid); if (el) el.value = ''; });
  document.getElementById('pos-exchange').value = 'HK';
  document.getElementById('pos-status').value   = 'open';
  document.querySelectorAll('#conviction-picker .cpip').forEach(function(b) { b.classList.remove('selected'); });
  var initPublic = false;
  if (id) {
    var pos = Store.getPositions().find(function(p) { return p.id === id; });
    if (pos) {
      document.getElementById('pos-ticker').value      = pos.ticker     || '';
      document.getElementById('pos-name').value        = pos.name       || '';
      document.getElementById('pos-entry-date').value  = pos.entryDate  || '';
      document.getElementById('pos-entry-price').value = pos.entryPrice || '';
      document.getElementById('pos-total-units').value = pos.totalUnits || '';
      document.getElementById('pos-target').value      = pos.target     || '';
      document.getElementById('pos-stop').value        = pos.stop       || '';
      document.getElementById('pos-thesis').value      = pos.thesis     || '';
      document.getElementById('pos-exchange').value    = pos.exchange   || 'HK';
      document.getElementById('pos-status').value      = pos.status     || 'open';
      document.getElementById('pos-close-price').value = pos.closePrice || '';
      setConvictionPicker('conviction-picker', pos.conviction);
      initPublic = pos.isPublic || false;
    }
  }
  visibilityToggle = makeVisibilityToggle('pos-visibility', initPublic);
  toggleClosePriceField();
  document.getElementById('add-position-modal').style.display = 'flex';
}

async function savePosition() {
  var ticker     = document.getElementById('pos-ticker').value.trim().toUpperCase();
  var entryPrice = parseFloat(document.getElementById('pos-entry-price').value);
  var totalUnits = parseFloat(document.getElementById('pos-total-units').value);
  var status     = document.getElementById('pos-status').value;
  var closePrice = parseFloat(document.getElementById('pos-close-price').value);
  if (!ticker)         { alert('Ticker is required.');       return; }
  if (isNaN(entryPrice)) { alert('Avg Entry Price is required.'); return; }
  if (isNaN(totalUnits)) { alert('Total Units is required.'); return; }
  if (status === 'closed' && isNaN(closePrice)) { alert('Close Price is required for closed positions.'); return; }
  
  // Calculate P&L automatically for closed positions
  var pnl = null;
  if (status === 'closed' && !isNaN(closePrice)) {
    pnl = Math.round((closePrice - entryPrice) * totalUnits * 100) / 100;
  }
  
  var pos = {
    id:         editingId,
    ticker:     ticker,
    name:       document.getElementById('pos-name').value.trim(),
    exchange:   document.getElementById('pos-exchange').value,
    entryDate:  document.getElementById('pos-entry-date').value,
    entryPrice: entryPrice,
    totalUnits: totalUnits,
    target:     parseFloat(document.getElementById('pos-target').value) || null,
    stop:       parseFloat(document.getElementById('pos-stop').value)   || null,
    thesis:     document.getElementById('pos-thesis').value.trim(),
    status:     status,
    conviction: getConvictionPicker('conviction-picker'),
    isPublic:   visibilityToggle ? visibilityToggle.getValue() : false,
    closePrice: status === 'closed' ? closePrice : null,
    pnl:        pnl
  };
  console.log('[portfolio.js] savePosition called with:', pos);
  try {
    await Store.savePosition(pos);
    console.log('[portfolio.js] savePosition completed');
  } catch (e) {
    console.error('[portfolio.js] savePosition error:', e);
    alert('Failed to save position: ' + e.message);
    return;
  }
  closeModal('add-position-modal');
  render();
}

async function togglePositionVisibility(id) {
  var p = Store.getPositions().find(function(x) { return x.id === id; });
  if (!p || !Store.isOwner(p)) return;
  await Store.savePosition(Object.assign({}, p, { isPublic: !p.isPublic }));
  render();
}

async function deletePos(id) {
  if (!confirm('Delete this position?')) return;
  await Store.deletePosition(id);
  render();
}

function render() {
  var loggedIn  = typeof Auth !== 'undefined' && Auth.isLoggedIn();
  var all       = Store.getPositions();
  var positions = loggedIn ? all : all.filter(function(p) { return p.isPublic; });
  if (filterStatus !== 'all') positions = positions.filter(function(p) { return p.status === filterStatus; });
  if (filterMarket)           positions = positions.filter(function(p) { return p.exchange === filterMarket; });

  var myAll   = loggedIn ? Store.getMyPositions() : [];
  var closed  = myAll.filter(function(p) { return p.status === 'closed'; });
  var wins    = closed.filter(function(p) { return p.pnlPct > 0; });
  document.getElementById('port-total').textContent   = myAll.length;
  document.getElementById('port-open').textContent    = myAll.filter(function(p) { return p.status === 'open'; }).length;
  document.getElementById('port-closed').textContent  = closed.length;
  document.getElementById('port-winrate').textContent = closed.length ? Math.round((wins.length / closed.length) * 100) + '%' : '—';

  var tbody = document.getElementById('portfolio-tbody');
  if (!positions.length) {
    tbody.innerHTML = '<tr><td colspan="14"><div class="empty-state"><div class="empty-state-icon">📊</div><p class="empty-state-title">No positions</p><p class="empty-state-text">' + (loggedIn ? 'Add your first position.' : 'No public positions yet.') + '</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = positions.map(function(p) {
    var isOwn   = Store.isOwner(p);
    var profile = Store.getProfile(p.userId);
    var name    = profile.displayName || 'Anonymous';
    var date    = p.updatedAt || p.createdAt;
    var dateStr = date ? new Date(date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '';

    // Format P&L with sign and 2 decimal places
    var pnlDisplay = '—';
    if (p.pnl != null) {
      var pnlSign = p.pnl >= 0 ? '+' : '';
      pnlDisplay = '<span class="' + (p.pnl >= 0 ? 'positive' : 'negative') + '" style="font-family:var(--font-mono)">' + pnlSign + p.pnl.toFixed(2) + '</span>';
    }

    return '<tr>' +
      '<td><span class="ticker">' + escHtml(p.ticker) + '</span>' + (p.name ? '<br><span class="ticker-full">' + escHtml(p.name) + '</span>' : '') + '</td>' +
      '<td>' + exchangeBadge(p.exchange) + '</td>' +
      '<td class="mono">' + formatDate(p.entryDate) + '</td>' +
      '<td class="mono">' + (p.entryPrice ?? '—') + '</td>' +
      '<td class="mono">' + (p.totalUnits ?? '—') + '</td>' +
      '<td class="mono" style="color:var(--gold)">'  + (p.target ?? '—') + '</td>' +
      '<td class="mono" style="color:var(--red)">'   + (p.stop   ?? '—') + '</td>' +
      '<td>' + convictionBadge(p.conviction) + '</td>' +
      '<td>' + (p.status === 'open' ? '<span class="badge badge-green">Open</span>' : '<span class="badge badge-neutral">Closed</span>') + '</td>' +
      '<td class="mono">' + (p.closePrice != null ? p.closePrice : '—') + '</td>' +
      '<td>' + pnlDisplay + '</td>' +
      '<td>' + (p.isPublic ? '<span title="Public">🌐</span>' : '<span title="Private">🔒</span>') + '</td>' +
      // Author + date
      '<td style="min-width:140px">' +
        '<span style="font-family:var(--font-mono);font-size:.7rem;color:var(--text-secondary);display:block">' + escHtml(name) + (isOwn ? ' <span class="mine-indicator">You</span>' : '') + '</span>' +
        (dateStr ? '<span style="font-family:var(--font-mono);font-size:.6rem;color:var(--text-muted)">' + dateStr + '</span>' : '') +
      '</td>' +
      // Actions
      '<td><div class="row-actions">' +
        (isOwn
          ? '<button class="row-action-btn" onclick="togglePositionVisibility(\'' + p.id + '\')" title="' + (p.isPublic ? 'Make Private' : 'Make Public') + '">' + (p.isPublic ? '🔒' : '🌐') + '</button>' +
            '<button class="row-action-btn" onclick="openAddPosition(\'' + p.id + '\')">Edit</button>' +
            '<button class="row-action-btn danger" onclick="deletePos(\'' + p.id + '\')">✕</button>'
          : '') +
      '</div></td>' +
      '</tr>';
  }).join('');
}

document.querySelectorAll('.filter-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    if (btn.dataset.filter !== undefined) {
      document.querySelectorAll('[data-filter]').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active'); filterStatus = btn.dataset.filter; filterMarket = null;
      document.querySelectorAll('[data-market]').forEach(function(b) { b.classList.remove('active'); });
    } else if (btn.dataset.market !== undefined) {
      var isActive = btn.classList.contains('active');
      document.querySelectorAll('[data-market]').forEach(function(b) { b.classList.remove('active'); });
      if (!isActive) { btn.classList.add('active'); filterMarket = btn.dataset.market; } else { filterMarket = null; }
    }
    render();
  });
});

document.querySelectorAll('#conviction-picker .cpip').forEach(function(btn) {
  btn.addEventListener('click', function() { document.querySelectorAll('#conviction-picker .cpip').forEach(function(b) { b.classList.remove('selected'); }); btn.classList.add('selected'); });
});

StoreInit(function() {
  updateAuthNav();
  if (typeof Notifications !== 'undefined' && typeof Auth !== 'undefined' && Auth.isLoggedIn()) Notifications.load().then(function() { Notifications.startPolling(); });
  if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) showLoginPromptIfNeeded('.page-wrapper .container');
  render();
});

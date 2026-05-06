/**
 * watchlist.js
 */

let editingWatchId = null;
let filterMarket   = 'all';
let searchTerm     = '';

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function openAddWatch(id) {
  editingWatchId = id || null;
  const title = document.getElementById('watch-modal-title');

  ['watch-ticker','watch-name','watch-price','watch-target','watch-catalyst','watch-notes']
    .forEach(fid => { const el = document.getElementById(fid); if (el) el.value = ''; });
  document.getElementById('watch-exchange').value = 'HK';
  document.querySelectorAll('#watch-conviction-picker .cpip').forEach(b => b.classList.remove('selected'));

  if (id) {
    const w = Store.getWatchlist().find(x => x.id === id);
    if (w) {
      title.textContent = 'Edit Watchlist Item';
      document.getElementById('watch-ticker').value   = w.ticker   || '';
      document.getElementById('watch-name').value     = w.name     || '';
      document.getElementById('watch-exchange').value = w.exchange || 'HK';
      document.getElementById('watch-price').value    = w.price    || '';
      document.getElementById('watch-target').value   = w.target   || '';
      document.getElementById('watch-catalyst').value = w.catalyst || '';
      document.getElementById('watch-notes').value    = w.notes    || '';
      setConvictionPicker('watch-conviction-picker', w.conviction);
    }
  } else {
    title.textContent = 'Add to Watchlist';
  }

  document.getElementById('add-watch-modal').style.display = 'flex';
}

function saveWatchItem() {
  const ticker = document.getElementById('watch-ticker').value.trim().toUpperCase();
  const name   = document.getElementById('watch-name').value.trim();

  if (!ticker) { alert('Ticker is required.'); return; }
  if (!name)   { alert('Company name is required.'); return; }

  const item = {
    id:         editingWatchId,
    ticker,
    name,
    exchange:   document.getElementById('watch-exchange').value,
    price:      parseFloat(document.getElementById('watch-price').value) || null,
    target:     parseFloat(document.getElementById('watch-target').value) || null,
    catalyst:   document.getElementById('watch-catalyst').value.trim(),
    notes:      document.getElementById('watch-notes').value.trim(),
    conviction: getConvictionPicker('watch-conviction-picker'),
  };

  Store.saveWatchItem(item);
  closeModal('add-watch-modal');
  render();
}

function render() {
  let items = Store.getWatchlist();

  if (filterMarket !== 'all') items = items.filter(w => w.exchange === filterMarket);
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    items = items.filter(w =>
      (w.ticker || '').toLowerCase().includes(q) ||
      (w.name   || '').toLowerCase().includes(q)
    );
  }

  const grid = document.getElementById('watchlist-grid');
  if (!items.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">◎</div>
        <p class="empty-state-title">${searchTerm ? 'No matching stocks' : 'Watchlist is empty'}</p>
        <p class="empty-state-text">Add stocks you're monitoring. Set a price target and note your catalyst.</p>
        <br/>
        <button class="btn btn-primary" onclick="openAddWatch()">Add First Stock</button>
      </div>`;
    return;
  }

  grid.innerHTML = items.map(w => {
    const upside = w.price && w.target
      ? (((w.target - w.price) / w.price) * 100).toFixed(1)
      : null;

    const upsideColor = upside !== null
      ? (parseFloat(upside) >= 0 ? 'var(--green)' : 'var(--red)')
      : '';

    return `
      <div class="watch-card">
        <div class="watch-card-top">
          <div class="watch-card-ticker-block">
            <span class="watch-card-ticker">${escHtml(w.ticker)}</span>
            <span class="watch-card-name">${escHtml(w.name)}</span>
          </div>
          ${exchangeBadge(w.exchange)}
        </div>

        <div class="watch-card-prices">
          <div class="watch-price-item">
            <span class="watch-price-label">Current</span>
            <span class="watch-price-value">${w.price ?? '—'}</span>
          </div>
          <div class="watch-price-item" style="text-align:right">
            <span class="watch-price-label">Target</span>
            <span class="watch-price-value" style="color:var(--gold)">${w.target ?? '—'}</span>
          </div>
        </div>

        ${upside !== null ? `<span class="watch-upside" style="color:${upsideColor};font-family:var(--font-mono);font-size:.75rem;margin-bottom:10px;display:block">${parseFloat(upside)>=0?'+':''}${upside}% upside</span>` : ''}

        ${w.catalyst ? `<div class="watch-card-catalyst">💡 ${escHtml(w.catalyst)}</div>` : ''}

        <div class="watch-card-footer">
          ${w.conviction ? convictionBadge(w.conviction) : '<span></span>'}
          <div class="watch-card-actions">
            <button class="row-action-btn" onclick="openAddWatch('${w.id}')">Edit</button>
            <button class="row-action-btn danger" onclick="deleteWatch('${w.id}')">✕</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function deleteWatch(id) {
  if (!confirm('Remove from watchlist?')) return;
  Store.deleteWatchItem(id);
  render();
}

// Conviction picker
document.querySelectorAll('#watch-conviction-picker .cpip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#watch-conviction-picker .cpip').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

// Filters
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterMarket = btn.dataset.filter;
    render();
  });
});

const searchEl = document.getElementById('watch-search');
if (searchEl) searchEl.addEventListener('input', e => { searchTerm = e.target.value; render(); });

render();

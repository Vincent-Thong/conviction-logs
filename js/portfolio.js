/**
 * portfolio.js
 */

let editingId   = null;
let convLevel   = null;
let filterStatus = 'all';
let filterMarket = null;

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Open / close modal ────────────────────────────────────────
function openAddPosition(id) {
  editingId  = id || null;
  convLevel  = null;

  // Reset fields
  ['pos-ticker','pos-name','pos-entry-date','pos-entry-price','pos-target','pos-stop','pos-thesis']
    .forEach(fid => { const el = document.getElementById(fid); if (el) el.value = ''; });
  document.getElementById('pos-exchange').value = 'HK';
  document.getElementById('pos-status').value   = 'open';
  document.querySelectorAll('#conviction-picker .cpip').forEach(b => b.classList.remove('selected'));

  if (id) {
    const pos = Store.getPositions().find(p => p.id === id);
    if (pos) {
      document.getElementById('pos-ticker').value       = pos.ticker || '';
      document.getElementById('pos-name').value         = pos.name   || '';
      document.getElementById('pos-entry-date').value   = pos.entryDate || '';
      document.getElementById('pos-entry-price').value  = pos.entryPrice || '';
      document.getElementById('pos-target').value       = pos.target || '';
      document.getElementById('pos-stop').value         = pos.stop   || '';
      document.getElementById('pos-thesis').value       = pos.thesis || '';
      document.getElementById('pos-exchange').value     = pos.exchange || 'HK';
      document.getElementById('pos-status').value       = pos.status || 'open';
      convLevel = pos.conviction || null;
      setConvictionPicker('conviction-picker', convLevel);
    }
  }

  document.getElementById('add-position-modal').style.display = 'flex';
}

function savePosition() {
  const ticker = document.getElementById('pos-ticker').value.trim().toUpperCase();
  if (!ticker) { alert('Ticker is required.'); return; }

  const entryPrice = parseFloat(document.getElementById('pos-entry-price').value);
  if (isNaN(entryPrice)) { alert('Entry price is required.'); return; }

  convLevel = getConvictionPicker('conviction-picker');

  const pos = {
    id:         editingId,
    ticker,
    name:       document.getElementById('pos-name').value.trim(),
    exchange:   document.getElementById('pos-exchange').value,
    entryDate:  document.getElementById('pos-entry-date').value,
    entryPrice,
    target:     parseFloat(document.getElementById('pos-target').value) || null,
    stop:       parseFloat(document.getElementById('pos-stop').value)   || null,
    thesis:     document.getElementById('pos-thesis').value.trim(),
    status:     document.getElementById('pos-status').value,
    conviction: convLevel,
  };

  Store.savePosition(pos);
  closeModal('add-position-modal');
  render();
}

// ── Render table ──────────────────────────────────────────────
function render() {
  let positions = Store.getPositions();

  if (filterStatus !== 'all') positions = positions.filter(p => p.status === filterStatus);
  if (filterMarket)           positions = positions.filter(p => p.exchange === filterMarket);

  const open   = Store.getPositions().filter(p => p.status === 'open').length;
  const closed = Store.getPositions().filter(p => p.status === 'closed').length;
  const wins   = Store.getPositions().filter(p => p.status === 'closed' && p.pnlPct > 0).length;
  const winRate = closed ? `${Math.round((wins / closed) * 100)}%` : '—';

  document.getElementById('port-total').textContent   = Store.getPositions().length;
  document.getElementById('port-open').textContent    = open;
  document.getElementById('port-closed').textContent  = closed;
  document.getElementById('port-winrate').textContent = winRate;

  const tbody = document.getElementById('portfolio-tbody');
  if (!positions.length) {
    tbody.innerHTML = `<tr><td colspan="10">
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p class="empty-state-title">No positions</p>
        <p class="empty-state-text">Add a position to get started.</p>
      </div></td></tr>`;
    return;
  }

  tbody.innerHTML = positions.map(p => {
    const statusBadge = p.status === 'open'
      ? `<span class="badge badge-green">Open</span>`
      : `<span class="badge badge-neutral">Closed</span>`;
    const pnl = p.pnlPct != null
      ? `<span class="${p.pnlPct >= 0 ? 'positive' : 'negative'}" style="font-family:var(--font-mono)">${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct}%</span>`
      : '—';
    return `<tr>
      <td>
        <span class="ticker">${escHtml(p.ticker)}</span>
        ${p.name ? `<br><span class="ticker-full">${escHtml(p.name)}</span>` : ''}
      </td>
      <td>${exchangeBadge(p.exchange)}</td>
      <td class="mono">${formatDate(p.entryDate)}</td>
      <td class="mono">${p.entryPrice ?? '—'}</td>
      <td class="mono" style="color:var(--gold)">${p.target ?? '—'}</td>
      <td class="mono" style="color:var(--red)">${p.stop ?? '—'}</td>
      <td>${convictionBadge(p.conviction)}</td>
      <td>${statusBadge}</td>
      <td>${pnl}</td>
      <td>
        <div class="row-actions">
          <button class="row-action-btn" onclick="openAddPosition('${p.id}')">Edit</button>
          <button class="row-action-btn danger" onclick="deletePos('${p.id}')">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function deletePos(id) {
  if (!confirm('Delete this position?')) return;
  Store.deletePosition(id);
  render();
}

// ── Filter buttons ────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.filter !== undefined) {
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterStatus = btn.dataset.filter;
      filterMarket = null;
      document.querySelectorAll('[data-market]').forEach(b => b.classList.remove('active'));
    } else if (btn.dataset.market !== undefined) {
      const isActive = btn.classList.contains('active');
      document.querySelectorAll('[data-market]').forEach(b => b.classList.remove('active'));
      if (!isActive) {
        btn.classList.add('active');
        filterMarket = btn.dataset.market;
      } else {
        filterMarket = null;
      }
    }
    render();
  });
});

// Init conviction picker
document.querySelectorAll('#conviction-picker .cpip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#conviction-picker .cpip').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    convLevel = parseInt(btn.dataset.val);
  });
});

render();

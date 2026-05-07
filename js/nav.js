/**
 * nav.js — shared navigation utilities
 */

// Set footer year
document.querySelectorAll('#footer-year').forEach(el => {
  el.textContent = new Date().getFullYear();
});

// Inject sync status dot + settings link into nav-actions
(function injectSyncDot() {
  const actions = document.querySelector('.nav-actions');
  if (!actions) return;

  // Sync dot
  const dot = document.createElement('span');
  dot.id    = 'sync-status-dot';
  dot.title = 'Checking GitHub sync…';
  dot.style.cssText = [
    'display:inline-block;width:8px;height:8px',
    'border-radius:50%;background:#c9a84c',
    'transition:background .4s ease;cursor:default',
    'margin-right:4px;flex-shrink:0',
  ].join(';');

  // Settings link
  const settingsLink = document.createElement('a');
  settingsLink.href      = 'settings.html';
  settingsLink.className = 'btn btn-ghost btn-sm';
  settingsLink.textContent = '⚙ Settings';

  actions.prepend(settingsLink);
  actions.prepend(dot);
})();

// Close modal helper
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.style.display = 'none';
  }
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => {
      m.style.display = 'none';
    });
  }
});

// Conviction picker shared init
function initConvictionPicker(pickerId, getValue, setValue) {
  const picker = document.getElementById(pickerId);
  if (!picker) return;
  picker.querySelectorAll('.cpip').forEach(btn => {
    btn.addEventListener('click', () => {
      picker.querySelectorAll('.cpip').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      setValue(parseInt(btn.dataset.val));
    });
  });
}

function setConvictionPicker(pickerId, val) {
  const picker = document.getElementById(pickerId);
  if (!picker) return;
  picker.querySelectorAll('.cpip').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.val) === val);
  });
}

function getConvictionPicker(pickerId) {
  const picker = document.getElementById(pickerId);
  if (!picker) return null;
  const sel = picker.querySelector('.cpip.selected');
  return sel ? parseInt(sel.dataset.val) : null;
}

// Helpers
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function convictionBadge(level) {
  if (!level) return '';
  const pips = Array.from({ length: 5 }, (_, i) =>
    `<div class="conviction-pip${i < level ? ' filled' : ''}"></div>`
  ).join('');
  return `<div class="conviction-bar">${pips}</div>`;
}

function exchangeBadge(exchange) {
  if (!exchange) return '';
  const cls = exchange === 'HK' ? 'badge-hk' : 'badge-us';
  return `<span class="badge ${cls}">${exchange}</span>`;
}

function typeBadgeClass(type) {
  const map = {
    thesis: 'badge-gold',
    review: 'badge-blue',
    macro:  'badge-neutral',
    earnings: 'badge-green',
    note:   'badge-neutral',
  };
  return map[type] || 'badge-neutral';
}

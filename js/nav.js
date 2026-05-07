/**
 * nav.js — shared navigation utilities
 */

// Set footer year
document.querySelectorAll('#footer-year').forEach(el => {
  el.textContent = new Date().getFullYear();
});

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
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
  }
});

// Conviction picker helpers
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

// Date formatter
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

// Badge helpers
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
  const map = { thesis:'badge-gold', review:'badge-blue', macro:'badge-neutral', earnings:'badge-green', note:'badge-neutral' };
  return map[type] || 'badge-neutral';
}

// ── Sync dot ──────────────────────────────────────────────────
// Rendered inline in each HTML page as #sync-status-dot.
// This function updates it based on GitHub config state.
function updateSyncDot() {
  const dot = document.getElementById('sync-status-dot');
  if (!dot) return;

  // GithubSync is defined in store.js which loads before nav.js
  const configured = typeof GithubSync !== 'undefined' && GithubSync.isConfigured();

  dot.style.cursor = 'pointer';
  dot.onclick = () => window.location = 'settings.html';

  if (configured) {
    dot.style.background = '#4d5a6b';
    dot.title = 'GitHub sync configured ✓ — click to manage';
  } else {
    dot.style.background = '#f06080';
    dot.title = 'GitHub not configured — click to set up';
  }
}

// Run after DOM + store.js are ready
document.addEventListener('DOMContentLoaded', updateSyncDot);

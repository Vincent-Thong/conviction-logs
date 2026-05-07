/**
 * nav.js — shared navigation utilities
 */

document.querySelectorAll('#footer-year').forEach(el => {
  el.textContent = new Date().getFullYear();
});

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) e.target.style.display = 'none';
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
});

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

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function convictionBadge(level) {
  if (!level) return '';
  return `<div class="conviction-bar">${Array.from({length:5},(_,i)=>`<div class="conviction-pip${i<level?' filled':''}"></div>`).join('')}</div>`;
}

function exchangeBadge(exchange) {
  if (!exchange) return '';
  return `<span class="badge ${exchange==='HK'?'badge-hk':'badge-us'}">${exchange}</span>`;
}

function typeBadgeClass(type) {
  return ({thesis:'badge-gold',review:'badge-blue',macro:'badge-neutral',earnings:'badge-green',note:'badge-neutral'})[type]||'badge-neutral';
}

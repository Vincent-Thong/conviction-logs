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

// ── Auth UI helpers ────────────────────────────────────────────
function updateAuthNav() {
  if (typeof Auth === 'undefined') return;
  updateNotifNav();
  var loginBtn   = document.getElementById('nav-login-btn');
  var userMenu   = document.getElementById('nav-user-menu');
  var userName   = document.getElementById('nav-user-name');
  var userAvatar = document.getElementById('nav-user-avatar');
  var userInit   = document.getElementById('nav-user-initials');

  if (Auth.isLoggedIn()) {
    if (loginBtn)   loginBtn.style.display  = 'none';
    if (userMenu)   userMenu.style.display  = 'flex';
    var name = Auth.getDisplayName() || 'Account';
    if (userName)   userName.textContent    = name;
    if (userInit)   userInit.textContent    = name.slice(0,2).toUpperCase();
    var avatar = Auth.getAvatar();
    if (userAvatar && avatar) {
      userAvatar.src           = avatar;
      userAvatar.style.display = 'block';
      if (userInit) userInit.style.display = 'none';
    }
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userMenu) userMenu.style.display = 'none';
  }
}

// ── Visibility toggle helper ───────────────────────────────────
function makeVisibilityToggle(containerId, initialValue) {
  var isPublic = initialValue || false;
  var container = document.getElementById(containerId);
  if (!container) return { getValue: function() { return isPublic; } };

  function render() {
    container.className = 'visibility-toggle' + (isPublic ? ' is-public' : '');
    container.innerHTML =
      '<span class="visibility-icon">' + (isPublic ? '🌐' : '🔒') + '</span>' +
      '<span class="visibility-label">' + (isPublic ? 'Public — visible to everyone' : 'Private — only you can see this') + '</span>' +
      '<span class="visibility-switch"></span>';
  }

  container.addEventListener('click', function() {
    isPublic = !isPublic;
    render();
  });

  render();
  return {
    getValue: function() { return isPublic; },
    setValue: function(v) { isPublic = v; render(); },
  };
}

// ── Author badge helper ────────────────────────────────────────
function authorBadge(item) {
  if (typeof Auth === 'undefined') return '';
  var isOwn = Auth.isLoggedIn() && item.userId === Auth.getUserId();
  if (isOwn) return '<span class="mine-indicator">Mine</span>';
  return '<span class="author-badge"><span class="author-badge-avatar">👤</span></span>';
}

// ── Login prompt (shown to logged-out users on edit pages) ─────
function showLoginPromptIfNeeded(containerSelector) {
  if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
    var container = document.querySelector(containerSelector);
    if (!container) return;
    var prompt = document.createElement('div');
    prompt.className = 'login-prompt';
    prompt.innerHTML =
      '<span class="login-prompt-text"><strong>Sign in</strong> to add your own entries and track your portfolio.</span>' +
      '<a href="login.html" class="btn btn-primary btn-sm">Sign In / Register</a>';
    container.insertBefore(prompt, container.firstChild);
  }
}

// ── Author card helper ─────────────────────────────────────────
// Renders full author + date block for public items
function authorBlock(item) {
  var profile  = Store.getProfile(item.userId);
  var name     = profile.displayName || 'Anonymous';
  var initials = name.slice(0, 2).toUpperCase();
  var avatar   = profile.avatarUrl;
  var date     = item.updatedAt || item.createdAt;
  var dateStr  = date ? formatDateTime(date) : '';
  var isOwn    = Store.isOwner(item);

  var avatarHtml = avatar
    ? '<img src="' + avatar + '" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:1px solid var(--border)" />'
    : '<span style="width:22px;height:22px;border-radius:50%;background:var(--gold-glow);border:1px solid var(--gold-dim);color:var(--gold);font-family:var(--font-mono);font-size:.5rem;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">' + initials + '</span>';

  return '<div class="author-block">' +
    avatarHtml +
    '<div class="author-block-info">' +
    '<span class="author-block-name">' + escHtmlNav(name) + (isOwn ? ' <span class="mine-indicator">You</span>' : '') + '</span>' +
    (dateStr ? '<span class="author-block-date">' + dateStr + '</span>' : '') +
    '</div>' +
    '</div>';
}

function escHtmlNav(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Owner action bar — shown on own public items so they can toggle or delete inline
function ownerActions(item, onToggle, onDelete) {
  if (!Store.isOwner(item)) return '';
  return '<div class="owner-actions">' +
    '<button class="owner-action-btn" onclick="' + onToggle + '" title="' + (item.isPublic ? 'Make Private' : 'Make Public') + '">' +
    (item.isPublic ? '🔒 Make Private' : '🌐 Make Public') +
    '</button>' +
    '<button class="owner-action-btn danger" onclick="' + onDelete + '" title="Delete">Delete</button>' +
    '</div>';
}

// ── Enhanced author block with follow button ─────────────────
function authorBlockWithFollow(item) {
  var profile  = Store.getProfile(item.userId);
  var name     = profile.displayName || 'Anonymous';
  var initials = name.slice(0,2).toUpperCase();
  var avatar   = profile.avatarUrl;
  var date     = item.updatedAt || item.createdAt;
  var dateStr  = date ? formatDateTime(date) : '';
  var isOwn    = Store.isOwner(item);

  var avatarHtml = avatar
    ? '<img src="' + avatar + '" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:1px solid var(--border)" />'
    : '<span style="width:22px;height:22px;border-radius:50%;background:var(--gold-glow);border:1px solid var(--gold-dim);color:var(--gold);font-family:var(--font-mono);font-size:.5rem;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">' + initials + '</span>';

  var followBtn = (typeof Follows !== 'undefined' && !isOwn)
    ? Follows.followButton(item.userId, null)
    : '';
  var msgBtn = (!isOwn && typeof Auth !== 'undefined' && Auth.isLoggedIn())
    ? '<a href="messages.html?user=' + item.userId + '" class="btn btn-ghost btn-sm" style="margin-left:4px">💬</a>'
    : '';

  return '<div class="author-block" onclick="event.stopPropagation()">' +
    avatarHtml +
    '<div class="author-block-info">' +
      '<span class="author-block-name">' + escHtmlNav(name) + (isOwn ? ' <span class="mine-indicator">You</span>' : '') + '</span>' +
      (dateStr ? '<span class="author-block-date">' + dateStr + '</span>' : '') +
    '</div>' +
    ((followBtn || msgBtn) ? '<div style="margin-left:auto;display:flex;gap:4px;align-items:center">' + followBtn + msgBtn + '</div>' : '') +
    '</div>';
}

// ── Notification + message nav buttons ────────────────────────
function updateNotifNav() {
  var msgBtn = document.getElementById('nav-msg-btn');
  if (msgBtn) msgBtn.style.display = Auth.isLoggedIn() ? 'inline-flex' : 'none';
}

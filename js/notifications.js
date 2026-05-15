/**
 * notifications.js — Notification inbox
 * Handles creating, loading, and displaying notifications.
 */

var Notifications = (function() {

  var _items    = [];
  var _unread   = 0;
  var _pollTimer = null;

  function _headers(auth) {
    return {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + (auth && Auth.isLoggedIn() ? Auth.getAccessToken() : SUPABASE_KEY),
      'Content-Type':  'application/json',
    };
  }

  function _newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ── Load notifications ──────────────────────────────────────
  async function load() {
    if (!Auth.isLoggedIn()) return;
    try {
      var res = await fetch(
        SUPABASE_URL + '/rest/v1/notifications?user_id=eq.' + Auth.getUserId() +
        '&select=*&order=created_at.desc&limit=50',
        { headers: _headers(true) }
      );
      if (!res.ok) return;
      _items  = await res.json();
      _unread = _items.filter(function(n) { return !n.is_read; }).length;
      _updateNavBadge();
    } catch (e) {
      console.warn('[Notifications] load error:', e.message);
    }
  }

  // ── Create a notification ───────────────────────────────────
  async function create(userId, type, actorId, refId, refType) {
    if (!userId || userId === actorId) return; // don't notify yourself
    try {
      var notif = {
        id:       _newId(),
        user_id:  userId,
        type:     type,
        actor_id: actorId,
        ref_id:   refId   || null,
        ref_type: refType || null,
        is_read:  false,
      };
      // Use anon key insert — RLS policy allows insert with check(true)
      await fetch(SUPABASE_URL + '/rest/v1/notifications', {
        method:  'POST',
        headers: Object.assign({}, _headers(true), { 'Prefer': 'return=minimal' }),
        body:    JSON.stringify(notif),
      });
    } catch (e) {
      console.warn('[Notifications] create error:', e.message);
    }
  }

  // ── Mark single notification read ──────────────────────────
  async function markRead(id) {
    if (!Auth.isLoggedIn()) return;
    await fetch(SUPABASE_URL + '/rest/v1/notifications?id=eq.' + id, {
      method:  'PATCH',
      headers: Object.assign({}, _headers(true), { 'Prefer': 'return=minimal' }),
      body:    JSON.stringify({ is_read: true }),
    });
    _items.forEach(function(n) { if (n.id === id) n.is_read = true; });
    _unread = Math.max(0, _unread - 1);
    _updateNavBadge();
  }

  // ── Mark all read ───────────────────────────────────────────
  async function markAllRead() {
    if (!Auth.isLoggedIn()) return;
    await fetch(
      SUPABASE_URL + '/rest/v1/notifications?user_id=eq.' + Auth.getUserId() + '&is_read=eq.false',
      {
        method:  'PATCH',
        headers: Object.assign({}, _headers(true), { 'Prefer': 'return=minimal' }),
        body:    JSON.stringify({ is_read: true }),
      }
    );
    _items.forEach(function(n) { n.is_read = true; });
    _unread = 0;
    _updateNavBadge();
    renderPage();
  }

  // ── Delete notification ─────────────────────────────────────
  async function dismiss(id) {
    await fetch(SUPABASE_URL + '/rest/v1/notifications?id=eq.' + id, {
      method:  'DELETE',
      headers: Object.assign({}, _headers(true), { 'Prefer': 'return=minimal' }),
    });
    _items = _items.filter(function(n) { return n.id !== id; });
    _unread = _items.filter(function(n) { return !n.is_read; }).length;
    _updateNavBadge();
    renderPage();
  }

  // ── Poll for new notifications every 30s ───────────────────
  function startPolling() {
    if (_pollTimer) return;
    _pollTimer = setInterval(function() {
      load().then(_updateNavBadge);
    }, 30000);
  }

  function stopPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  // ── Update nav bell badge ───────────────────────────────────
  function _updateNavBadge() {
    var btn   = document.getElementById('nav-notif-btn');
    var badge = document.getElementById('nav-notif-count');
    if (!btn) return;

    if (Auth.isLoggedIn()) {
      btn.style.display = 'inline-flex';
      if (_unread > 0) {
        badge.style.display  = 'inline-flex';
        badge.textContent    = _unread > 99 ? '99+' : _unread;
      } else {
        badge.style.display  = 'none';
      }
    } else {
      btn.style.display = 'none';
    }
  }

  // ── Render notifications page ───────────────────────────────
  function renderPage() {
    var list = document.getElementById('notif-list');
    if (!list) return;

    if (!Auth.isLoggedIn()) {
      list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔔</div><p class="empty-state-title">Sign in to view notifications</p><br/><a href="login.html" class="btn btn-primary">Sign In</a></div>';
      return;
    }

    if (!_items.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔔</div><p class="empty-state-title">No notifications yet</p><p class="empty-state-text">You\'ll be notified when someone follows you or sends you a message.</p></div>';
      return;
    }

    list.innerHTML = _items.map(function(n) {
      var profile = Store.getProfile(n.actor_id);
      var actor   = profile.displayName || 'Someone';
      var icon, text, href;

      if (n.type === 'follow') {
        icon = '👤'; text = '<strong>' + escHtml(actor) + '</strong> started following you.';
        href = 'journal.html';
      } else if (n.type === 'message') {
        icon = '💬'; text = '<strong>' + escHtml(actor) + '</strong> sent you a message.';
        href = 'messages.html';
      } else if (n.type === 'share') {
        icon = '🔗'; text = '<strong>' + escHtml(actor) + '</strong> shared a post with you.';
        href = n.ref_type === 'entry' ? 'journal.html?share=' + n.ref_id : 'watchlist.html?share=' + n.ref_id;
      } else {
        icon = '✦'; text = 'New notification from <strong>' + escHtml(actor) + '</strong>.';
        href = 'index.html';
      }

      var timeStr = n.created_at ? new Date(n.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '';

      return '<div class="notif-item ' + (n.is_read ? '' : 'unread') + '" onclick="Notifications.handleClick(\'' + n.id + '\',\'' + escHtml(href) + '\')">' +
        '<div class="notif-icon">' + icon + '</div>' +
        '<div class="notif-body">' +
          '<div class="notif-text">' + text + '</div>' +
          '<div class="notif-time">' + timeStr + '</div>' +
        '</div>' +
        '<button class="notif-dismiss" onclick="event.stopPropagation();Notifications.dismiss(\'' + n.id + '\')" title="Dismiss">✕</button>' +
        '</div>';
    }).join('');
  }

  function handleClick(id, href) {
    markRead(id);
    if (href) window.location.href = href;
  }

  function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function getUnread()  { return _unread; }
  function getItems()   { return _items; }

  return { load, create, markRead, markAllRead, dismiss, handleClick, renderPage, startPolling, stopPolling, getUnread, getItems };
})();

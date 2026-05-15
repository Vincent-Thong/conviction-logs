/**
 * messages.js — Private messaging system
 * Conversations, real-time polling, block/mute
 */

var Messages = (function() {

  var _conversations = []; // { userId, profile, lastMsg, unread }
  var _blocked       = []; // user_ids I've blocked
  var _blockedByMe   = []; // user_ids who blocked me
  var _activeUserId  = null;
  var _messages      = []; // current thread messages
  var _pollTimer     = null;

  function _headers() {
    return {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + Auth.getAccessToken(),
      'Content-Type':  'application/json',
    };
  }

  function _newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function fmtTime(d) {
    if (!d) return '';
    var dt = new Date(d);
    var now = new Date();
    var diff = now - dt;
    if (diff < 60000)      return 'Just now';
    if (diff < 3600000)    return Math.floor(diff/60000) + 'm ago';
    if (diff < 86400000)   return Math.floor(diff/3600000) + 'h ago';
    return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
  }

  // ── Load blocked list ───────────────────────────────────────
  async function loadBlocked() {
    var res = await fetch(
      SUPABASE_URL + '/rest/v1/blocked_users?blocker_id=eq.' + Auth.getUserId() + '&select=blocked_id',
      { headers: _headers() }
    );
    _blocked = res.ok ? (await res.json()).map(function(r) { return r.blocked_id; }) : [];

    var res2 = await fetch(
      SUPABASE_URL + '/rest/v1/blocked_users?blocked_id=eq.' + Auth.getUserId() + '&select=blocker_id',
      { headers: _headers() }
    );
    _blockedByMe = res2.ok ? (await res2.json()).map(function(r) { return r.blocker_id; }) : [];
  }

  function isBlocked(userId) {
    return _blocked.indexOf(userId) !== -1 || _blockedByMe.indexOf(userId) !== -1;
  }

  async function blockUser(userId) {
    var id = _newId();
    var h  = Object.assign({}, _headers(), { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
    await fetch(SUPABASE_URL + '/rest/v1/blocked_users', {
      method: 'POST', headers: h,
      body: JSON.stringify({ id: id, blocker_id: Auth.getUserId(), blocked_id: userId }),
    });
    if (_blocked.indexOf(userId) === -1) _blocked.push(userId);
    renderThread();
    renderConvList();
  }

  async function unblockUser(userId) {
    await fetch(
      SUPABASE_URL + '/rest/v1/blocked_users?blocker_id=eq.' + Auth.getUserId() + '&blocked_id=eq.' + userId,
      { method: 'DELETE', headers: _headers() }
    );
    _blocked = _blocked.filter(function(id) { return id !== userId; });
    renderThread();
    renderConvList();
  }

  // ── Load all messages involving me ──────────────────────────
  async function loadConversations() {
    var uid = Auth.getUserId();
    var res = await fetch(
      SUPABASE_URL + '/rest/v1/messages?or=(sender_id.eq.' + uid + ',receiver_id.eq.' + uid + ')&select=*&order=created_at.desc',
      { headers: _headers() }
    );
    if (!res.ok) return;
    var msgs = await res.json();

    // Group into conversations by other user
    var convMap = {};
    msgs.forEach(function(m) {
      var otherId = m.sender_id === uid ? m.receiver_id : m.sender_id;
      if (!convMap[otherId]) {
        convMap[otherId] = { userId: otherId, lastMsg: m, unread: 0 };
      }
      if (!m.is_read && m.receiver_id === uid) convMap[otherId].unread++;
    });

    _conversations = Object.values(convMap).sort(function(a, b) {
      return new Date(b.lastMsg.created_at) - new Date(a.lastMsg.created_at);
    });

    renderConvList();
  }

  // ── Load thread with a specific user ───────────────────────
  async function openConversation(userId) {
    _activeUserId = userId;
    var uid = Auth.getUserId();

    // Mark that thread's messages as read
    await fetch(
      SUPABASE_URL + '/rest/v1/messages?sender_id=eq.' + userId + '&receiver_id=eq.' + uid + '&is_read=eq.false',
      {
        method:  'PATCH',
        headers: Object.assign({}, _headers(), { 'Prefer': 'return=minimal' }),
        body:    JSON.stringify({ is_read: true }),
      }
    );

    // Fetch thread
    var res = await fetch(
      SUPABASE_URL + '/rest/v1/messages?or=(and(sender_id.eq.' + uid + ',receiver_id.eq.' + userId + '),and(sender_id.eq.' + userId + ',receiver_id.eq.' + uid + '))&select=*&order=created_at.asc',
      { headers: _headers() }
    );
    _messages = res.ok ? await res.json() : [];

    // Update conv list to clear unread
    _conversations.forEach(function(c) { if (c.userId === userId) c.unread = 0; });

    renderConvList();
    renderThread();
    startPolling();
  }

  // ── Send a message ──────────────────────────────────────────
  async function send(content) {
    if (!content.trim() || !_activeUserId) return;
    if (isBlocked(_activeUserId)) { alert('You cannot message this user.'); return; }

    var msg = {
      id:          _newId(),
      sender_id:   Auth.getUserId(),
      receiver_id: _activeUserId,
      content:     content.trim(),
      is_read:     false,
    };

    var h = Object.assign({}, _headers(), { 'Prefer': 'return=minimal' });
    var res = await fetch(SUPABASE_URL + '/rest/v1/messages', {
      method: 'POST', headers: h, body: JSON.stringify(msg),
    });

    if (res.ok || res.status === 204) {
      _messages.push(Object.assign({ created_at: new Date().toISOString() }, msg));
      renderThread();
      // Create notification for receiver
      await Notifications.create(_activeUserId, 'message', Auth.getUserId(), msg.id, 'message');
      // Update conv list
      await loadConversations();
    }
  }

  // ── Poll for new messages in active thread ──────────────────
  function startPolling() {
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = setInterval(async function() {
      if (!_activeUserId) return;
      var uid = Auth.getUserId();
      var lastTime = _messages.length ? _messages[_messages.length-1].created_at : new Date(0).toISOString();
      var res = await fetch(
        SUPABASE_URL + '/rest/v1/messages?or=(and(sender_id.eq.' + uid + ',receiver_id.eq.' + _activeUserId + '),and(sender_id.eq.' + _activeUserId + ',receiver_id.eq.' + uid + '))&created_at=gt.' + lastTime + '&select=*&order=created_at.asc',
        { headers: _headers() }
      );
      if (!res.ok) return;
      var newMsgs = await res.json();
      if (newMsgs.length) {
        _messages = _messages.concat(newMsgs);
        renderThread();
        // Mark incoming as read
        var incoming = newMsgs.filter(function(m) { return m.sender_id === _activeUserId; });
        if (incoming.length) {
          await fetch(
            SUPABASE_URL + '/rest/v1/messages?sender_id=eq.' + _activeUserId + '&receiver_id=eq.' + uid + '&is_read=eq.false',
            { method: 'PATCH', headers: Object.assign({}, _headers(), { 'Prefer': 'return=minimal' }), body: JSON.stringify({ is_read: true }) }
          );
        }
      }
    }, 5000); // poll every 5 seconds
  }

  // ── Search users to start new conversation ──────────────────
  async function searchUsers(query) {
    var results = document.getElementById('user-search-results');
    if (!results) return;
    if (!query.trim()) { results.innerHTML = ''; return; }

    var q = query.toLowerCase();
    var allProfiles = Object.entries(window._profiles || {})
      .filter(function(e) { return e[0] !== Auth.getUserId(); })
      .filter(function(e) {
        var p = e[1];
        return (p.displayName||'').toLowerCase().includes(q);
      });

    // Also search from Supabase profiles table
    var res = await fetch(
      SUPABASE_URL + '/rest/v1/profiles?or=(display_name.ilike.*' + encodeURIComponent(query) + '*,email.ilike.*' + encodeURIComponent(query) + '*)&select=id,display_name,avatar_url&limit=8',
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
    );
    var users = res.ok ? await res.json() : [];
    users = users.filter(function(u) { return u.id !== Auth.getUserId(); });

    if (!users.length) {
      results.innerHTML = '<p style="color:var(--text-muted);font-size:.8125rem;padding:8px">No users found</p>';
      return;
    }

    results.innerHTML = users.map(function(u) {
      var name     = u.display_name || 'Unknown';
      var initials = name.slice(0,2).toUpperCase();
      var avatar   = u.avatar_url
        ? '<img src="' + escHtml(u.avatar_url) + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover" />'
        : '<span style="width:32px;height:32px;border-radius:50%;background:var(--gold-glow);border:1px solid var(--gold-dim);color:var(--gold);font-family:var(--font-mono);font-size:.6rem;font-weight:600;display:inline-flex;align-items:center;justify-content:center">' + initials + '</span>';
      return '<div class="user-result-item" onclick="Messages.startChat(\'' + u.id + '\')">' +
        avatar +
        '<div>' +
          '<div style="font-size:.875rem;font-weight:500;color:var(--text-primary)">' + escHtml(name) + '</div>' +
          (u.email ? '<div style="font-size:.75rem;color:var(--text-muted)">' + escHtml(u.email) + '</div>' : '') +
        '</div>' +
        '</div>';
    }).join('');
  }

  async function startChat(userId) {
    closeModal('new-conv-modal');
    await openConversation(userId);
  }

  // ── Render conversation list ────────────────────────────────
  function renderConvList() {
    var container = document.getElementById('conv-items');
    if (!container) return;

    if (!_conversations.length) {
      container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:.8125rem">No conversations yet.<br/>Click + New to start one.</div>';
      return;
    }

    container.innerHTML = _conversations.map(function(conv) {
      var profile  = Store.getProfile(conv.userId);
      var name     = profile.displayName || 'Unknown';
      var initials = name.slice(0,2).toUpperCase();
      var avatar   = profile.avatarUrl
        ? '<div class="conv-avatar"><img src="' + escHtml(profile.avatarUrl) + '" /></div>'
        : '<div class="conv-avatar">' + initials + '</div>';
      var preview  = conv.lastMsg ? escHtml(conv.lastMsg.content.slice(0,40)) : '';
      var time     = conv.lastMsg ? fmtTime(conv.lastMsg.created_at) : '';
      var isActive = _activeUserId === conv.userId;
      var blocked  = isBlocked(conv.userId);

      return '<div class="conv-item ' + (isActive ? 'active' : '') + (conv.unread ? ' unread' : '') + '" onclick="Messages.openConversation(\'' + conv.userId + '\')">' +
        avatar +
        '<div class="conv-info">' +
          '<div class="conv-name">' + escHtml(name) + (blocked ? ' 🚫' : '') + '</div>' +
          '<div class="conv-preview">' + preview + '</div>' +
        '</div>' +
        '<div class="conv-meta">' +
          '<span class="conv-time">' + time + '</span>' +
          (conv.unread ? '<span class="conv-unread-dot"></span>' : '') +
        '</div>' +
        '</div>';
    }).join('');
  }

  // ── Render message thread ───────────────────────────────────
  function renderThread() {
    var empty  = document.getElementById('msg-thread-empty');
    var active = document.getElementById('msg-thread-active');
    var header = document.getElementById('msg-thread-header');
    var list   = document.getElementById('msg-list');
    if (!empty || !active) return;

    if (!_activeUserId) {
      empty.style.display  = 'flex';
      active.style.display = 'none';
      return;
    }

    empty.style.display  = 'none';
    active.style.display = 'flex';
    active.style.flexDirection = 'column';
    active.style.height = '100%';

    var profile  = Store.getProfile(_activeUserId);
    var name     = profile.displayName || 'Unknown';
    var initials = name.slice(0,2).toUpperCase();
    var blocked  = isBlocked(_activeUserId);
    var iBlockedThem = _blocked.indexOf(_activeUserId) !== -1;

    var avatar = profile.avatarUrl
      ? '<img src="' + escHtml(profile.avatarUrl) + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:1px solid var(--border)" />'
      : '<span style="width:32px;height:32px;border-radius:50%;background:var(--gold-glow);border:1px solid var(--gold-dim);color:var(--gold);font-family:var(--font-mono);font-size:.625rem;font-weight:600;display:inline-flex;align-items:center;justify-content:center">' + initials + '</span>';

    header.innerHTML =
      '<div class="msg-thread-header-user">' + avatar + '<span class="msg-thread-name">' + escHtml(name) + '</span></div>' +
      '<div class="msg-thread-actions">' +
        (iBlockedThem
          ? '<button class="btn btn-ghost btn-sm" onclick="Messages.unblockUser(\'' + _activeUserId + '\')">Unblock</button>'
          : '<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="Messages.blockUser(\'' + _activeUserId + '\')">Block</button>'
        ) +
      '</div>';

    if (blocked) {
      list.innerHTML = '<div class="blocked-banner">You cannot send or receive messages ' + (iBlockedThem ? 'with this user — you have blocked them.' : 'from this user — they have blocked you.') + '</div>';
    } else {
      var uid = Auth.getUserId();
      list.innerHTML = _messages.map(function(m) {
        var isMine = m.sender_id === uid;
        return '<div class="msg-bubble-row ' + (isMine ? 'mine' : 'theirs') + '">' +
          '<div class="msg-bubble-col">' +
            '<div class="msg-time">' + fmtTime(m.created_at) + '</div>' +
            '<div class="msg-bubble">' + escHtml(m.content) + '</div>' +
          '</div>' +
          '</div>';
      }).join('');
      // Scroll to bottom
      list.scrollTop = list.scrollHeight;
    }

    // Disable composer if blocked
    var input  = document.getElementById('msg-input');
    var sendBtn = document.querySelector('.msg-composer .btn');
    if (input)   input.disabled   = blocked;
    if (sendBtn) sendBtn.disabled = blocked;
  }

  return {
    load: async function() {
      await loadBlocked();
      await loadConversations();
    },
    openConversation,
    startChat,
    send,
    blockUser,
    unblockUser,
    searchUsers,
  };
})();

// ── Page init ──────────────────────────────────────────────────
function openNewConv() {
  document.getElementById('new-conv-modal').style.display = 'flex';
  setTimeout(function() { document.getElementById('new-conv-search').focus(); }, 100);
}

function searchUsers(val) { Messages.searchUsers(val); }

function sendMessage() {
  var input = document.getElementById('msg-input');
  if (!input || !input.value.trim()) return;
  Messages.send(input.value);
  input.value = '';
  input.style.height = 'auto';
}

function handleMsgKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  // Auto-grow textarea
  var ta = e.target;
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
}

StoreInit(async function() {
  updateAuthNav();
  if (!Auth.isLoggedIn()) {
    document.getElementById('messages-login-gate').style.display = 'block';
    return;
  }
  document.getElementById('messages-ui').style.display = 'grid';
  await Notifications.load();
  await Messages.load();

  // Check if opened with ?user= param (start chat directly)
  var params = new URLSearchParams(window.location.search);
  var targetUser = params.get('user');
  if (targetUser) {
    Messages.openConversation(targetUser);
    window.history.replaceState(null, '', 'messages.html');
  }

  Notifications.startPolling();
});

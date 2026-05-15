/**
 * follows.js — Follow/subscribe system
 * Shared across pages — load after store.js and auth.js
 */

var Follows = (function() {

  var _following = []; // list of user_ids the current user follows
  var _followers = []; // list of user_ids who follow the current user

  function _headers() {
    return {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + (Auth.isLoggedIn() ? Auth.getAccessToken() : SUPABASE_KEY),
      'Content-Type':  'application/json',
    };
  }

  async function load() {
    if (!Auth.isLoggedIn()) return;
    var uid = Auth.getUserId();
    try {
      // Who I follow
      var r1 = await fetch(SUPABASE_URL + '/rest/v1/follows?follower_id=eq.' + uid + '&select=following_id', { headers: _headers() });
      var rows1 = r1.ok ? await r1.json() : [];
      _following = rows1.map(function(r) { return r.following_id; });

      // Who follows me
      var r2 = await fetch(SUPABASE_URL + '/rest/v1/follows?following_id=eq.' + uid + '&select=follower_id', { headers: _headers() });
      var rows2 = r2.ok ? await r2.json() : [];
      _followers = rows2.map(function(r) { return r.follower_id; });

      console.log('[Follows] following:', _following.length, 'followers:', _followers.length);
    } catch (e) {
      console.warn('[Follows] load error:', e.message);
    }
  }

  function isFollowing(userId) {
    return _following.indexOf(userId) !== -1;
  }

  function followerCount() { return _followers.length; }
  function followingCount() { return _following.length; }
  function getFollowing()   { return _following; }
  function getFollowers()   { return _followers; }

  async function follow(userId) {
    if (!Auth.isLoggedIn()) { window.location.href = 'login.html'; return; }
    if (userId === Auth.getUserId()) return; // can't follow yourself
    var id  = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    var headers = _headers();
    headers['Prefer'] = 'resolution=merge-duplicates,return=minimal';
    var res = await fetch(SUPABASE_URL + '/rest/v1/follows', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ id: id, follower_id: Auth.getUserId(), following_id: userId }),
    });
    if (res.ok || res.status === 204) {
      if (_following.indexOf(userId) === -1) _following.push(userId);
      if (typeof Notifications !== 'undefined') Notifications.create(userId, 'follow', Auth.getUserId(), null, null);
    }
    return res.ok || res.status === 204;
  }

  async function unfollow(userId) {
    if (!Auth.isLoggedIn()) return;
    var res = await fetch(
      SUPABASE_URL + '/rest/v1/follows?follower_id=eq.' + Auth.getUserId() + '&following_id=eq.' + userId,
      { method: 'DELETE', headers: _headers() }
    );
    if (res.ok || res.status === 204) {
      _following = _following.filter(function(id) { return id !== userId; });
    }
    return res.ok || res.status === 204;
  }

  // Render a follow/unfollow button for a given userId
  function followButton(userId, onToggle) {
    if (!Auth.isLoggedIn()) return '<a href="login.html" class="btn btn-ghost btn-sm">Follow</a>';
    if (userId === Auth.getUserId()) return ''; // don't show for own profile
    var following = isFollowing(userId);
    return '<button class="btn ' + (following ? 'btn-ghost' : 'btn-primary') + ' btn-sm follow-btn" ' +
      'onclick="Follows.toggle(\'' + userId + '\', this)">' +
      (following ? 'Following' : '+ Follow') +
      '</button>';
  }

  async function toggle(userId, btn) {
    if (!btn) return;
    var wasFollowing = isFollowing(userId);
    btn.disabled = true;
    if (wasFollowing) {
      await unfollow(userId);
      btn.textContent = '+ Follow';
      btn.className   = 'btn btn-primary btn-sm follow-btn';
    } else {
      await follow(userId);
      btn.textContent = 'Following';
      btn.className   = 'btn btn-ghost btn-sm follow-btn';
    }
    btn.disabled = false;
  }

  // Get entries/positions/watchlist from users I follow (from _state)
  function getFollowingFeed(items) {
    if (!Auth.isLoggedIn()) return [];
    return items.filter(function(item) {
      return item.isPublic && _following.indexOf(item.userId) !== -1;
    });
  }

  return { load, isFollowing, follow, unfollow, toggle, followButton, followerCount, followingCount, getFollowing, getFollowers, getFollowingFeed };
})();

/**
 * auth.js — Supabase Auth layer
 * Handles sign in, sign up, OAuth, session management
 */

var Auth = (function() {

  var _session = null;
  var _user    = null;

  // ── Supabase Auth REST helpers ──────────────────────────────

  async function _authRequest(path, body) {
    var res = await fetch(SUPABASE_URL + '/auth/v1' + path, {
      method:  'POST',
      headers: {
        'apikey':       SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Auth error');
    return data;
  }

  async function _getUser(accessToken) {
    var res = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + accessToken,
      },
    });
    if (!res.ok) return null;
    return res.json();
  }

  // ── Session persistence ─────────────────────────────────────

  function _saveSession(session) {
    _session = session;
    _user    = session ? session.user : null;
    if (session) {
      localStorage.setItem('cl_session', JSON.stringify({
        access_token:  session.access_token,
        refresh_token: session.refresh_token,
        expires_at:    session.expires_at || (Date.now() / 1000 + (session.expires_in || 3600)),
        user:          session.user,
      }));
    } else {
      localStorage.removeItem('cl_session');
    }
    _updateNavUI();
  }

  async function _refreshSession(refreshToken) {
    try {
      var data = await _authRequest('/token?grant_type=refresh_token', { refresh_token: refreshToken });
      _saveSession(data);
      return data;
    } catch (e) {
      console.warn('[Auth] Refresh failed:', e.message);
      _saveSession(null);
      return null;
    }
  }

  // ── Init — restore session on page load ─────────────────────

  async function init() {
    // Check for OAuth callback (hash fragment)
    var hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      var params = new URLSearchParams(hash.replace('#', ''));
      var accessToken  = params.get('access_token');
      var refreshToken = params.get('refresh_token');
      var expiresIn    = parseInt(params.get('expires_in') || '3600');
      if (accessToken) {
        var user = await _getUser(accessToken);
        _saveSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
          expires_at:    Date.now() / 1000 + expiresIn,
          user:          user,
        });
        // Clean up URL
        window.history.replaceState(null, '', window.location.pathname);
        return _session;
      }
    }

    // Restore from localStorage
    try {
      var stored = JSON.parse(localStorage.getItem('cl_session'));
      if (stored && stored.access_token) {
        var now = Date.now() / 1000;
        if (stored.expires_at && stored.expires_at < now) {
          // Expired — try refresh
          if (stored.refresh_token) {
            await _refreshSession(stored.refresh_token);
          } else {
            _saveSession(null);
          }
        } else {
          _session = stored;
          _user    = stored.user;
          _updateNavUI();
        }
      }
    } catch (e) {
      console.warn('[Auth] Session restore error:', e.message);
    }

    return _session;
  }

  // ── Public methods ──────────────────────────────────────────

  async function signUp(email, password) {
    var data = await _authRequest('/signup', { email, password });
    if (data.access_token) _saveSession(data);
    return data;
  }

  async function signIn(email, password) {
    var data = await _authRequest('/token?grant_type=password', { email, password });
    _saveSession(data);
    return data;
  }

  async function signInWithOAuth(provider) {
    // Redirect to Supabase OAuth — it will redirect back with token in hash
    var redirectTo = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = SUPABASE_URL + '/auth/v1/authorize?provider=' + provider + '&redirect_to=' + redirectTo;
  }

  async function signOut() {
    try {
      if (_session) {
        await fetch(SUPABASE_URL + '/auth/v1/logout', {
          method:  'POST',
          headers: {
            'apikey':        SUPABASE_KEY,
            'Authorization': 'Bearer ' + _session.access_token,
          },
        });
      }
    } catch (e) { /* ignore */ }
    _saveSession(null);
    window.location.href = 'index.html';
  }

  function getUser()        { return _user; }
  function getSession()     { return _session; }
  function isLoggedIn()     { return !!(_session && _session.access_token); }
  function getAccessToken() { return _session ? _session.access_token : null; }
  function getUserId()      { return _user ? _user.id : null; }
  function getDisplayName() {
    if (!_user) return null;
    return _user.user_metadata && (_user.user_metadata.full_name || _user.user_metadata.name || _user.user_metadata.user_name)
      || _user.email.split('@')[0];
  }
  function getAvatar() {
    if (!_user) return null;
    return _user.user_metadata && (_user.user_metadata.avatar_url || _user.user_metadata.picture);
  }

  // ── Nav UI update ───────────────────────────────────────────

  function _updateNavUI() {
    var loginBtn  = document.getElementById('nav-login-btn');
    var userMenu  = document.getElementById('nav-user-menu');
    var userName  = document.getElementById('nav-user-name');
    var userAvatar = document.getElementById('nav-user-avatar');

    if (isLoggedIn()) {
      if (loginBtn)  loginBtn.style.display  = 'none';
      if (userMenu)  userMenu.style.display  = 'flex';
      if (userName)  userName.textContent    = getDisplayName() || 'Account';
      if (userAvatar && getAvatar()) {
        userAvatar.src = getAvatar();
        userAvatar.style.display = 'block';
      }
    } else {
      if (loginBtn) loginBtn.style.display  = 'inline-flex';
      if (userMenu) userMenu.style.display  = 'none';
    }
  }

  return {
    init, signUp, signIn, signInWithOAuth, signOut,
    getUser, getSession, isLoggedIn, getAccessToken,
    getUserId, getDisplayName, getAvatar,
  };
})();

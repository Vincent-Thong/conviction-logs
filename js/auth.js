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

  // ── Parse token from URL (hash or query string) ─────────────
  // Supabase can return tokens in either:
  //   #access_token=...  (implicit flow)
  //   ?access_token=...  (some providers)

  function _parseTokenFromURL() {
    var hash   = window.location.hash   || '';
    var search = window.location.search || '';

    // Try hash first (#access_token=...)
    if (hash.includes('access_token')) {
      return new URLSearchParams(hash.replace(/^#/, ''));
    }
    // Fall back to query string (?access_token=...)
    if (search.includes('access_token')) {
      return new URLSearchParams(search.replace(/^\?/, ''));
    }
    return null;
  }

  // ── Init — restore session on page load ─────────────────────

  async function init() {
    // Check for OAuth callback token in URL
    var params = _parseTokenFromURL();

    if (params && params.get('access_token')) {
      var accessToken  = params.get('access_token');
      var refreshToken = params.get('refresh_token');
      var expiresIn    = parseInt(params.get('expires_in') || '3600');
      var tokenType    = params.get('token_type');

      console.log('[Auth] OAuth callback detected, access_token present');

      try {
        var user = await _getUser(accessToken);
        console.log('[Auth] User fetched:', user ? user.email : 'null');

        _saveSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
          expires_at:    Date.now() / 1000 + expiresIn,
          user:          user,
        });

        // Clean the URL so token isn't visible or re-parsed on refresh
        window.history.replaceState(null, '', window.location.pathname);

        // Redirect to dashboard now that we're signed in
        window.location.href = 'index.html';
        return _session;

      } catch (e) {
        console.error('[Auth] Failed to fetch user after OAuth:', e.message);
      }
    }

    // No OAuth callback — restore from localStorage
    try {
      var raw = localStorage.getItem('cl_session');
      if (!raw) return null;

      var stored = JSON.parse(raw);
      if (!stored || !stored.access_token) return null;

      var now = Date.now() / 1000;
      if (stored.expires_at && stored.expires_at < now) {
        // Token expired — try to refresh
        console.log('[Auth] Token expired, attempting refresh…');
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
    } catch (e) {
      console.warn('[Auth] Session restore error:', e.message);
    }

    return _session;
  }

  // ── Public auth methods ─────────────────────────────────────

  async function signUp(email, password) {
    var data = await _authRequest('/signup', { email: email, password: password });
    if (data.access_token) _saveSession(data);
    return data;
  }

  async function signIn(email, password) {
    var data = await _authRequest('/token?grant_type=password', { email: email, password: password });
    _saveSession(data);
    return data;
  }

  async function signInWithOAuth(provider) {
    // Always redirect back to login.html — init() will parse the token and redirect to index
    var redirectTo = window.location.origin
      + window.location.pathname.replace(/\/[^/]*$/, '')
      + '/login.html';
    console.log('[Auth] OAuth redirect_to:', redirectTo);
    window.location.href = SUPABASE_URL
      + '/auth/v1/authorize?provider=' + provider
      + '&redirect_to=' + encodeURIComponent(redirectTo);
  }

  async function signOut() {
    try {
      if (_session && _session.access_token) {
        await fetch(SUPABASE_URL + '/auth/v1/logout', {
          method:  'POST',
          headers: {
            'apikey':        SUPABASE_KEY,
            'Authorization': 'Bearer ' + _session.access_token,
          },
        });
      }
    } catch (e) { /* ignore errors on logout */ }
    _saveSession(null);
    window.location.href = 'index.html';
  }

  // ── Getters ─────────────────────────────────────────────────

  function getUser()        { return _user; }
  function getSession()     { return _session; }
  function isLoggedIn()     { return !!(_session && _session.access_token); }
  function getAccessToken() { return _session ? _session.access_token : null; }
  function getUserId()      { return _user ? _user.id : null; }

  function getDisplayName() {
    if (!_user) return null;
    var meta = _user.user_metadata || {};
    return meta.full_name || meta.name || meta.user_name || _user.email.split('@')[0];
  }

  function getAvatar() {
    if (!_user) return null;
    var meta = _user.user_metadata || {};
    return meta.avatar_url || meta.picture || null;
  }

  // ── Nav UI ──────────────────────────────────────────────────

  function _updateNavUI() {
    var loginBtn   = document.getElementById('nav-login-btn');
    var userMenu   = document.getElementById('nav-user-menu');
    var userName   = document.getElementById('nav-user-name');
    var userAvatar = document.getElementById('nav-user-avatar');
    var userInit   = document.getElementById('nav-user-initials');

    if (isLoggedIn()) {
      if (loginBtn)  loginBtn.style.display = 'none';
      if (userMenu)  userMenu.style.display = 'flex';
      var name = getDisplayName() || 'Account';
      if (userName)  userName.textContent   = name;
      if (userInit)  userInit.textContent   = name.slice(0, 2).toUpperCase();
      var avatar = getAvatar();
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

  return {
    init:             init,
    signUp:           signUp,
    signIn:           signIn,
    signInWithOAuth:  signInWithOAuth,
    signOut:          signOut,
    getUser:          getUser,
    getSession:       getSession,
    isLoggedIn:       isLoggedIn,
    getAccessToken:   getAccessToken,
    getUserId:        getUserId,
    getDisplayName:   getDisplayName,
    getAvatar:        getAvatar,
  };
})();

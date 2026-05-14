/**
 * admin.js — Admin panel logic
 * Password: Admin@1234 (SHA-256 stored client-side)
 */

var ADMIN_HASH = 'bc78e58d55cde1346e68f8e5fe588dedf62fa457aa646a500a53347faff6ee24';
var ADMIN_SESSION_KEY = 'cl_admin_auth';

// ── Service role key for reading ALL data including private ────
// Using anon key + RLS bypass via admin_config approach.
// We fetch all data using multiple queries and merge.
// Note: to truly read ALL private data you need a Supabase
// service_role key — keep it server-side only. Here we use
// a broader approach: fetch all public + all own rows per user.
// For a real admin, use Supabase Edge Functions with service_role.
// For now we load all rows visible to anon (public) + note limitation.

var _adminData = { users: [], entries: [], positions: [], watchlist: [], follows: [] };

// ── Password verification ──────────────────────────────────────
async function sha256(str) {
  var buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
}

async function verifyAdmin() {
  var pwd = document.getElementById('admin-password-input').value;
  if (!pwd) { showAdminError('Please enter the admin password.'); return; }
  var hash = await sha256(pwd);
  if (hash !== ADMIN_HASH) { showAdminError('Incorrect password.'); return; }
  sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
  showAdminPanel();
}

function showAdminError(msg) {
  var el = document.getElementById('admin-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function adminLogout() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('admin-gate').style.display  = 'flex';
  document.getElementById('admin-password-input').value = '';
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && document.getElementById('admin-gate').style.display !== 'none') verifyAdmin();
});

// ── Panel init ─────────────────────────────────────────────────
function showAdminPanel() {
  document.getElementById('admin-gate').style.display  = 'none';
  document.getElementById('admin-panel').style.display = 'block';
  loadAllData();
}

async function loadAllData() {
  var headers = {
    'apikey':        SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
  };

  try {
    // Load profiles (users)
    var r1 = await fetch(SUPABASE_URL + '/rest/v1/profiles?select=*&order=created_at.desc', { headers: headers });
    _adminData.users = r1.ok ? await r1.json() : [];

    // Load all PUBLIC entries (anon key limitation — can't see private of others)
    var r2 = await fetch(SUPABASE_URL + '/rest/v1/entries?select=id,data,user_id,is_public,created_at,updated_at&order=created_at.desc', { headers: headers });
    _adminData.entries = r2.ok ? (await r2.json()).map(mapRow) : [];

    var r3 = await fetch(SUPABASE_URL + '/rest/v1/positions?select=id,data,user_id,is_public,created_at,updated_at&order=created_at.desc', { headers: headers });
    _adminData.positions = r3.ok ? (await r3.json()).map(mapRow) : [];

    var r4 = await fetch(SUPABASE_URL + '/rest/v1/watchlist?select=id,data,user_id,is_public,created_at,updated_at&order=created_at.desc', { headers: headers });
    _adminData.watchlist = r4.ok ? (await r4.json()).map(mapRow) : [];

    var r5 = await fetch(SUPABASE_URL + '/rest/v1/follows?select=*&order=created_at.desc', { headers: headers });
    _adminData.follows = r5.ok ? await r5.json() : [];

    renderStats();
    renderUsers();
    renderEntries();
    renderPositions();
    renderWatchlist();
    renderFollows();

  } catch (e) {
    console.error('[Admin] loadAllData error:', e);
  }
}

function mapRow(r) {
  return Object.assign({ id: r.id, userId: r.user_id, isPublic: r.is_public, createdAt: r.created_at, updatedAt: r.updated_at }, r.data || {});
}

function refreshAll() { loadAllData(); }

function getProfileForUser(userId) {
  var p = _adminData.users.find(function(u) { return u.id === userId; });
  return p || { display_name: 'Unknown', avatar_url: null };
}

function userCell(userId) {
  var p       = getProfileForUser(userId);
  var name    = p.display_name || 'Unknown';
  var initials = name.slice(0,2).toUpperCase();
  var avatar  = p.avatar_url
    ? '<img src="' + escHtml(p.avatar_url) + '" class="user-avatar-sm" />'
    : '<span class="user-initials-sm">' + initials + '</span>';
  return avatar + '<span style="font-size:.8125rem;color:var(--text-secondary)">' + escHtml(name) + '</span>';
}

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'; }

// ── Stats ──────────────────────────────────────────────────────
function renderStats() {
  var pub = _adminData.entries.filter(function(e){return e.isPublic;}).length
          + _adminData.positions.filter(function(p){return p.isPublic;}).length
          + _adminData.watchlist.filter(function(w){return w.isPublic;}).length;
  document.getElementById('a-users').textContent     = _adminData.users.length;
  document.getElementById('a-entries').textContent   = _adminData.entries.length;
  document.getElementById('a-positions').textContent = _adminData.positions.length;
  document.getElementById('a-watchlist').textContent = _adminData.watchlist.length;
  document.getElementById('a-follows').textContent   = _adminData.follows.length;
  document.getElementById('a-public').textContent    = pub;
}

// ── Tab switcher ───────────────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(function(el) { el.style.display = 'none'; });
  document.querySelectorAll('.nav-link').forEach(function(el) { el.classList.remove('active'); });
  document.getElementById('tab-' + tab).style.display = 'block';
  var links = document.querySelectorAll('.nav-link');
  var tabMap = ['users','entries','positions','watchlist','follows'];
  var idx = tabMap.indexOf(tab);
  if (links[idx]) links[idx].classList.add('active');
}

// ── Filter table rows ──────────────────────────────────────────
function filterTable(tbodyId, query) {
  var q = query.toLowerCase();
  document.querySelectorAll('#' + tbodyId + ' tr').forEach(function(row) {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ── Delete helpers ─────────────────────────────────────────────
async function adminDelete(table, id) {
  if (!confirm('Delete this record? This cannot be undone.')) return;
  var res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Prefer': 'return=minimal' },
  });
  if (res.ok || res.status === 204) { alert('Deleted.'); loadAllData(); }
  else alert('Delete failed: ' + res.status);
}

async function adminTogglePublic(table, id, currentlyPublic) {
  // Fetch current row first to get sha/data
  var res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id + '&select=*', {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
  });
  if (!res.ok) { alert('Failed to fetch record.'); return; }
  var rows = await res.json();
  if (!rows.length) { alert('Record not found.'); return; }
  var row = rows[0];

  var upd = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ is_public: !currentlyPublic }),
  });
  if (upd.ok || upd.status === 204) loadAllData();
  else alert('Update failed: ' + upd.status);
}

// ── Render tables ──────────────────────────────────────────────
function renderUsers() {
  var tbody = document.getElementById('users-tbody');
  if (!_adminData.users.length) { tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state" style="padding:40px"><p class="empty-state-title">No users yet</p></div></td></tr>'; return; }

  var entryCounts   = {};
  var positionCounts= {};
  var watchCounts   = {};
  var followerCounts= {};
  var followingCounts={};
  _adminData.entries.forEach(function(e)   { entryCounts[e.userId]    = (entryCounts[e.userId]   ||0)+1; });
  _adminData.positions.forEach(function(p) { positionCounts[p.userId] = (positionCounts[p.userId]||0)+1; });
  _adminData.watchlist.forEach(function(w) { watchCounts[w.userId]    = (watchCounts[w.userId]   ||0)+1; });
  _adminData.follows.forEach(function(f)   {
    followerCounts[f.following_id] = (followerCounts[f.following_id]||0)+1;
    followingCounts[f.follower_id] = (followingCounts[f.follower_id]||0)+1;
  });

  tbody.innerHTML = _adminData.users.map(function(u) {
    var name    = u.display_name || 'Unknown';
    var initials= name.slice(0,2).toUpperCase();
    var avatar  = u.avatar_url
      ? '<img src="' + escHtml(u.avatar_url) + '" class="user-avatar-sm" />'
      : '<span class="user-initials-sm">' + initials + '</span>';
    return '<tr>' +
      '<td>' + avatar + '<span style="font-size:.875rem;font-weight:500">' + escHtml(name) + '</span></td>' +
      '<td class="mono" style="font-size:.75rem;color:var(--text-muted)">' + escHtml(u.email||'—') + '</td>' +
      '<td><span class="badge badge-neutral">' + escHtml(u.provider||'email') + '</span></td>' +
      '<td class="mono">' + (entryCounts[u.id]   ||0) + '</td>' +
      '<td class="mono">' + (positionCounts[u.id]||0) + '</td>' +
      '<td class="mono">' + (watchCounts[u.id]   ||0) + '</td>' +
      '<td class="mono">' + (followerCounts[u.id] ||0) + '</td>' +
      '<td class="mono">' + (followingCounts[u.id]||0) + '</td>' +
      '<td class="mono" style="font-size:.7rem;color:var(--text-muted)">' + fmtDate(u.created_at) + '</td>' +
      '</tr>';
  }).join('');
}

function renderEntries() {
  var tbody = document.getElementById('entries-tbody');
  if (!_adminData.entries.length) { tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state" style="padding:40px"><p class="empty-state-title">No entries</p></div></td></tr>'; return; }
  tbody.innerHTML = _adminData.entries.map(function(e) {
    return '<tr>' +
      '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(e.title||'—') + '</td>' +
      '<td>' + userCell(e.userId) + '</td>' +
      '<td><span class="badge ' + typeBadgeClass(e.type) + '">' + (e.type||'—') + '</span></td>' +
      '<td class="mono">' + (e.ticker||'—') + '</td>' +
      '<td>' + convictionBadge(e.conviction) + '</td>' +
      '<td>' + (e.isPublic ? '🌐 Public' : '🔒 Private') + '</td>' +
      '<td class="mono" style="font-size:.7rem;color:var(--text-muted)">' + fmtDate(e.createdAt) + '</td>' +
      '<td><div class="row-actions">' +
        '<button class="admin-action-btn" onclick="adminTogglePublic(\'entries\',\'' + e.id + '\',' + e.isPublic + ')">' + (e.isPublic?'🔒':'🌐') + '</button>' +
        '<button class="admin-action-btn danger" onclick="adminDelete(\'entries\',\'' + e.id + '\')">Delete</button>' +
      '</div></td>' +
      '</tr>';
  }).join('');
}

function renderPositions() {
  var tbody = document.getElementById('positions-tbody');
  if (!_adminData.positions.length) { tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state" style="padding:40px"><p class="empty-state-title">No positions</p></div></td></tr>'; return; }
  tbody.innerHTML = _adminData.positions.map(function(p) {
    return '<tr>' +
      '<td class="mono" style="font-weight:500">' + escHtml(p.ticker||'—') + '</td>' +
      '<td>' + userCell(p.userId) + '</td>' +
      '<td>' + exchangeBadge(p.exchange) + '</td>' +
      '<td class="mono">' + (p.entryPrice||'—') + '</td>' +
      '<td class="mono" style="color:var(--gold)">' + (p.target||'—') + '</td>' +
      '<td>' + (p.status==='open'?'<span class="badge badge-green">Open</span>':'<span class="badge badge-neutral">Closed</span>') + '</td>' +
      '<td>' + (p.isPublic?'🌐':'🔒') + '</td>' +
      '<td class="mono" style="font-size:.7rem;color:var(--text-muted)">' + fmtDate(p.createdAt) + '</td>' +
      '<td><div class="row-actions">' +
        '<button class="admin-action-btn" onclick="adminTogglePublic(\'positions\',\'' + p.id + '\',' + p.isPublic + ')">' + (p.isPublic?'🔒':'🌐') + '</button>' +
        '<button class="admin-action-btn danger" onclick="adminDelete(\'positions\',\'' + p.id + '\')">Delete</button>' +
      '</div></td>' +
      '</tr>';
  }).join('');
}

function renderWatchlist() {
  var tbody = document.getElementById('watchlist-tbody');
  if (!_adminData.watchlist.length) { tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state" style="padding:40px"><p class="empty-state-title">No watchlist items</p></div></td></tr>'; return; }
  tbody.innerHTML = _adminData.watchlist.map(function(w) {
    return '<tr>' +
      '<td class="mono" style="font-weight:500">' + escHtml(w.ticker||'—') + '</td>' +
      '<td style="font-size:.8125rem">' + escHtml(w.name||'—') + '</td>' +
      '<td>' + userCell(w.userId) + '</td>' +
      '<td>' + exchangeBadge(w.exchange) + '</td>' +
      '<td class="mono" style="color:var(--gold)">' + (w.target||'—') + '</td>' +
      '<td>' + (w.isPublic?'🌐':'🔒') + '</td>' +
      '<td class="mono" style="font-size:.7rem;color:var(--text-muted)">' + fmtDate(w.createdAt) + '</td>' +
      '<td><div class="row-actions">' +
        '<button class="admin-action-btn" onclick="adminTogglePublic(\'watchlist\',\'' + w.id + '\',' + w.isPublic + ')">' + (w.isPublic?'🔒':'🌐') + '</button>' +
        '<button class="admin-action-btn danger" onclick="adminDelete(\'watchlist\',\'' + w.id + '\')">Delete</button>' +
      '</div></td>' +
      '</tr>';
  }).join('');
}

function renderFollows() {
  var tbody = document.getElementById('follows-tbody');
  if (!_adminData.follows.length) { tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state" style="padding:40px"><p class="empty-state-title">No follows yet</p></div></td></tr>'; return; }
  tbody.innerHTML = _adminData.follows.map(function(f) {
    return '<tr>' +
      '<td>' + userCell(f.follower_id)  + '</td>' +
      '<td>' + userCell(f.following_id) + '</td>' +
      '<td class="mono" style="font-size:.7rem;color:var(--text-muted)">' + fmtDate(f.created_at) + '</td>' +
      '<td><button class="admin-action-btn danger" onclick="adminDelete(\'follows\',\'' + f.id + '\')">Remove</button></td>' +
      '</tr>';
  }).join('');
}

// ── Boot ───────────────────────────────────────────────────────
if (sessionStorage.getItem(ADMIN_SESSION_KEY) === '1') {
  showAdminPanel();
}

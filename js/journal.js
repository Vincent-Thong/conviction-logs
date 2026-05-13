/* journal.js */
var editingEntryId = null, searchTerm = '', typeFilter = 'all', viewTab = 'all';
var entryVisToggle = null;
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function openNewEntry(id) {
  if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) { window.location.href = 'login.html'; return; }
  editingEntryId = id || null;
  ['entry-title','entry-ticker','entry-tags','entry-body'].forEach(function(fid) { var el = document.getElementById(fid); if (el) el.value = ''; });
  document.getElementById('entry-type').value     = 'thesis';
  document.getElementById('entry-exchange').value = '';
  document.getElementById('entry-date').value     = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('#entry-conviction-picker .cpip').forEach(function(b) { b.classList.remove('selected'); });
  document.getElementById('entry-modal-title').textContent = 'New Journal Entry';
  var initPublic = false;
  if (id) {
    var e = Store.getEntries().find(function(x) { return x.id === id; });
    if (e) {
      document.getElementById('entry-modal-title').textContent = 'Edit Entry';
      document.getElementById('entry-title').value    = e.title  || '';
      document.getElementById('entry-type').value     = e.type   || 'thesis';
      document.getElementById('entry-ticker').value   = e.ticker || '';
      document.getElementById('entry-exchange').value = e.exchange || '';
      document.getElementById('entry-date').value     = e.date   || '';
      document.getElementById('entry-body').value     = e.body   || '';
      document.getElementById('entry-tags').value     = (e.tags || []).join(', ');
      setConvictionPicker('entry-conviction-picker', e.conviction);
      initPublic = e.isPublic || false;
    }
  }
  entryVisToggle = makeVisibilityToggle('entry-visibility', initPublic);
  document.getElementById('entry-modal').style.display = 'flex';
}

async function saveEntry() {
  var title = document.getElementById('entry-title').value.trim();
  if (!title) { alert('Title is required.'); return; }
  var body = document.getElementById('entry-body').value.trim();
  if (!body)  { alert('Entry body is required.'); return; }
  var entry = {
    id:         editingEntryId,
    title:      title,
    type:       document.getElementById('entry-type').value,
    ticker:     document.getElementById('entry-ticker').value.trim().toUpperCase() || null,
    exchange:   document.getElementById('entry-exchange').value || null,
    date:       document.getElementById('entry-date').value,
    body:       body,
    tags:       document.getElementById('entry-tags').value.split(',').map(function(t) { return t.trim(); }).filter(Boolean),
    conviction: getConvictionPicker('entry-conviction-picker'),
    isPublic:   entryVisToggle ? entryVisToggle.getValue() : false,
  };
  await Store.saveEntry(entry);
  closeModal('entry-modal');
  render();
}

async function toggleEntryVisibility(id) {
  var e = Store.getEntries().find(function(x) { return x.id === id; });
  if (!e || !Store.isOwner(e)) return;
  var updated = Object.assign({}, e, { isPublic: !e.isPublic });
  await Store.saveEntry(updated);
  render();
}

async function deleteEntry(id) {
  if (!confirm('Delete this entry?')) return;
  await Store.deleteEntry(id);
  render();
}

function viewEntry(id) {
  var e = Store.getEntries().find(function(x) { return x.id === id; });
  if (!e) return;
  var isOwn = Store.isOwner(e);
  document.getElementById('view-title').textContent = e.title;
  document.getElementById('view-body').textContent  = e.body;
  document.getElementById('view-meta').innerHTML = [
    '<span>' + formatDate(e.date) + '</span>',
    '<span class="badge ' + typeBadgeClass(e.type) + '">' + e.type + '</span>',
    e.ticker   ? '<span class="ticker" style="color:var(--text-secondary)">' + escHtml(e.ticker) + '</span>' : '',
    e.exchange ? exchangeBadge(e.exchange) : '',
    e.conviction ? convictionBadge(e.conviction) : '',
    e.isPublic ? '<span style="font-size:.8rem">🌐 Public</span>' : '<span style="font-size:.8rem">🔒 Private</span>',
  ].filter(Boolean).join('<span style="margin:0 6px;color:var(--border)">·</span>');

  // Author block always shown
  document.getElementById('view-author').innerHTML = authorBlock(e);

  // Owner actions inside view modal
  document.getElementById('view-owner-actions').innerHTML = isOwn
    ? ownerActions(e,
        'toggleEntryVisibility(\'' + e.id + '\');closeModal(\'view-modal\');',
        'deleteEntry(\'' + e.id + '\');closeModal(\'view-modal\');')
    : '';

  document.getElementById('view-tags').innerHTML = (e.tags || []).map(function(t) { return '<span class="tag">' + escHtml(t) + '</span>'; }).join('');
  var editBtn = document.getElementById('view-edit-btn');
  if (isOwn) { editBtn.style.display = 'inline-flex'; editBtn.onclick = function() { closeModal('view-modal'); openNewEntry(id); }; }
  else        { editBtn.style.display = 'none'; }
  document.getElementById('view-modal').style.display = 'flex';
}

function render() {
  var loggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn();
  var all = Store.getEntries();
  var entries;
  if (!loggedIn)             { entries = all.filter(function(e) { return e.isPublic; }); }
  else if (viewTab === 'mine')      { entries = Store.getMyEntries(); }
  else if (viewTab === 'community') { entries = all.filter(function(e) { return e.isPublic && !Store.isOwner(e); }); }
  else                              { entries = all; }

  if (typeFilter !== 'all') entries = entries.filter(function(e) { return e.type === typeFilter; });
  if (searchTerm) {
    var q = searchTerm.toLowerCase();
    entries = entries.filter(function(e) {
      return (e.title||'').toLowerCase().includes(q) || (e.body||'').toLowerCase().includes(q) || (e.ticker||'').toLowerCase().includes(q);
    });
  }

  var container = document.getElementById('journal-entries');
  if (!entries.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✦</div>' +
      '<p class="empty-state-title">' + (searchTerm || typeFilter !== 'all' ? 'No matching entries' : loggedIn ? 'Your journal is empty' : 'No public entries yet') + '</p><br/>' +
      (loggedIn ? '<button class="btn btn-primary" onclick="openNewEntry()">Write First Entry</button>' : '<a href="login.html" class="btn btn-primary">Sign In to Write</a>') +
      '</div>';
    return;
  }

  container.innerHTML = entries.map(function(e) {
    var isOwn    = Store.isOwner(e);
    var profile  = Store.getProfile(e.userId);
    var authorName = profile.displayName || 'Anonymous';
    return '<div class="journal-card" onclick="viewEntry(\'' + e.id + '\')">' +
      '<div class="journal-card-top">' +
        '<span class="badge ' + typeBadgeClass(e.type) + '">' + e.type + '</span>' +
        (e.ticker   ? '<span class="ticker" style="font-size:.8125rem">' + escHtml(e.ticker) + '</span>' : '') +
        (e.exchange ? exchangeBadge(e.exchange) : '') +
        (e.conviction ? convictionBadge(e.conviction) : '') +
        (e.isPublic ? '<span style="font-size:.75rem" title="Public">🌐</span>' : '<span style="font-size:.75rem" title="Private">🔒</span>') +
        (isOwn ? '<span class="mine-indicator">Mine</span>' : '') +
        '<span class="journal-card-date">' + formatDate(e.date) + '</span>' +
      '</div>' +
      '<div class="journal-card-title">' + escHtml(e.title) + '</div>' +
      '<div class="journal-card-excerpt">' + escHtml(e.body) + '</div>' +
      '<div class="journal-card-footer">' +
        (e.tags || []).map(function(t) { return '<span class="tag">' + escHtml(t) + '</span>'; }).join('') +
      '</div>' +
      // Author + date + owner actions at bottom of card
      '<div class="journal-card-author">' +
        authorBlock(e) +
        (isOwn ? '<div class="owner-actions" onclick="event.stopPropagation()">' +
          '<button class="owner-action-btn" onclick="toggleEntryVisibility(\'' + e.id + '\')" title="' + (e.isPublic ? 'Make Private' : 'Make Public') + '">' + (e.isPublic ? '🔒 Make Private' : '🌐 Make Public') + '</button>' +
          '<button class="owner-action-btn" onclick="openNewEntry(\'' + e.id + '\')" style="color:var(--text-secondary)">Edit</button>' +
          '<button class="owner-action-btn danger" onclick="deleteEntry(\'' + e.id + '\')">Delete</button>' +
        '</div>' : '') +
      '</div>' +
      '</div>';
  }).join('');
}

document.querySelectorAll('#entry-conviction-picker .cpip').forEach(function(btn) {
  btn.addEventListener('click', function() { document.querySelectorAll('#entry-conviction-picker .cpip').forEach(function(b) { b.classList.remove('selected'); }); btn.classList.add('selected'); });
});
var searchEl = document.getElementById('journal-search');
if (searchEl) searchEl.addEventListener('input', function(e) { searchTerm = e.target.value; render(); });
var filterEl = document.getElementById('journal-filter-type');
if (filterEl) filterEl.addEventListener('change', function(e) { typeFilter = e.target.value; render(); });

StoreInit(function() {
  updateAuthNav();
  var loggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn();
  var sectionHeader = document.querySelector('.section-header');
  if (sectionHeader && loggedIn) {
    var tabs = document.createElement('div');
    tabs.className = 'view-tabs';
    tabs.innerHTML = '<button class="view-tab active" data-tab="all">All</button><button class="view-tab" data-tab="mine">Mine</button><button class="view-tab" data-tab="community">Community</button>';
    sectionHeader.parentNode.insertBefore(tabs, sectionHeader.nextSibling);
    tabs.querySelectorAll('.view-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        tabs.querySelectorAll('.view-tab').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        viewTab = btn.dataset.tab;
        render();
      });
    });
  }
  if (!loggedIn) showLoginPromptIfNeeded('.page-wrapper .container');
  render();
  var params = new URLSearchParams(window.location.search);
  if (params.get('new') === '1') openNewEntry();
});

/* journal.js */
var editingEntryId = null, searchTerm = '', typeFilter = 'all', viewTab = '';
var entryVisToggle = null;
var editorInstance = null;
var currentEditorMode = 'rich'; // 'rich' or 'markdown'

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Strip HTML tags and decode entities for plain text display
function stripHtmlTags(html) {
  if (!html) return '';
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// Convert HTML table (from Excel paste) to Markdown-style table
function htmlTableToMarkdown(html) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(html, 'text/html');
  var tables = doc.querySelectorAll('table');
  if (!tables.length) return null;
  
  var result = [];
  tables.forEach(function(table) {
    var rows = table.querySelectorAll('tr');
    if (!rows.length) return;
    
    var markdownRows = [];
    var maxCols = 0;
    
    // First pass: find max columns
    rows.forEach(function(tr) {
      var cells = tr.querySelectorAll('td, th');
      if (cells.length > maxCols) maxCols = cells.length;
    });
    
    rows.forEach(function(tr, rowIdx) {
      var cells = Array.from(tr.querySelectorAll('td, th'));
      var cellTexts = [];
      
      for (var i = 0; i < maxCols; i++) {
        var cell = cells[i];
        var text = cell ? cell.textContent.trim().replace(/\|/g, '\\|') : '';
        cellTexts.push(text);
      }
      
      var rowStr = '| ' + cellTexts.join(' | ') + ' |';
      markdownRows.push(rowStr);
      
      // Add separator after header row
      if (rowIdx === 0) {
        var separator = '| ' + Array(maxCols).fill('---').join(' | ') + ' |';
        markdownRows.push(separator);
      }
    });
    
    if (markdownRows.length) {
      result.push(markdownRows.join('\n'));
    }
  });
  
  return result.length ? result.join('\n\n') : null;
}

// Handle paste event for Excel table conversion
function handlePasteEvent(e) {
  var clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData) return;
  
  var htmlData = clipboardData.getData('text/html');
  if (!htmlData || !htmlData.includes('<table')) return;
  
  var markdown = htmlTableToMarkdown(htmlData);
  if (!markdown) return;
  
  e.preventDefault();
  
  var editor = document.getElementById('entry-editor');
  if (!editor) return;
  
  // Insert markdown table at cursor position or append
  var selection = window.getSelection();
  if (selection.rangeCount > 0) {
    var range = selection.getRangeAt(0);
    var textNode = document.createTextNode('\n\n' + markdown + '\n\n');
    range.insertNode(textNode);
    range.collapse(false);
  } else {
    editor.innerHTML += '\n\n' + markdown + '\n\n';
  }
  
  // Update hidden input
  if (editorInstance && editorInstance.hiddenInput) {
    editorInstance.hiddenInput.value = editor.innerHTML;
  }
  
  // Trigger input event
  var event = document.createEvent('HTMLEvents');
  event.initEvent('input', true, false);
  editor.dispatchEvent(event);
}

function initRichTextEditor() {
  var editor = document.getElementById('entry-editor');
  var toolbar = document.getElementById('entry-toolbar');
  var hiddenInput = document.getElementById('entry-body');
  var mdEditor = document.getElementById('entry-editor-md');

  if (!editor || !toolbar) return;

  // Attach paste handler for Excel table conversion
  editor.addEventListener('paste', handlePasteEvent);

  // Toolbar button handlers
  toolbar.querySelectorAll('.toolbar-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var cmd = btn.dataset.cmd;

      if (cmd === 'link') {
        var url = prompt('Enter URL:', 'https://');
        if (url) document.execCommand('createLink', false, url);
      } else if (cmd === 'table') {
        insertTable();
      } else if (cmd === 'chart') {
        insertChart();
      } else if (cmd === 'h2') {
        // Toggle between H2 and paragraph
        var selection = window.getSelection();
        if (selection.rangeCount > 0) {
          var range = selection.getRangeAt(0);
          var block = range.startContainer;
          // Find the block element
          while (block && block.nodeType !== 1) {
            block = block.parentNode;
          }
          // Check if we're in an H2
          var isInH2 = block && (block.tagName === 'H2' || (block.parentElement && block.parentElement.tagName === 'H2'));
          if (isInH2) {
            document.execCommand('formatBlock', false, 'P');
          } else {
            document.execCommand('formatBlock', false, 'H2');
          }
        } else {
          document.execCommand('formatBlock', false, 'H2');
        }
      } else {
        document.execCommand(cmd, false, null);
      }
      editor.focus();
      updateToolbarState();
    });
  });

  // Update toolbar state on selection change
  editor.addEventListener('keyup', updateToolbarState);
  editor.addEventListener('mouseup', updateToolbarState);
  editor.addEventListener('input', function() {
    hiddenInput.value = editor.innerHTML;
  });

  // Markdown editor input handler
  if (mdEditor) {
    mdEditor.addEventListener('input', function() {
      hiddenInput.value = markdownToHtml(mdEditor.value);
    });
  }

  editorInstance = { editor: editor, toolbar: toolbar, hiddenInput: hiddenInput, mdEditor: mdEditor };
}

function updateToolbarState() {
  if (!editorInstance || !editorInstance.toolbar) return;

  editorInstance.toolbar.querySelectorAll('.toolbar-btn').forEach(function(btn) {
    var cmd = btn.dataset.cmd;
    if (['bold', 'italic', 'underline'].indexOf(cmd) !== -1) {
      if (document.queryCommandState(cmd)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    } else if (cmd === 'h2') {
      // Check if current selection is in an H2 block
      var value = document.queryCommandValue('formatBlock');
      if (value && (value.toLowerCase() === 'h2' || value === 'H2')) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
}

function insertTable() {
  var editor = document.getElementById('entry-editor');
  if (!editor) return;

  var rows = parseInt(prompt('Number of rows (2-10):', '3')) || 3;
  var cols = parseInt(prompt('Number of columns (2-6):', '3')) || 3;

  rows = Math.max(2, Math.min(10, rows));
  cols = Math.max(2, Math.min(6, cols));

  var html = '<table contenteditable="true"><tbody>';
  for (var i = 0; i < rows; i++) {
    html += '<tr>';
    for (var j = 0; j < cols; j++) {
      if (i === 0) {
        html += '<th>Header ' + (j+1) + '</th>';
      } else {
        html += '<td>Cell ' + (i+1) + ',' + (j+1) + '</td>';
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table><p><br/></p>';

  document.execCommand('insertHTML', false, html);
}

function insertChart() {
  var editor = document.getElementById('entry-editor');
  if (!editor) return;

  var chartId = 'chart_' + Date.now();
  var chartType = prompt('Chart type (bar, line, pie):', 'bar') || 'bar';
  var labelsStr = prompt('Labels (comma-separated):', 'Q1,Q2,Q3,Q4') || 'Q1,Q2,Q3,Q4';
  var dataStr = prompt('Data values (comma-separated):', '10,20,15,25') || '10,20,15,25';

  var labels = labelsStr.split(',').map(function(s) { return s.trim(); });
  var data = dataStr.split(',').map(function(s) { return parseFloat(s.trim()) || 0; });

  var containerId = chartId + '_container';
  var canvasId = chartId + '_canvas';

  var html = '<div class="chart-container" data-chart-id="' + chartId + '" data-type="' + chartType + '" data-labels="' + escHtml(labels.join(',')) + '" data-data="' + data.join(',') + '">' +
    '<canvas id="' + canvasId + '" width="400" height="200"></canvas>' +
    '</div><p><br/></p>';

  document.execCommand('insertHTML', false, html);

  // Render chart after insertion
  setTimeout(function() {
    renderChartInEditor(canvasId, chartType, labels, data);
  }, 100);
}

function renderChartInEditor(canvasId, type, labels, data) {
  var canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  var ctx = canvas.getContext('2d');
  var colors = {
    bar: 'rgba(197, 168, 76, 0.7)',
    line: 'rgba(197, 168, 76, 1)',
    pie: ['rgba(197, 168, 76, 0.8)', 'rgba(62, 207, 142, 0.8)', 'rgba(240, 96, 128, 0.8)', 'rgba(100, 150, 200, 0.8)']
  };

  new Chart(ctx, {
    type: type,
    data: {
      labels: labels,
      datasets: [{
        label: 'Data',
        data: data,
        backgroundColor: type === 'pie' ? colors.pie : colors[type],
        borderColor: type === 'line' ? colors.line : '#c5a84c',
        borderWidth: 2,
        fill: type === 'line'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: '#c9c9c9' } }
      },
      scales: type !== 'pie' ? {
        y: { beginAtZero: true, ticks: { color: '#c9c9c9' }, grid: { color: 'rgba(255,255,255,0.1)' } },
        x: { ticks: { color: '#c9c9c9' }, grid: { display: false } }
      } : {}
    }
  });
}

function loadContentIntoEditor(content) {
  var editor = document.getElementById('entry-editor');
  var mdEditor = document.getElementById('entry-editor-md');
  if (!editor || !mdEditor) return;
  
  if (currentEditorMode === 'markdown') {
    // Convert HTML to markdown for display in MD editor
    mdEditor.value = htmlToMarkdown(content || '');
  } else {
    editor.innerHTML = content || '';
  }
  if (editorInstance && editorInstance.hiddenInput) {
    editorInstance.hiddenInput.value = content || '';
  }
}

// Simple HTML to Markdown conversion
function htmlToMarkdown(html) {
  if (!html) return '';
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  
  // Convert headings
  tmp.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(function(h) {
    var level = h.tagName.charAt(1);
    var prefix = Array(parseInt(level)).join('#') + '# ';
    h.outerHTML = prefix + h.textContent + '\n';
  });
  
  // Convert bold
  tmp.querySelectorAll('strong, b').forEach(function(el) {
    el.outerHTML = '**' + el.textContent + '**';
  });
  
  // Convert italic
  tmp.querySelectorAll('em, i').forEach(function(el) {
    el.outerHTML = '*' + el.textContent + '*';
  });
  
  // Convert links
  tmp.querySelectorAll('a').forEach(function(el) {
    el.outerHTML = '[' + el.textContent + '](' + (el.href || '') + ')';
  });
  
  // Convert lists
  tmp.querySelectorAll('ul li').forEach(function(li) {
    li.outerHTML = '- ' + li.textContent + '\n';
  });
  tmp.querySelectorAll('ol li').forEach(function(li) {
    li.outerHTML = '1. ' + li.textContent + '\n';
  });
  
  // Convert tables to markdown
  tmp.querySelectorAll('table').forEach(function(table) {
    var mdTable = htmlTableToMarkdown('<table>' + table.innerHTML + '</table>');
    if (mdTable) table.outerHTML = '\n' + mdTable + '\n';
  });
  
  // Get text and clean up
  var text = tmp.textContent || tmp.innerText || '';
  text = text.replace(/\n\s*\n/g, '\n\n').trim();
  return text;
}

// Convert Markdown to HTML
function markdownToHtml(md) {
  if (!md) return '';
  if (typeof marked !== 'undefined') {
    return marked.parse(md);
  }
  // Fallback: basic markdown parsing
  return md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    .replace(/\n/gim, '<br>');
}

function getContentFromEditor() {
  var editor = document.getElementById('entry-editor');
  var mdEditor = document.getElementById('entry-editor-md');
  if (currentEditorMode === 'markdown' && mdEditor) {
    return markdownToHtml(mdEditor.value);
  }
  return editor ? editor.innerHTML : '';
}

function openNewEntry(id) {
  if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) { 
    sessionStorage.setItem('cl_return_url', window.location.href);
    window.location.href = 'login.html'; 
    return; 
  }
  editingEntryId = id || null;
  ['entry-title','entry-ticker','entry-tags'].forEach(function(fid) { var el = document.getElementById(fid); if (el) el.value = ''; });
  document.getElementById('entry-type').value     = 'thesis';
  document.getElementById('entry-exchange').value = '';
  document.getElementById('entry-date').value     = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('#entry-conviction-picker .cpip').forEach(function(b) { b.classList.remove('selected'); });
  document.getElementById('entry-modal-title').textContent = 'New Journal Entry';
  var initPublic = false;
  if (id) {
    var e = Store.getEntries().find(function(x) { return x.id === id; });
    if (e) {
      // Verify ownership before allowing edit
      if (!Store.isOwner(e)) {
        alert('You can only edit your own entries.');
        return;
      }
      document.getElementById('entry-modal-title').textContent = 'Edit Entry';
      document.getElementById('entry-title').value    = e.title  || '';
      document.getElementById('entry-type').value     = e.type   || 'thesis';
      document.getElementById('entry-ticker').value   = e.ticker || '';
      document.getElementById('entry-exchange').value = e.exchange || '';
      document.getElementById('entry-date').value     = e.date   || '';
      document.getElementById('entry-tags').value     = (e.tags || []).join(', ');
      setConvictionPicker('entry-conviction-picker', e.conviction);
      initPublic = e.isPublic || false;
      loadContentIntoEditor(e.body || '');
    }
  } else {
    loadContentIntoEditor('');
  }
  entryVisToggle = makeVisibilityToggle('entry-visibility', initPublic);
  document.getElementById('entry-modal').style.display = 'flex';
  setTimeout(initRichTextEditor, 50);
}

// Set editor mode (rich text or markdown)
function setEditorMode(mode) {
  currentEditorMode = mode;
  var richBtn = document.getElementById('mode-rich-text');
  var mdBtn = document.getElementById('mode-markdown');
  var richEditor = document.getElementById('entry-editor');
  var mdEditor = document.getElementById('entry-editor-md');
  var toolbar = document.getElementById('entry-toolbar');
  
  if (mode === 'markdown') {
    // Switch to markdown mode
    richBtn.classList.remove('active');
    mdBtn.classList.add('active');
    richEditor.style.display = 'none';
    mdEditor.style.display = 'block';
    if (toolbar) toolbar.style.display = 'none';
    
    // Convert current content to markdown
    var content = richEditor.innerHTML;
    mdEditor.value = htmlToMarkdown(content);
  } else {
    // Switch to rich text mode
    mdBtn.classList.remove('active');
    richBtn.classList.add('active');
    mdEditor.style.display = 'none';
    richEditor.style.display = 'block';
    if (toolbar) toolbar.style.display = 'flex';
    
    // Convert markdown to HTML
    var mdContent = mdEditor.value;
    richEditor.innerHTML = markdownToHtml(mdContent);
  }
  
  // Update hidden input
  if (editorInstance && editorInstance.hiddenInput) {
    editorInstance.hiddenInput.value = getContentFromEditor();
  }
}

async function saveEntry() {
  var title = document.getElementById('entry-title').value.trim();
  if (!title) { alert('Title is required.'); return; }
  var body = getContentFromEditor().trim();
  if (!body)  { alert('Entry body is required.'); return; }
  var entry = {
    id:         editingEntryId,
    userId:     typeof Auth !== 'undefined' ? Auth.getUserId() : null,
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
  // Render markdown body using marked library
  document.getElementById('view-body').innerHTML  = (typeof marked !== 'undefined') ? marked.parse(e.body || '') : escHtml(e.body || '');
  document.getElementById('view-meta').innerHTML = [
    '<span>' + formatDate(e.date) + '</span>',
    '<span class="badge ' + typeBadgeClass(e.type) + '">' + e.type + '</span>',
    e.ticker   ? '<span class="ticker" style="color:var(--text-secondary)">' + escHtml(e.ticker) + '</span>' : '',
    e.exchange ? exchangeBadge(e.exchange) : '',
    e.conviction ? convictionBadge(e.conviction) : '',
    e.isPublic ? '<span style="font-size:.8rem">🌐 Public</span>' : '<span style="font-size:.8rem">🔒 Private</span>',
  ].filter(Boolean).join('<span style="margin:0 6px;color:var(--border)">·</span>');

  // Author block always shown
  document.getElementById('view-author').innerHTML = authorBlockWithFollow(e);

  // Owner actions inside view modal
  document.getElementById('view-owner-actions').innerHTML = isOwn
    ? ownerActions(e,
        'toggleEntryVisibility(\'' + e.id + '\');closeModal(\'view-modal\');',
        'deleteEntry(\'' + e.id + '\');closeModal(\'view-modal\');') +
    (e.isPublic ? '<div style="margin-top:8px">' + Share.shareBtn('entry', e.id, e.title) + '</div>' : '')
    : '';

  document.getElementById('view-tags').innerHTML = (e.tags || []).map(function(t) { return '<span class="tag">' + escHtml(t) + '</span>'; }).join('');
  var editBtn = document.getElementById('view-edit-btn');
  if (isOwn) { editBtn.style.display = 'inline-flex'; editBtn.onclick = function() { closeModal('view-modal'); openNewEntry(id); }; }
  else        { editBtn.style.display = 'none'; }

  // Render charts in viewed entry
  setTimeout(function() { renderChartsInView(); }, 100);

  document.getElementById('view-modal').style.display = 'flex';
}

function renderChartsInView() {
  if (typeof Chart === 'undefined') return;
  var viewBody = document.getElementById('view-body');
  if (!viewBody) return;

  var chartContainers = viewBody.querySelectorAll('.chart-container');
  chartContainers.forEach(function(container) {
    var canvas = container.querySelector('canvas');
    if (!canvas) return;

    var chartType = container.dataset.type || 'bar';
    var labels = (container.dataset.labels || '').split(',');
    var data = (container.dataset.data || '').split(',').map(function(v) { return parseFloat(v) || 0; });

    // Check if chart already rendered
    if (container.classList.contains('chart-rendered')) return;

    var ctx = canvas.getContext('2d');
    var colors = {
      bar: 'rgba(197, 168, 76, 0.7)',
      line: 'rgba(197, 168, 76, 1)',
      pie: ['rgba(197, 168, 76, 0.8)', 'rgba(62, 207, 142, 0.8)', 'rgba(240, 96, 128, 0.8)', 'rgba(100, 150, 200, 0.8)']
    };

    new Chart(ctx, {
      type: chartType,
      data: {
        labels: labels,
        datasets: [{
          label: 'Data',
          data: data,
          backgroundColor: chartType === 'pie' ? colors.pie : colors[chartType],
          borderColor: chartType === 'line' ? colors.line : '#c5a84c',
          borderWidth: 2,
          fill: chartType === 'line'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: '#c9c9c9' } }
        },
        scales: chartType !== 'pie' ? {
          y: { beginAtZero: true, ticks: { color: '#c9c9c9' }, grid: { color: 'rgba(255,255,255,0.1)' } },
          x: { ticks: { color: '#c9c9c9' }, grid: { display: false } }
        } : {}
      }
    });

    container.classList.add('chart-rendered');
  });
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
    var excerptText = stripHtmlTags(e.body).substring(0, 200);
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
      '<div class="journal-card-excerpt">' + escHtml(excerptText) + (stripHtmlTags(e.body).length > 200 ? '...' : '') + '</div>' +
      '<div class="journal-card-footer">' +
        (e.tags || []).map(function(t) { return '<span class="tag">' + escHtml(t) + '</span>'; }).join('') +
      '</div>' +
      // Author + date + owner actions at bottom of card
      '<div class="journal-card-author">' +
        authorBlockWithFollow(e) +
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

// Attach paste handler to entry editor (rich text)
var entryEditorEl = document.getElementById('entry-editor');
if (entryEditorEl) {
  entryEditorEl.addEventListener('paste', handlePasteEvent);
}

var searchEl = document.getElementById('journal-search');
if (searchEl) searchEl.addEventListener('input', function(e) { searchTerm = e.target.value; render(); });
var filterEl = document.getElementById('journal-filter-type');
if (filterEl) filterEl.addEventListener('change', function(e) { typeFilter = e.target.value; render(); });

StoreInit(function() {
  updateAuthNav();
  if (typeof Notifications !== 'undefined' && typeof Auth !== 'undefined' && Auth.isLoggedIn()) Notifications.load().then(function() { Notifications.startPolling(); });
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
  Share.handleShareParam(viewEntry);
});

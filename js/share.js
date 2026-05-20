/**
 * share.js — Share feature
 * Generates shareable links and handles deep-link opening
 */

var Share = (function() {

  var _base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');

  // Generate a shareable URL for an item
  function getUrl(type, id) {
    var pageMap = { entry: 'journal.html', position: 'portfolio.html', watchlist: 'watchlist.html' };
    return _base + '/' + (pageMap[type] || 'index.html') + '?share=' + id;
  }

  // Copy link to clipboard and show feedback
  async function copyLink(type, id, btn) {
    var url = getUrl(type, id);
    try {
      await navigator.clipboard.writeText(url);
      if (btn) {
        var orig = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.color = 'var(--green)';
        setTimeout(function() { 
          btn.textContent = orig; 
          btn.style.color = ''; 
        }, 2000);
      }
    } catch (e) {
      // Fallback
      var ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (btn) { 
        var origText = btn.textContent;
        btn.textContent = 'Copied!'; 
        setTimeout(function() { 
          btn.textContent = origText; 
        }, 2000); 
      }
    }
  }

  // Share via native share API (mobile) or show share menu
  async function nativeShare(title, text, type, id) {
    var url = getUrl(type, id);
    if (navigator.share) {
      try { await navigator.share({ title: title, text: text, url: url }); return; } catch(e) {}
    }
    // Fallback: show share panel
    showSharePanel(title, url);
  }

  function showSharePanel(title, url) {
    var existing = document.getElementById('share-panel');
    if (existing) existing.remove();

    var panel = document.createElement('div');
    panel.id  = 'share-panel';
    panel.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--bg-card);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:20px 24px;width:340px;box-shadow:0 8px 32px rgba(0,0,0,.5);animation:fadeUp .2s ease';

    var encodedUrl   = encodeURIComponent(url);
    var encodedTitle = encodeURIComponent(title);

    panel.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
        '<span style="font-family:var(--font-display);font-size:1rem;color:var(--text-primary)">Share</span>' +
        '<button onclick="document.getElementById(\'share-panel\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem">✕</button>' +
      '</div>' +
      '<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px;margin-bottom:14px;font-family:var(--font-mono);font-size:.7rem;color:var(--text-muted);word-break:break-all">' + escHtmlShare(url) + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-primary btn-sm" onclick="var u=\'' + escHtmlShare(url) + '\';navigator.clipboard.writeText(u).then(function(){var b=this;b.textContent=\'Copied!\';setTimeout(function(){b.textContent=\'Copy Link\';},2000);}.bind(this));">Copy Link</button>' +
        '<a class="btn btn-ghost btn-sm" href="https://twitter.com/intent/tweet?url=' + encodedUrl + '&text=' + encodedTitle + '" target="_blank" rel="noopener">Twitter / X</a>' +
        '<a class="btn btn-ghost btn-sm" href="https://t.me/share/url?url=' + encodedUrl + '&text=' + encodedTitle + '" target="_blank" rel="noopener">Telegram</a>' +
        '<a class="btn btn-ghost btn-sm" href="whatsapp://send?text=' + encodedTitle + '%20' + encodedUrl + '" target="_blank" rel="noopener">WhatsApp</a>' +
      '</div>';

    document.body.appendChild(panel);
    setTimeout(function() { document.addEventListener('click', function _c(e) { if (!panel.contains(e.target)) { panel.remove(); document.removeEventListener('click',_c); } }); }, 100);
  }

  function escHtmlShare(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;'); }

  // Check URL on page load for ?share=id and open that item
  function handleShareParam(openFn) {
    var params = new URLSearchParams(window.location.search);
    var shareId = params.get('share');
    if (shareId && openFn) {
      // Small delay to let data load
      setTimeout(function() { openFn(shareId); }, 300);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }

  // Render share button HTML
  function shareBtn(type, id, title) {
    return '<button class="owner-action-btn" onclick="Share.nativeShare(\'' +
      escHtmlShare(title) + '\',\'Check out this post on Conviction Logs\',\'' + type + '\',\'' + id + '\')" title="Share">Share 🔗</button>';
  }

  return { getUrl, copyLink, nativeShare, showSharePanel, handleShareParam, shareBtn };
})();

/* portfolio.js */
var editingId=null, filterStatus='all', filterMarket=null;
var visibilityToggle = null;

function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function canEdit(item) {
  return typeof Auth !== 'undefined' && Auth.isLoggedIn() && Store.isOwner(item);
}

function openAddPosition(id){
  if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) { window.location.href='login.html'; return; }
  editingId=id||null;
  ['pos-ticker','pos-name','pos-entry-date','pos-entry-price','pos-target','pos-stop','pos-thesis'].forEach(function(fid){var el=document.getElementById(fid);if(el)el.value='';});
  document.getElementById('pos-exchange').value='HK';
  document.getElementById('pos-status').value='open';
  document.querySelectorAll('#conviction-picker .cpip').forEach(function(b){b.classList.remove('selected');});
  var initPublic = false;
  if(id){
    var pos=Store.getPositions().find(function(p){return p.id===id;});
    if(pos){
      document.getElementById('pos-ticker').value=pos.ticker||'';
      document.getElementById('pos-name').value=pos.name||'';
      document.getElementById('pos-entry-date').value=pos.entryDate||'';
      document.getElementById('pos-entry-price').value=pos.entryPrice||'';
      document.getElementById('pos-target').value=pos.target||'';
      document.getElementById('pos-stop').value=pos.stop||'';
      document.getElementById('pos-thesis').value=pos.thesis||'';
      document.getElementById('pos-exchange').value=pos.exchange||'HK';
      document.getElementById('pos-status').value=pos.status||'open';
      setConvictionPicker('conviction-picker',pos.conviction);
      initPublic = pos.isPublic || false;
    }
  }
  visibilityToggle = makeVisibilityToggle('pos-visibility', initPublic);
  document.getElementById('add-position-modal').style.display='flex';
}

async function savePosition(){
  var ticker=document.getElementById('pos-ticker').value.trim().toUpperCase();
  if(!ticker){alert('Ticker is required.');return;}
  var entryPrice=parseFloat(document.getElementById('pos-entry-price').value);
  if(isNaN(entryPrice)){alert('Entry price is required.');return;}
  var pos={id:editingId,ticker:ticker,name:document.getElementById('pos-name').value.trim(),exchange:document.getElementById('pos-exchange').value,entryDate:document.getElementById('pos-entry-date').value,entryPrice:entryPrice,target:parseFloat(document.getElementById('pos-target').value)||null,stop:parseFloat(document.getElementById('pos-stop').value)||null,thesis:document.getElementById('pos-thesis').value.trim(),status:document.getElementById('pos-status').value,conviction:getConvictionPicker('conviction-picker'),isPublic:visibilityToggle?visibilityToggle.getValue():false};
  await Store.savePosition(pos);
  closeModal('add-position-modal');
  render();
}

async function deletePos(id){
  if(!confirm('Delete this position?'))return;
  await Store.deletePosition(id);
  render();
}

function render(){
  var loggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn();
  var all = Store.getPositions();
  var positions = loggedIn ? all : all.filter(function(p){return p.isPublic;});
  if(filterStatus!=='all') positions=positions.filter(function(p){return p.status===filterStatus;});
  if(filterMarket)         positions=positions.filter(function(p){return p.exchange===filterMarket;});

  var myAll = loggedIn ? Store.getMyPositions() : [];
  document.getElementById('port-total').textContent=myAll.length||all.filter(function(p){return p.isPublic;}).length;
  document.getElementById('port-open').textContent=myAll.filter(function(p){return p.status==='open';}).length;
  document.getElementById('port-closed').textContent=myAll.filter(function(p){return p.status==='closed';}).length;
  var wins=myAll.filter(function(p){return p.status==='closed'&&p.pnlPct>0;}).length;
  var closed=myAll.filter(function(p){return p.status==='closed';}).length;
  document.getElementById('port-winrate').textContent=closed?Math.round((wins/closed)*100)+'%':'—';

  var tbody=document.getElementById('portfolio-tbody');
  if(!positions.length){tbody.innerHTML='<tr><td colspan="11"><div class="empty-state"><div class="empty-state-icon">📊</div><p class="empty-state-title">No positions</p></div></td></tr>';return;}
  tbody.innerHTML=positions.map(function(p){
    var isOwn = canEdit(p);
    return '<tr>' +
      '<td><span class="ticker">'+escHtml(p.ticker)+'</span>'+(p.name?'<br><span class="ticker-full">'+escHtml(p.name)+'</span>':'')+'</td>'+
      '<td>'+exchangeBadge(p.exchange)+'</td>'+
      '<td class="mono">'+formatDate(p.entryDate)+'</td>'+
      '<td class="mono">'+(p.entryPrice??'—')+'</td>'+
      '<td class="mono" style="color:var(--gold)">'+(p.target??'—')+'</td>'+
      '<td class="mono" style="color:var(--red)">'+(p.stop??'—')+'</td>'+
      '<td>'+convictionBadge(p.conviction)+'</td>'+
      '<td>'+(p.status==='open'?'<span class="badge badge-green">Open</span>':'<span class="badge badge-neutral">Closed</span>')+'</td>'+
      '<td>'+(p.pnlPct!=null?'<span class="'+(p.pnlPct>=0?'positive':'negative')+'" style="font-family:var(--font-mono)">'+(p.pnlPct>=0?'+':'')+p.pnlPct+'%</span>':'—')+'</td>'+
      '<td>'+(p.isPublic?'<span style="font-size:.85rem" title="Public">🌐</span>':'<span style="font-size:.85rem" title="Private">🔒</span>')+'</td>'+
      '<td>'+(isOwn?'<div class="row-actions"><button class="row-action-btn" onclick="openAddPosition(\''+p.id+'\')">Edit</button><button class="row-action-btn danger" onclick="deletePos(\''+p.id+'\')">✕</button></div>':'<span style="color:var(--text-muted);font-size:.75rem">'+authorBadge(p)+'</span>')+'</td>'+
      '</tr>';
  }).join('');
}

document.querySelectorAll('.filter-btn').forEach(function(btn){
  btn.addEventListener('click',function(){
    if(btn.dataset.filter!==undefined){document.querySelectorAll('[data-filter]').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');filterStatus=btn.dataset.filter;filterMarket=null;document.querySelectorAll('[data-market]').forEach(function(b){b.classList.remove('active');});}
    else if(btn.dataset.market!==undefined){var isActive=btn.classList.contains('active');document.querySelectorAll('[data-market]').forEach(function(b){b.classList.remove('active');});if(!isActive){btn.classList.add('active');filterMarket=btn.dataset.market;}else{filterMarket=null;}}
    render();
  });
});

document.querySelectorAll('#conviction-picker .cpip').forEach(function(btn){
  btn.addEventListener('click',function(){document.querySelectorAll('#conviction-picker .cpip').forEach(function(b){b.classList.remove('selected');});btn.classList.add('selected');});
});

// Update table header to include Visibility column
document.addEventListener('DOMContentLoaded', function() {
  var thead = document.querySelector('#portfolio-table thead tr');
  if (thead) {
    var th = document.createElement('th');
    th.textContent = 'Visibility';
    thead.insertBefore(th, thead.children[9]);
  }
});

StoreInit(function(){
  updateAuthNav();
  if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
    showLoginPromptIfNeeded('.page-wrapper .container');
  }
  render();
});

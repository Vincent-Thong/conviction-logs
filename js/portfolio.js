/* portfolio.js */
let editingId=null, filterStatus='all', filterMarket=null;

function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function openAddPosition(id){
  editingId=id||null;
  ['pos-ticker','pos-name','pos-entry-date','pos-entry-price','pos-target','pos-stop','pos-thesis'].forEach(fid=>{const el=document.getElementById(fid);if(el)el.value='';});
  document.getElementById('pos-exchange').value='HK';
  document.getElementById('pos-status').value='open';
  document.querySelectorAll('#conviction-picker .cpip').forEach(b=>b.classList.remove('selected'));
  if(id){
    const pos=Store.getPositions().find(p=>p.id===id);
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
    }
  }
  document.getElementById('add-position-modal').style.display='flex';
}

async function savePosition(){
  const ticker=document.getElementById('pos-ticker').value.trim().toUpperCase();
  if(!ticker){alert('Ticker is required.');return;}
  const entryPrice=parseFloat(document.getElementById('pos-entry-price').value);
  if(isNaN(entryPrice)){alert('Entry price is required.');return;}
  const pos={id:editingId,ticker,name:document.getElementById('pos-name').value.trim(),exchange:document.getElementById('pos-exchange').value,entryDate:document.getElementById('pos-entry-date').value,entryPrice,target:parseFloat(document.getElementById('pos-target').value)||null,stop:parseFloat(document.getElementById('pos-stop').value)||null,thesis:document.getElementById('pos-thesis').value.trim(),status:document.getElementById('pos-status').value,conviction:getConvictionPicker('conviction-picker')};
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
  let positions=Store.getPositions();
  if(filterStatus!=='all') positions=positions.filter(p=>p.status===filterStatus);
  if(filterMarket)         positions=positions.filter(p=>p.exchange===filterMarket);
  const all=Store.getPositions();
  const open=all.filter(p=>p.status==='open').length;
  const closed=all.filter(p=>p.status==='closed').length;
  const wins=all.filter(p=>p.status==='closed'&&p.pnlPct>0).length;
  document.getElementById('port-total').textContent=all.length;
  document.getElementById('port-open').textContent=open;
  document.getElementById('port-closed').textContent=closed;
  document.getElementById('port-winrate').textContent=closed?`${Math.round((wins/closed)*100)}%`:'—';
  const tbody=document.getElementById('portfolio-tbody');
  if(!positions.length){tbody.innerHTML=`<tr><td colspan="10"><div class="empty-state"><div class="empty-state-icon">📊</div><p class="empty-state-title">No positions</p></div></td></tr>`;return;}
  tbody.innerHTML=positions.map(p=>`<tr>
    <td><span class="ticker">${escHtml(p.ticker)}</span>${p.name?`<br><span class="ticker-full">${escHtml(p.name)}</span>`:''}</td>
    <td>${exchangeBadge(p.exchange)}</td>
    <td class="mono">${formatDate(p.entryDate)}</td>
    <td class="mono">${p.entryPrice??'—'}</td>
    <td class="mono" style="color:var(--gold)">${p.target??'—'}</td>
    <td class="mono" style="color:var(--red)">${p.stop??'—'}</td>
    <td>${convictionBadge(p.conviction)}</td>
    <td>${p.status==='open'?'<span class="badge badge-green">Open</span>':'<span class="badge badge-neutral">Closed</span>'}</td>
    <td>${p.pnlPct!=null?`<span class="${p.pnlPct>=0?'positive':'negative'}" style="font-family:var(--font-mono)">${p.pnlPct>=0?'+':''}${p.pnlPct}%</span>`:'—'}</td>
    <td><div class="row-actions"><button class="row-action-btn" onclick="openAddPosition('${p.id}')">Edit</button><button class="row-action-btn danger" onclick="deletePos('${p.id}')">✕</button></div></td>
  </tr>`).join('');
}

document.querySelectorAll('.filter-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    if(btn.dataset.filter!==undefined){document.querySelectorAll('[data-filter]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');filterStatus=btn.dataset.filter;filterMarket=null;document.querySelectorAll('[data-market]').forEach(b=>b.classList.remove('active'));}
    else if(btn.dataset.market!==undefined){const isActive=btn.classList.contains('active');document.querySelectorAll('[data-market]').forEach(b=>b.classList.remove('active'));if(!isActive){btn.classList.add('active');filterMarket=btn.dataset.market;}else{filterMarket=null;}}
    render();
  });
});

document.querySelectorAll('#conviction-picker .cpip').forEach(btn=>{
  btn.addEventListener('click',()=>{document.querySelectorAll('#conviction-picker .cpip').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');});
});

StoreInit(render);

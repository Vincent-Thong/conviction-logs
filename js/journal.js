/* journal.js */
let editingEntryId=null, searchTerm='', typeFilter='all';
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function openNewEntry(id){
  editingEntryId=id||null;
  ['entry-title','entry-ticker','entry-tags','entry-body'].forEach(fid=>{const el=document.getElementById(fid);if(el)el.value='';});
  document.getElementById('entry-type').value='thesis';
  document.getElementById('entry-exchange').value='';
  document.getElementById('entry-date').value=new Date().toISOString().slice(0,10);
  document.querySelectorAll('#entry-conviction-picker .cpip').forEach(b=>b.classList.remove('selected'));
  document.getElementById('entry-modal-title').textContent='New Journal Entry';
  if(id){
    const e=Store.getEntries().find(x=>x.id===id);
    if(e){
      document.getElementById('entry-modal-title').textContent='Edit Entry';
      document.getElementById('entry-title').value=e.title||'';
      document.getElementById('entry-type').value=e.type||'thesis';
      document.getElementById('entry-ticker').value=e.ticker||'';
      document.getElementById('entry-exchange').value=e.exchange||'';
      document.getElementById('entry-date').value=e.date||'';
      document.getElementById('entry-body').value=e.body||'';
      document.getElementById('entry-tags').value=(e.tags||[]).join(', ');
      setConvictionPicker('entry-conviction-picker',e.conviction);
    }
  }
  document.getElementById('entry-modal').style.display='flex';
}

async function saveEntry(){
  const title=document.getElementById('entry-title').value.trim();
  if(!title){alert('Title is required.');return;}
  const body=document.getElementById('entry-body').value.trim();
  if(!body){alert('Entry body is required.');return;}
  const entry={id:editingEntryId,title,type:document.getElementById('entry-type').value,ticker:document.getElementById('entry-ticker').value.trim().toUpperCase()||null,exchange:document.getElementById('entry-exchange').value||null,date:document.getElementById('entry-date').value,body,tags:document.getElementById('entry-tags').value.split(',').map(t=>t.trim()).filter(Boolean),conviction:getConvictionPicker('entry-conviction-picker')};
  await Store.saveEntry(entry);
  closeModal('entry-modal');
  render();
}

function viewEntry(id){
  const e=Store.getEntries().find(x=>x.id===id);if(!e)return;
  document.getElementById('view-title').textContent=e.title;
  document.getElementById('view-body').textContent=e.body;
  document.getElementById('view-meta').innerHTML=[`<span>${formatDate(e.date)}</span>`,`<span class="badge ${typeBadgeClass(e.type)}">${e.type}</span>`,e.ticker?`<span class="ticker" style="color:var(--text-secondary)">${escHtml(e.ticker)}</span>`:'',e.exchange?exchangeBadge(e.exchange):'',e.conviction?convictionBadge(e.conviction):''].filter(Boolean).join('<span style="margin:0 6px;color:var(--border)">·</span>');
  document.getElementById('view-tags').innerHTML=(e.tags||[]).map(t=>`<span class="tag">${escHtml(t)}</span>`).join('');
  document.getElementById('view-edit-btn').onclick=()=>{closeModal('view-modal');openNewEntry(id);};
  document.getElementById('view-modal').style.display='flex';
}

async function deleteEnt(id){
  if(!confirm('Delete this entry?'))return;
  await Store.deleteEntry(id);
  render();
}

function render(){
  let entries=Store.getEntries();
  if(typeFilter!=='all') entries=entries.filter(e=>e.type===typeFilter);
  if(searchTerm){const q=searchTerm.toLowerCase();entries=entries.filter(e=>(e.title||'').toLowerCase().includes(q)||(e.body||'').toLowerCase().includes(q)||(e.ticker||'').toLowerCase().includes(q));}
  const container=document.getElementById('journal-entries');
  if(!entries.length){container.innerHTML=`<div class="empty-state"><div class="empty-state-icon">✦</div><p class="empty-state-title">${searchTerm||typeFilter!=='all'?'No matching entries':'Your journal is empty'}</p><br/><button class="btn btn-primary" onclick="openNewEntry()">Write First Entry</button></div>`;return;}
  container.innerHTML=entries.map(e=>`
    <div class="journal-card" onclick="viewEntry('${e.id}')">
      <div class="journal-card-top">
        <span class="badge ${typeBadgeClass(e.type)}">${e.type}</span>
        ${e.ticker?`<span class="ticker" style="font-size:.8125rem">${escHtml(e.ticker)}</span>`:''}
        ${e.exchange?exchangeBadge(e.exchange):''}
        ${e.conviction?convictionBadge(e.conviction):''}
        <span class="journal-card-date">${formatDate(e.date)}</span>
      </div>
      <div class="journal-card-title">${escHtml(e.title)}</div>
      <div class="journal-card-excerpt">${escHtml(e.body)}</div>
      <div class="journal-card-footer">
        ${(e.tags||[]).map(t=>`<span class="tag">${escHtml(t)}</span>`).join('')}
        <div class="journal-card-actions" onclick="event.stopPropagation()">
          <button class="row-action-btn" onclick="openNewEntry('${e.id}')">Edit</button>
          <button class="row-action-btn danger" onclick="deleteEnt('${e.id}')">✕</button>
        </div>
      </div>
    </div>`).join('');
}

document.querySelectorAll('#entry-conviction-picker .cpip').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('#entry-conviction-picker .cpip').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');});});
const searchEl=document.getElementById('journal-search');if(searchEl)searchEl.addEventListener('input',e=>{searchTerm=e.target.value;render();});
const filterEl=document.getElementById('journal-filter-type');if(filterEl)filterEl.addEventListener('change',e=>{typeFilter=e.target.value;render();});

StoreInit(()=>{
  render();
  const params=new URLSearchParams(window.location.search);
  if(params.get('new')==='1')openNewEntry();
});

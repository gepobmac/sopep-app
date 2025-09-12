// views.js — telas/fluxos
import { $, $$, fmt, todayISO, uuid, toast } from './utils.js';
import { DB, store, recalcMinimums, totalKits } from './db.js';

// Helpers
export function getItemName(id){
  const i = store.get(DB.itens, []).find(x=>x.id===id);
  return i ? i.nome : id;
}
function mk(idPrefix, len=6){
  return idPrefix + '-' + Math.random().toString(36).slice(2,2+len).toUpperCase();
}

/* ===== Movimentações e Reorders ===== */
export function addMovimento({ tipo, itemId, qtd, motivo, ref }){
  const itens = store.get(DB.itens, []);
  const it = itens.find(x=>x.id===itemId);
  if(!it) return;

  if(tipo==='entrada') it.estoque += Number(qtd);
  if(tipo==='saida')   it.estoque = Math.max(0, it.estoque - Number(qtd));
  store.set(DB.itens, itens);

  const movs = store.get(DB.movs, []);
  movs.push({
    id: mk('M'),
    data: new Date().toISOString(),
    tipo, itemId, qtd:Number(qtd),
    motivo, ref: ref||null
  });
  store.set(DB.movs, movs);

  if(it.estoque <= it.min) openReorderIfNone(it);
}

function openReorderIfNone(item){
  const reos = store.get(DB.reorders, []);
  const exists = reos.some(r=> r.itemId===item.id && r.status==='aberta');
  if(exists) return;
  const sugerido = Math.max(
    Math.ceil(item.min * 1.5) - item.estoque,
    item.min - item.estoque + Math.ceil(item.min * 0.2)
  );
  reos.push({
    id: mk('OC',5),
    itemId: item.id,
    item: item.nome,
    criadoEm: new Date().toISOString(),
    estoque: item.estoque,
    min: item.min,
    sugerido,
    status: 'aberta'
  });
  store.set(DB.reorders, reos);
  toast(`Ordem de compra aberta para ${item.nome} (sug.: ${sugerido})`);
}

/* ===== Dashboard ===== */
export function buildDashboard(){
  const regs   = store.get(DB.registros, []);
  const pend   = regs.filter(r=>r.status==='pendente').length;
  $('#badgePendentes').textContent = `${pend} pendentes`;

  const itens  = store.get(DB.itens, []);
  const baixos = itens.filter(i=> i.estoque <= i.min).length;
  $('#badgeBaixos').textContent = `${baixos} itens com estoque baixo`;

  $('#badgeKits').textContent = `${totalKits()} kits ativos`;

  const ym = new Date().toISOString().slice(0,7);
  const regsMes = regs.filter(r=> (r.data||'').slice(0,7)===ym);
  $('#statRegistrosMes').textContent = regsMes.length;

  const consumoMes = regsMes.reduce((acc,r)=> acc + r.itens.reduce((s,i)=>s+Number(i.qtd||0),0), 0);
  $('#statConsumoMes').textContent = fmt(consumoMes);

  const reorders = store.get(DB.reorders, []).filter(o=>o.status==='aberta').length;
  $('#statReorders').textContent = reorders;

  const alertWrap = $('#listaAlertas'); alertWrap.innerHTML = '';
  itens.filter(i=> i.estoque <= i.min).forEach(i=>{
    const div = document.createElement('div');
    div.className = 'stat';
    const falta = i.min - i.estoque;
    div.innerHTML = `
      <div><strong>${i.nome}</strong>
        <div class="muted">Estoque ${fmt(i.estoque)} / Mín ${fmt(i.min)}</div>
      </div>
      <div><span class="badge low">Falta ${fmt(Math.max(falta,0))}</span></div>`;
    alertWrap.appendChild(div);
  });
}

/* ===== Registro de Uso ===== */
export function buildRegistro(){
  const kits = store.get(DB.kits, []).filter(k=>k.ativo);
  const sel = $('#regKit'); sel.innerHTML = '';
  kits.forEach(k=>{
    const o=document.createElement('option');
    o.value=k.id; o.textContent=`${k.nome} — ${k.local}`;
    sel.appendChild(o);
  });
  $('#regResp').value = '';
  $('#regData').value = todayISO();

  const tbody = $('#regItensBody'); tbody.innerHTML='';
  addRegistroItemRow();
}

export function addRegistroItemRow(){
  const items = store.get(DB.itens, []);
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <select class="select sel-item">
        ${items.map(i=>`<option value="${i.id}">${i.nome}</option>`).join('')}
      </select>
    </td>
    <td><input class="input qtd-item" type="number" min="0" step="1" placeholder="0" /></td>
    <td class="right"><button type="button" class="btn outline btn-remove">Remover</button></td>`;
  $('#regItensBody').appendChild(tr);
  tr.querySelector('.btn-remove').onclick = ()=> tr.remove();
}

export function handleRegistroSubmit(e){
  e.preventDefault();
  const id     = uuid();
  const data   = $('#regData').value || todayISO();
  const resp   = $('#regResp').value?.trim();
  const kit    = $('#regKit').value;
  const motivo = $('#regMotivo').value;

  const itens = [];
  $$('#regItensBody tr').forEach(tr=>{
    const itemId = tr.querySelector('.sel-item').value;
    const qtd    = Number(tr.querySelector('.qtd-item').value||0);
    if(qtd>0) itens.push({itemId, qtd});
  });

  if(!resp){ toast('Informe o responsável.'); return }
  if(itens.length===0){ toast('Adicione ao menos um item com quantidade.'); return }

  const evidencias = [...($('#regFiles').files||[])].map(f=>f.name);

  const registro = { id, data, resp, kit, motivo, itens, evidencias, status:'pendente' };
  const arr = store.get(DB.registros, []); arr.push(registro); store.set(DB.registros, arr);

  const resumo = $('#registroResumo');
  resumo.innerHTML = `Código: <strong>${id}</strong><br>Data: ${data}<br>Kit: ${kit}<br>Motivo: ${motivo}<br>Resp: ${resp}<br>Itens: ${itens.map(i=>`${i.itemId}(${i.qtd})`).join(', ')}`;
  $('#registroEmitido').style.display='block';
  toast('Registro emitido. Aguardando aprovação da Fiscalização.');
}

/* ===== Aprovações ===== */
export function buildAprovacoes(){
  const tbody = $('#aprovTable'); tbody.innerHTML='';
  const regs = store.get(DB.registros, [])
    .sort((a,b)=> (b.status==='pendente')-(a.status==='pendente') || b.data.localeCompare(a.data));

  regs.forEach(r=>{
    const tr = document.createElement('tr');
    const statusBadge = r.status==='pendente'
      ? '<span class="badge pending">Pendente</span>'
      : (r.status==='aprovado' ? '<span class="badge ok">Aprovado</span>' : '<span class="badge danger">Reprovado</span>');
    tr.innerHTML = `
      <td class="mono">${r.id}</td><td>${r.data}</td><td>${r.kit}</td><td>${r.motivo}</td><td>${r.resp}</td><td>${statusBadge}</td>
      <td>
        <div class="toolbar">
          <button class="btn ok" ${r.status!=='pendente'?'disabled':''}>Aprovar</button>
          <button class="btn danger" ${r.status!=='pendente'?'disabled':''}>Reprovar</button>
          <button class="btn outline">Detalhes</button>
        </div>
      </td>`;
    const [btnOk, btnNo, btnDet] = tr.querySelectorAll('button');
    btnOk.onclick = ()=> decideRegistro(r.id, 'aprovado');
    btnNo.onclick = ()=> decideRegistro(r.id, 'reprovado');
    btnDet.onclick = ()=> alert(`Registro ${r.id}\nItens:\n` + r.itens.map(i=>` · ${getItemName(i.itemId)}: ${i.qtd}`).join('\n'));
    tbody.appendChild(tr);
  });
}

export function decideRegistro(id, decisao){
  const regs = store.get(DB.registros, []);
  const idx = regs.findIndex(r=>r.id===id);
  if(idx<0) return;
  const reg = regs[idx];
  reg.status   = decisao;
  reg.respCusto = decisao==='aprovado' ? 'Petrobras' : 'Operadora Portuária';

  reg.itens.forEach(it=>{
    addMovimento({
      tipo:'saida',
      itemId: it.itemId,
      qtd: it.qtd,
      motivo:`Reposição do kit ${reg.kit} (registro ${reg.id})`,
      ref: id
    });
  });

  regs[idx] = reg;
  store.set(DB.registros, regs);
  toast(`Registro ${id} ${decisao.toUpperCase()}. Custo: ${reg.respCusto}.`);
}

/* ===== Estoque ===== */
export function buildEstoque(){
  const tb = $('#estoqueTable'); tb.innerHTML='';
  const itens = store.get(DB.itens, []);
  const kits  = totalKits();

  itens.forEach(i=>{
    const tr = document.createElement('tr');
    const need = i.qtdKit * kits;
    const st = i.estoque <= i.min ? '<span class="badge low">Baixo</span>' : '<span class="badge ok">OK</span>';
    tr.innerHTML = `
      <td>${i.nome}</td>
      <td class="mono">${fmt(i.estoque)} ${i.un}</td>
      <td class="mono">${fmt(i.min)}</td>
      <td class="mono">${fmt(i.qtdKit)} ${i.un}</td>
      <td class="mono">${fmt(need)} ${i.un}</td>
      <td>${st}</td>
      <td>
        <div class="toolbar">
          <input class="input mov-qtd" type="number" min="0" step="1" placeholder="Qtd" style="width:90px" />
          <button class="btn ok">Entrada</button>
          <button class="btn warn">Saída</button>
        </div>
      </td>`;
    const [q, btnIn, btnOut] = tr.querySelectorAll('input,button');
    btnIn.onclick = ()=>{
      const val = Number(q.value||0); if(val<=0) return toast('Informe quantidade > 0');
      addMovimento({tipo:'entrada', itemId:i.id, qtd:val, motivo:'Entrada rápida', ref:null});
      buildEstoque(); buildDashboard();
    };
    btnOut.onclick = ()=>{
      const val = Number(q.value||0); if(val<=0) return toast('Informe quantidade > 0');
      addMovimento({tipo:'saida', itemId:i.id, qtd:val, motivo:'Saída rápida', ref:null});
      buildEstoque(); buildDashboard();
    };
    tb.appendChild(tr);
  });
}

export function quickMovDialog(tipo){
  const nome = prompt((tipo==='entrada'?'Entrada':'Saída')+" — informe o ID do item (ex: I-001) ou nome contendo…");
  if(!nome) return;
  const itens = store.get(DB.itens, []);
  const it = itens.find(x=> x.id.toLowerCase()===nome.toLowerCase() || x.nome.toLowerCase().includes(nome.toLowerCase()));
  if(!it) return alert('Item não encontrado');
  const qtd = Number(prompt('Quantidade:'));
  if(!(qtd>0)) return;
  addMovimento({ tipo, itemId: it.id, qtd, motivo:(tipo==='entrada'?'Entrada manual':'Saída manual'), ref:null });
}

/* ===== Kits ===== */
export function buildKits(){
  const tb = $('#kitsTable'); tb.innerHTML='';
  const kits = store.get(DB.kits, []);
  kits.forEach(k=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${k.nome}</td><td>${k.local}</td>
      <td>${k.ativo?'<span class="badge ok">Ativo</span>':'<span class="badge">Inativo</span>'}</td>
      <td>
        <div class="toolbar">
          <button class="btn outline">Editar</button>
          <button class="btn ${k.ativo?'danger':'ok'}">${k.ativo?'Desativar':'Ativar'}</button>
        </div>
      </td>`;
    const [btnEd, btnToggle] = tr.querySelectorAll('button');
    btnEd.onclick = ()=>{
      const nome  = prompt('Nome do kit:', k.nome); if(!nome) return;
      const local = prompt('Local:', k.local); if(!local) return;
      k.nome = nome; k.local = local;
      store.set(DB.kits, kits); recalcMinimums(); buildKits();
    };
    btnToggle.onclick = ()=>{
      k.ativo=!k.ativo;
      store.set(DB.kits, kits); recalcMinimums(); buildKits();
    };
    tb.appendChild(tr);
  });
}

/* ===== Itens ===== */
export function buildItens(){
  const tb = $('#itensTable'); tb.innerHTML='';
  const itens = store.get(DB.itens, []);
  itens.forEach(i=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i.nome}</td><td>${i.un}</td><td>${i.qtdKit}</td><td>${i.min}</td><td>${i.estoque}</td>
      <td>
        <div class="toolbar">
          <button class="btn outline">Editar</button>
          <button class="btn danger">Excluir</button>
        </div>
      </td>`;
    const [btnEd, btnDel] = tr.querySelectorAll('button');
    btnEd.onclick = ()=>{
      const nome    = prompt('Nome do item:', i.nome); if(!nome) return;
      const un      = prompt('Unidade:', i.un) || i.un;
      const qtdKit  = Number(prompt('Qtd por kit:', i.qtdKit) || i.qtdKit);
      const min     = Number(prompt('Mínimo:', i.min) || i.min);
      const estoque = Number(prompt('Estoque:', i.estoque) || i.estoque);
      Object.assign(i, { nome, un, qtdKit, min, estoque });
      store.set(DB.itens, itens);
      buildItens();
    };
    btnDel.onclick = ()=>{
      if(!confirm('Excluir item?')) return;
      const list = store.get(DB.itens, []).filter(x=>x.id!==i.id);
      store.set(DB.itens, list);
      buildItens();
    };
    tb.appendChild(tr);
  });
}
export function addItemMaster(){
  const id      = 'I-'+Math.random().toString(36).slice(2,5).toUpperCase();
  const nome    = prompt('Nome do item:'); if(!nome) return;
  const un      = prompt('Unidade (ex: un, m, pct):','un') || 'un';
  const qtdKit  = Number(prompt('Qtd por kit:',1) || 1);
  const estoque = Number(prompt('Estoque inicial:',0) || 0);
  const arr     = store.get(DB.itens, []);
  arr.push({ id, nome, un, qtdKit, min: 0, estoque });
  store.set(DB.itens, arr);
  recalcMinimums();
  buildItens();
}

/* ===== Relatórios / Reorders ===== */
export function buildRelatorios(){
  $('#repIni').value = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  $('#repFim').value = new Date().toISOString().slice(0,10);
  renderReorders();
}

export function gerarRelatorio(){
  const ini  = $('#repIni').value;
  const fim  = $('#repFim').value;
  const movs = store.get(DB.movs, [])
    .filter(m => m.data.slice(0,10)>=ini && m.data.slice(0,10)<=fim)
    .sort((a,b)=> b.data.localeCompare(a.data));

  const sum = {};
  movs.forEach(m=>{
    const k = m.itemId + '|' + m.tipo;
    sum[k] = (sum[k] || 0) + Number(m.qtd);
  });

  const lines = Object.entries(sum).map(([k, v])=>{
    const [itemId, tipo] = k.split('|');
    return `${tipo.toUpperCase()} — ${getItemName(itemId)}: ${v}`;
  });

  $('#repOut').textContent = lines.join('\n') || 'Sem movimentações no período.';
}

export function renderReorders(){
  const box  = $('#reorderList'); box.innerHTML='';
  const reos = store.get(DB.reorders, []);
  if (reos.length === 0) { box.innerHTML = '<div class="muted">Nenhuma requisição aberta.</div>'; return }
  reos.sort((a,b)=>(a.status==='aberta' ? -1 : 1));
  reos.forEach(r=>{
    const div = document.createElement('div');
    div.className = 'stat';
    div.innerHTML = `
      <div>
        <div><strong>${r.item}</strong> <span class="pill mono">${r.id}</span></div>
        <div class="muted">Estoque ${fmt(r.estoque)} / Mín ${fmt(r.min)} — criado em ${new Date(r.criadoEm).toLocaleString('pt-BR')}</div>
      </div>
      <div class="toolbar">
        <span class="badge ${r.status==='aberta'?'low':'ok'}">${r.status}</span>
        <button class="btn outline" data-act="comprado">Marcar como comprado</button>
        <button class="btn outline" data-act="close">Fechar</button>
      </div>`;
    const [btnOrd, btnClose] = div.querySelectorAll('button');
    btnOrd.onclick  = ()=> updateReorder(r.id, 'comprado');
    btnClose.onclick = ()=> updateReorder(r.id, 'fechar');
    box.appendChild(div);
  });
}

export function updateReorder(id, act){
  const reos = store.get(DB.reorders, []);
  const r = reos.find(x=>x.id===id); if(!r) return;
  if (act==='comprado') r.status='comprado';
  if (act==='fechar')   r.status='fechado';
  store.set(DB.reorders, reos);
  renderReorders(); buildDashboard(); toast('Requisição '+id+' atualizada: '+r.status);
}

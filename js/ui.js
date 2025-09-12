// ============================
// ui.js — Telas e fluxos do sistema
// ============================

import { DB, store, recalcMinimums, totalKits } from './db.js';
import { getCurrentUser } from './auth.js';
import { toast } from './app.js';

// Helpers
const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const fmt = n => new Intl.NumberFormat('pt-BR').format(n);

function getItemName(id) {
  const i = store.get(DB.itens, []).find(x => x.id === id);
  return i ? i.nome : id;
}
function mkID(prefix='X') {
  return prefix + '-' + Math.random().toString(36).slice(2,8).toUpperCase();
}
function mkSOCode() {
  return 'SO-' + new Date().toISOString().slice(0,10).replaceAll('-','') + '-' + Math.random().toString(36).slice(2,8).toUpperCase();
}

/* ============================================================
   Movimentação e Ordens de Compra (gatilho)
============================================================ */
function addMovimento({ tipo, itemId, qtd, motivo, ref }) {
  const itens = store.get(DB.itens, []);
  const it = itens.find(x => x.id === itemId);
  if (!it) return;

  if (tipo === 'entrada') it.estoque += Number(qtd);
  if (tipo === 'saida')   it.estoque = Math.max(0, it.estoque - Number(qtd));

  store.set(DB.itens, itens);

  const movs = store.get(DB.movs, []);
  movs.push({
    id: mkID('M'),
    data: new Date().toISOString(),
    tipo,
    itemId,
    qtd: Number(qtd),
    motivo,
    ref: ref || null
  });
  store.set(DB.movs, movs);

  // Gatilho de compra
  const item = itens.find(x => x.id === itemId);
  if (item.estoque <= item.min) openReorderIfNone(item);
}

function openReorderIfNone(item) {
  const reos = store.get(DB.reorders, []);
  const hasOpen = reos.some(r => r.itemId === item.id && r.status === 'aberta');
  if (hasOpen) return;

  const sugerido = Math.max(
    Math.ceil(item.min * 1.5) - item.estoque,
    item.min - item.estoque + Math.ceil(item.min * 0.2)
  );

  reos.push({
    id: mkID('OC'),
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

/* ============================================================
   DASHBOARD
============================================================ */
export function buildDashboard() {
  const wrap = $('#view-dashboard');
  wrap.innerHTML = '';

  const regs   = store.get(DB.registros, []);
  const pend   = regs.filter(r => r.status === 'pendente').length;
  const itens  = store.get(DB.itens, []);
  const baixos = itens.filter(i => i.estoque <= i.min).length;
  const kits   = totalKits();

  const ym = new Date().toISOString().slice(0,7);
  const regsMes    = regs.filter(r => (r.data || '').slice(0,7) === ym);
  const consumoMes = regsMes.reduce((acc, r) => acc + r.itens.reduce((s, i) => s + Number(i.qtd || 0), 0), 0);
  const reorders   = store.get(DB.reorders, []).filter(o => o.status === 'aberta').length;

  wrap.innerHTML = `
    <div class="section">
      <h2>📊 Visão Geral</h2>
      <div class="toolbar">
        <span class="badge pending">${pend} pendentes</span>
        <span class="badge low">${baixos} itens com estoque baixo</span>
        <span class="badge ok">${kits} kits ativos</span>
      </div>
    </div>

    <div class="grid cols-3">
      <div class="stat"><div>Registros no mês</div><div class="hl">${regsMes.length}</div></div>
      <div class="stat"><div>Consumo (unid) no mês</div><div class="hl">${fmt(consumoMes)}</div></div>
      <div class="stat"><div>Ordens de compra abertas</div><div class="hl">${reorders}</div></div>
    </div>

    <div class="panel" style="margin-top:12px">
      <h3 style="margin:0 0 10px 0">Alertas de Reposição</h3>
      <div id="listaAlertas" class="grid"></div>
    </div>
  `;

  const alertWrap = $('#listaAlertas');
  itens.filter(i => i.estoque <= i.min).forEach(i => {
    const div = document.createElement('div');
    div.className = 'stat';
    const falta = i.min - i.estoque;
    div.innerHTML = `
      <div>
        <strong>${i.nome}</strong>
        <div class="muted">Estoque ${fmt(i.estoque)} / Mín ${fmt(i.min)}</div>
      </div>
      <div><span class="badge low">Falta ${fmt(Math.max(falta,0))}</span></div>
    `;
    alertWrap.appendChild(div);
  });
}

/* ============================================================
   REGISTRO DE USO
============================================================ */
export function buildRegistro() {
  const user = getCurrentUser();
  if (!user) return;

  const wrap = $('#view-registro');
  wrap.innerHTML = '';

  const kits  = store.get(DB.kits, []).filter(k => k.ativo);
  const items = store.get(DB.itens, []);

  const form = document.createElement('form');
  form.className = 'grid cols-2';
  form.innerHTML = `
    <h2 style="grid-column:1/-1">📝 Registro de Uso do Kit</h2>

    <div>
      <label>Local / Kit</label>
      <select class="select" id="regKit">
        ${kits.map(k => `<option value="${k.id}">${k.nome} — ${k.local}</option>`).join('')}
      </select>
    </div>

    <div>
      <label>Motivo</label>
      <select class="select" id="regMotivo">
        <option value="emergencia">Emergência real</option>
        <option value="simulado">Simulado / Treinamento</option>
        <option value="inspecao">Inspeção / Teste</option>
      </select>
    </div>

    <div class="grid cols-2" style="grid-column:1/-1">
      <div>
        <label>Responsável</label>
        <input class="input" id="regResp" value="${user.nome}" required />
      </div>
      <div>
        <label>Data/Hora</label>
        <input class="input" id="regData" type="datetime-local" />
      </div>
    </div>

    <div style="grid-column:1/-1">
      <label>Itens Utilizados</label>
      <table>
        <thead><tr><th>Item</th><th style="width:140px">Qtd</th><th style="width:80px"></th></tr></thead>
        <tbody id="regItensBody"></tbody>
      </table>
      <div class="right" style="margin-top:8px">
        <button type="button" class="btn outline" id="btnAddItem">+ Adicionar Item</button>
      </div>
    </div>

    <div style="grid-column:1/-1">
      <label>Evidências (opcional)</label>
      <input class="input" id="regFiles" type="file" multiple />
    </div>

    <div class="right" style="grid-column:1/-1">
      <button type="submit" class="btn">Gerar Registro</button>
    </div>
  `;
  wrap.appendChild(form);

  const tbody = $('#regItensBody');
  const addRow = () => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <select class="select sel-item">
          ${items.map(i => `<option value="${i.id}">${i.nome}</option>`).join('')}
        </select>
      </td>
      <td><input class="input qtd-item" type="number" min="0" step="1" placeholder="0" /></td>
      <td class="right"><button type="button" class="btn outline btn-remove">Remover</button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelector('.btn-remove').onclick = () => tr.remove();
  };
  addRow();
  $('#btnAddItem').onclick = addRow;

  $('#regData').value = new Date().toISOString().slice(0,16);

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const id     = mkSOCode();
    const data   = $('#regData').value;
    const resp   = $('#regResp').value?.trim();
    const kit    = $('#regKit').value;
    const motivo = $('#regMotivo').value;

    const itens = [];
    $$('#regItensBody tr').forEach(tr => {
      const itemId = tr.querySelector('.sel-item').value;
      const qtd    = Number(tr.querySelector('.qtd-item').value || 0);
      if (qtd > 0) itens.push({ itemId, qtd });
    });

    if (!resp) { toast('Informe o responsável.'); return; }
    if (itens.length === 0) { toast('Adicione ao menos um item.'); return; }

    const evidencias = [...($('#regFiles').files || [])].map(f => f.name);
    const registro = { id, data, resp, kit, motivo, itens, evidencias, status: 'pendente' };

    const arr = store.get(DB.registros, []);
    arr.push(registro);
    store.set(DB.registros, arr);

    toast('Registro emitido. Aguardando aprovação da Fiscalização.');
    buildAprovacoes();
  });
}

/* ============================================================
   APROVAÇÕES
============================================================ */
export function buildAprovacoes() {
  const u = getCurrentUser();
  const wrap = $('#view-aprovacoes');
  wrap.innerHTML = `
    <div class="section">
      <h2>✅ Aprovações da Fiscalização</h2>
      <div class="pill">Clique em detalhes para ver os itens</div>
    </div>
  `;

  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Código</th><th>Data</th><th>Local</th><th>Motivo</th>
        <th>Resp.</th><th>Status</th><th style="width:280px">Ação</th>
      </tr>
    </thead>
    <tbody id="aprovTable"></tbody>
  `;
  wrap.appendChild(table);

  const tbody = $('#aprovTable');
  const regs = store.get(DB.registros, [])
    .sort((a,b) => (b.status === 'pendente') - (a.status === 'pendente') || b.data.localeCompare(a.data));

  regs.forEach(r => {
    const tr = document.createElement('tr');
    const st = r.status === 'pendente'
      ? '<span class="badge pending">Pendente</span>'
      : (r.status === 'aprovado' ? '<span class="badge ok">Aprovado</span>' : '<span class="badge danger">Reprovado</span>');

    const canDecide = (u?.role === 'fiscalizacao' || u?.role === 'desenvolvedor') && r.status === 'pendente';

    tr.innerHTML = `
      <td class="mono">${r.id}</td>
      <td>${r.data}</td>
      <td>${r.kit}</td>
      <td>${r.motivo}</td>
      <td>${r.resp}</td>
      <td>${st}</td>
      <td>
        <div class="toolbar">
          <button class="btn ok" ${canDecide ? '' : 'disabled'}>Aprovar</button>
          <button class="btn danger" ${canDecide ? '' : 'disabled'}>Reprovar</button>
          <button class="btn outline">Detalhes</button>
          <button class="btn danger" ${(u?.role !== 'desenvolvedor') ? 'hidden' : ''}>Excluir</button>
        </div>
      </td>
    `;

    const [btnOk, btnNo, btnDet, btnDel] = tr.querySelectorAll('button');

    btnOk.onclick  = () => decideRegistro(r.id, 'aprovado');
    btnNo.onclick  = () => decideRegistro(r.id, 'reprovado');
    btnDet.onclick = () => alert(`Registro ${r.id}\nItens:\n` + r.itens.map(i => ` · ${getItemName(i.itemId)}: ${i.qtd}`).join('\n'));
    btnDel && (btnDel.onclick = () => {
      if (!confirm('Excluir registro?')) return;
      const arr = store.get(DB.registros, []).filter(x => x.id !== r.id);
      store.set(DB.registros, arr);
      toast('Registro removido.');
      buildAprovacoes();
    });

    tbody.appendChild(tr);
  });
}

function decideRegistro(id, decisao) {
  const regs = store.get(DB.registros, []);
  const idx  = regs.findIndex(r => r.id === id);
  if (idx < 0) return;

  const reg = regs[idx];
  reg.status   = decisao;
  reg.respCusto = decisao === 'aprovado' ? 'Petrobras' : 'Operadora Portuária';

  // Baixa de estoque
  reg.itens.forEach(it => addMovimento({
    tipo: 'saida',
    itemId: it.itemId,
    qtd: it.qtd,
    motivo: `Reposição do kit ${reg.kit} (registro ${reg.id})`,
    ref: id
  }));

  regs[idx] = reg;
  store.set(DB.registros, regs);

  toast(`Registro ${id} ${decisao.toUpperCase()}. Custo: ${reg.respCusto}.`);
  buildAprovacoes();
}

/* ============================================================
   ESTOQUE
============================================================ */
export function buildEstoque() {
  const wrap = $('#view-estoque');
  wrap.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'section';
  bar.innerHTML = `
    <h2>📦 Estoque do Galpão (Real)</h2>
    <div class="toolbar">
      <button class="btn outline" id="btnRecalcMin">Recalcular mínimos</button>
      <button class="btn outline" id="btnNovaEntrada">Entrada rápida</button>
      <button class="btn outline" id="btnNovaSaida">Saída rápida</button>
    </div>
  `;
  wrap.appendChild(bar);

  const tbWrap = document.createElement('table');
  tbWrap.innerHTML = `
    <thead>
      <tr>
        <th>Item</th><th>Estoque</th><th>Mínimo</th><th>Qtd/Kit</th>
        <th>Necessário (kits)</th><th>Status</th><th style="width:220px">Movimentar</th>
      </tr>
    </thead>
    <tbody id="estoqueTable"></tbody>
  `;
  wrap.appendChild(tbWrap);

  const tb   = $('#estoqueTable');
  const itens = store.get(DB.itens, []);
  const kitsQ = totalKits();

  itens.forEach(i => {
    const tr = document.createElement('tr');
    const need = i.qtdKit * kitsQ;
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
      </td>
    `;
    const [q, btnIn, btnOut] = tr.querySelectorAll('input,button');

    btnIn.onclick  = () => {
      const val = Number(q.value || 0);
      if (val <= 0) return toast('Informe quantidade > 0');
      addMovimento({ tipo: 'entrada', itemId: i.id, qtd: val, motivo: 'Entrada rápida', ref: null });
      buildEstoque();
    };
    btnOut.onclick = () => {
      const val = Number(q.value || 0);
      if (val <= 0) return toast('Informe quantidade > 0');
      addMovimento({ tipo: 'saida', itemId: i.id, qtd: val, motivo: 'Saída rápida', ref: null });
      buildEstoque();
    };

    tb.appendChild(tr);
  });

  $('#btnRecalcMin').onclick  = () => { recalcMinimums(); buildEstoque(); toast('Mínimos recalculados.'); };
  $('#btnNovaEntrada').onclick = () => quickMovDialog('entrada');
  $('#btnNovaSaida').onclick   = () => quickMovDialog('saida');
}

function quickMovDialog(tipo) {
  const nome = prompt((tipo === 'entrada' ? 'Entrada' : 'Saída') + ' — informe o ID do item (ex: I-001) ou parte do nome:');
  if (!nome) return;
  const itens = store.get(DB.itens, []);
  const it = itens.find(x =>
    x.id.toLowerCase() === nome.toLowerCase() ||
    x.nome.toLowerCase().includes(nome.toLowerCase())
  );
  if (!it) { alert('Item não encontrado'); return; }
  const qtd = Number(prompt('Quantidade:'));
  if (!(qtd > 0)) return;
  addMovimento({ tipo, itemId: it.id, qtd, motivo: (tipo === 'entrada' ? 'Entrada manual' : 'Saída manual'), ref: null });
  buildEstoque();
}

/* ============================================================
   KITS
============================================================ */
export function buildKits() {
  const wrap = $('#view-kits');
  wrap.innerHTML = `
    <div class="section">
      <h2>🧰 Kits & Configuração</h2>
      <button class="btn outline" id="btnAddKit">+ Adicionar Kit</button>
    </div>
    <table>
      <thead><tr><th>Kit</th><th>Local</th><th>Status</th><th style="width:160px">Ação</th></tr></thead>
      <tbody id="kitsTable"></tbody>
    </table>
  `;

  const tb = $('#kitsTable');
  const kits = store.get(DB.kits, []);
  kits.forEach(k => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${k.nome}</td>
      <td>${k.local}</td>
      <td>${k.ativo ? '<span class="badge ok">Ativo</span>' : '<span class="badge">Inativo</span>'}</td>
      <td>
        <div class="toolbar">
          <button class="btn outline">Editar</button>
          <button class="btn ${k.ativo ? 'danger' : 'ok'}">${k.ativo ? 'Desativar' : 'Ativar'}</button>
        </div>
      </td>
    `;
    const [btnEd, btnToggle] = tr.querySelectorAll('button');
    btnEd.onclick = () => {
      const nome  = prompt('Nome do kit:', k.nome); if (!nome) return;
      const local = prompt('Local:', k.local); if (!local) return;
      k.nome  = nome;
      k.local = local;
      saveKits(kits);
    };
    btnToggle.onclick = () => { k.ativo = !k.ativo; saveKits(kits); };
    tb.appendChild(tr);
  });

  $('#btnAddKit').onclick = () => {
    const nome  = prompt('Nome do kit:'); if (!nome) return;
    const local = prompt('Local do kit:'); if (!local) return;
    const arr = store.get(DB.kits, []);
    arr.push({ id: mkID('K'), nome, local, ativo: true });
    saveKits(arr);
  };
}
function saveKits(kits) {
  store.set(DB.kits, kits);
  recalcMinimums();
  buildKits();
}

/* ============================================================
   ITENS
============================================================ */
export function buildItens() {
  const wrap = $('#view-itens');
  wrap.innerHTML = `
    <div class="section">
      <h2>🧾 Itens & Parâmetros</h2>
      <button class="btn outline" id="btnAddItemMaster">+ Adicionar Item</button>
    </div>
    <table>
      <thead><tr><th>Item</th><th>Unidade</th><th>Qtd/Kit</th><th>Mínimo</th><th>Estoque</th><th style="width:160px">Ação</th></tr></thead>
      <tbody id="itensTable"></tbody>
    </table>
  `;

  const tb = $('#itensTable');
  const itens = store.get(DB.itens, []);
  itens.forEach(i => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i.nome}</td><td>${i.un}</td><td>${i.qtdKit}</td><td>${i.min}</td><td>${i.estoque}</td>
      <td>
        <div class="toolbar">
          <button class="btn outline">Editar</button>
          <button class="btn danger">Excluir</button>
        </div>
      </td>
    `;
    const [btnEd, btnDel] = tr.querySelectorAll('button');
    btnEd.onclick = () => {
      const nome    = prompt('Nome do item:', i.nome); if (!nome) return;
      const un      = prompt('Unidade:', i.un) || i.un;
      const qtdKit  = Number(prompt('Qtd por kit:', i.qtdKit) || i.qtdKit);
      const min     = Number(prompt('Mínimo:', i.min) || i.min);
      const estoque = Number(prompt('Estoque:', i.estoque) || i.estoque);
      Object.assign(i, { nome, un, qtdKit, min, estoque });
      store.set(DB.itens, itens);
      buildItens();
    };
    btnDel.onclick = () => {
      if (!confirm('Excluir item?')) return;
      const list = store.get(DB.itens, []).filter(x => x.id !== i.id);
      store.set(DB.itens, list);
      buildItens();
    };
    tb.appendChild(tr);
  });

  $('#btnAddItemMaster').onclick = () => {
    const id      = mkID('I');
    const nome    = prompt('Nome do item:'); if (!nome) return;
    const un      = prompt('Unidade (ex: un, m, pct):', 'un') || 'un';
    const qtdKit  = Number(prompt('Qtd por kit:', 1) || 1);
    const estoque = Number(prompt('Estoque inicial:', 0) || 0);
    const arr     = store.get(DB.itens, []);
    arr.push({ id, nome, un, qtdKit, min: 0, estoque });
    store.set(DB.itens, arr);
    recalcMinimums();
    buildItens();
  };
}

/* ============================================================
   USUÁRIOS (CRUD) — apenas desenvolvedor
============================================================ */
export function buildUsuarios() {
  const wrap = $('#view-usuarios');
  wrap.innerHTML = `
    <div class="section">
      <h2>👤 Usuários</h2>
      <div class="toolbar"><button class="btn outline" id="btnAddUser">+ Adicionar Usuário</button></div>
    </div>
    <table>
      <thead><tr><th>User</th><th>Nome</th><th>Perfil</th><th style="width:160px">Ação</th></tr></thead>
      <tbody id="usersTable"></tbody>
    </table>
  `;

  const tbody = $('#usersTable');
  const users = store.get(DB.users, []);
  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${u.user}</td>
      <td>${u.nome}</td>
      <td>${u.role}</td>
      <td>
        <div class="toolbar">
          <button class="btn outline">Editar</button>
          <button class="btn danger">Excluir</button>
        </div>
      </td>
    `;
    const [btnEd, btnDel] = tr.querySelectorAll('button');

    btnEd.onclick = async () => {
      const nome = prompt('Nome:', u.nome) || u.nome;
      const role = prompt('Perfil (desenvolvedor/administracao/fiscalizacao/operacao):', u.role) || u.role;
      const pw   = prompt('Nova senha (deixe vazio para manter):', '') || '';

      const arr  = store.get(DB.users, []);
      const me   = arr.find(x => x.id === u.id);
      me.nome = nome;
      me.role = role;
      if (pw) me.pass = 'plain:' + pw;

      store.set(DB.users, arr);
      buildUsuarios();
      toast('Usuário atualizado.');
    };

    btnDel.onclick = () => {
      if (!confirm('Excluir usuário?')) return;
      const arr = store.get(DB.users, []).filter(x => x.id !== u.id);
      store.set(DB.users, arr);
      buildUsuarios();
      toast('Usuário excluído.');
    };

    tbody.appendChild(tr);
  });

  $('#btnAddUser').onclick = () => {
    const user = prompt('Login:'); if (!user) return;
    const nome = prompt('Nome:') || user;
    const role = prompt('Perfil (desenvolvedor/administracao/fiscalizacao/operacao):', 'operacao') || 'operacao';
    const pass = prompt('Senha:') || '123456';

    const arr = store.get(DB.users, []);
    arr.push({ id: mkID('U'), user, nome, role, pass: 'plain:' + pass });
    store.set(DB.users, arr);
    buildUsuarios();
    toast('Usuário criado.');
  };
}

/* ============================================================
   RELATÓRIOS
============================================================ */
export function buildRelatorios() {
  const wrap = $('#view-relatorios');
  wrap.innerHTML = `
    <h2>🗂️ Relatórios</h2>
    <div class="grid cols-2">
      <div class="panel">
        <h3 style="margin-top:0">Consumo por período</h3>
        <div class="grid cols-2">
          <input class="input" type="date" id="repIni" />
          <input class="input" type="date" id="repFim" />
        </div>
        <div class="right" style="margin-top:8px"><button class="btn" id="btnGerarRep">Gerar</button></div>
        <div id="repOut" class="mono" style="margin-top:10px"></div>
      </div>
      <div class="panel">
        <h3 style="margin-top:0">Requisições de compra</h3>
        <div id="reorderList"></div>
      </div>
    </div>
  `;

  $('#repIni').value = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  $('#repFim').value = new Date().toISOString().slice(0,10);

  $('#btnGerarRep').onclick = () => {
    const ini  = $('#repIni').value;
    const fim  = $('#repFim').value;
    const movs = store.get(DB.movs, [])
      .filter(m => m.data.slice(0,10) >= ini && m.data.slice(0,10) <= fim)
      .sort((a,b) => b.data.localeCompare(a.data));

    const sum = {};
    movs.forEach(m => {
      const k = m.itemId + '|' + m.tipo;
      sum[k] = (sum[k] || 0) + Number(m.qtd);
    });

    const lines = Object.entries(sum).map(([k, v]) => {
      const [itemId, tipo] = k.split('|');
      return `${tipo.toUpperCase()} — ${getItemName(itemId)}: ${v}`;
    });

    $('#repOut').textContent = lines.join('\n') || 'Sem movimentações no período.';
  };

  renderReorders();
}

function renderReorders() {
  const box  = $('#reorderList');
  box.innerHTML = '';

  const reos = store.get(DB.reorders, []);
  if (reos.length === 0) {
    box.innerHTML = '<div class="muted">Nenhuma requisição aberta.</div>';
    return;
  }

  reos.sort((a,b) => (a.status === 'aberta' ? -1 : 1));

  reos.forEach(r => {
    const div = document.createElement('div');
    div.className = 'stat';
    div.innerHTML = `
      <div>
        <div><strong>${r.item}</strong> <span class="pill mono">${r.id}</span></div>
        <div class="muted">Estoque ${fmt(r.estoque)} / Mín ${fmt(r.min)} — criado em ${new Date(r.criadoEm).toLocaleString('pt-BR')}</div>
      </div>
      <div class="toolbar">
        <span class="badge ${r.status === 'aberta' ? 'low' : 'ok'}">${r.status}</span>
        <button class="btn outline" data-act="ordered">Marcar como comprado</button>
        <button class="btn outline" data-act="close">Fechar</button>
      </div>
    `;
    const [btnOrd, btnClose] = div.querySelectorAll('button');
    btnOrd.onclick  = () => updateReorder(r.id, 'comprado');
    btnClose.onclick = () => updateReorder(r.id, 'fechado');
    box.appendChild(div);
  });
}

function updateReorder(id, status) {
  const reos = store.get(DB.reorders, []);
  const r = reos.find(x => x.id === id); 
  if (!r) return;
  r.status = status;
  store.set(DB.reorders, reos);
  renderReorders();
  toast('Requisição ' + id + ' atualizada: ' + r.status);
}


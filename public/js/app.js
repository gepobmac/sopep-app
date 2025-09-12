import { Auth, Data } from './api.js';
import { renderDashboard, renderViewContainer, hideAll } from './ui.js';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
let CURRENT_ROLE;
async function init() {
    // auth
    try {
        const me = await Auth.me();
        CURRENT_ROLE = me.role;
        $('#userBadge').textContent = `${me.name} — ${me.role}`;
    }
    catch {
        location.href = '/';
        return;
    }
    // RBAC visual de botões
    $$('.nav [data-view]').forEach(btn => {
        const roles = (btn.getAttribute('data-roles') || 'desenvolvedor,fiscalizacao,operacao,administracao')
            .split(',').map(s => s.trim());
        if (!roles.includes(CURRENT_ROLE))
            btn.style.display = 'none';
    });
    // nav
    $$('.nav [data-view]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const view = btn.getAttribute('data-view');
            await routeTo(view);
        });
    });
    // logout
    $('#btnLogout')?.addEventListener('click', async () => {
        await Auth.logout();
        location.href = '/';
    });
    await routeTo('dashboard');
}
async function routeTo(view) {
    hideAll();
    if (view === 'dashboard') {
        $('#view-dashboard').removeAttribute('hidden');
        await renderDashboard();
        return;
    }
    if (view === 'registro') {
        // View simplificada (pode plugar seu formulário completo depois)
        renderViewContainer('registro', `
      <h2>📝 Registro de Uso do Kit</h2>
      <div class="muted">Formulário completo pode ser plugado aqui (mesmo markup da sua versão anterior).</div>
    `);
        return;
    }
    if (view === 'aprovacoes') {
        const regs = await Data.registros();
        renderViewContainer('aprovacoes', `
      <h2>✅ Aprovações</h2>
      <table>
        <thead>
          <tr><th>Código</th><th>Data</th><th>Kit</th><th>Motivo</th><th>Resp.</th><th>Status</th><th>Ação</th></tr>
        </thead>
        <tbody>
          ${regs.map((r) => `
            <tr>
              <td>${r.id}</td><td>${r.data}</td><td>${r.kit}</td><td>${r.motivo}</td><td>${r.resp}</td>
              <td>${r.status}</td>
              <td>
                ${(CURRENT_ROLE === 'fiscalizacao' || CURRENT_ROLE === 'desenvolvedor') && r.status === 'pendente' ? `
                  <button class="btn ok" data-act="aprov" data-id="${r.id}">Aprovar</button>
                  <button class="btn danger" data-act="reprov" data-id="${r.id}">Reprovar</button>` : ''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    `);
        $$('#view-aprovacoes [data-act]').forEach(b => {
            b.addEventListener('click', async () => {
                const id = b.getAttribute('data-id');
                const decisao = b.getAttribute('data-act') === 'aprov' ? 'aprovado' : 'reprovado';
                await Data.decidir(id, decisao);
                await routeTo('aprovacoes');
            });
        });
        return;
    }
    if (view === 'estoque') {
        const itens = await Data.itens();
        renderViewContainer('estoque', `
      <h2>📦 Estoque</h2>
      <table>
        <thead><tr><th>Item</th><th>Estoque</th><th>Mínimo</th><th>Qtd/Kit</th><th>Ação</th></tr></thead>
        <tbody>
          ${itens.map(i => `
            <tr>
              <td>${i.nome}</td><td>${i.estoque}</td><td>${i.min}</td><td>${i.qtdKit}</td>
              <td>
                ${(CURRENT_ROLE === 'administracao' || CURRENT_ROLE === 'desenvolvedor') ? `
                <input class="input" style="width:90px" type="number" min="1" step="1" id="q-${i.id}" placeholder="Qtd">
                <button class="btn ok" data-mov="entrada" data-id="${i.id}">Entrada</button>
                <button class="btn warn" data-mov="saida"  data-id="${i.id}">Saída</button>` : ''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    `);
        $$('#view-estoque [data-mov]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const tipo = btn.getAttribute('data-mov');
                const qtd = Number(document.getElementById(`q-${id}`)?.value || '0');
                if (qtd <= 0)
                    return alert('Informe a quantidade');
                await Data.mov(id, tipo, qtd, `${tipo} rápida`);
                await routeTo('estoque');
            });
        });
        return;
    }
    if (view === 'itens') {
        const itens = await Data.itens();
        renderViewContainer('itens', `
      <div class="section">
        <h2>🧾 Itens & Parâmetros</h2>
        ${(CURRENT_ROLE === 'administracao' || CURRENT_ROLE === 'desenvolvedor') ? `<button class="btn outline" id="btnAddItem">+ Adicionar Item</button>` : ''}
      </div>
      <table>
        <thead><tr><th>Item</th><th>Un</th><th>Qtd/Kit</th><th>Min</th><th>Estoque</th></tr></thead>
        <tbody>
          ${itens.map(i => `<tr><td>${i.nome}</td><td>${i.un}</td><td>${i.qtdKit}</td><td>${i.min}</td><td>${i.estoque}</td></tr>`).join('')}
        </tbody>
      </table>
    `);
        document.getElementById('btnAddItem')?.addEventListener('click', async () => {
            const nome = prompt('Nome do item:');
            if (!nome)
                return;
            const un = prompt('Unidade (un, m, pct):', 'un') || 'un';
            const qtdKit = Number(prompt('Qtd por kit:', '1') || '1');
            const estoque = Number(prompt('Estoque inicial:', '0') || '0');
            await Data.addItem({ nome, un, qtdKit, estoque });
            await routeTo('itens');
        });
        return;
    }
    if (view === 'kits') {
        const kits = await Data.kits();
        renderViewContainer('kits', `
      <h2>🧰 Kits</h2>
      <table>
        <thead><tr><th>Kit</th><th>Local</th><th>Status</th></tr></thead>
        <tbody>${kits.map((k) => `<tr><td>${k.nome}</td><td>${k.local}</td><td>${k.ativo ? 'Ativo' : 'Inativo'}</td></tr>`).join('')}</tbody>
      </table>
    `);
        return;
    }
    if (view === 'relatorios') {
        const reos = await Data.reorders();
        renderViewContainer('relatorios', `
      <h2>🗂️ Requisições de compra</h2>
      ${reos.length === 0 ? '<div class="muted">Nenhuma requisição aberta.</div>' : `
        <div class="grid">
          ${reos.map(r => `
            <div class="stat">
              <div>
                <div><strong>${r.item}</strong> <span class="pill mono">${r.id}</span></div>
                <div class="muted">Estoque ${r.estoque} / Mín ${r.min} — ${new Date(r.criadoEm).toLocaleString('pt-BR')}</div>
              </div>
              <div class="toolbar">
                <span class="badge ${r.status === 'aberta' ? 'low' : 'ok'}">${r.status}</span>
                ${(CURRENT_ROLE !== 'operacao') ? `
                  <button class="btn outline" data-act="comprado" data-id="${r.id}">Comprado</button>
                  <button class="btn outline" data-act="fechar" data-id="${r.id}">Fechar</button>` : ''}
              </div>
            </div>`).join('')}
        </div>`}
    `);
        $$('#view-relatorios [data-act]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const act = btn.getAttribute('data-act');
                await Data.reorderAct(id, act);
                await routeTo('relatorios');
            });
        });
        return;
    }
}
init();

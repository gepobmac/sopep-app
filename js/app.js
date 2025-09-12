// ============================
// app.js — Bootstrap, roteamento e guards
// ============================

import { initDB, recalcMinimums, seedUsers } from './db.js';
import { getCurrentUser, logout, canAccess } from './auth.js';
import * as UI from './ui.js';

// Helpers DOM
const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];

export const toast = (msg, ms = 2600) => {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
};
window.toast = toast;

// Inicializa base e usuários padrão
initDB();
seedUsers();
recalcMinimums();

// Views disponíveis
const views = [
  'dashboard','registro','aprovacoes',
  'estoque','kits','itens','usuarios','relatorios'
];

function show(view) {
  views.forEach(v => $('#view-' + v).hidden = (v !== view));
  switch (view) {
    case 'dashboard':   UI.buildDashboard(); break;
    case 'registro':    UI.buildRegistro(); break;
    case 'aprovacoes':  UI.buildAprovacoes(); break;
    case 'estoque':     UI.buildEstoque(); break;
    case 'kits':        UI.buildKits(); break;
    case 'itens':       UI.buildItens(); break;
    case 'usuarios':    UI.buildUsuarios(); break;
    case 'relatorios':  UI.buildRelatorios(); break;
  }
}
window.appShow = show;

// Navbar → alterna as telas
$('#nav')?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (!btn) return;

  const allow = btn.dataset.allow?.split(',').map(s => s.trim()) || null;
  if (allow && !canAccess(allow)) {
    toast('Acesso restrito a: ' + allow.join(', '));
    return;
  }

  show(btn.dataset.view);
});

// Bootstrap da sessão
const appShell = $('#app');
const userBar  = $('#userBar');
const userInfo = $('#userInfo');

$('#btnLogout')?.addEventListener('click', () => {
  logout();
  location.replace('index.html');
});

function startApp() {
  const user = getCurrentUser();
  if (!user) {
    location.replace('index.html');
    return;
  }

  appShell.hidden = false;
  userBar.hidden = false;
  userInfo.textContent = `${user.nome} · ${user.role}`;

  // RBAC declarativo no menu
  $$('#nav [data-allow]').forEach(btn => {
    const allow = btn.dataset.allow.split(',').map(s => s.trim());
    btn.hidden = !canAccess(allow);
  });

  show('dashboard');
}

startApp();


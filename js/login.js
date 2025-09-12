// ============================
// login.js — Tela de Login
// ============================

import { auth } from './auth.js';

const $ = (s, el = document) => el.querySelector(s);

const form = $('#formLogin');
const msg  = $('#loginMsg');

function setLoading(loading) {
  const btn = form?.querySelector('button[type="submit"]');
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Entrando…' : 'Entrar';
}

async function doLogin(e) {
  e?.preventDefault?.();
  msg.textContent = '';

  const user = $('#loginUser')?.value?.trim();
  const pass = $('#loginPass')?.value;

  if (!user || !pass) {
    msg.textContent = 'Informe usuário e senha.';
    return;
  }

  try {
    setLoading(true);
    const ok = await auth(user, pass);
    if (!ok) {
      msg.textContent = 'Usuário ou senha inválidos.';
      return;
    }
    // Sucesso → vai para o app
    location.replace('app.html');
  } catch (err) {
    console.error(err);
    msg.textContent = 'Erro ao autenticar. Tente novamente.';
  } finally {
    setLoading(false);
  }
}

// Suporte a Enter e clique no botão
form?.addEventListener('submit', doLogin);

// Acessibilidade: Enter em qualquer campo
['loginUser', 'loginPass'].forEach(id => {
  const el = document.getElementById(id);
  el?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin(e);
  });
});


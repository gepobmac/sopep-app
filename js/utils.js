// utils.js — helpers globais
export const PROFILE_KEY = 'sopep_profile';
export const $  = (sel, el=document) => el.querySelector(sel);
export const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];
export const fmt = n => new Intl.NumberFormat('pt-BR').format(n);
export const todayISO = () => new Date().toISOString().slice(0,16);
export const uuid = () =>
  'SO-' + new Date().toISOString().slice(0,10).replaceAll('-','') + '-' +
  Math.random().toString(36).slice(2,8).toUpperCase();

export const toast = (msg, ms=2600) => {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), ms);
};

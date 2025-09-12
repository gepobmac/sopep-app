// ============================
// auth.js — Autenticação & RBAC (client-side preview)
// ============================

import { store, DB } from './db.js';

const CURRENT = 'sopep_current_user';

/**
 * Autentica usuário contra o "banco" local (localStorage).
 * Salva a sessão corrente em CURRENT.
 * @returns {Promise<boolean>}
 */
export async function auth(user, pass) {
  const users = store.get(DB.users, []);
  const u = users.find(x => x.user.toLowerCase() === String(user).toLowerCase());
  if (!u) return false;

  const ok = await verify(pass, u.pass);
  if (!ok) return false;

  store.set(CURRENT, { id: u.id, user: u.user, nome: u.nome, role: u.role });
  return true;
}

/** Retorna o usuário logado (ou null) */
export function getCurrentUser() {
  return store.get(CURRENT, null);
}

/** Finaliza a sessão corrente */
export function logout() {
  localStorage.removeItem(CURRENT);
}

/**
 * Verifica se o usuário atual possui pelo menos um dos papéis exigidos.
 * @param {string[]} roles - lista de roles permitidos (ex.: ['fiscalizacao','desenvolvedor'])
 * @returns {boolean}
 */
export function canAccess(roles = []) {
  const u = getCurrentUser();
  if (!u) return false;
  if (!Array.isArray(roles) || roles.length === 0) return true;
  return roles.includes(u.role) || roles.includes('*');
}

/* ============================================================
   Hash e verificação de senha (preview)
   - Para prévia local: aceita formato 'plain:senha' ou SHA-256.
   - Em produção: validar no servidor (JWT/BCrypt).
============================================================ */

/** Calcula SHA-256 (quando disponível) */
async function digest(str) {
  if (window.crypto?.subtle) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simples
  return 'plain:' + str;
}

/** Gera hash (usado apenas se quiser migrar "plain:" para SHA) */
export async function hash(pass) {
  return await digest(pass);
}

/**
 * Verifica senha contra hash armazenado.
 * Suporta:
 *  - 'plain:senha'
 *  - sha256(hex)
 */
export async function verify(pass, hashed) {
  if (typeof hashed !== 'string') return false;
  if (hashed.startsWith('plain:')) return ('plain:' + pass) === hashed;

  // Comparação SHA-256
  const sha = await digest(pass);
  // Se o ambiente não suportar crypto.subtle, digest volta 'plain:...'
  if (sha.startsWith('plain:')) return false;
  return sha === hashed;
}


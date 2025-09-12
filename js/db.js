// ============================
// db.js — Mini banco local (localStorage)
// ============================

export const DB = {
  itens: 'sopep_itens',
  kits: 'sopep_kits',
  registros: 'sopep_registros',
  movs: 'sopep_movs',
  reorders: 'sopep_reorders',
  params: 'sopep_params',
  users: 'sopep_users'
};

export const store = {
  get(k, d) {
    try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d }
  },
  set(k, v) {
    localStorage.setItem(k, JSON.stringify(v))
  }
};

// ============================
// Inicialização do banco
// ============================
export function initDB() {
  if (!store.get(DB.params))
    store.set(DB.params, { safety: 0.10 });

  if (!store.get(DB.kits))
    store.set(DB.kits, [
      { id: 'K-OPRT-A', nome: 'OPRT-A', local: 'Píer 1 – BMAC', ativo: true },
      { id: 'K-OPRT-BG', nome: 'OPRT-BG', local: 'Píer 2 – BMAC', ativo: true },
      { id: 'K-OPRT-CL', nome: 'OPRT-CL', local: 'Cais Logístico – BMAC', ativo: true },
      { id: 'K-OPRT-MEQ', nome: 'OPRT-MEQ', local: 'Pátio de Equipamentos – BMAC', ativo: true },
      { id: 'K-OPRT-M', nome: 'OPRT-M', local: 'Sala de Monitoramento – BMAC', ativo: true },
    ]);

  if (!store.get(DB.itens)) {
    store.set(DB.itens, [
      { id: 'I-001', nome: 'Manta Absorvente (pacotes)', un: 'pct', qtdKit: 10, min: 0, estoque: 220 },
      { id: 'I-002', nome: 'Cordão Absorvente (m)', un: 'm', qtdKit: 15, min: 0, estoque: 500 },
      { id: 'I-003', nome: 'Travesseiro Absorvente (un)', un: 'un', qtdKit: 6, min: 0, estoque: 140 },
      { id: 'I-004', nome: 'Sacos para Descarte (un)', un: 'un', qtdKit: 12, min: 0, estoque: 400 },
      { id: 'I-005', nome: 'Luvas Nitrílicas (pares)', un: 'par', qtdKit: 6, min: 0, estoque: 160 },
      { id: 'I-006', nome: 'Óculos de Segurança (un)', un: 'un', qtdKit: 2, min: 0, estoque: 60 },
      { id: 'I-007', nome: 'Macacão Tyvek (un)', un: 'un', qtdKit: 2, min: 0


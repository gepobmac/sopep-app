// db.js — storage, seed, mínimos
import { toast } from './utils.js';

export const DB = {
  itens: 'sopep_itens',
  kits: 'sopep_kits',
  registros: 'sopep_registros',
  movs: 'sopep_movs',
  reorders: 'sopep_reorders',
  params: 'sopep_params',
};

export const store = {
  get(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d }catch{ return d } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); },
};

export function seedIfEmpty(){
  if(!store.get(DB.params)){
    store.set(DB.params, { safety: 0.10 });
  }
  if(!store.get(DB.kits)){
    store.set(DB.kits, [
      {id:'K-001', nome:'Navio A', local:'Bacia de Campos', ativo:true},
      {id:'K-002', nome:'Navio B', local:'Bacia de Campos', ativo:true},
      {id:'K-003', nome:'Píer 1',  local:'BMAC',            ativo:true},
    ]);
  }
  if(!store.get(DB.itens)){
    const itens = [
      {id:'I-001', nome:'Manta Absorvente (pacotes)',   un:'pct', qtdKit:10, min:0, estoque:120},
      {id:'I-002', nome:'Cordão Absorvente (metros)',   un:'m',   qtdKit:10, min:0, estoque:300},
      {id:'I-003', nome:'Travesseiro Absorvente (un)',  un:'un',  qtdKit:6,  min:0, estoque:80},
      {id:'I-004', nome:'Sacos para Descarte (un)',     un:'un',  qtdKit:10, min:0, estoque:200},
      {id:'I-005', nome:'Luvas Nitrílicas (pares)',     un:'par', qtdKit:4,  min:0, estoque:60},
      {id:'I-006', nome:'Óculos de Segurança (un)',     un:'un',  qtdKit:2,  min:0, estoque:30},
      {id:'I-007', nome:'Macacão Tyvek (un)',           un:'un',  qtdKit:2,  min:0, estoque:24},
      {id:'I-008', nome:'Pá (un)',                      un:'un',  qtdKit:1,  min:0, estoque:10},
      {id:'I-009', nome:'Vassoura (un)',                un:'un',  qtdKit:1,  min:0, estoque:10},
      {id:'I-010', nome:'Lona Plástica (m²)',           un:'m2',  qtdKit:4,  min:0, estoque:100},
      {id:'I-011', nome:'Bomba Manual (un)',            un:'un',  qtdKit:1,  min:0, estoque:6},
      {id:'I-012', nome:'Barreira Flutuante (boom) (m)',un:'m',   qtdKit:25, min:0, estoque:300},
    ];
    store.set(DB.itens, itens);
    recalcMinimums();
  }
  if(!store.get(DB.registros)) store.set(DB.registros, []);
  if(!store.get(DB.movs))      store.set(DB.movs, []);
  if(!store.get(DB.reorders))  store.set(DB.reorders, []);
}

export function totalKits(){
  return store.get(DB.kits, []).filter(k=>k.ativo).length;
}

export function recalcMinimums(){
  const kits = totalKits();
  const safety = store.get(DB.params).safety;
  const itens = store.get(DB.itens, [])
    .map(i=> ({...i, min: Math.ceil(i.qtdKit * kits * (1 + safety)) }));
  store.set(DB.itens, itens);
  toast('Mínimos recalculados com base em '+kits+' kits e '+Math.round(safety*100)+'% de margem');
}
s

// server/data.ts
export type Role = 'desenvolvedor' | 'fiscalizacao' | 'operacao' | 'administracao';

export interface User {
  id: string;
  username: string;
  password: string;
  role: Role;
  name: string;
}

export interface Item {
  id: string; nome: string; un: string;
  qtdKit: number; min: number; estoque: number;
}

export interface Kit { id: string; nome: string; local: string; ativo: boolean; }

export interface Registro {
  id: string; data: string; resp: string; kit: string;
  motivo: 'emergencia'|'simulado'|'inspecao';
  itens: {itemId: string; qtd: number}[];
  evidencias: string[];
  status: 'pendente'|'aprovado'|'reprovado';
  respCusto?: 'Petrobras'|'Operadora Portuária';
}

export interface Movimento {
  id: string; data: string;
  tipo: 'entrada'|'saida';
  itemId: string; qtd: number;
  motivo: string; ref?: string | null;
}

export interface Reorder {
  id: string; itemId: string; item: string; criadoEm: string;
  estoque: number; min: number; sugerido: number;
  status: 'aberta'|'aprovacao'|'comprado'|'fechado';
}

export const db = {
  params: { safety: 0.10 },
  users: <User[]>[
    { id:'U-1', username:'dev',   password:'dev123',   role:'desenvolvedor', name:'Desenvolvedor' },
    { id:'U-2', username:'fiscal',password:'fiscal123',role:'fiscalizacao',  name:'Fiscalização' },
    { id:'U-3', username:'oper',  password:'oper123',  role:'operacao',      name:'Operação' },
    { id:'U-4', username:'admin', password:'admin123', role:'administracao', name:'Administração' }
  ],
  kits: <Kit[]>[
    {id:'K-001', nome:'Navio A', local:'Bacia de Campos', ativo:true},
    {id:'K-002', nome:'Navio B', local:'Bacia de Campos', ativo:true},
    {id:'K-003', nome:'Píer 1',  local:'BMAC',            ativo:true},
  ],
  itens: <Item[]>[
    {id:'I-001', nome:'Manta Absorvente (pacotes)', un:'pct', qtdKit:10, min:0, estoque:120},
    {id:'I-002', nome:'Cordão Absorvente (metros)', un:'m',   qtdKit:10, min:0, estoque:300},
    {id:'I-003', nome:'Travesseiro Absorvente (un)',un:'un',  qtdKit:6,  min:0, estoque:80},
    {id:'I-004', nome:'Sacos para Descarte (un)',   un:'un',  qtdKit:10, min:0, estoque:200},
    {id:'I-005', nome:'Luvas Nitrílicas (pares)',   un:'par', qtdKit:4,  min:0, estoque:60},
    {id:'I-006', nome:'Óculos de Segurança (un)',   un:'un',  qtdKit:2,  min:0, estoque:30},
    {id:'I-007', nome:'Macacão Tyvek (un)',         un:'un',  qtdKit:2,  min:0, estoque:24},
    {id:'I-008', nome:'Pá (un)',                    un:'un',  qtdKit:1,  min:0, estoque:10},
    {id:'I-009', nome:'Vassoura (un)',              un:'un',  qtdKit:1,  min:0, estoque:10},
    {id:'I-010', nome:'Lona Plástica (m²)',         un:'m2',  qtdKit:4,  min:0, estoque:100},
    {id:'I-011', nome:'Bomba Manual (un)',          un:'un',  qtdKit:1,  min:0, estoque:6},
    {id:'I-012', nome:'Barreira Flutuante (boom) (m)', un:'m', qtdKit:25, min:0, estoque:300},
  ],
  registros: <Registro[]>[],
  movs: <Movimento[]>[],
  reorders: <Reorder[]>[]
};

export function totalKits() {
  return db.kits.filter(k=>k.ativo).length;
}

export function recalcMinimums() {
  const kits = totalKits();
  const safety = db.params.safety;
  db.itens = db.itens.map(i => ({ ...i, min: Math.ceil(i.qtdKit * kits * (1 + safety)) }));
}

export function uuid(prefix='SO') {
  return `${prefix}-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
}

recalcMinimums();

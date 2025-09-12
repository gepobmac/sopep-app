export type Role = 'desenvolvedor' | 'fiscalizacao' | 'operacao' | 'administracao';

export interface Me { id:string; name:string; role: Role }
export interface Item { id:string; nome:string; un:string; qtdKit:number; min:number; estoque:number }
export interface Reorder { id:string; itemId:string; item:string; criadoEm:string; estoque:number; min:number; sugerido:number; status:'aberta'|'comprado'|'fechado' }
export interface Stats { pendentes:number; baixos:number; kitsAtivos:number; registrosMes:number; consumoMes:number; reordersAbertas:number }

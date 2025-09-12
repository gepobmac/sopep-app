import type { Me, Item, Reorder, Stats } from './types.js';

export async function api<T=any>(url:string, init?:RequestInit): Promise<T> {
  const r = await fetch(url, { credentials:'include', ...init });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

export const Auth = {
  me: () => api<Me>('/api/me'),
  logout: () => api('/api/logout', { method:'POST' }),
  login: (username:string, password:string) =>
    api('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password}) })
};

export const Data = {
  stats: () => api<Stats>('/api/stats'),
  itens: () => api<Item[]>('/api/itens'),
  reorders: () => api<Reorder[]>('/api/reorders'),
  kits: () => api<any[]>('/api/kits'),
  registros: () => api<any[]>('/api/registros'),
  decidir: (id:string, decisao:'aprovado'|'reprovado') =>
    api(`/api/registros/${id}/decidir`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ decisao }) }),
  mov: (id:string, tipo:'entrada'|'saida', qtd:number, motivo:string) =>
    api(`/api/itens/${id}/mov`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tipo, qtd, motivo }) }),
  reorderAct: (id:string, act:'comprado'|'fechar') =>
    api(`/api/reorders/${id}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ act }) }),
  addItem: (payload:any) =>
    api('/api/itens', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }),
  registrar: (payload:any) =>
    api('/api/registros', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
};

export async function api(url, init) {
    const r = await fetch(url, { credentials: 'include', ...init });
    if (!r.ok)
        throw new Error(await r.text());
    return r.json();
}
export const Auth = {
    me: () => api('/api/me'),
    logout: () => api('/api/logout', { method: 'POST' }),
    login: (username, password) => api('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
};
export const Data = {
    stats: () => api('/api/stats'),
    itens: () => api('/api/itens'),
    reorders: () => api('/api/reorders'),
    kits: () => api('/api/kits'),
    registros: () => api('/api/registros'),
    decidir: (id, decisao) => api(`/api/registros/${id}/decidir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decisao }) }),
    mov: (id, tipo, qtd, motivo) => api(`/api/itens/${id}/mov`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, qtd, motivo }) }),
    reorderAct: (id, act) => api(`/api/reorders/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ act }) }),
    addItem: (payload) => api('/api/itens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    registrar: (payload) => api('/api/registros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
};

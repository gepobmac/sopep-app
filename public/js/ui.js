import { Data } from './api.js';
import { renderConsumoChart, renderEstoqueChart } from './charts.js';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
export async function renderDashboard() {
    const stats = await Data.stats();
    $('#badgePendentes').textContent = `${stats.pendentes} pendentes`;
    $('#badgeBaixos').textContent = `${stats.baixos} itens com estoque baixo`;
    $('#badgeKits').textContent = `${stats.kitsAtivos} kits ativos`;
    $('#statRegistrosMes').textContent = String(stats.registrosMes);
    $('#statConsumoMes').textContent = String(stats.consumoMes);
    $('#statReorders').textContent = String(stats.reordersAbertas);
    // Charts
    const itens = await Data.itens();
    renderEstoqueChart($('#chartEstoque'), itens);
    // Mock consumo mensal p/ demo — você pode calcular via /api quando tiver movs por mês
    const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const data = labels.map(() => Math.floor(Math.random() * 200));
    renderConsumoChart($('#chartConsumo'), { labels, data });
    // Alertas
    const lista = $('#listaAlertas');
    lista.innerHTML = '';
    itens.filter(i => i.estoque <= i.min).forEach(i => {
        const div = document.createElement('div');
        div.className = 'stat';
        const falta = i.min - i.estoque;
        div.innerHTML = `<div><strong>${i.nome}</strong><div class="muted">Estoque ${i.estoque} / Mín ${i.min}</div></div>
                     <div><span class="badge low">Falta ${Math.max(falta, 0)}</span></div>`;
        lista.appendChild(div);
    });
}
export function renderViewContainer(viewId, html) {
    const root = $('#dynamic-views');
    root.innerHTML = `<section class="panel" id="view-${viewId}">${html}</section>`;
}
export function hideAll() {
    $$('#view-dashboard').forEach(el => el.setAttribute('hidden', ''));
    $('#dynamic-views').innerHTML = '';
}

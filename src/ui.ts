import { Data } from './api.js';
import { renderConsumoChart, renderEstoqueChart } from './charts.js';

const $ = (s:string, el:Document|HTMLElement=document) => el.querySelector(s) as HTMLElement;
const $$ = (s:string, el:Document|HTMLElement=document) => Array.from(el.querySelectorAll(s)) as HTMLElement[];

export async function renderDashboard() {
  const stats = await Data.stats();
  ($('#badgePendentes') as HTMLElement).textContent = `${stats.pendentes} pendentes`;
  ($('#badgeBaixos') as HTMLElement).textContent = `${stats.baixos} itens com estoque baixo`;
  ($('#badgeKits') as HTMLElement).textContent = `${stats.kitsAtivos} kits ativos`;
  ($('#statRegistrosMes') as HTMLElement).textContent = String(stats.registrosMes);
  ($('#statConsumoMes') as HTMLElement).textContent = String(stats.consumoMes);
  ($('#statReorders') as HTMLElement).textContent   = String(stats.reordersAbertas);

  // Charts
  const itens = await Data.itens();
  renderEstoqueChart($('#chartEstoque') as HTMLCanvasElement, itens);

  // Mock consumo mensal p/ demo — você pode calcular via /api quando tiver movs por mês
  const labels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const data   = labels.map(()=>Math.floor(Math.random()*200));
  renderConsumoChart($('#chartConsumo') as HTMLCanvasElement, { labels, data });

  // Alertas
  const lista = $('#listaAlertas'); lista.innerHTML = '';
  itens.filter(i=>i.estoque <= i.min).forEach(i=>{
    const div = document.createElement('div');
    div.className = 'stat';
    const falta = i.min - i.estoque;
    div.innerHTML = `<div><strong>${i.nome}</strong><div class="muted">Estoque ${i.estoque} / Mín ${i.min}</div></div>
                     <div><span class="badge low">Falta ${Math.max(falta,0)}</span></div>`;
    lista.appendChild(div);
  });
}

export function renderViewContainer(viewId: string, html: string) {
  const root = $('#dynamic-views');
  root.innerHTML = `<section class="panel" id="view-${viewId}">${html}</section>`;
}

export function hideAll() {
  ($$('#view-dashboard') as HTMLElement[]).forEach(el => el.setAttribute('hidden',''));
  ($('#dynamic-views') as HTMLElement).innerHTML = '';
}

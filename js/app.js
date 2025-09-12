// app.js — bootstrap/roteamento e actions
import { PROFILE_KEY, $, $$, toast } from './utils.js';
import { seedIfEmpty, recalcMinimums, DB, store } from './db.js';
import {
  buildDashboard, buildRegistro, buildAprovacoes, buildEstoque,
  buildKits, buildItens, buildRelatorios, renderReorders,
  addItemMaster, addRegistroItemRow, handleRegistroSubmit, quickMovDialog,
  gerarRelatorio
} from './views.js';

// === Validadores de input numérico (não negativos) ===
document.addEventListener('input', (e)=>{
  if(e.target.matches('.mov-qtd, .qtd-item')){
    const v = Number(e.target.value||0);
    if(v < 0) e.target.value = 0;
  }
});

// === Seed inicial ===
seedIfEmpty();

// === Roteamento ===
const views = ['dashboard','registro','aprovacoes','estoque','kits','itens','relatorios'];
function show(view){
  views.forEach(v => $('#view-'+v).hidden = (v!==view));
  if(view==='dashboard')  buildDashboard();
  if(view==='registro')   buildRegistro();
  if(view==='aprovacoes') buildAprovacoes();
  if(view==='estoque')    buildEstoque();
  if(view==='kits')       buildKits();
  if(view==='itens')      buildItens();
  if(view==='relatorios') buildRelatorios();
}
window.show = show;

// Nav buttons
$$('.nav button').forEach(b => b.onclick = ()=> show(b.dataset.view));

// === Ações globais do topo ===
$('#exportCsv').onclick = exportCSV;
$('#resetDb').onclick = () => {
  if(confirm('Resetar banco local e recarregar?')){
    localStorage.clear();
    location.reload();
  }
};

// === Perfil (RBAC visual) com persistência ===
function applyProfile(p){
  const isFiscal = (p==='fiscal');
  $$('#view-aprovacoes .btn.ok, #view-aprovacoes .btn.danger').forEach(btn=> btn.disabled = !isFiscal);

  const nav = {
    dashboard: true,
    registro: ['operacao','gestor','fiscal'].includes(p),
    aprovacoes: p==='fiscal',
    estoque: p==='gestor',
    kits: p==='gestor',
    itens: p==='gestor',
    relatorios: ['gestor','fiscal'].includes(p)
  };
  $$('.nav [data-view]').forEach(b=>{
    const view = b.dataset.view;
    b.style.display = (nav[view]!==false) ? 'flex' : 'none';
  });
}
const selPerfil = $('#perfil');
selPerfil.addEventListener('change', e=>{
  const p = e.target.value;
  localStorage.setItem(PROFILE_KEY, p);
  applyProfile(p);
  toast('Perfil alterado: '+p);
});
const savedProfile = localStorage.getItem(PROFILE_KEY) || 'operacao';
selPerfil.value = savedProfile;
applyProfile(savedProfile);

// === Ligações de eventos das views ===
// Registro de uso
$('#btnAddItem').onclick = addRegistroItemRow;
$('#formRegistro').addEventListener('submit', handleRegistroSubmit);
$('#btnPrintRegistro').onclick = ()=> window.print();

// Estoque
$('#btnRecalcMin').onclick  = ()=> { recalcMinimums(); buildEstoque(); };
$('#btnNovaEntrada').onclick = ()=> quickMovDialog('entrada');
$('#btnNovaSaida').onclick   = ()=> quickMovDialog('saida');

// Itens
$('#btnAddItemMaster').onclick = addItemMaster;

// Relatórios
$('#btnGerarRep').onclick = gerarRelatorio;

// Inicial
show('dashboard');
renderReorders();

// === Export CSV (com BOM para Excel) ===
function exportCSV(){
  const itens = store.get(DB.itens, []);
  const regs  = store.get(DB.registros, []);
  const movs  = store.get(DB.movs, []);
  const kits  = store.get(DB.kits, []);

  const csv = [];
  csv.push('"TABELA","CAMPOS"');
  csv.push('"ITENS","id;nome;un;qtdKit;min;estoque"');
  itens.forEach(i=> csv.push(`"ITENS","${i.id};${i.nome};${i.un};${i.qtdKit};${i.min};${i.estoque}"`));
  csv.push('"KITS","id;nome;local;ativo"');
  kits.forEach(k=> csv.push(`"KITS","${k.id};${k.nome};${k.local};${k.ativo}"`));
  csv.push('"REGISTROS","id;data;kit;motivo;resp;status;respCusto;itens(JSON)"');
  regs.forEach(r=> csv.push(`"REGISTROS","${r.id};${r.data};${r.kit};${r.motivo};${r.resp};${r.status};${r.respCusto||''};${encodeURIComponent(JSON.stringify(r.itens))}"`));
  csv.push('"MOVIMENTOS","id;data;tipo;itemId;qtd;motivo;ref"');
  movs.forEach(m=> csv.push(`"MOVIMENTOS","${m.id};${m.data};${m.tipo};${m.itemId};${m.qtd};${m.motivo};${m.ref||''}"`));

  const blob = new Blob(["\uFEFF"+csv.join('\n')], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'sopep_export.csv'; a.click();
}

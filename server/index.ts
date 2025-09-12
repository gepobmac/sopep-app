// server/index.ts
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';

import * as Data from './data';
import { loginHandler, logoutHandler, meHandler, authMiddleware, requireRole } from './auth';
import { audit, auditLog } from './audit';
import { listUsers, createUser, updateUser, deleteUser, changePassword } from './users';
import { buildWorkbookBuffer } from './export';

const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

// ===== Auth =====
app.post('/api/login',  loginHandler);
app.post('/api/logout', logoutHandler);
app.get('/api/me', authMiddleware, meHandler);

// ===== Dados =====
app.get('/api/itens', authMiddleware, (_req, res)=> res.json(Data.db.itens));
app.get('/api/kits',  authMiddleware, (_req, res)=> res.json(Data.db.kits));
app.get('/api/registros', authMiddleware, (_req, res)=> res.json(Data.db.registros));
app.get('/api/reorders',  authMiddleware, (_req, res)=> res.json(Data.db.reorders));
app.get('/api/movs',      authMiddleware, (_req, res)=> res.json(Data.db.movs));

app.get('/api/stats', authMiddleware, (_req, res)=> {
  const now = new Date();
  const ym  = now.toISOString().slice(0,7);
  const regsMes = Data.db.registros.filter(r => (r.data||'').slice(0,7) === ym);
  const consumoMes = regsMes.reduce((acc,r)=> acc + r.itens.reduce((s,i)=>s+Number(i.qtd||0),0), 0);
  const baixos = Data.db.itens.filter(i=> i.estoque <= i.min).length;
  const reordersAbertas = Data.db.reorders.filter(r=> r.status === 'aberta' || r.status === 'aprovacao').length;
  res.json({
    pendentes: Data.db.registros.filter(r=>r.status==='pendente').length,
    baixos,
    kitsAtivos: Data.totalKits(),
    registrosMes: regsMes.length,
    consumoMes,
    reordersAbertas
  });
});

// ===== Relatórios (gráfico consumo dia) =====
app.get('/api/reports/consumo-dias', authMiddleware, (req,res)=>{
  const days = Math.min(365, Number(req.query.days||90));
  const start = new Date(); start.setDate(start.getDate() - days);
  const map = new Map<string, number>();
  Data.db.movs.forEach(m=>{
    if(m.tipo!=='saida') return;
    const d = m.data.slice(0,10);
    const dt = new Date(d);
    if(dt >= start){
      map.set(d, (map.get(d)||0) + Number(m.qtd||0));
    }
  });
  const out: {date:string,total:number}[] = [];
  for(let i=0;i<=days;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const key = d.toISOString().slice(0,10);
    out.push({ date:key, total: map.get(key)||0 });
  }
  res.json(out);
});

// ===== Export XLSX (todos autenticados) =====
app.get('/api/export/xlsx', authMiddleware, (_req, res)=>{
  const buf = buildWorkbookBuffer();
  const stamp = new Date().toISOString().slice(0,10).replaceAll('-','');
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="sopep_export_${stamp}.xlsx"`);
  res.send(buf);
});

// ===== Usuários (somente Desenvolvedor) =====
app.get('/api/users',            authMiddleware, requireRole('desenvolvedor'), listUsers);
app.post('/api/users',           authMiddleware, requireRole('desenvolvedor'), createUser);
app.put('/api/users/:id',        authMiddleware, requireRole('desenvolvedor'), updateUser);
app.delete('/api/users/:id',     authMiddleware, requireRole('desenvolvedor'), deleteUser);
app.post('/api/users/:id/password', authMiddleware, requireRole('desenvolvedor'), changePassword);

// ===== Ações protegidas =====
app.post('/api/registros/:id/decidir', authMiddleware, requireRole('fiscalizacao','desenvolvedor'), (req, res)=>{
  const { id } = req.params;
  const { decisao } = req.body as { decisao: 'aprovado'|'reprovado' };
  const idx = Data.db.registros.findIndex(r=>r.id===id);
  if(idx<0) return res.status(404).json({ error:'Registro não encontrado' });
  const reg = Data.db.registros[idx];
  reg.status = decisao;
  reg.respCusto = decisao==='aprovado' ? 'Petrobras' : 'Operadora Portuária';

  reg.itens.forEach(it=>{
    const item = Data.db.itens.find(x=>x.id===it.itemId);
    if(!item) return;
    item.estoque = Math.max(0, item.estoque - Number(it.qtd));
    Data.db.movs.push({ id: Data.uuid('M'), data: new Date().toISOString(), tipo:'saida', itemId:item.id, qtd:Number(it.qtd), motivo:`Reposição do kit ${reg.kit} (registro ${reg.id})`, ref:id });
    if(item.estoque <= item.min){
      const exists = Data.db.reorders.some(r=> r.itemId===item.id && r.status!=='fechado');
      if(!exists){
        const sug = Math.max(Math.ceil(item.min*1.5) - item.estoque, item.min - item.estoque + Math.ceil(item.min*0.2));
        Data.db.reorders.push({ id: Data.uuid('OC'), itemId:item.id, item:item.nome, criadoEm:new Date().toISOString(), estoque:item.estoque, min:item.min, sugerido:sug, status:'aberta' });
      }
    }
  });

  Data.db.registros[idx] = reg;
  audit((req as any).user?.sub || null, 'registro.decidir', { id, decisao });
  res.json({ ok:true, registro: reg });
});

app.post('/api/itens/:id/mov', authMiddleware, requireRole('administracao','desenvolvedor'), (req, res)=>{
  const { id } = req.params;
  const { tipo, qtd, motivo } = req.body as { tipo:'entrada'|'saida', qtd:number, motivo:string };
  const item = Data.db.itens.find(i=>i.id===id);
  if(!item) return res.status(404).json({ error:'Item não encontrado' });
  if(!(qtd>0)) return res.status(400).json({ error:'Quantidade inválida' });

  if(tipo==='entrada') item.estoque += Number(qtd);
  if(tipo==='saida')   item.estoque = Math.max(0, item.estoque - Number(qtd));
  Data.db.movs.push({ id: Data.uuid('M'), data:new Date().toISOString(), tipo, itemId:item.id, qtd:Number(qtd), motivo, ref:null });

  if(item.estoque <= item.min){
    const exists = Data.db.reorders.some(r=> r.itemId===item.id && r.status!=='fechado');
    if(!exists){
      const sug = Math.max(Math.ceil(item.min*1.5) - item.estoque, item.min - item.estoque + Math.ceil(item.min*0.2));
      Data.db.reorders.push({ id: Data.uuid('OC'), itemId:item.id, item:item.nome, criadoEm:new Date().toISOString(), estoque:item.estoque, min:item.min, sugerido:sug, status:'aberta' });
    }
  }

  audit((req as any).user?.sub || null, 'item.mov', { id, tipo, qtd });
  res.json({ ok:true, item });
});

app.post('/api/itens', authMiddleware, requireRole('administracao','desenvolvedor'), (req, res)=>{
  const { id, nome, un, qtdKit, estoque } = req.body as { id?:string; nome:string; un:string; qtdKit:number; estoque:number };
  if(id){
    const it = Data.db.itens.find(x=>x.id===id); if(!it) return res.status(404).json({ error:'Item não encontrado' });
    Object.assign(it, { nome, un, qtdKit, estoque });
  } else {
    const newId = 'I-'+Math.random().toString(36).slice(2,5).toUpperCase();
    Data.db.itens.push({ id:newId, nome, un, qtdKit, min:0, estoque });
  }
  Data.recalcMinimums();
  audit((req as any).user?.sub || null, 'item.upsert', { id, nome, un, qtdKit, estoque });
  res.json({ ok:true, itens: Data.db.itens });
});

app.post('/api/reorders/:id', authMiddleware, requireRole('administracao','desenvolvedor','fiscalizacao'), (req, res)=>{
  const { id } = req.params;
  const { act } = req.body as { act:'enviar-aprovacao'|'comprar'|'fechar' };
  const r = Data.db.reorders.find(x=>x.id===id); if(!r) return res.status(404).json({ error:'Reorder não encontrado' });

  if(act==='enviar-aprovacao') r.status='aprovacao';
  if(act==='comprar')          r.status='comprado';
  if(act==='fechar')           r.status='fechado';

  audit((req as any).user?.sub || null, 'reorder.update', { id, act, to:r.status });
  res.json({ ok:true, reorder: r });
});

app.post('/api/registros', authMiddleware, (req, res)=>{
  const { data, resp, kit, motivo, itens, evidencias } = req.body as any;
  const id = Data.uuid('SO');
  Data.db.registros.push({ id, data, resp, kit, motivo, itens, evidencias: evidencias||[], status:'pendente' });
  audit((req as any).user?.sub || null, 'registro.create', { id, kit, motivo, itens });
  res.json({ ok:true, id });
});

// Auditoria (admin/dev)
app.get('/api/audit', authMiddleware, requireRole('administracao','desenvolvedor'), (_req,res)=>{
  res.json(auditLog.slice(-500));
});

// ===== Static =====
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('/', (_req, res) => res.sendFile(path.join(publicDir, 'login.html')));
app.get('/app', (_req, res) => res.sendFile(path.join(publicDir, 'app.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`SOPEP rodando em http://localhost:${PORT}`));

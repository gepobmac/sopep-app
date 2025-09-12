// server/index.ts
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';

import { db, recalcMinimums, uuid, totalKits } from './data';
import { loginHandler, logoutHandler, meHandler, authMiddleware, requireRole } from './auth';

const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

// ===== Auth =====
app.post('/api/login', loginHandler);
app.post('/api/logout', logoutHandler);
app.get('/api/me', authMiddleware, meHandler);

// ===== Dados =====
app.get('/api/itens', authMiddleware, (_req, res)=> res.json(db.itens));
app.get('/api/kits',  authMiddleware, (_req, res)=> res.json(db.kits));
app.get('/api/registros', authMiddleware, (_req, res)=> res.json(db.registros));
app.get('/api/reorders',  authMiddleware, (_req, res)=> res.json(db.reorders));
app.get('/api/movs',      authMiddleware, (_req, res)=> res.json(db.movs));
app.get('/api/stats',     authMiddleware, (_req, res)=> {
  const now = new Date();
  const ym  = now.toISOString().slice(0,7);
  const regsMes = db.registros.filter(r => (r.data||'').slice(0,7) === ym);
  const consumoMes = regsMes.reduce((acc,r)=> acc + r.itens.reduce((s,i)=>s+Number(i.qtd||0),0), 0);
  const baixos = db.itens.filter(i=> i.estoque <= i.min).length;
  const reordersAbertas = db.reorders.filter(r=> r.status === 'aberta').length;
  res.json({
    pendentes: db.registros.filter(r=>r.status==='pendente').length,
    baixos,
    kitsAtivos: totalKits(),
    registrosMes: regsMes.length,
    consumoMes,
    reordersAbertas
  });
});

// ===== Ações protegidas =====
app.post('/api/registros/:id/decidir', authMiddleware, requireRole('fiscalizacao','desenvolvedor'), (req, res)=>{
  const { id } = req.params;
  const { decisao } = req.body as { decisao: 'aprovado'|'reprovado' };
  const idx = db.registros.findIndex(r=>r.id===id);
  if(idx<0) return res.status(404).json({ error:'Registro não encontrado' });
  const reg = db.registros[idx];
  reg.status = decisao;
  reg.respCusto = decisao==='aprovado' ? 'Petrobras' : 'Operadora Portuária';

  reg.itens.forEach(it=>{
    const item = db.itens.find(x=>x.id===it.itemId);
    if(!item) return;
    item.estoque = Math.max(0, item.estoque - Number(it.qtd));
    db.movs.push({ id: uuid('M'), data: new Date().toISOString(), tipo:'saida', itemId:item.id, qtd:Number(it.qtd), motivo:`Reposição do kit ${reg.kit} (registro ${reg.id})`, ref:id });
    if(item.estoque <= item.min){
      const exists = db.reorders.some(r=> r.itemId===item.id && r.status==='aberta');
      if(!exists){
        const sug = Math.max(Math.ceil(item.min*1.5) - item.estoque, item.min - item.estoque + Math.ceil(item.min*0.2));
        db.reorders.push({ id: uuid('OC'), itemId:item.id, item:item.nome, criadoEm:new Date().toISOString(), estoque:item.estoque, min:item.min, sugerido:sug, status:'aberta' });
      }
    }
  });

  db.registros[idx] = reg;
  res.json({ ok:true, registro: reg });
});

app.post('/api/itens/:id/mov', authMiddleware, requireRole('administracao','desenvolvedor'), (req, res)=>{
  const { id } = req.params;
  const { tipo, qtd, motivo } = req.body as { tipo:'entrada'|'saida', qtd:number, motivo:string };
  const item = db.itens.find(i=>i.id===id);
  if(!item) return res.status(404).json({ error:'Item não encontrado' });
  if(!(qtd>0)) return res.status(400).json({ error:'Quantidade inválida' });

  if(tipo==='entrada') item.estoque += Number(qtd);
  if(tipo==='saida')   item.estoque = Math.max(0, item.estoque - Number(qtd));
  db.movs.push({ id: uuid('M'), data:new Date().toISOString(), tipo, itemId:item.id, qtd:Number(qtd), motivo, ref:null });

  if(item.estoque <= item.min){
    const exists = db.reorders.some(r=> r.itemId===item.id && r.status==='aberta');
    if(!exists){
      const sug = Math.max(Math.ceil(item.min*1.5) - item.estoque, item.min - item.estoque + Math.ceil(item.min*0.2));
      db.reorders.push({ id: uuid('OC'), itemId:item.id, item:item.nome, criadoEm:new Date().toISOString(), estoque:item.estoque, min:item.min, sugerido:sug, status:'aberta' });
    }
  }

  res.json({ ok:true, item });
});

app.post('/api/itens', authMiddleware, requireRole('administracao','desenvolvedor'), (req, res)=>{
  const { id, nome, un, qtdKit, estoque } = req.body as { id?:string; nome:string; un:string; qtdKit:number; estoque:number };
  if(id){
    const it = db.itens.find(x=>x.id===id); if(!it) return res.status(404).json({ error:'Item não encontrado' });
    Object.assign(it, { nome, un, qtdKit, estoque });
  } else {
    const newId = 'I-'+Math.random().toString(36).slice(2,5).toUpperCase();
    db.itens.push({ id:newId, nome, un, qtdKit, min:0, estoque });
  }
  recalcMinimums();
  res.json({ ok:true, itens: db.itens });
});

app.post('/api/reorders/:id', authMiddleware, requireRole('administracao','desenvolvedor','fiscalizacao'), (req, res)=>{
  const { id } = req.params;
  const { act } = req.body as { act:'comprado'|'fechar' };
  const r = db.reorders.find(x=>x.id===id); if(!r) return res.status(404).json({ error:'Reorder não encontrado' });
  if(act==='comprado') r.status='comprado';
  if(act==='fechar')   r.status='fechado';
  res.json({ ok:true, reorder: r });
});

app.post('/api/registros', authMiddleware, (req, res)=>{
  const { data, resp, kit, motivo, itens, evidencias } = req.body as any;
  const id = uuid('SO');
  db.registros.push({ id, data, resp, kit, motivo, itens, evidencias: evidencias||[], status:'pendente' });
  res.json({ ok:true, id });
});

// ===== Static =====
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('/', (_req, res) => res.sendFile(path.join(publicDir, 'login.html')));
app.get('/app', (_req, res) => res.sendFile(path.join(publicDir, 'app.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`SOPEP rodando em http://localhost:${PORT}`));

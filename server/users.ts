// server/users.ts
import type { Request, Response } from 'express';
import { db, type Role } from './data';

// Listar usuários (sem expor senhas)
export function listUsers(_req: Request, res: Response) {
  const users = db.users.map(u => ({ id: u.id, username: u.username, role: u.role, name: u.name }));
  res.json(users);
}

// Criar usuário
export function createUser(req: Request, res: Response) {
  const { username, password, role, name } = req.body as { username: string; password: string; role: Role; name: string };
  if (!username || !password || !role || !name) return res.status(400).json({ error: 'Campos obrigatórios: username, password, role, name' });
  if (db.users.some(u => u.username === username)) return res.status(409).json({ error: 'Usuário já existe' });

  const id = 'U-' + Math.random().toString(36).slice(2,8).toUpperCase();
  db.users.push({ id, username, password, role, name });
  res.json({ ok: true, id });
}

// Atualizar usuário (sem senha)
export function updateUser(req: Request, res: Response) {
  const { id } = req.params;
  const { username, role, name } = req.body as { username?: string; role?: Role; name?: string };
  const u = db.users.find(x => x.id === id);
  if (!u) return res.status(404).json({ error: 'Usuário não encontrado' });

  if (username && username !== u.username) {
    if (db.users.some(v => v.username === username)) return res.status(409).json({ error: 'Username já em uso' });
    u.username = username;
  }
  if (role) u.role = role;
  if (name) u.name = name;
  res.json({ ok: true });
}

// Excluir usuário
export function deleteUser(req: Request, res: Response) {
  const { id } = req.params;
  const idx = db.users.findIndex(u => u.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Usuário não encontrado' });
  db.users.splice(idx, 1);
  res.json({ ok: true });
}

// Trocar senha
export function changePassword(req: Request, res: Response) {
  const { id } = req.params;
  const { password } = req.body as { password: string };
  const u = db.users.find(x => x.id === id);
  if (!u) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (!password || password.length < 4) return res.status(400).json({ error: 'Senha deve ter pelo menos 4 caracteres' });
  u.password = password; // NOTE: em produção, usar hash (bcrypt)
  res.json({ ok: true });
}

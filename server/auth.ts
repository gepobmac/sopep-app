// server/auth.ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './data';

export type Role = 'desenvolvedor' | 'fiscalizacao' | 'operacao' | 'administracao';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const COOKIE_NAME = 'sopep_token';

const rolePerms: Record<Role, string[]> = {
  desenvolvedor:   ['view:all','approve','stock:move','stock:edit','users:manage','items:manage','reorder:manage'],
  fiscalizacao:    ['view:all','approve','reorder:manage'],
  operacao:        ['view:dashboard','view:registro','view:kits'],
  administracao:   ['view:all','stock:move','stock:edit','items:manage','reorder:manage']
};

export function loginHandler(req: Request, res: Response) {
  const { username, password } = req.body as { username: string; password: string };
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

  const token = jwt.sign({ sub: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '12h' });
  res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax' });
  return res.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
}

export function meHandler(req: Request, res: Response) {
  const payload = (req as any).user as { sub: string; role: Role; name: string } | undefined;
  if (!payload) return res.status(401).json({ error: 'Não autenticado' });
  const user = db.users.find(u => u.id === payload.sub);
  if (!user) return res.status(401).json({ error: 'Não autenticado' });
  res.json({ id: user.id, name: user.name, role: user.role, perms: rolePerms[user.role] ?? [] });
}

export function logoutHandler(_: Request, res: Response) {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = (req as any).cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const payload = (req as any).user as { role: Role } | undefined;
    if (!payload) return res.status(401).json({ error: 'Não autenticado' });
    if (!roles.includes(payload.role)) return res.status(403).json({ error: 'Acesso negado' });
    next();
  };
}

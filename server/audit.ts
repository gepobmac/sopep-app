// server/audit.ts
export interface Audit {
  at: string; userId: string|null; action: string; payload?: any;
}

export const auditLog: Audit[] = [];

export function audit(userId: string|null, action: string, payload?: any){
  auditLog.push({ at:new Date().toISOString(), userId, action, payload });
}

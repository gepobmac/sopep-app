// server/export.ts
import * as XLSX from 'xlsx';
import { db } from './data';

export function buildWorkbookBuffer(): Buffer {
  const wb = XLSX.utils.book_new();

  // ITENS
  const itensData = db.itens.map(i => ({
    ID: i.id, Nome: i.nome, Unidade: i.un, 'Qtd/Kit': i.qtdKit, Minimo: i.min, Estoque: i.estoque
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itensData), 'Itens');

  // REGISTROS
  const regsData = db.registros.map(r => ({
    ID: r.id, Data: r.data, Kit: r.kit, Motivo: r.motivo, Responsavel: r.resp, Status: r.status,
    RespCusto: r.respCusto || '', ItensJSON: JSON.stringify(r.itens)
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(regsData), 'Registros');

  // MOVIMENTOS
  const movsData = db.movs.map(m => ({
    ID: m.id, Data: m.data, Tipo: m.tipo, ItemID: m.itemId, Quantidade: m.qtd, Motivo: m.motivo, Ref: m.ref || ''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movsData), 'Movimentos');

  // (Opcional) Kits e Reorders
  // const kitsData = db.kits.map(k => ({ ID:k.id, Nome:k.nome, Local:k.local, Ativo:k.ativo }));
  // XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kitsData), 'Kits');
  // const reordersData = db.reorders.map(r => ({ ID:r.id, Item:r.item, Estoque:r.estoque, Min:r.min, Sugerido:r.sugerido, Status:r.status, CriadoEm:r.criadoEm }));
  // XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reordersData), 'Reorders');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buf;
}

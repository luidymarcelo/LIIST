// Documento (CPF ou CNPJ) das filiais. Contas logadas não leem stores.cnpj direto da tabela (migration 032):
// o documento vem por get_store_documents, que só responde para admin, dono ou equipe da filial.
import type { SupabaseClient } from "@supabase/supabase-js";

type DocumentRow = { store_id: string; document: string | null };
type LegacyRow = { id: string; cnpj: string | null };

// Colunas de stores que as telas logadas leem; nunca inclua cnpj aqui.
export const STORE_READABLE_COLUMNS = "id, tenant_id, name, slug, segment, whatsapp_phone, address, latitude, longitude, minimum_order, delivery_fee, delivery_time_label, cover_image_url, cover_note, cover_note_position, is_active, created_at, pickup_time_label, show_delivery_time, show_minimum_order, show_pickup_time";

function isMissingFunction(error: { code?: string; message: string }) {
  return error.code === "PGRST202" || /get_store_documents/i.test(error.message);
}

export async function fetchStoreDocuments(client: Pick<SupabaseClient, "rpc" | "from">, storeIds: string[]): Promise<Map<string, string | null>> {
  if (!storeIds.length) return new Map();
  const { data, error } = await client.rpc("get_store_documents", { p_store_ids: storeIds });
  if (!error) return new Map(((data ?? []) as DocumentRow[]).map((row) => [row.store_id, row.document]));
  // Outro erro: segue sem documento em vez de travar a tela.
  if (!isMissingFunction(error)) return new Map();

  // Banco ainda sem a migration 032: a coluna ainda pode ser lida direto.
  const legacy = await client.from("stores").select("id, cnpj").in("id", storeIds);
  if (legacy.error) return new Map();
  return new Map(((legacy.data ?? []) as LegacyRow[]).map((row) => [row.id, row.cnpj]));
}

export function withStoreDocuments<T extends { id: string; cnpj?: string | null }>(rows: T[], documents: Map<string, string | null>): T[] {
  return rows.map((row) => (documents.has(row.id) ? { ...row, cnpj: documents.get(row.id) ?? null } : { ...row }));
}

// Lê do Supabase os papéis da conta logada. Usa só a chave pública: cada consulta respeita o RLS do próprio usuário.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessMembership, AccessProfile } from "./access-destinations";

type CompanyUserRow = { tenant_id: string; role: string | null; roles: string[] | null; is_active: boolean | null };
type CompanyUserStoreRow = { tenant_id: string; store_id: string };
type StoreRow = { id: string; tenant_id: string; name: string; cnpj: string | null };
type PublicCompanyRow = { tenant_id: string; company_name: string | null };

export async function loadAccessProfile(client: SupabaseClient, userId: string): Promise<AccessProfile> {
  const [adminResult, ownerResult, userResult, userStoreResult] = await Promise.all([
    client.rpc("is_platform_admin"),
    client.rpc("get_company_workspace"),
    client.from("company_users").select("tenant_id, role, roles, is_active").eq("user_id", userId),
    client.from("company_user_stores").select("tenant_id, store_id").eq("user_id", userId),
  ]);
  if (userResult.error) throw new Error(userResult.error.message);
  if (userStoreResult.error) throw new Error(userStoreResult.error.message);

  const companyUsers = (userResult.data ?? []) as CompanyUserRow[];
  const userStores = (userStoreResult.data ?? []) as CompanyUserStoreRow[];
  const storeIds = [...new Set(userStores.map((row) => row.store_id))];
  const [storeResult, companyResult] = storeIds.length
    ? await Promise.all([
        client.from("stores").select("id, tenant_id, name, cnpj").in("id", storeIds).order("created_at"),
        client.rpc("get_public_catalog_companies"),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (storeResult.error) throw new Error(storeResult.error.message);

  const stores = (storeResult.data ?? []) as StoreRow[];
  const companyNames = new Map(((companyResult.data ?? []) as PublicCompanyRow[]).map((row) => [row.tenant_id, row.company_name ?? ""]));
  const memberships: AccessMembership[] = companyUsers.map((row) => {
    const linkedStoreIds = new Set(userStores.filter((link) => link.tenant_id === row.tenant_id).map((link) => link.store_id));
    return {
      tenantName: companyNames.get(row.tenant_id) || "Empresa",
      roles: row.roles?.length ? row.roles : row.role ? [row.role] : [],
      isActive: row.is_active !== false,
      stores: stores
        .filter((store) => store.tenant_id === row.tenant_id && linkedStoreIds.has(store.id))
        .map((store) => ({ id: store.id, name: store.name, document: store.cnpj })),
    };
  });

  const ownerWorkspace = ownerResult.data as { tenant?: { name?: string } } | null;
  return {
    isPlatformAdmin: adminResult.data === true,
    ownerCompanyName: ownerWorkspace?.tenant?.name ?? null,
    memberships,
  };
}

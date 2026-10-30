-- Permite cadastrar a filial com CPF (11 dígitos) ou CNPJ (14 dígitos).
-- A coluna continua se chamando stores.cnpj para não quebrar integrações existentes;
-- ela passa a guardar o documento da filial, seja CPF ou CNPJ, somente com dígitos.

alter table public.stores
  drop constraint if exists stores_cnpj_format_check;
alter table public.stores
  drop constraint if exists stores_cnpj_check;
alter table public.stores
  add constraint stores_cnpj_format_check
  check (cnpj is null or cnpj ~ '^([0-9]{11}|[0-9]{14})$');

comment on column public.stores.cnpj is 'Documento da filial: CPF (11 dígitos) ou CNPJ (14 dígitos), somente números.';

-- CPF é dado pessoal (LGPD): o documento completo deixa de ser legível por visitantes.
-- O catálogo público passa a usar public_document, que só expõe CNPJ (14 dígitos).
alter table public.stores
  add column if not exists public_document text
  generated always as (case when cnpj ~ '^[0-9]{14}$' then cnpj end) stored;

comment on column public.stores.public_document is 'CNPJ da filial para links públicos; nulo quando o documento é CPF.';

-- Visitantes (anon) leem todas as colunas de stores, exceto cnpj.
-- Ao criar novas colunas em stores, conceda select a anon nelas se o catálogo precisar.
revoke select on public.stores from anon;
do $$
declare
  public_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into public_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'stores' and column_name <> 'cnpj';
  execute format('grant select (%s) on public.stores to anon', public_columns);
end;
$$;

create or replace function public.get_branch_workspace(p_cnpj text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
  branch_row public.stores%rowtype;
  tenant_row public.tenants%rowtype;
  access_roles text[];
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if normalized_cnpj !~ '^([0-9]{11}|[0-9]{14})$' then raise exception 'invalid document'; end if;

  select s.* into branch_row from public.stores s where s.cnpj = normalized_cnpj;
  if branch_row.id is null then return jsonb_build_object('error', 'Filial não encontrada.', 'code', 'branch_not_found'); end if;

  select public.effective_company_user_roles(cu.roles, cu.role) into access_roles
  from public.company_users cu
  join public.company_user_stores cus
    on cus.tenant_id = cu.tenant_id and cus.user_id = cu.user_id
  where cu.user_id = current_user_id
    and cu.tenant_id = branch_row.tenant_id
    and public.effective_company_user_roles(cu.roles, cu.role) && array['branch_manager']::text[]
    and cu.is_active
    and cus.store_id = branch_row.id;

  if access_roles is null then
    return jsonb_build_object('error', 'Este usuário não possui acesso a esta filial.', 'code', 'branch_access_denied');
  end if;

  select * into tenant_row from public.tenants where id = branch_row.tenant_id;
  return jsonb_build_object(
    'tenant', jsonb_build_object('id', tenant_row.id, 'name', tenant_row.name, 'slug', tenant_row.slug),
    'branches', jsonb_build_array(to_jsonb(branch_row)),
    'access', jsonb_build_object('role', access_roles[1], 'roles', to_jsonb(access_roles))
  );
end;
$$;

revoke all on function public.get_branch_workspace(text) from public;
grant execute on function public.get_branch_workspace(text) to authenticated;

create or replace function public.get_operational_workspace(p_cnpj text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
  branch_row public.stores%rowtype;
  tenant_row public.tenants%rowtype;
  access_row public.company_users%rowtype;
  access_roles text[];
  profile_name text;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if normalized_cnpj !~ '^([0-9]{11}|[0-9]{14})$' then raise exception 'invalid document'; end if;

  select s.* into branch_row
  from public.stores s
  where s.cnpj = normalized_cnpj and s.is_active;
  if branch_row.id is null then
    return jsonb_build_object('error', 'Filial não encontrada ou inativa.', 'code', 'branch_not_found');
  end if;

  select cu.* into access_row
  from public.company_users cu
  where cu.user_id = current_user_id
    and cu.tenant_id = branch_row.tenant_id
    and cu.is_active
    and (
      public.effective_company_user_roles(cu.roles, cu.role) && array['owner']::text[]
      or exists (
        select 1 from public.company_user_stores cus
        where cus.tenant_id = cu.tenant_id
          and cus.user_id = cu.user_id
          and cus.store_id = branch_row.id
      )
    );

  if access_row.user_id is null then
    return jsonb_build_object('error', 'Este usuário não possui acesso operacional a esta filial.', 'code', 'operation_access_denied');
  end if;

  access_roles := public.effective_company_user_roles(access_row.roles, access_row.role);
  select * into tenant_row from public.tenants where id = branch_row.tenant_id;
  select p.full_name into profile_name from public.profiles p where p.id = current_user_id;

  return jsonb_build_object(
    'tenant', jsonb_build_object('id', tenant_row.id, 'name', tenant_row.name, 'slug', tenant_row.slug),
    'branches', jsonb_build_array(to_jsonb(branch_row)),
    'access', jsonb_build_object(
      'role', access_row.role,
      'roles', to_jsonb(access_roles),
      'name', coalesce(nullif(trim(profile_name), ''), 'Usuário')
    ),
    'operation', jsonb_build_object(
      'entry_mode', coalesce(
        (select sp.parameter_value #>> '{}' from public.store_parameters sp where sp.store_id = branch_row.id and sp.parameter_key = 'internal_order_entry_mode'),
        'staff'
      ),
      'customer_name_mode', coalesce(
        (select sp.parameter_value #>> '{}' from public.store_parameters sp where sp.store_id = branch_row.id and sp.parameter_key = 'table_customer_name_mode'),
        'optional'
      ),
      'require_open_table_session', coalesce(
        (select (sp.parameter_value #>> '{}')::boolean from public.store_parameters sp where sp.store_id = branch_row.id and sp.parameter_key = 'require_open_table_session'),
        false
      ),
      'flow', coalesce(
        (select sp.parameter_value #>> '{}' from public.store_parameters sp where sp.store_id = branch_row.id and sp.parameter_key = 'operation_flow'),
        'complete'
      ),
      'production_release_mode', coalesce(
        (select sp.parameter_value #>> '{}' from public.store_parameters sp where sp.store_id = branch_row.id and sp.parameter_key = 'production_release_mode'),
        'whole_order'
      )
    )
  );
end;
$$;

revoke all on function public.get_operational_workspace(text) from public;
grant execute on function public.get_operational_workspace(text) to authenticated;

create or replace function public.get_operational_workspace_by_store(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  store_cnpj text;
begin
  select s.cnpj into store_cnpj from public.stores s where s.id = p_store_id;
  if store_cnpj is null then
    return jsonb_build_object('error', 'A filial ainda não possui CPF ou CNPJ configurado.', 'code', 'branch_cnpj_missing');
  end if;
  return public.get_operational_workspace(store_cnpj);
end;
$$;

revoke all on function public.get_operational_workspace_by_store(uuid) from public;
grant execute on function public.get_operational_workspace_by_store(uuid) to authenticated;

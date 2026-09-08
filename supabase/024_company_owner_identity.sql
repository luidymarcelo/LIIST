-- Permite que o proprietário edite a identidade visual da própria empresa.
drop policy if exists "company owners update own company identity" on public.tenants;
create policy "company owners update own company identity"
  on public.tenants for update
  to authenticated
  using (public.is_company_owner(id))
  with check (public.is_company_owner(id));

grant select, update on public.tenants to authenticated;

create or replace function public.get_company_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  company_id uuid;
  company_row jsonb;
  branch_rows jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select cu.tenant_id
    into company_id
  from public.company_users cu
  where cu.user_id = current_user_id
    and public.effective_company_user_roles(cu.roles, cu.role) && array['owner']::text[]
    and cu.is_active
  order by cu.created_at
  limit 1;

  if company_id is null then
    return jsonb_build_object(
      'error', 'Este login não possui acesso de proprietário.',
      'code', 'company_owner_access_not_found'
    );
  end if;

  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'slug', t.slug,
    'is_active', t.is_active,
    'theme_color', t.theme_color,
    'profile_image_url', t.profile_image_url
  )
    into company_row
  from public.tenants t
  where t.id = company_id;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at), '[]'::jsonb)
    into branch_rows
  from public.stores s
  where s.tenant_id = company_id;

  return jsonb_build_object(
    'tenant', company_row,
    'branches', branch_rows,
    'access', jsonb_build_object('role', 'owner', 'roles', jsonb_build_array('owner'))
  );
end;
$$;

grant execute on function public.get_company_workspace() to authenticated;

notify pgrst, 'reload schema';

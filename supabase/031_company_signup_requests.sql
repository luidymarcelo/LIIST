-- Cadastro pelo próprio lojista: a empresa pede acesso, um administrador aprova ou recusa.
-- Também passa a valer o status da empresa (ativa, em teste até uma data, suspensa) em todas as permissões.

-- 1. Status da empresa ----------------------------------------------------------------
alter table public.tenants
  add column if not exists trial_ends_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists suspended_reason text;

comment on column public.tenants.trial_ends_at is 'Fim do período de teste. Nulo quando a empresa não está em teste.';
comment on column public.tenants.suspended_reason is 'Motivo mostrado ao lojista quando a empresa está suspensa.';

-- Empresa ativa = não suspensa e, se estiver em teste, com o teste ainda valendo.
create or replace function public.is_tenant_active(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenants t
    where t.id = target_tenant_id
      and t.is_active
      and (t.trial_ends_at is null or t.trial_ends_at > now())
  );
$$;

revoke all on function public.is_tenant_active(uuid) from public;
grant execute on function public.is_tenant_active(uuid) to anon, authenticated;

-- Catálogo público: some quando a empresa está suspensa ou com o teste vencido.
create or replace function public.is_store_public(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores s
    where s.id = target_store_id
      and s.is_active
      and public.is_tenant_active(s.tenant_id)
  );
$$;

-- Permissões do dono, do gerente e da equipe passam a exigir empresa ativa.
-- O administrador da plataforma continua com acesso a tudo, para dar suporte.
create or replace function public.company_user_has_any_role(
  target_tenant_id uuid,
  target_user_id uuid,
  required_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_users cu
    where cu.tenant_id = target_tenant_id
      and cu.user_id = target_user_id
      and cu.is_active
      and public.effective_company_user_roles(cu.roles, cu.role) && required_roles
      and public.is_tenant_active(cu.tenant_id)
  );
$$;

create or replace function public.can_manage_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.stores s
    join public.company_users cu on cu.tenant_id = s.tenant_id
    where s.id = target_store_id
      and cu.user_id = auth.uid()
      and cu.is_active
      and public.is_tenant_active(s.tenant_id)
      and (
        public.effective_company_user_roles(cu.roles, cu.role) && array['owner']::text[]
        or (
          public.effective_company_user_roles(cu.roles, cu.role) && array['branch_manager']::text[]
          and exists (
            select 1
            from public.company_user_stores cus
            where cus.tenant_id = cu.tenant_id
              and cus.user_id = cu.user_id
              and cus.store_id = s.id
          )
        )
      )
  );
$$;

create or replace function public.can_operate_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.stores s
    join public.company_users cu on cu.tenant_id = s.tenant_id
    where s.id = target_store_id
      and cu.user_id = auth.uid()
      and cu.is_active
      and public.is_tenant_active(s.tenant_id)
      and (
        public.effective_company_user_roles(cu.roles, cu.role) && array['owner']::text[]
        or exists (
          select 1
          from public.company_user_stores cus
          where cus.tenant_id = cu.tenant_id
            and cus.user_id = cu.user_id
            and cus.store_id = s.id
        )
      )
  );
$$;

create or replace function public.can_manage_tenant_catalog(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_company_owner(target_tenant_id) or exists (
    select 1
    from public.company_users cu
    join public.company_user_stores cus
      on cus.tenant_id = cu.tenant_id
     and cus.user_id = cu.user_id
    join public.stores s
      on s.id = cus.store_id
     and s.tenant_id = cu.tenant_id
    where cu.tenant_id = target_tenant_id
      and cu.user_id = auth.uid()
      and public.effective_company_user_roles(cu.roles, cu.role) && array['branch_manager']::text[]
      and cu.is_active
      and public.is_tenant_active(cu.tenant_id)
  );
$$;

-- O dono pode editar nome, cor e logo da empresa (policy da 024), mas não a própria situação:
-- só um administrador muda ativa/suspensa, o teste e a aprovação.
create or replace function public.protect_tenant_status_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_platform_admin() or coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if new.is_active is distinct from old.is_active
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.approved_at is distinct from old.approved_at
    or new.suspended_reason is distinct from old.suspended_reason then
    raise exception 'only platform admins can change the company status' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_tenant_status_columns on public.tenants;
create trigger protect_tenant_status_columns
  before update on public.tenants
  for each row execute function public.protect_tenant_status_columns();

-- Empresa suspensa ou com o teste vencido não recebe pedidos, por qualquer caminho (WhatsApp, mesa, equipe).
create or replace function public.block_orders_for_inactive_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.stores s where s.id = new.store_id and public.is_tenant_active(s.tenant_id)
  ) then
    raise exception 'Esta loja não está recebendo pedidos no momento.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists block_orders_for_inactive_company on public.orders;
create trigger block_orders_for_inactive_company
  before insert on public.orders
  for each row execute function public.block_orders_for_inactive_company();

-- Lista pública de lojas: sem empresas suspensas ou com teste vencido.
create or replace function public.get_public_catalog_companies()
returns table (
  tenant_id uuid,
  company_name text,
  theme_color text,
  profile_image_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.theme_color, t.profile_image_url
  from public.tenants t
  where public.is_tenant_active(t.id)
    and exists (
      select 1
      from public.stores s
      where s.tenant_id = t.id
        and s.is_active
    )
  order by t.name;
$$;

-- Situação da empresa da conta logada (para mostrar "suspensa" ou "teste até" nos painéis).
create or replace function public.get_my_company_status(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tenant_row public.tenants%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.is_platform_admin() and not exists (
    select 1 from public.company_users cu where cu.tenant_id = p_tenant_id and cu.user_id = auth.uid() and cu.is_active
  ) then
    return null;
  end if;
  select * into tenant_row from public.tenants where id = p_tenant_id;
  if tenant_row.id is null then return null; end if;
  return jsonb_build_object(
    'is_active', public.is_tenant_active(tenant_row.id),
    'suspended', not tenant_row.is_active,
    'trial_ends_at', tenant_row.trial_ends_at,
    'suspended_reason', tenant_row.suspended_reason
  );
end;
$$;

revoke all on function public.get_my_company_status(uuid) from public;
grant execute on function public.get_my_company_status(uuid) to authenticated;

-- 2. Solicitações de cadastro ----------------------------------------------------------
create table if not exists public.company_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null check (char_length(owner_name) between 2 and 120),
  owner_phone text not null check (owner_phone ~ '^[0-9]{10,11}$'),
  company_name text not null check (char_length(company_name) between 2 and 120),
  document text not null check (document ~ '^([0-9]{11}|[0-9]{14})$'),
  city text not null check (char_length(city) between 2 and 120),
  address text check (address is null or char_length(address) <= 240),
  segment text not null default 'retail' check (segment in ('restaurant', 'pharmacy', 'construction', 'retail', 'services')),
  message text check (message is null or char_length(message) <= 600),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 600),
  tenant_id uuid references public.tenants(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists company_requests_one_open_per_user
  on public.company_requests (user_id)
  where status = 'pending';
create index if not exists company_requests_status_idx on public.company_requests (status, created_at);

alter table public.company_requests enable row level security;

-- O lojista lê só a própria solicitação; escrita apenas pelas funções abaixo.
drop policy if exists "users read own company requests" on public.company_requests;
create policy "users read own company requests"
  on public.company_requests for select
  to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

revoke all on public.company_requests from anon, authenticated;
grant select on public.company_requests to authenticated;

-- Envia a solicitação da conta logada. Exige e-mail confirmado e conta sem empresa.
create or replace function public.submit_company_request(
  p_owner_name text,
  p_owner_phone text,
  p_company_name text,
  p_document text,
  p_city text,
  p_address text default null,
  p_segment text default 'retail',
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_document text := regexp_replace(coalesce(p_document, ''), '\D', '', 'g');
  normalized_phone text := regexp_replace(coalesce(p_owner_phone, ''), '\D', '', 'g');
  existing_request public.company_requests%rowtype;
  request_id uuid;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;

  if not exists (select 1 from auth.users u where u.id = current_user_id and u.email_confirmed_at is not null) then
    return jsonb_build_object('error', 'Confirme seu e-mail antes de enviar a solicitação.', 'code', 'email_not_confirmed');
  end if;

  if exists (select 1 from public.company_users cu where cu.user_id = current_user_id) then
    return jsonb_build_object('error', 'Esta conta já está ligada a uma empresa.', 'code', 'already_linked');
  end if;

  select * into existing_request
  from public.company_requests r
  where r.user_id = current_user_id and r.status = 'pending'
  limit 1;
  if existing_request.id is not null then
    return jsonb_build_object('request_id', existing_request.id, 'status', existing_request.status);
  end if;

  -- Limite contra abuso: depois de uma recusa, nova tentativa só no dia seguinte, e no máximo 3 recusas por conta.
  if (select count(*) from public.company_requests r where r.user_id = current_user_id and r.status = 'rejected') >= 3 then
    return jsonb_build_object('error', 'Esta conta atingiu o limite de solicitações. Fale com a equipe LIIST.', 'code', 'too_many_requests');
  end if;
  if exists (
    select 1 from public.company_requests r
    where r.user_id = current_user_id and r.status = 'rejected' and r.reviewed_at > now() - interval '24 hours'
  ) then
    return jsonb_build_object('error', 'Aguarde 24 horas depois da recusa para enviar uma nova solicitação.', 'code', 'cooldown');
  end if;

  if exists (select 1 from public.stores s where s.cnpj = normalized_document) then
    return jsonb_build_object('error', 'Já existe uma loja cadastrada com este CPF ou CNPJ.', 'code', 'document_in_use');
  end if;

  if char_length(trim(coalesce(p_owner_name, ''))) < 2
    or normalized_phone !~ '^[0-9]{10,11}$'
    or char_length(trim(coalesce(p_company_name, ''))) < 2
    or normalized_document !~ '^([0-9]{11}|[0-9]{14})$'
    or char_length(trim(coalesce(p_city, ''))) < 2
    or coalesce(nullif(p_segment, ''), 'retail') not in ('restaurant', 'pharmacy', 'construction', 'retail', 'services')
    or char_length(coalesce(p_owner_name, '')) > 120
    or char_length(coalesce(p_company_name, '')) > 120
    or char_length(coalesce(p_city, '')) > 120
    or char_length(coalesce(p_address, '')) > 240
    or char_length(coalesce(p_message, '')) > 600 then
    return jsonb_build_object('error', 'Revise os dados da solicitação.', 'code', 'invalid_request');
  end if;

  insert into public.company_requests (user_id, owner_name, owner_phone, company_name, document, city, address, segment, message)
  values (
    current_user_id,
    trim(p_owner_name),
    normalized_phone,
    trim(p_company_name),
    normalized_document,
    trim(p_city),
    nullif(trim(coalesce(p_address, '')), ''),
    coalesce(nullif(p_segment, ''), 'retail'),
    nullif(trim(coalesce(p_message, '')), '')
  )
  returning id into request_id;

  return jsonb_build_object('request_id', request_id, 'status', 'pending');
end;
$$;

revoke all on function public.submit_company_request(text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_company_request(text, text, text, text, text, text, text, text) to authenticated;

-- Lista para a Central dos administradores, com o e-mail e se ele já foi confirmado.
create or replace function public.admin_list_company_requests(p_status text default null)
returns table (
  id uuid,
  status text,
  owner_name text,
  owner_phone text,
  email text,
  company_name text,
  document text,
  city text,
  address text,
  segment text,
  message text,
  rejection_reason text,
  tenant_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  duplicate_document boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- duplicate_document: outra conta pediu com o mesmo CPF/CNPJ (alguém pode estar usando o documento de outra pessoa).
  return query
  select r.id, r.status, r.owner_name, r.owner_phone, u.email::text, r.company_name, r.document, r.city, r.address,
         r.segment, r.message, r.rejection_reason, r.tenant_id, r.reviewed_at, r.created_at,
         exists (select 1 from public.company_requests other where other.document = r.document and other.user_id <> r.user_id and other.status <> 'rejected')
  from public.company_requests r
  join auth.users u on u.id = r.user_id
  where p_status is null or r.status = p_status
  order by (r.status = 'pending') desc, r.created_at desc;
end;
$$;

revoke all on function public.admin_list_company_requests(text) from public;
grant execute on function public.admin_list_company_requests(text) to authenticated;

-- Aprova: cria a empresa, a primeira filial e o vínculo de dono, como a criação feita pelo admin.
create or replace function public.approve_company_request(p_request_id uuid, p_trial_days integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.company_requests%rowtype;
  base_slug text;
  company_slug text;
  new_tenant_id uuid;
  new_store_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_trial_days is not null and (p_trial_days < 1 or p_trial_days > 365) then
    return jsonb_build_object('error', 'O teste deve ter entre 1 e 365 dias.', 'code', 'invalid_trial');
  end if;

  select * into request_row from public.company_requests where id = p_request_id for update;
  if request_row.id is null then
    return jsonb_build_object('error', 'Solicitação não encontrada.', 'code', 'request_not_found');
  end if;
  if request_row.status <> 'pending' then
    return jsonb_build_object('error', 'Esta solicitação já foi analisada.', 'code', 'request_already_reviewed');
  end if;
  if exists (select 1 from public.company_users cu where cu.user_id = request_row.user_id) then
    return jsonb_build_object('error', 'Esta conta já está ligada a uma empresa.', 'code', 'already_linked');
  end if;
  if exists (select 1 from public.stores s where s.cnpj = request_row.document) then
    return jsonb_build_object('error', 'Já existe uma loja cadastrada com este CPF ou CNPJ.', 'code', 'document_in_use');
  end if;

  base_slug := trim(both '-' from regexp_replace(
    lower(translate(request_row.company_name, 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'loja'; end if;
  company_slug := base_slug;
  while exists (select 1 from public.tenants t where t.slug = company_slug) loop
    company_slug := base_slug || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.tenants (name, slug, owner_name, owner_phone, is_active, approved_at, trial_ends_at)
  values (
    request_row.company_name,
    company_slug,
    request_row.owner_name,
    request_row.owner_phone,
    true,
    now(),
    case when p_trial_days is null then null else now() + make_interval(days => p_trial_days) end
  )
  returning id into new_tenant_id;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (new_tenant_id, request_row.user_id, 'manager')
  on conflict do nothing;

  insert into public.company_users (tenant_id, user_id, role, roles, is_active, created_by)
  values (new_tenant_id, request_row.user_id, 'owner', array['owner'], true, auth.uid());

  insert into public.tenant_parameters (tenant_id, parameter_key, parameter_value, is_public)
  values (new_tenant_id, 'calculate_delivery_fee', 'true'::jsonb, true)
  on conflict (tenant_id, parameter_key) do nothing;

  insert into public.profiles (id, full_name, phone)
  values (request_row.user_id, request_row.owner_name, request_row.owner_phone)
  on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone, updated_at = now();

  insert into public.stores (tenant_id, name, slug, cnpj, segment, whatsapp_phone, address, is_active)
  values (
    new_tenant_id,
    request_row.company_name,
    base_slug,
    request_row.document,
    request_row.segment::public.store_segment,
    request_row.owner_phone,
    coalesce(request_row.address, request_row.city),
    true
  )
  returning id into new_store_id;

  update public.company_requests
  set status = 'approved', tenant_id = new_tenant_id, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = request_row.id;

  return jsonb_build_object('tenant_id', new_tenant_id, 'store_id', new_store_id, 'slug', company_slug);
end;
$$;

revoke all on function public.approve_company_request(uuid, integer) from public;
grant execute on function public.approve_company_request(uuid, integer) to authenticated;

create or replace function public.reject_company_request(p_request_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    return jsonb_build_object('error', 'Informe o motivo da recusa.', 'code', 'reason_required');
  end if;

  update public.company_requests
  set status = 'rejected', rejection_reason = trim(p_reason), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = p_request_id and status = 'pending'
  returning id into updated_id;

  if updated_id is null then
    return jsonb_build_object('error', 'Solicitação não encontrada ou já analisada.', 'code', 'request_not_pending');
  end if;
  return jsonb_build_object('request_id', updated_id, 'status', 'rejected');
end;
$$;

revoke all on function public.reject_company_request(uuid, text) from public;
grant execute on function public.reject_company_request(uuid, text) to authenticated;

-- Suspende ou reativa a empresa (e ajusta o teste). Só administradores.
create or replace function public.admin_set_company_status(
  p_tenant_id uuid,
  p_is_active boolean,
  p_reason text default null,
  p_trial_ends_at timestamptz default null,
  p_clear_trial boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.tenants
  set is_active = p_is_active,
      suspended_reason = case when p_is_active then null else nullif(trim(coalesce(p_reason, '')), '') end,
      trial_ends_at = case when p_clear_trial then null when p_trial_ends_at is not null then p_trial_ends_at else trial_ends_at end
  where id = p_tenant_id
  returning id into updated_id;

  if updated_id is null then
    return jsonb_build_object('error', 'Empresa não encontrada.', 'code', 'tenant_not_found');
  end if;
  return jsonb_build_object('tenant_id', updated_id, 'is_active', p_is_active);
end;
$$;

revoke all on function public.admin_set_company_status(uuid, boolean, text, timestamptz, boolean) from public;
grant execute on function public.admin_set_company_status(uuid, boolean, text, timestamptz, boolean) to authenticated;

-- Situação de cada empresa para o monitoramento (status, teste, aprovação).
create or replace function public.admin_list_company_status()
returns table (
  tenant_id uuid,
  is_active boolean,
  effective_active boolean,
  trial_ends_at timestamptz,
  approved_at timestamptz,
  suspended_reason text,
  branch_count bigint,
  product_count bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select t.id, t.is_active, public.is_tenant_active(t.id), t.trial_ends_at, t.approved_at, t.suspended_reason,
         (select count(*) from public.stores s where s.tenant_id = t.id),
         (select count(*) from public.products p join public.stores s on s.id = p.store_id where s.tenant_id = t.id),
         t.created_at
  from public.tenants t
  order by t.created_at desc;
end;
$$;

revoke all on function public.admin_list_company_status() from public;
grant execute on function public.admin_list_company_status() to authenticated;

notify pgrst, 'reload schema';

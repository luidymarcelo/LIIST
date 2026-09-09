-- Fila de impressão para comandas internas.
-- Run after 023_operational_workflow.sql.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.print_agent_tokens (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null default 'Agente de impressão',
  token_hash text not null unique,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  reason text not null default 'manual' check (reason in ('manual', 'automatic', 'reprint')),
  status text not null default 'queued' check (status in ('queued', 'claimed', 'printed', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  agent_id uuid references public.print_agent_tokens(id) on delete set null,
  claimed_at timestamptz,
  printed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists print_agent_tokens_store_idx
  on public.print_agent_tokens (store_id, is_active);

create index if not exists print_jobs_store_status_created_idx
  on public.print_jobs (store_id, status, created_at);

create index if not exists print_jobs_order_created_idx
  on public.print_jobs (order_id, created_at);

create unique index if not exists print_jobs_auto_once_idx
  on public.print_jobs (order_id)
  where reason = 'automatic';

alter table public.print_agent_tokens enable row level security;
alter table public.print_jobs enable row level security;

drop policy if exists "managers manage print agent tokens" on public.print_agent_tokens;
create policy "managers manage print agent tokens"
  on public.print_agent_tokens for all
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

drop policy if exists "operators read print jobs" on public.print_jobs;
create policy "operators read print jobs"
  on public.print_jobs for select
  to authenticated
  using (public.can_operate_store(store_id));

drop policy if exists "operators enqueue print jobs" on public.print_jobs;
create policy "operators enqueue print jobs"
  on public.print_jobs for insert
  to authenticated
  with check (public.can_operate_store(store_id));

drop policy if exists "operators update print jobs" on public.print_jobs;
create policy "operators update print jobs"
  on public.print_jobs for update
  to authenticated
  using (public.can_operate_store(store_id))
  with check (public.can_operate_store(store_id));

grant select, insert, update, delete on public.print_agent_tokens to authenticated;
grant select, insert, update on public.print_jobs to authenticated;

create or replace function public.print_mode_for_store(target_store_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when resolved.mode in ('disabled', 'manual', 'automatic', 'manual_and_automatic') then resolved.mode
    else 'disabled'
  end
  from (
    select coalesce(
      (select sp.parameter_value #>> '{}' from public.store_parameters sp where sp.store_id = target_store_id and sp.parameter_key = 'internal_print_mode'),
      (select tp.parameter_value #>> '{}' from public.tenant_parameters tp join public.stores s on s.tenant_id = tp.tenant_id where s.id = target_store_id and tp.parameter_key = 'internal_print_mode'),
      'disabled'
    ) as mode
  ) resolved;
$$;

create or replace function public.build_print_job_payload(target_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  select jsonb_build_object(
    'order_id', o.id,
    'order_code', o.order_code,
    'created_at', o.created_at,
    'status', o.status,
    'source', o.order_source,
    'customer_name', o.customer_name,
    'created_by_name', o.created_by_name,
    'created_by_role', o.created_by_role,
    'notes', o.notes,
    'payment_method', o.payment_method,
    'total', o.total,
    'company', jsonb_build_object(
      'id', t.id,
      'name', t.name
    ),
    'store', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'whatsapp_phone', s.whatsapp_phone,
      'address', s.address
    ),
    'table', case when rt.id is null then null else jsonb_build_object(
      'id', rt.id,
      'code', rt.code,
      'name', rt.name
    ) end,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_name', oi.product_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total', oi.total,
            'selected_options', coalesce(oi.selected_options, '[]'::jsonb),
            'production_status', oi.production_status,
            'delivery_status', oi.delivery_status
          )
          order by oi.id
        )
        from public.order_items oi
        where oi.order_id = o.id
      ),
      '[]'::jsonb
    )
  )
  into payload
  from public.orders o
  join public.stores s on s.id = o.store_id
  join public.tenants t on t.id = s.tenant_id
  left join public.restaurant_tables rt on rt.id = o.table_id
  where o.id = target_order_id;

  return payload;
end;
$$;

create or replace function public.enqueue_internal_order_print(
  p_order_id uuid,
  p_reason text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_order public.orders%rowtype;
  resolved_reason text := case when p_reason in ('manual', 'automatic', 'reprint') then p_reason else 'manual' end;
  resolved_mode text;
  created_job_id uuid;
begin
  select * into target_order
  from public.orders
  where id = p_order_id
    and order_channel = 'internal';

  if target_order.id is null then
    raise exception 'internal order not found';
  end if;

  resolved_mode := public.print_mode_for_store(target_order.store_id);

  if resolved_reason in ('manual', 'reprint') then
    if actor_id is null or not public.can_operate_store(target_order.store_id) then
      raise exception 'print access denied';
    end if;
    if resolved_mode not in ('manual', 'manual_and_automatic') then
      raise exception 'manual print is disabled';
    end if;
  end if;

  if resolved_reason = 'automatic' and actor_id is not null and not public.can_operate_store(target_order.store_id) then
    raise exception 'print access denied';
  end if;

  if resolved_reason = 'automatic' and resolved_mode not in ('automatic', 'manual_and_automatic') then
    return jsonb_build_object('queued', false, 'mode', resolved_mode);
  end if;

  insert into public.print_jobs (store_id, order_id, reason, status)
  values (target_order.store_id, target_order.id, resolved_reason, 'queued')
  on conflict do nothing
  returning id into created_job_id;

  return jsonb_build_object(
    'queued', created_job_id is not null,
    'job_id', created_job_id,
    'mode', resolved_mode
  );
end;
$$;

create or replace function public.enqueue_automatic_internal_order_print()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_channel = 'internal' then
    perform public.enqueue_internal_order_print(new.id, 'automatic');
  end if;
  return new;
end;
$$;

drop trigger if exists enqueue_automatic_internal_order_print on public.orders;
create trigger enqueue_automatic_internal_order_print
after insert on public.orders
for each row execute function public.enqueue_automatic_internal_order_print();

create or replace function public.create_print_agent_token(
  p_store_id uuid,
  p_name text default 'Agente de impressão'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  raw_token text;
  created_token public.print_agent_tokens%rowtype;
begin
  if auth.uid() is not null and not public.can_manage_store(p_store_id) then
    raise exception 'print agent token access denied';
  end if;

  raw_token := 'liist_pat_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.print_agent_tokens (store_id, name, token_hash)
  values (p_store_id, coalesce(nullif(trim(p_name), ''), 'Agente de impressão'), encode(digest(raw_token, 'sha256'), 'hex'))
  returning * into created_token;

  return jsonb_build_object(
    'id', created_token.id,
    'store_id', created_token.store_id,
    'name', created_token.name,
    'token', raw_token,
    'created_at', created_token.created_at
  );
end;
$$;

create or replace function public.claim_next_print_job(
  p_token text,
  p_agent_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  agent public.print_agent_tokens%rowtype;
  job public.print_jobs%rowtype;
begin
  select * into agent
  from public.print_agent_tokens
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and is_active
  limit 1;

  if agent.id is null then
    raise exception 'invalid print agent token';
  end if;

  update public.print_agent_tokens
  set last_used_at = now(),
      name = coalesce(nullif(trim(p_agent_name), ''), name)
  where id = agent.id;

  select pj.* into job
  from public.print_jobs pj
  where pj.store_id = agent.store_id
    and pj.status in ('queued', 'failed')
    and pj.attempts < 5
    and exists (select 1 from public.order_items oi where oi.order_id = pj.order_id)
  order by pj.created_at
  for update skip locked
  limit 1;

  if job.id is null then
    return jsonb_build_object('job_id', null);
  end if;

  update public.print_jobs
  set status = 'claimed',
      attempts = attempts + 1,
      agent_id = agent.id,
      claimed_at = now(),
      last_error = null,
      updated_at = now()
  where id = job.id
  returning * into job;

  return jsonb_build_object(
    'job_id', job.id,
    'reason', job.reason,
    'payload', public.build_print_job_payload(job.order_id)
  );
end;
$$;

create or replace function public.complete_print_job(
  p_token text,
  p_job_id uuid,
  p_success boolean,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  agent public.print_agent_tokens%rowtype;
  updated_job public.print_jobs%rowtype;
begin
  select * into agent
  from public.print_agent_tokens
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and is_active
  limit 1;

  if agent.id is null then
    raise exception 'invalid print agent token';
  end if;

  update public.print_jobs
  set status = case when p_success then 'printed' else 'failed' end,
      printed_at = case when p_success then now() else printed_at end,
      last_error = case when p_success then null else left(coalesce(p_error, 'print failed'), 500) end,
      updated_at = now()
  where id = p_job_id
    and store_id = agent.store_id
    and status in ('claimed', 'queued', 'failed')
  returning * into updated_job;

  if updated_job.id is null then
    raise exception 'print job not found';
  end if;

  return jsonb_build_object('completed', p_success, 'job_id', updated_job.id, 'status', updated_job.status);
end;
$$;

revoke all on function public.print_mode_for_store(uuid) from public;
revoke all on function public.build_print_job_payload(uuid) from public;
revoke all on function public.enqueue_internal_order_print(uuid, text) from public;
revoke all on function public.create_print_agent_token(uuid, text) from public;
revoke all on function public.claim_next_print_job(text, text) from public;
revoke all on function public.complete_print_job(text, uuid, boolean, text) from public;

grant execute on function public.print_mode_for_store(uuid) to authenticated;
grant execute on function public.build_print_job_payload(uuid) to authenticated;
grant execute on function public.enqueue_internal_order_print(uuid, text) to authenticated;
grant execute on function public.create_print_agent_token(uuid, text) to authenticated;
grant execute on function public.claim_next_print_job(text, text) to anon, authenticated;
grant execute on function public.complete_print_job(text, uuid, boolean, text) to anon, authenticated;

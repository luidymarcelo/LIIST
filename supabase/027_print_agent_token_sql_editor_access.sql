-- Permite gerar token do agente de impressão pelo SQL Editor/Service Role.
-- Usuários autenticados pelo app continuam precisando gerenciar a filial.

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

revoke all on function public.create_print_agent_token(uuid, text) from public;
grant execute on function public.create_print_agent_token(uuid, text) to authenticated;

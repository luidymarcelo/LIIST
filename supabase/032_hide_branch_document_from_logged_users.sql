-- Contas logadas (garçom, caixa, cozinha, lojista de outra empresa) também não leem stores.cnpj direto da tabela.
-- A 029 só tirou a coluna dos visitantes (anon), mas a leitura das lojas ativas vale para qualquer conta,
-- e stores.cnpj pode guardar CPF. O documento passa a vir por get_store_documents, que confere quem pede.
-- Aplique depois da 029 e da 031.

revoke select on public.stores from authenticated;
do $$
declare
  readable_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into readable_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'stores' and column_name <> 'cnpj';
  execute format('grant select (%s) on public.stores to authenticated', readable_columns);
end;
$$;
-- Ao criar novas colunas em stores, conceda select a anon e a authenticated nelas se as telas precisarem.

-- Documento das filiais que a conta pode ver: admin da plataforma, dono da empresa
-- ou alguém da equipe ligado àquela filial (a equipe usa o documento para abrir a operação).
create or replace function public.get_store_documents(p_store_ids uuid[])
returns table (store_id uuid, document text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.cnpj
  from public.stores s
  where s.id = any(p_store_ids)
    and (
      public.is_platform_admin()
      or public.is_company_owner(s.tenant_id)
      or exists (
        select 1
        from public.company_user_stores cus
        join public.company_users cu on cu.tenant_id = cus.tenant_id and cu.user_id = cus.user_id
        where cus.store_id = s.id
          and cus.user_id = auth.uid()
          and cu.is_active
      )
    );
$$;

revoke all on function public.get_store_documents(uuid[]) from public;
grant execute on function public.get_store_documents(uuid[]) to authenticated;

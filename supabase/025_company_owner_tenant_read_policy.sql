-- Permite que o proprietário leia a própria empresa pela API autenticada.
-- Necessário para abrir e atualizar a tela de identidade no Portal da empresa.
drop policy if exists "company owners read own company" on public.tenants;
create policy "company owners read own company"
  on public.tenants for select
  to authenticated
  using (public.is_company_owner(id));

grant select on public.tenants to authenticated;

notify pgrst, 'reload schema';

-- Run after 027_print_agent_token_sql_editor_access.sql.
-- Allows the company owner to read and manage private company-level parameters.

drop policy if exists "company owners manage tenant parameters" on public.tenant_parameters;
create policy "company owners manage tenant parameters"
  on public.tenant_parameters for all
  to authenticated
  using (public.is_company_owner(tenant_id))
  with check (public.is_company_owner(tenant_id));

grant select, insert, update, delete on public.tenant_parameters to authenticated;

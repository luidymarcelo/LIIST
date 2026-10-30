-- Colunas de exibicao da filial que ja existem na producao, mas nao estavam em nenhuma migration.
-- Na producao este arquivo nao muda nada; num banco novo ele cria as colunas que o catalogo publico le.
alter table public.stores
  add column if not exists pickup_time_label text,
  add column if not exists show_minimum_order boolean not null default false,
  add column if not exists show_delivery_time boolean not null default false,
  add column if not exists show_pickup_time boolean not null default false;

-- A 029 libera para visitantes so as colunas de stores que existiam ate ali (sem o cnpj).
grant select (pickup_time_label, show_minimum_order, show_delivery_time, show_pickup_time) on public.stores to anon;

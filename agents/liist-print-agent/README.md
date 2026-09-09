# LIIST Print Agent

Agente local para impressão de comandas internas.

Ele roda no computador da loja, consulta o Supabase, pega o próximo trabalho da fila `print_jobs`, gera um arquivo `.txt` da comanda e, se configurado, executa o comando local de impressão.

## Configuração

1. Execute a migration `supabase/026_internal_order_printing.sql` no SQL Editor do Supabase.
2. Gere um token para a filial:

```sql
select public.create_print_agent_token('ID_DA_FILIAL_AQUI', 'Computador do caixa');
```

3. Copie o campo `token` retornado e configure as variáveis:

```powershell
$env:LIIST_SUPABASE_URL="https://seu-projeto.supabase.co"
$env:LIIST_SUPABASE_ANON_KEY="sua-chave-anon"
$env:LIIST_PRINT_AGENT_TOKEN="liist_pat_..."
$env:LIIST_PRINT_OUTPUT_DIR="print-outbox"
$env:LIIST_PRINT_INTERVAL_SECONDS="4"
```

4. Rode o agente:

```powershell
go run .
```

Sem `LIIST_PRINT_COMMAND`, ele apenas cria os arquivos `.txt` na pasta `print-outbox`. Para impressão automática no Windows:

```powershell
$env:LIIST_PRINT_COMMAND='powershell -NoProfile -Command Start-Process -FilePath "{file}" -Verb Print'
go run .
```

## Como usar no painel

No portal da empresa, abra a empresa e acesse `Parâmetros`.

- `Desativada`: não cria trabalhos de impressão.
- `Manual`: mostra botão de imprimir/reimprimir no painel operacional.
- `Automática`: pedidos internos entram na fila automaticamente.
- `Manual + automática`: imprime automaticamente e permite reimprimir.

Cada filial pode herdar o padrão da empresa ou ter uma configuração própria.

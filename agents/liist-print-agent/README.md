# LIIST Print Agent

Agente local para impressao de comandas internas.

Ele roda no computador da loja, consulta o Supabase, pega o proximo trabalho da fila `print_jobs`, gera um arquivo `.txt` da comanda e imprime na impressora configurada.

## Caminho facil no Windows

Esse caminho nao precisa instalar Go. Ele usa PowerShell, que ja vem no Windows.

1. Execute as migrations no SQL Editor do Supabase:

- `supabase/026_internal_order_printing.sql`
- `supabase/027_print_agent_token_sql_editor_access.sql`

2. Gere um token para a filial:

```sql
select public.create_print_agent_token('ID_DA_FILIAL_AQUI', 'Computador do caixa');
```

3. No computador da loja, liste as impressoras:

```powershell
cd C:\caminho\do\projeto\agents\liist-print-agent
.\windows-list-printers.ps1
```

Copie o valor da coluna `Name` da impressora correta.

4. Inicie o agente:

```powershell
.\windows-agent.ps1 `
  -SupabaseUrl "https://seu-projeto.supabase.co" `
  -SupabaseAnonKey "sua-chave-anon" `
  -AgentToken "liist_pat_token_gerado_no_supabase" `
  -PrinterName "Nome exato da impressora"
```

Se `-PrinterName` ficar vazio, o Windows usa a impressora padrao. Para loja com duas impressoras, informe sempre o nome exato, por exemplo:

```powershell
-PrinterName "EPSON TM-T20 Receipt"
```

As comandas impressas tambem ficam salvas na pasta `print-outbox`.

## Caminho tecnico com Go

Use este caminho se quiser gerar um executavel futuramente.

1. Execute as migrations `supabase/026_internal_order_printing.sql` e `supabase/027_print_agent_token_sql_editor_access.sql` no SQL Editor do Supabase.
2. Gere um token para a filial:

```sql
select public.create_print_agent_token('ID_DA_FILIAL_AQUI', 'Computador do caixa');
```

3. Copie o campo `token` retornado e configure as variaveis:

```powershell
$env:LIIST_SUPABASE_URL="https://seu-projeto.supabase.co"
$env:LIIST_SUPABASE_ANON_KEY="sua-chave-anon"
$env:LIIST_PRINT_AGENT_TOKEN="liist_pat_..."
$env:LIIST_PRINT_OUTPUT_DIR="print-outbox"
$env:LIIST_PRINT_INTERVAL_SECONDS="4"
$env:LIIST_PRINTER_NAME="Nome exato da impressora"
```

4. Rode o agente:

```powershell
go run .
```

Sem `LIIST_PRINT_COMMAND`, ele apenas cria os arquivos `.txt` na pasta `print-outbox`. Para impressao automatica em uma impressora especifica no Windows:

```powershell
$env:LIIST_PRINT_COMMAND='powershell -NoProfile -Command Start-Process -FilePath "$env:WINDIR\System32\notepad.exe" -ArgumentList "/pt","{file}","{printer}" -Wait -WindowStyle Hidden'
go run .
```

## Como usar no painel

No portal da empresa, abra a empresa e acesse `Parametros`.

- `Desativada`: nao cria trabalhos de impressao.
- `Manual`: mostra botao de imprimir/reimprimir no painel operacional.
- `Automatica`: pedidos internos entram na fila automaticamente.
- `Manual + automatica`: imprime automaticamente e permite reimprimir.

Cada filial pode herdar o padrao da empresa ou ter uma configuracao propria.

# LIIST Commerce

Aplicacao web da LIIST para catalogo com carrinho, pedido pelo WhatsApp, comanda interna e operacao por filial. A primeira versao usa Supabase e Cloudflare para validar a experiencia de venda e preparar integracoes por planilha, banco legado ou API.

## Rodar localmente

```bash
npm install
npm run dev
```

Os scripts usam Node 22 temporario via `npx`, porque o ambiente local atual tem Node 18 e o stack do projeto exige Node 22+.

## Configurar o Supabase em outro computador

O arquivo `.env.local` nao e enviado ao GitHub. Cada computador precisa criar o seu:

```powershell
Copy-Item .env.example .env.local
```

Depois, edite o `.env.local` e preencha os dois valores usando os dados do mesmo projeto no painel do Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-publica-anon
```

Use somente a chave publica `anon`. Nunca coloque a `service_role` no frontend. Depois de salvar o arquivo, encerre e execute `npm run dev` novamente.

## Estrutura principal

- `app/page.tsx`: experiencia do catalogo, carrinho e checkout.
- `app/operacao/page.tsx`: mapa de mesas e entrada da equipe operacional.
- `app/pedidos/page.tsx`: areas separadas de atendimento, cozinha e caixa.
- `app/globals.css`: layout responsivo e identidade visual.
- `supabase/schema.sql`: schema inicial para multiempresa, lojas, produtos, integracoes, sincronizacoes e pedidos.
- `.env.example`: modelo das variaveis locais necessarias para conectar ao Supabase.

## Fluxo de comandas

Depois do schema inicial, aplique as migrations da pasta `supabase` em ordem numerica. Para a operacao atual, as ultimas migrations obrigatorias sao:

1. `021_branch_access_tables_and_audit.sql`: acessos por filial, mesas e auditoria.
2. `022_multi_role_company_users.sql`: mais de uma funcao por usuario.
3. `023_operational_workflow.sql`: fluxo simplificado/completo, preparo e entrega por item, fechamento, pagamento e liberacao da mesa.

Execute somente o conteudo SQL no SQL Editor do Supabase. A funcao `supabase/functions/create-store-user/index.ts` deve ser publicada como Edge Function separadamente.

## Integracoes previstas

- Material de construcao: conector por banco legado com rotina agendada e botao manual de atualizacao de precos.
- Farmacia: conector por API externa com cache para estoque e precos.
- Outros segmentos: cadastro de loja, categorias e produtos no Supabase.

## Publicar no Cloudflare Workers

O LIIST usa um Worker para renderizar as paginas e servir as rotas da aplicacao.
Nao publique somente os arquivos estaticos no Cloudflare Pages.

Em Workers & Pages, importe o repositorio `luidymarcelo/LIIST` e configure:

| Campo | Valor |
| --- | --- |
| Worker name | `liist` |
| Production branch | `main` |
| Root directory | Raiz do repositorio (deixe o padrao) |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Builds for non-production branches | Desativado inicialmente |
| Protect with Cloudflare Access | Desativado para permitir o catalogo publico |

Cadastre estas variaveis no ambiente de **build**, antes da primeira publicacao:

- `NODE_VERSION`: `22.16.0` (ou Node 22 mais recente).
- `NEXT_PUBLIC_SUPABASE_URL`: URL do mesmo projeto Supabase usado localmente.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: chave publica `anon` desse projeto.

O `.env.local` nao esta no GitHub. As duas variaveis `NEXT_PUBLIC_*` sao
incorporadas ao frontend durante o build; alterar somente variaveis de runtime
nao atualiza o frontend. Nao use a chave `service_role` nesses campos.
O login dos paineis continua sendo feito pelo Supabase, sem Cloudflare Access.

Para validar localmente o pacote, sem publicar:

```bash
npm run build
npm run deploy:check
```

O plugin Cloudflare gera `dist/server/wrangler.json` com o Worker compilado e
os assets de `dist/client`. O comando de deploy utiliza essa configuracao
gerada, nao o arquivo TypeScript de entrada diretamente.

A publicacao do Worker nao executa migrations nem publica Edge Functions do
Supabase. Mantenha o projeto Supabase ja configurado.

Depois do deploy, teste o endereco `workers.dev`, incluindo login, links de
lojas e mesas. Somente depois vincule `liist.com.br` e `www.liist.com.br` em
Settings > Domains & Routes > Custom Domain. Os registros DNS atuais apontam
para a hospedagem anterior; nao os altere antes de validar a nova publicacao.

No Supabase, configure Authentication > URL Configuration com Site URL
`https://liist.com.br` e os redirects dos dominios que serao utilizados.

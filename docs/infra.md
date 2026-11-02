# Infraestrutura

Onde a `events-api` roda, o que cada ambiente usa e como mexer em cada peça. Decisões de arquitetura por trás disso: ADR-0006 (remetente), ADR-0007 (Vercel e Upstash). Provisionado na [PROJ-53](https://flpenteado.atlassian.net/browse/PROJ-53).

Nenhum segredo mora aqui nem no repositório: os valores ficam nas variáveis de ambiente da Vercel (marcadas como *sensitive*, não dá para lê-las de volta) e no gerenciador de senhas do mantenedor.

## Ambientes

| | Produção | Preview | Local |
|---|---|---|---|
| Quando | push em `main` | PRs e outras branches | `npm run dev` |
| Banco (Neon `events-api`) | branch `main` | branch `dev` | Postgres local (`docker-local`) |
| `DOCS_ENABLED` | `false` | `true` | `true` |
| `NODE_ENV` | `production` | `production` | `development` |
| `CLERK_SECRET_KEY` | instância de produção do Clerk | instância de desenvolvimento | `.env` (opcional) |
| `CLERK_WEBHOOK_SIGNING_SECRET` | endpoint de webhook da instância de produção | endpoint da instância de desenvolvimento | `.env` (opcional) |
| `ACTIVATION_REDIRECT_URL` | deep link do events-expo | deep link do events-expo | `.env` (opcional) |
| `STORAGE_NAMESPACE` (Cloudinary) | `events-api` | `events-api-preview` | — |
| Redis (Upstash) | banco `events-api`, prefixo `events-api:production` | mesmo banco, prefixo `events-api:preview` | memória (ou Upstash com prefixo `events-api:local`, se configurado) |
| `EMAIL_FROM_ADDRESS` | `noreply@mail.fawedding.com.br` | idem | — |
| `CORS_ORIGINS` | não definida (origem do Panel pendente) | não definida (origem do Panel pendente) | não definida (localhost já é liberado em dev) |

Variáveis na Vercel, iguais nos dois ambientes salvo as marcadas acima: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `ACTIVATION_REDIRECT_URL`, `NODE_ENV`, `DOCS_ENABLED`, `EMAIL_FROM_ADDRESS`, `RESEND_API_KEY`, `STORAGE_NAMESPACE`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. A `CORS_ORIGINS` só é criada quando o Panel tiver URL: a Vercel não aceita valor vazio, e não definida equivale a vazia.

## Serviços

**Vercel**: projeto `events-api` (conta pessoal, plano Hobby), ligado ao repositório no GitHub, branch de produção `main`, região `iad1`, Node 22. O `vercel.json` não tem framework nem build: a API é só a função `api/index.ts`, que a Vercel compila com o TypeScript do projeto. A proteção de deployments (*Vercel Authentication*) cobre todas as URLs `*.vercel.app`, inclusive a de produção: para testar um preview pelo terminal, use `npx vercel curl <caminho> --deployment <url>`.

**Neon**: projeto `events-api` (`patient-bar-43479758`), `us-east-1`, Postgres 17, banco e role `events_api`. A app usa a URL **com pooler**; migrations precisam da URL **direta**.

**Clerk** (ADR-0020): identidade dos Users, plano Hobby. O token de sessão padrão não traz o email, então cada instância precisa destes claims em *Sessions → Customize session token* (ou `npx clerk@latest config patch`), sem eles todo token é recusado com 401:

```json
{ "email": "{{user.primary_email_address}}", "email_verified": "{{user.email_verified}}" }
```

A API verifica o token com `verifyToken` do `@clerk/backend` e a `CLERK_SECRET_KEY`. Chave inválida ou JWKS fora do ar viram 500, não 401. Duas variáveis opcionais endurecem a verificação:

- `CLERK_JWT_KEY`: a chave pública PEM da instância (*API keys → JWT public key*). Com ela, a verificação não sai para a rede, e um token forjado com `kid` desconhecido não custa uma busca do JWKS a cada requisição. Recomendada em produção.
- `CLERK_AUTHORIZED_PARTIES`: as origens exatas aceitas no `azp` do token, como no `CORS_ORIGINS`. Preenchida, o Clerk recusa também o token **sem** `azp`. Antes de definir, confira o que o events-expo manda.

O webhook do Clerk mantém o espelho de nome e email do User em dia (ADR-0020). Em cada instância, crie em *Webhooks* um endpoint para `https://<host>/api/v1/webhooks/clerk` assinando só o evento `user.updated`, e copie o *Signing secret* (`whsec_...`) para a `CLERK_WEBHOOK_SIGNING_SECRET`. A rota é pública e verifica a assinatura do Svix sobre o corpo cru: sem assinatura válida, 401. Ela só atualiza nome e email (o primário, se verificado) do User já vinculado pelo `clerkId`, sem Author; nunca cria User nem vínculo, e responde 200 sem efeito a `clerkId` desconhecido e a outros eventos. Se o novo email já for de outro User, só o nome muda e fica um aviso no log. Como os previews ficam atrás da *Vercel Authentication*, o Clerk não alcança um preview sem um bypass da proteção.

O Activation link é um convite do Clerk criado pela API (`InvitationIssuer`) com `notify: false`, então o Clerk não manda email: a url volta na resposta a quem criou o User. O convite vale `ACTIVATION_LINK_TTL_DAYS` dias e, aceito, leva ao `ACTIVATION_REDIRECT_URL`, o deep link do events-expo. Se o Clerk falhar ao convidar, o User não é criado e a resposta é 500.

**Upstash**: um banco Redis `events-api` no plano Free, `us-east-1`, compartilhado pelos ambientes com prefixo de chave por ambiente (vem do `VERCEL_ENV`). Guarda só os contadores do rate limit, com a chave em hash (nenhum IP ou email em claro). As credenciais são obrigatórias com `NODE_ENV=production`: sem elas o deploy não sobe. Se o Upstash cair ou demorar mais de 1 s, o rate limit deixa a requisição passar e registra o erro no log.

**Resend**: domínio `mail.fawedding.com.br` (região `us-east-1`) como Platform sender. A chave de API `events-api` só envia por esse domínio. O `bgwedding.com.br` continua lá enquanto a `fawedding-api` estiver no ar; sai na PROJ-71.

**Cloudinary**: mesma conta da `fawedding-api`, com uma chave de API própria (`events-api`) para poder ser revogada sozinha. As imagens antigas continuam em `fawedding/<id>/gifts`.

**Banco antigo**: no projeto Neon `fawedding` (`holy-bar-30130887`), banco `fawedding`, a role `events_api_migration_ro` só lê (SELECT nas tabelas de `public`, transações somente leitura por padrão). A URL dela é a `OLD_DATABASE_URL` da migração (PROJ-68) e fica só no `.env` local e no gerenciador de senhas, nunca na Vercel.

## Migrations

Por enquanto, manuais. Com o `neonctl` logado, a URL direta é lida na hora e não aparece na tela:

```bash
DATABASE_URL="$(npx neonctl connection-string dev --project-id patient-bar-43479758 \
  --role-name events_api --database-name events_api)" npx prisma migrate deploy
```

Troque `dev` por `main` para produção.

A automação vai rodar no GitHub Actions, não no build da Vercel: lá a migration seria aplicada no banco mesmo quando o deploy falhasse depois, e com `framework: null` qualquer `buildCommand` faz a Vercel exigir um diretório `public`. O job precisa da URL **direta**. A implementação e a estratégia para os previews (migrar o `dev`, um branch do Neon por PR ou nada) ficam na PROJ-71.

## Super admin

São dois passos, em qualquer ordem, por ambiente: o User local no banco e o convite no Clerk, os dois com o mesmo email.

1. **User local.** O script cria o User como Super admin, ou promove um User que já existe. É idempotente e não tem senha:

   ```bash
   DATABASE_URL="$(npx neonctl connection-string <branch> --project-id patient-bar-43479758 \
     --role-name events_api --database-name events_api)" \
   npm run create-super-admin -- --email=<email> --name="<nome>" --phone="<+DDI e número>"
   ```

2. **Entrada no Clerk.** O Clerk só aceita quem foi convidado. No dashboard da instância do ambiente (produção ou desenvolvimento), em *Users → Invitations*, convide o mesmo email. A pessoa aceita o convite e entra por senha, Google ou Apple; a primeira requisição autenticada vincula o usuário do Clerk ao User local (ADR-0020).

O script ainda não convida pelo `InvitationIssuer`: o convite do Super admin continua manual. No banco local, o `npx prisma db seed` faz o passo 1 para `admin@local.test`; o passo 2 é na instância de desenvolvimento.

## Limitações conhecidas

- **`vercel dev` não sobe a API.** Ele roda o TypeScript pelo `tsx` (esbuild), que não emite o metadata de decorators do qual a injeção de dependência do NestJS depende, e as classes do Nest recebem `undefined` no construtor. Localmente, use `npm run dev`; o deploy da Vercel compila com o `tsc` e funciona. A correção, se um dia for preciso, é declarar a injeção explicitamente com `@Inject(Token)` em cada parâmetro de construtor das classes do Nest, o que deixa o código independente do compilador (e muda a regra correspondente na skill `new-use-case`). Planejado na [PROJ-80](https://flpenteado.atlassian.net/browse/PROJ-80).
- **O primeiro deploy do projeto saiu como produção**, a partir da `feat/task-53`, mesmo com `main` como branch de produção: a Vercel promove o primeiro deploy quando ainda não existe nenhum. A partir dele, só `main` vai para produção.
- **Aviso de `sslmode` do driver `pg`.** As URLs do Neon vêm com `sslmode=require`, que hoje o driver trata como `verify-full` (confere o certificado) e avisa que isso vai enfraquecer numa versão futura. Para manter o comportamento atual e calar o aviso, troque para `sslmode=verify-full` nas URLs guardadas na Vercel.
- **A URL de produção `*.vercel.app` também exige login na Vercel.** Antes de apontar os Sites para a API (PROJ-71), é preciso um domínio próprio ou mudar a proteção.

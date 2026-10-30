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
| `JWT_SECRET` | próprio | próprio (diferente da produção) | `.env` |
| `STORAGE_NAMESPACE` (Cloudinary) | `events-api` | `events-api-preview` | — |
| Redis (Upstash) | banco `events-api`, prefixo `events-api:production` | mesmo banco, prefixo `events-api:preview` | memória (ou Upstash com prefixo `events-api:local`, se configurado) |
| `EMAIL_FROM_ADDRESS` | `noreply@mail.fawedding.com.br` | idem | — |
| `CORS_ORIGINS` | não definida (origem do Panel pendente) | não definida (origem do Panel pendente) | não definida (localhost já é liberado em dev) |

Variáveis na Vercel, iguais nos dois ambientes salvo as marcadas acima: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `DOCS_ENABLED`, `EMAIL_FROM_ADDRESS`, `RESEND_API_KEY`, `STORAGE_NAMESPACE`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. A `CORS_ORIGINS` só é criada quando o Panel tiver URL: a Vercel não aceita valor vazio, e não definida equivale a vazia.

## Serviços

**Vercel**: projeto `events-api` (conta pessoal, plano Hobby), ligado ao repositório no GitHub, branch de produção `main`, região `iad1`, Node 22. O `vercel.json` não tem framework nem build: a API é só a função `api/index.ts`, que a Vercel compila com o TypeScript do projeto. A proteção de deployments (*Vercel Authentication*) cobre todas as URLs `*.vercel.app`, inclusive a de produção: para testar um preview pelo terminal, use `npx vercel curl <caminho> --deployment <url>`.

**Neon**: projeto `events-api` (`patient-bar-43479758`), `us-east-1`, Postgres 17, banco e role `events_api`. A app usa a URL **com pooler**; migrations precisam da URL **direta**.

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

Criado em cada banco com o script, a senha digitada sem eco e fora do histórico do shell:

```bash
read -rs ADMIN_PASSWORD && export ADMIN_PASSWORD
DATABASE_URL="$(npx neonctl connection-string <branch> --project-id patient-bar-43479758 \
  --role-name events_api --database-name events_api)" \
NODE_ENV=production npm run create-super-admin -- --email=<email> --name="<nome>"
unset ADMIN_PASSWORD
```

## Limitações conhecidas

- **`vercel dev` não sobe a API.** Ele roda o TypeScript pelo `tsx` (esbuild), que não emite o metadata de decorators do qual a injeção de dependência do NestJS depende, e o `JwtStrategy` recebe `undefined` no construtor. Localmente, use `npm run dev`; o deploy da Vercel compila com o `tsc` e funciona. A correção, se um dia for preciso, é declarar a injeção explicitamente com `@Inject(Token)` em cada parâmetro de construtor das classes do Nest, o que deixa o código independente do compilador (e muda a regra correspondente na skill `new-use-case`). Planejado na [PROJ-80](https://flpenteado.atlassian.net/browse/PROJ-80).
- **O primeiro deploy do projeto saiu como produção**, a partir da `feat/task-53`, mesmo com `main` como branch de produção: a Vercel promove o primeiro deploy quando ainda não existe nenhum. A partir dele, só `main` vai para produção.
- **Aviso de `sslmode` do driver `pg`.** As URLs do Neon vêm com `sslmode=require`, que hoje o driver trata como `verify-full` (confere o certificado) e avisa que isso vai enfraquecer numa versão futura. Para manter o comportamento atual e calar o aviso, troque para `sslmode=verify-full` nas URLs guardadas na Vercel.
- **A URL de produção `*.vercel.app` também exige login na Vercel.** Antes de apontar os Sites para a API (PROJ-71), é preciso um domínio próprio ou mudar a proteção.
